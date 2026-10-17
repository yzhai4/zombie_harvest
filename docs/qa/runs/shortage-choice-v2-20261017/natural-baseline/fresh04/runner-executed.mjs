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
writeFileSync(path.join(out, 'source.html'), source); writeFileSync(path.join(out, 'runner-executed.mjs'), runner); writeFileSync(path.join(out, 'actor-sprites-executed.js'), sprites);
const key = 'zombie-harvest-progress-v12', startedAt = Date.now(), deadline = startedAt + budgetSeconds * 1000;
const budgets = { wallSeconds: budgetSeconds, meaningfulActions: 10, meals: 2, daytimeAttacks: 4,
  stopPlayerHp: 60, minimumLaborEnergy: 15, retainFood: 3, maximumSingleIdleSeconds: 120, maximumTotalIdleSeconds: 360,
  training: 0, purposelessRest: 0, maximumGoalDrivenRestMinutes: 30, maximumGoalDrivenRestInstances: 1,
  navigationSecondsPerGoal: 30, maximumNavigationDetours: 3, encounterWarningPercent: 80 };
const report = { schema: 'NaturalMixedBrowserShortV1', runner: 'browser-natural-mixed-v1', runnerSha256: sha(runner),
  sourceHtmlSha256: sourceHash, expectedHtmlSha256: opts['--expect-html-sha256'], actorSpritesSha256: sha(sprites),
  mode: 'fresh-zero-save-injection-budgeted-short-natural-mixed-route', parameters: opts, budgets,
  policy: { freshBrowserContext: true, initialStorageMustBeEmpty: true, publicStart: true, saveInjection: false,
    initScriptInjection: false, hiddenGameActions: false, hiddenStateMutation: false, resume: false,
    goalKnowledge: 'public HUD/context controls and non-fogged rendered map objects/public art and tag metadata only; no hidden rewards',
    privilegedSafetySource: 'read-only complete actual writer worldZombies and kind/speedFactor/position; conservative veto only; not actor-authorized observation',
    actorProjectionComplete: false, doesNotAssumeNpcOrTowerRescue: true, automaticThreeDayContinuation: false },
  checks: [], errors: [], documents: [], snapshots: [], actions: [], safety: [], navigation: [], blockedGoals: [],
  coverage: { eventChoice: false, resourceCollection: false, npcInteraction: false, exploration: false, planting: false,
    usefulConstruction: false, goalDrivenRestAttempted: false, goalDrivenRest: false, encounter: false, harvest: false, threeDays: false },
  timers: { readingMs: 0, saveVerificationMs: 0, publicRestMs: 0, navigationMs: 0, idleMs: 0 },
  naturalThreeDaysStatus: 'NOT_COVERED', status: 'RUNNING', terminal: null };
