# 未关闭风险

## 当前检查点（2026-10-17）

| 未关闭项 | 当前边界与下一闸门 |
| --- | --- |
| 证据维护 | 最终候选 episode30/observer21/Gate parity20/vertical5、30条本地 exit0 与 Chrome fixture12/12 已重跑；严格检查器76方法负控，commit/HTML/runner/原始报告绑定见 manifest。后续源码变更须重新生成证据，pending不能通过。 |
| 自然多日与平衡 | 本轮未做自然三日 browser；旧 strict-fresh 失败保持失败。源码推进和 boot fixture 不替代自然路线、人口/粮食守恒和日历证据。 |
| repeatable 身份与兼容 | 按[断粮合同](../scripts/zh-food-shortage-001.md)验证五元 token 不刷新、跨日 stale、完整旧 writer、fallback/自治回执、未知版本拒绝与事务回滚；仅 opt-in 增量 SAVE21，不是全局 EventInstance 迁移完毕。 |
| 内容来源 | 有限藏粮 flag 必须跨日/刷新保留，整局最多 +2 食物；留守不伪造配给缓解、势力奖励、人口或敌人 spawn。 |
| 选择激励 | 留守额外 +2 崩溃压力，但延后处理不产生该节点的额外结算；原有配给/需求/战斗后果照常。当前 UI 没有显性跳过，只有过期自动降级。需对照立即选择、保留待办、先补粮，不能把状态正确当成平衡完成。 |
| Scenario 与 Observer | Scenario loader 仍 headless minimal；Observer 已有纯核心/深冻结白名单，但 actor 权限、感知来源投影、持久记忆与 LLM 未完成。 |
| 生产发布 | Sites v81 未接入本轮；发布仍需最终构建证据、真实旧档与部署后 smoke，不能用开发 green 覆盖生产源线。 |

以下风险表和主题记录保留原历史时点；其中旧版本、计数和“下一步”不覆盖本节。长期研究仍遵循[调研 P0–P6](../qa/deep-research-baseline-20261017.md)，不因表达 stub 提前进入 World Model 或引擎迁移。

## 历史风险与验收记录

| 风险 | 影响 | 可能性 | 下一步检查 | 记录 |
| --- | --- | --- | --- | --- |
| SAVE/Content schema 与 validator、夹具漂移 | 高 | 高 | 统一 21/3 或回滚工作树变更 | `PROB-20261012-save-version-drift` |
| 运行时仍集中在单个 HTML 文件 | 高 | 高 | v86 抽离 GameCore 和 headless runner | `docs/long-term-plan.md` |
| LLM 规划器越权或信息泄露 | 高 | 中 | 先做 Intent schema、观察投影和 Safety Gate | `docs/long-term-plan.md` |
| Colab 运行时回收导致实验不完整 | 中 | 高 | 分片、checkpoint、run manifest 和外部 artifact | `docs/colab-t4-evaluation.md` |
| 自动指标与人工戏剧性评价冲突 | 高 | 中 | 建立 held-out 和人工评审集 | `docs/experiments/README.md` |
| 三日日历单构建从头回归仍缺 | 高 | 两轮第二日等待失败 | 原恢复439/Gate90保留；58a4第二轮392检查/104保存、跨机同Gate114/123仍FAILED，分段调查第15读取172秒与实际保存调度，不放宽合同或重开profile | `docs/qa/fresh-three-days-second-20261014.md` |
| ≥60秒原生后台追赶尚无browser证据 | 中 | 仅源码控制与短隐藏通过 | native B16实际2873ms；另做真实长隐藏补验，不能把短隐藏或伪clock称长catch-up | `docs/qa/report-recovery-browser-third-20261014.md` |
| 计划可靠性候选需持续守住真实browser合同 | 中 | faec已验证 | faec 7/7、203/203与164份工件已通过；后续新构建仍必须绑定自己的 source SHA，不能移用旧证据 | `docs/qa/plan-integrity-faec-browser-20261015.md` |
| 统一命令编号/维修proof需保持后续回归 | 中 | faec browser已覆盖计划/修墙合同 | 28/41及原380项、faec 7/7/203通过；自然三日与新增维修路径仍独立验收 | `docs/qa/command-repair-integration-20261014.md` |
| 领袖LLM runtime尚未接入 | 高 | offline contract已通过 | ProjectionV1/IntentEnvelopeV1/GateReport 已6/6通过，离线 replay/idempotence/fallback sandbox 5/5与 headless ledger adapter 6/6、CommandBus bridge contract 5/5 与真实 reducer bridge VM 6/6 已通过；下一步定义 leader actor 持久化和真实旧档回放，仍未验收成本预算 | `docs/decisions/ADR-20261014-leader-llm-harness.md`、`docs/scripts/leader-llm-harness-001.md` |
| 晋升英雄字段/断粮状态与计划投影未对齐 | 中 | 已确认源码差异 | 先统一设计冲突，再实现单一英雄/食物投影 | `PROB-20261014-plan-voter-projection` |

