#!/usr/bin/env node
// Explicit operator installation only. Never invoked by a scheduled routine.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateConfig,ROLES} from '../skills/dropship-workbench/scripts/ops.mjs';
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const MARK='<!-- DROPSHIP PROFILE v1 -->';
const HOOK='\n'+MARK+'\nAfter the normal cheap guard returns run, and before business work, read DROPSHIP.md if present. Follow its draft-only restrictions and the matching role in dropship/PLAYBOOK.md. Keep the original routine id, schedule, state, writer boundaries and deliverable. A missing referenced profile file is a blocker, not permission to ignore the profile.\n';
export function addHook(input) {
  if(input.includes(MARK))return input;
  const start=input.startsWith('---') ? input.indexOf('\n---',3) : -1;
  const cut=start>=0 ? input.indexOf('\n',start+1)+1 : 0;
  if(start>=0&&cut<=0)throw new Error('Malformed frontmatter');
  return input.slice(0,cut)+HOOK+input.slice(cut);
}
function safeRoot(root) {
  const absolute=path.resolve(root);let cursor=path.parse(absolute).root;
  for(const p of absolute.slice(cursor.length).split(path.sep).filter(Boolean)){
    cursor=path.join(cursor,p);
    if(fs.lstatSync(cursor).isSymbolicLink())throw new Error('Profile root cannot contain symlinks');
    if(fs.existsSync(path.join(cursor,'.git')))throw new Error('Use a private installed kit outside a Git checkout, not source agents/');
  }
  if(/onedrive|dropbox|icloud|google ?drive/i.test(absolute))throw new Error('Use a local folder outside cloud sync');
  return absolute;
}
export function installDropship({root,config,apply=false,source=REPO}) {
  validateConfig(config);root=safeRoot(root);
  for(const f of ['POD.md','pod','DROPSHIP.md','dropship'])if(fs.existsSync(path.join(root,f)))throw new Error('An operating profile already exists; hire a separate kit per business model');
  const paused=path.join(root,'PAUSED');
  if(!fs.existsSync(paused)||fs.readFileSync(paused,'utf8').replace(/^\uFEFF/,'').trim())throw new Error('Create an empty PAUSED file first; stop the scheduler and any running process');
  if(!fs.existsSync(path.join(root,'scripts','run-routine.mjs')))throw new Error('Install the hardened kit from this fork first');
  const manifestFile=['agent.json','employee.json'].find(f=>fs.existsSync(path.join(root,f)))||'agent.json';
  const manifest=JSON.parse(fs.readFileSync(path.join(root,manifestFile),'utf8'));
  if(!ROLES.includes(String(manifest.slug).replace(/-employee$/,'-agent'))||!Array.isArray(manifest.routines)||!manifest.routines.length)throw new Error('Unsupported agent manifest');
  if(new Set(manifest.routines.map(r=>r.id)).size!==manifest.routines.length)throw new Error('Duplicate routine id');
  const edits=new Map(),original=new Map();
  const capture=(rel)=>{
    const f=path.join(root,rel);
    let cursor=root;
    for(const p of rel.split('/')){cursor=path.join(cursor,p);if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())throw new Error('Symlink in installed kit');}
    const v=fs.existsSync(f)?fs.readFileSync(f):null;original.set(rel,v);return v?.toString('utf8')||'';
  };
  for(const rel of ['AGENTS.md',...manifest.routines.map(r=>{
    if(!/^[a-z][a-z0-9-]+$/.test(r.id||''))throw new Error('Unsafe routine id');return 'routines/'+r.id+'/SKILL.md';
  })]){
    const s=capture(rel);if(!s)throw new Error('Missing '+rel);
    if(rel.startsWith('routines/')&&!s.includes('name: '+rel.split('/')[1]))throw new Error('Routine name mismatch');
    edits.set(rel,addHook(s));
  }
  capture(manifestFile);manifest.files ||= {};manifest.files.member ||= [];
  for(const p of ['DROPSHIP.md','dropship/**'])if(!manifest.files.member.includes(p))manifest.files.member.push(p);
  edits.set(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  const ignore=capture('.gitignore');edits.set('.gitignore',ignore+'\n# Private Dropship operating data\n/dropship/\n/DROPSHIP.md\n');
  for(const f of ['profiles/dropship-ecommerce/PLAYBOOK.md','skills/dropship-workbench/SKILL.md','skills/commerce-creative-studio/SKILL.md'])if(!fs.existsSync(path.join(source,f)))throw new Error('Missing profile source '+f);
  if(!apply)return{status:'plan',role:manifest.slug,routines:manifest.routines.length,files:[...edits.keys()],schedule_registered:false};
  const dir=path.join(root,'dropship');fs.mkdirSync(dir,{mode:0o700});
  const applied=[];
  try{
    for(const [rel,b] of original)if(b){const f=path.join(dir,'backups',rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,b,{flag:'wx'});}
    fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600});
    fs.copyFileSync(path.join(source,'profiles/dropship-ecommerce/PLAYBOOK.md'),path.join(dir,'PLAYBOOK.md'));
    for(const name of ['dropship-workbench','commerce-creative-studio'])fs.cpSync(path.join(source,'skills',name),path.join(dir,'skills',name),{recursive:true,errorOnExist:true,force:false});
    for(const [rel,s] of edits){fs.writeFileSync(path.join(root,rel),s);applied.push(rel);}
    fs.writeFileSync(path.join(root,'DROPSHIP.md'),'# Dropship profile\n\nRead dropship/config.json and dropship/PLAYBOOK.md after the guard passes.\nWork locally in draft-only mode. Never change the store, spend, send, fulfill, refund or publish.\nUse the copied skills in dropship/skills/ when needed; never install them globally.\nProfile backups live in dropship/backups/. PAUSED remains set until the owner resumes.\n\n## Corrections\n\nOnly the owner writes corrections here.\n',{flag:'wx'});
    return{status:'installed',role:manifest.slug,routines:manifest.routines.length,mode:'draft-only',paused:true,schedule_registered:false};
  }catch(e){
    for(const rel of applied){const b=original.get(rel);if(b)fs.writeFileSync(path.join(root,rel),b);else fs.rmSync(path.join(root,rel),{force:true});}
    fs.rmSync(dir,{recursive:true,force:true});throw e;
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const a=process.argv.slice(2);if(![4,5].includes(a.length)||a[0]!=='--root'||a[2]!=='--config'||(a.length===5&&a[4]!=='--apply'))throw new Error('Usage: dropship-profile.mjs --root PRIVATE_KIT --config PRIVATE_CONFIG.json [--apply]');
    console.log(JSON.stringify(installDropship({root:a[1],config:JSON.parse(fs.readFileSync(a[3],'utf8')),apply:a[4]==='--apply'}),null,2));
  }catch(e){console.error('dropship-profile: '+e.message);process.exitCode=1;}
}
