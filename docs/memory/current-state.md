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
- 当前运行时仍是竖切片：英雄晋升条件、指挥点消耗、岗位效率、角色卡展示、岗位继任、据点固定人口占用、守军死亡释放、每日维护、已发现据点的最小捕获入口和 active content chain 事件面板已接入；完整十人主动技能、势力奖励、科技/建筑动态卡片和最终尸潮仍待补齐。
- NPC 个人事件在结算前会重新检查活动状态；死亡/失踪事件会取消并写账本，队列会继续寻找可用 NPC，不再被失效首项卡住。
- 注册链事项选择器、全选项、结果回执已经接线；成功效果后写权威节点，optional resolvedNodeIds 保留完整结算事实。注册/UI/reducer 拒绝坏 requirements，长循环、失败回滚、重复命令与恢复有真实源码执行证据。

## 最近验证

- `node scripts/check-night-guard.mjs`：通过。
- `node scripts/replay-harness.mjs --self-test`：通过，9 个夹具，当前 hash `4aec7a31`；覆盖五日 NPC 晋升/暂代、死亡 NPC 事件取消、据点守军 upkeep 和 `watermill-002` active-chain 投影。
- `node scripts/check-content-chain.mjs`：43 项通过；真实源码命令轨迹 hash `c5d6c772`，与保存投影分开；含22节点循环与中间节点 JSON 恢复。
- `node scripts/check-inline-syntax.mjs`：通过；项目 iteration Skill 的 UTF-8 quick_validate 通过。
- `node scripts/validate-content.mjs`：通过，SAVE21/CONTENT3 已对齐。
- `node scripts/smoke-three-days.mjs`：55 项通过；Playwright 本机不可用，服务器真实浏览器已覆盖关键闭环。
- GitHub draft PR `#4` 维护该切片；workflow 本轮加入源码执行、night/content、保存投影和静态 smoke，最终检查状态以该 PR 为准。Sites 生产仍为公开 v81（HTTP200），未用 GitHub 分支覆盖线上。
- 服务器真实浏览器 smoke 已通过 22 项，覆盖 NPC 角色卡与首日晋升门控、夜间总结、回到白天和刷新后继续存档，记录在 `docs/qa/server-playtest-20261014.md`；线上 Sites 可公开访问，但浏览器插件对大型 Canvas 页面仍会超时。
- 事件链独立浏览器夹具回归24项通过：水车双路线、结果/双击、切换、刷新、坏项、Gate、第3选择和390px布局，详见 `docs/qa/server-content-chain-20261014.md`。该证据不是自然四日通关；自然多日 smoke 仍待补齐。
- 服务器 80 端口由 `zfarm-v82.service` 托管，systemd `enabled/active` 均已验证。

## 下一轮入口

保持 SAVE21/CONTENT3。优先补自然多日 browser smoke 与缺包启动诊断，再接科技/建筑动态卡及水车供水/工时/缺岗分支。不要把保存投影、静态 smoke 或未使用的 watermill_t2 flag 当成完整能力。本轮新增问题/决策为 `PROB-20261014-content-chain-runtime`、`ADR-20261014-content-chain-receipts`；长期目标仍 active。

只读预审发现三日 browser runner 错把关闭可选遭遇报告当成 day+1；实际 world 钟独立推进，且尚无每日夜潮自动调度。先处理 `PROB-20261014-three-day-smoke-assumption`，新 runner 明确日历与遭遇两种证据，不直接改变游戏时钟语义。
