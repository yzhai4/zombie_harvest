import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Fresh short natural mixed route. No init-script, save seeding, VM, hidden
// action API, or live GameState writes. Full writer reads verify outcomes and
// provide a separately disclosed conservative safety veto, never goal rewards.
const opts = {};
for (let i = 2; i < process.argv.length; i += 2) {
  assert.ok(['--html', '--out', '--expect-html-sha256', '--budget-seconds'].includes(process.argv[i]) && process.argv[i + 1], 'usage: --html ABS --out NEW_ABS --expect-html-sha256 SHA [--budget-seconds 480]');
  opts[process.argv[i]] = process.argv[i + 1];
}
assert.ok(path.isAbsolute(opts['--html'] || '') && path.isAbsolute(opts['--out'] || ''));
assert.match(opts['--expect-html-sha256'] || '', /^[a-f0-9]{64}$/);
const budgetSeconds = Number(opts['--budget-seconds'] || 480); assert.ok(Number.isInteger(budgetSeconds) && budgetSeconds > 0 && budgetSeconds <= 480);
const out = opts['--out'], root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.equal(existsSync(out), false, 'new output required; never overwrite or resume a prior natural route'); mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = readFileSync(opts['--html']), sourceHash = sha(source); assert.equal(sourceHash, opts['--expect-html-sha256']);
const runner = readFileSync(fileURLToPath(import.meta.url)), sprites = readFileSync(path.join(root, 'dist/actor-sprites.js'));
const protocol = readFileSync(path.join(root, 'docs/qa/natural-play-protocol-20261017.md'));
writeFileSync(path.join(out, 'source.html'), source); writeFileSync(path.join(out, 'runner-executed.mjs'), runner); writeFileSync(path.join(out, 'actor-sprites-executed.js'), sprites);
writeFileSync(path.join(out, 'protocol-executed.md'), protocol);
const key = 'zombie-harvest-progress-v12', startedAt = Date.now(), deadline = startedAt + budgetSeconds * 1000;
const budgets = { wallSeconds: budgetSeconds, meaningfulActions: 10, meals: 2, daytimeAttacks: 4,
  stopPlayerHp: 60, minimumLaborEnergy: 15, retainFood: 3, maximumSingleIdleSeconds: 120, maximumTotalIdleSeconds: 360,
  training: 0, purposelessRest: 0, maximumGoalDrivenRestMinutes: 30, maximumGoalDrivenRestInstances: 1,
  navigationSecondsPerGoal: 30, maximumNavigationDetours: 3, encounterWarningPercent: 80, npcApproachRetryLimit: 2, npcCanvasObservationMaxMs: 250 };
const report = { schema: 'NaturalMixedBrowserShortV1', runner: 'browser-natural-mixed-v1', runnerSha256: sha(runner),
  sourceHtmlSha256: sourceHash, expectedHtmlSha256: opts['--expect-html-sha256'], actorSpritesSha256: sha(sprites), protocolSha256: sha(protocol),
  mode: 'fresh-zero-save-injection-budgeted-short-natural-mixed-route', parameters: opts, budgets,
  policy: { freshBrowserContext: true, initialStorageMustBeEmpty: true, publicStart: true, saveInjection: false,
    initScriptInjection: false, hiddenGameActions: false, hiddenStateMutation: false, resume: false,
    goalKnowledge: 'public HUD/context controls and non-fogged rendered map objects/public art and tag metadata only; no hidden rewards',
    privilegedSafetySource: 'read-only complete actual writer worldZombies and kind/speedFactor/position; conservative veto only; not actor-authorized observation',
    actorProjectionComplete: false, doesNotAssumeNpcOrTowerRescue: true, automaticThreeDayContinuation: false },
  checks: [], errors: [], documents: [], snapshots: [], actions: [], safety: [], navigation: [], blockedGoals: [], checkpointSync: [],
  UIObservationInstrumentation: { mode: 'bounded one-public-target pass-through Canvas fillText observation',
    authorization: 'current publicly named NPC only; original fillText executes unchanged, observer restores within 250ms; no forced render',
    zeroIoWrappingClaim: false, initScript: false, maximumObservations: 2, maximumObservationMs: 250,
    maximumApproachRetries: 2, approachHoldMs: 100, otherActorsCollected: false, hiddenNpcStateRead: false,
    knownUiExecutionRadiusMismatchFixed: false, observations: [], restorationProofs: [], publicAttempts: [], approaches: [] },
  coverage: { eventChoice: false, resourceCollection: false, npcInteraction: false, exploration: false, planting: false,
    usefulConstruction: false, goalDrivenRestAttempted: false, goalDrivenRest: false, encounter: false, harvest: false, threeDays: false },
  timers: { readingMs: 0, saveVerificationMs: 0, checkpointSynchronizationMs: 0, publicRestMs: 0, navigationMs: 0, idleMs: 0 },
  naturalThreeDaysStatus: 'NOT_COVERED', status: 'RUNNING', terminal: null };
