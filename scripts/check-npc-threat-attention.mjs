import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { sourceRuntimeFactory, startRuntime, root, saveKey, plain } from './lib/source-runtime-fixture.mjs';

// Only the two pinned complete SAVE21 fixtures in these four legacy checks.
// This validates the exact additive Scenario/routine-intent/handoff-memory receipt; it never removes arbitrary
// migrations or relaxes historical plan/resource/CP/population assertions.

// The authored pack is independent input, not an expectation copied from state.
// Accept exactly its once boot ledger and preserve every prior replay field.
function expectedWatchpostBootLedger(before,after,htmlText){
  before=JSON.parse(JSON.stringify(before));after=JSON.parse(JSON.stringify(after));
  const raw=fs.readFileSync(new URL('../content/packs/watchpost-manual-v1.json',import.meta.url));
  assert.equal(createHash('sha256').update(raw).digest('hex'),'b2d196a171d3a4e828d8486c36ea664992e51fd8df1223ea395172a511b869e3','actual authored watchpost pack SHA');
  const match=/const WATCHPOST_MANUAL_PACK = observerDeepFreeze\((\{[^\n]+\})\);/.exec(htmlText);assert.ok(match,'actual embedded watchpost pack');assert.deepEqual(JSON.parse(match[1]),JSON.parse(raw));
  const binding={status:'bound',packId:'watchpost-manual-v1',version:1,definitionVersion:1,digest:'fnv1a-utf16-canonical-hex-v1:b8d8b128'};
  const old=before.worldMeta.replay.contentPacks||[],already=old.some(v=>JSON.stringify(v)===JSON.stringify(binding)),reportOnly=before.night===true&&before.nightBattle?.resolved===true,load=!reportOnly&&!already;
  const replay=reportOnly?before.worldMeta.replay:{...before.worldMeta.replay,contentPacks:[...old.filter(v=>v.packId!==binding.packId),binding]};
  const added=after.worldMeta.events.filter(e=>e.seq>before.worldMeta.eventSeq),migrations=added.filter(e=>e.type==='save.migrated');assert.ok(migrations.length<=1,'at most original declared boot migration');
  const seq=before.worldMeta.eventSeq+migrations.length+1;
  const event={eventId:`evt-${String(seq).padStart(6,'0')}`,seq,type:'content.pack.loaded',actorId:'system',commandId:null,causationId:null,
    tick:{world:(before.day-1)*1440+before.hour*60+before.minute,phase:before.worldMeta.clock.phaseMinutes,schedule:before.worldMeta.clock.scheduleMinutes},payload:binding,
    defId:'watchpost-003',definitionVersion:1,instanceId:after.eventInstance?.instanceId||null,effects:[]};
  assert.deepEqual(after.worldMeta.replay,replay,'only exact authored pack binding may be added to old replay');
  assert.deepEqual(added.map(e=>e.type),[...migrations.map(()=>'save.migrated'),...(load?['content.pack.loaded']:[])],'no extra boot business/reward event');
  if(load)assert.deepEqual(added.at(-1),event,'one exact boot pack receipt after original migration');
  const end=before.worldMeta.eventSeq+migrations.length+(load?1:0);assert.equal(after.worldMeta.eventSeq,end);assert.equal(after.worldMeta.lastEventId,`evt-${String(end).padStart(6,'0')}`);
  assert.deepEqual(after.worldMeta.events.slice(0,before.worldMeta.events.length),before.worldMeta.events,'old event prefix retained');
  return{binding,replay,event:load?event:null,end};
}

