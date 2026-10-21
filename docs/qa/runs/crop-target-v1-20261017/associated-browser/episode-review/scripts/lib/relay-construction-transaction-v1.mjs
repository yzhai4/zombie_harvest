/**
 * Pure RelayConstructionV1 transaction wrapper.
 *
 * This module is a shadow adapter only. It composes the existing
 * RelayConstructionV1 instance reducer with an atomic, serializable snapshot
 * for inventory, building occupancy, and assigned NPC participant patches.
 * It does not replace updateRelayProject or write browser state.
 */
import {
  RELAY_CONSTRUCTION_SCHEMA,
  RELAY_MATERIAL_KEYS,
  applyRelayConstructionStep,
  constructionToken,
  normalizeRelayConstructionInstance
} from './relay-construction-v1.mjs';

export const RELAY_TRANSACTION_SCHEMA = 'RelayConstructionTransactionV1';
export const RELAY_TRANSACTION_VERSION = 1;
export const RELAY_BUILDING_STATUSES = Object.freeze(['vacant', 'reserved', 'staging', 'building', 'online']);
export const RELAY_PARTICIPANT_PATCH_KEYS = Object.freeze([
  'scheduleState',
  'behaviorState',
  'lastReport',
  'workSegmentId',
  'workMinutes'
]);

const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const finite = value => Number.isFinite(Number(value));

function failure(reason, details = {}, snapshot) {
  return {
    ok: false,
    reason,
    ...(Object.keys(details).length ? { details: clone(details) } : {}),
    ...(snapshot !== undefined ? { snapshot: clone(snapshot) } : {})
  };
}

function materialMap(raw, label, { allowMissing = false } = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  if (!source) return failure(label + '-invalid');
  const value = {};
  const invalid = [];
  for (const key of RELAY_MATERIAL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      if (allowMissing) {
        value[key] = 0;
        continue;
      }
      invalid.push(key);
      continue;
    }
    const amount = Number(source[key]);
    if (!Number.isFinite(amount) || amount < 0) invalid.push(key);
    value[key] = Number.isFinite(amount) && amount >= 0 ? amount : 0;
  }
  const extras = Object.keys(source).filter(key => !RELAY_MATERIAL_KEYS.includes(key));
  if (extras.length) invalid.push(...extras.map(key => 'extra:' + key));
  if (invalid.length) return failure(label + '-invalid', { invalid });
  return { ok: true, value };
}

function normalizeBuilding(raw, instance) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return failure('building-snapshot-invalid');
  const id = raw.id;
  if (typeof id !== 'string' || !id) return failure('building-id-invalid');
  if (id !== instance.buildingId) return failure('building-id-conflict', { expected: instance.buildingId, actual: id });
  const status = raw.status === undefined ? 'vacant' : raw.status;
  if (!RELAY_BUILDING_STATUSES.includes(status)) return failure('building-status-invalid', { status });
  const occupiedBy = raw.occupiedBy === undefined || raw.occupiedBy === null ? null : raw.occupiedBy;
  if (occupiedBy !== null && (typeof occupiedBy !== 'string' || !occupiedBy)) return failure('building-occupancy-invalid');
  return {
    ok: true,
    value: { ...clone(raw), id, status, occupiedBy }
  };
}

function normalizeParticipants(raw, assignedNpcIds) {
  if (!Array.isArray(raw)) return failure('participant-snapshot-invalid');
  const seen = new Set();
  const value = [];
  for (const participant of raw) {
    if (!participant || typeof participant !== 'object' || Array.isArray(participant)) return failure('participant-snapshot-invalid');
    const id = participant.id;
    if (typeof id !== 'string' || !id || seen.has(id)) return failure('participant-snapshot-invalid', { id });
    seen.add(id);
    value.push({
      ...clone(participant),
      id,
      alive: participant.alive !== false,
      active: participant.active !== false
    });
  }
  const missing = assignedNpcIds.filter(id => !seen.has(id));
  if (missing.length) return failure('participant-snapshot-missing', { missing });
  return { ok: true, value };
}

