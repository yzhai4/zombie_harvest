# relay handoff CAS QA

**日期：** 2026-10-16  
**范围：** `handoffRelayCore`、CommandBus、relay 事件账本和保存重载  
**状态：** 已接线开发分支；生产 Sites v81 未部署

## 远端证据

CI #221（run `38903875646`，static-validation job `116982495547`）通过，权威源码 `dist/index.html` SHA-256 为 `f018d6639d415426960add45220389535aa4010d58c1c631a055b8da62461f71`。source-daytime-combat 为 24/24，包含本切片的 handoff CAS 夹具；GateV1 shadow 7/7，完整 inline/shadow fixture parity 11/11，content-chain 54/54，static smoke 55/55。

## 夹具覆盖

- 正常交接：四元 token 写入 replay/receipt，项目进入 `briefed`，核心从库存扣除一次。
- stale instance：在 Gate 和业务 reducer 前拒绝，保持 relayProject、specialItems、长官状态不变。
- stale event：成功交接后用旧 token 重试，得到 `event-state-conflict`，不重复声望或物品效果。
- save→reload：交接事件 identity 从保存账本恢复，旧 token 仍被拒绝。
- 原有 read-only relay Gate、夜间隔离、CommandBus 拒绝和昼间战斗合同继续通过。

## 六视角与限制

玩家看到可重试的冲突而不是重复奖励；NPC 长官的存活/距离仍由真实 reducer 校验；营地资源、状态和声望只在一次成功交接中改变；本轮没有新增势力关系；敌人预测仍由既有中继状态推进；全局链保留 instance/definition/version/event、command.rejected 和 replay。

该 QA 不证明浏览器自然试玩、领袖 LLM 已传递 token、施工/上线自治阶段已成为 Choice resolver，也不证明完整中继链 EventEffect/CAS 迁移。Python Playwright 在当前环境不可用。
