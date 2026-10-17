# NPC 近身查看：当次直接视线报告

**稳定 ID：** `npc-direct-sight-observation-v1`。  
**运行时 policyVersion：** `npc-view-direct-sight-v1`，不与设计 ID 或 `npc-first-talk-self-v1` 混用。  
**状态：** 本特定 policy 的列明开发验收已完成；完整ActorObservation继续proposed。实现／失败／验证范围见[本轮QA](../qa/npc-direct-sight-v1-20261017.md)，下文拟议表述保留设计时语境，不扩为完整系统交付。  
**日期：** 2026-10-17。  
**当前核对基线：** `dist/index.html` SHA-256 `c42056ed08c9cbc0e27c09365828fae5d1c19dc25190e9e19d2e3beffa45bc91`，SAVE21／CONTENT3。  
**实现构建：** HTML `23b8c8c27234592673aa927f3909ea49247c372a937787f90355f87531f421b0`；near≤2／farther>2、critical仅此topic未知、个人trust≥-10、工作预算与双入口生命周期均按本卡冻结，没有增加保存域或LLM。  
**关联：** [完整 ActorObservation 提案](../decisions/ADR-20261017-actor-observation-v1.md)、[已验收 self 卡](npc-self-observation-v1.md)及[self QA](../qa/npc-self-observation-v1-20261017.md)、[NPC 公开动作合同](../decisions/ADR-20261017-npc-public-actions-v1.md)。

## 玩家价值与设计选择

玩家靠近纪宁查看状态，可以听到“我看见一只快速感染者，离我很近。”。这句话必须来自纪宁此刻实际的直接视线，不是全图敌人列表、旧锁定目标、别人共享的坐标或作者预写的危险。玩家据此决定先处理风险、再观察、离开或暂缓耗时行动；本片不替玩家攻击、不自动请求支援，也不保证纪宁会接战或能够保护玩家。

这是一次有来源的近身口头侦察。NPC 有权直接看见、且本次允许向玩家披露的敌人，可以成为玩家的新信息；不额外要求玩家此前已发现该区域或已在画面上看到该敌人。L0 [世界法则](../../剧本/尸潮农场/01_整体世界观与叙事法则.md)、[NPC 体系](../../剧本/尸潮农场/06_NPC英雄晋升与普通NPC体系.md)和现有人工哨报／预警允许这种来源。信息通过角色报告传达，不把地图区域、迷雾、地标发现或战斗锁定改成已知。附近角色也不是全图侦察台。

曾考虑只确认“我现在看得见你”，它能测朝向与 LOS，却几乎不增加玩家决策信息，因此不作为主要交付。也不把“玩家画面已显示”与“NPC 有权知道”强行取交集；当前 Canvas 与 DOM 的迷雾处理差异是独立展示问题，不是取消合法 NPC 侦察的规则依据。

## 当前真实调用路径与缺口

以下行号只对应上面的 c420 基线，不代表本稿已改代码。

| 当前入口／函数 | 已有行为与下一片应守住的边界 |
| --- | --- |
| `renderContext`，`dist/index.html:6258`，NPC 分支6306–6325 | 为附近 NPC 提供带 `data-npc-id` 的查看和付费按钮；context 范围不等于 NPC 自身视野。不得把 renderer 中首个附近对象代替点击时的同 ID 对象。 |
| context click listener，8977–8991；`renderSurvivors`，6454–6475 | context 的 `npcView` 和近身名册卡都实际调用 `viewNpc`。名册里存在角色不授予远程报告资格。新报告必须到达实际可见入口，不能只有导出 API。 |
| `npcPublicActionGate`，7486–7511；`viewNpc`，7547–7556 | 查看按 DAY、同一 live 身份和距离≤1.25核准；`viewNpc` 仅写既有选择 UI 并给普通状态 toast，不开支援确认、不支付、不推进。点击时再次核准，旧控件不构成授权。 |
| `perceptionProfile`，4664–4685 | 实际读取身份、已有支援／命令、fatigue／stress／energy、SAN及 online relay 修正。没有 caller 自定 profile；不借 NPC 名称、暂代岗位或玩家 trust 扩视距。 |
| `hasLineOfSight`，4687–4696；`canPerceive`，4707–4715 | 实际检查视距、wall／spikeWall采样遮挡和视锥。不会自行核角色死亡／驻守，也会经过宽松数字转换，因此可信适配器要先核严格来源和字段。不能宣称已支持所有建筑遮挡或听觉。 |
| `facingVector`，4698–4705 | NPC 用 `motionTarget || goal` 的方向，静止默认向下；不是 sprite 的 `npc.facing`。本片沿实际规则，记录视觉朝向可能不同这一限制，不修改 AI 或把画面朝向当授权。 |
| `perceptionTargetsForNpc`，4716–4719；日间敌人／生成，4773、5035–5064 | DAY 源是当前 `state.worldZombies`；当前生成类别为 normal／runner／brute。旧保存校验3816并未核所有 kind，因此新适配器仍须严格核类别、身份、坐标与生命，不把未知 kind 默认为普通僵尸。 |
| `updateNpcPerception`／`sharePerception`，4720–4751 | 会写 contacts、锁定、行为、报告及共享，不能为了只读查看调用它们。当前 targetId 可能来自历史共享，不等于本次直接看见。 |
| `npcStateSummary`，4425–4432；E预览6239、名册6471–6472 | 旧摘要含 raw targetId／profile 值，名册还含 lastReport，并可能经态度 helper 归一化。新响应不复用这些文本作事实或权限。c420 的 `viewNpc` 普通 toast 已主动避开此摘要，应保留；全局旧展示消费者的清理仍单独开放。 |

