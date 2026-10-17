# Leader CommandBus bridge runtime evidence

这份 checker 使用现有的 `check-report-recovery.mjs`，在 Node VM 中加载完整 inline runtime，并执行一次真实 `plan.meeting.commit`。它不打开浏览器、不发布 Sites，也不把模型或领袖字段写入存档。

当前验证了：

- 真实 reducer 接受 support 计划会动作。
- CP 从 1 变为 0，计划变为 committed。
- replay command、event commandId、causationId 和 SAVE21 writer/validator 均存在且一致。
- 第二次旧动作不会再次提交或扣 CP。
- 生产账本目前把 actor 记录为 `player-1`；领袖身份尚未持久化，因此报告明确标记 `migrationRequired=true)。

运行：

```text
node scripts/check-leader-command-bridge-runtime.mjs
```

这一步证明的是现有 reducer 的承接能力，不代表领袖 runtime 已接入。下一步需要单独的 SAVE/replay migration ADR，定义 leader actor、intentId、policyVersion 和 fallback 的持久化字段。
