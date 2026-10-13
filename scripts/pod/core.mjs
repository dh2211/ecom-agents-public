import crypto from 'node:crypto';
export function requiredString(x,name) { if(typeof x!=='string'||!x.trim())throw new Error(name+' is required');return x; }
function amount(x,name){if(!Number.isSafeInteger(x)||x<0||x>1e12)throw new Error(name+' must be a known non-negative integer in minor currency units');return x;}
function bps(x,name){amount(x,name);if(x>10000)throw new Error(name+' must be 0..10000 basis points');return x;}
const ceilRatio=(a,b,d)=>Number((BigInt(a)*BigInt(b)+BigInt(d)-1n)/BigInt(d));
/* Planning contribution, not accounting net profit. All input money is one currency.
 * Revenue excludes collected tax and is AFTER discounts. Costs include nonrecoverable tax. */
export function contribution(input){
  requiredString(input.currency,'currency');if(!/^[A-Z]{3}$/.test(input.currency))throw new Error('Use a three-letter currency');
  for(const k of ['merchandise_revenue_minor','shipping_revenue_minor','customer_paid_minor','production_cost_minor','supplier_shipping_minor','other_variable_cost_minor','payment_fixed_minor','ad_cost_minor'])amount(input[k],k);
  bps(input.payment_rate_bps,'payment_rate_bps');bps(input.refund_reserve_bps,'refund_reserve_bps');
  const revenue=input.merchandise_revenue_minor+input.shipping_revenue_minor;
  if(input.customer_paid_minor<revenue)throw new Error('Customer-paid fee basis cannot be below net revenue');
  const fees=ceilRatio(input.customer_paid_minor,input.payment_rate_bps,10000)+input.payment_fixed_minor;
  const reserve=ceilRatio(revenue,input.refund_reserve_bps,10000);
  const before=revenue-input.production_cost_minor-input.supplier_shipping_minor-input.other_variable_cost_minor-fees-reserve;
  const after=before-input.ad_cost_minor;
  return {currency:input.currency,revenue_ex_tax_minor:revenue,payment_fees_minor:fees,refund_reserve_minor:reserve,
    contribution_before_ads_minor:before,contribution_after_ads_minor:after,break_even_cpa_minor:Math.max(0,before),
    break_even_roas:before>0?revenue/before:null,observed_roas:input.ad_cost_minor>0?revenue/input.ad_cost_minor:null,
    contribution_margin_bps:revenue>0?Number(BigInt(after)*10000n/BigInt(revenue)):null,
    accounting_scope:'Planning contribution only; excludes fixed overhead and income tax. Refund reserve is an assumption, not observed refunds.'};
}
export function validateStore(c){
  if(!c||typeof c!=='object'||Array.isArray(c))throw new Error('Store config must be an object');
  const allowed=new Set(['schema','store_id','shop_domain','currency','timezone','mode','niches','max_data_age_hours','max_pages']);
  if(Object.keys(c).some(k=>!allowed.has(k)))throw new Error('Unknown store-config field; credentials and free-form private data are forbidden');
  if(c.schema!=='pod-store/1')throw new Error('Unsupported store schema');
  requiredString(c.store_id,'store_id');if(!/^[a-z0-9][a-z0-9-]{1,63}$/.test(c.store_id))throw new Error('Use an opaque lowercase store id');
  if(c.mode!=='draft-only')throw new Error('This release supports draft-only mode');
  if(!/^[A-Z]{3}$/.test(c.currency||''))throw new Error('Currency required');
  try{new Intl.DateTimeFormat('en',{timeZone:c.timezone}).format();}catch{throw new Error('Invalid timezone');}
  if(!c.timezone)throw new Error('Timezone must be explicit');
  if(!Array.isArray(c.niches)||!c.niches.length||c.niches.some(x=>typeof x!=='string'||!x.trim()))throw new Error('Declare the niches explicitly');
  if(!Number.isInteger(c.max_data_age_hours)||c.max_data_age_hours<1||c.max_data_age_hours>168)throw new Error('Declare freshness threshold 1..168 hours');
  if(c.max_pages!=null&&(!Number.isInteger(c.max_pages)||c.max_pages<1||c.max_pages>100))throw new Error('max_pages must be 1..100');
  if(c.shop_domain!=null&&!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(c.shop_domain))throw new Error('Only a bare myshopify.com shop domain is supported');
  return c;
}
function approval(r,label,now,listing){
  if(!r||r.status!=='approved'||typeof r.reviewed_by!=='string'||!r.reviewed_by.trim()||typeof r.evidence_ref!=='string'||!r.evidence_ref.trim()||!Number.isFinite(Date.parse(r.reviewed_at||'')))throw new Error(label+' needs a recorded human review');
  if(Date.parse(r.reviewed_at)>now.getTime())throw new Error(label+' is dated in the future');
  // A review is only evidence for the exact artwork and product that was inspected.
  for(const field of ['asset_sha256','supplier_template_ref','store_id','sku']) {
    if(typeof r[field]!=='string'||!r[field].trim()||r[field]!==listing[field])throw new Error(label+' '+field+' must match the current listing');
  }
}
export function listingReadiness(d,qa,config,now=new Date()){
  validateStore(config);
  const reasons=[];
  if(d.store_id!==config.store_id)reasons.push('Listing belongs to another store');
  if(d.currency!==config.currency||d.costs?.currency!==config.currency)reasons.push('Currency mismatch; do not convert implicitly');
  const check=fn=>{try{fn();}catch(e){reasons.push(e.message);}};
  check(()=>requiredString(d.store_id,'store_id'));check(()=>requiredString(d.sku,'sku'));check(()=>requiredString(d.title,'title'));
  if(d.status!=='DRAFT')reasons.push('Listing must stay DRAFT');
  if(!qa||qa.status!=='pass')reasons.push('Print-file technical QA has not passed');
  if(!/^[a-f0-9]{64}$/.test(d.asset_sha256||'')||d.asset_sha256!==qa?.sha256)reasons.push('Listing and QA must reference the same asset hash');
  for(const k of ['rights_review','spelling_review','contrast_review','mockup_review'])check(()=>approval(d[k],k,now,d));
  check(()=>{requiredString(d.supplier_template_ref,'supplier_template_ref');if(d.supplier_template_ref!==qa?.supplier_template_ref)throw new Error('Supplier template does not match QA');});
  check(()=>{const p=contribution(d.costs||{});if(p.contribution_after_ads_minor<=0)throw new Error('Planned contribution is not positive');});
  check(()=>{
    const t=Date.parse(d.source_observed_at||'');if(!Number.isFinite(t)||t>now.getTime()||now.getTime()-t>config.max_data_age_hours*3600*1000)throw new Error('Listing source must be observed within the configured freshness window');
  });
  return {status:reasons.length?'hold':'ready-for-human-review',reasons,remote_mutation_allowed:false,
    note:'Review records are declarations, not cryptographic proof or a legal clearance. No publication is authorized.'};
}
export function checkClaims(text,approvedClaims=[]){
  if(typeof text!=='string'||!Array.isArray(approvedClaims)||approvedClaims.some(x=>typeof x!=='string'))throw new Error('Invalid copy/proof input');
  const normalized=text.normalize('NFC'),allowed=new Set(approvedClaims.map(x=>x.normalize('NFC')));
  const patterns=[/\d[\d.,]*\s*(?:%|percent|ph\u1ea7n tr\u0103m)/giu,
    /(?:[$\u00a3\u20ac]\s*\d[\d.,]*|\d[\d.,]*\s*(?:USD|AUD|VND|EUR|GBP|\u0111\u1ed3ng|tri\u1ec7u|t\u1ef7)(?!\p{L}))/giu,
    /\d[\d.,]*\s*(?:customers?|orders?|days?|weeks?|months?|kh\u00e1ch h\u00e0ng|\u0111\u01a1n h\u00e0ng|ng\u00e0y|tu\u1ea7n|th\u00e1ng|ng\u01b0\u1eddi|gi\u1edd)(?!\p{L})/giu];
  const detected=[...new Set(patterns.flatMap(p=>[...normalized.matchAll(p)].map(m=>m[0])))];
  const unsupported=detected.filter(x=>!allowed.has(x));
  return {status:unsupported.length?'hold':'pass',unsupported,limitations:'Pattern coverage only. Check every factual claim against its source; passing is not proof of truth.'};
}
export function stableArtifactId(storeId,kind,sourceId,revision){
  for(const [k,v] of Object.entries({storeId,kind,sourceId,revision}))requiredString(v,k);
  return crypto.createHash('sha256').update(JSON.stringify([storeId,kind,sourceId,revision])).digest('hex');
}
