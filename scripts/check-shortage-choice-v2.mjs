#!/usr/bin/env node
/** Complete source runtime contract checks; no Gate, migration or effect mirror.
 * Controlled DOM/storage/scheduler IO is source evidence, not browser/balance
 * acceptance. Real old writer inputs and derived invalid inputs are separate.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Only the two pinned complete SAVE21 fixtures in these four legacy checks.
// This validates the exact additive Scenario, routine-intent and handoff-memory receipt; it never removes arbitrary
// migrations or relaxes historical plan/resource/CP/population assertions.
function hasOnlyExpectedScenarioLegacyMigration(runtime, envelope) {
  const s = runtime.api.state, p = envelope.payload, eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  if (!['707889bd','7fde7715'].includes(envelope.checksum)) return false;
  const date = { day: p.day, hour: p.hour, minute: p.minute }, seq = p.worldMeta.eventSeq + 1;
  const handoffMissing = p.npcs.filter(n=>!Object.hasOwn(n.memory,'relayCoreHandoff')).map(n=>n.id);
  const expectedMemories = p.npcs.map(n=>Object.hasOwn(n.memory,'relayCoreHandoff') ? n.memory : {...n.memory,relayCoreHandoff:null});
  const expected = { eventId: `evt-${String(seq).padStart(6,'0')}`, seq, type: 'save.migrated', actorId: 'system', commandId: null, causationId: null,
    tick: { world: (p.day-1)*1440+p.hour*60+p.minute, phase: p.worldMeta.clock.phaseMinutes, schedule: p.worldMeta.clock.scheduleMinutes },
    payload: { migration: 'resolved-report-recovery-001', migrationVersion: 1, reason: 'npc-routine-intent-v1,scenario-legacy-unbound-v1,scenario-content-binding-v1' + (handoffMissing.length ? ',npc-relay-handoff-memory-v1' : ''), sourceCategory: 'primary',
      originalChecksum: envelope.checksum, originalDate: date, selectedChecksum: envelope.checksum, selectedDate: date, rollback: false, instanceId: null,
      fromSaveVersion: 21, fromContentVersion: 3, adapter: null, addedDomains: ['npc.routineIntent',...(handoffMissing.length ? ['npc.memory.relayCoreHandoff'] : [])],
      npcRoutineIntentAdapters: [{adapter:'npc-routine-intent-v1',npcIds:p.npcs.map(n=>n.id),defaultValue:null}], scenarioBindingAdapters: [{ adapter: 'scenario-legacy-unbound-v1',
        sourceSeed: p.worldMeta.seed, hadDeclaredSnapshot: Object.hasOwn(p,'scenarioSnapshot'), seedSource: 'saved-world-meta', declaredSeed: p.scenarioSnapshot?.seed ?? null,
        liveSeed: p.worldMeta.seed, aiDowngraded: false, effectiveAuthority: 'expression_only' }],
      scenarioContentAdapters: [{adapter:'scenario-content-binding-v1',oldPackageDigest:null,oldBindingStatus:'missing',
        compilerVersion:'scenario-event-chain-v1',catalogDigest:'fnv1a-utf16-canonical-hex-v1:33e5b74b',rulesDigest:'fnv1a-utf16-canonical-hex-v1:b19c6fb5'}],
      ...(handoffMissing.length ? {npcRelayHandoffMemoryAdapters:[{adapter:'npc-relay-handoff-memory-v1',npcIds:handoffMissing,defaultValue:null}]} : {}) } };
  const added = s.worldMeta.events.filter(event => event.seq > p.worldMeta.eventSeq), stored = runtime.storage.get(saveKey);
  if (!stored || !runtime.api.validate({raw:stored,sourceCategory:'primary'}).ok) return false;
  const written = JSON.parse(stored).payload;
  return eq(added,[expected]) && s.worldMeta.eventSeq === seq
    && eq(s.worldMeta.events.slice(0,p.worldMeta.events.length),p.worldMeta.events)
    && eq(written.worldMeta.events,s.worldMeta.events) && written.version === 21 && written.contentState.contentVersion === 3
    && s.worldMeta.seed === p.worldMeta.seed && s.worldMeta.rngState === p.worldMeta.rngState && eq(s.worldMeta.replay,p.worldMeta.replay)
    && s.worldMeta.commandSeq === p.worldMeta.commandSeq && eq(s.worldMeta.seenCommands,p.worldMeta.seenCommands)
    && eq(s.world,p.world) && ['day','hour','minute','hp','energy','sanity','wood','stone','food','seeds','parts','medicine','morale'].every(key => s[key] === p[key])
    && eq(s.resources,p.resources) && eq(s.npcs.map(n=>({id:n.id,hp:n.hp,lifeState:n.lifeState})),p.npcs.map(n=>({id:n.id,hp:n.hp,lifeState:n.lifeState})))
    && s.npcs.every(n=>n.routineIntent===null) && written.npcs.every(n=>n.routineIntent===null)
    && eq(s.npcs.map(n=>n.memory),expectedMemories) && eq(written.npcs.map(n=>n.memory),expectedMemories)
    && eq(s.contentState.planMeeting,p.contentState.planMeeting) && s.contentState.commandPoints === p.contentState.commandPoints
    && eq(s.scenarioSnapshot.binding,{version:1,status:'legacy-unbound',sourceSeed:p.worldMeta.seed,declaredSnapshot:p.scenarioSnapshot??null})
    && s.scenarioSnapshot.seed === p.worldMeta.seed
    && eq(s.scenarioSnapshot.contentBinding,{version:1,status:'bound',compilerVersion:'scenario-event-chain-v1',
      catalogDigest:'fnv1a-utf16-canonical-hex-v1:33e5b74b',rulesDigest:'fnv1a-utf16-canonical-hex-v1:b19c6fb5',
      registry:[{kind:'eventDef',id:'relay-chain-001'},{kind:'eventChain',id:'zh-food-shortage-001'}]})
    && eq(written.scenarioSnapshot.contentBinding,s.scenarioSnapshot.contentBinding);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const usage = 'node scripts/check-shortage-choice-v2.mjs --baseline-report BASELINE_REPORT --out NEW_REPORT [--html HTML]';
const args = process.argv.slice(2), options = {};
assert.equal(args.length % 2, 0, usage);
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--baseline-report', '--out', '--html'].includes(args[i]) && args[i + 1] && !options[args[i]], usage);
  options[args[i]] = path.resolve(args[i + 1]);
}
for (const key of ['--baseline-report', '--out']) assert.ok(options[key], usage);
assert.ok(!fs.existsSync(options['--out']), 'report must be new');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const htmlPath = options['--html'] || path.join(root, 'dist/index.html'), htmlBytes = fs.readFileSync(htmlPath);
const source = htmlBytes.toString('utf8'), inline = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
assert.equal(inline.length, 1); new vm.Script(inline[0]);
const adapterPath = path.join(root, 'scripts/check-report-recovery.mjs'), adapterBytes = fs.readFileSync(adapterPath), adapter = adapterBytes.toString('utf8');
const begin = adapter.indexOf('function runtime(entries = []) {'), end = adapter.indexOf('\nfunction envelope(payload)', begin);
assert.ok(begin >= 0 && end > begin);
let body = adapter.slice(begin, end);
const collectionMarker = 'appendChild(child) { this.children.push(child); }';
assert.equal(body.split(collectionMarker).length, 2);
body = body.replace(collectionMarker, collectionMarker + ', replaceChildren(...children) { this.children = [...children]; }');
const marker = '  const api = context.qa;\n  api.instrumentRendering();';
assert.equal(body.split(marker).length, 2);
body = body.replace(marker, `
  vm.runInContext(\`qa.shortage = {
    registry: ContentRegistry, renderEvent, resolve: resolveContentChainCommand,
    token: contentEpisodeExpectedToken, advance, minute: worldMinute, foodSituation,
    stopNative: stopWorldSimulation, damage: applyDayCombatDamage,
    select() { eventPanelSelection = 'chain:zh-food-shortage-001'; eventPanelReceipt = null; }
  };\`, context);
  const api = context.qa;
  api.instrumentRendering();`);
const saveKey = 'zombie-harvest-progress-v12';
const factory = new Function('inline', 'htmlPath', 'vm', 'assert', 'saveKey', 'URLSearchParams', body + '\nreturn runtime;')(inline, htmlPath, vm, assert, saveKey, URLSearchParams);
const id = 'zh-food-shortage-001', flag = 'zh-shortage-cache-retrieved';
const baselineBytes = fs.readFileSync(options['--baseline-report']), baselineReport = JSON.parse(baselineBytes);
assert.equal(baselineReport.sourceHtmlSha256, '32f911f69a6a962ae69a0325afcffd1c5d6d923c0efe1fb0ca8787c1959d9fae');
assert.equal(baselineReport.status, 'COMPLETE_CONTROLLED_SOURCE_PROBE');
assert.equal(baselineReport.checkerSha256, 'c76a776764d080fb29ae95ee19a94a807aef96cdb41c3e9676aff8de792dcef6');
const outputDir = path.join(path.dirname(options['--out']), path.basename(options['--out'], '.json') + '-artifacts');
assert.ok(!fs.existsSync(outputDir)); fs.mkdirSync(outputDir);
const refs = [], artifacts = [], checks = [], failures = [], observations = {};
function put(rel, bytes, metadata = {}) {
  const target = path.join(outputDir, rel); assert.ok(!fs.existsSync(target), 'new artifact only');
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
  const record = { path: path.basename(outputDir) + '/' + rel.replaceAll('\\', '/'), sha256: sha(Buffer.from(bytes)), ...metadata };
  artifacts.push(record); return record;
}
refs.push(put('inputs/runtime.html', htmlBytes, { kind: 'tested-runtime' }));
refs.push(put('inputs/checker.mjs', fs.readFileSync(new URL(import.meta.url)), { kind: 'executed-checker' }));
refs.push(put('inputs/io-adapter.mjs', adapterBytes, { kind: 'controlled-io-adapter' }));
refs.push(put('inputs/baseline/report.json', baselineBytes, { kind: 'unchanged-prior-experiment-report' }));
const inputMappingPath = path.join(path.dirname(options['--baseline-report']), 'input-mapping.json');
const inputMappingBytes = fs.readFileSync(inputMappingPath), inputMapping = JSON.parse(inputMappingBytes);
assert.equal(inputMapping.originalReportUnmodified, true);
assert.equal(inputMapping.protocol.originalPath, baselineReport.protocol.path);
assert.equal(inputMapping.protocol.sha256, baselineReport.protocol.sha256);
const protocolPath = path.resolve(path.dirname(options['--baseline-report']), inputMapping.protocol.archivePath);
assert.ok(!path.relative(path.dirname(options['--baseline-report']), protocolPath).startsWith('..'));
const protocolBytes = fs.readFileSync(protocolPath); assert.equal(sha(protocolBytes), baselineReport.protocol.sha256);
refs.push(put('inputs/baseline/input-mapping.json', inputMappingBytes, { kind: 'baseline-native-input-mapping' }));
refs.push(put('inputs/baseline/' + inputMapping.protocol.archivePath, protocolBytes, { kind: 'actual-baseline-executed-protocol' }));
const baselineInputs = {};
for (const item of baselineReport.artifacts) {
  const resolved = path.resolve(path.dirname(options['--baseline-report']), item.path), relative = path.relative(path.dirname(options['--baseline-report']), resolved);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'baseline artifact stays inside its portable tree');
  const bytes = fs.readFileSync(resolved); assert.equal(sha(bytes), item.sha256);
  put('inputs/baseline/' + item.path.replaceAll('\\', '/'), bytes, { kind: item.kind, sourceName: item.name });
  baselineInputs[item.name] = bytes.toString('utf8');
}
for (const name of ['common-episode-baseline', 'A-after-action', 'B-after-action', 'B-first-midnight', 'C-after-real-gather-before-midnight']) assert.ok(baselineInputs[name], 'required actual baseline writer: ' + name);
const originalRel = 'scripts/fixtures/npc-threat-attention-v1/browser-writer-day1-1110-save21.json';
const originalBytes = fs.readFileSync(path.join(root, originalRel)); assert.equal(sha(originalBytes), '5fdd18e8307d4109e671d7fb98298722611854fafb23c5b72a3491c1f1e32ee4');
refs.push(put('inputs/original-complete-writer.json', originalBytes, { kind: 'existing-original-complete-writer', rootRelativeSource: originalRel }));
const legacyRel = 'scripts/fixtures/content-episode-v1/save21-pre-identity-active.json';
const legacyBytes = fs.readFileSync(path.join(root, legacyRel)), legacyFixture = JSON.parse(legacyBytes);
refs.push(put('inputs/existing-pre-identity-fixture.json', legacyBytes, { kind: 'existing-pre-identity-payload-fixture', rootRelativeSource: legacyRel }));
const activeRaw = baselineInputs['common-episode-baseline'], activePayload = JSON.parse(activeRaw).payload;
const oldRationRaw = baselineInputs['A-after-action'], oldForageRaw = baselineInputs['B-after-action'];
function test(name, run, inputKind = 'actual-source-writer') {
  try { run(); checks.push({ name, inputKind, ok: true }); }
  catch (error) { checks.push({ name, inputKind, ok: false, error: `${error.name}: ${error.message}` }); failures.push(name); }
}
function runtime(raw = null, start = true) {
  const r = factory(raw ? [[saveKey, raw]] : []); r.p = r.api.shortage;
  if (start) { assert.equal(r.api.start().ok, true, 'actual source start'); r.p.stopNative(); }
  return r;
}
function wrapped(payload) {
  const r = runtime(null, false);
  return JSON.stringify({ ...payload, payload, checksum: r.api.hash(payload), savedAt: (payload.day - 1) * 1440 + payload.hour * 60 + payload.minute });
}
function active(r) { return r.api.state.contentState.activeChains[id]; }
function token(r) { return clone(r.p.token(active(r))); }
function events(r, type, after = 0) { return clone(r.api.state.worldMeta.events.filter(e => e.seq > after && (!type || e.type === type))); }
function protectedFacts(value) {
  return clone({ calendar: [value.day, value.hour, value.minute], resources: Object.fromEntries(['food', 'energy', 'hp', 'sanity', 'wood', 'stone', 'parts', 'medicine', 'seeds', 'morale'].map(k => [k, value[k]])), npcs: value.npcs.map(n => ({ id: n.id, hp: n.hp, lifeState: n.lifeState, needs: n.needs, bond: n.bond, actingRole: n.actingRole, garrisonedOutpostId: n.garrisonedOutpostId })), content: { flags: value.contentState.flags, meters: value.contentState.meters, history: value.contentState.history, appliedEffects: value.contentState.appliedEffects, completedChains: value.contentState.completedChains }, buildings: value.buildings, resourcesOnMap: value.resources });
}
function save(r, name) {
  assert.equal(r.api.save(), true); const raw = r.storage.get(saveKey), validation = r.api.validate({ raw, sourceCategory: 'primary' });
  assert.equal(validation.ok, true, 'actual writer validates: ' + validation.reason);
  put('writers/' + name + '.json', raw, { kind: 'actual-candidate-writer', receiptFabricated: false }); return raw;
}
function display(r) {
  r.p.select(); r.p.renderEvent();
  return clone({ title: r.node('eventTitle').textContent, text: r.node('eventText').textContent, a: { disabled: r.node('eventChoiceA').disabled, html: r.node('eventChoiceA').innerHTML, dataset: r.node('eventChoiceA').dataset }, b: { disabled: r.node('eventChoiceB').disabled, html: r.node('eventChoiceB').innerHTML, dataset: r.node('eventChoiceB').dataset } });
}
function click(r, route) { display(r); const button = route === 'ration' ? 'eventChoiceA' : 'eventChoiceB'; assert.equal(r.node(button).disabled, false); r.emit(button, 'click'); }
function resolve(r, route, commandId, expected = token(r)) { return r.p.resolve(id, 'shortage_choice', route, { commandId, ...expected }); }
function validatePure(payload) {
  const r = runtime(null, false), input = clone(payload), inputBefore = clone(input), stateBefore = clone(r.api.state), registryBefore = r.api.registryKeys(), storageBefore = [...r.storage];
  const result = r.api.validatePayload(input);
  assert.deepEqual(input, inputBefore); assert.deepEqual(clone(r.api.state), stateBefore); assert.deepEqual(r.api.registryKeys(), registryBefore); assert.deepEqual([...r.storage], storageBefore);
  return { r, input, result };
}

test('v2 definition removes ration effect tax and names new forage history precisely', () => {
  const r = runtime(), def = r.p.registry.get('eventChain', id), [ration, forage] = def.nodes[0].choices;
  assert.equal(def.definitionVersion, 2); assert.equal(ration.id, 'ration');
  assert.deepEqual(clone(ration.effects), [{ op: 'recordHistory', key: id + ':ration', payload: { route: 'ration' } }]);
  const history = forage.effects.find(e => e.op === 'recordHistory').payload;
  assert.equal(history.resonancePressure, 2); assert.equal(Object.hasOwn(history, 'exposure'), false);
  assert.deepEqual(clone(forage.effects.filter(e => e.op !== 'recordHistory')), [{ op: 'addResource', key: 'food', value: 2 }, { op: 'adjustMeter', key: 'resonancePressure', value: 2 }, { op: 'unlock', key: flag }]);
});
test('original complete writer without active shortage preserves rewards with only explicit Scenario metadata migration', () => {
  const p = JSON.parse(originalBytes).payload, r = runtime(originalBytes.toString('utf8'));
  assert.deepEqual(protectedFacts(r.api.state), protectedFacts(p)); assert.equal(active(r), undefined);
  assert.equal(hasOnlyExpectedScenarioLegacyMigration(r, JSON.parse(originalBytes)), true);
});
test('actual unresolved v1 writer validates and draft upgrades only version without live state or input effects', () => {
  const { r, input, result } = validatePure(activePayload); assert.equal(result.ok, true);
  const before = clone(input), stateBefore = clone(r.api.state), registryBefore = r.api.registryKeys(), storageBefore = [...r.storage];
  const draft = r.api.prepare({ payload: input, sourceCategory: 'primary', originalChecksum: r.api.hash(input) }, r.api.classify(input));
  assert.deepEqual(input, before); assert.deepEqual(clone(r.api.state), stateBefore); assert.deepEqual(r.api.registryKeys(), registryBefore); assert.deepEqual([...r.storage], storageBefore);
  assert.deepEqual(clone(draft.state.contentState.activeChains[id]), { ...clone(input.contentState.activeChains[id]), definitionVersion: 2 });
  assert.deepEqual(protectedFacts(draft.state), protectedFacts(input)); assert.deepEqual(clone(draft.state.worldMeta.events), input.worldMeta.events);
  assert.ok(draft.migration.reason.includes('shortage-choice-definition-v2'));
  const adapter = draft.migration.contentDefinitionAdapters[0]; assert.equal(adapter.fromDefinitionVersion, 1); assert.equal(adapter.toDefinitionVersion, 2);
  assert.equal(adapter.instanceId, input.contentState.activeChains[id].instanceId); observations.pureAdapter = clone(adapter);
});
test('boot saves one real migration record and a second reload neither repeats it nor advances time', () => {
  const r = runtime(activeRaw), old = activePayload.contentState.activeChains[id];
  assert.deepEqual(clone(active(r)), { ...clone(old), definitionVersion: 2 }); assert.deepEqual(protectedFacts(r.api.state), protectedFacts(activePayload));
  const migrated = events(r, 'save.migrated').filter(e => e.payload.reason.includes('shortage-choice-definition-v2'));
  assert.equal(migrated.length, 1); assert.equal(migrated[0].payload.contentDefinitionAdapters[0].fromDefinitionVersion, 1);
  assert.equal(events(r, 'content.chain.resolved').length, activePayload.worldMeta.events.filter(e => e.type === 'content.chain.resolved').length);
  const raw = save(r, 'active-v1-migrated'), second = runtime(raw);
  assert.equal(events(second, 'save.migrated').length, events(r, 'save.migrated').length); assert.deepEqual(clone(active(second)), clone(active(r)));
  assert.deepEqual(protectedFacts(second.api.state), protectedFacts(r.api.state));
});
test('failed migration write remains fenced and retry records no second migration or effect', () => {
  const r = runtime(activeRaw, false); r.instrumentation.setFailure = true;
  assert.equal(r.api.start().ok, false); assert.equal(r.api.session.mode, 'RECOVERY'); assert.equal(r.api.started, false); assert.equal(r.storage.get(saveKey), activeRaw);
  assert.deepEqual(protectedFacts(r.api.state), protectedFacts(activePayload));
  r.instrumentation.setFailure = false; assert.equal(r.api.start().ok, true); r.p.stopNative();
  assert.equal(events(r, 'save.migrated').filter(e => e.payload.reason.includes('shortage-choice-definition-v2')).length, 1); save(r, 'migration-write-retry');
});
test('pre-existing missing-version identity fixture upgrades from its actual startedAt without settlement', () => {
  const payload = clone(legacyFixture.payload), { r, input, result } = validatePure(payload); assert.equal(result.ok, true);
  const draft = r.api.prepare({ payload: input, sourceCategory: 'primary' }, r.api.classify(input)), adapted = draft.state.contentState.activeChains[id];
  assert.equal(adapted.definitionVersion, 2); assert.equal(adapted.startedAt, payload.contentState.activeChains[id].startedAt);
  assert.equal(adapted.actorId, payload.contentState.activeChains[id].actorId); assert.equal(adapted.instanceKey, id + ':1'); assert.equal(adapted.instanceId, 'content:' + id + ':1');
  assert.deepEqual(protectedFacts(draft.state), protectedFacts(payload)); assert.deepEqual(clone(draft.state.worldMeta.events), payload.worldMeta.events);
  const loaded = runtime(wrapped(payload)); assert.equal(active(loaded).definitionVersion, 2); save(loaded, 'existing-pre-identity-migrated');
}, 'existing-pre-identity-payload-fixture');
test('derived later save date never re-dates the valid missing-version original episode', () => {
  const p = clone(legacyFixture.payload); p.day = 3; p.world.totalMinutes = (3 - 1) * 1440 + p.hour * 60 + p.minute;
  const r = runtime(wrapped(p)); assert.equal(active(r).instanceKey, id + ':1'); assert.equal(active(r).definitionVersion, 2);
}, 'derived-later-date-control');
for (const [name, change] of [
  ['unknown version', p => { p.contentState.activeChains[id].definitionVersion = 999; }],
  ['string version', p => { p.contentState.activeChains[id].definitionVersion = '1'; }],
  ['wrong v1 node', p => { p.contentState.activeChains[id].nodeId = 'TEST-ONLY-other-node'; }],
  ['resolved v1 status', p => { p.contentState.activeChains[id].status = 'resolved'; }],
  ['empty actor', p => { p.contentState.activeChains[id].actorId = ''; }],
  ['negative startedAt', p => { p.contentState.activeChains[id].startedAt = -1; }],
  ['wrong instance', p => { p.contentState.activeChains[id].instanceId = 'content:wrong:1'; }],
  ['wrong creation key', p => { p.contentState.activeChains[id].instanceKey = id + ':2'; }],
  ['wrong definition id', p => { p.contentState.activeChains[id].defId = 'wrong'; }],
  ['wrong identity schema', p => { p.contentState.activeChains[id].episodeSchemaVersion = 2; }],
  ['v1 resolved node set', p => { p.contentState.activeChains[id].resolvedNodeIds = ['shortage_choice']; }],
  ['v1 nonempty history', p => { p.contentState.activeChains[id].history = [clone(JSON.parse(oldRationRaw).payload.contentState.history.at(-1))]; }],
  ['already completed episode', p => { p.contentState.completedChains.push(p.contentState.activeChains[id].instanceKey); }],
  ['already applied real v1 choice', p => { p.contentState.appliedEffects = clone(JSON.parse(oldRationRaw).payload.contentState.appliedEffects); }],
  ['real settled history conflict', p => { p.contentState.history = clone(JSON.parse(oldRationRaw).payload.contentState.history); }],
  ...['instanceKey', 'instanceId', 'defId', 'episodeSchemaVersion'].map(key => ['declared v1 missing ' + key, p => { delete p.contentState.activeChains[id][key]; }]),
  ['missing version with new schema marker', p => { delete p.contentState.activeChains[id].definitionVersion; }],
]) test('v1 adapter rejects derived invalid input: ' + name, () => {
  const p = clone(activePayload); change(p); const { result } = validatePure(p); assert.equal(result.ok, false);
}, 'derived-invalid-v1-adapter-input');
test('v1 button token is stale after migration and cannot silently settle a v2 choice', () => {
  const r = runtime(activeRaw), stale = { ...token(r), expectedDefinitionVersion: 1 }, before = protectedFacts(r.api.state), seq = r.api.state.worldMeta.eventSeq;
  assert.equal(resolve(r, 'forage', 'v1-stale-button', stale).ok, false); assert.deepEqual(protectedFacts(r.api.state), before);
  assert.equal(events(r, 'content.chain.resolved', seq).length, 0); assert.ok(events(r, 'command.rejected', seq).length);
  assert.equal(resolve(r, 'ration', 'v2-current-button').ok, true);
});
test('current v2 ration only records confirmation and duplicate does not add any payment or reward', () => {
  const r = runtime(activeRaw), before = protectedFacts(r.api.state), expected = token(r), seq = r.api.state.worldMeta.eventSeq;
  assert.equal(resolve(r, 'ration', 'v2-ration-once', expected).ok, true);
  const after = protectedFacts(r.api.state); assert.deepEqual(after.resources, before.resources); assert.deepEqual(after.content.meters, before.content.meters);
  assert.equal(after.content.history.length, before.content.history.length + 1); assert.equal(after.content.history.at(-1).payload.route, 'ration');
  assert.equal(events(r, 'content.chain.resolved', seq).length, 1); const saved = clone(r.api.state);
  assert.equal(resolve(r, 'ration', 'v2-ration-once', expected).duplicate, true); assert.deepEqual(clone(r.api.state), saved); save(r, 'v2-ration-once');
});
test('current v2 forage preserves finite food/resonance costs and uses only new history spelling', () => {
  const r = runtime(activeRaw), before = protectedFacts(r.api.state); click(r, 'forage');
  assert.equal(r.api.state.food, before.resources.food + 2); assert.equal(r.api.state.contentState.meters.resonancePressure, before.content.meters.resonancePressure + 2);
  assert.equal(r.api.state.contentState.flags[flag], true); assert.equal(r.api.state.energy, before.resources.energy);
  const entry = r.api.state.contentState.history.find(h => h.id.endsWith(id + ':forage'));
  assert.equal(entry.payload.resonancePressure, 2); assert.equal(Object.hasOwn(entry.payload, 'exposure'), false); save(r, 'v2-new-forage-history');
});
test('actual unhealthy quartermaster cannot collect v2 cache while confirmation remains available', () => {
  const r = runtime(activeRaw), npc = r.api.state.npcs.find(n => n.id === 'quartermaster'), enemy = JSON.parse(originalBytes).payload.worldZombies[0];
  assert.equal(r.p.damage(enemy, npc, 80).ok, true); assert.equal(npc.lifeState, 'critical');
  const ui = display(r); assert.equal(ui.b.disabled, true); assert.equal(ui.a.disabled, false);
  const before = protectedFacts(r.api.state); assert.equal(resolve(r, 'forage', 'v2-unhealthy-quartermaster').ok, false); assert.deepEqual(protectedFacts(r.api.state), before);
}, 'actual-source-damage-eligibility-control');
test('v2 cache remains spent after actual midnight, new episode and writer reload', () => {
  const r = runtime(activeRaw); click(r, 'forage'); for (let n = 0; n < 40; n++) assert.equal(r.p.advance(1).ok, true);
  assert.equal(active(r).instanceKey, id + ':2'); assert.equal(active(r).definitionVersion, 2);
  const second = runtime(save(r, 'v2-spent-cache-next-episode')), before = protectedFacts(second.api.state), ui = display(second);
  assert.equal(second.api.state.contentState.flags[flag], true); assert.equal(ui.b.disabled, true);
  assert.equal(resolve(second, 'forage', 'v2-cache-not-refilled').ok, false); assert.deepEqual(protectedFacts(second.api.state), before);
});
for (const phase of ['BATTLE', 'REPORT', 'LOSS', 'RECOVERY']) test('actual phase Gate rejects v2 choice in ' + phase, () => {
  const r = runtime(activeRaw); r.api.session.mode = phase; if (phase === 'BATTLE') r.api.state.night = true;
  const before = protectedFacts(r.api.state), seq = r.api.state.worldMeta.eventSeq;
  assert.equal(resolve(r, 'forage', 'v2-phase-' + phase).ok, false); assert.deepEqual(protectedFacts(r.api.state), before);
  assert.equal(events(r, 'content.chain.resolved', seq).length, 0);
}, 'explicit-session-phase-negative-control');
for (const [name, raw] of [['ration', oldRationRaw], ['forage', oldForageRaw]]) test('settled v1 ' + name + ' writer retains historical costs, receipts and cache without refund', () => {
  const p = JSON.parse(raw).payload, r = runtime(raw), before = protectedFacts(p);
  assert.deepEqual(protectedFacts(r.api.state), before); assert.equal(active(r), undefined);
  const seq = r.api.state.worldMeta.eventSeq; assert.equal(r.p.registry.startChain(id).ok, false); assert.deepEqual(protectedFacts(r.api.state), before);
  assert.equal(events(r, 'content.effects.applied', seq).length, 0);
  if (name === 'ration') assert.equal(r.api.state.contentState.meters.campCollapse, activePayload.contentState.meters.campCollapse + 2);
  else { const history = r.api.state.contentState.history.find(h => h.id.endsWith(id + ':forage')); assert.equal(history.payload.exposure, 2); assert.equal(Object.hasOwn(history.payload, 'resonancePressure'), false); assert.equal(r.api.state.contentState.flags[flag], true); }
  save(r, 'v1-settled-' + name + '-preserved');
});
test('actual next-day v1 active writer migrates without reviving its already spent cache', () => {
  const raw = baselineInputs['B-first-midnight'], p = JSON.parse(raw).payload, r = runtime(raw);
  assert.equal(p.contentState.activeChains[id].definitionVersion, 1); assert.equal(p.contentState.flags[flag], true);
  assert.deepEqual(clone(active(r)), { ...clone(p.contentState.activeChains[id]), definitionVersion: 2 }); assert.deepEqual(protectedFacts(r.api.state), protectedFacts(p));
  assert.equal(display(r).b.disabled, true); const before = protectedFacts(r.api.state);
  assert.equal(resolve(r, 'forage', 'v1-active-spent-cache').ok, false); assert.deepEqual(protectedFacts(r.api.state), before);
  save(r, 'v1-active-next-day-cache-preserved');
});
test('actual renderer shows current stock/basic ration, next midnight and additional consumption', () => {
  const r = runtime(activeRaw), ui = display(r); assert.equal(ui.a.dataset.eventDefinitionVersion, '2');
  assert.match(ui.text, /当前库存 2 份/); assert.match(ui.text, /基础日需 3 份/); assert.match(ui.text, /第 2 天 00:00/); assert.match(ui.text, /40 分钟后/);
  assert.match(ui.text, /个人用餐与据点维护另计/); assert.match(ui.a.html, /保留备用粮/); assert.match(ui.a.html, /不额外增加崩溃压力/); observations.currentRenderer = ui;
});
test('actual renderer explains a replenished old warning instead of claiming current shortage', () => {
  const r = runtime(baselineInputs['C-after-real-gather-before-midnight']), ui = display(r);
  assert.match(ui.text, /当前库存 4 份/); assert.match(ui.text, /当前基础供给已缓解/); assert.match(ui.text, /原预警/);
  assert.doesNotMatch(ui.text, /库存仅够短期使用/); assert.equal(active(r).instanceKey, activePayload.contentState.activeChains[id].instanceKey); observations.replenishedRenderer = ui;
});
test('renderer next midnight derives from the current calendar even for an older episode', () => {
  const r = runtime(activeRaw); for (let n = 0; n < 40; n++) assert.equal(r.p.advance(1).ok, true);
  assert.equal(active(r).instanceKey, id + ':1'); const ui = display(r); assert.match(ui.text, /第 3 天 00:00/); assert.match(ui.text, /1440 分钟后/);
});
test('same start A-confirm and D-defer have no extra numeric click tax at the first actual midnight', () => {
  const a = runtime(activeRaw), d = runtime(activeRaw), beforeA = protectedFacts(a.api.state), beforeD = protectedFacts(d.api.state);
  assert.deepEqual(beforeA, beforeD); click(a, 'ration');
  for (let i = 0; i < 40; i++) { assert.equal(a.p.advance(1).ok, true); assert.equal(d.p.advance(1).ok, true); }
  assert.equal(a.p.minute(), 1440); assert.equal(d.p.minute(), 1440);
  const afterA = protectedFacts(a.api.state), afterD = protectedFacts(d.api.state);
  assert.deepEqual(afterA.resources, afterD.resources); assert.deepEqual(afterA.content.meters, afterD.content.meters); assert.deepEqual(afterA.npcs, afterD.npcs);
  observations.firstMidnight = { A: { resources: afterA.resources, meters: afterA.content.meters, episode: clone(active(a)) }, D: { resources: afterD.resources, meters: afterD.content.meters, episode: clone(active(d)) }, scope: 'same derived writer and 40 actual one-minute advances; local click-tax parity only, not overall balance' };
  save(a, 'v2-A-confirm-first-midnight'); save(d, 'v2-D-defer-first-midnight');
});
const report = {
  runner: 'source-shortage-choice-v2', sourceHtmlSha256: sha(htmlBytes), checkerSha256: sha(fs.readFileSync(new URL(import.meta.url))), ioAdapterSha256: sha(adapterBytes), baselineReportSha256: sha(baselineBytes),
  sourceRefs: refs, artifacts, count: checks.length, ok: failures.length === 0, failures, checks, observations,
  scope: 'actual complete inline/runtime Gate, adapter, loader/writer, renderer and original DOM choice listeners; IO adapter controls DOM/storage/Date/schedulers and suppresses unrelated Canvas/HUD/world rendering after capturing the tested actual event renderer',
  inputClassification: { actualOldWriters: ['original-complete-writer', 'baseline common unresolved v1', 'baseline settled v1 ration', 'baseline settled v1 forage', 'baseline next-day active v1 spent cache', 'baseline actual post-gather writer'], existingPayloadFixture: legacyRel, derivedInvalidInputs: 'only known v1 adapter shapes; not a claim of complete global v2 node validation', receiptsFabricated: false },
  browserStarted: false, naturalGameplay: false, balanceValidated: false,
};
fs.writeFileSync(options['--out'], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ runner: report.runner, sourceHash: report.sourceHtmlSha256, checkerHash: report.checkerSha256, count: report.count, ok: report.ok, failures, baselineReportHash: report.baselineReportSha256 }, null, 2));
process.exitCode = report.ok ? 0 : 1;
