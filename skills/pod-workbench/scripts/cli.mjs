#!/usr/bin/env node
import fs from 'node:fs';
import { contribution, checkClaims, listingReadiness } from './core.mjs';
import { printQa } from './print-qa.mjs';
import { readShopify } from './shopify-read.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
try{
  const [cmd,...args]=process.argv.slice(2);let result;
  if(cmd==='margin'&&args.length===1)result=contribution(read(args[0]));
  else if(cmd==='print-qa'&&args.length===2)result=printQa(fs.readFileSync(args[0]),read(args[1]));
  else if(cmd==='copy-qa'&&args.length===2)result=checkClaims(fs.readFileSync(args[0],'utf8'),read(args[1]));
  else if(cmd==='listing-qa'&&args.length===3)result=listingReadiness(read(args[0]),read(args[1]),read(args[2]));
  else if(cmd==='shopify-read'&&args.length===3){
    const [resource,configPath,outputPath]=args,c=read(configPath);
    // Exclusive destination prevents accidental overwrite or a redirected symlink write.
    const fd=fs.openSync(outputPath,'wx',0o600);
    try{result=await readShopify({shop:c.shop_domain,resource,token:process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,maxPages:c.max_pages??2});fs.writeFileSync(fd,JSON.stringify(result,null,2)+'\n');}
    catch(e){fs.closeSync(fd);fs.unlinkSync(outputPath);throw e;}
    fs.closeSync(fd);result={status:'ok',pages:result.pages,complete:result.complete,rows:result.rows.length};
  }else throw new Error('Usage: cli.mjs margin costs.json | print-qa image.png spec.json | copy-qa copy.txt approved-claims.json | listing-qa listing.json qa.json store.json | shopify-read products|orders config.json NEW-output.json');
  console.log(JSON.stringify(result,null,2));if(result.status==='hold')process.exitCode=1;
}catch(e){console.error('pod: '+e.message);process.exitCode=2;}
