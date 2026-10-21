#!/usr/bin/env node
// Actual whole-minute clock persistence source contracts: real interval,
// complete old writers, normal writer/Continue and strict pending credit.
// The baseline path uses only existing real consumers; no new-API absence is a
// product counterexample. No clock/advance/serializer/validator is replaced.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const usage = 'node check-world-clock-persistence-v1.mjs --repo-root ABS --html ABS --out ABS_REPORT [--io-adapter ABS] [--fixture ABS] [--expect-html-sha256 SHA] [--mode baseline|candidate]';
const opts = {}, args = process.argv.slice(2);
if (args.includes('--help')) { console.log(usage); process.exit(0); }
assert.equal(args.length % 2, 0, usage);
for (let i = 0; i < args.length; i += 2) {
  const [key, value] = args.slice(i, i + 2);
  assert.ok(['--repo-root', '--html', '--out', '--io-adapter', '--fixture', '--expect-html-sha256', '--mode'].includes(key) && value && !(key in opts), usage);
  opts[key] = ['--expect-html-sha256', '--mode'].includes(key) ? value : path.resolve(value);
}
for (const key of ['--repo-root', '--html', '--out']) assert.ok(opts[key], usage);
const mode = opts['--mode'] || 'candidate'; assert.ok(['baseline', 'candidate'].includes(mode));
const repo = opts['--repo-root'], htmlPath = opts['--html'], out = opts['--out'];
const ioPath = opts['--io-adapter'] || path.join(repo, 'scripts/check-report-recovery.mjs');
const fixturePath = opts['--fixture'] || path.join(repo, 'docs/qa/runs/npc-rest-work-v1-20261018/legacy/objects/ebd2c2a6f1ab12b0e62dc6ba235231b4a229916759cdf1662c2594ed9ac4c7e6.json');
assert.ok(!existsSync(out) && !existsSync(out + '.artifacts'), 'fresh output paths required');
mkdirSync(path.dirname(out), { recursive: true }); mkdirSync(out + '.artifacts');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const sourceBytes = readFileSync(htmlPath), html = sourceBytes.toString('utf8'), sourceHtmlSha256 = sha(sourceBytes);
if (opts['--expect-html-sha256']) assert.equal(sourceHtmlSha256, opts['--expect-html-sha256']);
const ioBytes = readFileSync(ioPath), io = ioBytes.toString('utf8'), fixtureBytes = readFileSync(fixturePath);
const checkerPath = fileURLToPath(import.meta.url), checkerBytes = readFileSync(checkerPath);
const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim()); assert.equal(inline.length, 1);
const a = io.indexOf('function runtime(entries = []) {'), b = io.indexOf('\nfunction envelope(payload)', a); assert.ok(a >= 0 && b > a);
const originalFactory = io.slice(a, b), marker = 'registry: EVENT_DEFS, hash: checksum,'; assert.equal(originalFactory.split(marker).length, 2);
const alias = `clockQA: { advance, pause: pauseWorld, rate: setWorldRate, start: startWorldSimulation, stop: stopWorldSimulation, attack,
  requestRest: requestCampRest, cancelRest: cancelCampRest, rest: CampRestController,
  debug() { return { handle: worldTimer, lastTickAt: worldLastTickAt, tickCounter: worldTickCounter, epoch: worldSimulationEpoch, generation: SessionController.generation }; }
}, ${marker}`;
const factory = new Function('inline', 'htmlPath', 'vm', 'assert', originalFactory.replace(marker, alias) + '\nreturn runtime;')(inline, htmlPath, vm, assert);
const saveKey = 'zombie-harvest-progress-v12', artifacts = [], checks = [], observations = [], additionalInputs = [];
function artifact(name, data, raw = false) {
  const file = path.join(out + '.artifacts', name); assert.ok(!existsSync(file));
  const bytes = raw ? data : JSON.stringify(data, null, 2) + '\n'; writeFileSync(file, bytes);
  const item = { path: path.relative(path.dirname(out), file).split(path.sep).join('/'), bytes: Buffer.byteLength(bytes), sha256: sha(bytes) };
  artifacts.push(item); return item;
}
const originalWriter = artifact('original-old-writer.json', fixtureBytes, true);
function validation(v) { return { ok: v.ok, reason: v.reason || null, sourceCategory: v.sourceCategory || null }; }
function open(raw, name) {
  const r = factory([[saveKey, raw]]), valid = r.api.validate({ raw, sourceCategory: 'primary' });
  assert.equal(valid.ok, true, `${name}: input actual validator ${valid.reason}`);
  assert.equal(r.api.start().ok, true, name + ': actual Continue'); assert.equal(r.api.session.mode, 'DAY');
  return r;
}
function inputDelta(before, after, at = 'payload') {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return [{ path: at, before, after }];
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().flatMap(k => inputDelta(before[k], after[k], at + '.' + k));
}
function scene(name, rate, prepare = null) {
  const originalPayload = clone(JSON.parse(fixtureBytes).payload), p = clone(originalPayload);
  p.worldMeta.clock.rate = rate;
  if (prepare) prepare(p);
  const raw = JSON.stringify({ version: p.version, payload: p, checksum: factory().api.hash(p), savedAt: p.world.totalMinutes, reason: 'TEST-ONLY preboot clock rate' });
  const input = artifact(name + '-input.json', raw, true);
  const r = open(raw, name);
  r.clockScene = { name, input, changes: inputDelta(originalPayload, p), testOnly: true };
  return r;
}
function current(r) {
  return clone({ world: r.api.state.world.totalMinutes, day: r.api.state.day, hour: r.api.state.hour, minute: r.api.state.minute,
    clock: r.api.state.worldMeta.clock, eventSeq: r.api.state.worldMeta.eventSeq, commandSeq: r.api.state.worldMeta.commandSeq,
    session: r.api.session.mode, timer: r.api.clockQA.debug(), now: r.instrumentation.now });
}
function simulationSnapshot(r) {
  const s = r.api.state;
  return clone({ day: s.day, hour: s.hour, minute: s.minute, world: s.world, hp: s.hp, energy: s.energy,
    sanity: s.sanity, sanityClock: s.sanityClock, food: s.food, wood: s.wood, parts: s.parts, stone: s.stone,
    npcs: s.npcs, resources: s.resources, buildings: s.buildings, project: s.relayProject, forecast: s.hordeForecast,
    enemies: s.worldZombies, motion: s.motion, kills: s.zombieKills });
}
function timerTask(r) {
  const debug = r.api.clockQA.debug(), task = r.tasks.get(debug.handle);
  assert.ok(task, 'actual registered worldTimer'); assert.equal(task.kind, 'interval'); assert.equal(task.delay, 1200);
  const source = html.match(/worldTimer = setInterval\((\(\) => \{[\s\S]*?\}), 1200\);/); assert.ok(source);
  assert.equal(task.callback.toString(), source[1], 'actual callback equals original source function');
  return { task, handle: debug.handle, callbackSha256: sha(task.callback.toString()) };
}
function tick(r) {
  const registration = timerTask(r), before = current(r);
  r.instrumentation.now += 1200; registration.task.callback();
  const after = current(r), events = clone(r.api.state.worldMeta.events.filter(e => e.seq > before.eventSeq));
  assert.equal(after.timer.tickCounter, before.timer.tickCounter + 1, 'one real original timer callback');
  return { before, after, events, handle: registration.handle, callbackSha256: registration.callbackSha256 };
}
function write(r, label) {
  const returned = r.api.save(), raw = r.storage.get(saveKey), valid = r.api.validate({ raw, sourceCategory: 'primary' });
  return { returned, validation: validation(valid), artifact: artifact(label + '-actual-writer.json', raw, true), raw };
}
function check(name, run) { try { run(); checks.push({ name, ok: true }); } catch (error) { checks.push({ name, ok: false, error: error.message }); } }
const remainder = r => r.api.state.worldMeta.clock.subMinuteRemainder ?? '0';
function goodWrite(r, label) { const result = write(r, label); assert.equal(result.returned, true); assert.equal(result.validation.ok, true, JSON.stringify(result.validation)); return result; }
function reload(r, name) {
  const restored = factory([...r.storage.entries()]);
  assert.equal(restored.api.start().ok, true, name + ': actual Continue accepts saved storage');
  return restored;
}
function contractPayload(event, whole, scaled, before, after) {
  assert.equal(event.type, 'time.advanced');
  assert.equal(event.payload.minutes, whole);
  assert.equal(event.payload.clockPolicy, 'whole-minute-v1');
  assert.equal(event.payload.scaledMinutes, scaled);
  assert.equal(event.payload.remainderBefore, before);
  assert.equal(event.payload.remainderAfter, after);
}

