# 当前状态

**更新时间：** 2026-10-14  
**基线：** `zfarm-world-1.0` 文档基线；工作树存在未提交运行时变更  
**状态：** active

## 可验证事实

- 当前游戏是 Web/Canvas 竖切片，规则、UI 和内容注册仍主要位于 `dist/index.html`。
- 已有昼夜循环、SAN、事件账本、内容注册表、统一效果 reducer、保存迁移、计划会和 replay harness。
- 设计基线采用 day14 最终尸潮，正常结算窗口为 day12–16。
- 长期路线已扩展为 v82–v85 游戏完成、v86 GameCore、v87 受限首脑、v88 评测、v89 优化、v90 开源。
- Colab T4 只作为可恢复批量实验节点；轻量云服务器承担实验控制面、队列、结果索引和轻量 dashboard，不承担大模型推理。

## 当前工作树注意事项

- 代码、交接文档、夹具和 validator 已统一到 `SAVE_VERSION=21`、`CONTENT_SCHEMA_VERSION=3`；v82 接入 NPC 属性、英雄状态和 `npcRoster` 迁移默认值，v83 前置切片接入据点守军人口账本与每日 upkeep。
- 当前运行时仍是竖切片：英雄晋升条件、指挥点消耗、岗位效率、角色卡展示、岗位继任、据点固定人口占用、守军死亡释放和每日维护已接入；完整十人主动技能、据点捕获 UI、势力奖励和最终尸潮仍待补齐。
- NPC 个人事件在结算前会重新检查活动状态；死亡/失踪事件会取消并写账本，队列会继续寻找可用 NPC，不再被失效首项卡住。

## 最近验证

- `node scripts/check-night-guard.mjs`：通过。
- `node scripts/replay-harness.mjs --self-test`：通过，8 个夹具，当前 hash `1a0b69b8`；覆盖五日 NPC 晋升/暂代、死亡 NPC 事件取消和据点守军 upkeep 投影。
- `node scripts/validate-content.mjs`：通过，SAVE21/CONTENT3 已对齐。
- `node scripts/smoke-three-days.mjs`：50 项通过；Playwright 本机不可用，服务器真实浏览器已覆盖关键闭环。
- GitHub draft PR `#4` 已创建，GitHub Actions workflow 通过；Sites 生产仍保持原版本。
- 服务器真实浏览器 smoke 已通过 22 项，覆盖 NPC 角色卡与首日晋升门控、夜间总结、回到白天和刷新后继续存档，记录在 `docs/qa/server-playtest-20261014.md`；线上 Sites 可公开访问，但浏览器插件对大型 Canvas 页面仍会超时。
- 服务器 80 端口由 `zfarm-v82.service` 托管，systemd `enabled/active` 均已验证。

