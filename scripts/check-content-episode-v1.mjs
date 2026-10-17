import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sourceRuntimeFactory, startRuntime, envelope, saveKey, root, plain } from './lib/source-runtime-fixture.mjs';

const factory = sourceRuntimeFactory();
const fixture = JSON.parse(readFileSync(path.join(root, 'scripts/fixtures/content-episode-v1/save21-pre-identity-active.json'), 'utf8'));
const id = 'zh-food-shortage-001';
const checks = [];
function test(name, run) {
  try { run(); checks.push({ name, ok: true }); }
  catch (error) { checks.push({ name, ok: false, error: error.stack }); }
}
function fresh() {
  const r = startRuntime(factory);
  r.api.state.food = 0;
  r.api.contentHook('onDayStart', { actorId: 'camp-autonomy' });
  return r;
}
function token(r) {
  const active = r.api.state.contentState.activeChains[id];
  const button = r.node('qa-episode-choice');
  r.api.bindChoice(button, 'chain:' + id, 'ration', active.nodeId);
  return plain(r.api.expectedToken(button.dataset));
}
function resolve(r, choice, commandId, expected = token(r)) {
  return r.api.contentResolve(id, 'shortage_choice', choice, { commandId, ...expected });
}
function persistent(r) {
  const s = r.api.state;
  return plain({ food: s.food, energy: s.energy, content: s.contentState, npcs: s.npcs, buildings: s.buildings, forecast: s.hordeForecast, enemies: s.worldZombies });
}
function calendar(r, day) { const s = r.api.state; s.day = day; s.hour = 6; s.minute = 0; s.world.totalMinutes = (day - 1) * 1440 + 360; }
function write(r) {
  assert.equal(r.api.save({ force: true, reason: 'TEST-ONLY-episode' }), true);
  const saved = r.storage.get(saveKey);
  assert.equal(r.api.validatePayload(JSON.parse(saved).payload).ok, true);
  return saved;
}

