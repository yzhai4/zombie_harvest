# EventFact首片：接收者记得真实交付

状态：首片已接线并完成[列明本地验收](../qa/relay-handoff-memory-v1-20261018.md)，开发证据与精确CI另核。源码d1542fd／HTML2dd27255，SAVE21／CONTENT3；108042／源码1db8954为实施基线，dccb为原来源锚点。源自[报告落地计划](research-adoption-plan-20261017.md)及[真实公开交付](../qa/public-relay-mainline-20261018.md)。不是完整Memory／Social或跨副本系统验收。

玩家承诺：交付核心后，再次查看同一位实际接收长官，能读到何时、谁把什么交给了他；正常保存／Continue后仍可核实。查询不变成支援、额外耗时或刷关系。历史事实与实时工程状态分开，不承诺完工期限、安全或未发生的施工。

## 实际生产与消费

唯一生产入口是`handoffRelayCore`拿到`dispatchCommand`本次真实成功结果之后：ok、非duplicate、正确type／actor／四元token及payload.commanderId全部匹配，才向当次接收live NPC写最小来源胶囊。不能在支付／reducer中途、通用事件监听或字符串lastReport中制造成功记忆；返回事件不能替换成lastEventId，后者可能已被任务子事件推进。

首片可用`npc.memory.relayCoreHandoff = null | capsule`，胶囊限定版本、来源eventId／commandId／tick、actorId、实际recipientId、项目／物品实例及对应定义／实例版本。事件身份只在当前世界／存档范围使用，不宣称跨新局全局唯一；跨副本ContinuityContract另立。来源需要在有限事件账本淘汰后仍可解释，不能只存悬空指针。

接既有同ID免费查看／名册中的本人事实行，保持真实1.25查看Gate与角色资格，纯读不调用记忆／关系规范化。共同参与的交付事实不因高信任补知识，也不借伤势自述的其它捕获范围无关拒绝；无记忆返回“未记录”。不把同岗者、继任者或全营地自动变成知情者。

## 保存与拒绝

实现前冻结严格胶囊校验、writer、pure draft loader与已知完整旧writer缺省合同：旧档缺槽仅补null并记录必要一次adapter，不从briefed、关系flag或旧账本猜接收者／回填记忆，不重发原奖励。二次Continue不得再迁移。损坏、错身份／定义／时间数据与缺字段分别处理，不能把坏数据默认为真实记忆。

保持同次同步成功结果之后的写入在正常checkpoint之前完成；核实际自动writer，不能依赖pagehide掩盖漏存。无须为记忆再发第二个交付成功事件或关系奖励。重复命令及保存恢复只保一份，继任不转移他人共同经历；死亡／离营保留历史但查询资格按原规则降级。

## 六视角与出口

势力只留实际营地接收来源，不增加外交；营地保核心与既有功绩一次结算；NPC只记本人实际参与；玩家有免费、可核实且可用于下一行动的反馈；敌人和阅读暴露不暂停；全局链以成功receipt、因果与保存为准，LLM不造事实。

最小验收包含实际成功交付→同人物公开回忆→正常writer→Continue及新tick仍同记忆／无重复收益；拒绝、duplicate、错人物、继任、旧档unknown及账本窗口淘汰作有意义负控。A02旧native可作真实旧writer输入，不能给它补造未来源码才引入的记忆。没有真人Attachment／乐趣结果时只称工程出口。

A／B／严格C、online、完整contacts所有topic均不是本片无限前置。Studio、完整规划／记忆／关系、特殊角色跨副本连续性、更大世界、UI素材、GameCore／引擎适配和后续研究继续开放。

[六视角与真实调用路径预评审](../qa/six-view-eventfact-handoff-20261018.md)已完成，只读设计结论不算实现或运行时验收。
