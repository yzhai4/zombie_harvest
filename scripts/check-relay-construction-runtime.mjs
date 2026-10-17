#!/usr/bin/env node
/**
 * Execute the real relay construction stage adapter in a controlled Node VM.
 * The adapter is deliberately feature gated; this checker proves the gate,
 * CommandBus replay/idempotency, CAS failures, atomic participant/building
 * behavior, and SAVE21 round-trip. It is source/runtime evidence only: it does
 * not claim browser, Sites, or natural multi-day gameplay coverage.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--html','--harness','--fixture','--role-fixture','--out'].includes(args[i]) && typeof args[i + 1] === 'string' && path.isAbsolute(args[i + 1]), 'usage: node scripts/check-relay-construction-runtime.mjs [--html ABSOLUTE_HTML] [--harness ABSOLUTE_HARNESS] [--fixture ABSOLUTE_FIXTURE] [--role-fixture ABSOLUTE_NATIVE] [--out ABSOLUTE_REPORT]');
  options[args[i]] = args[i + 1];
}
const htmlPath = options['--html'] || path.join(root, 'dist/index.html');
const harnessPath = options['--harness'] || path.join(root, 'scripts/check-report-recovery.mjs');
const fixturePath = options['--fixture'] || path.join(root, 'scripts/fixtures/relay-construction-runtime-v1.json');
const roleFixturePath = options['--role-fixture'] || path.join(root, 'scripts/fixtures/relay-construction-role-v1/briefed-native.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
assert.equal(fixture.schema, 'RelayConstructionTransactionV1');
assert.equal(fixture.version, 1);
assert.equal(fixture.cases?.length, 10, 'runtime fixture must enumerate all ten logical checks');
const source = readFileSync(htmlPath, 'utf8');
const sourceHash = createHash('sha256').update(source).digest('hex');
const inlineBlocks = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(text => text.trim());
assert.equal(inlineBlocks.length, 1, 'one inline runtime expected');
const inline = inlineBlocks[0];
assert.match(inline, /const RELAY_TX_RUNTIME_SCHEMA = 'RelayConstructionTransactionV1'/, 'runtime adapter missing');

// Reuse the existing DOM/storage/timer VM fixture, exposing only the five
// stage adapter functions needed by this checker. This keeps the checker
// coupled to the actual source bootstrap rather than reimplementing reducers.
const harnessSource = readFileSync(harnessPath, 'utf8');
const runtimeStart = harnessSource.indexOf('function runtime(entries = []) {');
const runtimeEnd = harnessSource.indexOf('\nfunction envelope(payload)', runtimeStart);
assert.ok(runtimeStart >= 0 && runtimeEnd > runtimeStart, 'existing runtime fixture boundaries required');
let runtimeBody = harnessSource.slice(runtimeStart, runtimeEnd);
const exposureNeedle = 'registry: EVENT_DEFS, hash: checksum,\n';
assert.ok(runtimeBody.includes(exposureNeedle), 'QA exposure marker required');
runtimeBody = runtimeBody.replace(exposureNeedle, `relayTxEnabled: relayConstructionRuntimeEnabled,\n      relayTxSnapshot: relayConstructionRuntimeSnapshot,\n      relayTxCommand: relayConstructionRuntimeBuildCommand,\n      relayTxAdapter: relayConstructionRuntimeAdapter,\n      relayTxAdvance: relayConstructionRuntimeAdvance,\n      relayBindings: typeof relayRoleBindings === 'function' ? relayRoleBindings : null,\n      relayActive: relayActiveParticipants,\n      markNpcDead, assignMorningSuccessors, campWorkPulse, npcRestWorkContext, renderRelayPanel,\n      updateRelayProject, advance,\n      ${exposureNeedle}`);
const runtimeFactory = new Function('inline', 'htmlPath', 'vm', 'assert', runtimeBody + '\nreturn runtime;');
const runtime = runtimeFactory(inlineBlocks, htmlPath, vm, assert);
const SAVE_KEY = 'zombie-harvest-progress-v12';
const clone = value => JSON.parse(JSON.stringify(value));
const events = (r, type) => r.api.state.worldMeta.events.filter(event => event.type === type);
const relayBuildings = state => state.buildings.filter(item => item.id === state.relayProject?.buildingId || item.type === 'relayStation');
const relayDigest = state => ({
  relayProject: clone(state.relayProject),
  buildings: clone(relayBuildings(state)),
  inventory: { wood: state.wood, parts: state.parts, stone: state.stone },
  npcs: clone(state.npcs.filter(npc => ['radio','carpenter','quartermaster'].includes(npc.id)).map(npc => ({ id: npc.id, hp: npc.hp, lifeState: npc.lifeState, scheduleState: npc.scheduleState, behaviorState: npc.behaviorState, lastReport: npc.lastReport, workSegmentId: npc.workSegmentId, workMinutes: npc.workMinutes })))
});
function start(entries = []) {
  const r = runtime(entries);
  assert.equal(r.api.start().ok, true, 'source runtime must start');
  // The fixture starts the world interval; clear it so a test cannot race its
  // deterministic reducer calls. Keep SessionController in DAY for advance.
  r.tasks.clear();
  r.api.session.mode = 'DAY';
  r.api.instrumentRendering();
  return r;
}
function prepare(r, enabled = true) {
  const state = r.api.state;
  state.worldMeta.flags = enabled ? { ...(state.worldMeta.flags || {}), relayConstructionTransactionV1: true } : {};
  state.night = false; state.gameOver = null; state.worldMeta.clock.paused = false;
  state.relayProject.status = 'briefed';
  state.relayProject.materialProgress = { wood: 0, parts: 0, stone: 0 };
  state.relayProject.materialClock = 0; state.relayProject.workMinutes = 0;
  state.relayProject.latestEventId = null; state.relayProject.appliedCommandIds = []; state.relayProject.history = [];
  state.buildings = state.buildings.filter(item => item.id !== state.relayProject.buildingId && item.type !== 'relayStation');
  state.npcs.forEach(npc => { if (['radio','carpenter','quartermaster'].includes(npc.id)) { npc.lifeState = 'healthy'; npc.hp = npc.maxHp; npc.garrisonedOutpostId = null; npc.actingRole = null; npc.scheduleState = 'work'; npc.behaviorState = 'work'; npc.lastReport = ''; } });
  state.worldMeta.relayConstructionSeq = 0;
  return r;
}
function constructionChildCommands(r) { return r.api.state.worldMeta.replay.commands.filter(command => command.type === 'relay.projectAdvance'); }
function check(name, fn, checks) {
  try { fn(); checks.push({ name, ok: true }); }
  catch (error) { checks.push({ name, ok: false, error: String(error?.message || error) }); }
}

const checks = [];
check('flag-off compatibility and default false', () => {
  const first = start(), second = start();
  assert.equal(first.api.relayTxEnabled(), false);
  prepare(first, false); prepare(second, false);
  const a = first.api.advance(30, { commandId: 'qa-off' });
  const b = second.api.advance(30, { commandId: 'qa-off' });
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  assert.deepEqual(relayDigest(first.api.state), relayDigest(second.api.state));
  assert.equal(constructionChildCommands(first).length, 0);
  assert.equal(events(first, 'relay.transaction.applied').length, 0);
}, checks);

check('stage success exactly once', () => {
  const r = prepare(start(), true);
  const result = r.api.advance(30, { commandId: 'qa-stage-success' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(r.api.state.relayProject.status, 'staging');
  const child = constructionChildCommands(r)[0];
  const started = events(r, 'relay.constructionStarted')[0];
  assert.equal(started.commandId, child.commandId, 'fact event keeps child command provenance');
  assert.equal(started.causationId, 'qa-stage-success', 'fact event keeps world.advance causation');
  assert.equal(events(r, 'relay.constructionStarted').length, 1);
  assert.equal(events(r, 'relay.transaction.applied').length, 1);
  assert.equal(constructionChildCommands(r).length, 1);
  assert.equal(relayBuildings(r.api.state).length, 1);
  assert.equal(relayBuildings(r.api.state)[0].occupiedBy, r.api.state.relayProject.id);
  assert.equal(r.api.state.npcs.find(npc => npc.id === 'radio').scheduleState, '中继筹料');
}, checks);

check('missing worker leaves relay cross-domain state unchanged', () => {
  const r = prepare(start(), true);
  const missing = r.api.state.npcs.find(npc => npc.id === 'carpenter'); missing.lifeState = 'dead'; missing.hp = 0;
  const before = relayDigest(r.api.state);
  const result = r.api.relayTxAdvance(30, { commandId: 'qa-missing-worker' });
  assert.equal(result.ok, false);
  assert.deepEqual(relayDigest(r.api.state), before);
  assert.equal(events(r, 'relay.constructionStarted').length, 0);
  assert.equal(events(r, 'command.rejected').at(-1)?.payload?.reason, 'participant-unavailable');
  assert.equal(constructionChildCommands(r).length, 1, 'rejected child still enters replay/idempotency');
  assert.equal(relayBuildings(r.api.state).length, 0, 'failed virtual occupancy must not create station');
}, checks);

check('stale token leaves relay cross-domain state unchanged', () => {
  const r = prepare(start(), true);
  const before = relayDigest(r.api.state);
  const result = r.api.relayTxAdvance(30, { commandId: 'qa-stale-token', expectedEventId: 'evt-stale' });
  assert.equal(result.ok, false); assert.equal(result.reason, 'event-state-conflict');
  assert.deepEqual(relayDigest(r.api.state), before);
  assert.equal(events(r, 'relay.constructionStarted').length, 0);
  assert.equal(events(r, 'command.rejected').at(-1)?.payload?.reason, 'event-state-conflict');
}, checks);

check('duplicate child command is a no-op', () => {
  const r = prepare(start(), true);
  assert.equal(r.api.advance(30, { commandId: 'qa-duplicate-parent' }).ok, true);
  const child = constructionChildCommands(r)[0];
  const before = relayDigest(r.api.state), started = events(r, 'relay.constructionStarted').length, seq = r.api.state.worldMeta.eventSeq;
  const duplicate = r.api.relayTxAdvance(30, { commandId: child.commandId });
  assert.equal(duplicate.ok, true); assert.equal(duplicate.duplicate, true);
  assert.deepEqual(relayDigest(r.api.state), before);
  assert.equal(events(r, 'relay.constructionStarted').length, started); assert.equal(r.api.state.worldMeta.eventSeq, seq);
}, checks);

check('virtual occupancy commits only after success', () => {
  const failed = prepare(start(), true);
  failed.api.state.npcs.find(npc => npc.id === 'radio').lifeState = 'dead';
  assert.equal(failed.api.relayTxAdvance(30, { commandId: 'qa-virtual-fail' }).ok, false);
  assert.equal(relayBuildings(failed.api.state).length, 0);
  const succeeded = prepare(start(), true);
  assert.equal(succeeded.api.advance(30, { commandId: 'qa-virtual-success' }).ok, true);
  const station = relayBuildings(succeeded.api.state)[0];
  assert.ok(station); assert.equal(station.occupiedBy, succeeded.api.state.relayProject.id); assert.equal(station.projectStatus, 'staging');
}, checks);

check('save/reload preserves transaction token and replay child', () => {
  const r = prepare(start(), true);
  assert.equal(r.api.advance(30, { commandId: 'qa-save-token' }).ok, true);
  const expectedEventId = r.api.relayTxSnapshot().instance.latestEventId;
  assert.ok(expectedEventId);
  assert.equal(r.api.save({ force: true, reason: 'qa-relay-runtime' }), true);
  const raw = r.storage.get(SAVE_KEY); assert.ok(raw);
  const reloaded = start([[SAVE_KEY, raw]]);
  assert.equal(reloaded.api.relayTxEnabled(), true);
  assert.equal(reloaded.api.relayTxSnapshot().instance.latestEventId, expectedEventId);
  assert.equal(constructionChildCommands(reloaded).length, 1);
  assert.equal(reloaded.api.state.relayProject.status, 'staging');
}, checks);

check('same-tick order keeps relay construction before world combat', () => {
  const reducerStart = inline.indexOf('function advanceReducer(minutes)');
  const reducerEnd = inline.indexOf('function advance(minutes, options = {})', reducerStart);
  assert.ok(reducerStart >= 0 && reducerEnd > reducerStart);
  const body = inline.slice(reducerStart, reducerEnd);
  for (const marker of ['updateNpcRoutine(minutes)', 'updateRelayProject(minutes)', 'simulateWorldZombies(minutes)', 'runDayCombat(minutes)']) assert.ok(body.includes(marker), marker);
  assert.ok(body.indexOf('updateRelayProject(minutes)') < body.indexOf('simulateWorldZombies(minutes)'));
  assert.ok(body.indexOf('simulateWorldZombies(minutes)') < body.indexOf('runDayCombat(minutes)'));
}, checks);

// The following two logical scenarios use an actual source-writer handoff save.
// They do not call prepare(): deaths/successors use real functions, while only
// the opt-in feature flag and explicitly named configuration variants are QA
// inputs. Direct updateRelayProject(minutes) is a consumer-only probe; its
// minutes do not advance calendar, physiology, enemies, or natural gameplay.
const roleFixtureRaw = readFileSync(roleFixturePath, 'utf8');
const roleFixtureHash = createHash('sha256').update(roleFixtureRaw).digest('hex');
assert.equal(roleFixtureHash, '38cdf0a6ce9a38263091f475db7a6730444464d510f812e84a0658b7a5bc2b77', 'unchanged actual handoff writer required');
const roleEvidence = { inputSha256: roleFixtureHash, method: 'TEST-ONLY native Continue, real death/succession and direct consumer calls; no world.advance or natural-time equivalence', cases: [], artifacts: [] };
const artifactsDir = options['--out'] ? `${options['--out']}.artifacts` : null;
function roleArtifact(name, data) {
  const bytes = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');
  const ref = { name, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  if (artifactsDir) { mkdirSync(artifactsDir, { recursive: true }); const file = path.join(artifactsDir, name); writeFileSync(file, bytes, { flag: 'wx' }); ref.path = path.relative(path.dirname(options['--out']), file).replaceAll('\\', '/'); }
  roleEvidence.artifacts.push(ref); return ref;
}
function roleStart(raw = roleFixtureRaw, enabled = false) {
  const r = runtime([[SAVE_KEY, raw]]);
  assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true, 'native input must pass actual validator');
  r.emit('continueSaveBtn', 'click'); assert.equal(r.api.started, true); assert.equal(r.api.session.mode, 'DAY');
  r.tasks.clear(); // queued IO clocks only; never overwrite runtime phase/health.
  if (enabled) r.api.state.worldMeta.flags = { ...(r.api.state.worldMeta.flags || {}), relayConstructionTransactionV1: true };
  return r;
}
function roleNative(r, name) {
  assert.equal(r.api.save(), true); const raw = r.storage.get(SAVE_KEY);
  assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true);
  roleArtifact(name, raw); return raw;
}
function roleMap(r) { return Object.fromEntries(r.api.relayBindings().bindings.map(b => [b.roleId, b.npc?.id || null])); }
function relayEconomy(s) { return { status: s.relayProject.status, materialProgress: clone(s.relayProject.materialProgress), materialClock: s.relayProject.materialClock, workMinutes: s.relayProject.workMinutes, inventory: { wood: s.wood, parts: s.parts, stone: s.stone }, resources: clone(s.resources), buildings: clone(relayBuildings(s)) }; }
const relaySuccessTypes = ['relay.constructionStarted', 'relay.materialsGathered', 'relay.materialsCommitted', 'relay.stationOnline', 'relay.transaction.applied'];
function roleSuccessCounts(r) { return Object.fromEntries(relaySuccessTypes.map(type => [type, events(r, type).length])); }
function assertPureRoleReads(r) {
  const before = clone(r.api.state), storage = [...r.storage], timers = r.tasks.size;
  r.api.relayBindings(); r.api.relayTxSnapshot();
  assert.deepEqual(clone(r.api.state), before, 'bindings and snapshot are read-only, including RNG/project/station');
  assert.deepEqual([...r.storage], storage); assert.equal(r.tasks.size, timers);
}
function killCarpenterAndAssign(r) {
  const npc = r.api.state.npcs.find(n => n.id === 'carpenter');
  r.api.markNpcDead(npc, { npcDeaths: 0 }, []); r.api.assignMorningSuccessors();
  assert.equal(npc.lifeState, 'dead');
  const actualParticipants = r.api.relayActive().map(n => n.id);
  assert.equal(new Set(actualParticipants).size, actualParticipants.length, 'real relay consumer must not count the same successor in two duties');
  assert.deepEqual([...actualParticipants].sort(), ['quartermaster','radio'], 'actual consumer retains the two distinct present duties and leaves quartermaster vacant');
  assert.deepEqual(roleMap(r), { radio: 'radio', carpenter: 'quartermaster', quartermaster: null });
  const assigned = Object.values(roleMap(r)).filter(Boolean); assert.equal(new Set(assigned).size, assigned.length);
}
function assertRoleReload(r, name) {
  const raw = roleNative(r, `${name}-before-reload-native.json`), first = JSON.parse(raw).payload;
  const next = roleStart(raw, false); const again = roleNative(next, `${name}-after-reload-native.json`);
  const expected = clone(first); expected.worldMeta.lastCheckpointReason = 'session-start';
  assert.deepEqual(JSON.parse(again).payload, expected, 'whole native payload survives actual Continue; only existing checkpoint metadata may change');
  assert.deepEqual(clone(events(next, 'save.migrated')), clone(events(r, 'save.migrated'))); return next;
}
check('actual native effective-role loss blocks both producers and real next successor resumes', () => {
  const initial = JSON.parse(roleFixtureRaw).payload;
  assert.equal(initial.relayProject.status, 'briefed'); assert.equal(initial.relayProject.handoffAt, null, 'preserve actual old source fact, do not backfill');
  const handed = initial.worldMeta.events.find(e => e.type === 'relay.coreHandedOff');
  assert.equal(handed?.actorId, 'player-1'); assert.equal(handed?.commandId, 'cmd-000255');
  const command = initial.worldMeta.replay.commands.find(c => c.commandId === handed.commandId); assert.equal(command.type, 'relay.coreHandoff');
  for (const key of ['expectedInstanceId','expectedDefId','expectedDefinitionVersion','expectedEventId']) assert.equal(handed.payload[key], command.payload[key]);
  for (const enabled of [false, true]) {
    const mode = enabled ? 'opt-in' : 'legacy', r = roleStart(roleFixtureRaw, enabled), s = r.api.state;
    if (r.api.relayBindings) assert.deepEqual(roleMap(r), { radio: 'radio', carpenter: 'carpenter', quartermaster: 'quartermaster' });
    roleNative(r, `${mode}-normal-briefed-native.json`);
    killCarpenterAndAssign(r); assert.equal(typeof r.api.relayBindings, 'function', 'candidate explanation API follows actual consumer qualification'); assertPureRoleReads(r); roleNative(r, `${mode}-missing-role-native.json`);
    const before = relayEconomy(s), successes = roleSuccessCounts(r), now = [s.day,s.hour,s.minute];
    if (enabled) assert.equal(r.api.relayTxAdvance(60, { commandId:'qa-role-optin-missing' }).ok, false);
    else r.api.updateRelayProject(60);
    assert.deepEqual(relayEconomy(s), before, `${mode}: missing duty must not spend materials, accrue clocks/work, or occupy station`);
    assert.deepEqual(roleSuccessCounts(r), successes); assert.deepEqual([s.day,s.hour,s.minute], now);
    r.api.renderRelayPanel(); assert.match(r.node('relayStatusText').innerHTML, /暂停/); assert.match(r.node('relayCrewText').textContent, /缺岗/);
    const delegate = s.npcs.find(n => n.id === 'quartermaster'); assert.equal(r.api.npcRestWorkContext(delegate).ownerReason, 'relay-duty', 'partial valid crew still yields rest pilot to assigned duty');
    roleArtifact(`${mode}-missing-role-consumer.json`, { bindings: roleMap(r), snapshot: clone(r.api.relayTxSnapshot()), ui: { status: r.node('relayStatusText').innerHTML, crew: r.node('relayCrewText').textContent, task: r.node('relayTaskText').textContent }, economy: relayEconomy(s), successCounts: roleSuccessCounts(r) });
    r.api.assignMorningSuccessors(); assert.deepEqual(roleMap(r), { radio: 'radio', carpenter: 'quartermaster', quartermaster: 'cook' });
    roleNative(r, `${mode}-restored-before-consumer-native.json`);
    const inventory = { wood: s.wood, parts: s.parts, stone: s.stone };
    if (enabled) assert.equal(r.api.relayTxAdvance(30, { commandId:'qa-role-optin-restored' }).ok, true);
    else r.api.updateRelayProject(30);
    assert.equal(s.relayProject.status, 'staging'); assert.equal(events(r, 'relay.constructionStarted').length, successes['relay.constructionStarted'] + 1);
    if (enabled) assert.deepEqual({ wood:s.wood,parts:s.parts,stone:s.stone }, inventory, 'opt-in bridge owns stage only');
    else { assert.equal(s.wood, inventory.wood - 2); assert.equal(s.parts, inventory.parts - 2); assert.deepEqual(clone(s.relayProject.materialProgress), { wood:2,parts:2,stone:0 }); }
    const next = assertRoleReload(r, `${mode}-restored`); assert.deepEqual(roleMap(next), { radio:'radio',carpenter:'quartermaster',quartermaster:'cook' });
    if (enabled) { const child = constructionChildCommands(next).at(-1); assert.ok(child); next.api.markNpcDead(next.api.state.npcs.find(n=>n.id==='cook'), {npcDeaths:0}, []); const all = clone(next.api.state); const duplicate = next.api.relayTxAdvance(30, {commandId:child.commandId}); assert.equal(duplicate.duplicate,true); assert.deepEqual(clone(next.api.state),all,'historical applied command stays duplicate after duty loss'); }
    // Explicit consumer-only stage setup: no hand-written stage/clock/worker.
    const pulse = roleStart(roleFixtureRaw, enabled); pulse.api.updateRelayProject(0); assert.equal(pulse.api.state.relayProject.status,'staging'); killCarpenterAndAssign(pulse);
    const seq = pulse.api.state.worldMeta.eventSeq; pulse.api.campWorkPulse(pulse.api.state.npcs.find(n=>n.id==='quartermaster'));
    const work = pulse.api.state.worldMeta.events.filter(e=>e.seq>seq); assert.ok(work.some(e=>e.type==='npc.work.blocked'&&e.payload.relayProjectId===pulse.api.state.relayProject.id)); assert.equal(work.some(e=>e.type==='npc.work.completed'&&e.payload.relayProjectId),false);
    roleArtifact(`${mode}-blocked-work-consumer.json`, {events:clone(work),bindings:roleMap(pulse)});
    roleEvidence.cases.push({mode,actualDeathAndTwoSuccessions:true,calendarUnchanged:true,partialCrewBlocked:true,recovered:true});
  }
  const configHash = runtime().api.hash;
  for (const [id, roles, valid] of [['empty',[],false],['missing',['radio','carpenter'],false],['foreign-known',['radio','carpenter','doctor'],false],['duplicate',['radio','carpenter','carpenter'],false],['reordered',['quartermaster','radio','carpenter'],true]]) {
    const p=clone(initial);p.relayProject.assignedNpcIds=roles;const raw=JSON.stringify({...p,payload:p,checksum:configHash(p),savedAt:(p.day-1)*1440+p.hour*60+p.minute});
    for(const enabled of [false,true]) { const r=roleStart(raw,enabled);assert.deepEqual(clone(r.api.state.relayProject.assignedNpcIds),roles,'old saved array retained');roleNative(r,`config-${id}-${enabled?'opt-in':'legacy'}-native.json`);const before=relayEconomy(r.api.state),successes=roleSuccessCounts(r);r.api.updateRelayProject(0);if(valid){assert.equal(r.api.state.relayProject.status,'staging');assert.equal(r.api.relayBindings().blockedReason,null);}else{assert.equal(r.api.relayBindings().blockedReason,'invalid-role-configuration');assert.equal(r.api.relayBindings().bindings.some(b=>b.npc),false);assert.deepEqual(relayEconomy(r.api.state),before);assert.deepEqual(roleSuccessCounts(r),successes);} }
    roleEvidence.cases.push({id,method:'TEST-ONLY complete-writer configuration derivative; array not historical original',roles,valid});
  }
  const p=clone(initial);p.relayProject.assignedNpcIds=['radio','carpenter','unknown-role'];const unknown=JSON.stringify({...p,payload:p,checksum:configHash(p),savedAt:380}),rejected=runtime([[SAVE_KEY,unknown]]);assert.equal(rejected.api.validate({raw:unknown,sourceCategory:'primary'}).ok,false);rejected.emit('continueSaveBtn','click');assert.equal(rejected.api.started,false);assert.equal(rejected.storage.get(SAVE_KEY),unknown,'unknown saved identity rejected without rewriting original input');roleEvidence.cases.push({id:'unknown-identity',rejectedBeforeInstall:true});
}, checks);

check('actual briefed legacy consumer completes once and reload never repeats online rewards', () => {
  const r=roleStart(),s=r.api.state,project=s.relayProject,initial=clone(s),seq=s.worldMeta.eventSeq,minute=[s.day,s.hour,s.minute];
  const steps=[];for(let i=1;i<=15&&s.relayProject.status!=='online';i++){r.api.updateRelayProject(30);steps.push({step:i,project:clone(s.relayProject),station:clone(relayBuildings(s)),standing:clone(s.campStanding)});assert.equal(s.relayProject,project,'normalization must preserve the live project container across material/station/forecast consumers');}
  roleArtifact('legacy-completion-at-terminal-consumer.json',{economy:relayEconomy(s),forecast:clone(s.hordeForecast),quests:clone(s.quests),newEvents:clone(s.worldMeta.events.filter(e=>e.seq>seq))});
  roleArtifact('legacy-completion-consumer-steps.json',steps);assert.equal(s.relayProject.status,'online','live project must reach online within 15 existing 30-minute consumer calls');assert.deepEqual([s.day,s.hour,s.minute],minute,'consumer-only minutes do not advance world time');
  assert.deepEqual(clone(s.relayProject.materialProgress),{wood:10,parts:5,stone:4});assert.equal(s.relayProject.workMinutes,180);assert.equal(s.relayProject.targetMinutes,180);
  const online=events(r,'relay.stationOnline').filter(e=>e.seq>seq),committed=events(r,'relay.materialsCommitted').filter(e=>e.seq>seq),forecast=events(r,'threat.forecastChanged').filter(e=>e.seq>seq);assert.equal(online.length,1);assert.equal(committed.length,1);assert.equal(forecast.length,1);
  const station=relayBuildings(s);assert.equal(station.length,1);assert.equal(station[0].active,true);assert.equal(station[0].relayEnabled,true);assert.equal(station[0].projectStatus,'online');assert.equal(station[0].id,committed[0].payload.buildingId);assert.deepEqual(clone(committed[0].payload.materialProgress),{wood:10,parts:5,stone:4});
  assert.equal(s.hordeForecast.source,'relay-station');assert.equal(s.hordeForecast.routeId,'relay-guided-west');assert.equal(s.hordeForecast.confidence,92);assert.equal(s.hordeForecast.leadMinutes,180);
  for(const [key,delta] of [['prestige',3],['merit',5],['contribution',3],['legitimacy',2]])assert.equal(s.campStanding[key],initial.campStanding[key]+delta);
  const sourceTotals={};for(const e of events(r,'relay.materialsGathered').filter(e=>e.seq>seq))for(const src of e.payload.sources){assert.ok(src.amount>0&&Number.isFinite(src.amount));sourceTotals[src.resourceId]=(sourceTotals[src.resourceId]||0)+src.amount;}
  const quests=events(r,'quest.completed').filter(e=>e.seq>seq);assert.equal(quests.length,1,'original relay quest grants parts once at first actual online');assert.equal(quests[0].payload.reward,'parts+1');assert.equal(quests[0].causationId,online[0].eventId);
  for(const kind of ['wood','parts','stone'])assert.equal(s[kind],initial[kind]-(sourceTotals[`stock.${kind}`]||0)+(kind==='parts'?1:0));
  for(const resource of initial.resources){const now=s.resources.find(x=>x.id===resource.id);assert.ok(now);assert.equal(now.amount,resource.amount-(sourceTotals[resource.id]||0),'every material receipt has an actual finite resource debit');}
  const protectedState=()=>clone({economy:relayEconomy(s),standing:s.campStanding,forecast:s.hordeForecast,quests:s.quests,contentState:s.contentState,eventSeq:s.worldMeta.eventSeq});const completed=protectedState();for(let i=0;i<3;i++)r.api.updateRelayProject(30);assert.deepEqual(protectedState(),completed,'further online consumer calls neither re-spend nor re-award');
  roleArtifact('legacy-completion-provenance.json',{newEvents:clone(s.worldMeta.events.filter(e=>e.seq>seq)),sourceTotals,questRewards:clone(quests),before:{wood:initial.wood,parts:initial.parts,stone:initial.stone},after:{wood:s.wood,parts:s.parts,stone:s.stone}});
  const next=assertRoleReload(r,'legacy-online'),after=clone(next.api.state);next.api.updateRelayProject(30);assert.deepEqual(clone(next.api.state),after,'reloaded online consumer is still a no-op');roleEvidence.cases.push({id:'legacy-online-once',consumerSteps:steps.length,worldAdvance:false,onlineOnce:true,questPartsRewardOnce:true});
}, checks);

const passed = checks.filter(item => item.ok).length;
const report = {
  runner: 'source-relay-construction-runtime', schema: 'RelayConstructionTransactionV1', version: 1,
  sourceHash, htmlPath, fixturePath, fixtureCases: fixture.cases.map(item => item.id),
  runnerSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  harnessSha256: createHash('sha256').update(harnessSource).digest('hex'),
  roleFixture: { path: roleFixturePath, sha256: roleFixtureHash, bytes: Buffer.byteLength(roleFixtureRaw) }, roleEvidence,
  ok: passed === checks.length, count: checks.length, passed, checks,
  productionWiring: 'feature-gated-stage-only', naturalGameplay: false, sitesVersion: 'v81-unchanged'
};
if (options['--out']) { mkdirSync(path.dirname(options['--out']), { recursive: true }); writeFileSync(options['--out'], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); }
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (!report.ok) process.exitCode = 1;
