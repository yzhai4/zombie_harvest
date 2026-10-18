import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Preparation only until root freezes source/IO and authorizes a fresh execution.
const a = {};
for (let i = 2; i < process.argv.length; i += 2) { assert.ok(process.argv[i + 1] && !Object.hasOwn(a, process.argv[i])); a[process.argv[i]] = process.argv[i + 1]; }
for (const k of ['--html','--sprites','--input-manifest','--out','--playwright-module','--chrome-executable']) assert.ok(path.isAbsolute(a[k] || ''), k);
for (const k of ['--expect-html-sha256','--expect-input-manifest-sha256']) assert.match(a[k] || '', /^[a-f0-9]{64}$/);
const sha = b => createHash('sha256').update(b).digest('hex'), read = p => fs.readFileSync(p), clone = v => JSON.parse(JSON.stringify(v));
const html = read(a['--html']), sprites = read(a['--sprites']), method = read(fileURLToPath(import.meta.url)), imBytes = read(a['--input-manifest']), im = JSON.parse(imBytes);
const sourceSha = sha(html); assert.equal(sourceSha, a['--expect-html-sha256']); assert.equal(sha(imBytes), a['--expect-input-manifest-sha256']);
assert.equal(im.schema, 'DayFatalBrowserInputsV1'); assert.equal(im.sourceHtmlSha256, sourceSha); assert.equal(im.scenes.length, 3);
const key = html.toString('utf8').match(/const SAVE_KEY = '([^']+)'/)?.[1]; assert.ok(key);
const inputs = im.scenes.map(s => { assert.ok(!path.isAbsolute(s.file) && !s.file.split(/[\\/]/).includes('..'));
  const b = read(path.join(path.dirname(a['--input-manifest']), s.file)); assert.equal(sha(b), s.sha256); assert.equal(b.length, s.bytes);
  const p = JSON.parse(b).payload; assert.equal(p.hp, 4); assert.equal(p.npcs.length, 10); assert.equal(p.worldZombies.length, 4); assert.equal(p.worldMeta.clock.paused, s.paused);
  return { ...s, raw: b.toString('utf8'), p }; });
assert.ok(!fs.existsSync(a['--out'])); fs.mkdirSync(a['--out'], { recursive: true });
const out = a['--out'], write = (n, b) => fs.writeFileSync(path.join(out, n), b), json = (n, v) => write(n, JSON.stringify(v, null, 2) + '\n');
const artifact = n => { const b = read(path.join(out, n)); return { file: n, sha256: sha(b), bytes: b.length }; };
write('runner-executed.mjs', method); write('source-executed.html', html); write('actor-sprites.js', sprites); write('input-manifest.json', imBytes);
for (const s of inputs) write(s.file, s.raw);
for (const x of im.provenanceFiles) { assert.ok(!path.isAbsolute(x.file) && !x.file.split(/[\\/]/).includes('..')); const b = read(path.join(path.dirname(a['--input-manifest']), x.file)); assert.equal(sha(b), x.sha256); assert.equal(b.length, x.bytes); write(x.file, b); }
const report = { runner: 'browser-day-fatal-v1', sourceHtmlSha256: sourceSha, runnerSha256: sha(method), inputManifestSha256: sha(imBytes),
  mode: 'TEST-ONLY-complete-old-writer-derived-real-damage-public-Continue-and-F', naturalGameplay: false, humanExperience: false,
  stateWritesAfterBoot: false, hiddenAdvanceCalls: 0, hiddenFatalCalls: 0, noForcedHiddenControls: true,
  testIOScope: 'third scene only: preboot Storage.setItem wrapper rejects exactly the first DAY-capsule primary write; production writer/validator/classifier unchanged',
  budget: { overallMs: 120000, sceneMs: 38000, fatalWaitMs: 21000, normalWriterWaitMs: 7000, frozenObservationMs: 2600, maximumPublicFPerScene: 1, movement: 0 },
  checks: [], errors: [], scenes: [], documents: [], documentHashes: [], cleanup: {} };
