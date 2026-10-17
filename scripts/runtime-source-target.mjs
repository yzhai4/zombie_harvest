import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Select exact runtime bytes without replacing dist or changing golden traces. */
export function readSourceTarget(args = process.argv.slice(2)) {
  assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--html' && path.isAbsolute(args[1])),
    'usage: node scripts/check-*.mjs [--html ABSOLUTE_HTML]');
  const htmlPath = args[1] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/index.html');
  const bytes = readFileSync(htmlPath);
  return { htmlPath, source: bytes.toString('utf8'), sourceHash: createHash('sha256').update(bytes).digest('hex') };
}
