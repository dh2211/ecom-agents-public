import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {Engine,demoResult} from '../../app/commerce/engine.mjs';
import {Store,exclusive,hash,chooseHome,verifyEvents} from '../../app/commerce/storage.mjs';
import {WORKFLOWS,validatePlan} from '../../app/commerce/workflows.mjs';
import {decodeOutput,execute,claudeCommand,codexCommand,runnerSpec,CODEX_DISABLED_FEATURES} from '../../app/commerce/runner.mjs';
import {start,REPO} from '../../app/commerce/server.mjs';
import {recover} from '../../app/commerce/recover.mjs';
import {crc32} from '../../scripts/pod/print-qa.mjs';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'commerce space-'));
const make=()=>{const home=temp();return {home,e:new Engine(home,REPO)};};
const remove=h=>fs.rmSync(h,{recursive:true,force:true});
const input=(extra={})=>({workflow:'creative-batch',model:'pod',title:'Project',brief:'A documented product, original product images and no secret information.',store_id:'test-store',currency:'USD',market:'US',timezone:'Asia/Ho_Chi_Minh',request_key:crypto.randomUUID(),demo:true,...extra});
function ready(e,rid){const t=e.prepare(rid);return e.submit(rid,t.packet.job_id,demoResult(t.packet));}
function approve(e,r,j){return e.review(r.id,j.id,{digest:j.result.digest,approved:true,reviewer:'Owner',note:'Reviewed exact recorded result'});}
function oversized(e,r){
  approve(e,r,ready(e,r.id));
  for(const id of ['script','banner']){const t=e.prepare(r.id);approve(e,r,e.submit(r.id,id,{...demoResult(t.packet),report:'x'.repeat(105000)}));}
  assert.throws(()=>e.prepare(r.id),/Handoff packet exceeds/);
}
test('recovery exposes dispatch while sibling holds remain visible',()=>{const {home,e}=make();try{
  const r=e.create(input());oversized(e,r);e.retry(r.id,'script',{note:'Shorten script'});
  const current=e.snapshot().runs[0];assert.equal(current.status,'hold');assert.equal(current.can_dispatch,true);
}finally{remove(home);}});
test('held dependency cannot be bypassed by retrying the child',()=>{const {home,e}=make();try{
  const r=e.create(input({demo:false}));oversized(e,r);e.retry(r.id,'script',{note:'Shorten script'});approve(e,r,ready(e,r.id));
  assert.throws(()=>e.retry(r.id,'media',{note:'Try child too early'}),/dependencies.*approved/i);
  assert.throws(()=>e.prepare(r.id),/No task is ready/);
}finally{remove(home);}});
test('prepare rechecks parent state even when persisted child incorrectly says ready',()=>{const {home,e}=make();try{
  const r=e.create(input({demo:false}));oversized(e,r);e.retry(r.id,'script',{note:'Shorten script'});approve(e,r,ready(e,r.id));
  e.store.change(s=>{s.runs[0].jobs.find(j=>j.id==='media').state='ready';});
  assert.throws(()=>e.prepare(r.id),/No task is ready/);assert.equal(e.snapshot().runs[0].jobs[3].attempts.length,0);
}finally{remove(home);}});
test('ancestor retry refuses actually executed held descendants',()=>{const {home,e}=make();try{
  const r=e.create(input());approve(e,r,ready(e,r.id));const t=e.prepare(r.id);e.submit(r.id,'script',{...demoResult(t.packet),status:'hold',blockers:['Needs changes']});
  e.store.change(s=>{s.runs[0].jobs[0].state='hold';});
  assert.throws(()=>e.retry(r.id,'brief',{note:'Replace input'}),/dependent task already started/);
}finally{remove(home);}});
test('approval must match the current dependency digest at dispatch',()=>{const {home,e}=make();try{
  const r=e.create(input());approve(e,r,ready(e,r.id));e.store.change(s=>{s.runs[0].jobs[0].review_record.digest='old';});
  assert.throws(()=>e.prepare(r.id),/approval/);assert.equal(e.snapshot().runs[0].jobs[2].state,'hold');
}finally{remove(home);}});
test('transitive handoff binds the dependency version originally reviewed',()=>{const {home,e}=make();try{
  const r=e.create(input());approve(e,r,ready(e,r.id));approve(e,r,ready(e,r.id));approve(e,r,ready(e,r.id));
  const j=e.snapshot().runs[0].jobs[1],file=path.join(home,j.attempts[0].packet),packet=JSON.parse(fs.readFileSync(file));
  packet.dependencies[0].digest='old-approved-version';fs.writeFileSync(file,JSON.stringify(packet));
  assert.throws(()=>e.prepare(r.id),/approval changed since dispatch/);assert.equal(e.snapshot().runs[0].jobs[3].attempts.length,0);
}finally{remove(home);}});
test('HTTP recovery completes both held branches and the full DAG without skipping approval',async()=>{
  const home=temp(),app=await start({home});try{
    const r=app.engine.create(input());oversized(app.engine,r);
    const originals=app.engine.snapshot().runs[0].jobs.filter(j=>['script','banner'].includes(j.id)).map(j=>({file:j.result.file,digest:j.result.digest}));
    const post=async(route,data,status=200)=>{const response=await fetch(app.origin+'/api/'+route,{method:'POST',headers:{'X-Commerce-Token':app.token,'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(response.status,status,await response.clone().text());return response.json();};
    await post('retry',{run:r.id,job:'media',note:'Too early'},400);
    for(const id of ['script','banner','media','handoff']){
      let run=app.engine.snapshot().runs[0],job=run.jobs.find(j=>j.id===id);
      if(job.state==='hold')await post('retry',{run:r.id,job:id,note:'Refresh bounded report'});
      run=app.engine.snapshot().runs[0];assert.equal(run.can_dispatch,true);
      await post('dispatch',{run:r.id});
      for(let i=0;i<50;i++){job=app.engine.snapshot().runs[0].jobs.find(j=>j.id===id);if(job.state==='review')break;await new Promise(resolve=>setTimeout(resolve,20));}
      assert.equal(job.state,'review');
      await post('review',{run:r.id,job:id,digest:job.result.digest,approved:true,reviewer:'Synthetic owner',note:'Exact refreshed draft reviewed'});
    }
    assert.equal(app.engine.snapshot().runs[0].status,'completed');
    for(const old of originals)assert.ok(fs.existsSync(path.join(home,old.file)));
    for(const job of app.engine.snapshot().runs[0].jobs.filter(j=>['script','banner'].includes(j.id))){assert.equal(job.attempts.length,2);assert.ok(job.attempts[0].review_record.approved);assert.ok(job.attempts[0].result.digest);}
  }finally{await app.close();remove(home);}
});
function chunk(name,bytes){const type=Buffer.from(name),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(bytes.length);crc.writeUInt32BE(crc32(Buffer.concat([type,bytes])));return Buffer.concat([len,type,bytes,crc]);}
function png(){const head=Buffer.alloc(13);head.writeUInt32BE(2);head.writeUInt32BE(2,4);head[8]=8;head[9]=6;const raw=Buffer.from([0,255,0,0,255,0,0,0,0,0,0,255,0,255,0,0,0,0]);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}

test('all five workflow DAGs validate and have explicit review gates',()=>{assert.equal(WORKFLOWS.length,5);for(const w of WORKFLOWS){validatePlan(w);assert.ok(w.steps.every(s=>s.review));}});
test('cycle and unknown worker are rejected',()=>{assert.throws(()=>validatePlan({steps:[{id:'a',role:'gtm',after:['b']}]}));assert.throws(()=>validatePlan({steps:[{id:'a',role:'not-real',after:[]}]}));});
test('new workspace defaults to manual; never schedules original routines',()=>{const {home,e}=make();try{assert.equal(e.snapshot().settings.runner,'manual');assert.deepEqual(e.snapshot().runs,[]);assert.ok(!fs.existsSync(path.join(home,'agents')));}finally{remove(home);}});
test('project request idempotency prevents a duplicate double click',()=>{const {home,e}=make();try{const i=input();assert.equal(e.create(i).id,e.create(i).id);assert.equal(e.snapshot().runs.length,1);assert.throws(()=>e.create({...i,title:'Different'}),/reused/);}finally{remove(home);}});
test('mismatched model, currency, scope and timezone fail closed',()=>{const {home,e}=make();try{for(const bad of [{workflow:'pod-launch',model:'dropship'},{currency:'usd'},{store_id:'../../x'},{timezone:'unknown/zone'}])assert.throws(()=>e.create(input(bad)));}finally{remove(home);}});
test('first task dispatch persists a real task packet in a private folder',()=>{const {home,e}=make();try{const r=e.create(input()),t=e.prepare(r.id);assert.equal(t.packet.job_id,'brief');assert.ok(fs.existsSync(path.join(home,'runs',r.id,'brief',t.packet.attempt_id,'request.json')));assert.throws(()=>e.prepare(r.id),/current task/);}finally{remove(home);}});
test('manual dispatch waits for structured result and never spawns a paid tool',()=>{const {home,e}=make();try{const r=e.create(input({demo:false})),t=e.prepare(r.id);assert.equal(t.runner,'manual');assert.equal(e.snapshot().runs[0].jobs[0].state,'awaiting-result');}finally{remove(home);}});
test('duplicate or stale worker result cannot advance workflow',()=>{const {home,e}=make();try{const r=e.create(input()),t=e.prepare(r.id),v=demoResult(t.packet);assert.throws(()=>e.submit(r.id,'brief',{...v,attempt_id:'attempt-old'}),/identity/);e.submit(r.id,'brief',v);assert.throws(()=>e.submit(r.id,'brief',v),/duplicate/);}finally{remove(home);}});
test('result cannot cross project, job, demo or permission boundaries',()=>{const {home,e}=make();try{const r=e.create(input()),t=e.prepare(r.id),v=demoResult(t.packet);for(const patch of [{run_id:'other'},{job_id:'script'},{demo:false},{remote_mutation_allowed:true}])assert.throws(()=>e.submit(r.id,'brief',{...v,...patch}));}finally{remove(home);}});
test('missing evidence is held even when worker claims pass',()=>{const {home,e}=make();try{const r=e.create(input({demo:false})),t=e.prepare(r.id),v=demoResult(t.packet);v.sources=[];const j=e.submit(r.id,'brief',v);assert.equal(j.state,'hold');assert.throws(()=>approve(e,r,j));}finally{remove(home);}});
test('future evidence date is held',()=>{const {home,e}=make();try{const r=e.create(input()),t=e.prepare(r.id),v=demoResult(t.packet);v.sources[0].observed_at='2099-01-01';assert.equal(e.submit(r.id,'brief',v).state,'hold');}finally{remove(home);}});
test('human review is hash-bound and dependencies wait for approval',()=>{const {home,e}=make();try{const r=e.create(input()),j=ready(e,r.id);assert.equal(e.snapshot().runs[0].jobs[1].state,'waiting');assert.throws(()=>e.review(r.id,j.id,{digest:'wrong',approved:true,reviewer:'Owner',note:'checked'}));approve(e,r,j);assert.equal(e.snapshot().runs[0].jobs[1].state,'ready');}finally{remove(home);}});
test('modified result on disk cannot be approved',()=>{const {home,e}=make();try{const r=e.create(input()),j=ready(e,r.id);fs.writeFileSync(path.join(home,j.result.file),'{}');assert.throws(()=>approve(e,r,j),/changed/);}finally{remove(home);}});
test('rejected result retry preserves old artifact and feedback',()=>{const {home,e}=make();try{const r=e.create(input()),j=ready(e,r.id);e.review(r.id,j.id,{digest:j.result.digest,approved:false,reviewer:'Owner',note:'Change angle'});e.retry(r.id,j.id,{note:'Use a different documented angle'});const t=e.prepare(r.id);assert.ok(t.packet.feedback.note.includes('different'));assert.ok(fs.existsSync(path.join(home,j.result.file)));assert.equal(e.snapshot().runs[0].jobs[0].attempts.length,2);}finally{remove(home);}});
test('all three attempts are bounded; no uncontrolled retry loop',()=>{const {home,e}=make();try{const r=e.create(input());for(let n=0;n<3;n++){const t=e.prepare(r.id),v=demoResult(t.packet);v.status='failed';e.submit(r.id,t.packet.job_id,v);if(n<2)e.retry(r.id,'brief',{note:'Explicit retry'});}assert.throws(()=>e.retry(r.id,'brief',{note:'Another'}),/limit/);}finally{remove(home);}});
test('restart marks in-flight job uncertain and requires reconciliation',()=>{const {home,e}=make();try{const r=e.create(input());e.prepare(r.id);const again=new Engine(home,REPO);again.recoverInterrupted();assert.equal(again.snapshot().runs[0].jobs[0].state,'uncertain');assert.throws(()=>again.retry(r.id,'brief',{note:'Try'}),/Reconcile/);again.retry(r.id,'brief',{note:'Previous worker stopped and outputs checked',reconciled:true});assert.equal(again.snapshot().runs[0].jobs[0].state,'ready');}finally{remove(home);}});
test('stale dependency evidence is held and can be refreshed without stranding the child',()=>{const {home,e}=make();try{const r=e.create(input({demo:false}));e.gate=()=>({ok:true});const first=e.prepare(r.id),brief=e.submit(r.id,'brief',demoResult(first.packet));approve(e,r,brief);e.gate=()=>{throw new Error('Evidence became stale since approval');};assert.throws(()=>e.prepare(r.id),/requires fresh evidence/);const held=e.snapshot().runs[0];assert.equal(held.jobs[0].state,'hold');assert.equal(held.jobs[1].state,'hold');assert.match(held.jobs[0].error,/stale/);assert.ok(verifyEvents(e.store.read()));e.gate=()=>({ok:true});assert.equal(e.retry(r.id,'brief',{note:'Refresh the stale evidence'}).state,'ready');}finally{remove(home);}});
test('oversized aggregate handoff holds its dependencies instead of creating a partial dispatch',()=>{const {home,e}=make();try{const r=e.create(input({demo:false}));e.gate=()=>({ok:true});let t=e.prepare(r.id),j=e.submit(r.id,'brief',demoResult(t.packet));approve(e,r,j);t=e.prepare(r.id);j=e.submit(r.id,'script',{...demoResult(t.packet),report:'x'.repeat(105000)});approve(e,r,j);t=e.prepare(r.id);j=e.submit(r.id,'banner',{...demoResult(t.packet),report:'y'.repeat(105000)});approve(e,r,j);assert.throws(()=>e.prepare(r.id),/Handoff packet exceeds/);const held=e.snapshot().runs[0];assert.equal(held.jobs[1].state,'hold');assert.equal(held.jobs[2].state,'hold');assert.equal(held.jobs[3].state,'hold');assert.match(held.jobs[3].error,/shorten dependency reports/);assert.ok(verifyEvents(e.store.read()));assert.equal(e.retry(r.id,'script',{note:'Shorten the dependency report'}).state,'ready');}finally{remove(home);}});
test('pause blocks new work; cancellation preserves results',()=>{const {home,e}=make();try{const r=e.create(input());e.pause(r.id,true);assert.throws(()=>e.prepare(r.id),/paused/);e.pause(r.id,false);const j=ready(e,r.id);e.cancel(r.id);assert.ok(fs.existsSync(path.join(home,j.result.file)));assert.throws(()=>approve(e,r,j),/current result/);}finally{remove(home);}});
test('complete demo follows real transitions and stays synthetic',()=>{const {home,e}=make();try{const r=e.create(input());for(let n=0;n<5;n++){const j=ready(e,r.id);assert.ok(j.result.report.includes('DEMO'));approve(e,r,j);}const result=e.snapshot().runs[0];assert.equal(result.status,'completed');assert.equal(result.demo,true);assert.equal(e.audit().findings.length,0);assert.ok(verifyEvents(e.store.read()));}finally{remove(home);}});
test('observer is read-only including construction',()=>{const {home,e}=make();try{e.create(input());const before=fs.readFileSync(path.join(home,'commerce.json')),names=fs.readdirSync(home);new Engine(home,REPO,{readOnly:true}).audit();assert.deepEqual(fs.readFileSync(path.join(home,'commerce.json')),before);assert.deepEqual(fs.readdirSync(home),names);}finally{remove(home);}});
test('corrupt state is never silently reset',()=>{const {home}=make();try{const f=path.join(home,'commerce.json');fs.writeFileSync(f,'{broken');assert.throws(()=>new Store(home),/DAMAGED/);assert.equal(fs.readFileSync(f,'utf8'),'{broken');}finally{remove(home);}});
test('atomic lock prevents two owners and preserves a foreign token',()=>{const h=temp();try{const a=exclusive(h,'lock');assert.throws(()=>exclusive(h,'lock'),/BUSY/);const f=path.join(h,'lock/owner.json'),j=JSON.parse(fs.readFileSync(f));j.token='foreign';fs.writeFileSync(f,JSON.stringify(j));a.release();assert.ok(fs.existsSync(f));}finally{remove(h);}});
test('workspace cannot be source repo or cloud-sync location',()=>{assert.throws(()=>chooseHome(REPO,path.join(REPO,'business-data')));assert.throws(()=>chooseHome(REPO,path.join(os.tmpdir(),'OneDrive','live-state')));});
test('per-role routing cannot bypass cost acknowledgment',()=>{const {home,e}=make();try{assert.throws(()=>e.settings({runner:'manual',role_runners:{creative:'external'},timeout_seconds:60}),/Confirm/);assert.throws(()=>e.settings({runner:'manual',role_runners:{bad:'manual'},timeout_seconds:60}));}finally{remove(home);}});
test('uploaded assets are scoped, hashed and cannot traverse',()=>{const {home,e}=make();try{const r=e.create(input()),a=e.upload(r.id,{name:'product.png',base64:png().toString('base64')}),current=e.store.read().runs[0];assert.equal(e.asset(current,a.id).a.sha256,hash(png()));assert.throws(()=>e.upload(r.id,{name:'../product.png',base64:'AA=='}));assert.throws(()=>e.asset({...current,assets:[]},a.id));fs.writeFileSync(path.join(home,a.relative),'tampered');assert.throws(()=>e.asset(current,a.id),/changed/);}finally{remove(home);}});
test('margin is computed rather than accepted from worker claims',()=>{const {home,e}=make();try{const r=e.create(input({demo:false})),c=JSON.parse(fs.readFileSync(path.join(REPO,'profiles/pod-ecommerce/examples/costs.example.json'),'utf8')),v=e.gate(r,{gate:'economics'},{costs:c});assert.ok(Number.isInteger(v.break_even_cpa_minor));assert.throws(()=>e.gate(r,{gate:'economics'},{costs:{currency:'USD',passed:true}}));assert.throws(()=>e.gate(r,{gate:'economics'},{costs:{...c,currency:'AUD'}}));}finally{remove(home);}});
test('print gate uses real bytes and requires supplier specification',()=>{const {home,e}=make();try{const r=e.create(input({demo:false})),a=e.upload(r.id,{name:'master.png',base64:png().toString('base64')}),current=e.store.read().runs[0];assert.throws(()=>e.gate(current,{gate:'print'},{asset_id:a.id,spec:{passed:true}}));assert.throws(()=>e.gate(current,{gate:'print'},{asset_id:'not-owned',spec:{}}));}finally{remove(home);}});
test('supplier and media gates reject declared pass without evidence',()=>{const {home,e}=make();try{const r=e.create(input({demo:false,model:'dropship'}));assert.throws(()=>e.gate(r,{gate:'supplier'},{dossier:{passed:true}}));assert.throws(()=>e.gate(r,{gate:'media'},{passed:true}));}finally{remove(home);}});
test('worker JSON is one object; Claude envelope parsed explicitly',()=>{const v={schema:'commerce-result/1'};assert.deepEqual(decodeOutput(JSON.stringify(v)),v);assert.deepEqual(decodeOutput(JSON.stringify({result:JSON.stringify(v)}),'claude'),v);assert.throws(()=>decodeOutput('```json\n{}\n```'));assert.throws(()=>decodeOutput(JSON.stringify({is_error:true,result:'{}'}),'claude'));});
test('unsupported Windows batch shim is refused, not sent to a shell',()=>{assert.throws(()=>claudeCommand('C:\\missing\\claude.cmd'),/shim/);assert.throws(()=>claudeCommand('C:\\missing\\claude.bat'),/Batch/);});
test('Codex JSONL keeps only the final agent message and fails on turn errors',()=>{const v={schema:'commerce-result/1'},line=x=>JSON.stringify(x),ok=[line({type:'thread.started'}),line({type:'item.completed',item:{type:'error',message:'metadata warning'}}),line({type:'item.completed',item:{type:'agent_message',text:'draft'}}),line({type:'item.completed',item:{type:'agent_message',text:JSON.stringify(v)}}),line({type:'turn.completed'})].join('\n');assert.deepEqual(decodeOutput(ok,'codex'),v);assert.throws(()=>decodeOutput(line({type:'turn.failed',error:{message:'quota'}}),'codex'));assert.throws(()=>decodeOutput(line({type:'turn.completed'}),'codex'),/no final/);assert.throws(()=>decodeOutput(line({type:'item.completed',item:{type:'agent_message',text:'```json\n{}\n```'}}),'codex'));});
test('Codex runs read only, ephemeral and with every tool feature disabled',()=>{assert.throws(()=>codexCommand(null),/CODEX_UNAVAILABLE/);assert.throws(()=>codexCommand('C:\\missing\\codex.cmd'),/shim/);assert.throws(()=>codexCommand('C:\\missing\\codex.bat'),/Batch/);const h=temp();try{fs.writeFileSync(path.join(h,'codex'),'#!/bin/sh\n',{mode:0o755});const old=process.env.PATH;process.env.PATH=h;try{const s=runnerSpec('codex',h);assert.equal(s.format,'codex');assert.equal(s.stdin,'prompt');const a=s.args;assert.equal(a[0],'exec');assert.equal(a.at(-1),'-');assert.equal(a[a.indexOf('--sandbox')+1],'read-only');for(const f of ['--ephemeral','--ignore-user-config','--ignore-rules','--json'])assert.ok(a.includes(f),f);for(const f of CODEX_DISABLED_FEATURES)assert.ok(a.some((x,i)=>x==='--disable'&&a[i+1]===f),f);assert.ok(!a.some(x=>/dangerously|full-access|approve-for-me/.test(x)));}finally{process.env.PATH=old;}}finally{remove(h);}});
test('external runner requires a trusted local configuration',()=>{const {home}=make();try{assert.throws(()=>runnerSpec('external',home));fs.writeFileSync(path.join(home,'runner.json'),JSON.stringify({schema:'commerce-runner/1',command:'node',args:[],stdin:'packet',acknowledge_external_permissions:true}));assert.throws(()=>runnerSpec('external',home));}finally{remove(home);}});
test('real process receives Unicode and spaces without shell expansion',async()=>{const h=temp();try{const script=path.join(h,'worker space.mjs');fs.writeFileSync(script,"import fs from 'node:fs';const j=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify({seen:j.brief}));");const brief='quote \" and spaces & $(no-shell) '+String.fromCodePoint(0x1ec7),v=await execute({command:process.execPath,args:[script],stdin:'packet',format:'protocol'},{brief},'',h,5);assert.equal(v.seen,brief);}finally{remove(h);}});
test('zero exit without valid result is a failure',async()=>{const h=temp();try{await assert.rejects(execute({command:process.execPath,args:['-e','process.exit(0)'],stdin:'packet',format:'protocol'},{},'',h,5),/invalid JSON/);}finally{remove(h);}});
test('timeout stops worker and requests reconciliation',async()=>{const h=temp();try{await assert.rejects(execute({command:process.execPath,args:['-e','setInterval(()=>{},1000)'],stdin:'packet',format:'protocol'},{},'',h,0.2),/time limit/);}finally{remove(h);}});
test('recovery refuses live owner and never resets projects',()=>{const {home,e}=make();try{e.create(input());const l=exclusive(home,'.server.lock'),bytes=fs.readFileSync(path.join(home,'commerce.json'));assert.throws(()=>recover(home),/workers-stopped/);assert.throws(()=>recover(home,{acknowledge:true}),/alive/);assert.deepEqual(fs.readFileSync(path.join(home,'commerce.json')),bytes);l.release();}finally{remove(home);}});
test('second server cannot open same workspace',async()=>{const h=temp(),app=await start({home:h});try{await assert.rejects(start({home:h}),/BUSY/);}finally{await app.close();remove(h);}});
test('local API enforces token, origin and narrow file reads',async()=>{const h=temp(),app=await start({home:h});try{assert.equal((await fetch(app.origin+'/api/state')).status,401);assert.equal((await fetch(app.origin+'/api/state',{headers:{'X-Commerce-Token':app.token,Origin:'https://evil.example'}})).status,403);assert.equal((await fetch(app.origin+'/api/state',{headers:{'X-Commerce-Token':app.token}})).status,200);const page=await fetch(app.origin+'/');assert.ok(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));assert.ok((await page.text()).includes('Ecom Agents Commerce'));assert.equal((await fetch(app.origin+'/api/file?run=../../secret&job=a&kind=packet',{headers:{'X-Commerce-Token':app.token}})).status,400);}finally{await app.close();remove(h);}});
test('HTTP demo dispatch reaches review and approval releases the next step',async()=>{const h=temp(),app=await start({home:h});try{const headers={'X-Commerce-Token':app.token,'Content-Type':'application/json'},post=async(url,b)=>{const v=await fetch(app.origin+'/api/'+url,{method:'POST',headers,body:JSON.stringify(b)});assert.equal(v.status,200,await v.clone().text());return v.json();};const r=await post('create',input());await post('dispatch',{run:r.id});let s;for(let i=0;i<50;i++){s=app.engine.snapshot();if(s.runs[0].jobs[0].state==='review')break;await new Promise(r=>setTimeout(r,20));}assert.equal(s.runs[0].jobs[0].state,'review');const j=s.runs[0].jobs[0];await post('review',{run:r.id,job:j.id,digest:j.result.digest,approved:true,reviewer:'Owner',note:'Demo checked'});assert.equal(app.engine.snapshot().runs[0].jobs[1].state,'ready');}finally{await app.close();remove(h);}});
test('standalone observer does not create missing workspace',()=>{const parent=temp(),home=path.join(parent,'does not exist');try{const r=spawnSync(process.execPath,[path.join(REPO,'app/commerce/observer.mjs'),'--home',home],{encoding:'utf8'});assert.notEqual(r.status,0);assert.ok(!fs.existsSync(home));}finally{remove(parent);}});
test('dispatch never runs a task under a spec resolved for another role',async()=>{const h=temp(),app=await start({home:h});try{const headers={'X-Commerce-Token':app.token,'Content-Type':'application/json'},post=async(u,b)=>fetch(app.origin+'/api/'+u,{method:'POST',headers,body:JSON.stringify(b)});const r=await(await post('create',input({demo:false}))).json();
    // Simulated drift: a satisfied job waits ahead of a ready job, so advance()
    // inside prepare() promotes a different job than the dispatch pre-scan did.
    app.engine.store.change(s=>{const run=s.runs.find(x=>x.id===r.id);run.jobs[0].state='waiting';run.jobs[1].state='ready';});
    await post('settings',{runner:'manual',role_runners:{ads:'claude'},timeout_seconds:60,cost_acknowledged:true});
    const v=await post('dispatch',{run:r.id}),body=await v.json();assert.notEqual(v.status,200);assert.match(body.error,/Runner resolution/);
    const j=app.engine.snapshot().runs[0].jobs[0];assert.equal(j.state,'uncertain');assert.equal(j.attempts.at(-1).state,'uncertain');
    assert.equal((await post('retry',{run:r.id,job:'brief',note:'Nothing ran; outputs checked',reconciled:true})).status,200);assert.equal(app.engine.snapshot().runs[0].jobs[0].state,'ready');}finally{await app.close();remove(h);}});
test('runner drift is also caught for a manual claimed task',async()=>{const h=temp(),app=await start({home:h});try{const headers={'X-Commerce-Token':app.token,'Content-Type':'application/json'},post=async(u,b)=>fetch(app.origin+'/api/'+u,{method:'POST',headers,body:JSON.stringify(b)});const r=await(await post('create',input({demo:false}))).json();
    fs.writeFileSync(path.join(h,'runner.json'),JSON.stringify({schema:'commerce-runner/1',command:process.execPath,args:[],stdin:'packet',acknowledge_external_permissions:true}));
    app.engine.store.change(s=>{const run=s.runs.find(x=>x.id===r.id);run.jobs[0].state='waiting';run.jobs[1].state='ready';});
    await post('settings',{runner:'manual',role_runners:{creative:'external'},timeout_seconds:60,cost_acknowledged:true});
    const v=await post('dispatch',{run:r.id});assert.notEqual(v.status,200);
    const j=app.engine.snapshot().runs[0].jobs[0];assert.equal(j.state,'uncertain');assert.equal(j.attempts.at(-1).state,'uncertain');}finally{await app.close();remove(h);}});
