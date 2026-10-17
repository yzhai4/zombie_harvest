import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { root, saveKey, sourceRuntimeFactory } from './lib/source-runtime-fixture.mjs';

// Controlled boot/reload regression from the unedited real fresh04 terminal
// writer. This is not a new natural run. After boot only actual public UI acts;
// the optional harvest state is derived offline by the actual loader/writer.
const opts = {};
for (let i = 2; i < process.argv.length; i += 2) {
  assert.ok(['--html', '--expect-html-sha256', '--input', '--expect-input-sha256', '--out'].includes(process.argv[i]) && process.argv[i + 1],
    'usage: --html ABS --expect-html-sha256 SHA --input ORIGINAL_FRESH04_WRITER --expect-input-sha256 SHA --out NEW_ABS');
  opts[process.argv[i]] = process.argv[i + 1];
}
for (const flag of ['--html', '--input', '--out']) assert.ok(path.isAbsolute(opts[flag] || ''), `${flag} must be absolute`);
for (const flag of ['--expect-html-sha256', '--expect-input-sha256']) assert.match(opts[flag] || '', /^[a-f0-9]{64}$/);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const originalWriterSha256 = '0e91022d25944ee63d30f75efb3d0a9e57db795ea5d1708485c0449fb34700a9';
const originalHtmlSha256 = '32f911f69a6a962ae69a0325afcffd1c5d6d923c0efe1fb0ca8787c1959d9fae';
const out = opts['--out']; assert.equal(existsSync(out), false, 'new private output required; preserve every earlier result');
const source = readFileSync(opts['--html']), input = readFileSync(opts['--input']);
assert.equal(sha(source), opts['--expect-html-sha256'], 'explicit candidate byte binding');
assert.equal(sha(input), opts['--expect-input-sha256'], 'explicit original writer byte binding');
assert.equal(sha(input), originalWriterSha256, 'only the unchanged actual fresh04 terminal writer is the original scene');
mkdirSync(out, { recursive: true });
const runner = readFileSync(fileURLToPath(import.meta.url)), sprites = readFileSync(path.join(root, 'dist/actor-sprites.js'));
const helper = readFileSync(path.join(root, 'scripts/lib/source-runtime-fixture.mjs'));
const ioAdapter = readFileSync(path.join(root, 'scripts/check-report-recovery.mjs'));
for (const [name, bytes] of [['runner-executed.mjs', runner], ['source.html', source], ['original-fresh04-writer.json', input],
  ['actor-sprites-executed.js', sprites], ['source-runtime-fixture-executed.mjs', helper], ['io-adapter-executed.mjs', ioAdapter]]) writeFileSync(path.join(out, name), bytes);
const originalEnvelope = JSON.parse(input), original = originalEnvelope.payload || originalEnvelope;
const targetId = 'bld-mazjx8', plot = original.buildings.find(b => b.id === targetId);
assert.ok(plot && plot.type === 'garden' && plot.x === 7 && plot.y === 14 && !plot.planted && !plot.ready);
assert.equal(original.player.x, 7.000000000000014); assert.equal(original.player.y, 12.999999999999993);
const report = { schema: 'BrowserCropTargetV1', runner: 'browser-crop-target-v1', runnerSha256: sha(runner),
  sourceHtmlSha256: sha(source), expectedHtmlSha256: opts['--expect-html-sha256'], actorSpritesSha256: sha(sprites),
  sourceFixtureSha256: sha(input), originalHtmlSha256, sharedFixtureHelperSha256: sha(helper), ioAdapterSourceSha256: sha(ioAdapter),
  mode: 'real-natural-writer-controlled-boot-regression-plus-explicit-offline-greenhouse-derivative',
  naturalGameplay: false, naturalGameplayClaim: false, originalNaturalRunStatus: 'fresh04 FAILED; original report/save remain unchanged',
  fixtureInjectionAfterBoot: false, gameStateMutationAfterBoot: false, hiddenGameActionsAfterBoot: false,
  parameters: opts, checks: [], errors: [], documentHashes: [], scenes: [], plannedScenes: ['original-float-garden-plant', 'derived-ready-greenhouse-harvest'] };
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); };
const write = () => writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const clock = p => (p.day - 1) * 1440 + p.hour * 60 + p.minute;
const factory = sourceRuntimeFactory(opts['--html']);
const scenes = [{ name: 'original-float-garden-plant', operation: 'plant', type: 'garden', raw: input.toString('utf8'),
  changes: [], inputSha256: sha(input), origin: 'exact actual natural fresh04 writer; unedited bytes injected before loader in a new browser context' }];
