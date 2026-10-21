# DAY 玩家致死结局 v1

状态：合同已实现，完成列明[源码与Chrome开发验证](../qa/day-fatal-outcome-v1-20261018.md)；发布ref/精确CI和生产分别确认。SAVE21 加性字段，CONTENT3 不变。问题来源见[实际反例](../problems/PROB-20261018-day-fatal-outcome.md)。

## 玩家结果与边界

实际白天扣血致死后，本局进入 LOSS：停止后续生存输入和模拟，显示玩家白天倒下、真实来源、保存状态与公开重新开始入口。玩家生命为零不推定 NPC 死亡、核心建筑损毁或营地崩溃。旧夜战报告不作为这次死亡的战果；未知统计不补零，不显示尸潮完成百分比。

## 状态与顺序

三个真实入口为自动 DAY 战斗、主动攻击后的原反击、成功内容效果事务。不可回滚扣血先锁存本次来源和 `gameOver:'lose'`；不在伤害 helper 内 freeze 或保存。内容效果须等最外层成功事务及其真实嵌套效果稳定，失败回滚或同事务恢复到正 HP 不触发结局。

最外层 CommandBus 在恢复 activeCommandId、写出原成功或中断拒绝的最终收据后，才做结局收尾。清理会话、休整、输入和 timer 的过程中禁止提前 checkpoint；最终死亡事实及胶囊完成后立即调用原 writer。原 rest step 先计实际完成分钟，再由收尾停止。没有来源锁存的旧 HP0 状态不自动补结局；未知 reducer 异常不被描述为全局事务回滚。

无外层 Bus 的直接 `ContentRegistry.applyEffects` 只保证其最外层效果事务提交后收尾，不等待外部调用者的后续语句。当前玩家 choice 走 Bus；生产作者定义没有 HP 致死效果。未来若给直接 `resolveChain/resolveFallback` 注册此类效果，须先把完整链收尾纳入统一命令边界，不能将本片声明为任意外部内容调用的全链事务保证。

已付费用、即时命中、实际推进与其世界后果保留。子推进已致死时，攻击不再追加尚未发生的个人奖励或第二次反击；父命令保留真实中断结果。既有 BATTLE 结算保持独立。

## 一次事实与存档

新增可选 `dayFatalOutcome`：`{version:1,eventId,sourceEventId,cause,sourceId,commandId,tick}`。cause 闭合为 `day-combat`、`attack-retaliation`、`content-effect`；引用只来自本次实际来源，没有引用时显式 null。tick 为实际 world/phase/schedule。最终 `player.dayFatal` 是玩家事实，不分配额外 command ID；必要父子命令刚耗尽 MAX_SAFE 时仍须终结。cleanup 的命令若耗尽则如实保留拒绝，时钟清理不得依赖编号成功。

保留窗口内校对来源与结局引用；窗口外只保留严格结构和已有来源声明，不猜历史。旧 missing 槽不回填、不凭 HP0 创建死亡事实。未知版本、坏字段、未来 tick、与生命/结局冲突拒绝。旧明确 loss 继续兼容；旧 HP0/null 仍为 RECOVERY_REQUIRED。

该校验覆盖字段、主体和保留窗口内的引用一致性，加载时不重新模拟历史敌方资格或全部伤害公式。

writer 保留同 raw 结构与实际恢复分类的写前检查。有效 DAY 结局恢复为 LOSS 且 night=false；不再推进时间、恢复生命或结算奖励。保存失败维持冻结现场，明确旧安全存档仍保留；公开重试只重写同一结局，不重复伤害、事件或奖励。重新开始复用原公开清档、generation 与导航流程，清档失败继续停止会话。

## 六视角

| 视角 | 本片承诺 |
| --- | --- |
| 玩家 | 真实失败可见、可保存、可继续查看、可重开；保存失败明确披露 |
| NPC | 保留各自真实生命、人口与经历；玩家失败不补人或造死亡 |
| 营地 | 保留真实建筑、库存和 collapse；不把玩家 HP 称为核心耐久 |
| 势力 | 不撤历史承诺，不发虚假信任或关系收益 |
| 敌人 | 保留真实攻击、费用与世界推进，不退款或删敌 |
| 全局链 | 原父子因果和最终收据先完整，再记录一次玩家结局 |

## 验证范围

以真实 runtime/Bus/effects/writer/loader 覆盖敌伤、原反击、子推进中断、效果回滚/回血、命令预算、旧档和写入失败重试。rest 敌袭须先核可达性，不能绕过近敌 Gate；必要的 TEST-ONLY 注册效果定位与当前生产剧情分别标明。Chrome 用 boot 前完整旧 writer 夹具、实际公开操作和正常 writer 水位验可见报告、Continue、重试与重开，所有主响应绑定同一 HTML。

当前验证范围与原失败见QA，生产未部署。中继当前能力/付费修复、公开完整主线与理解 pilot 仍待后续；Actor、Planning、Memory/Social、Studio、多副本/大世界、UI 素材、GameCore/引擎及 P0–P6 长期目标保持开放。
