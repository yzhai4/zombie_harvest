# 注册事件链推进与面板阻塞

**状态：** validated（源码执行与服务器夹具回归）  
**范围：** v83 content-chain-ui-001；SAVE21 / CONTENT3

## 复现与影响

对当前 HTML 中的真实函数执行最小双节点链，第一节点效果生效且 resolver 返回第二节点，但存档中的 active node 仍停在第一节点。`applyContentEffects` 调用 `ensureContentState`，后者深克隆并替换 `contentState`；resolver 更新的是结算前取得的失效引用。

`resolveContentChainCommand` 将失败 resolver 包装在 `{ result }` 内，CommandBus 仅检查顶层 `ok`，因而失败仍写入 `content.chain.command` 成功事件并申请 checkpoint。公共 `resolveChain` 又缺少昼夜和终局 Gate，能绕过按钮禁用执行白天内容效果。

新增事件面板总是优先显示首条 active chain，旧 `state.event` 被遮住；没有切换入口时，SAN/NPC 需求事件无法处理。首项为空或缺包还会崩溃/阻塞后面的有效链。仅包含 activeChains 的保存投影夹具无法证明以上运行时行为。

独立复审还发现：20 条展示 history 同时被当作节点结算事实，22 节点合法循环返回首项时可选另一分支再领奖；显式非数组 requirements 能注册并导致 UI 崩溃，非字符串项则在旧 reducer 中被当作满足。

## 修复契约

- reducer 在任何效果前检查阶段、终局、窗口、active node 和 choice；CommandBus 如实写拒绝，失败不写成功事件和成功 checkpoint。
- 成功效果后重新读取当前 active record 再推进；同一节点/命令不会重复发放奖励。
- optional `resolvedNodeIds` 作为持久结算集合，不随展示 history 的 20 条预算裁剪；旧档由 history 和节点对应的 appliedEffects 复原。集合只接受已注册节点 ID。
- 注册、UI 和 resolver 对显式 requirements 均要求字符串数组；底层条件解释器对非字符串拒绝，不让损坏定义产生奖励。
- fallback/autonomy 不得给未启动链发放奖励；过期只在窗口之后按已启动实例结算。
- 面板提供今日异动与所有有效事件链的选择入口，默认保留未处理的今日异动；缺包/损坏记录不挡住有效事项。
- 事项选择是临时 UI 状态；资源、节点和完成事实仍只存入 contentState。

## 验收与回滚

执行真实源码函数的契约测试，覆盖失败回滚、拒绝账本、多节点、重复、夜间、终局、过期；真实浏览器以明确标注的 day4 保存夹具检查水车选择、切换、锁定和刷新。基础新局 smoke 独立保留，不把夹具测试称为自然四日通关。

源码轨迹 golden 从 `e14e0776` 更新为 `c5d6c772`：只新增 optional 已结算节点事实与资源 before/after 回执，剔除新增字段后仍为旧值。保存投影仍为 `4aec7a31`。更详细证据见 `docs/qa/server-content-chain-20261014.md`。

浏览器脚本首次试跑失败来自夹具注入时机：运行中写 localStorage 被 reload 前的 pagehide checkpoint 覆盖。修为 sessionStorage 暂存、下一次 boot 的 init script 注入后通过；原失败输出保留在 `docs/qa/content-chain-attempt1-20261014.json`。

回滚到 PR #4 的 `522d765a5e736364279e588b9c8ac9f7be50bcc1` 可移除本轮事件链 UI；不得覆盖 Sites v81 生产。
