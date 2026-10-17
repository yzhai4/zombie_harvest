# 中继唯一有效岗位与一次完工：QA

日期：2026-10-18。本片已完成列明的源码回归、受控旧档运行时和 Chrome 验收：中继按唯一有效岗位绑定实际人员，缺岗或配置错误停止新增工程成本，真实补岗后继续；legacy 完工、建筑、预警与一次收益保持同一事实。完整自然主线、真人体验、全项目岗位统一及生产部署仍未验收。

补充终态：新 manifest 冻结后，最后一个源码合同 self-test 已实际76／76、exit0；原43合同加本次为44个唯一合同，各有通过终态，共45次合同执行，原rest方法失败保持。freshness另16／16、exit0，213库存与158源码依赖匹配；本地Git verification为unavailable，不能称已通过Git祖先校验。原输出与[收据](runs/relay-effective-role-v1-20261018/post-freeze/receipt.json)另存，不改写下方原冻结时点或selected原报告。开发ref／精确CI仍待发布核验。

## 冻结来源与交付状态

业务源码 commit `ed9933f4efd1b61abdcbc6a86f9a1169ab5dc29a`，tree `9d0da6dec29ec9144cb9b90b55e2d6f7ab0bc8ad`；HTML SHA256 `dccb52ff94a0101992f6696c3ecb93c7092b1049d85dbbe2701d5e6ad1ca004a`，901709 字节，SAVE21／CONTENT3。源码 commit 与最终证据 commit 分开：本文冻结时开发分支仍在 `85c5`，最终证据提交、ref 更新与新 CI 尚待完成；不继承旧 CI 绿色。当前本地包无 `.git`，本地矩阵不声称验证了 Git 对象。生产未部署。

规则与范围见[ADR](../decisions/ADR-20261018-relay-effective-role-v1.md)、[继任岗位问题](../problems/PROB-20261017-effective-role-exclusivity.md)及[项目引用问题](../problems/PROB-20261018-relay-project-alias.md)。选择性公共证据入口为 [selected/index.json](runs/relay-effective-role-v1-20261018/selected/index.json)，索引 SHA256 `eb0eac90ed0792b6956b281a95f2bf740b13ee9784fc3fb2857879ac01d2a21d`。本文冻结时选定 overlay 已在独立 publication staging 完成，仓库安装、最终 manifest 与上传回读另行闭合。原始私有现场、未选中的报告及截图不因该目录存在就成为已公开完整运输包。

选定[运输映射](runs/relay-effective-role-v1-20261018/selected/transport-map.json)与[源码对象证明](runs/relay-effective-role-v1-20261018/selected/source-commit-artifact-proof.json)分别记录运输和源 commit 的逐 blob 对应。浏览器两报告按 native 字节公开；[中继运行时公共伴件](runs/relay-effective-role-v1-20261018/selected/reports/relay-construction-runtime.public-companion.json)仅替换三项私有路径，保留原 checks／source／count，不能称原 native 字节。c09 原件另保留，原 SHA 与转换关系入索引。旧失败仅在[保留清单](runs/relay-effective-role-v1-20261018/selected/retained-original-failures.json)按 portable 名称、原 SHA／计数及 external-retained 标识，未公开 raw、未挪到 passed rows。

## 实际改动与旧事实边界

中继筹料、施工、既有 opt-in stage snapshot／adapter、本人 relay-duty、项目 work-pulse 与 crew 使用同一纯读绑定。每岗按 `(actingRole || id)` 选择唯一营地本地活人；同一实体／npcId 不能占两岗，候选歧义不能按数组第一项任选。保留原中继伤员准入，没有引入恢复 pilot 的 healthy、满 HP、精力或距离门槛。姓名从实际绑定者及原作者模板取得，不向 native NPC 保存补写 name，也不再固定显示原木匠姓名。

当前未完成项目要求 `assignedNpcIds` 为 radio／carpenter／quartermaster 的完整无重复集合，顺序不限。空、漏、其它已知角色或重复配置在下一次准入失败，并显示配置错误；缺岗显示实际空缺及暂代者。旧 writer／loader 仍保存历史数组、进度和 online，未新增保存域或迁移。这是未来执行收紧，不能称所有历史自定义执行语义不变。未知保存身份仍由原 validator 拒绝，不靠运行时伪补角色。

缺岗、配置错误或岗位歧义在新增 materialClock、扣料、工程分钟、建站及成功收益前停止。snapshot 自身不调用 ensure 写业务状态；adapter 保留历史 duplicate 优先，再核当前配置、唯一 actor、CAS 与占位，不放宽旧比较。合法配置缺一人时，其余唯一绑定者继续原待岗职责；无效配置无人因此抢恢复。blocked 项目的 work-pulse 不写成项目完成劳动。世界时间、敌人、配给和其它日常生产仍照常，不把项目停工写成全世界静止。

