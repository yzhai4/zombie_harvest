import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// TEST-ONLY complete writer. All business after boot uses visible public UI.
// Privileged reads assert the consumer; they do not choose routes or mutate.
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  assert.ok(process.argv[i + 1] && !Object.hasOwn(args, process.argv[i]));
  args[process.argv[i]] = process.argv[i + 1];
}
for (const key of ['--root', '--html', '--input', '--out', '--playwright-module', '--chrome-executable']) assert.ok(path.isAbsolute(args[key] || ''), key);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const html = fs.readFileSync(args['--html']), input = fs.readFileSync(args['--input']);
assert.equal(sha(html), args['--expect-html-sha256']);
assert.equal(sha(input), 'a81ef1a23d2db69dc671181bb179e1d250459588add4e5ab0ac69bbb74037596');
assert.ok(!fs.existsSync(args['--out']), 'fresh output');
fs.mkdirSync(args['--out'], { recursive: true });
const out = args['--out'];
const write = (name, bytes) => fs.writeFileSync(path.join(out, name), bytes);
const json = (name, value) => write(name, JSON.stringify(value, null, 2) + '\n');
write('source-executed.html', html); write('input-test-only-native.json', input);
write('runner-executed.mjs', fs.readFileSync(fileURLToPath(import.meta.url)));
const saveKey = html.toString('utf8').match(/const SAVE_KEY = '([^']+)'/)[1];
const report = {
  schema: 'DayCoverEngineerBrowserV1', status: 'RUNNING', sourceHtmlSha256: sha(html), inputSha256: sha(input),
  naturalGameplayClaim: false, humanExperience: false, productionDeployed: false,
  scope: 'Actual Chrome TEST-ONLY near-radio engineering UI regression. Paid cover, >=5 actual world-minute engineering pause, desktop/390 hints, same-ID public guard, actual later engineering resume, optional finite material batch, normal writer/actual selected Continue/new tick. No natural rescue, balance, completion or all-role browser claim.',
  prebootDerivation: 'Complete old briefed writer; TEST-ONLY clear corridor, nearby radio and no enemies. Original mother producer exit1 enemy-count oracle is retained in provenance. No historical facts or costs filled.',
  gameStateWritesAfterBoot: false, fixtureStorageWritesAfterBoot: false, hiddenBusinessCalls: 0,
  budget: { overallMs: 95000, pausedWorldMinutes: 5, pauseObserveMs: 10000, resumeTickMs: 4500, optionalBatchMs: 22000, normalWriterMs: 16000, postReloadTickMs: 4500, publicOrders: 2 },
  checks: [], errors: [], mainDocuments: [], cleanup: {}, captures: []
};
const began = Date.now(), deadline = began + report.budget.overallMs;
const remaining = (requested = 6000) => { assert.ok(Date.now() < deadline, 'whole browser deadline'); return Math.max(1, Math.min(requested, deadline - Date.now())); };
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); };
const responses = []; let server, browser, context, page, watchdog, closed;
async function close() {
  if (closed) return closed;
  closed = (async () => {
    if (context) { try { await context.close(); report.cleanup.context = true; } catch (e) { report.cleanup.context = false; report.errors.push({ type: 'close-context', message: e.message }); } }
    if (browser) { try { await browser.close(); report.cleanup.browser = true; } catch (e) { report.cleanup.browser = false; report.errors.push({ type: 'close-browser', message: e.message }); } }
    if (server) await new Promise(resolve => { server.close(() => { report.cleanup.server = true; resolve(); }); server.closeAllConnections?.(); });
  })(); return closed;
}
async function snapshot(label) {
  const value = await page.evaluate(() => {
    const p = WorldSnapshot.capture(), n = p.npcs.find(item => item.id === 'radio'), a = relayRoleBindings();
    return { at: Date.now(), world: p.world.totalMinutes, day: p.day, hour: p.hour, minute: p.minute, eventSeq: p.worldMeta.eventSeq,
      phase: SessionController.mode, night: state.night, hp: state.hp, energy: p.energy, sanity: p.sanity, player: p.player, npc: n,
      stock: { wood: state.wood, parts: state.parts, stone: state.stone, food: state.food }, relay: p.relayProject,
      assignment: { blockedReason: a.blockedReason, busyRoles: a.busyRoles, bindings: a.bindings.map(b => ({ roleId: b.roleId, npcId: b.npc?.id, busy: b.busy, busyReason: b.busyReason })) },
      events: p.worldMeta.events, commands: p.worldMeta.replay.commands,
      roster: p.npcs.map(item => ({ id: item.id, hp: item.hp, lifeState: item.lifeState })), rng: p.worldMeta.rngState };
  });
  if (label) json(label + '-live.json', value); return value;
}
async function capture(label, surface) {
  const ui = await page.evaluate(() => ({ at: Date.now(), viewport: { width: innerWidth, height: innerHeight },
    hud: document.getElementById('phaseChip')?.innerText, context: document.getElementById('contextPanel')?.innerText,
    contextButtons: [...document.querySelectorAll('#contextActions button')].map(b => ({ text: b.innerText, disabled: b.disabled, dataset: { ...b.dataset } })),
    relay: Object.fromEntries(['relayStatusText','relayTaskText','relayCrewText','relayMaterials','relayPanelHint'].map(id => [id, document.getElementById(id)?.innerText])),
    modal: { open: document.getElementById('infoModal')?.classList.contains('open'), activeTab: [...document.querySelectorAll('#infoTabs [data-info-tab]')].filter(b => b.classList.contains('active')).map(b => b.dataset.infoTab) } }));
  const live = await snapshot(label); json(label + '-public-ui.json', ui);
  if (surface === 'relay') await page.locator('#relayCrewText').scrollIntoViewIfNeeded({ timeout: remaining(4000) });
  else if (surface === 'context') await page.locator('#contextActions').scrollIntoViewIfNeeded({ timeout: remaining(4000) });
  await page.screenshot({ path: path.join(out, label + '.png'), timeout: remaining(4500), animations: 'allow' });
  report.captures.push({ label, surface, liveWorld: live.world, uiAt: ui.at, screenshotTakenAfter: Date.now(), atomic: false });
  return ui;
}
async function waitFor(predicate, ms, message, required = true) {
  const end = Math.min(deadline, Date.now() + ms); let live;
  while (Date.now() < end) { live = await snapshot(); if (predicate(live)) return live; await page.waitForTimeout(100); }
  if (required) assert.fail(message); return null;
}
async function openRelay() {
  const button = page.locator('#openInfoBtn'); assert.ok(await button.isVisible() && await button.isEnabled(), 'public terminal button'); await button.click();
  const tab = page.locator('#infoTabs [data-info-tab="build"]'); assert.ok(await tab.isVisible() && await tab.isEnabled(), 'public build/relay tab'); await tab.click();
  assert.ok(await page.locator('#infoModal.open #relayPanel').isVisible(), 'actual modal-mounted relay panel');
}
async function closeRelay() {
  const button = page.locator('#infoModalClose'); assert.ok(await button.isVisible() && await button.isEnabled(), 'public terminal close'); await button.click();
  assert.equal(await page.locator('#infoModal').evaluate(el => el.classList.contains('open')), false);
}
async function selected(label) {
  const value = await page.evaluate(() => {
    const s = BootRecovery.selected, n = state.npcs.find(item => item.id === 'radio');
    return { raw: s?.raw, payload: s?.payload, key: s?.key, sourceCategory: s?.sourceCategory, originalChecksum: s?.originalChecksum,
      classification: BootRecovery.classification, installed: BootRecovery.installed, savePending: BootRecovery.savePending, started: gameStarted,
      mode: SessionController.mode, exiting: SessionController.exiting, overlayHidden: document.getElementById('startOverlay').classList.contains('hidden'),
      live: { world: state.world.totalMinutes, eventSeq: state.worldMeta.eventSeq, npc: n ? JSON.parse(JSON.stringify(n)) : null,
        relay: JSON.parse(JSON.stringify(state.relayProject)), events: JSON.parse(JSON.stringify(state.worldMeta.events)) } };
  });
  assert.equal(typeof value.raw, 'string'); write(label + '-selected-raw.json', value.raw); json(label + '-selected-payload.json', value.payload);
  json(label + '-selected-metadata.json', { ...value, raw: undefined, payload: undefined, rawSha256: sha(value.raw) }); return value;
}
const orderLocator = id => page.locator('[data-context-action="npcOrder"][data-npc-id="radio"][data-order="' + id + '"]');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
try {
  const sprites = fs.readFileSync(path.join(args['--root'], 'dist/actor-sprites.js'));
  const pack = fs.readFileSync(path.join(args['--root'], 'content/packs/watchpost-manual-v1.json'));
  json('dependency-bindings.json', [{ path: 'dist/actor-sprites.js', sha256: sha(sprites), bytes: sprites.length }, { path: 'content/packs/watchpost-manual-v1.json', sha256: sha(pack), bytes: pack.length }]);
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://local').pathname;
    const body = ['/', '/index.html'].includes(url) ? html : url === '/actor-sprites.js' ? sprites : url === '/content/packs/watchpost-manual-v1.json' ? pack : null;
    res.writeHead(body ? 200 : 404, { 'Content-Type': url.endsWith('.js') ? 'text/javascript; charset=utf-8' : url.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8' }); res.end(body || '');
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const pw = createRequire(import.meta.url)(args['--playwright-module']);
  browser = await pw.chromium.launch({ headless: true, executablePath: args['--chrome-executable'], timeout: remaining(25000) }); report.browserVersion = browser.version();
  watchdog = setTimeout(async () => { report.errors.push({ type: 'deadline', message: 'fixed overall budget' }); await close(); }, remaining(95000));
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(({ key, raw }) => { if (!sessionStorage.getItem('qa-cover-engineer-preboot')) { localStorage.setItem(key, raw); sessionStorage.setItem('qa-cover-engineer-preboot', '1'); } }, { key: saveKey, raw: input.toString('utf8') });
  page = await context.newPage(); page.setDefaultTimeout(6000);
  page.on('pageerror', e => report.errors.push({ type: 'pageerror', message: e.message }));
  page.on('response', response => { if (response.request().resourceType() === 'document' && response.frame() === page.mainFrame()) responses.push((async () => { const bytes = await response.body(); report.mainDocuments.push({ status: response.status(), sha256: sha(bytes), bytes: bytes.length }); })()); });
  await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded', timeout: remaining(15000) });
  const initial = await selected('initial'); check('actual initial loader selects exact complete TEST-ONLY radio writer', sha(initial.raw) === sha(input));
  await page.locator('#continueSaveBtn').click(); await page.waitForFunction(() => document.getElementById('startOverlay').classList.contains('hidden'));
  const before = await snapshot('before-cover');
  check('same-ID radio public cover is visible enabled with actual cost and project tradeoff', await orderLocator('cover').isVisible() && await orderLocator('cover').isEnabled() && /2.*15/.test(await orderLocator('cover').innerText()) && /随行.*中继工程暂停/.test(await orderLocator('cover').innerText()));
  await page.setViewportSize({ width: 390, height: 844 }); await capture('before-cover-390', 'context');
  await orderLocator('cover').click();
  const paid = await waitFor(s => s.events.some(e => e.seq > before.eventSeq && e.type === 'npc.orderChanged' && e.payload.npcId === 'radio' && e.payload.orderId === 'cover'), 6000, 'real public paid cover receipt');
  const coverEvent = paid.events.find(e => e.seq > before.eventSeq && e.type === 'npc.orderChanged' && e.payload.npcId === 'radio' && e.payload.orderId === 'cover');
  json('cover-receipt.json', { event: coverEvent, command: paid.commands.find(c => c.commandId === coverEvent.commandId) });
  check('paid public cover uses gross2E actual15 and original old-order prefix', coverEvent.payload.payment.cost.energy === 2 && coverEvent.payload.resources.energyAfterPayment === coverEvent.payload.resources.energyBefore - 2 && coverEvent.payload.clock.elapsedMinutes === 15 && coverEvent.payload.target.beforeAdvance.order === null && paid.npc.order === 'cover' && paid.npc.supportRequested);
  const paused = await waitFor(s => s.world >= paid.world + report.budget.pausedWorldMinutes && s.assignment.blockedReason === 'cover-duty' && s.relay.lastBlockedReason === 'cover-duty', report.budget.pauseObserveMs, '>=5 actual world minutes cover-duty pause');
  json('paused-after-five-world-live.json', paused);
  check('pause retains same radio holder and exact invested progress clock and stock for >=5 actual world minutes', paused.world >= paid.world + 5 && paused.assignment.bindings.find(b => b.roleId === 'radio')?.npcId === 'radio' && paused.assignment.busyRoles.includes('radio') && paused.assignment.bindings.find(b => b.roleId === 'radio')?.busyReason === 'cover-duty' && same(paused.relay.materialProgress, paid.relay.materialProgress) && paused.relay.materialClock === paid.relay.materialClock && paused.relay.workMinutes === paid.relay.workMinutes && same(paused.stock, paid.stock));
  const hint = page.locator('#contextActions [data-npc-routine="radio"]');
  check('near-radio390 actual status and public guard restoration hint are visible', await hint.isVisible() && /随行安排/.test(await hint.innerText()) && await orderLocator('guard').isVisible() && await orderLocator('guard').isEnabled() && /0体力.*0分钟/.test(await orderLocator('guard').innerText()) && /守墙.*巡逻/.test(await orderLocator('guard').innerText()));
  await capture('paused-npc-390', 'context');
  await page.setViewportSize({ width: 1440, height: 1000 }); await openRelay();
  const desktop = await capture('paused-engineer-desktop', 'relay');
  check('desktop public engineering panel names busy radio pause and actual reversible choice', /随行占用/.test(desktop.relay.relayCrewText) && /工程暂停/.test(desktop.relay.relayTaskText) && /守墙.*巡逻/.test(desktop.relay.relayTaskText) && /已投入材料与工时保留/.test(desktop.relay.relayTaskText));
  await page.setViewportSize({ width: 390, height: 844 }); const mobile = await capture('paused-engineer-390', 'relay');
  check('390 public engineering panel stays actually visible with same pause explanation', await page.locator('#infoModal.open #relayCrewText').isVisible() && await page.locator('#infoModal.open #relayTaskText').isVisible() && /随行占用/.test(mobile.relay.relayCrewText) && /工程暂停/.test(mobile.relay.relayTaskText));
  await closeRelay();
  const beforeGuard = await snapshot('before-guard');
  check('same-ID guard remains a visible enabled near-radio public choice', await orderLocator('guard').isVisible() && await orderLocator('guard').isEnabled());
  await orderLocator('guard').click();
  const guarded = await waitFor(s => s.events.some(e => e.seq > beforeGuard.eventSeq && e.type === 'npc.orderChanged' && e.payload.npcId === 'radio' && e.payload.orderId === 'guard'), 6000, 'real same-ID guard receipt');
  const guardEvent = guarded.events.find(e => e.seq > beforeGuard.eventSeq && e.type === 'npc.orderChanged' && e.payload.npcId === 'radio' && e.payload.orderId === 'guard');
  json('guard-receipt.json', { event: guardEvent, command: guarded.commands.find(c => c.commandId === guardEvent.commandId) });
  check('existing guard changes order without additional payment time bond help or SAN reward', guardEvent.payload.payment.cost.energy === 0 && guardEvent.payload.clock.elapsedMinutes === 0 && guardEvent.payload.operation === 'order-change' && guarded.npc.order === 'guard' && guarded.npc.supportRequested && guarded.npc.bond === beforeGuard.npc.bond && guarded.npc.memory.helpedByPlayer === beforeGuard.npc.memory.helpedByPlayer && guardEvent.payload.target.atCompletion.sanity === guardEvent.payload.target.before.sanity && guardEvent.payload.target.atCompletion.bond === guardEvent.payload.target.before.bond && guardEvent.payload.target.atCompletion.helpedByPlayer === guardEvent.payload.target.before.helpedByPlayer);
  const resumed = await waitFor(s => s.world > guarded.world && !s.assignment.busyRoles.includes('radio') && s.assignment.blockedReason === null && s.relay.lastBlockedReason !== 'cover-duty' && (s.relay.materialClock > beforeGuard.relay.materialClock || s.events.some(e => e.seq > guardEvent.seq && e.type === 'relay.materialsGathered')), report.budget.resumeTickMs, 'real later tick resumes original engineering clock');
  json('resumed-after-tick-live.json', resumed);
  check('actual later tick releases same original radio binding and resumes preserved engineering', resumed.assignment.bindings.find(b => b.roleId === 'radio')?.npcId === 'radio' && resumed.npc.order === 'guard' && same(resumed.relay.materialProgress, beforeGuard.relay.materialProgress) && resumed.relay.workMinutes === beforeGuard.relay.workMinutes && resumed.relay.materialClock > beforeGuard.relay.materialClock);
  await page.setViewportSize({ width: 1440, height: 1000 }); await openRelay(); const resumeUi = await capture('resumed-engineer-desktop', 'relay');
  check('actual reopened engineering panel removes busy pause rather than rewriting history', !/随行占用|工程暂停/.test(resumeUi.relay.relayTaskText) && !/随行占用/.test(resumeUi.relay.relayCrewText));
  await closeRelay();
  const batch = await waitFor(s => s.events.some(e => e.seq > guardEvent.seq && e.type === 'relay.materialsGathered'), report.budget.optionalBatchMs, 'optional first finite material batch', false);
  const endpoint = batch || await snapshot(); json('bounded-endpoint-live.json', endpoint);
  report.materialBatchObserved = !!batch;
  if (batch) {
    const event = batch.events.find(e => e.seq > guardEvent.seq && e.type === 'relay.materialsGathered'); json('optional-material-batch-receipt.json', event);
    check('observed optional material batch has finite real stock cost matching actual progress', batch.relay.materialProgress.wood - beforeGuard.relay.materialProgress.wood === beforeGuard.stock.wood - batch.stock.wood && batch.relay.materialProgress.parts - beforeGuard.relay.materialProgress.parts === beforeGuard.stock.parts - batch.stock.parts && batch.relay.materialProgress.wood > beforeGuard.relay.materialProgress.wood && batch.relay.materialProgress.parts > beforeGuard.relay.materialProgress.parts && event.payload.sources.length > 0);
  }
  let normal; const writerEnd = Math.min(deadline, Date.now() + report.budget.normalWriterMs);
  while (Date.now() < writerEnd) {
    const value = await page.evaluate(key => { const raw = localStorage.getItem(key); if (!raw) return null; const v = validateStoredProgress({ raw, sourceCategory: 'primary' }, null); return { raw, ok: v.ok, classification: v.ok ? classifySavedRecovery(v.payload).classification : null }; }, saveKey);
    if (value?.ok && value.classification === 'DAY') {
      const e = JSON.parse(value.raw), p = e.payload, n = p.npcs.find(n => n.id === 'radio');
      if (e.reason === 'world-tick' && p.world.totalMinutes >= endpoint.world && n.order === 'guard' && n.supportRequested && p.worldMeta.events.some(x => same(x, guardEvent)) && p.worldMeta.events.some(x => same(x, coverEvent)) && same(p.relayProject.materialProgress, endpoint.relay.materialProgress)) { normal = value.raw; break; }
    }
    await page.waitForTimeout(100);
  }
  assert.ok(normal, 'normal writer includes both final public order receipts and actual resumed engineering'); write('normal-before-reload-native.json', normal);
  const normalPayload = JSON.parse(normal).payload;
  check('normal writer preserves final guard and actual finite engineering progress', normalPayload.npcs.find(n => n.id === 'radio').order === 'guard' && same(normalPayload.relayProject.materialProgress, endpoint.relay.materialProgress) && normalPayload.relayProject.lastBlockedReason !== 'cover-duty');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining(15000) }); const actualSelected = await selected('reload');
  const selectedNpc = actualSelected.payload.npcs.find(n => n.id === 'radio');
  check('actual selected loader preserves final orders receipts and legal later engineering', selectedNpc.order === 'guard' && selectedNpc.supportRequested && actualSelected.payload.world.totalMinutes >= normalPayload.world.totalMinutes && actualSelected.payload.worldMeta.events.some(e => same(e, guardEvent)) && actualSelected.payload.worldMeta.events.some(e => same(e, coverEvent)) && actualSelected.payload.relayProject.materialProgress.wood >= normalPayload.relayProject.materialProgress.wood && actualSelected.payload.relayProject.materialProgress.parts >= normalPayload.relayProject.materialProgress.parts);
  report.recoveryRawComparison = { normalSha256: sha(normal), selectedSha256: sha(actualSelected.raw), sameRaw: normal === actualSelected.raw, claim: 'Normal writer and actual selected captured separately; pagehide may legitimately save a later checkpoint.' };
  await page.locator('#continueSaveBtn').click(); const installed = await selected('installed'), boot = installed.live;
  const postSelectedEvents = boot.events.filter(e => e.seq > actualSelected.payload.worldMeta.eventSeq), advanced = postSelectedEvents.filter(e => e.type === 'time.advanced').reduce((sum, e) => sum + e.payload.minutes, 0);
  check('actual Continue installs same selected guard and project without repeating public orders or rewards', installed.installed && installed.started && installed.overlayHidden && !installed.savePending && !installed.exiting && installed.mode === 'DAY' && installed.raw === actualSelected.raw && boot.world - actualSelected.payload.world.totalMinutes === advanced && boot.npc.order === 'guard' && boot.npc.supportRequested && boot.npc.bond === selectedNpc.bond && boot.npc.memory.helpedByPlayer === selectedNpc.memory.helpedByPlayer && !postSelectedEvents.some(e => ['npc.orderChanged','npc.interacted'].includes(e.type)));
  const tick = await waitFor(s => s.world > boot.world && s.events.some(e => e.seq > boot.eventSeq && e.type === 'time.advanced'), report.budget.postReloadTickMs, 'actual post-Continue tick'); json('post-continue-tick-live.json', tick);
  check('new Continue tick preserves released engineer and does not replay support or orders', tick.npc.order === 'guard' && tick.npc.supportRequested && !tick.assignment.busyRoles.includes('radio') && tick.npc.bond === selectedNpc.bond && tick.npc.memory.helpedByPlayer === selectedNpc.memory.helpedByPlayer && !tick.events.some(e => e.seq > boot.eventSeq && ['npc.orderChanged','npc.interacted'].includes(e.type)));
  check('one initial preboot storage seed and exact frozen original/reload documents', await page.evaluate(() => sessionStorage.getItem('qa-cover-engineer-preboot')) === '1');
  await Promise.all(responses);
  check('both actual main documents match frozen candidate SHA', report.mainDocuments.length === 2 && report.mainDocuments.every(d => d.status === 200 && d.sha256 === sha(html)));
} catch (e) {
  report.errors.push({ type: e.name, message: e.message });
  if (page && !page.isClosed()) { try { await snapshot('failure'); await capture('failure'); } catch (err) { report.errors.push({ type: 'failure-capture', message: err.message }); } }
} finally {
  clearTimeout(watchdog); await close(); await Promise.allSettled(responses);
  report.count = report.checks.length; report.passed = report.checks.filter(c => c.ok).length; report.elapsedMs = Date.now() - began;
  if (report.elapsedMs > report.budget.overallMs) report.errors.push({ type: 'budget', message: 'execution including cleanup exceeded frozen 95s' });
  report.ok = report.errors.length === 0 && report.count > 0 && report.passed === report.count && ['context','browser','server'].every(k => report.cleanup[k] === true);
  report.status = report.ok ? 'CONTROLLED_ENGINEER_BROWSER_VERIFIED' : 'FAILED'; json('report.json', report);
  console.log(JSON.stringify({ status: report.status, count: report.count, passed: report.passed, errors: report.errors, elapsedMs: report.elapsedMs, cleanup: report.cleanup, materialBatchObserved: report.materialBatchObserved })); process.exitCode = report.ok ? 0 : 1;
}
