import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// PREPARATION ONLY. No candidate VM/browser has been run for this draft.
// Final source freeze, public preference wiring review and root authorization
// are prerequisites. Test IO wrappers preserve originals and do not patch rules.
const opts={};
for(let i=2;i<process.argv.length;i+=2){
  assert.ok(['--run-approved','--repo-root','--html','--expect-html-sha256','--out','--legacy-dir','--budget-seconds'].includes(process.argv[i])&&process.argv[i+1]);
  opts[process.argv[i]]=process.argv[i+1];
}
assert.equal(opts['--run-approved'],'yes','not authorized by a preparation draft');
for(const flag of ['--html','--out'])assert.ok(path.isAbsolute(opts[flag]||''));
assert.match(opts['--expect-html-sha256']||'',/^[a-f0-9]{64}$/);
const root=opts['--repo-root']||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');assert.ok(path.isAbsolute(root));
const out=opts['--out'];assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),source=readFileSync(opts['--html']),runner=readFileSync(fileURLToPath(import.meta.url));
assert.equal(sha(source),opts['--expect-html-sha256']);
const sprites=readFileSync(path.join(root,'dist/actor-sprites.js'));
for(const [name,bytes]of[['runner-executed.mjs',runner],['source.html',source],['actor-sprites-executed.js',sprites]])writeFileSync(path.join(out,name),bytes);
const packageMatches=[...source.toString('utf8').matchAll(/const SCENARIO_BOOT_PACKAGE = observerDeepFreeze\((\{[^\r\n]+\})\);/g)];assert.equal(packageMatches.length,1);
const embeddedPackage=Buffer.from(packageMatches[0][1],'utf8');JSON.parse(embeddedPackage.toString('utf8'));writeFileSync(path.join(out,'embedded-scenario-package.json'),embeddedPackage);
const budgetSeconds=Number(opts['--budget-seconds']||180);assert.ok(Number.isInteger(budgetSeconds)&&budgetSeconds>0&&budgetSeconds<=300);
const startedAt=Date.now(),deadline=startedAt+budgetSeconds*1000,key='zombie-harvest-progress-v12';
const report={schema:'ScenarioBootC1BrowserPreparationV1',sourceHtmlSha256:sha(source),runnerSha256:sha(runner),actorSpritesSha256:sha(sprites),
  embeddedScenarioPackageSha256:sha(embeddedPackage),embeddedScenarioPackageRef:'artifact:embedded-scenario-package.json',packageShaIsDistinctFromSemanticDigest:true,
  mode:'real-public-boot-and-complete-legacy-writer-fixture-browser',naturalGameplay:false,naturalGameplayClaim:false,
  jsonStoryletCompiler:false,playerConfigurationGui:false,variantScope:'deployment HTML boot-options variants; no canonical success transfer',
  observerConsumerProbeScope:'TEST-ONLY literal item passed to existing synchronous readonly comment consumer; not actual NPC dialogue or actor-authorized knowledge projection',
  IOObservationInstrumentation:{primaryStoragePassThrough:true,onePrimaryWriteFaultOnly:true,timerPassThrough:true,gameStatePatch:false,hiddenGameActions:false},
  parameters:{source:'artifact:source.html',out:'artifact:./',dependencyRoot:opts['--repo-root']?'explicit external root':'installed repository relative',budgetSeconds},
  checks:[],errors:[],scenes:[],allMainDocuments:[],cleanup:null};
