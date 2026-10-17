# PROB-20261014-dead-npc-event-queue

状态：validated  
影响：medium

## 复现

1. 白天触发一个 NPC 个人事件，使其占用全局事件槽。
2. 在事件尚未选择时进入夜战，并让该 NPC 阵亡或离开活动 roster。
3. 夜战总结后回到白天，原事件仍可被选择；若其后还有排队事件，死亡 NPC 的事件还会阻塞队列。

## 根因

事件触发时保存了 NPC 身份，但结算前没有再次检查 `npcIsActive`。队列激活器只检查第一条 queued 记录，遇到失效 NPC 即返回，未继续寻找可用角色。

## 修复

- `resolveNpcEvent` 对失效 NPC 只写入 `npc.event.cancelled` 账本和可见降级文案，不执行需求、关系或资源效果。
- `activateQueuedNpcEvent` 逐项跳过并取消缺失/失效角色，直到激活下一条可用事件。
- 新增 `npc-dead-event` 回放夹具，覆盖死亡事件与后续存活 NPC 排队事件。

## 回归证据

- `node scripts/check-night-guard.mjs`：通过，含失效 NPC 事件降级和队列不阻塞静态门禁。
- `node scripts/validate-content.mjs`：通过。
- `node scripts/smoke-three-days.mjs`：静态 50/50 通过。
- `node scripts/replay-harness.mjs --self-test`：8 个夹具通过，hash `1a0b69b8`（同轮已合入据点人口夹具）。
- `node scripts/replay-harness.mjs --verify scripts/fixtures/npc-dead-event.json`：checksum 与迁移校验通过。

## 六视角结论

- 玩家：死亡角色的待处理请求不会凭空继续生效，能看到降级原因。
- NPC：死亡/失踪者不再获得新的需求或关系变化；存活者的排队事件可继续。
- 营地：不会凭空获得死者岗位或物资效果。
- 势力：事件账本保留取消事实，避免对营地贡献产生虚假记录。
- 敌人：夜战伤亡先于白天事件结算，敌人造成的后果不会被事件奖励抵消。
- 全局事件链：取消与后续激活都有稳定事件 ID，可回放且不会卡死全局槽位。

