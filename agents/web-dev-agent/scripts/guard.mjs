#!/usr/bin/env node
/* A cheap, read-only preflight. Use run-routine.mjs for an atomic run lock. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const KEYS = ['YYYY-MM-DD', 'YYYY-Www', 'YYYY-MM'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const stripBom = s => s.replace(/^\uFEFF/, '');
const pad = n => String(n).padStart(2, '0');
export function localDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function isoLocal(d) {
  const offset = -d.getTimezoneOffset(), sign = offset >= 0 ? '+' : '-';
  return localDate(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + sign + pad(Math.floor(Math.abs(offset)/60)) + ':' + pad(Math.abs(offset)%60);
}
export function localNow(flag) {
  if (!flag) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(flag);
  if (!m) throw new Error('now must use local YYYY-MM-DDTHH:MM');
  const d = new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]);
  if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2]-1 || d.getDate() !== +m[3] || d.getHours() !== +m[4] || d.getMinutes() !== +m[5]) throw new Error('Invalid local date/time');
  return d;
}
export function periodKey(key, d) {
  if (key === 'YYYY-MM-DD') return localDate(d);
  if (key === 'YYYY-MM') return localDate(d).slice(0,7);
  if (key !== 'YYYY-Www') throw new Error('Unknown period key');
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const week = Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + '-W' + pad(week);
}
export function readRow(root, id) {
  if (!/^[a-z][a-z0-9-]{1,79}$/.test(id)) throw new Error('Invalid routine id');
  const text = stripBom(fs.readFileSync(path.join(root, 'SCHEDULE.md'), 'utf8'));
  const candidates = text.split(/\r?\n/).filter(l => l.trim().startsWith('|')).map(l => l.trim().split('|').slice(1,-1).map(x => x.trim().replace(/^`|`$/g, ''))).filter(c => c[0] === id && c.length === 8);
  if (candidates.length !== 1) throw new Error('Schedule must have exactly one machine-readable row for this routine');
  const c = candidates[0], [routine, days, fire, windowStart, windowEnd, key, budgetText, browser] = c;
  const time = s => { if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new Error('Invalid schedule clock'); return Number(s.slice(0,2))*60 + Number(s.slice(3)); };
  const start = time(windowStart), end = time(windowEnd), at = time(fire);
  if (start > end) throw new Error('Overnight windows are unsupported; split the job explicitly');
  if (at < start || at > end) throw new Error('Fire time is outside the window');
  const tokens = days.split(/[,\s]+/).filter(Boolean);
  const validDays = new Set([...DAYS, 'mon-fri', 'mon-sun', 'daily', 'first-weekday', 'last-weekday', 'off']);
  if (!tokens.length || tokens.some(t => !validDays.has(t)) || (tokens.includes('off') && tokens.length !== 1)) throw new Error('Unknown or conflicting schedule day');
  if (!KEYS.includes(key)) throw new Error('Unknown schedule period key');
  if (!/^\d+\s+min$/.test(budgetText)) throw new Error('Budget must use integer min');
  const budget = parseInt(budgetText, 10);
  if (budget < 1 || budget > 1440) throw new Error('Budget is outside 1..1440 minutes');
  if (!['never','none','light','conditional','heavy','read only'].includes(browser)) throw new Error('Unknown browser lane');
  return { routine, days, fire, windowStart, windowEnd, key, budget, browser };
}
export function dayAllowed(days, d) {
  const weekday = d.getDay() >= 1 && d.getDay() <= 5;
  const dom = d.getDate(), total = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  return days.split(/[,\s]+/).some(t => t === DAYS[d.getDay()] || t === 'daily' || t === 'mon-sun' || (t === 'mon-fri' && weekday) || (t === 'first-weekday' && weekday && dom <= 7) || (t === 'last-weekday' && weekday && dom > total-7));
}
function safeReadState(root, id, key) {
  const p = path.join(root, 'state', id + '.json');
  if (!fs.existsSync(p)) return { exists: false, lastPeriod: null };
  if (fs.lstatSync(p).isSymbolicLink()) throw new Error('State is a symlink; manual review required');
  let j;
  try { j = JSON.parse(stripBom(fs.readFileSync(p, 'utf8'))); } catch { throw new Error('Unreadable state; preserve it and reconcile before retrying'); }
  if (!j || Array.isArray(j) || typeof j !== 'object') throw new Error('Invalid state object');
  if (j.last_period != null && (typeof j.last_period !== 'string' || !/^\d{4}-(?:\d{2}(?:-\d{2})?|W\d{2})$/.test(j.last_period))) throw new Error('Invalid state period');
  if(j.last_period != null) {
    const value=j.last_period;
    if(key==='YYYY-MM-DD') {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('State period shape conflicts with schedule; migration required');
      localNow(value+'T12:00');
    } else if(key==='YYYY-MM') {
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))throw new Error('Invalid monthly state period');
    } else if(key==='YYYY-Www') {
      const match=/^(\d{4})-W(\d{2})$/.exec(value);
      if(!match)throw new Error('Invalid weekly state period');
      const max=Number(periodKey('YYYY-Www',new Date(+match[1],11,28)).slice(-2));
      if(+match[2]<1||+match[2]>max)throw new Error('Invalid ISO week in state');
    }
  }
  return { exists: true, lastPeriod: j.last_period ?? null };
}
function loggingPeriod(root,id,now,fallback=localDate(now)) {
  try { return periodKey(readRow(root,id).key,now); } catch {}
  try {
    const mf=path.join(root,fs.existsSync(path.join(root,'agent.json'))?'agent.json':'employee.json');
    const m=JSON.parse(stripBom(fs.readFileSync(mf,'utf8')));
    const row=m.routines?.find(r=>r.id===id);
    if(row && KEYS.includes(row.period_key)) return periodKey(row.period_key,now);
  } catch {}
  return fallback;
}
export function decide(root, id, now = new Date()) {
  const result = { routine: id, verdict: 'run', period: localDate(now), now: isoLocal(now), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, notes: [] };
  try {
    if (!/^[a-z][a-z0-9-]{1,79}$/.test(id)) throw new Error('Invalid routine id');
    const paused = path.join(root, 'PAUSED');
    if (fs.existsSync(paused)) {
      let ids;
      try { ids = stripBom(fs.readFileSync(paused, 'utf8')).split(/\r?\n/).map(s=>s.trim()).filter(Boolean); }
      catch { ids = []; }
      if (!ids.length || ids.includes(id)) { result.verdict = 'skipped-paused'; result.period=loggingPeriod(root,id,now); result.notes.push('PAUSED covers this routine'); return result; }
    }
    const row = readRow(root, id); Object.assign(result, row, { window: row.windowStart + ' to ' + row.windowEnd });
    result.period = periodKey(row.key, now);
    // Fail closed BEFORE window or once-per-period decisions, never erase bad state.
    const state = safeReadState(root, id, row.key);
    const firstRun = row.days === 'first-weekday' && !state.exists;
    if (firstRun) result.notes.push('first run, window guard not applicable');
    else if (!dayAllowed(row.days, now) || now.getHours()*60 + now.getMinutes() < Number(row.windowStart.slice(0,2))*60+Number(row.windowStart.slice(3)) || now.getHours()*60+now.getMinutes() > Number(row.windowEnd.slice(0,2))*60+Number(row.windowEnd.slice(3))) {
      result.verdict = 'skipped-out-of-window'; result.notes.push('Outside configured day/window'); return result;
    }
    if (state.lastPeriod === result.period) { result.verdict = 'skipped-already-ran'; result.notes.push('State already carries this period'); }
    return result;
  } catch (e) { result.period=loggingPeriod(root,id,now,result.period); result.verdict = 'failed'; result.blockers = [e.message]; result.notes.push('Preflight refused unsafe or invalid state/configuration'); return result; }
}
export function writeRecord(root, verdict) {
  const runlog = path.join(root, 'scripts', 'runlog.mjs');
  const record = { routine: verdict.routine, period: verdict.period, start: verdict.now, end: verdict.now, status: verdict.verdict,
    outputs: [], blockers: verdict.blockers || [], notes: verdict.notes.join('; ').slice(0, 380) };
  const r = spawnSync(process.execPath, [runlog, '--root', root, '--stdin'], { input: JSON.stringify(record), encoding: 'utf8' });
  return { ok: r.status === 0, reason: r.status === 0 ? '' : 'runlog rejected the record; inspect the local logger' };
}
function selftest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-guard-test-'));
  try {
    const id = 'demo-job';
    fs.writeFileSync(path.join(tmp,'SCHEDULE.md'), '| `demo-job` | `mon-fri` | 08:00 | 07:00 | 10:00 | `YYYY-MM-DD` | 12 min | never |\n');
    const a = decide(tmp, id, localNow('2026-09-21T08:00'));
    if (a.verdict !== 'run') throw new Error('valid schedule');
    fs.mkdirSync(path.join(tmp, 'state')); fs.writeFileSync(path.join(tmp, 'state', id+'.json'), '{broken');
    if (decide(tmp, id, localNow('2026-09-21T08:00')).verdict !== 'failed') throw new Error('bad state did not fail closed');
    if (periodKey('YYYY-Www', localNow('2026-09-20T12:00')) === periodKey('YYYY-Www', localNow('2026-09-21T12:00'))) throw new Error('ISO week boundary');
    console.log('PASS guard selftest');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
function main(argv) {
  const o = { id: null, root: path.resolve(HERE,'..'), noRecord:false, json:false };
  for (let i=0;i<argv.length;i++) {
    const a=argv[i];
    if (a === '--selftest') { selftest(); return 0; }
    if (a === '--help' || a === '-h') { console.log('guard.mjs <id> [--root path] [--json] [--now local-time --no-record]. Read-only preflight; run-routine.mjs owns locking.'); return 0; }
    if (a === '--json') o.json=true;
    else if (a === '--no-record') o.noRecord=true;
    else if (a === '--root' || a === '--now') { if (!argv[i+1]) throw new Error('Missing option value'); o[a.slice(2)] = argv[++i]; }
    else if (a.startsWith('-') || o.id) throw new Error('Unknown argument'); else o.id=a;
  }
  if (!o.id) throw new Error('Routine id required');
  if (o.now && !o.noRecord) throw new Error('Simulated clocks require --no-record');
  const v=decide(path.resolve(o.root), o.id, localNow(o.now));
  if (v.verdict !== 'run' && !o.noRecord) { const r=writeRecord(path.resolve(o.root),v); if (!r.ok) { v.record='FAILED'; v.blockers=[...(v.blockers||[]),r.reason]; } }
  console.log(o.json ? JSON.stringify(v) : [v.verdict, 'routine='+v.routine, 'period='+v.period, ...(v.notes||[])].join('\n'));
  return v.record === 'FAILED' || v.verdict === 'failed' ? 11 : v.verdict === 'run' ? 0 : 10;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode=main(process.argv.slice(2)); } catch(e) { console.error('guard: '+e.message); process.exitCode=2; }
}
