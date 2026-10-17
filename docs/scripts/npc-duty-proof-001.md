# 阿梁与周岚的职责功绩、故事成功与晋升（npc-duty-proof-001）

**状态：proposed／待负责人裁定与开发；本卡未实现、未做浏览器验收。**  
**日期：** 2026-10-14。**范围：** 先闭合阿梁 `carpenter` 的 repair-proof、周岚 `quartermaster` 的 logistics-proof；保留完整十人30节点与完整v82出口。用户所称“阿岚”对应既有周岚，不新增人物或ID。  
**源码观察基线：** HTML SHA256 `faecaffd12aefdf3c1c0f1dd57130bbb2ba37d5da0e9a6e81bc1f7532733335c`，SAVE21／CONTENT3；仅指开发源码，不代表Sites生产或本卡通过。  
**拟议包：** `npc-personal-pack-002`／definitionVersion 2；持久职责事实拟议 SAVE22／CONTENT4，最终版本号由负责人采用后才能实施。

规则源：[06固定十人](../../剧本/尸潮农场/06_NPC英雄晋升与普通NPC体系.md)、[07权限精确定义](../../剧本/尸潮农场/07_计划会与commandPoints.md)、[08效果与建筑](../../剧本/尸潮农场/08_战斗武器技能建筑科技统一规则.md)、[14模板](../../剧本/尸潮农场/14_NPC剧情模板.md)。设计输入：[full-roster-002](npc-full-roster-002.md)、[P1–P8评审](../qa/npc-full-roster-design-review-20261014.md)、[开发交接](../handoff/尸潮农场-开发交接包.md)、[长期计划](../long-term-plan.md)。本卡不修改这些规则、运行时、会议政策或旧验收记录。

## 玩家承诺与完成边界

阿梁需要证明真实防线劳动值得信赖，周岚需要证明账本没有把正常吃饭误写成偷粮。玩家帮助的是原有十人和现有营地，选择必须转成同墙耐久、实际物资来源、本人有效工作或可核的配给账。没有工作结果时可以准备、等待或退出；不能靠接受任务、聊天、反复修墙或反复开仓库面板获得英雄身份。

本批分开六个出口：职责动作真实发生→永久功绩→故事不可逆成功→关系／权限可达→实际晋升→一个已批准技能或岗位消费者。前两个出口完成不能宣称后四个已完成；两个角色完成不能代称十人完成。25／50是故事里程碑，80才是个人关系晋升门槛；`hero.progress=100`、`eligible`、链step、临时权重和技能名称都不是成功事实。

普通晋升严格沿07：**本人的真实个人链成功、affinity≥80、campTrust≥60、岗位未被永久替代、当前可用，另有1CP的独立白天确认。** affinity在当前源码中对应 `relations.trustToPlayer`，不是 `bond`、`bondToPlayer`、standing或campTrust。trust≥60允许英雄节点请求；英雄／小队直接调度仍另验trust≥80或明确命令特权、个人条件与可用性。故事成功不授予特权、不补当天CP。

## 当前源码提供什么证明

| 项目 | faec实际接线／仍缺什么 | 设计的使用边界 |
| --- | --- | --- |
| `repairBuildingReducer`／`repairBuilding`（5814／5871） | 有效现墙／距离≤1／未满／DAY／材料／体力／编号预算Gate；失败返回明确reason；成功 `building.repaired` rich payload | 可作为玩家维修的来源。它没有阿梁参与者或20分钟岗位劳动证明，不能直接写“阿梁完成维修小队” |
| 维修结果 | `proofVersion:1`，原 `buildingId/type`，HP前后／上限，毛支付wood2、energy14，支付前后与推进后资源，standing，日历／推进命令与事件／causation，NPC餐量 | 同墙即时HP+1；推进后的HP、库存和体力另看。体力被动恢复、NPC用餐不能反向解释为少支付或多产粮 |
| 维修时间 | `advance(20)` 的实际 `world.advance`／`time.advanced` 子命令引用；子事件causation应等于外层维修commandId | 比较实际clock前后、真实子命令与receipt，不仅比较墙HP或外层receipt类型；paused拒绝不能产成功功绩 |
| 动作actor／预算 | 当前repair wrapper不转发自治actor，energy14扣玩家 `state.energy`；gather同样消费玩家体力／位置 | 两者都是玩家业务来源，不能换署名成为NPC自治。正式NPC任务、本人needs预算／工时／材料合同未接时，自治只有等待／请求，没有新功绩 |
| 普通采集（5754／5776） | 真正tree得wood4、berry得food2、耗energy8／advance30；资源amount减少1；wrapper delta含推进期间净变化，target可能null，medicine不在旧delta内 | 阿梁备料、周岚粮源可复用动作，但须补实际target／毛产量／支付proof；旧净food delta不能当毛产量 |
| 种植／收获 | 真实garden状态与food+3；`crop.changed`可能{}、公开replay的buildingId可能null | 必须从成功reducer返回rich同plot／毛粮／种子／时间proof；空receipt或附近noop不授权人物成就 |
| NPC工作脉冲（3851） | 依据needs判断blocked或写任务文字／短 `workHistory`；`npc.work.completed`多为feedback，脉冲自身不改变needs | 不等于执行了维修、释放原岗位、回收粮食或核完一日账；needs变化另来自真实routine／行动 |
| 关系／信任（2021／2026） | `updateNpcRelation`改变本人关系，正请求trust×0.5＋respect×0.25自动增加campTrust；`rememberNpc`另有小关系变化而不经这项camp加成 | 本卡不额外再发同义camp奖励。记录请求量、实增和自动camp变化；不能把clamp溢出或旧记忆刷取作可达路线 |
| 晋升（2041／2060） | 当前只阿梁普通track；使用affinity25、旧step、可能stale eligible，缺完整实时Gate和独立Bus事务；周岚未注册晋升track | 新奖励公开前必须先封住旧提前晋升路径，按P1／P2补真正 `npc.promote`。不能先加关系再沿用旧Gate |

