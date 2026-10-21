#!/usr/bin/env node
// Full inline source in the existing TEST-ONLY VM/IO. No browser or human claims.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sourceRuntimeFactory } from './lib/source-runtime-fixture.mjs';

const args=process.argv.slice(2), opt={};
for(let i=0;i<args.length;i+=2){assert.ok(['--html','--out','--expect-html-sha256'].includes(args[i])&&!opt[args[i]]&&args[i+1]);opt[args[i]]=args[i+1];}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const htmlPath=opt['--html']||path.join(root,'dist/index.html');
const out=opt['--out'];assert.ok(path.isAbsolute(htmlPath)&&path.isAbsolute(out||''));
const sha=b=>createHash('sha256').update(b).digest('hex'),plain=x=>JSON.parse(JSON.stringify(x));
const html=readFileSync(htmlPath), htmlSha=sha(html);assert.equal(htmlSha,opt['--expect-html-sha256']);
assert.ok(!existsSync(out),'fresh output required');mkdirSync(path.dirname(out),{recursive:true});
const factory=sourceRuntimeFactory(htmlPath), KEY='zombie-harvest-progress-v12';
const inputPath=path.join(root,'scripts/fixtures/npc-relay-stone-v1/a08-normal-writer643-save21.json');
const artifacts=[], checks=[];
function artifact(name,raw){const p=out.replace(/\.json$/,'')+'-'+name;const b=Buffer.from(raw);writeFileSync(p,b);const e={path:path.basename(p),sha256:sha(b),bytes:b.length};artifacts.push(e);return e;}
function boot(entries=[]){const r=factory(entries);assert.equal(r.api.start().ok,true);r.tasks.clear();vm.runInContext('Object.assign(qa,{eat:eatFood,eatGate:typeof playerEatGate==="function"?playerEatGate:null,repair:repairBuilding})',r.context);return r;}
function setup(food=3,energy=50,hp=80){const r=boot();Object.assign(r.api.state,{food,energy,hp});return r;}
const facts=r=>plain({food:r.api.state.food,energy:r.api.state.energy,hp:r.api.state.hp,world:r.api.state.world,standing:r.api.state.campStanding,quests:r.api.state.quests,buildings:r.api.state.buildings,npcs:r.api.state.npcs,rng:r.api.state.worldMeta.rngState});
const eats=r=>r.api.state.worldMeta.events.filter(e=>e.type==='player.ate');
function test(name,fn){try{checks.push({name,ok:true,evidence:fn()||null});}catch(e){checks.push({name,ok:false,error:e.stack||String(e)});}}
function checkpoint(r){const task=[...r.tasks.entries()].filter(([,t])=>t.kind==='timeout'&&t.delay===650).at(-1);assert.ok(task,'actual queued normal writer');r.tasks.delete(task[0]);task[1].callback();const raw=r.storage.get(KEY);assert.equal(r.api.validate({raw,sourceCategory:'primary'}).ok,true);return raw;}

