#!/usr/bin/env node
/**
 * Save fixtures and deterministic replay harness for v83 outpost accounting.
 *
 * This intentionally does not import or execute dist/index.html.  It mirrors
 * the save envelope and replay ledger contracts so that malformed saves and
 * non-deterministic command traces can be checked in CI without a browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// v81 adds the content-state plan meeting contract to the save envelope.
// Keep the harness version in lockstep with the browser reducer so fixtures
// catch accidental downgrades while still allowing migration of v79/v80 saves.
export const SAVE_VERSION = 21;
export const CONTENT_SCHEMA_VERSION = 3;
export const WORLD_SEED = 481516234;

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = path.join(HERE, 'fixtures');

/** Matches the FNV-1a checksum used by the game save envelope. */
export function checksum(value) {
  let hash = 2166136261;
  const text = JSON.stringify(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
/** Stable object key ordering for replay hashes across Node/browser versions. */
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function stableHash(value) {
  return checksum(canonical(value));
}

function event(type, seq, payload = {}, commandId = null) {
  return {
    eventId: `evt-${String(seq).padStart(6, '0')}`,
    seq,
    type,
    actorId: 'system',
    commandId,
    causationId: commandId,
    tick: { world: 420 + seq, phase: 0, schedule: seq },
    payload
  };
}

function command(commandId, type, payload = {}) {
  return { commandId, type, actorId: 'player-1', payload };
}

const DEFAULT_CONTENT_STATE = Object.freeze({
  contentVersion: CONTENT_SCHEMA_VERSION,
  meters: { campCollapse: 0, resonancePressure: 25, campTrust: 0 },
  commandPoints: 0,
  commandPointsMax: 0,
  commandPointsGrantedDay: 0,
  autonomyWeights: { defense: 40, harvest: 25, logistics: 20, research: 10, diplomacy: 5 },
  planMeeting: {
    version: 1,
    status: 'idle',
    meetingDay: 0,
    instanceId: null,
    source: 'summary',
    candidates: [],
    selectedId: null,
    playerAction: null,
    committedDay: null,
    resolvedDay: null,
    autonomyResult: null,
    history: []
  },
  unlockedTech: [], unlockedWeapons: ['rustAxe'], unlockedBlueprints: [], flags: {},
  npcRoster: { promotedNpcIds: [], promotionHistory: [] },
  scheduledEvents: [], triggeredEvents: [], activeChains: {}, completedChains: [],
  appliedEffects: [], outposts: {}, history: []
});

/**
 * Migrate the content registry portion of a save without changing the source
 * payload.  v79/v80 contentVersion=1 saves did not have campTrust, command
 * points, or planMeeting; all missing fields receive deterministic defaults.
 */
export function migrateContentState(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fromVersion = Number(source.contentVersion || 1);
  const sourceMeters = source.meters && typeof source.meters === 'object' ? source.meters : {};
  const sourcePlan = source.planMeeting && typeof source.planMeeting === 'object' ? source.planMeeting : {};
  const defaults = DEFAULT_CONTENT_STATE;
  const state = {
    ...defaults,
    ...source,
    contentVersion: CONTENT_SCHEMA_VERSION,
    meters: { ...defaults.meters, ...sourceMeters, ...(sourceMeters.campTrust == null && source.campTrust != null ? { campTrust: source.campTrust } : {}) },
    autonomyWeights: { ...defaults.autonomyWeights, ...(source.autonomyWeights || {}) },
    planMeeting: { ...defaults.planMeeting, ...sourcePlan },
    npcRoster: { ...defaults.npcRoster, ...(source.npcRoster || {}) }
  };
  // Arrays/records are part of the stable shape.  A malformed legacy field
  // should not make replay non-deterministic or crash the loader.
  for (const key of ['unlockedTech', 'unlockedWeapons', 'unlockedBlueprints', 'scheduledEvents', 'triggeredEvents', 'completedChains', 'appliedEffects', 'history']) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  for (const key of ['flags', 'activeChains', 'outposts']) {
    if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) state[key] = {};
  }
  // Clone nested outpost records before normalizing them; migration must not
  // mutate the caller's save payload while computing a replay projection.
  state.outposts = Object.fromEntries(Object.entries(state.outposts).map(([outpostId, raw]) => [
    outpostId,
    raw && typeof raw === 'object' ? { ...raw, guardNpcIds: Array.isArray(raw.guardNpcIds) ? [...raw.guardNpcIds] : [] } : raw
  ]));
  if (!Array.isArray(state.planMeeting.candidates)) state.planMeeting.candidates = [];
  if (!Array.isArray(state.planMeeting.history)) state.planMeeting.history = [];
  state.npcRoster.promotedNpcIds = [...new Set(Array.isArray(state.npcRoster.promotedNpcIds) ? state.npcRoster.promotedNpcIds : [])].slice(-10);
  state.npcRoster.promotionHistory = Array.isArray(state.npcRoster.promotionHistory) ? state.npcRoster.promotionHistory.slice(-30) : [];
  for (const [outpostId, raw] of Object.entries(state.outposts)) {
    if (!raw || typeof raw !== 'object') { delete state.outposts[outpostId]; continue; }
    raw.guardNpcIds = [...new Set(Array.isArray(raw.guardNpcIds) ? raw.guardNpcIds.filter(Boolean) : [])];
    raw.status = ['secured', 'strained', 'vacant'].includes(raw.status) ? raw.status : 'secured';
    raw.lastUpkeepDay = Math.max(0, Number(raw.lastUpkeepDay) || 0);
  }
  state.commandPoints = Math.max(0, Number(state.commandPoints) || 0);
  state.commandPointsMax = Math.max(0, Number(state.commandPointsMax) || 0);
  state.commandPointsGrantedDay = Math.max(0, Number(state.commandPointsGrantedDay) || 0);
  for (const key of ['campCollapse', 'resonancePressure', 'campTrust']) {
    state.meters[key] = Math.max(0, Number(state.meters[key]) || 0);
  }
  return { state, fromVersion, migrated: fromVersion < CONTENT_SCHEMA_VERSION };
}

/** A deliberately small but loader-shaped v81 payload. */
export function basePayload(overrides = {}) {
  const commands = [
    command('cmd-000001', 'resource.collect', { resource: 'wood', amount: 4 }),
    command('cmd-000002', 'relay.coreHandOff', { itemId: 'relayCore' })
  ];
  const events = [
    event('resource.collected', 1, { resource: 'wood', amount: 4 }, 'cmd-000001'),
    event('relay.coreHandedOff', 2, { itemId: 'relayCore' }, 'cmd-000002')
  ];
  const payload = {
    version: SAVE_VERSION,
    day: 1,
    hour: 7,
    minute: 12,
    energy: 92,
    sanity: 72,
    sanityClock: 0,
    sanityLastReason: 'fixture',
    hp: 100,
    wood: 14,
    stone: 8,
    food: 20,
    seeds: 3,
    parts: 4,
    medicine: 1,
    morale: 72,
    campaign: { id: 'zombie-farm', title: '我是大救星', scenarioId: 'zombie-farm' },
    campStanding: { prestige: 10, merit: 6, legitimacy: 50, domains: { logistics: 2, defense: 1 } },
    specialItems: { relayCore: 1 },
    relayProject: {
      id: 'camp-relay-001',
      status: 'briefed',
      coreItemId: 'item-relayCore-001',
      materialNeed: { wood: 10, parts: 5, stone: 4 },
      materialProgress: { wood: 0, parts: 0, stone: 0 },
      workMinutes: 0,
      targetMinutes: 180,
      assignedNpcIds: ['radio', 'carpenter', 'quartermaster']
    },
    hordeForecast: { confidence: 18, leadMinutes: 0, routeId: 'eastern-breach', source: 'fixture', updatedAt: 0 },
    contentState: migrateContentState(DEFAULT_CONTENT_STATE).state,
    collection: {},
    weapon: { id: 'rusty-pistol' },
    event: { id: 'relay-briefing', handled: false, result: '' },
    eventInstance: {
      instanceId: 'event-relay-briefing-1',
      defId: 'relay-briefing',
      status: 'active',
      createdAt: 420,
      handled: false,
      payload: { relayProjectId: 'camp-relay-001' }
    },
    eventThreat: 0,
    eventShield: 0,
    night: false,
    nightBattle: null,
    mapRevision: 8,
    player: { id: 'player-1', x: 19, y: 3 },
    motion: { enabled: true, stepIndex: 0, input: { x: 0, y: 0 } },
    buildings: [],
    resources: [],
    landmarks: [],
    world: {},
    worldZombies: [],
    npcs: [],
    npcEvents: [],
    visitedRegions: { core: true },
    areaFlags: {},
    roleVacancies: {},
    tempCoordination: false,
    settings: { continuousWorld: true },
    staminaRules: { actionCosts: {} },
    quests: [{ id: 'relay-chain-001', completedSteps: ['recover-relay-core', 'brief-commander'] }],
    worldMeta: {
      seed: WORLD_SEED,
      rngState: WORLD_SEED,
      eventSeq: events.length,
      commandSeq: commands.length,
      events,
      seenCommands: commands.map(item => item.commandId),
      replay: { seed: WORLD_SEED, commands },
      feedback: [],
      clock: { paused: false, rate: 1, phaseMinutes: 0, scheduleMinutes: 12 },
      lastEventId: events.at(-1)?.eventId || null
    }
  };
  return { ...payload, ...overrides, worldMeta: { ...payload.worldMeta, ...(overrides.worldMeta || {}) } };
}

export function makeEnvelope(payload, reason = 'fixture') {
  return {
    ...payload,
    version: SAVE_VERSION,
    checksum: checksum(payload),
    payload,
    savedAt: Number(payload.day || 1) * 1440 + Number(payload.hour || 0) * 60 + Number(payload.minute || 0),
    reason
  };
}

export function fixtureEnvelopes() {
  const valid = makeEnvelope(basePayload(), 'fixture-valid');
  const corruptChecksum = { ...valid, checksum: 'deadbeef', reason: 'fixture-corrupt-checksum' };
  const activeEvent = makeEnvelope(basePayload({
    event: { id: 'san-breakpoint', handled: false, result: '' },
    eventInstance: {
      instanceId: 'event-san-breakpoint-1',
      defId: 'san-breakpoint',
      status: 'active',
      createdAt: 480,
      handled: false,
      payload: { npcId: 'carpenter', pressure: 88 }
    },
    worldMeta: {
      events: [
        ...basePayload().worldMeta.events,
        event('npc.event.triggered', 3, { npcId: 'carpenter', eventId: 'san-breakpoint', pressure: 88 }, 'cmd-000003')
      ],
      eventSeq: 3
    }
  }), 'fixture-active-event');
  const nightUnresolved = makeEnvelope(basePayload({
    day: 1,
    hour: 22,
    minute: 5,
    night: true,
    nightBattle: {
      id: 'threat-1-22-5-3',
      routeId: 'eastern-breach',
      resolved: false,
      enemies: [{ id: 'zombie-001', hp: 40, maxHp: 40, x: 24, y: 6, kind: 'shambler' }]
    },
    worldMeta: { clock: { paused: false, rate: 1, phaseMinutes: 5, scheduleMinutes: 905 } }
  }), 'fixture-night-unresolved');
  const nightResolved = makeEnvelope(basePayload({
    day: 1,
    hour: 23,
    minute: 50,
    night: true,
    nightBattle: {
      id: 'threat-1-23-50-4',
      routeId: 'eastern-breach',
      resolved: true,
      enemies: []
    },
    worldMeta: { clock: { paused: false, rate: 1, phaseMinutes: 110, scheduleMinutes: 1010 } }
  }), 'fixture-night-resolved');
  const fiveDayNpc = makeEnvelope(basePayload({
    day: 5,
    hour: 7,
    contentState: migrateContentState({ ...DEFAULT_CONTENT_STATE, npcRoster: { promotedNpcIds: ['carpenter'], promotionHistory: [{ npcId: 'carpenter', day: 5, activeSkill: 'repair-squad' }] } }).state,
    npcs: [
      { id: 'carpenter', lifeState: 'healthy', attributes: { buildSkill: 86, production: 72 }, hero: { tier: 'hero', status: 'promoted', progress: 100, activeSkill: 'repair-squad', passiveSkill: 'construction-crew', promotedDay: 5 } },
      { id: 'sergeant', lifeState: 'healthy', actingRole: 'commander', actingFor: 'commander', scheduleState: '继任培训', hero: { tier: 'ordinary', status: 'locked', progress: 0, activeSkill: null, passiveSkill: null, promotedDay: null } }
    ],
    roleVacancies: {},
    worldMeta: {
      events: [
        ...basePayload().worldMeta.events,
        event('npc.promotion.completed', 3, { npcId: 'carpenter', day: 5, activeSkill: 'repair-squad' }, 'cmd-000003')
      ],
      eventSeq: 3
    }
  }), 'fixture-five-day-npc');
  // An event can remain active while its NPC is lost during the following
  // threat.  The browser reducer must cancel that event without applying its
  // effects, then activate the next live queued event.  Keep this save shape
  // in the replay corpus so migrations cannot silently drop the edge case.
  const npcDeadEvent = makeEnvelope(basePayload({
    day: 2,
    event: { id: 'npc.carpenter.wall-duty.0', defId: 'npc.wall-duty', handled: false, npcEvent: { npcId: 'carpenter', chainId: 'wall-duty', step: 0 } },
    eventInstance: {
      instanceId: 'npc.carpenter.wall-duty.0',
      defId: 'npc.wall-duty',
      status: 'active',
      createdAt: 1440,
      handled: false,
      payload: { npcId: 'carpenter', chainId: 'wall-duty', step: 0 }
    },
    npcs: [
      { id: 'carpenter', lifeState: 'dead', hp: 0, maxHp: 100, eventChain: { step: 0, active: { id: 'npc.carpenter.wall-duty.0', status: 'active' } } },
      { id: 'doctor', lifeState: 'healthy', hp: 100, maxHp: 100, eventChain: { step: 0, active: null } }
    ],
    npcEvents: [
      { id: 'npc.carpenter.wall-duty.0', npcId: 'carpenter', step: 0, status: 'active' },
      { id: 'npc.doctor.triage-load.0', npcId: 'doctor', step: 0, status: 'queued', event: { id: 'npc.doctor.triage-load.0', defId: 'npc.triage-load', npcEvent: { npcId: 'doctor', chainId: 'triage-load', step: 0 } } }
    ],
    worldMeta: {
      events: [
        ...basePayload().worldMeta.events,
        event('npc.event.triggered', 3, { eventId: 'npc.carpenter.wall-duty.0', npcId: 'carpenter', step: 0 }, 'cmd-000003'),
        event('threat.resolved', 4, { threatId: 'threat-2-1-3', npcDeaths: 1 }, 'cmd-000004')
      ],
      eventSeq: 4,
      lastEventId: 'evt-000004'
    }
  }), 'fixture-npc-dead-event');
  const outpostGarrison = makeEnvelope(basePayload({
    day: 2,
    food: 9,
    contentState: migrateContentState({ ...DEFAULT_CONTENT_STATE, outposts: { watchPost: { status: 'secured', guardNpcIds: ['guardJi'], guardSlots: 1, securedAt: 960, lastUpkeepDay: 2, lastUpkeepResult: 'paid' } } }).state,
    npcs: [
      { id: 'guardJi', lifeState: 'healthy', garrisonedOutpostId: 'watchPost' },
      { id: 'guardChen', lifeState: 'healthy' },
      { id: 'guardJiang', lifeState: 'injured' },
      { id: 'commander', lifeState: 'healthy' }
    ],
    worldMeta: {
      events: [
        ...basePayload().worldMeta.events,
        event('outpost.secured', 3, { outpostId: 'watchPost', guardNpcIds: ['guardJi'], population: { livingRoster: 4, campLocal: 3, garrisoned: 1 } }, 'cmd-000003'),
        event('outpost.upkeep', 4, { outpostId: 'watchPost', day: 2, food: 1, paid: 1, status: 'secured' }, 'cmd-000004')
      ],
      eventSeq: 4
    }
  }), 'fixture-outpost-garrison');
  const watermillChain = makeEnvelope(basePayload({
    day: 4,
    contentState: migrateContentState({
      ...DEFAULT_CONTENT_STATE,
      meters: { ...DEFAULT_CONTENT_STATE.meters, campTrust: 25 },
      activeChains: { 'watermill-002': { chainId: 'watermill-002', nodeId: 'repair_gate', status: 'active', startedAt: 4320, actorId: 'camp-autonomy' } }
    }).state,
    worldMeta: {
      events: [
        ...basePayload().worldMeta.events,
        event('content.chain.started', 3, { chainId: 'watermill-002', nodeId: 'repair_gate' }, 'cmd-000003')
      ],
      eventSeq: 3,
      lastEventId: 'evt-000003'
    }
  }), 'fixture-watermill-chain');
  return { valid, 'corrupt-checksum': corruptChecksum, 'active-event': activeEvent, 'night-unresolved': nightUnresolved, 'night-resolved': nightResolved, 'five-day-npc': fiveDayNpc, 'npc-dead-event': npcDeadEvent, 'outpost-garrison': outpostGarrison, 'watermill-chain': watermillChain };
}

export function writeFixtures(directory = FIXTURE_DIR) {
  fs.mkdirSync(directory, { recursive: true });
  for (const [name, envelope] of Object.entries(fixtureEnvelopes())) {
    fs.writeFileSync(path.join(directory, `${name}.json`), `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
  }
}

function validateEnvelope(envelope) {
  const issues = [];
  const isEnvelope = !!(envelope && envelope.payload && typeof envelope.checksum === 'string');
  const payload = isEnvelope ? envelope.payload : envelope;
  if (!payload || typeof payload !== 'object') issues.push('payload-missing');
  const expected = payload && typeof payload === 'object' ? checksum(payload) : null;
  const checksumValid = !isEnvelope || expected === envelope.checksum;
  if (isEnvelope && !checksumValid) issues.push('checksum-mismatch');
  const version = Number(payload?.version ?? envelope?.version ?? 0);
  if (!version) issues.push('version-missing');
  if (version > SAVE_VERSION) issues.push(`future-version:${version}`);
  const worldMeta = payload?.worldMeta || {};
  if (!Array.isArray(worldMeta.events)) issues.push('worldMeta.events-missing');
  if (!Array.isArray(worldMeta.replay?.commands)) issues.push('worldMeta.replay.commands-missing');
  const migration = migrateContentState(payload?.contentState);
  if (Number(payload?.contentState?.contentVersion || 1) > CONTENT_SCHEMA_VERSION) {
    issues.push(`future-content-schema:${payload.contentState.contentVersion}`);
  }
  const nightUnresolved = !!(payload?.night && payload?.nightBattle && !payload.nightBattle.resolved);
  const saveAllowed = !nightUnresolved;
  if (nightUnresolved) issues.push('night-battle-unresolved');
  return {
    accepted: issues.filter(issue => issue !== 'night-battle-unresolved').length === 0,
    checksumValid,
    expectedChecksum: expected,
    version,
    contentMigration: { fromVersion: migration.fromVersion, toVersion: CONTENT_SCHEMA_VERSION, migrated: migration.migrated },
    payload,
    issues,
    saveAllowed,
    nightUnresolved
  };
}

/**
 * Replay a command ledger into a small deterministic projection. Unknown
 * commands remain in the digest, so adding a new command cannot silently
 * produce the old hash. This is a contract/trace runner, not the browser
 * reducer; browser smoke still validates gameplay semantics.
 */
export function replayProjection(payload) {
  const wm = payload?.worldMeta || {};
  const replay = wm.replay || {};
  const commands = Array.isArray(replay.commands) ? replay.commands : [];
  const contentMigration = migrateContentState(payload?.contentState);
  const content = contentMigration.state;
  const plan = content.planMeeting || {};
  const projection = {
    seed: Number(replay.seed ?? wm.seed ?? WORLD_SEED),
    day: Number(payload?.day || 1),
    hour: Number(payload?.hour || 0),
    minute: Number(payload?.minute || 0),
    energy: Number(payload?.energy || 0),
    sanity: Number(payload?.sanity || 0),
    phase: payload?.night ? 'night' : 'day',
    threatResolved: payload?.nightBattle ? !!payload.nightBattle.resolved : null,
    // v81 content projection: these fields make plan decisions observable in
    // replay hashes without attempting to execute browser reducers in Node.
    contentVersion: content.contentVersion,
    contentMigratedFrom: contentMigration.migrated ? contentMigration.fromVersion : null,
    campTrust: Number(content.meters?.campTrust || 0),
    campCollapse: Number(content.meters?.campCollapse || 0),
    resonancePressure: Number(content.meters?.resonancePressure || 0),
    commandPoints: Number(content.commandPoints || 0),
    commandPointsMax: Number(content.commandPointsMax || 0),
    commandPointsGrantedDay: Number(content.commandPointsGrantedDay || 0),
    planStatus: plan.status || 'idle',
    planMeetingDay: Number(plan.meetingDay || 0),
    planSelected: plan.selectedId || null,
    planPlayerAction: plan.playerAction || null,
    promotedNpcIds: [...new Set(content.npcRoster?.promotedNpcIds || [])].sort(),
    promotionCount: Array.isArray(content.npcRoster?.promotionHistory) ? content.npcRoster.promotionHistory.length : 0,
    npcActiveCount: Array.isArray(payload?.npcs) ? payload.npcs.filter(npc => npc && npc.lifeState !== 'dead').length : 0,
    successorRoles: Object.fromEntries((Array.isArray(payload?.npcs) ? payload.npcs : []).filter(npc => npc?.actingRole).map(npc => [npc.actingRole, npc.id]).sort()),
    garrisonedNpcIds: (Array.isArray(payload?.npcs) ? payload.npcs : []).filter(npc => npc?.garrisonedOutpostId).map(npc => `${npc.garrisonedOutpostId}:${npc.id}`).sort(),
    outposts: Object.fromEntries(Object.entries(content.outposts || {}).map(([id, value]) => [id, { status: value?.status || 'secured', guardNpcIds: [...new Set(value?.guardNpcIds || [])].sort(), lastUpkeepDay: Number(value?.lastUpkeepDay || 0) }]).sort(([a], [b]) => a.localeCompare(b))),
    activeChainIds: Object.keys(content.activeChains || {}).sort(),
    completedChainIds: [...new Set(content.completedChains || [])].sort(),
    commandCount: 0,
    commandTypes: [],
    choices: [],
    advancedMinutes: 0,
    resourceDelta: {}
  };
  for (const item of commands) {
    if (!item || typeof item !== 'object') continue;
    projection.commandCount += 1;
    projection.commandTypes.push(String(item.type || 'unknown'));
    const commandPayload = item.payload && typeof item.payload === 'object' ? item.payload : {};
    if (item.type === 'world.advance') {
      const minutes = Math.max(0, Number(commandPayload.minutes) || 0);
      projection.advancedMinutes += minutes;
      const total = (projection.hour * 60) + projection.minute + minutes;
      projection.day += Math.floor(total / 1440);
      const withinDay = total % 1440;
      projection.hour = Math.floor(withinDay / 60);
      projection.minute = Math.floor(withinDay % 60);
    }
    if (/^(night|threat)\.(start|started)$/.test(item.type)) projection.phase = 'night';
    if (/^(night|threat)\.(resolve|resolved|closed)$/.test(item.type)) {
      projection.phase = 'day';
      projection.threatResolved = true;
    }
    if (item.type === 'event.resolve' || item.type === 'npc.event.resolve') projection.choices.push(commandPayload.choice ?? commandPayload.choiceId ?? null);
    if (/^plan\.meeting\.(commit|committed|resolve|resolved)$/.test(String(item.type || ''))) {
      if (commandPayload.status) projection.planStatus = String(commandPayload.status);
      if (commandPayload.selectedId || commandPayload.planId) projection.planSelected = commandPayload.selectedId || commandPayload.planId;
      if (commandPayload.playerAction || commandPayload.action) projection.planPlayerAction = commandPayload.playerAction || commandPayload.action;
      if (commandPayload.meetingDay != null) projection.planMeetingDay = Number(commandPayload.meetingDay) || projection.planMeetingDay;
      if (commandPayload.commandPoints != null) projection.commandPoints = Number(commandPayload.commandPoints) || 0;
    }
    const resource = commandPayload.resource || commandPayload.resourceId;
    const amount = Number(commandPayload.amount ?? commandPayload.quantity ?? 0);
    if (resource && Number.isFinite(amount)) projection.resourceDelta[resource] = (projection.resourceDelta[resource] || 0) + amount;
  }
  const events = Array.isArray(wm.events) ? wm.events.map(item => ({
    eventId: item.eventId || null,
    seq: Number(item.seq) || 0,
    type: item.type || null,
    commandId: item.commandId || null,
    causationId: item.causationId || null,
    payload: item.payload || null
  })).sort((left, right) => left.seq - right.seq) : [];
  for (const item of events) {
    if (item.type === 'npc.promotion.completed') {
      const eventPayload = item.payload && typeof item.payload === 'object' ? item.payload : {};
      if (eventPayload.npcId) projection.promotedNpcIds = [...new Set([...projection.promotedNpcIds, String(eventPayload.npcId)])].sort();
    }
    if (!/^plan\.meeting\.(committed|resolved|fallback)$/.test(String(item.type || ''))) continue;
    const eventPayload = item.payload && typeof item.payload === 'object' ? item.payload : {};
    if (eventPayload.status) projection.planStatus = String(eventPayload.status);
    if (eventPayload.selectedId || eventPayload.planId) projection.planSelected = eventPayload.selectedId || eventPayload.planId;
    if (eventPayload.playerAction || eventPayload.action) projection.planPlayerAction = eventPayload.playerAction || eventPayload.action;
    if (eventPayload.meetingDay != null) projection.planMeetingDay = Number(eventPayload.meetingDay) || projection.planMeetingDay;
    for (const key of ['campTrust', 'campCollapse', 'resonancePressure', 'commandPoints', 'commandPointsMax']) {
      if (eventPayload[key] != null) projection[key] = Number(eventPayload[key]) || 0;
    }
  }
  return {
    projection,
    events,
    hash: stableHash({ projection, events })
  };
}

export function inspectFile(file) {
  const absolute = path.resolve(file);
  const raw = fs.readFileSync(absolute, 'utf8');
  const parsed = JSON.parse(raw);
  const validation = validateEnvelope(parsed);
  const replay = replayProjection(validation.payload || {});
  return { file: absolute, ...validation, replay };
}

function fixturePaths() {
  if (!fs.existsSync(FIXTURE_DIR)) return [];
  return fs.readdirSync(FIXTURE_DIR).filter(file => file.endsWith('.json')).sort().map(file => path.join(FIXTURE_DIR, file));
}

function printReport(reports) {
  const rows = reports.map(report => ({
    fixture: path.basename(report.file, '.json'),
    accepted: report.accepted,
    checksumValid: report.checksumValid,
    saveAllowed: report.saveAllowed,
    nightUnresolved: report.nightUnresolved,
    activeEvent: report.payload?.eventInstance?.status === 'active',
    replayHash: report.replay.hash,
    issues: report.issues
  }));
  process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
}

export function selfTest() {
  writeFixtures();
  const reports = Object.fromEntries(fixturePaths().map(file => [path.basename(file, '.json'), inspectFile(file)]));
  assert.equal(reports.valid.accepted, true);
  assert.equal(reports.valid.checksumValid, true);
  assert.equal(reports['corrupt-checksum'].accepted, false);
  assert.equal(reports['corrupt-checksum'].checksumValid, false);
  assert.equal(reports['active-event'].accepted, true);
  assert.equal(reports['active-event'].payload.eventInstance.status, 'active');
  assert.equal(reports['night-unresolved'].accepted, true);
  assert.equal(reports['night-unresolved'].saveAllowed, false);
  assert.equal(reports['night-unresolved'].nightUnresolved, true);
  assert.equal(reports['night-resolved'].saveAllowed, true);
  assert.equal(reports['five-day-npc'].accepted, true);
  assert.deepEqual(reports['five-day-npc'].replay.projection.promotedNpcIds, ['carpenter']);
  assert.equal(reports['five-day-npc'].replay.projection.successorRoles.commander, 'sergeant');
  assert.equal(reports['npc-dead-event'].accepted, true);
  assert.equal(reports['npc-dead-event'].payload.eventInstance.status, 'active');
  assert.equal(reports['npc-dead-event'].payload.npcEvents.find(item => item.status === 'queued')?.npcId, 'doctor');
  assert.equal(reports['outpost-garrison'].accepted, true);
  assert.deepEqual(reports['outpost-garrison'].replay.projection.garrisonedNpcIds, ['watchPost:guardJi']);
  assert.equal(reports['outpost-garrison'].replay.projection.outposts.watchPost.status, 'secured');
  assert.equal(reports['outpost-garrison'].replay.projection.outposts.watchPost.lastUpkeepDay, 2);
  assert.equal(reports['watermill-chain'].accepted, true);
  assert.deepEqual(reports['watermill-chain'].replay.projection.activeChainIds, ['watermill-002']);
  const legacy = migrateContentState({ contentVersion: 1, meters: { campCollapse: 7, resonancePressure: 31 } });
  assert.equal(legacy.migrated, true);
  assert.equal(legacy.state.contentVersion, CONTENT_SCHEMA_VERSION);
  assert.equal(legacy.state.meters.campTrust, 0);
  assert.equal(legacy.state.planMeeting.status, 'idle');
  const migrationInput = { contentVersion: 1, outposts: { watchPost: { status: 'secured', guardNpcIds: ['guardJi'] } } };
  const migrationOutpost = migrateContentState(migrationInput);
  assert.notEqual(migrationOutpost.state.outposts, migrationInput.outposts);
  assert.notEqual(migrationOutpost.state.outposts.watchPost, migrationInput.outposts.watchPost);
  assert.deepEqual(migrationInput.outposts.watchPost.guardNpcIds, ['guardJi']);
  const replayA = replayProjection(reports.valid.payload).hash;
  const replayB = replayProjection(reports.valid.payload).hash;
  assert.equal(replayA, replayB);
  // Golden hash: changes require an explicit replay-contract review.
  assert.equal(replayA, '4aec7a31');
  return { fixtureCount: Object.keys(reports).length, replayHash: replayA };
}

function usage() {
  return [
    'Usage:',
    '  node scripts/replay-harness.mjs --write-fixtures',
    '  node scripts/replay-harness.mjs --verify [file ...]',
    '  node scripts/replay-harness.mjs --replay <file>',
    '  node scripts/replay-harness.mjs --self-test'
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    const wroteFixtures = args.includes('--write-fixtures');
    if (wroteFixtures) writeFixtures();
    if (args.includes('--self-test')) {
      process.stdout.write(`${JSON.stringify({ ok: true, ...selfTest() }, null, 2)}\n`);
    } else if (args.includes('--replay')) {
      const file = args[args.indexOf('--replay') + 1];
      if (!file) throw new Error('missing replay file');
      const report = inspectFile(file);
      const expectIndex = args.indexOf('--expect');
      const expectedHash = expectIndex >= 0 ? args[expectIndex + 1] : null;
      const hashMatches = !expectedHash || expectedHash === report.replay.hash;
      process.stdout.write(`${JSON.stringify({ file: report.file, accepted: report.accepted, replay: report.replay, expectedHash, hashMatches }, null, 2)}\n`);
      if (!report.checksumValid) process.exitCode = 2;
      if (!hashMatches) process.exitCode = 3;
    } else if (args.includes('--verify') || args.length === 0) {
      const index = args.indexOf('--verify');
      const files = index >= 0 && args.slice(index + 1).filter(item => !item.startsWith('--')).length
        ? args.slice(index + 1).filter(item => !item.startsWith('--'))
        : fixturePaths();
      if (!files.length) throw new Error('no fixture files found');
      const reports = files.map(inspectFile);
      printReport(reports);
      if (reports.some(report => !report.checksumValid || report.issues.includes('version-missing'))) process.exitCode = 2;
    } else if (!wroteFixtures) {
      process.stdout.write(`${usage()}\n`);
    }
  } catch (error) {
    process.stderr.write(`replay-harness: ${error.message}\n`);
    process.exitCode = 1;
  }
}