class RouteStop extends Error { constructor(status, message) { super(message); this.status = status; } }
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); };
function writeReport() { writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
const clock = p => (p.day - 1) * 1440 + p.hour * 60 + p.minute;
let browser, context, page, snapshotSeq = 0, actionSeq = 0, lastSave = null, finishing = false, canvasOriginalHandle = null, npcFollowStartedAt = null;
const server = createServer((req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route === '/' || route === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(source); }
  else if (route === '/actor-sprites.js') { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); res.end(sprites); }
  else { res.writeHead(404); res.end(); }
});
function remaining() { if (finishing) return 10000; const n = deadline - Date.now(); if (n <= 0) throw new RouteStop('INCOMPLETE_BUDGET', 'short route wall-clock budget exhausted'); return n; }
async function ui() {
  remaining();
  return page.evaluate(() => {
    const text = id => document.getElementById(id)?.textContent || '';
    const pos = text('mapRegionLabel').match(/([\d.]+)\/\d+列\s*·\s*([\d.]+)\/\d+行/);
    const time = text('timeLabel').match(/(\d\d):(\d\d)/), day = Number(text('dayLabel').match(/\d+/)?.[0]);
    return { day, hour: Number(time?.[1]), minute: Number(time?.[2]), hp: Number(text('hpValue')), energy: Number(text('energyValue')),
      food: Number(text('foodValue')), wood: Number(text('woodValue')), stone: Number(text('stoneValue')),
      player: pos ? { x: Number(pos[1]) - 1, y: Number(pos[2]) - 1 } : null,
      alert: text('alertPill'), contextTitle: text('contextTitle'), context: text('contextActions'), rest: text('campRestStatus'),
      inModal: document.getElementById('infoModal')?.getAttribute('aria-hidden') === 'false',
      tiles: [...document.querySelectorAll('#world .tile:not(.fogged)')].map(t => {
        const r = t.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
        const hit = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight ? document.elementFromPoint(x, y) : null;
        return { x: Number(t.dataset.x), y: Number(t.dataset.y), text: t.innerText, tag: t.querySelector('.tag')?.textContent || '',
          water: t.classList.contains('water'), building: t.classList.contains('building-footprint'),
          buildingType: t.querySelector('[data-building-type]')?.getAttribute('data-building-type') || null,
          area: t.classList.contains('camp-area'), className: t.className, centerPubliclyClickable: !!hit && (hit === t || t.contains(hit)) };
      }) };
  });
}
async function rawSave() { return page.evaluate(k => localStorage.getItem(k), key); }
async function save() { const raw = await rawSave(); if (!raw) return null; const e = JSON.parse(raw); lastSave = e.payload || e; return lastSave; }
async function waitSaved(predicate, values = {}, maxMs = 18000, timerCategory = 'saveVerificationMs') {
  const at = Date.now();
  await page.waitForFunction(({ key, body, values }) => { const raw = localStorage.getItem(key); if (!raw) return false; const e = JSON.parse(raw); return Function('p', 'v', `return (${body})(p,v)`)(e.payload || e, values); }, { key, body: predicate.toString(), values }, { timeout: Math.min(maxMs, remaining()) });
  report.timers[timerCategory] += Date.now() - at; return save();
}
async function snapshot(label, screenshot = false) {
  const raw = await rawSave(); assert.ok(raw, 'actual writer save exists'); const p = (JSON.parse(raw).payload || JSON.parse(raw));
  const file = `${String(snapshotSeq++).padStart(3, '0')}-${label}-save.json`; writeFileSync(path.join(out, file), raw);
  const publicUi = await ui(), entry = { label, file, sha256: sha(raw), htmlSha256: sourceHash, day: p.day, hour: p.hour, minute: p.minute,
    eventSeq: p.worldMeta.eventSeq, checksum: JSON.parse(raw).checksum, publicUiFile: file.replace('-save.json', '-ui.json') };
  writeFileSync(path.join(out, entry.publicUiFile), JSON.stringify(publicUi, null, 2));
  if (screenshot) { entry.screenshot = file.replace('-save.json', '.png'); await page.screenshot({ path: path.join(out, entry.screenshot), timeout: Math.min(10000, remaining()) }); }
  report.snapshots.push(entry); lastSave = p; writeReport(); return p;
}
async function synchronizeWriter(label, fixedPublicSample = null) {
  // Movement is ephemeral. An earlier action's complete writer may still have
  // the previous location. Capture one stopped public sample, then wait for a
  // normal writer to reach that fixed watermark, rather than chasing the live
  // clock or forcing a hidden checkpoint. The displayed position has 0.1-cell
  // precision; its maximum two-axis rounding error is below 0.08 cells.
  const sampledAtMs = fixedPublicSample?.sampledAtMs ?? Date.now() - startedAt, watermark = fixedPublicSample?.publicUi || await ui();
  const target = { minute: clock(watermark), player: watermark.player, hp: watermark.hp,
    energy: watermark.energy, food: watermark.food, wood: watermark.wood, stone: watermark.stone };
  const current = await save(), at = Date.now();
  const matches = (p, v) => (p.day - 1) * 1440 + p.hour * 60 + p.minute >= v.minute &&
    Math.hypot(p.player.x - v.player.x, p.player.y - v.player.y) <= .08;
  const baseline = matches(current, target) ? current : await waitSaved(matches, target, 18000, 'checkpointSynchronizationMs');
  report.checkpointSync.push({ label, sampledAtMs, publicWatermark: target, positionTolerance: .08,
    waitMs: Date.now() - at, actualWriterMinute: clock(baseline), actualWriterPlayer: baseline.player,
    actualWriterResources: { hp: baseline.hp, energy: baseline.energy, food: baseline.food, wood: baseline.wood, stone: baseline.stone },
    purpose: 'normal writer synchronization; verification time, not action elapsed or purposeless rest' });
  writeReport(); return baseline;
}
async function closePanels() { if (await page.locator('#infoModal').getAttribute('aria-hidden') === 'false') await page.locator('#infoModalClose').click(); await page.keyboard.press('Escape'); }
async function survival(label) {
  const view = await ui(), p = await save();
  if (view.hp <= 0 || p?.gameOver) throw new RouteStop('GAMEPLAY_LOSS', `${label}: actual player loss`);
  if (view.hp <= budgets.stopPlayerHp) throw new RouteStop('STOPPED_SAFETY_BUDGET', `${label}: public player HP ${view.hp} at/below ${budgets.stopPlayerHp}`);
  if (p && p.npcs.length !== 10) throw new RouteStop('RULE_OR_UI_FAILURE', 'fixed roster identity count changed');
  return { view, p };
}
async function safety(label, actionMinutes = 0) {
  const { view, p } = await survival(label); assert.ok(p && view.player);
  const publicMinute = (view.day - 1) * 1440 + view.hour * 60 + view.minute, lag = Math.max(0, publicMinute - clock(p));
  const enemies = p.worldZombies.filter(z => z.hp > 0).map(z => {
    const speed = ({ normal: .065, runner: .12, brute: .04 })[z.kind], multiplier = z.speedFactor === undefined ? 1 : Number(z.speedFactor);
    const distance = Math.hypot(z.x - view.player.x, z.y - view.player.y);
    return { id: z.id, kind: z.kind, distance, x: z.x, y: z.y, hp: z.hp, aiState: z.aiState,
      known: Number.isFinite(speed) && Number.isFinite(multiplier) && multiplier > 0,
      envelope: 1.25 + (speed || .12) * multiplier * (actionMinutes + lag + 2) + .6 };
  });
  const dangers = enemies.filter(z => !z.known || z.distance <= z.envelope);
  const entry = { label, provenance: report.policy.privilegedSafetySource, sourceSaveMinute: clock(p), publicMinute, saveLagMinutes: lag,
    actionMinutes, publicPlayer: view.player, publicHp: view.hp, publicEnergy: view.energy, enemies, dangers: dangers.map(z => z.id), veto: dangers.length > 0 };
  report.safety.push(entry); writeReport(); return { ...entry, view, p };
}
async function allowLabor(label, minutes) {
  const s = await safety(label, minutes);
  if (s.view.energy < budgets.minimumLaborEnergy) throw new RouteStop('STOPPED_SAFETY_BUDGET', `${label}: insufficient public labor energy reserve`);
  if (s.veto) throw new RouteStop('STOPPED_SAFETY_BUDGET', `${label}: conservative read-only writer danger envelope veto; no long action attempted`);
}
function pathTo(view, target, banned = new Set()) {
  const tiles = new Map(view.tiles.map(t => [`${t.x},${t.y}`, t]));
  const free = (x, y) => { const t = tiles.get(`${x},${y}`); return t && !t.water && !t.building && !banned.has(`${x},${y}`); };
  const start = [Math.round(view.player.x), Math.round(view.player.y)], queue = [start], previous = new Map([[start.join(','), null]]); let goal;
  while (queue.length) {
    const cell = queue.shift(), [x, y] = cell;
    if (Math.hypot(x - target.x, y - target.y) <= (target.approachRadius || 1.0) && free(x, y)) { goal = cell; break; }
    const next = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].sort((a,b) => Math.hypot(a[0]-target.x,a[1]-target.y)-Math.hypot(b[0]-target.x,b[1]-target.y));
    for (const n of next) if (free(...n) && !previous.has(n.join(','))) { previous.set(n.join(','), cell); queue.push(n); }
  }
  if (!goal) return null; const route = []; for (let c = goal; c; c = previous.get(c.join(','))) route.unshift(c); return route;
}
async function navigate(target, motivation, stopRadius = 1.05) {
  target = { ...target, approachRadius: stopRadius < 1 ? stopRadius : 1.0 };
  await closePanels(); const at = Date.now(), until = Math.min(deadline, at + budgets.navigationSecondsPerGoal * 1000), banned = new Set();
  const record = { target, motivation, provenance: 'actually visible map tile and public mapRegionLabel', startedAtMs: at - startedAt, samples: [], detours: 0, completed: false };
  report.navigation.push(record); let stalled = 0, previous, waypoint = null;
  while (Date.now() < until) {
    const v = await ui(); await survival('navigation');
    if (Math.hypot(v.player.x - target.x, v.player.y - target.y) <= stopRadius) { record.completed = true; record.finalPublicPosition = v.player; break; }
    // A rounded cell change is not arrival at its center. Finish the current
    // visible grid waypoint before turning, so the continuous actor does not
    // cut across a solid building's corner at a half-cell position.
    if (!waypoint || Math.hypot(v.player.x-waypoint[0],v.player.y-waypoint[1]) <= .18) {
      const route = pathTo(v, target, banned); if (!route) throw new RouteStop('STOPPED_PUBLIC_PATH', `no visible passable route to ${target.tag}`);
      waypoint = route.length > 1 ? route[1] : route[0];
    }
    const next = waypoint;
    const [nx, ny] = next, dx = nx - v.player.x, dy = ny - v.player.y;
    const horizontal = Math.abs(dx) > .12, keypress = horizontal ? (dx > 0 ? 'd' : 'a') : (dy > 0 ? 's' : 'w');
    const distance = horizontal ? Math.abs(dx) : Math.abs(dy), duration = Math.max(55, Math.min(230, distance / 2 * 1000));
    await page.keyboard.down(keypress); await page.waitForTimeout(duration); await page.keyboard.up(keypress); await page.waitForTimeout(35);
    const after = await ui(); record.samples.push({ from: v.player, to: after.player, key: keypress, heldMs: duration });
    stalled = previous && Math.hypot(after.player.x - previous.x, after.player.y - previous.y) < .05 ? stalled + 1 : 0; previous = after.player;
    if (stalled >= 3) { banned.add(next.join(',')); waypoint = null; record.detours++; stalled = 0; if (record.detours > budgets.maximumNavigationDetours) throw new RouteStop('STOPPED_PUBLIC_PATH', 'visible navigation obstruction detour budget exhausted'); }
  }
  record.wallMs = Date.now() - at; report.timers.navigationMs += record.wallMs; writeReport();
  if (!record.completed) throw new RouteStop('INCOMPLETE_BUDGET', `navigation time budget exhausted toward ${target.tag}`);
}
async function visibleGoal(tag, optional = false) {
  const view = await ui(), choices = view.tiles.filter(t => t.tag.includes(tag));
  choices.sort((a,b) => Math.hypot(a.x-view.player.x,a.y-view.player.y)-Math.hypot(b.x-view.player.x,b.y-view.player.y));
  if (!choices.length && !optional) throw new RouteStop('NOT_COVERED', `goal ${tag} not disclosed on actually visible map`);
  if (choices[0]) report.actions.push({ type: 'goal-observed', tag, chosenVisibleTile: choices[0], publicPosition: view.player });
  return choices[0] || null;
}
async function action(type, motivation, minutes, click, verify, options = {}) {
  if (actionSeq >= budgets.meaningfulActions) throw new RouteStop('INCOMPLETE_BUDGET', 'meaningful action count budget reached');
  await allowLabor(type, minutes); await synchronizeWriter(type, options.fixedPublicSample); await allowLabor(type, minutes);
  const before = await snapshot(`${actionSeq}-${type}-before`), beforeUi = await ui(), start = Date.now();
  await click();
  const after = await waitSaved((p, v) => p.worldMeta.eventSeq > v.seq && p.worldMeta.events.some(e => e.seq > v.seq && e.type === v.type), { seq: before.worldMeta.eventSeq, type });
  const events = after.worldMeta.events.filter(e => e.seq > before.worldMeta.eventSeq), commands = after.worldMeta.replay.commands.filter(c => events.some(e => e.commandId === c.commandId || e.causationId === c.commandId));
  const record = { index: actionSeq++, type, motivation, estimatedActionMinutes: minutes, wallMs: Date.now() - start,
    before: { minute: clock(before), hp: before.hp, energy: before.energy, food: before.food }, after: { minute: clock(after), hp: after.hp, energy: after.energy, food: after.food },
    beforePublic: beforeUi, events, commands, result: verify(before, after, events, commands) };
  report.actions.push(record);
  if (record.result !== true) { report.checks.push({ name: `${type}: actual command/receipt and measured intended change`, ok: false }); throw new RouteStop('RULE_OR_UI_FAILURE', `${type}: public action lacked its measured payment/target/time result`); }
  check(`${type}: actual command/receipt and measured intended change`, true);
  await snapshot(`${record.index}-${type}-after`, true); await survival(type); return { before, after, events, commands };
}
async function publicGather(goal, motivation) {
  await navigate(goal, motivation); const button = page.locator('[data-context-action="gather"]');
  check('gather: actual visible public context enabled', await button.isVisible() && await button.isEnabled());
  return action('resource.collected', motivation, 30, () => button.click(), (b,a,events,commands) => {
    const old = b.resources.find(r => r.x === goal.x && r.y === goal.y), current = a.resources.find(r => r.id === old?.id);
    // The existing public context calls gather() without an explicit target;
    // its real receipt keeps resourceId:null. Prove the exact visible node's
    // amount decrement and the real positive delta/command causation instead
    // of inventing an ID that this current public path never records.
    return !!old && old.amount > 0 && (current?.amount ?? 0) === old.amount - 1 && events.some(e => e.type === 'resource.collected' &&
      (e.payload.resourceId === null || e.payload.resourceId === old.id) && Object.values(e.payload.delta || {}).some(n => n > 0) &&
      commands.some(c => c.type === 'resource.collect' && c.commandId === e.commandId));
  });
}
async function restoreCanvasObserver(stage) {
  if (!canvasOriginalHandle) return;
  const proof = await page.evaluate(original => {
    const proto = CanvasRenderingContext2D.prototype, alreadyRestored = proto.fillText === original;
    if (!alreadyRestored) proto.fillText = original;
    return { alreadyRestored, restoredOriginalIdentity: proto.fillText === original };
  }, canvasOriginalHandle);
  report.UIObservationInstrumentation.restorationProofs.push({ stage, ...proof });
  if (!proof.restoredOriginalIdentity) throw new RouteStop('INCOMPLETE_COVERAGE', 'owned Canvas observer did not restore its original IO method');
  await canvasOriginalHandle.dispose(); canvasOriginalHandle = null;
}
async function observePublicNpc(name, npcId) {
  const instrumentation = report.UIObservationInstrumentation;
  if (instrumentation.observations.length >= instrumentation.maximumObservations) throw new RouteStop('INCOMPLETE_COVERAGE', 'bounded public NPC observation budget exhausted');
  if (!canvasOriginalHandle) canvasOriginalHandle = await page.evaluateHandle(() => CanvasRenderingContext2D.prototype.fillText);
  const rpcAt = Date.now();
  const observed = await page.evaluate(async ({ name, npcId, original }) => {
    const proto = CanvasRenderingContext2D.prototype, at = performance.now();
    const publicName = () => document.getElementById('contextTitle')?.textContent.split(' · ')[0]?.trim();
    const publicId = () => document.querySelector('[data-context-action="npcOrder"]')?.dataset.npcId;
    let timer, wrapper, capture = null, observationError = null, targetOriginalCalls = 0;
    const restored = () => { if (proto.fillText === wrapper) proto.fillText = original; };
    const nameBefore = publicName(), idBefore = publicId();
    try {
      if (nameBefore !== name || idBefore !== npcId || proto.fillText !== original) throw new Error('public target or original IO identity changed before observation');
      await new Promise(resolve => {
        wrapper = function (...args) {
          // Every native call executes exactly once, with its original this,
          // argument list, return value and exceptions. No renderer is called.
          const value = Reflect.apply(original, this, args);
          if (capture || args[0] !== name || !this.canvas?.matches('#world .actor-canvas')) return value;
          targetOriginalCalls++;
          try {
            const canvas = this.canvas, world = document.getElementById('world'), rect = canvas.getBoundingClientRect();
            const tile = [...world.querySelectorAll('.tile:not(.fogged)')].find(t => { const r = t.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
            const tileRect = tile?.getBoundingClientRect(), markerRect = world.querySelector('.player-marker')?.getBoundingClientRect();
            if (!tileRect || !markerRect || !rect.width || !rect.height || !canvas.width || !canvas.height) throw new Error('public map geometry unavailable');
            const m = this.getTransform(), metrics = this.measureText(name), x = Number(args[1]), y = Number(args[2]);
            const css = (u, v) => ({ x: rect.left + (m.a*u+m.c*v+m.e)*rect.width/canvas.width,
              y: rect.top + (m.b*u+m.d*v+m.f)*rect.height/canvas.height });
            const label = css(x, y), offset = Math.max(7, Math.min(tileRect.width, tileRect.height)*.28)+9;
            const actor = css(x, y-offset), player = { x: markerRect.x+markerRect.width/2, y: markerRect.y+markerRect.height/2 };
            const corners = [css(x-metrics.actualBoundingBoxLeft,y-metrics.actualBoundingBoxAscent), css(x+metrics.actualBoundingBoxRight,y+metrics.actualBoundingBoxDescent)];
            const bounds = { left: Math.min(...corners.map(p=>p.x)), right: Math.max(...corners.map(p=>p.x)),
              top: Math.min(...corners.map(p=>p.y)), bottom: Math.max(...corners.map(p=>p.y)) };
            const labelHit = document.elementFromPoint(label.x,label.y), actorHit = document.elementFromPoint(actor.x,actor.y);
            const actorTile = actorHit?.closest('.tile');
            const inMap = node => !!node && (node === world || world.contains(node));
            const visibleAncestor = node => { for (let e=node;e;e=e.parentElement) { const s=getComputedStyle(e); if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0||e.hidden)return false; } return true; };
            const fullyVisible = visibleAncestor(canvas) && bounds.left >= Math.max(0,rect.left) && bounds.right <= Math.min(innerWidth,rect.right) &&
              bounds.top >= Math.max(0,rect.top) && bounds.bottom <= Math.min(innerHeight,rect.bottom) && inMap(labelHit) && inMap(actorHit) &&
              !!actorTile && !actorTile.classList.contains('fogged') && publicName() === name && publicId() === npcId;
            capture = { targetName: name, publicNpcId: npcId, canvasSelector: '#world .actor-canvas', originalTargetCalls: targetOriginalCalls,
              sourceDrawPoint: { x,y }, transform: { a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f },
              canvas: { width:canvas.width,height:canvas.height,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height} },
              viewport: { width:innerWidth,height:innerHeight,devicePixelRatio },
              publicTileGeometry: { width:tileRect.width,height:tileRect.height,sampleX:Number(tile.dataset.x),sampleY:Number(tile.dataset.y) },
              labelCss:label,labelBoundsCss:bounds,labelToActorOffsetSourcePx:offset,actorCenterCss:actor,playerCenterCss:player,
              actorPublicTile:{ x:Number(actorTile?.dataset.x),y:Number(actorTile?.dataset.y),fogged:actorTile?.classList.contains('fogged') },
              contextNameAfterDraw:publicName(),contextNpcIdAfterDraw:publicId(),fullyVisible,
              directionCells:{ x:(actor.x-player.x)/tileRect.width,y:(actor.y-player.y)/tileRect.height } };
          } catch (error) { observationError = error.message; }
          finally { restored(); resolve(); }
          return value;
        };
        proto.fillText = wrapper;
        timer = setTimeout(resolve, 200);
      });
    } catch (error) { observationError = error.message; }
    finally { clearTimeout(timer); restored(); }
    return { capture, observationError, durationMs: performance.now()-at, restoredOriginalIdentity: proto.fillText === original,
      originalInvocation: 'Reflect.apply(original, same this, complete original argument list)', forcedRender:false, collectedOtherActorNames:false };
  }, { name, npcId, original: canvasOriginalHandle });
  observed.rpcWallMs = Date.now()-rpcAt;
  const index = instrumentation.observations.length, screenshot = `npc-public-observation-${index}.png`;
  const pixels = await page.screenshot({ path: path.join(out,screenshot), timeout: Math.min(5000,remaining()) });
  observed.screenshot = screenshot; observed.screenshotSha256 = sha(pixels);
  instrumentation.observations.push(observed);
  writeFileSync(path.join(out,`npc-public-observation-${index}.json`),JSON.stringify(observed,null,2)+'\n'); writeReport();
  if (!observed.restoredOriginalIdentity || observed.durationMs > instrumentation.maximumObservationMs || !observed.capture?.fullyVisible || observed.observationError)
    throw new RouteStop('INCOMPLETE_COVERAGE','named NPC observation unavailable, occluded or over budget; no writer-coordinate fallback');
  return observed.capture;
}
async function followPublicNpc(name, npcId, dialogue) {
  const i = report.UIObservationInstrumentation;
  if (i.approaches.length >= i.maximumApproachRetries) return false;
  npcFollowStartedAt ??= Date.now();
  if (Date.now()-npcFollowStartedAt >= budgets.navigationSecondsPerGoal*1000) return false;
  const at=Date.now(), risk=await safety('bounded-public-NPC-follow',1);
  if (risk.veto) throw new RouteStop('STOPPED_SAFETY_BUDGET','public NPC follow vetoed; no hidden position used to choose a direction');
  const observation=await observePublicNpc(name,npcId), d=observation.directionCells;
  if (![d.x,d.y].every(Number.isFinite) || Math.hypot(d.x,d.y) < .05) return false;
  const key=Math.abs(d.x)>Math.abs(d.y)?(d.x>0?'d':'a'):(d.y>0?'s':'w'), before=await ui();
  await page.keyboard.down(key); try { await page.waitForTimeout(i.approachHoldMs); } finally { await page.keyboard.up(key); }
  await page.waitForTimeout(35); const after=await ui();
  i.approaches.push({ targetName:name,publicNpcId:npcId,publicRejection:dialogue,
    motivation:'公开提示已明确还差距离，沿刚实际可见的同NPC方向贴近一次；不追踪存档私有坐标',
    key,heldMs:i.approachHoldMs,from:before.player,to:after.player,observationIndex:i.observations.length-1,wallMs:Date.now()-at });
  report.timers.navigationMs+=Date.now()-at; writeReport(); return true;
}
async function attemptNearbyNpc(motivation) {
  if (report.coverage.npcInteraction) return true;
  const npc = page.locator('[data-context-action="npc"]');
  if (!(await npc.isVisible()) || !(await npc.isEnabled())) { report.blockedGoals.push({ goal: 'NPC', reason: 'no actually available local NPC request at this public location', motivation }); return false; }
  report.npcContactPublic = await page.locator('#contextPanel').innerText();
  const name=(await page.locator('#contextTitle').innerText()).split(' · ')[0].trim();
  const npcId=await page.locator('[data-context-action="npcOrder"]').first().getAttribute('data-npc-id');
  if (!name || !npcId) throw new RouteStop('INCOMPLETE_COVERAGE','public NPC identity is not actually disclosed');
  let fixedPublicSample;
  for (let attempt=0;attempt<=report.UIObservationInstrumentation.maximumApproachRetries;attempt++) {
    if (!(await npc.isVisible()) || !(await npc.isEnabled()) || (await page.locator('#contextTitle').innerText()).split(' · ')[0].trim()!==name ||
      await page.locator('[data-context-action="npcOrder"]').first().getAttribute('data-npc-id')!==npcId)
      throw new RouteStop('INCOMPLETE_COVERAGE','same publicly observed NPC target no longer available; no private-target pursuit');
    fixedPublicSample={ sampledAtMs:Date.now()-startedAt,publicUi:await ui() };
    const before=await save(); await npc.click();
    const after=await waitSaved((p,v)=>p.worldMeta.events.some(e=>e.type==='npc.interacted'&&e.seq>v.seq),{seq:before.worldMeta.eventSeq});
    const receipt=after.worldMeta.events.find(e=>e.type==='npc.interacted'&&e.seq>before.worldMeta.eventSeq), command=after.worldMeta.replay.commands.find(c=>c.commandId===receipt.commandId);
    const dialogue=await page.locator('#toast').innerText();
    const read={ type:'npc-dialogue-read',motivation,targetName:name,publicNpcId:npcId,publicDialogue:dialogue,receipt,command,countedAsSuccessfulSupport:false };
    report.actions.push(read); report.UIObservationInstrumentation.publicAttempts.push(read);
    if (command?.payload.npcId!==npcId) throw new RouteStop('INCOMPLETE_COVERAGE','public NPC target changed during click');
    if (dialogue.includes('再次按 E')) break;
    const gap=dialogue.match(/^靠近(.+)（还差 ([\d.eE+-]+) 格）$/);
    if (!gap || gap[1]!==name || !Number.isFinite(Number(gap[2])) || Number(gap[2])<=0 || !await followPublicNpc(name,npcId,dialogue)) {
      report.blockedGoals.push({goal:'NPC support confirmation',reason:dialogue,boundedApproaches:report.UIObservationInstrumentation.approaches.length});return false;
    }
  }
  await action('npc.interacted', '阅读当前真正近邻角色状态后第二次公开确认请求支援；只将实际support/bond/memory变化计作成功。', 15, async () => {
    const title=await page.locator('#contextTitle').innerText(), currentId=await page.locator('[data-context-action="npcOrder"]').first().getAttribute('data-npc-id');
    report.UIObservationInstrumentation.confirmationPublic={targetName:name,publicNpcId:npcId,currentTitle:title,currentPublicNpcId:currentId,publicUi:await ui()};
    if(title.split(' · ')[0].trim()!==name||currentId!==npcId||!await npc.isVisible()||!await npc.isEnabled())
      throw new RouteStop('INCOMPLETE_COVERAGE','same public NPC confirmation target changed; no substituted support');
    await npc.click();
  }, (b,a,events,commands) => {
    const changed = a.npcs.find(n => n.id===npcId && n.supportRequested && !b.npcs.find(old => old.id === n.id).supportRequested && n.bond > b.npcs.find(old => old.id === n.id).bond);
    const parent=commands.find(c=>c.type==='npc.interact'&&c.payload.npcId===npcId&&c.actorId==='player-1');
    return !!changed && !!parent && events.some(e => e.type === 'npc.interacted'&&e.commandId===parent.commandId&&e.actorId==='player-1') &&
      commands.some(c=>c.type==='world.advance'&&c.payload.minutes===15&&events.some(e=>e.type==='time.advanced'&&e.commandId===c.commandId&&e.causationId===parent.commandId&&e.payload.minutes===15)) &&
      changed.memory.helpedByPlayer > b.npcs.find(old => old.id === changed.id).memory.helpedByPlayer;
  },{fixedPublicSample}); report.coverage.npcInteraction = true; return true;
}
async function exploreSouthernBoundary() {
  // Choose a direction from the public fog frontier, not an unseen garden's
  // coordinates. Stop as soon as the live rendered map discloses a crop plot.
  const v = await ui(), column = Math.round(v.player.x);
  const edge = v.tiles.filter(t => Math.abs(t.x-column) <= 1 && !t.water && !t.building).sort((a,b) => b.y-a.y || Math.abs(a.x-column)-Math.abs(b.x-column))[0];
  if (!edge) return;
  await navigate({ ...edge, tag: '当前可见南侧边界' }, '沿公开地图的南侧未知边界做一次有方向的探索，寻找营地生产区；未读取隐藏菜田位置。', .25);
  const record = { type: 'public-frontier-exploration', direction: 'south', motivation: '寻找尚未披露的生产区域，不按隐藏奖励或保存坐标选路', samples: [] };
  const at = Date.now();
  for (let i = 0; i < 6; i++) {
    if ((await ui()).tiles.some(t => t.tag.includes('菜畦'))) break;
    const risk = await safety('south-boundary-visible-exploration', 1);
    if (risk.veto) throw new RouteStop('STOPPED_SAFETY_BUDGET', 'bounded frontier movement vetoed by disclosed conservative safety source');
    const before = await ui(); await page.keyboard.down('s'); await page.waitForTimeout(230); await page.keyboard.up('s'); await page.waitForTimeout(50);
    const after = await ui(); record.samples.push({ from: before.player, to: after.player, publicRegion: after.day, key: 's', heldMs: 230 });
    if (Math.hypot(after.player.x-before.player.x,after.player.y-before.player.y) < .05) break;
  }
  record.wallMs = Date.now()-at; report.timers.navigationMs += record.wallMs; report.actions.push(record);
}
async function attemptGoalDrivenRest() {
  const shelter = (await ui()).tiles.find(t => t.buildingType === 'shelter' || t.building && t.tag === '建筑') || await visibleGoal('营地', true);
  if (!shelter) { report.blockedGoals.push({ goal: 'goal-driven rest', reason: 'no publicly disclosed candidate shelter building' }); return; }
  report.actions.push({ type: 'goal-observed', tag: 'publicly rendered dwelling building; shelter confirmed by near public rest controls', chosenVisibleTile: shelter });
  await navigate(shelter, '在继续农务与建设前回到公开居住建筑，用near context确认庇护所并检视已消耗体力。');
  const view = await ui(), rest = page.locator('[data-context-action="campRest30"]');
  if (!(view.energy < 78 && await rest.isVisible() && await rest.isEnabled())) { report.blockedGoals.push({ goal: 'bounded recovery rest', reason: 'public rest gate disabled/unavailable or no actual energy recovery need', publicUi: view }); return; }
  if (actionSeq >= budgets.meaningfulActions) throw new RouteStop('INCOMPLETE_BUDGET', 'meaningful action budget exhausted before recovery');
  const before = await snapshot('rest-purpose-before');
  report.restPurpose = { goal: '恢复至少1点既有被动体力后继续实际播种与农田防护建设，避免为了少量体力立即消耗阵营口粮', requestedMinutes: 30, startPublicEnergy: view.energy, noCropMaturityClaim: true };
  await rest.click(); const after = await waitSaved(p => p.worldMeta.events.some(e => e.type === 'camp.rest.stopped'), {}, 18000, 'publicRestMs');
  const stop = after.worldMeta.events.filter(e => e.type === 'camp.rest.stopped').at(-1), start = after.worldMeta.events.find(e => e.type === 'camp.rest.started' && e.payload.restId === stop.payload.restId);
  report.actions.push({ index: actionSeq++, type: 'goal-driven-camp-rest', motivation: report.restPurpose.goal, start, stop, actualMinutes: stop.payload.completed, beforeEnergy: before.energy, afterEnergy: after.energy, beforeFood: before.food, afterFood: after.food });
  report.coverage.goalDrivenRestAttempted = true; report.coverage.goalDrivenRest = stop.payload.completed > 0 && after.energy > before.energy;
  report.restPurpose.goalAchieved = report.coverage.goalDrivenRest; await snapshot('rest-purpose-after', true);
}
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const require = createRequire(import.meta.url), { chromium } = require(process.env.ZH_PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, channel: process.env.ZH_BROWSER_CHANNEL || 'chrome' }); report.browserVersion = browser.version();
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', e => report.errors.push({ type: 'pageerror', message: e.message }));
  const response = await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
  const documentHash = sha(await response.body()); report.documents.push({ kind: 'fresh-main', sha256: documentHash }); check('fresh main document exact immutable bytes', response.ok() && documentHash === sourceHash);
  check('fresh origin has no saved progress before public start', await rawSave() === null);
  check('public start discloses a new game', (await page.locator('#continueSaveBtn').innerText()).includes('开始新游戏'));
  await page.locator('#continueSaveBtn').click(); await waitSaved(p => p.day === 1 && p.hour === 6 && p.npcs.length === 10);
  const initial = await snapshot('fresh-initial', true); report.initialIdentities = initial.npcs.map(n => n.id); report.seed = initial.worldMeta.seed;
  check('new game begins day1 06:00 with original ten identities', clock(initial) === 360 && new Set(report.initialIdentities).size === 10 && initial.npcs.every(n => n.lifeState !== 'dead'));
  const readAt = Date.now(); await page.keyboard.press('j');
  report.initialEventPublic = { title: await page.locator('#eventTitle').innerText(), a: await page.locator('#eventChoiceA').innerText(), b: await page.locator('#eventChoiceB').innerText() };
  report.timers.readingMs += Date.now() - readAt;
  await action('event.resolved', '公开补给箱选项提供有限食物与零件，接受已披露的威胁代价，为农务和后续防线准备口粮。', 0, () => page.locator('#eventChoiceA').click(), (b,a,events,commands) => a.event.handled && a.food === b.food + 3 && a.parts === b.parts + 1 && events.some(e => e.type === 'event.resolved') && commands.some(c => c.type === 'event.resolve'));
  report.coverage.eventChoice = true; await closePanels();
  const tree = await visibleGoal('木材'); await publicGather(tree, '验证当前可见有限木材来源并增加建设储备；初始24木材已可负担拟建塔，不声称这是材料稀缺迫使的选择。'); report.coverage.resourceCollection = true;
  const workshop = await visibleGoal('工坊', true);
  if (workshop) {
    await navigate(workshop, '到公开工坊认识现场木匠，准备防线建设与后续岗位合作。', .75);
    await attemptNearbyNpc('先到公开工坊观察是否真有人；不把区域标记当作角色仍站在这里。');
  }
  const mill = await visibleGoal('废弃水车', true);
  if (mill) { await navigate(mill, '探索实际可见的附近地标，了解营地周边而非追逐隐藏奖励。');
    const button = page.locator('[data-context-action="landmark"]');
    if (await button.isVisible() && (await button.innerText()).includes('水车')) {
      await action('landmark.discovered', '公开水车地标探索，承担可见体力与时间代价。', 20, () => button.click(), (b,a,events,commands) => !b.landmarks.find(l => l.x === mill.x && l.y === mill.y).found && a.landmarks.find(l => l.x === mill.x && l.y === mill.y).found && events.some(e => e.type === 'landmark.discovered') && commands.some(c => c.type === 'landmark.discover'));
      report.coverage.exploration = true;
    }
  }
  await attemptNearbyNpc('探索后直接使用当前位置实际公开的近邻NPC入口，不读取角色保存坐标追人。');
  await attemptGoalDrivenRest();
  let garden = await visibleGoal('待播种', true) || await visibleGoal('菜畦', true);
  if (!garden) { await exploreSouthernBoundary(); garden = await visibleGoal('菜畦', true); }
  if (!garden) report.blockedGoals.push({ goal: 'original crop plot', reason: 'bounded public southern exploration did not disclose a crop plot' });
  if (garden) { await navigate(garden, '为后续两次真实每日生长建立原菜田生产来源。');
    const crop = page.locator('[data-context-action="crop"]');
    if (await crop.isVisible() && await crop.isEnabled()) {
      await action('crop.changed', '在原有未播种菜田投入一枚真实种子；不以未成熟点击消磨时间。', 20, () => crop.click(), (b,a,events,commands) => {
        const old = b.buildings.find(x => x.x === garden.x && x.y === garden.y), plot = a.buildings.find(x => x.id === old.id);
        const receipt = events.find(e => e.type === 'crop.changed' && e.payload.buildingId === old.id), proof = receipt?.payload;
        const parent = commands.find(c => c.type === 'crop.change' && c.commandId === receipt?.commandId && c.payload.buildingId === old.id);
        const child = commands.find(c => c.type === 'world.advance' && c.commandId === proof?.advance?.commandId && c.payload.minutes === 20);
        return !old.planted && plot.planted && !plot.ready && a.seeds === b.seeds - 1 && !!parent && !!child && receipt.actorId === 'player-1' && parent.actorId === 'player-1' &&
          proof.proofVersion === 1 && proof.operation === 'plant' && proof.payment.cost.energy === 4 && proof.payment.cost.seeds === 1 &&
          proof.payment.before.energy - proof.payment.after.energy === 4 && proof.clock.requestedMinutes === 20 && proof.clock.elapsedMinutes === 20 &&
          events.some(e => e.type === 'time.advanced' && e.commandId === child.commandId && e.causationId === parent.commandId && e.payload.minutes === 20);
      }); report.coverage.planting = true;
    }
  }
  if (!report.coverage.planting) throw new RouteStop('INCOMPLETE_COVERAGE', 'required original-plot planting was not actually available or successful; no construction attempted merely to consume time');
  if (garden) {
    await navigate(garden, '给已播种且未来需回来收获的菜田建立一处有用途的近场防护。');
    const view = await ui();
    if (view.wood >= 12 && view.stone >= 5) {
      await allowLabor('farm-protection-construction', 45);
      await page.keyboard.press('c');
      const tower = page.locator('[data-build="tower"]');
      if (await tower.isVisible()) {
        await tower.click(); const candidateUi = await ui();
        const sites = candidateUi.tiles.filter(t => t.className.includes('build-target') && t.centerPubliclyClickable && Math.hypot(t.x-garden.x,t.y-garden.y) <= 3 &&
          Math.hypot(t.x-candidateUi.player.x,t.y-candidateUi.player.y) >= 1.0 && Math.hypot(t.x-candidateUi.player.x,t.y-candidateUi.player.y) <= 1.25);
        sites.sort((a,b) => Math.hypot(a.x-garden.x,a.y-garden.y)-Math.hypot(b.x-garden.x,b.y-garden.y));
        if (sites[0]) {
          const site = sites[0]; report.constructionPublicSite = site;
          await action('building.constructed', '在公开标记为可建造的近邻空地建一座塔，覆盖原菜田与回访收获通路。', 45, async () => {
            const liveSite = (await ui()).tiles.find(t => t.x === site.x && t.y === site.y);
            if (!liveSite?.className.includes('build-target') || !liveSite.centerPubliclyClickable) throw new RouteStop('INCOMPLETE_COVERAGE', 'observed construction site ceased to be publicly legal/clickable before payment; no retry or substitute building');
            await page.locator(`#world .tile[data-x="${site.x}"][data-y="${site.y}"]`).click();
          }, (b,a,events,commands) => {
            const parent = commands.find(c => c.type === 'building.construct' && c.payload.buildingType === 'tower' && c.payload.x === site.x && c.payload.y === site.y);
            return !!parent && a.buildings.some(x => x.type === 'tower' && x.x === site.x && x.y === site.y && x.id && !b.buildings.some(old => old.id === x.id)) &&
              a.wood === b.wood - 12 && a.stone === b.stone - 5 && events.some(e => e.type === 'building.constructed' && e.commandId === parent.commandId) &&
              commands.some(c => c.type === 'world.advance' && c.payload.minutes === 45 && events.some(e => e.type === 'time.advanced' && e.commandId === c.commandId && e.causationId === parent.commandId && e.payload.minutes === 45));
          });
          report.coverage.usefulConstruction = true;
        } else report.blockedGoals.push({ goal: 'farm protection tower', reason: 'no actually visible legal adjacent useful construction site' });
      }
      await page.keyboard.press('Escape');
    } else report.blockedGoals.push({ goal: 'farm protection tower', reason: 'current public materials cannot afford tower', wood: view.wood, stone: view.stone });
  }
  const finalView = await ui();
  report.coverage.encounter = false; report.encounterDecision = { choice: 'not-triggered', reason: 'short route does not force a morning encounter for coverage', calendar: [finalView.day, finalView.hour, finalView.minute], visibleAlert: finalView.alert };
  report.coverage.harvest = false; report.coverage.threeDays = false;
  await closePanels(); const beforeReload = await snapshot('before-public-reload', true);
  await restoreCanvasObserver('before-public-reload');
  const response2 = await page.reload({ waitUntil: 'domcontentloaded' }), hash2 = sha(await response2.body()); report.documents.push({ kind: 'public-reload', sha256: hash2 }); check('reload main exact same build', hash2 === sourceHash);
  await page.locator('#continueSaveBtn').click();
  await waitSaved((p,v) => p.worldMeta.events.some(e => e.type === 'time.advanced' && e.seq > v.seq), { seq: beforeReload.worldMeta.eventSeq }, 20000);
  const reloaded = await snapshot('after-reload-normal-tick', true);
  check('reload preserves original ten identities without replacement', JSON.stringify(reloaded.npcs.map(n=>n.id)) === JSON.stringify(report.initialIdentities));
  check('reload retains actual planted plot and constructed entity identities', beforeReload.buildings.every(b => reloaded.buildings.some(x => x.id === b.id && (!b.planted || x.planted))));
  const requiredShortCoverage = ['eventChoice','resourceCollection','npcInteraction','exploration','planting','usefulConstruction','goalDrivenRest'];
  report.shortRouteCoverage = { required: requiredShortCoverage, missing: requiredShortCoverage.filter(k => !report.coverage[k]) };
  report.status = report.shortRouteCoverage.missing.length === 0 ? 'SHORT_MIXED_OBSERVED' : 'INCOMPLETE_COVERAGE';
  report.nextGoals = ['原菜田需要两次真实每日生长后回访收获，短路线尚未到期', '已公开探索的地标与现场NPC后续是否提供持续目标，需另行依据可见事项判断'];
  report.threeDayContinuationDecision = 'not-started; parent-authorized bounded short route ends here, no automatic idle/rest calendar filling';
} catch (error) {
  report.status = error instanceof RouteStop ? error.status : 'UNVERIFIED_RUNNER_FAILURE';
  report.terminalReason = error.message;
  if (!(error instanceof RouteStop)) report.errors.push({ type: 'runner', message: error.stack || String(error) });
} finally {
  finishing = true; report.routeElapsedBeforeCleanupMs = Date.now() - startedAt;
  if (page && !page.isClosed()) {
    try {
      await restoreCanvasObserver('terminal-cleanup-before-public-checkpoint');
      report.terminalPublicUi = await ui();
      await page.screenshot({ path: path.join(out, 'terminal-before-cleanup.png'), timeout: 5000 });
      // Public reload triggers the actual pagehide writer checkpoint. Park at
      // the start screen without continuing; do not resume or replay anything.
      const terminalResponse = await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
      const terminalDocumentHash = sha(await terminalResponse.body());
      report.documents.push({ kind: 'terminal-public-pagehide-checkpoint-no-continue', sha256: terminalDocumentHash });
      check('terminal public reload retains exact build', terminalDocumentHash === sourceHash);
      const raw = await rawSave(); if (raw) { writeFileSync(path.join(out, 'terminal-before-cleanup-save.json'), raw); const p = JSON.parse(raw).payload || JSON.parse(raw); report.terminal = { day: p.day, hour: p.hour, minute: p.minute, playerHP: p.hp, energy: p.energy, sanity: p.sanity, food: p.food, roster: p.npcs.length, living: p.npcs.filter(n=>n.lifeState !== 'dead').length, npcDeaths: p.npcs.filter(n=>n.lifeState === 'dead').map(n=>n.id), campCollapse: p.contentState.meters.campCollapse, coreBuildings: p.buildings.filter(b=>['shelter','bunker','depot'].includes(b.type)).map(b=>({id:b.id,type:b.type,hp:b.hp ?? null})), eventSeq: p.worldMeta.eventSeq }; }
    } catch (error) { report.errors.push({ type: 'terminal-capture', message: error.message }); }
  }
  if (context) await context.close().catch(error => report.errors.push({ type: 'context-close', message: error.message }));
  if (browser) await browser.close().catch(error => report.errors.push({ type: 'browser-close', message: error.message }));
  if (server.listening) await new Promise(resolve => server.close(resolve));
  report.elapsedWallMs = Date.now() - startedAt; report.passed = report.checks.filter(c=>c.ok).length; report.count = report.checks.length;
  report.shortRouteCoverage = { required: ['eventChoice','resourceCollection','npcInteraction','exploration','planting','usefulConstruction','goalDrivenRest'],
    missing: ['eventChoice','resourceCollection','npcInteraction','exploration','planting','usefulConstruction','goalDrivenRest'].filter(k => !report.coverage[k]) };
  report.cleanup = { browserClosed: true, contextClosed: true, httpServerClosed: !server.listening,
    UIObserversRestored: report.UIObservationInstrumentation.observations.every(o=>o.restoredOriginalIdentity) &&
      report.UIObservationInstrumentation.restorationProofs.every(p=>p.restoredOriginalIdentity) && canvasOriginalHandle === null };
  report.ok = report.status === 'SHORT_MIXED_OBSERVED' && report.errors.length === 0 && report.passed === report.count;
  writeReport(); console.log(JSON.stringify({ out, status: report.status, ok: report.ok, passed: report.passed, count: report.count, terminal: report.terminal, coverage: report.coverage, terminalReason: report.terminalReason, errors: report.errors, elapsedWallMs: report.elapsedWallMs, runnerSha256: report.runnerSha256, sourceHtmlSha256: sourceHash }, null, 2));
}
if (!report.ok) process.exitCode = 1;
