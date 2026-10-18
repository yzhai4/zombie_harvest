import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';

const args = {};
assert.equal((process.argv.length-2)%2,0);
for(let i=2;i<process.argv.length;i+=2){assert.ok(['--root','--html','--input','--out','--expect-html-sha256','--expect-input-sha256','--validate-only'].includes(process.argv[i]));assert.ok(!Object.hasOwn(args,process.argv[i]));args[process.argv[i]]=process.argv[i+1];}
for(const k of ['--root','--html','--input','--out'])assert.ok(path.isAbsolute(args[k]||''));
for(const k of ['--expect-html-sha256','--expect-input-sha256'])assert.match(args[k]||'',/^[a-f0-9]{64}$/);
const sha = b => createHash('sha256').update(b).digest('hex');
const html=fs.readFileSync(args['--html']),raw=fs.readFileSync(args['--input'],'utf8');
assert.equal(sha(html),args['--expect-html-sha256']);assert.equal(sha(raw),args['--expect-input-sha256']);
if(args['--validate-only']!==undefined){assert.equal(args['--validate-only'],'true');console.log(JSON.stringify({status:'EPSILON_BINDINGS_VALIDATED_NO_RUNTIME'}));process.exit(0);}
assert.ok(!fs.existsSync(args['--out']));fs.mkdirSync(args['--out']);const out=args['--out'];
const artifacts=[],checks=[];
function artifact(name,value,rawBytes=false){const b=rawBytes?Buffer.from(value):Buffer.from(JSON.stringify(value,null,2)+'\n');fs.writeFileSync(path.join(out,name),b);artifacts.push({path:name,sha256:sha(b),bytes:b.length});}
const report={schema:'DayCoverSavedRingBoundaryV1',status:'RUNNING',sourceHtmlSha256:sha(html),inputSha256:sha(raw),testOnly:true,naturalGameplay:false,browser:false,checks,artifacts,errors:[]};
function check(name,fn){try{fn();checks.push({name,ok:true});}catch(e){checks.push({name,ok:false,error:e.message});}}
artifact('source-executed.html',html,true);artifact('input-test-only-native.json',raw,true);artifact('runner-executed.mjs',fs.readFileSync(fileURLToPath(import.meta.url)),true);
for(const [label,name]of [['factory-executed.mjs','scripts/lib/source-runtime-fixture.mjs'],['io-adapter-executed.mjs','scripts/check-report-recovery.mjs']])artifact(label,fs.readFileSync(path.join(args['--root'],name)),true);
try{
 const {sourceRuntimeFactory}=await import(pathToFileURL(path.join(args['--root'],'scripts/lib/source-runtime-fixture.mjs')));
 const factory=sourceRuntimeFactory(args['--html']),r=factory([['zombie-harvest-progress-v12',raw]]),saved=JSON.parse(raw).payload;
 const alias='qa.coverEpsilon = { status: dayCoverFollowStatus, step: continuousMotionStep };';
 artifact('qa-alias.js',alias,true);vm.runInContext(alias,r.context);
 const plain=x=>JSON.parse(JSON.stringify(x));
 const subject=()=>r.api.state.npcs.find(n=>n.id==='guardChen');
 check('Actual old complete writer validates and installs through real Continue',()=>{
  assert.equal(r.api.validate({raw,sourceCategory:'primary'}).ok,true);assert.equal(r.api.boot.selected.raw,raw);
  r.emit('continueSaveBtn','click');assert.equal(r.api.started,true);assert.equal(r.api.session.mode,'DAY');
  assert.equal(r.api.state.world.totalMinutes,saved.world.totalMinutes);assert.equal(subject().x,saved.npcs.find(n=>n.id==='guardChen').x);assert.equal(subject().y,saved.npcs.find(n=>n.id==='guardChen').y);
  assert.equal(subject().order,'cover');assert.equal(subject().supportRequested,true);
 });
 const snapshot=()=>plain({world:r.api.state.world.totalMinutes,seq:r.api.state.worldMeta.eventSeq,commandSeq:r.api.state.worldMeta.commandSeq,player:r.api.state.player,npc:subject(),stock:Object.fromEntries(['wood','parts','stone','food','medicine','energy','sanity'].map(k=>[k,r.api.state[k]])),standing:r.api.state.campStanding});
 const before=snapshot(),beforeRead=JSON.stringify(r.api.state),status=plain(r.api.coverEpsilon.status(subject()));
 assert.equal(JSON.stringify(r.api.state),beforeRead,'status projection stays pure');
 report.distance=Math.hypot(before.npc.x-before.player.x,before.npc.y-before.player.y);report.initialDuty=status;
 artifact('before-step-live.json',{...before,status,distance:report.distance});
 check('Captured floating boundary is classified within-ring without changing the old writer',()=>{
  assert.ok(report.distance>2.2&&report.distance<2.2+1e-9,'actual old writer floating residue');assert.equal(status.reason,'within-ring');assert.equal(status.follow,true);assert.equal(status.busy,true);
 });
 r.api.coverEpsilon.step(1/30);const after=snapshot(),afterRead=JSON.stringify(r.api.state),afterStatus=plain(r.api.coverEpsilon.status(subject()));
 assert.equal(JSON.stringify(r.api.state),afterRead,'status remains pure after actual motion');artifact('after-step-live.json',{...after,status:afterStatus});
 check('Actual original motion step stays in place and creates no new payment or reward',()=>{
  assert.equal(after.npc.x,before.npc.x);assert.equal(after.npc.y,before.npc.y);assert.equal(after.npc.motionTarget,null);assert.equal(afterStatus.reason,'within-ring');
  assert.equal(after.world,before.world);assert.equal(after.seq,before.seq);assert.equal(after.commandSeq,before.commandSeq);
  assert.equal(after.npc.bond,before.npc.bond);assert.equal(after.npc.sanity,before.npc.sanity);assert.deepEqual(after.npc.memory,before.npc.memory);assert.deepEqual(after.npc.relations,before.npc.relations);assert.deepEqual(after.stock,before.stock);assert.deepEqual(after.standing,before.standing);
 });
 report.actualFunctionScope='Unchanged full old writer -> actual loader/Continue; only original pure duty function and original one motion step are exposed. No postboot state/storage patch, no direct world advance or task clearing.';
}catch(e){report.errors.push({type:e.name,message:e.message});}
report.count=checks.length;report.passed=checks.filter(c=>c.ok).length;report.ok=report.errors.length===0&&checks.length===3&&checks.every(c=>c.ok);
report.status=report.ok?'SAVED_RING_BOUNDARY_VERIFIED':'SAVED_RING_BOUNDARY_FAILED';fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,passed:report.passed,count:report.count,errors:report.errors}));process.exitCode=report.ok?0:1;
