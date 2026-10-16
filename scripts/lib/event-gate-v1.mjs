/**
 * Pure GateV1 evaluator.
 *
 * The browser runtime currently keeps this adapter inline. This module is a
 * shadow implementation for headless checks and future extraction: callers
 * supply the read-only state through context.state, and the evaluator never
 * mutates it, emits events, or applies effects.
 */

export const EVENT_GATE_SCHEMA_VERSION = 'EventGateV1';
export const GATE_V1_PHASES = Object.freeze(['DAY', 'NIGHT', 'ANY']);
export const GATE_V1_OBJECT_KEYS = Object.freeze({
  landmark_exists: Object.freeze(['type', 'id']),
  camp_trust: Object.freeze(['type', 'min']),
  npc_alive: Object.freeze(['type', 'id']),
  flag: Object.freeze(['type', 'id', 'value']),
  day_between: Object.freeze(['type', 'min', 'max'])
});

const phaseSet = new Set(GATE_V1_PHASES);
const own = (value, key) => Object.prototype.hasOwnProperty.call(Object(value), key);
const stateOf = context => context && context.state && typeof context.state === 'object' ? context.state : {};

function clampSanity(value, fallback = 72) {
  const number = Number(value);
  return Math.max(0, Math.min(100, Number.isFinite(number) ? number : fallback));
}

function npcIsActive(npc) {
  return !!npc && npc.lifeState !== 'dead';
}

function actorFor(context, state) {
  const event = context.event || state.event || {};
  const instance = context.instance || state.eventInstance || {};
  const actorId = context.actorId || event.npcEvent?.npcId || instance.actorId || null;
  return actorId ? (Array.isArray(state.npcs) ? state.npcs.find(npc => npc?.id === actorId) || null : null) : null;
}

/** Resolve one of the deliberately small paths accepted by GateV1 strings. */
export function resolveGateV1Path(path, context = {}) {
  const state = stateOf(context);
  if (typeof path !== 'string' || !path.trim()) return { ok: false, reason: 'event-precondition-invalid', path };
  const raw = path.trim().replace(/^state\./, '');
  if (raw === 'player.sanity') return { ok: true, exists: true, value: clampSanity(state.sanity), path: raw };
  if (raw.startsWith('npc.')) {
    const actor = actorFor(context, state);
    if (!actor) return { ok: false, reason: 'event-precondition-invalid', path: raw, details: { actor: 'missing' } };
    const keys = raw.slice(4).split('.').filter(Boolean);
    if (!keys.length || keys.some(key => !/^[A-Za-z_][\w-]*$/.test(key))) return { ok: false, reason: 'event-precondition-invalid', path: raw };
    let value = actor;
    for (const key of keys) {
      if (value === null || value === undefined || !own(value, key)) return { ok: false, reason: 'event-precondition-invalid', path: raw, details: { field: key } };
      value = value[key];
    }
    return { ok: true, exists: value !== undefined && value !== null, value, path: raw, actorId: actor.id };
  }
  if (raw === 'camp_trust' || raw === 'campTrust') return { ok: true, exists: true, value: Number(state.contentState?.meters?.campTrust) || 0, path: raw };
  if (raw === 'scrap') return { ok: true, exists: true, value: Number(state.parts) || 0, path: raw };
  if (raw.endsWith('_alive')) {
    const npcId = raw.slice(0, -6);
    const npc = Array.isArray(state.npcs) ? state.npcs.find(item => item?.id === npcId) : null;
    if (!npc) return { ok: false, reason: 'event-precondition-invalid', path: raw, details: { npcId } };
    return { ok: true, exists: true, value: npcIsActive(npc), path: raw, npcId };
  }
  if (!(raw === 'relayProject' || raw.startsWith('relayProject.') || ['day', 'hour', 'minute'].includes(raw))) return { ok: false, reason: 'event-precondition-invalid', path: raw };
  const segments = raw.split('.').filter(Boolean);
  if (!segments.length || segments.some(segment => !/^[A-Za-z_][\w-]*$/.test(segment))) return { ok: false, reason: 'event-precondition-invalid', path: raw };
  let value = state;
  for (const segment of segments) {
    if (value === null || value === undefined || !own(value, segment)) return { ok: true, exists: false, value: undefined, path: raw };
    value = value[segment];
  }
  return { ok: true, exists: value !== undefined && value !== null, value, path: raw };
}