test('legacy full writer fixture validates; loader adds identity without settlement', () => {
  const r = factory(), before = plain(fixture.payload);
  assert.equal(r.api.validatePayload(before).ok, true);
  const selected = { payload: before, sourceCategory: 'primary', originalChecksum: r.api.hash(before) };
  const draft = r.api.prepare(selected, r.api.classify(before));
  assert.deepEqual(fixture.payload, before);
  const active = draft.state.contentState.activeChains[id];
  assert.equal(active.instanceKey, id + ':1');
  assert.equal(active.instanceId, 'content:' + id + ':1');
  assert.equal(active.defId, id);
  assert.equal(active.definitionVersion, 1);
  assert.equal(active.episodeSchemaVersion, 1);
  assert.equal(draft.state.food, before.food);
  assert.deepEqual(plain(draft.state.worldMeta.events), before.worldMeta.events);
  assert.ok(draft.migration.reason.includes('content-episode-identity-v1'));
});
test('migrated active instance saves/reloads once and preserves original identity', () => {
  const r = startRuntime(factory, [[saveKey, envelope(factory, fixture.payload)]]);
  const migrated = plain(r.api.state.contentState.activeChains[id]);
  const saved = write(r);
  const reloaded = startRuntime(factory, [[saveKey, saved]]);
  assert.deepEqual(plain(reloaded.api.state.contentState.activeChains[id]), migrated);
  const migrationCount = reloaded.api.state.worldMeta.events.filter(e => e.type === 'save.migrated').length;
  assert.equal(migrationCount, 1);
  assert.equal(resolve(reloaded, 'ration', 'reload-episode-resolve').ok, true);
});
for (const [field, bad] of [
  ['instanceKey', 'other:1'], ['instanceId', 'wrong'], ['defId', 'other'],
  ['definitionVersion', 0], ['definitionVersion', '1'], ['definitionVersion', 999], ['episodeSchemaVersion', 2]
]) test('corrupt saved identity rejected: ' + field + '=' + bad, () => {
  const r = fresh(), saved = JSON.parse(write(r)).payload;
  saved.contentState.activeChains[id][field] = bad;
  assert.equal(r.api.validatePayload(saved).ok, false);
});
test('missing old fields migrate using startedAt, never current day', () => {
  const r = factory(), saved = plain(fixture.payload);
  saved.day = 3; saved.world.totalMinutes = 3240;
  delete saved.contentState.activeChains[id].instanceKey;
  const draft = r.api.prepare({ payload: saved, sourceCategory: 'primary' }, r.api.classify(saved));
  assert.equal(draft.state.contentState.activeChains[id].instanceKey, id + ':1');
});
test('legacy one-shot completion holds saved day only without rewriting history', () => {
  const r = factory(), saved = plain(fixture.payload);
  delete saved.contentState.activeChains[id];
  saved.contentState.completedChains.push(id);
  const draft = r.api.prepare({ payload: saved, sourceCategory: 'primary' }, r.api.classify(saved));
  assert.deepEqual(plain(draft.state.worldMeta.events), saved.worldMeta.events);
  assert.equal(draft.state.contentState.episodeLegacyHolds[id], 1);
  assert.ok(draft.state.contentState.completedChains.includes(id + ':1'));
  r.api.install(draft); r.api.writeInitial();
  assert.equal(r.api.contentRegistry.startChain(id).ok, false);
  calendar(r, 2);
  assert.equal(r.api.contentRegistry.startChain(id).ok, true);
});
test('real rendered producer carries all five identity fields into replay and receipt', () => {
  const r = fresh(), expected = token(r);
  assert.equal(Object.keys(expected).length, 5);
  assert.equal(expected.expectedInstanceId, 'content:' + id + ':1');
  assert.equal(resolve(r, 'ration', 'token-success', expected).ok, true);
  const command = r.api.state.worldMeta.replay.commands.find(c => c.commandId === 'token-success');
  for (const [key, value] of Object.entries(expected)) assert.equal(command.payload[key], value);
  const receipt = r.api.state.worldMeta.events.find(e => e.type === 'content.chain.resolved' && e.payload.chainId === id);
  assert.equal(receipt.instanceId, expected.expectedInstanceId);
  assert.equal(receipt.definitionVersion, 1);
});
for (const [field, bad] of [
  ['expectedInstanceId', 'content:old:1'], ['expectedInstanceKey', id + ':0'],
  ['expectedDefId', 'wrong'], ['expectedDefinitionVersion', 999], ['expectedNodeId', 'wrong']
]) test('CAS rejects stale ' + field + ' before effects', () => {
  const r = fresh(), expected = { ...token(r), [field]: bad }, before = persistent(r);
  assert.equal(resolve(r, 'forage', 'stale-' + field, expected).ok, false);
  assert.deepEqual(persistent(r), before);
  assert.ok(r.api.state.worldMeta.events.some(e => e.type === 'command.rejected'));
});
test('missing token fails closed; a current token still succeeds', () => {
  const r = fresh(), before = persistent(r);
  assert.equal(resolve(r, 'forage', 'no-token', {}).ok, false);
  assert.deepEqual(persistent(r), before);
  assert.equal(resolve(r, 'forage', 'with-token').ok, true);
});
test('old day button cannot settle the new day episode; current token and duplicate are safe', () => {
  const r = fresh(), old = token(r);
  assert.equal(resolve(r, 'ration', 'episode-one', old).ok, true);
  assert.equal(r.api.contentRegistry.startChain(id).ok, false);
  calendar(r, 2); r.api.contentHook('onDayStart', { actorId: 'camp-autonomy' });
  const before = persistent(r);
  assert.equal(resolve(r, 'forage', 'stale-old-button', old).ok, false);
  assert.deepEqual(persistent(r), before);
  const current = token(r);
  assert.equal(resolve(r, 'ration', 'episode-two', current).ok, true);
  const after = JSON.stringify(r.api.state);
  assert.equal(resolve(r, 'ration', 'episode-two', current).duplicate, true);
  assert.equal(JSON.stringify(r.api.state), after);
});
test('active episode survives midnight/reload with original token', () => {
  const r = fresh(), original = token(r);
  calendar(r, 2);
  const reloaded = startRuntime(factory, [[saveKey, write(r)]]);
  assert.deepEqual(token(reloaded), original);
  assert.equal(resolve(reloaded, 'ration', 'late-resolution', original).ok, true);
});
test('fallback rejects stale identity and records the correct original instance', () => {
  const r = fresh(), current = token(r), before = persistent(r);
  assert.equal(r.api.contentRegistry.resolveFallback(id, 'ifSkipped', { ...current, expectedInstanceKey: 'wrong' }).ok, false);
  assert.deepEqual(persistent(r), before);
  assert.equal(r.api.contentRegistry.resolveFallback(id, 'ifMissingNpc', current).ok, true);
  const event = r.api.state.worldMeta.events.find(e => e.type === 'content.chain.fallback' && e.payload.chainId === id);
  assert.equal(event.instanceId, current.expectedInstanceId);
  const effect = r.api.state.worldMeta.events.find(e => e.type === 'content.effects.applied' && e.payload.effectId === id + ':1:fallback:ifMissingNpc');
  assert.equal(effect.instanceId, current.expectedInstanceId);
  assert.equal(effect.defId, id); assert.equal(effect.definitionVersion, 1);
  const after = JSON.stringify(r.api.state);
  assert.equal(r.api.contentRegistry.resolveFallback(id, 'ifMissingNpc', current).duplicate, true);
  assert.equal(JSON.stringify(r.api.state), after);
  assert.equal(r.api.contentRegistry.resolveFallback(id, 'ifMissingNpc', { ...current, expectedNodeId: 'wrong' }).ok, false);
});
test('fallback and choice history IDs remain distinct across daily episodes', () => {
  const r = fresh();
  assert.equal(r.api.contentRegistry.resolveFallback(id, 'ifMissingNpc', token(r)).ok, true);
  calendar(r, 2); r.api.contentHook('onDayStart', { actorId: 'camp-autonomy' });
  assert.equal(r.api.contentRegistry.resolveFallback(id, 'ifMissingNpc', token(r)).ok, true);
  const fallback = r.api.state.contentState.history.filter(e => e.id.endsWith(':fallback:ifMissingNpc'));
  assert.equal(fallback.length, 2); assert.equal(new Set(fallback.map(e => e.id)).size, 2);
  for (const day of [3, 4]) {
    calendar(r, day); r.api.contentHook('onDayStart', { actorId: 'camp-autonomy' });
    assert.equal(resolve(r, 'ration', 'history-day-' + day).ok, true);
  }
  const choices = r.api.state.contentState.history.filter(e => e.payload.route === 'ration');
  assert.equal(choices.length, 2); assert.equal(new Set(choices.map(e => e.id)).size, 2);
  const historyEvents = r.api.state.worldMeta.events.filter(e => e.type === 'content.history' && e.payload.payload?.route === 'ration');
  assert.deepEqual(plain(historyEvents.map(e => e.instanceId)), ['content:' + id + ':3', 'content:' + id + ':4']);
});
test('repeatable autonomy effects and history keep the active instance identity', () => {
  const r = fresh(), customId = 'qa-repeatable-autonomy';
  const definition = plain(r.api.contentRegistry.get('eventChain', id));
  definition.id = definition.chainId = customId;
  definition.autonomy = { resultId: 'qa-closed', effects: [{ op: 'recordHistory', key: 'closed', payload: { testOnly: true } }] };
  assert.equal(r.api.contentRegistry.register('eventChain', definition).ok, true);
  assert.equal(r.api.contentRegistry.startChain(customId).ok, true);
  const button = r.node('qa-autonomy-choice');
  r.api.bindChoice(button, 'chain:' + customId, 'ration', 'shortage_choice');
  const expected = plain(r.api.expectedToken(button.dataset));
  assert.equal(r.api.contentRegistry.resolveAutonomy(customId, expected).ok, true);
  const effects = r.api.state.worldMeta.events.find(e => e.type === 'content.effects.applied' && e.defId === customId);
  assert.equal(effects.instanceId, expected.expectedInstanceId);
  assert.equal(effects.definitionVersion, 1);
  const history = r.api.state.contentState.history.find(e => e.payload.testOnly);
  assert.equal(history.id, customId + ':1:closed');
  assert.equal(r.api.state.contentState.activeChains[customId], undefined);
  const settled = JSON.stringify(r.api.state);
  assert.equal(r.api.contentRegistry.resolveAutonomy(customId, expected).duplicate, true);
  assert.equal(JSON.stringify(r.api.state), settled);
  assert.equal(r.api.contentRegistry.resolveAutonomy(customId, { ...expected, expectedNodeId: 'wrong' }).ok, false);
});
test('night and expiry reject choices and expiry scheduler settles without reward', () => {
  const r = fresh(), expected = token(r);
  r.api.state.night = true;
  assert.equal(resolve(r, 'forage', 'night', expected).ok, false);
  r.api.state.night = false; calendar(r, 14);
  assert.equal(resolve(r, 'forage', 'expired', expected).ok, false);
  r.api.contentHook('onDayStart', { actorId: 'camp-autonomy' });
  assert.equal(r.api.state.food, 0);
  assert.equal(r.api.state.contentState.activeChains[id], undefined);
});
test('HUD and observer settings are independent; observer switch persists', () => {
  const r = startRuntime(factory);
  assert.equal(r.api.state.scenarioSnapshot.aiConfig.observerCommentary, false);
  r.emit('settingsCompactHud', 'change', { target: { checked: true } });
  assert.equal(r.api.state.scenarioSnapshot.aiConfig.observerCommentary, false);
  r.emit('settingsObserverCommentary', 'change', { target: { checked: true } });
  assert.equal(r.api.state.scenarioSnapshot.aiConfig.observerCommentary, true);
  const reloaded = startRuntime(factory, [[saveKey, write(r)]]);
  assert.equal(reloaded.api.state.scenarioSnapshot.aiConfig.observerCommentary, true);
});
test('cache has a finite source and exposure cost; next episode and reload cannot reclaim it', () => {
  const r = fresh(), before = persistent(r);
  assert.equal(resolve(r, 'forage', 'cache-first').ok, true);
  assert.equal(r.api.state.food, 2);
  assert.equal(r.api.state.contentState.meters.resonancePressure, before.content.meters.resonancePressure + 2);
  assert.equal(r.api.state.contentState.flags['zh-shortage-cache-retrieved'], true);
  const receipt = r.api.state.contentState.history.find(e => e.payload.sourceId === 'zh-shortage-cache-001');
  assert.equal(receipt.payload.amount, 2);
  const reloaded = startRuntime(factory, [[saveKey, write(r)]]);
  calendar(reloaded, 2); reloaded.api.state.food = 0;
  reloaded.api.contentHook('onDayStart', { actorId: 'camp-autonomy' });
  const nextBefore = persistent(reloaded);
  assert.equal(resolve(reloaded, 'forage', 'cache-second').ok, false);
  assert.deepEqual(persistent(reloaded), nextBefore);
  assert.equal(resolve(reloaded, 'ration', 'cache-stay').ok, true);
  assert.equal(reloaded.api.state.food, 0);
  assert.equal(reloaded.api.state.contentState.meters.resonancePressure, nextBefore.content.meters.resonancePressure);
});
test('injured and critical expedition staff reject without granting cache; successor can recover it', () => {
  const r = fresh();
  const q = r.api.state.npcs.find(n => n.id === 'quartermaster');
  for (const lifeState of ['injured', 'critical', 'dead']) {
    q.lifeState = lifeState;
    const before = persistent(r);
    assert.equal(resolve(r, 'forage', 'role-' + lifeState).ok, false);
    assert.deepEqual(persistent(r), before);
  }
  const guard = r.api.state.npcs.find(n => n.id === 'guardJi');
  guard.actingRole = 'quartermaster'; guard.lifeState = 'healthy';
  assert.equal(resolve(r, 'forage', 'cache-successor').ok, true);
  assert.equal(r.api.state.food, 2);
  assert.equal(r.api.state.npcs.length, 10);
});
test('failed cache effect rolls back stock flag and exposure together', () => {
  const r = fresh(), before = persistent(r);
  const definition = r.api.contentRegistry.get('eventChain', id);
  const effects = plain(definition.nodes[0].choices.find(c => c.id === 'forage').effects);
  effects.push({ op: 'damageBuilding', buildingId: 'missing-building', value: 1 });
  const result = r.api.contentEffects(effects, { effectId: 'TEST-ONLY-broken-cache' });
  assert.equal(result.ok, false); assert.equal(result.rolledBack, true);
  assert.deepEqual(persistent(r), before);
});
test('actual embedded observer core equals Node core and cannot leak a withheld band', () => {
  const html = readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  const module = readFileSync(path.join(root, 'scripts/lib/observer-expression-v1.mjs'), 'utf8');
  const extract = text => text.split('// OBSERVER_CORE_START')[1].split('// OBSERVER_CORE_END')[0];
  assert.equal(extract(html).replace(/\r/g, ''), extract(module).replace(/\r/g, ''));
  const r = startRuntime(factory), before = JSON.stringify(r.api.state);
  const out = r.api.observerCommentary({ kind: 'event', id: 'x', threat: 90, secret: 'never' }, { relation: { trustToPlayer: -80 } });
  assert.equal(out.facts.threatBand, undefined);
  assert.equal(out.projection, undefined);
  assert.equal(JSON.stringify(out).includes('never'), false);
  assert.equal(Object.isFrozen(out.facts), true);
  assert.equal(JSON.stringify(r.api.state), before);
});
const report = { runner: 'source-content-episode-v1', passed: checks.filter(c => c.ok).length, count: checks.length, checks,
  sourceHtmlSha256: createHash('sha256').update(readFileSync(path.join(root, 'dist/index.html'))).digest('hex'),
  fixtureProvenance: { sourceCommit: fixture.sourceCommit, sourceHtmlSha256: fixture.sourceHtmlSha256, testOnly: fixture.testOnly },
  naturalGameplay: false };
report.ok = report.passed === report.count;
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
