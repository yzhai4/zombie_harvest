/**
 * Shadow RelayConstructionV1 contract.
 *
 * This module deliberately does not replace the browser runtime. It freezes the
 * transaction boundary that the current relay自治 reducer must eventually
 * adopt: four-part EventInstance CAS, explicit status transitions, command
 * idempotency, and all-or-nothing material/work updates. The production path
 * still runs handoffRelayCore + updateRelayProject in dist/index.html.
 */

export const RELAY_CONSTRUCTION_SCHEMA = 'RelayConstructionV1';
export const RELAY_CHAIN_ID = 'relay-chain-001';
export const RELAY_DEFINITION_VERSION = 1;
export const RELAY_STATUSES = Object.freeze([
  'unknown',
  'core-recovered',
  'briefed',
  'staging',
  'building',
  'online'
]);
export const RELAY_CONSTRUCTION_STATUSES = Object.freeze(['briefed', 'staging', 'building']);
export const RELAY_MATERIAL_KEYS = Object.freeze(['wood', 'parts', 'stone']);

const own = (value, key) => Object.prototype.hasOwnProperty.call(Object(value), key);
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const finite = value => Number.isFinite(Number(value));
const nonNegative = value => finite(value) && Number(value) >= 0;
const phaseFor = status => ({
  unknown: 'recover',
  'core-recovered': 'handoff',
  briefed: 'staging',
  staging: 'staging',
  building: 'building',
  online: 'online'
}[status] || null);

function failure(reason, details = {}, instance) {
  return {
    ok: false,
    reason,
    ...(Object.keys(details).length ? { details: clone(details) } : {}),
    ...(instance !== undefined ? { instance: clone(instance) } : {})
  };
}

function mapContract(raw, key, issues, { allowZero = true } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    issues.push(`${key}-invalid`);
    return Object.fromEntries(RELAY_MATERIAL_KEYS.map(name => [name, 0]));
  }
  const result = {};
  RELAY_MATERIAL_KEYS.forEach(name => {
    if (!own(raw, name) || !(allowZero ? nonNegative(raw[name]) : Number(raw[name]) > 0)) issues.push(`${key}.${name}-invalid`);
    result[name] = Math.max(0, Number(raw[name]) || 0);
  });
  return result;
}

/** Normalize the relay project into the serializable EventInstance shadow shape. */
export function normalizeRelayConstructionInstance(raw = {}, options = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const issues = [];
  const instanceId = source.instanceId || source.id;
  if (typeof instanceId !== 'string' || !instanceId) issues.push('instance-id-invalid');
  const defId = source.defId || RELAY_CHAIN_ID;
  if (defId !== RELAY_CHAIN_ID) issues.push('definition-id-invalid');
  const status = source.status;
  if (!RELAY_STATUSES.includes(status)) issues.push('status-invalid');
  const materialNeed = mapContract(source.materialNeed, 'material-need', issues, { allowZero: false });
  const materialProgress = mapContract(source.materialProgress, 'material-progress', issues);
  RELAY_MATERIAL_KEYS.forEach(key => {
    if (materialProgress[key] > materialNeed[key]) issues.push(`material-progress.${key}-exceeds-need`);
  });
  if (typeof source.buildingId !== 'string' || !source.buildingId) issues.push('building-id-missing');
  if (!Array.isArray(source.assignedNpcIds) || !source.assignedNpcIds.length || source.assignedNpcIds.some(id => typeof id !== 'string' || !id) || new Set(source.assignedNpcIds).size !== source.assignedNpcIds.length) issues.push('assigned-npc-contract-invalid');
  if (!nonNegative(source.workMinutes) || !nonNegative(source.targetMinutes) || Number(source.targetMinutes) < 1) issues.push('work-contract-invalid');
  if (!nonNegative(source.materialClock)) issues.push('material-clock-invalid');
  const latestEventId = options.latestEventId !== undefined ? options.latestEventId : (source.latestEventId ?? null);
  if (latestEventId !== null && (typeof latestEventId !== 'string' || !latestEventId)) issues.push('latest-event-invalid');
  const appliedCommandIds = source.appliedCommandIds === undefined ? [] : source.appliedCommandIds;
  if (!Array.isArray(appliedCommandIds) || appliedCommandIds.some(id => typeof id !== 'string' || !id) || new Set(appliedCommandIds).size !== appliedCommandIds.length) issues.push('applied-command-ledger-invalid');
  const history = source.history === undefined ? [] : source.history;
  if (!Array.isArray(history)) issues.push('history-invalid');
  if (issues.length) return failure('instance-contract', { issues });
  const instance = {
    schema: RELAY_CONSTRUCTION_SCHEMA,
    version: 1,
    instanceId,
    defId,
    definitionVersion: Number(source.definitionVersion) || RELAY_DEFINITION_VERSION,
    status,
    phase: phaseFor(status),
    coreItemId: source.coreItemId ?? null,
    handoffAt: source.handoffAt ?? null,
    materialNeed,
    materialProgress,
    materialClock: Number(source.materialClock) || 0,
    workMinutes: Number(source.workMinutes) || 0,
    targetMinutes: Number(source.targetMinutes),
    buildingId: source.buildingId,
    assignedNpcIds: [...source.assignedNpcIds],
    latestEventId,
    appliedCommandIds: [...appliedCommandIds].slice(-200),
    history: clone(history).slice(-100)
  };
  return { ok: true, instance };
}

