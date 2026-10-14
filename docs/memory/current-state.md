# 当前状态

**更新时间：** 2026-10-14  
**基线：** `zfarm-world-1.0` 文档基线；工作树存在未提交运行时变更  
**状态：** active

## 可验证事实

- 当前游戏是 Web/Canvas 竖切片，规则、UI 和内容注册仍主要位于 `dist/index.html`。
- 已有昼夜循环、SAN、事件账本、内容注册表、统一效果 reducer、保存迁移、计划会和 replay harness。
- 设计基线采用 day14 最终尸潮，正常结算窗口为 day12–16。
- 长期路线已扩展为 v82–v85 游戏完成、v86 GameCore、v87 受限首脑、v88 评测、v89 优化、v90 开源。
- Colab T4 只作为可恢复批量实验节点；轻量云服务器承担实验控制面、队列、结果索引和轻量 dashboard，不承担大模型推理。

## 当前工作树注意事项

- 代码、交接文档、夹具和 validator 已统一到 `SAVE_VERSION=21`、`CONTENT_SCHEMA_VERSION=3`；v82 接入 NPC 属性、英雄状态和 `npcRoster` 迁移默认值，v83 前置切片接入据点守军人口账本与每日 upkeep。
- 当前运行时仍是竖切片：英雄晋升条件、指挥点消耗、岗位效率、角色卡展示、岗位继任、据点固定人口占用、守军死亡释放、每日维护、已发现据点的最小捕获入口和 active content chain 事件面板已接入；完整十人主动技能、势力奖励、科技/建筑动态卡片和最终尸潮仍待补齐。
- NPC 个人事件在结算前会重新检查活动状态；死亡/失踪事件会取消并写账本，队列会继续寻找可用 NPC，不再被失效首项卡住。
- 注册链事项选择器、全选项、结果回执已经接线；成功效果后写权威节点，optional resolvedNodeIds 保留完整结算事实。注册/UI/reducer 拒绝坏 requirements，长循环、失败回滚、重复命令与恢复有真实源码执行证据。

## 最近验证

- `node scripts/check-night-guard.mjs`：通过。
- `node scripts/replay-harness.mjs --self-test`：通过，9 个夹具，当前 hash `4aec7a31`；覆盖五日 NPC 晋升/暂代、死亡 NPC 事件取消、据点守军 upkeep 和 `watermill-002` active-chain 投影。
- `node scripts/check-content-chain.mjs`：43 项通过；真实源码命令轨迹 hash `c5d6c772`，与保存投影分开；含22节点循环与中间节点 JSON 恢复。
- `node scripts/check-inline-syntax.mjs`：通过；项目 iteration Skill 的 UTF-8 quick_validate 通过。
- `node scripts/validate-content.mjs`：通过，SAVE21/CONTENT3 已对齐。
- `node scripts/smoke-three-days.mjs`：55 项通过；Playwright 本机不可用，服务器真实浏览器已覆盖关键闭环。
- GitHub draft PR `#4` 维护该切片；workflow 加入源码执行、night/content、保存投影和静态 smoke，最终检查状态以对应提交为准。Sites 本轮再次实查 public/active、revision6、当前公开版本81，源提交 `f3488457286836bf986dc90b5e0c3f6f425813c9`、部署 `appgdep_6acaec9bc34081918f91a616b8f56dd4` 状态 `succeeded`；真实浏览器点击继续后地图及“已继续存档”可见，部分匿名 HTTP 出口仍403。这是入口验证，未声称全面玩法回归；该生产源未被本轮开发草稿替代。
- 上轮提交核验：PR head `446e6071791ce14f96477da3313cf440203886d4`，Actions #59 / run38601237119 在该提交 success，日志明确执行43项源码检查。该旧绿色不证明本轮尚未推送的日历/CP/区域/报告修复。
- 服务器真实浏览器 smoke 已通过 22 项，覆盖 NPC 角色卡与首日晋升门控、夜间总结、回到白天和刷新后继续存档，记录在 `docs/qa/server-playtest-20261014.md`；线上 Sites 可公开访问，但浏览器插件对大型 Canvas 页面仍会超时。
- 事件链独立浏览器夹具回归24项通过：水车双路线、结果/双击、切换、刷新、坏项、Gate、第3选择和390px布局，详见 `docs/qa/server-content-chain-20261014.md`。该证据不是自然四日通关；自然多日 smoke 仍待补齐。
- 服务器 80 端口由 `zfarm-v82.service` 托管，systemd `enabled/active` 均已验证。

