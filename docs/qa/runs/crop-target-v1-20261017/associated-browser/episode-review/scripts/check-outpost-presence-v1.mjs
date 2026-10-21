import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sourceRuntimeFactory, root, saveKey, plain } from './lib/source-runtime-fixture.mjs';

const args = process.argv.slice(2);
assert.ok(args.length === 0 || args.length === 2 && args[0] === '--html' && path.isAbsolute(args[1]),
  'usage: node scripts/check-outpost-presence-v1.mjs [--html ABSOLUTE_HTML]');
const htmlPath = args[1] || path.join(root, 'dist/index.html');
const sha = value => createHash('sha256').update(value).digest('hex');
const meta = JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/npc-threat-attention-v1/capture-meta.json'), 'utf8'));
const fixtureBytes = fs.readFileSync(path.join(root, meta.fixture.path));
const fixtureRaw = fixtureBytes.toString('utf8'), fixture = JSON.parse(fixtureRaw);
const factory = sourceRuntimeFactory(htmlPath), checks = [];
const viewport = { x: 0, y: 0, cols: 36, rows: 24 };
const run = (r, source) => vm.runInContext(source, r.context);
const guard = r => r.api.state.npcs.find(n => n.id === 'guardJi');
const npc = (r, id) => r.api.state.npcs.find(n => n.id === id);
const events = (r, type, from = 0) => r.api.state.worldMeta.events.filter(e => e.seq > from && (!type || e.type === type));
function test(name, callback) {
  try { callback(); checks.push({ name, ok: true }); }
  catch (error) { checks.push({ name, ok: false, error: String(error.message || error) }); }
}

// Explicit QA exports only: reducers, gates, renderers and the CommandBus are
// the candidate's actual functions. The shared adapter's unrelated top-level
// HUD/world/context rendering remains suppressed; renderer cases below call
// the actual named renderer directly with declared DOM/Canvas IO.
function load(raw = fixtureRaw) {
  const r = factory([[saveKey, raw]]);
  assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true);
  assert.equal(r.api.start().ok, true); r.tasks.clear();
  run(r, `qa.presence = {
    discover: discoverLandmark, capture: captureOutpost,
    release(id) { return releaseNpcFromOutpost(state.npcs.find(n => n.id === id), 'TEST-ONLY presence release'); },
    getNpc, getNpcNear, interactionTargetAt, interactionCandidates,
    routine: updateNpcRoutine, motion: continuousMotionStep, work: campWorkPulse,
    layer: renderContinuousEntityLayer, canvas: renderActorsCanvas, survivors: renderSurvivors,
    interact: interactNpc, order: setNpcOrder, area: interactCampArea,
    campArea(zone) { return CAMP_AREAS.find(a => a.zone === zone); },
    ration: chargeDailyRation, foodSituation, upkeep: applyOutpostUpkeep,
    morning: runWorldDayUpkeep, population: outpostPopulationLedger,
    vote: planNpcVoteWeight, generatePlan: generatePlanMeeting,
    triggerEvent: triggerNpcEvent, activateQueued: activateQueuedNpcEvent, resolveDaily: resolveEvent,
    definition: eventDefinition,
    canOccupy: canOccupyContinuous,
    role: npcHasRole, fulfills: npcFulfillsRole, syncLife: syncNpcLifeState,
    kill(id) { const n = state.npcs.find(x => x.id === id); markNpcDead(n, { npcDeaths: 0 }, []); }
  };`);
  r.p = r.api.presence;
  const decorate = item => {
    item.style.setProperty = function (key, value) { this[key] = value; };
    item.appendChild = function (child) {
      if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(x => x !== child);
      this.children = this.children.filter(x => x !== child); this.children.push(child); child.parentNode = this; return child;
    };
    item.remove = function () {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this);
      this.parentNode = null;
    };
    return item;
  };
  const create = r.document.createElement;
  r.document.createElement = tag => decorate(create(tag));
  r.decorate = decorate;
  return r;
}
function isolated(r) {
  // A derived offline spatial scene: remove captured threats to isolate camp
  // membership, not to manufacture gameplay survival evidence.
  r.api.state.worldZombies = []; r.api.state.zombies = [];
  return r;
}
function nearLandmark(r, type) {
  const landmark = r.api.state.landmarks.find(item => item.type === type);
  assert.ok(landmark, 'existing authored landmark ' + type);
  r.api.state.player.x = landmark.x; r.api.state.player.y = landmark.y;
  if (!landmark.found) assert.equal(r.p.discover(landmark, { commandId: 'presence-discover-' + type }).ok, true);
  assert.equal(landmark.found, true);
  return landmark;
}
function capture(r, ids = ['guardJi'], type = 'waterMill') {
  isolated(r); nearLandmark(r, type);
  const result = r.p.capture(type, ids, { commandId: 'presence-capture-' + type });
  assert.equal(result.ok, true, 'real public capture succeeded');
  for (const id of ids) assert.equal(npc(r, id).garrisonedOutpostId, type);
  assert.deepEqual(plain(r.api.state.contentState.outposts[type].guardNpcIds), ids);
  r.tasks.clear(); return r;
}
function captured() { return capture(load()); }
function place(r, subject = guard(r)) {
  subject.x = 13; subject.y = 13;
  r.api.state.player.x = 12.5; r.api.state.player.y = 13;
  r.api.state.npcs.filter(n => n.id !== subject.id).forEach(n => { n.x = 0; n.y = 0; });
  return subject;
}
function moderate(r) {
  r.api.state.npcs.forEach(n => {
    n.needs = { ...n.needs, hunger: 40, fatigue: 30, stress: 30, social: 20, safety: 20, energy: 70 };
    n.needClock = 0; n.sanity = 60; n.sanityClock = 0;
  });
}
function persistent(r) {
  const s = r.api.state;
  return plain({ npcs: s.npcs, content: s.contentState, time: [s.day, s.hour, s.minute, s.world.totalMinutes],
    food: s.food, wood: s.wood, parts: s.parts, energy: s.energy, hp: s.hp, morale: s.morale,
    selectedNpc: s.selectedNpc, npcTalkOpen: s.npcTalkOpen });
}
function saved(r) {
  assert.equal(r.api.save({ force: true, reason: 'TEST-ONLY outpost presence' }), true);
  const raw = r.storage.get(saveKey);
  assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true);
  return raw;
}
function calendar(r, day) {
  const s = r.api.state; s.day = day; s.hour = 10; s.minute = 0;
  s.world.totalMinutes = (day - 1) * 1440 + 600;
}
function area(r, zone, commandId) {
  const target = r.p.campArea(zone); assert.ok(target);
  r.api.state.player.x = target.x; r.api.state.player.y = target.y;
  const result = r.p.area(target, { commandId }); r.tasks.clear(); return result;
}
function layer(r, previous = null) {
  const world = r.decorate(r.node('presence-world'));
  const element = previous || r.decorate(r.node('presence-layer'));
  r.p.layer(world, viewport, element);
  return element;
}
function canvas(r) {
  const calls = [], ctx = new Proxy({}, { get(object, key) {
    if (key in object) return object[key];
    return (...values) => { calls.push({ method: key, values }); };
  } });
  const item = { width: 0, height: 0, getContext(kind) { assert.equal(kind, '2d'); return ctx; } };
  const world = r.node('presence-canvas-world');
  world.querySelector = selector => selector === '.actor-canvas' ? item : null;
  // Image decoding is IO. An incomplete image exercises the real fallback
  // Canvas drawing code and keeps labels observable without a browser.
  r.context.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; } };
  r.p.canvas(world, viewport); return calls;
}

