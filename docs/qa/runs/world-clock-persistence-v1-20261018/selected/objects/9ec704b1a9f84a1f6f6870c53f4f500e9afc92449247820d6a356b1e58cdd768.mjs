import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// V3: only normal-writer selection is tightened to the latest actual live watermark.
// Source execution still waits for root's new frozen HTML SHA.
const a = {};
for (let i = 2; i < process.argv.length; i += 2) { assert.ok(process.argv[i + 1] && !Object.hasOwn(a, process.argv[i])); a[process.argv[i]] = process.argv[i + 1]; }
for (const k of ['--html', '--sprites', '--input-manifest', '--out', '--playwright-module', '--chrome-executable']) assert.ok(path.isAbsolute(a[k] || ''), k);
for (const k of ['--expect-html-sha256', '--expect-input-manifest-sha256']) assert.match(a[k] || '', /^[a-f0-9]{64}$/);
const sha = b => createHash('sha256').update(b).digest('hex'), read = p => fs.readFileSync(p);
const html = read(a['--html']), sprites = read(a['--sprites']), method = read(fileURLToPath(import.meta.url));
const imBytes = read(a['--input-manifest']), im = JSON.parse(imBytes), sourceSha = sha(html), pendingKey = im.pendingField;
assert.equal(sourceSha, a['--expect-html-sha256']); assert.equal(sha(imBytes), a['--expect-input-manifest-sha256']);
assert.equal(im.schema, 'WorldClockHalfRateBrowserInputsV2'); assert.equal(im.sourceHtmlSha256, sourceSha);
assert.equal(pendingKey, 'subMinuteRemainder'); assert.equal(im.unit, 'canonical-decimal-string-minutes'); assert.equal(im.pendingRange, '[0,1)');
assert.equal(im.clockPolicy, 'whole-minute-v1');
assert.equal(im.rate, .5); assert.equal(im.paused, false);
assert.equal(im.scenes.length, 1); assert.equal(im.scenes[0].id, 'legacy-half-rate');
const saveKey = html.toString('utf8').match(/const SAVE_KEY = '([^']+)'/)?.[1]; assert.ok(saveKey);
const inputs = im.scenes.map(s => { assert.ok(s.file && !path.isAbsolute(s.file) && !s.file.split(/[\\/]/).includes('..'));
  const b = read(path.join(path.dirname(a['--input-manifest']), s.file)); assert.equal(sha(b), s.sha256); assert.equal(b.length, s.bytes);
  const p = JSON.parse(b).payload; assert.equal(p.npcs.length, 10); assert.equal(p.worldZombies.length, 4);
  return { ...s, raw: b.toString('utf8'), p }; });
assert.ok(!fs.existsSync(a['--out'])); fs.mkdirSync(a['--out'], { recursive: true });
const out = a['--out'], write = (n, b) => fs.writeFileSync(path.join(out, n), b), json = (n, v) => write(n, JSON.stringify(v, null, 2) + '\n');
const artifact = n => { const b = read(path.join(out, n)); return { file: n, sha256: sha(b), bytes: b.length }; };
write('runner-executed.mjs', method); write('source-executed.html', html); write('actor-sprites.js', sprites); write('input-manifest.json', imBytes);
for (const s of inputs) write(s.file, s.raw);
for (const r of im.provenanceFiles) { assert.ok(!path.isAbsolute(r.file) && !r.file.split(/[\\/]/).includes('..'));
  const b = read(path.join(path.dirname(a['--input-manifest']), r.file)); assert.equal(sha(b), r.sha256); assert.equal(b.length, r.bytes); write(r.file, b); }
const minute = p => (p.day - 1) * 1440 + p.hour * 60 + p.minute;
const canonicalRemainder = v => typeof v === 'string' && (v === '0' || /^0\.[0-9]{0,323}[1-9]$/.test(v));
const credit = clock => Object.hasOwn(clock, pendingKey) ? clock[pendingKey] : '0';
// This input produces only exactly representable half-minute credit. No Number
// conversion/epsilon is used to validate the production 324-digit string domain.
const halfUnits = v => { assert.ok(v === '0' || v === '0.5', 'half-rate fixture must have exact 0/.5 credit'); return v === '0.5' ? 1 : 0; };
const report = { runner: 'browser-world-clock-half-rate-v3', sourceHtmlSha256: sourceSha, runnerSha256: sha(method),
  inputManifestSha256: sha(imBytes), mode: 'TEST-ONLY-complete-old-writer-preboot-rate-half-real-world-interval',
  naturalGameplay: false, humanExperience: false, publicRateControlUsed: false, stateWritesAfterBoot: false,
  hiddenAdvanceCalls: 0, pausedForCapture: false, timerCallbacksInvokedByMethod: 0,
  budget: { overallMs: 70000, sceneMs: 48000, normalWriterWaitMs: 19000, minimumHpExclusive: 35, maximumObservedHpLoss: 12,
    movementKeys: 0, businessControls: 0, samplingIntervalMs: 120 }, pendingContract: { field: pendingKey, unit: 'canonical-decimal-string-minutes', range: '[0,1)', missingReadAs: '0', missingMaterializedByMethod: false },
  checks: [], errors: [], scenes: [], documentHashes: [], documents: [], cleanup: {} };
