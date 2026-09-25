import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
for(const dir of ['public'])for(const file of readdirSync(dir))if(file.endsWith('.js'))execFileSync(process.execPath,['--check',`${dir}/${file}`],{stdio:'inherit'});
