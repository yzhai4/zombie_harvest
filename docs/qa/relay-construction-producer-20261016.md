# relay construction producer trace QA

**日期：** 2026-10-16  
**状态：** source trace passed; construction migration still pending  
**分支：** `codex/v82-npc-succession`

## 远端证据

`node scripts/check-relay-construction-producer.mjs`：**9/9**。  
CI #243（run `38910651546`，static-validation job `117005336695`）通过。  
被追踪的权威 `dist/index.html` SHA-256：`1a5430620715363611914ad567f8b076253fbaa42bc200a10a93daf1bd53d463`。

## 当前真实生产链

```text
startWorldSimulation daytime interval
  -> advance(...)
  -> CommandBus.dispatch(world.advance)
  -> advanceReducer(amount)
  -> updateRelayProject(minutes)
  -> simulateWorldZombies
  -> runDayCombat
```

追踪器同时确认：

- `relay.projectAdvance` 只在 `relay-chain-001` 的 `stage/online` 注册元数据中出现，没有真实 dispatch 或 handler；
- `updateRelayProject` 本身没有 CommandBus 入口、持久化四元 EventInstance token 或事务回滚；
- 交接路径另有独立的 `relay.coreHandoff` producer，已携带四元 token；
- 自动推进来自白天 timer；夜间 timer 停止。该事实不能替代施工 reducer 的显式 DAY Gate；
- 输出显式标记 `constructionCommandProducer:false`、`registryChoiceMetadataOnly:true`、`productionWiring:false`、`naturalGameplay:false` 和 `migrationRequired:true`。

## 六视角出口

玩家、NPC、营地、势力、敌人和全局链的约束仍以 [六视角审计](./six-view-relay-construction-20261016.md) 与 13 项 shadow QA 为准。本追踪器只冻结调用链和证据边界，不把缺口当作失败，也不把元数据当作已接线能力。

## 下一闸门

下一轮先把 `world.advance` 的真实 producer 与纯 construction step 接到一个显式事务 adapter：读取四元 token，预检岗位/占位/资源来源，统一回滚并写 receipt/replay；再补 SAVE 迁移、死亡/替代岗位、同 tick CombatIntent 顺序和浏览器夹具。完成前不改 Sites、不宣称施工已迁移或自然多日验收已通过。

## Runtime stage adapter correction（2026-10-16）

上一段报告的 `constructionCommandProducer:false` 结论只适用于 shadow checkpoint，已由本轮真实 producer slice supersede。当前 checker 语义为：

- `constructionCommandProducer:true`，模式为 `feature-gated-stage-only`；只有 flag true 且 `briefed` 时生成一个 `relay.projectAdvance` child。
- `registryChoiceMetadataOnly:true` 仍成立：EventDef 的 stage/online 两个 `commandType` 仍是声明性 metadata，不代表 online 已接线。
- `productionWiring:'opt-in-stage-only'`；默认 flag false，旧路径保持兼容，`naturalGameplay:false` 和 `migrationRequired:true` 仍成立。

本段不覆盖材料/online/standing/forecast、完整 SAVE migration、browser 或 Sites v81。

## Current producer trace checkpoint（CI #259）

此前 CI #243/#244 的 `constructionCommandProducer:false` 是未接 adapter 的历史基线。当前分支在开发/夹具 flag 开启时已经有一个真实 stage producer，故当前输出为 `constructionCommandProducer:true`、`constructionCommandProducerMode:feature-gated-stage-only`、`productionWiring:opt-in-stage-only`；默认 flag 关闭，未提供 UI/URL 入口，Sites v81 和自然玩法仍未启用。

CI #259（run `38921110774`，job `117040949418`）通过 9/9 producer trace、8/8 runtime stage、13/13 基础合同、11/11 事务合同、15 replay fixtures/hash `4aec7a31` 和 55/55 static smoke。当前权威源码 SHA-256 为 `9e8ee79f07ba0c204631ff13270e1e7a40292375e4a0e2a93cd0cd86a033227c`。

trace 仍固定 `advance → CommandBus(world.advance) → advanceReducer → updateRelayProject`；stage child command 的事实事件现在在顶层记录 `commandId` 与 `causationId`。该 producer 只处理 `briefed → staging`，不证明材料 debit、online、standing/forecast、SAVE/EventLedger 迁移或自然浏览器证据。
