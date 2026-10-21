#!/usr/bin/env node
/** Real whole-inline source contract. Controlled DOM/storage/timers are TEST-ONLY.
 * No Gate, reducer, serializer, loader, CommandBus or scenario logic is replaced.
 * This is one source contract, not natural play, a browser, or a new replay platform.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const opt = {}, argv = process.argv.slice(2);
for (let i=0;i<argv.length;i+=2) {
  assert.ok(['--repo-root','--html','--out','--expect-html-sha256','--input','--pack','--baseline-contract'].includes(argv[i]) && argv[i+1], 'unknown/missing argument');
  opt[argv[i]]=argv[i+1];
}
for (const k of ['--repo-root','--html','--out']) assert.ok(path.isAbsolute(opt[k]||''), k+' must be absolute');
assert.match(opt['--expect-html-sha256']||'', /^[a-f0-9]{64}$/);
const root=path.resolve(opt['--repo-root']), htmlPath=path.resolve(opt['--html']), out=path.resolve(opt['--out']);
const ownDir=path.dirname(fileURLToPath(import.meta.url));
const fixtureDir=path.join(ownDir,'fixtures/npc-relay-stone-v1');
const inputPath=opt['--input']||path.join(fixtureDir,'a08-normal-writer643-save21.json');
const packPath=opt['--pack']||path.join(root,'content/packs/npc-relay-stone-v1.json');
const baselinePath=opt['--baseline-contract']||path.join(fixtureDir,'baseline-contract.json');
const artDir=out.replace(/\.json$/i,'')+'.artifacts';
assert.ok(!existsSync(out)&&!existsSync(artDir),'fresh output required');
mkdirSync(artDir,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const equal=(a,b,msg)=>assert.deepEqual(plain(a),plain(b),msg);
const sourceBytes=readFileSync(htmlPath), source=sourceBytes.toString('utf8'), sourceHtmlSha256=sha(sourceBytes);
assert.equal(sourceHtmlSha256,opt['--expect-html-sha256']);
const files=[fileURLToPath(import.meta.url),htmlPath,inputPath,packPath,baselinePath,
  path.join(root,'scripts/lib/source-runtime-fixture.mjs'),path.join(root,'scripts/check-report-recovery.mjs'),path.join(root,'scripts/lib/scenario-package-v1.mjs')];
const pin=p=>({path:p,sha256:sha(readFileSync(p)),bytes:readFileSync(p).length});
const dependenciesBefore=files.map(pin), artifacts=[];
function artifact(name,value,role,extra={}) {
  const bytes=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
  const p=path.join(artDir,name);assert.equal(path.dirname(p),artDir);writeFileSync(p,bytes);
  const ref={path:path.relative(path.dirname(out),p).replaceAll('\\','/'),sha256:sha(bytes),bytes:bytes.length,role,...extra};artifacts.push(ref);return ref;
}
artifact('runner-executed.mjs',readFileSync(fileURLToPath(import.meta.url)),'executed-runner');
artifact('source.html',sourceBytes,'actual-whole-inline-source');
const inputRaw=readFileSync(inputPath,'utf8'), mother=JSON.parse(inputRaw).payload;
assert.equal(sha(Buffer.from(inputRaw)),'7c54ea074c60fe25cfff5bba39300aa85d07fd96fe57b49af88f082077f2b42a','actual original A08 normal writer');
artifact('old-native-original.json',inputRaw,'unchanged-old-A08-complete-writer');
artifact('original-provenance.json',readFileSync(path.join(fixtureDir,'origin.json')),'original-provenance');
const baseline=JSON.parse(readFileSync(baselinePath,'utf8'));
artifact('baseline-contract.json',readFileSync(baselinePath),'external-old-source-identity');
const { sourceRuntimeFactory }=await import(pathToFileURL(path.join(root,'scripts/lib/source-runtime-fixture.mjs')));
const factory=sourceRuntimeFactory(htmlPath), SAVE='zombie-harvest-progress-v12', CHAIN='npc-relay-stone-001', NODE='stone_offer', FLAG=CHAIN+':terminal';
function aliases(r) {
  // DOM IO capability missing from the old report-only adapter. Modal focus is
  // exercised by the real public open/close path; no runtime function is mocked.
  const focusNode=n=>{if(n){n.focus=()=>{r.document.activeElement=n;};n.blur=()=>{if(r.document.activeElement===n)r.document.activeElement=null;};}return n;};
  for(const n of r.nodes.values())focusNode(n);
  for(const name of ['getElementById','querySelector','createElement']) {
    const original=r.document[name].bind(r.document);r.document[name]=(...args)=>focusNode(original(...args));
  }
  vm.runInContext(`Object.assign(qa,{
    offer:npcRelayStoneOfferGate, openOffer:openNpcRelayStoneOffer,
    resolve:resolveContentChainCommand, token:contentEpisodeExpectedToken,
    instanceKey:npcRelayStoneInstanceKey, packStatus:npcRelayStonePackStatus,
    sourceCapsule:npcRelayStoneSource, sourceValid:validateNpcRelayStoneSaved,
    npcGate:npcPublicActionGate, syncLife:syncNpcLifeState,
    closeInfo:closeInfoModal, updateProject:updateRelayProject, roleBindings:relayRoleBindings,
    log:recordWorldEvent, compiledPackage:SCENARIO_BOOT_PACKAGE, stonePack:NPC_RELAY_STONE_PACK,
    installFault(type) { const original=recordWorldEvent; qa.faultHit=null;
      recordWorldEvent=function(t,p={},m={}) { const event=original(t,p,m);
        if(t===type&&!qa.faultHit) { qa.faultHit={type:t,stone:state.stone,progress:state.relayProject.materialProgress.stone,terminal:state.contentState.flags['npc-relay-stone-001:terminal']===true,event:JSON.parse(JSON.stringify(event))}; throw new Error('TEST-ONLY late logger fault '+type); }
        return event; };
    }
  });`,r.context);
  return r;
}
function boot(raw,label,checkpoint=true) {
  const r=aliases(factory([[SAVE,raw]]));
  assert.equal(r.api.validate({raw,sourceCategory:'primary'}).ok,true,label+' actual validator');
  assert.equal(r.api.boot.selected.raw,raw,label+' actual loader selected raw');
  r.emit('continueSaveBtn','click');
  assert.equal(r.api.started,true,label+' actual Continue installed');
  assert.equal(r.api.boot.installed,true);assert.equal(r.api.boot.savePending,false);assert.equal(r.api.session.mode,'DAY');
  if(checkpoint) normal(r,label+'-boot');
  return r;
}
function normal(r,label) {
  const pair=[...r.tasks.entries()].filter(([,t])=>t.kind==='timeout'&&t.delay===650).at(-1);
  assert.ok(pair,label+' real queued checkpoint');r.tasks.delete(pair[0]);pair[1].callback();
  const raw=r.storage.get(SAVE);assert.equal(r.api.validate({raw,sourceCategory:'primary'}).ok,true,label+' complete writer validator');
  artifact(label+'-native.json',raw,'actual-normal-650ms-checkpoint');return raw;
}
function explicitWriter(r,label) {
  assert.equal(r.api.save({force:true,reason:'TEST-ONLY '+label}),true,label+' actual serializer');
  const raw=r.storage.get(SAVE);assert.equal(r.api.validate({raw,sourceCategory:'primary'}).ok,true);
  return raw;
}
const npc=(r,id='commander')=>r.api.state.npcs.find(n=>n.id===id);
const capsule=plain(mother.npcs.find(n=>n.id==='commander').memory.relayCoreHandoff);
const state=r=>r.api.state;
const active=r=>state(r).contentState.activeChains[CHAIN];
const log=(r,type)=>state(r).worldMeta.events.filter(e=>!type||e.type===type);
function stableFacts(r) {
  const s=state(r);return plain({day:s.day,hour:s.hour,minute:s.minute,world:s.world,energy:s.energy,hp:s.hp,sanity:s.sanity,stone:s.stone,wood:s.wood,parts:s.parts,food:s.food,
    campStanding:s.campStanding,relayProject:s.relayProject,npcs:s.npcs,hordeForecast:s.hordeForecast,campaign:s.campaign,scenarioSnapshot:s.scenarioSnapshot,rngState:s.worldMeta.rngState});
}
function business(r) { return {facts:stableFacts(r),contentState:plain(state(r).contentState)}; }
function open(r,id) { const res=r.api.openOffer('commander',{commandId:id});assert.equal(res.ok,true,'actual public open: '+JSON.stringify(res));assert.ok(active(r));return res; }
function resolve(r,choice,id,extra={}) { return r.api.resolve(CHAIN,NODE,choice,{...plain(r.api.token(active(r))),commandId:id,...extra}); }
function oneTick(r) {
  const timer=[...r.tasks.values()].find(t=>t.kind==='interval'&&t.delay===1200);assert.ok(timer,'real world interval');
  r.instrumentation.now+=1200;timer.callback();
}
function ensureQueuedWriter(r,label) {
  // Execute the actual installed interval, never fabricate a checkpoint request.
  for(let i=0;i<10&&!([...r.tasks.values()].some(t=>t.kind==='timeout'&&t.delay===650));i++) oneTick(r);
  return normal(r,label);
}
const checks=[], errors=[];
function test(name,fn) { try { const detail=fn();checks.push({name,ok:true,evidence:detail}); }catch(e){errors.push({name,error:e.stack||String(e)});checks.push({name,ok:false,error:e.message});} }
const produced=[];
function derive(label,change) {
  const r=boot(inputRaw,'producer-'+label), s=state(r), before=stableFacts(r);
  const changes=change(r,s);equal(npc(r).memory.relayCoreHandoff,capsule,'producer cannot fabricate source capsule');
  const raw=explicitWriter(r,'derived-'+label);
  const ref=artifact(label+'-writer.json',raw,'TEST-ONLY-derived-full-actual-writer',{motherSha256:sha(inputRaw),changes});
  const verify=boot(raw,'producer-verify-'+label,false);
  equal(npc(verify).memory.relayCoreHandoff,capsule);equal(state(verify).scenarioSnapshot,mother.scenarioSnapshot);assert.equal(state(verify).worldMeta.rngState,mother.worldMeta.rngState);
  produced.push({id:label,...ref,absolutePath:path.join(path.dirname(out),ref.path),motherSha256:sha(inputRaw),changes,producerActualLoaderAndContinue:true});
  return raw;
}
function setupNear(r,s,distance=.55,stock=1) {
  const n=npc(r);s.player.x=n.x-distance;s.player.y=n.y;s.player.prevX=s.player.x;s.player.prevY=s.player.y;
  s.worldZombies=[];s.stone=stock;s.relayProject.materialClock=0;
  return ['TEST-ONLY player placed '+distance+' from actual existing commander; no navigation claim','TEST-ONLY active world enemies removed to isolate content contract','TEST-ONLY inventory stone='+stock,'TEST-ONLY existing materialClock=0; normal timers remain active'];
}
let nearRaw,rangeRaw,zeroRaw;
test('old complete writer Continue and controlled fixture producers',()=>{
  const old=boot(inputRaw,'old-original');equal(npc(old).memory.relayCoreHandoff,capsule);
  equal(state(old).scenarioSnapshot,mother.scenarioSnapshot);assert.equal(state(old).worldMeta.rngState,mother.worldMeta.rngState);
  equal(state(old).relayProject,mother.relayProject);assert.equal(state(old).stone,mother.stone);
  assert.equal(old.api.packStatus().status,'bound');assert.equal(old.api.offer('commander').ok,false,'old player is not nearby');
  nearRaw=derive('near',(r,s)=>setupNear(r,s));rangeRaw=derive('range-band',(r,s)=>setupNear(r,s,1.1));zeroRaw=derive('stone-zero',(r,s)=>setupNear(r,s,.55,0));
  const index={schema:'NpcRelayStoneDerivedInputsV1',sourceHtmlSha256,naturalGameplay:false,sourceVmControlledIO:true,originalA08BudgetClosed:true,inputs:produced};
  const ref=artifact('produced-inputs.json',index,'derived-input-index');
  return {original:{world:mother.world.totalMinutes,eventSeq:mother.worldMeta.eventSeq,commandSeq:mother.worldMeta.commandSeq},derivedInputs:ref};
});
test('actual pure identity life range and phase Gates',()=>{
  assert.ok(nearRaw);const r=boot(nearRaw,'gate'), baselineState=plain(state(r)), observations=[];
  assert.equal(r.api.offer('commander','supply').ok,true);
  const check=(label,mutate,expected=false)=>{Object.assign(state(r),plain(baselineState));mutate(r);const before=plain(state(r)),tasks=[...r.tasks.keys()];const result=plain(r.api.offer('commander','supply'));assert.equal(result.ok,expected,label+': '+JSON.stringify(result));equal(state(r),before,label+' Gate state pure');equal([...r.tasks.keys()],tasks,label+' no scheduling');observations.push({label,result});};
  check('null capsule',r=>npc(r).memory.relayCoreHandoff=null);
  check('wrong source recipient',r=>npc(r).memory.relayCoreHandoff.recipientId='radio');
  check('successor has no original source',r=>{npc(r).lifeState='dead';npc(r).hp=0;const q=npc(r,'radio');q.actingRole='commander';q.actingFor='commander';});
  check('role replaced',r=>npc(r).actingRole='radio');
  check('garrison',r=>npc(r).garrisonedOutpostId='watchPost');
  check('dead',r=>{npc(r).hp=0;r.api.syncLife(npc(r));});
  check('critical',r=>{npc(r).hp=20;r.api.syncLife(npc(r));});
  check('fleeing',r=>npc(r).combatStatus='fleeing');
  check('injured noncritical remains legal',r=>{npc(r).hp=60;r.api.syncLife(npc(r));},true);
  check('outside new one-unit Gate',r=>state(r).player.x=npc(r).x-1.1);
  Object.assign(state(r),plain(baselineState));state(r).player.x=npc(r).x-1.1;assert.equal(r.api.npcGate('commander',{action:'view'}).ok,true,'original 1.25 view range retained');
  Object.assign(state(r),plain(baselineState));r.api.session.mode='BATTLE';assert.equal(r.api.offer('commander').ok,false);r.api.session.mode='DAY';
  assert.equal(r.api.offer('radio').ok,false);artifact('gate-observations.json',observations,'actual-pure-Gate-results');return {cases:observations.length,originalViewRange:true,phaseNegative:true};
});
test('real open close pending normal writer and source rolled out of ledger',()=>{
  const r=boot(nearRaw,'pending'), before=stableFacts(r);open(r,'TEST-ONLY-pending-open');equal(stableFacts(r),before,'open has no fixed business cost');
  const identity=plain(active(r));r.api.closeInfo();equal(active(r),identity,'closing UI is not ending content');
  open(r,'TEST-ONLY-pending-reopen');equal(active(r),identity,'same pending instance');
  const raw=normal(r,'pending-save'), next=boot(raw,'pending-reload');equal(active(next),identity);assert.equal(next.api.offer('commander','supply').ok,true);equal(npc(next).memory.relayCoreHandoff,capsule);
  for(let i=0;i<510;i++) next.api.log('TEST-ONLY.ledgerPadding',{index:i});
  assert.equal(log(next).some(e=>e.eventId===capsule.eventId),false,'real bounded source ledger has evicted original receipt');
  equal(npc(next).memory.relayCoreHandoff,capsule);assert.equal(next.api.offer('commander','supply').ok,true);
  const rolledRaw=explicitWriter(next,'source-rolled-window');artifact('source-rolled-window-native.json',rolledRaw,'TEST-ONLY-actual-writer-after-real-ledger-window-padding');
  const rolled=boot(rolledRaw,'rolled-reload');assert.equal(rolled.api.offer('commander','supply').ok,true);equal(active(rolled).source,capsule);
  return {sourceEventPresentInOriginal:true,sourceEventEvictedInControlledWriter:true,pendingNormalReload:true};
});
function supplyRun(raw,label) {
  const r=boot(raw,label);open(r,'TEST-ONLY-deterministic-open');const before=stableFacts(r), seq=state(r).worldMeta.eventSeq;
  const res=resolve(r,'supply','TEST-ONLY-deterministic-supply');assert.equal(res.ok,true,JSON.stringify(res));
  const after=stableFacts(r), expected=plain(before);expected.stone--;expected.relayProject.materialProgress.stone++;
  equal(after,expected,'only one stock to project transfer; zero fixed time/E/work/relationship/standing/RNG');
  assert.equal(state(r).contentState.flags[FLAG],true);assert.equal(active(r),undefined);
  const reply=state(r).contentState.npcRelayStoneReply;equal(reply.source,capsule);assert.equal(reply.choiceId,'supply');assert.equal(reply.instanceKey,r.api.instanceKey(capsule));
  assert.ok(state(r).contentState.completedChains.includes(CHAIN));
  return {r,before,projection:{stone:state(r).stone,project:plain(state(r).relayProject),reply:plain(reply),flags:plain(state(r).contentState.flags),rng:state(r).worldMeta.rngState,events:plain(log(r).filter(e=>e.seq>seq))}};
}
test('supply exact gross transfer deterministic trajectory and unchanged construction requirements',()=>{
  const a=supplyRun(nearRaw,'supply-a'),b=supplyRun(nearRaw,'supply-b');equal(a.projection,b.projection,'two independent same-input/same-command authoritative trajectory');
  artifact('supply-business-observation.json',{before:a.before,after:stableFacts(a.r),projection:a.projection,projectionSha256:sha(JSON.stringify(a.projection)),secondProjectionSha256:sha(JSON.stringify(b.projection))},'actual-gross-and-deterministic-projection');
  assert.equal(state(a.r).relayProject.status,'staging');assert.equal(state(a.r).relayProject.workMinutes,0);
  oneTick(a.r);assert.equal(state(a.r).relayProject.status,'building');assert.equal(state(a.r).relayProject.workMinutes,1,'original tick begins work only after reply');
  const r=boot(nearRaw,'crew-negative');npc(r,'quartermaster').hp=0;r.api.syncLife(npc(r,'quartermaster'));
  open(r,'TEST-ONLY-crew-open');assert.equal(resolve(r,'supply','TEST-ONLY-crew-supply').ok,true,'reply itself is not construction crew waiver');oneTick(r);
  assert.equal(state(r).relayProject.workMinutes,0);assert.notEqual(state(r).relayProject.status,'online');
  const raw=normal(b.r,'supply-terminal'),n=boot(raw,'supply-terminal-reload');assert.equal(n.api.offer('commander').ok,false);assert.equal(state(n).stone,0);assert.equal(state(n).relayProject.materialProgress.stone,4);
  oneTick(n);assert.equal(state(n).stone,0);assert.equal(state(n).relayProject.materialProgress.stone,4);return {projectionSha256:sha(JSON.stringify(a.projection)),fixedTime:0,stockDelta:-1,materialDelta:1,originalNextTickAndMissingCrew:true,terminalNormalReload:true};
});
test('later at zero inventory terminal writer restores without cost or reopening',()=>{
  const r=boot(zeroRaw,'later'),before=stableFacts(r);assert.equal(r.api.offer('commander','supply').ok,false);assert.equal(r.api.offer('commander','later').ok,true);
  open(r,'TEST-ONLY-later-open');assert.equal(resolve(r,'later','TEST-ONLY-later-resolve').ok,true);equal(stableFacts(r),before,'later no fixed physical/economic effects');
  assert.equal(state(r).contentState.npcRelayStoneReply.choiceId,'later');const raw=normal(r,'later-terminal'),n=boot(raw,'later-terminal-reload');
  assert.equal(state(n).stone,0);assert.equal(state(n).relayProject.materialProgress.stone,3);assert.equal(n.api.offer('commander').ok,false);oneTick(n);assert.equal(state(n).stone,0);assert.equal(state(n).relayProject.materialProgress.stone,3);return {stone:0,normalWriterAndActualContinue:true,nextTickNoSecondDebit:true};
});
test('stale CAS resource competition automatic collection duplicates and durable terminal',()=>{
  const r=boot(nearRaw,'stale');open(r,'TEST-ONLY-stale-open');const savedToken=plain(r.api.token(active(r))), before=business(r);
  for(const variant of [{expectedEventId:'evt-stale'},{expectedEventId:undefined},{expectedInstanceId:'wrong'}]) {
    const result=resolve(r,'supply','TEST-ONLY-stale-'+JSON.stringify(variant),variant);assert.equal(result.ok,false);equal(business(r),before,'stale token has no business effect');
  }
  state(r).stone=0;const resourceBefore=business(r);assert.equal(resolve(r,'supply','TEST-ONLY-resource-competition').ok,false);equal(business(r),resourceBefore);assert.equal(r.api.offer('commander','later').ok,true);
  const auto=boot(nearRaw,'auto-stale');open(auto,'TEST-ONLY-auto-open');state(auto).relayProject.materialClock=29;const stoneBefore=state(auto).stone;oneTick(auto);
  assert.equal(state(auto).relayProject.materialProgress.stone,4,'actual old autonomous collector fills window');assert.equal(state(auto).stone,stoneBefore-1);
  const afterAuto=business(auto);assert.equal(resolve(auto,'supply','TEST-ONLY-after-auto').ok,false);equal(business(auto),afterAuto,'no fifth stone after window closes');
  const t=supplyRun(nearRaw,'durable').r, after=business(t);const repeated=resolve(t,'supply','TEST-ONLY-deterministic-supply');assert.equal(repeated.duplicate,true);equal(business(t),after,'same parent duplicate not paid twice');
  // Explicitly evict rolling convenience histories. Persistent terminal reply is retained.
  state(t).contentState.completedChains=Array.from({length:100},(_,i)=>'TEST-ONLY-other-chain-'+i);state(t).contentState.appliedEffects=[];state(t).contentState.history=[];
  const terminalRaw=explicitWriter(t,'terminal-after-history-eviction'),n=boot(terminalRaw,'durable-reload');assert.equal(n.api.offer('commander').ok,false);assert.equal(n.api.openOffer('commander',{commandId:'TEST-ONLY-no-reopen'}).ok,false);assert.equal(state(n).stone,0);assert.equal(state(n).relayProject.materialProgress.stone,4);
  artifact('stale-and-window-observation.json',{savedToken,automaticAfter:afterAuto,terminal:state(n).contentState.npcRelayStoneReply},'actual-stale-resource-and-terminal-results');return {staleCases:3,actualAutomaticCollector:true,durableTerminalAfterTESTONLYHistoryEviction:true};
});
test('actual late logger faults roll back business domains without refunding CommandBus audit',()=>{
  const observations=[];
  for(const eventType of ['content.effects.applied','content.chain.resolved']) {
    const r=boot(nearRaw,'fault-'+eventType.replaceAll('.','-'));open(r,'TEST-ONLY-fault-open');const before=business(r),oldSeq=state(r).worldMeta.eventSeq,oldCommandSeq=state(r).worldMeta.commandSeq;
    r.api.installFault(eventType);const result=resolve(r,'supply','TEST-ONLY-fault-'+eventType);
    artifact('raw-fault-'+eventType.replaceAll('.','-')+'.json',{before,after:business(r),result:plain(result),faultHit:r.api.faultHit?plain(r.api.faultHit):null,ledger:plain(log(r)),oldSeq,oldCommandSeq},'actual-fault-observation-before-oracle');
    assert.equal(result.ok,false);assert.equal(result.reason,eventType==='content.effects.applied'?'content-effect-exception':'npc-relay-stone-transaction-failed','exact actual inner/outer typed rejection');
    assert.ok(r.api.faultHit,'fault must occur after original real logger');assert.equal(r.api.faultHit.stone,before.facts.stone-1);assert.equal(r.api.faultHit.progress,before.facts.relayProject.materialProgress.stone+1);
    if(eventType==='content.chain.resolved')assert.equal(r.api.faultHit.terminal,true,'outer fault is after terminal assignment');
    equal(business(r),before,'complete owned business rollback');assert.ok(state(r).worldMeta.commandSeq>=oldCommandSeq,'CommandBus reservation does not need refund');
    const appended=plain(log(r).filter(e=>e.seq>oldSeq));assert.equal(appended.some(e=>e.type==='content.effects.applied'||e.type==='content.chain.resolved'),false,'no leaked business success receipts');
    assert.ok(appended.every(e=>e.type.startsWith('command.')),'failed attempt audit is separate');observations.push({eventType,result:plain(result),faultHit:plain(r.api.faultHit),beforeCommandSeq:oldCommandSeq,afterCommandSeq:state(r).worldMeta.commandSeq,appended});
  }
  const forged=boot(nearRaw,'forged-effect'),b=business(forged);const result=forged.api.contentEffects([{op:'npcRelayStoneReply',choiceId:'supply',amount:1}],{defId:CHAIN,actorId:'player-1',effectId:'TEST-ONLY-forged'});assert.equal(result.ok,false);equal(business(forged),b);
  artifact('late-fault-observations.json',observations,'actual-post-effect-and-post-terminal-logger-faults');return {lateFaults:observations.length,privateAuthorityNegative:true,commandReservationNotRefunded:true};
});
test('external baseline C2 package and old binding remain exact through new pack paths',()=>{
  const findRaw=name=>source.split(/\r?\n/).find(line=>line.includes('const '+name+' ='));
  artifact('baseline-identity-shape.json',baseline,'external-baseline-shape');
  const expectedScenario=baseline.SCENARIO_BOOT_PACKAGE.rawDeclarationSha256;
  const expectedWatchpost=baseline.WATCHPOST_MANUAL_PACK.rawDeclarationSha256;
  assert.equal(sha(findRaw('SCENARIO_BOOT_PACKAGE')),expectedScenario);assert.equal(sha(findRaw('WATCHPOST_MANUAL_PACK')),expectedWatchpost);
  assert.equal(sha(readFileSync(path.join(root,'scripts/lib/scenario-package-v1.mjs'))),baseline['scripts/lib/scenario-package-v1.mjs'].sha256);
  const r=boot(nearRaw,'baseline-binding');equal(r.api.stonePack,JSON.parse(readFileSync(packPath,'utf8')),'authored JSON is actual bound inline pack');
  const before=plain(state(r).scenarioSnapshot),rng=state(r).worldMeta.rngState;open(r,'TEST-ONLY-binding-open');resolve(r,'later','TEST-ONLY-binding-later');
  equal(state(r).scenarioSnapshot,before);assert.equal(state(r).worldMeta.rngState,rng);equal(before,mother.scenarioSnapshot);
  assert.equal(before.contentBinding.registry.some(x=>x.id===CHAIN),false,'authored optional pack does not silently alter C2 compiled registry');
  return {oldRawDeclarationsExact:true,oldC2CoreModuleExact:true,oldConfigBindingAndZeroTimeRngExact:true,newPackSeparate:true};
});
const dependenciesAfter=files.map(pin),inputsUnchanged=JSON.stringify(dependenciesBefore)===JSON.stringify(dependenciesAfter);
assert.equal(inputsUnchanged,true,'all executed input bytes unchanged');
const report={schema:'NpcRelayStoneSourceContractV1',runner:'check-npc-relay-stone-v1',ok:checks.every(c=>c.ok)&&inputsUnchanged,sourceHtmlSha256,count:checks.length,passed:checks.filter(c=>c.ok).length,checks,
  instrumentation:'complete real inline and existing controlled DOM/storage/timers; aliases and explicitly labelled TEST-ONLY stimuli only',naturalGameplay:false,browser:false,uniqueContracts:1,
  fixtureInput:pin(inputPath),derivedInputs:produced,artifacts,dependenciesBefore,dependenciesAfter,inputsUnchanged,untested:['natural route and human understanding','all possible death/succession histories; representative controlled source negatives only','browser rendering and actual wall-clock scheduling'],errors};
writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,runner:report.runner,sourceHtmlSha256,count:report.count,passed:report.passed,out,derivedInputs:produced.map(x=>({id:x.id,path:x.absolutePath,sha256:x.sha256,bytes:x.bytes}))},null,2));
process.exitCode=report.ok?0:1;
