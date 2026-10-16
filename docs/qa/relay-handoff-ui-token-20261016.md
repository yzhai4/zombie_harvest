# relay handoff UI token QA

**日期：** 2026-10-16  
**范围：** 真实 context menu → `relayHandoffExpectedToken` → `handoffRelayCore` → CommandBus validate  
**状态：** 开发分支已接线；生产 Sites v81 未部署

## 生产调用链

中继核心交接目前只有一个真实 UI producer：白天靠近营地长官时生成的 context button。按钮在渲染时记录：

- `data-relay-instance-id`
- `data-relay-def-id`
- `data-relay-definition-version`
- `data-relay-event-id`

点击事件把 `button.dataset` 交给 `relayHandoffExpectedToken`。缺失字段归一化为 `null`，随后沿 `handoffRelayCore` 的统一顺序执行：四元 EventInstance CAS → GateV1 → 长官存活/距离、核心库存和项目状态校验 → 原交接 reducer。没有向 relay 的元数据 choices 添加未执行的 `requires`。

## 远端证据

- 提交：`d897937386f0885c357b52c6872efa3f53edf7f2`
- CI #225，run `38906128691`，static-validation job `116990035216`：通过
- `source-daytime-combat`：26/26；新增：
  - `relay context button carries and dispatches the full CAS token`
  - `relay UI token adapter reaches CommandBus and stale event rejects`
- stale event token 返回 `event-state-conflict`，项目和特殊物品快照保持不变。
- 证据是源码 VM/静态 DOM 合同；Python Playwright 不可用，因此不宣称自然浏览器或多日验收。

## 生产边界

领袖 LLM 适配器仍是 headless harness，合同与运行时检查明确 `productionWiring: false`；当前没有真实 LLM relay producer，不能声称 LLM 已传递 token。施工/上线自治路径仍未迁入正式 ContentChain/EventInstance 事务，本 QA 不扩大该结论。六视角影响仍分别由玩家、NPC、营地、势力、敌人和全局账本审查。
