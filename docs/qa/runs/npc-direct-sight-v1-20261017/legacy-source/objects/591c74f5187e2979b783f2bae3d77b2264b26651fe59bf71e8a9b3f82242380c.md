# PROB-20261016：EventDef 前置条件曾被存储但未统一执行

**状态：** scoped fix validated；后续迁移仍开放
**影响：** EventDef 的 preconditions、gate.phase 和 Choice.requires 可能只停留在注册字段，SAN 条件与内容链 DSL 也有不同解释；未知对象条件若沿用旧 helper 可能默认通过。

## 复现

旧定义可以带 preconditions，但通用事件门禁只检查夜间、handled 和 choice ID；选择进入 reducer 前没有统一的只读条件报告。动态玩家 SAN 事件还可能生成非规范 defId，导致它绕开预期定义。

## 本轮修复

- 引入 GateV1 opt-in evaluator，按 actor 上下文解析 SAN，并把玩家 SAN 映射到 npc.sanity-player。
- GateV1 采用白名单和 fail-closed；CAS 在 Gate 前执行。
- relay 交接命令复用同一 adapter；旧 relay reducer 的岗位、距离、物资结算保持原行为。
- 新增 23 项源级回归，覆盖通过/拒绝、unknown/malformed、错误 phase、Choice.requires、relay 缺失事实、旧实例和排队切换。

## 尚未解决

- 仍有 legacy EventDef 没有迁移到 GateV1。
- inline evaluator 与独立 Node/GameCore validator 尚未合并。
- 多日真实浏览器和生产 Sites 尚未验证本轮变更。
