# Scenario boot C1：只读技术设计

状态：proposed；本文件只读审计后提出，未实现、未运行浏览器。依据 ROOT 当前 HTML SHA256 9edb6d3c3daa7ec63d90594381d811cb077828fd0955fb7095c601ce91b5b87b、research-adoption-plan 的 C 段、Scenario boot ADR。原调研只作设计输入，不作功能证据。

## 结论与切片边界

先接正常新局的 uint32 seed 与 world.foodMultiplier，复用 INITIAL_PROGRESS_STATE→纯 draft→installSavedPayload→公开 startFromSave；不另造 GameCore、配置编辑器或加载框架。此 C1 只能称“Scenario 初始配置真实绑定”，不能关闭完整 Scenario ADR：JSON storylet→完整 EventChainDef 编译/原子注册仍是 C2。C1 对事件目录只支持经核对的现有 authored v2 目录，明确 baseline-only；包不能暗示修改 storylet 已生效。若希望一轮关闭 ADR，就必须把编译和原子注册一起完成，不能用 C1 成果提升为 adopted。

## 当前真实锚点（dist/index.html，9edb6d3c）

- 1847–1878：state 作者基线；food=8，初始 berry 四堆 amount 为2/2/3/2（第一堆1857，扩展模板1327/1336/1339）。这些 amount 是剩余采集次数，berry 每次给food2（6953），不是库存份数。
- 1906–1924：WORLD_SEED/default snapshot/normalizeScenarioSnapshot。normalizer 会数值强转/截断配置，不能用来判未知请求有效；新增 binding 字段若不纳入其明确返回对象，会在 writer 和投影中丢失。
- 1937–1938：worldMeta.seed/rngState/replay.seed 都固定常量；2235真实LCG只读 rngState。未发现 Math.random 旁路。首次随机消费者在运行时外围生成、事件抽样、资源补生（4686/5008/6663）；初始敌人/地图是作者定值，换seed不代表初始敌人必然变化。
- 3248–3260：断粮v2仍由 SCENARIO_RUNTIME_STORYLETS 手写注册；scripts/fixtures/scenario-zombie-harvest-v1.json 目前不是来源。
- 2834/2869/3247：现有 validateContentDefinition/registerContent/registerContentPack 可复用语义，但最后者逐项写 CONTENT_EXTENSIONS，非事务；weapon/building还写基表/buildInfo。C1无新注册，不需要为它顺手重构全注册器；C2必须先准备完整表再提交。
- 3345/3459–3460：先补齐初始实体/社会/内容/任务，再冻结 INITIAL_PROGRESS_STATE；totalMinutes 修正为360。新局从这个模板 clone，不能重新调用含全局写入的 normalizer 来“构造”候选。
- 3562/3602–3614/3660–3664：真实 SAVE validator；snapshot.seed只要求整数、worldConfig数值可强转、aiConfig只验对象，未实现支持矩阵；worldMeta/replay也没严格uint32一致约束。
- 3761 selectProgressSave；3784 prepareSavedPayload：已有纯 draft 与 registryUpdates、迁移收据容器；3811保留保存 worldMeta（包括rngState），3812当前缺snapshot会补默认来源，需改成明确legacy-unbound。
- 3824附近 installSavedPayload 同步提交 state/EVENT_DEFS；3910 loadProgress 只准备，3933执行。8173 startFromSave 真正装载并开clock；迁移已具 SAVING/RECOVERY/savePending/migrationRecorded 重试机制。
- 3870 saveProgress 直接构造 writer，没有“buildProgressPayload”helper；save()成功不自证该payload通过validator。writer3877、selectWorldSnapshot2238都经过normalizeScenarioSnapshot。
- 3906 prepareRelayPlaytest 明确覆写seed/food且禁正式存档，必须维持隔离，不冒充正常boot。
- 3311 replay缺省仍用 wm.seed || WORLD_SEED。新局保证 replay 存在已避免正常0seed掉落，但该缺省仍应改为nullish/严格受支持seed；scripts/replay-harness.mjs435已有??，不能把离线trace runner当真实模拟器。

