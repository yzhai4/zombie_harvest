import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateIterationEvidence, REQUIRED_TESTS, REQUIRED_SOURCE_ARTIFACTS } from './check-iteration-evidence.mjs';

// Synthetic validator-method fixtures only. Their shapes mirror native reports;
// none of these checks runs gameplay or fabricates production evidence.
const checks = [], temporaryRoots = [];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const browserNames = ['document bytes match candidate', 'public shortage choice visible',
  'rendered legacy save received instance identity', 'choice discloses finite cache and cost',
  'cache credited once', 'exposure cost saved', 'instance receipt has correct identity',
  'public click carried episode token into command', 'document bytes match candidate',
  'reload cannot grant another cache', 'reload preserves completion identity', 'page produced no runtime errors'];
function test(name, run) {
  try { run(); checks.push({ name, ok: true }); }
  catch (error) { checks.push({ name, ok: false, error: String(error.stack || error) }); }
}
function write(root, name, content) {
  const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true });
  const bytes = Buffer.from(typeof content === 'string' ? content : JSON.stringify(content));
  fs.writeFileSync(file, bytes); return { path: name, sha256: sha(bytes) };
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zh-evidence-selftest-')); temporaryRoots.push(root);
  const html = '<!doctype html><title>synthetic validator control only</title>\n';
  write(root, 'dist/index.html', html); const htmlHash = sha(Buffer.from(html));
  const runners = { 'event-gate-parity': 'event-gate-v1-parity', 'observer-expression': 'observer-expression-v1',
    'gameplay-vertical-slice': 'source-gameplay-vertical-slice-v1', 'content-episode': 'source-content-episode-v1' };
  const results = REQUIRED_TESTS.map(name => {
    let body, count = 2;
    if (name === 'content-chain') body = 'content-chain source execution passed: 2 checks\nsourceHtmlSha256: ' + htmlHash
      + '\nsourceReplayHash: c5d6c772 (source CommandBus trajectory; distinct from save projection hash)\n  ✓ synthetic control A\n  ✓ synthetic control B\n';
    else if (name === 'replay-self-test') body = { ok: true, fixtureCount: 2, replayHash: '4aec7a31' };
    else {
      body = { runner: runners[name] || 'smoke-three-days', ok: true, checks: [{ name: 'synthetic A', ok: true }, { name: 'synthetic B', ok: true }] };
      if (name === 'static-three-day-smoke') Object.assign(body, { mode: 'static-contract', errors: [] });
      else Object.assign(body, { count, passed: count });
      if (name === 'event-gate-parity') body.sourceHtmlSha256 = htmlHash;
      if (name === 'gameplay-vertical-slice') body.naturalGameplay = false;
    }
    return { name, status: 'passed', count, passed: count, artifact: write(root, 'evidence/' + name + '.json', body) };
  });
  const browserReport = { runner: 'browser-content-episode-v1', mode: 'explicit-old-writer-boot-fixture',
    sourceHtmlSha256: htmlHash, checks: browserNames.map(name => ({ name, ok: true })), errors: [],
    documentHashes: [htmlHash, htmlHash], naturalGameplay: false, browserVersion: 'synthetic-method-control', count: 12, passed: 12, ok: true };
  const browserArtifact = write(root, 'evidence/browser.json', browserReport);
  const sourceArtifacts = REQUIRED_SOURCE_ARTIFACTS.map(name => write(root, name,
    name.endsWith('.json') ? { syntheticValidatorDependency: name } : '// synthetic validator dependency: ' + name + '\n'));
  const manifest = { schema: 'IterationEvidenceV1', version: 1, status: 'verified',
    source: { commit: 'a'.repeat(40), htmlSha256: htmlHash }, compatibility: { saveVersion: 21, contentVersion: 3 },
    runtime: { naturalGameplayClaim: false }, browser: { status: 'fixture-browser', naturalGameplayClaim: false, count: 12, passed: 12, artifact: browserArtifact },
    tests: { results }, artifacts: [...results.map(row => row.artifact), browserArtifact, ...sourceArtifacts] };
  function run(m = manifest, extra = {}) { return validateIterationEvidence({ root, manifest: m, ...extra }); }
  function updateReport(m, name, change) {
    const ref = name === 'browser' ? m.browser.artifact : m.tests.results.find(row => row.name === name).artifact;
    const report = JSON.parse(fs.readFileSync(path.join(root, ref.path), 'utf8')); change(report);
    const updated = write(root, ref.path, report); ref.sha256 = updated.sha256;
    m.artifacts.find(entry => entry.path === ref.path).sha256 = updated.sha256;
  }
  return { root, manifest, run, updateReport };
}
function reject(change, expected) {
  const f = fixture(), m = clone(f.manifest); change(m, f);
  const report = f.run(m); assert.equal(report.ok, false);
  if (expected) assert.ok(report.errors.some(error => error.includes(expected)), JSON.stringify(report.errors));
}
try {
  test('synthetic native-shape positive; absent git explicitly unavailable', () => {
    const f = fixture(), result = f.run(); assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.count, result.passed); assert.equal(result.commitVerification, 'unavailable');
    assert.equal(result.naturalGameplayClaim, false);
  });
  for (const status of ['pending', 'passed', 'unavailable', null]) test('reject manifest status ' + status, () => reject(m => { m.status = status; }, 'only verified'));
  test('reject stale HTML despite pending flag', () => reject(m => { m.status = 'pending'; m.source.htmlSha256 = '0'.repeat(64); }, 'source HTML'));
  test('reject source commit not full 40 hex', () => reject(m => { m.source.commit = 'abc123'; }, '40 hex'));
  test('reject optional malformed report input digest', () => reject(m => { m.source.reportInputSha256 = false; }, 'reportInputSha256'));
  test('reject wrong save/content versions', () => reject(m => { m.compatibility.contentVersion = 4; }, 'SAVE21'));
  test('reject natural gameplay assertion', () => reject(m => { m.runtime.naturalGameplayClaim = true; }, 'natural gameplay'));
  test('reject duplicate test names', () => reject(m => { m.tests.results.push(clone(m.tests.results[0])); }, 'unique'));
  test('reject empty results', () => reject(m => { m.tests.results = []; }, 'tests.results'));
  for (const name of REQUIRED_TESTS) test('reject omitted required test ' + name, () => reject(m => { m.tests.results = m.tests.results.filter(row => row.name !== name); }, 'missing required'));
  test('manifest required list cannot remove hardcoded required names', () => reject(m => { m.tests.required = []; m.tests.results.pop(); }, 'missing required'));
  for (const value of [0, -1, 1.5, '2', null]) test('reject malformed count ' + value, () => reject(m => { m.tests.results[0].count = value; }, 'counts'));
  test('reject unequal passed count', () => reject(m => { m.tests.results[0].passed = 1; }, 'counts'));
  test('reject pending individual test', () => reject(m => { m.tests.results[0].status = 'pending'; }, 'every test status'));
  test('reject empty artifact inventory', () => reject(m => { m.artifacts = []; }, 'artifacts must be nonempty'));
  for (const name of REQUIRED_SOURCE_ARTIFACTS) test('reject missing source dependency ' + name, () => reject(m => {
    m.artifacts = m.artifacts.filter(ref => ref.path !== name);
  }, 'missing required source'));
  test('unrelated artifact cannot replace required runner binding', () => reject((m, f) => {
    m.artifacts = m.artifacts.filter(ref => ref.path !== 'scripts/check-content-chain.mjs');
    m.artifacts.push(write(f.root, 'docs/unrelated.txt', 'not a runner binding'));
  }, 'missing required source'));
  test('reject missing artifact reference', () => reject(m => { delete m.tests.results[0].artifact; }, 'artifact reference'));
  test('reject stale artifact hash', () => reject((m, f) => { fs.appendFileSync(path.join(f.root, m.tests.results[0].artifact.path), 'tamper'); }, 'hash mismatch'));
  test('reject missing artifact file', () => reject(m => { m.tests.results[0].artifact.path = 'evidence/missing.json'; }, 'ENOENT'));
  test('reject duplicate inventory path', () => reject(m => { m.artifacts.push(clone(m.artifacts[0])); }, 'duplicate artifact'));
  test('reject symlink or junction escaping the artifact root', () => {
    const f = fixture(), outside = fixture(), m = clone(f.manifest);
    fs.symlinkSync(outside.root, path.join(f.root, 'outside-link'), process.platform === 'win32' ? 'junction' : 'dir');
    const ref = m.tests.results[0].artifact;
    ref.path = 'outside-link/' + outside.manifest.tests.results[0].artifact.path;
    ref.sha256 = outside.manifest.tests.results[0].artifact.sha256;
    const result = f.run(m); assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.includes('real path escapes root')));
  });
  for (const name of ['../outside.json', '/absolute.json', 'C:/absolute.json', 'evidence/../data.json', 'evidence\\x.json', 'evidence//x.json']) {
    test('reject artifact path ' + name, () => reject(m => { m.tests.results[0].artifact.path = name; }, 'relative path'));
  }
  test('reject valid-hash failed report', () => reject((m, f) => f.updateReport(m, 'observer-expression', r => { r.ok = false; }), 'ok=true'));
  test('reject check failures concealed by summary', () => reject((m, f) => f.updateReport(m, 'observer-expression', r => { r.checks[0].ok = false; }), 'failed checks'));
  test('reject report counters inconsistent with actual checks', () => reject((m, f) => f.updateReport(m, 'observer-expression', r => { r.count = 3; r.passed = 3; }), 'disagrees'));
  test('reject wrong named runner', () => reject((m, f) => f.updateReport(m, 'observer-expression', r => { r.runner = 'unrelated'; }), 'wrong runner'));
  test('reject stale source hash even with fresh artifact hash', () => reject((m, f) => f.updateReport(m, 'event-gate-parity', r => { r.sourceHtmlSha256 = '0'.repeat(64); }), 'source hash is stale'));
  test('reject static contract labeled browser', () => reject((m, f) => f.updateReport(m, 'static-three-day-smoke', r => { r.mode = 'browser'; }), 'static-contract'));
  test('reject replay self-test pretending assertion count', () => reject((m, f) => f.updateReport(m, 'replay-self-test', r => { r.count = 999; }), 'replay summary'));
  for (const status of ['unavailable', 'pending', 'natural-browser']) test('reject browser misuse ' + status, () => reject(m => { m.browser.status = status; }, 'fixture-browser'));
  test('reject missing browser natural claim boundary', () => reject(m => { delete m.browser.naturalGameplayClaim; }, 'fixture-browser'));
  test('reject browser actual natural gameplay claim', () => reject((m, f) => f.updateReport(m, 'browser', r => { r.naturalGameplay = true; }), 'native fixture-browser'));
  test('reject browser missing reload hashes', () => reject((m, f) => f.updateReport(m, 'browser', r => { r.documentHashes.pop(); }), 'document hashes'));
  test('reject browser stale document bytes', () => reject((m, f) => f.updateReport(m, 'browser', r => { r.documentHashes[1] = '0'.repeat(64); }), 'document hashes'));
  test('reject browser errors concealed by ok', () => reject((m, f) => f.updateReport(m, 'browser', r => { r.errors.push('error'); }), 'browser errors'));
  test('reject browser missing actual named coverage', () => reject((m, f) => f.updateReport(m, 'browser', r => { r.checks[4].name = 'unrelated'; }), 'actual coverage'));
  test('reject browser report summary mismatch', () => reject((m, f) => f.updateReport(m, 'browser', r => { r.passed = 11; }), 'passed disagrees'));
  test('validation preserves manifest and artifact bytes', () => {
    const f = fixture(), before = JSON.stringify(f.manifest);
    const bytes = f.manifest.artifacts.map(ref => fs.readFileSync(path.join(f.root, ref.path)).toString('hex'));
    assert.equal(f.run().ok, true); assert.equal(JSON.stringify(f.manifest), before);
    assert.deepEqual(f.manifest.artifacts.map(ref => fs.readFileSync(path.join(f.root, ref.path)).toString('hex')), bytes);
  });
  test('require-git rejects archive with unavailable git metadata', () => { const f = fixture(), result = f.run(f.manifest, { requireGit: true }); assert.equal(result.ok, false); assert.ok(result.errors.some(e => e.includes('git verification required'))); });
  test('real isolated git commit HTML and ancestor verified; stale and unrelated commits reject', () => {
    const f = fixture();
    function git(...args) { const r = spawnSync('git', ['-C', f.root, ...args], { encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); }
    git('init'); git('config', 'user.name', 'Validator Method Test'); git('config', 'user.email', 'validator@example.invalid');
    git('add', 'dist', 'scripts'); git('commit', '-m', 'synthetic initial');
    const commit = git('rev-parse', 'HEAD'); f.manifest.source.commit = commit;
    assert.equal(f.run(f.manifest, { requireGit: true }).commitVerification, 'verified');
    write(f.root, 'extra.txt', 'synthetic descendant'); git('add', 'extra.txt'); git('commit', '-m', 'synthetic descendant');
    assert.equal(f.run(f.manifest, { requireGit: true }).ok, true);
    const orphan = git('commit-tree', 'HEAD^{tree}', '-m', 'synthetic unrelated root');
    const unrelated = clone(f.manifest); unrelated.source.commit = orphan;
    const badAncestry = f.run(unrelated); assert.equal(badAncestry.ok, false); assert.ok(badAncestry.errors.some(e => e.includes('ancestor')));
    const changedPath = 'scripts/check-content-chain.mjs';
    const originalBytes = fs.readFileSync(path.join(f.root, changedPath));
    const changed = clone(f.manifest), updated = write(f.root, changedPath, '// changed source with old reports\n');
    changed.artifacts.find(ref => ref.path === changedPath).sha256 = updated.sha256;
    const staleRunner = f.run(changed, { requireGit: true });
    assert.equal(staleRunner.ok, false); assert.equal(staleRunner.commitVerification, 'failed');
    assert.ok(staleRunner.errors.some(e => e.includes('git source artifact differs from commit: ' + changedPath)));
    fs.writeFileSync(path.join(f.root, changedPath), originalBytes);
    write(f.root, 'dist/index.html', 'changed HTML'); const stale = clone(f.manifest); stale.source.htmlSha256 = sha(Buffer.from('changed HTML'));
    const staleGit = f.run(stale); assert.equal(staleGit.ok, false); assert.ok(staleGit.errors.some(e => e.includes('git commit HTML bytes')));
  });
  test('CLI missing option and require-git fail with JSON exit1', () => {
    const file = fileURLToPath(new URL('./check-iteration-evidence.mjs', import.meta.url));
    const bad = spawnSync(process.execPath, [file, '--manifest'], { encoding: 'utf8', windowsHide: true });
    assert.equal(bad.status, 1); assert.equal(JSON.parse(bad.stdout).ok, false);
    const f = fixture(); write(f.root, 'manifest.json', f.manifest);
    const child = spawnSync(process.execPath, [file, '--root', f.root, '--manifest', path.join(f.root, 'manifest.json'), '--html', path.join(f.root, 'dist/index.html'), '--require-git'], { encoding: 'utf8', windowsHide: true });
    assert.equal(child.status, 1); assert.equal(JSON.parse(child.stdout).commitVerification, 'unavailable');
  });
} finally {
  for (const directory of temporaryRoots) {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('zh-evidence-selftest-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
const passed = checks.filter(row => row.ok).length;
console.log(JSON.stringify({ runner: 'iteration-evidence-self-test', ok: passed === checks.length, count: checks.length, passed,
  scope: 'synthetic validator method controls, isolated temporary git only; no gameplay/browser run', checks }, null, 2));
if (passed !== checks.length) process.exitCode = 1;
