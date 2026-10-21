# 断粮选择v2与自然短路线反例

2026-10-17；源码549521e1dd56be8edefaf01792fdb5e17c9dd648，HTML297327ec6d0ccedcddac0bea6b1cee1d63681f7020f0cbbccf97bdb87e0e3c54，SAVE21／CONTENT3。精确远端head与CI收据放PR #4，manifest绑定此源码祖先；本地archive没有Git，commitVerification=unavailable不能当Git通过。生产未部署，本轮未刷新Sites。

## 规则与来源

[旧32四策略实验](../experiments/EXP-20261017-food-shortage-strategies.md)确认立即ration比延期多付2崩溃且没有列示数值收益。按剧本设计师六视角评审，v2保留技术ID，改为确认保留备用粮、另行筹粮，只落历史；取粮仍有限+2食物／+2共振仪表，整局一次。实际renderer显示库存、基础日需、下一午夜和补粮后的原预警。没有增加忽略惩罚、敌人spawn或虚构后勤旅行。

定义升2，并只对可识别的未结算v1／缺版本旧shape进行纯候选适配。实际boot只发一次save.migrated元数据，旧token拒绝；旧已结算ration成本、forage exposure历史和永久flag保留，不退款、不补奖。未知版本／畸形拒绝。完整合同和六视角见[ADR](../decisions/ADR-20261017-shortage-choice-v2.md)及[设计卡](../scripts/zh-food-shortage-001.md)。

## 当前297构建结果

| 证据 | 实际结果与边界 |
| --- | --- |
| 原30条source命令＋6补充＋新检查 | 37条exit0；[命令终态](runs/shortage-choice-v2-20261017/command-exits.json) |
| 独立新source checker | [43/43](runs/shortage-choice-v2-20261017/source/candidate.json)，原32同checker有20项预期失败；完整inline／真实Gate、loader/writer、renderer与原DOM listener，IO虚拟化范围在report声明 |
| 同起点确认／延期 | 首次实际午夜资源、NPC与仪表相同，均food0／energy55／玩家HP64／collapse8／resonance25；只证明局部点击税消除 |
| 新缺粮真实Chrome155 | [72/72、三场verified](runs/shortage-choice-v2-20261017/browser/report.json)，6次HTTP同297；9份native writer、8图。已知v1待办→保留／reload；补粮旧待办→缓解提示／取粮4→6、共振25→27／reload；旧ration collapse12保留 |
| 关联源码 | episode30、rest74、presence41、attention29、方法76、安全28、static55；原三个goldens保持c5d6c772／66c9368d／4aec7a31 |
| 关联真实Chrome | 驻守[37/37](runs/shortage-choice-v2-20261017/presence-browser/report.json)、episode[12/12](runs/shortage-choice-v2-20261017/episode-browser/report.json)、休整[93/93](runs/shortage-choice-v2-20261017/rest-browser/report.json)；HTTP分别4／2／9次同297，零errors，owned资源finally清理 |

休整six verified；hidden没有产生可信事件，仍unavailable，不称后台或长catch-up通过。root目视缺粮3图、休整3图、驻守名册和episode刷新各1图。全部是声明的旧writer／派生boot夹具，boot后无GameState修改或隐藏动作，不是自然多日、生产捕获或玩家偏好。

新source runner SHA9ff416e04bce466ff303b652fbd9d1cfad104f2870baf0202c6c1c0125fd8bbf；原独立候选report SHA19b2413eb232b18ae6084abbc9b516f34c3848f6b849f527b2ed0e32a136187f。新browser runner SHA032cb18af241486544d903898bcbf96b1ea44141e5c5ed233a1cc2d0af192491；原report SHAa1d94c1c25a4325351ba4afbee90ab7dfa05ac0e5e379acb70681181d57e9fb0。17份旧baseline工件中1份是声明派生输入、16份实际source writer（含阶段别名），不是17份独立生产捕获。归档原字节与声明工件SHA逐项核验，详见manifest。

## 旧32自然短路线：四轮均未完成

[原始索引](runs/shortage-choice-v2-20261017/natural-baseline/index.json)分别绑定每轮原report、实际runner与source32，保留失败，不拼接轨迹：

1. fresh01：实际木材库存与节点变化正确，方法错误地要求默认采集回执必有resourceId；原exit1保留。另记录[来源字段缺口](../problems/PROB-20261017-collection-target-receipt.md)。
2. fresh02：原12项前缀全true／ok=true，但缺NPC／农务／休整／建造四项。独立adjudication改判coverage未完成，原JSON不改。
3. fresh03：实际NPC互动与有目标30分钟等候成功，连续导航切角阻断农田路径，exit1保留；只修runner到点判断。
4. fresh04：day1 07:49、HP100／energy66／food13／十人，覆盖事项、采集、NPC、探索和目标等候，但公开enabled播种产生crop.changed{}，同田仍未种、种子不变，无20分钟子advance，缺plant／build。原UNVERIFIED_RUNNER_FAILURE／exit1保留，另裁定RULE_OR_UI_FAILURE。

第四轮实际浮点位置与斜向源码反例都说明公开半径与五点查找不一致；只传目标还会放过非live／超距对象。下一P0按[农务问题](../problems/PROB-20261017-public-crop-target-mismatch.md)统一resolver、live身份／距离Gate和拒绝回执，再新开完整短路线。上述旧32试玩不给297自然通过；没有当前自然三日、全面平衡、真人偏好或最终尸潮通关结论。

## 后续与可恢复点

下一顺序：公开农务修复→完整自然短路线／必要三日→最小真实Scenario boot→actor知识投影。继任双岗位、零粮计划词值、任意大步模拟分片、移动端、真实hidden继续独立open；不混入本改稿。回滚源码父为7741ea4c22607064adaafc912eef2eb8b72e16d3；回滚须兼顾已保存definition2的明确兼容，不可用旧运行时直接吞未知定义。

新增L1是ADR、实验与农务／采集问题；Skill与工作流只吸收可复用教训。用户报告与仓库归档已重核同SHA940efac9a98227db2b4512771e474c8366b629d50d72d8e912923d83e2cf06ee；原文是设计依据，不是运行时验证或已核论文统计。无全局记忆变更。
