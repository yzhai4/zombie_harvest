# 公开中继路线：回收与交付前缀

2026-10-18；开发工程pilot，完整主线未通过。运行时保持HTML `dccb52ff94a0101992f6696c3ecb93c7092b1049d85dbbe2701d5e6ad1ca004a`／SAVE21／CONTENT3，无本轮游戏代码或生产部署。开发head `9b38754950775bc6e30a435b1ac15cc5c64a74a5`与精确[CI297](https://github.com/yzhai4/zombie_harvest/actions/runs/39059412475) completed／success已重新实查；CI不是本次公开主线通过证据，后续文档head另核。

## 输入与实际执行

原始完整native A／B经本构建真实loader、正常checkpoint及第二次Continue核验：仅首次session-start checkpoint reason与activeCommandId缺省两差，第二次完整payload／envelope零差，原人口、敌人、RNG和Scenario绑定保留。没有world.advance或新迁移。浏览器仍使用原输入字节，不用核验后的writer替换：A `ebd2c2a6f1ab12b0e62dc6ba235231b4a229916759cdf1662c2594ed9ac4c7e6`，B `d0d160f8b03c6323e51611ff6013895d52713d0775bcd56dc8d84ba86b46fded`。

两臂seed1592639710、独立Chrome155 context、rate1未暂停、AI OFF，从unknown开始；一次预启动安装后只经真实Continue与公开键鼠。导航只用当前及过去真正公开的地图／本人位置，隐藏世界只作工程结果核验与保守危险veto，不返回目标或方向。不是fresh natural新局、真人实验或纯角色观察。B改变初始库存及四堆莓果的有限食物可用量，不是只减库存。

每臂固定900秒／720世界分钟、18父业务承诺、30业务尝试、80UI／240导航段、90秒按键、8次接受等候；有限F4／食物2，HP≤35止损。攻击实际推进10分钟，发现推进20分钟；未暂停阅读和导航也计真实暴露。自动world.advance不另算玩家决策。

| 执行 | 原终态／现场 | 实际业务及主线 | 未覆盖 |
| --- | --- | --- | --- |
| A01／旧方法 | NAVIGATION_UNRESOLVED；06:11，HP100／E78 | 34段均有位移；0业务，核心未回收 | 发现及之后全部 |
| A02／方法02 | BLOCKED_PUBLIC_INFORMATION；08:25，HP86／E72；耐久08:20／food8 | F2＋发现＋交付，共4父业务；staging，材料0/10、0/5、0/4，工时0 | 接受等候、实付筹料、施工、online／预警／reload |
| B02／同方法02 | BLOCKED_PUBLIC_INFORMATION；08:21，HP86／E67；耐久08:20／food0 | F3＋发现＋交付，共5父业务；staging，材料与工时仍0 | 同A02；未执行断粮Choice或手动进食 |

全部实际terminal exit1，页面errors0，context／browser／server清理均true；不将止损称游戏通过。A02为209导航／25UI、B02为192导航／25UI，均未超原限。两臂动作节拍与战斗次数不同，不能据此推断食物的因果效应、平衡或乐趣。严格缺岗C尚无合法单因素输入，真实死亡／继任案例不冒充严格C。

## 两处方法解释更正

A01选最东可见地块但未先筛可达分量；已见水带两岸不保证已有通路。仅原初始／最终公开UI可复现这个方法反例，未保存中间完整view，不能宣称逐帧重放。方法02先筛已观察连通区域、四向未知前沿、保留短路径目标及暂未连接地标。12/12离线方法控制通过，不是游戏检查；原方法与失败保持。方法02 driver SHA `daa8cf6e9e606a791be7a6062814ffbe0456b05ebcbdbf51c5f9c7f9a386ed7c`，导航模块`f8e0267d0f4667e836ecdc4235b407e24cbabe22730cae4f25bad4861e5939ea`，helper原`3cee685d306d00d8cc561ef55b138fd378362f7aff0a36e5e452ba2edb576b4e`三文件实际冻结执行。helper作者时静态标签由policy companion与实际actions解释，不称所有预算分支都已运行。

A02／B02原解释“No observed shelter marker”不准确：最终公开context中30／60分钟等候均存在但disabled。方法只记enabled位置，错误退役了实际等候地点；原status／reason／report字节不改，独立伴件校正为“入口存在，但未能使用”。A02事后同水位live资料符合nearby-threat条件；原帧未捕获Gate返回，不冒充当时实测原因。B未作敌人几何归因，不能照搬A原因。这支持[等候禁用反馈问题](../problems/PROB-20261018-camp-rest-disabled-feedback.md)，不支持放开危险Gate、游戏软锁或敌人削弱。

## 可供下一切片使用的真实来源

A02 `evt-000150 / cmd-000677 / world479`，B02 `evt-000146 / cmd-000646 / world481`均为player-1向actual commanderId=commander交付同核心，后续正常writer已保存。A02即时003-native仍是交付前水位，003-live才有交付；最终006-native world500已含交付，006-live world505。不能用即时native声称动作已写盘，也没有reload去重证据。

这为[首个记忆切片](../research/eventfact-handoff-plan-20261018.md)提供真实业务与实际旧writer回归输入；未来新实现仍需新的真实成功交付生产记忆，不从这些旧档回填。交付是完成事实，不是有期限的工程保证。记忆开发不等A／B／C全部绿、online或全部contacts收口。

## 六视角与归档

玩家需知道入口不可用的理由；NPC的发现敌情／职责与历史记忆分开，不能承诺自动救援；营地成本、人口和工程进度保留；势力不新发关系奖励；敌人压力和等候安全规则不变；全局链只到实际交付及筹料状态，后续未完成。root已目视A01终图、A02交付及终图；其余布局／真人理解不由此验收。

选择性证据见[runs目录](runs/public-relay-mainline-20261018/selected/index.json)。原报告SHA：A01 `95483dc0fb3355d0fe63873472487ff2e8d266e7ec69a1bed3704d9d2d6939d4`，A02 `3a014e710871e092a21cce5c76693030dfcc184a717bf5a8e8490204d271e176`，B02 `4c5fb3816773498512829bc10750f3edb887e492ad14d3807d0f3f645987ecb2`。原失败、真实执行版本、完整现场及截图另保留；选中工件不等于完整运输归档，归档核验不算玩法通过。

本轮只改计划／状态／试玩Skill参考并新增记录，Skill结构校验通过。未因文档改动重复相同游戏源码合同；旧构建证据不迁给未来源码。下一先补禁用原因的最小可见反馈，再实现本人来源记忆；完整主线、自然三日、规划收益、玩家研究、Studio／多副本和引擎／素材目标继续active。无Codex全局记忆变更。