export function constructionToken(instance) {
  return {
    expectedInstanceId: instance?.instanceId ?? null,
    expectedDefId: instance?.defId ?? RELAY_CHAIN_ID,
    expectedDefinitionVersion: Number(instance?.definitionVersion) || RELAY_DEFINITION_VERSION,
    expectedEventId: instance?.latestEventId ?? null
  };
}

function tokenReason(key) {
  return ({
    expectedInstanceId: 'event-instance-conflict',
    expectedDefId: 'event-definition-conflict',
    expectedDefinitionVersion: 'event-definition-version-conflict',
    expectedEventId: 'event-state-conflict'
  })[key];
}

function normalizeTokenValue(key, value) {
  return key === 'expectedDefinitionVersion' ? Number(value) : (value ?? null);
}

/** Validate a construction command before any material/work reducer runs. */
export function validateRelayConstructionCommand(command, context = {}) {
  const instance = context.instance;
  if (!instance || typeof instance !== 'object') return failure('instance-missing');
  if (!command || typeof command !== 'object' || Array.isArray(command)) return failure('command-contract', {}, instance);
  if (command.type !== 'relay.projectAdvance') return failure('command-type-invalid', { expected: 'relay.projectAdvance', actual: command.type }, instance);
  if (typeof command.commandId !== 'string' || !command.commandId.trim()) return failure('command-id-invalid', {}, instance);
  const payload = command.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return failure('command-payload-invalid', {}, instance);
  const token = constructionToken(instance);
  for (const key of Object.keys(token)) {
    const expected = normalizeTokenValue(key, token[key]);
    const actual = normalizeTokenValue(key, payload[key]);
    if (actual !== expected) return failure(tokenReason(key), { expected, actual });
  }
  if (payload.projectId !== undefined && payload.projectId !== instance.instanceId) return failure('event-instance-conflict', { expected: instance.instanceId, actual: payload.projectId }, instance);
  if (context.sessionFrozen === true) return failure('session-frozen', {}, instance);
  if (context.gameOver === true) return failure('game-over', {}, instance);
  if (context.night === true || context.sessionMode === 'BATTLE') return failure('night-lock', {}, instance);
  if (!RELAY_CONSTRUCTION_STATUSES.includes(instance.status)) return failure(instance.status === 'online' ? 'construction-complete' : 'construction-not-ready', { status: instance.status }, instance);
  const minutes = payload.minutes === undefined ? 0 : Number(payload.minutes);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) return failure('minutes-invalid', { minutes }, instance);
  if (context.activeParticipantIds !== undefined) {
    if (!Array.isArray(context.activeParticipantIds)) return failure('participant-context-invalid', {}, instance);
    const active = new Set(context.activeParticipantIds);
    const missing = instance.assignedNpcIds.filter(id => !active.has(id));
    if (missing.length) return failure('missing-role', { missing }, instance);
  }
  return { ok: true, token, minutes };
}

function validateDelta(delta, label) {
  if (delta === undefined) return { ok: true, value: Object.fromEntries(RELAY_MATERIAL_KEYS.map(key => [key, 0])) };
  if (!delta || typeof delta !== 'object' || Array.isArray(delta)) return failure(`${label}-invalid`);
  const value = {};
  for (const key of RELAY_MATERIAL_KEYS) {
    const amount = delta[key] === undefined ? 0 : Number(delta[key]);
    if (!Number.isFinite(amount) || amount < 0) return failure(`${label}-invalid`, { key, amount });
    value[key] = amount;
  }
  const extras = Object.keys(delta).filter(key => !RELAY_MATERIAL_KEYS.includes(key));
  if (extras.length) return failure(`${label}-invalid`, { extras });
  return { ok: true, value };
}

function checkInventory(debits, context) {
  if (context.inventory === undefined) return { ok: true };
  if (!context.inventory || typeof context.inventory !== 'object' || Array.isArray(context.inventory)) return failure('inventory-context-invalid');
  const insufficient = RELAY_MATERIAL_KEYS.filter(key => Number(debits[key] || 0) > Number(context.inventory[key] || 0));
  return insufficient.length ? failure('resource-insufficient', { insufficient }) : { ok: true };
}

function eventIdFor(commandId, eventIds, index) {
  const supplied = Array.isArray(eventIds) ? eventIds[index] : undefined;
  return supplied === undefined ? `relay-${commandId}-${index + 1}` : supplied;
}

