# Leader receipt 到 CommandBus 的桥接合同

这一步只核对现有生产边界，不执行真实 reducer，也不把领袖字段写入 SAVE21/CONTENT3。

`LeaderCommandBridgeV1` 固定营地指挥官第一条映射：

`support_proposal -> plan.meeting.commit -> plan.meeting.committed`

receipt 只携带稳定的 `intentId`、`commandId`、`eventIds`、`fallbackIntentId` 和 `replayHash`；现有 CommandBus 继续负责去重、阶段 Gate、CP 扣除、事件账本和 checkpoint。保存只复用已有 `worldMeta.replay.commands`、`worldMeta.seenCommands`、`contentState.commandPoints` 和 `contentState.planMeeting`。

在另一个 SAVE/replay migration ADR 通过前，原始 leader intent、模型文本和记忆摘要禁止进入生产存档。六视角仍分别检查玩家、NPC、营地、势力、敌人和全局事件链。

运行：

```text
node scripts/check-leader-command-bridge.mjs
```
