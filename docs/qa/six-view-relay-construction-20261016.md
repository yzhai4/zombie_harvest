# 中继施工切片六视角审计

**日期：** 2026-10-16  
**分支：** `codex/v82-npc-succession`  
**审计基线：** head `3c9482850efa5036419f0f70c9b28adcd6005186`；权威 `dist/index.html` SHA-256 `f018d6639d415426960add45220389535aa4010d58c1c631a055b8da62461f71`  
**CI：** #223 / run `38904277978` / static-validation job `116983845586`，通过  
**发布：** Sites v81 未改、未部署；本文件是开发分支审计，不是线上验收

## 审计结论

当前三块能力的证据边界不同：

| 范围 | 当前判定 | 证据 |
| --- | --- | --- |
| 白天 NPC、塔、活动敌人互相造成生命值伤害 | 已接线并通过源运行时合同 | daytime combat 24/24；CombatIntentV1 5/5 |
| GateV1 与水车入口、relay handoff 四元 CAS | 已接线，但仍是窄切片 | Gate shadow 7/7；inline/shadow 完整结果与只读状态 parity 11/11；handoff 夹具包含陈旧 instance/event 与 save→reload |
| relay construction/staging/building/online 正式 ContentChain/EventInstance 事务 | 设计就绪、运行时未迁移 | 当前仍由 `advanceReducer → updateRelayProject` 直接推进；尚无施工 Choice resolver、事务回滚和施工节点 CAS |

CI 还通过 content-chain 54/54、static three-day smoke 55/55、replay self-test 10 fixtures（hash `4aec7a31`）。Python Playwright 在本环境不可用，因此不能把这些结果称为自然多日浏览器试玩。

## 当前运行时事实

1. 白天推进顺序是：时间与日界结算 → NPC 例行与 relay project 更新 → 敌人模拟/移动 → `runDayCombat`。白天命中使用 `CombatIntentV1`，统一写入伤害、拒绝和击杀收据；夜间由独立路径处理。
2. GateV1 是只读、白名单、失败关闭的门禁；CAS 在 Gate 和效果事务之前。水车只迁移入口 Gate，旧 content-effect reducer 仍负责效果。
3. handoff 命令携带 `expectedInstanceId`、`expectedDefId`、`expectedDefinitionVersion`、`expectedEventId`，陈旧命令只产生拒绝收据；保存重载后仍以中继事件账本恢复最新 event identity。
4. 当前 relay 施工由 `updateRelayProject` 在时间推进中直接写入状态：参与者排班、材料与资源、施工分钟、建筑占位、campStanding 和预测。缺岗只写 blocked 事实；材料筹集和上线没有统一的可回滚 effect transaction。

## 六视角合理性账本

