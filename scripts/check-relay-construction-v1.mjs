#!/usr/bin/env node

/**
 * Contract checks for the shadow RelayConstructionV1 adapter. These checks are
 * intentionally source-independent: they protect the proposed transaction
 * boundary while the browser's updateRelayProject path remains unchanged.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  RELAY_CONSTRUCTION_SCHEMA,
  RELAY_CHAIN_ID,
  applyRelayConstructionStep,
  constructionToken,
  normalizeRelayConstructionInstance
} from './lib/relay-construction-v1.mjs';

const fixture = JSON.parse(readFileSync(path.resolve('scripts/fixtures/relay-construction-v1.json'), 'utf8'));
assert.equal(fixture.schema, RELAY_CONSTRUCTION_SCHEMA);

const clone = value => JSON.parse(JSON.stringify(value));
function merge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch === undefined ? clone(base) : clone(patch);
  const result = clone(base);
  Object.entries(patch).forEach(([key, value]) => {
    result[key] = value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])
      ? merge(result[key], value) : clone(value);
  });
  return result;
}

const baseline = normalizeRelayConstructionInstance(fixture.base);
assert.equal(baseline.ok, true, JSON.stringify(baseline));
assert.equal(baseline.instance.defId, RELAY_CHAIN_ID);
assert.equal(baseline.instance.phase, 'staging');
assert.deepEqual(constructionToken(baseline.instance), {
  expectedInstanceId: 'camp-relay-001',
  expectedDefId: RELAY_CHAIN_ID,
  expectedDefinitionVersion: 1,
  expectedEventId: null
});

const defaultContext = {
  activeParticipantIds: ['radio', 'carpenter', 'quartermaster'],
  inventory: { wood: 20, parts: 20, stone: 20 }
};
function defaultCommand(instance, index) {
  const token = constructionToken(instance);
  return {
    type: 'relay.projectAdvance',
    commandId: `cmd-relay-default-${index}`,
    actorId: 'camp-autonomy',
    payload: { projectId: instance.instanceId, minutes: 30, ...token }
  };
}

const checks = [];
function check(name, fn) {
  try { fn(); checks.push({ name, ok: true }); }
  catch (error) { checks.push({ name, ok: false, error: String(error?.message || error) }); }
}

fixture.cases.forEach((item, index) => {
  check(item.name, () => {
    const raw = merge(fixture.base, item.state || {});
    const normalized = normalizeRelayConstructionInstance(raw);
    assert.equal(normalized.ok, true, `${item.name}: invalid state ${JSON.stringify(normalized)}`);
    const before = clone(normalized.instance);
    const command = item.command ? clone(item.command) : defaultCommand(normalized.instance, index);
    const patchedCommand = merge(command, item.commandPatch || {});
    const outcome = merge({}, merge(item.outcome || {}, item.outcomePatch || {}));
    const context = merge(defaultContext, item.contextPatch || item.context || {});
    const result = applyRelayConstructionStep(raw, patchedCommand, outcome, context);
    const expected = item.expected || {};
    assert.equal(result.ok, expected.ok, `${item.name}: ok`);
    if (!expected.ok) {
      assert.equal(result.reason, expected.reason, `${item.name}: reason`);
      assert.deepEqual(result.instance, before, `${item.name}: rejection must not mutate state`);
      return;
    }
    if (expected.duplicate !== undefined) assert.equal(result.duplicate, expected.duplicate, `${item.name}: duplicate`);
    if (expected.unchanged) assert.deepEqual(result.instance, before, `${item.name}: expected unchanged`);
    if (expected.status !== undefined) assert.equal(result.instance.status, expected.status, `${item.name}: status`);
    if (expected.latestEventId !== undefined) assert.equal(result.instance.latestEventId, expected.latestEventId, `${item.name}: latest event`);
    if (expected.workMinutes !== undefined) assert.equal(result.instance.workMinutes, expected.workMinutes, `${item.name}: work`);
    if (expected.materialProgress) assert.deepEqual(result.instance.materialProgress, expected.materialProgress, `${item.name}: materials`);
    if (expected.eventTypes) assert.deepEqual(result.events.map(event => event.type), expected.eventTypes, `${item.name}: events`);
    if (expected.duplicate) assert.deepEqual(result.events, [], `${item.name}: duplicate events`);
    if (expected.reloadTokenSame) {
      const reloaded = normalizeRelayConstructionInstance(JSON.parse(JSON.stringify(result.instance)));
      assert.equal(reloaded.ok, true);
      assert.deepEqual(constructionToken(reloaded.instance), result.receipt.tokenAfter, `${item.name}: reload token`);
    }
    assert.ok(result.instance.appliedCommandIds.includes(patchedCommand.commandId), `${item.name}: command ledger`);
  });
});

const output = {
  runner: 'relay-construction-v1-contract',
  ok: checks.every(item => item.ok),
  count: checks.length,
  passed: checks.filter(item => item.ok).length,
  checks
};
console.log(JSON.stringify(output, null, 2));
process.exitCode = output.ok ? 0 : 1;

