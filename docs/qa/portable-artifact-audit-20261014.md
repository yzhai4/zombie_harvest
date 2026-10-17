# Attempt 8 工件迁移独立审计

结论：当前 exporter 迁移保真。此结论来自只读比较原文件与导出文件，不是游戏重跑，也不表示三日 smoke 已通过。

## 独立核对

- 原 Gate 与 portable Gate 逐项比较，共 71 项 artifact checks、2 项 developer checks。唯一不同字段是 `artifactChecks[0].detail.allowedRootCount`：原运行允许 2 个私有目录，导出副本允许 1 个目录；该项名称为 `allowed-files-and-report-json`，两份均通过。其余 check 的名称、通过状态、原因及 detail 完全一致，coverage 与 developer checks 也完全一致。
- 57 份完整保存、21 张截图，逐份读取原始文件和导出文件，78 份均逐字节相同；实际 SHA256、字节长度均与 manifest 一致。
- 使用 JavaScript UTF-16 字符序列上的 FNV 重新计算 57 份保存的 payload：全部与保存 envelope 的 checksum 和 manifest 的 FNV 一致。
- `original-report.json` 与源报告 SHA256 一致：`fa3dce81c90e871da1e879587fb4e36d1240f8cf95b6de27095dd79ed98a90e4`。
- portable report SHA256 与 manifest 一致：`1378066b10c02ecd3fe134ee05d02af7c7f4eef3df87589640727bb754c1d357`。与原 report 递归比较有 81 处字符串变化，全部是 manifest 明确声明的保存或截图路径替换；没有其他字段变化。
- manifest SHA256 为 `c596084237b12279580503b4245c59c2a687ee63cc13e8578bcdd4d6bd8ff9eb`。

## 保留的失败及覆盖限制

原 runner 和 portable report 的 `ok` 都为 `false`。两份 Gate 都为 69/71，通过状态没有被迁移改变；失败项仍为 `RUNNER_NOT_COMPLETE_OR_FAILED` 和 `FINAL_DAY_FOUR_ARTIFACT_MISSING`。原有未知源码快照、恢复历史及缺失日期刷新信息原样保留，迁移结果不增加游戏覆盖。

## 第 56 份保存时间校正

`56-calendar-day-4-reload-save.json` 实际 calendar 为第 4 天 00:25，envelope `savedAt=4345`，最后 `evt-002539` 的 `tick.world=4345`，metadata `domMinute=4345`，eventSeq 为 2539。`4325` 是摘要中的算术错误，不能用于恢复前态。该原文件与导出副本 SHA256 均为 `b6cc68ca01ce068ceeb392fa1fb5e41fb178f499172413e47a9867e9e2fa84f2`，checksum 为 `9787e965`。

本审计未修改原报告、profile、HTML、runner 或 exporter。私有机器分析结果保存在本地隔离 QA 缓存；仓库只记录上述审计事实。
