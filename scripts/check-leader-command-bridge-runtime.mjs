#!/usr/bin/env node
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'dist', 'index.html');
const adapterPath = path.join(root, 'scripts', 'check-report-recovery.mjs');
const html = readFileSync(htmlPath, 'utf8');
const adapter = readFileSync(adapterPath, 'utf8');
const saveKey = 'zombie-harvest-progress-v12';
const begin = adapter.indexOf('function runtime(entries = []) {');
const end = adapter.indexOf('\nfunction envelope(payload)', begin);
assert.ok(begin >= 0 && end > begin);
const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(item => item[1]).filter(text => text.trim());
assert.equal(inline.length, 1);
const runtime = vm.runInNewContext('(' + adapter.slice(begin, end).trim() + ')', { inline, htmlPath, saveKey, vm, assert, console, URLSearchParams });
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fresh() { const r = runtime(); assert.equal(r.api.start().ok, true); return r; }
const checks = [];
const check = (name, fn) => { try { fn(); checks.push({ name, ok: true }); } catch (error) { checks.push({ name, ok: false, error: String(error.message || error) }); } };
const r = fresh();
r.api.state.contentState.meters.campTrust = 60;
r.api.state.contentState.commandPoints = 1;
r.api.state.contentState.commandPointsMax = 3;
r.api.state.contentState.commandPointsGrantedDay = r.api.state.day;
assert.equal(r.api.generatePlan({ source: 'TEST-ONLY leader bridge' }).ok, true);
const selectedId = r.api.state.contentState.planMeeting.selectedId;
const before = clone(r.api.state);
const result = r.api.commit('support', selectedId);
check('real reducer accepts mapped plan.meeting.commit', () => {
  assert.equal(result.ok, true); assert.equal(result.event.type, 'plan.meeting.committed');
  assert.equal(result.event.payload.action, 'support'); assert.equal(result.event.payload.selectedId, selectedId);
});
check('real reducer deducts one CP and keeps plan authority', () => {
  assert.equal(r.api.state.contentState.commandPoints, 0);
  assert.equal(r.api.state.contentState.planMeeting.status, 'committed');
  assert.equal(r.api.state.contentState.planMeeting.playerAction, 'support');
  assert.equal(r.api.state.contentState.planMeeting.committedDay, r.api.state.day);
});
check('real CommandBus writes replay command and event causation fields', () => {
  const commands = r.api.state.worldMeta.replay.commands.filter(command => command.commandId === result.commandId);
  assert.equal(commands.length, 1); assert.equal(commands[0].type, 'plan.meeting.commit');
  assert.equal(commands[0].payload.action, 'support'); assert.equal(commands[0].payload.planId, selectedId);
  assert.equal(result.event.commandId, result.commandId); assert.equal(Object.hasOwn(result.event, 'causationId'), true);
});
check('real SAVE21 writer validates the bridge projection', () => {
  assert.equal(r.api.save(), true);
  const raw = r.storage.get(saveKey), parsed = JSON.parse(raw);
  assert.equal(parsed.payload.version, 21); assert.equal(parsed.payload.contentState.commandPoints, 0);
  assert.equal(parsed.payload.contentState.planMeeting.status, 'committed');
  assert.equal(parsed.payload.worldMeta.replay.commands.some(command => command.commandId === result.commandId), true);
  assert.equal(r.api.validate({ raw, sourceCategory: 'primary' }).ok, true);
});
check('stale second click cannot debit or commit twice', () => {
  const beforeRetry = clone(r.api.state.contentState), commandSeq = r.api.state.worldMeta.commandSeq;
  const retry = r.api.commit('support', selectedId);
  assert.equal(retry.ok, false); assert.equal(retry.reason, 'plan-not-open');
  assert.deepEqual(clone(r.api.state.contentState), beforeRetry);
  assert.equal(r.api.state.worldMeta.events.filter(event => event.type === 'plan.meeting.committed').length, 1);
  assert.equal(r.api.state.worldMeta.commandSeq, commandSeq + 1);
});
check('leader identity remains an explicit migration gap', () => {
  assert.equal(result.event.actorId, 'player-1');
  assert.equal(r.api.state.worldMeta.replay.commands.find(command => command.commandId === result.commandId).actorId, 'player-1');
});
const output = {
  runner: 'source-leader-command-bridge-runtime', sourceHash: hash(html), adapterHash: hash(adapter),
  productionWiring: false, naturalGameplay: false, migrationRequired: true,
  leaderAttribution: 'pending-save-replay-migration-adr', ok: checks.every(item => item.ok),
  count: checks.length, passed: checks.filter(item => item.ok).length, checks
};
console.log(JSON.stringify(output, null, 2));
process.exitCode = output.ok ? 0 : 1;
