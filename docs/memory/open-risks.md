# 未关闭风险

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