class RouteStop extends Error { constructor(status, message) { super(message); this.status = status; } }
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); };
function writeReport() { writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
const clock = p => (p.day - 1) * 1440 + p.hour * 60 + p.minute;
let browser, context, page, snapshotSeq = 0, actionSeq = 0, lastSave = null, finishing = false;
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
      tiles: [...document.querySelectorAll('#world .tile:not(.fogged)')].map(t => ({ x: Number(t.dataset.x), y: Number(t.dataset.y),
        text: t.innerText, tag: t.querySelector('.tag')?.textContent || '', water: t.classList.contains('water'),
        building: t.classList.contains('building-footprint'), buildingType: t.querySelector('[data-building-type]')?.getAttribute('data-building-type') || null,
        area: t.classList.contains('camp-area'), className: t.className })) };
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
async function action(type, motivation, minutes, click, verify) {
  if (actionSeq >= budgets.meaningfulActions) throw new RouteStop('INCOMPLETE_BUDGET', 'meaningful action count budget reached');
  await allowLabor(type, minutes); const before = await snapshot(`${actionSeq}-${type}-before`), beforeUi = await ui(), start = Date.now();
  await click();
  const after = await waitSaved((p, v) => p.worldMeta.eventSeq > v.seq && p.worldMeta.events.some(e => e.seq > v.seq && e.type === v.type), { seq: before.worldMeta.eventSeq, type });
  const events = after.worldMeta.events.filter(e => e.seq > before.worldMeta.eventSeq), commands = after.worldMeta.replay.commands.filter(c => events.some(e => e.commandId === c.commandId || e.causationId === c.commandId));
  const record = { index: actionSeq++, type, motivation, estimatedActionMinutes: minutes, wallMs: Date.now() - start,
    before: { minute: clock(before), hp: before.hp, energy: before.energy, food: before.food }, after: { minute: clock(after), hp: after.hp, energy: after.energy, food: after.food },
    beforePublic: beforeUi, events, commands, result: verify(before, after, events, commands) };
  report.actions.push(record); check(`${type}: actual command/receipt and measured intended change`, record.result === true);
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
async function attemptNearbyNpc(motivation) {
  if (report.coverage.npcInteraction) return true;
  const npc = page.locator('[data-context-action="npc"]');
  if (!(await npc.isVisible()) || !(await npc.isEnabled())) { report.blockedGoals.push({ goal: 'NPC', reason: 'no actually available local NPC request at this public location', motivation }); return false; }
  report.npcContactPublic = await page.locator('#contextPanel').innerText();
  const before = await save(); await npc.click();
  await waitSaved((p,v) => p.worldMeta.eventSeq > v.seq && p.worldMeta.events.some(e => e.type === 'npc.interacted' && e.seq > v.seq), { seq: before.worldMeta.eventSeq });
  const dialogue = await page.locator('#toast').innerText();
  report.actions.push({ type: 'npc-dialogue-read', motivation, publicDialogue: dialogue, countedAsSuccessfulSupport: false });
  if (!dialogue.includes('再次按 E')) { report.blockedGoals.push({ goal: 'NPC support confirmation', reason: dialogue }); return false; }
  await action('npc.interacted', '阅读当前真正近邻角色状态后第二次公开确认请求支援；只将实际support/bond/memory变化计作成功。', 15, () => page.locator('[data-context-action="npc"]').click(), (b,a,events,commands) => {
    const changed = a.npcs.find(n => n.supportRequested && !b.npcs.find(old => old.id === n.id).supportRequested && n.bond > b.npcs.find(old => old.id === n.id).bond);
    return !!changed && events.some(e => e.type === 'npc.interacted') && commands.some(c => c.type === 'npc.interact' && c.payload.npcId === changed.id) && changed.memory.helpedByPlayer > b.npcs.find(old => old.id === changed.id).memory.helpedByPlayer;
  }); report.coverage.npcInteraction = true; return true;
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
        return !old.planted && plot.planted && !plot.ready && a.seeds === b.seeds - 1 && events.some(e => e.type === 'crop.changed') && commands.some(c => c.type === 'crop.change');
      }); report.coverage.planting = true;
    }
  }
  if (garden) {
    await navigate(garden, '给已播种且未来需回来收获的菜田建立一处有用途的近场防护。');
    const view = await ui();
    if (view.wood >= 12 && view.stone >= 5) {
      await allowLabor('farm-protection-construction', 45);
      await page.keyboard.press('c');
      const tower = page.locator('[data-build="tower"]');
      if (await tower.isVisible()) {
        await tower.click(); const candidateUi = await ui();
        const sites = candidateUi.tiles.filter(t => t.className.includes('build-target') && Math.hypot(t.x-garden.x,t.y-garden.y) <= 3 &&
          Math.hypot(t.x-candidateUi.player.x,t.y-candidateUi.player.y) >= 1.0 && Math.hypot(t.x-candidateUi.player.x,t.y-candidateUi.player.y) <= 1.6);
        sites.sort((a,b) => Math.hypot(a.x-garden.x,a.y-garden.y)-Math.hypot(b.x-garden.x,b.y-garden.y));
        if (sites[0]) {
          const site = sites[0]; report.constructionPublicSite = site;
          await action('building.constructed', '在公开标记为可建造的近邻空地建一座塔，覆盖原菜田与回访收获通路。', 45, () => page.locator(`#world .tile[data-x="${site.x}"][data-y="${site.y}"]`).click(), (b,a,events,commands) => a.buildings.some(x => x.type === 'tower' && x.x === site.x && x.y === site.y && x.id && !b.buildings.some(old => old.id === x.id)) && a.wood === b.wood - 12 && a.stone === b.stone - 5 && events.some(e => e.type === 'building.constructed') && commands.some(c => c.type === 'building.construct'));
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
  report.cleanup = { browserClosed: true, contextClosed: true, httpServerClosed: !server.listening };
  report.ok = report.status === 'SHORT_MIXED_OBSERVED' && report.errors.length === 0 && report.passed === report.count;
  writeReport(); console.log(JSON.stringify({ out, status: report.status, ok: report.ok, passed: report.passed, count: report.count, terminal: report.terminal, coverage: report.coverage, terminalReason: report.terminalReason, errors: report.errors, elapsedWallMs: report.elapsedWallMs, runnerSha256: report.runnerSha256, sourceHtmlSha256: sourceHash }, null, 2));
}
if (!report.ok) process.exitCode = 1;
