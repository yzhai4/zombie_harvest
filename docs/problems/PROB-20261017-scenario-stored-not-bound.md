# Scenario 配置被保存，但未绑定真实启动

日期：2026-10-17。**状态：confirmed / open。** 范围：ScenarioPackageV1 headless 合同与内联 boot；修复方案仍 [proposed ADR](../decisions/ADR-20261017-scenario-boot-contract.md)，未接线。生产 Sites v81 未改变。

## 复现与影响

只读源码检查发现，`startFromSave` 从 `INITIAL_PROGRESS_STATE` 或 `prepareSavedPayload` 安装状态，没有调用 package resolver/loader。`SCENARIO_RUNTIME_STORYLETS` 手写定义直接注册；JSON 包尚不能控制真实运行时。`scenarioSnapshot` 能保存 worldConfig，却没有对应的配置 consumer。

纯 Node 与真实内联 VM 的只读探针得到以下结果；没有修改磁盘、访问远程或启动浏览器：

| 输入或路径 | 实际结果 | 风险 |
| --- | --- | --- |
| `createScenarioSnapshot(package)` 直接作为完整 SAVE21 的 snapshot | validator 拒绝 `scenario-snapshot`，输出缺 `schemaVersion` | headless 输出与真实存档接口不相容 |
| 顶层 observer authority=`write_state` | package validator 接受 | 只有一个 expression 路径被校验；接入前需完整 authority 门禁 |
| 未知 trigger/op 或 `retrievalLimit=0` | package validator 接受 | 不能把三项正例测试称为可执行包校验 |
| 未知 difficulty profile | 保留未知名称，实际用 standard | 保存标签与执行语义不一致 |
| food/population 值 0、seed=-1 | resolver 分别吞为 1/10、接受负 seed | 零值和 seed 合同不明确 |
| SAVE21 aiConfig 含未实现 flag=true、未知 authority | validator 接受 | metadata 不等于能力已支持 |
| `registerContentPack` 后项失败 | 逐项注册没有全包原子提交 | 接线前必须避免部分内容残留 |

真实随机函数读取 `worldMeta.rngState`，而不是 snapshot.seed。初始世界和 replay 使用常量 WORLD_SEED；缺 snapshot 的旧档被补当前默认，未记录其配置是未绑定来源。不能因此声称已完成自定义 seed/config 开局或可复现 Scenario 加载。由于包尚未进入 boot，以上接受行为不等于已有模型可以越权写状态。

## 修复边界

采用 ADR 的单一纯核心、真实 boot candidate、完整编译定义和原子注册。先支持新局 uint32 seed（含0）、Observer 开关与明确的初始食物配置轴；其余只接受已实现基线，非默认请求显式拒绝。Snapshot 输出、SAVE21 validator/writer 与实际 consumer 必须一致。

旧 writer 恢复保留既有世界，不重新 scale 初始库存、不 reseed 随机进度、不补 NPC 或奖励；缺 snapshot 标注 legacy-unbound，未知未来版本/authority/digest 按明确兼容策略拒绝或记录降级。不能把缺字段与损坏混为一类。

## 关闭条件

执行 ADR 的实际 boot、JSON→registry→reducer、seed/config 生效、非法能力拒绝、原子失败、完整旧 writer 与 reload 合同；冻结源码/包/runner 后补浏览器新局和恢复证据。需有 applied 与 baseline-only/deferred 的清单，不能仅展示 snapshot 字段相等。

`check-scenario-package-v1` 当前三个正例、断粮 fixture-browser 或 `server-three-days` 公开训练日历回归都不单独关闭本问题；后者即使 strict-fresh 通过，也不是自然玩法/平衡或 Scenario loader 验收。失败、未完成和旧构建证据分别保留。

开发增量：d6592443／a2fcdb64的C1列明source120／Chrome134与旧writer验收已完成，见[QA](../qa/scenario-boot-c1-20261017.md)。C2 JSON编译/原子注册、ActorObservation与生产仍未完成；保留以上原问题和失败。