const check=(name,ok,detail)=>{report.checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});assert.ok(ok,name);};
const equal=(a,b)=>{try{assert.deepStrictEqual(a,b);return true;}catch{return false;}};
const clone=x=>JSON.parse(JSON.stringify(x));
const remaining=()=>{const n=deadline-Date.now();assert.ok(n>0,'bounded browser budget exhausted');return n;};
const minute=p=>(p.day-1)*1440+p.hour*60+p.minute;
const bindingEvents=p=>p.worldMeta.events.filter(e=>e.type==='scenario.bound');
const legacyAdapters=p=>p.worldMeta.events.filter(e=>e.type==='save.migrated'&&e.payload.scenarioBindingAdapters?.some(a=>a.adapter==='scenario-legacy-unbound-v1'));
const baselineLine="    const SCENARIO_BOOT_OPTIONS = observerDeepFreeze({ seed: 0x5eedc0de, difficultyProfile: 'standard', worldConfig: { foodMultiplier: 1 } });";
const text=source.toString('utf8');assert.equal(text.split(baselineLine).length,2,'single reviewed boot-options declaration');
report.variants=[];
const makeVariant=(id,seedLiteral,multiplierLiteral)=>{
  const line=`    const SCENARIO_BOOT_OPTIONS = observerDeepFreeze({ seed: ${seedLiteral}, difficultyProfile: 'standard', worldConfig: { foodMultiplier: ${multiplierLiteral} } });`;
  const bytes=Buffer.from(text.replace(baselineLine,line),'utf8');assert.ok(Buffer.from(bytes.toString('utf8').replace(line,baselineLine),'utf8').equals(source),'only whitelisted complete options line changes at byte level');
  const file=`source-${id}.html`;writeFileSync(path.join(out,file),bytes);report.variants.push({id,baseSha256:sha(source),htmlSha256:sha(bytes),sourceRef:`artifact:${file}`,
    changedLineBefore:baselineLine,changedLineAfter:line,onlyDeclaredBootOptionsLineChanged:true,canonicalCoverage:false});return bytes;
};
const seedZero=makeVariant('seed0-only','0','1'),foodHalf=makeVariant('foodhalf-only','0x5eedc0de','0.5'),legacyDeployment=makeVariant('seed0-foodhalf','0','0.5');
const legacySpecs=[
  {id:'garrison-consumed-rng',file:'midnight-reloaded-save.json',repo:'docs/qa/runs/npc-public-actions-v1-20261017/associated-presence/midnight-reloaded-save.json',sha256:'9d196677f4f565bb07aa1420d000590ec77b55dfdd34ace5d5fc5e9c43d5b9b8',claims:['actual consumed RNG','actual guardJi/guardChen waterMill garrison','actual exhausted resource amount0']},
  {id:'actual-dead-npc',file:'order-combat-death-checkpoint-native.json',repo:'docs/qa/runs/npc-public-actions-v1-20261017/source/npc-public-artifacts/order-combat-death-checkpoint-native.json',sha256:'39034467fff615ca0d553a80af3e08f670451c5fa31b58a461f6bee215d93a8a',claims:['actual doctor combat death']},
  {id:'actual-used-cache',file:'supplied-forage-reloaded-save.json',repo:'docs/qa/runs/npc-public-actions-v1-20261017/associated-browser/shortage/supplied-forage-reloaded-save.json',sha256:'e9a650b313519f07a5d31b4fbbac3325d6ec0b91b8070cec3dbe37b0a950590a',claims:['actual finite shortage cache retrieved and episode history']},
];
for(const s of legacySpecs){s.raw=readFileSync(opts['--legacy-dir']?path.join(opts['--legacy-dir'],s.file):path.join(root,s.repo));assert.equal(sha(s.raw),s.sha256);writeFileSync(path.join(out,`${s.id}-original-writer.json`),s.raw);}
const scenes=[
  {id:'default-button',kind:'fresh',html:source,seed:0x5eedc0de,multiplier:1,entry:'button',observer:false},
  {id:'default-enter-observer-toggle',kind:'fresh',html:source,seed:0x5eedc0de,multiplier:1,entry:'Enter',observer:true,toggleOnReload:true},
  {id:'seed0-only-fresh',kind:'fresh',html:seedZero,seed:0,multiplier:1,entry:'button',observer:false},
  {id:'foodhalf-only-fresh',kind:'fresh',html:foodHalf,seed:0x5eedc0de,multiplier:.5,entry:'button',observer:false},
  ...legacySpecs.map(s=>({id:`legacy-${s.id}`,kind:'legacy',html:legacyDeployment,entry:'button',legacy:s})),
  {id:'first-native-write-failure-retry',kind:'fault',html:source,seed:0x5eedc0de,multiplier:1,entry:'button',observer:false},
];
const routes=new Map(scenes.map(s=>[`/${s.id}.html`,s.html]));
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;
  if(routes.has(p)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(routes.get(p));}
  else if(p==='/actor-sprites.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(sprites);}else{res.writeHead(404);res.end();}});
let browser;const contexts=[],httpPending=[];
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const require=createRequire(import.meta.url),{chromium}=require(process.env.ZH_PLAYWRIGHT_MODULE||'playwright');
  browser=await chromium.launch({headless:true,channel:process.env.ZH_BROWSER_CHANNEL||'chrome'});report.browserVersion=browser.version();
  for(const scene of scenes){remaining();const result={id:scene.id,kind:scene.kind,htmlSha256:sha(scene.html),canonicalBytes:sha(scene.html)===sha(source),verified:false,
      ...(scene.legacy?{legacyInputRef:`artifact:${scene.legacy.id}-original-writer.json`,legacyInputSha256:scene.legacy.sha256,legacyClaims:scene.legacy.claims,originalSourceHtmlSha256:'9edb6d3c3daa7ec63d90594381d811cb077828fd0955fb7095c601ce91b5b87b',fixtureNaturalGameplay:false}:{})};report.scenes.push(result);
    const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);
    await context.addInitScript(({key,legacyRaw,fault})=>{
      if(legacyRaw&&!sessionStorage.getItem('qa-c1-legacy-seeded')){localStorage.clear();localStorage.setItem(key,legacyRaw);sessionStorage.setItem('qa-c1-legacy-seeded','yes');}
      const nativeSet=Storage.prototype.setItem,nativeInterval=window.setInterval,nativeClear=window.clearInterval;
      const io={firstPrimary:null,failedPrimary:null,primaryWrites:[],storageCallCount:0,intervals:[],clears:[],faultRemaining:!!fault,restorations:[]};
      const set=function(...args){
        io.storageCallCount++;
        if(this===localStorage&&args[0]===key){
          if(io.faultRemaining){io.faultRemaining=false;io.failedPrimary=String(args[1]);Storage.prototype.setItem=nativeSet;throw new DOMException('TEST-ONLY first native primary save fault','QuotaExceededError');}
          const value=Reflect.apply(nativeSet,this,args);const raw=String(args[1]);if(io.firstPrimary===null)io.firstPrimary=raw;io.primaryWrites.push({raw,at:performance.now()});return value;
        }
        return Reflect.apply(nativeSet,this,args);
      };
      const interval=function(...args){const id=Reflect.apply(nativeInterval,this,args);io.intervals.push({id,delay:Number(args[1]),at:performance.now()});return id;};
      const clear=function(...args){const value=Reflect.apply(nativeClear,this,args);io.clears.push({id:args[0],at:performance.now()});return value;};
      Storage.prototype.setItem=set;window.setInterval=interval;window.clearInterval=clear;
      io.restore=()=>{if(Storage.prototype.setItem===set)Storage.prototype.setItem=nativeSet;if(window.setInterval===interval)window.setInterval=nativeInterval;if(window.clearInterval===clear)window.clearInterval=nativeClear;
        const proof={storageOriginal:Storage.prototype.setItem===nativeSet,intervalOriginal:window.setInterval===nativeInterval,clearOriginal:window.clearInterval===nativeClear};io.restorations.push(proof);return proof;};
      Object.defineProperty(window,'__scenarioC1BrowserIO',{value:io,configurable:true});
    },{key,legacyRaw:scene.legacy?.raw.toString('utf8')||null,fault:scene.kind==='fault'});
    const page=await context.newPage();page.setDefaultTimeout(Math.min(15000,remaining()));page.on('pageerror',e=>report.errors.push({scene:scene.id,type:'pageerror',message:e.message}));
    page.on('response',response=>{if(response.request().resourceType()==='document'&&response.frame()===page.mainFrame())httpPending.push((async()=>{const hash=sha(await response.body());report.allMainDocuments.push({scene:scene.id,status:response.status(),sha256:hash});if(!response.ok()||hash!==sha(scene.html))report.errors.push({scene:scene.id,type:'main-document-sha',sha256:hash});})().catch(e=>report.errors.push({scene:scene.id,type:'HTTP-body',message:e.message})));});
    const raw=()=>page.evaluate(k=>localStorage.getItem(k),key);
    const read=async(label,provided=null)=>{const bytes=provided??await raw();assert.ok(bytes,'actual native writer bytes required');const file=`${scene.id}-${label}-save.json`;writeFileSync(path.join(out,file),bytes);const e=JSON.parse(bytes);result.writers??=[];result.writers.push({file,sha256:sha(bytes),reason:e.reason,worldMinute:minute(e.payload),stored:label!=='failed-attempted-native-writer'});return e.payload;};
    const io=()=>page.evaluate(()=>{const v=window.__scenarioC1BrowserIO;return{firstPrimary:v.firstPrimary,failedPrimary:v.failedPrimary,intervals:v.intervals,clears:v.clears,restorations:v.restorations};});
    const first=async label=>{await page.waitForFunction(()=>window.__scenarioC1BrowserIO.firstPrimary!==null,null,{timeout:Math.min(18000,remaining())});return read(label,(await io()).firstPrimary);};
    const restore=async stage=>{const proof=await page.evaluate(()=>window.__scenarioC1BrowserIO.restore());result.IOrestoration??=[];result.IOrestoration.push({stage,...proof});check(`${scene.id}: original IO restored at ${stage}`,Object.values(proof).every(Boolean));};
    const settings=async enabled=>{check(`${scene.id}: real start settings publicly available`,await page.locator('#openSettingsBtn').isVisible());await page.locator('#openSettingsBtn').click();
      check(`${scene.id}: observer checkbox actually visible`,await page.locator('#settingsObserverCommentary').isVisible());await page.locator('#settingsObserverCommentary').setChecked(enabled);await page.screenshot({path:path.join(out,`${scene.id}-settings-${enabled}.png`)});await page.locator('#closeSettingsBtn').click();};
    const observerConsumerProbe=async(label,expectedEnabled)=>{
      // Existing readonly game API only. One synchronous browser turn excludes
      // timer interleaving; there is no awaited call or mutable state access.
      const probe=await page.evaluate(key=>{
        if(typeof WorldSnapshot==='undefined'||typeof WorldSnapshot.capture!=='function'||typeof window.ZombieHarvestObserver?.comment!=='function')throw new Error('existing readonly observer/snapshot API unavailable');
        const subject={kind:'item',id:'test-only-c1-observer-literal',label:'TEST-ONLY C1 observer literal',category:'method-probe',qualityBand:'medium'},context={};
        const hud=()=>Object.fromEntries(['dayLabel','timeLabel','hpValue','energyValue','foodValue','woodValue','stoneValue'].map(id=>[id,document.getElementById(id)?.textContent??null]));
        const before=WorldSnapshot.capture(),primaryBefore=localStorage.getItem(key),storageCallsBefore=window.__scenarioC1BrowserIO.storageCallCount,hudBefore=hud(),at=performance.now();
        const expression=window.ZombieHarvestObserver.comment(subject,context);
        const durationMs=performance.now()-at,after=WorldSnapshot.capture(),primaryAfter=localStorage.getItem(key),storageCallsAfter=window.__scenarioC1BrowserIO.storageCallCount,hudAfter=hud();
        return{subject,context,expression,durationMs,synchronous:!(expression&&typeof expression.then==='function'),before,after,primaryBefore,primaryAfter,storageCallsBefore,storageCallsAfter,hudBefore,hudAfter};
      },key);
      const beforeFile=`${scene.id}-${label}-before-core-snapshot.json`,afterFile=`${scene.id}-${label}-after-core-snapshot.json`,nativeBeforeFile=`${scene.id}-${label}-before-native-save.json`,nativeAfterFile=`${scene.id}-${label}-after-native-save.json`;
      const beforeBytes=JSON.stringify(probe.before,null,2)+'\n',afterBytes=JSON.stringify(probe.after,null,2)+'\n';
      writeFileSync(path.join(out,beforeFile),beforeBytes);writeFileSync(path.join(out,afterFile),afterBytes);assert.ok(probe.primaryBefore&&probe.primaryAfter,'native save exists around literal consumer');
      writeFileSync(path.join(out,nativeBeforeFile),probe.primaryBefore);writeFileSync(path.join(out,nativeAfterFile),probe.primaryAfter);
      check(`${scene.id}: ${label} actual readonly expression consumer follows public preference`,probe.synchronous&&probe.expression?.schema==='ObserverExpressionV1'&&probe.expression.version===1&&probe.expression.enabled===expectedEnabled&&
        probe.expression.mode===(expectedEnabled?'deterministic-stub':'fallback')&&probe.expression.authority==='expression_only');
      check(`${scene.id}: ${label} same-turn core state, RNG, HUD and saved bytes remain unchanged`,equal(probe.before,probe.after)&&equal(probe.hudBefore,probe.hudAfter)&&probe.primaryBefore===probe.primaryAfter&&probe.storageCallsBefore===probe.storageCallsAfter);
      result.observerConsumerProbes??=[];result.observerConsumerProbes.push({label,kind:'TEST-ONLY consumer literal probe',subject:probe.subject,context:probe.context,expression:probe.expression,durationMs:probe.durationMs,
        synchronous:probe.synchronous,snapshotSource:'existing readonly WorldSnapshot.capture full projection',mutableStateAccess:false,hiddenGameAction:false,npcDialogue:false,actorKnowledgeAuthorizationClaim:false,
        beforeSnapshot:{file:beforeFile,sha256:sha(beforeBytes)},afterSnapshot:{file:afterFile,sha256:sha(afterBytes)},beforeNativeSave:{file:nativeBeforeFile,sha256:sha(probe.primaryBefore)},afterNativeSave:{file:nativeAfterFile,sha256:sha(probe.primaryAfter)},
        storageCallsBefore:probe.storageCallsBefore,storageCallsAfter:probe.storageCallsAfter,fullExistingCoreProjectionSemanticallyEqual:true,nativeSavedBytesEqual:true});
    };
    const start=async entry=>{if(entry==='Enter')await page.keyboard.press('Enter');else await page.locator('#continueSaveBtn').click();};
    const assertBound=(p,observer)=>{const snap=p.scenarioSnapshot,b=snap.binding,events=bindingEvents(p);
      check(`${scene.id}: actual bound snapshot and one system receipt`,b.version===1&&b.status==='bound'&&b.bindingId==='scenario-initial-v1'&&events.length===1&&events[0].actorId==='system'&&
        events[0].payload.seed===scene.seed&&events[0].payload.packageDigest===b.packageDigest&&events[0].payload.configDigest===b.configDigest);
      check(`${scene.id}: binding explicitly reports C1-only supported scope`,equal([...b.appliedKeys].sort(),['seed','world.foodMultiplier'])&&b.baselineOnlyKeys.includes('events')&&b.deferredKeys.includes('continuity')&&
        /^fnv1a-utf16-canonical-hex-v1:[a-f0-9]{8}$/.test(b.packageDigest)&&/^fnv1a-utf16-canonical-hex-v1:[a-f0-9]{8}$/.test(b.configDigest));
      check(`${scene.id}: actual seed three-way binding and initial RNG`,snap.seed===scene.seed&&p.worldMeta.seed===scene.seed&&p.worldMeta.replay.seed===scene.seed&&p.worldMeta.rngState===scene.seed);
      check(`${scene.id}: actual finite stock and each berry count`,p.food===Math.floor(8*scene.multiplier)&&equal(p.resources.filter(x=>x.type==='berry').map(x=>x.amount).sort(),(scene.multiplier===.5?[1,1,1,1]:[2,2,2,3]))&&
        events[0].payload.initialFood===p.food&&equal(events[0].payload.initialBerries,p.resources.filter(x=>x.type==='berry').map(x=>({id:x.id,amount:x.amount}))));
      check(`${scene.id}: current observer preference has no generated authority`,snap.aiConfig.observerCommentary===observer&&['generativeDialogue','generatedWorldEvents','learnedWorldModel'].every(k=>snap.aiConfig[k]===false));
      check(`${scene.id}: public preference does not rewrite initial AI binding`,b.initialAiConfig.observerCommentary===false);
      const defaultBinding=report.scenes.find(s=>s.id==='default-button')?.initial?.binding;
      if(scene.id==='default-enter-observer-toggle')check(`${scene.id}: observer-on leaves default initial config digest unchanged`,b.configDigest===defaultBinding?.configDigest&&equal(b.initialAiConfig,defaultBinding.initialAiConfig));
      result.initial={minute:minute(p),food:p.food,seed:p.worldMeta.seed,rngState:p.worldMeta.rngState,binding:clone(b),aiConfig:clone(snap.aiConfig),roster:p.npcs.map(n=>n.id)};
    };
    await page.goto(`http://127.0.0.1:${server.address().port}/${scene.id}.html`,{waitUntil:'domcontentloaded'});
    check(`${scene.id}: actual public start screen`,await page.locator('#startOverlay').isVisible()&&await page.locator('#continueSaveBtn').isEnabled());
    if(!scene.legacy)check(`${scene.id}: fresh primary is empty`,await raw()===null);
    if(scene.kind==='fresh'){
      if(scene.observer)await settings(true);await start(scene.entry);const p=await first('initial-native-binding');assertBound(p,scene.observer);
      if(scene.toggleOnReload)await observerConsumerProbe('observer-ON-after-public-setting-and-native-save',true);
      await page.screenshot({path:path.join(out,`${scene.id}-initial.png`)});await restore('before-public-reload');await page.reload({waitUntil:'domcontentloaded'});
      const before=await read('pagehide-before-continue');if(scene.toggleOnReload)await settings(false);await start('button');const after=await first('reloaded-first-native-writer');
      check(`${scene.id}: reload does not rebind, rescale or reseed`,bindingEvents(after).length===1&&equal(after.scenarioSnapshot.binding,p.scenarioSnapshot.binding)&&after.food===before.food&&equal(after.resources,before.resources)&&after.worldMeta.seed===before.worldMeta.seed&&after.worldMeta.rngState===before.worldMeta.rngState&&after.worldMeta.replay.seed===before.worldMeta.replay.seed);
      if(scene.toggleOnReload)check(`${scene.id}: public reload settings changes only current preference, not initial digest`,after.scenarioSnapshot.aiConfig.observerCommentary===false&&after.scenarioSnapshot.binding.configDigest===p.scenarioSnapshot.binding.configDigest&&equal(after.scenarioSnapshot.binding.initialAiConfig,p.scenarioSnapshot.binding.initialAiConfig));
      if(scene.toggleOnReload)await observerConsumerProbe('observer-OFF-after-public-reload-setting-and-continue',false);
    }else if(scene.kind==='legacy'){
      const original=JSON.parse(scene.legacy.raw).payload;await start('button');const p=await first('migration-native-writer');
      check(`${scene.id}: legacy continues without new binding or current boot seed`,p.scenarioSnapshot.binding.status==='legacy-unbound'&&p.scenarioSnapshot.binding.sourceSeed===original.worldMeta.seed&&bindingEvents(p).length===bindingEvents(original).length&&p.worldMeta.seed===original.worldMeta.seed&&p.worldMeta.rngState===original.worldMeta.rngState&&p.worldMeta.replay.seed===original.worldMeta.replay.seed);
      for(const domain of ['food','seeds','wood','stone','parts','medicine','day','hour','minute','player','resources','buildings','npcs','contentState','campStanding','quests'])check(`${scene.id}: original ${domain} preserved before world runs`,equal(p[domain],original[domain]));
      check(`${scene.id}: legacy scenario adapter recorded once`,legacyAdapters(p).length===legacyAdapters(original).length+1);
      await page.screenshot({path:path.join(out,`${scene.id}-continued.png`)});await restore('before-legacy-public-reload');await page.reload({waitUntil:'domcontentloaded'});const before=await read('pagehide-before-reload-continue');await start('button');const after=await first('legacy-reloaded-native-writer');
      check(`${scene.id}: reload preserves RNG, finite cache, deaths/garrison and adapter count`,after.food===before.food&&after.worldMeta.rngState===before.worldMeta.rngState&&equal(after.resources,before.resources)&&equal(after.npcs,before.npcs)&&equal(after.contentState,before.contentState)&&legacyAdapters(after).length===legacyAdapters(p).length&&bindingEvents(after).length===bindingEvents(p).length);
    }else{
      await start('button');check(`${scene.id}: first genuine save failure remains publicly recoverable`,await raw()===null&&await page.locator('#recoveryStatus').isVisible()&&await page.locator('#continueSaveBtn').isEnabled()&&(await page.locator('#continueSaveBtn').innerText()).includes('重试'));
      const failed=await io();assert.ok(failed.failedPrimary);await read('failed-attempted-native-writer',failed.failedPrimary);const clockBefore=await page.locator('#timeLabel').innerText();
      await page.waitForTimeout(2600);const frozen=await io();result.realRecoveryIntervalMs=2600;result.recoveryIO={intervals:frozen.intervals,clears:frozen.clears};
      check(`${scene.id}: real timer never starts before successful persistence`,frozen.intervals.filter(t=>t.delay===1200).length===0&&await raw()===null&&await page.locator('#timeLabel').innerText()===clockBefore);
      await page.screenshot({path:path.join(out,`${scene.id}-recovery-frozen.png`)});await start('button');const retry=await read('retry-first-native-writer');
      check(`${scene.id}: public retry preserves same installed initial draft and receipt`,equal(retry,JSON.parse(failed.failedPrimary).payload));assertBound(retry,false);
      check(`${scene.id}: successful retry starts exactly one actual world interval`,(await io()).intervals.filter(t=>t.delay===1200).length===1);
      await page.waitForFunction(({key,seq})=>{const raw=localStorage.getItem(key);return raw&&JSON.parse(raw).payload.worldMeta.events.some(e=>e.type==='time.advanced'&&e.seq>seq);},{key,seq:retry.worldMeta.eventSeq},{timeout:Math.min(20000,remaining())});
      const tick=await read('retry-normal-clock-writer');check(`${scene.id}: real clock progresses with no duplicate binding`,minute(tick)>minute(retry)&&bindingEvents(tick).length===1);
    }
    await restore('scene-finally');await page.screenshot({path:path.join(out,`${scene.id}-terminal.png`)});result.verified=true;await context.close();
  }
}catch(error){console.error(error.stack||String(error));report.errors.push({type:'runner',message:error.message||String(error)});for(let i=0;i<contexts.length;i++)for(const page of contexts[i].pages())try{await page.screenshot({path:path.join(out,`failure-${i}.png`),timeout:5000});}catch(e){report.errors.push({type:'failure-screenshot',message:e.message});}}
finally{
  for(const context of contexts)for(const page of context.pages())if(!page.isClosed())try{const p=await page.evaluate(()=>window.__scenarioC1BrowserIO?.restore());if(p&&!Object.values(p).every(Boolean))report.errors.push({type:'IO-restore',message:'original IO identity not restored'});}catch(e){report.errors.push({type:'IO-restore',message:e.message});}
  await Promise.all(httpPending);let contextsClosed=true;for(const c of contexts)await c.close().catch(e=>{contextsClosed=false;report.errors.push({type:'context-close',message:e.message});});
  if(browser)await browser.close().catch(e=>report.errors.push({type:'browser-close',message:e.message}));if(server.listening)await new Promise(resolve=>server.close(resolve));
  report.cleanup={contextsClosed,browserClosed:!browser||!browser.isConnected(),httpServerClosed:!server.listening};report.elapsedWallMs=Date.now()-startedAt;report.count=report.checks.length;report.passed=report.checks.filter(c=>c.ok).length;
  report.ok=report.errors.length===0&&report.passed===report.count&&report.scenes.length===scenes.length&&report.scenes.every(s=>s.verified)&&Object.values(report.cleanup).every(Boolean);
  writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,ok:report.ok,passed:report.passed,count:report.count,errors:report.errors,cleanup:report.cleanup},null,2));
}
if(!report.ok)process.exitCode=1;
