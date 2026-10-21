import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Preparation method only: explicitly TEST-ONLY complete-writer geometry.
// This program is not a browser run or a natural-play result.
const a = {};
for (let i = 2; i < process.argv.length; i += 2) {
  assert.ok(process.argv[i + 1] && !Object.hasOwn(a, process.argv[i]));
  a[process.argv[i]] = process.argv[i + 1];
}
for (const k of ['--root', '--html', '--mother', '--out']) assert.ok(path.isAbsolute(a[k] || ''), k);
for (const k of ['--expect-html-sha256', '--expect-mother-sha256', '--expect-io-sha256', '--expect-factory-sha256']) assert.match(a[k] || '', /^[a-f0-9]{64}$/);
const sha = b => createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(p), clone = v => JSON.parse(JSON.stringify(v));
const html = read(a['--html']), mother = read(a['--mother']);
const ioPath = path.join(a['--root'], 'scripts/check-report-recovery.mjs');
const factoryPath = path.join(a['--root'], 'scripts/lib/source-runtime-fixture.mjs');
assert.equal(sha(html), a['--expect-html-sha256']);
assert.equal(sha(mother), a['--expect-mother-sha256']);
assert.equal(sha(read(ioPath)), a['--expect-io-sha256']);
assert.equal(sha(read(factoryPath)), a['--expect-factory-sha256']);
assert.ok(!fs.existsSync(a['--out']), 'fresh preparation output required');
fs.mkdirSync(a['--out'], { recursive: true });
const out = a['--out'], write = (n, b) => fs.writeFileSync(path.join(out, n), b);
const json = (n, v) => write(n, JSON.stringify(v, null, 2) + '\n');
write('producer-executed.mjs', read(fileURLToPath(import.meta.url)));
write('source-native-mother.json', mother);
write('source-runtime-fixture-executed.mjs', read(factoryPath));
write('io-adapter-executed.mjs', read(ioPath));
const { sourceRuntimeFactory, saveKey } = await import(pathToFileURL(factoryPath).href);
const factory = sourceRuntimeFactory(a['--html']);
const originalEnvelope = JSON.parse(mother), original = originalEnvelope.payload;
assert.ok(original && original.version === 21 && !original.night && !original.gameOver);
assert.equal(original.npcs.length, 10); assert.equal(original.worldZombies.length, 4);
assert.equal(original.hp, 86); assert.ok(original.energy >= 5);
assert.equal(original.weapon.id, 'rustAxe');
assert.equal(original.worldMeta.clock.paused, false); assert.equal(original.worldMeta.clock.rate, 1);
assert.equal(original.worldZombies.filter(z => z.id === 'wz-4').length, 1);
const receipt = { schema: 'PlayerAttackBrowserPreparationV1', status: 'PREPARING', sourceHtmlSha256: sha(html),
  sourceDependencies: ['producer-executed.mjs', 'source-runtime-fixture-executed.mjs', 'io-adapter-executed.mjs'].map(file => {
    const b = read(path.join(out, file)); return { file, sha256: sha(b), bytes: b.length };
  }),
  mother: { file: 'source-native-mother.json', sha256: sha(mother), bytes: mother.length,
    actualWriter: true, reason: originalEnvelope.reason, day: original.day, hour: original.hour,
    minute: original.minute, eventSeq: original.worldMeta.eventSeq },
  mode: 'TEST-ONLY-full-original-writer-derived-target-geometry-before-browser-boot',
  noBusinessCommandsExecuted: true, naturalGameplay: false, humanExperience: false,
  browserExecuted: false, changes: [], scenes: [] };
