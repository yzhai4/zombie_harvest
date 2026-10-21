import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// Actual Chrome, original complete native inputs seeded once before loader.
// No VM, hidden game action, postboot test-state write, forced control or save.
const a = {}, flags = new Set(['--html','--sprites','--input-manifest','--out','--expect-html-sha256','--expect-input-manifest-sha256','--playwright-module','--chrome-executable']);
for (let i=2;i<process.argv.length;i+=2) { assert.ok(flags.has(process.argv[i]) && process.argv[i+1] && !Object.hasOwn(a,process.argv[i])); a[process.argv[i]]=process.argv[i+1]; }
for (const k of ['--html','--sprites','--input-manifest','--out','--playwright-module','--chrome-executable']) assert.ok(path.isAbsolute(a[k] || ''), k+' absolute path required');
for (const k of ['--expect-html-sha256','--expect-input-manifest-sha256']) assert.match(a[k] || '',/^[a-f0-9]{64}$/);
assert.ok(!existsSync(a['--out']),'fresh output only'); mkdirSync(a['--out'],{recursive:true});
const out=a['--out'], sha=b=>createHash('sha256').update(b).digest('hex'), read=p=>readFileSync(p), write=(n,b)=>writeFileSync(path.join(out,n),b), json=(n,v)=>write(n,JSON.stringify(v,null,2)+'\n');
const html=read(a['--html']), sprites=read(a['--sprites']), method=read(fileURLToPath(import.meta.url)), imBytes=read(a['--input-manifest']), sourceSha=sha(html);
assert.equal(sourceSha,a['--expect-html-sha256']); assert.equal(sha(imBytes),a['--expect-input-manifest-sha256']);
const im=JSON.parse(imBytes), sourceText=html.toString('utf8'), saveKey=sourceText.match(/const SAVE_KEY = '([^']+)'/)?.[1];
assert.ok(saveKey); assert.equal(im.schema,'RelayHandoffMemoryBrowserInputsV1'); assert.equal(im.sourceHtmlSha256,sourceSha);
assert.deepEqual(im.scenes.map(s=>s.id),['actual-held-core','actual-old-delivered']);
const minute=p=>(p.day-1)*1440+p.hour*60+p.minute, payload=raw=>{const v=JSON.parse(raw);return v.payload||v;}, same=(x,y)=>{try{assert.deepEqual(x,y);return true;}catch{return false;}};
const expectedCapsule=e=>({version:1,eventId:e.eventId,eventSeq:e.seq,commandId:e.commandId,causationId:e.causationId,tick:e.tick,actorId:'player-1',recipientId:e.payload.commanderId,projectId:e.payload.projectId,itemId:'relayCore',itemInstanceId:e.payload.itemInstanceId,defId:'relay-chain-001',definitionVersion:1,instanceId:e.instanceId,expectedEventId:e.payload.expectedEventId});
const inputs=im.scenes.map(s=>{assert.ok(typeof s.file==='string'&&!path.isAbsolute(s.file)&&!s.file.split(/[\\/]/).includes('..'));const b=read(path.join(path.dirname(a['--input-manifest']),s.file));assert.equal(sha(b),s.sha256);assert.equal(b.length,s.bytes);assert.equal(s.kind,'original-complete-source-native-writer');return {...s,raw:b.toString('utf8'),p:payload(b.toString('utf8'))};});
write('source.html',html); write('actor-sprites.js',sprites); write('runner-executed.mjs',method); write('input-manifest.json',imBytes);
for(const s of inputs)write(s.id+'-input-native.json',s.raw);
const report={runner:'browser-relay-handoff-memory-v1',runnerSha256:sha(method),sourceHtmlSha256:sourceSha,inputManifestSha256:sha(imBytes),mode:'original-complete-source-native-preboot-fixtures-public-Chrome-controls',naturalGameplay:false,humanExperience:false,testStateWritesAfterBoot:false,hiddenGameActionsAfterBoot:false,forceClicks:false,sourceVmExecuted:false,normalSaveBeforePagehideRequired:true,budget:{overallSeconds:120,sceneSeconds:50,minimumPlayerHp:35,maximumObservedHpLoss:12,maximumPublicControlsPerScene:18,navigationActions:0},checks:[],errors:[],scenes:[],documents:[],cleanup:{}};
let browser,server; const contexts=new Set(),responses=[]; const started=Date.now(), deadline=started+120000;
const limit=(cap=8000)=>{assert.ok(Date.now()<deadline,'overall deadline exceeded');return Math.max(1,Math.min(cap,deadline-Date.now()));};
function check(name,ok,detail){report.checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});assert.ok(ok,name);}
function artifact(name){const b=read(path.join(out,name));return {file:name,sha256:sha(b),bytes:b.length};}
try {
 server=createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname;if(p==='/'||p==='/index.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);}else if(p==='/actor-sprites.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(sprites);}else{res.writeHead(404);res.end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const pw=statSync(a['--playwright-module']).isDirectory()?createRequire(import.meta.url)(a['--playwright-module']):await import(pathToFileURL(a['--playwright-module']).href);
 browser=await (pw.chromium||pw.default.chromium).launch({headless:true,executablePath:a['--chrome-executable'],timeout:limit(30000)}); report.browserVersion=browser.version();
 for(const input of inputs){
  const scene={id:input.id,inputSha256:input.sha256,kind:input.kind,originalEnemyIds:input.p.worldZombies.map(e=>e.id),actions:[],captures:[],status:'STARTED'};report.scenes.push(scene);let context,page;
  const sceneDeadline=Math.min(deadline,Date.now()+50000);let firstHp;
  try {
   context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.add(context);
   await context.addInitScript(({key,raw,id})=>{const marker='qa-handoff-memory-preboot-v1';if(!sessionStorage.getItem(marker)){localStorage.setItem(key,raw);sessionStorage.setItem(marker,JSON.stringify({id,seedCount:1}));}},{key:saveKey,raw:input.raw,id:input.id});
   page=await context.newPage();page.setDefaultTimeout(limit());page.on('pageerror',e=>report.errors.push({scene:input.id,type:'pageerror',message:e.message}));
   page.on('response',r=>{if(r.request().resourceType()==='document'&&r.frame()===page.mainFrame())responses.push((async()=>{const b=await r.body();report.documents.push({scene:input.id,status:r.status(),sha256:sha(b)});})().catch(e=>report.errors.push({scene:input.id,type:'document',message:e.message})));});
   async function guard(label){assert.ok(Date.now()<sceneDeadline,'scene deadline exceeded');const s=await page.evaluate(()=>({started:document.getElementById('startOverlay')?.classList.contains('hidden'),hp:Number(document.getElementById('hpValue')?.textContent),battle:document.body.classList.contains('threat-map-active')}));if(s.started){firstHp??=s.hp;assert.ok(Number.isFinite(s.hp)&&s.hp>35&&!s.battle&&firstHp-s.hp<=12,'public safety budget reached');}scene.lastPublicSafety={label,...s};}
   async function click(selector,label){await guard('before-'+label);assert.ok(scene.actions.length<18,'public control budget exceeded');const e=page.locator(selector);check(input.id+': '+label+' is visible and enabled',await e.isVisible()&&await e.isEnabled());await e.click({timeout:limit()});scene.actions.push({label,selector});await guard('after-'+label);}
   async function saved(label){const raw=await page.evaluate(k=>localStorage.getItem(k),saveKey);assert.ok(raw);const name=input.id+'-'+label+'-native.json';write(name,raw);scene.captures.push(artifact(name));return {raw,p:payload(raw),envelope:JSON.parse(raw)};}
   async function waitSave(label,predicate){const until=Math.min(sceneDeadline,Date.now()+15000);while(Date.now()<until){await guard('wait-'+label);const raw=await page.evaluate(k=>localStorage.getItem(k),saveKey);if(raw){const e=JSON.parse(raw),p=e.payload||e;if(predicate(p,e,raw)&&e.reason!=='pagehide')return saved(label);}await page.waitForTimeout(Math.min(100,limit(1000)));}assert.fail('no normal automatic writer reached '+label);}
   async function capture(label,selector){await guard('capture-'+label);const e=page.locator(selector);await e.waitFor({state:'visible',timeout:limit()});await e.scrollIntoViewIfNeeded({timeout:limit()});const v=await e.evaluate(el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el);return {text:el.textContent,status:el.dataset.npcHandoffStatus,npcId:el.dataset.npcHandoffNpc,hidden:el.hidden,display:c.display,visibility:c.visibility,fontSize:c.fontSize,opacity:c.opacity,rect:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom},viewport:{width:innerWidth,height:innerHeight}};});const name=input.id+'-'+label;json(name+'-ui.json',v);scene.captures.push(artifact(name+'-ui.json'));await page.screenshot({path:path.join(out,name+'.png'),timeout:limit(5000)});scene.captures.push(artifact(name+'.png'));return v;}
   async function query(id,label){await click(`[data-context-action="npcView"][data-npc-id="${id}"]`,label);return capture(label,'#npcHandoffMemory');}
   async function reloadContinue(label){await guard('before-reload');await page.reload({waitUntil:'domcontentloaded',timeout:limit(15000)});await page.locator('#continueSaveBtn').waitFor({state:'visible',timeout:limit()});await click('#continueSaveBtn',label);await page.waitForFunction(()=>document.getElementById('startOverlay').classList.contains('hidden'),null,{timeout:limit()});}
   await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded',timeout:limit(15000)});await page.locator('#continueSaveBtn').waitFor({state:'visible',timeout:limit()});await click('#continueSaveBtn','continue-original-writer');
   await page.waitForFunction(()=>document.getElementById('startOverlay').classList.contains('hidden'),null,{timeout:limit()});
   const before=await waitSave('normal-post-boot',(p,e,raw)=>raw!==input.raw&&e.payload&&typeof e.checksum==='string'&&p.worldMeta.eventSeq>input.p.worldMeta.eventSeq&&p.npcs.length===10);
   if(input.id==='actual-held-core'){
    await page.locator('[data-context-action="relayHandoff"]').waitFor({state:'visible',timeout:limit()});await click('[data-context-action="relayHandoff"]','actual-handoff');
    const normal=await waitSave('normal-handoff',(p)=>p.worldMeta.events.some(e=>e.type==='relay.coreHandedOff'&&e.seq>input.p.worldMeta.eventSeq));
    const events=normal.p.worldMeta.events.filter(e=>e.type==='relay.coreHandedOff'&&e.seq>input.p.worldMeta.eventSeq);check(input.id+': one actual new handoff success is saved before pagehide',events.length===1);
    const e=events[0],recipient=e.payload.commanderId,npc=normal.p.npcs.find(n=>n.id===recipient),capsule=npc?.memory?.relayCoreHandoff;scene.actualReceipt=e;scene.recipientId=recipient;
    check(input.id+': memory matches actual successful receipt and original player actor',same(capsule,expectedCapsule(e))&&e.actorId==='player-1'&&normal.p.worldMeta.replay.commands.some(c=>c.commandId===e.commandId&&c.type==='relay.coreHandoff'&&c.actorId==='player-1'));
    check(input.id+': only actual receiving NPC owns one capsule and core paid once',normal.p.npcs.filter(n=>n.memory?.relayCoreHandoff!==null).length===1&&normal.p.specialItems.relayCore===0);
    const q=await query(recipient,'recorded-desktop');check(input.id+': authorized actual view shows personal history',q.status==='recorded'&&q.npcId===recipient&&q.text.includes('广播核心')&&q.text.includes('交给了我'));
    await page.setViewportSize({width:390,height:844});const mobile=await capture('recorded-390','#npcHandoffMemory');check(input.id+': 390 memory is readable and bound to same actor',mobile.status==='recorded'&&mobile.npcId===recipient&&parseFloat(mobile.fontSize)>=12&&mobile.rect.width>0&&mobile.rect.bottom<=844);
    await click(`[data-context-action="npcView"][data-npc-id="${recipient}"]`,'repeat-free-view');
    await click('#openInfoBtn','open-terminal');await click('[data-info-tab="survivors"]','survivors-tab');const row=await capture('roster-390',`[data-npc-handoff-surface="roster"][data-npc-handoff-npc="${recipient}"]`);check(input.id+': roster same-ID row consumes the same history',row.status==='recorded'&&row.text===mobile.text);
    const roster=await page.locator('[data-npc-handoff-surface="roster"]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.npcHandoffNpc,hidden:n.hidden,text:n.textContent})));check(input.id+': actual roster has ten unique personal fact rows',roster.length===10&&new Set(roster.map(n=>n.id)).size===10&&roster.some(n=>n.id===recipient));check(input.id+': other roster identities receive no cached history',roster.filter(n=>n.id!==recipient).length===9&&roster.filter(n=>n.id!==recipient).every(n=>n.hidden&&!n.text));
    await click('#infoModalClose','close-terminal');const later=await waitSave('normal-after-query',(p)=>p.worldMeta.eventSeq>normal.p.worldMeta.eventSeq&&p.worldMeta.events.some(x=>x.type==='time.advanced'&&x.seq>normal.p.worldMeta.eventSeq));
    check(input.id+': repeated view does not grant another handoff or standing reward',same(later.p.npcs.find(n=>n.id===recipient).memory.relayCoreHandoff,capsule)&&later.p.worldMeta.events.filter(x=>x.type==='relay.coreHandedOff'&&x.seq>input.p.worldMeta.eventSeq).length===1&&same(later.p.campStanding,normal.p.campStanding));
    const migrationCount=later.p.worldMeta.events.filter(x=>x.type==='save.migrated').length;
    await reloadContinue('continue-new-memory');const restored=await waitSave('normal-after-continue',(p)=>minute(p)>minute(later.p)&&p.worldMeta.events.some(x=>x.type==='time.advanced'&&x.seq>later.p.worldMeta.eventSeq));
    check(input.id+': Continue and new real timer tick retain memory without adapter or duplicate',same(restored.p.npcs.find(n=>n.id===recipient).memory.relayCoreHandoff,capsule)&&restored.p.worldMeta.events.filter(x=>x.type==='save.migrated').length===migrationCount&&restored.p.worldMeta.events.filter(x=>x.type==='relay.coreHandedOff'&&x.seq>input.p.worldMeta.eventSeq).length===1);
    const again=await query(recipient,'restored-390');check(input.id+': actual restored free view still shows the same personal history',again.status==='recorded'&&again.npcId===recipient&&again.text===mobile.text);
   }else{
    const adapted=await waitSave('normal-old-adapted',(p)=>p.worldMeta.events.some(e=>e.type==='save.migrated'&&e.seq>input.p.worldMeta.eventSeq)||minute(p)>minute(input.p));
    check(input.id+': original old successful history is not backfilled',adapted.p.npcs.every(n=>Object.hasOwn(n.memory,'relayCoreHandoff')&&n.memory.relayCoreHandoff===null)&&adapted.p.relayProject.handoffAt===input.p.relayProject.handoffAt);
    const recipient='commander',q=await query(recipient,'old-unrecorded-desktop');check(input.id+': free view says unrecorded rather than denying original delivery',q.status==='unrecorded'&&q.npcId===recipient&&q.text==='交付记忆：未记录');
    const count=adapted.p.worldMeta.events.filter(e=>e.type==='save.migrated').length;await reloadContinue('continue-old-adapter-once');const restored=await waitSave('normal-old-after-second-continue',(p)=>minute(p)>minute(adapted.p));
    check(input.id+': second Continue leaves null and adds no second migration or handoff',restored.p.npcs.every(n=>n.memory.relayCoreHandoff===null)&&restored.p.worldMeta.events.filter(e=>e.type==='save.migrated').length===count&&restored.p.worldMeta.events.filter(e=>e.type==='relay.coreHandedOff').length===input.p.worldMeta.events.filter(e=>e.type==='relay.coreHandedOff').length);
   }
   const seeded=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('qa-handoff-memory-preboot-v1')));check(input.id+': original input seeded only once across real reload',seeded.id===input.id&&seeded.seedCount===1);scene.status='VERIFIED';
  }catch(e){scene.status='FAILED';report.errors.push({scene:input.id,type:e.name,message:e.message});if(page)try{await page.screenshot({path:path.join(out,input.id+'-failure.png'),timeout:5000});scene.captures.push(artifact(input.id+'-failure.png'));}catch(error){scene.failureScreenshotUnavailable=error.message;}}
  finally{if(context){await context.close();contexts.delete(context);}}
 }
}catch(e){report.errors.push({type:e.name,message:e.message});}
finally{
 await Promise.allSettled(responses);for(const doc of report.documents){const ok=doc.status===200&&doc.sha256===sourceSha;report.checks.push({name:'main document '+doc.scene+' matches frozen source',ok});if(!ok)report.errors.push({scene:doc.scene,type:'document-source-mismatch',actual:doc.sha256,expected:sourceSha,status:doc.status});}
 for(const scene of report.scenes.filter(s=>s.status==='VERIFIED')){const count=report.documents.filter(d=>d.scene===scene.id).length,ok=count===2;report.checks.push({name:scene.id+': completed initial load and real reload have exactly two main responses',ok});if(!ok)report.errors.push({scene:scene.id,type:'document-coverage',expected:2,actual:count});}
 for(const c of [...contexts])try{await c.close();contexts.delete(c);}catch{}report.cleanup.contextsClosed=contexts.size===0;
 if(browser)try{await browser.close();report.cleanup.browserClosed=true;}catch{report.cleanup.browserClosed=false;}
 if(server)await new Promise(resolve=>{server.close(()=>{report.cleanup.serverClosed=true;resolve();});server.closeAllConnections?.();});
 report.count=report.checks.length;report.passed=report.checks.filter(c=>c.ok).length;report.ok=report.errors.length===0&&report.scenes.length===2&&report.scenes.every(s=>s.status==='VERIFIED')&&report.checks.every(c=>c.ok)&&Object.values(report.cleanup).every(Boolean);report.elapsedMs=Date.now()-started;json('report.json',report);console.log(JSON.stringify({ok:report.ok,count:report.count,passed:report.passed,sourceHtmlSha256:sourceSha,errors:report.errors,cleanup:report.cleanup}));if(!report.ok)process.exitCode=1;
}
