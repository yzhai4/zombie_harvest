# ADR-20261014：v82 NPC 英雄晋升与岗位继任契约

**状态：** accepted  
**范围：** v82 NPC/英雄/岗位继任竖切片  
**版本：** `SAVE_VERSION=21` / `CONTENT_SCHEMA_VERSION=3`

## 背景

游戏已有固定十人营地、个人事件链、SAN、计划会和人口守恒约束。若把“英雄”仅作为静态标签，玩家无法感知 NPC 的成长；若在死亡后直接生成新角色，又会破坏固定人口和回放一致性。因此需要把成长、玩家确认和岗位替代放进同一份可保存、可回放的状态契约。

## 决策

1. 每名 NPC 保存 `attributes` 和 `hero`。属性由模板人格和岗位推导，英雄状态使用 `ordinary/eligible/promoted` 生命周期。
2. 晋升进度由个人事件链、对玩家信任和 `campTrust` 组成；达到 100% 只进入 `eligible`，由玩家在白天花费 1 点 command point 确认。
3. 晋升效果通过 `npcRoster`、`npc.promotion.completed` 和事件账本落地，不能通过按钮回调直接跳过记录。
4. 岗位空缺保存在 `roleVacancies`。次日 `assignMorningSuccessors` 从现有健康 NPC 中选择候选，写入 `actingRole/actingFor` 和“继任培训”状态；无候选则保留 vacancy 并允许玩家临时协调。
5. 继任只恢复部分岗位效率，使用现有 `npcRoleEfficiency` 的培训折减，避免死亡后系统瞬间无损。

## 取舍

- 手动确认把英雄身份变成一个可读的玩家决策，并把 command point 与计划会资源联系起来；代价是玩家可能暂时保留 eligible 状态。
- 继任使用确定性优先级表，保证相同存档和输入得到相同候选；后续可由受限 RolePlanner 提议顺序，但仍必须经过 Intent Gate 和确定性执行器。
- 运行时仍集中在单 HTML 文件，模块化留到 v86；本轮只增加可迁移字段和最小 UI 显示。

## 影响与验证

- 旧档由 `normalizeNpc` 和 `migrateContentState` 补默认属性、英雄状态和 `npcRoster`。
- 五日回放夹具覆盖晋升和 `sergeant -> commander` 岗位替代；golden replay hash 更新为 `afa81420`。
- 静态验证、night guard、三日 smoke 和 replay self-test 必须全部通过；浏览器 smoke 当前受 Playwright 不可用限制，待环境恢复后补跑。

## 六视角合理性账本

- 玩家：条件、花费和结果可见，失败不扣资源。
- NPC：晋升由个人链、关系和营地信任共同解释；死亡 NPC 不会继续行动。
- 营地：岗位空缺、继任培训和效率折减可观察，人口总数不变。
- 势力：campTrust 是真实门槛，晋升会留下关系记忆和事件。
- 敌人：岗位缺失会影响防线/生产，培训期仍保留风险。
- 全局事件链：晋升与继任事件进入 ledger/replay，跨日边界有确定性处理。

