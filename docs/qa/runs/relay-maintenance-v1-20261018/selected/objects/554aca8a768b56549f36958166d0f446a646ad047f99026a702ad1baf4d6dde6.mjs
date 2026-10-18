#!/usr/bin/env node
// Complete source runtime and original controlled IO. TEST-ONLY boot geometry;
// no natural navigation, browser pixels, balance or complete mainline claim.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const usage = 'node check-relay-maintenance-v1.mjs --repo-root ABS --html ABS --out NEW_REPORT --expect-html-sha256 SHA [--mode baseline|candidate]';
const args = process.argv.slice(2), options = {};
if (args.includes('--help')) { console.log(usage); process.exit(0); }
assert.equal(args.length % 2, 0, usage);
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--repo-root','--html','--out','--expect-html-sha256','--mode'].includes(args[i]) && !options[args[i]] && args[i+1], usage);
  options[args[i]] = args[i+1];
}
for (const key of ['--repo-root','--html','--out','--expect-html-sha256']) assert.ok(options[key], usage);
for (const key of ['--repo-root','--html','--out']) assert.ok(path.isAbsolute(options[key]), usage);
const repoRoot = path.resolve(options['--repo-root']), htmlPath = path.resolve(options['--html']), out = path.resolve(options['--out']);
const mode = options['--mode'] || 'candidate'; assert.ok(['baseline','candidate'].includes(mode), usage);
assert.ok(!existsSync(out), 'new report path required');
const clone = value => JSON.parse(JSON.stringify(value));
const sha = value => createHash('sha256').update(value).digest('hex');
const htmlBytes = readFileSync(htmlPath), source = htmlBytes.toString('utf8');
assert.equal(sha(htmlBytes), options['--expect-html-sha256'], 'explicit exact HTML binding');
const ioPath = path.join(repoRoot, 'scripts/check-report-recovery.mjs'), ioBytes = readFileSync(ioPath), io = ioBytes.toString('utf8');
const originalPath = path.join(repoRoot, 'docs/qa/runs/relay-effective-role-v1-20261018/selected/objects/4bb6aac0eb6b4f440aa60d7b58e13de5c33b8dd70ca4f073f4757d245735a6a8.json');
const originalBytes = readFileSync(originalPath), originalRaw = originalBytes.toString('utf8');
assert.equal(sha(originalBytes), '4bb6aac0eb6b4f440aa60d7b58e13de5c33b8dd70ca4f073f4757d245735a6a8');
const original = JSON.parse(originalRaw).payload;
const inline = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(text => text.trim());
assert.equal(inline.length, 1); new vm.Script(inline[0]);
const begin = io.indexOf('function runtime(entries = []) {'), end = io.indexOf('\nfunction envelope(payload)', begin);
assert.ok(begin >= 0 && end > begin); const factorySource = io.slice(begin, end);
const saveKey = 'zombie-harvest-progress-v12';
const runtime = vm.runInNewContext(`(${factorySource.trim()})`, { inline, htmlPath, saveKey, vm, assert, console, URLSearchParams });
const artifactRoot = path.join(path.dirname(out), path.basename(out, '.json') + '-artifacts');
mkdirSync(artifactRoot, { recursive: true });
const artifacts = [], checks = [], runtimes = [];
function artifact(relative, value, kind = 'observation') {
  const target = path.join(artifactRoot, relative); mkdirSync(path.dirname(target), { recursive: true });
  const data = Buffer.isBuffer(value) ? value : typeof value === 'string' ? Buffer.from(value) : Buffer.from(JSON.stringify(value, null, 2) + '\n');
  writeFileSync(target, data); const ref = { path: path.posix.join(path.basename(artifactRoot), relative.replaceAll('\\','/')), sha256: sha(data), bytes: data.length, kind };
  artifacts.push(ref); return ref;
}
artifact('inputs/source.html', htmlBytes, 'executed-source');
artifact('inputs/io-adapter.mjs', ioBytes, 'actual-io');
artifact('inputs/checker-executed.mjs', readFileSync(fileURLToPath(import.meta.url)), 'executed-method');
artifact('inputs/original-online-native.json', originalBytes, 'original-complete-writer');
const inputRefs = { originalWriter: { repositoryPath: path.relative(repoRoot, originalPath).replaceAll('\\','/'), sha256: sha(originalBytes), bytes: originalBytes.length }, ioAdapter: { repositoryPath:'scripts/check-report-recovery.mjs', sha256:sha(ioBytes), runtimeFactorySha256:sha(factorySource) } };
const aliases = `
  Object.assign(qa, { runDayCombat, dayEnemyTarget, perceptionProfile, PERCEPTION_PROFILES,
    advance, relayOnline, relayStationBuilding, repairBuilding, repairBuildingReducer,
    relayPanel: renderRelayPanel, updateRelayForecast, updateRelayProject,
    playerSanity: updatePlayerSanity, frontierExposure: updateFrontierExposure, recordExposure: recordFrontierExposure,
    pressure: frontierPressureAt, worldMinute, planWorldAdvance,
    contextDistance, startThreatEncounter, frontierRegionKeyAt, frontierTier,
    capability: typeof relayStationCapability === 'function' ? relayStationCapability : null,
    stationRepairGate: typeof relayStationRepairGate === 'function' ? relayStationRepairGate : null,
    renderFullOriginal: render });
  // Only the unavailable Canvas aggregate is shielded; all maintenance,
  // combat, projection, ledger, world and persistence functions remain actual.
  render = () => {};
`;
function boot(raw = originalRaw, label = 'boot') {
  const r = runtime([[saveKey, raw]]); vm.runInContext(aliases, r.context); runtimes.push(r);
  const valid = r.api.validate({ raw, sourceCategory:'primary' }); assert.equal(valid.ok, true, `${label}: source validator ${valid.reason}`);
  const started = r.api.start(); assert.equal(started.ok, true, `${label}: source Continue ${started.reason}`);
  assert.equal(r.api.session.mode, 'DAY'); r.tasks.clear(); return r;
}
const hasherRuntime = runtime(); const envelope = payload => JSON.stringify({ ...payload, payload, checksum: hasherRuntime.api.hash(payload), savedAt:(payload.day-1)*1440+payload.hour*60+payload.minute });
function derive(label, mutate, from = original) {
  const payload = clone(from); mutate(payload); const raw = envelope(payload);
  artifact(`inputs/${label}-native.json`, raw, 'TEST-ONLY-complete-boot-input');
  return raw;
}
function events(r, type, since = -1) { return r.api.state.worldMeta.events.filter(e => e.seq > since && (!type || e.type === type)); }
function station(r) { return r.api.state.buildings.find(b => b.id === r.api.state.relayProject.buildingId); }
function snapshot(r) { const s = r.api.state; return clone({ calendar:{day:s.day,hour:s.hour,minute:s.minute,world:s.world.totalMinutes}, station:station(r), online:r.api.relayOnline(), project:s.relayProject, forecast:s.hordeForecast, standing:s.campStanding, quests:s.quests, inventory:Object.fromEntries(['wood','stone','parts','food','energy','hp','sanity'].map(k=>[k,s[k]])), radioProfile:r.api.perceptionProfile(s.npcs.find(n=>n.id==='radio')), roster:s.npcs.map(n=>({id:n.id,hp:n.hp,lifeState:n.lifeState})), enemies:s.worldZombies.map(z=>({id:z.id,kind:z.kind,hp:z.hp})), eventSeq:s.worldMeta.eventSeq, commandSeq:s.worldMeta.commandSeq }); }
function native(r, label) { assert.equal(r.api.save(), true, `${label}: actual normal writer`); const raw = r.storage.get(saveKey); assert.equal(r.api.validate({raw,sourceCategory:'primary'}).ok, true, `${label}: actual stored validator`); artifact(`native/${label}.json`, raw, 'actual-source-writer'); return raw; }
function check(name, fn) { const count = artifacts.length; try { const facts = fn(); checks.push({name,ok:true,...(facts?{facts}:{}),artifactRefs:artifacts.slice(count).map(a=>a.path)}); } catch(error) { const failure = artifact(`failures/group-${checks.length+1}.json`,{name:error.name,message:error.message,stack:error.stack},'original-method-failure'); checks.push({name,ok:false,error:{name:error.name,message:error.message},failure,artifactRefs:artifacts.slice(count).map(a=>a.path)}); } }
let actualDestroyedRaw = null;

