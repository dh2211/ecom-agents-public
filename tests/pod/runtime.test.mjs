import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {decide,localNow,periodKey,readRow} from '../../scripts/runtime/guard.mjs';
import {acquire,supervise,logTail} from '../../scripts/runtime/run-routine.mjs';
function fixture(t,days='daily'){
 const r=fs.mkdtempSync(path.join(os.tmpdir(),'pod-runtime-'));t.after(()=>fs.rmSync(r,{recursive:true,force:true}));
 fs.mkdirSync(path.join(r,'scripts'));fs.mkdirSync(path.join(r,'state'));
 fs.writeFileSync(path.join(r,'SCHEDULE.md'),'| `demo-job` | `'+days+'` | 08:00 | 00:00 | 23:59 | `YYYY-MM-DD` | 1 min | never |\n');
 fs.writeFileSync(path.join(r,'scripts','runlog.mjs'),"import fs from 'node:fs'; const a=process.argv;const root=a[a.indexOf('--root')+1];const x=JSON.parse(fs.readFileSync(0,'utf8'));fs.appendFileSync(root+'/runlog.jsonl',JSON.stringify(x)+'\\n');");return r;
}
test('valid schedule passes',t=>assert.equal(decide(fixture(t),'demo-job',localNow('2026-09-21T08:00')).verdict,'run'));
test('state JSON corruption fails closed and stays untouched',t=>{const r=fixture(t),p=path.join(r,'state/demo-job.json');fs.writeFileSync(p,'{broken');assert.equal(decide(r,'demo-job').verdict,'failed');assert.equal(fs.readFileSync(p,'utf8'),'{broken');});
test('non-object state fails closed',t=>{const r=fixture(t);fs.writeFileSync(path.join(r,'state/demo-job.json'),'[]');assert.equal(decide(r,'demo-job').verdict,'failed');});
test('PAUSED takes precedence over corrupt state',t=>{const r=fixture(t);fs.writeFileSync(path.join(r,'PAUSED'),'');fs.writeFileSync(path.join(r,'state/demo-job.json'),'{');assert.equal(decide(r,'demo-job').verdict,'skipped-paused');});
test('selective pause does not stop another routine',t=>{const r=fixture(t);fs.writeFileSync(path.join(r,'PAUSED'),'other-job');assert.equal(decide(r,'demo-job').verdict,'run');});
test('duplicate period skips',t=>{const r=fixture(t);fs.writeFileSync(path.join(r,'state/demo-job.json'),'{"last_period":"2026-09-21"}');assert.equal(decide(r,'demo-job',localNow('2026-09-21T08:00')).verdict,'skipped-already-ran');});
test('Sunday and following Monday have different ISO keys',()=>{assert.equal(periodKey('YYYY-Www',localNow('2026-09-20T12:00')),'2026-W38');assert.equal(periodKey('YYYY-Www',localNow('2026-09-21T12:00')),'2026-W39');});
test('ISO year boundary correct',()=>assert.equal(periodKey('YYYY-Www',localNow('2021-01-01T12:00')),'2020-W53'));
test('invalid local date is rejected',()=>assert.throws(()=>localNow('2026-02-30T08:00')));
test('Sunday explicitly supported',t=>assert.equal(decide(fixture(t,'sun'),'demo-job',localNow('2026-09-20T08:00')).verdict,'run'));
test('unknown day fails instead of silently skipping',t=>assert.equal(decide(fixture(t,'tommorrow'),'demo-job').verdict,'failed'));
test('off cannot be combined with another day',t=>assert.equal(decide(fixture(t,'off,mon'),'demo-job').verdict,'failed'));
test('invalid clock and overnight window rejected',t=>{const r=fixture(t),p=path.join(r,'SCHEDULE.md');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('00:00 | 23:59','23:00 | 01:00'));assert.throws(()=>readRow(r,'demo-job'),/Overnight/);});
test('traversal routine id rejected',t=>assert.equal(decide(fixture(t),'../evil').verdict,'failed'));
test('atomic resource lock blocks same resource but allows disjoint',t=>{const r=fixture(t),a=acquire(path.join(r,'locks'),['a']);assert.throws(()=>acquire(path.join(r,'locks'),['a']),/LOCK_BUSY/);const b=acquire(path.join(r,'locks'),['b']);b.release();a.release();const c=acquire(path.join(r,'locks'),['a']);c.release();});
test('release never deletes a replaced foreign owner',t=>{const r=fixture(t),dir=path.join(r,'locks'),a=acquire(dir,['a']);const d=fs.readdirSync(dir)[0];fs.writeFileSync(path.join(dir,d,'owner.json'),'{"token":"someone-else"}');a.release();assert.ok(fs.existsSync(path.join(dir,d)));});
test('a pre-rename owner in the legacy root blocks a dual-root acquire',t=>{
 const r=fixture(t),legacy=path.join(r,'ai-employees','locks'),next=path.join(r,'ecom-agents','locks');
 const oldKit=acquire(legacy,['local-browser']);
 assert.throws(()=>acquire([next,legacy],['local-browser']),/LOCK_BUSY/);
 assert.equal(fs.readdirSync(next).filter(x=>x.endsWith('.lock')).length,0,'failed acquire must not leave a partial lock in the new root');
 oldKit.release();
 const newKit=acquire([next,legacy],['local-browser']);
 assert.throws(()=>acquire(legacy,['local-browser']),/LOCK_BUSY/);
 newKit.release();
});
test('real simultaneous processes get exactly one owner',async t=>{
 const r=fixture(t),lockRoot=path.join(r,'locks'),module=pathToFileURL(path.resolve('scripts/runtime/run-routine.mjs')).href;
 const js=`import {acquire} from ${JSON.stringify(module)}; try{const l=acquire(${JSON.stringify(lockRoot)},['shared']); console.log('won');setTimeout(()=>{l.release();},1000);}catch{console.log('blocked');}`;
 const child=()=>new Promise(resolve=>{let output='';const p=spawn(process.execPath,['--input-type=module','-e',js]);p.stdout.on('data',b=>output+=b);p.on('close',()=>resolve(output.trim()));});
 const outputs=await Promise.all([child(),child(),child(),child()]);assert.equal(outputs.filter(x=>x==='won').length,1);assert.equal(outputs.filter(x=>x==='blocked').length,3);
});
test('successful terminal record marks completed and duplicate does not run',async t=>{
 const r=fixture(t),v=decide(r,'demo-job'),worker=path.join(r,'worker.mjs');
 fs.writeFileSync(worker,`import fs from 'node:fs';fs.appendFileSync('runlog.jsonl',JSON.stringify({routine:'demo-job',period:${JSON.stringify(v.period)},status:'ok',start:new Date().toISOString(),end:new Date().toISOString(),outputs:[],blockers:[],notes:''})+'\\n');`);
 const a=await supervise({root:r,id:'demo-job',command:process.execPath,args:[worker],lockRoot:path.join(r,'locks')});assert.equal(a.status,'completed');
 const b=await supervise({root:r,id:'demo-job',command:'not-a-real-command',lockRoot:path.join(r,'locks')});assert.equal(b.status,'skipped-already-ran');
});
test('a refused concurrent supervisor cannot contaminate its owner terminal evidence',async t=>{
 const r=fixture(t),v=decide(r,'demo-job'),lockRoot=path.join(r,'locks');
 const record={routine:'demo-job',period:v.period,status:'ok',start:new Date().toISOString(),end:new Date().toISOString(),outputs:[],blockers:[],notes:''};
 const owner=supervise({root:r,id:'demo-job',command:process.execPath,args:['-e',`setTimeout(()=>require('fs').appendFileSync('runlog.jsonl',${JSON.stringify(JSON.stringify(record)+'\n')}),700)`],lockRoot});
 const contender=await supervise({root:r,id:'demo-job',command:'must-not-start',lockRoot});
 assert.equal(contender.status,'failed');
 assert.equal((await owner).status,'completed');
 assert.equal(fs.readFileSync(path.join(r,'runlog.jsonl'),'utf8').trim().split('\n').length,1);
 assert.equal(JSON.parse(fs.readFileSync(contender.record.path,'utf8')).status,'failed');
});
for(const statuses of [['ok','failed'],['ok','ok']]) test('owner terminal ambiguity stays uncertain: '+statuses.join(','),async t=>{
 const r=fixture(t),v=decide(r,'demo-job');
 const rows=statuses.map(status=>JSON.stringify({routine:'demo-job',period:v.period,status,start:new Date().toISOString(),end:new Date().toISOString(),outputs:[],blockers:[],notes:''})).join('\n')+'\n';
 const result=await supervise({root:r,id:'demo-job',command:process.execPath,args:['-e',`require('fs').appendFileSync('runlog.jsonl',${JSON.stringify(rows)})`],lockRoot:path.join(r,'locks')});
 assert.equal(result.status,'uncertain');
});
test('exit zero without run record is uncertain, never success',async t=>{const r=fixture(t);const a=await supervise({root:r,id:'demo-job',command:process.execPath,args:['-e','process.exit(0)'],lockRoot:path.join(r,'locks')});assert.equal(a.status,'uncertain');const b=await supervise({root:r,id:'demo-job',command:process.execPath,args:['-e',''],lockRoot:path.join(r,'locks')});assert.equal(b.status,'failed');assert.equal(b.exitCode,1);});
test('nonexistent executable leaves failure evidence',async t=>{const r=fixture(t),a=await supervise({root:r,id:'demo-job',command:'missing-harness-xyz',lockRoot:path.join(r,'locks')});assert.equal(a.status,'uncertain');assert.ok(fs.existsSync(path.join(r,'runlog.jsonl')));});
test('timeout kills the worker and records uncertainty',async t=>{const r=fixture(t),a=await supervise({root:r,id:'demo-job',command:process.execPath,args:['-e','setInterval(()=>{},1000)'],timeoutMs:100,lockRoot:path.join(r,'locks')});assert.equal(a.status,'uncertain');const p=path.join(r,'state/runtime/demo-job',decide(r,'demo-job').period+'.json');assert.equal(JSON.parse(fs.readFileSync(p)).timed_out,true);});

