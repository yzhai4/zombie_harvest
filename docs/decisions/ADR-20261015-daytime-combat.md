# ADR-20261015：白天战斗互伤最小闭环

- **状态：** accepted-for-slice
- **日期：** 2026-10-15
- **范围：** 白天 `worldZombies`、NPC、防御塔与玩家的索敌、伤害、死亡/失活和回放收据
- **关联问题：** `PROB-20261015-daytime-combat-gap.md`
- **不变：** `SAVE_VERSION=21`、`CONTENT_SCHEMA_VERSION=3`、夜间 `nightBattle` 独立运行

## 问题

原白天路径只有“感知→锁定→移动目标”：`updateNpcPerception`、`updateEnemyPerception` 和 `simulateWorldZombies` 会更新目标，但 NPC、塔和活动敌人不会改变彼此 HP。塔和 NPC 的伤害只在夜间 `battleTick` 中发生。

## 本轮决定

在 `advanceReducer` 的白天固定分钟步中，先完成感知与连续移动，再运行 `runDayCombat(minutes)`。所有白天命中都经过 `applyDayCombatDamage`，产生 `combat.damage.applied`；击杀/失活产生 `combat.entity.defeated`。这些事件继承当前 `world.advance` 的 command/causation 上下文，可进入现有事件账本和 replay。

本轮保留夜战数据结构，不把 `worldZombies` 与 `nightBattle.enemies` 合并：

- NPC 只有守卫/巡逻/掩护岗位或已被请求支援时才可攻击；必须满足范围和视线。
- 瞭望塔与火油塔拥有注册化的昼夜战斗属性、默认 HP/maxHP、范围、伤害和 cadence；`active=false` 时停止索敌/开火。
- 活动敌人按既有敌人 profile 在接触范围攻击玩家、NPC 或防御塔；未知/死亡/失活目标不结算。
- NPC 受伤同步 `hp/combatHp/lifeState/wounds/stress/SAN`；死亡复用既有岗位空缺和继任副作用，只结算一次。
- 塔被击毁后写 `active=false`；敌人 HP 归零后立即从 `worldZombies` 投影移除，避免 SAVE21 validator 接收零 HP 敌人。

## 昼夜、阵营与守恒

DAY 的攻击只由 `SessionController.mode === 'DAY'` 且 `state.night === false` 触发；进入夜间后不再运行白天战斗。营地 NPC/塔/玩家对感染者合法，营地内部不友伤。资源、人口、岗位、营地生命和 campCollapse 不因普通命中隐式增加；拒绝、超距、无视线、失活和死亡目标不写成功伤害 receipt。

本轮的昼间数值为轻量近景规则：普通塔 10 damage/12 分钟、火油塔 16 damage/8 分钟、守卫 NPC 约 8 damage/10 分钟、普通/快速/装甲敌人分别 6/8/14 damage/12 分钟。夜潮数值和 barrier 结算不改。

## 回放与迁移边界

本轮不新增 SAVE/CONTENT 版本。旧 SAVE18/SAVE21 缺少 `combatClock`、`attackClock`、塔 `maxHp` 或 `active` 时使用运行时安全默认值，不补造历史伤害、击杀或事件；保存后重复 reload 不应再次运行过去的战斗步。未来统一 `CombatIntentV1 → CombatReducer` 时，需把本轮 `applyDayCombatDamage` 收据迁移为 canonical intent/receipt，并补齐批处理排序和命令级幂等。

## 验收出口

`scripts/check-daytime-combat.mjs` 必须覆盖：

1. NPC→敌人、塔→敌人、敌人→NPC 的真实 HP 变化。
2. 伤害收据的 source/target/phase/sourceEventId。
3. inactive 塔、夜间 Gate、超距/无视线和死亡目标不造成伤害。
4. NPC 受伤状态、塔失活、敌人清理和一次性死亡副作用。
5. 保存/回放不重复扣血；旧夜战仍由 `battleTick` 结算。
6. 玩家、NPC、营地、势力、敌人、全局事件链六视角守恒报告。

## 非目标

本 ADR 不接入线上 LLM、不修改 Sites、不合并夜战和白天敌人、不在 UI 层伪造伤害数字，也不声称已完成 14 天自然回归。

## Intent batch extension (2026-10-16)

昼间最小闭环现已先收集 `CombatIntent` 再按稳定键 `sourceId → targetId → attackSeq` 排序结算。每个命中收据包含 `intentId`、`attackSeq` 和 `profileId`；玩家、NPC、塔和活动敌人共享同一白天 tick，拒绝/死亡目标不会重新扣血。该实现仍是 inline runtime 内部合同，尚未宣称独立 `CombatIntentV1` schema；后续需把它抽成可复用 reducer，并补墙体/建筑目标、事件 resolve 清理、命令级幂等和跨构建 replay hash。


## 防御建筑目标扩展（2026-10-16）

活动敌人的昼间目标集合已扩展到瞭望塔、火油塔、木墙、尖刺栅栏、掩体、仓库和广播中继站。建筑 HP 归零时写入同一 `combat.entity.defeated` 并置 `active=false`；墙体/建筑不穿透移动碰撞，campCollapse 不因普通命中隐式追加。新增 VM 夹具覆盖敌人→墙体，仍保持夜潮 barrier 结算独立。


## CombatIntentV1 内部合同（2026-10-16）

昼间 intent 现在显式带有 `schemaVersion=CombatIntentV1`、`intentId`、`sourceRef`、`targetRef`、`phase=DAY`、`attackSeq`、`profileId`、`amount` 与 `damageType`。结算前执行最小结构校验，非法 intent 写 `combat.intent.rejected`，不改变 HP、资源、人口或事件链。该合同仍嵌在现有 runtime 内，后续再抽成独立模块并接入命令级幂等。
