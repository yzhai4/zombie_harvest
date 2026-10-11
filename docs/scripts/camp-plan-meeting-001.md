# camp-plan-meeting-001：营地自治计划会

- **内容版本：** `zfarm-world-1.0` / `contentVersion: 1`（事件内容版本；运行时 `CONTENT_SCHEMA_VERSION=2`）
- **实现目标：** v81
- **状态：** v81 runtime 已接线；候选/投票/commandPoints/玩家提交/自治执行、存档迁移、回放投影和计划会 UI 已进入开发基线；完整 NPC 晋升、势力外交和多结局效果仍按 v82–v85 继续扩展
- **类型：** `system` / `autonomy`，可重复的每日事件链
- **稳定 ID：** `camp-plan-meeting-001`
- **时间窗：** day 2 起每日一次；`SUMMARY` 生成候选，次日 `DAY` 提交并执行，`NIGHT` 后结算
- **设计来源：** `剧本/尸潮农场/01–09`、`11_扩展接口与内容规范.md`、`14_NPC剧情模板.md`、`16_扩展内容验收表.md`

## 体验承诺

玩家进入营地时只是陌生人。每天夜间，幸存英雄依据岗位、需求、关系和威胁判断营地第二天最该做什么；玩家可以在取得足够信任后支持、否决或改写一个提案，但不能接管所有 NPC 的工作。计划会让自治变成可观察的系统：玩家能看到谁提案、谁投票、花费什么、获得什么、承担什么风险，以及自己不干预时营地会如何选择。

计划会不改变 `DAY → NIGHT → SUMMARY → DAY` 主循环。候选只在总结阶段生成，白天开始才刷新 `commandPoints`，白天队列执行计划；夜间拒绝白天命令，不在夜战中建造、采集、治疗或重新派岗。

## 参与者与世界因果

- **林岑 `commander`：** 目标是保住合法性和核心防线。存活且可行动时，对防御/外交提案有额外权重；缺席时由贺川主持，但不复制林岑的英雄调度权。
- **阿默 `radio`：** 倾向中继、研究和预警。激进的信号提案能提前发现尸潮，却会提高 `resonancePressure`。
- **苏禾 `doctor`：** 倾向医疗和防御，优先重伤者与药草账；重伤或拒绝合作时，医疗计划降级为伤员排序。
- **阿梁 `carpenter`：** 倾向防线、建筑和维修。缺席时只能由现有守卫执行低效率补墙，不能生成替身木匠。
- **贺川 `sergeant`：** 倾向防御和训练；无林岑时主持会议，并可把普通守卫编入换防。
- **周岚 `quartermaster`：** 倾向后勤、库存和低风险路线。她反对没有库存来源的冒险提案。
- **唐婶 `cook`：** 倾向农务、粮水和士气。她支持能让火堆和生产线持续的方案。
- **纪宁、陈野、蒋锋：** 普通 NPC 只提供岗位建议；晋升前没有英雄投票权。蒋锋的风险偏好可作为提案风险标签，但不能绕过晋升条件。
- **农场营地 `camp`：** 所有劳动、材料、建筑占位和人口都来自固定 roster 与既有库存。
- **红线猎队/河湾互助会：** 只有在提案包含外交或补给路线时读取已有关系，不凭空搬入农场人口；盟军火力只能是有次数、有时限的抽象支援。
- **黑土菌群与尸潮：** 信号增强、黑土研究和英雄死亡提高共鸣或特殊敌人概率；低噪声防御降低暴露，但会牺牲预警或研究速度。

## 状态与实例契约

计划会使用一个稳定的每日实例：

```text
instanceId = "camp-plan-meeting-001:d<day>"
eventId = "camp-plan-meeting-001"
contentVersion = 1
```

运行时建议新增/迁移以下字段，缺失时使用安全默认值：

