# EventGateV1 inline/shadow parity QA

**日期：** 2026-10-16  
**范围：** `scripts/check-event-gate-parity.mjs`、`scripts/lib/event-gate-v1.mjs` 与 `dist/index.html` 的 inline GateV1
**状态：** 源级只读 parity；未接线运行时、未部署 Sites

## 检查命令

`node scripts/check-event-gate-parity.mjs`：11/11 通过（共享 10 个 GateV1 夹具，并额外检查夹具集合同时包含允许与拒绝路径）。runner 将 inline 函数片段放入隔离 VM，把同一状态和上下文分别交给 inline 与纯模块，比较 `ok/reason/gateVersion/phase/checked` 以及规范化 Gate envelope。

本地共享工作树的 HTML hash 为并发工作树值，不能作为远端发布证据。远端 CI 必须输出该 runner 的 authoritative `sourceHtmlSha256`；本轮不上传或部署本地 `dist/index.html`。

## 边界与失败语义

- parity 只覆盖两边共同支持的正常 Gate envelope；纯模块对 null/array gate 的额外 `gate-invalid` 防护仍由 `check-event-gate-v1.mjs` 单独覆盖。
- 11/11 不等于任意畸形状态容器的 parity：影子模块已经对 `landmarks`、`npcs`、`player.tools` 做了 fail-closed 防护，但 `contentState.unlockedTech` 等容器的异常形状仍由各自合同决定，不能从本 runner 推广结论。
- runner 不执行 reducer、EventEffect、CommandBus、存档写入或浏览器动作；通过不能替代自然试玩或真实多日 browser smoke。
- 任意结果漂移、inline 函数边界变化或 fixture 预期不一致都会 exit 1，先停在 PR，不进入 Sites 发布。


