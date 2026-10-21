import { observerDeepFreeze, stableHash as observerFactsHash } from './observer-expression-v1.mjs';

// Private trusted-capture projection. Its hash is consistency metadata, not world authorization.
// NPC_DIRECT_SIGHT_CORE_START
function npcDirectSightCoreKeys(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && Object.hasOwn(descriptor, 'value') && descriptor.enumerable;
  });
}
function npcDirectSightCoreArray(value, length) {
  if (!Array.isArray(value) || value.length !== length || Reflect.ownKeys(value).length !== length + 1) return false;
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) return false;
  }
  return true;
}
function npcDirectSightCoreFinite(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function npcDirectSightCoreId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
}
function npcDirectSightCoreRevision(value) {
  return npcDirectSightCoreKeys(value, ['sessionGeneration', 'worldMinute', 'eventSeq', 'stepIndex', 'phase'])
    && Number.isSafeInteger(value.sessionGeneration) && value.sessionGeneration >= 0
    && npcDirectSightCoreFinite(value.worldMinute, 0, Number.MAX_SAFE_INTEGER)
    && Number.isSafeInteger(value.eventSeq) && value.eventSeq >= 0
    && Number.isSafeInteger(value.stepIndex) && value.stepIndex >= 0 && value.phase === 'DAY';
}
function npcDirectSightCoreSight(value) {
  return npcDirectSightCoreKeys(value, ['subjectId', 'category', 'distanceBand'])
    && npcDirectSightCoreId(value.subjectId)
    && ['normal', 'runner', 'brute'].includes(value.category)
    && ['near', 'farther'].includes(value.distanceBand);
}
function npcDirectSightCoreBase(actorId, revision, sight) {
  return { schema: 'ActorObservationV1', version: 1, policyVersion: 'npc-view-direct-sight-v1',
    hashVersion: 'fnv1a-utf16-base36-v1', actor: { id: actorId }, audienceId: 'player-1',
    sourceRevision: { sessionGeneration: revision.sessionGeneration, worldMinute: revision.worldMinute,
      eventSeq: revision.eventSeq, stepIndex: revision.stepIndex, phase: revision.phase },
    knowledge: sight === null ? [] : [{ subjectId: sight.subjectId, status: 'observed',
      facts: { category: sight.category, distanceBand: sight.distanceBand },
      provenance: { kind: 'direct-sight', sourceId: actorId, at: revision.worldMinute } }],
    unknown: sight === null ? [{ reason: 'not-observable' }] : [] };
}
function projectNpcDirectSightObservationV1(capture) {
  if (!npcDirectSightCoreKeys(capture, ['schema', 'version', 'actorId', 'sourceRevision', 'sight', 'relationTrust'])
    || capture.schema !== 'NpcDirectSightCaptureV1' || capture.version !== 1
    || !npcDirectSightCoreId(capture.actorId) || !npcDirectSightCoreRevision(capture.sourceRevision)
    || !(capture.sight === null || npcDirectSightCoreSight(capture.sight))
    || !(capture.relationTrust === null || npcDirectSightCoreFinite(capture.relationTrust, -100, 100))) return null;
  const base = npcDirectSightCoreBase(capture.actorId, capture.sourceRevision, capture.sight);
  return observerDeepFreeze({ ...base, observationHash: observerFactsHash(base) });
}
function npcDirectSightCoreObservation(observation) {
  if (!npcDirectSightCoreKeys(observation, ['schema', 'version', 'policyVersion', 'hashVersion', 'actor', 'audienceId', 'sourceRevision', 'knowledge', 'unknown', 'observationHash'])
    || observation.schema !== 'ActorObservationV1' || observation.version !== 1
    || observation.policyVersion !== 'npc-view-direct-sight-v1' || observation.hashVersion !== 'fnv1a-utf16-base36-v1'
    || observation.audienceId !== 'player-1' || !npcDirectSightCoreKeys(observation.actor, ['id'])
    || !npcDirectSightCoreId(observation.actor.id) || !npcDirectSightCoreRevision(observation.sourceRevision)
    || typeof observation.observationHash !== 'string') return null;
  let sight = null;
  if (npcDirectSightCoreArray(observation.knowledge, 0)) {
    if (!npcDirectSightCoreArray(observation.unknown, 1)
      || !npcDirectSightCoreKeys(observation.unknown[0], ['reason'])
      || observation.unknown[0].reason !== 'not-observable') return null;
  } else {
    if (!npcDirectSightCoreArray(observation.knowledge, 1) || !npcDirectSightCoreArray(observation.unknown, 0)) return null;
    const knowledge = observation.knowledge[0];
    if (!npcDirectSightCoreKeys(knowledge, ['subjectId', 'status', 'facts', 'provenance'])
      || knowledge.status !== 'observed' || !npcDirectSightCoreId(knowledge.subjectId)
      || !npcDirectSightCoreKeys(knowledge.facts, ['category', 'distanceBand'])
      || !npcDirectSightCoreKeys(knowledge.provenance, ['kind', 'sourceId', 'at'])
      || knowledge.provenance.kind !== 'direct-sight' || knowledge.provenance.sourceId !== observation.actor.id
      || knowledge.provenance.at !== observation.sourceRevision.worldMinute) return null;
    sight = { subjectId: knowledge.subjectId, category: knowledge.facts.category, distanceBand: knowledge.facts.distanceBand };
    if (!npcDirectSightCoreSight(sight)) return null;
  }
  const base = npcDirectSightCoreBase(observation.actor.id, observation.sourceRevision, sight);
  return observation.observationHash === observerFactsHash(base) ? base : null;
}
function resolveNpcDirectSightReportV1(observation, relationTrust, enabled = false) {
  const verified = npcDirectSightCoreObservation(observation);
  const disclose = verified !== null && verified.knowledge.length === 1
    && npcDirectSightCoreFinite(relationTrust, -100, 100) && relationTrust >= -10;
  const disclosedFacts = disclose ? [{ category: verified.knowledge[0].facts.category,
    distanceBand: verified.knowledge[0].facts.distanceBand }] : [];
  let text = '这次查看没有得到可确认的视线报告。';
  if (disclose) {
    const npcDirectSightCoreCategoryText = { normal: '普通僵尸', runner: '快速感染者', brute: '装甲僵尸' };
    text = '我看见一只' + npcDirectSightCoreCategoryText[disclosedFacts[0].category]
      + (disclosedFacts[0].distanceBand === 'near' ? '，离我很近。' : '，离我还有一段距离。');
  }
  return observerDeepFreeze({ schema: 'NpcDirectSightReportV1', version: 1,
    authority: 'expression_only', mode: 'authored', observerEnabled: enabled === true,
    status: disclose ? 'observed' : 'unavailable', text, disclosedFacts,
    sourceProjectionHash: observerFactsHash(disclosedFacts) });
}
// NPC_DIRECT_SIGHT_CORE_END

export { projectNpcDirectSightObservationV1, resolveNpcDirectSightReportV1 };
