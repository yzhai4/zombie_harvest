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
const patchedAdapter = adapter.slice(begin, end).replace('worldStart: startWorldSimulation,', 'dayCombat: runDayCombat, worldStart: startWorldSimulation,');
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

const output = { runner: 'source-daytime-combat', sourceHash: createHash('sha256').update(html).digest('hex'), ok: checks.every(item => item.ok), count: checks.length, passed: checks.filter(item => item.ok).length, checks };
console.log(JSON.stringify(output, null, 2));
process.exitCode = output.ok ? 0 : 1;

