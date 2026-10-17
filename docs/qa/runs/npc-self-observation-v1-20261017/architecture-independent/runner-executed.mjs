import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sourceRuntimeFactory, saveKey } from './inputs/scripts/lib/source-runtime-fixture.mjs';
import { projectNpcSelfObservationV1, resolveNpcSelfDialogueV1 } from './inputs/scripts/lib/npc-self-observation-v1.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'public'); fs.mkdirSync(output, { recursive: true });
const hash = b => createHash('sha256').update(b).digest('hex');
const htmlPath = path.join(root, 'inputs/dist/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const moduleText = fs.readFileSync(path.join(root, 'inputs/scripts/lib/npc-self-observation-v1.mjs'), 'utf8');
assert.equal(hash(Buffer.from(html)), 'c42056ed08c9cbc0e27c09365828fae5d1c19dc25190e9e19d2e3beffa45bc91');
const factory = sourceRuntimeFactory(htmlPath);
const plain = v => JSON.parse(JSON.stringify(v));
const checks = [], findings = [], observations = [];
function check(name, fn) { try { fn(); checks.push({ name, ok: true }); } catch (e) { checks.push({ name, ok: false, error: e.message }); } }
function fresh(entries = []) {
  const r = factory(entries);
  vm.runInContext('Object.assign(qa,{captureFromQualifiedNpc,prepareNpcSelfDialogue,interactNpc,npcPublicActionGate,viewNpc});', r.context);
  assert.equal(r.api.start().ok, true);
  r.tasks.clear();
  const n = r.api.state.npcs.find(v => v.id === 'doctor');
  r.api.state.player.x = n.x; r.api.state.player.y = n.y;
  return { r, n };
}
function snapshot(r) {
  return { state: structuredClone(r.api.state), storage: [...r.storage],
    registry: JSON.stringify(['eventDef','eventChain','weapon','npc','building','outpost'].map(k => r.api.contentRegistry.all(k))),
    timers: [...r.tasks].map(([id, task]) => ({ id, ...task })) };
}
function deeplyFrozen(v) { if (!v || typeof v !== 'object') return true; return Object.isFrozen(v) && Object.values(v).every(deeplyFrozen); }
function prepare(r, n) { return r.api.prepareNpcSelfDialogue(n); }
function shape(n, { hp = 50, maxHp = 100, lifeState = 'injured', trust = 0, hunger = 70, fatigue = 70, energy = 25 } = {}) {
  Object.assign(n, { hp, maxHp, lifeState }); n.relations.trustToPlayer = trust;
  Object.assign(n.needs, { hunger, fatigue, energy });
}

check('actual embedded self core equals the frozen module byte range', () => {
  const core = text => text.slice(text.indexOf('// NPC_SELF_CORE_START'), text.indexOf('// NPC_SELF_CORE_END') + '// NPC_SELF_CORE_END'.length);
  assert.equal(core(html), core(moduleText));
});
check('private component is deeply frozen and leaves complete state/storage/registry/timers untouched', () => {
  const { r, n } = fresh(); shape(n);
  const before = snapshot(r), result = prepare(r, n);
  assert.deepStrictEqual(snapshot(r), before); assert.equal(deeplyFrozen(result), true);
  assert.equal(result.observation.actor.id, 'doctor');
  assert.deepEqual(plain(result.observation.knowledge[0].facts), { lifeState: 'injured', hpBand: '2/4', needBands: { hunger: 'urgent', fatigue: 'urgent', energy: 'low' } });
  for (const key of ['hp','maxHp','relations','trustToPlayer','x','y','targetId','memory']) assert.equal(JSON.stringify(result).includes('"' + key + '"'), false);
  n.hp = 10; n.needs.hunger = 0;
  assert.equal(result.observation.knowledge[0].facts.hpBand, '2/4');
  assert.equal(result.expression.facts.needBands.hunger, 'urgent');
});
check('real personal trust -10 includes details and hunger has authored priority', () => {
  const { r, n } = fresh(); shape(n, { trust: -10 }); const x = prepare(r, n).expression;
  assert.equal(x.disclosureReason, 'allowed'); assert.equal(x.facts.hpBand, '2/4');
  assert.ok(x.text.includes('我饿得厉害，得找点吃的。')); assert.ok(!x.text.includes('我累得厉害')); assert.ok(!x.text.includes('我快没力气'));
});
check('trust just below -10 withholds details without erasing authorized self knowledge', () => {
  const { r, n } = fresh(); shape(n, { trust: -10.0001 }); const x = prepare(r, n);
  assert.equal(x.expression.disclosureReason, 'limited-trust'); assert.equal(Object.hasOwn(x.expression.facts, 'hpBand'), false);
  assert.equal(Object.hasOwn(x.expression.facts, 'needBands'), false); assert.equal(x.observation.knowledge[0].facts.hpBand, '2/4');
});
check('missing/NaN/string/out-of-range personal trust remains unknown with no source normalization', () => {
  for (const trust of [undefined, NaN, '100', -101, 101, null]) {
    const { r, n } = fresh(); shape(n); n.relations.trustToPlayer = trust; const before = snapshot(r); const x = prepare(r, n);
    assert.equal(x.expression.disclosureReason, 'relation-unknown'); assert.equal(Object.hasOwn(x.expression.facts, 'hpBand'), false);
    assert.equal(x.expression.facts.lifeState, 'injured'); assert.deepStrictEqual(snapshot(r), before);
  }
});
check('69/70 and 25/26 need boundaries use fixed literal expectations', () => {
  const { r, n } = fresh(); shape(n, { hunger: 69, fatigue: 69, energy: 26 });
  assert.deepEqual(plain(prepare(r,n).expression.facts.needBands), { hunger: 'normal', fatigue: 'normal', energy: 'normal' });
  n.needs.hunger = 70; n.needs.fatigue = 70; n.needs.energy = 25;
  assert.deepEqual(plain(prepare(r,n).expression.facts.needBands), { hunger: 'urgent', fatigue: 'urgent', energy: 'low' });
});
check('one invalid need stays unknown and does not suppress another known urgent need', () => {
  for (const value of [undefined, NaN, '99', -1, 101]) {
    const { r, n } = fresh(); shape(n); n.needs.hunger = value; const before = snapshot(r), x = prepare(r,n);
    assert.equal(x.expression.facts.needBands.hunger, 'unknown'); assert.equal(x.expression.facts.needBands.fatigue, 'urgent');
    assert.ok(x.expression.text.includes('我累得厉害，需要休息。')); assert.ok(!x.expression.text.includes('饿得厉害'));
    assert.deepStrictEqual(snapshot(r), before);
  }
});
check('living lowest/highest HP bands neither claim death nor guarantee safety', () => {
  const { r, n } = fresh(); shape(n, { hp: 1, lifeState: 'critical', hunger: 0, fatigue: 0, energy: 100 });
  let x = prepare(r,n).expression; assert.equal(x.facts.hpBand, '0/4'); assert.ok(x.text.includes('我伤得很重。')); assert.ok(!x.text.includes('死亡'));
  shape(n, { hp: 100, lifeState: 'healthy', hunger: 0, fatigue: 0, energy: 100 });
  x = prepare(r,n).expression; assert.equal(x.facts.hpBand, '4/4'); assert.ok(!/保证|安全|战斗/.test(x.text));
});
check('session generation, event watermark and motion revision change observation hash', () => {
  const { r, n } = fresh(); shape(n); let last = prepare(r,n).observation.observationHash;
  for (const mutate of [() => r.api.session.generation++, () => r.api.state.worldMeta.eventSeq++, () => r.api.state.motion.stepIndex++]) {
    mutate(); const next = prepare(r,n).observation; assert.notEqual(next.observationHash, last); last = next.observationHash;
  }
});
check('AI OFF/ON changes no authorized knowledge/facts/text', () => {
  const { r, n } = fresh(); shape(n); r.api.state.scenarioSnapshot.aiConfig.observerCommentary = false; const off = prepare(r,n);
  r.api.state.scenarioSnapshot.aiConfig.observerCommentary = true; const on = prepare(r,n);
  assert.deepEqual(plain(off.observation), plain(on.observation)); assert.deepEqual(plain(off.expression.facts), plain(on.expression.facts)); assert.equal(off.expression.text, on.expression.text);
});
check('runtime adapter rejects detached, duplicate, distant, dead and non-roster subjects', () => {
  for (const condition of ['detached','duplicate','far','dead','non-roster']) {
    const { r, n } = fresh(); shape(n); let target = n;
    if (condition === 'detached') target = structuredClone(n);
    if (condition === 'duplicate') r.api.state.npcs.push(structuredClone(n));
    if (condition === 'far') r.api.state.player.x = n.x + 1.018;
    if (condition === 'dead') { n.hp = 0; n.lifeState = 'dead'; }
    if (condition === 'non-roster') n.id = 'TEST-ONLY-unknown';
    const before = snapshot(r), x = prepare(r,target);
    assert.equal(x.expression.fallbackReason, 'not-observable', condition); assert.deepStrictEqual(snapshot(r), before);
  }
});
check('reverse outpost assignment blocks self capture even when legacy view field says camp-local', () => {
  const { r, n } = fresh(); shape(n); n.garrisonedOutpostId = null;
  r.api.state.contentState.outposts = { 'TEST-ONLY-reverse': { guardNpcIds: [n.id] } };
  assert.equal(r.api.npcPublicActionGate(n, { action: 'view' }).ok, true);
  const before = snapshot(r), x = prepare(r,n); assert.equal(x.expression.fallbackReason, 'not-observable'); assert.deepStrictEqual(snapshot(r), before);
});
check('runtime adapter does not accept extra caller trust or a substituted subject', () => {
  const { r, n } = fresh(); shape(n, { trust: -100 });
  assert.equal(r.api.prepareNpcSelfDialogue(n, { relationTrust: 100 }).expression.fallbackReason, 'not-observable');
  assert.equal(prepare(r,n).expression.disclosureReason, 'limited-trust');
});
check('failed private capture produces an unattributed UI fallback on the actual first-talk path', () => {
  const { r, n } = fresh(); shape(n);
  r.api.state.contentState.outposts = { 'TEST-ONLY-reverse': { guardNpcIds: [n.id] } };
  const result = r.api.interactNpc(n, { commandId: 'TEST-ONLY-fallback-first-talk' });
  assert.equal(result.ok, true); assert.equal(result.result.operation, 'dialogue-open');
  const text = r.node('toast').textContent;
  assert.ok(text.startsWith('暂时无法确认这位角色的伤势信息。')); assert.ok(!text.includes(n.name + '：'));
  assert.equal(result.result.payment.cost.energy, 0); assert.equal(result.result.clock.elapsedMinutes, 0);
});
check('actual free first talk remains dialogueOpened with critical, E0 and paused clock', () => {
  const { r, n } = fresh(); shape(n, { hp: 1, lifeState: 'critical' }); r.api.state.energy = 0; r.api.state.worldMeta.clock.paused = true;
  const beforeMinute = r.api.state.day * 1440 + r.api.state.hour * 60 + r.api.state.minute;
  const oldReplay = r.api.state.worldMeta.replay.commands.length;
  const result = r.api.interactNpc(n, { commandId: 'TEST-ONLY-free-first-talk' });
  assert.equal(result.ok, true); assert.equal(result.result.operation, 'dialogue-open'); assert.equal(result.event.type, 'npc.dialogueOpened');
  assert.equal(result.result.payment.cost.energy, 0); assert.equal(result.result.clock.elapsedMinutes, 0); assert.equal(result.result.advance, null);
  assert.equal(r.api.state.energy, 0); assert.equal(r.api.state.day * 1440 + r.api.state.hour * 60 + r.api.state.minute, beforeMinute);
  const commands = r.api.state.worldMeta.replay.commands.slice(oldReplay); assert.equal(commands.length, 1); assert.equal(commands[0].type, 'npc.interact');
  const text = r.node('toast').textContent; assert.ok(text.includes('我伤得很重。')); assert.ok(!/HP|信任|已锁定|视野/.test(text));
  const firstTalkUi = { npcSelfClass: r.node('toast').classList.contains('npc-self-dialogue'),
    showClass: r.node('toast').classList.contains('show'),
    timers: [...r.tasks].map(([id,task])=>({id,kind:task.kind,delay:task.delay})) };
  const ordinaryView = r.api.viewNpc(n);
  const ordinaryViewUi = { result: plain(ordinaryView), npcSelfClass: r.node('toast').classList.contains('npc-self-dialogue'),
    showClass: r.node('toast').classList.contains('show'),
    timers: [...r.tasks].map(([id,task])=>({id,kind:task.kind,delay:task.delay})) };
  observations.push({ name: 'actual-free-first-talk', result: plain(result), text, firstTalkUi, ordinaryViewUi,
    uiScope: 'Actual toast/class/timer IO fields only; no CSS layout, pixel visibility or duration-in-browser claim.' });
});
check('duplicate parent command does not recapture or open paid confirmation', () => {
  const { r, n } = fresh(); shape(n); const first = r.api.interactNpc(n, { commandId: 'TEST-ONLY-duplicate-first' }); assert.equal(first.ok, true);
  const before = snapshot(r); n.hp = 20; const afterConditionChange = snapshot(r);
  const duplicate = r.api.interactNpc(n, { commandId: 'TEST-ONLY-duplicate-first' }); assert.equal(duplicate.duplicate, true);
  assert.deepStrictEqual(snapshot(r), afterConditionChange); assert.equal(before.state.npcTalkOpen, r.api.state.npcTalkOpen);
});
check('tampered pure format hash fails closed without claiming world authentication', () => {
  const { r, n } = fresh(); shape(n); const obs = plain(prepare(r,n).observation); obs.knowledge[0].facts.hpBand = '4/4';
  const x = resolveNpcSelfDialogueV1(obs, 100); assert.equal(x.fallbackReason, 'not-observable');
  const clone = plain(r.api.captureFromQualifiedNpc(n)); clone.extra = true; assert.equal(projectNpcSelfObservationV1(clone).knowledge.length, 0);
});

// Separate diagnostic: these are legal source-writer snapshots, not forged
// observations and not a claim that the condition arose through natural play.
{
  const { r, n } = fresh(); shape(n, { hp: 1, lifeState: 'healthy', hunger: 0, fatigue: 0, energy: 100 });
  const beforeLoad = plain(prepare(r,n).expression); assert.equal(r.api.save(), true);
  const raw = r.storage.get(saveKey); fs.writeFileSync(path.join(output, 'TEST-ONLY-healthy-hp1-source-native.json'), raw);
  const validation = r.api.validate({ raw, sourceCategory: 'primary' });
  const next = fresh([[saveKey,raw]]), afterLoad = plain(prepare(next.r,next.n).expression);
  check('conflicting healthy HP1 is uniform unknown before and after actual unchanged native writer/loader', () => {
    assert.equal(hash(Buffer.from(raw)), '8b64d54a0d04abd943ad928c495135270579023c96324b892e45abdb2fe545b4');
    assert.equal(validation.ok, true);
    assert.equal(next.n.lifeState, 'healthy'); assert.equal(next.n.hp, 1);
    for (const x of [beforeLoad, afterLoad]) {
      assert.equal(x.fallbackReason, 'not-observable'); assert.equal(x.observationHash, null);
      assert.equal(x.facts.id, null); assert.equal(x.facts.lifeState, 'unknown');
      assert.equal(Object.hasOwn(x.facts, 'hpBand'), false); assert.equal(Object.hasOwn(x.facts, 'needBands'), false);
      assert.equal(x.text, '暂时无法确认这位角色的伤势信息。');
    }
  });
  check('conflicting healthy HP1 actual first talk stays free and preserves NPC/writer facts', () => {
    const beforeNpc = structuredClone(next.n), beforeKeys = Object.keys(JSON.parse(next.r.storage.get(saveKey)).payload).sort();
    const result = next.r.api.interactNpc(next.n, { commandId: 'TEST-ONLY-contradictory-first-talk' });
    assert.equal(result.ok, true); assert.equal(result.result.operation, 'dialogue-open'); assert.equal(result.event.type, 'npc.dialogueOpened');
    assert.equal(result.result.payment.cost.energy, 0); assert.equal(result.result.clock.elapsedMinutes, 0); assert.equal(result.result.advance, null);
    const text = next.r.node('toast').textContent;
    assert.ok(text.startsWith('暂时无法确认这位角色的伤势信息。')); assert.ok(!text.includes(next.n.name + '：')); assert.ok(!text.includes('没有受伤'));
    assert.deepStrictEqual(structuredClone(next.n), beforeNpc);
    assert.equal(next.r.api.save(), true); const afterRaw = next.r.storage.get(saveKey), payload = JSON.parse(afterRaw).payload;
    assert.equal(next.r.api.validate({raw: afterRaw,sourceCategory:'primary'}).ok, true);
    assert.deepEqual(Object.keys(payload).sort(), beforeKeys);
    assert.deepEqual(payload.npcs.find(v=>v.id==='doctor'), JSON.parse(raw).payload.npcs.find(v=>v.id==='doctor'));
    fs.writeFileSync(path.join(output, 'TEST-ONLY-healthy-hp1-after-first-talk-native.json'), afterRaw);
    const again = fresh([[saveKey,afterRaw]]);
    assert.equal(again.n.lifeState, 'healthy'); assert.equal(again.n.hp, 1); assert.equal(prepare(again.r,again.n).expression.fallbackReason, 'not-observable');
  });
  observations.push({ name: 'healthy-hp1-legal-writer-diagnostic', writerSha256: hash(Buffer.from(raw)), validation: { ok: validation.ok, reason: validation.reason ?? null, originalChecksum: validation.originalChecksum }, beforeLoad, afterLoad, restoredLifeState: next.n.lifeState, restoredHp: next.n.hp });
  findings.push({ severity: 'retained-global-open', name: 'existing Gate/validator/old UI lifeState consistency policy remains unchanged', detail: 'The exact original controlled native writer remains accepted and healthy+HP1 survives loader. Only the new self observation now rejects its contradiction; no global repair is claimed.' });
}

const report = { schema: 'NpcSelfIndependentReadonlyAuditV1', sourceHtmlSha256: hash(Buffer.from(html)), moduleSha256: hash(Buffer.from(moduleText)),
  runnerSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))),
  ok: checks.every(c => c.ok), count: checks.length, passed: checks.filter(c => c.ok).length, checks, findings, observations,
  inputClassification: 'TEST-ONLY source VM controlled preconditions; normal actual public start, actual helpers/Gate/reducer/Bus and native writer. Not naturally reached scenes.',
  ioScope: 'Frozen canonical sourceRuntimeFactory and IO adapter; DOM/storage/timers simulated; renderWorld/renderHud/renderContext suppressed by original adapter. Actual renderSurvivors and NPC reducer remain. No browser or natural run.',
  authorizationBoundary: 'Pure format functions accepting constructed JSON is not world authentication; only the internal live-reference capture path is evaluated as runtime authority.',
  rootFilesChanged: false };
fs.writeFileSync(path.join(output,'report.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ ok: report.ok, count: report.count, passed: report.passed, findings: report.findings.length, reportSha256: hash(fs.readFileSync(path.join(output,'report.json'))) }));
if (!report.ok) process.exitCode=1;
