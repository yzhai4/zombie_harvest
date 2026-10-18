#!/usr/bin/env node
/** Actual complete inline runtime; method evidence only, not a browser.
 * commitPlanMeeting/generatePlanMeeting, CommandBus, calendar/effects/loader/
 * writer are preserved. The explicit original recovery IO adapter stubs
 * renderWorld/renderHud/renderContext, final bootstrap Canvas render, DOM/layout,
 * storage, native clocks and queued timer IO. Transient same-day resolved inputs
 * are TEST-ONLY and never saved. Legacy input is the pinned complete TEST-ONLY
 * original 412c writer artifact; no old HTML or old writer is run by this test.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  // Compare every original persisted field. The pre-existing loader supplies
  // activeCommandId:null; only the exact migration ledger, null intent and missing handoff slot
  // are added here. Expected old facts come from the pinned writer, not normalize.
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

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const usage = 'node scripts/check-plan-integrity.mjs [--html HTML] [--io-adapter RECOVERY_CHECKER] [--legacy-fixture JSON] [--out REPORT_JSON]';
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') { console.log(usage); process.exit(0); }
assert.ok(args.length % 2 === 0, usage);
const options = { '--html': path.join(repoRoot, 'dist/index.html'), '--io-adapter': path.join(scriptDir, 'check-report-recovery.mjs'),
  '--legacy-fixture': path.join(scriptDir, 'fixtures/plan-integrity/plan-committed-legacy-basewriter.json'), '--out': null };
const supplied = new Set();
for (let i = 0; i < args.length; i += 2) {
  assert.ok(Object.hasOwn(options,args[i]) && typeof args[i+1] === 'string' && args[i+1] && !args[i+1].startsWith('--') && !supplied.has(args[i]), usage);
  supplied.add(args[i]); options[args[i]] = path.resolve(args[i+1]);
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const saveKey = 'zombie-harvest-progress-v12';
const htmlPath = options['--html'], sourceBytes = readFileSync(htmlPath), source = sourceBytes.toString('utf8');
const adapterPath = options['--io-adapter'], adapterBytes = readFileSync(adapterPath), adapterSource = adapterBytes.toString('utf8');
const fixturePath = options['--legacy-fixture'], fixtureBytes = readFileSync(fixturePath), legacyRaw = fixtureBytes.toString('utf8');
const metaPath = fixturePath.replace(/\.json$/, '.meta.json');
assert.notEqual(metaPath,fixturePath,'legacy fixture must have .json extension and adjacent .meta.json');
const legacyMeta = JSON.parse(readFileSync(metaPath,'utf8')), legacyEnvelope = JSON.parse(legacyRaw);
const originalWriterSha = '412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8';
const originalFixtureSha = 'd9b8811fed88c25f9f1da0849d772d92e19742280f41e2aec3871d178d9bb05b';
assert.equal(legacyMeta.testOnly,true); assert.equal(legacyMeta.naturalGameplay,false); assert.equal(legacyMeta.receiptFabricated,false);
assert.equal(legacyMeta.acquiredBy,'actual complete base inline runtime CommandBus commit and saveProgress writer');
assert.equal(legacyMeta.writerHtmlSha256,originalWriterSha);
assert.equal(legacyMeta.fileSha256,originalFixtureSha); assert.equal(sha(fixtureBytes),originalFixtureSha);
assert.equal(legacyMeta.checksum,'707889bd'); assert.equal(legacyEnvelope.checksum,legacyMeta.checksum);
assert.equal(legacyMeta.saveVersion,21); assert.equal(legacyEnvelope.version,21);
assert.equal(legacyMeta.contentVersion,3); assert.equal(legacyEnvelope.payload.contentState.contentVersion,3);
assert.deepEqual(legacyMeta.declaredInputs,{campTrust:20,commandPointsBeforeCommit:2,action:'modify',selectedOriginalRank:2});
const originalPlan = legacyEnvelope.payload.contentState.planMeeting;
assert.equal(legacyMeta.instanceId,'camp-plan-meeting-001:d1'); assert.equal(originalPlan.instanceId,legacyMeta.instanceId);
assert.equal(originalPlan.status,'committed'); assert.equal(originalPlan.playerAction,'modify');
assert.equal(legacyEnvelope.payload.contentState.meters.campTrust,20); assert.equal(legacyEnvelope.payload.contentState.commandPoints,1);
const originalReceipts = legacyEnvelope.payload.worldMeta.events.filter(e=>e.type==='plan.meeting.committed');
assert.equal(originalReceipts.length,1);
const originalReceipt=originalReceipts[0];
assert.equal(originalReceipt.payload.pointsBefore,2);assert.equal(originalReceipt.payload.pointsAfter,1);
assert.equal(originalReceipt.payload.instanceId,originalPlan.instanceId);assert.equal(originalReceipt.payload.action,'modify');
assert.equal(originalReceipt.payload.selectedId,originalPlan.selectedId);
assert.equal(originalPlan.candidates.find(c=>c.rank===2)?.id,originalPlan.selectedId);
const originalCommands=legacyEnvelope.payload.worldMeta.replay.commands.filter(c=>c.commandId===originalReceipt.commandId&&c.type==='plan.meeting.commit');
assert.equal(originalCommands.length,1);assert.equal(originalCommands[0].payload.action,'modify');
assert.equal(originalCommands[0].payload.planId,originalPlan.selectedId);
const start = adapterSource.indexOf('function runtime(entries = []) {');
const end = adapterSource.indexOf('\nfunction envelope(payload)', start);
assert.ok(start >= 0 && end > start);
const runtimeAdapter = adapterSource.slice(start, end).trim();
function factory(text, filename) {
  const inline = [...text.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
  assert.equal(inline.length, 1); new vm.Script(inline[0]);
  return vm.runInNewContext(`(${runtimeAdapter})`, { inline, htmlPath: filename, saveKey, vm, assert, console, URLSearchParams });
}
const runtime = factory(source, htmlPath);
const fixtureProbe = runtime();
assert.equal(fixtureProbe.api.hash(legacyEnvelope.payload),legacyMeta.checksum,'actual source FNV must verify original payload');
assert.equal(fixtureProbe.api.validate({raw:legacyRaw,sourceCategory:'primary'}).ok,true,'actual source must validate complete original legacy envelope');
function currentRuntime(make = runtime, entries = []) {
  const r = make(entries);
  // Expose the actual existing functions to this VM only. The game definitions
  // stay intact; rendering and asynchronous timer IO are the adapter's scope.
  vm.runInContext('qa.advance = advance; qa.executePlan = executePlanMeeting;', r.context);
  r.emit('continueSaveBtn', 'click');
  assert.equal(r.api.started, true); assert.equal(r.api.session.mode, 'DAY');
  return r;
}
function settleLegacyBootCheckpoint(r) {
  const before=r.storage.get(saveKey),pending=[...r.tasks].filter(([,t])=>t.kind==='timeout'&&t.delay===650);
  assert.equal(pending.length,1,'actual already-queued normal startup checkpoint');
  for(const[id,t]of pending){r.tasks.delete(id);t.callback();}
  const after=r.storage.get(saveKey);assert.equal(r.api.validate({raw:after,sourceCategory:'primary'}).ok,true);
  const receipt={scope:'actual queued 650ms checkpoint only; no explicit save or pagehide',beforeSha256:sha(before),afterSha256:sha(after)};
  if(options['--out']){writeFileSync(options['--out']+'.boot-migration-before.json',before,{flag:'wx'});writeFileSync(options['--out']+'.boot-checkpoint-after.json',after,{flag:'wx'});receipt.beforeFile=path.basename(options['--out'])+'.boot-migration-before.json';receipt.afterFile=path.basename(options['--out'])+'.boot-checkpoint-after.json';}
  return receipt;
}
function seeded(trust = 80, points = 4, make = runtime) {
  const r = currentRuntime(make);
  r.api.state.contentState.meters.campTrust = trust;
  Object.assign(r.api.state.contentState, { commandPoints: points, commandPointsMax: points, commandPointsGrantedDay: r.api.state.day });
  const result = r.api.generatePlan({ source: 'TEST-ONLY original generation' });
  assert.equal(result.ok, true); return r;
}
const protectedFacts = r => clone({ contentState: r.api.state.contentState,
  resources: Object.fromEntries(['hp','wood','stone','food','seeds','parts','medicine','energy','sanity','morale'].map(k => [k,r.api.state[k]])),
  npcs: r.api.state.npcs, world: r.api.state.world, rng: r.api.state.worldMeta.rngState });
const events = (r, type) => clone(r.api.state.worldMeta.events.filter(e => e.type === type));
const report = { runner: 'source-plan-integrity', sourceHash: sha(sourceBytes), adapterSourceHash: sha(adapterBytes),
  evidence: 'complete-actual-inline-VM', browserStarted: false, naturalGameplayExecuted: false, changedFunctionsMocked: false,
  expectedBaselineDefects: sha(sourceBytes) === originalWriterSha,
  ioMocks: { dom: 'in-memory nodes without native layout/focus', storage: 'Map-backed local/session storage', clocks: 'controlled Date.now/performance.now',
    timers: 'queued callbacks; asynchronous real-time callbacks not run', bootstrap: 'unrelated final Canvas render omitted',
    replacedRenderingFunctions: ['renderWorld','renderHud','renderContext'],
    preservedFunctions: ['commitPlanMeeting','generatePlanMeeting','CommandBus','advance','runWorldDayUpkeep','executePlanMeeting','loadProgress','saveProgress'] },
  fixtureBoundary: 'declared input states; transient same-day resolved/fallback inputs are never written/booted; pinned old fixture loaded without executing old HTML',
  checks: [], failures: [] };
function check(name, ok, detail = {}) {
  report.checks.push({ name, ok: !!ok, detail }); if (!ok) report.failures.push(name);
}
function scenario(name, run) {
  try { run(); } catch (error) { check(name + ' executes', false, { error: String(error.stack || error) }); }
}

for (const trust of [0,19,20,40,59,59.99]) for (const action of ['support','deny','modify']) scenario(`trust ${trust} ${action}`, () => {
  const r = seeded(trust, 2), before = protectedFacts(r), result = r.api.commit(action, r.api.state.contentState.planMeeting.candidates[0].id);
  const rejected = events(r,'command.rejected'), commits = events(r,'plan.meeting.committed');
  check(`trust ${trust} ${action} rejected by actual CommandBus without plan/CP/reward`, result.ok === false
    && result.reason === 'camp-trust-low' && JSON.stringify(protectedFacts(r)) === JSON.stringify(before)
    && commits.length === 0 && rejected.length === 1 && rejected[0].payload.reason === 'camp-trust-low'
    && rejected[0].commandId === result.commandId
    && r.api.state.worldMeta.replay.commands.filter(c => c.commandId === result.commandId && c.type === 'plan.meeting.commit').length === 1,
    { result: clone(result), pointsBefore: before.contentState.commandPoints, pointsAfter: r.api.state.contentState.commandPoints, committedReceipts: commits.length, rejected });
});
for (const trust of [60,80]) for (const action of ['support','deny','modify']) scenario(`trust ${trust} ${action} positive`, () => {
  const r = seeded(trust,3), p = r.api.state.contentState.planMeeting, target = p.candidates[0].id;
  const result = r.api.commit(action,target), plan = r.api.state.contentState.planMeeting;
  check(`trust ${trust} ${action} commits exactly once for one CP`, result.ok === true && plan.status === 'committed'
    && plan.playerAction === action && r.api.state.contentState.commandPoints === 2 && events(r,'plan.meeting.committed').length === 1,
    { result: clone(result), selectedId: plan.selectedId });
  const before = protectedFacts(r), repeated = r.api.commit('support',target);
  check(`trust ${trust} ${action} second intervention is rejected without second debit`, repeated.ok === false
    && JSON.stringify(protectedFacts(r)) === JSON.stringify(before) && events(r,'plan.meeting.committed').length === 1,
    { result: clone(repeated), commandPoints: r.api.state.contentState.commandPoints });
});

for (const status of ['candidate','committed','resolved-transient','fallback-transient']) for (const force of [false,true]) scenario(`${status} force=${force}`, () => {
  const r = seeded(); let fixtureMode = 'actual current-day source generation';
  if (status === 'committed') assert.equal(r.api.commit('modify',r.api.state.contentState.planMeeting.candidates[1].id).ok,true);
  if (status.endsWith('-transient')) {
    if (status === 'fallback-transient') r.api.state.contentState.planMeeting.candidates.find(c => c.id === r.api.state.contentState.planMeeting.selectedId).effects = [{ op:'TEST-ONLY-invalid-effect' }];
    assert.equal(r.api.advance(1080).ok,true); // actual day1 06:00 -> day2 00:00; real resolver/upkeep
    const p = r.api.state.contentState.planMeeting; assert.equal(p.status,'resolved');
    assert.equal(p.autonomyResult.route === 'fallback',status === 'fallback-transient');
    // Valid SAVE21 resolvedDay must be greater than meetingDay. This explicit
    // transient alias tests the generation fence, not a legal legacy save.
    p.meetingDay = r.api.state.day; p.instanceId = `camp-plan-meeting-001:d${r.api.state.day}`;
    p.candidates.forEach(c => { c.validDay = r.api.state.day; });
    fixtureMode = 'TEST-ONLY same-day transient derived from real source resolution; never written/booted';
  }
  const before = protectedFacts(r), watermark = r.api.state.worldMeta.eventSeq;
  const result = r.api.generatePlan({force,source:'TEST-ONLY repeat SUMMARY'});
  check(`${status} force=${force} freezes exact meeting and ledger`, result.ok === true && result.duplicate === true
    && JSON.stringify(protectedFacts(r)) === JSON.stringify(before) && r.api.state.worldMeta.eventSeq === watermark,
    { fixtureMode, meetingDay: before.contentState.planMeeting.meetingDay, currentDay:r.api.state.day, result:clone({ok:result.ok,duplicate:result.duplicate}) });
});
scenario('additional same-day SUMMARY cannot reopen second intervention', () => {
  const r = seeded(); assert.equal(r.api.commit('modify',r.api.state.contentState.planMeeting.candidates[1].id).ok,true);
  const before = protectedFacts(r), originalId = before.contentState.planMeeting.instanceId;
  const repeated = r.api.generatePlan({source:'summary'}), second = r.api.commit('deny',r.api.state.contentState.planMeeting.candidates[0].id);
  check('extra same-day SUMMARY keeps playerAction/choice and blocks second CP intervention', repeated.duplicate === true && second.ok === false
    && JSON.stringify(protectedFacts(r)) === JSON.stringify(before) && events(r,'plan.meeting.candidates').length === 1 && events(r,'plan.meeting.committed').length === 1,
    { originalId, originalAction:before.contentState.planMeeting.playerAction, pointsBefore:before.contentState.commandPoints,
      pointsAfter:r.api.state.contentState.commandPoints, generate:clone({ok:repeated.ok,duplicate:repeated.duplicate}), second:clone(second) });
});
scenario('zero CP and night preserve earlier guards', () => {
  const r = seeded(80,0), before = protectedFacts(r), empty = r.api.commit();
  check('trust eighty zero CP rejects without mutation',empty.ok === false && empty.reason === 'command-points-empty'
    && JSON.stringify(protectedFacts(r)) === JSON.stringify(before));
  const n = seeded(80,4); n.api.state.night = true; n.api.session.mode = 'BATTLE'; const original = protectedFacts(n), night = n.api.commit();
  check('night command preserves its real night Gate without CP mutation',night.ok === false && night.reason === 'night-lock'
    && JSON.stringify(protectedFacts(n)) === JSON.stringify(original));
});

// Use the pinned source-writer original and unchanged business assertions.
// This run reads its declared provenance; it does not recapture an old game.
report.legacyInput = { testOnly:true, naturalGameplay:false, acquiredBy:legacyMeta.acquiredBy, writerHtmlSha256:originalWriterSha,
  fixtureName:path.basename(fixturePath), fixtureSha256:sha(fixtureBytes), checksum:legacyEnvelope.checksum,
  instanceId:originalPlan.instanceId, commandPoints:legacyEnvelope.payload.contentState.commandPoints, provenance:legacyMeta };
scenario('legacy committed boot and current low trust', () => {
  const r = currentRuntime(runtime,[[saveKey,legacyRaw]]), expected = legacyEnvelope.payload.contentState.planMeeting;
  const bootCheckpoint=settleLegacyBootCheckpoint(r);
  const migratedRaw = r.storage.get(saveKey), reloaded = currentRuntime(runtime,[[saveKey,migratedRaw]]), reloadedRaw = reloaded.storage.get(saveKey);
  check('old complete committed save boots without reward or schema change',r.api.state.contentState.planMeeting.status === 'committed'
    && JSON.stringify(clone(r.api.state.contentState.planMeeting)) === JSON.stringify(expected)
    && r.api.state.contentState.commandPoints === legacyEnvelope.payload.contentState.commandPoints && hasOnlyExpectedScenarioLegacyMigration(r,legacyEnvelope)
    && JSON.stringify(JSON.parse(reloadedRaw).payload) === JSON.stringify(JSON.parse(migratedRaw).payload)
    && JSON.stringify(events(reloaded,'save.migrated')) === JSON.stringify(events(r,'save.migrated')),
    { bootCheckpoint,migration: events(r,'save.migrated'), migratedNativeSha256: sha(migratedRaw), reloadedNativeSha256: sha(reloadedRaw),
      secondContinueAddsNoMigrationOrBusinessChange: JSON.stringify(JSON.parse(reloadedRaw).payload) === JSON.stringify(JSON.parse(migratedRaw).payload) });
  const before = protectedFacts(r), force = r.api.generatePlan({force:true}), repeat = r.api.commit('support',expected.selectedId);
  check('restored legacy meeting remains frozen and cannot spend another CP',force.duplicate === true && repeat.ok === false
    && JSON.stringify(protectedFacts(r)) === JSON.stringify(before) && events(r,'plan.meeting.committed').length === 1);
  check('legacy already-committed low-trust plan still executes once on real next day',r.api.advance(1080).ok === true
    && r.api.state.day === 2 && r.api.state.contentState.planMeeting.status === 'resolved'
    && events(r,'plan.meeting.resolved').length === 1 && r.api.state.contentState.planMeeting.history.length === 1,
    {meeting:clone(r.api.state.contentState.planMeeting)});
});
for (const fallback of [false,true]) scenario(`real next day ${fallback?'fallback':'success'}`, () => {
  const r = seeded(); const prior = clone(r.api.state.contentState.planMeeting);
  if (fallback) r.api.state.contentState.planMeeting.candidates.find(c=>c.id===prior.selectedId).effects=[{op:'TEST-ONLY-invalid-effect'}];
  assert.equal(r.api.advance(1080).ok,true);
  const resolved = clone(r.api.state.contentState.planMeeting), kind = fallback?'plan.meeting.fallback':'plan.meeting.resolved';
  check(`real day2 prior day1 ${fallback?'fallback':'success'} is authoritative once`,r.api.state.day === 2 && resolved.status === 'resolved'
    && resolved.meetingDay === 1 && resolved.resolvedDay === 2 && events(r,kind).length === 1 && resolved.history.length === 1);
  const first = r.api.generatePlan({source:'summary'}), day2 = clone(r.api.state.contentState.planMeeting), watermark = r.api.state.worldMeta.eventSeq;
  const duplicate = r.api.generatePlan({force:true});
  check(`real day2 first meeting after ${fallback?'fallback':'success'} remains allowed then frozen`,first.ok === true && !first.duplicate
    && day2.instanceId === 'camp-plan-meeting-001:d2' && day2.meetingDay === 2 && day2.status === 'candidate'
    && day2.history.length === 1 && day2.history[0].meetingDay === 1 && duplicate.duplicate === true
    && JSON.stringify(clone(r.api.state.contentState.planMeeting)) === JSON.stringify(day2) && r.api.state.worldMeta.eventSeq === watermark);
});

report.ok = report.failures.length === 0;
report.count = report.checks.length; report.passed = report.checks.filter(c=>c.ok).length;
if (options['--out']) writeFileSync(options['--out'],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ runner:report.runner, sourceHash:report.sourceHash, ok:report.ok, count:report.count,passed:report.passed,
  expectedBaselineDefects:report.expectedBaselineDefects,browserStarted:false,naturalGameplayExecuted:false,failures:report.failures },null,2));
process.exitCode = report.ok ? 0 : 1;
