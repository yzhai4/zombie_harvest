#!/usr/bin/env node
/** Validate the independent CombatIntentV1 contract and negative fixtures. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalCombatIntent, normalizeCombatIntent, sortCombatIntents, validateCombatIntent } from './lib/combat-intent-v1.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(path.join(root, 'docs', 'schemas', 'combat-intent-v1.json'), 'utf8'));
const fixtures = JSON.parse(readFileSync(path.join(root, 'scripts', 'fixtures', 'day-combat-intent-v1.json'), 'utf8'));
assert.equal(schema.$id, 'zombie-harvest://schemas/combat-intent-v1.json');
assert.equal(schema.properties.schemaVersion.const, 'CombatIntentV1');
assert.equal(schema.properties.phase.const, 'DAY');

const valid = intent => validateCombatIntent(intent).ok;

const checks = [];
function check(name, run) { try { run(); checks.push({ name, ok: true }); } catch (error) { checks.push({ name, ok: false, error: String(error.message || error) }); } }
check('schema declares the required immutable DAY contract', () => {
  assert.deepEqual(schema.required, ['schemaVersion', 'intentId', 'sourceRef', 'targetRef', 'phase', 'attackSeq', 'profileId', 'amount', 'damageType']);
  assert.equal(schema.additionalProperties, false);
});
check('valid fixtures pass', () => { assert.ok(fixtures.valid.length > 0); fixtures.valid.forEach(intent => assert.equal(valid(intent), true)); });
check('invalid fixtures fail closed', () => { assert.ok(fixtures.invalid.length > 0); fixtures.invalid.forEach(intent => assert.equal(valid(intent), false)); });
check('canonical intent bytes and sort order are deterministic', () => { const a = canonicalCombatIntent(fixtures.valid[0]); const b = canonicalCombatIntent(JSON.parse(JSON.stringify(fixtures.valid[0]))); assert.equal(a.ok, true); assert.equal(a.value, b.value); const sorted = sortCombatIntents(fixtures.valid.map(item => normalizeCombatIntent(item).intent)); assert.equal(sorted[0].sourceRef.id, 'tower:18,6'); });
check('model text and state patches never enter the intent envelope', () => { assert.equal(valid(fixtures.invalid.find(intent => intent.prompt)), false); assert.equal(valid(fixtures.invalid.find(intent => intent.statePatch)), false); });

const output = { runner: 'combat-intent-v1-contract', ok: checks.every(item => item.ok), count: checks.length, passed: checks.filter(item => item.ok).length, checks };
console.log(JSON.stringify(output, null, 2));
process.exitCode = output.ok ? 0 : 1;

