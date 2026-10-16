# RelayConstructionV1 shadow QA

**日期：** 2026-10-16  
**状态：** shadow/design contract；生产 Sites v81 未部署

## 本轮结果

`node scripts/check-relay-construction-v1.mjs`：**13/13**。

夹具覆盖：

- `briefed → staging`、材料齐备后 `staging → building`、工作分钟达到目标后一次性 `building → online`；
- stale instance、stale event、缺岗、坏工时和资源不足均在状态写入前拒绝；
- 重复 `commandId` 不重复事件或进度；
- 有材料/资源移动时必须携带稳定 `resourceSource`，并写入 receipt/事件；
- JSON save→reload 后四元 token 保持一致；online 实例拒绝第二次 stationOnline。

## 当前生产路径与边界

远端 `dist/index.html` 的真实路径仍是 `handoffRelayCore` 写入 `briefed`，
`advanceReducer` 调用 `updateRelayProject(minutes)`，由该自治 reducer 直接写
材料、建筑、NPC 工作状态和 `worldMeta.events`。shadow adapter 没有被 UI、
CommandBus 或 Sites 调用；因此本报告不能证明浏览器施工、正式 EventEffect、
领袖 LLM token 传递或自然多日回归。

## 六视角检查

| 视角 | 本轮冻结的约束 | 仍待正式接线 |
| --- | --- | --- |
| 玩家 | 冲突、缺岗、材料不足可重试，不产生幽灵奖励 | UI 显示施工 token/失败原因 |
| NPC | 三个岗位必须在预检中保持活动 | 死亡/失踪与替代岗位的真实 reducer 事务 |
| 营地 | 材料达到需求才进入施工，完成才上线；资源移动有来源标识 | 库存来源账本、建筑占位和资源回滚 |
| 势力 | 本切片不凭空增加外交实体或关系 | 后续势力奖励的事件因果 |
| 敌人 | `stationOnline` 是唯一可消费的预警事实 | 与尸潮路线/压力计算的正式消费顺序 |
| 全局链 | 四元 CAS、命令幂等、资源来源、事件类型、终态单次和 save→reload token 固定 | EventLedger/CommandBus 正式施工入口 |

下一步在真实命令生产者审计后，再把 adapter 收敛到 runtime reducer；在此
之前不把 shadow 13/13 扩大为线上或浏览器验收。


## 运行时切片更新（2026-10-16）

原 shadow-only 结论已细化为：只有 `worldMeta.flags.relayConstructionTransactionV1 === true` 时，`briefed → staging` 走真实事务 adapter；默认关闭仍保持旧路径。该切片不等于完整 construction/online migration，也不提供 Sites 或浏览器自然玩法证据。

## Current evidence correction（CI #260）

上述“shadow-only”描述是历史基线。当前分支在开发/VM fixture 显式注入 `state.worldMeta.flags.relayConstructionTransactionV1 === true` 时，已由真实 `world.advance → CommandBus → advanceReducer → updateRelayProject` 产生一个 `relay.projectAdvance` child command，并只处理 `briefed → staging`；默认 flag 关闭，没有 UI/URL 入口，Sites v81 未变。

CI #260（run `38921845235`，job `117043468291`）通过 RelayConstructionV1 13/13、runtime stage 8/8、producer trace 9/9、事务 11/11、replay 15/hash `4aec7a31`、static smoke 55/55；当前源码 SHA-256 为 `9e8ee79f07ba0c204631ff13270e1e7a40292375e4a0e2a93cd0cd86a033227c`。施工事实顶层现在保留 child `commandId` 和父 `causationId`。

该切片仍不覆盖材料/资源 debit、building→online、standing/forecast、死亡/替代 scheduler、完整 EventLedger/SAVE 迁移或自然浏览器试玩；原报告其余 shadow 约束继续有效。
