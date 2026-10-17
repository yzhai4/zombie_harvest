#!/usr/bin/env node
/**
 * A bounded controlled source experiment, not a green gameplay/balance test.
 * Complete old writer -> declared offline scene -> actual loader -> one actual
 * shortage episode -> actual writer -> four identical branch inputs. All game
 * effects, Gates, choices, public gather and one-minute simulation are source.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const usage = 'node scripts/probe-food-shortage-strategies-v1.mjs --out NEW_PRIVATE_REPORT [--html ABSOLUTE_HTML]';
const args = process.argv.slice(2), options = {};
assert.equal(args.length % 2, 0, usage);
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--out', '--html'].includes(args[i]) && args[i + 1] && !options[args[i]], usage);
  options[args[i]] = path.resolve(args[i + 1]);
}
assert.ok(options['--out'], usage); assert.ok(!fs.existsSync(options['--out']), 'report must be new');
const htmlPath = options['--html'] || path.join(root, 'dist/index.html');
const sha = value => createHash('sha256').update(value).digest('hex');
const bytes = fs.readFileSync(htmlPath), sourceHash = sha(bytes), source = bytes.toString('utf8');
assert.equal(sourceHash, '32f911f69a6a962ae69a0325afcffd1c5d6d923c0efe1fb0ca8787c1959d9fae', 'this experiment is registered for the frozen source only');
const adapterPath = path.join(root, 'scripts/check-report-recovery.mjs'), adapterBytes = fs.readFileSync(adapterPath), adapter = adapterBytes.toString('utf8');
const inline = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
assert.equal(inline.length, 1); new vm.Script(inline[0]);
const begin = adapter.indexOf('function runtime(entries = []) {'), end = adapter.indexOf('\nfunction envelope(payload)', begin);
assert.ok(begin >= 0 && end > begin);
let body = adapter.slice(begin, end);
const collectionMarker = 'appendChild(child) { this.children.push(child); }';
assert.equal(body.split(collectionMarker).length, 2);
body = body.replace(collectionMarker, collectionMarker + ', replaceChildren(...children) { this.children = [...children]; }');
const marker = '  const api = context.qa;\n  api.instrumentRendering();';
assert.equal(body.split(marker).length, 2);
body = body.replace(marker, `
  vm.runInContext(\`qa.foodProbe = {
    minute: worldMinute, foodSituation, registry: ContentRegistry,
    token: contentEpisodeExpectedToken, choiceGate: contentChainChoiceGateRuntime,
    definitionGate: contentChainDefinitionGate, resolve: resolveContentChainCommand,
    context: renderContext, renderEvent, gather, harvest: plantOrHarvest, advance,
    stopNativeClock: stopWorldSimulation, role: npcFulfillsRole,
    selectChain() { eventPanelSelection = 'chain:zh-food-shortage-001'; eventPanelReceipt = null; },
    rationCalls: []
  };
  // Observation tap: the original source ration function is called once with
  // the original arguments. No ration formula, return or state is replaced.
  const probeOriginalRation = chargeDailyRation;
  chargeDailyRation = function(...args) {
    const before = { minute: worldMinute(), food: state.food, lastRationDay: state.world.lastRationDay, collapse: state.contentState.meters.campCollapse };
    const result = probeOriginalRation(...args);
    qa.foodProbe.rationCalls.push({ before, returned: result, after: { minute: worldMinute(), food: state.food, lastRationDay: state.world.lastRationDay, collapse: state.contentState.meters.campCollapse } });
    return result;
  };\`, context);
  const api = context.qa;
  api.instrumentRendering();`);
const saveKey = 'zombie-harvest-progress-v12';
const factory = new Function('inline', 'htmlPath', 'vm', 'assert', 'saveKey', 'URLSearchParams', body + '\nreturn runtime;')(inline, htmlPath, vm, assert, saveKey, URLSearchParams);
const plain = value => JSON.parse(JSON.stringify(value));
const fixtureMetaPath = 'scripts/fixtures/npc-threat-attention-v1/capture-meta.json';
const fixtureMeta = JSON.parse(fs.readFileSync(path.join(root, fixtureMetaPath), 'utf8'));
const originalBytes = fs.readFileSync(path.join(root, fixtureMeta.fixture.path));
assert.equal(sha(originalBytes), fixtureMeta.fixture.sha256);
const originalRaw = originalBytes.toString('utf8'), originalPayload = JSON.parse(originalRaw).payload;
const chainId = 'zh-food-shortage-001', cacheFlag = 'zh-shortage-cache-retrieved', berryId = 'res-12yv3vn';
const outputDir = path.join(path.dirname(options['--out']), path.basename(options['--out'], '.json') + '-artifacts');
assert.ok(!fs.existsSync(outputDir)); fs.mkdirSync(outputDir);
const artifacts = [], branches = [], diagnostics = [], methodChecks = [], failures = [];
function artifact(name, text, kind, extra = {}) {
  const leaf = name + '.json'; assert.ok(!fs.existsSync(path.join(outputDir, leaf)));
  fs.writeFileSync(path.join(outputDir, leaf), text);
  const item = { name, path: path.basename(outputDir) + '/' + leaf, sha256: sha(Buffer.from(text)), kind, ...extra };
  artifacts.push(item); return item;
}
function load(raw) {
  const r = factory([[saveKey, raw]]); r.p = r.api.foodProbe;
  const validation = r.api.validate({ raw, sourceCategory: 'primary' }); assert.equal(validation.ok, true, 'strict input writer validation: ' + validation.reason);
  assert.equal(r.api.start().ok, true); r.p.stopNativeClock(); return r;
}
function actualSave(r, name) {
  assert.equal(r.api.save(), true, 'actual source writer'); const raw = r.storage.get(saveKey);
  const validation = r.api.validate({ raw, sourceCategory: 'primary' }); assert.equal(validation.ok, true, 'strict actual writer output: ' + validation.reason);
  artifact(name, raw, 'actual-source-writer', { receiptFabricated: false }); return raw;
}
function check(name, run) { try { run(); methodChecks.push({ name, ok: true }); } catch (error) { methodChecks.push({ name, ok: false, error: `${error.name}: ${error.message}` }); failures.push(name); } }
function liveEvents(r, after = 0) { return plain(r.api.state.worldMeta.events.filter(e => e.seq > after)); }
function metrics(r) {
  const s = r.api.state, def = r.p.registry.get('eventChain', chainId), active = s.contentState.activeChains[chainId] || null;
  return plain({
    calendar: { day: s.day, hour: s.hour, minute: s.minute, total: r.p.minute() },
    resources: Object.fromEntries(['food', 'energy', 'hp', 'sanity', 'wood', 'stone', 'parts', 'medicine', 'seeds', 'morale'].map(k => [k, s[k]])),
    foodSituation: r.p.foodSituation(), meters: s.contentState.meters, frontier: { exposure: s.world.frontierExposure, clock: s.world.frontierClock },
    world: s.world, episode: active, completedEpisodes: s.contentState.completedChains.filter(id => id.startsWith(chainId)), cacheUsed: s.contentState.flags[cacheFlag] === true,
    choices: def.nodes[0].choices.map(choice => ({ id: choice.id, gate: r.p.choiceGate(def, choice, { actorId: active?.actorId || 'player-1' }) })),
    currentStartGate: r.p.definitionGate(def, { actorId: 'player-1' }),
    quartermaster: s.npcs.filter(n => r.p.role(n, 'quartermaster')).map(n => ({ id: n.id, hp: n.hp, lifeState: n.lifeState, actingRole: n.actingRole, supportRequested: n.supportRequested, garrisonedOutpostId: n.garrisonedOutpostId || null })),
    npcs: s.npcs.map(n => ({ id: n.id, hp: n.hp, lifeState: n.lifeState, x: n.x, y: n.y, actingRole: n.actingRole, presence: n.garrisonedOutpostId || 'camp', needs: n.needs, needClock: n.needClock, sanity: n.sanity, scheduleState: n.scheduleState })),
    enemies: s.worldZombies.map(z => ({ id: z.id, x: z.x, y: z.y, hp: z.hp, kind: z.kind, aiState: z.aiState, targetId: z.perception?.targetId || null })),
    berry: s.resources.find(resource => resource.id === berryId), plan: { status: s.contentState.planMeeting.status, selectedId: s.contentState.planMeeting.selectedId },
    eventSeq: s.worldMeta.eventSeq,
  });
}
function display(r) {
  r.p.selectChain(); r.p.renderEvent();
  return plain({ title: r.node('eventTitle').textContent, text: r.node('eventText').textContent, a: { disabled: r.node('eventChoiceA').disabled, dataset: r.node('eventChoiceA').dataset, html: r.node('eventChoiceA').innerHTML }, b: { disabled: r.node('eventChoiceB').disabled, dataset: r.node('eventChoiceB').dataset, html: r.node('eventChoiceB').innerHTML } });
}
function choose(r, choiceId) {
  const before = metrics(r), ui = display(r), id = choiceId === 'ration' ? 'eventChoiceA' : 'eventChoiceB', seq = r.api.state.worldMeta.eventSeq;
  assert.equal(r.node(id).disabled, false, 'actual renderer enables intended choice'); r.emit(id, 'click');
  const events = liveEvents(r, seq); assert.equal(events.filter(e => e.type === 'content.chain.resolved' && e.defId === chainId).length, 1, 'real source choice resolution receipt');
  return { kind: 'actual-public-event-button', choiceId, ui, before, after: metrics(r), events };
}
function gatherOnce(r) {
  const before = metrics(r), seq = r.api.state.worldMeta.eventSeq; r.p.context();
  const html = r.node('contextActions').innerHTML; assert.match(html, /data-context-action="gather"/, 'actual public context offers nearby gather');
  const node = r.node('TEST-ONLY-gather-target'); node.dataset.contextAction = 'gather'; node.closest = selector => selector === '[data-context-action]' ? node : null;
  r.emit('contextActions', 'click', { target: node });
  const after = metrics(r), events = liveEvents(r, seq);
  assert.equal(after.berry.amount, before.berry.amount - 1, 'same finite authored resource consumed');
  assert.equal(after.calendar.total - before.calendar.total, 30, 'original public gather elapsed time');
  assert.equal(events.filter(e => e.type === 'resource.collected').length, 1);
  return { kind: 'actual-public-context-gather', publicContextHtml: html, before, after, targetWitness: { id: before.berry.id, amountBefore: before.berry.amount, amountAfter: after.berry.amount }, events };
}
function toMidnight(r, horizon, timeline) {
  let steps = 0;
  while (r.p.minute() < horizon && steps < 40) {
    assert.equal(r.api.session.mode, 'DAY'); assert.equal(r.api.state.gameOver, null);
    const before = metrics(r); r.instrumentation.now += 1200; const result = r.p.advance(1);
    assert.equal(result.ok, true); const after = metrics(r); assert.equal(after.calendar.total - before.calendar.total, 1, 'no skipped calendar minutes');
    timeline.push({ kind: 'actual-advance-one-minute', beforeMinute: before.calendar.total, afterMinute: after.calendar.total, foodBefore: before.resources.food, foodAfter: after.resources.food, energyBefore: before.resources.energy, energyAfter: after.resources.energy, hpBefore: before.resources.hp, hpAfter: after.resources.hp, commandId: result.commandId, eventId: result.event?.eventId });
    steps += 1;
  }
  assert.equal(r.p.minute(), horizon, 'first real midnight exactly, no assignment'); return steps;
}

let baselineRaw = null, baselineMetrics = null, originalEpisode = null;
check('original immutable full writer validates and conserves identities/resources through actual loader', () => {
  const r = load(originalRaw); assert.deepEqual(plain(r.api.state.npcs.map(n => n.id)), originalPayload.npcs.map(n => n.id));
  for (const key of ['food', 'energy', 'hp', 'wood', 'stone', 'parts']) assert.equal(r.api.state[key], originalPayload[key]);
});
check('declared scene boots, source starts an eligible shortage episode, and source writer freezes the common input', () => {
  const p = plain(originalPayload);
  Object.assign(p, { day: 1, hour: 23, minute: 20, food: 2, energy: 53, hp: 52, night: false, nightBattle: null, gameOver: null });
  p.player.x = 2; p.player.y = 9; p.world.totalMinutes = 1400; p.world.lastRationDay = 1; p.world.lastDailyUpkeepDay = 1;
  p.contentState.meters.campCollapse = 10; p.contentState.meters.resonancePressure = 25;
  p.worldMeta.clock.paused = false; p.worldMeta.clock.rate = 1;
  // Preserve all original identities, plan, map supplies and enemies. Moderate
  // needs isolate one calendar ration without autonomous snack timing as a
  // confound; these inputs are declared, not claimed as natural progression.
  p.npcs.forEach(n => { n.needs = { ...n.needs, hunger: 20, fatigue: 25, stress: 15, energy: 70, social: 20, safety: 20 }; n.needClock = 0; });
  assert.equal(p.contentState.flags[cacheFlag], undefined); assert.equal(p.contentState.activeChains[chainId], undefined);
  const signer = factory(), raw = JSON.stringify({ ...p, payload: p, checksum: signer.api.hash(p), savedAt: 1400 });
  artifact('declared-derived-boot-input', raw, 'offline-derived-complete-old-writer', { receiptFabricated: false });
  const r = load(raw); assert.equal(r.api.state.worldZombies.length, originalPayload.worldZombies.length);
  assert.equal(r.p.registry.startChain(chainId).ok, true); baselineMetrics = metrics(r); originalEpisode = baselineMetrics.episode;
  assert.equal(baselineMetrics.foodSituation.dailyNeed, 3); assert.equal(baselineMetrics.currentStartGate.ok, true);
  assert.ok(baselineMetrics.quartermaster.some(n => n.id === 'quartermaster' && n.lifeState === 'healthy'));
  assert.equal(baselineMetrics.choices.find(c => c.id === 'forage').gate.ok, true);
  baselineRaw = actualSave(r, 'common-episode-baseline');
});
const rawStates = {};
if (baselineRaw) for (const [id, label] of [['A', 'immediate-ration'], ['B', 'immediate-cache-forage'], ['C', 'defer-and-one-real-berry-gather'], ['D', 'defer-without-replenishment']]) {
  check(`branch ${id} executes only its bounded strategy and reaches the first real midnight`, () => {
    const r = load(baselineRaw), initial = metrics(r), afterSeq = r.api.state.worldMeta.eventSeq, timeline = [], actions = [];
    assert.deepEqual(initial, baselineMetrics, 'same actual saved start for every branch');
    actualSave(r, id + '-before-action');
    if (id === 'A') actions.push(choose(r, 'ration'));
    if (id === 'B') actions.push(choose(r, 'forage'));
    if (id === 'C') {
      actions.push(gatherOnce(r)); const inspection = display(r), afterGather = metrics(r);
      rawStates.CAfterGather = actualSave(r, 'C-after-real-gather-before-midnight');
      diagnostics.push({ name: 'C-after-gather-pending-ui', observationOnly: true, metrics: afterGather, ui: inspection, originalEpisode });
    }
    const afterAction = metrics(r); actualSave(r, id + '-after-action');
    const waitSteps = toMidnight(r, 1440, timeline), final = metrics(r), finalRaw = actualSave(r, id + '-first-midnight');
    rawStates[id] = finalRaw;
    branches.push({ id, label, inputSha256: sha(Buffer.from(baselineRaw)), initial, actions, afterAction, final, timeline, waitSteps, rationCalls: plain(r.p.rationCalls), events: liveEvents(r, afterSeq), finalWriterSha256: sha(Buffer.from(finalRaw)), methodStatus: 'COMPLETE_TO_FIRST_REAL_MIDNIGHT', balanceVerdict: 'NOT_ESTABLISHED' });
  });
}
if (rawStates.CAfterGather) check('separate C probe observes whether the original choice remains possible after replenishment', () => {
  const r = load(rawStates.CAfterGather), before = metrics(r), result = choose(r, 'forage'), after = metrics(r);
  diagnostics.push({ name: 'C-separate-post-gather-choice', outsideMainComparison: true, before, result, after, sourceWriter: actualSave(r, 'probe-C-then-forage') && 'probe-C-then-forage' });
});
if (rawStates.B) check('separate B probe observes permanent cache denial in the next actual episode after writer reload', () => {
  const r = load(rawStates.B), before = metrics(r), ui = display(r), definition = r.p.registry.get('eventChain', chainId), choice = definition.nodes[0].choices.find(c => c.id === 'forage');
  const gate = r.p.choiceGate(definition, choice, { actorId: before.episode?.actorId || 'player-1' });
  const seq = r.api.state.worldMeta.eventSeq, result = r.p.resolve(chainId, before.episode.nodeId, 'forage', { commandId: 'probe-cache-reuse', ...r.p.token(before.episode) });
  diagnostics.push({ name: 'B-cache-finite-next-episode', outsideMainComparison: true, before, ui, gate, actualCommand: plain(result), after: metrics(r), events: liveEvents(r, seq) });
  actualSave(r, 'probe-B-cache-reuse-rejection');
});
const byId = Object.fromEntries(branches.map(b => [b.id, b]));
const comparisons = byId.A && byId.B && byId.C && byId.D ? {
  horizonMinute: 1440,
  AminusD: { food: byId.A.final.resources.food - byId.D.final.resources.food, energy: byId.A.final.resources.energy - byId.D.final.resources.energy, hp: byId.A.final.resources.hp - byId.D.final.resources.hp, collapse: byId.A.final.meters.campCollapse - byId.D.final.meters.campCollapse, resonance: byId.A.final.meters.resonancePressure - byId.D.final.meters.resonancePressure },
  BminusC: { food: byId.B.final.resources.food - byId.C.final.resources.food, energy: byId.B.final.resources.energy - byId.C.final.resources.energy, hp: byId.B.final.resources.hp - byId.C.final.resources.hp, collapse: byId.B.final.meters.campCollapse - byId.C.final.meters.campCollapse, resonance: byId.B.final.meters.resonancePressure - byId.C.final.meters.resonancePressure, cacheUsedB: byId.B.final.cacheUsed, cacheUsedC: byId.C.final.cacheUsed },
  causalLimits: ['one declared seed and near-midnight state, not a balance estimate', 'C uses the original thirty-minute gather batch while other waiting uses advance(1); NPC/enemy batch effects are reported, not erased', 'the old candidate defense plan settles at midnight in all branches; its effects remain separate from ration and choice', 'a pending episode and exhausted cache are facts, not an executed skip or automatic punishment', 'no claim that resonance +2 directly spawns an enemy, assigns a trip or creates an away roster'],
} : null;
const cReplenished = diagnostics.find(d => d.name === 'C-after-gather-pending-ui');
const cFollowup = diagnostics.find(d => d.name === 'C-separate-post-gather-choice');
const cacheRetry = diagnostics.find(d => d.name === 'B-cache-finite-next-episode');
const findings = comparisons ? [
  { topic: 'active ration versus deferral', observed: comparisons.AminusD, qualification: 'A closes its original episode; D keeps it pending. The measured extra collapse has no measured food, HP, energy or resonance benefit at this horizon; this does not assign a value to clearing a pending task.' },
  { topic: 'abstract finite cache versus map supply labor', observed: { ...comparisons.BminusC, forageCalendarMinutes: byId.B.actions[0].after.calendar.total - byId.B.actions[0].before.calendar.total, forageEnergyDelta: byId.B.actions[0].after.resources.energy - byId.B.actions[0].before.resources.energy, gatherCalendarMinutes: byId.C.actions[0].after.calendar.total - byId.C.actions[0].before.calendar.total, gatherEnergyDelta: byId.C.actions[0].after.resources.energy - byId.C.actions[0].before.resources.energy, forageChangesNpcLocations: JSON.stringify(byId.B.actions[0].before.npcs.map(n => [n.id, n.x, n.y, n.presence])) !== JSON.stringify(byId.B.actions[0].after.npcs.map(n => [n.id, n.x, n.y, n.presence])) }, qualification: 'Forage spends the unique cache and adds resonance; it does not implement a trip, travel-time cost, away roster or immediate enemy spawn in this observed action.' },
  { topic: 'deferred episode after crossing the original opening threshold', observed: { afterGatherFood: cReplenished?.metrics.resources.food, afterGatherStartGate: cReplenished?.metrics.currentStartGate, retainedInstance: cReplenished?.metrics.episode?.instanceId, originalInstance: originalEpisode.instanceId, actualLaterForageFoodDelta: cFollowup ? cFollowup.after.resources.food - cFollowup.before.resources.food : null, actualLaterForageCalendarDelta: cFollowup ? cFollowup.after.calendar.total - cFollowup.before.calendar.total : null }, qualification: 'The extra later choice is a separate writer branch, not part of policy C at midnight. Keeping an optional episode is distinct from executing skip or auto-completing it.' },
  { topic: 'finite cache across actual writer reload and next-day episode', observed: { flagAtReload: cacheRetry?.before.cacheUsed, episodeAtReload: cacheRetry?.before.episode?.instanceKey, actualReusedChoiceResult: cacheRetry?.actualCommand, foodBefore: cacheRetry?.before.resources.food, foodAfter: cacheRetry?.after.resources.food }, qualification: 'No new cache, refund or hidden reward was created by the probe.' },
  { topic: 'ration request versus actual paid food', observed: branches.map(b => ({ id: b.id, actualRationCalls: b.rationCalls.filter(c => c.before.lastRationDay !== c.after.lastRationDay).map(c => ({ requestedBySourceReturn: c.returned, actualFoodPaid: c.before.food - c.after.food, foodBefore: c.before.food, foodAfter: c.after.food, collapseBefore: c.before.collapse, collapseAfter: c.after.collapse })) })), qualification: 'The source return of three is not used as a claim that all three food were actually paid.' },
  { topic: 'authored action batching changes the surrounding simulation', observed: branches.map(b => ({ id: b.id, waitingCallsOfOneMinute: b.waitSteps, totalNpcHpAtHorizon: b.final.npcs.reduce((sum, n) => sum + n.hp, 0), enemiesAtHorizon: b.final.enemies })), qualification: 'C has one original thirty-minute gather batch plus ten one-minute calls; the others have forty one-minute calls. Enemy/NPC differences cannot be attributed solely to food acquisition or interpreted as a safer policy.' },
  { topic: 'collection receipt target coverage', observed: { actualReceipt: byId.C.actions[0].events.find(e => e.type === 'resource.collected'), independentSameTargetWitness: byId.C.actions[0].targetWitness }, qualification: 'A null target ID in the original wrapper receipt is retained. The experiment does not fill that missing field or fabricate a stronger collection proof.' },
] : [];
const report = {
  runner: 'source-food-shortage-strategies-v1', sourceHtmlSha256: sourceHash, checkerSha256: sha(fs.readFileSync(new URL(import.meta.url))), ioAdapterSha256: sha(adapterBytes),
  originalWriter: { path: fixtureMeta.fixture.path, sha256: sha(originalBytes), sourceHtmlSha256: fixtureMeta.source.htmlSha256, historicalRouteOk: false },
  protocol: { path: 'docs/qa/natural-play-protocol-20261017.md', section: 6, sha256: sha(fs.readFileSync(path.join(root, 'docs/qa/natural-play-protocol-20261017.md'))), contentDefinition: chainId },
  experiment: { mode: 'controlled-offline-derived-source-branches', naturalGameplay: false, browserStarted: false, balanceValidated: false, sourceIdentitySuppliedPrefixes: { source: '25d315', head: '7741' }, fixedSeed: originalPayload.worldMeta.seed, horizon: 'first actual midnight after common day1 23:20 episode baseline', actionBudget: { A: 'one ration choice', B: 'one forage choice', C: 'one original nearby berry gather', D: 'no choice or supply action', waiting: 'at most forty actual advance(1) calls', separateDiagnostics: 'one actual post-gather forage and one next-episode cache retry' } },
  derivation: { beforeBoot: true, originalWriterUntouched: true, changedFields: ['calendar to day1 23:20 and matching world watermarks', 'food=2', 'player=(2,9) adjacent to existing berry res-12yv3vn', 'collapse=10, resonance=25', 'clock rate=1 unpaused', 'NPC needs moderate and needClock=0'], originalPlanRetained: true, originalEnemiesRetained: true, fixedRosterRetained: true, noNodeCreatedOrReplenished: true, episodeCreatedByActualSource: true, receiptsFabricated: false },
  ioScope: 'complete actual inline VM; controlled DOM collections/storage/Date/timer queues; unrelated Canvas/HUD/world renders suppressed after capturing actual context/event renderers; original ration function transparently tapped once for actual before/after; natural timer stopped so explicit actual advance owns the controlled simulation',
  status: failures.length ? 'METHOD_INCOMPLETE' : 'COMPLETE_CONTROLLED_SOURCE_PROBE', methodChecks, failures, baseline: baselineMetrics, branches, diagnostics, comparisons, findings, artifacts,
  outcomesNotImplementedByThisScript: ['no forced daily encounter', 'no new skip penalty or ration benefit', 'no trip, away duty or extra enemy spawned to dramatize forage', 'no direct day assignment after boot, fabricated effect receipt, balance threshold or natural-run claim'],
};
fs.writeFileSync(options['--out'], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ runner: report.runner, status: report.status, sourceHash, branchCount: branches.length, methodChecks: methodChecks.length, failures, summary: branches.map(b => ({ id: b.id, food: b.final.resources.food, energy: b.final.resources.energy, hp: b.final.resources.hp, collapse: b.final.meters.campCollapse, resonance: b.final.meters.resonancePressure, cache: b.final.cacheUsed, episode: b.final.episode?.instanceKey || null })), comparisons }, null, 2));
process.exitCode = failures.length ? 1 : 0;