```js
planMeeting: {
  instanceId: "camp-plan-meeting-001:d4",
  day: 4,
  phase: "summary_generated|day_committed|executing|resolved|expired",
  seed: "<run seed>",
  candidates: [],
  votes: [],
  chairNpcId: "linCen|heChuan|none",
  commandPointsAtDayStart: 0,
  commandPointsSpent: 0,
  playerOverride: null,
  autonomyResult: null,
  resolved: false
}
```

`livingRoster`、`workEligible`、`campLocal`、`garrisoned` 沿用全局人口契约；计划会不保存一份可造人的人口副本。英雄死亡、失踪、拒绝合作或离营后，下一次投票立即移除其权重。重伤 NPC 仍可投票，但权重减半且不能执行需要岗位的白天任务。

`commandPoints` 不是内容奖励，不在事件按钮中直接覆写。它由 `DAY` 生命周期 reducer 按 `campTrust` 阶梯刷新（0/2/2/3/4），每日不累积；`campCollapse≥70`、失信或英雄明确拒绝时扣减当日上限。所有刷新、消费和拒绝必须写入 `planMeeting` 历史与世界日志。

## 触发、节点和生命周期

### 节点 A：`summary_open`

- **触发：** 夜间总结锁定伤亡、资源、岗位和事件账本后，`day >= 2` 且核心尚未进入终局。
- **前置：** 若活跃 NPC 少于 3、核心耐久失效或 `campCollapse >= 90`，不生成白天计划，直接创建 `camp-collapse` 结算实例。
- **结果：** 读取存活英雄、岗位需求、库存、建筑损坏、`resonancePressure`、`campCollapse` 和待处理主/支线，创建本日候选列表；不执行任何白天效果。
- **可见信息：** 提案标题、提案人、票数预估、资源/工时成本、预计收益、风险、有效期、受影响岗位和缺岗提示。

### 节点 B：`candidate_build`

按固定种子从以下提案池生成最多三张候选卡；候选本身不改变状态，只声明可执行的统一效果：

| proposalId | 取向 | 主要岗位 | 进入条件 | 白天队列效果 |
| --- | --- | --- | --- | --- |
| `hold-the-line` | 保守/防御 | 贺川、纪宁、阿梁 | 核心可用；至少 1 名可执行守卫或木匠 | `assignJob` 防线轮班/维修，成功后 `adjustMeter(campCollapse,-2)`，记录防守准备 |
| `stabilize-supply` | 稳健/后勤 | 周岚、唐婶、陈野 | 食物或水源存在；至少 1 名后勤/农务岗位 | `assignJob` 配给/生产，按库存结算 `addResource`，成功后 `adjustMeter(campCollapse,-3)` |
| `quiet-research` | 保守/研究 | 苏禾、周岚 | 医院档案或已记录黑土样本；科研岗位可用 | `assignJob` 整理档案，`adjustMeter(resonancePressure,-1)`，记录研究延迟风险 |
| `signal-surge` | 冒险/中继 | 阿默、阿梁 | `relay-chain-001` 已开始且两岗位可用 | `assignJob` 调谐/施工，`scheduleEvent(relay.forecast)`；预警提前量由既有中继 reducer 派生，`adjustMeter(resonancePressure,+3)` |
| `blacksoil-probe` | 冒险/黑土 | 阿默或苏禾、至少 1 名守卫 | 已记录 `blacksoil_seen` 且有可用科研岗位 | `scheduleEvent(blacksoil.sample)`，`adjustMeter(resonancePressure,+4)`，失败时 `adjustMeter(campCollapse,+2)` |
| `trade-for-time` | 外交/高风险 | 周岚、林岑或贺川 | 红线/河湾关系可用，库存满足交易条件 | `modifyRelation` 与 `addResource` 通过外交 reducer 结算；失败写入绕行/补给延迟，不生成盟军人口 |

