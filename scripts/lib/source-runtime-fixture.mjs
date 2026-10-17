import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Test instrumentation only. Execute the real inline game and the existing IO
// adapter; do not replace the reducers, identity checks, or save loader.
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const saveKey = 'zombie-harvest-progress-v12';
export function sourceRuntimeFactory(htmlPath = path.join(root, 'dist/index.html')) {
  const html = readFileSync(htmlPath, 'utf8');
  const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(text => text.trim());
  assert.equal(inline.length, 1);
  const harness = readFileSync(path.join(root, 'scripts/check-report-recovery.mjs'), 'utf8');
  const start = harness.indexOf('function runtime(entries = []) {');
  const end = harness.indexOf('\nfunction envelope(payload)', start);
  assert.ok(start >= 0 && end > start, 'source IO adapter extraction markers');
  let body = harness.slice(start, end);
  // DOM collection operation only; preserve the actual event renderer and its
  // source/choice selection logic. The older IO adapter did not need this API.
  const childMarker = 'appendChild(child) { this.children.push(child); }';
  assert.equal(body.split(childMarker).length, 2);
  body = body.replace(childMarker, childMarker + ', replaceChildren(...children) { this.children = [...children]; }');
  const marker = 'registry: EVENT_DEFS, hash: checksum,';
  assert.equal(body.split(marker).length, 2);
  body = body.replace(marker, `
    contentRegistry: ContentRegistry, contentResolve: resolveContentChainCommand,
    bindChoice: bindEventChoice, expectedToken: eventChoiceExpectedToken,
    handleChoice: handleEventChoice, renderEvent, eventContentChainViews,
    selectChain(id) { eventPanelSelection = 'chain:' + id; eventPanelReceipt = null; },
    observerCommentary, observerTruthProjection, worldSnapshot: WorldFacts.snapshot,
    updateNpcPerception, perceptionTargetsForNpc, perceptionProfile, canPerceive,
    dayNpcCanAttack, dayNpcTarget, runDayCombat, updateNpcRoutine, advance,
    registry: EVENT_DEFS, hash: checksum,
  `);
  return new Function('inline', 'htmlPath', 'vm', 'assert', body + '\nreturn runtime;')(inline, htmlPath, vm, assert);
}
export function startRuntime(factory = sourceRuntimeFactory(), entries = []) {
  const runtime = factory(entries);
  assert.equal(runtime.api.start().ok, true, 'source start');
  runtime.tasks.clear();
  runtime.api.session.mode = 'DAY';
  return runtime;
}
export function envelope(factory, payload) {
  const r = factory();
  return JSON.stringify({ version: payload.version, payload, checksum: r.api.hash(payload), savedAt: (payload.day - 1) * 1440 + payload.hour * 60 + payload.minute });
}
export const plain = value => JSON.parse(JSON.stringify(value));
