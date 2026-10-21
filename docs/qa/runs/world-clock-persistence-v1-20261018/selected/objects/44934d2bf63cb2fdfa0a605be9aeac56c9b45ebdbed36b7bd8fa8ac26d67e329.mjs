import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

// V2: final string-credit contract; only original old writer preboot rate .5.
const a = {};
for (let i = 2; i < process.argv.length; i += 2) { assert.ok(process.argv[i + 1] && !Object.hasOwn(a, process.argv[i])); a[process.argv[i]] = process.argv[i + 1]; }
for (const k of ['--root', '--html', '--old-writer', '--out']) assert.ok(path.isAbsolute(a[k] || ''), k);
for (const k of ['--expect-html-sha256', '--expect-old-writer-sha256', '--expect-io-sha256', '--expect-factory-sha256']) assert.match(a[k] || '', /^[a-f0-9]{64}$/);
assert.ok(!Object.hasOwn(a, '--pending-field') && !Object.hasOwn(a, '--scenes'), 'v2 has one fixed legacy-rate scene; no seeded credit');
const sha = b => createHash('sha256').update(b).digest('hex'), clone = v => JSON.parse(JSON.stringify(v));
const bytes = p => fs.readFileSync(p), html = bytes(a['--html']), oldRaw = bytes(a['--old-writer']);
const ioPath = path.join(a['--root'], 'scripts/check-report-recovery.mjs'), factoryPath = path.join(a['--root'], 'scripts/lib/source-runtime-fixture.mjs');
assert.equal(sha(html), a['--expect-html-sha256']); assert.equal(sha(oldRaw), a['--expect-old-writer-sha256']);
assert.equal(sha(bytes(ioPath)), a['--expect-io-sha256']); assert.equal(sha(bytes(factoryPath)), a['--expect-factory-sha256']);
assert.ok(!fs.existsSync(a['--out'])); fs.mkdirSync(a['--out'], { recursive: true });
const out = a['--out'], write = (n, b) => fs.writeFileSync(path.join(out, n), b), json = (n, v) => write(n, JSON.stringify(v, null, 2) + '\n');
write('original-old-writer.json', oldRaw); write('producer-executed.mjs', bytes(fileURLToPath(import.meta.url)));
write('io-adapter-executed.mjs', bytes(ioPath)); write('source-runtime-fixture-executed.mjs', bytes(factoryPath));
const { sourceRuntimeFactory, saveKey } = await import(pathToFileURL(factoryPath).href), factory = sourceRuntimeFactory(a['--html']);
const old = JSON.parse(oldRaw).payload, field = 'subMinuteRemainder';
assert.equal(old.version, 21); assert.equal(old.npcs.length, 10); assert.equal(old.worldZombies.length, 4);
assert.equal(old.worldMeta.clock.paused, false); assert.equal(old.worldMeta.clock.rate, 1);
assert.ok(!Object.hasOwn(old.worldMeta.clock, field), 'this input must genuinely precede the new pending slot');
for (const k of ['generativeDialogue', 'observerCommentary', 'generatedWorldEvents', 'learnedWorldModel']) assert.equal(old.scenarioSnapshot.aiConfig[k], false);
const report = { schema: 'WorldClockHalfRateBrowserInputProductionV2', status: 'STARTED', sourceHtmlSha256: sha(html),
  originalWriter: { file: 'original-old-writer.json', sha256: sha(oldRaw), bytes: oldRaw.length }, pendingField: field,
  mode: 'TEST-ONLY-complete-old-writer-preboot-rate-half', noBusinessCommandsExecuted: true,
  browserExecuted: false, naturalGameplay: false, humanExperience: false, changes: [], scenes: [] };
try {
  const p = clone(old); p.worldMeta.clock.rate = .5;
  const legacyRaw = JSON.stringify({ version: p.version, payload: p, checksum: factory().api.hash(p), savedAt: p.world.totalMinutes, reason: 'TEST-ONLY preboot legal global rate .5; original missing pending slot' });
  const normalized = factory([[saveKey, legacyRaw]]);
  assert.equal(normalized.api.validate({ raw: legacyRaw, sourceCategory: 'primary' }).ok, true);
  assert.equal(normalized.api.start().ok, true); normalized.tasks.clear();
  assert.equal(Object.hasOwn(normalized.api.state.worldMeta.clock, field), false, 'missing legacy credit is read as zero without materialization');
  for (const k of ['hp', 'energy', 'food', 'wood', 'stone', 'parts', 'medicine', 'seeds', 'resources', 'worldZombies']) assert.deepEqual(clone(normalized.api.state[k]), clone(old[k]), 'no fixture gifts/deletions: ' + k);
  assert.deepEqual({ x: normalized.api.state.player.x, y: normalized.api.state.player.y }, { x: old.player.x, y: old.player.y });
  assert.deepEqual(clone(normalized.api.state.npcs.map(n => [n.id, n.hp, n.x, n.y])), old.npcs.map(n => [n.id, n.hp, n.x, n.y]));
  assert.equal(normalized.api.save({ force: true, reason: 'TEST-ONLY producer verify current normal writer' }), true);
  const currentRaw = normalized.storage.get(saveKey); assert.equal(normalized.api.validate({ raw: currentRaw, sourceCategory: 'primary' }).ok, true);
  assert.equal(Object.hasOwn(JSON.parse(currentRaw).payload.worldMeta.clock, field), false, 'no timer ran: normal writer preserves missing old integer-path slot');
  write('current-loader-writer-verification-native.json', currentRaw);
  const scenes = [];
  function add(id, raw, remainder, kind) { const file = id + '-input-native.json'; write(file, raw);
    scenes.push({ id, file, sha256: sha(raw), bytes: Buffer.byteLength(raw), expectedInitialRemainder: remainder, kind }); }
  add('legacy-half-rate', legacyRaw, '0', 'TEST-ONLY-old-complete-writer-rate-only-missing-pending');
  report.changes.push({ scene: 'legacy-half-rate', field: '$.payload.worldMeta.clock.rate', before: 1, after: .5 });
  report.scenes = scenes; report.status = 'PREPARATION_VERIFIED'; json('producer-report.json', report);
  const provenanceFiles = ['original-old-writer.json', 'producer-executed.mjs', 'io-adapter-executed.mjs', 'source-runtime-fixture-executed.mjs', 'current-loader-writer-verification-native.json', 'producer-report.json'].map(file => { const b = bytes(path.join(out, file)); return { file, sha256: sha(b), bytes: b.length }; });
  json('input-manifest.json', { schema: 'WorldClockHalfRateBrowserInputsV2', sourceHtmlSha256: sha(html), pendingField: field,
    unit: 'canonical-decimal-string-minutes', pendingRange: '[0,1)', clockPolicy: 'whole-minute-v1', rate: .5, paused: false, scenes, provenanceFiles, naturalGameplay: false,
    publicRateControlUsed: false, reason: 'No rate-setting public control has been located in baseline3545; explicit preboot fixture, not a public rate-change experiment' });
} catch (e) { report.status = 'PREPARATION_FAILED'; report.error = { name: e.name, message: e.message }; process.exitCode = 1; }
finally { json('producer-report.json', report); console.log(JSON.stringify(report)); }
