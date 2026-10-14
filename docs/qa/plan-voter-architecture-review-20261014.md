# 计划会票源、冻结与可行性架构评审

**状态：** active / 只读源级评审；D1–D8 尚待负责人采用并修订 L0。

**日期：** 2026-10-14。

**审查源：** `dist/index.html` SHA256 `412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8`，SAVE21 / CONTENT3。

**范围：** [proposed 剧本卡](../scripts/plan-voter-projection-001.md)、[05](../../剧本/尸潮农场/05_势力营地与敌人多视角.md)、[06](../../剧本/尸潮农场/06_NPC英雄晋升与普通NPC体系.md)、[07](../../剧本/尸潮农场/07_计划会与commandPoints.md)与实际运行时；不修改规则、代码、夹具或当前状态，不运行浏览器。

结论：D1–D4、D6、D8可以形成一个可实施的票源切片，但必须同时处理 trust Gate、旧会议策略、冻结票与有效票的区别。D5 的持久缺席/拒绝、D7 的完整因果失效和真正粮食供给需要独立状态契约。只改 `hero` 字段与“断粮”标签不能宣布计划会或十人自治完成。报告恢复的浏览器门禁继续排在本主题之前。

## 已执行的源级证据

使用当前 [恢复检查器](../../scripts/check-report-recovery.mjs)中的完整 inline VM 构造器，实际调用 normalizer、晋升、票源、评分、会议生成、CommandBus 提交和计划效果。检查器仅控制 DOM/storage/timer，跳过文档末尾 Canvas render，并 instrument 与本次规则无关的 renderWorld/renderHud/renderContext；没有替换被审查的函数。检查器 SHA256 为 `ee5bb659c0439044e1ec07a4aecf931293457c2478f35d0850fe90770b4367cf`。

所有输入均为明确 TEST-ONLY 的源码状态夹具。这里不是浏览器、自然路线、旧存档兼容或通过测试报告；尤其“全员死亡仍执行”只证明执行器缺 Gate，不推断自然游戏一定会到达该组合。

| 实际调用/输入 | 本次观察 | 源位置与含义 |
| --- | --- | --- |
| 原始十人初始化 | commander/radio/doctor 的 hero/promoted 身份正确；实际票权 3/1/1，ordinary/locked 的 sergeant 为2，其余0，总票池7 | HTML 1819–1834、2214–2220；票权另有 ID 特例，未统一身份 |
| 木匠真实 `evaluateNpcPromotion` → `promoteNpcHero` | eligible时0票；实际扣1 CP，写hero/promoted与1条completed后仍0票 | 2041–2075、2216；不只是一个手填 hero 的假晋升例子 |
| ordinary/locked木匠手填 stale `promotedTier=hero` | 实际获1票 | 2216；内容目标/废弃字段能造正式票 |
| 实际 `normalizeNpc` 处理ordinary/promoted | 保留矛盾组合，并补出 repair-squad / construction-crew；票权0 | 2901–2907；normalizer并未保证 tier/status一致，不能把它视为身份已验证 |
| HP100/99/30/29/0，经真实sync | healthy/injured/injured/critical/dead；commander票3/1.5/1.5/1.5/0 | 3373–3377；小伤与重伤目前同半票 |
| commander有garrisonedOutpostId | 仍3票 | 2214–2220；没有在场/远端通信资格检查，不能当成传令已实现 |
| 第2天、trust20、CP2，实际生成后 `commitPlanMeeting('support')` | CommandBus返回ok，CP2→1，状态committed | 2253–2267；现有权限阶梯并不能代替提交Gate |
| 同日committed后普通 `generatePlanMeeting`，没有force | 回candidate、playerAction=null、CP仍1、第二条candidates；再次提交成功CP1→0 | 2238、2248；能洗掉同日决定并收第二次CP |
| 十人健康、trustToCommander0、collapse0、resonance25、默认weights，food2/日需3 | 六方案均7票；采集base25、排名第6，不进入实际前三 | 2222–2246；评分门槛饱和，+9不是优先排序保证 |
| 同条件food0 | 采集从7→0票仍第6，其余5案仍7票 | 2232、4086–4092；“短缺”从未由foodSituation返回 |
| 会议后commander死亡 | 即时票源函数为0，但已有三候选仍显示votes7 | 2246、4406；保留原ballot正确，缺少有效票视图/执行资格分离 |
| TEST-ONLY选水车计划，下一日、全员dead、gameOver=null、wood0、无建筑/资源 | `executePlanMeeting`返回ok；food0→1，wood0，仍零活人并标resolved | 2273–2291、2194；affectedRoles/risk文本没有变成工时、材料、人口或来源Gate |

