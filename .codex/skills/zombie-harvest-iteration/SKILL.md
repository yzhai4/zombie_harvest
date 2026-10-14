---
name: zombie-harvest-iteration
description: 维护尸潮农场的跨内容、规则、AI、实验和发布迭代；用于把一个主题从设计卡推进到可回放实现、headless 实验和交接记录。
---

# 尸潮农场整轮迭代

先读取 `docs/memory/current-state.md`、`docs/memory/open-risks.md`、`docs/project-memory.md`、`docs/long-term-plan.md` 和 `docs/iteration-workflow.md`，再按任务加载 `剧本/尸潮农场/01–09`、`11–16` 和相关 `docs/scripts`。不要把聊天内容当作规则真相。

## 选择迭代模式

- **内容模式**：新增或修改主线、支线、NPC、势力、科技、建筑和武器；同时遵守 `zombie-harvest-content`。
- **运行时模式**：修改 GameState、CommandBus、reducer、事件账本、保存、回放或 UI；先写状态/迁移/幂等契约。
- **AI 模式**：LLM 只输出声明式 `Intent`；必须经过观察投影、能力 Gate、预算和确定性执行器。
- **实验模式**：先固定 baseline、seed、contentVersion、模型和指标；结果写入 `docs/experiments/EXP-*.md`。
- **问题模式**：先创建 `docs/problems/PROB-*.md`，记录复现和影响，再修复并追加回归证据。
- **发布模式**：记录版本对账、验证命令、回放 hash、浏览器限制和可恢复回滚点。

## 固定顺序

1. 写主题、成功标准、不做项、风险和回滚点。
2. 读取 L0 规则真相，创建或更新剧本卡/状态契约。
3. 运行架构评审：schema、权限、昼夜边界、人口守恒、事务和迁移。
4. 实现最小闭环；跨系统变化只能从统一命令入口进入。
5. 运行静态校验、night guard、smoke、replay self-test 和相关夹具。
6. 若是 AI/实验任务，运行规则 baseline，再运行变体和 held-out seed。
7. 更新问题、实验、决策和交接记录；最后再进入下一主题。

## AI 运行时边界

LLM 不得直接改全局状态、生成人口/资源、跳过事件节点、读取未授权信息或调用未注册工具。模型输出应包含 `intentId`、`actorId`、目标、期限、资源预算、信息依据和 fallback。无效、超时、越权或模型不可用时回退到规则策略，并记录拒绝原因。

## 记忆与实验

- 稳定决策写 `docs/decisions/ADR-*.md`。
- 可复现问题写 `docs/problems/PROB-*.md`。
- 可比较实验写 `docs/experiments/EXP-*.md`，原始运行物放 `docs/experiments/runs/`。
- 每轮结束明确写“无新增记忆”或列出新增记录。
- 只把模型 ID、配置摘要、seed、commit 和指标写入仓库；凭据和临时路径不得进入记录。

## 必跑验证

```text
node scripts/validate-content.mjs
node scripts/check-night-guard.mjs
node scripts/smoke-three-days.mjs
node scripts/replay-harness.mjs --self-test
```

修改事件链、效果事务或命令结果时，还运行 `node scripts/check-content-chain.mjs`；它执行 HTML 中的真实函数，覆盖多节点、失败回滚、拒绝、重复和恢复。`smoke-three-days` 的 static fallback 与保存投影 hash 只能证明其覆盖的结构，不能代替 reducer 执行或真实多日游玩。源码命令轨迹 hash 和保存投影 hash 分别记录。

浏览器用保存夹具定位后期事件时，注明 fixture 模式，并在下次 boot 的 loader 之前注入：运行中改 localStorage 会被 pagehide checkpoint 覆盖。用 `scripts/server-content-chain.py` 验证事项切换、真实结算与刷新；自然试玩证据另行记录。

修改计划结算、每日指挥点、日历或附近区域交互时，执行 `scripts/check-plan-day.mjs` 和 `scripts/check-camp-area.mjs`。实际日历三日用 `scripts/server-three-days.py` 的公开行动路线：分别验日历跨日与遭遇次数、固定人口与营地生存、真实收获、每日配给/计划/指挥点及刷新。训练改变 SAN/士气，不能据此评价自然节奏或平衡；低信任零 CP 路线也不能证明非零已花 CP 的防回补。

同分钟动作等具体新 command/event 收据和真实变化写入存档，刷新去重等新正常时钟收据后检查。长测试保存阶段 checkpoint、原失败报告和各构建 hash，约30秒轮询已确认的进程；观察超时不重开。终止后只从同 profile 的真实保存恢复，并用关联 commandId/threatId 防止重复动作；不注入 runner checkpoint。

多日完成后以 `scripts/verify-three-days-artifacts.mjs` 只读核验原报告和完整保存工件，失败/阶段缺失仍 exit1，负控单列。保存校验之外，核对连续账本、具体计划/粮食来源、三场遭遇、真实收获和固定人口。未知源码 hash、多构建恢复、缺历史日期显式刷新必须披露，当前日补验不能改写历史结果。

跨机器归档先确认原runner确实终止，再用 `scripts/export-three-days-artifacts.mjs` 导出声明工件和不变原报告；不复制浏览器profile/凭据，不写入仓库或网页根。迁移后用manifest重新绑定路径并运行同一独立Gate，核对原字节SHA/FNV和实际coverage；导出成功不代表游戏通过。Windows私有输出须核验真实ACL，chmod不能代替。

AI 或实验变更还必须提供：baseline、变体、seed 集、失败重试策略、成本/延迟统计和 held-out 结果。