若角色、资源或建筑条件不足，候选必须标记 `blockedReason` 并保留一条安全替代，不得伪造岗位或库存。候选排序先按主线紧迫度，再按 NPC 需求与固定 seed；排序结果写入回放，避免刷新改变提案顺序。

### 节点 C：`hero_vote`

- **触发：** `SUMMARY` 候选创建后立即执行，只记录票，不执行提案。
- **投票输入：** NPC 的 `voteProfile`、当前需求（饥饿、重伤、建筑受损、威胁路线）、与玩家/营地关系、岗位缺口和风险容忍度。
- **权重：** 普通英雄基础权重 1；重伤英雄 0.5；林岑存活且可行动时对其支持领域 +1；无指挥官时由贺川或最高 `commandSkill` 的存活英雄主持，主持不复制额外英雄能力。
- **确定性：** 同一 `seed + day + contentVersion + ledger snapshot` 必须生成相同票型；随机只用于同票打破，不得读取 UI 顺序或时间戳。
- **结果：** 票数最高且满足岗位/资源条件者成为 `autonomyProposal`；全候选阻塞时进入 `safe-fallback`。

### 节点 D：`player_override`

玩家在次日 `DAY` 刷新点数后、首个白天命令前只能提交一次干预：

| choiceId | 权限 | 消耗 | 结果 |
| --- | --- | ---: | --- |
| `observe` | 所有信任 | 0 | 接受自治提案，不改变投票 |
| `support:<proposalId>` | `campTrust >= 60` | 1 CP | 把该提案标记为玩家支持；若资源/岗位不足，仍走安全降级 |
| `veto:<proposalId>` | `campTrust >= 60` | 1 CP | 否决一个候选，重新选择下一可行自治提案；没有可行提案则 `safe-fallback` |
| `modify:<proposalId>` | `campTrust >= 60`，且具备对应岗位/英雄条件 | 1 CP | 只修改一个已声明参数（目标门、岗位优先级或执行顺序），不增加资源、不造人、不跳过夜战 |
| `request-help` | `campTrust < 60` | 0 | 记录求助并提高下一次任务可见度；不能直接改计划或调度英雄 |

`campTrust 20–59` 的普通岗位请求仍可排入白天队列，但不能在计划会上支持/否决/改写提案；`campTrust >= 80` 或满足英雄专属条件才允许调度英雄/据点守军，并且仍需 NPC 本人可用。越权操作必须由统一 Gate 拒绝并记录 `planMeeting.command.denied`。

### 节点 E：`day_execute`

- **触发：** 玩家干预窗口关闭或玩家选择 `observe` 后，计划进入 `day_committed`，白天岗位队列按提案执行。
- **规则：** 资源、劳动和建筑占位先由 reducer 预检；任一必需效果失败则整批回滚，写入失败原因，不发放半套收益。
- **夜间边界：** 一旦进入 `NIGHT`，未执行的白天命令全部保留为待办或降级，不能在夜战中补做；夜间只读取已经提交的准备值。
- **并发/幂等：** 相同 `instanceId + proposalId + effectId` 只结算一次；刷新、加载和重复点击返回已完成结果。

### 节点 F：`day_resolve`

日末读取实际账本与事件结果，写入 `autonomyResult`，并为每日总结提供：计划、提案、票型、玩家干预、资源变化、岗位执行率、风险兑现和对下一轮尸潮的影响。已结算实例不可再次投票或发放效果。

## 保守路线与冒险路线

### 保守：`hold-the-line` / `quiet-research`

营地优先修补核心、照顾重伤、封存高噪声样本。若岗位和材料满足，`campCollapse` 下降 1–3，`resonancePressure` 下降 0–1，预警和研究速度保持原状。代价是少生产一轮或延迟中继/科技；总结明确显示“风险下降但发展延迟”。

若材料不足，退化为 `assignJob` 岗位轮换和 `recordHistory`，不凭空扣除资源；若核心已受损，优先修复核心而不是生成新建筑。

