# 领袖角色 LLM：刚性与软性 Harness 分层

**状态：** proposed；v87 设计输入，未接入运行时、未改变 SAVE21/CONTENT3、未发布。  
**日期：** 2026-10-14。  
**适用基线：** 开发 HTML `faecaffd12aefdf3c1c0f1dd57130bbb2ba37d5da0e9a6e81bc1f7532733335c`；线上仍为公开 Sites v81。

## 背景和目标

项目已经有 `CommandBus`、确定性 reducer、事件账本、内容注册表、计划会和回放。长期计划中的 v87 要让营地、敌对势力或母巢拥有可替换的 `RolePlanner`，但 LLM 不能直接写 `GameState`。目标是让领袖能做更丰富的判断、取舍、解释和临时计划，同时把世界规则、人口、资源、昼夜和事件链的所有权留在确定性运行时。

附带的 `Zombie_Harvest_WorkGPT_Framework_v2.0.zip` 只作为流程参考。包自身标明是 framework/template、未审计项目、未接入运行时，也没有授权覆盖项目规则；它没有被安装或合并。

## 核心边界

```text
GameState
  -> ObservationProjection (白名单、带版本)
  -> LeaderRolePlanner (规则策略或 LLM)
  -> IntentSchema
  -> HardHarness / CapabilityGate
  -> CommandBus / Reducer / EventLedger
  -> FeedbackProjection
```

LLM 只能提出结构化 `Intent`，不能返回状态补丁、任意脚本、资源数量、NPC 列表、事件节点或奖励。模型不可用、超时、输出不合法或 Gate 拒绝时，系统退回同一角色的规则策略；游戏主循环不依赖网络、GPU 或模型服务。

## 刚性 Harness

刚性约束是代码门禁，模型不能通过提示词、理由或更换命令名称绕过。

1. **意图格式。** 必须包含 `intentId`、`actorId`、`roleId`、`policyVersion`、`sourceProjectionHash`、目标稳定 ID、声明动作、期限、资源预算、取消条件、fallback 和模型运行元数据。未知字段拒绝；原始提示词和长思考不写入游戏存档。
2. **观察投影。** 只能看到该角色获准的白名单字段：当前日期/阶段、可见地标与威胁、已知 NPC 状态、岗位、库存摘要、关系摘要和已发生事件。隐藏敌人、未发现地标、其他势力私有信息和原始玩家存档不进入投影。世界中的自由文本视为不可信资料，不能成为工具授权。
3. **能力与阶段 Gate。** `actorId` 必须是固定 roster 中仍存在的角色；角色、英雄/普通身份、presence、critical/dead、驻守、岗位互斥、势力权限、`SessionController` 阶段、昼夜、战斗状态和事件时窗都由运行时重查。信任、CP、材料、体力、目标距离和冷却不能由模型声明覆盖。
4. **命令白名单。** 每个意图映射到注册过的 command/effect/事件定义；执行只能进入 `CommandBus`、reducer 和事件账本。没有注册命令就返回 `intent-unsupported`，不能退化成 eval、脚本或任意函数调用。
5. **资源、实体和时间预算。** Gate 在支付前检查 CP、木材、食物、零件、药品、体力、可用人口、最大 squad 数、行动次数和最长推进分钟。数量必须非负、来源明确、固定人口守恒；必要的嵌套命令 ID 预算也要先通过统一编号器。
6. **幂等和事务。** `intentId`、`commandId`、目标 ID、计划实例和因果 ID 都进入回执；重复意图在历史窗口内不再次扣费、推进或发奖励。一个领袖意图不能伪装成玩家命令；跨系统变化只能由确定性 reducer 产生。
7. **失败与回退。** `invalid`、`unauthorized`、`stale-observation`、`resource-shortage`、`phase-blocked`、`timeout`、`model-unavailable` 和 reducer rejection 都写拒绝原因，并调用声明的规则 fallback。fallback 也必须经过同一 Gate，不能在异常路径赠送资源或推进事件链。
8. **回放与审计。** 记录规范化意图、观察投影 hash、policy/content 版本、Gate 结果、命令/事件/causation、fallback 和成本/延迟摘要；重放使用规范化意图和确定性执行器，不要求在线再次调用模型。模型原文、密钥、用户私人资料和外部服务响应不进入公开存档。
9. **运行边界。** 每次推理有 token、时间、重试和费用上限；LLM 运行在独立 worker/进程，拥有明确的进程组和 watchdog。停止或超时只终止本轮 agent，不杀线上服务、不重开旧 profile、不重试已经提交的动作。
10. **版本和迁移。** 首轮只在 headless/隔离 QA 运行。真正保存领袖意图或记忆摘要前，必须另立 schema/migration/replay ADR；不能因为增加 `policyVersion` 就声称旧 SAVE21 能理解新字段。生产旧 SAVE18 只按已有兼容路径迁移，不生成历史意图、奖励或晋升。

