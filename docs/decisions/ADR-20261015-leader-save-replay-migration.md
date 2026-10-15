# ADR-20261015：领袖运行时的存档与回放迁移边界

- **状态：** proposed
- **日期：** 2026-10-15
- **范围：** 领袖 LLM 的身份、意图收据、门禁结果、回退与 replay/save 迁移
- **关联：** `ADR-20261014-leader-llm-harness.md`、`SAVE_VERSION=21`、`CONTENT_SCHEMA_VERSION=3`
- **当前证据：** offline leader harness 6/6、replay/idempotence/fallback sandbox 5/5、headless ledger adapter 6/6、CommandBus bridge contract 5/5、真实 reducer bridge VM 6/6

## 决策摘要

领袖 LLM 只能生成结构化 `Intent`，由观察投影、能力 Gate、预算和确定性 reducer 执行。当前版本先不修改 `SAVE_VERSION=21`、`CONTENT_SCHEMA_VERSION=3`，不向线上 Sites、生产存档或现有 replay 轨迹写入新字段。本 ADR 只定义未来接线所需的持久化和迁移合同，待夹具与评审通过后再单独提交 schema/runtime 变更。

真实 reducer bridge 已确认当前生产式计划会命令和事件使用 `actorId=player-1`。未来领袖适配器必须显式选择兼容方案：保留 `player-1` 作为执行者并在领袖收据中记录归因，或提出新的 actor 语义并完成完整迁移。任何 replay 都不得静默把历史 `player-1` 改写成领袖。

## 不变的刚性边界

刚性 harness 由代码实现，不能由提示词、解释文本或模型返回的新字段绕过：

1. 观察投影白名单、角色与阶段 Gate、昼夜和事件节点边界。
2. 注册意图/命令白名单、目标实体存在性、实体预算、人口守恒和资源/时间预算。
3. 统一 CommandBus、唯一 `commandId`、`causationId`、重复命令拒绝和确定性 reducer。
4. Gate 失败、超时、越权、模型不可用或回放 hash 不一致时，执行同一角色的规则 fallback，并记录拒绝原因。
5. 领袖不得创建剧情节点、NPC、人口、资源、科技、敌人或没有来源的奖励；不得跳过夜间、事件节点或既有终止条件。

软性 harness 只约束选择风格：价值权重、风险偏好、候选顺序、信息不确定性、解释长度和承认未知。软性可以改变“选哪条合法路”，不能改变合法路集合。

## 提议的未来 `leaderRuntime` 块

以下是 **proposed** 字段；在 schema ADR 获批前不得加入 SAVE21：

```json
{
  "leaderRuntimeSchemaVersion": 1,
  "leader": {
    "actorId": "leader-camp-01",
    "roleId": "camp_leader",
    "policyVersion": "rule-baseline-v1",
    "model": {
      "kind": "rules|llm",
      "provider": "redacted-provider-id",
      "modelId": "redacted-model-id",
      "attempt": 1,
      "latencyMs": 0,
      "costUnits": 0
    },
    "lastProjectionHash": "sha256:...",
    "intentReceipts": [
      {
        "intentId": "intent-...",
        "sourceProjectionHash": "sha256:...",
        "action": "support_proposal",
        "target": { "type": "plan", "id": "plan-..." },
        "deadline": { "day": 3, "minute": 720 },
        "resourceBudget": { "commandPoints": 1, "food": 0, "population": 0 },
        "gate": {
          "status": "accepted|rejected|fallback",
          "reasonCode": "ok|phase|capability|budget|stale|unknown",
          "fallbackPolicy": "rule-baseline-v1"
        },
        "commandIds": ["cmd-..."],
        "eventIds": ["evt-..."],
        "causationId": "cmd-...",
        "replayHash": "sha256:..."
      }
    ]
  }
}
```

字段语义：

- `intentId` 是跨重试和保存恢复的幂等键；同一领袖、同一意图只能产生一个成功或拒绝收据。
- `actorId` 表示发出意图的角色，`roleId` 表示能力/观察范围。二者都必须经过内容注册表解析，不能由模型自由注册。
- `policyVersion` 锁定规则 baseline 或软性策略版本，保证比较和回放可追溯。
- `sourceProjectionHash` 绑定模型看到的白名单观察；过期投影只能被拒绝或走明确 fallback。
- `target/deadline/resourceBudget` 是标准化后的执行合同，禁止保留任意对象补丁。
- `gate.status/reasonCode/fallbackPolicy` 记录可解释的接受、拒绝或回退，不以自由文本代替状态。
- `commandIds/eventIds/causationId/replayHash` 把领袖收据和实际账本绑定；没有真实事件的空成功不能写入成功 receipt。
- `model` 只保存审计所需的种类、脱敏 provider/model 标识、尝试次数、延迟和成本单位。生产存档不保存原 prompt、chain-of-thought、原始完整回答、私有记忆、凭据或未授权观察。

## 历史与容量

这是提议的容量规则，具体上限由实现夹具确定：