## 主交付：一次查看、一个当前目标、一条有界报告

只支持 DAY 中固定营地 roster 的一个近身 NPC，在原 `view` Gate 成功后，作为本次观察 actor。audience 是实际玩家；subject 是该 NPC 当次确实直接看见的一个日间敌人。内部捕获接受 Gate 返回的 live NPC 引用，不接受外部 actor、target、trust、profile、role 或 policy。姓名取同一 NPC 的既有 UI label；敌人类别只能取固定本地映射，不拼接自由文本。

拟议顺序为：

```text
公开查看（同 ID 重新核原 view Gate）
  → 私有可信适配器核 actor／阶段／实际感知输入
  → 实际 canPerceive 对当前 live 日间敌人求直接视线
  → 纯知识投影（最多一个受支持目标）
  → 实际 NPC→玩家信任的披露交集
  → 固定文本与“本次所见”可见行
```

不新建查看命令或事件；不把结果包装成支援成功。原首谈 self、确认支援2E／15分钟、status inquiry、命令、自主拒绝与真实推进中断保持原业务合同。E 的首谈不改为侦察按钮，不扩大 `npcTalkOpen` 或幂等语义。

### actor 与可信输入

- 同一 live 引用、固定 roster、唯一 ID、合法正生命和一致 lifeState、有限合法坐标；驻守需核自身标记与 outpost.guardNpcIds 双向一致，冲突不当作营地在场。
- 新 direct-sight policy 拟沿完整 ADR 的保守提案，对 critical 保留 self-only；这只使新报告降为不可确认，不能禁掉原查看／免费首谈或改原作战准入。injured 不因名称被一律禁用。该新策略须实现前明确冻结，不能冒称当前运行时已有此限制。
- 拟先严格核实际 profile 会读取的 fatigue／stress／energy／SAN、supportRequested／订单及 online relay 必要数字和结构；缺失或坏值不由默认需求、`Number(x)||0` 或默认 SAN 生成“正常视野”。不调用 ensure、态度、归一化、需求或感知更新函数来修现场。
- 视锥方向用原 `facingVector` 实际来源；motionTarget／goal 若存在须是有限合法点。沿当前身份／命令的实际 profile；暂代岗位不会额外继承原岗位的视野、私有记忆或指挥权限。本片不宣称已统一全局有效岗位语义。
- capture 要绑定实际 `SessionController.generation`、worldMinute、eventSeq、motion.stepIndex 和 DAY；不能从调用者声明阶段或用新常量伪造 freshness。不读宽 `WorldFacts.snapshot/current/entity` 来方便填满 DTO。

实际在线 relay bonus 的旧保存合同仅要求非负，不提供现成80之类视距硬上限；不另写shadow profile。严格核实际来源后，使用原 `perceptionProfile` 的真实结果，要求sight有限且>0、cone有限且处于0…360；正常作者和合法relay仍按原结果求视线。

本拟议policy明确采用以下私有工作预算，它们不是已有世界上限：

| 捕获／计算项目 | 新适配器拟议上限 |
| --- | --- |
| 实际 worldZombies 条目 | 64，含需要拒绝的条目也计入输入工作量 |
| 实际 buildings 条目 | 128；原数组顺序、AABB与wall／spikeWall判断保持，不重排或只复制墙 |
| 实际 outposts 条目／总guard ID条目 | 16／64；roster仍按实际固定十人核身份，不由此造新人口 |
| visitedRegions／landmarks／其它region集合查询 | 0；无需玩家发现地图作前置或副作用 |
| LOS containment预估总预算 | 262144；用下列现有算法的成本上界预检 |