源码维修毛成本与HP／advance结果已经接线；本卡没有重新执行源码检查或真实维修浏览器。事件内存最后500、保存最后300、snapshot投影200、NPC记忆／workHistory8、content history100、appliedEffects200都是窗口或展示；**均不能当永久功绩、永久领取记录或故事成功真相**。

## 一套身份与有效工作Gate

内容、晋升、技能、会议共同读取同一固定roster、真实 `hero` 和共享有效角色／参与投影，不再给个人链复制一份“英雄列表”。presence与refusal的保存域遵循共享ADR，不能把missing／left硬写进现 `lifeState`，也不能以id或skill标签猜身份。

| Gate | 实际工作／新奖励的要求 | 等待／拒绝结果 |
| --- | --- | --- |
| 会话／日程 | `SessionController.isDay()`；未exiting／gameOver；个人正式行动day6–11；本任务、目标、定义包存在 | REPORT／LOSS／RECOVERY／BATTLE拒绝白天操作，不扣料／CP、不发成功；时窗之外只保旧事实／最低退路 |
| 存活与presence | 原NPC本人存在且非dead；present；在真实工作区域／目标范围内，不能从守军位置瞬移 | dead永久停止新人物功绩；missing／left暂停；unknown presence不猜present |
| 可工作 | critical不可工作；实际work段必须健康或已批准的伤病折减政策；当前需求不能处在中断阈值 | 首片按healthy结算有效工作；injured允许对话、休养与故事暂停，不直接判故事失败。全部injured禁晋升须P2明确采用 |
| 岗位／工时 | 唯一effective role；非garrisoned；无互斥任务；临时actingRole与永久替代分开；本人／帮手有真实任务分配和工作段 | 原岗没有合法接班就保缺口；不能同一NPC兼维修、医务、物流和据点。`contentJob`不是第二岗位真相 |
| 意愿 | 无本行动scope的有效refusal；低trust只能请求普通职责，是否接单由岗位／风险规则决定 | 拒绝无账交易只挡该交易；不剥夺全部意见或所有故事。解除须实际原因解除／本人回应，不能刷新清掉 |
| 源与目标 | 原stable ID唯一、任务打开后发生、成功量>0、来源类型已支持；墙／plot／资源来自原世界 | 满墙、错墙、资源耗尽、目标消失、空receipt、未知字段／Gate类型均failclosed |
| 晋升 | 当下故事success＋80／60＋1CP＋有效角色未永久替代；所有实时资格重验 | 资格下降可将ordinary eligible展示转回locked／not-ready；已promoted历史身份不倒退。确认失败不扣点／加属性 |

一个工作段要有 `taskId`、本人／帮手ID、effective role、实际开始／结束worldMinute、verifiedMinutes和中断原因，来源是原世界任务执行器。只比较开始／结束健康不能证明中间未离岗；确定性推进必须在日界／伤亡／拒绝／岗位切换等中断处分段。现有工作脉冲缺这层consumer，未补前阿梁／周岚本人劳动标为“未证”，不能把玩家单人动作贴到NPC名下。

## 永久事实与幂等状态合同

拟把事实放在统一 `contentState.npcRoster.dutyFacts`，按原十个npcId索引；仍由原EventDef／Chain／Choice／Effect／Gate与CommandBus使用，不建立第二事件队列、剧情时钟或选民注册。下面是声明式合同示意，不是已注册schema。

