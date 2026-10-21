import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Controlled browser regression of the already observed DAY cover defect.
// One preboot full-writer fixture; all subsequent game actions use visible UI
// and real keys. Privileged snapshots are assertions, never route planners.
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  assert.ok(process.argv[i + 1] && !Object.hasOwn(args, process.argv[i]));
  args[process.argv[i]] = process.argv[i + 1];
}
for (const key of ['--root', '--html', '--input', '--out', '--playwright-module', '--chrome-executable']) assert.ok(path.isAbsolute(args[key] || ''), key);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const html = fs.readFileSync(args['--html']);
const input = fs.readFileSync(args['--input']);
assert.equal(sha(html), args['--expect-html-sha256']);
assert.equal(sha(input), '0366a9a9da371eef38c37aead420d5c3b0b01bd29948e793bc5a3c7db55a42c0');
assert.ok(!fs.existsSync(args['--out']), 'fresh output');
fs.mkdirSync(args['--out'], { recursive: true });
const out = args['--out'];
const write = (name, bytes) => fs.writeFileSync(path.join(out, name), bytes);
const json = (name, value) => write(name, JSON.stringify(value, null, 2) + '\n');
write('source-executed.html', html);
write('input-test-only-native.json', input);
write('runner-executed.mjs', fs.readFileSync(fileURLToPath(import.meta.url)));
const saveKey = html.toString('utf8').match(/const SAVE_KEY = '([^']+)'/)[1];
const report = {
  schema: 'DayCoverFollowBrowserV1', status: 'RUNNING', sourceHtmlSha256: sha(html), inputSha256: sha(input),
  naturalGameplayClaim: false, humanExperience: false, productionDeployed: false,
  scope: 'Actual Chrome regression of TEST-ONLY no-enemy corridor. Public paid cover, registered keys, physical response, normal writer and actual selected Continue. Does not establish natural rescue, engineering, balance or all-role coverage.',
  gameStateWritesAfterBoot: false, fixtureStorageWritesAfterBoot: false, hiddenBusinessCalls: 0,
  budget: { overallMs: 95000, holdWorldMinutes: 16, normalWriterMs: 16000, postReloadTickMs: 4500, publicOrders: 1, keyHoldMs: 2800 },
  checks: [], errors: [], mainDocuments: [], cleanup: {}, captures: []
};
const began = Date.now(), deadline = began + report.budget.overallMs;
const remaining = (requested = 6000) => { assert.ok(Date.now() < deadline, 'overall browser deadline'); return Math.max(1, Math.min(requested, deadline - Date.now())); };
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); };
const responses = [];
let server, browser, context, page, watchdog, closed;
async function close() {
  if (closed) return closed;
  closed = (async () => {
    if (context) { try { await context.close(); report.cleanup.context = true; } catch (e) { report.cleanup.context = false; report.errors.push({ type: 'close-context', message: e.message }); } }
    if (browser) { try { await browser.close(); report.cleanup.browser = true; } catch (e) { report.cleanup.browser = false; report.errors.push({ type: 'close-browser', message: e.message }); } }
    if (server) await new Promise(resolve => { server.close(() => { report.cleanup.server = true; resolve(); }); server.closeAllConnections?.(); });
  })();
  return closed;
}
async function snapshot(label) {
  const value = await page.evaluate(() => {
    const p = WorldSnapshot.capture(), n = p.npcs.find(item => item.id === 'guardChen');
    return { at: Date.now(), world: p.world.totalMinutes, day: p.day, hour: p.hour, minute: p.minute, eventSeq: p.worldMeta.eventSeq,
      phase: SessionController.mode, night: state.night, hp: state.hp, energy: p.energy, player: p.player, npc: n,
      distance: Math.hypot(n.x - p.player.x, n.y - p.player.y), events: p.worldMeta.events, commands: p.worldMeta.replay.commands,
      roster: p.npcs.map(item => ({ id: item.id, hp: item.hp, lifeState: item.lifeState })), rng: p.worldMeta.rngState };
  });
  if (label) json(label + '-live.json', value);
  return value;
}
async function publicCapture(label) {
  const ui = await page.evaluate(() => ({ at: Date.now(), viewport: { width: innerWidth, height: innerHeight },
    hud: document.getElementById('phaseChip')?.innerText, context: document.getElementById('contextPanel')?.innerText,
    buttons: [...document.querySelectorAll('#contextActions button')].map(b => ({ text: b.innerText, disabled: b.disabled, dataset: { ...b.dataset } })) }));
  const live = await snapshot(label);
  json(label + '-public-ui.json', ui);
  await page.screenshot({ path: path.join(out, label + '.png'), timeout: remaining(4500), animations: 'allow' });
  // Each sample has its own time. The screenshot is not an atomic snapshot.
  report.captures.push({ label, liveWorld: live.world, uiAt: ui.at, screenshotTakenAfter: Date.now() });
}
async function waitFor(predicate, milliseconds, message) {
  const end = Math.min(deadline, Date.now() + milliseconds);
  while (Date.now() < end) {
    const live = await snapshot();
    if (predicate(live)) return live;
    await page.waitForTimeout(100);
  }
  assert.fail(message);
}
async function selected(label) {
  const value = await page.evaluate(() => {
    const s = BootRecovery.selected, n = state.npcs.find(item => item.id === 'guardChen');
    return { raw: s?.raw, payload: s?.payload, key: s?.key, sourceCategory: s?.sourceCategory,
      originalChecksum: s?.originalChecksum, classification: BootRecovery.classification,
      installed: BootRecovery.installed, savePending: BootRecovery.savePending, started: gameStarted,
      mode: SessionController.mode, exiting: SessionController.exiting,
      overlayHidden: document.getElementById('startOverlay').classList.contains('hidden'),
      live: { world: state.world.totalMinutes, eventSeq: state.worldMeta.eventSeq, npc: n ? JSON.parse(JSON.stringify(n)) : null,
        events: JSON.parse(JSON.stringify(state.worldMeta.events)) } };
  });
  assert.equal(typeof value.raw, 'string');
  write(label + '-selected-raw.json', value.raw);
  json(label + '-selected-payload.json', value.payload);
  const metadata = { ...value, raw: undefined, payload: undefined, rawSha256: sha(value.raw) };
  json(label + '-selected-metadata.json', metadata);
  return value;
}
try {
  const sprites = fs.readFileSync(path.join(args['--root'], 'dist/actor-sprites.js'));
  const pack = fs.readFileSync(path.join(args['--root'], 'content/packs/watchpost-manual-v1.json'));
  json('dependency-bindings.json', [{ path: 'dist/actor-sprites.js', sha256: sha(sprites) }, { path: 'content/packs/watchpost-manual-v1.json', sha256: sha(pack) }]);
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://local').pathname;
    const body = ['/', '/index.html'].includes(url) ? html : url === '/actor-sprites.js' ? sprites : url === '/content/packs/watchpost-manual-v1.json' ? pack : null;
    res.writeHead(body ? 200 : 404, { 'Content-Type': url.endsWith('.js') ? 'text/javascript; charset=utf-8' : url.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8' }); res.end(body || '');
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const pw = createRequire(import.meta.url)(args['--playwright-module']);
  browser = await pw.chromium.launch({ headless: true, executablePath: args['--chrome-executable'], timeout: remaining(25000) });
  report.browserVersion = browser.version();
  watchdog = setTimeout(async () => { report.errors.push({ type: 'deadline', message: 'fixed overall budget' }); await close(); }, remaining(95000));
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(({ key, raw }) => { if (!sessionStorage.getItem('qa-cover-preboot')) { localStorage.setItem(key, raw); sessionStorage.setItem('qa-cover-preboot', '1'); } }, { key: saveKey, raw: input.toString('utf8') });
  page = await context.newPage(); page.setDefaultTimeout(6000);
  page.on('pageerror', e => report.errors.push({ type: 'pageerror', message: e.message }));
  page.on('response', response => { if (response.request().resourceType() === 'document' && response.frame() === page.mainFrame()) responses.push((async () => { const bytes = await response.body(); report.mainDocuments.push({ status: response.status(), sha256: sha(bytes), bytes: bytes.length }); })()); });
  await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded', timeout: remaining(15000) });
  const initialSelected = await selected('initial');
  check('actual initial loader selects exact full TEST-ONLY input', sha(initialSelected.raw) === sha(input));
  await page.locator('#continueSaveBtn').click();
  await page.waitForFunction(() => document.getElementById('startOverlay').classList.contains('hidden'));
  const before = await snapshot('before-order');
  const order = page.locator('[data-context-action="npcOrder"][data-npc-id="guardChen"][data-order="cover"]');
  check('original same-ID public cover is visible and enabled', await order.isVisible() && await order.isEnabled());
  await publicCapture('before-order-desktop');
  await order.click();
  const paid = await waitFor(s => s.events.some(e => e.seq > before.eventSeq && e.type === 'npc.orderChanged' && e.payload.npcId === 'guardChen' && e.payload.orderId === 'cover'), 6000, 'public cover receipt');
  const event = paid.events.find(e => e.seq > before.eventSeq && e.type === 'npc.orderChanged' && e.payload.npcId === 'guardChen' && e.payload.orderId === 'cover');
  json('public-order-receipt.json', { event, command: paid.commands.find(c => c.commandId === event.commandId) });
  check('real cover pays gross2 and actual15 with original old-order prefix', event.payload.payment.cost.energy === 2 && event.payload.resources.energyAfterPayment === event.payload.resources.energyBefore - 2 && event.payload.clock.elapsedMinutes === 15 && event.payload.target.beforeAdvance.order === null && paid.npc.supportRequested && paid.npc.order === 'cover');
  const inputBegan = Date.now();
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(1600); await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(500);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1200); await page.keyboard.up('ArrowRight');
  const afterKeys = await snapshot('after-keys');
  json('input-execution.json', { began: inputBegan, ended: Date.now(), table: [['ArrowDown', 1600], ['gap', 500], ['ArrowRight', 1200]], source: 'fixed existing open corridor, not privileged enemy/goal coordinates' });
  check('real keys move the player beyond the companion circle', afterKeys.distance > 2.2 && Math.hypot(afterKeys.player.x - paid.player.x, afterKeys.player.y - paid.player.y) > 2);
  const held = await waitFor(s => s.world >= afterKeys.world + report.budget.holdWorldMinutes, 24000, 'sixteen actual world minutes while holding position');
  json('after-hold-live.json', held);
  check('same healthy cover NPC physically closes the gap without player movement', held.distance < afterKeys.distance - 0.6 && Math.hypot(held.player.x - afterKeys.player.x, held.player.y - afterKeys.player.y) < .05 && held.npc.supportRequested && held.npc.order === 'cover' && held.npc.hp === held.npc.maxHp && held.phase === 'DAY');
  check('real original movement remains bounded by world-minute speed', Math.hypot(held.npc.x - afterKeys.npc.x, held.npc.y - afterKeys.npc.y) <= .075 * (held.world - afterKeys.world) + .08);
  await publicCapture('after-hold-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await publicCapture('after-hold-390');
  let normal;
  const writerEnd = Math.min(deadline, Date.now() + report.budget.normalWriterMs);
  while (Date.now() < writerEnd) {
    const value = await page.evaluate(key => { const raw = localStorage.getItem(key); if (!raw) return null; const v = validateStoredProgress({ raw, sourceCategory: 'primary' }, null); return { raw, ok: v.ok, classification: v.ok ? classifySavedRecovery(v.payload).classification : null }; }, saveKey);
    if (value?.ok && value.classification === 'DAY') {
      const e = JSON.parse(value.raw), p = e.payload, n = p.npcs.find(n => n.id === 'guardChen');
      if (e.reason === 'world-tick' && p.world.totalMinutes >= held.world && n.order === 'cover' && n.supportRequested && p.worldMeta.events.some(x => JSON.stringify(x) === JSON.stringify(event))) { normal = value.raw; break; }
    }
    await page.waitForTimeout(100);
  }
  assert.ok(normal, 'normal writer includes the actual paid order after the observed follow interval'); write('normal-before-reload-native.json', normal);
  const normalPayload = JSON.parse(normal).payload, normalNpc = normalPayload.npcs.find(n => n.id === 'guardChen');
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  check('normal writer persists actual follow movement after the observed interval', distance(normalNpc, normalPayload.player) <= held.distance + .08 && distance(normalNpc, afterKeys.npc) >= .6 && distance(normalPayload.player, held.player) < .05);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining(15000) });
  const actualSelected = await selected('reload');
  const selectedNpc = actualSelected.payload.npcs.find(n => n.id === 'guardChen');
  check('actual selected payload preserves cover, full payment receipt and a legal later position', selectedNpc.order === 'cover' && actualSelected.payload.worldMeta.events.some(e => JSON.stringify(e) === JSON.stringify(event)) && actualSelected.payload.world.totalMinutes >= normalPayload.world.totalMinutes && distance(selectedNpc, normalNpc) <= .075 * (actualSelected.payload.world.totalMinutes - normalPayload.world.totalMinutes) + .08 && distance(selectedNpc, actualSelected.payload.player) <= distance(normalNpc, normalPayload.player) + .08);
  report.recoveryRawComparison = { normalSha256: sha(normal), selectedSha256: sha(actualSelected.raw), sameRaw: normal === actualSelected.raw, claim: 'Actual selected raw and payload independently captured; pagehide may produce a later legitimate checkpoint.' };
  await page.locator('#continueSaveBtn').click();
  const installed = await selected('installed');
  // The installation facts and live state came from one synchronous read.
  // If a lawful timer tick already occurred, account for its actual receipt.
  const boot = installed.live;
  json('after-continue-live.json', boot);
  const postSelectedEvents = boot.events.filter(e => e.seq > actualSelected.payload.worldMeta.eventSeq);
  const actualAdvanced = postSelectedEvents.filter(e => e.type === 'time.advanced').reduce((sum, e) => sum + e.payload.minutes, 0);
  check('actual Continue installs selected same-ID state; any already elapsed tick is accounted', installed.installed && installed.started && installed.overlayHidden && !installed.savePending && !installed.exiting && installed.mode === 'DAY' && installed.raw === actualSelected.raw && boot.world - actualSelected.payload.world.totalMinutes === actualAdvanced && boot.eventSeq >= actualSelected.payload.worldMeta.eventSeq && boot.npc.order === 'cover' && boot.npc.supportRequested && boot.npc.bond === selectedNpc.bond && boot.npc.memory.helpedByPlayer === selectedNpc.memory.helpedByPlayer && distance(boot.npc, selectedNpc) <= .075 * actualAdvanced + .08 && !postSelectedEvents.some(e => ['npc.orderChanged', 'npc.interacted'].includes(e.type)));
  const tick = await waitFor(s => s.world > boot.world && s.events.some(e => e.seq > boot.eventSeq && e.type === 'time.advanced'), report.budget.postReloadTickMs, 'actual new post-Continue tick');
  json('post-continue-tick-live.json', tick);
  check('new tick preserves paid cover without another support/order reward', tick.npc.order === 'cover' && tick.npc.supportRequested && tick.npc.bond === paid.npc.bond && tick.npc.memory.helpedByPlayer === paid.npc.memory.helpedByPlayer && !tick.events.some(e => e.seq > boot.eventSeq && ['npc.orderChanged', 'npc.interacted'].includes(e.type)));
  await publicCapture('restored-390');
  check('preboot fixture was installed only once through reload', await page.evaluate(() => sessionStorage.getItem('qa-cover-preboot')) === '1');
  await Promise.all(responses);
  check('actual original and reload documents match frozen candidate', report.mainDocuments.length === 2 && report.mainDocuments.every(d => d.status === 200 && d.sha256 === sha(html)));
} catch (e) {
  report.errors.push({ type: e.name, message: e.message });
  if (page && !page.isClosed()) { try { await snapshot('failure'); await publicCapture('failure'); } catch (captureError) { report.errors.push({ type: 'failure-capture', message: captureError.message }); } }
} finally {
  clearTimeout(watchdog); await close(); await Promise.allSettled(responses);
  report.count = report.checks.length; report.passed = report.checks.filter(c => c.ok).length; report.elapsedMs = Date.now() - began;
  if (report.elapsedMs > report.budget.overallMs) report.errors.push({ type: 'budget', message: 'whole execution including cleanup exceeded frozen overall budget' });
  report.ok = report.errors.length === 0 && report.count > 0 && report.passed === report.count && ['context', 'browser', 'server'].every(k => report.cleanup[k] === true);
  report.status = report.ok ? 'VERIFIED' : 'FAILED'; json('report.json', report);
  console.log(JSON.stringify({ status: report.status, count: report.count, passed: report.passed, errors: report.errors, elapsedMs: report.elapsedMs, cleanup: report.cleanup }));
  process.exitCode = report.ok ? 0 : 1;
}