对可能进入LOS的严格合法候选（距离≤实际profile.sight），累计 `2 * max(0, ceil(2 * distance) - 1) * buildings.length`。它对应现有 `hasLineOfSight` 每个中间采样点最多两次getBuilding全表查找的保守工作上界，不是替代LOS的可见性判定。严格36×24地图坐标使单条真实LOS的steps≤87，但仍须有总预算。全输入／预算先预检，超出统一unavailable；不能只取前64个后说已找到最近敌人或没有敌人。

实际候选一遍扫描，每个合法候选至多一次原canPerceive，用流式最小值选一个目标，无重试或强制感知刷新。LOS所读建筑的类型、坐标、可选宽高与实际AABB需严格有效，不能让坏数字或fallback伪造“没有墙”。不扩展原遮挡规则，不改变首个AABB匹配语义。预算拒绝只使这次新报告unknown，不限制生成／建造、不截断或重写旧档事实，也不承诺已经实测的毫秒性能；未来提高预算需另版本与证据。

### subject 与有界知识

从实际当前 DAY 的 live `state.worldZombies`／原生候选路径读取，不从 contacts、`perception.targetId`、lastReport、memory字符串、visitedRegions 或模型指定 ID 反查补事实。每个候选先核是当前列表的真实对象、唯一稳定 ID、支持的 kind、有限正 HP／maxHp 和地图内坐标；不重定位、不补字段。坏候选没有报告资格；其存在、数量或具体拒绝原因不对外输出，其它合法可见候选仍可参与选择。

对严格合法候选使用实际 `perceptionProfile`／`canPerceive`／LOS。只在直接看见的受支持目标中选距离 NPC 最近的一个，距离相同时按 ID codepoint 稳定排序。输出上限一个，不公开扫描总数、未选中目标、精确位置、原始 ID、HP、最大生命、攻击状态、AI goal／intent、路线或未来威胁。它不是“附近只有一个敌人”或“全图最近敌人”的断言。

| topic／事实 | 拟议支持 |
| --- | --- |
| `direct-sight-threat`：normal／runner／brute 的粗类别 | 仅当次实际直接看见的一个 live 敌人；分类沿当前已存在视觉／报告命名。 |
| 敌人与该 NPC 的距离 band | 拟定 `near` 为≤2格、`farther` 为>2格；这是本卡新的表达分档，不是接战范围、AI距离或新视距。实施前冻结该展示边界；不输出实际距离。 |
| 当前目标不在视锥／被现有墙体挡住／超视距 | 不生成肯定报告；统一中性界面结果，不宣称无敌人、无人看见或附近安全。 |
| 玩家、其它 NPC 的伤势／需求、地标、物品品质 | 本片不支持；不从目标全局对象顺带读出。本人伤势继续走已验收 self 路径。 |
| 已存 contacts、sharedUntil、传闻和历史公开事件 | 本片不支持；即使未到期也不能升级成“刚看见”。不清除、不续期、不回填。 |

可信侧可保留内部 subjectId 作为当前捕获的来源关联，但不能将它、全局列表或精确几何提供给表达层／模型／新 UI。最小可披露 facts 只有 category 与 distanceBand，provenance 明确为 actor 的 direct-sight 和本次 revision；纯结果深冻结且脱离原对象。hash 若实现，只用于绑定本次 actor／policy／revision／事实，不是世界授权证明，更不取代 live Gate。

### 信任与固定文案

先有知识，再做披露。沿 self 使用的真实 `npc.relations.trustToPlayer` 方向：有效且有限的-100…100，默认0不设额外刷关系门槛；拟定≥-10可披露，低于-10或关系非法不披露。campTrust、alignment、进度、AI开关及调用者给出的高 trust 不能增加知识。低信任也不把已知知识改成不存在；非法关系不编造不信任心理。若将来采用不同门槛，必须先改本卡合同而非复用默认0归一化。

| 可披露事实 | 固定角色句 |
| --- | --- |
| normal／near | 我看见一只普通僵尸，离我很近。 |
| runner／near | 我看见一只快速感染者，离我很近。 |
| brute／near | 我看见一只装甲僵尸，离我很近。 |
| 同类别／farther | 我看见一只〔对应类别〕，离我还有一段距离。 |

显示 `NPC姓名：角色句`，并有“第X天 HH:MM · 本次所见”的界面标记。距离以说话 NPC 为中心，不写成离玩家很近。小字可用“只是这次查看得到的线索，未提及不代表没有危险。”，不承诺安全、追踪或救援。

