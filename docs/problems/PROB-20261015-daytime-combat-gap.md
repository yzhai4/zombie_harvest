# PROB-20261015：白天索敌存在但互相不掉血

- **状态：** fixed-in-slice
- **发现：** 2026-10-15
- **影响：** 白天 NPC 和防御塔能写入目标/警戒状态，活动敌人也能追踪 NPC，但没有统一伤害结算；玩家是白天唯一真正扣除 `worldZombies.hp` 的主体。
- **复现：** 在 DAY 中让守卫 NPC、瞭望塔和 `worldZombies` 进入视线/射程，推进 `advance`；原实现只更新 perception/goal，NPC、塔、敌人 HP 不变。
- **根因：** `simulateWorldZombies` 只做补充生成、感知和追踪；塔/NPC 伤害逻辑只在夜间 `battleTick`。
- **修复：** 新增昼间 `runDayCombat` 与统一 `applyDayCombatDamage`，补塔耐久/active 默认值、事件账本收据和昼夜 Gate；UI 改为“全天自动守备”。
- **验证：** `node scripts/check-daytime-combat.mjs` 6/6；`node scripts/check-inline-syntax.mjs` 通过。该验证是实际 inline runtime VM，不是浏览器自然试玩。
- **残留：** 后续仍需批处理 CombatIntentV1、敌方建筑/墙体接触攻击、真实 browser 多日回归和生产发布对账。