- 只保留最近一个有界窗口的领袖收据（候选值：最近 100 条或最近 14 个游戏日，取较小者）。
- 当前日结算所需的未完成意图必须先写入同一保存事务；过期、取消和拒绝收据按统一格式封存。
- 超出窗口的收据只保留聚合计数和最后一个 hash，不删除仍被 replay 或事件账本引用的因果信息。
- `intentId`、`commandId` 和 `eventId` 均参与去重；重复提交不得再次扣资源、推进时间、改变人口或发奖励。

## SAVE21 / CONTENT3 迁移政策

1. `SAVE_VERSION=21` 与 `CONTENT_SCHEMA_VERSION=3` 在本 ADR 阶段保持不变。
2. 现有 SAVE18 -> SAVE21 迁移只补当前系统安全默认值并保留旧事实：不合成领袖意图、领袖奖励、英雄晋升、NPC 功绩或新计划承诺。
3. 未来 schema 获批后，缺少 `leaderRuntime` 的 SAVE21 读取为安全默认 `null`，并保持旧 replay 语义；不能把旧的 `player-1` 命令推断为领袖命令。
4. `leaderRuntime` 结构缺字段、类型错误、hash 不匹配或含有未允许字段时，整档进入 `RECOVERY_REQUIRED`，不得部分安装或悄悄丢弃已支付资源。
5. 旧 replay 中没有领袖元数据的命令继续按 player/system 命令回放。迁移器不回填虚构的 leader receipts。
6. 如果迁移后的 replay hash、事件因果或存档 checksum 不一致，回滚到不可变旧档；不在运行中“修正”历史事件。

## Replay 合同

- replay runner 只执行标准化意图和确定性 reducer；不在线调用模型，不依赖模型当前输出。
- 有 `leaderRuntime` 时，先验证 `sourceProjectionHash`、policyVersion、Gate receipt 和已记录的 command/event 因果，再重放命令。
- 没有 `leaderRuntime` 时，只重放原有命令和事件；旧档的状态、资源、人口、日期和结局必须保持语义不变。
- 回放结果必须同时比较最终状态 hash、事件账本 hash、领袖 receipt hash 和保存投影 hash；任一不一致都失败并保留诊断。
- fallback 的成功也必须由同一 reducer 产生正常 receipt，不能用“模型失败”作为额外奖励来源。

## 六视角一致性检查

接入前每个 leader intent 夹具都必须从以下角度检查，且只能引用已存在的事实：

- **玩家：** 玩家可见哪些计划、命令点和风险；领袖不能替玩家扣除未授权资源或隐藏改变目标。
- **NPC：** 岗位、SAN、伤亡、继任和个人事件只能按 roster 与事件账本结算；领袖不能凭空晋升或补人。
- **营地：** 食物、核心耐久、据点守军、维护和 collapse 由统一 reducer 维护；领袖选择必须承担已声明成本。
- **势力：** 关系、能力、观察范围和援助条件来自注册表；领袖不能创建新势力或越权读取敌对信息。
- **敌人：** 威胁强度、夜潮、目标和战斗结果只能由现有敌人/战斗规则生成；领袖不能把敌人从账本抹掉。
- **全局事件链：** 节点前置、终止条件、昼夜边界、一次性结算和分支因果必须保持；支线拒绝或过期要走显式降级。

## 迁移与接线出口

在提出 runtime/schema PR 前，必须新增并通过以下夹具：

1. 原 SAVE18 writer、当前 SAVE21 writer 和缺少 leader block 的 SAVE21。
2. 合法 leader receipt、重复 `intentId`、过期投影、预算超限、夜间拒绝、未知目标和 fallback。
3. 损坏/多余字段、错误 hash、截断 leader block、恢复失败后原档可读。
4. 相同 seed/input/contentVersion 的 replay hash 稳定；旧 replay 无 leader 元数据时结果不变。
5. 真实 reducer 对 leader attribution 的接受、拒绝和 fallback；确认 player-1 不被静默改名。
6. 资源、人口、时间、威胁、事件节点和奖励的守恒审计；失败不产生成功 receipt。
7. 窗口裁剪、跨日恢复、命令/事件重复和 MAX_SAFE 编号边界。
8. 六视角报告、无 raw model text/secret 写入检查、迁移回滚和 checksum 恢复。

## 非目标

- 本 ADR 不修改 `dist/index.html`、`SAVE_VERSION`、`CONTENT_SCHEMA_VERSION`、Sites、生产存档或线上版本。
- 本 ADR 不调用线上 LLM，不把软性偏好变成隐藏规则，也不承诺当前 v81/v82 已具备自治领袖。
- 本 ADR 不替代 GameCore 拆分、真实自然多日 smoke、NPC 全量技能、最终尸潮或多结局接线。

## 接受条件

由评审者确认 actor 语义、字段最小集、保留窗口、恢复错误等级和 replay 比较顺序后，才允许创建后续实现 PR。实现 PR 必须单独给出迁移前后版本、回滚点、旧档原字节 hash、CI 结果和真实 browser/服务器边界；在此之前，所有 leader harness 证据都视为离线/桥接证据。
