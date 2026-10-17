// Pure JSON-data core; imports and exports stay outside the embedding markers.
// OBSERVER_CORE_START
function observerDeepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && Object.hasOwn(descriptor, 'value')) observerDeepFreeze(descriptor.value, seen);
  }
  return Object.freeze(value);
}
function observerRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.prototype.toString.call(value) === '[object Object]';
}
function observerText(value, fallback = null) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 160 ? value : fallback;
}
function observerNumber(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function observerEnum(value, allowed, fallback = 'unknown') {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}
function observerClamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function observerBand(value, high, medium) {
  const number = observerNumber(value);
  return number === null ? 'unknown' : number >= high ? 'high' : number >= medium ? 'medium' : 'low';
}
function observerTruthProjection(subject) {
  if (!observerRecord(subject)) return observerDeepFreeze({ kind: 'invalid', id: null });
  // Infer legacy subjects only when kind is absent. Unknown kinds fail closed.
  const kind = subject.kind === undefined
    ? (subject.lifeState !== undefined ? 'npc' : subject.phase !== undefined || subject.defId !== undefined ? 'event' : 'item')
    : subject.kind;
  if (!['item', 'npc', 'event'].includes(kind)) return observerDeepFreeze({ kind: 'invalid', id: null });
  const id = observerText(subject.id, observerText(subject.defId));
  let projection;
  if (kind === 'npc') {
    const hp = observerNumber(subject.hp), maxHp = observerNumber(subject.maxHp);
    projection = { kind, id, name: observerText(subject.name, id || '未知角色'), role: observerText(subject.role),
      lifeState: observerEnum(subject.lifeState, ['healthy', 'injured', 'critical', 'dead']),
      hpBand: hp !== null && hp >= 0 && maxHp !== null && maxHp > 0
        ? String(Math.round(observerClamp(hp / maxHp, 0, 1) * 4)) + '/4' : 'unknown' };
  } else if (kind === 'event') {
    projection = { kind, id, title: observerText(subject.title, id || '未知事件'),
      phase: observerEnum(subject.phase, ['DAY', 'NIGHT', 'ANY'], subject.phase === undefined ? 'DAY' : 'unknown'),
      handled: typeof subject.handled === 'boolean' ? subject.handled : 'unknown', threatBand: observerBand(subject.threat, 60, 25) };
  } else {
    projection = { kind, id, label: observerText(subject.label, observerText(subject.name, id || '未知物品')),
      category: observerText(subject.category, observerText(subject.type, 'unknown')),
      qualityBand: subject.qualityBand === undefined
        ? observerBand(subject.quality, 70, 40) : observerEnum(subject.qualityBand, ['high', 'medium', 'low']) };
  }
  return observerDeepFreeze(projection);
}
function observerDisclosureScore(subject = {}, context = {}) {
  const s = observerRecord(subject) ? subject : {}, c = observerRecord(context) ? context : {};
  const relation = observerRecord(c.relation) ? c.relation : observerRecord(s.relation) ? s.relation : {};
  const values = observerRecord(c.values) ? c.values : observerRecord(s.values) ? s.values : {};
  // Invalid/missing policy numbers contribute no adjustment. No coercion is
  // allowed; this neutral policy default does not create an observed fact.
  const trustRaw = relation.trustToPlayer === undefined ? relation.trust : relation.trustToPlayer;
  const alignmentRaw = c.valueAlignment === undefined ? values.alignment : c.valueAlignment;
  const progressRaw = c.playerProgress === undefined ? s.playerProgress : c.playerProgress;
  const trust = observerClamp(observerNumber(trustRaw) ?? 0, -100, 100);
  const alignment = observerClamp(observerNumber(alignmentRaw) ?? 0, -100, 100);
  const progress = observerClamp((observerNumber(progressRaw) ?? 0) / 100, -1, 1);
  return observerClamp(.5 + trust / 200 + alignment / 400 + progress * .15, 0, 1);
}
function observerAllowedFacts(projection, score) {
  const facts = { kind: projection.kind, id: projection.id };
  if (projection.kind === 'item') {
    Object.assign(facts, { label: projection.label, category: projection.category });
    if (score >= .35) facts.qualityBand = projection.qualityBand;
  } else if (projection.kind === 'npc') {
    Object.assign(facts, { name: projection.name, role: projection.role, lifeState: projection.lifeState });
    if (score >= .45) facts.hpBand = projection.hpBand;
  } else if (projection.kind === 'event') {
    Object.assign(facts, { title: projection.title, phase: projection.phase, handled: projection.handled });
    if (score >= .55) facts.threatBand = projection.threatBand;
  }
  return observerDeepFreeze(facts);
}
function observerFactsHash(facts) {
  const text = JSON.stringify(facts);
  let hash = 2166136261;
  // Index UTF-16 code units, including both halves of non-BMP characters.
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
function resolveObserverExpression(input = {}) {
  const i = observerRecord(input) ? input : {}, config = observerRecord(i.config) ? i.config : {};
  const enabled = config.observerCommentary === true || config.enabled === true;
  // Top-level relation remains a legacy Node-call alias.
  const context = observerRecord(i.context) ? i.context : { relation: i.relation };
  const projection = observerTruthProjection(i.subject), score = observerDisclosureScore(i.subject, context);
  const invalid = projection.kind === 'invalid', facts = observerAllowedFacts(projection, score);
  const detail = score >= .7 ? '完整' : score >= .4 ? '有限' : '模糊';
  let text = invalid ? '可验证事实：未知对象。' : '可验证' + (projection.kind === 'npc' ? '角色' : projection.kind === 'event' ? '事件' : '物品')
    + '事实（' + detail + '披露）：' + (facts.label || facts.name || facts.title || facts.id || '未知');
  if (projection.kind === 'npc' && score < .4) text += '；我暂时不愿解释更多。';
  if (projection.kind === 'event' && facts.threatBand === 'high') text += '；这件事需要优先处理。';
  if (projection.kind === 'item' && facts.qualityBand === 'high') text += '；它的价值值得谨慎评估。';
  // projection contains withheld values and must never be returned here.
  return observerDeepFreeze({ schema: 'ObserverExpressionV1', version: 1,
    hashVersion: 'fnv1a-utf16-base36-v1', enabled,
    mode: enabled && !invalid ? 'deterministic-stub' : 'fallback', authority: 'expression_only',
    fallbackReason: invalid ? 'invalid-subject' : null,
    disclosureScore: Math.round(score * 1000) / 1000, facts, text,
    sourceProjectionHash: observerFactsHash(facts) });
}
// OBSERVER_CORE_END
export { observerDeepFreeze, observerTruthProjection, observerDisclosureScore, resolveObserverExpression };
export { observerDeepFreeze as deepFreeze, observerFactsHash as stableHash };
