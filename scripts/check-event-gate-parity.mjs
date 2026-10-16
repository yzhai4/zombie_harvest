#!/usr/bin/env node
/**
 * Compare the pure EventGateV1 shadow evaluator with the current inline
 * browser-runtime evaluator on the same immutable fixtures.
 *
 * This is source parity evidence only. It does not start a browser, mutate a
 * save, execute effects, or claim a natural gameplay run.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { evaluateGateV1, normalizeEventGate } from './lib/event-gate-v1.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const htmlArg = args.indexOf('--html');
assert.ok(htmlArg < 0 || typeof args[htmlArg + 1] === 'string', 'usage: node scripts/check-event-gate-parity.mjs [--html ABSOLUTE_HTML]');
const htmlPath = htmlArg >= 0 ? path.resolve(args[htmlArg + 1]) : path.join(root, 'dist', 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(item => item[1]).filter(text => text.trim());
assert.equal(inline.length, 1, 'one inline runtime expected');

const functionStart = inline[0].indexOf('    function normalizeEventGate');
const functionEnd = inline[0].indexOf('    function normalizeEventEffect', functionStart);
assert.ok(functionStart >= 0 && functionEnd > functionStart, 'inline GateV1 function boundary required');
const inlineGateFunctions = inline[0].slice(functionStart, functionEnd);
const fixture = JSON.parse(readFileSync(path.join(root, 'scripts', 'fixtures', 'event-gate-v1.json'), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const plain = value => JSON.parse(JSON.stringify(value));
const project = result => Object.fromEntries(['ok', 'reason', 'gateVersion', 'phase', 'checked']
  .filter(key => Object.prototype.hasOwnProperty.call(result, key)).map(key => [key, plain(result[key])]));

function evaluateInline(gate, state, inputContext = {}) {
  const context = { ...inputContext };
  delete context.state;
  const mode = context.sessionMode === 'BATTLE' || context.sessionController?.mode === 'BATTLE' || context.SessionController?.mode === 'BATTLE' ? 'BATTLE' : 'DAY';
  const source = `
    let state = ${JSON.stringify(clone(state))};
    function clampSanity(value, fallback = 72) { return Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : fallback)); }
    function sanityValue(target = 'player') { return target === 'player' ? clampSanity(state.sanity) : clampSanity(target?.sanity); }
    function npcIsActive(npc) { return npc && npc.lifeState !== 'dead'; }
    const SessionController = { mode: ${JSON.stringify(mode)} };
    ${inlineGateFunctions}
    globalThis.parityResult = evaluateGateV1(${JSON.stringify(gate)}, ${JSON.stringify(context)});
    globalThis.parityNormalized = normalizeEventGate(${JSON.stringify(gate)});
    globalThis.parityState = state;
  `;
  const sandbox = vm.createContext({ console });
  vm.runInContext(source, sandbox, { filename: htmlPath + ':event-gate-parity' });
  return { result: sandbox.parityResult, normalized: sandbox.parityNormalized, state: sandbox.parityState };
}

const checks = [];
function check(name, run) {
  try { run(); checks.push({ name, ok: true }); }
  catch (error) { checks.push({ name, ok: false, error: String(error.message || error) }); }
}

check('fixture set is non-empty and covers both outcomes', () => {
  assert.ok(fixture.cases.length > 0);
  assert.ok(fixture.cases.some(item => item.expected.ok));
  assert.ok(fixture.cases.some(item => item.expected.ok === false));
});

for (const item of fixture.cases) {
  check(`inline/pure parity: ${item.name}`, () => {
    const state = { ...clone(fixture.state), ...(item.statePatch || {}) };
    const context = { state, ...(item.context || {}) };
    const before = clone(state);
    const pure = evaluateGateV1(item.gate, context);
    assert.deepEqual(state, before, `${item.name}: pure evaluator mutated state`);
    const inlineResult = evaluateInline(item.gate, state, context);
    assert.deepEqual(project(pure), item.expected, `${item.name}: pure result drifted from fixture`);
    assert.deepEqual(project(inlineResult.result), item.expected, `${item.name}: inline result drifted from fixture`);
    assert.deepEqual(plain(inlineResult.result), plain(pure), `${item.name}: inline and pure evaluators diverged`);
    assert.deepEqual(plain(inlineResult.state), before, `${item.name}: inline evaluator mutated state`);
    assert.deepEqual(plain(inlineResult.normalized), plain(normalizeEventGate(item.gate)), `${item.name}: normalization drifted`);
  });
}

const output = {
  runner: 'event-gate-v1-parity',
  sourceHtmlSha256: createHash('sha256').update(html).digest('hex'),
  ok: checks.every(item => item.ok),
  count: checks.length,
  passed: checks.filter(item => item.ok).length,
  checks
};
console.log(JSON.stringify(output, null, 2));
process.exitCode = output.ok ? 0 : 1;


