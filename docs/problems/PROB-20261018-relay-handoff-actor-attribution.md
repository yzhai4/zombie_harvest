# 中继内部交付API的actor来源边界

状态：open／实际source QA已复现。原发现基线HTML108042／源码1db8954；最终记忆片HTML2dd27255的当前source checker用真实完整持核心writer、actual Continue与内部handoff入口传入TEST-ONLY unsupported actor，旧业务实际成功且收据actor保留，个人player-1记忆不生成。见[QA](../qa/relay-handoff-memory-v1-20261018.md)与其原source25报告。此为受控source负控，不是公开任意actor入口或LLM运行结果。

当前handoffRelayCore可接内部options.actorId，并把它写入父命令与成功event；reducer的关系／功绩来源及距离仍按玩家语义执行。eventDefinitionGateCheck实际评估phase与preconditions，尚未执行EventDef.actors元数据的逐choice能力授权。因此不能由actors列表存在就声称任意错误actor命令已经被拒绝。公开UI默认player-1，本记录不等于存在公开的任意actor入口或已启用领袖LLM。

本轮[交付记忆合同](../decisions/ADR-20261018-relay-handoff-memory-v1.md)仅支持本次实际player-1来源；其它actor若按旧业务成功，保持原receipt但不生成玩家共同交付记忆。测试须分别观察实际命令结果与胶囊结果，不能把投影拒绝说成命令拒绝。

后续逐choice Actor／Capability合同应在原费用／reducer之前核真实调用者，明确玩家、NPC与自治的权限及来源，保幂等、拒绝收据和旧已结算历史；启用相应LLM工具前必须有实际负控。该工作不作为当前单事实本人记忆的全系统重构前置。
