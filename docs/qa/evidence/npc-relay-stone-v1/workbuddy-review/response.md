**决定摘要**：本片在其提供的局部代码路径上自称一致；发现一个可能的“单一资格”缺口，以及在所给片段之外仍未证明的领域。我没有运行任何东西，无法验证完整程序、正常游玩或发布就绪状态。

**可行动问题**
1. **资格来源可能混用（需验证）**：邀请的产生依赖 `npcRelayStoneSource()` 返回的胶囊来源（依据设计卡中“身份／知识”一节），而 Gate 又要求“唯一、在营、可亲自受理并担任 commander”（依据设计卡中“身份／知识”一节）。所提供的片段没有显示 `npcRelayStoneSource()` 是否真的校验了①接收者身份、②核心实例，还是只读取了 `commander` 标题的记忆（`dist/index.html:2226`、`:2230-2231`）。如果它只检查标题，就违反了“不要让继任者继承记忆”这一点（依据设计卡中“身份／知识”一节）。请核验该函数的正文，并确认它检查的是 `recipientId`，而不是 `commander` 角色。
2. **terminal flag 被复用**：`NPC_RELAY_STONE_TERMINAL_FLAG` 同时也用于 `chain-completed`（`dist/index.html:2225`、`:2292`）；并且 `applyNpcRelayStoneReplyEffect` 没有检查它（`dist/index.html:2268-2275`）。`supply` 是否会重复扣减，取决于已经定义在外层 `resolveNpcRelayStoneChoice` 中的删除和 completedChains 步骤（`dist/index.html:2293-2294`），而不取决于 effect 函数本身。请确认这两个函数之间没有缺口——所提供的片段没有显示它们是如何被调用的。

**六个视角**
- **玩家**：设计卡第15行、第19至20行承诺，交料后石料显示为4/4，且不会带来工时、关系或上线方面的收益；代码在交料时恰好扣减 `stone`、把 `materialProgress.stone` 加一（`dist/index.html:2274`）。这项承诺在所提供的片段内部是成立的，但它是否真的立即呈现4/4，取决于所提供的片段未展示的 UI 部分。
- **NPC**：林岑的理由取决于把“接过核心”视为持续有效的资格（设计卡第37行）；而 Gate 用 `holders.length !== 1` 重新校验角色（`dist/index.html:2230-2231`）这一点在代码中是存在的。没有发现矛盾，但“不因低信任否定事实”这一点仅凭断言，并未由代码证明。
- **营地**：设计卡第38行说所有投入都保留；`applyNpcRelayStoneReplyEffect` 只改动 `stone` 和 `materialProgress` 两个字段（`dist/index.html:2274`），并且 `updateRelayProject` 的节拍没有被触及（设计卡第28行）。仅从所给片段看，没有观察到冲突。
- **势力**：设计卡第39行说没有外交知识，也没有第二份功绩；所给代码没有改动势力或外交状态。仅从所给片段看，没有观察到冲突。
- **敌人**：设计卡第40行说世界与危险继续；`npcRelayStoneTransactionSnapshot` 会捕获并恢复 `hordeForecast` 和 `campaign`（`dist/index.html:2243-2248`），因此没有明显机制会暂停敌人。仅从所给片段看，没有观察到冲突。
- **全局事件链**：设计卡第41行跳到“下一次决定”，而不进入施工或上线；所给代码没有调用 `updateRelayProject`，也没有启动施工。就所给片段而言，这一点成立；下面的未证明边界限制了这一判断。

**最重要的未证明边界**
设计卡第3行和第52行说，提交、timer 竞态、晚故障回滚和 Continue 恢复已在候选 `082e8e2e` 中通过。所给的两个代码片段只显示 `supply` 的扣减和文件内的事务快照；两个文件都没有显示 `updateRelayProject` 的 timer 竞态路径、`later` 分支，或 writer→reload→Continue 的流程本身（`dist/index.html:2278` 需要 `active`；`:2224` 的重新校验在这个片段中没有再次出现）。因此，“提交失效或中途失败不会被写成成功”这一说法，仅凭所给证据无法排除；应把它视为本片段未证明，而不是未发现（设计卡第50行）。
