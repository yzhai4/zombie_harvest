# 项目记忆协议

本文件定义长期开发、AI 接入和科研实验共用的记忆边界。目标是让新一轮工作只加载必要上下文，同时保留可审计的决策和失败经验。

## 记忆层级

### L0：规则真相

- `剧本/尸潮农场/01–09`：世界观、时间线、事件图、六视角、NPC、计划会、战斗和预算。
- `剧本/尸潮农场/11–16`：接口、模板和验收规则。
- `dist/index.html`：当前实际运行时注册和接线状态。
- `docs/handoff/尸潮农场-开发交接包.md`：实现边界、迁移、发布和风险。

L0 的修改必须说明 `contentVersion`、`SAVE_VERSION`、迁移和回放影响。

### L1：长期决策

- `docs/long-term-plan.md`：阶段、出口和长期目标。
- `docs/iteration-workflow.md`：每轮工作顺序和门禁。
- `docs/project-memory.md`：记忆规则。
- `docs/decisions/ADR-*.md`：不可从代码直接推断的架构取舍。

### L2：问题与实验

- `docs/problems/PROB-*.md`：问题、复现、影响、根因、修复和回归证据。
- `docs/experiments/EXP-*.md`：假设、基线、配置、seed、指标、结果和结论。
- `docs/experiments/runs/`：机器生成的 manifest、JSON、CSV 和日志摘要。

### L3：临时上下文

聊天、notebook 输出、临时截图和未复核的猜测只能作为线索。它们不能覆盖 L0–L2。

## 每轮加载顺序

1. 读取 `docs/memory/current-state.md`、`docs/memory/open-risks.md`、`docs/project-memory.md` 和 `docs/long-term-plan.md`。
2. 根据任务加载一个 L0 真相源和相关剧本卡。
3. 加载相关问题或实验记录，不扫描全部历史日志。
4. 工作结束前更新决策、问题、实验或交接记录中的至少一项；若没有新增知识，明确写“无新增记忆”。

## 记录规则

- 一条记录只描述一个决策、一个问题或一个实验。
- 稳定 ID 不复用；标题可以修改，ID 不改。
- 每条记录必须写状态：`proposed`、`active`、`validated`、`superseded` 或 `blocked`。
- 事实、推测和待验证假设分开写。
- 只把可重复的命令、seed、模型 ID、contentVersion 和输入摘要写入实验记录。
- 不把 API key、内部路径、临时令牌或完整上下文写入仓库。

## 任务结束检查

- 代码、内容和文档状态是否一致？
- 是否记录了失败尝试和回滚点？
- 是否有可复制的验证命令？
- 新结论属于 L0、L1、L2 还是临时线索？
- 是否需要更新 skill 的具体规则，而不是继续依赖聊天记忆？

