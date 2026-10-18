# 白天致死伤害未形成可恢复失守状态

状态：开发修复已验证，生产待发布。7b23的真实死亡、最终收据、一次LOSS、正常writer／Continue和公开重试／重开已完成列明验证；见[QA](../qa/day-fatal-outcome-v1-20261018.md)与[合同](../decisions/ADR-20261018-day-fatal-outcome-v1.md)。开发ref／精确CI以本次发布收据为准。

以下为保留的原始复现与当时下一行动，不覆盖上述现状。

在272f实际完整runtime与原IO中，去掉旧竖切片孤立覆盖scenarioSnapshot.seed的夹具错误后，真实30／1440／1440分钟推进到第三天；wz-4实际combat事件evt189将玩家HP4→0，gameOver仍null。正常writer结构validator为true，真实classifySavedRecovery却为RECOVERY_REQUIRED／unconfirmed-zero-hp，Continue拒绝。该状态不是renderer遮蔽或补造HP产生；DAY伤害路径缺少最终失守语义。诊断与源方法原件已保留，不能据此称自然生存三日。

当前2bad候选writer增加实际恢复分类检查，拒绝覆盖主档／备份；修正后的日历测试验证savefalse、主备逐字不变、实际Continue恢复旧安全DAY checkpoint。这个保护不会保存刚刚发生的第三天败局，也不修复现场缺失的失守报告。

下一修复需统一实际DAY致死入口：一次确认的loss事实、停止日间输入／timer、保留真实已付成本与伤亡、展示可用的失守／重开入口，并正常写入可恢复LOSS。核对主／子命令收据、active rest与排队旧callback、重复致死／reload幂等、实际敌人伤害和玩家攻击原反咬两类来源。不直接把任意旧HP0坏档自动认定为合法失败，也不补血、删敌或撤销损失使测试通过。

六视角：玩家能理解真实死亡并重开；NPC／营地不被玩家HP字段误判为全灭；敌人保留实际致死功效；势力／承诺历史不撤销或发虚假奖励；全局账本与保存只结算一次。修复前保留现风险，下一优先于中继当前能力／付费修复，然后回到公开主线与理解pilot。
