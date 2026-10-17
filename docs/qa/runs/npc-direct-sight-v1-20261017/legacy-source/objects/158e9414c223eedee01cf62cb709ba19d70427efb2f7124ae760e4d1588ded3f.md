# Active Content Chain 面板（content-chain-ui-001）

**状态：** 已接线（v83 前置切片）  
**基线：** `SAVE_VERSION=21` / `CONTENT_SCHEMA_VERSION=3`

## 玩家承诺

已启动的注册事件链会在“任务 / 事件”面板显示当前节点和全部选择。今日异动与支线用“处理事项”选择器切换；未处理的今日异动默认优先，避免 SAN/NPC 事件被支线挡住。选择沿用现有 `Choice`、`Effect`、`Gate` 合同，经 CommandBus、统一效果 reducer 和事件账本结算；夜间、终局、过期或条件不足时按钮明确锁定。

## 规则边界

- `activeChains` 是保存与回放的唯一事实来源，显示名称来自注册表定义。
- 事项视图过滤缺包、空值、key/chainId 不一致、非 active、已完成与缺节点的记录；不执行这些记录、不发奖励，也不删除缺包实例。
- 选择前再次检查夜间、终局、日窗口和 requirements；公共 resolver 同样检查，UI 禁用不能替代 reducer Gate。
- 选择会写入 `content.chain.command` 与 `content.chain.choice/resolved` 账本，重复 commandId 由 CommandBus 幂等处理。
- 失败直接返回 CommandBus，写 `command.rejected`，不写成功事件或成功 checkpoint；效果中途失败回滚整个效果批次。
- 多节点推进在 effects 后重新读取当前 active record，避免 normalize 深克隆导致失效引用；历史已处理节点不可选择另一分支再次领奖。
- optional `resolvedNodeIds` 持久保存结算事实，展示 history 裁到 20 条也不丢失；旧档从 history / appliedEffects 复原。显式 requirements 必须为字符串数组。
- 按钮绑定渲染时的 chain/node/choice；选择后显示实际效果回执并禁用按钮，玩家主动切换事项后再继续。连续点击不能顺便处理下一节点或今日异动。
- 事项选择与回执只属于临时 UI 状态；SAVE21/CONTENT3 无新必填字段。水车定义版本为 2，仅补标题、说明和成本提示，不改规则效果。

## 六视角验收

| 视角 | 规则与可观察结果 |
| --- | --- |
| 玩家 | 未处理今日异动优先；全部支线可切换；选择后保留实际结果，刷新不再领取。 |
| NPC | 选择效果只通过注册效果改变 NPC，不绕过需求、岗位和死亡 Gate。 |
| 营地 | 资源、营地崩溃和历史变化进入统一 reducer 与账本。 |
| 势力 | 关系或据点效果仍由定义声明，面板不直接发放势力奖励。 |
| 敌人 | 夜间冻结白天链，选择不会跳过尸潮结算。 |
| 全局事件链 | chainId/nodeId/choiceId 进入 command replay 和 `content.chain.*` 事件，多节点与恢复真实执行，固定输入可重放。 |

## 验证与未做项

- `scripts/replay-harness.mjs` 新增 `watermill-002` active-chain 夹具和投影字段。
- `scripts/check-content-chain.mjs` 真实执行 HTML 的 registry/reducer/CommandBus，覆盖长链与坏条件，源码命令轨迹 hash `c5d6c772`；保存投影 hash `4aec7a31` 是另一指标。
- `scripts/server-content-chain.py` 从实际新局保存生成明确的 day4 boot 夹具，再走真实 loader、DOM 控件、reducer、保存与刷新；不把夹具测试当作自然四日通关。
- `scripts/smoke-three-days.mjs` 的本机 fallback 是静态合同检查，不能证明真实三日游戏循环。
- 水车 repair 目前只记录修复 flag；粮水生产、科技消费者、木匠缺席守卫替代、势力关系和完整自治仍待后续剧本卡接线。多选项布局已支持，14 天最终尸潮仍是 v84 工作。
