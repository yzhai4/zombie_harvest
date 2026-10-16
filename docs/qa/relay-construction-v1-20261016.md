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

