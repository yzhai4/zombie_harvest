# ADR：ActorObservationV1 角色知识投影

**状态：** proposed／完整范围未完成；[self 首谈](ADR-20261017-npc-self-observation-v1.md)和[特定DAY近身口头侦察](../scripts/npc-direct-sight-observation-v1.md)已在各自列明范围开发验收，不覆盖全部对象感知、历史联系人、共享来源与通用授权出口。  
**日期：** 2026-10-17。  
**审计基线：** `dist/index.html` SHA-256 `cc900da9cdf865b101c37080eb7417148a8a388796ba808153c905ef8ad8494a`，SAVE21 / CONTENT3。  
**关联：** [可信输入边界问题](../problems/PROB-20261017-observer-trusted-input-boundary.md)、[领袖 Harness ADR](ADR-20261014-leader-llm-harness.md)。

## 目标与当前事实

先证明角色有权知道某项事实，再决定如何表达、愿意披露多少。当前 `ObserverExpressionV1` 已具备类型过滤、字段白名单、深冻结、确定性表达和 facts hash；它接收调用者提供的 `subject/context`，没有核对角色、目标存在性、当前感知或知识来源，因此不能充当知识授权。

当前公开 `window.ZombieHarvestObserver` 提供 `config/project/comment`。`project` 是纯事实格式转换，不经过评论披露阈值；`comment` 读取配置后调用纯核心。调用者传入虚构目标和 trust=100，可以得到带有“可验证”文案的健康 band。此处只能理解为“对可信输入作确定性表达”，不能理解为已证明世界中存在该目标或该角色知道其健康状态。

`WorldFacts.snapshot()` 已深冻结，但包含全局 NPC、隐藏敌人、关系、记忆、内容状态和账本等宽数据。深冻结防止改写返回对象，不负责授权、保密、知识来源或真实性。`WorldFacts.current` 与 `WorldFacts.entity` 仍提供内部可变对象。三者均不得作为 LLM 的输入或工具能力。

## 拟议边界与最小接口

```text
私有 GameState + SessionController
  -> captureObserverFactsV1（可信本地适配器，私有输入）
  -> projectActorObservationV1（本地确定性知识 Gate）
  -> ActorObservationV1（按角色授权、深冻结）
  -> 已授权事实的披露交集
  -> ObserverExpressionV1 / 可替换表达模型
```

首切片只接营地固定 NPC 的只读观察，不直接接玩家视野、其它势力、意图执行或新持久记忆。以下接口均为待实现合同：

- `captureObserverFactsV1()`：同一次同步捕获当前阶段、世界分钟、事件水位、motion step、固定 roster、合法坐标、有效岗位、驻守双向关联，以及投影所需的少量感知/事件资料；内部构造深拷贝后深冻结。返回值仍留在可信执行侧，不发送给模型。
- `projectActorObservationV1(request, facts, policy)`：纯函数。`request` 仅允许 `schema='ActorObservationRequestV1'`、`version=1`、`actorId`、`topic='self|known-contacts|known-target'`、可选 `targetId`。未知字段、非法类型与未知 topic 失败关闭。角色绑定由可信调用路径检查，不能仅相信模型自报的 actorId。
- `policy` 由本地注册表选择，例如 `camp-npc-observation-v1`。模型不能指定或覆盖角色、视距、岗位、阶段、信任、能力或策略版本。
- `commentObservedV1(observation, target)`：可信适配器仅从已授权 facts 构造表达输入；模型不能再传入原始 subject、私有 context 或任意状态路径。

建议输出结构：

```text
ActorObservationV1 {
  schema: 'ActorObservationV1', version: 1,
  policyVersion: 'camp-npc-observation-v1',
  actor: { id, effectiveRoleId },
  sourceRevision: { worldMinute, eventSeq, stepIndex, phase },
  knowledge: [{
    subjectId, status: 'observed|remembered', facts,
    provenance: {
      kind: 'self|direct-sight|saved-contact|shared-contact|public-event',
      sourceId, at, expiresAt?
    }
  }],
  unknown: [{ requestedId?, reason: 'not-observable|stale|unsupported-topic' }],
  observationHash
}
```

每种 `facts` 必须有固定字段集和严格类型。未知事实不填 0、false、空人口或默认健康；返回 unknown，或从 facts 中省略。外部对无权目标统一使用 `not-observable`，不能通过不同错误、自动枚举、数量或坐标泄露隐藏实体是否存在。详细内部诊断与模型输出分开。