实际入口名是 `executePlanMeeting`，本源未发现 `executeCampPlan`。它在 `runPlanMeetingDayStart` 先执行，随后刷新CP；真正日界的 `runWorldDayUpkeep` 调用该入口（2294、4217–4225）。不需要为本主题另造一个执行系统或改变日历。

## 阻塞与处理优先级

| 阻塞 | 必须先确定/处理 | 对交付的限制 |
| --- | --- | --- |
| P0：L0相互矛盾与数值变更未采用 | 07的critical“移除”和“半票”互斥；06普通军士与旧卡2票特例冲突；旧卡与交接的干预/执行时序不同。正式采用D2–D4与时序并同步05/06/07、旧卡、交接 | 不能用“修字段”名义悄悄改变票池7→4或重伤政策 |
| P0：会议提交越权与同日重建 | 真正commit入口增加trust≥60、DAY会话、当前实例与一次干预Gate；生成对candidate/committed/resolved和已结算日实例均去重；force不绕过玩家实例冻结 | 新票源切片不能发布为可靠计划会，而继续允许trust20投票或重复收费 |
| P0：旧票型被新政策重算 | 必须按实例保存策略，legacy原权重/候选/选择/已花CP/历史保留；最低生命/岗位安全Gate独立 | 全局换新权重再对旧ballot取min，会把旧长官3票和旧军士2票追溯改写 |
| P0：执行无人口/岗位/来源预检 | 在统一执行入口添加可解释的安全Gate，批次失败无收益；先登记每个方案的真实消费者/来源，缺失时blocked/fallback | 不能把D8通过称为断粮自治；不能给水车/补采/医疗的免费食物/药品补一段解释就算来源 |
| P1：normalizer/validator并非身份一致性合同 | 显式处理tier/status矛盾与hero/roster冲突；不凭roster抬升hero，不调用晋升效果修存档 | “先normalize再看hero”必要但不充分 |
| P1：缺席/拒绝没有共享持久域 | 先ADR定义presence与范围/期限/解除事实，再接保存、人口、地图、工作、事件、会议、战斗消费者 | 不允许临时lifeState字符串或old orderRefused永久剥权；第一切片必须明确未接线 |
| P1：D7排序缺历史tie-break字段 | 当前candidate未保存basePriority；新会议应保存该快照，旧会议保留rank而非查新定义重排 | 否则改PLAN_DEFS也会暗改已生成会议 |
| P1：危机议程目标没有供给可行性 | 信号修正后观察真实排序，另设有来源的危机席位/执行策略及版本 | 六案饱和使food0 +9仍可能第6；只改权重也不能证明供给进入前三 |

这些是本主题的实现/发布条件，不是暂停整个长期目标的理由。晋升阈值affinity25与L0要求80、仅四条NPC_STORY_DEFS、主动技能消费者、全十人死亡/失踪/拒绝分支继续进入完整v82后续卡，不混入报告恢复或本轮票源修复。

## D1–D8的最小实施裁定