test('a forged thin ok record cannot count as successful',async t=>{const r=fixture(t),v=decide(r,'demo-job');const a=await supervise({root:r,id:'demo-job',command:process.execPath,args:['-e',"require('fs').appendFileSync('runlog.jsonl',JSON.stringify({routine:'demo-job',period:'"+v.period+"',status:'ok'})+'\\n')"],lockRoot:path.join(r,'locks')});assert.equal(a.status,'uncertain');});

test('old uncertain journal blocks before the harness and records its period',async t=>{
 const r=fixture(t),oldPeriod='2020-01-01',journalDir=path.join(r,'state','runtime','demo-job'),marker=path.join(r,'harness-ran');
 fs.mkdirSync(journalDir,{recursive:true});
 const journalPath=path.join(journalDir,oldPeriod+'.json');
 fs.writeFileSync(journalPath,JSON.stringify({routine:'demo-job',period:oldPeriod,status:'uncertain'}));
 const journalBefore=fs.readFileSync(journalPath,'utf8');
 const a=await supervise({root:r,id:'demo-job',command:process.execPath,args:['-e',"require('fs').writeFileSync('harness-ran','yes')"],lockRoot:path.join(r,'locks')});
 assert.equal(a.status,'failed');
 assert.equal(a.exitCode,1);
 assert.equal(fs.existsSync(marker),false);
 assert.equal(fs.readFileSync(journalPath,'utf8'),journalBefore);
 assert.equal(fs.existsSync(path.join(journalDir,decide(r,'demo-job').period+'.json')),false);
 const records=[JSON.parse(fs.readFileSync(a.record.path,'utf8'))];
 assert.equal(records.length,1);
 assert.equal(records[0].status,'failed');
 assert.match(records[0].blockers.join(' '),new RegExp(oldPeriod));
 assert.match(records[0].blockers.join(' '),/uncertain/);
});

