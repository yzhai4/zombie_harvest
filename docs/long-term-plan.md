# 尸潮农场长期计划与双主线成果

## 当前P0检查点：self 首步（2026-10-17）

NPC 首谈已通过真实 Gate 绑定 self 知识与披露，另修复负信任使晋升进度越过存档下界；源码3213db16／HTMLc42056ed，source104／独立19／实际Chrome336，见[QA](qa/npc-self-observation-v1-20261017.md)。未接LLM、未加保存域、未部署生产。

下一步继续完整感知和知识授权，包含直接视野、历史联系人来源／TTL与共享边界，再进入NPC规划、EventFact／记忆和生成表达。self不是完整ActorObservation验收；全局生命一致性与既有晋升事件重复仍开放。P0–P6、GameCore抽离、UI素材与更大世界／多个副本、特殊角色连续性的目标不变；自然多日和玩家体验保留独立出口。

## 历史P0检查点：C2（2026-10-17）

C1+C2 已完成声明支持矩阵的开发验收，源码 a544a6139e19c21f89526e3aafed11162d885552／HTML61ea64b2，见[C2 QA](qa/scenario-boot-c2-20261017.md)。真实初始绑定、闭合 JSON 编译、私有候选目录一次提交、独立内容绑定与已知 C1 兼容已接线；源码 40 unique 合同有通过结果（123 次执行／108 pass／15 原 fail 保留），Chrome102＋关联361 同构建通过。只覆盖已声明配置轴和一节点两终态选择语法，任意图、Scenario Studio、多版本内容及新配置轴仍为后续能力。

下一 P0 是 ActorObservation 的实际 actor／perception 授权，再接 NPC 规划、记忆和 LLM 表达；只读 expression 不是角色知识权限。本片未跑新 natural，休整 hidden 仍 unavailable；自然三日、玩家实验和生产分别验收。最终证据 HEAD 的 exact CI 待核，不声明远端 ref 已更新。大世界／多个副本和特殊角色连续性目标不变。

**计划版本：** 1.1  
**游戏基线：** `zfarm-world-1.0` / `SAVE_VERSION=21` / `CONTENT_SCHEMA_VERSION=3`  
**长期目标：** 《我是大救星》形成会记住、会反应、会产生持续后果的世界；《尸潮农场》作为第一个副本，逐步支持更大地图、更多交互、可复用Scenario Studio及特殊角色的跨副本连续性。同时沉淀可回放、可验证、可插拔的世界运行时和离线评测工具。

## 当前优先级与路线解释（2026-10-17）

按[深度调研落地计划](research/research-adoption-plan-20261017.md)推进：据点在场、有意义时间推进／断粮选择及 C1+C2 支持范围已有各自证据，接下来补角色知识投影。自然多日与体验仍是独立出口。每个新切片继续以真实调用、旧档、回放和当前构建浏览器验收，尚未完成的功能不由设计文档提升为已实现。

P0–P6是能力与证据依赖；下方v82–v90是交付包，不能理解为必须等v88才建遥测、等v86才守模块边界，或先上线领袖LLM再验证规则规划/记忆。评测从P0开始，规则NPC、EventFact与关系先于生成表达。当前十人、小地图和试验少量持久角色不是最终规模限制；引擎、平台、多人、模型供应商和最终角色规模仍待验证。learned World Model保留为P6条件性研究，用exact simulator作基线。

后续逐次checkpoint保留历史时点；其中“下一步”和计数不覆盖本节、当前状态与证据manifest。

## 北极星架构

作者定义世界规则、事件图、势力能力和叙事边界；规则运行时负责状态、权限和结算；LLM 首脑只产生结构化意图；离线实验器负责重复副本、指标分析和候选版本比较。

```text
GameState -> EventLedger -> ObservationProjection
                         -> RolePlanner -> IntentGate -> Reducer/Executor
EventLedger -> Replay / Debugger / Metrics -> Playtest / Evolution
```

必须保持以下不变量：

- 所有跨系统状态变化走命令、reducer 和事件账本；LLM 不直接修改 `GameState`。
- deterministic模式固定 `seed + worldConfig + scenarioVersion + gameVersion/contentVersion + aiConfig/policyVersion + input/time trace` 后，产生相同真实状态和canonical replay hash；生成文本可不同，但不改变规则事实。C1+C2 boot 已在列明支持矩阵与夹具范围验收；现有回放不证明任意配置、内容图或所有未来路径等价。
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