const began = Date.now(), deadline = began + report.budget.overallMs, contexts = new Set(), responseTasks = [];
let server, browser, watchdog, cleanupPromise;
const timeout = (n = 6000) => { assert.ok(Date.now() < deadline, 'overall wall budget'); return Math.max(1, Math.min(n, deadline - Date.now())); };
function check(name, ok, detail) { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); }
async function closeAll() { if (cleanupPromise) return cleanupPromise; cleanupPromise = (async () => {
  for (const c of [...contexts]) try { await c.close(); contexts.delete(c); } catch (e) { report.errors.push({ type: 'context-close', message: e.message }); }
  report.cleanup.contextsClosed = contexts.size === 0;
  if (browser) try { await browser.close(); report.cleanup.browserClosed = true; } catch { report.cleanup.browserClosed = false; }
  if (server) await new Promise(resolve => { server.close(() => { report.cleanup.serverClosed = true; resolve(); }); server.closeAllConnections?.(); });
})(); return cleanupPromise; }
async function sample(page, full = false) { return page.evaluate(({ full }) => {
  const visible = e => { if (!e || e.hidden) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) !== 0; };
  const text = id => { const e = document.getElementById(id); return visible(e) ? e.innerText : null; };
  const num = id => { const t = text(id); if (t === null || !t.trim()) return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
  const overlay = !document.getElementById('startOverlay')?.classList.contains('hidden'), s = overlay ? null : WorldSnapshot.capture();
  const live = s ? { hp: state.hp, gameOver: state.gameOver, night: state.night, energy: state.energy, food: state.food, wood: state.wood, stone: state.stone, parts: state.parts,
    morale: state.morale, sanity: state.sanity, zombieKills: state.zombieKills, player: { x: state.player.x, y: state.player.y }, day: state.day, hour: state.hour, minute: state.minute,
    dayFatalOutcome: state.dayFatalOutcome ?? null, world: s.world, clock: s.worldMeta.clock, eventSeq: s.worldMeta.eventSeq, events: s.worldMeta.events,
    commands: s.worldMeta.replay.commands, npcIds: s.npcs.map(n => n.id), npcDeaths: s.npcs.filter(n => n.lifeState === 'dead').map(n => n.id),
    enemyIds: s.worldZombies.map(z => z.id), aiConfig: s.scenarioSnapshot.aiConfig } : null;
  return { at: Date.now(), public: { startOverlay: overlay, hp: num('basicHpValue') ?? num('hpValue'), energy: num('basicEnergyValue') ?? num('energyValue'),
    lossOverlay: visible(document.getElementById('nightOverlay')), title: text('nightTitle'), subtitle: text('summarySubtitle'), copy: text('nightCopy'), feed: text('summaryFeed'),
    saveStatus: text('dayFatalSaveStatus'), saveState: document.getElementById('dayFatalSaveStatus')?.getAttribute('data-save-state') ?? null,
    retryVisible: visible(document.getElementById('dayFatalRetryBtn')), retryDisabled: document.getElementById('dayFatalRetryBtn')?.disabled ?? null,
    waveProgress: text('waveProgressText'), battleStage: text('battleStage'), viewport: { width: innerWidth, height: innerHeight },
    attack: [...document.querySelectorAll('[data-context-action="attack"]')].filter(visible).map(e => ({ targetId: e.dataset.enemyId, disabled: e.disabled, text: e.innerText })) },
    live, ownership: { mode: SessionController.mode, generation: SessionController.generation, exiting: SessionController.exiting, worldTimer: worldTimer !== null,
      battleTimer: battleTimer !== null, worldTickCounter, rest: CampRestController.status(), restOwnsClock: CampRestController.ownsClock(), heldDirections: heldDirections.size },
    testIO: window.__qaDayFatalIO || null, ...(full ? { privilegedReadonlyLive: s } : {}) };
}, { full }); }
async function stores(page) { return page.evaluate(key => { const primary = localStorage.getItem(key), backup = localStorage.getItem(key + '.bak'); if (!primary) return { primary, backup };
  const v = validateStoredProgress({ raw: primary, sourceCategory: 'primary' }, BootRecovery.installed ? null : BootRecovery.scenarioContent);
  return { primary, backup, validation: { ok: v.ok, reason: v.reason || null }, classification: v.ok ? classifySavedRecovery(v.payload).classification : null };
}, key); }
function native(scene, label, raw) { assert.equal(typeof raw, 'string'); const file = scene.id + '-' + label + '-native.json'; write(file, raw); scene.artifacts.push(artifact(file)); }
async function capture(page, scene, label) { const base = scene.id + '-' + label; json(base + '-ui-live.json', await sample(page, true)); scene.artifacts.push(artifact(base + '-ui-live.json'));
  await page.screenshot({ path: path.join(out, base + '.png'), timeout: timeout(4000), animations: 'allow' }); scene.artifacts.push(artifact(base + '.png')); }
