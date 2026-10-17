# zh-food-shortage-001：断粮警报

**状态：** 开发候选已接线，未发布 Sites；不是自然三日或平衡验收。  
**定义：** `definitionVersion=1`，`repeatable=true`，稳定选择 ID 为 `ration` / `forage`；SAVE21 / CONTENT3 增量适配。  
**实现：** `SCENARIO_RUNTIME_STORYLETS` → ContentRegistry → 公开事件面板 → CommandBus → GateV1 → 统一效果事务。身份合同见 [ADR-20261017-repeatable-episode-identity](../decisions/ADR-20261017-repeatable-episode-identity.md)。

## 玩家承诺与来源

库存只够不超过一天配给时，玩家在“留守承担断粮后果”和“冒暴露风险取回应急藏粮”之间选择。后勤人员知道一处预存两份食物的应急藏粮点 `zh-shortage-cache-001`，整局只能取回一次；它不是可无限再生的采集点，也不代表营地产粮能力提高。

本卡不实现减少每日配给量。`ration` 只保留稳定技术 ID，玩家标签为“留守警戒，接受缺口”；结算不声称节省了粮食、消除了饥饿或完成了配给改革。日常采集仍走地图资源、体力、时间与耗尽规则。

## 触发、分支与终止

`onDayStart` 在 day1–13、可接受白天输入的会话中检查 `food_days <= 1`。同一 episode 只开启一次；未处理的旧 episode 跨日仍保留原身份，不能在渲染或重载时偷偷换成当天实例。处理完旧实例后，后续日的短缺可以创建新的 episode。

| 路线 | 前置与可见提示 | 实际效果 | 不发生的效果 |
| --- | --- | --- | --- |
| `ration` 留守警戒，接受缺口 | 无岗位要求；提示“食物不变，营地崩溃压力 +2，不增加外围暴露” | `campCollapse +2`，写选择历史 | 不产粮、不改每日配给水位、不减饥饿、不增加共振压力 |
| `forage` 取回后勤应急藏粮 | 健康且可履职的后勤岗位人员在岗；`zh-shortage-cache-retrieved=false`；提示“每局一次，食物 +2，共振压力 +2” | 食物 +2、`resonancePressure +2`、永久置取粮 flag，历史记录 `sourceId/amount/exposure` | 不生成人口、不增势力信任、不直接生成敌人、不宣称持续离岗 |

健康的继任人员可承担后勤职责；死亡、重伤、受伤、被据点占用或实际代理其他岗位的人员不能靠原始 NPC ID 通过取粮条件。没有合格后勤人员时，取粮拒绝但留守路线仍可用。当前抽象结算不新增旅行时长、队伍实体或岗位占用，文案不作这些承诺。

定义保留 `ifMissingNpc` / `ifInsufficientPopulation` 的降级效果（分别营地崩溃压力 +1 / +2），`ifExpired` / `ifSkipped` 为只落账、不发粮。缺岗不会自动制造替代 NPC，也不能把 choice Gate 拒绝直接等同于已经执行 fallback。day14 起不再开放新实例；已过期实例由 hook 经原身份执行无奖励 fallback。本卡未声明独立自治路线。

所有仪表按现有 0–100 上限结算，回执核对实际 before/after；“+2”在封顶时不得被当作实际增加两点。

## episode、存档与事务合同

- 新实例的 `instanceKey=chainId:创建日`，`instanceId=content:instanceKey`；携带 `episodeSchemaVersion=1`、`defId`、`definitionVersion` 和当前 `nodeId`。
- 公开按钮固定五元预期 token：`expectedInstanceKey/expectedInstanceId/expectedDefId/expectedDefinitionVersion/expectedNodeId`。点击传原 token，经会话/身份 CAS 后才评估 Gate 和效果；旧按钮、缺字段和未知定义版本拒绝，调用方不得替用户静默刷新 token。
- choice、fallback、自治通用路径的效果收据及历史使用原 episode 身份；effect 去重与 completed 账本按 episode 隔离。CommandBus 的同命令重放不再支付或发奖；已结算 fallback 的相同原 token 重试只可返回幂等结果。
- SAVE21 为 opt-in repeatable 增加身份字段，保持非重复旧链投影与回放 golden。完整旧 writer 夹具必须经过实际 loader；缺身份按原 `startedAt` 推导，不能用加载时的当前日。旧一次性完成记录保留，保守阻挡该保存日一次，不补历史选择或奖励。
- 永久藏粮 flag 随 SAVE21 保存，跨日、刷新和新 episode 都不复原。取粮事务的粮食、暴露、flag、历史任一效果失败须一起回滚；不能只回滚粮食。

## 六视角合理性账本

| 视角 | 合理性与检查 |
| --- | --- |
| 玩家 | 收益、代价和每局一次公开可见；留守不假称缓解配给，旧按钮不能结算新实例。 |
| 营地 | 两份粮食来自有限应急点，首次取回后不可再领；每日消耗保持既有规则。留守压力与原短缺后果分别落账，不混作新增收益。 |
| NPC | 后勤职责和健康状态决定资格，允许现有健康继任者；不复活、不补人、不制造队伍或离岗事实。 |
| 势力 | 本事件不涉及交易或援助，不改变任何势力信任、立场或奖励。 |
| 敌人 | 取粮只提高共振压力，后续敌人行为继续由既有生态规则兑现；不在本事件直接刷怪。 |
| 全局链 | 可跳过，不阻塞中继主链；短缺实例可以跨日重开，有限藏粮不随实例重置。过期和 fallback 不产生粮食。 |

## 验收与证据边界

| 层次 | 必须核对 |
| --- | --- |
| 源码 VM | `scripts/check-content-episode-v1.mjs`：完整旧 writer 加性迁移、原身份恢复、五元 CAS 各字段拒绝、同命令重复、旧日按钮/新日实例、未处理实例跨午夜、夜间/过期、有限藏粮/继任/失败回滚。 |
| 关联回归 | `scripts/check-gameplay-vertical-slice.mjs`、`scripts/check-event-gate-v1.mjs`、`scripts/check-observer-expression-v1.mjs` 与原链 replay golden；仅声明各 runner 实际覆盖范围。 |
| 真实浏览器夹具 | `scripts/browser-content-episode-v1.mjs`：boot 前注入完整旧 writer 保存，经公开按钮继续、选择、真实结算、刷新和继续；核两次 HTTP 文档字节、保存 flag/粮食/暴露/原身份及无页面错误。 |
| 最终候选 | 最后源码变动后重跑关联检查；manifest 精确绑定 commit、HTML SHA、输入/runner/报告工件。旧候选的绿色与截图保留为旧证据，不迁移成新构建通过。 |

本轮已有 source-VM 和真实 Chrome fixture-browser 运行结果；精确计数与字节绑定由 QA 记录和 manifest 管理，不在设计卡固定会过期的 SHA。fixture-browser 不能证明自然多日节奏、平衡或主线全通。Scenario JSON loader 仍是 headless 最小合同；Observer 仅为纯表达核心和深冻结白名单，actor 权限与感知来源投影仍待完成。Sites 生产 v81 未发布本卡。