const derived = factory([[saveKey, input.toString('utf8')]]);
assert.equal(derived.api.validate({ raw: input.toString('utf8'), sourceCategory: 'primary' }).ok, true);
assert.equal(derived.api.start().ok, true); derived.tasks.clear();
const greenhouse = derived.api.state.buildings.find(b => b.id === targetId);
Object.assign(greenhouse, { type: 'greenhouse', planted: true, ready: true, growth: 2 });
assert.equal(derived.api.save({ force: true, reason: 'TEST-ONLY offline ready greenhouse crop target derivative' }), true);
const harvestRaw = derived.storage.get(saveKey);
assert.equal(derived.api.validate({ raw: harvestRaw, sourceCategory: 'primary' }).ok, true);
writeFileSync(path.join(out, 'derived-ready-greenhouse-input.json'), harvestRaw);
scenes.push({ name: 'derived-ready-greenhouse-harvest', operation: 'harvest', type: 'greenhouse', raw: harvestRaw, inputSha256: sha(harvestRaw),
  origin: 'actual candidate loader/writer offline derivative of unchanged original real writer; not natural maturation',
  changes: [`TEST-ONLY same ${targetId} type garden->greenhouse; planted=true, ready=true, growth=2 before browser boot; exact player float coordinates retained`,
    'No enemies/resources/NPCs/clock/health are cleared or relocated; actual loader normalization and writer are recorded by the generated full input'] });