check('real old online writer: enemy 8→2→0, Continue and next advance never reactivate current capability', () => {
  assert.equal(original.relayProject.status,'online'); assert.equal(original.npcs.length,10); assert.equal(original.worldZombies.length,5);
  const originalStation = original.buildings.find(b=>b.id===original.relayProject.buildingId); assert.equal(originalStation.hp,8);
  const raw = derive('real-damage-geometry', p => { const enemy = p.worldZombies.find(z=>z.id==='wz-1'); assert.equal(enemy.kind,'normal'); Object.assign(enemy,{x:originalStation.x,y:originalStation.y+1,prevX:originalStation.x,prevY:originalStation.y+2,goal:{x:originalStation.x,y:originalStation.y}}); });
  artifact('inputs/real-damage-geometry-provenance.json',{testOnly:true,naturalGameplay:false,ancestorSha256:sha(originalBytes),changedFields:['worldZombies[wz-1].x','y','prevX','prevY','goal'],preserved:['all HP/kind/damage/cadence/AI','all ten NPCs and five enemy IDs','inventory/calendar/project/standing/quest/history']});
  const r = boot(raw), before = snapshot(r), seq = r.api.state.worldMeta.eventSeq;
  assert.equal(r.api.dayEnemyTarget(r.api.state.worldZombies.find(z=>z.id==='wz-1'))?.id, originalStation.id);
  r.api.runDayCombat(24); const atDamage = snapshot(r), hits = clone(events(r,'combat.damage.applied',seq).filter(e=>e.payload.targetId===originalStation.id));
  assert.deepEqual(hits.map(e=>[e.payload.sourceId,e.payload.amount,e.payload.before,e.payload.after]),[['wz-1',6,8,2],['wz-1',6,2,0]]);
  assert.equal(r.api.state.world.totalMinutes,before.calendar.world,'consumer-only damage is not calendar advance');
  const damagedRaw = native(r,'01-real-destroyed'); actualDestroyedRaw = damagedRaw;
  const loaded = boot(damagedRaw,'destroyed Continue'), immediate = snapshot(loaded), priorSeq = loaded.api.state.worldMeta.eventSeq;
  const advancement = loaded.api.advance(1,{commandId:'qa-maintenance-next-minute'}); assert.equal(advancement.ok,true); loaded.tasks.clear();
  const after = snapshot(loaded); native(loaded,'02-destroyed-Continue-next-minute');
  artifact('observations/01-real-damage-and-next-minute.json',{before,atDamage,hits,immediateContinue:immediate,afterAdvance:after,advancement:clone(advancement),newEvents:clone(events(loaded,null,priorSeq))});
  assert.equal(after.station.hp,0); assert.equal(after.station.active,false,'actual update must not reactivate zero HP station');
  assert.equal(after.station.relayEnabled,false); assert.equal(after.online,false,'current relay abilities must stop at explicit zero HP');
  assert.equal(after.project.status,'online','completion history remains'); assert.deepEqual(after.standing,before.standing);
  assert.equal(events(loaded,'relay.stationOnline',priorSeq).length,0);
  assert.equal(before.radioProfile.sight-atDamage.radioProfile.sight,2,'actual profile loses authored sight bonus');
  assert.equal(after.forecast.routeId,'eastern-breach'); assert.equal(after.forecast.leadMinutes,0);
  return {realDamageEvents:hits.map(e=>e.eventId),worldAdvance:1,stationHp:after.station.hp,currentCapability:after.online,history:after.project.status};
});

