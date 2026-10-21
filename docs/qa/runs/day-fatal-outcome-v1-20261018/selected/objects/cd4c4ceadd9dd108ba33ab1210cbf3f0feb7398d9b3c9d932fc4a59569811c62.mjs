import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

// TEST-ONLY complete original writer derivation. No candidate execution at authoring.
const a = {};
for (let i = 2; i < process.argv.length; i += 2) { assert.ok(process.argv[i + 1] && !Object.hasOwn(a, process.argv[i])); a[process.argv[i]] = process.argv[i + 1]; }
for (const k of ['--root', '--html', '--mother', '--out']) assert.ok(path.isAbsolute(a[k] || ''), k);
for (const k of ['--expect-html-sha256', '--expect-mother-sha256', '--expect-io-sha256', '--expect-factory-sha256']) assert.match(a[k] || '', /^[a-f0-9]{64}$/);
const sha = b => createHash('sha256').update(b).digest('hex'), clone = v => JSON.parse(JSON.stringify(v)), read = p => fs.readFileSync(p);
const html = read(a['--html']), mother = read(a['--mother']);
const io = path.join(a['--root'], 'scripts/check-report-recovery.mjs'), factoryFile = path.join(a['--root'], 'scripts/lib/source-runtime-fixture.mjs');
assert.equal(sha(html), a['--expect-html-sha256']); assert.equal(sha(mother), a['--expect-mother-sha256']);
assert.equal(sha(read(io)), a['--expect-io-sha256']); assert.equal(sha(read(factoryFile)), a['--expect-factory-sha256']);
assert.ok(!fs.existsSync(a['--out']), 'fresh out required'); fs.mkdirSync(a['--out'], { recursive: true });
const out = a['--out'], write = (n, b) => fs.writeFileSync(path.join(out, n), b), json = (n, v) => write(n, JSON.stringify(v, null, 2) + '\n');
write('producer-executed.mjs', read(fileURLToPath(import.meta.url))); write('source-native-mother.json', mother);
write('io-adapter-executed.mjs', read(io)); write('source-runtime-fixture-executed.mjs', read(factoryFile));
const { sourceRuntimeFactory, saveKey } = await import(pathToFileURL(factoryFile).href), factory = sourceRuntimeFactory(a['--html']);
const original = JSON.parse(mother).payload;
assert.equal(original.version, 21); assert.equal(original.hp, 86); assert.equal(original.npcs.length, 10); assert.equal(original.worldZombies.length, 4);
assert.equal(original.weapon.id, 'rustAxe'); assert.equal(original.worldMeta.clock.rate, 1); assert.equal(original.worldMeta.clock.paused, false);
assert.ok(!original.gameOver && !original.night && original.energy >= 5); assert.equal(original.worldZombies.filter(z => z.id === 'wz-4').length, 1);
const receipt = { schema: 'DayFatalBrowserInputProductionV1', status: 'PREPARING', sourceHtmlSha256: sha(html),
  mode: 'TEST-ONLY-complete-original-writer-derived-low-HP-and-target-geometry', mother: { file: 'source-native-mother.json', sha256: sha(mother), bytes: mother.length },
  noBusinessCommandsExecuted: true, browserExecuted: false, naturalGameplay: false, humanExperience: false, changes: [], scenes: [] };
