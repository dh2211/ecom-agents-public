import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {Engine,demoResult} from '../../app/commerce/engine.mjs';
import {REPO,start} from '../../app/commerce/server.mjs';
import {crc32,inspectPng} from '../../scripts/pod/print-qa.mjs';
const setup=()=>{const home=fs.mkdtempSync(path.join(os.tmpdir(),'commerce-review-'));return {home,e:new Engine(home,REPO)};};
const request={workflow:'creative-batch',model:'pod',title:'Review',brief:'Provided source evidence for a product; no private customer details.',store_id:'store-demo',currency:'USD',market:'US',timezone:'Asia/Ho_Chi_Minh',request_key:'review-request-1',demo:true};
test('conditional state polling skips unchanged payload but preserves authorization and integrity checks',async()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'commerce-poll-')),app=await start({home});
 try {
  const headers={'X-Commerce-Token':app.token},get=extra=>fetch(app.origin+'/api/state',{headers:{...headers,...extra}});
  const first=await get();assert.equal(first.status,200);const tag=first.headers.get('etag');assert.ok(tag);const state=await first.json();
  const same=await get({'If-None-Match':tag});assert.equal(same.status,304);assert.equal(await same.text(),'');
  assert.equal((await fetch(app.origin+'/api/state',{headers:{'If-None-Match':tag}})).status,401);
  assert.equal((await get({'If-None-Match':tag,Origin:'https://foreign.example'})).status,403);
  app.engine.create(request);
  const changed=await get({'If-None-Match':tag});assert.equal(changed.status,200);assert.notEqual(changed.headers.get('etag'),tag);assert.ok((await changed.json()).revision>state.revision);
  const nextTag=changed.headers.get('etag');
  fs.writeFileSync(path.join(home,'runner.json'),JSON.stringify({schema:'commerce-runner/1',command:process.execPath,args:[],stdin:'packet',acknowledge_external_permissions:true}));
  const runnerChanged=await get({'If-None-Match':nextTag});assert.equal(runnerChanged.status,200);assert.equal((await runnerChanged.json()).capabilities.external,true);
  const lastTag=runnerChanged.headers.get('etag');assert.equal((await get({'If-None-Match':lastTag})).status,304);
  assert.equal((await get()).status,200,'Existing clients without a validator retain full responses');
  fs.writeFileSync(path.join(home,'commerce.json'),'{broken');
  const corrupt=await get({'If-None-Match':lastTag});assert.equal(corrupt.status,400);assert.match((await corrupt.json()).error,/DAMAGED/);
 }finally{await app.close();fs.rmSync(home,{recursive:true,force:true});}
});
test('expired gate cannot be approved but can be rejected for a fresh attempt',()=>{const {home,e}=setup();try{
  const r=e.create(request),p=e.prepare(r.id),j=e.submit(r.id,p.packet.job_id,demoResult(p.packet));
  e.gate=()=>{throw new Error('Evidence became stale since submission');};
  const review={digest:j.result.digest,reviewer:'Owner',note:'Source must be refreshed'};
  assert.throws(()=>e.review(r.id,j.id,{...review,approved:true}),/stale/);
  assert.equal(e.review(r.id,j.id,{...review,approved:false}).state,'hold');
  assert.equal(e.retry(r.id,j.id,{note:'Refresh source before retry'}).state,'ready');
}finally{fs.rmSync(home,{recursive:true,force:true});}});

test('HTTP upload accepts a real PNG above 5 MiB without overflowing validation',async()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'commerce-upload-')),app=await start({home});
 try {
  const head=Buffer.alloc(13);head.writeUInt32BE(1200);head.writeUInt32BE(1200,4);head[8]=8;head[9]=6;
  const raw=Buffer.alloc(4801*1200);for(let y=0;y<1200;y++)crypto.randomFillSync(raw,y*4801+1,4800);
  const chunk=(type,data)=>{const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(type,4);data.copy(out,8);out.writeUInt32BE(crc32(out.subarray(4,-4)),out.length-4);return out;};
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
  assert.ok(png.length>5*1024*1024);assert.equal(inspectPng(png).width,1200);
  const r=app.engine.create(request),res=await fetch(app.origin+'/api/upload',{method:'POST',headers:{'X-Commerce-Token':app.token,'Content-Type':'application/json'},body:JSON.stringify({run:r.id,name:'synthetic.png',base64:png.toString('base64')})});
  assert.equal(res.status,200,await res.clone().text());const a=await res.json();assert.equal(a.bytes,png.length);
  assert.deepEqual(fs.readFileSync(path.join(home,a.relative)),png);
 }finally{await app.close();fs.rmSync(home,{recursive:true,force:true});}
});
test('upload accepts the 50 MiB limit and rejects oversized or noncanonical Base64',()=>{const {home,e}=setup();try{
 const r=e.create(request),bytes=Buffer.alloc(50*1024*1024);
 assert.equal(e.upload(r.id,{name:'limit.mp4',base64:bytes.toString('base64')}).bytes,bytes.length);
 assert.throws(()=>e.upload(r.id,{name:'too-big.mp4',base64:Buffer.alloc(bytes.length+1).toString('base64')}),/50 MiB/);
 for(const base64 of ['', 'AA', 'AA=', 'AAA==', '=AAA', 'AAAA\n', 'AAA_', 'AB==', 'AAB='])assert.throws(()=>e.upload(r.id,{name:'bad.png',base64}),/encoding|1 byte/);
 for(const base64 of ['AA==','AAA=','AAAA'])assert.ok(e.upload(r.id,{name:'valid.png',base64}).id);
}finally{fs.rmSync(home,{recursive:true,force:true});}});

