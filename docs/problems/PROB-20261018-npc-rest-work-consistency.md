# 低精力恢复与例行工作互相覆盖

状态：candidate-fixed；source验证已覆盖列明范围，浏览器／发布尚未收口。对应[剧本卡](../scripts/npc-rest-work-v1.md)与[ADR](../decisions/ADR-20261018-npc-rest-work-v1.md)。

原构建HTML23b8，完整同源writer定位第1天09:00。低due和normal输入只差木匠energy23.5／40；均真实advance(1)。low-due恢复至23.545，却发一次例行`npc.work.completed`并被覆盖为岗位工作、工坊目标。将该低输入仅workClock59→58时，没有工作回执，但显示休整、behavior仍work、目标仍东门。两种终态分开，不拼成同一画面。原十人／四敌／资源保持，无资源产出，不能称产木或重复领奖漏洞。

原报告SHA`e8ae592913a7b363caf493999ab8c6a1bd7ae124ddb38a8b019082004a9bb21e`，三输入和normal真实after-native已固定在[CI子集](../../scripts/fixtures/npc-rest-work-v1/repro/input-manifest.json)。原完整执行及候选正负证据按QA portable map保存；子集不冒充完整归档。

根因是恢复生理、日程文字、行为阈值、移动目标和每小时工作各有独立判据。新候选给唯一有效健康本地木匠一个持久恢复安排，统一这些consumer；更紧迫需求／正式职责接管、完成步不重复credit，并将真实恢复span传给原SAN节拍。仅改变本片例行分支，不声称全角色、到岗工时或生产经济已统一。

独立静态首审还发现完成步先清intent会使SAN误算工作、岗位统计包含驻守原任、取消后残留rest行为；均已最小修正。浏览器预审修正新说明被旧span样式压到8px的问题。源码方法的API导出错误、旧native精确迁移预期、原浮点accumulator归零、BATTLE本就拒存、已到home时target合法null分别为方法问题，原失败保留，不算额外游戏缺陷。

当前3218源检查17/17；同方法23b8负控4/17，其中除特性缺席外含旧长分支方法适用性错误，不能说13个独立缺陷。保留原敌人与需求的162分钟轨迹跨24后因真实警觉取消，木匠E30.79／HP100，玩家HP88，food8；未达到36，不称完整恢复或自然三日。近完成／bulk输入只证明对应边界，真人理解和新成本平衡尚无结果。
