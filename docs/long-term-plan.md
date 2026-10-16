# 尸潮农场长期计划与双主线成果

**计划版本：** 1.0  
**游戏基线：** `zfarm-world-1.0` / `SAVE_VERSION=21` / `CONTENT_SCHEMA_VERSION=3`  
**长期目标：** 完成可玩的尸潮农场，同时沉淀一个可回放、可验证、可插拔的世界运行时，以及一套用于游戏平衡和事件链探索的离线实验工具。

## 北极星架构

作者定义世界规则、事件图、势力能力和叙事边界；规则运行时负责状态、权限和结算；LLM 首脑只产生结构化意图；离线实验器负责重复副本、指标分析和候选版本比较。

```text
GameState -> EventLedger -> ObservationProjection
                         -> RolePlanner -> IntentGate -> Reducer/Executor
EventLedger -> Replay / Debugger / Metrics -> Playtest / Evolution
```

必须保持以下不变量：

- 所有跨系统状态变化走命令、reducer 和事件账本；LLM 不直接修改 `GameState`。
- 相同 `seed + input + contentVersion` 在 deterministic 模式下产生相同状态和 replay hash。
- LLM 只能输出声明过的意图；权限、阶段、资源、知识范围、冷却和实体预算由 Gate 判断。
- 运行时不生成无来源的剧情节点、人口、资源或能力；自由文本只作为解释或表现层输出。
- 在线游戏使用低频战略决策，逐 tick 移动、寻路和战斗由确定性执行器或训练好的低延迟策略负责。

## 阶段路线

### v82：完整 NPC 与继任

完成 NPC 属性、SAN、英雄晋升、死亡/失踪/重伤/拒绝合作、岗位替代和个人事件链。每名 NPC 的系统价值必须能在账本、投票、生产或战斗中观察到。

**阶段出口：** 固定人口守恒、死亡降级、岗位替代、旧档迁移和五日回放夹具通过。

### v83：科技、建筑、据点与支线

接入科技、建筑、守军、补给距离和首批支线。所有蓝图和据点效果继续使用内容注册表与统一 reducer。

**阶段出口：** 新内容只需注册即可加载；缺包安全降级；不存在重复派驻、凭空造人和半套奖励。

### v84：最终尸潮与多结局

接入 day12–16 尸潮窗口、四类结局、二周目直达和最终危机的多因素强度计算。

**阶段出口：** 四类结局、固定 seed 回放、人口不足、核心损坏、英雄缺席和跨日边界全部有夹具。

### v85：表现与发布验收

完成动态卡片、资源挂载、动画、音效、实体预算、移动端布局和发布交接。

**阶段出口：** 浏览器 smoke、性能记录、旧档迁移、发布版本对账和可恢复回滚完成。

### v86：GameCore 模块化

把目前 `dist/index.html` 中的规则拆成可独立测试的 `GameState`、`CommandBus`、`Reducer`、`EventLedger`、`ContentRegistry` 和 `ReplayRunner`。Web/Canvas 保持为第一渲染适配器。

**阶段出口：** 无 UI 的 headless runner 可以运行一局并导出事件轨迹、结局、指标和 hash。

### v87：受限势力首脑模式

先把营地计划会接入一个可替换的 `RolePlanner`，再接入母巢首脑。规划器输出 `Intent`，不输出状态补丁。

领袖 LLM 采用双层 harness：刚性层由观察投影白名单、角色/阶段/资源/人口/实体/时间 Gate、注册 command 白名单、统一 CommandBus、幂等回执、回放和进程预算负责；软性层只约束角色价值、风险偏好、信息不确定性、记忆摘要和叙事表达。软性取舍可以由领袖自由调整，刚性规则不能由提示词、理由或新命令名称绕过。模型不可用时回退到同一角色的确定性规则 planner。具体合同见 `docs/decisions/ADR-20261014-leader-llm-harness.md`；当前已通过 ProjectionV1/IntentEnvelopeV1/GateReport 6/6、离线 replay/idempotence/fallback sandbox 5/5 及 headless ledger adapter 6/6，仍未接入生产 runtime。