function hasOnlyExpectedScenarioLegacyMigration(runtime, envelope) {
  const s = runtime.api.state, p = envelope.payload, eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  if (!['707889bd','7fde7715'].includes(envelope.checksum)) return false;
  const date = { day: p.day, hour: p.hour, minute: p.minute }, seq = p.worldMeta.eventSeq + 1;
  const handoffMissing = p.npcs.filter(n=>!Object.hasOwn(n.memory,'relayCoreHandoff')).map(n=>n.id);
  const expectedMemories = p.npcs.map(n=>Object.hasOwn(n.memory,'relayCoreHandoff') ? n.memory : {...n.memory,relayCoreHandoff:null});
  const expected = { eventId: `evt-${String(seq).padStart(6,'0')}`, seq, type: 'save.migrated', actorId: 'system', commandId: null, causationId: null,
    tick: { world: (p.day-1)*1440+p.hour*60+p.minute, phase: p.worldMeta.clock.phaseMinutes, schedule: p.worldMeta.clock.scheduleMinutes },
    payload: { migration: 'resolved-report-recovery-001', migrationVersion: 1, reason: 'npc-routine-intent-v1,scenario-legacy-unbound-v1,scenario-content-binding-v1' + (handoffMissing.length ? ',npc-relay-handoff-memory-v1' : ''), sourceCategory: 'primary',
      originalChecksum: envelope.checksum, originalDate: date, selectedChecksum: envelope.checksum, selectedDate: date, rollback: false, instanceId: null,
      fromSaveVersion: 21, fromContentVersion: 3, adapter: null, addedDomains: ['npc.routineIntent',...(handoffMissing.length ? ['npc.memory.relayCoreHandoff'] : [])],
      npcRoutineIntentAdapters: [{adapter:'npc-routine-intent-v1',npcIds:p.npcs.map(n=>n.id),defaultValue:null}], scenarioBindingAdapters: [{ adapter: 'scenario-legacy-unbound-v1',
        sourceSeed: p.worldMeta.seed, hadDeclaredSnapshot: Object.hasOwn(p,'scenarioSnapshot'), seedSource: 'saved-world-meta', declaredSeed: p.scenarioSnapshot?.seed ?? null,
        liveSeed: p.worldMeta.seed, aiDowngraded: false, effectiveAuthority: 'expression_only' }],
      scenarioContentAdapters: [{adapter:'scenario-content-binding-v1',oldPackageDigest:null,oldBindingStatus:'missing',
        compilerVersion:'scenario-event-chain-v1',catalogDigest:'fnv1a-utf16-canonical-hex-v1:33e5b74b',rulesDigest:'fnv1a-utf16-canonical-hex-v1:b19c6fb5'}],
      ...(handoffMissing.length ? {npcRelayHandoffMemoryAdapters:[{adapter:'npc-relay-handoff-memory-v1',npcIds:handoffMissing,defaultValue:null}]} : {}) } };
  const added = s.worldMeta.events.filter(event => event.seq > p.worldMeta.eventSeq), stored = runtime.storage.get(saveKey);
  if (!stored || !runtime.api.validate({raw:stored,sourceCategory:'primary'}).ok) return false;
  const written = JSON.parse(stored).payload;
  const packLedger=expectedWatchpostBootLedger(p,s,fs.readFileSync(htmlPath,'utf8'));
  return eq(added,[expected,packLedger.event]) && s.worldMeta.eventSeq === seq+1
    && eq(s.worldMeta.events.slice(0,p.worldMeta.events.length),p.worldMeta.events)
    && eq(written.worldMeta.events,s.worldMeta.events) && written.version === 21 && written.contentState.contentVersion === 3
    && s.worldMeta.seed === p.worldMeta.seed && s.worldMeta.rngState === p.worldMeta.rngState && eq(s.worldMeta.replay,packLedger.replay)
    && s.worldMeta.commandSeq === p.worldMeta.commandSeq && eq(s.worldMeta.seenCommands,p.worldMeta.seenCommands)
    && eq(s.world,p.world) && ['day','hour','minute','hp','energy','sanity','wood','stone','food','seeds','parts','medicine','morale'].every(key => s[key] === p[key])
    && eq(s.resources,p.resources) && eq(s.npcs.map(n=>({id:n.id,hp:n.hp,lifeState:n.lifeState})),p.npcs.map(n=>({id:n.id,hp:n.hp,lifeState:n.lifeState})))
    && s.npcs.every(n=>n.routineIntent===null) && written.npcs.every(n=>n.routineIntent===null)
    && eq(s.npcs.map(n=>n.memory),expectedMemories) && eq(written.npcs.map(n=>n.memory),expectedMemories)
    && eq(s.contentState.planMeeting,p.contentState.planMeeting) && s.contentState.commandPoints === p.contentState.commandPoints
    && eq(s.scenarioSnapshot.binding,{version:1,status:'legacy-unbound',sourceSeed:p.worldMeta.seed,declaredSnapshot:p.scenarioSnapshot??null})
    && s.scenarioSnapshot.seed === p.worldMeta.seed
    && eq(s.scenarioSnapshot.contentBinding,{version:1,status:'bound',compilerVersion:'scenario-event-chain-v1',
      catalogDigest:'fnv1a-utf16-canonical-hex-v1:33e5b74b',rulesDigest:'fnv1a-utf16-canonical-hex-v1:b19c6fb5',
      registry:[{kind:'eventDef',id:'relay-chain-001'},{kind:'eventChain',id:'zh-food-shortage-001'}]})
    && eq(written.scenarioSnapshot.contentBinding,s.scenarioSnapshot.contentBinding);
}

