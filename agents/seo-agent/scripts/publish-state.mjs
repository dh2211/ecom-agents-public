#!/usr/bin/env node
// Read-only publish recovery gate. It never authorizes an outbound action.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const fields=['slug','property','route','url','started_at'];
const statuses=new Set(['pending','uncertain','confirmed','reconciled-not-published']);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
export function publishState({attempts,published,drafts,slug,property}) {
 const hold=reason=>({action:'hold',reason});
 if(![attempts,published,drafts].every(Array.isArray)||!nonempty(slug)||!nonempty(property)) return hold('Invalid ledger or candidate');
 const folded=new Map();
 for(const row of attempts) {
  if(!row||!nonempty(row.attempt_id)||!fields.every(k=>nonempty(row[k]))||!['surface','repository'].includes(row.route)||!statuses.has(row.status)||!Number.isFinite(Date.parse(row.started_at))) return hold('Malformed attempt row');
  const old=folded.get(row.attempt_id);
  if(!old&&row.status!=='pending') return hold('Attempt has no pending origin');
  if(old&&(fields.some(k=>row[k]!==old[k])||row.status==='pending'||['confirmed','reconciled-not-published'].includes(old.status))) return hold('Invalid attempt transition or identity');
  if(row.status==='reconciled-not-published'?(row.by!=='member'||!nonempty(row.evidence)):(row.by!=='seo-publish-run')) return hold('Invalid attempt author or reconciliation evidence');
  if(row.status!=='pending'&&!Number.isFinite(Date.parse(row.observed_at))) return hold('Missing observation time');
  folded.set(row.attempt_id,row);
 }
 for(const row of published) if(!row||!nonempty(row.slug)||!nonempty(row.property)||!['published','live-check-failed'].includes(row.status)||!nonempty(row.url)) return hold('Malformed published row');
 for(const row of drafts) if(!row||!nonempty(row.slug)||!nonempty(row.status)) return hold('Malformed draft row');
 const recorded=published.filter(x=>x.slug===slug);
 if(recorded.some(x=>x.property!==property)||recorded.length>1) return hold('Published identity conflict');
 const matching=[...folded.values()].filter(x=>x.slug===slug);
 if(matching.some(x=>x.property!==property)) return hold('Attempt property conflict');
 const unresolved=matching.filter(x=>x.status!=='reconciled-not-published');
 if(unresolved.length>1) return hold('Multiple unresolved attempts');
 if(recorded.length) {
  const row=recorded[0],attempt=unresolved[0];
  if(Object.hasOwn(row,'attempt_id')) {
   const linked=folded.get(row.attempt_id);
   if(!nonempty(row.attempt_id)||!linked||linked.status==='reconciled-not-published'||['slug','property','route','url'].some(k=>row[k]!==linked[k])) return hold('Published provenance contradicts attempt history');
  }
  if(attempt&&(row.url!==attempt.url||row.route!==attempt.route||row.attempt_id&&row.attempt_id!==attempt.attempt_id)) return hold('Published attempt identity conflict');
  return {action:drafts.filter(x=>x.slug===slug).at(-1)?.status==='consumed'?'done':'consume',close_card:row.status==='published'};
 }
 const attempt=unresolved[0];
 if(attempt) return {action:'reconcile',active_publish_attempt:attempt.attempt_id,attempt};
 if(drafts.filter(x=>x.slug===slug).at(-1)?.status==='consumed') return hold('Consumed draft without published evidence');
 return {action:'new-attempt',requires_release:true};
}
function rows(root,name) {
 const file=path.join(root,name);
 if(fs.lstatSync(file).isSymbolicLink()) throw new Error('Ledger symlink');
 const text=fs.readFileSync(file,'utf8');
 if(text&&(!text.endsWith('\n')||text.charCodeAt(0)===0xfeff)) throw new Error('Incomplete ledger');
 return text.split('\n').filter(x=>x.trim()).map(x=>JSON.parse(x));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 if(process.argv[2]==='--selftest') {
  assert.equal(publishState({attempts:[],published:[],drafts:[],slug:'example',property:'fixture'}).action,'new-attempt');
  assert.equal(publishState({attempts:[{}],published:[],drafts:[],slug:'example',property:'fixture'}).action,'hold');
  console.log('publish-state: selftest PASS');
 } else {
  let result;
  try {const [root,slug,property]=process.argv.slice(2);result=publishState({attempts:rows(root,'state/publish-attempts.jsonl'),published:rows(root,'content/published.jsonl'),drafts:rows(root,'content/drafts.jsonl'),slug,property});}
  catch {result={action:'hold',reason:'Missing, unreadable or malformed ledger; member reconciliation required'};}
  console.log(JSON.stringify(result));process.exitCode=result.action==='hold'?1:0;
 }
}
