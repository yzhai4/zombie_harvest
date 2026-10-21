import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { root, saveKey, sourceRuntimeFactory } from './lib/source-runtime-fixture.mjs';

// TEST-ONLY: immutable actual source-writer inputs from the paired v1 experiment.
// Seed once before boot; after boot use public controls and read DOM/storage only.
// No live GameState changes, hidden actions, fake time/visibility, or force clicks.
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  assert.ok(['--html', '--baseline-report', '--out', '--expect-html-sha256'].includes(process.argv[i]) && process.argv[i + 1] && !options[process.argv[i]], 'usage: --html ABS --baseline-report ABS --out NEW_ABS --expect-html-sha256 SHA');
  options[process.argv[i]] = process.argv[i + 1];
}
for (const key of ['--html','--baseline-report','--out']) assert.ok(path.isAbsolute(options[key] || ''), key + ' absolute path required');
assert.match(options['--expect-html-sha256'] || '', /^[a-f0-9]{64}$/);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const htmlBytes = readFileSync(options['--html']), sourceHash = sha(htmlBytes);
assert.equal(sourceHash, options['--expect-html-sha256']);
const runnerBytes = readFileSync(fileURLToPath(import.meta.url));
const baselineBytes = readFileSync(options['--baseline-report']), baseline = JSON.parse(baselineBytes);
assert.equal(baseline.runner, 'source-food-shortage-strategies-v1');
assert.equal(baseline.sourceHtmlSha256, '32f911f69a6a962ae69a0325afcffd1c5d6d923c0efe1fb0ca8787c1959d9fae');
assert.equal(baseline.artifacts.length, 17, 'bind the original seventeen source writer/input artifacts');
const out = options['--out'];
assert.equal(existsSync(out), false, 'new output directory required; preserve original failures');
mkdirSync(out, { recursive: true });
let privateOutput = { aclVerified: false, platform: process.platform };
if (process.platform === 'win32') {
  const who = execFileSync('whoami', ['/user','/fo','csv','/nh'], { encoding: 'utf8', windowsHide: true });
  const sid = who.match(/S-1-[0-9-]+/)?.[0]; assert.ok(sid);
  execFileSync('icacls', [out, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true });
  const escaped = out.replaceAll("'", "''");
  const command = `$a=[System.IO.Directory]::GetAccessControl('${escaped}'); [pscustomobject]@{protected=$a.AreAccessRulesProtected;rules=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]) | ForEach-Object { [pscustomobject]@{sid=$_.IdentityReference.Value;rights=[string]$_.FileSystemRights;type=[string]$_.AccessControlType;inherited=$_.IsInherited} })} | ConvertTo-Json -Compress -Depth 5`;
  const acl = JSON.parse(execFileSync('powershell.exe', ['-NoProfile','-NonInteractive','-Command',command], { encoding: 'utf8', windowsHide: true }));
  assert.equal(acl.protected, true);
  assert.ok(acl.rules.length > 0 && acl.rules.every(rule => rule.sid === sid && rule.type === 'Allow' && rule.rights.includes('FullControl') && !rule.inherited));
  privateOutput = { aclVerified: true, platform: 'win32', inheritanceDisabled: true, allowedPrincipal: 'current-user-only' };
}
const id = 'zh-food-shortage-001', cacheFlag = 'zh-shortage-cache-retrieved';
const helperBytes = readFileSync(path.join(root, 'scripts/lib/source-runtime-fixture.mjs'));
const adapterBytes = readFileSync(path.join(root, 'scripts/check-report-recovery.mjs'));
const sprites = readFileSync(path.join(root, 'dist/actor-sprites.js'));
const report = { runner: 'browser-shortage-choice-v2', runnerSha256: sha(runnerBytes), sourceHtmlSha256: sourceHash,
  expectedHtmlSha256: options['--expect-html-sha256'], baselineReportSha256: sha(baselineBytes),
  baselineSourceHtmlSha256: baseline.sourceHtmlSha256, baselineCheckerSha256: baseline.checkerSha256,
  sourceRuntimeHelperSha256: sha(helperBytes), ioAdapterSha256: sha(adapterBytes), actorSpritesSha256: sha(sprites),
  mode: 'original-v1-source-writer-boot-fixtures-public-browser-actions', naturalGameplay: false, naturalGameplayClaim: false,
  balanceValidated: false, productionCapture: false, fixtureInjectionAfterBoot: false, gameStateMutationAfterBoot: false,
  originalWriter: baseline.originalWriter, privateOutput, baselineArtifacts: [], scenes: [], checks: [], errors: [], documentHashes: [], artifacts: [],
  evidenceBoundary: 'three isolated real Chrome boot/reload scenes; exact v1 writer inputs, actual public J/choice actions and native storage; source VM validates saved bytes only; no natural multi-day or production claim' };
