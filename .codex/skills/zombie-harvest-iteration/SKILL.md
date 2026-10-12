---
name: zombie-harvest-iteration
description: 运行尸潮农场的完整迭代闭环：源线对账、剧本设计、事件状态实现、六视角合理性审查、存档回放验证、GitHub PR 管理和 Sites 发布记录。
---

# 尸潮农场完整迭代技能

用于跨越内容、运行时、UI、测试和发布边界的一轮完整迭代。先读 `docs/overall-iteration-plan.md`、`docs/handoff/尸潮农场-开发交接包.md`、`docs/iteration-workflow.md`，内容设计再读 `剧本/尸潮农场/01–09` 与对应 `11–16` 模板。需要新事件时同时使用 `zombie-harvest-content`。

## 1. 源线对账

记录 Sites 生产版本、Sites 源提交、GitHub 默认分支和本地工作树 HEAD。把线上实际版本视为运行时事实；GitHub 镜像只作为可审阅的工程基线。发现分叉时：

- 从 GitHub 当前提交建立 `codex/<scope>` 分支，不更新 `main`。
- 优先使用 GitHub API 的 branch、blob、tree、commit、draft PR 管理，避免依赖不可用的本地 Git。
- Sites 发布必须使用已推送且可追溯的源提交；没有源提交和归档就停在 PR 阶段。
- 公开 GitHub 内容不包含凭据、内部路径、令牌或未授权的运营细节。

## 2. 设计闸门

剧本设计师先写或更新 `docs/scripts/<stable-id>.md`，定义玩家承诺、触发、选择、结果、失败降级、状态字段、幂等键、回放字段和 UI 提示。逐项填写六视角账本：玩家、NPC、营地、势力、敌人、全局事件链。发现资源凭空出现、死亡 NPC 被引用、夜间白天动作、无法恢复的失败或与岗位动机冲突时退回设计。

## 3. 规则与实现闸门

所有事件使用 `EventDef/EventInstance/Choice/Effect/Gate`；所有跨系统变化走统一 reducer/effect runner，所有输入走命令入口。新增保存字段必须有安全默认值、迁移和重复加载策略；效果失败要回滚；夜间输入和隐藏 contextActions 经过同一个 night guard。UI 只呈现状态和发出命令，不复制业务规则。

## 4. 验证闸门

按变更范围运行：

```text
node scripts/validate-content.mjs
node scripts/check-night-guard.mjs
node scripts/smoke-three-days.mjs
node scripts/replay-harness.mjs --self-test
```

再做内嵌脚本语法检查、`git diff --check`、旧档迁移夹具和固定 seed 回放。浏览器自动化不可用时明确记录限制，不把静态 smoke 当成真实试玩；线上可访问时至少验证启动、继续存档、一次白天动作和错误日志。

## 5. 六视角质量报告

每轮输出同一份简短报告：

- 玩家：提示是否说明因果，选择是否有可理解的代价和恢复路径。
- NPC：岗位、需求、关系、SAN、死亡/失踪/重伤后引用是否一致。
- 营地：人口、资源、建筑、`campCollapse`、信任和 command points 是否守恒。
- 势力：关系、据点、外交收益和敌对反制是否有来源。
- 敌人：预警、准备、防线、夜战窗口和威胁压力是否能被玩家改变。
- 全局事件链：前置、推进、终止、降级、幂等和回放 hash 是否一致。

## 6. 版本管理与交接

GitHub PR 说明基线、范围、验证结果、已知限制和是否可发布；PR 保持 draft 直到本轮闸门完成。更新 `docs/roadmap.md`、交接包和剧本卡状态。只有在 Sites 保存、部署和线上 smoke 都成功时才标记已发布；否则保留可恢复的 GitHub 分支和未发布状态。

## 7. 技能自我改进

每轮结束检查失败原因是否暴露了工作流缺口。只有当缺口在真实迭代中重复或明显影响质量时，才更新本 Skill 或其 references，并在 PR 中记录变更理由；不要把单次偶发故障升级成所有任务的硬性规则。
