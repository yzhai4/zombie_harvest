# NPC 恢复／工作切片独立证据审查

结论：在本轮源码来源、证据运输、原件保留和报告边界范围内，未发现阻断性差异。最终 manifest 的引用已闭合；本结论不是全项目、完整测试矩阵、开发 ref 发布、精确 CI 或生产批准。

审查绑定：

- source commit：`6dbee8cc06c45bec47ff114f41f27686123a8248`
- Git tree：`5eed1a6b2ca3a6c27a6ec71302036197d5a8b87d`
- HTML：`c21cedd145fe9e2db4b224f727c0e7bceaedfefaba31a37b73dbe3a7308f1571`
- pure core：`266212a41dd4d9b7638c118659a1a0651e80855595f5584580c2113448b406bb`
- manifest：`7a3c0214889906dcda10ff9def30e3a44519c6c0e20a86bca276424216a9b476`，211151 bytes

审查全程只读 ROOT，没有重跑游戏、启动浏览器、复制 ZIP、修改运行时或生产。

## 来源与最终 manifest

冻结 source-stage 的 21 个文件，其 index、压缩 wire、当前工作副本及 GitHub 实际树中的 Git blob SHA／长度逐一相等。实际源提交的 parent 为 `1277585f0009e059066b9f326cdb2b726b6353c7`，读取的树完整且未截断。

最终 manifest 的 818 项库存全部匹配实际 SHA-256；其中 155 项 scripts/dist 文件的实际 Git blob SHA 与源提交树一致。2478 处嵌套仓库引用均可闭合，29 处历史路径重绑定保留原 SHA 和原件字节，包括恢复的旧 transport／classification metadata；没有把旧路径绑到已改变的当前工作文件。

现有未修改的 `scripts/check-iteration-evidence.mjs` 被独立只读复核：22/22，exit0，stdout SHA 为 `6d07ac0c980ae298213f559a0c16506e78d1aa349e0b14d02c1b0b30b4398744`，与原运行完全相同。Gate 的 `commitVerification=unavailable` 保持原义；上面的 GitHub 树核验补足字节来源核对，没有把它改写为本地 ancestry 通过。

14 条 manifest native test rows 不代表14个新源码合同或完整44套；其中含当前 UI 检查。新 source17 是一个新合同的17项检查。13个当前 supporting 脚本合同另有原终态与原报告，night guard 因无枚举型 native JSON，单独保留完整 stdout；content-chain 引用原 text、replay 引用原 fixture JSON、smoke 引用真实 `--report` native static-contract JSON，未用 normalized summary 冒充。

## 原件与 portable 运输

source289、required-source359、browser147 条逻辑映射，以及 legacy566 个对象，共1361项均找到声明原件或精确历史依赖字节。1348项为 exact bytes；13项显式 companion 与原件只差声明的绝对路径替换，原 SHA／长度、失败值和非路径事实保留，未被称为 native 原件。

2966次公开仓库引用核对覆盖654个实际文件；最终448个 CAS 文件名都与内容 SHA-256相等，公开 JSON 未发现私有绝对路径。主 source 报告的213个 artifact refs、legacy442个原报告 artifact refs及67项输入引用全部匹配。嵌入 consumer 的历史同字节报告以 canonical 原报告工件树闭合，未计为新增执行。

## 构建、失败与声明范围

| 证据 | 已核实范围 |
| --- | --- |
| 新源码 | c21 source17/17；同最终方法旧23b8为4/17，13项失败含新特性缺席及方法适用性，不能称13个独立缺陷 |
| legacy影响回归 | 6个合同、8次执行；dc265四个通过保原来源，C2 60/66和attention28/29保失败；3218两个精确适配后通过 |
| 3218 Chrome业务 | low53＋near38＋support34＝125；4次实际主文档，errors0 |
| c21 Chrome | 响应布局41＋关联episode12＝53；3次实际主文档，errors0 |
| 浏览器原方法失败 | 34/35与42/43保持FAILED；三次失败轮主文档单列 |
| 原源码长路线 | 真实162分钟，跨24后因警觉取消；E30.79／NPC HP100／玩家HP88／food8，未到36 |
| 公开低精力路线 | 实际72分钟后因追击停止等候；E26.74／NPC HP100／同ID安排active，未到home或36 |
| 近完成夹具 | 明确TEST-ONLY，只定位完成、SAN、下一分钟credit及支援接管边界 |

dc265、3218、c21的实际 inline脚本字节相同。manifest以完整 inline script 元素为 hash 单位，其 SHA 为 `3089660937ac070ca22dd68982b58b003df3cc79415a013cde5847498d687a47`；若只取内部 body，SHA为 `5be7febfe286834b01eec96a10ad1a15b7f3b09c475f2b8ffb936ae9fe7ddb3f`。两种单位未混淆。CSS改动有独立c21布局证据，旧报告没有重标为c21业务；不把125与当前53合称本构建业务178。

episode保留未修改的原报告，其本身无artifact／cleanup字段。单独索引和terminal0配合原runner可确认正常context关闭以及await后的browser／server关闭；未补造native cleanup字段。

QA、current-state、open-risks、long-term及研究采用计划都保留：278分钟只是无其它效应下的估算；没有完整低能量全段完成、物理到岗、自然三日、完整P2／ActorObservation／Memory、真人理解／乐趣、算法收益或生产结论。研究统计与工程assert计数没有充当收益证据。

## 尚未由本审查批准的出口

审查时直接读取开发 ref `codex/v82-npc-succession` 仍为 `1277585f0009e059066b9f326cdb2b726b6353c7`；本轮源提交存在于Git对象中不等于 ref 已移动。最终证据提交、ref 发布、该最终 head 的 Actions终态、全矩阵与生产需要各自真实证据；本审查不继承旧CI绿色。

