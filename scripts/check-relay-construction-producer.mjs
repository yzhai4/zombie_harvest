#!/usr/bin/env node
/**
 * Trace the real relay-construction producer without changing the browser runtime.
 *
 * This is an architectural boundary check: it executes against the exact inline
 * source bytes, proves the current world.advance -> advanceReducer ->
 * updateRelayProject path, and records that the stage-only relay.projectAdvance
 * producer is explicitly feature gated. It must fail if a future edit silently
 * changes the producer order, removes the default-off gate, or breaks the
 * declarative EventDef metadata contract.
 */
import assert from 'node:assert/strict';
import { readSourceTarget } from './runtime-source-target.mjs';

const { source, sourceHash, htmlPath } = readSourceTarget();
const inlineBlocks = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .filter(text => text.trim());
assert.equal(inlineBlocks.length, 1, 'one inline runtime expected');
const inline = inlineBlocks[0];

function bodyBetween(startNeedle, endNeedle) {
  const start = inline.indexOf(startNeedle);
  assert.ok(start >= 0, `missing source boundary: ${startNeedle}`);
  const end = inline.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, `missing source end boundary: ${endNeedle}`);
  return inline.slice(start, end);
}

const advanceBody = bodyBetween('function advance(minutes, options = {})', 'let worldRenderFrame');
const reducerBody = bodyBetween('function advanceReducer(minutes)', 'function advance(minutes, options = {})');
const timerBody = bodyBetween('function startWorldSimulation()', 'function spendEnergy(amount)');
const constructionBody = bodyBetween('function updateRelayProject(minutes = 0)', 'function discoverLandmarkReducer(landmark)');
const relayDefinitionStart = inline.indexOf("registerEventDefinition({ id: 'relay-chain-001'");
assert.ok(relayDefinitionStart >= 0, 'relay definition required');
const relayDefinitionEnd = inline.indexOf("registerEventDefinition({ id: 'npc.sanity'", relayDefinitionStart);
assert.ok(relayDefinitionEnd > relayDefinitionStart, 'relay definition end required');
const relayDefinition = inline.slice(relayDefinitionStart, relayDefinitionEnd);

const checks = [];
function check(name, run) {
  try {
    run();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: String(error?.message || error) });
  }
}
function orderOf(text, needles) {
  const positions = needles.map(needle => text.indexOf(needle));
  assert.ok(positions.every(position => position >= 0), 'all order markers must exist');
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(positions[index - 1] < positions[index], `order violated near ${needles[index]}`);
  }
}

check('world.advance is the explicit CommandBus producer', () => {
  assert.match(advanceBody, /dispatchCommand\(\{ type: 'world\.advance'/);
  assert.match(advanceBody, /advanceReducer\(amount\)/);
});
check('advanceReducer calls relay construction between NPC routine and world combat', () => {
  orderOf(reducerBody, [
    'updateNpcRoutine(minutes)',
    'updateRelayProject(minutes)',
    'simulateWorldZombies(minutes)',
    'runDayCombat(minutes)'
  ]);
});
check('daytime timer is the only automatic advance source', () => {
  assert.match(timerBody, /SessionController\.isDay\(\)/);
  assert.match(timerBody, /setInterval\(\(\) =>/);
  assert.match(timerBody, /advance\(Math\.max\(1/);
});
check('construction reducer emits the three relay construction facts', () => {
  assert.match(constructionBody, /relay\.constructionStarted/);
  assert.match(constructionBody, /relay\.materialsCommitted/);
  assert.match(constructionBody, /relay\.stationOnline/);
});
check('construction reducer has only an opt-in stage adapter producer', () => {
  assert.match(constructionBody, /relayConstructionRuntimeEnabled\(\)/);
  assert.match(constructionBody, /relayConstructionRuntimeAdvance\(minutes\)/);
  assert.match(inline, /state\.worldMeta\?\.flags\?\.relayConstructionTransactionV1 === true/);
});
check('relay.projectAdvance keeps EventDef metadata and has one gated runtime child command', () => {
  const metadataMatches = relayDefinition.match(/commandType: 'relay\.projectAdvance'/g) || [];
  assert.equal(metadataMatches.length, 2, 'stage and online metadata choices are expected');
  assert.match(relayDefinition, /id: 'stage',[\s\S]*commandType: 'relay\.projectAdvance'/);
  assert.match(relayDefinition, /id: 'online',[\s\S]*commandType: 'relay\.projectAdvance'/);
  assert.equal((inline.match(/type: 'relay\.projectAdvance'/g) || []).length, 1, 'the stage adapter owns one child command literal');
});
check('handoff has a separate tokenized CommandBus producer', () => {
  assert.match(inline, /function relayHandoffToken\(\)/);
  assert.match(inline, /function handoffRelayCore\(options = \{\}\)/);
  assert.match(inline, /dispatchCommand\(\{ type: 'relay\.coreHandoff'/);
  assert.match(inline, /event-state-conflict/);
});
check('construction state carries a persisted transaction token ledger', () => {
  assert.match(inline, /function ensureRelayFacts\(\)/);
  assert.match(inline, /state\.relayProject = \{ \.\.\.defaults/);
  assert.match(inline, /function relayConstructionRuntimeToken\(/);
  assert.match(inline, /latestEventId/);
  assert.match(inline, /appliedCommandIds/);
});
check('construction path remains explicit about its migration boundary', () => {
  assert.match(inline, /function updateRelayProject\(minutes = 0\)/);
  assert.match(inline, /recordWorldEvent\('relay\.materialsGathered'/);
  assert.match(inline, /recordWorldEvent\('relay\.stationOnline'/);
});

const passed = checks.filter(item => item.ok).length;
const report = {
  runner: 'relay-construction-producer-trace',
  sourceHash,
  htmlPath,
  ok: passed === checks.length,
  count: checks.length,
  passed,
  checks,
  producer: {
    explicit: 'advance -> CommandBus(world.advance) -> advanceReducer -> updateRelayProject',
    automaticSource: 'startWorldSimulation daytime interval',
    constructionCommandProducer: true,
    constructionCommandProducerMode: 'feature-gated-stage-only',
    registryChoiceMetadataOnly: true,
    productionWiring: 'opt-in-stage-only',
    naturalGameplay: false
  },
  migrationRequired: true
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (!report.ok) process.exitCode = 1;