try {
  for (const [id, paused, trigger] of [['timer-day-fatal', false, 'real-world-timer'], ['attack-retaliation-day-fatal', true, 'public-F'], ['attack-retaliation-save-retry', true, 'public-F-testIO-first-fatal-primary-write-fails']]) {
    const r = factory([[saveKey, mother.toString('utf8')]]);
    assert.equal(r.api.validate({ raw: mother.toString('utf8'), sourceCategory: 'primary' }).ok, true);
    assert.equal(r.api.start().ok, true); r.tasks.clear();
    assert.equal(r.api.save({ force: true, reason: 'TEST-ONLY normalized control before DAY fatal fixture derivation' }), true);
    const controlRaw = r.storage.get(saveKey), control = JSON.parse(controlRaw).payload;
    write(id + '-before-derivation-native.json', controlRaw);
    const before = clone(r.api.state), target = r.api.state.worldZombies.find(z => z.id === 'wz-4');
    const point = { x: r.api.state.player.x + 1, y: r.api.state.player.y };
    r.context.__dayFatalFixturePoint = point;
    assert.equal(vm.runInContext('canOccupyContinuous(state.worldZombies.find(z=>z.id==="wz-4"), __dayFatalFixturePoint.x, __dayFatalFixturePoint.y)', r.context), true, 'actual source collision read');
    delete r.context.__dayFatalFixturePoint;
    r.api.state.hp = 4; r.api.state.worldMeta.clock.paused = paused;
    Object.assign(target, { x: point.x, y: point.y, prevX: point.x, prevY: point.y });
    const after = clone(r.api.state), x = clone(before), y = clone(after);
    for (const p of [x, y]) { delete p.hp; delete p.worldMeta.clock.paused; const z = p.worldZombies.find(v => v.id === 'wz-4'); for (const k of ['x','y','prevX','prevY']) delete z[k]; }
    assert.deepEqual(y, x, 'no undeclared state change');
    assert.equal(r.api.save({ force: true, reason: 'TEST-ONLY DAY fatal browser ' + id }), true);
    const raw = r.storage.get(saveKey), p = JSON.parse(raw).payload;
    assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true);
    const second = factory([[saveKey, raw]]); assert.equal(second.api.start().ok, true); second.tasks.clear();
    assert.equal(second.api.state.hp, 4); assert.equal(second.api.state.worldMeta.clock.paused, paused); assert.ok(!second.api.state.gameOver);
    assert.deepEqual(clone(second.api.state.worldZombies), p.worldZombies);
    assert.deepEqual(p.worldZombies.map(z => [z.id, z.hp]), original.worldZombies.map(z => [z.id, z.hp]), 'enemy identities/HP unchanged');
    for (const k of ['energy','food','wood','stone','parts','medicine','seeds','resources','npcs','player']) assert.deepEqual(p[k], control[k], 'actual writer before/after: no supplied/deleted/relocated ' + k);
    const file = id + '-input-native.json'; write(file, raw);
    const row = { id, file, sha256: sha(raw), bytes: Buffer.byteLength(raw), targetId: 'wz-4', trigger, paused, hp: 4, declaredDistance: 1,
      testIO: id.endsWith('save-retry'), expectedCause: paused ? 'attack-retaliation' : 'day-combat' };
    receipt.scenes.push(row); receipt.changes.push({ scene: id, fields: { hp: { before: before.hp, after: 4 }, 'worldMeta.clock.paused': { before: before.worldMeta.clock.paused, after: paused },
      'worldZombies[id=wz-4].geometry': { before: Object.fromEntries(['x','y','prevX','prevY'].map(k => [k, before.worldZombies.find(z => z.id === 'wz-4')[k]])), after: { ...point, prevX: point.x, prevY: point.y } } } });
  }
  receipt.status = 'PREPARATION_VERIFIED'; json('producer-report.json', receipt);
  const provenanceFiles = ['producer-report.json','producer-executed.mjs','source-native-mother.json','io-adapter-executed.mjs','source-runtime-fixture-executed.mjs', ...receipt.scenes.map(s => s.id + '-before-derivation-native.json')].map(file => { const b = read(path.join(out, file)); return { file, sha256: sha(b), bytes: b.length }; });
  json('input-manifest.json', { schema: 'DayFatalBrowserInputsV1', sourceHtmlSha256: sha(html), motherSha256: sha(mother), mode: receipt.mode, naturalGameplay: false, humanExperience: false,
    stateWritesAfterBoot: false, hiddenFatalCalls: 0, scenes: receipt.scenes, provenanceFiles });
} catch (e) { receipt.status = 'PREPARATION_FAILED'; receipt.error = { name: e.name, message: e.message }; process.exitCode = 1; }
finally { json('producer-report.json', receipt); console.log(JSON.stringify(receipt)); }
