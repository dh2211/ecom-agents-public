#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256,verifyAsset,probe,assemble} from './media.mjs';

const required=(v,k)=>{if(typeof v!=='string'||!v.trim()||v.length>2000)throw new Error(k+' is required');return v;};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function validateBrief(b,now=new Date()) {
  if(!Number.isFinite(now.getTime()))throw new Error('Invalid clock');
  if(!b||b.schema!=='commerce-creative/1'||!['pod','dropship'].includes(b.business_model))throw new Error('Use commerce-creative/1 with an explicit business_model');
  for(const k of ['store_id','product_id','variant_id','market','locale','headline','cta','disclosure_text'])required(b[k],k);
  if(!['creator','ai-presenter','product-demo'].includes(b.ugc_mode))throw new Error('Unknown UGC mode');
  if(![15,30,45].includes(b.target_seconds))throw new Error('Choose a 15, 30 or 45 second editorial target');
  if(!Array.isArray(b.facts)||!b.facts.length)throw new Error('At least one sourced product fact is required');
  for(const f of b.facts){required(f.text,'fact.text');required(f.source_ref,'fact.source_ref');if(!Number.isFinite(Date.parse(f.observed_at))||Date.parse(f.observed_at)>now.getTime())throw new Error('Fact timestamp is invalid');}
  if(!Array.isArray(b.hooks)||b.hooks.length<1||b.hooks.length>3||b.hooks.some(h=>typeof h!=='string'||!h.trim()||h.length>160))throw new Error('Use 1..3 short hook hypotheses');
  if(b.ugc_mode==='ai-presenter') {
    required(b.ai_disclosure_text,'AI disclosure');
    if(b.testimonial)throw new Error('AI presenter cannot give a customer testimonial');
  }
  if(b.testimonial) {
    if(b.ugc_mode!=='creator'||b.testimonial.actual_experience!==true)throw new Error('Testimonials need a real creator with actual product experience');
    for(const k of ['text','source_ref','consent_ref'])required(b.testimonial[k],'testimonial.'+k);
  }
  if(!Array.isArray(b.assets))throw new Error('assets must be an array, empty when not yet produced');
  const files=new Set();
  for(const a of b.assets) {
    required(a.file,'asset.file');
    if(files.has(a.file))throw new Error('Duplicate asset path'); files.add(a.file);
    if(!/^[a-f0-9]{64}$/.test(a.sha256||''))throw new Error('Asset SHA256 required');
    if(!['product-image','product-video','creator-video','voiceover','music'].includes(a.kind))throw new Error('Unknown asset kind');
    if(typeof a.contains_real_person!=='boolean')throw new Error('Declare whether an asset contains a real person or voice');
    const r=a.rights;
    if(!r||r.status!=='granted'||!Array.isArray(r.uses)||!Array.isArray(r.markets)||!r.uses.includes('paid-ads')||!r.uses.includes('editing')||!r.markets.includes(b.market))throw new Error('Asset needs recorded paid-ad and editing rights for the target market');
    required(r.evidence_ref,'rights evidence');
    if(r.perpetual!==true&&(!Number.isFinite(Date.parse(r.expires_at))||Date.parse(r.expires_at)<=now.getTime()))throw new Error('Asset rights are expired or unknown');
    if(a.contains_real_person)required(r.likeness_consent_ref,'Likeness/voice consent');
    if(typeof a.ai_generated!=='boolean')throw new Error('Declare AI provenance for each asset');
    if(a.ai_generated===true){required(b.ai_disclosure_text,'AI disclosure');if(a.contains_real_person&&r.ai_derivatives!==true)throw new Error('AI likeness derivatives need explicit consent');}
    if(['product-image','product-video','creator-video'].includes(a.kind)&&(a.product_id!==b.product_id||a.variant_id!==b.variant_id))throw new Error('Product asset belongs to another product or variant');
  }
  return b;
}
export function plan(b,out) {
  validateBrief(b);
  if(fs.existsSync(out))throw new Error('Output exists; use a new revision folder');
  fs.mkdirSync(out,{recursive:true});
  const pieces=[['Hook',0,0.10,b.hooks[0]],['Problem / context',0.10,0.25,'Show the real use context; do not invent a customer experience.'],['Product demonstration',0.25,0.65,b.facts.map(f=>f.text).join(' ')],['Proof / objection',0.65,0.85,b.testimonial?.text || 'Demonstrate a sourced feature, not an invented testimonial.'],['CTA',0.85,1,b.cta]];
  const scenes=pieces.map(([label,start,end,copy])=>({label,start_s:Number((start*b.target_seconds).toFixed(2)),end_s:Number((end*b.target_seconds).toFixed(2)),copy,media_status:'not-rendered'}));
  const result={schema:'creative-plan/1',store_id:b.store_id,product_id:b.product_id,variant_id:b.variant_id,business_model:b.business_model,market:b.market,locale:b.locale,status:'brief-only',ugc_mode:b.ugc_mode,scenes,variants:b.hooks.map((hook,i)=>({id:'hook-'+(i+1),variable:'hook',hook,keep_fixed:['offer','body','cta','audience','placement']})),generation:{status:'not-started',provider:null,job_id:null,asset_files:[]},remote_mutation_allowed:false};
  const write=(name,body)=>fs.writeFileSync(path.join(out,name),body,{flag:'wx'});
  write('plan.json',JSON.stringify(result,null,2)+'\n');
  write('storyboard.md','# UGC working storyboard\n\nDRAFT. A storyboard is not a rendered video.\n\n'+scenes.map(s=>'## '+s.start_s+'-'+s.end_s+'s: '+s.label+'\n\n'+s.copy+'\n\nShot: [real footage or clearly labeled AI scene]\n').join('\n'));
  write('banner-brief.md','# Banner brief\n\nHeadline: '+b.headline+'\nCTA: '+b.cta+'\nDisclosure: '+b.disclosure_text+'\n\nWorking formats: 1:1, 4:5, 9:16. Verify current placement safe zones.\nUse the exact approved product variant; do not invent accessories or product results.\n');
  write('review-checklist.md','# Required human review\n\n- [ ] Exact product / variant fidelity\n- [ ] Every factual claim matches evidence\n- [ ] Creator, music, product images and voice usage rights\n- [ ] No fictional customer testimonial\n- [ ] Sponsorship and AI labels visible / audible where required\n- [ ] Captions, spelling, mobile readability and safe zones\n- [ ] Offer and shipping agree with the actual landing page\n- [ ] Hash the final export and record reviewer, scope and date\n\nNothing in this pack authorizes publishing or spend.\n');
  return result;
}
function lines(text,max=25) {
  const words=text.trim().split(/\s+/), result=[];let line='';
  for(const w of words){if(w.length>max)throw new Error('Banner text has an overlong word');if((line+' '+w).trim().length>max){result.push(line);line=w;}else line=(line+' '+w).trim();}
  if(line)result.push(line); if(result.length>3)throw new Error('Headline too long for banner template');return result;
}
export function banners(b,root,out) {
  validateBrief(b);
  const a=b.assets.find(a=>a.kind==='product-image'); if(!a)throw new Error('Supply a licensed product-image first');
  const f=verifyAsset(root,a), bytes=fs.readFileSync(f);
  if(bytes.length>20*1024*1024)throw new Error('Use a product image under 20 MiB');
  let mime;
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
  else if(bytes[0]===255&&bytes[1]===216&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217)mime='image/jpeg';
  else throw new Error('Banner source must be an actual PNG or JPEG');
  const heading=lines(b.headline);
  const disclosure=[b.disclosure_text,b.ai_disclosure_text].filter(Boolean).join(' | ');
  if(b.cta.length>28||disclosure.length>110)throw new Error('CTA/disclosure needs a shorter mobile-safe version');
  if(fs.existsSync(out))throw new Error('Output exists; use a new revision folder');
  fs.mkdirSync(out,{recursive:true});const assets=[];
  for(const [name,w,h] of [['1x1',1080,1080],['4x5',1080,1350],['9x16',1080,1920]]) {
    const y=96+heading.length*66, imageH=h-y-240;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" data-status="draft-needs-human-review"><rect width="100%" height="100%" fill="#F5F3EE"/><g font-family="Arial,sans-serif" fill="#171717">${heading.map((t,i)=>`<text x="70" y="${100+i*66}" font-size="56" font-weight="700">${esc(t)}</text>`).join('')}<image x="70" y="${y}" width="940" height="${imageH}" preserveAspectRatio="xMidYMid meet" href="data:${mime};base64,${bytes.toString('base64')}"/><rect x="70" y="${h-180}" width="940" height="80" rx="12" fill="#171717"/><text x="540" y="${h-127}" text-anchor="middle" font-size="36" fill="white">${esc(b.cta)}</text><text x="70" y="${h-45}" font-size="16">${esc(disclosure)}</text></g></svg>`;
    const file='banner-'+name+'.draft.svg';fs.writeFileSync(path.join(out,file),svg,{flag:'wx'});
    assets.push({file,width:w,height:h,sha256:sha256(path.join(out,file)),format:'svg-layout-not-upload-ready'});
  }
  const result={schema:'creative-banners/1',status:'draft-needs-human-review',assets,remote_mutation_allowed:false,limitation:'Export to a platform-accepted raster format, inspect at mobile size and re-check its hash. No generative product image was invented.'};
  fs.writeFileSync(path.join(out,'banners.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}
export function audit(b,manifest,root) {
  validateBrief(b);const errors=[];
  if(!manifest||manifest.store_id!==b.store_id||manifest.product_id!==b.product_id||manifest.variant_id!==b.variant_id||manifest.market!==b.market)errors.push('Export belongs to another store/product/variant');
  if(!Array.isArray(manifest?.exports)||!manifest.exports.length)errors.push('No final exports');
  const measured=[];
  for(const a of b.assets){try{verifyAsset(root,a);}catch(err){errors.push(err.message);}}
  const sourceHashes=new Set(b.assets.map(a=>a.sha256));
  for(const e of (Array.isArray(manifest?.exports)?manifest.exports:[])) {
    try {
      if(!Array.isArray(e.source_asset_hashes)||!e.source_asset_hashes.length||e.source_asset_hashes.some(h=>!sourceHashes.has(h)))throw new Error('Export lineage is missing or references an unknown source');
      const f=verifyAsset(root,e),m=probe(f); measured.push({file:e.file,...m});
      if(!Number.isInteger(e.width)||!Number.isInteger(e.height)||e.width<1||e.height<1||m.width!==e.width||m.height!==e.height)throw new Error('Measured dimensions differ from export contract');
      if(e.kind==='video') {
        if(!/\.(mp4|mov)$/i.test(f)||!['mov,mp4,m4a,3gp,3g2,mj2'].includes(m.container_name)||!Number.isFinite(e.duration_s)||e.duration_s<=0||!m.duration_s||Math.abs(m.duration_s-e.duration_s)>0.2||!m.has_audio)throw new Error('Video container, duration/audio failed');
      } else if(e.kind==='image') {
        const ext=path.extname(f).toLowerCase();
        if(!['.png','.jpg','.jpeg'].includes(ext))throw new Error('Final image must be PNG/JPEG, not an SVG layout');
        const imageFacts=ext==='.png'?{containers:['png_pipe','image2'],codecs:['png']}:{containers:['jpeg_pipe','image2'],codecs:['mjpeg','jpeg']};
        if(!imageFacts.containers.includes(m.container_name)||!imageFacts.codecs.includes(m.video_codec)||m.has_audio||(Number.isFinite(m.duration_s)&&m.duration_s>0))throw new Error('Final image container/codec, duration or audio failed');
      } else throw new Error('Final image must be PNG/JPEG, not an SVG layout');
      const r=e.human_review;
      if(!r||r.status!=='approved'||r.asset_sha256!==e.sha256||typeof r.reviewer!=='string'||!r.reviewer.trim()||!Number.isFinite(Date.parse(r.reviewed_at))||Date.parse(r.reviewed_at)>Date.now())throw new Error('Human review must cover the exact final file hash');
      for(const k of ['product_fidelity','claims','rights','disclosures','safe_zone','landing_match'])if(r[k]!==true)throw new Error('Missing human review: '+k);
    } catch(err){errors.push((e.file||'export')+': '+err.message);}
  }
  return {status:errors.length?'hold':'ready-for-human-review',errors,measured,remote_mutation_allowed:false,limitation:'Technical checks plus declared review records; not authenticated publishing authorization or proof of truth.'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [cmd,...a]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
    let result;
    if(cmd==='plan'&&a.length===2)result=plan(read(a[0]),a[1]);
    else if(cmd==='banners'&&a.length===3)result=banners(read(a[0]),a[1],a[2]);
    else if(cmd==='audit'&&a.length===3)result=audit(read(a[0]),read(a[1]),a[2]);
    else if(cmd==='assemble'&&a.length===4){const b=validateBrief(read(a[0])),timeline=read(a[1]);if(timeline.target_seconds!==b.target_seconds)throw new Error('Timeline and brief duration differ');result=assemble({root:a[2],assets:b.assets,timeline,output:a[3]});}
    else throw new Error('Usage: creative.mjs plan brief.json OUT | banners brief.json ASSET_ROOT OUT | assemble brief.json timeline.json ASSET_ROOT OUT | audit brief.json export.json ASSET_ROOT');
    console.log(JSON.stringify(result,null,2));if(result.status==='hold')process.exitCode=2;
  }catch(e){console.error('creative: '+e.message);process.exitCode=1;}
}
