# NPC 剧情与英雄晋升模板

新增 NPC 必须属于固定人口 roster；普通 NPC 只有职责状态机，英雄 NPC 才拥有主动能力、营地被动和计划会投票权。剧情奖励必须转化为实际岗位、战斗、研究、物流或营地决策价值。

## 注册定义

```js
{
  npcId: "npc_new_01",
  contentVersion: 1,
  displayName: "新 NPC",
  tier: "ordinary",
  promotedTier: "hero",
  fixedRosterSlot: "farm_roster_07",
  role: "scavenger",
  traits: ["risk_taker", "loyal"],
  statsProfile: "scavenger_mid",
  storyArcs: [
    "missing_family",
    "black_soil_choice",
    "hero_promotion"
  ],
  affinityThresholds: [25, 50, 80],
  voteProfile: {
    defense: 0.8,
    research: 0.2,
    harvest: 0.6,
    logistics: 0.4,
    diplomacy: 0.5
  },
  commandUnlock: {
    type: "hero_promotion",
    requires: ["campTrust>=60", "storyArcComplete"]
  },
  campEffects: [
    { type: "production", key: "scavenge", value: 0.1 }
  ],
  abilitySlots: ["field_skill", "camp_passive"],
  deathBranches: ["replacement_scout", "route_lost"],
  absenceBranches: ["event_skipped", "autonomous_failure"],
  replacementRole: "scavenger"
}
```

## 剧情卡必须说明

- 全局目标：NPC 想保护、研究、夺回或隐瞒什么？与黑土、共鸣、营地和势力的关系是什么？
- 玩家关系：初始关系、可见需求、好感变化条件、拒绝或欺骗后的记忆。
- 自治路线：玩家不介入时 NPC 的岗位行为、投票倾向、风险选择和可能结果。
- 玩家路线：对话、探索、物品、战斗、派遣或营地计划如何改变结果。
- 英雄价值：主动技能、营地被动、计划会投票和可调度小队必须至少各写一项适用条件。
- 晋升条件：满好感或特定要求；未满足时不得被玩家调度为节点。
- 缺席路径：死亡、失踪、重伤、恐慌、拒绝合作和岗位被占用时的替代效果。
- 继任方式：是否可由现有 NPC 继任最低岗位功能；继任不能凭空增加人口。
- 事件账本：每个节点的事件 ID、效果、因果 ID、重复触发和保存字段。

## 属性和状态边界

- 核心属性使用 0–100：生命、力量、敏捷、意志、智力、耐力。
- 熟练度使用 0–10：武器、护甲、防御塔、建造、医疗、科研、农业、后勤、指挥。
- `SAN`、疲劳、饥饿、受伤、士气和关系沿用统一状态变更器，不在 NPC 剧情中直接覆写。
- 普通 NPC 不获得主动技能；晋升英雄时新增的能力必须绑定 `onPromotion` 事件并可被存档恢复。
- 英雄死亡或无法行动时，计划会和技能效果必须即时失效或降级；不能继续引用幽灵节点。

## 视角记录

- NPC 的自述/秘密：
- 营地对该 NPC 的评价：
- 其他英雄的投票关系：
- 玩家可观察线索：
- 敌人或黑土如何利用该 NPC 的弱点：
- 死亡、失踪、重伤和晋升后的世界日志文本：


