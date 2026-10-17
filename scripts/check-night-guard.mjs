import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');

function requirePattern(pattern, label) {
  if (!pattern.test(source)) throw new Error(`night guard check failed: ${label}`);
}

requirePattern(/const NIGHT_ACTION_MESSAGE\s*=\s*['"]尸潮进行中：当前只能移动和攻击/, 'shared night message');
requirePattern(/function actionCommand\([\s\S]*?guardNightAction\(options\)/, 'command entry guard');
requirePattern(/function gather\([\s\S]*?guardNightAction\(options\)/, 'resource entry guard');
requirePattern(/function repairBuilding\([\s\S]*?guardNightAction\(options\)/, 'repair entry guard');
requirePattern(/function resolveEvent\([\s\S]*?guardNightAction\(options\)/, 'event entry guard');
requirePattern(/function startThreatEncounter\([\s\S]*?guardNightAction\(options\)/, 'threat entry guard');
requirePattern(/function commitPlanMeeting\([\s\S]*?if\s*\(state\.night\)\s*return\s*\{\s*ok:\s*false,\s*reason:\s*['"]night-lock/, 'plan meeting night guard');
requirePattern(/function renderContext\([\s\S]*?if\s*\(state\.night\)[\s\S]*?contextActions.*?data-context-action="attack"/, 'night context menu isolation');
requirePattern(/\$\('contextActions'\)\.addEventListener\('click',[\s\S]*?state\.night && action !== 'attack'/, 'legacy context click guard');
requirePattern(/function resolveNpcEvent\([\s\S]*?if\s*\(!npcIsActive\(npc\)\)[\s\S]*?npc\.event\.cancelled/, 'inactive NPC event degradation');
requirePattern(/function activateQueuedNpcEvent\([\s\S]*?for\s*\(const next of queued\)[\s\S]*?cancelReason\s*=\s*['"]npc-inactive/, 'queued NPC cancellation cannot wedge event slot');
requirePattern(/record\.status\s*!==\s*['"]cancelled['"][\s\S]*?record\.status\s*=\s*['"]resolved['"]/, 'cancelled NPC event remains cancelled');
requirePattern(/function appendMissingExpansionContent\([\s\S]*?const occupiedCell[\s\S]*?CAMP_AREAS/, 'expansion occupied registry');
requirePattern(/const impactPosition\s*=\s*battleEnemyPosition\(enemy\)/, 'battle lane projection');

console.log('night guard checks passed');

