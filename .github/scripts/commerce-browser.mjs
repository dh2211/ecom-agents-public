// CI browser smoke test. No AI, customer data or business API is used.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {start} from '../../app/commerce/server.mjs';
import {demoResult} from '../../app/commerce/engine.mjs';
const require=createRequire(process.env.COMMERCE_PLAYWRIGHT_PACKAGE||path.join(process.env.RUNNER_TEMP||os.tmpdir(),'commerce-browser','package.json'));
const {chromium}=require('playwright');
const home=fs.mkdtempSync(path.join(os.tmpdir(),'commerce-browser-'));
const shots=path.join(process.env.RUNNER_TEMP||os.tmpdir(),'commerce-screenshots');
fs.mkdirSync(shots,{recursive:true});
const app=await start({home});let browser;
async function draftRegressions(page) {
  const create=(title,key)=>app.engine.create({workflow:'creative-batch',model:'pod',title,brief:'Synthetic browser draft regression only.',store_id:'draft-test',currency:'USD',market:'US',timezone:'UTC',request_key:key,demo:false});
  const first=create('Draft project one','draft-one'),second=create('Draft project two','draft-two');
  const firstTask=app.engine.prepare(first.id);app.engine.prepare(second.id);
  await page.reload();
  const select=title=>page.getByRole('button',{name:new RegExp(title)}).click();
  const result=page.getByRole('textbox',{name:'Kết quả từ trợ lý'});
  await select(first.title);
  const rejected='{"schema":"wrong","report":"Keep this JSON so the owner can correct it"}';
  await result.fill(rejected);
  await page.getByRole('button',{name:'Kiểm tra và nhận kết quả'}).click();
  await page.locator('#error:not(.hidden)').waitFor();
  assert.equal(await result.inputValue(),rejected,'Rejected result JSON must survive the error refresh');
  await select(second.title);await result.fill('A separate project draft');
  await select(first.title);assert.equal(await result.inputValue(),rejected,'Switching projects must retain each draft');
  app.engine.pause(second.id,true);
  await page.evaluate(()=>refresh());
  assert.equal(await result.inputValue(),rejected,'Unrelated revision must retain result draft');
  await result.fill(JSON.stringify(demoResult(firstTask.packet)));
  await page.getByRole('button',{name:'Kiểm tra và nhận kết quả'}).click();
  await page.locator('#detail .step .badge.review').waitFor();
  const reviewer=page.getByRole('textbox',{name:'Tên người duyệt'}),note=page.getByRole('textbox',{name:'Ghi chú duyệt'});
  await page.getByText('Duyệt hoặc yêu cầu sửa',{exact:true}).click();
  await reviewer.fill('Draft reviewer');await note.fill('Review note must survive redraws.');
  // A real validation failure leaves the review available for correction.
  await reviewer.fill('x'.repeat(101));
  await page.getByRole('button',{name:'Đã kiểm tra, duyệt bước này'}).click();
  await page.waitForFunction(()=>document.querySelector('#error').textContent.includes('Reviewer'));
  assert.equal(await reviewer.inputValue(),'x'.repeat(101),'Rejected reviewer must remain editable');
  assert.equal(await note.inputValue(),'Review note must survive redraws.');
  await reviewer.fill('Draft reviewer');
  await select(second.title);assert.equal(await result.inputValue(),'A separate project draft','Successful submission must not clear another project');
  await select(first.title);
  assert.equal(await reviewer.inputValue(),'Draft reviewer');assert.equal(await note.inputValue(),'Review note must survive redraws.');
  app.engine.pause(second.id,false);await page.evaluate(()=>refresh());
  assert.equal(await note.inputValue(),'Review note must survive redraws.','Unrelated revision must retain review note');
  await page.getByRole('button',{name:'Yêu cầu sửa',exact:true}).click();
  await page.locator('#detail .step .badge.hold').waitFor();
  app.engine.retry(first.id,'brief',{note:'Synthetic retry checks attempt isolation'});
  const retry=app.engine.prepare(first.id);await page.evaluate(()=>refresh());
  assert.equal(await result.inputValue(),'','New attempt must not inherit previous result draft');
  await result.fill(JSON.stringify(demoResult(retry.packet)));await page.getByRole('button',{name:'Kiểm tra và nhận kết quả'}).click();
  await page.locator('#detail .step .badge.review').waitFor();
  await page.getByText('Duyệt hoặc yêu cầu sửa',{exact:true}).click();
  assert.equal(await note.inputValue(),'','New attempt must not inherit review note');
  assert.equal(await reviewer.inputValue(),'','New attempt must not inherit reviewer');
  assert.equal(await page.evaluate(()=>localStorage.getItem('commerce-reviewer')),null,'Reviewer drafts must not be persisted');
  assert.notEqual(firstTask.packet.attempt_id,retry.packet.attempt_id);
  // The other project's unsent draft still exists when another tab reconciles it.
  app.engine.interrupt(second.id,'brief','Synthetic external interruption');
  app.engine.retry(second.id,'brief',{note:'Reconciled synthetic attempt',reconciled:true});
  app.engine.prepare(second.id);await page.evaluate(()=>refresh());await select(second.title);
  assert.equal(await result.inputValue(),'','An unsent draft from an interrupted attempt must not leak into its retry');
  await select(first.title);
  await page.getByText('Duyệt hoặc yêu cầu sửa',{exact:true}).click();
  return second.id;
}
async function pollingRegressions(page,otherRun) {
  await page.locator('#settings > summary').click();
  const timeout=page.locator('#settings-form input[type=number]');
  await timeout.fill('77');await page.evaluate(()=>refresh());
  assert.equal(await timeout.inputValue(),'77','Unchanged polling must preserve unsaved settings');
  const external=page.locator('#settings-form select').first().locator('option[value=external]');
  assert.equal(await external.evaluate(option=>option.disabled),true);
  const runnerConfig=path.join(home,'runner.json');
  fs.writeFileSync(runnerConfig,JSON.stringify({schema:'commerce-runner/1',command:process.execPath,args:[],stdin:'packet',acknowledge_external_permissions:true}));
  try {
    await page.evaluate(()=>refresh());
    assert.equal(await external.evaluate(option=>option.disabled),false,'Capability changes must update runner options without a ledger revision');
  } finally {fs.unlinkSync(runnerConfig);await page.evaluate(()=>refresh());}
  const unchanged=page.waitForResponse(response=>response.url().endsWith('/api/state'));
  await page.evaluate(()=>refresh());
  const response=await unchanged;
  assert.ok(response.request().headers()['if-none-match'],'State polling must send the cached ETag');
  assert.equal(response.status(),304,'Unchanged state should transfer no JSON body');
  const reviewer=page.getByRole('textbox',{name:'Tên người duyệt'});
  await reviewer.fill('Conditional refresh draft');
  await page.evaluate(()=>refresh(true));
  assert.equal(await reviewer.inputValue(),'Conditional refresh draft','Forced 304 redraw must preserve drafts');
  let releaseFirst,capturedFirst,active=0,maxActive=0,requests=0;
  const blocked=new Promise(resolve=>releaseFirst=resolve),captured=new Promise(resolve=>capturedFirst=resolve);
  await page.route('**/api/state',async route=>{
    active++;maxActive=Math.max(maxActive,active);const current=++requests;
    const result=await route.fetch();
    if(current===1){capturedFirst();await blocked;}
    await route.fulfill({response:result});active--;
  });
  try {
    await page.evaluate(()=>{window.testPoll=Promise.all([refresh(),refresh(),refresh()]);});
    await captured;
    app.engine.pause(otherRun,true);
    await page.evaluate(()=>{window.testForcedRefresh=refresh(true);});
    releaseFirst();
    await page.evaluate(()=>Promise.all([window.testPoll,window.testForcedRefresh]));
    assert.equal(maxActive,1,'State requests must never overlap');
    assert.equal(requests,2,'Concurrent polls coalesce, then the action queues one fresh read');
    assert.equal(await page.evaluate(id=>state.runs.find(run=>run.id===id).paused,otherRun),true,'Queued refresh must observe changes after the first response was captured');
    assert.equal(await reviewer.inputValue(),'Conditional refresh draft');
  } finally {
    releaseFirst();await page.unroute('**/api/state');
    await page.evaluate(()=>{delete window.testPoll;delete window.testForcedRefresh;});
  }
}
try {
  browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1440,height:1050}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(app.link);
  await page.waitForSelector('#workflow option',{state:'attached'});
  assert.equal(await page.locator('#error:not(.hidden)').count(),0);
  await page.click('#demo');
  for(let n=1;n<=5;n++){
    await page.waitForSelector('#detail .badge.review');
    const step=page.locator('#detail .step').filter({has:page.locator('.badge.review')});
    const form=step.locator('details').last();
    await form.locator('summary').click();
    await form.locator('input').fill('Demo reviewer');
    await form.locator('textarea').fill('Synthetic demo checked; not a business advertisement.');
    await form.locator('button.primary').click();
    await page.waitForFunction(count=>document.querySelectorAll('#detail .badge.succeeded').length===count,n);
  }
  await page.waitForSelector('#detail > .badge.completed');
  // Seed an oversized synthetic handoff, then recover every branch through UI.
  const recovery=app.engine.create({workflow:'creative-batch',model:'pod',title:'Recovery regression',brief:'Synthetic bounded reports only',store_id:'demo-recovery',currency:'USD',market:'US',timezone:'UTC',request_key:'browser-recovery',demo:true});
  for(const id of ['brief','script','banner']){
    const task=app.engine.prepare(recovery.id),result=demoResult(task.packet);
    if(id!=='brief')result.report='x'.repeat(105000);
    const job=app.engine.submit(recovery.id,id,result);
    app.engine.review(recovery.id,id,{digest:job.result.digest,approved:true,reviewer:'Synthetic reviewer',note:'Oversized fixture for recovery'});
  }
  assert.throws(()=>app.engine.prepare(recovery.id),/Handoff packet exceeds/);
  await page.reload();
  await page.getByRole('button',{name:/Recovery regression/}).click();
  page.on('dialog',dialog=>dialog.accept('Shorten and verify synthetic report'));
  for(const title of ['Kịch bản UGC','Concept banner','Kiểm tra file xuất thật','Bộ thử nghiệm creative']){
    const step=page.locator('#detail .step').filter({has:page.getByRole('heading',{name:new RegExp(title)})});
    const retry=step.getByRole('button',{name:'Bổ sung và thử lại'});
    if(await retry.count())await retry.click();
    await page.getByRole('button',{name:'Giao bước tiếp theo'}).click();
    await step.locator('.badge.review').waitFor();
    const form=step.locator('details').last();await form.locator('summary').click();
    await form.locator('input').fill('Recovery reviewer');await form.locator('textarea').fill('Reviewed exact refreshed synthetic artifact');
    await form.getByRole('button',{name:'Đã kiểm tra, duyệt bước này'}).click();
    await step.locator('.badge.succeeded').waitFor();
  }
  await page.waitForSelector('#detail > .badge.completed');
  assert.equal(app.engine.snapshot().runs.find(r=>r.id===recovery.id).status,'completed');
  await page.click('#audit');
  await page.waitForFunction(()=>document.querySelector('#audit-output').textContent.length>20);
  await page.screenshot({path:path.join(shots,'desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'App horizontal overflow');
  await page.screenshot({path:path.join(shots,'mobile.png'),fullPage:true});
  const otherRun=await draftRegressions(page);
  await pollingRegressions(page,otherRun);
  await page.goto(app.origin+'/guide');
  await page.waitForSelector('#search');
  await page.locator('#search').fill('POD');
  assert.ok((await page.locator('main section:not(.hidden)').count())>0);
  await page.locator('#search').fill('');
  await page.setViewportSize({width:1440,height:1050});
  await page.screenshot({path:path.join(shots,'guide.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  assert.equal(app.engine.snapshot().runs[0].status,'completed');
  assert.equal(app.engine.snapshot().runs[0].demo,true);
  console.log('Browser smoke: PASS (dispatch, reviews, handoff recovery, draft preservation, attempt isolation, conditional serialized polling, completion, observer, mobile layout, guide)');
} finally {
  if(browser)await browser.close();
  await app.close();fs.rmSync(home,{recursive:true,force:true});
}
