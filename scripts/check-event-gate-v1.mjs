#!/usr/bin/env node
/** Validate the pure EventGateV1 evaluator and its fail-closed fixtures. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateGateV1, evaluateGateV1Object, evaluateGateV1String, normalizeEventGate, resolveGateV1Path } from './lib/event-gate-v1.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(path.join(root, 'docs', 'schemas', 'event-gate-v1.json'), 'utf8'));
const fixtures = JSON.parse(readFileSync(path.join(root, 'scripts', 'fixtures', 'event-gate-v1.json'), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const checks = [];
function check(name, run) { try { run(); checks.push({ name, ok: true }); } catch (error) { checks.push({ name, ok: false, error: String(error.message || error) }); } }
function project(result) {
  return Object.fromEntries(['ok', 'reason', 'gateVersion', 'phase', 'checked'].filter(key => Object.prototype.hasOwnProperty.call(result, key)).map(key => [key, result[key]]));
}
function runFixture(item) {
  const state = { ...clone(fixtures.state), ...(item.statePatch || {}) };
  const before = clone(state);
  const context = { state, ...(item.context || {}) };
  const result = evaluateGateV1(item.gate, context);
  assert.deepEqual(project(result), item.expected, item.name);
  assert.deepEqual(state, before, `${item.name}: evaluator must be read-only`);
}

check('schema declares the immutable GateV1 envelope', () => {
  assert.equal(schema.$id, 'zombie-harvest://schemas/event-gate-v1.json');
  assert.deepEqual(schema.required, ['version', 'phase', 'nightAllowed', 'preconditions']);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.version.const, 1);
});
check('fixtures cover positive and negative paths', () => {
  assert.ok(fixtures.cases.some(item => item.expected.ok));
  assert.ok(fixtures.cases.some(item => item.expected.ok === false));
  fixtures.cases.forEach(runFixture);
});
check('normalization preserves inline migration defaults without mutation', () => {
  const raw = { phase: null, preconditions: { type: 'flag', id: 'x' }, version: '1', nightAllowed: 1 };
  const result = normalizeEventGate(raw);
  assert.deepEqual(result, { version: 1, phase: 'DAY', nightAllowed: false, preconditions: [{ type: 'flag', id: 'x' }] });
  assert.deepEqual(raw, { phase: null, preconditions: { type: 'flag', id: 'x' }, version: '1', nightAllowed: 1 });
});
check('actor substitution and NPC path semantics match inline behavior', () => {
  const state = clone(fixtures.state);
  const context = { state, event: { npcEvent: { npcId: 'carpenter' } } };
  assert.deepEqual(resolveGateV1Path('state.npc.needs.stress', context), { ok: true, exists: true, value: 12, path: 'npc.needs.stress', actorId: 'carpenter' });
  assert.deepEqual(evaluateGateV1Object({ type: 'npc_alive', id: '$actor' }, context), { ok: true });
  assert.equal(evaluateGateV1String('npc.needs.stress <= 12', context).ok, true);
  assert.equal(evaluateGateV1String('npc.needs.missing exists', context).reason, 'event-precondition-invalid');
});
check('phase arrays, aliases, and battle mode obey the explicit night rule', () => {
  const day = { state: clone(fixtures.state) };
  assert.equal(evaluateGateV1({ phase: ['NIGHT', 'ANY'], preconditions: [] }, day).ok, true);
  day.state.night = true;
  assert.equal(evaluateGateV1({ phase: 'DAY', preconditions: [] }, day).reason, 'phase-blocked');
  assert.equal(evaluateGateV1({ phase: 'DAY', nightAllowed: true, preconditions: [] }, day).ok, true);
  assert.equal(evaluateGateV1({ phase: 'DAY', preconditions: [] }, { state: clone(fixtures.state), sessionMode: 'BATTLE' }).reason, 'phase-blocked');
});
check('malformed strings and objects fail closed before any effect layer', () => {
  const context = { state: clone(fixtures.state) };
  for (const condition of ['', 'player_tool:', 'tech:', 'flag:', 'gameOver exists', { type: 'future_condition' }, { type: 'flag', id: 'gate.ready', extra: true }, { type: 'camp_trust', min: 'nope' }]) {
    const result = typeof condition === 'string' ? evaluateGateV1String(condition, context) : evaluateGateV1Object(condition, context);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'event-precondition-invalid');
  }
});
check('malformed state containers fail closed without throwing', () => {
  const result = evaluateGateV1({ version: 1, phase: 'ANY', preconditions: [
    { type: 'landmark_exists', id: 'waterMill' },
  ] }, { state: { landmarks: {}, npcs: {}, contentState: { meters: {} } } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'event-precondition');
  assert.deepEqual(normalizeEventGate(null), { version: 0, phase: 'DAY', nightAllowed: false, preconditions: [] });
  assert.deepEqual(normalizeEventGate([]), { version: 0, phase: 'DAY', nightAllowed: false, preconditions: [] });
});

const output = { runner: 'event-gate-v1-contract', ok: checks.every(item => item.ok), count: checks.length, passed: checks.filter(item => item.ok).length, checks };
console.log(JSON.stringify(output, null, 2));
process.exitCode = output.ok ? 0 : 1;

