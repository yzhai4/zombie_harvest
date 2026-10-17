import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Actual Chrome / complete TEST-ONLY preboot fixtures / one public F total.
// This authoring snapshot is unexecuted. Terminal artifacts determine later status.
const a = {}, keys = new Set(['--html', '--sprites', '--input-manifest', '--out', '--expect-html-sha256',
  '--expect-input-manifest-sha256', '--playwright-module', '--chrome-executable']);
for (let i = 2; i < process.argv.length; i += 2) {
  assert.ok(keys.has(process.argv[i]) && process.argv[i + 1] && !Object.hasOwn(a, process.argv[i]));
  a[process.argv[i]] = process.argv[i + 1];
}
for (const k of ['--html', '--sprites', '--input-manifest', '--out', '--playwright-module', '--chrome-executable']) assert.ok(path.isAbsolute(a[k] || ''), k);
for (const k of ['--expect-html-sha256', '--expect-input-manifest-sha256']) assert.match(a[k] || '', /^[a-f0-9]{64}$/);
const sha = b => createHash('sha256').update(b).digest('hex'), read = p => fs.readFileSync(p);
const html = read(a['--html']), sprites = read(a['--sprites']), method = read(fileURLToPath(import.meta.url));
const manifestBytes = read(a['--input-manifest']), im = JSON.parse(manifestBytes), expected = a['--expect-html-sha256'];
assert.equal(sha(html), expected); assert.equal(sha(manifestBytes), a['--expect-input-manifest-sha256']);
assert.equal(im.schema, 'PlayerDayAttackBrowserInputsV1'); assert.equal(im.sourceHtmlSha256, expected);
assert.deepEqual(im.scenes.map(s => s.id), ['outer', 'inner']);
const saveKey = html.toString('utf8').match(/const SAVE_KEY = '([^']+)'/)?.[1]; assert.ok(saveKey);
const inputs = Object.fromEntries(im.scenes.map(s => {
  assert.ok(s.file && !path.isAbsolute(s.file) && !s.file.split(/[\\/]/).includes('..'));
  assert.equal(s.kind, 'TEST-ONLY-complete-original-writer-derived-geometry-actual-loader-writer');
  const raw = read(path.join(path.dirname(a['--input-manifest']), s.file));
  assert.equal(sha(raw), s.sha256); assert.equal(raw.length, s.bytes);
  const p = JSON.parse(raw).payload; assert.equal(p.npcs.length, 10); assert.equal(p.worldZombies.length, 4);
  return [s.id, { ...s, raw: raw.toString('utf8'), p }];
}));
assert.ok(!fs.existsSync(a['--out']), 'fresh output only'); fs.mkdirSync(a['--out'], { recursive: true });
const out = a['--out'], write = (n, b) => fs.writeFileSync(path.join(out, n), b);
const json = (n, v) => write(n, JSON.stringify(v, null, 2) + '\n');
const artifact = n => { const b = read(path.join(out, n)); return { file: n, sha256: sha(b), bytes: b.length }; };
write('runner-executed.mjs', method); write('source-executed.html', html); write('actor-sprites.js', sprites);
write('input-manifest.json', manifestBytes); for (const s of Object.values(inputs)) write(s.id + '-input-native.json', s.raw);
for (const ref of im.provenanceFiles) {
  assert.ok(ref.file && !path.isAbsolute(ref.file) && !ref.file.split(/[\\/]/).includes('..'));
  const b = read(path.join(path.dirname(a['--input-manifest']), ref.file));
  assert.equal(sha(b), ref.sha256); assert.equal(b.length, ref.bytes); write(ref.file, b);
}
const preparation = JSON.parse(read(path.join(out, im.preparation)));
assert.equal(preparation.status, 'PREPARATION_VERIFIED'); assert.equal(preparation.sourceHtmlSha256, expected);
const report = { runner: 'browser-player-day-attack-v1', runnerSha256: sha(method), sourceHtmlSha256: expected,
  inputManifestSha256: sha(manifestBytes), mode: 'TEST-ONLY-full-writer-derived-geometry-public-controls',
  naturalGameplay: false, humanExperience: false, testStateWritesAfterBoot: false, hiddenGameActionsAfterBoot: false,
  forceClicks: false, pausedWorldForCapture: false, privilegedReads: 'WorldSnapshot.capture for fixture geometry and proof accounting only; no target navigation',
  budget: { overallMs: 100000, sceneMs: 30000, minimumHpExclusive: 35, maximumObservedHpLoss: 30,
    publicAttackAttempts: 1, movementKeys: 0, maximumAutomaticSaveWaitMs: 16000 },
  checks: [], errors: [], scenes: [], documents: [], actions: [], cleanup: {} };
