# ADR-20261017-outpost-presence-v1：据点驻守者的完整离营资格

**状态：implemented / locally validated；当前来源CI另验，生产未发布。**  
**适用：** 现有 Web/Canvas、固定十人 roster、SAVE21 / CONTENT3 的据点驻守切片。  
**源码基线：** `dist/index.html` SHA-256 `71657c62e7adfcd9b6f6d7e4a8aa89a8fe0976ea6603c63b8f706e79ef68bfd8`。  
**问题：** [PROB-20261017-npc-outpost-camp-presence](../problems/PROB-20261017-npc-outpost-camp-presence.md)。实际实现和41项source/37项真实浏览器结果见[QA](../qa/outpost-presence-20261017.md)；本文件保留设计合同，生产状态单独记录。

## 1. 决策与设计来源

**驻守是同一个人的地点与职责转移，不是死亡、删除或无限兼职。** 驻守者保留真实人口、生命、需求、关系和占用事实；退出营地的移动、碰撞、现场工作、现场福利、近距离交互与营地作战。远处仍更新需求和既有据点账本，但不借此补造远端战斗、生产、配送或救援。

本决定落实以下当前 L0 规则：

- [01 整体世界观与叙事法则](../../剧本/尸潮农场/01_整体世界观与叙事法则.md)：固定人口；离营实时转移岗位；自治仍按需求、职责和风险运行；效果由统一 reducer 留账。
- [02 14天时间线与最终尸潮](../../剧本/尸潮农场/02_14天时间线与最终尸潮.md)“人口计数和守军”：驻守者计入生存人口、从 campLocal 扣除；派后 campLocal≥1 且 livingRoster≥3；核心耐久与 campCollapse 仍独立。
- [05 势力营地与敌人多视角](../../剧本/尸潮农场/05_势力营地与敌人多视角.md)及[06 NPC体系](../../剧本/尸潮农场/06_NPC英雄晋升与普通NPC体系.md)：职责、需求、伤亡和投票有因果，死亡不补人，不凭对白生成跨地点劳动。
- [07 计划会](../../剧本/尸潮农场/07_计划会与commandPoints.md)：投票/执行取决于实际资格，权限和 CP 不能绕过可用状态；本 ADR 只增加地点资格，不重定受伤者现有权重。
- [08 战斗与据点规则](../../剧本/尸潮农场/08_战斗武器技能建筑科技统一规则.md)及[09 数值与预算](../../剧本/尸潮农场/09_数值、性能与实体预算.md)：派驻扣可用守军、据点有真实维护；远处保留需求和岗位账本，不要求逐人动画或迁移引擎。
- [outpost-garrison-001](../scripts/outpost-garrison-001.md)：现有人口派驻、每日 food upkeep、死亡释放、secured/strained/vacant 与现有幂等水位。

L0 没有定义运输队、个人远端库存或远程投票协议；本轮不把这些未实现机制当作解释漏洞的前提。

## 2. 当前已实现与尚未实现

71657 已有 `npcIsCampLocal = npcIsActive && !garrisonedOutpostId`，用于营地日间 NPC 攻击、敌人新索敌、NPC 感知及共享接收者。对应29项源码测试证明其夹具覆盖，不证明完整离营或自然游玩。

原有实际能力包括：

- `captureOutpost` 在已发现据点附近派出现有合格守卫，写双向占用，清 support/order；并不把角色坐标移动到远端。
- loader 以 `contentState.outposts[*].guardNpcIds` 为权威重建 `garrisonedOutpostId`，去除无效/重复占用；人口账本区分 livingRoster、campLocal、workEligible、garrisoned。
- 营地岗位/继任已通过 `npcHasRole/npcFulfillsRole` 排除驻守者，防止部分核心职责重复供给。
- `applyOutpostUpkeep` 每据点每天一次按定义扣共享 food；不足时据点 strained、campCollapse实际+2；无有效守军变 vacant。死亡/释放更新原占用并留账。
- waterMill 等已发现地标的一次性探索奖励、已注册支线及 hooks 继续沿原路径；它们不是守军持续产出。

