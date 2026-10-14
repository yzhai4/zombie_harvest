#!/usr/bin/env node
/**
 * Source-executed camp-area interaction/CommandBus regression.
 * Area definitions, proximity, reducer, wrapper, guards, bus and ledger come
 * directly from dist/index.html. Rendering, notifications, region discovery,
 * SAN and the low-level clock settlement are instrumented. The real advance
 * command remains in use; this is not a full calendar/NPC/SAN simulation.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readSourceTarget } from './runtime-source-target.mjs';

const { source, sourceHash, htmlPath } = readSourceTarget();
function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `missing source section: ${startMarker}`);
  return source.slice(start, end);
}
function sourceFunction(name) {
  const match = new RegExp(`^([ \\t]*)function ${name}\\(`, 'm').exec(source);
  assert.ok(match, `missing source function: ${name}`);
  const firstLineEnd = source.indexOf('\n', match.index);
  if (source.slice(match.index, firstLineEnd).trimEnd().endsWith('}')) return source.slice(match.index, firstLineEnd);
  const marker = `\n${match[1]}}`;
  const end = source.indexOf(marker, firstLineEnd);
  assert.ok(end > firstLineEnd, `missing source function end: ${name}`);
  return source.slice(match.index, end + marker.length);
}
const functionNames = [
  'stableClone', 'worldMinute', 'eventDefinition', 'recordWorldEvent', 'applyQuestEvent',
  'dispatchCommand', 'isNightRestrictedAction', 'guardNightAction', 'nightActionResult', 'actionCommand',
  'distanceBetween', 'contextDistance', 'nearbyContextItem', 'npcIsActive', 'npcHasRole',
  'clampSocial', 'rememberNpc', 'spendEnergy', 'advance', 'interactCampAreaReducer', 'interactCampArea',
];
const sandbox = vm.createContext({ console });
vm.runInContext(`
  var state;
  let gameStarted = true;
  // Use the real controller's DAY/input Gate. Timer/storage lifecycle is
  // covered by report recovery, not instrumented as a passing claim here.
  ${source.includes('const SessionController =') ? section('const SessionController =', 'let checkpointTimer =') : 'const SessionController = null;'}
  const EVENT_DEFS = Object.create(null), QUEST_DEFS = {};
  const EVENT_DEFINITION_VERSION = 1;
  const calls = { checkpoints: [], advance: [], sanity: [], visited: [], ui: [] };
  function requestCheckpoint(reason) { calls.checkpoints.push(reason); }
  function advanceReducer(minutes) {
    calls.advance.push(minutes);
    const total = state.hour * 60 + state.minute + minutes;
    state.hour = Math.floor(total / 60); state.minute = total % 60;
  }
  function adjustSanity(target, amount, reason) { calls.sanity.push({ targetId: typeof target === 'string' ? target : target.id, amount, reason }); }
  function markRegionVisited(x, y) { calls.visited.push({ x, y }); }
  function coolFrontierExposure() {}
  function recordFrontierExposure() {}
  function hideContext() {}
  function toast() {}
  function render() {}
  function renderContext() {}
  function log() {}
  function pushFx() {}
  function syncNpcLifeState() {}
  function toggleEvolution() { calls.ui.push('evolution'); }
  function toggleInventory() { calls.ui.push('inventory'); }
  const NPC_TEMPLATES = {};
  ${section('const CAMP_AREAS =', 'const REGION_DEFS =')}
  const CAMP_ZONES = Object.fromEntries(CAMP_AREAS.map(area => [area.zone, { name: area.zone }]));
  ${section('const CONTEXT_INTERACTION_RADIUS =', 'function nearbyContextItem(')}
  ${section('const NIGHT_ACTION_MESSAGE =', 'function isNightRestrictedAction(')}
  ${functionNames.map(sourceFunction).join('\n')}
  ${section('const FeedbackRouter =', 'function appendFeedbackEvent(')}
  ${section('const CommandBus =', 'function dispatchCommand(')}
  globalThis.runtime = {
    getState: () => state, areas: CAMP_AREAS, calls,
    nearby: nearbyContextItem, distance: contextDistance,
    interact: interactCampArea, reduce: interactCampAreaReducer,
    reset(value) { state = value; gameStarted = true; if (SessionController) { SessionController.mode = 'DAY'; SessionController.exiting = false; } Object.keys(calls).forEach(key => calls[key].length = 0); },
  };
`, sandbox, { filename: htmlPath + ':camp-area-extracted' });
const runtime = sandbox.runtime;
const plain = value => JSON.parse(JSON.stringify(value));
function initial(overrides = {}) {
  return {
    day: 1, hour: 8, minute: 0, night: false, gameOver: null,
    player: { x: 10.1, y: 11.6 }, energy: 100, hp: 100, food: 20, medicine: 1, wood: 10, morale: 70,
    npcs: [{ id: 'guardJi', name: 'QA guard', lifeState: 'healthy', hp: 100, maxHp: 100, morale: 70,
      needs: { hunger: 40, stress: 20 }, memory: { importantEvents: [] }, relations: {} }],
    buildings: [], quests: [], roleVacancies: {}, areaFlags: {}, noiseEvents: [],
    worldMeta: { eventSeq: 0, commandSeq: 0, seenCommands: [], events: [], feedback: [],
      replay: { seed: 481516234, commands: [] }, clock: { paused: false, rate: 1, phaseMinutes: 0, scheduleMinutes: 0 } },
    ...overrides,
  };
}
function reset(overrides = {}) { runtime.reset(initial(overrides)); return runtime.getState(); }
const area = zone => runtime.areas.find(item => item.zone === zone);
const events = type => runtime.getState().worldMeta.events.filter(event => event.type === type);
const checks = [];
function test(name, run) { run(); checks.push(name); }
function rejection(result, reason) {
  assert.equal(result.ok, false); assert.equal(result.reason, reason);
  assert.equal(events('camp.area.interacted').length, 0);
  assert.equal(runtime.calls.checkpoints.length, 0);
  assert.equal(runtime.calls.advance.length, 0);
}

test('displayed 1.17-distance barracks matches shared proximity and reducer', () => {
  const state = reset(); const barracks = area('barracks');
  assert.ok(runtime.distance(barracks) > 1 && runtime.distance(barracks) < 1.25);
  assert.equal(runtime.nearby(runtime.areas), barracks);
  const result = runtime.interact(barracks, { commandId: 'qa-barracks-boundary' });
  assert.equal(result.ok, true); assert.equal(result.event.type, 'camp.area.interacted');
  assert.equal(result.event.payload.minutes, 30);
  assert.equal(state.hour, 8); assert.equal(state.minute, 30); assert.equal(state.food, 20);
  assert.equal(state.morale, 72); assert.equal(state.npcs[0].morale, 76); assert.equal(state.npcs[0].needs.stress, 15);
  assert.equal(events('time.advanced').length, 1); assert.equal(events('camp.area.interacted').length, 1);
  assert.deepEqual(plain(runtime.calls.checkpoints), ['command:camp.area.interact']);
  assert.deepEqual(plain(state.worldMeta.replay.commands.map(command => command.type)), ['camp.area.interact', 'world.advance']);
});
test('exact 1.25 boundary is accepted', () => {
  reset({ player: { x: 10.25, y: 12 } });
  assert.equal(runtime.nearby([area('barracks')]), area('barracks'));
  assert.equal(runtime.interact(area('barracks')).ok, true);
});
test('out-of-range interaction rejects without progression or successful event', () => {
  const state = reset({ player: { x: 10.251, y: 12 } });
  assert.equal(runtime.nearby([area('barracks')]), null);
  rejection(runtime.interact(area('barracks')), 'area-too-far');
  assert.equal(state.food, 20); assert.equal(state.minute, 0); assert.equal(events('command.rejected').length, 1);
});
test('shared proximity selector retains its predicate filter', () => {
  reset(); assert.equal(runtime.nearby(runtime.areas, item => item.zone === 'residence'), null);
});
for (const invalid of [null, { zone: 'qa-absent', x: 9, y: 12 }, { zone: 'barracks', x: 10, y: 12 }]) {
  test(`invalid area ${invalid?.zone || 'null'} is rejected through CommandBus`, () => {
    const state = reset(); rejection(runtime.interact(invalid), 'area-missing');
    assert.equal(state.minute, 0); assert.equal(state.food, 20); assert.equal(events('command.rejected').length, 1);
  });
}
test('night wrapper and reducer both refuse area effects', () => {
  const state = reset({ night: true }); const before = plain(state);
  rejection(runtime.interact(area('barracks')), 'night-lock');
  rejection(runtime.reduce(area('barracks')), 'night-lock');
  assert.deepEqual(plain(state), before);
});
test('game-over command is rejected before area mutations', () => {
  const state = reset({ gameOver: 'camp-lost' });
  rejection(runtime.interact(area('barracks')), 'game-over');
  assert.equal(state.minute, 0); assert.equal(state.npcs[0].morale, 70);
  assert.equal(events('command.rejected').length, 1);
});
test('successful repeated commandId cannot train or checkpoint twice', () => {
  reset(); runtime.interact(area('barracks'), { commandId: 'qa-repeat' });
  const before = plain(runtime.getState()); const callCounts = plain(runtime.calls);
  const duplicate = runtime.interact(area('barracks'), { commandId: 'qa-repeat' });
  assert.equal(duplicate.duplicate, true); assert.deepEqual(plain(runtime.getState()), before);
  assert.deepEqual(plain(runtime.calls), callCounts);
});
test('training spends no food and records before/after actual elapsed minutes', () => {
  const state = reset({ food: 0 });
  const result = runtime.interact(area('barracks'));
  assert.equal(result.ok, true); assert.equal(state.food, 0);
  assert.equal(result.event.payload.before.time, 480); assert.equal(result.event.payload.after.time, 510);
  assert.equal(result.event.payload.minutes, 30);
  assert.deepEqual(plain(runtime.calls.advance), [30]);
});
test('residence dinner charges one food and advances thirty minutes once', () => {
  const state = reset({ player: { x: 13, y: 11 } });
  const result = runtime.interact(area('residence'), { commandId: 'qa-dinner' });
  assert.equal(result.ok, true); assert.equal(state.food, 19); assert.equal(state.minute, 30);
  assert.equal(state.npcs[0].needs.hunger, 12); assert.equal(state.npcs[0].needs.stress, 12);
  assert.equal(result.event.payload.before.food - result.event.payload.after.food, 1);
  const before = plain(state); runtime.interact(area('residence'), { commandId: 'qa-dinner' });
  assert.deepEqual(plain(state), before); assert.equal(runtime.calls.checkpoints.length, 1);
});
test('food-empty dinner emits rejection and no success/checkpoint/time', () => {
  const state = reset({ food: 0, player: { x: 13, y: 11 } });
  rejection(runtime.interact(area('residence')), 'food-empty');
  assert.equal(state.food, 0); assert.equal(state.morale, 70); assert.equal(state.minute, 0);
  assert.equal(events('command.rejected').length, 1);
});
test('barracks with no active guards cannot emit a successful action', () => {
  const state = reset({ npcs: [{ id: 'guardJi', lifeState: 'dead', hp: 0, morale: 70 }] });
  rejection(runtime.interact(area('barracks')), 'guards-missing');
  assert.equal(state.morale, 70); assert.equal(state.minute, 0); assert.equal(events('command.rejected').length, 1);
});
test('zero-minute core view still records its command and checkpoint honestly', () => {
  const state = reset({ player: { x: 11, y: 10 } });
  const result = runtime.interact(area('core'));
  assert.equal(result.ok, true); assert.equal(result.event.payload.minutes, 0);
  assert.equal(state.minute, 0); assert.equal(state.food, 20); assert.equal(state.morale, 70);
  assert.equal(events('time.advanced').length, 0); assert.equal(events('camp.area.interacted').length, 1);
  assert.deepEqual(plain(runtime.calls.checkpoints), ['command:camp.area.interact']);
});
test('zero-minute farmland view selects existing crop without time/resource cost', () => {
  const garden = { id: 'qa-garden', type: 'garden', x: 8, y: 16 };
  const state = reset({ player: { x: 7, y: 16 }, buildings: [garden] });
  const result = runtime.interact(area('farmland'));
  assert.equal(result.ok, true); assert.equal(result.event.payload.minutes, 0);
  assert.equal(state.selectedBuilding, garden); assert.equal(state.food, 20); assert.equal(state.minute, 0);
});

console.log(`camp-area source execution passed: ${checks.length} checks`);
console.log(`sourceHtmlSha256: ${sourceHash}`);
for (const name of checks) console.log(`  ✓ ${name}`);
