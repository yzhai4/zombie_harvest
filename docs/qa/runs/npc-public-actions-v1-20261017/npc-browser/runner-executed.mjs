import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

// Portable final-r3 fixture browser. Default dependency root is this script's
// parent repository; external execution supplies --repo-root explicitly. All
// scene inputs are real-writer offline derivatives, never natural gameplay.
const options = {};
for (let i=2;i<process.argv.length;i+=2) {
  assert.ok(['--run-approved','--repo-root','--html','--expect-html-sha256','--input','--expect-input-sha256','--death-interact-input','--death-order-input','--out'].includes(process.argv[i]) && process.argv[i+1]);
  options[process.argv[i]]=process.argv[i+1];
}
assert.equal(options['--run-approved'],'yes','preparation only; require explicit later run authorization');
for(const flag of ['--html','--input','--out','--death-interact-input','--death-order-input'])assert.ok(path.isAbsolute(options[flag]||''));
const root=options['--repo-root']||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');assert.ok(path.isAbsolute(root));
const {saveKey,sourceRuntimeFactory}=await import(pathToFileURL(path.join(root,'scripts/lib/source-runtime-fixture.mjs')).href);
for(const flag of ['--expect-html-sha256','--expect-input-sha256'])assert.match(options[flag]||'',/^[a-f0-9]{64}$/);
const sha=b=>createHash('sha256').update(b).digest('hex');
const source=readFileSync(options['--html']), input=readFileSync(options['--input']), out=options['--out'];
assert.equal(sha(source),options['--expect-html-sha256']);assert.equal(sha(input),options['--expect-input-sha256']);
assert.equal(sha(source),'9edb6d3c3daa7ec63d90594381d811cb077828fd0955fb7095c601ce91b5b87b','this frozen NPC suite requires final r3 bytes');
assert.equal(sha(input),'1e29b29ed13ea722b20955d79306b307820099cfad4d78cd68175f770d8f269f','actual source19cb fresh06 initial writer');
assert.equal(existsSync(out),false,'preserve original results');mkdirSync(out,{recursive:true});
const runner=readFileSync(fileURLToPath(import.meta.url)), sprites=readFileSync(path.join(root,'dist/actor-sprites.js'));
const helper=readFileSync(path.join(root,'scripts/lib/source-runtime-fixture.mjs')), adapter=readFileSync(path.join(root,'scripts/check-report-recovery.mjs'));
const deathOriginal=readFileSync(path.join(root,'scripts/fixtures/npc-threat-attention-v1/browser-writer-day1-1110-save21.json'));
const deathCaptureMeta=readFileSync(path.join(root,'scripts/fixtures/npc-threat-attention-v1/capture-meta.json'));
assert.equal(sha(deathOriginal),'5fdd18e8307d4109e671d7fb98298722611854fafb23c5b72a3491c1f1e32ee4');
for(const [file,bytes] of [['runner-executed.mjs',runner],['source.html',source],['original-writer.json',input],['actor-sprites-executed.js',sprites],['fixture-helper-executed.mjs',helper],['io-adapter-executed.mjs',adapter]])writeFileSync(path.join(out,file),bytes);
writeFileSync(path.join(out,'death-original-writer.json'),deathOriginal);writeFileSync(path.join(out,'death-original-capture-meta.json'),deathCaptureMeta);
const original=JSON.parse(input).payload||JSON.parse(input), npcId='sergeant';
const report={schema:'NpcPublicActionsBrowserV1',runner:'browser-npc-public-actions-v1',runnerSha256:sha(runner),sourceHtmlSha256:sha(source),sourceFixtureSha256:sha(input),
  repositoryRootResolution:options['--repo-root']?'explicit --repo-root for external execution':'parent of installed scripts directory',deathOriginalWriterSha256:sha(deathOriginal),deathCaptureMetaSha256:sha(deathCaptureMeta),
  originalHtmlSha256:'19cb05c4341ab1353e1ac5362b685a4af3a88fc826e349504b9d57a42639eb6f',sharedFixtureHelperSha256:sha(helper),ioAdapterSha256:sha(adapter),
  mode:'TEST-ONLY offline actual-loader-writer derivatives with actual public browser controls',naturalGameplay:false,naturalGameplayClaim:false,
  injectionBeforeLoader:true,gameStateMutationAfterBoot:false,hiddenGameActionsAfterBoot:false,
  parameters:{source:'artifact:source.html',input:'artifact:original-writer.json',deathInteract:'artifact:actual-advance-death-interact-parent-native-input.json',deathOrder:'artifact:actual-advance-death-order-parent-native-input.json',
    expectedHtmlSha256:options['--expect-html-sha256'],expectedInputSha256:options['--expect-input-sha256'],repoRoot:options['--repo-root']?'explicit external dependency root':'installed repository relative',out:'artifact:./'},checks:[],errors:[],scenes:[],documentHashes:[]};
