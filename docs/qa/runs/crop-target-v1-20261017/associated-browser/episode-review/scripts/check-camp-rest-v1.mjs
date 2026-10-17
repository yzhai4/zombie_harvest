#!/usr/bin/env node
/**
 * Camp rest source contracts. The complete actual inline runtime, CommandBus,
 * lifecycle, writer/loader, simulation, Gate and context renderer stay intact.
 * DOM/storage/clock scheduling are controlled IO; this is not a browser run or
 * natural gameplay evidence. Every modified scene is explicitly TEST-ONLY.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), options = {};
const usage = 'node scripts/check-camp-rest-v1.mjs [--html ABSOLUTE_HTML] [--mode baseline|candidate] [--out NEW_REPORT]';
assert.equal(args.length % 2, 0, usage);
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--html', '--mode', '--out'].includes(args[i]) && args[i + 1] && !options[args[i]], usage);
  options[args[i]] = args[i] === '--mode' ? args[i + 1] : path.resolve(args[i + 1]);
}
const mode = options['--mode'] || 'candidate';
assert.ok(['baseline', 'candidate'].includes(mode), usage);
const htmlPath = options['--html'] || path.join(root, 'dist/index.html');
if (options['--out']) assert.ok(!fs.existsSync(options['--out']), 'report must be new');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = fs.readFileSync(htmlPath), source = bytes.toString('utf8');
const inline = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
assert.equal(inline.length, 1); new vm.Script(inline[0]);
const adapterPath = path.join(root, 'scripts/check-report-recovery.mjs');
const adapterBytes = fs.readFileSync(adapterPath), adapter = adapterBytes.toString('utf8');
const a = adapter.indexOf('function runtime(entries = []) {'), b = adapter.indexOf('\nfunction envelope(payload)', a);
assert.ok(a >= 0 && b > a, 'actual IO adapter extraction markers');
let body = adapter.slice(a, b);
const exportMarker = '  const api = context.qa;\n  api.instrumentRendering();';
assert.equal(body.split(exportMarker).length, 2, 'capture real renderer before unrelated render suppression');
body = body.replace(exportMarker, `
  vm.runInContext(\`qa.rest = {
    available: typeof requestCampRest === 'function',
    request: typeof requestCampRest === 'function' ? requestCampRest : null,
    cancel: typeof cancelCampRest === 'function' ? cancelCampRest : null,
    gate: typeof restGate === 'function' ? restGate : null,
    controller: typeof CampRestController === 'object' ? CampRestController : null,
    context: renderContext, hud: renderHud, advance, startWorld: startWorldSimulation,
    generatePlan: generatePlanMeeting, worldMinute, perceive: updateEnemyPerception,
    simulateEnemies: simulateWorldZombies, damage: applyDayCombatDamage, playerDamage: applyDayPlayerDamage, renderEvent,
    get timers() { return { world: worldTimer }; }
  };\`, context);
  const api = context.qa;
  api.instrumentRendering();`);
const saveKey = 'zombie-harvest-progress-v12';
const factory = new Function('inline', 'htmlPath', 'vm', 'assert', 'saveKey', 'URLSearchParams', body + '\nreturn runtime;')
  (inline, htmlPath, vm, assert, saveKey, URLSearchParams);
const plain = value => JSON.parse(JSON.stringify(value));
const meta = JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/npc-threat-attention-v1/capture-meta.json'), 'utf8'));
const originalPath = path.join(root, meta.fixture.path), originalBytes = fs.readFileSync(originalPath);
assert.equal(hash(originalBytes), meta.fixture.sha256, 'immutable complete old browser writer bytes');
const originalRaw = originalBytes.toString('utf8'), originalPayload = JSON.parse(originalRaw).payload;
const checks = [], observations = {}, failures = [], artifacts = [];
const artifactDir = options['--out'] ? path.join(path.dirname(options['--out']), path.basename(options['--out'], '.json') + '-artifacts') : null;
if (artifactDir) { assert.ok(!fs.existsSync(artifactDir), 'artifact directory must be new'); fs.mkdirSync(artifactDir); }
const stepDelay = 200;
function test(name, run) {
  try { run(); checks.push({ name, ok: true }); }
  catch (error) { checks.push({ name, ok: false, error: `${error.name}: ${error.message}` }); failures.push(name); }
}
function events(r, type, after = 0) { return r.api.state.worldMeta.events.filter(e => e.seq > after && (!type || e.type === type)); }
function status(r) { return plain(r.api.rest.controller.status()); }
function minute(r) { return r.api.rest.worldMinute(); }
function scenePayload(change = () => {}) {
  const p = plain(originalPayload);
  // Offline TEST-ONLY derivation from a complete old writer, before boot. Keep
  // fixed identities and all unmentioned persistent domains. No receipt is made.
  // Move forwards from the captured 11:10 watermark, never before its ledger.
  p.day = 1; p.hour = 12; p.minute = 0; p.world.totalMinutes = 720;
  p.world.lastRationDay = 1; p.world.lastDailyUpkeepDay = 1;
  p.night = false; p.nightBattle = null; p.gameOver = null;
  p.player.x = 10; p.player.y = 11; p.energy = 40; p.hp = 70; p.sanity = 60; p.sanityClock = 0; p.food = 20;
  p.worldZombies = []; p.event.handled = true; p.npcEvents = [];
  p.worldMeta.clock.paused = false; p.worldMeta.clock.rate = 1;
  p.npcs.forEach(n => {
    n.needs = { ...n.needs, hunger: 20, fatigue: 25, stress: 15, energy: 70, social: 20, safety: 20 };
    n.needClock = 0; n.workClock = 0; n.sanity = 70; n.sanityClock = 0;
    n.eventChain.cooldown = 9999; n.eventChain.active = null;
  });
  change(p); return p;
}
function loadPayload(payload) {
  const signer = factory();
  const raw = JSON.stringify({ ...payload, payload, checksum: signer.api.hash(payload), savedAt: (payload.day - 1) * 1440 + payload.hour * 60 + payload.minute });
  const r = factory([[saveKey, raw]]);
  const validated = r.api.validate({ raw, sourceCategory: 'primary' });
  assert.equal(validated.ok, true, 'complete derived scene validates before boot: ' + validated.reason);
  assert.equal(r.api.start().ok, true); r.rest = r.api.rest; return r;
}
function fresh(change) { return loadPayload(scenePayload(change)); }
function business(r) { const p = plain(r.api.state); delete p.worldMeta; return p; }
function simulation(r) {
  const s = r.api.state;
  return plain(Object.fromEntries(['day', 'hour', 'minute', 'energy', 'hp', 'sanity', 'sanityClock', 'food', 'wood', 'stone', 'parts', 'medicine', 'seeds', 'morale', 'world', 'npcs', 'worldZombies', 'buildings', 'resources', 'contentState', 'relayProject', 'hordeForecast', 'roleVacancies'].map(k => [k, s[k]])));
}
function restTask(r) {
  const matches = [...r.tasks].filter(([, t]) => t.kind === 'timeout' && t.delay === stepDelay);
  assert.equal(matches.length, 1, 'exactly one controller step callback'); return matches[0];
}
function step(r) { const [id, task] = restTask(r); r.tasks.delete(id); r.instrumentation.now += stepDelay; task.callback(); }
function finish(r, limit = 65) { for (let i = 0; status(r).active && i < limit; i++) step(r); assert.equal(status(r).active, false, 'bounded rest ends'); }
function save(r, name = 'writer-' + (artifacts.length + 1)) {
  assert.equal(r.api.save(), true); const raw = r.storage.get(saveKey);
  assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true, 'actual writer complete output validates');
  if (artifactDir) fs.writeFileSync(path.join(artifactDir, name + '.json'), raw);
  artifacts.push({ name, ...(artifactDir ? { path: path.basename(artifactDir) + '/' + name + '.json' } : {}), sha256: hash(Buffer.from(raw)), actualWriter: true, testOnlyScene: true, receiptFabricated: false });
  return raw;
}
function reload(raw) {
  const r = factory([[saveKey, raw]]); assert.equal(r.api.start().ok, true); r.rest = r.api.rest; return r;
}
function noProgress(r, run) {
  const before = business(r), count = events(r, 'time.advanced').length;
  const result = run(); assert.equal(result.ok, false); assert.deepEqual(business(r), before);
  assert.equal(events(r, 'time.advanced').length, count); assert.equal(status(r).active, false);
  assert.equal([...r.tasks.values()].some(t => t.kind === 'timeout' && t.delay === stepDelay), false); return result;
}
function publicAction(r, action, extra = {}) {
  const button = r.node('TEST-ONLY-context-' + action); button.dataset = { contextAction: action, ...extra };
  button.closest = selector => selector === '[data-context-action]' ? button : null;
  r.emit('contextActions', 'click', { target: button }); return button;
}

test('exact old complete writer loads without changing fixed roster or stored resources', () => {
  const r = factory([[saveKey, originalRaw]]);
  assert.equal(r.api.validate({ raw: originalRaw, sourceCategory: 'primary' }).ok, true);
  assert.equal(r.api.start().ok, true);
  assert.deepEqual(plain(r.api.state.npcs.map(n => n.id)), originalPayload.npcs.map(n => n.id));
  for (const key of ['wood', 'stone', 'food', 'seeds', 'parts', 'medicine', 'hp', 'energy']) assert.equal(r.api.state[key], originalPayload[key]);
});
test('public encounter entry remains an encounter and cannot be called a calendar day', () => {
  const r = fresh(), before = minute(r), beforeSeq = r.api.state.worldMeta.eventSeq; r.emit('endDayBtn', 'click');
  assert.equal(minute(r), before); assert.equal(r.api.state.night, true); assert.equal(r.api.session.mode, 'BATTLE');
  assert.equal(events(r, 'threat.started', beforeSeq).length, 1);
});
test(mode === 'baseline' ? 'baseline exposes the actual passive-recovery fragmentation defect' : 'actual passive recovery is invariant under sixty one-minute partitions', () => {
  const one = fresh(), split = fresh(); one.rest.advance(60); for (let i = 0; i < 60; i++) split.rest.advance(1);
  observations.passiveRecovery = { one: one.api.state.energy - 40, split: split.api.state.energy - 40 };
  assert.equal(one.api.state.energy, 43);
  assert.equal(split.api.state.energy, mode === 'baseline' ? 40 : 43);
});
if (mode === 'baseline') {
  test('baseline has no public controlled rest API or context entry', () => {
    const r = fresh(); assert.equal(r.rest.available, false); r.rest.context();
    assert.doesNotMatch(r.node('contextActions').innerHTML, /data-context-action="rest"/);
  });
} else {
  test('candidate exposes the real request/cancel/Gate/controller functions', () => {
    const r = fresh(); assert.equal(r.rest.available, true);
    for (const name of ['request', 'cancel', 'gate']) assert.equal(typeof r.rest[name], 'function');
    assert.equal(typeof r.rest.controller.status, 'function'); assert.equal(status(r).active, false);
  });
  for (const value of [undefined, null, 0, -1, 1, 29, 31, 120, NaN, Infinity, '30', {}]) test(`unknown duration refuses without payment: ${String(value)}`, () => {
    const r = fresh(); assert.equal(r.rest.gate(value).ok, false); noProgress(r, () => r.rest.request(value));
  });
  for (const phase of ['START', 'BATTLE', 'REPORT', 'LOSS', 'RECOVERY', 'SAVING', 'EXITING', 'UNKNOWN']) test(`actual phase Gate refuses ${phase}`, () => {
    const r = fresh(); r.api.session.mode = phase; if (phase === 'BATTLE') r.api.state.night = true;
    noProgress(r, () => r.rest.request(30));
  });
  for (const [name, change] of [
    ['remote location', r => { r.api.state.player.x = 25; r.api.state.player.y = 20; }],
    ['missing shelter', r => { r.api.state.buildings = r.api.state.buildings.filter(b => b.type !== 'shelter'); }],
    ['paused clock', r => { r.api.state.worldMeta.clock.paused = true; }],
    ['non-unit clock rate', r => { r.api.state.worldMeta.clock.rate = 2; }],
    ['hidden document', r => { r.document.hidden = true; }],
    ['zero player HP', r => { r.api.state.hp = 0; }],
    ['terminal game', r => { r.api.state.gameOver = 'lose'; }],
  ]) test(`${name} refuses without resource/time payment`, () => { const r = fresh(); change(r); noProgress(r, () => r.rest.request(30)); });
  test('food zero and energy zero retain agency rather than inventing a rest lock', () => {
    const r = fresh(p => { p.food = 0; p.energy = 0; }); assert.equal(r.rest.gate(30).ok, true);
    assert.equal(r.rest.request(30).ok, true); step(r); assert.equal(minute(r), 721); r.rest.cancel();
  });
  test('calendar evening is still a legal DAY phase', () => {
    const r = fresh(p => { p.hour = 23; p.minute = 59; p.world.totalMinutes = 1439; });
    assert.equal(r.api.session.mode, 'DAY'); assert.equal(r.rest.gate(30).ok, true);
  });
  test('one controller step equals the actual one-minute simulation with NPC and enemy evolution', () => {
    const p = scenePayload(s => { s.worldZombies = [plain(originalPayload.worldZombies[0])]; s.worldZombies[0].x = 30; s.worldZombies[0].y = 5; s.worldZombies[0].think = 7; });
    const rest = loadPayload(p), direct = loadPayload(p), before = plain(rest.api.state.npcs[0].needs);
    assert.equal(rest.rest.request(30).ok, true); step(rest); assert.equal(direct.rest.advance(1).ok, true);
    assert.equal(minute(rest), 721); assert.notDeepEqual(plain(rest.api.state.npcs[0].needs), before);
    assert.deepEqual(simulation(rest), simulation(direct)); rest.rest.cancel();
  });
  test('normal thirty-minute completion matches thirty real steps with no shelter reward', () => {
    const rest = fresh(), direct = fresh(); assert.equal(rest.rest.request(30, { commandId: 'qa-rest-complete' }).ok, true);
    finish(rest); for (let i = 0; i < 30; i++) direct.rest.advance(1);
    assert.equal(status(rest).completed, 30); assert.equal(status(rest).reason, 'completed'); assert.equal(status(rest).remaining, 0); assert.equal(minute(rest), 750);
    assert.deepEqual(simulation(rest), simulation(direct));
    assert.equal(rest.api.state.hp, 70); assert.equal(rest.api.state.energy, 41);
    const recent = events(rest, 'time.advanced').filter(e => e.seq > originalPayload.worldMeta.eventSeq);
    assert.equal(recent.length, 30); assert.ok(recent.every(e => e.payload.minutes === 1));
    assert.equal(new Set(recent.map(e => e.commandId)).size, 30); save(rest);
  });
  test('sixty-minute completion applies the existing three-per-hour recovery', () => {
    const r = fresh(); assert.equal(r.rest.request(60).ok, true); finish(r);
    assert.equal(status(r).completed, 60); assert.equal(status(r).reason, 'completed'); assert.equal(status(r).remaining, 0); assert.equal(minute(r), 780); assert.equal(r.api.state.energy, 43);
  });
  test('passive recovery follows saved phase across reload without retroactive recovery or cap overflow', () => {
    const r = fresh(p => { p.minute = 19; p.world.totalMinutes = 739; });
    r.rest.advance(1); assert.equal(r.api.state.energy, 41); const raw = save(r), restored = reload(raw);
    assert.equal(restored.api.state.energy, 41); for (let i = 0; i < 19; i++) restored.rest.advance(1);
    assert.equal(restored.api.state.energy, 41); restored.rest.advance(1); assert.equal(restored.api.state.energy, 42);
    const cap = fresh(p => { p.energy = 99; }); for (let i = 0; i < 60; i++) cap.rest.advance(1); assert.equal(cap.api.state.energy, 100);
  });
  test('existing optional pending event retains its identity and does not ban waiting', () => {
    const r = fresh(p => { p.event.handled = false; }), id = r.api.state.event.id;
    assert.equal(r.rest.request(30).ok, true); step(r);
    assert.equal(status(r).active, true); assert.equal(r.api.state.event.id, id); assert.equal(r.api.state.event.handled, false); r.rest.cancel();
  });
  test('nearby actual living enemy refuses before a paid minute', () => {
    const r = fresh(p => { const z = plain(originalPayload.worldZombies[0]); z.x = 14; z.y = 11; z.aiState = 'wander'; z.perception = { clock: 0, targetId: null, targetAt: 0 }; p.worldZombies = [z]; });
    noProgress(r, () => r.rest.request(30));
  });
  test('actual recent enemy perception blocks a far pursuer without exposing its coordinates', () => {
    const r = fresh(p => { const z = plain(originalPayload.worldZombies[0]); z.x = 10; z.y = 11.1; z.goal = { x: 10, y: 11 }; z.aiState = 'wander'; z.perception = { clock: 0, targetId: null, targetAt: 0 }; p.worldZombies = [z]; p.npcs.forEach(n => { n.x = 0; n.y = 0; }); });
    const z = r.api.state.worldZombies[0]; r.rest.perceive(z, 6);
    assert.equal(z.perception.targetId, r.api.state.player.id, 'actual AI acquires player');
    z.x = 30; z.y = 5; const result = noProgress(r, () => r.rest.request(30));
    assert.equal(typeof result.reason, 'string'); assert.doesNotMatch(result.reason, /30|targetAt|targetId/);
  });
  test('unknown enemy kind fails closed rather than assuming a safe camp', () => {
    const r = fresh(); const z = plain(originalPayload.worldZombies[0]); z.kind = 'TEST-ONLY-unknown-enemy'; z.x = 30; z.y = 5; r.api.state.worldZombies = [z];
    noProgress(r, () => r.rest.request(30));
  });
  test('actual shelter context radius accepts 1.25 and rejects 1.251', () => {
    const boundary = fresh(p => { p.player.x = 10; p.player.y = 11.25; });
    assert.equal(boundary.rest.request(30).ok, true); boundary.rest.cancel();
    const beyond = fresh(p => { p.player.x = 10; p.player.y = 11.251; }); noProgress(beyond, () => beyond.rest.request(30));
  });
  test('enemy entering the danger boundary interrupts without deleting it or advancing another minute', () => {
    const r = fresh(); assert.equal(r.rest.request(30).ok, true); step(r);
    const z = plain(originalPayload.worldZombies[0]); z.x = 14; z.y = 11; z.perception = { clock: 0, targetId: null, targetAt: 0 }; r.api.state.worldZombies.push(z);
    const before = minute(r); step(r); assert.equal(status(r).active, false); assert.equal(status(r).completed, 1);
    assert.equal(minute(r), before); assert.equal(r.api.state.worldZombies.some(item => item.id === z.id), true);
  });
  test('real day damage to the player is retained and stops any next rest minute', () => {
    const r = fresh(); assert.equal(r.rest.request(30).ok, true);
    assert.equal(r.rest.playerDamage(plain(originalPayload.worldZombies[0]), 1).ok, true);
    const at = minute(r); step(r); assert.equal(status(r).active, false); assert.equal(minute(r), at); assert.equal(r.api.state.hp, 69);
    assert.ok(events(r, 'combat.damage.applied').some(e => e.payload.targetId === 'player-1' && e.payload.amount === 1));
  });
  test('real day damage to a local NPC remains visible and interrupts the controller', () => {
    const r = fresh(), n = r.api.state.npcs.find(item => item.id === 'sergeant'), hp = n.hp;
    assert.equal(r.rest.request(30).ok, true); assert.equal(r.rest.damage(plain(originalPayload.worldZombies[0]), n, 5).ok, true);
    const at = minute(r); step(r); assert.equal(status(r).active, false); assert.equal(minute(r), at); assert.equal(n.hp, hp - 5);
    assert.ok(events(r, 'combat.damage.applied').some(e => e.payload.targetId === n.id));
  });
  test('real local building damage is not repaired or hidden by a rest interruption', () => {
    const r = fresh(), building = r.api.state.buildings.find(item => item.type === 'bunker'), hp = building.hp;
    assert.equal(r.rest.request(30).ok, true); assert.equal(r.rest.damage(plain(originalPayload.worldZombies[0]), building, 1).ok, true);
    const at = minute(r); step(r); assert.equal(status(r).active, false); assert.equal(minute(r), at); assert.equal(building.hp, hp - 1);
  });
  test('a real NPC death reduces the same roster and stops rest without resurrection', () => {
    const r = fresh(), n = r.api.state.npcs.find(item => item.id === 'sergeant');
    assert.equal(r.rest.request(30).ok, true); assert.equal(r.rest.damage(plain(originalPayload.worldZombies[0]), n, 1000).ok, true);
    const at = minute(r); step(r); assert.equal(status(r).active, false); assert.equal(minute(r), at); assert.equal(n.lifeState, 'dead'); assert.equal(n.hp, 0);
    assert.equal(r.api.state.npcs.length, originalPayload.npcs.length); save(r);
  });
  test('healing followed by real damage is detected relative to the last confirmed step', () => {
    const r = fresh(); assert.equal(r.rest.request(30).ok, true);
    assert.equal(r.api.contentEffects([{ op: 'addResource', key: 'hp', value: 10 }], { effectId: 'TEST-ONLY-rest-heal' }).ok, true);
    step(r); assert.equal(r.api.state.hp, 80); assert.equal(status(r).active, true);
    assert.equal(r.rest.playerDamage(plain(originalPayload.worldZombies[0]), 1).ok, true);
    const at = minute(r); step(r); assert.equal(status(r).active, false); assert.equal(minute(r), at); assert.equal(r.api.state.hp, 79);
  });
  test('an NPC walking into the local radius is subsequently protected by the damage interruption', () => {
    const r = fresh(p => { const n = p.npcs.find(item => item.id === 'sergeant'); n.x = 10; n.y = 16.2; n.motionTarget = { x: 10, y: 12 }; n.simMoveClock = 0; });
    const n = r.api.state.npcs.find(item => item.id === 'sergeant'), beforeY = n.y;
    assert.equal(r.rest.request(30).ok, true);
    for (let i = 0; Math.hypot(n.x - 10, n.y - 11) > 5 && i < 10; i++) step(r);
    assert.ok(n.y < beforeY, 'actual rest simulation moved the NPC'); assert.ok(Math.hypot(n.x - 10, n.y - 11) <= 5, 'NPC entered local radius');
    assert.equal(status(r).active, true); const hp = n.hp; assert.equal(r.rest.damage(plain(originalPayload.worldZombies[0]), n, 1).ok, true);
    const at = minute(r); step(r); assert.equal(status(r).active, false); assert.equal(minute(r), at); assert.equal(n.hp, hp - 1);
  });
  test('actual local damage Gate cannot injure a garrisoned guard even at legacy nearby coordinates', () => {
    const r = fresh(p => { p.landmarks.find(l => l.type === 'waterMill').found = true; });
    assert.equal(r.api.contentEffects([{ op: 'captureOutpost', key: 'waterMill', guardNpcIds: ['guardJi'] }], { effectId: 'TEST-ONLY-rest-garrison' }).ok, true);
    const n = r.api.state.npcs.find(item => item.id === 'guardJi'); n.x = 10; n.y = 12; const hp = n.hp;
    assert.equal(n.garrisonedOutpostId, 'waterMill'); assert.equal(r.rest.request(30).ok, true);
    assert.equal(r.rest.damage(plain(originalPayload.worldZombies[0]), n, 1).reason, 'npc-not-in-camp'); assert.equal(n.hp, hp);
    step(r); assert.equal(status(r).active, true); assert.equal(n.hp, hp); r.rest.cancel();
  });
  for (const speed of [0, -1, 100, NaN, Infinity, '1']) test(`unsafe enemy speed fails closed: ${String(speed)}`, () => {
    const r = fresh(); const z = plain(originalPayload.worldZombies[0]); z.x = 30; z.y = 5; z.speedFactor = speed; r.api.state.worldZombies = [z];
    noProgress(r, () => r.rest.request(30));
  });
  test('cancel preserves exact partial progress and stale scheduled callback is inert', () => {
    const r = fresh(); assert.equal(r.rest.request(30).ok, true); step(r); step(r); step(r); const callback = restTask(r)[1].callback;
    assert.equal(r.rest.cancel().ok, true); assert.equal(status(r).active, false); assert.equal(status(r).completed, 3);
    const before = business(r), stopCount = events(r, 'camp.rest.stopped').length;
    callback(); assert.deepEqual(business(r), before); r.rest.cancel(); assert.equal(events(r, 'camp.rest.stopped').length, stopCount);
    assert.equal(minute(r), 723);
  });
  test('saved partial facts reload idle without replay, automatic restart or fabricated completion', () => {
    const r = fresh(); assert.equal(r.rest.request(30, { commandId: 'qa-rest-partial-save' }).ok, true);
    for (let i = 0; i < 7; i++) step(r); const raw = save(r, 'partial-seven-minutes-no-stop'), p = JSON.parse(raw).payload, restored = reload(raw);
    assert.equal(minute(restored), 727); assert.equal(status(restored).active, false);
    assert.equal(restored.api.state.energy, p.energy); assert.equal(restored.api.state.food, p.food);
    assert.equal(events(restored, 'camp.rest.stopped').length, events(r, 'camp.rest.stopped').length, 'loader does not invent a stop');
    assert.equal([...restored.tasks.values()].some(t => t.kind === 'timeout' && t.delay === stepDelay), false);
    const before = simulation(restored), result = restored.rest.request(30, { commandId: 'qa-rest-partial-save' });
    assert.equal(result.duplicate, true); assert.equal(status(restored).active, false); assert.deepEqual(simulation(restored), before);
    for (const key of ['rest', 'campRest', 'restState']) assert.equal(Object.hasOwn(p, key), false, 'no new persistent rest truth');
    assert.equal(p.version, 21); assert.equal(p.contentState.contentVersion, 3);
  });
  test('natural timer and a cancelled native callback cannot compete with rest ownership', () => {
    const r = fresh(), native = [...r.tasks.values()].find(t => t.kind === 'interval' && t.delay === 1200); assert.ok(native);
    assert.equal(r.rest.request(30).ok, true); const before = minute(r); r.instrumentation.now += 12000; native.callback();
    assert.equal(minute(r), before); assert.equal(status(r).completed, 0); step(r); assert.equal(minute(r), before + 1); r.rest.cancel();
    assert.equal([...r.tasks.values()].filter(t => t.kind === 'interval' && t.delay === 1200).length, 1);
  });
  test('hidden page stops partial rest and visible return never consumes its remaining rest budget', () => {
    const r = fresh(); assert.equal(r.rest.request(30).ok, true); step(r); step(r); const callback = restTask(r)[1].callback;
    r.document.hidden = true; r.emit('document', 'visibilitychange'); assert.equal(status(r).active, false); assert.equal(status(r).completed, 2);
    const before = minute(r); callback(); assert.equal(minute(r), before); assert.equal(r.api.validate({ raw: r.storage.get(saveKey), sourceCategory: 'primary' }).ok, true);
    r.instrumentation.now += 90000; r.document.hidden = false; r.emit('document', 'visibilitychange');
    assert.equal(status(r).active, false); assert.equal(status(r).completed, 2);
    assert.ok(minute(r) - before <= 1, 'only the original bounded background policy may run, not remaining rest');
  });
  test('pagehide stops and saves the applied watermark before public reload', () => {
    const r = fresh(); assert.equal(r.rest.request(30).ok, true); step(r); r.emit('window', 'pagehide');
    assert.equal(status(r).active, false); const restored = reload(r.storage.get(saveKey));
    assert.equal(minute(restored), 721); assert.equal(status(restored).active, false); assert.equal(events(restored, 'camp.rest.stopped').length, events(r, 'camp.rest.stopped').length);
  });
  for (const phase of ['REPORT', 'LOSS', 'RECOVERY']) test(`actual freeze ${phase} fences scheduled rest callbacks`, () => {
    const r = fresh(); assert.equal(r.rest.request(30).ok, true); const callback = restTask(r)[1].callback;
    r.api.session.freeze(phase); const before = minute(r); callback(); assert.equal(minute(r), before); assert.equal(status(r).active, false);
  });
  test('session generation change invalidates an already queued rest callback', () => {
    const r = fresh(); assert.equal(r.rest.request(30).ok, true); const callback = restTask(r)[1].callback, before = minute(r);
    r.api.session.generation += 1; callback(); assert.equal(minute(r), before); assert.equal(status(r).active, false);
  });
  test('actual public restart deletes saves and rest callbacks cannot recreate the exited session', () => {
    const r = fresh(); assert.equal(r.rest.request(30).ok, true); step(r); const callback = restTask(r)[1].callback;
    r.api.session.restart({ commandId: 'qa-rest-restart' }); assert.equal(r.instrumentation.reloads, 1); assert.equal(r.storage.size, 0);
    const before = minute(r); callback(); r.emit('window', 'pagehide'); assert.equal(minute(r), before); assert.equal(r.storage.size, 0);
    assert.equal(status(r).active, false); assert.equal(r.tasks.size, 0);
  });
  test('public encounter request cancels rest before entering the actual BATTLE clock', () => {
    const r = fresh(); assert.equal(r.rest.request(30).ok, true); step(r); const before = minute(r); r.emit('endDayBtn', 'click');
    assert.equal(status(r).active, false); assert.equal(r.api.session.mode, 'BATTLE'); assert.equal(minute(r), before);
  });
  test('exhausted automatic command budget refuses before an active instance or nested advance', () => {
    const r = fresh(); r.api.state.worldMeta.commandSeq = Number.MAX_SAFE_INTEGER - 1; noProgress(r, () => r.rest.request(30));
  });
  test('repeated request command is idempotent and cannot create a second timer or extend target', () => {
    const r = fresh(); assert.equal(r.rest.request(30, { commandId: 'qa-rest-duplicate' }).ok, true); step(r);
    const before = status(r), at = minute(r), count = events(r, 'camp.rest.started').length;
    assert.equal(r.rest.request(30, { commandId: 'qa-rest-duplicate' }).duplicate, true);
    assert.deepEqual(status(r), before); assert.equal(minute(r), at); assert.equal(events(r, 'camp.rest.started').length, count); restTask(r); r.rest.cancel();
  });
  test('real step CAS rejects wrong instance and stale progress without consuming time', () => {
    const r = fresh(); assert.equal(r.rest.request(30).ok, true); const start = status(r);
    const wrong = r.rest.controller.tick({ restId: 'TEST-ONLY-wrong-instance', expectedCompleted: 0, generation: start.generation, commandId: 'qa-rest-wrong-instance' });
    assert.equal(wrong.ok, false); assert.equal(minute(r), 720); assert.deepEqual(status(r), start);
    const first = r.rest.controller.tick({ restId: start.restId, expectedCompleted: 0, generation: start.generation, commandId: 'qa-rest-CAS-first' });
    assert.equal(first.ok, true); assert.equal(minute(r), 721); assert.equal(status(r).completed, 1);
    const before = status(r), count = events(r, 'camp.rest.stepped').length;
    const stale = r.rest.controller.tick({ restId: start.restId, expectedCompleted: 0, generation: start.generation, commandId: 'qa-rest-CAS-stale' });
    assert.equal(stale.ok, false); assert.equal(minute(r), 721); assert.deepEqual(status(r), before);
    r.rest.controller.tick({ restId: start.restId, expectedCompleted: 0, generation: start.generation, commandId: 'qa-rest-CAS-first' });
    assert.equal(minute(r), 721); assert.equal(events(r, 'camp.rest.stepped').length, count); r.rest.cancel();
  });
  test('step and actual advance receipts have unique IDs, one-minute payloads and exact parent causes', () => {
    const r = fresh(), startSeq = r.api.state.worldMeta.eventSeq; assert.equal(r.rest.request(30, { commandId: 'cmd-1000000' }).ok, true); step(r); step(r);
    const summary = status(r), steps = events(r, 'camp.rest.stepped', startSeq), advances = events(r, 'time.advanced', startSeq);
    assert.equal(steps.length, 2); assert.equal(advances.length, 2);
    for (let i = 0; i < 2; i++) {
      const parent = steps[i], child = advances[i]; assert.notEqual(parent.commandId, child.commandId); assert.equal(child.causationId, parent.commandId);
      assert.equal(parent.payload.restId, summary.restId); assert.equal(child.payload.restId, summary.restId); assert.equal(child.payload.minutes, 1);
      assert.equal(parent.payload.afterMinute - parent.payload.beforeMinute, 1); assert.equal(parent.payload.completed, i + 1);
      const replay = r.api.state.worldMeta.replay.commands.find(c => c.commandId === child.commandId);
      assert.equal(replay.type, 'world.advance'); assert.equal(replay.payload.restId, summary.restId); assert.equal(replay.payload.restStep, child.payload.restStep);
    }
    assert.equal(new Set([...steps, ...advances].map(e => e.commandId)).size, 4); r.rest.cancel(); save(r);
  });
  test('a real midnight step settles ration, plan, command points and the same crop once', () => {
    const p = scenePayload(s => {
      s.hour = 23; s.minute = 59; s.world.totalMinutes = 1439; s.contentState.meters.campTrust = 60;
      const garden = s.buildings.find(b => b.type === 'garden'); garden.planted = true; garden.growth = 1; garden.ready = false;
    });
    const rest = loadPayload(p), direct = loadPayload(p);
    rest.rest.generatePlan({ force: true, source: 'TEST-ONLY-midnight' }); direct.rest.generatePlan({ force: true, source: 'TEST-ONLY-midnight' });
    assert.equal(rest.rest.request(30).ok, true); step(rest); assert.equal(direct.rest.advance(1).ok, true);
    const s = rest.api.state, garden = s.buildings.find(b => b.type === 'garden');
    assert.equal(minute(rest), 1440); assert.equal(s.day, 2); assert.equal(s.hour, 0); assert.equal(s.minute, 0);
    assert.equal(s.world.lastRationDay, 2); assert.equal(s.world.lastDailyUpkeepDay, 2); assert.equal(s.food, 17);
    assert.equal(garden.growth, 2); assert.equal(garden.ready, true); assert.equal(s.contentState.commandPointsGrantedDay, 2);
    assert.equal(s.contentState.planMeeting.status, 'resolved'); save(direct); assert.deepEqual(simulation(rest), simulation(direct));
    assert.equal(status(rest).active, false, 'new actual daily event returns control'); assert.equal(status(rest).completed, 1);
    assert.equal(s.hp, 82, 'existing midnight upkeep supplies the twelve HP, not rest');
    const resolved = events(rest, 'plan.meeting.resolved').length, raw = save(rest), restored = reload(raw);
    restored.rest.advance(1); assert.equal(restored.api.state.food, 17); assert.equal(restored.api.state.buildings.find(b => b.id === garden.id).growth, 2);
    assert.equal(events(restored, 'plan.meeting.resolved').length, resolved); assert.equal(restored.api.state.contentState.commandPointsGrantedDay, 2);
  });
  test('midnight shortage remains real and a new shortage episode interrupts without granting food', () => {
    const r = fresh(p => { p.hour = 23; p.minute = 59; p.world.totalMinutes = 1439; p.food = 0; });
    const startSeq = r.api.state.worldMeta.eventSeq; assert.equal(r.rest.request(30).ok, true); step(r);
    assert.equal(minute(r), 1440); assert.equal(r.api.state.food, 0); assert.equal(r.api.state.world.lastRationDay, 2);
    assert.ok(r.api.state.contentState.appliedEffects.includes('camp:ration:2'));
    const ration = events(r, 'content.effects.applied', startSeq).find(e => e.payload.results?.some(effect => effect.key === 'campCollapse' && effect.after > effect.before));
    assert.ok(ration, 'actual shortage effect increased collapse before any separate plan effect'); assert.ok(r.api.state.contentState.activeChains['zh-food-shortage-001']);
    assert.equal(status(r).active, false); assert.equal(status(r).completed, 1); save(r);
  });
  test('actual context renderer publishes the public entry and actual click handler starts and cancels', () => {
    const r = fresh(); r.rest.context(); assert.match(r.node('contextActions').innerHTML, /data-context-action="campRest30"/);
    assert.match(r.node('contextActions').innerHTML, /data-context-action="campRest60"/);
    const before = minute(r); publicAction(r, 'campRest30'); assert.equal(status(r).active, true); assert.equal(minute(r), before);
    assert.equal(r.node('campRestCancel').hidden, false); assert.equal(r.node('campRestCancel').disabled, false);
    assert.match(r.node('campRestStatus').textContent, /0\/30/); step(r); assert.match(r.node('campRestStatus').textContent, /1\/30/);
    r.emit('campRestCancel', 'click'); assert.equal(status(r).active, false); assert.equal(r.node('campRestCancel').hidden, true);
    r.rest.context(); assert.match(r.node('contextActions').innerHTML, /data-context-action="campRest30"/);
  });
}
const report = {
  runner: 'source-camp-rest-v1', mode, sourceHtmlSha256: hash(bytes), checkerSha256: hash(fs.readFileSync(new URL(import.meta.url))), ioAdapterSha256: hash(adapterBytes),
  originalWriter: { path: meta.fixture.path, sha256: hash(originalBytes), sourceHtmlSha256: meta.source.htmlSha256, naturalGameplayClaim: false },
  derivation: { testOnly: true, baseScenesBeforeBoot: true, fields: ['calendar/world watermarks', 'player coordinate/HP/energy/SAN', 'food', 'enemy list or declared enemy position/clock', 'handled event', 'NPC needs/clocks/cooldown/positions', 'garden growth and campTrust for midnight scene', 'authored landmark found flag for genuine garrison setup'], afterBootNegativeInputs: ['session phase/generation', 'document visibility', 'clock pause/rate', 'enemy movement after actual perception', 'new enemy during rest', 'unknown enemy kind', 'command budget exhaustion', 'legacy nearby coordinates for genuine garrison guard'], actualSourceDiagnosticStimuli: ['applyDayCombatDamage for local NPC/building/death interruptions', 'applyDayPlayerDamage for player interruption', 'applyContentEffects for healing and genuine garrison assignment'], receiptsFabricated: false, fixedRosterPreserved: true },
  io: 'controlled DOM collections, storage, Date/performance and timer/RAF scheduling; final bootstrap Canvas render skipped; actual tested context renderer captured before unrelated render suppression',
  browserStarted: false, naturalGameplay: false, count: checks.length, ok: failures.length === 0, failures, checks, observations, artifacts,
};
if (options['--out']) fs.writeFileSync(options['--out'], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2)); process.exitCode = report.ok ? 0 : 1;