**尚未实现：** 远端守军战斗 AI、据点独立敌人/战报、运输耗时与途中损耗、远程投票通信、地图护送、远端医疗救援、派驻过程动画及真实往返旅行。`supplyDistanceReduction` 等定义字段不自证已有配送模拟。当前本地 routine/motion/render/work/welfare 等仍有 active consumer；以下是待落实合同，不能写成已修复。

## 3. 单一身份与三类资格

人口/需求资格与地点资格必须分别命名，不全局替换 `npcIsActive`：

| 投影 | 本轮语义 | 典型使用 |
| --- | --- | --- |
| living / world-active | 沿既有生命状态，驻守本身不使人 inactive | 生存人口、完整 roster、关系/生命保存、全局需求与口粮基数、死亡与占用释放 |
| camp-local | world-active 且没有有效据点占用 | 营地坐标、近邻实体、现场劳动/福利/交互、营地昼夜战、现场投票资格 |
| outpost-present | world-active 且有权威据点记录与反向 marker 的同一占用 | 远端需求、驻守名册、据点维护与状态报告；不自动获得远端产出或战斗能力 |

占用冲突仍由既有 normalize 合同处理，不能让某个 UI 自行清 marker 使角色恢复营地资格。驻守者的旧 `x/y` 只可作为保留的上次营地位置数据，不是“实际仍站在那里”的事实。campLocal 不等同于 healthy；本 ADR 不顺手改变 critical/injured 的战斗或投票生命状态口径。

派驻前须以拟提交的去重名单计算派后人口，守住 campLocal≥1/livingRoster≥3、槽位、核心岗位、继任/其它 contentJob 与跨据点占用 Gate。**campLocal≥1 是实际捕获硬 Gate，最后一名本地角色不能被派完；既在 `outpostCaptureGate` 检查，也在统一 `captureOutpost` effect 的实际支付/写入前复核，不能靠公开 wrapper 掩盖直接 effect 漏洞。** 拒绝不扣成本、不写成功回执、不发奖励。当前只能派非核心现有守卫的事实保持，不借本修复开放新派遣角色。

## 4. 食物与远端需求：明确采用共享阵营库存

**决定：驻守者仍可消耗共享 food。** 当前 food 是阵营级抽象库存，不是仅代表营地厨房现货；本轮保留既有全 livingRoster 的每日配给基数和每人需求取粮机制，避免把外派变成免口粮策略。食物账分清三笔：

1. `chargeDailyRation`：livingRoster 人口基数，包括驻守者；保持现有 `max(2, ceil(population×0.28))` 与 `lastRationDay`，不因营地地图上少一人减配给。
2. `npc.need.fulfilled`：同一人的 hunger/needClock 达到既有阈值且共享库存有粮时，按原规则支付1食物和实际恢复；驻守者同样可以发生。UI/日志称“驻守配给（共享库存）”，不称“回营厨房取餐”。事件至少能以 npcId 和其实际 presence/outpost 归因；旧空字段不回填虚构物流。
3. `outpost.upkeep`：按 OUTPOST_DEFS 的据点维护成本额外支付，当前岗亭/水车/聚落门1、检查站2；它是据点运营和驻守维护的抽象成本，不替代个人配给/需求消费。保留原 `lastUpkeepDay`、不足不负粮、strained/+2压力的合同。

这不是新增配送：没有运输队、路程、送达、补给线受袭或免费库存转移；本轮也不假设维护付款会给守军 hunger -30 或填满 energy。费用来源和用途公开区分，后续若统一经济成本须另立平衡/迁移决策，不能在 presence 修复中悄悄免一笔。

**远端最低模拟继续运行：** 保留 hunger、fatigue、energy、stress、social、safety、SAN 与 needClock，以及生命/伤势与故事 cooldown；使用既有需求系数和世界时间，派驻不恢复这些数值。按世界时段/自身需求生成“据点驻守 / 据点休整 / 等待驻守配给”等状态。休整可使用原正常恢复规则，但不把营地“回到居住区”解释为远端角色真的回营。

远端支路不能写 camp 的 homeZone/workZone motionTarget、调用 campWorkPulse，或把高 social/safety 需求解释成走到营地找同伴/检查营地防线。驻守不清空需求、不固定 SAN、不把饥饿永久暂停。camp 局部遭遇的 `state.night/eventThreat`、集体训练与共享感知不凭空成为远端经历；阵营级 morale/粮荒等确有全局含义的现有变量仍可按声明作用，不承诺把所有间接影响彻底隔离。

