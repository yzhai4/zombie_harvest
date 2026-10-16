#!/usr/bin/env node
/** Validate the independent CombatIntentV1 contract and negative fixtures. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(path.join(root, 'docs', 'schemas', 'combat-intent-v1.json'), 'utf8'));
const fixtures = JSON.parse(readFileSync(path.join(root, 'scripts', 'fixtures', 'day-combat-intent-v1.json'), 'utf8'));
assert.equal(schema.$id, 'zombie-harvest://schemas/combat-intent-v1.json');
assert.equal(schema.properties.schemaVersion.const, 'CombatIntentV1');
assert.equal(schema.properties.phase.const, 'DAY');

function valid(intent) {
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) return false;
  const required = ['schemaVersion', 'intentId', 'sourceRef', 'targetRef', 'phase', 'attackSeq', 'profileId', 'amount', 'damageType'];
  if (required.some(key => !(key in intent))) return false;
  if (intent.schemaVersion !== 'CombatIntentV1' || intent.phase !== 'DAY') return false;
  if (!Number.isInteger(intent.attackSeq) || intent.attackSeq < 1 || !Number.isInteger(intent.amount) || intent.amount < 1) return false;
  for (const ref of [intent.sourceRef, intent.targetRef]) if (!ref || typeof ref.id !== 'string' || !ref.id || typeof ref.kind !== 'string' || !ref.kind) return false;
  if (typeof intent.intentId !== 'string' || !intent.intentId || typeof intent.profileId !== 'string' || !intent.profileId || typeof intent.damageType !== 'string' || !intent.damageType) return false;
  if (Object.keys(intent).some(key => ['prompt', 'response', 'chainOfThought', 'statePatch', 'rawModelOutput'].includes(key))) return false;
  return true;
}

const checks = [];
function check(name, run) { try { run(); checks.push({ name, ok: true }); } catch (error) { checks.push({ name, ok: false, error: String(error.message || error) }); } }
check('schema declares the required immutable DAY contract', () => {
  assert.deepEqual(schema.required, ['schemaVersion', 'intentId', 'sourceRef', 'targetRef', 'phase', 'attackSeq', 'profileId', 'amount', 'damageType']);
  assert.equal(schema.additionalProperties, false);
});
check('valid fixtures pass', () => { assert.ok(fixtures.valid.length > 0); fixtures.valid.forEach(intent => assert.equal(valid(intent), true)); });
check('invalid fixtures fail closed', () => { assert.ok(fixtures.invalid.length > 0); fixtures.invalid.forEach(intent => assert.equal(valid(intent), false)); });
check('canonical intent bytes are deterministic', () => { const a = JSON.stringify(fixtures.valid[0]); const b = JSON.stringify(JSON.parse(JSON.stringify(fixtures.valid[0]))); assert.equal(a, b); });
check('model text and state patches never enter the intent envelope', () => { assert.equal(valid(fixtures.invalid.find(intent => intent.prompt)), false); assert.equal(valid(fixtures.invalid.find(intent => intent.statePatch)), false); });

const output = { runner: 'combat-intent-v1-contract', ok: checks.every(item => item.ok), count: checks.length, passed: checks.filter(item => item.ok).length, checks };
console.log(JSON.stringify(output, null, 2));
process.exitCode = output.ok ? 0 : 1;

