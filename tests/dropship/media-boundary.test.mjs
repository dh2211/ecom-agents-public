import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawnSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';

const media=new URL('../../skills/commerce-creative-studio/scripts/media.mjs',import.meta.url).href;
test('unsupported protocol protection never triggers an unrestricted retry',()=>{
  // Patch the process boundary in an isolated child, not the module under test.
  // A second call would succeed, reproducing the unsafe legacy fallback.
  const source=`import cp from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
let calls=0;
cp.spawnSync=()=>++calls===1?{status:1,stderr:"Unrecognized option 'protocol_whitelist'"}:{status:0,stdout:'{"streams":[],"format":{}}'};
syncBuiltinESMExports();
const {probe}=await import(${JSON.stringify(media)});
try{probe('fixture.png');}catch(e){console.log(JSON.stringify({calls,error:e.message}));}`;
  const r=spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const result=JSON.parse(r.stdout);
  assert.equal(result.calls,1,'Do not drop protocol protection and retry');
  assert.match(result.error,/protocol_whitelist/);
});

test('local playlist cannot make ffprobe fetch a loopback segment',async t=>{
  const available=spawnSync('ffprobe',['-version'],{stdio:'ignore'});
  if(available.error?.code==='ENOENT'){t.skip('ffprobe unavailable; isolated protection test still runs');return;}
  assert.equal(available.status,0);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'media-network-boundary-'));
  let requests=0;
  const server=http.createServer((req,res)=>{requests++;res.writeHead(404);res.end();});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const input=path.join(dir,'untrusted.mp4');
    fs.writeFileSync(input,`#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nhttp://127.0.0.1:${server.address().port}/segment.ts\n#EXT-X-ENDLIST\n`);
    const source=`import {probe} from ${JSON.stringify(media)};try{probe(process.argv[1]);process.exitCode=9;}catch{console.log('held');}`;
    const result=await promisify(execFile)(process.execPath,['--input-type=module','-e',source,input],{timeout:10000});
    assert.equal(result.stdout.trim(),'held');assert.equal(requests,0);
  } finally {await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
});