const args = process.argv.slice(2);
const cli={};assert.equal(args.length%2,0);for(let i=0;i<args.length;i+=2){assert.ok(['--html','--out'].includes(args[i])&&path.isAbsolute(args[i+1]));assert.ok(!cli[args[i]]);cli[args[i]]=args[i+1];}
const htmlPath = cli['--html'] || path.join(root, 'dist/index.html');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const directory = path.join(root, 'scripts/fixtures/npc-threat-attention-v1');
const meta = JSON.parse(fs.readFileSync(path.join(directory, 'capture-meta.json'), 'utf8'));
const bytes = fs.readFileSync(path.join(root, meta.fixture.path));
const raw = bytes.toString('utf8'), original = JSON.parse(raw), factory = sourceRuntimeFactory(htmlPath);
const checks = [], observations = {};
function test(name, run) {
  try { run(); checks.push({ name, ok: true }); }
  catch (error) { checks.push({ name, ok: false, error: String(error.stack || error) }); }
}
function load(keepBootCheckpoint=false) {
  const r = factory([[saveKey, raw]]);
  assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true);
  assert.equal(r.api.boot.classification, 'DAY');
  assert.equal(r.api.start().ok, true); if(!keepBootCheckpoint)r.tasks.clear();
  return r;
}
const actor = r => r.api.state.npcs.find(n => n.id === 'sergeant');
const enemy = r => r.api.state.worldZombies.find(z => z.id === 'wz-4');
const damage = r => r.api.state.worldMeta.events.filter(e => e.type === 'combat.damage.applied');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function isolatedThreat(r) { r.api.state.worldZombies = [enemy(r)]; }
function sensed(r) { r.api.updateNpcPerception(actor(r), 6); }
function visibleTargets(r) {
  const g = actor(r);
  return r.api.perceptionTargetsForNpc(g).filter(t => r.api.canPerceive(g, t)).sort((a, b) => distance(g, a) - distance(g, b));
}
function staticFacts(r) {
  const s = r.api.state;
  return plain({ positions: [s.player, ...s.npcs, ...s.worldZombies].map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp })),
    rng: s.worldMeta.rngState, seq: s.worldMeta.eventSeq, commandSeq: s.worldMeta.commandSeq,
    world: s.world.totalMinutes, resources: [s.hp, s.energy, s.food, s.wood, s.parts] });
}