test('lock busy records one failure without a journal or harness',async t=>{
 const r=fixture(t),lockRoot=path.join(r,'locks'),marker=path.join(r,'harness-ran');
 const lockIdentity=process.platform==='win32'?path.resolve(r).toLowerCase():path.resolve(r);
 const holder=acquire(lockRoot,['kit:'+lockIdentity]);
 try {
  const a=await supervise({root:r,id:'demo-job',command:process.execPath,args:['-e',"require('fs').writeFileSync('harness-ran','yes')"],lockRoot});
  assert.equal(a.status,'failed');
  assert.equal(a.exitCode,1);
  assert.equal(fs.existsSync(marker),false);
  assert.equal(fs.existsSync(path.join(r,'state','runtime')),false);
  assert.equal(fs.existsSync(path.join(r,'runlog.jsonl')),false);
  const records=[JSON.parse(fs.readFileSync(a.record.path,'utf8'))];
  assert.equal(records.length,1);
  assert.equal(records[0].status,'failed');
  const blockers=records[0].blockers.join(' ');
  assert.match(blockers,/LOCK_BUSY/);
  assert.ok(blockers.includes('kit:'+lockIdentity));
 } finally { holder.release(); }
 });

test('malformed journal blocks without exposing its contents',async t=>{
 const r=fixture(t),period='2020-01-02',journalDir=path.join(r,'state','runtime','demo-job'),marker=path.join(r,'harness-ran'),body='journal contents stay private';
 fs.mkdirSync(journalDir,{recursive:true});
 fs.writeFileSync(path.join(journalDir,period+'.json'),body);
 const a=await supervise({root:r,id:'demo-job',command:process.execPath,args:['-e',"require('fs').writeFileSync('harness-ran','yes')"],lockRoot:path.join(r,'locks')});
 assert.equal(a.status,'failed');
 assert.equal(fs.existsSync(marker),false);
 const record=JSON.parse(fs.readFileSync(a.record.path,'utf8'));
 assert.match(record.blockers.join(' '),new RegExp(period));
 assert.match(record.blockers.join(' '),/malformed/);
 assert.doesNotMatch(record.blockers.join(' '),new RegExp(body));
});

