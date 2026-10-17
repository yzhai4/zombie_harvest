import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// TEST-ONLY complete source-native preboot inputs. After boot this uses actual
// visible controls and read-only evidence. It does not set state, call hidden
// game actions, change time rates, remove enemies, give food or force clicks.
const flags = ['--run-approved', '--repo-root', '--html', '--expect-html-sha256', '--core-module', '--expect-core-module-sha256', '--input-manifest', '--expect-input-manifest-sha256', '--out', '--budget-seconds', '--execution'];
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  assert.ok(flags.includes(process.argv[i]) && process.argv[i + 1], 'known flag/value pairs required');
  assert.ok(!Object.hasOwn(options, process.argv[i]), 'duplicate flag');
  options[process.argv[i]] = process.argv[i + 1];
}
assert.equal(options['--run-approved'], 'yes', 'requires final candidate and source-native input release');
for (const f of ['--html', '--core-module', '--input-manifest', '--out']) assert.ok(path.isAbsolute(options[f] || ''), f);
for (const f of ['--expect-html-sha256', '--expect-core-module-sha256', '--expect-input-manifest-sha256']) assert.match(options[f] || '', /^[a-f0-9]{64}$/);
const root = options['--repo-root'] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); assert.ok(path.isAbsolute(root));
const out = options['--out']; assert.equal(existsSync(out), false, 'new output required; original failed rounds are retained'); mkdirSync(out, { recursive: true });
const read = f => readFileSync(f), sha = b => createHash('sha256').update(b).digest('hex');
const write = (f, b) => { const p = path.join(out, f); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, b); };
const source = read(options['--html']), core = read(options['--core-module']), runner = read(fileURLToPath(import.meta.url));
const sourceHash = sha(source), startedAt = Date.now(), budgetSeconds = Number(options['--budget-seconds'] || 240);
assert.ok(Number.isInteger(budgetSeconds) && budgetSeconds >= 90 && budgetSeconds <= 360);
const deadline = startedAt + budgetSeconds * 1000;
const remaining = (cap = 15000) => { const n = deadline - Date.now(); assert.ok(n > 0, 'overall browser budget exhausted'); return Math.max(1, Math.min(n, cap)); };
const same = (a, b) => { try { assert.deepStrictEqual(a, b); return true; } catch { return false; } };
const payload = raw => { const v = JSON.parse(raw); return v.payload || v; };
const minute = p => (p.day - 1) * 1440 + p.hour * 60 + p.minute;
const actor = (p, id) => p.npcs.find(n => n.id === id);
const specs = [{ id: 'low-start', purpose: 'start, cross24, same-identity reload and bounded full recovery attempt' }, { id: 'near-complete', purpose: 'completion and independent original public support takeover' }];
const allExecutions = [{ id: 'low-continuity', input: 'low-start', branch: 'continuity' }, { id: 'near-completion', input: 'near-complete', branch: 'completion' }, { id: 'active-support', input: 'near-complete', branch: 'support' }];
assert.ok(!options['--execution'] || options['--execution'] === 'all' || allExecutions.some(e => e.id === options['--execution']));
const executions = allExecutions.filter(e => !options['--execution'] || options['--execution'] === 'all' || e.id === options['--execution']);
const report = {
  schema: 'NpcRestWorkBrowserV1', runner: 'browser-npc-rest-work-v1', runnerSha256: sha(runner), sourceHtmlSha256: sourceHash, coreModuleSha256: sha(core),
  mode: 'TEST-ONLY complete source-native preboot fixtures and actual public Chrome controls', policyVersion: 'carpenter-rest-work-v1',
  naturalGameplay: false, naturalGameplayClaim: false, injectionBeforeLoader: true, gameStateMutationAfterBoot: false, hiddenGameActionsAfterBoot: false, forceClicks: false,
  purposeCount: new Set(executions.map(e => e.input)).size, declaredActualContextCount: executions.length, selectedExecution: options['--execution'] || 'all', budgetSeconds,
  parameters: { source: 'artifact:source.html', core: 'artifact:core-policy-dependency.mjs', inputs: 'artifact:source-native-inputs/manifest.json', output: 'artifact:./', repoRoot: options['--repo-root'] ? 'explicit dependency root' : 'installed repository relative' },
  scope: { singleRole: 'unique healthy local effective carpenter', hysteresis: '24 entry / 36 release', physicalReturnToWork: false, fullEconomy: false, fullNpcPlanning: false, hiddenVisibility: 'not tested', longRouteCompletion: 'reported from actual route only',
    liveSnapshotEvidence: 'root-authorized read-only WorldSnapshot.capture for verification; never an actor planning input',
    completionMeaning: 'release of recovery ownership to the original current routine; does not prove workplace arrival',
    nearCompletionInput: 'controlled complete-native positioning, not a naturally earned long recovery claim', relatedOldSuites: 'not executed by this runner' },
  checks: [], errors: [], scenes: [], nativeValidations: [], allMainDocuments: [], documentHashes: []
};
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); };
let browser, server, factory, saveKey; const contexts = [], pendingHTTP = [];
try {
  check('HTML and pure policy dependency exact expected bytes', sourceHash === options['--expect-html-sha256'] && sha(core) === options['--expect-core-module-sha256']);
  if (process.platform === 'win32') {
    const sid = execFileSync('whoami', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true }).match(/S-1-[0-9-]+/)?.[0]; assert.ok(sid);
    execFileSync('icacls', [out, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true });
    const command = `$a=[System.IO.Directory]::GetAccessControl('${out.replaceAll("'", "''")}'); [pscustomobject]@{protected=$a.AreAccessRulesProtected;rules=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]) | ForEach-Object {[pscustomobject]@{sid=$_.IdentityReference.Value;rights=[string]$_.FileSystemRights;type=[string]$_.AccessControlType;inherited=$_.IsInherited}})} | ConvertTo-Json -Compress -Depth 5`;
    const acl = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', windowsHide: true }));
    check('private Windows ACL actually verified', acl.protected && acl.rules.length > 0 && acl.rules.every(r => r.sid === sid && r.type === 'Allow' && r.rights.includes('FullControl') && !r.inherited));
    report.privateOutput = { aclVerified: true, inheritanceDisabled: true, allowedPrincipal: 'current-user-only' };
  }
  write('source.html', source); write('runner-executed.mjs', runner); write('core-policy-dependency.mjs', core);
  report.dependencies = ['scripts/lib/source-runtime-fixture.mjs', 'scripts/check-report-recovery.mjs', 'dist/actor-sprites.js'].map(file => { const b = read(path.join(root, file)); write(`frozen/${file}`, b); return { file, bytes: b.length, sha256: sha(b) }; });
  const fixture = await import(pathToFileURL(path.join(out, 'frozen/scripts/lib/source-runtime-fixture.mjs')).href);
  factory = fixture.sourceRuntimeFactory(path.join(out, 'source.html')); saveKey = fixture.saveKey;
  const manifestBytes = read(options['--input-manifest']); check('source input manifest exact expected bytes', sha(manifestBytes) === options['--expect-input-manifest-sha256']);
  write('source-native-inputs/manifest.json', manifestBytes); report.inputManifestSha256 = sha(manifestBytes);
  const manifest = JSON.parse(manifestBytes), inputRoot = path.dirname(options['--input-manifest']);
  check('source manifest exact candidate and explicit controlled provenance', manifest.schema === 'NpcRestWorkBrowserSourceInputManifestV1' && manifest.sourceHtmlSha256 === sourceHash && manifest.method?.startsWith('TEST-ONLY') && manifest.naturalGameplay === false);
  check('two declared purpose inputs, not three disguised fixtures', manifest.scenes?.length === specs.length && new Set(manifest.scenes.map(s => s.id)).size === specs.length && specs.every(s => manifest.scenes.some(m => m.id === s.id)));
  const inputPath = file => { assert.ok(typeof file === 'string' && !path.isAbsolute(file)); const p = path.resolve(inputRoot, file); assert.ok(p.startsWith(path.resolve(inputRoot) + path.sep), 'input stays inside capture root'); return p; };
  const originalBytes = read(inputPath(manifest.originalWriter.file)); check('complete original writer retained at producer SHA', sha(originalBytes) === manifest.originalWriter.sha256); write('source-native-inputs/original-writer.json', originalBytes);
  const original = payload(originalBytes.toString('utf8'));
  const validate = (raw, label) => { const r = factory([[saveKey, raw]]), v = r.api.validate({ raw, sourceCategory: 'primary' }); report.nativeValidations.push({ label, sha256: sha(raw), ok: v.ok, reason: v.reason || null }); check(`${label}: actual frozen source native validator`, v.ok); return payload(raw); };
  const inputs = Object.fromEntries(manifest.scenes.map(m => {
    const bytes = read(inputPath(m.file)); check(`${m.id}: exact complete source-native input`, sha(bytes) === m.sha256); write(`source-native-inputs/${m.file}`, bytes);
    const raw = bytes.toString('utf8'), p = validate(raw, `${m.id}-input`), n = actor(p, m.npcId);
    check(`${m.id}: original fixed roster and live unique actor retained`, same(p.npcs.map(n => n.id), original.npcs.map(n => n.id)) && p.npcs.filter(n => n.id === m.npcId).length === 1 && n.hp === n.maxHp && n.lifeState === 'healthy' && (n.actingRole || n.id) === 'carpenter');
    check(`${m.id}: actual original enemy identities/types retained`, same(p.worldZombies.map(e => ({ id: e.id, kind: e.kind, maxHp: e.maxHp })), original.worldZombies.map(e => ({ id: e.id, kind: e.kind, maxHp: e.maxHp }))));
    check(`${m.id}: complete controls and offline deltas explicit`, p.worldMeta.clock.paused === false && p.worldMeta.clock.rate === 1 && m.controls?.clockPaused === false && m.controls?.clockRate === 1 && Array.isArray(m.changes) && m.changes.length > 0);
    check(`${m.id}: original authored home and work zone unchanged`, n.homeZone === actor(original, m.npcId).homeZone && n.workZone === actor(original, m.npcId).workZone);
    check(`${m.id}: producer declares authored home and does not replenish shared food`, Number.isFinite(m.expected?.home?.x) && Number.isFinite(m.expected?.home?.y) && m.expected.home.zone === n.homeZone && p.food <= original.food);
    if (m.id === 'low-start') check(`${m.id}: low-energy entry, not already active`, n.needs.energy < 24 && n.routineIntent === null);
    else check(`${m.id}: already active between 24 and 36, exact six fields`, n.needs.energy >= 24 && n.needs.energy < 36 && n.routineIntent?.policyVersion === 'carpenter-rest-work-v1' && n.routineIntent.actorId === n.id && Object.keys(n.routineIntent).length === 6);
    return [m.id, { meta: m, raw, payload: p }];
  }));
  const sprites = read(path.join(out, 'frozen/dist/actor-sprites.js'));
  server = createServer((req, res) => { const p = new URL(req.url, 'http://localhost').pathname; if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(source); } else if (p === '/actor-sprites.js') { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); res.end(sprites); } else { res.writeHead(404); res.end(); } });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const require = createRequire(import.meta.url), { chromium } = require(process.env.ZH_PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, channel: process.env.ZH_BROWSER_CHANNEL || 'chrome', timeout: remaining(30000) }); report.browserVersion = browser.version();
  for (const execution of executions) {
    const input = inputs[execution.input], meta = input.meta, id = meta.npcId, home = meta.expected.home;
    const result = { id: execution.id, inputId: execution.input, branch: execution.branch, inputSha256: sha(input.raw), npcId: id, declaredChanges: meta.changes, verified: false, snapshots: [], observations: [], route: [], capturedEvents: [], coverage: {} }; report.scenes.push(result);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(context);
    await context.addInitScript(({ key, raw }) => { if (!sessionStorage.getItem('qa-npc-rest-work-seeded')) { localStorage.clear(); localStorage.setItem(key, raw); sessionStorage.setItem('qa-npc-rest-work-seeded', 'yes'); } }, { key: saveKey, raw: input.raw });
    const page = await context.newPage(); page.setDefaultTimeout(remaining()); page.on('pageerror', e => report.errors.push({ scene: execution.id, type: 'pageerror', message: e.message }));
    let sequence = 0, lastSeq = input.payload.worldMeta.eventSeq;
    page.on('response', response => { if (response.request().resourceType() === 'document' && response.frame() === page.mainFrame()) pendingHTTP.push((async () => { const b = await response.body(), h = sha(b); report.allMainDocuments.push({ scene: execution.id, sequence: ++sequence, status: response.status(), sha256: h, url: response.url() }); if (h !== sourceHash || !response.ok()) { write(`${execution.id}-unexpected-main-${sequence}.html`, b); report.errors.push({ scene: execution.id, type: 'main-document', status: response.status(), sha256: h }); } })().catch(e => report.errors.push({ scene: execution.id, type: 'main-body', message: e.message }))); });
    async function doc(response, label) { assert.ok(response); const h = sha(await response.body()); report.documentHashes.push({ scene: execution.id, label, sha256: h }); check(`${execution.id}: ${label} actual HTTP exact HTML`, response.ok() && h === sourceHash); }
    async function snapshot(label) { const s = await page.evaluate(() => WorldSnapshot.capture()); write(`${execution.id}-${label}-readonly-snapshot.json`, JSON.stringify(s, null, 2) + '\n'); result.snapshots.push({ kind: 'readonly-world', label, file: `${execution.id}-${label}-readonly-snapshot.json` }); return s; }
    async function native(label) { const raw = await page.evaluate(k => localStorage.getItem(k), saveKey); assert.ok(raw); const file = `${execution.id}-${label}-save.json`; write(file, raw); result.snapshots.push({ kind: 'native-writer', label, file, sha256: sha(raw) }); return validate(raw, `${execution.id}-${label}`); }
    async function nativeEvent(eventId, label) { await page.waitForFunction(({ key, eventId }) => { const e = JSON.parse(localStorage.getItem(key)); return (e.payload || e).worldMeta.events.some(e => e.eventId === eventId); }, { key: saveKey, eventId }, { timeout: remaining(8000) }); return native(label); }
    async function sample() {
      const s = await page.evaluate(({ id, after }) => { const s = WorldSnapshot.capture(); return { minute: (s.day - 1) * 1440 + s.hour * 60 + s.minute, actor: s.npcs.find(n => n.id === id), eventSeq: s.worldMeta.eventSeq, events: s.worldMeta.events.filter(e => e.seq > after), phase: document.body.classList.contains('threat-map-active'), waitText: document.getElementById('campRestStatus')?.innerText, waitActive: document.getElementById('campRestCancel')?.hidden === false }; }, { id, after: lastSeq });
      if (s.events.length && s.events[0].seq !== lastSeq + 1) result.eventCaptureGap = { expected: lastSeq + 1, first: s.events[0].seq };
      result.capturedEvents.push(...s.events); lastSeq = Math.max(lastSeq, s.eventSeq); return s;
    }
    async function until(predicate, capMs = 18000) { const end = Date.now() + Math.min(remaining(capMs), capMs); let s; do { s = await sample(); if (predicate(s)) return s; await page.waitForTimeout(Math.min(150, remaining())); } while (Date.now() < end); assert.fail('declared live condition not reached within bounded browser observation'); }
    async function continuePublic() { const b = page.locator('#continueSaveBtn'); check(`${execution.id}: real public continue available`, await b.isVisible() && await b.isEnabled()); await b.click({ timeout: remaining() }); await page.waitForFunction(() => document.getElementById('startOverlay').classList.contains('hidden') && document.getElementById('world').getClientRects().length > 0, {}, { timeout: remaining() }); }
    async function cancelWait() { const b = page.locator('#campRestCancel'); if (await b.isVisible()) { check(`${execution.id}: public cancel enabled`, await b.isEnabled()); await b.click({ timeout: remaining() }); } }
    async function shelterPublic() {
      let state = await snapshot('before-public-shelter-entry'); const shelter = state.buildings.find(b => b.type === 'shelter'); assert.ok(shelter?.id);
      const before = { ...state.player }; let moves = 0;
      while (Math.hypot(state.player.x - shelter.x, state.player.y - shelter.y) > 1.2 && moves < 8) {
        const dx = shelter.x - state.player.x, dy = shelter.y - state.player.y;
        const key = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'ArrowLeft' : 'ArrowRight') : (dy < 0 ? 'ArrowUp' : 'ArrowDown');
        await page.keyboard.press(key); moves += 1; state = await page.evaluate(() => WorldSnapshot.capture());
      }
      check(`${execution.id}: public navigation reaches original shelter interaction range`, Math.hypot(state.player.x - shelter.x, state.player.y - shelter.y) <= 1.25, { before, after: state.player, moves, shelterId: shelter.id });
      const tile = page.locator(`#world .tile[data-x="${shelter.x}"][data-y="${shelter.y}"]`); check(`${execution.id}: original visible shelter tile is public`, await tile.isVisible() && !(await tile.getAttribute('class')).includes('fogged')); if (moves) await tile.click({ timeout: remaining() });
      result.route.push({ action: moves ? 'bounded public arrow navigation and shelter selection' : 'already within actual original shelter public range', moves, before, after: state.player, shelterId: shelter.id });
    }
    async function startWait(duration) { const b = page.locator(`[data-context-action="campRest${duration}"]`); check(`${execution.id}: public wait${duration} visible and enabled`, await b.isVisible() && await b.isEnabled()); const before = await sample(); await b.click({ timeout: remaining() }); const after = await until(s => s.waitActive || s.events.some(e => e.type === 'camp.rest.stopped')); result.route.push({ action: `public campRest${duration}`, startMinute: before.minute, startedAtMinute: after.minute }); return after; }
    async function explanation(label, mobile = false) {
      await page.keyboard.press('v'); const row = page.locator(`#survivorList [data-npc="${id}"] .npc-routine-report[data-npc-routine="${id}"]`); await row.waitFor({ state: 'visible', timeout: remaining() }); await row.scrollIntoViewIfNeeded({ timeout: remaining() });
      const inspect = () => row.evaluate(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return { text: e.innerText, actorId: e.dataset.npcRoutine, rect: { x: r.x, y: r.y, width: r.width, height: r.height }, viewport: { width: innerWidth, height: innerHeight }, fontSize: Number.parseFloat(c.fontSize), visibleStyle: c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > .9, withinViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, overflow: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 }; });
      let data = await inspect(); result.observations.push({ label, ...data }); check(`${execution.id}: ${label} actual current arrangement readable at authored12px`, data.actorId === id && data.fontSize >= 12 && data.visibleStyle && data.withinViewport && !data.overflow && data.text.includes('精力不足') && data.text.includes('36') && data.text.includes('支援接管') && /尚未到达|已在.+区域休整/.test(data.text), data);
      await page.screenshot({ path: path.join(out, `${execution.id}-${label}-desktop.png`), timeout: remaining() });
      if (mobile) { await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(250); await row.scrollIntoViewIfNeeded({ timeout: remaining() }); data = await inspect(); result.observations.push({ label: label + '-mobile390', ...data }); check(`${execution.id}: ${label} real390 layout readable at authored12px`, data.viewport.width === 390 && data.fontSize >= 12 && data.visibleStyle && data.withinViewport && !data.overflow, data); await page.screenshot({ path: path.join(out, `${execution.id}-${label}-mobile390.png`), timeout: remaining() }); await page.setViewportSize({ width: 1440, height: 1000 }); await page.waitForTimeout(250); }
      await page.locator('#infoModalClose').click({ timeout: remaining() }); return data;
    }
    async function nearbyExplanation(label) {
      const view = page.locator(`[data-context-action="npcView"][data-npc-id="${id}"]`); check(`${execution.id}: original nearby view visible and enabled`, await view.isVisible() && await view.isEnabled()); await view.click({ timeout: remaining() });
      const row = page.locator(`#contextActions p.npc-routine-report[data-npc-routine="${id}"]`); await row.waitFor({ state: 'visible', timeout: remaining() }); await row.scrollIntoViewIfNeeded({ timeout: remaining() });
      const text = await row.innerText(), t = await page.locator('#toast').innerText(); check(`${execution.id}: actual nearby view and toast explain current recovery`, text.includes('精力不足') && text.includes('36') && text.includes('支援接管') && t.includes('当前安排') && /尚未到达|已在.+区域休整/.test(text));
      const geometry = await row.evaluate(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); let ancestorClipped = false; for (let a = e.parentElement; a; a = a.parentElement) { const ar = a.getBoundingClientRect(), ac = getComputedStyle(a); if ((['hidden', 'clip', 'scroll', 'auto'].includes(ac.overflowX) && (r.left < ar.left - 1 || r.right > ar.right + 1)) || (['hidden', 'clip', 'scroll', 'auto'].includes(ac.overflowY) && (r.top < ar.top - 1 || r.bottom > ar.bottom + 1))) ancestorClipped = true; } return { fontSize: Number.parseFloat(c.fontSize), withinViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, ancestorClipped, overflow: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 }; });
      check(`${execution.id}: actual nearby report is unclipped at authored12px`, geometry.fontSize >= 12 && geometry.withinViewport && !geometry.ancestorClipped && !geometry.overflow, geometry);
      result.observations.push({ label, text, ordinaryViewToast: t, geometry }); await page.screenshot({ path: path.join(out, `${execution.id}-${label}-context.png`), timeout: remaining() });
    }
    async function checkNoRecoveryWork(intentId, label) { const work = result.capturedEvents.filter(e => e.type === 'npc.work.completed' && e.payload?.npcId === id); const finish = result.capturedEvents.find(e => ['npc.routine.finished', 'npc.routine.cancelled'].includes(e.type) && e.payload?.intentId === intentId); const start = result.capturedEvents.find(e => e.type === 'npc.routine.started' && e.payload?.intentId === intentId); const from = start?.seq ?? input.payload.worldMeta.eventSeq; check(`${execution.id}: ${label} no ordinary completed while recovery owns interval or its release advance`, work.every(e => e.seq <= from || (finish && e.seq > finish.seq && e.causationId !== finish.causationId)), { work, terminal: finish || null }); }
    await doc(await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded', timeout: remaining() }), 'boot'); await continuePublic();
    if (execution.branch === 'continuity') {
      await shelterPublic();
      await startWait(30); const started = await until(s => !!s.actor.routineIntent); const intent = started.actor.routineIntent;
      check(`${execution.id}: actual recovery starts with structural identity and real rest behavior`, intent.actorId === id && intent.roleId === 'carpenter' && started.actor.behaviorState === 'rest' && started.actor.workClock === 0);
      const atHome = Math.hypot(started.actor.x - home.x, started.actor.y - home.y) <= .08;
      check(`${execution.id}: actual recovery motion owns the authored home attempt`, atHome || same(started.actor.motionTarget, { x: home.x, y: home.y }), { actorPosition: { x: started.actor.x, y: started.actor.y }, motionTarget: started.actor.motionTarget, home, atHome });
      result.homeAttempt = { inputPosition: { x: actor(input.payload, id).x, y: actor(input.payload, id).y }, actualPosition: { x: started.actor.x, y: started.actor.y }, displacement: Math.hypot(started.actor.x - actor(input.payload, id).x, started.actor.y - actor(input.payload, id).y), target: started.actor.motionTarget, home, arrivalClaim: atHome };
      await snapshot('started'); await nearbyExplanation('started-arrangement'); await explanation('started-arrangement', true); result.coverage.started = true;
      let crossed;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        crossed = await until(s => s.actor.needs.energy >= 24 || !s.actor.routineIntent || !s.waitActive);
        if (crossed.actor.needs.energy >= 24 || !crossed.actor.routineIntent) break;
        const stop = result.capturedEvents.filter(e => e.type === 'camp.rest.stopped').at(-1);
        result.route.push({ action: 'observe actual pre24 wait interruption', minute: crossed.minute, waitText: crossed.waitText, stop: stop || null });
        await page.screenshot({ path: path.join(out, `${execution.id}-pre24-interruption-${attempt + 1}.png`), timeout: remaining() });
        // A newly queued authored matter has now been disclosed by the original
        // wait UI. Explicitly choosing another enabled public wait does not
        // resolve/delete it or change the controller's danger policy.
        if (stop?.payload.reason !== 'new-matter' || attempt === 2) break;
        check(`${execution.id}: actual new-matter interruption disclosed before deliberate public restart`, crossed.waitText.includes('等候停止') && crossed.waitText.includes('出现新事项') && await page.locator('#campRestStatus').isVisible());
        await startWait(30);
      }
      check(`${execution.id}: crossing24 retains original intent and recovery behavior`, crossed.actor.needs.energy >= 24 && crossed.actor.needs.energy < 36 && crossed.actor.routineIntent?.intentId === intent.intentId && crossed.actor.behaviorState === 'rest' && crossed.actor.workClock === 0, crossed.actor);
      await cancelWait(); const beforeReload = await native('cross24-before-real-reload'); await snapshot('cross24'); result.coverage.cross24 = true;
      await doc(await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining() }), 'real-mid-recovery-reload'); const afterPagehide = await native('actual-pagehide-reload-input');
      check(`${execution.id}: actual pagehide writer preserves same six-field intent`, same(actor(beforeReload, id).routineIntent, actor(afterPagehide, id).routineIntent));
      const overlay = await snapshot('start-overlay-after-reload'); check(`${execution.id}: loader overlay does not heal offline or start a second plan`, actor(overlay, id).routineIntent?.intentId === intent.intentId && actor(overlay, id).needs.energy === actor(afterPagehide, id).needs.energy);
      await continuePublic(); const resumed = await sample(); check(`${execution.id}: public continue retains same startedAt and ID beyond24`, resumed.actor.routineIntent?.intentId === intent.intentId && resumed.actor.routineIntent.startedAt === intent.startedAt && resumed.actor.needs.energy >= 24);
      await explanation('reloaded-arrangement'); result.coverage.sameIdentityReload = true;
      let end = await sample(), routeStatus = 'bounded-attempt-ended';
      for (let attempt = 0; attempt < 6 && end.actor.routineIntent; attempt += 1) {
        const b = page.locator('[data-context-action="campRest60"]'); if (!(await b.isVisible()) || !(await b.isEnabled())) { routeStatus = 'public-wait-unavailable'; break; }
        await startWait(60); const at = end.minute; end = await until(s => !s.actor.routineIntent || !s.waitActive, 24000); result.route.push({ action: 'observe real wait terminal or recovery release', beforeMinute: at, afterMinute: end.minute, waitText: end.waitText, activeIntent: end.actor.routineIntent?.intentId || null });
        if (!end.actor.routineIntent) { routeStatus = result.capturedEvents.some(e => e.type === 'npc.routine.finished' && e.payload?.intentId === intent.intentId) ? 'recovery-finished' : 'recovery-cancelled'; break; }
        if (!end.waitText.includes('等候完成')) { routeStatus = 'world-wait-interrupted'; break; }
      }
      await cancelWait(); await sample(); await checkNoRecoveryWork(intent.intentId, 'full observed prefix');
      check(`${execution.id}: no duplicate start after real reload`, result.capturedEvents.filter(e => e.type === 'npc.routine.started' && e.payload?.intentId === intent.intentId).length === 1);
      result.longRoute = { status: routeStatus, actualElapsedMinutes: end.minute - minute(input.payload), fullRecoveryCompleted: routeStatus === 'recovery-finished', fixed278MinuteClaim: false, terminalMinute: end.minute, terminalActor: end.actor, interruptionText: end.waitText };
      await native('long-route-terminal'); await snapshot('long-route-terminal'); await page.screenshot({ path: path.join(out, `${execution.id}-long-route-terminal.png`), timeout: remaining() }); result.coverage.truthfulLongAttempt = true;
    } else if (execution.branch === 'completion') {
      const before = await sample(), intent = before.actor.routineIntent; check(`${execution.id}: near-completion remains active after actual loader`, !!intent && before.actor.needs.energy < 36);
      await shelterPublic();
      await startWait(30); const finished = await until(s => !s.actor.routineIntent || !s.waitActive); await cancelWait(); await sample();
      const event = result.capturedEvents.find(e => e.type === 'npc.routine.finished' && e.payload?.intentId === intent.intentId);
      check(`${execution.id}: actual public time reaches36 and releases same recovery identity once`, !finished.actor.routineIntent && finished.actor.needs.energy >= 36 && event?.actorId === id && event.payload.reason === 'energy-recovered' && result.capturedEvents.filter(e => e.type === 'npc.routine.finished' && e.payload?.intentId === intent.intentId).length === 1);
      check(`${execution.id}: completion has no catch-up work credit or positive arrival claim`, finished.actor.workClock === 0 && !/(?:^|。|；)\s*(?:已到工位|到岗完成|已回东门)/.test(finished.actor.lastReport || ''));
      await checkNoRecoveryWork(intent.intentId, 'completion'); const final = await snapshot('recovery-released'); await native('recovery-released');
      const card = page.locator(`#survivorList [data-npc="${id}"]`); await page.keyboard.press('v'); await card.scrollIntoViewIfNeeded({ timeout: remaining() }); const text = await card.innerText(); result.observations.push({ label: 'after-release-original-public-roster', text }); check(`${execution.id}: active recovery explanation disappears after true release`, await card.locator('.npc-routine-report').count() === 0 && !text.includes('当前安排：精力不足'));
      await page.screenshot({ path: path.join(out, `${execution.id}-released-original-routine.png`), timeout: remaining() }); await page.locator('#infoModalClose').click({ timeout: remaining() });
      const next = await until(s => s.minute > minute(final)); check(`${execution.id}: later true minute reopens ordinary credit without resurrecting prior intent`, !next.actor.routineIntent && next.actor.workClock > 0 && next.actor.workClock < 60);
      result.completion = { inputIntent: intent, actualReleaseMinute: finished.minute, laterMinute: next.minute, event, physicalArrivalClaim: false }; await native('later-original-routine'); result.coverage.releaseAndLaterRoutine = true;
    } else {
      const before = await sample(), intent = before.actor.routineIntent; check(`${execution.id}: independent support branch starts from same active native intent`, !!intent && intent.intentId === actor(input.payload, id).routineIntent.intentId);
      const b = page.locator(`[data-context-action="npc"][data-npc-id="${id}"]`); check(`${execution.id}: original first-talk support control visible and enabled`, await b.isVisible() && await b.isEnabled()); await b.click({ timeout: remaining() });
      const afterFirst = await sample(); check(`${execution.id}: original free first talk retains active recovery`, afterFirst.actor.routineIntent?.intentId === intent.intentId && !afterFirst.actor.supportRequested);
      check(`${execution.id}: original confirmation visibly requests support`, (await b.innerText()).includes('确认请求') && await b.isEnabled()); await b.click({ timeout: remaining() });
      const after = await until(s => s.events.some(e => e.type === 'npc.interacted' || e.type === 'npc.actionInterrupted' || (e.type === 'command.rejected' && e.payload?.reason === 'npc-action-interrupted')));
      const receipt = result.capturedEvents.find(e => e.type === 'npc.interacted' && e.payload?.npcId === id);
      const cancelled = result.capturedEvents.find(e => e.type === 'npc.routine.cancelled' && e.payload?.intentId === intent.intentId);
      check(`${execution.id}: actual successful support owns actor and cancels recovery exactly once`, after.actor.supportRequested && !after.actor.routineIntent && receipt?.payload?.operation === 'support-requested' && cancelled?.payload.reason === 'support-requested' && result.capturedEvents.filter(e => e.type === 'npc.routine.cancelled' && e.payload?.intentId === intent.intentId).length === 1, { receipt, cancelled });
      const proof = receipt.payload; check(`${execution.id}: original support gross payment15 minutes and actual child causation preserved`, proof.payment?.cost?.energy === 2 && proof.payment.before.energy - proof.payment.after.energy === 2 && proof.clock?.requestedMinutes === 15 && proof.clock.elapsedMinutes === 15 && proof.advance?.minutes === 15 && proof.advance.causationId === receipt.commandId);
      check(`${execution.id}: cancellation is attributed to real support parent`, cancelled.actorId === id && cancelled.causationId === receipt.commandId);
      result.support = { receipt, cancelled, actualMinutes: proof.clock.elapsedMinutes, grossEnergyCost: proof.payment.cost.energy };
      await nativeEvent(receipt.eventId, 'actual-support-checkpoint-before-pagehide'); await snapshot('actual-support'); await page.screenshot({ path: path.join(out, `${execution.id}-actual-support.png`), timeout: remaining() }); result.coverage.originalSupportTakeover = true;
    }
    await sample(); check(`${execution.id}: event sampling has no retained-ledger gap`, !result.eventCaptureGap, result.eventCaptureGap);
    write(`${execution.id}-actual-observed-events.json`, JSON.stringify(result.capturedEvents, null, 2) + '\n');
    await Promise.all(pendingHTTP); const docs = report.allMainDocuments.filter(d => d.scene === execution.id); check(`${execution.id}: all actual main responses use exact frozen candidate`, docs.length >= (execution.branch === 'continuity' ? 2 : 1) && docs.every(d => d.sha256 === sourceHash && d.status === 200));
    result.verified = true; await context.close();
  }
} catch (error) {
  console.error(error.stack || String(error)); report.errors.push({ type: 'runner', message: error.message || String(error) });
  for (let i = 0; i < contexts.length; i += 1) for (const p of contexts[i].pages()) if (!p.isClosed()) try { await p.screenshot({ path: path.join(out, `failure-${i}.png`), timeout: 5000 }); } catch (e) { report.errors.push({ type: 'failure-screenshot', message: e.message }); }
} finally {
  await Promise.all(pendingHTTP); let contextsClosed = true;
  for (const c of contexts) await c.close().catch(e => { contextsClosed = false; report.errors.push({ type: 'context-close', message: e.message }); });
  if (browser) await browser.close().catch(e => report.errors.push({ type: 'browser-close', message: e.message }));
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  report.cleanup = { contextsClosed, browserClosed: !browser || !browser.isConnected(), httpServerClosed: !server?.listening };
  report.elapsedWallMs = Date.now() - startedAt; report.count = report.checks.length; report.passed = report.checks.filter(c => c.ok).length;
  report.ok = report.errors.length === 0 && report.count === report.passed && report.scenes.length === executions.length && report.scenes.every(s => s.verified) && Object.values(report.cleanup).every(Boolean);
  const walk = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name), prefix + e.name + '/') : [prefix + e.name]);
  report.artifacts = walk(out).filter(f => f !== 'report.json').sort().map(file => { const b = read(path.join(out, file)); return { file, bytes: b.length, sha256: sha(b) }; });
  write('report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ok: report.ok, count: report.count, passed: report.passed, sourceHtmlSha256: sourceHash, runnerSha256: report.runnerSha256, contexts: report.scenes.map(s => ({ id: s.id, verified: s.verified, longRoute: s.longRoute?.status || null })), errors: report.errors, cleanup: report.cleanup }, null, 2));
}
if (!report.ok) process.exitCode = 1;
