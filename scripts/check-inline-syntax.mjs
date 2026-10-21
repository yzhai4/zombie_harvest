#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../dist/index.html', import.meta.url)), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(text => text.trim());
if (!scripts.length) throw new Error('no inline scripts found');
for (const [index, script] of scripts.entries()) {
  const result = spawnSync(process.execPath, ['--check'], { input: script, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(`inline script ${index}: ${result.error || result.stderr}`);
}
console.log(`inline JavaScript syntax passed: ${scripts.length} scripts`);
