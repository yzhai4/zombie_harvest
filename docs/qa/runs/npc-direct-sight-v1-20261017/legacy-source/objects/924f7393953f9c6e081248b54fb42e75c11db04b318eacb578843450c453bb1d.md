# 断粮四策略受控源码实验

状态：COMPLETE_CONTROLLED_SOURCE_PROBE；非自然试玩／策略胜率／平衡通过。2026-10-17。

冻结HTML32f911f6，完整旧writer5fdd18e8经声明派生boot，day1 23:20／food2／energy53／玩家HP52／十人／健康后勤／未用藏粮／collapse10／resonance25。实际loader与startChain创建同一day1 episode，再由真实writer给四分支同一起点。A立即ration，B立即forage，C暂缓且原莓丛真实采集一次，D暂缓不补；剩余时间用真实advance(1)至1440，各最多一个choice或采集，无新增事件收据。

| 策略 | 午夜食物 | 体力 | 玩家HP | 崩溃 | 共振 | 藏粮 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| A立即ration | 0 | 55 | 64 | 10 | 25 | 未用 |
| B立即forage | 1 | 55 | 64 | 7 | 27 | 已用 |
| C暂缓并采集 | 1 | 47 | 64 | 7 | 25 | 未用 |
| D暂缓不补 | 0 | 55 | 64 | 8 | 25 | 未用 |

A与D除清除／保留待办外，测得列示结果只差+2崩溃；午夜相同的真实防御计划降低3崩溃，不能用净值掩盖选择gross代价。配给请求均为3，但A／D实付2、缺口1；B／C实付3。64HP来自原午夜+12，非新恢复机制。

独立诊断：C采后food4使开始Gate拒绝新事件，但原episode保持且可实际forage再+2；这条额外choice属于另一个writer分支，未混入C主终点。B次日新episode经真实writer重载后，永久flag拒绝再取，未退款／重置。C支付8体力／原动作30分钟，末端再生令该动作净体力-7；不能把净损失称原支付只有7。

C包含一个原30分钟批处理，其他是40次1分钟；NPC总HP994对982、敌人目标不同。这个设计不能隔离全部时间分片影响，因此只报告可达性和实测事实，不称C更安全。原resource.collected.resourceId=null也保留；具体原莓丛amount2→1、food+2、关联命令／时间收据是独立旁证，未填补缺失字段。

原生report SHA `8d6544b1d6b073273b5f485505c724d44df60a5d4eb6866c025108c1fec93b9a`，执行runner SHA `c76a776764d080fb29ae95ee19a94a807aef96cdb41c3e9676aff8de792dcef6`。8项方法检查0失败；17工件（1派生输入＋16真实writer）逐SHA核验。首轮跨realm数组断言方法错误的METHOD_INCOMPLETE原报告私有保留，没有改变这轮结果或预注册场景来补绿。

[原report和工件](runs/food-shortage-strategies-32f911-20261017/report.json)保留原字节。执行时协议另存protocol-executed.md，SHA ce3b11405da41302385424cae3cfdd9ef4b5bbb95bb2370a617043457d63bdde；当前协议已更新，由input-mapping.json明确重绑定，不把新文本冒充执行协议。

据此采用[选择v2 ADR](../decisions/ADR-20261017-shortage-choice-v2.md)：移除确认额外代价、解释有限备用与实际库存，显式兼容已知旧定义。此实验只诊断旧版，没有证明新候选已验收，也不证明真人偏好。
