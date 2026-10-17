import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createScenarioSnapshot, resolveScenarioConfig, validateScenarioPackage, compileScenarioEvents } from './lib/scenario-package-v1.mjs';

// Pure package and shared-core checks. Actual fresh/continue boot, RNG consumers,
// resource effects and writer recovery are checked separately by the source VM.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bytes = fs.readFileSync(path.join(root, 'dist/index.html'));
const source = bytes.toString('utf8');
const moduleBytes = fs.readFileSync(path.join(root, 'scripts/lib/scenario-package-v1.mjs'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/scenario-zombie-harvest-v1.json'), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const checks = [];
function test(name, run) { try { run(); checks.push({ name, ok: true }); } catch (error) { checks.push({ name, ok: false, error: String(error.message || error) }); } }
test('module and actual inline use identical Scenario core bytes', () => {
  const start = '// SCENARIO_C1_CORE_START', end = '// SCENARIO_C1_CORE_END';
  const extract = text => { const a = text.indexOf(start), b = text.indexOf(end); assert.ok(a >= 0 && b > a); assert.equal(text.indexOf(start, a + 1), -1); return text.slice(a, b + end.length); };
  assert.equal(extract(source), extract(moduleBytes.toString('utf8')));
});
test('bundled package is supported', () => assert.deepEqual(validateScenarioPackage(pkg), { ok: true, issues: [] }));
test('actual boot package bytes parse to the checked fixture JSON', () => {
  const embedded = [...source.matchAll(/^    const SCENARIO_BOOT_PACKAGE = observerDeepFreeze\((\{[^\r\n]*\})\);/gm)];
  assert.equal(embedded.length, 1); assert.deepEqual(JSON.parse(embedded[0][1]), pkg);
});
test('snapshot includes required scenario schema tag and versioned initial binding', () => {
  const s = createScenarioSnapshot(pkg);
  assert.equal(s.schemaVersion, 1); assert.equal(s.binding.status, 'bound'); assert.equal(s.binding.version, 1);
  assert.deepEqual(s.binding.appliedKeys, ['seed', 'world.foodMultiplier', 'events']);
  assert.equal(s.binding.baselineOnlyKeys.includes('events'), false); assert.deepEqual(s.binding.deferredKeys, ['continuity']);
  assert.deepEqual(s.binding.initialAiConfig, s.aiConfig);
  const c = compileScenarioEvents(pkg);
  assert.deepEqual(s.contentBinding, {version:1,status:'bound',compilerVersion:c.compilerVersion,catalogDigest:c.catalogDigest,rulesDigest:c.rulesDigest,registry:c.registry});
});
test('zero and max uint32 are represented without default substitution', () => {
  for (const seed of [0, 4294967295]) assert.equal(resolveScenarioConfig(pkg, { seed }).seed, seed);
  for (const seed of [-1, .5, 4294967296, NaN, Infinity, '0', null, true]) assert.throws(() => resolveScenarioConfig(pkg, { seed }));
});
test('initial food scale accepts zero and fractions as configuration only', () => {
  for (const foodMultiplier of [0, .5, 1, 2]) assert.equal(createScenarioSnapshot(pkg, { worldConfig: { foodMultiplier } }).worldConfig.foodMultiplier, foodMultiplier);
  for (const foodMultiplier of [-.1, 2.1, '1', NaN, null]) assert.throws(() => createScenarioSnapshot(pkg, { worldConfig: { foodMultiplier } }));
});
test('unimplemented and unknown profiles reject rather than falling back', () => {
  for (const difficultyProfile of ['hard', 'unknown', null, 0]) assert.throws(() => resolveScenarioConfig(pkg, { difficultyProfile }));
  assert.throws(() => resolveScenarioConfig(pkg, { difficultyProfile: 'hard', worldConfig: { initialEnemyMultiplier: 1 } }));
});
test('unimplemented axes and unknown fields reject', () => {
  for (const worldConfig of [{ ordinaryNpcCount: 24 }, { medicineMultiplier: 2 }, { materialMultiplier: 0 }, { initialEnemyMultiplier: 1.3 }, { waveGrowthMultiplier: 2 }, { eventFrequency: .5 }, { diplomacy: 1 }]) assert.throws(() => resolveScenarioConfig(pkg, { worldConfig }));
  assert.throws(() => resolveScenarioConfig(pkg, { unknown: true }));
});
test('authority checks cover package policy and storylet expression', () => {
  const policy = clone(pkg); policy.ai.policies.observer.authority = 'write_state'; assert.equal(validateScenarioPackage(policy).ok, false);
  const expression = clone(pkg); expression.events.storylets[0].expression.observerCommentary.authority = 'write_state'; assert.equal(validateScenarioPackage(expression).ok, false);
  assert.throws(() => createScenarioSnapshot(pkg, { aiConfig: { authority: 'write_state' } }));
});
test('unsupported generated capabilities reject and observer remains expression only', () => {
  for (const key of ['generativeDialogue', 'generatedWorldEvents', 'learnedWorldModel']) assert.throws(() => createScenarioSnapshot(pkg, { aiConfig: { [key]: true } }));
  const s = createScenarioSnapshot(pkg, { aiConfig: { observerCommentary: true } });
  assert.deepEqual(s.aiConfig, { generativeDialogue: false, observerCommentary: true, generatedWorldEvents: false, learnedWorldModel: false, policyVersion: 'observer-expression-v1' });
});
test('C2 compiles coherent JSON changes and rejects a reward without matching source budget', () => {
  const changed = clone(pkg), story = changed.events.storylets[0];
  story.nodes[0].choices[1].effects[0].value = 3;
  assert.equal(validateScenarioPackage(changed).ok, false);
  story.definitionVersion = 3; story.source.food = 1;
  story.nodes[0].text = '后勤官登记有一份应急藏粮，整局只可动用一次。';
  story.nodes[0].choices[1].hint = '整局一次 · 食物 +1 · 共振仪表 +2 · 需要健康后勤人员在岗';
  story.nodes[0].choices[1].effects[0].value = 1;
  story.nodes[0].choices[1].effects[3].payload.amount = 1;
  assert.equal(validateScenarioPackage(changed).ok, true);
  const c = compileScenarioEvents(changed);
  assert.equal(c.definitions[0].definitionVersion, 3);
  assert.equal(c.definitions[0].nodes[0].choices[1].effects[0].value, 1);
  assert.notEqual(c.catalogDigest, compileScenarioEvents(pkg).catalogDigest);
  assert.notEqual(c.rulesDigest, compileScenarioEvents(pkg).rulesDigest);
});
test('unsupported storylet definition versions stay rejected', () => {
  for (const version of [0, 1, -1, '2', Number.MAX_SAFE_INTEGER + 1]) { const changed = clone(pkg); changed.events.storylets[0].definitionVersion = version; assert.equal(validateScenarioPackage(changed).ok, false); }
});
test('semantic digest ignores object insertion order and declares its algorithm', () => {
  const a = createScenarioSnapshot(pkg, { seed: 0, worldConfig: { foodMultiplier: .5 } });
  const reversed = Object.fromEntries(Object.entries(pkg).reverse());
  const b = createScenarioSnapshot(reversed, { worldConfig: { foodMultiplier: .5 }, seed: 0 });
  assert.equal(a.binding.packageDigest, b.binding.packageDigest); assert.equal(a.binding.configDigest, b.binding.configDigest);
  assert.match(a.binding.packageDigest, /^fnv1a-utf16-canonical-hex-v1:[0-9a-f]{8}$/);
});
test('pure validation and resolution do not mutate package or options', () => {
  const input = clone(pkg), options = { seed: 0, worldConfig: { foodMultiplier: .5 } }, before = clone({ input, options });
  validateScenarioPackage(input); createScenarioSnapshot(input, options);
  assert.deepEqual({ input, options }, before);
});
const report = { runner: 'scenario-package-v1', sourceHtmlSha256: createHash('sha256').update(bytes).digest('hex'), coreModuleSha256: createHash('sha256').update(moduleBytes).digest('hex'), scope: 'pure package and identical inline core; actual boot and simulation are outside this check', naturalGameplay: false, ok: checks.every(x => x.ok), count: checks.length, passed: checks.filter(x => x.ok).length, checks };
console.log(JSON.stringify(report)); if (!report.ok) process.exitCode = 1;
