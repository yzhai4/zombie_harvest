# Observer 纯表达入口缺少角色知识授权

**状态：** proposed / 问题已确认，修复合同未接线。  
**日期：** 2026-10-17。  
**基线：** `dist/index.html` SHA-256 `cc900da9cdf865b101c37080eb7417148a8a388796ba808153c905ef8ad8494a`，SAVE21 / CONTENT3。  
**下一步合同：** [ActorObservationV1 ADR](../decisions/ADR-20261017-actor-observation-v1.md)。

## 问题与影响

当前 `ObserverExpressionV1` 是对可信 subject/context 的纯表达器。类型检查、白名单、深冻结、披露阈值及确定性 hash 已存在；角色是否知道目标、来源是否获准、实时/历史信息是否过期则未进入此入口。不能把表达结果的“可验证事实”文案或头部及嵌套对象已冻结，解释成知识授权 Gate 已完成。

如果将 `WorldFacts.snapshot()`、自由 subject/context 或公开 `project/comment` 直接接给 LLM，模型可能获得全局隐藏事实，或把调用者提供的信息包装成已获世界证明的事实。当前未发现模型实际接线；本问题记录的是已复现的输入边界缺口，不宣称已经发生生产模型泄露。

## 已执行的只读源码探针

本轮在隔离完整 inline source VM 中使用现有 `sourceRuntimeFactory` 读取函数和公开 API，未开始游戏、未启动浏览器或自然三日。数据变更只用于一次性 VM 反例，未改 HTML、源码文件、正式保存或正在运行的 profile。探针得到：

| 检查 | 实际观察 |
| --- | --- |
| 公开 Observer API | keys 为 schema/config/project/comment；没有 actor-bound observe Gate |
| 虚构目标 | comment 接收 `kind=npc,id=made-up,hp=100,maxHp=100` 与 caller trust=100 后返回 hpBand=`4/4`、disclosureScore=1 和“可验证角色事实”文案；不查 roster/目标存在性 |
| AI OFF | 上述调用仍返回相同 facts，mode=fallback；关闭 AI 不等于限制知识 |
| 直接 project | 对传入 hp=100/maxHp=100 返回 `4/4`，不经过 comment 披露阈值 |
| 表达纯性 | 调用前后完整 VM state JSON 相同；snapshot.npcs 已冻结 |
| 暂代岗位 | carpenter.actingRole=doctor 时，npcHasRole(carpenter,'carpenter') 为 true，npcFulfillsRole 原岗为 false、doctor 为 true |
| 死亡感知 | 对 dead actor 直接调用 canPerceive，合法近距/360° 参数仍返回 true；函数自身没有生命资格 Gate |
| 感知对象范围 | perceptionTargetsForNpc 只含玩家与敌人，不含另一名 NPC |

这些反例定位当前边界；它们不是新 Gate 的失败测试报告，也不是浏览器或真实自然路线结果。表达器接受可信输入本身不违反原纯函数合同，缺口在于尚无模型之前的角色知识投影。

## 可用来源与当前不支持

- roster、lifeState、hp/maxHp、actingRole/actingFor、驻守 marker 及 outpost guards 可用于构造可信内部捕获；`npcIsActive` 仅排 dead，不证明 critical 可工作或可主持。岗位权限不能用 `npcHasRole` 的身份/暂代并集替代排他的有效岗位语义。
- 视距、视锥、wall/spikeWall 遮挡以及 needs/SAN/relay 的已实现影响可支持直接感知。`distanceBetween` 的数字强转不是类型校验，缺失/NaN 坐标须先拒绝。profile 中有 hearing 数值，但当前 canPerceive 没有独立声音证据路径；玩家也没有专门 profile。
- contacts 只保存 x/y/sourceId/at/expiresAt。可表达合法期限内的历史位置记忆与来源；不能 join 今日全局实体补 kind、HP、AI 意图、质量或威胁等级。sharedUntil 不替代逐项 TTL。旧来源后来移动/死亡不等于此前接收的记忆从未存在。
- 当前感知 targets 不包含其它 NPC、地标与物品；其 actor-relative 伤势、发现或品质知识尚不支持。地图 visitedRegions 属展示来源，不授权所有 NPC。无权限目标、缺来源或过期字段须 unknown，不能默认 0/健康/公开。
- 账本中 visibility/witnesses 不统一；缺标记不能当 public。lastReport/memory 字符串不是可靠权限来源。完整 snapshot 含所有 NPC 私有域、隐藏敌人和未来内容状态，虽已深冻结仍不可交给模型；其遗漏的阶段/库存等字段也不能按默认值补造。

## 拟议修复

先实现 ADR 中的可信捕获与 `ActorObservationV1`，再把它投影出的事实交给现有表达器。LLM 只获得 actor-bound、严格字段集的授权 JSON，不直接读取 GameState、WorldFacts.current/entity、宽快照或完整保存，也不能以自由 subject/context、trust、role 或 policy 调用内部转换器。

最终披露是 `已授权 knowledge ∩ 披露策略字段`。低信任可以减少披露；高信任不能提升知识、发现隐藏敌人或授权其它势力私有信息。trust 的方向和来源由代码确定；alignment/progress 无已批准来源时只作中性表达调整，不构造观测数值。未知目标不通过错误差异或枚举泄露存在性。

首切片无新增保存域：仅读既有 contacts，不延期 TTL，不写摘要、receipt、checkpoint、命令、RNG 或事件。不修改冻结三日构建；后续另建新 SHA。未来持久记忆必须另立 schema/migration/replay 合同。

## 待完成验收与关闭条件

1. 用实际 source 的感知与共享函数建立直接/历史/共享样例，分别验证范围、遮挡、时限、source、角色有效性与字段上限；不以 mock observer 或仅 Node 类型测试代替 runtime 接线。
2. 负控覆盖虚构/dead actor、critical policy、暂代旧岗、驻守冲突、非法坐标、caller 伪 role/trust/policy、未知字段、未来/过期 contact、隐藏信息 join、无证据 NPC/地标/物品、事件权限缺省与未知目标侧信道。
3. 对 capture/project/comment 验完整 state/storage/registry/RNG/命令事件水位/timers 不变、深冻结无原引用、AI OFF/ON 相同知识与 facts、失效 observation/hash 拒绝和确定性表达回退。事实 hash 不代替 actor/policy/revision 绑定。
4. 实际 writer/validator/loader 两次 source-VM reload 保持已有来源和期限、不补知识/人口/CP/收益。使用真实保留原字节 SAVE18/已有 SAVE21 旧 writer 输入；手改 version 或当前 writer 删字段只能标合成负控，不能冒称旧版本兼容。缺知识保持 unknown，进行中夜战不扩张为可恢复续玩。
5. 现有表达/inline parity、content-chain/event-gate/episode/replay/static 回归通过后，再按新源码与新 fixture SHA 做独立公开观察入口的 browser smoke。source VM、夹具浏览器和自然三日范围单列，不转移 cc900da9 的旧证据。

以上新 Gate、旧 writer 观察兼容与浏览器验收均未执行。本问题保持 proposed/未接线；本轮仅落下设计和审计事实，没有新增实现、保存域或通过声明。
