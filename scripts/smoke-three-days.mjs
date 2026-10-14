#!/usr/bin/env node
/**
 * Three-day smoke runner for the zombie-harvest vertical slice.
 *
 * Python Playwright drives the hosted (or local) page through three calendar
 * days using the shared server-three-days.py public-control route, then checks
 * the real save/ledger after reload. No save is seeded and no internal clock
 * function is called. A static fallback is explicit when Python Playwright is
 * unavailable; --strict-browser makes missing browser support fail.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH = path.join(ROOT, 'dist', 'index.html');
const DEFAULT_URL = 'https://zombie-harvest.jimmy-vaughanowl.chatgpt.site';

function parseArgs(argv) {
  const options = {
    url: process.env.SMOKE_URL || DEFAULT_URL,
    headed: false,
    strictBrowser: false,
    report: null,
    python: process.env.ZFARM_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'),
    chrome: process.env.CHROME_BIN || null,
    profile: null,
    checkpoint: null,
    resume: false,
    totalTimeoutSeconds: 600,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--headed') options.headed = true;
    else if (arg === '--strict-browser') options.strictBrowser = true;
    else if (arg === '--url') options.url = argv[++i] || options.url;
    else if (arg === '--timeout') throw new Error('Use --total-timeout SECONDS for the shared calendar browser runner');
    else if (arg === '--report') options.report = argv[++i] || null;
    else if (arg === '--python') options.python = argv[++i] || options.python;
    else if (arg === '--chrome') options.chrome = argv[++i] || null;
    else if (arg === '--verbose') options.verbose = true;
    else if (arg === '--profile') options.profile = argv[++i] || null;
    else if (arg === '--checkpoint') options.checkpoint = argv[++i] || null;
    else if (arg === '--resume') options.resume = true;
    else if (arg === '--fresh') options.resume = false;
    else if (arg === '--total-timeout') {
      options.totalTimeoutSeconds = Number(argv[++i]);
      if (!Number.isFinite(options.totalTimeoutSeconds) || options.totalTimeoutSeconds <= 0) throw new Error('--total-timeout must be positive seconds');
    }
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/smoke-three-days.mjs [--url URL] [--headed] [--strict-browser] [--python EXE] [--chrome EXE] [--profile DIR] [--checkpoint FILE] [--resume|--fresh] [--total-timeout SECONDS] [--report FILE] [--verbose]');
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
  const displayed = options.verbose ? result.checks : result.checks.filter(item => !item.ok).slice(0, 20);
  for (const item of displayed) {
    const detail = options.verbose && item.detail ? ` — ${typeof item.detail === 'string' ? item.detail : JSON.stringify(item.detail)}` : '';
    console.log(`  ${item.ok ? '✓' : '✗'} ${item.name}${detail}`);
  }
  if (!options.verbose && failed > displayed.length) console.log(`  ${failed - displayed.length} further failed checks are retained in the full report.`);
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
    ['plan meeting schema', /planMeeting/.test(source) && /commandPoints/.test(source) && /CONTENT_SCHEMA_VERSION = 3/.test(source)],
    ['plan meeting lifecycle', /generatePlanMeeting\s*\(/.test(source) && /commitPlanMeeting\s*\(/.test(source) && /executePlanMeeting\s*\(/.test(source)],
    ['plan meeting tab', /data-info-tab=["']plan["']/.test(source) && /infoPlanMount/.test(source)],
    ['npc attribute schema', /NPC_ATTRIBUTE_DEFAULTS/.test(source) && /npcAttributeProfile\s*\(/.test(source)],
    ['npc promotion lifecycle', /evaluateNpcPromotion\s*\(/.test(source) && /promoteNpcHero\s*\(/.test(source) && /npcRoster/.test(source)],
    ['npc role-card projection', /function\s+renderSurvivors\s*\(/.test(source) && /npcSkillSummary\s*\(/.test(source) && /npcHeroLabel\s*\(/.test(source) && /data-npc=/.test(source)],
    ['npc promotion UI gate', /data-context-action=\"promoteHero\"/.test(source) && /commandPoints/.test(source) && /npc\.hero\?\.status\s*===\s*['\"]eligible['\"]/.test(source)],
    ['npc succession lifecycle', /assignMorningSuccessors\s*\(/.test(source) && /npcFulfillsRole\s*\(/.test(source) && /actingRole/.test(source) && /roleVacancies/.test(source)],
    ['five-day NPC replay fixture', /five-day-npc/.test(readFileSync(path.join(ROOT, 'scripts', 'replay-harness.mjs'), 'utf8')) && /promotionHistory/.test(readFileSync(path.join(ROOT, 'scripts', 'replay-harness.mjs'), 'utf8'))],
    ['outpost garrison ledger', /outpostPopulationLedger\s*\(/.test(source) && /garrisonedOutpostId/.test(source) && /captureOutpost/.test(source)],
    ['outpost capture context action', /['"]captureOutpost['"]/.test(source) && /outposts\s*=\s*nearby/.test(source) && /outpostCaptureGate\s*\(/.test(source) && /selectOutpostGuards\s*\(/.test(source)],
    ['outpost capture reducer ledger', /function\s+captureOutpostReducer\s*\(/.test(source) && /applyContentEffects\(\[\{\s*op:\s*'captureOutpost'/.test(source) && /outpost\.captured/.test(source)],
    ['known outpost remains visible', /getKnownOutpost\s*\(/.test(source) && /found === true/.test(source)],
    ['outpost upkeep lifecycle', /applyOutpostUpkeep\s*\(/.test(source) && /outpost\.upkeep/.test(source) && /lastUpkeepDay/.test(source)],
    ['outpost camp-role exclusion', /function\s+npcHasRole\([\s\S]*?!npc\.garrisonedOutpostId/.test(source) && /function\s+npcFulfillsRole\([\s\S]*?!npc\.garrisonedOutpostId/.test(source)],
    ['outpost replay fixture', /outpost-garrison/.test(readFileSync(path.join(ROOT, 'scripts', 'replay-harness.mjs'), 'utf8')) && /garrisonedNpcIds/.test(readFileSync(path.join(ROOT, 'scripts', 'replay-harness.mjs'), 'utf8'))],
    ['active content chain event UI', /function\s+activeContentChainView\s*\(/.test(source) && /function\s+handleEventChoice\s*\(/.test(source) && /resolveContentChainCommand\s*\(/.test(source)],
    ['active content chain replay fixture', /activeChains/.test(readFileSync(path.join(ROOT, 'scripts', 'replay-harness.mjs'), 'utf8')) && /watermill-002/.test(readFileSync(path.join(ROOT, 'scripts', 'replay-harness.mjs'), 'utf8'))],
  ];
  for (const [name, ok] of contracts) check(result, name, ok);
  check(result, 'static night guard script available', existsSync(path.join(ROOT, 'scripts', 'check-night-guard.mjs')));
  check(result, 'replay hash runner available', existsSync(path.join(ROOT, 'scripts', 'replay-harness.mjs')));
  result.warnings.push('Python Playwright is unavailable; this checks static contracts only. Run `node scripts/smoke-three-days.mjs --strict-browser --python /path/to/playwright-python` for the shared public-action calendar runner.');
  return finish(result, options);
}

function pythonBrowserAvailable(options) {
  const probe = spawnSync(options.python, ['-c', 'from playwright.sync_api import sync_playwright'], { encoding: 'utf8', timeout: 10_000, windowsHide: true });
  return { ok: probe.status === 0 && !probe.error, detail: probe.error?.message || probe.stderr?.trim().split('\n').pop() || 'Python Playwright is unavailable' };
}

async function runBrowserSmoke(options) {
  // One shared real-browser implementation separates calendar days from
  // encounters. It uses only public controls and never seeds a save.
  const report = options.report ? path.resolve(options.report) : path.join(tmpdir(), `zfarm-three-days-${process.pid}.json`);
  if (options.resume && !options.profile) throw new Error('--resume requires the original --profile DIR');
  const profile = options.profile ? path.resolve(options.profile) : path.join(tmpdir(), `zfarm-three-days-profile-${process.pid}`);
  const checkpoint = options.checkpoint ? path.resolve(options.checkpoint) : path.join(profile, 'runner-checkpoint.json');
  const previousReport = existsSync(report) ? readFileSync(report, 'utf8') : null;
  const args = [path.join(ROOT, 'scripts', 'server-three-days.py'), '--url', options.url, '--out', report, '--timeout', String(options.totalTimeoutSeconds), options.resume ? '--resume' : '--fresh'];
  args.push('--profile', profile, '--checkpoint', checkpoint);
  if (options.chrome) args.push('--chrome', options.chrome);
  if (options.headed) args.push('--headed');
  const child = spawn(options.python, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', value => { stdout += value; process.stdout.write(value); });
  child.stderr.on('data', value => { stderr += value; process.stderr.write(value); });
  const status = await new Promise(resolve => { child.once('error', error => resolve({ code: 1, error })); child.once('close', code => resolve({ code })); });
  let result;
  try {
    const currentReport = readFileSync(report, 'utf8');
    if (currentReport === previousReport) throw new Error('browser runner did not replace its previous report');
    result = JSON.parse(currentReport);
    if (result.runner !== 'server-three-days' || result.mode !== 'public-action-calendar-progression' || result.url !== options.url) throw new Error('browser result does not match this runner and URL');
  } catch (error) {
    result = makeResult('python-playwright');
    result.errors.push(status.error?.message || error.message || stderr.trim() || stdout.trim() || 'browser runner produced no result');
  }
  result.runner = 'smoke-three-days';
  result.mode = 'python-playwright-public-action-calendar-progression';
  result.checks = Array.isArray(result.checks) ? result.checks : [];
  result.errors = Array.isArray(result.errors) ? result.errors : [];
  result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
  if (result.ok === false && !result.errors.length) result.errors.push('browser runner reported failed validation');
  if (status.code !== 0 && !result.errors.length) result.errors.push(`browser runner exited ${status.code}`);
  return finish(result, options);
}

const options = parseArgs(process.argv);
const browser = pythonBrowserAvailable(options);
let result;
if (browser.ok) result = await runBrowserSmoke(options);
else if (options.strictBrowser) {
  result = makeResult('python-playwright');
  result.errors.push(browser.detail);
  result = finish(result, options);
} else result = runStaticSmoke(options);
process.exitCode = result.ok ? 0 : 1;