```text
dutyFacts.version = 1
dutyFacts.byNpc[npcId] = {
  chainId, definitionVersion, instanceId,
  status: unopened | active | succeeded | closed_without_success,
  openedAt, openedSeq, deadlineDay,
  task: { taskId, targetIds, assignedNpcIds, effectiveRole },
  proofs: { boundedStableProofKey: compactVerifiedDomainFact },
  credited: { contributionKey: { sourceProofIds, rewardCommandId,
             requestedRelationDelta, actualRelationDelta,
             campTrustBefore, campTrustAfter, earnedAt } },
  storySuccess: null | { n1ProofId, n2ProofId, confirmedCommandId,
                        confirmedEventId, completedAt, result },
  terminalWithoutSuccess: null | { reason, commandId, at }
}
```

每名固定一条v2主个人链、最多4份首次贡献＋N1／N2及必要工作／账目摘要；禁止保存完整GameState／完整envelope、历史事件对象套历史事件，或无限append。proof保留固定的小型领域快照、来源build／definition／proofVersion、source commandId／eventId／seq／tick／actor／causation，以及目标／毛成本／结果／有效工时；原receipt被窗口裁掉后这些已验证事实仍可用。不要只保存一个可能已不存在的eventId或不可校验的任意字符串hash。

- **捕获与领取分开。** 在实际业务动作成功时，通过同一Bus的受限、可回放功绩消费者取得源结果；payload只引用task／source command，不能由按钮提交自称“HP+1”的快照。消费者验证原成功receipt／nested因果与参与段，再写固定proof。源码执行者独立裁定捕获接入点与编号预算，不悄增一个无法预留的嵌套命令。
- **已做的动作不重做。** N1领取只核永久proof、未领取键、资格与关系效果，不能重新调用repair／gather／crop／ration。独立域事务覆盖dutyFacts、NPC关系、campTrust、成功flag和其账本；同commandId、换commandId重复节点、刷新均不二领。新功绩写入失败不反称已发生的维修为未支付，也不能承诺当前通用Bus可回滚整个钟／RNG；实际动作保留、故事领取失败零奖励并可见，只有仍有严格源证据时才重试捕获。
- **用途唯一。** 同一源command／proof只归属一名NPC的一种奖励用途；不能同时领C类、N1、N2，也不能给阿梁和周岚各领一份。别名、换墙、过一天或清展示history都不重置领取键。一次集体晚餐原本全员的小关系变化可保留，新职责大奖只有预先绑定的一名真实受益者。
- **成功不可逆。** 只有N2核过本人独立N1功绩、责任兑现与期限，才原子写 `storySuccess` 和 `status=succeeded`。之后墙又受损、本人死亡／失踪、关系下降不抹掉真实历史成功；当前可用性与技能／票权另Gate。success不回到active、不重新开奖、不因当前step0清除。
- **终结不等于成功。** fallback／准备／unreconciled／跳过／过期写 `closed_without_success`；completedChains可含这些结果，不能用它授晋升。真正保守成功须同样有真实职责结果，如安全核心墙实际修好、只核营地账且不冒险贸易；没有结果的“保守准备”不是success。
- **永久事实不是永远有效命令。** 旧功绩可证明当时劳动；当下晋升／技能仍核present、岗位、伤病、refusal、CP／信任。读UI／读投影不修改这些事实、不refresh CP、不产第二次功绩。

## 阿梁：repair-proof最小完整链

| 阶段 | 玩家／保守／自治与实际结果 | 结算条件与退路 |
| --- | --- | --- |
| N0 mark-defect | 在day6–10绑定原受损wall／spikeWall与本人维修任务；公开目标HP、木材2／体力14／20分钟和人员占岗。接受不加亲和 | 初始墙满HP，不能编裂缝。实际夜战blocked造成的wallDamage可提供缺陷；没有坏墙只备料等待或无成功退出，不故意放敌人或制造损坏刷奖 |
| N1 repair-proof | 玩家经原公开repair route修同墙，阿梁在合法职责任务中真实参与；安全营地墙与冒险外围墙都允许实际成功。自治拟走原Bus的新正式NPC任务，非换现repair actor；未接任务consumer就等待 | 玩家帮助分支：同墙即时HP+1、毛支付wood2／玩家energy14、20分钟advance因果、实际本人工作段；0／null／失败／错目标不通过。自治本人的needs／疲劳与材料预算另待ADR，不扣玩家14体力。合法自治proof可形成故事责任，但不给player-1守约亲和，不替玩家花CP晋升 |
| N2 accountable-crew | 至少下一个真实calendar day，阿梁交代已用木料、剩余物资与当前墙态，完成另一份责任／交接工作proof；只消费原N1一次 | 诚实记录后来损坏不抹掉已修好的事实，也不把旧HP当今天HP。本人不可用暂停；无有效交接只未成功终结。成功仍不自动晋升、不开repair-squad |

