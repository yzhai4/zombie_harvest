import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

// TEST-ONLY HP0/stale-flags restoration fixture. This is not natural damage.
const a = {};
for (let i = 2; i < process.argv.length; i += 2) { assert.ok(process.argv[i + 1] && !Object.hasOwn(a, process.argv[i])); a[process.argv[i]] = process.argv[i + 1]; }
for (const k of ['--root','--html','--mother','--out']) assert.ok(path.isAbsolute(a[k] || ''), k);
for (const k of ['--expect-html-sha256','--expect-mother-sha256','--expect-io-sha256','--expect-factory-sha256']) assert.match(a[k] || '', /^[a-f0-9]{64}$/);
const sha = b => createHash('sha256').update(b).digest('hex'), clone = v => JSON.parse(JSON.stringify(v)), read = p => fs.readFileSync(p);
const html = read(a['--html']), mother = read(a['--mother']), io = path.join(a['--root'],'scripts/check-report-recovery.mjs'), factoryFile = path.join(a['--root'],'scripts/lib/source-runtime-fixture.mjs');
assert.equal(sha(html),a['--expect-html-sha256']); assert.equal(sha(mother),a['--expect-mother-sha256']); assert.equal(sha(read(io)),a['--expect-io-sha256']); assert.equal(sha(read(factoryFile)),a['--expect-factory-sha256']);
assert.ok(!fs.existsSync(a['--out']), 'fresh producer out required'); fs.mkdirSync(a['--out'],{recursive:true});
const out=a['--out'], write=(n,b)=>fs.writeFileSync(path.join(out,n),b), json=(n,v)=>write(n,JSON.stringify(v,null,2)+'\n');
write('producer-executed.mjs',read(fileURLToPath(import.meta.url))); write('original-online-mother-native.json',mother); write('io-adapter-executed.mjs',read(io)); write('source-runtime-fixture-executed.mjs',read(factoryFile));
const {sourceRuntimeFactory,saveKey}=await import(pathToFileURL(factoryFile).href), factory=sourceRuntimeFactory(a['--html']);
const original=JSON.parse(mother).payload; assert.equal(original.version,21); assert.equal(original.relayProject.status,'online'); assert.equal(original.npcs.length,10); assert.equal(original.worldZombies.length,5);
assert.equal(original.worldMeta.clock.rate,1); assert.equal(original.worldMeta.clock.paused,false); assert.ok(original.hp>0 && !original.gameOver && !original.night && original.wood>=2 && original.energy>=14);
const stationId=original.relayProject.buildingId, originalStation=original.buildings.filter(b=>b.id===stationId);
assert.equal(originalStation.length,1); assert.equal(originalStation[0].type,'relayStation'); assert.equal(originalStation[0].hp,8); assert.equal(originalStation[0].active,true); assert.equal(originalStation[0].relayEnabled,true);
const receipt={schema:'RelayMaintenanceBrowserInputProductionV1',status:'PREPARING',sourceHtmlSha256:sha(html),mother:{file:'original-online-mother-native.json',sha256:sha(mother),bytes:mother.length},
  mode:'TEST-ONLY-complete-real-online-writer-derived-HP0-stale-flags-and-player-position',naturalDamageClaim:false,naturalGameplay:false,humanExperience:false,browserExecuted:false,noBusinessCommandsExecuted:true,scenes:[],changes:[]};
