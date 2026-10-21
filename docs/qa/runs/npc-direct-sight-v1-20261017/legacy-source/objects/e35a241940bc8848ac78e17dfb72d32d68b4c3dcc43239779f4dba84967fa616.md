# 固定十人个人链与英雄价值（npc-full-roster-002）

**状态：proposed；剧本设计输入，未注册、未实现、未验收。**  
**范围：** 完整v82的十人个人链、真实晋升、英雄消费者、死亡/缺席/拒绝与最低岗位替代。恢复门禁通过后按小批实现；不改变正在验收的构建。  
**源码观察：** 2026-10-14，开发HTML SHA256 `412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8`，SAVE21 / CONTENT3。这是源码审查基线，不是Sites发布版本或本卡完成证明。  
**定义包建议：** `npc-personal-pack-002`，definition/contentVersion 2（拟议）；保存/schema版本是否改变由架构裁定，不能直接沿用旧hash声称行为相同。

规则源：[05势力与敌人](../../剧本/尸潮农场/05_势力营地与敌人多视角.md)、[06固定十人与晋升](../../剧本/尸潮农场/06_NPC英雄晋升与普通NPC体系.md)、[07权限与计划会](../../剧本/尸潮农场/07_计划会与commandPoints.md)；时间窗遵循[02十四天](../../剧本/尸潮农场/02_14天时间线与最终尸潮.md)，主线边界遵循[03](../../剧本/尸潮农场/03_主线事件链总图.md)。参考[14模板](../../剧本/尸潮农场/14_NPC剧情模板.md)、[npc-promotion-001](npc-promotion-001.md)、[plan-voter-projection-001](plan-voter-projection-001.md)与项目content Skill。旧卡的“validated”只证明其当时竖切片范围，不能代替本卡十人完整出口。

## 玩家承诺与不变量

农场里的十个人先有岗位、疲劳、顾虑与关系，再决定是否把权力交给自称救星的陌生人。个人链继续服务采集、农务、修墙、守夜和营地自治；不是靠十轮对白把全员一次升级。保守选择可以完成一条负责任的故事，冒险必须有可见代价；跳过不会卡死中继或最终尸潮。

- 只使用林岑、阿默、苏禾、阿梁、贺川、周岚、唐婶、纪宁、陈野、蒋锋的现有ID。家属线索、外部势力来信与失踪去向可出现于记录，不能新增农场人口、复活死者或把继任者改成死者ID。
- day14为主基准，day12–16是最终窗口。个人成就不改锁定尸潮日期、不直接给结局、不伪造中继上线或据点占领。
- `hero`是确认身份，`actingRole`是岗位，presence/refusal是可用性；三者不能互相代替。普通人与eligible仍可表达岗位建议，不凭主持、满进度或技能名获得正式英雄票。
- 玩家初始campTrust/CP均为0；个人affinity不等于campTrust，英雄身份不等于玩家可调度。剧情奖励不刷新同日已花CP。
- 核心有效、livingRoster≥3、campCollapse<90的营地生存规则不变。critical计生存、不计可工作；据点守军仍属原人口，不能同时承担核心岗位。
- 所有个人Choice走原EventDef/EventInstance/Chain/Effect/Gate与CommandBus。没有第二个剧情时钟、选民名单、隐含角色状态或奖励回调系统。

## 当前实际接线与缺口

以下来自只读注册表抽取及函数审查，没有运行浏览器或给GameState写入设计事实。实际NPC_EVENT_CHAINS覆盖十人共17个短节点；NPC_STORY_DEFS只有四人。

| 现有NPC / 初始身份 | 已接线的个人事件与岗位价值 | 晋升/技能实际边界 | 本卡需要补齐 |
| --- | --- | --- | --- |
| 林岑 commander / hero-promoted | command-trust两节点；短会15分钟、需求/士气、与贺川的压力分歧；真实指挥岗位参与夜战协调、晨间士气、relayCore交接 | STORY有注册；sector-command/command-radius是保存/展示ID；没有该命名主动技能的使用/冷却入口 | 旧授权秘密与章程证据、实际职责分派/拒绝、sector-command消费者、死亡主持与权限退路 |
| 阿默 radio / hero-promoted | signal-static两节点；零件换蓝图收藏进度、短餐/社交；真实中继工序、预警与夜战数量/路线消费者 | STORY有注册；signal-triangulation/early-warning名称存在；不等于45s主动标记已实现 | 区分信号可信与放大风险、调谐证据、人工哨报退路、可观察技能代价 |
| 苏禾 doctor / hero-promoted | triage-load两节点；1药草治疗现存低HP伤员10HP、休息/轮班需求；已有角色救治与夜战伤害/恢复逻辑 | STORY有注册；triage-burst/medical-triage名称存在；不等于L0的“两人12HP、1药草、30s技能” | 确认真实分诊/帮手劳动、药品归属、缺岗效率与主动技能消费者 |
| 阿梁 carpenter / ordinary-locked | wall-duty两节点；木材消耗、需求/关系/士气；角色修墙入口、木墙夜战加成、晨间木材；STORY有注册 | 唯一实际ordinary晋升track；当前公式用affinity/25、链step比例和trust分值；晋升扣1CP、写hero/npcRoster、commandSkill/production各+8 | 一次性修墙实证、affinity80与当前状态复核、维修小队消费者、L0纪宁替代与当前优先表对账 |
| 贺川 sergeant / ordinary-locked | guard-training两节点；20分钟需求训练及与蒋锋争执；兵营30分钟训练、夜战协调、现有继任长官路径 | 无STORY晋升track；drill-sergeant/guard-discipline仅ID；当前旧投票无条件给士官2票 | 完整晋升、训练工时/守卫占用、独立英雄价值；普通代主持不能凭空英雄化 |
| 周岚 quartermaster / ordinary-locked | ration-ledger两节点；盘点10分钟/关系，整理仓库直接food+1；岗位脉冲、晨间需求改善、中继筹料 | 无STORY晋升track；ration-ledger/inventory-priority仅ID；“帮手”未形成真实工时占用 | 实际库存来源、NPC餐量/配给账、帮手约束、贸易意向与后勤消费者 |
| 唐婶 cook / ordinary-locked | fire-garden两节点；木材/短餐、需求、garden.growth加一；真实菜畦、晚餐、晨间士气/压力 | 无STORY晋升track；fireline/camp-morale仅ID；直接growth变化不等于成功收获或供水生产 | 农务实证、火与粮取舍、守水车实际劳动、缺岗配给与能力消费者 |
| 纪宁 guardJi / ordinary-locked | gate-watch一节点；零件换安全需求改善或坚守压力；实际守卫/门岗与驻守人口 | 无STORY晋升track；gate-oath/steady-gate仅ID；旧守夜灯文本不等于创建lamp | 旧誓言、同伴/灯具实证、有限门岗承诺、纪宁代修墙需有真正技能/占岗条件 |
| 陈野 guardChen / ordinary-locked | gate-watch一节点；自身疲劳下降、另一守卫疲劳上升；实际守卫、撤退性格、与纪宁/蒋锋关系 | 无STORY晋升track；safe-withdrawal/withdrawal-cover仅ID；换岗文本没有固定替班任务事实 | 撤退不是背叛的取舍、接班者确认、低风险补给与撤退保护消费者 |
| 蒋锋 guardJiang / ordinary-locked | gate-watch一节点；追击直接parts+1并提高eventThreat；冲动性格、巡逻/撤退压力和贺川冲突 | 无STORY晋升track；overreach/assault-window仅ID；目前零件来源/短暂离岗没有完整任务状态 | 有目标/带回来源的追击、门岗空档、克制路线也可晋升、死亡/拒绝后最低防线 |