没有肯定可披露事实的各分支统一为不归于 NPC 发言的界面文字：“这次查看没有得到可确认的视线报告。”。不说“周围没有敌人”，不说“我不信任你”，不暴露是对象缺失、LOS、疲劳、critical、过期联系或披露门槛中的哪一项。具体诊断仅留可信 QA／开发侧，不能借错误文案／raw ID 形成隐藏存在性侧信道。

## 可见呈现与时效

保留 c420 `viewNpc` 原状态 toast 的内容方向、普通 class 和1800ms；它仍是 self 专用长提示之后的真实普通提示复原入口。新报告在同 ID 的既有 context 查看区增加独立可换行行，名册入口则在当前可见的同 ID 卡中呈现同一已披露文本，不建新模态窗或命令菜单。若仅交付其中一个可见入口，另一入口必须明确列为未覆盖，不能把 DOM 已写但被遮挡称为玩家可见。

报告节点应放在既有 `contextPanel`（1103）内、`contextActions`（1105）之外；不能借每次被覆写的 `contextHint`（6403）缓存报告，也不为显示报告主动调用 `renderContext`，其6313仍可能执行晋升评估。名册同 ID 节点也只消费已经披露的文本，普通重绘不得重新调用感知或表达。

点击时捕获一次，不在 `npcStateSummary` 或所有角色的每帧 renderer 中新增 capture。允许只把**已披露文本、actorId、as-of revision**作为临时 UI 展示保留；不保留 raw capture／knowledge、候选列表、目标坐标或原对象引用，不新增 GameState／保存域。这个小型 UI 展示不是持久记忆，也不能作为后续决策授权输入。

同 actor 的普通刷新不能立即抹掉此行，使它只出现一帧；应在同 NPC／同 session 的仍合法可见容器中保持可读。新查看替换、context关闭／切换目标、角色失效／离营、session generation／阶段改变、reload 时清除。重新显示旧容器不能复活旧会话报告。世界继续运行时保留“本次所见”的过去时标识，不自动冒充当前持续看见，不用旧 capture 刷新时间；再次点击才重新求本次事实。具体 DOM 生命周期与实际 renderer 节拍需架构核对和真实布局验证，不能仅用节点存在作证明。

新响应自己的 text／普通 toast 不得旁路披露后再展示 raw targetId、旧 contact 或 lastReport。c420 原 `viewNpc` 已避开宽 summary，不能在接线时重新引回。既有 E预览／全局名册摘要仍含历史 targetId／lastReport，属于单独开放的旧展示边界；本片不能宣称全 UI 已实现 Actor 权限。若 root 决定同片清理这些相邻消费者，应另列实际受影响文案与等价回归，不能以“不属新行”掩盖本次新权威响应自己的泄露。

## 六视角账本与路线

| 视角 | 玩家可见价值、来源与限制 |
| --- | --- |
| 玩家 | 获得附近可信 NPC 当次实际所见的敌人类别与粗距离；可以先自卫、查看地形、离开或暂缓耗时行动。看报告无新体力／时间／关系收益，知道风险不等于有新命令。 |
| NPC | 只有同一人在当次真实视野内的事实；本人记忆、盟友共享和临时岗位不冒充目击。关系只减少披露，不增加视距；没有看到不伪造安全判断。critical策略只限定新报告，不回撤既有自述。 |
| 营地 | 不增人口、物资、治疗、岗位、CP、配给或劳动；报告不自动派兵、停敌或暂停日程。无人报告、人口不足或缺岗时保持原自治／降级。 |
| 势力 | 没有全图网络或外部势力秘密；个人 trust 不等于营地声望。在线中继只按已有感知修正起作用，不凭空生成预警奖励或成为近身报告的强制前置。 |
| 敌人 | 真实敌人保留 kind、HP、AI、速度、朝向与伤害；只有实际直接可见的类别／粗距离可披露。不改迷雾、不锁定、不把敌人本来意图当已知。 |
| 全局链 | 没有新 EventDef／奖励节点、事件完成事实、contacts刷新、RNG、时钟或保存迁移。纯组件与原 view 的 UI 写入分开；原首谈、支援、中断、死亡和回放语义保持。 |

保守路线是读完后不介入，原世界照常继续；冒险路线仍是玩家自行选择已有攻击、移动或支援，原成本和后果不由文字担保；无人查看时 NPC 的既有感知／共享／日程照常，不新增主动播报。死亡、失踪、驻守、拒绝合作、缺人、夜间与过期都不得产生 fallback 奖励或新居民。

