#!/usr/bin/env node
/* External process supervisor. It does not execute, authorize, or replay business actions. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decide, isoLocal, localNow, periodKey, writeRecord } from './guard.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const digest = x => crypto.createHash('sha256').update(x).digest('hex');
const JOURNAL_STATUSES = new Set(['started','uncertain','completed','partial']);
const JOURNAL_PERIOD_PATTERNS = {
  'YYYY-MM-DD': /^\d{4}-\d{2}-\d{2}$/,
  'YYYY-MM': /^\d{4}-\d{2}$/,
  'YYYY-Www': /^\d{4}-W\d{2}$/,
};
function noSymlink(p) {
  let here=path.parse(path.resolve(p)).root;
  for (const part of path.resolve(p).slice(here.length).split(path.sep).filter(Boolean)) {
    here=path.join(here,part);
    try { if (fs.lstatSync(here).isSymbolicLink()) throw new Error('Runtime paths must not contain symlinks'); }
    catch(e) { if(e.code!=='ENOENT') throw e; }
  }
}
function writeAtomic(p, j) {
  noSymlink(p); fs.mkdirSync(path.dirname(p), {recursive:true,mode:0o700});
  const tmp=p+'.tmp-'+crypto.randomUUID();
  try { fs.writeFileSync(tmp,JSON.stringify(j,null,2)+'\n',{flag:'wx',mode:0o600}); fs.renameSync(tmp,p); }
  finally { fs.rmSync(tmp,{force:true}); }
}
function validJournalPeriod(period,key) {
  if(!JOURNAL_PERIOD_PATTERNS[key]?.test(period)) return false;
  if(key==='YYYY-MM-DD') {
    try { localNow(period+'T12:00'); return true; } catch { return false; }
  }
  if(key==='YYYY-MM') return Number(period.slice(-2))>=1&&Number(period.slice(-2))<=12;
  const year=Number(period.slice(0,4)),week=Number(period.slice(-2));
  if(week<1||week>53) return false;
  const max=Number(periodKey('YYYY-Www',new Date(year,11,28)).slice(-2));
  return week<=max;
}
function journalBlocker(period, detail) {
  return `Runtime journal ${period} ${detail}; manual reconciliation required`;
}
export function reconcileJournals(root,id,key) {
  const dir=path.join(root,'state','runtime',id);
  noSymlink(dir);
  if(!fs.existsSync(dir)) return [];
  const stat=fs.lstatSync(dir);
  if(stat.isSymbolicLink()) throw new Error('Runtime journal directory is a symlink; manual reconciliation required');
  if(!stat.isDirectory()) throw new Error('Runtime journal path is not a directory; manual reconciliation required');
  const blockers=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const period=entry.name.endsWith('.json')?entry.name.slice(0,-5):entry.name;
    if(entry.isSymbolicLink()) throw new Error(journalBlocker(period,'is a symlink'));
    if(!entry.isFile()) throw new Error(journalBlocker(period,'is not a regular journal file'));
    if(!entry.name.endsWith('.json')||!validJournalPeriod(period,key)) {
      throw new Error(journalBlocker(period,'has an invalid period filename'));
    }
    const file=path.join(dir,entry.name);noSymlink(file);
    let journal;
    try { journal=JSON.parse(fs.readFileSync(file,'utf8')); }
    catch { throw new Error(journalBlocker(period,'is malformed')); }
    if(!journal||typeof journal!=='object'||Array.isArray(journal)||typeof journal.status!=='string'||!JOURNAL_STATUSES.has(journal.status)) {
      throw new Error(journalBlocker(period,'has an invalid status'));
    }
    if(journal.routine!=null&&journal.routine!==id) throw new Error(journalBlocker(period,'names another routine'));
    if(journal.period!=null&&journal.period!==period) throw new Error(journalBlocker(period,'does not match its filename'));
    if(['started','uncertain'].includes(journal.status)) blockers.push(journalBlocker(period,`is ${journal.status}`));
  }
  return blockers;
}
export function acquire(lockRoots, resources) {
  const roots=[...new Set([].concat(lockRoots))].sort();
  if(!roots.length) throw new Error('At least one lock root is required');
  for(const root of roots){noSymlink(root);fs.mkdirSync(root,{recursive:true,mode:0o700});}
  const token=crypto.randomUUID(), held=[];
  const release=()=>{
    for(const p of held.reverse()) {
      try {
        const owner=JSON.parse(fs.readFileSync(path.join(p,'owner.json'),'utf8'));
        if(owner.token!==token) continue;
        fs.unlinkSync(path.join(p,'owner.json')); fs.rmdirSync(p);
      } catch { /* A foreign, incomplete or changed lock must be reviewed by the operator. */ }
    }
  };
  let busyResource;
  try {
    for(const resource of [...new Set(resources)].sort()) {
      for(const root of roots) {
        busyResource=resource;
        const p=path.join(root,digest(resource)+'.lock');
        fs.mkdirSync(p,{mode:0o700}); // Atomic exclusive claim, not read-then-write.
        held.push(p);
        fs.writeFileSync(path.join(p,'owner.json'),JSON.stringify({token,pid:process.pid,host:os.hostname(),started:new Date().toISOString(),resource_hash:digest(resource)}),{flag:'wx',mode:0o600});
      }
    }
  } catch(e) {
    release();
    if(e.code==='EEXIST') {
      const busy=new Error(`LOCK_BUSY: resource ${busyResource}; existing lock; stale locks are never auto-stolen`);
      busy.code='LOCK_BUSY';busy.resource=busyResource;throw busy;
    }
    throw e;
  }
  return {token,release};
}
function terminate(child, signal) {
  if (!child.pid) return;
  if(process.platform==='win32') {
    const killer=spawn('taskkill',['/pid',String(child.pid),'/t','/f'],{stdio:'ignore'}); killer.on('error',()=>child.kill());
  } else { try { process.kill(-child.pid,signal); } catch { child.kill(signal); } }
}
function launch(command,args,root,timeoutMs) {
  return new Promise(resolve=>{
    const child=spawn(command,args,{cwd:root,stdio:'inherit',shell:false,detached:process.platform!=='win32'});
    let timedOut=false, killTimer, errorMessage;
    const stop=()=>{timedOut=true;terminate(child,'SIGTERM');killTimer=setTimeout(()=>terminate(child,'SIGKILL'),1000);killTimer.unref();};
    const timer=setTimeout(stop,timeoutMs);
    const onTerm=()=>stop(); process.once('SIGTERM',onTerm);process.once('SIGINT',onTerm);
    child.on('error',()=>{errorMessage='Harness could not be started';});
    child.on('close',(code,signal)=>{clearTimeout(timer);clearTimeout(killTimer);process.removeListener('SIGTERM',onTerm);process.removeListener('SIGINT',onTerm);resolve({code,signal,timedOut,errorMessage});});
  });
}
export function logTail(root,offset,id,period) {
  const p=path.join(root,'runlog.jsonl');
  let fd;
  try { fd=fs.openSync(p,'r'); }
  catch(e) { if(e.code==='ENOENT') return []; throw e; }
  try {
  const size=fs.fstatSync(fd).size;
  if(!Number.isSafeInteger(offset)||offset<0||size<offset) throw new Error('Run log shrank during execution');
  const length=size-offset,bytes=Buffer.alloc(length);
  let got=0;
  while(got<length) {
    const n=fs.readSync(fd,bytes,got,length-got,offset+got);
    if(n<=0) throw new Error('Run log changed while it was read');
    got+=n;
  }
  if(length>0 && bytes[length-1]!==10)throw new Error('Run log has an unterminated record');
  const lines=bytes.toString('utf8').split('\n').filter(x=>x.trim());
  const rows=lines.map(x=>{let r;try{r=JSON.parse(x);}catch{throw new Error('Malformed run record');}
    if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.routine!=='string'||typeof r.period!=='string'||typeof r.status!=='string'||
      !Array.isArray(r.outputs)||!Array.isArray(r.blockers)||r.outputs.some(v=>typeof v!=='string')||r.blockers.some(v=>typeof v!=='string')||
      typeof r.notes!=='string'||/[\r\n]/.test(r.notes)||!Number.isFinite(Date.parse(r.start))||!Number.isFinite(Date.parse(r.end))||Date.parse(r.end)<Date.parse(r.start))throw new Error('Invalid terminal run-record shape');
    return r;});
  return rows.filter(r=>r.routine===id && r.period===period && !String(r.status).startsWith('skipped-'));
  } finally { fs.closeSync(fd); }
}
function defaultLockRoots(){
  const roots=[path.join(os.homedir(),'.ecom-agents','locks')];
  // Kits installed before the Ecom Agents rename keep their locks under
  // ~/.ai-employees. While that directory exists, a resource must be held in
  // both roots, or a pre-rename kit and a post-rename kit can each believe
  // they own the same shared resource such as the local browser lane.
  const legacy=path.join(os.homedir(),'.ai-employees');
  if(fs.existsSync(legacy))roots.push(path.join(legacy,'locks'));
  return roots;
}
function refusal(root,verdict) {
  // A process that did not acquire ownership cannot append owner terminal evidence.
  const file=path.join(root,'state','runtime-refusals',crypto.randomUUID()+'.json');
  writeAtomic(file,{routine:verdict.routine,period:verdict.period,status:verdict.verdict,
    observed_at:isoLocal(new Date()),blockers:verdict.blockers||[],notes:verdict.notes||[],harness_started:false});
  return {ok:true,path:file};
}
export async function supervise({root,id,command,args=[],lockRoot,resources=[],timeoutMs}) {
  root=path.resolve(root);noSymlink(root);root=fs.realpathSync(root);
  if(!command) throw new Error('Harness command required after --');
  const pre=decide(root,id);
  if(pre.verdict!=='run') { const rec=refusal(root,pre); return {status:pre.verdict,exitCode:rec.ok && pre.verdict!=='failed'?0:1,record:rec}; }
  let journalBlockers;
  try { journalBlockers=reconcileJournals(root,id,pre.key); }
  catch(e) {
    const rec=refusal(root,{...pre,verdict:'failed',blockers:[e.message],notes:['Runtime journal reconciliation required before starting']});
    return {status:'failed',exitCode:1,record:rec};
  }
  if(journalBlockers.length) {
    const rec=refusal(root,{...pre,verdict:'failed',blockers:journalBlockers,notes:['Runtime journal reconciliation required before starting']});
    return {status:'failed',exitCode:1,record:rec};
  }
  // Always serialize a kit; also serialize the local browser across kits by default.
  const lockIdentity=process.platform==='win32'?root.toLowerCase():root;
  const keys=['kit:'+lockIdentity,...resources];if(!['never','none'].includes(pre.browser)) keys.push('local-browser');
  let lock;
  try { lock=acquire(lockRoot?[lockRoot]:defaultLockRoots(),keys); }
  catch(e) {
    if(e?.code!=='LOCK_BUSY') throw e;
    const rec=refusal(root,{...pre,verdict:'failed',blockers:[e.message],notes:['Runtime lock refused; no harness was started']});
    return {status:'failed',exitCode:1,record:rec};
  }
  const journalPath=path.join(root,'state','runtime',id,pre.period+'.json');
  try {
    // Recheck under the lock to close the check/acquire race.
    const v=decide(root,id);
    if(v.verdict!=='run') { const rec=writeRecord(root,v);return {status:v.verdict,exitCode:rec.ok && v.verdict!=='failed'?0:1}; }
    const blockers=reconcileJournals(root,id,v.key);
    if(blockers.length) {
      const rec=refusal(root,{...v,verdict:'failed',blockers,notes:['Runtime journal reconciliation required before starting']});
      return {status:'failed',exitCode:1,record:rec};
    }
    noSymlink(journalPath);
    if(fs.existsSync(journalPath)) {
      let old;try{old=JSON.parse(fs.readFileSync(journalPath,'utf8'));}catch{throw new Error('Unreadable runtime journal; manual reconciliation required');}
      if(['completed','partial'].includes(old.status)) {
        const rec=writeRecord(root,{...v,verdict:'skipped-already-ran',notes:['Runtime journal already records this period']});
        return {status:'skipped-already-ran',exitCode:rec.ok?0:1};
      }
      throw new Error('INCOMPLETE_RUN: inspect journal, progress and external receipts; no automatic retry');
    }
    const runId=crypto.randomUUID(),start=isoLocal(new Date());
    const journal={run_id:runId,routine:id,period:v.period,status:'started',started:start,pid:process.pid};
    writeAtomic(journalPath,journal);
    const log=path.join(root,'runlog.jsonl');noSymlink(log);
    const offset=fs.existsSync(log)?fs.statSync(log).size:0;
    const cap=v.budget*60000+5000;
    // An explicit shorter timeout is useful for testing; cannot widen the budget.
    const duration=timeoutMs==null?cap:Math.min(cap,timeoutMs);
    if(!Number.isFinite(duration)||duration<=0) throw new Error('Invalid timeout');
    const result=await launch(command,args,root,duration);
    let records=[],logError;
    try{records=logTail(root,offset,id,v.period);}catch(e){logError=e.message;}
    let status='uncertain';
    if(result.code===0 && !result.timedOut && !logError && records.length===1 && ['ok','partial'].includes(records[0].status)) status=records[0].status==='ok'?'completed':'partial';
    const notes=result.timedOut?'Harness timed out':logError||result.errorMessage||'Harness did not produce exactly one successful terminal record';
    let fallbackOk=true;
    if(status==='uncertain' && records.length===0) {
      fallbackOk=writeRecord(root,{...v,now:start,verdict:'failed',blockers:['Runtime supervisor requires manual reconciliation'],notes:[notes]}).ok;
    }
    writeAtomic(journalPath,{...journal,status,ended:isoLocal(new Date()),exit_code:result.code,signal:result.signal,timed_out:result.timedOut,terminal_records:records.length,log_fallback_ok:fallbackOk});
    return {status,exitCode:status==='uncertain'?1:0,runId};
  } finally {lock.release();}
}
function selftest() {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'runtime-selftest-'));
  let failures=0,checks=0;
  const check=(name,ok)=>{checks++;if(!ok){failures++;console.error('  FAIL  '+name);}else console.log('  ok    '+name);};
  try {
    const first=acquire(tmp,['kit:selftest']);
    const lockDirs=fs.readdirSync(tmp).filter(x=>x.endsWith('.lock'));
    check('first owner acquires one lock',lockDirs.length===1);
    let blocked=false;
    try { acquire(tmp,['kit:selftest']); } catch(e) { blocked=/LOCK_BUSY/.test(String(e&&e.message)); }
    check('second owner is blocked',blocked);
    first.release();
    const second=acquire(tmp,['kit:selftest']);
    second.release();
    check('released resource can be acquired again',fs.readdirSync(tmp).filter(x=>x.endsWith('.lock')).length===0);
    const rootA=path.join(tmp,'root-a'),rootB=path.join(tmp,'root-b');
    const dual=acquire([rootA,rootB],['kit:selftest']);
    check('dual-root acquire holds a lock in each root',fs.readdirSync(rootA).filter(x=>x.endsWith('.lock')).length===1&&fs.readdirSync(rootB).filter(x=>x.endsWith('.lock')).length===1);
    let crossBlocked=false;
    try { acquire(rootB,['kit:selftest']); } catch(e) { crossBlocked=/LOCK_BUSY/.test(String(e&&e.message)); }
    check('a single-root owner is blocked by a lock held in the other root',crossBlocked);
    dual.release();
    check('dual-root release clears both roots',fs.readdirSync(rootA).filter(x=>x.endsWith('.lock')).length===0&&fs.readdirSync(rootB).filter(x=>x.endsWith('.lock')).length===0);
    const holder=acquire(rootA,['kit:selftest']);
    let partial=false;
    try { acquire([rootA,rootB],['kit:selftest']); } catch(e) { partial=/LOCK_BUSY/.test(String(e&&e.message)); }
    check('a failed dual-root acquire leaves no partial lock behind',partial&&fs.readdirSync(rootB).filter(x=>x.endsWith('.lock')).length===0);
    holder.release();
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
  console.log(failures===0?'runtime: selftest PASS ('+checks+' checks)':'runtime: selftest FAIL ('+failures+' of '+checks+' checks)');
  return failures===0?0:1;
}

async function main(argv) {
  const divider=argv.indexOf('--');
  if(divider<0) throw new Error('Usage: run-routine.mjs <id> [--root path] [--lock-root path] [--resource name] -- <executable> [args]');
  const before=argv.slice(0,divider),command=argv[divider+1],args=argv.slice(divider+2);
  const o={root:path.resolve(HERE,'..'),id:before.shift(),command,args,resources:[]};
  for(let i=0;i<before.length;i++) {
    const flag=before[i],value=before[++i];if(!value)throw new Error('Missing option value');
    if(flag==='--root')o.root=value;else if(flag==='--lock-root')o.lockRoot=value;else if(flag==='--resource')o.resources.push(value);else throw new Error('Unknown option');
  }
  const r=await supervise(o);console.log(JSON.stringify(r));return r.exitCode;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const argv=process.argv.slice(2);
  if(argv.length===1&&argv[0]==='--selftest') process.exitCode=selftest();
  else main(argv).then(code=>process.exitCode=code).catch(e=>{console.error('runtime: '+e.message);process.exitCode=1;});
}
