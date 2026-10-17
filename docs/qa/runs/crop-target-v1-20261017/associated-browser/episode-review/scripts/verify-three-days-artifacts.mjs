#!/usr/bin/env node
/**
 * Independently verify existing public-playtest artifacts. This program only
 * reads the report and its saved envelopes; it never opens a browser, calls a
 * game function, writes a save, or claims to rerun gameplay.
 *
 * node scripts/verify-three-days-artifacts.mjs --report REPORT.json \
 *   --allowed-root PRIVATE_DIR [--allowed-root OTHER_PRIVATE_DIR]
 * Optional --developer-negative-controls mutates a verified real plan pair
 * only in memory. Those validator controls are separate from gameplay evidence.
 * --strict-fresh --expect-html-sha256 SHA adds fresh-run requirements; default
 * verification preserves the original recovered-run evidence contract.
 */
import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

class ArtifactError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const need = (condition, code) => { if (!condition) throw new ArtifactError(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value);
const equal = (a, b, code) => need(isDeepStrictEqual(a, b), code);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);

export function checksum(payload) {
  let hash = 2166136261;
  const text = JSON.stringify(payload);
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function worldMinute(payload) {
  need(integer(payload.day) && payload.day >= 1 && integer(payload.hour) && payload.hour >= 0 && payload.hour < 24
    && integer(payload.minute) && payload.minute >= 0 && payload.minute < 60, 'INVALID_SAVE_CALENDAR');
  return (payload.day - 1) * 1440 + payload.hour * 60 + payload.minute;
}

function within(target, root) {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}

function permittedFile(value, roots) {
  need(typeof value === 'string' && value.length > 0, 'MISSING_ARTIFACT_PATH');
  const resolved = path.resolve(value);
  need(roots.some(root => within(resolved, root.resolved)), 'PATH_OUTSIDE_ALLOWED_ROOT');
  let real;
  try { real = realpathSync(resolved); } catch { throw new ArtifactError('ARTIFACT_FILE_UNAVAILABLE'); }
  need(roots.some(root => within(real, root.real)), 'SYMLINK_OUTSIDE_ALLOWED_ROOT');
  need(statSync(real).isFile(), 'ARTIFACT_NOT_REGULAR_FILE');
  return real;
}

function readJson(filename) {
  try { return JSON.parse(readFileSync(filename, 'utf8')); }
  catch (error) { throw new ArtifactError(error instanceof SyntaxError ? 'INVALID_ARTIFACT_JSON' : 'ARTIFACT_READ_FAILED'); }
}

function validateEnvelope(envelope, metadata) {
  need(object(envelope) && object(envelope.payload), 'MISSING_SAVE_ENVELOPE');
  const payload = envelope.payload;
  need(typeof envelope.checksum === 'string' && /^[a-f0-9]{1,8}$/.test(envelope.checksum), 'INVALID_CHECKSUM_FORMAT');
  equal(checksum(payload), envelope.checksum, 'SAVE_CHECKSUM_MISMATCH');
  need(payload.version === 21 && payload.contentState?.contentVersion === 3 && envelope.version === 21, 'SAVE_SCHEMA_MISMATCH');
  const minute = worldMinute(payload);
  equal(envelope.savedAt, minute, 'SAVED_AT_CALENDAR_MISMATCH');
  equal(payload.world?.totalMinutes, minute, 'WORLD_CALENDAR_MISMATCH');
  for (const key of ['day', 'hour', 'minute']) {
    equal(envelope[key], payload[key], 'ENVELOPE_CALENDAR_MISMATCH');
    equal(metadata[key], payload[key], 'METADATA_CALENDAR_MISMATCH');
  }
  equal(metadata.checksum, envelope.checksum, 'METADATA_CHECKSUM_MISMATCH');
  need(object(payload.worldMeta) && integer(payload.worldMeta.eventSeq) && payload.worldMeta.eventSeq >= 0, 'INVALID_EVENT_WATERMARK');
  equal(metadata.eventSeq, payload.worldMeta.eventSeq, 'METADATA_EVENT_WATERMARK_MISMATCH');
  const events = payload.worldMeta.events;
  need(Array.isArray(events) && Array.isArray(payload.worldMeta.replay?.commands), 'MISSING_EVENT_OR_COMMAND_LEDGER');
  const ids = new Set(); let previousSeq = -1;
  for (const event of events) {
    need(object(event) && typeof event.eventId === 'string' && /^evt-\d+$/.test(event.eventId) && !ids.has(event.eventId)
      && integer(event.seq) && event.seq > previousSeq && event.seq <= payload.worldMeta.eventSeq, 'INVALID_EVENT_LEDGER_ORDER');
    if (previousSeq >= 0) need(event.seq === previousSeq + 1, 'EVENT_LEDGER_INTERNAL_GAP');
    need(integer(event.tick?.world) && event.tick.world >= 0 && event.tick.world <= minute, 'EVENT_TICK_OUTSIDE_SAVE_CALENDAR');
    ids.add(event.eventId); previousSeq = event.seq;
  }
  if (events.length) equal(events.at(-1).seq, payload.worldMeta.eventSeq, 'EVENT_LEDGER_MISSING_LATEST_RECEIPT');
  const commandIds = new Set();
  for (const command of payload.worldMeta.replay.commands) {
    need(object(command) && typeof command.commandId === 'string' && !commandIds.has(command.commandId), 'INVALID_REPLAY_COMMAND_IDS');
    commandIds.add(command.commandId);
  }
  return { payload, minute, eventSeq: payload.worldMeta.eventSeq };
}

function newEvents(before, after, type) {
  need(after.worldMeta.eventSeq >= before.worldMeta.eventSeq, 'EVENT_WINDOW_REWOUND');
  if (after.worldMeta.eventSeq > before.worldMeta.eventSeq) need(after.worldMeta.events.length > 0
    && after.worldMeta.events[0].seq <= before.worldMeta.eventSeq + 1, 'INCOMPLETE_LEDGER_WINDOW');
  return after.worldMeta.events.filter(event => event.seq > before.worldMeta.eventSeq && (!type || event.type === type));
}

function commandFor(payload, event, type) {
  const commands = payload.worldMeta.replay.commands.filter(command => command.commandId === event.commandId);
  need(commands.length === 1 && commands[0].type === type && commands[0].actorId === 'player-1', 'RECEIPT_COMMAND_LINK_MISMATCH');
  return commands[0];
}

function roster(payload, expectedIds) {
  need(Array.isArray(payload.npcs), 'MISSING_NPC_ROSTER');
  const ids = payload.npcs.map(npc => npc?.id).sort();
  need(ids.length === 10 && ids.every(id => typeof id === 'string') && new Set(ids).size === 10, 'ROSTER_NOT_TEN_UNIQUE_IDS');
  equal(ids, expectedIds, 'INITIAL_ROSTER_IDS_NOT_PRESERVED');
  const active = payload.npcs.filter(npc => npc.lifeState !== 'dead').length;
  need(active >= 3 && Number.isFinite(payload.hp) && payload.hp > 0
    && Number.isFinite(payload.contentState?.meters?.campCollapse) && payload.contentState.meters.campCollapse < 90, 'CAMP_SURVIVAL_INVARIANT_FAILED');
  return { day: payload.day, activeNpcCount: active, campHp: payload.hp };
}

// A record merely saying resolvedDay=N cannot substitute for this full join.
export function verifyPlanBoundary(before, after, nextDay) {
  need(before.day === nextDay - 1 && after.day === nextDay && worldMinute(after) > worldMinute(before), 'WRONG_BOUNDARY_CALENDAR');
  const prior = before.contentState?.planMeeting, current = after.contentState?.planMeeting;
  need(object(prior) && object(current), 'MISSING_BOUNDARY_PLAN');
  need(['candidate', 'committed'].includes(prior.status) && prior.meetingDay === before.day
    && prior.instanceId === `camp-plan-meeting-001:d${before.day}`, 'PRIOR_NIGHT_PLAN_NOT_DUE');
  need(typeof prior.selectedId === 'string' && /^plan-[a-z0-9-]+$/.test(prior.selectedId)
    && Array.isArray(prior.candidates), 'INVALID_SELECTED_PLAN');
  const candidate = prior.candidates.find(item => item.id === prior.selectedId);
  need(candidate && Array.isArray(candidate.effects), 'SELECTED_PLAN_CANDIDATE_MISSING');
  const instanceId = prior.instanceId, selectedId = prior.selectedId;
  const effectId = `plan:${prior.meetingDay}:${selectedId}`, route = prior.playerAction || 'autonomy';
  need(current.status === 'resolved' && current.resolvedDay === nextDay && current.meetingDay === prior.meetingDay
    && current.instanceId === instanceId && current.selectedId === selectedId, 'AUTHORITATIVE_PLAN_LINEAGE_MISMATCH');
  equal(current.playerAction ?? null, prior.playerAction ?? null, 'PLAN_PLAYER_ROUTE_CHANGED');
  const relevant = newEvents(before, after).filter(event => ['plan.meeting.resolved', 'plan.meeting.fallback'].includes(event.type));
  need(relevant.length === 1 && relevant[0].type === 'plan.meeting.resolved', 'PLAN_NOT_RESOLVED_EXACTLY_ONCE');
  const event = relevant[0], detail = event.payload;
  need(detail?.instanceId === instanceId && detail.meetingDay === prior.meetingDay && detail.resolvedDay === nextDay
    && detail.selectedId === selectedId && detail.effectId === effectId && detail.route === route, 'RESOLVED_EVENT_PLAN_LINEAGE_MISMATCH');
  need(event.instanceId === instanceId && event.defId === 'camp-plan-meeting-001'
    && event.actorId === (prior.playerAction ? 'player-1' : 'camp-autonomy'), 'PLAN_EVENT_AUTHORITY_MISMATCH');
  need(Math.floor(event.tick.world / 1440) + 1 === nextDay, 'PLAN_EVENT_WRONG_CALENDAR_DAY');
  equal(event.effects, candidate.effects, 'PLAN_EVENT_EFFECTS_MISMATCH');
  equal(detail.candidates, prior.candidates, 'PLAN_EVENT_CANDIDATES_MISMATCH');
  const history = (current.history || []).filter(item => item.meetingDay === prior.meetingDay);
  need(history.length === 1 && history[0].resolvedDay === nextDay && history[0].selectedId === selectedId
    && history[0].effectId === effectId && history[0].action === route, 'PLAN_HISTORY_LINEAGE_MISMATCH');
  const autonomy = current.autonomyResult;
  need(autonomy?.route === route && autonomy.selectedId === selectedId && autonomy.effectId === effectId, 'PLAN_AUTONOMY_AUTHORITY_MISMATCH');
  equal(autonomy.results, detail.results, 'PLAN_RESULT_RECEIPT_MISMATCH');
  need(Array.isArray(after.contentState.appliedEffects)
    && after.contentState.appliedEffects.filter(id => id === effectId).length === 1
    && !(before.contentState.appliedEffects || []).includes(effectId), 'PLAN_EFFECT_IDEMPOTENCY_RECEIPT_MISMATCH');
  need(!(prior.history || []).some(item => item.meetingDay === prior.meetingDay), 'PRIOR_PLAN_ALREADY_SETTLED');
  const oldReceipts = before.worldMeta.events.filter(item => ['plan.meeting.resolved', 'plan.meeting.fallback'].includes(item.type)
    && item.payload?.instanceId === instanceId);
  need(oldReceipts.length === 0, 'PRIOR_PLAN_ALREADY_HAS_RESOLUTION');
  return { day: nextDay, instanceId, selectedId, eventId: event.eventId, eventSeq: event.seq };
}

export function selectBoundaryBefore(transition, after, records, day) {
  const hasReference = ['beforeSnapshotIndex', 'beforeSnapshotSource', 'beforeSnapshotProvenance', 'beforeEventSeq']
    .some(key => Object.hasOwn(transition, key));
  let before;
  if (hasReference) {
    need(integer(transition.beforeSnapshotIndex) && transition.beforeSnapshotIndex >= 0
      && transition.beforeSnapshotSource === 'verified-runner-snapshot', 'INVALID_EXPLICIT_BEFORE_REFERENCE');
    before = records.find(record => record.index === transition.beforeSnapshotIndex);
    need(before && before.index < after.index, 'REFERENCED_BEFORE_ARTIFACT_MISSING_OR_NOT_PRIOR');
    const provenance = transition.beforeSnapshotProvenance;
    need(object(provenance) && ['stage', 'path', 'checksum', 'htmlSha256', 'selectionReason'].every(key => Object.hasOwn(provenance, key))
      && typeof provenance.selectionReason === 'string' && provenance.selectionReason.trim().length > 0,
      'BEFORE_REFERENCE_PROVENANCE_MISSING');
    equal(provenance.stage, before.metadata.stage, 'BEFORE_REFERENCE_STAGE_MISMATCH');
    equal(provenance.path, before.metadata.path, 'BEFORE_REFERENCE_PATH_MISMATCH');
    equal(provenance.checksum, before.metadata.checksum, 'BEFORE_REFERENCE_CHECKSUM_MISMATCH');
    equal(provenance.htmlSha256 ?? null, before.metadata.htmlSha256 ?? null, 'BEFORE_REFERENCE_SOURCE_SHA_MISMATCH');
    equal(transition.beforeEventSeq, before.eventSeq, 'BEFORE_REFERENCE_EVENT_WATERMARK_MISMATCH');
  } else {
    before = records.filter(record => record.stage === `calendar-day-${day}-pending` && record.index < after.index
      && record.minute === transition.beforeMinute && record.payload.day === day - 1).at(-1);
    need(before, 'BOUNDARY_BEFORE_PENDING_ARTIFACT_MISSING');
  }
  need(before.payload.day === day - 1 && transition.fromDay === before.payload.day, 'REFERENCED_BEFORE_WRONG_CALENDAR_DAY');
  equal(transition.beforeMinute, before.minute, 'BEFORE_REFERENCE_CALENDAR_MISMATCH');
  equal(transition.foodBefore, before.payload.food, 'BOUNDARY_REPORT_BEFORE_FOOD_MISMATCH');
  return { before, explicitlyReferenced: hasReference };
}

function verifyBoundaryFood(before, after, transition, detail, explicitlyReferenced) {
  const events = newEvents(before, after);
  const unsupported = events.some(event => event.type === 'crop.changed' || event.type === 'event.resolved'
    || event.type === 'player.ate' || event.type === 'npc.event.resolved'
    || event.type === 'camp.area.interacted' && event.payload?.zone === 'residence'
    || event.type === 'resource.collected' && Number(event.payload?.delta?.food || 0) !== 0
    || event.type === 'outpost.upkeep' && Number(event.payload?.paid || 0) > 0);
  need(!unsupported, 'BOUNDARY_WINDOW_HAS_UNACCOUNTED_FOOD_ACTION');
  const plan = events.find(event => event.eventId === detail.eventId);
  need(plan && Number.isFinite(before.food) && before.food >= 0 && Number.isFinite(after.food) && after.food >= 0
    && Number.isFinite(plan.payload.before?.food) && Number.isFinite(plan.payload.after?.food), 'BOUNDARY_FOOD_RECEIPT_INVALID');
  const population = Math.max(1, before.npcs.filter(npc => npc.lifeState !== 'dead').length);
  const ration = Math.max(2, Math.ceil(population * 0.28));
  equal(transition.ration, ration, 'BOUNDARY_REPORT_RATION_MISMATCH');
  need(before.world.lastRationDay === before.day && before.world.lastDailyUpkeepDay === before.day, 'BOUNDARY_PRIOR_DAILY_MARKERS_MISMATCH');
  let npcFoodBeforeRation = 0, npcFoodAfterPlan = 0;
  for (const event of events.filter(item => item.type === 'npc.need.fulfilled' && item.payload?.need === 'hunger')) {
    need(integer(event.payload.food) && event.payload.food >= 0, 'BOUNDARY_NPC_FOOD_RECEIPT_INVALID');
    if (event.seq < plan.seq) npcFoodBeforeRation += event.payload.food;
    else npcFoodAfterPlan += event.payload.food;
  }
  const foodBeforeRation = before.food - npcFoodBeforeRation;
  need(foodBeforeRation >= 0, 'BOUNDARY_PRE_RATION_FOOD_NEGATIVE');
  equal(plan.payload.before.food, Math.max(0, foodBeforeRation - ration), 'BOUNDARY_PRE_PLAN_RATION_ACCOUNTING_MISMATCH');
  const planFoodDelta = plan.payload.after.food - plan.payload.before.food;
  equal(after.food, plan.payload.after.food - npcFoodAfterPlan, 'BOUNDARY_POST_PLAN_FOOD_ACCOUNTING_MISMATCH');
  const accounting = { npcFoodBeforeRation, npcFoodAfterPlan, foodBeforeRation, planFoodDelta };
  for (const [key, value] of Object.entries(accounting)) if (explicitlyReferenced || Object.hasOwn(transition, key)) {
    equal(transition[key], value, 'BOUNDARY_REPORT_FOOD_ACCOUNTING_MISMATCH');
  }
  return { ration, ...accounting, rationDeductionSaturated: foodBeforeRation <= ration };
}

function verifyNight(before, summary, closed, day) {
  const battle = summary.nightBattle;
  need(before.day === day && summary.day === day && closed.day === day && summary.night === true
    && battle?.resolved === true && closed.night === false && closed.nightBattle === null, 'NIGHT_SAVE_STATE_MISMATCH');
  const threatId = battle.instanceId;
  need(typeof threatId === 'string' && /^threat-\d+-\d+-\d+-\d+$/.test(threatId), 'INVALID_NIGHT_INSTANCE_ID');
  const resolved = newEvents(before, summary, 'threat.resolved').filter(event => event.payload?.threatId === threatId);
  need(resolved.length === 1, 'NIGHT_RESOLVED_RECEIPT_MISSING_OR_DUPLICATE');
  const started = newEvents(before, summary, 'threat.started').filter(event => {
    const tick = event.tick.world;
    return event.payload?.day === day && event.seq < resolved[0].seq
      && `threat-${day}-${Math.floor(tick % 1440 / 60)}-${tick % 60}-${event.seq}` === threatId;
  });
  need(started.length === 1, 'NIGHT_STARTED_INSTANCE_MISMATCH');
  commandFor(summary, started[0], 'threat.start');
  const closeEvents = newEvents(summary, closed, 'threat.closed').filter(event => {
    const command = closed.worldMeta.replay.commands.find(item => item.commandId === event.commandId);
    return command?.type === 'threat.close' && command.payload?.threatId === threatId
      && (event.payload?.threatId === threatId || object(event.payload) && Object.keys(event.payload).length === 0);
  });
  need(closeEvents.length === 1, 'NIGHT_CLOSE_INSTANCE_MISSING_OR_DUPLICATE');
  commandFor(closed, closeEvents[0], 'threat.close');
  need(closeEvents[0].tick.world === worldMinute(summary), 'REPORT_CLOSE_CHANGED_CALENDAR');
  if (Object.keys(closeEvents[0].payload).length) for (const key of ['day', 'hour', 'minute']) {
    equal(closeEvents[0].payload[key], summary[key], 'CLOSED_RECEIPT_CALENDAR_MISMATCH');
  }
  const plan = summary.contentState.planMeeting;
  need(plan?.instanceId === `camp-plan-meeting-001:d${day}` && plan.meetingDay === day
    && ['candidate', 'committed'].includes(plan.status), 'SUMMARY_PLAN_NOT_FROM_THIS_NIGHT');
  return { day, threatId, legacyEmptyClosePayload: Object.keys(closeEvents[0].payload).length === 0 };
}

function verifyHarvest(before, after) {
  need(before.day === 3 && after.day === 3 && worldMinute(after) >= worldMinute(before) + 20, 'HARVEST_CALENDAR_MISMATCH');
  const plot = payload => payload.buildings.filter(item => item.type === 'garden' && item.x === 7 && item.y === 14);
  const prior = plot(before), current = plot(after);
  need(prior.length === 1 && current.length === 1 && prior[0].id === current[0].id
    && prior[0].ready === true && prior[0].planted === true && current[0].ready === false
    && current[0].planted === false && current[0].growth === 0, 'HARVEST_PLOT_STATE_MISMATCH');
  const events = newEvents(before, after, 'crop.changed');
  need(events.length === 1, 'HARVEST_RECEIPT_MISSING_OR_DUPLICATE');
  const command = commandFor(after, events[0], 'crop.change');
  need(command.payload?.buildingId == null || command.payload.buildingId === prior[0].id, 'HARVEST_COMMAND_WRONG_PLOT');
  const advance = newEvents(before, after, 'time.advanced').filter(event => event.causationId === command.commandId && event.payload?.minutes === 20);
  need(advance.length === 1, 'HARVEST_PUBLIC_TIME_RECEIPT_MISSING');
  const eaten = newEvents(before, after, 'npc.need.fulfilled').filter(event => event.payload?.need === 'hunger')
    .reduce((sum, event) => sum + Number(event.payload.food || 0), 0);
  need(Number.isFinite(before.food) && after.food === before.food + 3 - eaten, 'HARVEST_ACTUAL_FOOD_REWARD_MISMATCH');
  return { day: 3, actualFoodReward: 3, npcFoodConsumed: eaten, eventId: events[0].eventId };
}

export function verifyStrictFreshSource(report, records, expectedSha) {
  need(sha(expectedSha), 'STRICT_EXPECTED_SOURCE_SHA_REQUIRED');
  const expected = expectedSha.toLowerCase();
  need(report.strictFresh?.version === 1 && report.strictFresh.enabled === true
    && report.strictFresh.initialProfileEmpty === true
    && report.strictFresh.expectedHtmlSha256 === expected, 'STRICT_FRESH_RUNNER_CONTRACT_MISSING');
  equal(report.strictFresh.requiredReloadDays, [1, 2, 3], 'STRICT_FRESH_RELOAD_POLICY_MISMATCH');
  need(report.strictFresh.minimumFinalHour === 6
    && (report.resumeSessions === undefined || Array.isArray(report.resumeSessions) && report.resumeSessions.length === 0),
  'STRICT_FRESH_RESUME_OR_DAWN_POLICY_MISMATCH');
  need(report.htmlSha256 === expected && Array.isArray(report.buildSessions) && report.buildSessions.length > 0
    && Array.isArray(report.documentResponses) && report.documentResponses.length === report.buildSessions.length,
  'STRICT_FRESH_DOCUMENT_EVIDENCE_MISSING');
  let gameUrl;
  try { gameUrl = new URL(report.url); } catch { throw new ArtifactError('STRICT_FRESH_ORIGIN_INVALID'); }
  need(['http:', 'https:'].includes(gameUrl.protocol) && !gameUrl.search, 'STRICT_FRESH_ORIGIN_INVALID');
  const required = ['initial document', 'fresh public reset document', 'day-1-reload reload',
    'calendar-day-2-reload reload', 'calendar-day-3-reload reload', 'calendar-day-4-reload reload', 'final-day-four-reload reload'];
  for (const stage of required) need(report.buildSessions.filter(build => build.stage === stage).length === 1, 'STRICT_FRESH_REQUIRED_DOCUMENT_MISSING');
  for (const [index, document] of report.documentResponses.entries()) {
    const build = report.buildSessions[index];
    need(object(document) && object(build) && document.index === index && build.documentIndex === index
      && document.status === 200 && build.status === 200 && document.htmlSha256 === expected
      && build.htmlSha256 === expected && document.stage === build.stage && build.mode === 'fresh', 'STRICT_FRESH_DOCUMENT_UNKNOWN_OR_CHANGED');
    try { need(new URL(document.url).href === gameUrl.href, 'STRICT_FRESH_DOCUMENT_ORIGIN_CHANGED'); }
    catch (error) { if (error instanceof ArtifactError) throw error; throw new ArtifactError('STRICT_FRESH_DOCUMENT_ORIGIN_CHANGED'); }
  }
  need(Array.isArray(report.snapshots) && report.snapshots.length > 0 && records.length === report.snapshots.length
    && records.every(record => record.metadata.htmlSha256 === expected), 'STRICT_FRESH_SNAPSHOT_SOURCE_UNKNOWN_OR_CHANGED');
  return { expectedHtmlSha256: expected, verifiedDocuments: report.documentResponses.length, verifiedSnapshots: records.length, resumeSessions: 0 };
}

export function verifyStrictFreshReload(before, after, day) {
  need(before.day === day && after.day === day && worldMinute(after) > worldMinute(before), 'STRICT_FRESH_RELOAD_WRONG_DAY_OR_STALE_SAVE');
  const events = newEvents(before, after);
  const advances = events.filter(event => event.type === 'time.advanced');
  need(advances.length > 0 && !events.some(event => ['plan.meeting.resolved', 'plan.meeting.fallback', 'camp.area.interacted',
    'crop.changed', 'resource.collected', 'event.resolved', 'npc.event.resolved', 'player.ate'].includes(event.type)
    || event.type.startsWith('threat.')), 'STRICT_FRESH_RELOAD_HAS_ACTION_OR_SETTLEMENT');
  let minutes = 0;
  for (const event of advances) {
    const command = commandFor(after, event, 'world.advance');
    need(Number.isFinite(event.payload?.minutes) && event.payload.minutes >= 1 && event.payload.minutes <= 5
      && event.causationId === null && command.payload?.minutes === event.payload.minutes
      && event.payload.day === day && worldMinute(event.payload) === event.tick.world, 'STRICT_FRESH_RELOAD_NOT_NATURAL_TICK');
    minutes += event.payload.minutes;
  }
  need(worldMinute(after) - worldMinute(before) === minutes, 'STRICT_FRESH_RELOAD_CLOCK_TRACE_MISMATCH');
  for (const key of ['commandPoints', 'commandPointsMax', 'commandPointsGrantedDay']) {
    equal(after.contentState[key], before.contentState[key], 'STRICT_FRESH_RELOAD_CP_CHANGED');
  }
  equal(after.contentState.planMeeting, before.contentState.planMeeting, 'STRICT_FRESH_RELOAD_PLAN_CHANGED');
  for (const key of ['lastRationDay', 'lastDailyUpkeepDay']) equal(after.world[key], before.world[key], 'STRICT_FRESH_RELOAD_DAILY_MARKER_CHANGED');
  const consumption = events.filter(event => event.type === 'npc.need.fulfilled' && event.payload?.need === 'hunger');
  need(consumption.every(event => Number.isFinite(event.payload.food) && event.payload.food >= 0), 'STRICT_FRESH_RELOAD_INVALID_MEAL');
  const consumed = consumption.reduce((sum, event) => sum + event.payload.food, 0);
  equal(after.food, before.food - consumed, 'STRICT_FRESH_RELOAD_FOOD_OR_RATION_CHANGED');
  return { day, naturalMinutes: minutes, timeEventIds: advances.map(event => event.eventId), legitimateNpcFood: consumed };
}

export function verifyStrictFreshFinal(final) {
  need(final?.day === 4 && worldMinute(final) >= 3 * 1440 + 6 * 60, 'STRICT_FRESH_FINAL_BEFORE_DAY_FOUR_DAWN');
  return { day: final.day, hour: final.hour, minute: final.minute };
}

function parseArgs(argv) {
  const args = { roots: [], negativeControls: false, strictFresh: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--help') return { help: true };
    if (argv[i] === '--developer-negative-controls') { args.negativeControls = true; continue; }
    if (argv[i] === '--strict-fresh') { need(!args.strictFresh, 'DUPLICATE_STRICT_FRESH_ARGUMENT'); args.strictFresh = true; continue; }
    need(['--report', '--allowed-root', '--expect-html-sha256'].includes(argv[i]) && typeof argv[i + 1] === 'string' && !argv[i + 1].startsWith('--'), 'INVALID_CLI_ARGUMENTS');
    if (argv[i] === '--report') { need(!args.report, 'DUPLICATE_REPORT_ARGUMENT'); args.report = argv[++i]; }
    else if (argv[i] === '--expect-html-sha256') { need(!args.expectedHtmlSha256, 'DUPLICATE_EXPECTED_SHA_ARGUMENT'); args.expectedHtmlSha256 = argv[++i].toLowerCase(); }
    else args.roots.push(argv[++i]);
  }
  need(args.report && args.roots.length > 0, 'REPORT_AND_ALLOWED_ROOT_REQUIRED');
  need(args.strictFresh ? sha(args.expectedHtmlSha256) : !args.expectedHtmlSha256, 'STRICT_EXPECTED_SHA_ARGUMENT_MISMATCH');
  return args;
}

export function verifyReport(args) {
  const output = { verifier: 'verify-three-days-artifacts', evidence: 'read-only-existing-runner-artifacts', reranGame: false,
    ok: false, artifactChecks: [], developerChecks: [], coverage: { verifiedSnapshots: 0, planDays: [], nightDays: [], sourceHashes: [] } };
  const check = (name, operation, target = output.artifactChecks) => {
    try { const detail = operation(); target.push({ name, ok: true, ...(detail === undefined ? {} : { detail }) }); return detail; }
    catch (error) { target.push({ name, ok: false, reason: error instanceof ArtifactError ? error.code : 'INVALID_ARTIFACT_DATA' }); return undefined; }
  };
  let roots, report;
  check('allowed-files-and-report-json', () => {
    roots = args.roots.map(value => {
      const resolved = path.resolve(value), real = realpathSync(resolved);
      need(statSync(real).isDirectory(), 'ALLOWED_ROOT_NOT_DIRECTORY'); return { resolved, real };
    });
    report = readJson(permittedFile(args.report, roots));
    need(object(report) && Array.isArray(report.snapshots), 'MISSING_RUNNER_SNAPSHOTS');
    return { allowedRootCount: roots.length, declaredSnapshots: report.snapshots.length };
  });
  if (!report || !roots || !Array.isArray(report.snapshots)) return output;
  check('recognized-public-runner-mode', () => {
    need(report.runner === 'server-three-days' && report.mode === 'public-action-calendar-progression'
      || report.runner === 'smoke-three-days' && report.mode === 'python-playwright-public-action-calendar-progression', 'UNRECOGNIZED_RUNNER_MODE');
    output.reportMode = report.mode;
    need(report.policy?.saveInjection === false && report.policy.hiddenStateMutation === false
      && report.policy.internalFunctionCalls === false && report.policy.primarySaveReadOnly === true, 'RUNNER_PUBLIC_ACTION_POLICY_MISMATCH');
  });
  check('original-runner-completed-successfully', () => {
    need(report.ok === true && Array.isArray(report.errors) && report.errors.length === 0
      && Array.isArray(report.checks) && report.checks.length > 0 && report.checks.every(item => item.ok === true), 'RUNNER_NOT_COMPLETE_OR_FAILED');
    need(Array.isArray(report.completedStages) && report.completedStages.includes('complete'), 'RUNNER_COMPLETE_STAGE_MISSING');
    need(!Object.keys(report).some(key => key.startsWith('pending') && report[key] != null), 'UNRECONCILED_RUNNER_ACTION');
  });
  const records = [];
  const sources = new Set(); let unknownSources = 0;
  for (const [index, metadata] of report.snapshots.entries()) {
    check(`snapshot-${index}-filename-envelope-calendar-ledger`, () => {
      need(object(metadata) && typeof metadata.stage === 'string' && path.isAbsolute(metadata.path || ''), 'INVALID_SNAPSHOT_METADATA');
      const safeStage = metadata.stage.replace(/[^a-zA-Z0-9_-]/g, '-');
      equal(path.basename(metadata.path), `${String(index).padStart(2, '0')}-${safeStage}-save.json`, 'SNAPSHOT_FILENAME_STAGE_MISMATCH');
      const envelope = readJson(permittedFile(metadata.path, roots));
      const verified = validateEnvelope(envelope, metadata);
      need(verified.payload.day >= 1 && verified.payload.day <= 4, 'SNAPSHOT_OUTSIDE_THREE_DAY_RUN');
      if (metadata.htmlSha256 != null) { need(sha(metadata.htmlSha256), 'INVALID_SNAPSHOT_SOURCE_SHA'); sources.add(metadata.htmlSha256.toLowerCase()); }
      else unknownSources++;
      records.push({ index, stage: metadata.stage, metadata, envelope, ...verified });
      output.coverage.verifiedSnapshots++;
      return { day: verified.payload.day, minute: verified.minute, eventSeq: verified.eventSeq };
    });
  }
  output.coverage.sourceHashes = [...sources].sort();
  output.coverage.unknownSourceSnapshots = unknownSources;
  output.coverage.singleKnownBuild = sources.size === 1 && unknownSources === 0;
  if (args.strictFresh) check('strict-fresh-every-document-and-snapshot-is-the-pinned-build', () => {
    const detail = verifyStrictFreshSource(report, records, args.expectedHtmlSha256);
    need(output.coverage.singleKnownBuild && output.coverage.sourceHashes[0] === args.expectedHtmlSha256.toLowerCase(), 'STRICT_FRESH_NOT_SINGLE_KNOWN_BUILD');
    output.coverage.strictFreshSingleBuild = true;
    return detail;
  });
  check('snapshot-calendar-and-watermarks-never-rewind', () => {
    need(records.length === report.snapshots.length && records.length > 0, 'SNAPSHOT_EVIDENCE_INCOMPLETE');
    for (let i = 1; i < records.length; i++) need(records[i].minute >= records[i - 1].minute
      && records[i].eventSeq >= records[i - 1].eventSeq, 'SNAPSHOT_PROGRESS_REWOUND');
  });
  const expectedIds = Array.isArray(report.rosterIds) ? [...report.rosterIds].sort() : [];
  check('initial-roster-and-all-saved-population-survival', () => {
    need(expectedIds.length === 10 && new Set(expectedIds).size === 10, 'MISSING_INITIAL_ROSTER_BASELINE');
    need(records.some(record => record.payload.day === 1), 'DAY_ONE_BASELINE_ARTIFACT_MISSING');
    for (const record of records) roster(record.payload, expectedIds);
    return { rosterSize: 10, snapshotsChecked: records.length };
  });
  const byStage = stage => records.filter(record => record.stage === stage);
  // Recovery can save an already-resolved report as started-or-resumed before
  // its public close, without adding a new day-N-summary stage. Both are real
  // persist() filenames; a calendar-only or arbitrary snapshot is insufficient.
  const summariesFor = day => records.filter(record => [ `day-${day}-summary`, 'started-or-resumed' ].includes(record.stage)
    && record.payload.day === day && record.payload.night === true && record.payload.nightBattle?.resolved === true);
  const boundaryPairs = [];
  for (const day of [2, 3, 4]) {
    check(`calendar-day-${day}-exact-plan-authority-history-and-receipt`, () => {
      const transitions = (report.calendarTransitions || []).filter(item => item.toDay === day);
      need(transitions.length === 1 && transitions[0].fromDay === day - 1, 'BOUNDARY_REPORT_MISSING_OR_DUPLICATE');
      const transition = transitions[0];
      const afters = records.filter(record => [`calendar-day-${day}`, `calendar-day-${day}-resumed`].includes(record.stage)
        && record.minute === transition.afterMinute && record.payload.day === day);
      need(afters.length > 0, 'BOUNDARY_AFTER_ARTIFACT_MISSING');
      const after = afters.at(-1);
      const { before, explicitlyReferenced } = selectBoundaryBefore(transition, after, records, day);
      const detail = verifyPlanBoundary(before.payload, after.payload, day);
      const summaries = summariesFor(day - 1).filter(record => record.index < before.index);
      need(summaries.length > 0, 'PRIOR_NIGHT_SUMMARY_ARTIFACT_MISSING');
      const summaryPlan = summaries.at(-1).payload.contentState.planMeeting;
      const priorPlan = before.payload.contentState.planMeeting;
      need(summaryPlan?.instanceId === priorPlan.instanceId && summaryPlan.meetingDay === priorPlan.meetingDay
        && summaryPlan.selectedId === priorPlan.selectedId, 'SUMMARY_TO_BOUNDARY_PLAN_MISMATCH');
      equal(transition.planEventIds, [detail.eventId], 'BOUNDARY_REPORT_PLAN_RECEIPT_MISMATCH');
      equal(transition.foodAfter, after.payload.food, 'BOUNDARY_REPORT_AFTER_FOOD_MISMATCH');
      const foodAccounting = verifyBoundaryFood(before.payload, after.payload, transition, detail, explicitlyReferenced);
      need(after.payload.world.lastRationDay === day && after.payload.world.lastDailyUpkeepDay === day
        && after.payload.contentState.commandPointsGrantedDay === day, 'BOUNDARY_DAILY_MARKERS_MISMATCH');
      equal(transition.upkeepDay, after.payload.world.lastDailyUpkeepDay, 'BOUNDARY_REPORT_UPKEEP_DAY_MISMATCH');
      equal(transition.commandPointsGrantedDay, after.payload.contentState.commandPointsGrantedDay, 'BOUNDARY_REPORT_CP_DAY_MISMATCH');
      boundaryPairs.push({ before: before.payload, after: after.payload, day });
      output.coverage.planDays.push(day);
      return { ...detail, beforeSnapshotIndex: before.index, explicitBeforeReference: explicitlyReferenced, foodAccounting };
    });
  }
  for (const day of [1, 2, 3]) {
    check(`day-${day}-specific-night-trace-and-summary`, () => {
      const summary = summariesFor(day).at(-1);
      need(summary, 'NIGHT_SUMMARY_ARTIFACT_MISSING');
      const before = byStage(`day-${day}-before-encounter`).filter(record => record.index < summary.index).at(-1);
      const closed = records.find(record => record.index > summary.index
        && [`day-${day}-night-complete`, `day-${day}-night-resumed-complete`].includes(record.stage));
      need(before && closed, 'NIGHT_BEFORE_OR_CLOSED_ARTIFACT_MISSING');
      const detail = verifyNight(before.payload, summary.payload, closed.payload, day);
      output.coverage.nightDays.push(day); return detail;
    });
  }
  check('mandatory-real-harvest-before-after-crop-replay-and-food', () => {
    need((report.completedStages || []).includes('harvest') && (report.actions || []).some(action => action.type === 'harvest'), 'MANDATORY_HARVEST_NOT_COMPLETED');
    const after = byStage('harvest').at(-1);
    const before = after && byStage('harvest-pending').filter(record => record.index < after.index).at(-1);
    need(before && after, 'HARVEST_BEFORE_AFTER_ARTIFACT_MISSING');
    return verifyHarvest(before.payload, after.payload);
  });
  check('three-days-and-final-day-four-save-are-complete', () => {
    equal(report.nightDays?.slice().sort(), [1, 2, 3], 'THREE_NIGHTS_NOT_COMPLETE');
    equal(report.calendarTransitions?.map(item => item.toDay), [2, 3, 4], 'THREE_BOUNDARIES_NOT_COMPLETE');
    const final = byStage('complete').at(-1);
    need(final && final.payload.day === 4, 'FINAL_DAY_FOUR_ARTIFACT_MISSING');
    roster(final.payload, expectedIds);
    for (const key of ['day', 'hour', 'minute', 'food']) equal(report.state?.[key], final.payload[key], 'FINAL_REPORT_STATE_MISMATCH');
    equal(report.state?.checksum, final.envelope.checksum, 'FINAL_REPORT_CHECKSUM_MISMATCH');
    equal(report.state?.npcCount, final.payload.npcs.length, 'FINAL_REPORT_POPULATION_MISMATCH');
    return { day: final.payload.day, hour: final.payload.hour, minute: final.payload.minute };
  });
  if (args.strictFresh) {
    output.coverage.strictFreshReloadDays = [];
    for (const [day, stage] of [[1, 'day-1-reload'], [2, 'calendar-day-2-reload'], [3, 'calendar-day-3-reload']]) {
      check(`strict-fresh-calendar-day-${day}-explicit-reload-with-new-natural-save`, () => {
        need(report.completedStages?.includes(stage), 'STRICT_FRESH_REQUIRED_RELOAD_STAGE_MISSING');
        const afters = byStage(stage), befores = byStage(stage + '-before-refresh');
        need(afters.length === 1 && befores.length === 1 && befores[0].index < afters[0].index, 'STRICT_FRESH_RELOAD_PAIR_MISSING_OR_DUPLICATE');
        const detail = verifyStrictFreshReload(befores[0].payload, afters[0].payload, day);
        output.coverage.strictFreshReloadDays.push(day);
        return detail;
      });
    }
    check('strict-fresh-final-original-save-reaches-day-four-dawn', () => verifyStrictFreshFinal(byStage('complete').at(-1)?.payload));
  }
  check('overlapping-snapshot-receipts-agree', () => {
    const merged = new Map();
    for (const record of records) for (const event of record.payload.worldMeta.events) {
      if (merged.has(event.eventId)) equal(merged.get(event.eventId), event, 'OVERLAPPING_RECEIPTS_CONFLICT');
      else merged.set(event.eventId, event);
    }
    const events = [...merged.values()].sort((a, b) => a.seq - b.seq);
    const count = predicate => events.filter(predicate).length;
    const actions = Array.isArray(report.actions) ? report.actions : [];
    const reportedTraining = actions.filter(action => action.type === 'barracks-training').length;
    const barracks = count(event => event.type === 'camp.area.interacted' && event.payload?.zone === 'barracks' && event.payload.minutes === 30);
    const navigation = actions.filter(action => action.type === 'navigation-threat-attack').length;
    let gaps = 0;
    for (let i = 1; i < events.length; i++) if (events[i].seq !== events[i - 1].seq + 1) gaps++;
    output.coverage.observedReceipts = {
      scope: 'unique-receipts-visible-in-verified-snapshots-not-global-replay-totals',
      uniqueEventCount: events.length, observedSequenceGaps: gaps,
      barracksThirtyMinute: barracks,
      daytimeThreatAttacked: count(event => event.type === 'threat.attacked'),
      resourceCollected: count(event => event.type === 'resource.collected'),
      positiveResourceCollected: count(event => event.type === 'resource.collected'
        && Object.values(event.payload?.delta || {}).some(value => Number(value) > 0)),
      cropChanged: count(event => event.type === 'crop.changed'),
      reportedBarracksActions: reportedTraining, reportedNavigationAttackActions: navigation,
      declaredTrainingActions: integer(report.trainingActions) ? report.trainingActions : null,
      barracksReceiptMinusReportedActions: barracks - reportedTraining,
      trainingCountsAgree: barracks === reportedTraining && report.trainingActions === reportedTraining,
      mayOmitUnsavedOrTruncatedIntervals: true,
    };
    // A count difference is an observation, not permission to create actions
    // or rewrite the game's state/evidence to make the totals agree.
    return { uniqueReceipts: events.length };
  });
  if (args.negativeControls) {
    const pair = boundaryPairs[0];
    for (const key of ['instanceId', 'meetingDay']) check(`developer-synthetic-wrong-${key}-is-rejected`, () => {
      need(pair, 'DEVELOPER_CONTROL_NEEDS_VERIFIED_REAL_BOUNDARY');
      const mutated = structuredClone(pair.after);
      mutated.contentState.planMeeting[key] = key === 'instanceId' ? 'developer-negative-control' : pair.day + 99;
      let rejected = false;
      try { verifyPlanBoundary(pair.before, mutated, pair.day); } catch (error) { rejected = error instanceof ArtifactError; }
      need(rejected, 'DEVELOPER_NEGATIVE_CONTROL_FALSE_PASS');
      return { evidence: 'in-memory-mutated-real-artifact-validator-control', reranGame: false };
    }, output.developerChecks);
  }
  output.ok = output.artifactChecks.length > 0 && output.artifactChecks.every(item => item.ok)
    && output.developerChecks.every(item => item.ok);
  return output;
}

function main() {
  let output;
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log('Usage: node verify-three-days-artifacts.mjs --report REPORT.json --allowed-root DIR [--allowed-root DIR] [--developer-negative-controls] [--strict-fresh --expect-html-sha256 SHA]');
      return;
    }
    output = verifyReport(args);
  } catch (error) {
    output = { verifier: 'verify-three-days-artifacts', evidence: 'read-only-existing-runner-artifacts', reranGame: false, ok: false,
      artifactChecks: [{ name: 'arguments-or-report', ok: false, reason: error instanceof ArtifactError ? error.code : 'INVALID_ARTIFACT_DATA' }], developerChecks: [] };
  }
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = output.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