玩家帮助分支的repair-proof必须保存：外层 `building.repair`／`building.repaired` 的actor、ID、seq；task打开时间；原target ID/type；hpBefore、hpAfterImmediate（严格+1）／maxHp；payment.before／after严格wood-2、energy-14；advance.commandId／eventId／causation／minutes20及clock真实差；target.presentAtCompletion／typeAtCompletion／hpAtCompletion；推进副作用分账；本人有效参与段。源已允许同墙推进后再受损，不能只用最终HP判断即时修复不存在。目标在结束时被移除或变型则不确认本任务交接；保留真实维修支付，不另造同ID墙。未来自治proof沿其正式NPC命令和本人预算合同，不能套玩家energy14字段。

当前faec允许仍在数组中的HP0墙修到1；08设计称耐久0应移除地图。首批职责实证选择原HP1／2仍在场墙；HP0旧对象是否可授新功绩列ADR，不擅自改通用维修或以个人链复活已移除建筑。

死亡后纪宁只在真实健康／技能／原门岗有合法接班、未驻守时承担低效率基础修墙；无合格者保vacancy与破口。纪宁保留原ID，不继承阿梁功绩／hero／主动技能。临时替岗不自动永久夺走阿梁资格；“永久替代”必须有正式角色事实和原因。

## 周岚：logistics-proof最小完整链

| 阶段 | 玩家／保守／自治与实际结果 | 结算条件与退路 |
| --- | --- | --- |
| N0 reconcile-ration | day6–10打开具体核账区间与已有库存，展示日界配给、NPC取餐、玩家吃饭、真实来源和已承诺计划；预先绑定周岚及审计工时 | 普通取餐不是偷窃。未知差额显示unreconciled；不开粮源奖励／惩罚，不为核账再次chargeDailyRation |
| N1 recover-logistics | 一份新的、未作C类奖励的真实berry采集（毛food2）或同garden收获（毛food3），再由周岚完成独立库存核对／整理劳动；保守只做营地账，不依赖未实现贸易 | rich source proof＋来源amount／同plot变化＋gross产量＋真实审计工时／受益人；净food差、{}、打开仓库或旧food+1文本均不通过 |
| N2 accountable-priority | 至少下一真实日界，核一次实际配给与各类粮流，完成责任签收／优先级记录；只写已证责任与成功 | 所有已影响库存的producer／consumer必须可归因；未核项仍unreconciled。没有执行器消费的新库存优先级，只标“建议已记录”，不称ration-ledger／inventory-priority能力已生效 |

物流proof按真实顺序核：期初food＋毛来源／真实回收／已有计划与内容的实际增粮－NPC吃饭－玩家吃饭／晚餐－当日**实际支付**配给－实际据点upkeep及其它已支持支出＝期末food。每一类含原成功command／event／目标／毛量／实际量／时点；配给requested与min库存后的paid／shortage分开，不能用returned ration直接当实际扣粮。NPC餐量直接消费原 `npc.need.fulfilled`；这类系统事件自身commandId可能null，应通过原causation／父world.advance与eventId／seq关联，不补造NPC独立命令。不能把这一餐又算日界配给或重复扣到周岚任务里。周岚自治采集／整理也须正式NPC任务与本人预算，不能把现玩家gather改actor就署为其劳动；未接只有核账等待。

需要最小永久日账consumer：只在原成功的粮食producer／consumer和日界结算发生时更新本任务固定日账摘要；它是既有事件的领域事实消费，不发第二份食物、不另跑日历。未支持事件、没有来源的food变化、窗口裁剪前未捕获的旧差额均failclosed，不能默认0或用一个“其它收入”抹平。原chargeDailyRation没有足够rich毛／实支付receipt，采集／crop也需补proof；这些是待开发前置，不是本卡已完成能力。永久日账只保正式day6–11有限任务区间与固定来源摘要，不无限保存整条世界账本。

所谓“找回口粮”只有原已登记损失批次仍存在、数量>0且实际取回才可加粮；第一版无需新偷窃／损耗／贸易剧情。真实采集、收获或纯核账路线足以承接职责，未知账只等待。死亡时唐婶合法接班且占原农务工时；两人均不可用就按真实库存最低发放、保短缺，不造人／粮／英雄票。

## 0起点关系预算与时间／成本提案

**P5未批准，下面是可实现路线提案，不是当前路线已实跑可达。** 沿评审的4类首次贡献各≤10、N1≤25、N2≤15＝最多80新亲和预算；每人各自6份不同proof。接受任务0、同类别后续0、自治不记玩家贡献、纯文本0。类别键永久保存；不能靠额外墙／food循环追回已经领取的类别，也不在关系下降后自动补足80。

