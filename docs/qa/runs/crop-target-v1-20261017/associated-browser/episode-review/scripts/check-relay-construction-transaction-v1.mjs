#!/usr/bin/env node

/**
 * Contract checks for the pure RelayConstructionV1 transaction wrapper.
 * The browser runtime remains untouched; these fixtures exercise only
 * serializable prepare/apply/rollback values.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  applyRelayConstructionTransaction,
  normalizeRelayConstructionTransactionSnapshot,
  prepareRelayConstructionTransaction,
  rollbackRelayConstructionTransaction,
  RELAY_TRANSACTION_SCHEMA
} from './lib/relay-construction-transaction-v1.mjs';
import { constructionToken } from './lib/relay-construction-v1.mjs';

const fixture = JSON.parse(readFileSync(path.resolve('scripts/fixtures/relay-construction-transaction-v1.json'), 'utf8'));
assert.equal(fixture.schema, RELAY_TRANSACTION_SCHEMA);

const clone = value => JSON.parse(JSON.stringify(value));
function merge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch === undefined ? clone(base) : clone(patch);
  const result = clone(base);
  for (const [key, value] of Object.entries(patch)) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])
      ? merge(result[key], value)
      : clone(value);
  }
  return result;
}
function commandFor(snapshot, index) {
  const token = constructionToken(snapshot.instance);
  return {
    type: 'relay.projectAdvance',
    commandId: 'cmd-tx-default-' + index,
    actorId: 'camp-autonomy',
    payload: { projectId: snapshot.instance.instanceId, minutes: 30, ...token }
  };
}

const checks = [];
function check(name, run) {
  try {
    run();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: String(error?.message || error) });
  }
}

fixture.cases.forEach((item, index) => {
  check(item.name, () => {
    const raw = merge(fixture.base, item.snapshotPatch || {});
    const normalized = normalizeRelayConstructionTransactionSnapshot(raw);
    assert.equal(normalized.ok, true, item.name + ': invalid snapshot ' + JSON.stringify(normalized));
    const before = clone(normalized.snapshot);
    const rawBefore = clone(raw);
    const command = item.command ? clone(item.command) : commandFor(normalized.snapshot, index);
    const outcome = clone(item.outcome || {});
    const expected = item.expected || {};
    const prepared = prepareRelayConstructionTransaction(raw, command, outcome, item.context || {});
    assert.equal(prepared.ok, expected.prepareOk === undefined ? true : expected.prepareOk, item.name + ': prepare ok');
    if (expected.prepareOk === false) {
      assert.equal(prepared.reason, expected.reason, item.name + ': prepare reason');
      assert.deepEqual(prepared.snapshot, before, item.name + ': failed prepare snapshot');
      return;
    }
    assert.deepEqual(prepared.snapshot, before, item.name + ': prepare must not mutate');
    assert.deepEqual(raw, rawBefore, item.name + ': raw input mutated during prepare');
    const currentRaw = item.currentPatch ? merge(raw, item.currentPatch) : raw;
    const applied = applyRelayConstructionTransaction(prepared, currentRaw);
    assert.equal(applied.ok, expected.applyOk === undefined ? true : expected.applyOk, item.name + ': apply ok');
    if (expected.applyOk === false) {
      const current = normalizeRelayConstructionTransactionSnapshot(currentRaw);
      assert.equal(applied.reason, expected.reason, item.name + ': apply reason');
      assert.deepEqual(applied.snapshot, current.snapshot, item.name + ': failed apply snapshot');
      return;
    }
    assert.equal(applied.snapshot.instance.status, expected.status, item.name + ': status');
    assert.deepEqual(applied.snapshot.inventory, expected.inventory || before.inventory, item.name + ': inventory');
    if (expected.buildingStatus !== undefined) assert.equal(applied.snapshot.building.status, expected.buildingStatus, item.name + ': building status');
    if (expected.buildingOccupiedBy !== undefined) assert.equal(applied.snapshot.building.occupiedBy, expected.buildingOccupiedBy, item.name + ': occupancy');
    if (expected.participantSchedule !== undefined) {
      assert.ok(applied.snapshot.participants.every(participant => participant.scheduleState === expected.participantSchedule), item.name + ': participant patch');
    }
    assert.deepEqual(applied.events.map(event => event.type), expected.eventTypes || [], item.name + ': event types');
    assert.equal(applied.receipt.resourceSource, expected.resourceSource === undefined ? null : expected.resourceSource, item.name + ': source');
    assert.equal(applied.receipt.duplicate, expected.duplicate === true, item.name + ': duplicate receipt');
    assert.equal(applied.events.every(event => event.provenance.transactionId === applied.transactionId), true, item.name + ': provenance transaction');
    assert.equal(applied.events.every(event => event.provenance.commandId === command.commandId), true, item.name + ': provenance command');
    if (expected.stationOnlineCount !== undefined) {
      assert.equal(applied.events.filter(event => event.type === 'relay.stationOnline').length, expected.stationOnlineCount, item.name + ': stationOnline count');
    }
    if (expected.rollback) {
      const rolledBack = rollbackRelayConstructionTransaction(applied);
      assert.equal(rolledBack.ok, true, item.name + ': rollback');
      assert.deepEqual(rolledBack.snapshot, before, item.name + ': rollback snapshot');
      assert.equal(rolledBack.rolledBack, true, item.name + ': rollback marker');
    }
  });
});

const output = {
  runner: 'relay-construction-transaction-v1-contract',
  schema: RELAY_TRANSACTION_SCHEMA,
  ok: checks.every(item => item.ok),
  count: checks.length,
  passed: checks.filter(item => item.ok).length,
  checks
};
console.log(JSON.stringify(output, null, 2));
process.exitCode = output.ok ? 0 : 1;
