import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REQUIRED_TESTS = Object.freeze(['content-chain', 'event-gate-parity', 'observer-expression', 'gameplay-vertical-slice', 'content-episode', 'replay-self-test', 'static-three-day-smoke']);
export const REQUIRED_SOURCE_ARTIFACTS = Object.freeze([
  'dist/actor-sprites.js', 'scripts/check-content-chain.mjs', 'scripts/check-report-recovery.mjs',
  'scripts/lib/source-runtime-fixture.mjs', 'scripts/check-content-episode-v1.mjs',
  'scripts/fixtures/content-episode-v1/save21-pre-identity-active.json', 'scripts/lib/event-gate-v1.mjs',
  'scripts/check-event-gate-parity.mjs', 'scripts/fixtures/event-gate-v1.json',
  'scripts/lib/observer-expression-v1.mjs', 'scripts/check-observer-expression-v1.mjs',
  'scripts/check-gameplay-vertical-slice.mjs', 'scripts/browser-content-episode-v1.mjs',
  'scripts/replay-harness.mjs', 'scripts/smoke-three-days.mjs'
]);
const RUNNERS = Object.freeze({ 'event-gate-parity': 'event-gate-v1-parity', 'observer-expression': 'observer-expression-v1',
  'gameplay-vertical-slice': 'source-gameplay-vertical-slice-v1', 'content-episode': 'source-content-episode-v1' });
const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const hex = (value, length) => typeof value === 'string' && new RegExp('^[a-fA-F0-9]{' + length + '}$').test(value);
const within = (root, target) => { const relative = path.relative(root, target); return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
const integer = value => Number.isSafeInteger(value) && value > 0;
function requireCondition(ok, message) { if (!ok) throw new Error(message); }

// Read only portable, root-relative regular files. Reject lexical traversal as
// well as symlink escapes; never interpret a manifest path as a shell command.
function artifactBytes(reference, root) {
  requireCondition(record(reference), 'artifact reference must be an object');
  const name = reference.path;
  requireCondition(typeof name === 'string' && name.length > 0 && !name.includes('\\') && !name.includes(':') && !name.includes('\0')
    && !path.posix.isAbsolute(name) && !path.win32.isAbsolute(name)
    && name.split('/').every(part => part && part !== '.' && part !== '..'), 'artifact path must be portable relative path without traversal');
  requireCondition(hex(reference.sha256, 64), 'artifact sha256 must be 64 hex');
  const target = fs.realpathSync(path.resolve(root, name));
  requireCondition(within(root, target), 'artifact real path escapes root');
  requireCondition(fs.statSync(target).isFile(), 'artifact must be a regular file');
  const bytes = fs.readFileSync(target);
  requireCondition(sha256(bytes) === reference.sha256.toLowerCase(), 'artifact hash mismatch: ' + name);
  return bytes;
}
function checksSummary(report) {
  requireCondition(record(report) && report.ok === true, 'actual report must have ok=true');
  requireCondition(Array.isArray(report.checks) && report.checks.length > 0, 'actual report needs nonempty checks');
  requireCondition(report.checks.every(row => record(row) && typeof (row.name ?? row.n) === 'string'
    && (row.name ?? row.n).length > 0 && row.ok === true), 'actual report contains invalid/failed checks');
  requireCondition(report.errors === undefined || Array.isArray(report.errors) && report.errors.length === 0, 'actual report errors must be empty');
  requireCondition(report.failures === undefined || Array.isArray(report.failures) && report.failures.length === 0, 'actual report failures must be empty');
  const count = report.checks.length;
  if (report.count !== undefined) requireCondition(report.count === count, 'actual report count disagrees with checks');
  if (report.passed !== undefined) requireCondition(report.passed === count, 'actual report passed disagrees with checks');
  return { count, passed: count };
}
function assertCounts(entry, summary) {
  requireCondition(integer(entry.count) && Number.isSafeInteger(entry.passed) && entry.passed === entry.count, 'manifest counts must be positive integers and all passed');
  requireCondition(entry.count === summary.count && entry.passed === summary.passed, 'manifest counts disagree with actual report');
}
function testSummary(name, bytes, htmlHash) {
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '').trim();
  if (name === 'content-chain' && !text.startsWith('{')) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    const header = /^content-chain source execution passed: ([1-9]\d*) checks$/.exec(lines[0]);
    requireCondition(header, 'unrecognized content-chain native report');
    const count = Number(header[1]);
    requireCondition(lines[1] === 'sourceHtmlSha256: ' + htmlHash, 'content-chain source hash is stale');
    requireCondition(/^sourceReplayHash: [a-f0-9]+ \(source CommandBus trajectory; distinct from save projection hash\)$/.test(lines[2] || ''), 'missing content-chain replay summary');
    requireCondition(lines.length === count + 3 && lines.slice(3).every(line => /^  ✓ .+/.test(line)), 'content-chain check lines disagree with count');
    return { count, passed: count };
  }
  const report = JSON.parse(text);
  if (name === 'replay-self-test') {
    // Native selfTest reports FIXTURES, not its internal assertion count.
    requireCondition(record(report) && report.ok === true && integer(report.fixtureCount) && /^[a-f0-9]{8}$/.test(report.replayHash), 'invalid replay self-test native report');
    requireCondition(report.count === undefined && report.passed === undefined, 'unexpected replay summary counters');
    return { count: report.fixtureCount, passed: report.fixtureCount };
  }
  if (name === 'static-three-day-smoke') {
    requireCondition(report.runner === 'smoke-three-days' && report.mode === 'static-contract', 'static smoke must be native static-contract JSON');
  } else if (name === 'content-chain') {
    throw new Error('content-chain requires the original native text report');
  } else if (Object.hasOwn(RUNNERS, name)) {
    requireCondition(report.runner === RUNNERS[name], 'wrong runner for ' + name);
    requireCondition(integer(report.count) && report.passed === report.count, 'Node report must contain count/passed');
  } else {
    requireCondition(typeof report.runner === 'string' && report.runner.length > 0, 'extra test needs a named runner');
  }
  for (const key of ['sourceHtmlSha256', 'sourceHash']) if (report[key] !== undefined) {
    requireCondition(report[key] === htmlHash, 'actual test source hash is stale: ' + key);
  }
  requireCondition(report.naturalGameplay !== true && report.naturalGameplayClaim !== true, 'source/static tests cannot claim natural gameplay');
  return checksSummary(report);
}

