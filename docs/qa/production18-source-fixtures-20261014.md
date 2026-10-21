# 实际生产 SAVE18：原 writer 夹具

**状态：** 样本采集已验证；新恢复候选的迁移验收尚未完成。

公开Sites v81源为 `f3488457286836bf986dc90b5e0c3f6f425813c9`，实际HTML SHA256 `11f25c4e68f7360a11b8c84a638b0f8a8270202af3bcf58b3047d278b4952400`。该writer保存SAVE18，没有contentState；托管v81不能推定SAVE21/CONTENT3。严格校验开发21而拒绝正常生产18是发布阻碍，不能把新档删字段/改version作兼容正例。

完整两项dist源文件逐字节复制到私有QA目录，在动态loopback端口短时提供该原HTML；浏览器响应body SHA与原源一致。独立非持久context通过公开开始、可选遭遇、报告关闭取得三份真实writer保存，无存档注入、隐藏游戏函数调用或原profile修改。辅助服务随进程结束关闭；主测试服务及Sites未改。实际进程终止exit0，28.688秒。

| 原件 | FNV | SHA256 | 事实 |
| --- | --- | --- | --- |
| [DAY18](../../scripts/fixtures/legacy-save18/DAY18-save.json) | 926f908a | 0fe3b3e33d630621feb20cba3bb08b4db7cef247464d3b32f748c3c17bf829c3 | 第1天06:10，seq10，正常DAY |
| [RESOLVED18](../../scripts/fixtures/legacy-save18/RESOLVED18-save.json) | 4a12d242 | 1d10ec233d64ce9a0cedf3eae44fa1e6706065c0ff37ba3e13f5b663451d2d1e | 同日期，seq14，已结算待关闭 |
| [CLOSED18](../../scripts/fixtures/legacy-save18/CLOSED18-save.json) | f1db7a05 | 5413783b32ebae6cc798593e90f034da596e17b20cda71b606054c8180b1b960 | 同日期，seq16，实际公开关闭 |
| [INITIAL18-reload](../../scripts/fixtures/legacy-save18/INITIAL18-reload-save.json) | 8774420e | 3ae5ff906cfb1d6e50c9b5ea9467896f2537e64bfaab44b0c897984baa6ae460 | 另一独立新局：公开开始后立刻reload，day1 06:00，所有事件/命令水位0 |

三份原件均十名不同NPC，savedAt=world.totalMinutes=370，原JSON payload的JS UTF16 FNV通过，完整字节复制后SHA不变。实际实例 `threat-1-6-10-12`，旧close payload为空对象，但事件commandId与threat.close replay中的threatId精确关联。已看真实总结截图：击杀2、突破2、营地损伤0、墙体损伤2、阵亡0、士气78；没有把开发构建的3击杀结果移植到旧源。

第四份来自另一段2.892秒公开开始后立即reload，实际进程exit0、原FNV有效。该旧writer此时写 `savedAt=360` 而 `world.totalMinutes=0`，day1 06:00、eventSeq/commandSeq均0，events/replay.commands为空；是已确认的旧初始时钟sentinel，不是人为坏字段。允许仅SAVE18且完整旧domain、初始日期及全部零水位时在独立迁移draft纠正world到360，保存原checksum/world0与理由，不改变实际日期、人口或资源、不发收益。其它世界分钟/日期冲突仍须拒绝；原输入及镜像字节保持不变。新writer的公开开始后立刻reload还须另验一致性，不能靠单测手设worldMinute掩盖。

该source18保存NPC原needs/relations/appearance/equipment/workHistory等，未保存新attributes/hero/garrisonedOutpostId。适配须验证并保留旧world/roster/库存/伤亡/社交/中继/任务与因果，再仅补新增系统。contentState仅确实缺席时可补；null/数组/损坏对象不是缺席。新计划idle、无历史计划收益、CP不回补；L0规定commander/radio/doctor为起始英雄，按基准身份初始化，不制造玩家晋升、属性bonus、奖励或新增人口，其余普通NPC不获免费晋升。技能执行仍遵守原设计权限与个人前置。

原临时会话另保留一条确切favicon404，console.location指向该loopback源/favicon.ico；无pageerror。它不改变夹具采集结果，也不代表新版资源已修。该三例只证明旧writer产生的完整原件；后续source执行和独立boot-save迁移需要分别记录新HTML hash、实际save.migrated、完整保存read-back及两次reload。

完整诊断、截图与采集辅助脚本保存在私有QA缓存，公开夹具仅包含这次新临时游戏的世界数据。嵌套目录不进入旧9项保存投影的顶层fixture枚举，不重写旧黄金hash。