let browser; const contexts = [];
const server = createServer((req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route === '/' || route === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(source); }
  else if (route === '/actor-sprites.js') { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); res.end(sprites); }
  else { res.writeHead(404); res.end(); }
});
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const require = createRequire(import.meta.url), { chromium } = require(process.env.ZH_PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, channel: process.env.ZH_BROWSER_CHANNEL || 'chrome' });
  report.browserVersion = browser.version();
  for (const scene of scenes) {
    const result = { ...scene, raw: undefined, verified: false }; report.scenes.push(result);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(context);
    await context.addInitScript(({ key, raw }) => {
      if (!sessionStorage.getItem('qa-crop-target-seeded')) {
        localStorage.clear(); localStorage.setItem(key, raw); sessionStorage.setItem('qa-crop-target-seeded', 'yes');
      }
    }, { key: saveKey, raw: scene.raw });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', e => report.errors.push({ scene: scene.name, type: 'pageerror', message: e.message }));
    async function document(response, stage) {
      const hash = sha(await response.body()); report.documentHashes.push({ scene: scene.name, stage, sha256: hash });
      check(`${scene.name}: ${stage} actual HTTP document SHA`, response.ok() && hash === report.sourceHtmlSha256);
    }
    async function saved(label) {
      const raw = await page.evaluate(k => localStorage.getItem(k), saveKey); assert.ok(raw);
      writeFileSync(path.join(out, `${scene.name}-${label}-save.json`), raw);
      const e = JSON.parse(raw); return e.payload || e;
    }
    async function waitSaved(predicate, values, timeout = 18000) {
      await page.waitForFunction(({ key, body, values }) => { const raw = localStorage.getItem(key); if (!raw) return false;
        const e = JSON.parse(raw); return Function('p', 'v', `return (${body})(p,v)`)(e.payload || e, values);
      }, { key: saveKey, body: predicate.toString(), values }, { timeout });
    }
    await document(await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' }), 'boot');
    await page.locator('#continueSaveBtn').click();
    const crop = page.locator('[data-context-action="crop"]'); await crop.waitFor({ state: 'visible' });
    check(`${scene.name}: actual public crop control enabled`, await crop.isEnabled());
    const publicBefore = await crop.evaluate(b => ({ text: b.innerText, dataset: { ...b.dataset }, title: document.getElementById('contextTitle')?.textContent,
      position: document.getElementById('mapRegionLabel')?.textContent, time: document.getElementById('timeLabel')?.textContent }));
    result.publicBefore = publicBefore;
    check(`${scene.name}: public control binds same stable target`, publicBefore.dataset.buildingId === targetId);
    const before = await saved('before'), b = before.buildings.find(value => value.id === targetId);
    result.before = { worldMinute: clock(before), player: before.player, energy: before.energy, seeds: before.seeds, food: before.food, medicine: before.medicine, plot: b };
    check(`${scene.name}: exact natural floating-point position retained at boot`, before.player.x === original.player.x && before.player.y === original.player.y);
    check(`${scene.name}: original ten identities retained`, JSON.stringify(before.npcs.map(n => n.id)) === JSON.stringify(original.npcs.map(n => n.id)));
    await page.screenshot({ path: path.join(out, `${scene.name}-before.png`) });
    await crop.click();
    await waitSaved((p, v) => p.worldMeta.events.some(e => e.seq > v.seq && e.type === 'crop.changed'), { seq: before.worldMeta.eventSeq });
    const after = await saved('after'), a = after.buildings.find(value => value.id === targetId);
    const events = after.worldMeta.events.filter(e => e.seq > before.worldMeta.eventSeq);
    const successes = events.filter(e => e.type === 'crop.changed'), receipt = successes[0], proof = receipt?.payload;
    const command = after.worldMeta.replay.commands.find(c => c.commandId === receipt?.commandId && c.type === 'crop.change');
    const child = after.worldMeta.replay.commands.find(c => c.commandId === proof?.advance?.commandId && c.type === 'world.advance');
    const advance = events.find(e => e.commandId === child?.commandId && e.type === 'time.advanced');
    result.receipt = receipt; result.command = command; result.childCommand = child; result.advanceEvent = advance; result.interveningEvents = events;
    check(`${scene.name}: one success receipt for actual same target`, successes.length === 1 && proof?.proofVersion === 1 && proof.buildingId === targetId && proof.buildingType === scene.type && proof.operation === scene.operation);
    check(`${scene.name}: actual public command carries target identity`, !!command && command.payload.buildingId === targetId);
    check(`${scene.name}: target proof describes same live entity`, proof.target.id === targetId && proof.target.type === scene.type && proof.target.presentAtCompletion === true && a.id === b.id && a.type === b.type);
    const energyCost = scene.operation === 'plant' ? 4 : 6, seedCost = scene.operation === 'plant' ? 1 : 0;
    check(`${scene.name}: gross payment is separate from time recovery`, proof.payment.cost.energy === energyCost && proof.payment.cost.seeds === seedCost &&
      proof.payment.before.energy - proof.payment.after.energy === energyCost && proof.payment.before.seeds - proof.payment.after.seeds === seedCost);
    check(`${scene.name}: actual correlated 20 minute child and receipt`, child?.payload.minutes === 20 && advance?.payload.minutes === 20 &&
      advance.causationId === command.commandId && proof.advance.commandId === child.commandId && proof.advance.eventId === advance.eventId &&
      proof.advance.causationId === command.commandId && proof.clock.requestedMinutes === 20 && proof.clock.elapsedMinutes === 20);
    if (scene.operation === 'plant') {
      check(`${scene.name}: same plot planted and seed paid`, !b.planted && !b.ready && a.planted && !a.ready && a.growth === 0 && after.seeds === before.seeds - 1 &&
        !proof.target.before.planted && proof.target.afterAction.planted && !proof.target.afterAction.ready);
    } else {
      check(`${scene.name}: real greenhouse food and herb output`, b.planted && b.ready && !a.planted && !a.ready && a.growth === 0 && after.seeds === before.seeds &&
        proof.resources.afterAction.food - proof.resources.before.food === 3 && proof.resources.afterAction.medicine - proof.resources.before.medicine === 1 &&
        after.food === before.food + 3 && after.medicine === before.medicine + 1);
    }
    check(`${scene.name}: no rejection hidden behind success`, !events.some(e => e.type === 'command.rejected' && e.commandId === command.commandId));
    await page.screenshot({ path: path.join(out, `${scene.name}-after.png`) });
    await document(await page.reload({ waitUntil: 'domcontentloaded' }), 'reload');
    await page.locator('#continueSaveBtn').click();
    // A complete normal-timer checkpoint, not merely the unchanged input still
    // in localStorage, must have occurred before reload assertions are made.
    await waitSaved((p, v) => p.worldMeta.events.some(e => e.type === 'time.advanced' && e.seq > v.seq), { seq: after.worldMeta.eventSeq }, 20000);
    const reloaded = await saved('reloaded-normal-tick'), ar = reloaded.buildings.find(value => value.id === targetId);
    check(`${scene.name}: reload retains same crop state without second payment`, ar.id === a.id && ar.type === a.type && ar.planted === a.planted && ar.ready === a.ready && ar.growth === a.growth && reloaded.seeds === after.seeds);
    check(`${scene.name}: reload adds no crop command or receipt`, reloaded.worldMeta.events.filter(e => e.type === 'crop.changed' && e.seq > before.worldMeta.eventSeq).length === 1 &&
      reloaded.worldMeta.replay.commands.filter(c => c.type === 'crop.change').length === after.worldMeta.replay.commands.filter(c => c.type === 'crop.change').length);
    check(`${scene.name}: reload preserves original population identities`, JSON.stringify(reloaded.npcs.map(n => n.id)) === JSON.stringify(original.npcs.map(n => n.id)));
    await page.screenshot({ path: path.join(out, `${scene.name}-reloaded.png`) });
    result.after = { worldMinute: clock(after), energy: after.energy, seeds: after.seeds, food: after.food, medicine: after.medicine, plot: a };
    result.terminal = { day: reloaded.day, hour: reloaded.hour, minute: reloaded.minute, playerHP: reloaded.hp, energy: reloaded.energy,
      food: reloaded.food, medicine: reloaded.medicine, seeds: reloaded.seeds, roster: reloaded.npcs.length, living: reloaded.npcs.filter(n => n.lifeState !== 'dead').length, plot: ar };
    result.verified = true; await context.close(); write();
  }
  check('no actual browser runtime errors', report.errors.length === 0);
} catch (error) {
  report.errors.push({ type: 'runner', message: error.stack || String(error) });
  for (let i = 0; i < contexts.length; i++) for (const page of contexts[i].pages()) {
    try { await page.screenshot({ path: path.join(out, `failure-${i}.png`), timeout: 5000 }); } catch (e) { report.errors.push({ type: 'failure-screenshot', message: e.message }); }
  }
} finally {
  for (const context of contexts) await context.close().catch(e => report.errors.push({ type: 'context-close', message: e.message }));
  if (browser) await browser.close().catch(e => report.errors.push({ type: 'browser-close', message: e.message }));
  if (server.listening) await new Promise(resolve => server.close(resolve));
  report.cleanup = { contextsClosed: true, browserClosed: true, httpServerClosed: !server.listening };
  report.passed = report.checks.filter(c => c.ok).length; report.count = report.checks.length;
  report.ok = report.errors.length === 0 && report.passed === report.count && report.scenes.length === report.plannedScenes.length && report.scenes.every(s => s.verified) && report.documentHashes.length === 4;
  write(); console.log(JSON.stringify({ out, ok: report.ok, passed: report.passed, count: report.count, errors: report.errors,
    sourceHtmlSha256: report.sourceHtmlSha256, runnerSha256: report.runnerSha256, scenes: report.scenes.map(s => ({ name: s.name, verified: s.verified, terminal: s.terminal })), cleanup: report.cleanup }, null, 2));
}
if (!report.ok) process.exitCode = 1;
