# relay-chain-001：广播中继链

## Runtime status（2026-10-16）

这张剧本卡包含目标设计与当前接线，不能把下表和验收条目直接当成已实现能力。当前运行时已注册 `relay-chain-001` 的 EventDef 元数据，并在 `handoffRelayCore` 的命令入口复用只读 GateV1；实际交接的核心物品、`relayProject.status`、长官存活/距离、资源和 CommandBus 事务仍由 reducer/validate 负责。

`recover`、`stage`、`online` 目前分别由地标发现 reducer 与 `updateRelayProject` 自治推进，并没有经过统一 Choice resolver；“先保防线/先保中继”“公共频道/静默频道”仍是设计目标。handoff 已建立显式 EventInstance（instance/def/version/event）CAS adapter，并保留原 reducer 的岗位、距离、资源校验；下一步单独把施工/上线选择做成正式 ContentChain/EventInstance 切片。Parity、六视角矩阵和本卡的状态影响描述是设计/审计依据，不构成浏览器或线上验收证据。

本轮先加入 `scripts/lib/relay-construction-v1.mjs` shadow adapter 与 11 项夹具，冻结施工的四元 CAS、`briefed → staging → building → online` 状态迁移、重复命令、缺岗/资源不足整批拒绝和 save→reload token。它不被当前 UI 或 `updateRelayProject` 调用，不能据此宣称施工已正式接入 EventInstance/ContentChain；正式接线前仍需沿真实 `world.advance` 生产者补充预检/预留、回滚和 CombatIntent 顺序。

- 版本：draft-1（v79 / P1.5）
- 设计角色：剧本设计师
- 范围：三日竖切片；不新增真正的多势力外交实体

## 体验承诺

玩家把一件捡来的广播核心变成营地的提前预警能力。选择决定谁先承担风险、哪些库存被锁进工程、下一轮尸潮从哪条路线逼近；完成链条后，玩家仍要亲自夜战补位。

## 事实与参与者

- 广播员阿默能从杂音中确认方向，但独自监听会累积疲劳和孤立。
- 营地长官林岑负责核心交接和岗位授权；核心待交付时必须留在指挥所。
- 木匠阿梁负责中继站施工；后勤官周岚负责木材、零件和石料的配给。
- `relayProject`、`hordeForecast`、`campStanding.domains.recon/supply/defense` 是现有营地事实；当前没有独立的邻营/敌对势力对象。

## 节拍与前置

1. **恢复核心**：发现废弃广播塔并取得 `relayCore`；白天、玩家可行动、地标未被清空。
2. **交付长官**：核心在玩家背包，林岑存活且能在指挥所接收；夜间或长官缺岗时显示待处理并允许次日重试。
3. **筹料/施工**：交付已记录；阿梁、周岚存活且岗位可用；木材 10、零件 5、石料 4 分阶段扣除，不足时保留已交付事实。
4. **上线预警**：施工达到目标分钟数且中继建筑占位有效；广播员在线或有安全降级，写入 `relay.stationOnline` 和预测事实。

## 选择与状态影响

| 节点 | 选择 | 即时成本/收益 | 持久结果 |
| --- | --- | --- | --- |
| 交付 | 交给林岑 | 推进少量时间，暂时锁定核心 | 产生 `relay.coreHandedOff`，开放筹料；长官缺岗则不结算 |
| 施工 | 先保防线 | 材料进入防线，工程变慢 | `defense` 贡献提高，预警上线推迟 |
| 施工 | 先保中继 | 材料进入工程，短期防线余量较少 | `recon/supply` 提高，预警提前量更早；下一轮尸潮压力仍受准备度约束 |
| 上线 | 接入公共频道 | 消耗施工时间，广播员疲劳上升 | 预测提前量、路线和每日总结可见；夜间只读取该事实 |
| 上线 | 保留静默频道 | 不获得完整提前量 | 链条停在可重试状态，不软锁主循环 |

## 失败、取消与重试

- 核心丢失、NPC 阵亡、建筑占位冲突、夜间切换或材料不足时，只记录失败原因，不生成奖励或幽灵任务。
- 施工中途保存后恢复仍保留材料进度和工作分钟；重复 dispatch 同一 `instanceId` 不重复扣料。
- 玩家放弃中继时，已经消耗的材料不会凭空返还，但可在次日通过补料事件继续；总结要解释损失。

## 系统映射

- 事件定义/实例：`EVENT_DEFS`、`createEventInstance`、`recordWorldEvent`。
- 任务推进：`QUEST_DEFS['relay-chain-001']`，按 `special.itemRecovered`、`relay.coreHandedOff`、`relay.constructionStarted`、`relay.stationOnline` 推进。
- NPC：`NPC_EVENT_CHAINS`、`npc.needs`、`eventChain`、`npcEvents`；触发和结算统一走 `resolveNpcEvent`/事件 reducer。
- 营地/威胁：`relayProject`、`hordeForecast`、`campStanding`、建筑占位和夜战只读准备结果。
- 存档：`SAVE_VERSION`、`eventInstance`、`npcEvents`、`worldMeta.events/replay`；缺字段使用安全默认并写 `save.migrated`。

## 六视角合理性矩阵

- 玩家：每次选择都交换可见的材料、时间、预警和防线风险，放弃后仍能继续主循环。
- NPC：四名相关角色的动机、岗位和疲劳影响任务；死亡/缺岗会暂停或降级，不由系统替身完成。
- 营地：中继站有真实占位、材料和施工分钟数，夜间不能临时建造。
- 势力：本轮只使用营地合法性、贡献和领域值，不假定不存在的外交关系；新势力留到 P2.1。
- 敌人：上线只改变预警提前量/路线或尸潮压力，不跳过敌人上限、夜间移动和玩家补刀规则。
- 全局链：四个节点各有稳定 `eventId/instanceId/causationId`，SUMMARY 只结算一次，刷新/加载不跳步。

## 验收

事件日志按四节点顺序出现；资源算术可复核；缺岗、夜间、材料不足各有一条可恢复路径；save→reload→continue 不重复奖励；每日总结说明中继对下一轮尸潮的实际影响；浏览器 smoke 覆盖新局、交付、施工、夜潮、总结和回到白天。
