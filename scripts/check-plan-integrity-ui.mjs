#!/usr/bin/env node
/** Complete actual inline runtime and actual renderPlanMeeting/registered click
 * handler. The explicitly provided IO adapter stubs renderWorld/renderHud/
 * renderContext, DOM/layout, storage, native clocks and queued timers. The
 * modified renderer, CommandBus, normalizer, loader and writer are not replaced.
 * This is portable method evidence; it does not open or test a browser.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

// Only the two pinned complete SAVE21 fixtures in these four legacy checks.
// This validates the exact additive Scenario/routine-intent/handoff-memory receipt; it never removes arbitrary
// migrations or relaxes historical plan/resource/CP/population assertions.

// The authored pack is independent input, not an expectation copied from state.
// Accept exactly its once boot ledger and preserve every prior replay field.
function expectedWatchpostBootLedger(before,after,htmlText){
  before=JSON.parse(JSON.stringify(before));after=JSON.parse(JSON.stringify(after));
  const raw=readFileSync(new URL('../content/packs/watchpost-manual-v1.json',import.meta.url));
  assert.equal(createHash('sha256').update(raw).digest('hex'),'b2d196a171d3a4e828d8486c36ea664992e51fd8df1223ea395172a511b869e3','actual authored watchpost pack SHA');
  const match=/const WATCHPOST_MANUAL_PACK = observerDeepFreeze\((\{[^\n]+\})\);/.exec(htmlText);assert.ok(match,'actual embedded watchpost pack');assert.deepEqual(JSON.parse(match[1]),JSON.parse(raw));
  const binding={status:'bound',packId:'watchpost-manual-v1',version:1,definitionVersion:1,digest:'fnv1a-utf16-canonical-hex-v1:b8d8b128'};
  const old=before.worldMeta.replay.contentPacks||[],already=old.some(v=>JSON.stringify(v)===JSON.stringify(binding)),reportOnly=before.night===true&&before.nightBattle?.resolved===true,load=!reportOnly&&!already;
  const replay=reportOnly?before.worldMeta.replay:{...before.worldMeta.replay,contentPacks:[...old.filter(v=>v.packId!==binding.packId),binding]};
  const added=after.worldMeta.events.filter(e=>e.seq>before.worldMeta.eventSeq),migrations=added.filter(e=>e.type==='save.migrated');assert.ok(migrations.length<=1,'at most original declared boot migration');
  const seq=before.worldMeta.eventSeq+migrations.length+1;
  const event={eventId:`evt-${String(seq).padStart(6,'0')}`,seq,type:'content.pack.loaded',actorId:'system',commandId:null,causationId:null,
    tick:{world:(before.day-1)*1440+before.hour*60+before.minute,phase:before.worldMeta.clock.phaseMinutes,schedule:before.worldMeta.clock.scheduleMinutes},payload:binding,
    defId:'watchpost-003',definitionVersion:1,instanceId:after.eventInstance?.instanceId||null,effects:[]};
  assert.deepEqual(after.worldMeta.replay,replay,'only exact authored pack binding may be added to old replay');
  assert.deepEqual(added.map(e=>e.type),[...migrations.map(()=>'save.migrated'),...(load?['content.pack.loaded']:[])],'no extra boot business/reward event');
  if(load)assert.deepEqual(added.at(-1),event,'one exact boot pack receipt after original migration');
  const end=before.worldMeta.eventSeq+migrations.length+(load?1:0);assert.equal(after.worldMeta.eventSeq,end);assert.equal(after.worldMeta.lastEventId,`evt-${String(end).padStart(6,'0')}`);
  assert.deepEqual(after.worldMeta.events.slice(0,before.worldMeta.events.length),before.worldMeta.events,'old event prefix retained');
  return{binding,replay,event:load?event:null,end};
}

function hasOnlyExpectedScenarioLegacyMigration(runtime, envelope) {
  const s = runtime.api.state, p = envelope.payload, eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  if (!['707889bd','7fde7715'].includes(envelope.checksum)) return false;
  const date = { day: p.day, hour: p.hour, minute: p.minute }, seq = p.worldMeta.eventSeq + 1;
  const handoffMissing = p.npcs.filter(n=>!Object.hasOwn(n.memory,'relayCoreHandoff')).map(n=>n.id);
  const expectedMemories = p.npcs.map(n=>Object.hasOwn(n.memory,'relayCoreHandoff') ? n.memory : {...n.memory,relayCoreHandoff:null});
  const expected = { eventId: `evt-${String(seq).padStart(6,'0')}`, seq, type: 'save.migrated', actorId: 'system', commandId: null, causationId: null,
    tick: { world: (p.day-1)*1440+p.hour*60+p.minute, phase: p.worldMeta.clock.phaseMinutes, schedule: p.worldMeta.clock.scheduleMinutes },
    payload: { migration: 'resolved-report-recovery-001', migrationVersion: 1, reason: 'npc-routine-intent-v1,scenario-legacy-unbound-v1,scenario-content-binding-v1' + (handoffMissing.length ? ',npc-relay-handoff-memory-v1' : ''), sourceCategory: 'primary',
      originalChecksum: envelope.checksum, originalDate: date, selectedChecksum: envelope.checksum, selectedDate: date, rollback: false, instanceId: null,
      fromSaveVersion: 21, fromContentVersion: 3, adapter: null, addedDomains: ['npc.routineIntent',...(handoffMissing.length ? ['npc.memory.relayCoreHandoff'] : [])],
      npcRoutineIntentAdapters: [{ adapter: 'npc-routine-intent-v1', npcIds: p.npcs.map(n=>n.id), defaultValue: null }], scenarioBindingAdapters: [{ adapter: 'scenario-legacy-unbound-v1',
        sourceSeed: p.worldMeta.seed, hadDeclaredSnapshot: Object.hasOwn(p,'scenarioSnapshot'), seedSource: 'saved-world-meta', declaredSeed: p.scenarioSnapshot?.seed ?? null,
        liveSeed: p.worldMeta.seed, aiDowngraded: false, effectiveAuthority: 'expression_only' }],
      scenarioContentAdapters: [{adapter:'scenario-content-binding-v1',oldPackageDigest:null,oldBindingStatus:'missing',
        compilerVersion:'scenario-event-chain-v1',catalogDigest:'fnv1a-utf16-canonical-hex-v1:33e5b74b',rulesDigest:'fnv1a-utf16-canonical-hex-v1:b19c6fb5'}],
      ...(handoffMissing.length ? {npcRelayHandoffMemoryAdapters:[{adapter:'npc-relay-handoff-memory-v1',npcIds:handoffMissing,defaultValue:null}]} : {}) } };
  const added = s.worldMeta.events.filter(event => event.seq > p.worldMeta.eventSeq), stored = runtime.storage.get(saveKey);
  if (!stored || !runtime.api.validate({raw:stored,sourceCategory:'primary'}).ok) return false;
  const written = JSON.parse(stored).payload;
  const packLedger=expectedWatchpostBootLedger(p,s,readFileSync(htmlPath,'utf8'));
  // Keep every original persisted fact, using the pinned writer as expected.
  // activeCommandId:null is an existing loader default, not a new relaxed field.
  const expectedNpcs = p.npcs.map((n,index)=>({ ...n, memory: expectedMemories[index], routineIntent: null }));
  const expectedMeta = { ...p.worldMeta, activeCommandId: null, lastCheckpointReason:'session-start', replay:packLedger.replay,eventSeq: seq+1,
    lastEventId: packLedger.event.eventId, events: [...p.worldMeta.events, expected,packLedger.event] };
  for (const key of Object.keys(p)) assert.deepEqual(written[key], key === 'npcs' ? expectedNpcs : key === 'worldMeta' ? expectedMeta : p[key], `original persisted ${key}`);
  assert.deepEqual(Object.keys(written).sort(), [...new Set([...Object.keys(p),'scenarioSnapshot'])].sort());
  return eq(added,[expected,packLedger.event]) && s.worldMeta.eventSeq === seq+1
    && eq(s.worldMeta.events.slice(0,p.worldMeta.events.length),p.worldMeta.events)
    && eq(written.worldMeta.events,s.worldMeta.events) && written.version === 21 && written.contentState.contentVersion === 3
    && s.worldMeta.seed === p.worldMeta.seed && s.worldMeta.rngState === p.worldMeta.rngState && eq(s.worldMeta.replay,packLedger.replay)
    && s.worldMeta.commandSeq === p.worldMeta.commandSeq && eq(s.worldMeta.seenCommands,p.worldMeta.seenCommands)
    && eq(s.world,p.world) && ['day','hour','minute','hp','energy','sanity','wood','stone','food','seeds','parts','medicine','morale'].every(key => s[key] === p[key])
    && eq(s.resources,p.resources) && eq(s.npcs.map(n=>({id:n.id,hp:n.hp,lifeState:n.lifeState})),p.npcs.map(n=>({id:n.id,hp:n.hp,lifeState:n.lifeState})))
    && s.npcs.every(n=>n.routineIntent===null) && written.npcs.every(n=>n.routineIntent===null)
    && eq(s.npcs.map(n=>n.memory),expectedMemories) && eq(written.npcs.map(n=>n.memory),expectedMemories)
    && eq(s.contentState.planMeeting,p.contentState.planMeeting) && s.contentState.commandPoints === p.contentState.commandPoints
    && eq(s.scenarioSnapshot.binding,{version:1,status:'legacy-unbound',sourceSeed:p.worldMeta.seed,declaredSnapshot:p.scenarioSnapshot??null})
    && s.scenarioSnapshot.seed === p.worldMeta.seed
    && eq(s.scenarioSnapshot.contentBinding,{version:1,status:'bound',compilerVersion:'scenario-event-chain-v1',
      catalogDigest:'fnv1a-utf16-canonical-hex-v1:33e5b74b',rulesDigest:'fnv1a-utf16-canonical-hex-v1:b19c6fb5',
      registry:[{kind:'eventDef',id:'relay-chain-001'},{kind:'eventChain',id:'zh-food-shortage-001'}]})
    && eq(written.scenarioSnapshot.contentBinding,s.scenarioSnapshot.contentBinding);
}

const usage = 'node check-plan-integrity-ui.mjs --html HTML --io-adapter RECOVERY_CHECKER --legacy-fixture JSON --out REPORT_JSON';
if (process.argv.slice(2).includes('--help')) { console.log(usage); process.exit(0); }
const args = process.argv.slice(2), options = {};
assert.equal(args.length, 8, usage);
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--html','--io-adapter','--legacy-fixture','--out'].includes(args[i]) && args[i+1] && !options[args[i]], usage);
  options[args[i]] = path.resolve(args[i+1]);
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const htmlPath = options['--html'], bytes = readFileSync(htmlPath), source = bytes.toString('utf8');
const adapterBytes = readFileSync(options['--io-adapter']), adapterSource = adapterBytes.toString('utf8');
const begin = adapterSource.indexOf('function runtime(entries = []) {');
const end = adapterSource.indexOf('\nfunction envelope(payload)', begin);
assert.ok(begin >= 0 && end > begin, 'explicit IO adapter entry markers');
const inline = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(text => text.trim());
assert.equal(inline.length, 1); new vm.Script(inline[0], { filename: htmlPath });
const saveKey = 'zombie-harvest-progress-v12';
const runtime = vm.runInNewContext(`(${adapterSource.slice(begin,end).trim()})`, { inline, htmlPath, saveKey, vm, assert, console, URLSearchParams });
const legacyPath = options['--legacy-fixture'];
const legacyBytes = readFileSync(legacyPath), legacyRaw = legacyBytes.toString('utf8');
const metaPath = legacyPath.replace(/\.json$/, '.meta.json');
assert.notEqual(metaPath, legacyPath, 'fixture requires .json extension and adjacent .meta.json');
const fixtureMeta = JSON.parse(readFileSync(metaPath,'utf8')), fixture = JSON.parse(legacyRaw);
assert.equal(fixtureMeta.testOnly, true); assert.equal(fixtureMeta.naturalGameplay,false);
assert.equal(fixtureMeta.receiptFabricated,false);
assert.equal(sha(legacyBytes), fixtureMeta.fileSha256); assert.equal(fixture.checksum,fixtureMeta.checksum);
assert.equal(fixture.version,21); assert.equal(fixture.payload.contentState.contentVersion,3);
assert.equal(fixture.payload.contentState.planMeeting.status,'committed');
assert.equal(fixture.payload.contentState.planMeeting.instanceId,fixtureMeta.instanceId);

function fresh(entries=[]) {
  const r = runtime(entries);
  vm.runInContext('qa.planRender = renderPlanMeeting;', r.context);
  r.emit('continueSaveBtn','click'); assert.equal(r.api.started,true); assert.equal(r.api.session.mode,'DAY');
  return r;
}
function settleLegacyBootCheckpoint(r) {
  const before=r.storage.get(saveKey),pending=[...r.tasks].filter(([,t])=>t.kind==='timeout'&&t.delay===650);
  assert.equal(pending.length,1,'actual already-queued normal startup checkpoint');
  for(const[id,t]of pending){r.tasks.delete(id);t.callback();}
  const after=r.storage.get(saveKey);assert.equal(r.api.validate({raw:after,sourceCategory:'primary'}).ok,true);
  const receipt={scope:'actual queued 650ms checkpoint only; no explicit save or pagehide',beforeSha256:sha(before),afterSha256:sha(after)};
  writeFileSync(options['--out']+'.boot-migration-before.json',before,{flag:'wx'});writeFileSync(options['--out']+'.boot-checkpoint-after.json',after,{flag:'wx'});receipt.beforeFile=path.basename(options['--out'])+'.boot-migration-before.json';receipt.afterFile=path.basename(options['--out'])+'.boot-checkpoint-after.json';
  return receipt;
}
function seed(trust,cp) {
  const r=fresh(); r.api.state.contentState.meters.campTrust=trust;
  Object.assign(r.api.state.contentState,{commandPoints:cp,commandPointsMax:cp,commandPointsGrantedDay:r.api.state.day});
  assert.equal(r.api.generatePlan({source:'TEST-ONLY UI seed'}).ok,true); return r;
}
// This small IO parser reads the actual rendered attributes; it does not compute
// trust/CP/day eligibility. Browser layout, focus and native click dispatch are
// deliberately not claimed. The registered source listener receives this DOM
// adapter's target, and must itself respect the rendered disabled property.
function buttons(html) {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].flatMap(match=>{
    const action=match[1].match(/data-plan-action="([^"]+)"/),id=match[1].match(/data-plan-id="([^"]+)"/);
    if(!action||!id)return [];
    const button={disabled:/(?:^|\s)disabled(?:\s|=|$)/.test(match[1]),dataset:{planAction:action[1],planId:id[1]},textContent:match[2]};
    button.closest=selector=>selector==='[data-plan-action]'?button:null; return [button];
  });
}
function snapshot(r) { return JSON.stringify(clone(r.api.state)); }
function render(r) {
  const before=snapshot(r),raw=r.storage.get(saveKey),seq=r.api.state.worldMeta.eventSeq,count=r.tasks.size;
  r.api.planRender(); const html=r.node('infoPlanMount').innerHTML;
  return {html,buttons:buttons(html),pure:before===snapshot(r)&&r.storage.get(saveKey)===raw&&r.api.state.worldMeta.eventSeq===seq&&r.tasks.size===count};
}
const report={runner:'source-plan-integrity-ui-phase',sourceHash:sha(bytes),adapterSourceHash:sha(adapterBytes),sourceFile:path.basename(htmlPath),
  browserStarted:false,naturalGameplayExecuted:false,rendererReplaced:false,controllerReplaced:false,
  purityBoundary:'serialized state value plus ledger/save/timer stability; object-reference identity and native browser layout are not asserted',
  ioMocks:{dom:'in-memory nodes; source innerHTML attributes parsed without layout or focus',storage:'Map-backed local/session storage',
    clocks:'controlled Date.now/performance.now',timers:'queued callbacks; asynchronous real-time callbacks not run',
    bootstrap:'unrelated final Canvas render omitted',replacedRenderingFunctions:['renderWorld','renderHud','renderContext'],
    preservedFunctions:['renderPlanMeeting','handlePlanMeetingAction','commitPlanMeeting','generatePlanMeeting','CommandBus','ensureContentState','loadProgress','saveProgress']},
  fixture:{name:path.basename(legacyPath),sha256:sha(legacyBytes),checksum:fixture.checksum,provenance:fixtureMeta},checks:[],failures:[]};
function check(name,ok,detail={}) {report.checks.push({name,ok:!!ok,detail});if(!ok)report.failures.push(name);}
function scenario(name,run){try{run();}catch(error){check(name+' executes',false,{error:String(error.stack||error)});}}
for(const trust of [59,59.99,60])for(const cp of [0,1])scenario(`trust ${trust} CP${cp}`,()=>{
  const r=seed(trust,cp),view=render(r),disabled=trust<60||cp===0;
  check(`trust ${trust} CP${cp} actual renderer preserves serialized facts`,view.pure);
  check(`trust ${trust} CP${cp} all support/modify/deny disabled properties match permission`,view.buttons.length===7
    &&new Set(view.buttons.map(b=>b.dataset.planAction)).size===3&&view.buttons.every(b=>b.disabled===disabled),
    {buttons:view.buttons.map(({dataset,disabled})=>({action:dataset.planAction,disabled}))});
  const expectedHint=cp===0?'指挥点不足':'可消耗 1 点指挥点';
  const hasHint=trust<60?view.html.includes('营地信任需达到 60')&&view.html.includes(`当前 ${trust}`)
    &&view.html.includes(`<b>${trust}</b>`)&&!view.html.includes('可消耗 1 点指挥点'):view.html.includes(expectedHint);
  check(`trust ${trust} CP${cp} actual visible permission text explains gate`,hasHint,{html:view.html});
  if(disabled){const before=snapshot(r),seq=r.api.state.worldMeta.commandSeq,tasks=r.tasks.size;
    for(const button of view.buttons)r.emit('infoPlanMount','click',{target:button});
    check(`trust ${trust} CP${cp} disabled actual registered handler emits no command or reward`,snapshot(r)===before
      &&r.api.state.worldMeta.commandSeq===seq&&r.tasks.size===tasks);
  }
});
for(const action of ['support','modify','deny'])scenario(`allowed ${action}`,()=>{
  const r=seed(60,1),view=render(r),button=view.buttons.find(b=>b.dataset.planAction===action);assert.ok(button&&!button.disabled);
  r.emit('infoPlanMount','click',{target:button}); const plan=r.api.state.contentState.planMeeting;
  const receipts=r.api.state.worldMeta.events.filter(e=>e.type==='plan.meeting.committed');
  check(`enabled ${action} actual registered listener commits once and spends exactly one CP`,plan.status==='committed'
    &&plan.playerAction===action&&r.api.state.contentState.commandPoints===0&&receipts.length===1
    &&r.api.state.worldMeta.replay.commands.filter(c=>c.commandId===receipts[0].commandId&&c.type==='plan.meeting.commit').length===1);
  const before=snapshot(r),seq=r.api.state.worldMeta.commandSeq,committedView=render(r);
  check(`committed ${action} actual renderer preserves plan/CP and removes interventions`,committedView.pure
    &&committedView.buttons.length===0&&committedView.html.includes('已在第 1 天提交'));
  r.emit('infoPlanMount','click',{target:button});
  // A stale formerly-enabled DOM node can reach the real reducer, which must
  // refuse plan-not-open. The rejection ledger is legitimate; protected plan
  // and CP must remain stable while no second committed receipt appears.
  check(`stale enabled ${action} node cannot submit or debit twice`,r.api.state.contentState.planMeeting.playerAction===action
    &&r.api.state.contentState.commandPoints===0&&r.api.state.worldMeta.commandSeq===seq+1
    &&JSON.stringify(clone(r.api.state.contentState))===JSON.stringify(JSON.parse(before).contentState)
    &&r.api.state.worldMeta.events.filter(e=>e.type==='plan.meeting.committed').length===1
    &&r.api.state.worldMeta.events.at(-1).type==='command.rejected', {beforePlan:JSON.parse(before).contentState.planMeeting,afterPlan:clone(r.api.state.contentState.planMeeting)});
});
for(const phase of ['night','expired','gameOver'])scenario(`${phase} guard`,()=>{
  const r=seed(60,1);
  if(phase==='night'){r.api.state.night=true;r.api.session.mode='BATTLE';}
  if(phase==='expired'){r.api.state.day=2;r.api.state.hour=0;r.api.state.minute=0;r.api.state.world.totalMinutes=1440;}
  if(phase==='gameOver'){r.api.state.hp=0;r.api.state.gameOver='lose';r.api.session.mode='LOSS';}
  const view=render(r),expected={night:'先关闭尸潮报告',expired:'候选不属于今天',gameOver:'本局已结束'}[phase];
  check(`${phase} actual renderer preserves serialized facts and all intervention buttons disabled`,view.pure&&view.buttons.length===7&&view.buttons.every(b=>b.disabled));
  check(`${phase} actual status message gives matching reason`,view.html.includes(expected));
  const before=snapshot(r);for(const button of view.buttons)r.emit('infoPlanMount','click',{target:button});
  check(`${phase} disabled handler cannot mutate input state`,snapshot(r)===before);
});

// Explicit TEST-ONLY phase inputs expose contradictory report night=false and
// session flags; the actual controller methods are never replaced or mocked.
for(const phase of ['REPORT','RECOVERY','LOSS','SAVING','EXITING','DAY-exiting'])scenario(`session ${phase} night=false`,()=>{
  const r=seed(60,1);r.api.state.night=false;
  r.api.session.mode=phase==='DAY-exiting'?'DAY':phase;
  r.api.session.exiting=phase==='DAY-exiting';
  check(`${phase} actual SessionController rejects daytime input`,r.api.session.isDay()===false);
  const view=render(r);
  check(`${phase} night=false rendered facts stable and all interventions disabled`,view.pure&&view.buttons.length===7&&view.buttons.every(b=>b.disabled));
  check(`${phase} actual visible note explains report/recovery and DAY boundary`,view.html.includes('报告')&&view.html.includes('存档恢复')&&view.html.includes('白天'));
  const before=snapshot(r),seq=r.api.state.worldMeta.commandSeq,tasks=r.tasks.size;
  for(const button of view.buttons)r.emit('infoPlanMount','click',{target:button});
  check(`${phase} disabled registered listener creates no command or toast task`,snapshot(r)===before&&r.api.state.worldMeta.commandSeq===seq&&r.tasks.size===tasks);
});
scenario('complete old committed writer fixture',()=>{
  const r=fresh([[saveKey,legacyRaw]]),p=fixture.payload;
  assert.equal(r.api.hash(p),fixture.checksum);assert.equal(r.api.validate({raw:legacyRaw,sourceCategory:'primary'}).ok,true);
  const view=render(r);
  const bootCheckpoint=settleLegacyBootCheckpoint(r);
  const migratedRaw=r.storage.get(saveKey),reloaded=fresh([[saveKey,migratedRaw]]),reloadedRaw=reloaded.storage.get(saveKey);
  check('complete old committed source-writer fixture boots with same plan and spent CP',JSON.stringify(clone(r.api.state.contentState.planMeeting))===JSON.stringify(p.contentState.planMeeting)
    &&r.api.state.contentState.commandPoints===p.contentState.commandPoints&&hasOnlyExpectedScenarioLegacyMigration(r,fixture)
    &&JSON.stringify(JSON.parse(reloadedRaw).payload)===JSON.stringify(JSON.parse(migratedRaw).payload)
    &&JSON.stringify(reloaded.api.state.worldMeta.events.filter(e=>e.type==='save.migrated'))===JSON.stringify(r.api.state.worldMeta.events.filter(e=>e.type==='save.migrated')),
    {bootCheckpoint,migration:clone(r.api.state.worldMeta.events.filter(e=>e.type==='save.migrated')),migratedNativeSha256:sha(migratedRaw),reloadedNativeSha256:sha(reloadedRaw),secondContinuePreservesFullPayload:JSON.stringify(JSON.parse(reloadedRaw).payload)===JSON.stringify(JSON.parse(migratedRaw).payload)});
  check('actual legacy committed renderer preserves serialized facts with no intervention buttons',view.pure&&view.buttons.length===0
    &&view.html.includes('已在第 1 天提交')&&view.html.includes(p.contentState.planMeeting.candidates.find(c=>c.id===p.contentState.planMeeting.selectedId).title));
  const before=snapshot(r);render(r);check('repeated legacy committed rendering cannot refund CP or erase commitment',snapshot(r)===before);
});
scenario('idle view',()=>{const r=fresh(),view=render(r);check('idle actual renderer preserves serialized facts with no buttons',view.pure&&view.buttons.length===0&&view.html.includes('下一轮尸潮结算'));});
report.ok=report.failures.length===0;report.count=report.checks.length;report.passed=report.checks.filter(c=>c.ok).length;
writeFileSync(options['--out'],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({runner:report.runner,sourceHash:report.sourceHash,ok:report.ok,count:report.count,passed:report.passed,
  browserStarted:false,rendererReplaced:false,failures:report.failures},null,2));
process.exitCode=report.ok?0:1;