当前表达器的 `sourceProjectionHash` 是已披露 facts hash，保留兼容；新 `observationHash` 另绑定 actor、policy、阶段、来源 revision 和授权知识。不能用相同 facts hash 证明跨角色权限相同或旧观察仍新鲜。规范化字段顺序、hashVersion 与回放规则必须随新合同确定，不能混用不同哈希算法。

## 可用数据源与授权上限

| 现有源 | 首切片可使用 | 不得由此推定 |
| --- | --- | --- |
| 固定 `state.npcs`、lifeState、hp/maxHp | 本人身份及自身伤势 band；先核 roster 和合法生命状态 | 单凭 `npcIsActive` 证明可工作、可指挥或能看到任何对象；该函数目前仅排除 dead |
| `actingRole/actingFor`、`garrisonedOutpostId`、outposts.guardNpcIds | 核对排他的有效岗位及驻守一致性 | 继任者继承原岗私人记忆；驻守者自动拥有营地远程观察或通讯 |
| `npcFulfillsRole` 与 `npcHasRole` | 以排他有效岗语义设计专用投影并独立验证 | 两函数等价；当前 `npcHasRole` 对暂代者可能同时认可原身份岗和暂代岗 |
| 当前合法位置、`canPerceive`、`hasLineOfSight`、视锥/视距 | 经角色资格校验后的当前直接视野；首批给可见类别和距离 band | `canPerceive` 自带伤亡 Gate；坏坐标可由 `Number(x)||0` 合法化；视见即知道精确 HP、AI 目标或未来意图 |
| `perceptionProfile` | 现有订单、疲劳/压力/精力、SAN 和 relay 对直接感知的实际影响 | 未实现的听觉事件、玩家专用 profile、全图通讯或全部建筑遮挡 |
| `npc.perception.contacts[id]` | 合法坐标、来源、记录时间和期限；按历史记忆标注 | contact 含目标 kind、HP、质量或威胁等级；以 ID join 当前全局实体补齐这些信息 |
| 已验证公开事件 | 已批准 type/payload 白名单中的已发生事实及来源 | 所有账本事件天然公开；没有 visibility/witnesses 就默认 public |
| 已发现地标或地图 visitedRegions | 各自已实现的发现/地图展示事实 | 玩家访问过区域等于任意 NPC 已知该区；NPC contacts 已支持地标或物品观察 |

`perceptionTargetsForNpc` 当前只包含玩家和当下敌人列表，不包含其它 NPC、地标或物品。首切片不能宣称完整 actor-relative 的他人伤势、物品品质与地标知识。相关 topic 没有证据就保持 unknown。

当前宽快照没有显式包含顶层 hp、库存、night/nightBattle、facing 或 `SessionController.mode` 等所有观察所需字段。可信捕获必须明确加入本合同真正需要的字段，不能把缺字段归一成零库存、白天或玩家默认视野。不得为读取新增字段把完整 state 直接传给模型。

## 感知、伤亡与历史语义

知识 Gate 先核固定 actor、当前有效身份、阶段与合法坐标，再评价感知。dead 角色不能发起新实时观察；首切片对 critical 采用 self-only 是拟议保守策略，必须通过明确 policy 实现，不宣称当前运行时已有该限制。只读 REPORT 只能使用可信已保存报告/知识，不启动战斗、时间推进或感知更新；未知阶段失败关闭。

每个 contact 独立检查有限数字、合法位置、允许来源 ID，以及 `at <= captureMinute < expiresAt`。`sharedUntil` 是总体水位，不能替代逐项 TTL。`sourceId===actorId` 的旧 contact 也只是自见记忆，不是当前仍能看见；来源不同则标 shared-contact。已有 contact 没有保存目标类别、伤势或目击 receipt，不得从今日全局实体恢复“当时知道的详情”。

已经合法接收的历史共享信息，不因发送者后来移动或死亡而自动变成从未知道。实时发送资格与接收后的历史记忆分开；不能读发送者当前私有状态回溯制造撤销理由。当前保存只有 contact 元数据，不构成完整因果或密码学真实性证明。

## 知识与披露相交

```text
最终可表达 facts = 角色已经获准的 knowledge ∩ 披露策略允许的字段
```

trust、valueAlignment、playerProgress 和 AI 开关都不能提升 knowledge。低信任可以进一步遮蔽已知字段；高信任不能让看不见的敌人、未知伤势、隐藏物品品质或其它势力秘密变成已知。

首切片只对已有明确定义的 NPC→玩家关系使用真实 `relations.trustToPlayer`。营地 trust、观察者自己的其它关系、目标关系不得混用。alignment/progress 没有已批准的来源和方向时使用中性表达调整，明确它不是观测到的数值。模型不能填 trust=100 或要求输出原 projection 绕过交集。

