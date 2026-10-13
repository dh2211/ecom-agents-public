#!/usr/bin/env node
// Local planning helpers. No network calls or commercial actions.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROLES = ['ad-manager-agent','chief-of-staff','customer-satisfaction-agent','gtm-engineer','sales-agent','seo-agent','social-media-agent','web-dev-agent'];
export function text(v, name) {
  if (typeof v !== 'string' || !v.trim() || v.length > 2000) throw new Error(name + ' must be non-empty text');
  return v;
}
function integer(v, name, max = 1e12) {
  if (!Number.isSafeInteger(v) || v < 0 || v > max) throw new Error(name + ' must be a known non-negative integer');
  return v;
}
function object(v, name) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(name + ' must be an object');
}
export function validateConfig(c) {
  object(c, 'config');
  const keys = ['schema','store_id','currency','timezone','mode','markets','max_source_age_hours'];
  if (Object.keys(c).some(k => !keys.includes(k))) throw new Error('Unknown config field; never put credentials in config');
  if (c.schema !== 'dropship-store/1' || c.mode !== 'draft-only') throw new Error('Use dropship-store/1 and draft-only');
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(c.store_id || '')) throw new Error('Use an opaque store_id');
  if (!/^[A-Z]{3}$/.test(c.currency || '')) throw new Error('Currency must be explicit');
  text(c.timezone, 'timezone');
  try { new Intl.DateTimeFormat('en', {timeZone:c.timezone}).format(); } catch { throw new Error('Invalid timezone'); }
  if (!Array.isArray(c.markets) || !c.markets.length || c.markets.some(m => !/^[A-Z]{2}$/.test(m))) throw new Error('markets must be country codes');
  integer(c.max_source_age_hours, 'max_source_age_hours', 168);
  if (c.max_source_age_hours < 1) throw new Error('Freshness must be 1..168 hours');
  return c;
}