check('Actual registered .5 world callback keeps normal writer and Continue recoverable', () => {
  const r = scene('half-rate-original-callback', .5), beforeWriter = write(r, 'before-tick');
  assert.equal(beforeWriter.returned, true); assert.equal(beforeWriter.validation.ok, true);
  const actualTick = tick(r), afterWriter = write(r, 'after-tick');
  const restored = factory([...r.storage.entries()]), continued = restored.api.start();
  observations.push({ fixture: r.clockScene, beforeWriter: { returned: beforeWriter.returned, validation: beforeWriter.validation, artifact: beforeWriter.artifact },
    actualTick, afterWriter: { returned: afterWriter.returned, validation: afterWriter.validation, artifact: afterWriter.artifact },
    actualContinue: { result: clone(continued), started: restored.api.started, mode: restored.api.session.mode, world: restored.api.state.world?.totalMinutes } });
  assert.equal(Number.isSafeInteger(actualTick.after.world), true, 'actual calendar must remain persistable');
  assert.equal(afterWriter.returned, true); assert.equal(afterWriter.validation.ok, true);
  assert.equal(continued.ok, true, 'same actual storage Continue');
});

if (mode === 'candidate') {
check('Legal rates conserve fixed cumulative duration through actual callbacks and normal writers', () => {
  const cases = [
    { rate: .25, whole: [0, 0, 0, 1], carry: ['0.25', '0.5', '0.75', '0'], total: 1 },
    { rate: .5, whole: [0, 1], carry: ['0.5', '0'], total: 1 },
    { rate: .8, whole: [0, 1, 1, 1, 1], carry: ['0.8', '0.6', '0.4', '0.2', '0'], total: 4 },
    { rate: 1, whole: [1, 1, 1], carry: ['0', '0', '0'], total: 3 },
    { rate: 1.5, whole: [1, 2], carry: ['0.5', '0'], total: 3 },
    { rate: 4, whole: [4, 4], carry: ['0', '0'], total: 8 }
  ];
  for (const test of cases) {
    const r = scene('cumulative-' + test.rate, test.rate), initial = current(r), steps = [];
    for (let i = 0; i < test.whole.length; i++) {
      const beforeRemainder = remainder(r), beforeSimulation = simulationSnapshot(r), step = tick(r), timeEvents = step.events.filter(e => e.type === 'time.advanced');
      assert.equal(timeEvents.length, 1, 'each accepted callback has one real command/event even for zero whole');
      assert.equal(step.after.world - step.before.world, test.whole[i]);
      assert.equal(Number.isSafeInteger(step.after.world), true);
      assert.equal(remainder(r), test.carry[i]);
      const e = timeEvents[0], parent = r.api.state.worldMeta.replay.commands.find(c => c.commandId === e.commandId);
      assert.equal(parent.type, 'world.advance'); assert.equal(parent.payload.minutes, test.whole[i]);
      if (test.rate % 1 !== 0 || beforeRemainder !== '0') {
        contractPayload(e, test.whole[i], test.rate, beforeRemainder, test.carry[i]);
        assert.equal(parent.payload.clockPolicy, 'whole-minute-v1');
        assert.equal(parent.payload.scaledMinutes, test.rate);
        assert.equal(parent.payload.remainderBefore, beforeRemainder); assert.equal(parent.payload.remainderAfter, test.carry[i]);
      } else {
        assert.deepEqual(clone(parent.payload), { minutes: test.whole[i] }, 'original integer replay shape');
        assert.deepEqual(Object.keys(e.payload).sort(), ['day', 'hour', 'minute', 'minutes']);
        assert.equal(Object.hasOwn(r.api.state.worldMeta.clock, 'subMinuteRemainder'), false, 'old missing zero remains absent in pure integer path');
      }
      if (test.whole[i] === 0) {
        // advanceReducer(0) would still touch consumers such as frontier/routine.
        // Zero-whole work may only alter the clock credit and Bus facts.
        assert.deepEqual(simulationSnapshot(r), beforeSimulation, 'zero-whole cannot simulate needs, combat, motion or work');
        assert.equal(step.events.filter(e => e.type !== 'time.advanced').length, 0, 'zero-whole does not run simulation consumers');
      }
      const writer = goodWrite(r, 'cumulative-' + test.rate + '-step-' + i);
      steps.push({ step, writer: writer.artifact });
    }
    assert.equal(r.api.state.world.totalMinutes - initial.world, test.total);
    observations.push({ group: 'fixed-rate-accumulation', rate: test.rate, fixedExpectedTotal: test.total, steps });
  }
});

check('Normal writer/Continue retains exact pending credit and paid action minutes remain5/8/10', () => {
  const r = scene('credit-across-Continue', .25);
  tick(r); assert.equal(remainder(r), '0.25'); const first = goodWrite(r, 'pending-quarter-before-Continue');
  const restored = reload(r, 'pending-quarter'); assert.equal(remainder(restored), '0.25');
  const initialWorld = restored.api.state.world.totalMinutes, seq = restored.api.state.worldMeta.eventSeq;
  for (let i = 0; i < 3; i++) tick(restored);
  assert.equal(restored.api.state.world.totalMinutes - initialWorld, 1); assert.equal(remainder(restored), '0');
  assert.equal(restored.api.state.worldMeta.events.filter(e => e.seq > seq && e.type === 'time.advanced').length, 3);
  const second = goodWrite(restored, 'pending-quarter-after-Continue-three-callbacks');
  observations.push({ group: 'pending-Continue', first: first.artifact, second: second.artifact });
  for (const [rate, minutes] of [[.5, 5], [.8, 8], [1, 10]]) {
    const action = scene('paid-attack-' + rate, rate, p => {
      p.worldMeta.clock.subMinuteRemainder = '0.25';
      p.player.x = 1; p.player.y = 20;
      const enemy = p.worldZombies.find(z => z.id === 'wz-4'); enemy.x = 2; enemy.y = 20;
    });
    const before = current(action), energy = action.api.state.energy;
    const result = action.api.clockQA.attack({ targetId: 'wz-4', commandId: 'clock-valid-paid-' + rate });
    assert.equal(result.ok, true); assert.equal(result.result.payment.before.energy, energy);
    assert.equal(result.result.payment.after.energy, energy - 5);
    assert.equal(result.result.clock.elapsedMinutes, minutes); assert.equal(result.result.advance.minutes, minutes);
    assert.equal(action.api.state.world.totalMinutes - before.world, minutes);
    assert.equal(remainder(action), '0.25', 'integer paid step cannot spend pending fractional credit');
    const event = action.api.state.worldMeta.events.find(e => e.eventId === result.result.advance.eventId);
    contractPayload(event, minutes, minutes, '0.25', '0.25');
    goodWrite(action, 'paid-attack-' + rate + '-after');
    observations.push({ group: 'paid-integer-time', rate, fixedExpectedMinutes: minutes, result: clone(result) });
  }
});

check('Pause, rate change, stop/start, rest and generation preserve credit and fence old callbacks', () => {
  const r = scene('clock-ownership', .25); tick(r); assert.equal(remainder(r), '0.25');
  r.api.clockQA.pause(true); const paused = current(r), pausedTick = tick(r);
  assert.equal(pausedTick.after.world, paused.world); assert.equal(remainder(r), '0.25');
  assert.equal(pausedTick.events.length, 0, 'paused advance has no command or event');
  assert.equal(pausedTick.after.commandSeq, paused.commandSeq);
  r.api.clockQA.pause(false); r.api.clockQA.rate(.8); assert.equal(remainder(r), '0.25');
  const changed = tick(r); assert.equal(changed.after.world - changed.before.world, 1); assert.equal(remainder(r), '0.05');
  const old = timerTask(r).task.callback;
  r.api.clockQA.stop(); r.api.clockQA.start(); const beforeOld = current(r);
  old(); assert.deepEqual(current(r), beforeOld, 'stopped old callback cannot resume'); assert.equal(remainder(r), '0.05');
  const generationOld = timerTask(r).task.callback; r.api.session.generation += 1;
  const beforeGenerationOld = current(r); generationOld(); assert.deepEqual(current(r), beforeGenerationOld, 'generation-old callback cannot add credit');
  r.api.clockQA.start(); assert.equal(remainder(r), '0.05');
  goodWrite(r, 'clock-ownership-final');
  const rest = scene('rest-preserves-credit', 1, p => { p.worldMeta.clock.subMinuteRemainder = '0.25'; p.player.x = 10; p.player.y = 11; });
  const started = rest.api.clockQA.requestRest(30); assert.equal(started.ok, true);
  const beforeRest = current(rest); rest.api.clockQA.rest.tick();
  assert.equal(rest.api.state.world.totalMinutes - beforeRest.world, 1); assert.equal(remainder(rest), '0.25');
  rest.api.clockQA.cancelRest('player-cancel'); assert.equal(remainder(rest), '0.25');
  goodWrite(rest, 'rest-preserves-credit-final');
  observations.push({ group: 'ownership', pausedTick, rateChangeTick: changed, restStatus: clone(rest.api.clockQA.rest.status()) });
});

check('Duplicate cannot credit twice and invalid candidate writer cannot overwrite valid primary or backup', () => {
  const r = scene('duplicate-credit-and-writer-guard', .5), initial = goodWrite(r, 'valid-primary-first');
  r.api.clockQA.advance(1, { commandId: 'real-fraction-once' }); assert.equal(remainder(r), '0.5');
  const beforeDuplicate = clone(r.api.state);
  const duplicate = r.api.clockQA.advance(1, { commandId: 'real-fraction-once' });
  assert.equal(duplicate.duplicate, true); assert.deepEqual(clone(r.api.state), beforeDuplicate);
  const valid = goodWrite(r, 'valid-primary-with-credit');
  const beforeStorage = [...r.storage.entries()].map(([key, value]) => [key, value]);
  assert.ok(beforeStorage.some(([key]) => key === saveKey + '.bak'), 'actual valid backup exists before refusal');
  const beforeLive = { day: r.api.state.day, minute: r.api.state.minute, world: r.api.state.world.totalMinutes };
  // Deliberate live candidate corruption, not a simulated storage failure. The
  // real writer must validate its raw new envelope before touching either key.
  r.api.state.minute = .5; r.api.state.world.totalMinutes = 360.5;
  const refused = r.api.save(); assert.equal(refused, false);
  assert.deepEqual([...r.storage.entries()], beforeStorage, 'all original primary/backup bytes preserved');
  r.api.state.day = beforeLive.day; r.api.state.minute = beforeLive.minute; r.api.state.world.totalMinutes = beforeLive.world;
  const originalCredit = r.api.state.worldMeta.clock.subMinuteRemainder;
  r.api.state.worldMeta.clock.subMinuteRemainder = undefined;
  assert.equal(Object.hasOwn(r.api.state.worldMeta.clock, 'subMinuteRemainder'), true, 'deliberate present own undefined, not legacy missing');
  const ownUndefinedResult = r.api.save(), ownUndefinedStorage = [...r.storage.entries()];
  const ownUndefinedEvidence = { hasOwnRemainder: Object.hasOwn(r.api.state.worldMeta.clock, 'subMinuteRemainder'), liveValueType: typeof r.api.state.worldMeta.clock.subMinuteRemainder,
    writerReturn: ownUndefinedResult, storageBefore: beforeStorage.map(([key, value]) => ({ key, bytes: Buffer.byteLength(value), sha256: sha(value) })),
    storageAfter: ownUndefinedStorage.map(([key, value]) => ({ key, bytes: Buffer.byteLength(value), sha256: sha(value) })) };
  const ownUndefinedArtifact = artifact('live-own-undefined-writer-refusal.json', ownUndefinedEvidence);
  observations.push({ group: 'live-own-undefined-writer-preflight', artifact: ownUndefinedArtifact, ...ownUndefinedEvidence });
  assert.equal(ownUndefinedResult, false, 'own undefined must not JSON-disappear into allowed old missing');
  assert.deepEqual(ownUndefinedStorage, beforeStorage, 'own undefined cannot overwrite original primary/backup bytes');
  r.api.state.worldMeta.clock.subMinuteRemainder = originalCredit;
  const recovered = goodWrite(r, 'valid-after-rejected-candidate');
  observations.push({ group: 'duplicate-writer-guard', initial: initial.artifact, valid: valid.artifact, refused,
    preservedStorage: beforeStorage.map(([key, value]) => ({ key, bytes: Buffer.byteLength(value), sha256: sha(value) })), recovered: recovered.artifact });
});

check('Old missing remainder remains implicit zero while present canonical/invalid slots follow strict writer contract', () => {
  const old = scene('legacy-missing-zero', 1);
  assert.equal(Object.hasOwn(old.api.state.worldMeta.clock, 'subMinuteRemainder'), false);
  const initialMigrations = old.api.state.worldMeta.events.filter(e => e.type === 'save.migrated');
  assert.deepEqual(clone(initialMigrations.map(e => e.payload.reason)), ['npc-relay-handoff-memory-v1'], 'original oldA only has its already-known memory adapter; missing clock slot cannot add migration');
  const originalPayload = JSON.parse(fixtureBytes).payload;
  for (const key of ['food', 'wood', 'stone', 'parts', 'seeds', 'medicine', 'hp', 'energy']) assert.equal(old.api.state[key], originalPayload[key]);
  assert.equal(old.api.state.worldMeta.seed, originalPayload.worldMeta.seed); assert.equal(old.api.state.worldMeta.rngState, originalPayload.worldMeta.rngState);
  const integer = old.api.clockQA.advance(1, { commandId: 'old-integer-clock-shape' }); assert.equal(integer.ok, true);
  assert.equal(Object.hasOwn(old.api.state.worldMeta.clock, 'subMinuteRemainder'), false);
  assert.deepEqual(clone(old.api.state.worldMeta.events.filter(e => e.type === 'save.migrated')), clone(initialMigrations));
  assert.deepEqual(clone(old.api.state.worldMeta.replay.commands.find(c => c.commandId === integer.commandId).payload), { minutes: 1 });
  const writer = goodWrite(old, 'old-missing-zero-after-integer');
  assert.equal(Object.hasOwn(JSON.parse(writer.raw).payload.worldMeta.clock, 'subMinuteRemainder'), false);
  const tiny = '0.' + '0'.repeat(323) + '5';
  const precise = scene('canonical-324-places', 1, p => { p.worldMeta.clock.subMinuteRemainder = tiny; });
  assert.equal(remainder(precise), tiny); const preciseWriter = goodWrite(precise, 'canonical-324-places');
  const preciseReload = reload(precise, 'canonical-324-places'); assert.equal(remainder(preciseReload), tiny);
  const badResults = [];
  for (const [name, value] of [['numeric', .5], ['trailing-zero', '0.50'], ['negative', '-0.1'], ['325-places', '0.' + '0'.repeat(324) + '5']]) {
    const p = clone(JSON.parse(fixtureBytes).payload); p.worldMeta.clock.subMinuteRemainder = value;
    const raw = JSON.stringify({ version: p.version, payload: p, checksum: factory().api.hash(p), savedAt: p.world.totalMinutes });
    const r = factory([[saveKey, raw]]), result = r.api.validate({ raw, sourceCategory: 'primary' });
    assert.equal(result.ok, false); assert.equal(result.reason, 'world-clock-remainder');
    const input = artifact('invalid-remainder-' + name + '.json', raw, true); badResults.push({ input, validation: validation(result) });
  }
  observations.push({ group: 'legacy-and-strict-slots', legacy: writer.artifact, exact324: preciseWriter.artifact, badResults });
});

check('Three declared calendar midnight boundaries keep actual ration/upkeep and Continue idempotent', () => {
  const boundaries = [];
  // Three independent complete-writer TEST-ONLY calendar placements. This is
  // three day boundaries, not uninterrupted/natural three-day survival.
  for (const [day, worldBefore, worldAfter] of [[1, 1439, 1440], [2, 2879, 2880], [3, 4319, 4320]]) {
    const r = scene('midnight-day-' + day, .5, p => {
      p.day = day; p.hour = 23; p.minute = 59; p.world.totalMinutes = worldBefore;
      p.world.lastRationDay = day; p.world.lastDailyUpkeepDay = day;
    });
    const first = tick(r);
    assert.equal(first.after.world, worldBefore); assert.equal(r.api.state.food, 8);
    assert.equal(r.api.state.world.lastRationDay, day); assert.equal(r.api.state.world.lastDailyUpkeepDay, day);
    const second = tick(r), s = r.api.state;
    assert.equal(second.after.world, worldAfter); assert.equal(s.day, day + 1); assert.equal(s.hour, 0); assert.equal(s.minute, 0);
    assert.equal(s.world.lastRationDay, day + 1); assert.equal(s.world.lastDailyUpkeepDay, day + 1);
    // Authored daily need for this unchanged, ten-alive original roster is3.
    // One minute at00:00 does not perform a noon meal/work payout.
    assert.equal(s.food, 5, 'original8 food pays exactly one real3 ration at midnight');
    const daily = s.worldMeta.events.filter(e => e.type === 'plan.commandPoints.refreshed' && e.payload.day === day + 1);
    assert.equal(daily.length, 1, 'actual daily-upkeep consumer occurs once');
    const writer = goodWrite(r, 'midnight-day-' + day + '-after');
    const restored = reload(r, 'midnight-day-' + day), restoreSeq = restored.api.state.worldMeta.eventSeq;
    assert.equal(restored.api.state.food, 5); assert.equal(restored.api.state.world.lastRationDay, day + 1);
    assert.equal(restored.api.state.world.lastDailyUpkeepDay, day + 1);
    tick(restored); tick(restored);
    assert.equal(restored.api.state.world.totalMinutes, worldAfter + 1); assert.equal(restored.api.state.food, 5);
    assert.equal(restored.api.state.worldMeta.events.filter(e => e.seq > restoreSeq && e.type === 'plan.commandPoints.refreshed' && e.payload.day === day + 1).length, 0);
    const afterContinue = goodWrite(restored, 'midnight-day-' + day + '-Continue-new-whole');
    boundaries.push({ fixture: r.clockScene, first, second, dailyUpkeepReceipt: clone(daily[0]), writer: writer.artifact, afterContinue: afterContinue.artifact });
  }
  observations.push({ group: 'three-independent-midnight-boundaries', boundaries, continuousThreeDayGameplayClaim: false });
});

check('Full old DAY18 and real paid-combat writer remain accepted by the global writer guard', () => {
  const fixtures = [
    { name: 'original-DAY18', repositoryPath: 'scripts/fixtures/legacy-save18/DAY18-save.json', sha256: '0fe3b3e33d630621feb20cba3bb08b4db7cef247464d3b32f748c3c17bf829c3' },
    { name: 'actual-public-F-current-native', repositoryPath: 'docs/qa/runs/player-day-attack-v1-20261018/selected/objects/b464332ecb94f04e112cb79daf9cb2b936e4d8f58e01c58e4de2507524340296.json', sha256: 'b464332ecb94f04e112cb79daf9cb2b936e4d8f58e01c58e4de2507524340296' }
  ];
  const compatibility = [];
  for (const fixture of fixtures) {
    const file = path.join(repo, fixture.repositoryPath), bytes = readFileSync(file);
    assert.equal(sha(bytes), fixture.sha256, 'fixed original writer bytes');
    additionalInputs.push({ file, sha256: fixture.sha256 });
    const source = artifact(fixture.name + '-original-native.json', bytes, true), r = open(bytes.toString('utf8'), fixture.name);
    const first = goodWrite(r, fixture.name + '-current-normal-writer');
    const restored = reload(r, fixture.name + '-current-normal-writer');
    const second = goodWrite(restored, fixture.name + '-second-Continue-writer');
    assert.equal(restored.api.state.world.totalMinutes, r.api.state.world.totalMinutes);
    for (const key of ['hp', 'energy', 'food', 'wood', 'parts', 'stone', 'seeds', 'medicine']) assert.equal(restored.api.state[key], r.api.state[key]);
    compatibility.push({ original: { repositoryPath: fixture.repositoryPath, sha256: fixture.sha256, artifact: source }, first: first.artifact, second: second.artifact });
  }
  observations.push({ group: 'normal-writer-compatibility', compatibility });
});
}