自由文本、`lastReport` 与 memory 字符串视为不可信叙述，不是新事实或权限来源。模型超时、不可用或非法输出只回退确定性表达，不扩大授权知识、不生成命令与收益。

## 保存、兼容与首切片范围

拟议纯捕获／投影／表达组件不新增 SAVE21/CONTENT3 域，不写持久摘要，不改变 contacts 的 TTL 或已结算事实，不产生 checkpoint、RNG 消费、命令或事件。已接线 self 子片替换首谈文案，但承载它的原公开动作仍有 UI、命令、账本和 checkpoint；不得把组件纯读扩为整个交互零写入。若将来需要持久 knowledge、传闻、接收 receipt 或跨角色记忆，另立 schema/migration/replay ADR 后才保存。

公开纯表达 API 的保留属于内部/兼容层，不是给 LLM 的工具注册。LLM 只能获得 actor-bound 的授权 JSON 和声明过的表达/意图接口，不能访问 `WorldFacts.current/entity/snapshot`、完整保存、内部捕获、自由函数调用或任意 JavaScript。浏览器客户端持有全局数据不等于对同页恶意代码建立安全沙箱；本合同约束可信运行时与隔离模型适配边界。

## 实现前后验收

以下均为待执行出口，不是本文件已实现的结果：

1. 使用真实 inline source 与现有 `sourceRuntimeFactory`，仅追加 QA 导出而不 mock 感知/观察规则。由实际 `canPerceive`、`updateNpcPerception`、`sharePerception` 建立直接、记忆和共享样例；fixture 准备与被测纯投影分别记录。
2. 测视距内外、视锥、墙体、疲劳/SAN、relay、时间到期前/等于/后。没有听觉消费者就不声称听觉通过；其它 NPC/地标/物品 topic 仍按本切片能力界限处理。
3. 负控覆盖 unknown/dead actor、critical 策略、暂代双岗、驻守正反冲突、坏坐标、伪造 role/trust/policy、未知字段、未来/过期 contact、未知 source、通过 contact join 隐藏 HP、visited 区域越权与隐藏目标存在性侧信道。
4. capture/project/comment 前后对比完整 state、storage、registry、RNG、命令/事件水位和 timers；结果逐层冻结且无可写原引用。AI OFF/ON knowledge/facts 相同；失效/非法模型回退不扩大事实。hash 重算稳定，换 actor/policy/phase/revision 后旧 observation 不得复用。
5. 用实际 writer/validator/loader 做两次 source-VM reload，保存联系人来源与期限不延期，不补人、CP、知识、奖励或事件。旧 writer 使用保留原字节的真实 SAVE18/已有 SAVE21 档，标明版本、原 checksum 和改动列表；缺失字段保持 unknown，不把手改 version 当真实旧 writer。未结算夜战仍遵守原恢复合同。
6. 保留现有表达核心、inline parity、content-chain、event-gate、episode、replay 与 static 回归。新观察 Gate 单独冻结 HTML/runner/fixture SHA 后再测公开 UI；源码、夹具浏览器、自然多日游玩分别报告。当前 cc900da9 的自然三日运行不能代替本 Gate 验收，也不因本 ADR 改标结果。

增量：HTML c42056ed 的 `npc-first-talk-self-v1` 已通过真实公开 Gate 绑定同一 live NPC，并捕获本人伤势、需求和实际个人信任，经 self 授权／披露后固定表达；证据见[self QA](../qa/npc-self-observation-v1-20261017.md)。它不是本提案的通用 policy。上列感知、contacts、共享知识、有效岗位及模型边界仍待实现和验收；无新保存域、LLM 或生产部署结论。

增量：HTML23b8c8c2 的 `npc-view-direct-sight-v1` 已沿真实view Gate→同live NPC→当前实际profile／canPerceive／LOS→一名合法活敌的粗类别与距NPC band→个人信任披露→context／名册as-of行接线。source91／Chrome200与列明关联回归见[QA](../qa/npc-direct-sight-v1-20261017.md)。无knowledge时给不归于NPC的统一中性文字；不读联系人补当前事实、不探开地图、不改变行为或保存。特定policy的私有工作预算不是世界生成上限。其它观察topic、contacts来源／TTL与共享、事件可见性、有效岗位、模型隔离继续开放。规划、EventFact与表达按各自消费者所需事实合同推进，不要求本完整ADR一次收口后才开始所有玩法实验。
