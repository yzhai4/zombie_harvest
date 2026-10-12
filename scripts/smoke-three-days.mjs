#!/usr/bin/env node
/**
 * Three-day smoke runner for the zombie-harvest vertical slice.
 *
 * With Playwright installed this drives the hosted (or local) page through
 * three day/night cycles and checks the persisted event ledger after reload.
 * The repository deliberately has no npm dependency, so a static contract
 * smoke is provided as a deterministic fallback. Use --strict-browser in CI
 * when a real browser is required.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH = path.join(ROOT, 'dist', 'index.html');
const DEFAULT_URL = 'https://zombie-harvest.jimmy-vaughanowl.chatgpt.site';

function parseArgs(argv) {
  const options = {
    url: process.env.SMOKE_URL || DEFAULT_URL,
    headed: false,
    strictBrowser: false,
    timeoutMs: 30_000,
    report: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--headed') options.headed = true;
    else if (arg === '--strict-browser') options.strictBrowser = true;
    else if (arg === '--url') options.url = argv[++i] || options.url;
    else if (arg === '--timeout') options.timeoutMs = Number(argv[++i]) || options.timeoutMs;
    else if (arg === '--report') options.report = argv[++i] || null;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/smoke-three-days.mjs [--url URL] [--headed] [--strict-browser] [--timeout MS] [--report FILE]');
      process.exit(0);
    } else throw new Error(`unknown option: ${arg}`);
  }
  return options;
}

function makeResult(mode) {
  return { runner: 'smoke-three-days', mode, startedAt: new Date().toISOString(), checks: [], warnings: [], errors: [] };
}

function check(result, name, ok, detail = '') {
  result.checks.push({ name, ok: !!ok, detail });
  if (!ok) result.errors.push(`${name}${detail ? `: ${detail}` : ''}`);
  return !!ok;
}

function finish(result, options) {
  result.finishedAt = new Date().toISOString();
  result.ok = result.errors.length === 0;
  const passed = result.checks.filter(item => item.ok).length;
  const failed = result.checks.length - passed;
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] ${result.runner} (${result.mode}) · ${passed} passed · ${failed} failed`);
  for (const item of result.checks) console.log(`  ${item.ok ? '✓' : '✗'} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
  for (const warning of result.warnings) console.warn(`  ! ${warning}`);
  if (result.errors.length) for (const error of result.errors) console.error(`  × ${error}`);
  if (options.report) writeFileSync(path.resolve(options.report), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function runStaticSmoke(options) {
  const result = makeResult('static-contract');
  const source = readFileSync(HTML_PATH, 'utf8');
  const requiredIds = [
    'startOverlay', 'continueSaveBtn', 'resetSaveBtn', 'gatherBtn', 'buildBtn',
    'buildDrawer', 'endDayBtn', 'nightOverlay', 'nightAttackBtn', 'continueBtn',
    'dailySummary', 'dayLabel', 'timeLabel', 'eventChoiceA', 'eventChoiceB',
    'world', 'nightWorld', 'contextActions', 'relayPanel', 'logList',
  ];
  for (const id of requiredIds) check(result, `DOM #${id}`, new RegExp(`id=["']${id}["']`).test(source));
  check(result, 'night movement controls', (source.match(/data-night-dir=/g) || []).length === 4, 'expected four directions');
  check(result, 'three-day action controls', /id=["']gatherBtn["'][\s\S]*id=["']buildBtn["'][\s\S]*id=["']endDayBtn["']/.test(source));
  check(result, 'night summary mode', /summary-mode[\s\S]*daily-summary|daily-summary[\s\S]*summary-mode/.test(source));

  const contracts = [
    ['EventDef contract', /const\s+EVENT_DEFS\s*=/.test(source) && /(?:const|let|var)\s+EventDef\s*=/.test(source)],
    ['EventInstance factory', /function\s+createEventInstance\s*\(/.test(source)],
    ['Choice contract', /function\s+normalizeEventChoice\s*\(/.test(source) && /choices\s*:/.test(source)],
    ['Effect contract', /function\s+normalizeEventEffect\s*\(/.test(source) && /effects\s*:/.test(source)],
    ['Gate contract', /function\s+normalizeEventGate\s*\(/.test(source) && /gate\s*:/.test(source)],
    ['event ledger', /worldMeta\.events/.test(source) && /recordWorldEvent\s*\(/.test(source)],
    ['command replay', /worldMeta\.replay/.test(source) && /seenCommands/.test(source)],
    ['save checksum', /checksum\(payload\)/.test(source) && /LEGACY_SAVE_KEYS/.test(source)],
    ['relay chain', /relay\.coreHandoff/.test(source) && /relay\.stationOnline/.test(source)],
    ['SAN state', /sanityLastReason/.test(source) && /adjustSanity\s*\(/.test(source)],
    ['night guard', /NIGHT_ACTION_MESSAGE/.test(source) && /function\s+guardNightAction\s*\(/.test(source)],
    ['night closure', /threat\.started/.test(source) && /threat\.resolved/.test(source) && /threat\.closed/.test(source)],
    ['plan meeting schema', /planMeeting/.test(source) && /commandPoints/.test(source) && /CONTENT_SCHEMA_VERSION = 2/.test(source)],
    ['plan meeting lifecycle', /generatePlanMeeting\s*\(/.test(source) && /commitPlanMeeting\s*\(/.test(source) && /executePlanMeeting\s*\(/.test(source)],
    ['plan meeting tab', /data-info-tab=["']plan["']/.test(source) && /infoPlanMount/.test(source)],
  ];
  for (const [name, ok] of contracts) check(result, name, ok);
  check(result, 'static night guard script available', existsSync(path.join(ROOT, 'scripts', 'check-night-guard.mjs')));
  check(result, 'replay hash runner available', existsSync(path.join(ROOT, 'scripts', 'replay-harness.mjs')));
  result.warnings.push('Playwright is unavailable; no real browser interaction was executed. Run `node scripts/smoke-three-days.mjs --strict-browser` in a Playwright-enabled environment.');
  return finish(result, options);
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    return { error };
  }
}

async function runBrowserSmoke(options, playwright) {
  const result = makeResult('playwright');
  const chromium = playwright.chromium;
  if (!chromium) {
    result.errors.push('Playwright chromium launcher is unavailable');
    return finish(result, options);
  }
  const browser = await chromium.launch({ headless: !options.headed });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = async (selector, name, timeout = 5_000) => {
    try {
      await page.locator(selector).waitFor({ state: 'visible', timeout });
      check(result, name, true);
      return true;
    } catch (error) {
      check(result, name, false, error.message.split('\n')[0]);
      return false;
    }
  };
  const click = async (selector, name) => {
    try {
      await page.locator(selector).click({ timeout: 5_000 });
      check(result, name, true);
      return true;
    } catch (error) {
      check(result, name, false, error.message.split('\n')[0]);
      return false;
    }
  };
  const persisted = async () => page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('zombie-harvest-progress'));
    const raw = keys.map(key => localStorage.getItem(key)).find(Boolean);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.payload || parsed;
    } catch { return null; }
  });
  const waitForSummary = async (day) => {
    try {
      await page.locator('#nightOverlay.summary-mode').waitFor({ state: 'visible', timeout: options.timeoutMs });
      const summary = await page.locator('#summaryFeed').innerText();
      check(result, `day ${day} daily summary`, true, summary.slice(0, 100));
      return true;
    } catch (error) {
      check(result, `day ${day} daily summary`, false, error.message.split('\n')[0]);
      return false;
    }
  };
  try {
    await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs });
    check(result, 'page loaded', true, options.url);
    await visible('#resetSaveBtn', 'new-game entry visible');
    await click('#resetSaveBtn', 'reset save and reload');
    await sleep(350);
    await visible('#continueSaveBtn', 'start button visible after reset');
    await click('#continueSaveBtn', 'start new game');
    await page.locator('#startOverlay').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    check(result, 'start overlay hidden', await page.locator('#startOverlay').getAttribute('aria-hidden') === 'true');

    for (let day = 1; day <= 3; day += 1) {
      await click('#gatherBtn', `day ${day} gather command`);
      await click('#buildBtn', `day ${day} open build panel`);
      check(result, `day ${day} build panel visible`, await page.locator('#buildDrawer').evaluate(el => el.classList.contains('open')));
      await click('#buildBtn', `day ${day} close build panel`);
      const eventA = page.locator('#eventChoiceA');
      if (await eventA.isVisible().catch(() => false) && await eventA.isEnabled().catch(() => false)) await click('#eventChoiceB', `day ${day} resolve event choice`);
      await click('#endDayBtn', `day ${day} start threat`);
      await visible('body.threat-map-active', `day ${day} night battle active`, options.timeoutMs);
      check(result, `day ${day} night movement visible`, await page.locator('.night-move-btn').count() === 4);
      await waitForSummary(day);
      await click('#continueBtn', `day ${day} close daily summary`);
      await sleep(200);
      const label = await page.locator('#dayLabel').innerText().catch(() => '');
      check(result, `day ${day} morning reached`, new RegExp(`第\\s*${day + 1}\\s*天`).test(label), label);
    }
    const beforeReload = await persisted();
    check(result, 'save contains event ledger', Array.isArray(beforeReload?.worldMeta?.events) && beforeReload.worldMeta.events.length > 0);
    check(result, 'save contains replay commands', Array.isArray(beforeReload?.worldMeta?.replay?.commands) && beforeReload.worldMeta.replay.commands.length > 0);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: options.timeoutMs });
    await visible('#continueSaveBtn', 'continue button after reload');
    await click('#continueSaveBtn', 'continue persisted three-day run');
    await sleep(250);
    const afterReload = await persisted();
    check(result, 'day and event ledger survive reload', Number(afterReload?.day) >= 4 && (afterReload?.worldMeta?.events?.length || 0) > 0);
    if (consoleErrors.length) result.warnings.push(`browser console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
  } catch (error) {
    result.errors.push(`browser smoke aborted: ${error.message}`);
  } finally {
    await context.close();
    await browser.close();
  }
  return finish(result, options);
}

const options = parseArgs(process.argv);
const playwright = await loadPlaywright();
let result;
if (playwright.error) {
  if (options.strictBrowser) {
    result = makeResult('playwright');
    result.errors.push(`Playwright is unavailable: ${playwright.error.message}`);
    result = finish(result, options);
  } else result = runStaticSmoke(options);
} else {
  result = await runBrowserSmoke(options, playwright);
}
process.exitCode = result.ok ? 0 : 1;

