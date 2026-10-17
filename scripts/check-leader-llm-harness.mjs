#!/usr/bin/env node
/**
 * Offline contract checker for ADR-20261014-leader-llm-harness.
 *
 * This is deliberately independent from dist/index.html: it checks the V1
 * envelope/projection contract and a tiny deterministic commander baseline.
 * It must never be imported by the game or treated as a runtime registry.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const fixtureDir = path.join(scriptDir, 'fixtures', 'leader-harness');
const usage = 'node scripts/check-leader-llm-harness.mjs [--fixture-dir DIR]';
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') { console.log(usage); process.exit(0); }
assert.equal(args.length % 2, 0, usage);
let fixtureRoot = fixtureDir;
for (let i = 0; i < args.length; i += 2) {
  assert.equal(args[i], '--fixture-dir', usage);
  assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), usage);
  fixtureRoot = path.resolve(args[i + 1]);
}

const readJson = name => JSON.parse(readFileSync(path.join(fixtureRoot, name), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const sha256 = value => createHash('sha256').update(canonical(value)).digest('hex');
const without = (value, key) => { const result = clone(value); delete result[key]; return result; };
const exactKeys = (value, allowed, label) => {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  for (const key of Object.keys(value)) assert.ok(allowed.includes(key), `${label} unknown field: ${key}`);
};
const stringField = (value, label) => assert.equal(typeof value, 'string', `${label} must be a string`);
const nonNegativeInt = (value, label) => assert.ok(Number.isSafeInteger(value) && value >= 0, `${label} must be a non-negative integer`);

function validateProjection(projection) {
  exactKeys(projection, ['schema', 'projectionVersion', 'actorId', 'roleId', 'day', 'phase', 'minute', 'visibleLandmarks', 'visibleThreats', 'knownNpcs', 'inventorySummary', 'relationSummary', 'recentEvents', 'sourceProjectionHash'], 'projection');
  assert.equal(projection.schema, 'ProjectionV1');
  assert.equal(projection.projectionVersion, 1);
  stringField(projection.actorId, 'projection.actorId'); stringField(projection.roleId, 'projection.roleId');
  nonNegativeInt(projection.day, 'projection.day'); nonNegativeInt(projection.minute, 'projection.minute');
  assert.equal(projection.phase, 'DAY');
  for (const [index, item] of projection.visibleLandmarks.entries()) { exactKeys(item, ['id', 'kind', 'status'], `projection.visibleLandmarks[${index}]`); stringField(item.id, 'landmark.id'); }
  for (const [index, item] of projection.visibleThreats.entries()) { exactKeys(item, ['id', 'kind', 'severity', 'distanceBand'], `projection.visibleThreats[${index}]`); stringField(item.id, 'threat.id'); }
  for (const [index, item] of projection.knownNpcs.entries()) { exactKeys(item, ['id', 'role', 'presence', 'lifeState', 'job'], `projection.knownNpcs[${index}]`); stringField(item.id, 'npc.id'); }
  exactKeys(projection.inventorySummary, ['food', 'wood', 'parts', 'medicine'], 'projection.inventorySummary');
  exactKeys(projection.relationSummary, ['campTrust', 'commanderMandate'], 'projection.relationSummary');
  assert.ok(Array.isArray(projection.recentEvents));
  stringField(projection.sourceProjectionHash, 'projection.sourceProjectionHash');
  const expectedHash = sha256(without(projection, 'sourceProjectionHash'));
  assert.equal(projection.sourceProjectionHash, expectedHash, `projection hash mismatch: expected ${expectedHash}`);
  return expectedHash;
}

function validateIntentShape(intent) {
  exactKeys(intent, ['schema', 'intentId', 'actorId', 'roleId', 'policyVersion', 'sourceProjectionHash', 'target', 'action', 'deadline', 'resourceBudget', 'cancelIf', 'fallback', 'model', 'reason'], 'intent');
  assert.equal(intent.schema, 'IntentEnvelopeV1');
  for (const key of ['intentId', 'actorId', 'roleId', 'policyVersion', 'sourceProjectionHash', 'action']) stringField(intent[key], `intent.${key}`);
  exactKeys(intent.target, ['kind', 'id'], 'intent.target'); stringField(intent.target.kind, 'intent.target.kind'); stringField(intent.target.id, 'intent.target.id');
  exactKeys(intent.deadline, ['day', 'minute'], 'intent.deadline'); nonNegativeInt(intent.deadline.day, 'intent.deadline.day'); nonNegativeInt(intent.deadline.minute, 'intent.deadline.minute');
  exactKeys(intent.resourceBudget, ['commandPoints', 'wood', 'food', 'parts', 'medicine', 'stamina'], 'intent.resourceBudget');
  for (const [key, value] of Object.entries(intent.resourceBudget)) nonNegativeInt(value, `intent.resourceBudget.${key}`);
  assert.ok(Array.isArray(intent.cancelIf) && intent.cancelIf.every(value => typeof value === 'string'));
  exactKeys(intent.fallback, ['kind', 'plannerId', 'action'], 'intent.fallback');
  assert.equal(intent.fallback.kind, 'rule'); stringField(intent.fallback.plannerId, 'intent.fallback.plannerId'); stringField(intent.fallback.action, 'intent.fallback.action');
  exactKeys(intent.model, ['kind', 'provider', 'latencyMs', 'attempt'], 'intent.model');
  assert.equal(intent.model.kind, 'rules-baseline'); stringField(intent.model.provider, 'intent.model.provider'); nonNegativeInt(intent.model.latencyMs, 'intent.model.latencyMs'); nonNegativeInt(intent.model.attempt, 'intent.model.attempt');
  exactKeys(intent.reason, ['summary', 'confidence'], 'intent.reason'); stringField(intent.reason.summary, 'intent.reason.summary'); assert.ok(['low', 'medium', 'high'].includes(intent.reason.confidence));
}

function baselineIntent(projection) {
  const hash = sha256(without(projection, 'sourceProjectionHash'));
  return {
    schema: 'IntentEnvelopeV1', intentId: `intent-${projection.actorId}-d${projection.day}-baseline`, actorId: projection.actorId, roleId: projection.roleId,
    policyVersion: 'leader-policy-v1', sourceProjectionHash: hash, target: { kind: 'plan', id: 'plan-defend-core-001' }, action: 'support_proposal',
    deadline: { day: projection.day, minute: projection.minute + 60 }, resourceBudget: { commandPoints: 1 },
    cancelIf: ['phase-not-DAY', 'plan-no-longer-candidate', 'target-missing'], fallback: { kind: 'rule', plannerId: 'camp.commander.baseline', action: 'abstain' },
    model: { kind: 'rules-baseline', provider: 'local', latencyMs: 0, attempt: 0 }, reason: { summary: '核心防线承压，优先降低夜间失守风险。', confidence: 'high' }
  };
}

function gate(intent, projection, world) {
  const checks = [];
  const check = (name, ok) => { checks.push({ name, ok: !!ok }); return !!ok; };
  let reasonCode = 'accepted';
  try { validateIntentShape(intent); } catch (error) { return { schema: 'GateReport', gateVersion: 1, intentId: intent?.intentId || null, status: 'rejected', reasonCode: 'invalid', checks: [{ name: 'intent-shape', ok: false, detail: String(error.message) }], fallbackIntentId: `${intent?.intentId || 'unknown'}:fallback` }; }
  if (!check('projection-hash', intent.sourceProjectionHash === sha256(without(projection, 'sourceProjectionHash')))) reasonCode = reasonCode === 'accepted' ? 'stale-observation' : reasonCode;
  if (!check('actor-roster', intent.actorId === world.actor.id && world.actor.active && !world.actor.dead && world.actor.presence === 'camp')) reasonCode = reasonCode === 'accepted' ? 'unauthorized' : reasonCode;
  if (!check('role-match', intent.roleId === projection.roleId && intent.roleId === world.actor.roleId)) reasonCode = reasonCode === 'accepted' ? 'unauthorized' : reasonCode;
  if (!check('phase-window', projection.phase === world.phase && world.phase === 'DAY' && intent.deadline.day === world.day)) reasonCode = reasonCode === 'accepted' ? 'phase-blocked' : reasonCode;
  const commandForAction = { support_proposal: 'plan.meeting.commit', modify_plan: 'plan.meeting.modify', abstain: 'plan.meeting.abstain' }[intent.action];
  if (!check('command-whitelist', !!commandForAction && world.registeredCommands.includes(commandForAction))) reasonCode = reasonCode === 'accepted' ? 'intent-unsupported' : reasonCode;
  if (!check('target-stable-id', intent.target.kind === 'plan' && world.planMeeting.candidateIds.includes(intent.target.id))) reasonCode = reasonCode === 'accepted' ? 'target-missing' : reasonCode;
  const cp = intent.resourceBudget.commandPoints;
  if (!check('resource-budget', cp >= 0 && cp <= world.commandPoints)) reasonCode = reasonCode === 'accepted' ? 'resource-shortage' : reasonCode;
  const report = { schema: 'GateReport', gateVersion: 1, intentId: intent.intentId, status: reasonCode === 'accepted' && checks.every(item => item.ok) ? 'accepted' : 'rejected', reasonCode: reasonCode === 'accepted' && checks.every(item => item.ok) ? 'accepted' : reasonCode, checks, fallbackIntentId: reasonCode === 'accepted' ? null : `${intent.intentId}:fallback` };
  return report;
}

const projection = readJson('projection-v1.json');
const intent = readJson('intent-envelope-v1.json');
const world = readJson('world-baseline.json');
const expectedReport = readJson('gate-report-baseline.json');
const checks = [], failures = [];
function test(name, run) { try { run(); checks.push({ name, ok: true }); } catch (error) { checks.push({ name, ok: false, error: String(error.message || error) }); failures.push(name); } }
test('ProjectionV1 whitelist and hash', () => { const hash = validateProjection(projection); assert.equal(intent.sourceProjectionHash, hash); });
test('rules baseline emits only a structured IntentEnvelopeV1', () => { const generated = baselineIntent(projection); validateIntentShape(generated); assert.equal(generated.model.kind, 'rules-baseline'); assert.equal(Object.hasOwn(generated, 'gameStatePatch'), false); });
test('valid support proposal is accepted by deterministic Gate', () => { const normalized = { ...intent, sourceProjectionHash: sha256(without(projection, 'sourceProjectionHash')) }; const report = gate(normalized, projection, world); assert.equal(report.status, 'accepted'); assert.equal(report.reasonCode, expectedReport.reasonCode); });
test('unregistered command and script target are rejected', () => { const invalid = readJson('intent-invalid-unsupported-command.json'); const report = gate({ ...invalid, sourceProjectionHash: sha256(without(projection, 'sourceProjectionHash')) }, projection, world); assert.equal(report.status, 'rejected'); assert.equal(report.reasonCode, 'intent-unsupported'); });
test('unknown state patch field is rejected before capability checks', () => { const invalid = readJson('intent-invalid-hidden-field.json'); const report = gate({ ...invalid, sourceProjectionHash: sha256(without(projection, 'sourceProjectionHash')) }, projection, world); assert.equal(report.status, 'rejected'); assert.equal(report.reasonCode, 'invalid'); });
test('expected GateReport is a small receipt, not a game-state mutation', () => { exactKeys(expectedReport, ['schema', 'gateVersion', 'intentId', 'status', 'reasonCode', 'checks', 'fallbackIntentId'], 'expectedReport'); assert.equal(expectedReport.schema, 'GateReport'); assert.equal(expectedReport.gateVersion, 1); assert.ok(Array.isArray(expectedReport.checks) && expectedReport.checks.length >= 1 && expectedReport.checks.every(item => item.ok === true)); assert.equal(Object.hasOwn(expectedReport, 'gameState'), false); });

const result = { runner: 'offline-leader-llm-harness-contract', fixtureDir: path.relative(repoRoot, fixtureRoot), ok: failures.length === 0, count: checks.length, passed: checks.filter(item => item.ok).length, checks, failures, productionWiring: false, source: 'ADR-20261014-leader-llm-harness' };
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.ok ? 0 : 1;
