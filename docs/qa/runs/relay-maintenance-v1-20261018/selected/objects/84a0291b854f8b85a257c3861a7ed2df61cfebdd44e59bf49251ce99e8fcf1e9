#!/usr/bin/env node
/**
 * Execute content-chain functions extracted from the shipped HTML in Node VM.
 * Reducers, effects, normalization, registry, hooks and CommandBus are taken
 * directly from source. Only browser checkpoint scheduling is instrumented.
 * Synthetic qa-* definitions below are test-only and never enter the game.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { stableHash } from './replay-harness.mjs';
import { readSourceTarget } from './runtime-source-target.mjs';

const { source, sourceHash, htmlPath } = readSourceTarget();
const watermillRepairFixture = JSON.parse(readFileSync(path.resolve('scripts/fixtures/watermill-repair-gate-v1.json'), 'utf8'));
function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `missing source section: ${startMarker}`);
  return source.slice(start, end);
}
function sourceFunction(name) {
  if (name === 'applyContentEffectsTransaction') return section('function applyContentEffectsTransaction(', 'function contentConditionMet(');
  const match = new RegExp(`^([ \\t]*)function ${name}\\(`, 'm').exec(source);
  assert.ok(match, `missing source function: ${name}`);
  const firstLineEnd = source.indexOf('\n', match.index);
  const firstLine = source.slice(match.index, firstLineEnd);
  if (firstLine.trimEnd().endsWith('}')) return firstLine;
  const endMarker = `\n${match[1]}}`;
  const end = source.indexOf(endMarker, firstLineEnd);
  assert.ok(end > firstLineEnd, `missing function end: ${name}`);
  return source.slice(match.index, end + endMarker.length);
}
const functionNames = [
  'stableClone', 'worldMinute', 'eventDefinition', 'recordWorldEvent',
  'migrateContentState', 'normalizeOutpostAssignments', 'ensureContentState',
  'contentRegistryBase', 'contentId', 'validateContentDefinition', 'registerContent',
  'contentDefinition', 'contentRequirementsMet', 'compare', 'contentPhaseAllows',
  'applyContentEffect', 'applyContentEffects', 'contentConditionMet', 'contentDefinitionUsesGateV1', 'contentGateConditions',
  ...['applyContentEffectsTransaction'].filter(name => source.includes(`function ${name}(`)),
  'contentChainDefinitionGate', 'contentChainChoiceGateRuntime', 'runContentHook',
  'contentChainRuntimeGate', 'startContentChain', 'resolveContentChain',
  'contentEpisodeIdentity', 'normalizeContentEpisodes', 'contentEpisodeExpectedToken', 'contentEpisodeGate',
  'resolveContentFallback', 'resolveContentAutonomy', 'registerContentPack',
  'dispatchCommand', 'resolveContentChainCommand', 'clampSanity', 'sanityValue', 'npcIsActive', 'npcIsCampLocal', 'npcHasRole', 'applyQuestEvent',
  'planMeetingState', 'campTrustValue', 'commandPointCap', 'refreshCommandPoints',
  'planNpcVoteWeight', 'planCandidateScore', 'foodSituation',
  'generatePlanMeeting', 'commitPlanMeeting', 'executePlanMeeting',
  // Older shipped HTML calculated candidates inline. Extract new transaction
  // helpers only when present, keeping both source versions executable.
  ...['planMeetingElectorateChanged', 'calculatePlanMeetingCandidates', 'publishPlanMeetingCandidates', 'refreshPlanMeetingPresence']
    .filter(name => source.includes(`function ${name}(`)),
];
const sandbox = vm.createContext({ console });
vm.runInContext(`
  var state;
  let gameStarted = true;
  // Actual controller methods are loaded, but lifecycle IO is outside this
  // isolated chain suite. Each fixture explicitly starts a DAY session.
  ${source.includes('const SessionController =') ? section('const SessionController =', 'let checkpointTimer =') : 'const SessionController = null;'}
  const checkpoints = [];
  const EVENT_DEFS = Object.create(null);
  const EVENT_DEFINITION_VERSION = 1;
  const WORLD_SEED = 1;
  const WEAPON_DEFS = {}, TECH_NODE_DEFS = {}, BUILDING_DEFS = {};
  const FACTION_DEFS = {}, OUTPOST_DEFS = {}, NPC_ROLE_DEFS = {}, QUEST_DEFS = {};
  ${section('const NPC_STORY_DEFS =', 'const NPC_VISUAL_PROFILES =')}
  ${section('const PLAN_DEFS =', 'function planMeetingState(')}
  const buildInfo = {};
  function requestCheckpoint(reason) { checkpoints.push(reason); }
  ${section('const EVENT_CHAIN_DEFS =', 'const PLAN_DEFS =')}
  ${section('const GATE_V1_PHASES =', 'function normalizeEventEffect(')}
  ${section('const CONTENT_KINDS =', 'function migrateContentState(')}
  ${functionNames.map(sourceFunction).join('\n')}
  ${section('const FeedbackRouter =', 'function appendFeedbackEvent(')}
  // Load the actual ephemeral controller for the new dispatch dependency.
  // These fixtures remain idle; camp-rest-v1 separately exercises active time.
  ${source.includes('const CampRestController =') ? section('const CampRestController =', 'let worldRenderFrame =') : ''}
  ${section('const CommandBus =', 'function dispatchCommand(')}
  ${source.includes('let pendingDayFatal =') ? section('let pendingDayFatal =', 'const CommandBus =') : ''}
  ${section('const ContentRegistry =', "if (typeof window !== 'undefined') window.ZombieHarvestContent")}
  globalThis.runtime = {
    registry: ContentRegistry,
    resolveCommand: resolveContentChainCommand,
    requirementsMet: contentRequirementsMet,
    checkpoints,
    getState: () => state,
    reset(value) { state = value; gameStarted = true; if (SessionController) { SessionController.mode = 'DAY'; SessionController.exiting = false; } checkpoints.length = 0; ensureContentState(); },
  };
`, sandbox, { filename: htmlPath + ':content-chain-extracted' });
const runtime = sandbox.runtime;
const plain = value => JSON.parse(JSON.stringify(value));
function initial(overrides = {}) {
  return {
    day: 4, hour: 8, minute: 0, night: false, gameOver: null,
    wood: 10, stone: 8, food: 20, seeds: 3, parts: 25, medicine: 1, tapes: 0, morale: 70, hp: 100,
    npcs: [{ id: 'carpenter', name: '阿梁', hp: 100, lifeState: 'healthy' }],
    buildings: [], resources: [], landmarks: [{ id: 'watermill-test-landmark', type: 'waterMill', found: true }],
    contentState: { contentVersion: 3, meters: { campCollapse: 10, resonancePressure: 25, campTrust: 30 } },
    specialItems: {}, roleVacancies: {}, quests: [], campStanding: {},
    // Real nullable event/UI domains are part of the effect rollback boundary.
    event: null, eventInstance: null, npcEvents: [], selectedNpc: null, npcTalkOpen: null, interactionFocus: null, logs: [],
    worldMeta: { seed: 1, eventSeq: 0, commandSeq: 0, events: [], seenCommands: [], replay: { seed: 1, commands: [] }, feedback: [], clock: { phaseMinutes: 0, scheduleMinutes: 0 } },
    ...overrides,
  };
}
function mergeFixture(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const result = { ...base };
  Object.entries(patch).forEach(([key, value]) => {
    result[key] = value && typeof value === 'object' && !Array.isArray(value) && base?.[key] && typeof base[key] === 'object' && !Array.isArray(base[key])
      ? mergeFixture(base[key], value) : value;
  });
  return result;
}
function stateFromFixture(fixture) { return mergeFixture(initial(), fixture.state || {}); }
function reset(overrides = {}) { runtime.reset(initial(overrides)); return runtime.getState(); }
function startWatermill() { assert.equal(runtime.registry.startChain('watermill-002').ok, true); }
function eventCount(type) { return runtime.getState().worldMeta.events.filter(event => event.type === type).length; }
const checks = [];
function test(name, run) { run(); checks.push(name); }
function unchanged(call, reason) {
  const before = plain(runtime.getState());
  const result = call();
  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);
  assert.deepEqual(plain(runtime.getState()), before);
  return result;
}
const fallbacks = { ifMissingNpc: 'ledger_only', ifInsufficientPopulation: 'ledger_only', ifExpired: 'ledger_only', ifSkipped: 'ledger_only' };
function addTestChain(id, nodes, extra = {}) {
  const result = runtime.registry.register('eventChain', {
    chainId: id, phase: ['day_4', 'day_10'], startConditions: [], hooks: [],
    nodes, fallback: { ...fallbacks }, ...extra,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
}
test('watermill repair node exposes GateV1 while keeping content-effect semantics', () => {
  reset();
  const definition = runtime.registry.get('eventChain', 'watermill-002');
  assert.equal(definition.gateVersion, 1);
  assert.equal(definition.evaluatePreconditions, true);
  assert.deepEqual(plain(definition.gate.preconditions), [{ type: 'landmark_exists', id: 'waterMill' }, { type: 'camp_trust', min: 25 }, { type: 'day_between', min: 4, max: 10 }]);
  assert.equal(runtime.registry.gate.definition(definition, { actorId: 'player-1' }).checked, 3, 'duplicate compatibility aliases are evaluated once');
  assert.deepEqual(plain(definition.nodes[0].choices[0].requires), ['scrap>=20', 'carpenter_alive']);
  assert.equal(definition.nodes[0].choices[0].effects[0].op, 'adjust_resource');
});
test('watermill start gate uses GateV1 and preserves the old start-condition rejection boundary', () => {
  let state = reset({ contentState: { contentVersion: 3, meters: { campTrust: 24 } } });
  let result = runtime.registry.startChain('watermill-002');
  assert.equal(result.ok, false); assert.equal(result.reason, 'start-condition'); assert.equal(result.gate.reason, 'event-precondition');
  assert.equal(state.contentState.activeChains['watermill-002'], undefined);
  state = reset({ contentState: { contentVersion: 3, meters: { campTrust: 30 } }, landmarks: [{ id: 'watermill-test-landmark', type: 'waterMill', found: false }] });
  result = runtime.registry.startChain('watermill-002');
  assert.equal(result.ok, false); assert.equal(result.gate.reason, 'event-precondition');
  state = reset();
  result = runtime.registry.startChain('watermill-002');
  assert.equal(result.ok, true); assert.equal(result.active.actorId, 'player-1');
});
test('opt-in content GateV1 rejects unknown start objects without state mutation', () => {
  addTestChain('qa-gate-v1-unknown-start', [{ nodeId: 'first', choices: [{ id: 'claim', requires: [], effects: [{ op: 'addResource', key: 'parts', value: 20 }] }] }], {
    gateVersion: 1, evaluatePreconditions: true, gate: { version: 1, phase: 'DAY', preconditions: [{ type: 'future_condition' }] },
  });
  const state = reset(); const before = plain(state);
  const result = runtime.registry.startChain('qa-gate-v1-unknown-start');
  assert.equal(result.ok, false); assert.equal(result.reason, 'start-condition'); assert.equal(result.gate.reason, 'event-precondition-invalid');
  assert.deepEqual(plain(state), before);
});
test('opt-in content GateV1 rejects unknown choice objects before effects', () => {
  addTestChain('qa-gate-v1-unknown-choice', [{ nodeId: 'first', choices: [{ id: 'claim', requires: [{ type: 'future_condition' }], requirements: [], effects: [{ op: 'addResource', key: 'parts', value: 20 }] }] }], {
    gateVersion: 1, evaluatePreconditions: true, gate: { version: 1, phase: 'DAY', preconditions: [] },
  });
  const state = reset(); assert.equal(runtime.registry.startChain('qa-gate-v1-unknown-choice').ok, true);
  const before = plain(state);
  const result = runtime.registry.resolveChain('qa-gate-v1-unknown-choice', 'first', 'claim');
  assert.equal(result.ok, false); assert.equal(result.reason, 'choice-requirement-invalid');
  assert.deepEqual(plain(state), before);
});
test('opt-in content choice gate keeps the DAY/night boundary even when called directly', () => {
  const state = reset(); assert.equal(runtime.registry.startChain('watermill-002').ok, true);
  const definition = runtime.registry.get('eventChain', 'watermill-002');
  const choice = definition.nodes[0].choices[1];
  state.night = true;
  const direct = runtime.registry.gate.choice(definition, choice, { actorId: 'player-1' });
  assert.equal(direct.ok, false); assert.equal(direct.reason, 'phase-blocked');
  const resolved = runtime.registry.resolveChain('watermill-002', 'repair_gate', 'salvage');
  assert.equal(resolved.ok, false); assert.equal(resolved.reason, 'night-lock');
});
test('public choice gate fails closed when the active chain or choice is absent', () => {
  const state = reset();
  const before = plain(state);
  let missingDefinitionGate;
  let arrayDefinitionGate;
  let missingDefinition;
  let missingChoice;
  assert.doesNotThrow(() => { missingDefinitionGate = runtime.registry.gate.definition(null, { actorId: 'player-1' }); });
  assert.doesNotThrow(() => { arrayDefinitionGate = runtime.registry.gate.definition([], { actorId: 'player-1' }); });
  assert.doesNotThrow(() => { missingDefinition = runtime.registry.gate.choice(null, { id: 'ghost', requires: [] }, { actorId: 'player-1' }); });
  assert.doesNotThrow(() => { missingChoice = runtime.registry.gate.choice(runtime.registry.get('eventChain', 'watermill-002'), null, { actorId: 'player-1' }); });
  assert.deepEqual(plain(missingDefinitionGate), { ok: true, gateVersion: 0, checked: 0 });
  assert.deepEqual(plain(arrayDefinitionGate), { ok: true, gateVersion: 0, checked: 0 });
  assert.deepEqual(plain(missingDefinition), { ok: false, reason: 'choice-contract' });
  assert.deepEqual(plain(missingChoice), { ok: false, reason: 'choice-contract' });
  assert.deepEqual(plain(state), before);
  unchanged(() => runtime.registry.resolveChain('watermill-002', 'repair_gate', 'salvage'), 'chain-choice-missing');
});
test('watermill choice GateV1 does not re-check start trust after the chain is active', () => {
  const state = reset(); assert.equal(runtime.registry.startChain('watermill-002').ok, true);
  state.contentState.meters.campTrust = 24;
  const definition = runtime.registry.get('eventChain', 'watermill-002');
  const choice = definition.nodes[0].choices[1];
  const direct = runtime.registry.gate.choice(definition, choice, { actorId: 'player-1' });
  assert.equal(direct.ok, true);
  assert.equal(runtime.registry.resolveChain('watermill-002', 'repair_gate', 'salvage').ok, true);
});
test('watermill direct choice GateV1 enforces its day window', () => {
  const state = reset({ day: 11 });
  const definition = runtime.registry.get('eventChain', 'watermill-002');
  const choice = definition.nodes[0].choices[1];
  const direct = runtime.registry.gate.choice(definition, choice, { actorId: 'player-1' });
  assert.equal(direct.ok, false); assert.equal(direct.reason, 'phase-window');
  assert.equal(state.contentState.activeChains['watermill-002'], undefined);
});
test('watermill definition GateV1 owns its day window', () => {
  const definition = runtime.registry.get('eventChain', 'watermill-002');
  reset({ day: 3 });
  let direct = runtime.registry.gate.definition(definition, { actorId: 'player-1' });
  assert.equal(direct.ok, false); assert.equal(direct.reason, 'event-precondition');
  reset({ day: 11 });
  direct = runtime.registry.gate.definition(definition, { actorId: 'player-1' });
  assert.equal(direct.ok, false); assert.equal(direct.reason, 'event-precondition');
});
test('legacy content condition objects now fail closed when their type is unknown', () => {
  addTestChain('qa-legacy-unknown-start', [{ nodeId: 'first', choices: [{ id: 'claim', requirements: [], effects: [{ op: 'addResource', key: 'parts', value: 20 }] }] }], {
    startConditions: [{ type: 'future_condition' }],
  });
  const state = reset(); const result = runtime.registry.startChain('qa-legacy-unknown-start');
  assert.equal(result.ok, false); assert.equal(result.reason, 'start-condition'); assert.equal(state.contentState.activeChains['qa-legacy-unknown-start'], undefined);
});

test('watermill repair charges once and records completion/effect ledger', () => {
  const state = reset(); startWatermill();
  const result = runtime.registry.resolveChain('watermill-002', 'repair_gate', 'repair');
  assert.equal(result.ok, true);
  assert.equal(state.parts, 5);
  assert.equal(state.contentState.meters.campCollapse, 6);
  assert.equal(state.contentState.flags.watermill_t2, true);
  assert.equal(state.contentState.activeChains['watermill-002'], undefined);
  assert.deepEqual(plain(state.contentState.completedChains), ['watermill-002']);
  assert.deepEqual(plain(state.contentState.appliedEffects), ['watermill-002:repair_gate:repair']);
  assert.equal(eventCount('content.chain.resolved'), 1);
  assert.equal(eventCount('content.effects.applied'), 1);
});
test('positive watermill repair save fixture settles once and survives duplicate command', () => {
  const state = stateFromFixture(watermillRepairFixture);
  runtime.reset(state);
  const start = runtime.registry.startChain('watermill-002');
  assert.equal(start.ok, true);
  const first = runtime.resolveCommand('watermill-002', 'repair_gate', 'repair', { commandId: watermillRepairFixture.commandId, actorId: 'fixture-player' });
  assert.equal(first.ok, true);
  assert.equal(state.parts, watermillRepairFixture.expected.parts);
  assert.equal(state.contentState.meters.campCollapse, watermillRepairFixture.expected.campCollapse);
  assert.equal(state.contentState.flags[watermillRepairFixture.expected.watermillFlag], true);
  assert.deepEqual(plain(state.contentState.completedChains), [watermillRepairFixture.expected.completedChain]);
  assert.deepEqual(plain(state.contentState.appliedEffects), [watermillRepairFixture.expected.appliedEffect]);
  const beforeDuplicate = plain(state);
  const duplicate = runtime.resolveCommand('watermill-002', 'repair_gate', 'repair', { commandId: watermillRepairFixture.commandId, actorId: 'fixture-player' });
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(plain(state), beforeDuplicate);
  assert.equal(eventCount('content.chain.started'), 1);
  assert.equal(eventCount('content.chain.resolved'), 1);
  assert.equal(eventCount('content.effects.applied'), 1);
});
test('watermill salvage grants parts and raises resonance', () => {
  const state = reset({ parts: 2 }); startWatermill();
  assert.equal(runtime.registry.resolveChain('watermill-002', 'repair_gate', 'salvage').ok, true);
  assert.equal(state.parts, 5);
  assert.equal(state.contentState.meters.resonancePressure, 28);
  assert.equal(state.contentState.flags.watermill_t2, undefined);
});
test('repair requirement rejection preserves resources, facts and ledger', () => {
  reset({ parts: 19 }); startWatermill();
  unchanged(() => runtime.registry.resolveChain('watermill-002', 'repair_gate', 'repair'), 'choice-requirement');
});
test('dead carpenter blocks repair while salvage remains available', () => {
  reset({ npcs: [{ id: 'carpenter', lifeState: 'dead', hp: 0 }] }); startWatermill();
  unchanged(() => runtime.registry.resolveChain('watermill-002', 'repair_gate', 'repair'), 'choice-requirement');
  assert.equal(runtime.registry.resolveChain('watermill-002', 'repair_gate', 'salvage').ok, true);
});
test('effect failure rolls back earlier resource and history effects', () => {
  addTestChain('qa-chain-rollback', [{ nodeId: 'first', choices: [{ id: 'broken', requirements: [], effects: [
    { op: 'addResource', key: 'parts', value: 5 },
    { op: 'recordHistory', key: 'qa-chain-history' },
    { op: 'damageBuilding', buildingId: 'qa-missing-building', value: 1 },
  ] }] }]);
  reset(); assert.equal(runtime.registry.startChain('qa-chain-rollback').ok, true);
  const result = unchanged(() => runtime.registry.resolveChain('qa-chain-rollback', 'first', 'broken'), 'building-missing');
  assert.equal(result.rolledBack, true);
});
test('CommandBus propagates reducer rejection without success event/checkpoint', () => {
  const state = reset({ parts: 10 }); startWatermill();
  const beforeParts = state.parts;
  const result = runtime.resolveCommand('watermill-002', 'repair_gate', 'repair', { commandId: 'qa-rejected' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'choice-requirement');
  assert.equal(state.parts, beforeParts);
  assert.equal(eventCount('command.rejected'), 1);
  assert.equal(eventCount('content.chain.command'), 0);
  assert.equal(eventCount('content.chain.resolved'), 0);
  assert.equal(runtime.checkpoints.length, 0);
});
test('CommandBus rollback failure records rejection and no checkpoint', () => {
  const state = reset(); assert.equal(runtime.registry.startChain('qa-chain-rollback').ok, true);
  const result = runtime.resolveCommand('qa-chain-rollback', 'first', 'broken', { commandId: 'qa-effect-rejected' });
  assert.equal(result.ok, false);
  assert.equal(state.parts, 25);
  assert.equal(state.contentState.history.length, 0);
  assert.equal(eventCount('content.effects.applied'), 0);
  assert.equal(eventCount('command.rejected'), 1);
  assert.equal(eventCount('content.chain.command'), 0);
  assert.equal(runtime.checkpoints.length, 0);
});
test('successful same commandId is idempotent across rewards/events/checkpoints', () => {
  reset(); startWatermill();
  const result = runtime.resolveCommand('watermill-002', 'repair_gate', 'repair', { commandId: 'qa-success', actorId: 'qa-player' });
  assert.equal(result.ok, true); assert.equal(result.result.ok, true);
  assert.equal(result.event.actorId, 'qa-player');
  assert.equal(result.event.type, 'content.chain.command');
  assert.equal(runtime.checkpoints.length, 1);
  const snapshot = plain(runtime.getState());
  const duplicate = runtime.resolveCommand('watermill-002', 'repair_gate', 'repair', { commandId: 'qa-success' });
  assert.equal(duplicate.ok, true); assert.equal(duplicate.duplicate, true);
  assert.deepEqual(plain(runtime.getState()), snapshot);
  assert.equal(runtime.checkpoints.length, 1);
});
test('completed node rejects a different command and cannot repeat rewards', () => {
  reset(); startWatermill();
  runtime.resolveCommand('watermill-002', 'repair_gate', 'salvage', { commandId: 'qa-first' });
  const state = runtime.getState(); const parts = state.parts;
  assert.equal(runtime.resolveCommand('watermill-002', 'repair_gate', 'repair', { commandId: 'qa-second' }).ok, false);
  assert.equal(state.parts, parts);
  assert.equal(eventCount('content.chain.command'), 1);
  assert.equal(runtime.checkpoints.length, 1);
});
test('multi-node chain advances authoritative instance after normalization', () => {
  addTestChain('qa-chain-multi', [
    { nodeId: 'first', choices: [{ id: 'advance', next: 'second', effects: [{ op: 'addResource', key: 'food', value: 2 }] }] },
    { nodeId: 'second', choices: [{ id: 'finish', effects: [{ op: 'adjustMeter', key: 'campCollapse', value: -1 }] }] },
  ]);
  const state = reset(); runtime.registry.startChain('qa-chain-multi');
  const result = runtime.registry.resolveChain('qa-chain-multi', 'first', 'advance');
  assert.equal(result.ok, true);
  assert.equal(state.contentState.activeChains['qa-chain-multi'].nodeId, 'second');
  assert.equal(result.active, state.contentState.activeChains['qa-chain-multi']);
  assert.deepEqual(plain(result.active.history), [{ nodeId: 'first', choiceId: 'advance', at: 4800 }]);
  unchanged(() => runtime.registry.resolveChain('qa-chain-multi', 'first', 'advance'), 'chain-choice-missing');
  assert.equal(runtime.registry.resolveChain('qa-chain-multi', 'second', 'finish').ok, true);
  assert.equal(state.food, 22); assert.equal(state.contentState.meters.campCollapse, 9);
  assert.equal(state.contentState.activeChains['qa-chain-multi'], undefined);
});
test('missing next node rejects before any effect', () => {
  addTestChain('qa-chain-invalid-next', [{ nodeId: 'first', choices: [{ id: 'advance', next: 'missing', effects: [{ op: 'addResource', key: 'food', value: 5 }] }] }]);
  reset(); runtime.registry.startChain('qa-chain-invalid-next');
  unchanged(() => runtime.registry.resolveChain('qa-chain-invalid-next', 'first', 'advance'), 'chain-next-node-missing');
});
test('previously applied choice cannot advance a restored repeated node', () => {
  const state = reset(); runtime.registry.startChain('qa-chain-multi');
  state.contentState.appliedEffects.push('qa-chain-multi:first:advance');
  unchanged(() => runtime.registry.resolveChain('qa-chain-multi', 'first', 'advance'), 'chain-node-resolved');
});
for (const [flag, value, reason] of [['night', true, 'night-lock'], ['gameOver', 'camp-lost', 'game-over']]) {
  test(`public registry and command entries reject ${flag} without mutations`, () => {
    const state = reset(); startWatermill(); state[flag] = value;
    for (const call of [
      () => runtime.registry.startChain('watermill-002'),
      () => runtime.registry.resolveChain('watermill-002', 'repair_gate', 'repair'),
      () => runtime.registry.resolveFallback('watermill-002', 'ifSkipped'),
      () => runtime.registry.resolveAutonomy('watermill-002'),
      () => runtime.resolveCommand('watermill-002', 'repair_gate', 'repair', { commandId: 'qa-locked' }),
      () => runtime.registry.runHook('onDayStart'),
    ]) unchanged(call, reason);
    assert.equal(runtime.checkpoints.length, 0);
  });
}
test('start checks day window and start conditions, including existing active', () => {
  reset({ day: 3 }); unchanged(() => runtime.registry.startChain('watermill-002'), 'phase-window');
  reset({ landmarks: [] }); unchanged(() => runtime.registry.startChain('watermill-002'), 'start-condition');
  const state = reset(); startWatermill(); state.day = 11;
  unchanged(() => runtime.registry.startChain('watermill-002'), 'phase-window');
});
test('resolve/autonomy/skip reject expired or pre-window active saves', () => {
  for (const day of [3, 11]) {
    const state = reset(); startWatermill(); state.day = day;
    unchanged(() => runtime.registry.resolveChain('watermill-002', 'repair_gate', 'salvage'), 'phase-window');
    unchanged(() => runtime.registry.resolveAutonomy('watermill-002'), 'phase-window');
    unchanged(() => runtime.registry.resolveFallback('watermill-002', 'ifSkipped'), 'phase-window');
  }
});
test('fallback/autonomy cannot grant completion for an unstarted chain', () => {
  reset();
  unchanged(() => runtime.registry.resolveFallback('watermill-002', 'ifSkipped'), 'chain-not-started');
  unchanged(() => runtime.registry.resolveAutonomy('watermill-002'), 'chain-not-started');
  unchanged(() => runtime.registry.resolveChain('watermill-002', 'repair_gate', 'salvage'), 'chain-choice-missing');
});
test('missing definitions and unknown fallback reasons reject', () => {
  reset();
  unchanged(() => runtime.registry.startChain('qa-absent'), 'chain-missing');
  unchanged(() => runtime.registry.resolveFallback('qa-absent'), 'chain-missing');
  unchanged(() => runtime.registry.resolveAutonomy('qa-absent'), 'autonomy-missing');
  startWatermill();
  unchanged(() => runtime.registry.resolveFallback('watermill-002', 'qa-unrecognized'), 'fallback-reason');
});
test('expiry only resolves after final allowed day and remains idempotent', () => {
  const state = reset(); startWatermill();
  unchanged(() => runtime.registry.resolveFallback('watermill-002', 'ifExpired'), 'phase-window');
  state.day = 10;
  unchanged(() => runtime.registry.resolveFallback('watermill-002', 'ifExpired'), 'phase-window');
  state.day = 11;
  assert.equal(runtime.registry.resolveFallback('watermill-002', 'ifExpired').ok, true);
  assert.equal(state.contentState.activeChains['watermill-002'], undefined);
  const before = plain(state);
  assert.equal(runtime.registry.resolveFallback('watermill-002', 'ifExpired').duplicate, true);
  assert.deepEqual(plain(state), before);
});
test('day-start expiry hook tolerates corrupt entries and expires valid chain', () => {
  const state = reset(); startWatermill(); state.day = 11;
  Object.assign(state.contentState.activeChains, { 'qa-null': null, 'qa-primitive': 4, 'qa-missing': { chainId: 'qa-no-definition', status: 'active' } });
  const result = runtime.registry.runHook('onDayStart');
  assert.equal(result.ok, true); assert.deepEqual(plain(result.expired), ['watermill-002']);
  assert.equal(eventCount('content.chain.fallback'), 1);
});
test('active autonomy applies once and never also grants a player choice', () => {
  const state = reset(); startWatermill();
  assert.equal(runtime.registry.resolveAutonomy('watermill-002').ok, true);
  assert.equal(state.contentState.meters.campCollapse, 11);
  assert.equal(state.parts, 25);
  assert.equal(eventCount('content.chain.autonomy'), 1);
  const before = plain(state);
  assert.equal(runtime.registry.resolveAutonomy('watermill-002').duplicate, true);
  assert.deepEqual(plain(state), before);
  unchanged(() => runtime.registry.resolveChain('watermill-002', 'repair_gate', 'repair'), 'chain-completed');
});
test('active skipped fallback records one result and blocks later rewards', () => {
  const state = reset(); startWatermill();
  assert.equal(runtime.registry.resolveFallback('watermill-002', 'ifSkipped').ok, true);
  assert.equal(state.parts, 25);
  assert.equal(eventCount('content.chain.fallback'), 1);
  const before = plain(state);
  assert.equal(runtime.registry.resolveFallback('watermill-002', 'ifSkipped').duplicate, true);
  assert.deepEqual(plain(state), before);
});
test('contradictory active plus completed save cannot claim a choice reward', () => {
  const state = reset(); startWatermill(); state.contentState.completedChains.push('watermill-002');
  unchanged(() => runtime.registry.resolveChain('watermill-002', 'repair_gate', 'repair'), 'chain-completed');
});
test('null active instance rejects safely without a reward', () => {
  const state = reset(); state.contentState.activeChains['watermill-002'] = null;
  unchanged(() => runtime.registry.resolveChain('watermill-002', 'repair_gate', 'salvage'), 'chain-choice-missing');
  unchanged(() => runtime.registry.resolveAutonomy('watermill-002'), 'chain-not-started');
  unchanged(() => runtime.registry.resolveFallback('watermill-002'), 'chain-not-started');
});
test('malformed node history normalizes safely when advancing', () => {
  const state = reset(); runtime.registry.startChain('qa-chain-multi');
  state.contentState.activeChains['qa-chain-multi'].history = { invalid: true };
  assert.equal(runtime.registry.resolveChain('qa-chain-multi', 'first', 'advance').ok, true);
  assert.deepEqual(plain(state.contentState.activeChains['qa-chain-multi'].history), [{ nodeId: 'first', choiceId: 'advance', at: 4800 }]);
});
test('cycle returning to an old node cannot claim another branch reward', () => {
  addTestChain('qa-chain-cycle', [
    { nodeId: 'first', choices: [
      { id: 'advance', next: 'second', effects: [{ op: 'addResource', key: 'parts', value: 2 }] },
      { id: 'alternative', effects: [{ op: 'addResource', key: 'parts', value: 20 }] },
    ] },
    { nodeId: 'second', choices: [{ id: 'return', next: 'first', effects: [{ op: 'addResource', key: 'food', value: 1 }] }] },
  ]);
  const state = reset(); runtime.registry.startChain('qa-chain-cycle');
  assert.equal(runtime.registry.resolveChain('qa-chain-cycle', 'first', 'advance').ok, true);
  assert.equal(runtime.registry.resolveChain('qa-chain-cycle', 'second', 'return').ok, true);
  assert.equal(state.parts, 27);
  unchanged(() => runtime.registry.resolveChain('qa-chain-cycle', 'first', 'advance'), 'chain-node-resolved');
  unchanged(() => runtime.registry.resolveChain('qa-chain-cycle', 'first', 'alternative'), 'chain-node-resolved');
});
test('22-node cycle keeps settled facts after presentation history is trimmed', () => {
  // Test-only long chain demonstrates that UI history retention cannot weaken
  // reward idempotence. All 22 nodes contribute exactly one part, then loop.
  addTestChain('qa-chain-long-cycle', Array.from({ length: 22 }, (_, index) => ({
    nodeId: `node${index}`,
    choices: [
      { id: 'advance', next: `node${(index + 1) % 22}`, effects: [{ op: 'addResource', key: 'parts', value: 1 }] },
      { id: 'alternative', effects: [{ op: 'addResource', key: 'parts', value: 20 }] },
    ],
  })));
  const state = reset(); runtime.registry.startChain('qa-chain-long-cycle');
  for (let index = 0; index < 22; index += 1) {
    assert.equal(runtime.resolveCommand('qa-chain-long-cycle', `node${index}`, 'advance', { commandId: `qa-long-${index}` }).ok, true);
  }
  const active = state.contentState.activeChains['qa-chain-long-cycle'];
  assert.equal(active.nodeId, 'node0');
  assert.equal(active.history.length, 20);
  assert.equal(active.history.some(entry => entry.nodeId === 'node0'), false);
  assert.equal(active.resolvedNodeIds.length, 22);
  assert.equal(active.resolvedNodeIds.includes('node0'), true);
  assert.equal(state.parts, 47);
  unchanged(() => runtime.registry.resolveChain('qa-chain-long-cycle', 'node0', 'alternative'), 'chain-node-resolved');
  const receipts = [...state.contentState.appliedEffects];
  state.contentState.appliedEffects = [];
  unchanged(() => runtime.registry.resolveChain('qa-chain-long-cycle', 'node0', 'alternative'), 'chain-node-resolved');
  state.contentState.appliedEffects = receipts;
  assert.equal(state.parts, 47);
});
test('old save with trimmed history reconstructs settled nodes from effect receipts', () => {
  const saved = plain(runtime.getState());
  delete saved.contentState.activeChains['qa-chain-long-cycle'].resolvedNodeIds;
  saved.contentState.activeChains['qa-chain-long-cycle'].history = [];
  runtime.reset(saved);
  assert.ok(runtime.getState().contentState.appliedEffects.includes('qa-chain-long-cycle:node0:advance'));
  unchanged(() => runtime.registry.resolveChain('qa-chain-long-cycle', 'node0', 'alternative'), 'chain-node-resolved');
  assert.equal(runtime.getState().parts, 47);
});
test('settled set is constrained to registered node IDs and restores legacy history', () => {
  const state = reset(); runtime.registry.startChain('qa-chain-multi');
  const active = state.contentState.activeChains['qa-chain-multi'];
  active.resolvedNodeIds = ['qa-unregistered-node', null, 'second'];
  assert.equal(runtime.registry.resolveChain('qa-chain-multi', 'first', 'advance').ok, true);
  assert.deepEqual(plain(state.contentState.activeChains['qa-chain-multi'].resolvedNodeIds), ['first', 'second']);
  const legacy = reset(); runtime.registry.startChain('qa-chain-cycle');
  legacy.contentState.activeChains['qa-chain-cycle'].history = [{ nodeId: 'first', choiceId: 'advance', at: 4800 }];
  delete legacy.contentState.activeChains['qa-chain-cycle'].resolvedNodeIds;
  unchanged(() => runtime.registry.resolveChain('qa-chain-cycle', 'first', 'alternative'), 'chain-node-resolved');
});
test('resource effect receipts expose actual clamped before/after delta', () => {
  const state = reset({ parts: 3 });
  const result = runtime.registry.applyEffects([{ op: 'adjust_resource', key: 'scrap', value: -20 }]);
  assert.equal(result.ok, true);
  assert.deepEqual(plain(result.results[0]), { ok: true, op: 'adjust_resource', key: 'parts', value: -20, before: 3, after: 0 });
  assert.equal(state.parts, 0);
  assert.equal(result.results[0].after - result.results[0].before, -3);
  const added = runtime.registry.applyEffects([{ op: 'addResource', key: 'parts', value: 3 }]);
  assert.deepEqual(plain(added.results[0]), { ok: true, op: 'addResource', key: 'parts', value: 3, before: 0, after: 3 });
});
const malformedRequirements = [
  ['string', 'scrap>=0'],
  ['object', { resource: 'parts', min: 0 }],
  ['null', null],
  ['mixed', ['scrap>=0', null]],
];
for (const [label, requirements] of malformedRequirements) {
  test(`registration rejects explicit ${label} requirements without throwing or granting facts`, () => {
    reset();
    const before = plain(runtime.getState());
    let result;
    assert.doesNotThrow(() => { result = runtime.registry.register('eventChain', {
      chainId: `qa-invalid-requirements-${label}`, phase: ['day_4', 'day_10'], startConditions: [], hooks: [], fallback: { ...fallbacks },
      nodes: [{ nodeId: 'first', choices: [{ id: 'claim', requirements, effects: [{ op: 'addResource', key: 'parts', value: 20 }] }] }],
    }); });
    assert.equal(result.ok, false);
    assert.ok(result.issues.includes('event-choice-requirements-invalid'));
    assert.equal(runtime.registry.get('eventChain', `qa-invalid-requirements-${label}`), null);
    assert.deepEqual(plain(runtime.getState()), before);
  });
  test(`reducer rejects test-only corrupted ${label} requirements with no reward`, () => {
    const id = `qa-corrupt-requirements-${label}`;
    addTestChain(id, [{ nodeId: 'first', choices: [{ id: 'claim', requirements: [], effects: [{ op: 'addResource', key: 'parts', value: 20 }] }] }]);
    // Test-only corruption after valid registration exercises the lower Gate,
    // independent of registration. No malformed definition enters the game.
    runtime.registry.get('eventChain', id).nodes[0].choices[0].requirements = requirements;
    const state = reset(); assert.equal(runtime.registry.startChain(id).ok, true);
    unchanged(() => runtime.registry.resolveChain(id, 'first', 'claim'), 'choice-contract');
    const result = runtime.resolveCommand(id, 'first', 'claim', { commandId: `qa-corrupt-${label}` });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'choice-contract');
    assert.equal(state.parts, 25);
    assert.equal(eventCount('content.chain.command'), 0);
    assert.equal(eventCount('content.effects.applied'), 0);
    assert.equal(runtime.checkpoints.length, 0);
  });
}
test('requirement helper fails closed on non-string elements while supporting legacy single string conditions', () => {
  reset();
  assert.equal(runtime.requirementsMet('scrap>=0'), true);
  assert.equal(runtime.requirementsMet(['scrap>=20', 'carpenter_alive']), true);
  for (const invalid of [null, {}, ['scrap>=0', null], ['scrap>=0', {}], [25]]) assert.equal(runtime.requirementsMet(invalid), false);
});
test('null nodes/choices and duplicate node/choice IDs return schema issues without throwing', () => {
  const choice = { id: 'claim', effects: [{ op: 'addResource', key: 'parts', value: 1 }] };
  const cases = [
    ['null-node', [null], 'event-node-contract-invalid'],
    ['null-choice', [{ nodeId: 'first', choices: [null] }], 'event-choice-requirements-invalid'],
    ['duplicate-node', [{ nodeId: 'first', choices: [choice] }, { nodeId: 'first', choices: [choice] }], 'event-node-id-duplicate'],
    ['duplicate-choice', [{ nodeId: 'first', choices: [choice, { ...choice }] }], 'event-choice-id-duplicate'],
  ];
  for (const [label, nodes, issue] of cases) {
    let result;
    assert.doesNotThrow(() => { result = runtime.registry.register('eventChain', { chainId: `qa-invalid-${label}`, phase: ['day_4', 'day_10'], nodes, fallback: { ...fallbacks } }); });
    assert.equal(result.ok, false);
    assert.ok(result.issues.includes(issue), JSON.stringify(result));
    assert.equal(runtime.registry.get('eventChain', `qa-invalid-${label}`), null);
  }
});
test('omitted requirements retain empty-list behavior and registered watermill schema remains valid', () => {
  assert.equal(runtime.registry.validate('eventChain', runtime.registry.get('eventChain', 'watermill-002')).ok, true);
  addTestChain('qa-requirements-omitted', [{ nodeId: 'first', choices: [{ id: 'claim', effects: [{ op: 'addResource', key: 'parts', value: 1 }] }] }]);
  const state = reset(); runtime.registry.startChain('qa-requirements-omitted');
  assert.equal(runtime.registry.resolveChain('qa-requirements-omitted', 'first', 'claim').ok, true);
  assert.equal(state.parts, 26);
});

// This is a source-executed CommandBus trace, distinct from replay-harness's
// save/ledger projection hash. Keep simulation ticks: the extracted event
// ledger contains no wall-clock timestamps to strip from this projection.
function sourceReplayProjection() {
  const state = runtime.getState();
  return plain({
    seed: state.worldMeta.seed,
    contentVersion: state.contentState.contentVersion,
    contentState: state.contentState,
    resources: Object.fromEntries(['wood', 'stone', 'food', 'seeds', 'parts', 'medicine', 'tapes', 'morale', 'hp'].map(key => [key, state[key]])),
    worldResources: state.resources,
    events: state.worldMeta.events,
    commands: state.worldMeta.replay.commands,
  });
}
function executeSourceReplay({ restoreMiddle = false } = {}) {
  // Both runs share seed, content version, initial facts and command inputs.
  reset({ worldMeta: { seed: 481516234, rngState: 481516234, eventSeq: 0, commandSeq: 0, events: [], seenCommands: [], replay: { seed: 481516234, commands: [] }, feedback: [], clock: { phaseMinutes: 0, scheduleMinutes: 0 } } });
  assert.equal(runtime.registry.startChain('qa-chain-multi', { actorId: 'player-1' }).ok, true);
  const first = runtime.resolveCommand('qa-chain-multi', 'first', 'advance', { commandId: 'qa-source-replay-001', actorId: 'player-1' });
  assert.equal(first.ok, true);
  assert.equal(runtime.getState().contentState.activeChains['qa-chain-multi'].nodeId, 'second');
  assert.equal(runtime.getState().food, 22);
  const middle = sourceReplayProjection();
  if (restoreMiddle) {
    const save = plain(runtime.getState());
    runtime.reset(save);
    assert.deepEqual(sourceReplayProjection(), middle, 'JSON save/restore preserves authoritative node and trace');
    const restoredBefore = plain(runtime.getState());
    const repeated = runtime.resolveCommand('qa-chain-multi', 'first', 'advance', { commandId: 'qa-source-replay-001', actorId: 'player-1' });
    assert.equal(repeated.ok, true);
    assert.equal(repeated.duplicate, true);
    assert.deepEqual(plain(runtime.getState()), restoredBefore, 'restored first command cannot duplicate resource or ledger');
    assert.equal(runtime.checkpoints.length, 0);
  }
  const second = runtime.resolveCommand('qa-chain-multi', 'second', 'finish', { commandId: 'qa-source-replay-002', actorId: 'player-1' });
  assert.equal(second.ok, true);
  assert.equal(runtime.getState().contentState.activeChains['qa-chain-multi'], undefined);
  assert.equal(runtime.getState().contentState.meters.campCollapse, 9);
  assert.equal(eventCount('content.chain.choice'), 1);
  assert.equal(eventCount('content.chain.resolved'), 1);
  assert.equal(eventCount('content.chain.command'), 2);
  assert.equal(runtime.getState().worldMeta.replay.commands.length, 2);
  return { middle, final: sourceReplayProjection() };
}
let sourceReplayHash;
test('two identical source CommandBus sequences produce the same trajectory hash', () => {
  const first = executeSourceReplay();
  const second = executeSourceReplay();
  assert.deepEqual(second, first);
  sourceReplayHash = stableHash(first);
  assert.equal(stableHash(second), sourceReplayHash);
  // Reviewed contract changes from e14e0776: active instances now persist the
  // optional resolvedNodeIds set; resource results expose before/after. Both
  // enrich the projection and CommandBus receipts without changing rewards.
  assert.deepEqual(first.middle.contentState.activeChains['qa-chain-multi'].resolvedNodeIds, ['first']);
  const legacyTrace = plain(first);
  function removeNewOptionalReceiptFields(value) {
    if (!value || typeof value !== 'object') return;
    delete value.resolvedNodeIds;
    if (value.op === 'addResource' || value.op === 'adjust_resource') { delete value.before; delete value.after; }
    Object.values(value).forEach(removeNewOptionalReceiptFields);
  }
  removeNewOptionalReceiptFields(legacyTrace);
  assert.equal(stableHash(legacyTrace), 'e14e0776', 'golden changes only by reviewed optional settled facts and resource receipt fields');
  assert.equal(sourceReplayHash, 'c5d6c772');
});
test('JSON-restored middle node completes with the same source trace and no duplicate reward', () => {
  const restored = executeSourceReplay({ restoreMiddle: true });
  assert.equal(stableHash(restored), sourceReplayHash);
  const finished = plain(runtime.getState());
  const checkpointCount = runtime.checkpoints.length;
  const repeated = runtime.resolveCommand('qa-chain-multi', 'second', 'finish', { commandId: 'qa-source-replay-002', actorId: 'player-1' });
  assert.equal(repeated.duplicate, true);
  assert.deepEqual(plain(runtime.getState()), finished);
  assert.equal(runtime.checkpoints.length, checkpointCount);
  unchanged(() => runtime.registry.resolveChain('qa-chain-multi', 'first', 'advance'), 'chain-completed');
});

console.log(`content-chain source execution passed: ${checks.length} checks`);
console.log(`sourceHtmlSha256: ${sourceHash}`);
console.log(`sourceReplayHash: ${sourceReplayHash} (source CommandBus trajectory; distinct from save projection hash)`);
for (const name of checks) console.log(`  ✓ ${name}`);
