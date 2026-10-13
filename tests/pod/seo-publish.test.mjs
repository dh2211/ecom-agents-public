import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {publishState} from '../../agents/seo-agent/scripts/publish-state.mjs';
const pending={attempt_id:'fixture-1',slug:'sample',property:'fixture',route:'surface',url:'https://example.invalid/sample',started_at:'2026-01-01T00:00:00Z',status:'pending',by:'seo-publish-run'};
const outcome=status=>({...pending,status,observed_at:'2026-01-01T00:01:00Z'});
const published={slug:'sample',property:'fixture',route:'surface',url:pending.url,attempt_id:pending.attempt_id,status:'published'};
const state=(patch={})=>publishState({slug:'sample',property:'fixture',attempts:[],published:[],drafts:[{slug:'sample',status:'ready'}],...patch});
test('publish instruction routes selection through executable gate before action',()=>{
 const text=fs.readFileSync('agents/seo-agent/routines/seo-publish-run/SKILL.md','utf8');
 const selection=text.slice(text.indexOf('## Step 2.'),text.indexOf('## Step 3.'));
 assert.match(selection,/node scripts\/publish-state\.mjs/);
 assert.match(selection,/`consume`/);assert.match(selection,/`reconcile`/);assert.match(selection,/`hold`/);
 assert.doesNotMatch(text,/The live check cannot run at all \| `published` line/);
});
test('crash after each append never permits a second publish',()=>{
 assert.equal(state().action,'new-attempt');
 for(const attempts of [[pending],[pending,outcome('uncertain')],[pending,outcome('confirmed')]]) {
  const result=state({attempts});assert.equal(result.action,'reconcile');assert.equal(result.active_publish_attempt,pending.attempt_id);
 }
 assert.equal(state({attempts:[pending,outcome('confirmed')],published:[published]}).action,'consume');
 assert.equal(state({attempts:[pending,outcome('confirmed')],published:[published],drafts:[{slug:'sample',status:'consumed'}]}).action,'done');
});
test('legacy live-check-failed consumes without closing or replay',()=>{
 const {attempt_id,...legacy}=published;
 assert.deepEqual(state({published:[{...legacy,status:'live-check-failed'}]}),{action:'consume',close_card:false});
});
test('unavailable live check remains reconcile, including repository push',()=>{
 for(const route of ['surface','repository']) assert.equal(state({attempts:[{...pending,route},{...outcome('uncertain'),route}]}).action,'reconcile');
});
test('malformed and ambiguous attempts hold, never drop bad rows',()=>{
 for(const attempts of [[{}],[outcome('confirmed')],[pending,{...outcome('confirmed'),url:'https://example.invalid/other'}],[pending,{...pending,attempt_id:'second'}],[pending,{...outcome('reconciled-not-published'),by:'seo-publish-run'}]]) assert.equal(state({attempts}).action,'hold');
});
test('only member reconciliation with evidence permits another attempt',()=>{
 assert.equal(state({attempts:[pending,{...outcome('reconciled-not-published'),by:'member',evidence:'Verified remote history and surface absence'}]}).action,'new-attempt');
});
test('explicit published provenance must resolve to a compatible attempt',()=>{
 const reconciled={...outcome('reconciled-not-published'),by:'member',evidence:'Verified no publish occurred'};
 for(const patch of [
  {attempts:[pending,reconciled],published:[published]},
  {attempts:[],published:[published]},
  {attempts:[{...pending,slug:'different'}],published:[published]},
  {attempts:[{...pending,url:'https://example.invalid/other'}],published:[published]},
 ]) assert.equal(state(patch).action,'hold');
 assert.equal(state({attempts:[pending,outcome('confirmed')],published:[published]}).action,'consume');
 const {attempt_id,...legacy}=published;
 assert.equal(state({published:[legacy]}).action,'consume');
});
test('consumed without published, property drift and multiple published rows hold',()=>{
 assert.equal(state({drafts:[{slug:'sample',status:'consumed'}]}).action,'hold');
 assert.equal(state({attempts:[{...pending,property:'other'}]}).action,'hold');
 assert.equal(state({published:[published,published]}).action,'hold');
});
