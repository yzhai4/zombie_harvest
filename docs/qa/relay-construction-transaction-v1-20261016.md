# RelayConstructionTransactionV1 shadow QA（2026-10-16）

## 检查点

- 仓库：`yzhai4/zombie_harvest`
- 分支：`codex/v82-npc-succession`
- 事务实现父提交：`3020b0d5c3e27b1c3d5b77bb60ed0fcf6b69557b`
- 文档同步：随开发分支提交记录
- CI：#253，run `38912989111`，static-validation job `117013214217`
- Sites：线上 v81 保持不变；本检查没有部署 Sites，也没有修改生产 `dist/index.html`
- 目的：在真实 producer 仍为 `world.advance → advanceReducer → updateRelayProject` 的前提下，冻结跨对象施工事务的纯值边界，为下一步 reducer 接线提供可回放合同。

## 实现边界

新增 shadow adapter：

- `scripts/lib/relay-construction-transaction-v1.mjs`
- `scripts/check-relay-construction-transaction-v1.mjs`
- `scripts/fixtures/relay-construction-transaction-v1.json`

接口固定为 `prepareRelayConstructionTransaction → applyRelayConstructionTransaction → receipt`，并提供显式 `rollbackRelayConstructionTransaction`。输入快照只包含可序列化的 relay instance、inventory、building occupancy 和 assigned NPC participant snapshot；失败返回准备前快照，成功返回 transactionId、commandId、四元 CAS token 及 resource/event provenance。

## 证据

- RelayConstructionTransactionV1：11/11。
- RelayConstructionV1 基础合同：13/13。
- 生产者追踪：9/9；真实顺序为 `advance → CommandBus(world.advance) → advanceReducer → updateRelayProject`。
- EventGateV1：7/7；inline/shadow parity：11/11。
- replay self-test：14 个 fixture，hash `4aec7a31`。
- static three-day smoke：55/55。
- 权威运行时源码 SHA-256：`1a5430620715363611914ad567f8b076253fbaa42bc200a10a93daf1bd53d463`。
- Playwright 在当前 CI 环境不可用，因此 browser lane 是 static-only。

11 个事务夹具覆盖三阶段成功迁移、库存不足、建筑占位冲突、NPC 不可用、prepare 后快照冲突、重复命令、纯回滚、materialDelta/resourceDebits 不一致、resourceSource 冲突，以及 terminal `stationOnline` 的单次语义。

## 六视角验收

- **玩家**：拒绝原因可解释且失败不扣资源；真实施工按钮和刷新后的 token 仍待 browser fixture。
- **NPC**：参与者的存活/active 快照和岗位补丁一起原子应用；scheduler、死亡中断、替代者事件仍未接线。
- **营地**：库存、建筑占位和 relay instance 同批提交或保持原快照；生产账本和 SAVE21 迁移仍待实现。
- **势力**：wrapper 不自动产生 standing/外交奖励；施工事实到势力关系的正式来源仍待定义。
- **敌人**：wrapper 不生成敌人或改变 forecast；同 tick 战斗顺序和失败时敌人守恒仍待真实 reducer 验证。
- **全局事件链**：transactionId、commandId、四元 token 和 provenance 可回放；EventLedger、CommandBus、Choice resolver 尚未接入。

## 结论与下一闸门

这是事务 shadow contract，不是运行时施工迁移。当前明确保持 `constructionCommandProducer:false`、`productionWiring:false`、`naturalGameplay:false`；没有生产 leader-LLM relay producer，也没有自然多日浏览器试玩证据。
下一闸门是沿真实 `world.advance` producer 接入 transaction reducer adapter，并补 EventLedger、SAVE 迁移、standing/forecast、同 tick CombatIntent 顺序以及 browser save/reload fixtures；通过前不得把 relay metadata choice 宣称为已执行 Gate。