## 下一轮入口

保持 SAVE21/CONTENT3。优先补自然多日 browser smoke 与缺包启动诊断，再接科技/建筑动态卡及水车供水/工时/缺岗分支。不要把保存投影、静态 smoke 或未使用的 watermill_t2 flag 当成完整能力。本轮新增问题/决策为 `PROB-20261014-content-chain-runtime`、`ADR-20261014-content-chain-receipts`；长期目标仍 active。

只读预审发现三日 browser runner 错把关闭可选遭遇报告当成 day+1；实际 world 钟独立推进，且尚无每日夜潮自动调度。先处理 `PROB-20261014-three-day-smoke-assumption`，新 runner 明确日历与遭遇两种证据，不直接改变游戏时钟语义。

## 本轮日历可靠性（进行中）

源线对账：`f3488457286836bf986dc90b5e0c3f6f425813c9` 是当前公开 Sites v81 源提交，不是已经失效的旧源；本地/测试服务器的 `8a4abf...` 是 HTML SHA256 标识的未推送独立开发草稿，不能直接覆盖线上。先前凭据请求的 HTTP429 / Cloudflare 失败保留；第二次请求已成功，`publish_on_push_accepted=false`。官方 Sites helper 只读打开独立兄弟目录 `IMSAVER-sites-v81-source-20261014`，HEAD 与公开源精确一致、工作树为空，源 HTML SHA256 为 `11f25c4e68f7360a11b8c84a638b0f8a8270202af3bcf58b3047d278b4952400`，本次源码同步已可用。没有提供 archivePath，没有 package/commit/push/Sites save/deploy，也未发布开发 `8a4abf...`。同步和入口确认不等于本轮最终浏览器或 CI 已完成，详细记录见 `docs/qa/sites-public-access-20261014.md`。

当前本地/服务器 HTML 为 `8a4abf285651e5ee78905da2b819648aa1ef862e580e8b4710e8c71079604ba0`；计划效果后重新写权威对象、同日不回补 CP、统一1.25附近距离、区域命令账本/checkpoint、已结算报告关闭的具体 threatId 回执均已接线。27项plan/day/close源码检查（hash `66c9368d`）、16项camp-area、43项chain（`c5d6c772`）通过；保存投影仍9夹具/`4aec7a31`。

该构建26项显式浏览器夹具与27项独立新局基础检查通过。新基础采集已证明wood24→28、具体新收据、对应命令与checksum；旧22项中的时间文字检查不证明采集。三日日历公开行动 runner 的七次失败均已留档；同一持久profile的 day3 日界已验证，attempt7为210项检查中209项通过、1项失败，刷新自然推进1分钟被严格相等断言误判，正在修正测试恢复。独立artifact前缀 Gate为53项中48项通过、5项未完成，仍缺day4/night3/收获/最终证据；最终三日通过尚未确认。详见 `docs/qa/calendar-public-actions-20261014.md`。

本轮新增问题为计划结算/CP、附近范围、报告关联与下一主题计划投票投影；新增剧本卡为 `calendar-settlement-001`。工作流/iteration Skill 已补日历与遭遇区分、same-minute收据、真实收获/人口Gate、持久恢复与轮询。无 Codex 全局记忆变更。

## 最新草稿提交与真实前缀（2026-10-14）

GitHub PR #4 head 已实查为 `f72503d939b79d943c35273f1e463fb7dde7af59`；树 `969cc9c0ce3196965de0005e93df514442bba0dc` 的16项核心文件逐个 Git blob SHA 与冻结原始字节核对一致。HTML 仍为 `8a4abf...`，已进入独立草稿分支，未推入 Sites 源仓库。上文“未推送”描述的是此前检查时点；本地 Git 索引仍不代表远端最新提交。

Actions #60 / run `38620407670` / job `116046147068` 在精确 head `f72503d...` success，已读步骤和日志确认43项chain、27项plan/day/close、16项area，以及9保存投影/55静态 fallback。CI没有运行真实三日浏览器，不把绿色作连续体验证明。

