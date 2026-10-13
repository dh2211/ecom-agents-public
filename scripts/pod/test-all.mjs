import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=path.join(root,'tests/pod');
const files=fs.readdirSync(dir).filter(x=>x.endsWith('.test.mjs')).sort().map(x=>path.join(dir,x));
const r=spawnSync(process.execPath,['--test',...files],{cwd:root,stdio:'inherit'});
process.exitCode=r.status??1;