## 复用的最小合同

1. 构建产物嵌入一份冻结 package 和明确 bootOptions；正常新局公开按钮/Enter 消费它。首片可以不做GUI；那只证明部署配置生效，不能声称玩家已可编辑全部配置。不要把 MouseEvent 当 startFromSave 的配置对象，也不在运行中从 localStorage 或异步网络补初始化。
2. 一个纯 validate/resolve 核心供 Node 和 inline 使用。验证后才产生独立 draft：schema1/scenario zombie-farm1/content3/game精确兼容；seed 为 number整数0..4294967295；foodMultiplier为number有限0..2；ordinaryNpcCount只能10；未接线倍率只接受1，hard的1.3不能静默用standard。合法未选hard预设可作为目录，但选择它必须unsupported-config。未知字段、未知profile/capability/authority拒绝；所有observer authority路径只准expression_only，其余生成能力false。不能直接复用现三四项弱检查当执行安全门。
3. clone作者INITIAL_PROGRESS_STATE；仅新局写worldMeta.seed/rngState/replay.seed=seed；仅一次 food=floor(8*m)，每个初始berry.amount=floor(authoredAmount*m)。m0保留0/耗尽；m0.5应food4、berry1/1/1/1，不按总数一次取整。其他资源/种子/NPC/敌人/位置/未来补生/采集单次产出/配给/作物/事件cache全部不乘。m1默认与原事实一致。
4. snapshot保留现有兼容字段，新增显式binding对象（版本1、status bound|legacy-unbound、配置语义digest、实际appliedKeys、baselineOnly/deferredKeys、作者baseline标识）。digest用排序canonical内容，算法/版本声明；构建原包SHA与语义digest分别记录。normalize/validator/writer/projection一起认识该对象，不能写了被normalizer剥掉。无须提升SAVE21/CONTENT3，但必须增量旧writer合同。
5. 纯prepareFreshScenario的输出包括candidate/binding或明确失败，不改state/RNG/注册表/DOM/storage/timer。复用安装后的一次真实scenario.bound收据；收据应包含seed/轴/实际初值/语义digest，不能在validate/normalize发事件。先完成包与candidate全部校验，再同步安装。
6. 现8622设置handler会更改snapshot.aiConfig.observerCommentary；binding digest应清楚只约束初始配置，后续用户表达偏好保留为独立设置，不把合法设置切换误判包冲突。成功安装后应先完成首次正常writer/checkpoint成功，再解除START/启动world timer；storage失败用现有SAVING/RECOVERY/savePending重试思路，不提前跑世界、不重复绑定/重复缩放。区别“准备失败无写入”和“已安装但初次保存待重试”：后者不能谎称所有内存已回滚。空新局存储失败与已有旧档保全分别验；不要借新局失败自动清主档/备份。
7. 原子内容注册留到C2：不能调用逐项registerPack后看overall ok才决定；独立候选表验证typed ref、Gate/op/fallback/有限来源/冲突后提交。这里只复用已有函数及表结构，不新增框架。JSON编译未完成继续明确baseline-only。

## 旧档与历史

- 继续/备份/旧SAVE18只经selected payload→prepareSavedPayload，不执行fresh配置函数；当前部署seed/倍率变化也不重新缩放/播种。保留rngState、replay、所有库存/amount0/人口/死亡/驻守/时间/链/flag/历史/命令水位。
- 缺snapshot：加legacy-unbound描述，已知原种子来自saved.worldMeta.seed，绝不能补当前默认后声称已绑定。现有snapshot没有binding：原声明metadata保留为未核生效来源，不把它乘回世界；snapshot.seed与worldMeta.seed不一致也不能伪造“实际已用snapshot”。
- 新bound档检查binding版本/digest/所支持目录与seed三处一致；旧unbound档不追溯套新uint32规则丢弃此前合法旧事实。旧未实现AI字段必须明确降级记录或整份拒绝，不能悄悄赋权限；先保留原字节。
- 复用prepareSavedPayload.migration/save.migrated一次收据和失败重试；不能在纯validator发迁移、在恢复时执行onDayStart、发粮或补人物功绩。reload不重发scenario.bound、不重置随机进度。C2内容目录更换另需匹配定义/旧active版本合同，不能仅靠相同scenarioId。

