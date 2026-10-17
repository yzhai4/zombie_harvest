#!/usr/bin/env node
/** Actual complete inline runtime; method evidence only, not a browser.
 * commitPlanMeeting/generatePlanMeeting, CommandBus, calendar/effects/loader/
 * writer are preserved. The explicit original recovery IO adapter stubs
 * renderWorld/renderHud/renderContext, final bootstrap Canvas render, DOM/layout,
 * storage, native clocks and queued timer IO. Transient same-day resolved inputs
 * are TEST-ONLY and never saved. Legacy input is the pinned complete TEST-ONLY
 * original 412c writer artifact; no old HTML or old writer is run by this test.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

// Only the two pinned complete SAVE21 fixtures in these four legacy checks.
// This validates the exact additive Scenario receipt; it never removes arbitrary
// migrations or relaxes historical plan/resource/CP/population assertions.
function hasOnlyExpectedScenarioLegacyMigration(runtime, envelope) {
  const s = runtime.api.state, p = envelope.payload, eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  if (!['707889bd','7fde7715'].includes(envelope.checksum)) return false;
  const date = { day: p.day, hour: p.hour, minute: p.minute }, seq = p.worldMeta.eventSeq + 1;
  const expected = { eventId: `evt-${String(seq).padStart(6,'0')}`, seq, type: 'save.migrated', actorId: 'system', commandId: null, causationId: null,
    tick: { world: (p.day-1)*1440+p.hour*60+p.minute, phase: p.worldMeta.clock.phaseMinutes, schedule: p.worldMeta.clock.scheduleMinutes },
    payload: { migration: 'resolved-report-recovery-001', migrationVersion: 1, reason: 'scenario-legacy-unbound-v1,scenario-content-binding-v1', sourceCategory: 'primary',
      originalChecksum: envelope.checksum, originalDate: date, selectedChecksum: envelope.checksum, selectedDate: date, rollback: false, instanceId: null,
      fromSaveVersion: 21, fromContentVersion: 3, adapter: null, addedDomains: [], scenarioBindingAdapters: [{ adapter: 'scenario-legacy-unbound-v1',
        sourceSeed: p.worldMeta.seed, hadDeclaredSnapshot: Object.hasOwn(p,'scenarioSnapshot'), seedSource: 'saved-world-meta', declaredSeed: p.scenarioSnapshot?.seed ?? null,
        liveSeed: p.worldMeta.seed, aiDowngraded: false, effectiveAuthority: 'expression_only' }],
      scenarioContentAdapters: [{adapter:'scenario-content-binding-v1',oldPackageDigest:null,oldBindingStatus:'missing',
        compilerVersion:'scenario-event-chain-v1',catalogDigest:'fnv1a-utf16-canonical-hex-v1:33e5b74b',rulesDigest:'fnv1a-utf16-canonical-hex-v1:b19c6fb5'}] } };
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
    && eq(s.contentState.planMeeting,p.contentState.planMeeting) && s.contentState.commandPoints === p.contentState.commandPoints
    && eq(s.scenarioSnapshot.binding,{version:1,status:'legacy-unbound',sourceSeed:p.worldMeta.seed,declaredSnapshot:p.scenarioSnapshot??null})
    && s.scenarioSnapshot.seed === p.worldMeta.seed
    && eq(s.scenarioSnapshot.contentBinding,{version:1,status:'bound',compilerVersion:'scenario-event-chain-v1',
      catalogDigest:'fnv1a-utf16-canonical-hex-v1:33e5b74b',rulesDigest:'fnv1a-utf16-canonical-hex-v1:b19c6fb5',
      registry:[{kind:'eventDef',id:'relay-chain-001'},{kind:'eventChain',id:'zh-food-shortage-001'}]})
    && eq(written.scenarioSnapshot.contentBinding,s.scenarioSnapshot.contentBinding);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const usage = 'node scripts/check-plan-integrity.mjs [--html HTML] [--io-adapter RECOVERY_CHECKER] [--legacy-fixture JSON] [--out REPORT_JSON]';
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') { console.log(usage); process.exit(0); }
assert.ok(args.length % 2 === 0, usage);
const options = { '--html': path.join(repoRoot, 'dist/index.html'), '--io-adapter': path.join(scriptDir, 'check-report-recovery.mjs'),
  '--legacy-fixture': path.join(scriptDir, 'fixtures/plan-integrity/plan-committed-legacy-basewriter.json'), '--out': null };
const supplied = new Set();
for (let i = 0; i < args.length; i += 2) {
  assert.ok(Object.hasOwn(options,args[i]) && typeof args[i+1] === 'string' && args[i+1] && !args[i+1].startsWith('--') && !supplied.has(args[i]), usage);
  supplied.add(args[i]); options[args[i]] = path.resolve(args[i+1]);
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const saveKey = 'zombie-harvest-progress-v12';
const htmlPath = options['--html'], sourceBytes = readFileSync(htmlPath), source = sourceBytes.toString('utf8');
const adapterPath = options['--io-adapter'], adapterBytes = readFileSync(adapterPath), adapterSource = adapterBytes.toString('utf8');
const fixturePath = options['--legacy-fixture'], fixtureBytes = readFileSync(fixturePath), legacyRaw = fixtureBytes.toString('utf8');
const metaPath = fixturePath.replace(/\.json$/, '.meta.json');
assert.notEqual(metaPath,fixturePath,'legacy fixture must have .json extension and adjacent .meta.json');
const legacyMeta = JSON.parse(readFileSync(metaPath,'utf8')), legacyEnvelope = JSON.parse(legacyRaw);
const originalWriterSha = '412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8';
const originalFixtureSha = 'd9b8811fed88c25f9f1da0849d772d92e19742280f41e2aec3871d178d9bb05b';
assert.equal(legacyMeta.testOnly,true); assert.equal(legacyMeta.naturalGameplay,false); assert.equal(legacyMeta.receiptFabricated,false);
assert.equal(legacyMeta.acquiredBy,'actual complete base inline runtime CommandBus commit and saveProgress writer');
assert.equal(legacyMeta.writerHtmlSha256,originalWriterSha);
assert.equal(legacyMeta.fileSha256,originalFixtureSha); assert.equal(sha(fixtureBytes),originalFixtureSha);
assert.equal(legacyMeta.checksum,'707889bd'); assert.equal(legacyEnvelope.checksum,legacyMeta.checksum);
assert.equal(legacyMeta.saveVersion,21); assert.equal(legacyEnvelope.version,21);
assert.equal(legacyMeta.contentVersion,3); assert.equal(legacyEnvelope.payload.contentState.contentVersion,3);
assert.deepEqual(legacyMeta.declaredInputs,{campTrust:20,commandPointsBeforeCommit:2,action:'modify',selectedOriginalRank:2});
const originalPlan = legacyEnvelope.payload.contentState.planMeeting;
assert.equal(legacyMeta.instanceId,'camp-plan-meeting-001:d1'); assert.equal(originalPlan.instanceId,legacyMeta.instanceId);
assert.equal(originalPlan.status,'committed'); assert.equal(originalPlan.playerAction,'modify');
assert.equal(legacyEnvelope.payload.contentState.meters.campTrust,20); assert.equal(legacyEnvelope.payload.contentState.commandPoints,1);
const originalReceipts = legacyEnvelope.payload.worldMeta.events.filter(e=>e.type==='plan.meeting.committed');
assert.equal(originalReceipts.length,1);
const originalReceipt=originalReceipts[0];
assert.equal(originalReceipt.payload.pointsBefore,2);assert.equal(originalReceipt.payload.pointsAfter,1);
assert.equal(originalReceipt.payload.instanceId,originalPlan.instanceId);assert.equal(originalReceipt.payload.action,'modify');
assert.equal(originalReceipt.payload.selectedId,originalPlan.selectedId);
assert.equal(originalPlan.candidates.find(c=>c.rank===2)?.id,originalPlan.selectedId);
const originalCommands=legacyEnvelope.payload.worldMeta.replay.commands.filter(c=>c.commandId===originalReceipt.commandId&&c.type==='plan.meeting.commit');
assert.equal(originalCommands.length,1);assert.equal(originalCommands[0].payload.action,'modify');
assert.equal(originalCommands[0].payload.planId,originalPlan.selectedId);
const start = adapterSource.indexOf('function runtime(entries = []) {');
const end = adapterSource.indexOf('\nfunction envelope(payload)', start);
assert.ok(start >= 0 && end > start);
const runtimeAdapter = adapterSource.slice(start, end).trim();
function factory(text, filename) {
  const inline = [...text.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
  assert.equal(inline.length, 1); new vm.Script(inline[0]);
  return vm.runInNewContext(`(${runtimeAdapter})`, { inline, htmlPath: filename, saveKey, vm, assert, console, URLSearchParams });
}
const runtime = factory(source, htmlPath);
const fixtureProbe = runtime();
assert.equal(fixtureProbe.api.hash(legacyEnvelope.payload),legacyMeta.checksum,'actual source FNV must verify original payload');
assert.equal(fixtureProbe.api.validate({raw:legacyRaw,sourceCategory:'primary'}).ok,true,'actual source must validate complete original legacy envelope');
function currentRuntime(make = runtime, entries = []) {
  const r = make(entries);
  // Expose the actual existing functions to this VM only. The game definitions
  // stay intact; rendering and asynchronous timer IO are the adapter's scope.
  vm.runInContext('qa.advance = advance; qa.executePlan = executePlanMeeting;', r.context);
  r.emit('continueSaveBtn', 'click');
  assert.equal(r.api.started, true); assert.equal(r.api.session.mode, 'DAY');
  return r;
}
function seeded(trust = 80, points = 4, make = runtime) {
  const r = currentRuntime(make);
  r.api.state.contentState.meters.campTrust = trust;
  Object.assign(r.api.state.contentState, { commandPoints: points, commandPointsMax: points, commandPointsGrantedDay: r.api.state.day });
  const result = r.api.generatePlan({ source: 'TEST-ONLY original generation' });
  assert.equal(result.ok, true); return r;
}
const protectedFacts = r => clone({ contentState: r.api.state.contentState,
  resources: Object.fromEntries(['hp','wood','stone','food','seeds','parts','medicine','energy','sanity','morale'].map(k => [k,r.api.state[k]])),
  npcs: r.api.state.npcs, world: r.api.state.world, rng: r.api.state.worldMeta.rngState });
const events = (r, type) => clone(r.api.state.worldMeta.events.filter(e => e.type === type));
const report = { runner: 'source-plan-integrity', sourceHash: sha(sourceBytes), adapterSourceHash: sha(adapterBytes),
  evidence: 'complete-actual-inline-VM', browserStarted: false, naturalGameplayExecuted: false, changedFunctionsMocked: false,
  expectedBaselineDefects: sha(sourceBytes) === originalWriterSha,
  ioMocks: { dom: 'in-memory nodes without native layout/focus', storage: 'Map-backed local/session storage', clocks: 'controlled Date.now/performance.now',
    timers: 'queued callbacks; asynchronous real-time callbacks not run', bootstrap: 'unrelated final Canvas render omitted',
    replacedRenderingFunctions: ['renderWorld','renderHud','renderContext'],
    preservedFunctions: ['commitPlanMeeting','generatePlanMeeting','CommandBus','advance','runWorldDayUpkeep','executePlanMeeting','loadProgress','saveProgress'] },
  fixtureBoundary: 'declared input states; transient same-day resolved/fallback inputs are never written/booted; pinned old fixture loaded without executing old HTML',
  checks: [], failures: [] };
function check(name, ok, detail = {}) {
  report.checks.push({ name, ok: !!ok, detail }); if (!ok) report.failures.push(name);
}
function scenario(name, run) {
  try { run(); } catch (error) { check(name + ' executes', false, { error: String(error.stack || error) }); }
}


const diagnosticDir=path.dirname(fileURLToPath(import.meta.url));
const first=currentRuntime(runtime,[[saveKey,legacyRaw]]), raw1=first.storage.get(saveKey), state1=clone(first.api.state);
writeFileSync(path.join(diagnosticDir,'actual-first-native.json'),raw1);
writeFileSync(path.join(diagnosticDir,'actual-first-runtime.json'),JSON.stringify(state1,null,2)+'\n');
const second=currentRuntime(runtime,[[saveKey,raw1]]),raw2=second.storage.get(saveKey);
writeFileSync(path.join(diagnosticDir,'actual-reloaded-native.json'),raw2);
writeFileSync(path.join(diagnosticDir,'actual-reloaded-runtime.json'),JSON.stringify(clone(second.api.state),null,2)+'\n');
writeFileSync(path.join(diagnosticDir,'actual-migration-payloads.json'),JSON.stringify({first:events(first,'save.migrated'),second:events(second,'save.migrated'),firstValid:first.api.validate({raw:raw1,sourceCategory:'primary'}),secondValid:second.api.validate({raw:raw2,sourceCategory:'primary'})},null,2)+'\n');