## 已通过主题与历史失败

报告恢复、失守重开、真实SAVE18/amount0适配与公开菜畦入口已在冻结412c/v4完整browser和独审通过：48/48场、1682/1682检查，见 `docs/qa/report-recovery-browser-third-20261014.md`。v1/v3原失败、旧crop错误预期及其原件保留；新通过不追溯修改历史结果，也不代表严格三日、14天全链或生产已经发布。


## 领袖持久化迁移风险更新（2026-10-15）

离线 harness 6/6、replay/idempotence/fallback sandbox 5/5、headless ledger adapter 6/6、CommandBus bridge 5/5、真实 reducer bridge VM 6/6 已通过；新增 ADR-20261015 将迁移边界标为 proposed。主要未关闭风险是 actor 归因和旧 SAVE18/SAVE21 replay 的语义兼容：当前收据仍是 `player-1`，不能在迁移时推断为 leader。实现前必须通过坏块整档恢复、重复 `intentId`、hash 稳定、资源/人口/时间守恒和六视角夹具。


## 白天战斗互伤切片（2026-10-15）

原“能索敌、不能掉血”问题已在开发 dist 修复：NPC/塔/活动敌人昼间命中、NPC受伤状态、塔失活、敌人清理和事件收据均有 6/6 inline runtime VM 证据。仍未关闭的后续风险是 CombatIntentV1 批处理排序、敌人对墙体/建筑的接触攻击、真实 browser 多日回归和 Sites 生产对账；本轮不把 VM 证据扩大为自然试玩或生产发布。

## GateV1 parity 与中继迁移风险更新（2026-10-16）

GateV1 的 inline/shadow 共享夹具 parity 已在 CI #210 通过 11/11，但这不覆盖任意畸形状态容器；`contentState.unlockedTech` 等异常形状仍需单独决定 fail-closed 合同。水车的效果事务仍是旧 content-effect DSL，尚未证明内容链 EventInstance/CAS 或 EventEffect 全量迁移。

relay-chain-001 的 `recover/stage/online` 由地标/自治 reducer 驱动，EventDef choices 只是元数据；若直接添加 choice.requires 会产生未执行门控。handoff 仍把状态、特殊物品、岗位/距离和 CommandBus 校验放在 reducer/validate，下一步需先建立显式 expected instance/definition/version/event 的 CAS adapter。生产 Sites v81 未改，浏览器多日回归仍未获得。

## relay handoff CAS 更新（2026-10-16）

handoff 的四元 CAS 已有 source VM 24/24 证据，正常交接与 stale 拒绝均通过；风险收敛到 CAS token 的 UI/LLM 传递、跨存档恢复后的 relay event identity，以及施工/上线自治阶段尚无正式 EventInstance/CAS 事务。下一轮需要真实 ContentChain 节点、效果回滚、重复命令和保存迁移夹具，不能把当前 handoff 证据扩大为完整中继链完成。

## RelayConstructionV1 shadow boundary and UI producer risk

The handoff token is now propagated by the real context-menu producer, but there is still no production leader-LLM relay producer; the leader bridge remains headless with productionWiring false. Relay construction and online autonomy still mutate project, inventory, NPC work state, building state and event ledger through updateRelayProject without the shadow adapter's atomic reducer boundary. Before runtime wiring, add a real command producer, material-source ledger, building-occupancy checks, same-tick ordering with CombatIntent, migration defaults and browser save/reload fixtures. Do not add Gate requires to metadata-only relay choices while they remain outside the resolver.


## 2026-10-16 relay shadow refinement

Resource provenance and terminal re-entry are now frozen in RelayConstructionV1 (13/13). The remaining runtime risks are unchanged but more concrete: the real `world.advance` producer still mutates relay materials/building/NPC work/event ledger directly; it needs a transactional CommandBus adapter with inventory reservation, building occupancy, same-tick CombatIntent ordering, save migration, and browser fixtures. Do not treat the shadow result or the headless leader harness as production autonomy evidence.

