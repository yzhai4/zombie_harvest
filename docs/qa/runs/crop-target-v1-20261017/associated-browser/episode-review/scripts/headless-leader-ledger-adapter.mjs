#!/usr/bin/env node
/**
 * Offline leader ledger adapter. It is deliberately independent from dist,
 * SAVE21, CONTENT3 and the production CommandBus.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'scripts', 'fixtures', 'leader-harness');
const read = name => JSON.parse(readFileSync(path.join(fixtureDir, name), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'
  : JSON.stringify(value);
export const sha256 = value => createHash('sha256').update(canonical(value)).digest('hex');
export const projectionHash = projection => sha256(Object.fromEntries(Object.entries(projection).filter(([k]) => k !== 'sourceProjectionHash')));
const INTENT_KEYS = ['schema','intentId','actorId','roleId','policyVersion','sourceProjectionHash','target','action','deadline','resourceBudget','cancelIf','fallback','model','reason'];
const budgetKeys = ['commandPoints','wood','food','parts','medicine','stamina'];
const exact = (value, keys, label, errors) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { errors.push(label + ':object'); return; }
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(label + ':unknown:' + key);
  for (const key of keys) if (!Object.hasOwn(value, key)) errors.push(label + ':missing:' + key);
};
const string = (value, label, errors) => { if (typeof value !== 'string' || !value) errors.push(label + ':string'); };
const integer = (value, label, errors) => { if (!Number.isSafeInteger(value) || value < 0) errors.push(label + ':integer'); };

export function normalizeIntent(raw, projection) {
  const errors = [];
  exact(raw, INTENT_KEYS, 'intent', errors);
  if (!errors.length) {
    string(raw.schema, 'schema', errors);
    for (const key of ['intentId','actorId','roleId','policyVersion','sourceProjectionHash','action']) string(raw[key], key, errors);
    exact(raw.target, ['kind','id'], 'target', errors);
    string(raw.target?.kind, 'target.kind', errors); string(raw.target?.id, 'target.id', errors);
    exact(raw.deadline, ['day','minute'], 'deadline', errors);
    integer(raw.deadline?.day, 'deadline.day', errors); integer(raw.deadline?.minute, 'deadline.minute', errors);
    exact(raw.resourceBudget, budgetKeys, 'resourceBudget', errors);
    for (const key of budgetKeys) integer(raw.resourceBudget?.[key], 'resourceBudget.' + key, errors);
    if (!Array.isArray(raw.cancelIf) || raw.cancelIf.some(value => typeof value !== 'string')) errors.push('cancelIf');
    exact(raw.fallback, ['kind','plannerId','action'], 'fallback', errors);
    exact(raw.model, ['kind','provider','latencyMs','attempt'], 'model', errors);
    string(raw.model?.kind, 'model.kind', errors); string(raw.model?.provider, 'model.provider', errors);
    integer(raw.model?.latencyMs, 'model.latencyMs', errors); integer(raw.model?.attempt, 'model.attempt', errors);
    exact(raw.reason, ['summary','confidence'], 'reason', errors);
    string(raw.reason?.summary, 'reason.summary', errors);
    if (!['low','medium','high'].includes(raw.reason?.confidence)) errors.push('reason.confidence');
    if (raw.sourceProjectionHash !== projectionHash(projection)) errors.push('stale-projection');
  }
  return errors.length ? { ok: false, reasonCode: errors.includes('stale-projection') ? 'stale-observation' : 'invalid', errors }
    : { ok: true, intent: clone(raw), intentHash: sha256(raw) };
}
const legacy = value => Boolean(value && typeof value === 'object' && (value.saveVersion === 21 || value.version === 21 || value.payload?.version === 21 || value.payload?.contentState?.contentVersion === 3 || value.worldMeta || value.payload?.worldMeta));
export class HeadlessLeaderLedgerAdapter {
  constructor({ projection, world }) {
    if (legacy(world)) throw new Error('legacy-save21-isolation');
    this.projection = clone(projection); this.initialWorld = clone(world); this.world = clone(world);
    this.ledger = []; this.history = []; this.receipts = []; this.byIntent = new Map();
  }
  receipt(input) { const out = { schema: 'PlannerReceiptV1', receiptId: 'receipt-' + (this.receipts.length + 1), ...input }; this.receipts.push(out); return out; }
  submit(raw, options = {}) {
    const normalized = normalizeIntent(raw, this.projection);
    if (normalized.ok && this.byIntent.has(normalized.intent.intentId)) {
      const prior = this.byIntent.get(normalized.intent.intentId);
      return this.receipt({ intentId: normalized.intent.intentId, status: 'duplicate', reasonCode: 'duplicate', commandId: prior.commandId, eventIds: [], replayOf: prior.receiptId, replayHash: this.replayHash() });
    }
    this.history.push({ raw: clone(raw), options: clone(options) });
    let reason = normalized.ok ? 'accepted' : normalized.reasonCode;
    if (options.modelCase === 'timeout' || options.modelCase === 'model-unavailable') reason = options.modelCase;
    if (normalized.ok && reason === 'accepted') {
      const i = normalized.intent;
      if (i.actorId !== this.world.actor.id || !this.world.actor.active || this.world.actor.dead || this.world.actor.presence !== 'camp' || i.roleId !== this.projection.roleId) reason = 'unauthorized';
      else if (i.action !== 'support_proposal' || i.target.kind !== 'plan' || !this.world.registeredCommands.includes('plan.meeting.commit')) reason = 'intent-unsupported';
      else if (this.world.phase !== 'DAY' || i.deadline.day !== this.world.day) reason = 'phase-blocked';
      else if (!this.world.planMeeting.candidateIds.includes(i.target.id)) reason = 'target-missing';
      else if (i.resourceBudget.commandPoints > this.world.commandPoints) reason = 'resource-shortage';
    }
    if (normalized.ok && reason === 'accepted') {
      const i = normalized.intent, commandId = 'leader-command:' + i.intentId;
      this.world.commandPoints -= i.resourceBudget.commandPoints; this.world.planMeeting.status = 'committed';
      const event = { seq: this.ledger.length + 1, type: 'leader.intent.accepted', intentId: i.intentId, commandId, targetId: i.target.id, cost: i.resourceBudget.commandPoints };
      this.ledger.push(event);
      const out = this.receipt({ intentId: i.intentId, status: 'accepted', reasonCode: 'accepted', commandId, eventIds: [event.seq], fallbackIntentId: null, replayHash: null });
      this.byIntent.set(i.intentId, out); out.replayHash = this.replayHash(); return out;
    }
    const fallbackId = 'fallback-' + (raw?.intentId || 'unknown') + '-' + reason;
    const event = { seq: this.ledger.length + 1, type: 'leader.intent.rejected', intentId: raw?.intentId || null, reasonCode: reason, fallbackIntentId: fallbackId };
    this.ledger.push(event);
    const out = this.receipt({ intentId: raw?.intentId || null, status: 'rejected', reasonCode: reason, commandId: null, eventIds: [event.seq], fallbackIntentId: fallbackId, replayHash: null });
    if (normalized.ok) this.byIntent.set(normalized.intent.intentId, out);
    out.replayHash = this.replayHash(); return out;
  }
  replayHash() { return sha256({ world: this.world, ledger: this.ledger }); }
  replay() { const fresh = new HeadlessLeaderLedgerAdapter({ projection: this.projection, world: this.initialWorld }); for (const item of this.history) fresh.submit(item.raw, item.options); return fresh; }
}
function selfTest() {
  const projection = read('projection-v1.json'), world = read('world-baseline.json'), valid = read('intent-envelope-v1.json'), legacySave = read('legacy-save21-isolation.json');
  const intent = { ...valid, sourceProjectionHash: projectionHash(projection), resourceBudget: { commandPoints: 1, wood: 0, food: 0, parts: 0, medicine: 0, stamina: 0 } };
  const adapter = new HeadlessLeaderLedgerAdapter({ projection, world }), checks = [];
  const check = (name, fn) => { try { fn(); checks.push({ name, ok: true }); } catch (error) { checks.push({ name, ok: false, error: String(error.message || error) }); } };
  check('accepted receipt and one CP cost', () => { const r = adapter.submit(intent); assert.equal(r.status, 'accepted'); assert.equal(adapter.world.commandPoints, 1); });
  check('duplicate has no second event or cost', () => { const before = adapter.replayHash(), r = adapter.submit(intent); assert.equal(r.status, 'duplicate'); assert.equal(adapter.replayHash(), before); assert.equal(adapter.ledger.length, 1); });
  check('stale intent rejects with no payment', () => { const r = adapter.submit({ ...intent, intentId: 'stale-1', sourceProjectionHash: '0'.repeat(64) }); assert.equal(r.reasonCode, 'stale-observation'); assert.equal(adapter.world.commandPoints, 1); });
  check('model unavailable rejects with no payment', () => { const r = adapter.submit({ ...intent, intentId: 'unavailable-1' }, { modelCase: 'model-unavailable' }); assert.equal(r.reasonCode, 'model-unavailable'); assert.equal(adapter.world.commandPoints, 1); });
  check('legacy SAVE21 is isolated', () => { assert.throws(() => new HeadlessLeaderLedgerAdapter({ projection, world: legacySave }), /legacy-save21-isolation/); });
  const replay = adapter.replay();
  check('replay preserves ledger hash', () => { assert.equal(replay.replayHash(), adapter.replayHash()); assert.equal(replay.ledger.length, adapter.ledger.length); });
  const result = { runner: 'headless-leader-ledger-adapter-v1', productionWiring: false, ok: checks.every(x => x.ok), count: checks.length, passed: checks.filter(x => x.ok).length, checks, replayHash: adapter.replayHash() };
  console.log(JSON.stringify(result, null, 2)); process.exitCode = result.ok ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) selfTest();
