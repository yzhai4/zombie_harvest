import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2]), htmlPath = path.resolve(process.argv[3]);
const out = path.dirname(fileURLToPath(import.meta.url)), refs = [];
const sha = value => createHash('sha256').update(value).digest('hex');
const copy = (relative, bytes, kind, source = undefined) => {
  const target = path.join(out, relative); assert.ok(!fs.existsSync(target)); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
  refs.push({ path: relative, sha256: sha(Buffer.from(bytes)), kind, ...(source ? { rootRelativeSource: source } : {}) });
};
const sourceBytes = fs.readFileSync(htmlPath), source = sourceBytes.toString('utf8');
assert.equal(sha(sourceBytes), '6b8ea0f508265fcc439ceba2bd1aab8a88c1c31169709883cb8e0162a7bc151f');
const originalRel = 'docs/qa/runs/shortage-choice-v2-20261017/natural-baseline/fresh04/terminal-before-cleanup-save.json';
const inputBytes = fs.readFileSync(path.join(root, originalRel)), raw = inputBytes.toString('utf8');
assert.equal(sha(inputBytes), '0e91022d25944ee63d30f75efb3d0a9e57db795ea5d1708485c0449fb34700a9');
const adapterRel = 'scripts/check-report-recovery.mjs', adapterBytes = fs.readFileSync(path.join(root, adapterRel)), adapter = adapterBytes.toString('utf8');
assert.equal(sha(adapterBytes), 'ee5bb659c0439044e1ec07a4aecf931293457c2478f35d0850fe90770b4367cf');
const helperRel = 'scripts/report_recovery_full.py', helperBytes = fs.readFileSync(path.join(root, helperRel));
assert.equal(sha(helperBytes), 'f7d7d0ecc6f5523a545b71be229bf493236f4dfae7400a1156e037d9b7687d31');
copy('inputs/source.html', sourceBytes, 'executed-full-inline-runtime');
copy('inputs/original-fresh04-writer.json', inputBytes, 'unchanged-original-complete-browser-writer', originalRel);
copy('inputs/io-adapter.mjs', adapterBytes, 'actual-full-inline-io-adapter', adapterRel);
copy('inputs/report_recovery_full.py', helperBytes, 'unchanged-executed-python-evidence-helper', helperRel);
copy('inputs/report_recovery_fixtures.py', fs.readFileSync(path.join(root, 'scripts/report_recovery_fixtures.py')), 'unchanged-python-import-dependency', 'scripts/report_recovery_fixtures.py');
const inline = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(t => t.trim());
assert.equal(inline.length, 1); new vm.Script(inline[0]);
let body = adapter.slice(adapter.indexOf('function runtime(entries = []) {'), adapter.indexOf('\nfunction envelope(payload)'));
const marker = '  const api = context.qa;\n  api.instrumentRendering();'; assert.equal(body.split(marker).length, 2);
body = body.replace(marker, '  vm.runInContext("qa.harvest = { renderContext, stop: stopWorldSimulation, minute: worldMinute };", context);\n' + marker);
const factory = new Function('inline', 'htmlPath', 'vm', 'assert', body + '\nreturn runtime;')(inline, 'executed-runtime.html', vm, assert);
const saveKey = 'zombie-harvest-progress-v12';
function runtime(value) {
  const r = factory([[saveKey, value]]); assert.equal(r.api.validate({ raw: value }).ok, true); assert.equal(r.api.start().ok, true); r.api.harvest.stop(); assert.equal(r.api.session.mode, 'DAY'); return r;
}
function writer(r, name) {
  assert.equal(r.api.save(), true); const value = r.storage.get(saveKey); assert.equal(r.api.validate({ raw: value }).ok, true);
  copy('writers/' + name + '.json', value, 'actual-source-native-complete-writer'); return value;
}
const r = runtime(raw), gardenId = 'bld-mazjx8', garden = r.api.state.buildings.find(b => b.id === gardenId);
assert.ok(garden && garden.type === 'garden');
const originalGarden = JSON.parse(JSON.stringify(garden));
// Explicit TEST-ONLY derived scene setup; no receipt/history/resource/time is
// manufactured. All writer, harvest and reload records below come from source.
Object.assign(garden, { planted: true, ready: true, growth: 2 });
const beforeRaw = writer(r, 'before-harvest');
r.api.harvest.renderContext();
const match = [...r.node('contextActions').innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(m => /data-context-action="crop"/.test(m[1]));
assert.ok(match); assert.ok(!/(?:^|\s)disabled(?:\s|$)/.test(match[1])); assert.match(match[2], /收获/);
const attrs = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const dataset = Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith('data-')).map(([k,v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]));
assert.equal(dataset.buildingId, gardenId);
r.emit('contextActions', 'click', { target: { closest: () => ({ dataset, disabled: false }) } });
const afterRaw = writer(r, 'after-harvest');
const before = JSON.parse(beforeRaw).payload, after = JSON.parse(afterRaw).payload;
assert.equal(after.world.totalMinutes - before.world.totalMinutes, 20); assert.equal(garden.planted, false); assert.equal(garden.ready, false); assert.equal(garden.growth, 0); assert.equal(after.seeds, before.seeds);
const newEvents = after.worldMeta.events.filter(e => e.seq > before.worldMeta.eventSeq);
assert.equal(newEvents.filter(e => e.type === 'crop.changed').length, 1);
const reload = runtime(afterRaw); const reloadRaw = writer(reload, 'after-actual-reload');
assert.deepEqual(JSON.parse(reloadRaw).payload.buildings.find(b => b.id === gardenId), after.buildings.find(b => b.id === gardenId));
assert.deepEqual(JSON.parse(reloadRaw).payload.worldMeta.replay.commands.filter(c => c.type === 'crop.change'), after.worldMeta.replay.commands.filter(c => c.type === 'crop.change'));
const runnerBytes = fs.readFileSync(new URL(import.meta.url));
const report = { schema: 'CropPythonNativeSourceExecutionV1', terminal: { status: 'COMPLETED', exitCode: 0 }, sourceHtmlSha256: sha(sourceBytes), runnerSha256: sha(runnerBytes), originalWriterSha256: sha(inputBytes), ioAdapterSha256: sha(adapterBytes), pythonHelperSha256: sha(helperBytes), gardenId, refs,
  inputClassification: { initial: 'unchanged actual fresh04 complete writer', scene: 'TEST-ONLY derived mature garden: only original live garden planted=true ready=true growth=2 after actual loader; original fractional player retained', originalGarden, sourceWritesAllReceipts: true, inputHistoryUnmodified: true },
  actualPublicContext: { title: r.node('contextTitle').textContent, button: match[0], dataset },
  actualWindow: { beforeMinute: before.world.totalMinutes, afterMinute: after.world.totalMinutes, foodBefore: before.food, foodAfter: after.food, energyBefore: before.energy, energyAfter: after.energy, newEvents, newCommands: after.worldMeta.replay.commands.filter(c => !before.worldMeta.replay.commands.some(b => b.commandId === c.commandId)) },
  ioScope: 'full actual inline; actual loader/SessionController/CommandBus/crop Gate/reducer/writer/context renderer/click listener; DOM/storage/clock/timer IO controlled, no timer callbacks fired; unrelated Canvas/HUD/world rendering suppressed after capturing actual context renderer', browserStarted: false, naturalGameplay: false };
fs.writeFileSync(path.join(out, 'source-execution.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.terminal.status, source: report.sourceHtmlSha256, runner: report.runnerSha256, gardenId, beforeMinute: before.world.totalMinutes, afterMinute: after.world.totalMinutes, events: newEvents.map(e => e.type), writerCount: 3 }));
