# CI294 后增量独立审查

结论：本轮两处旧存档方法适配、增量证据来源与最终 manifest 引用已闭合，未发现本审查范围内的阻断差异。本结论不代表后继精确 CI、全项目、自然玩法或生产批准。

本审查只读代码、原件和已有 Gate 输出；没有修改 ROOT，没有重跑游戏、浏览器或 Gate。

## 最终绑定

- source：`3c56e094ebc3e031c71b9172ca812a43d990f486`
- tree：`4a4f3cb3cadfe6a2c7019759d74da12f855e56fe`
- manifest：`36f844e381dc4d878cd197c49323a12fe9be17deaff61e5377f8f765f5523ebd`，287739 bytes
- HTML：`c21cedd145fe9e2db4b224f727c0e7bceaedfefaba31a37b73dbe3a7308f1571`

1093项库存逐 SHA-256 全部匹配。155项 scripts/dist 当前文件逐 Git blob／长度匹配 GitHub 实际源树。实际 compare 相对 c807 只有四文件：plan checker、UI checker、工作流和 NPC routine 参考；后两者只增加旧 writer Continue 回归前置及精确方法适配教训。HTML、core和运行时未变。

33处 historicalLogicalPathRebindings 均按明确 origin＋field 核对：原29处保留，另四处只将原 manifest7a3c 中已改变的 checker／文档路径绑定到同 SHA 原件 CAS。旧 manifest 原字节未改。其余历史逻辑路径按各自已声明的冻结输入、原报告 artifact 或 legacy input map 闭合，不通过当前可变文件或全局 path 兜底。共核5084处嵌套仓库引用，没有未闭合项。

已有未修改 Gate 的最终 scope 版原输出为24/24、exit0，SHA `19dca0d52999e37b309a4cbcf5c1be85167225a56afaf7cab1395b80be5a7e36`；本审查仅读取该原输出。其 local Git 状态仍明确为 unavailable；独立 GitHub 树核验没有被表述为本地 ancestry 或新 CI 通过。

## 两个方法修复

plan checker 从9cbf1587开头变为 `0a788ae621b5241ba505dbaa1e7104a3832e02846e003ecc6a3fc5080c4ccef1`；UI checker 从65759115开头变为 `7673308a83fab6806f1271453301f86042d79b699ca4384fa21a8802b279ff07`。当前文件与实际执行快照相同。

两个 diff 都只精确增加新 routine-intent reason／唯一 domain／原 fixture 有序 NPC IDs 与 null 默认 adapter。原 Scenario 两项 adapter 及全部旧业务、CP、资源、人口、RNG、事件、UI renderer／按钮／纯度比较保留；没有宽泛 omit、任意 migration 放行或用当前 normalizer 制造 expected。新增逐原 payload 键 deepEqual、顶层键集合和 NPC null-intent 检查，比原比较更严格。activeCommandId:null 已存在于原23b8 loader，非新增放宽字段。

第二次 actual Continue 比较完整持久 payload 和全部 migration，首次／再次 native 均为77798 bytes、SHA `b5b76ba6e46080041718951a872c49f6baace5065f56df49d6bbbfec1350a5b7`。原 writer fixture SHA d9b8811f开头、checksum707889bd保持，未写新输入或伪造 intent。UI原69个检查名称与顺序完整保留，实际受测 renderer/controller 未替换；这是VM证据，不是新Chrome验收。

修复报告分别48/48、69/69，SHA为 `0cf116cad25c7913139dea74eeef6be340a86c384085d1db356f70b03de346fb` 和 `1d5afca1da3649af9bdac1030c84bd6052a131ede54ed41441b67e32580577fc`。

## 覆盖与原失败

CI294 在精确 c807 head 的真实结果仍为 plan-integrity47/48、exit1，后续 CI 步骤 skipped；没有把后续本地补测称为该 CI 已完成。

补充矩阵有44个不同名称。14个当前 c21 已通过执行明确复用；其余30合同首次运行26通过、4失败，其中 combat-intent／event-gate 两个缺 schema 的方法失败在补入同字节依赖后只重跑这两项，得到28个补充通过。其时42/44，plan47/48与UI68/69原失败保持。再接两份独立精确修复后的通过报告，最终44个不同合同各有通过证据；不是44次全新执行，也不把内部检查数另加成合同。

原矩阵 index 的 pending／42-of44 字样保留其历史时点；最终 manifest 通过 separate repair increment 显式补齐。两项缺依赖失败、两项旧 oracle 失败、CI294原失败全部保留，没有覆盖或移绿。manifest 的旧 scope 残句已准确更正为14复用＋28补充＋2修复，完整新精确CI仍pending。

矩阵714条运输映射逐原件核对：637 exact bytes、77个显式路径脱敏 companion；原 SHA／长度和非路径事实完整保留，companion 未冒称 native。401个 native artifact 引用闭合。修复增量另有27＋19条映射，原件和公开对象一致；其中两个 UI 启动／终态伴件仅替换私有路径。

## 保留的范围

16条 manifest native test rows 不等于16个新合同或全部44源码报告；night stdout、static smoke与replay fixture保持原限定。前期源码、legacy、Chrome证据没有重写或新增执行：3218业务125／4 main，c21 UI41＋episode12／3 main仍分列。162分钟警觉取消、72分钟追击中断及近完成夹具的边界保持，未宣称低精力全程完成或物理到岗。

QA/current-state正确区分运行时源6dbee8与最终方法源3c56，未预填后继CI绿。自然三日、完整P2／ActorObservation／Memory、真人理解／乐趣、研究收益及生产仍开放。公开增量不需要重复整包或改写旧 portable maps。

后续出口只有最终证据组合树／ref 发布，以及该最终 head 的真实 CI终态；需各自取得证据，本审查不提前批准。

