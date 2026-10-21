import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import fs from 'node:fs';
const original=childProcess.spawnSync;
let next=0;
const log=row=>fs.appendFileSync(process.env.ZH_SOURCE_PROCESS_TRACE,JSON.stringify({...row,at:new Date().toISOString()})+'\n');
childProcess.spawnSync=function(executable,args,options){const id=++next;log({event:'process-start',id,executable,args});const start=Date.now();try{const result=Reflect.apply(original,this,[executable,args,options]);log({event:'process-terminal',id,exitCode:result.status,signal:result.signal,error:result.error?.message||null,elapsedMs:Date.now()-start});return result;}catch(error){log({event:'process-terminal',id,exitCode:null,error:error.message,elapsedMs:Date.now()-start});throw error;}};
syncBuiltinESMExports();
