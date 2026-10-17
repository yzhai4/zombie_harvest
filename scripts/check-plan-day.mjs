#!/usr/bin/env node
/**
 * Execute the shipped plan settlement/command-point functions in Node VM.
 * Normalization, effects, ledger, ration, upkeep, report-close, CommandBus and
 * night-guard functions are extracted from dist/index.html, rather than mirrored
 * here. Calendar tests instrument unrelated spawning, NPC scheduling, content
 * hooks, rendering and checkpoint scheduling; they verify day guards/accounting
 * and command receipts, not a headless gameplay simulation or persistence IO.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { stableHash } from './replay-harness.mjs';
import { readSourceTarget } from './runtime-source-target.mjs';

const { source, sourceHash, htmlPath } = readSourceTarget();
const hasRecoveryController = source.includes('const SessionController =');
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
  const endMarker = `\n${match[1]}}`;
  const end = source.indexOf(endMarker, firstLineEnd);
  assert.ok(end > firstLineEnd, `missing source function end: ${name}`);
  return source.slice(match.index, end + endMarker.length);
}
const functions = [
  'stableClone', 'worldMinute', 'eventDefinition', 'recordWorldEvent', 'applyQuestEvent',
  'migrateContentState', 'normalizeContentEpisodes', 'contentEpisodeIdentity', 'normalizeOutpostAssignments', 'ensureContentState',
  'contentRegistryBase', 'contentDefinition', 'applyContentEffect', 'applyContentEffects',
  'planMeetingState', 'campTrustValue', 'commandPointCap', 'refreshCommandPoints',
  'planNpcVoteWeight', 'planCandidateScore', 'generatePlanMeeting', 'commitPlanMeeting',
  // Older shipped HTML calculated candidates inline. Load actual transaction
  // helpers when they exist rather than replacing their behavior in this VM.
  ...['planMeetingElectorateChanged', 'calculatePlanMeetingCandidates', 'publishPlanMeetingCandidates', 'refreshPlanMeetingPresence']
    .filter(name => source.includes(`function ${name}(`)),
  'executePlanMeeting', 'runPlanMeetingDayStart', 'npcIsActive', 'npcIsCampLocal', 'npcHasRole',
  'foodSituation', 'applyFoodShortageToPeople', 'chargeDailyRation', 'outpostPopulationLedger',
  'applyOutpostUpkeep', 'runWorldDayUpkeep', 'recoverEnergy', 'advanceReducer', 'continueMorningReducer',
  'dispatchCommand', 'isNightRestrictedAction', 'guardNightAction', 'nightActionResult', 'actionCommand',
  'continueMorning',
  ...(hasRecoveryController ? ['savedRecord', 'savedCommandFor', 'savedStartedIdentity', 'savedReportIdentity'] : []),
];
const sandbox = vm.createContext({ console });
vm.runInContext(`
  var state;
  let gameStarted = true;
  const BootRecovery = { classification: 'DAY' };
  // Lifecycle IO and rendering remain outside this accounting suite. Load
  // actual SessionController and report identity logic; set fixture mode only.
  ${hasRecoveryController ? section('const SessionController =', 'let checkpointTimer =') : 'const SessionController = null;'}
  const WORLD_SEED = 481516234;
  const EVENT_DEFS = Object.create(null), QUEST_DEFS = {};
  const EVENT_DEFINITION_VERSION = 1;
  const WEAPON_DEFS = {}, TECH_NODE_DEFS = {}, BUILDING_DEFS = {};
  const FACTION_DEFS = {}, OUTPOST_DEFS = {}, NPC_ROLE_DEFS = {}, EVENT_CHAIN_DEFS = {};
  ${section('const NPC_STORY_DEFS =', 'const NPC_VISUAL_PROFILES =')}
  ${section('const PLAN_DEFS =', 'function planMeetingState(')}
  ${section('const CONTENT_KINDS =', 'function migrateContentState(')}
  const calls = { spawn: 0, successors: 0, hooks: 0, simulationStart: 0 };
  const checkpoints = [];
  function requestCheckpoint(reason) { checkpoints.push(reason); }
  function spawnResource() { calls.spawn++; }
  function assignMorningSuccessors() { calls.successors++; }
  function runContentHook() { calls.hooks++; return { ok: true }; }
  function refreshDynamicNpcEvent() { return null; }
  const eventPool = [{ id: 'qa-daily', title: 'QA daily event' }];
  function randomInt() { return 0; }
  function registerDynamicNpcEvent() {}
  function createEventInstance(id) { return { defId: id, instanceId: id + ':' + state.day }; }
  function log() {}
  function updateFrontierExposure() {}
  function updatePlayerSanity() {}
  function updateNpcRoutine() {}
  function updateRelayProject() {}
  function simulateWorldZombies() {}
  function integrateContinuousMotion() {}
  function runDayCombat() {}
  function renderHud() {}
  let battleTimer = null;
  function clearInterval() {}
  const document = { body: { classList: { remove() {} } } };
  const $ = () => ({ classList: { remove() {} } });
  function adjustSanity() {}
  function clearInteractionFocus() {}
  function startWorldSimulation() { calls.simulationStart++; }
  function toast() {}
  function hideContext() {}
  function render() {}
  function formatTime() { return state.hour + ':' + state.minute; }
  function syncNpcLifeState(npc) { npc.lifeState = npc.hp <= 0 ? 'dead' : 'healthy'; }
  ${section('const NIGHT_ACTION_MESSAGE =', 'function isNightRestrictedAction(')}
  ${functions.map(sourceFunction).join('\n')}
  ${section('const FeedbackRouter =', 'function appendFeedbackEvent(')}
  ${section('const CommandBus =', 'function dispatchCommand(')}
  globalThis.runtime = {
    getState: () => state, calls, checkpoints, action: actionCommand,
    execute: executePlanMeeting, refresh: refreshCommandPoints, dayStart: runPlanMeetingDayStart,
    ration: chargeDailyRation, upkeep: runWorldDayUpkeep, advance: advanceReducer,
    closeReport: continueMorningReducer, closeReportCommand: continueMorning, outpostUpkeep: applyOutpostUpkeep,
    record: recordWorldEvent,
    planDefinition: PLAN_DEFS['plan-defend-core-001'],
    reset(value) { state = value; gameStarted = true; if (SessionController) { SessionController.mode = value.night ? 'REPORT' : 'DAY'; SessionController.exiting = false; } Object.keys(calls).forEach(key => calls[key] = 0); checkpoints.length = 0; ensureContentState(); },
  };
`, sandbox, { filename: htmlPath + ':plan-day-extracted' });
const runtime = sandbox.runtime;
const plain = value => JSON.parse(JSON.stringify(value));
function initial(overrides = {}) {
  return {
    day: 2, hour: 8, minute: 0, night: false, gameOver: null,
    wood: 10, stone: 8, food: 20, seeds: 3, parts: 25, medicine: 1, tapes: 0, morale: 70, hp: 80,
    npcs: [{ id: 'carpenter', name: 'QA carpenter', hp: 100, maxHp: 100, lifeState: 'healthy', bond: 1 }],
    buildings: [], resources: [], landmarks: [], specialItems: {}, roleVacancies: {}, quests: [], campStanding: {},
    event: { id: 'qa-pending', handled: false },
    // Preserve the same event/UI domains that the real effect transaction saves.
    eventInstance: null, npcEvents: [], selectedNpc: null, npcTalkOpen: null, interactionFocus: null, logs: [],
    world: { lastRationDay: 1, lastDailyUpkeepDay: 1, totalMinutes: 1920 },
    contentState: { contentVersion: 3, meters: { campCollapse: 10, resonancePressure: 25, campTrust: 25 },
      commandPoints: 0, commandPointsMax: 2, commandPointsGrantedDay: 1 },
    worldMeta: { seed: 481516234, rngState: 481516234, eventSeq: 0, commandSeq: 0, events: [], seenCommands: [], replay: { seed: 481516234, commands: [] }, feedback: [], clock: { phaseMinutes: 0, scheduleMinutes: 0 } },
    ...overrides,
  };
}
function reset(overrides = {}) { runtime.reset(initial(overrides)); return runtime.getState(); }
function meeting(state, effects = runtime.planDefinition.effects, extra = {}) {
  state.contentState.planMeeting = { version: 1, status: 'candidate', meetingDay: 1, instanceId: 'camp-plan-meeting-001:d1', source: 'summary',
    selectedId: runtime.planDefinition.id, playerAction: null, committedDay: null, resolvedDay: null, autonomyResult: null, history: [],
    candidates: [{ ...plain(runtime.planDefinition), effects: plain(effects) }], ...extra };
}
const events = type => runtime.getState().worldMeta.events.filter(event => event.type === type);
const checks = [];
function test(name, run) { run(); checks.push(name); }
function unchanged(call, reason) {
  const before = plain(runtime.getState()); const result = call();
  assert.equal(result.ok, false); assert.equal(result.reason, reason);
  assert.deepEqual(plain(runtime.getState()), before);
}

test('successful effects settle authoritative meeting/history and one event', () => {
  const state = reset(); meeting(state);
  assert.equal(runtime.execute().ok, true);
  assert.equal(state.contentState.meters.campCollapse, 7);
  assert.equal(state.contentState.planMeeting.status, 'resolved');
  assert.equal(state.contentState.planMeeting.resolvedDay, 2);
  assert.equal(state.contentState.planMeeting.history.length, 1);
  assert.equal(state.contentState.planMeeting.autonomyResult.route, 'autonomy');
  assert.equal(events('plan.meeting.resolved').length, 1);
  assert.equal(events('content.effects.applied').length, 0);
  unchanged(() => runtime.execute(), 'plan-not-due');
  state.day = 3; unchanged(() => runtime.execute(), 'plan-not-due');
});
test('committed player plan preserves its route after effects normalize', () => {
  const state = reset(); meeting(state, runtime.planDefinition.effects, { status: 'committed', playerAction: 'modify' });
  assert.equal(runtime.execute().ok, true);
  assert.equal(state.contentState.planMeeting.autonomyResult.route, 'modify');
  assert.equal(events('plan.meeting.resolved')[0].actorId, 'player-1');
});
test('failure rollback settles current meeting/history without partial effects', () => {
  const state = reset(); meeting(state, [{ op: 'addResource', key: 'food', value: 5 }, { op: 'recordHistory', key: 'qa-partial' }, { op: 'damageBuilding', buildingId: 'qa-absent', value: 1 }]);
  const result = runtime.execute(); assert.equal(result.ok, false); assert.equal(result.reason, 'building-missing');
  assert.equal(state.food, 20); assert.equal(state.contentState.history.length, 0);
  assert.equal(state.contentState.planMeeting.status, 'resolved');
  assert.equal(state.contentState.planMeeting.resolvedDay, 2);
  assert.equal(state.contentState.planMeeting.history.length, 1);
  assert.equal(state.contentState.planMeeting.history[0].action, 'fallback');
  assert.equal(events('content.history').length, 0);
  assert.equal(events('plan.meeting.resolved').length, 0); assert.equal(events('plan.meeting.fallback').length, 1);
  unchanged(() => runtime.execute(), 'plan-not-due');
});
test('invalid effect preflight also terminates current meeting exactly once', () => {
  const state = reset(); meeting(state, [{ op: 'qa-unsupported' }]);
  assert.equal(runtime.execute().fallback, true);
  assert.equal(state.contentState.planMeeting.status, 'resolved');
  assert.equal(events('plan.meeting.fallback').length, 1);
  unchanged(() => runtime.execute(), 'plan-not-due');
});
test('legacy candidate with applied effect receipt recovers without extra reward', () => {
  const state = reset(); meeting(state);
  const effectId = 'plan:1:' + runtime.planDefinition.id;
  state.contentState.appliedEffects.push(effectId); state.contentState.meters.campCollapse = 7;
  assert.equal(runtime.execute().ok, true);
  assert.equal(state.contentState.meters.campCollapse, 7);
  assert.equal(state.contentState.planMeeting.status, 'resolved');
  assert.equal(state.contentState.planMeeting.history.length, 1);
  assert.equal(events('plan.meeting.resolved').length, 1);
  unchanged(() => runtime.execute(), 'plan-not-due');
});
test('legacy unresolved candidate plus existing resolved ledger keeps one event', () => {
  const state = reset(); meeting(state); runtime.execute();
  const prior = plain(state.worldMeta.events);
  state.contentState.planMeeting.status = 'candidate'; state.contentState.planMeeting.resolvedDay = null;
  state.contentState.planMeeting.history = []; state.contentState.planMeeting.autonomyResult = null;
  assert.equal(runtime.execute().ok, true);
  assert.equal(state.contentState.meters.campCollapse, 7);
  assert.equal(state.contentState.planMeeting.status, 'resolved');
  assert.equal(state.contentState.planMeeting.history.length, 1);
  assert.deepEqual(plain(state.worldMeta.events), prior);
});
test('legacy fallback ledger recovers without retrying now-valid effects', () => {
  const state = reset(); meeting(state, [{ op: 'damageBuilding', buildingId: 'qa-absent', value: 1 }]); runtime.execute();
  state.contentState.planMeeting.status = 'candidate'; state.contentState.planMeeting.history = [];
  state.buildings = [{ id: 'qa-absent', hp: 10 }];
  assert.equal(runtime.execute().fallback, true);
  assert.equal(state.buildings[0].hp, 10); assert.equal(events('plan.meeting.fallback').length, 1);
});
for (const [flag, value, reason] of [['night', true, 'night-lock'], ['gameOver', 'camp-lost', 'game-over']]) {
  test(`execute rejects ${flag} before mutation`, () => { const state = reset(); meeting(state); state[flag] = value; unchanged(() => runtime.execute(), reason); });
}
test('same-day or future meeting is not prematurely applied', () => {
  const state = reset(); meeting(state, runtime.planDefinition.effects, { meetingDay: 2 });
  unchanged(() => runtime.execute(), 'plan-not-due');
  state.contentState.planMeeting.meetingDay = 3; unchanged(() => runtime.execute(), 'plan-not-due');
});
test('same-day refresh never tops up spent points or repeats a grant event', () => {
  const state = reset(); runtime.refresh(); assert.equal(state.contentState.commandPoints, 2);
  state.contentState.commandPoints = 0; const eventCount = events('plan.commandPoints.refreshed').length;
  runtime.refresh('initial'); runtime.refresh('day-start');
  assert.equal(state.contentState.commandPoints, 0); assert.equal(events('plan.commandPoints.refreshed').length, eventCount);
});
test('JSON-restored same-day spent points remain spent on boot refresh', () => {
  const state = reset(); runtime.refresh(); state.contentState.commandPoints = 0;
  runtime.reset(plain(state)); const before = plain(runtime.getState()); runtime.refresh('initial');
  assert.deepEqual(plain(runtime.getState()), before);
});
test('same-day cap decrease clamps points down, increase does not top up', () => {
  const state = reset(); state.contentState.meters.campTrust = 80; runtime.refresh();
  assert.equal(state.contentState.commandPoints, 4);
  state.contentState.meters.campCollapse = 75; runtime.refresh('initial');
  assert.equal(state.contentState.commandPoints, 3); assert.equal(state.contentState.commandPointsMax, 3);
  state.contentState.commandPoints = 1; state.contentState.meters.campCollapse = 0; runtime.refresh('initial');
  assert.equal(state.contentState.commandPoints, 1); assert.equal(state.contentState.commandPointsMax, 4);
  state.contentState.meters.campTrust = 0; runtime.refresh('initial');
  assert.equal(state.contentState.commandPoints, 0); assert.equal(state.contentState.commandPointsMax, 0);
});
test('new calendar day grants cap without accumulating old points', () => {
  const state = reset(); runtime.refresh(); state.contentState.commandPoints = 1; state.day = 3; runtime.refresh();
  assert.equal(state.contentState.commandPoints, 2); assert.equal(state.contentState.commandPointsGrantedDay, 3);
  assert.equal(events('plan.commandPoints.refreshed').length, 2);
});
test('legacy save without granted-day receives one grant then stays stable', () => {
  const state = reset(); delete state.contentState.commandPointsGrantedDay; runtime.refresh('initial');
  assert.equal(state.contentState.commandPoints, 2); assert.equal(state.contentState.commandPointsGrantedDay, 2);
  const before = plain(state); runtime.refresh('initial'); assert.deepEqual(plain(state), before);
});
test('ration charges once on a calendar day and shortage effects remain idempotent', () => {
  const state = reset(); assert.equal(runtime.ration(), 2); assert.equal(runtime.ration(), 0);
  assert.equal(state.food, 18); assert.equal(state.world.lastRationDay, 2);
  state.day = 3; state.food = 0; runtime.ration(); const after = plain(state); runtime.ration();
  assert.deepEqual(plain(state), after); assert.equal(state.contentState.meters.campCollapse, 12);
});
test('world daily upkeep grows and produces once, retaining pending event', () => {
  const state = reset({ buildings: [{ type: 'garden', planted: true, ready: false, growth: 0 }] }); meeting(state);
  assert.equal(runtime.upkeep(), true); const after = plain(state);
  assert.equal(runtime.upkeep(), false); assert.deepEqual(plain(state), after);
  assert.equal(state.wood, 12); assert.equal(state.buildings[0].growth, 1); assert.equal(state.hp, 92);
  assert.equal(state.event.id, 'qa-pending'); assert.equal(state.contentState.planMeeting.status, 'resolved');
  assert.deepEqual(plain(runtime.calls), { spawn: 1, successors: 1, hooks: 1, simulationStart: 0 });
});
test('cross-midnight advance executes daily accounting once', () => {
  const state = reset({ day: 1, hour: 23, minute: 58, world: { lastRationDay: 1, lastDailyUpkeepDay: 1 } }); meeting(state);
  runtime.advance(5); assert.equal(state.day, 2); assert.equal(state.hour, 0); assert.equal(state.minute, 3);
  assert.equal(state.food, 18); assert.equal(state.wood, 12); assert.equal(state.contentState.planMeeting.status, 'resolved');
  assert.equal(events('plan.meeting.resolved').length, 1); assert.equal(state.contentState.commandPoints, 2);
  runtime.advance(5); assert.equal(state.food, 18); assert.equal(state.wood, 12);
  assert.equal(events('plan.meeting.resolved').length, 1); assert.equal(runtime.calls.spawn, 1);
});
test('same-day report close preserves calendar and cannot repeat ration/upkeep', () => {
  const state = reset({ hour: 10, minute: 30 }); meeting(state); runtime.ration(); runtime.upkeep();
  state.night = true; state.nightBattle = { resolved: true };
  const before = { day: state.day, hour: state.hour, minute: state.minute, food: state.food, wood: state.wood, hp: state.hp, points: state.contentState.commandPoints };
  runtime.closeReport(); runtime.closeReport();
  assert.deepEqual({ day: state.day, hour: state.hour, minute: state.minute, food: state.food, wood: state.wood, hp: state.hp, points: state.contentState.commandPoints }, before);
  assert.equal(events('plan.meeting.resolved').length, 1); assert.equal(runtime.calls.spawn, 1);
});

function readyReport(overrides = {}) {
  const state = reset({ hour: 10, minute: 30, night: true,
    nightBattle: { instanceId: 'qa-threat-d2-001', resolved: true }, ...overrides });
  // TEST-ONLY resolved receipt makes the explicit instance verifiable by the
  // actual identity Gate. It is not a complete boot/persistence fixture.
  if (hasRecoveryController) runtime.record('threat.resolved', { threatId: state.nightBattle?.instanceId || 'qa-threat-d2-001' });
  return state;
}
function accounting(state) {
  return plain({ day: state.day, hour: state.hour, minute: state.minute, food: state.food,
    wood: state.wood, hp: state.hp, buildings: state.buildings, world: state.world,
    commandPoints: state.contentState.commandPoints, commandPointsMax: state.contentState.commandPointsMax,
    commandPointsGrantedDay: state.contentState.commandPointsGrantedDay });
}
function rejectedClose(options, reason = 'report-not-ready') {
  const priorEvents = events('threat.closed').length;
  const priorCheckpoints = plain(runtime.checkpoints);
  const priorAccounting = accounting(runtime.getState());
  const priorCalls = plain(runtime.calls);
  const result = runtime.closeReportCommand(options);
  assert.equal(result.ok, false); assert.equal(result.reason, reason);
  assert.equal(events('threat.closed').length, priorEvents);
  assert.deepEqual(plain(runtime.checkpoints), priorCheckpoints);
  assert.deepEqual(accounting(runtime.getState()), priorAccounting);
  assert.deepEqual(plain(runtime.calls), priorCalls);
  assert.equal(events('command.rejected').at(-1).commandId, options.commandId);
  return result;
}

test('resolved report command closes its exact threat with replay receipt and one checkpoint', () => {
  const state = readyReport({ buildings: [{ type: 'garden', planted: true, ready: false, growth: 0 }] });
  const result = runtime.closeReportCommand({ commandId: 'qa-close-ready' });
  assert.equal(result.ok, true); assert.equal(state.night, false); assert.equal(state.nightBattle, null);
  assert.equal(events('threat.closed').length, 1); assert.equal(result.event.type, 'threat.closed');
  assert.deepEqual(plain(result.event.payload), { threatId: 'qa-threat-d2-001', day: 2, hour: 10, minute: 30 });
  assert.equal(result.event.commandId, 'qa-close-ready'); assert.equal(result.event.actorId, 'player-1');
  assert.deepEqual(plain(state.worldMeta.replay.commands), [{ commandId: 'qa-close-ready',
    type: 'threat.close', actorId: 'player-1', payload: { threatId: 'qa-threat-d2-001' } }]);
  assert.deepEqual(plain(state.worldMeta.seenCommands), ['qa-close-ready']);
  assert.deepEqual(plain(state.worldMeta.feedback), [{ eventId: result.event.eventId, type: 'threat.closed' }]);
  assert.deepEqual(plain(runtime.checkpoints), ['command:threat.close']);
  assert.equal(state.day, 2); assert.equal(state.hour, 10); assert.equal(state.minute, 30);
  assert.equal(state.food, 18); assert.equal(state.wood, 12); assert.equal(state.hp, 92);
  assert.equal(state.buildings[0].growth, 1);
  assert.equal(state.world.lastRationDay, 2); assert.equal(state.world.lastDailyUpkeepDay, 2);
  assert.equal(state.world.totalMinutes, 2070); assert.equal(state.event.id, 'qa-pending');
  assert.equal(state.contentState.commandPoints, 0); assert.equal(state.contentState.commandPointsGrantedDay, 1);
  assert.deepEqual(plain(runtime.calls), { spawn: 1, successors: 1, hooks: 0, simulationStart: 1 });
  const after = accounting(state); runtime.ration(); runtime.upkeep();
  assert.deepEqual(accounting(state), after);
});
test('same command ID cannot close or settle the report twice', () => {
  readyReport(); runtime.closeReportCommand({ commandId: 'qa-close-repeat' });
  const before = plain(runtime.getState()), beforeCalls = plain(runtime.calls);
  const beforeCheckpoints = plain(runtime.checkpoints);
  const duplicate = runtime.closeReportCommand({ commandId: 'qa-close-repeat' });
  assert.equal(duplicate.ok, true); assert.equal(duplicate.duplicate, true);
  assert.deepEqual(plain(runtime.getState()), before); assert.deepEqual(plain(runtime.calls), beforeCalls);
  assert.deepEqual(plain(runtime.checkpoints), beforeCheckpoints); assert.equal(events('threat.closed').length, 1);
});
test('different command ID double-click with no report emits rejection and no success/checkpoint', () => {
  const state = readyReport(); runtime.closeReportCommand({ commandId: 'qa-close-first' });
  rejectedClose({ commandId: 'qa-close-second' });
  assert.equal(state.night, false); assert.equal(state.nightBattle, null);
  assert.equal(events('command.rejected').length, 1);
  assert.deepEqual(plain(events('command.rejected')[0].payload), { type: 'threat.close', reason: 'report-not-ready' });
  assert.deepEqual(plain(state.worldMeta.replay.commands.at(-1)), { commandId: 'qa-close-second',
    type: 'threat.close', actorId: 'player-1', payload: { threatId: null } });
});
test('unresolved battle cannot close and remains in night mode', () => {
  const state = readyReport({ nightBattle: { instanceId: 'qa-threat-active', resolved: false } });
  const battle = plain(state.nightBattle);
  rejectedClose({ commandId: 'qa-close-unresolved' });
  assert.equal(state.night, true); assert.deepEqual(plain(state.nightBattle), battle);
  assert.equal(events('command.rejected').length, 1);
  assert.equal(state.worldMeta.replay.commands[0].payload.threatId, 'qa-threat-active');
});
test('resolved legacy report without threat ID is rejected without leaving night', () => {
  const state = readyReport({ nightBattle: { resolved: true } });
  rejectedClose({ commandId: 'qa-close-missing-id' });
  assert.equal(state.night, true); assert.equal(state.nightBattle.resolved, true);
});
test('actual night guard still blocks ordinary daytime commands before the bus', () => {
  const state = readyReport(); const before = plain(state); let reduced = false;
  const result = runtime.action('qa.day-action', 'qa.day-action.done', {}, () => { reduced = true; });
  assert.equal(result.ok, false); assert.equal(result.reason, 'night-lock'); assert.equal(reduced, false);
  assert.deepEqual(plain(state), before); assert.equal(runtime.checkpoints.length, 0);
});
test('game-over validation blocks report close before reducer reset side effects', () => {
  const state = readyReport({ gameOver: 'camp-lost' });
  rejectedClose({ commandId: 'qa-close-game-over' }, 'game-over');
  assert.equal(state.night, true); assert.equal(state.nightBattle.instanceId, 'qa-threat-d2-001');
  assert.equal(state.worldMeta.replay.commands.length, 0); assert.equal(state.worldMeta.seenCommands.length, 0);
});

function planTrace() {
  const state = reset(); meeting(state); runtime.dayStart();
  assert.equal(state.contentState.planMeeting.status, 'resolved'); assert.equal(state.contentState.meters.campCollapse, 7);
  state.contentState.commandPoints = 0; const saved = plain(state); runtime.reset(saved); runtime.refresh('initial');
  assert.equal(runtime.getState().contentState.commandPoints, 0);
  unchanged(() => runtime.execute(), 'plan-not-due');
  runtime.getState().day = 3; runtime.refresh();
  assert.equal(runtime.getState().contentState.commandPoints, 2);
  return plain({ contentState: runtime.getState().contentState, events: runtime.getState().worldMeta.events });
}
let planDayTraceHash;
test('identical plan/day sequences including JSON restore have a stable trace', () => {
  const traceA = planTrace(), traceB = planTrace(); assert.deepEqual(traceA, traceB);
  planDayTraceHash = stableHash(traceA);
  // Fixed after verifying the settlement, no-refill and calendar assertions
  // above; this metric has its own contract and never rebases chain traces.
  assert.equal(planDayTraceHash, '66c9368d');
});
console.log(`plan-day source execution passed: ${checks.length} checks`);
console.log(`sourceHtmlSha256: ${sourceHash}`);
console.log(`planDayTraceHash: ${planDayTraceHash} (plan settlement/calendar contract; separate from content-chain trace)`);
for (const name of checks) console.log(`  ✓ ${name}`);