test('original automation browser writer capture provenance and untouched bytes', () => {
  assert.equal(meta.schema, 'NpcThreatAttentionCaptureV1'); assert.equal(meta.version, 1);
  assert.equal(meta.captureKind, 'automation-browser-writer-capture');
  assert.equal(meta.productionCapture, false); assert.equal(meta.naturalGameplayClaim, false);
  assert.equal(meta.source.reportOk, false); assert.equal(meta.source.commit, '17925e1c908beb710c6bcb210e20389355805bb8');
  assert.equal(meta.source.htmlSha256, 'cc900da9cdf865b101c37080eb7417148a8a388796ba808153c905ef8ad8494a');
  assert.equal(meta.source.reportSha256, '08e4309113473164d886a39d8366f000491cb5449dcad86452d453b00e55a94b');
  assert.equal(sha(bytes), meta.fixture.sha256); assert.equal(original.checksum, '7fde7715');
  assert.equal(original.payload.version, 21); assert.equal(original.payload.contentState.contentVersion, 3);
  assert.deepEqual(meta.offlineChanges, []); assert.equal(original.savedAt, 670);
});
test('actual loader preserves captured population health positions resources and RNG', () => {
  const r = load(true), s = r.api.state;
  assert.equal(s.hp, 52); assert.equal(s.energy, 53); assert.equal(s.npcs.length, 10);
  for (const n of original.payload.npcs) {
    const loaded = s.npcs.find(item => item.id === n.id);
    for (const key of ['x', 'y', 'hp', 'lifeState', 'behaviorState', 'supportRequested']) assert.equal(loaded[key], n[key]);
  }
  assert.deepEqual(plain(s.worldZombies), original.payload.worldZombies);
  assert.equal(s.worldMeta.rngState, original.payload.worldMeta.rngState);
  const beforeBootCheckpoint=r.storage.get(saveKey),pending=[...r.tasks].filter(([,t])=>t.kind==='timeout'&&t.delay===650);assert.equal(pending.length,1);
  for(const[id,t]of pending){r.tasks.delete(id);t.callback();}r.tasks.clear();const afterBootCheckpoint=r.storage.get(saveKey);assert.equal(r.api.validate({raw:afterBootCheckpoint,sourceCategory:'primary'}).ok,true);
  observations.bootCheckpoint={scope:'actual already-queued 650ms normal checkpoint; no explicit save or pagehide',beforeSha256:sha(beforeBootCheckpoint),afterSha256:sha(afterBootCheckpoint)};
  if(cli['--out']){fs.writeFileSync(cli['--out']+'.boot-migration-before.json',beforeBootCheckpoint,{flag:'wx'});fs.writeFileSync(cli['--out']+'.boot-checkpoint-after.json',afterBootCheckpoint,{flag:'wx'});observations.bootCheckpoint.beforeFile=path.basename(cli['--out'])+'.boot-migration-before.json';observations.bootCheckpoint.afterFile=path.basename(cli['--out'])+'.boot-checkpoint-after.json';}
  assert.equal(hasOnlyExpectedScenarioLegacyMigration(r, original), true);
  assert.equal(s.worldMeta.eventSeq, original.payload.worldMeta.eventSeq + 2);
});
test('captured guard sees enemy but nearest visible player is closer before update', () => {
  const r = load(), g = actor(r), z = enemy(r);
  assert.equal(g.behaviorState, 'work'); assert.equal(g.supportRequested, false);
  assert.equal(r.api.dayNpcCanAttack(g), false); assert.equal(r.api.canPerceive(g, z), true);
  assert.equal(visibleTargets(r)[0].id, 'player-1');
  observations.original = { playerHp: r.api.state.hp, enemyHp: z.hp, distance: distance(g, z), nearestVisibleId: visibleTargets(r)[0].id };
});
test('visible threat gets attention despite closer player; identity and contact retained', () => {
  const r = load(), g = actor(r), z = enemy(r); sensed(r);
  assert.equal(g.perception.targetId, z.id); assert.equal(g.behaviorState, 'alert');
  assert.equal(r.api.dayNpcCanAttack(g), true); assert.equal(r.api.dayNpcTarget(g)?.id, z.id);
  for (const target of [z, r.api.state.player]) {
    const contact = g.perception.contacts[target.id];
    assert.ok(contact); assert.equal(contact.sourceId, g.id); assert.equal(contact.at, 670);
    assert.equal(contact.expiresAt, 670 + r.api.perceptionProfile(g).memory);
    assert.equal(contact.x, target.x); assert.equal(contact.y, target.y);
  }
});
test('actual day combat applies the activated guard damage to original wz-4', () => {
  const r = load(), g = actor(r), z = enemy(r), beforeHp = z.hp, beforeSeq = r.api.state.worldMeta.eventSeq;
  sensed(r); r.api.runDayCombat(12);
  const events = damage(r).filter(e => e.seq > beforeSeq && e.payload.sourceId === g.id && e.payload.targetId === z.id);
  assert.ok(events.length > 0); assert.ok(z.hp < beforeHp);
  const expectedDamage = 8 + Math.round(((Number(g.attributes.weaponSkill) || 50) - 50) / 12);
  assert.equal(events[0].payload.amount, expectedDamage); assert.equal(events[0].payload.profileId, 'npc.guard.day');
  observations.activatedCombat = { beforeHp, afterHp: z.hp, damage: events.map(e => e.payload.amount), source: g.id, target: z.id };
});
test('perception-only update does not advance clock RNG events resources positions or health', () => {
  const r = load(), before = staticFacts(r), storage = [...r.storage], tasks = [...r.tasks];
  sensed(r); assert.deepEqual(staticFacts(r), before);
  assert.deepEqual([...r.storage], storage); assert.deepEqual([...r.tasks], tasks);
});
test('player-only view preserves social observation without a false alert', () => {
  const r = load(), g = actor(r); r.api.state.worldZombies = [];
  sensed(r); assert.equal(g.perception.targetId, 'player-1'); assert.equal(g.behaviorState, 'work');
  assert.ok(g.perception.contacts['player-1']); assert.equal(r.api.dayNpcCanAttack(g), false);
});
test('out-of-range enemy does not become visible through player proximity', () => {
  const r = load(), g = actor(r), z = enemy(r); isolatedThreat(r); z.x = g.x + 20; z.y = g.y;
  assert.equal(r.api.canPerceive(g, z), false); sensed(r);
  assert.notEqual(g.perception.targetId, z.id); assert.equal(g.behaviorState, 'work'); assert.equal(r.api.dayNpcTarget(g), null);
});
test('enemy behind view cone does not activate the guard', () => {
  const r = load(), g = actor(r), z = enemy(r); isolatedThreat(r);
  g.motionTarget = { x: g.x + 1, y: g.y }; assert.equal(r.api.canPerceive(g, z), false);
  sensed(r); assert.notEqual(g.perception.targetId, z.id); assert.equal(g.behaviorState, 'work');
});
test('real wall LOS gate remains effective', () => {
  const r = load(), g = actor(r), z = enemy(r); isolatedThreat(r);
  const wall = r.api.state.buildings.find(b => b.type === 'wall'); assert.ok(wall);
  wall.x = 10; wall.y = 11; assert.equal(r.api.canPerceive(g, z), false);
  sensed(r); assert.notEqual(g.perception.targetId, z.id); assert.equal(r.api.dayNpcCanAttack(g), false);
});
test('dead enemy does not trigger alert', () => {
  const r = load(), g = actor(r); isolatedThreat(r); enemy(r).hp = 0;
  sensed(r); assert.equal(g.perception.targetId, 'player-1'); assert.equal(g.behaviorState, 'work');
});
test('perception cadence is retained', () => {
  const r = load(), g = actor(r); g.perception.clock = 0;
  r.api.updateNpcPerception(g, 5); assert.equal(g.behaviorState, 'work');
  r.api.updateNpcPerception(g, 1); assert.equal(g.perception.targetId, 'wz-4'); assert.equal(g.behaviorState, 'alert');
});
test('noncombat role can notice but cannot gain guard attack capability', () => {
  const r = load(), g = actor(r), q = r.api.state.npcs.find(n => n.id === 'quartermaster');
  q.x = g.x; q.y = g.y; q.motionTarget = plain(g.motionTarget); q.supportRequested = false; q.actingRole = null;
  r.api.updateNpcPerception(q, 6); assert.equal(q.perception.targetId, 'wz-4'); assert.equal(q.behaviorState, 'alert');
  assert.equal(r.api.dayNpcCanAttack(q), false);
  const seq = r.api.state.worldMeta.eventSeq; r.api.runDayCombat(12);
  assert.equal(damage(r).some(e => e.seq > seq && e.payload.sourceId === q.id), false);
});
test('dead guard stays excluded by actual routine and combat eligibility', () => {
  const r = load(), g = actor(r); g.hp = 0; g.lifeState = 'dead'; g.behaviorState = 'dead';
  const old = plain(g.perception); r.api.updateNpcRoutine(6);
  assert.deepEqual(plain(g.perception), old); assert.equal(r.api.dayNpcCanAttack(g), false);
});
test('night perception uses only night threats and day combat remains locked', () => {
  const r = load(), g = actor(r), s = r.api.state; s.night = true; s.zombies = [];
  assert.deepEqual(plain(r.api.perceptionTargetsForNpc(g).map(t => t.id)), ['player-1']);
  sensed(r); assert.equal(g.behaviorState, 'work'); const before = staticFacts(r);
  r.api.runDayCombat(30); assert.deepEqual(staticFacts(r), before);
});
test('night direct threat may alert using existing visibility but cannot invoke day damage', () => {
  const r = load(), s = r.api.state, z = enemy(r), g = actor(r); s.night = true; s.zombies = [z]; s.worldZombies = [];
  sensed(r); assert.equal(g.perception.targetId, z.id); assert.equal(g.behaviorState, 'alert');
  const seq = s.worldMeta.eventSeq, hp = z.hp; r.api.runDayCombat(30);
  assert.equal(s.worldMeta.eventSeq, seq); assert.equal(z.hp, hp);
});
for (const mode of ['REPORT', 'LOSS', 'RECOVERY']) test(mode + ' blocks day combat', () => {
  const r = load(); sensed(r); r.api.session.mode = mode;
  const before = staticFacts(r); r.api.runDayCombat(30); assert.deepEqual(staticFacts(r), before);
});
// Derived offline scene: discover an existing landmark and invoke the real
// capture effect. Never invent an outpost, NPC, enemy, or reverse marker.
function capturedGuard(r) {
  const s = r.api.state, g = actor(r), guard = s.npcs.find(n => n.id === 'guardJi');
  const landmark = s.landmarks.find(item => item.type === 'waterMill');
  assert.ok(landmark); assert.ok(guard); landmark.found = true;
  const result = r.api.contentEffects([{ op: 'captureOutpost', key: 'waterMill', guardNpcIds: [guard.id] }], { actorId: 'player-1' });
  assert.equal(result.ok, true); assert.equal(guard.garrisonedOutpostId, 'waterMill');
  assert.deepEqual(plain(s.contentState.outposts.waterMill.guardNpcIds), [guard.id]);
  guard.x = g.x; guard.y = g.y; guard.motionTarget = plain(g.motionTarget);
  guard.behaviorState = 'work'; guard.perception.clock = 0;
  return guard;
}
const sourceEval = (r, code) => vm.runInContext(code, r.context);
function incomingScene(r, guard) {
  const s = r.api.state, z = enemy(r); s.worldZombies = [z]; s.buildings = [];
  s.player.x = 2; s.player.y = 2;
  s.npcs.filter(n => n !== guard).forEach(n => { n.x = 0; n.y = 0; });
  guard.x = z.x + .5; guard.y = z.y;
  z.goal = { x: guard.x, y: guard.y }; z.aiState = 'pursue';
  z.perception = { clock: 0, targetId: null, targetAt: 0 };
  assert.equal(r.api.canPerceive(z, guard), true);
  return z;
}
test('real outpost capture keeps one canonical roster and marks the existing guard away', () => {
  const r = load(), guard = capturedGuard(r);
  const population = sourceEval(r, 'outpostPopulationLedger()');
  assert.equal(population.livingRoster, 10); assert.equal(population.campLocal, 9); assert.equal(population.garrisoned, 1);
  assert.equal(sourceEval(r, "npcHasRole(state.npcs.find(n => n.id === 'guardJi'), 'guardJi')"), false);
  assert.equal(guard.supportRequested, false); assert.equal(guard.order, null);
});
test('assigned outpost guard cannot gain camp attack capability through either role or support and checks are read only', () => {
  const r = load(), guard = capturedGuard(r);
  for (const support of [false, true]) {
    guard.behaviorState = 'alert'; guard.supportRequested = support; guard.order = support ? 'guard' : null;
    const before = plain(r.api.state);
    assert.equal(r.api.dayNpcCanAttack(guard), false); assert.equal(r.api.dayNpcTarget(guard), null);
    assert.deepEqual(plain(r.api.state), before);
  }
});
test('assigned outpost guard does not receive local perception updates or deal camp damage', () => {
  const r = load(), guard = capturedGuard(r), before = plain(guard.perception), seq = r.api.state.worldMeta.eventSeq;
  r.api.updateNpcPerception(guard, 6); assert.deepEqual(plain(guard.perception), before);
  r.api.runDayCombat(12);
  assert.equal(damage(r).some(e => e.seq > seq && e.payload.sourceId === guard.id), false);
});
test('assigned outpost guard is excluded from incoming enemy target perception and damage', () => {
  const r = load(), guard = capturedGuard(r), z = incomingScene(r, guard), hp = guard.hp;
  assert.equal(sourceEval(r, "dayEnemyTarget(state.worldZombies[0])"), null);
  sourceEval(r, 'updateEnemyPerception(state.worldZombies[0], 6)'); assert.notEqual(z.perception.targetId, guard.id);
  const seq = r.api.state.worldMeta.eventSeq; r.api.runDayCombat(12);
  assert.equal(guard.hp, hp); assert.equal(damage(r).some(e => e.seq > seq && e.payload.targetId === guard.id), false);
});
test('real local radio threat sharing reaches local peers but not the assigned outpost guard', () => {
  const r = load(), guard = capturedGuard(r), before = plain(guard.perception), radio = r.api.state.npcs.find(n => n.id === 'radio');
  radio.x = guard.x; radio.y = guard.y; assert.ok(r.api.perceptionProfile(radio).share > 0);
  r.api.updateNpcPerception(radio, 6); assert.equal(radio.perception.targetId, 'wz-4');
  assert.equal(actor(r).perception.contacts['wz-4'].sourceId, radio.id);
  assert.deepEqual(plain(guard.perception), before);
});
test('dead assigned guard still rejects camp targeting without changing state', () => {
  const r = load(), guard = capturedGuard(r); guard.hp = 0; guard.lifeState = 'dead'; guard.behaviorState = 'dead';
  const before = plain(r.api.state);
  assert.equal(r.api.dayNpcCanAttack(guard), false); assert.equal(r.api.dayNpcTarget(guard), null);
  r.api.updateNpcPerception(guard, 6); assert.deepEqual(plain(r.api.state), before);
});
test('real outpost release restores local guard perception eligibility and outgoing damage', () => {
  const r = load(), guard = capturedGuard(r), z = enemy(r), beforeHp = z.hp;
  assert.equal(sourceEval(r, "releaseNpcFromOutpost(state.npcs.find(n => n.id === 'guardJi'), 'TEST-ONLY release regression')"), true);
  assert.equal(guard.garrisonedOutpostId, undefined); assert.deepEqual(plain(r.api.state.contentState.outposts.waterMill.guardNpcIds), []);
  assert.equal(r.api.state.contentState.outposts.waterMill.status, 'vacant');
  r.api.updateNpcPerception(guard, 6); assert.equal(guard.perception.targetId, z.id);
  assert.equal(r.api.dayNpcCanAttack(guard), true); r.api.runDayCombat(12); assert.ok(z.hp < beforeHp);
});
test('real outpost release restores incoming enemy perception and damage eligibility', () => {
  const r = load(), guard = capturedGuard(r), z = incomingScene(r, guard);
  assert.equal(sourceEval(r, "releaseNpcFromOutpost(state.npcs.find(n => n.id === 'guardJi'), 'TEST-ONLY release incoming')"), true);
  assert.equal(sourceEval(r, 'dayEnemyTarget(state.worldZombies[0])')?.id, guard.id);
  sourceEval(r, 'updateEnemyPerception(state.worldZombies[0], 6)'); assert.equal(z.perception.targetId, guard.id);
  const hp = guard.hp; r.api.runDayCombat(12); assert.ok(guard.hp < hp);
});
test('actual writer loader roundtrip retains both contacts without changing saved resources', () => {
  const r = load(); sensed(r); const contact = plain(actor(r).perception), hp = r.api.state.hp;
  assert.equal(r.api.save(), true); const saved = r.storage.get(saveKey);
  assert.equal(r.api.validate({ raw: saved, sourceCategory: 'primary' }).ok, true);
  const second = startRuntime(factory, [[saveKey, saved]]); assert.equal(second.api.state.hp, hp);
  assert.deepEqual(plain(actor(second).perception), contact);
  assert.equal(second.api.state.worldMeta.events.filter(e => e.type === 'save.migrated').length, r.api.state.worldMeta.events.filter(e => e.type === 'save.migrated').length);
});
test('same original input and explicit sense/combat steps produce deterministic combat facts', () => {
  const play = () => { const r = load(); sensed(r); r.api.runDayCombat(12); return plain({ health: [r.api.state.hp, enemy(r).hp], perception: actor(r).perception,
    events: damage(r), rng: r.api.state.worldMeta.rngState }); };
  assert.deepEqual(play(), play());
});
const passed = checks.filter(row => row.ok).length;
const report={ runner: 'source-npc-threat-attention', ok: passed === checks.length, passed, count: checks.length,
  sourceHtmlSha256: sha(fs.readFileSync(htmlPath)), sourceFixtureSha256: sha(bytes), sourceCaptureHtmlSha256: meta.source.htmlSha256,
  originalReportSha256: meta.source.reportSha256, fixtureCapture: 'automation browser writer from failed run; not production',
  browserStarted: false, naturalGameplay: false, scope: 'actual complete inline loader/perception/combat/writer; Map IO and queued timers, explicit offline negative scenes',
  limitations: ['Direct perception then combat proves this attention defect; complete advance may change view direction/positions before combat, so this does not guarantee rescue during repeated training.',
    'Candidate camp combat membership excludes assigned outpost guards; damage/range/cadence/FOV unchanged, critical-health policy unchanged. Broader routine/motion/render membership is not covered. Original FAILED browser result is unchanged.'],
  offlineNegativeScenes: ['remove/move existing world threats; dead existing enemy/guard; turn existing guard; move existing wall; place existing quartermaster at guard viewpoint; night uses existing threat reference; frozen session modes; discover existing waterMill then actual captureOutpost/release for existing guardJi; declared coordinate isolation for incoming/outgoing combat'],
  observations, checks };
console.log(JSON.stringify(report,null,2));if(cli['--out'])fs.writeFileSync(cli['--out'],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
if (passed !== checks.length) process.exitCode = 1;