## 六视角验收卡

| 视角 | 首片实际可验事实 | 不可夸大 |
| --- | --- | --- |
| 玩家 | 新局明确配置来源、真实food与有限berry次数；0粮能进入既有后果；失败有原因且不能假开始 | 配置生效不等于自然路线/平衡通过，不承诺完整GUI |
| NPC | 固定十人、岗位/生命/初始关系不变，个人用餐仍真实消耗共享库存 | 不按food轴补人或冻结needs，不加入知识授权 |
| 营地 | food一次缩放，真实午夜配给/生产/crops保持既有规则，reload库存不补回 | 初始压力轴不是全局粮食产出倍率 |
| 势力 | 现有势力/关系/据点不变，非支持外交配置明确拒绝 | 不把metadata/连续性描述称实际外交或跨副本记忆 |
| 敌人 | 默认实体/伤害/AI不变，未实现1.3敌倍率拒绝；实际LCG分支能展示seed影响 | 不保证不同seed每次结局都不同，不把resonance当真实敌压 |
| 全局 | package/HTML/input/time trace绑定，纯准备/同步安装、真实writer、重复启动/恢复无重应用 | C1不证明C2 JSON storylet loader、ActorObservation或learned模型 |

## 最小验证（真实source，非只测resolver）

- 空存储→公开start/Enter：seed0/最大值、m0/0.5/1/2实际三处seed和food/四堆amount；已知需要RNG的同命令/时钟轨迹两次一致；differentseed只选已知随机消费者作反例。
- null/string/bool/NaN/Infinity/负seed/越界/未知profile/未知worldkey/authority/生成能力/未接线倍率全部拒绝；初始state、registry、storage、RNG、timer全快照不变。
- 模拟包后项校验失败/候选失败，验证无部分应用。初次setItem失败与retry：尚无world interval、一次binding、无重复scale；现有主档/备份原字节不被拒绝流程删除。
- 原完整SAVE18、pre-snapshot21、existing-unbound snapshot21、bound21四组实际loader/writer/reload；以保存投影逐域比，不对writer不保存的prevX/facing等瞬态作假oracle。旧amount0/cache已用/死亡/驻守明确夹具。
- 部署默认seed/倍率变化→继续原档，rngState与资源不重算；未来binding/冲突digest拒绝且可恢复原主/备份。相同commandId不重复binding/初始设置。
- AI OFF/ON规则事实一致只表达不同；normal入口和PLAYTEST分别声明。先source合同，再exact字节实际Chrome；自然、三日和Sites发布另验。
- C2另要求受控修改JSON效果确实改变实际hook→Choice→reducer产出，注册失败不残留；未通过前本问题不能整体关闭。

## r3真实consumer补核

当前生产inline未发现新增遗漏的typed-event业务consumer：recordWorldEvent2461→applyQuestEvent3344只按当前QUEST_DEFS collect/repair/threat/relay匹配；FeedbackRouter3265仅存type；SAVE ledger3605接受非空type；replay仍npc.interact/npc.order。正常support fields/直接记忆仍由原reducer写。不是永久事实账本或通用actor迁移。

仍有两个真实方法consumer待单独适配，当前ROOT脚本原字节仍旧：browser-natural-mixed-v1.mjs337/338把第一谈当npc.interacted；browser-outpost-presence-v1.mjs183/185单E也等待npc.interacted。这是对新typed源必失败/失真的runner断言，不是应恢复空成功的运行时理由；root/browserowner外部新runner须第一谈明确dialogueOpened+0E0min，真正第二确认仍要求interacted+2E/真实15×rate/字段变化。旧报告保持旧源/runner范围。未发现新的生产任务、Gate、个人记忆依赖旧空npc.interacted的证据；晋升/relay handoff等分立动作仍不在本slice覆盖，不据此声称所有NPC入口统一。

