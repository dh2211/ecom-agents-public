import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {contribution,validateStore,listingReadiness,checkClaims,stableArtifactId} from '../../scripts/pod/core.mjs';
import {crc32,printQa,inspectPng} from '../../scripts/pod/print-qa.mjs';
import {readShopify} from '../../scripts/pod/shopify-read.mjs';
import {installProfile} from '../../installer/pod-profile.mjs';
const config={schema:'pod-store/1',store_id:'demo-store',shop_domain:'example.myshopify.com',currency:'USD',timezone:'Asia/Ho_Chi_Minh',mode:'draft-only',niches:['farmer'],max_data_age_hours:24};
const costs={currency:'USD',merchandise_revenue_minor:2999,shipping_revenue_minor:500,customer_paid_minor:3849,production_cost_minor:1200,supplier_shipping_minor:500,other_variable_cost_minor:50,payment_fixed_minor:30,payment_rate_bps:290,refund_reserve_bps:500,ad_cost_minor:800};
function chunk(type,data){const head=Buffer.alloc(8);head.writeUInt32BE(data.length);head.write(type,4);const sum=Buffer.alloc(4);sum.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type),data])));return Buffer.concat([head,data,sum]);}
function png({alpha='transparent-border',filter=0,channels=4}={}){
 const w=8,h=8,ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=channels===4?6:2;
 const rows=[];let prev=Buffer.alloc(w*channels);
 const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
 for(let y=0;y<h;y++){const row=Buffer.alloc(w*channels);for(let x=0;x<w;x++){row[x*channels]=x*20;row[x*channels+1]=y*20;row[x*channels+2]=120;if(channels===4)row[x*4+3]=alpha==='empty'?0:alpha==='opaque'?255:(x===0||x===w-1||y===0||y===h-1)?0:255;}
 const filtered=Buffer.from(row);for(let i=0;i<row.length;i++){const a=i>=channels?row[i-channels]:0,b=prev[i],c=i>=channels?prev[i-channels]:0;const v=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);filtered[i]=(row[i]-v+256)%256;}
 rows.push(Buffer.from([filter]),filtered);prev=row;}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
}
const spec={supplier_template_ref:'fixture-only',width_px:8,height_px:8,background:'transparent'};
const now=new Date('2026-09-21T12:00:00Z');
function listing(){const qa=printQa(png(),spec);const review={status:'approved',reviewed_by:'fixture-reviewer',reviewed_at:'2026-09-21T11:00:00Z',evidence_ref:'local-fixture-review',asset_sha256:qa.sha256,supplier_template_ref:'fixture-only',store_id:'demo-store',sku:'FARM-001'};return{qa,d:{store_id:'demo-store',sku:'FARM-001',title:'Example farmer shirt',currency:'USD',status:'DRAFT',asset_sha256:qa.sha256,supplier_template_ref:'fixture-only',costs:{...costs},source_observed_at:'2026-09-21T11:00:00Z',rights_review:review,spelling_review:review,contrast_review:review,mockup_review:review}};}
test('contribution rounds processor fee and reserve in minor units',()=>{const p=contribution(costs);assert.equal(p.payment_fees_minor,142);assert.equal(p.refund_reserve_minor,175);assert.equal(p.contribution_before_ads_minor,1432);assert.equal(p.contribution_after_ads_minor,632);assert.equal(p.break_even_cpa_minor,1432);});
test('unknown cost is not zero',()=>assert.throws(()=>contribution({...costs,production_cost_minor:null})));
test('fractional minor money is rejected',()=>assert.throws(()=>contribution({...costs,production_cost_minor:12.5})));
test('negative costs are rejected',()=>assert.throws(()=>contribution({...costs,supplier_shipping_minor:-1})));
test('zero advertising does not produce infinite ROAS',()=>assert.equal(contribution({...costs,ad_cost_minor:0}).observed_roas,null));
test('negative unit contribution gives no acquisition budget',()=>{const p=contribution({...costs,production_cost_minor:9000});assert.equal(p.break_even_cpa_minor,0);assert.equal(p.break_even_roas,null);});
test('fee basis below revenue rejected',()=>assert.throws(()=>contribution({...costs,customer_paid_minor:10})));
test('invalid percentage rejected',()=>assert.throws(()=>contribution({...costs,payment_rate_bps:10001})));
test('config rejects tokens or arbitrary fields',()=>assert.throws(()=>validateStore({...config,token:'not-a-real-secret'}),/Unknown/));
test('config rejects unsafe external shop URL',()=>assert.throws(()=>validateStore({...config,shop_domain:'https://evil.example'})));
test('config requires explicit timezone',()=>assert.throws(()=>validateStore({...config,timezone:undefined})));
test('config cannot enable automatic publishing',()=>assert.throws(()=>validateStore({...config,mode:'publish'})));
for(let filter=0;filter<5;filter++)test('PNG filter '+filter+' preserves measured transparency',()=>{const q=printQa(png({filter}),spec);assert.equal(q.status,'pass');assert.equal(q.transparent_pixels,28);assert.equal(q.visible_pixels,36);});
test('opaque RGBA/checkerboard appearance does not pass alpha QA',()=>assert.equal(printQa(png({alpha:'opaque'}),spec).status,'hold'));
test('RGB file is not transparent',()=>assert.equal(printQa(png({channels:3}),spec).status,'hold'));
test('empty transparent canvas is rejected',()=>assert.equal(printQa(png({alpha:'empty'}),spec).status,'hold'));
test('wrong supplier dimensions are held',()=>assert.equal(printQa(png(),{...spec,width_px:9}).status,'hold'));
test('corrupt PNG checksum is rejected',()=>{const b=png();b[30]^=1;assert.throws(()=>inspectPng(b),/checksum/);});
test('renaming non-PNG to PNG cannot pass',()=>assert.throws(()=>inspectPng(Buffer.from('not a png'))));
test('trailing data is rejected',()=>assert.throws(()=>inspectPng(Buffer.concat([png(),Buffer.from('x')]))));
test('solid fallback blocked when generator supports transparency',()=>assert.equal(printQa(png({alpha:'opaque'}),{...spec,background:'solid',generator_supports_transparency:true,supplier_approves_solid:true}).status,'hold'));
test('solid fallback needs explicit provider approval',()=>assert.equal(printQa(png({alpha:'opaque'}),{...spec,background:'solid',generator_supports_transparency:false}).status,'hold'));
test('approved solid fallback with unsupported transparency can pass technically',()=>assert.equal(printQa(png({alpha:'opaque'}),{...spec,background:'solid',generator_supports_transparency:false,supplier_approves_solid:true}).status,'pass'));
test('listing needs the same asset hash as QA',()=>{const {d,qa}=listing();d.asset_sha256='a'.repeat(64);assert.equal(listingReadiness(d,qa,config,now).status,'hold');});
test('listing cannot target another store',()=>{const {d,qa}=listing();d.store_id='another-store';assert.equal(listingReadiness(d,qa,config,now).status,'hold');});
test('listing cannot mix currencies',()=>{const {d,qa}=listing();d.costs.currency='AUD';assert.equal(listingReadiness(d,qa,config,now).status,'hold');});
test('listing with missing human approval remains held',()=>{const {d,qa}=listing();delete d.rights_review;assert.equal(listingReadiness(d,qa,config,now).status,'hold');});
test('future human approval rejected',()=>{const {d,qa}=listing();d.rights_review={...d.rights_review,reviewed_at:'2027-01-01T00:00:00Z'};assert.equal(listingReadiness(d,qa,config,now).status,'hold');});
test('stale listing data remains held',()=>{const {d,qa}=listing();d.source_observed_at='2026-09-01T00:00:00Z';assert.equal(listingReadiness(d,qa,config,now).status,'hold');});
test('good listing still does not authorize a remote write',()=>{const {d,qa}=listing();const r=listingReadiness(d,qa,config,now);assert.equal(r.status,'ready-for-human-review');assert.equal(r.remote_mutation_allowed,false);});
for(const key of ['rights_review','spelling_review','contrast_review','mockup_review']) {
  for(const field of ['asset_sha256','supplier_template_ref','store_id','sku']) {
    test(key+' cannot reuse a review for another '+field,()=>{
      const {d,qa}=listing();
      d[key]={...d[key],asset_sha256:qa.sha256,supplier_template_ref:d.supplier_template_ref,store_id:d.store_id,sku:d.sku,[field]:'foreign'};
      const r=listingReadiness(d,qa,config,now);
      assert.equal(r.status,'hold');assert.match(r.reasons.join(' '),new RegExp(field));
    });
    test(key+' requires '+field+' binding',()=>{
      const {d,qa}=listing();
      d[key]={...d[key],asset_sha256:qa.sha256,supplier_template_ref:d.supplier_template_ref,store_id:d.store_id,sku:d.sku};
      delete d[key][field];
      assert.equal(listingReadiness(d,qa,config,now).status,'hold');
    });
  }
}
test('bundled POD listing core stays identical to repository helper',()=>{
  assert.equal(fs.readFileSync(new URL('../../scripts/pod/core.mjs',import.meta.url),'utf8'),fs.readFileSync(new URL('../../skills/pod-workbench/scripts/core.mjs',import.meta.url),'utf8'));
});
test('Vietnamese customer count requires proof',()=>assert.equal(checkClaims('10 kh\u00e1ch h\u00e0ng',[]).status,'hold'));
test('Vietnamese hour count requires proof',()=>assert.equal(checkClaims('Trong 24 gi\u1edd',[]).status,'hold'));
test('English and Vietnamese exact approved claims pass',()=>assert.equal(checkClaims('10 customers; 10 kh\u00e1ch h\u00e0ng',['10 customers','10 kh\u00e1ch h\u00e0ng']).status,'pass'));
test('stable artifact id includes store and revision',()=>{assert.equal(stableArtifactId('s','k','i','1'),stableArtifactId('s','k','i','1'));assert.notEqual(stableArtifactId('s','k','i','1'),stableArtifactId('t','k','i','1'));assert.notEqual(stableArtifactId('s','k','i','1'),stableArtifactId('s','k','i','2'));});
const response=(nodes=[],next=false,cursor=null)=>new Response(JSON.stringify({data:{products:{nodes,pageInfo:{hasNextPage:next,endCursor:cursor}}}}),{status:200});
test('Shopify reader uses fixed query and no customer identity fields',async()=>{let body;const r=await readShopify({shop:config.shop_domain,token:'fixture-token',resource:'products',fetchImpl:async(url,opt)=>{assert.match(url,/\/2026-07\/graphql.json$/);body=JSON.parse(opt.body);return response([{id:'p1'}]);}});assert.equal(r.complete,true);assert.ok(body.query.startsWith('query '));assert.doesNotMatch(body.query,/mutation|email|shippingAddress/);});
test('arbitrary GraphQL/mutation is rejected',async()=>assert.rejects(()=>readShopify({shop:config.shop_domain,token:'fixture-token',resource:'mutation'})));
test('unsafe host rejected before network call',async()=>assert.rejects(()=>readShopify({shop:'127.0.0.1',token:'fixture-token',resource:'products'})));
test('pagination cap is explicitly incomplete',async()=>{const r=await readShopify({shop:config.shop_domain,token:'fixture-token',resource:'products',maxPages:1,fetchImpl:async()=>response([{id:'p1'}],true,'next')});assert.equal(r.complete,false);});
test('repeated cursors fail instead of looping',async()=>assert.rejects(()=>readShopify({shop:config.shop_domain,token:'fixture-token',resource:'products',fetchImpl:async()=>response([{id:'p1'}],true,'same')}),/cursor/));
test('HTTP throttling retries are bounded',async()=>{let n=0;await assert.rejects(()=>readShopify({shop:config.shop_domain,token:'fixture-token',resource:'products',sleep:async()=>{},fetchImpl:async()=>{n++;return new Response('',{status:429});}}),/rate limit/);assert.equal(n,3);});
test('HTTP throttling can recover',async()=>{let n=0;const r=await readShopify({shop:config.shop_domain,token:'fixture-token',resource:'products',sleep:async()=>{},fetchImpl:async()=>++n===1?new Response('',{status:429}):response()});assert.equal(n,2);assert.equal(r.complete,true);});
test('GraphQL errors never become zero sales',async()=>assert.rejects(()=>readShopify({shop:config.shop_domain,token:'fixture-token',resource:'products',fetchImpl:async()=>new Response(JSON.stringify({errors:[{message:'redacted'}],data:{products:null}}),{status:200})}),/GraphQL/));
test('network exceptions cannot echo supplied token',async()=>{await assert.rejects(()=>readShopify({shop:config.shop_domain,token:'sensitive-fixture',resource:'products',fetchImpl:async()=>{throw new Error('sensitive-fixture');}}),e=>!e.message.includes('sensitive-fixture'));});
test('profile installer preserves existing owner config',t=>{const r=fs.mkdtempSync(path.join(os.tmpdir(),'pod-profile-'));t.after(()=>fs.rmSync(r,{recursive:true,force:true}));fs.writeFileSync(path.join(r,'agent.json'),'{"slug":"gtm-engineer"}');fs.writeFileSync(path.join(r,'AGENTS.md'),'<!-- POD PROFILE -->');fs.writeFileSync(path.join(r,'PAUSED'),'');const a=installProfile({root:r,config});assert.equal(a.mode,'draft-only');assert.throws(()=>installProfile({root:r,config}),/already exists/);assert.equal(JSON.parse(fs.readFileSync(path.join(r,'pod/config.json'))).store_id,'demo-store');});