### 冒险：`signal-surge` / `blacksoil-probe`

营地利用中继或黑土样本换取预警、研究线索和反共鸣路线。成功时通过既有中继/黑土 reducer 生成可观察的预警或研究事件，`resonancePressure` 分别增加 3/4；失败或超时增加 `campCollapse` 2，并在尸潮生态中提高尖啸者/共鸣载体概率。代价是广播员疲劳、弹药/工时锁定或下一夜防线余量变少。

冒险计划不直接降低最终尸潮预算，也不改变实体上限；它只改变已有 `hordeForecast`、`resonancePressure`、准备值和敌人标签。若中继事实不存在，`signal-surge` 不能伪造上线，只能降级为人工哨报或 `unknown-forecast`。

## 缺席、死亡、人口不足和过期

- **指挥官死亡/失踪：** 贺川临时主持，计划会仍运行但失去额外权重；长期写入 `successor-crisis`，不生成新英雄。
- **阿默缺席：** 中继提案改为岗亭人工哨报，预警提前量缩短；不得写入 `relay.stationOnline`。
- **苏禾缺席：** 医疗提案降级为周岚按药草账排序，治疗效率下降；重伤者仍计入生存但不计入 `workEligible`。
- **阿梁缺席：** 防线提案可由纪宁做低效率修补；施工分钟数增加，材料不变。
- **拒绝合作：** NPC 立即失去本次相关岗位执行权和投票权（重伤规则另计），日志记录原因；其他存活岗位重新计算可行候选。
- **人口不足：** `livingRoster < 3` 时停止派驻和高风险计划，直接进入营地存在判定；不能由计划会造人。
- **campLocal 不足：** 会导致核心无人值守或低于 1 人的计划被 Gate 拒绝；驻守据点的 NPC 仍从营地人口扣除。
- **材料/建筑损坏：** 预检失败则不扣资源；已经执行的批次回滚。建筑降级只影响覆盖/准备值，不绕过建筑生命周期。
- **玩家跳过：** 等价于 `observe`，可行自治提案自动提交；所有候选阻塞时执行 `safe-fallback`（核心防御/封存），并在总结显示跳过原因。
- **过期：** 若下一个 `DAY` 仍未提交，实例变为 `expired`，只执行一次安全降级并写 `autonomy.plan.expired`；不阻塞主线和最终尸潮。

## 六视角合理性账本

### 玩家视角

玩家看到提案人、票数、消耗、收益、风险和有效期；`campTrust` 决定能否干预。玩家可以用 1 CP 改变一个方向，但不能复活 NPC、增加人口、跳过夜战或直接改写结局。每次干预都有明确的材料、工时、关系或共鸣代价。

### NPC 视角

英雄按岗位需求、关系和风险容忍度投票；普通 NPC 只提供岗位状态和需求脉冲，晋升后才获得英雄投票权。死亡、失踪、重伤、拒绝合作会即时改变权重和可执行岗位；计划不会调用幽灵节点。

### 营地视角

每个计划需要真实库存、岗位工时、建筑占位和 campLocal 人口。防线、生产、医疗和研究之间存在机会成本；`campCollapse` 由欠粮、受损、空岗、失败和失信累积，不能靠对白清零。计划结果进入每日总结并影响下一天准备。

### 势力视角

外交计划只读取已登记的 `redline`/`riverfolk` 关系和贸易池；成功换取有限弹药、路权或补给效率，失败则关系下降、路线变危险。外援不迁入农场 roster；领袖缺席由既有后勤/指挥岗位代签并降低效率。

### 敌人视角

高共鸣计划使尖啸者、共鸣载体更可能寻找中继和伤员；低噪声防御使敌人优先外围资源或核心门。计划只改变预算输入、路线标签和准备值，不突破夜战波次、近景实体和 80 个逻辑实体预算。

### 全局事件链视角