全局真实粮荒可按原规则影响全 livingRoster 的需求/压力；远端缺粮的已实现后果仍只有原需求变化及据点 strained/崩溃压力。没有远端袭击来源就不能据此制造守军掉 HP、失踪、死亡或救援成功。

## 5. 本地 consumer 的完整排除表

| 系统 | 驻守期间必须停止的营地参与 | 仍保留的事实/远端处理 |
| --- | --- | --- |
| routine / continuous motion | 不写/执行营地目标，不向工坊、岗亭、食堂移动；不让旧 motionTarget 继续生效 | 人物需求和健康继续；状态明示驻守。派驻清执行中目标，历史工作记录保留 |
| camp work / daily jobs / relay | 不增加营地 workClock，不产生本地 work.completed、材料、药草、修复/研究或中继工时；不做守门巡检 | 据点有此人占用，按既有 upkeep 结算。远端新工作收益尚无实现，不伪造完成脉冲 |
| render / hit-test / collision | 不画营地 actor、血条或占位，不供 getNpc/nearby/mapClick/interactionTargetAt/自动交互和营地落点校验选择 | 完整人员名册保留“驻守于某据点”只读条目；据点面板可列现有守军。保留旧 x/y 不作为在场依据 |
| 本地日间战斗与感知 | 不提供营地伤害、不当营地敌人的新目标，不收营地共享警报；实际伤害入口复核 location | 71657 既有边界保留；合法历史联系人/坐标不是当前在场证明，不抹历史回执 |
| 夜战 | 不进新的 activeSupports/supportIds、守卫/巡逻/掩护人数及被动加成；旧 support 字段不得绕过地点 Gate。`activeCampSupportCount` 等减压/防线计数同样只取 campLocal | 原已结算战报和真实历史伤亡不改写；旧档 supportIds 与驻守冲突时，未来执行/治疗按现资格过滤，不制造回援 |
| 现场交互 / 调度 | near NPC、对话触发职责、setNpcOrder、招援、近身晋升/治疗和受限任务入口均由 reducer 复核 campLocal；驻守者不能先接受 order 再被置 supportRequested=true 进入夜战或减压计数 | 可以只读查看该 NPC 的已有资料；没有公开召回/远程命令就不显示可执行按钮；不能仅修 renderer |
| assignJob / content effect | `assignJob` 的真实 effect 入口拒绝驻守者承接任何营地 contentJob（包括把 guard 写成 carpenter）；核心任务与据点驻守互斥，不能只在 capture 时单向检查 | 现有据点占用继续，不先清 marker 再偷派本地任务。拒绝整笔效果事务保持原状态与成本，不发布成功工作/支援收据 |
| 晚餐、分餐、短会、训练 | 不获得饥饿/压力/SAN/羁绊/记忆等现场群体福利；不记“参加营地晚餐/目睹”等不在场经历 | 共享个人配给和全局粮荒单独保留，不能把所有食物路径一刀切关闭 |
| 现场医生/分诊/战后救治 | 不把驻守者列营地医务室、triage 或夜战的治疗对象；远端医生不提供营地服务 | 已有伤势保存，不自动治疗/补药；未来远端医疗需来源、成本与权限合同 |
| 每日厨师/后勤福利 | 营地厨师缓压、后勤的现场减饥饿和类似局部受益名单只取 campLocal；能力提供者也须 local/现有岗位有效 | 已有阵营级资源/仪表效果按其定义处理，不凭角色缺席取消真实历史产出 |
| 本地 NPC story / dynamic event | 驻守需求不得新生成“人在营地等你分诊/谈话/训练”的事项；旧队列的现场选择结算前重核在场，不隔空完成 | cooldown 继续，原 event/instance 身份与历史保留；延期/拒绝按现有协议明确处理，不偷换 NPC 或套用未授权 fallback |
| 死亡与见证 | 营地死亡的现场“目睹”情绪/记忆不广播给远端守军；本地敌人不能击中其保留坐标 | 同 roster 的真实死亡与关系仍保留。没有消息来源时，不虚构守军已知噩耗或远程安慰 |

