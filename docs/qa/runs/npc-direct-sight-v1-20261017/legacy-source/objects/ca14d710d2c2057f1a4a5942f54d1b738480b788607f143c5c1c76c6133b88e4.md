# 被动体力按调用分片丢失

状态：fixed-in-development；源码25d315ae / HTML32f911f6已验真实时间区间与旧writer，见[QA](../qa/camp-rest-20261017.md)。生产未修改。

## 实际复现与影响

冻结HTML `efe039775346f4ee34269495810d9d9e778603d2bfac26996ff5e0b884cd7f0b`，完整旧browser writer `scripts/fixtures/npc-threat-attention-v1/browser-writer-day1-1110-save21.json`，SHA `5fdd18e8307d4109e671d7fb98298722611854fafb23c5b72a3491c1f1e32ee4`。

在实际loader启动的两个独立source-VM场景，从11:10、energy53分别执行真实60次`advance(1)`与一次`advance(60)`，两者都到12:10，但体力分别53和56。旧`recoverEnergy`每次计算`floor(minutes*passiveRegenPerHour/60)`，默认3/hour在自然1分钟tick下始终为0。此处确认被动再生的分片缺陷，不将大步和小步的敌人/战斗轨迹视为等价，也不称浏览器自然玩法验证。

现有UI会提示等待恢复体力，公开小步等候若照搬旧公式也不会兑现已有再生率。调用旧shelter整备的18E/8HP/SAN奖励不能代替被动恢复；这会改变普通等待的经济和人物后果。

## 修复合同

见[营地等候ADR](../decisions/ADR-20261017-camp-rest-v1.md)。从实际推进后的`worldMinute()`取得end，以本次真实分钟m取得start；按固定世界时间节拍的`floor(end*r/60)-floor(start*r/60)`结算已有再生率r，并应用既有max。没有新增存档余数、操作计数、平铺休整奖励或载入追补。

默认3/hour下，每跨真实20分钟边界恢复1点；60×1、1×60、30+30、跨午夜和中途保存/重载在相同区间应一致。非整点30分钟可能跨两个边界，因此新结果和旧`floor(30*3/60)`不同是明确修复后果；不声称旧数值全部不变。满值溢出丢弃，不积未来信用。

验收要同时有原源码负控、实际advance区间、分片/整段对照、满值、旧writer原资源保持和刷新相位；不自行抄写公式当唯一oracle。新golden若受此规则修复影响，先解释原始输入与体力差异，再更新目标，不能为保hash恢复错误规则。runtime build SHA绑定本次规则实现，SAVE21/CONTENT3的保存和内容语法不变。

## 另一个已发现但未修的配置边界

隔离VM对旧`setWorldRate(.25); advance(1)`产生fraction minute，真实writer的strict calendar校验会拒绝。该setter当前没有公开入口，尚未证明自然玩家路线能触发；不把它扩大为生产存档普遍损坏。本轮等候明确只支持`clock.rate===1 && !paused`，不默改旧档rate。任意倍速/分数时钟应另定整数时间与迁移合同。
