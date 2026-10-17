import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sourceRuntimeFactory, startRuntime, saveKey } from './lib/source-runtime-fixture.mjs';

// Re-run only against the indicated archived source, never a guessed payload.
const htmlPath = process.argv[2];
assert.ok(htmlPath, 'supply original 30eeef source HTML');
const sourceHash = createHash('sha256').update(readFileSync(htmlPath)).digest('hex');
assert.equal(sourceHash, 'b2cf9f2ef8a6b79686e8910a99913e909d7bbe224d5575b8680c0ced44ac1953');
const r = startRuntime(sourceRuntimeFactory(htmlPath));
r.api.state.food = 0; // TEST-ONLY setup, not a captured production play session.
r.api.contentHook('onDayStart', { actorId: 'camp-autonomy' });
assert.equal(r.api.save({ force: true }), true);
const payload = JSON.parse(r.storage.get(saveKey)).payload;
assert.equal(r.api.validatePayload(payload).ok, true);
mkdirSync('scripts/fixtures/content-episode-v1', { recursive: true });
writeFileSync('scripts/fixtures/content-episode-v1/save21-pre-identity-active.json', JSON.stringify({
  sourceCommit: '30eeefb5c20e4e8105dfe76e64ce9f806e3373cd',
  sourceHtmlSha256: sourceHash,
  testOnly: true,
  provenance: 'Complete original SAVE21 writer after fixture food=0 and real onDayStart; not production capture',
  payload
}, null, 2) + '\n');
console.log({ active: payload.contentState.activeChains['zh-food-shortage-001'], valid: true });
