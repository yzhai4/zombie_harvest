---
name: zombie-harvest-content
description: 为尸潮农场创建或修改主线、支线、NPC、势力、科技、建筑和武器内容，映射到现有注册表、统一效果与开发交接；用于本仓库内容迭代。
---

# 尸潮农场内容工作流

先读 `docs/overall-iteration-plan.md` 和 `docs/handoff/尸潮农场-开发交接包.md`，只加载本次内容对应的 `剧本/尸潮农场/01–09` 设计源与 `11–16` 模板。已评审剧本卡保存在 `docs/scripts/<stable-id>.md`，不能只添加对白或按钮逻辑。

## 创建内容

1. 选择稳定 ID、`contentVersion`、时间窗、触发/终止条件和可选挂载包；显示名称可改，ID 不复用。
2. 写玩家介入、营地自治、保守/冒险路线，以及 NPC 死亡、失踪、重伤、拒绝合作、人口不足、过期和跳过降级。
3. 写六视角账本：玩家、NPC、营地、势力、敌人、全局链；所有资源、岗位、人口和科技必须有来源。
4. 映射 `WEAPON_DEFS`、`EVENT_CHAIN_DEFS`、`NPC_STORY_DEFS`、`TECH_NODE_DEFS`、`BUILDING_DEFS`、`FACTION_DEFS`、`OUTPOST_DEFS`、`NPC_ROLE_DEFS`。效果只走统一 reducer，不直接修改全局对象或按钮回调。
5. 需要 schema 变更时先提出状态/保存/回放契约，提供安全默认值、迁移和幂等策略；内容效果失败必须回滚。

## 本副本不变量

- day14 基准，最终尸潮正常窗口 day12–16；营地存在需核心耐久有效、活动 NPC≥3、`campCollapse<90`。
- roster 固定；死亡不补人、据点守军从现有人口扣除。
- 玩家初始 trust=0、commandPoints=0；每日点数不累积，英雄未达条件不可直接调度。
- 普通 NPC 按职责状态机工作，英雄必须提供可观察系统价值。
- 新武器有克制和弱点，单件不超过20%全局战斗增益；超模效果绑定代价。
- 支线可跳过且不阻塞主线；夜间拒绝白天命令。
- 相同 seed/input/contentVersion 可确定性回放。

## 验证与交接

运行 `node scripts/validate-content.mjs`、`node scripts/check-night-guard.mjs`、`node scripts/smoke-three-days.mjs`、`node scripts/replay-harness.mjs --self-test`；记录浏览器可用性、回放哈希、旧档迁移、NPC死亡/人口不足、夜间边界和实体预算。新增/修改内容后更新剧本卡、验收表与交接文件，注明已实现/设计冻结/待开发。

设计负责因果、分支、数值目标和六视角；开发负责状态、reducer、UI、保存、回放和性能；共同维护 schema、ID、迁移与验收。此 Skill 不授权外部发布、发消息或引擎迁移。

## 内容包挂载

内容包定义不随存档保存。启动时按项目内容清单重新注册并校验 `contentVersion`；缺包要安全降级、不执行缺失链、不发放奖励，并写入 `content.pack.missing` 日志。新增内容交接必须同时提交定义、文本/资源清单和启动注册清单。

## 当前运行时边界

本 Skill 生成的设计 ID 默认是“设计冻结/待注册”，除非 `dist/index.html` 的注册表和交接包明确标为已接线。当前 v81 已接入 `campTrust`、`commandPoints`、`planMeeting`、内容 schema v3、SAVE21 迁移和回放投影；v82 已接入 NPC 属性默认值、英雄晋升入口、`npcRoster` 和岗位继任投影，但完整十人主动技能、死亡/失踪/重伤/拒绝合作分支仍需逐轮接线。14 天最终尸潮、全量支线和动态表现仍需逐轮接线。剧本卡必须标记“已接线/设计冻结/待开发”，不得把设计定义当成运行时能力。

## 版本对账与发布边界

线上 Sites、Sites 源仓库和 GitHub 镜像可能处于不同提交。每轮先记录三者版本，不得用旧 GitHub `main` 覆盖线上。若 Sites Git endpoint 或本地 `.git` 不可写，使用 GitHub API 在独立分支创建 blob/tree/commit，并通过 draft PR 审阅；不要强行更新 `main` 或生产版本。公开 issue/PR 只写可公开的项目事实，凭据、内部路径和运行环境细节留在本地交接记录。

## 长期记忆与 AI 边界

内容迭代结束后，按 `docs/project-memory.md` 判断新增信息属于规则真相、架构决策、问题记录还是实验记录；不要把未验证的聊天结论写成运行时能力。新增内容若给 AI 首脑使用，必须声明观察字段、可用意图、资源预算、期限、拒绝原因和规则 fallback。LLM 只能生成候选意图或解释文本，不能绕过内容注册表、统一 reducer、night guard、人口守恒或回放契约。



## 场景包内容合同（2026-10-17）

新增故事、NPC、势力或营地事件时，同时更新版本化 JSON 包与设计卡。每个 storylet 必须有 stable ID、触发条件、fallback 及玩家/NPC/营地/势力/敌人/全局链账本。未知引用、循环、不可满足门槛和无 AI-OFF 路径需要分层校验；当前轻量JSON validator只核基础合同，不能据此宣称这些完整校验均已实现。内容包当前先以 headless fixture 验证，未由启动路径实际加载并记录 scenarioVersion/contentVersion 前，标记为设计冻结/fixture。

Observer 台词只能读取白名单事实并生成表达/披露；不能改资源、人口、敌人、事件或存档。需要 AI 时同时提供规则 fallback、预算和拒绝回执，并在 manifest 中区分 browser 与 source-VM。

## 可重复内容合同（2026-10-17）

新增可重复故事时，必须在 JSON 包和设计卡声明 `repeatable` 与稳定 episode key，区分一次性 `completedChains` 与按 episode 的账本。效果必须通过统一 reducer/CommandBus 并以 episode key 做去重；同日重复不得重复奖励，跨日重开要有可回放事实。若只实现单个内容的试验，不得声称所有 EventDef 已完成 repeatable/SAVE 迁移。
