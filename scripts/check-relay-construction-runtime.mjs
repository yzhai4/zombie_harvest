#!/usr/bin/env node
/**
 * Execute the real relay construction stage adapter in a controlled Node VM.
 * The adapter is deliberately feature gated; this checker proves the gate,
 * CommandBus replay/idempotency, CAS failures, atomic participant/building
 * behavior, and SAVE21 round-trip. It is source/runtime evidence only: it does
 * not claim browser, Sites, or natural multi-day gameplay coverage.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--html','--harness','--fixture'].includes(args[i]) && typeof args[i + 1] === 'string' && path.isAbsolute(args[i + 1]), 'usage: node scripts/check-relay-construction-runtime.mjs [--html ABSOLUTE_HTML] [--harness ABSOLUTE_HARNESS] [--fixture ABSOLUTE_FIXTURE]');
  options[args[i]] = args[i + 1];
}
const htmlPath = options['--html'] || path.join(root, 'dist/index.html');
const harnessPath = options['--harness'] || path.join(root, 'scripts/check-report-recovery.mjs');
const fixturePath = options['--fixture'] || path.join(root, 'scripts/fixtures/relay-construction-runtime-v1.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
assert.equal(fixture.schema, 'RelayConstructionTransactionV1');
assert.equal(fixture.version, 1);
assert.equal(fixture.cases?.length, 8, 'runtime fixture must enumerate all eight checks');
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
runtimeBody = runtimeBody.replace(exposureNeedle, `relayTxEnabled: relayConstructionRuntimeEnabled,\n      relayTxSnapshot: relayConstructionRuntimeSnapshot,\n      relayTxCommand: relayConstructionRuntimeBuildCommand,\n      relayTxAdapter: relayConstructionRuntimeAdapter,\n      relayTxAdvance: relayConstructionRuntimeAdvance,\n      updateRelayProject, advance,\n      ${exposureNeedle}`);
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

const passed = checks.filter(item => item.ok).length;
const report = {
  runner: 'source-relay-construction-runtime', schema: 'RelayConstructionTransactionV1', version: 1,
  sourceHash, htmlPath, fixturePath, fixtureCases: fixture.cases.map(item => item.id),
  ok: passed === checks.length, count: checks.length, passed, checks,
  productionWiring: 'feature-gated-stage-only', naturalGameplay: false, sitesVersion: 'v81-unchanged'
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (!report.ok) process.exitCode = 1;
