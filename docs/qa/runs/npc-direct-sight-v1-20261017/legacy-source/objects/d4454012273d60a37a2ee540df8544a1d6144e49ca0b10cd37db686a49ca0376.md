# PROB-20261012-save-version-drift

状态：validated  
影响：medium

## 复现

在仓库根目录运行：

```text
node scripts/validate-content.mjs
```

## 预期与实际

历史复现时，验证脚本要求 `SAVE_VERSION = 20` 和 `CONTENT_SCHEMA_VERSION = 2`，而运行时已出现 `SAVE_VERSION = 21`、`CONTENT_SCHEMA_VERSION = 3`。这次漂移已在 v82 中正式收口，记录保留用于追溯根因。

## 根因假设（已确认）

运行时代码、夹具、交接文档和验证脚本处于不同的未提交迭代状态；v82 继续开发需要把 NPC roster 状态纳入同一份迁移契约。

## 修复或回滚

该问题已在 v82 正式升到 `SAVE_VERSION=21` / `CONTENT_SCHEMA_VERSION=3`，并补齐迁移、夹具、交接包和 validator。后续新增状态字段继续沿用同一原则，不能只修改 validator 来隐藏差异。

## 回归命令与证据

- `node scripts/check-night-guard.mjs`：通过。
- `node scripts/replay-harness.mjs --self-test`：通过，6 个夹具，当前回放 hash `afa81420`。
- `node scripts/validate-content.mjs`：通过，已统一 SAVE21/CONTENT3。
- `node scripts/smoke-three-days.mjs`：43 项通过；Playwright 不可用。

## 修复结果

v82 正式采用 SAVE21/CONTENT3，补齐 `npcRoster`、NPC attributes/hero 默认值、旧档迁移和六份存档夹具（含五日 NPC 晋升与岗位替代夹具）；加入岗位继任投影后，回放黄金 hash 更新为 `afa81420`。后续新增 schema 必须创建新的问题记录并先完成迁移夹具。