export function validateIterationEvidence(options = {}) {
  const root = fs.realpathSync(path.resolve(options.root || DEFAULT_ROOT));
  const htmlPath = path.resolve(options.htmlPath || options.html || path.join(root, 'dist/index.html'));
  const manifestPath = path.resolve(options.manifestPath || path.join(root, 'docs/qa/iteration-manifest-v1.json'));
  const checks = [], errors = [];
  function check(name, run) {
    try { run(); checks.push({ name, ok: true }); }
    catch (error) { const message = name + ': ' + error.message; checks.push({ name, ok: false, error: error.message }); errors.push(message); }
  }
  let manifest, htmlHash = null, commitVerification = 'unavailable';
  check('read current HTML', () => {
    requireCondition(within(root, fs.realpathSync(htmlPath)) && fs.statSync(htmlPath).isFile(), 'HTML must be a regular file within root');
    htmlHash = sha256(fs.readFileSync(htmlPath));
  });
  check('read manifest JSON', () => { manifest = options.manifest ?? JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')); requireCondition(record(manifest), 'manifest must be an object'); });
  if (record(manifest)) {
    const m = manifest;
    check('verified schema and compatibility', () => {
      requireCondition(m.schema === 'IterationEvidenceV1' && m.version === 1 && m.status === 'verified', 'only verified IterationEvidenceV1 version 1 is accepted');
      requireCondition(m.compatibility?.saveVersion === 21 && m.compatibility?.contentVersion === 3, 'expected SAVE21 / CONTENT3');
      requireCondition(m.runtime?.naturalGameplayClaim === false, 'runtime must explicitly deny natural gameplay claim');
    });
    check('exact source binding', () => {
      requireCondition(hex(m.source?.commit, 40), 'source.commit must be 40 hex');
      requireCondition(hex(m.source?.htmlSha256, 64) && htmlHash !== null && m.source.htmlSha256.toLowerCase() === htmlHash, 'source HTML hash must match current file');
      requireCondition(m.source.reportInputSha256 === undefined || hex(m.source.reportInputSha256, 64), 'invalid optional reportInputSha256');
    });
    check('artifact inventory', () => {
      requireCondition(Array.isArray(m.artifacts) && m.artifacts.length > 0, 'artifacts must be nonempty');
      const names = new Set();
      for (const ref of m.artifacts) { requireCondition(!names.has(ref?.path), 'duplicate artifact path'); names.add(ref?.path); artifactBytes(ref, root); }
      requireCondition(REQUIRED_SOURCE_ARTIFACTS.every(name => names.has(name)), 'missing required source artifact paths');
    });
    check('required tests and unique names', () => {
      requireCondition(Array.isArray(m.tests?.results) && m.tests.results.length > 0, 'tests.results required');
      const names = m.tests.results.map(row => row?.name);
      requireCondition(names.every(name => typeof name === 'string' && name.length > 0) && new Set(names).size === names.length, 'test names must be nonempty and unique');
      requireCondition(REQUIRED_TESTS.every(name => names.includes(name)), 'missing required test names');
    });
    const results = Array.isArray(m.tests?.results) ? m.tests.results : [];
    const reportPaths = new Set();
    for (const [index, result] of results.entries()) check('test artifact ' + index + ' ' + (result?.name || 'unknown'), () => {
      requireCondition(record(result) && result.status === 'passed', 'every test status must be passed');
      const ref = result.artifact;
      requireCondition(!reportPaths.has(ref?.path), 'test reports must use distinct artifact paths');
      reportPaths.add(ref?.path);
      assertCounts(result, testSummary(result.name, artifactBytes(ref, root), htmlHash));
    });
    check('fixture browser report', () => {
      const browser = m.browser;
      requireCondition(record(browser) && browser.status === 'fixture-browser' && browser.naturalGameplayClaim === false, 'browser must explicitly be fixture-browser and deny natural gameplay');
      requireCondition(!reportPaths.has(browser.artifact?.path), 'browser must use its own report');
      const report = JSON.parse(artifactBytes(browser.artifact, root).toString('utf8').replace(/^\uFEFF/, ''));
      requireCondition(report.runner === 'browser-content-episode-v1' && report.mode === 'explicit-old-writer-boot-fixture' && report.naturalGameplay === false, 'unrecognized native fixture-browser report');
      requireCondition(report.sourceHtmlSha256 === htmlHash && typeof report.browserVersion === 'string' && report.browserVersion.length > 0, 'browser source/version missing or stale');
      requireCondition(Array.isArray(report.errors) && report.errors.length === 0, 'browser errors must be empty');
      requireCondition(Array.isArray(report.documentHashes) && report.documentHashes.length >= 2 && report.documentHashes.every(hash => hash === htmlHash), 'browser needs matching first-load and reload document hashes');
      const summary = checksSummary(report);
      requireCondition(integer(report.count) && report.count >= 10 && report.passed === report.count, 'browser native count/passed required with at least 10 checks');
      const names = report.checks.map(row => row.name);
      for (const name of ['document bytes match candidate', 'public shortage choice visible', 'cache credited once', 'public click carried episode token into command', 'reload cannot grant another cache', 'reload preserves completion identity', 'page produced no runtime errors']) requireCondition(names.includes(name), 'browser missing actual coverage: ' + name);
      requireCondition(names.includes('resonance meter change saved') || names.includes('exposure cost saved'), 'browser missing saved resonance meter change');
      assertCounts(browser, summary);
    });
    check('git source commit and ancestry', () => {
      const git = (...args) => spawnSync('git', ['-C', root, ...args], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
      const detected = git('rev-parse', '--show-toplevel');
      if (detected.status !== 0) {
        requireCondition(!options.requireGit && !fs.existsSync(path.join(root, '.git')), 'git verification required or repository unreadable');
        return;
      }
      commitVerification = 'failed';
      requireCondition(hex(m.source?.commit, 40), 'invalid git source commit');
      const commit = m.source.commit.toLowerCase();
      const show = git('show', commit + ':dist/index.html');
      requireCondition(show.status === 0 && sha256(show.stdout) === htmlHash, 'git commit HTML bytes do not match current HTML');
      requireCondition(git('merge-base', '--is-ancestor', commit, 'HEAD').status === 0, 'source commit is not an ancestor of HEAD');
      requireCondition(Array.isArray(m.artifacts), 'source artifact inventory missing');
      // Reports under docs are outputs. Every declared scripts/dist dependency
      // must also match the source commit, including additional dependencies.
      for (const ref of m.artifacts) if (typeof ref?.path === 'string' && /^(scripts|dist)\//.test(ref.path)) {
        artifactBytes(ref, root);
        const stored = git('show', commit + ':' + ref.path);
        requireCondition(stored.status === 0 && sha256(stored.stdout) === ref.sha256.toLowerCase(), 'git source artifact differs from commit: ' + ref.path);
      }
      commitVerification = 'verified';
    });
  }
  return { runner: 'iteration-evidence-freshness', ok: errors.length === 0, count: checks.length,
    passed: checks.filter(row => row.ok).length, errors, checks, evidenceCommit: manifest?.source?.commit || null,
    htmlSha256: htmlHash, commitVerification,
    scope: 'source VM / pure core / static contracts / explicit fixture browser; no natural multi-day gameplay claim', naturalGameplayClaim: false };
}
function cli(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--require-git') { requireCondition(!options.requireGit, 'duplicate --require-git'); options.requireGit = true; continue; }
    requireCondition(['--manifest', '--html', '--root'].includes(key), 'unknown option: ' + key);
    const field = { '--manifest': 'manifestPath', '--html': 'htmlPath', '--root': 'root' }[key];
    requireCondition(!options[field] && typeof args[index + 1] === 'string' && !args[index + 1].startsWith('--'), 'missing/duplicate option: ' + key);
    options[field] = path.resolve(args[++index]);
  }
  return validateIterationEvidence(options);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let report;
  try { report = cli(process.argv.slice(2)); }
  catch (error) { report = { runner: 'iteration-evidence-freshness', ok: false, count: 1, passed: 0, errors: [error.message] }; }
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
