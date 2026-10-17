# 合法负信任导致晋升进度为负并写出不可恢复保存

日期：2026-10-17。状态：**已修复并完成列明开发验收**：HTML c42056ed，source104／Chrome self212 覆盖负信任的真实保存与刷新，见[QA](../qa/npc-self-observation-v1-20261017.md)。关联[免费首谈 self ADR](../decisions/ADR-20261017-npc-self-observation-v1.md)。本问题独立于[lifeState／HP 一致性](PROB-20261017-npc-life-state-hp-consistency.md)，不关闭全局晋升或健康审计。

## 实际反例

HTML `d2512764bc54c9efb665168869cde08c6b8ac00f567ecb02229915fadd1d3896` 的实际 Chrome run04 在 needs-threshold 场景终态失败。原 TEST-ONLY 场景是完整真实 native writer 派生输入，保留敌人、库存和固定人口；carpenter 为 injured／HP50、个人 trust=-10、剧情 step0、hero.progress0、campTrust0。原输入通过真实源码 validator，负信任属于既有 -100…100 合法范围。

公开 Continue 后的实际 renderer 调用 `renderContext → evaluateNpcPromotion(npc,'context')`。原公式只限制上界：`round(min(100, chainProgress*45 + min(1, affinity/25)*35 + trustGateBonus))`。在本例中剧情项与营地信任项均为0，个人信任项为-14，故直接写 `npc.hero.progress=-14`。它不是新 self 捕获或表达组件的写入；场景尚未进行首谈。

`normalizeNpc` 在准备旧档时把 progress 限制在0…100，但 Continue 后 renderer 又写回负数。随后真实 pagehide → immediate checkpoint → writer 将负数写入完整 envelope；checksum合法并不代表语义合法，实际 validator以 `npc-hero` 拒绝该保存。原输入与 pagehide 保存的日历均为第1天06:00、eventSeq2、replay command数0，不能把该失败归于支援支付、需求台词或推进时间。

独立只读核对的原件如下，均保持原字节；当前尚待本片 QA 归档，不记录机器内部执行路径。

| 原件 | SHA256 |
| --- | --- |
| run04 `report.json`，85／86，唯一失败为 pagehide native validator | `2ce02a6e7bcb9534d2b3d046987fcb67a0c41eef0c0596ca3a451755a5f9e9b8` |
| `needs-threshold-input-save.json`，完整合法输入，checksum `dd95c822` | `85627dca55205eeaa08870b3e2cebf63cdf39df2fc472e188848192a02298484` |
| `needs-threshold-actual-pagehide-before-public-action-save.json`，完整实际writer，checksum `4bbba5e2` | `bb9634bb7338113923103a09b292d73b8606d74573dcd68b01f17da7ff7f1778` |
| 实际 browser runner | `83ad1873814ab1e0af1a98f6a7db97ca74819c1d594a735d0298b425be8a0dac` |

旧冻结 C2 HTML `61ea64b27a65cc4a271c214c16126b40a453eae40c8684c106bc8edc89e5f115` 中已有相同公式及 context 调用；原字节可由[源工件 ZIP 索引](../qa/runs/scenario-boot-c2-20261017/source-vm-archive/archive-index.json)的 `boot-c2-source/source.html` 恢复核对。这里只读核对旧代码，没有重跑旧 Chrome，也不把此次 run04 失败移给旧构建。

## 最小修复与保持项

候选 HTML `c42056ed08c9cbc0e27c09365828fae5d1c19dc25190e9e19d2e3beffa45bc91` 仅在原合计分数外增加下界0，保留原上界100与取整。负信任仍能压低已有正进度，个人关系字段不改；剧情、信任、营地贡献、晋升阈值和既有正值结果不变。

不能通过把 trust 改成0、将整个信任贡献限为非负、修改合法夹具、放宽 validator 或在 writer 临时修补来掩盖错误。仅 loader 归一化也不能阻止下一次 renderer 写出负值。当前最小修复仍保留 renderer 计算并写晋升事实的旧调用结构，不由此宣称 renderer 已纯读、晋升事件已全面幂等或全部晋升路径已审计。

定向出口已由同方法 d251 101／104 负控与 c420 104／104 源码正控、c420 Chrome self 四场212／212验证：相同完整输入真实 Continue／renderer／pagehide 后 progress保持0且完整保存通过原validator；实际reload保持负信任和原世界事实；self首谈／披露与支援合同不退步。有正剧情／营地项时负信任仍有抑制，正常正值和100上界保留，run04 原失败另存。独立19项仅是 self 回归；既有 eligible 重复事件仍属开放边界，本片未改。
