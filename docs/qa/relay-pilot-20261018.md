# 中继公开路线与有效岗位：工程 pilot 复盘

日期：2026-10-18。结论：两条受控公开路线均未完成中继；保留 A 死亡、B 风险停止。另以真实死亡／继任函数复现一人被中继计为两岗。**本轮没有修改游戏运行时，也没有生产部署。**

## 来源与方法

开发基线 `a506aa8f369fea6fe6fbbb9ba80ee6524c28ef16`；HTML `c21cedd145fe9e2db4b224f727c0e7bceaedfefaba31a37b73dbe3a7308f1571`，SAVE21／CONTENT3。该运行时对应的 [CI295](https://github.com/yzhai4/zombie_harvest/actions/runs/39051616474) 实际成功；它证明列明工程合同，不证明此次玩法成功。

同 seed1592639710、Chrome155.0.8059.80、独立新context、rate1未暂停、observerCommentary OFF；两个既有完整 source-VM writer 只在首次 loader 前各安装一次，随后公开 Continue／键鼠操作。不是全新自然开局或真人实验。只读完整 writer 用于结果核验及保守危险 veto，未用于隐藏目标导航；这部分不是角色授权观察。没有运行中注入、赠资源、删敌或保证自动塔救援。

两输入经当前真实 loader、checkpoint 与第二次 Continue，原人口／敌人／RNG／绑定保留、零新adapter、第二次payload一致。A初始food8；B初始food0且四堆berry也耗尽，因子是“初始有限食物可用量”，并非只改库存。公开路线协议每臂480墙钟秒、480游戏分钟、10业务承诺、30交互尝试。导航与阅读耗时均计入，未暂停取证。

## 实际结果与更正

| 条件 | 公开终态 | 主线事实 | 主要业务提交 | 未覆盖 |
| --- | --- | --- | --- | --- |
| A正常 | GAMEPLAY_LOSS；299.543秒；第1天10:11，玩家HP0、E82、food8 | 地图点击实际发现广播塔并取得核心；未交付。最后耐久档仍10:10／HP8，核心1、stage core-recovered、材料0、工时0 | 发现3E／20分钟＋F攻击／10分钟，共2项 | 交付、筹料、施工、上线、预警、刷新；死亡持久化 |
| B缺粮 | INTERRUPTED_RISK；80.483秒；第1天07:06，玩家HP94、E81、food0 | 本臂公开找到广播塔，context有3E探索按钮；20分钟行动在提交前被危险veto，核心0、stage unknown | 0项 | 核心回收及后续、缺粮Choice／策略效果、刷新 |

A原报告错误地把“select-public-broadcast”当只读选择，`majorActions=1`／`interactionAttempts=1`。实际 `cmd-000348 landmark.discover`、子命令20分钟、`evt-000162 special.itemRecovered`及`evt-000170 landmark.discovered`证明已经提交；加`cmd-000409 threat.attack`，两项计数均应2。原报告字节不改，由独立 companion 更正。gross3E与UI净84→82含自然恢复分别记录。木材context第1项没有盖掉第2项广播探索，不据此报UI缺入口。

A在F后约32.7秒没有退却，首次退却时已HP14。五次方向北／北／西／西／西均未位移；原存档敌人位置与原碰撞阈值足以解释这些方向被阻挡。实时focus／Session.mode未完整采集，不宣布焦点bug，也不保证其它方向安全。执行器未在逐键前执行HP停止条件是方法缺陷；不据此次失败削弱敌人或新增移动补丁。最终公开死亡与最后耐久档不同水位，不声称已保存死亡或已reload。

B在靠近广播塔后已受伤，近敌进入预计20分钟接近包络，按协议停止。没有尝试付费探索以求覆盖。A/B操作与阅读暴露时长、终止点均不同，且B操作者已知A复盘信息；**本轮不支持食物导致生存／主线差异、游戏平衡或乐趣结论。** 没有缺粮Choice不能写成断粮系统通过；没有刷新不能写去重通过。两context、浏览器及本地服务均实际关闭，页面错误0。

## 有效岗位反例与下一修复

完整旧writer经真实loader，再调用真实`markNpcDead(carpenter)`／`assignMorningSuccessors()`。quartermaster实际暂代carpenter；原roster十ID保留，存活10→9，材料与其它世界实体未赠予。排他`npcFulfillsRole`只认新岗，但中继旧`npcHasRole`并集使参与数组为`[radio,quartermaster,quartermaster]`，只有两个独立人。

这是source-VM受控死亡／继任反例，非自然C或浏览器继任。未执行筹料与施工，不能说双倍产出或工时。下一切片按[岗位问题](../problems/PROB-20261017-effective-role-exclusivity.md)修实际消费者与提示，保留旧身份／历史／进度，不全局替换所有身份查询，不顺带改伤员政策或工程速率。

## 六视角裁定

| 视角 | 本轮事实与下一约束 |
| --- | --- |
| 玩家 | 可见入口与实际付费动作须一致；碰撞与危险可解释，方法先逐步检查，不假定能撤退或塔必救 |
| NPC | 一人只提供一个有效工程岗；需求恢复、正式职责、在场与健康各自核验 |
| 营地 | 保存既有材料／工时与人口历史；玩家死亡不等于营地灭亡；空缺不能被重复占槽隐藏 |
| 势力 | 未新增外交；核心回收带真实既有功绩，不把未交付写成合作完成 |
| 敌人 | 原压力、生成、追击、碰撞和双向伤害保留；未暂停阅读也有成本，失败不由删敌改绿 |
| 全局链 | 回收／交付／工程／预警分别验收；实时事实、耐久checkpoint与最终刷新分开，旧失败不覆盖 |

## 证据保存范围

文档更新后维护原manifest的3个当前文档哈希与3个精确历史引用，原33个绑定及155个scripts／dist依赖保持；当前1094工件、36历史绑定。只读freshness Gate实际24/24，当前归档无.git，`commitVerification=unavailable`；不把它说成Git验证通过。Skill结构校验和本轮31个本地文档链接已核。没有因文档变化本地重跑44个相同业务合同；最新远端文档head的CI以PR服务实际终态另核。

仓库保存[选择性证据索引](runs/relay-pilot-20261018/index.json)、原报告的无损gzip、关键完整writer、执行方法与独立[companion](runs/relay-pilot-20261018/companion-v1.json)、[事后分析](runs/relay-pilot-20261018/a-postmortem/findings.md)。gzip解压后的SHA与原报告逐字节一致。完整现场目录在私有工作区保留；索引明确列出未公开现场文件，**本仓库增量不是所有截图／逐步native的完整运输归档**。本地只读核验实际检查243个文件引用，不将该数量称为游戏检查通过。

原准备失败、loader两次方法预期错误、A漏计与停止检查不足全部保留。没有重跑A找成功，没有把当前方法给旧失败重新署名。下一轮修改方法须另冻结，复用本轮事实但不把旧轮改成成功。
