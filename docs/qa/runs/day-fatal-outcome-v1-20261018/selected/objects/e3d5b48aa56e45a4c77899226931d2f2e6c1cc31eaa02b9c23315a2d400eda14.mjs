#!/usr/bin/env node
// Source VM: actual complete source, original IO, Bus, damage, effects,
// report renderer, writer and Continue. Derived fixtures are TEST-ONLY.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const usage = 'node check-day-fatal-outcome-v1.mjs --repo-root ABS --html ABS --out ABS_REPORT [--expect-html-sha256 SHA] [--io-adapter ABS] [--fixture ABS] [--mode baseline|candidate]';
const opts = {}, args = process.argv.slice(2);
if (args.includes('--help')) { console.log(usage); process.exit(0); }
assert.equal(args.length % 2, 0, usage);
for (let i = 0; i < args.length; i += 2) {
  const [key, value] = args.slice(i, i + 2);
  assert.ok(['--repo-root', '--html', '--out', '--expect-html-sha256', '--io-adapter', '--fixture', '--mode'].includes(key) && value && !(key in opts), usage);
  opts[key] = ['--expect-html-sha256', '--mode'].includes(key) ? value : path.resolve(value);
}
for (const key of ['--repo-root', '--html', '--out']) assert.ok(opts[key], usage);
const root = opts['--repo-root'], htmlPath = opts['--html'], out = opts['--out'], mode = opts['--mode'] || 'candidate';
assert.ok(['candidate', 'baseline'].includes(mode));
const ioPath = opts['--io-adapter'] || path.join(root, 'scripts/check-report-recovery.mjs');
const fixturePath = opts['--fixture'] || path.join(root, 'docs/qa/runs/npc-rest-work-v1-20261018/legacy/objects/ebd2c2a6f1ab12b0e62dc6ba235231b4a229916759cdf1662c2594ed9ac4c7e6.json');
assert.ok(!existsSync(out) && !existsSync(out + '.artifacts'), 'fresh output required');
mkdirSync(path.dirname(out), { recursive: true }); mkdirSync(out + '.artifacts');
const sha = b => createHash('sha256').update(b).digest('hex'), clone = v => JSON.parse(JSON.stringify(v));
const sourceBytes = readFileSync(htmlPath), html = sourceBytes.toString('utf8'), sourceHtmlSha256 = sha(sourceBytes);
if (opts['--expect-html-sha256']) assert.equal(sourceHtmlSha256, opts['--expect-html-sha256']);
const ioBytes = readFileSync(ioPath), io = ioBytes.toString('utf8'), fixtureBytes = readFileSync(fixturePath);
const checkerBytes = readFileSync(fileURLToPath(import.meta.url));
const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim()); assert.equal(inline.length, 1);
const first = io.indexOf('function runtime(entries = []) {'), last = io.indexOf('\nfunction envelope(payload)', first);
assert.ok(first >= 0 && last > first, 'real IO factory boundaries');
const factorySource = io.slice(first, last), marker = 'registry: EVENT_DEFS, hash: checksum,';
assert.equal(factorySource.split(marker).length, 2);
const aliases = `fatalQA: { advance, attack, rest: CampRestController, requestRest: requestCampRest, fullRender: render,
  content: ContentRegistry, resolveContent: resolveContentChainCommand,
  retry: typeof retryDayFatalSave === 'function' ? retryDayFatalSave : null,
  validateOutcome: typeof validateDayFatalOutcome === 'function' ? validateDayFatalOutcome : null,
  timers() { return { world: worldTimer, battle: battleTimer, generation: SessionController.generation, activeCommandId: state.worldMeta.activeCommandId }; }
}, ${marker}`;
const factory = new Function('inline', 'htmlPath', 'vm', 'assert', factorySource.replace(marker, aliases) + '\nreturn runtime;')(inline, htmlPath, vm, assert);
const saveKey = 'zombie-harvest-progress-v12', checks = [], observations = [], artifacts = [], fixtures = [];
function artifact(name, value, raw = false) {
  const file = path.join(out + '.artifacts', name); assert.ok(!existsSync(file));
  const bytes = raw ? value : JSON.stringify(value, null, 2) + '\n'; writeFileSync(file, bytes);
  const ref = { path: path.relative(path.dirname(out), file).split(path.sep).join('/'), bytes: Buffer.byteLength(bytes), sha256: sha(bytes) };
  artifacts.push(ref); return ref;
}
const originalWriter = artifact('original-old-writer.json', fixtureBytes, true);
const originalPayload = clone(JSON.parse(fixtureBytes).payload);
function diff(a, b, at = 'payload') {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return [{ path: at, before: a, after: b }];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().flatMap(k => diff(a[k], b[k], at + '.' + k));
}
function envelope(payload, reason = 'TEST-ONLY DAY fatal fixture') {
  return JSON.stringify({ version: payload.version, payload, checksum: factory().api.hash(payload), savedAt: payload.world.totalMinutes, reason });
}
function open(raw, label, expectedMode = 'DAY') {
  const r = factory([[saveKey, raw]]), validation = r.api.validate({ raw, sourceCategory: 'primary' });
  assert.equal(validation.ok, true, label + ': actual input validator ' + JSON.stringify(validation));
  const started = r.api.start(); assert.equal(started.ok, true, label + ': actual Continue');
  assert.equal(r.api.session.mode, expectedMode); r.label = label; return r;
}
function scene(name, prepare) {
  const p = clone(originalPayload); prepare(p);
  const raw = envelope(p), input = artifact(name + '-input.json', raw, true);
  const description = { name, input, changes: diff(originalPayload, p), mode: 'TEST-ONLY complete old writer derivation', naturalGameplay: false };
  fixtures.push(description); const r = open(raw, name); r.fixture = description; return r;
}
function nearPlayer(p, { hp = 4, paused = false, targetHp = 100, second = false } = {}) {
  p.player.x = 1; p.player.y = 20; p.hp = hp; p.worldMeta.clock.rate = 1; p.worldMeta.clock.paused = paused;
  const z = p.worldZombies.find(z => z.id === 'wz-4'); assert.equal(z.kind, 'normal');
  z.x = 1.6; z.y = 20; z.hp = targetHp;
  if (second) { const other = p.worldZombies.find(z => z.id === 'wz-1'); assert.equal(other.kind, 'normal'); other.x = 1.3; other.y = 20;
    // TEST-ONLY legal existing cadence phase: the original 12-minute enemy
    // cadence becomes due during this real ten-minute child, without changing it.
    other.attackClock = 2; }
}
function events(r, type, after = 0) { return r.api.state.worldMeta.events.filter(e => e.seq > after && (!type || e.type === type)); }
function view(r) {
  const s = r.api.state;
  return clone({ hp: s.hp, energy: s.energy, sanity: s.sanity, morale: s.morale, zombieKills: s.zombieKills,
    wood: s.wood, stone: s.stone, food: s.food, parts: s.parts, day: s.day, hour: s.hour, minute: s.minute,
    world: s.world, clock: s.worldMeta.clock, events: s.worldMeta.events, eventSeq: s.worldMeta.eventSeq,
    commandSeq: s.worldMeta.commandSeq, replay: s.worldMeta.replay, npcs: s.npcs, buildings: s.buildings,
    enemies: s.worldZombies, content: s.contentState, gameOver: s.gameOver, night: s.night,
    dayFatalOutcome: s.dayFatalOutcome ?? null, mode: r.api.session.mode, rest: r.api.fatalQA.rest.status() });
}
function observe(label, r, extra = {}) { observations.push({ label, fixture: r.fixture || null, actual: view(r), ...clone(extra) }); }
function group(name, fn) {
  try { fn(); checks.push({ name, ok: true }); }
  catch (error) { checks.push({ name, ok: false, error: String(error.message || error), stack: String(error.stack || '') }); }
}
function tick(r) {
  const id = r.api.fatalQA.timers().world, task = r.tasks.get(id);
  assert.ok(task, 'actual registered world timer'); assert.equal(task.kind, 'interval'); assert.equal(task.delay, 1200);
  const match = html.match(/worldTimer = setInterval\((\(\) => \{[\s\S]*?\}), 1200\);/);
  assert.ok(match); assert.equal(task.callback.toString(), match[1], 'invoke original registered callback');
  r.instrumentation.now += 1200; task.callback(); return { callback: task.callback, sha256: sha(task.callback.toString()), id };
}
function native(r, label, requireAuto = false) {
  if (!requireAuto) assert.equal(r.api.save({ reason: label }), true, 'real normal writer');
  const raw = r.storage.get(saveKey); assert.equal(typeof raw, 'string');
  const result = r.api.validate({ raw, sourceCategory: 'primary' }); assert.equal(result.ok, true, label + ': actual writer validator');
  const payload = JSON.parse(raw).payload;
  return { raw, payload, artifact: artifact(label + '-native.json', raw, true) };
}
function fatal(r, cause, after = 0) {
  const s = r.api.state, losses = events(r, 'player.dayFatal', after);
  assert.equal(s.hp, 0); assert.equal(s.gameOver, 'lose'); assert.equal(s.night, false); assert.equal(r.api.session.mode, 'LOSS');
  assert.equal(r.api.session.acceptsInput(), false); assert.equal(r.api.session.isDay(), false);
  assert.equal(losses.length, 1, 'one final DAY fact');
  const slot = s.dayFatalOutcome; assert.ok(slot);
  assert.deepEqual(Object.keys(slot).sort(), ['version', 'eventId', 'sourceEventId', 'cause', 'sourceId', 'commandId', 'tick'].sort());
  assert.equal(slot.version, 1); assert.equal(slot.eventId, losses[0].eventId); assert.equal(slot.cause, cause);
  assert.deepEqual(Object.keys(slot.tick).sort(), ['world', 'phase', 'schedule'].sort());
  assert.equal(s.worldMeta.activeCommandId, null, 'outer Bus completed before finalization');
  assert.equal(r.api.fatalQA.timers().world, null); assert.equal(r.api.fatalQA.timers().battle, null);
  assert.equal([...r.tasks.values()].filter(t => t.kind === 'interval').length, 0, 'no future world/battle/held interval');
  assert.equal(r.api.fatalQA.rest.status().active, false);
  const source = slot.sourceEventId === null ? null : events(r).find(e => e.eventId === slot.sourceEventId);
  if (slot.sourceEventId !== null) { assert.ok(source); assert.ok(source.seq < losses[0].seq); }
  const stateBefore = view(r), raw = r.storage.get(saveKey);
  r.api.fatalQA.fullRender();
  assert.deepEqual(view(r), stateBefore, 'actual fatal report render is pure'); assert.equal(r.storage.get(saveKey), raw);
  assert.match(r.node('nightTitle').textContent, /白天/);
  assert.ok(!/营地失守|尸潮|西侧|标定通道/.test(r.node('nightTitle').textContent), 'no old battle title/route presented as DAY outcome');
  return { slot: clone(slot), event: clone(losses[0]), source: clone(source) };
}
function continueLoss(r, saved, label) {
  const next = factory([...r.storage.entries()]), before = clone(saved.payload.worldMeta);
  assert.equal(next.api.start().ok, true, 'actual Continue of new DAY LOSS');
  assert.equal(next.api.session.mode, 'LOSS'); assert.equal(next.api.state.night, false);
  assert.deepEqual(clone(next.api.state.dayFatalOutcome), saved.payload.dayFatalOutcome);
  assert.equal(next.api.state.world.totalMinutes, saved.payload.world.totalMinutes);
  assert.equal(next.api.state.hp, 0); assert.equal(next.api.state.worldMeta.eventSeq, before.eventSeq);
  assert.deepEqual(clone(next.api.state.worldMeta.replay), before.replay); assert.equal(next.api.state.worldMeta.rngState, before.rngState);
  assert.equal([...next.tasks.values()].filter(t => t.kind === 'interval').length, 0);
  const state = view(next); assert.equal(next.api.fatalQA.advance(1).ok, false); assert.deepEqual(view(next), state);
  observe(label, next, { saved: saved.artifact }); return next;
}