/**
 * Apply one deterministic construction step. The input instance is never
 * mutated; invalid deltas, CAS or inventory return the original snapshot.
 */
export function applyRelayConstructionStep(rawInstance, command, outcome = {}, context = {}) {
  const normalized = normalizeRelayConstructionInstance(rawInstance);
  if (!normalized.ok) return normalized;
  const instance = normalized.instance;
  if (typeof command?.commandId === 'string' && instance.appliedCommandIds.includes(command.commandId)) {
    return { ok: true, duplicate: true, instance: clone(instance), events: [], receipt: { commandId: command.commandId, duplicate: true, token: constructionToken(instance) } };
  }
  const validation = validateRelayConstructionCommand(command, { ...context, instance });
  if (!validation.ok) return { ...validation, instance: clone(instance) };
  if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome)) return { ...failure('outcome-contract', {}, instance), instance: clone(instance) };
  const materialResult = validateDelta(outcome.materialDelta, 'material-delta');
  if (!materialResult.ok) return { ...materialResult, instance: clone(instance) };
  const workMinutes = outcome.workMinutes === undefined ? 0 : Number(outcome.workMinutes);
  if (!Number.isFinite(workMinutes) || workMinutes < 0) return { ...failure('work-delta-invalid', { workMinutes }, instance), instance: clone(instance) };
  const debitResult = validateDelta(outcome.resourceDebits, 'resource-debits');
  if (!debitResult.ok) return { ...debitResult, instance: clone(instance) };
  const inventoryResult = checkInventory(debitResult.value, context);
  if (!inventoryResult.ok) return { ...inventoryResult, instance: clone(instance) };
  if (instance.status === 'building' && RELAY_MATERIAL_KEYS.some(key => materialResult.value[key] > 0)) return { ...failure('material-phase-invalid', { status: instance.status }, instance), instance: clone(instance) };
  const eventIds = Array.isArray(outcome.eventIds) ? outcome.eventIds : [];
  if (eventIds.some(id => typeof id !== 'string' || !id) || new Set(eventIds).size !== eventIds.length) return { ...failure('event-id-contract-invalid', {}, instance), instance: clone(instance) };
  const next = clone(instance);
  const events = [];
  const statusBefore = next.status;
  let eventIndex = 0;
  const emit = (type, payload) => {
    const eventId = eventIdFor(command.commandId, eventIds, eventIndex++);
    if (events.some(event => event.eventId === eventId)) throw new Error('event-id-duplicate');
    const event = { eventId, type, commandId: command.commandId, instanceId: next.instanceId, defId: next.defId, definitionVersion: next.definitionVersion, payload: clone(payload) };
    events.push(event);
    next.latestEventId = eventId;
  };
  try {
    next.appliedCommandIds = [...next.appliedCommandIds, command.commandId].slice(-200);
    if (next.status === 'briefed') {
      next.status = 'staging';
      next.phase = phaseFor(next.status);
      emit('relay.constructionStarted', { projectId: next.instanceId, assignedNpcIds: [...next.assignedNpcIds], materialNeed: clone(next.materialNeed) });
    }
    if (next.status === 'staging') {
      RELAY_MATERIAL_KEYS.forEach(key => {
        const remaining = Math.max(0, next.materialNeed[key] - next.materialProgress[key]);
        next.materialProgress[key] = Math.min(next.materialNeed[key], next.materialProgress[key] + Math.min(remaining, materialResult.value[key]));
      });
      next.materialClock += Number(command.payload.minutes) || 0;
      const ready = RELAY_MATERIAL_KEYS.every(key => next.materialProgress[key] >= next.materialNeed[key]);
      if (ready) {
        next.status = 'building';
        next.phase = phaseFor(next.status);
        next.materialClock = 0;
        next.workMinutes = 0;
        emit('relay.materialsCommitted', { projectId: next.instanceId, materialProgress: clone(next.materialProgress), buildingId: next.buildingId });
      }
    }
    if (next.status === 'building') {
      next.workMinutes += workMinutes;
      if (next.workMinutes >= next.targetMinutes) {
        next.status = 'online';
        next.phase = phaseFor(next.status);
        next.workMinutes = next.targetMinutes;
        emit('relay.stationOnline', { projectId: next.instanceId, buildingId: next.buildingId, targetMinutes: next.targetMinutes });
      }
    }
    next.history = [...next.history, { commandId: command.commandId, statusBefore, statusAfter: next.status, eventIds: events.map(event => event.eventId) }].slice(-100);
  } catch (error) {
    return { ...failure('transition-failed', { message: String(error?.message || error) }, instance), instance: clone(instance) };
  }
  const receipt = { commandId: command.commandId, duplicate: false, statusBefore, statusAfter: next.status, tokenBefore: constructionToken(instance), tokenAfter: constructionToken(next), eventIds: events.map(event => event.eventId) };
  return { ok: true, duplicate: false, instance: next, events, receipt };
}

