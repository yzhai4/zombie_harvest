import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Prepared method only. Root must freeze source and authorize an actual execution.
const a={};for(let i=2;i<process.argv.length;i+=2){assert.ok(process.argv[i+1]&&!Object.hasOwn(a,process.argv[i]));a[process.argv[i]]=process.argv[i+1];}
for(const k of ['--html','--sprites','--input-manifest','--out','--playwright-module','--chrome-executable'])assert.ok(path.isAbsolute(a[k]||''),k);
for(const k of ['--expect-html-sha256','--expect-input-manifest-sha256'])assert.match(a[k]||'',/^[a-f0-9]{64}$/);
const sha=b=>createHash('sha256').update(b).digest('hex'), read=p=>fs.readFileSync(p), clone=v=>JSON.parse(JSON.stringify(v));
const html=read(a['--html']),sprites=read(a['--sprites']),method=read(fileURLToPath(import.meta.url)),imBytes=read(a['--input-manifest']),im=JSON.parse(imBytes),sourceSha=sha(html);
assert.equal(sourceSha,a['--expect-html-sha256']);assert.equal(sha(imBytes),a['--expect-input-manifest-sha256']);assert.equal(im.schema,'RelayMaintenanceBrowserInputsV1');assert.equal(im.sourceHtmlSha256,sourceSha);assert.equal(im.scenes.length,2);
const saveKey=html.toString('utf8').match(/const SAVE_KEY = '([^']+)'/)?.[1];assert.ok(saveKey);
const inputs=im.scenes.map(s=>{assert.ok(!path.isAbsolute(s.file)&&!s.file.split(/[\\/]/).includes('..'));const b=read(path.join(path.dirname(a['--input-manifest']),s.file));assert.equal(sha(b),s.sha256);assert.equal(b.length,s.bytes);return{...s,raw:b.toString('utf8'),p:JSON.parse(b).payload};});
assert.ok(!fs.existsSync(a['--out']));fs.mkdirSync(a['--out'],{recursive:true});
const out=a['--out'],write=(n,b)=>fs.writeFileSync(path.join(out,n),b),json=(n,v)=>write(n,JSON.stringify(v,null,2)+'\n');
const artifact=n=>{const b=read(path.join(out,n));return{file:n,sha256:sha(b),bytes:b.length};};
write('runner-executed.mjs',method);write('source-executed.html',html);write('actor-sprites.js',sprites);write('input-manifest.json',imBytes);
for(const s of inputs)write(s.file,s.raw);
for(const x of im.provenanceFiles){assert.ok(!path.isAbsolute(x.file)&&!x.file.split(/[\\/]/).includes('..'));const b=read(path.join(path.dirname(a['--input-manifest']),x.file));assert.equal(sha(b),x.sha256);assert.equal(b.length,x.bytes);write(x.file,b);}
const report={runner:'browser-relay-maintenance-v2',sourceHtmlSha256:sourceSha,runnerSha256:sha(method),inputManifestSha256:sha(imBytes),
  mode:'TEST-ONLY-complete-online-writer-derived-HP0-stale-flags-public-repair',naturalDamageClaim:false,naturalGameplay:false,humanExperience:false,
  stateWritesAfterBoot:false,hiddenAdvanceCalls:0,hiddenRepairCalls:0,forcedHiddenControls:false,
  budget:{overallMs:100000,sceneMs:45000,normalWriterWaitMs:15000,newTickWaitMs:4000,maximumRepairs:1,maximumNavigationSegments:6,maximumKeyHoldMs:60,movementDirectionRule:'only visible station context; finite right then left UI-range refresh'},
  scope:'One actual public repair/20-minute proof and normal-writer/selected/new-boot chain; one public 1.19 view-only range scenario. Typed stale submission and real damage/redestruction/fatal are source-contract scope, not synthesized browser actions.',
  checks:[],errors:[],scenes:[],documents:[],documentHashes:[],cleanup:{}};
