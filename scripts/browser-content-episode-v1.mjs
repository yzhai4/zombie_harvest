import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { root, saveKey, sourceRuntimeFactory, envelope } from './lib/source-runtime-fixture.mjs';

// Explicit old-writer boot fixture. No GameState patch or hidden action after
// boot; all choices/reloads use the public UI. This is not natural three days.
const outArg = process.argv.indexOf('--out');
assert.ok(outArg >= 0 && path.isAbsolute(process.argv[outArg + 1]), '--out ABSOLUTE_DIR required');
const out = process.argv[outArg + 1];
mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.ZH_PLAYWRIGHT_MODULE || 'playwright');
const htmlBytes = readFileSync(path.join(root, 'dist/index.html'));
const sourceHash = createHash('sha256').update(htmlBytes).digest('hex');
const fixture = JSON.parse(readFileSync(path.join(root, 'scripts/fixtures/content-episode-v1/save21-pre-identity-active.json'), 'utf8'));
const raw = envelope(sourceRuntimeFactory(), fixture.payload);
const report = { runner: 'browser-content-episode-v1', mode: 'explicit-old-writer-boot-fixture',
  sourceHtmlSha256: sourceHash, checks: [], errors: [], documentHashes: [], naturalGameplay: false };
function check(name, condition) { report.checks.push({ name, ok: !!condition }); assert.ok(condition, name); }
const server = createServer((req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route === '/' || route === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(htmlBytes); }
  else if (route === '/actor-sprites.js') { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); res.end(readFileSync(path.join(root, 'dist/actor-sprites.js'))); }
  else { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.ZH_BROWSER_CHANNEL ? { channel: process.env.ZH_BROWSER_CHANNEL } : {}) });
  report.browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(({ key, raw }) => {
    if (!sessionStorage.getItem('qa-episode-seeded')) {
      localStorage.clear(); localStorage.setItem(key, raw); sessionStorage.setItem('qa-episode-seeded', 'yes');
    }
  }, { key: saveKey, raw });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  async function document(response) {
    assert.ok(response && response.ok());
    const hash = createHash('sha256').update(await response.body()).digest('hex');
    report.documentHashes.push(hash); check('document bytes match candidate', hash === sourceHash);
  }
  async function saved() { return page.evaluate(key => JSON.parse(localStorage.getItem(key)).payload, saveKey); }
  async function startAndSelect() {
    await page.locator('#continueSaveBtn').click();
    await page.locator('#openInfoBtn').click();
    await page.getByRole('tab', { name: '任务 / 事件', exact: true }).click();
    await page.locator('#eventSourceSelect').selectOption('chain:zh-food-shortage-001');
  }
  await document(await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded' }));
  await startAndSelect();
  check('public shortage choice visible', await page.locator('#eventChoiceB').isVisible());
  const dataset = await page.locator('#eventChoiceB').evaluate(button => ({ ...button.dataset }));
  check('rendered legacy save received instance identity', dataset.eventInstanceId === 'content:zh-food-shortage-001:1' && dataset.eventInstanceKey === 'zh-food-shortage-001:1');
  check('choice discloses finite cache and cost', (await page.locator('#eventChoiceB').innerText()).includes('整局一次'));
  await page.screenshot({ path: path.join(out, 'shortage-before.png'), fullPage: false });
  await page.locator('#eventChoiceB').click();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).payload.contentState.flags['zh-shortage-cache-retrieved'] === true, saveKey);
  const after = await saved();
  check('cache credited once', after.food === fixture.payload.food + 2);
  check('resonance meter change saved', after.contentState.meters.resonancePressure === fixture.payload.contentState.meters.resonancePressure + 2);
  check('instance receipt has correct identity', after.worldMeta.events.some(e => e.type === 'content.chain.resolved' && e.instanceId === dataset.eventInstanceId && e.payload.instanceKey === dataset.eventInstanceKey));
  const matching = after.worldMeta.replay.commands.filter(c => c.type === 'content.chain.resolve' && c.payload.chainId === 'zh-food-shortage-001');
  check('public click carried episode token into command', matching.length === 1 && matching[0].payload.expectedInstanceKey === dataset.eventInstanceKey);
  await document(await page.reload({ waitUntil: 'domcontentloaded' }));
  await page.locator('#continueSaveBtn').click();
  const reloaded = await saved();
  check('reload cannot grant another cache', reloaded.food === after.food && reloaded.contentState.flags['zh-shortage-cache-retrieved'] === true);
  check('reload preserves completion identity', reloaded.contentState.completedChains.includes(dataset.eventInstanceKey));
  check('page produced no runtime errors', report.errors.length === 0);
  await page.screenshot({ path: path.join(out, 'shortage-reloaded.png'), fullPage: false });
  writeFileSync(path.join(out, 'saved-after-reload.json'), JSON.stringify(reloaded, null, 2));
  await context.close();
} catch (error) { report.errors.push(error.stack || String(error)); }
finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  report.passed = report.checks.filter(c => c.ok).length;
  report.count = report.checks.length;
  report.ok = report.errors.length === 0 && report.passed === report.count && report.count >= 10;
  writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
if (!report.ok) process.exitCode = 1;
