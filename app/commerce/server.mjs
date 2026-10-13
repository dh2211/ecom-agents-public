import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chooseHome,exclusive,text,atomic,noLinks} from './storage.mjs';
import {Engine,demoResult} from './engine.mjs';
import {runnerSpec,execute,capabilities} from './runner.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
export const REPO=path.resolve(HERE,'../..');
const MAX_BODY=80*1024*1024;
function body(req,max=MAX_BODY){return new Promise((resolve,reject)=>{let size=0,chunks=[];
  req.on('data',b=>{size+=b.length;if(size>max){reject(new Error('Request too large'));req.destroy();}else chunks.push(b);});
  req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(new Error('Invalid JSON'));}});req.on('error',reject);});}
const json=(res,value,status=200,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(value));};
export async function start({home,port=0,repo=REPO,open=false}={}) {
  const root=chooseHome(repo,home),owner=exclusive(root,'.server.lock');let engine;
  try{engine=new Engine(root,repo);engine.recoverInterrupted();}catch(e){owner.release();throw e;}
  const token=crypto.randomBytes(32).toString('hex'),active=new Map(); let origin,closing=false;
  async function dispatch(rid){
    if(closing||active.size)throw new Error('A worker is already running; finish it before dispatching another');
    const s=engine.store.read(),r=s.runs.find(x=>x.id===rid);if(!r)throw new Error('Project not found');
    const j=r.jobs.find(x=>x.state==='ready');if(!j)throw new Error('No ready task');
    const mode=r.demo?'demo':s.settings.role_runners[j.role]||s.settings.runner;
    const spec=runnerSpec(mode,root); // Fail before claiming when the executable is missing.
    const task=engine.prepare(rid);
    // prepare() runs advance() and can promote an earlier waiting job, so the
    // claimed attempt may not be the job this function scanned. Never execute
    // an attempt under a runner spec resolved for a different role.
    if(task.runner!==mode){engine.interrupt(rid,task.packet.job_id,'Runner resolution changed during dispatch');throw new Error('Runner resolution changed during dispatch; reconcile the task');}
    if(task.runner==='manual')return {status:'awaiting-result',job_id:task.packet.job_id};
    active.set(rid,{child:null,job:task.packet.job_id});
    const work=task.runner==='demo'?Promise.resolve(demoResult(task.packet)):execute(spec,task.packet,task.prompt,path.join(root,'runs',rid,task.packet.job_id,task.packet.attempt_id),task.timeout_seconds,{onChild:c=>active.get(rid).child=c});
    work.then(result=>{try{engine.submit(rid,task.packet.job_id,result);}catch(e){engine.interrupt(rid,task.packet.job_id,'Result could not be accepted: '+e.message);}})
      .catch(e=>engine.interrupt(rid,task.packet.job_id,e.message)).finally(()=>active.delete(rid));
    return {status:'running',job_id:task.packet.job_id};
  }
  const server=http.createServer(async(req,res)=>{
    try{
      // Exact host and origin checks protect the localhost service from DNS rebinding/CSRF.
      if(req.headers.host!==new URL(origin).host)return json(res,{error:'Host not allowed'},403);
      if(req.headers.origin&&req.headers.origin!==origin)return json(res,{error:'Cross-origin requests are blocked'},403);
      const url=new URL(req.url,origin),p=url.pathname;
      if(p.startsWith('/api/')){
        const supplied=req.headers['x-commerce-token'];
        if(typeof supplied!=='string'||! /^[a-f0-9]{64}$/.test(supplied)||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(token)))return json(res,{error:'Open the private link shown in the terminal again'},401);
        if(req.method==='GET'&&p==='/api/state'){
          // Keep ledger integrity and capability checks even when the browser has current data.
          const state=engine.store.read(),available=capabilities(root),stat=fs.statSync(path.join(root,'commerce.json'),{bigint:true});
          const fingerprint=JSON.stringify([state.revision,...[stat.ino,stat.size,stat.mtimeNs,stat.ctimeNs].map(String),available]);
          const etag='W/"'+crypto.createHash('sha256').update(fingerprint).digest('hex')+'"';
          if(req.headers['if-none-match']?.split(',').some(tag=>tag.trim()===etag)){
            res.writeHead(304,{'ETag':etag,'Cache-Control':'no-store'});return res.end();
          }
          return json(res,{...engine.snapshot(state),capabilities:available},200,{'ETag':etag});
        }
        if(req.method==='GET'&&p==='/api/audit')return json(res,engine.audit());
        if(req.method==='GET'&&p==='/api/file')return json(res,{content:engine.readFile(url.searchParams.get('run'),url.searchParams.get('job'),url.searchParams.get('kind'))});
        if(req.method!=='POST')return json(res,{error:'Not found'},404);
        if(!(req.headers['content-type']||'').startsWith('application/json'))return json(res,{error:'Use JSON'},415);
        const b=await body(req);
        if(p==='/api/create')return json(res,engine.create(b));
        if(p==='/api/settings')return json(res,engine.settings(b));
        if(p==='/api/dispatch')return json(res,await dispatch(b.run));
        if(p==='/api/submit')return json(res,engine.submit(b.run,b.job,b.result));
        if(p==='/api/review'){
          const job=engine.review(b.run,b.job,b);const r=engine.snapshot().runs.find(x=>x.id===b.run);
          if(b.approved&&r.auto&&r.can_dispatch){
            // Auto-advance is opt-in. Never automatically retry a held/uncertain job.
            try{await dispatch(r.id);}catch{/* Ready state remains visible; the owner can dispatch manually. */}
          }
          return json(res,job);
        }
        if(p==='/api/retry')return json(res,engine.retry(b.run,b.job,b));
        if(p==='/api/pause')return json(res,engine.pause(b.run,b.paused));
        if(p==='/api/cancel'){const c=active.get(b.run)?.child;if(c)c.commerceStop();return json(res,engine.cancel(b.run));}
        if(p==='/api/upload')return json(res,engine.upload(b.run,b));
        return json(res,{error:'Not found'},404);
      }
      if(req.method!=='GET')return json(res,{error:'Not allowed'},405);
      const staticFiles={'/':'public/index.html','/app.js':'public/app.js','/style.css':'public/style.css'};
      let file=staticFiles[p]?path.join(HERE,staticFiles[p]):p==='/guide'?path.join(repo,'docs','COMMERCE-GUIDE.vi.html'):null;
      if(!file)return json(res,{error:'Not found'},404);
      const ext=path.extname(file),type=ext==='.js'?'text/javascript':ext==='.css'?'text/css':'text/html';
      res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
        'Content-Security-Policy':p==='/guide'?"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'; base-uri 'none'":"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
      res.end(fs.readFileSync(file));
    }catch(e){if(!res.headersSent)json(res,{error:e.message},400);else res.end();}
  });
  server.requestTimeout=30000;server.headersTimeout=10000;
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}
  catch(e){owner.release();throw e;}
  origin='http://127.0.0.1:'+server.address().port;
  const link=origin+'/#token='+token;
  const close=async()=>{
    closing=true;
    for(const v of active.values())if(v.child)v.child.commerceStop();
    // Do not release the workspace to a new coordinator while a child may still be running.
    const deadline=Date.now()+7000;while(active.size&&Date.now()<deadline)await new Promise(r=>setTimeout(r,30));
    await new Promise(r=>server.close(r));
    if(!active.size)owner.release();
  };
  if(open)openBrowser(link);
  return {server,engine,token,origin,link,home:root,close};
}
function openBrowser(link){
  let command,args;
  if(process.platform==='win32'){command=path.join(process.env.SystemRoot||'C:\\Windows','System32','rundll32.exe');args=['url.dll,FileProtocolHandler',link];}
  else if(process.platform==='darwin'){command='open';args=[link];}else{command='xdg-open';args=[link];}
  const c=spawn(command,args,{shell:false,stdio:'ignore',detached:true});c.on('error',()=>{});c.unref();
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const flags=process.argv.slice(2);let home,port=0;let shouldOpen=!flags.includes('--no-open');
  try{
    for(let i=0;i<flags.length;i++){
      if(flags[i]==='--no-open')continue;
      if(flags[i]==='--home'){home=text(flags[++i],'Workspace path',2000);continue;}
      if(flags[i]==='--port'){port=Number(flags[++i]);if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid port');continue;}
      throw new Error('Unknown argument: '+flags[i]);
    }
    const app=await start({home,port,open:shouldOpen});
    console.log('\nEcom Agents Commerce\nPrivate workspace: '+app.home+'\nOpen: '+app.link+'\nKeep this terminal open. Ctrl+C stops the coordinator.\n');
    let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;await app.close();process.exit(0);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
  }catch(e){console.error('Commerce could not start: '+e.message+'\nNo existing project was deleted. See docs/COMMERCE-GUIDE.vi.html.');process.exitCode=1;}
}
