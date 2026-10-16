# RelayConstructionTransactionV1 runtime stage QA（2026-10-16）

## 目的与边界

本轮把现有 `world.advance → advanceReducer → updateRelayProject` 的第一段真实 producer 接到 `RelayConstructionTransactionV1` adapter，只迁移 `briefed → staging`。这是开发分支的 Node VM/CI 证据，不是浏览器、Sites 或自然多日试玩证据。Sites v81 不改、不发布。

运行时开关是：

```js
state.worldMeta.flags.relayConstructionTransactionV1 === true
```

默认新世界没有此 flag，关闭或缺失时仍走旧 `updateRelayProject`。adapter 不处理材料扣除、资源来源账本、`building → online`、standing/forecast 奖励或 SAVE schema 迁移；这些仍是后续闸门。

## 实现面

- `dist/index.html`：stage-only adapter、CAS token、CommandBus 子命令、回滚与成功后 station 占位。
- `scripts/check-relay-construction-runtime.mjs`：从同一 `check-report-recovery` VM 夹具启动实际 inline runtime，记录 source hash 并执行八项检查。
- `scripts/fixtures/relay-construction-runtime-v1.json`：八项检查的稳定 ID 与预期。
- `scripts/check-relay-construction-producer.mjs`：保留两个 EventDef `commandType: 'relay.projectAdvance'` 元数据断言，同时要求恰好一个 gated runtime child command，避免旧 producer trace 被误判。

## 八项检查

| 检查 | 通过条件 |
| --- | --- |
| flag-off compatibility | 默认/显式 false 两次旧路径 digest 相同，没有 runtime child |
| success exactly once | `world.advance` 成功后只产生一个 `relay.constructionStarted`、一个 child replay 与一个 station |
| missing worker unchanged | 缺岗拒绝；relay/NPC/库存/建筑保持快照；拒绝 child 仍进入 replay |
| stale token unchanged | 四元 CAS 的 stale event 被拒绝且不改变 relay 快照 |
| duplicate child no-op | 已见 child command 在 reducer 前返回 duplicate，不重复事件或占位 |
| virtual occupancy success-only | 失败不创建 station；成功后才创建并标记 `occupiedBy` |
| save-reload token | SAVE21 后 flag、latest event token 与 child replay 保持 |
| same-tick order | `updateRelayProject` 仍位于世界尸群模拟和日间战斗之前 |

## 六视角评估

| 视角 | 本轮结论 | 后续边界 |
| --- | --- | --- |
| 玩家 | 开关关闭时体验与旧路径兼容；成功/失败均有可回放事实 | UI 展示 token、失败原因和施工阶段 |
| NPC | 三个指定岗位在 adapter 预检中必须存活且在营；成功后写工作片段 | 死亡中断、替代岗位和自治调度 |
| 营地 | station 只在成功提交后占位；失败不扣库存 | 材料来源账本、建筑冲突与 SAVE 迁移 |
| 势力 | 本切片不新增 standing 或外交奖励 | construction/online 事实到势力关系 |
| 敌人 | 不生成敌人、不改尸潮 forecast；顺序保持在战斗前 | CombatIntent 同 tick 竞态与敌人压力消费 |
| 全局链 | EventInstance 四元 token、真实 EventLedger ID、CommandBus replay/idempotency 均可核对 | Choice resolver、EventEffect、完整链路迁移 |

## 证据口径

checker 输出会带本次 checkout 的 `sourceHash`、八项 `passed/count` 与 CI run/job 链接；不在文档中硬编码会随提交变化的 head/hash。通过只证明 inline VM 与静态顺序，不宣称 Sites v81 已发布或浏览器自然玩法已验收。
