# Leader LLM harness replay contract

这一步仍是离线 sandbox，不导入 `dist/index.html`，不调用生产 reducer，也不修改 SAVE21/CONTENT3。

它验证：

- 同一 `ProjectionV1 + IntentEnvelopeV1` 两次执行得到相同 normalized state / ledger hash。
- 同一 `intentId` 重复提交不再次扣 command point，也不追加第二个成功事件。
- 模型不可用或输出不受支持时，产生拒绝回执并选择注册的 `abstain` fallback；不改变世界。
- `gameStatePatch`、`eval`、`script` 等自由执行字段在进入 Gate 前拒绝。

运行：

```text
node scripts/check-leader-harness-replay.mjs
```

该 sandbox 的 hash 只证明离线合同，不证明真实 GameState、CommandBus 或浏览器行为。下一步必须用同一合同接入 headless 真实账本，并增加 SAVE/replay 迁移夹具；在此之前不添加生产 leader schema。
