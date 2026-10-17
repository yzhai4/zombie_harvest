# Leader LLM headless ledger adapter

这是 V1 合同的下一层离线实现，仍不导入 `dist/index.html`，不调用生产 CommandBus，也不增加 SAVE21/CONTENT3 字段。

它固定了：

- 严格规范化 `IntentEnvelopeV1`，未知字段、旧 projection hash 和非法预算 fail closed。
- `PlannerReceiptV1` 的 accepted / rejected / duplicate 三种结果。
- 规则 fallback、model unavailable、重复意图的幂等和 `replayHash`。
- 带 SAVE21/CONTENT3 特征的对象不能作为 headless world 输入。
- 重放从 immutable initial world 开始，并按原始输入和 modelCase 重放。

运行：

```text
node scripts/headless-leader-ledger-adapter.mjs
```

这仍然是离线契约，不代表真实 GameState 或生产事件账本已经接入。下一阶段才把相同 receipt 结构映射到真实 reducer，并增加 SAVE/replay migration fixtures。
