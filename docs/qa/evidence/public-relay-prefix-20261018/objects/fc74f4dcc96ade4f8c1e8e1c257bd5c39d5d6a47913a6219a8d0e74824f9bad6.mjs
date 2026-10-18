import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {localBudget,activityLoss,intervalBudget} from './method-contract.mjs';
const sha = b => createHash('sha256').update(b).digest('hex');
const minute = x => x && [x.day,x.hour,x.minute].every(Number.isFinite) ? (x.day-1)*1440+x.hour*60+x.minute : null;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const directions = /^(Arrow(Up|Down|Left|Right)|[wasd])$/i;
export function sessionSurface(functions,page){
  for(const key of ['view','truth','safety','perform','capture','finish','guard','beginVerification'])assert.equal(typeof functions[key],'function','actual method interface '+key);
  return {...functions,page,close:()=>functions.finish('STOPPED_OPERATOR','session close')};
}
// Preparation only: no branch below has been browser-executed at authoring time.
export async function createSession({root,out,input,protocol,playwrightModule,chromeExecutable,expectHtml,expectInput,budgetCarry,sliceLimits}) {
  const carry=budgetCarry||{counts:{major:0,business:0,ui:0,navigation:0,keyMs:0,restAccepted:0,attackAttempts:0,eatAttempts:0},activeWallMs:0,worldMinutesSpent:0};
  const globalCaps={major:18,business:30,ui:80,navigation:240,keyMs:90000,restAccepted:8,attackAttempts:4,eatAttempts:2};
  const {countCaps:caps,world:localWorldCap,wall:localWallCap}=localBudget(carry);
  assert.equal(carry.selectedWorldMinute,593);assert.equal(carry.deadlineWorldMinute,1061);assert.equal(carry.worldMinutesSpent,252);
  for(const[k,max]of Object.entries(globalCaps))assert.ok(Number.isFinite(carry.counts?.[k])&&carry.counts[k]>=0&&carry.counts[k]<max,'carried '+k+' must leave original budget');
  assert.ok(Number.isFinite(carry.activeWallMs)&&carry.activeWallMs>=0&&carry.activeWallMs<900000);
  assert.ok(Number.isFinite(carry.worldMinutesSpent)&&carry.worldMinutesSpent>=0&&carry.worldMinutesSpent<720);
  for (const p of [root,out,input,protocol,playwrightModule,chromeExecutable]) assert.ok(path.isAbsolute(p),'absolute file/directory paths required');
  assert.match(expectHtml,/^[a-f0-9]{64}$/); assert.match(expectInput,/^[a-f0-9]{64}$/); assert.ok(!fs.existsSync(out),'fresh output required');
  const source=fs.readFileSync(path.join(root,'dist/index.html')), raw=fs.readFileSync(input), sprites=fs.readFileSync(path.join(root,'dist/actor-sprites.js'));
  assert.equal(sha(source),expectHtml); assert.equal(sha(raw),expectInput); assert.ok(JSON.parse(raw.toString('utf8')).payload?.worldMeta,'complete native writer required');
  fs.mkdirSync(out); const method=fs.readFileSync(fileURLToPath(import.meta.url)), protocolBytes=fs.readFileSync(protocol);
  for (const [name,bytes] of [['source.html',source],['input-native.json',raw],['actor-sprites.js',sprites],['method-executed.mjs',method],['protocol-executed.md',protocolBytes]]) fs.writeFileSync(path.join(out,name),bytes);
  const report={schema:'ControlledPublicRelayA06SessionV1',status:'PREPARING',sourceHtmlSha256:expectHtml,inputSha256:expectInput,methodSha256:sha(method),protocolSha256:sha(protocolBytes),setupStartedAt:Date.now(),documents:[],actions:[],captures:[],errors:[],privilegedSamples:[],privilegedSafety:[],damage:[],
    scope:{prebootNativeFixture:true,naturalGameplay:false,humanExperience:false,goals:'current public viewport only',truth:'read-only accounting/conservative veto; never target navigation',afterBootStateOrStorageWrites:false},
    limits:{global:{wallMs:900000,worldMinutes:720,...globalCaps},effectiveCounts:caps,slice:structuredClone(sliceLimits),localWorldCap,localWallCap,worldOrigin:carry.selectedWorldMinute},
    worldAccounting:{chargedPriorWorldFloor:carry.worldMinutesSpent,priorExactCleanupTailUnknown:true,worldMinutesSpentIsLowerBound:true,postCloseTailNotSampled:true},counts:{...carry.counts},countsAtStart:{...carry.counts},budgetCarry:structuredClone(carry),
    unexecutedBudgetBranches:['Coverage of each budget terminal requires actual evidence; no inference from preparation or a successful route'],keyTimeBasis:'conservative wall duration of navigation key operations, including release RPC; not a frame-precise keyboard trace',policyOwned:['same-activity HP/damage stop','public known-perimeter candidates','conditional enabled F/finite visible food','at most two real rest requests; no automatic NPC/tower rescue']};
  const write=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  let browser,context,page,timer,finishPromise,heldKey,lastPulse,busy=false,seq=0,started=false,activityGeneration=0,wasOverlay=true; const documents=[],counted=new Set();
  function observe(v){
    if(v.overlayVisible){wasOverlay=true;lastPulse=null;v.activityGeneration=activityGeneration;return v;}
    if(wasOverlay){activityGeneration++;wasOverlay=false;lastPulse=null;}
    v.activityGeneration=activityGeneration;
    if(Number.isFinite(v.hp)){
      const loss=lastPulse?activityLoss(lastPulse,v):0;
      if(loss)report.damage.push({at:v.at,before:lastPulse.hp,after:v.hp,loss,worldMinute:minute(v),activityGeneration,basis:'same actual active lifecycle public samples; not exhaustive frame trace'});
      lastPulse=v;
    }
    if(minute(v)!==null)report.latestObservedWorldMinute=Math.max(report.latestObservedWorldMinute??carry.selectedWorldMinute,minute(v));
    return v;
  }
  const server=createServer((q,r)=>{const u=new URL(q.url,'http://localhost').pathname, data=u==='/'||u==='/index.html'?source:u==='/actor-sprites.js'?sprites:null; r.writeHead(data?200:404,{'Content-Type':u.endsWith('.js')?'text/javascript;charset=utf-8':'text/html;charset=utf-8'});r.end(data||'');});
  const pulse=async()=>observe(await page.evaluate(()=>{
    const visible=e=>{if(!e)return false;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth&&c.display!=='none'&&c.visibility!=='hidden'&&Number(c.opacity)!==0;};
    const text=id=>{const e=document.getElementById(id);return visible(e)?e.innerText:null;},num=id=>{const s=text(id),n=s===null||!s.trim()?null:Number(s);return Number.isFinite(n)?n:null;};
    const pos=text('mapRegionLabel')?.match(/([\d.]+)\/\d+列\s*·\s*([\d.]+)\/\d+行/),tm=text('timeLabel')?.match(/(\d\d):(\d\d)/);
    return {at:Date.now(),overlayVisible:visible(document.getElementById('startOverlay')),hp:num('basicHpValue')??num('hpValue'),energy:num('basicEnergyValue')??num('energyValue'),food:num('foodValue')??Number((text('eatBtnAction')||text('eatBtn')||'').match(/食物\s*(\d+)/)?.[1]??NaN),day:Number(text('dayLabel')?.match(/\d+/)?.[0])||null,hour:tm?Number(tm[1]):null,minute:tm?Number(tm[2]):null,player:pos?{x:Number(pos[1])-1,y:Number(pos[2])-1}:null};
  }));
  async function view() { return observe(await page.evaluate(()=>{
    const visible=e=>{if(!e)return false;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth&&c.display!=='none'&&c.visibility!=='hidden'&&Number(c.opacity)!==0;};
    const text=id=>{const e=document.getElementById(id);return visible(e)?e.innerText:null;},num=id=>{const s=text(id),n=s===null||!s.trim()?null:Number(s);return Number.isFinite(n)?n:null;};
    const pos=text('mapRegionLabel')?.match(/([\d.]+)\/\d+列\s*·\s*([\d.]+)\/\d+行/),tm=text('timeLabel')?.match(/(\d\d):(\d\d)/);
    const hit=e=>{const r=e.getBoundingClientRect(),x=Math.max(0,r.left)+Math.min(r.right,innerWidth),y=Math.max(0,r.top)+Math.min(r.bottom,innerHeight),h=document.elementFromPoint(x/2,y/2);return !!h&&(h===e||e.contains(h));};
    const relayIds={status:'relayStatusText',task:'relayTaskText',crew:'relayCrewText',forecast:'relayForecastText',materials:'relayMaterials',steps:'relaySteps'};
    return {at:Date.now(),hp:num('basicHpValue')??num('hpValue'),energy:num('basicEnergyValue')??num('energyValue'),food:num('foodValue')??Number((text('eatBtnAction')||text('eatBtn')||'').match(/食物\s*(\d+)/)?.[1]??NaN),day:Number(text('dayLabel')?.match(/\d+/)?.[0])||null,hour:tm?Number(tm[1]):null,minute:tm?Number(tm[2]):null,player:pos?{x:Number(pos[1])-1,y:Number(pos[2])-1}:null,
      overlayVisible:visible(document.getElementById('startOverlay')),modalOpen:visible(document.getElementById('infoModal'))||visible(document.getElementById('inventoryOverlay')),buildMode:visible(document.getElementById('buildDrawer'))&&document.getElementById('buildDrawer').classList.contains('open'),night:visible(document.getElementById('nightLiveHud')),encounter:document.body.classList.contains('threat-map-active')||document.getElementById('nightOverlay')?.classList.contains('show'),
      contextTitle:text('contextTitle'),contextHint:text('contextHint'),mission:text('missionText'),toast:text('toast'),feedback:{rest:text('campRestFeedback'),restStatus:text('campRestStatus'),attack:text('playerAttackFeedback'),maintenance:text('relayMaintenanceFeedback')},relay:Object.values(relayIds).some(id=>text(id)!==null)?Object.fromEntries(Object.entries(relayIds).map(([k,id])=>[k,text(id)])):null,
      buttons:[...document.querySelectorAll('button')].filter(e=>visible(e)&&hit(e)).map(e=>({id:e.id,text:e.innerText,disabled:e.disabled,context:e.dataset.contextAction||null,buildingId:e.dataset.buildingId||null,repairType:e.dataset.repairType||null,npcId:e.dataset.npcId||null,order:e.dataset.order||null,enemyId:e.dataset.enemyId||null,relayInstanceId:e.dataset.relayInstanceId||null,relayDefId:e.dataset.relayDefId||null,relayDefinitionVersion:e.dataset.relayDefinitionVersion||null,relayEventId:e.dataset.relayEventId||null})),
      tiles:[...document.querySelectorAll('#world .tile:not(.fogged)')].filter(e=>visible(e)&&hit(e)).map(e=>({x:Number(e.dataset.x),y:Number(e.dataset.y),tag:e.querySelector('.tag')?.textContent||'',water:e.classList.contains('water'),building:e.classList.contains('building-footprint'),classes:[...e.classList],clickable:hit(e),visible:true}))};
  })); }
  // The only privileged live reader; no WorldFacts.current/engine mutation is used.
  async function readonlyWorldSnapshot(mode='full') {const s=await page.evaluate(mode=>{
    if(!document.getElementById('startOverlay')?.classList.contains('hidden'))return null;
    const s=WorldSnapshot.capture(); if(mode==='full')return s;
    const base={day:s.day,hour:s.hour,minute:s.minute,hp:s.player.hp??null,player:s.player,food:s.food,energy:s.energy,eventSeq:s.worldMeta.eventSeq,commandSeq:s.worldMeta.commandSeq,clock:s.worldMeta.clock};
    // HP/food reside in HUD/native, not necessarily the WorldSnapshot projection.
    if(mode==='safety')return {...base,worldZombies:s.worldZombies};
    return {...base,commands:s.worldMeta.replay.commands,events:s.worldMeta.events};
  },mode);report.privilegedSamples.push({at:Date.now(),purpose:mode,worldMinute:minute(s),policy:'accounting/veto only; no target navigation'});return s;}
  async function truth(){const s=await readonlyWorldSnapshot();write();return s;}
  async function safety(minutes=0,mode='ordinary'){
    assert.ok(Number.isFinite(minutes)&&minutes>=0);assert.ok(['ordinary','self-defense'].includes(mode));const effectiveMinutes=mode==='self-defense'?10:minutes,began=Date.now(),v=await pulse(),s=await readonlyWorldSnapshot('safety');
    let reason='allowed: known enemy reach envelopes do not overlap; conservative veto only, not a safety guarantee';const enemies=[];
    if(!s||v.overlayVisible||!v.player||![s.player?.x,s.player?.y,v.hp].every(Number.isFinite))reason='stop: active public HUD/live sample unavailable';
    else if(v.hp<=35)reason='stop: public HP stop line';
    else if(s.worldMeta?.clock?.paused||s.clock?.paused||s.clock?.rate!==1)reason='stop: unsupported clock';
    else {
      for(const z of s.worldZombies||[]){if(z.hp<=0)continue;const speed=({normal:.065,runner:.12,brute:.04})[z.kind],factor=z.speedFactor??1,lag=Math.max(0,minute(v)-minute(s))+(Date.now()-began)/1000/60;
        const known=Number.isFinite(speed)&&Number.isFinite(factor)&&factor>0&&factor<=1.12&&[z.x,z.y].every(Number.isFinite),distance=Math.hypot(z.x-s.player.x,z.y-s.player.y),envelope=1.25+(speed||.12)*factor*(effectiveMinutes+lag+2)+.6;
        enemies.push({id:z.id,kind:z.kind,known,distance,envelope,adjacent:distance<=1.15});}
      if(mode==='self-defense')reason=enemies.filter(e=>e.adjacent).length===1&&enemies.every(e=>e.known&&(e.adjacent||e.distance>e.envelope))
        ?'allowed: privileged single-adjacent veto criterion; all other known enemies outside ten-minute reach envelope; no kill or safety guarantee'
        :'stop: privileged single-adjacent/other-enemy reach criterion not established';
      else if(enemies.some(e=>!e.known||e.distance<=e.envelope))reason='stop: conservative reach envelope or unknown threat data';
    }
    const allowed=reason.startsWith('allowed:');report.privilegedSafety.push({at:Date.now(),mode,minutes,effectiveMinutes,publicHp:v.hp,samplingMs:Date.now()-began,aliveCount:enemies.length,adjacentCount:enemies.filter(e=>e.adjacent).length,criterion:mode==='self-defense'?'exactly one live enemy at distance<=1.15; every other enemy outside conservative ten-minute reach; all threat data known':'all known enemies outside ordinary reach',enemies,allowed,reason});write();return {allowed,reason};
  }
  function budget(v,extra=0){
    if(finishPromise)throw Error('session terminal');if(!started)return;
    assert.ok(Date.now()-report.startedAt<localWallCap,'A06/global wall budget');assert.ok(minute(v)!==null&&minute(v)-carry.selectedWorldMinute+extra<=localWorldCap,'A06/global world-minute budget');
    if(!v.overlayVisible){assert.ok(Number.isFinite(v.hp),'public HP unavailable');assert.ok(v.hp>35,'HP stop line');}
    if(report.verification){const q=report.verification;assert.ok(Date.now()-q.startedAt<=sliceLimits.verificationWallMs,'whole recovery wall budget');if(!v.overlayVisible)assert.ok(minute(v)-q.startWorldMinute<=sliceLimits.verificationWorld,'whole recovery world budget');}
  }
  const shortEvent=e=>({eventId:e.eventId,seq:e.seq,type:e.type,commandId:e.commandId,causationId:e.causationId,tick:e.tick,minutes:e.payload?.minutes,requestedMinutes:e.payload?.requestedMinutes,amount:e.payload?.amount,targetId:e.payload?.targetId,reason:e.payload?.reason,operation:e.payload?.operation});
  function account(before,after,a){
    if(!after)return;const old=new Set(before?.commands?.map(c=>c.commandId)||[]),commands=after.commands.filter(c=>!old.has(c.commandId)),events=after.events.filter(e=>e.seq>(before?.eventSeq??after.eventSeq));
    a.commands=commands.map(c=>({commandId:c.commandId,type:c.type}));a.events=events.map(shortEvent);a.ledgerWindowGap=!!before&&after.eventSeq-before.eventSeq>after.events.length;
    const parent=new Map();for(const e of events)if(e.commandId&&e.causationId&&e.commandId!==e.causationId)parent.set(e.commandId,e.causationId);
    const roots=commands.filter(c=>!/^world\.|^movement\.|^camp\.rest\.(step|stop)$/.test(c.type)&&!parent.has(c.commandId));a.majorBasis=[];
    for(const c of roots){const own=events.filter(e=>e.commandId===c.commandId),rejected=own.some(e=>e.type==='command.rejected');
      const related=id=>{for(let n=0;id&&n<12;n++,id=parent.get(id))if(id===c.commandId)return true;return false;};
      const paid=events.some(e=>e.type==='time.advanced'&&(e.payload?.minutes||e.payload?.requestedMinutes||0)>0&&related(e.causationId));
      const free=own.some(e=>['npc.dialogueOpened','npc.statusInquired'].includes(e.type))||c.type==='building.interact'&&['wall','spikeWall','relayStation'].includes(c.payload?.buildingType)||c.type==='camp.area.interact'&&!paid;
      const conditional=['threat.attack','player.eat','resource.collect','landmark.discover'].includes(c.type),receipt=own.some(e=>Object.values(e.payload?.delta||{}).some(n=>typeof n==='number'&&n!==0));
      const actual=paid||!rejected&&!free&&(!conditional||paid||receipt||c.type==='player.eat'&&Number.isFinite(a.after.food)&&Number.isFinite(a.before.food)&&a.after.food<a.before.food);
      if(actual&&!counted.has(c.commandId)){counted.add(c.commandId);report.counts.major++;a.majorBasis.push({commandId:c.commandId,type:c.type,paidInterrupted:rejected&&paid});}
      if(!rejected&&c.type==='camp.rest.begin')report.counts.restAccepted++;
    }
    if(roots.length&&!a.businessAttemptCounted){report.counts.business++;a.businessAttemptCounted=true;}
    a.actualWorldMinuteDelta=before?minute(after)-minute(before):0;
  }
  async function capture(label='key',image=true){
    const began=Date.now(),prefix=String(seq++).padStart(3,'0')+'-'+String(label).replace(/[^a-z0-9_-]/gi,'_').slice(0,70),files=[];
    const save=(suffix,value,kind)=>{const b=typeof value==='string'?Buffer.from(value):Buffer.from(JSON.stringify(value,null,2)+'\n'),file=prefix+suffix;fs.writeFileSync(path.join(out,file),b);files.push({file,sha256:sha(b),bytes:b.length,kind});};
    const rawWriter=await page.evaluate(()=>localStorage.getItem('zombie-harvest-progress-v12'));if(rawWriter)save('-native.json',rawWriter,'actual durable writer');
    const live=await readonlyWorldSnapshot(),publicView=await view();save('-live.json',live,'privileged read-only live; not navigation');save('-ui.json',publicView,'current public viewport');
    if(image){const file=prefix+'.png';await page.screenshot({path:path.join(out,file),timeout:2500});const b=fs.readFileSync(path.join(out,file));files.push({file,sha256:sha(b),bytes:b.length,kind:'actual viewport screenshot'});}
    const postImage=await pulse();
    const row={label,postImageWatermark:{at:postImage.at,worldMinute:minute(postImage)},startedAt:began,endedAt:Date.now(),publicWorldMinute:minute(publicView),liveWorldMinute:minute(live),durableWorldMinute:rawWriter?minute(JSON.parse(rawWriter).payload):null,files};report.captures.push(row);write();return {view:publicView,files};
  }
  async function finish(status='STOPPED_OPERATOR',reason='operator finished'){
    if(finishPromise)return finishPromise;
    finishPromise=(async()=>{clearTimeout(timer);report.status=status;report.reason=reason;
      try{if(heldKey&&page)await page.keyboard.up(heldKey).catch(()=>{});if(page&&!page.isClosed())await Promise.race([capture('final',true),sleep(3500).then(()=>{throw Error('final capture deadline');})]);}
      catch(e){report.errors.push({type:'final-evidence',message:e.message});}
      finally{try{if(page&&!page.isClosed()){const v=await pulse();report.preCloseWatermark={at:v.at,worldMinute:minute(v)};}}catch(e){report.errors.push({type:'pre-close-watermark',message:e.message});}const cleanup={};for(const [name,fn] of [['context',()=>context?.close()],['browser',()=>browser?.close()],['server',()=>new Promise(resolve=>{server.close(()=>resolve());server.closeAllConnections?.();})]])try{await fn();cleanup[name+'Closed']=true;}catch(e){cleanup[name+'Closed']=false;report.errors.push({type:'cleanup-'+name,message:e.message});}
        await Promise.allSettled(documents);report.cleanup=cleanup;report.endedAt=Date.now();report.finalEvidenceWorldMinute=Math.max(report.latestObservedWorldMinute??carry.selectedWorldMinute,report.captures.at(-1)?.liveWorldMinute??carry.selectedWorldMinute);report.worldMinutesSpent=Number.isFinite(report.finalEvidenceWorldMinute)?carry.worldMinutesSpent+report.finalEvidenceWorldMinute-carry.selectedWorldMinute:null;report.sliceWorldMinutes=Number.isFinite(report.finalEvidenceWorldMinute)?report.finalEvidenceWorldMinute-carry.selectedWorldMinute:null;report.finalEvidenceMayBeLaterThanLastAction=true;report.elapsedWallMs=started?report.endedAt-report.startedAt:null;report.cumulativeElapsedWallMs=started?carry.activeWallMs+report.elapsedWallMs:null;report.countsDelta=Object.fromEntries(Object.entries(report.counts).map(([k,v])=>[k,v-carry.counts[k]]));if(report.verification)report.verification.actual=intervalBudget(report.verification.startWorldMinute,report.finalEvidenceWorldMinute,report.verification.startedAt,report.endedAt,sliceLimits.verificationWorld,sliceLimits.verificationWallMs);write();}return report;
    })();return finishPromise;
  }
  async function perform(spec){
    assert.ok(!busy,'one public action at a time');assert.ok(['click','key','wait','reload','select'].includes(spec.kind));assert.ok(['navigation','business','ui','self-defense'].includes(spec.category));assert.ok(typeof spec.label==='string'&&spec.label);
    assert.ok(spec.holdMs===undefined||Number.isFinite(spec.holdMs)&&spec.holdMs>=0&&spec.holdMs<=500);assert.ok(spec.ms===undefined||Number.isFinite(spec.ms)&&spec.ms>=0&&spec.ms<=1000);assert.ok(spec.minutes===undefined||Number.isFinite(spec.minutes)&&spec.minutes>=0);
    busy=true;const a={...spec,startedAt:Date.now()},c=report.counts;let before;
    try{a.before=await pulse();budget(a.before,spec.minutes||0);const nav=spec.kind==='key'&&directions.test(spec.key),key=String(spec.key||'').toLowerCase();
      if(spec.kind==='key'){assert.ok(/^(Arrow(Up|Down|Left|Right)|[a-z1-9]|Escape|Enter|Space| )$/i.test(spec.key));assert.ok(!spec.holdMs||nav,'only direction keys may be held');}
      let element=null;if(['click','select'].includes(spec.kind)){const loc=page.locator(spec.selector);assert.equal(await loc.count(),1);assert.ok(await loc.isVisible()&&await loc.isEnabled());element=await loc.evaluate(e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:e.id,context:e.dataset.contextAction||null,infoTab:e.dataset.infoTab||null,hit:!!h&&(h===e||e.contains(h))};});assert.ok(element.hit,'public target must already be in viewport and unobscured');}
      if(spec.kind==='key'&&/^[1-9]$/.test(key))element=await page.evaluate(i=>{const e=document.querySelector('#contextPanel.show [data-context-index="'+i+'"]');if(!e||!e.getBoundingClientRect().width)return null;return {id:e.id,context:e.dataset.contextAction||null};},Number(key)-1);
      const attack=spec.kind==='key'&&['f',' ','space'].includes(key)||['attackBtn','nightAttackBtn','nightLiveAttackBtn'].includes(element?.id)||element?.context==='attack';
      const eat=spec.kind==='key'&&key==='r'||['eatBtn','eatBtnAction','inventoryEat'].includes(element?.id),rest=/^campRest(30|60)$/.test(element?.context||'');
      if(attack){assert.ok(c.attackAttempts<caps.attackAttempts,'A06/global attack attempts');c.attackAttempts++;}if(eat){assert.ok(c.eatAttempts<caps.eatAttempts,'A06/global eat attempts');c.eatAttempts++;}if(rest)assert.ok(c.restAccepted<caps.restAccepted,'A06/global accepted rests');
      if(nav||spec.category==='navigation'){assert.ok(c.navigation<caps.navigation,'A06/global navigation segments');c.navigation++;assert.ok(c.keyMs+(spec.holdMs||0)<=caps.keyMs,'navigation key milliseconds');}
      if(['business','self-defense'].includes(spec.category)){assert.ok(c.business<caps.business,'A06/global business attempts');c.business++;a.businessAttemptCounted=true;}if(spec.category==='ui'){assert.ok(c.ui<caps.ui,'A06/global UI attempts');c.ui++;}
      const pureUi=spec.kind==='key'&&/^(escape|[bvjlkh])$/.test(key)||element?.infoTab||/^(openInfoBtn|infoModalClose|contextClose|relayPanelClose|campRestCancel|continueSaveBtn|inventoryContinue|survivorToggle|eventToggle|collectionToggle|relayToggle)$/.test(element?.id||'');
      const mayCommit=!nav&&!pureUi&&!['wait','reload'].includes(spec.kind);
      assert.ok(c.major<caps.major||!mayCommit,'A06/global major commitments');assert.ok(c.business<caps.business||a.businessAttemptCounted||!mayCommit,'A06/global business attempts');
      if(spec.category==='business'&&spec.minutes>0&&!attack&&!nav){const decision=await safety(spec.minutes);a.safety=decision;if(!decision.allowed){a.vetoed=true;a.after=await pulse();report.actions.push(a);write();return {view:await view(),action:a,budget:{...c},stop:true};}}
      before=await readonlyWorldSnapshot('ledger');a.immediateBefore=await pulse();budget(a.immediateBefore,Math.max(spec.minutes||0,attack?10:0,rest?Number(element.context.slice(8)):0));
      if(spec.kind==='click')await page.locator(spec.selector).click({timeout:2000});
      else if(spec.kind==='select')await page.locator(spec.selector).selectOption(spec.value,{timeout:2000});
      else if(spec.kind==='reload'){const response=await page.reload({waitUntil:'domcontentloaded',timeout:8000});assert.equal(sha(await response.body()),expectHtml);}
      else if(spec.kind==='wait')await sleep(spec.ms||0);
      else if(nav&&spec.holdMs){heldKey=spec.key;await page.keyboard.down(heldKey);const begin=Date.now(),release=setTimeout(()=>page.keyboard.up(spec.key).catch(()=>{}),spec.holdMs);try{while(Date.now()-begin<spec.holdMs){await sleep(Math.max(0,Math.min(75,spec.holdMs-(Date.now()-begin))));const p=await pulse();if(!p.overlayVisible&&(!Number.isFinite(p.hp)||p.hp<=35)||Number.isFinite(p.hp)&&p.hp<a.immediateBefore.hp){a.keyInterrupted=true;break;}}}finally{clearTimeout(release);await page.keyboard.up(heldKey);heldKey=null;c.keyMs+=Date.now()-begin;}}
      else {const begin=Date.now();await page.keyboard.press(spec.key==='Space'?' ':spec.key);if(nav)c.keyMs+=Date.now()-begin;}
      if(a.before.overlayVisible&&(element?.id==='continueSaveBtn'||key==='enter'))await page.waitForFunction(()=>document.getElementById('startOverlay').classList.contains('hidden'),null,{timeout:8000});
      a.after=await pulse(); // F/attack has no screenshot, delayed wait, or full-map transfer before this sample.
      if(!started&&!a.after.overlayVisible){started=true;report.startedAt=a.startedAt;report.startWorldMinute=carry.selectedWorldMinute;report.initialPublicWorldMinute=minute(a.after);report.status='RUNNING';timer=setTimeout(()=>{finish('BUDGET_EXHAUSTED','A06/global active wall watchdog').catch(()=>{});},Math.max(0,localWallCap-(Date.now()-report.startedAt)));}
      const after=await readonlyWorldSnapshot('ledger');a.clock={before:before?.clock,after:after?.clock};if(before)account(before,after,a);
      const actualLoss=activityLoss(a.before,a.after);if(actualLoss)a.hpLoss=actualLoss;
      a.endedAt=Date.now();report.actions.push(a);write();let stop=false;
      if(started&&!a.after.overlayVisible&&!Number.isFinite(a.after.hp)){stop=true;await finish('METHOD_OR_BUDGET_STOP','public HP unavailable; not treated as zero/death');}
      else if(started&&!a.after.overlayVisible&&Number.isFinite(a.after.hp)&&a.after.hp<=35){stop=true;await finish(a.after.hp<=0?'GAMEPLAY_LOSS':'INTERRUPTED_RISK','immediate public HP stop line');}
      else if(started&&(Date.now()-report.startedAt>=localWallCap||minute(a.after)-carry.selectedWorldMinute>=localWorldCap||Object.entries(caps).some(([k,max])=>c[k]>max))){stop=true;await finish('BUDGET_EXHAUSTED','actual budget boundary');}
      return {view:stop?a.after:await view(),action:a,budget:{...c},stop};
    }catch(e){a.error=e.message;a.endedAt=Date.now();report.actions.push(a);write();await finish('METHOD_OR_BUDGET_STOP',e.message);throw e;}finally{busy=false;}
  }
  async function beginVerification(){const v=await pulse();budget(v);assert.ok(started&&!v.overlayVisible,'recovery starts during real activity');assert.ok(!report.verification,'one recovery segment');report.verification={startedAt:Date.now(),startWorldMinute:minute(v),worldCap:sliceLimits.verificationWorld,wallCapMs:sliceLimits.verificationWallMs,scope:'entire normal-writer/reload/selected/Continue/new-tick/final-evidence/cleanup segment'};write();return {...report.verification};}
  async function guard(){const v=await pulse();try{budget(v);}catch(e){await finish('BUDGET_EXHAUSTED',e.message);e.policyStop=true;throw e;}return v;}
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const origin='http://127.0.0.1:'+server.address().port;
    const {chromium}=createRequire(import.meta.url)(playwrightModule);browser=await chromium.launch({headless:true,executablePath:chromeExecutable});report.browserVersion=browser.version();context=await browser.newContext({viewport:{width:1440,height:1000}});assert.equal((await context.storageState()).origins.length,0);
    await context.addInitScript(({origin,raw,marker})=>{if(window.top===window&&location.origin===origin&&!sessionStorage.getItem(marker)){localStorage.setItem('zombie-harvest-progress-v12',raw);sessionStorage.setItem(marker,'1');}},{origin,raw:raw.toString('utf8'),marker:'qa-relay-mainline-seeded-'+expectInput.slice(0,16)});
    page=await context.newPage();page.setDefaultTimeout(2500);page.on('pageerror',e=>{report.errors.push({type:'pageerror',message:e.message});write();});
    page.on('response',response=>{if(response.request().resourceType()==='document'&&response.frame()===page.mainFrame())documents.push((async()=>{const b=await response.body();report.documents.push({at:Date.now(),sha256:sha(b),status:response.status()});if(sha(b)!==expectHtml||!response.ok())throw Error('actual main document hash/status mismatch');})().catch(e=>{report.errors.push({type:'main-document',message:e.message});finish('SOURCE_MISMATCH',e.message).catch(()=>{});}));});
    const response=await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:10000});assert.equal(sha(await response.body()),expectHtml);assert.ok((await pulse()).overlayVisible,'prepare overlay without starting gameplay');report.status='OVERLAY_PREPARED';write();
    return sessionSurface({view,truth,safety,perform,capture,finish,guard,beginVerification},page);
  }catch(e){report.errors.push({type:'setup',message:e.message});await finish('SETUP_FAILED',e.message);throw e;}
}