## RelayConstructionTransactionV1 shadow checkpoint（2026-10-16）

CI #253 / run `38912989111` 通过事务 shadow 11/11。当前已冻结跨对象纯值补丁的最小边界：CAS/participant/resource/occupancy 预检，inventory/building/NPC snapshot 原子结果，transaction/resource provenance，prepare 后快照冲突，重复 command 和纯回滚。
未关闭风险仍是生产路径由 `advanceReducer → updateRelayProject` 直接写多对象；shadow 没有真实 CommandBus producer、EventLedger、SAVE21 迁移、standing/forecast、同 tick CombatIntent 或 browser fixture。不得把 11/11 当作运行时接线或自然试玩证据。

## RelayConstructionTransactionV1 runtime stage checkpoint（2026-10-16）

生产路径首次有真实但 opt-in 的 stage adapter，风险边界收窄为：

- 默认关闭兼容性必须持续由 VM/CI digest 守护；任何默认开启都视为回归。
- 当前 adapter 只覆盖 `briefed → staging`，不负责材料/资源来源、`building → online`、standing/forecast 或完整 SAVE migration。
- child command 已进入 CommandBus replay/idempotency；需持续验证重放、旧存档 token 和事件 ledger 截断策略。
- station occupancy 仅在成功提交后写入；未来资源/建筑/同 tick CombatIntent 接线不得破坏这个原子边界。
- browser/Sites 证据仍缺失，不能把 Node VM 八项通过当作线上发布或自然多日玩法证明。

## Runtime stage checkpoint correction（2026-10-16，CI #259）

施工生产者现在只在开发/夹具 flag `state.worldMeta.flags.relayConstructionTransactionV1 === true` 下报告 `constructionCommandProducer:true`，模式为 `feature-gated-stage-only`；这不等于生产 wiring 或自然玩法。默认 flag 关闭，Sites v81、UI/URL 和 leader-LLM producer 均未启用。

CI #259（run `38921110774`，job `117040949418`）通过 runtime 8/8、producer 9/9、基础合同 13/13、事务 11/11、replay 15/hash `4aec7a31`、static smoke 55/55；当前源码 SHA-256 `9e8ee79f07ba0c204631ff13270e1e7a40292375e4a0e2a93cd0cd86a033227c`。事件 provenance 已修正为 `relay.constructionStarted.commandId=relay.projectAdvance child`、`causationId=world.advance`。

仍需优先消除的风险：生产资源/材料 debit 与 `resourceSource` 账本、完整 building footprint occupancy、`staging/building/online` 终态迁移、死亡/离岗替代 scheduler、施工对势力 standing 与敌人 forecast 的正式因果、同 tick CombatIntent 顺序、SAVE21/EventLedger 迁移，以及 browser save/reload fixture。


## 2026-10-17 新增风险

- 场景包尚未成为 runtime loader；当前 validator/resolver 只在 headless fixture 工作。
- Observer 投影范围偏窄，没有完整 ObservationV1 六视图、深冻结和模型记忆持久化。
- CI 没有 Python Playwright；source-VM 三日推进不能替代自然多日试玩。
- 调研结论是设计输入；Director/World Model/大规模自治社会仍延后。

## 2026-10-17 风险更新

- 断粮 storylet 现在真实接线，但 `completedChains` 仍使它成为一次性节点；重复 shortage 需要 episode/instance key 和新回放合同。
- forage 选择当前使用 quartermaster NPC 存活 Gate，尚未表达 garrison/actingRole/继任后的完整 role availability。
- CI #268 仍是 source-VM；Python Playwright unavailable，不能当作自然多日 browser 证据。


## 2026-10-17 风险更新（role availability）

- `role_available` 已覆盖当前岗位可履职判定，但一次性 `completedChains` 仍阻止重复 shortage episode。
- 完整 successor scheduler、role vacancy ledger 与 browser natural play 尚未进入本轮证据。


## 2026-10-17 风险更新（repeatable episode）

- 当前 repeatable contract 只用于断粮 storylet，尚未推广到所有 EventDef/ContentChain。
- episode key 还未进入统一 EventInstance/SAVE migration；跨版本旧档与 browser reload 仍未验。
- CI source-VM 4/4 和旧 golden 通过，Python Playwright unavailable，不能替代自然多日试玩。
