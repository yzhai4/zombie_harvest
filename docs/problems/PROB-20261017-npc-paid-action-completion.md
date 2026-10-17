# NPC耗时动作的真实生命周期中断

状态：开发候选9edb6d3c已完成source110及实际Chrome112列明检查；待精确Git/CI归档，生产未部署。SAVE21/CONTENT3不变。

旧19cb及中间r2 e40c在实际15分钟advance内将critical医生从HP1打到0后，支援仍补SAN/help/成功；首次命令仍把死亡同步清掉的order写回并发Accepted/Changed。使用原生普通敌人、真实移动/感知/day combat/damage，不替换伤害或advance；受控初始场景为TEST-ONLY。原始审计见[源码审计](../qa/runs/npc-public-actions-v1-20261017/source-audit/audit-clock-and-completion.json)，最终负控索引与原生候选在[本轮QA](../qa/npc-public-actions-v1-20261017.md)。

修复按[合同](../decisions/ADR-20261017-npc-public-actions-v1.md)：提交前同目标与资源资格；真实advance后再核身份/本地/生命/会话，正常走动不重新要求1格。已支付、时间、伤害及既有前置效果保留，后续奖励/命令/成功停止；独立npc.actionInterrupted与最终command.rejected后请求自动checkpoint，再实际reload核无重复。自主拒绝也保留其原关系事实并自动保存。没有新增全局异常回滚或永久人物功绩账本。
