import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {plain, noLinks} from './storage.mjs';
import {mediaTool} from '../../skills/commerce-creative-studio/scripts/media.mjs';

export function findExecutable(name, env=process.env, platform=process.platform) {
  const suffixes=platform==='win32'?['.exe','.cmd','']:[''];
  for(const dir of (env.PATH||env.Path||'').split(platform==='win32'?';':path.delimiter).filter(Boolean)) {
    for(const suffix of suffixes){const p=path.join(dir,name+suffix);try{if(fs.statSync(p).isFile()){fs.accessSync(p,platform==='win32'?fs.constants.F_OK:fs.constants.X_OK);return path.resolve(p);}}catch{}}
  }
  return null;
}
function nodeEntry(exe,missing,pkgParts) {
  if(!exe)throw new Error(missing);
  if(/\.cmd$/i.test(exe)) {
    const js=path.join(path.dirname(exe),'node_modules',...pkgParts);
    if(!fs.existsSync(js))throw new Error('Unsupported Windows shim; use the official native executable or manual mode');
    return {command:process.execPath,prefix:[js]};
  }
  if(/\.bat$/i.test(exe))throw new Error('Batch launchers are not executed by the worker bridge');
  return {command:exe,prefix:[]};
}
export function claudeCommand(exe=findExecutable('claude')) {
  return nodeEntry(exe,'CLAUDE_UNAVAILABLE: use manual handoff or install/sign in to Claude Code separately',['@anthropic-ai','claude-code','cli.js']);
}
export function codexCommand(exe=findExecutable('codex')) {
  return nodeEntry(exe,'CODEX_UNAVAILABLE: use manual handoff or install/sign in to the Codex CLI separately',['@openai','codex','bin','codex.js']);
}
// Codex exposes no single "no tools" switch, so every tool feature is turned off one by one.
export const CODEX_DISABLED_FEATURES=['shell_tool','multi_agent','goals','image_generation','browser_use','computer_use','apps','plugins','in_app_browser','sleep_tool','view_image','tool_suggest','skill_search'];
export function runnerSpec(mode,home) {
  if(mode==='manual'||mode==='demo')return null;
  if(mode==='claude'){
    const {command,prefix}=claudeCommand();
    return {command,args:[...prefix,'-p','--output-format','json','--tools','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--setting-sources','','--no-session-persistence','--max-turns','1'],format:'claude',stdin:'prompt'};
  }
  if(mode==='codex'){
    const {command,prefix}=codexCommand();
    return {command,args:[...prefix,'exec','--sandbox','read-only','--skip-git-repo-check','--ephemeral','--ignore-user-config','--ignore-rules','--color','never','--json',...CODEX_DISABLED_FEATURES.flatMap(f=>['--disable',f]),'-c','web_search="disabled"','-'],format:'codex',stdin:'prompt'};
  }
  if(mode!=='external')throw new Error('Unknown runner');
  const file=noLinks(path.join(home,'runner.json'));if(!fs.existsSync(file))throw new Error('EXTERNAL_UNAVAILABLE: a trusted local operator must configure runner.json first');
  if(fs.statSync(file).size>20000)throw new Error('Runner config too large');
  const r=plain(JSON.parse(fs.readFileSync(file,'utf8')));
  if(r.schema!=='commerce-runner/1'||r.acknowledge_external_permissions!==true||!path.isAbsolute(r.command)||/\.(cmd|bat)$/i.test(r.command)||!fs.existsSync(r.command)||!Array.isArray(r.args)||r.args.some(x=>typeof x!=='string'||x.length>2000)||!['packet','prompt'].includes(r.stdin))throw new Error('Runner needs an existing absolute executable, literal argument array, stdin type and explicit permission acknowledgment');
  return {command:r.command,args:r.args,stdin:r.stdin,format:'protocol'};
}
export function capabilities(home) {
  let claude=false,codex=false,external=false;
  try{claude=!!runnerSpec('claude',home);}catch{}
  try{codex=!!runnerSpec('codex',home);}catch{}
  try{external=!!runnerSpec('external',home);}catch{}
  const ffmpeg=mediaTool('ffmpeg'),ffprobe=mediaTool('ffprobe');
  return {manual:true,claude,codex,external,ffmpeg:ffmpeg.supported,ffprobe:ffprobe.supported,media:{ffmpeg:ffmpeg.command,ffprobe:ffprobe.command,ffmpeg_reason:ffmpeg.reason,ffprobe_reason:ffprobe.reason},note:'Detection means installed, not authenticated. Built-in Claude and Codex receive supplied text only and have tools/MCP disabled. Media tools must support protocol_whitelist.'};
}
export function decodeOutput(out,format='protocol') {
  if(Buffer.byteLength(out)>1024*1024)throw new Error('Worker response too large');
  if(format==='codex'){
    let text=null;
    for(const line of out.split('\n')){
      if(!line.trim())continue;
      const e=JSON.parse(line);
      if(e.type==='turn.failed'||e.type==='error')throw new Error('Codex did not return a successful response');
      if(e.type==='item.completed'&&e.item?.type==='agent_message'&&typeof e.item.text==='string')text=e.item.text;
    }
    if(text===null)throw new Error('Codex returned no final message');
    return plain(JSON.parse(text.trim()),'Worker result');
  }
  let value=JSON.parse(out.trim());
  if(format==='claude'){
    if(value.is_error===true||typeof value.result!=='string')throw new Error('Claude did not return a successful response');
    value=JSON.parse(value.result.trim());
  }
  return plain(value,'Worker result');
}
export function execute(spec,packet,prompt,cwd,timeoutSeconds,{onChild=()=>{}}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(spec.command,spec.args,{cwd,stdio:['pipe','pipe','pipe'],shell:false,detached:process.platform!=='win32',windowsHide:true});
    onChild(child);let stdout='',count=0,reason=null,killTimer=null;
    const kill=()=>{
      if(!child.pid)return;
      if(process.platform==='win32'){
        const win=process.env.SystemRoot||'C:\\Windows';spawnSync(path.join(win,'System32','taskkill.exe'),['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore',timeout:5000});
      } else {try{process.kill(-child.pid,'SIGKILL');}catch{try{child.kill('SIGKILL');}catch{}}}
    };
    child.commerceStop=()=>{reason='Worker interrupted by owner or coordinator';kill();};
    const timer=setTimeout(()=>{reason='Worker exceeded the time limit; reconcile before retry';kill();killTimer=setTimeout(()=>reject(new Error(reason)),5000);killTimer.unref();},timeoutSeconds*1000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data',b=>{count+=Buffer.byteLength(b);if(count>1024*1024){reason='Worker output exceeded the allowed size';kill();}else stdout+=b.toString('utf8');});
    // Deliberately do not retain raw provider stderr, which may contain credentials or private data.
    child.stderr.on('data',()=>{});
    child.stdin.on('error',()=>{});
    child.once('error',()=>{reason='Worker could not start. Check the configured executable and login.';});
    child.once('close',code=>{clearTimeout(timer);clearTimeout(killTimer);if(reason||code!==0)return reject(new Error(reason||'Worker exited unsuccessfully; check its login/quota outside this app'));
      try{resolve(decodeOutput(stdout,spec.format));}catch{reject(new Error('Worker returned invalid JSON. Review the task; no next step was started.'));}});
    child.stdin.end(spec.stdin==='packet'?JSON.stringify(packet):prompt);
  });
}
