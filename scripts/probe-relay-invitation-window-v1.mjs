#!/usr/bin/env node
/** Bounded source diagnostic, not a browser, player study or A08 continuation.
 * Uses the existing full-inline VM/IO adapter. Never patches gameplay functions.
 * All positions/clock offsets below are explicitly TEST-ONLY derivatives.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const argv = process.argv.slice(2);
if (argv.length === 1 && argv[0] === '--help') {
  console.log('node scripts/probe-relay-invitation-window-v1.mjs --html <absolute-path> --out <absolute-path> --expect-html-sha256 <64-hex>');
  process.exit(0);
}
const options = {};
for (let i = 0; i < argv.length; i += 2) {
  assert.ok(['--html', '--out', '--expect-html-sha256'].includes(argv[i]) && argv[i + 1], 'unknown or missing option');
  assert.ok(!(argv[i] in options), 'duplicate option');
  options[argv[i]] = argv[i + 1];
}
assert.ok(path.isAbsolute(options['--html'] || '') && path.isAbsolute(options['--out'] || ''), 'absolute HTML and output required');
assert.match(options['--expect-html-sha256'] || '', /^[0-9a-f]{64}$/);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = options['--html'], out = options['--out'];
const inputPath = path.join(root, 'scripts/fixtures/npc-relay-stone-v1/a08-normal-writer643-save21.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const htmlBytes = readFileSync(htmlPath), raw = readFileSync(inputPath, 'utf8');
assert.equal(hash(htmlBytes), options['--expect-html-sha256'], 'exact source HTML');
assert.equal(hash(raw), '7c54ea074c60fe25cfff5bba39300aa85d07fd96fe57b49af88f082077f2b42a', 'original fixture identity');
const dependencies = [htmlPath, inputPath, fileURLToPath(import.meta.url), path.join(root, 'scripts/lib/source-runtime-fixture.mjs'), path.join(root, 'scripts/check-report-recovery.mjs')];
const beforeHashes = dependencies.map(p => ({ path: path.relative(root, p), sha256: hash(readFileSync(p)) }));
const { sourceRuntimeFactory } = await import(pathToFileURL(path.join(root, 'scripts/lib/source-runtime-fixture.mjs')));
const factory = sourceRuntimeFactory(htmlPath);
const SAVE = 'zombie-harvest-progress-v12';
const maxSteps = 31;
const report = {
  schema: 'RelayInvitationWindowDiagnosticV1',
  sourceHtmlSha256: hash(htmlBytes), inputSha256: hash(raw),
  browserExecuted: false, naturalGameplay: false, humanUnderstandingMeasured: false,
  resumesA08: false, productRulesChanged: false, maxStepsPerScene: maxSteps,
  scope: 'Whole inline source in existing TEST-ONLY VM/IO. Consumer-input minutes are NOT whole-world elapsed time; the heartbeat scene is separately labelled.',
  scenarios: [], failures: [], dependencies: beforeHashes
};
function boot(label, materialClock) {
  const r = factory([[SAVE, raw]]);
  vm.runInContext(`Object.assign(qa, {
    offer: npcRelayStoneOfferGate, window: npcRelayStoneWindow,
    projectStep: updateRelayProject, bindings: relayRoleBindings,
    nowMinute: worldMinute
  });`, r.context);
  assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true, label + ' actual input validation');
  assert.equal(r.api.boot.selected.raw, raw, label + ' exact selected fixture');
  r.emit('continueSaveBtn', 'click');
  assert.equal(r.api.started, true, label + ' source Continue');
  assert.equal(r.api.session.mode, 'DAY', label + ' DAY');
  const s = r.api.state, n = s.npcs.find(item => item.id === 'commander');
  assert.ok(n && n.memory.relayCoreHandoff, 'real sourced memory remains required');
  // Only these controls differ from the immutable archived source input.
  // This is NOT physical navigation, a natural save or a new A08 budget.
  s.player.x = n.x - 0.55; s.player.y = n.y;
  s.player.prevX = s.player.x; s.player.prevY = s.player.y;
  s.relayProject.materialClock = materialClock;
  assert.equal(r.api.window(), true, label + ' sampled material window');
  return r;
}
function observe(r, step) {
  const s = r.api.state;
  const frozenState = JSON.stringify(s), frozenTasks = [...r.tasks.keys()], frozenStorage = JSON.stringify([...r.storage.entries()]);
  const gate = clone(r.api.offer('commander'));
  const window = r.api.window(), bindings = r.api.bindings();
  assert.equal(JSON.stringify(s), frozenState, 'queries do not mutate state');
  assert.deepEqual([...r.tasks.keys()], frozenTasks, 'queries do not schedule tasks');
  assert.equal(JSON.stringify([...r.storage.entries()]), frozenStorage, 'queries do not write saves');
  const n = s.npcs.find(item => item.id === 'commander');
  return { step, worldMinute: r.api.nowMinute(), phase: r.api.session.mode,
    playerHp: s.hp, distanceToCommander: Math.hypot(s.player.x - n.x, s.player.y - n.y),
    stage: s.relayProject.status, materialClock: s.relayProject.materialClock,
    materials: clone(s.relayProject.materialProgress), stockStone: s.stone,
    window, gate: { ok: gate.ok, reason: gate.reason || null },
    crewBlockedReason: bindings.blockedReason || null };
}
function scenario(id, kind, clock, run) {
  let r;
  const item = { id, kind, fixtureDerivation: ['TEST-ONLY player repositioned 0.55 from existing commander; no physical reachability assertion', 'TEST-ONLY materialClock=' + clock], observations: [] };
  report.scenarios.push(item);
  try {
    r = boot(id, clock);
    item.observations.push(observe(r, 0));
    run(r, item);
    item.firstMaterialWindowClosedStep = item.observations.find(x => !x.window)?.step ?? null;
    item.firstOfferRefusedStep = item.observations.find(x => !x.gate.ok)?.step ?? null;
    item.ok = true;
  } catch (error) {
    item.ok = false; item.error = String(error.stack || error);
    report.failures.push({ scenario: id, error: item.error });
  } finally { if (r) r.tasks.clear(); }
}
for (const clock of [0, 29]) scenario('consumer-clock-' + clock, 'isolated real project consumer; all world timers stopped', clock, (r, item) => {
  r.tasks.clear();
  for (let step = 1; step <= maxSteps; step++) {
    r.api.projectStep(1);
    item.observations.push(observe(r, step));
    if (!item.observations.at(-1).window) break;
  }
});
scenario('actual-heartbeat-clock-0', 'selected real 1200ms interval only; controlled IO; no browser, RAF scheduling or movement input', 0, (r, item) => {
  for (let step = 1; step <= maxSteps; step++) {
    const timer = [...r.tasks.values()].find(t => t.kind === 'interval' && t.delay === 1200);
    if (!timer || r.api.session.mode !== 'DAY') { item.stopReason = 'no-active-DAY-interval'; break; }
    r.instrumentation.now += 1200;
    timer.callback();
    item.observations.push(observe(r, step));
    if (!item.observations.at(-1).window) break;
  }
});
report.sourceAndInputUnchanged = dependencies.every((p, i) => hash(readFileSync(p)) === beforeHashes[i].sha256);
if (!report.sourceAndInputUnchanged) report.failures.push({ error: 'source or input changed' });
report.ok = report.failures.length === 0;
report.summary = report.scenarios.map(({ id, ok, firstMaterialWindowClosedStep, firstOfferRefusedStep, observations, stopReason }) => ({ id, ok, firstMaterialWindowClosedStep, firstOfferRefusedStep, final: observations.at(-1), stopReason: stopReason || null }));
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ...report, scenarios: undefined, reportPath: out }, null, 2));
process.exitCode = report.ok ? 0 : 1;
