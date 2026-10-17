# 据点驻守者仍参与营地模拟

状态：confirmed / 作战边界候选，整体离营语义仍 open。生产未发布。

## 真实来源与复现

基线为源码对象 `38c7e9d6a3517270be40cf6e975ec9da7e3aaaf9`、HTML `51faa0c7c62607aa0d4e280a5bc056e4eb01b374b1ae3f45782c232445ae1662`。沿完整真实 writer 的派生离线场景，发现已有 waterMill，再调用真实 `captureOutpost` 派驻已有 guardJi；不伪造 guard ID 或反向占用标记。原 `dayNpcCanAttack` 只排 dead，驻守者仍可在保留的营地坐标攻击敌人。敌人目标和感知也仅按 active 过滤，因此它还能被营地敌人新发现并伤害。

`captureOutpost` 清理 support/order、写驻守记录与 marker，但不移动坐标。加载会重建双向驻守关系；`npcHasRole`、`npcFulfillsRole`、人口账本已用 `!garrisonedOutpostId` 表示营地可用者。这使作战侧遗漏与现有岗位资格不一致。之前注意力修复让可见敌人优先，暴露了此潜在重复参与；不能把21项 attention 检查当成据点隔离已完成。

## 最小候选与证据

候选 `71657c62e7adfcd9b6f6d7e4a8aa89a8fe0976ea6603c63b8f706e79ef68bfd8` 统一 `npcIsCampLocal = active && !garrisonedOutpostId`，用于营地NPC伤害资格、敌人目标与新感知候选、NPC直接感知入口、共享感知接收者。采用已有岗位语义；不删人口、不改据点奖励、敌人/塔伤害或视锥，也不追溯清除合法历史接触坐标。

扩充真实源码检查：候选29/29、exit0；原51f为24/29、exit1。新增反例覆盖双向伤害排除、感知/共享、死亡入口只读拒绝；真实 `releaseNpcFromOutpost` 后营地双向战斗恢复。这是source VM派生场景，未声称生产捕获、自然游玩或三日通过。原执行21脚本与报告保留原字节，不用新29计数改写旧结果。

## 尚未关闭

routine、continuous motion、render、地图getNpc占位、工作与部分群体福利仍沿active名单运行，不能由上述作战候选宣布整体离营完毕。后续需统一“世界仍存在、人口仍计数、当前营地不可参与”的投影，逐个consumer复核，避免把驻守误作死亡或从存档删人。既有critical生命状态能否战斗属于另一个设计口径，本候选不改它，也不声称已具备critical攻击禁用Gate。

六视角：玩家不能获得跨地点战斗援助；NPC保持唯一岗位与生命事实；营地不重复占用守军；据点及势力仍保留真实派驻人口；敌人只对本地合法对象新索敌；全局沿原占用/释放、伤害、事件和保存合同。更广的显示与劳动遗漏保持open，发布前按实际覆盖说明。
