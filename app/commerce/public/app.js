'use strict';
const $=s=>document.querySelector(s);
const fragment=new URLSearchParams(location.hash.slice(1));
const token=fragment.get('token')||sessionStorage.getItem('commerce-token');
if(token)sessionStorage.setItem('commerce-token',token);
history.replaceState(null,'',location.pathname);
let state=null,selected=null,lastRevision=-1,requestKey=crypto.randomUUID();
let stateTag=null,stateResponse=null,refreshQueue=Promise.resolve(),pendingRefreshes=0;
// Drafts stay in this page only and belong to one immutable job attempt.
const drafts=new Map();
const draftKey=(r,j,kind)=>JSON.stringify([r.id,j.id,j.current,kind]);
function draftField(input,key,field){input.value=drafts.get(key)?.[field]||'';input.addEventListener('input',()=>{const draft=drafts.get(key)||{};draft[field]=input.value;drafts.set(key,draft);});}
const labels={waiting:'Chờ bước trước',ready:'Sẵn sàng giao',running:'Đang làm','awaiting-result':'Chờ kết quả từ trợ lý',review:'Cần bạn duyệt',succeeded:'Đã duyệt',hold:'Cần bổ sung',failed:'Có lỗi',uncertain:'Cần đối chiếu lần chạy',cancelled:'Đã dừng',paused:'Tạm dừng',completed:'Hoàn tất bộ bàn giao'};
const node=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n;};
function toast(t){$('#toast').textContent=t;$('#toast').classList.remove('hidden');setTimeout(()=>$('#toast').classList.add('hidden'),4000);}
function error(e){$('#error').textContent='Chưa thực hiện được: '+String(e.message||e)+'\nDữ liệu cũ vẫn được giữ. Xem mục Xử lý lỗi trong hướng dẫn.';$('#error').classList.remove('hidden');}
async function api(url,data){const isState=url==='state'&&!data,headers={'X-Commerce-Token':token||'','Content-Type':'application/json'};if(isState&&stateTag)headers['If-None-Match']=stateTag;const r=await fetch('/api/'+url,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined});if(isState&&r.status===304&&stateResponse)return stateResponse;const v=await r.json();if(!r.ok)throw new Error(v.error||'Không nhận được dữ liệu');if(isState){stateTag=r.headers.get('ETag');stateResponse=v;}return v;}
async function action(url,data,onSuccess){try{$('#error').classList.add('hidden');await api(url,data);if(onSuccess)onSuccess();await refresh(true);}catch(e){await refresh(true);error(e);}}
function button(t,fn,cls){const b=node('button',t,cls);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){error(e);}finally{b.disabled=false;}};return b;}
const badge=(t,k)=>node('span',t,'badge '+(k||''));
async function copy(t){try{await navigator.clipboard.writeText(t);toast('Đã sao chép.');}catch{const a=node('textarea',t);document.body.append(a);a.select();const ok=document.execCommand('copy');a.remove();toast(ok?'Đã sao chép.':'Không sao chép được; hãy tải request.json.');}}
function download(name,content){const a=node('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function fillWorkflows(){const model=$('#create-form').elements.model.value,box=$('#workflow'),old=box.value;box.replaceChildren();for(const w of state.workflows.filter(w=>w.model==='either'||w.model===model)){const o=node('option',w.title);o.value=w.id;box.append(o);}if([...box.options].some(o=>o.value===old))box.value=old;}
function renderSettings(){const root=$('#settings-form');root.replaceChildren();const form=node('form'),l=node('label','Chế độ mặc định'),select=node('select');
for(const [id,t] of [['manual','Tự giao cho Hermes / Codex / trợ lý của bạn'],['claude','Claude Code: soạn từ dữ liệu đã có'],['codex','ChatGPT (Codex CLI): soạn từ dữ liệu đã có'],['external','Worker riêng: cần cấu hình kỹ thuật']]){const o=node('option',t);o.value=id;if(id!=='manual'&&!state.capabilities[id])o.disabled=true;select.append(o);}select.value=state.settings.runner;l.append(select);form.append(l);
const lab=node('label','Giới hạn mỗi lần chạy (giây)'),timeout=node('input');timeout.type='number';timeout.min=10;timeout.max=1800;timeout.value=state.settings.timeout_seconds;lab.append(timeout);form.append(lab);
const routing=node('details');routing.append(node('summary','Chọn trợ lý riêng cho từng vai trò'));const routes={};
for(const [id,title] of Object.entries(state.roles)){const label=node('label',title),sel=select.cloneNode(true),opt=node('option','Theo mặc định');opt.value='';sel.prepend(opt);sel.value=state.settings.role_runners[id]||'';label.append(sel);routing.append(label);routes[id]=sel;}form.append(routing);
const ack=node('label',null,'checks'),check=node('input');check.type='checkbox';ack.append(check,node('span','Tôi đồng ý sử dụng hạn mức/chi phí AI và đã kiểm tra quyền công cụ.'));form.append(ack);
form.append(button('Lưu lựa chọn',()=>{const role_runners={};for(const [k,v] of Object.entries(routes))if(v.value)role_runners[k]=v.value;return action('settings',{runner:select.value,timeout_seconds:Number(timeout.value),role_runners,cost_acknowledged:check.checked});},'primary'));
form.append(node('p','Claude tích hợp không đọc web, sinh ảnh/video hay ghi store. Chế độ thủ công giữ nguyên trợ lý bạn đang dùng. Worker riêng cần người kỹ thuật cấu hình trước.','subtle'));
const mediaWarnings=[state.capabilities.media?.ffmpeg_reason,state.capabilities.media?.ffprobe_reason].filter(reason=>reason&&/protocol_whitelist|protocol check/.test(reason));
if(mediaWarnings.length)form.append(node('p','Dựng video cục bộ chưa dùng được: '+mediaWarnings.join(' '),'notice'));
root.append(form);}
function renderProjects(){const box=$('#projects');box.replaceChildren();if(!state.runs.length){box.append(node('p','Chưa có công việc.','subtle'));return;}
for(const r of [...state.runs].reverse()){const b=button('',()=>{selected=r.id;renderProjects();renderDetail();});b.className='project'+(selected===r.id?' selected':'');b.append(node('strong',r.title),badge(labels[r.status]||r.status,r.status));if(r.demo)b.append(badge('DEMO','demo'));b.append(node('div',r.store_id+' · '+r.model.toUpperCase()+' · '+r.jobs.filter(j=>j.state==='succeeded').length+'/'+r.jobs.length+' bước','subtle'));box.append(b);}}
function reviewForm(r,j){const key=draftKey(r,j,'review'),d=node('details');d.open=drafts.has(key);d.append(node('summary','Duyệt hoặc yêu cầu sửa'));const who=node('input');who.placeholder='Tên người duyệt';draftField(who,key,'reviewer');who.setAttribute('aria-label','Tên người duyệt');const note=node('textarea');note.placeholder='Ghi điều đã kiểm tra hoặc cần sửa';draftField(note,key,'note');note.setAttribute('aria-label','Ghi chú duyệt');d.append(who,note);
const send=approved=>{if(!who.value.trim()||!note.value.trim())throw new Error('Điền tên và ghi chú trước khi duyệt.');return action('review',{run:r.id,job:j.id,digest:j.result.digest,approved,reviewer:who.value,note:note.value},()=>drafts.delete(key));};
d.append(button('Đã kiểm tra, duyệt bước này',()=>send(true),'primary'),button('Yêu cầu sửa',()=>send(false),'danger'),node('p','Duyệt chỉ chuyển bước trong dự án, không cho phép đăng sản phẩm hay chi tiền.','subtle'));return d;}
function manualForm(r,j){const key=draftKey(r,j,'result'),d=node('details');d.open=true;d.append(node('summary','Gửi việc cho trợ lý của bạn'),node('p','1. Sao chép yêu cầu, dán vào trợ lý. 2. Yêu cầu trả đúng JSON. 3. Dán kết quả vào ô dưới để bộ điều phối kiểm tra.','subtle'));
d.append(button('Sao chép yêu cầu',async()=>copy((await api('file?run='+r.id+'&job='+j.id+'&kind=task')).content)),button('Tải request.json',async()=>download('request.json',(await api('file?run='+r.id+'&job='+j.id+'&kind=packet')).content)));
const input=node('textarea');draftField(input,key,'json');input.rows=6;input.placeholder='Dán JSON do trợ lý trả về; không cần tự viết code.';input.setAttribute('aria-label','Kết quả từ trợ lý');d.append(input,button('Kiểm tra và nhận kết quả',()=>{let t=input.value.trim();if(t.startsWith('```'))t=t.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');let result;try{result=JSON.parse(t);}catch{throw new Error('Kết quả chưa phải JSON hợp lệ. Yêu cầu trợ lý dùng đúng mẫu trong TASK.md.');}return action('submit',{run:r.id,job:j.id,result},()=>drafts.delete(key));},'primary'));return d;}
function renderDetail(){const box=$('#detail'),r=state.runs.find(x=>x.id===selected);if(!r)return;box.replaceChildren();box.append(node('h2',r.title),badge(r.model.toUpperCase()),badge(labels[r.status]||r.status,r.status));if(r.demo)box.append(badge('MÔ PHỎNG: KHÔNG PHẢI KẾT QUẢ KINH DOANH','demo'));
box.append(node('p',r.store_id+' · '+r.market+' · '+r.currency+' · '+r.timezone,'subtle'));const progress=node('progress');progress.max=r.jobs.length;progress.value=r.jobs.filter(j=>j.state==='succeeded').length;progress.setAttribute('aria-label','Tiến độ duyệt');box.append(progress);
const actions=node('div',null,'actions');if(!r.cancelled){if(r.can_dispatch)actions.append(button('Giao bước tiếp theo',()=>action('dispatch',{run:r.id}),'primary'));actions.append(button(r.paused?'Tiếp tục':'Tạm dừng giao việc',()=>action('pause',{run:r.id,paused:!r.paused})),button('Dừng dự án',()=>{if(confirm('Dừng các việc chưa xong? Kết quả cũ vẫn được giữ.'))return action('cancel',{run:r.id});},'danger'));}box.append(actions);
if(r.paused)box.append(node('p','Đã dừng giao việc mới. Worker đang làm, nếu có, được phép trả kết quả.','notice'));
const assets=node('details');assets.append(node('summary','Tài sản sản phẩm ('+r.assets.length+')'),node('p','Tải PNG/JPEG/MP4/MOV hoặc nguồn voice/nhạc WAV/MP3/M4A để kiểm tra file thật. Tối đa 50 MiB/file. File lớn hơn dùng Creative Studio ngoài app rồi xuất bản nhỏ để duyệt. Tài sản không tự đẩy lên GitHub.','subtle'));
const upload=node('input');upload.type='file';upload.accept='.png,.jpg,.jpeg,.mp4,.mov,.wav,.mp3,.m4a';upload.setAttribute('aria-label','Tải tài sản');assets.append(upload,button('Thêm file',async()=>{const f=upload.files[0];if(!f)throw new Error('Chọn file trước.');if(f.size>50*1024*1024)throw new Error('File vượt 50 MiB.');const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(f);});await action('upload',{run:r.id,name:f.name,base64});}));
for(const a of r.assets){const p=node('p',a.name+' · '+Math.ceil(a.bytes/1024)+' KiB','small');p.append(node('br'),node('code',a.id));assets.append(p);}box.append(assets);
for(const [i,j] of r.jobs.entries()){const s=node('section',null,'step'),head=node('div',null,'stephead'),title=node('div');title.append(node('h3',(i+1)+'. '+j.title),node('p',state.roles[j.role]+' · lần thử '+j.attempts.length+'/3','subtle'));head.append(title,badge(labels[j.state],j.state));s.append(head,node('p',j.output,'small'));
if(j.error)s.append(node('p',j.error,'notice error'));
if(j.result){const result=j.result;s.append(node('p',result.summary));if(result.blockers.length)s.append(node('p','Cần bổ sung: '+result.blockers.join('\n'),'notice'));const preview=node('details');preview.append(node('summary','Đọc báo cáo'),node('pre',result.report,'preview'));s.append(preview,button('Tải báo cáo',()=>download(j.id+'.md',result.report)),button('Tải kết quả kiểm tra',()=>download(j.id+'-result.json',JSON.stringify(result,null,2))));if(j.state==='review'&&!r.cancelled)s.append(reviewForm(r,j));}
if(j.state==='awaiting-result')s.append(manualForm(r,j));
if(['hold','failed','uncertain'].includes(j.state)&&!r.cancelled){s.append(button('Bổ sung và thử lại',()=>{const note=prompt('Nêu dữ liệu bổ sung hoặc nguyên nhân thử lại:');if(!note)return;const reconciled=j.state!=='uncertain'||confirm('Đã kiểm tra worker cũ dừng, các file và tác động liên quan? Không thử lại nếu chưa rõ.');if(!reconciled)return;return action('retry',{run:r.id,job:j.id,note,reconciled});}),node('p','Thử lại tạo lần chạy mới và giữ hồ sơ cũ. Tối đa ba lần.','subtle'));}box.append(s);}}
function refresh(force=false){
  // Coalesce interval polls, but queue a fresh read after every completed action.
  if(pendingRefreshes&&!force)return refreshQueue;
  pendingRefreshes++;
  refreshQueue=refreshQueue.then(async()=>{try{
    const next=await api('state'),changed=force||next.revision!==lastRevision;
    const capabilitiesChanged=state&&JSON.stringify(next.capabilities)!==JSON.stringify(state.capabilities);
    state=next;if(!selected&&state.runs.length)selected=state.runs.at(-1).id;
    if(changed){lastRevision=state.revision;renderProjects();renderDetail();}
    if(!$('#workflow').options.length)fillWorkflows();
    if(!$('#settings-form').children.length||force||capabilitiesChanged)renderSettings();
    $('#workspace').textContent='Dữ liệu riêng trên máy: '+state.home+' · Mã nguồn repo không chứa các dự án này.';
  }catch(e){error(e);}finally{pendingRefreshes--;}});
  return refreshQueue;
}
$('#create-form').elements.model.onchange=()=>fillWorkflows();
$('#create-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const r=await api('create',{...Object.fromEntries(f),auto:f.get('auto')==='on',demo:false,request_key:requestKey});requestKey=crypto.randomUUID();selected=r.id;$('#create').open=false;await refresh(true);toast('Đã tạo công việc. Bấm Giao bước tiếp theo.');}catch(e){error(e);}};
$('#demo').onclick=async()=>{try{const r=await api('create',{workflow:'creative-batch',model:'pod',title:'Demo quy trình creative',brief:'Mô phỏng nội dung và bàn giao. Không sử dụng dữ liệu kinh doanh hoặc AI.',store_id:'demo-store',currency:'USD',market:'US',timezone:'Asia/Ho_Chi_Minh',demo:true,auto:true,request_key:crypto.randomUUID()});selected=r.id;$('#create').open=false;await action('dispatch',{run:r.id});}catch(e){error(e);}};
$('#audit').onclick=async()=>{try{const a=await api('audit'),box=$('#audit-output');box.replaceChildren(node('p','Đã đọc '+a.run_count+' dự án. '+a.findings.length+' mục cần chú ý.','small'));for(const f of a.findings)box.append(node('p',(f.job||'Nhật ký')+': '+(labels[f.kind]||f.kind)+(f.message?' · '+f.message:''),'small'));if(!a.findings.length)box.append(node('p','Chưa phát hiện lỗi trong hồ sơ đã lưu. Không phải xác nhận sản phẩm hoặc quảng cáo đạt chất lượng.','subtle'));}catch(e){error(e);}};
refresh();setInterval(()=>{if(!document.hidden)refresh();},2500);
