# zh-food-shortage-001：断粮警报

**状态：** 开发候选已接线，未发布 Sites；不是自然三日或平衡验收。  
**定义：** `definitionVersion=2`，`repeatable=true`，稳定选择 ID 为 `ration` / `forage`；SAVE21 / CONTENT3 增量适配。  
**实现：** 版本化作者 JSON → `compileScenarioEvents` → 只读候选目录/一次安装 → ContentRegistry → 公开事件面板 → CommandBus → GateV1 → 统一效果事务。手写 `SCENARIO_RUNTIME_STORYLETS` 已移除；默认作者规则仍为 v2，v3 一份藏粮仅为 TEST-ONLY 语义探针。身份合同见 [ADR-20261017-repeatable-episode-identity](../decisions/ADR-20261017-repeatable-episode-identity.md)，内容启动合同见 [ADR-20261017-scenario-content-binding-v1](../decisions/ADR-20261017-scenario-content-binding-v1.md)。

## 玩家承诺与来源

库存只够不超过一天配给时，玩家在“保留有限备用粮、另行筹粮”和“现在动用应急藏粮”之间选择。后勤人员知道一处预存两份食物的应急藏粮点 `zh-shortage-cache-001`，整局只能取回一次；它不是可无限再生的采集点，也不代表营地产粮能力提高。

本卡不实现减少每日配给量。`ration` 只保留稳定技术 ID，玩家标签为“保留备用粮，另行筹粮”；结算不声称节省了粮食、消除了饥饿或完成了配给改革。日常采集仍走地图资源、体力、时间与耗尽规则。

## 触发、分支与终止

`onDayStart` 在 day1–13、可接受白天输入的会话中检查 `food_days <= 1`。同一 episode 只开启一次；未处理的旧 episode 跨日仍保留原身份，不能在渲染或重载时偷偷换成当天实例。处理完旧实例后，后续日的短缺可以创建新的 episode。

| 路线 | 前置与可见提示 | 实际效果 | 不发生的效果 |
| --- | --- | --- | --- |
| `ration` 保留备用粮，另行筹粮 | 无岗位要求；只确认并记录，食物不变，不额外增加崩溃压力 | 只写选择历史 | 不产粮、不改每日配给水位、不减饥饿、不增加共振压力 |
| `forage` 动用后勤应急藏粮 | 健康且可履职的后勤岗位人员在岗；`zh-shortage-cache-retrieved=false`；提示“整局一次，食物 +2，共振仪表 +2” | 食物 +2、`resonancePressure +2`、永久置取粮 flag，新历史记录 `sourceId/amount/resonancePressure`，旧 exposure 保留 | 不生成人口、不增势力信任、不直接生成敌人、不宣称持续离岗 |

健康的继任人员可承担后勤职责；死亡、重伤、受伤、被据点占用或实际代理其他岗位的人员不能靠原始 NPC ID 通过取粮条件。没有合格后勤人员时，取粮拒绝但留守路线仍可用。当前抽象结算不新增旅行时长、队伍实体或岗位占用，文案不作这些承诺。

定义保留 `ifMissingNpc` / `ifInsufficientPopulation` 的降级效果（分别营地崩溃压力 +1 / +2），`ifExpired` / `ifSkipped` 为只落账、不发粮。缺岗不会自动制造替代 NPC，也不能把 choice Gate 拒绝直接等同于已经执行 fallback。day14 起不再开放新实例；已过期实例由 hook 经原身份执行无奖励 fallback。当前公开 UI 没有跳过按钮；关闭/切换面板不触发 `ifSkipped`，它只是内部 API / 测试合同。未处理实例可跨日保留直到过期；本卡未声明独立自治路线。

所有仪表按现有 0–100 上限结算，回执核对实际 before/after；“+2”在封顶时不得被当作实际增加两点。

## episode、存档与事务合同

- 新实例的 `instanceKey=chainId:创建日`，`instanceId=content:instanceKey`；携带 `episodeSchemaVersion=1`、`defId`、`definitionVersion` 和当前 `nodeId`。
- 公开按钮固定五元预期 token：`expectedInstanceKey/expectedInstanceId/expectedDefId/expectedDefinitionVersion/expectedNodeId`。点击传原 token，经会话/身份 CAS 后才评估 Gate 和效果；旧按钮、缺字段和未知定义版本拒绝，调用方不得替用户静默刷新 token。
- choice、fallback、自治通用路径的效果收据及历史使用原 episode 身份；effect 去重与 completed 账本按 episode 隔离。CommandBus 的同命令重放不再支付或发奖；已结算 fallback 的相同原 token 重试只可返回幂等结果。
- SAVE21 为 opt-in repeatable 增加身份字段，保持非重复旧链投影与回放 golden。完整旧 writer 夹具必须经过实际 loader；缺身份按原 `startedAt` 推导，不能用加载时的当前日。旧一次性完成记录保留，保守阻挡该保存日一次，不补历史选择或奖励。
- 永久藏粮 flag 随 SAVE21 保存，跨日、刷新和新 episode 都不复原。取粮事务的粮食、共振仪表、flag、历史任一效果失败须一起回滚；不能只回滚粮食。