## 软性 Harness

软性约束给领袖留下判断空间；它们影响排序、理由和风格，不能授予新能力。

- **角色契约：** 指挥官优先守住营地、尊重固定人口和真实供给；红线猎队偏向侦察和撤退窗口；母巢只在其已知威胁投影内组织尸潮。性格、价值观、恐惧、联盟和关系来自 `NPC_STORY_DEFS`/势力定义，不由模型临时改写。
- **可优化目标：** 在同一 hard budget 内选择防守、收获、物流、研究、外交的权重和顺序，可提出一到三个候选意图，说明预期、风险、信息缺口和放弃条件。
- **计划自由度：** 可以拆分小队、改变 route、延迟、请求支援、接受低收益保守方案或主动撤退；不能新增队员、瞬移、跳过夜间、取消已经发生的伤亡、改终局日期或跳过事件节点。
- **不确定性与拒绝：** 领袖可以输出 `abstain`、请求更多观察、承认未知账目或拒绝高风险命令。模型应给出简短理由和置信等级；理由只用于反馈/UI，不能成为事实或 Gate。
- **叙事表现：** 语气、简报、提案标题和对 NPC 的解释可以自由生成，但必须引用已观察事实；展示层文本不能产生奖励、关系、资源或事件实例。
- **记忆：** 只允许经过压缩和校验的角色摘要，如已确认的关系、已知地标、未完成目标和最近拒绝原因。摘要过期时标记 stale，不能用模型记忆替代当前投影。

软约束可以在一轮内被领袖明确取舍，例如“牺牲收获换墙体安全”，但必须仍满足硬预算，并把取舍写进规范化意图。软约束冲突由固定 policy 优先级解决，不由模型自行修改规则。

## 首批角色与接口

先接营地计划会，不直接接最终尸潮。`camp commander` 的首批意图沿长期计划限定为：`support_proposal`、`modify_plan`、`probe_route`、`issue_horde_order`、`split_squad`、`retreat_order`。

`support_proposal`/`modify_plan` 仍受现有 trust≥60、同日会议、DAY、CP 和一次提交 Gate；`probe_route` 不能发现未授权地标；`split_squad` 受固定人口、驻守和战斗人数限制；`retreat_order` 只能作用于已开始且可撤退的威胁。母巢首脑使用单独的 `factionCapabilityProfile`，不能复用营地玩家/英雄权限。

```text
observe(roleId) -> ProjectionV1
propose(projection, roleContract) -> IntentEnvelope | Abstain
validate(intent, projection, world) -> GateReport
execute(validIntent) -> CommandResult + EventReceipt
fallback(gateReport, roleContract) -> registered rule Intent
```

`propose` 是可替换模型边界；`validate` 和 `execute` 必须由本地确定性代码负责。模型可以一次给出候选列表，但只有被选中的一个意图进入命令总线；候选本身不扣资源、不写账本。

## 评测与阶段出口

同一 `seed + input + contentVersion` 下至少比较三组：规则 baseline、受约束 LLM、离线越权对照组。越权对照组只在实验环境运行，永不接生产 reducer。硬指标包括：规则违反=0、人口/资源守恒、非法工具调用拦截率、重复结算=0、replay hash 一致、fallback 正确率、p95 延迟、费用和模型不可用恢复率。软指标再看计划多样性、风险质量、玩家可理解性、NPC/势力动机一致性与六视角人工评审。

阶段顺序：先做 `ProjectionV1`、`IntentEnvelopeV1`、`GateReport` 和规则 baseline，不接外部模型；再在 headless runner 中接一个受限模型适配器，只测计划会的 support/modify/abstain 和拒绝回退；随后用真实事件账本、保存/加载和 replay runner 验证幂等、旧档隔离和成本/延迟记录；最后才扩展路线、撤退、分队和势力 profile，再进入母巢首脑和最终尸潮。

## 不变量和回滚

LLM 方案不能改变固定十人、岗位互斥、day12–16 尸潮窗口、`campCollapse`/`resonancePressure` 范围、计划会 legacy 实例、旧 SAVE18/21 事实或现有 night guard。连续两轮 replay 不一致、一次硬规则越权、费用/延迟超过预算或出现无法解释的 fallback 时，切回规则 planner，保留拒绝和回滚报告，暂停扩大模型自由度。

本 ADR 通过前不修改 L0、runtime、schema、服务器或 Sites；通过后先落地 headless 合同和负控，再决定是否采用新 content/save 版本。