const artifact = (name, bytes) => { const file = path.join(out, name); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, bytes); report.artifacts.push({ path: name.replaceAll('\\','/'), sha256: sha(bytes) }); };
for (const [name, bytes] of Object.entries({ 'runner-executed.mjs': runnerBytes, 'source.html': htmlBytes,
  'baseline-report.json': baselineBytes, 'source-runtime-fixture-executed.mjs': helperBytes,
  'io-adapter-source-executed.mjs': adapterBytes, 'actor-sprites.js': sprites })) artifact(name, bytes);
const inputs = new Map();
for (const ref of baseline.artifacts) {
  assert.ok(typeof ref.path === 'string' && !path.isAbsolute(ref.path) && !ref.path.split(/[\\/]/).includes('..'));
  const bytes = readFileSync(path.resolve(path.dirname(options['--baseline-report']), ref.path));
  assert.equal(sha(bytes), ref.sha256, 'original baseline artifact binding: ' + ref.name);
  artifact('baseline-inputs/' + path.basename(ref.path), bytes);
  report.baselineArtifacts.push({ name: ref.name, originalPath: ref.path, sha256: ref.sha256, kind: ref.kind });
  inputs.set(ref.name, { bytes, payload: JSON.parse(bytes).payload, sha256: ref.sha256 });
}
const factory = sourceRuntimeFactory(options['--html']), validator = factory();
const clone = value => JSON.parse(JSON.stringify(value));
const minute = p => (p.day - 1) * 1440 + p.hour * 60 + p.minute;
function check(name, ok, detail) { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); }
const chainEvents = (p, type, instanceKey) => p.worldMeta.events.filter(e => e.type === type && e.defId === id && (!instanceKey || e.payload?.instanceKey === instanceKey));
const migrations = p => p.worldMeta.events.filter(e => e.type === 'save.migrated' && e.payload.contentDefinitionAdapters?.some(a => a.chainId === id));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const { chromium } = createRequire(import.meta.url)(process.env.ZH_PLAYWRIGHT_MODULE || 'playwright');
const server = createServer((req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route === '/' || route === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(htmlBytes); }
  else if (route === '/actor-sprites.js') { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); res.end(sprites); }
  else { res.writeHead(404); res.end(); }
});
let browser; const contexts = [];
async function boot(name, inputName) {
  const input = inputs.get(inputName); assert.ok(input?.payload);
  const scene = { name, inputName, inputSha256: input.sha256, status: 'running', ok: null }; report.scenes.push(scene);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(context);
  await context.addInitScript(({ key, raw }) => {
    if (!sessionStorage.getItem('qa-shortage-v2-seeded')) { localStorage.clear(); localStorage.setItem(key, raw); sessionStorage.setItem('qa-shortage-v2-seeded', 'yes'); }
  }, { key: saveKey, raw: input.bytes.toString('utf8') });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push({ scene: name, type: 'pageerror', message: error.message }));
  const document = async response => { assert.ok(response?.ok()); const hash = sha(await response.body()); report.documentHashes.push({ scene: name, sha256: hash }); check(`${name}: actual main document matches frozen candidate`, hash === sourceHash); };
  const rawSaved = () => page.evaluate(key => localStorage.getItem(key), saveKey);
  const saved = async () => JSON.parse(await rawSaved()).payload;
  const snapshot = async label => { const raw = await rawSaved(); check(`${name}/${label}: native saved bytes validate`, validator.api.validate({ raw, sourceCategory: 'primary' }).ok); artifact(`${name}-${label}-save.json`, Buffer.from(raw)); return JSON.parse(raw).payload; };
  const waitSaved = async (predicate, values = {}) => { await page.waitForFunction(({ key, body, values }) => Function('p','v',`return (${body})(p,v)`)(JSON.parse(localStorage.getItem(key)).payload, values), { key: saveKey, body: predicate.toString(), values }); return saved(); };
  const enter = async () => { await page.locator('#continueSaveBtn').click(); await page.waitForTimeout(800); check(`${name}: public continue enters gameplay`, await page.locator('#continueSaveBtn').isHidden()); };
  const reload = async () => { await document(await page.reload({ waitUntil: 'domcontentloaded' })); await enter(); };
  const openEvents = async () => { await page.keyboard.press('j'); check(`${name}: public J opens visible task/event panel`, await page.locator('#eventText').isVisible()); };
  const selectChain = async () => { await openEvents(); await page.locator('#eventSourceSelect').selectOption('chain:' + id); check(`${name}: current choice and explanation actually visible`, await page.locator('#eventChoiceA').isVisible() && await page.locator('#eventText').isVisible()); };
  const screenshot = async label => { const bytes = await page.screenshot({ fullPage: false }); artifact(`${name}-${label}.png`, bytes); };
  await document(await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' })); await enter();
  return { name, input, scene, context, page, rawSaved, saved, snapshot, waitSaved, reload, openEvents, selectChain, screenshot };
}
async function scenario(name, inputName, body) {
  let b;
  try { b = await boot(name, inputName); await body(b); b.scene.status = 'verified'; b.scene.ok = true; }
  catch (error) { const scene = report.scenes.find(s => s.name === name); if (scene) { scene.status = 'failed'; scene.ok = false; } report.errors.push({ scene: name, type: 'scenario', message: error.stack || String(error) }); if (b) await b.screenshot('failure').catch(() => {}); }
  finally { if (b) await b.context.close().catch(error => report.errors.push({ scene: name, type: 'context-close', message: error.message })); }
}
function proveMigration(name, p, old) {
  const active = p.contentState.activeChains[id], previous = old.contentState.activeChains[id];
  check(`${name}: active v1 migrates to version2`, active?.definitionVersion === 2);
  check(`${name}: original episode identity/time/actor remains`, ['instanceKey','instanceId','defId','nodeId','startedAt','actorId'].every(k => active[k] === previous[k]));
  const receipt = migrations(p);
  check(`${name}: actual native writer records one definition migration`, receipt.length === 1 && receipt[0].payload.contentDefinitionAdapters.some(a => a.chainId === id && a.fromDefinitionVersion === 1 && a.toDefinitionVersion === 2 && a.instanceKey === previous.instanceKey));
}
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, ...(process.env.ZH_BROWSER_CHANNEL ? { channel: process.env.ZH_BROWSER_CHANNEL } : {}) }); report.browserVersion = browser.version();
  await scenario('reserve', 'common-episode-baseline', async b => {
    const before = await b.snapshot('migrated'); proveMigration(b.name, before, b.input.payload);
    check('reserve: migration changes no food or collapse', before.food === b.input.payload.food && before.contentState.meters.campCollapse === b.input.payload.contentState.meters.campCollapse);
    await b.selectChain(); const text = await b.page.locator('#eventText').innerText();
    check('reserve: current food/daily need/next midnight/other consumption visible', text.includes('当前库存 2 份') && text.includes('基础日需 3 份') && text.includes('00:00') && text.includes('个人用餐与据点维护另计'));
    const button = b.page.locator('#eventChoiceA'); check('reserve: actual neutral reserve choice is enabled', await button.isEnabled() && (await button.innerText()).includes('保留备用粮，另行筹粮'));
    const dataset = await button.evaluate(node => ({ ...node.dataset })); check('reserve: public button binds version2 token', dataset.eventDefinitionVersion === '2');
    await b.screenshot('before-choice'); await button.click();
    const after = await b.waitSaved((p,v) => p.contentState.completedChains.includes(v.key) && !p.contentState.activeChains[v.id], { id, key: before.contentState.activeChains[id].instanceKey });
    const resolved = chainEvents(after, 'content.chain.resolved', dataset.eventInstanceKey);
    check('reserve: public click resolves original episode once', resolved.length === 1 && resolved[0].payload.choiceId === 'ration' && resolved[0].definitionVersion === 2);
    check('reserve: no extra collapse, food, cache or resonance award', after.contentState.meters.campCollapse === before.contentState.meters.campCollapse && after.food === before.food && after.contentState.meters.resonancePressure === before.contentState.meters.resonancePressure && !!after.contentState.flags[cacheFlag] === !!before.contentState.flags[cacheFlag]);
    check('reserve: neutral choice effects contain history only', resolved[0].effects.length === 1 && resolved[0].effects[0].op === 'recordHistory');
    const command = after.worldMeta.replay.commands.find(c => c.commandId === resolved[0].causationId);
    check('reserve: actual public replay carries original episode/version2 token', command?.type === 'content.chain.resolve' && command.payload.expectedInstanceKey === dataset.eventInstanceKey && command.payload.expectedDefinitionVersion === 2);
    await b.snapshot('after-choice'); await b.screenshot('recorded'); await b.reload();
    const reloaded = await b.snapshot('reloaded'); check('reserve: reload does not reopen settled episode or repeat migration', reloaded.contentState.completedChains.includes(dataset.eventInstanceKey) && !reloaded.contentState.activeChains[id] && migrations(reloaded).length === 1 && chainEvents(reloaded, 'content.chain.resolved', dataset.eventInstanceKey).length === 1);
    check('reserve: reload preserves neutral result', reloaded.food === after.food && reloaded.contentState.meters.campCollapse === after.contentState.meters.campCollapse && same(reloaded.contentState.appliedEffects, after.contentState.appliedEffects));
    await b.openEvents(); const options = await b.page.locator('#eventSourceSelect option').evaluateAll(nodes => nodes.map(n => n.value)); check('reserve: public menu cannot reselect completed episode', !options.includes('chain:' + id)); await b.screenshot('reloaded');
  });
  await scenario('supplied-forage', 'C-after-real-gather-before-midnight', async b => {
    const before = await b.snapshot('migrated'); proveMigration(b.name, before, b.input.payload); await b.selectChain();
    const text = await b.page.locator('#eventText').innerText(); check('supplied: real gathered food4 and relieved advisory visible', text.includes('当前库存 4 份') && text.includes('当前基础供给已缓解') && text.includes('仍可确认并保留备用粮'));
    const button = b.page.locator('#eventChoiceB'); check('supplied: optional finite cache remains publicly enabled', await button.isVisible() && await button.isEnabled() && (await button.innerText()).includes('整局一次') && (await button.innerText()).includes('共振仪表'));
    const dataset = await button.evaluate(node => ({ ...node.dataset })); await b.screenshot('relieved'); await button.click();
    const after = await b.waitSaved((p,v) => p.contentState.flags[v.flag] === true && p.contentState.completedChains.includes(v.key), { flag: cacheFlag, key: dataset.eventInstanceKey });
    const resolved = chainEvents(after, 'content.chain.resolved', dataset.eventInstanceKey);
    check('supplied: one actual version2 forage resolution', resolved.length === 1 && resolved[0].payload.choiceId === 'forage' && resolved[0].definitionVersion === 2);
    const foodEffect = resolved[0].payload.results.find(r => r.op === 'addResource' && r.key === 'food'), resonance = resolved[0].payload.results.find(r => r.op === 'adjustMeter' && r.key === 'resonancePressure');
    check('supplied: receipts prove gross food+2 and resonance+2', foodEffect?.after - foodEffect?.before === 2 && resonance?.after - resonance?.before === 2);
    const hist = after.contentState.history.find(h => h.id === dataset.eventInstanceKey + ':' + id + ':forage');
    check('supplied: new finite-source history uses resonancePressure without exposure', hist?.payload.sourceId === 'zh-shortage-cache-001' && hist.payload.amount === 2 && hist.payload.resonancePressure === 2 && !Object.hasOwn(hist.payload, 'exposure'));
    check('supplied: forage permanent flag and exactly one award', after.contentState.flags[cacheFlag] === true && after.contentState.appliedEffects.filter(e => e === dataset.eventInstanceKey + ':shortage_choice:forage').length === 1);
    await b.snapshot('after-choice'); await b.screenshot('recorded'); await b.reload(); const reloaded = await b.snapshot('reloaded');
    check('supplied: reload retains cache flag/history and does not award again', reloaded.contentState.flags[cacheFlag] === true && chainEvents(reloaded, 'content.chain.resolved', dataset.eventInstanceKey).length === 1 && same(reloaded.contentState.history, after.contentState.history) && same(reloaded.contentState.appliedEffects, after.contentState.appliedEffects));
    check('supplied: reload does not repeat definition migration', migrations(reloaded).length === 1);
    await b.openEvents(); const active = reloaded.contentState.activeChains[id];
    if (active) { await b.page.locator('#eventSourceSelect').selectOption('chain:' + id); check('supplied: any later legitimate episode cannot grant the used cache', await b.page.locator('#eventChoiceB').isDisabled()); }
    else { const options = await b.page.locator('#eventSourceSelect option').evaluateAll(nodes => nodes.map(n => n.value)); check('supplied: no old completed cache option returns after reload', !options.includes('chain:' + id)); }
    await b.screenshot('reloaded');
  });
  await scenario('historical-ration', 'A-after-action', async b => {
    const initial = b.input.payload, common = inputs.get('common-episode-baseline').payload;
    check('historical: original v1 click actually paid collapse+2', initial.contentState.meters.campCollapse === common.contentState.meters.campCollapse + 2);
    const before = await b.snapshot('loaded');
    for (const key of ['history','appliedEffects','completedChains','flags']) check('historical: boot preserves original ' + key, same(before.contentState[key], initial.contentState[key]));
    check('historical: old collapse+2 and food are not refunded or supplemented', before.contentState.meters.campCollapse === initial.contentState.meters.campCollapse && before.food === initial.food);
    check('historical: no active definition migration is invented for settled v1', migrations(before).length === 0 && !before.contentState.activeChains[id]);
    await b.openEvents(); check('historical: actual public menu has no completed shortage choice', !(await b.page.locator('#eventSourceSelect option').evaluateAll(nodes => nodes.map(n => n.value))).includes('chain:' + id)); await b.screenshot('old-history-loaded');
    await b.reload(); const afterReload = await b.snapshot('reloaded');
    for (const key of ['history','appliedEffects','completedChains','flags']) check('historical: reload preserves original ' + key, same(afterReload.contentState[key], initial.contentState[key]));
    // The ordinary timer checkpoints every ten ticks, plus its 650ms debounce.
    // Wait for actual new saved world time rather than infer a save after 2.5s.
    const later = await b.waitSaved((p,v) => p.world.totalMinutes >= v.minute + 10, { minute: minute(afterReload) });
    check('historical: complete ordinary checkpoint demonstrates real time continues', minute(later) >= minute(afterReload) + 10);
    check('historical: ordinary time does not refund historical click tax', later.contentState.meters.campCollapse === initial.contentState.meters.campCollapse && migrations(later).length === 0);
    for (const key of ['history','appliedEffects','completedChains','flags']) check('historical: natural timer preserves original ' + key, same(later.contentState[key], initial.contentState[key]));
    await b.snapshot('after-natural-checkpoint'); await b.screenshot('reloaded');
  });
} catch (error) { report.errors.push({ type: 'setup', message: error.stack || String(error) }); }
finally {
  let contextsClosed = true, browserClosed = !browser;
  for (const context of contexts) await context.close().catch(error => { contextsClosed = false; report.errors.push({ type: 'context-close', message: error.message }); });
  if (browser) { try { await browser.close(); browserClosed = true; } catch (error) { report.errors.push({ type: 'browser-close', message: error.message }); } }
  if (server.listening) await new Promise(resolve => server.close(resolve));
  report.cleanup = { browserClosed, contextsClosed, httpServerClosed: !server.listening };
  report.count = report.checks.length; report.passed = report.checks.filter(c => c.ok).length;
  report.coverage = { verifiedScenarios: report.scenes.filter(s => s.status === 'verified').length, failedScenarios: report.scenes.filter(s => s.status === 'failed').length };
  report.ok = report.scenes.length === 3 && report.scenes.every(s => s.ok === true) && report.errors.length === 0 && report.passed === report.count && contextsClosed && browserClosed && !server.listening;
  writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ok: report.ok, count: report.count, passed: report.passed, runnerSha256: report.runnerSha256, sourceHtmlSha256: sourceHash, baselineReportSha256: report.baselineReportSha256, scenes: report.scenes, cleanup: report.cleanup, errors: report.errors }, null, 2));
}
if (!report.ok) process.exitCode = 1;