## 六视角合理性账本

| 视角 | 合理性与检查 |
| --- | --- |
| 玩家 | 收益、代价和每局一次公开可见；留守不假称缓解配给，旧按钮不能结算新实例。 |
| 营地 | 两份粮食来自有限应急点，首次取回后不可再领；每日消耗保持既有规则。确认不额外收费；原短缺后果读取真实库存独立落账。 |
| NPC | 后勤职责和健康状态决定资格，允许现有健康继任者；不复活、不补人、不制造队伍或离岗事实。 |
| 势力 | 本事件不涉及交易或援助，不改变任何势力信任、立场或奖励。 |
| 敌人 | 取粮只提高共振压力，后续敌人行为继续由既有生态规则兑现；不在本事件直接刷怪。 |
| 全局链 | 可暂不处理并继续主线；窗口结束时自动 ledger-only。短缺结算后可跨日重开，有限藏粮不随实例重置；旧一次性完成历史不能隐藏新 episode 菜单。 |

## 选择激励与定义适配

同起点四策略实验确认旧v1确认比延期多付2崩溃；v2移除此点击税，不追加忽略惩罚。面板显示实际库存、基础日需、下一午夜配给，以及个人用餐／据点维护另计；补粮后明确这是原预警、当前基础供给已缓解。原可选episode仍保留，库存改善不自动完成或重置藏粮。相同起点v2确认／延期的首次午夜数值一致，只证明此局部问题消除，不证明全面平衡或真人偏好。

按[定义适配ADR](../decisions/ADR-20261017-shortage-choice-v2.md)，完整已知v1未结算active与另识别的缺版本旧shape在纯draft中适配到2；保持原身份、创建时间、actor与资源。实际成功安装时只记录一次save.migrated元数据；v1旧token拒绝，renderer新绑定2。畸形／未知声明版本拒绝。已结算v1 ration的+2和旧forage历史／永久flag不退款、不补奖、不重开同日。校验／准备不得修改原输入、state、RNG、registry或发收据。

关闭/暂不处理仍保留待办并承担原配给／需求后果，当前没有公开skip。有限来源和确认承担不同的账务意义，不包装成对称战术收益；多日节奏与玩家理解仍待验。

## 验收与证据边界

| 层次 | 必须核对 |
| --- | --- |
| 源码 VM | `scripts/check-content-episode-v1.mjs`：完整旧 writer 加性迁移、原身份恢复、五元 CAS 各字段拒绝、同命令重复、旧日按钮/新日实例、未处理实例跨午夜、夜间/过期、有限藏粮/继任/失败回滚。 |
| 关联回归 | `scripts/check-gameplay-vertical-slice.mjs`、`scripts/check-event-gate-v1.mjs`、`scripts/check-observer-expression-v1.mjs` 与原链 replay golden；仅声明各 runner 实际覆盖范围。 |
| 真实浏览器夹具 | `scripts/browser-content-episode-v1.mjs`：boot 前注入完整旧 writer 保存，经公开按钮继续、选择、真实结算、刷新和继续；核两次 HTTP 文档字节、保存 flag/粮食/共振仪表/原身份及无页面错误。 |
| 最终候选 | 最后源码变动后重跑关联检查；manifest 精确绑定 commit、HTML SHA、输入/runner/报告工件。旧候选的绿色与截图保留为旧证据，不迁移成新构建通过。 |

本轮已有 source-VM 和真实 Chrome fixture-browser 运行结果；精确计数与字节绑定由 QA 记录和 manifest 管理，不在设计卡固定会过期的 SHA。fixture-browser 不能证明自然多日节奏、平衡或主线全通。Scenario JSON 已经实际启动并驱动本条闭合单节点定义，尚无任意事件图编译或可视编辑器；Observer 仅为纯表达核心和深冻结白名单，actor 权限与感知来源投影仍待完成。Sites 生产 v81 未发布本卡。