| 独立贡献 | 建议成本／实际来源与消费者 | 阿梁／周岚绑定及待开发项 |
| --- | --- | --- |
| C1 材料到任务＋10 | 原采集30分钟／energy8；tree毛wood4或berry毛food2；另拟≤10分钟交付／实际预留核对 | 满足已登记需求与真实库存约束，不能只写“已预留”。C1源不能再作N1。现需rich采集proof及预留consumer；不造第二资源池／扣两次 |
| C2 本人照护＋10 | 原居住区晚餐food1／30分钟；须该本人hunger／stress／SAN至少一项实际改善 | 事前绑定一人；保留既有全员rememberNpc小变化，仅该人获一次新职责贡献。需rich个人受益proof；无粮／clamp无受益不计，不用反复饭局刷关系 |
| C3 有效替班／劳动释放＋10 | 拟20分钟、拟请求1CP；07已有trust≥20基础岗位请求权限，具体收费／新task命令须ADR采用。原roster一个合格替班者，原岗位释放量／本人休息或待办容量真实改变 | 阿梁释放维修准备／周岚释放盘账容量，继任者原岗需接班。现工作文字不足，需实际task consumer；无候选不凭空完成、也不能用same N1劳动再领C3 |
| C4 目标安全／库存保护＋10 | 拟10–15分钟、拟请求1CP；07已有trust≥40普通岗位优先权限，具体收费／新task命令须ADR采用。真实目标／库存约束被下一次普通职责执行器采用 | 阿梁的安全目标／材料保护或周岚的合法库存优先约束；纯开面板无效。它不是ordinary使用英雄inventory-priority或小队控制。其proof独立于N0接受、N1結果和N2核账；现需消费者 |
| N1 深职责＋25 | 阿梁实际repair木材2／energy14／20分钟＋本人工作；周岚另一源30分钟／energy8或另一plot收获energy6／20分钟＋拟20分钟审计 | 使用另一份独立业务动作／工作proof；不与C类重复。初始garden未种，播种另有seed1／energy4／20分钟及两次真实日界生长成本，不把初始plot当成熟 |
| N2 隔日责任＋15 | 拟10分钟新交接／日界责任签收；N1.day<N2.day，day≤11 | 不能兼领C4，不能当天连续点击完成；必须真的跨日，原配给／计划／NPC餐照常，不暂停钟或重复关报告替代日界 |

四类贡献中C3／C4及部分C1／C2消费者尚未接线。若本轮只接repair与物流proof，先到职责功绩出口，明确未到英雄出口；若决定缩减这些消费者，则由负责人裁定新的P5预算／节奏，不把四个泛化对白按钮凑成80，也不临时降低80／60门槛。

### 公共信任来源必须另算

当前关系变更的自动camp加成按**请求量**，不是clamp后的实增。无损失、从0、只给trust＋80／respect＋0时，个人路线只贡献camp＋40。新增职责Effect不再另发＋40camp；修墙、采集、中继等已有standing收益保留并逐条另记。`campTrust` clamp0–100且四舍五入到0.1，个人关系 `clampSocial` 是-100–100；不能把所有人的关系强行改成0–100，或在100后用重复请求量刷camp。

一个单人从0到晋升的**条件化公共路线**，采用当前已有收益：

| 日程／来源 | 已有实际代价与必要事实 | camp增量上界（无clamp／重复） |
| --- | --- | ---: |
| day1–5，8个不同现有地标首次探索 | 每个energy3／advance20，实际found从false到true；包含radioTower取得原relayCore，其余从当前地图选已可达不同ID；总energy24／160分钟另加真实路程／暴露 | 8×1.5＝12 |
| day1–5，公开交relayCore给林岑 | 原物件consume一次、原长官在场／距离；本人trust2／respect2＋standing贡献2，无新剧情奖励；handoff本身无另加固定工时 | 1.5＋1＝2.5 |
| day1–5，真实中继上线 | 原需求wood10／parts5／stone4、实际project.workMinutes达到原target180；从原库存／实体来源筹料和实际stationOnline确认。当前relay参与者只查原角色／非dead，尚无本卡健康／在场／独占／完整劳动段Gate；这些是路线新增验收要求，不能由上线推定三人各自有180分钟有效劳动或个人功绩 | 3.5 |
| day6–9，N1唯一真正修墙 | 原wood2／energy14／advance20，同墙＋1；此项是已有standing收益，不另获第二C类关系 | 2 |
| day6–10，本人6份独立守约贡献 | 上表真实来源、时间、材料、参与和互斥proof都成立，关系请求总80；不额外给respect | 40 |
| 合计 | 18公共信任＋2维修＋40个人关系自动加成 | **60** |

这不是执行证明，也不是强制个人链绑中继：后勤个人路线若不修墙，须用其它确有产物的公共贡献替代那2，例如为不同真实供给任务进行4次有效采集（4×0.5、120分钟／energy32），不同时拿这些源领两份私人关系。中继未上线、八地标不可安全到达、角色伤亡、库存不足或clamp／失信时不能称已取得该增量；可以从当前实际campTrust继续合法公共任务，或本窗只完成职责／故事，不晋升。未实现camp-charter不能给任何信任；双人共用一份receipt各发关系也不能充当缺口捷径。

