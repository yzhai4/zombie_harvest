import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// Real Chrome fixture acceptance. Only a complete native save is installed in
// initScript, before the actual loader. Browser actions use visible controls/E;
// no game functions, state patches, receipt injection or forced clicks follow.
const options = {}, allowed = ['--run-approved','--repo-root','--html','--expect-html-sha256','--input-manifest','--expect-input-manifest-sha256','--out','--budget-seconds'];
for (let i = 2; i < process.argv.length; i += 2) {
  assert.ok(allowed.includes(process.argv[i]) && process.argv[i + 1], 'known flag/value pairs required');
  assert.ok(!Object.hasOwn(options, process.argv[i]), 'duplicate option'); options[process.argv[i]] = process.argv[i + 1];
}
assert.equal(options['--run-approved'], 'yes', 'requires explicit execution authorization after source/architecture gates');
for (const flag of ['--html','--input-manifest','--out']) assert.ok(path.isAbsolute(options[flag] || ''), flag);
for (const flag of ['--expect-html-sha256','--expect-input-manifest-sha256']) assert.match(options[flag] || '', /^[a-f0-9]{64}$/);
const root = options['--repo-root'] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); assert.ok(path.isAbsolute(root));
const out = options['--out']; assert.equal(existsSync(out), false, 'new output directory required'); mkdirSync(out, { recursive: true });
const sha = b => createHash('sha256').update(b).digest('hex'), read = f => readFileSync(f), write = (file, b) => { const f = path.join(out, file); mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, b); };
const runner = read(fileURLToPath(import.meta.url)), source = read(options['--html']), sourceHash = sha(source);
const budgetSeconds = Number(options['--budget-seconds'] || 150); assert.ok(Number.isInteger(budgetSeconds) && budgetSeconds >= 30 && budgetSeconds <= 240);
const startedAt = Date.now(), deadline = startedAt + budgetSeconds * 1000;
const report = { schema: 'NpcSelfObservationBrowserV1', runner: 'browser-npc-self-observation-v1', runnerSha256: sha(runner), sourceHtmlSha256: sourceHash,
  mode: 'TEST-ONLY complete source-native preboot fixtures and actual public Chrome actions', naturalGameplay: false, naturalGameplayClaim: false,
  injectionBeforeLoader: true, gameStateMutationAfterBoot: false, hiddenGameActionsAfterBoot: false, forceClicks: false,
  policyVersion: 'npc-first-talk-self-v1', designId: 'npc-self-observation-v1', budgetSeconds,
  parameters: { source: 'artifact:source.html', inputManifest: 'artifact:input-manifest.json', output: 'artifact:./', repoRoot: options['--repo-root'] ? 'explicit dependency root' : 'installed repository relative' },
  scope: { selfDialogue: true, fullPerception: false, contacts: false, LLM: false, statusInquiryBrowser: false, combatInterruptionBrowser: false,
    layoutViewports: [{ width: 1440, height: 1000 }, { width: 390, height: 844 }], durationScope: 'same self toast remains beyond the original 1800ms; full 12-second expiry is not claimed',
    sourceValidation: 'separate actual inline loader/validator in an isolated IO-adapter VM; no browser game hook calls',
    purity: 'this runner checks visible integration and original typed outcomes; component purity is a separate source contract' },
  checks: [], errors: [], scenes: [], allMainDocuments: [], documentHashes: [], nativeValidations: [] };
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); };
const equal = (a, b) => { try { assert.deepStrictEqual(a, b); return true; } catch { return false; } };
const remaining = (cap = 12000) => { const ms = deadline - Date.now(); assert.ok(ms > 0, 'overall browser budget exhausted'); return Math.max(1, Math.min(cap, ms)); };
const clock = p => (p.day - 1) * 1440 + p.hour * 60 + p.minute;
const specs = [
  { id: 'normal-support', hp: 100, lifeState: 'healthy', trust: 0, needs: { hunger: 0, fatigue: 0, energy: 100 }, paid: true },
  { id: 'needs-threshold', hp: 50, lifeState: 'injured', trust: -10, needs: { hunger: 70, fatigue: 70, energy: 25 } },
  { id: 'low-trust', hp: 50, lifeState: 'injured', trust: -11, needs: { hunger: 70, fatigue: 70, energy: 25 } },
  { id: 'critical-free', hp: 20, lifeState: 'critical', trust: 0, needs: { hunger: 5, fatigue: 70, energy: 25 }, zero: true }
];
let browser, server, factory, saveKey; const contexts = [], pendingHTTP = [];
try {
  check('HTML bytes match explicit expected SHA', sourceHash === options['--expect-html-sha256']);
  if (process.platform === 'win32') {
    const sid = execFileSync('whoami', ['/user','/fo','csv','/nh'], { encoding: 'utf8', windowsHide: true }).match(/S-1-[0-9-]+/)?.[0]; assert.ok(sid);
    execFileSync('icacls', [out, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true });
    const escaped = out.replaceAll("'", "''"), command = `$a=[System.IO.Directory]::GetAccessControl('${escaped}'); [pscustomobject]@{protected=$a.AreAccessRulesProtected;rules=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]) | ForEach-Object {[pscustomobject]@{sid=$_.IdentityReference.Value;rights=[string]$_.FileSystemRights;type=[string]$_.AccessControlType;inherited=$_.IsInherited}})} | ConvertTo-Json -Compress -Depth 5`;
    const acl = JSON.parse(execFileSync('powershell.exe', ['-NoProfile','-NonInteractive','-Command',command], { encoding: 'utf8', windowsHide: true }));
    check('private Windows ACL verified', acl.protected && acl.rules.length > 0 && acl.rules.every(r => r.sid === sid && r.type === 'Allow' && r.rights.includes('FullControl') && !r.inherited));
    report.privateOutput = { aclVerified: true, inheritanceDisabled: true, allowedPrincipal: 'current-user-only' };
  } else report.privateOutput = { aclVerified: false, platform: process.platform };
  const fixtureModule = await import(pathToFileURL(path.join(root, 'scripts/lib/source-runtime-fixture.mjs')).href); factory = fixtureModule.sourceRuntimeFactory(options['--html']); saveKey = fixtureModule.saveKey;
  const dependencies = ['scripts/lib/source-runtime-fixture.mjs','scripts/check-report-recovery.mjs','scripts/lib/npc-self-observation-v1.mjs','scripts/lib/observer-expression-v1.mjs','scripts/lib/scenario-package-v1.mjs','dist/actor-sprites.js'];
  report.dependencies = dependencies.map(file => { const bytes = read(path.join(root, file)); write(`frozen/${file}`, bytes); return { file, bytes: bytes.length, sha256: sha(bytes) }; });
  write('runner-executed.mjs', runner); write('source.html', source);
  const manifestBytes = read(options['--input-manifest']); check('input manifest exact SHA', sha(manifestBytes) === options['--expect-input-manifest-sha256']); write('input-manifest.json', manifestBytes);
  const manifest = JSON.parse(manifestBytes); report.inputManifestSha256 = sha(manifestBytes); report.inputCaptureMethod = manifest.method;
  check('actual source-native manifest schema', manifest.schema === 'NpcSelfBrowserSourceInputManifestV1');
  check('input capture belongs to this exact HTML', manifest.sourceHtmlSha256 === sourceHash);
  check('four unique declared native scenes', Array.isArray(manifest.scenes) && manifest.scenes.length === specs.length && new Set(manifest.scenes.map(s => s.id)).size === specs.length && specs.every(s => manifest.scenes.some(v => v.id === s.id)));
  const inputRoot = path.dirname(options['--input-manifest']);
  const inputFile = file => { assert.ok(typeof file === 'string' && !path.isAbsolute(file)); const p = path.resolve(inputRoot, file); assert.ok(p.startsWith(path.resolve(inputRoot) + path.sep), 'input remains inside capture directory'); return p; };
  const original = read(inputFile(manifest.originalWriter.file));
  check('unchanged actual old writer source is exact', sha(original) === manifest.originalWriter.sha256 && sha(original) === '1e29b29ed13ea722b20955d79306b307820099cfad4d78cd68175f770d8f269f'); write('original-writer.json', original);
  const originalPayload = JSON.parse(original).payload || JSON.parse(original), originalIds = originalPayload.npcs.map(n => n.id);
  const validate = (raw, label) => { const r = factory([[saveKey, raw]]), v = r.api.validate({ raw, sourceCategory: 'primary' }); report.nativeValidations.push({ label, sha256: sha(raw), ok: v.ok, reason: v.reason || null }); check(`${label}: actual source native validator`, v.ok); return JSON.parse(raw).payload; };
  const scenes = specs.map(spec => {
    const meta = manifest.scenes.find(s => s.id === spec.id), bytes = read(inputFile(meta.file)); check(`${spec.id}: complete input bytes exact`, sha(bytes) === meta.sha256);
    const p = validate(bytes.toString('utf8'), `${spec.id}-input`), npc = p.npcs.find(n => n.id === meta.npcId);
    check(`${spec.id}: declared target is original carpenter and fixed roster retained`, meta.npcId === 'carpenter' && equal(p.npcs.map(n => n.id), originalIds));
    check(`${spec.id}: independent injury/trust/needs input vector`, npc.hp === spec.hp && npc.maxHp === 100 && npc.lifeState === spec.lifeState && npc.relations.trustToPlayer === spec.trust && equal({ hunger: npc.needs.hunger, fatigue: npc.needs.fatigue, energy: npc.needs.energy }, spec.needs));
    check(`${spec.id}: no fabricated prior support`, npc.supportRequested === false && npc.order === null && npc.bond === 0 && npc.memory.helpedByPlayer === 0);
    check(`${spec.id}: declared original player and public tile geometry`, p.player.x === originalPayload.player.x && p.player.y === originalPayload.player.y && npc.x === p.player.x + .75 && npc.y === p.player.y && meta.publicTargetTile?.x === Math.floor(npc.x) && meta.publicTargetTile?.y === Math.floor(npc.y));
    check(`${spec.id}: enemy population and inventory were not removed or supplemented`, equal(p.worldZombies, originalPayload.worldZombies) && ['food','wood','stone','seeds','parts','medicine'].every(k => p[k] === originalPayload[k]));
    check(`${spec.id}: critical zero-energy paused admission or original clock preserved`, spec.zero ? p.energy === 0 && p.worldMeta.clock.paused === true : p.energy === originalPayload.energy && p.worldMeta.clock.rate === originalPayload.worldMeta.clock.rate);
    check(`${spec.id}: offline changes and non-natural provenance declared`, Array.isArray(meta.changes) && meta.changes.length > 0 && typeof manifest.method === 'string' && manifest.method.startsWith('TEST-ONLY actual loader') && manifest.method.includes('no browser afterboot state changes'));
    write(`${spec.id}-input-save.json`, bytes);
    return { ...spec, meta, raw: bytes.toString('utf8'), inputPayload: p };
  });
  const sprites = read(path.join(root, 'dist/actor-sprites.js'));
  server = createServer((req, res) => { const route = new URL(req.url, 'http://localhost').pathname; if (route === '/' || route === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(source); } else if (route === '/actor-sprites.js') { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); res.end(sprites); } else { res.writeHead(404); res.end(); } });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const require = createRequire(import.meta.url), { chromium } = require(process.env.ZH_PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, channel: process.env.ZH_BROWSER_CHANNEL || 'chrome', timeout: remaining(30000) }); report.browserVersion = browser.version();
  for (const scene of scenes) {
    remaining(); const result = { id: scene.id, npcId: scene.meta.npcId, inputSha256: sha(scene.raw), changes: scene.meta.changes, fixtureSourceCategory: 'TEST-ONLY complete native-writer offline derivative; not natural gameplay', verified: false, receipts: [], snapshots: [] }; report.scenes.push(result);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(context);
    await context.addInitScript(({ key, raw }) => { if (!sessionStorage.getItem('qa-npc-self-seeded')) { localStorage.clear(); localStorage.setItem(key, raw); sessionStorage.setItem('qa-npc-self-seeded', 'yes'); } }, { key: saveKey, raw: scene.raw });
    const page = await context.newPage(); page.setDefaultTimeout(remaining()); page.on('pageerror', e => report.errors.push({ scene: scene.id, type: 'pageerror', message: e.message }));
    let mainSeq = 0;
    page.on('response', response => { if (response.request().resourceType() === 'document' && response.frame() === page.mainFrame()) pendingHTTP.push((async () => { const body = await response.body(), hash = sha(body), entry = { scene: scene.id, sequence: ++mainSeq, status: response.status(), url: response.url(), sha256: hash, sourceRef: hash === sourceHash ? 'artifact:source.html' : null }; report.allMainDocuments.push(entry); if (hash !== sourceHash || !response.ok()) { write(`${scene.id}-unexpected-http-${mainSeq}.html`, body); report.errors.push({ scene: scene.id, type: 'main-document', status: response.status(), sha256: hash }); } })().catch(e => report.errors.push({ scene: scene.id, type: 'main-document-body', message: e.message }))); });
    const target = p => p.npcs.find(n => n.id === scene.meta.npcId), eventsAfter = (p, before) => p.worldMeta.events.filter(e => e.seq > before.worldMeta.eventSeq);
    async function saved(label) { const raw = await page.evaluate(key => localStorage.getItem(key), saveKey); assert.ok(raw); const file = `${scene.id}-${label}-save.json`; write(file, raw); result.snapshots.push({ label, file, sha256: sha(raw) }); return validate(raw, `${scene.id}-${label}`); }
    async function document(response, stage) { assert.ok(response); const hash = sha(await response.body()); report.documentHashes.push({ scene: scene.id, stage, sha256: hash }); check(`${scene.id}: ${stage} HTTP exact source`, response.ok() && hash === sourceHash); }
    async function continuePublic(requireOriginalTarget = true) {
      const button = page.locator('#continueSaveBtn'); check(`${scene.id}: actual continue control visible and enabled`, await button.isVisible() && await button.isEnabled()); await button.click({ timeout: remaining() });
      // An already-bound save can continue without an immediate rewrite. The
      // public overlay and original-target context establish real installation;
      // explicit native before snapshots use the actual pagehide writer below.
      await page.waitForFunction(({ npcId, requireOriginalTarget }) => { const overlay = document.getElementById('startOverlay'), world = document.getElementById('world'), view = document.querySelector(`[data-context-action="npcView"][data-npc-id="${npcId}"]`); return overlay.classList.contains('hidden') && world.getClientRects().length > 0 && (!requireOriginalTarget || view && !view.disabled && view.getClientRects().length > 0); }, { npcId: scene.meta.npcId, requireOriginalTarget }, { timeout: remaining() });
    }
    async function hoverOriginal() { const tile = page.locator(`#world .tile[data-x="${scene.meta.publicTargetTile.x}"][data-y="${scene.meta.publicTargetTile.y}"]`); check(`${scene.id}: declared target tile visible and not fogged`, await tile.isVisible() && !(await tile.getAttribute('class')).includes('fogged')); await tile.hover({ timeout: remaining() }); }
    async function waitEvent(type, seq, label) { await page.waitForFunction(({ key, type, seq }) => { const p = JSON.parse(localStorage.getItem(key)).payload; return p.worldMeta.events.some(e => e.type === type && e.seq > seq); }, { key: saveKey, type, seq }, { timeout: remaining(18000) }); return saved(label); }
    async function visibleToast(label, fullText = false) {
      await page.waitForFunction(() => { const t = document.getElementById('toast'), s = getComputedStyle(t); return t.classList.contains('show') && t.getClientRects().length > 0 && s.visibility !== 'hidden' && Number(s.opacity) >= .9; }, {}, { timeout: remaining(3000) });
      const observed = await page.locator('#toast').evaluate(t => { const s = getComputedStyle(t), r = t.getBoundingClientRect(); return { text: t.innerText, classes: [...t.classList], viewport: { width: innerWidth, height: innerHeight }, clientWidth: t.clientWidth, scrollWidth: t.scrollWidth, clientHeight: t.clientHeight, scrollHeight: t.scrollHeight, whiteSpace: s.whiteSpace, overflow: s.overflow, textOverflow: s.textOverflow, borderRadius: s.borderRadius, rect: { x: r.x, y: r.y, width: r.width, height: r.height }, withinViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
      result.toastObservations ??= []; result.toastObservations.push({ label, ...observed });
      await page.screenshot({ path: path.join(out, `${scene.id}-${label}.png`), timeout: remaining() });
      if (fullText) check(`${scene.id}: ${label} whole authored sentence has visible layout without clipping`, observed.classes.includes('npc-self-dialogue') && observed.whiteSpace === 'normal' && observed.withinViewport && observed.scrollWidth <= observed.clientWidth + 1 && observed.scrollHeight <= observed.clientHeight + 1, observed);
      return observed.text;
    }
    function typed(before, after, type, operation, energy, minutes) {
      const events = eventsAfter(after, before), matches = events.filter(e => e.type === type), e = matches[0], proof = e?.payload, parent = after.worldMeta.replay.commands.find(c => c.commandId === e?.commandId);
      check(`${scene.id}: ${operation} exact same NPC/player typed receipt`, matches.length === 1 && e.actorId === 'player-1' && parent?.actorId === 'player-1' && parent.type === 'npc.interact' && parent.payload.npcId === scene.meta.npcId && proof?.proofVersion === 1 && proof.npcId === scene.meta.npcId && proof.operation === operation && proof.target.id === scene.meta.npcId && proof.target.presentAtCompletion === true);
      check(`${scene.id}: ${operation} gross payment and actual clock`, proof.payment.cost.energy === energy && proof.payment.before.energy - proof.payment.after.energy === energy && proof.clock.requestedMinutes === minutes && proof.clock.elapsedMinutes === minutes && proof.outcome === 'completed');
      if (minutes) { const child = after.worldMeta.replay.commands.find(c => c.commandId === proof.advance?.commandId), advance = events.find(v => v.eventId === proof.advance?.eventId); check(`${scene.id}: support actual 15-minute child causal join`, child?.type === 'world.advance' && child.payload.minutes === minutes && advance?.type === 'time.advanced' && advance.commandId === child.commandId && advance.causationId === parent.commandId && advance.payload.minutes === minutes); result.receipts.push({ event: e, parent, child, advance }); }
      else { check(`${scene.id}: free talk has no owned time child`, proof.advance === null && proof.target.beforeAdvance === null && proof.target.afterAdvance === null && !events.some(v => v.type === 'time.advanced' && v.causationId === parent.commandId)); result.receipts.push({ event: e, parent }); }
      return proof;
    }
    function expectedText(npc) {
      // Input vectors are preboot controls, not current live facts. Use the
      // actual native before prefix immediately preceding this public action;
      // bind HP/life again to the actual first-talk proof below. Later retention
      // observations must compare the original text, never later world values.
      const base = { healthy: '我目前没有受伤。', injured: '我受伤了。', critical: '我伤得很重。' }[npc.lifeState], trust = npc.relations.trustToPlayer;
      if (trust < -10) return base + '具体情况，我暂时不想多谈。';
      const band = Math.round(npc.hp / npc.maxHp * 4), health = ['我的生命余量已经很少。','我的生命余量大约还剩四分之一。','我的生命余量大约还剩一半。','我的生命余量大约还剩四分之三。','我的生命余量接近完整。'][band], n = npc.needs;
      return base + health + (n.hunger >= 70 ? '我饿得厉害，得找点吃的。' : n.fatigue >= 70 ? '我累得厉害，需要休息。' : n.energy <= 25 ? '我快没力气了，需要缓一缓。' : '');
    }
    await document(await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded', timeout: remaining() }), 'boot');
    await continuePublic(); await document(await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining() }), 'initial-real-pagehide-baseline');
    const before = await saved('actual-pagehide-before-public-action'); await continuePublic(); result.beforeMethod = 'actual initial public reload/pagehide native writer; already-bound continue does not require an immediate rewritten save';
    const publicContext = await page.locator('#contextPanel').evaluate(el => ({ title: document.getElementById('contextTitle').textContent, text: el.innerText, buttons: [...el.querySelectorAll('[data-context-action]')].map(b => ({ action: b.dataset.contextAction, npcId: b.dataset.npcId, disabled: b.disabled, text: b.innerText })) })); result.publicContext = publicContext;
    // Native serializeNpc intentionally stores ID, not the template/UI name.
    // Read the actual public label and match the source capture's public label;
    // never invent or fetch a private observation name field.
    const publicName = publicContext.title.split(' · ')[0]; check(`${scene.id}: same public target identity and label`, publicContext.buttons.some(b => b.action === 'npcView' && b.npcId === scene.meta.npcId) && typeof scene.meta.npcName === 'string' && publicName === scene.meta.npcName);
    const view = page.locator(`[data-context-action="npcView"][data-npc-id="${scene.meta.npcId}"]`); check(`${scene.id}: original public view remains usable`, await view.isVisible() && await view.isEnabled()); await view.click({ timeout: remaining() }); result.viewToast = await visibleToast('public-view'); check(`${scene.id}: existing view retains injury/HP detail`, result.viewToast.startsWith(publicName + '：') && result.viewToast.includes('HP ') && result.viewToast.includes('请求或命令需靠近到 1 格内'));
    const support = page.locator(`[data-context-action="npc"][data-npc-id="${scene.meta.npcId}"]`); if (scene.zero) check(`${scene.id}: paid button stays disabled at E0`, await support.isDisabled()); else check(`${scene.id}: public first-talk button available`, await support.isVisible() && await support.isEnabled());
    if (scene.zero) { await hoverOriginal(); await page.keyboard.press('e'); } else await support.click({ timeout: remaining() });
    result.firstTalkToast = await visibleToast('first-talk-visible', true);
    result.firstTalkExpectedBasis = { nativeBeforeRef: result.snapshots.find(s => s.label === 'actual-pagehide-before-public-action'), worldMinute: clock(before), npc: { hp: target(before).hp, maxHp: target(before).maxHp, lifeState: target(before).lifeState, relationTrust: target(before).relations.trustToPlayer, needs: target(before).needs }, source: 'actual native before, not original preboot vector or later retention state' };
    check(`${scene.id}: actual authored self dialogue from the same public label`, result.firstTalkToast === `${publicName}：${expectedText(target(before))} 再次按 E 或点击确认请求支援`);
    check(`${scene.id}: self line has no mechanical lock/trust or safety promise`, !/已锁定|信任\s*-?\d|视野\s*\d|附近安全|能继续战斗|保证治好/.test(result.firstTalkToast));
    const dialogue = await waitEvent('npc.dialogueOpened', before.worldMeta.eventSeq, 'automatic-first-talk'); typed(before, dialogue, 'npc.dialogueOpened', 'dialogue-open', 0, 0);
    const firstTalkProof = result.receipts.find(r => r.event.type === 'npc.dialogueOpened').event.payload;
    check(`${scene.id}: actual first-talk phase HP/life matches saved before basis`, firstTalkProof.target.before.hp === target(before).hp && firstTalkProof.target.before.lifeState === target(before).lifeState && firstTalkProof.clock.before.world >= clock(before));
    check(`${scene.id}: free first talk did not grant support, bond or help memory`, !target(dialogue).supportRequested && target(dialogue).bond === target(before).bond && target(dialogue).memory.helpedByPlayer === target(before).memory.helpedByPlayer && equal(target(dialogue).memory, target(before).memory) && equal(target(dialogue).relations, target(before).relations));
    check(`${scene.id}: first-talk writer introduces no new save domain or extra business outcome`, equal(Object.keys(dialogue).sort(), Object.keys(before).sort()) && equal(Object.keys(target(dialogue)).sort(), Object.keys(target(before)).sort()) && !JSON.stringify(dialogue).includes('npc-first-talk-self-v1') && !eventsAfter(dialogue, before).some(e => ['npc.interacted','npc.orderChanged','npc.statusInquired'].includes(e.type)));
    result.firstTalkCheckpointMethod = 'automatic native writer observed before any reload/pagehide';
    const proofEvent = result.receipts.find(r => r.event.type === 'npc.dialogueOpened').event, retentionStartedAt = Date.now();
    remaining(2500); await page.waitForTimeout(2000);
    const retainedText = await visibleToast('same-talk-after-two-seconds', true);
    check(`${scene.id}: same saved first-talk sentence outlives ordinary 1800ms toast`, retainedText === result.firstTalkToast && Date.now() - retentionStartedAt >= 2000);
    result.retentionProbe = { proofEventId: proofEvent.eventId, proofTick: proofEvent.tick, waitAfterProofMs: Date.now() - retentionStartedAt, sameCurrentText: retainedText === result.firstTalkToast, laterWorldStateUsedToReconstructFirstTalk: false };
    await page.setViewportSize({ width: 390, height: 844 });
    // Wait for the product's real 250ms width transition after viewport resize;
    // sample the settled public geometry, keeping the full clipping Gate.
    remaining(400); await page.waitForTimeout(300); const mobileText = await visibleToast('same-talk-mobile-390', true);
    check(`${scene.id}: actual 390-wide same dialogue stays fully readable`, mobileText === result.firstTalkToast && result.toastObservations.at(-1).viewport.width === 390);
    await page.setViewportSize({ width: 1440, height: 1000 }); remaining(400); await page.waitForTimeout(300);
    await view.click({ timeout: remaining() }); await visibleToast('ordinary-view-after-self');
    const ordinaryStyle = result.toastObservations.at(-1); check(`${scene.id}: ordinary later toast restores original class and single-line style`, !ordinaryStyle.classes.includes('npc-self-dialogue') && ordinaryStyle.whiteSpace === 'nowrap' && ordinaryStyle.textOverflow === 'ellipsis');
    if (scene.zero) {
      const ordinaryStartedAt = Date.now(); remaining(2500); await page.waitForTimeout(2100);
      check(`${scene.id}: ordinary later toast returns to short lifetime`, !(await page.locator('#toast').evaluate(t => t.classList.contains('show'))));
      result.ordinaryToastExpiryProbe = { observedAfterMs: Date.now() - ordinaryStartedAt, actualHiddenClass: true, clockPaused: true, method: 'real browser timeout, not patched clock' };
    }
    if (scene.paid) {
      check(`${scene.id}: next public confirmation keeps original same target`, await support.isEnabled() && (await support.innerText()).includes('确认请求'));
      await support.click({ timeout: remaining() }); result.supportToast = await visibleToast('paid-support'); const after = await waitEvent('npc.interacted', dialogue.worldMeta.eventSeq, 'automatic-paid-support'); typed(dialogue, after, 'npc.interacted', 'support-requested', 2, 15);
      check(`${scene.id}: actual same NPC support/bond/help effect`, target(after).supportRequested && target(after).bond === target(dialogue).bond + 1 && target(after).memory.helpedByPlayer === target(dialogue).memory.helpedByPlayer + 1); result.finalAction = { kind: 'support', eventCount: after.worldMeta.events.filter(e => e.type === 'npc.interacted').length };
    } else if (scene.zero) {
      await hoverOriginal(); await page.keyboard.press('e'); result.paidRejectionToast = await visibleToast('paid-rejected');
      // Ordinary precondition rejection does not own an automatic checkpoint.
      // Persist through the real public reload/pagehide, keeping that distinct
      // from the automatic first-talk evidence already captured above.
      await document(await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining() }), 'rule-rejection-pagehide');
      const rejected = await saved('paid-rejected-via-real-pagehide'), failures = eventsAfter(rejected, dialogue).filter(e => e.type === 'command.rejected' && e.payload.type === 'npc.interact' && e.payload.reason === 'npc-energy');
      const rejectionParent = rejected.worldMeta.replay.commands.find(c => c.commandId === failures[0]?.commandId);
      result.paidRejectionCheckpointMethod = 'actual public reload/pagehide; not an automatic rule-rejection checkpoint';
      check(`${scene.id}: second E rejects original target/player without fake support or advance`, failures.length === 1 && failures[0].actorId === 'player-1' && rejectionParent?.actorId === 'player-1' && rejectionParent.payload.npcId === scene.meta.npcId && rejected.energy === 0 && clock(rejected) === clock(dialogue) && !target(rejected).supportRequested && !eventsAfter(rejected, dialogue).some(e => ['npc.interacted','npc.orderChanged'].includes(e.type) || e.type === 'time.advanced' && e.causationId === rejectionParent.commandId));
      result.receipts.push({ event: failures[0], parent: rejectionParent });
      await continuePublic();
    }
    const persisted = await saved('before-reload');
    await document(await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining() }), 'reload');
    const atOverlay = await saved('reload-before-continue'); check(`${scene.id}: pagehide retains committed support/identity and no new support receipt`, target(atOverlay).supportRequested === target(persisted).supportRequested && target(atOverlay).bond === target(persisted).bond && target(atOverlay).memory.helpedByPlayer === target(persisted).memory.helpedByPlayer && atOverlay.worldMeta.events.filter(e => e.type === 'npc.interacted').length === persisted.worldMeta.events.filter(e => e.type === 'npc.interacted').length);
    await continuePublic(!scene.paid); const reloaded = await saved('reloaded-actual-native-prefix');
    check(`${scene.id}: reload does not replay talk/support or grant help`, target(reloaded).supportRequested === target(atOverlay).supportRequested && target(reloaded).bond === target(atOverlay).bond && target(reloaded).memory.helpedByPlayer === target(atOverlay).memory.helpedByPlayer && equal(reloaded.worldMeta.replay.commands.filter(c => c.type === 'npc.interact'), atOverlay.worldMeta.replay.commands.filter(c => c.type === 'npc.interact')));
    if (!scene.paid) {
      await hoverOriginal(); await page.keyboard.press('e'); result.afterReloadTalkToast = await visibleToast('after-reload-first-talk', true); check(`${scene.id}: refreshed talk is authored free first talk, not armed support`, result.afterReloadTalkToast === `${publicName}：${expectedText(target(reloaded))} 再次按 E 或点击确认请求支援`); const fresh = await waitEvent('npc.dialogueOpened', reloaded.worldMeta.eventSeq, 'after-reload-free-talk'); typed(reloaded, fresh, 'npc.dialogueOpened', 'dialogue-open', 0, 0); check(`${scene.id}: refreshed first talk still not supported`, !target(fresh).supportRequested && target(fresh).memory.helpedByPlayer === target(reloaded).memory.helpedByPlayer);
    }
    const terminal = await saved('terminal'); result.terminal = { day: terminal.day, hour: terminal.hour, minute: terminal.minute, energy: terminal.energy, npc: target(terminal) }; await page.screenshot({ path: path.join(out, `${scene.id}-terminal.png`), timeout: remaining() });
    await Promise.all(pendingHTTP); check(`${scene.id}: all actual main response bodies match frozen HTML`, report.allMainDocuments.filter(d => d.scene === scene.id).length >= 2 && report.allMainDocuments.filter(d => d.scene === scene.id).every(d => d.sha256 === sourceHash && d.status === 200)); result.verified = true; await context.close();
  }
} catch (error) {
  console.error(error.stack || String(error)); report.errors.push({ type: 'runner', message: error.message || String(error) });
  for (let i = 0; i < contexts.length; i++) for (const page of contexts[i].pages()) if (!page.isClosed()) try { await page.screenshot({ path: path.join(out, `failure-${i}.png`), timeout: 5000 }); } catch (e) { report.errors.push({ type: 'failure-screenshot', message: e.message }); }
} finally {
  await Promise.all(pendingHTTP); let contextsClosed = true;
  for (const context of contexts) await context.close().catch(e => { contextsClosed = false; report.errors.push({ type: 'context-close', message: e.message }); });
  if (browser) await browser.close().catch(e => report.errors.push({ type: 'browser-close', message: e.message }));
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  report.cleanup = { contextsClosed, browserClosed: !browser || !browser.isConnected(), httpServerClosed: !server?.listening };
  report.elapsedWallMs = Date.now() - startedAt; report.count = report.checks.length; report.passed = report.checks.filter(c => c.ok).length;
  report.ok = report.errors.length === 0 && report.count === report.passed && report.scenes.length === specs.length && report.scenes.every(s => s.verified) && Object.values(report.cleanup).every(Boolean);
  const walk = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name), prefix + e.name + '/') : [prefix + e.name]);
  report.artifacts = walk(out).filter(file => file !== 'report.json').sort().map(file => { const bytes = read(path.join(out, file)); return { file, bytes: bytes.length, sha256: sha(bytes) }; });
  write('report.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ ok: report.ok, count: report.count, passed: report.passed, sourceHtmlSha256: sourceHash, runnerSha256: report.runnerSha256, scenes: report.scenes.map(s => ({ id: s.id, verified: s.verified })), errors: report.errors, cleanup: report.cleanup }, null, 2));
}
if (!report.ok) process.exitCode = 1;