通用已接线不应漏记：初始三英雄由createNpcState/normalizeNpc提供静态身份，不是新晋升；npcRoleEfficiency读取promoted的通用0.06系数、属性和actingRole培训折减。夜战与晨间已有按岗位/支援/bond消费的价值。这些都不能证明十个命名activeSkill/passiveSkill已有各自消费者，NPC_STORY_DEFS.campEffects也未自动变成产出。

源码位置：模板/故事1654、技能ID1723–1724、createNpcState1820、evaluateNpcPromotion2041、promoteNpcHero2060、planNpcVoteWeight2214、Effect/Gate2493/2536/2563、serializeNpc2874、npcIsActive3364、npcRoleEfficiency3522、triggerNpcEvent3596、resolveNpcEvent3647、markNpcDead6037、npcFulfillsRole/assignMorningSuccessors6495。行号只对应以上412c字节。

### 必须正视的机制缺口

1. 旧链到末端后triggerNpcEvent会把step重置为0；resolved仅保留8项，定义ID又按chainId共用。不能把某时step==length或一段截断日志当永久个人链完成事实。三名守卫共用npc.gate-watch还可能共用首次注册文本/actors；新链各人独立稳定ID。
2. 阿梁eligible可能在后续progress下降时仍保留；promoteNpcHero没有健康/驻守/当前全部条件的硬复核，不能由一个stale eligible授权。其余六普通人缺STORY不是有技能ID就能晋升。
3. 旧事件中的“修补裂缝”主要改木材/needs/士气，没有实际building.hp修复；“授权转岗/轮班/帮手”多是需求或文本；蒋锋的parts+1也没有追击拾取来源。本卡要求行动实证，不能给旧文本补造完成回执。
4. npcIsActive目前仅排dead，无法表达missing/left；resolveNpcEvent已能取消死者待办、activateQueuedNpcEvent能跳过死者队列，但这不等于完整缺席系统。critical仍可能被当活动角色。
5. npcHasRole使用id或actingRole，npcFulfillsRole使用actingRole或id的排他投影。暂代者可能仍被其它消费者当原岗。assignJob只写contentJob，不会自动接入真正岗位、晨间产出或夜战，不能用它作为第二套岗位真相。
6. contentConditionMet未知type当前返回true，字符串requirements只有四个*_alive特例，没有十人可用/健康/拒绝/目标实证的完整Gate。新定义不得把尚未支持的条件写进去并期待自然生效。
7. 现crop.changed可能只有{}、公开crop.change的buildingId可能null；resource.collected.delta可能含推进期间NPC消耗。不能凭事件类型或正净差就认定唐婶完成了某块菜畦、周岚回收了某份口粮。
8. evaluateNpcPromotion直接读取NPC_STORY_DEFS，而不是contentDefinition；仅在extension注册六个npcStory并不会自动产生晋升track。当前四个base STORY也没有新注册校验要求的voteProfile。需补完整定义和统一查询；已存在ID不能再次register强行覆盖。
9. promoteNpcHero目前由context直接调用，没有自己的统一CommandBus命令；npc.promotion.completed有记录不等于可用原commandId回放整个晋升事务。v2要用同一bus的npc.promote命令/原子reducer，不为旧晋升倒填虚构commandId。

## 先裁定、后实现的proposed事项

本节不修改L0，也不沿用旧实现数字作为新规则。