test('original full writer fixture provenance and immutable bytes', () => {
  assert.equal(meta.captureKind, 'automation-browser-writer-capture');
  assert.equal(meta.productionCapture, false); assert.equal(meta.naturalGameplayClaim, false);
  assert.equal(sha(fixtureBytes), meta.fixture.sha256);
  assert.equal(fixture.checksum, meta.fixture.checksum); assert.deepEqual(meta.offlineChanges, []);
  const r = load(); assert.equal(r.api.state.npcs.length, 10);
  assert.deepEqual(plain(r.api.state.npcs.map(n => n.id)), fixture.payload.npcs.map(n => n.id));
});
test('real discovery and CommandBus capture keep fixed roster and canonical guard assignment', () => {
  const r = captured(), s = r.api.state, population = r.p.population();
  assert.equal(s.npcs.length, 10); assert.equal(population.livingRoster, 10);
  assert.equal(population.campLocal, 9); assert.equal(population.garrisoned, 1);
  assert.ok(events(r, 'landmark.discovered').some(e => e.payload.landmarkType === 'waterMill'));
  const receipt = events(r, 'outpost.captured').find(e => e.payload.outpostId === 'waterMill');
  assert.ok(receipt); assert.equal(receipt.payload.energyCost, 6); assert.equal(receipt.payload.minutes, 30);
  assert.ok(s.worldMeta.replay.commands.some(c => c.commandId === receipt.commandId && c.type === 'outpost.capture'));
});
test('duplicate public capture never pays or assigns twice', () => {
  const r = captured(), before = persistent(r);
  assert.equal(r.p.capture('waterMill', ['guardJi'], { commandId: 'presence-capture-waterMill' }).duplicate, true);
  assert.deepEqual(persistent(r), before);
});
test('local NPC is a real nearby interaction and motion positive control', () => {
  const r = isolated(load()), g = place(r);
  assert.equal(r.p.getNpc(g.x, g.y)?.id, g.id); assert.equal(r.p.getNpcNear(g.x, g.y)?.id, g.id);
  assert.equal(r.p.interactionTargetAt(g.x, g.y)?.item?.id, g.id);
  r.api.state.player.x = 11; r.api.state.player.y = 11;
  g.motionTarget = { x: 14, y: 13 }; const before = g.x; r.p.motion(1); assert.ok(g.x > before);
});
test('assigned guard cannot occupy exact map or nearby camp target', () => {
  const r = captured(), g = place(r);
  assert.notEqual(r.p.getNpc(g.x, g.y)?.id, g.id);
  assert.notEqual(r.p.getNpcNear(g.x, g.y)?.id, g.id);
  assert.notEqual(r.p.interactionTargetAt(g.x, g.y)?.item?.id, g.id);
  assert.equal(r.p.interactionCandidates().some(t => t.kind === 'npc' && t.item.id === g.id), false);
});
test('assigned guard does not follow a stale camp motion target', () => {
  const r = captured(), g = place(r); r.api.state.player.x = 11; r.api.state.player.y = 11;
  g.motionTarget = { x: 14, y: 13 }; const before = { x: g.x, y: g.y, facing: g.facing };
  r.p.motion(2); assert.deepEqual({ x: g.x, y: g.y, facing: g.facing }, before);
});
test('assigned guard routine does not create camp destinations or work receipts', () => {
  const r = captured(); moderate(r); const g = guard(r), seq = r.api.state.worldMeta.eventSeq;
  delete g.motionTarget; const workSeq = g.workPulseSeq, history = plain(g.workHistory);
  r.p.routine(60);
  assert.equal(g.motionTarget == null, true); assert.equal(g.workPulseSeq, workSeq);
  assert.deepEqual(plain(g.workHistory), history);
  assert.equal(events(r, null, seq).some(e => ['npc.work.completed', 'npc.work.blocked'].includes(e.type) && e.payload.npcId === g.id), false);
});
test('direct camp work entry cannot award a remote pulse', () => {
  const r = captured(), g = guard(r), before = persistent(r);
  r.p.work(g); assert.deepEqual(persistent(r), before);
});
test('real DOM actor renderer removes an old marker after authentic capture', () => {
  const r = isolated(load()), g = place(r), drawn = layer(r);
  assert.ok(drawn.children.some(c => c.dataset.entityId === g.id));
  capture(r); place(r); layer(r, drawn);
  assert.equal(drawn.children.some(c => c.dataset.entityId === g.id), false);
});
test('real Canvas actor renderer omits assigned guard and draws a local control', () => {
  const local = isolated(load()), lg = place(local);
  assert.ok(canvas(local).some(c => c.method === 'fillText' && c.values[0] === lg.name));
  const remote = captured(), rg = place(remote);
  assert.equal(canvas(remote).some(c => c.method === 'fillText' && c.values[0] === rg.name), false);
});
test('roster metadata preserves the away survivor but its camp interaction card is disabled', () => {
  const r = captured(); place(r); r.p.survivors();
  assert.ok(String(r.node('npcRosterSummary').textContent).startsWith('10/10'));
  const html = r.node('survivorList').innerHTML;
  const tag = html.match(/<button[^>]*data-npc="guardJi"[^>]*>/)?.[0];
  assert.ok(tag); assert.match(tag, /\bdisabled\b/); assert.match(html, /驻守/);
});
for (const operation of ['interact', 'order']) test('public ' + operation + ' rejects assigned guard before local effects', () => {
  const r = captured(), g = place(r), before = persistent(r);
  const result = operation === 'interact' ? r.p.interact(g.id, { commandId: 'presence-away-interact' })
    : r.p.order(g.id, 'guard', { commandId: 'presence-away-order' });
  assert.equal(result.ok, false); assert.deepEqual(persistent(r), before);
  assert.ok(events(r, 'command.rejected').length > 0);
});
test('assignJob to assigned guard rejects and rolls preceding resource effect back', () => {
  const r = captured(), before = persistent(r);
  const result = r.api.contentEffects([{ op: 'addResource', key: 'food', value: 2 },
    { op: 'assignJob', key: 'carpenter', npcId: 'guardJi' }], { effectId: 'TEST-ONLY remote job rollback' });
  assert.equal(result.ok, false); assert.equal(result.rolledBack, true); assert.deepEqual(persistent(r), before);
});
test('camp dinner gives local benefits only while remote needs still advance', () => {
  const r = captured(); moderate(r); const g = guard(r), local = npc(r, 'guardChen');
  const hunger = g.needs.hunger, seq = r.api.state.worldMeta.eventSeq;
  const memory = plain(g.memory); assert.equal(area(r, 'residence', 'presence-dinner').ok, true);
  assert.ok(g.needs.hunger > hunger, 'remote hunger continues without dinner discount');
  assert.ok(local.needs.hunger < hunger - 20, 'local dinner actually happened');
  assert.deepEqual(plain(g.memory), memory);
  assert.equal(events(r, 'sanity.changed', seq).some(e => e.payload.targetId === g.id && e.payload.reason === '参加营地集体晚餐'), false);
});
test('barracks training excludes remote guard but benefits a local guard', () => {
  const r = captured(); moderate(r); const g = guard(r), local = npc(r, 'guardChen');
  const morale = g.morale, memory = plain(g.memory), localMorale = local.morale, seq = r.api.state.worldMeta.eventSeq;
  assert.equal(area(r, 'barracks', 'presence-training').ok, true);
  assert.equal(g.morale, morale); assert.deepEqual(plain(g.memory), memory); assert.ok(local.morale > localMorale);
  assert.equal(events(r, 'sanity.changed', seq).some(e => e.payload.targetId === g.id && e.payload.reason === '兵营换防训练'), false);
});
test('local infirmary does not heal an assigned injured guard', () => {
  const r = captured(), g = guard(r); g.hp = 20; r.p.syncLife(g); r.api.state.medicine = 2;
  const before = g.hp; assert.equal(area(r, 'infirmary', 'presence-infirmary').ok, true);
  assert.equal(g.hp, before); assert.equal(g.lifeState, 'critical');
});
test('morning local kitchen and logistics benefits do not reach assigned guard', () => {
  const r = captured(); moderate(r); const g = guard(r);
  npc(r, 'cook').bond = 1; npc(r, 'quartermaster').bond = 1;
  const before = plain(g.needs); calendar(r, 2);
  assert.equal(r.p.morning(), true);
  assert.equal(g.needs.hunger, before.hunger); assert.equal(g.needs.stress, before.stress);
  assert.ok(npc(r, 'guardChen').needs.hunger < before.hunger);
});
test('away guard keeps global personal needs and consumes one real shared ration', () => {
  const r = captured(); moderate(r); r.api.state.npcs.forEach(n => { n.needs.hunger = 10; });
  const g = guard(r); g.needs.hunger = 60; g.needClock = 0;
  const food = r.api.state.food, before = g.needs.hunger, seq = r.api.state.worldMeta.eventSeq;
  r.p.routine(60);
  assert.equal(r.api.state.food, food - 1); assert.ok(g.needs.hunger < before);
  const meals = events(r, 'npc.need.fulfilled', seq).filter(e => e.payload.npcId === g.id);
  assert.equal(meals.length, 1); assert.equal(meals[0].payload.food, 1); assert.equal(meals[0].actorId, g.id);
});
test('daily ration includes away roster and outpost facility upkeep charges independently once', () => {
  const r = captured(), count = r.api.state.npcs.filter(n => n.lifeState !== 'dead').length;
  assert.equal(r.p.foodSituation().population, count); assert.equal(count, 10);
  calendar(r, 2); const food = r.api.state.food;
  assert.equal(r.p.ration(), 3); assert.equal(r.api.state.food, food - 3);
  assert.equal(r.p.ration(), 0); r.p.upkeep(2);
  assert.equal(r.api.state.food, food - 4); r.p.upkeep(2); assert.equal(r.api.state.food, food - 4);
  assert.equal(r.api.state.contentState.outposts.waterMill.lastUpkeepResult, 'paid');
});
test('global daily food shortage still harms assigned survivor needs', () => {
  const r = captured(); moderate(r); const g = guard(r), hunger = g.needs.hunger;
  r.api.state.food = 0; calendar(r, 2); assert.equal(r.p.ration(), 3);
  assert.ok(g.needs.hunger > hunger); assert.ok(r.api.state.contentState.meters.campCollapse > 0);
});
test('night encounter excludes a genuinely captured guard even with declared stale support fields', () => {
  const r = captured(), g = guard(r), local = npc(r, 'guardChen');
  // Explicit stale legacy command fields; assignment itself was built only by
  // real discovery/capture, not a fabricated reverse marker.
  g.supportRequested = true; g.order = 'guard'; local.supportRequested = true; local.order = 'guard';
  const before = plain({ sanity: g.sanity, combatHp: g.combatHp, combatStatus: g.combatStatus });
  assert.equal(r.api.threatStart({ commandId: 'presence-night' }).ok, true);
  assert.equal(r.api.state.nightBattle.supportIds.includes(g.id), false);
  assert.equal(r.api.state.nightBattle.supportIds.includes(local.id), true);
  assert.deepEqual(plain({ sanity: g.sanity, combatHp: g.combatHp, combatStatus: g.combatStatus }), before);
});
test('ordinary assigned guard has no local role and no vote without altering population', () => {
  const r = captured(), g = guard(r);
  assert.equal(r.p.role(g, 'guardJi'), false); assert.equal(r.p.fulfills(g, 'guardJi'), false);
  assert.equal(r.p.vote(g), 0); assert.equal(r.p.population().livingRoster, 10);
});
test('declared accepted legacy hero-voter Gate input is excluded while assigned without a persistence claim', () => {
  const r = isolated(load()), payload = JSON.parse(saved(r)).payload;
  payload.npcs.find(n => n.id === 'guardJi').promotedTier = 'hero';
  assert.equal(r.api.validatePayload(payload).ok, true);
  assert.ok(r.api.prepare({ payload, sourceCategory: 'primary' }, r.api.classify(payload)));
  // normalizeNpc may discard this legacy designation. This explicit current
  // VM input tests only the existing vote consumer's camp-presence Gate.
  guard(r).promotedTier = 'hero'; assert.ok(r.p.vote(guard(r)) > 0);
  capture(r); assert.equal(r.p.vote(guard(r)), 0);
  calendar(r, 2); assert.equal(r.p.generatePlan({ source: 'TEST-ONLY presence legacy voter' }).ok, true);
  assert.equal(r.api.state.contentState.planMeeting.candidates.some(c => c.ballots.some(b => b.npcId === 'guardJi')), false);
  assert.equal(r.p.release('guardJi'), true); assert.ok(r.p.vote(guard(r)) > 0);
});
test('assigned guard cannot open a new local NPC event despite real pressure', () => {
  const r = captured(); moderate(r); const g = guard(r);
  g.needs.stress = 80; g.eventChain.cooldown = 0;
  const before = persistent(r), seq = r.api.state.worldMeta.eventSeq;
  assert.equal(r.p.triggerEvent(g), false); assert.deepEqual(persistent(r), before);
  assert.equal(events(r, 'npc.event.triggered', seq).some(e => e.payload.npcId === g.id), false);
});
function prepareNpcEvents(r, first = 'guardJi', second = null) {
  moderate(r); r.api.state.event = null; r.api.state.eventInstance = null; r.api.state.npcEvents = [];
  r.api.state.npcs.forEach(n => { n.eventChain.cooldown = 1000; });
  const primary = npc(r, first); primary.eventChain.cooldown = 0; primary.needs.stress = 80;
  assert.equal(r.p.triggerEvent(primary), true); assert.equal(r.api.state.event.npcEvent.npcId, first);
  if (second) {
    const queued = npc(r, second); queued.eventChain.cooldown = 0; queued.needs.stress = 80;
    assert.equal(r.p.triggerEvent(queued), true);
    assert.equal(r.api.state.npcEvents.find(e => e.npcId === second).status, 'queued');
  }
}
test('a real queued live NPC event defers while assigned and resumes its original identity after release', () => {
  const r = isolated(load()); prepareNpcEvents(r, 'guardJi', 'guardChen');
  const original = plain(r.api.state.npcEvents.find(e => e.npcId === 'guardChen'));
  const definitionVersion = r.p.definition(original.event.defId).definitionVersion;
  capture(r, ['guardChen']);
  if (r.api.state.event?.npcEvent?.npcId === 'guardJi' && !r.api.state.event.handled) {
    assert.equal(r.p.resolveDaily('b', { commandId: 'presence-resolve-local-queued-source' }).ok, true);
  }
  r.p.activateQueued();
  assert.notEqual(r.api.state.event?.npcEvent?.npcId === 'guardChen' && !r.api.state.event.handled, true);
  const record = r.api.state.npcEvents.find(e => e.id === original.id);
  assert.ok(record); assert.equal(record.status, 'queued');
  assert.equal(record.npcId, original.npcId); assert.deepEqual(plain(record.event), original.event);
  assert.equal(events(r, 'npc.event.resolved').some(e => e.payload.npcId === 'guardChen'), false);
  assert.equal(events(r, 'npc.event.cancelled').some(e => e.payload.eventId === original.id), false);
  assert.equal(r.p.release('guardChen'), true);
  // release may restore immediately; otherwise the unchanged queue activator
  // owns the same transition once the already-resolved local slot is free.
  if (r.api.state.event?.id !== original.id || r.api.state.event.handled) r.p.activateQueued();
  assert.equal(r.api.state.npcEvents.find(e => e.id === original.id).status, 'active');
  assert.deepEqual(plain(r.api.state.event), original.event);
  assert.equal(r.api.state.eventInstance.instanceId, original.instance?.instanceId || original.id);
  assert.equal(r.api.state.eventInstance.defId, original.event.defId);
  assert.equal(r.api.state.eventInstance.definitionVersion, original.instance?.definitionVersion || definitionVersion);
  assert.equal(r.api.state.eventInstance.actorId, original.npcId);
});

