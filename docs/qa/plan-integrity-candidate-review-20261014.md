# 计划会完整性候选：独立只读审查

日期：2026-10-14。审查对象为私有候选 `fb871d8a…`，基线为仓库冻结 `412c69fd…`。结论：**两处运行时修复的方法检查通过；本主题未进行真实浏览器验收，UI 权限提示仍有缺口。** 本审查没有修改候选、仓库 dist、原检查脚本、服务器或 Sites。

依据为 [07 计划会与 commandPoints](../../剧本/尸潮农场/07_计划会与commandPoints.md)、[camp-plan-meeting-001](../scripts/camp-plan-meeting-001.md)、[问题卡](../problems/PROB-20261014-plan-integrity.md)及实际完整 HTML。只裁定低信任权限和同日会议冻结；十名 NPC 个人链、有效票重构、主动技能、MeetingV2、平衡与完整 v82 仍在范围之外。

## 精确对象与复验

逐字节 diff 确认仅两处业务修改：

1. `generatePlanMeeting` 的重复条件改为当前日且 `status !== 'idle'`，不再受 `force` 影响。
2. `commitPlanMeeting` 在原 night/current-day/status 检查后、CP 扣除前加入 `campTrust < 60` 拒绝。

没有改变保存版本、内容版本、候选权重、效果、旧计划结算器或现有 `force` 在超过第13天时的窗口语义。

| 工件 | SHA256 |
| --- | --- |
| 基线完整 HTML | `412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8` |
| 候选完整 HTML | `fb871d8a765c757bd879734fe04545fc0b9e6e299e10abac11b5318e8c7a2551` |
| 原私有 `check-plan-integrity.mjs` | `2904762f46954156a911a3f9168c1be3630582b01faa06ad32173fd433d06548` |
| 未修改的 recovery VM adapter 来源脚本 | `ee5bb659c0439044e1ec07a4aecf931293457c2478f35d0850fe90770b4367cf` |
| 独立候选复跑 `independent-plan.json` | `3d2c08e7c225982c20e2f9a3107a78558a4091a290c60eb4f79d76b6ebf9be0b` |
| 独立基线复跑 `independent-plan.json` | `15ab5d226ec1187c3af5b9e3689d720555acb7c703dd5775a17b76a613341b9a` |
| 完整 TEST-ONLY 旧 writer 输入 `legacy-committed-basewriter.json` | `d9b8811fed88c25f9f1da0849d772d92e19742280f41e2aec3871d178d9bb05b` |
| 独立补充 `supplement-report.json` | `22a641e80795a2023af6062189173d83f28c05de5077837d1a43f4645180a6f1` |
| 独立补充方法脚本 | `cdc29420574d139f31bc043056112d2072976c21bb6506a387d3f9a239f8da09` |

两次原脚本复跑各使用单独私有输出目录，避免其同名旧 writer 输出互相覆盖。复跑报告与负责人原报告 SHA 完全相同。结束后重新核验候选、检查脚本及仓库基线 SHA，均保持原值。

| 检查 | 本次独立结果 | 证据类型 |
| --- | --- | --- |
| 原48项，基线 | 19/48；exit1；29个失败保留 | 完整 inline VM |
| 原48项，候选 | 48/48；exit0 | 完整 inline VM |
| 补充旧档重复执行/前后保存重载/原计划 renderer | 36/36；exit0；其中包含对已知 UI 缺口的观察断言 | 完整 inline VM |
| 原报告恢复及真实 SAVE18 原件兼容 | 177；exit0 | 源码/保存契约 |
| 原内容链 | 43；exit0；`c5d6c772` 保持 | 源码命令轨迹 |
| 原计划/日界 | 27；exit0；`66c9368d` 保持 | 源码计划轨迹 |
| 原营地区域 | 16；exit0 | 源码契约 |

## 业务结论

低信任拒绝位置正确。0、19、20、40、59、59.99 的 support/deny/modify 均经过实际 CommandBus，返回 `camp-trust-low`。CP、完整 contentState/计划、资源、NPC、world 和 RNG 不变，没有 `plan.meeting.committed` 或成功奖励。拒绝仍记录实际输入 replay、命令水印及唯一 `command.rejected`，这符合拒绝合同，**不是整份状态或账本零变化**。60/80 的合法干预仍扣1 CP并留下唯一 committed 回执，第二次不同命令ID干预拒绝。

同日 candidate 与实际 committed 在普通和 force 重生成时均原样返回 duplicate：候选、选案、playerAction、CP、历史、事件水位保持。额外 SUMMARY 无法清掉原承诺后再次花点。合法次日 resolved 保存满足 `resolvedDay > meetingDay`，所以新一天第一次生成仍允许；新会议继承前一天历史，随后 force 也被冻结。

