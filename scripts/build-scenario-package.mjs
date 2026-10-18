#!/usr/bin/env node
// Embed the validated authored package and shared pure core in the standalone
// deployment HTML. This builds data/code bytes; it does not execute gameplay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateScenarioPackage, compileScenarioEvents, createScenarioSnapshot} from './lib/scenario-package-v1.mjs';

assert.ok(process.argv.length === 2 || process.argv.length === 3 && process.argv[2] === '--check', 'usage: node scripts/build-scenario-package.mjs [--check]');
const checkOnly = process.argv[2] === '--check';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root,'dist/index.html'), corePath = path.join(root,'scripts/lib/scenario-package-v1.mjs'), packagePath = path.join(root,'scripts/fixtures/scenario-zombie-harvest-v1.json');
const html = fs.readFileSync(htmlPath,'utf8'), core = fs.readFileSync(corePath,'utf8'), packageBytes = fs.readFileSync(packagePath), pkg = JSON.parse(packageBytes);
const valid = validateScenarioPackage(pkg); assert.equal(valid.ok,true,valid.issues.join(','));
const compiled = compileScenarioEvents(pkg); createScenarioSnapshot(pkg);
const start = '// SCENARIO_C1_CORE_START', end = '// SCENARIO_C1_CORE_END';
const bounds = text => {
  assert.equal(text.split(start).length,2,'one shared core start');
  assert.equal(text.split(end).length,2,'one shared core end');
  const a=text.indexOf(start), b=text.indexOf(end)+end.length;
  assert.ok(b>a); return [a,b];
};
const [a,b]=bounds(html), [c,d]=bounds(core);
let result=html.slice(0,a)+core.slice(c,d)+html.slice(b);
const declaration=/^    const SCENARIO_BOOT_PACKAGE = observerDeepFreeze\((\{[^\r\n]*\})\);/gm;
assert.equal([...result.matchAll(declaration)].length,1,'one package declaration');
const json=JSON.stringify(pkg).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
result=result.replace(declaration,()=> '    const SCENARIO_BOOT_PACKAGE = observerDeepFreeze('+json+');');
// This one built-in content package has an authored JSON source. Older HTML
// without its mount remains a valid target; no general graph compiler is added.
let watchpostPackageBytes = null;
if (result.includes('/* WATCHPOST_MANUAL_PACK_BEGIN */') || result.includes('/* WATCHPOST_MANUAL_PACK_END */')) {
  assert.equal(result.split('/* WATCHPOST_MANUAL_PACK_BEGIN */').length,2,'one watchpost package start');
  assert.equal(result.split('/* WATCHPOST_MANUAL_PACK_END */').length,2,'one watchpost package end');
  watchpostPackageBytes=fs.readFileSync(path.join(root,'content/packs/watchpost-manual-v1.json'));
  const watchpost=JSON.parse(watchpostPackageBytes);
  assert.ok(watchpost.schemaVersion===1&&watchpost.id==='watchpost-manual-v1'&&watchpost.version===1&&watchpost.definition?.chainId==='watchpost-003'&&watchpost.definition.definitionVersion===1,'supported built-in watchpost package');
  const watchpostDeclaration=/^    const WATCHPOST_MANUAL_PACK = observerDeepFreeze\((\{[^\r\n]*\})\);/gm;
  assert.equal([...result.matchAll(watchpostDeclaration)].length,1,'one watchpost declaration');
  const watchpostJson=JSON.stringify(watchpost).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  result=result.replace(watchpostDeclaration,()=> '    const WATCHPOST_MANUAL_PACK = observerDeepFreeze('+watchpostJson+');');
}
const changed=result!==html;
if(!checkOnly && changed) fs.writeFileSync(htmlPath,result,'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
console.log(JSON.stringify({runner:'scenario-package-build-v1',ok:!checkOnly||!changed,mode:checkOnly?'check':'sync',changed,sourceHtmlSha256:sha(checkOnly?html:result),coreModuleSha256:sha(core),authoredPackageSha256:sha(packageBytes),...(watchpostPackageBytes?{watchpostPackageSha256:sha(watchpostPackageBytes)}:{}),compilerVersion:compiled.compilerVersion,catalogDigest:compiled.catalogDigest,scope:'validated inline build parity only; no runtime or browser acceptance'}));
if(checkOnly && changed)process.exitCode=1;

