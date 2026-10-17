import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { root, saveKey, sourceRuntimeFactory } from './lib/source-runtime-fixture.mjs';

// TEST-ONLY complete old-writer-derived boot fixtures. Browser code reads only
// storage/DOM and uses public controls; it never mutates live GameState, calls
// hidden game actions, overrides visibility, or replaces the actual renderer.
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  assert.ok(['--html', '--out', '--expect-html-sha256'].includes(process.argv[i]) && process.argv[i + 1], 'usage: --html ABSOLUTE_HTML --out NEW_ABSOLUTE_DIR --expect-html-sha256 SHA');
  args[process.argv[i]] = process.argv[i + 1];
}
assert.ok(path.isAbsolute(args['--html'] || '') && path.isAbsolute(args['--out'] || ''));
assert.match(args['--expect-html-sha256'] || '', /^[a-f0-9]{64}$/);
const htmlPath = args['--html'], out = args['--out'];
assert.equal(existsSync(out), false, 'new output directory required; preserve failures');
mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const runnerBytes = readFileSync(fileURLToPath(import.meta.url)), htmlBytes = readFileSync(htmlPath);
const sourceHash = sha(htmlBytes); assert.equal(sourceHash, args['--expect-html-sha256']);
const helperBytes = readFileSync(path.join(root, 'scripts/lib/source-runtime-fixture.mjs'));
const adapterBytes = readFileSync(path.join(root, 'scripts/check-report-recovery.mjs'));
const metaBytes = readFileSync(path.join(root, 'scripts/fixtures/npc-threat-attention-v1/capture-meta.json'));
const meta = JSON.parse(metaBytes), original = readFileSync(path.join(root, meta.fixture.path));
assert.equal(sha(original), meta.fixture.sha256);
for (const [file, bytes] of Object.entries({ 'runner-executed.mjs': runnerBytes, 'source.html': htmlBytes,
  'source-fixture-original.json': original, 'source-fixture-capture-meta.json': metaBytes,
  'source-runtime-fixture-executed.mjs': helperBytes, 'io-adapter-source-executed.mjs': adapterBytes })) writeFileSync(path.join(out, file), bytes);
