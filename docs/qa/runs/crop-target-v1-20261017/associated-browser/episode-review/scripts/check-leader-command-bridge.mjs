#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'scripts', 'fixtures', 'leader-harness');
const bridge = JSON.parse(readFileSync(path.join(fixtureDir, 'command-bridge-v1.json'), 'utf8'));
const html = readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
const checks = [];
const check = (name, fn) => { try { fn(); checks.push({ name, ok: true }); } catch (error) { checks.push({ name, ok: false, error: String(error.message || error) }); } };
check('bridge is explicit and versioned', () => {
  assert.equal(bridge.schema, 'LeaderCommandBridgeV1');
  assert.equal(bridge.intentAction, 'support_proposal');
  assert.equal(bridge.command.type, 'plan.meeting.commit');
  assert.equal(bridge.eventType, 'plan.meeting.committed');
});
check('production exposes the registered command and CommandBus path', () => {
  assert.match(html, /type:\s*'plan\.meeting\.commit'/);
  assert.match(html, /const CommandBus\s*=\s*\{/);
  assert.match(html, /function dispatchCommand\(command, reducer, options\)/);
});
check('receipt maps only stable IDs and registered effects', () => {
  for (const key of bridge.receipt.accepted) assert.match(key, /^[A-Za-z][A-Za-z0-9]*$/);
  assert.equal(bridge.receipt.accepted.includes('commandId'), true);
  assert.equal(bridge.receipt.accepted.includes('eventIds'), true);
  assert.equal(bridge.receipt.rejected.includes('fallbackIntentId'), true);
  assert.equal(bridge.receipt.duplicate.includes('replayOf'), true);
});
check('save projection reuses existing ledger fields and forbids new leader schema', () => {
  for (const key of bridge.saveProjection.requiredExistingPaths) assert.equal(typeof key, 'string');
  assert.match(html, /worldMeta\.replay\.commands/);
  assert.match(html, /seenCommands/);
  assert.match(html, /contentState/);
  assert.equal(bridge.saveProjection.leaderIntentPersistence, 'forbidden-until-separate-save-migration-adr');
});
check('cost and six-view review remain explicit', () => {
  assert.equal(bridge.cost.commandPoints, 1);
  assert.deepEqual([...bridge.sixViews].sort(), ['camp', 'enemy', 'faction', 'global-event-chain', 'npc', 'player'].sort());
});
const result = { runner: 'leader-command-bridge-contract', productionWiring: false, ok: checks.every(item => item.ok), count: checks.length, passed: checks.filter(item => item.ok).length, checks };
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.ok ? 0 : 1;
