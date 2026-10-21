# ADR：水车支线采用 GateV1 作为条件入口

**状态：** implemented locally，待远端上传与 CI 复核  
**日期：** 2026-10-16  
**范围：** `watermill-002`、内容注册表、内容链启动/选择入口；不包含 Sites 发布

## 背景

水车支线原来同时使用 `phase`、`startConditions`、`requirements` 和若干调用方自己的判断。注册器、事项面板和 resolver 可以分别解释这些字段，导致同一选择在不同入口的可见性不一致。尤其是夜间直接调用、坏条件对象和信任值在支线启动后下降时，若把启动条件再次套到选择上，就会把已经开始的故事错误地撤销。

本轮目标是先把“能否开始”和“当前选择能否执行”的硬门槛统一到只读 GateV1 评估器，同时保留现有内容效果和水车玩法，不把这一个切片误当作完整事件引擎迁移。

## 决策

1. **采用显式 opt-in。** `watermill-002` 注册 `gateVersion: 1`、`evaluatePreconditions: true` 和 `gate`。注册器把 `gate.preconditions`、顶层 `preconditions`、旧 `startConditions` 合并并去重，写回规范化定义；旧内容链没有这些字段时继续走兼容路径。
2. **启动 Gate 是只读的。** 启动时统一检查 `DAY/NIGHT/ANY`、`nightAllowed` 和已登记的条件类型（地标、营地信任、NPC 活动、flag、日期窗口）。对象条件缺失、未知或格式错误一律失败关闭，评估过程不写状态、不发奖励、不写账本。
3. **选择 Gate 分成两个阶段。** 已启动的链先检查内容自己的日期窗口，再检查定义的阶段/夜间限制；随后只检查当前 choice 的 `requires`（兼容读取旧 `requirements`）。选择 Gate 不重新检查启动时的地标或营地信任，因此“信任 30 时启动、之后降到 24”仍能完成已开始的水车支线。夜间和窗口外仍拒绝。
4. **效果语言保持不变。** 水车节点继续使用现有 `content-effect` DSL，由已有事务 reducer 结算。本 ADR 不把它转换成 `EventEffect`，不新增 `EventInstance`、CAS 或第二套事件状态；这避免在同一轮改变奖励语义和存档边界。
5. **兼容字段只作迁移桥。** 新定义同时保留 `preconditions`、`startConditions`、`requires` 和 `requirements`，但运行时只通过 GateV1 读取规范化结果。未来内容应只写 GateV1 字段，旧字段在完成迁移后再单独清理。

## 不变量与回滚

- Gate 失败不能改变资源、flag、active chain、ledger 或 checkpoint。
- 一条已启动的链不会因为启动时的信任条件后来变差而被隐式取消。
- 夜间、终局、未启动、已完成、过期和重复命令仍由内容链 reducer/CommandBus 负责；Gate 不是效果事务。
- 不修改 `SAVE_VERSION` 或 `CONTENT_SCHEMA_VERSION`，旧档仍按现有迁移读取。
- 若远端 CI 或真实浏览器发现兼容问题，先去掉 `watermill-002` 的 opt-in 字段即可回到旧内容条件路径；不回滚昼间战斗修复或覆盖 Sites v81。

## 证据与限制

最终分支源 `dist/index.html` SHA-256 为 `bc85cbeab7f00236e7bde84f01d05596676b359fb66b077645103011810fb23d`；`scripts/check-content-chain.mjs` 执行 54 项真实源码检查（含正向修复存档夹具），来源命令轨迹 hash 为 `c5d6c772`。其余语法、内容、夜间、回放和三日静态 smoke 已由对应 CI 运行复核。

本轮没有把 GateV1 替换为独立模块，也没有自然多日浏览器证据。`contentConditionMet` 对未知对象条件的 fail-closed 是额外的安全收紧，可能暴露未登记的旧内容包；若后续内容依赖未知对象，必须先补条件类型和夹具，不能把未知条件改回自动通过。