拟节拍：day1–5埋线与真实公共行动；day6请求N0、C1／C2；day7正常刷新后满足20权限才申请C3；day8–9完成独立N1，实际信任达到40后另申请C4；day10核N2和真实80／60；若当天CP已耗或信任刚升而上限未补，等day11正常DAY刷新后独立扣1CP确认。C3／C4按新提案各1CP，加晋升1CP共3点跨日花费，不能把它们当现实现收费。0–19只能请求帮助／本人自主接单，不能强制改岗。day11才做N1来不及隔日N2，按未成功／过期出口，不延窗。计划会可能先花1CP，collapse≥70也扣上限；逐日记原CP／已承诺会议，点不足等待、不重生成会议、补点或退款。

公共路线不能只算信任而忽略生存。初始food8／wood24／parts4／stone12／energy78；中继物料和N1维修分别实扣，radioTower的parts1只能入一次来源。十人时现dailyNeed为3，另有真实NPC取餐／玩家吃饭／照护，不能假定初始food8足够撑到day6。必需提前播种／两日生长／真实收获，或采原berry与其它实际食物来源，逐日核粮、体力恢复和伤亡；探索物件奖励不当永久供水产粮。库存／安全路线若无法支持8地标与中继，则该设计路线未验证、未达本次英雄出口，不能用fixture补库存或关钟强行成立。

新的奖励最终数值、C3／C4收益量、材料预留和公共路线的生存预算均待裁定／自然游玩。原dinner／night support／旧NPC事件也可能改变关系或失信；实际路线逐次记录before/requested/after与各camp来源，而非用数学80覆盖原实值。表只描述无负面、无clamp的设计目标，不保证每局所有人必升。

## 状态转移与人物退路

| 当前状态／原因 | 唯一合法转移 | 保留／禁止 |
| --- | --- | --- |
| unopened，正式时窗与前置满足 | 原Chain／EventDef启动一次N0→active，绑定本人／目标／版本 | 接受0奖励；旧同议题pending先按原定义完成，不双发 |
| active，真实有效工作成功 | 捕获compact proof；独立N1确认一次、仍active | 保留业务毛结果；不重做动作、不凭eligible写success |
| active，次日独立责任proof成立 | N2原子succeeded＋storySuccess | 后续不可逆；保守／冒险均可凭真结果成功，技能与身份另验 |
| critical／injured／missing／left／scope refusal／garrison冲突 | 暂停工作／奖励，读明确原因；真实恢复后在原期限续原实例 | 不清旧功绩、不写lifeState假枚举、不自动全局失约；返回原ID仍须活着 |
| dead／角色正式永久替代／过期／明确跳过 | 没有已成功事实者closed_without_success，记录原因；已有succeeded保历史、关闭当前可用性 | 死亡后不补奖，不复活／造人／返CP／转移死者故事给继任者；后来失效不抹真成功 |
| ordinary达到当下80／60＋故事／岗位条件 | pure资格投影eligible；玩家合法DAY发唯一npc.promote→promoted | 扣1CP／身份／属性／唯一completed必须同事务；当前资格下降拒绝stale eligible；不倒写当日旧ballots |

继任只能最低职责。阿梁→纪宁、周岚→唐婶沿06；原优先表不一致需P3裁定再统一，不能在本卡偷偷改表。无人能合法接班则保持岗位空缺与保守核心准备；critical计存活而不计可工作。据点守军仍属原人口，但不当campLocal／核心岗位劳动。营地人数不足不借个人成功造人口，最终day14／day12–16与day10锁定日期不被个人链延期。

## 保存、迁移、会议与能力兼容

