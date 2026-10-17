#!/usr/bin/env node
/**
 * Execute the candidate's actual inline runtime in an isolated Node VM.
 * Browser DOM/storage/timers are controlled instrumentation; this is source
 * contract evidence, not a real browser, rendering or natural gameplay result.
 * Every fixture below is TEST-ONLY and uses the source writer's complete initial
 * payload. No reducer or classification implementation is copied into this test.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), options = {};
for (let index = 0; index < args.length; index += 2) {
  assert.ok(['--html','--production18-fixtures'].includes(args[index]) && typeof args[index + 1] === 'string' && path.isAbsolute(args[index + 1]), 'usage: node scripts/check-report-recovery.mjs [--html ABSOLUTE_HTML] [--production18-fixtures ABSOLUTE_DIR]');
  options[args[index]] = args[index + 1];
}
const htmlPath = options['--html'] || path.join(root, 'dist/index.html');
const source = readFileSync(htmlPath, 'utf8');
const sourceHash = createHash('sha256').update(source).digest('hex');
const inline = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(text => text.trim());
assert.equal(inline.length, 1, 'one inline runtime expected');
new vm.Script(inline[0], { filename: htmlPath });
const clone = value => JSON.parse(JSON.stringify(value));
const saveKey = 'zombie-harvest-progress-v12';
const checks = [];
function test(name, run) { try { run(); } catch (error) { error.message = `${name}: ${error.message}`; throw error; } checks.push(name); }

function runtime(entries = []) {
  const storage = new Map(entries), nodes = new Map(), listeners = new Map(), tasks = new Map(), canceled = [], captures = new Set();
  const instrumentation = { nextId: 1, reloads: 0, getFailure: false, setFailure: false, removeFailure: false, rendererCalls: 0, now: 1700000000000 };
  function node(id = '') {
    if (nodes.has(id)) return nodes.get(id);
    const classes = new Set();
    const item = { id, hidden: ['restoreBackupBtn','recoveryStatus','recoveryNotice'].includes(id), disabled: false, textContent: '', innerHTML: '', style: {}, dataset: {}, children: [], className: '', attrs: {},
      classList: { add(...values) { values.forEach(value => classes.add(value)); }, remove(...values) { values.forEach(value => classes.delete(value)); }, contains(value) { return classes.has(value); }, toggle(value, force) { const add = force ?? !classes.has(value); if (add) classes.add(value); else classes.delete(value); return add; } },
      addEventListener(type, callback) { const key = `${id}:${type}`; listeners.set(key, [...(listeners.get(key) || []), callback]); },
      setAttribute(key, value) { this.attrs[key] = value; }, getAttribute(key) { return this.attrs[key]; }, appendChild(child) { this.children.push(child); }, append(child) { this.children.push(child); }, prepend(child) { this.children.unshift(child); },
      querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; }, scrollIntoView() {}, remove() {},
      getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 }; },
      setPointerCapture(pointer) { captures.add(`${id}:${pointer}`); }, hasPointerCapture(pointer) { return captures.has(`${id}:${pointer}`); }, releasePointerCapture(pointer) { captures.delete(`${id}:${pointer}`); }
    };
    nodes.set(id, item); return item;
  }
  const localStorage = { getItem(key) { if (instrumentation.getFailure) throw new Error('TEST-ONLY storage read failure'); return storage.get(key) ?? null; },
    setItem(key, value) { if (instrumentation.setFailure) throw new Error('TEST-ONLY storage write failure'); storage.set(key, String(value)); },
    removeItem(key) { if (instrumentation.removeFailure) throw new Error('TEST-ONLY storage removal failure'); storage.delete(key); } };
  const sessionValues = new Map();
  const sessionStorage = { getItem: key => sessionValues.get(key) ?? null, setItem: (key, value) => sessionValues.set(key, String(value)), removeItem: key => sessionValues.delete(key) };
  const schedule = (kind, callback, delay) => { const id = instrumentation.nextId++; tasks.set(id, { kind, callback, delay }); return id; };
  const clear = id => { if (tasks.has(id)) canceled.push(tasks.get(id)); tasks.delete(id); };
  const window = { innerWidth: 1200, innerHeight: 800, localStorage, sessionStorage, location: { search: '', reload() { instrumentation.reloads++; } },
    addEventListener(type, callback) { listeners.set(`window:${type}`, [...(listeners.get(`window:${type}`) || []), callback]); }, matchMedia() { return { matches: false, addEventListener() {} }; } };
  const document = { hidden: false, body: node('body'), documentElement: node('html'), activeElement: null,
    getElementById: node, querySelector(selector) { return node(selector); }, querySelectorAll() { return []; }, createElement(tag) { return node(`created-${tag}-${nodes.size}`); },
    addEventListener(type, callback) { listeners.set(`document:${type}`, [...(listeners.get(`document:${type}`) || []), callback]); } };
  const context = vm.createContext({ console, window, document, localStorage, sessionStorage, URLSearchParams,
    Date: class extends Date { static now() { return instrumentation.now; } }, performance: { now: () => instrumentation.now },
    setTimeout: (callback, delay) => schedule('timeout', callback, delay), clearTimeout: clear,
    setInterval: (callback, delay) => schedule('interval', callback, delay), clearInterval: clear,
    requestAnimationFrame: callback => schedule('raf', callback, 0), cancelAnimationFrame: clear });
  // Skip only the unrelated final Canvas render at document bootstrap. Its
  // runtime functions remain defined; later non-report rendering is instrumented.
  const bootstrap = inline[0].replace(/    applySettings\(\);\s*    refreshStartScreen\(\);\s*    render\(\);\s*$/, '    applySettings();\n    refreshStartScreen();');
  assert.notEqual(bootstrap, inline[0], 'bootstrap render marker required');
  vm.runInContext(bootstrap + `
    // QA calls made before public start use the same explicitly prepared lookup
    // as the real loader. Installed calls use the committed directory instead.
    const qaLookupContext = () => BootRecovery.installed ? null : BootRecovery.scenarioContent;
    globalThis.qa = {
      get state() { return state; }, get boot() { return BootRecovery; }, get started() { return gameStarted; },
      session: SessionController, start: startFromSave, restore: restoreSelectedBackup,
      classify(payload) { return classifySavedRecovery(payload, qaLookupContext()); },
      validate(input) { return validateStoredProgress(input, qaLookupContext()); },
      validatePayload(payload) { return validateProgressPayload(payload, qaLookupContext()); },
      select(candidates, policy = {}) { return selectProgressSave(candidates, policy, qaLookupContext()); },
      prepare(selected, recovery, original = selected) { return prepareSavedPayload(selected, recovery, original, BootRecovery.scenarioContent || BootRecovery.draft?.scenarioContent); }, install: installSavedPayload,
      project: projectResolvedReport, renderReport: renderResolvedReport, hud: renderHud, identity: savedReportIdentity,
      close: continueMorning, command: actionCommand, dispatch: dispatchCommand, gather, commit: commitPlanMeeting, generatePlan: generatePlanMeeting, buildToggle: toggleBuild, checkpoint: requestCheckpoint, save: saveProgress, threatStart: startThreatEncounter, settleThreat: resolveNight, contentHook: runContentHook, contentEffects: applyContentEffects,
      worldStart: startWorldSimulation, battleStart: startBattleLoop, heldStart: startHeldMovement, repeatStart: startInteractionRepeat,
      scheduleWorld: scheduleWorldRender, scheduleContinuous: scheduleContinuousEntityPositions,
      registry: EVENT_DEFS, hash: checksum,
      writeInitial() { const result = startFromSave(); if (!result.ok) throw new Error('source initial start failed:' + result.reason); if (!saveProgress()) throw new Error('source initial writer failed'); return JSON.parse(localStorage.getItem(SAVE_KEY)).payload; },
      instrumentRendering() { renderWorld = renderHud = renderContext = () => {}; },
      armLifecycle() { gameStarted = true; SessionController.mode = 'DAY'; requestCheckpoint('TEST-ONLY queued race'); startWorldSimulation(); heldDirections.set('w', 1); startHeldMovement(); scheduleWorldRender(); scheduleContinuousEntityPositions(); resizeTimer = setTimeout(() => render(), 120); pointerId = 7; $('joystick').setPointerCapture(7); activeHudDrag = { pointerId: 8, handle: $('qa-handle'), panel: $('qa-panel') }; activeHudDrag.handle.setPointerCapture(8); state.motion.input = { x: 1, y: 1 }; },
      injectPreparationFailure() { prepareSavedRegistry = () => { throw new Error('TEST-ONLY late registry preparation failure'); }; },
      recoveryReload() { loadProgress(); refreshStartScreen(); },
      registryKeys() { return Object.keys(EVENT_DEFS); }
    };
  `, context, { filename: `${htmlPath}:instrumented-source` });
  const api = context.qa;
  api.instrumentRendering();
  const emit = (target, type, event = {}) => { for (const callback of listeners.get(`${target}:${type}`) || []) callback({ key: '', target: node(target), currentTarget: node(target), preventDefault() {}, ...event }); };
  return { api, storage, nodes, node, instrumentation, tasks, canceled, captures, document, context, emit };
}
function envelope(payload) {
  const r = runtime();
  return JSON.stringify({ ...payload, version: payload.version, payload, checksum: r.api.hash(payload), savedAt: (payload.day - 1) * 1440 + payload.hour * 60 + payload.minute });
}
const initialRuntime = runtime();
const initial = clone(initialRuntime.api.writeInitial());
assert.equal(initialRuntime.api.validatePayload(initial).ok, true, 'the actual source writer must produce a valid complete new save');
function report(extra = {}) {
  const payload = clone(initial); Object.assign(payload, { day: 1, hour: 6, minute: 10, night: true, gameOver: null }, extra);
  payload.world.totalMinutes = 370;
  payload.worldMeta = { ...payload.worldMeta, eventSeq: 11, commandSeq: 1, seenCommands: ['cmd-000001'], events: [
    { eventId: 'evt-000010', seq: 10, type: 'threat.started', actorId: 'player-1', commandId: 'cmd-000001', causationId: null, tick: { world: 370, phase: 0, schedule: 0 }, payload: { day: 1, hour: 6, enemyCount: 3 } },
    { eventId: 'evt-000011', seq: 11, type: 'threat.resolved', actorId: 'system', commandId: null, causationId: null, tick: { world: 370, phase: 0, schedule: 0 }, payload: { threatId: 'threat-1-6-10-10', kills: 3, breaches: 0, damage: 0, routeId: 'eastern-breach' } }
  ], replay: { seed: payload.worldMeta.seed, commands: [{ commandId: 'cmd-000001', type: 'threat.start', actorId: 'player-1', payload: null }] } };
  payload.nightBattle = { instanceId: 'threat-1-6-10-10', resolved: true, kills: 3, breaches: 0, finalDamage: 0, wallDamage: 1, npcDeaths: 0, autoKills: 2, feed: ['TEST-ONLY saved report'], routeId: 'eastern-breach' };
  return payload;
}
function closed(payload = report(), empty = false) {
  const p = clone(payload); p.worldMeta.eventSeq = 12; p.worldMeta.commandSeq = 2; p.worldMeta.seenCommands.push('cmd-000002');
  p.worldMeta.replay.commands.push({ commandId: 'cmd-000002', type: 'threat.close', actorId: 'player-1', payload: { threatId: p.nightBattle.instanceId } });
  p.worldMeta.events.push({ eventId: 'evt-000012', seq: 12, type: 'threat.closed', actorId: 'player-1', commandId: 'cmd-000002', causationId: null, tick: { world: 370, phase: 0, schedule: 0 }, payload: empty ? {} : { threatId: p.nightBattle.instanceId, day: 1, hour: 6, minute: 10 } });
  return p;
}
const events = (r, type) => r.api.state.worldMeta.events.filter(event => event.type === type);
const intervals = r => [...r.tasks.values()].filter(task => task.kind === 'interval');
function loaded(payload, extras = []) { return runtime([[saveKey, envelope(payload)], ...extras]); }

test('B1 complete saved report is pure and frozen; repeated start does not create timers or re-settle', () => {
  const p = report(), r = loaded(p); assert.equal(r.api.boot.classification, 'REPORT_PENDING'); const globalBefore = clone(r.api.state);
  assert.equal(r.api.started, false); assert.equal(r.api.state.hp, globalBefore.hp);
  r.api.start(); const installed = clone(r.api.state); assert.equal(r.node('summaryKills').textContent, '3'); assert.equal(r.node('summaryWalls').textContent, '1'); assert.equal(r.node('summaryMorale').textContent, '未记录');
  assert.equal(intervals(r).length, 0); r.api.start(); assert.deepEqual(clone(r.api.state), installed);
  r.emit('document','visibilitychange'); assert.deepEqual(clone(r.api.state), installed); assert.equal(intervals(r).length, 0); assert.equal(events(r,'threat.resolved').length, 1);
});
test('B2 contradictory night=false restores pending report and closes once via actual CommandBus', () => {
  const p = report({ night: false }), r = loaded(p); r.api.start(); assert.equal(r.api.state.night, true);
  const sanity = r.api.state.sanity, minute = r.api.state.world.totalMinutes;
  assert.equal(r.api.close({ commandId: 'qa-close' }).ok, true); assert.equal(r.api.state.sanity, Math.min(100, sanity + 3)); assert.equal(r.api.state.world.totalMinutes, minute); assert.equal(events(r,'threat.closed').length, 1); assert.equal(intervals(r).length, 1);
  const settled = clone(r.api.state); assert.equal(r.api.close({ commandId: 'qa-close' }).duplicate, true); assert.deepEqual(clone(r.api.state), settled);
  const count = r.tasks.size; assert.equal(r.api.close({ commandId: 'qa-close-other' }).ok, false); assert.equal(events(r,'threat.closed').length, 1); assert.equal(r.tasks.size, count); assert.equal(r.api.state.sanity, Math.min(100, sanity + 3));
  r.api.worldStart(); assert.equal(intervals(r).length, 1);
  r.api.hud();for(const id of ['gatherBtn','buildBtn','cropBtn','endDayBtn']) assert.equal(r.node(id).disabled,false,`${id} must be re-enabled by the actual DAY HUD renderer after report close`);
});
test('B3/B4 exact closed and legacy empty close clear only transients and persist one migration', () => {
  for (const oldEmpty of [false,true]) {
    const p = closed(report(), oldEmpty); p.night = false; p.food = 17; p.npcs[0].order = 'patrol';
    const r = loaded(p); assert.equal(r.api.boot.classification,'REPORT_ALREADY_CLOSED'); r.api.start();
    assert.equal(r.api.state.nightBattle,null); assert.equal(r.api.state.food,17); assert.equal(r.api.state.npcs[0].order,'patrol'); assert.equal(r.api.state.sanity,p.sanity); assert.equal(events(r,'threat.closed').length,1); assert.equal(events(r,'save.migrated').length,1);
    const saved = r.storage.get(saveKey), reload = runtime([[saveKey,saved]]); reload.api.start(); assert.equal(events(reload,'save.migrated').length,1); assert.equal(events(reload,'threat.closed').length,1);
  }
});
for (const [name, mutate] of [
  ['wrong-event-command', p => p.worldMeta.events[2].commandId = 'missing'],
  ['wrong-command-threat', p => p.worldMeta.replay.commands[1].payload.threatId = 'other'],
  ['wrong-command-type', p => p.worldMeta.replay.commands[1].type = 'event.resolve'],
  ['nonempty-missing-threat', p => p.worldMeta.events[2].payload = { day: 1 }],
  ['missing-replay', p => p.worldMeta.replay.commands.splice(1,1)],
  ['duplicate-command', p => p.worldMeta.replay.commands.push(clone(p.worldMeta.replay.commands[1]))],
  ['wrong-explicit-instance', p => p.nightBattle.instanceId = 'other'],
]) test(`B4 identity negative ${name} never opens DAY`, () => { const p = closed(); mutate(p); const r = loaded(p); assert.notEqual(r.api.boot.classification,'REPORT_ALREADY_CLOSED'); r.api.start(); assert.equal(intervals(r).length,0); assert.equal(r.api.started,false); });
test('B5 unique explicit legacy reference and known writer start/replay migrates original ID once', () => {
  const p = report(); p.nightBattle.id = p.nightBattle.instanceId; delete p.nightBattle.instanceId;
  const r = loaded(p); assert.equal(r.api.boot.classification,'REPORT_PENDING'); r.api.start(); assert.equal(r.api.state.nightBattle.instanceId,'threat-1-6-10-10'); assert.equal(events(r,'save.migrated').length,1); assert.equal(events(r,'threat.started').length,1);
  const next = runtime([[saveKey,r.storage.get(saveKey)]]); next.api.start(); assert.equal(events(next,'save.migrated').length,1);
});
test('B6 missing identity/arrays explicitly degrades without guessing, reward or close', () => {
  const p = report(); delete p.nightBattle.instanceId; delete p.nightBattle.feed;
  const r = loaded(p); assert.equal(r.api.boot.classification,'LEGACY_RESOLVED'); r.api.start(); assert.equal(r.api.state.nightBattle,null); assert.equal(r.api.state.sanity,p.sanity); assert.equal(events(r,'threat.closed').length,0); assert.equal(events(r,'save.migrated')[0].payload.instanceId,null); assert.equal(r.node('recoveryNotice').hidden,false);
  const next = runtime([[saveKey,r.storage.get(saveKey)]]); next.api.start(); assert.equal(events(next,'save.migrated').length,1);
});
test('B7 pure report projection/render keep source state/RNG/enemy arrays and missing data remain unrecorded', () => {
  const p = report(); for (const key of ['kills','breaches','finalDamage','wallDamage','npcDeaths','autoKills','feed']) delete p.nightBattle[key];
  for (const key of ['kills','breaches','damage']) delete p.worldMeta.events[1].payload[key];
  const r = loaded(p); r.api.start(); const before = clone(r.api.state), view = r.api.project(r.api.state,r.api.identity(r.api.state));
  r.api.renderReport(view); assert.deepEqual(clone(r.api.state),before);
  for (const id of ['summaryKills','summaryBreaches','summaryDamage','summaryWalls','summaryNpcDeaths','summaryMorale','waveDefense','waveSupport']) assert.equal(r.node(id).textContent,'未记录');
  assert.ok(!/NaN|undefined/.test(r.node('summaryFeed').textContent)); assert.equal(intervals(r).length,0);
});
test('actual pure report renderer displays only saved defense and unique original support identities',()=>{const p=report();p.nightBattle.defense=74;p.nightBattle.supportIds=['radio','doctor'];p.nightBattle.enemies=[{id:'TEST-ONLY-saved-enemy',hp:0,dead:true}];const r=loaded(p);r.api.start();const before=clone(r.api.state),raw=r.storage.get(saveKey),taskCount=r.tasks.size;const view=r.api.project(r.api.state,r.api.identity(r.api.state));assert.equal(view.defense,74);assert.equal(view.supportCount,2);r.api.renderReport(view);assert.equal(r.node('waveDefense').textContent,'74');assert.equal(r.node('waveSupport').textContent,'2');assert.deepEqual(clone(r.api.state),before);assert.equal(r.api.state.worldMeta.rngState,before.worldMeta.rngState);assert.deepEqual(clone(r.api.state.nightBattle.supportIds),p.nightBattle.supportIds);assert.deepEqual(clone(r.api.state.nightBattle.enemies),p.nightBattle.enemies);assert.equal(r.storage.get(saveKey),raw);assert.equal(r.tasks.size,taskCount);});
for(const [name,defense,supportIds] of [['explicit-zero-empty',0,[]],['missing',undefined,undefined],['bad-number','BROKEN',['radio']],['null-support',74,null],['mixed-support',74,['radio',{}]],['duplicate-support',74,['radio','radio']]])test(`saved report defense/support projection ${name} stays pure and never counts live NPCs`,()=>{const p=report();if(defense!==undefined)p.nightBattle.defense=defense;if(supportIds!==undefined)p.nightBattle.supportIds=supportIds;const r=loaded(p);r.api.start();const before=clone(r.api.state),view=r.api.project(r.api.state,r.api.identity(r.api.state));r.api.renderReport(view);assert.equal(r.node('waveDefense').textContent,Number.isFinite(defense)?String(defense):'未记录');const valid=Array.isArray(supportIds)&&supportIds.every(id=>typeof id==='string'&&id.length>0)&&new Set(supportIds).size===supportIds.length;assert.equal(r.node('waveSupport').textContent,valid?String(supportIds.length):'未记录');assert.deepEqual(clone(r.api.state),before);assert.equal(r.api.state.worldMeta.rngState,before.worldMeta.rngState);assert.equal(intervals(r).length,0);});
test('B8/B9 explicit and old loss persist lose, reject ordinary commands and provide dedicated restart', () => {
  for (const old of [false,true]) {
    const p = report({ hp: 0, gameOver: 'lose' }); if (old) delete p.gameOver;
    const r = loaded(p); r.api.start(); assert.equal(r.api.state.gameOver,'lose'); assert.equal(r.node('nightTitle').textContent,'营地失守'); assert.equal(r.node('continueBtn').textContent,'重新开始'); assert.equal(intervals(r).length,0);
    assert.equal(r.api.close({ commandId:'loss-close' }).ok,false); assert.equal(events(r,'threat.closed').length,0); assert.equal(r.api.command('gather','resource.collected',{},()=>({})).ok,false);
    if (old) assert.equal(JSON.parse(r.storage.get(saveKey)).payload.gameOver,'lose');
    r.emit('continueBtn','click'); assert.equal(r.instrumentation.reloads,1); assert.equal(r.storage.size,0); r.emit('window','pagehide'); assert.equal(r.storage.size,0);
  }
});
for (const [name, mutate] of [
  ['unknown-gameOver-at-zero-hp', p => { p.hp=0;p.gameOver='win'; }], ['wrong-gameOver-type', p => p.gameOver={}],
  ['isolated-zero-hp', p => { p.hp=0;p.night=false;p.nightBattle=null; }], ['lose-positive-hp', p => p.gameOver='lose'],
  ['unresolved', p => p.nightBattle.resolved=false], ['night-without-battle', p => p.nightBattle=null],
  ['partial-roster', p => p.npcs.pop()], ['duplicate-roster', p => p.npcs[1].id=p.npcs[0].id], ['unknown-roster', p => p.npcs[0].id='new-npc'],
  ['bad-resource-array', p => p.resources={}], ['late-worldzombie-shape', p => p.worldZombies=[null]], ['future-save', p => p.version=22], ['future-content', p => p.contentState.contentVersion=4],
]) test(`B10/B12 atomic safe recovery ${name}`, () => { const p=report();mutate(p);const r=loaded(p), before=clone(r.api.state), registry=r.api.registryKeys();assert.equal(r.api.boot.classification,'RECOVERY_REQUIRED');r.api.start();assert.deepEqual(clone(r.api.state),before);assert.deepEqual(r.api.registryKeys(),registry);assert.equal(intervals(r).length,0);assert.equal(r.api.started,false);assert.equal(r.node('recoveryStatus').hidden,false); });
test('B11 actual complete safe backup explicitly installs all saved domains and survives two boots', () => {
  const primary=report();primary.nightBattle.resolved=false;primary.food=99;
  const backup=clone(initial);backup.food=4;backup.wood=13;backup.npcs[0].hp=45;backup.npcs[0].lifeState='injured';
  const raw=envelope(backup), r=loaded(primary,[[`${saveKey}.bak`,raw]]);r.api.start();assert.equal(r.api.started,false);assert.equal(r.node('restoreBackupBtn').hidden,false);
  assert.equal(r.api.restore().ok,true);assert.equal(r.api.state.food,4);assert.equal(r.api.state.wood,13);assert.equal(r.api.state.npcs[0].hp,45);assert.equal(r.storage.get(`${saveKey}.bak`),raw);
  const migration=events(r,'save.migrated')[0].payload;assert.equal(migration.rollback,true);assert.equal(migration.sourceCategory,'backup');assert.equal(migration.selectedChecksum,JSON.parse(raw).checksum);
  for(let i=0;i<2;i++){const next=runtime([[saveKey,r.storage.get(saveKey)]]);next.api.start();assert.equal(next.api.state.food,4);assert.equal(events(next,'save.migrated').length,1);}
});
test('B13 malformed envelope never becomes a plain save; valid report backup is only used after public restore', () => {
  const backup=report(), raw=envelope(backup), r=runtime([[saveKey,'{"payload":[],"checksum":"fake"}'],[`${saveKey}.bak`,raw]]);
  assert.equal(r.api.boot.classification,'RECOVERY_REQUIRED');assert.equal(r.api.started,false);assert.equal(r.api.restore().ok,true);assert.equal(r.api.boot.classification,'REPORT_PENDING');assert.equal(r.node('summaryKills').textContent,'3');assert.equal(r.storage.get(`${saveKey}.bak`),raw);assert.equal(events(r,'save.migrated')[0].payload.originalChecksum,null);assert.equal(intervals(r).length,0);
});
test('B14 installed CP, plan, population identities, death/injury, guards and maintenance facts stay unchanged on report read', () => {
  const p=report();p.contentState.commandPoints=1;p.contentState.commandPointsMax=3;p.contentState.commandPointsGrantedDay=1;p.contentState.meters.campTrust=60;
  p.npcs[0].hp=0;p.npcs[0].lifeState='dead';p.npcs[0].supportRequested=false;p.npcs[0].order=null;p.npcs[1].hp=41;p.npcs[1].lifeState='injured';
  const guard=p.npcs.find(n=>n.id==='guardJi');guard.garrisonedOutpostId='watchPost';p.contentState.outposts.watchPost={guardNpcIds:['guardJi'],guardSlots:1,status:'secured',lastUpkeepDay:1};
  const r=loaded(p);r.api.start();assert.deepEqual(clone(r.api.state.contentState),p.contentState);assert.equal(r.api.state.npcs.length,10);assert.deepEqual(clone(r.api.state.npcs.map(n=>n.id)),p.npcs.map(n=>n.id));assert.equal(r.api.state.npcs[0].hp,0);assert.equal(r.api.state.npcs[1].hp,41);assert.equal(r.api.state.npcs.find(n=>n.id==='guardJi').garrisonedOutpostId,'watchPost');assert.deepEqual(clone(r.api.state.world),p.world);
});
test('late registry preparation failure preserves every authoritative field and registry key', () => {
  const r=runtime();r.api.injectPreparationFailure();r.storage.set(saveKey,envelope(report()));const before=clone(r.api.state), registry=r.api.registryKeys();r.api.recoveryReload();assert.equal(r.api.boot.classification,'RECOVERY_REQUIRED');r.api.start();assert.deepEqual(clone(r.api.state),before);assert.deepEqual(r.api.registryKeys(),registry);
});
test('backup migration write failure freezes and retries the same appended fact without overwriting safe backup', () => {
  const primary=report();primary.nightBattle.resolved=false;const raw=envelope(initial),r=loaded(primary,[[`${saveKey}.bak`,raw]]);r.instrumentation.setFailure=true;
  assert.equal(r.api.restore().ok,false);assert.equal(r.api.started,false);assert.equal(r.api.boot.savePending,true);assert.equal(intervals(r).length,0);assert.equal(events(r,'save.migrated').length,1);assert.equal(r.storage.get(`${saveKey}.bak`),raw);
  r.emit('window','pagehide');assert.equal(r.storage.get(`${saveKey}.bak`),raw);r.instrumentation.setFailure=false;assert.equal(r.api.start().ok,true);assert.equal(events(r,'save.migrated').length,1);assert.equal(r.api.boot.savePending,false);assert.equal(intervals(r).length,1);
});
test('B15/B16 restart fence cancels every tracked resource and stale callbacks/pagehide cannot recreate deleted saves', () => {
  const r=loaded(report());r.api.start();r.api.armLifecycle();const callbacks=[...r.tasks.values()].map(task=>task.callback);assert.ok([...r.tasks.values()].some(task=>task.delay===650));assert.equal(r.captures.size,2);
  r.api.session.restart({commandId:'qa-restart'});assert.equal(r.instrumentation.reloads,1);assert.equal(r.api.started,false);assert.equal(r.tasks.size,0);assert.equal(r.captures.size,0);assert.deepEqual(clone(r.api.state.motion.input),{x:0,y:0});assert.equal(r.storage.size,0);
  const before=clone(r.api.state);for(const callback of callbacks)callback(r.instrumentation.now+10000);r.emit('window','pagehide');r.document.hidden=true;r.emit('document','visibilitychange');r.document.hidden=false;r.instrumentation.now+=600000;r.emit('document','visibilitychange');r.emit('joystick','pointerup',{pointerId:7,clientX:1,clientY:1});assert.deepEqual(clone(r.api.state),before);assert.equal(r.storage.size,0);assert.equal(r.tasks.size,0);
  assert.equal(r.api.session.restart().duplicate,true);assert.equal(r.instrumentation.reloads,1);assert.equal(events(r,'threat.closed').length,0);assert.equal(events(r,'session.restart.accepted').length,1);
});
test('restart storage removal failure remains fenced and reports failure rather than reloading', () => {
  const r=loaded(report());r.api.start();r.instrumentation.removeFailure=true;assert.equal(r.api.session.restart().ok,false);assert.equal(r.instrumentation.reloads,0);assert.equal(r.api.session.exiting,true);r.emit('window','pagehide');assert.equal(r.storage.size,1);r.instrumentation.removeFailure=false;assert.equal(r.api.session.restart().ok,true);assert.equal(r.storage.size,0);assert.equal(r.instrumentation.reloads,1);
});
test('storage read failure is an explicit recovery error, not a new game', () => { const r=runtime();r.instrumentation.getFailure=true;r.api.recoveryReload();assert.equal(r.api.boot.reason,'storage-unavailable');r.api.start();assert.equal(r.api.started,false);assert.equal(intervals(r).length,0); });
test('declared inline farm favicon avoids an implicit unconfigured /favicon.ico request', () => assert.match(source, /<link rel="icon" href="data:image\/svg\+xml,/));
test('actual public start plus queued source checkpoint writes a consistent initial world without the fixture writer helper',()=>{
  const r=runtime();r.emit('continueSaveBtn','click');const checkpoint=[...r.tasks.values()].find(task=>task.kind==='timeout'&&task.delay===650);assert.ok(checkpoint);checkpoint.callback();
  const raw=r.storage.get(saveKey),saved=JSON.parse(raw);assert.equal(saved.payload.version,21);assert.equal(saved.savedAt,360);assert.equal(saved.payload.world.totalMinutes,360);assert.equal(r.api.validate({raw,sourceCategory:'primary'}).ok,true);const next=runtime([[saveKey,raw]]);next.emit('continueSaveBtn','click');assert.equal(next.api.started,true);assert.equal(intervals(next).length,1);
});

test('RECOVERY and exited DAY reject direct gather/plan/CommandBus and UI building paths without any mutation', () => {
  for (const mode of ['recovery','exited']) {
    const p=report();p.nightBattle.resolved=false;const r=mode==='recovery'?loaded(p):runtime();
    if(mode==='exited'){r.api.start();r.api.session.restart();}
    const before=clone(r.api.state), taskCount=r.tasks.size;
    assert.equal(r.api.gather().ok,false);assert.equal(r.api.commit('plan-defend-core-001').ok,false);
    assert.equal(r.api.dispatch({type:'arbitrary-direct-command'},()=>{throw new Error('fenced reducer ran');}).ok,false);
    r.api.buildToggle();assert.deepEqual(clone(r.api.state),before);assert.equal(r.tasks.size,taskCount);
  }
});
test('ordinary gameOver action gate remains rejected even if a malformed caller labels the session DAY', () => { const r=loaded(report({hp:0,gameOver:'lose'}));r.api.start();r.api.session.mode='DAY';assert.equal(r.api.command('player.eat','player.ate',{},()=>{throw new Error('gameOver reducer ran');},{allowNight:true}).reason,'game-over'); });
for (const [name,mutate] of [
  ['missing-NPC-needs',p=>delete p.npcs[0].needs],['missing-current-CP',p=>delete p.contentState.commandPoints],['missing-current-plan',p=>delete p.contentState.planMeeting],
  ['missing-current-flags',p=>delete p.contentState.flags],['missing-current-effects',p=>delete p.contentState.appliedEffects],['missing-current-history',p=>delete p.contentState.history],
  ['internal-ledger-gap',p=>{p.worldMeta.eventSeq=13;p.worldMeta.events.push({...clone(p.worldMeta.events[1]),eventId:'evt-000013',seq:13,type:'qa-fixture',payload:{}});}],
  ['backwards-start-tick',p=>{p.worldMeta.events[0].tick.world=371;p.world.totalMinutes=372;p.minute=12;}],
  ['conflicting-report-result',p=>p.nightBattle.kills=4],['negative-resource',p=>p.resources[0].amount=-1],
  ['bad-NPC-wounds',p=>p.npcs[0].wounds=[null]],['bad-meter',p=>p.contentState.meters.campTrust='unknown'],
  ['bad-NPC-memory-list',p=>p.npcs[0].memory.importantEvents={}],['empty-NPC-needs',p=>p.npcs[0].needs={}],['empty-NPC-relations',p=>p.npcs[0].relations={}],
  ['empty-current-attributes',p=>p.npcs[0].attributes={}],['empty-current-hero',p=>p.npcs[0].hero={}],
  ['missing-plan-instance',p=>delete p.contentState.planMeeting.instanceId],['missing-plan-day',p=>delete p.contentState.planMeeting.meetingDay],['missing-plan-version',p=>delete p.contentState.planMeeting.version],
  ['null-scheduled-event',p=>p.contentState.scheduledEvents=[null]],['array-scheduled-event',p=>p.contentState.scheduledEvents=[[]]],
  ['missing-scheduled-id',p=>p.contentState.scheduledEvents=[{dueDay:1,payload:{}}]],['fractional-scheduled-day',p=>p.contentState.scheduledEvents=[{id:'invalid',dueDay:1.5,payload:{}}]],['zero-scheduled-day',p=>p.contentState.scheduledEvents=[{id:'invalid',dueDay:0,payload:{}}]],['null-scheduled-payload',p=>p.contentState.scheduledEvents=[{id:'invalid',dueDay:1,payload:null}]],
  ['duplicate-scheduled-id',p=>p.contentState.scheduledEvents=[{id:'duplicate',dueDay:1,payload:{}},{id:'duplicate',dueDay:2,payload:{}}]],
  ['bad-NPC-sanity',p=>p.npcs[0].sanity='BROKEN'],['bad-NPC-morale',p=>p.npcs[0].morale='BROKEN'],['negative-NPC-sanity-clock',p=>p.npcs[0].sanityClock=-12],
  ['negative-NPC-need-clock',p=>p.npcs[0].needClock=-1],['bad-NPC-work-clock',p=>p.npcs[0].workClock='BROKEN'],['negative-NPC-movement-clock',p=>p.npcs[0].simMoveClock=-1],['fractional-NPC-work-sequence',p=>p.npcs[0].workPulseSeq=1.5],['excess-NPC-bond',p=>p.npcs[0].bond=4],
  ['object-NPC-event-receipt',p=>p.npcs[0].eventChain.resolved=[{}]],['missing-NPC-event-active',p=>delete p.npcs[0].eventChain.active],['negative-NPC-event-cooldown',p=>p.npcs[0].eventChain.cooldown=-1],['fractional-NPC-event-step',p=>p.npcs[0].eventChain.step=1.5],['array-NPC-active-event',p=>p.npcs[0].eventChain.active=[]],
  ['empty-NPC-perception',p=>p.npcs[0].perception={}],['null-NPC-perception-contact',p=>p.npcs[0].perception.contacts={invalid:null}],['bad-NPC-personality',p=>p.npcs[0].personality.courage='BROKEN'],['object-NPC-known-fact',p=>p.npcs[0].relations.knowledgeOfPlayer.facts=[{}]],
  ['null-content-history',p=>p.contentState.history=[null]],['invalid-active-chain',p=>p.contentState.activeChains={invalid:null}],['negative-autonomy-weight',p=>p.contentState.autonomyWeights.defense=-1],
  ['empty-relay-project',p=>p.relayProject={}],['empty-camp-standing',p=>p.campStanding={}],['negative-frontier-clock',p=>p.world.frontierClock=-3],['invalid-relay-participant',p=>p.relayProject.assignedNpcIds=[{}]],
]) test(`extended source recovery negative ${name}`,()=>{const p=report();mutate(p);const r=loaded(p),before=clone(r.api.state);assert.equal(r.api.boot.classification,'RECOVERY_REQUIRED');r.api.start();assert.deepEqual(clone(r.api.state),before);assert.equal(intervals(r).length,0);});
for(const key of ['unlockedTech','unlockedWeapons','unlockedBlueprints','triggeredEvents','completedChains','appliedEffects']) test(`persistent content ID list ${key} rejects object members before installation`,()=>{const p=report();p.contentState[key]=[{}];const r=loaded(p),before=clone(r.api.state);assert.equal(r.api.boot.classification,'RECOVERY_REQUIRED');r.api.start();assert.deepEqual(clone(r.api.state),before);assert.equal(intervals(r).length,0);});
for(const key of ['energy','sanity','sanityClock','sanityLastReason','morale','relayProject','campStanding','collection','motion','settings','quests']) test(`envelope mirror conflict ${key} cannot bypass payload checksum`,()=>{const parsed=JSON.parse(envelope(initial));parsed[key]=null;const r=runtime([[saveKey,JSON.stringify(parsed)]]);assert.equal(r.api.boot.classification,'RECOVERY_REQUIRED');assert.equal(r.api.boot.candidates[0].reason,`mirror-conflict:${key}`);assert.equal(r.api.started,false);});
test('a genuine envelope can omit redundant mirrors while preserving its validated complete payload',()=>{const full=JSON.parse(envelope(initial)),raw=JSON.stringify({version:full.version,payload:full.payload,checksum:full.checksum,savedAt:full.savedAt});const r=runtime([[saveKey,raw]]);assert.equal(r.api.boot.classification,'DAY');assert.equal(r.api.start().ok,true);assert.equal(r.api.state.food,initial.food);});
test('recorded stamina exhaustion date and minute survive whole-save installation and a source writer round trip',()=>{const p=clone(initial);p.staminaExhaustedDay=1;p.staminaExhaustedAt=359;const r=loaded(p);assert.equal(r.api.start().ok,true);assert.equal(r.api.state.staminaExhaustedDay,1);assert.equal(r.api.state.staminaExhaustedAt,359);assert.equal(r.api.save(),true);const next=runtime([[saveKey,r.storage.get(saveKey)]]);assert.equal(next.api.start().ok,true);assert.equal(next.api.state.staminaExhaustedDay,1);assert.equal(next.api.state.staminaExhaustedAt,359);});
test('actual content effect writer creates a valid schedule and real onDayStart safely consumes it after reload',()=>{const r=runtime();r.api.start();assert.equal(r.api.contentEffects([{op:'scheduleEvent',eventId:'TEST-ONLY-scheduled',dueDay:1,payload:{}}],{effectId:'TEST-ONLY-schedule-effect'}).ok,true);assert.equal(r.api.save(),true);assert.equal(r.api.validate({raw:r.storage.get(saveKey),sourceCategory:'primary'}).ok,true);const next=runtime([[saveKey,r.storage.get(saveKey)]]);assert.equal(next.api.start().ok,true);assert.doesNotThrow(()=>next.api.contentHook('onDayStart'));assert.deepEqual(clone(next.api.state.contentState.scheduledEvents),[]);assert.ok(next.api.state.contentState.triggeredEvents.includes('TEST-ONLY-scheduled'));});
test('current raw SAVE21 object without checksum is not accepted by a legacy plain adapter',()=>{const r=runtime([[saveKey,JSON.stringify(initial)]]);assert.equal(r.api.boot.classification,'RECOVERY_REQUIRED');assert.equal(r.api.started,false);});
test('source writer retains a truly exhausted resource after two actual gather commands; zero never refills',()=>{
  const r=runtime();r.api.start();const resource=r.api.state.resources.find(item=>item.type==='tree'&&item.amount===2);r.api.state.player.x=resource.x;r.api.state.player.y=resource.y;
  const before=r.api.state.wood;r.api.gather(resource);r.api.gather(resource);assert.equal(resource.amount,0);assert.ok(r.api.state.wood>before);assert.equal(r.api.save(),true);
  assert.equal(r.api.state.player.id,'player-1','fresh draft keeps the nonserialized runtime identity required by actual NPC perception');
  const written=JSON.parse(r.storage.get(saveKey));assert.equal(written.payload.resources.find(item=>item.id===resource.id).amount,0);const saveCheck=r.api.validate({raw:r.storage.get(saveKey),sourceCategory:'primary'});assert.equal(saveCheck.ok,true,saveCheck.reason);
  const next=runtime([[saveKey,r.storage.get(saveKey)]]);next.api.start();assert.equal(next.api.state.resources.find(item=>item.id===resource.id).amount,0);assert.equal(next.api.state.wood,r.api.state.wood);
});
test('B16 23:59 saved report remains frozen through visibility catchup; closing preserves the calendar and starts only one timer',()=>{
  const p=report();Object.assign(p,{day:2,hour:23,minute:59});p.world.totalMinutes=2879;p.world.lastRationDay=2;p.world.lastDailyUpkeepDay=2;p.contentState.commandPointsGrantedDay=2;
  const id='threat-2-23-59-10';p.nightBattle.instanceId=id;p.worldMeta.events[0].tick.world=2879;p.worldMeta.events[0].payload.day=2;p.worldMeta.events[0].payload.hour=23;p.worldMeta.events[1].tick.world=2879;p.worldMeta.events[1].payload.threatId=id;
  const r=loaded(p);r.api.start();const before=clone(r.api.state);r.instrumentation.now+=600000;r.emit('document','visibilitychange');assert.deepEqual(clone(r.api.state),before);assert.equal(intervals(r).length,0);assert.equal(r.node('waveZombies').textContent,'0');
  assert.equal(r.api.close({commandId:'midnight-close'}).ok,true);assert.equal(r.api.state.day,2);assert.equal(r.api.state.hour,23);assert.equal(r.api.state.minute,59);assert.equal(r.api.state.food,p.food);assert.equal(intervals(r).length,1);r.api.worldStart();assert.equal(intervals(r).length,1);
});
test('TEST-ONLY declared SAVE19/content1 adapter adds empty authority domains without historical rewards',()=>{
  const p=clone(initial);p.version=19;p.contentState={contentVersion:1,meters:{campCollapse:7,resonancePressure:31},flags:{'old-recorded-flag':true},unlockedTech:['defense_t1'],unlockedWeapons:['rustAxe'],unlockedBlueprints:[],scheduledEvents:[],triggeredEvents:[],activeChains:{},completedChains:[],appliedEffects:['old-earned-effect'],outposts:{},history:[]};
  for(const npc of p.npcs){delete npc.attributes;delete npc.hero;delete npc.garrisonedOutpostId;}
  const r=loaded(p);assert.equal(r.api.start().ok,true);assert.equal(r.api.state.food,p.food);assert.equal(r.api.state.contentState.commandPoints,0);assert.equal(r.api.state.contentState.commandPointsMax,0);assert.equal(r.api.state.contentState.commandPointsGrantedDay,p.day);assert.equal(r.api.state.contentState.planMeeting.status,'idle');assert.deepEqual(clone(r.api.state.contentState.appliedEffects),p.contentState.appliedEffects);assert.equal(events(r,'save.migrated').length,1);
});
test('TEST-ONLY declared SAVE19 adapter rejects malformed or future explicit authority instead of erasing it',()=>{const p=clone(initial);p.version=19;p.contentState.contentVersion=1;for(const npc of p.npcs){delete npc.attributes;delete npc.hero;delete npc.garrisonedOutpostId;}for(const change of [p=>p.contentState.commandPoints='BROKEN',p=>p.contentState.commandPoints=false,p=>p.contentState.commandPointsMax=2,p=>p.contentState.commandPointsGrantedDay=-1,p=>p.contentState.planMeeting={},p=>p.contentState.planMeeting.status='candidate']){const broken=clone(p);change(broken);const r=loaded(broken);assert.equal(r.api.boot.classification,'RECOVERY_REQUIRED');assert.equal(r.api.started,false);}});
test('TEST-ONLY declared SAVE20/content2 adapter preserves nonzero spent CP and complete existing plan snapshot',()=>{
  const maker=runtime();maker.api.start();maker.api.state.contentState.meters.campTrust=60;maker.api.state.contentState.commandPoints=1;maker.api.state.contentState.commandPointsMax=3;maker.api.generatePlan();maker.api.save();const p=JSON.parse(maker.storage.get(saveKey)).payload;p.version=20;p.contentState.contentVersion=2;delete p.contentState.npcRoster;
  for(const npc of p.npcs){delete npc.attributes;delete npc.hero;delete npc.garrisonedOutpostId;}
  const r=loaded(p);assert.equal(r.api.start().ok,true);assert.equal(r.api.state.contentState.commandPoints,1);assert.equal(r.api.state.contentState.commandPointsMax,3);assert.deepEqual(clone(r.api.state.contentState.planMeeting),p.contentState.planMeeting);assert.equal(events(r,'save.migrated').length,1);assert.equal(events(r,'plan.meeting.candidates').length,p.worldMeta.events.filter(e=>e.type==='plan.meeting.candidates').length);
  const broken=clone(p);delete broken.contentState.planMeeting;assert.equal(loaded(broken).api.boot.classification,'RECOVERY_REQUIRED');const badType=clone(p);badType.contentState.flags=[];assert.equal(loaded(badType).api.boot.classification,'RECOVERY_REQUIRED');
});
test('TEST-ONLY forced actual source settlement records its real moraleAfter; pure renderer retains fifth-day relay story',()=>{
  const r=runtime();r.api.start();assert.equal(r.api.threatStart().ok,true);const battle=r.api.state.nightBattle;r.api.settleThreat(battle.count,battle.defense);assert.equal(battle.moraleAfter,r.api.state.morale);assert.equal(intervals(r).length,0);assert.equal(r.node('summaryMorale').textContent,String(r.api.state.morale));
  const before=clone(r.api.state),view=r.api.project(r.api.state,r.api.identity(r.api.state));r.api.renderReport({...view,date:{day:5,hour:6,minute:0},routeId:'relay-guided-west'});assert.equal(r.node('nightTitle').textContent,'中继引导改变了危机路线');assert.match(r.node('nightCopy').textContent,/最终危机被引向可控路线/);assert.deepEqual(clone(r.api.state),before);
});
const production18Evidence=[];
const production18Directory=options['--production18-fixtures']||path.join(root,'scripts','fixtures','legacy-save18');
const production18Expected={DAY18:'0fe3b3e33d630621feb20cba3bb08b4db7cef247464d3b32f748c3c17bf829c3',RESOLVED18:'1d10ec233d64ce9a0cedf3eae44fa1e6706065c0ff37ba3e13f5b663451d2d1e',CLOSED18:'5413783b32ebae6cc798593e90f034da596e17b20cda71b606054c8180b1b960','INITIAL18-reload':'3ae5ff906cfb1d6e50c9b5ea9467896f2537e64bfaab44b0c897984baa6ae460'};
{
  for(const kind of ['DAY18','RESOLVED18','CLOSED18','INITIAL18-reload']) {
    const raw=readFileSync(path.join(production18Directory,`${kind}-save.json`),'utf8'), original=JSON.parse(raw), p=original.payload;
    const digest=createHash('sha256').update(raw).digest('hex');
    assert.equal(digest,production18Expected[kind],`${kind} bytes must remain the verified real production18 writer original`);
    assert.equal(p.version,18);assert.equal(Object.hasOwn(p,'contentState'),false);assert.equal(p.npcs.length,10);
    const record={kind,originalSha256:digest,originalChecksum:original.checksum,originalDate:{day:p.day,hour:p.hour,minute:p.minute},originalEventSeq:p.worldMeta.eventSeq};production18Evidence.push(record);
    test(`actual production18 writer ${kind} migrates once and preserves all original persistent domains`,()=>{
      const r=runtime([[saveKey,raw]]);assert.notEqual(r.api.boot.classification,'RECOVERY_REQUIRED',JSON.stringify(r.api.boot.diagnostics));assert.equal(r.api.start().ok,true);
      const migrated=JSON.parse(r.storage.get(saveKey));assert.equal(migrated.payload.version,21);assert.equal(migrated.checksum,r.api.hash(migrated.payload));assert.equal(migrated.savedAt,original.savedAt);
      for(const key of ['day','hour','minute','hp','energy','wood','stone','food','seeds','parts','medicine','morale','sanity','sanityClock','campaign','campStanding','specialItems','relayProject','hordeForecast','world','quests','player','buildings','resources','landmarks','visitedRegions','areaFlags','roleVacancies']) assert.deepEqual(clone(migrated.payload[key]),kind==='INITIAL18-reload'&&key==='world'?{...clone(p.world),totalMinutes:360}:clone(p[key]),`${kind}:${key}`);
      for(const npc of p.npcs){const restored=migrated.payload.npcs.find(item=>item.id===npc.id);for(const key of Object.keys(npc)){const expected=key==='memory'&&!Object.hasOwn(npc.memory,'relayCoreHandoff')?{...clone(npc.memory),relayCoreHandoff:null}:clone(npc[key]);assert.deepEqual(clone(restored[key]),expected,`${kind}:${npc.id}:${key}`);}assert.equal(restored.hero.status,['commander','radio','doctor'].includes(npc.id)?'promoted':'locked');}
      assert.equal(migrated.payload.contentState.commandPoints,0);assert.equal(migrated.payload.contentState.commandPointsMax,0);assert.equal(migrated.payload.contentState.commandPointsGrantedDay,p.day);assert.equal(migrated.payload.contentState.planMeeting.status,'idle');assert.equal(migrated.payload.contentState.planMeeting.candidates.length,0);
      const migration=events(r,'save.migrated');assert.equal(migration.length,1);assert.equal(migration[0].payload.adapter,'save18-pre-content-to-save21');assert.equal(migration[0].payload.originalChecksum,original.checksum);assert.equal(migration[0].payload.sourceCategory,'primary');assert.equal(migration[0].payload.rollback,false);
      const handoffMissing=p.npcs.filter(npc=>!Object.hasOwn(npc.memory,'relayCoreHandoff')).map(npc=>npc.id);
      assert.deepEqual(clone(migration[0].payload.npcRelayHandoffMemoryAdapters),[{adapter:'npc-relay-handoff-memory-v1',npcIds:handoffMissing,defaultValue:null}],`${kind}: exact missing-slot null adapter in original roster order`);
      assert.equal(migration[0].payload.reason.split(',').filter(reason=>reason==='npc-relay-handoff-memory-v1').length,1);
      assert.equal(migration[0].payload.reason.split(',').at(-1),'npc-relay-handoff-memory-v1');
      assert.equal(migration[0].payload.addedDomains.filter(domain=>domain==='npc.memory.relayCoreHandoff').length,1);
      assert.equal(migration[0].payload.addedDomains.at(-1),'npc.memory.relayCoreHandoff');
      assert.equal(migrated.payload.npcs.every(npc=>Object.hasOwn(npc.memory,'relayCoreHandoff')&&npc.memory.relayCoreHandoff===null),true,`${kind}: no historical source backfill`);
      if(kind==='INITIAL18-reload'){assert.equal(p.world.totalMinutes,0);assert.equal(p.worldMeta.eventSeq,0);assert.match(migration[0].payload.reason,/save18-initial-clock-sentinel/);assert.deepEqual(clone(migration[0].payload.worldClockCorrection),{before:0,after:360,calendarUnchanged:true,writer:'SAVE18-initial-sentinel'});assert.equal(events(r,'time.advanced').length,0);}else assert.equal(migration[0].payload.worldClockCorrection,undefined);
      assert.equal(events(r,'npc.promotion.completed').length,p.worldMeta.events.filter(event=>event.type==='npc.promotion.completed').length);assert.equal(events(r,'plan.meeting.generated').length,0);
      for(let i=0;i<2;i++){const next=runtime([[saveKey,r.storage.get(saveKey)]]);assert.equal(next.api.start().ok,true);assert.equal(events(next,'save.migrated').length,1);assert.deepEqual(clone(events(next,'save.migrated')[0].payload.npcRelayHandoffMemoryAdapters),clone(migration[0].payload.npcRelayHandoffMemoryAdapters));assert.deepEqual(clone(next.api.state.npcs.map(npc=>npc.memory)),clone(migrated.payload.npcs.map(npc=>npc.memory)));assert.equal(next.api.state.contentState.commandPoints,0);}
    });
    for(const [name,mutate] of [['explicit-null-content',p=>p.contentState=null],['explicit-array-content',p=>p.contentState=[]],['partial-old-roster',p=>p.npcs.pop()],['missing-old-needs',p=>delete p.npcs[0].needs],['world-calendar-conflict',p=>p.world.totalMinutes-=1],['missing-old-morale',p=>delete p.npcs[0].morale],['invalid-old-SAN',p=>p.npcs[0].sanity='BROKEN'],['negative-old-SAN-clock',p=>p.npcs[0].sanityClock=-1],['missing-old-event-chain-step',p=>delete p.npcs[0].eventChain.step],['object-old-event-receipt',p=>p.npcs[0].eventChain.resolved=[{}]],['missing-old-perception-clock',p=>delete p.npcs[0].perception.clock]]) test(`actual production18 derived negative ${kind}/${name}`,()=>{const broken=clone(p);mutate(broken);const r=runtime([[saveKey,envelope(broken)]]);assert.equal(r.api.boot.classification,'RECOVERY_REQUIRED');assert.equal(r.api.started,false);assert.equal(intervals(r).length,0);});
    if(kind==='INITIAL18-reload')for(const [name,mutate] of [['noninitial-day',p=>p.day=2],['noninitial-minute',p=>p.minute=1],['nonzero-command-watermark',p=>p.worldMeta.commandSeq=1],['nonzero-event-watermark',p=>{p.worldMeta.eventSeq=1;p.worldMeta.events=[{eventId:'evt-000001',seq:1,type:'TEST-ONLY-forged-initial-history',actorId:'system',commandId:null,causationId:null,tick:{world:360,phase:0,schedule:0},payload:{}}];}],['other-world-counter',p=>p.world.totalMinutes=1]])test(`actual INITIAL18 narrow sentinel negative ${name}`,()=>{const broken=clone(p);mutate(broken);const r=runtime([[saveKey,envelope(broken)]]);assert.equal(r.api.boot.classification,'RECOVERY_REQUIRED');assert.equal(r.api.started,false);});
  }
}

console.log(JSON.stringify({ ok: true, runner: 'source-report-recovery', sourceHash, checks: checks.length, instrumentation: 'Node VM / TEST-ONLY fixtures plus explicitly supplied real production18 writer originals / controlled DOM-storage-timers; not browser or natural gameplay', production18Evidence, production18Coverage: production18Evidence.length?'real writer originals supplied':'not run; supply --production18-fixtures for release compatibility gate', checksPassed: checks }, null, 2));
