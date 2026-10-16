# EventGateV1 shadow module QA

**日期：** 2026-10-16  
**范围：** `scripts/lib/event-gate-v1.mjs` 与 `scripts/check-event-gate-v1.mjs`  
**状态：** 本地 shadow module；未接线 `dist/index.html`

## 检查命令

`node scripts/check-event-gate-v1.mjs`：7/7 通过。夹具覆盖阶段与夜间放行、阶段数组、工具/科技/flag 字符串、白名单路径、actor NPC 路径、地标/信任/日期/NPC/flag 对象条件、坏条件 fail closed、畸形状态容器、读状态不突变与规范化默认值。

`node scripts/check-daytime-combat.mjs`：23/23 通过。该检查继续以当前 inline runtime 为依据，未修改构建产物。

## 对齐边界

模块复制当前 inline GateV1 的条件词汇、解析顺序、返回 reason、phase/nightAllowed 规则和 `npcIsActive`（`lifeState !== 'dead'`）语义。调用方通过 `context.state` 提供状态；模块不发事件、不写状态、不执行效果。

为保证独立调用安全，非 object 或 array 的 gate 返回 `gate-invalid`，而当前 inline 函数对显式 `null` 会抛异常、对数组会按缺省 DAY 继续；这是有意的 fail-closed 防护差异。`context.sessionMode`、`context.sessionController.mode` 和 `context.SessionController.mode` 的 `BATTLE` 读取是 inline 全局 `SessionController.mode` 的纯函数注入等价物。

该模块没有替换 runtime，也没有证明 browser/线上 parity；接线前应把同一批 fixtures 通过 source replay 或 adapter 比较一次。