async function until(page, predicate, end, message) { while (Date.now() < end && Date.now() < deadline) { const s = await sample(page); if (predicate(s)) return s; await page.waitForTimeout(90); } assert.fail(message); }
function outcomeFacts(s) { const p = s.live; return { hp: p.hp, gameOver: p.gameOver, night: p.night, energy: p.energy, food: p.food, wood: p.wood, stone: p.stone, parts: p.parts,
  morale: p.morale, sanity: p.sanity, zombieKills: p.zombieKills, player: p.player, day: p.day, hour: p.hour, minute: p.minute, world: p.world, clock: p.clock,
  dayFatalOutcome: p.dayFatalOutcome, deaths: p.npcDeaths, lossEvents: p.events.filter(e => e.type === 'player.dayFatal') }; }
async function normalWriter(page, scene, end, capsule) { const stop = Math.min(end, Date.now() + report.budget.normalWriterWaitMs);
  while (Date.now() < stop) { const st = await stores(page), s = await sample(page);
    if (st.primary && st.validation?.ok && st.classification === 'LOSS_REPORT') { const e = JSON.parse(st.primary), p = e.payload;
      if (JSON.stringify(p.dayFatalOutcome) === JSON.stringify(capsule) && p.worldMeta.eventSeq === s.live.eventSeq && e.reason !== 'visibility-hidden' && e.reason !== 'pagehide') {
        native(scene, 'normal-loss-before-reload', st.primary); return { storage: st, sample: s, envelope: e }; }
    } await page.waitForTimeout(90);
  } assert.fail('normal complete final LOSS writer not observed before reload'); }