`campWorkPulse` 的历史和单调 workPulseSeq 不清零；派驻期间不累计可兑付的 camp 工作分钟，回营不补离营期间的漏发收益。允许保留派驻前不足一周期的原残值，但不得在驻守支路继续把它增加成批量返还。远端工作状态是职责登记，不是新生产成功证据。

## 6. 计划会：本地资格与历史承诺分开

驻守者不是已实现的远程参会者。新投票名单及后续资格判断要求 campLocal，再应用既有英雄/晋升/生命状态权重；不因人物仍在 roster 或 promotedTier 为 hero 就隔空投票。计划提案文本、执行岗位与候选收益也不能声称驻守者正在营地工作。

对已存在的 planMeeting：

- 未提交的当日候选若因派驻/释放而资格变化，以现有确定性排序重新计算本地有效投票与候选，并记录原因/原实例；不新发 CP，不借此重置玩家已经用过的干预机会。
- 已提交/已执行的票据、选择和 CP 支付是历史，不重写成“当时没有投过”，不自动退点或补奖。尚未执行的具体劳动仍须在执行时核当下岗位/在场资格；不满足按已有确定性失败/降级合同留账，不能召回驻守者完成。
- 当前核心英雄默认不允许派驻的 Gate 保持；该规则仍要覆盖晋升后的普通守卫以及旧合法存档，不以“当前常见角色不投票”跳过 consumer。

此处只解决驻守地点；07设计文件既有重伤投票措辞差异不是本轮新选择，保留当前 runtime 的受伤权重边界并单列后续设计问题。

## 7. 派驻、释放、旧档与来源优先级

1. **派驻事务：** 现有 outpost effect 在统一 CommandBus/reducer 中支付与写 guardNpcIds/marker；同一事务退出本地支持/命令/执行目标及局部交互锁，不改人口身份、不重置需求/HP、不补发工作。派后人口 Gate 先于支付。
2. **运行时权威：** 已正常归一化的 outpost record 是占用来源，marker 是反向索引。UI、AI、战斗与工作从同一 presence 投影读资格；不能各自仅看旧坐标或 supportRequested。
3. **释放活人：** 沿现有 release 路径解除同一占用并留真实原因；本轮不新增旅行时长。恢复营地资格时重新建立安全本地位置/日程（优先原有效位置，否则既有确定性合法 fallback），不得落在新建实体内；旧支持命令不自动恢复，重新感知、互动后才能再次援战。它只是现有抽象转移，不宣称完成了护送。
4. **死亡释放：** 先保留真实死亡、伤势与记录，再解除占用；死者不会因 marker 删除被 campLocal 复活。据点无有效守军仍 vacant；不增替补。
5. **加载：** 保留完整 roster、资源、需求、工作历史、plan历史、日配给/upkeep 水位与原 outpost records；沿既有 normalize 清理非法引用、重建一对一索引。保存缺 marker 但有合法记录者仍远端；孤立 marker 不压过权威记录；旧坐标不迁移成当前位置证据。
6. **不追溯补偿：** 不扣回无法证明来源的旧营地收益、不补发假驻守工资、不恢复过去需求、不补造配送/旅行/旧投票。新规则只影响之后实际输入与模拟。若需要新保存字段，另给显式可选默认和原 writer 夹具，不偷偷提升 SAVE/CONTENT 版本。

## 8. 六视角最终合同

| 视角 | 因果承诺与验收事实 |
| --- | --- |
| 玩家 | 派驻确实少一个本地帮手；地图不再出现假在场，角色卡仍可查，现场命令拒绝有地点原因。共享配给和据点维护分别可查；不许用隐形守军抵伤/产粮/刷关系。 |
| NPC | 同一身份、健康、需求与关系继续；有驻守职责且仍吃饭休整，不被冻结成人口占位符；不隔空享受晚餐、治疗、训练或目睹事件，也不被本地敌人误伤。 |
| 营地 | campLocal/workEligible 真实减少，岗位、产出、群体福利、援防和投票按本地资格结算；阵营 population/口粮仍包含守军，不以删人节省成本。 |
| 势力/据点 | 据点由现有人口占用，upkeep、strained/vacant 和 factionId 保留；未接入的交易、远端生产与补给线效果不写成已实现。 |
| 敌人 | 营地敌人的目标与伤害依真实在场；守军不会幽灵攻击或当肉盾。远端没有敌人模拟时，不虚构据点保卫/追击/救援；历史感知不等于当前可攻击。 |
| 全局链 | 占用/释放、需求支付、维护、死亡、计划与保存可以关联到同一 NPC/outpost/日历；幂等、人口守恒和旧档事实保持，单纯离营不变成新 population 或完成剧情。 |

