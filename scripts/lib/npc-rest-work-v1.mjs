// Pure decision core. Valid input does not establish live identity, presence,
// role, duty ownership or permission; the runtime must capture and recheck them.
// NPC_REST_WORK_CORE_START
const NPC_REST_WORK_POLICY_V1 = Object.freeze({
  enterEnergy: 24,
  releaseEnergy: 36,
  policyVersion: 'carpenter-rest-work-v1'
});
function npcRestWorkCoreKeys(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && Object.hasOwn(descriptor, 'value') && descriptor.enumerable;
  });
}
function npcRestWorkCoreActor(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
function npcRestWorkCoreMinute(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
function validateNpcRoutineIntentV1(value, actorId, worldMinute) {
  try {
    if (!npcRestWorkCoreActor(actorId) || !npcRestWorkCoreMinute(worldMinute)) return false;
    if (value === null) return true;
    return npcRestWorkCoreKeys(value, ['version', 'policyVersion', 'intentId', 'actorId', 'roleId', 'startedAt'])
      && value.version === 1 && value.policyVersion === NPC_REST_WORK_POLICY_V1.policyVersion
      && typeof value.intentId === 'string' && value.intentId.trim().length > 0 && value.intentId.length <= 512
      && value.actorId === actorId && value.roleId === 'carpenter'
      && npcRestWorkCoreMinute(value.startedAt) && value.startedAt <= worldMinute;
  } catch {
    return false;
  }
}
function npcRestWorkCoreHasIntent(input) {
  try {
    if (input === null || typeof input !== 'object') return false;
    const descriptor = Object.getOwnPropertyDescriptor(input, 'intent');
    return descriptor !== undefined && Object.hasOwn(descriptor, 'value')
      && descriptor.value !== null && descriptor.value !== undefined;
  } catch {
    return false;
  }
}
function decideNpcRestWorkV1(input) {
  const hasIntent = npcRestWorkCoreHasIntent(input);
  try {
    if (!npcRestWorkCoreKeys(input, ['energy', 'eligible', 'ownerReason', 'intent', 'actorId', 'worldMinute'])
      || typeof input.energy !== 'number' || !Number.isFinite(input.energy) || input.energy < 0 || input.energy > 100
      || typeof input.eligible !== 'boolean' || !(input.ownerReason === null || typeof input.ownerReason === 'string')
      || !validateNpcRoutineIntentV1(input.intent, input.actorId, input.worldMinute)) {
      return { action: hasIntent ? 'cancel' : 'unhandled', reason: 'invalid-input' };
    }
    if (!input.eligible || input.ownerReason) {
      return { action: hasIntent ? 'cancel' : 'unhandled', reason: input.ownerReason || 'ineligible' };
    }
    if (hasIntent) {
      return input.energy >= NPC_REST_WORK_POLICY_V1.releaseEnergy
        ? { action: 'finish', reason: 'energy-recovered' }
        : { action: 'continue', reason: 'recovery-in-progress' };
    }
    return input.energy < NPC_REST_WORK_POLICY_V1.enterEnergy
      ? { action: 'start', reason: 'low-energy' }
      : { action: 'unhandled', reason: 'energy-not-low' };
  } catch {
    return { action: hasIntent ? 'cancel' : 'unhandled', reason: 'invalid-input' };
  }
}
// NPC_REST_WORK_CORE_END

export { NPC_REST_WORK_POLICY_V1, validateNpcRoutineIntentV1, decideNpcRestWorkV1 };
