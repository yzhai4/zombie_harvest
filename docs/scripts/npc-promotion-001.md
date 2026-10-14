# NPC 晋升与岗位继任：npc-promotion-001

**状态：** validated（v82 运行时竖切片）  
**对应版本：** `SAVE_VERSION=21` / `CONTENT_SCHEMA_VERSION=3`  
**对应实现：** `dist/index.html` 的 `evaluateNpcPromotion`、`promoteNpcHero`、`assignMorningSuccessors`

## 玩家承诺

玩家会先通过个人事件、关系和营地信任，看见一个普通 NPC 逐渐承担岗位责任；条件满足后，白天可以花费 1 点 command point，把这份临时责任确认成英雄身份。英雄得到一个主动技能、一个营地被动和小幅岗位属性提升。岗位主人死亡或失踪时，第二天由规则系统安排健康且未暂代其他岗位的 NPC 接班。

## 触发与前置

- NPC 必须仍在营地且 `lifeState=healthy`。
- 个人事件链进度、对玩家信任和 `campTrust` 共同决定晋升进度；进度达到 100% 后进入 `eligible`，不会自动消耗资源。
- 晋升只能在白天由玩家确认，消耗 1 点 command point；夜间请求被统一拒绝。
- 岗位继任只在白天开始阶段检查 `roleVacancies`，候选必须健康、在营地、没有 `actingRole`；候选暂代其他岗位时，原岗位 vacancy 仍然保留。
- 没有合适候选时保留 vacancy，并把 `tempCoordination` 留给玩家处理，避免凭空生成 NPC。

## 节拍图

```text
个人事件/关系变化
  -> evaluateNpcPromotion
  -> ordinary / locked -> eligible
  -> 玩家白天确认
  -> promoted + npc.promotion.completed

原岗位 NPC 死亡/失踪/离营
  -> roleVacancies
  -> 次日 assignMorningSuccessors
  -> 候选 actingRole=缺失岗位，scheduleState=继任培训
  -> 岗位效率恢复但带培训折减
```

晋升和继任均可重复调用而不重复结算：晋升完成后再次检查只返回已晋升；继任只接受没有有效岗位占用的 vacancy，并且每个候选只能暂代一个岗位。岗位是否已经履行由 `npcFulfillsRole` 判断当前 `actingRole || id`，避免暂代者误清自己的原岗位空缺。

## 状态契约

| 视角 | 变化 |
| --- | --- |
| 玩家 | 消耗 1 command point，获得明确的英雄技能和岗位反馈；条件不足时看到可解释的失败提示。 |
| NPC | `attributes` 保存岗位能力；`hero` 保存 tier/status/progress/skills/promotedDay；继任保存 `actingRole/actingFor/scheduleState`。 |
| 营地 | `npcRoster.promotedNpcIds/promotionHistory` 保存晋升事实；岗位空缺保存在 `roleVacancies`；继任岗位产出按效率折减。 |
| 势力 | `campTrust` 是晋升的一部分门槛；晋升完成写入事件账本并更新 NPC 记忆。 |
| 敌人 | 岗位缺失会让相应生产/防线能力降低；继任培训恢复功能但不抹平短期效率损失。 |
| 全局事件链 | 晋升与岗位替代通过 `npc.promotion.eligible`、`npc.promotion.completed` 和每日岗位账本留下可回放因果。 |

## 代价、失败与恢复

- command point 不足、夜间、NPC 不在场或尚未 eligible 时，命令不改变状态。
- 英雄晋升后不返还 command point；错误选择只能通过存档回滚恢复。
- 死亡/失踪的 NPC 不会被继任系统重新激活；岗位候选不足时营地进入可见的岗位空缺状态。
- 继任候选的原岗位会留下 vacancy，允许后续形成有限的岗位链，不创造人口。

## 实现映射与验证

- 运行时：`NPC_ATTRIBUTE_DEFAULTS`、`npcHeroState`、`evaluateNpcPromotion`、`promoteNpcHero`、`assignMorningSuccessors`。
- 存档：`contentState.npcRoster` 有安全默认值，`normalizeNpc` 为旧 NPC 补齐 `attributes/hero`。
- 回放：`scripts/replay-harness.mjs` 的 `five-day-npc` 夹具断言 `carpenter` 已晋升、`sergeant` 暂代 `commander`，契约 hash 为 `afa81420`。
- 验证：`node scripts/validate-content.mjs`、`node scripts/check-night-guard.mjs`、`node scripts/smoke-three-days.mjs`、`node scripts/replay-harness.mjs --self-test`。

## 回滚点

若晋升条件造成节奏失衡，可回滚本卡对应的 `dist/index.html` 变更和五日夹具；保留 `SAVE_VERSION=21` 的迁移兼容，不通过降低版本号掩盖状态差异。

