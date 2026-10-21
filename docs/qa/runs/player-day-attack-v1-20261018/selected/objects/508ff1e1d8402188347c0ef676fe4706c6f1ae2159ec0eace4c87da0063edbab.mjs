#!/usr/bin/env node
// Source VM, five grouped contracts. TEST-ONLY geometry is not natural gameplay.
// Execute complete source and the actual IO factory; never replace attack,
// target Gate, damage, CommandBus, time advancement, writer, or loader.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const usage = 'node check-player-day-attack-v1.mjs --repo-root ABS --html ABS --out ABS_REPORT [--io-adapter ABS] [--fixture ABS] [--expect-html-sha256 SHA] [--mode candidate|baseline]';
const opts = {}, args = process.argv.slice(2);
if (args.includes('--help')) { console.log(usage); process.exit(0); }
assert.equal(args.length % 2, 0, usage);
for (let i = 0; i < args.length; i += 2) {
  const key = args[i], value = args[i + 1];
  assert.ok(['--repo-root', '--html', '--out', '--io-adapter', '--fixture', '--expect-html-sha256', '--mode'].includes(key) && value && !(key in opts), usage);
  opts[key] = ['--expect-html-sha256', '--mode'].includes(key) ? value : path.resolve(value);
}
for (const key of ['--repo-root', '--html', '--out']) assert.ok(opts[key], usage);
const root = opts['--repo-root'], htmlPath = opts['--html'], out = opts['--out'];
const mode = opts['--mode'] || 'candidate';
assert.ok(['candidate', 'baseline'].includes(mode), usage);
const ioPath = opts['--io-adapter'] || path.join(root, 'scripts/check-report-recovery.mjs');
const fixturePath = opts['--fixture'] || path.join(root, 'docs/qa/runs/npc-rest-work-v1-20261018/legacy/objects/ebd2c2a6f1ab12b0e62dc6ba235231b4a229916759cdf1662c2594ed9ac4c7e6.json');
assert.ok(!existsSync(out), 'fresh report path required');
mkdirSync(path.dirname(out), { recursive: true });
const artifactDir = out + '.artifacts';
assert.ok(!existsSync(artifactDir), 'fresh artifact directory required');
mkdirSync(artifactDir);
const sha = value => createHash('sha256').update(value).digest('hex');
const htmlBytes = readFileSync(htmlPath), html = htmlBytes.toString('utf8'), sourceHtmlSha256 = sha(htmlBytes);
if (opts['--expect-html-sha256']) assert.equal(sourceHtmlSha256, opts['--expect-html-sha256'], 'explicit source SHA');
const ioBytes = readFileSync(ioPath), io = ioBytes.toString('utf8'), fixtureBytes = readFileSync(fixturePath);
const checkerPath = fileURLToPath(import.meta.url), checkerBytes = readFileSync(checkerPath);
const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(text => text.trim());
assert.equal(inline.length, 1, 'one complete inline source');
const begin = io.indexOf('function runtime(entries = []) {'), end = io.indexOf('\nfunction envelope(payload)', begin);
assert.ok(begin >= 0 && end > begin, 'actual IO extraction markers');
const originalFactory = io.slice(begin, end), marker = 'registry: EVENT_DEFS, hash: checksum,';
assert.equal(originalFactory.split(marker).length, 2, 'unique QA exposure marker');
const aliasSource = `playerAttack: {
  range: typeof PLAYER_DAY_ATTACK_RANGE === 'undefined' ? null : PLAYER_DAY_ATTACK_RANGE,
  resolve: typeof resolvePlayerDayAttackTarget === 'function' ? resolvePlayerDayAttackTarget : null,
  gate: typeof playerDayAttackGate === 'function' ? playerDayAttackGate : null,
  reasonText: typeof playerDayAttackReasonText === 'function' ? playerDayAttackReasonText : null,
  attack, nearest: attackNearestThreat,
  commandReducer: typeof attackCommandReducer === 'function' ? attackCommandReducer : null,
  reducer: attackReducer, renderContext, renderHud, advance, nightAttack,
  battlePosition: battleEnemyPosition, bus: CommandBus
}, ${marker}`;
const instrumentedFactory = originalFactory.replace(marker, aliasSource);
const saveKey = 'zombie-harvest-progress-v12';
const factory = vm.runInNewContext(`(${instrumentedFactory.trim()})`, { inline, htmlPath, saveKey, vm, assert, console, URLSearchParams });
const clone = value => JSON.parse(JSON.stringify(value));
const rows = [], checks = [], artifacts = [], runtimeRows = [];
let serial = 0;
const relative = file => path.relative(path.dirname(out), file).split(path.sep).join('/');
const ref = file => ({ path: relative(file), bytes: readFileSync(file).length, sha256: sha(readFileSync(file)) });
function artifact(name, data, raw = false) {
  const file = path.join(artifactDir, name);
  assert.ok(!existsSync(file), 'artifact must be new: ' + name);
  writeFileSync(file, raw ? data : JSON.stringify(data, null, 2) + '\n');
  const item = ref(file); artifacts.push(item); return item;
}
const originalWriter = artifact('original-writer.json', fixtureBytes, true);
function events(r, type, since = 0) { return r.api.state.worldMeta.events.filter(item => item.seq > since && (!type || item.type === type)); }
function business(r) {
  const s = r.api.state;
  return clone({ energy: s.energy, hp: s.hp, player: s.player, world: s.world, day: s.day, hour: s.hour, minute: s.minute,
    weapon: s.weapon, wood: s.wood, stone: s.stone, parts: s.parts, food: s.food, seeds: s.seeds, medicine: s.medicine,
    kills: s.zombieKills, morale: s.morale, sanity: s.sanity, zombies: s.worldZombies, battleZombies: s.zombies,
    npcs: s.npcs, buildings: s.buildings, specialItems: s.specialItems, contentState: s.contentState,
    relay: s.relayProject, target: s.combatTargetId, action: s.playerAction, actionUntil: s.playerActionUntil });
}
function record(label, evidence) { rows.push({ label, ...clone(evidence) }); }
function runGroup(name, run) {
  const before = rows.length;
  try { run(); checks.push({ name, ok: true, evidence: rows.slice(before) }); }
  catch (error) { checks.push({ name, ok: false, error: String(error.message || error), evidence: rows.slice(before) }); }
}
function validNative(r, name) {
  assert.equal(r.api.save(), true, 'actual normal writer');
  const raw = r.storage.get(saveKey);
  const validation = r.api.validate({ raw, sourceCategory: 'primary' });
  assert.equal(validation.ok, true, 'actual source validates writer: ' + JSON.stringify(validation));
  return { raw, payload: JSON.parse(raw).payload, artifact: artifact(name, raw, true) };
}
function runtime(raw, label) {
  const r = factory([[saveKey, raw]]);
  const validation = r.api.validate({ raw, sourceCategory: 'primary' });
  assert.equal(validation.ok, true, 'complete fixture actual validation: ' + label + ':' + JSON.stringify(validation));
  const started = r.api.start();
  assert.equal(started.ok, true, 'actual Continue: ' + label);
  // Controlled timer API only: do not execute queued natural callbacks while a
  // synchronous source contract is being measured. Explicit advance is real.
  r.tasks.clear();
  assert.equal(r.api.session.mode, 'DAY');
  runtimeRows.push({ label, start: clone(started), roster: r.api.state.npcs.map(n => n.id), enemyIds: r.api.state.worldZombies.map(z => z.id) });
  return r;
}
const originalRaw = fixtureBytes.toString('utf8');
const ancestryRuntime = runtime(originalRaw, 'original-old-writer');
assert.equal(ancestryRuntime.api.state.npcs.length, 10, 'original ten-person roster');
assert.deepEqual(ancestryRuntime.api.state.worldZombies.map(z => z.id), ['wz-1', 'wz-2', 'wz-3', 'wz-4']);
const currentBaseline = validNative(ancestryRuntime, 'old-writer-after-actual-Continue-current-native.json');
const baselinePayload = clone(currentBaseline.payload);
function payloadChanges(before, after, prefix = '') {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object' || Array.isArray(before) !== Array.isArray(after)) return [{ path: prefix, before, after }];
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().flatMap(key => payloadChanges(before[key], after[key], prefix ? prefix + '.' + key : key));
}
function scene(name, { distance = 1, hp = 100, energy = 78, second = false, paused = false, minute = 0, rate = 1 } = {}) {
  const p = clone(baselinePayload), a = p.worldZombies.find(z => z.id === 'wz-4');
  assert.ok(a);
  // Offline TEST-ONLY input geometry. Retain every original NPC/enemy and all
  // resources, authored weapon stats, AI/perception, routine, and damage rules.
  p.player.x = 1; p.player.y = 20; a.x = 1 + distance; a.y = 20; a.hp = hp;
  p.energy = energy; p.worldMeta.clock.paused = paused; p.worldMeta.clock.rate = rate;
  p.minute = minute; p.world.totalMinutes = (p.day - 1) * 1440 + p.hour * 60 + minute;
  if (second) { const b = p.worldZombies.find(z => z.id === 'wz-1'); b.x = 1.6; b.y = 20; }
  const checksum = ancestryRuntime.api.hash(p);
  const raw = JSON.stringify({ version: p.version, payload: p, checksum, savedAt: p.world.totalMinutes, reason: 'TEST-ONLY player attack input' });
  const input = artifact(`${String(++serial).padStart(3, '0')}-${name}-input.json`, raw, true);
  const r = runtime(raw, name);
  assert.equal(r.api.state.npcs.length, 10);
  assert.equal(r.api.state.worldZombies.length, 4);
  r.scene = { name, input, changes: payloadChanges(baselinePayload, p), targetId: a.id, testOnly: true };
  return r;
}
function requireFeature(r) {
  const p = r.api.playerAttack;
  assert.equal(p.range, 1.15, 'fixed DAY range');
  for (const key of ['resolve', 'gate', 'reasonText', 'commandReducer']) assert.equal(typeof p[key], 'function', 'actual new API missing: ' + key);
  return p;
}
function renderAttackButton(r) {
  r.api.playerAttack.renderContext();
  const markup = r.node('contextActions').innerHTML;
  const tag = [...markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(match => /data-context-action="attack"/.test(match[1]));
  assert.ok(tag, 'actual renderer creates attack affordance');
  const attrs = Object.fromEntries([...tag[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
  const dataset = Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]));
  const button = { dataset, disabled: /\sdisabled(?:\s|$)/.test(tag[1]), closest(selector) { return selector === '[data-context-action]' ? this : null; } };
  button.click = () => { if (!button.disabled) r.emit('contextActions', 'click', { target: button }); };
  // The IO DOM deliberately does not parse innerHTML. Read the actual generated
  // feedback string, not an unrelated getElementById placeholder node.
  const feedback = markup.match(/<p\b[^>]*id="playerAttackFeedback"[^>]*>([\s\S]*?)<\/p>/)?.[1].replace(/<[^>]*>/g, '') || '';
  return { button, markup, feedback, attributes: attrs };
}
function emitKey(r, key) { r.emit('document', 'keydown', { key, repeat: false, target: { tagName: 'DIV' } }); }
function reject(r, targetId, reason, name, trigger = null) {
  const before = business(r), seq = r.api.state.worldMeta.eventSeq;
  const result = trigger ? trigger() : r.api.playerAttack.attack({ targetId, commandId: name });
  if (result) { assert.equal(result.ok, false); assert.equal(result.reason, reason); }
  const rejected = events(r, 'command.rejected', seq);
  assert.equal(rejected.length, 1, 'one typed rejection');
  assert.equal(rejected[0].payload.reason, reason);
  assert.equal(events(r, 'threat.attacked', seq).length, 0, 'no false success');
  assert.equal(events(r, 'time.advanced', seq).length, 0, 'no failed-action time');
  assert.deepEqual(business(r), before, 'no payment, target change, damage, animation, reward or progress');
  record(name, { fixture: r.scene, result, rejected });
}
function proof(r, result, before, targetId, { killed = false, paused = false, damage = 50, expectedMinutes = 10 } = {}) {
  assert.equal(result.ok, true); assert.notEqual(result.duplicate, true);
  const s = r.api.state, p = result.result;
  assert.equal(p?.proofVersion, 1); assert.deepEqual(clone(result.event.payload), clone(p));
  assert.equal(p.targetId, targetId); assert.equal(p.target.id, targetId); assert.equal(p.weaponId, 'rustAxe');
  assert.equal(p.hit.damage, damage); assert.equal(p.hit.beforeHp, before.targetHp); assert.equal(p.hit.afterHp, before.targetHp - damage);
  assert.equal(p.target.before.id, targetId); assert.equal(p.target.afterHit.id, targetId); assert.equal(p.target.afterAdvance.id, targetId);
  assert.equal(p.target.afterHit.hp, p.hit.afterHp);
  assert.equal(typeof p.target.presentAtCompletion, 'boolean');
  assert.deepEqual(clone(p.payment.cost), { energy: 5 }); assert.equal(p.payment.before.energy, before.energy); assert.equal(p.payment.after.energy, before.energy - 5);
  assert.equal(p.clock.before.world, before.minute); assert.equal(p.clock.after.world, s.world.totalMinutes);
  assert.equal(p.clock.requestedMinutes, 10); assert.equal(p.clock.elapsedMinutes, paused ? 0 : expectedMinutes);
  assert.equal(s.world.totalMinutes - before.minute, paused ? 0 : expectedMinutes);
  assert.equal(p.advance.ok, true); assert.equal(p.advance.paused, paused); assert.equal(p.advance.minutes, paused ? 0 : expectedMinutes);
  assert.equal(p.outcome.killed, killed); assert.equal(p.outcome.salvage, 0);
  assert.equal(p.outcome.retaliationDamage, killed ? 0 : 8, 'authored normal enemy direct retaliation, independent of world damage');
  const parent = s.worldMeta.replay.commands.find(c => c.commandId === result.commandId);
  assert.equal(parent.type, 'threat.attack'); assert.equal(parent.actorId, 'player-1'); assert.equal(parent.payload.targetId, targetId);
  assert.equal(result.event.type, 'threat.attacked'); assert.equal(result.event.actorId, 'player-1'); assert.equal(result.event.commandId, result.commandId);
  if (paused) {
    assert.equal(p.advance.commandId, null); assert.equal(p.advance.eventId, null); assert.equal(p.advance.causationId, null);
    assert.equal(events(r, 'time.advanced', before.seq).length, 0);
  } else {
    const advanced = events(r, 'time.advanced', before.seq).filter(e => e.commandId === p.advance.commandId);
    assert.equal(advanced.length, 1); assert.equal(advanced[0].eventId, p.advance.eventId); assert.equal(advanced[0].causationId, result.commandId);
    assert.equal(p.advance.causationId, result.commandId); assert.equal(advanced[0].payload.minutes, expectedMinutes);
    const child = s.worldMeta.replay.commands.find(c => c.commandId === p.advance.commandId);
    assert.equal(child.type, 'world.advance'); assert.equal(child.payload.minutes, expectedMinutes); assert.notEqual(child.commandId, result.commandId);
  }
  record('actual-success-proof', { fixture: r.scene, result: clone(result), finalEnergy: s.energy, finalHp: s.hp, damageEvents: events(r, 'combat.damage.applied', before.seq) });
  return p;
}
function beforeHit(r, id = 'wz-4') { const s = r.api.state; return { minute: s.world.totalMinutes, seq: s.worldMeta.eventSeq, energy: s.energy, targetHp: s.worldZombies.find(z => z.id === id).hp }; }

runGroup('1. Actual renderer and submission agree at 1.15, outside/low-energy typed refusals', () => {
  // This diagnostic deliberately uses only pre-existing public consumers. Old
  // source must reach real render + dispatch, rather than fail on a new alias.
  const outside = scene('public-old-new-1.19', { distance: 1.19 });
  const uiOutside = renderAttackButton(outside), outsideBefore = business(outside), outsideSeq = outside.api.state.worldMeta.eventSeq;
  const outsideResult = outside.api.playerAttack.attack({ targetId: 'wz-4', commandId: 'public-outside-1.19' });
  record('outside-actual-public-consumers', { fixture: outside.scene, disabled: uiOutside.button.disabled,
    attributes: uiOutside.attributes, feedback: uiOutside.feedback, actualReturn: outsideResult,
    actualNewEvents: events(outside, null, outsideSeq), beforeBusiness: outsideBefore, afterBusiness: business(outside) });
  assert.equal(uiOutside.button.disabled, true, '1.19 public affordance disabled');
  assert.equal(outsideResult?.ok, false, '1.19 actual wrapper refuses instead of empty success');
  assert.equal(outsideResult.reason, 'attack-too-far');
  assert.equal(events(outside, 'threat.attacked', outsideSeq).length, 0);
  assert.equal(events(outside, 'time.advanced', outsideSeq).length, 0);
  assert.deepEqual(business(outside), outsideBefore);
  if (mode === 'baseline') return;
  for (const [distance, allowed] of [[1, true], [1.15, true], [1.150001, false], [1.19, false]]) {
    const r = scene('range-' + distance, { distance }); requireFeature(r);
    const before = business(r), gate = r.api.playerAttack.gate('wz-4');
    assert.equal(gate.ok, allowed); assert.deepEqual(business(r), before, 'Gate is read-only');
    const ui = renderAttackButton(r); assert.equal(ui.button.disabled, !allowed);
    if (allowed) assert.equal(ui.button.dataset.enemyId, 'wz-4');
    else { assert.match(ui.feedback, /靠近/); reject(r, 'wz-4', 'attack-too-far', 'range-reject-' + distance); }
    record('range-render', { fixture: r.scene, distance, allowed, attributes: ui.attributes, feedback: ui.feedback });
  }
  const empty = scene('no-nearby-target', { distance: 8 }); requireFeature(empty);
  reject(empty, undefined, 'attack-no-target', 'no-nearby-target');
  const poor = scene('energy-four', { energy: 4 }); requireFeature(poor);
  assert.equal(renderAttackButton(poor).button.disabled, true);
  reject(poor, 'wz-4', 'attack-energy', 'energy-four');
});

if (mode === 'candidate') {
runGroup('2. Rendered A invalidation cannot redirect to B; F retains locked/first selection', () => {
  for (const invalidation of ['moved', 'dead', 'deleted', 'ambiguous']) {
    const r = scene('render-stale-' + invalidation, { second: true }); requireFeature(r);
    r.api.state.combatTargetId = 'wz-4';
    const ui = renderAttackButton(r); assert.equal(ui.button.dataset.enemyId, 'wz-4'); assert.equal(ui.button.disabled, false);
    const a = r.api.state.worldZombies.find(z => z.id === 'wz-4');
    if (invalidation === 'moved') a.x = 10;
    else if (invalidation === 'dead') a.hp = 0;
    else if (invalidation === 'deleted') r.api.state.worldZombies.splice(r.api.state.worldZombies.indexOf(a), 1);
    else r.api.state.worldZombies.find(z => z.id === 'wz-2').id = a.id;
    const reason = invalidation === 'moved' ? 'attack-too-far' : invalidation === 'dead' ? 'attack-target-dead' : 'attack-target-invalid';
    reject(r, a.id, reason, 'render-stale-' + invalidation, () => ui.button.click());
  }
  for (const locked of [true, false]) {
    const r = scene('F-default-' + locked, { second: true }); requireFeature(r);
    r.api.state.combatTargetId = locked ? 'wz-4' : 'unknown-old-lock';
    const expected = locked ? 'wz-4' : 'wz-1', before = beforeHit(r, expected), seq = r.api.state.worldMeta.eventSeq;
    emitKey(r, 'f'); const event = events(r, 'threat.attacked', seq).at(-1); assert.ok(event);
    const result = { ok: true, commandId: event.commandId, event, result: event.payload };
    proof(r, result, before, expected);
  }
});

runGroup('3. Real nonlethal/lethal hit, gross payment, nested advance and paused truth', () => {
  for (const options of [{ hp: 100, energy: 5, minute: 10 }, { hp: 50, energy: 78 }, { hp: 100, paused: true }, { hp: 100, rate: 0.5, expectedMinutes: 5 }, { hp: 100, rate: 0.8, expectedMinutes: 8 }]) {
    const r = scene('proof-' + serial, options); requireFeature(r);
    const before = beforeHit(r), killed = options.hp === 50;
    const result = r.api.playerAttack.attack({ targetId: 'wz-4', commandId: 'player-proof-' + serial });
    proof(r, result, before, 'wz-4', { killed, paused: options.paused === true, expectedMinutes: options.expectedMinutes || 10 });
    const native = validNative(r, 'proof-' + serial + '-actual-writer.json');
    record('normal-writer-after-hit', { writer: native.artifact, killed, paused: options.paused === true });
  }
  const quarter = scene('quarter-rate-invalid', { rate: 0.25 }); requireFeature(quarter);
  reject(quarter, 'wz-4', 'attack-clock-invalid', 'quarter-rate-invalid');
});

runGroup('4. Attack duplicate/Continue/new tick and necessary child-ID budget', () => {
  const r = scene('idempotent-lethal', { hp: 50 }); requireFeature(r);
  const id = 'actual-player-hit-once', result = r.api.playerAttack.attack({ targetId: 'wz-4', commandId: id });
  assert.equal(result.ok, true);
  const before = clone(r.api.state), duplicate = r.api.playerAttack.attack({ targetId: 'missing-now', commandId: id });
  assert.equal(duplicate.duplicate, true); assert.deepEqual(clone(r.api.state), before);
  const native = validNative(r, 'idempotent-hit-current-native.json'), restored = runtime(native.raw, 'actual-writer-Continue');
  requireFeature(restored); const loaded = clone(restored.api.state);
  assert.equal(restored.api.playerAttack.attack({ targetId: 'missing-now', commandId: id }).duplicate, true);
  assert.deepEqual(clone(restored.api.state), loaded);
  const successCount = events(restored, 'threat.attacked').length, kills = restored.api.state.zombieKills;
  assert.equal(restored.api.playerAttack.advance(1, { commandId: 'after-Continue-real-tick' }).ok, true);
  assert.equal(events(restored, 'threat.attacked').length, successCount); assert.equal(restored.api.state.zombieKills, kills);
  validNative(restored, 'after-Continue-real-tick-native.json');
  record('duplicate-and-Continue', { originalSuccess: clone(result.event), duplicate: clone(duplicate), normalWriter: native.artifact, clockAfterNewTick: restored.api.state.world.totalMinutes });
  const exhausted = scene('budget-exhausted'); requireFeature(exhausted);
  exhausted.api.state.worldMeta.commandSeq = Number.MAX_SAFE_INTEGER - 1;
  reject(exhausted, 'wz-4', 'command-sequence-exhausted', 'cmd-9007199254740991');
  const lastChild = scene('last-child-available'); requireFeature(lastChild);
  lastChild.api.state.worldMeta.commandSeq = Number.MAX_SAFE_INTEGER - 1;
  const good = lastChild.api.playerAttack.attack({ targetId: 'wz-4', commandId: 'opaque-final-parent' });
  assert.equal(good.ok, true); assert.equal(good.result.advance.commandId, 'cmd-9007199254740991');
  assert.equal(lastChild.api.state.worldMeta.commandSeq, Number.MAX_SAFE_INTEGER);
  record('opaque-parent-final-child', { result: clone(good) });
});

runGroup('5. Actual delegated context/number/space inputs, frozen/day and NIGHT separation', () => {
  for (const input of ['context', 'number', 'space']) {
    const r = scene('public-entry-' + input); requireFeature(r);
    const ui = renderAttackButton(r), before = beforeHit(r);
    if (input === 'context') ui.button.click();
    else if (input === 'number') {
      const originalQuery = r.document.querySelector;
      r.document.querySelector = selector => selector === `#contextActions [data-context-index="${ui.button.dataset.contextIndex}"]` ? ui.button : originalQuery(selector);
      try { emitKey(r, String(Number(ui.button.dataset.contextIndex) + 1)); } finally { r.document.querySelector = originalQuery; }
    } else emitKey(r, ' ');
    const event = events(r, 'threat.attacked', before.seq).at(-1); assert.ok(event, 'real entry emits actual success');
    proof(r, { ok: true, event, commandId: event.commandId, result: event.payload }, before, 'wz-4');
  }
  const frozen = scene('session-frozen'); requireFeature(frozen);
  frozen.api.session.mode = 'REPORT';
  const frozenBefore = business(frozen), frozenSeq = frozen.api.state.worldMeta.eventSeq;
  emitKey(frozen, 'f'); assert.equal(events(frozen, 'threat.attacked', frozenSeq).length, 0); assert.deepEqual(business(frozen), frozenBefore);
  assert.equal(frozen.api.playerAttack.attack({ targetId: 'wz-4', commandId: 'frozen-day-attack' }).ok, false);
  assert.deepEqual(business(frozen), frozenBefore);
  const over = scene('game-over'); requireFeature(over); over.api.state.gameOver = true;
  reject(over, 'wz-4', 'game-over', 'game-over-attack');
  const night = scene('actual-N-then-night-F'); requireFeature(night);
  emitKey(night, 'n');
  assert.equal(night.api.session.mode, 'BATTLE'); assert.equal(night.api.state.night, true);
  const s = night.api.state, enemies = s.nightBattle.enemies.filter(e => !e.dead && !e.reached);
  assert.ok(enemies.length >= 2, 'actual encounter enemies');
  // TEST-ONLY close-combat geometry/equipment; enemies are generated by real N.
  // Preserve their count, kind, health, speed and real NIGHT damage consumer.
  enemies[1].lane = enemies[0].lane; enemies[1].progress = enemies[0].progress;
  const position = night.api.playerAttack.battlePosition(enemies[0]);
  s.player.x = position.x - 1.2; s.player.y = position.y; s.weapon.id = 'pulseAxe'; s.energy = 4;
  const hp = enemies.slice(0, 2).map(e => ({ id: e.id, hp: e.hp })), world = s.world.totalMinutes, seq = s.worldMeta.eventSeq;
  emitKey(night, 'f');
  const event = events(night, 'threat.playerAttack', seq).at(-1); assert.ok(event);
  assert.equal(event.payload.targets.length, 2, 'original NIGHT pulse two-target rule');
  assert.equal(s.energy, 4, 'NIGHT has no DAY gross5 charge'); assert.equal(s.world.totalMinutes, world, 'NIGHT has no DAY advance10');
  assert.equal(events(night, 'threat.attacked', seq).length, 0); assert.equal(events(night, 'time.advanced', seq).length, 0);
  for (const old of hp) assert.ok(s.nightBattle.enemies.find(e => e.id === old.id).hp < old.hp);
  record('actual-NIGHT-isolation', { actualThreatStart: events(night, 'threat.started').at(-1), controlledGeometry: { distance: 1.2, weapon: 'pulseAxe', energy: 4 }, event });
});
}

artifact('runtime-starts.json', runtimeRows);
const currentBaselineRef = currentBaseline.artifact;
const report = {
  runner: 'source-player-day-attack-v1', mode, sourceHtmlSha256, sourceHash: sourceHtmlSha256,
  ok: checks.every(check => check.ok), count: checks.length, passed: checks.filter(check => check.ok).length, checks,
  source: { html: { sha256: sourceHtmlSha256, bytes: htmlBytes.length }, checker: { sha256: sha(checkerBytes), bytes: checkerBytes.length },
    ioAdapter: { sha256: sha(ioBytes), bytes: ioBytes.length }, ioRuntimeFactory: { sha256: sha(originalFactory), bytes: Buffer.byteLength(originalFactory) },
    qaExposure: { sha256: sha(aliasSource), sourceReducersReplaced: false }, originalWriter, actualCurrentWriterAfterOldContinue: currentBaselineRef },
  artifacts, scope: {
    actualCompleteInline: true, actualLoaderWriter: true, actualGateDamageCommandBusAdvance: true,
    fixtures: 'Complete original writer then actual Continue/current writer; TEST-ONLY declared offline geometry, HP, energy and clock inputs. Stale render cases explicitly mutate target preconditions after rendering. NIGHT uses actual public key N then controlled close-combat geometry/equipment.',
    controlledIO: ['DOM/storage/timers from existing source IO adapter', 'non-test Canvas render shielding', 'generated button attributes parsed from actual renderer', 'only numeric-key DOM selector bridged to that actual generated button'],
    noCssOrBrowserVisibilityClaim: true, browserStarted: false, naturalGameplay: false, productionDeployed: false,
    boundary: mode === 'candidate' ? 'Five grouped DAY-attack contracts; existing 26 daytime combat tests are independent and are not counted here. No global combat/clock transaction or generic actor authorization claim.' : 'One exact public-consumer countercontrol at 1.19. No new helper is required for the old source. Missing new APIs are not product-negative evidence.'
  }
};
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
for (const [file, expected] of [[htmlPath, sourceHtmlSha256], [ioPath, sha(ioBytes)], [fixturePath, sha(fixtureBytes)], [checkerPath, sha(checkerBytes)]]) assert.equal(sha(readFileSync(file)), expected, 'execution input immutable');
console.log(JSON.stringify({ runner: report.runner, sourceHtmlSha256, ok: report.ok, count: report.count, passed: report.passed, reportSha256: sha(readFileSync(out)) }));
process.exitCode = report.ok ? 0 : 1;
