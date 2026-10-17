import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// TEST-ONLY real Chrome acceptance. Complete source-native saves enter only in
// initScript before the loader. All later actions use actual visible controls.
// WorldSnapshot.capture/localStorage reads are evidence, never actor knowledge
// inputs or hidden action calls. This runner does not update perception/state.
const flags = ['--run-approved', '--repo-root', '--html', '--expect-html-sha256', '--core-module', '--expect-core-module-sha256', '--input-manifest', '--expect-input-manifest-sha256', '--out', '--budget-seconds'];
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  assert.ok(flags.includes(process.argv[i]) && process.argv[i + 1], 'known flag/value pairs required');
  assert.ok(!Object.hasOwn(options, process.argv[i]), 'duplicate flag'); options[process.argv[i]] = process.argv[i + 1];
}
assert.equal(options['--run-approved'], 'yes', 'requires final source/architecture gates and explicit execution authorization');
for (const f of ['--html', '--core-module', '--input-manifest', '--out']) assert.ok(path.isAbsolute(options[f] || ''), f);
for (const f of ['--expect-html-sha256', '--expect-core-module-sha256', '--expect-input-manifest-sha256']) assert.match(options[f] || '', /^[a-f0-9]{64}$/);
const root = options['--repo-root'] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); assert.ok(path.isAbsolute(root));
const out = options['--out']; assert.equal(existsSync(out), false, 'new output required'); mkdirSync(out, { recursive: true });
const read = f => readFileSync(f), sha = b => createHash('sha256').update(b).digest('hex');
const write = (file, b) => { const p = path.join(out, file); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, b); };
const source = read(options['--html']), runner = read(fileURLToPath(import.meta.url)), core = read(options['--core-module']);
const sourceHash = sha(source), budgetSeconds = Number(options['--budget-seconds'] || 180);
assert.ok(Number.isInteger(budgetSeconds) && budgetSeconds >= 60 && budgetSeconds <= 300);
const startedAt = Date.now(), deadline = startedAt + budgetSeconds * 1000;
const remaining = (cap = 12000) => { const n = deadline - Date.now(); assert.ok(n > 0, 'overall browser budget exhausted'); return Math.max(1, Math.min(n, cap)); };
const same = (a, b) => { try { assert.deepStrictEqual(a, b); return true; } catch { return false; } };
const clock = p => (p.day - 1) * 1440 + p.hour * 60 + p.minute;
const payload = raw => { const o = JSON.parse(raw); return o.payload || o; };
const unavailable = '这次查看没有得到可确认的视线报告。';
const specs = [
  { id: 'direct-visible', status: 'observed', trust: 0, hp: 100, life: 'healthy', primary: true },
  { id: 'direct-blocked', status: 'unavailable', trust: 0, hp: 100, life: 'healthy' },
  { id: 'low-trust', status: 'unavailable', trust: -11, hp: 100, life: 'healthy' },
  { id: 'critical-unavailable', status: 'unavailable', trust: 0, hp: 20, life: 'critical' }
];
const report = {
  schema: 'NpcDirectSightBrowserV1', runner: 'browser-npc-direct-sight-v1', runnerSha256: sha(runner), sourceHtmlSha256: sourceHash, coreModuleSha256: sha(core),
  mode: 'TEST-ONLY complete source-native preboot fixtures and actual public Chrome controls', naturalGameplay: false, naturalGameplayClaim: false,
  injectionBeforeLoader: true, gameStateMutationAfterBoot: false, hiddenGameActionsAfterBoot: false, forceClicks: false,
  policyVersion: 'npc-view-direct-sight-v1', designId: 'npc-direct-sight-observation-v1', budgetSeconds,
  parameters: { source: 'artifact:source.html', core: 'artifact:core-executed.mjs', inputs: 'artifact:source-native-inputs/manifest.json', output: 'artifact:./', repoRoot: options['--repo-root'] ? 'explicit dependency root' : 'installed repository relative' },
  scope: { fixedRuleExpression: true, directSight: true, fullActorObservation: false, contactsKnowledge: false, sharedKnowledge: false, LLM: false,
    liveSnapshotEvidence: 'root-authorized read-only WorldSnapshot.capture; verification only, not a production actor input',
    phaseProbe: 'public N starts a real optional encounter; it is not calendar night or a midnight/calendar regression',
    hiddenVisibility: 'not tested', relatedOldSuites: 'not executed by this runner' },
  checks: [], errors: [], scenes: [], nativeValidations: [], allMainDocuments: [], documentHashes: []
};
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); };
let browser, server, factory, saveKey; const contexts = [], pendingHTTP = [];
try {
  check('HTML and core bytes match explicit expected SHAs', sourceHash === options['--expect-html-sha256'] && sha(core) === options['--expect-core-module-sha256']);
  if (process.platform === 'win32') {
    const sid = execFileSync('whoami', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true }).match(/S-1-[0-9-]+/)?.[0]; assert.ok(sid);
    execFileSync('icacls', [out, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true });
    const escaped = out.replaceAll("'", "''"), command = `$a=[System.IO.Directory]::GetAccessControl('${escaped}'); [pscustomobject]@{protected=$a.AreAccessRulesProtected;rules=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]) | ForEach-Object {[pscustomobject]@{sid=$_.IdentityReference.Value;rights=[string]$_.FileSystemRights;type=[string]$_.AccessControlType;inherited=$_.IsInherited}})} | ConvertTo-Json -Compress -Depth 5`;
    const acl = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', windowsHide: true }));
    check('private Windows ACL actually verified', acl.protected && acl.rules.length > 0 && acl.rules.every(r => r.sid === sid && r.type === 'Allow' && r.rights.includes('FullControl') && !r.inherited));
    report.privateOutput = { aclVerified: true, inheritanceDisabled: true, allowedPrincipal: 'current-user-only' };
  }
  write('source.html', source); write('runner-executed.mjs', runner); write('core-executed.mjs', core);
  const dependencies = ['scripts/lib/source-runtime-fixture.mjs', 'scripts/check-report-recovery.mjs', 'dist/actor-sprites.js'];
  report.dependencies = dependencies.map(file => { const b = read(path.join(root, file)); write(`frozen/${file}`, b); return { file, bytes: b.length, sha256: sha(b) }; });
  const fixture = await import(pathToFileURL(path.join(root, 'scripts/lib/source-runtime-fixture.mjs')).href);
  // Read the already-frozen source copy, not a subsequently edited candidate.
  factory = fixture.sourceRuntimeFactory(path.join(out, 'source.html')); saveKey = fixture.saveKey;
  const manifestBytes = read(options['--input-manifest']); check('source-native input manifest exact SHA', sha(manifestBytes) === options['--expect-input-manifest-sha256']);
  const manifest = JSON.parse(manifestBytes), inputRoot = path.dirname(options['--input-manifest']); report.inputManifestSha256 = sha(manifestBytes);
  write('source-native-inputs/manifest.json', manifestBytes);
  check('source-native manifest schema and exact producer HTML', manifest.schema === 'NpcDirectSightBrowserSourceInputManifestV1' && manifest.sourceHtmlSha256 === sourceHash);
  check('four unique explicitly declared scene IDs', Array.isArray(manifest.scenes) && manifest.scenes.length === specs.length && new Set(manifest.scenes.map(s => s.id)).size === specs.length && specs.every(s => manifest.scenes.some(m => m.id === s.id)));
  check('controlled offline provenance is explicit', typeof manifest.method === 'string' && manifest.method.startsWith('TEST-ONLY') && !manifest.naturalGameplay);
  report.inputCaptureMethod = manifest.method;
  const inputPath = file => { assert.ok(typeof file === 'string' && !path.isAbsolute(file)); const p = path.resolve(inputRoot, file); assert.ok(p.startsWith(path.resolve(inputRoot) + path.sep), 'input inside its capture root'); return p; };
  const originalBytes = read(inputPath(manifest.originalWriter.file));
  check('original actual old writer bytes retained', sha(originalBytes) === manifest.originalWriter.sha256 && sha(originalBytes) === '1e29b29ed13ea722b20955d79306b307820099cfad4d78cd68175f770d8f269f');
  write('source-native-inputs/original-writer.json', originalBytes); const original = payload(originalBytes);
  const validate = (raw, label) => { const r = factory([[saveKey, raw]]), v = r.api.validate({ raw, sourceCategory: 'primary' }); report.nativeValidations.push({ label, sha256: sha(raw), ok: v.ok, reason: v.reason || null }); check(`${label}: actual source native validator`, v.ok); return payload(raw); };
  const scenes = specs.map(spec => {
    const m = manifest.scenes.find(v => v.id === spec.id), b = read(inputPath(m.file)); check(`${spec.id}: exact complete native input`, sha(b) === m.sha256);
    write(`source-native-inputs/${m.file}`, b); const p = validate(b.toString('utf8'), `${spec.id}-input`), npc = p.npcs.find(n => n.id === m.npcId);
    check(`${spec.id}: original actor/player position and fixed roster`, m.npcId === 'carpenter' && typeof m.npcName === 'string' && same(p.npcs.map(n => n.id), original.npcs.map(n => n.id)) && p.player.x === 11 && p.player.y === 11 && npc.x === 11.75 && npc.y === 11);
    check(`${spec.id}: actual independent health/trust control`, npc.hp === spec.hp && npc.maxHp === 100 && npc.lifeState === spec.life && npc.relations.trustToPlayer === spec.trust && npc.motionTarget === null);
    check(`${spec.id}: original population, enemy identities/health/kinds, discovery and resources retained`, same(p.worldZombies.map(z => ({ id: z.id, hp: z.hp, maxHp: z.maxHp, kind: z.kind })), original.worldZombies.map(z => ({ id: z.id, hp: z.hp, maxHp: z.maxHp, kind: z.kind }))) && same(p.visitedRegions, original.visitedRegions) && ['food', 'wood', 'stone', 'seeds', 'parts', 'medicine', 'energy'].every(k => p[k] === original[k]));
    check(`${spec.id}: explicit paused-clock fixture without live patch`, p.worldMeta.clock.paused === true && m.controls?.clockPaused === true && Array.isArray(m.changes) && m.changes.length > 0);
    const enemies = p.worldZombies.filter(z => z.kind === 'normal' && z.x === 11.75 && z.y === 13);
    check(`${spec.id}: fixed actual normal enemy at actor-relative two cells`, enemies.length === 1 && Math.hypot(enemies[0].x - npc.x, enemies[0].y - npc.y) === 2);
    check(`${spec.id}: independent expected status/category/band`, m.expected?.status === spec.status && (spec.primary ? m.expected.category === 'normal' && m.expected.distanceBand === 'near' : m.expected.category === null && m.expected.distanceBand === null));
    if (spec.id === 'direct-blocked') check(`${spec.id}: declared physical wall input`, p.buildings.some(b => b.type === 'wall' && b.x === 11 && b.y === 12 && typeof b.id === 'string'));
    if (spec.primary) {
      check(`${spec.id}: enemy region was not previously discovered by the player`, p.visitedRegions.south !== true);
      check(`${spec.id}: second real public actor declared for target switch`, m.targetChangeProbe?.npcId === 'doctor' && typeof m.targetChangeProbe.npcName === 'string' && p.npcs.some(n => n.id === 'doctor' && n.x === 11 && n.y === 11.75));
    }
    return { ...spec, meta: m, raw: b.toString('utf8') };
  });
  const sprites = read(path.join(root, 'dist/actor-sprites.js'));
  server = createServer((req, res) => { const p = new URL(req.url, 'http://localhost').pathname; if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(source); } else if (p === '/actor-sprites.js') { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); res.end(sprites); } else { res.writeHead(404); res.end(); } });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const require = createRequire(import.meta.url), { chromium } = require(process.env.ZH_PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, channel: process.env.ZH_BROWSER_CHANNEL || 'chrome', timeout: remaining(30000) }); report.browserVersion = browser.version();
  for (const scene of scenes) {
    const result = { id: scene.id, npcId: scene.meta.npcId, inputSha256: sha(scene.raw), changes: scene.meta.changes, verified: false, snapshots: [], observations: [], coverage: {} }; report.scenes.push(result);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(context);
    await context.addInitScript(({ key, raw }) => { if (!sessionStorage.getItem('qa-npc-direct-sight-seeded')) { localStorage.clear(); localStorage.setItem(key, raw); sessionStorage.setItem('qa-npc-direct-sight-seeded', 'yes'); } }, { key: saveKey, raw: scene.raw });
    const page = await context.newPage(); page.setDefaultTimeout(remaining()); page.on('pageerror', e => report.errors.push({ scene: scene.id, type: 'pageerror', message: e.message }));
    let mainSequence = 0;
    page.on('response', response => { if (response.request().resourceType() === 'document' && response.frame() === page.mainFrame()) pendingHTTP.push((async () => { const b = await response.body(), h = sha(b); report.allMainDocuments.push({ scene: scene.id, sequence: ++mainSequence, status: response.status(), sha256: h, url: response.url() }); if (h !== sourceHash || !response.ok()) { write(`${scene.id}-unexpected-main-${mainSequence}.html`, b); report.errors.push({ scene: scene.id, type: 'main-document', status: response.status(), sha256: h }); } })().catch(e => report.errors.push({ scene: scene.id, type: 'main-document-body', message: e.message }))); });
    const actorId = scene.meta.npcId, view = page.locator(`[data-context-action="npcView"][data-npc-id="${actorId}"]`);
    const contextRow = '#npcSightReport[data-npc-sight-surface="context"]';
    const rosterRow = id => `#survivorList [data-npc="${id}"] .npc-sight-report[data-npc-sight-surface="roster"][data-npc-sight-npc="${id}"]`;
    async function doc(response, stage) { assert.ok(response); const h = sha(await response.body()); report.documentHashes.push({ scene: scene.id, stage, sha256: h }); check(`${scene.id}: ${stage} actual HTTP exact HTML`, response.ok() && h === sourceHash); }
    async function saved(label) { const raw = await page.evaluate(k => localStorage.getItem(k), saveKey); assert.ok(raw); const file = `${scene.id}-${label}-save.json`; write(file, raw); result.snapshots.push({ label, file, sha256: sha(raw) }); return validate(raw, `${scene.id}-${label}`); }
    async function live(label) { const s = await page.evaluate(() => WorldSnapshot.capture()); write(`${scene.id}-${label}-readonly-world-snapshot.json`, JSON.stringify(s, null, 2) + '\n'); return s; }
    async function continuePublic() { const b = page.locator('#continueSaveBtn'); check(`${scene.id}: public continue enabled`, await b.isVisible() && await b.isEnabled()); await b.click({ timeout: remaining() }); await page.waitForFunction(() => document.getElementById('startOverlay').classList.contains('hidden') && document.getElementById('world').getClientRects().length > 0, {}, { timeout: remaining() }); check(`${scene.id}: original same public context target`, await view.isVisible() && await view.isEnabled()); }
    async function clearVisible(label) { const states = await page.locator('[data-npc-sight-surface]').evaluateAll(es => es.map(e => ({ text: e.textContent, hidden: e.hidden, displayed: getComputedStyle(e).display, visible: e.getClientRects().length > 0 }))); check(`${scene.id}: ${label} clears disclosed text`, states.every(s => !s.text.trim())); result.observations.push({ label, states }); }
    async function row(selector, label, npcId = actorId, status = scene.status) {
      const el = page.locator(selector); await el.waitFor({ state: 'visible', timeout: remaining() }); await el.scrollIntoViewIfNeeded({ timeout: remaining() });
      const s = await el.evaluate(e => { const c = getComputedStyle(e), r = e.getBoundingClientRect(); let ancestorClipped = false; for (let a = e.parentElement; a; a = a.parentElement) { const ac = getComputedStyle(a), ar = a.getBoundingClientRect(); if ((['hidden', 'clip', 'scroll', 'auto'].includes(ac.overflowX) && (r.left < ar.left - 1 || r.right > ar.right + 1)) || (['hidden', 'clip', 'scroll', 'auto'].includes(ac.overflowY) && (r.top < ar.top - 1 || r.bottom > ar.bottom + 1))) ancestorClipped = true; } return { text: e.textContent, innerText: e.innerText, actorId: e.dataset.npcSightNpc, generation: e.dataset.npcSightGeneration, minute: e.dataset.npcSightWorldMinute, status: e.dataset.npcSightStatus, rect: { x: r.x, y: r.y, width: r.width, height: r.height }, viewport: { width: innerWidth, height: innerHeight }, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth, scrollHeight: e.scrollHeight, clientHeight: e.clientHeight, visibleStyle: c.visibility !== 'hidden' && Number(c.opacity) > .9, withinViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, ancestorClipped }; });
      result.observations.push({ label, ...s }); await page.screenshot({ path: path.join(out, `${scene.id}-${label}.png`), timeout: remaining() });
      check(`${scene.id}: ${label} same actor/status and real unclipped visible layout`, s.actorId === npcId && s.status === status && /^\d+$/.test(s.generation || '') && Number.isFinite(Number(s.minute)) && s.visibleStyle && s.withinViewport && !s.ancestorClipped && s.scrollWidth <= s.clientWidth + 1 && s.scrollHeight <= s.clientHeight + 1, s);
      return s;
    }
    function expectedText(p, name, status) { const time = `第${p.day}天 ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')} · 本次所见`; return time + '\n' + (status === 'observed' ? `${name}：我看见一只普通僵尸，离我很近。` : unavailable); }
    async function clickView(locator, label) { const a = await live(label + '-before'); await locator.click({ timeout: remaining() }); const b = await live(label + '-after'); check(`${scene.id}: ${label} synchronous full readonly projection unchanged`, same(a, b)); const t = await page.locator('#toast').evaluate(e => ({ text: e.textContent, classes: [...e.classList] })); check(`${scene.id}: ${label} retains original ordinary view toast`, !t.classes.includes('npc-self-dialogue') && t.text.includes('HP ') && t.text.includes('请求或命令需靠近到 1 格内')); result.observations.push({ label: label + '-ordinary-toast', ...t }); }

    await doc(await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded', timeout: remaining() }), 'boot'); await continuePublic();
    await doc(await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining() }), 'initial-real-pagehide'); const before = await saved('actual-pagehide-before-view'); await continuePublic();
    const title = await page.locator('#contextTitle').innerText(); check(`${scene.id}: actual public actor label matches capture label`, title.split(' · ')[0] === scene.meta.npcName);
    await clearVisible('initial session'); await clickView(view, 'context-view');
    const first = await row(contextRow, 'context-report-desktop'); check(`${scene.id}: actual authored category/distance or neutral unavailable`, first.text === expectedText(before, scene.meta.npcName, scene.status) && Number(first.minute) === clock(before));
    const rawIds = before.worldZombies.map(e => e.id); check(`${scene.id}: own response exposes no raw enemy ID, HP or intent`, !rawIds.some(id => first.text.includes(id)) && !/HP|targetId|aiState|goal|附近安全|没有敌人/.test(first.text)); result.coverage.context = true;
    remaining(2500); await page.waitForTimeout(2100); check(`${scene.id}: ordinary toast short timeout restored`, !(await page.locator('#toast').evaluate(e => e.classList.contains('show'))));
    const retained = await row(contextRow, 'asof-after-ordinary-toast'); check(`${scene.id}: disclosed report remains same as-of text`, retained.text === first.text && retained.generation === first.generation && retained.minute === first.minute); result.coverage.asofPersistence = true;
    await page.setViewportSize({ width: 390, height: 844 }); remaining(400); await page.waitForTimeout(300); const mobile = await row(contextRow, 'context-report-mobile-390'); check(`${scene.id}: real resize redraw keeps same report revision`, mobile.text === first.text && mobile.generation === first.generation && mobile.minute === first.minute && mobile.viewport.width === 390); result.coverage.mobile = true;
    await page.setViewportSize({ width: 1440, height: 1000 }); remaining(400); await page.waitForTimeout(300);
    await page.locator('#contextClose').click({ timeout: remaining() }); await clearVisible('context close'); result.coverage.contextClose = true;
    await page.keyboard.press('v'); const card = page.locator(`#survivorList [data-npc="${actorId}"]`); check(`${scene.id}: original public roster card enabled`, await card.isVisible() && await card.isEnabled());
    await clickView(card, 'roster-view'); const roster = await row(rosterRow(actorId), 'roster-report-desktop'); check(`${scene.id}: roster consumes same authored report contract`, roster.text === expectedText(before, scene.meta.npcName, scene.status)); result.coverage.roster = true;
    await page.setViewportSize({ width: 390, height: 844 }); remaining(400); await page.waitForTimeout(300); const rosterMobile = await row(rosterRow(actorId), 'roster-report-mobile-390'); check(`${scene.id}: real roster redraw retains its disclosed revision`, rosterMobile.text === roster.text && rosterMobile.generation === roster.generation && rosterMobile.minute === roster.minute); result.coverage.rosterMobile = true;
    await page.setViewportSize({ width: 1440, height: 1000 }); remaining(400); await page.waitForTimeout(300);
    if (scene.primary) {
      const other = scene.meta.targetChangeProbe, otherCard = page.locator(`#survivorList [data-npc="${other.npcId}"]`); check(`${scene.id}: same original second public actor available`, await otherCard.isVisible() && await otherCard.isEnabled() && (await otherCard.innerText()).includes(other.npcName + ' ·')); await clickView(otherCard, 'different-actor-view');
      const otherReport = await row(rosterRow(other.npcId), 'different-actor-report', other.npcId, 'observed');
      // A correct clear may remove data-npc-sight-npc as well as its text. Query
      // the original public card/surface, not a now-removed binding attribute.
      const oldTexts = await page.locator(`#survivorList [data-npc="${actorId}"] .npc-sight-report[data-npc-sight-surface="roster"]`).allTextContents();
      check(`${scene.id}: new target receives its own name not old actor text`, otherReport.text === expectedText(before, other.npcName, 'observed') && oldTexts.every(t => !t.trim())); result.coverage.targetClear = true;
    }
    await page.locator('#infoModalClose').click({ timeout: remaining() }); await clearVisible('status terminal close');
    await doc(await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining() }), 'after-views-real-pagehide'); const after = await saved('actual-pagehide-after-views');
    check(`${scene.id}: actual full native business/map/contacts/ledger unchanged by views`, same(before, after)); result.coverage.nativeBusiness = true;
    await clearVisible('reload start overlay'); await continuePublic(); await clearVisible('reloaded new session'); result.coverage.sessionClear = true;
    // The previous native result is checked before the real encounter. Phase
    // changes have their legitimate costs and are not part of view purity.
    if (scene.primary) {
      await clickView(view, 'pre-encounter-view'); await row(contextRow, 'pre-encounter-report'); const beforeEncounter = await live('before-public-encounter');
      await page.keyboard.press('n'); await page.waitForFunction(() => document.body.classList.contains('threat-map-active'), {}, { timeout: remaining() }); await clearVisible('real optional encounter phase');
      const battle = await live('after-public-encounter'), fresh = battle.worldMeta.events.filter(e => e.seq > beforeEncounter.worldMeta.eventSeq), event = fresh.find(e => e.type === 'threat.started'), command = battle.worldMeta.replay.commands.find(c => c.commandId === event?.commandId);
      check(`${scene.id}: actual public encounter typed command/event recorded`, event && command?.type === 'threat.start'); result.phaseProbe = { entry: 'actual public N', calendarClaim: false, command, event }; result.coverage.phaseClear = true;
      await page.screenshot({ path: path.join(out, `${scene.id}-actual-battle-report-cleared.png`), timeout: remaining() });
    }
    await Promise.all(pendingHTTP); check(`${scene.id}: every recorded main response is exact frozen HTML`, report.allMainDocuments.filter(d => d.scene === scene.id).length >= 3 && report.allMainDocuments.filter(d => d.scene === scene.id).every(d => d.sha256 === sourceHash && d.status === 200));
    const needed = ['context', 'asofPersistence', 'mobile', 'contextClose', 'roster', 'rosterMobile', 'nativeBusiness', 'sessionClear', ...(scene.primary ? ['targetClear', 'phaseClear'] : [])];
    check(`${scene.id}: all declared scene coverage actually reached`, needed.every(k => result.coverage[k] === true)); result.verified = true; await context.close();
  }
} catch (error) {
  console.error(error.stack || String(error)); report.errors.push({ type: 'runner', message: error.message || String(error) });
  for (let i = 0; i < contexts.length; i++) for (const p of contexts[i].pages()) if (!p.isClosed()) try { await p.screenshot({ path: path.join(out, `failure-${i}.png`), timeout: 5000 }); } catch (e) { report.errors.push({ type: 'failure-screenshot', message: e.message }); }
} finally {
  await Promise.all(pendingHTTP); let contextsClosed = true;
  for (const c of contexts) await c.close().catch(e => { contextsClosed = false; report.errors.push({ type: 'context-close', message: e.message }); });
  if (browser) await browser.close().catch(e => report.errors.push({ type: 'browser-close', message: e.message }));
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  report.cleanup = { contextsClosed, browserClosed: !browser || !browser.isConnected(), httpServerClosed: !server?.listening };
  report.elapsedWallMs = Date.now() - startedAt; report.count = report.checks.length; report.passed = report.checks.filter(c => c.ok).length;
  report.ok = report.errors.length === 0 && report.count === report.passed && report.scenes.length === specs.length && report.scenes.every(s => s.verified) && Object.values(report.cleanup).every(Boolean);
  const walk = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name), prefix + e.name + '/') : [prefix + e.name]);
  report.artifacts = walk(out).filter(f => f !== 'report.json').sort().map(file => { const b = read(path.join(out, file)); return { file, bytes: b.length, sha256: sha(b) }; });
  write('report.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ ok: report.ok, count: report.count, passed: report.passed, sourceHtmlSha256: sourceHash, runnerSha256: report.runnerSha256, scenes: report.scenes.map(s => ({ id: s.id, verified: s.verified })), errors: report.errors, cleanup: report.cleanup }, null, 2));
}
if (!report.ok) process.exitCode = 1;
