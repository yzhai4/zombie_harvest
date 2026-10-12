#!/usr/bin/env node
/**
 * Static contract checker for the data-driven content extension layer.
 *
 * This intentionally does not execute the browser bundle. It catches missing
 * registries, effect operations, migration wiring, and required authoring
 * templates before a content change reaches a browser smoke test.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = path.join(ROOT, 'dist', 'index.html');
const CONTENT_DIR = path.join(ROOT, '剧本', '尸潮农场');

const source = readFileSync(SOURCE_PATH, 'utf8');
const issues = [];
const checks = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok: !!ok, detail });
  if (!ok) issues.push(`${name}${detail ? `: ${detail}` : ''}`);
}

function has(pattern) {
  return pattern instanceof RegExp ? pattern.test(source) : source.includes(pattern);
}

const registryNames = [
  'WEAPON_DEFS',
  'EVENT_CHAIN_DEFS',
  'NPC_STORY_DEFS',
  'TECH_NODE_DEFS',
  'BUILDING_DEFS',
  'FACTION_DEFS',
  'OUTPOST_DEFS',
  'NPC_ROLE_DEFS',
];

for (const name of registryNames) {
  check(`registry:${name}`, has(new RegExp(`(?:const|let|var)\\s+${name}\\s*=`)));
}

for (const operation of [
  'addResource',
  'adjustMeter',
  'modifyRelation',
  'unlockTech',
  'unlockWeapon',
  'scheduleEvent',
  'assignJob',
  'damageBuilding',
  'captureOutpost',
  'recordHistory',
]) {
  check(`effect:${operation}`, has(new RegExp(operation)));
}

for (const marker of [
  'contentVersion',
  'CONTENT_SCHEMA_VERSION',
  'function migrateContentState',
  'contentState',
  'function validateContentDefinition',
  'function registerContent',
  'function applyContentEffects',
  'function startContentChain',
  'function resolveContentChain',
  'function resolveContentFallback',
  'function resolveContentAutonomy',
  'function runContentHook',
  'rolledBack: true',
  'triggeredEvents',
  'outpost-guard-slots',
  'ContentRegistry',
  'PLAN_DEFS',
  'PLAN_VOTE_PROFILES',
  'commandPoints',
  'planMeeting',
  'generatePlanMeeting',
  'commitPlanMeeting',
  'executePlanMeeting',
  'refreshCommandPoints',
  'SAVE_VERSION = 20',
  'worldMeta.events',
  'worldMeta.replay',
]) {
  check(`runtime:${marker}`, has(marker));
}

const requiredDocs = [
  '01_整体世界观与叙事法则.md',
  '02_14天时间线与最终尸潮.md',
  '03_主线事件链总图.md',
  '04_支线事件链总图.md',
  '05_势力营地与敌人多视角.md',
  '06_NPC英雄晋升与普通NPC体系.md',
  '07_计划会与commandPoints.md',
  '08_战斗武器技能建筑科技统一规则.md',
  '09_数值、性能与实体预算.md',
  '11_扩展接口与内容规范.md',
  '12_武器模板.md',
  '13_支线事件模板.md',
  '14_NPC剧情模板.md',
  '15_科技建筑模板.md',
  '16_扩展内容验收表.md',
];

check('content-directory', existsSync(CONTENT_DIR) && statSync(CONTENT_DIR).isDirectory());
for (const file of requiredDocs) {
  const filePath = path.join(CONTENT_DIR, file);
  const exists = existsSync(filePath) && statSync(filePath).isFile();
  check(`template:${file}`, exists && readFileSync(filePath, 'utf8').trim().length > 80);
}

const projectDocs = [
  path.join(ROOT, 'docs', 'overall-iteration-plan.md'),
  path.join(ROOT, 'docs', 'handoff', '尸潮农场-开发交接包.md'),
  path.join(ROOT, 'docs', 'design-reference-evidence.md'),
  path.join(ROOT, '.codex', 'skills', 'zombie-harvest-content', 'SKILL.md'),
];
for (const filePath of projectDocs) {
  const relative = path.relative(ROOT, filePath);
  const exists = existsSync(filePath) && statSync(filePath).isFile();
  check(`project-doc:${relative}`, exists && readFileSync(filePath, 'utf8').trim().length > 200);
}

const result = {
  runner: 'validate-content',
  ok: issues.length === 0,
  checks,
  issues,
  source: path.relative(ROOT, SOURCE_PATH),
  contentDirectory: path.relative(ROOT, CONTENT_DIR),
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;