const began = Date.now(), deadline = began + report.budget.overallMs;
let server, browser, watchdog, cleanupPromise;
const contexts = new Set(), responseTasks = [];
const timeout = (cap = 6000) => { assert.ok(Date.now() < deadline, 'overall wall budget'); return Math.max(1, Math.min(cap, deadline - Date.now())); };
function check(name, ok, detail) { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); }
async function closeAll() { if (cleanupPromise) return cleanupPromise; cleanupPromise = (async () => {
  for (const c of [...contexts]) try { await c.close(); contexts.delete(c); } catch (e) { report.errors.push({ type: 'context-close', message: e.message }); }
  report.cleanup.contextsClosed = contexts.size === 0;
  if (browser) try { await browser.close(); report.cleanup.browserClosed = true; } catch { report.cleanup.browserClosed = false; }
  if (server) await new Promise(resolve => { server.close(() => { report.cleanup.serverClosed = true; resolve(); }); server.closeAllConnections?.(); });
})(); return cleanupPromise; }
async function sample(page, full = false) { return page.evaluate(({ pendingKey, full }) => {
  const visible = e => { if (!e || e.hidden) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) !== 0; };
  const text = id => { const e = document.getElementById(id); return visible(e) ? e.innerText : null; };
  const num = id => { const t = text(id); if (t === null || !t.trim()) return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
  const overlay = !document.getElementById('startOverlay')?.classList.contains('hidden');
  const s = overlay ? null : WorldSnapshot.capture();
  return { at: Date.now(), public: { overlay, hp: num('basicHpValue') ?? num('hpValue'), energy: num('basicEnergyValue') ?? num('energyValue'),
    dayLabel: text('dayLabel'), timeLabel: text('timeLabel'), viewport: { width: innerWidth, height: innerHeight }, recovery: text('recoveryNotice'),
    battle: document.body.classList.contains('threat-map-active') },
    clock: s ? { day: s.day, hour: s.hour, minute: s.minute, totalMinutes: s.world.totalMinutes,
      pending: Object.hasOwn(s.worldMeta.clock, pendingKey) ? s.worldMeta.clock[pendingKey] : '0', pendingPresent: Object.hasOwn(s.worldMeta.clock, pendingKey),
      rate: s.worldMeta.clock.rate, paused: s.worldMeta.clock.paused, scheduleMinutes: s.worldMeta.clock.scheduleMinutes,
      eventSeq: s.worldMeta.eventSeq, events: s.worldMeta.events.filter(e => e.type === 'time.advanced').slice(-35),
      aiConfig: s.scenarioSnapshot.aiConfig } : null,
    ownership: { timerActive: worldTimer !== null, lastTickAt: worldLastTickAt, counter: worldTickCounter,
      epoch: worldSimulationEpoch, generation: SessionController.generation, mode: SessionController.mode,
      hidden: document.hidden, restOwnsClock: CampRestController.ownsClock() },
    ...(full ? { privilegedReadonlyLive: s } : {}) };
}, { pendingKey, full }); }
function guard(s, hp, end) { assert.ok(Date.now() < end && Date.now() < deadline, 'scene wall budget');
  assert.equal(s.public.overlay, false); assert.ok(Number.isFinite(s.public.hp) && s.public.hp > 35 && hp - s.public.hp <= 12, 'current visible HP safety stop');
  assert.equal(s.public.battle, false); assert.ok(s.ownership.timerActive && s.ownership.mode === 'DAY' && !s.ownership.hidden && !s.ownership.restOwnsClock, 'actual active DAY timer owner');
  assert.equal(s.clock.rate, .5); assert.equal(s.clock.paused, false); assert.ok(canonicalRemainder(s.clock.pending), 'canonical string credit, missing read0 only'); halfUnits(s.clock.pending);
  assert.ok(Number.isInteger(s.clock.day) && s.clock.day >= 1 && Number.isInteger(s.clock.hour) && s.clock.hour >= 0 && s.clock.hour < 24 && Number.isInteger(s.clock.minute) && s.clock.minute >= 0 && s.clock.minute < 60 && s.clock.totalMinutes === minute(s.clock), 'integer calendar remains exact');
  for (const k of ['generativeDialogue', 'observerCommentary', 'generatedWorldEvents', 'learnedWorldModel']) assert.equal(s.clock.aiConfig[k], false);
}
async function capture(page, scene, label) {
  const s = await sample(page, true), base = scene.id + '-' + label; json(base + '-ui-live.json', s);
  scene.artifacts.push(artifact(base + '-ui-live.json'));
  await page.screenshot({ path: path.join(out, base + '.png'), timeout: timeout(4500), animations: 'allow' }); scene.artifacts.push(artifact(base + '.png'));
}
async function stored(page) { return page.evaluate(key => { const raw = localStorage.getItem(key); if (!raw) return null;
  const e = JSON.parse(raw), p = e.payload || e;
  const v = validateStoredProgress({ raw, sourceCategory: 'primary' }, BootRecovery.installed ? null : BootRecovery.scenarioContent);
  return { raw, reason: e.reason || null, savedAt: e.savedAt, p: { day: p.day, hour: p.hour, minute: p.minute,
    world: p.world, clock: p.worldMeta.clock, eventSeq: p.worldMeta.eventSeq }, validation: { ok: v.ok, reason: v.reason || null } };
}, saveKey); }
function saveArtifact(scene, label, st) { const name = scene.id + '-' + label + '-native.json'; write(name, st.raw); scene.artifacts.push(artifact(name)); return st; }
async function monitor(page, scene, phase, start, hp, end) {
  let previous = start, expectedEffectiveHalfUnits = 2 * minute(start.clock) + halfUnits(start.clock.pending);
  let callbacks = 0, firstObservedNonzero = null; const trace = [];
  const until = Math.min(end, deadline, Date.now() + report.budget.normalWriterWaitMs);
  while (Date.now() < until) {
    await page.waitForTimeout(120); const s = await sample(page); guard(s, hp, end);
    assert.equal(s.ownership.epoch, start.ownership.epoch); assert.equal(s.ownership.generation, start.ownership.generation);
    const delta = s.ownership.counter - previous.ownership.counter;
    assert.ok(delta === 0 || delta === 1, 'method must observe each real callback; sampling gap is not a product verdict');
    if (delta === 1) {
      const elapsed = Math.max(0, s.ownership.lastTickAt - previous.ownership.lastTickAt);
      const base = Math.max(1, Math.min(5, Math.floor(elapsed / 1200) || 1));
      expectedEffectiveHalfUnits += base; callbacks++;
      assert.equal(2 * minute(s.clock) + halfUnits(s.clock.pending), expectedEffectiveHalfUnits, 'observed actual callback inputs conserve exact half-minute units');
      const times = s.clock.events.filter(e => e.seq > previous.clock.eventSeq);
      assert.equal(times.length, 1, 'one actual time receipt per observed successful timer callback, including whole0');
      const event = times[0], whole = Math.floor((halfUnits(previous.clock.pending) + base) / 2);
      assert.equal(event.payload.minutes, whole, 'only whole minutes simulate');
      if (base % 2 !== 0 || previous.clock.pending !== '0') {
        assert.equal(event.payload.clockPolicy, 'whole-minute-v1'); assert.equal(event.payload.scaledMinutes, base * .5);
        assert.equal(event.payload.remainderBefore, previous.clock.pending); assert.equal(event.payload.remainderAfter, s.clock.pending);
      }
      trace.push({ at: s.at, counter: s.ownership.counter, baseMinutes: base, scaledMinutes: base * .5,
        day: s.clock.day, hour: s.clock.hour, minute: s.clock.minute, pending: s.clock.pending,
        eventSeq: s.clock.eventSeq, expectedEffectiveHalfUnits, actualTimeReceipt: event });
    } else assert.equal(2 * minute(s.clock) + halfUnits(s.clock.pending), expectedEffectiveHalfUnits, 'no unowned advance between observed callbacks');
    previous = s;
    const st = await stored(page);
    if (!firstObservedNonzero && st?.reason === 'world-subminute' && st.validation.ok === true && credit(st.p.clock) === '0.5') {
      saveArtifact(scene, phase + '-first-observed-nonzero-normal', st);
      firstObservedNonzero = { reason: st.reason, savedAt: st.savedAt, eventSeq: st.p.eventSeq, day: st.p.day, hour: st.p.hour, minute: st.p.minute, remainder: credit(st.p.clock) };
    }
    if (callbacks >= 10 && st && (st.reason === 'world-subminute' || phase === 'after-reload' && st.reason === 'world-tick') && st.validation.ok === true &&
        Number.isInteger(st.p.minute) && minute(st.p) > minute(start.clock) &&
        st.p.eventSeq > start.clock.eventSeq && credit(st.p.clock) === '0.5') {
      assert.ok(canonicalRemainder(credit(st.p.clock)));
      // An older valid nonzero save cannot stand in for current live credit.
      if (st.p.eventSeq !== s.clock.eventSeq || minute(st.p) !== minute(s.clock) || credit(st.p.clock) !== s.clock.pending || s.clock.pending !== '0.5') continue;
      const savedEffectiveHalfUnits = 2 * minute(st.p) + halfUnits(credit(st.p.clock));
      // Storage RPC can cross a callback/checkpoint after the preceding live read.
      // Wait for its real watermark to enter the bounded trace; do not invent it.
      if (!trace.some(t => 2 * minute(t) + halfUnits(t.pending) === savedEffectiveHalfUnits && t.eventSeq === st.p.eventSeq)) continue;
      json(scene.id + '-' + phase + '-callback-trace.json', { start, trace, callbacks, firstObservedNonzero, normalWriter: { reason: st.reason, savedAt: st.savedAt,
        eventSeq: st.p.eventSeq, calendar: { day: st.p.day, hour: st.p.hour, minute: st.p.minute }, pending: credit(st.p.clock) } });
      scene.artifacts.push(artifact(scene.id + '-' + phase + '-callback-trace.json'));
      return { state: s, writer: saveArtifact(scene, phase + '-normal', st), callbacks, trace };
    }
  }
  assert.fail('actual callbacks/normal world-tick writer did not reach bounded persistence target');
}
try {
  server = createServer((q, r) => { const u = new URL(q.url, 'http://local').pathname, b = u === '/' || u === '/index.html' ? html : u === '/actor-sprites.js' ? sprites : null;
    r.writeHead(b ? 200 : 404, { 'Content-Type': u.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8' }); r.end(b || ''); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const pw = fs.statSync(a['--playwright-module']).isDirectory() ? createRequire(import.meta.url)(a['--playwright-module']) : await import(pathToFileURL(a['--playwright-module']).href);
  browser = await (pw.chromium || pw.default.chromium).launch({ headless: true, executablePath: a['--chrome-executable'], timeout: timeout(25000) }); report.browserVersion = browser.version();
  watchdog = setTimeout(async () => { report.errors.push({ type: 'wall-watchdog', message: 'real wall deadline reached; no success inferred' }); await closeAll(); }, Math.max(1, deadline - Date.now()));
  for (const input of inputs) {
    const scene = { id: input.id, inputSha256: input.sha256, expectedInitialRemainder: input.expectedInitialRemainder, status: 'STARTED', artifacts: [] };
    report.scenes.push(scene); let context, page; const end = Math.min(deadline, Date.now() + 48000);
    try {
      context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.add(context);
      await context.addInitScript(({ key, raw, id }) => { const marker = 'qa-world-clock-preboot-v1'; if (!sessionStorage.getItem(marker)) {
        localStorage.setItem(key, raw); sessionStorage.setItem(marker, JSON.stringify({ id, seedCount: 1 })); }
      }, { key: saveKey, raw: input.raw, id: input.id });
      page = await context.newPage(); page.setDefaultTimeout(timeout());
      page.on('pageerror', e => report.errors.push({ scene: scene.id, type: 'pageerror', message: e.message }));
      page.on('response', r => { if (r.request().resourceType() === 'document' && r.frame() === page.mainFrame()) responseTasks.push((async () => {
        const b = await r.body(); report.documents.push({ scene: scene.id, status: r.status(), sha256: sha(b), bytes: b.length }); report.documentHashes.push(sha(b));
      })().catch(e => report.errors.push({ scene: scene.id, type: 'document', message: e.message }))); });
      await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded', timeout: timeout(15000) });
      const control = page.locator('#continueSaveBtn'); check(scene.id + ': actual Continue visible and enabled', await control.isVisible() && await control.isEnabled());
      await control.click({ timeout: timeout() }); await page.waitForFunction(() => document.getElementById('startOverlay').classList.contains('hidden'), null, { timeout: timeout() });
      const boot = await sample(page), hp = boot.public.hp; guard(boot, hp, end); assert.equal(boot.ownership.counter, 0, 'initial sample before first actual callback');
      check(scene.id + ': actual loader reads old missing credit0 without materialization or gifts', boot.clock.pending === '0' && !boot.clock.pendingPresent && input.expectedInitialRemainder === '0' && minute(boot.clock) === minute(input.p) && hp === input.p.hp);
      await capture(page, scene, 'initial-public');
      // Capture may span a callback. Start the audited trace from its current readonly watermark.
      const traceStart = await sample(page); guard(traceStart, hp, end);
      const first = await monitor(page, scene, 'before-reload', traceStart, hp, end);
      check(scene.id + ': ten actual callbacks conserve exact half-units and normal writer saves true nonzero credit', first.callbacks >= 10 && first.writer.validation.ok && credit(first.writer.p.clock) === '0.5' && first.writer.reason === 'world-subminute');
      // No screenshot or discretionary read between the verified normal writer and reload.
      await page.reload({ waitUntil: 'domcontentloaded', timeout: timeout(15000) });
      const selected = await stored(page); assert.ok(selected && selected.validation.ok); saveArtifact(scene, 'actual-reload-selected-primary', selected);
      await page.locator('#continueSaveBtn').click({ timeout: timeout() }); await page.waitForFunction(() => document.getElementById('startOverlay').classList.contains('hidden'), null, { timeout: timeout() });
      const restoredBoot = await sample(page); guard(restoredBoot, hp, end); assert.equal(restoredBoot.ownership.counter, 0, 'new document owns fresh timer counter');
      json(scene.id + '-reload-boot-watermark.json', restoredBoot); scene.artifacts.push(artifact(scene.id + '-reload-boot-watermark.json'));
      check(scene.id + ': real Continue restores the actual selected primary fraction/calendar', restoredBoot.clock.pending === credit(selected.p.clock) && minute(restoredBoot.clock) === minute(selected.p));
      check(scene.id + ': real nonzero normal credit survives selected primary and Continue', credit(selected.p.clock) === '0.5' && credit(selected.p.clock) === credit(first.writer.p.clock) && restoredBoot.clock.pending === '0.5');
      const second = await monitor(page, scene, 'after-reload', restoredBoot, hp, end);
      check(scene.id + ': new real ticks exceed the new boot watermark rather than old pre-pagehide state', second.writer.p.eventSeq > restoredBoot.clock.eventSeq && minute(second.writer.p) > minute(restoredBoot.clock));
      await page.setViewportSize({ width: 390, height: 844 }); await capture(page, scene, 'restored-public-390');
      const marker = await page.evaluate(() => JSON.parse(sessionStorage.getItem('qa-world-clock-preboot-v1')));
      check(scene.id + ': original full input seeded once across real reload', marker.id === scene.id && marker.seedCount === 1);
      scene.status = 'VERIFIED'; scene.actualCallbacks = first.callbacks + second.callbacks;
    } catch (e) {
      scene.status = 'FAILED'; report.errors.push({ scene: scene.id, type: e.name, message: e.message });
      if (page) { try { await capture(page, scene, 'failure'); } catch (x) { scene.failureCaptureUnavailable = x.message; }
        try { const st = await stored(page); if (st) saveArtifact(scene, 'failure', st); } catch (x) { scene.failureNativeUnavailable = x.message; } }
    } finally { if (context) try { await context.close(); contexts.delete(context); } catch (e) { report.errors.push({ type: 'context-close', message: e.message }); } }
  }
} catch (e) { report.errors.push({ type: e.name, message: e.message }); }
finally {
  clearTimeout(watchdog); await Promise.allSettled(responseTasks); await closeAll();
  for (const d of report.documents) report.checks.push({ name: d.scene + ': actual main body equals frozen HTML', ok: d.status === 200 && d.sha256 === sourceSha });
  for (const s of report.scenes) report.checks.push({ name: s.id + ': first load and real reload recorded', ok: report.documents.filter(d => d.scene === s.id).length === 2 });
  report.count = report.checks.length; report.passed = report.checks.filter(c => c.ok).length; report.elapsedMs = Date.now() - began;
  report.ok = report.scenes.length === inputs.length && report.scenes.every(s => s.status === 'VERIFIED') && report.checks.every(c => c.ok) && report.errors.length === 0 && ['contextsClosed', 'browserClosed', 'serverClosed'].every(k => report.cleanup[k] === true);
  report.status = report.ok ? 'VERIFIED' : 'FAILED'; json('report.json', report); console.log(JSON.stringify({ ok: report.ok, count: report.count, passed: report.passed, errors: report.errors, cleanup: report.cleanup }));
  if (!report.ok) process.exitCode = 1;
}