| 提案 | 架构意见 | 最小切片与后续边界 |
| --- | --- | --- |
| D1 hero单一真相 | 接受，条件是actual hero.tier/status同时满足，并来自初始化/loader合法合同。npcRoster是历史投影，不是另一份权威资格 | 复用现有hero，不重放晋升奖励；初始三英雄无需伪造completed，账本窗口可能截断也不能撤销真实已保存晋升 |
| D2 commander2票 | 设计上可解释，但明确是新政策数值；不能称行为未变 | 新实例基础1+林岑本人额外1；actingRole/chair不复制该额外票，legacy旧实例不换算 |
| D3普通军士0票与主持 | 接受普通人主持可维持流程，主持资格与英雄票分开 | 纯主持投影用既有固定roster、非critical在场资格、commandSkill/稳定ID；主持不加CP、英雄、人口或产出 |
| D4 injured全票、critical0 | 接受并统一07互斥条款；投票与工作是不同权限 | 真实sync的HP边界100/99/30/29/0必须覆盖；critical仍保留生存人口，工作/正式票0，injured能投票不等于健康岗位资格 |
| D5拒绝范围 | 必须采用；现有orderRefused只能解释一次命令拒绝 | 第一切片不消费“永久拒绝”假字段；共享域后才接meeting/instance、proposal/execution、specific command各自解除与期限 |
| D6日实例冻结 | 必须随票源第一切片完成 | 同日任何已形成实例不重建，原candidates/ballots/playerAction/CP/history不清空；晋升只进入首次后续新实例 |
| D7原票与有效票 | 源码生存/重伤/据点场景可先做纯有效视图与执行安全Gate；完整缺席/拒绝因果记录随共享域 | 原ballot不改、不补新选民、不重算score；未提交仅在原候选中选可行案；committed保留选择和CP，不暗换收益 |
| D8实际ratio<1 | 接受信号统一；医疗+9必须读真实未死亡伤员，不能用文本/统计猜 | 第一切片不改阈值30和排名公式。第二切片处理真实供给席位、来源、劳动、威胁和机会成本，单独接受平衡验收 |

最低可实施接口建议是 `projectPlanParticipation(npc, facts, policy)`、`projectPlanBallot(ballot, npc, policy)`、`projectPlanCandidates(meeting, facts)`、`checkPlanExecution(candidate, facts)`；都读取已有状态，不调用晋升、增资源或生成事件。生成/提交/失效/执行的真实变化仍从现有命令与reducer进入账本。为将来RolePlanner输出提供观察投影即可，此轮不加LLM直接写票或效果。

## 历史会议、有效资格和存档合同

建议先采用ADR，再实施如下协议；本节不是已经实现的schema。

1. **新实例标版本。** `plan.version=2` 与 `votePolicyVersion='plan-voter-policy-v2'` 放在会议内。新增chairNpcId、生成时食物/人口观察摘要、candidate.basePriority及定义/策略版本快照。缺席/拒绝不在本轮通过UI全局boolean表达。
2. **旧实例保持旧规则。** 原version1且缺策略的candidate/committed/resolved明确标legacy-v1，保持原ballots、votes、rank、selectedId、playerAction、history、autonomyResult与effectId。新政策仅首次后续新会议生效。不能把已经消费CP的历史会议退回idle，也不能为旧SAVE18 retro生成会议。
3. **有效票按实例策略。** 新v2有效weight为`min(originalWeight,currentAllowedV2Weight)`；被排除者0，未出现在原ballots者0，恢复最多到原上限。legacy不能套v2的2票/军士0票上限：保留旧数字政策，独立做生命、重伤及岗位/参加安全过滤；对应哪些legacy安全过滤正式采用须写ADR。新旧UI均分开“原票”与“当前有效票”，不将保留历史当作死人仍有当前权利。
4. **旧缺票型不编造。** 现有validator并未要求ballots或数值字段。旧会议若缺完整票型，显示“历史票型未记录”，保留可证原选择/已花CP；不能从今日roster补选民。新version2严格验证每个npcId唯一、属固定roster、权重有限非负、score有限、汇总符合原ballots、basePriority/rank稳定、policy/instance/day一致。
5. **旧tie-break不查新定义。** 新v2保存basePriority。旧v1不补造历史priority或用新PLAN_DEFS覆盖历史，保留原rank作稳定次序；执行预检可以使用当前安全Gate，不能重发新定义奖励。
6. **迁移不晋升。** SAVE18四原件补既有起始三英雄默认身份，不加属性奖励/CP、不调用promoteNpcHero。SAVE21合法hero/promoted保持；roster有ID而hero普通不抬升，hero明确promoted而历史列表缺ID不因名单缺口失去已保存身份。矛盾组合fail closed于新正式票/能力，单次迁移诊断和保留原事实的处理需定稿，不能renderer顺手修状态。
7. **失效有因果而非每帧事件。** 纯有效视图不写事件；真实死亡/重伤/驻守及后续presence/refusal reducer记录instanceId/npcId/reasonEventId/oldWeight/newWeight。一个原因幂等。事件窗口截断后仍由有限实例内去重水印或正式状态revision保留已发生因果，不靠反复扫描旧事件猜拒绝。版本2的持久失效字段与实际状态入口一起做，不先造孤立UI事实。
8. **已提交不重收费。** committed保留原选择与CP；执行时只接受该方案声明的现有人口替代/安全fallback，全部不合法则等待或记录无收益fallback。不能把某人的票失效当成自动切换另一项食物/药品奖励的理由。resolved只返回已结算记录；生活状态继续变化，但既有资源结算不回放。