test('a real active live NPC event defers with no remote effects and resumes its exact token after release', () => {
  const r = isolated(load()); prepareNpcEvents(r);
  const originalEvent = plain(r.api.state.event), originalInstance = plain(r.api.state.eventInstance);
  const token = { expectedEventId: originalEvent.id, expectedInstanceId: originalInstance.instanceId,
    expectedDefId: originalInstance.defId, expectedDefinitionVersion: originalInstance.definitionVersion };
  capture(r); const g = guard(r), before = plain({ parts: r.api.state.parts, needs: g.needs,
    relations: g.relations, resolved: g.eventChain.resolved, step: g.eventChain.step, cooldown: g.eventChain.cooldown });
  // A previously displayed choice must not resolve an absent actor even if
  // its original compare-and-swap token remains in an old UI closure.
  r.p.resolveDaily('a', { ...token, commandId: 'presence-resolve-away-active' });
  assert.deepEqual(plain({ parts: r.api.state.parts, needs: g.needs, relations: g.relations,
    resolved: g.eventChain.resolved, step: g.eventChain.step, cooldown: g.eventChain.cooldown }), before);
  const record = r.api.state.npcEvents.find(e => e.id === originalEvent.id);
  assert.ok(record); assert.equal(record.status, 'queued');
  assert.deepEqual(plain(record.event), originalEvent);
  assert.equal(record.instance.instanceId, originalInstance.instanceId);
  assert.equal(record.instance.defId, originalInstance.defId);
  assert.equal(record.instance.definitionVersion, originalInstance.definitionVersion);
  assert.equal(record.instance.actorId, originalInstance.actorId);
  assert.equal(events(r, 'npc.event.resolved').some(e => e.payload.eventId === originalEvent.id), false);
  assert.equal(events(r, 'npc.event.cancelled').some(e => e.payload.eventId === originalEvent.id), false);
  assert.equal(r.p.release('guardJi'), true);
  if (r.api.state.event?.id !== originalEvent.id || r.api.state.event.handled) r.p.activateQueued();
  assert.equal(r.api.state.npcEvents.find(e => e.id === originalEvent.id).status, 'active');
  assert.deepEqual(plain(r.api.state.event), originalEvent);
  assert.equal(r.api.state.eventInstance.instanceId, originalInstance.instanceId);
  assert.equal(r.api.state.eventInstance.defId, originalInstance.defId);
  assert.equal(r.api.state.eventInstance.definitionVersion, originalInstance.definitionVersion);
  assert.equal(r.api.state.eventInstance.actorId, originalInstance.actorId);
});

