// External execution coordinator only. It never edits a checker or game source.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);
assert.ok(!fs.existsSync(out),'fresh output required');fs.mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(p),relative=p=>path.relative(root,p).replaceAll('\\','/');
const write=(rel,data)=>{const p=path.join(out,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data,null,2)+'\n');return {path:rel,bytes:fs.statSync(p).size,sha256:hash(read(p))};};
const expectedHtml='dc26573d8b6c443454e0c15951a756379dccd1ec34b290fb8a3dd05257f42d15';
const html=read(path.join(root,'dist/index.html'));assert.equal(hash(html),expectedHtml);
write('source-executed.html',html);const frozenHtml=path.join(out,'source-executed.html');
const controller=write('coordinator-executed.mjs',read(fileURLToPath(import.meta.url)));
const dependencies=new Map();
function bind(p){p=path.resolve(p);assert.ok(!relative(p).startsWith('..'),'dependency inside repo');if(!dependencies.has(p)){const raw=read(p);dependencies.set(p,{path:relative(p),bytes:raw.length,sha256:hash(raw)});}return dependencies.get(p);}
for(const p of ['scripts/check-report-recovery.mjs','scripts/lib/source-runtime-fixture.mjs','scripts/lib/npc-rest-work-v1.mjs','scripts/lib/scenario-package-v1.mjs','.codex/skills/zombie-harvest-iteration/SKILL.md','.codex/skills/zombie-harvest-iteration/references/npc-routine-execution.md'])bind(path.join(root,p));
const c1Root=path.join(root,'scripts/fixtures/scenario-boot-c1'),c1Manifest=path.join(c1Root,'frozen-input-manifest.json');bind(c1Manifest);bind(path.join(c1Root,'contract-matrix.md'));
const c1=JSON.parse(read(c1Manifest));for(const r of [...c1.refs,...c1.writers])bind(path.join(c1Root,r.path));
const c2Root=path.join(root,'scripts/fixtures/scenario-boot-c2'),c2Mapping=path.join(c2Root,'capture-mapping.json');bind(c2Mapping);const c2=JSON.parse(read(c2Mapping));bind(path.join(root,c2.ioAdapter.path));for(const r of c2.inputs)bind(path.join(root,r.path));for(const p of ['author-v2-oracle.json','author-v2-baseline-source.txt'])bind(path.join(c2Root,p));
const captureMeta=path.join(root,'scripts/fixtures/npc-threat-attention-v1/capture-meta.json');bind(captureMeta);bind(path.join(root,JSON.parse(read(captureMeta)).fixture.path));
const plans=[
 {id:'c1-boot',script:'scripts/check-scenario-boot-c1.mjs',args:['--html',frozenHtml,'--input-manifest',c1Manifest,'--core-module',path.join(root,'scripts/lib/scenario-package-v1.mjs'),'--out',path.join(out,'native/c1')],report:'native/c1/report.json',impact:'Full real old-writer boot, seed/config/settings consumer, save/reload; C1 includes its existing pure/author controls unchanged.'},
 {id:'c2-boot',script:'scripts/check-scenario-boot-c2.mjs',args:['--html',frozenHtml,'--repo-root',root,'--core-module',path.join(root,'scripts/lib/scenario-package-v1.mjs'),'--out',path.join(out,'native/c2')],report:'native/c2/report.json',impact:'Full native legacy/bound loading, content staging/choice/renderer/reducer and persistence.'},
 {id:'outpost',script:'scripts/check-outpost-presence-v1.mjs',args:['--html',frozenHtml],impact:'Camp/garrison membership across actual routine, work, motion, renderer, combat and population.'},
 {id:'camp-rest',script:'scripts/check-camp-rest-v1.mjs',args:['--html',frozenHtml,'--mode','candidate','--out',path.join(out,'native/camp-rest.json')],report:'native/camp-rest.json',impact:'Existing public camp rest lifecycle, actual minute simulation, demands, damage interruption and save/reload.'},
 {id:'daytime-combat',script:'scripts/check-daytime-combat.mjs',args:[frozenHtml],impact:'Real daytime NPC/tower/enemy damage, Gate, phase, causal receipts and cleanup.'},
 {id:'attention',script:'scripts/check-npc-threat-attention.mjs',args:['--html',frozenHtml],impact:'Actual old writer, perception to combat, presence and strict additive-migration metadata; failures retained.'}
];
for(const p of plans)bind(path.join(root,p.script));
write('input-index.json',{schema:'ImpactExecutionInputIndexV1',sourceHtmlSha256:expectedHtml,controller,scope:'Six existing affected contracts only; no browser/natural/full43 rerun; no repo clone.',dependencies:[...dependencies.values()]});
const processes=[],events=[];let hasFailure=false;
for(const p of plans){
 const scriptPath=path.join(root,p.script),runnerBytes=read(scriptPath),runner=write(`methods/${p.id}-executed.mjs`,runnerBytes);
 assert.equal(hash(runnerBytes),dependencies.get(scriptPath).sha256,'checker changed before launch');
 for(const [file,row] of dependencies)assert.equal(hash(read(file)),row.sha256,'input changed before launch: '+row.path);
 const start={event:'process-start',id:p.id,at:new Date().toISOString(),runnerSha256:runner.sha256,sourceHtmlSha256:expectedHtml};events.push(start);write('process-events.json',events);console.log(JSON.stringify(start));
 fs.mkdirSync(path.join(out,'native'),{recursive:true});
 const child=spawnSync(process.execPath,[scriptPath,...p.args],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024,timeout:300000});
 const stdout=write(`logs/${p.id}.stdout.log`,child.stdout||''),stderr=write(`logs/${p.id}.stderr.log`,child.stderr||'');
 let report=null,reportRef=null,parseError=null;
 try{if(p.report&&fs.existsSync(path.join(out,p.report))){const b=read(path.join(out,p.report));report=JSON.parse(b);reportRef={path:p.report,bytes:b.length,sha256:hash(b)};}else{report=JSON.parse(child.stdout);reportRef=stdout;}}catch(e){parseError=e.message;}
 const checks=report?.checks||report?.results||[],count=report?.count??checks.length,passed=report?.passed??checks.filter(c=>c.ok===true).length;
 const unchanged=[...dependencies].filter(([file,row])=>hash(read(file))!==row.sha256).map(([,row])=>row.path);
 const row={id:p.id,impact:p.impact,runner,sourceHtmlSha256:expectedHtml,startedAt:start.at,terminalAt:new Date().toISOString(),exitCode:child.status,signal:child.signal,error:child.error?String(child.error):null,stdout,stderr,nativeReport:reportRef,parseError,count,passed,failures:checks.filter(c=>c.ok===false),inputsUnchanged:unchanged.length===0,changedInputs:unchanged};
 processes.push(row);hasFailure ||= child.status!==0||!!child.error||unchanged.length>0;
 events.push({event:'process-terminal',id:p.id,at:row.terminalAt,exitCode:row.exitCode,count,passed});write('process-events.json',events);write('execution-matrix.json',{schema:'ImpactExecutionMatrixV1',sourceHtmlSha256:expectedHtml,processes});
 console.log(JSON.stringify({event:'process-terminal',id:p.id,exitCode:row.exitCode,count,passed,failedChecks:row.failures.map(c=>c.name),nativeReportSha256:reportRef?.sha256}));
}
const originalSourceStillMatches=hash(read(path.join(root,'dist/index.html')))===expectedHtml;
write('terminal.json',{schema:'ImpactExecutionTerminalV1',terminal:true,sourceHtmlSha256:expectedHtml,contractCount:plans.length,processCount:processes.length,passedProcesses:processes.filter(p=>p.exitCode===0).length,failedProcesses:processes.filter(p=>p.exitCode!==0).length,originalSourceStillMatches,allInputsUnchanged:processes.every(p=>p.inputsUnchanged),status:hasFailure?'COMPLETED_WITH_FAILURES':'COMPLETED_ALL_EXIT0',gameplayScope:'controlled source VM; existing tests retain their declared scene manipulations and IO scope; not browser/natural/pilot/balance'});
process.exitCode=hasFailure?1:0;