同一原profile attempt8已有实际day2/3/4日界、night1/2/3和真实收获；347项检查通过，末段day4训练保存同步超时使整轮exit1。独立artifact Gate69/71通过，57份原保存已核验；仍缺最终day4清晨保存。只读主档明确训练实际发生（evt-002562/cmd-002319，4356→4386分钟/+30），没有重新执行奖励；4355仅checkpoint水印，不是可重造的完整前态。恢复只能引用既有原snapshot56及完整自然tick账本。原失败、10份未知source快照和历史day2刷新缺口均保留。

报告恢复设计卡 `resolved-report-recovery-001` 已编写，第二轮独立boot-save browser已在冻结8a4构建上终止：134项检查中79项通过，正常DAY对照通过，5类报告/失守案例失败，共55项失败。第一轮DAY中的pagehide原因误断言已经区分并修正，不把正常DAY启动记为游戏故障；报告恢复和失守重开仍未修复。其profile与主三日运行分开。长期目标仍active。

原snapshot56完整保存实查为第4天00:25 / savedAt4345 / seq2539 / FNV9787e965；摘要中的4325是算术错误，恢复只从原件派生分钟。独立迁移审计逐字节核对57保存、21截图，报告仅81处声明路径替换；两份Gate唯一差异是允许根目录数量2→1，仍69/71，未把原失败或最终阶段缺失变成通过。见 `docs/qa/portable-artifact-audit-20261014.md`。

原三日profile的attempt9已真实终止exit0：439项当前runner检查通过、独立artifact Gate90/90，76份原保存；最终第4天06:36 / food6 / 十人 / FNV a0c68982 / seq2746。92次30分钟训练收据和报告动作一致，遗留evt2562只恢复一次没有重按。八次失败、早期10份source未知及历史day2显式reload缺口保留，单构建从头路线仍待补。终止后76保存/24截图已导出私有bundle；原report SHA62ad36b2c7add9d2e36148655cd1755de25c42563e7861e66dce887bcc2ab564。旧“最终缺失”描述均为历史时点。当前开始完整报告恢复/安全重开候选，未部署候选或发布Sites。

证据检查点已保存到PR #4新head `e30d161986b7b9cebd625e48290fc82961760248`，parent f72503d、tree41f7a06521b069f4d0d268415cfe039b43db2322；40项显式白名单Git blob SHA全部吻合，dist原字节未变。CI #61 / run38626639869 / job116067351554在精确e30d161成功，实际日志确认源码hash/保存投影hash保持、55静态fallback和exporter语法；没有CI browser。终止后Windows私有ACL输出也成功重绑定76保存/24截图并重算同一Gate90/90，原report不变。新诊断runner SHA3e9921b66a3162c5db2611d1c268f2fd257ec6654e1f0e97e0ea60a9d55f58d3已编译及6项纯源码诊断正反例通过，实际attempt9执行仍是becef233，不混称新诊断已browser通过。恢复候选与B1–B16还在独立实现/评审，尚未接入dist。

实际生产兼容新发现：Sites v81源f348/HTML11f25c的writer为SAVE18、无contentState，新严格候选会拒正常生产旧档，已列release blocker。使用原源在独立loopback短会话公开start/遭遇/close取得三份完整原SAVE18，exit0，十人、真实checksum/日期均通过，原件嵌套保存至 `scripts/fixtures/legacy-save18/`；见 `docs/qa/production18-source-fixtures-20261014.md`。迁移必须只补新系统缺省且保留旧事实、初始三英雄，不造旧计划/CP/奖励。当前候选还在修正首轮独立评审与生产18适配，没有部署或发布。资源amount0耗尽保存也必须接受而不补资源。

## 报告恢复源码冻结与隔离browser（最新）

开发dist已按私有不变QA副本接入 `291a75441548e25801c4140d2b6e26dea1f5c1d938de7b408d9c4fb972bfe893`；8a4原字节保留为回滚点。170源码检查通过，独审76真实SAVE21原档与76完整纯draft通过（73 DAY/3 REPORT_PENDING）；真实SAVE18四原件及狭窄初始时钟例外通过。既有43/27/16源码检查同SHA通过，`c5d6c772`/`66c9368d`未变；9保存投影仍`4aec7a31`，content/night/syntax与55静态fallback通过。未将这些称为真实browser完成。

