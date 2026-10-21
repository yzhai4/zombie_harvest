# 严格单构建三日首轮实际结果

**状态：FAILED，原结果保留。** 本轮是独立全新profile的公开行动日历路线，实际terminal exit1，elapsed694.23秒；359项已执行检查均true，但在第二日训练循环的下一动作前等待主保存同步超时。不能用359通过或singleKnownBuild改判整轮。

## 不可变输入与实际覆盖

HTML SHA `412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8`，runner SHA `293fc76c7479cb16989510c7d2aad3e116f763f36786d52ca91c009b88229c2e`，verifier SHA `4cca9356ceba55e47d9ac6c4ec0d08b62e926d2f7df2d29930f5af62f80b7434`。显式fresh/strict-fresh/expected SHA、budget1800秒、day4清晨要求≥06:00。原profile没有重开、恢复或混用旧439/Gate90 profile；操作系统确认原PID185914已不存在。

原 `three-days-result.json` SHA `366444feeee25a99f613bdf1245e7c40a5246b774bd4a9f44bc08b6a4aefc0b9`。94份真实snapshot同SHA，四次实际document response（初始、公开reset、DAY1 reload、DAY2 reload）HTTP200且同构建；DAY1/2遭遇及day2日界已经进入，DAY3/4、实际收获和最终清晨缺失。已报告38个公开动作，其中30个训练receipt与报告逐个相联；这不是完整三日训练总数。

只读strict artifact Gate实际exit1：113项中104通过、9失败。94原保存FNV/schema/日历检查通过，连续观察到的1017个唯一事件无seq缺口；day2原计划权威/日界和DAY1/2显式reload通过。缺完整runner、后续document、day3/4计划日界、第三场遭遇、收获、DAY3 reload、day4清晨，均保持失败。没有运行developer负控。Gate覆盖不是额外游戏操作数。

## 超时可证与不能推断的内容

原错误为 `TimeoutError:primary save did not catch up to the DOM after checkpoint debounce`。最后真实已验证保存是day2 08:22／world1942／eventSeq1017／FNV `9db92f1`，对应训练 `evt-001017`、外层 `cmd-001165`、内层30分钟推进 `cmd-001166`，其before1911→自然1分钟→训练1912–1942的因果已经完成。下一公开兵营affordance检查成立，报告没有pendingTrainingAction；不能将它推定为又一次训练已执行或漏记奖励。

原runner没有保存超时循环最后poll的raw/DOM/lag/谓词情况，context在外层捕获异常前已关闭。因此最后成功snapshot和heartbeat的last_dom不是超时现场，当前根因仍**未确定**。零page/console/http错误也不能排除runtime保存失败，因为writer捕获storage异常后可以返回false。

源码事实：自然DAY tick为1.2秒、每tick推进1–5分钟，仅每第10tick请求650ms debounce保存；advance本身checkpoint:false。settle_save前置不请求保存，30秒等待时要求primary达到固定minimum且原子DOM lag在0..1。这说明正常保存机会与轮询窗口可能竞争，**不证明本次就是该原因，也不证明保存系统正确**。下一诊断只保留有界只读失败观测与截图，不放宽lag/timeout/receipt/strict条件；新run必须使用另一空profile，旧FAILED保持。

## 归档与边界

原终止数据有109声明文件／55890978字节，包含94保存、13截图、原报告及原checkpoint；profile不归档、不上传GitHub或网页根。原始文件字节清单与后续私有跨机归档分别核验，归档成功不改整轮FAILED。

本轮继续证明部分公开行动与严格source/reload约束，未证明从头三日、自然平衡、14天全链或最终版本可发布。报告恢复v4的48/1682通过是另一冻结主题，不与本轮错误互相抵消。
