# 事件信号架构草案

《我是救世主》的复杂事件线采用轻量事件驱动架构，不直接复制 ROS2 或 DeepSeek Harness。

## 核心原则
- 命令是玩家或系统意图，事件是已验证事实。
- reducer 是唯一修改世界状态的入口；UI、HUD、音频和分析只能订阅投影。
- 事件使用单调 seq、固定 tick、schemaVersion、runId、source、entityId、causationId、correlationId。
- event payload 必须可 JSON 化、可排序、无 DOM/Date 引用；非法事件被拒绝并记录原因。
- 旧存档和旧事件通过显式迁移，不靠隐式字段猜测。

## 三类通信
- Topic-like：时间、NPC 状态、世界事件等持续信号，异步广播，按 tick + seq 稳定排序。
- Service-like：保存、加载、交互、查询等短请求，返回明确结果。
- Action-like：旅行、任务、尸潮、长事件链，支持 goalId、feedback、result、cancel。

## 事件总线
支持三种钩子：
- emit：广播和遥测，不阻塞主流程
- bail：行动前守卫，例如暂停、体力、碰撞、资源不足；失败时 fail-closed
- waterfall：按顺序修改难度、状态效果和生成过滤条件

插件只能注册订阅、守卫和清理函数，不能直接修改 state。卸载插件必须移除 timer、listener 和注册项。

## 生命周期
WorldClock、EventDirector、NpcSystem、ReplayRecorder 统一经过：
unconfigured → inactive → active → deactivating / error → finalized

只保留一个确定性 scheduler：固定模拟 tick + 独立渲染帧。必要时把寻路或生成放到 Worker，主线程仍是权威状态源。

## NPC 与时间线
NPC 状态转移由事件驱动，例如：
idle → alert → chase → attack → stunned → dead

每次转移发出 npc/transition，包含 oldState、newState、reason、tick。非法转移拒绝并写入诊断事件。任务、关系、士气和 SAN 通过事件链累积，不直接互相改字段。

## 回放与评估
每个场景有 manifest：
- scenarioId、seed、initialState
- 固定 tick 的 commands
- 期望事件、状态断言和 gameVersion
- plugin profile

先加入一个最小场景：移动 → 采集 → 建墙 → 攻击 → 尸潮生成。比较每 tick 的 canonical state hash，并报告首次分歧的 tick、event seq 和字段路径。随机数必须注入 seeded RNG 或 RNG tape，禁止 reducer 直接调用 Math.random()。

## 参考边界
ROS2 提供 topics/services/actions、QoS、managed lifecycle、executor 和 tracing 的设计启发。DeepSeek Harness 的公开仓库提供插件树、typed session event、emit/bail/waterfall hooks、单写入事件日志和 replay/fork 思路。NPC 状态机、游戏 evaluator 和固定 tick 是针对本项目的适配设计，不是这些项目的原生功能。