const began=Date.now(),deadline=began+report.budget.overallMs,contexts=new Set(),responseTasks=[];let server,browser,watchdog,cleanupPromise;
const timeout=(n=6000)=>{assert.ok(Date.now()<deadline,'overall wall budget');return Math.max(1,Math.min(n,deadline-Date.now()));};
function check(name,ok,detail){report.checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});assert.ok(ok,name);}
async function closeAll(){if(cleanupPromise)return cleanupPromise;cleanupPromise=(async()=>{for(const c of [...contexts])try{await c.close();contexts.delete(c);}catch(e){report.errors.push({type:'context-close',message:e.message});}report.cleanup.contextsClosed=contexts.size===0;if(browser)try{await browser.close();report.cleanup.browserClosed=true;}catch{report.cleanup.browserClosed=false;}if(server)await new Promise(resolve=>{server.close(()=>{report.cleanup.serverClosed=true;resolve();});server.closeAllConnections?.();});})();return cleanupPromise;}
async function publicUi(page){return page.evaluate(()=>{
  const visible=e=>{if(!e||e.hidden)return false;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth&&c.display!=='none'&&c.visibility!=='hidden'&&Number(c.opacity)!==0;};
  const text=id=>{const e=document.getElementById(id);return visible(e)?e.innerText:null;},num=id=>{const t=text(id);if(t===null||!t.trim())return null;const n=Number(t);return Number.isFinite(n)?n:null;};
  const controls=[...document.querySelectorAll('[data-context-action]')].filter(visible).map(e=>({action:e.dataset.contextAction,buildingId:e.dataset.buildingId??null,repairType:e.dataset.repairType??null,index:e.dataset.contextIndex??null,disabled:e.disabled,text:e.innerText}));
  return{at:Date.now(),viewport:{width:innerWidth,height:innerHeight},startOverlay:!document.getElementById('startOverlay')?.classList.contains('hidden'),modalOpen:visible(document.getElementById('infoModal')),
    hp:num('basicHpValue')??num('hpValue'),energy:num('basicEnergyValue')??num('energyValue'),day:text('dayLabel'),time:text('timeLabel'),contextTitle:text('contextTitle'),contextHint:text('contextHint'),
    feedback:text('relayMaintenanceFeedback'),relay:{status:text('relayStatusText'),task:text('relayTaskText'),forecast:text('relayForecastText'),crew:text('relayCrewText')},controls,toast:text('toast')};
});}
// Privileged read-only ledger is for accounting/assertions, never movement targets.
async function ledger(page,since=0){return page.evaluate(({stationId,since})=>{
  const s=WorldSnapshot.capture(),p=state.relayProject,stations=s.buildings.filter(b=>b.id===stationId),station=stations.length===1?stations[0]:null;
  const history={id:p.id,status:p.status,buildingId:p.buildingId,completedAt:p.completedAt??null,handoffAt:p.handoffAt??null,materialProgress:p.materialProgress,workMinutes:p.workMinutes};
  const events=s.worldMeta.events.filter(e=>e.seq>since&&['building.repaired','command.rejected','time.advanced','relay.stationOnline','quest.completed','player.dayFatal'].includes(e.type));
  return{at:Date.now(),hp:state.hp,energy:state.energy,wood:state.wood,food:state.food,parts:state.parts,gameOver:state.gameOver,night:state.night,
    day:s.day,hour:s.hour,minute:s.minute,worldMinute:s.world.totalMinutes,eventSeq:s.worldMeta.eventSeq,clock:s.worldMeta.clock,player:{x:s.player.x,y:s.player.y},
    station:station?{id:station.id,type:station.type,hp:station.hp??null,active:station.active??null,relayEnabled:station.relayEnabled??null}:null,stationMatches:stations.length,
    projectHistory:history,relayQuest:state.quests.find(q=>q.id==='relay-chain-001')??null,campStanding:state.campStanding,npcCount:s.npcs.length,enemyIds:s.worldZombies.map(z=>z.id),aiConfig:s.scenarioSnapshot.aiConfig,
    onlineEventIds:s.worldMeta.events.filter(e=>e.type==='relay.stationOnline').map(e=>e.eventId),events,commands:s.worldMeta.replay.commands.filter(c=>c.type==='building.repair'||c.type==='world.advance'),
    ownership:{mode:SessionController.mode,worldTimer:worldTimer!==null,worldTickCounter,generation:SessionController.generation,restOwnsClock:CampRestController.ownsClock()}};
},{stationId:im.stationId,since});}
async function stores(page){return page.evaluate(key=>{const raw=localStorage.getItem(key);if(!raw)return null;const v=validateStoredProgress({raw,sourceCategory:'primary'},BootRecovery.installed?null:BootRecovery.scenarioContent);return{raw,validation:{ok:v.ok,reason:v.reason??null},classification:v.ok?classifySavedRecovery(v.payload).classification:null};},saveKey);}
function addJson(scene,label,value){const file=scene.id+'-'+label+'.json';json(file,value);scene.artifacts.push(artifact(file));return file;}
function addNative(scene,label,raw){const file=scene.id+'-'+label+'-native.json';write(file,raw);scene.artifacts.push(artifact(file));return file;}
async function capture(page,scene,label){addJson(scene,label+'-public-ui',await publicUi(page));const file=scene.id+'-'+label+'.png';await page.screenshot({path:path.join(out,file),timeout:timeout(4500),animations:'allow'});scene.artifacts.push(artifact(file));}
async function buildTab(page){await page.locator('#openInfoBtn').click();await page.locator('[data-info-tab="build"]').click();await page.locator('#relayStatusText').scrollIntoViewIfNeeded();}
async function closeInfo(page){if((await publicUi(page)).modalOpen)await page.keyboard.press('Escape');}
const repairSelector=id=>'[data-context-action="repair"][data-repair-type="relayStation"][data-building-id="'+id+'"]';
const viewSelector=id=>'[data-context-action="relayStationView"][data-building-id="'+id+'"]';
async function repairUiState(page,id){const b=page.locator(repairSelector(id));return await b.count()?{present:true,enabled:await b.isEnabled()}:{present:false,enabled:false};}
async function waitFor(page,predicate,end,message){while(Date.now()<end&&Date.now()<deadline){const s=await ledger(page);if(predicate(s))return s;await page.waitForTimeout(100);}assert.fail(message);}
async function waitRepairWriter(page,scene,receipt,end){const stop=Math.min(end,Date.now()+report.budget.normalWriterWaitMs);
  while(Date.now()<stop){const st=await stores(page);if(st?.validation.ok){const e=JSON.parse(st.raw),p=e.payload;
      if(st.classification==='DAY'&&p.world.totalMinutes>=receipt.payload.clock.after.world&&p.worldMeta.eventSeq>=receipt.seq&&p.worldMeta.events.some(x=>x.eventId===receipt.eventId&&x.commandId===receipt.commandId)&&p.worldMeta.replay.commands.some(c=>c.commandId===receipt.commandId&&c.type==='building.repair')&&e.reason!=='visibility-hidden'&&e.reason!=='pagehide'){
        addNative(scene,'normal-repair-before-reload',st.raw);addJson(scene,'normal-writer-watermark',{reason:e.reason,savedAt:e.savedAt,eventSeq:p.worldMeta.eventSeq,calendar:{day:p.day,hour:p.hour,minute:p.minute},repairCommandId:receipt.commandId,repairEventId:receipt.eventId,station:p.buildings.find(b=>b.id===im.stationId)});return{storage:st,envelope:e};}}
    await page.waitForTimeout(100);
  }assert.fail('normal complete repair writer not observed before reload; no pagehide rescue');}
