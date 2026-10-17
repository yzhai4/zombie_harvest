# 木匠恢复与工作一致性

状态：列明源码／本地浏览器范围已验证；开发ref发布与精确CI终态见[PR #4](https://github.com/yzhai4/zombie_harvest/pull/4)，本页不预填CI通过。生产未部署，naturalGameplayClaim=false。

源码提交`6dbee8cc06c45bec47ff114f41f27686123a8248`，HTML`c21cedd145fe9e2db4b224f727c0e7bceaedfefaba31a37b73dbe3a7308f1571`，SAVE21／CONTENT3。纯core`266212a41dd4d9b7638c118659a1a0651e80855595f5584580c2113448b406bb`；源码检查器`b00acf57d83f09f744bcb6f9384087dfcf09f652031f5d74cfc0e4fa85aed69c`；最终新浏览器执行器`1bd9719efdb7a13c8f157665f129b1cebe96e6aba26faa5ff04d5b1178b8eb3b`。源码21个变更文件已经Git树逐blob核对。

## CI294旧档回归补齐

开发head `c8078dcd1f13f616b48fab1009917a3bf00c9f8a` 的[CI294](https://github.com/yzhai4/zombie_harvest/actions/runs/39049721090)真实失败：计划完整性47/48，后续步骤未执行。本地继续补齐未跑矩阵，保原计划会UI68/69；其它42个unique合同已有当前c21通过证据。两个旧方法漏列新增空安排adapter，已分别精确修复为48/48和69/69。原Scenario adapter与全部旧业务／UI比较保留，新增逐旧payload键比较及第二次真实Continue不再迁移；运行时字节未改。

最终检验源 `3c56e094ebc3e031c71b9172ca812a43d990f486` 相对c807仅改两checker及工作流／Skill参考两文档，HTML仍c21。当前44个不同合同各有实际通过终态，包含14个已通过原执行复用、补充28个通过及两次失败合同修复；不是44次全新执行。两个隔离运行缺schema的ENOENT方法失败原件保留，补同字节依赖后只重跑该合同，不能算产品缺陷。工作流已将完整旧writer的计划会／UI继续路径前置到持久字段证据冻结前。

原失败、修复与矩阵分别见[修复增量](runs/npc-rest-work-v1-20261018/ci294-repair/increment-index.json)和[补充矩阵](runs/npc-rest-work-v1-20261018/ci294-matrix/index.json)。原manifest `7a3c0214…` 按原字节保存，历史报告与检验器保持原SHA；后继精确CI终态从PR服务核对，本页不提前填绿。44源码合同与两项发布／构建Gate分开，语法子调用和内部断言不另增unique。

## 实际行为与设计取舍

唯一有效、健康且本地的木匠在E<24时建立可保存的恢复安排，尝试前往本人的工坊home，持续至E>=36后按当前原日程安排。需求、生理恢复、行为、移动目标、工作credit和SAN读取同一安排／本段事实。恢复不发例行completed、不积工时；完成步不重复计整段工作。支援成功、中继、警觉／作战、紧迫需求、伤病／死亡、驻守、岗位与真实阶段变更让权；免费查看／首谈不取消，刷新保同ID。

新24入36出不是原文案已实现的旧规则。保留+.045斜率，无其它效应时23.5到36估算约278分钟，不能当实测固定倒计时。完成表示恢复目标达到，不认证到工位；原home工坊、workZone东门及小时检查工坊三个含义保持。无补能物品、人口、资源或LLM。细则与六视角见[剧本卡](../scripts/npc-rest-work-v1.md)、[ADR](../decisions/ADR-20261018-npc-rest-work-v1.md)和[原问题](../problems/PROB-20261018-npc-rest-work-consistency.md)。

## 证据分层

| 范围 | 真实结果 | 限定 |
| --- | --- | --- |
| c21新源码合同 | 17/17，含真实native浏览器输入producer | 这是1个新合同的17项检查，不是17套测试；CI不含可选producer，计数由CI实跑产生 |
| c21必需及受影响源码 | 13个脚本合同均exit0；包括public110、self104、direct91、shortage43 | replay18是保存摘要fixture；smoke55是静态合同；night stdout不枚举断言，不补造检查数 |
| 6个影响回归 | C1 120、presence41、campRest74、daycombat26为dc265；C2 66、attention29为3218 | 共8次执行，7个原失败保留。两个后继构建的inline业务原字节相同；只说明CSS差异影响，旧报告不重标c21 |
| 3218实际Chrome业务 | low53＋near38＋support34＝125，errors0，4个最终主文档均3218 | 公开开始、跨24、真reload同ID、近完成返权、原付费支援与保存；保原构建来源 |
| c21实际Chrome布局 | 41/41，errors0，1个主文档为c21 | 390单列／768原三列／1440原两列，恢复说明与直接视线行共存，真实查看和resize；不替代三条旧业务路线 |
| c21实际Chrome关联episode | 12/12，errors0，首屏及真实reload均c21 | 现有原字节episode runner，完整旧writer预启动，公开choice及刷新去重；不是自然多日 |

c21实际浏览器为布局41＋关联episode12，3个主文档；不把3218的125与其合称本构建业务178。所有列明运行均已terminal；新runner的finally清理全true，旧episode保持原生报告无cleanup字段，外部terminal确认其原finally全部await后exit0。

原未搬人的长源码轨迹真实推进162分钟，跨24后因警觉取消：木匠E30.79／HP100，玩家HP88，food8，未达到36。3218公开低精力路线首分钟遇原wall-duty事项，等候依原new-matter中断；公开再开始一次合法等候后跨24并刷新，累计观察72分钟，后因pursued停止，木匠E26.74／HP100、恢复安排仍active、尚未到home。原敌人、食物和十人保留。两条长路线各有不同停止原因，不拼成一次“完整恢复成功”。

近完成完整native仅定位36退出、SAN完成步、下一分钟credit与支援抢占；不替代全程成本。中途保存／刷新、strict字段、未知版本拒绝、旧writer一次null adapter与真实命令重复沿实际代码检验。全世界大步与小步等价、物理到岗与其它职业不在此出口。

## 原失败、布局修正和证据运输

旧23b8的真实反例是低due仍例行completed和低not-due仍向东门两个分支，无木材产出。相同新方法对旧23b8为4/17，失败还包含特性缺席与旧长分支方法不适用，不能称13个独立缺陷。原首轮SAN消费、有效岗统计、取消残留的静态发现与后续修正分别记录。

源码方法的导出路径、精确迁移预期、原accumulator归零、BATTLE本来拒存与到home后target=null问题保留原失败。3218浏览器的34/35、42/43原失败分别来自将new-matter停止当跨24、在继续之前读尚未安装的WorldSnapshot当旧档；修正读取阶段和公开等候方法，未修改游戏需求／敌人。

Root目视发现390旧三列使新12px说明挤成窄长列，故c21仅增窄屏单列CSS；业务inline不变。新实测说明宽300.625、高90.375，相比3218宽84.875、高294.906；root目视当前390与1440原图确认可读。其它旧字号、完整移动操作与素材仍待打磨。

原生报告／PNG／HTTP原字节、执行版本、脱敏伴件和同SHA复用按四个独立索引闭合：[新源码](runs/npc-rest-work-v1-20261018/source/index.json)、[必需源码](runs/npc-rest-work-v1-20261018/required-source/index.json)、[影响回归](runs/npc-rest-work-v1-20261018/legacy/index.json)、[浏览器](runs/npc-rest-work-v1-20261018/browser/index.json)。含私有路径的原失败只公开明确伴件、保原SHA／长度；不把伴件叫native。没有ZIP或浏览器profile。

## 进度和下一项

这是P2本人需求规划的第一项实际消费者，完整P2、EventFact／Memory／Social、contacts授权、继任双岗、自然三日、玩家理解／乐趣、Studio、大世界／多副本、引擎迁移与生产仍开放。先以同seed中继基线、缺粮、缺岗分别验证可读因果和介入价值，再扩多因子与低频模型。工作流／Skill新增持续安排的consumer、抢占、同段结算与旧档检查；阈值只在policy／ADR维护。无全局个人记忆更新。