const report = { runner: 'source-world-clock-persistence-v1', mode, sourceHtmlSha256, sourceHash: sourceHtmlSha256,
  ok: checks.every(c => c.ok), count: checks.length, passed: checks.filter(c => c.ok).length, checks, observations, artifacts,
  inputs: { checker: { sha256: sha(checkerBytes), bytes: checkerBytes.length }, io: { sha256: sha(ioBytes), bytes: ioBytes.length },
    ioRuntimeFactory: { sha256: sha(originalFactory), bytes: Buffer.byteLength(originalFactory) }, originalWriter },
  scope: { sourceVM: true, actualRegisteredCallbacks: true, directAdvanceSubstitutesForTimer: false,
    candidatePreparationIncomplete: false, browser: false, naturalGameplay: false, productFixAcceptance: mode === 'candidate' && checks.every(c => c.ok),
    calendarBoundaryScope: 'Three independent TEST-ONLY day1/2/3 midnight boundaries; no continuous three-day survival or full-world chunk equivalence claim',
    note: 'Eight grouped persistence contracts, including actual midnight consumers and global normal-writer compatibility. Baseline uses one original public-consumer countercontrol; no missing-new-API product negative.' } };
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
for (const [file, bytes] of [[htmlPath, sourceBytes], [ioPath, ioBytes], [fixturePath, fixtureBytes], [checkerPath, checkerBytes]]) assert.equal(sha(readFileSync(file)), sha(bytes), 'executed input immutable');
for (const item of additionalInputs) assert.equal(sha(readFileSync(item.file)), item.sha256, 'additional original writer immutable');
console.log(JSON.stringify({ runner: report.runner, mode, sourceHtmlSha256, ok: report.ok, count: report.count, passed: report.passed, reportSha256: sha(readFileSync(out)) }));
process.exitCode = report.ok ? 0 : 1;
