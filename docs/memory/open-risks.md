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
| 计划可靠性新构建尚缺真实browser | 高 | 源码/renderer已通过 | 58a4已集成trust<60拒绝、同日冻结与phase-safe UI；48/69及177/43/27/16过，须公开七case/reload | `docs/qa/plan-integrity-integration-20261014.md` |
| 统一命令编号/维修proof尚缺公开browser | 高 | faec源码已集成 | 28/41及原380项通过；真实公开维修、两reload、支付/HP/推进因果仍待实际浏览器，不移用58a4三日或CI65 | `docs/qa/command-repair-integration-20261014.md` |
| 领袖LLM harness尚未实现 | 高 | 仅有长期计划与proposed ADR | 先做ProjectionV1/IntentEnvelopeV1/GateReport和规则baseline，再接headless受限模型；硬规则越权、旧档兼容、回放和成本预算未验收 | `docs/decisions/ADR-20261014-leader-llm-harness.md` |
| 晋升英雄字段/断粮状态与计划投影未对齐 | 中 | 已确认源码差异 | 先统一设计冲突，再实现单一英雄/食物投影 | `PROB-20261014-plan-voter-projection` |

## 已通过主题与历史失败

报告恢复、失守重开、真实SAVE18/amount0适配与公开菜畦入口已在冻结412c/v4完整browser和独审通过：48/48场、1682/1682检查，见 `docs/qa/report-recovery-browser-third-20261014.md`。v1/v3原失败、旧crop错误预期及其原件保留；新通过不追溯修改历史结果，也不代表严格三日、14天全链或生产已经发布。
