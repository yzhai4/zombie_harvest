#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'leader-harness');
const read = name => JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const canonical = value => Array.isArray(value)
  ? '[' + value.map(canonical).join(',') + ']'
  : value && typeof value === 'object'
    ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
    : JSON.stringify(value);
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
const fixture = read('replay-scenario.json');
const projection = read('projection-v1.json');
const intent = read('intent-envelope-v1.json');
const world = read('world-baseline.json');
const projectionHash = hash(Object.fromEntries(Object.entries(projection).filter(([key]) => key !== 'sourceProjectionHash')));
assert.equal(fixture.schema, 'LeaderHarnessReplayFixtureV1');
assert.equal(fixture.acceptedAction, intent.action);
function baseline() {
  const value = clone(intent);
  value.sourceProjectionHash = projectionHash;
  return value;
}
function fallback() {
  const value = baseline();
  value.intentId += ':fallback';
  value.action = fixture.modelUnavailableFallback;
  value.target = { kind: 'plan', id: 'none' };
  value.resourceBudget = { commandPoints: 0 };
  value.model = { kind: 'rules-fallback', provider: 'local', latencyMs: 0, attempt: 0 };
  return value;
}
function validate(value) {
  assert.equal(value.schema, 'IntentEnvelopeV1');
  assert.equal(typeof value.intentId, 'string');
  assert.equal(typeof value.sourceProjectionHash, 'string');
  for (const key of ['gameStatePatch', 'eval', 'script']) assert.equal(Object.hasOwn(value, key), false);
}
function execute(candidate, ledger = [], sourceWorld = world) {
  const state = clone(sourceWorld);
  const events = clone(ledger);
  validate(candidate);
  const seen = new Set(events.filter(event => event.type === 'leader.intent.accepted').map(event => event.intentId));
  if (seen.has(candidate.intentId)) return { state, events, receipt: { status: 'duplicate', intentId: candidate.intentId } };
  const accepted = candidate.sourceProjectionHash === projectionHash
    && candidate.action === fixture.acceptedAction
    && candidate.target?.kind === 'plan'
    && state.planMeeting.candidateIds.includes(candidate.target.id)
    && state.actor.active && !state.actor.dead && state.actor.presence === 'camp'
    && state.phase === 'DAY' && state.commandPoints >= fixture.acceptedCost.commandPoints
    && state.registeredCommands.includes('plan.meeting.commit');
  if (!accepted) {
    const fb = fallback();
    events.push({ type: 'leader.intent.rejected', status: 'rejected', intentId: candidate.intentId, reasonCode: 'intent-unsupported', fallbackIntentId: fb.intentId });
    return { state, events, receipt: { status: 'rejected', fallbackIntentId: fb.intentId } };
  }
  state.commandPoints -= fixture.acceptedCost.commandPoints;
  state.planMeeting.status = 'committed';
  events.push({ type: 'leader.intent.accepted', status: 'accepted', intentId: candidate.intentId, commandId: 'leader-command:' + candidate.intentId, cost: fixture.acceptedCost, targetId: candidate.target.id });
  return { state, events, receipt: { status: 'accepted', intentId: candidate.intentId } };
}
const checks = [];
const test = (name, fn) => { try { fn(); checks.push({ name, ok: true }); } catch (error) { checks.push({ name, ok: false, error: String(error.message || error) }); } };
const candidate = baseline();
test('valid intent mutates only the registered sandbox state', () => {
  const result = execute(candidate);
  assert.equal(result.receipt.status, 'accepted');
  assert.equal(result.state.commandPoints, world.commandPoints - 1);
  assert.equal(result.state.planMeeting.status, 'committed');
  assert.equal(result.events.length, 1);
});
test('duplicate intent is idempotent', () => {
  const first = execute(candidate);
  const second = execute(candidate, first.events, first.state);
  assert.equal(second.receipt.status, 'duplicate');
  assert.deepEqual(second.state, first.state);
  assert.deepEqual(second.events, first.events);
});
test('same input produces the same replay hash', () => {
  const a = execute(candidate);
  const b = execute(candidate);
  assert.equal(hash({ state: a.state, events: a.events }), hash({ state: b.state, events: b.events }));
});
test('model unavailable falls back to abstain without a cost', () => {
  const unavailable = { ...candidate, action: 'unsupported-model-output', model: { kind: 'llm', provider: 'offline-test', latencyMs: 50, attempt: 1 } };
  const result = execute(unavailable);
  assert.equal(result.receipt.status, 'rejected');
  assert.deepEqual(result.state, world);
  const fb = fallback();
  assert.equal(fb.action, 'abstain');
  assert.equal(fb.resourceBudget.commandPoints, 0);
});
test('forbidden fields are rejected before execution', () => {
  const invalid = { ...candidate, gameStatePatch: { commandPoints: 99 }, eval: 'eval()', script: 'eval()' };
  assert.throws(() => validate(invalid));
});
const result = { runner: 'offline-leader-harness-replay-contract', productionWiring: false, ok: checks.every(item => item.ok), count: checks.length, passed: checks.filter(item => item.ok).length, replayHash: hash(execute(candidate)), checks };
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.ok ? 0 : 1;
