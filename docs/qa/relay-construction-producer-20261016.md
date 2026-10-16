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