| 项 | 明确提案与冲突边界 |
| --- | --- |
| P1 晋升阈值 | 以07精确定义的个人链成功、affinity≥80、campTrust≥60和岗位条件为规则；25/50是阶段而非最终门槛。保留一次1CP确认形式。替换当前affinity25/部分trust40是政策变更，不能偷放进投票修复或用旧hash验收。 |
| P2 健康/权限 | 拟晋升要求DAY、现有本人在场可工作、healthy、未驻守/未被互斥岗位占用，当前所有条件及CP≥1实时复核；injured可恢复故事，critical暂停工作。英雄技能的injured折减与会议伤病票权采用共享裁定，不自行扩大D4或悄改L0。 |
| P3 最低继任 | L0阿梁→纪宁、医生→周岚与当前priority表不同；林岑→贺川一致。建议按L0优先名单、健康/技能/现岗位占用筛选，原岗vacancy保留，每人只能一处有效岗位。具体效率与是否允许低技能应急须裁定；不可一段对白同时占两岗。 |
| P4 属性/被动 | L0 06与当前熟练属性是0–100，14模板有0–10表述；先统一单位再展示。当前晋升+8属性、通用6%效率及STORY.campEffects的10–15%不能自动叠加成已生效被动；逐个消费者声明同类增益上限/代价后批准。 |
| P5 关系可达性 | affinity80不能靠按钮刷取或链完成直接置80。拟议第一版预算：对本人有真实益处的四类首次守约贡献各最多+10（共≤40），个人N1深度行动实证最多+25，N2至少隔一日的职责兑现最多+15；最高80只对实际被帮助的本人，非全员广播。N0接受任务不加好感，重复训练/采集不重复贡献；自治不加玩家守约。预算与失约扣减未冻结，须实跑校准day6–11，不可达则调提案而非降门槛。 |
| P6 能力与生态 | 三起始英雄L0的60s/SAN-3、45s/广播压力+2、30s/1药草/两人12HP保留为目标；广播压力拟对应resonancePressure，须确认语义。其它七能力的范围、增益、工时、冷却是proposed，未有命名ID就声称完成。不能让个人链直接生成尚未接线的screamer/聚合体或决定结局。 |
| P7 参与与会议 | 与plan-voter-projection-001共用hero身份、presence/refusal和角色可用性ADR。采用其D1–D8仍需正式裁定；本卡不另定指挥官/军士票权，不重算legacy会议、不由晋升替换已提交/已执行选择或返CP。 |
| P8 时窗与旧链 | 新个人链正式工作窗day6–11，起始英雄/旧需求事件可在day1–5埋线；缺前置主线时提供事实记录，不假完成。day12–14只结清/最低岗位退路，day15–16随已有最终窗口保留后果；不补发错过的晋升/收益。旧pending实例按原定义处理，新pack不能与旧短链双发同一议题。 |

## 一个系统的映射与状态合同

### 生命周期与身份

每名NPC一个新稳定chainId，N0“需求/矛盾”→N1“可验证岗位行动”→N2“责任确认/结果”；成功、保守成功、失败、缺席、过期、跳过均有明确终点。起始三英雄走能力/调度条件确认，不走第二次晋升。七普通人的故事成功只形成资格事实；eligible不发技能或票，真实npc.hero promoted才是身份真相。

定义在NPC_STORY_DEFS登记storyArcs与voteProfile；事件在EVENT_CHAIN_DEFS/registerContentPack登记，并使用原EventDef/Instance和原事项UI。不得另造NPC剧情弹窗控制器或第二队列。包清单在loader前挂载；缺包保留旧状态、显示无法执行，不发奖励、不改为completed。

四个已有npcStory ID在下一冻结源码中补齐完整版本定义，另六人仍绑定原npcId；不注册同ID第二份、不改模板ID绕过duplicate Gate。晋升/展示/计划会查询同一经校验定义和真实hero。npc.promote的命令应在一个事务中复核身份/故事/可用性/关系/CP，写CP扣除、hero/属性、npcRoster辅助事实和唯一completed回执；任一步失败回滚，不通过NPC_STORY.promotedTier直接授票。

成功应写独立永久bool flag，例如`npc_carpenter_story_v2_verified`；fallback写结果原因，不写成功flag。completedChains包括fallback，不能单独用它证明晋升条件。当前有限history/appliedEffects不是长期人物真相；节点结算沿已有resolvedNodeIds/效果幂等事实，必要新增持久proof引用先补strict save/normalize/serialize合同，不靠last300回推永久去向。

参与域只在共享ADR中定义presence=present|missing|left、会议/命令/岗位拒绝的scope/reason/since/解除条件；lifeState仍描述伤亡，garrisonedOutpostId仍描述地点。返回必须是原ID与原人、合法存活，不能清dead、加人口或返已付代价。远端守军要有真实通信/工时后才可参与，初片不假设可瞬移回来。

### Gate与Effect矩阵

| 需求 | 当前可复用 | 必须补的适配/禁止的捷径 |
| --- | --- | --- |
| day窗口、资源、campTrust、已有flag | phase/day_between/camp_trust、资源比较、flag与DAY/night/terminal门控 | 节点级期限和未知条件须严格校验；未知type拒，不能当前failopen |
| 十人现场可用、患者、替班/工时、拒绝 | npc_alive可作“未dead”初筛；固定ID与实际伤势/守军字段 | 同一纯availability/role投影供内容、技能、晋升、计划会消费；不是十套UI布尔量 |
| 资源成本、个人关系、营地压力、结果 | addResource、modifyRelation、adjustMeter、unlock、recordHistory | 负资源效果会clamp；扣除前必须数量Gate，并在事务内复核，不让欠料也成功 |
| 修墙、种植/收获、采集、换防、治疗 | 已有building.repair/crop.change/resource.collect/camp.area/NPC命令 | 补action proof Gate/成功payload：原command/event/causation、目标ID、前后/实际量、节点时间。{}或no-op不通过，不额外重执行一次动作 |
| HP/SAN/needs、岗位、技能冷却 | 有既有专用reducer，但非任意ContentEffect就可执行 | 添加经批准的声明式Effect适配与完整事务范围；不写button回调/state，不拿contentJob替actingRole。clock/RNG/命令历史一起变化时须能回滚 |
| 死亡/缺席/过期/人口不足 | resolveContentFallback四种标准reason、原roleVacancies与继任 | dead/missing/left映射ifMissingNpc并记录精确原因；critical/拒绝先可见暂停，再按期限ifSkipped，不伪装死亡 |
| 英雄主动技能 | skill ID、hero、CommandBus与战斗命令路径 | 单一npc.skill.use定义/消费；玩家trust≥60只可请求英雄节点，完整调度按trust≥80或明确特权、个人条件与当前可用性。英雄自主行动不免费授予玩家控制。DAY个人Choice在夜间拒，BATTLE技能单独允许；冷却按可回放模拟时间、暂停不偷走时 |