## 9. 实施与验证出口

实施优先在现有纯 presence helper 与 consumer 分支收敛，复用现有 needs/CommandBus/reducer/save，不引入引擎、LLM、运输或新远端战斗系统。远端最低需求支路与本地排除必须同轮交付；只隐藏 sprite 或只停战斗不能关闭本问题。

测试必须执行真实源码函数与实际 renderer，至少包括：

- 真实 capture/规范化双向占用，living不变、campLocal减少、marker/record一一对应；低人口/槽位/核心岗位拒绝无支付；重复命令无二次收益。
- 构造只剩一名 campLocal 的真实派驻前状态，公开捕获与直接统一 capture effect 均拒绝；living仍≥3也不能绕过。本地支持反例执行真实 `setNpcOrder` 后不得把驻守者变为 supportRequested，`activeCampSupportCount`、新 night supportIds、防线/压力收益均不包含他；保留原生命、需求和占用。
- 对驻守 guard 执行真实 `assignJob` effect 为 carpenter 等营地岗位，必须拒绝且 effect 事务无部分支付/写入；反向先有 contentJob 再 capture 也拒绝，形成双向互斥，而非靠日志/renderer掩盖。
- 驻守者被排出本地 motion、getNpc/hit-test、context、camp work/日常收益、relay、晚餐/训练/分餐/短会、医疗、夜战支持与投票；直接调用受限 reducer 也拒绝，不能靠 disabled 过关。
- 同一段真实时间远端 hunger/fatigue/energy/SAN 等按声明变化、needClock 与共享个人口粮有真实支付；无粮不负数，不发生虚构进餐；全局配给仍按living，upkeep另扣且日内一次，缺粮 strained/压力沿原规则。
- 现场福利不改变远端人物相应个体字段/记忆；全局 morale/粮荒等允许的间接效果单独核对，不能用“所有字段不变”掩盖需求应继续。
- 驻守期间无 camp 工作分钟积攒，释放后从合法本地点恢复，原需求/历史/伤势保留；死亡释放不复活，不凭空补人。
- 普通守卫晋升后的驻守投票排除；未提交候选更新与已提交历史/已花CP保持；夜战旧 supportId 残留不能产生未来支援。
- 完整旧 writer 含合法驻守记录、缺 marker、孤立 marker、重复/死亡守军、旧计划和保留坐标，实际 loader 后身份/人口/资源及水位一致；保存/刷新不重复扣口粮或upkeep，不补离营工作。
- 运行 night/content/outpost/attention/计划/保存/replay 关联回归，区分旧 unaffected golden 与本轮应变轨迹；浏览器公开捕获/地图与名册/现场拒绝/跨日/刷新仍须另验。

上表是合同清单；本次41项source与37项真实浏览器的具体覆盖见QA，29项作战检查仍只涵盖原范围。真实生产/自然三日没有因本文而增加证据。

## 10. 来源与回滚

本设计来源是当前71657作战候选与上述L0/据点卡，不用历史51f或旧IMSAVER覆盖。实现应先留存71657原字节、完整旧 writer 和原失败/旧测试报告；新候选记录独立源码与runner/报告SHA。原51f的29检查反例仍是旧构建证据，不能改写。

回滚源码时整体撤回同一轮 presence consumer/远端需求变更，不能只回 renderer 或只回 needs 分支留下混合语义。71657仍有本问题的非作战缺口，回到它必须明确标 open，不能称已完整修复。存档不删除 outpost/marker/人口/需求事实、不按旧规则重算历史支付；必要时保留原档并停在可恢复状态，待兼容修复后继续，不能为测试通过重置世界。任何新 schema 字段必须有向旧 reader 安全降级方案后才发布。

本文状态允许开发继续，不需要新的人为审批；通过与否以实际候选的测试/浏览器/保存证据决定。没有新增全局记忆。