### v82 browser smoke 补充（2026-10-16）

当前 dist 已完成本地 loopback browser 启动、新局创建、昼间推进到实时战况的真实 DOM smoke；下一步仍需服务器/浏览器多日自然回归，不能把这次短 smoke 扩大为平衡证据。


## 2026-10-16 事件战斗清理收口

白天战斗闭环已覆盖成功结算、排队事件切换和资源不足拒绝三条路径；resolve 只在原事件进入 terminal handled 状态后清理 sourceEventId 敌人。下一步优先消除 inline 与 Node 版 CombatIntentV1 validator 的双份实现，再推进 EventInstance 的 instance/node/version CAS；在此之前不扩大为领袖 LLM 生产接线或多日自然回归已完成。


### v82 事件身份 CAS 补充（2026-10-16）

事件链迁移先落一个窄边界：UI 与规划器必须携带 `EventInstance` 的 instance/definition/version/event 四元 token，统一 resolver 在效果前比较并拒绝陈旧命令；成功、非 terminal 拒绝和 CAS 冲突使用不同 receipt，清理只由原实例的 terminal handled 触发。当前白天源回归 17/17，覆盖成功、资源拒绝、排队激活、旧实例、版本冲突和 UI token。这个切片不等同于完整 EventDef precondition evaluator，也不改变 SAVE21/CONTENT3、Sites 或生产 LLM 接线；下一入口是把 Gate/precondition 与独立 validator 收敛到 GameCore，再做自然多日 browser。


### v82 GateV1 事件门禁补充（2026-10-16）

先把已有 EventDef/EventInstance/Choice/Effect/Gate 的语义收敛到一个可验证的只读 GateV1 适配器，再扩大内容迁移。GateV1 只对显式 gateVersion: 1 或 evaluatePreconditions: true 的定义生效；旧事件继续使用原 reducer-specific gate，避免把未冻结的条件词汇误解释成新规则。SAN（NPC/玩家）和中继链是首批接线样本，Choice.requires 与 EventDef preconditions 共享同一 evaluator，CAS 先于 Gate，Gate 先于效果事务。

阶段出口补充：在相同 seed 下，SAN 阈值通过/拒绝、relay 缺失事实、未知/畸形条件、错误 phase、旧 EventInstance 和队列切换都必须有可回放拒绝；Gate 评估不能产生状态变化。下一步是把 GateV1 迁移到一个内容支线节点，并将 inline evaluator 与独立 GameCore 模块合并；在此之前不扩大到领袖 LLM 生产接线或 Sites 发布。

### v82 GateV1 parity checkpoint（2026-10-16）

水车支线的启动门和节点选择已接入 GateV1，但效果仍由既有 content-effect 事务 reducer 处理；这不是完整 EventInstance/CAS/EventEffect 迁移。随后新增纯只读 shadow evaluator 与 inline parity runner：CI #210（run 38902361281，job 116977448918）以权威源码 hash `bc85cbeab7f00236e7bde84f01d05596676b359fb66b077645103011810fb23d` 通过 GateV1 合同 7/7、共享夹具 parity 11/11、内容链 54/54、白天战斗 23/23 和 static smoke 55/55。生产 Sites v81 未部署，Python Playwright 不可用，因此没有新增自然多日浏览器证据。

本轮明确不把 relay-chain-001 的自治 `recover/stage/online` 元数据 choices 伪装成已接线 Gate；这些路径目前由地标 reducer 和 `updateRelayProject` 驱动。下一轮先设计 handoff 的显式 EventInstance 四元 CAS adapter，再评估状态/资源/距离是否值得扩展 Gate 词汇；任何迁移继续通过玩家、NPC、营地、势力、敌人和全局链六视角账本。

### v82 relay handoff CAS checkpoint（2026-10-16）

在 parity 之后，`handoffRelayCore` 已接入显式 EventInstance 四元 CAS：`expectedInstanceId`、`expectedDefId`、`expectedDefinitionVersion`、`expectedEventId` 随命令回放，校验顺序为 CAS → Gate → 长官/距离/物品业务校验 → 原 reducer。陈旧命令只产生 `command.rejected`，成功收据保留 token；正常交接仍使用原状态和奖励逻辑。

