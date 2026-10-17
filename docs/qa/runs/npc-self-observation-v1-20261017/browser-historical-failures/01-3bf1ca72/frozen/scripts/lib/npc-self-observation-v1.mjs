import { observerDeepFreeze, stableHash as observerFactsHash } from './observer-expression-v1.mjs';

// Private trusted-capture projection, not a model tool or world authenticator.
// NPC_SELF_CORE_START
function npcSelfKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function npcSelfFinite(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function npcSelfNeedBand(value, kind) {
  if (!npcSelfFinite(value, 0, 100)) return 'unknown';
  return kind === 'energy' ? value <= 25 ? 'low' : 'normal' : value >= 70 ? 'urgent' : 'normal';
}
function npcSelfLifeState(self) {
  // Same thresholds as the actual syncNpcLifeState, without normalizing state.
  return self.hp < 30 ? 'critical' : self.hp < self.maxHp ? 'injured' : 'healthy';
}
function projectNpcSelfObservationV1(capture) {
  const c = capture, r = c?.sourceRevision, s = c?.self;
  const valid = npcSelfKeys(c, ['schema', 'version', 'actorId', 'sourceRevision', 'self', 'relationTrust'])
    && c.schema === 'NpcSelfCaptureV1' && c.version === 1
    && typeof c.actorId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(c.actorId)
    && npcSelfKeys(r, ['sessionGeneration', 'worldMinute', 'eventSeq', 'stepIndex', 'phase']) && r.phase === 'DAY'
    && Number.isSafeInteger(r.sessionGeneration) && r.sessionGeneration >= 0
    && npcSelfFinite(r.worldMinute, 0, Number.MAX_SAFE_INTEGER)
    && Number.isSafeInteger(r.eventSeq) && r.eventSeq >= 0 && Number.isSafeInteger(r.stepIndex) && r.stepIndex >= 0
    && npcSelfKeys(s, ['lifeState', 'hp', 'maxHp', 'needs']) && ['healthy', 'injured', 'critical'].includes(s.lifeState)
    && npcSelfFinite(s.hp, Number.MIN_VALUE, Number.MAX_VALUE) && npcSelfFinite(s.maxHp, Number.MIN_VALUE, Number.MAX_VALUE) && s.hp <= s.maxHp
    && s.lifeState === npcSelfLifeState(s)
    && npcSelfKeys(s.needs, ['hunger', 'fatigue', 'energy'])
    && (c.relationTrust === null || npcSelfFinite(c.relationTrust, -100, 100));
  const base = { schema: 'ActorObservationV1', version: 1, policyVersion: 'npc-first-talk-self-v1',
    hashVersion: 'fnv1a-utf16-base36-v1', actor: { id: valid ? c.actorId : null }, audienceId: 'player-1',
    sourceRevision: valid ? { sessionGeneration: r.sessionGeneration, worldMinute: r.worldMinute, eventSeq: r.eventSeq, stepIndex: r.stepIndex, phase: r.phase } : null,
    knowledge: valid ? [{ subjectId: c.actorId, status: 'observed',
      facts: { lifeState: s.lifeState, hpBand: Math.round(s.hp / s.maxHp * 4) + '/4',
        needBands: { hunger: npcSelfNeedBand(s.needs.hunger, 'hunger'), fatigue: npcSelfNeedBand(s.needs.fatigue, 'fatigue'), energy: npcSelfNeedBand(s.needs.energy, 'energy') } },
      provenance: { kind: 'self', sourceId: c.actorId, at: r.worldMinute } }] : [],
    unknown: valid ? [] : [{ reason: 'not-observable' }] };
  return observerDeepFreeze({ ...base, observationHash: observerFactsHash(base) });
}
function resolveNpcSelfDialogueV1(observation, relationTrust, enabled = false) {
  const o = observation, k = o?.knowledge?.[0], revision = o?.sourceRevision;
  const valid = npcSelfKeys(o, ['schema', 'version', 'policyVersion', 'hashVersion', 'actor', 'audienceId', 'sourceRevision', 'knowledge', 'unknown', 'observationHash'])
    && o.schema === 'ActorObservationV1' && o.version === 1 && o.policyVersion === 'npc-first-talk-self-v1'
    && o.audienceId === 'player-1' && o.hashVersion === 'fnv1a-utf16-base36-v1'
    && npcSelfKeys(o.actor, ['id']) && typeof o.actor.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(o.actor.id)
    && Array.isArray(o.knowledge) && o.knowledge.length === 1 && Array.isArray(o.unknown) && o.unknown.length === 0
    && npcSelfKeys(revision, ['sessionGeneration', 'worldMinute', 'eventSeq', 'stepIndex', 'phase']) && revision.phase === 'DAY'
    && Number.isSafeInteger(revision.sessionGeneration) && revision.sessionGeneration >= 0
    && npcSelfFinite(revision.worldMinute, 0, Number.MAX_SAFE_INTEGER)
    && Number.isSafeInteger(revision.eventSeq) && revision.eventSeq >= 0 && Number.isSafeInteger(revision.stepIndex) && revision.stepIndex >= 0
    && npcSelfKeys(k, ['subjectId', 'status', 'facts', 'provenance']) && k.status === 'observed' && k.subjectId === o.actor.id
    && npcSelfKeys(k.provenance, ['kind', 'sourceId', 'at']) && k.provenance.kind === 'self' && k.provenance.sourceId === o.actor.id && k.provenance.at === revision.worldMinute
    && npcSelfKeys(k.facts, ['lifeState', 'hpBand', 'needBands']) && ['healthy', 'injured', 'critical'].includes(k.facts.lifeState)
    && ['0/4', '1/4', '2/4', '3/4', '4/4'].includes(k.facts.hpBand)
    && npcSelfKeys(k.facts.needBands, ['hunger', 'fatigue', 'energy'])
    && ['urgent', 'normal', 'unknown'].includes(k.facts.needBands.hunger) && ['urgent', 'normal', 'unknown'].includes(k.facts.needBands.fatigue)
    && ['low', 'normal', 'unknown'].includes(k.facts.needBands.energy)
    && o.observationHash === observerFactsHash({ schema: o.schema, version: o.version, policyVersion: o.policyVersion, hashVersion: o.hashVersion,
      actor: o.actor, audienceId: o.audienceId, sourceRevision: revision, knowledge: o.knowledge, unknown: o.unknown });
  const trustValid = npcSelfFinite(relationTrust, -100, 100), disclose = trustValid && relationTrust >= -10;
  const facts = { kind: 'npc', id: valid ? o.actor.id : null, lifeState: valid ? k.facts.lifeState : 'unknown' };
  let text = '暂时无法确认这位角色的伤势信息。';
  if (valid) {
    text = { healthy: '我目前没有受伤。', injured: '我受伤了。', critical: '我伤得很重。' }[facts.lifeState];
    if (disclose) {
      facts.hpBand = k.facts.hpBand;
      facts.needBands = { ...k.facts.needBands };
      const healthText = { '0/4': '我的生命余量已经很少。', '1/4': '我的生命余量大约还剩四分之一。', '2/4': '我的生命余量大约还剩一半。', '3/4': '我的生命余量大约还剩四分之三。', '4/4': '我的生命余量接近完整。' }[facts.hpBand];
      if (healthText) text += healthText;
      if (facts.needBands.hunger === 'urgent') text += '我饿得厉害，得找点吃的。';
      else if (facts.needBands.fatigue === 'urgent') text += '我累得厉害，需要休息。';
      else if (facts.needBands.energy === 'low') text += '我快没力气了，需要缓一缓。';
    } else text += trustValid ? '具体情况，我暂时不想多谈。' : '更多身体详情暂时无法确认。';
  }
  return observerDeepFreeze({ schema: 'NpcSelfDialogueV1', version: 1, authority: 'expression_only', mode: 'authored',
    observerEnabled: enabled === true, facts, text, sourceProjectionHash: observerFactsHash(facts),
    observationHash: valid ? o.observationHash : null, fallbackReason: valid ? null : 'not-observable',
    disclosureReason: !valid ? 'not-observable' : !trustValid ? 'relation-unknown' : disclose ? 'allowed' : 'limited-trust' });
}
// NPC_SELF_CORE_END

export { projectNpcSelfObservationV1, resolveNpcSelfDialogueV1 };