47场景full首轮已在仅loopback的隔离QA服务启动，所有document核291a，7原输入与2原生产capture报告逐字节SHA传输核验。原public80服务仍8a4、旧三日profile不动、Sites仍public/active v81。首版runner两处问题另行修正：B1漏实际关闭后四按钮断言；B7只删battle统计但receipt有数值，却错误期待全部未记录。保留首轮原结果，下一版固定后重验，不热换正在运行的脚本。新的浏览器通过/CI提交尚未确认。

工作流/iteration Skill加入不可变QA字节、真实控制器/Gate依赖和禁止mock被修改renderer；旧/新源码tester可用`--html`并打印SHA，golden没有重基。下一轮剧本设计师正独立准备计划投票/英雄/食物投影卡，仅proposed，不改L0或宣称已接线。完整v82–v90目标仍active，无全局记忆变更。

最新检查点：PR #4 head `37b9c23cb1b0550f8d14a30826365984dc8fea69`、tree5597b9b15ec5573e161053be3bb64a069bff7bfa，23项明确文件Git blob SHA核验；CI #62/run38633819213/job116091817440精确37b9 success，已读日志确认291a/170恢复检查及原golden、静态检查，非browser。该提交保留实际运行的v1三脚本，后续v2/v3改动尚未推送。

首轮full已真正终止exit1，586.398秒、47/47场景、1475/1463/12（36场景pass/11fail）。328观察/328PNG与输入原件归档，原report SHAe5caf27e…；独审273合法主档FNV/日历通过，B15真实650ms队列重开在435ms可信点击后清档、原timer未fired，四真实18全域迁移/两reload成立，但不改整轮FAILED。部分错误来自runner预期；实际截图又发现防线/支援DOM模板0遗漏，纯统计修复新SHA `412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8` 已精确接入dist，177源码与43/27/16、76原档独审通过，未启动新full。原291a及8a4回滚不变。

B16无visibility事件的infra原因已核安装包primary source：普通PWR context默认模拟焦点/可见。独占原生Chrome + public connect_over_cdp(no_defaults=True)的existing default context探针已产生trusted hidden/visible；无JS属性覆盖或伪事件，仅基础设施2.876秒证明，不是游戏或长catch-up通过。v3正在加入仅B16原生路线及资源清理，48场景新full待根代理冻结。旧public80仍8a4、Sites仍v81；整个长期计划active。剧本设计师已完成proposed计划投票卡，包含L0冲突裁定建议与六视角，尚未采用为新规则。

新48场景full已从独立412c字节启动一次，报告标识 `run-20261014T211705Z-043adff1`；root按既定心跳/轮询观察同一进程，没有重开或热换脚本。冻结三脚本main `0a76f30d9ce1e138fdecf50fae65a7d57d9bfa7eb7380396e0327104e717fe72`、fixtures `41474fc24c1dd14a256ce2ae8bd074ab40b672a2810eb489d31dbf4f06177390`、full `725cca14f9d8909a37ba88433962e0ac9376af1d5a236011ba826e2082f2f077`；14份资产/输入/runner跨机逐路径SHA和字节数一致，实际loopbackHTTP为412c。fixture契约检查39+8+1通过但未执行游戏。冻结类的实际data-page探针exit0，trusted hidden→visible约2909.9ms，独占主PID/group/profile均已清理；该探针仍非B16游戏通过。

此轮running阶段已观察B1/B2新增可见性断言失败：采集/建造/推进visible且enabled，cropBtn enabled但hidden。生产v81原HTML11f25在CSS243、本412c在CSS248都故意隐藏utility-row，实际作物由近菜畦contextActions入口提供。正在独审测试是否误把历史隐藏的备用按钮当成公开入口；不修改正在运行的v3，不把这些失败重标成功。下一修订须验真实公开作物路由和四控件禁用解除，不能改CSS或点击hidden按钮过关。Sites此次已再次确认public/active v81及实际浏览器主菜单，没有部署新版本。