const check=(name,ok,detail)=>{report.checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});assert.ok(ok,name);};
const semanticEqual=(a,b)=>{try{assert.deepStrictEqual(a,b);return true;}catch{return false;}};
const clock=p=>(p.day-1)*1440+p.hour*60+p.minute;
const business=p=>({energy:p.energy,hp:p.hp,food:p.food,seeds:p.seeds,wood:p.wood,stone:p.stone,parts:p.parts,medicine:p.medicine,
  sanity:p.sanity,campStanding:p.campStanding,contentState:p.contentState,quests:p.quests,
  roster:p.npcs.map(n=>({id:n.id,hp:n.hp,lifeState:n.lifeState,sanity:n.sanity,supportRequested:n.supportRequested,order:n.order,bond:n.bond,memory:n.memory,relations:n.relations,hero:n.hero,lastReport:n.lastReport})),
  rngState:p.worldMeta.rngState,eventSeq:p.worldMeta.eventSeq,events:p.worldMeta.events,commands:p.worldMeta.replay.commands,seen:p.worldMeta.seenCommands,minute:clock(p)});
const specs=[
  {name:'band-1.018-view-only',kind:'band',distance:1.0181599311636986,paused:true,energy:10},
  {name:'inner-zero-energy-first-E',kind:'zero',distance:.5,paused:true,energy:0},
  {name:'inner-public-buttons-support-reload',kind:'support',distance:.5,paused:false,energy:20},
  {name:'critical-low-risk-guard',kind:'critical',distance:.5,paused:false,energy:20},
  {name:'supported-autonomous-refusal',kind:'refusal',distance:.5,paused:true,energy:10,supported:true},
  {name:'supported-status-inquiry',kind:'status',distance:.5,paused:true,energy:0,supported:true},
  {name:'actual-advance-death-interact',kind:'death-interact',npcId:'doctor',tileX:16,tileY:20,inputFile:'death-interact-input.json',inputSha256:'af9f8f2a02e52522c87245fc70b9cf5b75983f174f0ec9fc782a266698dd25c0'},
  {name:'actual-advance-death-order',kind:'death-order',npcId:'doctor',tileX:16,tileY:20,inputFile:'death-order-input.json',inputSha256:'2d9242855e9ee0bcb81971dedc6fb3e84f8ecbd813b7bb2bab90dd5c912063ed'},
];
const factory=sourceRuntimeFactory(options['--html']);
const deriveScenes=()=>specs.map(spec=>{
  if(spec.kind.startsWith('death-')){
    const inputPath=options[spec.kind==='death-interact'?'--death-interact-input':'--death-order-input'];
    const bytes=readFileSync(inputPath);assert.equal(sha(bytes),spec.inputSha256);
    const r=factory([[saveKey,bytes.toString('utf8')]]);assert.equal(r.api.validate({raw:bytes.toString('utf8'),sourceCategory:'primary'}).ok,true);
    assert.equal(r.api.start().ok,true);r.tasks.clear();
    assert.equal(r.api.save({force:true,reason:'TEST-ONLY actual writer NPC completion-death browser input'}),true);
    const raw=r.storage.get(saveKey);assert.equal(r.api.validate({raw,sourceCategory:'primary'}).ok,true);
    writeFileSync(path.join(out,`${spec.name}-parent-native-input.json`),bytes);writeFileSync(path.join(out,`${spec.name}-input-save.json`),raw);
    return {...spec,raw,inputSourceRef:`artifact:${spec.name}-parent-native-input.json`,inputSha256:sha(raw),parentNativeInputSha256:sha(bytes),originalWriterSha256:'5fdd18e8307d4109e671d7fb98298722611854fafb23c5b72a3491c1f1e32ee4',
      fixtureSourceCategory:'TEST-ONLY offline derivative made by independent real source loader/writer; historical failed route capture is not natural success',
      changes:['Original real writer wz-4 normal hp100 kind/AI/damage rules preserved; other enemies isolated out',
        'TEST-ONLY original ten NPC identities retained; doctor hp1 critical at16,20 and player16,19.7; other NPCs30,20 with null motion targets/zero move clock',
        'TEST-ONLY original enemy initial position16,20.4 goal16,20 and initial think/attackClock/perception0; real continuous motion enabled',
        'No browser after-boot GameState/receipt injection; geometry is not proof of death, actual child combat/death receipts required'],offlineViewGate:null,offlineSupportGate:null};
  }
  const r=factory([[saveKey,input.toString('utf8')]]);assert.equal(r.api.validate({raw:input.toString('utf8'),sourceCategory:'primary'}).ok,true);
  assert.equal(r.api.start().ok,true);r.tasks.clear();const s=r.api.state;
  s.worldZombies=[];s.zombies=[];s.player.x=11;s.player.y=9;s.energy=spec.energy;s.worldMeta.clock.paused=spec.paused;s.worldMeta.clock.rate=1;
  s.npcs.forEach((n,i)=>{n.x=2+i;n.y=2;n.motionTarget=null;n.needClock=0;n.workClock=0;n.eventChain.cooldown=1000;
    n.needs={...n.needs,hunger:5,fatigue:5,stress:10,social:10,safety:10,energy:90};});
  const target=s.npcs.find(n=>n.id===npcId);target.x=11;target.y=9+spec.distance;
  target.supportRequested=!!spec.supported;target.bond=spec.supported?1:0;target.order=spec.supported?'guard':null;
  target.memory.helpedByPlayer=spec.supported?1:0;
  if(spec.kind==='critical'){target.hp=25;target.lifeState='critical';}
  if(spec.kind==='refusal'){
    target.sanity=5;target.needs.stress=100;target.personality.riskTolerance=1;
    target.relations={...target.relations,trustToPlayer:0,respectToPlayer:0,loyaltyToCamp:0,loyaltyToCommander:0,resentmentOfPlayer:80,fearOfPlayer:80,belongingToCamp:0};
  }
  vm.runInContext('qa.qaNpcGate=npcPublicActionGate;qa.qaNpcAttitude=deriveNpcAttitude;',r.context);
  const view=r.api.qaNpcGate(npcId,{action:'view'}),support=r.api.qaNpcGate(npcId,{action:'support'});
  assert.equal(view.ok,true);if(spec.kind==='refusal')assert.ok(r.api.qaNpcAttitude(target).defectionRisk>=72);
  assert.equal(r.api.save({force:true,reason:'TEST-ONLY isolated NPC public browser input'}),true);
  const raw=r.storage.get(saveKey);assert.equal(r.api.validate({raw,sourceCategory:'primary'}).ok,true);
  writeFileSync(path.join(out,`${spec.name}-input-save.json`),raw);
  const description={...spec,inputSha256:sha(raw),fixtureSourceCategory:'offline derivative of unchanged actual source19cb writer',
    changes:['TEST-ONLY player relocated to (11,9), original sergeant relocated by declared distance; original ten IDs retained',
      'TEST-ONLY existing enemies cleared; other original NPCs placed far away; moderate needs, zero need/work clocks, story cooldown1000 and null motion targets isolate this consumer',
      `TEST-ONLY energy=${spec.energy}, paused=${spec.paused}, rate1; no browser post-boot state or receipt injection`,
      ...(spec.supported?['TEST-ONLY prior support/bond/helpedByPlayer fixture state; not a naturally earned support claim']:[]),
      ...(spec.kind==='critical'?['TEST-ONLY hp25/lifeState critical retains original low-risk admission']:[]),
      ...(spec.kind==='refusal'?['TEST-ONLY original relation/stress/sanity/personality fields choose baseline legitimate high-risk refusal']:[])],offlineViewGate:view,offlineSupportGate:support};
  return {...description,raw};
});
let browser;const contexts=[],httpResponses=[];
const server=createServer((req,res)=>{const route=new URL(req.url,'http://localhost').pathname;
  if(route==='/'||route==='/index.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(source);}
  else if(route==='/actor-sprites.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(sprites);}else{res.writeHead(404);res.end();}});
try{
  const scenes=deriveScenes();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const require=createRequire(import.meta.url),{chromium}=require(process.env.ZH_PLAYWRIGHT_MODULE||'playwright');
  browser=await chromium.launch({headless:true,channel:process.env.ZH_BROWSER_CHANNEL||'chrome'});report.browserVersion=browser.version();
  for(const scene of scenes){
    const result={...scene,raw:undefined,verified:false};report.scenes.push(result);
    const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);
    await context.addInitScript(({key,raw})=>{if(!sessionStorage.getItem('qa-npc-seeded')){localStorage.clear();localStorage.setItem(key,raw);sessionStorage.setItem('qa-npc-seeded','yes');}},{key:saveKey,raw:scene.raw});
    const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push({scene:scene.name,message:e.message}));
    page.on('response',response=>{if(response.request().resourceType()==='document'&&response.frame()===page.mainFrame())httpResponses.push((async()=>{
      const hash=sha(await response.body());report.allMainDocuments??=[];report.allMainDocuments.push({scene:scene.name,url:response.url(),status:response.status(),sha256:hash});
      if(!response.ok()||hash!==report.sourceHtmlSha256)report.errors.push({scene:scene.name,type:'main-document-hash',sha256:hash});
    })().catch(e=>report.errors.push({scene:scene.name,type:'main-document-body',message:e.message})));});
    async function document(response,stage){const hash=sha(await response.body());report.documentHashes.push({scene:scene.name,stage,sha256:hash});check(`${scene.name}: ${stage} HTTP exact source`,response.ok()&&hash===report.sourceHtmlSha256);}
    async function saved(label){const raw=await page.evaluate(k=>localStorage.getItem(k),saveKey);writeFileSync(path.join(out,`${scene.name}-${label}-save.json`),raw);const e=JSON.parse(raw);return e.payload||e;}
    async function checkpoint(label){await document(await page.reload({waitUntil:'domcontentloaded'}),label);const p=await saved(label);await page.locator('#continueSaveBtn').click();return p;}
    async function waitEvent(type,seq){await page.waitForFunction(({key,type,seq})=>JSON.parse(localStorage.getItem(key)).payload.worldMeta.events.some(e=>e.type===type&&e.seq>seq),{key:saveKey,type,seq},{timeout:18000});
      const p=await saved(type.replaceAll('.','-'));await page.screenshot({path:path.join(out,`${scene.name}-${type.replaceAll('.','-')}.png`)});return p;}
    async function waitAutomaticOutcome(reason,seq,outcomeType){const at=Date.now();
      await page.waitForFunction(({key,reason,seq,outcomeType})=>{const e=JSON.parse(localStorage.getItem(key));return e.reason===`command:npc:${reason}`&&
        e.payload.worldMeta.events.some(v=>v.seq>seq&&v.type===outcomeType)&&e.payload.worldMeta.events.some(v=>v.seq>seq&&v.type==='command.rejected'&&v.payload.reason===reason);},
        {key:saveKey,reason,seq,outcomeType},{timeout:8000});
      const raw=await page.evaluate(k=>localStorage.getItem(k),saveKey),e=JSON.parse(raw);
      result.automaticOutcomeCheckpoint={reason:e.reason,wallMs:Date.now()-at,sha256:sha(raw),manualSave:false,pagehideBeforeEvidence:false,
        method:'read-only native localStorage polling for wrapper-specific checkpoint reason plus matching real outcome and command.rejected'};
      return saved('automatic-outcome-checkpoint');}
    const npcId=scene.npcId||'sergeant';
    const target=p=>p.npcs.find(n=>n.id===npcId), newEvents=(p,b)=>p.worldMeta.events.filter(e=>e.seq>b.worldMeta.eventSeq);
    async function ui(){return page.locator('#contextPanel').evaluate(el=>({text:el.innerText,title:document.getElementById('contextTitle')?.textContent,
      buttons:[...el.querySelectorAll('button[data-context-action]')].map(b=>({action:b.dataset.contextAction,npcId:b.dataset.npcId,order:b.dataset.order,text:b.innerText,disabled:b.disabled}))}));}
    async function hoverTarget(){const tile=page.locator(`#world .tile[data-x="${scene.tileX??11}"][data-y="${scene.tileY??10}"]`);check(`${scene.name}: authored visible target tile is public`,await tile.isVisible()&&!(await tile.getAttribute('class')).includes('fogged'));await tile.hover();}
    function typed(before,after,type,operation,energy,minutes){const events=newEvents(after,before),matches=events.filter(e=>e.type===type),event=matches[0],p=event?.payload;
      const command=after.worldMeta.replay.commands.find(c=>c.commandId===event?.commandId);
      check(`${scene.name}: ${operation} exact original ID/player typed receipt`,matches.length===1&&p?.proofVersion===1&&p.npcId===npcId&&p.operation===operation&&p.target.id===npcId&&
        p.target.presentAtCompletion===true&&event.actorId==='player-1'&&command?.actorId==='player-1'&&command.payload.npcId===npcId);
      check(`${scene.name}: ${operation} gross payment and clock`,p.payment.cost.energy===energy&&p.payment.before.energy-p.payment.after.energy===energy&&p.clock.requestedMinutes===minutes&&p.clock.elapsedMinutes===minutes);
      check(`${scene.name}: explicit real proof stages`,p.outcome==='completed'&&!Object.hasOwn(p.target,'afterAction')&&p.target.before.id===npcId&&p.target.atCompletion.id===npcId&&
        (minutes?p.target.beforeAdvance?.id===npcId&&p.target.afterAdvance?.id===npcId:p.target.beforeAdvance===null&&p.target.afterAdvance===null));
      if(minutes){const child=after.worldMeta.replay.commands.find(c=>c.commandId===p.advance?.commandId),advance=events.find(e=>e.eventId===p.advance?.eventId);
        check(`${scene.name}: actual 15 minute child causal join`,child?.type==='world.advance'&&child.payload.minutes===15&&advance?.type==='time.advanced'&&advance.commandId===child.commandId&&advance.causationId===command.commandId&&advance.payload.minutes===15);}
      else check(`${scene.name}: zero-step outcome has no child`,p.advance===null&&!events.some(e=>e.type==='time.advanced'&&e.causationId===command.commandId));
      result.receipts=(result.receipts||[]).concat({event,command});return p;}
    function rejected(before,after,type,reason,orderId=null){
      const events=newEvents(after,before),failures=events.filter(e=>e.type==='command.rejected'&&e.payload.type===type&&e.payload.reason===reason),event=failures[0];
      const command=after.worldMeta.replay.commands.find(c=>c.commandId===event?.commandId);
      check(`${scene.name}: rejection retains exact original NPC/player command`,failures.length===1&&event.actorId==='player-1'&&command?.actorId==='player-1'&&command.type===type&&command.payload.npcId===npcId&&(!orderId||command.payload.orderId===orderId));
      check(`${scene.name}: rejected command owns no advance`,!events.some(e=>e.type==='time.advanced'&&e.causationId===command.commandId));
      result.receipts=(result.receipts||[]).concat({event,command});return {event,command};
    }
    await document(await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'}),'boot');await page.locator('#continueSaveBtn').click();
    const before=scene.kind.startsWith('death-')?await saved('boot-before-public-action'):await checkpoint('baseline-real-pagehide-writer');result.publicBefore=await ui();
    check(`${scene.name}: public target identity remains original same NPC`,result.publicBefore.buttons.some(b=>b.action==='npcView'&&b.npcId===npcId));
    check(`${scene.name}: original ten identities retained`,JSON.stringify(before.npcs.map(n=>n.id))===JSON.stringify(original.npcs.map(n=>n.id)));
    await page.screenshot({path:path.join(out,`${scene.name}-before.png`)});
    if(scene.kind==='band'){
      check(`${scene.name}: view enabled but support/orders disabled at 1.018`,await page.locator('[data-context-action="npcView"]').isEnabled()&&await page.locator('[data-context-action="npc"]').isDisabled()&&
        (await page.locator('[data-context-action="npcOrder"]').evaluateAll(bs=>bs.every(b=>b.disabled))));
      await page.locator('[data-context-action="npcView"]').click();result.viewToast=await page.locator('#toast').innerText();
      const afterView=await checkpoint('after-view-real-writer');check(`${scene.name}: pure view has no persisted business facts`,semanticEqual(business(afterView),business(before)));
      await page.keyboard.press('v');const card=page.locator(`#survivorList [data-npc="${npcId}"]`);check(`${scene.name}: near roster card allows pure view`,await card.isVisible()&&await card.isEnabled());
      await page.screenshot({path:path.join(out,`${scene.name}-roster-open-before-card.png`)});
      const rosterWriterAt=Date.now();await page.waitForFunction(key=>{const e=JSON.parse(localStorage.getItem(key));return e.reason==='world-tick';},saveKey,{timeout:20000});
      const rosterBefore=await saved('roster-open-normal-writer-before-card');result.rosterRendererBaseline={waitMs:Date.now()-rosterWriterAt,reason:'world-tick',manualSave:false,cardNotClickedYet:true};
      check(`${scene.name}: roster renderer baseline preserves existing business values`,semanticEqual(business(rosterBefore),business(afterView)));
      await card.click();await page.screenshot({path:path.join(out,`${scene.name}-roster-card-view.png`)});await page.locator('#infoModalClose').click();
      const afterCard=await checkpoint('after-roster-view-real-writer');check(`${scene.name}: roster view has no persisted business facts`,semanticEqual(business(afterCard),business(rosterBefore)));
      await hoverTarget();await page.keyboard.press('e');result.rejectionToast=await page.locator('#toast').innerText();await page.screenshot({path:path.join(out,`${scene.name}-E-rejected.png`)});
      const after=await checkpoint('after-E-rejection-real-writer'),events=newEvents(after,afterCard);
      rejected(afterCard,after,'npc.interact','npc-too-far');
      check(`${scene.name}: hovered E rejects exact NPC without fake success`,events.some(e=>e.type==='command.rejected'&&e.payload.type==='npc.interact'&&e.payload.reason==='npc-too-far')&&
        !events.some(e=>['npc.dialogueOpened','npc.interacted','npc.orderChanged'].includes(e.type))&&after.energy===afterCard.energy&&clock(after)===clock(afterCard)&&semanticEqual(target(after).memory,target(afterCard).memory)&&!target(after).supportRequested);
    }else if(scene.kind==='zero'){
      check(`${scene.name}: zero energy keeps view but paid button disabled`,await page.locator('[data-context-action="npcView"]').isEnabled()&&await page.locator('[data-context-action="npc"]').isDisabled());
      await page.locator('[data-context-action="npcView"]').click();await hoverTarget();await page.keyboard.press('e');
      const dialogue=await waitEvent('npc.dialogueOpened',before.worldMeta.eventSeq);typed(before,dialogue,'npc.dialogueOpened','dialogue-open',0,0);
      check(`${scene.name}: view did not arm paid support and first E is zero cost`,!target(dialogue).supportRequested&&dialogue.energy===0&&clock(dialogue)===clock(before));
      await page.keyboard.press('e');const after=await checkpoint('after-paid-E-rejection-real-writer');
      rejected(dialogue,after,'npc.interact','npc-energy');
      check(`${scene.name}: second E rejects energy without support receipt`,newEvents(after,dialogue).some(e=>e.type==='command.rejected'&&e.payload.reason==='npc-energy')&&!newEvents(after,dialogue).some(e=>e.type==='npc.interacted')&&!target(after).supportRequested&&after.energy===0);
    }else if(scene.kind==='support'){
      await page.locator('[data-context-action="npc"]').click();const dialogue=await waitEvent('npc.dialogueOpened',before.worldMeta.eventSeq);typed(before,dialogue,'npc.dialogueOpened','dialogue-open',0,0);
      check(`${scene.name}: public confirmation is explicit and same ID`,(await page.locator('[data-context-action="npc"]').innerText()).includes('确认请求')&&await page.locator('[data-context-action="npc"]').getAttribute('data-npc-id')===npcId);
      await page.locator('[data-context-action="npc"]').click();const after=await waitEvent('npc.interacted',dialogue.worldMeta.eventSeq);typed(dialogue,after,'npc.interacted','support-requested',2,15);
      check(`${scene.name}: actual same NPC support bond and memory changed`,!target(dialogue).supportRequested&&target(after).supportRequested&&target(after).bond===target(dialogue).bond+1&&target(after).memory.helpedByPlayer===target(dialogue).memory.helpedByPlayer+1);
      const reloaded=await checkpoint('support-reloaded-real-writer');
      await page.waitForFunction(({key,seq})=>JSON.parse(localStorage.getItem(key)).payload.worldMeta.events.some(e=>e.type==='time.advanced'&&e.seq>seq),{key:saveKey,seq:reloaded.worldMeta.eventSeq},{timeout:20000});
      const stable=await saved('reloaded-normal-tick');
      check(`${scene.name}: reload keeps same support without repeat payment or support`,target(stable).supportRequested&&target(stable).bond===target(after).bond&&target(stable).memory.helpedByPlayer===target(after).memory.helpedByPlayer&&
        !newEvents(stable,after).some(e=>e.type==='npc.interacted')&&stable.worldMeta.replay.commands.filter(c=>c.type==='npc.interact').length===after.worldMeta.replay.commands.filter(c=>c.type==='npc.interact').length);
    }else if(scene.kind==='critical'){
      check(`${scene.name}: original critical low-risk order remains publicly enabled`,target(before).lifeState==='critical'&&await page.locator('[data-context-action="npcOrder"][data-order="guard"]').isEnabled());
      await page.locator('[data-context-action="npcOrder"][data-order="guard"]').click();const after=await waitEvent('npc.orderChanged',before.worldMeta.eventSeq);typed(before,after,'npc.orderChanged','support-and-order',2,15);
      check(`${scene.name}: real critical guard support remains same NPC`,target(after).supportRequested&&target(after).order==='guard'&&target(after).bond===target(before).bond+1);
    }else if(scene.kind==='refusal'){
      const order=page.locator('[data-context-action="npcOrder"][data-order="patrol"]');check(`${scene.name}: legitimate request remains available before autonomy refusal`,await order.isEnabled());await order.click();result.refusalToast=await page.locator('#toast').innerText();
      const after=await waitAutomaticOutcome('npc-order-refused',before.worldMeta.eventSeq,'npc.orderRefused'),events=newEvents(after,before);result.refusalRelations={before:target(before).relations,after:target(after).relations,lastReport:target(after).lastReport};
      const refusal=rejected(before,after,'npc.order','npc-order-refused','patrol');
      check(`${scene.name}: autonomous refusal keeps its own facts without order success`,events.some(e=>e.type==='npc.orderRefused'&&e.payload.npcId===npcId&&e.payload.orderId==='patrol')&&events.some(e=>e.type==='command.rejected'&&e.payload.reason==='npc-order-refused')&&
        events.some(e=>e.type==='npc.orderRefused'&&e.causationId===refusal.command.commandId)&&!events.some(e=>e.type==='npc.orderChanged')&&target(after).order===target(before).order&&target(after).supportRequested===target(before).supportRequested&&after.energy===before.energy&&clock(after)===clock(before));
      const reloaded=await checkpoint('refusal-after-automatic-save-reload');
      check(`${scene.name}: reload retains automatically saved lawful refusal`,semanticEqual(target(reloaded).relations,target(after).relations)&&target(reloaded).lastReport===target(after).lastReport&&target(reloaded).order===target(after).order&&
        newEvents(reloaded,after).every(e=>!['npc.orderChanged','npc.orderRefused','command.rejected'].includes(e.type)));
    }else if(scene.kind==='status'){
      await hoverTarget();await page.keyboard.press('e');const after=await waitEvent('npc.statusInquired',before.worldMeta.eventSeq);typed(before,after,'npc.statusInquired','status-inquiry',0,0);
      check(`${scene.name}: status inquiry preserves support and original memory effect`,target(after).supportRequested&&target(after).bond===target(before).bond&&target(after).memory.helpedByPlayer===target(before).memory.helpedByPlayer&&
        JSON.stringify(target(after).memory.importantEvents)!==JSON.stringify(target(before).memory.importantEvents)&&after.energy===before.energy&&clock(after)===clock(before));
    }else if(scene.kind.startsWith('death-')){
      let paidBefore=before;
      if(scene.kind==='death-interact'){
        await hoverTarget();await page.keyboard.press('e');paidBefore=await waitEvent('npc.dialogueOpened',before.worldMeta.eventSeq);
        typed(before,paidBefore,'npc.dialogueOpened','dialogue-open',0,0);
      }
      const selector=scene.kind==='death-interact'?'[data-context-action="npc"]':'[data-context-action="npcOrder"][data-order="guard"]';
      const button=page.locator(`${selector}[data-npc-id="${npcId}"]`);
      check(`${scene.name}: genuine paid public control qualifies living original target`,target(paidBefore).hp>0&&target(paidBefore).lifeState!=='dead'&&await button.isVisible()&&await button.isEnabled());
      const clickAt=Date.now();await button.click();const after=await waitAutomaticOutcome('npc-action-interrupted',paidBefore.worldMeta.eventSeq,'npc.actionInterrupted');
      const events=newEvents(after,paidBefore),interruptions=events.filter(e=>e.type==='npc.actionInterrupted'),event=interruptions[0],p=event?.payload;
      const parent=after.worldMeta.replay.commands.find(c=>c.commandId===event?.commandId),rejection=events.find(e=>e.type==='command.rejected'&&e.commandId===parent?.commandId);
      const child=after.worldMeta.replay.commands.find(c=>c.commandId===p?.advance?.commandId),advance=events.find(e=>e.eventId===p?.advance?.eventId);
      result.receipts=(result.receipts||[]).concat({event,parent,child,advance,rejection,wallMs:Date.now()-clickAt});
      check(`${scene.name}: interruption and rejection preserve actual player parent`,interruptions.length===1&&event.actorId==='player-1'&&event.causationId===parent?.commandId&&parent.actorId==='player-1'&&
        parent.payload.npcId===npcId&&parent.type===(scene.kind==='death-interact'?'npc.interact':'npc.order')&&rejection?.actorId==='player-1'&&rejection.payload.reason==='npc-action-interrupted');
      check(`${scene.name}: gross2 and actual15 child retained`,p?.ok===false&&p.outcome==='interrupted'&&p.reason==='npc-died-or-unavailable'&&p.proofVersion===1&&p.npcId===npcId&&
        p.payment.cost.energy===2&&p.payment.before.energy-p.payment.after.energy===2&&p.clock.requestedMinutes===15&&p.clock.elapsedMinutes===15&&child?.type==='world.advance'&&child.payload.minutes===15&&
        advance?.type==='time.advanced'&&advance.commandId===child.commandId&&advance.causationId===parent.commandId&&advance.payload.minutes===15);
      check(`${scene.name}: death happened inside actual paid child`,events.some(e=>e.type==='combat.damage.applied'&&e.causationId===child.commandId&&e.actorId==='wz-4'&&e.payload.sourceId==='wz-4'&&e.payload.targetId===npcId&&e.payload.before===1&&e.payload.after===0&&e.payload.amount===6&&e.tick.world===advance.tick.world)&&
        events.some(e=>e.type==='combat.entity.defeated'&&e.causationId===child.commandId&&e.payload.targetId===npcId&&e.tick.world===advance.tick.world)&&p.target.beforeAdvance.hp>0&&p.target.afterAdvance.hp===0&&p.target.afterAdvance.lifeState==='dead');
      check(`${scene.name}: real post-simulation death state gets no completion effect`,!Object.hasOwn(p.target,'afterAction')&&p.target.id===npcId&&p.target.presentAtCompletion===true&&p.target.atCompletion.hp===0&&p.target.atCompletion.lifeState==='dead'&&
        p.target.atCompletion.sanity===p.target.afterAdvance.sanity&&p.target.atCompletion.helpedByPlayer===p.target.afterAdvance.helpedByPlayer&&p.target.atCompletion.order===p.target.afterAdvance.order&&
        !events.some(e=>['npc.interacted','npc.orderChanged','npc.orderAccepted'].includes(e.type)&&e.commandId===parent.commandId)&&target(after).hp===0&&target(after).lifeState==='dead'&&!target(after).supportRequested&&target(after).order===null);
      check(`${scene.name}: only original lawful pre-simulation own effects retained`,p.target.beforeAdvance.bond===Math.min(3,p.target.before.bond+1)&&
        (scene.kind==='death-interact'?p.target.atCompletion.helpedByPlayer===p.target.before.helpedByPlayer:p.target.atCompletion.helpedByPlayer===p.target.before.helpedByPlayer+1));
      result.interruptionToast=await page.locator('#toast').innerText();await page.screenshot({path:path.join(out,`${scene.name}-automatic-interrupted.png`)});
      const reloaded=await checkpoint('interruption-after-automatic-save-reload');
      check(`${scene.name}: automatic interrupted writer reload has no resurrected support/order/repeated payment`,target(reloaded).lifeState==='dead'&&target(reloaded).hp===0&&!target(reloaded).supportRequested&&target(reloaded).order===null&&
        target(reloaded).bond===target(after).bond&&target(reloaded).memory.helpedByPlayer===target(after).memory.helpedByPlayer&&newEvents(reloaded,after).every(e=>!['npc.actionInterrupted','npc.interacted','npc.orderChanged','npc.orderAccepted'].includes(e.type)));
    }
    const terminal=await checkpoint('terminal-real-writer');result.terminal={day:terminal.day,hour:terminal.hour,minute:terminal.minute,energy:terminal.energy,roster:terminal.npcs.length,target:target(terminal)};
    await page.screenshot({path:path.join(out,`${scene.name}-terminal.png`)});result.verified=true;await context.close();
  }
}catch(error){console.error(error.stack||String(error));report.errors.push({type:'runner',message:error.message||String(error)});for(let i=0;i<contexts.length;i++)for(const page of contexts[i].pages())try{await page.screenshot({path:path.join(out,`failure-${i}.png`),timeout:5000});}catch(e){report.errors.push({type:'failure-screenshot',message:e.message});}}
finally{await Promise.all(httpResponses);let contextsClosed=true;for(const context of contexts)await context.close().catch(e=>{contextsClosed=false;report.errors.push({type:'context-close',message:e.message});});if(browser)await browser.close().catch(e=>report.errors.push({type:'browser-close',message:e.message}));if(server.listening)await new Promise(resolve=>server.close(resolve));
  report.cleanup={contextsClosed,browserClosed:!browser||!browser.isConnected(),httpServerClosed:!server.listening};report.passed=report.checks.filter(c=>c.ok).length;report.count=report.checks.length;report.ok=report.errors.length===0&&report.passed===report.count&&report.scenes.length===specs.length&&report.scenes.every(s=>s.verified)&&Object.values(report.cleanup).every(Boolean);
  writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,ok:report.ok,passed:report.passed,count:report.count,errors:report.errors,cleanup:report.cleanup},null,2));}
if(!report.ok)process.exitCode=1;