真实补岗后只消费下一次真实执行机会，不追补缺岗期间工时、不退款或重付。已 online 项目在缺岗检查前保留历史终态，不撤旧站点、预警或收益；在线维护另立合同。长官交付的原核心、距离和四元 token Gate 保持；未把施工三岗加成交付前置，未修指挥所全局 vacancy，也未回填旧 `handoffAt:null`。

## 受控输入、反例与修复结果

共同 briefed 输入 SHA256 `38cdf0a6ce9a38263091f475db7a6730444464d510f812e84a0658b7a5bc2b77`，82162 字节，来自实际 source 命令的发现／核心／交付与真实完整 writer；不是手填工程阶段的替身。真实 Continue 保留十个 NPC ID、原四敌及真实新生的 frontier-1、有限地图来源和旧 null 交付时间。死亡／继任调用是明确受控方法，不称自然死亡、严格单因子或新人口生成；死亡后 roster 仍十 ID、存活九人。

旧 c21 实际死亡与首次继任令 quartermaster 暂代 carpenter，中继却按旧身份并集得到 `[radio, quartermaster, quartermaster]`，只有两个人占三槽。这证明重复占槽，未证明双倍产材或全局工时翻倍：原 materialClock 与工程分钟并不乘参与数组长度。本片让后勤官岗位真实空缺；第二次实际继任由 cook 承担 quartermaster 后，原工程继续。

另一个真实缺陷来自跨 helper 的项目对象替换。仅岗位修复版 `69a84a07` 从同一 briefed 档真实 Continue，随后有限调用 `updateRelayProject(30)`：第 7 次 local 已 building／work30 而 live 仍 staging／0；第 8 次再次发 materialsCommitted；第 14／15 次 local online180／210，live 仍 building，连续发 stationOnline 与 standing／trust，station.active 最终 false、forecast 仍 camp-observation。实际材料仅木10／零件5／石4；任务首次 parts+1 是合法一次收益，不能误报成重复产材。

规范化现保持 live 项目容器身份，避免后写阶段、工时与完工落在退役对象。最终独立 legacy 场景第 11 次 consumer 调用达到 work180／online，station.active 与 relay-station 预警一致；材料有限收据、一次 stationOnline、一次 forecastChanged、任务 parts+1 与 standing 均核对，后续调用、真实保存及第二 Continue 不重付。中间 `6536` 的真实 forecastChanged 漏发另有原失败：ensure 预填新预警后抹掉比较前值；最终先保留旧预警再规范化，原比较阈值及数值不变。

上述每次 30 分钟只是项目消费者 elapsed 输入，IO 时钟受控，没有调用 world.advance；不称自然 330／450 分钟，也不证明同期生理、移动、战斗、物理到岗或安全。真实启动夹具是定位消费者的方法；它不等于从公开新开局自然走完全主线。

## 源码合同与方法更正

最终 runtime checker SHA256 `ec2cdcca561b80647fde3db0251f036a4158ba7a9be91286c4082da7156f4039`。原八个逻辑块保留，新增两个场景，最终为同一个合同的 10/10，不增加成十套合同。

| 逻辑覆盖 | 实际终态 |
| --- | --- |
| 原八项 | flag-off、stage 一次成功、缺人、旧 token、子命令 duplicate、虚拟占位、保存 token、同 tick 次序，原检查块未删减 |
| 新场景 9 | 真实死亡／继任后 default 与 opt-in 均停成本和进度；partial crew 待岗、rest 让权、blocked credit、纯 snapshot、真实补岗继续、保存／Continue，以及明确 TEST-ONLY 配置变体 |
| 新场景 10 | 真实 briefed legacy 筹料到 live online、有限来源、建筑／forecast、一次事件与收益、后续调用及保存／Continue 不重结算 |

同一最终方法在 dccb 为 10/10／exit0，原报告 SHA256 `c09d8ec5df20cbef8543eea1cf1c60eb239343f10888455b96f86b803704dc87`；在 c21 为 8/10，在仅岗位修复的 69a84 为 9/10。负控在首个真实违例处终止，不能说新负控本身再次观察了后段重复上线；后段症状由独立 alias 原执行证明。完整索引为外部 `checker-work/final-index.json`，SHA256 `722eea9ab173fd69b6a60fcac2988473c4bb087e92851889d8db80f394476bc0`。

按当前 validate.yml 及上一轮准确参数，对 dccb 新跑 43 个 unique 合同，包含 crop_method_controls，排除待新 manifest 的 iteration-evidence-self-test／freshness。首轮 42 通过、rest 原方法 15/16；修正一次后 43 个合同都有当前通过终态，共 44 次合同执行（43 次通过、1 次原失败保留）。另 `build-scenario-package --check` 一次通过，列支持命令，不加为第 44 合同。最终另 1 个 iteration-evidence-self-test 合同及 freshness Gate 尚未执行，不预填其通过。每命令保存实际 runner／输入原字节、stdout／stderr、exit 与 HTML 前后 SHA，均为 dccb；纯 core、静态和方法控制不因此变成完整游戏运行。

