import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const repo=fileURLToPath(new URL('../../',import.meta.url));
test('installer help advertises the reviewed source checkout, not an unrelated npm package',()=>{
  const r=spawnSync(process.execPath,[path.join(repo,'installer/cli.mjs'),'hire','--help'],{encoding:'utf8'});
  assert.equal(r.status,0);assert.match(r.stdout,/node installer\/cli\.mjs hire/);assert.doesNotMatch(r.stdout,/npx ecom-agents/);
});
test('kit update instructions only read the canonical source distribution',()=>{
  for(const slug of fs.readdirSync(path.join(repo,'agents'))) {
    const root=path.join(repo,'agents',slug);if(!fs.statSync(root).isDirectory())continue;
    const contract=fs.readFileSync(path.join(root,'CONTRACT.md'),'utf8');
    assert.doesNotMatch(contract,/npx ecom-agents/,slug);
    for(const routine of fs.readdirSync(path.join(root,'routines'))) {
      const body=fs.readFileSync(path.join(root,'routines',routine,'SKILL.md'),'utf8');
      assert.doesNotMatch(body,/npx ecom-agents|(?:npm\/|unpkg\.com\/)ecom-agents@/,slug+'/'+routine);
    }
  }
});
