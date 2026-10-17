# ADR-20261016：统一事件 GateV1 的 opt-in 迁移边界

**状态：** validated（源码 VM 回归）；未部署 Sites
**范围：** SAVE21 / CONTENT3，v82 事件状态系统

## 决策

1. registerEventDefinition 统一规范化 EventDef、Choice、Effect 和 Gate。定义保留 definitionVersion，并用 gateVersion: 1 / evaluatePreconditions: true 明确声明新门禁语义。
2. GateV1 是只读 evaluator。它只读取当前 GameState 和 EventInstance actor 上下文，不写状态、不发事件、不扣资源、不直接执行效果。
3. GateV1 只接受冻结的字符串/对象词汇：SAN、工具/科技/flag、存活、营地信任、地标和日期；未知路径、未知对象类型、对象额外字段、空条件和非法 phase 一律拒绝。
4. 事件命令先比较 EventInstance 的 instanceId、defId、definitionVersion、eventId，再评估 Gate，再进入既有 reducer/effect transaction。这样旧 UI 或旧 planner 不能把过期事实带入新事件。
5. 首批接线为 npc.sanity、npc.sanity-player 和 relay-chain-001。中继链的既有岗位/距离/资源逻辑仍在原 reducer 中，GateV1 只承担统一的事实存在与 choice contract 检查。

## 取舍与边界

- 不给所有旧事件自动打开 GateV1；词汇未冻结的 legacy reducer gate 保持原语义。
- 不提升 SAVE_VERSION 或 CONTENT_SCHEMA_VERSION；新增字段有安全默认值，旧存档仍由现有迁移读取。
- Gate 拒绝不产生成功 receipt；只有 terminal handled 事件才允许来源敌人清理。浏览器缺少 Playwright 时，源 VM 证据和 browser 证据分开记录。

## 六视角检查

玩家看到 SAN/中继条件的明确锁定原因；NPC 目标由事件实例 actor 绑定；营地资源和岗位约束仍由原 reducer 守恒；势力关系未凭空新增；敌人目标不因 Gate 迁移被跳过；全局链保留 CAS、幂等、账本和回放。

## 证据

- node scripts/check-daytime-combat.mjs：23/23，含 SAN NPC/玩家、Choice.requires、relay gate、未知/畸形条件和 CAS 顺序。
- node scripts/check-inline-syntax.mjs dist/index.html：通过。
- node scripts/check-report-recovery.mjs：177 项通过。
- node scripts/check-content-chain.mjs：43 项通过；node scripts/replay-harness.mjs --self-test：10 个夹具通过。
- node scripts/smoke-three-days.mjs：static 55 项通过；Python Playwright 不可用，未宣称自然多日 browser 通过。