| 视角 | 当前已证实的行为 | 正式施工切片必须保持的规则 | 当前出口 |
| --- | --- | --- | --- |
| 玩家 | 白天威胁会真实掉血；水车前置、夜间拒绝和 handoff 陈旧命令可解释；成功交接不会重复扣核心或声望 | 在施工/上线前显示阶段、材料、工时、参与者、预警收益与失败原因；部分材料消耗后重试不软锁主循环；旧按钮必须携带四元 token | **条件通过**：已有入口可解释；施工 UI/Choice 仍待接线 |
| NPC | 守卫受伤会同步 `hp/combatHp/lifeState/wounds/SAN`；relay 参与者按存活状态和岗位匹配，缺岗会阻塞 | 每个工作段绑定真实 NPC、岗位、presence、有效分钟和中断原因；死亡、失踪、拒绝合作或岗位冲突必须暂停/降级，不得由系统替身完成；不把玩家体力署名为 NPC 劳动 | **条件通过**：缺岗阻塞已存在；工作段账本和死亡中断夹具未完成 |
| 营地 | 塔/墙有耐久和失活；handoff 只在一次成功事务中扣核心并改变项目状态；Gate 失败不写效果 | 施工占位、库存、材料来源和建筑状态必须原子结算；资源不能为负，重复 command/instance 不重复扣料；夜间不能临时建造，保存恢复不重放材料或工时 | **待施工事务**：现有时间推进存在直接多字段写入，需迁移到 reducer/effect transaction |
| 势力 | 当前只改变 `campStanding`/领域值，没有假定邻营或河湾互助会实体；Gate 不凭空发外交收益 | 只为真实施工/上线事实发营地贡献、合法性、recon/defense 领域变化；不创建外援、贸易或关系奖励；每个 standing delta 要有来源事件、actor 和可回放原因 | **范围受控**：需为施工与上线各自固定 standing 来源，禁止沿用“自动上线即全局奖励”的隐式副作用 |
| 敌人 | 活动敌人可攻击 NPC、塔、墙；事件结算只清理原 instance 的敌人；白天与夜潮隔离 | 施工只通过记录的 forecast/route/lead 事实影响威胁；不绕过敌人上限、移动、夜间门禁或建筑接触规则；失败/回滚不得生成免费敌人或重复掉落 | **条件通过**：战斗合同已通过；施工对尸潮强度的因果仍未完成验收 |
| 全局事件链 | handoff 有四元身份、拒绝收据和 save→reload 保护；水车 Gate parity 不改变状态 | 施工必须成为正式 EventDef/EventInstance/Choice/Effect：CAS → Gate → 业务前置 → 预检/预留 → reducer → receipt；固定 causation/eventId/definitionVersion；摘要、刷新、加载只结算一次 | **未通过**：施工/上线仍是自治时间推进路径，不能把剧本卡元数据当成 resolver 已接线 |

## 下一切片的最小运行时合同

施工切片应先定义并审计 `relay-construction-001`（名称可在剧本卡评审时调整），再写运行时代码：

- **EventInstance：** 保留 `instanceId/defId/definitionVersion/eventId`，命令携带完整快照；四元 CAS 失败不触发任何资源、NPC、建筑或预测写入。
- **Gate：** 只表达稳定的 DAY/夜间、项目阶段、地标/建筑占位、参与者存活/岗位和时间窗口；材料数量、距离、来源选择等业务细节在 Gate 之后由施工 reducer 重查。
- **事务：** 采用“预检 → 预留/扣除 → 状态应用 → receipt/replay”顺序；任一业务失败回滚本次所有资源、材料进度、NPC 工作段、建筑和 standing 变化。重复 `commandId` 或同一 `instanceId` 是幂等成功/拒绝，不得重复结算。
- **时间与战斗：** 明确施工命令与 `world.advance`、relay forecast、`runDayCombat` 的事件顺序；昼间战斗命中不能因施工失败而被回滚或重放，施工也不能绕过夜间隔离。
- **迁移：** 旧档继续读取现有 `relayProject` 字段；缺失施工 token/工作段时安全降级为可重试状态并写迁移事实，不直接把旧自治进度伪造成已完成 EventInstance。

## 必须先补的夹具

1. 四元 token 正常施工、陈旧 instance/definition/version/event 四种拒绝。
2. 材料不足、来源资源被并发消费、建筑占位冲突：状态、库存和 receipt 全部保持可解释。
3. 参与者死亡/离岗/岗位互斥后暂停；恢复或替代有明确来源，不凭空造 NPC。
4. 重复 `commandId`、刷新、save→reload→continue 不重复扣料、工时、standing 或上线收益。
5. 夜间切入、摘要关闭/重开、排队事件切换时，施工节点不越过阶段或清理错误敌人。
6. 施工完成后只产生一次 `relay.stationOnline` 与 forecast 变更；固定 seed 的 replay hash 稳定。
7. 白天施工与 NPC/塔/敌人 CombatIntentV1 同一 `world.advance` 下的顺序和资源/人口守恒。

## 实施闸门

在上述夹具和六视角账本通过前，不给 relay 的 `recover/stage/online` 元数据 choices 添加虚假的 `requires`，不把自治路径描述成完整 EventChain，也不发布 Sites。下一轮按“剧本卡与 schema → 纯事务/回滚夹具 → 真实 resolver/CommandBus 接线 → 存档迁移与 replay → browser smoke”推进；任何一项不能映射到现有执行路径，就先退回设计或 schema 议题。