旧NPC_EVENT_CHAINS.pending/state.eventInstance保留原instanceId/defVersion、原材料/选择和结算事实。启用v2后只新建v2议题；正在运行的旧事件结束前不重复N0。旧链曾有文本“完成”不自动产生v2修墙/收获/追击proof。已真实promoted身份保留，不因本卡提高门槛剥夺旧英雄，也不为legacy补造80affinity、新技能使用或再次属性奖励。

旧会议缺votePolicyVersion走legacy历史：保留原ballots/score/selectedId/playerAction/history/已花CP和effectId。新身份/政策只在首次后续新会议生效；死亡与明确不可执行岗位仍触发最低安全Gate。旧SAVE18只补原起始三英雄的静态默认，不回溯个人链、计划、CP或晋升事件。

## 玩家不介入时的十人自治

以下也是proposed：RulePlanner只提交已注册岗位/内容意图，由同一Gate/命令/effect确认；当前没有真实任务消费者时只排候选/记等待或fallback，不能把表中动作宣称已经自行完成。自治不能假装player-1选择，不发玩家守约关系/贡献，不代付CP晋升。

| NPC | 最低自治选择与资源来源 | 无人力/材料或期限到时 |
| --- | --- | --- |
| 林岑 | 对已有伤亡/库存作保守短会与原候选安排；先核心后冒险 | 保留求助/临时协调，授权待核；不改已committed会议 |
| 阿默 | 在原真实监听岗位检查旧记录，已有中继才消费中继预警 | 不够工时/零件转人工记录或unknown-forecast，不假中继上线 |
| 苏禾 | 对真实伤员按低HP/稳定ID排序，药草有余才申请合法治疗 | 药不足休息，不能无成本治病；本人重伤交最低分药候选 |
| 阿梁 | 对实际受损墙提出材料可负担的维修任务，留工坊最低库存 | 缺料标记破口/守核心；没有执行命令就没有repair-proof |
| 贺川 | 现有守卫有合格替班后组织有限换防，保留门岗 | 无守卫/驻守冲突只排等待，不能发训练成功或补兵 |
| 周岚 | 将日界配给、真实NPC取餐和收获分账，申请原人审计工时 | 对不上记差额待查，0自动回收食物、0未经证明惩罚 |
| 唐婶 | 依据原garden生长/种子与木材先保火/留种，再申请农务任务 | 不成熟等待；无人可工作只配给准备，不加growth/food冒称收获 |
| 纪宁 | 有灯和同伴则守已分配门，缺同伴请求换班/守核心 | 不承诺无人看守门；无灯不生成实体，保留岗位缺口 |
| 陈野 | 疲劳高先申请合法替班/低风险任务，保护已有后勤人员 | 无替班等待或记录特定撤退，不能把他自动写成失踪/叛徒 |
| 蒋锋 | 无替班默认留守；有真实目标/路线才申请有期限追击 | 目标消失/资源不明则撤回，0parts奖励，不生成诱饵敌人 |

夜战死亡的角色资格/守军释放立即按原生命事实失效；个人链DAY fallback在下一个合法时点结清，不能夜间执行白天Choice。死亡对SAN/关系/黑土压力的全局后果由唯一生命变更因果结算，个人链只引用，不重复收一份死亡惩罚或制造尸群。

## 七名普通人晋升后的最小能力提案

以下是P6的首版参数草案，**不是当前能力，也未冻结平衡**；门槛仍是实际hero/promoted、个人条件、对应岗位可用、玩家有相应请求/调度权限。主动能力注册为原EventDef的命名npc.skill.use定义，不新增事件系统。DAY工时采用游戏分钟，BATTLE冷却采用实际推进的战斗模拟秒；目标消失/死亡/不满足条件时不消耗、不开始冷却。故事成功本身不会施放技能。

| 人物 / 当前已存在的技能ID | 拟议最小主动消费者、代价与边界 | 被动槽的第一版实现边界 |
| --- | --- | --- |
| 阿梁 repair-squad / construction-crew | DAY，本人+一名合格现帮手对同一受损wall维修，木材2、20分钟、本人疲劳+8；修复最多2HP且不越建筑上限；120游戏分钟冷却。没有帮手可走普通修墙，不冒称小队 | 把已存在的hero效率6%绑定真实建造/维修消费者一次；不再叠加STORY未消费的10% |
| 贺川 drill-sergeant / guard-discipline | DAY，两名现可训练守卫，20分钟、各疲劳+6、本人SAN-2；参与者morale+4/stress-4；180游戏分钟冷却。门岗/驻守不可同时参加，不重复兵营基础训练的同一回执 | 同一6%效率用于合法守卫指令消费者，不能凭被动增加守卫人数或新的门岗 |
| 周岚 ration-ledger / inventory-priority | DAY，10分钟、疲劳+4，每日一次；只调整下一合法配给任务的现存库存优先级，不能改变food总量/重复扣当日配给；无消费者时明确待开发 | 6%物流效率作用于真实审计/配送工时；不减少当前不存在的损耗系统、不凭空+food |
| 唐婶 fireline / camp-morale | DAY，food1、10分钟、本人疲劳+4；三名现存对象hunger-10/stress-4，180游戏分钟冷却；无粮拒。需按需求/稳定ID选人，不能与同一短餐再次结算 | 6%农务/配给任务效率；士气收益要来自真实短餐/劳动，不能被动每tick无限加士气 |
| 纪宁 gate-oath / steady-gate | BATTLE，本人与一个近邻现同伴的同门8秒内撤退压力增长减少25%，本人SAN-3，45秒冷却；HP0仍正常死亡、逃生安全Gate不被锁死 | 6%效率作用于自己实际门岗，不能一人给两门或所有据点全局加防线 |
| 陈野 safe-withdrawal / withdrawal-cover | BATTLE，掩护一个真实撤退同伴6秒、受击损伤降低15%，本人SAN-3/疲劳+8，60秒冷却；只在真实有效距离内，不能瞬移、复活或改写已结算伤亡 | 6%效率作用于合法掩护/撤退任务，不从全局伤亡统计里减去不存在的“被救人” |
| 蒋锋 overreach / assault-window | BATTLE，对真实可达目标的下一次突击伤害+15%，本人SAN-4/疲劳+8，之后6秒自身受击损伤+15%，50秒冷却；无补岗/有效目标拒。掉落仍来自原资源命令 | 6%效率作用于原突击岗位，不另加持续全局伤害；拒绝冒险可正常保留英雄身份 |

