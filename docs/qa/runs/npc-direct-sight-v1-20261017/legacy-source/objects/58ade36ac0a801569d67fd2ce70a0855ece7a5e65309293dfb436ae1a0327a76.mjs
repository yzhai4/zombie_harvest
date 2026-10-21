import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const root = process.cwd(), out = path.resolve(root, 'review-output/source-suite');
mkdirSync(out, { recursive: true });
const tests = [
 ['syntax', 'scripts/check-inline-syntax.mjs'],
 ['content', 'scripts/validate-content.mjs'],
 ['night', 'scripts/check-night-guard.mjs'],
 ['chains', 'scripts/check-content-chain.mjs'],
 ['plan-day', 'scripts/check-plan-day.mjs'],
 ['camp-area', 'scripts/check-camp-area.mjs'],
 ['plan-integrity', 'scripts/check-plan-integrity.mjs'],
 ['plan-ui', 'scripts/check-plan-integrity-ui.mjs', '--html', 'dist/index.html', '--io-adapter', 'scripts/check-report-recovery.mjs', '--legacy-fixture', 'scripts/fixtures/plan-integrity/plan-committed-legacy-basewriter.json', '--out', path.join(out,'plan-ui.json')],
 ['save-recovery', 'scripts/check-report-recovery.mjs'],
 ['command-ids', 'scripts/check-command-id-reservation.mjs', '--html', 'dist/index.html', '--io-adapter', 'scripts/check-report-recovery.mjs', '--out', path.join(out,'command-ids.json')],
 ['repair', 'scripts/check-repair-proof.mjs', '--html', 'dist/index.html', '--io-adapter', 'scripts/check-report-recovery.mjs', '--legacy-repair-fixture', 'scripts/fixtures/repair-proof/repair-legacy-basewriter.json', '--out', path.join(out,'repair.json')],
 ['leader', 'scripts/check-leader-llm-harness.mjs'],
 ['leader-replay', 'scripts/check-leader-harness-replay.mjs'],
 ['leader-ledger', 'scripts/headless-leader-ledger-adapter.mjs'],
 ['leader-bridge', 'scripts/check-leader-command-bridge.mjs'],
 ['leader-runtime', 'scripts/check-leader-command-bridge-runtime.mjs'],
 ['combat', 'scripts/check-daytime-combat.mjs'],
 ['combat-core', 'scripts/check-combat-intent-v1.mjs'],
 ['gates', 'scripts/check-event-gate-v1.mjs'],
 ['gate-parity', 'scripts/check-event-gate-parity.mjs'],
 ['relay-core', 'scripts/check-relay-construction-v1.mjs'],
 ['relay-producer', 'scripts/check-relay-construction-producer.mjs'],
 ['relay-tx', 'scripts/check-relay-construction-transaction-v1.mjs'],
 ['relay-runtime', 'scripts/check-relay-construction-runtime.mjs'],
 ['scenario', 'scripts/check-scenario-package-v1.mjs'],
 ['observer', 'scripts/check-observer-expression-v1.mjs'],
 ['gameplay', 'scripts/check-gameplay-vertical-slice.mjs'],
 ['episodes', 'scripts/check-content-episode-v1.mjs'],
 ['replay', 'scripts/replay-harness.mjs', '--self-test'],
 ['static-smoke', 'scripts/smoke-three-days.mjs', '--report', path.join(out,'static-smoke.json')]
];
const results=[];
for (const [name,...args] of tests) {
  const run=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'});
  writeFileSync(path.join(out,name+'.log'),(run.stdout||'')+'\n'+(run.stderr||''));
  results.push({name,exitCode:run.status});
  console.log(JSON.stringify(results.at(-1)));
}
writeFileSync(path.join(out,'summary.json'),JSON.stringify(results,null,2));
if(results.some(r=>r.exitCode!==0))process.exitCode=1;
