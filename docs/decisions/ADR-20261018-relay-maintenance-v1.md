# 中继当前能力与付费维护 v1

状态：已实现并完成[QA列明本地验证](../qa/relay-maintenance-v1-20261018.md)；开发ref／精确CI与生产分别核对，不表示体验通过。SAVE21/CONTENT3不变，复用已有建筑字段，不新增maintenance状态机。问题见[原反例](../problems/PROB-20261018-relay-station-operational-state.md)。

## 玩家闭环

工程完成是历史；站点损毁会关闭当前中继增益。玩家看见已完成工程、实际耐久和停用原因，靠近同一站支付2木材、14行动体力，即时修复1耐久，再真实推进20分钟。推进仍有战斗风险；修过不保证结束时仍完好或玩家存活。上线历史、交付记忆、已投入材料和一次收益保留。

## 事实与能力

私有纯查询 `relayStationCapability()` 区分尚未完成、可运行、已损毁、已停用与无法确认。只认项目buildingId对应的唯一live relayStation、合法2×2几何、有限0..8耐久和可信boolean标记；当前运行还需正HP及active/relayEnabled均true。显式HP0停用；缺HP、缺/坏标记、缺站、错type、重复ID或坏几何不补造状态，不捡另一同type建筑代替。

历史完成查询独立保留。普通ensure、查看、renderer和快照不重建已完成却缺失的站点，不补0为8、不改身份、不为显示重写forecast。首次真实合法施工可以创建8HP站；已有受损站完工时保真实HP。真实伤害、成功效果事务提交、施工完成和实际维修负责同步当前标记与下一场预报。回滚单op不得泄露forecast或状态改变。

完整旧writer允许省略HP时，缺值保持未知且合法降级，不当作0、满血或整体坏档。未知健康不能付费维修；满耐久但旧标记不可信也不虚构可用。没有已知旧格式证据便不添加推断迁移。人口、岗位、资源和历史伤亡不受这种降级改写。

## 实际消费者

当前感知profile、直接所见支持输入、外围压力/累积系数/SAN、下一场forecast、显示及新遭遇共用当前能力。失能沿原营地预报18/0/eastern-breach；正常沿既有92/lead/relay-guided-west，92是参数，不称统计准确率。中继既有8点防御仅在当前有效时贡献，不顺手重平衡其它建筑。

新遭遇开始当次核能力并锁定route、数量、progress与defense；已开始/已结算battle及报告继续读当次锁定事实，不被当前维修或损毁追改。已有contact可以是历史记忆，失去增益不等于NPC失明或遗忘。原推进span中已经结算的福利不倒扣，后续span消费新状态；不声称大步/逐分的全世界等价。

## 真实维修

扩展既有building.repair命令的绑定站分支；执行距同站≤1，查看保持≤1.25。提交重核唯一live身份、项目完成、实际可确认的受损HP、DAY/非暂停、资源、必要父子编号预算与真实 `planWorldAdvance(20)`。显式stale/detached/未知ID不改选其它建筑。原墙默认行为和奖励合同保留。

新站复用共享整数分钟/credit计划，记录requested20、实际whole/credit和schedule；不照抄旧攻击的局部小数禁令。费用与真实物理前缀、afterAdvance的同目标状态、当前能力、子command/event/causation分别写proof，actor明确player-1。duplicate复用原Bus历史，不再次支付或维修。

站维修不再发上线事件或上线standing。当前camp-chain的repair步骤仅要求building.repaired、没有wall predicate，因此真实站维修可以推进该任务，后续原整链一次parts奖励保留；不凭另一个木墙mission推翻此资格。

物理+1在advance之前实际发生。若推进后再毁或玩家致死，保真实费用/修理前缀和当下终态，不退款、不宣称当前可用或安全。玩家死亡沿既有DAY流程：父最终收据后清理并保存；维修不抢先checkpoint，也不覆盖结局保存/重试状态。不把未知内部异常描述为全局回滚。

## 保存与验收

正常writer与实际Continue保损毁HP、历史、记忆和一次收益；下一tick不复活，再Continue不补奖或造过去受击。旧forecast原值可以保留，但当前只读显示按能力解释；真实写入点记录预报变化，新遭遇不依赖此前timer已刷新。

以当前7b23和候选同方法证明真实受击→停用→正常保存/Continue→下一tick，以及真实付费维修、同ID/Gate/预算/credit/duplicate、再毁/致死前缀、旧missing和锁定battle边界。TEST-ONLY的HP0定位只证明恢复/UI，不冒充自然受击；浏览器需真实公开操作、正常writer在reload前、同主响应SHA、新boot水位和390可读原因。保留原失败，不mock新能力helper。

## 六视角

| 视角 | 本片约束 |
| --- | --- |
| 玩家 | 投入历史、当前失能、维修成本与风险都可读；实际功绩保留 |
| NPC | 岗位/需求/FOV/LOS继续，失去中继加成保基础能力和旧记忆 |
| 营地 | 保库存、占位、配给与人口；缺站或0HP无免费重建 |
| 敌人 | 保原伤害、索敌、cadence和真实时间风险 |
| 势力 | 保既有承诺及合法维修任务后果，上线奖只一次 |
| 全局链 | 完成历史、当前能力、当次锁定来源分别维护且可恢复 |

本片未证明自然战损频率、经济/难度最优或真人理解。公开完整主线及理解pilot、完整Actor/Planning/Memory/Social、Studio、多副本/大世界、UI素材与GameCore/引擎、P0–P6长期目标继续开放。