if (mode === 'candidate') {
  function requireMaintenance(r) { assert.equal(typeof r.api.capability,'function','actual source current-capability query'); assert.equal(typeof r.api.stationRepairGate,'function','actual source station repair Gate'); }
  function inspectCapability(r) { requireMaintenance(r); const c=r.api.capability(); return clone({status:c.status,operational:c.operational,hp:c.hp,maxHp:c.maxHp,reason:c.reason??null,stationId:c.station?.id??null}); }
  function business(r) { const s=r.api.state; return clone({day:s.day,hour:s.hour,minute:s.minute,world:s.world,clock:s.worldMeta.clock,player:s.player,hp:s.hp,energy:s.energy,wood:s.wood,stone:s.stone,parts:s.parts,food:s.food,sanity:s.sanity,buildings:s.buildings,npcs:s.npcs,project:s.relayProject,standing:s.campStanding,quests:s.quests,gameOver:s.gameOver}); }
  function repairInput(label, mutate=()=>{}, base=actualDestroyedRaw ? JSON.parse(actualDestroyedRaw).payload : original) {
    return derive(label,p=>{
      const b=p.buildings.find(b=>b.id===p.relayProject.buildingId); p.player.x=b.x-1;p.player.y=b.y;p.player.prevX=p.player.x;p.player.prevY=p.player.y;
      // Re-isolate the same real enemy by restoring only its original geometry.
      // Post-damage HP/attack clocks/history and all other entities remain.
      const z=p.worldZombies.find(z=>z.id==='wz-1'), old=original.worldZombies.find(z=>z.id==='wz-1');
      for(const k of ['x','y','prevX','prevY','goal']) z[k]=clone(old[k]);
      mutate(p,b);
    },base);
  }
  function paid(r,id='qa-maintenance-paid') { const b=station(r); return r.api.repairBuilding(b.id,{commandId:id,relayStation:true}); }
  function proofJoin(r,out) {
    assert.equal(out.ok,true); const p=out.result; assert.equal(p.proofVersion,1);assert.equal(p.buildingId,station(r).id);assert.equal(p.buildingType,'relayStation');assert.deepEqual(clone(out.event.payload),clone(p));assert.equal(out.event.actorId,'player-1');
    const parent=r.api.state.worldMeta.replay.commands.find(c=>c.commandId===out.commandId);assert.equal(parent.type,'building.repair');assert.equal(parent.actorId,'player-1');
    const child=r.api.state.worldMeta.replay.commands.find(c=>c.commandId===p.advance.commandId), e=events(r).find(e=>e.eventId===p.advance.eventId);assert.equal(child.type,'world.advance');assert.equal(e.type,'time.advanced');assert.equal(e.commandId,child.commandId);assert.equal(e.causationId,out.commandId);assert.equal(p.advance.causationId,out.commandId);assert.equal(e.payload.minutes,p.advance.minutes);return p;
  }

  check('legacy unknown station and pure current projection preserve the actual old writer without repair or migration',()=>{
    const cases=[['missing-hp',(p,b)=>delete b.hp,'unknown'],['missing-flags',(p,b)=>{delete b.active;delete b.relayEnabled;},'unknown'],['explicit-inactive',(p,b)=>{b.active=false;b.relayEnabled=false;},'inactive'],['missing-station',p=>p.buildings=p.buildings.filter(b=>b.id!==p.relayProject.buildingId),'unknown']];
    const outcomes=[];
    for(const [id,mutate,status] of cases){
      const raw=derive('legacy-'+id,p=>mutate(p,p.buildings.find(b=>b.id===p.relayProject.buildingId))),r=boot(raw,id);requireMaintenance(r);
      const before=clone(r.api.state),stored=r.storage.get(saveKey),timerCount=r.tasks.size,migrations=events(r,'save.migrated').length;
      const c=inspectCapability(r);assert.equal(c.status,status);assert.equal(c.operational,false);assert.equal(r.api.relayOnline(),false);
      for(let i=0;i<3;i++){r.api.capability();r.api.relayPanel();}
      assert.deepEqual(clone(r.api.state),before,'pure query/actual panel cannot ensure or normalize');assert.equal(r.storage.get(saveKey),stored);assert.equal(r.tasks.size,timerCount);
      const saved=native(r,'legacy-'+id),next=boot(saved,id+' reload');assert.equal(inspectCapability(next).operational,false);assert.equal(events(next,'save.migrated').length,migrations);
      if(id==='missing-hp')assert.equal(Object.hasOwn(station(next),'hp'),false);if(id==='missing-station')assert.equal(station(next),undefined);
      outcomes.push({id,capability:c,migrations});
    }
    artifact('observations/02-legacy-unknown-pure.json',outcomes);return{legacyCases:outcomes.length,noBackfill:true};
  });

  check('bound station repair pays gross2wood14E, applies+1 then actual whole/carry child, duplicate and Continue preserve history',()=>{
    assert.ok(actualDestroyedRaw,'real damage writer ancestry');const raw=repairInput('safe-repair-carry',p=>{p.worldMeta.clock.rate=.8;p.worldMeta.clock.subMinuteRemainder='0.5';});const r=boot(raw),before=snapshot(r),startSeq=r.api.state.worldMeta.eventSeq;
    requireMaintenance(r);assert.equal(inspectCapability(r).status,'destroyed');const out=paid(r,'qa-station-repair-once'),p=proofJoin(r,out);
    assert.deepEqual(clone(p.payment),{cost:{wood:2,energy:14},before:{wood:before.inventory.wood,energy:before.inventory.energy},after:{wood:before.inventory.wood-2,energy:before.inventory.energy-14}});
    assert.equal(p.target.hpBefore,0);assert.equal(p.target.hpAfter,1);assert.equal(p.target.maxHp,8);assert.equal(p.clock.requestedMinutes,20);assert.equal(p.clock.elapsedMinutes,16);assert.equal(p.advance.minutes,16);assert.equal(r.api.state.worldMeta.clock.subMinuteRemainder,'0.5');
    assert.equal(p.outcome.physicalRepairApplied,true);assert.equal(p.outcome.playerSurvived,true);assert.equal(inspectCapability(r).operational,true);
    assert.equal(events(r,'relay.stationOnline',startSeq).length,0);assert.deepEqual(clone(r.api.state.campStanding),before.standing,'station has no copied wall standing reward');
    const after=clone(r.api.state),duplicate=paid(r,'qa-station-repair-once');assert.equal(duplicate.duplicate,true);assert.deepEqual(clone(r.api.state),after);
    let saved=native(r,'03-paid-station');const loaded=boot(saved,'paid station reload'),loadedBefore=clone(loaded.api.state);assert.equal(paid(loaded,'qa-station-repair-once').duplicate,true);assert.deepEqual(clone(loaded.api.state),loadedBefore);native(loaded,'04-paid-station-reload');
    assert.equal(loaded.api.state.relayProject.status,'online');assert.equal(events(loaded,'relay.stationOnline').length,events(r,'relay.stationOnline').length);
    artifact('observations/03-paid-proof.json',{before,proof:clone(p),after:snapshot(r),loaded:snapshot(loaded)});return{grossCost:p.payment.cost,requested:20,actualWhole:16,remainder:'0.5',duplicate:true,history:'online'};
  });

  check('station execution distance1 differs from view1.25; stale/identity/resources/session/number budget reject before cost or time',()=>{
    const cases=[
      ['view-band-1.018',(p,b)=>p.player.x=b.x-1.018,(r,b)=>b.id,{}],
      ['view-edge-1.25',(p,b)=>p.player.x=b.x-1.25,(r,b)=>b.id,{}],
      ['detached',()=>{},(r,b)=>clone(b),{}],['unknown-id',()=>{},()=> 'qa-absent-station',{}],
      ['wood-short',p=>p.wood=1,(r,b)=>b.id,{}],['energy-short',p=>p.energy=13,(r,b)=>b.id,{}],
      ['paused',p=>p.worldMeta.clock.paused=true,(r,b)=>b.id,{}],
      ['max-safe-parent',()=>{},(r,b)=>b.id,{commandId:'cmd-9007199254740991'}]
    ];const observations=[];
    for(const [id,mutate,pick,extra] of cases){const r=boot(repairInput('reject-'+id,mutate));const b=station(r),before=business(r),seq=r.api.state.worldMeta.eventSeq;requireMaintenance(r);const out=r.api.repairBuilding(pick(r,b),{relayStation:true,commandId:'qa-repair-reject-'+id,...extra});assert.equal(out.ok,false,id);assert.deepEqual(business(r),before,id+' no business side effects');assert.equal(events(r,'building.repaired',seq).length,0);assert.equal(events(r,'time.advanced',seq).length,0);observations.push({id,distance:r.api.contextDistance(b),reason:out.reason});}
    // A live object rendered earlier must not redirect after removal, even if
    // another damaged wall exists. This is explicitly a QA stale-object race.
    const stale=boot(repairInput('stale-submission')),b=station(stale);stale.api.state.buildings=stale.api.state.buildings.filter(x=>x!==b);const before=business(stale),seq=stale.api.state.worldMeta.eventSeq;const out=stale.api.repairBuilding(b,{relayStation:true,commandId:'qa-stale-live'});assert.equal(out.ok,false);assert.deepEqual(business(stale),before);assert.equal(events(stale,'building.repaired',seq).length,0);
    artifact('observations/04-rejections.json',observations);return{preconditionCases:cases.length+1,executionRange:1,viewRange:1.25,noPaidFalseSuccess:true};
  });

  check('real20-minute repair consequences can destroy the+1 prefix again or kill the player, with durable final proof',()=>{
    const redestroyRaw=derive('repair-redestroy',p=>{const b=p.buildings.find(x=>x.id===p.relayProject.buildingId);p.player.x=b.x-1;p.player.y=b.y;p.player.prevX=p.player.x;p.player.prevY=p.player.y;},JSON.parse(actualDestroyedRaw).payload);
    const r=boot(redestroyRaw),seq=r.api.state.worldMeta.eventSeq;const out=paid(r,'qa-repair-redestroy'),p=proofJoin(r,out);assert.equal(p.target.hpBefore,0);assert.equal(p.target.hpAfter,1);
    const hits=events(r,'combat.damage.applied',seq).filter(e=>e.payload.targetId===station(r).id);assert.ok(hits.some(e=>e.payload.before===1&&e.payload.after===0),'actual original enemy destroys repaired1HP');assert.equal(inspectCapability(r).status,'destroyed');assert.equal(p.outcome.operationalAtCompletion,false);native(r,'05-repair-real-redestroy');
    const fatalRaw=repairInput('repair-player-fatal',(s,b)=>{s.hp=4;const z=s.worldZombies.find(z=>z.id==='wz-1');Object.assign(z,{x:s.player.x,y:s.player.y+.6,prevX:s.player.x,prevY:s.player.y+1.6,goal:{x:s.player.x,y:s.player.y}});});
    const fatal=boot(fatalRaw),start=fatal.api.state.worldMeta.eventSeq,beforeWood=fatal.api.state.wood,beforeEnergy=fatal.api.state.energy;const fatalOut=paid(fatal,'qa-repair-real-player-fatal'),fp=proofJoin(fatal,fatalOut);
    assert.equal(fatal.api.state.hp,0,'real child combat causes player fatal');assert.equal(fatal.api.state.gameOver,'lose');assert.equal(fatal.api.session.mode,'LOSS');assert.equal(fp.outcome.playerSurvived,false);assert.equal(fp.payment.after.wood,beforeWood-2);assert.equal(fp.payment.after.energy,beforeEnergy-14);assert.equal(fp.target.hpAfter,1);
    const fatalFact=events(fatal,'player.dayFatal',start)[0];assert.ok(fatalFact);assert.ok(fatalOut.event.seq<fatalFact.seq,'parent physical repair fact precedes fatal completion');const raw=fatal.storage.get(saveKey);assert.equal(fatal.api.validate({raw,sourceCategory:'primary'}).ok,true);artifact('native/06-repair-player-fatal.json',raw,'actual-source-fatal-writer');const next=runtime([[saveKey,raw]]);vm.runInContext(aliases,next.context);runtimes.push(next);assert.equal(next.api.start().ok,true);assert.equal(next.api.session.mode,'LOSS');assert.equal(next.api.state.hp,0);
    artifact('observations/05-paid-consequence-prefixes.json',{redestroy:{proof:clone(p),hits:clone(hits)},fatal:{proof:clone(fp),damage:clone(events(fatal,'combat.damage.applied',start)),finalFact:clone(fatalFact)}});return{redestroyed:true,playerFatal:true,physicalPrefixRetained:true,noRefund:true};
  });

  check('all current perception/frontier consumers lose station benefits while history stays online and new encounter locks current facts',()=>{
    const make=(id,off)=>boot(derive('consumer-'+id,p=>{const b=p.buildings.find(x=>x.id===p.relayProject.buildingId);if(off){b.hp=0;b.active=false;b.relayEnabled=false;}p.player.x=26;p.player.y=4;p.world.frontierExposure=30;p.world.frontierClock=0;p.sanity=75;p.sanityClock=0;}));
    const on=make('operational',false),off=make('destroyed',true);assert.ok(on.api.frontierTier(on.api.frontierRegionKeyAt())>0,'explicit TEST-ONLY frontier scene');
    const pureBefore=clone(off.api.state),stored=off.storage.get(saveKey);off.api.capability();off.api.relayPanel();assert.deepEqual(clone(off.api.state),pureBefore);assert.equal(off.storage.get(saveKey),stored);
    const pressureOn=on.api.pressure(),pressureOff=off.api.pressure();assert.equal(pressureOff-pressureOn,12);
    const profileOn=on.api.perceptionProfile(on.api.state.npcs.find(n=>n.id==='radio')),profileOff=off.api.perceptionProfile(off.api.state.npcs.find(n=>n.id==='radio'));assert.equal(profileOn.sight-profileOff.sight,2);
    assert.equal(on.api.recordExposure(4,'QA'),2);assert.equal(off.api.recordExposure(4,'QA'),4);
    // Reset only the test observation clock, not a production outcome. These
    // are direct consumer comparisons, explicitly not calendar advancement.
    on.api.state.world.frontierExposure=30;off.api.state.world.frontierExposure=30;on.api.frontierExposure(10);off.api.frontierExposure(10);assert.equal(off.api.state.world.frontierClock,2*on.api.state.world.frontierClock);
    on.api.playerSanity(30);off.api.playerSanity(30);assert.equal(on.api.state.sanity-off.api.state.sanity,1);
    const a=boot(originalRaw,'online encounter'),b=boot(actualDestroyedRaw,'destroyed encounter');const outA=a.api.threatStart({commandId:'qa-current-online-encounter'}),outB=b.api.threatStart({commandId:'qa-current-destroyed-encounter'});assert.equal(outA.ok,true);assert.equal(outB.ok,true);a.tasks.clear();b.tasks.clear();
    const lockedA=clone(a.api.state.nightBattle),lockedB=clone(b.api.state.nightBattle);assert.equal(lockedA.routeId,'relay-guided-west');assert.equal(lockedB.routeId,'eastern-breach');assert.equal(lockedB.count-lockedA.count,1);assert.equal(lockedA.enemies[0].progress,0);assert.equal(lockedB.enemies[0].progress,3);assert.equal(lockedA.defense-lockedB.defense,8);
    // The already locked encounter remains the same even if current HP changes.
    const live=station(a);live.hp=0;live.active=false;live.relayEnabled=false;a.api.capability();a.api.relayPanel();assert.deepEqual(clone(a.api.state.nightBattle),lockedA);assert.equal(a.api.state.relayProject.status,'online');
    artifact('observations/06-current-consumers-and-locked-encounter.json',{pressureOn,pressureOff,profileOn,profileOff,frontierOn:snapshot(on),frontierOff:snapshot(off),lockedOperational:lockedA,lockedDestroyed:lockedB});return{profileSightBonus:2,pressureRelief:12,actionExposureRatio:.5,sanDifference:1,nextEnemyReduction:1,currentStationDefense:8,lockedHistoryUnchanged:true};
  });

  check('generic content damage synchronizes only after successful transaction; rollback cannot leak capability or forecast changes',()=>{
    const r=boot(),before=clone(r.api.state),seq=r.api.state.worldMeta.eventSeq;
    const rejected=r.api.contentEffects([{op:'damageBuilding',buildingId:station(r).id,value:8},{op:'addResource',resource:'wood',value:-999999}],{actorId:'player-1'});
    assert.equal(rejected.ok,false);assert.deepEqual(clone(r.api.state),before,'actual content rollback restores complete business/ledger');assert.equal(inspectCapability(r).operational,true);
    const accepted=r.api.contentEffects([{op:'damageBuilding',buildingId:station(r).id,value:8}],{actorId:'player-1'});assert.equal(accepted.ok,true);assert.equal(station(r).hp,0);assert.equal(station(r).active,false);assert.equal(station(r).relayEnabled,false);assert.equal(inspectCapability(r).status,'destroyed');assert.equal(r.api.state.hordeForecast.routeId,'eastern-breach');
    assert.equal(events(r,'relay.stationOnline',seq).length,0);assert.equal(r.api.state.relayProject.status,'online');const raw=native(r,'07-content-real-damage');const next=boot(raw);assert.equal(inspectCapability(next).status,'destroyed');
    artifact('observations/07-content-transaction.json',{rejected:clone(rejected),accepted:clone(accepted),after:snapshot(r),events:clone(events(r,null,seq))});return{rollbackPreserved:true,successfulDamageDeactivates:true,history:'online'};
  });
}

for (const r of runtimes) r.tasks.clear();
const report = {runner:'source-relay-maintenance-v1',mode,sourceHtmlSha256:sha(htmlBytes),checkerSha256:sha(readFileSync(fileURLToPath(import.meta.url))),inputs:inputRefs,ok:checks.every(c=>c.ok),count:checks.length,passed:checks.filter(c=>c.ok).length,checks,artifacts,scope:{fullInline:true,actualIO:true,actualBus:true,browser:false,naturalGameplay:false,testOnlyBootGeometry:true,noTargetGateOrDamageMock:true,noPixelClaim:true,completeMainline:false}};
writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({runner:report.runner,sourceHtmlSha256:report.sourceHtmlSha256,ok:report.ok,count:report.count,passed:report.passed,reportSha256:sha(readFileSync(out))}));
process.exitCode = report.ok ? 0 : 1;
