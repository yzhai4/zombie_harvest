# 据点在场合同开发验收

日期：2026-10-17；状态：本地源码与真实浏览器夹具通过，当前开发PR的Git来源CI另验；生产未部署。

运行时来源 `68028d0763c3a5d02ed8db9638823f33069efd18`，HTML SHA-256 `efe039775346f4ee34269495810d9d9e778603d2bfac26996ff5e0b884cd7f0b`，SAVE21/CONTENT3。回滚字节为 `71657c62`，它仍有非作战离营缺陷，不称完整修复。设计见[ADR](../decisions/ADR-20261017-outpost-presence-v1.md)，当前证据见[manifest](iteration-manifest-v1.json)。

## 实际变化

驻守者保留人口、生命、需求、共享个人配给和据点维护；退出营地日程/移动、占位/显示、交互、劳动、福利、现场见证、投票与昼夜支援。wrapper和直接capture effect均检查派后至少1名本地人；assignJob与驻守双向互斥。捕获清理本地命令，释放选择营地核心合法位置，不恢复旧支援。

活人现场事件延期而非按死亡取消，保留原EventInstance；动态定义经真实boot重新注册，返营后真实选择仍可结算。计划会拆分只读候选计算与发布：所有拒绝及刷新后目标校验先完成，合法提交才发布当前票源、扣一次CP并commit。既有committed历史不重建。

## 源码与回归

| 原生检查 | 结果及范围 |
| --- | --- |
| `check-outpost-presence-v1` | 当前41/41，冻结71657为14/41、exit1。真实writer、capture/release、效果、队列、计划和具名DOM/Canvas renderer；离线派生场景，不称浏览器 |
| `check-npc-threat-attention` | 当前29/29；保留LOS/FOV/射程与伤害 |
| 原30条命令 | 全exit0；链54、计划日27、区域16、parity20、observer21、竖切片5、episode30、replay18、static55 |
| Goldens | 源码链轨迹`c5d6c772`、计划轨迹`66c9368d`、保存投影`4aec7a31`不变；只对应各自覆盖范围 |
| 方法检查 | evidence verifier76/76、安全runner28/28；不是自然玩法结果 |

旧局部抽取夹具补齐合法event/UI/logs回滚域，加载真实在场/计划helper；未改断言或goldens，移除了计划命名空间占位函数。初次隔离副本缺docs输入或使用旧测试副本的失败日志保留，不称运行时故障。原生static报告用程序的`--report`输出；曾误选人类可读stdout造成manifest19/20，原失败保留，换用原生报告后本地20/20，Git校验因archive无`.git`仍为unavailable，交由当前CI严格核验。

## 真实Chrome155夹具

[驻守报告](runs/outpost-presence-20261017/presence-browser-report.json)：37/37、exit0、零errors；原report SHA `0ce5aaffcc81a963ae15d84a1140ef55fe1ee5a06b8217a0770efec376402f3f`，执行runner SHA `718c1ab8eaed3e3bf2f42b6543ab585f8a305c1a776176452add5fc1e084beb2`。4次主文档HTTP均为当前efe039。

- boot前从完整旧writer派生隔离场景，清除既有敌人、重定位与适度需求全部声明；afterboot只用公开UI。公开接管水车派出两名现有守卫，名册仍十人、在营8/驻守2，驻守卡disabled，本地医生对照保留。
- 实际Canvas绘制前含两守卫、派后及刷新后不含，医生仍绘制；E通过成功receipt关联真实replay command，选择本地NPC且不选驻守者。Canvas spy只观察IO并执行原方法，没有替换renderer。
- 独立23:40 boot夹具公开兵营训练30分钟，到第2天00:10；全十人口配给3与水车维护1分别支付，food30→26，刷新后仍26且不重付。驻守者无本地训练记忆，本地守卫有真实训练记忆。
- 7张原截图、Canvas帧、两份输入及实际保存按原字节归档；root目视派前/派后/名册/刷新地图/午夜共5张。browser/context/HTTP均finally关闭，终态后无该runner的Node进程。

debug01–04分别因Canvas帧采样、派后帧采样、E回执断言及两阶段E等待而失败，原报告不覆盖；debug05为旧runner36/36，不与最终37相加。最终额外验证本地训练记忆正对照，执行副本与来源独立绑定。

[断粮episode报告](runs/outpost-presence-20261017/browser-report.json)另以新Chrome完成12/12，零errors、两HTTP同efe039；root目视两截图。它验证公开选择/真实支付/episode身份/刷新去重，不代替驻守或自然三日。

## 六视角与剩余边界

| 视角 | 已验证的合理性 |
| --- | --- |
| 玩家 | 地图/名册/公开交互与真实在场一致，不能隔空获援；资源支付和拒绝可追踪 |
| NPC | 同一身份继续需求及共享配给，离营不冻住生理、不隔空进餐训练/治疗；活人事件保留 |
| 营地 | 十人总量、八本地/二驻守守恒；工作、福利和防线不重复，维护与人口配给分别结算 |
| 势力 | 据点由已有守军占用，继续有限维护；没有新增远端生产、交易、配送或救援 |
| 敌人 | 驻守者不当营地肉盾或攻击源；保留已有索敌、预算与伤害规则 |
| 全局链 | 原事件身份/版本/actor跨保存保持；拒绝不发候选成功记录，合法计划一次CP，完整效果回滚 |

该验收覆盖当前列明consumer与夹具，不改变critical政策，也不关闭[继任双岗位](../problems/PROB-20261017-effective-role-exclusivity.md)。共享库存是项目经济抽象，个人配给、日配给、upkeep和玩家进食需分列评估，尚未证明平衡。没有远端战斗、真实旅行/召回或完整NPC自治。

当前构建自然三日、断粮激励、Scenario真实boot、actor知识投影、14天全链和Sites部署仍未完成。旧51f训练式C、原A/B失败及之前的浏览器证据保持原构建范围；本次午夜夹具不能升级为自然多日。
