#!/usr/bin/env node
/** Complete actual inline runtime and actual renderPlanMeeting/registered click
 * handler. The explicitly provided IO adapter stubs renderWorld/renderHud/
 * renderContext, DOM/layout, storage, native clocks and queued timers. The
 * modified renderer, CommandBus, normalizer, loader and writer are not replaced.
 * This is portable method evidence; it does not open or test a browser.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const usage = 'node check-plan-integrity-ui.mjs --html HTML --io-adapter RECOVERY_CHECKER --legacy-fixture JSON --out REPORT_JSON';
if (process.argv.slice(2).includes('--help')) { console.log(usage); process.exit(0); }
const args = process.argv.slice(2), options = {};
assert.equal(args.length, 8, usage);
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--html','--io-adapter','--legacy-fixture','--out'].includes(args[i]) && args[i+1] && !options[args[i]], usage);
  options[args[i]] = path.resolve(args[i+1]);
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const htmlPath = options['--html'], bytes = readFileSync(htmlPath), source = bytes.toString('utf8');
const adapterBytes = readFileSync(options['--io-adapter']), adapterSource = adapterBytes.toString('utf8');
const begin = adapterSource.indexOf('function runtime(entries = []) {');
const end = adapterSource.indexOf('\nfunction envelope(payload)', begin);
assert.ok(begin >= 0 && end > begin, 'explicit IO adapter entry markers');
const inline = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(text => text.trim());
assert.equal(inline.length, 1); new vm.Script(inline[0], { filename: htmlPath });
const saveKey = 'zombie-harvest-progress-v12';
const runtime = vm.runInNewContext(`(${adapterSource.slice(begin,end).trim()})`, { inline, htmlPath, saveKey, vm, assert, console, URLSearchParams });
const legacyPath = options['--legacy-fixture'];
const legacyBytes = readFileSync(legacyPath), legacyRaw = legacyBytes.toString('utf8');
const metaPath = legacyPath.replace(/\.json$/, '.meta.json');
assert.notEqual(metaPath, legacyPath, 'fixture requires .json extension and adjacent .meta.json');
const fixtureMeta = JSON.parse(readFileSync(metaPath,'utf8')), fixture = JSON.parse(legacyRaw);
assert.equal(fixtureMeta.testOnly, true); assert.equal(fixtureMeta.naturalGameplay,false);
assert.equal(fixtureMeta.receiptFabricated,false);
assert.equal(sha(legacyBytes), fixtureMeta.fileSha256); assert.equal(fixture.checksum,fixtureMeta.checksum);
assert.equal(fixture.version,21); assert.equal(fixture.payload.contentState.contentVersion,3);
assert.equal(fixture.payload.contentState.planMeeting.status,'committed');
assert.equal(fixture.payload.contentState.planMeeting.instanceId,fixtureMeta.instanceId);

function fresh(entries=[]) {
  const r = runtime(entries);
  vm.runInContext('qa.planRender = renderPlanMeeting;', r.context);
  r.emit('continueSaveBtn','click'); assert.equal(r.api.started,true); assert.equal(r.api.session.mode,'DAY');
  return r;
}
function seed(trust,cp) {
  const r=fresh(); r.api.state.contentState.meters.campTrust=trust;
  Object.assign(r.api.state.contentState,{commandPoints:cp,commandPointsMax:cp,commandPointsGrantedDay:r.api.state.day});
  assert.equal(r.api.generatePlan({source:'TEST-ONLY UI seed'}).ok,true); return r;
}
// This small IO parser reads the actual rendered attributes; it does not compute
// trust/CP/day eligibility. Browser layout, focus and native click dispatch are
// deliberately not claimed. The registered source listener receives this DOM
// adapter's target, and must itself respect the rendered disabled property.
function buttons(html) {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].flatMap(match=>{
    const action=match[1].match(/data-plan-action="([^"]+)"/),id=match[1].match(/data-plan-id="([^"]+)"/);
    if(!action||!id)return [];
    const button={disabled:/(?:^|\s)disabled(?:\s|=|$)/.test(match[1]),dataset:{planAction:action[1],planId:id[1]},textContent:match[2]};
    button.closest=selector=>selector==='[data-plan-action]'?button:null; return [button];
  });
}
function snapshot(r) { return JSON.stringify(clone(r.api.state)); }
function render(r) {
  const before=snapshot(r),raw=r.storage.get(saveKey),seq=r.api.state.worldMeta.eventSeq,count=r.tasks.size;
  r.api.planRender(); const html=r.node('infoPlanMount').innerHTML;
  return {html,buttons:buttons(html),pure:before===snapshot(r)&&r.storage.get(saveKey)===raw&&r.api.state.worldMeta.eventSeq===seq&&r.tasks.size===count};
}
const report={runner:'source-plan-integrity-ui-phase',sourceHash:sha(bytes),adapterSourceHash:sha(adapterBytes),sourceFile:path.basename(htmlPath),
  browserStarted:false,naturalGameplayExecuted:false,rendererReplaced:false,controllerReplaced:false,
  purityBoundary:'serialized state value plus ledger/save/timer stability; object-reference identity and native browser layout are not asserted',
  ioMocks:{dom:'in-memory nodes; source innerHTML attributes parsed without layout or focus',storage:'Map-backed local/session storage',
    clocks:'controlled Date.now/performance.now',timers:'queued callbacks; asynchronous real-time callbacks not run',
    bootstrap:'unrelated final Canvas render omitted',replacedRenderingFunctions:['renderWorld','renderHud','renderContext'],
    preservedFunctions:['renderPlanMeeting','handlePlanMeetingAction','commitPlanMeeting','generatePlanMeeting','CommandBus','ensureContentState','loadProgress','saveProgress']},
  fixture:{name:path.basename(legacyPath),sha256:sha(legacyBytes),checksum:fixture.checksum,provenance:fixtureMeta},checks:[],failures:[]};
function check(name,ok,detail={}) {report.checks.push({name,ok:!!ok,detail});if(!ok)report.failures.push(name);}
function scenario(name,run){try{run();}catch(error){check(name+' executes',false,{error:String(error.stack||error)});}}
for(const trust of [59,59.99,60])for(const cp of [0,1])scenario(`trust ${trust} CP${cp}`,()=>{
  const r=seed(trust,cp),view=render(r),disabled=trust<60||cp===0;
  check(`trust ${trust} CP${cp} actual renderer preserves serialized facts`,view.pure);
  check(`trust ${trust} CP${cp} all support/modify/deny disabled properties match permission`,view.buttons.length===7
    &&new Set(view.buttons.map(b=>b.dataset.planAction)).size===3&&view.buttons.every(b=>b.disabled===disabled),
    {buttons:view.buttons.map(({dataset,disabled})=>({action:dataset.planAction,disabled}))});
  const expectedHint=cp===0?'指挥点不足':'可消耗 1 点指挥点';
  const hasHint=trust<60?view.html.includes('营地信任需达到 60')&&view.html.includes(`当前 ${trust}`)
    &&view.html.includes(`<b>${trust}</b>`)&&!view.html.includes('可消耗 1 点指挥点'):view.html.includes(expectedHint);
  check(`trust ${trust} CP${cp} actual visible permission text explains gate`,hasHint,{html:view.html});
  if(disabled){const before=snapshot(r),seq=r.api.state.worldMeta.commandSeq,tasks=r.tasks.size;
    for(const button of view.buttons)r.emit('infoPlanMount','click',{target:button});
    check(`trust ${trust} CP${cp} disabled actual registered handler emits no command or reward`,snapshot(r)===before
      &&r.api.state.worldMeta.commandSeq===seq&&r.tasks.size===tasks);
  }
});
for(const action of ['support','modify','deny'])scenario(`allowed ${action}`,()=>{
  const r=seed(60,1),view=render(r),button=view.buttons.find(b=>b.dataset.planAction===action);assert.ok(button&&!button.disabled);
  r.emit('infoPlanMount','click',{target:button}); const plan=r.api.state.contentState.planMeeting;
  const receipts=r.api.state.worldMeta.events.filter(e=>e.type==='plan.meeting.committed');
  check(`enabled ${action} actual registered listener commits once and spends exactly one CP`,plan.status==='committed'
    &&plan.playerAction===action&&r.api.state.contentState.commandPoints===0&&receipts.length===1
    &&r.api.state.worldMeta.replay.commands.filter(c=>c.commandId===receipts[0].commandId&&c.type==='plan.meeting.commit').length===1);
  const before=snapshot(r),seq=r.api.state.worldMeta.commandSeq,committedView=render(r);
  check(`committed ${action} actual renderer preserves plan/CP and removes interventions`,committedView.pure
    &&committedView.buttons.length===0&&committedView.html.includes('已在第 1 天提交'));
  r.emit('infoPlanMount','click',{target:button});
  // A stale formerly-enabled DOM node can reach the real reducer, which must
  // refuse plan-not-open. The rejection ledger is legitimate; protected plan
  // and CP must remain stable while no second committed receipt appears.
  check(`stale enabled ${action} node cannot submit or debit twice`,r.api.state.contentState.planMeeting.playerAction===action
    &&r.api.state.contentState.commandPoints===0&&r.api.state.worldMeta.commandSeq===seq+1
    &&JSON.stringify(clone(r.api.state.contentState))===JSON.stringify(JSON.parse(before).contentState)
    &&r.api.state.worldMeta.events.filter(e=>e.type==='plan.meeting.committed').length===1
    &&r.api.state.worldMeta.events.at(-1).type==='command.rejected', {beforePlan:JSON.parse(before).contentState.planMeeting,afterPlan:clone(r.api.state.contentState.planMeeting)});
});
for(const phase of ['night','expired','gameOver'])scenario(`${phase} guard`,()=>{
  const r=seed(60,1);
  if(phase==='night'){r.api.state.night=true;r.api.session.mode='BATTLE';}
  if(phase==='expired'){r.api.state.day=2;r.api.state.hour=0;r.api.state.minute=0;r.api.state.world.totalMinutes=1440;}
  if(phase==='gameOver'){r.api.state.hp=0;r.api.state.gameOver='lose';r.api.session.mode='LOSS';}
  const view=render(r),expected={night:'先关闭尸潮报告',expired:'候选不属于今天',gameOver:'本局已结束'}[phase];
  check(`${phase} actual renderer preserves serialized facts and all intervention buttons disabled`,view.pure&&view.buttons.length===7&&view.buttons.every(b=>b.disabled));
  check(`${phase} actual status message gives matching reason`,view.html.includes(expected));
  const before=snapshot(r);for(const button of view.buttons)r.emit('infoPlanMount','click',{target:button});
  check(`${phase} disabled handler cannot mutate input state`,snapshot(r)===before);
});

// Explicit TEST-ONLY phase inputs expose contradictory report night=false and
// session flags; the actual controller methods are never replaced or mocked.
for(const phase of ['REPORT','RECOVERY','LOSS','SAVING','EXITING','DAY-exiting'])scenario(`session ${phase} night=false`,()=>{
  const r=seed(60,1);r.api.state.night=false;
  r.api.session.mode=phase==='DAY-exiting'?'DAY':phase;
  r.api.session.exiting=phase==='DAY-exiting';
  check(`${phase} actual SessionController rejects daytime input`,r.api.session.isDay()===false);
  const view=render(r);
  check(`${phase} night=false rendered facts stable and all interventions disabled`,view.pure&&view.buttons.length===7&&view.buttons.every(b=>b.disabled));
  check(`${phase} actual visible note explains report/recovery and DAY boundary`,view.html.includes('报告')&&view.html.includes('存档恢复')&&view.html.includes('白天'));
  const before=snapshot(r),seq=r.api.state.worldMeta.commandSeq,tasks=r.tasks.size;
  for(const button of view.buttons)r.emit('infoPlanMount','click',{target:button});
  check(`${phase} disabled registered listener creates no command or toast task`,snapshot(r)===before&&r.api.state.worldMeta.commandSeq===seq&&r.tasks.size===tasks);
});
scenario('complete old committed writer fixture',()=>{
  const r=fresh([[saveKey,legacyRaw]]),p=fixture.payload;
  assert.equal(r.api.hash(p),fixture.checksum);assert.equal(r.api.validate({raw:legacyRaw,sourceCategory:'primary'}).ok,true);
  const view=render(r);
  check('complete old committed source-writer fixture boots with same plan and spent CP',JSON.stringify(clone(r.api.state.contentState.planMeeting))===JSON.stringify(p.contentState.planMeeting)
    &&r.api.state.contentState.commandPoints===p.contentState.commandPoints&&r.api.state.worldMeta.events.filter(e=>e.type==='save.migrated').length===0);
  check('actual legacy committed renderer preserves serialized facts with no intervention buttons',view.pure&&view.buttons.length===0
    &&view.html.includes('已在第 1 天提交')&&view.html.includes(p.contentState.planMeeting.candidates.find(c=>c.id===p.contentState.planMeeting.selectedId).title));
  const before=snapshot(r);render(r);check('repeated legacy committed rendering cannot refund CP or erase commitment',snapshot(r)===before);
});
scenario('idle view',()=>{const r=fresh(),view=render(r);check('idle actual renderer preserves serialized facts with no buttons',view.pure&&view.buttons.length===0&&view.html.includes('下一轮尸潮结算'));});
report.ok=report.failures.length===0;report.count=report.checks.length;report.passed=report.checks.filter(c=>c.ok).length;
writeFileSync(options['--out'],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({runner:report.runner,sourceHash:report.sourceHash,ok:report.ok,count:report.count,passed:report.passed,
  browserStarted:false,rendererReplaced:false,failures:report.failures},null,2));
process.exitCode=report.ok?0:1;