test('local death has actual local witnesses but no remote witness memory or instant shock', () => {
  const r = captured(); moderate(r); const g = guard(r), local = npc(r, 'sergeant');
  const awayBefore = plain({ memory: g.memory, stress: g.needs.stress, sanity: g.sanity });
  const localWitnesses = local.memory.witnessedDeaths;
  r.p.kill('guardChen');
  assert.deepEqual(plain({ memory: g.memory, stress: g.needs.stress, sanity: g.sanity }), awayBefore);
  assert.equal(local.memory.witnessedDeaths, localWitnesses + 1);
});
function prepareVoterPlan(r) {
  guard(r).promotedTier = 'hero';
  const s = r.api.state; s.contentState.planMeeting.status = 'idle';
  assert.equal(r.p.generatePlan({ source: 'TEST-ONLY local legacy voter plan' }).ok, true);
  assert.ok(s.contentState.planMeeting.candidates.every(c => c.ballots.some(b => b.npcId === 'guardJi')));
  return s.contentState.planMeeting.instanceId;
}
test('real capture refreshes only an uncommitted current plan and release restores its local electorate', () => {
  const r = isolated(load()), instanceId = prepareVoterPlan(r), points = r.api.state.contentState.commandPoints;
  capture(r);
  assert.equal(r.api.state.contentState.planMeeting.instanceId, instanceId);
  assert.equal(r.api.state.contentState.planMeeting.status, 'candidate');
  assert.equal(r.api.state.contentState.planMeeting.candidates.some(c => c.ballots.some(b => b.npcId === 'guardJi')), false);
  assert.equal(r.api.state.contentState.commandPoints, points);
  assert.equal(r.p.release('guardJi'), true);
  assert.equal(r.api.state.contentState.planMeeting.instanceId, instanceId);
  assert.ok(r.api.state.contentState.planMeeting.candidates.every(c => c.ballots.some(b => b.npcId === 'guardJi')));
});
test('capture and release preserve an actual committed plan its spent CP and original receipt', () => {
  const r = isolated(load()); prepareVoterPlan(r);
  r.api.state.contentState.meters.campTrust = 80;
  r.api.state.contentState.commandPoints = 2; r.api.state.contentState.commandPointsMax = 4;
  assert.equal(r.api.commit('support', r.api.state.contentState.planMeeting.selectedId).ok, true);
  const plan = plain(r.api.state.contentState.planMeeting), points = r.api.state.contentState.commandPoints;
  const receipts = plain(events(r, 'plan.meeting.committed'));
  capture(r); assert.deepEqual(plain(r.api.state.contentState.planMeeting), plan);
  assert.equal(r.api.state.contentState.commandPoints, points);
  assert.equal(r.p.release('guardJi'), true);
  assert.deepEqual(plain(r.api.state.contentState.planMeeting), plan);
  assert.equal(r.api.state.contentState.commandPoints, points);
  assert.deepEqual(plain(events(r, 'plan.meeting.committed')), receipts);
});
function lastLocalScene() {
  const r = isolated(load());
  const keep = ['guardJi', 'guardChen', 'guardJiang'];
  r.api.state.npcs.filter(n => !keep.includes(n.id)).forEach(n => r.p.kill(n.id));
  capture(r, ['guardJi', 'guardChen']); nearLandmark(r, 'watchPost');
  assert.equal(r.p.population().livingRoster, 3); assert.equal(r.p.population().campLocal, 1);
  return r;
}
test('public capture rejects dispatching the last local survivor before cost or assignment', () => {
  const r = lastLocalScene(), before = persistent(r);
  assert.equal(r.p.capture('watchPost', ['guardJiang'], { commandId: 'presence-last-local' }).ok, false);
  assert.deepEqual(persistent(r), before); assert.equal(npc(r, 'guardJiang').garrisonedOutpostId, before.npcs.find(n => n.id === 'guardJiang').garrisonedOutpostId);
});
test('effect transaction also rejects the last local survivor and rolls earlier rewards back', () => {
  const r = lastLocalScene(), before = persistent(r);
  const result = r.api.contentEffects([{ op: 'addResource', key: 'food', value: 2 },
    { op: 'captureOutpost', key: 'watchPost', guardNpcIds: ['guardJiang'] }], { effectId: 'TEST-ONLY last-local-rollback' });
  assert.equal(result.ok, false); assert.equal(result.rolledBack, true); assert.deepEqual(persistent(r), before);
});
test('real writer reload keeps away population assignment and local map exclusion', () => {
  const r = captured(), beforeIds = r.api.state.npcs.map(n => n.id), reloaded = load(saved(r));
  assert.deepEqual(plain(reloaded.api.state.npcs.map(n => n.id)), plain(beforeIds));
  assert.equal(guard(reloaded).garrisonedOutpostId, 'waterMill');
  assert.deepEqual(plain(reloaded.api.state.contentState.outposts.waterMill.guardNpcIds), ['guardJi']);
  const g = place(reloaded); assert.notEqual(reloaded.p.getNpcNear(g.x, g.y)?.id, g.id);
});
test('real release restores local map renderer work and public order capability', () => {
  const r = captured(); assert.equal(r.p.release('guardJi'), true); const g = place(r);
  assert.equal(g.garrisonedOutpostId, undefined); assert.equal(r.p.population().campLocal, 10);
  assert.equal(r.p.getNpcNear(g.x, g.y)?.id, g.id); assert.ok(layer(r).children.some(c => c.dataset.entityId === g.id));
  moderate(r); g.supportRequested = false; g.combatStatus = 'ready';
  const seq = g.workPulseSeq; r.p.work(g); assert.equal(g.workPulseSeq, seq + 1);
  assert.equal(r.p.order(g.id, 'guard', { commandId: 'presence-released-order' }).ok, true);
  assert.equal(g.supportRequested, true);
});
test('real release selects a valid fallback from invalid legacy coordinates without restoring stale support', () => {
  const r = captured(), g = guard(r);
  g.x = -5; g.y = -5; g.supportRequested = true; g.order = 'guard'; g.currentOrder = 'guard';
  assert.equal(r.p.release(g.id), true);
  assert.equal(g.supportRequested, false); assert.equal(g.order == null, true); assert.equal(g.currentOrder == null, true);
  assert.equal(r.p.canOccupy(g, g.x, g.y), true);
  assert.ok(Number.isFinite(g.x) && Number.isFinite(g.y) && g.x >= 0 && g.y >= 0);
});

