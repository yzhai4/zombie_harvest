# 非默认时钟倍率与整数日历不一致

状态：2bad候选已完成本地开发验证，精确新ref／CI与生产另核。原复现和历史状态保留下文；完整合同及证据见[时钟QA](../qa/world-clock-persistence-v1-20261018.md)。整数分钟＋持久余量、旧missing无新迁移、原Bus去重、暂停／rate／休整／原callback所有权均已接线；writer同raw结构与恢复分类均通过后才写主备。它不自动修复旧坏小数日历，也不修复独立DAY致死缺失结局。

2026-10-18补充：HTML3545adb19fc8e75256013a50ce9885e051aa4170757a0c33095cc682cfcb7aa1，在完整旧writer仅预启动调整合法rate0.5后，真实Continue至DAY；调用实际已注册1200ms interval的原callback一次（方法未直接调用advance），日历360→360.5、time.advanced.minutes=0.5。正常writer返回true，实际同字节validator以calendar拒绝；第二个运行时用实际storage Continue得到RECOVERY／no-valid-primary。诊断报告SHA e29b41aabc4b6bb44a3aa2a555eb751b4553433f080fc0ae437105b5c50d4a14，实际terminal／exit0仅表示COUNTEREXAMPLE_OBSERVED，productFixAcceptance=false。此处记录本地已保留诊断摘要，完整方法／输入尚未作为仓库独立复放包发布，也无Chrome或生产证据。

下一合同采用整数分钟模拟＋可保存的十进制小数余量，暂停、换速、重复与Continue不得吞掉或重复增加余量；writer完整候选必须先通过实际validator才能接触主档／备份。当前只有设计和checker／Chrome方法草稿，未改HTML或schema，未取得修复通过。

19cb的validatePayload允许clock.rate在0.25至4之间，日历minute却必须为整数。通用advance直接计算minutes×rate，再加到state.minute；既有15分钟NPC动作在rate0.25／0.5后产生3.75／7.5分钟。实际save()物理写出并返回true，而原生validator读取该完整writer以calendar拒绝。候选r2提前拒绝这些付费动作、不支付2体力／不推进；rate0.8的该15分钟动作产生12分钟，rate1产生15分钟，分别保留。动作能整分钟结算不证明该倍率下所有自动tick／其它动作都安全。

来源为[原始源码审计](../qa/runs/npc-public-actions-v1-20261017/source-audit/audit-clock-and-completion.json)（SHA a2d6f404c82a07aadde795424d25d56db047f8a27c3b0ed15ff0303d6d76bebf）及实际完整writer／loader。该受控场景停止自然timer并显式设置合法非默认rate，未替换advance／writer／validator，不是自然浏览器证据。

后续需统一时钟倍率、动作前置、分钟表示和writer有效性合同；核实际自动tick、所有相关动作、午夜、旧档和刷新。不能用全局坐标／时间取整或静默忽略保存失败掩盖漂移，也不能重算旧档资源、人口或日历。先明确希望支持的时间分辨率，再决定表示和迁移。
