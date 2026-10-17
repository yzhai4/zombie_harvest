import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

// TEST-ONLY complete old-writer-derived boot scenes. Browser actions after boot
// use visible public UI only. Canvas wrappers observe actual IO and always call
// the original methods; neither renderer nor GameState is replaced or patched.
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  assert.ok(['--repo-root', '--html', '--out', '--expect-html-sha256'].includes(process.argv[i]) && process.argv[i + 1], 'usage: --html ABSOLUTE_HTML --out NEW_ABSOLUTE_DIR --expect-html-sha256 SHA [--repo-root ABS]');
  options[process.argv[i]] = process.argv[i + 1];
}
assert.ok(path.isAbsolute(options['--html'] || '') && path.isAbsolute(options['--out'] || ''), 'absolute --html and --out required');
assert.match(options['--expect-html-sha256'] || '', /^[a-f0-9]{64}$/);
const root=options['--repo-root']||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');assert.ok(path.isAbsolute(root));
const {saveKey,sourceRuntimeFactory}=await import(pathToFileURL(path.join(root,'scripts/lib/source-runtime-fixture.mjs')).href);
const htmlPath = options['--html'], out = options['--out'];
assert.equal(existsSync(out), false, 'output directory must be new; preserve earlier runs');
mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const runnerPath = fileURLToPath(import.meta.url), runnerBytes = readFileSync(runnerPath);
const htmlBytes = readFileSync(htmlPath), sourceHash = sha(htmlBytes);
assert.equal(sourceHash, options['--expect-html-sha256'], 'input bytes match explicit expected SHA');
writeFileSync(path.join(out, 'runner-executed.mjs'), runnerBytes);
writeFileSync(path.join(out, 'source.html'), htmlBytes);
const helperPath = path.join(root, 'scripts/lib/source-runtime-fixture.mjs');
const harnessPath = path.join(root, 'scripts/check-report-recovery.mjs');
const metaPath = path.join(root, 'scripts/fixtures/npc-threat-attention-v1/capture-meta.json');
const metaBytes = readFileSync(metaPath), meta = JSON.parse(metaBytes);
const inputPath = path.join(root, meta.fixture.path), inputBytes = readFileSync(inputPath);
assert.equal(sha(inputBytes), meta.fixture.sha256, 'immutable original complete old writer');
const report = {
  runner: 'browser-outpost-presence-v1', runnerSha256: sha(runnerBytes),
  sourceHtmlSha256: sourceHash, expectedHtmlSha256: options['--expect-html-sha256'],
  sourceFixtureSha256: sha(inputBytes), captureMetaSha256: sha(metaBytes),
  sharedFixtureHelperSha256: sha(readFileSync(helperPath)), ioAdapterSourceSha256: sha(readFileSync(harnessPath)),
  mode: 'derived-complete-old-writer-boot-fixture-with-public-browser-actions',
  naturalGameplay: false, naturalGameplayClaim: false, productionCapture: false,
  fixtureInjectionAfterBoot: false, gameStateMutationAfterBoot: false,
  fixtureProvenance: meta, checks: [], errors: [], documentHashes: [], scenes: [],
  canvasEvidence: 'actual renderActorsCanvas IO; original clearRect/fillText always execute; completed frame labels plus screenshots',
  crossDayBrowser: 'pending',
};
const check = (name, ok, detail) => {
  report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) });
  assert.ok(ok, name);
};
const factory = sourceRuntimeFactory(htmlPath);
function load(raw) {
  const r = factory([[saveKey, raw]]);
  assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true);
  assert.equal(r.api.start().ok, true); r.tasks.clear(); return r;
}
function writeScene(r, name, changes) {
  assert.equal(r.api.save({ force: true, reason: 'TEST-ONLY derived browser presence fixture' }), true);
  const raw = r.storage.get(saveKey);
  assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true);
  const file = `${name}-input-save.json`; writeFileSync(path.join(out, file), raw);
  report.scenes.push({ name, inputFile: file, inputSha256: sha(raw), changes });
  return raw;
}
function moderate(r) {
  r.api.state.npcs.forEach(n => {
    n.needs = { ...n.needs, hunger: 10, fatigue: 10, stress: 20, social: 10, safety: 10, energy: 90 };
    n.needClock = 0; n.motionTarget = null;
    n.eventChain = { ...n.eventChain, cooldown: 1000 };
  });
}
const isolated = load(inputBytes.toString('utf8'));
isolated.api.state.worldZombies = []; isolated.api.state.zombies = [];
const waterMill = isolated.api.state.landmarks.find(l => l.type === 'waterMill');
isolated.api.state.player.x = waterMill.x; isolated.api.state.player.y = waterMill.y;
vm.runInContext('qa.qaDiscover = discoverLandmark; qa.qaCaptureGate = outpostCaptureGate;', isolated.context);
if (!waterMill.found) assert.equal(isolated.api.qaDiscover(waterMill, { commandId: 'TEST-ONLY-browser-presence-discover-waterMill' }).ok, true);
isolated.tasks.clear(); moderate(isolated);
const expectedGuards = Array.from(isolated.api.qaCaptureGate('waterMill').guards, n => n.id);
assert.equal(expectedGuards.length, 2);
expectedGuards.forEach((id, i) => Object.assign(isolated.api.state.npcs.find(n => n.id === id), { x: 11.4 + i * 1.2, y: 9 }));
Object.assign(isolated.api.state.npcs.find(n => n.id === 'doctor'), { x: 13, y: 9 });
const captureRaw = writeScene(isolated, 'capture', [
  'actual candidate loader consumes immutable complete automation-browser writer input; original source route remains FAILED',
  'offline derived isolation removes existing world/event enemies; no gameplay survival claim',
  'player placed at authored waterMill; actual discoverLandmark command discovers it before browser boot',
  'offline NPC needs set moderate, needClock zero, story cooldown 1000, motionTarget null',
  'two actual selected guards placed adjacent to player; local doctor at authored infirmary for visible positive control',
  'actual candidate writer emits complete validated input; no browser post-boot state mutations',
]);
report.expectedGuardIds = expectedGuards;
const guardNames = vm.runInContext('selectOutpostGuards("waterMill").map(n => NPC_TEMPLATES[n.id].name)', isolated.context);
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.ZH_PLAYWRIGHT_MODULE || 'playwright');
const server = createServer((req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route === '/' || route === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(htmlBytes); }
  else if (route === '/actor-sprites.js') { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); res.end(readFileSync(path.join(root, 'dist/actor-sprites.js'))); }
  else { res.writeHead(404); res.end(); }
});
let browser;
const contexts = [];
async function boot(raw, name) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(context);
  await context.addInitScript(({ key, raw }) => {
    if (!sessionStorage.getItem('qa-presence-seeded')) {
      localStorage.clear(); localStorage.setItem(key, raw); sessionStorage.setItem('qa-presence-seeded', 'yes');
    }
    window.__qaCanvasFrames = [];
    const frames = new WeakMap();
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.closest('#world')) {
        const frame = { at: performance.now(), labels: [] };
        frames.set(this.canvas, frame); window.__qaCanvasCurrent = frame;
        window.__qaCanvasFrames.push(frame); if (window.__qaCanvasFrames.length > 160) window.__qaCanvasFrames.shift();
      }
      return clear.apply(this, args);
    };
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      const frame = frames.get(this.canvas); if (frame) frame.labels.push(String(args[0]));
      return fill.apply(this, args);
    };
  }, { key: saveKey, raw });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push({ scene: name, type: 'pageerror', message: error.message }));
  const document = async response => {
    assert.ok(response?.ok()); const hash = sha(await response.body());
    report.documentHashes.push({ scene: name, sha256: hash }); check(`${name}: main document exact bytes`, hash === sourceHash);
  };
  await document(await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' }));
  await page.locator('#continueSaveBtn').click();
  const saved = async () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).payload, saveKey);
  const waitSaved = async predicate => { await page.waitForFunction(({ key, body }) => Function('p', `return (${body})(p)`)(JSON.parse(localStorage.getItem(key)).payload), { key: saveKey, body: predicate.toString() }); return saved(); };
  const captureSave = async label => { const raw = await page.evaluate(key => localStorage.getItem(key), saveKey); writeFileSync(path.join(out, `${name}-${label}-save.json`), raw); return JSON.parse(raw).payload; };
  const canvas = async label => {
    await page.waitForTimeout(1600);
    const frames = await page.evaluate(() => window.__qaCanvasFrames.slice(-2));
    writeFileSync(path.join(out, `${name}-${label}-canvas.json`), JSON.stringify(frames, null, 2));
    return frames;
  };
  const reload = async () => { await document(await page.reload({ waitUntil: 'domcontentloaded' })); await page.locator('#continueSaveBtn').click(); };
  return { page, context, saved, waitSaved, captureSave, canvas, reload };
}
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, channel: process.env.ZH_BROWSER_CHANNEL || 'chrome' });
  report.browserVersion = browser.version();
  const b = await boot(captureRaw, 'capture'), { page } = b;
  check('public capture button is visible', await page.locator('[data-context-action="captureOutpost"]').isVisible());
  check('public capture button is enabled', await page.locator('[data-context-action="captureOutpost"]').isEnabled());
  const beforeFrames = await b.canvas('before');
  check('actual canvas before capture draws both future guards', guardNames.every(name => beforeFrames.some(frame => frame.labels.includes(name))));
  check('actual canvas positive local doctor visible', beforeFrames.some(frame => frame.labels.includes('苏禾')));
  await page.screenshot({ path: path.join(out, 'capture-before-map.png') });
  await page.locator('[data-context-action="captureOutpost"]').click();
  const after = await b.waitSaved(p => p.contentState.outposts.waterMill?.guardNpcIds?.length === 2);
  check('public capture preserves all ten people', after.npcs.length === 10 && after.npcs.every(n => n.lifeState !== 'dead'));
  check('public capture recorded exact two guards', JSON.stringify(after.contentState.outposts.waterMill.guardNpcIds) === JSON.stringify(expectedGuards));
  check('public capture bilateral markers agree', expectedGuards.every(id => after.npcs.find(n => n.id === id).garrisonedOutpostId === 'waterMill'));
  check('public capture has command and successful event', after.worldMeta.replay.commands.some(c => c.type === 'outpost.capture') && after.worldMeta.events.some(e => e.type === 'outpost.captured' && e.payload.outpostId === 'waterMill'));
  const afterFrames = await b.canvas('after');
  check('actual canvas completed frames omit away guard labels', afterFrames.length >= 2 && afterFrames.every(frame => guardNames.every(name => !frame.labels.includes(name))));
  check('actual canvas retains local doctor after capture', afterFrames.some(frame => frame.labels.includes('苏禾')));
  await page.screenshot({ path: path.join(out, 'capture-after-map.png') });
  await page.keyboard.press('v');
  check('full roster has ten visible cards', await page.locator('#survivorList [data-npc]').count() === 10);
  for (const id of expectedGuards) {
    const card = page.locator(`#survivorList [data-npc="${id}"]`);
    check(`${id}: roster card visible and disabled`, await card.isVisible() && await card.isDisabled());
    check(`${id}: roster declares outpost presence`, (await card.innerText()).includes('驻守废弃水车'));
  }
  check('local doctor roster card remains enabled', await page.locator('#survivorList [data-npc="doctor"]').isEnabled());
  check('roster discloses 8 local / 2 garrison / 10 alive', /在营地：8.*驻守：2.*存活：10\/10/.test(await page.locator('#npcHint').innerText()));
  await page.screenshot({ path: path.join(out, 'capture-after-roster.png') });
  await page.locator('#infoModalClose').click();
  const contextNpcIds = await page.locator('#contextActions [data-npc-id]').evaluateAll(elements => elements.map(e => e.dataset.npcId));
  check('public context offers no away guard orders', expectedGuards.every(id => !contextNpcIds.includes(id)));
  const seq = (await b.saved()).worldMeta.eventSeq;
  await page.keyboard.press('e');
  await page.waitForFunction(({ key, seq }) => JSON.parse(localStorage.getItem(key)).payload.worldMeta.events.some(e => e.seq > seq && e.type === 'npc.dialogueOpened'), { key: saveKey, seq });
  const afterE = await b.saved();
  const interacted = afterE.worldMeta.events.filter(e => e.seq > seq && e.type === 'npc.dialogueOpened');
  const interactions = interacted.map(e => afterE.worldMeta.replay.commands.find(c => c.commandId === e.commandId));
  writeFileSync(path.join(out, 'capture-e-receipts.json'), JSON.stringify({ interacted, interactions }, null, 2));
  check('single E opens actual local doctor dialogue without claiming support', interacted.length === 1 && interactions.length === 1 &&
    interactions[0]?.type === 'npc.interact' && interactions[0].payload.npcId === 'doctor' && interactions[0].actorId === 'player-1' &&
    interacted[0].actorId === 'player-1' && interacted[0].payload.proofVersion === 1 && interacted[0].payload.npcId === 'doctor' &&
    interacted[0].payload.operation === 'dialogue-open' && interacted[0].payload.payment.cost.energy === 0 &&
    interacted[0].payload.clock.requestedMinutes === 0 && interacted[0].payload.clock.elapsedMinutes === 0 && interacted[0].payload.advance === null &&
    !afterE.npcs.find(n => n.id === 'doctor').supportRequested && !afterE.worldMeta.events.some(e => e.seq > seq && e.type === 'npc.interacted'));
  check('E never targets an away guard', interactions.every(c => c && !expectedGuards.includes(c.payload.npcId)) && expectedGuards.every(id => !afterE.npcs.find(n => n.id === id).supportRequested));
  const preReload = await b.captureSave('before-reload');
  await b.reload();
  await page.waitForTimeout(1600);
  const reloaded = await b.captureSave('after-reload');
  check('reload preserves ten identities and occupancy', JSON.stringify(reloaded.npcs.map(n => n.id)) === JSON.stringify(preReload.npcs.map(n => n.id)) && expectedGuards.every(id => reloaded.npcs.find(n => n.id === id).garrisonedOutpostId === 'waterMill'));
  check('reload retains authoritative guard record', JSON.stringify(reloaded.contentState.outposts.waterMill.guardNpcIds) === JSON.stringify(expectedGuards));
  const reloadFrames = await b.canvas('reloaded');
  check('reloaded actual canvas still omits away guards', reloadFrames.length >= 2 && reloadFrames.every(frame => guardNames.every(name => !frame.labels.includes(name))));
  await page.keyboard.press('v');
  check('reloaded roster retains all ten and disabled guards', await page.locator('#survivorList [data-npc]').count() === 10 && (await Promise.all(expectedGuards.map(id => page.locator(`#survivorList [data-npc="${id}"]`).isDisabled()))).every(Boolean));
  await page.screenshot({ path: path.join(out, 'capture-reloaded-roster.png') });
  await page.locator('#infoModalClose').click();
  await page.screenshot({ path: path.join(out, 'capture-reloaded-map.png') });
  const currentRaw = await page.evaluate(key => localStorage.getItem(key), saveKey);
  await b.context.close(); contexts.splice(contexts.indexOf(b.context), 1);

  const midnight = load(currentRaw), s = midnight.api.state;
  s.worldZombies = []; s.zombies = []; moderate(midnight);
  s.day = 1; s.hour = 23; s.minute = 40; s.world.totalMinutes = 1420;
  s.world.lastRationDay = 1; s.world.lastDailyUpkeepDay = 1;
  s.contentState.outposts.waterMill.lastUpkeepDay = 1;
  s.food = 30; s.player.x = 9; s.player.y = 12;
  s.npcs.filter(n => !n.garrisonedOutpostId).forEach((n, i) => { n.x = 1 + i; n.y = 1; });
  const awayMemoriesBeforeTraining = Object.fromEntries(expectedGuards.map(id => [id, JSON.stringify(s.npcs.find(n => n.id === id).memory?.importantEvents || [])]));
  const midnightRaw = writeScene(midnight, 'midnight', [
    'actual loader consumes first browser scene current writer save with genuine public capture receipts',
    'offline derived calendar set day1 23:40 and daily/ration/upkeep watermarks to day1; player moved to authored barracks',
    'offline isolation clears existing threats, sets shared food30 and moderate NPC needs; local NPCs relocated away from barracks context',
    'public browser training advances 30 real runtime minutes across midnight; not natural play or balance evidence',
  ]);
  const m = await boot(midnightRaw, 'midnight');
  const training = m.page.locator('[data-context-action="area"]');
  check('public barracks training visible', await training.isVisible() && (await training.innerText()).includes('兵营'));
  await training.click();
  const crossed = await m.waitSaved(p => p.day === 2 && p.world.lastRationDay === 2 && p.contentState.outposts.waterMill.lastUpkeepDay === 2);
  check('public 30 minute training crosses actual midnight', crossed.day === 2 && crossed.hour === 0 && crossed.minute >= 10 && crossed.minute < 20);
  check('global ration retains living ten population base', crossed.npcs.length === 10 && crossed.world.lastRationDay === 2 && crossed.food === 26, { food: crossed.food, expectedFood: 30 - Math.max(2, Math.ceil(10 * .28)) - 1 });
  const upkeep = crossed.worldMeta.events.filter(e => e.type === 'outpost.upkeep' && e.payload.day === 2 && e.payload.outpostId === 'waterMill');
  check('outpost upkeep is separately paid once', upkeep.length === 1 && upkeep[0].payload.paid === 1);
  check('away guards receive no local training memory', expectedGuards.every(id => JSON.stringify(crossed.npcs.find(n => n.id === id).memory?.importantEvents || []) === awayMemoriesBeforeTraining[id]));
  check('local guard receives actual training memory positive control', (crossed.npcs.find(n => n.id === 'guardJiang').memory?.importantEvents || []).some(e => e.includes('在兵营完成换防训练')));
  await m.captureSave('crossed'); await m.page.screenshot({ path: path.join(out, 'midnight-after-training.png') });
  await m.reload(); await m.page.waitForTimeout(1700);
  const again = await m.captureSave('reloaded');
  check('midnight reload does not repay ration or upkeep', again.food === crossed.food && again.world.lastRationDay === 2 && again.contentState.outposts.waterMill.lastUpkeepDay === 2 && again.worldMeta.events.filter(e => e.type === 'outpost.upkeep' && e.payload.day === 2 && e.payload.outpostId === 'waterMill').length === 1);
  check('midnight reload retains two away / eight local identities', again.npcs.length === 10 && again.npcs.filter(n => !!n.garrisonedOutpostId).length === 2);
  await m.page.screenshot({ path: path.join(out, 'midnight-reloaded.png') });
  report.crossDayBrowser = 'verified-derived-23:40-boot-public-training-30-minutes-and-reload';
  check('no browser runtime errors', report.errors.length === 0);
} catch (error) {
  report.errors.push({ type: 'runner', message: error.stack || String(error) });
  if (report.crossDayBrowser === 'pending') report.crossDayBrowser = 'not-verified';
  for (let i = 0; i < contexts.length; i++) for (const page of contexts[i].pages()) {
    try { await page.screenshot({ path: path.join(out, `failure-${i}.png`), timeout: 5000 }); } catch (shotError) { report.errors.push({ type: 'failure-screenshot', message: shotError.message }); }
  }
} finally {
  for (const context of contexts) await context.close().catch(error => report.errors.push({ type: 'context-close', message: error.message }));
  if (browser) await browser.close().catch(error => report.errors.push({ type: 'browser-close', message: error.message }));
  if (server.listening) await new Promise(resolve => server.close(resolve));
  report.passed = report.checks.filter(c => c.ok).length; report.count = report.checks.length;
  report.ok = report.errors.length === 0 && report.passed === report.count && report.count >= 35 && report.documentHashes.length === 4 && report.crossDayBrowser.startsWith('verified');
  report.cleanup = { browserClosed: true, contextsClosed: true, httpServerClosed: !server.listening };
  writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ out, ok: report.ok, count: report.count, passed: report.passed, sourceHtmlSha256: sourceHash, runnerSha256: report.runnerSha256, crossDayBrowser: report.crossDayBrowser, errors: report.errors }, null, 2));
}
if (!report.ok) process.exitCode = 1;
