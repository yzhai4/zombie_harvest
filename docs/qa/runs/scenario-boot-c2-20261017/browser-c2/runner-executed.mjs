import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// TEST-ONLY boot fixtures. Browser actions use visible public controls. The
// complete native inputs were captured by the separate controlled source VM;
// this runner never calls a page hook, patches GameState or fabricates receipts.
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const flag = process.argv[i];
  assert.ok(['--run-approved','--repo-root','--html','--expect-html-sha256','--capture-report','--expect-capture-sha256','--c1-input','--expect-c1-input-sha256','--out','--budget-seconds'].includes(flag) && process.argv[i + 1] && !options[flag], 'named CLI pairs required');
  options[flag] = process.argv[i + 1];
}
assert.equal(options['--run-approved'], 'yes');
const root = options['--repo-root'] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const flag of ['--html','--capture-report','--out']) assert.ok(path.isAbsolute(options[flag] || ''), flag + ' ABS required');
assert.ok(path.isAbsolute(root));
for (const flag of ['--expect-html-sha256','--expect-capture-sha256']) assert.match(options[flag] || '', /^[a-f0-9]{64}$/);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = readFileSync(options['--html']), sourceHash = sha(source), runner = readFileSync(fileURLToPath(import.meta.url));
assert.equal(sourceHash, options['--expect-html-sha256']);
const out = options['--out']; assert.equal(existsSync(out), false); mkdirSync(out, { recursive: true });
let privateOutput = { platform: process.platform, aclVerified: false };
if (process.platform === 'win32') {
  const sid = execFileSync('whoami', ['/user','/fo','csv','/nh'], { encoding: 'utf8', windowsHide: true }).match(/S-1-[0-9-]+/)?.[0]; assert.ok(sid);
  execFileSync('icacls', [out, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true });
  const escaped = out.replaceAll("'", "''");
  const command = `$a=[System.IO.Directory]::GetAccessControl('${escaped}'); [pscustomobject]@{protected=$a.AreAccessRulesProtected;rules=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]) | ForEach-Object {[pscustomobject]@{sid=$_.IdentityReference.Value;rights=[string]$_.FileSystemRights;type=[string]$_.AccessControlType;inherited=$_.IsInherited}})} | ConvertTo-Json -Compress -Depth 5`;
  const acl = JSON.parse(execFileSync('powershell.exe', ['-NoProfile','-NonInteractive','-Command',command], { encoding: 'utf8', windowsHide: true }));
  assert.ok(acl.protected && acl.rules.length && acl.rules.every(r => r.sid === sid && r.type === 'Allow' && r.rights.includes('FullControl') && !r.inherited));
  privateOutput = { platform: 'win32', aclVerified: true, inheritanceDisabled: true, allowedPrincipal: 'current-user-only' };
}
const { sourceRuntimeFactory, saveKey } = await import(pathToFileURL(path.join(root, 'scripts/lib/source-runtime-fixture.mjs')));
const { compileScenarioEvents } = await import(pathToFileURL(path.join(root, 'scripts/lib/scenario-package-v1.mjs')));
const captureBytes = readFileSync(options['--capture-report']); assert.equal(sha(captureBytes), options['--expect-capture-sha256']);
const capture = JSON.parse(captureBytes); assert.equal(capture.baseSourceHtmlSha256, sourceHash); assert.equal(capture.status, 'CONTROLLED_SOURCE_VM_NATIVE_INPUTS_CAPTURED');
const c1Path = options['--c1-input'] || path.join(root, 'docs/qa/runs/scenario-boot-c1-20261017/browser/boot-c1/default-button-initial-native-binding-save.json');
assert.ok(path.isAbsolute(c1Path)); const c1 = readFileSync(c1Path), expectedC1 = options['--expect-c1-input-sha256'] || '80d41c43a8ea07759aa88a852062b74f889b59c8e4edfc488d34f0e198c13d0e';
assert.match(expectedC1, /^[a-f0-9]{64}$/); assert.equal(sha(c1), expectedC1);
const budgetSeconds = Number(options['--budget-seconds'] || 180); assert.ok(Number.isInteger(budgetSeconds) && budgetSeconds > 0 && budgetSeconds <= 300);
const startedAt = Date.now(), deadline = startedAt + budgetSeconds * 1000;
const report = { schema: 'ScenarioBootC2BrowserV1', runner: 'browser-scenario-boot-c2', runnerSha256: sha(runner), sourceHtmlSha256: sourceHash,
  captureReportSha256: sha(captureBytes), knownC1InputSha256: sha(c1), privateOutput, naturalGameplay: false, naturalGameplayClaim: false,
  mode: 'real-Chrome-public-actions-with-complete-source-native-preboot-fixtures',
  scope: { canonical: 'public new start, initial content binding and reload; known C1 migration; explicit invalid inputs', variants: 'food0 v2/v3 independent HTML SHA and native active inputs, public Choice +2/+1 and reload', calendarCrossDayBrowser: false, actorKnowledgeProjection: false, fullConfigurationGui: false,
    sourceCapture: 'controlled source VM start/hook/native writer; no enemy deletion, repositioning or live GameState patch; not natural active-event discovery', validator: 'separate actual source VM start + readonly native-save validator; not browser gameplay', IOObservationInstrumentation: 'preboot complete save installation; pass-through Storage.setItem/setInterval/clearInterval observation with originals restored' },
  parameters: { source: 'artifact:source.html', captureReport: 'artifact:source-capture/capture-report.json', c1Input: 'artifact:known-c1-original-writer.json', output: 'artifact:./', dependencyRoot: options['--repo-root'] ? 'explicit frozen repository' : 'installed repository relative', budgetSeconds },
  artifacts: [], checks: [], errors: [], scenes: [], allMainDocuments: [], cleanup: null };