function compare(value, operator, target) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return false;
  if (operator === '>=') return numeric >= target;
  if (operator === '<=') return numeric <= target;
  if (operator === '>') return numeric > target;
  if (operator === '<') return numeric < target;
  return numeric === target;
}

export function evaluateGateV1String(condition, context = {}) {
  if (typeof condition !== 'string' || !condition.trim()) return { ok: false, reason: 'event-precondition-invalid', failedGate: { type: 'string', condition } };
  const state = stateOf(context);
  const text = condition.trim();
  if (text.startsWith('player_tool:')) {
    const tool = text.slice('player_tool:'.length);
    if (!tool) return { ok: false, reason: 'event-precondition-invalid', failedGate: { type: 'string', condition } };
    const ok = !!state.contentState?.flags?.[text] || Array.isArray(state.player?.tools) && state.player.tools.includes(tool);
    return ok ? { ok: true } : { ok: false, reason: 'event-precondition', failedGate: { type: 'string', condition } };
  }
  if (text.startsWith('tech:')) {
    const tech = text.slice('tech:'.length);
    if (!tech) return { ok: false, reason: 'event-precondition-invalid', failedGate: { type: 'string', condition } };
    const ok = state.contentState?.unlockedTech?.includes(tech) === true;
    return ok ? { ok: true } : { ok: false, reason: 'event-precondition', failedGate: { type: 'string', condition } };
  }
  if (text.startsWith('flag:')) {
    const flag = text.slice('flag:'.length);
    if (!flag) return { ok: false, reason: 'event-precondition-invalid', failedGate: { type: 'string', condition } };
    const ok = !!state.contentState?.flags?.[flag];
    return ok ? { ok: true } : { ok: false, reason: 'event-precondition', failedGate: { type: 'string', condition } };
  }
  const existence = text.match(/^(.+?)\s+(exists|missing|alive|inactive)$/i);
  if (existence) {
    const value = resolveGateV1Path(existence[1], context);
    if (!value.ok) return { ...value, failedGate: { type: 'string', condition: text } };
    const predicate = existence[2].toLowerCase();
    const ok = predicate === 'exists' ? value.exists : predicate === 'missing' ? !value.exists : predicate === 'alive' ? value.value === true : value.value === false;
    return ok ? { ok: true } : { ok: false, reason: 'event-precondition', failedGate: { type: 'string', condition: text }, details: { actual: value.value } };
  }
  const comparison = text.match(/^(.+?)\s*(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/);
  if (comparison) {
    const value = resolveGateV1Path(comparison[1], context);
    if (!value.ok || !value.exists) return { ok: false, reason: value.ok ? 'event-precondition' : value.reason, failedGate: { type: 'string', condition: text }, details: value.details };
    const ok = compare(value.value, comparison[2], Number(comparison[3]));
    return ok ? { ok: true } : { ok: false, reason: 'event-precondition', failedGate: { type: 'string', condition: text }, details: { actual: value.value, target: Number(comparison[3]) } };
  }
  const bare = resolveGateV1Path(text, context);
  if (!bare.ok) return { ...bare, failedGate: { type: 'string', condition: text } };
  if (!bare.exists) return { ok: false, reason: 'event-precondition', failedGate: { type: 'string', condition: text } };
  return bare.value ? { ok: true } : { ok: false, reason: 'event-precondition', failedGate: { type: 'string', condition: text }, details: { actual: bare.value } };
}

export function evaluateGateV1Object(condition, context = {}) {
  const state = stateOf(context);
  if (!condition || typeof condition !== 'object' || Array.isArray(condition) || typeof condition.type !== 'string') return { ok: false, reason: 'event-precondition-invalid', failedGate: { type: 'object', condition } };
  const type = condition.type;
  const allowedKeys = GATE_V1_OBJECT_KEYS[type];
  if (!allowedKeys || Object.keys(condition).some(key => !allowedKeys.includes(key))) return { ok: false, reason: 'event-precondition-invalid', failedGate: { type, condition } };
  if (type === 'landmark_exists') {
    if (typeof condition.id !== 'string' || !condition.id) return { ok: false, reason: 'event-precondition-invalid', failedGate: { type, condition } };
    return Array.isArray(state.landmarks) && state.landmarks.some(item => item?.type === condition.id && item.found !== false) ? { ok: true } : { ok: false, reason: 'event-precondition', failedGate: { type, condition } };
  }
  if (type === 'camp_trust') {
    const min = Number(condition.min);
    if (!Number.isFinite(min)) return { ok: false, reason: 'event-precondition-invalid', failedGate: { type, condition } };
    const actual = Number(state.contentState?.meters?.campTrust) || 0;
    return actual >= min ? { ok: true } : { ok: false, reason: 'event-precondition', failedGate: { type, condition }, details: { actual } };
  }
  if (type === 'npc_alive') {
    const id = condition.id === '$actor' ? actorFor(context, state)?.id : condition.id;
    if (typeof id !== 'string' || !id) return { ok: false, reason: 'event-precondition-invalid', failedGate: { type, condition } };
    return Array.isArray(state.npcs) && state.npcs.some(npc => npc?.id === id && npcIsActive(npc)) ? { ok: true } : { ok: false, reason: 'event-precondition', failedGate: { type, condition } };
  }
  if (type === 'flag') {
    if (typeof condition.id !== 'string' || !condition.id || (condition.value !== undefined && typeof condition.value !== 'boolean')) return { ok: false, reason: 'event-precondition-invalid', failedGate: { type, condition } };
    const actual = !!state.contentState?.flags?.[condition.id];
    const expected = condition.value !== false;
    return actual === expected ? { ok: true } : { ok: false, reason: 'event-precondition', failedGate: { type, condition }, details: { actual, expected } };
  }
  if (type === 'day_between') {
    const min = Number(condition.min), max = Number(condition.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return { ok: false, reason: 'event-precondition-invalid', failedGate: { type, condition } };
    return state.day >= min && state.day <= max ? { ok: true } : { ok: false, reason: 'event-precondition', failedGate: { type, condition }, details: { actual: state.day } };
  }
  return { ok: false, reason: 'event-precondition-invalid', failedGate: { type, condition } };
}

export function evaluateGateV1(gate = {}, context = {}) {
  if (!gate || typeof gate !== 'object' || Array.isArray(gate)) return { ok: false, reason: 'gate-invalid' };
  const state = stateOf(context);
  const rawPhase = gate.phase === undefined ? 'DAY' : gate.phase;
  const phases = Array.isArray(rawPhase) ? rawPhase : [rawPhase];
  if (!phases.length || phases.some(phase => typeof phase !== 'string' || !phaseSet.has(phase.toUpperCase()))) return { ok: false, reason: 'gate-phase-invalid', failedGate: { type: 'phase', value: rawPhase } };
  const normalizedPhases = phases.map(phase => phase.toUpperCase());
  const night = state.night === true || context.sessionMode === 'BATTLE' || context.sessionController?.mode === 'BATTLE' || context.SessionController?.mode === 'BATTLE';
  const phaseOk = normalizedPhases.includes('ANY') || normalizedPhases.includes(night ? 'NIGHT' : 'DAY') || (night && normalizedPhases.includes('DAY') && gate.nightAllowed === true);
  if (!phaseOk) return { ok: false, reason: 'phase-blocked', failedGate: { type: 'phase', value: normalizedPhases, night } };
  const list = gate.preconditions === undefined ? [] : Array.isArray(gate.preconditions) ? gate.preconditions : [gate.preconditions];
  for (const condition of list) {
    const result = typeof condition === 'string' ? evaluateGateV1String(condition, context) : evaluateGateV1Object(condition, context);
    if (!result.ok) return { ...result, gateVersion: 1, phase: normalizedPhases };
  }
  return { ok: true, gateVersion: 1, phase: normalizedPhases, checked: list.length };
}

export function normalizeEventGate(gate = {}) {
  if (!gate || typeof gate !== 'object' || Array.isArray(gate)) gate = {};
  const rawPhase = gate.phase === undefined || gate.phase === null || gate.phase === '' ? 'DAY' : gate.phase;
  const rawPreconditions = gate.preconditions === undefined ? [] : (Array.isArray(gate.preconditions) ? [...gate.preconditions] : [gate.preconditions]);
  return Object.freeze({ version: Number(gate.version) || 0, phase: Array.isArray(rawPhase) ? [...rawPhase] : rawPhase, nightAllowed: gate.nightAllowed === true, preconditions: rawPreconditions });
}

