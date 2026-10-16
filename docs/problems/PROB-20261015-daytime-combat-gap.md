# PROB-20261015：白天索敌存在但互相不掉血

- **状态：** fixed-in-slice
- **发现：** 2026-10-15
- **影响：** 白天 NPC 和防御塔能写入目标/警戒状态，活动敌人也能追踪 NPC，但没有统一伤害结算；玩家是白天唯一真正扣除 `worldZombies.hp` 的主体。
- **复现：** 在 DAY 中让守卫 NPC、瞭望塔和 `worldZombies` 进入视线/射程，推进 `advance`；原实现只更新 perception/goal，NPC、塔、敌人 HP 不变。
- **根因：** `simulateWorldZombies` 只做补充生成、感知和追踪；塔/NPC 伤害逻辑只在夜间 `battleTick`。
- **修复：** 新增昼间 `runDayCombat` 与统一 `applyDayCombatDamage`，补塔耐久/active 默认值、事件账本收据和昼夜 Gate；UI 改为“全天自动守备”。
- **验证：** `node scripts/check-daytime-combat.mjs` 6/6；`node scripts/check-inline-syntax.mjs` 通过。该验证是实际 inline runtime VM，不是浏览器自然试玩。
- **残留：** 后续仍需批处理 CombatIntentV1、敌方建筑/墙体接触攻击、真实 browser 多日回归和生产发布对账。

## 排队事件边界（2026-10-16）

复核发现原事件 resolve 可能同步激活排队 NPC 事件；若清理 helper 读取变更后的当前事件，会留下原事件敌人或误删新事件敌人。修复后 helper 只接受 resolve 前捕获的 `instanceId/sourceEventId`，并以显式集合清理；新增 queued-event 夹具验证 12/12 通过。运行时仍待后续直接复用独立 CombatIntentV1 validator。


## 拒绝结算边界（2026-10-16）

补充回归发现资源不足的事件选择也必须保留活动敌人；修复后的清理仅在原事件真正进入 handled terminal 状态后执行。queued activation、rejected resolve 与普通成功 resolve 共同覆盖，昼间源检查为 13/13。


## Runtime 合同接线（2026-10-16）

原先 inline runtime 只做最小字段判断，存在与独立 CombatIntentV1 module 漂移风险。现已在实际运行时引入 canonical envelope validator，并用真实 VM checker 覆盖非法 phase、unknown field 与 statePatch；昼间回归扩展为 14/14。下一步仍需消除 inline 与 Node module 的双份实现。


## Event resolve identity race (2026-10-16)

A rendered daily choice could outlive a queued NPC event activation or a definition migration. Without a compare-and-swap token, an old click or planner result could resolve the wrong instance and make cleanup ambiguous. The runtime now validates `expectedInstanceId`, `expectedDefId`, `expectedDefinitionVersion`, and `expectedEventId` before `resolveEventReducer`; stale commands emit `command.rejected` and have no state or cleanup effect. Reducer-level resource failure emits `event.resolve.rejected`, while only a terminal handled result emits `event.resolved`. UI buttons snapshot and send the same token. The daytime source regression is 17/17; full Gate/precondition semantics and natural multi-day browser coverage remain open.