CI #217（run 38903415431，job 116980964278）以权威源码 hash `f018d6639d415426960add45220389535aa4010d58c1c631a055b8da62461f71` 通过 source-daytime-combat 24/24、GateV1 shadow 7/7、完整 inline/shadow fixture parity 11/11、内容链 54/54 和 static smoke 55/55。此切片没有把 relay 的自治施工/上线路径接入 Choice resolver，也没有部署 Sites v81；下一步是为正式 ContentChain/EventInstance 施工节点定义事务与幂等边界。

### v82 relay handoff UI and construction shadow checkpoint

The handoff CAS slice is now end-to-end for the actual context-menu producer: the rendered button carries the four identity fields, the adapter passes them to the CommandBus, and stale event tokens reject without state or reward mutation. CI #225 recorded 26/26 daytime checks; the runtime source hash is 1a5430620715363611914ad567f8b076253fbaa42bc200a10a93daf1bd53d463.

RelayConstructionV1 is currently a pure shadow contract, not a browser runtime migration. CI #231 records 11/11 for the state machine, CAS ordering, participant/resource prechecks, idempotency, rollback behavior and save/reload token. The next runtime decision is conditional on tracing a real construction command producer and defining the material-source and building-occupancy transaction; until then the autonomous updateRelayProject path remains the source of truth and Sites v81 stays unchanged.


### v82 relay construction shadow refinement

The construction boundary now includes stable `resourceSource` receipts and a one-time terminal `stationOnline` guard. The 13/13 shadow contract is a pre-migration specification, not a release. The next iteration should trace the actual construction producer and introduce the smallest transaction reducer that preserves existing relay behavior while making CAS, resource ledger, occupancy, event receipts, and replay ordering explicit.

### v82 relay transaction shadow checkpoint（2026-10-16）

producer trace 之后，RelayConstructionTransactionV1 先以纯值形式固定跨对象事务边界。CI #253 的 11/11 覆盖 prepare/apply/receipt/rollback、资源与材料一致性、建筑占位、NPC participant snapshot、重复命令和终态单次语义。
这一步为后续 GameCore/reducer 接线提供可回放的输入输出合同，但不改变 `dist/index.html`、SAVE21/CONTENT3 或 Sites v81。下一步必须先把真实 producer 接入统一 CommandBus，再补 EventLedger、SAVE 迁移、同 tick 战斗顺序和 browser save/reload fixture；在此之前不把 relay choices 的元数据当成已执行 Gate。

### v82 relay runtime stage checkpoint

已完成一轮最小真实接线：`world.advance` 在 opt-in flag 下生成 `RelayConstructionTransactionV1` stage child，CAS、岗位预检、replay/idempotency、成功后 station occupancy 与 save/reload token 均有八项 VM 夹具。flag-off 与旧路径保持等价，EventDef 的两个 `relay.projectAdvance` metadata choice 断言仍保留。

本轮不迁移资源/材料、building/online、standing/forecast、完整 SAVE schema 或 Sites v81。下一闸门是把资源来源账本与 building→online 事务接上，再做同 tick CombatIntent、旧存档迁移和浏览器 save/reload fixture。

## v82 runtime stage checkpoint（2026-10-16）

本轮完成一个可回放的 feature-gated stage slice：`world.advance → CommandBus → advanceReducer → updateRelayProject` 在开发/夹具 flag 开启且项目为 `briefed` 时生成 `relay.projectAdvance` child command，执行 CAS、昼间与参与者预检，成功后一次性写入阶段事实、NPC 工作片段和 virtual station 占位；重复 command、坏 token、缺岗和快照冲突保持幂等/回滚。

CI #259（run `38921110774`）证据为 runtime 8/8、producer 9/9、RelayConstructionV1 13/13、事务 11/11、replay 15/hash `4aec7a31`、static smoke 55/55；源码 SHA-256 `9e8ee79f07ba0c204631ff13270e1e7a40292375e4a0e2a93cd0cd86a033227c`。该 flag 仅由开发/VM fixture 注入，默认关闭，不改变 Sites v81。

下一阶段按顺序推进：资源来源/材料扣除事务 → 建筑 footprint 与终态 online → scheduler/替代者 → standing/forecast 因果 → EventLedger/SAVE21 迁移 → browser save/reload 与同 tick 战斗夹具；每一步继续以六视角审计和固定 replay hash 为闸门。


