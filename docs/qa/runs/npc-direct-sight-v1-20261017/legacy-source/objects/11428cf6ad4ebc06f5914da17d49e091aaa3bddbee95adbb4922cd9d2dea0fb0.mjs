import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd(), out = path.resolve(root, 'review-output/additional');
fs.mkdirSync(out, { recursive: true });
const python = process.env.ZH_PYTHON;
if (!python) throw new Error('ZH_PYTHON required');
const html = path.join(root, 'dist/index.html');
const tests = [
 ['presence', process.execPath, 'scripts/check-outpost-presence-v1.mjs', '--html', html],
 ['attention', process.execPath, 'scripts/check-npc-threat-attention.mjs'],
 ['evidence-method', process.execPath, 'scripts/check-iteration-evidence-self-test.mjs'],
 ['crop-method', python, '-X', 'utf8', '-c', "import sys; sys.path.insert(0, 'scripts'); from report_recovery_full import crop_method_controls; result = crop_method_controls(); print('synthetic crop proof method checks:', len(result['controls']))"],
 ['safety', python, '-X', 'utf8', 'scripts/check-three-day-safety.py'],
 ['rest', process.execPath, 'scripts/check-camp-rest-v1.mjs', '--html', html, '--out', path.join(out, 'rest.json')],
 ['crop', process.execPath, 'scripts/check-crop-target-v1.mjs', '--html', html, '--out', path.join(out, 'crop.json')],
 ['shortage', process.execPath, 'scripts/check-shortage-choice-v2.mjs', '--html', html, '--baseline-report', 'docs/experiments/runs/food-shortage-strategies-32f911-20261017/report.json', '--out', path.join(out, 'shortage.json')],
 ['npc', process.execPath, 'scripts/check-npc-public-eligibility-v1.mjs', '--html', html, '--out', path.join(out, 'npc.json')],
 ['scenario-boot', process.execPath, 'scripts/check-scenario-boot-c1.mjs', '--html', html, '--core-module', path.join(root, 'scripts/lib/scenario-package-v1.mjs'), '--input-manifest', path.join(root, 'scripts/fixtures/scenario-boot-c1/frozen-input-manifest.json'), '--out', path.join(out, 'scenario-boot')]
];
const results = [], sha = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const source = sha(html);
for (const [name, executable, ...args] of tests) {
 const run = spawnSync(executable, args, { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 16*1024*1024 });
 fs.writeFileSync(path.join(out, name+'.log'), (run.stdout||'')+'\n'+(run.stderr||''));
 results.push({name, exitCode: run.status, signal: run.signal, error: run.error?.message || null});
 fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({sourceHtmlSha256:source, sourceStillSame:sha(html)===source, results},null,2)+'\n');
 console.log(JSON.stringify(results.at(-1)));
}
if (results.some(x=>x.exitCode!==0) || sha(html)!==source) process.exitCode=1;