- **建议版本采用条件。** 永久proof／credited／参与工作／日账是新增规则与严格保存域，建议下一主题SAVE22／CONTENT4，同时definitionVersion2。必须更新实际writer、validator、normalizer、replay投影／golden与旧档矩阵；不是把extension pack版本2写进现contentState并降级。正式负责人未采用前保持当前21／3，不宣称新增字段已可安全保存。
- **旧档缺proof安全默认。** 原18／21完整NPC、关系、资源、world、role、relay、quests、原hero／已花CP、ration/upkeep和旧会议保持。新dutyFacts每人unopened、无proof／credit／storySuccess；不能从旧step、回忆、“修补裂缝”、“整理仓库food+1”、有限旧receipt倒填新成功／80亲和／新技能使用或奖励。已真实promoted历史身份保留并标legacy；新职责未核，不制造其新功绩。已存在关系／资源收益不追回。
- **缺字段与坏字段分开。** 合法旧schema缺该域才默认；新schema显式null／数组／未知npcId／交叉人物proof／冲突任务／invalid quantity／真假成功不一致须拒绝或安全恢复，不能悄清成unopened后重领。仅读保存／打开UI不迁移奖励，正式migration有唯一命令／receipt与readback。
- **旧pending与版本。** 保留旧instanceId／defVersion／选择成本及原结算；旧同议题结束后才能启动新个人链。新包缺失时保永久事实、禁止未知新节点／技能、显示缺包；不能把缺包当故事失败或全部completed。
- **会议不追溯改。** 共用真实hero身份与正式参与投影；普通／eligible不是hero票。晋升只进入首次后续新会议；同日candidate／committed／resolved／fallback、旧ballots／score／selectedId／playerAction／effectId／CP保持。legacy会议按原policy版本，不能把新权重回套或重扣点。临时主持不英雄化。
- **能力尚未交付。** repair-squad和ration-ledger／inventory-priority仍需独立消费者。ordinary／eligible无命名技能；promoted也需实际目标、人手、料、状态、调度权限与冷却。08的主动30–60秒／同类小队8秒共享冷却保持；若劳动任务用120–180游戏分钟等另一个冷却尺度，须P6明确例外ADR，不悄称符合原规定。属性沿06／现0–100，14的0–10冲突不在本卡换算旧值；晋升＋8、通用效率系数与STORY10–15%不自动叠加。

## 六视角合理性账本

| 视角 | 本批因果与代价 | 必须拒绝的伪结果 |
| --- | --- | --- |
| 势力 | 原营地墙／库存即可成立；外部贸易／家属只保线索，八地标和relay须原来源 | 未接河湾交易或章程给物资／信任、造外援人口 |
| 营地 | 毛维修支付、墙HP、物流来源与配给分别对账；一人一岗，工时与照护耗真实库存 | 正常NPC用餐变偷窃、重复ration、false预留、不消耗材料的帮手／产粮 |
| NPC | 阿梁真实参与才有本人功绩，周岚不知道的差额可以承认未知；保守守约也可成功 | 玩家solo修墙署成阿梁技能、critical／missing仍工作、继任者拿死者成功 |
| 玩家 | 看清成本／工作原因／缺证明／下一日责任和80／60／CP条件；从0贡献而不是赠英雄 | 4个对白＋step换80、重复修墙／饭局刷新亲和、当日补CP、暗改旧会议 |
| 敌人 | 损墙来自原夜战／真实攻击，维修有暴露与防线机会成本，公共探索有原风险 | 故意生新敌／破墙给任务、成功自动挡全尸潮、通过故事改终局日期 |
| 全局事件链 | 唯一source→proof→领取→不可逆故事→独立晋升；个人支线可跳过，中继／最终链读自身事实 | last500／save300当永久真相、第二队列／奖励系统、临时权重或history代替人物成功 |

## 待负责人裁定的ADR事项

| 项 | 与现规则／实现的关系 | 本卡建议，未采用 |
| --- | --- | --- |
| P1／P2 | 07明确80／60／成功；旧晋升25／step不符，healthy与injured边界未统一 | 先封提前晋升；新可用投影／当前Gate。临时actingRole不判永久替代；injured可对话／暂停，禁晋升政策明确批准 |
| P3 | 06继任名单与现priority表不符 | 阿梁→纪宁／周岚→唐婶优先，仅真实空出原岗／技能／人手后；无候选保缺岗 |
| P4 | 06／运行时0–100 vs14熟练0–10；晋升／被动多个输入可能重叠 | 不改旧数据单位，不堆未消费增益，逐consumer实际量验收 |
| P5 | 4×10＋25＋15未批准；后三类缺任务消费者；camp按请求而非实增；07没规定C3／C4的具体CP收费 | 采用真实用途唯一／永久领取上限；裁定C3／C4普通请求各1CP提案和可达工时；校准奖励与按请求／实增camp政策。改helper是新版本，不能偷改已有行动收益 |
| proof／SAVE | 新永久领域状态目前不存在，旧窗口会丢证据 | SAVE22／CONTENT4完整迁移与size预算；source proof捕获／失败恢复及工作／日账consumer先冻结合同 |
| P6 | 30–60秒技能冷却vs拟劳动任务长工时；HP0墙生命周期矛盾 | 劳动任务先无英雄技能承诺；HP0旧墙先不作职责首验，正式destroy／repair资格单列裁定 |
| P7／P8 | 正式会议参与ADR与时窗；旧pending／已提交实例必须保持 | 共用身份／presence／refusal；day6–11，N1最迟day10且跨日N2；不延终局或回套legacy政策 |

## 实施与待执行验收矩阵

以下均是开发输入／待验证，不是新增通过。卡片静态审查不能代替这些真实函数、保存或公开路线。