// All costs use ONE settlement currency and minor units. Example: 1299 = USD 12.99.
export function economics(c) {
  object(c, 'costs');
  if (!/^[A-Z]{3}$/.test(c.currency || '')) throw new Error('Explicit currency required');
  const fields = ['merchandise_revenue_minor','shipping_revenue_minor','customer_paid_minor','supplier_cost_minor','supplier_shipping_minor','merchant_duties_minor','other_variable_minor','payment_fixed_minor','expected_refund_loss_minor','expected_replacement_loss_minor','ad_cost_minor','target_contribution_minor'];
  for (const k of fields) integer(c[k], k);
  integer(c.payment_rate_bps, 'payment_rate_bps', 10000);
  if (c.basis !== 'planning') throw new Error('Use planning basis; do not mix reserves with realized refunds');
  if ('realized_refunds_minor' in c) throw new Error('Do not double-count refunds and expected losses');
  const revenue = c.merchandise_revenue_minor + c.shipping_revenue_minor;
  if (c.customer_paid_minor < revenue) throw new Error('Fee basis cannot be below revenue excluding collected tax');
  const fee = Number((BigInt(c.customer_paid_minor) * BigInt(c.payment_rate_bps) + 9999n) / 10000n) + c.payment_fixed_minor;
  const before = revenue - c.supplier_cost_minor - c.supplier_shipping_minor - c.merchant_duties_minor - c.other_variable_minor - fee - c.expected_refund_loss_minor - c.expected_replacement_loss_minor;
  return {currency:c.currency, revenue_ex_tax_minor:revenue, payment_fee_minor:fee,
    contribution_before_ads_minor:before, contribution_after_ads_minor:before-c.ad_cost_minor,
    break_even_cpa_minor:Math.max(0,before), target_cpa_minor:Math.max(0,before-c.target_contribution_minor),
    break_even_roas:before>0 ? revenue/before : null,
    observed_roas:c.ad_cost_minor>0 ? revenue/c.ad_cost_minor : null,
    remote_mutation_allowed:false,
    limitation:'Planning contribution, not net profit. Excludes fixed overhead and income tax; expected losses are explicit assumptions.'};
}
function evidence(e, name, now, maxHours = Infinity) {
  object(e, name); text(e.source_ref, name+'.source_ref');
  const t = Date.parse(e.observed_at || '');
  if (!Number.isFinite(t) || t > now || now-t > maxHours*3600000) throw new Error(name + ' evidence is missing, stale or future-dated');
}
export function supplierReadiness(d, config, clock = new Date()) {
  validateConfig(config);
  const now = clock.getTime();
  if (!Number.isFinite(now)) throw new Error('Invalid clock');
  const errors = [];
  const check = fn => { try { fn(); } catch (e) { errors.push(e.message); } };
  check(() => {
    object(d,'dossier');
    for (const k of ['product_id','variant_id','supplier_id']) text(d[k],k);
    if (d.schema !== 'dropship-product/1') throw new Error('Unsupported product schema');
    if (d.store_id !== config.store_id || !config.markets.includes(d.market)) throw new Error('Wrong store or unconfigured market');
    if (d.currency !== config.currency) throw new Error('Dossier currency differs from store');
  });
  if (!d || typeof d !== 'object') return {status:'hold',errors,remote_mutation_allowed:false};
  for (const k of ['stock','quote','shipping']) check(() => {
    evidence(d[k],k,now,config.max_source_age_hours);
    if (d[k].variant_id !== d.variant_id || d[k].supplier_id !== d.supplier_id) throw new Error(k+' belongs to another variant or supplier');
  });
  check(() => { if (d.stock?.available !== true) throw new Error('Stock availability is unknown or unavailable'); });
  check(() => {
    if (d.quote?.currency !== config.currency || d.costs?.currency !== config.currency) throw new Error('Quote/cost currency mismatch; no implicit FX conversion');
    integer(d.quote.unit_cost_minor,'quote.unit_cost_minor');
    if (d.quote.unit_cost_minor !== d.costs.supplier_cost_minor) throw new Error('Quoted cost and modeled cost differ');
  });
  check(() => {
    const s=d.shipping;
    if (s.market!==d.market || !['business','calendar'].includes(s.day_basis)) throw new Error('Shipping needs the exact market and day basis');
    for (const k of ['handling_min_days','handling_max_days','transit_min_days','transit_max_days']) integer(s[k], 'shipping.'+k, 365);
    if (s.handling_min_days>s.handling_max_days || s.transit_min_days>s.transit_max_days) throw new Error('Shipping range is inverted');
    text(s.origin_country,'shipping.origin_country'); text(s.duties_disclosure,'shipping.duties_disclosure');
    if (s.cost_minor !== d.costs.supplier_shipping_minor) throw new Error('Shipping quote and modeled cost differ');
  });
  for (const k of ['sample_review','safety_review','returns_review']) check(() => {
    evidence(d[k],k,now);
    if (d[k].status !== 'approved' || d[k].variant_id !== d.variant_id || d[k].supplier_id !== d.supplier_id || d[k].market !== d.market) throw new Error(k+' must cover this variant, supplier and market');
    text(d[k].reviewer,'reviewer');
  });
  let margin=null;
  check(() => { margin=economics(d.costs); if (margin.contribution_after_ads_minor<=0) throw new Error('Planned contribution after ads is not positive'); });
  return {status:errors.length?'hold':'ready-for-human-review',errors,margin,
    delivery_range:errors.length?null:{min_days:d.shipping.handling_min_days+d.shipping.transit_min_days,max_days:d.shipping.handling_max_days+d.shipping.transit_max_days,day_basis:d.shipping.day_basis},
    remote_mutation_allowed:false,
    limitation:'Evidence and review records are declarations, not authenticated approvals or legal clearance. Sample evidence is not a delivery guarantee.'};
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [cmd,a,b,...extra]=process.argv.slice(2);
    if (extra.length || !a || !['economics','supplier'].includes(cmd) || (cmd==='economics' && b) || (cmd==='supplier' && !b)) throw new Error('Usage: ops.mjs economics costs.json | supplier product.json store.json');
    const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
    const r=cmd==='economics'?economics(read(a)):supplierReadiness(read(a),read(b));
    console.log(JSON.stringify(r,null,2)); if(r.status==='hold')process.exitCode=2;
  } catch(e) { console.error('dropship: '+e.message); process.exitCode=1; }
}
