**决策摘要**：局部函数与包内提示在物资增减方向上一致（supply 为库存−1、工程+1；later 为0）；但“是否真的能执行”以及“工程进度/库存后续”不由这段材料证明，需维护者核对若干前置门与状态一致性。

**观察证据**
- supply 提示：库存石料−1、工程石料+1、不立即施工或完工（`content/packs/npc-relay-stone-v1.json` 第30行）；effect 参数为 amount=1（第32行）。
- later 提示：本次不扣物资（第36行）；amount=0（第38行）。
- 函数仅当 `choiceId==='supply'` 时执行 `state.stone-=1`、`materialProgress.stone+=1`（`dist/index.html` 第2274行），与提示相符。

**推断（非证明）**
- later 分支不改 `state.stone` 与工程石料，返回的 before/after 相同（第2273、2275行）。这是代码路径的阅读结论，未执行。

**不由本材料证明**
- 前置条件是否满足：`meta` 权限标志、`defId`/`actorId`、`activeCommandId`、effect 形状校验（第2269行）、`contentEpisodeGate`（第2271行）、`npcRelayStoneOfferGate`（第2272行）；不满足则直接返回失败，无物资变化。
- 负库存防护、`stone` 上限、`gate.source.projectId` 存在性、以及“营地之后仍可能自行取料”（第26、36行）的后续行为。
- “不保留库存”“不再询问”等文案承诺与其它系统的一致性。

**需维护者核对**
- 文案称交料“不额外支付体力或分钟”（第30行），但本函数未见任何体力/时间扣减，也只是未扣；是否存在别处扣减**未知**。
- supply 是否先校验 `state.stone>=1`，本片段未见，**未知**。
