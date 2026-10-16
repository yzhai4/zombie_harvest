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
5. adapter 采用纯值返回，失败返回原实例快照，作为未来 reducer 的回滚参考；生产资源扣除和事件落账仍由正式 runtime 接线时实现。

实现文件：`scripts/lib/relay-construction-v1.mjs`，夹具：
`scripts/fixtures/relay-construction-v1.json`。这是合同与可达性测试，不是
“施工已经接入 EventInstance/ContentChain”的声明。

## 不在本 ADR 内

- 不给现有 `recover/stage/online` 元数据 choice 添加未执行的 `requires`。
- 不替换 `updateRelayProject`、不改变 SAVE21/CONTENT3、不部署 Sites。
- 不在 shadow 层伪造领袖 LLM、浏览器或多日试玩证据。

## 回滚与下一步

删除或停用 shadow runner 不影响生产运行时。正式接线前必须沿真实命令生产者
补充：CAS→Gate→岗位/占位/库存预留→事务 reducer→receipt 的顺序、资源来源
账本、save→reload token、与同一 `world.advance` 中 CombatIntent 的确定顺序。

