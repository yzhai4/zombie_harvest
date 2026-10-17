#!/usr/bin/env node
/**
 * Independent, controlled source-VM acceptance for the handoff memory slice.
 * Runs the complete supplied inline with the existing real IO/runtime factory.
 * It does not replace any Gate, reducer, serializer, loader or memory function.
 * DOM/timers/storage are controlled IO. Actual renderer pointers are retained,
 * but the adapter does not parse innerHTML: no browser visibility/layout claim.
 * All non-original fixture changes and privileged source stimuli are named.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--repo-root','--base-root','--html','--input-selection','--out','--expect-html-sha256'].includes(args[i]) && args[i + 1], 'unknown or missing argument');
  options[args[i]] = args[i + 1];
}
for (const flag of ['--repo-root','--html','--out']) assert.ok(path.isAbsolute(options[flag] || ''), `${flag} must be absolute`);
for (const flag of ['--base-root','--input-selection']) if (options[flag] !== undefined) assert.ok(path.isAbsolute(options[flag]), `${flag} must be absolute when supplied`);
const root = path.resolve(options['--repo-root']), base = path.resolve(options['--base-root'] || root);
const selectionPath = options['--input-selection'] || path.join(root, 'scripts/fixtures/relay-handoff-memory-v1/input-selection.json');
const htmlPath = path.resolve(options['--html']), out = path.resolve(options['--out']);
const artifactDir = out.replace(/\.json$/i, '') + '.artifacts';
assert.ok(!existsSync(out) && !existsSync(artifactDir), 'fresh --out and artifact directory required');
mkdirSync(artifactDir, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));
const refs = [], artifactsByHash = new Map();
function artifact(name, value, meta = {}) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  const digest = sha(bytes);
  let ref = artifactsByHash.get(digest);
  if (!ref) {
    const file = path.join(artifactDir, name);
    assert.ok(path.dirname(file) === artifactDir, 'flat artifact filename');
    writeFileSync(file, bytes);
    ref = { path: path.relative(path.dirname(out), file).replaceAll('\\', '/'), bytes: bytes.length, sha256: digest };
    artifactsByHash.set(digest, ref);
  }
  const result = { ...ref, ...meta }; refs.push(result); return result;
}
const htmlBytes = readFileSync(htmlPath), sourceHtmlSha256 = sha(htmlBytes);
if (options['--expect-html-sha256']) assert.equal(sourceHtmlSha256, options['--expect-html-sha256']);
const runnerArtifact = artifact('runner-executed.mjs', readFileSync(fileURLToPath(import.meta.url)), { role: 'executed-runner' });
const sourceArtifact = artifact('source.html', htmlBytes, { role: 'actual-inline-source' });
const selectionBytes = readFileSync(selectionPath);
const selection = JSON.parse(selectionBytes);
artifact('input-selection.json', selectionBytes, { role: 'input-mapping' });
assert.equal(selection.schema, 'HandoffMemoryInputSelectionV1');
const resolveInput = row => {
  assert.ok(typeof row.repositoryPath === 'string' && row.repositoryPath.length > 0 && !path.isAbsolute(row.repositoryPath), 'every input must have a repository-relative repositoryPath');
  const file = path.resolve(root, row.repositoryPath), relative = path.relative(root, file);
  assert.ok(relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), 'repositoryPath must remain within --repo-root');
  return file;
};
const fixtureProvenancePath = path.join(root, 'scripts/fixtures/relay-handoff-memory-v1/provenance.json');
if (existsSync(fixtureProvenancePath)) artifact('fixture-provenance.json', readFileSync(fixtureProvenancePath), { role:'original-fixture-capture-provenance', sourceRef:'scripts/fixtures/relay-handoff-memory-v1/provenance.json' });
const inputs = new Map();
for (const row of [...selection.runtimeAdapter, ...selection.inputs, ...selection.provenance]) {
  const file = resolveInput(row), bytes = readFileSync(file);
  assert.equal(sha(bytes), row.sha256, 'frozen input/adapter SHA: ' + (row.id || row.repositoryPath));
  if (row.bytes !== undefined) assert.equal(bytes.length, row.bytes);
  const suffix = path.extname(file) || '.bin';
  const ref = artifact('input-' + row.sha256 + suffix, bytes, { role: row.id || row.role || row.repositoryPath, sourceRef: row.repositoryPath });
  if (row.id) inputs.set(row.id, { ...row, raw: bytes.toString('utf8'), artifact: ref });
}
const helperPath = path.join(root, 'scripts/lib/source-runtime-fixture.mjs');
const { sourceRuntimeFactory: actualFactory } = await import(pathToFileURL(helperPath));
// Add only QA aliases to the exact existing factory. Capture renderContext
// before the IO adapter suppresses its unrelated automatic Canvas rendering.
const exportMarker = 'contentRegistry: ContentRegistry, contentResolve: resolveContentChainCommand,';
let factoryText = actualFactory.toString();
assert.equal(factoryText.split(exportMarker).length, 2, 'one existing QA-export marker');
factoryText = factoryText.replace(exportMarker, exportMarker + `
    handoffRelayCore, relayHandoffToken, viewNpc, npcPublicActionGate,
    actualRenderContext: renderContext, actualRenderSurvivors: renderSurvivors,
    markNpcDead, assignMorningSuccessors, setWorldRate, serializeNpc,
    memoryValidate: typeof validateRelayHandoffMemoryV1 === 'function' ? validateRelayHandoffMemoryV1 : null,
    memoryRoster: typeof validateRelayHandoffMemoryRoster === 'function' ? validateRelayHandoffMemoryRoster : null,
    memoryProject: typeof projectNpcRelayHandoffMemory === 'function' ? projectNpcRelayHandoffMemory : null,
    memoryRecord: typeof recordRelayHandoffMemory === 'function' ? recordRelayHandoffMemory : null,
    memorySync: typeof syncNpcHandoffMemoryUi === 'function' ? syncNpcHandoffMemoryUi : null,
    memoryClear: typeof clearNpcHandoffMemoryUi === 'function' ? clearNpcHandoffMemoryUi : null,
    memoryCache() { return typeof npcHandoffMemoryUi === 'undefined' ? null : npcHandoffMemoryUi; },
  `);
artifact('qa-factory-executed.txt', factoryText, { role: 'exact-alias-only-factory' });
const makeFactory = new Function('readFileSync','path','vm','assert','root', 'return (' + factoryText + ');')(readFileSync,path,vm,assert,root);
const factory = makeFactory(htmlPath), saveKey = 'zombie-harvest-progress-v12';
const checks = [], evidence = {}, rawErrors = [];
const printable = text => String(text).replaceAll(root, '<REPO>').replaceAll(base, '<BASE>').replaceAll(path.dirname(out), '<OUT>');
function test(name, run) {
  try { const detail = run(); checks.push({ name, ok: true, ...(detail ? { evidence: detail } : {}) }); }
  catch (error) {
    const raw = error.stack || String(error); rawErrors.push({ name, stack: raw });
    checks.push({ name, ok: false, error: printable(error.message || error) });
  }
}
const events = (r, type) => r.api.state.worldMeta.events.filter(event => event.type === type);
const byId = (r, id) => r.api.state.npcs.find(npc => npc.id === id);
const slots = r => r.api.state.npcs.map(npc => ({ id: npc.id, slot: npc.memory?.relayCoreHandoff }));
const recorded = r => slots(r).filter(row => row.slot != null);
function startRaw(raw, label, checkpoint = true) {
  const r = factory([[saveKey, raw]]);
  assert.notEqual(r.api.boot.classification, 'RECOVERY_REQUIRED', label + ' actual loader');
  assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true, label + ' actual validator');
  r.emit('continueSaveBtn', 'click');
  assert.equal(r.api.started, true, label + ' public Continue listener');
  assert.equal(r.api.session.mode, 'DAY');
  if (checkpoint) fireCheckpoint(r, label + '-start');
  return r;
}
function startInput(id, checkpoint = true) { return startRaw(inputs.get(id).raw, id, checkpoint); }
function fireCheckpoint(r, label) {
  const found = [...r.tasks.entries()].filter(([,task]) => task.kind === 'timeout' && task.delay === 650).at(-1);
  assert.ok(found, label + ' actual queued 650ms checkpoint');
  r.tasks.delete(found[0]); found[1].callback();
  const raw = r.storage.get(saveKey);
  assert.ok(raw); assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true, label + ' normal writer valid');
  artifact(label + '-native.json', raw, { role: 'actual-normal-checkpoint-writer' });
  return raw;
}
function derivedRaw(payload, label, parentRef, changes) {
  // This is a complete, explicitly TEST-ONLY boot input. Checksum uses the
  // actual source checksum; it does not create a new success event or capsule.
  const r = factory(), p = plain(payload);
  const raw = JSON.stringify({ ...p, version:p.version, payload:p, checksum:r.api.hash(p), savedAt:(p.day-1)*1440+p.hour*60+p.minute });
  artifact(label + '-derived-input.json', raw, { role:'TEST-ONLY-derived-native', parent:parentRef, changes });
  return raw;
}
function requireMemory(r) {
  for (const key of ['memoryValidate','memoryRoster','memoryProject','memoryRecord','memorySync','memoryClear']) assert.equal(typeof r.api[key], 'function', 'required real API: ' + key);
}
function economic(r) {
  const s = r.api.state;
  return plain({ hp:s.hp,energy:s.energy,sanity:s.sanity,wood:s.wood,stone:s.stone,food:s.food,seeds:s.seeds,parts:s.parts,medicine:s.medicine,
    standing:s.campStanding,core:s.specialItems.relayCore,project:s.relayProject,world:s.world,rngState:s.worldMeta.rngState,npcs:s.npcs.map(n=>({id:n.id,hp:n.hp,needs:n.needs,relations:n.relations,memory:n.memory})) });
}
function expectedCapsule(event) {
  assert.equal(event.type,'relay.coreHandedOff'); assert.equal(event.actorId,'player-1');
  return { version:1,eventId:event.eventId,eventSeq:event.seq,commandId:event.commandId,causationId:event.causationId,
    tick:plain(event.tick),actorId:'player-1',recipientId:event.payload.commanderId,projectId:event.payload.projectId,
    itemId:'relayCore',itemInstanceId:event.payload.itemInstanceId,defId:'relay-chain-001',definitionVersion:1,
    instanceId:event.instanceId,expectedEventId:event.payload.expectedEventId };
}
let successProof = null;
function success() {
  if (successProof) return successProof;
  const r = startInput('held-core-near-recipient');
  const before = economic(r), token = plain(r.api.relayHandoffToken());
  const result = r.api.handoffRelayCore({ commandId:'handoff-memory-actual-success',...token });
  artifact('actual-success-result.json', plain(result), { role:'actual-bus-result' });
  assert.equal(result.ok,true); assert.notEqual(result.duplicate,true); assert.ok(result.event);
  const raw = fireCheckpoint(r, 'actual-success');
  successProof = { raw,result:plain(result),before,after:economic(r),token,ref:artifact('actual-success-native.json',raw) };
  return successProof;
}
function loadedSuccess() { const p=success(); return startRaw(p.raw,'success-reload'); }
function exactOldPayload(original, raw, missing) {
  const old = JSON.parse(original), p = plain(old.payload), seq = p.worldMeta.eventSeq + 1;
  const adapter = { adapter:'npc-relay-handoff-memory-v1',npcIds:missing,defaultValue:null };
  for (const n of p.npcs) if (missing.includes(n.id)) n.memory.relayCoreHandoff=null;
  const date = { day:p.day,hour:p.hour,minute:p.minute };
  const payload = { migration:'resolved-report-recovery-001',migrationVersion:1,reason:'npc-relay-handoff-memory-v1',sourceCategory:'primary',
    originalChecksum:old.checksum,originalDate:date,selectedChecksum:old.checksum,selectedDate:date,rollback:false,instanceId:null,
    fromSaveVersion:21,fromContentVersion:3,adapter:null,addedDomains:['npc.memory.relayCoreHandoff'],npcRelayHandoffMemoryAdapters:[adapter] };
  p.worldMeta.events.push({ eventId:'evt-'+String(seq).padStart(6,'0'),seq,type:'save.migrated',actorId:'system',commandId:null,causationId:null,
    tick:{world:(p.day-1)*1440+p.hour*60+p.minute,phase:p.worldMeta.clock.phaseMinutes,schedule:p.worldMeta.clock.scheduleMinutes},payload });
  p.worldMeta.eventSeq=seq; p.worldMeta.lastEventId='evt-'+String(seq).padStart(6,'0'); p.worldMeta.lastCheckpointReason='session-start';
  // Existing baseline prepareSavedPayload resets this transient integration remainder.
  // Keep every other motion key and all business fields in the exact comparison.
  p.motion.accumulator=0;
  assert.deepEqual(JSON.parse(raw).payload,p,'complete original payload plus ONLY exact null/migration/checkpoint delta');
  return p;
}

test('baseline business: real held core handoff consumes once and gives only the existing exact rewards', () => {
  const p=success();
  assert.equal(p.before.core,1); assert.equal(p.after.core,0); assert.equal(p.after.project.status,'briefed');
  for (const key of ['hp','energy','sanity','wood','stone','food','seeds','parts','medicine','rngState']) assert.equal(p.after[key],p.before[key],key);
  assert.deepEqual(p.after.world,p.before.world,'handoff itself does not advance');
  for (const [key,amount] of [['prestige',2],['merit',3],['contribution',2]]) assert.equal(p.after.standing[key],p.before.standing[key]+amount,key);
  assert.equal(p.after.standing.domains.recon,p.before.standing.domains.recon+2); assert.equal(p.after.standing.domains.defense,p.before.standing.domains.defense+1);
  const id=p.result.event.payload.commanderId, b=p.before.npcs.find(n=>n.id===id),a=p.after.npcs.find(n=>n.id===id);
  assert.equal(a.relations.trustToPlayer,b.relations.trustToPlayer+2); assert.equal(a.relations.respectToPlayer,b.relations.respectToPlayer+2);
  assert.deepEqual(p.result.event.payload.expectedEventId,p.token.expectedEventId);
  return { success:p.ref,commandId:p.result.commandId,eventId:p.result.event.eventId,recipientId:id };
});
test('baseline business: duplicate ID before changed CAS never re-pays or issues a second handoff', () => {
  const r=loadedSuccess(),before=plain(r.api.state),count=events(r,'relay.coreHandedOff').length;
  const result=r.api.handoffRelayCore({commandId:'handoff-memory-actual-success',expectedEventId:'stale-after-success'});
  assert.equal(result.duplicate,true); assert.equal(result.ok,true); assert.equal(events(r,'relay.coreHandedOff').length,count); assert.deepEqual(plain(r.api.state),before);
});
test('baseline refusal: real stale four-token CAS changes no economic or NPC facts', () => {
  const r=startInput('held-core-near-recipient'),before=economic(r),count=events(r,'relay.coreHandedOff').length;
  const result=r.api.handoffRelayCore({commandId:'handoff-memory-stale',...plain(r.api.relayHandoffToken()),expectedEventId:'definitely-not-current'});
  assert.equal(result.ok,false); assert.equal(result.reason,'event-state-conflict'); assert.deepEqual(economic(r),before); assert.equal(events(r,'relay.coreHandedOff').length,count); assert.equal(recorded(r).length,0);
});
test('baseline refusal: original post-discovery full writer is actually too far, no pretend success', () => {
  const r=startInput('held-core-after-discover'),before=economic(r);
  const result=r.api.handoffRelayCore({commandId:'handoff-memory-distance'});
  assert.equal(result.ok,false); assert.equal(result.reason,'commander-too-far'); assert.deepEqual(economic(r),before); assert.equal(events(r,'relay.coreHandedOff').length,0); assert.equal(recorded(r).length,0);
});
test('unsupported actor: preserve actual legacy business success but never claim player memory', () => {
  const r=startInput('held-core-near-recipient'),result=r.api.handoffRelayCore({commandId:'handoff-memory-unsupported',actorId:'TEST-ONLY-unsupported-actor'});
  assert.equal(result.ok,true,'existing actor gap is deliberately not tightened by this slice'); assert.equal(result.event.actorId,'TEST-ONLY-unsupported-actor');
  assert.equal(r.api.state.specialItems.relayCore,0); assert.equal(r.api.state.relayProject.status,'briefed'); assert.equal(recorded(r).length,0);
  fireCheckpoint(r,'unsupported-actor');
});
test('new memory API presence is a separate feature assertion, never a bootstrap substitute', () => { requireMemory(startInput('held-core-near-recipient')); });
test('capsule: exact authored 15-field record matches THIS returned success and replay, not lastEventId', () => {
  const p=success(),r=loadedSuccess(),id=p.result.event.payload.commanderId;
  const expected=expectedCapsule(p.result.event),slot=byId(r,id).memory.relayCoreHandoff;
  assert.deepEqual(plain(slot),expected); assert.equal(recorded(r).length,1);
  assert.notEqual(slot.eventId,slot.expectedEventId); assert.equal(slot.commandId,p.result.commandId);
  const command=r.api.state.worldMeta.replay.commands.find(c=>c.commandId===slot.commandId); assert.ok(command); assert.equal(command.type,'relay.coreHandoff'); assert.equal(command.actorId,'player-1');
  assert.equal(command.payload.expectedEventId,p.token.expectedEventId); assert.equal(r.api.memoryValidate(slot,id,r.api.state),true);
});
test('normal writer then actual Continue and real periodic world ticks preserve memory without migration or reward replay', () => {
  const p=success(),r=loadedSuccess(); requireMemory(r); const id=p.result.event.payload.commanderId,slot=plain(byId(r,id).memory.relayCoreHandoff),count=events(r,'save.migrated').length;
  const queued=[...r.tasks.values()].filter(task=>task.kind==='interval'&&task.delay===1200);
  assert.equal(queued.length,1,'actual startWorldSimulation interval');
  assert.ok(![...r.tasks.values()].some(task=>task.kind==='timeout'&&task.delay===650),'start checkpoint already consumed');
  const startMinute=r.api.state.world.totalMinutes,ticks=[];
  // Run only the already-registered actual world callback at its own cadence.
  // No new timer, checkpoint request, save(), or fabricated time receipt.
  for(let i=0;i<10;i++){
    const minute=r.api.state.world.totalMinutes,seq=r.api.state.worldMeta.eventSeq;
    r.instrumentation.now+=1200;queued[0].callback();
    const receipts=events(r,'time.advanced').filter(e=>e.seq>seq);
    assert.equal(receipts.length,1,'one actual advance per world callback');assert.equal(receipts[0].payload.minutes,1);
    assert.equal(r.api.state.world.totalMinutes,minute+1);
    const command=r.api.state.worldMeta.replay.commands.find(c=>c.commandId===receipts[0].commandId);
    assert.ok(command);assert.equal(command.type,'world.advance');assert.equal(command.payload.minutes,1);
    ticks.push({event:plain(receipts[0]),command:plain(command)});
  }
  assert.equal(r.api.state.worldMeta.lastCheckpointReason,'world-tick','actual periodic checkpoint owner');
  const raw=fireCheckpoint(r,'post-reload-world-tick'),next=startRaw(raw,'second-success-continue');
  assert.deepEqual(plain(byId(next,id).memory.relayCoreHandoff),slot); assert.equal(events(next,'relay.coreHandedOff').length,1); assert.equal(events(next,'save.migrated').length,count);
  assert.equal(next.api.state.world.totalMinutes,startMinute+10);assert.deepEqual(plain(next.api.state.campStanding),p.after.standing);
  return {actualTimerDelayMs:1200,actualTimerCallbacks:10,elapsedWorldMinutes:10,actualEvents:artifact('post-reload-world-timer-proof.json',ticks,{role:'actual-world-timer-receipts-and-replay'})};
});
test('pure projection: actual source capsule reader is free, own-person only, and hides technical IDs', () => {
  const p=success(),r=loadedSuccess(); requireMemory(r); const id=p.result.event.payload.commanderId,npc=byId(r,id),before=plain(r.api.state),stored=[...r.storage.entries()];
  const view=r.api.memoryProject(npc); assert.equal(view.status,'recorded'); assert.match(view.text,/第1天 06:20/); assert.match(view.text,/玩家.*广播核心/);
  for(const value of [p.result.event.eventId,p.result.commandId,id,p.result.event.payload.projectId,p.result.event.payload.itemInstanceId]) assert.ok(!view.text.includes(value),'no technical ID '+value);
  const other=r.api.state.npcs.find(n=>n.id!==id); assert.deepEqual(plain(r.api.memoryProject(other)),{status:'unrecorded',text:'交付记忆：未记录'});
  assert.deepEqual(plain(r.api.state),before); assert.deepEqual([...r.storage.entries()],stored);
});
test('real free view: E0, paused clock, critical and low trust retain original view eligibility', () => {
  const p=JSON.parse(success().raw).payload,id=success().result.event.payload.commanderId,n=p.npcs.find(n=>n.id===id);
  p.energy=0;p.worldMeta.clock.paused=true;n.hp=1;n.lifeState='critical';n.relations.trustToPlayer=-100;
  const raw=derivedRaw(p,'view-free-critical',success().ref,['energy=0','clock.paused=true','recipient hp=1/lifeState=critical/trust=-100']);
  const r=startRaw(raw,'view-free-critical');requireMemory(r);const before=plain(r.api.state),stored=[...r.storage.entries()];
  assert.equal(r.api.npcPublicActionGate(id,{action:'view'}).ok,true);const result=r.api.viewNpc(id);assert.equal(result.ok,true);assert.equal(result.operation,'view');
  const after=plain(r.api.state);after.selectedNpc=before.selectedNpc;assert.deepEqual(after,before);assert.deepEqual([...r.storage.entries()],stored);
  assert.equal(r.api.memoryProject(byId(r,id)).status,'recorded');assert.equal(r.api.memoryCache().actorId,id);
});
test('real view Gate and cache: switching target then distance/session invalidation clears private selection', () => {
  const r=loadedSuccess();requireMemory(r);const id=success().result.event.payload.commanderId,npc=byId(r,id);
  assert.equal(r.api.viewNpc(id).ok,true);assert.equal(r.api.memoryCache().actorId,id);
  const other=r.api.state.npcs.find(n=>n.id!==id && r.api.npcPublicActionGate(n,{action:'view'}).ok);
  if(other){assert.equal(r.api.viewNpc(other.id).ok,true);assert.equal(r.api.memoryCache().actorId,other.id);assert.equal(r.api.memoryProject(other).status,'unrecorded');}
  else {r.api.state.selectedNpc='TEST-ONLY-other-selection';r.api.memorySync();assert.equal(r.api.memoryCache(),null);}
  assert.equal(r.api.viewNpc(id).ok,true);npc.x+=10;r.api.memorySync();assert.equal(r.api.memoryCache(),null);
  npc.x-=10;assert.equal(r.api.viewNpc(id).ok,true);r.api.session.freeze('REPORT');r.api.memorySync();assert.equal(r.api.memoryCache(),null);
});
test('actual roster renderer keeps independent initially-hidden memory markup; context line is outside action shortcuts', () => {
  const r=loadedSuccess();requireMemory(r);const prior=plain(slots(r)),count=events(r,'relay.coreHandedOff').length;
  r.api.actualRenderSurvivors();const markup=r.node('survivorList').innerHTML;
  assert.equal((markup.match(/data-npc-handoff-surface="roster"/g)||[]).length,r.api.state.npcs.length);assert.match(markup,/data-npc-handoff-npc="commander"[^>]*hidden/);
  const html=htmlBytes.toString('utf8');assert.ok(html.indexOf('id="npcHandoffMemory"')>=0);assert.ok(html.indexOf('id="npcHandoffMemory"')<html.indexOf('id="contextActions"'));
  r.api.actualRenderContext();assert.deepEqual(plain(slots(r)),prior);assert.equal(events(r,'relay.coreHandedOff').length,count);
  return { limitation:'real renderer markup and cache only; empty selector adapter cannot prove DOM visibility, event delegation or layout' };
});
test('identity: actual death and successor retain original receiver history and give no inherited experience', () => {
  const r=loadedSuccess();requireMemory(r);const id=success().result.event.payload.commanderId,npc=byId(r,id),slot=plain(npc.memory.relayCoreHandoff);
  const death={npcDeaths:0};r.api.markNpcDead(npc,death,[]);r.api.assignMorningSuccessors();
  assert.equal(npc.lifeState,'dead');assert.deepEqual(plain(npc.memory.relayCoreHandoff),slot);assert.equal(r.api.npcPublicActionGate(id,{action:'view'}).ok,false);
  const next=r.api.state.npcs.find(n=>n.actingRole==='commander');assert.ok(next);assert.notEqual(next.id,id);assert.equal(next.memory.relayCoreHandoff,null);
  assert.equal(r.api.save(),true);const raw=r.storage.get(saveKey);artifact('actual-death-successor-native.json',raw,{role:'actual-writer-after-TEST-ONLY-real-death-helper-and-succession'});
  const reload=startRaw(raw,'death-successor-reload');assert.deepEqual(plain(byId(reload,id).memory.relayCoreHandoff),slot);assert.equal(byId(reload,next.id).memory.relayCoreHandoff,null);
});
test('identity: genuine unhanded input, actual death and succession attribute a NEW success to actual recipient ID', () => {
  const r=startInput('held-core-near-recipient');requireMemory(r);const dead=byId(r,'commander');r.api.markNpcDead(dead,{npcDeaths:0},[]);r.api.assignMorningSuccessors();
  const next=r.api.state.npcs.find(n=>n.actingRole==='commander');assert.ok(next);
  // Explicit source-QA placement, not public navigation or a natural route.
  r.api.state.player.x=next.x;r.api.state.player.y=next.y;
  const result=r.api.handoffRelayCore({commandId:'handoff-memory-actual-successor'});assert.equal(result.ok,true);assert.equal(result.event.payload.commanderId,next.id);
  assert.deepEqual(plain(next.memory.relayCoreHandoff),expectedCapsule(result.event));assert.equal(dead.memory.relayCoreHandoff,null);fireCheckpoint(r,'new-successor-handoff');
});
test('retention: 520 REAL clock events evict the source from live500/writer300 but never erase own memory', () => {
  const r=loadedSuccess();requireMemory(r);const id=success().result.event.payload.commanderId,slot=plain(byId(r,id).memory.relayCoreHandoff),minute=r.api.state.world.totalMinutes;
  for(let i=0;i<520;i++)r.api.setWorldRate(1);
  assert.equal(r.api.state.world.totalMinutes,minute);assert.equal(r.api.state.worldMeta.events.length,500);assert.ok(!r.api.state.worldMeta.events.some(e=>e.eventId===slot.eventId));
  const raw=fireCheckpoint(r,'evicted-source'),p=JSON.parse(raw).payload;assert.equal(p.worldMeta.events.length,300);assert.ok(p.worldMeta.events[0].seq>slot.eventSeq);
  const reload=startRaw(raw,'evicted-source-reload');assert.deepEqual(plain(byId(reload,id).memory.relayCoreHandoff),slot);assert.equal(reload.api.memoryProject(byId(reload,id)).status,'recorded');
  evidence.evicted={raw,ref:artifact('evicted-source-native.json',raw),slot};return { method:'TEST-ONLY finite source IO load; real clock.rateChanged events; zero elapsed world minutes',retainedLive:500,retainedWriter:300 };
});
test('null CAS comes from actual prior relay source eviction and actual new success, not an invented receipt', () => {
  const r=startInput('held-core-near-recipient');requireMemory(r);for(let i=0;i<520;i++)r.api.setWorldRate(1);
  assert.equal(r.api.relayHandoffToken().expectedEventId,null);const result=r.api.handoffRelayCore({commandId:'handoff-memory-null-cas',expectedEventId:null});
  assert.equal(result.ok,true);assert.equal(result.event.payload.expectedEventId,null);assert.deepEqual(plain(byId(r,result.event.payload.commanderId).memory.relayCoreHandoff),expectedCapsule(result.event));fireCheckpoint(r,'null-cas-success');
});
test('legacy opaque prior event and opaque parent command survive actual CAS dispatch and new canonical event', () => {
  const source=inputs.get('held-core-near-recipient'),p=JSON.parse(source.raw).payload;
  const prior=[...p.worldMeta.events].reverse().find(e=>e.defId==='relay-chain-001'&&e.instanceId===p.relayProject.id);assert.ok(prior);
  const old=prior.eventId;prior.eventId='legacy:relay-observation:opaque';if(p.worldMeta.lastEventId===old)p.worldMeta.lastEventId=prior.eventId;
  const raw=derivedRaw(p,'legacy-opaque-cas',source.artifact,['only original prior relay eventId changed to legacy opaque ID; no new receipt/capsule']);
  const r=startRaw(raw,'legacy-opaque-cas');requireMemory(r);assert.equal(r.api.relayHandoffToken().expectedEventId,'legacy:relay-observation:opaque');
  const result=r.api.handoffRelayCore({commandId:'legacy opaque command / handoff'});assert.equal(result.ok,true);assert.match(result.event.eventId,/^evt-\d+$/);assert.equal(result.event.payload.expectedEventId,'legacy:relay-observation:opaque');
  assert.deepEqual(plain(byId(r,result.event.payload.commanderId).memory.relayCoreHandoff),expectedCapsule(result.event));fireCheckpoint(r,'legacy-opaque-cas-success');
});
for (const id of ['old-browser-already-delivered','old-source-already-delivered']) {
  test('legacy exact adapter/no backfill/pure prepare and second Continue: '+id, () => {
    const input=inputs.get(id),old=JSON.parse(input.raw).payload,missing=old.npcs.filter(n=>!Object.hasOwn(n.memory,'relayCoreHandoff')).map(n=>n.id);
    const r=factory([[saveKey,input.raw]]);requireMemory(r);assert.equal(r.api.validate({raw:input.raw,sourceCategory:'primary'}).ok,true);
    const before=plain(r.api.state),stored=[...r.storage.entries()],selected=r.api.boot.selected;
    const draft=r.api.prepare(selected,r.api.boot,selected);assert.ok(draft);assert.deepEqual(plain(r.api.state),before);assert.deepEqual([...r.storage.entries()],stored);assert.equal(inputs.get(id).raw,input.raw);
    r.emit('continueSaveBtn','click');assert.equal(r.api.started,true);const raw=fireCheckpoint(r,id+'-migrated');exactOldPayload(input.raw,raw,missing);
    assert.equal(recorded(r).length,0);assert.ok(slots(r).every(row=>row.slot===null));assert.equal(r.api.state.relayProject.handoffAt,old.relayProject.handoffAt);
    const next=startRaw(raw,id+'-second');assert.equal(events(next,'save.migrated').length,old.worldMeta.events.filter(e=>e.type==='save.migrated').length+1);
    assert.deepEqual(JSON.parse(next.storage.get(saveKey)).payload,JSON.parse(raw).payload,'second Continue payload exact; no second adapter or reward');
  });
}
test('explicit null current writer needs no migration and new fresh writer starts all slots null', () => {
  const r=factory();requireMemory(r);r.emit('continueSaveBtn','click');assert.equal(r.api.started,true);const raw=fireCheckpoint(r,'fresh-null');assert.ok(slots(r).every(row=>row.slot===null));
  const n=startRaw(raw,'fresh-null-reload');assert.equal(events(n,'save.migrated').length,0);assert.ok(slots(n).every(row=>row.slot===null));
});
const badCapsules = [
  ['future-version',c=>c.version=2],['missing-field',c=>delete c.tick],['unknown-field',c=>c.extra='unexpected'],
  ['wrong-recipient',c=>c.recipientId='sergeant'],['wrong-actor',c=>c.actorId='system'],['wrong-item',c=>c.itemId='wood'],
  ['wrong-project',c=>c.projectId='other'],['wrong-item-instance',c=>c.itemInstanceId='other'],['wrong-def',c=>c.defId='other'],
  ['future-definition',c=>c.definitionVersion=2],['instance-mismatch',c=>c.instanceId='other'],['event-seq-mismatch',c=>c.eventSeq+=1],
  ['source-command-mismatch',c=>c.commandId='not-the-source-command'],['source-CAS-mismatch',c=>c.expectedEventId='not-the-source-CAS'],
  ['future-world',c=>c.tick.world+=10000],['negative-phase',c=>c.tick.phase=-1],['extra-tick-key',c=>c.tick.extra=0],
];
test('bad complete native inputs: closed shape, identity, source, definition and time all fail before installation', () => {
  const proof=success(),original=JSON.parse(proof.raw).payload,id=proof.result.event.payload.commanderId,observed=[];
  for(const [name,mutate]of badCapsules){
    const p=plain(original),slot=p.npcs.find(n=>n.id===id).memory.relayCoreHandoff;assert.ok(slot,'actual capsule, never fabricated positive');mutate(slot);
    const raw=derivedRaw(p,'bad-'+name,proof.ref,['TEST-ONLY corrupt actual capsule: '+name]),r=factory([[saveKey,raw]]);requireMemory(r);
    const before=plain(r.api.state);assert.equal(r.api.validate({raw,sourceCategory:'primary'}).ok,false,name);assert.equal(r.api.boot.classification,'RECOVERY_REQUIRED',name);
    r.emit('continueSaveBtn','click');assert.equal(r.api.started,false,name);assert.deepEqual(plain(r.api.state),before,name);assert.equal(r.storage.get(saveKey),raw,name);observed.push(name);
  }return { rejectedDerivedInputs:observed };
});
test('roster rejects a copied second slot, in-window wrong type and missing source without rewriting bad primary', () => {
  const proof=success(),id=proof.result.event.payload.commanderId;
  for(const name of ['second-recipient','in-window-source-type','in-window-source-missing']){
    const p=JSON.parse(proof.raw).payload,slot=p.npcs.find(n=>n.id===id).memory.relayCoreHandoff;assert.ok(slot);
    if(name==='second-recipient'){const other=p.npcs.find(n=>n.id!==id);other.memory.relayCoreHandoff=plain(slot);other.memory.relayCoreHandoff.recipientId=other.id;}
    if(name==='in-window-source-type')p.worldMeta.events.find(e=>e.eventId===slot.eventId).type='clock.rateChanged';
    if(name==='in-window-source-missing'){const e=p.worldMeta.events.find(e=>e.eventId===slot.eventId);e.eventId='legacy-wrong-id';e.type='clock.rateChanged';}
    const raw=derivedRaw(p,'bad-'+name,proof.ref,['TEST-ONLY '+name]),r=factory([[saveKey,raw]]);requireMemory(r);assert.equal(r.api.validate({raw,sourceCategory:'primary'}).ok,false,name);assert.equal(r.storage.get(saveKey),raw);
  }
});
test('writer guard: explicit undefined and accessor slots fail BEFORE JSON can drop the key or read getter', () => {
  for(const mode of ['undefined','accessor']){
    const r=loadedSuccess();requireMemory(r);const npc=byId(r,success().result.event.payload.commanderId),stored=[...r.storage.entries()];let calls=0;
    if(mode==='undefined')npc.memory.relayCoreHandoff=undefined;
    else Object.defineProperty(npc.memory,'relayCoreHandoff',{enumerable:true,configurable:true,get(){calls++;return null;}});
    assert.equal(r.api.save(),false,mode);assert.equal(calls,0,'slot getter was not executed');assert.deepEqual([...r.storage.entries()],stored,'safe primary and backup exact');
  }
});
test('supported-player preflight: unwritable slot refuses BEFORE original core/relation/standing payment', () => {
  const r=startInput('held-core-near-recipient');requireMemory(r);const npc=byId(r,'commander');
  Object.defineProperty(npc.memory,'relayCoreHandoff',{value:null,writable:false,enumerable:true,configurable:true});const before=economic(r);
  const result=r.api.handoffRelayCore({commandId:'handoff-memory-unwritable'});assert.equal(result.ok,false);assert.deepEqual(economic(r),before);assert.equal(events(r,'relay.coreHandedOff').length,0);
});
test('record hook ignores wrong returned result/duplicate without minting a second fact or changing business success', () => {
  const r=loadedSuccess();requireMemory(r);const p=success(),before=plain(r.api.state),command={type:'relay.coreHandoff',commandId:p.result.commandId,actorId:'player-1',payload:plain(p.result.event.payload)};
  assert.equal(r.api.memoryRecord({...p.result,duplicate:true},command),false);
  assert.equal(r.api.memoryRecord({...p.result,commandId:'wrong'},command),false);
  assert.equal(r.api.memoryRecord({...p.result,event:{...p.result.event,type:'clock.rateChanged'}},command),false);
  assert.deepEqual(plain(r.api.state),before);assert.equal(recorded(r).length,1);
});

const passed=checks.filter(c=>c.ok).length;
const scope = {
  sourceVM:true,controlledIO:true,fullInline:true,actualExistingFactory:true,actualGatesReducersWriterLoader:true,
  browser:false,naturalGameplay:false,playerPreference:false,fullMemorySocial:false,crossScenarioContinuity:false,tamperAuthentication:false,
  ioMask:['bootstrap unrelated Canvas render omitted by existing IO adapter','automatic renderWorld/renderHud/renderContext suppressed by existing IO adapter','actual renderContext/renderSurvivors retained and explicitly called','DOM innerHTML not parsed, querySelectorAll empty; no visibility/layout/delegation claim','timers are queued controlled callbacks; no wall-clock simulation'],
  stimuli:['original complete old writers unchanged','explicitly named TEST-ONLY boot corruptions/eligibility changes','actual handoff/view/advance/checkpoint functions','actual markNpcDead and assignMorningSuccessors, plus disclosed source-only player placement','520 actual clock-rate setter events for retention/null-CAS only'],
  unsupportedActor:'old business success retained; only player-1 capsule production is authorized',
};
if(rawErrors.length)artifact('private-errors.json',rawErrors,{role:'original-private-error-stacks-not-a-public-companion'});
const report={schema:'RelayHandoffMemorySourceReportV1',runner:'source-relay-handoff-memory-v1',sourceHtmlSha256,runnerArtifact,sourceArtifact,
  inputSelectionSha256:sha(selectionBytes),scope,ok:passed===checks.length,count:checks.length,passed,checks,artifacts:refs};
writeFileSync(out,JSON.stringify(report,null,2)+'\n');
const reportSha256=sha(readFileSync(out));
writeFileSync(out+'.sha256',reportSha256+'  '+path.basename(out)+'\n');
console.log(JSON.stringify({runner:report.runner,sourceHtmlSha256,ok:report.ok,count:report.count,passed,reportSha256}));
process.exitCode=report.ok?0:1;
