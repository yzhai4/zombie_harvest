# 有限采集→进食→维修：版本核对与源码验收

2026-10-21。继续原开发线；浏览器和手机验收暂停，林岑邀请自然发现/真人理解维持deferred。本轮不重测邀请，不合并main或部署。

## 版本同步

实际读取PR4与当前状态，开发HEAD为f7e83d9abd12930f411df75149ca0c5748158178。上一交付包中的HTML与远端blob e22be5b43a734676e9ae9c0eefe13869913a8f5d相同，1021983字节、SHA256 41926fba6f4170011de3f225714a449104b9255235daabd18ab53054214daf28。当前工作副本为按需取回并校验的源码/夹具集合，不是假称完整git clone，也不声明用户电脑未推送内容已同步。

上轮游戏CI325/run39446470814实际已completed/failure，失败点为Check iteration evidence freshness；此前runtime步骤通过，后续两项跳过。原因与保留旧86ca发布manifest一致；这不是push失败，未降低验收器或挪用旧浏览器结果。

候选HTML SHA256 e0b9301ff227d65697efd348af99c34f8bb12a3a6eb0ed0f255df2de997de75b，1026517字节，Git blob24e463cf8e0719d574b08ac04346c5c89289ae76。完整仓库固定f7基线应用精确patch后，与本地候选及checker/新增CI步骤文件逐字节一致。提交只接原HEAD，之后精确分支/CI另读，不将工具HEAD绿色转记为新开发HEAD绿色。

## 真实缺陷与最小修复

受控whole-inline IO中的原gatherBtn注册click把MouseEvent传入preferred，导致错误操作非资源对象。实际从食物0、体力100、莓丛余量2开始，按钮后食物仍0、余量仍2、世界360→390、体力93（8支付与推进恢复分别计），却提示完成+2并发resource.collected。直接合法目标对照才真正得到2食物。无体力空成功、耗尽变负数、脱离世界副本获利及远距显式采集均有独立原反例；不是多个真人或浏览器发现率。

补丁绑定无参数click，并以唯一live资源ID/实例、原1.25范围、有限正整数余量、体力与可结算时钟统一资格。只有实际收集成功才发收据和任务事实；明确player-1和实际来源。保留原8行动体力/30请求分钟和五种原产出，不改世界危险或原功绩。收据区分直接收获与期间NPC进食/工程等净消耗。通用按钮保持DAY可点击给拒绝说明，未为隐藏错误而全局禁用。

## 实际验证

[固定候选run39534068308](https://github.com/yzhai4/zombie_harvest/actions/runs/39534068308)在工具HEAD b546fbd71c57a0a95bf763c611750094253ddc79执行14条源码命令，全部exit0。新采集24/24、原进食18/18、原维修proof41、中继维护7/7、保存恢复177、DAY致死6/6；内容71、原链54、竖切片5、replay19、static-contract55及语法/night guard/Scenario build均通过。计数不相加成独立场景或玩家。原生报告与脚本哈希见[紧凑回执](evidence/resource-gather-v1/source-receipt.json)。

直接注册按钮的受控输入完成有限莓丛1→0、食物0→2→1，再用原2木/14体力维修墙2→3，采集与维修共50世界分钟，正常writer→Continue保结果。位置、初始资源/体力/HP、损坏墙和敌人隔离都是TEST-ONLY。分数倍率.25以7整数分钟+.5余量实际保存；NPC期间吃掉1粮时毛收益2、净变化1明确分开。

HUD只检查输出字符串/属性、真实注册回调，不称浏览器排版、命中、自然路径或乐趣。已有源码IO、原Bus/推进/reducer/writer/loader均复用，业务函数未mock。当前CI在既有玩法步骤接入本轮采集及上一轮进食checker，原其他检查和freshness未弱化。

## 原失败与边界

初版checker23/24中的REPORT原因应是上层session-frozen而非day-only，修方法而非放宽业务。中间候选把DAY采集按钮按所有资格禁用，与原生命周期合同冲突；最终恢复通用DAY入口可点击说明，旧恢复测试不改并重新177通过。候选、旧checker和失败报告随交付包保留。

精简本地内容校验缺18份文档，致死检查缺既有fixture；没有伪造补件，本次完整仓库验证已分别覆盖。一次本地多命令外层执行被超时截断，已核无遗留进程，其后命令单独有限执行。一个手工转码的孤立blob哈希不匹配被拒绝，未进任何tree/执行；最终使用已核UTF8 patch，不再传全库或复制opaque数据。

本轮不启动浏览器/Playwright，不调用LLM；Windows WorkBuddy不假称已运行。原生artifact12316617760已下载核SHA，1467254字节，SHA256 0aaf28f1799018398f71b164cee41181516ed35d3a277a0ae641eadfbd11470d，保留至2026-10-28；完整原件随交付包保存，不称Actions永久存储。仓库仅放紧凑派生回执，未复制全历史证据。

## 发布与下一交付

本候选仍是source-only，SAVE21/CONTENT3和旧已发生历史保留。旧iteration-manifest-v1.json不改，本构建浏览器证据未具备；精确新HEAD完整CI不得预填通过，release仍blocked。main/生产不动。

下一沿采集→恢复→既有工程/防线→实际危机后果选择真实断点，不回到邀请窗口反复诊断，不提前扩地图/医疗/编辑器平台。正常路线、三日、玩家理解、LLM表达收益单独待验；本轮无新增全局记忆。