旧 committed 恢复没有被新权限追溯撤销。输入由完整旧412c源码在显式 trust20/CP2 状态下经实际 commit 和 writer 取得：SAVE21、FNV `707889bd`、`camp-plan-meeting-001:d1`、committed、CP1，旧校验器实际接受。候选 loader 保留原计划和已花 CP，不补点、不发迁移或奖励。此输入为**合法 TEST-ONLY 旧 writer 保存，不是自然游玩或生产捕获**。

原48项在第一次日界看到一个 resolved/history，但单凭这项不充分证明重复或重载结算幂等。独立补充对此取得实际证据：

- 两次结算前保存/新 VM loader 重载均保留 committed、CP1、同一实例及保存字段，没有提前执行。
- 实际 `advance(1080)` 从 day1 06:00 跨入 day2，仅有一条 `plan.meeting.resolved` 与一项 history。
- 立即重复原 `executePlanMeeting` 和 `runPlanMeetingDayStart` 均返回 `plan-not-due`，不再奖励、刷新 CP、追加回执或历史。
- 两次结算后实际 writer 保存/loader 重载保留原实例与结算字段；每次再调用两个原函数也不补收益，原唯一 resolved 回执和 history 保持。
- day2 首次生成会议允许，继承 day1 history；再 force 返回 duplicate，不改账本或会议。

## 输入与方法诚实度

未发现通过手造成功事件或替换两个修改函数来制造通过。commit、generate、CommandBus、日界、效果事务、loader/writer 执行的都是完整候选 HTML 定义。结果依据独立的拒绝原因、实际扣点、回执数量、前后状态和保存恢复，不只检查源码中是否出现新条件。基线真实失败没有被预期失败标签改成成功退出。

夹具有三条必须保留的限定：

1. trust0/19 配 CP2 是显式反事实权限负控，不能据此声称正常流程会发这些点数；它有助于证明信任 Gate 独立于 CP。
2. 同日 resolved/fallback 场景由真实日界结算后改日期别名得到，是声明且未保存的 transient 输入。合法 SAVE21 的 resolved 必须晚于 meetingDay；这些测试不能冒充合法旧档。当前 fallback 实际 status 为 `resolved`、route 为 `fallback`。
3. 效果失败通过显式非法 op 诱发，只证明现有事务降级路径；不能代称自然资源不足、完整长期剧本或死亡投票测试。

存在明确的依赖遮蔽，必须收窄原检查文件开头“所有 dependencies 未 mocked”的措辞。复用 adapter 去掉 bootstrap 最后一次 `render()`，并在启动后把 **`renderWorld`、`renderHud`、`renderContext` 替换为空函数**；DOM/CSS、真实 RAF/interval/时间与 IO 受控。业务 Gate 与效果没有被替换，但这不构成完整展示/公开交互/异步竞态证据。尤其原 `renderContext` 会调用 `evaluateNpcPromotion`，并非完全无状态副作用的绘图函数；其遮蔽不能证明真实完整会话中的晋升或票型变化正确。

独立补充第一次使用未经序列化的 runtime NPC/feedback 比较重载时，因非持久 `prevX/prevY/facing`、未定义 motionTarget 与反馈队列产生失败。检查失败原件保留为 `supplement-failed.json`，SHA `d2232b8befa94eb370ce02003bc72a9d7905f84508d85b207abcc880d09bb843`。查实际 writer 后，重载比较改为**实际 `serializeNpc` 声明字段与 writer 的空 feedback**；即时重复调用仍比较未过滤的运行时事实。没有删减计划、CP、奖励、日期、NPC持久字段、world、RNG、命令/事件水位或结算账本以让失败消失。这是审查方法修正，未发现候选新增持久数据丢失。

## UI 缺口与出口

实际独立调用原 `renderPlanMeeting`，trust20/CP2/current-day candidate 输出7个支持/修改/否决按钮，全部没有 disabled，并显示“可消耗 1 点指挥点作出决定”。同一个行动经 reducer 正确被 `camp-trust-low` 拒绝，CP2及会议保留。源码 `handlePlanMeetingAction` 对此仅提供通用“计划会暂时无法提交”提示。

因此规则修复可作为两行源码候选接受；**不能据此称计划会 UI 权限体验已完成**。界面后续须采用相同信任权限条件并给出具体旁听/权限说明，继而在真实公开入口验证低信任不可干预、阈值60合法干预、同日额外总结和保存重载保持一次承诺。不得用隐藏按钮点击、运行时注入或 renderer 空函数替代该浏览器验收。

本主题没有 browser 启动或自然游玩。此前412c报告恢复48场景的通过不能移用为本候选的浏览器通过；全十NPC、MeetingV2、14天路线与平衡也未由本次证据实现或验收。原两行候选的无破坏性方法结果与已知 UI/展示依赖限制分别保留。

新增项目记录仅为本 QA 文档；无新增全局记忆。
