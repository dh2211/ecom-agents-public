// Read-only observation for a human or Chief of Staff; never creates or repairs state.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {Engine} from './engine.mjs';
const args=process.argv.slice(2);
try {
  if(args.length && (args.length!==2||args[0]!=='--home'))throw new Error('Usage: observer.mjs [--home PRIVATE_WORKSPACE]');
  const nextHome=path.join(os.homedir(),'.ecom-agents-commerce'),legacyHome=path.join(os.homedir(),'.ai-employees-commerce');
  const home=args[1]||process.env.COMMERCE_HOME||(!fs.existsSync(nextHome)&&fs.existsSync(legacyHome)?legacyHome:nextHome);
  const report=new Engine(home,path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),{readOnly:true}).audit();
  console.log(JSON.stringify(report,null,2));if(report.findings.length)process.exitCode=2;
}catch(e){console.error('Observer: '+e.message);process.exitCode=1;}