group('Actual original DAY timer fatal damage finalizes once after its command and normal writer Continue remains LOSS', () => {
  const r = scene('timer-real-normal-enemy', p => nearPlayer(p)), start = view(r), callbacks = [];
  const safe = native(r, 'timer-safe-before');
  for (let i = 0; i < 16 && r.api.state.hp > 0; i++) callbacks.push(tick(r));
  observe('timer-original-consumer-result', r, { before: start, safe: safe.artifact, callbackCount: callbacks.length,
    callbacks: callbacks.map(v => ({ id: v.id, sha256: v.sha256 })), primary: r.storage.get(saveKey) === safe.raw ? 'previous-safe-byte-identical' : 'changed' });
  assert.equal(r.api.state.hp, 0, 'actual authored normal enemy must cause lethal bite');
  const fact = fatal(r, 'day-combat', start.eventSeq), damage = events(r, 'combat.damage.applied', start.eventSeq).find(e => e.payload.targetId === 'player-1' && e.payload.after === 0);
  assert.ok(damage); assert.equal(damage.payload.sourceId, 'wz-4'); assert.equal(damage.payload.amount, 6);
  assert.equal(fact.slot.sourceEventId, damage.eventId); assert.equal(fact.slot.sourceId, 'wz-4');
  const time = events(r, 'time.advanced', start.eventSeq).at(-1); assert.ok(time.seq < fact.event.seq);
  const saved = native(r, 'timer-auto-final-loss', true);
  assert.equal(saved.payload.worldMeta.eventSeq, r.api.state.worldMeta.eventSeq);
  assert.equal(saved.payload.worldMeta.events.at(-1).eventId, r.api.state.worldMeta.events.at(-1).eventId);
  assert.deepEqual(saved.payload.dayFatalOutcome, fact.slot);
  const stopped = view(r); for (const callback of callbacks) callback.callback(); assert.deepEqual(view(r), stopped, 'queued old world callbacks inert');
  continueLoss(r, saved, 'timer-Continue-loss');
});

