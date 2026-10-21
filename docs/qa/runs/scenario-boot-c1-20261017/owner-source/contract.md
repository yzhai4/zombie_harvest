# Scenario C1 r2 冻结交接

状态：外部候选/source owner自诊完成；独立120/120已通过，既有回归待负责人核验；浏览器未运行，ROOT未改。C2 JSON→EventChainDef编译/原子注册仍open。本文取代4fc候选的交接语义，但不改写其原source/report/contract/evidence。

HTML `scenario-c1-candidate-r2-20261017.html` SHA256 `a2fcdb647f2632fbf50f3ab0f3ba160f168082c602f6737c5ca4239eede137d2`。

模块 `scenario-package-c1-r2.mjs` SHA256 `ff69cb5e4a701a748d1741297a2c1fee8f2ac9dd95f6e7b8ac7dbdab3a90588e`；安装时扩展原scripts/lib/scenario-package-v1.mjs，不引入第二解释器。marker SCENARIO_C1_CORE_START/END与HTML逐字节一致；export块外。validateScenarioPackage/resolveScenarioConfig/createScenarioSnapshot保留；原storylet-definition-version错误码仍保留。原hard正例须改明确unsupported-profile，其他旧契约继续；scenario模块stableHash未发现外部import消费者，不替换replay/observer自己的同名hash，不改golden。

私有生成器 `implement-scenario-c1-r2.py` SHA256 `6b3ca4bbf99cf39f7c7f0bb0369ba51c04e576d0bd6f8e784b2e281a67d1fe1f`。依赖冻结4fc HTML、固定catalog、可变package-input JSON；隔离复制四文件重生成精确同a2fc。该生成器是候选重放工件，不安装为项目构建系统。

## 公共设置的真实政策

公开路径仍为开始界面startOverlay→openSettingsBtn→settingsPanel/settingsObserverCommentary→closeSettingsBtn→continueSaveBtn（或Enter）。开始后此面板被隐藏；不得用隐藏postboot emit充公开浏览器动作。

- 当前sessionStorage的observerCommentary只有严格boolean才优先；字符串/null/未知值不按truthy解读。
- 没有合法显式偏好时，UI默认读已准备的继续draft effective AI；新局读纯fresh配置。不能用无关初始state展示旧档设置。
- 未安装时change只保存用户偏好，不改原state或prepared draft；实际安装后、fresh/migration首次writer前应用到current aiConfig。正常bound继续也先应用，之后第一个正常checkpoint保存该值。
- 保持binding.initialAiConfig/configDigest不变；合法用户表达开关不是包冲突，也不授予生成事件/状态写入/actor知识权限。保存失败pending时已安装state可接受新的偏好；公开retry沿同draft保存，不reseed/重scale/重发binding。

## legacy seed表示政策

只对显式version1/status legacy-unbound允许旧合法finite seed（小数/-1/>uint32）。live snapshot.seed与binding.sourceSeed必须始终等于原saved.worldMeta.seed；原snapshot完整声明（含不同seed）只放binding.declaredSnapshot。wm.seed/rngState/replay/库存/人物/时间/内容事实不重算，不coerce >>>0。

normalizer/writer保留此legacy有限值；validator限定状态/版本/shape/source关联。新bound/fresh仍uint32且snapshot/wm/replay seed一致，rngState允许真实消耗后的不同uint32。未知future binding/schema/status或冲突来源拒绝，不能借legacy通道吞掉其他坏业务块。

真实迁移收据仍由公开boot在一次save.migrated.payload.scenarioBindingAdapters写出，新增seedSource=saved-world-meta、declaredSeed（无声明为null）、liveSeed说明；纯validate/normalize/prepare不发事件、不写保存。旧AI完整声明仍为provenance，effective生成能力false、expression_only，合法observer偏好保留。原SAVE18独立clock sentinel适配不改。

## 独立固定catalog与真实consumer

4fc生成器曾由可变package.events同步生成SCENARIO_C1_CATALOG，构成同源expected漏洞。真实负控在副本把forage food effect改3再运行旧生成器：validator/start/Choice均成功，declared3，但registered2、实际food只+2。原audit/native及错误arity的首诊断均保留，未把首诊断失败当玩法结果。

r2改为独立 `authored-catalog-v2.fixed.json`（SHA256 `9a34f4e6069472c6504ebe4f9390d74cb891b3349566e7d0b84bd7c8578ef633`），生成器pin原字节，不取可变package.events做expected。pure core只认此catalog。公开start安装前另只读核真实registered断粮definitionVersion/repeatable/触发Gate/阶段/hooks/Choice requires+effects/两条fallback效果，并核relay EventDef实际存在；实际authored规则变3同样拒绝，不靠包expected自证。

相同变更JSON→跑新生成器的负控：unsupported-event-catalog/真实start scenario-boot-invalid，fixed2/registered2，state无变、storage0、worldTimer0。JSON没有被编译，C2仍未完成；拒绝受控变更本身不证明未来全包compiler。

## C1原范围保持

部署嵌入package/options，无配置GUI；seed uint32含0，真实LCG/CommandBus replay缺省保留0。food倍率0..2只对fresh库存8与四堆berry次数2/2/3/2分别floor一次。新资源amount2、每次berry给food2、作物/配给/藏粮/其他资源/NPC/敌人均不scale。standard唯一可运行profile；其他倍率只基线1，固定10人，未支持能力拒绝。

沿既有fresh draft→serializeNpc保存投影校验→同步install→一次scenario.bound→首save成功再worldtimer。初存失败为已安装但RECOVERY冻结、savePending公开重试；不能称内存从未安装。准备失败则无state/registry/storage/timer增量。继续旧档不执行fresh；reload不补库存、不重播seed或迁移奖励。Semantic FNV UTF16 canonical digest与原包SHA256分列，不作签名认证。

## 六视角与实际证据

玩家：公开设置所见等于安装后实际表达偏好、初始化失败可重试；不声称完整GUI/自然三日。NPC：固定人口/岗位/伤亡/需求不改；无知识授权。营地：只初始有限粮食轴，旧耗尽/cache不补，未来生产不放大。势力：关系/据点/连续性不新增。敌人：原实体/AI/伤害，未知倍率拒绝，不把共振当敌压。全局：同核/来源/实际消费者/保存重试与历史保持；C2、ActorObservation、全局时钟和异常事务均未关闭。

owner-c1-source-diagnosis-r2.mjs实际63/63 exit0：保留原52项，加真实开始界面fresh true/bound continue false/legacy true三路径；六种legacy finite×有无不同声明；authored实际规则改动拒绝；旧version诊断兼容。真实四旧SAVE18、完整5fdd、RNG消费者/生产不scale/失败重试/seed0/声明保全均包含。报告 `owner-r2-output/owner-c1-source-diagnosis-r2.json` SHA256 `8c9b4ddeca22afb94871bfc4b4f81af82a64e0b27fc442099720684b484e53f1`，完整新native sidecars在同目录。

原4fc独审115/120和9ed1/120负控仍归属其冻结source/runner；不转移为本版绿色。新120已实际120/120 exit0，报告SHA256 70289f3dcbdb3e3a1b83cd53fb015c88288726d87274810319f72c9f6dca55e4；既有40命令与真实Chrome由独立负责人执行。本次没有浏览器/自然/生产通过结论。
