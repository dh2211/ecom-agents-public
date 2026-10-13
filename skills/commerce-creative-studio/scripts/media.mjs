// Local media only. No shell, downloads, cloud renders or account mutations.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

export function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function resolveExecutable(name, env=process.env, platform=process.platform) {
  const suffixes=platform==='win32'?['.exe','.cmd','']:[''];
  const pathKey=platform==='win32'?(env.PATH||env.Path||''):(env.PATH||'');
  for(const dir of pathKey.split(platform==='win32'?';':path.delimiter).filter(Boolean)) {
    for(const suffix of suffixes) {
      const candidate=path.join(dir,name+suffix);
      try {
        if(fs.statSync(candidate).isFile()) {
          fs.accessSync(candidate,platform==='win32'?fs.constants.F_OK:fs.constants.X_OK);
          return path.resolve(candidate);
        }
      } catch {}
    }
  }
  return null;
}
const supportCache=new Map();
function commandFor(name, resolved) {
  return resolved && !/\.(cmd|bat)$/i.test(resolved) ? resolved : name;
}
export function mediaTool(name) {
  const resolved=resolveExecutable(name);
  if(!resolved) return {command:null,supported:false,reason:name+' is unavailable; install it separately or use the manual workflow'};
  const st=fs.statSync(resolved),key=resolved+'\0'+st.mtimeMs+'\0'+st.size;
  const hit=supportCache.get(key);
  if(hit) return hit;
  const command=commandFor(name, resolved);
  const probe=spawnSync(command,['-hide_banner','-protocol_whitelist','file,pipe','-version'],{encoding:'utf8',shell:false,timeout:15000,windowsHide:true});
  let value;
  if(probe.error?.code==='ENOENT') value={command:resolved,supported:false,reason:resolved+' is unavailable; install it separately or use the manual workflow'};
  else if(probe.status!==0 && /Unrecognized option ['"]?protocol_whitelist/i.test(probe.stderr||'')) value={command:resolved,supported:false,reason:resolved+' does not support protocol_whitelist; use a compatible FFmpeg/ffprobe build. No unrestricted retry was attempted.'};
  else if(probe.status!==0) value={command:resolved,supported:false,reason:resolved+' failed a local protocol check: '+(probe.stderr||probe.error?.message||'non-zero exit').slice(-400)};
  else value={command:resolved,supported:true,reason:null};
  supportCache.set(key,value);
  return value;
}
export function localFile(root, relative) {
  if(typeof relative!=='string' || !relative || /[\\:\x00-\x1f]/.test(relative) || path.posix.isAbsolute(relative) || relative.split('/').some(x=>x==='..'||x==='.'||!x)) throw new Error('Asset paths must be relative slash-separated paths without traversal');
  const base=fs.realpathSync(root); let p=base;
  for(const part of relative.split('/')) { p=path.join(p,part); if(fs.lstatSync(p).isSymbolicLink())throw new Error('Symlink assets are not allowed'); }
  if(!fs.statSync(p).isFile())throw new Error('Asset is not a file');
  if(fs.statSync(p).size>512*1024*1024)throw new Error('Asset exceeds local 512 MiB limit');
  return p;
}
function run(exe,args,options={}) {
  const resolved=resolveExecutable(exe);
  const command=commandFor(exe, resolved);
  const shown=resolved||exe;
  const r=spawnSync(command,args,{encoding:'utf8',shell:false,timeout:180000,maxBuffer:2*1024*1024,...options});
  // Local containers may reference remote resources. Protection is mandatory.
  if(r.status!==0 && args.includes('-protocol_whitelist') && /Unrecognized option ['"]?protocol_whitelist/i.test(r.stderr||'')) {
    throw new Error(shown+' does not support protocol_whitelist; use a compatible FFmpeg/ffprobe build. No unrestricted retry was attempted.');
  }
  if(r.error?.code==='ENOENT')throw new Error(shown+' is unavailable; install it separately or use the manual workflow');
  if(r.status!==0)throw new Error(shown+' failed: '+(r.error?.message || r.stderr || 'non-zero exit').slice(-1200));
  return r.stdout;
}
export function probe(file) {
  if(!/\.(png|jpe?g|mp4|mov|wav|mp3|m4a)$/i.test(file))throw new Error('Unsupported local media type');
  const j=JSON.parse(run('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',file]));
  const v=j.streams?.find(s=>s.codec_type==='video'), a=j.streams?.find(s=>s.codec_type==='audio');
  return {width:v?.width??null,height:v?.height??null,duration_s:Number(j.format?.duration)||null,has_audio:!!a,container_name:j.format?.format_name??null,video_codec:v?.codec_name??null,bytes:fs.statSync(file).size,sha256:sha256(file)};
}
export function verifyAsset(root,asset) {
  if(!/^[a-f0-9]{64}$/.test(asset?.sha256||''))throw new Error('Asset needs a SHA256 hash');
  const file=localFile(root,asset.file);
  if(sha256(file)!==asset.sha256)throw new Error('Asset changed since approval: '+asset.file);
  return file;
}
export function assemble({root,assets,timeline,output}) {
  if(!timeline || !Array.isArray(timeline.shots) || !timeline.shots.length || timeline.shots.length>12)throw new Error('Timeline needs 1..12 shots');
  if(![15,30,45].includes(timeline.target_seconds))throw new Error('Use a 15, 30 or 45 second working cut');
  const map=new Map(assets.map(a=>[a.file,a]));
  const shots=timeline.shots.map(s=>{
    const a=map.get(s.file); if(!a)throw new Error('Shot is not in the approved asset register');
    const file=verifyAsset(root,a), info=probe(file);
    if(!/\.(mp4|mov)$/i.test(file) || !info.width || !info.duration_s)throw new Error('Shots must be actual local video');
    if(!Number.isFinite(s.start_s)||!Number.isFinite(s.duration_s)||s.start_s<0||s.duration_s<=0||s.start_s+s.duration_s>info.duration_s+0.05)throw new Error('Shot timing exceeds source');
    return {...s,file};
  });
  const seconds=shots.reduce((n,s)=>n+s.duration_s,0);
  if(Math.abs(seconds-timeline.target_seconds)>0.05)throw new Error('Shot durations must sum to target_seconds');
  let voice=null;
  if(timeline.voiceover_file) {
    const a=map.get(timeline.voiceover_file); if(!a)throw new Error('Voiceover is not in asset register');
    voice=verifyAsset(root,a); const info=probe(voice);
    if(!info.has_audio || !info.duration_s || info.duration_s>seconds+0.1)throw new Error('Voiceover must contain audio and fit the full cut');
  }
  const ffmpegTool=mediaTool('ffmpeg');
  if(!ffmpegTool.supported)throw new Error(ffmpegTool.reason);
  const parent=path.resolve(path.dirname(output));
  fs.mkdirSync(parent,{recursive:true});
  if(fs.existsSync(output))throw new Error('Output exists; use a new revision folder');
  const temp=fs.mkdtempSync(path.join(parent,'.ugc-build-'));
  try {
    for(let i=0;i<shots.length;i++) {
      const s=shots[i];
      run('ffmpeg',['-nostdin','-v','error','-protocol_whitelist','file,pipe','-ss',String(s.start_s),'-i',s.file,'-t',String(s.duration_s),'-map','0:v:0','-an','-vf','scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',path.join(temp,'part-'+i+'.mp4')]);
    }
    fs.writeFileSync(path.join(temp,'parts.txt'),shots.map((_,i)=>"file 'part-"+i+".mp4'").join('\n')+'\n');
    run('ffmpeg',['-nostdin','-v','error','-f','concat','-safe','1','-protocol_whitelist','file,pipe','-i','parts.txt','-c','copy','joined.mp4'],{cwd:temp});
    const args=['-nostdin','-v','error','-protocol_whitelist','file,pipe','-i','joined.mp4'];
    if(voice)args.push('-protocol_whitelist','file,pipe','-i',voice,'-map','0:v:0','-map','1:a:0','-af','apad','-c:a','aac','-b:a','192k');
    else args.push('-an');
    args.push('-c:v','copy','-t',String(seconds),'-movflags','+faststart','draft.mp4');
    run('ffmpeg',args,{cwd:temp});
    const info=probe(path.join(temp,'draft.mp4'));
    if(info.width!==1080||info.height!==1920||Math.abs(info.duration_s-seconds)>0.2)throw new Error('Rendered media failed measured output checks');
    fs.mkdirSync(output); // Refuses an existing revision, including a concurrent creator.
    fs.copyFileSync(path.join(temp,'draft.mp4'),path.join(output,'draft.mp4'),fs.constants.COPYFILE_EXCL);
    const result={schema:'creative-render/1',status:'draft-needs-human-review',...info,captions_burned_in:false,disclosures_burned_in:false,remote_mutation_allowed:false};
    fs.writeFileSync(path.join(output,'render.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    return result;
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
}
