# 据点守军的营地作战边界

来源代码对象 `407a2db8ca21c106fb60ab1c6e188fc653db2ffd`；HTML SHA-256 `71657c62e7adfcd9b6f6d7e4a8aa89a8fe0976ea6603c63b8f706e79ef68bfd8`。SAVE21 / CONTENT3，未部署生产。

复核上一轮注意力修复时，实际 `captureOutpost` 派出的守卫仍能在保留的营地坐标攻击、被敌人新发现并受伤。此次沿已有岗位/人口账本语义新增 `npcIsCampLocal`，在营地双向伤害及新感知/共享入口排除已派驻者；真实释放后恢复资格。没有改变人口、据点奖励、伤害、射程、视锥或critical政策。

| 本构建实际验证 | 结果与范围 |
| --- | --- |
| NPC attention / camp membership | 29/29；同一新脚本对原51f为24/29、exit1。完整原writer基础上的真实据点派驻/释放派生场景，source VM |
| 既有回归 | 30条命令全部exit0；隔离副本195个输入测试前后字节一致 |
| 链 / episode / Gate / Observer / source slice | 54/54、30/30、20/20、21/21、5/5 |
| 保存投影 / static smoke | 18 fixtures、`4aec7a31`；55/55 static。原链golden `c5d6c772`保持 |
| 安全方法 | 28/28，HTML为71657；冻结runner `bc16789f`不变。真实inline进食/攻击与单敌预算控制，不是三日 |
| 真实Chrome旧writer episode夹具 | 12/12、页面错误0；首载和reload的实际HTTP文档均为71657，两张截图已目视检查 |

原生报告、公开选择截图和刷新保存位于 [runs/garrison-attention-20261017](runs/garrison-attention-20261017/)。原76项检查器方法报告按不变字节沿用，不冒称重新游玩。[当前严格manifest](iteration-manifest-v1.json)绑定本源码对象、HTML、依赖与报告。归档本地没有Git，`commitVerification=unavailable`；当前PR完整历史CI才核来源祖先及声明脚本字节，上一51f的CI #283不继承为本构建通过。

六视角及未关闭范围见[驻守问题记录](../problems/PROB-20261017-npc-outpost-camp-presence.md)。本轮仅收紧营地作战与新信息资格；routine、motion、render、地图getNpc占位及群体福利仍有离营遗漏。不能称整体驻守自治、完整观察权限或critical伤亡政策已完成。

## 日历与自然玩法证据分开

此前A的玩家死亡、B的900秒预算失败均保留。C在冻结的**51f**构建上terminal exit0，1488/1488检查，1642.125秒到第4天06:35；strict独立Gate及导出目录自包含重验均270/270。它实际训练93次，没有运行71657。完整范围与hash追加在[原构建QA](daytime-attention-20261017.md)，不计为本构建的三日通过；也不证明自然节奏或平衡。

[自然混合试玩协议](natural-play-protocol-20261017.md)核实了公开入口：N的“推进时间”实际上只启动遭遇，报告关闭不拨动日历；当前没有公开睡眠/倍速。因此下一P0是修离营参与范围、记录有意义行动与节奏、解决断粮补粮后的事件收敛；如需公开休整，必须按真实小步模拟、敌人危险中断、午夜配给/计划/作物、timer ownership、幂等与旧档合同实施，不能直接改日期。

随后才推进[Scenario真实boot](../decisions/ADR-20261017-scenario-boot-contract.md)、[actor知识投影](../decisions/ADR-20261017-actor-observation-v1.md)、规则规划与内容。剧本设计师按玩家、NPC、营地、势力、敌人和全局链审查来源与后果；报告原文是带SHA的设计输入，模型研究统计不计游戏结果。没有修改系统memories。