try {
  const scenes = [];
  for (const [id, distance] of [['outer', 1.19], ['inner', 1.0]]) {
    const r = factory([[saveKey, mother.toString('utf8')]]);
    assert.equal(r.api.validate({ raw: mother.toString('utf8'), sourceCategory: 'primary' }).ok, true);
    assert.equal(r.api.start().ok, true, 'actual source loader starts complete mother');
    r.tasks.clear(); // IO scheduler has not executed a timer or business action.
    const before = clone(r.api.state), z = r.api.state.worldZombies.find(v => v.id === 'wz-4');
    const point = { x: r.api.state.player.x + distance, y: r.api.state.player.y };
    // Invoke the real collision predicate as a read, not an alternate geometry engine.
    r.context.__attackFixturePoint = point;
    assert.equal(vm.runInContext('canOccupyContinuous(state.worldZombies.find(z=>z.id==="wz-4"), __attackFixturePoint.x, __attackFixturePoint.y)', r.context), true,
      'declared fixture target geometry must pass original runtime collision predicate');
    delete r.context.__attackFixturePoint;
    const old = { x: z.x, y: z.y, prevX: z.prevX, prevY: z.prevY };
    Object.assign(z, { x: point.x, y: point.y, prevX: point.x, prevY: point.y });
    const after = clone(r.api.state), strippedBefore = clone(before), strippedAfter = clone(after);
    for (const s of [strippedBefore, strippedAfter]) {
      const t = s.worldZombies.find(v => v.id === 'wz-4');
      for (const k of ['x', 'y', 'prevX', 'prevY']) delete t[k];
    }
    assert.deepEqual(strippedAfter, strippedBefore, 'only declared target geometry changes');
    assert.equal(r.api.save({ force: true, reason: 'TEST-ONLY-player-attack-' + id + '-geometry' }), true);
    const raw = r.storage.get(saveKey), e = JSON.parse(raw), p = e.payload;
    assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true);
    const restored = factory([[saveKey, raw]]);
    assert.equal(restored.api.start().ok, true); restored.tasks.clear();
    assert.deepEqual(clone(restored.api.state.worldZombies), clone(p.worldZombies));
    assert.deepEqual(p.worldZombies.map(v => [v.id, v.hp]), original.worldZombies.map(v => [v.id, v.hp]));
    for (const key of ['hp', 'energy', 'wood', 'stone', 'food', 'parts', 'medicine', 'npcs', 'resources']) assert.deepEqual(p[key], original[key], key + ' not supplied or removed');
    const file = id + '-input-native.json'; write(file, raw);
    scenes.push({ id, file, sha256: sha(raw), bytes: Buffer.byteLength(raw), targetId: 'wz-4', declaredDistance: distance,
      kind: 'TEST-ONLY-complete-original-writer-derived-geometry-actual-loader-writer', motherSha256: sha(mother) });
    receipt.changes.push({ scene: id, path: '$.payload.worldZombies[id=wz-4]', keys: ['x', 'y', 'prevX', 'prevY'], before: old, after: point });
    receipt.scenes.push({ id, sourceLoaderOk: true, sourceWriterOk: true, secondSourceLoaderOk: true,
      npcCount: p.npcs.length, enemyIds: p.worldZombies.map(v => v.id), targetDistance: Math.hypot(p.player.x - point.x, p.player.y - point.y),
      eventSeq: p.worldMeta.eventSeq, sourceNative: scenes.at(-1) });
  }
  receipt.status = 'PREPARATION_VERIFIED';
  json('producer-report.json', receipt);
  const provenanceFiles = ['producer-report.json', 'producer-executed.mjs', 'source-native-mother.json',
    'source-runtime-fixture-executed.mjs', 'io-adapter-executed.mjs'].map(file => {
    const b = read(path.join(out, file)); return { file, sha256: sha(b), bytes: b.length };
  });
  json('input-manifest.json', { schema: 'PlayerDayAttackBrowserInputsV1', sourceHtmlSha256: sha(html),
    motherSha256: sha(mother), naturalGameplay: false, preparation: 'producer-report.json', provenanceFiles, scenes });
} catch (e) { receipt.status = 'PREPARATION_FAILED'; receipt.error = { name: e.name, message: e.message }; process.exitCode = 1; }
finally { json('producer-report.json', receipt); console.log(JSON.stringify(receipt)); }