6%是已有通用hero效率的候选命名绑定，不是七份新增全局增益；逐项检查真正受益动作及clamp后的实际量。若某岗位没有对应效率消费者，不能只显示技能名就标被动完成。三起始英雄另按L0既定三能力实现，不用本表替换；P4/P6全部消费者需具体事件、资源/状态前后值、冷却来源和重复调用/保存证据。

关系预算也只能由真实贡献成功归因：把木料交给阿梁不自动提升医生等十人，普通NPC日常工作不能算玩家恩情；资源不足、本人死亡或未执行任务不算失约。迟到day11的N1无法兑现“至少隔一日且窗口内”的N2时，UI提前提示只留下准备结果/过期收束，不偷偷延长晋升窗。

## 十条最小完整个人链

以下节点、收益与分支均proposed。D表示现有数据Effect可承载，A表示既有公开行动需真实proof Gate，X表示尚需共享适配/裁定。N1没有proof时留在等待，给缺料/目标失效/缺岗原因和保守出口，不能强迫玩家造一次成功。关系/技能数值按P1–P6裁定；“验证”不是自动置affinity。

### 1. 林岑：有责任的授权 — npc-command-trust-002

埋线day2–3，主节点day6–10。秘密是旧实验授权，不以新反派取代黑土生态；他担心救星获得战术胜利却毁掉自治合法性。

| 节点 | 玩家/自治/冒险选择与真实结果 |
| --- | --- |
| N0 open-ledger | 公布授权记录摘要，或先做有限岗位承诺；不假称camp-charter已完成。自治先保核心与配给，保留“授权待核”的记录(D)。 |
| N1 prove-mandate | 用已有修墙/安全补给任务的一次成功command证明守约(A)；冒险以实际夜战结果换临时责任，需要本人及岗位健康/可用、伤亡代价可见(X)。同一成果不被章程/个人链双发奖励。 |
| N2 bounded-command | 成功写“个人调度条件已核”；仍按玩家trust权限与林岑当前状态请求sector-command。保守完成可保留英雄身份但不开高风险调度。未守约记录拒绝该请求及解除条件，不剥夺全部营地意见。 |

六视角：玩家知道授权范围；林岑承认实验欠账但保留自治；营地有真实交付/岗位来源；redline/riverfolk只得到明确合作意向记录，未实现贸易不发关系值；敌人利用指挥空档而非“随机报复”；全局只为camp-charter/horde提供已核条件，绝不伪造主线完成。

死亡由原贺川健康/在场临时代主持，保留原hero身份与有效岗位；两者缺席只开求助和临时防线，不发英雄调度权。重伤暂停指挥技能；拒绝只限授权范围；过期/跳过写manual-coordination，不加CP、不新增指挥官。

### 2. 阿默：听见人声再放大信号 — npc-signal-static-002

埋线day2–5，个人收束day6–9；relay day2–7的真实工序继续独立运行。

| 节点 | 玩家/自治/冒险选择与真实结果 |
| --- | --- |
| N0 inspect-static | 保守检查记录/短餐，或花已有零件调谐；材料Gate+实际关系/信号记录(D/A)，不是直接免费解锁科技。自治保留旧频道并提出人工哨报。 |
| N1 validate-bearing | 对已存在的中继/岗亭记录做交叉验证(A/X)；缺relay证据可完成“人工方位判断”分支，不能写stationOnline。冒险利用黑土信号必须明确广播压力及SAN风险。 |
| N2 choose-amplification | 保守能力提供受限预警；冒险可启用signal-triangulation消费者，但遵守45s/压力代价及实际路由目标(X)。短餐是关系线，不能抵消广播风险或直接取得全知地图。 |

六视角：玩家看到方位可信度；阿默需要同伴而非无限监听；营地付零件、监听工时；猎队路线信息必须有来源，河湾信息不是免费贸易；黑土通过无线电共鸣增密；全局只消费真正relay状态/人工预警结果，个人成功不改变锁定终局日期。

死亡/失踪转signal-blind并建议现岗亭人工哨报；缺已建岗亭只记录unknown-forecast。现周岚可承担低效率人工监听但占其后勤工时；不继承阿默技能/身份。critical暂停，拒绝某频道不撤全部投票；窗口结束无预警奖励，主线仍按默认路线继续。

### 3. 苏禾：药属于谁 — npc-triage-load-002

埋线day1–5，正式day6–10；不为制造故事给NPC凭空加伤。

