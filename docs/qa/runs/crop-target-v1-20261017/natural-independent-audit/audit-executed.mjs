import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const out = path.dirname(fileURLToPath(import.meta.url));
const [fresh, prior, adapterFile] = process.argv.slice(2).map(p => path.resolve(p));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const refs = [], checks = [];
const check = (name, run) => { run(); checks.push({ name, ok: true }); };
function archive(relative, bytes, kind) {
  const target = path.join(out, relative); assert.ok(!fs.existsSync(target), 'new external audit output only');
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
  refs.push({ path: relative, sha256: sha(Buffer.from(bytes)), kind });
}
const reportBytes = fs.readFileSync(path.join(fresh, 'report.json')), originalReportSha = sha(reportBytes);
assert.equal(originalReportSha, 'aa4dbcdbd0dc7943af9940e8b7b87acf96b487145d626e1fcfbdc64ff357f4a5');
const report = JSON.parse(reportBytes), terminalBytes = fs.readFileSync(path.join(fresh, 'execution-summary.json')), terminal = JSON.parse(terminalBytes);
assert.equal(sha(terminalBytes), 'f7d991dc7b387c6ef29af1e5d484674e1d5578790326616f191426aeebcad119');
check('original terminal exit0 and report/summary joins', () => {
  assert.equal(terminal.observedProcessExitCode, 0); assert.equal(terminal.reportSha256, originalReportSha);
  assert.equal(terminal.status, 'SHORT_MIXED_OBSERVED'); assert.equal(report.ok, true); assert.equal(report.passed, 15); assert.equal(report.count, 15); assert.deepEqual(report.errors, []);
});
check('all 51 original declared artifacts hash exactly and are copied unchanged', () => {
  assert.equal(terminal.artifacts.length, 51); assert.equal(new Set(terminal.artifacts.map(r => r.file)).size, 51);
  for (const ref of terminal.artifacts) {
    assert.equal(path.basename(ref.file), ref.file); const bytes = fs.readFileSync(path.join(fresh, ref.file)); assert.equal(sha(bytes), ref.sha256);
    archive('inputs/fresh06/' + ref.file, bytes, 'unchanged-original-natural06-artifact');
  }
  const declared = [...terminal.artifacts.map(r => r.file), 'execution-summary.json'].sort();
  assert.deepEqual(fs.readdirSync(fresh).sort(), declared);
  archive('inputs/fresh06/execution-summary.json', terminalBytes, 'unchanged-original-observed-terminal-summary');
});
const from = name => path.join(out, 'inputs/fresh06', name);
const sourceBytes = fs.readFileSync(from('source.html')), runnerBytes = fs.readFileSync(from('runner-executed.mjs')), runner = runnerBytes.toString('utf8');
check('exact archived HTML runner protocol sprites and three observed main documents', () => {
  assert.equal(sha(sourceBytes), '19cb05c4341ab1353e1ac5362b685a4af3a88fc826e349504b9d57a42639eb6f');
  assert.equal(sha(runnerBytes), '2ff1fb866e23d4fad9af66adefb262bc6f59f5b424315bc72b3bd7e64bd57aed');
  assert.equal(sha(fs.readFileSync(from('protocol-executed.md'))), '1cdf608d0ddd7e05a1dd711c0ec2ad51c7f26e5d181ce0bb6745f24687148e01');
  assert.equal(sha(fs.readFileSync(from('actor-sprites-executed.js'))), report.actorSpritesSha256);
  assert.equal(report.documents.length, 3); assert.ok(report.documents.every(d => d.sha256 === sha(sourceBytes)));
  assert.equal(report.sourceHtmlSha256, sha(sourceBytes)); assert.equal(report.runnerSha256, sha(runnerBytes));
});
const adapterBytes = fs.readFileSync(adapterFile); assert.equal(sha(adapterBytes), 'ee5bb659c0439044e1ec07a4aecf931293457c2478f35d0850fe90770b4367cf');
archive('inputs/posthoc-validator-io-adapter.mjs', adapterBytes, 'actual-existing-IO-factory-used-only-for-posthoc-pure-save-validation');
const source = sourceBytes.toString('utf8'), inline = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(t => t.trim());
assert.equal(inline.length, 1);
const adapter = adapterBytes.toString('utf8'), begin = adapter.indexOf('function runtime(entries = []) {'), end = adapter.indexOf('\nfunction envelope(payload)', begin);
assert.ok(begin >= 0 && end > begin);
const validator = new Function('inline', 'htmlPath', 'vm', 'assert', adapter.slice(begin, end) + '\nreturn runtime;')(inline, 'archived-fresh06-source.html', vm, assert)();
const rows = []; let previous = null;
check('17 snapshot writers and terminal writer validate through actual archived source and continuous ledger', () => {
  assert.equal(report.snapshots.length, 17);
  for (const s of [...report.snapshots, { label: 'terminal', file: 'terminal-before-cleanup-save.json', sha256: '7bdf13bf4830bb0b3bcd3ed9e2a6bee0af45878d568836c86cea04cead94d114' }]) {
    const raw = fs.readFileSync(from(s.file), 'utf8'); assert.equal(sha(raw), s.sha256); const validation = validator.api.validate({ raw }); assert.equal(validation.ok, true, s.label + ':' + validation.reason);
    const p = JSON.parse(raw).payload;
    assert.deepEqual(p.npcs.map(n => n.id), report.initialIdentities); assert.equal(p.npcs.length, 10); assert.equal(p.npcs.filter(n => n.lifeState === 'dead').length, 0);
    assert.equal(new Set(p.buildings.map(b => b.id)).size, p.buildings.length); assert.ok(p.buildings.every(b => typeof b.id === 'string' && b.id));
    assert.equal(p.worldMeta.clock.rate, 1); assert.equal(p.worldMeta.clock.paused, false);
    if (previous) { const appended = p.worldMeta.events.filter(e => e.seq > previous.worldMeta.eventSeq);
      assert.ok(p.world.totalMinutes >= previous.world.totalMinutes);
      assert.deepEqual(appended.map(e => e.seq), Array.from({ length: p.worldMeta.eventSeq - previous.worldMeta.eventSeq }, (_, i) => previous.worldMeta.eventSeq + i + 1));
      assert.deepEqual(p.worldMeta.events, [...previous.worldMeta.events, ...appended].slice(-300)); }
    rows.push({ label: s.label, p }); previous = p;
  }
});
const stage = label => rows.find(r => r.label === label).p;
const initial = rows[0].p, final = rows.at(-1).p, clocks = final.worldMeta.events.filter(e => e.type === 'time.advanced' && e.seq > initial.worldMeta.eventSeq);
check('all actual calendar minutes join exact real clock replay', () => {
  assert.equal(initial.world.totalMinutes, 360); assert.equal(final.world.totalMinutes, 563);
  for (const e of clocks) { const cs = final.worldMeta.replay.commands.filter(c => c.commandId === e.commandId); assert.equal(cs.length, 1); assert.equal(cs[0].type, 'world.advance'); assert.equal(cs[0].payload.minutes, e.payload.minutes); }
  assert.equal(clocks.reduce((sum, e) => sum + e.payload.minutes, 0), 203);
});
const actions = [];
for (const type of ['event.resolved', 'resource.collected', 'landmark.discovered', 'npc.interacted', 'crop.changed', 'building.constructed']) check('actual source changes and causal evidence for ' + type, () => {
  const action = report.actions.find(a => a.type === type && Number.isInteger(a.index)), before = stage(action.index + '-' + type + '-before'), after = stage(action.index + '-' + type + '-after');
  const newEvents = after.worldMeta.events.filter(e => e.seq > before.worldMeta.eventSeq), receipts = newEvents.filter(e => e.type === type); assert.equal(receipts.length, 1);
  const event = receipts[0], parents = after.worldMeta.replay.commands.filter(c => c.commandId === event.commandId); assert.equal(parents.length, 1); assert.equal(parents[0].actorId, 'player-1');
  const children = newEvents.filter(e => e.type === 'time.advanced' && e.causationId === event.commandId);
  if (type !== 'event.resolved') { assert.equal(children.length, 1); assert.equal(children[0].payload.minutes, action.estimatedActionMinutes); }
  const entry = { kind: type, principalIndex: action.index, parentCommandId: event.commandId, eventId: event.eventId, eventActorId: event.actorId, parentActorId: parents[0].actorId,
    observedMinutes: [before.world.totalMinutes, after.world.totalMinutes], ownCausalMinutes: children.map(e => e.payload.minutes),
    resources: Object.fromEntries(['food', 'parts', 'wood', 'stone', 'seeds', 'energy'].map(k => [k, [before[k], after[k]]])) };
  if (type === 'event.resolved') { assert.equal(after.food - before.food, 3); assert.equal(after.parts - before.parts, 1); assert.equal(after.event.handled, true); assert.equal(after.eventThreat, 1); assert.equal(before.energy - after.energy, 4); }
  if (type === 'resource.collected') { const changed = before.resources.filter(old => after.resources.find(n => n.id === old.id)?.amount !== old.amount); assert.equal(changed.length, 1); const old = changed[0], actual = after.resources.find(n => n.id === old.id); assert.equal(old.type, 'tree'); assert.equal(actual.amount, old.amount - 1); assert.equal(after.wood - before.wood, 4); entry.sameFiniteNode = { id: old.id, x: old.x, y: old.y, amount: [old.amount, actual.amount] }; }
  if (type === 'landmark.discovered') { const old = before.landmarks.find(l => !l.found && after.landmarks.find(n => n.id === l.id)?.found); assert.ok(old); assert.equal(old.type, 'waterMill'); entry.landmark = { id: old.id, x: old.x, y: old.y, found: [false, true] }; }
  if (type === 'npc.interacted') { assert.equal(event.actorId, 'player-1'); const id = parents[0].payload.npcId, old = before.npcs.find(n => n.id === id), actual = after.npcs.find(n => n.id === id); assert.equal(id, 'sergeant'); assert.equal(id, report.UIObservationInstrumentation.confirmationPublic.publicNpcId); assert.equal(old.supportRequested, false); assert.equal(actual.supportRequested, true); assert.equal(actual.bond - old.bond, 1); assert.equal(actual.memory.helpedByPlayer - old.memory.helpedByPlayer, 1); entry.npc = { publicId: id, publicName: report.UIObservationInstrumentation.confirmationPublic.targetName, support: [false, true], bond: [old.bond, actual.bond], helpedByPlayer: [old.memory.helpedByPlayer, actual.memory.helpedByPlayer] }; }
  if (type === 'crop.changed') { assert.equal(event.actorId, 'player-1'); const p = event.payload, old = before.buildings.find(b => b.id === p.buildingId), actual = after.buildings.find(b => b.id === p.buildingId); assert.equal(p.buildingId, 'bld-mazjx8'); assert.ok(initial.buildings.some(b => b.id === old.id)); assert.equal(old.planted, false); assert.equal(actual.planted, true); assert.equal(actual.ready, false); assert.equal(actual.growth, 0); assert.equal(p.operation, 'plant'); assert.equal(p.payment.cost.energy, 4); assert.equal(p.payment.cost.seeds, 1); assert.equal(p.payment.before.energy - p.payment.after.energy, 4); assert.equal(before.seeds - after.seeds, 1); assert.equal(p.advance.commandId, children[0].commandId); assert.equal(p.advance.causationId, event.commandId); entry.crop = { id: old.id, x: old.x, y: old.y, actualFractionalPlayer: before.player, gross: p.payment.cost, actualAdvance: p.advance }; }
  if (type === 'building.constructed') { const added = after.buildings.filter(b => !before.buildings.some(old => old.id === b.id)); assert.equal(added.length, 1); assert.equal(added[0].type, 'tower'); assert.equal(added[0].id, 'bld-1rvyyf8'); assert.equal(before.wood - after.wood, 12); assert.equal(before.stone - after.stone, 5); assert.ok(report.constructionPublicSite.centerPubliclyClickable); assert.ok(report.constructionPublicSite.className.includes('build-target')); assert.equal(added[0].x, report.constructionPublicSite.x); assert.equal(added[0].y, report.constructionPublicSite.y); assert.ok(Math.hypot(added[0].x - 7, added[0].y - 14) <= 3); entry.newTower = added[0]; }
  actions.push(entry);
});
let rest;
check('purposeful rest has one exact 30-minute instance and thirty real one-minute children', () => {
  const b = stage('rest-purpose-before'), a = stage('rest-purpose-after'), events = a.worldMeta.events.filter(e => e.seq > b.worldMeta.eventSeq), starts = events.filter(e => e.type === 'camp.rest.started'), stops = events.filter(e => e.type === 'camp.rest.stopped');
  assert.equal(starts.length, 1); assert.equal(stops.length, 1); const id = starts[0].payload.restId, children = events.filter(e => e.type === 'time.advanced' && e.payload.restId === id);
  assert.equal(children.length, 30); assert.deepEqual(children.map(e => e.payload.restStep), Array.from({ length: 30 }, (_, i) => i + 1)); assert.ok(children.every(e => e.payload.minutes === 1));
  assert.equal(stops[0].payload.reason, 'completed'); assert.equal(stops[0].payload.completed, 30); assert.equal(stops[0].payload.currentMinute - starts[0].payload.startMinute, 30); assert.equal(a.energy - b.energy, 1);
  rest = { purpose: report.restPurpose, start: starts[0], stop: stops[0], oneMinuteChildCount: children.length, observedWriterWindow: [b.world.totalMinutes, a.world.totalMinutes], energy: [b.energy, a.energy], food: [b.food, a.food], observationLagNote: 'pre-rest writer447 precedes actual rest start449 by two normal minutes; actual rest449..479 is exactly30, not32' };
});
let reload;
check('real public reload plus normal tick repeats no action reward payment seed or NPC support', () => {
  const b = stage('before-public-reload'), a = stage('after-reload-normal-tick'), appended = a.worldMeta.events.filter(e => e.seq > b.worldMeta.eventSeq); assert.equal(appended.length, 1); assert.equal(appended[0].type, 'time.advanced'); assert.equal(appended[0].payload.minutes, 1);
  for (const type of ['event.resolved', 'resource.collected', 'npc.interacted', 'crop.changed', 'building.constructed', 'camp.rest.started', 'camp.rest.stopped']) assert.deepEqual(a.worldMeta.events.filter(e => e.type === type), b.worldMeta.events.filter(e => e.type === type));
  for (const key of ['food', 'parts', 'wood', 'stone', 'seeds']) assert.equal(a[key], b[key]);
  const withoutCombatClock = values => values.map(({ combatClock, ...rest }) => rest); assert.deepEqual(withoutCombatClock(a.buildings), withoutCombatClock(b.buildings));
  for (const old of b.npcs) { const actual = a.npcs.find(n => n.id === old.id); assert.equal(actual.supportRequested, old.supportRequested); assert.equal(actual.bond, old.bond); assert.equal(actual.memory.helpedByPlayer, old.memory.helpedByPlayer); }
  reload = { observedWriterWindow: [b.world.totalMinutes, a.world.totalMinutes], onlyNewEvent: appended[0], resourceAndActionNoRepeat: true, sameBuildingIdentityCropAndHealth: true, npcSupportBondMemoryUnchanged: true,
    realCombatClockProgress: a.buildings.filter(n => n.combatClock !== b.buildings.find(old => old.id === n.id).combatClock).map(n => ({ id: n.id, before: b.buildings.find(old => old.id === n.id).combatClock, after: n.combatClock })) };
});
check('actual limited fresh route budgets cleanup and unused observer', () => {
  assert.equal(report.actions.filter(a => Number.isInteger(a.index)).length, 7); assert.ok(report.elapsedWallMs < 480000); assert.ok(report.navigation.every(n => n.wallMs < 30000)); assert.equal(report.timers.idleMs, 0);
  assert.equal(report.UIObservationInstrumentation.observations.length, 0); assert.equal(report.UIObservationInstrumentation.approaches.length, 0); assert.equal(report.UIObservationInstrumentation.restorationProofs.length, 0);
  assert.ok(Object.values(report.cleanup).every(v => v === true)); assert.deepEqual(report.shortRouteCoverage.missing, []);
  assert.ok(!/localStorage\.(?:setItem|removeItem)\s*\(|addInitScript\s*\(/.test(runner)); assert.equal(report.policy.saveInjection, false); assert.equal(report.policy.resume, false); assert.equal(report.policy.actorProjectionComplete, false);
});
let old;
check('old05 remains its own failed incomplete source and is not merged', () => {
  for (const file of ['report.json', 'execution-summary.json', 'runner-executed.mjs', 'source.html']) archive('inputs/prior05/' + file, fs.readFileSync(path.join(prior, file)), 'unchanged-separate-prior05-artifact');
  const raw = fs.readFileSync(path.join(prior, 'report.json')); assert.equal(sha(raw), '3004fd66ee83951ae37e566cadb75229ce3f03b8bd39b340a34708c223cc0a1f');
  old = JSON.parse(raw); const summary = JSON.parse(fs.readFileSync(path.join(prior, 'execution-summary.json'), 'utf8')); assert.equal(old.status, 'INCOMPLETE_COVERAGE'); assert.equal(old.ok, false); assert.equal(summary.observedProcessExitCode, 1); assert.deepEqual(old.shortRouteCoverage.missing, ['npcInteraction']);
});
const findings = [
  { id: 'existing-supply-cost-hint', scope: 'pre-existing UI wording mismatch; eventChoice actually occurred', publicHint: report.initialEventPublic.a, actualEnergy: actions.find(a => a.kind === 'event.resolved').resources.energy, sourceFact: 'source supply choice branch calls spendEnergy(4), while public hint says6', sevenOccurrenceEvidenceInvalidated: false, fixedByThisAudit: false },
  { id: 'legacy-event-and-collect-actor', scope: 'global actor consistency is not established by the crop-only fix', actual: actions.filter(a => ['event.resolved', 'resource.collected'].includes(a.kind)).map(a => ({ kind: a.kind, eventActorId: a.eventActorId, parentActorId: a.parentActorId })), cropAndNpcActualActorsPlayer1: true, fixedByThisAudit: false },
  { id: 'observer-not-triggered', scope: 'static METHOD_READY only; no wrapper installed in actual06', observations: 0, approaches: 0, restorations: 0, executedFollowOrRestoreBranchClaim: false },
  { id: 'privileged-safety-separate', scope: report.policy.privilegedSafetySource, actorProjectionComplete: false },
  { id: 'observed-main-document-scope', scope: 'three explicit observed main-document response bodies all19cb; fixed local HTTP server served the immutable archived Buffer; no claim that sprite/other asset response hashes equal HTML' },
  { id: 'bounded-short-slice', scope: 'one fresh scripted natural mixed slice; encounter, harvest, threeDays, real hidden behavior and balance remain uncovered' }
];
assert.match(report.initialEventPublic.a, /消耗 6 体力/); assert.ok(source.includes('if (!spendEnergy(4)) return;\n          state.food += 3; state.parts += 1; state.eventThreat = 1;'));
const result = { schema: 'Natural06IndependentReadOnlyAuditV1', status: 'SHORT_MIXED_SEVEN_OCCURRENCES_CONFIRMED_WITH_LIMITATIONS', okWithinStatedShortScope: true,
  sourceHtmlSha256: sha(sourceBytes), originalReportSha256: originalReportSha, originalTerminalSummarySha256: sha(terminalBytes), executedNaturalRunnerSha256: sha(runnerBytes), executedProtocolSha256: report.protocolSha256,
  auditorSha256: sha(fs.readFileSync(new URL(import.meta.url))), posthocSourceValidatorAdapterSha256: sha(adapterBytes), originalsUnmodified: true, refs, checks,
  evidence: { observedProcessExitCode: terminal.observedProcessExitCode, nativeWritersValidated: rows.length, originalArtifactHashesVerified: terminal.artifacts.length, continuousLedger: true, originalTenLivingIdentitiesThroughout: true,
    actualClock: { initialMinute: 360, terminalMinute: 563, exactJoinedClockMinutes: 203, uniqueClockReceipts: clocks.length }, originalBrowserChecks: { passed: 15, count: 15 }, actions, rest, reload,
    budgets: { wallLimitMs: 480000, actualWallMs: report.elapsedWallMs, routeBeforeCleanupMs: report.routeElapsedBeforeCleanupMs, principalActions: 7, principalLimit: 10, maximumNavigationGoalMs: Math.max(...report.navigation.map(n => n.wallMs)), timers: report.timers },
    cleanup: report.cleanup, terminal: report.terminal, publicObservation: { goalSelection: 'source-audited rendered nonfogged tile/context/HUD only; writer does not choose NPC target', npc: report.UIObservationInstrumentation.confirmationPublic.targetName, publicNpcId: report.UIObservationInstrumentation.confirmationPublic.publicNpcId,
      firstDialogueCountedAsSupport: false, actualObserverInstalled: false, humanReadOnlyScreenshotsInspected: ['008-3-npc.interacted-after.png', '014-6-building.constructed-after.png'] },
    prior05: { sourceHtmlSha256: old.sourceHtmlSha256, status: old.status, ok: old.ok, missing: old.shortRouteCoverage.missing, mergedInto06: false } }, findings,
  auditExecutionScope: 'read original terminal artifacts; actual archived inline validator executed only posthoc under controlled IO; no new browser launched, no game state/receipt produced or altered in the natural run, no repository/source/original report changes',
  browserLaunchedByAuditor: false, naturalThreeDaysValidated: false, balanceValidated: false };
fs.writeFileSync(path.join(out, 'audit.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, checks: checks.length, writersValidated: rows.length, artifactsVerified: terminal.artifacts.length, auditSha256: sha(fs.readFileSync(path.join(out, 'audit.json'))), auditorSha256: result.auditorSha256, findings: findings.map(f => f.id) }));
