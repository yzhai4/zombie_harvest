# Scenario初始绑定C1验收

开发源码`d65924431932d63ccfa6cb3da12f38fd126cd39c`，HTML`a2fcdb647f2632fbf50f3ab0f3ba160f168082c602f6737c5ca4239eede137d2`，SAVE21／CONTENT3。PR #4；完整boot ADR仍proposed/open，C2 JSON编译及原子注册未实现，生产未部署。原调研SHA940efac9…已复核归档一致，属于设计输入。

新局从冻结包/选项经共享纯核心与真实入口一次绑定uint32 seed（含0）和初始food/berry剩余次数0–2倍向下取整；未来产出不缩放。首存成功前无世界timer；失败保留已安装且冻结的同一draft，公开重试不reseed、不重复绑定。旧完整writer不重算世界；legacy-unbound seed/sourceSeed记录真实旧finite seed，原声明完整另存；未知future/bad binding拒绝。公开观察者偏好在install后、first writer前生效，initialAiConfig/digest保持。

| 本构建证据 | 实际结果和范围 |
| --- | --- |
| 源码/核心 | pure14；独立及本地同版boot120/120，原报告同SHA70289f3d…；35份输出经实际validator复核。四SAVE18与六SAVE21原writer分域保存 |
| 既有合同 | 40 unique完成，44次执行中40 exit0、4原方法失败保留；仅将旧zero-migration假设适配为精确一次Scenario迁移，原业务断言保留并加command/seen水位。plan48/UI69/attention29/shortage43重跑通过，其余36不重复 |
| 实际Chrome C1 | 8场134/134，0errors；15 main＝5 canonical与10各自SHA变体。默认button/Enter、seed0、food半量、三独立真实旧档、first-save失败与真实2600ms冻结/重试。23stored与1failed-attempted分开；三legacy是joint部署变体，不移用到canonical |
| 受影响Chrome | NPC112、crop35、shortage72、rest93、presence37、episode12；连同C1共495检查，70 main按自己场景SHA核。Rest是6场verified加hidden尝试unavailable，不称第7场已通过；episode raw没有cleanup字段，关闭来源另列finally/execution收据 |
| 公开归档与方法 | C1独立审计8d06ae27…；329 browser工件/42冻结依赖逐SHA核，62份C1 raw与公开副本同字节。crop仅参数路径使用明确portable companion，原raw私有保留；不改原失败或把derivative叫原件 |
| fresh08短路线 | 全新零保存注入，7/7公开覆盖、16/16，49.784s、day1 09:13／HP100／E66／SAN75／food13／十人活／collapse0。未覆盖玩家战斗、主动遭遇、成熟收获、夜间或三日；native有旧塔对白天wz-1累计10次伤害并击杀，不作为新建塔效能或战斗路线验收。Canvas观察/跟近0次 |

seed0变体`5b42712be7625de5298b8fee3293cc34903218b2479d756ca4daffaa6f076083`，half`c2f808467e71bcc3b8bd90a566d7d878370ab3a2808385a8717ab23ca56d3adb`，joint`ba0ce212910d8c50ca6cf911790d98468e971f5ab7bd4ca8a617574e747a3340`。仅声明的boot-options行变化，各自响应和保存分别归属，不是玩家配置GUI。

观察者ON/OFF已验实际同步consumer enabled/mode/authority及调用前后投影/保存不变，但这是TEST-ONLY literal probe，不代表NPC对话、角色知识授权或LLM已接入。FNV digest是语义版本标识，不是加密认证；包原字节SHA另记。C1原生browser report作为附件与独审证据保存，现有manifest主browser继续使用它明确支持的episode12，不改native结构迎合validator。

原9ed同方法1/120主要表示缺C1能力，不是119旧游戏缺陷；4fc115/120暴露3公开偏好与2旧seed说明。原生成器还可让包和expected同源漂移；现用独立冻结目录并核真实注册Gate/effects/fallback，改包效果明确拒绝，仍不是C2编译。详见negative-index与catalog-counterexamples。

六视角：玩家设置/代价/拒绝可读；NPC固定roster、岗位和旧伤亡保持；营地初值一次、耗尽保留；势力与连续性不凭metadata添事实；敌人默认规则保持、未支持倍率拒绝，实际后台塔伤害另有原账本；全局seed/receipt/配置/迁移/首存可追溯。root目视C1公开ON设置和首存失败冻结两张，不声称看过全部截图。

下一为[C2实施备忘](../research/scenario-boot-c2-implementation-plan-20261017.md)：完整JSON→现有定义→候选目录纯校验→同步一次提交，删除手写旁路；先解决早于start的旧档查询依赖、已知C1 digest兼容和finite source语义探针。ActorObservation随后；自然三日、平衡、全局fractional clock、继任双岗、来源回执、最终尸潮/移动端/生产另验。

本轮L1为C1绑定ADR与三个问题记录；Skill/工作流新增公开consumer、旧事实/声明、独立目录与首存冻结教训。无全局记忆写入。

Manifest传输适配：首次本地Gate为29/30，因crop companion封装层没有顶层runner。原companion/raw均不改，新增明确flat adapter，除声明transport元数据外与companion.portableReport深语义全等；沿用真实35项结果而无新执行。其SHA/原raw SHA和原因在manifest单列。

Fresh08只读独审20/20（原运行16项不替换），52原工件含18完整writer全部经实际a2fc validator且VM未start/advance；绑定恰一、无迁移、预算和真实父子收据均核。三main为原runner实际response.body哈希记录，未另留HTTP body副本；原source/server路径及SHA独核，不虚构独立网络重放。新transport审计核adapter/companion/private raw除参数深等；无新browser执行。