本卡不是新 NPC／故事节点／Scenario 包定义：`NPC_STORY_DEFS`／固定模板仅作身份来源；`NPC_ROLE_DEFS`／outposts只作在场与身份约束；已有建筑只由原 LOS 读取墙体遮挡。`EVENT_CHAIN_DEFS`、`WEAPON_DEFS`、`TECH_NODE_DEFS`、`BUILDING_DEFS`、`FACTION_DEFS`、`OUTPOST_DEFS` 不新增定义、效果或权限，不为表达改 C2 JSON。若后续改为任务／奖励，须另交内容包与完整效果合同。

## 旧档、纯性与重复

不新增 SAVE21／CONTENT3 域，不保存观察摘要、对话历史或接收 receipt；不迁移旧 contacts、不延长期限、不补过去目击。旧合法但本片不足以确认的输入保持原存储，原查看／self可继续；新报告只保守未知，不归一化成正常人或普通敌人。

相同真实状态与 sourceRevision 得到确定结果；再次公开查看允许观察已经变化的世界，不发奖励、命令、记忆、promotion 或 checkpoint。原 view 的选择 UI 与新已披露 DOM 文本可以变化，不能把整个查看称为零 UI 写入。capture／project／披露／表达自身须对完整业务 state、storage、RNG、registry、事件／命令水位和 timers纯读，无 ensure／render／save 的隐性副作用。这里不新建一个“重复 commandId”合同来绕过原无命令查看。

## 待验出口与具体反例

以下是下一片必须设计验证的出口，不是本稿已运行结果，也不预填通过数量。

- 公开 context／名册同 ID 查看确实显示固定报告，至少桌面与390宽完整可读；普通toast仍按原短提示复原，self首谈长提示／2E15min支援等既有合同不被换掉。
- 一个真实 normal／runner／brute 敌人在 NPC 视锥、距离与现有LOS内；类别和以NPC为中心的 band正确。玩家尚未发现敌人所在区域也可得该合法报告，但 visitedRegions、地图／地标发现、战斗目标、世界库存和存档不因查看变化。
- 其它条件相同，仅把真实 NPC 朝向源改为背对／敌人放到视距外／用原 wall或spikeWall挡住实际采样路径，应不报；没有可报目标不能说安全。其它建筑未被原LOS处理时如实列现有规则限制，不拿测试命名伪装成完整遮挡。
- stale targetId 指向墙后敌人、未过期 shared contact、当前NPC从未看见但玩家地图已见、另一个NPC看见、远处隐藏敌人都不能越过本次实际直接视线。多个直接可见目标只报一个，稳定选择；不泄露总量或非可见目标信息。
- trust0／-10／低于-10和非法关系的 knowledge／disclosure分开；高trust、AI ON、caller伪造profile或actor不能让看不见变成看见。直接knowledge有效但不披露时，与无可报告知识的外部中性结果一致。
- detached／重复ID／死亡／单向驻守冲突／旧life与HP矛盾／坏坐标／坏profile来源／未知kind各自不被默认化。critical保留原查看与免费首谈但按本拟议topic降级；不改其它作战能力判断。
- 候选／建筑／outpost／guard条目及containment预算在边界和超限输入分别核；大但有限的合法relay不被任意视距80硬闸替换，实际profile不可用或预算超出时只拒新报告，原查看与旧世界保留。不只验截断后的前缀，也不由unknown推断无敌人。
- 查看后敌人移动／死亡／NPC转向或重载：旧行只表示as-of、不可作为新事实；新点击重算；不同NPC／generation不会复用旧行。实际renderer连续刷新下行仍能读，不是只显示一帧。
- 完整旧writer经真实loader、查看、writer、reload不增保存域、不重获奖励、联系人不续期。组件纯性独立核完整业务水位；source-VM、TEST-ONLY预启动完整档浏览器、自然游玩分别留来源，不能由 self 或旧浏览器绿色推定本片完成。

## 开放范围与实现前决策

实施前须冻结：distance band展示阈值、critical self-only的明确policy、profile严格字段及上述私有工作预算实现合同、两个现有入口的可见DOM位置／生命周期和新响应旁路文本边界。它们是本 proposed 卡的设计决策，不能留到测试失败时隐式调整。

完整 ActorObservation ADR继续开放：contacts逐项TTL／source真实性、shared-contact接收与历史保存、公开事件可见性、有效岗位／继任权限、其它NPC／物品／地标观察、REPORT／夜间策略、通用actor请求、模型隔离和后续NPC规划／记忆均未交付。`ZombieHarvestObserver.project/comment`仍是兼容纯表达API，不是角色世界授权；不接LLM、不扩大现有接口为模型可调用工具。此片只提议把一个有决策价值的直接视线事实接到真实公开消费者，既不关闭完整ADR，也不以扩API代替玩家可见结果。
