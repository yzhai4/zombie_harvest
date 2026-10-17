# 夜战关闭事实缺少遭遇 ID

**状态：** active  
**范围：** 真实三日日历公开行动回归 / 夜战报告关闭

## 复现与根因

第二次持久浏览器运行已实际完成 day1 遭遇、保存总结并关闭回到白天，但等待同一遭遇的 `threat.closed` 收据超时。源码 `actionCommand` 用 reducer 返回值生成事实，`continueMorningReducer` 返回 undefined，因此旧关闭事件的 payload 为空；`threatId` 仅保存在对应命令的 replay 输入中。不能把同一分钟内任意关闭事件当成这场遭遇的完成证据。

## 契约与修复

- 公开 `continueMorning` 命令只允许关闭已 resolved、具有 instanceId 的报告，缺报告或未结束遭遇返回 `report-not-ready`。
- 成功后明确返回包含 `threatId/day/hour/minute` 的事件 payload，使输入、事实和保存可关联；重复 command ID 不重复执行，新 ID 的第二次关闭不能产生成功事件或 checkpoint。
- `continueMorningReducer` 保留原日期与每日配给/upkeep语义。日历推进不通过关闭报告完成；SAVE21 / CONTENT3 不变。
- 旧浏览器进度恢复仅在 `threat.closed.commandId` 对应 replay 的 `threat.close` 输入具有匹配 threatId，并有同场 started/resolved 事实时认可旧空收据，不注入或重放效果。

## 验收与回滚

真实源码 wrapper/CommandBus 测试覆盖关联收据、幂等、缺报告/未完成拒绝与无额外日结算；公开浏览器沿原 profile 恢复并完成三日日历。失败尝试原始报告保留，不因观察超时重开测试。回滚点为 PR #4 提交 `446e6071791ce14f96477da3313cf440203886d4`；Sites 源线保持独立。
