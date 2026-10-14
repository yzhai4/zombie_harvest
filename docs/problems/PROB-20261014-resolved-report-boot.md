# 已结算报告的启动恢复分支待核验

**状态：** active  
**范围：** 真实 loader、报告中途关闭与旧档降级；下一可靠性主题

源码复审发现 `loadProgress` 读取 `saved.nightBattle.resolved` 时把 `state.night` 设为 false，但 `startFromSave` 仅在 `state.night && state.nightBattle` 分支恢复 summary-mode。两条条件不一致：从已结算尚未关闭报告恢复，可能直接回到普通世界而没有对应 `threat.closed`。当前三日 runner 对这种状态要求真实公开报告与因果关闭，不能凭同分钟事件猜测；本条是源码疑点，尚未做独立 boot-save 浏览器复现。

现有 `night-resolved` 保存投影夹具不含完整遭遇 instanceId；它通过投影不代表实际 loader/报告按钮已验证。新 close wrapper 对缺 ID 失败关闭是明确 Gate，但旧档应在 loader 有可审计、幂等、安全的降级，不能只靠拒绝留下不可操作报告。

同一源码复审还发现失守时 `continueBtn` 显示“重新开始”，但绑定 `continueMorning` 经普通 actionCommand 的 gameOver Gate拒绝，导致 reducer 内的重置分支不可达。后续应分离“新局重置”意图与“关闭已结算报告”命令，验证失守后的公开恢复入口；不能为了重置放开所有终局命令。

下一轮先以独立 boot-save 夹具复现完整 resolved 报告与旧缺 ID 报告，决定恢复报告还是显式安全关闭；不重打尸潮、不再次结算、不给额外配给/指挥点/奖励，保持原日历。迁移事实、night 状态、summary UI、close receipt 和两次 reload 必须一致。未验证前不得把保存投影称为完整夜报恢复。