if (mode === 'candidate') {
group('Paid attack child fatal preserves real hit/5E/time, suppresses unreached kill rewards and needs no new command ID', () => {
  const r = scene('attack-child-fatal-max-safe', p => nearPlayer(p, { hp: 4, targetHp: 40, second: true }));
  const before = view(r), id = 'cmd-9007199254740990';
  const result = r.api.fatalQA.attack({ targetId: 'wz-4', commandId: id });
  observe('attack-child-fatal', r, { before, result });
  assert.equal(result.ok, false); assert.equal(result.reason, 'player-day-fatal');
  const fact = fatal(r, 'day-combat', before.eventSeq), interrupted = events(r, 'threat.attackInterrupted', before.eventSeq);
  assert.equal(interrupted.length, 1); assert.equal(interrupted[0].commandId, id);
  assert.equal(interrupted[0].payload.outcome.interrupted, true);
  assert.deepEqual(clone(interrupted[0].payload.payment.cost), { energy: 5 });
  assert.equal(interrupted[0].payload.payment.after.energy, before.energy - 5);
  assert.equal(interrupted[0].payload.hit.beforeHp, 40); assert.equal(interrupted[0].payload.hit.afterHp, -10);
  assert.equal(interrupted[0].payload.outcome.retaliationDamage, 0); assert.equal(interrupted[0].payload.outcome.salvage, 0);
  assert.equal(r.api.state.zombieKills || 0, before.zombieKills || 0, 'no unreached personal kill credit');
  const time = events(r, 'time.advanced', before.eventSeq); assert.equal(time.length, 1); assert.equal(time[0].payload.minutes, 10);
  assert.equal(time[0].commandId, 'cmd-9007199254740991'); assert.equal(time[0].causationId, id);
  const rejected = events(r, 'command.rejected', before.eventSeq).find(e => e.commandId === id); assert.ok(rejected);
  assert.ok(time[0].seq < interrupted[0].seq && interrupted[0].seq < rejected.seq && rejected.seq < fact.event.seq);
  assert.equal(r.api.state.worldMeta.commandSeq, Number.MAX_SAFE_INTEGER);
  assert.equal(events(r, 'threat.attacked', before.eventSeq).length, 0);
  const saved = native(r, 'attack-child-auto-final-loss', true); continueLoss(r, saved, 'attack-child-Continue');
  const stopped = view(r), duplicate = r.api.fatalQA.attack({ targetId: 'wz-4', commandId: id });
  assert.equal(duplicate.ok, false); assert.equal(duplicate.reason, 'session-frozen'); assert.deepEqual(view(r), stopped);
});

group('Paused original retaliation fatal retains gross payment and zero elapsed time; IO failure retry does not repeat loss', () => {
  const r = scene('paused-retaliation-write-failure', p => nearPlayer(p, { hp: 7, paused: true }));
  const safe = native(r, 'paused-safe-before'), before = view(r), backup = r.storage.get(saveKey + '.bak');
  r.instrumentation.setFailure = true;
  const result = r.api.fatalQA.attack({ targetId: 'wz-4', commandId: 'fatal-paused-player' });
  observe('paused-retaliation-failed-storage', r, { before, result });
  assert.equal(result.ok, false); assert.equal(result.reason, 'player-day-fatal');
  const fact = fatal(r, 'attack-retaliation', before.eventSeq), interrupted = events(r, 'threat.attackInterrupted', before.eventSeq)[0];
  assert.ok(interrupted); assert.equal(interrupted.payload.payment.after.energy, before.energy - 5);
  assert.equal(interrupted.payload.clock.elapsedMinutes, 0); assert.equal(interrupted.payload.advance.paused, true);
  assert.equal(interrupted.payload.outcome.retaliationDamage, 7); assert.equal(events(r, 'time.advanced', before.eventSeq).length, 0);
  assert.equal(r.api.state.world.totalMinutes, before.world.totalMinutes);
  assert.equal(r.storage.get(saveKey), safe.raw); assert.equal(r.storage.get(saveKey + '.bak'), backup, 'failed write does not alter primary or backup');
  assert.match([...r.nodes.values()].map(n => n.textContent).join('\n'), /未能保存|尚未保存|保存失败/);
  assert.equal(typeof r.api.fatalQA.retry, 'function'); r.instrumentation.setFailure = false;
  const seq = r.api.state.worldMeta.eventSeq, retried = r.api.fatalQA.retry();
  assert.ok(retried === true || retried?.ok === true); assert.equal(r.api.state.worldMeta.eventSeq, seq);
  assert.equal(events(r, 'player.dayFatal', before.eventSeq).length, 1); assert.deepEqual(clone(r.api.state.dayFatalOutcome), fact.slot);
  const saved = native(r, 'paused-retry-final-loss', true); continueLoss(r, saved, 'paused-retry-Continue');
});

group('Defensive registered content fallback in real midnight rest child keeps completed-minute and final ledger watermarks', () => {
  const r = scene('rest-midnight-content-fatal', p => { p.player.x = 10; p.player.y = 11; p.hp = 100;
    p.hour = 23; p.minute = 59; p.world.totalMinutes = 1439; p.worldMeta.clock.rate = 1; p.worldMeta.clock.paused = false; });
  const id = 'test-day-fatal-midnight-expiry', definition = { id, chainId: id, title: 'TEST-ONLY fatal fallback', phase: ['day_1'],
    nodes: [{ nodeId: 'waiting', choices: [{ id: 'wait', label: 'TEST-ONLY', effects: [{ op: 'recordHistory', key: id }] }] }],
    fallback: { ifMissingNpc: 'ledger_only', ifInsufficientPopulation: 'ledger_only', ifExpired: { id: 'expiry', effects: [{ op: 'addResource', key: 'hp', value: -100 }] }, ifSkipped: 'ledger_only' } };
  const sourceDefinitions = clone(r.api.fatalQA.content.all('eventChain'));
  assert.equal(r.api.fatalQA.content.register('eventChain', definition).ok, true);
  assert.equal(r.api.fatalQA.content.startChain(id, { actorId: 'camp-autonomy' }).ok, true);
  for (const [key, value] of Object.entries(sourceDefinitions)) assert.deepEqual(clone(r.api.fatalQA.content.get('eventChain', key)), value);
  const begin = r.api.fatalQA.requestRest(30, { commandId: 'rest-fatal-begin' }); assert.equal(begin.ok, true);
  const status = clone(r.api.fatalQA.rest.status()), before = view(r);
  const step = r.api.fatalQA.rest.tick({ restId: status.restId, expectedCompleted: 0, generation: status.generation, commandId: 'rest-fatal-step' });
  observe('rest-real-expired-fallback-result', r, { begin, step, before, defensiveRegistration: definition,
    productionStorylineContainsThisEffect: false, expectedFinalHp: 0 });
  assert.equal(r.api.state.world.totalMinutes, 1440); assert.equal(r.api.state.day, 2);
  assert.ok(events(r, 'content.effects.applied', before.eventSeq).some(e => e.payload.effects.some(v => v.key === 'hp' && v.value === -100)));
  const fact = fatal(r, 'content-effect', before.eventSeq), stepped = events(r, 'camp.rest.stepped', before.eventSeq);
  assert.equal(stepped.length, 1); assert.equal(stepped[0].payload.completed, 1); assert.equal(stepped[0].payload.restStep, 1);
  const finalStatus = r.api.fatalQA.rest.status(); assert.equal(finalStatus.active, false); assert.equal(finalStatus.completed, 1);
  assert.ok(stepped[0].seq < fact.event.seq);
  const saved = native(r, 'rest-auto-final-loss', true); assert.equal(saved.payload.worldMeta.eventSeq, r.api.state.worldMeta.eventSeq);
  continueLoss(r, saved, 'rest-fatal-Continue');
});

group('Real HP effect transaction only finalizes stable successful zero, never rollback or within-transaction heal', () => {
  for (const [name, effects, expectedHp, ok] of [
    ['rollback', [{ op: 'addResource', key: 'hp', value: -100 }, { op: 'addResource', key: 'not-a-real-resource', value: 1 }], 100, false],
    ['heal-in-same-transaction', [{ op: 'addResource', key: 'hp', value: -100 }, { op: 'addResource', key: 'hp', value: 17 }], 17, true],
    ['stable-fatal', [{ op: 'addResource', key: 'hp', value: -100 }], 0, true]
  ]) {
    const r = scene('effects-' + name, p => { p.hp = 100; }), before = view(r), effectId = 'test-effects-' + name;
    const result = r.api.command('TEST-ONLY unified effects', 'event.resolved', { effectId },
      () => r.api.contentEffects(effects, { actorId: 'player-1', effectId, defId: 'test-day-fatal-effects' }),
      { commandId: 'effects-' + name });
    observe('effects-' + name, r, { before, effects, result });
    assert.equal(result.ok, ok); assert.equal(r.api.state.hp, expectedHp);
    if (name === 'stable-fatal') {
      const fact = fatal(r, 'content-effect', before.eventSeq), applied = events(r, 'content.effects.applied', before.eventSeq);
      assert.equal(applied.length, 1); assert.equal(fact.slot.sourceEventId, applied[0].eventId);
      const settled = events(r, 'event.resolved', before.eventSeq); assert.equal(settled.length, 1); assert.ok(settled[0].seq < fact.event.seq);
      const saved = native(r, 'effects-auto-loss', true); continueLoss(r, saved, 'effects-Continue');
    } else {
      assert.equal(events(r, 'player.dayFatal', before.eventSeq).length, 0); assert.equal(r.api.state.dayFatalOutcome ?? null, null);
      assert.equal(r.api.state.gameOver, null); assert.equal(r.api.session.mode, 'DAY');
      assert.equal(events(r, 'content.effects.applied', before.eventSeq).length, name === 'rollback' ? 0 : 1);
      if (name === 'rollback') assert.deepEqual(clone(r.api.state.contentState), before.content);
      native(r, 'effects-' + name + '-normal');
    }
  }
});

group('Legacy HP0 without new fact stays recovery-only; original night report remains distinct and bad new capsule is rejected', () => {
  const original = open(fixtureBytes.toString('utf8'), 'original-old-writer-legacy'), migrated = events(original, 'save.migrated').length;
  assert.equal(original.api.state.dayFatalOutcome ?? null, null); assert.equal(events(original, 'player.dayFatal').length, 0);
  const saved = native(original, 'legacy-current-normal');
  const originalPrimary = original.storage.get(saveKey), originalBackup = original.storage.get(saveKey + '.bak');
  original.api.state.dayFatalOutcome = undefined;
  const undefinedWriter = original.api.save({ reason: 'TEST-ONLY own undefined capsule guard' });
  assert.equal(undefinedWriter, false, 'live own undefined capsule cannot disappear through JSON into legacy missing');
  assert.equal(original.storage.get(saveKey), originalPrimary); assert.equal(original.storage.get(saveKey + '.bak'), originalBackup);
  delete original.api.state.dayFatalOutcome;
  const reread = open(saved.raw, 'legacy-second-Continue'); assert.equal(events(reread, 'save.migrated').length, migrated);
  const p = clone(saved.payload); p.hp = 0; p.gameOver = null; delete p.dayFatalOutcome;
  const raw = envelope(p), input = artifact('legacy-hp0-null-no-fact.json', raw, true), broken = factory([[saveKey, raw]]);
  assert.equal(broken.api.validate({ raw, sourceCategory: 'primary' }).ok, true, 'old raw shape remains structurally readable');
  assert.equal(broken.api.boot.classification, 'RECOVERY_REQUIRED'); assert.equal(broken.api.start().ok, false);
  assert.equal(events(broken, 'player.dayFatal').length, 0); assert.equal(broken.storage.get(saveKey), raw);
  const oldNightPath = path.join(root, 'scripts/fixtures/legacy-save18/RESOLVED18-save.json'), oldNight = readFileSync(oldNightPath);
  const nightInput = artifact('original-RESOLVED18-native.json', oldNight, true), night = factory([[saveKey, oldNight.toString('utf8')]]);
  assert.equal(night.api.start().ok, true); assert.equal(night.api.session.mode, 'REPORT'); assert.equal(night.api.state.night, true);
  assert.equal(events(night, 'player.dayFatal').length, 0); assert.equal(night.api.state.dayFatalOutcome ?? null, null);
  assert.match(night.node('nightTitle').textContent, /尸潮|防守|报告/);
  observe('legacy-night-report-and-unrecorded-hp0', night, { input, nightInput, legacyClassification: broken.api.boot.classification });
  const real = scene('bad-slot-ancestry', payload => nearPlayer(payload, { hp: 7, paused: true }));
  real.api.fatalQA.attack({ targetId: 'wz-4', commandId: 'bad-slot-actual-fatal' });
  const genuine = native(real, 'bad-slot-actual-fatal', true);
  for (const [name, mutate] of [['future-tick', p => p.dayFatalOutcome.tick.world = p.world.totalMinutes + 1],
    ['unknown-version', p => p.dayFatalOutcome.version = 2]]) {
    const payload = clone(genuine.payload); mutate(payload); const raw = envelope(payload), descriptor = artifact('bad-slot-' + name + '.json', raw, true);
    const r = factory([[saveKey, raw]]), validated = r.api.validate({ raw, sourceCategory: 'primary' });
    assert.equal(validated.ok, false, 'bad new capsule fails actual validator');
    observations.push({ label: 'bad-slot-' + name, input: descriptor, validation: clone(validated) });
  }
});
}

