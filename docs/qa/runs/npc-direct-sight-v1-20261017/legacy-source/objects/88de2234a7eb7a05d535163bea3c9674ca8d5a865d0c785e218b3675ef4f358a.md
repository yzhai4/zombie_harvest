# 非默认时钟倍率与整数日历不一致

状态：open，实际源码场景已复现；没有据此声称默认rate1流程或当前线上受影响。NPC动作切片只提前拒绝该动作已知不能保存的结算，没有完成全局时钟修复。

19cb的validatePayload允许clock.rate在0.25至4之间，日历minute却必须为整数。通用advance直接计算minutes×rate，再加到state.minute；既有15分钟NPC动作在rate0.25／0.5后产生3.75／7.5分钟。实际save()物理写出并返回true，而原生validator读取该完整writer以calendar拒绝。候选r2提前拒绝这些付费动作、不支付2体力／不推进；rate0.8的该15分钟动作产生12分钟，rate1产生15分钟，分别保留。动作能整分钟结算不证明该倍率下所有自动tick／其它动作都安全。

来源为[原始源码审计](../qa/runs/npc-public-actions-v1-20261017/source-audit/audit-clock-and-completion.json)（SHA a2d6f404c82a07aadde795424d25d56db047f8a27c3b0ed15ff0303d6d76bebf）及实际完整writer／loader。该受控场景停止自然timer并显式设置合法非默认rate，未替换advance／writer／validator，不是自然浏览器证据。

后续需统一时钟倍率、动作前置、分钟表示和writer有效性合同；核实际自动tick、所有相关动作、午夜、旧档和刷新。不能用全局坐标／时间取整或静默忽略保存失败掩盖漂移，也不能重算旧档资源、人口或日历。先明确希望支持的时间分辨率，再决定表示和迁移。
