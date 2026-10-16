#!/usr/bin/env node
/**
 * Execute the actual inline runtime's daytime combat slice in an isolated VM.
 * This is source/reducer evidence, not a browser playtest or production deploy.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = process.argv[2] && path.isAbsolute(process.argv[2]) ? process.argv[2] : path.join(root, 'dist', 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const adapter = readFileSync(path.join(root, 'scripts', 'check-report-recovery.mjs'), 'utf8');
const begin = adapter.indexOf('function runtime(entries = []) {');
const end = adapter.indexOf('\nfunction envelope(payload)', begin);
assert.ok(begin >= 0 && end > begin, 'runtime adapter boundary required');
const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(item => item[1]).filter(text => text.trim());
assert.equal(inline.length, 1, 'one inline runtime expected');
const patchedAdapter = adapter.slice(begin, end).replace('worldStart: startWorldSimulation,', 'dayCombat: runDayCombat, validateDayCombatIntent: validateDayCombatIntent, advance: advance, resolveEvent: resolveEvent, eventGateCheck: eventGateCheck, evaluateGateV1: evaluateGateV1, eventDefinitionGateCheck: eventDefinitionGateCheck, registerEventDefinition: registerEventDefinition, relayEventGate: relayEventGate, worldStart: startWorldSimulation,');
const runtime = vm.runInNewContext(`(${patchedAdapter.trim()})`, { inline, htmlPath, saveKey: 'zombie-harvest-progress-v12', vm, assert, console, URLSearchParams });
const clone = value => JSON.parse(JSON.stringify(value));
const events = (r, type) => r.api.state.worldMeta.events.filter(event => event.type === type);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const checks = [];
function check(name, run) { try { run(); checks.push({ name, ok: true }); } catch (error) { checks.push({ name, ok: false, error: String(error.message || error) }); } }
function fresh() { const r = runtime(); assert.equal(r.api.start().ok, true); return r; }

const r = fresh();
const state = r.api.state;
state.day = 1; state.hour = 8; state.minute = 0; state.night = false; state.world.totalMinutes = 480;
const guard = state.npcs.find(npc => npc.id === 'guardJi');
assert.ok(guard, 'guardJi fixture NPC required');
guard.supportRequested = true; guard.order = 'guard'; guard.behaviorState = 'alert'; guard.x = 16; guard.y = 8; guard.goal = { x: 17, y: 8 };
const tower = state.buildings.find(building => building.type === 'tower');
assert.ok(tower, 'tower fixture required');
tower.x = 18; tower.y = 6; tower.active = true;
const enemy = { id: 'day-enemy-1', x: 17, y: 8, hp: 100, maxHp: 100, kind: 'normal', aiState: 'pursue', goal: { x: guard.x, y: guard.y }, sourceEventId: 'event-day-combat-001', perception: { clock: 0, targetId: guard.id, targetAt: 480 } };
state.worldZombies = [enemy];
const beforeEnemy = enemy.hp, beforeNpc = guard.hp, beforeEvents = events(r, 'combat.damage.applied').length;
r.api.dayCombat(12);
check('NPC and tower damage a live daytime enemy', () => {
  assert.ok(enemy.hp < beforeEnemy, `enemy hp did not decrease: ${enemy.hp}`);
  assert.ok(events(r, 'combat.damage.applied').length >= beforeEvents + 2, 'expected NPC and tower receipts');
});
check('daytime enemy damages an active NPC', () => {
  assert.ok(guard.hp < beforeNpc, `NPC hp did not decrease: ${guard.hp}`);
  assert.equal(guard.combatHp, guard.hp);
  assert.ok(['injured', 'critical'].includes(guard.lifeState));
});
check('damage receipt preserves source, target, phase and event provenance', () => {
  const receipts = events(r, 'combat.damage.applied').slice(-3);
  assert.ok(receipts.every(event => event.payload.phase === 'DAY'));
  assert.ok(receipts.every(event => event.payload.schemaVersion === 'CombatIntentV1'));
  assert.ok(receipts.every(event => typeof event.payload.intentId === 'string' && event.payload.intentId.startsWith('day-')));
  assert.ok(receipts.every(event => Number.isInteger(event.payload.attackSeq)));
  assert.ok(receipts.some(event => event.payload.sourceKind === 'npc'));
  assert.ok(receipts.some(event => event.payload.sourceKind === 'tower'));
  assert.ok(receipts.some(event => event.payload.sourceEventId === 'event-day-combat-001'));
});
check('runtime uses the CombatIntentV1 contract and rejects malformed envelopes', () => {
  const valid = { schemaVersion: 'CombatIntentV1', intentId: 'contract-1', sourceRef: { id: 'npc-1', kind: 'npc' }, targetRef: { id: 'wz-1', kind: 'event-enemy' }, phase: 'DAY', attackSeq: 1, profileId: 'npc.guard.day', amount: 8, damageType: 'physical', sourceEventId: null };
  assert.equal(r.api.validateDayCombatIntent(valid).ok, true);
  assert.equal(r.api.validateDayCombatIntent({ ...valid, phase: 'NIGHT' }).ok, false);
  assert.equal(r.api.validateDayCombatIntent({ ...valid, statePatch: { hp: 999 } }).ok, false);
  assert.equal(r.api.validateDayCombatIntent({ ...valid, unknown: true }).ok, false);
});
check('inactive tower stops dealing daytime damage', () => {
  tower.active = false; guard.supportRequested = false; guard.behaviorState = 'work'; const hp = enemy.hp; r.api.dayCombat(24); assert.equal(enemy.hp, hp);
});
check('daytime enemy can damage an active tower', () => {
  state.night = false; tower.active = true; tower.hp = 10; tower.maxHp = 10; guard.x = 0; guard.y = 0; state.player.x = 0; state.player.y = 0; enemy.x = tower.x + 1; enemy.y = tower.y; enemy.goal = { x: tower.x, y: tower.y }; enemy.perception.targetId = tower.id; enemy.hp = 100; const before = tower.hp; r.api.dayCombat(12); assert.ok(tower.hp < before, `tower hp did not decrease: ${tower.hp}`); assert.equal(tower.active, true);
});
check('daytime enemy can damage a defensive wall', () => {
  const wall = state.buildings.find(building => building.type === 'wall'); assert.ok(wall, 'wall fixture required'); tower.active = false; wall.active = true; wall.x = 20; wall.y = 6; wall.hp = 3; enemy.x = wall.x - 1; enemy.y = wall.y; enemy.goal = { x: wall.x, y: wall.y }; enemy.perception.targetId = wall.id; const before = wall.hp; r.api.dayCombat(12); assert.ok(wall.hp < before, `wall hp did not decrease: ${wall.hp}`);
});
check('night gate prevents daytime combat re-entry', () => {
  tower.active = true; state.night = true; const hp = enemy.hp; const npcHp = guard.hp; r.api.dayCombat(24); assert.equal(enemy.hp, hp); assert.equal(guard.hp, npcHp);
});
check('save and reload do not replay daytime damage', () => {
  state.night = false; assert.equal(r.api.save(), true); const raw = r.storage.get('zombie-harvest-progress-v12'); const count = events(r, 'combat.damage.applied').length; const next = runtime([['zombie-harvest-progress-v12', raw]]); assert.equal(next.api.start().ok, true); assert.equal(events(next, 'combat.damage.applied').length, count); assert.equal(next.api.state.worldZombies[0].hp, enemy.hp);
});
check('identical daytime combat fixture yields a stable replay hash', () => {
  const run = () => { const q = fresh(); const s = q.api.state; const npc = s.npcs.find(item => item.id === 'guardJi'); const b = s.buildings.find(item => item.type === 'tower'); npc.supportRequested = true; npc.order = 'guard'; npc.behaviorState = 'alert'; npc.x = 16; npc.y = 8; npc.goal = { x: 17, y: 8 }; b.x = 18; b.y = 6; b.active = true; const z = { id: 'day-replay-enemy', x: 17, y: 8, hp: 100, maxHp: 100, kind: 'normal', aiState: 'pursue', goal: { x: npc.x, y: npc.y }, sourceEventId: 'event-replay-001', perception: { clock: 0, targetId: npc.id, targetAt: 480 } }; s.worldZombies = [z]; q.api.dayCombat(12); return digest({ worldZombies: s.worldZombies, npc: s.npcs.find(item => item.id === 'guardJi'), events: s.worldMeta.events.filter(event => event.type.startsWith('combat.')) }); };
  assert.equal(run(), run());
});
check('duplicate world.advance command does not apply daytime damage twice', () => {
  const q = fresh(); const s = q.api.state; const npc = s.npcs.find(item => item.id === 'guardJi'); const b = s.buildings.find(item => item.type === 'tower'); npc.supportRequested = true; npc.order = 'guard'; npc.behaviorState = 'alert'; npc.x = 16; npc.y = 8; npc.goal = { x: 17, y: 8 }; b.x = 18; b.y = 6; b.active = true; s.worldZombies = [{ id: 'day-command-enemy', x: 17, y: 8, hp: 100, maxHp: 100, kind: 'normal', aiState: 'pursue', goal: { x: npc.x, y: npc.y }, sourceEventId: 'event-command-001', perception: { clock: 0, targetId: npc.id, targetAt: 480 } }];
  const first = q.api.advance(12, { commandId: 'day-combat-command-1' }); assert.equal(first.ok, true); const hp = s.worldZombies[0].hp; const count = events(q, 'combat.damage.applied').length; const retry = q.api.advance(12, { commandId: 'day-combat-command-1' }); assert.equal(retry.duplicate, true); assert.equal(s.worldZombies[0].hp, hp); assert.equal(events(q, 'combat.damage.applied').length, count);
});
check('resolving an event cleans only its source combat targets', () => {
  const q = fresh(); const s = q.api.state; s.event = { id: 'supply', defId: 'supply', handled: false, a: 'a', b: 'b' }; s.eventInstance = { instanceId: 'event-cleanup-001', defId: 'supply', status: 'active' }; s.worldZombies = [{ id: 'event-cleanup-enemy', x: 20, y: 6, hp: 100, maxHp: 100, kind: 'normal', sourceEventId: 'event-cleanup-001' }, { id: 'other-event-enemy', x: 21, y: 6, hp: 100, maxHp: 100, kind: 'normal', sourceEventId: 'event-other-002' }]; const result = q.api.resolveEvent('a', { commandId: 'event-cleanup-command-1' }); assert.equal(result.ok, true); assert.equal(s.worldZombies.some(zombie => zombie.id === 'event-cleanup-enemy'), false); assert.equal(s.worldZombies.some(zombie => zombie.id === 'other-event-enemy'), true); assert.equal(events(q, 'combat.eventTargets.cleaned').length, 1);
  const receipt = events(q, 'event.resolved').at(-1); assert.ok(receipt, 'successful resolution receipt required'); assert.equal(receipt.payload.status, 'resolved'); assert.equal(receipt.payload.eventId, 'supply'); assert.equal(receipt.payload.instanceId, 'event-cleanup-001'); assert.equal(receipt.payload.expectedInstanceId, 'event-cleanup-001'); assert.equal(receipt.payload.expectedDefId, 'supply'); assert.equal(receipt.payload.expectedEventId, 'supply'); assert.equal(receipt.payload.definitionVersion, 1); assert.equal(receipt.definitionVersion, 1);
});
check('failed event resolution does not clean live combat targets', () => {
  const q = fresh(); const s = q.api.state; s.wood = 0; s.event = { id: 'storm', defId: 'storm', handled: false, a: 'a', b: 'b' }; s.eventInstance = { instanceId: 'event-cleanup-rejected-001', defId: 'storm', status: 'active' };
  s.worldZombies = [{ id: 'rejected-event-enemy', x: 20, y: 6, hp: 100, maxHp: 100, kind: 'normal', sourceEventId: 'event-cleanup-rejected-001' }];
  const result = q.api.resolveEvent('a', { commandId: 'event-cleanup-rejected-command-1' });
  assert.equal(result.ok, true);
  assert.equal(s.event.handled, false, 'resource rejection must keep the event active');
  assert.equal(s.worldZombies.some(zombie => zombie.id === 'rejected-event-enemy'), true, 'rejected resolve must preserve source targets');
  assert.equal(events(q, 'combat.eventTargets.cleaned').length, 0);
  assert.equal(events(q, 'event.resolved').length, 0, 'rejected effect must not emit success receipt');
  const receipt = events(q, 'event.resolve.rejected').at(-1); assert.ok(receipt, 'rejected resolution receipt required'); assert.equal(receipt.payload.status, 'rejected'); assert.equal(receipt.payload.reason, 'effect-rejected'); assert.equal(receipt.payload.eventId, 'storm'); assert.equal(receipt.payload.instanceId, 'event-cleanup-rejected-001'); assert.equal(receipt.payload.expectedInstanceId, 'event-cleanup-rejected-001');
});
check('stale event instance CAS rejects without reducer or cleanup', () => {
  const q = fresh(); const s = q.api.state; s.event = { id: 'supply', defId: 'supply', handled: false, a: 'a', b: 'b' }; s.eventInstance = { instanceId: 'event-cas-live-001', defId: 'supply', definitionVersion: 1, status: 'active' }; s.worldZombies = [{ id: 'cas-enemy', x: 20, y: 6, hp: 100, maxHp: 100, kind: 'normal', sourceEventId: 'event-cas-live-001' }];
  const result = q.api.resolveEvent('b', { commandId: 'event-cas-stale-command-1', expectedInstanceId: 'event-cas-old-000', expectedDefId: 'supply', expectedDefinitionVersion: 1, expectedEventId: 'supply' });
  assert.equal(result.ok, false); assert.equal(result.reason, 'event-instance-conflict'); assert.equal(s.event.handled, false); assert.equal(s.worldZombies[0].hp, 100); assert.equal(events(q, 'event.resolved').length, 0); assert.equal(events(q, 'combat.eventTargets.cleaned').length, 0); assert.equal(events(q, 'command.rejected').at(-1)?.payload?.reason, 'event-instance-conflict');
});
check('event definition version CAS rejects stale planner output', () => {
  const q = fresh(); const s = q.api.state; s.event = { id: 'supply', defId: 'supply', handled: false, a: 'a', b: 'b' }; s.eventInstance = { instanceId: 'event-cas-version-001', defId: 'supply', definitionVersion: 1, status: 'active' }; const beforeFood = s.food;
  const result = q.api.resolveEvent('b', { commandId: 'event-cas-version-command-1', expectedInstanceId: 'event-cas-version-001', expectedDefId: 'supply', expectedDefinitionVersion: 2, expectedEventId: 'supply' });
  assert.equal(result.ok, false); assert.equal(result.reason, 'event-definition-version-conflict'); assert.equal(s.event.handled, false); assert.equal(s.food, beforeFood); assert.equal(events(q, 'event.resolved').length, 0); assert.equal(events(q, 'command.rejected').at(-1)?.payload?.reason, 'event-definition-version-conflict');
});
check('EventDef and SAN definitions expose the opt-in GateV1 contract', () => {
  const q = fresh();
  const san = q.api.registry['npc.sanity'];
  const playerSan = q.api.registry['npc.sanity-player'];
  const relay = q.api.registry['relay-chain-001'];
  assert.equal(san.gateVersion, 1); assert.equal(san.evaluatePreconditions, true); assert.deepEqual(Array.from(san.gate.preconditions), ['npc.sanity <= 45']);
  assert.equal(playerSan.gateVersion, 1); assert.equal(playerSan.evaluatePreconditions, true); assert.deepEqual(Array.from(playerSan.gate.preconditions), ['player.sanity <= 30']);
  assert.equal(relay.gateVersion, 1); assert.equal(relay.evaluatePreconditions, true); assert.ok(Array.isArray(relay.preconditions));
  assert.ok(san.choices.every(choice => Array.isArray(choice.requires) && Array.isArray(choice.effects)));
});
check('GateV1 evaluates an NPC SAN event against its actor and fails closed', () => {
  const q = fresh(); const s = q.api.state; const npc = s.npcs.find(item => item.id === 'guardJi'); assert.ok(npc);
  s.night = false; s.event = { id: 'sanity.guardJi.1', defId: 'npc.sanity', handled: false, npcEvent: { npcId: npc.id, chainId: 'sanity', step: 0 } };
  s.eventInstance = { instanceId: 'sanity.guardJi.1', defId: 'npc.sanity', definitionVersion: 1, status: 'active', actorId: npc.id };
  npc.sanity = 40; const pass = q.api.eventGateCheck('a'); assert.equal(pass.ok, true); assert.equal(pass.gateVersion, 1);
  const before = JSON.stringify({ sanity: npc.sanity, events: s.worldMeta.events.length }); npc.sanity = 60; const fail = q.api.eventGateCheck('a'); assert.equal(fail.ok, false); assert.equal(fail.reason, 'event-precondition'); assert.equal(JSON.stringify({ sanity: npc.sanity, events: s.worldMeta.events.length }), JSON.stringify({ sanity: 60, events: JSON.parse(before).events }));
});
check('GateV1 evaluates the player SAN event without using an NPC actor', () => {
  const q = fresh(); const s = q.api.state;
  s.night = false; s.event = { id: 'sanity-player.1', defId: 'npc.sanity-player', handled: false, mentalEvent: 'player' };
  s.eventInstance = { instanceId: 'sanity-player.1', defId: 'npc.sanity-player', definitionVersion: 1, status: 'active', actorId: 'player-1' };
  s.sanity = 25; assert.equal(q.api.eventGateCheck('a').ok, true); s.sanity = 50; const fail = q.api.eventGateCheck('a'); assert.equal(fail.ok, false); assert.equal(fail.reason, 'event-precondition');
});
check('GateV1 choice.requires are evaluated independently and unknown conditions reject', () => {
  const q = fresh(); const s = q.api.state;
  q.api.registerEventDefinition({ id: 'gate.fixture', gateVersion: 1, phase: 'DAY', gate: { phase: 'DAY' }, choices: [{ id: 'a', label: '条件路线', requires: ['flag:gate.fixture.ready'] }] });
  s.contentState.flags['gate.fixture.ready'] = false; let result = q.api.eventDefinitionGateCheck('gate.fixture', 'a', { event: { id: 'gate.fixture' }, instance: { instanceId: 'gate-fixture-1', defId: 'gate.fixture', status: 'active', definitionVersion: 1 } });
  assert.equal(result.ok, false); assert.equal(result.reason, 'event-precondition');
  s.contentState.flags['gate.fixture.ready'] = true; result = q.api.eventDefinitionGateCheck('gate.fixture', 'a', { event: { id: 'gate.fixture' }, instance: { instanceId: 'gate-fixture-1', defId: 'gate.fixture', status: 'active', definitionVersion: 1 } }); assert.equal(result.ok, true);
  const unknown = q.api.evaluateGateV1({ version: 1, phase: 'DAY', preconditions: [{ type: 'future_condition', value: true }] }); assert.equal(unknown.ok, false); assert.equal(unknown.reason, 'event-precondition-invalid');
  const extra = q.api.evaluateGateV1({ version: 1, phase: 'DAY', preconditions: [{ type: 'flag', id: 'gate.fixture.ready', extra: true }] }); assert.equal(extra.ok, false); assert.equal(extra.reason, 'event-precondition-invalid');
  const unknownPath = q.api.evaluateGateV1({ version: 1, phase: 'DAY', preconditions: ['gameOver exists'] }); assert.equal(unknownPath.ok, false); assert.equal(unknownPath.reason, 'event-precondition-invalid');
  const malformedPhase = q.api.evaluateGateV1({ version: 1, phase: 'TWILIGHT', preconditions: [] }); assert.equal(malformedPhase.ok, false); assert.equal(malformedPhase.reason, 'gate-phase-invalid');
});
check('relay-chain-001 uses the same read-only GateV1 adapter', () => {
  const q = fresh(); const s = q.api.state; const before = JSON.stringify(s.relayProject);
  assert.equal(q.api.relayEventGate('handoff', 'player-1').ok, true);
  s.relayProject = null; const fail = q.api.relayEventGate('handoff', 'player-1'); assert.equal(fail.ok, false); assert.equal(fail.reason, 'event-precondition'); assert.equal(JSON.stringify(s.relayProject), 'null');
  s.relayProject = JSON.parse(before);
});
check('event CAS is checked before GateV1 preconditions', () => {
  const q = fresh(); const s = q.api.state; const npc = s.npcs.find(item => item.id === 'guardJi'); npc.sanity = 70;
  s.event = { id: 'sanity.guardJi.2', defId: 'npc.sanity', handled: false, npcEvent: { npcId: npc.id, chainId: 'sanity', step: 0 } };
  s.eventInstance = { instanceId: 'sanity.guardJi.2', defId: 'npc.sanity', definitionVersion: 1, status: 'active', actorId: npc.id };
  const result = q.api.resolveEvent('a', { commandId: 'gate-cas-order-1', expectedInstanceId: 'stale-instance', expectedDefId: 'npc.sanity', expectedDefinitionVersion: 1, expectedEventId: s.event.id });
  assert.equal(result.ok, false); assert.equal(result.reason, 'event-instance-conflict'); assert.equal(s.event.handled, false);
});
check('daily event buttons carry the full event CAS token', () => {
  assert.match(html, /button\.dataset\.eventDefId/); assert.match(html, /button\.dataset\.eventDefinitionVersion/); assert.match(html, /button\.dataset\.eventId/); assert.match(html, /resolveEvent\(choiceKey, eventChoiceExpectedToken\(displayed\)\)/);
});
check('queued NPC event activation does not leak or over-clean combat targets', () => {
  const q = fresh(); const s = q.api.state; const npc = s.npcs.find(item => item.id === 'guardJi'); assert.ok(npc, 'queued-event NPC fixture required');
  s.event = { id: 'supply', defId: 'supply', handled: false, a: 'a', b: 'b' };
  s.eventInstance = { instanceId: 'event-queued-source-001', defId: 'supply', status: 'active' };
  const queued = { id: 'npc.queued-source.002', npcId: npc.id, step: 0, openedAt: 480, status: 'queued', event: { id: 'npc.queued-source.002', defId: 'npc.gate-watch', handled: false, title: '排队守门', npcEvent: { npcId: npc.id, chainId: 'gate-watch', step: 0 } } };
  s.npcEvents = [queued];
  s.worldZombies = [
    { id: 'queued-source-enemy', x: 20, y: 6, hp: 100, maxHp: 100, kind: 'normal', sourceEventId: 'event-queued-source-001' },
    { id: 'queued-next-enemy', x: 21, y: 6, hp: 100, maxHp: 100, kind: 'normal', sourceEventId: queued.id },
    { id: 'unrelated-event-enemy', x: 22, y: 6, hp: 100, maxHp: 100, kind: 'normal', sourceEventId: 'event-other-003' }
  ];
  const result = q.api.resolveEvent('b', { commandId: 'event-queued-source-command-1' });
  assert.equal(result.ok, true);
  assert.equal(s.event?.id, queued.id, 'queued NPC event should become current');
  assert.equal(s.eventInstance?.instanceId, queued.id, 'new event instance should remain active');
  assert.equal(s.worldZombies.some(zombie => zombie.id === 'queued-source-enemy'), false, 'resolved source targets must be cleaned');
  assert.equal(s.worldZombies.some(zombie => zombie.id === 'queued-next-enemy'), true, 'new queued event targets must survive');
  assert.equal(s.worldZombies.some(zombie => zombie.id === 'unrelated-event-enemy'), true, 'unrelated event targets must survive');
  assert.equal(events(q, 'combat.eventTargets.cleaned').at(-1)?.payload?.instanceId, 'event-queued-source-001');
});

const output = { runner: 'source-daytime-combat', sourceHash: createHash('sha256').update(html).digest('hex'), ok: checks.every(item => item.ok), count: checks.length, passed: checks.filter(item => item.ok).length, checks };
console.log(JSON.stringify(output, null, 2));
process.exitCode = output.ok ? 0 : 1;