**建议版本路径：** D2–D4、D8以及议程/执行规则变更要求登记新的内容/回放策略。当前数字contentVersion实际和CONTENT_SCHEMA_VERSION混用；最小清晰方案是CONTENT4与会议version2，同时在实例内保存v2策略。SAVE21可以暂留，前提是loader同时接受CONTENT≤4、meeting version1/2，新增字段按会议版本校验并有确定性迁移；原SAVE21/CONTENT3不能突然因新增必填被拒。若团队另拆内容包版本，必须先ADR明确二者分别表示什么，不能只换策略字符串却声称原contentVersion/input的hash应不变。

presence/refusal若作为下一切片正式必填持久状态，建议单独评估SAVE22 / CONTENT4或5，而不是在SAVE21内无合同地塞字段；最终是否升SAVE由兼容合同决定。所有version guard、默认对象、serialize/normalize/prepare、replay-harness和validator一起对齐。旧合法保存和其原字节证据保持，新增策略hash变化应新建预期和解释，不重写旧通过记录。回滚用上一兼容代码与备份保存/内容，禁止降低版本数字或删除会议来求通过。

## 缺席、拒绝、人口与岗位

lifeState当前只有healthy/injured/critical/dead；loader会拒missing/left（3029），normalizer会将未识别状态归健康/受伤（2933），`npcIsActive`只排dead。共享presence不是把该函数条件随手加两个字符串就完成：地图渲染、foodSituation、岗位、个人事件队列、战斗支援、继任、据点维护与保存都要使用同一事实。

最小共享域应有presence=present/missing/left、since/reason/return条件；refusal项有scope、目标command/proposal/instance、开始/到期/解除事实及reason。永久离营需明确剧情入口与恢复是否允许，不能从lastReport或截断的old orderRefused推定。死者不会返回；活着missing/left的成员保留在固定十人roster记录中，只退出当前营地人口/工作集合，不能从npcs数组删除或生成替身。

人口继续分livingRoster、workEligible、campLocal、garrisoned。驻守据点仍属livingRoster、占原人口，第一切片没有真实通讯时不作为在场票源；返回后最多恢复原票，不补后晋升票。远端参加必须由已实际投递的通讯/传令事实和工时/风险消费者解锁。当前workEligible只计healthy且不驻守（2318–2327），必须避免新增正式票函数顺便扩大工作或派驻资格。

日界目前先执行计划再assignMorningSuccessors（4222–4224）。“下一晨才会找到替代”不能在当前执行预检当作替代已存在：要么只用已存在actingRole，要么在同一已批准事务内分配真实替代后执行；不能跨顺序凭空借未来岗位。中途找不到替代保留vacancy和无收益fallback，人口<3首先走营地存在Gate。

## 食物信号、分数饱和与可行性

本次真实评分输入与设计卡相同，复现了紧张时全7票、断粮时采集0票。D2/D3让健康初始池变4票，但多案均支持时依然同票：减少长官/军士权重并不使采集自然进入前三。由于目前只保存前三，D7“不抽新候选”意味着没有入选的补采不能在该实例中突然被添加；危机席位必须在首次生成时决定，或者走另一个明确的安全再规划实例，不能借动态projection洗候选。

每项供给/医疗/科技/防线方案先声明：已有来源ID、可执行现有NPC/岗位、工时/占用与时段、材料/库存扣除、路线危险、成果/失败和幂等键。实际劳动/来源未接线时，blockedReason必须如实显示，safe-fallback不得自动发粮、药品、降低collapse或取消敌人。现有PLAN_DEFS的cost=1由提交当CP使用，不能误当成材料预算；affectedRoles与risk字符串也不构成劳动/可行性消费者。

断粮危机议程可采用设计卡的有来源保留席位，但须单独内容政策与多seed校准：即时核心失守可先防御，之后仍显示供给欠账；无来源则明确“无可行供给”，不能保底加2food。医疗危机来自真实未死亡伤员，轻伤/重伤、伤员在营地或据点、药草/医务岗位要分别Gate；只看lifeState!=healthy的计数不证明在场治疗已发生。