// Build stale ballots through actual generation and death, then use the full
// writer/validator/loader. No candidate receipt or candidate rows are invented.
function staleElectorateWriter({ trust = 80, points = 2 } = {}) {
  const r = isolated(load()), s = r.api.state;
  s.contentState.planMeeting.status = 'idle';
  assert.equal(r.p.generatePlan({ force: true, source: 'TEST-ONLY rejected-commit electorate' }).ok, true);
  assert.ok(s.contentState.planMeeting.candidates.every(c => c.ballots.some(b => b.npcId === 'commander')));
  r.p.kill('commander');
  s.contentState.meters.campTrust = trust;
  s.contentState.commandPoints = points; s.contentState.commandPointsMax = 4;
  const second = load(saved(r));
  assert.ok(second.api.state.contentState.planMeeting.candidates.every(c => c.ballots.some(b => b.npcId === 'commander')));
  return second;
}
for (const control of [
  { name: 'low trust', trust: 20, points: 2, action: 'support', reason: 'camp-trust-low' },
  { name: 'empty CP', trust: 80, points: 0, action: 'support', reason: 'command-points-empty' },
  { name: 'invalid action', trust: 80, points: 2, action: 'invalid', reason: 'plan-action-invalid' },
  { name: 'missing displayed target', trust: 80, points: 2, action: 'support', target: 'TEST-ONLY missing target', reason: 'plan-choice-missing' }
]) test('stale-electorate commit rejects ' + control.name + ' without publishing candidates or changing CP', () => {
  const r = staleElectorateWriter(control), s = r.api.state;
  const beforePlan = plain(s.contentState.planMeeting), points = s.contentState.commandPoints;
  for (let attempt = 0; attempt < 2; attempt++) {
    const seq = s.worldMeta.eventSeq;
    const result = r.api.commit(control.action, control.target || beforePlan.selectedId);
    assert.equal(result.ok, false); assert.equal(result.reason, control.reason);
    assert.deepEqual(plain(s.contentState.planMeeting), beforePlan); assert.equal(s.contentState.commandPoints, points);
    const emitted = events(r, null, seq);
    assert.equal(emitted.some(e => e.type.startsWith('plan.meeting.')), false);
    assert.ok(emitted.some(e => e.type === 'command.rejected' && e.payload.reason === control.reason));
  }
});
test('valid stale-electorate commit previews without mutation then publishes current ballots and spends CP once', () => {
  const r = staleElectorateWriter(), s = r.api.state, before = JSON.stringify(plain(s));
  const preview = run(r, 'calculatePlanMeetingCandidates()');
  assert.equal(JSON.stringify(plain(s)), before);
  assert.equal(preview.some(c => c.ballots.some(b => b.npcId === 'commander')), false);
  const target = s.contentState.planMeeting.selectedId, points = s.contentState.commandPoints, seq = s.worldMeta.eventSeq;
  assert.equal(r.api.commit('support', target).ok, true);
  assert.equal(s.contentState.planMeeting.status, 'committed'); assert.equal(s.contentState.planMeeting.playerAction, 'support');
  assert.equal(s.contentState.commandPoints, points - 1);
  assert.equal(s.contentState.planMeeting.candidates.some(c => c.ballots.some(b => b.npcId === 'commander')), false);
  assert.equal(events(r, 'plan.meeting.candidates', seq).length, 1); assert.equal(events(r, 'plan.meeting.committed', seq).length, 1);
  const committed = plain(s.contentState.planMeeting), afterSeq = s.worldMeta.eventSeq;
  assert.equal(r.api.commit('support', target).ok, false);
  assert.deepEqual(plain(s.contentState.planMeeting), committed); assert.equal(s.contentState.commandPoints, points - 1);
  assert.equal(events(r, 'plan.meeting.candidates', afterSeq).length, 0);
});
test('deferred dynamic event survives full writer reload and its real handleChoice can settle after release', () => {
  const r = isolated(load()); prepareNpcEvents(r);
  const eventId = r.api.state.event.id, original = plain(r.api.state.eventInstance);
  capture(r);
  const second = load(saved(r)), record = second.api.state.npcEvents.find(e => e.id === eventId);
  assert.equal(record.status, 'queued'); assert.deepEqual(plain(record.instance), original);
  assert.equal(second.p.release('guardJi'), true);
  assert.equal(second.api.state.event.id, eventId); assert.deepEqual(plain(second.api.state.eventInstance), original);
  assert.ok(second.api.registry[original.defId], 'actual boot registered the pending dynamic definition');
  const button = second.node('presence-restored-real-choice'); second.api.bindChoice(button, 'daily', 'a');
  run(second, "eventPanelSelection = 'daily'; eventPanelReceipt = null;");
  const parts = second.api.state.parts, seq = second.api.state.worldMeta.eventSeq;
  second.api.handleChoice('a', button.dataset);
  assert.equal(second.api.state.parts, parts - 1);
  assert.ok(events(second, 'npc.event.resolved', seq).some(e => e.payload.eventId === eventId && e.payload.npcId === 'guardJi'));
  assert.ok(events(second, 'event.resolved', seq).some(e => e.payload.eventId === eventId && e.instanceId === original.instanceId));
});