| 节点 | 玩家/自治/冒险选择与真实结果 |
| --- | --- |
| N0 assess-patients | 有真实伤员时按lifeState/HP/稳定ID列候选，无伤员走医疗准备分支。保守休息，冒险集中药草救治；药草与患者Gate明确(A/X)。 |
| N1 prove-triage | 实际药草来源/合法救治与轮班证明(A/X)，同时绑定现有帮手和原岗位工时；不重复既有夜战医生治疗。没有患者可完成药草账/轮班准备，不能伪造HP增量。 |
| N2 preserve-capacity | 验证triage-burst的两现存可治疗目标、每人12HP、1药草、30s冷却(X)；零/一伤员的消费与空用规则先裁定，不随机造第二患者。保守准备完成不承诺已经施放技能。 |

六视角：玩家看实际患者与药草消耗；苏禾有分诊伦理/疲劳；营地不能治疗死者、不能多人同时占药；河湾医疗互助仅在真实交易后贡献物资；敌人可追伤员但不自动制造伤亡；全局提高医疗准备而不是免费抹除夜战已结算损失。

死亡/缺席按L0优先周岚分药，效率/技能不足时只休息和止损；该优先表与现实现不同，待P3采用后启用。critical不能救别人；拒绝冒险试药仅挡该路线。跳过保留库存/真实伤势，未用药不扣药，不记录triage技能已完成。

### 4. 阿梁：修好的墙要有人负责 — npc-wall-duty-002

day6–11；早期旧裂缝事件只作线索，寻找家属可引用missing-family设计预留，不能靠未注册支线卡住修墙。

| 节点 | 玩家/自治/冒险选择与真实结果 |
| --- | --- |
| N0 mark-defect | 绑定现有可维修wall ID/实际HP；没有受损墙走工具/库存准备，不编裂缝。保守先备料，冒险在外围维修需暴露/时间代价。 |
| N1 repair-proof | 玩家实际building.repair成功，核目标HP、木材、体力/时间与唯一因果回执(A)；自治申请原岗阿梁/现有合格替代的维修任务，不能纯文本修完。 |
| N2 accountable-crew | 确认维修责任与使用木料记录(D)；ordinary链成功后满足P1/P2才eligible，再独立1CP晋升。repair-squad由真实维修目标与小队占岗消费，不能英雄标签一贴就全墙加HP(X)。 |

六视角：玩家付实际维修代价；阿梁得到稳定岗位认可；营地墙体/库存可核；猎队零件需已有交易，家属线只提供线索；破墙敌人利用维修空档；全局墙和中继工程仍读真实建筑/实际工作，不把个人成功写成中继竣工。

死亡优先纪宁基础修墙的L0路线，需真实现人健康/技能/原门岗替班并按P3裁定；无候选保留vacancy/封小缺口。重伤先休息，拒绝无账抢料只限维修请求。过期/缺料保守终结不晋升、不补材料，不影响最终尸潮可触发。

### 5. 贺川：训练要有人接班 — npc-guard-training-002

day6–11；与蒋锋的冲突来自训练/换防责任，不把“强硬”永远当坏结局。

| 节点 | 玩家/自治/冒险选择与真实结果 |
| --- | --- |
| N0 roster-rotation | 确认现有守卫的伤病/驻守/疲劳和替班；保守保门，冒险加强训练需腾出门岗。无守卫明确不训练。 |
| N1 actual-drill | 复用真实camp.area.interacted/barracks工时与参与者证明(A)，控制重复训练不能刷人物完成/affinity；蒋锋愿合作才共同巡逻，否则选单人纪律训练。 |
| N2 discipline-agreement | 两条合规训练路线都可形成责任成功(D)，随后正常晋升；drill-sergeant/guard-discipline将已有守卫的训练准备/工时转成可见效果(X)，不生成兵员或无代价驻军。 |

六视角：玩家看门岗空档与训练时间；贺川争取纪律而非无限控制；营地必须同一守卫不能训练兼驻守；redline训练情报需交换来源，未实现不领奖；快速敌人会利用换防缺口；全局给防御准备/合法驻守Gate输入，不额外重打一次尸潮。

死亡由林岑点名可用现守卫；林岑也缺席时只维持最低换防，不伪造士官英雄票。普通贺川可代主持但不复制林岑技能/额外票。critical/驻守暂停；拒绝某训练强度不永久清空会议意见。失败/过期训练准备不增加。

### 6. 周岚：账本里不能少一个人 — npc-ration-ledger-002

day6–11；账本先解释营地自治吃掉的口粮，再谈私藏，避免把正常NPC取餐写成偷窃。

| 节点 | 玩家/自治/冒险选择与真实结果 |
| --- | --- |
| N0 reconcile-ration | 展示真实配给日、NPC餐量、菜畦/采集来源；公开盘点，或保守内部核对。未知差额记录待查，不给任何人捏造罪证。 |
| N1 recover-logistics | 实际采集/已收获口粮、库存审计与真实帮手工时(A/X)。保守防潮/保持战备，冒险交付稀缺物资换外部路线；food+1必须有存量回收来源而非按钮免费生成。 |
| N2 accountable-priority | 核清来源且没有双扣配给后写责任成功(D)，晋升仍按P1/P2；ration-ledger主动调整真实已有库存优先级，inventory-priority被动有真实浪费/供给消费者才显示可用(X)。 |

六视角：玩家看见每份物资归因；周岚获得账目可信而非全知；营地消费/占岗不会被刷新回滚；河湾/猎队交易有实际交付，不冒造盟友人口；敌人切断补给令欠账扩大；全局水车/中继材料仍只扣各自一次，个人验收不重领奖。

死亡由唐婶临时配给，原农务工时被占；两者缺席按真实库存最低发放、保留短缺。拒绝无账交易只限制该交易；失踪不让账本变成免费食物。缺料/过期写unreconciled，不能自动扣未证明的“私藏”库存或英雄化。

### 7. 唐婶：火和种子都要留到明天 — npc-fire-garden-002

day6–11；水车day4–10的现链只是闸门选择样板，个人链不能凭watermill_t2冒称供水生产已落地。

