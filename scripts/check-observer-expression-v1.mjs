import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { observerDeepFreeze, observerTruthProjection, observerDisclosureScore, resolveObserverExpression, stableHash } from './lib/observer-expression-v1.mjs';

const checks = [];
function test(name, run) {
  try { run(); checks.push({ name, ok: true }); }
  catch (error) { checks.push({ name, ok: false, error: String(error.stack || error) }); }
}
const npc = { kind: 'npc', id: 'radio', name: '阿默', role: 'radio', lifeState: 'healthy', hp: 75, maxHp: 100 };
const event = { kind: 'event', id: 'threat-1', title: '尸潮', phase: 'NIGHT', handled: false, threat: 80 };
const item = { kind: 'item', id: 'tool', label: '工具', category: 'tool', quality: 90 };
const resolve = (subject, context = {}, enabled = true) => resolveObserverExpression({ subject, context, config: { observerCommentary: enabled } });
const relation = trust => ({ relation: { trustToPlayer: trust } });
const fixture = JSON.parse(readFileSync(new URL('./fixtures/observer-expression-v1.json', import.meta.url), 'utf8'));
for (const row of fixture.cases) test('legacy fixture: ' + row.id, () => {
  const before = JSON.stringify(row);
  const result = resolveObserverExpression(row);
  assert.equal(result.mode, row.expect.mode);
  assert.equal(result.schema, 'ObserverExpressionV1');
  assert.equal(result.version, 1);
  assert.equal(result.authority, 'expression_only');
  assert.equal(JSON.stringify(row), before);
});
test('health quartiles preserve valid zero and clamp to four', () => {
  for (const [hp, band] of [[0, '0/4'], [25, '1/4'], [50, '2/4'], [75, '3/4'], [100, '4/4'], [150, '4/4']]) {
    assert.equal(observerTruthProjection({ ...npc, hp }).hpBand, band);
  }
});
test('null missing coercible and non-finite health are unknown', () => {
  for (const value of [null, undefined, false, true, '', '100', {}, [], NaN, Infinity, -1]) {
    assert.equal(observerTruthProjection({ ...npc, hp: value }).hpBand, 'unknown');
    assert.equal(observerTruthProjection({ ...npc, maxHp: value }).hpBand, 'unknown');
  }
  assert.equal(observerTruthProjection({ ...npc, maxHp: 0 }).hpBand, 'unknown');
});
test('threat and quality bands have exact numeric boundaries', () => {
  for (const [threat, band] of [[0, 'low'], [24, 'low'], [25, 'medium'], [59, 'medium'], [60, 'high']]) {
    assert.equal(observerTruthProjection({ ...event, threat }).threatBand, band);
  }
  for (const [quality, band] of [[0, 'low'], [39, 'low'], [40, 'medium'], [69, 'medium'], [70, 'high']]) {
    assert.equal(observerTruthProjection({ ...item, quality }).qualityBand, band);
  }
});
test('unknown bands never coerce null missing boolean object or text to zero', () => {
  for (const value of [null, undefined, false, true, '', '90', {}, [], NaN, Infinity]) {
    assert.equal(observerTruthProjection({ ...event, threat: value }).threatBand, 'unknown');
    assert.equal(observerTruthProjection({ ...item, quality: value }).qualityBand, 'unknown');
  }
  for (const value of [null, false, true, {}, 'legendary']) assert.equal(observerTruthProjection({ ...item, qualityBand: value }).qualityBand, 'unknown');
});
test('text and enum fields reject objects booleans numbers and unknown enums', () => {
  for (const value of [{ secret: 'never' }, true, false, 123, [], '']) {
    const p = observerTruthProjection({ ...npc, id: value, name: value, role: value, lifeState: value });
    assert.equal(p.id, null); assert.equal(p.name, '未知角色'); assert.equal(p.role, null); assert.equal(p.lifeState, 'unknown');
    const e = observerTruthProjection({ ...event, title: value, phase: value, handled: value });
    assert.equal(e.title, event.id); assert.equal(e.phase, 'unknown');
    assert.equal(e.handled, typeof value === 'boolean' ? value : 'unknown');
  }
});
test('invalid subjects and unknown kinds return deterministic safe fallback', () => {
  for (const subject of [undefined, null, [], false, 'npc', { kind: 'alien', secret: 'never' }, { kind: null }, { kind: {} }]) {
    const a = resolve(subject), b = resolve(subject);
    assert.deepEqual(a, b); assert.equal(a.mode, 'fallback'); assert.equal(a.fallbackReason, 'invalid-subject');
    assert.deepEqual(a.facts, { kind: 'invalid', id: null });
    assert.equal(JSON.stringify(a).includes('never'), false);
  }
});
test('legacy inferred kinds remain supported', () => {
  assert.equal(observerTruthProjection({ lifeState: 'healthy' }).kind, 'npc');
  assert.equal(observerTruthProjection({ defId: 'supply' }).kind, 'event');
  assert.equal(observerTruthProjection({ label: '工具' }).kind, 'item');
});
test('score combines trust alignment progress and clamps', () => {
  assert.equal(observerDisclosureScore(npc, { ...relation(20), valueAlignment: 40, playerProgress: 100 }), .85);
  assert.equal(observerDisclosureScore(npc, { ...relation(100), valueAlignment: 100, playerProgress: 100 }), 1);
  assert.equal(observerDisclosureScore(npc, { ...relation(-100), valueAlignment: -100, playerProgress: -100 }), 0);
  assert.equal(observerDisclosureScore({ relation: { trust: 20 }, values: { alignment: 40 }, playerProgress: 100 }), .85);
});
test('NaN and malformed policy numbers have finite neutral adjustments', () => {
  for (const value of [NaN, Infinity, null, undefined, false, true, '100', {}, []]) {
    assert.equal(observerDisclosureScore(npc, { relation: { trustToPlayer: value }, valueAlignment: value, playerProgress: value }), .5);
  }
});
test('disclosure thresholds are inclusive and do not return projection', () => {
  for (const [subject, trust, field] of [[item, -30, 'qualityBand'], [npc, -10, 'hpBand'], [event, 10, 'threatBand']]) {
    const below = resolve(subject, relation(trust - .001)), exact = resolve(subject, relation(trust));
    assert.equal(Object.hasOwn(below.facts, field), false);
    assert.equal(Object.hasOwn(exact.facts, field), true);
    assert.equal(Object.hasOwn(below, 'projection'), false);
    assert.equal(JSON.stringify(below).includes('"' + field + '"'), false);
  }
});
test('AI OFF and ON share exactly facts text score and hash', () => {
  for (const subject of [item, npc, event]) {
    const off = resolve(subject, relation(80), false), on = resolve(subject, relation(80), true);
    assert.deepEqual(off.facts, on.facts); assert.equal(off.text, on.text);
    assert.equal(off.disclosureScore, on.disclosureScore); assert.equal(off.sourceProjectionHash, on.sourceProjectionHash);
    assert.equal(off.mode, 'fallback'); assert.equal(on.mode, 'deterministic-stub');
  }
});
test('Chinese commentary preserves refusal and priority wording', () => {
  assert.equal(resolve(npc, relation(-50)).text, '可验证角色事实（模糊披露）：阿默；我暂时不愿解释更多。');
  assert.equal(resolve(event, relation(80)).text, '可验证事件事实（完整披露）：尸潮；这件事需要优先处理。');
  assert.equal(resolve(item, relation(80)).text, '可验证物品事实（完整披露）：工具；它的价值值得谨慎评估。');
});
test('all outputs are deeply frozen without freezing or mutating inputs', () => {
  const input = { subject: { ...npc, secret: { password: 'never', patch: { food: 999 } } }, context: relation(80), config: { enabled: true } };
  const before = JSON.stringify(input), out = resolveObserverExpression(input), oldFacts = JSON.stringify(out.facts);
  assert.ok(Object.isFrozen(out)); assert.ok(Object.isFrozen(out.facts));
  assert.ok(Object.isFrozen(observerTruthProjection(input.subject)));
  assert.throws(() => { out.facts.hpBand = 'secret'; }, TypeError);
  assert.equal(JSON.stringify(out.facts), oldFacts); assert.equal(JSON.stringify(input), before);
  assert.equal(Object.isFrozen(input.subject), false); assert.equal(Object.isFrozen(input.context), false);
  assert.equal(JSON.stringify(out).includes('never'), false); assert.equal(JSON.stringify(out).includes('999'), false);
});
test('deep freeze handles nested arrays symbols and cycles', () => {
  const symbol = Symbol('nested'), value = { nested: [{ n: 1 }], [symbol]: { x: 2 } }; value.self = value;
  assert.equal(observerDeepFreeze(value), value);
  for (const node of [value, value.nested, value.nested[0], value[symbol]]) assert.ok(Object.isFrozen(node));
});
test('hash version matches independent UTF16 FNV base36 including emoji', () => {
  const out = resolve({ ...item, label: '工具🧭' }), text = JSON.stringify(out.facts);
  let expected = 2166136261n;
  for (let i = 0; i < text.length; i++) expected = ((expected ^ BigInt(text.charCodeAt(i))) * 16777619n) & 0xffffffffn;
  assert.equal(out.hashVersion, 'fnv1a-utf16-base36-v1');
  assert.equal(out.sourceProjectionHash, expected.toString(36)); assert.equal(stableHash(out.facts), expected.toString(36));
});
test('whitelist omits arbitrary state paths patches and free payloads', () => {
  const out = resolve({ ...event, secret: 'never', payload: { food: 999 }, gameStatePatch: { hp: 100 }, relations: { secret: 'never' } }, relation(100));
  assert.deepEqual(Object.keys(out.facts), ['kind', 'id', 'title', 'phase', 'handled', 'threatBand']);
  assert.equal(JSON.stringify(out).includes('never'), false); assert.equal(JSON.stringify(out).includes('999'), false);
});
test('config uses exact booleans only', () => {
  for (const enabled of ['true', 1, {}, null]) assert.equal(resolveObserverExpression({ subject: item, config: { enabled } }).mode, 'fallback');
});
test('embedding markers isolate export-free core with identical output', () => {
  const source = readFileSync(new URL('./lib/observer-expression-v1.mjs', import.meta.url), 'utf8');
  const core = source.split('// OBSERVER_CORE_START')[1].split('// OBSERVER_CORE_END')[0];
  assert.ok(core); assert.equal(/\b(?:import|export)\s/.test(core), false);
  const embedded = vm.runInNewContext(core + '\nresolveObserverExpression');
  for (const subject of [npc, event, item, { kind: 'unknown' }]) {
    const input = { subject, context: relation(20), config: { observerCommentary: true } };
    assert.equal(JSON.stringify(embedded(input)), JSON.stringify(resolveObserverExpression(input)));
  }
});
const passed = checks.filter(row => row.ok).length;
const report = { runner: 'observer-expression-v1', ok: passed === checks.length, passed, count: checks.length,
  scope: 'pure Node core and extracted embedded core; no browser or runtime adapter', checks };
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
