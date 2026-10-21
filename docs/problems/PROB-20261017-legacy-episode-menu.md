# 旧一次性完成记录隐藏新 episode 菜单

状态：开发分支修复；生产未发布。发现构建：HTML `fff09e894dd051c290e60e59a6dac8d58130610bfff7f6caf4cfa8b30d002b22`（CI #281 仅证明既有夹具范围）。

复现：从完整原 writer 的 TEST-ONLY fixture 派生旧完成档，删除 active 并保留 plain chainId completed；实际 loader 迁移、保存日 hold、下一日 start 均成功。`eventContentChainViews()` 仍按 plain chainId completed 过滤，导致新 `chainId:2` active 不出现在公开菜单。

根因：保存/执行入口改为 episode key，UI 消费者仍使用旧完成标识。旧 29 个源码检查只验证下一日 start 成功，没有验证实际菜单。

修复：repeatable 菜单按 active.instanceKey 判断 completed，旧非重复链仍按 chainId。新回归执行真实 loader / writer / reload / eventContentChainViews / renderEvent，确认事项下拉和两按钮的新 token。仅给既有 IO adapter 补 DOM `replaceChildren` 集合操作，不替换被测 renderer 或规则。

验证：episode runner 现为 30 项，最终计数与构建绑定见 [QA](../qa/episode-observer-20261017.md) / [manifest](../qa/iteration-manifest-v1.json)。Chrome 原 active 旧 writer 场景重新执行，范围仍为 fixture-browser；新一次性完成档菜单路径的证据是源码 VM，不能冒称新增 browser 场景。

工作流改进：状态迁移涉及新的去重标识时，逐个核对菜单/renderer/按钮生产者等消费者；start 成功不等于玩家有可见入口。原 #281 与旧工件按其实际构建保留，不改写为已覆盖该问题。
