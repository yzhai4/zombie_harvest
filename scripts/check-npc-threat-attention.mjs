import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sourceRuntimeFactory, startRuntime, root, saveKey, plain } from './lib/source-runtime-fixture.mjs';

const args = process.argv.slice(2);
assert.ok(args.length === 0 || args.length === 2 && args[0] === '--html' && path.isAbsolute(args[1]), 'usage: node scripts/check-npc-threat-attention.mjs [--html ABSOLUTE_HTML]');
const htmlPath = args[1] || path.join(root, 'dist/index.html');
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
function load() {
  const r = factory([[saveKey, raw]]);
  assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true);
  assert.equal(r.api.boot.classification, 'DAY');
  assert.equal(r.api.start().ok, true); r.tasks.clear();
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
  const r = load(), s = r.api.state;
  assert.equal(s.hp, 52); assert.equal(s.energy, 53); assert.equal(s.npcs.length, 10);
  for (const n of original.payload.npcs) {
    const loaded = s.npcs.find(item => item.id === n.id);
    for (const key of ['x', 'y', 'hp', 'lifeState', 'behaviorState', 'supportRequested']) assert.equal(loaded[key], n[key]);
  }
  assert.deepEqual(plain(s.worldZombies), original.payload.worldZombies);
  assert.equal(s.worldMeta.rngState, original.payload.worldMeta.rngState);
  assert.equal(s.worldMeta.eventSeq, original.payload.worldMeta.eventSeq);
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
console.log(JSON.stringify({ runner: 'source-npc-threat-attention', ok: passed === checks.length, passed, count: checks.length,
  sourceHtmlSha256: sha(fs.readFileSync(htmlPath)), sourceFixtureSha256: sha(bytes), sourceCaptureHtmlSha256: meta.source.htmlSha256,
  originalReportSha256: meta.source.reportSha256, fixtureCapture: 'automation browser writer from failed run; not production',
  browserStarted: false, naturalGameplay: false, scope: 'actual complete inline loader/perception/combat/writer; Map IO and queued timers, explicit offline negative scenes',
  limitations: ['Direct perception then combat proves this attention defect; complete advance may change view direction/positions before combat, so this does not guarantee rescue during repeated training.',
    'No source damage/range/cadence/health/role gate change; original FAILED browser result is unchanged.'],
  offlineNegativeScenes: ['remove/move existing world threats; dead existing enemy/guard; turn existing guard; move existing wall; place existing quartermaster at guard viewpoint; night uses existing threat reference; frozen session modes'],
  observations, checks }, null, 2));
if (passed !== checks.length) process.exitCode = 1;