const report = { runner: 'browser-camp-rest-v1', runnerSha256: sha(runnerBytes), sourceHtmlSha256: sourceHash,
  expectedHtmlSha256: args['--expect-html-sha256'], sourceFixtureSha256: sha(original), captureMetaSha256: sha(metaBytes),
  sharedFixtureHelperSha256: sha(helperBytes), ioAdapterSourceSha256: sha(adapterBytes),
  mode: 'derived-complete-old-writer-boot-fixtures-public-browser-actions', naturalGameplay: false, naturalGameplayClaim: false,
  productionCapture: false, fixtureInjectionAfterBoot: false, gameStateMutationAfterBoot: false,
  originalFixtureProvenance: meta, checks: [], errors: [], scenes: [], documentHashes: [], scenarioResults: [],
  visibility: { status: 'not-verified', method: 'real Chrome foreground/background tabs after disabling Playwright focus emulation; trusted native events only' },
  sourceOracle: 'separate actual candidate source VM advance(1) chain; scalar/needs control only; does not replace browser evidence',
};
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); };
const factory = sourceRuntimeFactory(htmlPath);
const clone = value => JSON.parse(JSON.stringify(value));
const minute = p => (p.day - 1) * 1440 + p.hour * 60 + p.minute;
function runtime(raw) { const r = factory([[saveKey, raw]]); assert.equal(r.api.start().ok, true); r.tasks.clear(); return r; }
function scene(name, prepare = () => {}) {
  const r = runtime(original.toString('utf8')), s = r.api.state;
  s.worldZombies = []; s.zombies = [];
  const shelter = s.buildings.find(b => b.type === 'shelter'); assert.ok(shelter?.id);
  s.player.x = shelter.x - .6; s.player.y = shelter.y;
  s.day = 1; s.hour = 11; s.minute = 10; s.world.totalMinutes = 670;
  s.world.lastRationDay = 1; s.world.lastDailyUpkeepDay = 1; s.world.frontierExposure = 0; s.world.frontierClock = 0;
  s.energy = 40; s.sanity = 74; s.sanityClock = 0; s.food = 30;
  s.npcs.forEach(n => { n.needs = { ...n.needs, hunger: 10, fatigue: 10, stress: 20, social: 10, safety: 10, energy: 90 }; n.needClock = 0; n.motionTarget = null; n.eventChain = { ...n.eventChain, cooldown: 1000 }; });
  const extra = prepare(r, s) || [];
  assert.equal(r.api.save({ force: true, reason: 'TEST-ONLY camp-rest browser boot scene' }), true);
  const raw = r.storage.get(saveKey); assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true);
  const file = `${name}-input-save.json`; writeFileSync(path.join(out, file), raw);
  report.scenes.push({ name, inputFile: file, inputSha256: sha(raw), changes: [
    'candidate actual loader consumes immutable complete old automation-browser writer capture; original route remains FAILED',
    'offline derived isolation removes existing world/event threats; no survival or natural-gameplay claim',
    'player relocated within .6 of actual shelter; world day1 11:10, food30, energy40, SAN74, player sanityClock0, zero frontier exposure',
    'offline NPC moderate needs, needClock0, cleared motionTarget and story cooldown1000; roster and identities preserved',
    'candidate actual writer emits complete validated save; no live browser mutation after boot', ...extra ] });
  return raw;
}
const normalRaw = scene('normal');
const zeroRaw = scene('zero-energy', (r, s) => { s.energy = 0; return ['player energy zero to prove no action-energy start cost']; });
const eventRaw = scene('new-event', (r, s) => { const n = s.npcs.find(n => n.id === 'carpenter'); n.needs.hunger = 51.95; n.eventChain.cooldown = 5; return ['carpenter hunger51.95/story cooldown5 lets actual routine naturally create a new NPC event during rest']; });
const midnightRaw = scene('midnight', (r, s) => {
  vm.runInContext('qa.fixtureActions = { discoverLandmark, captureOutpost, createEventInstance };', r.context);
  const mill = s.landmarks.find(l => l.type === 'waterMill'); s.player.x = mill.x; s.player.y = mill.y;
  if (!mill.found) assert.equal(r.api.fixtureActions.discoverLandmark(mill, { commandId: 'TEST-ONLY-rest-discover' }).ok, true);
  assert.equal(r.api.fixtureActions.captureOutpost('waterMill', null, { commandId: 'TEST-ONLY-rest-capture' }).ok, true); r.tasks.clear();
  const shelter = s.buildings.find(b => b.type === 'shelter'); s.player.x = shelter.x - .6; s.player.y = shelter.y;
  s.npcs.forEach(n => { n.needs = { ...n.needs, hunger: 10, fatigue: 10, stress: 20, social: 10, safety: 10, energy: 90 }; n.needClock = 0; n.eventChain.cooldown = 1000; });
  s.contentState.meters.campTrust = 60; s.contentState.commandPoints = 3; s.contentState.commandPointsMax = 3; s.contentState.commandPointsGrantedDay = 1;
  assert.equal(r.api.commit('support').ok, true);
  s.day = 1; s.hour = 23; s.minute = 40; s.world.totalMinutes = 1420; s.food = 30;
  s.world.lastRationDay = 1; s.world.lastDailyUpkeepDay = 1; s.contentState.outposts.waterMill.lastUpkeepDay = 1;
  s.event = { ...s.event, handled: false }; delete s.event.result;
  s.eventInstance = r.api.fixtureActions.createEventInstance(s.event.defId, { instanceId: 'TEST-ONLY-existing-midnight-pending', defId: s.event.defId, payload: clone(s.event) });
  return ['actual candidate discover/capture commands establish waterMill with two genuine roster guards before fixture writer',
    'offline trust60/CP3 cap3/day1 then actual plan commit pays1; crossing midnight must resolve/refill only once',
    'offline calendar23:40 and day1 ration/daily/upkeep watermarks; shared food reset30, moderate NPC needs',
    'authored supply event derived as already-pending with actual createEventInstance; prevents a new default daily event replacing it; not historical-production evidence'];
});
const require = createRequire(import.meta.url), { chromium } = require(process.env.ZH_PLAYWRIGHT_MODULE || 'playwright');
const server = createServer((req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (['/', '/index.html'].includes(route)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(htmlBytes); }
  else if (route === '/actor-sprites.js') { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); res.end(readFileSync(path.join(root, 'dist/actor-sprites.js'))); }
  else { res.writeHead(404); res.end(); }
});
let browser; const contexts = [];
async function boot(raw, name) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(context);
  await context.addInitScript(({ key, raw }) => {
    if (!sessionStorage.getItem('qa-rest-seeded')) { localStorage.clear(); localStorage.setItem(key, raw); sessionStorage.setItem('qa-rest-seeded', 'yes'); }
    window.__qaVisibility = [{ at: performance.now(), hidden: document.hidden, visibilityState: document.visibilityState, type: 'initial' }];
    document.addEventListener('visibilitychange', e => window.__qaVisibility.push({ at: performance.now(), hidden: document.hidden, visibilityState: document.visibilityState, type: e.type, trusted: e.isTrusted }));
  }, { key: saveKey, raw });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', e => report.errors.push({ scene: name, type: 'pageerror', message: e.message }));
  async function document(response) { assert.ok(response?.ok()); const hash = sha(await response.body()); report.documentHashes.push({ scene: name, sha256: hash }); check(`${name}: main document matches frozen input`, hash === sourceHash); }
  await document(await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' }));
  await page.locator('#continueSaveBtn').click(); await page.waitForTimeout(750);
  const rawSaved = () => page.evaluate(key => localStorage.getItem(key), saveKey);
  const saved = async () => JSON.parse(await rawSaved()).payload;
  const snapshot = async label => { const raw = await rawSaved(); writeFileSync(path.join(out, `${name}-${label}-save.json`), raw); return JSON.parse(raw).payload; };
  const waitSaved = async (predicate, values = {}) => { await page.waitForFunction(({ key, body, values }) => Function('p', 'v', `return (${body})(p,v)`)(JSON.parse(localStorage.getItem(key)).payload, values), { key: saveKey, body: predicate.toString(), values }); return saved(); };
  const reload = async () => { await document(await page.reload({ waitUntil: 'domcontentloaded' })); await page.locator('#continueSaveBtn').click(); await page.waitForTimeout(800); };
  return { page, context, rawSaved, saved, snapshot, waitSaved, reload, name };
}
const restEvents = (p, type, id) => p.worldMeta.events.filter(e => e.type === type && (!id || e.payload.restId === id));
async function begin(b, duration) {
  const button = b.page.locator(`[data-context-action="campRest${duration}"]`);
  check(`${b.name}: public ${duration} minute control visible and enabled`, await button.isVisible() && await button.isEnabled());
  const beforeRaw = await b.rawSaved(), before = JSON.parse(beforeRaw).payload, startWall = Date.now();
  await button.click();
  await b.page.waitForFunction(() => !document.querySelector('#campRestCancel').hidden);
  check(`${b.name}: visible progress shows requested duration and risk`, await b.page.locator('#campRestStatus').isVisible() && (await b.page.locator('#campRestStatus').innerText()).includes(`/${duration} 分钟`) && (await b.page.locator('#campRestStatus').innerText()).includes('世界继续运行'));
  check(`${b.name}: cancel control visible and enabled`, await b.page.locator('#campRestCancel').isVisible() && await b.page.locator('#campRestCancel').isEnabled());
  check(`${b.name}: simultaneous public rest controls disabled`, await b.page.locator('[data-context-action="campRest30"]').isDisabled() && await b.page.locator('[data-context-action="campRest60"]').isDisabled());
  return { beforeRaw, before, startWall, duration };
}
async function stopped(b) { return b.waitSaved(p => p.worldMeta.events.some(e => e.type === 'camp.rest.stopped')); }
function proof(name, p, expectedDuration, expectedReason) {
  const start = restEvents(p, 'camp.rest.started').at(-1); assert.ok(start);
  const stop = restEvents(p, 'camp.rest.stopped', start.payload.restId).at(-1); assert.ok(stop);
  const id = start.payload.restId, steps = restEvents(p, 'camp.rest.stepped', id), advances = restEvents(p, 'time.advanced', id);
  check(`${name}: started/stopped share a single instance`, start.payload.requested === expectedDuration && stop.payload.requested === expectedDuration && start.payload.restId === stop.payload.restId);
  check(`${name}: consumed progress equals exact step receipts`, steps.length === stop.payload.completed && steps.every((e, i) => e.payload.restStep === i + 1 && e.payload.completed === i + 1 && e.payload.afterMinute === e.payload.beforeMinute + 1));
  check(`${name}: every step has one actual minute child and causation`, advances.length === steps.length && steps.every(e => advances.some(a => a.commandId === e.payload.advanceCommandId && a.causationId === e.commandId && a.payload.minutes === 1 && a.payload.restStep === e.payload.restStep)));
  check(`${name}: terminal reason and remainder truthful`, (!expectedReason || stop.payload.reason === expectedReason) && stop.payload.remaining === expectedDuration - steps.length);
  writeFileSync(path.join(out, `${name}-receipts.json`), JSON.stringify({ start, stop, steps, advances }, null, 2));
  return { start, stop, steps, advances };
}
function oracle(name, beforeRaw, after) {
  const before = JSON.parse(beforeRaw).payload, count = minute(after) - minute(before); assert.ok(count >= 0 && count < 120);
  const r = runtime(beforeRaw); for (let i = 0; i < count; i++) { assert.equal(r.api.advance(1).ok, true); r.tasks.clear(); }
  const expected = r.api.state;
  check(`${name}: energy matches actual advance(1) source control`, after.energy === expected.energy, { before: before.energy, after: after.energy, expected: expected.energy, elapsed: count });
  check(`${name}: HP and SAN match existing time effects without flat rest reward`, after.hp === expected.hp && after.sanity === expected.sanity, { before: { hp: before.hp, sanity: before.sanity }, after: { hp: after.hp, sanity: after.sanity }, expected: { hp: expected.hp, sanity: expected.sanity } });
  check(`${name}: NPC needs continue and match actual source time control`, after.npcs.every(n => JSON.stringify(n.needs) === JSON.stringify(expected.npcs.find(x => x.id === n.id).needs)) && after.npcs.some(n => JSON.stringify(n.needs) !== JSON.stringify(before.npcs.find(x => x.id === n.id).needs)));
  writeFileSync(path.join(out, `${name}-time-control.json`), JSON.stringify({ elapsedMinutes: count, actual: { energy: after.energy, hp: after.hp, sanity: after.sanity, food: after.food }, expected: { energy: expected.energy, hp: expected.hp, sanity: expected.sanity, food: expected.food } }, null, 2));
}
async function scenario(name, raw, execute) {
  let b;
  try {
    b = await boot(raw, name); const result = await execute(b);
    report.scenarioResults.push(result?.status === 'unavailable'
      ? { name, ok: null, status: 'unavailable', reason: result.reason }
      : { name, ok: true, status: 'verified' });
  }
  catch (error) {
    report.errors.push({ scene: name, type: 'runner', message: error.stack || String(error) }); report.scenarioResults.push({ name, ok: false, status: 'failed' });
    if (b) { try { await b.snapshot('failure'); await b.page.screenshot({ path: path.join(out, `${name}-failure.png`), timeout: 5000 }); } catch (e) { report.errors.push({ scene: name, type: 'failure-capture', message: e.message }); } }
  } finally { if (b) { await b.context.close(); contexts.splice(contexts.indexOf(b.context), 1); } }
}
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, channel: process.env.ZH_BROWSER_CHANNEL || 'chrome' }); report.browserVersion = browser.version();
  await scenario('normal30', normalRaw, async b => {
    const run = await begin(b, 30); await b.page.screenshot({ path: path.join(out, 'normal30-progress.png') });
    const p = await stopped(b), elapsedWall = Date.now() - run.startWall;
    const evidence = proof(b.name, p, 30, 'completed');
    check('normal30: exactly thirty real world minutes consumed', evidence.stop.payload.completed === 30 && evidence.stop.payload.currentMinute - evidence.start.payload.startMinute === 30);
    check('normal30: real scheduler elapsed is not instant skip', elapsedWall >= 4500, { elapsedWallMs: elapsedWall });
    oracle(b.name, run.beforeRaw, p);
    check('normal30: no free food or population', p.food === run.before.food && p.npcs.length === 10);
    check('normal30: terminal UI restores public actions', (await b.page.locator('#campRestStatus').innerText()).includes('等候完成') && await b.page.locator('[data-context-action="campRest30"]').isEnabled() && await b.page.locator('#campRestCancel').isHidden());
    await b.snapshot('completed'); await b.page.screenshot({ path: path.join(out, 'normal30-completed.png') });
  });
  await scenario('zero-energy60', zeroRaw, async b => {
    const run = await begin(b, 60), p = await stopped(b); proof(b.name, p, 60, 'completed');
    check('zero-energy60: true 60-minute wait succeeds at zero starting energy', run.before.energy === 0 && restEvents(p, 'camp.rest.stopped').at(-1).payload.completed === 60);
    oracle(b.name, run.beforeRaw, p); await b.snapshot('completed'); await b.page.screenshot({ path: path.join(out, 'zero-energy60-completed.png') });
  });
  await scenario('partial-cancel', normalRaw, async b => {
    await begin(b, 60); await b.waitSaved(p => p.worldMeta.events.filter(e => e.type === 'camp.rest.stepped').length >= 5);
    await b.page.locator('#campRestCancel').click(); const p = await stopped(b), evidence = proof(b.name, p, 60, 'player-cancel');
    check('partial-cancel: real consumed prefix stays below request', evidence.stop.payload.completed >= 5 && evidence.stop.payload.completed < 60);
    check('partial-cancel: remaining time disclosed without completion claim', (await b.page.locator('#campRestStatus').innerText()).includes('等候停止') && !(await b.page.locator('#campRestStatus').innerText()).includes('等候完成'));
    await b.snapshot('cancelled'); await b.page.screenshot({ path: path.join(out, 'partial-cancel-stopped.png') });
    await b.reload(); const reloaded = await b.saved();
    check('partial-cancel: reload returns idle with no cancel timer', await b.page.locator('#campRestCancel').isHidden() && !(await b.page.locator('#campRestStatus').innerText()).includes('等候中'));
    check('partial-cancel: no persistent rest save domain added', !Object.keys(reloaded).some(k => /campRest|restController/i.test(k)) && reloaded.version === 21 && reloaded.contentState.contentVersion === 3);
    // Natural simulation checkpoints every ten 1200ms ticks, followed by the
    // ordinary save debounce. A shorter unchanged localStorage sample is not
    // evidence that the resumed clock failed. Wait for its actual saved tick.
    await b.waitSaved((q, v) => (q.day - 1) * 1440 + q.hour * 60 + q.minute > v.minute, { minute: minute(p) });
    const later = await b.snapshot('reloaded-after-natural-ticks');
    check('partial-cancel: reload never resumes or appends rest steps', restEvents(later, 'camp.rest.stepped', evidence.start.payload.restId).length === evidence.steps.length && restEvents(later, 'camp.rest.started').length === 1);
    check('partial-cancel: ordinary clock resumes without remaining-time catchup', minute(later) > minute(p) && minute(later) - minute(p) < 20 && minute(later) - minute(p) < evidence.stop.payload.remaining);
    check('partial-cancel: public start controls enabled again', await b.page.locator('[data-context-action="campRest30"]').isEnabled());
    await b.page.screenshot({ path: path.join(out, 'partial-cancel-reloaded.png') });
  });
  await scenario('midnight30', midnightRaw, async b => {
    const run = await begin(b, 30), p = await stopped(b); proof(b.name, p, 30, 'completed');
    check('midnight30: night calendar remains DAY and crosses midnight', p.day === 2 && p.hour === 0 && p.minute >= 10 && p.minute < 20 && p.night === false);
    check('midnight30: global living-ten ration and separate outpost upkeep', p.food === 26 && p.world.lastRationDay === 2 && p.contentState.outposts.waterMill.lastUpkeepDay === 2 && p.npcs.length === 10 && p.npcs.filter(n => n.garrisonedOutpostId).length === 2);
    check('midnight30: upkeep paid exactly once', p.worldMeta.events.filter(e => e.type === 'outpost.upkeep' && e.payload.day === 2 && e.payload.outpostId === 'waterMill').length === 1);
    check('midnight30: committed day1 plan and day2 CP refresh each occur once', p.worldMeta.events.filter(e => ['plan.meeting.resolved','plan.meeting.fallback'].includes(e.type) && e.payload.meetingDay === 1).length === 1 && p.worldMeta.events.filter(e => e.type === 'plan.commandPoints.refreshed' && e.payload.day === 2).length === 1 && p.contentState.commandPointsGrantedDay === 2);
    oracle(b.name, run.beforeRaw, p); await b.snapshot('crossed'); await b.page.screenshot({ path: path.join(out, 'midnight30-completed.png') });
    const identity = p.eventInstance.instanceId; await b.reload(); await b.page.waitForTimeout(1600); const later = await b.snapshot('reloaded');
    check('midnight30: refresh preserves pending identity and no second food charge', later.food === p.food && later.eventInstance.instanceId === identity && later.world.lastRationDay === 2 && later.contentState.outposts.waterMill.lastUpkeepDay === 2);
    check('midnight30: refresh does not reexecute plan or refill CP', JSON.stringify(later.contentState.planMeeting) === JSON.stringify(p.contentState.planMeeting) && later.contentState.commandPoints === p.contentState.commandPoints && later.worldMeta.events.filter(e => e.type === 'plan.commandPoints.refreshed' && e.payload.day === 2).length === 1);
    await b.page.screenshot({ path: path.join(out, 'midnight30-reloaded.png') });
  });
  await scenario('new-event', eventRaw, async b => {
    await begin(b, 30); const p = await stopped(b), evidence = proof(b.name, p, 30, 'new-matter');
    check('new-event: real routine event interrupts before completion', evidence.stop.payload.completed > 0 && evidence.stop.payload.completed < 30 && p.event?.npcEvent?.npcId === 'carpenter' && !p.event.handled);
    await b.page.keyboard.press('j'); check('new-event: public event panel presents new NPC issue', (await b.page.locator('#eventTitle').innerText()).includes('阿梁'));
    await b.snapshot('interrupted'); await b.page.screenshot({ path: path.join(out, 'new-event-interrupted.png') });
  });
  await scenario('public-battle', normalRaw, async b => {
    await begin(b, 30); await b.waitSaved(p => p.worldMeta.events.filter(e => e.type === 'camp.rest.stepped').length >= 5);
    await b.page.keyboard.press('n'); const p = await b.waitSaved(p => p.night === true); const evidence = proof(b.name, p, 30);
    check('public-battle: N starts actual encounter after stopping rest prefix', p.nightBattle && evidence.stop.payload.completed < 30 && evidence.stop.payload.reason !== 'completed');
    check('public-battle: public rest entry unavailable during BATTLE', !(await b.page.locator('[data-context-action="campRest30"]').isVisible()) && await b.page.locator('#campRestCancel').isHidden());
    const count = evidence.steps.length; await b.page.waitForTimeout(1800); const later = await b.snapshot('battle');
    check('public-battle: no remaining rest time advances battle phase', restEvents(later, 'camp.rest.stepped', evidence.start.payload.restId).length === count);
    await b.page.screenshot({ path: path.join(out, 'public-battle.png') });
  });
  await scenario('visibility', normalRaw, async b => {
    const cdp = await b.context.newCDPSession(b.page);
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
    await b.page.bringToFront(); await begin(b, 60);
    await b.waitSaved(p => p.worldMeta.events.filter(e => e.type === 'camp.rest.stepped').length >= 5);
    const other = await b.context.newPage(); await other.goto('about:blank');
    const otherCdp = await b.context.newCDPSession(other); await otherCdp.send('Emulation.setFocusEmulationEnabled', { enabled: false }); await other.bringToFront();
    await b.page.waitForTimeout(1200);
    const hidden = await b.page.evaluate(() => ({ hidden: document.hidden, events: window.__qaVisibility }));
    report.visibility.observation = hidden;
    if (!hidden.hidden || !hidden.events.some(e => e.hidden && e.trusted === true)) {
      report.visibility.status = 'not-verified-browser-did-not-produce-trusted-hidden';
      await other.close(); await b.page.bringToFront(); if (await b.page.locator('#campRestCancel').isVisible()) await b.page.locator('#campRestCancel').click();
      await b.snapshot('unavailable'); return { status: 'unavailable', reason: report.visibility.status };
    }
    const p = await stopped(b), evidence = proof(b.name, p, 60);
    check('visibility: native background transition stops active rest prefix', evidence.stop.payload.completed > 0 && evidence.stop.payload.completed < 60 && ['hidden', 'focus-lost'].includes(evidence.stop.payload.reason));
    await other.close(); await b.page.bringToFront(); await b.page.waitForTimeout(1500);
    const visible = await b.page.evaluate(() => ({ hidden: document.hidden, events: window.__qaVisibility }));
    check('visibility: trusted visible event observed without fake document state', visible.hidden === false && visible.events.some(e => e.hidden === false && e.trusted === true));
    const later = await b.snapshot('visible'); check('visibility: visible state never resumes rest remainder', restEvents(later, 'camp.rest.stepped', evidence.start.payload.restId).length === evidence.steps.length && await b.page.locator('#campRestCancel').isHidden());
    report.visibility.status = 'verified-real-trusted-short-background'; report.visibility.terminalReason = evidence.stop.payload.reason; report.visibility.visibleObservation = visible;
    await b.page.screenshot({ path: path.join(out, 'visibility-returned.png') });
  });
} catch (error) { report.errors.push({ type: 'setup', message: error.stack || String(error) }); }
finally {
  for (const context of contexts) await context.close().catch(e => report.errors.push({ type: 'context-close', message: e.message }));
  if (browser) await browser.close().catch(e => report.errors.push({ type: 'browser-close', message: e.message }));
  if (server.listening) await new Promise(resolve => server.close(resolve));
  report.count = report.checks.length; report.passed = report.checks.filter(c => c.ok).length;
  report.coverage = { verifiedScenarios: report.scenarioResults.filter(s => s.status === 'verified').length,
    attemptedUnavailableScenarios: report.scenarioResults.filter(s => s.status === 'unavailable').length,
    failedScenarios: report.scenarioResults.filter(s => s.status === 'failed').length };
  report.ok = report.errors.length === 0 && report.passed === report.count && report.scenarioResults.length === 7 && report.scenarioResults.every(s => s.ok === true || s.name === 'visibility' && s.status === 'unavailable');
  report.cleanup = { browserClosed: true, contextsClosed: true, httpServerClosed: !server.listening };
  writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ out, ok: report.ok, passed: report.passed, count: report.count, sourceHtmlSha256: sourceHash, runnerSha256: report.runnerSha256, visibility: report.visibility.status, scenarios: report.scenarioResults, errors: report.errors }, null, 2));
}
if (!report.ok) process.exitCode = 1;