try{
  server=createServer((q,r)=>{const u=new URL(q.url,'http://local').pathname,b=u==='/'||u==='/index.html'?html:u==='/actor-sprites.js'?sprites:null;r.writeHead(b?200:404,{'Content-Type':u.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8'});r.end(b||'');});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const pw=fs.statSync(a['--playwright-module']).isDirectory()?createRequire(import.meta.url)(a['--playwright-module']):await import(pathToFileURL(a['--playwright-module']).href);
  browser=await(pw.chromium||pw.default.chromium).launch({headless:true,executablePath:a['--chrome-executable'],timeout:timeout(25000)});report.browserVersion=browser.version();
  watchdog=setTimeout(async()=>{report.errors.push({type:'wall-watchdog',message:'actual deadline reached; no success inferred'});await closeAll();},Math.max(1,deadline-Date.now()));
  for(const input of inputs){const scene={id:input.id,inputSha256:input.sha256,stationId:input.stationId,status:'STARTED',artifacts:[]};report.scenes.push(scene);const end=Math.min(deadline,Date.now()+report.budget.sceneMs);let context,page;
    try{
      context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.add(context);
      await context.addInitScript(({key,raw,id})=>{const marker='qa-relay-maintenance-preboot-v1';if(!sessionStorage.getItem(marker)){localStorage.setItem(key,raw);sessionStorage.setItem(marker,JSON.stringify({id,seedCount:1}));}},{key:saveKey,raw:input.raw,id:input.id});
      page=await context.newPage();page.setDefaultTimeout(timeout());page.on('pageerror',e=>report.errors.push({scene:scene.id,type:'pageerror',message:e.message}));
      page.on('response',r=>{if(r.request().resourceType()==='document'&&r.frame()===page.mainFrame())responseTasks.push((async()=>{const b=await r.body();report.documents.push({scene:scene.id,status:r.status(),sha256:sha(b),bytes:b.length});report.documentHashes.push(sha(b));})().catch(e=>report.errors.push({scene:scene.id,type:'document',message:e.message})));});
      await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:timeout(15000)});
      check(scene.id+': actual Continue is visible and enabled',await page.locator('#continueSaveBtn').isVisible()&&await page.locator('#continueSaveBtn').isEnabled());await page.locator('#continueSaveBtn').click();await page.waitForFunction(()=>document.getElementById('startOverlay').classList.contains('hidden'),null,{timeout:timeout()});
      const boot=await ledger(page);addJson(scene,'boot-ledger',boot);check(scene.id+': true HP0 fixture survives Continue with completed history and no gifts',boot.stationMatches===1&&boot.station.hp===0&&boot.projectHistory.status==='online'&&boot.hp===input.p.hp&&boot.wood===input.p.wood&&boot.npcCount===10&&boot.enemyIds.length===5);
      for(const k of ['generativeDialogue','observerCommentary','generatedWorldEvents','learnedWorldModel'])assert.equal(boot.aiConfig[k],false);
      await buildTab(page);const initialPanel=await publicUi(page);check(scene.id+': public panel separates completed history destroyed station and HP0/8',/工程已完成/.test(initialPanel.relay.status||'')&&/损毁/.test(initialPanel.relay.status||'')&&/停用/.test(initialPanel.relay.status||'')&&/0\s*\/\s*8/.test(initialPanel.relay.status||'')&&(initialPanel.relay.crew||'').includes('\u4e0a\u6b21\u62a5\u544a\uff1a'));
      await capture(page,scene,'destroyed-panel-desktop');await page.setViewportSize({width:390,height:844});await capture(page,scene,'destroyed-panel-390');await closeInfo(page);
      const button=page.locator(repairSelector(input.stationId));check(scene.id+': public repair is bound to this station',await button.isVisible());
      if(input.expectedInitialRepairAllowed){
        check(scene.id+': close same station has a real enabled paid repair',await button.isEnabled());const base=await ledger(page);addJson(scene,'before-repair-ledger',base);
        await button.click();const after=await waitFor(page,s=>s.events.some(e=>e.type==='building.repaired'&&e.seq>base.eventSeq),Math.min(end,Date.now()+6000),'no actual building.repaired receipt from public bound repair');
        const receipt=after.events.find(e=>e.type==='building.repaired'&&e.seq>base.eventSeq),proof=receipt.payload,parent=after.commands.find(c=>c.commandId===receipt.commandId),child=after.events.find(e=>e.eventId===proof.advance.eventId);
        addJson(scene,'actual-repair-receipt',{event:receipt,parent,advanceEvent:child});addJson(scene,'after-repair-ledger',after);
        check(scene.id+': actual player1 parent and same unique station receive immediate +1',receipt.actorId==='player-1'&&parent?.actorId==='player-1'&&parent.payload.buildingId===input.stationId&&proof.buildingId===input.stationId&&proof.buildingType==='relayStation'&&proof.target.hpBefore===0&&proof.target.hpAfter===1);
        check(scene.id+': gross two wood and fourteen energy are paid once',proof.payment.cost.wood===2&&proof.payment.cost.energy===14&&proof.payment.before.wood-proof.payment.after.wood===2&&proof.payment.before.energy-proof.payment.after.energy===14);
        check(scene.id+': real child advance20 is linked to same paid parent',proof.clock.requestedMinutes===20&&proof.clock.elapsedMinutes===20&&child?.type==='time.advanced'&&child.commandId===proof.advance.commandId&&child.causationId===receipt.commandId&&child.payload.minutes===20);
        check(scene.id+': actual prefix and subsequent station outcome are distinct',proof.outcome.physicalRepairApplied===true&&proof.target.hpAtCompletion===after.station.hp&&proof.outcome.playerSurvived===(after.hp>0));
        scene.repair={commandId:receipt.commandId,eventId:receipt.eventId,hpImmediate:proof.target.hpAfter,hpAtCompletion:proof.target.hpAtCompletion,operationalAtCompletion:proof.outcome.operationalAtCompletion,playerSurvived:proof.outcome.playerSurvived};
        check(scene.id+': no second online receipt or completed-project replay',!after.events.some(e=>e.seq>base.eventSeq&&e.type==='relay.stationOnline')&&JSON.stringify(after.projectHistory)===JSON.stringify(base.projectHistory)&&JSON.stringify(after.relayQuest)===JSON.stringify(base.relayQuest));
        const normal=await waitRepairWriter(page,scene,receipt,end);await buildTab(page);const repairedPanel=await publicUi(page);
        check(scene.id+': a positive recovery is claimed only when current public UI is operational',proof.outcome.operationalAtCompletion===true&&/当前中继可用/.test(repairedPanel.relay.status||'')&&/1\s*\/\s*8/.test(repairedPanel.relay.status||''));
        await capture(page,scene,'repaired-panel-390');await closeInfo(page);const liveBeforeReload=await ledger(page);addJson(scene,'live-before-reload-watermark',liveBeforeReload);
        // The live timer may have progressed after the normal writer. Preserve
        // actual selected primary rather than pretending both samples are equal.
        await page.reload({waitUntil:'domcontentloaded',timeout:timeout(15000)});const selected=await stores(page);assert.ok(selected?.validation.ok);addNative(scene,'actual-reload-selected-primary',selected.raw);const selectedPayload=JSON.parse(selected.raw).payload;
        await page.locator('#continueSaveBtn').click();await page.waitForFunction(()=>document.getElementById('startOverlay').classList.contains('hidden'),null,{timeout:timeout()});const newBoot=await ledger(page);addJson(scene,'new-boot-watermark',newBoot);
        const savedStation=selectedPayload.buildings.find(b=>b.id===input.stationId);check(scene.id+': actual selected writer and new boot retain repair and actual station without re-award',newBoot.station.hp===savedStation.hp&&newBoot.station.active===savedStation.active&&newBoot.station.relayEnabled===savedStation.relayEnabled&&newBoot.worldMinute===selectedPayload.world.totalMinutes&&newBoot.eventSeq===selectedPayload.worldMeta.eventSeq&&newBoot.events.some(e=>e.eventId===receipt.eventId));
        const newTick=await waitFor(page,s=>s.worldMinute>newBoot.worldMinute&&s.events.some(e=>e.type==='time.advanced'&&e.seq>newBoot.eventSeq),Math.min(end,Date.now()+report.budget.newTickWaitMs),'no true new tick beyond new boot watermark');addJson(scene,'after-new-tick-ledger',newTick);
        check(scene.id+': new tick does not replay repair or online award',newTick.events.filter(e=>e.type==='building.repaired'&&e.commandId===receipt.commandId).length===1&&!newTick.events.some(e=>e.type==='relay.stationOnline'&&e.seq>newBoot.eventSeq)&&JSON.stringify(newTick.projectHistory)===JSON.stringify(newBoot.projectHistory));
        await buildTab(page);await capture(page,scene,'restored-panel-390');scene.normalWriter={savedAt:normal.envelope.savedAt,eventSeq:normal.envelope.payload.worldMeta.eventSeq,reason:normal.envelope.reason,repairCommandId:receipt.commandId};
        const marker=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('qa-relay-maintenance-preboot-v1')));check(scene.id+': full input seeds exactly once through reload',marker.id===scene.id&&marker.seedCount===1);
      }else{
        check(scene.id+': 1.19 public view is available while bound repair is disabled',await page.locator(viewSelector(input.stationId)).isVisible()&&await page.locator(viewSelector(input.stationId)).isEnabled()&&await button.isDisabled());
        await page.locator('#relayMaintenanceFeedback').scrollIntoViewIfNeeded();const outer=await publicUi(page);check(scene.id+': disabled reason is persistently public outside the button',!!outer.feedback&&/靠近|距离/.test(outer.feedback));await page.locator(viewSelector(input.stationId)).click();scene.publicViewClicked=true;await capture(page,scene,'range-disabled-390');const before=await ledger(page);
        scene.navigation=[];for(let i=0;i<3&&!(await repairUiState(page,input.stationId)).enabled;i++){await page.keyboard.down('d');await page.waitForTimeout(60);await page.keyboard.up('d');await page.waitForTimeout(100);scene.navigation.push({key:'d',holdMs:60,repairUi:await repairUiState(page,input.stationId)});}
        check(scene.id+': finite real public movement refreshes repair into valid range',(await repairUiState(page,input.stationId)).enabled);await capture(page,scene,'range-enabled-390');
        for(let i=0;i<3&&(await repairUiState(page,input.stationId)).enabled;i++){await page.keyboard.down('a');await page.waitForTimeout(60);await page.keyboard.up('a');await page.waitForTimeout(100);scene.navigation.push({key:'a',holdMs:60,repairUi:await repairUiState(page,input.stationId)});}
        const returned=await repairUiState(page,input.stationId);scene.returnedPublicContext=returned;check(scene.id+': leaving range cannot leave a usable old repair control',!returned.enabled);if(returned.present)check(scene.id+': still-visible disabled control retains current coarse reason',!!(await publicUi(page)).feedback);await capture(page,scene,'range-return-disabled-390');const after=await ledger(page,before.eventSeq);addJson(scene,'range-observation-ledger',after);
        check(scene.id+': range inspection/navigation never submits or pays a repair',!after.events.some(e=>e.type==='building.repaired')&&after.commands.filter(c=>c.type==='building.repair').length===before.commands.filter(c=>c.type==='building.repair').length&&after.station.hp===0);
        scene.staleSubmissionScope='No synthetic stale click or detached callback invoked. Actual typed stale target/range rejection is source-contract coverage only.';
      }
      scene.status='VERIFIED';
    }catch(e){scene.status='FAILED';report.errors.push({scene:scene.id,type:e.name,message:e.message});if(page&&!page.isClosed())try{const st=await stores(page);if(st?.raw)addNative(scene,'failure-primary',st.raw);addJson(scene,'failure-ledger',await ledger(page));await capture(page,scene,'failure');}catch(c){report.errors.push({scene:scene.id,type:'failure-capture',message:c.message});}process.exitCode=1;}
    finally{if(context)try{await context.close();contexts.delete(context);}catch{}}
  }
  await Promise.all(responseTasks);for(const d of report.documents)check('actual main response matches frozen maintenance source',d.status===200&&d.sha256===sourceSha&&d.bytes===html.length);
  check('two scenes include actual reload main response for the paid repair',report.documents.filter(d=>d.scene==='destroyed-near-repair').length>=2&&report.documents.some(d=>d.scene==='destroyed-view-only-range'));
}catch(e){report.errors.push({type:e.name,message:e.message});process.exitCode=1;}
finally{clearTimeout(watchdog);await closeAll();await Promise.allSettled(responseTasks);report.count=report.checks.length;report.passed=report.checks.filter(c=>c.ok).length;report.elapsedMs=Date.now()-began;
  report.ok=report.scenes.length===2&&report.scenes.every(s=>s.status==='VERIFIED')&&report.errors.length===0&&report.passed===report.count&&Object.values(report.cleanup).every(Boolean);report.status=report.ok?'VERIFIED':'FAILED';if(!report.ok)process.exitCode=1;json('report.json',report);console.log(JSON.stringify(report));}