## 六视角评审

| 视角 | 合理性与本轮可实现内容 | 必须保留的后续条件 |
| --- | --- | --- |
| 势力 | 票源来自真实成员身份，外交建议不能变成虚构河湾援助 | 真实交易池、关系、签署岗位和来源消费者；外援不加入农场固定roster |
| 营地 | 缺粮与死伤投影可解释，冻结历史不冻结当下生存事实 | 真实供给/劳动/代修、核心存在Gate、没有主持或全零有效票的无收益fallback |
| NPC | eligible有建议、真实promoted有新会议票；小伤保发言、重伤保生存记录 | 明确缺席/拒绝范围与恢复；普通军士代主持不复制死者票权，驻守不瞬移 |
| 玩家 | 看见trust权限、原票/有效票、主持、冻结日期与危机解释 | 低信任真正Gate拒绝，同实例最多一次花CP；晋升后何时有票和blockedReason可见 |
| 敌人 | 岗位撤出/补采仍付防线和路线机会成本；评分不免除夜战 | 实际威胁/预警事实进入可行性，所有供给与发展计划保留风险消费者 |
| 全局事件链 | 晋升completed→后续新会议→有效失效→执行/fallback可以因果对应 | 策略与schema版本、来源ID、按实例幂等；不因reload/render制造迁移、失效或奖励 |

六视角条件通过之前，只能说票源与供给信号对齐，不能说十人完整链、自治饥荒生存、势力交易或最终尸潮完成。

## 建议下一轮顺序与验收

1. 等恢复主题浏览器门禁与其失败记录归档。负责人采用/修订D1–D8，更新L0 05/06/07、camp-plan-meeting-001、交接；登记旧会议策略/新版本ADR与缺席共享域后续ADR。
2. 独立票源切片完成严格hero投影、D2–D4主持/权重、D8食物信号、真实trust Gate、日实例冻结及新v2/legacy合同。加入已实现死亡/critical/据点的纯有效票、安全执行Gate，未接线拒绝/远端通讯明确待开发，不制造假状态。
3. 用本报告复現做真实源码回归：实际normalizer与promoteNpcHero、初始三英雄/eligible/stale、HP边界、生成前后晋升、低信任/重复commit、force/同日第二SUMMARY、原ballot保留/当前死人0票、legacy旧权重保存、缺票型与tier/status冲突、原选择已花CP、D→D+1真实日界和无来源fallback。验证失败保留输入/SHA，不能mock plan renderer。
4. 旧SAVE18四原件、原SAVE21 DAY/committed/resolved经过actual loader和两次writer/reload；无属性/CP/奖励补造。新增会议策略、原实例历史、effects/appliedEffects与事件水位分别核对。保存投影hash不是实际计划执行hash。
5. 真实浏览器验证角色卡晋升、计划原/有效票、低trust按钮、同日再遭遇冻结和翌日一次执行；fixture模式单列。再做真实供给与共享缺席/拒绝切片，十人/五日回放与多seed自治继续保留为v82出口。

本轮新增项目知识仅为本评审；无全局记忆变更。报告未改变 proposed 卡的采用状态，也未宣称任何新增实现/浏览器/平衡通过。

## 可复现源码探针

在仓库根目录的PowerShell运行以下命令。它读取检查器的完整VM函数，额外暴露真实规则，不执行原检查器后续测试、不写项目文件。输出源SHA及上述反例；输入修改只发生于隔离VM。该命令也固定依赖构造器SHA，检查器改变时应重新审查基础设施而不是直接沿用本记录。

