# ADR-20261016：中继核心交接使用四元 EventInstance CAS

- **状态：** accepted for v82 handoff slice
- **日期：** 2026-10-16
- **范围：** `handoffRelayCore` 命令入口

## 背景

中继链的交接已经有 EventDef/GateV1 元数据，但玩家 UI、旧存档或未来领袖规划器可能在营地长官、核心库存或中继状态改变后重放旧命令。只依赖 Gate 会把身份冲突和业务前置混在一起，也无法把拒绝写入统一回放账本。

## 决策

交接命令携带并在 CommandBus reducer 前校验四个期望值：

- `expectedInstanceId`
- `expectedDefId`
- `expectedDefinitionVersion`
- `expectedEventId`

校验顺序固定为 CAS → 只读 GateV1 → 长官存活/距离、特殊物品和项目状态业务校验 → 原交接 reducer。CAS 冲突只产生对应的 `command.rejected`；成功的 `relay.coreHandedOff` receipt 和 replay command 保留 token。保存/加载后从同一中继事件账本恢复最新 event identity。

## 边界

这项决策不把 `recover`、`stage`、`online` 的自治 reducer 伪装成 Choice resolver，也不改变原有资源、岗位、营地声望或敌人预测效果。施工/上线要另建正式 ContentChain/EventInstance 事务，并单独定义幂等与回滚。

## 回滚

若 token 迁移出现兼容问题，可在同一命令入口停用外部 token 校验并保留原业务校验；不要删除已有 receipts 或回放字段。恢复前必须保留 stale-command 负向夹具。
