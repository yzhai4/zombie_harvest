# 林岑的最后一块石料：当前执行与边界

玩家亲手交给林岑的中继核心，能够影响下一次互动。林岑仍在营、可受理并实际担任长官，且工程只缺最后一石时，玩家可从库存交入一石，或结束本次邀请、继续原自治筹料。关闭面板仍未答复。交料只补材料，不额外支付固定体力或分钟，也不直接增加工时、关系或上线收益；世界时间继续，延期不能永久预留库存。

## 源码与实际验收

已整合 HTML SHA256 `082e8e2e6233351155fb560d4afd0af930b72af1997907733efb936d2654df46`，SAVE21／CONTENT3。源码 Git 对象为[2205632](https://github.com/yzhai4/zombie_harvest/commit/2205632d4f396e5fd8847020f9fb0086a2ca5bab)，父提交58ea426；源对象、tree与92项源码／既有引用字节已通过[Git blob对账](evidence/npc-relay-stone-v1/source-artifact-proof.json)。本文建立时分支推送与新CI尚待执行；源码对象存在不等于已发布。

| 证据层 | 实际结果 | 不代表 |
| --- | --- | --- |
| 新源合同 | 8组／1合同，exit0；身份、岗位、距离、真实扣料、过期竞争、两层晚故障回滚、持久once及完整writer／Continue | 任意NPC历史、正常连续主线 |
| 新NPC Chrome | 4场，65项含绑定断言；交料、延期、关闭重开、范围分界、零库存、normal writer→selected→Continue→新tick；全部main为082e | 65个独立场景、真人理解 |
| 受影响兼容 | C1 120、C2 66、原链54、恢复177及本次4组边界，实际exit0 | 新增通用Scenario编辑能力 |
| 既有必需合同 | 当前7项原生结果与primary旧episode Chrome12项通过；纯模块另标范围 | 自然三日、完整生存平衡 |

原5955构建暴露了真实兼容错误：SAVE18合法缺少contentState被误拒，以及无relayProject的既有局部事务快照抛错。最终仅放行原SAVE18缺省形态、保留显式损坏拒绝，并按属性存在性捕获／恢复可选项目；未注入默认项目或改旧夹具预期。新旧C2编译器、已保存绑定与原事件内容身份保持，原胶囊不从briefed状态回填。

正常保存和loader实际选中raw分别保留；交料后下一tick可以按原岗位施工，延期后本次无即时扣料、之后仍可能自治取料。两处日志“先记录后抛错”的失败，库存、项目、terminal与成功业务收据均回滚；CommandBus编号预约及失败attempt审计沿原语义保留。原故障与方法错误未改绿，未重复给予库存或完成收益。

当前manifest已安装，原有freshness checker在本归档实际执行15／15、PID26824、exit0；manifest SHA256为`42c5d733a9d54e5a012d04ec239caff142e6c91debaeec9f7c71b14691b52f74`。此目录没有.git，`commitVerification=unavailable`；92项Git blob另经API对账仍不能替代分支推送后的真实`--require-git` CI。

## 剧本与辅助模型质量

六视角依[实施卡](../scripts/npc-relay-stone-001.md)核对：玩家承担有限库存成本；NPC只使用本人来源；营地保原岗位与工时；势力没有额外知识或功绩；敌人与世界继续演化；全局链不跳过施工、上线或保存。

本轮将设计卡和两个代码片段交给明确指定的DeepSeek作初审，实际报告输入9375／输出995 tokens、观察请求下界1、费用未知。主代理核查了两条疑问：本人来源函数未包含在输入，是材料范围缺口；“effect没有terminal保护”漏看了它调用的Gate，是误报。现有函数与本次实际合同足以澄清，未为此重发模型请求或修改规则。模型的UI、timer和恢复未知仍保持其局部范围，不替代上述真实执行；篇幅也未成为质量通过依据。

后续初审输入补齐所核性质的关键调用者／一跳Gate；已确认缺陷、材料未证明与误报分开记录。主代理只追查有定位的疑问，保留规则与发布判断，避免两端重复全文分析。

## 归档和未证明范围

[selected包](evidence/npc-relay-stone-v1/selected/manifest.json)保存选中原生字节、三张390px图、实际输入、normal／selected与关键故障前缀；[独立路径解析](evidence/npc-relay-stone-v1/selected/reference-resolution-companion.json)标明publicRef、历史leaf与未重复归档项。它不是完整80工件浏览器归档，未选children仍在原执行目录；不能从本包声称所有子工件都已跨机独立复验。

A08仍保持原80／80预算耗尽；本轮只使用标明TEST-ONLY的派生输入，没有续跑A08、注入新自然路线或补成三日。尚未证明正常中继／生存全链、真人理解与在意程度、自然三日或生产部署。下一项唯一交付是收口本片源码与证据提交、精确head CI，然后继续正常玩法路径与已有理解测试。无新增全局记忆。