test('symlink journal blocks before the harness',async t=>{
 const r=fixture(t),period='2020-01-03',journalDir=path.join(r,'state','runtime','demo-job'),marker=path.join(r,'harness-ran');
 fs.mkdirSync(journalDir,{recursive:true});
 const target=path.join(r,'journal-target.json');fs.writeFileSync(target,JSON.stringify({status:'uncertain'}));
 try { fs.symlinkSync(target,path.join(journalDir,period+'.json')); }
 catch(e) { t.skip('symlink creation is unavailable: '+e.code); return; }
 const a=await supervise({root:r,id:'demo-job',command:process.execPath,args:['-e',"require('fs').writeFileSync('harness-ran','yes')"],lockRoot:path.join(r,'locks')});
 assert.equal(a.status,'failed');
 assert.equal(fs.existsSync(marker),false);
 const record=JSON.parse(fs.readFileSync(a.record.path,'utf8'));
 assert.match(record.blockers.join(' '),new RegExp(period));
 assert.match(record.blockers.join(' '),/symlink/);
});

test('run log tail reads only the new suffix',t=>{
 const r=fixture(t),p=path.join(r,'runlog.jsonl');
 const old={routine:'other',period:'2026-09-20',status:'ok',start:'2026-09-20T08:00:00.000Z',end:'2026-09-20T08:01:00.000Z',outputs:[],blockers:[],notes:''};
 fs.writeFileSync(p,(JSON.stringify(old)+'\n').repeat(2000));
 const offset=fs.statSync(p).size;
 const row={routine:'demo-job',period:'2026-09-21',status:'ok',start:'2026-09-21T08:00:00.000Z',end:'2026-09-21T08:01:00.000Z',outputs:[],blockers:[],notes:''};
 fs.appendFileSync(p,JSON.stringify(row)+'\n');
 assert.deepEqual(logTail(r,offset,'demo-job','2026-09-21'),[row]);
 assert.throws(()=>logTail(r,offset+1000000,'demo-job','2026-09-21'),/shrank/);
 fs.appendFileSync(p,'{');
 assert.throws(()=>logTail(r,offset,'demo-job','2026-09-21'),/unterminated/);
});
test('all shipped runtime supervisors match the source copy',()=>{
 const source=fs.readFileSync(path.resolve('scripts/runtime/run-routine.mjs'),'utf8');
 const kits=['ad-manager-agent','chief-of-staff','customer-satisfaction-agent','gtm-engineer','pod-design-agent','sales-agent','seo-agent','social-media-agent','web-dev-agent'];
 for(const kit of kits) assert.equal(fs.readFileSync(path.join('agents',kit,'scripts','run-routine.mjs'),'utf8'),source,kit+' runtime supervisor drifted');
});

test('paused weekly routine keeps weekly log period',t=>{const r=fixture(t),p=path.join(r,'SCHEDULE.md');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('YYYY-MM-DD','YYYY-Www'));fs.writeFileSync(path.join(r,'PAUSED'),'');const v=decide(r,'demo-job',localNow('2026-09-21T08:00'));assert.equal(v.verdict,'skipped-paused');assert.equal(v.period,'2026-W39');});
test('failed schedule uses manifest period for compatible error logging',t=>{const r=fixture(t);fs.writeFileSync(path.join(r,'SCHEDULE.md'),'broken');fs.writeFileSync(path.join(r,'agent.json'),JSON.stringify({routines:[{id:'demo-job',period_key:'YYYY-MM'}]}));const v=decide(r,'demo-job',localNow('2026-09-21T08:00'));assert.equal(v.verdict,'failed');assert.equal(v.period,'2026-09');});

test('impossible calendar date in state fails closed',t=>{const r=fixture(t);fs.writeFileSync(path.join(r,'state/demo-job.json'),'{"last_period":"2026-02-30"}');assert.equal(decide(r,'demo-job').verdict,'failed');});
test('changing period shape requires explicit state migration',t=>{const r=fixture(t);fs.writeFileSync(path.join(r,'state/demo-job.json'),'{"last_period":"2026-W39"}');assert.equal(decide(r,'demo-job').verdict,'failed');});
