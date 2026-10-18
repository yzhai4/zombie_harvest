import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPublicNavigation} from './public-navigation-v2.mjs';
import {parseArgs,validateBoundInputs,buildSessionOptions,localBudget,sliceLimits,intervalBudget,commitReservation,selectedProof,validInstallation,approachArrival,publicApproachGoal,hasBuildingRestContext,hasRestUiReserve,HTML,INPUT} from './method-contract.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),config=JSON.parse(fs.readFileSync(path.join(dir,'launch-config.json'),'utf8')),args=parseArgs(config.argvValidate),plan=validateBoundInputs(args),checks=[];
function check(name,fn){try{fn();checks.push({name,ok:true});}catch(e){checks.push({name,ok:false,error:String(e.stack||e)});}}
check('actual CLI binds current HTML, last world-tick writer and scalar Chrome before session creation',()=>{
  const o=buildSessionOptions(args,plan);assert.equal(o.chromeExecutable,config.chromeExecutable);assert.equal(typeof o.chromeExecutable,'string');assert.equal(o.expectInput,INPUT);assert.equal(o.expectHtml,HTML);
  assert.equal(plan.native.checksum,'380e00d');assert.equal(plan.native.payload.worldMeta.lastCheckpointReason,'world-tick');assert.equal(plan.native.payload.worldMeta.eventSeq,356);
  for(const mutate of [a=>a.pop(),a=>a.push('--mode','run'),a=>a.push('--diagnosis','D1'),a=>a[a.indexOf('--input')+1]=path.join(dir,'original-A06/READY.json'),a=>a[a.indexOf('--chrome-executable')+1]+=',carry=[object Object]']){const copy=[...config.argvValidate];mutate(copy);assert.throws(()=>validateBoundInputs(parseArgs(copy)));}
  assert.throws(()=>buildSessionOptions({...args,'--chrome-executable':{}},plan));assert.equal(fs.existsSync(config.executionRoot),false);
});
check('charged lower bound, all cumulative counters and one replayed minute are not refunded',()=>{
  const c=plan.carry;assert.equal(c.worldMinutesIsLowerBound,true);assert.equal(c.worldMinutesSpent,273);assert.equal(c.selectedWorldMinute,613);assert.equal(c.observedWorldMinute,614);assert.equal(c.additionalReplayedWorldMinutes,1);assert.equal(c.activeWallMs,265992);
  assert.deepEqual(c.counts,{major:7,business:7,ui:76,navigation:231,keyMs:35845,restAccepted:2,attackAttempts:2,eatAttempts:1});
  assert.deepEqual(localBudget(c),{countCaps:{major:8,business:8,ui:80,navigation:240,keyMs:90000,restAccepted:3,attackAttempts:2,eatAttempts:1},world:110,wall:180000,deadline:1060});
  assert.equal(c.worldMinutesSpent+614-c.selectedWorldMinute,274);assert.equal(c.noRollbackRefund,true);assert.deepEqual(c.inputMaterials,{wood:8,parts:5,stone:2});
});
check('original whole recovery scope remains16world/20s and actual selected/installation facts remain separate',()=>{
  assert.equal(sliceLimits.verificationWorld,16);assert.equal(sliceLimits.verificationWallMs,20000);
  assert.equal(intervalBudget(573,589,100,20100,16,20000).within,true);assert.equal(intervalBudget(573,589,100,20101,16,20000).within,false);assert.equal(intervalBudget(573,590,100,20100,16,20000).within,false);
  assert.equal(commitReservation(65,0,30,90000,localBudget(plan.carry)),false);
  const raw=fs.readFileSync(args['--input'],'utf8'),s={raw,payload:plan.native.payload,classification:'DAY',sourceCategory:'primary',originalChecksum:'380e00d'};
  assert.equal(selectedProof(s,raw).complete,true);assert.equal(selectedProof({...s,raw:null},raw).complete,false);
  assert.equal(validInstallation({installed:true,gameStarted:false,mode:'RECOVERY',exiting:false,savePending:true,classification:'DAY',overlayHidden:false,sameActualSelection:true}),false);
});
check('public endpoint keeps original interaction margin and original defensive predicate bytes',()=>{
  const anchor={x:10,y:7},goal=publicApproachGoal(anchor);assert.deepEqual(goal,{x:9,y:7});assert.ok(Math.hypot(goal.x-anchor.x,goal.y-anchor.y)+approachArrival+Math.SQRT2*.05<1.25);
  const part=s=>s.slice(s.indexOf('  async function safety('),s.indexOf('  function budget('));
  assert.equal(part(fs.readFileSync(path.join(dir,'pilot-session.mjs'),'utf8')),part(fs.readFileSync(path.join(dir,'original-A06/pilot-session.mjs'),'utf8')));
  const driver=fs.readFileSync(path.join(dir,'run-public-A07.mjs'),'utf8');assert.equal(driver.includes('inspectRelay('),false);for(const name of ['conditionalF(','conditionalEat(','conditionalSupport('])assert.equal(driver.includes(name),false);
  const helper=fs.readFileSync(path.join(dir,'pilot-session.mjs'),'utf8');assert.ok(helper.includes('const postImage=await pulse()'));assert.ok(helper.includes('report.preCloseWatermark='));
});
check('actual public candidate route, type evidence and cancellation reserve compose within4UI/9nav',()=>{
  const memory=JSON.parse(fs.readFileSync(path.join(dir,'A06-candidate-public-ui.json'),'utf8')),current=JSON.parse(fs.readFileSync(path.join(dir,'A06-last-public-ui.json'),'utf8')),anchor=memory.tiles.find(t=>t.x===10&&t.y===10&&t.building&&t.tag==='建筑');assert.ok(anchor);
  const nav=createPublicNavigation();nav.observe(memory);nav.observe(current);const goal=publicApproachGoal(anchor);assert.deepEqual(goal,{x:9,y:10});assert.deepEqual(nav.route(current,goal,approachArrival),[{x:9,y:7},{x:9,y:8},{x:9,y:9},{x:9,y:10}]);assert.equal(nav.plan(current,goal,approachArrival).key,'ArrowDown');
  const bounds=localBudget(plan.carry);assert.equal(bounds.countCaps.ui-plan.carry.counts.ui,4);assert.equal(bounds.countCaps.navigation-plan.carry.counts.navigation,9);assert.equal(hasRestUiReserve({ui:77},bounds),true);assert.equal(hasRestUiReserve({ui:78},bounds),false);
  assert.equal(hasBuildingRestContext({contextTitle:'阿梁 · 木匠',contextHint:'近身交谈',buttons:[{context:'weapon'}]}),false);assert.equal(hasBuildingRestContext({contextTitle:'临时营地'}),true);assert.equal(hasBuildingRestContext({contextTitle:'建筑 · 可管理',contextHint:'互动：休息、恢复行动体力或配置武器 · 不移动位置'}),true);
  assert.equal(sliceLimits.business,1);assert.equal(sliceLimits.major,1);assert.equal(sliceLimits.attackAttempts,0);assert.equal(sliceLimits.eatAttempts,0);assert.equal(sliceLimits.navigation,9);assert.equal(sliceLimits.ui,4);
});
// Synthetic method-only host. Execute the actual driver rest and unchanged
// helper perform functions, not HTML, GameState, reducer or a copied predicate.
try{
  const helperSource=fs.readFileSync(path.join(dir,'pilot-session.mjs'),'utf8'),performSource=helperSource.slice(helperSource.indexOf('  async function perform(spec){'),helperSource.indexOf('  async function beginVerification()'));
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  async function exercise(driverSource){
    const restSource=driverSource.slice(driverSource.indexOf('async function rest(duration){'),driverSource.indexOf('function durableFacts(s)'));
    const visible={overlayVisible:false,hp:86,energy:100,food:7,activityGeneration:1,contextTitle:'临时营地',contextHint:'互动：休息、恢复行动体力或配置武器',buttons:[{context:'campRest30',disabled:false}]};
    const counters={...plan.carry.counts,ui:77},bounds=localBudget(plan.carry),calls=[],result={minutes:null,clicked:false,ledgerReached:false,safetyCalls:calls},report={counts:counters,actions:[],startedAt:Date.now()};
    const environment={report,caps:bounds.countCaps,directions:/^(Arrow(Up|Down|Left|Right)|[wasd])$/i,pulse:async()=>({...visible}),budget:()=>{},
      page:{locator:()=>({count:async()=>1,isVisible:async()=>true,isEnabled:async()=>true,evaluate:async()=>({id:'',context:'campRest30',infoTab:null,hit:true}),click:async()=>{result.clicked=true;throw Error('UNEXPECTED_CLICK');}})},
      safety:async minutes=>{calls.push(minutes);return {allowed:false,reason:'SYNTHETIC_ORIGINAL_SAFETY_VETO'};},
      readonlyWorldSnapshot:async()=>{result.ledgerReached=true;throw Error('UNGUARDED_LEDGER_REACHED');},write:()=>{},view:async()=>visible,finish:async()=>report};
    const helperPerform=new Function('assert','environment',`let busy=false,started=false;const {report,caps,directions,pulse,budget,page,safety,readonlyWorldSnapshot,write,view,finish}=environment;${performSource};return perform;`)(assert,environment);
    const env={enabled:(v,c)=>v.buttons.find(b=>b.context===c&&!b.disabled),reserved:async()=>({ok:true,v:visible}),canAttempt:()=>true,risk:async()=>null,counts:counters,bounds,
      session:{truth:async()=>({worldMeta:{eventSeq:356,events:[]}})},perform:async spec=>{result.minutes=spec.minutes??null;const action=await helperPerform(spec);if(action.stop)throw Error('ORIGINAL_SAFETY_VETO');return action.view;},view:async()=>visible,note:()=>{},policy:{}};
    try{await new AsyncFunction('assert','hasRestUiReserve','hasBuildingRestContext','env',`let triedRest=0,completedRests=0;const {enabled,reserved,canAttempt,risk,counts,bounds,session,perform,view,note,policy}=env;${restSource};return rest(30);`)(assert,hasRestUiReserve,hasBuildingRestContext,env);result.terminal='returned';}catch(e){result.terminal=e.message;}
    return result;
  }
  const current=await exercise(fs.readFileSync(path.join(dir,'run-public-A07.mjs'),'utf8'));
  assert.equal(current.minutes,30);assert.deepEqual(current.safetyCalls,[30]);assert.equal(current.terminal,'ORIGINAL_SAFETY_VETO');assert.equal(current.clicked,false);assert.equal(current.ledgerReached,false);
  const blocked=await exercise(fs.readFileSync(path.join(dir,'preflight-failed-fed6/run-public-A07.mjs'),'utf8'));
  assert.equal(blocked.minutes,null);assert.deepEqual(blocked.safetyCalls,[]);assert.equal(blocked.terminal,'UNGUARDED_LEDGER_REACHED');assert.equal(blocked.ledgerReached,true);assert.equal(blocked.clicked,false);
  checks.push({name:'actual rest click passes30 to unchanged helper safety before side-effect path; archived missing-minutes version reproduces gap',ok:true,scope:'Synthetic method host only; no game or Gate validity claim',current,archivedPreflightFailure:blocked});
}catch(e){checks.push({name:'actual rest click consumes original helper safety before side-effect path',ok:false,error:String(e.stack||e)});}
const report={schema:'PublicA07NecessaryMethodControlsV1',scope:'Pure preparation only; synthetic accounting/parameter checks, not gameplay or product tests',count:checks.length,passed:checks.filter(c=>c.ok).length,checks,ok:checks.every(c=>c.ok),gameBrowserServerStarted:false};
console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;