for(const [label,food,energy,hp,reason] of [['no-food',0,50,80,'eat-food-empty'],['partial-ration',.5,50,80,'eat-food-empty'],['already-full',3,100,100,'eat-not-needed']]){
 test(label+' refuses without food/health change or success receipt',()=>{const r=setup(food,energy,hp),before=facts(r),n=eats(r).length;const result=r.api.eat({commandId:'TEST-ONLY-'+label});assert.equal(result.ok,false);assert.equal(result.reason,reason);assert.deepEqual(facts(r),before);assert.equal(eats(r).length,n);return {reason:result.reason};});
}
test('normal recovery has exact payment, actual deltas and no time charge',()=>{const r=setup(),before=facts(r),x=r.api.eat({commandId:'TEST-ONLY-normal'});assert.equal(x.ok,true);assert.equal(x.event.actorId,'player-1');assert.equal(x.event.type,'player.ate');assert.deepEqual(plain(x.event.payload),plain(x.result));assert.deepEqual(plain(x.result.delta),{food:-1,energy:24,hp:6});assert.deepEqual(plain(x.result.before),{food:3,energy:50,hp:80});assert.deepEqual(plain(x.result.after),{food:2,energy:74,hp:86});assert.equal(x.result.clock.elapsedMinutes,0);assert.deepEqual(plain(r.api.state.world),before.world);assert.equal(r.api.state.worldMeta.rngState,before.rng);return plain(x.result);});
test('near-cap feedback reports only real recovery',()=>{const r=setup(3,99,99);const x=r.api.eat({commandId:'TEST-ONLY-cap'});assert.equal(x.ok,true);assert.deepEqual(plain(x.result.delta),{food:-1,energy:1,hp:1});assert.match(r.node('toast').textContent,/体力 \+1，生命 \+1$/);return {toast:r.node('toast').textContent};});
test('full energy still permits useful HP recovery',()=>{const r=setup(3,100,80),x=r.api.eat();assert.equal(x.ok,true);assert.equal(r.api.state.energy,100);assert.equal(r.api.state.hp,86);assert.equal(x.result.delta.energy,0);});
test('doctor bonus retains its authored condition and caps at actual HP',()=>{const r=setup(3,50,80);r.api.state.npcs.find(n=>n.id==='doctor').bond=3;let x=r.api.eat();assert.equal(x.result.doctorBonus,6);assert.equal(x.result.delta.hp,12);r.api.state.hp=99;x=r.api.eat();assert.equal(x.result.delta.hp,1);assert.equal(r.api.state.hp,100);});
test('lower configured stamina cap cannot make eating reduce stored energy',()=>{const r=setup(3,90,80);r.api.state.staminaRules.max=80;const x=r.api.eat();assert.equal(x.ok,true);assert.equal(r.api.state.energy,90);assert.equal(r.api.state.hp,86);assert.equal(x.result.delta.energy,0);});
test('one command can consume and recover only once',()=>{const r=setup(),first=r.api.eat({commandId:'TEST-ONLY-duplicate'});assert.equal(first.ok,true);const before=facts(r),n=eats(r).length;const second=r.api.eat({commandId:'TEST-ONLY-duplicate'});assert.equal(second.duplicate,true);assert.deepEqual(facts(r),before);assert.equal(eats(r).length,n);});
test('repeated new commands at full health do not spend more food',()=>{const r=setup(3,100,94);assert.equal(r.api.eat().ok,true);for(let i=0;i<4;i++)assert.equal(r.api.eat().ok,false);assert.equal(r.api.state.food,2);assert.equal(eats(r).length,1);});
test('pure gate leaves world, timers and storage unchanged',()=>{const r=setup();assert.equal(typeof r.api.eatGate,'function');const before=plain(r.api.state),timers=[...r.tasks.keys()],storage=[...r.storage.entries()];for(let i=0;i<3;i++)assert.equal(r.api.eatGate().ok,true);assert.deepEqual(plain(r.api.state),before);assert.deepEqual([...r.tasks.keys()],timers);assert.deepEqual([...r.storage.entries()],storage);});
test('actual HUD uses the same eligibility and capped gains',()=>{const r=setup(1,99,99);r.api.hud();for(const id of ['eatBtn','eatBtnAction']){assert.equal(r.node(id).disabled,false);assert.match(r.node(id).innerHTML,/消耗1食物 · 体力 \+1 · 生命 \+1/);}r.api.state.hp=100;r.api.state.energy=100;r.api.hud();assert.equal(r.node('eatBtn').disabled,true);assert.match(r.node('eatBtn').innerHTML,/均无需恢复/);});
test('registered click rechecks stock changed after rendering',()=>{const r=setup(1,50,80);r.api.hud();assert.equal(r.node('eatBtn').disabled,false);r.api.state.food=0;const n=eats(r).length;r.emit('eatBtn','click');assert.equal(eats(r).length,n);assert.equal(r.api.state.hp,80);assert.match(r.node('toast').textContent,/口粮不足/);});
test('night, report and invalid health cannot consume food',()=>{for(const mode of ['BATTLE','REPORT']){const r=setup();r.api.session.mode=mode;r.api.state.night=mode==='BATTLE';const before=facts(r);assert.equal(r.api.eat().ok,false);assert.deepEqual(facts(r),before);assert.equal(eats(r).length,0);}const r=setup();r.api.state.hp=NaN;assert.equal(r.api.eat().ok,false);assert.equal(r.api.state.food,3);});
test('unsupported actor cannot receive player recovery attribution',()=>{const r=setup(),before=facts(r);assert.equal(r.api.eat({actorId:'radio'}).ok,false);assert.deepEqual(facts(r),before);assert.equal(eats(r).length,0);});
test('normal writer and real Continue preserve payment, proof and deduplication',()=>{const r=setup(),id='TEST-ONLY-persist';assert.equal(r.api.eat({commandId:id}).ok,true);const before=facts(r),proof=plain(eats(r));const raw=checkpoint(r);artifact('writer.json',raw);const saved=JSON.parse(raw).payload;
 // Compare persisted facts, not unsaved UI-only NPC perks or missing/null defaults.
 for(const k of ['food','energy','hp','world'])assert.deepEqual(saved[k],before[k]);
 const next=boot([[KEY,raw]]);for(const k of ['food','energy','hp','world','buildings','quests'])assert.deepEqual(plain(next.api.state[k]),saved[k]);
 assert.deepEqual(plain(next.api.state.npcs.map(n=>({id:n.id,hp:n.hp,needs:n.needs,memory:n.memory}))),saved.npcs.map(n=>({id:n.id,hp:n.hp,needs:n.needs,memory:n.memory})));
 assert.deepEqual(plain(eats(next)),proof);const resumed=facts(next);assert.equal(next.api.eat({commandId:id}).duplicate,true);assert.deepEqual(facts(next),resumed);return {saveVersion:saved.version,proofCount:proof.length};});