首批意图：`support_proposal`、`modify_plan`、`probe_route`、`issue_horde_order`、`split_squad`、`retreat_order`。每个意图都有能力声明、观察权限、资源预算、期限、取消条件和 fallback。

**阶段出口：** 规则 AI、受限 LLM、越权对照组在相同 seed 下可比较；所有拒绝和回退可解释、可回放。

### v88：Gameplay Evaluation Lab

建立 headless 批量运行、固定 seed、策略基线、事件链覆盖、节奏指标、成本统计和报告导出。先做评测，再做自动改规则。

**阶段出口：** 一条命令完成多策略、多 seed 运行，并生成可提交的 JSON/CSV/Markdown 报告。

### v89：受约束的设计优化

允许实验器搜索数值、冷却、波次、事件权重和有限 prompt 变体。候选必须经过 schema、回放、held-out seed 和人工剧情检查。

只有更新了策略模型参数，才将结果称为 RL；只改 prompt、规则、记忆或参数时称为 black-box design optimization 或 LLM-guided playtest。

### v90：插件化与开源

拆出三类可复用组件：

- `event-chain-core`：事件、命令、Gate、事务 reducer、回放。
- `role-agent-runtime`：观察投影、结构化意图、模型适配、记忆和成本统计。
- `gameplay-eval-lab`：headless runner、指标、参数搜索和报告。

游戏仓库保留完整示例和内容；通用组件使用独立版本、API 文档、最小示例和许可证说明。

## 双主线职业成果

### AI/Agent 工程主线

- 结构化角色意图与工具调用。
- 权限 Gate、观察投影、记忆压缩和模型适配。
- 可回放轨迹、成本/延迟统计和离线评测。
- 多策略比较和受约束的设计优化。

### 游戏玩法/系统程序主线

- 自主运行的势力、NPC 需求、昼夜和尸潮系统。
- 固定人口、岗位继任、关系、SAN 和多结局。
- 事件账本、确定性 reducer、存档迁移和性能预算。
- 自动 playtest、节奏分析和平衡回归。

每个简历数字必须来自 `docs/experiments/` 或发布报告，不用未经记录的估计值。

## 长期暂停或回退条件

- 连续两轮无法保持 replay 一致：暂停扩大内容，先修状态边界。
- LLM 越权、幻觉或成本异常：切回规则规划器，不阻塞游戏主线。
- headless 指标与人工体验相反：保留数据，停止自动调参，增加人工评审集。
- Colab 任务被回收：从 checkpoint 和 manifest 恢复，不把 notebook 状态当作唯一实验记录。


### v87 迁移闸门补充（2026-10-15）

领袖双层 harness 的离线与桥接证据已齐：ProjectionV1/IntentEnvelopeV1/GateReport 6/6、replay/idempotence/fallback 5/5、headless ledger adapter 6/6、CommandBus bridge 5/5、真实 reducer bridge VM 6/6。真实 VM 同时确认当前生产执行者仍为 `player-1`，因此先新增 proposed `ADR-20261015-leader-save-replay-migration.md`，定义未来 leaderRuntime 的最小持久化字段、保留窗口、迁移失败等级、回放 hash 和 actor 兼容策略；在迁移夹具与评审通过前，不改 SAVE21/CONTENT3、不接线上 LLM、不发布 Sites。


### v82 白天战斗闭环补充（2026-10-15）

昼间 combat gap 已以最小闭环修复：`runDayCombat` 在 `advanceReducer` 的移动后执行，NPC/塔/活动敌人按 Gate、范围、LOS、cadence 写入统一 `combat.damage.applied` 收据；塔有注册化战斗属性和安全耐久默认；夜潮仍独立。新增 ADR `ADR-20261015-daytime-combat.md`、问题记录 `PROB-20261015-daytime-combat-gap.md` 和 `check-daytime-combat.mjs`（10/10）。当前已接入独立 schema、正反夹具、内部稳定批处理、敌人→防御建筑目标、replay hash 和重复 world.advance 幂等；已新增 `scripts/lib/combat-intent-v1.mjs` 作为独立 normalize/validate/sort/canonical 模块；下一步是让 GameCore/运行时直接消费该模块，继续补命令级幂等的独立 reducer 证据，并进入真实 browser 多日回归。
