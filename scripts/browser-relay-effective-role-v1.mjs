import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// This runner imports no VM adapter and calls no game action from evaluate().
// Complete native input is installed once, before the real loader. Thereafter
// only visible Continue/terminal controls, actual timers, storage reads and a
// real reload are used. No navigation, simulation, resource or actor injection.
const known = new Set(['--html', '--expect-html-sha256', '--io', '--actor-sprites', '--out', '--input-manifest', '--expect-input-manifest-sha256', '--playwright-module', '--chrome-executable', '--budget-seconds', '--case']);
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  assert.ok(known.has(process.argv[i]) && process.argv[i + 1], 'known flag/value pairs required');
  assert.ok(!Object.hasOwn(args, process.argv[i]), 'duplicate flag');
  args[process.argv[i]] = process.argv[i + 1];
}
for (const key of ['--html', '--io', '--actor-sprites', '--out', '--input-manifest', '--playwright-module', '--chrome-executable']) assert.ok(path.isAbsolute(args[key] || ''), `${key} must be absolute`);
for (const key of ['--expect-html-sha256', '--expect-input-manifest-sha256']) assert.match(args[key] || '', /^[a-f0-9]{64}$/);
assert.equal(existsSync(args['--out']), false, 'fresh output required; never overwrite old rounds');
const out = args['--out']; mkdirSync(out, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => readFileSync(file);
const write = (file, value) => { const target = path.join(out, file); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, value); };
const json = (file, value) => write(file, JSON.stringify(value, null, 2) + '\n');
const payload = raw => { const value = JSON.parse(raw); return value.payload || value; };
const minute = p => (p.day - 1) * 1440 + p.hour * 60 + p.minute;
const equal = (a, b) => { try { assert.deepStrictEqual(a, b); return true; } catch { return false; } };
const roles = ['radio', 'carpenter', 'quartermaster'];
const rosterRoles = p => p.npcs.map(n => ({ id: n.id, actingRole: n.actingRole, actingFor: n.actingFor, ...(Object.hasOwn(n, 'contentJob') ? { contentJob: n.contentJob } : {}) }));
const projectBalance = p => ({ materialProgress: p.relayProject.materialProgress, materialClock: p.relayProject.materialClock, workMinutes: p.relayProject.workMinutes });
const projectEvents = p => (p.worldMeta.events || []).filter(e => /^relay\./.test(e.type));
const progressEvents = new Set(['relay.constructionStarted', 'relay.materialsGathered', 'relay.materialsCommitted', 'relay.stationOnline']);
const source = read(args['--html']), sprites = read(args['--actor-sprites']), io = read(args['--io']), runner = read(fileURLToPath(import.meta.url));
const manifestBytes = read(args['--input-manifest']), sourceHash = sha(source);
const startedAt = Date.now(), budgetSeconds = Number(args['--budget-seconds'] || 180);
assert.ok(Number.isInteger(budgetSeconds) && budgetSeconds >= 60 && budgetSeconds <= 300);
const deadline = startedAt + budgetSeconds * 1000;
const remaining = (cap = 12000) => { const n = deadline - Date.now(); assert.ok(n > 0, 'overall browser budget exhausted'); return Math.max(1, Math.min(n, cap)); };
const report = {
  schema: 'RelayRoleBrowserV1', runner: 'browser-relay-effective-role-v1', runnerSha256: sha(runner), sourceHtmlSha256: sourceHash,
  inputManifestSha256: sha(manifestBytes), mode: 'TEST-ONLY complete source-native preboot fixtures; real public Chrome controls',
  naturalGameplay: false, humanExperience: false, foodCausality: false, fullNpcRoleUnification: false,
  gameStateMutationAfterBoot: false, hiddenGameActionsAfterBoot: false, forceClicks: false, navigationFromSave: false,
  independentNativeValidatorExecuted: false, ioDependencyExecuted: false, budgetSeconds,
  parameters: { html: 'artifact:source.html', io: 'artifact:io-dependency.mjs', actorSprites: 'artifact:actor-sprites.js', inputManifest: 'artifact:inputs/manifest.json', out: 'artifact:./', playwrightModule: 'explicit installed module (private path omitted)', chromeExecutable: 'explicit executable (private path omitted)' },
  scope: { publicSurfaces: 'Continue; relay button or public Build tab; desktop/390 screenshot; automatic save; real reload and new timer tick', normalSaveBeforePagehideRequired: true, sourceProducerValidationSeparate: true, noLongConstructionCompletionClaim: true, noNaturalSuccessionClaim: true },
  checks: [], errors: [], scenes: [], allMainDocuments: [], cleanup: {}, artifacts: []
};
function check(name, ok, detail) { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); }
class RiskStop extends Error { constructor(reason, evidence) { super(reason); this.name = 'RiskStop'; this.evidence = evidence; } }
let browser, server; const contexts = [], httpPending = [];
try {
  check('exact released source and input-manifest hashes', sourceHash === args['--expect-html-sha256'] && sha(manifestBytes) === args['--expect-input-manifest-sha256']);
  if (process.platform === 'win32') {
    const sid = execFileSync('whoami', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true }).match(/S-1-[0-9-]+/)?.[0]; assert.ok(sid);
    execFileSync('icacls', [out, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true });
    const escaped = out.replaceAll("'", "''");
    const ps = `$a=[System.IO.Directory]::GetAccessControl('${escaped}'); [pscustomobject]@{protected=$a.AreAccessRulesProtected;rules=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]) | ForEach-Object {[pscustomobject]@{sid=$_.IdentityReference.Value;rights=[string]$_.FileSystemRights;type=[string]$_.AccessControlType;inherited=$_.IsInherited}})} | ConvertTo-Json -Compress -Depth 5`;
    const acl = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', windowsHide: true }));
    check('fresh private output ACL verified', acl.protected && acl.rules.length > 0 && acl.rules.every(r => r.sid === sid && r.type === 'Allow' && r.rights.includes('FullControl') && !r.inherited));
  }
  write('source.html', source); write('actor-sprites.js', sprites); write('io-dependency.mjs', io); write('runner-executed.mjs', runner); write('inputs/manifest.json', manifestBytes);
  report.dependencies = [{ file: 'source.html', sha256: sourceHash, bytes: source.length }, { file: 'actor-sprites.js', sha256: sha(sprites), bytes: sprites.length }, { file: 'io-dependency.mjs', sha256: sha(io), bytes: io.length, executed: false }];
  // serializeNpc does not persist author-facing labels. Read the fixed authored
  // string literals, without eval/VM, only for ID/name/role presentation checks.
  // Expected role -> actor bindings remain the independent producer oracle.
  const sourceText = source.toString('utf8'), templateStart = sourceText.indexOf('const NPC_TEMPLATES = Object.freeze({');
  const templateEnd = sourceText.indexOf('\n    });', templateStart);
  check('authored NPC label block is uniquely located without executing source', templateStart >= 0 && templateEnd > templateStart && sourceText.indexOf('const NPC_TEMPLATES = Object.freeze({', templateStart + 1) < 0);
  const labelBlock = sourceText.slice(templateStart, templateEnd);
  const authoredLabels = {};
  for (const match of labelBlock.matchAll(/^\s*([A-Za-z][A-Za-z0-9_-]*): \{ id: '([^']+)', name: '([^']+)', role: '([^']+)'/gm)) {
    assert.equal(match[1], match[2]); assert.ok(!Object.hasOwn(authoredLabels, match[1]));
    authoredLabels[match[1]] = { id: match[2], name: match[3], role: match[4] };
  }
  check('fixed three role labels exist in authored source', roles.every(role => authoredLabels[role]?.name && authoredLabels[role]?.role));
  json('authored-npc-labels.json', { sourceHtmlSha256: sourceHash, method: 'Static authored string literals only; no runtime Gate or model execution', blockSha256: sha(labelBlock), labels: authoredLabels });
  const manifest = JSON.parse(manifestBytes.toString('utf8')), inputRoot = path.dirname(args['--input-manifest']);
  check('producer declares exact source and controlled non-natural input', manifest.schema === 'RelayRoleBrowserSourceInputManifestV1' && manifest.sourceHtmlSha256 === sourceHash && manifest.naturalGameplay === false && typeof manifest.method === 'string' && manifest.method.startsWith('TEST-ONLY'));
  assert.ok(Array.isArray(manifest.scenes) && manifest.scenes.length >= 4 && manifest.scenes.length <= 5);
  check('four required scene identities are declared once', ['normal-briefed', 'missing-quartermaster', 'restored', 'invalid-config'].every(id => manifest.scenes.filter(s => s.id === id).length === 1) && new Set(manifest.scenes.map(s => s.id)).size === manifest.scenes.length && manifest.scenes.every(s => ['normal-briefed', 'missing-quartermaster', 'restored', 'invalid-config', 'old-online'].includes(s.id)));
  const safeInput = file => { assert.ok(typeof file === 'string' && file && !path.isAbsolute(file) && !file.split(/[\\/]/).includes('..')); const p = path.resolve(inputRoot, file); assert.ok(p.startsWith(path.resolve(inputRoot) + path.sep)); return p; };
  const inputReferences = {};
  for (const key of ['originalWriter', 'ancestryOriginalA', 'ancestryHandoffProvenance', 'sourceCheckerProof']) {
    const ref = manifest[key]; assert.ok(ref?.file && ref.sha256, `explicit ${key} reference`);
    const bytes = read(safeInput(ref.file));
    check(`${key}: original complete input or proof bytes match producer SHA`, sha(bytes) === ref.sha256 && (ref.bytes === undefined || ref.bytes === bytes.length));
    write(`inputs/${ref.file}`, bytes); inputReferences[key] = { ...ref, artifact: `inputs/${ref.file}` };
  }
  const proof = JSON.parse(read(safeInput(manifest.sourceCheckerProof.file)).toString('utf8'));
  check('source-native validator proof is separately bound to exact released source and method', proof.sourceHash === sourceHash && proof.runnerSha256 === manifest.sourceCheckerRunnerSha256 && proof.ok === true && equal({ ok: proof.ok, count: proof.count, passed: proof.passed }, manifest.sourceCheckerResult));
  report.producerValidation = { method: 'Existing source producer report read only; not executed by this browser runner', ...inputReferences.sourceCheckerProof, sourceHash: proof.sourceHash, runnerSha256: proof.runnerSha256, ok: proof.ok, count: proof.count, passed: proof.passed };
  report.inputAncestry = inputReferences;
  const match = source.toString('utf8').match(/const SAVE_KEY = '([^']+)'/); assert.ok(match, 'actual source save-key declaration'); const saveKey = match[1];
  const inputs = manifest.scenes.map(scene => {
    const bytes = read(safeInput(scene.file)); check(`${scene.id}: exact complete source-native bytes`, sha(bytes) === scene.sha256 && bytes.length === scene.bytes); write(`inputs/${scene.file}`, bytes);
    const p = payload(bytes.toString('utf8'));
    check(`${scene.id}: running clock and explicit derived input provenance`, p.worldMeta.clock.rate === 1 && p.worldMeta.clock.paused === false && Array.isArray(scene.changes) && scene.expected?.status === p.relayProject.status);
    check(`${scene.id}: explicit fixed-role binding oracle`, scene.expected.bindings && equal(Object.keys(scene.expected.bindings).sort(), [...roles].sort()) && roles.every(role => scene.expected.bindings[role] === null || typeof scene.expected.bindings[role] === 'string'));
    check(`${scene.id}: expected IDs exist once and their public names come from authored source`, roles.every(role => { const id = scene.expected.bindings[role]; return id === null || p.npcs.filter(n => n.id === id).length === 1 && !!authoredLabels[id]?.name; }));
    check(`${scene.id}: producer retained roster living count actual five enemies and original handoff fact`, p.npcs.length === scene.expected.npcRosterCount && p.npcs.filter(n => n.lifeState !== 'dead').length === scene.expected.livingNpcCount && equal(p.worldZombies.map(e => e.id), scene.expected.enemyIds) && p.relayProject.handoffAt === scene.expected.handoffAt && equal(p.relayProject.materialProgress, scene.expected.materialProgress) && p.relayProject.workMinutes === scene.expected.workMinutes && scene.actualSourceWriterAndValidator === true);
    assert.ok(p.worldMeta?.events && p.worldMeta?.replay?.commands && Array.isArray(p.npcs), 'complete native payload required');
    return { ...scene, raw: bytes.toString('utf8'), payload: p };
  });
  const selected = args['--case'] ? inputs.filter(s => s.id === args['--case']) : inputs; assert.ok(selected.length > 0, 'declared case selector');
  report.declaredSceneCount = selected.length; report.producerMethod = manifest.method;
  server = createServer((req, res) => { const pathname = new URL(req.url, 'http://fixture').pathname; if (['/', '/index.html'].includes(pathname)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(source); } else if (pathname === '/actor-sprites.js') { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); res.end(sprites); } else { res.writeHead(404); res.end(); } });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const modulePath = args['--playwright-module'];
  const pw = statSync(modulePath).isDirectory() ? createRequire(import.meta.url)(modulePath) : await import(pathToFileURL(modulePath).href);
  const chromium = pw.chromium || pw.default?.chromium; assert.ok(chromium?.launch, 'actual Playwright chromium module');
  browser = await chromium.launch({ headless: true, executablePath: args['--chrome-executable'], timeout: remaining(30000) }); report.browserVersion = browser.version();
  for (const input of selected) {
    const result = { id: input.id, inputSha256: sha(input.raw), expected: input.expected, changes: input.changes, status: 'STARTED', verified: false, actions: [], observations: [], nativeArtifacts: [], refreshCovered: false };
    report.scenes.push(result); let context, page, lastLiveHp;
    try {
      context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(context);
      await context.addInitScript(({ key, raw, id, inputHash }) => { const marker = 'qa-relay-role-preboot-v1'; if (!sessionStorage.getItem(marker)) { localStorage.setItem(key, raw); sessionStorage.setItem(marker, JSON.stringify({ id, inputHash, seedCount: 1 })); } }, { key: saveKey, raw: input.raw, id: input.id, inputHash: sha(input.raw) });
      page = await context.newPage(); page.setDefaultTimeout(remaining(8000));
      page.on('pageerror', e => report.errors.push({ scene: input.id, type: 'pageerror', message: e.message }));
      let documentSequence = 0;
      page.on('response', response => { if (response.request().resourceType() === 'document' && response.frame() === page.mainFrame()) httpPending.push((async () => { const bytes = await response.body(), hash = sha(bytes); const row = { scene: input.id, sequence: ++documentSequence, status: response.status(), sha256: hash, path: new URL(response.url()).pathname }; if (hash === sourceHash) row.bodyArtifact = 'source.html'; else { row.bodyArtifact = `${input.id}-unexpected-main-${documentSequence}.html`; write(row.bodyArtifact, bytes); } report.allMainDocuments.push(row); })().catch(e => report.errors.push({ scene: input.id, type: 'main-response', message: e.message }))); });
      async function publicSample() {
        return page.evaluate(() => { const context = document.getElementById('contextPanel'), style = context && getComputedStyle(context); return { hp: Number(document.getElementById('hpValue')?.textContent), day: document.getElementById('dayLabel')?.textContent || '', time: document.getElementById('timeLabel')?.textContent || '', startOverlay: !document.getElementById('startOverlay')?.classList.contains('hidden'), context: context?.innerText || '', contextVisible: !!context?.getClientRects().length && style.visibility !== 'hidden' && style.display !== 'none', threatEncounter: document.body.classList.contains('threat-map-active'), terminal: document.getElementById('infoModal')?.classList.contains('open') || false }; });
      }
      async function guard(label) {
        const s = await publicSample(); result.observations.push({ label, kind: 'public-safety', ...s });
        // The overlay has only a prepared save, while the HUD can still show
        // the default pre-install world. Do not compare it with live input HP.
        if (s.startOverlay) return s;
        if (!Number.isFinite(s.hp) || s.hp <= 35 || s.threatEncounter || s.contextVisible && /尸潮接触/.test(s.context) || lastLiveHp !== undefined && s.hp < lastLiveHp) throw new RiskStop('public HP loss, contact, encounter or unavailable safety reading; no navigation or compensating action attempted', s);
        lastLiveHp = s.hp; return s;
      }
      async function click(selector, label) { await guard(`before-${label}`); const element = page.locator(selector); check(`${input.id}: ${label} uses a visible enabled public control`, await element.isVisible() && await element.isEnabled()); await element.click({ timeout: remaining(8000) }); result.actions.push({ label, selector, kind: 'public-control' }); await guard(`after-${label}`); }
      async function native(label) {
        const raw = await page.evaluate(key => localStorage.getItem(key), saveKey); assert.ok(raw); const p = payload(raw), file = `${input.id}-${label}-native.json`; write(file, raw); result.nativeArtifacts.push({ label, file, sha256: sha(raw), bytes: Buffer.byteLength(raw), minute: minute(p), reason: JSON.parse(raw).reason || null }); return { raw, p };
      }
      function assertBindingsPreserved(p, label) { check(`${input.id}: ${label} does not rewrite IDs acting roles or content jobs`, equal(rosterRoles(p), rosterRoles(input.payload))); check(`${input.id}: ${label} preserves declared role-slot array and historical handoff identity`, equal(p.relayProject.assignedNpcIds, input.payload.relayProject.assignedNpcIds) && p.relayProject.id === input.payload.relayProject.id && p.relayProject.coreItemId === input.payload.relayProject.coreItemId && p.relayProject.handoffAt === input.payload.relayProject.handoffAt); }
      function assertProgress(p, label) {
        const blocked = input.expected.blockedReason != null;
        if (blocked) {
          check(`${input.id}: ${label} blocked project gains no material clock material or work credit`, equal(projectBalance(p), projectBalance(input.payload)));
          const previous = new Set(projectEvents(input.payload).map(e => e.eventId));
          check(`${input.id}: ${label} no new successful project progression receipt`, !projectEvents(p).some(e => !previous.has(e.eventId) && progressEvents.has(e.type)));
        }
        const events = projectEvents(p); check(`${input.id}: ${label} retained project event identities remain unique`, new Set(events.map(e => e.eventId)).size === events.length);
        check(`${input.id}: ${label} no new online reward in this short observation`, !projectEvents(p).some(e => e.seq > input.payload.worldMeta.eventSeq && e.type === 'relay.stationOnline'));
      }
      async function automaticSave(afterMinute, afterSeq, label) {
        const until = Date.now() + remaining(18000);
        while (Date.now() < until) {
          await guard(`wait-${label}`);
          const probe = await page.evaluate(({ key, after }) => { const raw = localStorage.getItem(key); if (!raw) return null; const v = JSON.parse(raw), p = v.payload || v; return { minute: (p.day - 1) * 1440 + p.hour * 60 + p.minute, reason: v.reason || p.worldMeta?.lastCheckpointReason || null, hasNewTick: p.worldMeta?.events?.some(e => e.type === 'time.advanced' && e.seq > after), clock: p.worldMeta?.clock }; }, { key: saveKey, after: afterSeq });
          if (probe?.minute > afterMinute && probe.hasNewTick && probe.reason !== 'pagehide') { const saved = await native(label); check(`${input.id}: ${label} real running clock normal save before pagehide`, saved.p.worldMeta.clock.rate === 1 && saved.p.worldMeta.clock.paused === false && minute(saved.p) > afterMinute); check(`${input.id}: ${label} new actual clock event joins its world advance command`, saved.p.worldMeta.events.some(e => e.type === 'time.advanced' && e.seq > afterSeq && saved.p.worldMeta.replay.commands.some(c => c.commandId === e.commandId && c.type === 'world.advance' && c.payload?.minutes === e.payload?.minutes && e.payload.minutes > 0))); return saved; }
          await page.waitForTimeout(Math.min(150, remaining(1000)));
        }
        assert.fail('no automatic new-minute native checkpoint within bounded observation; pagehide is not a substitute');
      }
      async function openPanel(label) {
        if (await page.locator('#relayToggle').isVisible()) await click('#relayToggle', `${label}-relay-toggle`);
        else { await click('#openInfoBtn', `${label}-terminal`); await click('[data-info-tab="build"]', `${label}-build-tab`); }
        await page.locator('#relayCrewText').waitFor({ state: 'visible', timeout: remaining(8000) });
      }
      async function panelEvidence(label) {
        await guard(`before-${label}`); const crew = page.locator('#relayCrewText'); await crew.scrollIntoViewIfNeeded({ timeout: remaining(5000) });
        const state = await page.evaluate(() => {
          const ids = ['relayStatusText', 'relayTaskText', 'relayCrewText', 'relayMaterials'];
          return { viewport: { width: innerWidth, height: innerHeight }, fields: Object.fromEntries(ids.map(id => { const e = document.getElementById(id), r = e?.getBoundingClientRect(), c = e && getComputedStyle(e); return [id, { text: e?.innerText || '', visible: !!e && c.visibility !== 'hidden' && c.display !== 'none' && !!r?.width && !!r?.height, width: r?.width || 0, x: r?.x || 0, scrollWidth: e?.scrollWidth || 0, clientWidth: e?.clientWidth || 0 }]; })) };
        });
        result.observations.push({ label, kind: 'public-relay-panel', ...state }); json(`${input.id}-${label}-public.json`, state);
        const text = Object.values(state.fields).map(f => f.text).join('\n'), crewText = state.fields.relayCrewText.text;
        check(`${input.id}: ${label} actual public crew task and status are visible`, ['relayCrewText', 'relayTaskText', 'relayStatusText'].every(id => state.fields[id].visible));
        check(`${input.id}: ${label} places the actual same-ID name beside its correct role`, roles.every(role => { const id = input.expected.bindings[role]; return id === null || crewText.includes(`${authoredLabels[role].role}：${authoredLabels[id].name}`); }));
        if (input.expected.blockedReason != null) {
          check(`${input.id}: ${label} public explanation says project is blocked`, /暂停|停工|缺岗|缺少岗位|配置.*无效|配置.*不完整|绑定.*不明|岗位.*冲突/.test(text));
          if (input.id === 'missing-quartermaster') check(`${input.id}: ${label} names the actual missing logistics role`, /后勤/.test(text) && /缺岗|缺席|缺少|不可用/.test(text));
          if (input.id === 'invalid-config') check(`${input.id}: ${label} distinguishes invalid configuration from normal waiting`, /配置|重复|绑定.*不明|岗位.*冲突/.test(text));
        } else if (input.id !== 'old-online') check(`${input.id}: ${label} complete crew is not described as missing`, !/缺岗|缺少岗位|岗位.*冲突|绑定.*不明/.test(`${state.fields.relayTaskText.text}\n${crewText}`));
        check(`${input.id}: ${label} readable crew remains within horizontal viewport without overflow`, state.fields.relayCrewText.x >= -1 && state.fields.relayCrewText.x + state.fields.relayCrewText.width <= state.viewport.width + 1 && state.fields.relayCrewText.scrollWidth <= state.fields.relayCrewText.clientWidth + 1);
        await page.screenshot({ path: path.join(out, `${input.id}-${label}.png`), timeout: remaining(5000) }); await guard(`after-${label}`);
      }
      const initialResponse = await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded', timeout: remaining(15000) });
      check(`${input.id}: first main HTTP is exact frozen source`, initialResponse?.ok() && sha(await initialResponse.body()) === sourceHash);
      const before = await native('before-public-continue'); check(`${input.id}: native installed only before original loader`, before.raw === input.raw);
      await click('#continueSaveBtn', 'continue'); await page.waitForFunction(() => document.getElementById('startOverlay')?.classList.contains('hidden'), {}, { timeout: remaining(8000) }); lastLiveHp = undefined; await guard('first-live-day');
      await openPanel('initial'); await panelEvidence('desktop');
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(Math.min(300, remaining(1000))); await panelEvidence('mobile-390');
      await page.setViewportSize({ width: 1440, height: 1000 }); await page.waitForTimeout(Math.min(300, remaining(1000)));
      const saved = await automaticSave(minute(input.payload), input.payload.worldMeta.eventSeq, 'normal-save-before-reload'); assertBindingsPreserved(saved.p, 'normal save'); assertProgress(saved.p, 'normal save');
      const reloadResponse = await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining(15000) });
      check(`${input.id}: reload main HTTP is exact frozen source`, reloadResponse?.ok() && sha(await reloadResponse.body()) === sourceHash);
      const overlay = await native('real-pagehide-reload-input'); assertBindingsPreserved(overlay.p, 'pagehide'); assertProgress(overlay.p, 'pagehide');
      const marker = await page.evaluate(() => JSON.parse(sessionStorage.getItem('qa-relay-role-preboot-v1')));
      check(`${input.id}: reload does not re-seed original fixture`, marker.seedCount === 1 && marker.id === input.id && marker.inputHash === sha(input.raw) && minute(overlay.p) >= minute(saved.p) && overlay.raw !== input.raw);
      // The start overlay has not installed a live world; use its actual saved
      // payload, not the page's default pre-install world, for this comparison.
      lastLiveHp = undefined; await click('#continueSaveBtn', 'continue-after-reload'); await page.waitForFunction(() => document.getElementById('startOverlay')?.classList.contains('hidden'), {}, { timeout: remaining(8000) }); lastLiveHp = undefined; await guard('resumed-live-day');
      await openPanel('reloaded'); await panelEvidence('reloaded-desktop');
      const resumed = await automaticSave(minute(overlay.p), overlay.p.worldMeta.eventSeq, 'normal-save-after-reload'); assertBindingsPreserved(resumed.p, 'new post-reload tick'); assertProgress(resumed.p, 'new post-reload tick');
      check(`${input.id}: no repeated start or handoff on refresh`, !projectEvents(resumed.p).some(e => e.seq > saved.p.worldMeta.eventSeq && ['relay.coreHandedOff', 'relay.constructionStarted'].includes(e.type)));
      result.refreshCovered = true; result.verified = true; result.status = 'VERIFIED';
    } catch (error) {
      if (error instanceof RiskStop) { result.status = 'INTERRUPTED_RISK'; result.stop = { reason: error.message, evidence: error.evidence }; }
      else { result.status = 'FAILED'; result.error = error.message || String(error); report.errors.push({ scene: input.id, type: 'scene', message: result.error }); console.error(error.stack || String(error)); }
      // One bounded read, then close. No slow safety screenshots or continued
      // input at risk, no page-side save action and no retry of a failed case.
      if (page && !page.isClosed()) try { const terminal = await page.evaluate(key => ({ raw: localStorage.getItem(key), hp: document.getElementById('hpValue')?.textContent, time: document.getElementById('timeLabel')?.textContent }), saveKey); if (terminal.raw) { write(`${input.id}-stop-latest-durable.json`, terminal.raw); terminal.raw = { file: `${input.id}-stop-latest-durable.json`, sha256: sha(terminal.raw) }; } json(`${input.id}-stop-public.json`, terminal); } catch { result.stopEvidenceUnavailable = true; }
    } finally { if (context) { await context.close(); result.contextClosed = true; } }
  }
} catch (error) { console.error(error.stack || String(error)); report.errors.push({ type: 'setup-or-runner', message: error.message || String(error) }); }
finally {
  let contextsClosed = true; for (const context of contexts) await context.close().catch(e => { contextsClosed = false; report.errors.push({ type: 'context-close', message: e.message }); });
  await Promise.all(httpPending);
  if (browser) await browser.close().catch(e => report.errors.push({ type: 'browser-close', message: e.message }));
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  report.cleanup = { contextsClosed, browserClosed: !browser || !browser.isConnected(), httpServerClosed: !server?.listening };
  report.elapsedWallMs = Date.now() - startedAt;
  report.count = report.checks.length; report.passed = report.checks.filter(c => c.ok).length;
  const documentsExact = report.allMainDocuments.length > 0 && report.allMainDocuments.every(d => d.sha256 === sourceHash && d.status === 200);
  report.ok = report.errors.length === 0 && report.count === report.passed && report.scenes.length === report.declaredSceneCount && report.scenes.every(s => s.verified && s.refreshCovered && s.contextClosed) && documentsExact && Object.values(report.cleanup).every(Boolean);
  report.status = report.ok ? 'VERIFIED' : report.scenes.some(s => s.status === 'INTERRUPTED_RISK') && !report.errors.length ? 'INTERRUPTED_RISK' : 'FAILED';
  const walk = (directory, prefix = '') => readdirSync(directory, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(directory, e.name), prefix + e.name + '/') : [prefix + e.name]);
  report.artifacts = walk(out).filter(f => f !== 'report.json').sort().map(file => { const bytes = read(path.join(out, file)); return { file, bytes: bytes.length, sha256: sha(bytes) }; });
  json('report.json', report);
  console.log(JSON.stringify({ runner: report.runner, runnerSha256: report.runnerSha256, sourceHtmlSha256: sourceHash, status: report.status, ok: report.ok, count: report.count, passed: report.passed, scenes: report.scenes.map(s => ({ id: s.id, status: s.status, refreshCovered: s.refreshCovered })), cleanup: report.cleanup, reportSha256: sha(read(path.join(out, 'report.json'))) }));
}
if (!report.ok) process.exitCode = 1;
