# 据点守军与人口账本（outpost-garrison-001）

**状态：** 已接线（v83 前置切片 + 最小捕获入口）  
**基线：** `SAVE_VERSION=21` / `CONTENT_SCHEMA_VERSION=3`  
**运行时入口：** `captureOutpost`、`outpostCaptureGate`、`selectOutpostGuards`、`outpostPopulationLedger`、`applyOutpostUpkeep`、`releaseNpcFromOutpost`

## 玩家承诺

玩家把固定 roster 中的可用守卫派往已发现据点后，会看到角色卡标记“驻守”，营地人口不会因此凭空增加；每天清晨该据点消耗定义中的 food upkeep。守军死亡或旧档缺少守军时，据点进入“空缺”状态并在账本留下原因。

## 触发、前置与降级

- `captureOutpost` 只能由已注册的 `OUTPOST_DEFS` 定义触发；地标条件、guardSlots、活跃 NPC 和 livingRoster≥3 必须满足。
- 地标探索完成后，玩家靠近已发现据点时，`contextActions` 显示“接管”入口；候选守军按健康优先、固定 roster 顺序确定性选取，并在按钮副文案中展示姓名、槽位和行动成本。
- 候选不足、体力不足、据点已占用和守军忙碌时，入口保留可解释的 Gate 文案；不会创建 NPC 或绕过核心岗位保护。
- 同一据点重复占领、同一 NPC 跨据点重复派驻、核心岗位或继任培训中的 NPC 作为守军都会被 Gate 拒绝。
- 旧存档没有 `garrisonedOutpostId`、`lastUpkeepDay` 或非法守军时，启动迁移清理无效引用，不生成 NPC；有守军记录但守军均失效时降级为 `vacant`。

## 节拍图与幂等

```text
captureOutpost -> outpost.secured -> 每日清晨 outpost.upkeep
                         |                  |
                  守军死亡/失效 -> outpost.guardReleased
                                         |
                                  vacant / strained
```

内容效果仍由统一 reducer 执行，`effectId` 重放沿用 `appliedEffects` 幂等键。每个据点在 `lastUpkeepDay` 防止同一天重复扣粮；食物不足不扣成负数，状态改为 `strained` 并使 `campCollapse +2`。

## 六视角合理性账本

| 视角 | 规则与可观察结果 |
| --- | --- |
| 玩家 | 靠近已发现据点后可从 contextActions 接管；按钮预览候选守军，成功后角色卡显示驻守，重复派驻和资源不足会收到可解释 Gate。 |
| NPC | 守军仍属于固定 livingRoster，但从 campLocal/workEligible 移出；死亡会解除标记和岗位占位。 |
| 营地 | `outpostPopulationLedger` 提供 livingRoster、workEligible、campLocal、garrisoned 四项派生账本；据点每日按定义扣 food。 |
| 势力 | 据点保持定义中的 `factionId`、补给距离和维护成本；本切片不凭空改变关系。 |
| 敌人 | 守军缺席会使据点空缺，缺粮会形成 strained 压力；本切片不改变夜战生成公式。 |
| 全局事件链 | `outpost.secured`、`outpost.upkeep`、`outpost.guardReleased` 写入事件账本和回放投影，后续支线可用稳定 outpost ID 接入。 |

## 不做项、回滚与验证

本切片只提供最小 contextActions 捕获入口，不新增战斗守军 AI、势力关系奖励或动态地图占领动画；这些属于 v83/v85 后续内容。回滚点是移除本卡对应的 reducer 分支和 NPC 字段，不改变 SAVE_VERSION；旧存档仍按安全默认读取。

```text
node scripts/validate-content.mjs
node scripts/check-night-guard.mjs
node scripts/smoke-three-days.mjs
node scripts/replay-harness.mjs --self-test
```