function pendingHandoff(e){
 const r=e.create({...request,workflow:'customer-feedback',demo:false});
 let last;
 for(let n=0;n<4;n++){
  const p=e.prepare(r.id);last=e.submit(r.id,p.packet.job_id,demoResult(p.packet));
  if(n<3)e.review(r.id,last.id,{digest:last.result.digest,approved:true,reviewer:'Fixture reviewer',note:'Synthetic evidence checked'});
 }
 return {r,last,approval:{digest:last.result.digest,approved:true,reviewer:'Fixture reviewer',note:'Synthetic final handoff checked'}};
}
for(const drift of ['artifact','approval','packet'])test('final approval refuses transitive dependency '+drift+' drift',()=>{const {home,e}=setup();try{
 const {r,last,approval}=pendingHandoff(e),current=e.snapshot().runs[0];
 if(drift==='artifact')fs.writeFileSync(path.join(home,current.jobs[0].result.file),'{}');
 if(drift==='approval')e.store.change(s=>{s.runs[0].jobs[0].review_record.digest='old';});
 if(drift==='packet'){
  const file=path.join(home,last.attempts.at(-1).packet),packet=JSON.parse(fs.readFileSync(file));packet.dependencies[0].digest='other-version';fs.writeFileSync(file,JSON.stringify(packet));
 }
 assert.throws(()=>e.review(r.id,last.id,approval),/changed|approval/);
 assert.equal(e.snapshot().runs[0].jobs.at(-1).state,'review');
 assert.equal(e.review(r.id,last.id,{...approval,approved:false}).state,'hold');
}finally{fs.rmSync(home,{recursive:true,force:true});}});
test('fresh transitive evidence permits final approval',()=>{const {home,e}=setup();try{
 const {r,last,approval}=pendingHandoff(e);e.review(r.id,last.id,approval);assert.equal(e.snapshot().runs[0].status,'completed');
}finally{fs.rmSync(home,{recursive:true,force:true});}});
test('final Dropship approval rejects supplier evidence that expired while awaiting review',t=>{const {home,e}=setup();try{
 const now=new Date();t.mock.timers.enable({apis:['Date'],now});
 const r=e.create({...request,workflow:'dropship-launch',model:'dropship',demo:false});
 const observed_at=new Date().toISOString(),evidence={variant_id:'fixture-variant',supplier_id:'fixture-supplier',source_ref:'synthetic-test-only',observed_at};
 const review={...evidence,status:'approved',market:'US',reviewer:'Fixture reviewer'};
 const costs={currency:'USD',basis:'planning',merchandise_revenue_minor:4000,shipping_revenue_minor:0,customer_paid_minor:4000,supplier_cost_minor:1000,supplier_shipping_minor:200,merchant_duties_minor:0,other_variable_minor:0,payment_fixed_minor:0,payment_rate_bps:0,expected_refund_loss_minor:0,expected_replacement_loss_minor:0,ad_cost_minor:100,target_contribution_minor:100};
 const dossier={schema:'dropship-product/1',store_id:r.store_id,product_id:'fixture-product',variant_id:evidence.variant_id,supplier_id:evidence.supplier_id,market:r.market,currency:r.currency,
  stock:{...evidence,available:true},quote:{...evidence,currency:r.currency,unit_cost_minor:1000},
  shipping:{...evidence,market:r.market,day_basis:'calendar',origin_country:'VN',handling_min_days:1,handling_max_days:2,transit_min_days:1,transit_max_days:2,cost_minor:200,duties_disclosure:'Synthetic fixture only'},
  sample_review:{...review},safety_review:{...review},returns_review:{...review},costs};
 let last;
 for(let n=0;n<6;n++){
  const p=e.prepare(r.id),result=demoResult(p.packet);result.data=p.packet.gate==='supplier'?{dossier}:p.packet.gate==='economics'?{costs}:{};
  last=e.submit(r.id,p.packet.job_id,result);assert.equal(last.state,'review');
  if(n<5)e.review(r.id,last.id,{digest:last.result.digest,approved:true,reviewer:'Fixture reviewer',note:'Synthetic source checked'});
 }
 t.mock.timers.tick(48*3600000);
 const approval={digest:last.result.digest,approved:true,reviewer:'Fixture reviewer',note:'Final review after delay'};
 assert.throws(()=>e.review(r.id,last.id,approval),/stale/);
 assert.notEqual(e.snapshot().runs[0].status,'completed');
 assert.equal(e.review(r.id,last.id,{...approval,approved:false}).state,'hold');
}finally{fs.rmSync(home,{recursive:true,force:true});}});
test('expired supplier evidence after a later approval leaves the approved chain unchanged',t=>{const {home,e}=setup();try{
 const now=new Date();t.mock.timers.enable({apis:['Date'],now});
 const r=e.create({...request,workflow:'dropship-launch',model:'dropship',demo:false,request_key:'stale-ancestor'});
 const observed_at=new Date().toISOString(),evidence={variant_id:'fixture-variant',supplier_id:'fixture-supplier',source_ref:'synthetic-test-only',observed_at};
 const review={...evidence,status:'approved',market:'US',reviewer:'Fixture reviewer'};
 const costs={currency:'USD',basis:'planning',merchandise_revenue_minor:4000,shipping_revenue_minor:0,customer_paid_minor:4000,supplier_cost_minor:1000,supplier_shipping_minor:200,merchant_duties_minor:0,other_variable_minor:0,payment_fixed_minor:0,payment_rate_bps:0,expected_refund_loss_minor:0,expected_replacement_loss_minor:0,ad_cost_minor:100,target_contribution_minor:100};
 const dossier={schema:'dropship-product/1',store_id:r.store_id,product_id:'fixture-product',variant_id:evidence.variant_id,supplier_id:evidence.supplier_id,market:r.market,currency:r.currency,
  stock:{...evidence,available:true},quote:{...evidence,currency:r.currency,unit_cost_minor:1000},
  shipping:{...evidence,market:r.market,day_basis:'calendar',origin_country:'VN',handling_min_days:1,handling_max_days:2,transit_min_days:1,transit_max_days:2,cost_minor:200,duties_disclosure:'Synthetic fixture only'},
  sample_review:{...review},safety_review:{...review},returns_review:{...review},costs};
 for(let n=0;n<3;n++){
  const p=e.prepare(r.id),result=demoResult(p.packet);result.data=p.packet.gate==='supplier'?{dossier}:p.packet.gate==='economics'?{costs}:{};
  const job=e.submit(r.id,p.packet.job_id,result);assert.equal(job.state,'review');
  e.review(r.id,job.id,{digest:job.result.digest,approved:true,reviewer:'Fixture reviewer',note:'Synthetic source checked'});
 }
 t.mock.timers.tick(48*3600*1000);
 assert.throws(()=>e.prepare(r.id),/revised/);
 const jobs=Object.fromEntries(e.snapshot().runs[0].jobs.map(j=>[j.id,j.state]));
 assert.equal(jobs.supplier,'succeeded');assert.equal(jobs.economics,'succeeded');assert.equal(jobs.listing,'ready');
 assert.throws(()=>e.retry(r.id,'supplier',{note:'Refresh the supplier evidence'}),/Only held/);
}finally{fs.rmSync(home,{recursive:true,force:true});}});
test('licensed voice and music sources may be uploaded without weakening final media gates',()=>{const {home,e}=setup();try{
  const r=e.create(request);
  for(const name of ['voice.wav','music.mp3','narration.m4a'])assert.ok(e.upload(r.id,{name,base64:Buffer.from('fixture-not-real-audio').toString('base64')}).sha256);
  assert.throws(()=>e.upload(r.id,{name:'worker.exe',base64:'AA=='}));
  assert.throws(()=>e.gate({...r,demo:false},{gate:'media'},{asset_ids:[],media_brief:{}}));
}finally{fs.rmSync(home,{recursive:true,force:true});}});