计划会在 `relay-chain-001`、`omen-blacksoil-001`、支线和 day10 后的 `horde-convergence-001` 之间提供可追溯的准备事实。每日只产生一个稳定实例，`SUMMARY` 只记录不执行，`DAY` 只执行一次，`NIGHT` 只读取结果；`campCollapse`、`resonancePressure`、人口和英雄状态均通过统一 reducer 与事件账本进入存档/回放。

## 统一效果与实现映射

计划卡不能直接写 `state`、库存、NPC 生命或建筑耐久。所有内容效果使用现有统一操作：

| 计划行为 | 统一操作/现有入口 | 说明 |
| --- | --- | --- |
| 组织轮班、施工、研究和配给 | `assignJob` | 只排入白天队列；验证岗位、人口和 campLocal |
| 改变崩溃/共鸣 | `adjustMeter` | 范围 0–100，写 `commandId/eventId/causationId` |
| 交易与信任变化 | `modifyRelation` | 读取 `FACTION_DEFS`；`camp.trust` 关系映射到 `campTrust` 阶梯，不能把关系当资源直接发放 |
| 触发中继/黑土后续 | `scheduleEvent` | 交给 `EVENT_CHAIN_DEFS` 的既有链，缺包安全降级 |
| 资源扣除与产出 | `addResource` | 预检、幂等、批次失败回滚 |
| 计划/降级/投票记录 | `recordHistory` | 供 SUMMARY、存档和回放读取，禁止隐藏临时变量 |
| 每日点数刷新/消费 | `DAY` 生命周期 reducer | 不是内容奖励；按 trust 阶梯刷新、不累积、不可夜间使用 |

建议注册结构：

```js
EVENT_CHAIN_DEFS["camp-plan-meeting-001"] = {
  chainId: "camp-plan-meeting-001",
  contentVersion: 1,
  category: "system",
  phase: ["day_2", "day_16"],
  startConditions: [
    { type: "phase", value: "SUMMARY" },
    { type: "day", min: 2 },
    { type: "camp_exists", value: true }
  ],
  nodes: [
    "summary_open", "candidate_build", "hero_vote",
    "player_override", "day_execute", "day_resolve"
  ],
  fallback: {
    ifMissingNpc: "recompute_without_role",
    ifInsufficientPopulation: "camp_collapse_guard",
    ifNightLocked: "queue_for_next_day",
    ifExpired: "safe_fallback",
    ifSkipped: "autonomy_result"
  },
  hooks: ["onSummary", "onDayStart", "onDayEnd", "onNightEnd"],
  optional: false
};
```

运行时映射到：

- **事件契约：** `EventDef`、`EventInstance`、`Choice`、`Effect`、`Gate`；每个每日实例带 `definitionVersion`、`instanceId` 和 `status`。
- **命令总线：** `CommandBus.dispatch` 负责 `planMeeting.commit`、`planMeeting.override`、`planMeeting.resolve`；Gate 统一检查 phase、trust、CP、人口、岗位和夜间锁。
- **内容注册：** `EVENT_CHAIN_DEFS` 注册链；`ZombieHarvestContent.startChain/resolveChain/resolveAutonomy` 管理生命周期；候选提案作为定义数据，不在按钮回调中硬编码。
- **NPC/势力：** `NPC_ROLE_DEFS`、`NPC_STORY_DEFS` 提供岗位、英雄状态和 voteProfile；`FACTION_DEFS` 提供贸易/关系条件。
- **主线接口：** `relay-chain-001` 读取 `signal-surge` 已提交事实；`horde-convergence-001` 读取最终锁定前的准备快照；支线只通过调度事件进入，不被计划会强制完成。
- **UI：** 动态计划卡读取 `planMeeting.candidates/votes/playerOverride/autonomyResult`；当前硬编码卡片只能作为占位，不能冒充完整 v81 UI。

## 存档与回放

