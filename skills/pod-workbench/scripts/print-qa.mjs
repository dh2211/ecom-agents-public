/* Dependency-free PNG QA. Supports 8-bit, noninterlaced RGB/RGBA PNG only.
 * Unsupported formats FAIL CLOSED rather than silently guessing transparency. */
import zlib from 'node:zlib';
import crypto from 'node:crypto';
const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
export function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
export function inspectPng(buffer){
  if(!Buffer.isBuffer(buffer)||buffer.length>80*1024*1024)throw new Error('PNG missing or above the 80 MiB safety cap');
  if(!buffer.subarray(0,8).equals(SIGNATURE))throw new Error('Not a PNG file');
  let pos=8,header,idat=[],ended=false,transparency=false,seenData=false,dataEnded=false;
  while(pos<buffer.length){
    if(pos+12>buffer.length)throw new Error('Truncated PNG chunk');
    const size=buffer.readUInt32BE(pos),type=buffer.subarray(pos+4,pos+8).toString('ascii');
    if(size>80*1024*1024||pos+12+size>buffer.length)throw new Error('Invalid PNG chunk length');
    if(!/^[A-Za-z]{4}$/.test(type))throw new Error('Invalid PNG chunk type');
    const data=buffer.subarray(pos+8,pos+8+size),expected=buffer.readUInt32BE(pos+8+size);
    if(crc32(buffer.subarray(pos+4,pos+8+size))!==expected)throw new Error('PNG checksum mismatch');
    if(!header&&type!=='IHDR')throw new Error('IHDR must be first');
    if(type==='IHDR'){
      if(header||size!==13)throw new Error('Invalid or repeated IHDR');
      header={width:data.readUInt32BE(0),height:data.readUInt32BE(4),depth:data[8],type:data[9],compression:data[10],filter:data[11],interlace:data[12]};
      if(!header.width||!header.height||header.width*header.height>30000000)throw new Error('Invalid dimensions or image exceeds 30 million pixels');
      if(header.depth!==8||![2,6].includes(header.type)||header.compression||header.filter||header.interlace)throw new Error('Unsupported PNG encoding; convert locally to noninterlaced 8-bit RGBA');
    }else if(type==='IDAT'){
      if(dataEnded)throw new Error('Non-contiguous IDAT chunks');
      seenData=true;idat.push(data);
    }else if(type==='IEND'){
      if(size||!seenData)throw new Error('Invalid IEND');ended=true;pos+=12;break;
    }else{
      if(seenData)dataEnded=true;
      if(type==='tRNS')transparency=true;
      if(type==='acTL')throw new Error('Animated PNG is not a print master');
      if(type[0]===type[0].toUpperCase()&&type!=='PLTE')throw new Error('Unknown critical PNG chunk');
    }
    pos+=size+12;
  }
  if(!ended||pos!==buffer.length)throw new Error('Missing IEND or trailing data');
  if(transparency)throw new Error('tRNS transparency is unsupported; convert locally to RGBA');
  const channels=header.type===6?4:3,stride=header.width*channels,expectedLength=(stride+1)*header.height;
  const inflated=zlib.inflateSync(Buffer.concat(idat),{maxOutputLength:expectedLength});
  if(inflated.length!==expectedLength)throw new Error('Unexpected PNG scanline length');
  let previous=Buffer.alloc(stride),transparent=0,visible=0,partial=0,border=0,borderTransparent=0;
  for(let y=0;y<header.height;y++){
    const offset=y*(stride+1),filter=inflated[offset],row=Buffer.from(inflated.subarray(offset+1,offset+1+stride));
    if(filter>4)throw new Error('Invalid PNG filter');
    for(let i=0;i<stride;i++){
      const a=i>=channels?row[i-channels]:0,b=previous[i],c=i>=channels?previous[i-channels]:0;
      if(filter===1)row[i]=(row[i]+a)&255;else if(filter===2)row[i]=(row[i]+b)&255;
      else if(filter===3)row[i]=(row[i]+Math.floor((a+b)/2))&255;else if(filter===4)row[i]=(row[i]+paeth(a,b,c))&255;
    }
    for(let x=0;x<header.width;x++){
      const alpha=channels===4?row[x*4+3]:255;
      if(alpha===0)transparent++;if(alpha>0)visible++;if(alpha>0&&alpha<255)partial++;
      if(y===0||y===header.height-1||x===0||x===header.width-1){border++;if(alpha===0)borderTransparent++;}
    }
    previous=row;
  }
  const count=header.width*header.height;
  return{width:header.width,height:header.height,has_alpha:channels===4,transparent_pixels:transparent,visible_pixels:visible,
    partial_alpha_pixels:partial,transparent_fraction:transparent/count,border_transparent_fraction:borderTransparent/border,
    sha256:crypto.createHash('sha256').update(buffer).digest('hex')};
}
export function printQa(buffer,spec){
  const stats=inspectPng(buffer),reasons=[];
  if(!spec||typeof spec.supplier_template_ref!=='string'||!spec.supplier_template_ref.trim())throw new Error('Supplier template reference required');
  for(const k of ['width_px','height_px'])if(!Number.isInteger(spec[k])||spec[k]<=0)throw new Error('Declare supplier '+k);
  if(stats.width!==spec.width_px||stats.height!==spec.height_px)reasons.push('Dimensions do not match the declared supplier template');
  if(!['transparent','solid'].includes(spec.background))throw new Error('Explicit background policy required');
  if(!stats.visible_pixels)reasons.push('Image is empty/fully transparent');
  if(spec.background==='transparent'){
    const threshold=spec.min_transparent_fraction??0.01;
    if(typeof threshold!=='number'||threshold<=0||threshold>=1)throw new Error('Invalid transparent fraction threshold');
    if(!stats.has_alpha||stats.transparent_fraction<threshold)reasons.push('No meaningful real transparency; checkerboard/solid backgrounds do not pass');
    if(stats.border_transparent_fraction<0.9)reasons.push('Border is not mostly transparent; inspect and rerender');
  }else{
    if(spec.generator_supports_transparency!==false)reasons.push('Solid fallback allowed only when transparency is explicitly unsupported');
    if(spec.supplier_approves_solid!==true)reasons.push('Supplier has not approved a solid background');
    if(stats.transparent_pixels||stats.partial_alpha_pixels)reasons.push('Solid fallback must be fully opaque');
  }
  return{status:reasons.length?'hold':'pass',...stats,supplier_template_ref:spec.supplier_template_ref,reasons,
    human_checks_required:['rights_review','spelling_review','contrast_review','mockup_review'],
    scope:'Technical pixel and dimension check only; no visual, legal or supplier approval is implied.'};
}
