# GateV1 事件门禁验收（2026-10-16）

**构建：** b33d3dcc5cd9fb2bd8452e6dcb45d9623d1b695dc63dd5d3b051c292a15e7888
**分支：** codex/v82-npc-succession
**范围：** source VM / static contracts；Sites 生产 v81 未变更

## 通过项

| 检查 | 结果 |
|---|---:|
| daytime combat + EventDef/CAS/GateV1 | 23/23 |
| inline syntax | 1/1 |
| report recovery | 177 |
| content chain | 43 |
| night guard | pass |
| content validator | pass |
| replay self-test | 10 fixtures |
| three-day smoke | static 55 |

GateV1 夹具覆盖：NPC SAN 阈值、玩家 SAN 阈值、Choice.requires、relay 事实缺失、未知对象/路径/额外字段、非法 phase、inactive instance 和 CAS-before-Gate。所有 Gate 评估均为只读。

## 限制

本机没有 Python Playwright；因此没有新的真实浏览器多日回归、性能结论或 Sites 发布证据。生产站点仍保持 v81，待独立源线对账和发布验收后再决定是否部署。
