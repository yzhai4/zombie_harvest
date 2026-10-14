# ADR-20261014-v83：据点守军必须占用固定人口并按日结算维护

**状态：** validated  
**范围：** v83 前置切片 `outpost-garrison-001`

## 决策

据点守军以 NPC 上的 `garrisonedOutpostId` 作为唯一占用标记；据点存档只保存守军 ID、状态和 `lastUpkeepDay`。`captureOutpost` 在统一内容效果 reducer 内做重复派驻、核心岗位、最低人口和守军槽位 Gate。每日清晨由 `applyOutpostUpkeep` 按 `OUTPOST_DEFS.upkeep.food` 结算一次。

## 原因

旧实现只写 `contentState.outposts[outpostId].guardNpcIds`，没有反向标记 NPC，导致同一幸存者可以同时留在营地岗位和多个据点，且重复点击会覆盖原记录；维护成本也没有进入事件账本。该行为违反固定人口守恒和可回放原则。

## 取舍

- 不提升 `CONTENT_SCHEMA_VERSION`：新字段均为可选安全默认值，旧存档由迁移清理无效引用。
- 缺粮先进入 `strained` 并增加 `campCollapse`，不直接摧毁据点或创建替代 NPC，给后续内容留下可恢复空间。
- 守军死亡立即写 `outpost.guardReleased` 并置 `vacant`；重新占领仍需要新的有效 NPC 和 Gate。

## 证据

- `scripts/replay-harness.mjs` 的 `outpost-garrison` 夹具验证守军投影和第 2 天 upkeep。
- `scripts/smoke-three-days.mjs` 静态契约检查 ledger、upkeep 和 replay fixture。
- 运行时事件账本包含 `outpost.secured`、`outpost.upkeep`、`outpost.guardReleased`。


