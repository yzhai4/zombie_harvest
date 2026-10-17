import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sourceRuntimeFactory } from '../zombie_harvest-30eeefb5c20e4e8105dfe76e64ce9f806e3373cd/scripts/lib/source-runtime-fixture.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(dir, '../zombie_harvest-30eeefb5c20e4e8105dfe76e64ce9f806e3373cd');
const expected = '19cb05c4341ab1353e1ac5362b685a4af3a88fc826e349504b9d57a42639eb6f';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const rows = [], inventory = [], summaries = [];
const check = (name, ok) => rows.push({ name, ok: !!ok });
for (const suite of ['camp-rest', 'outpost-presence']) {
  const location = path.join(dir, suite), report = JSON.parse(fs.readFileSync(path.join(location, 'report.json')));
  const runtime = sourceRuntimeFactory(path.join(location, 'source.html'))();
  check(`${suite}: native terminal report`, report.ok && report.errors.length === 0 && report.count === report.passed);
  check(`${suite}: source binding`, report.sourceHtmlSha256 === expected && report.expectedHtmlSha256 === expected && sha(fs.readFileSync(path.join(location, 'source.html'))) === expected);
  check(`${suite}: runner archive`, sha(fs.readFileSync(path.join(location, 'runner-executed.mjs'))) === report.runnerSha256);
  check(`${suite}: main HTTP bodies`, report.documentHashes.length > 0 && report.documentHashes.every(row => row.sha256 === expected));
  check(`${suite}: explicit evidence bounds`, report.naturalGameplayClaim === false && report.productionCapture === false && report.fixtureInjectionAfterBoot === false && report.gameStateMutationAfterBoot === false);
  check(`${suite}: cleanup`, report.cleanup.browserClosed && report.cleanup.contextsClosed && report.cleanup.httpServerClosed);
  for (const scene of report.scenes) check(`${suite}: input ${scene.name}`, sha(fs.readFileSync(path.join(location, scene.inputFile))) === scene.inputSha256);
  let writerCount = 0, screenshotCount = 0;
  for (const entry of fs.readdirSync(location, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const bytes = fs.readFileSync(path.join(location, entry.name));
    inventory.push({ path: `${suite}/${entry.name}`, size: bytes.length, sha256: sha(bytes) });
    if (entry.name.endsWith('-save.json')) {
      writerCount++;
      check(`${suite}: native writer validates ${entry.name}`, runtime.api.validate({ raw: bytes.toString('utf8'), sourceCategory: 'primary' }).ok);
    }
    if (entry.name.endsWith('.png')) {
      screenshotCount++;
      check(`${suite}: PNG ${entry.name}`, bytes.length > 1024 && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a');
    }
  }
  summaries.push({ suite, count: report.count, passed: report.passed, reportSha256: sha(fs.readFileSync(path.join(location, 'report.json'))), runnerSha256: report.runnerSha256, mainHttpBodies: report.documentHashes.length, writerCount, screenshotCount, browserVersion: report.browserVersion, cleanup: report.cleanup, ...(suite === 'camp-rest' ? { scenarios: report.scenarioResults, visibility: report.visibility } : { crossDayBrowser: report.crossDayBrowser }) });
  const references = {
    sharedFixtureHelperSha256: 'scripts/lib/source-runtime-fixture.mjs',
    ioAdapterSourceSha256: 'scripts/check-report-recovery.mjs',
    captureMetaSha256: 'scripts/fixtures/npc-threat-attention-v1/capture-meta.json',
    sourceFixtureSha256: 'scripts/fixtures/npc-threat-attention-v1/browser-writer-day1-1110-save21.json'
  };
  const sidecar = path.join(dir, 'provenance-sidecars'); fs.mkdirSync(sidecar, { recursive: true });
  for (const [field, relative] of Object.entries(references)) {
    const bytes = fs.readFileSync(path.join(repo, relative));
    check(`${suite}: dependency ${field}`, sha(bytes) === report[field]);
    const file = relative.replaceAll('/', '__'); fs.writeFileSync(path.join(sidecar, file), bytes);
  }
}
{
  const location = path.join(dir, 'episode');
  const reportBytes = fs.readFileSync(path.join(location, 'report.json'));
  const report = JSON.parse(reportBytes);
  const runnerBytes = fs.readFileSync(path.join(location, 'runner-executed.mjs'));
  const runnerText = runnerBytes.toString('utf8');
  const runtime = sourceRuntimeFactory(path.join(location, 'source.html'))();
  const payload = JSON.parse(fs.readFileSync(path.join(location, 'saved-after-reload.json')));
  check('episode: native terminal report', report.ok && report.count === 12 && report.passed === 12 && report.errors.length === 0);
  check('episode: source binding', report.sourceHtmlSha256 === expected && sha(fs.readFileSync(path.join(location, 'source.html'))) === expected);
  check('episode: main HTTP bodies', report.documentHashes.length === 2 && report.documentHashes.every(hash => hash === expected));
  check('episode: unchanged runner', sha(runnerBytes) === 'a91f58668aae7f0d5e2132fc5712bb4fca1f30cee403cadf7949bccea20f5be5');
  check('episode: exported persisted payload validates', runtime.api.validatePayload(payload).ok);
  check('episode: awaited cleanup in executed runner', runnerText.includes('await context.close();') && runnerText.includes('if (browser) await browser.close();') && runnerText.includes('await new Promise(resolve => server.close(resolve));'));
  check('episode: explicit fixture scope', report.mode === 'explicit-old-writer-boot-fixture' && report.naturalGameplay === false);
  for (const entry of fs.readdirSync(location, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const bytes = fs.readFileSync(path.join(location, entry.name));
    inventory.push({ path: `episode/${entry.name}`, size: bytes.length, sha256: sha(bytes) });
    if (entry.name.endsWith('.png')) check(`episode: PNG ${entry.name}`, bytes.length > 1024 && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a');
  }
  summaries.push({ suite: 'episode', count: report.count, passed: report.passed, reportSha256: sha(reportBytes), runnerSha256: sha(runnerBytes), mainHttpBodies: 2, rawWriterCount: 0, exportedPersistedPayloadCount: 1, screenshotCount: 2, browserVersion: report.browserVersion, cleanup: 'actual process exit0 after runner awaited context/browser/server close; native report has no cleanup field' });
}
const result = { schema: 'BrowserRegressionArtifactVerificationV1', sourceHtmlSha256: expected, scope: '19cb derived fixture browser regressions only, not natural gameplay, no production claim', ok: rows.every(row => row.ok), count: rows.length, passed: rows.filter(row => row.ok).length, summaries, checks: rows, inventory };
fs.writeFileSync(path.join(dir, 'artifact-verification.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ok: result.ok, count: result.count, passed: result.passed, summaries }, null, 2));
process.exitCode = result.ok ? 0 : 1;