```powershell
@'
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const t=readFileSync('scripts/check-report-recovery.mjs','utf8');
if(createHash('sha256').update(t).digest('hex')!=='ee5bb659c0439044e1ec07a4aecf931293457c2478f35d0850fe90770b4367cf') throw new Error('audit VM changed');
const prefix=t.slice(0,t.indexOf('\nfunction envelope(payload)')).replace("const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');","const root = process.cwd();");
await import('data:text/javascript;base64,'+Buffer.from(prefix+`
const r=runtime(); r.api.writeInitial();
vm.runInContext('globalThis.audit={create:createNpcState,normalize:normalizeNpc,weight:planNpcVoteWeight,score:planCandidateScore,food:foodSituation,generate:generatePlanMeeting,promote:promoteNpcHero,evaluate:evaluateNpcPromotion,execute:executePlanMeeting,life:syncNpcLifeState,defs:PLAN_DEFS,chains:NPC_EVENT_CHAINS};',r.context);
const a=r.context.audit, s=()=>r.api.state, out={sourceHash,scope:'TEST-ONLY full inline VM; checker DOM/storage/timer instrumentation; no browser'};
out.initialWeights=s().npcs.map(n=>[n.id,n.hero.tier,n.hero.status,a.weight(n)]);
const c=s().npcs.find(n=>n.id==='carpenter'); c.eventChain.step=a.chains.carpenter.length;c.relations.trustToPlayer=25;s().contentState.meters.campTrust=60;s().contentState.commandPoints=1;
a.evaluate(c,'TEST-ONLY audit');out.eligible=[c.hero.status,a.weight(c)];const p=a.promote(c.id);out.realPromotion=[p.ok,c.hero.tier,c.hero.status,a.weight(c),s().contentState.commandPoints,s().worldMeta.events.filter(e=>e.type==='npc.promotion.completed').length];
out.staleOrdinary=a.weight(a.create('carpenter',{promotedTier:'hero'}));
out.normalizedContradictions=[{tier:'ordinary',status:'promoted'},{tier:'hero',status:'eligible'}].map(hero=>{const n=a.normalize(a.create('carpenter'),{hero});return [n.hero.tier,n.hero.status,n.hero.activeSkill,a.weight(n)];});
out.hp=[100,99,30,29,0].map(hp=>{const n=a.create('commander',{hp});a.life(n);return [hp,n.lifeState,a.weight(n)];});
out.remoteWeight=a.weight(a.create('commander',{garrisonedOutpostId:'TEST-ONLY remote'}));
s().day=2;s().hour=8;s().minute=0;s().night=false;s().npcs=s().npcs.map(n=>a.create(n.id));s().food=2;s().contentState.meters.campTrust=20;s().contentState.commandPoints=2;s().contentState.commandPointsMax=2;s().contentState.commandPointsGrantedDay=2;
a.generate({source:'TEST-ONLY audit'});let res=r.api.commit('support');out.lowTrustCommit=[res.ok,s().contentState.planMeeting.status,s().contentState.commandPoints];
a.generate({source:'TEST-ONLY second SUMMARY'});out.regenerated=[s().contentState.planMeeting.status,s().contentState.planMeeting.playerAction,s().contentState.commandPoints,s().worldMeta.events.filter(e=>e.type==='plan.meeting.candidates').length];res=r.api.commit('support');out.secondCommit=[res.ok,s().contentState.commandPoints];
const rank=food=>{s().food=food;return {food,level:a.food().level,candidates:Object.values(a.defs).map(d=>({id:d.id,base:d.basePriority,votes:s().npcs.reduce((sum,n)=>sum+(a.score(d,n)>=30?a.weight(n):0),0)})).sort((x,y)=>y.votes-x.votes||y.base-x.base||x.id.localeCompare(y.id))};};out.ranking=[rank(2),rank(0)];
const meeting=s().contentState.planMeeting;out.frozenBeforeDeath=meeting.candidates.map(n=>[n.id,n.votes]);const commander=s().npcs.find(n=>n.id==='commander');commander.hp=0;a.life(commander);out.displayAfterDeath={commanderWeight:a.weight(commander),snapshotVotes:s().contentState.planMeeting.candidates.map(n=>[n.id,n.votes])};
meeting.selectedId='plan-repair-watermill-001';meeting.candidates=[{...clone(a.defs[meeting.selectedId]),validDay:2,ballots:[],votes:0,voteWeight:0,rank:1}];s().day=3;s().hour=0;s().minute=0;s().npcs=s().npcs.map(n=>({...n,hp:0,lifeState:'dead'}));s().buildings=[];s().resources=[];s().food=0;s().wood=0;out.noSourceExecute=[a.execute().ok,s().food,s().wood,s().npcs.filter(n=>n.lifeState!=='dead').length,s().contentState.planMeeting.status];
console.log(JSON.stringify(out,null,2));
`).toString('base64'));
'@ | node --input-type=module
```
