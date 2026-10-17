# ADR-20261016：中继施工先冻结 EventInstance 事务边界

- **状态：** proposed shadow contract
- **日期：** 2026-10-16
- **范围：** `relay-chain-001` 的施工/上线阶段

## 背景

当前运行时的中继路径是 `handoffRelayCore → briefed`，之后由
`advanceReducer → updateRelayProject(minutes)` 直接推进 `staging`、筹料、
`building` 和 `online`。施工阶段会同时写 `relayProject`、库存、建筑、NPC
岗位和 `worldMeta.events`，但还没有独立的 `relay.projectAdvance` CommandBus
入口，也没有把跨存档的 EventInstance 身份带进自治步骤。重复 tick、旧 UI/规划
命令或材料不足因此没有一个统一的 CAS、幂等和整批回滚合同。

## 决策

先加入纯 Node shadow adapter `RelayConstructionV1`，冻结未来正式 reducer 必须
满足的边界，而不改浏览器/UI/自治路径：

1. 每个施工实例保存 `instanceId / defId / definitionVersion / latestEventId`，命令先做四元 CAS。
2. `briefed → staging → building → online` 是唯一允许的施工状态迁移；`unknown`、`core-recovered` 和 `online` 不能被施工命令越过。
3. 材料、工作分钟和参与岗位在预检阶段验证；资源不足、缺岗、夜间、负数或坏命令在任何状态写入前拒绝。
4. 同一 `commandId` 只结算一次；成功迁移写明确的 `constructionStarted`、`materialsCommitted`、`stationOnline` 事件类型和新 token。
5. 材料或资源扣除必须携带稳定的 `resourceSource`；来源会进入 receipt、施工事件和历史，且可由上下文约束，避免把库存扣除误归因给未知来源。
6. adapter 采用纯值返回，失败返回原实例快照，作为未来 reducer 的回滚参考；生产资源扣除和事件落账仍由正式 runtime 接线时实现。

实现文件：`scripts/lib/relay-construction-v1.mjs`，夹具：
`scripts/fixtures/relay-construction-v1.json`（13 个成功/拒绝用例，含来源与终态重入）。这是合同与可达性测试，不是
“施工已经接入 EventInstance/ContentChain”的声明。

## 事务 shadow 夹具（2026-10-16 增量）

在 producer trace 固定 world.advance → advanceReducer → updateRelayProject 后，新增
纯值 RelayConstructionTransactionV1 wrapper。它把既有实例 reducer 的结果包进
inventory、building occupancy、assigned NPC participant snapshot 三个可序列化
对象，按 prepare → apply → receipt 返回；任一 CAS、库存、占位、参与者或来源
预检失败都返回原 snapshot，成功事件附带 transaction/resource provenance。单独的
rollback 函数只恢复准备前快照，不写浏览器状态。

夹具 scripts/fixtures/relay-construction-transaction-v1.json 与 checker
覆盖 11 项：三阶段成功迁移、资源/占位/参与者失败、prepare 后快照冲突、重复命令、
rollback，以及 materialDelta/resourceDebits 不一致和 resourceSource 冲突。该 wrapper
仍是 shadow contract；没有 standing、forecast、EventLedger、CommandBus 或 Sites 接线。

## 不在本 ADR 内

- 不给现有 `recover/stage/online` 元数据 choice 添加未执行的 `requires`。
- 不替换 `updateRelayProject`、不改变 SAVE21/CONTENT3、不部署 Sites。
- 不在 shadow 层伪造领袖 LLM、浏览器或多日试玩证据。

## 回滚与下一步

删除或停用 shadow runner 不影响生产运行时。正式接线前必须沿真实命令生产者
补充：CAS→Gate→岗位/占位/库存预留→事务 reducer→receipt 的顺序、可核对的资源来源
账本、save→reload token、终态 stationOnline 单次约束，以及与同一 `world.advance` 中
CombatIntent 的确定顺序。

## Runtime stage adapter checkpoint（2026-10-16）

本轮把合同推进到一个可回放的最小运行时切片，但只开放 `briefed → staging`：

- 入口仍是 `world.advance → CommandBus → advanceReducer → updateRelayProject`；
  只有 `state.worldMeta.flags.relayConstructionTransactionV1 === true` 且项目为
  `briefed` 时，才生成一个 `relay.projectAdvance` 子命令并调用 adapter。默认世界
  没有该 flag，因此旧 reducer 结果保持 source-of-truth。
- 子命令通过既有 CommandBus 写入 `seenCommands` 与 `worldMeta.replay.commands`；
  重复 command 在 reducer 前返回 duplicate，不再写施工事实。
- adapter 在 CAS、昼间、岗位存活/在营、占位冲突预检通过后，原子写入项目 token、
  NPC 工作片段和真实 `relay.constructionStarted` EventLedger 事件。没有通过预检时
  不创建 station、不扣库存、不改施工状态；失败命令仍保留 replay/rejection 证据。
- 无既有 station 时只在成功提交后创建 `virtual` 占位的实际建筑；材料扣除、资源
  来源账本、`building → online`、standing/forecast 奖励和 SAVE schema 迁移仍留在
  后续闸门，不能把本切片称为完整施工迁移。

因此该 ADR 的运行时结论是 **feature-gated stage-only**；关闭 flag 与旧路径兼容，
不改变 Sites v81，也不代表浏览器自然多日验收。

## Runtime provenance correction（CI #259）

stage-only adapter 已在真实 `world.advance` producer 上运行，但必须明确其启用条件：只有开发/VM fixture 显式注入 `state.worldMeta.flags.relayConstructionTransactionV1 === true` 且 relay 项目为 `briefed` 时才产生 child command；默认关闭，没有 UI/URL 开关，也不改变 Sites v81。

CI #259（run `38921110774`，job `117040949418`）通过 runtime 8/8、producer 9/9、基础 13/13、事务 11/11、replay 15/hash `4aec7a31`、static smoke 55/55；权威源码 SHA-256 `9e8ee79f07ba0c204631ff13270e1e7a40292375e4a0e2a93cd0cd86a033227c`。`relay.constructionStarted` 事件顶层现在同时保留 child `commandId` 与父 `causationId`，checker 已覆盖该 provenance。

这仍是 feature-gated stage-only，而非完整 EventInstance/ContentChain 迁移；材料/来源 debit、building→online、standing/forecast、scheduler、SAVE/EventLedger 和浏览器验收继续按本 ADR 的后续闸门推进。
