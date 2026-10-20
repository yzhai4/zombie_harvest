# 当前状态

本页只保当前结果、限制与下一交付。前一邀请窗口诊断及原失败保存在[2b9e5227历史版本](https://github.com/yzhai4/zombie_harvest/blob/2b9e52274fafea55f6db0142b2bcd01ba2e8a392/docs/memory/current-state.md)，不改写原预算/终态。

## 当前交付：进食恢复与后续维修（2026-10-20）

用户已批准暂时跳过林岑邀请的自然发现/真人理解验证，继续中继与生存短循环；该邀请验证不再是开发前置。浏览器和手机验收继续暂停。

开发线仍为codex/v82-npc-succession、草稿PR4。源码提交`6db4d4ea3ba7c84499861d671fac093f05742e8d`，父2b9e5227，HTML SHA256 `41926fba6f4170011de3f225714a449104b9255235daabd18ab53054214daf28`，SAVE21/CONTENT3。只改既有进食及HUD：无粮/无需恢复明确拒绝；实际恢复量、有限一粮及成功收据一致；上限附近不虚报收益。原24体力/6生命/医生加成、零追加时间及维修规则保持。

[本轮QA](../qa/player-food-recovery-v1-20261020.md)记录源码复现、修复和18/18新合同，及真实writer/Continue/重复保护。在TEST-ONLY低体力/损坏墙面/近距/无敌隔离场景，进食后按原2木/14体力和20分钟完成修墙，不称自然玩法。

固定候选已由[远端source-only run39445290573](https://github.com/yzhai4/zombie_harvest/actions/runs/39445290573)执行13条命令均exit0，含内容71、七组54/20/21/5/30/19/55、保存177、进食18、维护7和语法/night-guard。远端执行HEAD为工具提交e07f6895，固定base+精确补丁生成同一HTML；不是未来归档HEAD的完整CI。原生报告已下载核SHA，见[派生紧凑回执](../qa/evidence/player-food-recovery-v1/source-receipt.json)。

## 开放验证与发布边界

本轮是source-only开发候选，未完成浏览器、自然短循环或真人体验。曾误用旧smoke入口，因Chrome不存在在启动前失败，未运行浏览器；原失败保留。之后仅以隔离无Playwright解释器执行原static-contract分支。

原发布manifest仍保86ca的已验证记录，不挪用到41926；严格freshness/浏览器门槛未降低，当前构建不能通过完整证据验收。提交后的CI按实际HEAD单列，不把source-only成功当全绿。main未合并，生产未部署。

复用SAVE21/C1/C2、有效岗位、中继维护、岗亭、本人记忆与既有邀请，不重开A08或修改邀请窗口。临时运输/源码执行均隔离在transport分支；它们不进入本开发分支。WorkBuddy Windows适配器因环境缺LOCALAPPDATA未执行，无新增LLM调用、费用或节省比例结论。

## 下一交付

继续“资源恢复→既有工程/防线行动→危机后果”的实际消费者，按代码与受控执行定位下一处真实缺口，完成最小玩家增量；不再反复诊断邀请或扩医疗/测试平台。邀请自然发现及真人理解保留deferred，不等待它们才开发。

浏览器恢复后单独验进食按钮、正常恢复/维修路径及玩家体验。14天危机、UI素材、受控布局→约束随机→局部演化→剧本设置器→跨副本身份/记忆、可替换引擎保持长期路线。离线恶化未定；本轮无新增全局记忆。
