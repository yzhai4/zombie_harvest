/** Canonical CombatIntentV1 normalization shared by headless checks and future GameCore extraction. */
export const COMBAT_INTENT_SCHEMA_VERSION = 'CombatIntentV1';
const FORBIDDEN_KEYS = new Set(['prompt', 'response', 'chainOfThought', 'rawModelOutput', 'statePatch']);

export function validateCombatIntent(intent) {
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) return { ok: false, reason: 'object-required' };
  if (Object.keys(intent).some(key => FORBIDDEN_KEYS.has(key))) return { ok: false, reason: 'model-or-patch-field' };
  const required = ['schemaVersion', 'intentId', 'sourceRef', 'targetRef', 'phase', 'attackSeq', 'profileId', 'amount', 'damageType'];
  if (required.some(key => !(key in intent))) return { ok: false, reason: 'required-field' };
  if (intent.schemaVersion !== COMBAT_INTENT_SCHEMA_VERSION) return { ok: false, reason: 'schema-version' };
  if (intent.phase !== 'DAY') return { ok: false, reason: 'phase' };
  if (typeof intent.intentId !== 'string' || !intent.intentId) return { ok: false, reason: 'intent-id' };
  if (!Number.isInteger(intent.attackSeq) || intent.attackSeq < 1) return { ok: false, reason: 'attack-seq' };
  if (!Number.isInteger(intent.amount) || intent.amount < 1) return { ok: false, reason: 'amount' };
  if (typeof intent.profileId !== 'string' || !intent.profileId) return { ok: false, reason: 'profile-id' };
  if (typeof intent.damageType !== 'string' || !intent.damageType) return { ok: false, reason: 'damage-type' };
  for (const ref of [intent.sourceRef, intent.targetRef]) if (!ref || typeof ref.id !== 'string' || !ref.id || typeof ref.kind !== 'string' || !ref.kind) return { ok: false, reason: 'entity-ref' };
  if (intent.sourceEventId !== undefined && intent.sourceEventId !== null && (typeof intent.sourceEventId !== 'string' || !intent.sourceEventId)) return { ok: false, reason: 'source-event-id' };
  return { ok: true };
}

export function normalizeCombatIntent(raw) {
  const candidate = { ...raw, schemaVersion: raw?.schemaVersion || COMBAT_INTENT_SCHEMA_VERSION };
  const check = validateCombatIntent(candidate);
  if (!check.ok) return check;
  return { ok: true, intent: { schemaVersion: COMBAT_INTENT_SCHEMA_VERSION, intentId: candidate.intentId, sourceRef: { id: candidate.sourceRef.id, kind: candidate.sourceRef.kind }, targetRef: { id: candidate.targetRef.id, kind: candidate.targetRef.kind }, phase: 'DAY', attackSeq: candidate.attackSeq, profileId: candidate.profileId, amount: candidate.amount, damageType: candidate.damageType, ...(candidate.sourceEventId == null ? {} : { sourceEventId: candidate.sourceEventId }) } };
}

export function sortCombatIntents(intents) {
  return [...intents].sort((a, b) => String(a.sourceRef.id).localeCompare(String(b.sourceRef.id)) || String(a.targetRef.id).localeCompare(String(b.targetRef.id)) || a.attackSeq - b.attackSeq);
}

export function canonicalCombatIntent(intent) {
  const normalized = normalizeCombatIntent(intent);
  if (!normalized.ok) return normalized;
  return { ok: true, value: JSON.stringify(normalized.intent) };
}

