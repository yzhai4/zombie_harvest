# NPC self 首谈开发验收（2026-10-17）

源码 `3213db16f5976dc3049f084851bcb3e811a094d5`；HTML `c42056ed08c9cbc0e27c09365828fae5d1c19dc25190e9e19d2e3beffa45bc91`；开发分支 `codex/v82-npc-succession`，SAVE21／CONTENT3。用户报告原文及存档版SHA均为940efac9a98227db2b4512771e474c8366b629d50d72d8e912923d83e2cf06ee，作为设计输入。证据HEAD与精确CI由[PR #4](https://github.com/yzhai4/zombie_harvest/pull/4)核；没有生产部署、自然多日或玩家乐趣结论。

## 交付与六视角

真实 `npcPublicActionGate` 返回的同一live NPC，在原dialogue-open UI写入前进入私有capture→纯self知识投影→披露交集→固定自述。本人伤势与需求不依赖全图感知；高信任不增加知识，非法／缺失信任不默认0。缺失或冲突事实保守unknown，unknown不归因成NPC确认的台词。详情门槛为实际trust>=-10；低信任保留本人生命状态，隐藏HP band和需求。需求每次只说最高优先级的一项。

| 视角 | 实际边界 |
| --- | --- |
| 玩家 | 免费首谈0体力／0分钟，听到需求后可找食物或暂缓；再次确认仍按原2体力／15分钟支援，不新增休息指挥能力 |
| NPC | 同一live身份、原公共资格、自身来源与个人信任；critical／E0／暂停也保留原免费首谈 |
| 营地 | 无人口、资源、岗位或福利增益；负晋升总分夹0，负信任对已有正进度的抑制保留 |
| 势力 | 不借营地trust冒充个人关系，不虚构外交信息、承诺或奖励 |
| 敌人 | 不改变敌人、伤害或预警；原真实推进死亡／中断合同继续回归 |
| 全局链 | 不新增事件定义／保存域；原typed结果、父命令player-1、proof.npcId和checkpoint语义保留 |

纯capture／project／expression不写state、RNG、storage或事件；承载首谈的原公开动作仍有UI／命令／账本／checkpoint。内部observationHash不证明世界授权或秘密性；未来不可信模型适配只能拿已披露DTO，不开放内部capture、宽快照或兼容纯project API。

提示按自述换行并延长到12秒，普通toast复原原样；实际浏览器覆盖>2秒仍同文本、窄屏完整显示及普通短提示复原，未声称实测完整12秒到期。

## 证据

| 层 | 当前结果 | 原生入口 |
| --- | --- | --- |
| 新self源码／actual render-writer | 104／104；同方法旧d251为101／104 | [原生报告](runs/npc-self-observation-v1-20261017/self-source/native/candidate-c420-final104.json)与[完整映射](runs/npc-self-observation-v1-20261017/self-source/index.json) |
| 独立架构 | 19／19，原方法同新源；不是晋升专项计数 | [原生报告](runs/npc-self-observation-v1-20261017/architecture-independent/report.json) |
| 既有源码 | 40个既有合同＋额外C2合同66，均exit0；含C1 source120 | [执行矩阵](runs/npc-self-observation-v1-20261017/source-execution-matrix.json) |
| 实际Chrome self | 四场212／212，runner83ad1873，actual native validation33项均通过 | [原生报告](runs/npc-self-observation-v1-20261017/browser/01-self/report.json) |
| 实际Chrome原NPC | 112／112，原runner不变 | [原生报告](runs/npc-self-observation-v1-20261017/browser/02-npc/report.json) |
| 实际Chrome原episode | 12／12，主manifest固定原生runner | [原生报告](runs/npc-self-observation-v1-20261017/browser/03-episode/report.json) |

当前42个不同源码合同均通过；104等子检查不另算执行次数。Chrome共336检查、errors0，记录的45个主文档响应均为c420；self13与NPC30为response listener，episode2为原显式HTTPbody记录，不能混称45次页面导航。self／NPC清理标记全true；episode原runner在关闭浏览器／server后才输出成功终态。root目视需求桌面、390宽与低信任三张，文字完整可读；它只验本提示，不是整款移动端验收。

新的源码夹具和浏览器输入均由c420真实loader／renderer／writer重新捕获，manifest18a195463a5fe3c792bed658dd78f47ca16b2bbc286e86abe8912e3aa899a8c4；属于TEST-ONLY派生场景，保留原敌人／库存／十人，不是自然游玩。旧源98结果、原方法失败与旧源negative分别保留身份，不转为104或新构建成绩。

## 原失败与修复

旧d251的Chrome四轮全部保留在[原始失败包](runs/npc-self-observation-v1-20261017/browser-historical-failures/failure-summary.json)。前三次分别为立即重写storage、存档含name、CSS过渡未结束三个方法假设；前三次不能宣称整个功能通过。第四次85／86发现真实 `renderContext→evaluateNpcPromotion` 将trust-10算成progress-14，完整native JSON被原validator以npc-hero拒绝，尚未进入该场首谈。只在原合计分数增加0下界，保留关系来源、负贡献、正分、100阈值及既有状态行为；详见[问题](../problems/PROB-20261017-npc-negative-promotion-progress.md)。

最终104方法对d251有3项失败，共同指向这一个晋升下界问题；c420全通过。旧healthy／HP1矛盾由独立实际writer复现，新self降级unknown但不修写旧世界，[全局问题](../problems/PROB-20261017-npc-life-state-hp-consistency.md)继续open。既有eligible重复事件也未扩修。ROOT额外回归第一次因漏ZH_PYTHON在启动子测试前失败，修正执行环境后10项全通过；旧输入闭包遗漏／数组原型方法问题等历史失败原件保留，不说所有轮次全绿。

## 运输与开放范围

原生报告保持原字节。新旧source inputs用[self映射](runs/npc-self-observation-v1-20261017/self-source/index.json)内容寻址；既有回归的438条引用用[运输映射](runs/npc-self-observation-v1-20261017/native-artifact-transport-map.json)对到已有普通文件或15个标准ZIP条目，[ZIP索引](runs/npc-self-observation-v1-20261017/regression-native-archive-index.json)逐项解压重读SHA已核。ZIP仅作无损运输，不是新增执行。泄露本机路径的历史报告仅发布明确标记companion及原SHA，原件私有保留；未重写成当前native通过。

完整ActorObservation的直接视野、contacts TTL／来源、共享知识、岗位授权及模型隔离仍proposed；不因self通过关闭。下一P0继续这些实际consumer，再接规则NPC规划、EventFact／记忆与生成表达。GameCore、UI／素材、自然多日／玩家体验、最终尸潮、大世界／多副本及特殊角色连续性继续按依赖推进。
