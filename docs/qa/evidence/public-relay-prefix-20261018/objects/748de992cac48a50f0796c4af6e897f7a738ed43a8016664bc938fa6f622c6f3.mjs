import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const HTML='2fca005df63742164bd6f6e8e82fc0c2d3962b4678419b633482f8a54e09ef93';
export const approachArrival=.15;
export const publicApproachGoal=anchor=>({x:anchor.x-1,y:anchor.y});
export const INPUT='9f1ff9ac728ac23ce412bc4887510a648a63c4e196dca7fddb15f859c28511f8';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const globalCaps=Object.freeze({major:18,business:30,ui:80,navigation:240,keyMs:90000,restAccepted:8,attackAttempts:4,eatAttempts:2});
export const sliceLimits=Object.freeze({major:3,business:3,ui:18,navigation:15,restAccepted:1,attackAttempts:1,eatAttempts:1,worldMinutes:110,wallMs:180000,verificationWorld:16,verificationWallMs:20000,ordinaryProbeWorld:4,ordinaryProbeWallMs:6000,collisionAlternatives:3,relocations:1});
export function parseArgs(argv){
  const allowed=['--root','--input','--protocol','--out','--playwright-module','--chrome-executable','--carry','--prior-public-ui','--arm','--expect-html-sha256','--manifest','--mode'],a={};
  assert.equal(argv.length%2,0);
  for(let i=0;i<argv.length;i+=2){assert.ok(allowed.includes(argv[i]),'known CLI key');assert.ok(typeof argv[i+1]==='string'&&argv[i+1]&&!argv[i+1].startsWith('--'),'one scalar value');assert.ok(!Object.hasOwn(a,argv[i]),'no duplicate argument');a[argv[i]]=argv[i+1];}
  for(const k of allowed)assert.ok(Object.hasOwn(a,k),'required '+k);
  for(const k of allowed.filter(k=>!['--arm','--expect-html-sha256','--mode'].includes(k)))assert.ok(path.isAbsolute(a[k]),'absolute '+k);
  assert.equal(a['--arm'],'A');assert.equal(a['--expect-html-sha256'],HTML);assert.ok(['validate','run'].includes(a['--mode']));return a;
}
export function validateBoundInputs(a){
  const manifest=JSON.parse(fs.readFileSync(a['--manifest'],'utf8'));assert.equal(manifest.schema,'PublicRelayA06MethodManifestV1');
  for(const [k,v] of Object.entries(manifest.cliBindings))assert.equal(path.normalize(a[k]),path.normalize(v),'bound '+k);
  for(const row of manifest.files){const b=fs.readFileSync(row.path);assert.equal(sha(b),row.sha256,'frozen '+row.path);assert.equal(b.length,row.bytes);}
  assert.ok(!fs.existsSync(a['--out']),'fresh business output even in validation');assert.ok(fs.statSync(a['--chrome-executable']).isFile());
  const native=JSON.parse(fs.readFileSync(a['--input'],'utf8')),carry=JSON.parse(fs.readFileSync(a['--carry'],'utf8'));
  assert.equal(sha(fs.readFileSync(a['--input'])),INPUT);assert.equal(native.payload.worldMeta.eventSeq,325);assert.equal(native.payload.hour,9);assert.equal(native.payload.minute,53);assert.equal(native.checksum,'cb03cd61');
  assert.deepEqual(carry.counts,{major:7,business:7,ui:67,navigation:225,keyMs:34887,restAccepted:2,attackAttempts:2,eatAttempts:1});
  assert.equal(carry.activeWallMs,237726);assert.equal(carry.worldMinutesSpent,252);assert.equal(carry.selectedWorldMinute,593);assert.equal(carry.observedWorldMinute,594);assert.equal(carry.deadlineWorldMinute,1061);assert.equal(carry.additionalReplayedWorldMinutes,1);
  return {manifest,native,carry,validationOnly:a['--mode']==='validate'};
}
export function buildSessionOptions(a,p){
  const o={root:a['--root'],out:a['--out'],input:a['--input'],protocol:a['--protocol'],playwrightModule:a['--playwright-module'],chromeExecutable:a['--chrome-executable'],expectHtml:HTML,expectInput:INPUT,budgetCarry:p.carry,sliceLimits};
  assert.equal(typeof o.chromeExecutable,'string');assert.equal(o.chromeExecutable,a['--chrome-executable']);assert.ok(path.isAbsolute(o.chromeExecutable));return o;
}
export function localBudget(carry){return {countCaps:Object.fromEntries(Object.entries(globalCaps).map(([k,max])=>[k,Math.min(max,carry.counts[k]+(sliceLimits[k]??max-carry.counts[k]))])),world:Math.min(720-carry.worldMinutesSpent,sliceLimits.worldMinutes),wall:Math.min(900000-carry.activeWallMs,sliceLimits.wallMs),deadline:carry.selectedWorldMinute+720-carry.worldMinutesSpent};}
export function activityLoss(before,after){return !before.overlayVisible&&!after.overlayVisible&&before.activityGeneration===after.activityGeneration&&Number.isFinite(before.hp)&&Number.isFinite(after.hp)&&after.hp<before.hp?before.hp-after.hp:0;}
export function intervalBudget(startWorld,endWorld,startAt,endAt,worldCap,wallCap){return {worldMinutes:endWorld-startWorld,wallMs:endAt-startAt,within:Number.isFinite(endWorld)&&endWorld>=startWorld&&endWorld-startWorld<=worldCap&&endAt>=startAt&&endAt-startAt<=wallCap};}
export function commitReservation(worldSpent,wallSpent,minutes,actionWallBound,bounds){return worldSpent>=0&&wallSpent>=0&&worldSpent+minutes+sliceLimits.verificationWorld<=bounds.world&&wallSpent+actionWallBound+sliceLimits.verificationWallMs<=bounds.wall;}
export function validInstallation(a){return a?.installed===true&&a.gameStarted===true&&a.mode==='DAY'&&a.exiting===false&&a.savePending===false&&a.classification==='DAY'&&a.overlayHidden===true&&a.sameActualSelection===true;}
export function checksum(value){let h=2166136261;const s=JSON.stringify(value);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
export function selectedProof(selected,normalRaw=null){
  const meta={classification:selected?.classification,sourceCategory:selected?.sourceCategory,originalChecksum:selected?.originalChecksum,eventSeq:selected?.payload?.worldMeta?.eventSeq??null,worldMinute:selected?.payload?((selected.payload.day-1)*1440+selected.payload.hour*60+selected.payload.minute):null};
  if(typeof selected?.raw!=='string'||!selected.raw||!selected.payload||typeof selected.sourceCategory!=='string'||!selected.sourceCategory||typeof selected.originalChecksum!=='string')return {...meta,complete:false,scope:'watermark-only',reason:'actual selected raw/payload/checksum/source missing'};
  let raw;try{raw=JSON.parse(selected.raw);}catch{return {...meta,complete:false,scope:'watermark-only',reason:'selected raw is not JSON'};}
  const rawPayload=raw.payload||raw;
  if(JSON.stringify(rawPayload)!==JSON.stringify(selected.payload)||checksum(rawPayload)!==selected.originalChecksum||(raw.checksum&&raw.checksum!==selected.originalChecksum))return {...meta,complete:false,scope:'watermark-only',reason:'selected raw/payload/checksum disagreement'};
  let normal=null;try{normal=normalRaw?JSON.parse(normalRaw):null;}catch{}
  return {...meta,complete:true,scope:'actual-selected-raw-and-tested-facts',rawSha256:sha(selected.raw),payloadSha256:sha(JSON.stringify(selected.payload)),samePreReloadRaw:normalRaw===null?null:normalRaw===selected.raw,samePreReloadPayload:normal===null?null:JSON.stringify(normal.payload||normal)===JSON.stringify(selected.payload),reason:null};
}
export function validActualSession(actual,status,html,proofComplete){
  const v=actual?.verification,cap=actual?.limits?.effectiveCounts||{};
  const whole=v?intervalBudget(v.startWorldMinute,actual.finalEvidenceWorldMinute,v.startedAt,actual.endedAt,sliceLimits.verificationWorld,sliceLimits.verificationWallMs):null;
  return actual?.status===status&&proofComplete===true&&Array.isArray(actual.errors)&&actual.errors.length===0&&['contextClosed','browserClosed','serverClosed'].every(k=>actual.cleanup?.[k]===true)&&Array.isArray(actual.documents)&&actual.documents.length>=2&&actual.documents.every(d=>d.sha256===html&&d.status===200)&&actual.sliceWorldMinutes>=0&&actual.sliceWorldMinutes<=sliceLimits.worldMinutes&&actual.worldMinutesSpent<=720&&actual.elapsedWallMs<=sliceLimits.wallMs&&actual.cumulativeElapsedWallMs<=900000&&Object.entries(cap).every(([k,max])=>actual.counts[k]<=max)&&v?.actual?.within===true&&whole?.within===true;
}
