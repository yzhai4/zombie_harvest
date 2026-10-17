#!/usr/bin/env node
/** Actual full-inline crop contract checks. Browser IO is controlled; crop
 * resolution, Gate, reducer, SessionController, CommandBus, loader and writer
 * are never replaced. The original fresh04 writer is immutable input. All
 * scene changes below are TEST-ONLY derived controls, not natural gameplay.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const usage = 'node scripts/check-crop-target-v1.mjs --html HTML --out NEW_REPORT_JSON';
const options = {}, args = process.argv.slice(2);
assert.equal(args.length % 2, 0, usage);
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--html', '--out'].includes(args[i]) && args[i + 1] && !options[args[i]], usage);
  options[args[i]] = path.resolve(args[i + 1]);
}
assert.ok(options['--html'] && options['--out'], usage);
assert.ok(!fs.existsSync(options['--out']), 'new report only');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const htmlBytes = fs.readFileSync(options['--html']), html = htmlBytes.toString('utf8');
const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
assert.equal(inline.length, 1, 'one complete inline runtime');
new vm.Script(inline[0], { filename: 'tested-runtime.html' });
const inputRel = 'docs/qa/runs/shortage-choice-v2-20261017/natural-baseline/fresh04/terminal-before-cleanup-save.json';
const inputBytes = fs.readFileSync(path.join(root, inputRel)), inputRaw = inputBytes.toString('utf8');
assert.equal(sha(inputBytes), '0e91022d25944ee63d30f75efb3d0a9e57db795ea5d1708485c0449fb34700a9');
const originalPayload = JSON.parse(inputRaw).payload;
const adapterRel = 'scripts/check-report-recovery.mjs', adapterBytes = fs.readFileSync(path.join(root, adapterRel)), adapter = adapterBytes.toString('utf8');
const start = adapter.indexOf('function runtime(entries = []) {'), end = adapter.indexOf('\nfunction envelope(payload)', start);
assert.ok(start >= 0 && end > start, 'existing complete IO factory markers');
let body = adapter.slice(start, end);
assert.match(html, /class="build-card" data-build="garden"/, 'authored public garden selection card');
const documentMarker = 'getElementById: node, querySelector(selector) { return node(selector); }, querySelectorAll() { return []; }, createElement';
assert.equal(body.split(documentMarker).length, 2);
body = body.replace(documentMarker, 'getElementById: node, querySelector(selector) { return node(selector); }, querySelectorAll(selector) { if (selector === ".build-card") { const card = node("qa-authored-garden-card"); card.dataset.build = "garden"; return [card]; } return []; }, createElement');
const marker = '  const api = context.qa;\n  api.instrumentRendering();';
assert.equal(body.split(marker).length, 2);
body = body.replace(marker, [
  '  vm.runInContext("qa.crop = { renderContext, plant: plantOrHarvest, building: interactBuilding, construct: placeBuilding, selectBuild, terrainAt, isRegionVisible, getBuilding, getResource, getZombie, getNpc, getCampArea, serializeNpc, advance, minute: worldMinute, stopNative: stopWorldSimulation, spend: spendEnergy, execute: executeInteraction, pause: pauseWorld, resolve: typeof resolveCropTarget === \'function\' ? resolveCropTarget : null, gate: typeof cropActionGate === \'function\' ? cropActionGate : null };", context);',
  '  const api = context.qa;',
  '  api.instrumentRendering();'
].join('\n'));
const htmlPath = 'tested-runtime.html', saveKey = 'zombie-harvest-progress-v12';
const factory = new Function('inline', 'htmlPath', 'vm', 'assert', body + '\nreturn runtime;')(inline, htmlPath, vm, assert);

const outputDir = path.join(path.dirname(options['--out']), path.basename(options['--out'], '.json') + '-artifacts');
assert.ok(!fs.existsSync(outputDir), 'new artifact directory only');
fs.mkdirSync(outputDir, { recursive: true });
const artifacts = [], checks = [], failures = [], sourceRefs = [];
function put(rel, bytes, meta = {}) {
  const target = path.join(outputDir, rel);
  assert.ok(!fs.existsSync(target)); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
  const ref = { path: path.basename(outputDir) + '/' + rel.replaceAll('\\', '/'), sha256: sha(Buffer.from(bytes)), ...meta };
  artifacts.push(ref); return ref;
}
sourceRefs.push(put('inputs/source.html', htmlBytes, { kind: 'executed-full-runtime' }));
sourceRefs.push(put('inputs/runner-executed.mjs', fs.readFileSync(new URL(import.meta.url)), { kind: 'executed-checker' }));
sourceRefs.push(put('inputs/io-adapter.mjs', adapterBytes, { kind: 'actual-controlled-io-factory', rootRelativeSource: adapterRel }));
sourceRefs.push(put('inputs/fresh04-terminal-writer.json', inputBytes, { kind: 'unchanged-original-complete-browser-writer', rootRelativeSource: inputRel }));
let current = null, serial = 0;
function test(name, run, classification = 'TEST-ONLY-derived-from-original-writer') {
  current = { name, inputClassification: classification, derivations: [], observations: [] };
  try { run(); checks.push({ name, inputClassification: classification, ok: true }); }
  catch (error) { current.error = error.name + ': ' + error.message; checks.push({ name, inputClassification: classification, ok: false, error: current.error }); failures.push(name); }
  const ref = put('cases/' + String(++serial).padStart(3, '0') + '.json', JSON.stringify(current, null, 2) + '\n', { kind: 'actual-execution-observations' });
  checks.at(-1).artifact = ref.path; current = null;
}
function note(value) { current.observations.push(clone(value)); }
function runtime(raw = inputRaw) {
  const r = factory([[saveKey, raw]]); r.p = r.api.crop;
  assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true, 'real stored input validates');
  assert.equal(r.api.start().ok, true, 'actual startFromSave'); r.p.stopNative();
  assert.equal(r.api.session.mode, 'DAY');
  return r;
}
const plot = r => r.api.state.buildings.find(b => b.id === 'bld-mazjx8');
const resourceKeys = ['wood', 'stone', 'food', 'parts', 'medicine', 'seeds', 'energy', 'hp', 'sanity', 'morale'];
const resources = r => clone(Object.fromEntries(resourceKeys.map(k => [k, r.api.state[k]])));
const protectedFacts = r => clone({ minute: r.p.minute(), resources: resources(r), buildings: r.api.state.buildings, npcs: r.api.state.npcs, campStanding: r.api.state.campStanding, content: r.api.state.contentState });
const events = (r, type, seq = 0) => clone(r.api.state.worldMeta.events.filter(e => e.seq > seq && (!type || e.type === type)));
const commands = r => clone(r.api.state.worldMeta.replay.commands);
function derive(r, description, mutate) { current.derivations.push(description); mutate(r.api.state, r); return r; }
function place(r, x = 7, y = 13) { return derive(r, { playerOnly: { x, y } }, s => Object.assign(s.player, { x, y })); }
function render(r) {
  r.p.renderContext();
  const all = [...r.node('contextActions').innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m => {
    const attrs = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], a[2]]));
    const dataset = Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]));
    return { disabled: /(?:^|\s)disabled(?:\s|$)/.test(m[1]), attrs, dataset, text: m[2] };
  });
  const ui = { title: r.node('contextTitle').textContent, crop: all.find(b => b.dataset.contextAction === 'crop') || null, building: all.find(b => b.dataset.contextAction === 'building') || null, html: r.node('contextActions').innerHTML };
  note({ actualContextRenderer: ui }); return ui;
}
function click(r, button) {
  assert.ok(button && !button.disabled, 'actual public crop button enabled');
  r.emit('contextActions', 'click', { target: { closest: () => button } });
}
function trace(r, beforeSeq, beforeCommands) {
  const value = { events: events(r, null, beforeSeq), commands: commands(r).slice(beforeCommands), resources: resources(r), minute: r.p.minute(), plot: clone(plot(r) || null), toast: r.node('toast').textContent };
  note(value); return value;
}
function success(r, target, operation, invoke) {
  const before = resources(r), beforeMinute = r.p.minute(), beforeTarget = clone(target), seq = r.api.state.worldMeta.eventSeq, count = commands(r).length;
  const result = invoke(); const out = trace(r, seq, count);
  if (result !== undefined) assert.equal(result.ok, true, 'actual wrapper result');
  const receipts = out.events.filter(e => e.type === 'crop.changed'); assert.equal(receipts.length, 1, 'one actual crop success');
  const receipt = receipts[0], proof = receipt.payload;
  assert.equal(proof.proofVersion, 1); assert.equal(proof.buildingId, target.id); assert.equal(proof.buildingType, beforeTarget.type); assert.equal(proof.operation, operation);
  assert.equal(proof.target.id, target.id); assert.deepEqual(proof.target.before, { planted: beforeTarget.planted, ready: beforeTarget.ready, growth: beforeTarget.growth });
  const command = out.commands.find(c => c.commandId === receipt.commandId); assert.ok(command); assert.equal(command.type, 'crop.change'); assert.equal(command.payload.buildingId, target.id);
  assert.equal(receipt.actorId, 'player-1', 'public crop success actor is the player'); assert.equal(command.actorId, 'player-1', 'crop parent replay actor is the player');
  const cost = operation === 'plant' ? 4 : 6;
  assert.equal(proof.payment.cost.energy, cost); assert.equal(proof.payment.cost.seeds || 0, operation === 'plant' ? 1 : 0);
  assert.equal(proof.payment.before.energy, before.energy); assert.equal(proof.payment.after.energy, before.energy - cost);
  assert.equal(proof.resources.before.energy, before.energy); assert.equal(proof.resources.afterPayment.energy, before.energy - cost);
  assert.equal(proof.resources.afterPayment.seeds, before.seeds - (operation === 'plant' ? 1 : 0));
  assert.equal(proof.resources.afterAction.food, before.food + (operation === 'harvest' ? 3 : 0));
  assert.equal(proof.resources.afterAction.medicine, before.medicine + (operation === 'harvest' && beforeTarget.type === 'greenhouse' ? 1 : 0));
  assert.equal(proof.target.afterAction.planted, operation === 'plant'); assert.equal(proof.target.afterAction.ready, false); assert.equal(proof.target.afterAction.growth, 0);
  assert.equal(target.planted, operation === 'plant'); assert.equal(target.ready, false); assert.equal(target.growth, 0);
  assert.equal(proof.target.presentAtCompletion, true); assert.deepEqual(proof.target.atCompletion, { planted: target.planted, ready: target.ready, growth: target.growth });
  assert.equal(r.p.minute() - beforeMinute, 20, 'actual elapsed minutes'); assert.equal(proof.clock.requestedMinutes, 20); assert.equal(proof.clock.elapsedMinutes, 20);
  const children = out.commands.filter(c => c.type === 'world.advance'); assert.equal(children.length, 1); assert.equal(children[0].payload.minutes, 20);
  const times = out.events.filter(e => e.type === 'time.advanced' && e.commandId === children[0].commandId); assert.equal(times.length, 1); assert.equal(times[0].causationId, receipt.commandId); assert.equal(times[0].payload.minutes, 20);
  assert.equal(proof.advance.commandId, children[0].commandId); assert.equal(proof.advance.eventId, times[0].eventId); assert.equal(proof.advance.causationId, receipt.commandId); assert.equal(proof.advance.minutes, 20);
  assert.equal(proof.resources.after.energy, r.api.state.energy); assert.equal(proof.resources.after.food, r.api.state.food); assert.equal(proof.resources.after.seeds, r.api.state.seeds);
  assert.equal(proof.advanceEffects.resourceDelta.energy, proof.resources.after.energy - proof.resources.afterAction.energy);
  assert.equal(proof.advanceEffects.resourceDelta.food, proof.resources.after.food - proof.resources.afterAction.food);
  assert.equal(out.events.filter(e => e.type === 'command.rejected' && e.commandId === receipt.commandId).length, 0);
  return { receipt, proof, before, out };
}
function rejected(r, invoke) {
  const before = protectedFacts(r), seq = r.api.state.worldMeta.eventSeq, count = commands(r).length;
  const result = invoke(); const out = trace(r, seq, count);
  if (result !== undefined) assert.equal(result.ok, false, 'explicit reducer/Gate rejection');
  assert.deepEqual(protectedFacts(r), before, 'rejection preserves resources/time/targets/NPCs/content/standing');
  assert.equal(out.events.filter(e => e.type === 'crop.changed').length, 0, 'no empty success receipt');
  assert.equal(out.events.filter(e => e.type === 'time.advanced').length, 0, 'no time payment');
  assert.equal(out.commands.filter(c => c.type === 'world.advance').length, 0, 'no nested advance');
  return result;
}
function saveReload(r, name) {
  // Reload preserves the actual writer's persistent NPC fields, not unsaved
  // interpolation/combat transients such as prevX/facing/combatClock.
  const durableFacts = value => ({ ...protectedFacts(value), npcs: clone(value.api.state.npcs.map(value.p.serializeNpc)) });
  const before = durableFacts(r), cropHistory = events(r, 'crop.changed');
  assert.equal(r.api.save(), true, 'actual complete writer'); const raw = r.storage.get(saveKey);
  assert.equal(r.api.validate({ raw }).ok, true, 'actual complete output validates');
  put('writers/' + name + '.json', raw, { kind: 'actual-runtime-complete-writer' });
  const written = JSON.parse(raw).payload; assert.deepEqual(written.npcs, before.npcs);
  const reload = runtime(raw); assert.deepEqual(durableFacts(reload), before); assert.deepEqual(events(reload, 'crop.changed'), cropHistory);
  note({ reloadCompared: 'all protected resources/time/buildings/content/standing, exact crop history and complete actual serializeNpc persistent projection; runtime-only animation/combat transients are outside SAVE21' });
  return reload;
}

test('original fresh04 complete writer loads and old empty crop history earns nothing on save/reload', () => {
  const r = runtime(); assert.deepEqual(clone(r.api.state.player), originalPayload.player);
  assert.deepEqual(resources(r), Object.fromEntries(resourceKeys.map(k => [k, originalPayload[k]])));
  const old = events(r, 'crop.changed').find(e => e.eventId === 'evt-000113'); assert.deepEqual(old.payload, {}); assert.equal(old.commandId, 'cmd-000275');
  assert.deepEqual(clone(r.api.state.campStanding), originalPayload.campStanding); assert.equal(plot(r).planted, false);
  const loaded = saveReload(r, 'original-old-empty-history'); assert.equal(events(loaded, 'crop.changed').length, 1); assert.equal(plot(loaded).planted, false);
}, 'unchanged-original-fresh04-complete-writer');

test('original fractional fresh04 public renderer/listener really plants same plot', () => {
  const r = runtime(), ui = render(r); assert.equal(ui.crop?.dataset.buildingId, plot(r).id);
  success(r, plot(r), 'plant', () => click(r, ui.crop)); saveReload(r, 'original-fractional-public-plant');
}, 'unchanged-original-fresh04-complete-writer');
test('public crop receipt and parent replay retain player actor while child clock retains its own causal identity', () => {
  const r = runtime(), seq = r.api.state.worldMeta.eventSeq; click(r, render(r).crop);
  const recent = events(r, null, seq), receipts = recent.filter(e => e.type === 'crop.changed'); assert.equal(receipts.length, 1);
  const receipt = receipts[0], parent = commands(r).filter(c => c.commandId === receipt.commandId); note({ actualPublicCropActor: { receipt, parent, childClock: recent.filter(e => e.type === 'time.advanced') } });
  assert.equal(receipt.actorId, 'player-1', 'public player action must not be attributed to system'); assert.equal(parent.length, 1); assert.equal(parent[0].type, 'crop.change'); assert.equal(parent[0].actorId, 'player-1');
  const clocks = recent.filter(e => e.type === 'time.advanced' && e.causationId === receipt.commandId); assert.equal(clocks.length, 1); assert.equal(clocks[0].actorId, 'system');
  assert.equal(commands(r).filter(c => c.type === 'world.advance' && c.commandId === clocks[0].commandId).length, 1);
}, 'unchanged-original-fresh04-complete-writer');
for (const [name, x, y] of [['integer-north', 7, 13], ['roundoff-west', 5.999999999999996, 14], ['non-roundoff-diagonal', 6.2, 13.2], ['exact-radius-boundary', 7, 12.75]]) {
  test('public crop target at ' + name, () => { const r = place(runtime(), x, y), ui = render(r); success(r, plot(r), 'plant', () => click(r, ui.crop)); });
}
test('outside-radius public action absent and default wrapper refuses without payment', () => {
  const r = place(runtime(), 7, 12.7499999), ui = render(r); assert.ok(!ui.crop || ui.crop.disabled);
  rejected(r, () => r.p.plant(null, { commandId: 'crop-outside-default' }));
});
test('actual resolver and Gate are present and read-only', () => {
  const r = runtime(); assert.equal(typeof r.p.resolve, 'function'); assert.equal(typeof r.p.gate, 'function');
  const before = clone(r.api.state), storage = [...r.storage], tasks = r.tasks.size;
  const resolved = r.p.resolve(), gate = r.p.gate(); assert.equal(resolved.ok, true); assert.equal(resolved.garden, plot(r)); assert.equal(gate.ok, true); assert.equal(gate.garden, plot(r));
  assert.deepEqual(clone(r.api.state), before); assert.deepEqual([...r.storage], storage); assert.equal(r.tasks.size, tasks);
});
for (const type of ['garden', 'greenhouse']) for (const operation of ['plant', 'harvest']) test(type + ' actual ' + operation + ' payment/production/20min proof and reload', () => {
  const r = place(runtime()); derive(r, { cropType: type, operation }, () => Object.assign(plot(r), { type, planted: operation === 'harvest', ready: operation === 'harvest', growth: operation === 'harvest' ? 2 : 0 }));
  const ui = render(r); success(r, plot(r), operation, () => click(r, ui.crop)); saveReload(r, type + '-' + operation);
});
for (const [name, mutate] of [
  ['growing', r => Object.assign(plot(r), { planted: true, ready: false, growth: 1 })],
  ['no-seeds', r => { r.api.state.seeds = 0; }],
  ['low-energy-plant', r => { r.api.state.energy = 3; }],
  ['low-energy-harvest', r => { Object.assign(plot(r), { planted: true, ready: true, growth: 2 }); r.api.state.energy = 5; }]
]) test('public disabled and real reducer refuses ' + name, () => {
  const r = place(runtime()); derive(r, name, () => mutate(r)); assert.equal(render(r).crop?.disabled, true); rejected(r, () => r.p.plant(plot(r), { commandId: 'crop-' + name }));
});
test('harvest requires no seed stock', () => {
  const r = place(runtime()); derive(r, 'mature garden, seeds0', s => { s.seeds = 0; Object.assign(plot(r), { planted: true, ready: true, growth: 2 }); });
  success(r, plot(r), 'harvest', () => click(r, render(r).crop));
});
for (const reverse of [false, true]) test('two legal plots preserve authored array order across UI and default ' + reverse, () => {
  const r = place(runtime(), 7, 13.5); derive(r, { addNearbyPlot: 'crop-a-farther', reverse }, s => { s.buildings.push({ ...clone(plot(r)), id: 'crop-a-farther', x: 6.5, y: 13 }); if (reverse) s.buildings.reverse(); });
  const chosen = r.api.state.buildings.find(b => ['garden', 'greenhouse'].includes(b.type) && Math.hypot(b.x - 7, b.y - 13.5) <= 1.25);
  const ui = render(r); assert.equal(ui.crop?.dataset.buildingId, chosen.id); success(r, chosen, 'plant', () => r.p.plant());
  assert.equal(r.api.state.buildings.find(b => ['garden', 'greenhouse'].includes(b.type) && b !== chosen).planted, false);
});
for (const reverse of [false, true]) test('equidistant plots use same authored first target for public click ' + reverse, () => {
  const r = place(runtime(), 6, 14); derive(r, { equalDistancePlot: 'aaa-crop', reverse }, s => { s.buildings.push({ ...clone(plot(r)), id: 'aaa-crop', x: 6, y: 13 }); if (reverse) s.buildings.reverse(); });
  const target = reverse ? r.api.state.buildings.find(b => b.id === 'aaa-crop') : plot(r), ui = render(r); assert.equal(ui.crop?.dataset.buildingId, target.id);
  success(r, target, 'plant', () => click(r, ui.crop)); assert.equal(r.api.state.buildings.find(b => ['garden', 'greenhouse'].includes(b.type) && b !== target).planted, false);
});
test('first growing crop does not silently select later unplanted plot', () => {
  const r = place(runtime(), 7, 13.5); derive(r, 'near growing / farther unplanted', s => { Object.assign(plot(r), { planted: true, growth: 1 }); s.buildings.push({ ...clone(plot(r)), id: 'crop-alternative', x: 6.5, y: 13, planted: false, growth: 0 }); });
  const ui = render(r); assert.equal(ui.crop?.dataset.buildingId, plot(r).id); assert.equal(ui.crop.disabled, true); rejected(r, () => r.p.plant());
});
test('rendered target remains bound when another plot becomes nearer before click', () => {
  const r = place(runtime(), 7, 13.5); derive(r, 'second still legal plot', s => s.buildings.push({ ...clone(plot(r)), id: 'crop-other', x: 6.5, y: 13 })); const ui = render(r);
  place(r, 6.6, 13.2); success(r, plot(r), 'plant', () => click(r, ui.crop)); assert.equal(r.api.state.buildings.find(b => b.id === 'crop-other').planted, false);
});
test('rendered target removed before click refuses instead of switching plots', () => {
  const r = place(runtime()); const ui = render(r); derive(r, 'remove rendered plot, add other legal plot', s => { s.buildings = s.buildings.filter(b => b.id !== 'bld-mazjx8'); s.buildings.push({ x: 7, y: 14, id: 'crop-replacement', type: 'garden', planted: false, ready: false, growth: 0 }); });
  rejected(r, () => click(r, ui.crop));
});
for (const [name, target] of [
  ['unknown-id', () => 'crop-unknown-id'],
  ['expired-object', r => { const old = plot(r); r.api.state.buildings = r.api.state.buildings.filter(b => b !== old); return old; }],
  ['detached-same-id', r => clone(plot(r))],
  ['wrong-type-live', r => r.api.state.buildings.find(b => b.type === 'shelter')],
  ['wrong-type-id', r => r.api.state.buildings.find(b => b.type === 'shelter').id],
  ['far-live', r => { Object.assign(r.api.state.player, { x: 11, y: 11 }); return plot(r); }],
  ['far-id', r => { Object.assign(r.api.state.player, { x: 11, y: 11 }); return plot(r).id; }],
  ['duplicate-id-live', r => { r.api.state.buildings.push(clone(plot(r))); return plot(r); }],
  ['duplicate-id-string', r => { r.api.state.buildings.push(clone(plot(r))); return plot(r).id; }]
]) test('real target Gate rejects ' + name + ' without fallback', () => {
  const r = runtime(); let preferred; derive(r, name, () => { preferred = target(r); }); rejected(r, () => r.p.plant(preferred, { commandId: 'crop-invalid-' + name }));
});
test('explicit exact ID and existing E interaction path both use real live crop', () => {
  const a = runtime(); success(a, plot(a), 'plant', () => a.p.plant(plot(a).id, { commandId: 'crop-exact-id' }));
  const b = runtime(); success(b, plot(b), 'plant', () => { assert.equal(b.p.execute({ kind: 'crop', item: plot(b) }), true); });
});
test('actual public keyboard E focus then E executes crop without privileged target call', () => {
  const r = runtime(); render(r);
  success(r, plot(r), 'plant', () => {
    const before = protectedFacts(r); r.emit('document', 'keydown', { key: 'e', repeat: false });
    assert.deepEqual(protectedFacts(r), before, 'first public E only focuses');
    r.emit('document', 'keydown', { key: 'e', repeat: false });
  });
});
for (const type of ['garden', 'greenhouse']) test('public use-building farm entry routes once to crop for ' + type, () => {
  const r = runtime(); derive(r, { publicFarmBuildingType: type }, () => { plot(r).type = type; });
  const ui = render(r); assert.equal(ui.building?.dataset.buildingId, plot(r).id);
  const { out } = success(r, plot(r), 'plant', () => click(r, ui.building)); assert.equal(out.events.filter(e => e.type === 'building.interacted').length, 0);
});
test('live farm interactBuilding wrapper routes to same crop command and supplied ID', () => {
  const r = runtime(), id = 'crop-building-route'; const { receipt, out } = success(r, plot(r), 'plant', () => r.p.building(plot(r), { commandId: id }));
  assert.equal(receipt.commandId, id); assert.equal(out.events.filter(e => e.type === 'building.interacted').length, 0); assert.equal(out.commands.filter(c => c.type === 'building.interact').length, 0);
});
test('public use-building stale farm ID never redirects to a replacement farm', () => {
  const r = runtime(), ui = render(r); derive(r, 'remove rendered farm and add live replacement', s => { s.buildings = s.buildings.filter(b => b.id !== 'bld-mazjx8'); s.buildings.push({ x: 7, y: 14, id: 'crop-replacement', type: 'garden', planted: false, ready: false, growth: 0 }); });
  rejected(r, () => click(r, ui.building));
});
for (const action of ['crop', 'building']) test('rendered ' + action + ' farm changed to wall cannot become inspect success', () => {
  const r = runtime(), ui = render(r), button = ui[action]; assert.equal(button?.dataset.cropTarget, 'true');
  derive(r, 'rendered farm type changed to wall', () => { plot(r).type = 'wall'; plot(r).hp = 3; });
  rejected(r, () => click(r, button));
});
test('real newly constructed garden is immediately usable without reload or ID repair', () => {
  const r = runtime(), control = runtime();
  const oldIds = r.api.state.buildings.map(b => b.id), npcIds = r.api.state.npcs.map(n => n.id);
  let site = null;
  for (let y = 8; y < 18 && !site; y++) for (let x = 2; x < 16 && !site; x++) {
    if (Math.hypot(x - 7, y - 14) <= 3 || !r.p.isRegionVisible(x, y) || r.p.terrainAt(x, y) === 'water') continue;
    if ([r.p.getBuilding, r.p.getResource, r.p.getZombie, r.p.getNpc, r.p.getCampArea].some(read => read(x, y))) continue;
    site = { x, y };
  }
  assert.ok(site, 'a disclosed clear site exists in original map'); place(r, site.x, site.y - 1); place(control, site.x, site.y - 1);
  current.derivations.push({ selectedExistingClearConstructionSite: site, noBuildingIdInjection: true, noReloadBeforeCrop: true });
  r.emit('document', 'keydown', { key: 'c', repeat: false }); r.emit('qa-authored-garden-card', 'click');
  assert.equal(r.api.state.selectedBuild, 'garden'); const before = resources(r), minute = r.p.minute(), seq = r.api.state.worldMeta.eventSeq, commandCount = commands(r).length;
  r.emit('world', 'click', { target: { closest: () => ({ dataset: { x: String(site.x), y: String(site.y) } }) } });
  const builtTrace = trace(r, seq, commandCount), added = r.api.state.buildings.filter(b => !oldIds.includes(b.id));
  assert.equal(r.api.state.buildings.length, oldIds.length + 1); assert.equal(added.length, 1);
  const garden = added[0]; assert.equal(garden.type, 'garden'); assert.equal(garden.x, site.x); assert.equal(garden.y, site.y); assert.equal(typeof garden.id, 'string'); assert.ok(garden.id);
  const allIds = [...r.api.state.buildings, ...r.api.state.resources, ...r.api.state.landmarks, ...r.api.state.npcs, ...r.api.state.worldZombies].map(e => e.id).filter(Boolean);
  assert.equal(allIds.filter(id => id === garden.id).length, 1); assert.deepEqual(r.api.state.buildings.filter(b => b !== garden).map(b => b.id), oldIds); assert.deepEqual(r.api.state.npcs.map(n => n.id), npcIds);
  assert.equal(r.api.state.wood, before.wood - 5); assert.equal(r.api.state.stone, before.stone - 2); assert.equal(r.api.state.seeds, before.seeds); assert.equal(r.p.minute() - minute, 45);
  assert.equal(control.p.advance(45).ok, true); assert.equal(r.api.state.energy, control.api.state.energy, 'construction charges no extra energy beyond real clock recovery');
  const built = builtTrace.events.filter(e => e.type === 'building.constructed'); assert.equal(built.length, 1);
  const buildTime = builtTrace.events.filter(e => e.type === 'time.advanced' && e.causationId === built[0].commandId); assert.equal(buildTime.length, 1); assert.equal(buildTime[0].payload.minutes, 45);
  let unchanged = protectedFacts(r), endSeq = r.api.state.worldMeta.eventSeq; assert.equal(r.p.construct(site.x, site.y, { commandId: built[0].commandId }).duplicate, true); assert.deepEqual(protectedFacts(r), unchanged); assert.equal(events(r, null, endSeq).length, 0);
  const ui = render(r); assert.equal(ui.crop?.dataset.buildingId, garden.id); success(r, garden, 'plant', () => click(r, ui.crop)); assert.equal(r.p.minute() - minute, 65);
  assert.equal(r.api.state.seeds, before.seeds - 1); assert.deepEqual(r.api.state.npcs.map(n => n.id), npcIds); assert.deepEqual(r.api.state.buildings.filter(b => b !== garden).map(b => b.id), oldIds);
  saveReload(r, 'constructed-and-planted-same-session');
});
test('existing construction overlap rule still prevents an occupied plot build', () => {
  const r = runtime(); r.emit('document', 'keydown', { key: 'c', repeat: false }); r.emit('qa-authored-garden-card', 'click');
  const before = protectedFacts(r), seq = r.api.state.worldMeta.eventSeq;
  r.emit('world', 'click', { target: { closest: () => ({ dataset: { x: '7', y: '14' } }) } });
  assert.deepEqual(protectedFacts(r), before); assert.equal(events(r, 'time.advanced', seq).length, 0);
  note({ existingConstructionNoOpScope: 'no new building/resource/time; this check does not invent a new construction-rejection receipt contract' });
});
test('no nearby target returns explicit rejection', () => {
  const r = place(runtime(), 0, 0); rejected(r, () => r.p.plant(null, { commandId: 'crop-no-target' }));
});
for (const phase of ['BATTLE', 'REPORT', 'LOSS', 'RECOVERY', 'SAVING', 'EXITING']) test('actual SessionController Gate refuses ' + phase, () => {
  const r = runtime(); derive(r, { explicitSessionPhaseControl: phase }, s => { r.api.session.mode = phase; if (phase === 'BATTLE') s.night = true; });
  rejected(r, () => r.p.plant(plot(r), { commandId: 'crop-phase-' + phase }));
});
test('real paused clock refuses before crop payment', () => {
  const r = runtime(); r.p.pause(true); rejected(r, () => r.p.plant(plot(r), { commandId: 'crop-paused' }));
});
for (const [name, mutate] of [
  ['unknown-paused', s => { s.worldMeta.clock.paused = null; }],
  ['string-rate', s => { s.worldMeta.clock.rate = '1'; }],
  ['nonintegral-elapsed', s => { s.worldMeta.clock.rate = 1.01; }],
  ['unknown-current-minute', s => { s.minute = NaN; }]
]) test('unknown or unsupported clock rejects before payment ' + name, () => {
  const r = runtime(); derive(r, { invalidClockControl: name }, mutate); rejected(r, () => r.p.plant(plot(r), { commandId: 'crop-clock-' + name }));
});
test('same command and writer reload never pay or advance twice', () => {
  const r = runtime(), id = 'crop-idempotent'; success(r, plot(r), 'plant', () => r.p.plant(plot(r), { commandId: id }));
  let before = protectedFacts(r), seq = r.api.state.worldMeta.eventSeq; assert.equal(r.p.plant(plot(r), { commandId: id }).duplicate, true); assert.deepEqual(protectedFacts(r), before); assert.equal(events(r, null, seq).length, 0);
  const reload = saveReload(r, 'idempotent-planted'); before = protectedFacts(reload); seq = reload.api.state.worldMeta.eventSeq;
  assert.equal(reload.p.plant(plot(reload), { commandId: id }).duplicate, true); assert.deepEqual(protectedFacts(reload), before); assert.equal(events(reload, null, seq).length, 0);
});
test('successful command remains duplicate after its target is removed', () => {
  const r = runtime(), id = 'crop-removed-duplicate', target = plot(r); success(r, target, 'plant', () => r.p.plant(target, { commandId: id }));
  derive(r, 'remove already executed target', s => { s.buildings = s.buildings.filter(b => b !== target); });
  const before = protectedFacts(r), seq = r.api.state.worldMeta.eventSeq; assert.equal(r.p.plant(target, { commandId: id }).duplicate, true); assert.deepEqual(protectedFacts(r), before); assert.equal(events(r, null, seq).length, 0);
});
test('rejected command duplicate does not become a later crop success', () => {
  const r = runtime(), id = 'crop-rejected-id'; rejected(r, () => r.p.plant('unknown-crop-id', { commandId: id }));
  const before = protectedFacts(r), seq = r.api.state.worldMeta.eventSeq, result = r.p.plant(plot(r), { commandId: id });
  assert.equal(result.duplicate, true); assert.deepEqual(protectedFacts(r), before); assert.equal(events(r, null, seq).length, 0); assert.equal(events(r, 'crop.changed').length, 1, 'only original old empty history exists');
});
for (const [name, seq, explicit, shouldWork] of [
  ['automatic-parent-and-child-last-two', Number.MAX_SAFE_INTEGER - 2, false, true],
  ['automatic-parent-no-child', Number.MAX_SAFE_INTEGER - 1, false, false],
  ['opaque-parent-last-child', Number.MAX_SAFE_INTEGER - 1, true, true],
  ['opaque-parent-no-child', Number.MAX_SAFE_INTEGER, true, false]
]) test('MAX_SAFE budget ' + name, () => {
  const r = runtime(); derive(r, { commandSequenceBudget: seq, opaqueParent: explicit }, s => { s.worldMeta.commandSeq = seq; });
  const invoke = () => r.p.plant(plot(r), explicit ? { commandId: 'crop-budget-opaque' } : {});
  if (shouldWork) { success(r, plot(r), 'plant', invoke); saveReload(r, 'budget-' + name); } else rejected(r, invoke);
});
test('gross payment remains distinct from actual natural energy recovery', () => {
  const r = runtime(), control = runtime(), before = resources(r);
  const { proof } = success(r, plot(r), 'plant', () => r.p.plant(plot(r)));
  assert.equal(control.p.spend(4), true); const afterActualPayment = control.api.state.energy; assert.equal(afterActualPayment, before.energy - 4);
  assert.equal(control.p.advance(20).ok, true);
  assert.equal(proof.payment.after.energy, afterActualPayment); assert.equal(proof.advanceEffects.resourceDelta.energy, control.api.state.energy - afterActualPayment);
  assert.equal(r.api.state.energy, control.api.state.energy); assert.equal(proof.advanceEffects.resourceDelta.energy, 1, 'this original469→489 interval crosses one natural recovery boundary');
});

const report = {
  schema: 'CropTargetSourceChecksV1', runner: 'check-crop-target-v1', sourceHtmlSha256: sha(htmlBytes), checkerSha256: sha(fs.readFileSync(new URL(import.meta.url))), ioAdapterSha256: sha(adapterBytes), originalWriterSha256: sha(inputBytes),
  sourceRefs, artifacts, count: checks.length, passed: checks.filter(c => c.ok).length, ok: failures.length === 0, failures, checks,
  scope: { source: 'complete tested inline; actual helpers, crop Gate/reducer, SessionController/CommandBus, original context renderer/listener, keyboard and map/build-card listeners, actual loader/writer', io: 'controlled DOM nodes and listeners including the source-authored garden card, local/session storage Maps, Date/performance, queued timers/RAF; initial unrelated Canvas render skipped and other Canvas/world/HUD/context renders suppressed after capturing the tested actual context renderer', receiptsFabricated: false, derivedControls: 'all mutations explicitly listed per case after loading the complete original writer; malformed target/phase/budget controls are not claimed as legal natural inputs', oldHistory: 'actual existing empty crop.changed retained unchanged; no invented command/event history' },
  browserStarted: false, naturalGameplay: false, balanceValidated: false
};
fs.writeFileSync(options['--out'], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ sourceHash: report.sourceHtmlSha256, checkerHash: report.checkerSha256, count: report.count, passed: report.passed, ok: report.ok, failures }, null, 2));
process.exitCode = report.ok ? 0 : 1;
