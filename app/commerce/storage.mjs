import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const id = prefix => prefix + '-' + crypto.randomUUID();
export function assertId(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{1,90}$/.test(value)) throw new Error('Invalid identifier');
  return value;
}
export function plain(value, label = 'object') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  return value;
}
export function text(value, label, max = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) throw new Error(label + ' is missing or too long');
  return value.trim();
}
export function noLinks(p) {
  p = path.resolve(p); let at = path.parse(p).root;
  for (const segment of p.slice(at.length).split(path.sep).filter(Boolean)) {
    at = path.join(at, segment);
    try { if (fs.lstatSync(at).isSymbolicLink()) throw new Error('Linked/junction workspace paths are not supported'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return p;
}
export function inside(root, candidate) {
  const rel = path.relative(path.resolve(root), path.resolve(candidate));
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}
function defaultCommerceHome() {
  const next = path.join(os.homedir(), '.ecom-agents-commerce');
  const legacy = path.join(os.homedir(), '.ai-employees-commerce');
  return !fs.existsSync(next) && fs.existsSync(legacy) ? legacy : next;
}
export function chooseHome(repo, explicit) {
  const root = noLinks(explicit || process.env.COMMERCE_HOME || defaultCommerceHome());
  if (inside(repo, root) || inside(root, repo)) throw new Error('Choose a private data folder separate from the source repository');
  if (/onedrive|dropbox|icloud|google\s?drive|mobile documents/i.test(root)) throw new Error('Cloud-sync folders are not supported for live data');
  for (let p = root; ; p = path.dirname(p)) {
    if (fs.existsSync(path.join(p, '.git'))) throw new Error('Business data must be outside any Git checkout');
    if (path.dirname(p) === p) break;
  }
  fs.mkdirSync(root, {recursive:true, mode:0o700});
  return root;
}
export function atomic(file, bytes) {
  noLinks(file); fs.mkdirSync(path.dirname(file), {recursive:true, mode:0o700});
  const temp = file + '.tmp-' + crypto.randomUUID();
  const fd = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try {
    fs.renameSync(temp, file);
    // A directory fsync is unsupported on some Windows filesystems.
    if (process.platform !== 'win32') { const d = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(d); } finally { fs.closeSync(d); } }
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
export function exclusive(root, name) {
  const dir = noLinks(path.join(root, name)); const token = crypto.randomUUID();
  try { fs.mkdirSync(dir, {mode:0o700}); }
  catch (e) { if (e.code === 'EEXIST') throw new Error('WORKSPACE_BUSY: another owner or an interrupted run holds ' + name); throw e; }
  try { atomic(path.join(dir, 'owner.json'), JSON.stringify({token, pid:process.pid, host:os.hostname(), started:new Date().toISOString()})); }
  catch (e) { throw new Error('Could not record lock owner; inspect ' + dir + ': ' + e.message); }
  return {token, release() {
    try {
      const own = JSON.parse(fs.readFileSync(path.join(dir, 'owner.json'), 'utf8'));
      if (own.token !== token) return;
      fs.unlinkSync(path.join(dir, 'owner.json')); fs.rmdirSync(dir);
    } catch { /* Never remove another owner's lock. */ }
  }};
}
const JOB_STATES = new Set(['waiting','ready','running','awaiting-result','review','succeeded','hold','failed','uncertain','cancelled']);
export class Store {
  constructor(root) {
    this.root = noLinks(root); fs.mkdirSync(root, {recursive:true, mode:0o700});
    this.file = path.join(root, 'commerce.json'); noLinks(this.file);
    const lock = exclusive(root, '.transaction.lock');
    try {
      if (!fs.existsSync(this.file)) this.save({schema:'commerce-state/1', revision:0, settings:{runner:'manual', role_runners:{}, timeout_seconds:600}, runs:[], events:[]});
      this.read();
    } finally { lock.release(); }
  }
  read() { return readState(this.root); }
  save(data) { const bytes=JSON.stringify({checksum:hash(JSON.stringify(data)), data}, null, 2) + '\n'; if(Buffer.byteLength(bytes)>64*1024*1024)throw new Error('Workspace size limit reached; preserve data and use a new workspace'); atomic(this.file, bytes); }
  change(action) {
    const lock = exclusive(this.root, '.transaction.lock');
    try { const s = this.read(); const value = action(s); s.revision++; this.save(s); return value; }
    finally { lock.release(); }
  }
}
export function event(s, type, run, job, detail = {}) {
  const previous = s.events.at(-1)?.hash || 'genesis';
  const row = {seq:s.events.length + 1, at:new Date().toISOString(), type, run:run?.id || null, job:job?.id || null, ...detail, previous};
  row.hash = hash(JSON.stringify(row)); s.events.push(row); return row;
}
export function verifyEvents(s) {
  let previous = 'genesis';
  return s.events.every((e, i) => { const {hash:want, ...body} = e; const ok = e.seq === i + 1 && e.previous === previous && hash(JSON.stringify(body)) === want; previous = want; return ok; });
}

export function readState(root) {
    const file = path.join(root, 'commerce.json');
    noLinks(file);
    if (fs.statSync(file).size > 64*1024*1024) throw new Error('Workspace ledger exceeds supported size; archive through a reviewed migration');
    let envelope;
    try { envelope = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('LEDGER_DAMAGED: invalid JSON; do not reset or replace with an empty workspace'); }
    const s = envelope?.data;
    if (!s || envelope.checksum !== hash(JSON.stringify(s)) || s.schema !== 'commerce-state/1' || !Number.isSafeInteger(s.revision) || !Array.isArray(s.runs) || !Array.isArray(s.events)) throw new Error('LEDGER_DAMAGED: checksum/schema mismatch');
    for (const run of s.runs) {
      assertId(run.id);
      if (!Array.isArray(run.jobs) || !run.jobs.every(j => JOB_STATES.has(j.state))) throw new Error('LEDGER_DAMAGED: unknown job state');
    }
    return s;
  }