test('existing complete SAVE21 writer resumes without invented past meals',()=>{const raw=readFileSync(inputPath,'utf8');assert.equal(sha(raw),'7c54ea074c60fe25cfff5bba39300aa85d07fd96fe57b49af88f082077f2b42a');const p=JSON.parse(raw).payload,r=boot([[KEY,raw]]);assert.equal(r.api.state.food,p.food);assert.equal(r.api.state.hp,p.hp);assert.deepEqual(plain(eats(r)),p.worldMeta.events.filter(e=>e.type==='player.ate'));return {inputSha256:sha(raw)};});
test('recovery can fund the existing paid wall repair without free materials',()=>{const r=setup(2,0,80),s=r.api.state;const wall=s.buildings.find(b=>b.type==='wall');assert.ok(wall);wall.hp=2;s.wood=4;s.player.x=wall.x-1;s.player.y=wall.y;s.worldZombies=[];const minute=s.world.totalMinutes;assert.equal(r.api.repair(wall).reason,'repair-energy');assert.equal(r.api.eat().ok,true);const x=r.api.repair(wall);assert.equal(x.ok,true);assert.deepEqual(plain(x.result.payment.cost),{wood:2,energy:14});assert.equal(x.result.target.hpBefore,2);assert.equal(x.result.target.hpAfter,3);assert.equal(s.world.totalMinutes,minute+20);assert.equal(eats(r).length,1);return {testOnly:['stock/energy/health','damaged wall and near position','no enemies in isolated scene'],eatCost:1,repairPayment:plain(x.result.payment),repairClock:plain(x.result.clock)};});
const report={runner:'source-player-food-recovery-v1',sourceHtmlSha256:htmlSha,browserExecuted:false,naturalGameplay:false,humanUnderstandingMeasured:false,scope:'Whole inline source with existing controlled IO. State setups and final repair scene are TEST-ONLY; HUD strings/attributes are not layout or physical click verification.',dependencies:['scripts/check-player-food-recovery-v1.mjs','scripts/lib/source-runtime-fixture.mjs','scripts/check-report-recovery.mjs'].map(p=>({path:p,sha256:sha(readFileSync(path.join(root,p)))})),ok:checks.every(c=>c.ok),count:checks.length,passed:checks.filter(c=>c.ok).length,checks,artifacts};
writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,count:report.count,passed:report.passed,failures:checks.filter(c=>!c.ok),report:out}));if(!report.ok)process.exitCode=1;
