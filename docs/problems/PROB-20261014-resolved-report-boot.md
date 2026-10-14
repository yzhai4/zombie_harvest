# 已结算报告启动恢复与失守重开

**状态：** active  
**范围：** 真实 loader、报告关闭、旧档迁移与会话重开；源码已修复，完整browser门禁仍active

8a4基线源码中，`loadProgress` 读取 `saved.nightBattle.resolved` 时把 `state.night` 设为 false，但 `startFromSave` 仅在 `state.night && state.nightBattle` 分支恢复 summary-mode。独立boot-save baseline已实际复现：134项检查79通过/55失败，普通DAY对照通过，完整/矛盾报告恢复和失守重开失败。原始失败与其工件见[baseline QA](../qa/server-report-recovery-20261014.md)，不得由后续结果覆盖。

现有 `night-resolved` 保存投影夹具不含完整遭遇 instanceId；它通过投影不代表实际 loader/报告按钮已验证。新 close wrapper 对缺 ID 失败关闭是明确 Gate，但旧档应在 loader 有可审计、幂等、安全的降级，不能只靠拒绝留下不可操作报告。

同一源码复审还发现失守时 `continueBtn` 显示“重新开始”，但绑定 `continueMorning` 经普通 actionCommand 的 gameOver Gate拒绝，导致 reducer 内的重置分支不可达。后续应分离“新局重置”意图与“关闭已结算报告”命令，验证失守后的公开恢复入口；不能为了重置放开所有终局命令。

下一轮先以独立 boot-save 夹具复现完整 resolved 报告与旧缺 ID 报告，决定恢复报告还是显式安全关闭；不重打尸潮、不再次结算、不给额外配给/指挥点/奖励，保持原日历。迁移事实、night 状态、summary UI、close receipt 和两次 reload 必须一致。未验证前不得把保存投影称为完整夜报恢复。

## 已落实的源码与待完成证据

冻结开发HTML `291a75441548e25801c4140d2b6e26dea1f5c1d938de7b408d9c4fb972bfe893` 已接入dist：完整保存先select/validate/prepare再install；真实报告identity/receipt关联；专用SessionController重开；报告纯展示与关闭后DAY控件恢复；损坏/未结算显式恢复；可靠backup迁移保存与失败重试。生产SAVE18以四份原writer档验证，只补新域；初始world0修正严格限定真实首局零水位sentinel。SAVE19/20仅TEST-ONLY适配声明，不能当真实旧档兼容证明。

170项源码检查、独审76原保存/完整draft、43链/27计划日界/16区域回归通过；既有轨迹hash保持。上述均不代替真实浏览器。独立47场景首轮full已启动，审查另发现runner的B1关闭按钮覆盖缺口和B7历史receipt仍有数字的错误预期，正在改测试而不改冻结runtime。首轮原报告必须保留。B1–B16实际出口、公开重开竞态、旧档两次reload及新单构建三日仍为发布前待完成项，Sites v81没有被替换。
