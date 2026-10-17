# 农务目标、来源与自然短路线验收

日期：2026-10-17。源码 `b1abc2eed9376959412fa9c8ff9a6c6816e969c7`，HTML `19cb05c4341ab1353e1ac5362b685a4af3a88fc826e349504b9d57a42639eb6f`，SAVE21／CONTENT3；开发 PR [#4](https://github.com/yzhai4/zombie_harvest/pull/4)。生产未部署，Sites版本本轮未探测。Git精确验证与当前head CI在PR记录，不继承旧green。

## 行为与规则

按[农务合同](../decisions/ADR-20261017-crop-target-v1.md)统一近身连续距离≤1.25、live唯一田块及公开按钮传ID。默认保留数组首个合法田块；显式错误／删除／重复／detached／超距不换目标。实际Gate先于扣款，无效操作明确拒绝，无空成功。新建建筑立即获得稳定唯一ID，不消耗额外RNG，不靠刷新补身份。

保留播种1种子、gross4体力；收获3食物、温室另1药草、gross6体力与原advance(20)。实际时间倍率、自然恢复、NPC用餐及敌人后果分开记账；没有重写大步模拟或新增未知异常的全局回滚。父农务命令及crop.changed都显式player-1，时钟子命令仍可system，经真实因果关联。

## 本构建证据

| 类型 | 结果与边界 |
| --- | --- |
| source／方法 | 原30条＋补充6条＋断粮1条（43项检查）＋农务1条（64项检查）＝38条命令，全部exit0；三个既有goldens c5d6c772／66c9368d／4aec7a31以原native记录为准 |
| 新农务source | 64/64，真实函数／Gate／renderer／监听器／E／建造地图点击／loader／writer；原浮点、斜向、边界、多田、坏ID、资源与会话、编号预算、立即新建→播种、重复和刷新。派生控制明确TEST-ONLY |
| 新农务Chrome | 35/35：原fresh04浮点旧writer原字节boot；另一个明确离线派生的成熟温室。播种与收获的同plot、gross支付、20分钟、player来源及刷新；不是自然成熟 |
| 受影响Chrome | 断粮72/72、休整93/93、驻守37/37、episode12/12；6／9／4／2主文档body均19cb，农务另4次。零page errors，资源已关闭。episode只导出持久payload，不称完整raw writer |
| 实际writer兼容 | 新19cb真实source-VM中TEST-ONLY派生成熟菜田，经原context renderer／listener收获、真实writer及loader reload，Python strict收获／刷新通过；旧51实际原浏览器151／152保存仍兼容。6b8系统来源仍被拒；两种无食物变化的战斗事件只按实际源码加入中性白名单，未知food仍拒 |
| Python方法控制 | 79项synthetic，未运行游戏／浏览器；独立于实际writer兼容，不折算成79场 |

所有实际native报告、执行脚本、输入与声明sidecar保留原字节，见[manifest](iteration-manifest-v1.json)及[runs](runs/crop-target-v1-20261017/command-exits.json)。原始失败不改成成功。根代理目视本构建农务2张、休整1张、驻守1张、episode1张、断粮2张、自然终态1张；不声称看过全部截图。真实trusted hidden仍unavailable。

## 自然fresh06与原失败

[原报告](runs/crop-target-v1-20261017/natural-fresh06/report.json) SHA `aa4dbcdbd0dc7943af9940e8b7b87acf96b487145d626e1fcfbdc64ff357f4a5`；最终runner2ff1fb86／协议1cdf608d，真实exit0／SHORT_MIXED_OBSERVED。七项必需coverage齐：事件选择、采集、探索、NPC支援、30分钟有目的休息、菜田种植、消耗木材12、石材5及45分钟建塔；15/15执行检查，60.581秒，7主要动作、idle0。终态第1天09:23／HP100／E67／SAN75／food13／十人存活／collapse0，terminal完整writer SHA `7bdf13bf4830bb0b3bcd3ed9e2a6bee0af45878d568836c86cea04cead94d114`。刷新核不重复支付；3次显式主body检查均19cb。writer仅作只读证据和安全否决，不给玩家或NPC新增全图知识。

[独立只读复核](runs/crop-target-v1-20261017/natural-independent-audit/audit.json)核51项原工件SHA、18份真实writer的源码validator、203分钟／78条时钟重放连续因果、七项实际变化及刷新无重付；15项独审检查通过并列出限制，未修改原report／summary。

NPC这次初次就在1.0内，真实support／bond／memory＋15分钟成功。Canvas名字观察器与跟近均0次，未安装wrapper；仅代码方法复核，不能称该分支经过实测。有限观测器不等于ActorObservation知识投影。

原32的fresh01–04继续由[前轮索引](runs/shortage-choice-v2-20261017/natural-baseline/index.json)保留。6b8的fresh05真实exit1、6/7，NPC公开上下文在1.25内却在执行1.0外（实际1.018159931…），不是支援成功；本轮[距离问题](../problems/PROB-20261017-npc-context-distance.md)仍open。不能拼接失败前缀为一轮通过。

中间6b8农务浏览器原33/33没有actor断言；严格Python及最终source负控抓到系统来源。这是实缺陷，最终19cb修actor并重跑35/35和64/64，没有放宽player要求。冻结297在旧63项runner下54项失败；6b8在最终64项runner下27项失败，范围和runner不同，不合并失败计数。

独立复核另确认既有补给箱aHint写6体力、实际付4（E78→74）；旧event.resolved／resource.collected事件仍system而父命令player-1。行为真实发生，七项coverage成立，但不能称全部UI成本或全局actor一致。两项另列[公开成本与旧来源问题](../problems/PROB-20261017-public-event-cost-and-legacy-actor.md)，不重写原报告／旧历史。

## 未完成与下一轮

自然短路线没有战斗、成熟收获、夜间和三日，不能推出全面平衡或玩家喜欢。自然三日独立验收，不反复刷短线代替长期推进。接下来先保留NPC查看1.25／实际执行1.0的原规则，统一按钮资格、同ID重核及拒绝；再实现Scenario真实boot的seed／有限粮食轴与旧档不重算，再接actor知识投影。继任双岗、采集目标回执、零粮计划词值、大步模拟差异、完整最终尸潮、生产部署继续另列。
