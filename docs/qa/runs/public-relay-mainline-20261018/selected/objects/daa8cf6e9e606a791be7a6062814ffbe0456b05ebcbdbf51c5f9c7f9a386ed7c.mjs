import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createSession } from './pilot-session.mjs';
import { createPublicNavigation } from './public-navigation-v2.mjs';
const navigationBytes=fs.readFileSync(new URL('./public-navigation-v2.mjs',import.meta.url));
assert.equal(createHash('sha256').update(navigationBytes).digest('hex'),'f8e0267d0f4667e836ecdc4235b407e24cbabe22730cae4f25bad4861e5939ea','frozen navigation module');

// Public-map policy only. The session's privileged truth/safety observations
// never supply a navigation target, route, enemy coordinate or actor position.
const args={};
for(let i=2;i<process.argv.length;i+=2){assert.ok(process.argv[i+1]);assert.ok(!Object.hasOwn(args,process.argv[i]));args[process.argv[i]]=process.argv[i+1];}
for(const k of ['--root','--input','--protocol','--out','--playwright-module','--chrome-executable'])assert.ok(path.isAbsolute(args[k]||''),k);
assert.ok(['A','B'].includes(args['--arm']));
const EXPECT='dccb52ff94a0101992f6696c3ecb93c7092b1049d85dbbe2701d5e6ad1ca004a';
const expectedInputs={A:'ebd2c2a6f1ab12b0e62dc6ba235231b4a229916759cdf1662c2594ed9ac4c7e6',B:'d0d160f8b03c6323e51611ff6013895d52713d0775bcd56dc8d84ba86b46fded'};
const sha=b=>createHash('sha256').update(b).digest('hex');
const at=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const key=p=>Math.round(p.x)+','+Math.round(p.y);
const directions=[[1,0,'ArrowRight'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[0,-1,'ArrowUp']];
let session,terminal=false,stage='unknown',rests=0,eats=0,attacks=0,collisions=0,retreat=false,longVetoes=0,checkpointWallMs=0,lastObservedFood=null,lastBudget={major:0},lastOutcome=null,extraMajor=0;
const decisions=[],known=new Map(),blockedEdges=new Set();
const navigation=createPublicNavigation({known,blockedEdges});let lastNavigationDecision=null;
const policy={schema:'PublicRelayPolicyV2',arm:args['--arm'],sourceHtmlSha256:EXPECT,inputSha256:expectedInputs[args['--arm']],naturalGameplay:false,humanExperience:false,strictFactorC:false,navigationScope:'Current and previously observed public viewport tiles are remembered; no native/truth target navigation. Generic public building/initial-position return probes are limited to3 and do not certify a shelter.',decisions};
function write(){if(session)fs.writeFileSync(path.join(args['--out'],'policy-decisions.json'),JSON.stringify(policy,null,2)+'\n');}
function learn(v){navigation.observe(v);}
function note(kind,reason,v,details={}){decisions.push({kind,reason,at:Date.now(),public:{hp:v.hp,energy:v.energy,food:v.food,day:v.day,hour:v.hour,minute:v.minute,player:v.player,context:v.contextTitle,relay:v.relay,mission:v.mission},...details});write();}
function button(v,action){return(v.buttons||[]).find(b=>b.context===action&&!b.disabled);}
function marker(regex){return [...known.values()].filter(t=>regex.test(t.tag||''));}
function nearest(v,points){return points.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)).sort((a,b)=>at(v.player,a)-at(v.player,b))[0];}
async function perform(spec){if(['business','self-defense'].includes(spec.category)&&lastBudget.major+extraMajor>=18){await finish('BUDGET_EXHAUSTED','Actual source major count plus publicly verified food commitments reached18');const error=new Error('major limit');error.policyStop=true;throw error;}const r=await session.perform(spec);lastOutcome=r;lastBudget=r?.budget||lastBudget;if(r?.stop){const status=r?.view?.hp<=0?'GAMEPLAY_LOSS':r.action?.vetoed||r?.view?.hp<=35?'INTERRUPTED_RISK':'BUDGET_EXHAUSTED';await finish(status,r.action?.safety?.reason||'Session returned its actual bounded stop');const error=new Error(status);error.policyStop=true;throw error;}return r?.view||await session.view();}
async function inspectResources(label,keepOpen=false){let v=await session.view();if(!v.modalOpen)await perform({kind:'click',selector:'#openInfoBtn',label:label+'-open-terminal',category:'ui'});await perform({kind:'click',selector:'[data-info-tab="resources"]',label:label+'-resources-tab',category:'ui'});v=await session.view();assert.ok(Number.isFinite(v.food),'Only a real visible resource value is used');lastObservedFood=v.food;note('inspect-resources','Read actual public supplies, not hidden legacy DOM or snapshot omissions',v);if(!keepOpen)await perform({kind:'key',key:'Escape',label:label+'-close-terminal',category:'ui'});return v;}
async function inspectRelay(label){
 let v=await session.view();
 if(!v.modalOpen)await perform({kind:'click',selector:'#openInfoBtn',label:label+'-open-terminal',category:'ui'});
 await perform({kind:'click',selector:'[data-info-tab="build"]',label:label+'-build-tab',category:'ui'});
 v=await session.view();
 if(!v.relay)throw Error('Visible relay panel not captured');
 const text=String(v.relay.status||'');
 stage=text.includes('已启用')?'online':text.includes('等待交付')?'core-recovered':text.includes('长官已接收')?'briefed':text.includes('筹料中')?'staging':text.includes('施工中')?'building':'unknown';
 note('inspect-relay','Read the actual public construction status before choosing a goal',v,{stage});
 await session.capture(label,true);
 await perform({kind:'key',key:'Escape',label:label+'-close-terminal',category:'ui'});
 return v;
}
function passable(p){return navigation.passable(p);}
async function navigate(v,target,label,arrival=1.05){
 assert.ok(v.player&&target);const step=navigation.plan(v,target,arrival);
 if(step.arrived||step.failed)return {...step,view:v};
 const after=await perform({kind:'key',key:step.key,holdMs:step.holdMs,label,category:'navigation'});learn(after);
 if(!navigation.recordMove(v,after,step)){
  collisions++;note('collision','No measured public displacement; retire attempted public edge and replan',after,{key:step.key,consecutive:collisions,goal:step.goal,waypoint:step.waypoint});
  if(collisions>=3)return {failed:'three bounded directions unresolved; no repeated blind movement',view:after};
 }else collisions=0;
 return {arrived:false,view:after};
}
function exploreGoal(v){
 const result=navigation.chooseExploration(v,marker(/广播|中继台/));const stamp=JSON.stringify(result.decision);
 if(stamp!==lastNavigationDecision){lastNavigationDecision=stamp;note('navigation-goal','Only observed connected terrain; inaccessible public markers retained, any unknown neighbor may be frontier',v,result.decision);}
 return result;
}
async function finish(status,reason){terminal=true;policy.status=status;policy.reason=reason;policy.endedAt=Date.now();write();return session.finish(status,reason);}
async function waitForRest(){
 for(let i=0;i<140;i++){
  const v=await session.view();
  if(v.night||v.encounter||v.hp<=35)throw Error('Phase or HP stop during public rest');
  // Poll only the real public cancellation affordance. Sampling is not a
  // second UI/business action and never queries an unexposed rest state.
  if(!await session.page.locator('#campRestCancel').isVisible()&&i>0)return;
  await session.page.waitForTimeout(150);
 }
 throw Error('Bounded rest observation expired');
}
try{
 session=await createSession({root:args['--root'],out:args['--out'],input:args['--input'],protocol:args['--protocol'],playwrightModule:args['--playwright-module'],chromeExecutable:args['--chrome-executable'],expectHtml:EXPECT,expectInput:expectedInputs[args['--arm']]});
 fs.copyFileSync(fileURLToPath(import.meta.url),path.join(args['--out'],'policy-executed.mjs'));
 fs.writeFileSync(path.join(args['--out'],'public-navigation-executed.mjs'),navigationBytes);
 policy.navigationModule={path:'public-navigation-executed.mjs',sha256:sha(navigationBytes),bytes:navigationBytes.length};
 policy.methodSha256=sha(fs.readFileSync(fileURLToPath(import.meta.url)));write();
 await perform({kind:'click',selector:'#continueSaveBtn',label:'public-continue',category:'ui'});
 await inspectRelay('initial-public-goal');
 await inspectResources('initial-public-supplies');
 let v=await session.view();learn(v);await session.capture('initial-map',true);
 let lastGoalStage=stage,blockedWaits=0,commandSearch=0,commandSearchStarted=null,commandWaypoints=null;
 while(!terminal){
  v=await session.view();learn(v);
  if(v.hp<=35){await finish('INTERRUPTED_RISK','Public HP at or below35');break;}
  if(v.night||v.encounter){await finish('PHASE_CHANGED','Actual public encounter, no manufactured N/day jump');break;}
  if(v.modalOpen){await perform({kind:'key',key:'Escape',label:'close-visible-modal-before-navigation',category:'ui'});continue;}
  const contact=button(v,'attack'),shelter=navigation.returnGoal(v);
  if(contact){
   if(retreat){if(!shelter||at(v.player,shelter)<=1.1){await finish('INTERRUPTED_RISK','Contact persists after harm and no further observed refuge path');break;}const n=await navigate(v,shelter,'immediate-post-harm-retreat');if(n.failed){await finish('NAVIGATION_UNRESOLVED',n.failed);break;}continue;}
   if(v.hp<70||v.energy<10||attacks>=4){await finish('INTERRUPTED_RISK','Visible contact exceeds declared self-defense HP/energy/attempt budget');break;}
   const defense=await session.safety(10,'self-defense');if(!defense.allowed){await finish('INTERRUPTED_RISK','Privileged defensive veto; public context title is not treated as an enemy count');break;}
   note('self-defense','Visible attack affordance plus privileged veto; actual10-minute cost, no certified safety or tower rescue',v);
   const beforeHp=v.hp;v=await perform({kind:'key',key:'f',label:'bounded-visible-self-defense',category:'self-defense'});attacks++;
   if(v.hp<beforeHp)retreat=true;
   continue;
  }
  if(lastObservedFood>0&&eats<2&&(v.energy<=35||retreat&&shelter&&at(v.player,shelter)<=2&&v.hp<85)){
   const supply=await inspectResources('verify-finite-food',true);
   if(supply.food>0){
    note('supply','One actual food used under the same bounded policy',supply);
    await perform({kind:'key',key:'r',label:'finite-food-recovery',category:'business'});const eatAction=lastOutcome.action;
    const after=await inspectResources('verify-public-food-payment',true);assert.equal(after.food,supply.food-1,'Public food decrement verifies the actual eat commitment');
    if(!eatAction.majorBasis?.some(x=>x.type==='player.eat')){extraMajor++;(policy.foodBudgetCorrections??=[]).push({commandIds:eatAction.commands?.filter(x=>x.type==='player.eat').map(x=>x.commandId),beforeFood:supply.food,afterFood:after.food,basis:'R closes the resource tab before the helper after sample; separate public reopening proves payment, not null coercion'});}
    eats++;policy.actualMajorBudget=lastBudget.major+extraMajor;
   }
   await perform({kind:'key',key:'Escape',label:'close-public-supplies-before-navigation',category:'ui'});continue;
  }
  if(v.hp<=60)retreat=true;
  if(retreat&&shelter&&at(v.player,shelter)>1.1){
   const n=await navigate(v,shelter,'retreat-on-observed-camp-route');if(n.failed){await finish('NAVIGATION_UNRESOLVED',n.failed);break;}continue;
  }
  if(retreat&&v.hp<70){await finish('INTERRUPTED_RISK','Bounded recovery does not restore the self-defense margin; no safe advance inferred');break;}
  if(retreat)retreat=false;
  if(stage==='unknown'){
   const discover=(v.buttons||[]).find(b=>b.context==='landmark'&&!b.disabled&&/广播/.test(b.text));
   if(discover){
    if(v.hp<=60){retreat=true;continue;}
    if(v.energy<8){
     if(shelter&&at(v.player,shelter)>1.1){retreat=true;continue;}
     if(button(v,'campRest30')&&rests<8){note('energy-wait','Request a finite public rest for the real existing passive recovery; no food grant',v);await perform({kind:'click',selector:'[data-context-action="campRest30"]',label:'public-energy-recovery-wait',category:'business'});rests++;await waitForRest();continue;}
     await finish('BLOCKED_SUPPLY','Insufficient action reserve and no currently available bounded public recovery; not a claim of game softlock');break;
    }
    const safe=await session.safety(20);if(!safe.allowed){
     note('long-action-veto','Conservative privileged veto provides no hidden target or direction',v);
     if(longVetoes++===0&&shelter&&at(v.player,shelter)>2){retreat=true;continue;}
     await finish('INTERRUPTED_RISK','20-minute exploration remains unsafe after the bounded public retreat opportunity');break;
    }
    note('explore','Public broadcast exploration is a3E/20-minute commitment',v);
    await perform({kind:'click',selector:'[data-context-action="landmark"]',label:'explore-visible-broadcast-tower',minutes:20,category:'business'});
    await inspectRelay('actual-core-recovered');lastGoalStage=stage;continue;
   }
   const choice=exploreGoal(v),goal=choice.goal,tower=choice.kind==='marker';
   if(!goal){await finish('NAVIGATION_UNRESOLVED','All currently reachable observed frontiers exhausted; disconnected markers remain pending');break;}
   const n=await navigate(v,goal,tower?'approach-reachable-public-broadcast-marker':'explore-reachable-public-frontier',tower?1.05:.2);
   if(n.failed){if(!tower){navigation.retireFrontier(goal,n.failed);note('frontier-retired','Current public route failed; choose another connected frontier without hidden navigation',v,{goal,reason:n.failed});continue;}await finish('NAVIGATION_UNRESOLVED',n.failed);break;}
   continue;
  }
  if(stage==='core-recovered'){
   if(button(v,'relayHandoff')){
    note('handoff','Actual dedicated public core handoff, not support dialogue',v);
    await perform({kind:'click',selector:'[data-context-action="relayHandoff"]',label:'actual-core-handoff',minutes:0,category:'business'});
    await inspectRelay('actual-handoff');lastGoalStage=stage;continue;
   }
   const command=nearest(v,[...known.values()].filter(t=>/zone-command/.test(t.classes||'')||/指挥/.test(t.tag||'')));
   if(!command){await finish('BLOCKED_PUBLIC_INFORMATION','No observed command marker and no visible commander handoff');break;}
   if(!commandSearchStarted){
    const n=await navigate(v,command,'return-to-observed-command-area');
    if(n.failed){await finish('NAVIGATION_UNRESOLVED',n.failed);break;}
    if(!n.arrived)continue;
    commandSearchStarted=Date.now();commandWaypoints=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1],[2,0],[0,2],[-2,0],[0,-2]].map(([dx,dy])=>({x:command.x+dx,y:command.y+dy})).filter(passable);
   }
   {
    // A bounded ring around the already observed command marker, not a saved
    // actor coordinate. Never guess that arrival means the commander is there.
    if(commandSearch>=commandWaypoints.length||Date.now()-commandSearchStarted>30000){await finish('BLOCKED_PUBLIC_INFORMATION','Bounded public command-area search found no handoff affordance');break;}
    const next=commandWaypoints[commandSearch];
    if(!next){await finish('NAVIGATION_UNRESOLVED','No observed open command search path');break;}
    const n=await navigate(v,next,'bounded-public-command-search',.25);
    if(n.failed){await finish('NAVIGATION_UNRESOLVED',n.failed);break;}
    if(n.arrived)commandSearch++;
   }
   continue;
  }
  if(stage==='online'){
   await session.capture('online-public-observed',true);
   const live=await session.truth(),baseline=live.worldMeta.eventSeq;
   const before=(live.worldMeta.events||[]).filter(e=>e.type==='relay.stationOnline').length;
   assert.equal(before,1,'one actual stationOnline event');
   let saved=false;const checkpointStart=Date.now(),checkpointDeadline=checkpointStart+Math.min(18000,40000-checkpointWallMs);
   while(Date.now()<checkpointDeadline){
    const raw=await session.page.evaluate(()=>localStorage.getItem('zombie-harvest-progress-v12'));
    const p=JSON.parse(raw).payload;
    if(p.relayProject.status==='online'&&p.worldMeta.eventSeq>=baseline){saved=true;break;}
    await session.page.waitForTimeout(150);
   }
   checkpointWallMs+=Date.now()-checkpointStart;policy.checkpointObservationWallMs=checkpointWallMs;
   if(!saved){await finish('ONLINE_WITHOUT_VERIFIED_RELOAD','Normal writer did not reach sampled online watermark within fixed observation');break;}
   await session.capture('normal-online-saved',false);
   await perform({kind:'reload',label:'public-online-reload',category:'ui'});
   await perform({kind:'click',selector:'#continueSaveBtn',label:'public-reloaded-continue',category:'ui'});
   await inspectRelay('reloaded-public-online');
   const installed=await session.truth(),installedSeq=installed.worldMeta.eventSeq,reloadWaitStart=Date.now(),reloadDeadline=reloadWaitStart+Math.min(18000,40000-checkpointWallMs);
   while(Date.now()<reloadDeadline){
    const after=await session.truth(),tick=after.worldMeta.events.find(e=>e.seq>installedSeq&&e.type==='time.advanced');
    if(tick){
     assert.equal(after.relayProject.status,'online');assert.equal(after.worldMeta.events.filter(e=>e.type==='relay.stationOnline').length,before);
     const raw=await session.page.evaluate(()=>localStorage.getItem('zombie-harvest-progress-v12')),p=JSON.parse(raw).payload;
     if(p.worldMeta.eventSeq>=tick.seq&&p.relayProject.status==='online'){policy.onlineReloadVerified=true;policy.postReloadTick={eventId:tick.eventId,seq:tick.seq,commandId:tick.commandId,causationId:tick.causationId};break;}
    }
    await session.page.waitForTimeout(150);
   }
   checkpointWallMs+=Date.now()-reloadWaitStart;policy.checkpointObservationWallMs=checkpointWallMs;
   await finish(policy.onlineReloadVerified?'ONLINE_AND_RELOAD_VERIFIED':'ONLINE_WITHOUT_VERIFIED_RELOAD','Actual public chain result; full natural play and human enjoyment not inferred');break;
  }
  if(!shelter){await finish('BLOCKED_PUBLIC_INFORMATION','No observed shelter marker for purposeful construction wait');break;}
  const restButton=button(v,rests===0?'campRest30':'campRest60')||button(v,'campRest30');
  if(restButton){
   if(rests>=8){await finish('BUDGET_EXHAUSTED','Eight purposeful public rest requests used');break;}
   const duration=restButton.context==='campRest60'?60:30;
   note('wait-for-project','Request the enabled public safe-rest duration; acceptance is determined by actual receipt, no extra healing',v,{requestedMinutes:duration});
   await perform({kind:'click',selector:'[data-context-action="'+restButton.context+'"]',label:'purposeful-engineering-wait',category:'business'});rests++;
   await waitForRest();const rv=await inspectRelay('project-after-wait-'+rests);blockedWaits=0;
   if(/暂停|配置错误|缺少/.test((rv.relay?.status||'')+' '+(rv.relay?.task||''))){await finish('BLOCKED_ROLE','Public current project reports actual vacancy or configuration blocker');break;}
   lastGoalStage=stage;continue;
  }
  if(at(v.player,shelter)>1.05){const n=await navigate(v,shelter,'return-to-public-shelter-for-engineering');if(n.failed){await finish('NAVIGATION_UNRESOLVED',n.failed);break;}continue;}
  if(blockedWaits++<3){await perform({kind:'wait',ms:1000,label:'bounded-observation-of-rest-unavailability',category:'ui'});continue;}
  await inspectRelay('project-with-rest-unavailable');
  if(stage!==lastGoalStage){lastGoalStage=stage;blockedWaits=0;continue;}
  if(navigation.retireReturn(shelter)){note('public-return-probe','Observed generic building/camp return point has no available rest context; retire candidate, maximum3 public probes',v,{goal:{x:shelter.x,y:shelter.y,tag:shelter.tag,source:shelter.source,observedAt:shelter.observedAt},returnProbes:navigation.state.returnProbes});blockedWaits=0;continue;}
  await finish('PURPOSEFUL_WAIT_UNAVAILABLE','Public return point reached but real rest Gate stayed unavailable; no assumed shelter/idle/hidden advance');
 }
}catch(error){if(!error.policyStop)policy.error=String(error.stack||error);write();if(session&&!terminal){try{await finish('RULE_OR_METHOD_STOP',error.message);}catch{}}process.exitCode=1;}
finally{
 if(session){const actual=await session.close(),actions=actual.actions||[],last=actions.at(-1)?.after,observed={
  'ordinary-safety-veto':actions.some(a=>a.vetoed),'key-interruption':actions.some(a=>a.keyInterrupted),'public-damage-sample':(actual.damage||[]).length>0,
  'HP-stop':Number.isFinite(last?.hp)&&last.hp<=35,'unknown-HP-stop':/public HP unavailable/.test(actual.reason||''),'wall-watchdog':/900-second.*watchdog/.test(actual.reason||''),
  'world720-reached':Number.isFinite(last?.day)&&(last.day-1)*1440+last.hour*60+last.minute-actual.startWorldMinute>=720};
  for(const[k,max]of Object.entries({major:18,business:30,ui:80,navigation:240,keyMs:90000,restAccepted:8,attackAttempts:4,eatAttempts:2}))observed[k+'-threshold-reached']=(actual.counts?.[k]||0)>=max;
  policy.helperExecutionCompanion={frozenHelperAnnotations:'Preparation only / unexecutedBudgetBranches are original authoring-time labels; actual actions, terminal, and this companion record execution. Threshold observation does not certify every guard branch.',operationKinds:[...new Set(actions.filter(a=>!a.error&&!a.vetoed).map(a=>a.kind))],observedControls:Object.keys(observed).filter(k=>observed[k]),notObservedControls:Object.keys(observed).filter(k=>!observed[k]),allBudgetBranchesBrowserValidated:false,actualHelperStatus:actual.status,actualActionCount:actions.length};
 }
 policy.terminal=terminal;write();if(policy.status!=='ONLINE_AND_RELOAD_VERIFIED')process.exitCode=1;console.log(JSON.stringify({arm:policy.arm,status:policy.status,reason:policy.reason,decisions:decisions.length,error:policy.error||null}));
}