该次 rest 方法只把旧正式 owner 正例 `['carpenter']` 改为合法三岗，逐字节确认其它断言与计数不变；非法 subset 不抢恢复已由新 runtime 覆盖。原 15/16 报告 SHA256 `f5908eed23c195508dfbe087610557258fe07264f2c2f17ccd74d08db2fba92d` 保留；修正后 16/16 原报告为 `f269bc30f55bf329c5badc2154f8a9ee99370a3f49b439f33b79f014b10470c7`。矩阵闭合 SHA256 `b8c99b9c517fd873bbe5c9fb3863511f3db228928db758b70196749202604a79`，不跨合同相加 assertion 数作为玩法指标。旧 leader bridge 原 sourceHash 使用 JSON.stringify(html) 编码，保留原值并在闭合文件说明，未冒改成 raw HTML SHA。

其它方法失败同样保留并分开归因：原 c21 producer 已真实交付，但错误断言不得有真实 frontier 新生；原 producer 8/9 依赖替换 project 的具体源码语法，改为 normalization／token 字段 trace 后 9/9，持久化由运行时证明；首个 6536 runtime 8/10 含一个跨 VM 数组比较错误及一个真实 forecast 缺陷。方法修正未覆盖原报告，也没有把实际 alias／forecast 缺陷归为方法错误。

## 实际 Chrome 与人工查看

Chrome `155.0.8059.80`，四个中继场景使用最终 source-native 完整 writer，只在首次 boot 的 loader 前安装一次；之后公开控件、真实运行 tick、保存与刷新，没有 boot 后改 GameState、隐藏动作、force click 或按隐藏存档导航。输入分别是正常 briefed、真实缺后勤官、真实第二继任补岗、明确离线 TEST-ONLY 重复配置。它们不是四个自然新开局；浏览器没有重跑独立 native validator／IO，而是绑定此前独立执行 proof。

| 浏览器报告 | 实际结果与范围 |
| --- | --- |
| relay-browser | 197/197；四场各有刷新和新 tick；8 次主文档响应均同 dccb；errors0，107667ms，context／browser／server 均清理 |
| episode-browser | 12/12；完整旧 writer boot 定位，公开 shortage choice、一次 cache／identity、刷新不重领；2 次主文档响应均同 dccb，errors0 |

两报告共 209 项检查、10 次主文档响应，不是 209 场景、209 次游玩或额外源码合同。中继原报告 SHA256 `da5eb65968091a101f5f94b7e84ebb33eb34ef86022c9fe1311b01eb5d9ab230`／685861 字节；episode 原报告 `2acf9fa1b12e1567f7501b88aaf78c6d331868ccc666790401e7ad6421d05ba4`／1477 字节。root 另目视 normal desktop、missing390、restored390、invalid390 及 episode 两张截图，检查实际 crew／停工与窄屏可读性。这是工程人工目视，未做真人可理解性、偏好、乐趣或完整移动端研究。

## 六视角结果与开放项

依 ADR 的六视角，本次结果如下；不以设计约束存在就宣布实现通过。

| 视角 | 已有结果与范围 |
| --- | --- |
| 玩家 | 公开 crew 显示实际暂代者／空缺／配置错误；保存、刷新、新 tick 后一致；未虚构转岗、召回或取消入口 |
| NPC | 原 ID、需求和继任历史保留，一人不冒充两个中继岗；合法 partial crew 保留待岗，blocked 不冒领项目完成；未统一所有岗位或健康规则 |
| 营地 | 有限木10／零件5／石4、已花成本与工程进度有据；无赠资源、加人口或补工时；真实任务 parts+1 仅一次 |
| 势力 | 原头衔不能取得额外当前工程能力；上线 standing／trust 只结算一次，未增加外交或合作规则 |
| 敌人 | 原四敌与真实 frontier 保留；不删敌改绿；consumer 时钟证据不推定世界战斗、安全或预警带来的生存收益 |
| 全局链 | legacy／opt-in、CAS／duplicate、live 项目、建筑、forecast、保存／Continue 连续；旧 online 与 null 交付历史不追溯重算 |

[旧公开 pilot](relay-pilot-20261018.md)的 A 死亡、B 危险停止及原方法漏计保持，不被本轮夹具成功改写。完整公开发现→交付→筹料→上线后果、自然三日、食物／岗位单因素与复合压力、held-out seed、真人理解和继续游玩意愿仍独立验收。物理到岗、全局有效岗／指挥所 vacancy、健康一致性及在线维护仍开放。

完整 ActorObservation／contacts 来源与 TTL、共享授权、规划与持续记忆／关系、EventFact 消费者、Studio、更大地图／多副本及特殊角色连续性、UI／素材与引擎迁移继续按[长期目标](../long-term-plan.md)推进。本片没有接入 LLM、learned World Model 或重写 GameCore；研究报告的样本和统计未当作本片收益。本轮可复用决策见上述 ADR、项目引用问题与本 QA，继任问题沿用原记录；不把工程检查通过扩称全项目批准。
