# 当前状态

**更新时间：** 2026-10-13  
**基线：** `zfarm-world-1.0` 文档基线；工作树存在未提交运行时变更  
**状态：** active

## 可验证事实

- 当前游戏是 Web/Canvas 竖切片，规则、UI 和内容注册仍主要位于 `dist/index.html`。
- 已有昼夜循环、SAN、事件账本、内容注册表、统一效果 reducer、保存迁移、计划会和 replay harness。
- 设计基线采用 day14 最终尸潮，正常结算窗口为 day12–16。
- 长期路线已扩展为 v82–v85 游戏完成、v86 GameCore、v87 受限首脑、v88 评测、v89 优化、v90 开源。
- Colab T4 只作为可恢复批量实验节点；轻量云服务器承担实验控制面、队列、结果索引和轻量 dashboard，不承担大模型推理。

## 当前工作树注意事项

- 代码、交接文档、夹具和 validator 已统一到 `SAVE_VERSION=21`、`CONTENT_SCHEMA_VERSION=3`；v82 新增 NPC 属性、英雄状态和 `npcRoster` 迁移默认值。
- v82 当前仍是运行时竖切片：英雄晋升条件、指挥点消耗、岗位效率、角色卡展示和岗位继任投影已接入；完整十人主动技能/死亡分支仍待补齐，五日晋升与岗位替代夹具已接入。

## 最近验证

- `node scripts/check-night-guard.mjs`：通过。
- `node scripts/replay-harness.mjs --self-test`：通过，6 个夹具，当前 hash `afa81420`；五日夹具覆盖 `carpenter` 晋升与 `sergeant -> commander` 暂代。
- `node scripts/validate-content.mjs`：通过，SAVE21/CONTENT3 已对齐。
- `node scripts/smoke-three-days.mjs`：43 项通过；Playwright 不可用。

