import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {installProfile} from '../../installer/pod-profile.mjs';
const config={schema:'pod-store/1',store_id:'demo-store',shop_domain:'example.myshopify.com',currency:'USD',timezone:'Asia/Ho_Chi_Minh',mode:'draft-only',niches:['farmer'],max_data_age_hours:24};
function fixture(t){const base=fs.mkdtempSync(path.join(os.tmpdir(),'pod-private-'));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));const root=path.join(base,'kit');fs.mkdirSync(root);fs.writeFileSync(path.join(root,'agent.json'),'{"slug":"gtm-engineer"}');fs.writeFileSync(path.join(root,'AGENTS.md'),'<!-- POD PROFILE -->');fs.writeFileSync(path.join(root,'PAUSED'),'');return{base,root};}
test('POD installer rejects running, Git and cloud roots without changes',t=>{
 const {base,root}=fixture(t);fs.unlinkSync(path.join(root,'PAUSED'));assert.throws(()=>installProfile({root,config}),/PAUSED/);assert.equal(fs.existsSync(path.join(root,'pod')),false);fs.writeFileSync(path.join(root,'PAUSED'),'');
 fs.mkdirSync(path.join(base,'.git'));assert.throws(()=>installProfile({root,config}),/Git/);fs.rmdirSync(path.join(base,'.git'));
 const cloud=path.join(base,'OneDrive');fs.renameSync(root,cloud);assert.throws(()=>installProfile({root:cloud,config}),/cloud/);assert.equal(fs.existsSync(path.join(cloud,'pod')),false);
});
test('POD installer rolls back every failed write and remains retryable',t=>{
 const {root}=fixture(t);const before=fs.readdirSync(root).sort();
 for(let stop=1;stop<=5;stop++){
  let calls=0;const originals={};for(const key of ['writeFileSync','renameSync']){originals[key]=fs[key];fs[key]=(...args)=>{if(++calls===stop)throw new Error('injected write failure');return originals[key](...args);};}
  try{assert.throws(()=>installProfile({root,config}),/injected write failure/);}finally{Object.assign(fs,originals);}
  assert.deepEqual(fs.readdirSync(root).sort(),before);assert.equal(fs.readFileSync(path.join(root,'PAUSED'),'utf8'),'');
 }
 assert.equal(installProfile({root,config}).paused,true);assert.throws(()=>installProfile({root,config}),/already exists/);
});
test('POD installer preflights missing source before writing private state',t=>{
 const {root,base}=fixture(t),source=path.join(base,'source');fs.mkdirSync(path.join(source,'roles'),{recursive:true});fs.writeFileSync(path.join(source,'roles/gtm-engineer.md'),'role');
 assert.throws(()=>installProfile({root,config,source}),/ENOENT/);assert.equal(fs.existsSync(path.join(root,'pod')),false);assert.equal(fs.existsSync(path.join(root,'POD.md')),false);
 fs.writeFileSync(path.join(source,'PLAYBOOK.md'),'playbook');assert.equal(installProfile({root,config,source}).status,'installed');
});
test('POD installer rejects symlinked roots and preserves existing marker',t=>{
 const {root,base}=fixture(t),linked=path.join(base,'linked');fs.symlinkSync(root,linked,'junction');assert.throws(()=>installProfile({root:linked,config}),/symlink/i);assert.equal(fs.existsSync(path.join(root,'pod')),false);
 fs.writeFileSync(path.join(root,'POD.md'),'owner corrections');assert.throws(()=>installProfile({root,config}),/already exists/);assert.equal(fs.readFileSync(path.join(root,'POD.md'),'utf8'),'owner corrections');
});
