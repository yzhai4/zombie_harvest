# ADR：整数分钟模拟、持久小数余量与可恢复候选写前检查

状态：implemented candidate。源码与本地浏览器列明检查已完成，开发ref／精确CI按[QA](../qa/world-clock-persistence-v1-20261018.md)终态另核；生产未部署。SAVE21／CONTENT3保持，新增可选字段不提升既有内容版本。

## 问题与目标

原3545的合法rate0.5、真实1200ms interval回调一次将日历360推进到360.5，正常writer返回true，实际validator以calendar拒绝，Continue进入RECOVERY。局部付费动作的整数预检不能保护自动tick。另一次实际诊断发现完整结构validator通过的DAY零生命／无失守记录仍被loader拒绝，因此结构合法也不能推定可恢复。原失败和方法错误分别保留。

目标是在原规则和命令总线内保留已接受的模拟时间；不禁止合法倍率、不四舍五入日历、不放宽validator，也不改变夜战620ms tick或墙钟调度策略。

## 决策

`worldMeta.clock.subMinuteRemainder`为可选规范十进制字符串：`'0'`或`0.x`，无尾零、最多324位小数、范围[0,1)。旧缺槽只读作0，普通整数路径不物化字段、不发迁移；已有坏槽拒绝，不能被JSON删除后冒充旧缺省。已经坏掉的小数日历不据此推测修复历史。

先保留原Number输入转换与倍率乘法，再将其有限Number的`toString()`十进制值与余量相加；私有BigInt仅用于有限十进制算术，不进入JSON。不能声称恢复乘法前的无限精度。whole与当前日历加总须为safe integer；schedule／phase须保持finite。只有完整分钟交真实advanceReducer，whole0不调用该函数，避免零被消费者解释成默认一步。

结转发生于原CommandBus的新成功提交。重复ID先命中原Bus去重，不再增credit；拒绝仍可能按原Bus分配父编号和写command.rejected，不宣称账本零变化。纯整数／旧缺槽路径保原payload和轨迹。fractional或已有非零credit路径增加clockPolicy=`whole-minute-v1`、scaledMinutes、remainderBefore／After，minutes始终表示真正模拟的whole。whole0的receipt只表示credit接收，不作有意义玩法证据。

暂停不发新advance、不改余量；换速、stop/start、代际隔离、DAY/BATTLE切换、休整让权与Continue保留credit。整数付费动作和rate1休整保持真实旧分钟、既有0.x余量不被消耗；不借此放开旧动作的倍率资格预检。scheduleMinutes继续作为原scaled输入遥测，phaseMinutes按whole；原timer min1/max5、后台上限和night独立时钟不扩展。

原timer成功推进且credit改变时，复用650ms debounce正常checkpoint；整数默认路径仍保每10callback保存。新非零credit可以在下一callback前进入正常writer；不依赖pagehide补证。

writer生成同一envelope raw，先执行实际validateStoredProgress，再对其payload执行实际classifySavedRecovery；拒绝RECOVERY_REQUIRED后才可读取、轮换和写主档／备份。失败返回false并显示粗粒度保存失败提示，原主备字节保留。原不允许保存的early-return保持；ensureStableIds等旧预处理仍可能改live state，不宣称整个writer回滚。分类检查不擅自把HP0改成lose，也不把旧日历补成新的时间。

## 六视角

| 视角 | 规则含义 |
| --- | --- |
| 玩家 | 合法倍率的已接受时间不会因刷新被吞掉，失败保存有可见说明 |
| NPC | 只有实际整分钟驱动需求、劳动、SAN与移动，不预发分数工时 |
| 营地 | 配给／每日upkeep按真实跨日执行，刷新不补发 |
| 势力 | 不新增信任、承诺或外交收益，既有事件仍按事实判断 |
| 敌人 | 只按真实模拟分钟行动／造成伤害，夜战规则保持 |
| 全局链 | 原实例、命令去重、账本、余量与保存恢复使用同一状态 |

## 验证与边界

原同方法3545回调负控0/1、exit1保留；当前8组时钟合同和45项既有源码合同分别验证。真实Chrome从旧writer仅预启动rate0.5，经公开Continue、正常非零余量保存、reload和新真实tick验收，绑定当前HTML；primary episode独立回归。三个午夜是独立TEST-ONLY边界，静态三日和大步日历不作自然三日或平衡证据。

原竖切片孤立改scenarioSnapshot.seed破坏真实binding，已修方法。其后真实大步战斗导致HP0但未形成DAY失守记录：新writer拒绝这份候选、保留并恢复的是旧安全checkpoint，而非保存了第三天败局。[DAY致死问题](../problems/PROB-20261018-day-fatal-outcome.md)独立保持P0；完整自然主线、玩家收益、Actor／Planning／Memory／Studio及生产另验。