const artifact = (name, bytes) => { mkdirSync(path.dirname(path.join(out, name)), { recursive: true }); writeFileSync(path.join(out, name), bytes); report.artifacts.push({ file: name.replaceAll('\\','/'), bytes: Buffer.byteLength(bytes), sha256: sha(bytes) }); };
const equal = (a,b) => { try { assert.deepStrictEqual(a,b); return true; } catch { return false; } };
const plain = v => JSON.parse(JSON.stringify(v));
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); };
const remaining = () => { const n = deadline - Date.now(); assert.ok(n > 0, 'bounded browser budget exhausted'); return n; };
const packageLine = text => { const m = text.match(/^    const SCENARIO_BOOT_PACKAGE = observerDeepFreeze\((.+)\);$/m); assert.ok(m); return { line: m[0], value: JSON.parse(m[1]) }; };
const optionsLine = text => { const m = text.match(/^    const SCENARIO_BOOT_OPTIONS = observerDeepFreeze\(.+\);$/m); assert.ok(m); return m[0]; };
const coreBlock = text => text.slice(text.indexOf('// SCENARIO_C1_CORE_START'), text.indexOf('// SCENARIO_C1_CORE_END') + '// SCENARIO_C1_CORE_END'.length);
const canonicalText = source.toString('utf8'), canonicalPackage = packageLine(canonicalText), canonicalOptions = optionsLine(canonicalText);
const coreBytes = readFileSync(path.join(root, 'scripts/lib/scenario-package-v1.mjs')); assert.equal(coreBlock(canonicalText), coreBlock(coreBytes.toString('utf8')));
const helperBytes = readFileSync(path.join(root, 'scripts/lib/source-runtime-fixture.mjs')), adapterBytes = readFileSync(path.join(root, 'scripts/check-report-recovery.mjs')), sprites = readFileSync(path.join(root, 'dist/actor-sprites.js'));
Object.assign(report, { scenarioCoreModuleSha256: sha(coreBytes), sourceRuntimeHelperSha256: sha(helperBytes), ioAdapterSha256: sha(adapterBytes), actorSpritesSha256: sha(sprites) });
for (const [file,bytes] of [['source.html',source],['runner-executed.mjs',runner],['scenario-core-executed.mjs',coreBytes],['source-runtime-fixture-executed.mjs',helperBytes],['io-adapter-executed.mjs',adapterBytes],['actor-sprites-executed.js',sprites],['known-c1-original-writer.json',c1],['source-capture/capture-report.json',captureBytes]]) artifact(file,bytes);
const captureFiles = new Map();
for (const ref of capture.artifacts) {
  assert.ok(ref.path && !path.isAbsolute(ref.path) && !ref.path.split(/[\\/]/).includes('..'));
  const bytes = readFileSync(path.join(path.dirname(options['--capture-report']), ref.path)); assert.equal(sha(bytes), ref.sha256); assert.equal(bytes.length, ref.bytes);
  artifact('source-capture/' + ref.path, bytes); captureFiles.set(ref.path, bytes);
}
const validators = new Map();
function validator(htmlPath) { if (!validators.has(htmlPath)) { const r = sourceRuntimeFactory(htmlPath)(); assert.equal(r.api.start().ok, true); validators.set(htmlPath,r); } return validators.get(htmlPath); }
const canonicalValidator = validator(options['--html']);
function inputPayload(raw) { const parsed = JSON.parse(raw.toString('utf8')); assert.ok(parsed.payload && typeof parsed.checksum === 'string'); return parsed.payload; }
const variantScenes = ['v2','v3'].map((name,i) => {
  const s = capture.scenes.find(s => s.id === name); assert.ok(s); assert.equal(s.definitionVersion, i + 2); assert.equal(s.foodGain, 2 - i);
  const bytes = captureFiles.get(s.sourceHtml.path), raw = captureFiles.get(s.activeNative.path); assert.ok(bytes && raw);
  const text = bytes.toString('utf8'), pkg = packageLine(text), opts = optionsLine(text);
  assert.equal(text.replace(pkg.line, canonicalPackage.line).replace(opts, canonicalOptions), canonicalText, 'variant changes only complete package/options declarations');
  const optionLiteral = opts.match(/^    const SCENARIO_BOOT_OPTIONS = observerDeepFreeze\((.+)\);$/); assert.ok(optionLiteral);
  assert.deepStrictEqual(JSON.parse(optionLiteral[1]), { seed: 0x5eedc0de, difficultyProfile: 'standard', worldConfig: { foodMultiplier: 0 } });
  if (name === 'v2') assert.equal(pkg.line, canonicalPackage.line);
  const compiled = compileScenarioEvents(pkg.value), definition = compiled.definitions.find(d => d.id === 'zh-food-shortage-001'); assert.ok(definition); assert.equal(definition.definitionVersion, i + 2);
  assert.equal(pkg.value.events.storylets[0].source.food, 2 - i); assert.equal(definition.nodes[0].choices.find(c => c.id === 'forage').effects.find(e => e.op === 'addResource').value, 2 - i);
  const sourceFile = `source-${name}.html`; artifact(sourceFile,bytes); const inputFile = `${name}-active-original-writer.json`; artifact(inputFile,raw);
  const v = validator(path.join(out,sourceFile)); assert.equal(v.api.validate({raw:raw.toString('utf8'),sourceCategory:'primary'}).ok,true);
  const p = inputPayload(raw), active = p.contentState.activeChains['zh-food-shortage-001']; assert.equal(p.food,0); assert.equal(active.definitionVersion,i+2); assert.equal(p.scenarioSnapshot.seed,0x5eedc0de);
  return { id:`${name}-public-forage`, kind:'choice', html:bytes, sourceFile, raw:raw.toString('utf8'), inputFile, compiled, input:p, active, version:i+2, foodGain:2-i, variant:true };
});
check('complete known C1 original writer passes actual installed-source validator',canonicalValidator.api.validate({raw:c1.toString('utf8'),sourceCategory:'primary'}).ok);
const unknown = plain(variantScenes[0].input); unknown.scenarioSnapshot.contentBinding.catalogDigest = 'fnv1a-utf16-canonical-hex-v1:00000000';
const unknownRaw = JSON.stringify({version:unknown.version,payload:unknown,checksum:canonicalValidator.api.hash(unknown),savedAt:(unknown.day-1)*1440+unknown.hour*60+unknown.minute,reason:'TEST-ONLY-unknown-content-digest'});
artifact('TEST-ONLY-unknown-content-digest-primary.json',unknownRaw);
check('unknown content digest fixture is rejected by actual installed-source validator',!canonicalValidator.api.validate({raw:unknownRaw,sourceCategory:'primary'}).ok);
const badPackage = plain(canonicalPackage.value), second = plain(badPackage.events.storylets[0]);
second.id = second.chainId = 'test-only-late-invalid'; second.source.id = 'test-only-late-source'; second.source.flag = 'test-only-late-flag';
for (const choice of second.nodes[0].choices) { for (const gate of choice.requires) if (gate.type === 'flag') gate.id = second.source.flag; for (const effect of choice.effects) { if (effect.op === 'unlock') effect.key = second.source.flag; if (effect.op === 'recordHistory') { effect.key = second.id + ':' + choice.id; if (effect.payload.sourceId) effect.payload.sourceId = second.source.id; } } }
second.nodes[0].choices[1].effects.push({op:'TEST-ONLY-unsupported-operation'}); badPackage.events.storylets.push(second); badPackage.events.registry.push({kind:'eventChain',id:second.id});
const badHtml = Buffer.from(canonicalText.replace(canonicalPackage.line,`    const SCENARIO_BOOT_PACKAGE = observerDeepFreeze(${JSON.stringify(badPackage)});`)); artifact('source-TEST-ONLY-late-invalid.html',badHtml);
assert.equal(badHtml.toString('utf8').replace(packageLine(badHtml.toString('utf8')).line,canonicalPackage.line),canonicalText);
const canonicalCompiled = compileScenarioEvents(canonicalPackage.value);
const scenes = [
  {id:'canonical-newstart-reload',kind:'fresh',html:source,sourceFile:'source.html',compiled:canonicalCompiled,variant:false},
  ...variantScenes,
  {id:'known-c1-migration',kind:'c1',html:source,sourceFile:'source.html',raw:c1.toString('utf8'),input:inputPayload(c1),inputFile:'known-c1-original-writer.json',compiled:canonicalCompiled,variant:false},
  {id:'unknown-content-digest',kind:'reject',html:source,sourceFile:'source.html',raw:unknownRaw,backup:variantScenes[0].raw,inputFile:'TEST-ONLY-unknown-content-digest-primary.json',variant:false},
  {id:'late-invalid-package',kind:'reject-package',html:badHtml,sourceFile:'source-TEST-ONLY-late-invalid.html',raw:variantScenes[0].raw,backup:c1.toString('utf8'),variant:true}
];
report.plannedScenes = scenes.map(s=>({id:s.id,kind:s.kind,htmlSha256:sha(s.html),variant:s.variant,sourceRef:`artifact:${s.sourceFile}`}));
const routes = new Map(scenes.map(s=>[`/${s.id}.html`,s.html]));
const server = createServer((req,res)=>{const route=new URL(req.url,'http://localhost').pathname;if(routes.has(route)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(routes.get(route));}else if(route==='/actor-sprites.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(sprites);}else if(route==='/favicon.ico'){res.writeHead(204);res.end();}else{res.writeHead(404);res.end();}});
let browser; const contexts=[], httpPending=[];
const id='zh-food-shortage-001',flag='zh-shortage-cache-retrieved';
const contentAdapters=p=>p.worldMeta.events.filter(e=>e.type==='save.migrated'&&e.payload.scenarioContentAdapters?.some(a=>a.adapter==='scenario-content-binding-v1'));
const resolved=p=>p.worldMeta.events.filter(e=>e.type==='content.chain.resolved'&&e.defId===id&&e.payload.choiceId==='forage');
try {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {chromium}=createRequire(import.meta.url)(process.env.ZH_PLAYWRIGHT_MODULE||'playwright');browser=await chromium.launch({headless:true,channel:process.env.ZH_BROWSER_CHANNEL||'chrome'});report.browserVersion=browser.version();
  for(const scene of scenes){
    remaining();const result={id:scene.id,kind:scene.kind,htmlSha256:sha(scene.html),canonicalBytes:sha(scene.html)===sourceHash,fixtureNaturalGameplay:false,verified:false,writers:[],IOrestoration:[]};report.scenes.push(result);
    const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);
    await context.addInitScript(({key,raw,backup})=>{
      if(!sessionStorage.getItem('qa-c2-input-installed')){localStorage.clear();if(raw)localStorage.setItem(key,raw);if(backup)localStorage.setItem(key+'.bak',backup);sessionStorage.setItem('qa-c2-input-installed','yes');}
      const nativeSet=Storage.prototype.setItem,nativeInterval=window.setInterval,nativeClear=window.clearInterval;
      const io={primaryWrites:[],backupWrites:[],intervals:[],clears:[],restorations:[]};
      const set=function(...args){const value=Reflect.apply(nativeSet,this,args);if(this===localStorage&&args[0]===key)io.primaryWrites.push({raw:String(args[1]),at:performance.now()});if(this===localStorage&&args[0]===key+'.bak')io.backupWrites.push({raw:String(args[1]),at:performance.now()});return value;};
      const interval=function(...args){const value=Reflect.apply(nativeInterval,this,args);io.intervals.push({id:value,delay:Number(args[1]),at:performance.now()});return value;};
      const clear=function(...args){const value=Reflect.apply(nativeClear,this,args);io.clears.push({id:args[0]??null,at:performance.now()});return value;};
      Storage.prototype.setItem=set;window.setInterval=interval;window.clearInterval=clear;
      window.__scenarioC2BrowserIO={read:()=>structuredClone(io),restore(stage){Storage.prototype.setItem=nativeSet;window.setInterval=nativeInterval;window.clearInterval=nativeClear;const proof={stage,storageOriginal:Storage.prototype.setItem===nativeSet,intervalOriginal:window.setInterval===nativeInterval,clearOriginal:window.clearInterval===nativeClear};io.restorations.push(proof);return proof;}};
    },{key:saveKey,raw:scene.raw||null,backup:scene.backup||null});
    const page=await context.newPage();page.setDefaultTimeout(15000);
    page.on('pageerror',e=>report.errors.push({scene:scene.id,type:'pageerror',message:e.message}));page.on('console',m=>{if(m.type()==='error')report.errors.push({scene:scene.id,type:'console',message:m.text()});});
    page.on('response',response=>{if(!response.request().isNavigationRequest()||response.frame()!==page.mainFrame())return;const task=(async()=>{const body=await response.body(),hash=sha(body);report.allMainDocuments.push({scene:scene.id,status:response.status(),sha256:hash,bodyRef:`artifact:${scene.sourceFile}`,canonicalBytes:hash===sourceHash});if(response.status()!==200||hash!==sha(scene.html)||!body.equals(scene.html))report.errors.push({scene:scene.id,type:'main-document-source',sha256:hash});})();httpPending.push(task.catch(e=>report.errors.push({scene:scene.id,type:'main-document-read',message:e.message})));});
    const io=()=>page.evaluate(()=>window.__scenarioC2BrowserIO.read());
    const restore=async stage=>{const p=await page.evaluate(stage=>window.__scenarioC2BrowserIO.restore(stage),stage);result.IOrestoration.push(p);check(`${scene.id}: original IO restored at ${stage}`,Object.values(p).slice(1).every(Boolean));};
    const raw=()=>page.evaluate(key=>localStorage.getItem(key),saveKey);
    const registry=()=>page.evaluate(id=>{const api=window.ZombieHarvestContent;return api?{available:true,ids:Object.keys(api.all('eventChain')).sort(),target:api.get('eventChain',id)}:{available:false};},id);
    const snapshot=async(label,bytes=null)=>{const value=bytes??await raw();assert.ok(value);const p=JSON.parse(value).payload;const v=scene.kind==='choice'?validators.get(path.join(out,scene.sourceFile)):canonicalValidator;check(`${scene.id}/${label}: actual source validates complete native writer`,v.api.validate({raw:value,sourceCategory:'primary'}).ok);const file=`${scene.id}-${label}-save.json`;artifact(file,value);result.writers.push({file,sha256:sha(value),reason:JSON.parse(value).reason??null});return p;};
    const first=async label=>{await page.waitForFunction(()=>window.__scenarioC2BrowserIO.read().primaryWrites.length>0,null,{timeout:Math.min(15000,remaining())});const observed=await io();return snapshot(label,observed.primaryWrites[0].raw);};
    const start=async()=>{check(`${scene.id}: public start or continue is enabled`,await page.locator('#continueSaveBtn').isVisible()&&await page.locator('#continueSaveBtn').isEnabled());await page.locator('#continueSaveBtn').click();check(`${scene.id}: public start reaches gameplay`,await page.locator('#startOverlay').isHidden());};
    const reload=async()=>{await restore('before-public-reload');await page.reload({waitUntil:'domcontentloaded'});const before=await snapshot('pagehide-before-continue');await start();const after=await first('reloaded-first-native');return {before,after};};
    await page.goto(`http://127.0.0.1:${server.address().port}/${scene.id}.html`,{waitUntil:'domcontentloaded'});
    const beforeRegistry=await registry();check(`${scene.id}: public committed lookup excludes uninstalled candidate`,beforeRegistry.available&&beforeRegistry.target===null);
    if(scene.kind==='reject'||scene.kind==='reject-package'){
      check(`${scene.id}: public recovery prevents button start`,await page.locator('#startOverlay').isVisible()&&await page.locator('#continueSaveBtn').isDisabled()&&await page.locator('#recoveryStatus').isVisible());
      await page.keyboard.press('Enter');const text=await page.locator('#recoveryStatus').innerText();result.publicRecoveryText=text;
      if(scene.kind==='reject-package')check(`${scene.id}: configuration error is accurately disclosed`,text.includes('场景初始配置')&&text.includes('尚未安装世界')&&text.includes('保存记录保持不变'));
      const clock=await page.locator('#timeLabel').innerText();await page.waitForTimeout(1400);const afterRegistry=await registry(),observed=await io();
      const stored=await page.evaluate(key=>({primary:localStorage.getItem(key),backup:localStorage.getItem(key+'.bak')}),saveKey);
      check(`${scene.id}: exact original primary and backup bytes preserved`,stored.primary===scene.raw&&stored.backup===scene.backup);
      check(`${scene.id}: public Enter rejection installs no first definition`,equal(afterRegistry,beforeRegistry)&&afterRegistry.target===null);result.registryObservation={before:beforeRegistry,after:afterRegistry,source:'existing public ZombieHarvestContent.get/all readonly'};
      check(`${scene.id}: rejected start writes neither primary nor backup and starts no world interval`,observed.primaryWrites.length===0&&observed.backupWrites.length===0&&observed.intervals.filter(t=>t.delay===1200).length===0&&await page.locator('#timeLabel').innerText()===clock);
      artifact(`${scene.id}-preserved-primary.json`,stored.primary);artifact(`${scene.id}-preserved-backup.json`,stored.backup);
    }else{
      if(scene.kind==='fresh')check(`${scene.id}: fresh isolated profile has no primary`,await raw()===null);
      await start();const before=await first('first-native');const installed=await registry();check(`${scene.id}: installed public definition is actual compiled plain data`,equal(installed.target,scene.compiled.definitions.find(d=>d.id===id)));
      check(`${scene.id}: first native content binding matches installed compiled identity`,equal(before.scenarioSnapshot.contentBinding,{version:1,status:'bound',compilerVersion:scene.compiled.compilerVersion,catalogDigest:scene.compiled.catalogDigest,rulesDigest:scene.compiled.rulesDigest,registry:scene.compiled.registry}));
      if(scene.kind==='fresh'){
        const events=before.worldMeta.events.filter(e=>e.type==='scenario.bound');check(`${scene.id}: first writer has one actual provenance binding receipt`,events.length===1&&equal(events[0].payload.contentBinding,before.scenarioSnapshot.contentBinding)&&before.scenarioSnapshot.binding.appliedKeys.includes('events')&&!before.scenarioSnapshot.binding.baselineOnlyKeys.includes('events'));
        await page.screenshot({path:path.join(out,`${scene.id}-initial.png`)});const {before:atReload,after}=await reload();check(`${scene.id}: reload preserves bindings, RNG and finite initial stock without another receipt`,equal(after.scenarioSnapshot,atReload.scenarioSnapshot)&&after.food===atReload.food&&equal(after.resources,atReload.resources)&&after.worldMeta.rngState===atReload.worldMeta.rngState&&after.worldMeta.events.filter(e=>e.type==='scenario.bound').length===1&&contentAdapters(after).length===0);
      }else if(scene.kind==='c1'){
        check(`${scene.id}: original C1 initial binding retained exactly`,equal(before.scenarioSnapshot.binding,scene.input.scenarioSnapshot.binding));
        check(`${scene.id}: migration preserves old world facts and content state`,['day','hour','minute','food','seeds','wood','stone','parts','medicine'].every(k=>before[k]===scene.input[k])&&equal(before.contentState,scene.input.contentState)&&equal(before.npcs,scene.input.npcs)&&equal(before.resources,scene.input.resources)&&before.worldMeta.seed===scene.input.worldMeta.seed&&before.worldMeta.rngState===scene.input.worldMeta.rngState);
        const adapter=contentAdapters(before);check(`${scene.id}: actual automatic migration writer records one explicit content adapter`,adapter.length===contentAdapters(scene.input).length+1&&adapter.at(-1).payload.scenarioContentAdapters.some(a=>a.oldPackageDigest===scene.input.scenarioSnapshot.binding.packageDigest&&a.oldBindingStatus==='bound'&&a.compilerVersion===scene.compiled.compilerVersion&&a.catalogDigest===scene.compiled.catalogDigest&&a.rulesDigest===scene.compiled.rulesDigest));
        const {before:atReload,after}=await reload();check(`${scene.id}: reload repeats no content adapter, world scaling or initial binding`,contentAdapters(after).length===adapter.length&&equal(after.scenarioSnapshot,atReload.scenarioSnapshot)&&after.food===atReload.food&&after.worldMeta.rngState===atReload.worldMeta.rngState&&after.worldMeta.events.filter(e=>e.type==='scenario.bound').length===scene.input.worldMeta.events.filter(e=>e.type==='scenario.bound').length);
      }else{
        check(`${scene.id}: loaded complete native active identity is unchanged`,equal(before.contentState.activeChains[id],scene.active)&&before.food===0&&before.contentState.flags[flag]!==true);
        await page.keyboard.press('j');check(`${scene.id}: public task panel is visible`,await page.locator('#eventText').isVisible());await page.locator('#eventSourceSelect').selectOption('chain:'+id);
        const button=page.locator('#eventChoiceB');check(`${scene.id}: actual forage button is visible and enabled`,await button.isVisible()&&await button.isEnabled());const text=await button.innerText(),dataset=await button.evaluate(node=>({...node.dataset}));result.publicChoice={text,dataset};
        check(`${scene.id}: visible authored amount matches independent expected yield`,text.includes('整局一次')&&text.includes(`食物 +${scene.foodGain}`));
        check(`${scene.id}: rendered complete same-episode token matches native input`,dataset.eventChoiceId==='forage'&&dataset.eventInstanceKey===scene.active.instanceKey&&dataset.eventInstanceId===scene.active.instanceId&&dataset.eventDefId===scene.active.defId&&dataset.eventNodeId===scene.active.nodeId&&dataset.eventDefinitionVersion===String(scene.version));
        await page.screenshot({path:path.join(out,`${scene.id}-before-choice.png`)});await button.click();
        await page.waitForFunction(({key,id,instance})=>{const raw=localStorage.getItem(key);return raw&&JSON.parse(raw).payload.worldMeta.events.some(e=>e.type==='content.chain.resolved'&&e.defId===id&&e.payload.instanceKey===instance&&e.payload.choiceId==='forage');},{key:saveKey,id,instance:scene.active.instanceKey},{timeout:Math.min(15000,remaining())});
        const after=await snapshot('after-public-choice'),events=resolved(after).filter(e=>e.payload.instanceKey===scene.active.instanceKey),event=events[0];
        check(`${scene.id}: public Choice produces one correctly versioned player receipt`,events.length===1&&event.actorId==='player-1'&&event.instanceId===scene.active.instanceId&&event.definitionVersion===scene.version&&event.payload.nodeId===scene.active.nodeId);
        const commands=after.worldMeta.replay.commands.filter(c=>c.commandId===(event.causationId||event.commandId));const command=commands[0];
        check(`${scene.id}: actual player parent command carries all rendered CAS fields`,commands.length===1&&command.type==='content.chain.resolve'&&command.actorId==='player-1'&&command.payload.choiceId==='forage'&&command.payload.expectedInstanceKey===dataset.eventInstanceKey&&command.payload.expectedInstanceId===dataset.eventInstanceId&&command.payload.expectedDefId===dataset.eventDefId&&command.payload.expectedDefinitionVersion===scene.version&&command.payload.expectedNodeId===dataset.eventNodeId);
        const food=event.payload.results.find(e=>e.op==='addResource'&&e.key==='food');
        check(`${scene.id}: actual food delta and receipt are independently +${scene.foodGain}`,after.food===before.food+scene.foodGain&&food.after-food.before===scene.foodGain&&event.effects.filter(e=>e.op==='addResource'&&e.key==='food').length===1&&event.effects.find(e=>e.op==='addResource'&&e.key==='food').value===scene.foodGain);
        const history=after.contentState.history.filter(e=>e.id===`${scene.active.instanceKey}:${id}:forage`);
        check(`${scene.id}: actual finite flag/history/episode completion persist`,after.contentState.flags[flag]===true&&!after.contentState.unlockedWeapons.includes(flag)&&history.length===1&&history[0].payload.sourceId==='zh-shortage-cache-001'&&history[0].payload.amount===scene.foodGain&&history[0].payload.resonancePressure===2&&after.contentState.completedChains.includes(scene.active.instanceKey)&&!after.contentState.activeChains[id]);
        check(`${scene.id}: resonance is an actual +2 meter effect`,event.payload.results.some(e=>e.op==='adjustMeter'&&e.key==='resonancePressure'&&e.after-e.before===2));
        result.receipt={commandId:command.commandId,eventId:event.eventId,instanceKey:scene.active.instanceKey,definitionVersion:scene.version,foodResult:food,historyId:history[0].id};await page.screenshot({path:path.join(out,`${scene.id}-after-choice.png`)});
        const {before:atReload,after:reloaded}=await reload();check(`${scene.id}: reload keeps source exhausted and cannot grant again`,reloaded.food===atReload.food&&reloaded.contentState.flags[flag]===true&&resolved(reloaded).filter(e=>e.payload.instanceKey===scene.active.instanceKey).length===1&&reloaded.contentState.history.filter(e=>e.id===history[0].id).length===1&&!reloaded.contentState.activeChains[id]&&equal(reloaded.scenarioSnapshot,atReload.scenarioSnapshot));
        await page.keyboard.press('j');const current=await page.locator('#eventChoiceB').evaluate(node=>({visible:node.getClientRects().length>0&&!node.hidden,disabled:node.disabled,dataset:{...node.dataset}}));result.reloadedChoice=current;
        check(`${scene.id}: public renderer offers no enabled repeat of completed forage`,!(current.visible&&!current.disabled&&current.dataset.eventChoiceId==='forage'&&current.dataset.eventInstanceKey===scene.active.instanceKey));
      }
    }
    await restore('scene-finally');await page.screenshot({path:path.join(out,`${scene.id}-terminal.png`)});await Promise.all(httpPending);check(`${scene.id}: every observed main body matches its own frozen HTML`,report.allMainDocuments.filter(d=>d.scene===scene.id).length>0&&report.allMainDocuments.filter(d=>d.scene===scene.id).every(d=>d.status===200&&d.sha256===sha(scene.html)));
    result.verified=true;await context.close();
  }
}catch(error){console.error(error.stack||String(error));report.errors.push({type:'runner',message:error.message||String(error)});for(let i=0;i<contexts.length;i++)for(const page of contexts[i].pages())try{await page.screenshot({path:path.join(out,`failure-${i}.png`),timeout:5000});}catch(e){report.errors.push({type:'failure-screenshot',message:e.message});}}
finally{
  for(const context of contexts)for(const page of context.pages())if(!page.isClosed())try{const proof=await page.evaluate(()=>window.__scenarioC2BrowserIO?.restore('outer-finally'));if(proof&&!Object.values(proof).slice(1).every(Boolean))report.errors.push({type:'IO-restore',message:'original IO identity not restored'});}catch(e){report.errors.push({type:'IO-restore',message:e.message});}
  await Promise.all(httpPending);let contextsClosed=true;for(const context of contexts)await context.close().catch(e=>{contextsClosed=false;report.errors.push({type:'context-close',message:e.message});});if(browser)await browser.close().catch(e=>report.errors.push({type:'browser-close',message:e.message}));if(server.listening)await new Promise(resolve=>server.close(resolve));
  report.cleanup={contextsClosed,browserClosed:!browser||!browser.isConnected(),httpServerClosed:!server.listening};report.elapsedWallMs=Date.now()-startedAt;report.count=report.checks.length;report.passed=report.checks.filter(c=>c.ok).length;
  report.ok=report.errors.length===0&&report.count===report.passed&&report.scenes.length===scenes.length&&report.scenes.every(s=>s.verified)&&Object.values(report.cleanup).every(Boolean);
  writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,count:report.count,passed:report.passed,scenes:report.scenes.map(s=>({id:s.id,verified:s.verified})),errors:report.errors,cleanup:report.cleanup},null,2));
}
if(!report.ok)process.exitCode=1;