assert.equal(sha(readFileSync(htmlPath)), sourceHtmlSha256, 'HTML immutable during execution');
assert.equal(sha(readFileSync(ioPath)), sha(ioBytes), 'IO immutable during execution');
assert.equal(sha(readFileSync(fileURLToPath(import.meta.url))), sha(checkerBytes), 'checker immutable during execution');
const passed = checks.filter(v => v.ok).length;
const report = { runner: 'source-day-fatal-outcome-v1', mode, sourceHtmlSha256, sourceHash: sourceHtmlSha256,
  ok: passed === checks.length, count: checks.length, passed, checks, observations, fixtures, artifacts,
  inputs: { checker: { sha256: sha(checkerBytes), bytes: checkerBytes.length }, io: { sha256: sha(ioBytes), bytes: ioBytes.length },
    ioRuntimeFactory: { sha256: sha(factorySource), bytes: Buffer.byteLength(factorySource) }, originalWriter },
  naturalGameplay: false, productionDeployment: false,
  scope: 'Controlled source VM with complete real writer and original source/IO. Actual timer/enemy/retaliation, Bus ordering, nested time, effects transaction, renderer, writer and Continue. No new Gate, death helper, damage or clock replacement. Registered midnight fatal fallback is TEST-ONLY defensive content, absent from production storylines.',
  limitations: 'No Chrome/pixel, human fun, natural survival/three-day, global arbitrary reducer rollback, or future content/plugin safety claim. IO shadows Canvas renderWorld/HUD/context only; actual report renderer remains under test.' };
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ runner: report.runner, mode, sourceHtmlSha256, ok: report.ok, count: report.count, passed, reportSha256: sha(readFileSync(out)) }));
if (!report.ok) process.exitCode = 1;
