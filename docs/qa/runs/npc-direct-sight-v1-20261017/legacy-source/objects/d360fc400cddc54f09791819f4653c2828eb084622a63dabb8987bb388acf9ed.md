# Scenario 配置被保存，但未绑定真实启动

日期：2026-10-17。**状态：resolved／C1+C2 声明支持范围已开发验收。** 真实启动、受支持初值、闭合 JSON 编译与内容绑定已按[boot ADR](../decisions/ADR-20261017-scenario-boot-contract.md)采用；见[C2 QA](../qa/scenario-boot-c2-20261017.md)。任意配置轴、任意图、Studio 和角色知识授权仍不在该关闭范围，生产未因本记录发布。

## 原始复现与影响（保留修复前事实）

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

以下为原关闭条件；C1+C2 已在声明支持矩阵内完成，实际记录见末节，原始反例与失败不改写。

执行 ADR 的实际 boot、JSON→registry→reducer、seed/config 生效、非法能力拒绝、原子失败、完整旧 writer 与 reload 合同；冻结源码/包/runner 后补浏览器新局和恢复证据。需有 applied 与 baseline-only/deferred 的清单，不能仅展示 snapshot 字段相等。

`check-scenario-package-v1` 当前三个正例、断粮 fixture-browser 或 `server-three-days` 公开训练日历回归都不单独关闭本问题；后者即使 strict-fresh 通过，也不是自然玩法/平衡或 Scenario loader 验收。失败、未完成和旧构建证据分别保留。

历史开发增量：d6592443／a2fcdb64的C1列明source120／Chrome134与旧writer验收已完成，见[QA](../qa/scenario-boot-c1-20261017.md)。当时C2／ActorObservation／生产尚未完成；该时点保留，C2后续状态见下节。

## C1+C2 关闭记录（2026-10-17）

源码 a544a6139e19c21f89526e3aafed11162d885552／HTML61ea64b27a65cc4a271c214c16126b40a453eae40c8684c106bc8edc89e5f115。C1真实消费新局seed和有限初始food；C2去掉手写内容旁路，将完整JSON编译为真实定义，显式私有lookup准备、一次目录安装、独立contentBinding及已知C1一次adapter保留原binding／seed／RNG／资源／人口／伤亡／驻守／cache／episode事实。未知内容身份拒绝并保原存储，不靠drop链或重开奖励恢复。

最终40 unique源码合同有通过结果，123次执行为108 pass／15原fail保留，列明pure14／C1 source120／C2 source66。实际C2 Chrome102及六关联361，共463检查、errors0；C2主文档5 canonical＋5独立variant，关联55 canonical。公开新局、作者v2／v3实际取粮、旧档一次迁入、未知拒绝及晚项坏包无部分提交的原件见[C2 QA](../qa/scenario-boot-c2-20261017.md)。变体不代canonical任意配置通过。

本片关闭“配置只保存、未消费”的声明范围问题；一节点两终态选择语法以外的事件图、Studio、更多配置轴和多版本内容仍另立工作。没有新natural run，休整六场verified／trusted hidden unavailable；不关闭自然三日、平衡或玩家体验。最终证据HEAD的exact CI待核，不声明远端ref更新或生产部署。下一ActorObservation须核实际actor／perception授权，纯只读expression不替代授权，再后才接NPC规划、记忆与LLM表达。