function normalizeParticipantPatch(raw, assignedNpcIds) {
  if (raw === undefined) return { ok: true, value: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return failure('participant-patch-invalid');
  const value = {};
  for (const [id, patch] of Object.entries(raw)) {
    if (!assignedNpcIds.includes(id)) return failure('participant-patch-target-invalid', { id });
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return failure('participant-patch-invalid', { id });
    const keys = Object.keys(patch);
    const extras = keys.filter(key => !RELAY_PARTICIPANT_PATCH_KEYS.includes(key));
    if (extras.length) return failure('participant-patch-key-invalid', { id, extras });
    const normalized = {};
    for (const key of keys) {
      const rawValue = patch[key];
      if (key === 'workMinutes') {
        if (!finite(rawValue) || Number(rawValue) < 0) return failure('participant-patch-value-invalid', { id, key });
        normalized[key] = Number(rawValue);
      } else if (typeof rawValue !== 'string' || !rawValue.trim()) {
        return failure('participant-patch-value-invalid', { id, key });
      } else {
        normalized[key] = rawValue;
      }
    }
    value[id] = normalized;
  }
  return { ok: true, value };
}

function patchParticipants(participants, patch) {
  return participants.map(participant => patch[participant.id]
    ? { ...clone(participant), ...clone(patch[participant.id]) }
    : clone(participant));
}

function activeParticipantIds(participants) {
  return participants.filter(item => item.alive !== false && item.active !== false).map(item => item.id);
}

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

function snapshotsEqual(left, right) {
  return stable(left) === stable(right);
}

function buildingTransition(before, after, snapshot) {
  const building = clone(snapshot.building);
  if (building.occupiedBy !== null && building.occupiedBy !== before.instanceId) {
    return failure('building-occupied', { occupiedBy: building.occupiedBy, projectId: before.instanceId }, snapshot);
  }
  const activeStatuses = new Set(['staging', 'building', 'online']);
  if (activeStatuses.has(after.status)) {
    building.occupiedBy = after.instanceId;
    building.status = after.status;
  }
  return { ok: true, value: building };
}

function validateMaterialDebitParity(materialDelta, resourceDebits, snapshot) {
  const mismatches = RELAY_MATERIAL_KEYS.filter(key => Number(materialDelta[key] || 0) !== Number(resourceDebits[key] || 0));
  return mismatches.length
    ? failure('material-resource-mismatch', { mismatches, materialDelta: clone(materialDelta), resourceDebits: clone(resourceDebits) }, snapshot)
    : { ok: true };
}

function transactionIdFor(command) {
  return 'relay-tx-' + command.commandId;
}

function provenanceFor(snapshot, command, resourceSource, transactionId) {
  return {
    transactionId,
    schema: RELAY_TRANSACTION_SCHEMA,
    sourceSchema: RELAY_CONSTRUCTION_SCHEMA,
    commandId: command.commandId,
    instanceId: snapshot.instance.instanceId,
    defId: snapshot.instance.defId,
    definitionVersion: snapshot.instance.definitionVersion,
    buildingId: snapshot.instance.buildingId,
    participantIds: [...snapshot.instance.assignedNpcIds],
    resourceSource: resourceSource ?? null
  };
}

/**
 * Normalize the complete cross-object snapshot used by the shadow transaction.
 */
export function normalizeRelayConstructionTransactionSnapshot(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const instanceResult = normalizeRelayConstructionInstance(source.instance || source.relayProject || source);
  if (!instanceResult.ok) return instanceResult;
  const inventoryResult = materialMap(source.inventory, 'inventory');
  if (!inventoryResult.ok) return inventoryResult;
  const buildingResult = normalizeBuilding(source.building, instanceResult.instance);
  if (!buildingResult.ok) return buildingResult;
  const participantsResult = normalizeParticipants(source.participants, instanceResult.instance.assignedNpcIds);
  if (!participantsResult.ok) return participantsResult;
  return {
    ok: true,
    snapshot: {
      schema: RELAY_TRANSACTION_SCHEMA,
      version: RELAY_TRANSACTION_VERSION,
      instance: instanceResult.instance,
      inventory: inventoryResult.value,
      building: buildingResult.value,
      participants: participantsResult.value
    }
  };
}

function noOpPrepared(snapshot, command) {
  const transactionId = transactionIdFor(command);
  const provenance = provenanceFor(snapshot, command, null, transactionId);
  return {
    ok: true,
    prepared: true,
    duplicate: true,
    schema: RELAY_TRANSACTION_SCHEMA,
    version: RELAY_TRANSACTION_VERSION,
    transactionId,
    snapshot: clone(snapshot),
    command: clone(command),
    outcome: {},
    preview: {
      ok: true,
      duplicate: true,
      instance: clone(snapshot.instance),
      events: [],
      receipt: {
        commandId: command.commandId,
        duplicate: true,
        token: constructionToken(snapshot.instance)
      }
    },
    reservation: {
      inventoryBefore: clone(snapshot.inventory),
      inventoryAfter: clone(snapshot.inventory),
      buildingBefore: clone(snapshot.building),
      buildingAfter: clone(snapshot.building),
      participantsBefore: clone(snapshot.participants),
      participantsAfter: clone(snapshot.participants)
    },
    provenance
  };
}

/**
 * Validate and reserve a pure transaction. No input object is mutated.
 */
export function prepareRelayConstructionTransaction(rawSnapshot, command, outcome = {}, context = {}) {
  const normalized = normalizeRelayConstructionTransactionSnapshot(rawSnapshot);
  if (!normalized.ok) return normalized;
  const snapshot = normalized.snapshot;
  if (typeof command?.commandId === 'string' && snapshot.instance.appliedCommandIds.includes(command.commandId)) {
    return noOpPrepared(snapshot, command);
  }
  const materialResult = materialMap(outcome?.materialDelta || { wood: 0, parts: 0, stone: 0 }, 'material-delta');
  if (!materialResult.ok) return { ...materialResult, snapshot: clone(snapshot) };
  const debitResult = materialMap(outcome?.resourceDebits || { wood: 0, parts: 0, stone: 0 }, 'resource-debits');
  if (!debitResult.ok) return { ...debitResult, snapshot: clone(snapshot) };
  const parity = validateMaterialDebitParity(materialResult.value, debitResult.value, snapshot);
  if (!parity.ok) return parity;
  const participantPatchResult = normalizeParticipantPatch(outcome?.participantPatch, snapshot.instance.assignedNpcIds);
  if (!participantPatchResult.ok) return { ...participantPatchResult, snapshot: clone(snapshot) };
  const activeIds = activeParticipantIds(snapshot.participants);
  const unavailable = snapshot.instance.assignedNpcIds.filter(id => !activeIds.includes(id));
  if (unavailable.length) return failure('participant-unavailable', { missing: unavailable }, snapshot);
  const buildingCheck = buildingTransition(snapshot.instance, snapshot.instance, snapshot);
  if (!buildingCheck.ok) return buildingCheck;
  const coreContext = {
    ...clone(context),
    inventory: clone(snapshot.inventory),
    activeParticipantIds: activeIds
  };
  const preview = applyRelayConstructionStep(snapshot.instance, command, outcome, coreContext);
  if (!preview.ok) return { ...preview, snapshot: clone(snapshot) };
  const buildingResult = buildingTransition(snapshot.instance, preview.instance, snapshot);
  if (!buildingResult.ok) return buildingResult;
  const inventoryAfter = clone(snapshot.inventory);
  RELAY_MATERIAL_KEYS.forEach(key => {
    inventoryAfter[key] = Math.max(0, inventoryAfter[key] - debitResult.value[key]);
  });
  const participantsAfter = patchParticipants(snapshot.participants, participantPatchResult.value);
  const transactionId = transactionIdFor(command);
  const resourceSource = preview.receipt?.resourceSource ?? null;
  return {
    ok: true,
    prepared: true,
    duplicate: false,
    schema: RELAY_TRANSACTION_SCHEMA,
    version: RELAY_TRANSACTION_VERSION,
    transactionId,
    snapshot: clone(snapshot),
    command: clone(command),
    outcome: clone(outcome),
    context: clone(context),
    preview: clone(preview),
    reservation: {
      inventoryBefore: clone(snapshot.inventory),
      inventoryAfter,
      buildingBefore: clone(snapshot.building),
      buildingAfter: buildingResult.value,
      participantsBefore: clone(snapshot.participants),
      participantsAfter
    },
    provenance: provenanceFor(snapshot, command, resourceSource, transactionId)
  };
}

/**
 * Commit a previously prepared transaction against the same snapshot.
 */
export function applyRelayConstructionTransaction(prepared, currentSnapshot = undefined) {
  if (!prepared || prepared.ok !== true || prepared.prepared !== true) {
    return failure('transaction-not-prepared');
  }
  const expected = prepared.snapshot;
  const currentResult = normalizeRelayConstructionTransactionSnapshot(currentSnapshot === undefined ? expected : currentSnapshot);
  if (!currentResult.ok) return currentResult;
  const current = currentResult.snapshot;
  if (!snapshotsEqual(current, expected)) {
    return failure('transaction-conflict', { transactionId: prepared.transactionId }, current);
  }
  const reservation = prepared.reservation;
  const nextSnapshot = {
    schema: RELAY_TRANSACTION_SCHEMA,
    version: RELAY_TRANSACTION_VERSION,
    instance: clone(prepared.preview.instance),
    inventory: clone(reservation.inventoryAfter),
    building: clone(reservation.buildingAfter),
    participants: clone(reservation.participantsAfter)
  };
  const provenance = clone(prepared.provenance);
  const events = (prepared.preview.events || []).map(event => ({
    ...clone(event),
    transactionId: prepared.transactionId,
    provenance
  }));
  const receipt = {
    schema: RELAY_TRANSACTION_SCHEMA,
    version: RELAY_TRANSACTION_VERSION,
    transactionId: prepared.transactionId,
    commandId: prepared.command.commandId,
    duplicate: !!prepared.duplicate,
    statusBefore: expected.instance.status,
    statusAfter: nextSnapshot.instance.status,
    tokenBefore: constructionToken(expected.instance),
    tokenAfter: constructionToken(nextSnapshot.instance),
    eventIds: events.map(event => event.eventId),
    resourceSource: provenance.resourceSource,
    inventoryBefore: clone(expected.inventory),
    inventoryAfter: clone(nextSnapshot.inventory),
    buildingBefore: clone(expected.building),
    buildingAfter: clone(nextSnapshot.building),
    participantIds: [...expected.instance.assignedNpcIds],
    participantsBefore: clone(expected.participants),
    participantsAfter: clone(nextSnapshot.participants),
    provenance
  };
  return {
    ok: true,
    prepared: true,
    duplicate: !!prepared.duplicate,
    transactionId: prepared.transactionId,
    snapshot: nextSnapshot,
    events,
    receipt,
    rollbackSnapshot: clone(expected)
  };
}

/**
 * Return the original snapshot as a pure rollback result.
 */
export function rollbackRelayConstructionTransaction(result) {
  if (!result || result.ok !== true || !result.rollbackSnapshot) return failure('rollback-unavailable');
  return {
    ok: true,
    rolledBack: true,
    transactionId: result.transactionId,
    snapshot: clone(result.rollbackSnapshot),
    receipt: {
      type: 'relay.transactionRollback',
      transactionId: result.transactionId,
      commandId: result.receipt?.commandId ?? null,
      eventIds: [],
      provenance: clone(result.receipt?.provenance || null)
    }
  };
}