| 节点 | 玩家/自治/冒险选择与真实结果 |
| --- | --- |
| N0 fire-or-field | 使用真实garden ID/种子/木材，保守留火与种子，冒险提前耕作付工时与疲劳。没有菜畦可先明确建造/等待，不能在空地生成作物。 |
| N1 real-harvest | 实际播种/收获证明：同一garden前后、种子/食物实际量、时间与NPC取餐分账(A)。若成熟未到可等待，不能把growth2或空crop.changed当收获。 |
| N2 share-next-meal | 有粮时真实短餐/留种取舍；无粮保守收束为配给准备，不扣负库存。成功可晋升；fireline/camp-morale兑现实际农务/短餐效用与工时，没有消费者时只展示待开发(X)。 |

六视角：玩家保留次日种子；唐婶承担自己也需要吃饭的代价；营地产出不脱离菜畦和劳动力；河湾水车合作要有供水/维护事实；黑土污染通过共鸣/农务风险而非免费烂粮；全局为水车/粮线提供条件，不改水车已有修补/拆解结果。

死亡由周岚临时分餐且占物流岗位；不会继承农业英雄技能或把所有地成熟。重伤/疲劳暂停田间工作；拒绝共享晚餐只限该行动，不剥全部票权。过期保留作物真实生长/种子/食物，不追回已收获，也不补发收成。

### 8. 纪宁：誓言不是独自站到死 — npc-gate-oath-002

day6–11；旧守夜灯与同伴意向需要转成真正门岗条件。

| 节点 | 玩家/自治/冒险选择与真实结果 |
| --- | --- |
| N0 confirm-watch | 绑定现有门/灯具/同伴可用性；保守换班，冒险单人坚守付压力与暴露。零件不能凭一句话生成灯，走已有真实建造或只留需求。 |
| N1 fulfilled-oath | 实际守卫任务/完整遭遇中的原支援ID、存活/撤退事实(A/X)；纪宁允许换班也能成功守约，不必须以无伤/零撤退为晋升条件。 |
| N2 shared-gate | 明确门岗服务承诺与替班者；晋升后gate-oath/steady-gate消费者只在本门/现有岗位可用时工作(X)，不无敌、不让一人占两据点。 |

六视角：玩家理解坚守代价；纪宁从孤独誓言转向互相照看；营地真正安排门岗而非额外人头；猎队检查站意向不等于凭空守军；快速/装甲敌人针对光线和墙口；全局守门准备可消费，若临时代修墙必须释放/替换原门岗。

死亡由贺川安排陈野或原其它可用守卫轮班；驻守不等于失踪，远端意见需通信。critical/拒绝独守暂停该门任务；缺灯不制造灯。过期/人口不足只保核心与明确未覆盖门，不补纪宁、不给过期英雄奖励。

### 9. 陈野：活着撤回来也是任务 — npc-safe-withdrawal-002

day6–11；保守生存动机应得到有责任的路线，不用强迫战死证明价值。

| 节点 | 玩家/自治/冒险选择与真实结果 |
| --- | --- |
| N0 ask-relief | 真正有可用替班者才换岗；保守调低风险后勤，冒险继续守门必须告知疲劳/撤退风险。无替班不能用needs变更假称有人接岗。 |
| N1 covered-route | 绑定已有补给路线/撤退中的现人任务与返回事实(A/X)，分别记录保护别人撤离和自身过早离岗；没有撤退需求可用安全补给守约完成，不强造伤员。 |
| N2 responsible-return | 守约的保守或冒险路线都可完成，晋升后safe-withdrawal/withdrawal-cover减少特定撤退损失且付出掩护工时/位置风险(X)；不复活已结算死者。 |

六视角：玩家看撤退时机/对象；陈野的求生不等于背叛；营地门岗和后勤有人真正接手；河湾撤离意向必须有路线，不额外带回居民；runner威胁逼出路线取舍；全局保留撤退与伤亡真实账本，不改成未发生的胜利。

死亡由现守卫轮班，原补给效率下降；纪宁缺席时不能继续引用同伴保护。重伤/拒绝高风险出击挡特定任务，保留低风险建议。跳过/过期形成route-unprepared，不为了角色剧情自动扣人口/发撤退奖励。

### 10. 蒋锋：追击也要有人回来交账 — npc-overreach-002

day6–11；克制与有准备的追击都能承担责任，英雄不是只有冒险按钮才能获得。

| 节点 | 玩家/自治/冒险选择与真实结果 |
| --- | --- |
| N0 mark-target | 只锁真实已有敌人/探索资源目标。保守留门，冒险先申请替班与回收路线；未注册screamer只作未来生态伏笔，不生成假目标。 |
| N1 accountable-sortie | 留守通过真实门岗/守夜证明；追击通过实际目标、参与者、带回resource ID、离岗/归队与威胁成本证明(A/X)。无掉落不能恒定parts+1，资源只结算一次。 |
| N2 restraint-or-assault | 守约两路线均可正常晋升；overreach/assault-window是有期限的突击窗口，目标失效/无人补岗拒，代价包括SAN/疲劳或防线暴露(X，数值待裁定)。 |

六视角：玩家决定能否承担门岗缺口；蒋锋被要求归队而不是被抹成鲁莽标签；营地付掩护/空档；猎队零件要有真正回收或交易来源；敌人可诱敌但不无因刷奖；全局记录威胁/目标和失败，不让突击直接改变尸潮结局。

死亡保留overreach后果，贺川锁最低门岗，不能把追击失败改为掉落奖励。失踪有原ID的可验证归队/放弃路径；没有证明不补人。重伤/拒绝强制追击可走留守；过期封存目标，世界已有敌人和库存不回滚。

## 共用失败与主线退路