function checkLoss(scene, s, boot) {
  const p = s.live, cap = p?.dayFatalOutcome, losses = p?.events.filter(e => e.type === 'player.dayFatal' && e.seq > boot.live.eventSeq) || [];
  check(scene.id + ': actual real damage reaches a single DAY LOSS', p?.hp === 0 && p.gameOver === 'lose' && p.night === false && s.ownership.mode === 'LOSS' && cap?.version === 1 && losses.length === 1);
  check(scene.id + ': final source capsule identifies actual fatal event', cap.eventId === losses[0].eventId && cap.cause === scene.expectedCause && cap.sourceId === scene.targetId);
  const cause = p.events.find(e => e.eventId === cap.sourceEventId);
  check(scene.id + ': fatal damage receipt precedes final outcome', !!cause && cause.seq < losses[0].seq && cause.payload.before > 0 && cause.payload.after === 0);
  if (scene.paused) { const parent = p.commands.filter(c => c.type === 'threat.attack' && !boot.live.commands.some(old => old.commandId === c.commandId));
    check(scene.id + ': one public F pays original gross5 without time refund', parent.length === 1 && p.energy === boot.live.energy - 5 && p.world.totalMinutes === boot.live.world.totalMinutes);
    check(scene.id + ': original parent receipt completes before loss', p.events.some(e => e.commandId === parent[0].commandId && e.type === 'command.rejected' && e.seq < losses[0].seq));
  } else check(scene.id + ': actual world timer caused elapsed damage', s.ownership.worldTickCounter > boot.ownership.worldTickCounter && p.world.totalMinutes > boot.live.world.totalMinutes);
  check(scene.id + ': future world battle rest and held input are stopped', !s.ownership.worldTimer && !s.ownership.battleTimer && !s.ownership.restOwnsClock && s.ownership.heldDirections === 0);
  check(scene.id + ': public DAY title and state do not claim a horde or all-camp loss', s.public.lossOverlay && /白天/.test(s.public.title || '') && /玩家/.test(s.public.title || '') &&
    !/营地失守|火种熄灭|已保存的尸潮报告|尸潮结算/.test([s.public.title,s.public.subtitle,s.public.copy,s.public.feed,s.public.battleStage].filter(Boolean).join(' ')) && s.public.waveProgress !== '100%');
}
try {
  server = createServer((q, r) => { const u = new URL(q.url, 'http://local').pathname, b = u === '/' || u === '/index.html' ? html : u === '/actor-sprites.js' ? sprites : null;
    r.writeHead(b ? 200 : 404, { 'Content-Type': u.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8' }); r.end(b || ''); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const pw = fs.statSync(a['--playwright-module']).isDirectory() ? createRequire(import.meta.url)(a['--playwright-module']) : await import(pathToFileURL(a['--playwright-module']).href);
  browser = await (pw.chromium || pw.default.chromium).launch({ headless: true, executablePath: a['--chrome-executable'], timeout: timeout(25000) }); report.browserVersion = browser.version();
  watchdog = setTimeout(async () => { report.errors.push({ type: 'wall-watchdog', message: 'budget expired; no pass inferred' }); await closeAll(); }, Math.max(1, deadline - Date.now()));
  for (const input of inputs) {
    const scene = { id: input.id, inputSha256: input.sha256, expectedCause: input.expectedCause, targetId: input.targetId, paused: input.paused, testIO: input.testIO, status: 'STARTED', artifacts: [] };
    report.scenes.push(scene); const end = Math.min(deadline, Date.now() + report.budget.sceneMs); let context, page;
    try {
      context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.add(context);
      await context.addInitScript(({ key, raw, id, testIO }) => {
        const marker = 'qa-day-fatal-preboot-v1'; if (!sessionStorage.getItem(marker)) { localStorage.setItem(key, raw); sessionStorage.setItem(marker, JSON.stringify({ id, seedCount: 1 })); }
        if (testIO) { const original = Storage.prototype.setItem; const io = window.__qaDayFatalIO = { mode: 'TEST-ONLY-first-DAY-capsule-primary-write-fails', blocked: 0, attempts: [] };
          Storage.prototype.setItem = function (k, value) { let fatal = false; try { const e = JSON.parse(String(value)); fatal = k === key && e.payload?.dayFatalOutcome != null; } catch {}
            if (this === localStorage && fatal) { io.attempts.push({ at: Date.now(), key: k, fatal: true }); if (io.blocked === 0) { io.blocked += 1; throw new DOMException('TEST-ONLY first DAY fatal primary write blocked', 'QuotaExceededError'); } }
            return original.call(this, k, value); };
        }
      }, { key, raw: input.raw, id: scene.id, testIO: input.testIO });
      page = await context.newPage(); page.setDefaultTimeout(timeout());
      page.on('pageerror', e => report.errors.push({ scene: scene.id, type: 'pageerror', message: e.message }));
      page.on('response', r => { if (r.request().resourceType() === 'document' && r.frame() === page.mainFrame()) responseTasks.push((async () => { const b = await r.body(); report.documents.push({ scene: scene.id, status: r.status(), sha256: sha(b), bytes: b.length }); report.documentHashes.push(sha(b)); })().catch(e => report.errors.push({ scene: scene.id, type: 'document', message: e.message }))); });
      await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded', timeout: timeout(15000) });
      check(scene.id + ': actual visible Continue enters full derived writer', await page.locator('#continueSaveBtn').isVisible() && await page.locator('#continueSaveBtn').isEnabled());
      await page.locator('#continueSaveBtn').click(); await page.waitForFunction(() => document.getElementById('startOverlay').classList.contains('hidden'), null, { timeout: timeout() });
      // Let the ordinary session-start checkpoint settle before the one action; no world pause injection.
      if (scene.paused) await page.waitForTimeout(800);
      const boot = await sample(page), safeBefore = await stores(page); json(scene.id + '-boot-watermark.json', boot); scene.artifacts.push(artifact(scene.id + '-boot-watermark.json'));
      check(scene.id + ': low HP is declared preboot fixture without gifts or enemy deletion', boot.live.hp === 4 && boot.live.npcIds.length === 10 && boot.live.enemyIds.length === 4 && boot.live.food === input.p.food && boot.live.clock.paused === scene.paused);
      for (const k of ['generativeDialogue','observerCommentary','generatedWorldEvents','learnedWorldModel']) assert.equal(boot.live.aiConfig[k], false);
      await capture(page, scene, 'before-fatal-desktop');
      if (scene.paused) { check(scene.id + ': actual context offers same real target before F', boot.public.attack.some(b => b.targetId === scene.targetId && !b.disabled));
        native(scene, 'safe-primary-before-F', safeBefore.primary); if (safeBefore.backup) native(scene, 'safe-backup-before-F', safeBefore.backup);
        await page.keyboard.press('f'); }
      const loss = await until(page, s => s.live?.hp === 0 && s.ownership.mode === 'LOSS', Math.min(end, Date.now() + report.budget.fatalWaitMs), 'actual timer/F did not reach DAY fatal within budget');
      checkLoss(scene, loss, boot); const capsule = clone(loss.live.dayFatalOutcome);
      if (scene.testIO) {
        const failed = await until(page, s => s.public.saveState === 'failed' && s.public.retryVisible, Math.min(end, Date.now() + 2500), 'explicit failed save/retry UI not visible');
        const unchanged = await stores(page);
        check(scene.id + ': testIO failure preserves old primary and backup exactly', failed.testIO?.blocked === 1 && unchanged.primary === safeBefore.primary && unchanged.backup === safeBefore.backup);
        check(scene.id + ': unsaved loss tells truth in visible UI', /未能保存/.test(failed.public.saveStatus || '') && failed.public.retryDisabled === false);
        await capture(page, scene, 'failed-save-desktop'); await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#dayFatalRetryBtn').scrollIntoViewIfNeeded(); await capture(page, scene, 'failed-save-390');
        await page.locator('#dayFatalRetryBtn').click();
      }
      const normal = await normalWriter(page, scene, end, capsule);
      const savedUi = await until(page, s => s.public.saveState === 'saved', Math.min(end, Date.now() + 1800), 'normal writer succeeded but saved UI absent');
      check(scene.id + ': normal real writer validates as same complete LOSS before reload', normal.storage.classification === 'LOSS_REPORT' && normal.envelope.payload.worldMeta.events.some(e => e.eventId === capsule.eventId));
      await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, scene, 'saved-loss-desktop'); await page.setViewportSize({ width: 390, height: 844 }); await capture(page, scene, 'saved-loss-390');
      const frozen = outcomeFacts(savedUi); await page.waitForTimeout(report.budget.frozenObservationMs); const later = await sample(page);
      check(scene.id + ': no future timer simulation reward or duplicate outcome after fatal', JSON.stringify(outcomeFacts(later)) === JSON.stringify(frozen) && !later.ownership.worldTimer && !later.ownership.battleTimer);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: timeout(15000) }); const selected = await stores(page); native(scene, 'actual-reload-selected-primary', selected.primary);
      await page.locator('#continueSaveBtn').click(); await page.waitForFunction(() => document.getElementById('startOverlay').classList.contains('hidden'), null, { timeout: timeout() });
      const restored = await sample(page); check(scene.id + ': Continue restores same source capsule and frozen DAY outcome', restored.ownership.mode === 'LOSS' && !restored.ownership.worldTimer && !restored.ownership.battleTimer && JSON.stringify(restored.live.dayFatalOutcome) === JSON.stringify(capsule) && restored.live.night === false && restored.live.hp === 0);
      await capture(page, scene, 'restored-loss-390'); const restoreFacts = outcomeFacts(restored); await page.waitForTimeout(report.budget.frozenObservationMs);
      check(scene.id + ': restored LOSS does not tick or reward again', JSON.stringify(outcomeFacts(await sample(page))) === JSON.stringify(restoreFacts));
      const marker = await page.evaluate(() => JSON.parse(sessionStorage.getItem('qa-day-fatal-preboot-v1'))); check(scene.id + ': full fixture seeded once through reload', marker.id === scene.id && marker.seedCount === 1);
      const navigation = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: timeout(12000) });
      await page.locator('#continueBtn').click(); await navigation;
      const cleared = await stores(page); check(scene.id + ': public restart clears old primary backup and returns new-game entry', cleared.primary === null && cleared.backup === null && await page.locator('#startOverlay').isVisible() && await page.locator('#continueSaveBtn').isEnabled());
      await page.locator('#continueSaveBtn').click(); await page.waitForFunction(() => document.getElementById('startOverlay').classList.contains('hidden'), null, { timeout: timeout() });
      const fresh = await sample(page); check(scene.id + ': new public boot is alive without inherited DAY outcome', fresh.live.hp > 0 && fresh.live.gameOver === null && fresh.live.dayFatalOutcome === null && fresh.ownership.mode === 'DAY' && fresh.ownership.worldTimer);
      const freshStart = fresh.live.world.totalMinutes; const freshTick = await until(page, s => s.live?.world.totalMinutes > freshStart, Math.min(end, Date.now() + 3000), 'new public boot did not produce real new tick');
      check(scene.id + ': restarted session has a true new timer tick', freshTick.live.hp > 0 && freshTick.live.dayFatalOutcome === null); await capture(page, scene, 'restarted-public-390');
      scene.status = 'VERIFIED';
    } catch (e) { scene.status = 'FAILED'; report.errors.push({ scene: scene.id, type: e.name, message: e.message });
      if (page && !page.isClosed()) try { const s = await stores(page); if (s.primary) native(scene, 'failure-primary', s.primary); await capture(page, scene, 'failure'); } catch (captureError) { report.errors.push({ scene: scene.id, type: 'failure-capture', message: captureError.message }); }
      process.exitCode = 1;
    } finally { if (context) try { await context.close(); contexts.delete(context); } catch {} }
  }
  await Promise.all(responseTasks);
  for (const d of report.documents) check('actual main body equals frozen DAY fatal candidate', d.status === 200 && d.sha256 === sourceSha && d.bytes === html.length);
  check('three scenes each have real first load reload and public restart main responses', report.documents.length >= 9);
} catch (e) { report.errors.push({ type: e.name, message: e.message }); process.exitCode = 1; }
finally {
  clearTimeout(watchdog); await closeAll(); await Promise.allSettled(responseTasks);
  report.count = report.checks.length; report.passed = report.checks.filter(c => c.ok).length; report.elapsedMs = Date.now() - began;
  report.ok = report.scenes.length === inputs.length && report.scenes.every(s => s.status === 'VERIFIED') && report.errors.length === 0 && report.passed === report.count && Object.values(report.cleanup).every(Boolean);
  report.status = report.ok ? 'VERIFIED' : 'FAILED'; if (!report.ok) process.exitCode = 1; json('report.json', report); console.log(JSON.stringify(report));
}