const started = Date.now(), deadline = started + report.budget.overallMs;
let server, browser, activePage, activeScene, watchdog, cleanupPromise;
const contexts = new Set(), responseTasks = [];
const minute = p => (p.day - 1) * 1440 + p.hour * 60 + p.minute;
const same = (x, y) => { try { assert.deepEqual(x, y); return true; } catch { return false; } };
function check(name, ok, detail) { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); }
function timeout(cap = 6000) { assert.ok(Date.now() < deadline, 'overall deadline'); return Math.max(1, Math.min(cap, deadline - Date.now())); }
async function closeAll() {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
  for (const c of [...contexts]) try { await c.close(); contexts.delete(c); } catch (e) { report.errors.push({ type: 'cleanup-context', message: e.message }); }
  report.cleanup.contextsClosed = contexts.size === 0;
  if (browser) try { await browser.close(); report.cleanup.browserClosed = true; } catch { report.cleanup.browserClosed = false; }
  if (server) await new Promise(resolve => { server.close(() => { report.cleanup.serverClosed = true; resolve(); }); server.closeAllConnections?.(); });
  })();
  return cleanupPromise;
}
async function sample(page) {
  return page.evaluate(() => {
    const visible = e => { if (!e || e.hidden) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) !== 0; };
    const value = id => { const e = document.getElementById(id); if (!visible(e)) return null; const n = Number(e.innerText); return Number.isFinite(n) ? n : null; };
    const view = e => { if (!e) return null; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return { text: e.innerText,
      visible: visible(e), disabled: !!e.disabled, dataset: { ...e.dataset }, fontSize: c.fontSize,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom } }; };
    const b = document.querySelector('#contextActions [data-context-action="attack"]');
    const described = (b?.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map(id => view(document.getElementById(id))).filter(Boolean);
    const local = [...document.querySelectorAll('#contextActions [data-player-attack-feedback], #playerAttackFeedback, .player-attack-feedback')].map(view);
    const overlay = !document.getElementById('startOverlay')?.classList.contains('hidden');
    return { public: { overlay, hp: value('basicHpValue') ?? value('hpValue'), energy: value('basicEnergyValue') ?? value('energyValue'),
      context: view(document.getElementById('contextPanel')), title: view(document.getElementById('contextTitle')),
      hint: view(document.getElementById('contextHint')), attack: view(b), described, local, viewport: { width: innerWidth, height: innerHeight },
      battle: document.body.classList.contains('threat-map-active'), focused: document.activeElement?.tagName || null },
      live: overlay ? null : WorldSnapshot.capture(), at: Date.now() };
  });
}
function geometry(s, input) {
  const live = s.live, z = live?.worldZombies?.filter(v => v.id === input.targetId);
  assert.ok(z?.length === 1 && z[0].hp > 0, 'actual current declared target is live and unambiguous');
  const d = Math.hypot(z[0].x - live.player.x, z[0].y - live.player.y);
  return { distance: d, targetId: z[0].id, targetHp: z[0].hp, player: live.player,
    livingIds: live.worldZombies.filter(v => v.hp > 0).map(v => v.id), eventSeq: live.worldMeta.eventSeq, worldMinute: minute(live) };
}
function guard(s, initialHp, sceneEnd) {
  assert.ok(Date.now() < sceneEnd && Date.now() < deadline, 'bounded scene deadline');
  assert.equal(s.public.overlay, false); assert.ok(Number.isFinite(s.public.hp) && s.public.hp > 35 && initialHp - s.public.hp <= 30, 'actual public HP budget');
  assert.equal(s.public.battle, false, 'DAY only');
}
async function capture(page, scene, label, initialHp, sceneEnd) {
  const before = await sample(page); guard(before, initialHp, sceneEnd);
  const base = scene.id + '-' + label;
  await page.screenshot({ path: path.join(out, base + '.png'), timeout: timeout(4000), animations: 'allow' });
  const after = await sample(page); guard(after, initialHp, sceneEnd);
  json(base + '-ui-live.json', { before, after, scope: 'public DOM plus separate privileged readonly WorldSnapshot; screenshot lies between samples' });
  scene.artifacts.push(artifact(base + '.png'), artifact(base + '-ui-live.json'));
  return { before, after };
}
async function rawSave(page, scene, label) {
  const raw = await page.evaluate(k => localStorage.getItem(k), saveKey); assert.ok(raw);
  const n = scene.id + '-' + label + '-native.json'; write(n, raw); scene.artifacts.push(artifact(n));
  return { raw, e: JSON.parse(raw), p: JSON.parse(raw).payload };
}
async function waitSave(page, scene, label, predicate, initialHp, sceneEnd) {
  const until = Math.min(sceneEnd, deadline, Date.now() + 16000);
  while (Date.now() < until) {
    const s = await sample(page); guard(s, initialHp, sceneEnd);
    const raw = await page.evaluate(k => localStorage.getItem(k), saveKey);
    if (raw) { const e = JSON.parse(raw); if (e.payload && e.reason !== 'pagehide' && predicate(e.payload, e, raw)) return rawSave(page, scene, label); }
    await page.waitForTimeout(80);
  }
  assert.fail('normal automatic writer did not reach ' + label + ' before bounded deadline');
}
function attackEvents(p, seq) { return p.worldMeta.events.filter(e => e.seq > seq && e.type === 'threat.attacked'); }
try {
  server = createServer((req, res) => { const u = new URL(req.url, 'http://local').pathname;
    const b = u === '/' || u === '/index.html' ? html : u === '/actor-sprites.js' ? sprites : null;
    res.writeHead(b ? 200 : 404, { 'Content-Type': u.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8' }); res.end(b || ''); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const mod = fs.statSync(a['--playwright-module']).isDirectory() ? createRequire(import.meta.url)(a['--playwright-module']) : await import(pathToFileURL(a['--playwright-module']).href);
  browser = await (mod.chromium || mod.default.chromium).launch({ headless: true, executablePath: a['--chrome-executable'], timeout: timeout(25000) });
  report.browserVersion = browser.version();
  watchdog = setTimeout(async () => { report.errors.push({ type: 'overall-watchdog', message: 'wall budget reached; active scene remains failed' });
    try { if (activePage) await capture(activePage, activeScene, 'watchdog', 100, Date.now() + 2000); } catch (e) { report.watchdogCaptureUnavailable = e.message; }
    await closeAll(); }, Math.max(1, deadline - Date.now()));
  for (const config of [{ id: 'outer-desktop', input: 'outer', width: 1440, height: 1000 },
    { id: 'outer-390', input: 'outer', width: 390, height: 844 }, { id: 'inner-F-save-reload', input: 'inner', width: 390, height: 844 }]) {
    const input = inputs[config.input], sceneEnd = Math.min(deadline, Date.now() + 30000);
    const scene = { id: config.id, inputSha256: input.sha256, targetId: input.targetId, status: 'STARTED', artifacts: [] };
    report.scenes.push(scene); activeScene = scene; let context, page;
    try {
      context = await browser.newContext({ viewport: { width: config.width, height: config.height } }); contexts.add(context);
      await context.addInitScript(({ key, raw, id }) => { const marker = 'qa-player-attack-preboot-v1';
        if (!sessionStorage.getItem(marker)) { localStorage.setItem(key, raw); sessionStorage.setItem(marker, JSON.stringify({ id, seedCount: 1 })); }
      }, { key: saveKey, raw: input.raw, id: scene.id });
      page = await context.newPage(); activePage = page; page.setDefaultTimeout(timeout());
      page.on('pageerror', e => report.errors.push({ scene: scene.id, type: 'pageerror', message: e.message }));
      page.on('response', response => { if (response.request().resourceType() === 'document' && response.frame() === page.mainFrame()) {
        responseTasks.push((async () => { const b = await response.body(); report.documents.push({ scene: scene.id, status: response.status(), sha256: sha(b), bytes: b.length }); })()
          .catch(e => report.errors.push({ scene: scene.id, type: 'document-body', message: e.message })));
      } });
      await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded', timeout: timeout(15000) });
      const c = page.locator('#continueSaveBtn'); assert.ok(await c.isVisible() && await c.isEnabled());
      await c.click({ timeout: timeout() }); report.actions.push({ scene: scene.id, kind: 'click', selector: '#continueSaveBtn', category: 'ui' });
      await page.waitForFunction(() => document.getElementById('startOverlay').classList.contains('hidden'), null, { timeout: timeout() });
      // Ordinary page scrolling exposes the current context; never reveal legacy controls.
      const publicAttack = page.locator('#contextActions [data-context-action="attack"]');
      await publicAttack.scrollIntoViewIfNeeded({ timeout: timeout() });
      report.actions.push({ scene: scene.id, kind: 'scroll-public-context-into-view', category: 'ui' });
      const initial = await sample(page), initialHp = initial.public.hp; guard(initial, initialHp, sceneEnd);
      json(scene.id + '-initial-ui-live.json', initial); scene.artifacts.push(artifact(scene.id + '-initial-ui-live.json'));
      if (config.input === 'outer') {
        const shot = await capture(page, scene, 'outside-feedback', initialHp, sceneEnd);
        const gb = geometry(shot.before, input), ga = geometry(shot.after, input); scene.observedGeometry = { before: gb, after: ga };
        check(scene.id + ': actual target remains outside1.15 and within public1.25 on both sides of screenshot',
          [gb.distance, ga.distance].every(d => d > 1.15 && d <= 1.25), scene.observedGeometry);
        const ui = shot.before.public, b = ui.attack;
        check(scene.id + ': actual public context attack is present visible and disabled', !!b && b.visible && b.disabled);
        const reasons = [b?.text, ui.hint?.visible ? ui.hint.text : '', ...ui.described.filter(v => v.visible).map(v => v.text), ...ui.local.filter(v => v.visible).map(v => v.text)].filter(Boolean).join(' ');
        check(scene.id + ': coarse distance reason is visible without hover', /靠近|距离|1\.15|范围|再近/.test(reasons), reasons);
        const live = shot.after.live;
        check(scene.id + ': no attack business was submitted by feedback observation', !attackEvents(live, input.p.worldMeta.eventSeq).length &&
          !live.worldMeta.replay.commands.some(v => v.type === 'threat.attack' && !input.p.worldMeta.replay.commands.some(old => old.commandId === v.commandId)));
        await rawSave(page, scene, 'final');
      } else {
        const before = await sample(page), g = geometry(before, input); guard(before, initialHp, sceneEnd);
        const b = before.public.attack;
        check(scene.id + ': actual public context attack is enabled inside1.15', g.distance <= 1.15 && !!b?.visible && !b.disabled, g);
        // Only safety veto: no navigation or target choice from privileged positions.
        const others = before.live.worldZombies.filter(z => z.hp > 0 && z.id !== input.targetId).map(z => {
          const speed = { normal: .065, runner: .12, brute: .04 }[z.kind], factor = z.speedFactor ?? 1;
          const distance = Math.hypot(z.x - before.live.player.x, z.y - before.live.player.y), envelope = 1.25 + speed * factor * 12 + .6;
          return { id: z.id, known: Number.isFinite(speed) && factor > 0 && factor <= 1.12, distance, envelope };
        });
        scene.privilegedPreF = { geometry: g, others, purpose: 'conservative veto only; fixture has fixed target, no hidden navigation' };
        check(scene.id + ': real F fits public HP/E and conservative other-enemy margin', before.public.hp >= 70 && before.public.energy >= 10 && others.every(o => o.known && o.distance > o.envelope));
        const seq = before.live.worldMeta.eventSeq;
        report.actions.push({ scene: scene.id, kind: 'key', key: 'f', category: 'self-defense', attempt: 1, submittedAt: Date.now() });
        await page.keyboard.press('f');
        const immediate = await sample(page); guard(immediate, initialHp, sceneEnd);
        json(scene.id + '-immediate-after-F-ui-live.json', { before, after: immediate }); scene.artifacts.push(artifact(scene.id + '-immediate-after-F-ui-live.json'));
        const saved = await waitSave(page, scene, 'normal-after-F', p => attackEvents(p, seq).length > 0, initialHp, sceneEnd);
        const events = attackEvents(saved.p, seq); check(scene.id + ': exactly one real successful F receipt', events.length === 1);
        const event = events[0], proof = event.payload, command = saved.p.worldMeta.replay.commands.find(v => v.commandId === event.commandId);
        scene.actualAttack = { event, command, proof };
        check(scene.id + ': parent command and receipt bind player and exact fixture target', event.actorId === 'player-1' && command?.actorId === 'player-1' && command.type === 'threat.attack' && command.payload.targetId === input.targetId && proof.targetId === input.targetId && proof.target?.id === input.targetId);
        check(scene.id + ': actual proof records gross5 independent of regeneration', proof.payment?.cost?.energy === 5 && Number.isFinite(proof.payment?.before?.energy) && proof.payment.before.energy - proof.payment.after.energy === 5);
        check(scene.id + ': immediate rustAxe50 hit matches same target rather than later NPC damage', proof.weaponId === 'rustAxe' && proof.hit?.damage === 50 && proof.hit.beforeHp === g.targetHp && proof.hit.beforeHp - proof.hit.afterHp === 50 && proof.target.before?.hp === proof.hit.beforeHp && proof.target.afterHit?.hp === proof.hit.afterHp);
        const advance = proof.advance, child = saved.p.worldMeta.events.filter(v => v.type === 'time.advanced' && v.commandId === advance?.commandId && v.causationId === command.commandId);
        check(scene.id + ': actual nested advance10 is uniquely linked to the paid parent', advance?.ok === true && advance.paused !== true && advance.minutes === 10 && proof.clock?.requestedMinutes === 10 && proof.clock.elapsedMinutes === 10 && minute(proof.clock.after) - minute(proof.clock.before) === 10 && child.length === 1 && child[0].eventId === advance.eventId && child[0].payload.minutes === 10 && advance.causationId === command.commandId);
        await capture(page, scene, 'after-F-390', initialHp, sceneEnd);
        await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, scene, 'after-F-desktop', initialHp, sceneEnd);
        const normal = await waitSave(page, scene, 'normal-before-reload', p => p.worldMeta.eventSeq >= saved.p.worldMeta.eventSeq && p.worldMeta.events.some(v => v.eventId === event.eventId), initialHp, sceneEnd);
        scene.savedBeforeReload = { savedAt: normal.e.savedAt, reason: normal.e.reason, eventSeq: normal.p.worldMeta.eventSeq, worldMinute: minute(normal.p) };
        await page.reload({ waitUntil: 'domcontentloaded', timeout: timeout(15000) });
        assert.ok(await page.locator('#continueSaveBtn').isVisible()); await page.locator('#continueSaveBtn').click({ timeout: timeout() });
        report.actions.push({ scene: scene.id, kind: 'reload-and-Continue', category: 'ui' });
        await page.waitForFunction(() => document.getElementById('startOverlay').classList.contains('hidden'), null, { timeout: timeout() });
        const boot = await sample(page); guard(boot, initialHp, sceneEnd);
        json(scene.id + '-reload-boot-ui-live.json', boot); scene.artifacts.push(artifact(scene.id + '-reload-boot-ui-live.json'));
        scene.postReloadBootWatermark = { eventSeq: boot.live.worldMeta.eventSeq, worldMinute: minute(boot.live) };
        const restored = await waitSave(page, scene, 'normal-after-reload-new-tick', p => p.worldMeta.eventSeq > boot.live.worldMeta.eventSeq && minute(p) > minute(boot.live) && p.worldMeta.events.some(v => v.type === 'time.advanced' && v.seq > boot.live.worldMeta.eventSeq), initialHp, sceneEnd);
        const matching = restored.p.worldMeta.events.filter(v => v.type === 'threat.attacked' && v.commandId === command.commandId);
        check(scene.id + ': normal writer reload and new timer tick do not repeat the F', matching.length === 1 && same(matching[0], event) && restored.p.worldMeta.replay.commands.filter(v => v.type === 'threat.attack' && v.commandId === command.commandId).length === 1 && attackEvents(restored.p, seq).length === 1);
        await capture(page, scene, 'restored-desktop', initialHp, sceneEnd);
      }
      const marker = await page.evaluate(() => JSON.parse(sessionStorage.getItem('qa-player-attack-preboot-v1')));
      check(scene.id + ': complete input seeded once only including reload', marker.id === scene.id && marker.seedCount === 1);
      scene.status = 'VERIFIED';
    } catch (e) {
      scene.status = 'FAILED'; report.errors.push({ scene: scene.id, type: e.name, message: e.message });
      if (page) { try { const s = await sample(page); json(scene.id + '-failure-ui-live.json', s); scene.artifacts.push(artifact(scene.id + '-failure-ui-live.json')); } catch (x) { scene.failureSampleUnavailable = x.message; }
        try { await page.screenshot({ path: path.join(out, scene.id + '-failure.png'), timeout: timeout(2500) }); scene.artifacts.push(artifact(scene.id + '-failure.png')); } catch (x) { scene.failureScreenshotUnavailable = x.message; }
        try { await rawSave(page, scene, 'failure'); } catch (x) { scene.failureNativeUnavailable = x.message; } }
    } finally { activePage = null; if (context) try { await context.close(); contexts.delete(context); } catch (e) { report.errors.push({ scene: scene.id, type: 'context-close', message: e.message }); } }
  }
} catch (e) { report.errors.push({ type: e.name, message: e.message }); }
finally {
  clearTimeout(watchdog); await Promise.allSettled(responseTasks); await closeAll();
  for (const d of report.documents) report.checks.push({ name: d.scene + ': actual main response SHA equals frozen HTML', ok: d.status === 200 && d.sha256 === expected });
  for (const s of report.scenes) { const count = report.documents.filter(v => v.scene === s.id).length;
    report.checks.push({ name: s.id + ': actual main response count', ok: count === (s.id === 'inner-F-save-reload' ? 2 : 1), detail: count }); }
  report.passed = report.checks.filter(c => c.ok).length; report.count = report.checks.length;
  report.elapsedMs = Date.now() - started; report.ok = report.scenes.length === 3 && report.scenes.every(s => s.status === 'VERIFIED') && report.errors.length === 0 && report.checks.every(c => c.ok) && ['contextsClosed', 'browserClosed', 'serverClosed'].every(k => report.cleanup[k] === true);
  report.status = report.ok ? 'VERIFIED' : 'FAILED'; json('report.json', report);
  console.log(JSON.stringify({ ok: report.ok, count: report.count, passed: report.passed, errors: report.errors, cleanup: report.cleanup }));
  if (!report.ok) process.exitCode = 1;
}