- 存档保存 `planMeeting` 当前实例、候选定义快照、票型、玩家选择、已消费 CP、效果批次和 `autonomyResult`。
- 内容定义本身不写入存档；加载前按启动清单重新注册并校验 `contentVersion`。缺包只记录 `content.pack.missing`，不执行计划效果。
- 旧档缺 `planMeeting` 时补为 `null`；缺 `campTrust`、`commandPoints`、`campCollapse`、`resonancePressure` 时分别使用 0、0、0、25 的 v80 安全默认，并记录 `save.migrated`。
- `instanceId + proposalId + effectId` 是幂等键；重复刷新、保存、加载或回放不得重复扣资源、扣 CP 或改变仪表。
- 回放事件至少包含：`eventId`、`instanceId`、`contentVersion`、`day`、`seed`、账本快照摘要、候选排序、投票权重、玩家 choice、Gate 结果、效果列表、降级原因和最终 `autonomyResult`。
- 相同 `seed + input + contentVersion` 必须得到相同候选、票型、计划结果和 hash；时间戳、UI 顺序和随机显示不得进入决策输入。

## 验收场景

| 场景 | 预期结果 | 证据 |
| --- | --- | --- |
| day 2 新局 | SUMMARY 只创建一个 `camp-plan-meeting-001:d2`，不执行白天效果 | 事件账本/回放 |
| trust 0 | 只能查看、求助和接受自治，不能支持/否决/调度英雄 | Gate 日志 |
| trust 60 | 可花 1 CP 支持/否决/修改一个候选；当天不能重复干预 | `planMeeting.command.*` |
| 次日 DAY | CP 按信任阶梯刷新且不累积，计划进入白天队列 | 状态快照 |
| 夜间尝试修改 | 统一 night guard 拒绝，不改资源/岗位/仪表 | 夜间保护检查 |
| 固定 seed | 候选排序、投票和自治结果稳定一致 | replay hash |
| 林岑死亡 | 贺川主持，无额外英雄调度权，写 `successor-crisis` | 人口/计划账本 |
| 阿默缺席 | 中继计划转人工哨报，不写 `relay.stationOnline` | relay 事件日志 |
| 人口不足 | 拒绝高风险和据点派驻，直接按营地存在条件结算 | collapse guard |
| 材料不足/建筑损坏 | 批次回滚，不扣半套资源，进入安全降级 | reducer 事务日志 |
| 玩家跳过/过期 | 仅结算一次自治或 `safe-fallback`，不阻塞主线 | `autonomy.plan.expired` |
| save → reload → continue | 继续同一实例，不重复投票、CP 或奖励 | 迁移与幂等日志 |
| 三日 smoke | 计划候选、白天队列、夜间锁和每日总结不破坏主循环 | smoke runner |

## 六视角审查结论与回滚

本卡满足 01–09 的固定人口、自治优先、双重信号、夜间边界和 day12–16 尸潮窗口规则。它只把计划会定义为可回放的系统链，不提前宣称 `campTrust`、`commandPoints`、英雄投票和动态 UI 已在当前运行时完成。

实现若无法承载 `planMeeting` 状态，应先提交 schema 议题并提高 `CONTENT_SCHEMA_VERSION`，迁移失败回滚到上一份兼容代码和存档；不能通过降低 `SAVE_VERSION` 隐藏问题。效果批次使用统一 reducer，任何一项失败都回滚，已完成实例通过幂等键保留。

**实现状态：** 设计冻结 / v81 待注册。  
**实现提交：** 待开发提交。  
**关联交接：** `docs/handoff/尸潮农场-开发交接包.md`、`docs/overall-iteration-plan.md`。  
**关联规则真相：** `剧本/尸潮农场/01_整体世界观与叙事法则.md`、`02_14天时间线与最终尸潮.md`、`05_势力营地与敌人多视角.md`、`06_NPC英雄晋升与普通NPC体系.md`、`07_计划会与commandPoints.md`、`09_数值、性能与实体预算.md`。