const passed = checks.filter(c => c.ok).length;
console.log(JSON.stringify({ runner: 'source-outpost-presence-v1', ok: passed === checks.length, passed, count: checks.length,
  sourceHtmlSha256: sha(fs.readFileSync(htmlPath)), sourceFixtureSha256: sha(fixtureBytes),
  runnerSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  sharedFixtureHelperSha256: sha(fs.readFileSync(path.join(root, 'scripts/lib/source-runtime-fixture.mjs'))),
  sourceIoAdapterSha256: sha(fs.readFileSync(path.join(root, 'scripts/check-report-recovery.mjs'))),
  fixtureProvenance: { kind: 'derived source-VM scenes from an immutable complete automation-browser writer capture',
    originalCaptureHtmlSha256: meta.source.htmlSha256, originalReportSha256: meta.source.reportSha256,
    productionCapture: false, originalReportOk: false, originalBytesChanged: false },
  browserStarted: false, naturalGameplay: false, balanceClaim: false,
  testedGateOrNamedRendererFunctionsMocked: false,
  runtimeScope: 'actual loader/writer, public discovery/capture/interaction/order/area CommandBus, true release, routine/motion, actual DOM/Canvas/roster renderers, effects, plan votes, shared rations and night start',
  ioOnly: ['shared source adapter suppresses unrelated top-level HUD/world/context render calls', 'renderer-specific DOM mutation/style API and incomplete Image/Canvas IO; named renderers execute unchanged', 'queued clocks are cleared between explicit steps'],
  derivedInputs: ['existing player/NPC geometry and removed existing threats for isolated membership checks',
    'existing NPC moderate need/resource/health preconditions', 'validator/loader-accepted raw legacy promotedTier format, explicitly applied only to the current VM vote Gate; no progression/persistence repair claim',
    'stale support/order fields on an authentically captured existing guard', 'real markNpcDead on seven existing core-role NPCs to test living3/campLocal1 boundary',
    'empty unrelated event slot and real triggerNpcEvent active/queue transitions; existing NPC pressure/cooldown preconditions',
    'uncommitted plan status reset for a new TEST-ONLY generation, existing trust/CP for an actual commit; no historical receipt fabricated',
    'invalid legacy coordinates on a genuinely captured guard to require a safe real release fallback',
    'explicit day2 source-VM calendar for daily ration/plan/upkeep; not natural time evidence'],
  limitations: ['No browser or natural gameplay was executed.', 'The shared food stock remains an authored global abstraction, not a simulated delivery system.',
    'Critical-health combat policy is unchanged and not newly certified.', 'Original failed A/B and frozen C browser reports are not changed or transferred to this candidate.'], checks }, null, 2));
if (passed !== checks.length) process.exitCode = 1;