| 批次／验收 | 必须执行的强证据 | 负例与诚实未完成项 |
| --- | --- | --- |
| 1 action／permanent proof | actualfaec repair／nestedBus执行；毛2／14、同墙＋1、20分钟、causation、原目标／参与身份；新writer→loader两次保持fixed fact | 满墙／缺料／14以下／远距／night／报告／paused／错ID／编号耗尽无success；旧21无参与proof不能补造。source检查不代称维修browser |
| 2 阿梁N0／N1／N2 | 原坏墙公开动作＋本人有效工作→永久proof→次日独立责任→唯一storySuccess；全部成本／目标／日期真实 | 0材料仅准备；旧step／eligible／fallback不给成功；重复同ID或换ID不二领，500事件／300save裁剪后永久事实仍在 |
| 3 周岚物流 | rich原source／同plot、毛产量／payment、真实审计劳动、连续已支持粮流和一次真实日界实际配给；无新增freefood | {}／noop／净delta猜毛量、未知增粮／漏NPC餐／双配给／crop换plot／非本人工作拒。实际物流优先consumer未接就不称技能可用 |
| 4 关系／晋升 | 从原0的新局公开路线，逐日6–11保存6份独立贡献与公共trust来源；80／60／CP真实满足，再actualnpc.promote一次／真实后续会议／已批准consumer | fixture79／80与59／60只测Gate，不作可达证明；重复类别／跨人同proof／当日回补／stale eligible／旧committed不重算；失败保事实 |
| 5 缺席／死亡 | 原生命与正式presence／refusal命令，工作段中断、原人口四账、合法原人继任；已成功历史保留／当前新奖励禁用 | 真missing／return接口未接仍未验，不能用dead代称；临时actingRole／驻守冲突／无人接班保持原因，不造人／转移功绩 |
| 6 迁移／包／回放 | 实际生产18、当前21未晋升／legacy promoted／旧pending／legacy meeting→新schema；坏proof负控、缺包、read-only纯度、双reload／裁剪／确定性hash | 不从旧日志重造功绩／CP／80关系；不在同一长局换HTML／热注成功；schema数字或golden变化明确解释，不直接重基 |
| 7 自然14天 | 新隔离profile／冻结build，每日人口、粮流、工时、关系、死亡／失信、主线和day12–16准备；至少一个0起点完整英雄出口 | 八地标＋中继公共路线的实可达／生存成本未验证；C3／C4和新任务consumer未实现；训练SAN路线不证明平衡 |

阶段顺序：先永久领域事实／unknown Gate failclosed／新旧晋升隔离→阿梁真实职责→周岚真实来源与日账→P5真实路线与唯一晋升→一个已批准英雄consumer→其它八人。任何提前交付只注明其范围；主线、引擎迁移、表现层打磨继续按长期计划，不用本卡新增第二套世界机制。

## 完整十人30节点范围保持

| 原NPC | N0 → N1 → N2（来自full-roster-002，均仍proposed） | 本卡之后的实际证明重点 |
| --- | --- | --- |
| 林岑 commander | 旧授权／章程边界 → 真实职责承诺 → 有界指挥确认 | 初始hero，不二次晋升；权限／会议／sector consumer |
| 阿默 radio | 杂音 → 真实调谐／信号证据 → 放大取舍 | 真实relay／预警／压力；初始hero身份保留 |
| 苏禾 doctor | 药品归属 → 真实分诊／帮手 → 下一班责任 | 真伤员／药草／工时，不无源治疗；初始hero |
| 阿梁 carpenter | mark-defect → repair-proof → accountable-crew | 本卡首批永久维修功绩，随后实际晋升／小队消费者 |
| 贺川 sergeant | roster-rotation → actual-drill → discipline-agreement | 真替班／训练／原守卫，不能普通主持有英雄票 |
| 周岚 quartermaster | reconcile-ration → recover-logistics → accountable-priority | 本卡首批永久物流／核账，随后晋升／供给consumer |
| 唐婶 cook | 火／种取舍 → 实际农务／供水 → 下一餐兑现 | 同plot收获／留种／粮水，不假成熟／增粮 |
| 纪宁 guardJi | 旧誓言 → 实际守岗／护送 → 有限承诺 | 本人支援／接班／撤退事实，保守可成功 |
| 陈野 guardChen | 安全岗位 → 实际接班／撤退保护 → 存活交账 | 原ID／工时／真实保护目标，不把撤退一律失约 |
| 蒋锋 guardJiang | 追击冲突 → 实际目标／带回 → 交账与克制 | 真来源／门岗空档／回营，克制亦可成功 |

每人仍有自治／玩家、保守／冒险、dead／missing／critical／refusal／garrison／资源不足／期限／跳过分支，以及单一英雄身份、一个主动槽／营地被动的实际消费者和保存／回放出口。完整v82只有十人全部接完并验收才能关闭；本卡没有把后八人或30节点缩掉，没有新增能力／浏览器通过结论。
