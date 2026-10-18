import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// One regression contract; each child executes the actual inline runtime.
const args = {};
assert.equal((process.argv.length - 2) % 2, 0, 'argument pairs');
for (let i = 2; i < process.argv.length; i += 2) {
  assert.ok(['--repo-root','--html','--out','--expect-html-sha256','--validate-only'].includes(process.argv[i]));
  assert.ok(!Object.hasOwn(args, process.argv[i])); args[process.argv[i]] = process.argv[i + 1];
}
assert.ok(args['--repo-root'] && args['--out']);
assert.match(args['--expect-html-sha256'] || '', /^[a-f0-9]{64}$/);
if (args['--validate-only'] !== undefined) assert.equal(args['--validate-only'], 'true');
const root = path.resolve(args['--repo-root']);
const html = path.resolve(args['--html'] || path.join(root, 'dist/index.html'));
const out = path.resolve(args['--out']);
const scripts = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(scripts, 'fixtures/day-cover-follow-v1');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ref = (file, label) => { const bytes = fs.readFileSync(file); return { path: label, sha256: sha(bytes), bytes: bytes.length }; };
assert.equal(ref(html, 'html').sha256, args['--expect-html-sha256']);
for (const name of ['scripts/lib/source-runtime-fixture.mjs','scripts/check-report-recovery.mjs']) assert.ok(fs.statSync(path.join(root, name)).isFile(), name);
assert.ok(!fs.existsSync(out), 'fresh output directory');
const originFile = path.join(fixtures, 'origin.json');
const origin = JSON.parse(fs.readFileSync(originFile, 'utf8'));
assert.equal(origin.schema, 'DayCoverFollowFixtureOriginV1');
const cases = [
  { id: 'trajectory', runner: 'lib/day-cover-trajectory-fixture.mjs', fixture: 'trajectory-preboot-native.json', count: 5, status: 'CONTROLLED_FOLLOW_VERIFIED' },
  ...['radio','carpenter','quartermaster'].map(subject => ({ id: 'crew-' + subject, subject, runner: 'lib/day-cover-crew-fixture.mjs', fixture: subject + '-preboot-native.json', count: 7, status: 'CONTROLLED_CREW_PAUSE_RESUME_VERIFIED' })),
  { id: 'saved-ring-boundary', runner: 'lib/day-cover-epsilon-fixture.mjs', fixture: 'legacy-bd8-ring-normal-native.json', count: 3, status: 'SAVED_RING_BOUNDARY_VERIFIED' }
];
const inputFiles = [
  [html, 'tested-html'], [fileURLToPath(import.meta.url), 'scripts/check-day-cover-follow-v1.mjs'],
  [originFile, 'scripts/fixtures/day-cover-follow-v1/origin.json'],
  ...['scripts/lib/source-runtime-fixture.mjs','scripts/check-report-recovery.mjs'].map(name => [path.join(root,name), name]),
  ...[...new Set(cases.map(c => c.runner))].map(name => [path.join(scripts,name),'scripts/' + name]),
  ...cases.map(c => [path.join(fixtures,c.fixture),'scripts/fixtures/day-cover-follow-v1/' + c.fixture])
];
for (const c of cases) {
  const f = origin.fixtures.find(x => x.file === c.fixture);
  assert.ok(f && f.sha256 && f.testOnly === true, c.fixture);
  assert.equal(ref(path.join(fixtures,c.fixture),c.fixture).sha256, f.sha256, 'fixture binding');
}
for (const m of origin.originalMethods) assert.equal(ref(path.join(scripts,m.file),m.file).sha256,m.sha256,'original method bytes');
const before = inputFiles.map(([file,label]) => ref(file,label));
if (args['--validate-only']) {
  for (const c of cases) {
    const f = origin.fixtures.find(x => x.file === c.fixture);
    const argv = [path.join(scripts,c.runner),'--root',root,'--html',html,'--input',path.join(fixtures,c.fixture),'--out',path.join(out,c.id),'--expect-html-sha256',args['--expect-html-sha256'],'--expect-input-sha256',f.sha256,...(c.subject ? ['--subject',c.subject] : []),'--validate-only','true'];
    const result = spawnSync(process.execPath,argv,{encoding:'utf8',timeout:30000});
    assert.equal(result.status,0,result.stderr || result.error?.message || c.id);
  }
  assert.ok(!fs.existsSync(out),'binding preflight must not create game output');
  console.log(JSON.stringify({status:'METHOD_BINDINGS_VALIDATED_NO_RUNTIME',caseCount:cases.length,sourceHtmlSha256:args['--expect-html-sha256']}));
  process.exit(0);
}
fs.mkdirSync(out,{recursive:true});
const write = (name,value) => fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');
const report = {schema:'DayCoverFollowRegressionV1',status:'RUNNING',sourceHtmlSha256:args['--expect-html-sha256'],startedAt:new Date().toISOString(),uniqueContracts:1,naturalGameplay:false,browser:false,scope:'Four unchanged actual source-VM processes plus one actual old-writer ring-boundary process; no fresh game or natural rescue claim.',inputs:before,cases:[],errors:[]};
fs.copyFileSync(fileURLToPath(import.meta.url),path.join(out,'runner-executed.mjs'));
fs.copyFileSync(originFile,path.join(out,'fixture-origin-executed.json'));
write('report.json',report);
for (const c of cases) {
  const fixture = origin.fixtures.find(x => x.file === c.fixture);
  const childOut = path.join(out,c.id);
  const argv = [path.join(scripts,c.runner),'--root',root,'--html',html,'--input',path.join(fixtures,c.fixture),'--out',childOut,'--expect-html-sha256',args['--expect-html-sha256'],'--expect-input-sha256',fixture.sha256,...(c.subject ? ['--subject',c.subject] : [])];
  const began = Date.now();
  const child = spawnSync(process.execPath,argv,{encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  fs.writeFileSync(path.join(out,c.id+'-stdout.log'),child.stdout || '');
  fs.writeFileSync(path.join(out,c.id+'-stderr.log'),child.stderr || '');
  const row = {id:c.id,command:[process.execPath,...argv],exitCode:child.status,signal:child.signal,elapsedMs:Date.now()-began,processError:child.error?.message || null,artifactsVerified:0,ok:false};
  try {
    assert.equal(child.status,0,child.stderr || child.error?.message || 'child exit');
    const file = path.join(childOut,'report.json'); const native = JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(native.ok,true,'native report.ok');
    assert.equal(native.status,c.status,'native terminal status');
    assert.equal(native.sourceHtmlSha256,args['--expect-html-sha256']);
    assert.equal(native.inputSha256,fixture.sha256);
    assert.equal(native.count,c.count,'declared method scope'); assert.equal(native.passed,native.count);
    assert.equal(native.checks.length,native.count); assert.ok(native.checks.every(x => x.ok === true));
    for (const a of native.artifacts) {
      const resolved = path.resolve(childOut,a.path); assert.ok(resolved.startsWith(childOut+path.sep),'artifact containment');
      const actual = ref(resolved,a.path); assert.equal(actual.sha256,a.sha256); assert.equal(actual.bytes,a.bytes); row.artifactsVerified++;
    }
    row.report = ref(file,c.id+'/report.json'); row.internalChecks = native.count; row.ok = true;
  } catch(e) { row.error = e.message; report.errors.push({case:c.id,message:e.message}); }
  report.cases.push(row); write('report.json',report);
}
const after = inputFiles.map(([file,label]) => ref(file,label));
report.inputsUnchanged = JSON.stringify(before) === JSON.stringify(after);
if (!report.inputsUnchanged) report.errors.push({type:'input-drift',message:'actual methods / fixtures / source dependencies changed during execution'});
report.finishedAt = new Date().toISOString();
report.processCount = report.cases.length; report.passedProcesses = report.cases.filter(c => c.ok).length;
report.internalChecks = report.cases.reduce((n,c) => n + (c.internalChecks || 0),0);
report.ok = report.errors.length === 0 && report.processCount === cases.length && report.passedProcesses === cases.length;
report.status = report.ok ? 'VERIFIED' : 'FAILED'; write('report.json',report);
console.log(JSON.stringify({status:report.status,processes:report.processCount,passed:report.passedProcesses,internalChecks:report.internalChecks,uniqueContracts:1,inputsUnchanged:report.inputsUnchanged}));
process.exitCode = report.ok ? 0 : 1;