try {
  let controlSha=null;
  for(const [id,distance] of [['destroyed-near-repair',0.9],['destroyed-view-only-range',1.19]]) {
    const r=factory([[saveKey,mother.toString('utf8')]]); assert.equal(r.api.validate({raw:mother.toString('utf8'),sourceCategory:'primary'}).ok,true); assert.equal(r.api.start().ok,true); r.tasks.clear();
    assert.equal(r.api.save({force:true,reason:'TEST-ONLY normalized online control before maintenance fixture'}),true);
    const controlRaw=r.storage.get(saveKey), control=JSON.parse(controlRaw).payload, before=clone(r.api.state), station=r.api.state.buildings.find(b=>b.id===stationId);
    if(controlSha===null){controlSha=sha(controlRaw);write('normalized-online-control-native.json',controlRaw);} else assert.equal(sha(controlRaw),controlSha,'same input/source normalizes deterministically before derivation');
    const point={x:station.x-distance,y:station.y}; r.context.__maintenanceFixturePoint=point;
    assert.equal(vm.runInContext('canOccupyContinuous(state.player,__maintenanceFixturePoint.x,__maintenanceFixturePoint.y)',r.context),true,'real collision predicate accepts declared player point'); delete r.context.__maintenanceFixturePoint;
    station.hp=0; Object.assign(r.api.state.player,{...point,prevX:point.x,prevY:point.y});
    const after=clone(r.api.state), x=clone(before), y=clone(after);
    for(const p of [x,y]){delete p.buildings.find(b=>b.id===stationId).hp;for(const k of ['x','y','prevX','prevY'])delete p.player[k];}
    assert.deepEqual(y,x,'only declared station HP and player geometry change');
    assert.equal(r.api.save({force:true,reason:'TEST-ONLY maintenance '+id+' HP0/stale flags; no damage executed'}),true);
    const raw=r.storage.get(saveKey), p=JSON.parse(raw).payload, savedStation=p.buildings.find(b=>b.id===stationId);
    assert.equal(r.api.validate({raw,sourceCategory:'primary'}).ok,true); assert.equal(savedStation.hp,0); assert.equal(savedStation.active,true); assert.equal(savedStation.relayEnabled,true);
    for(const k of ['hp','energy','wood','stone','food','parts','medicine','seeds','resources','npcs','worldZombies','relayProject','campStanding','quests','specialItems'])assert.deepEqual(p[k],control[k],'no gifts/deletion/history rewrite: '+k);
    assert.deepEqual(p.worldMeta.events.filter(e=>e.type==='relay.stationOnline'),control.worldMeta.events.filter(e=>e.type==='relay.stationOnline'));
    const second=factory([[saveKey,raw]]);assert.equal(second.api.start().ok,true);second.tasks.clear();assert.equal(second.api.state.buildings.find(b=>b.id===stationId).hp,0,'real second Continue cannot refill HP0');
    assert.deepEqual(clone(second.api.state.relayProject),p.relayProject);assert.deepEqual(clone(second.api.state.campStanding),p.campStanding);
    const file=id+'-input-native.json';write(file,raw);receipt.scenes.push({id,file,sha256:sha(raw),bytes:Buffer.byteLength(raw),stationId,initialDistance:distance,expectedInitialRepairAllowed:distance<=1,kind:receipt.mode});
    receipt.changes.push({scene:id,stationId,stationHp:{before:8,after:0},player:{before:control.player,after:{...point,prevX:point.x,prevY:point.y}},stationFlags:{active:true,relayEnabled:true,preservedStaleFlags:true},enemyOrResourceChanges:0});
  }
  receipt.status='PREPARATION_VERIFIED';json('producer-report.json',receipt);
  const provenanceFiles=['producer-executed.mjs','original-online-mother-native.json','normalized-online-control-native.json','io-adapter-executed.mjs','source-runtime-fixture-executed.mjs','producer-report.json'].map(file=>{const b=read(path.join(out,file));return{file,sha256:sha(b),bytes:b.length};});
  json('input-manifest.json',{schema:'RelayMaintenanceBrowserInputsV1',sourceHtmlSha256:sha(html),motherSha256:sha(mother),naturalDamageClaim:false,naturalGameplay:false,humanExperience:false,stationId,scenes:receipt.scenes,provenanceFiles});
}catch(e){receipt.status='PREPARATION_FAILED';receipt.error={name:e.name,message:e.message};process.exitCode=1;}
finally{json('producer-report.json',receipt);console.log(JSON.stringify(receipt));}
