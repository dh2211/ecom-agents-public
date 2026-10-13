// Explicit operator-only recovery. Archives dead-owner locks, never resets business state.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {chooseHome,noLinks,id} from './storage.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export function recover(home,{acknowledge=false}={}) {
  if(!acknowledge)throw new Error('Stop all worker processes and rerun with --workers-stopped. This does not reset projects.');
  const root=chooseHome(repo,home),locks=[];
  for(const name of ['.server.lock','.transaction.lock']){
    const dir=noLinks(path.join(root,name));if(!fs.existsSync(dir))continue;
    const file=noLinks(path.join(dir,'owner.json'));if(!fs.existsSync(file))throw new Error('Lock has no owner record. Manual inspection required: '+dir);
    const owner=JSON.parse(fs.readFileSync(file,'utf8'));
    if(owner.host!==os.hostname()||!Number.isInteger(owner.pid)||owner.pid<=0)throw new Error('Cannot establish local lock ownership');
    let alive=true;try{process.kill(owner.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;else throw new Error('Cannot verify whether the lock owner is stopped');}
    if(alive)throw new Error('Owner process is still alive. Close the existing app instead.');locks.push({dir,name,token:owner.token});
  }
  const archived=[];
  for(const lock of locks){const current=JSON.parse(fs.readFileSync(path.join(lock.dir,'owner.json'),'utf8'));if(current.token!==lock.token)throw new Error('Lock ownership changed during recovery');
    const target=noLinks(path.join(root,'recovery',id('lock')+'-'+lock.name.slice(1)));fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.renameSync(lock.dir,target);archived.push(target);}
  return {archived,state_reset:false,note:'Restart the app. Previously running tasks become uncertain and need owner reconciliation.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const a=process.argv.slice(2);let home;for(let i=0;i<a.length;i++){if(a[i]==='--workers-stopped')continue;if(a[i]==='--home'&&a[i+1])home=a[++i];else throw new Error('Unknown recovery option');}
    console.log(JSON.stringify(recover(home,{acknowledge:a.includes('--workers-stopped')}),null,2));
  }catch(e){console.error('Recovery stopped: '+e.message);process.exitCode=1;}
}