| 情况 | 结果与统一约束 |
| --- | --- |
| dead / missing / left | ifMissingNpc附具体原因；取消本人未执行动作/技能/有效票，释放真实岗位/守军，现人最低替代或保留vacancy。原人物历史/英雄确认不抹掉，绝不复活或补满十人。 |
| critical / injured | critical暂停工作/技能，仍计livingRoster；injured的任务能力/会议票按共同裁定。治疗真实发生后恢复原人可用，不能靠reload消伤。 |
| refusal / fear / fatigue | scope明确的暂缓/改选/解除条件；只拒该任务/会议，不一律剥夺NPC自治。期限到以ifSkipped结清，不把拒绝硬写成死亡。 |
| garrison / actingRole | 一人一有效岗位与工时，驻守仍属人口；缺现场/通信不能同时做个人任务。继任不改id/hero，不拿死者技能/投票。 |
| resources不足 / target失效 | Choice Gate与执行事务复核，0实际成本/0成功奖励；保守可等待或结束。失败命令/结果可见，不假证明修墙、采集、训练、治疗。 |
| population不足 / core无效 / collapse≥90 | ifInsufficientPopulation或终局安全Gate，只留账本/核心应急，禁止新派驻；不由支线抹掉营地崩溃条件。 |
| expiry / skip / 包缺失 | 活跃实例一次fallback，未启动议题只记未发生状态，不调用需active的fallback制造链完成。缺包不执行/不领奖；主线仍有unknown-forecast、人工记录或更昂贵现岗替代。 |

fallback不写成功flag、不自动晋升、不返CP、不发未发生技能/资源；合法保守成功与“失败终结”分别标记。旧实例的不完整统计不妨碍读取已确认身份，但不能补造新个人功绩。

## 恢复门禁之后的最小实施顺序

| 批次 | 可落地内容与必要出口 |
| --- | --- |
| 0 共用合同 | 先裁定P1–P8、共享presence/refusal/有效岗位与hero票源；十人STORY定义字段校验、unknown Gate failclosed、永久成功事实/动作proof、事务与严格旧档迁移。保留生产18/21、legacy会议/旧NPC待办，不补发收益。 |
| 1 一个真实ordinary闭环 | 阿梁+周岚：修墙/物资账分别有实际公开动作与命令证明，两种故事路线、死亡/缺料/过期；至少一名从0关系经可达路线到eligible→实际1CP晋升→下一新会议读取hero→一个实际能力消费者。不能以手设fixture替代可达性。 |
| 2 起始三英雄价值 | 林岑/阿默/苏禾个人链与明确主动技能消费者；按L0冷却/代价与目标核验，旧岗位价值保留且不重复。main relay/章程/人工预警缺前置时仍有降级，不冒称主线全接。 |
| 3 农务与训练 | 唐婶/贺川的收获/训练、帮手与门岗工时、晋升和实际消费者；必须核crop空receipt/noop、同日训练刷关系、驻守/兼岗及同日会议冻结。 |
| 4 三守卫闭环 | 纪宁/陈野/蒋锋各独立ID、保守/冒险都可守约，真实目标/撤退/归队、死亡/失踪与岗位退路；同一guard不能复制为两门/两据点参与者。 |
| 5 完整v82出口 | 十人所有分支/能力/UI/保存/回放接完才称完整v82。自然14天窗口检验关系可达性/食物/岗位工时/人口，不用兵营反复SAN和士气加成路线评价平衡。 |

一次只冻结一个构建/内容包/保存与回放政策版本，先源码、真实命令与旧档Gate，再独立browser试玩/原始存档验收。遇运行时缺陷走独立问题卡修复，不边跑同一长局边热换HTML、重标旧失败或注入成功事实。

## 待执行验收矩阵与完成定义

本节是测试要求，不是已通过结果；仅本次静态抽取证明10模板/角色、4 STORY、17旧节点、10技能名称的现状。

- 十人固定ID与初始三hero、七ordinary；定义有death/absence/fallback/已支持Gate/真实消费者。名册、技能ID和projection夹具都不能单独证明完成。
- 七普通人分别验证chain-success/80affinity/60campTrust/healthy/现场岗位/CP，任一不足拒；stale eligible、trust下降、受伤/重伤、拒绝、驻守都重验；promoted重复确认无二次成本/增益/事件。
- 每名3阶段至少保守成功、冒险代价、玩家跳过、自治、deadline、dead/missing/critical/refusal与无候选退路；记录实际commandId/eventId/causation/目标/前后资源与原因。
- 来源不明的food/parts、空crop receipt、repair no-op、无守卫训练、无患者治疗、死人/跨据点派人不发成功。效果中途失败资源、NPC、建筑、时钟/RNG与命令账本一致回滚，不半晋升。
- 同日额外遭遇、双击、reload、夜间旧contextActions/键盘路径不能重新选择、重复领奖或绕过Gate。夜战英雄技能与白天个人Choice严格分开授权；隐藏/恢复不产生第二技能/计时器。
- legacy pending事件、已promoted、SAVE18初始三英雄、CONTENT3旧会议和原CP消费均保留；无包、坏定义、未知字段/条件安全拒绝；重载不伪造80关系、完整个人链或恢复死者。
- 会议前/后晋升、主持普通贺川、暂代原岗位、死者/拒绝有效票、旧committed/resolved分别验。hero字段是身份单一真相；history/技能名/promotedNpcIds只能辅助审计，不能独立授票。
- 真正14天路线逐日保存人口四账、食物配给/NPC餐量/来源、关系贡献、任务工时、材料、技能消耗与压力，核day6–11实际晋升可达性与day12–16主线退路。训练路线只能证明命令/保存回归，不证明自然生存平衡。

交付时为每人明确“故事已注册 / 可达并真实完成 / 晋升身份已确认 / 命名主动与被动已消费 / 死亡缺席退路已实测”，逐项提供证据，不能用其中一列替代其它列。本卡不改L0、runtime、fixtures、current-state、QA运行文件或生产站点；所有新链/数值/能力仍为proposed开发输入。