## v82 竖切片与调研基线 checkpoint（2026-10-17）

本轮把“游戏性竖切片优先”落到可运行合同：中继施工继续作为行为锚点，新增版本化 JSON 场景包、schema/validator、SAVE21 兼容的 `scenarioSnapshot` 与观察者表达开关。场景解析和观察者目前是 headless fixture + 确定性 stub，不等同于完整 runtime loader，也不允许生成或写入 `GameState`。

CI #266（run `38932973787`，job `117081308370`）在 `d389365e960ba04685a4074e5c5485c034c4e922` 上通过：scenario 3/3、observer 2/2、source gameplay 2/2、relay producer 9/9、relay runtime 8/8、RelayConstructionV1 13/13、transaction 11/11、replay 18/hash `4aec7a31`、static smoke 55/55；`dist/index.html` SHA-256 为 `e34dc65b78d6e7223bbeda9c347cc3043cb98ef8cdb72c28d66bbb14f15b7b54`。

外部调研原文 `deep-research-report.md` SHA-256 为 `940EFAC9A98227DB2B4512771E474C8366B629D50D72D8E912923D83E2CF06EE`，仅作为设计输入：确定性 GameState/Simulator 是 Ground Truth；Scenario 包固定 seed/worldConfig/scenarioVersion/gameVersion/aiConfig；观察者只能解释披露；Director AI、完整自治社会和 World Model 延后。下一闸门是把断粮/缺岗 storylet 从 fixture 推进到真实 resolver/reducer，并为 observer 加白名单深冻结和 AI-OFF 对照夹具。

### v82.1 runtime storylet 重绑定（2026-10-17）

断粮节点已完成最小真实接线：`runWorldDayUpkeep` 的 `onDayStart` 会在 `foodSituation().ratio <= 1` 时通过 GateV1 启动 `zh-food-shortage-001`，UI 从 activeChains 展示选择，`resolveContentChainCommand` 统一进入 `applyContentEffects`。CI #268 将 source gameplay 夹具提升为 3/3，覆盖 ration 分支、campCollapse 变化和重复 command 幂等；源码 SHA-256 为 `c564c6b647588806ab8b2a9e4390d785b5245a6c3c9fb49fff286b4439fc956a`，行为提交为 `73b010a44077d4c89bb83fb09a8ebe08dfde4e54`。

这是一次性首轮危机节点，不宣称可重复 shortage episodes、完整缺岗 Gate、自然 browser 或生产 LLM。下一步单独处理 role availability/继任和可重复事件实例，避免把一次性 `completedChains` 当作长期危机调度。


### v82.1 role availability 重绑定（2026-10-17）

断粮 forage 选择现使用 GateV1 `role_available`，实际调用 `npcFulfillsRole`：NPC 阵亡、据点驻守或 actingRole 被转移时拒绝，恢复后才放行。CI #272 source gameplay 4/4，源码提交 `a8c3883741c9e1c49050675580b98b6c51c29862`，HTML SHA-256 `90c808b8ef33e7a67a982548605c322fe4a40cd7520b2b3f45302abee3b1a94b`。

该节点仍是一次性首轮 crisis；重复 episode、完整继任调度、自然 browser 和生产 LLM 保持未完成。


### v82.1 repeatable shortage episode 重绑定（2026-10-17）

断粮危机现在拥有最小可重复实例合同：`repeatable:true` 的链按 `chainId:day` 生成 `instanceKey`，效果去重和 completed 账本使用 episode key；同一天的重复启动被拒绝，跨日可再次触发。为了保护旧链回放，`instanceKey` 只出现在 repeatable 节点的 active/start/resolved/fallback 事实中。CI #275 保持旧 content-chain golden，并通过 source gameplay 4/4；源码提交 `9411847fc7bea874ffdd1bb2b723641cc495771f`，HTML hash `65825523f4c8a79a425fc3a8ce55dcbc9fae1296e49c3a3f5e898c52169f8070`。

这仍是单一断粮节点的 episode 试验，不等同于所有事件链都已 repeatable 化；下一步是把 episode key 纳入统一 EventInstance/SAVE migration 合同，再做真实 browser save/reload。
