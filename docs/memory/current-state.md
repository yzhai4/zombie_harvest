# 当前状态

本文件只保留最近已核检查点、本轮执行和唯一下一交付。此前完整状态按原字节保存在[58ea426历史快照](current-state-through-58ea426-20261019.md)，其中“下一步”和剩余预算只属于当时；不得覆盖这里的新事实。

## 最近已验证开发检查点（2026-10-19）

开发分支为`codex/v82-npc-succession`，draft [PR4](https://github.com/yzhai4/zombie_harvest/pull/4)。最新实际核验检查点为[935edf5](https://github.com/yzhai4/zombie_harvest/commit/935edf5934c91c8498b07c79cde94f572c98a6bd)，源码2205632d4f396e5fd8847020f9fb0086a2ca5bab，HTML SHA256 `082e8e2e6233351155fb560d4afd0af930b72af1997907733efb936d2654df46`，SAVE21／CONTENT3；manifest42c5d733绑定该源码。本次状态回写记录已发生的935edf5验收，不预填后续文档提交的CI。

[游戏CI39206525504](https://github.com/yzhai4/zombie_harvest/actions/runs/39206525504)与[路由CI39206525502](https://github.com/yzhai4/zombie_harvest/actions/runs/39206525502)均为935edf5同head completed／success。游戏job117910462746的step45日志实际确认freshness15／15、commitVerification=verified、源码2205632与HTML082e精确匹配；[紧凑CI证据](../qa/evidence/npc-relay-stone-v1/exact-head-ci-935edf5.json)保留实际run／job／step。本地无.git的unavailable另列，不冒称Git证明。main未合并、生产未部署。58ea426及其旧CI是前一检查点，见原字节历史快照。

[名称修复](../qa/shelter-name-display-v1-20261019.md)已接两处既有消费者：附近标题与公开选择后的地图标签显示“临时营地”；未focus标签仍按原CSS隐藏，可建目录未加shelter。受影响源码7合同、名称Chrome15检查、episode主浏览器12检查分别实际通过，均是受控范围；不把旧50／142、90工件引用或这些夹具称为自然全链／真人体验。390px原因可读，但原60分钟按钮部分超屏仍是UI积压。

## 本轮执行：林岑的最后一块石料

[实施卡npc-relay-stone-001](../scripts/npc-relay-stone-001.md)已按8项白名单整合回本归档，当前HTML为`082e8e2e6233351155fb560d4afd0af930b72af1997907733efb936d2654df46`。真实源码Git对象2205632d4f396e5fd8847020f9fb0086a2ca5bab／tree2e38551b6096bedf32b11b79bef477b3fa5e4e10的父为58ea426；其QA子提交935edf5已用expected58ea／force=false更新分支，并由新GET核实际head及上述同headCI。采用独立内置包服务既有zombie-farm中继内容，保SCENARIO_BOOT_PACKAGE.events／C2编译器／已保存binding与digest原身份；不声明C2任意自定义事件已支持新Gate／Effect。

正常来源已核：原公开交核心动作cmd-000622→evt-000173，第1天08:09；A08正常writer643仍由本人commander林岑持合法胶囊并对应同一事件。该路线由受控旧档Continue后经真实公开UI发生，不是新局自然全链；不是从briefed状态回填经历。新补料答复只在明确TEST-ONLY派生近距／范围／零库存档中受控发生，未续跑A08。

目标是只让同一在营、可受理的林岑提出一次邀请。木／件齐、石恰缺1时，玩家可现在从有限库存交入1石，或本次不提前交、由原自治继续；后续自治仍可能扣库存。交料不直接加工时／关系／上线收益；关闭未答和明确答复分开。纯Gate、提交重核、来源tuple、持久terminal与库存／工程／完成／成功业务收据同一事务必须一起实现。旧null／继任者不补经历，来源滚出短账本不否定合法胶囊；AI OFF可玩。

固定082e源码合同实跑8／8（1个合同），四项原受影响失败回归及额外兼容边界均exit0；原5955的SAVE18和可选项目快照真实失败已修，原失败不改。受控Chrome完成交料、延期、范围分界、零库存4场，实际normal writer→reload→Continue→新tick可恢复且不重复扣料；关闭可重开、无库存仍可延期。390图已目视，仍不代替真人理解。三次浏览器方法错误（任意字号门槛、事件父因果字段、dataset字段映射）原件保留，第四次实际通过；四次合计46.813秒未超原135秒。当前7项必需原生合同与原primary Chrome12也已在082e补齐。selected归档只存所需原字节与公共引用，不称完整80工件导出；新manifest与935edf5精确Git CI已收口，详见[本轮QA](../qa/npc-relay-stone-v1-20261019.md)。

新manifest42c5d733已安装；本地原freshness checker实际15／15、PID26824、exit0，无.git归档的commitVerification仍为unavailable。另有源码92项和QA148项Git blob API对账；分支更新后真实Git CI实际verified，三层证据分别列示。selected包不是完整80工件浏览器导出。

WorkBuddy辅助工作流并行改进：已核官方交互模式和2.169.0实际配置，新增用户显式DeepSeek单模型路由、两层截止及短诊断，安装后的32项离线检查通过。[真实小范围样例](../qa/workbuddy-timeout-followup-20261019.md)以deepseek-v4.1-flash约9秒返回、CLI报告4295／455 tokens、费用未知；静态事实可用但323汉字略超300字要求，与长审查失败分别记账。尚不宣称总体节约比例或复杂审查稳定；规则、事务、旧档与浏览器验收继续由真实执行负责。

## 开发分工增量（2026-10-19）

已接入项目只读MCP与有界DeepSeek子代理：资料读取、剧本六视角和规则审查按需分派，主代理核验并执行补丁。86项离线通过；真实随机证据探针通过，真实两子代理游戏审查完成。审查支持先保持当前文案、完善理解pilot；其中遗漏任务菜单和错误二选一已纠正，模型不等于验收。成本/原失败/限制见[代理模式QA](../qa/workbuddy-project-agents-20261019.md)。本次只更新开发工作流、Skill与工具，游戏HTML仍082e；新提交/CI尚不预填。

## A08预算与未证明范围

[A08](../qa/public-self-defence-prefix-a08-20261019.md)保持原HTML2fca和原终态：0导航／F／休整／进食／支援／新业务，0自卫safety调用；exit0仅证单main正常writer前缀。正常档643／seq413／cmd1004，末份live644、末图／pre-close645；无第二reload，不能称643再次Continue。累计至少306世界分钟、wall309745ms、UI80／80耗尽、导航238／240；费用不退款，不另开A09重置此比较。

639筹料真实扣库存2木1石，材料达10木5件3石；仍staging、工时0、未online。643四名NPC对同一敌人合计37伤，只支持本段NPC真实扣血，未证明双向、塔防或支援收益。默认canvas与旧DOM驾驶生产者不匹配、地图button hit过滤冲突是方法限制；现场hit／rect／computed未捕获，不能据此断言游戏不可达或永久软锁。新功能受控夹具不借A08恢复预算或改绿原失败。

完整正常中继／生存循环、真人理解、自然三日、下一NPC实际后果与表达收益仍未证明。研究原文、设计、源码存在、受控执行、正常玩法、真人反馈和生产部署持续分层。

## 下一项唯一交付与长期边界

下一项只接正常界面下这次邀请的可达性与后果理解：沿既有中继／生存路径及理解pilot，检查玩家能否区分交料、施工与上线，并知道延期只免本次即时扣料。先明确合法目标、真实画面输入方法和新任务边界；不续跑A08、不重置原80／80比较预算，不注入自然路线。真人回答留空，受控成功不能补填自然中继全链；之后才比较同权限模板／低频表达。

14天／最终尸潮、完整Actor／Planning／Memory／Social、Scenario Studio、受控布局→约束随机→局部持续演化→设置器复用→角色跨副本、特殊角色连续性、UI素材与GameCore／可替换引擎仍是完整目标。离线恶化政策未决，不新开并行平台；当前人数／地图不是产品上限。LLM只提意图或表达，规则、资源、事实与确定性fallback仍由代码负责。无新增全局记忆。
