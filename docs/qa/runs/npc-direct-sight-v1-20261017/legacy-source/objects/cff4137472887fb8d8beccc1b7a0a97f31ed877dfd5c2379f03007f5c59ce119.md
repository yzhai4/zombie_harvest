# 已结算报告启动恢复与失守重开

**状态：** validated（冻结412c/v4报告恢复主题）；发布及严格三日另验  
**范围：** 真实 loader、报告关闭、旧档迁移与会话重开；源码与完整browser门禁通过，历史失败记录保留

8a4基线源码中，`loadProgress` 读取 `saved.nightBattle.resolved` 时把 `state.night` 设为 false，但 `startFromSave` 仅在 `state.night && state.nightBattle` 分支恢复 summary-mode。独立boot-save baseline已实际复现：134项检查79通过/55失败，普通DAY对照通过，完整/矛盾报告恢复和失守重开失败。原始失败与其工件见[baseline QA](../qa/server-report-recovery-20261014.md)，不得由后续结果覆盖。

现有 `night-resolved` 保存投影夹具不含完整遭遇 instanceId；它通过投影不代表实际 loader/报告按钮已验证。新 close wrapper 对缺 ID 失败关闭是明确 Gate，但旧档应在 loader 有可审计、幂等、安全的降级，不能只靠拒绝留下不可操作报告。

同一源码复审还发现失守时 `continueBtn` 显示“重新开始”，但绑定 `continueMorning` 经普通 actionCommand 的 gameOver Gate拒绝，导致 reducer 内的重置分支不可达。后续应分离“新局重置”意图与“关闭已结算报告”命令，验证失守后的公开恢复入口；不能为了重置放开所有终局命令。

下一轮先以独立 boot-save 夹具复现完整 resolved 报告与旧缺 ID 报告，决定恢复报告还是显式安全关闭；不重打尸潮、不再次结算、不给额外配给/指挥点/奖励，保持原日历。迁移事实、night 状态、summary UI、close receipt 和两次 reload 必须一致。未验证前不得把保存投影称为完整夜报恢复。

## 已落实的源码与待完成证据

冻结开发HTML `291a75441548e25801c4140d2b6e26dea1f5c1d938de7b408d9c4fb972bfe893` 已接入dist：完整保存先select/validate/prepare再install；真实报告identity/receipt关联；专用SessionController重开；报告纯展示与关闭后DAY控件恢复；损坏/未结算显式恢复；可靠backup迁移保存与失败重试。生产SAVE18以四份原writer档验证，只补新域；初始world0修正严格限定真实首局零水位sentinel。SAVE19/20仅TEST-ONLY适配声明，不能当真实旧档兼容证明。

170项源码检查、独审76原保存/完整draft、43链/27计划日界/16区域回归通过；既有轨迹hash保持。上述均不代替真实浏览器。独立47场景首轮full已启动，审查另发现runner的B1关闭按钮覆盖缺口和B7历史receipt仍有数字的错误预期，正在改测试而不改冻结runtime。首轮原报告必须保留。B1–B16实际出口、公开重开竞态、旧档两次reload及新单构建三日仍为发布前待完成项，Sites v81没有被替换。

## 首轮终止与下一候选

上述首轮现已终止exit1，47/47场景尝试、1475检查/1463通过/12失败，仍为FAILED。独审区分错误预期和真实缺口；原报告SHA `e5caf27e869bb7e25f5b740506ba069ab11d4658d033cb118cea3874e74ceb80` 不变。跨机器归档719文件/590915755字节逐项SHA相同，归档成功不改验收结论，详见[首轮browser审查](../qa/report-recovery-browser-first-20261014.md)。

实际恢复报告还漏写防线和支援DOM，显示模板0。新候选仅从保存defense和合法唯一supportIds投影并渲染；缺项显示未记录。新冻结HTML SHA `412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8` 已接dist，177源码检查与43/27/16通过；原轨迹hash仍为 `c5d6c772` / `66c9368d`，保存投影9档仍为 `4aec7a31`。这是源码证据，新browser尚未执行。

旧B16没有观察到实际visibility事件。根代理用安装包primary source和独立data页面探针确认普通Playwright context默认模拟焦点，existing default context的公开 `connect_over_cdp(no_defaults=True)` 路线可产生trusted hidden→visible。该探针约2.876秒且未执行游戏；不能代称B16或≥60秒catch-up通过。下一48场景runner正在独审，原生路径只用于B16并严格清理独占临时Chrome/profile。详见[基础设施证据](../qa/native-visibility-infrastructure-20261014.md)。本问题仍active，Sites v81和公开测试服务尚未替换。

最新48场景v3已终止exit1，1641/1634/7，原report SHA `60b93f3e121072c5d53e1138b9d95471a857e17fae089b6444654f077e7377a8`；七个false都是把生产与开发一直隐藏的备用cropBtn当成常驻公开按钮。实际B16原生事件同generation可信、隐藏2889ms及owned清理通过，四真实18与其它1634检查无false；原整轮仍FAILED，不用源码/infra或下一版改判。下一v4 tester保持四控件禁用解除，另走真实菜畦入口并以点击前实际保存核收获、plot变化和unique command/event因果。发布仍等待新冻结全矩阵与单构建三日，不修改runtime/CSS过关。

## 完整browser出口已通过

冻结412c/v4逻辑run `run-20261014T214131Z-5c844377` 真正exit0：48/48场、1682/1682检查、errors0、notRun=[]；原report SHA `73aca16ee41438041fb9fba1955d6abf719f583f72a82290b7d34d118ae6cb36`。独审21完整性/48关键事实通过，758原工件跨机逐bytes/SHA一致。公开成熟菜畦收获食物+3和两reload、B15 queued checkpoint公开重开竞态、B16可信短隐藏/清理、四真实18迁移/两reload、缺报告统计显示未记录全部获得实际证据，见[第三轮独审](../qa/report-recovery-browser-third-20261014.md)。

本问题主题validated；v1/v3原FAILED保持。≥60秒后台追赶和storage失败路径仍属于源码控制范围，新严格三日与生产发布是另外门禁，不能从这48场推定整个v82–v90完成。
