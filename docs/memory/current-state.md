# 当前状态

**更新时间：** 2026-10-14  
**基线：** `zfarm-world-1.0` 文档基线；工作树存在未提交运行时变更  
**状态：** active

**当前开发dist：** HTML `faecaffd12aefdf3c1c0f1dd57130bbb2ba37d5da0e9a6e81bc1f7532733335c`，在58a4计划权限/同日冻结与phase-safe UI上集成统一命令编号和真实修墙proof。新增28/41及原177/48/69/43/27/16方法通过、goldens保持，公开browser待执行。GitHub已到3175/CI66精确验证，生产保持公开v81。

**最新验收入口：** 报告恢复 v4 在412c完成真实 browser 48/48 场、1682/1682检查；独审与758原工件跨机SHA通过。严格单构建三日两轮均真实FAILED；新58a4/5e诊断轮104保存、原件122文件全部核SHA，跨机同strict Gate仍114/123。阻塞读取与保存调度仍在调查；生产公开v81，不能移用旧构建CI/browser为faec验收。

最新检查点为PR #4 head `7f30ed68c64d12706f7da1fb72a1be2b0235a3a2`、tree `245301d20e780897f0706907d9c775d87f38b4e5`（178 entries），13白名单blobSHA全部匹配；CI #65/run38648758065/job116142061917在精确7f30 success，已读步骤/decoded日志确认新48/69、58a4/177及原goldens/55static。root实际9保存投影仍4aec7a31、55静态fallback通过，Skill UTF8 quick_validate通过；无CI browser。

严格三日第二轮现已terminal exit1：871.282秒、392已执行检查true、104原保存，下一第二日训练前等待超时；原report SHA `c053723f413f28735271b337faa3c5c1f62995c128f678b4a337b81550724114`。call110最后15实际poll主档2083/seq1087/SHAa6ea8707不变、DOM2084→2090；前14仅约7.43秒，第15整体读取172.274秒，尚不能归因一次周期save失败或CPU/OOM。失败截图超时明确保留；原JSON/raw、报告/checkpoint/14PNG共122文件64401875字节逐SHA归档，两台同Gate114/123、九项后续缺失不改FAILED。两个终止run的owned loopback服务已停止，profile不重启，public80仍active。新诊断runner5e原字节已接repo，无判据放宽。详见 `docs/qa/fresh-three-days-second-20261014.md`。

本轮公开访问再次实查：Sites access_mode=public、revision6、active、v81；实际浏览器已读主菜单、地图和继续/新开按钮，无权限拦截，检查临时tab已关闭。没有发布或改变访问权限。

本轮审阅了外部 `Zombie_Harvest_WorkGPT_Framework_v2.0.zip`（SHA `4ee090b47c6a27311d01b513dac24131ed215f4ff3b2e3d86be52768223ef1cc`）。它是未绑定的上下文/工作流模板，不是项目审计或业务实现；没有复制到项目根目录。领袖 LLM 的刚性/软性 harness 已形成 proposed ADR，当前仍不接入 runtime、SAVE21/CONTENT3 或 Sites。

冻结 58a4 的计划会真实浏览器验收已通过：7/7 场景、203/203 checks，覆盖低信任/低CP、三种合法一次CP干预、两次reload、旧committed、同日真实遭遇/总结/关闭与回到白天；原工件164文件/39501317字节逐SHA归档，report SHA `00456e0d…`、archive SHA `bf7d81a2…`，不含profile。该结果只证明58a4；当前faec公开计划/修墙browser仍需单独验收。详见 `docs/qa/plan-integrity-browser-20261014.md`。

Bus/repair两切片独审后root逆向撤销证明完整等于58a4，再接入faec；repo可移植28/41、旧writer TEST-ONLY fixture、CI步骤已添加，原380项与goldens/55static/9projection通过，尚未推送或执行公开维修browser。七case计划runner仍在准备，全部十人/晋升/技能及完整v82–v90继续active。见 `docs/qa/command-repair-integration-20261014.md`。新增项目问题/QA记录，无全局记忆变更。

## 可验证事实

最新源码检查点已推入draft PR #4 head `3175d1595ffd8439e0d127af1ceb48c32f7ddfb5`，parent7f30、tree `03b429b4e9ea7c83eb7de6de2250fe8b05283fee`（190 entries）；18白名单Git blob SHA核验、ref/PR fresh核一致。CI #66/run38652946788/job116155859130精确3175 success，步骤及decoded日志确认新28/41、原380项、faec source与goldens/55static；无CI browser。上文“尚未推送”和7f30最新状态是检查点之前的历史时点。本地Git索引仍不是远端最新提交。

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

412c/v3源码检查点已推入PR #4 head `fd8120146ff0a2120bc1873aa898f7d3abf50a40`、tree `f3b4c37614ccf5b09eaafd04cc7c2b0410ba7264`，17明确文件的Git blob SHA全部匹配；branch与draft PR fresh读一致。CI #63/run38639915967/job116112499673精确fd812 success，decoded日志确认412c/177及43/27/16、三原golden和55静态fallback、Python语法，不含实际browser。48此时仍running、旧crop可见性false保留；v4只修改下一tester并增加公开菜畦收获证据，不能冒称旧轮通过。完整长期目标保持active。

48 v3现已真正终止exit1，645.028秒、48/48 attempted、1641检查/1634通过/7失败，41case passed/7failed、notRun=[]；所有false均为“all four DAY controls visibly enabled after real close”，整轮仍FAILED。原report SHA `60b93f3e121072c5d53e1138b9d95471a857e17fae089b6444654f077e7377a8` 已小原件复制并核本机同SHA。原报告实际B16 native trusted hidden→visible同generation、2889ms，主PID/group/profile清理均true；真实650ms队列/B15竞态及四真实SAVE18原件均无其它false，但不等于整轮pass或≥60秒catch-up。

隔离412c服务已停止，public80仍active/8a4，Sites仍公开v81。服务器原run共750文件/618954266字节，无零字节文件；大归档正在单次SCP传输，不重复启动，跨机器全SHA与独立原件审计尚待完成。v4 owner正修tester并加B1真实公开成熟菜畦收获，禁止改CSS/runtime、hidden click或伪造receipt delta；需冻结新三SHA再重跑全矩阵。新单构建三日仍未跑。新增plan-voter架构审查与meeting-version ADR仅proposed，L0/contentVersion/运行时未改，完整v82–v90目标继续active。

v3独立服务器终止原件审计已完成：21条证据完整性控制通过、35条关键事实中34通过/1复现crop可见性false。343观察/343PNG、7真实输入及47派生输入核SHA/FNV声明；288条只通过当前FNV/schema/calendar读取（可能包含loader拒绝的逻辑负例），不称安全可继续档。独审目视六张原图并核跨机SHA，B7防线74/缺支援未记录成立；第二轮整轮FAILED不改。大归档仍同一transfer处理中，无重复启动。

v4唯一owner与独审最终冻结：main `32273364d4ae4373938d005ab70bad95bd42f6b41f79020da85d4ce348878845`、fixtures `c9ec8771a76b2e6e8581cf3fa2c9edb6b667410e5f62448acc66201a51467e8e`、full `a1d1c54d10e82dc2c9e7a7f2b098d245f170ada27a08140223a913db0988f483`。root新QA14文件逐字节跨机核验、实际loopbackHTTP412c、39+8+1 fixture/source契约通过；39合成方法与7独立变形控制非gameplay。新增收获比较器拒未知food、交错ledger、无收据clock与seed变化；原生会话四个方法AST与已实跑v3完全相同。

新完整48已启动一次，逻辑run `run-20261014T214131Z-5c844377`，不热换脚本/源码。初期292/292、8场景，真实B1公开菜畦收获与刷新已进入实际检查，但整轮仍running、独审待terminal；不拿局部早期结果称发布门禁完成。源码repo head仍fd812/CI63（v3），尚未保存/CI验证v4。三日预审发现旧runner没有强制逐document source SHA、fresh内部reload漏记录、首日显式reload缺少、Gate未硬要求singleKnownBuild/清晨；正在保留旧字节后补严格fresh模式，不改旧三日profile/439/Gate90原证据。

v3唯一大归档现已真正exit0，root本机私有输出750文件/618954266字节逐路径/bytes/SHA与服务器manifest全部吻合、零字节0，原report仍60b93，不重复传输也不重写FAILED。v4持续同一PID/handle，阶段27场景/925检查均pass、无errors；完整结果仍待terminal。严格fresh三日tester正在最小改造，旧3e9921/b4b945原字节已保留且旧模式对原attempt9仍完全相同90+2输出，不冒称旧恢复三日为新的单构建回归。

## 报告恢复正式验收与严格三日启动

报告恢复v4现已真正terminal exit0：658.887秒、48/48场景、1682/1682检查、errors0、notRun=[]，原report SHA `73aca16ee41438041fb9fba1955d6abf719f583f72a82290b7d34d118ae6cb36`。独审直接核原件21完整性控制与48关键事实通过；真实公开收获food7→10、同plot清空、两reload、B15已排队650ms重开竞态、B16可信原生隐藏2873ms与清理、四真实SAVE18迁移均通过。原两个full FAILED不改；≥60秒后台追赶与平衡仍未获得browser证据。详见 `docs/qa/report-recovery-browser-third-20261014.md`。

原终止run758文件/627794851字节以一次175064549字节tgz传输并安全解包到私有证据目录；archive SHA `28844905df3e1c366de078291e895e57b6a9a0828109707480d7a24393d83c59`，全部原路径/bytes/SHA与服务器manifest相同，原report不变、没有profile/凭据。归档成功不是新增游戏检查。

严格三日已从冻结HTML412c与actor be4cf51d启动一次；runner SHA `293fc76c7479cb16989510c7d2aad3e116f763f36786d52ca91c009b88229c2e`、verifier SHA `4cca9356ceba55e47d9ac6c4ec0d08b62e926d2f7df2d29930f5af62f80b7434`。全新私有profile、loopback8783，显式fresh/strict-fresh/expected SHA、预算1800秒、day4清晨≥06:00；15秒实际心跳、约30秒父轮询同一进程，无重启或热换。DAY1显式reload与day2日界已实际进入，但整轮仍running，不拿前缀为三日通过。方法15/21与独审19/31仅是严格tester/source-ready证据，旧模式90+2保持。完整v82–v90仍active。

该严格首轮现已真实exit1：694.23秒、359已执行检查均true，第二日下一公开训练前保存同步超时。原report SHA `366444feeee25a99f613bdf1245e7c40a5246b774bd4a9f44bc08b6a4aefc0b9`；strict独立Gate104/113，九项失败均完整性/后续阶段缺失，94原snapshot同412c、已观察DAY1/2 reload和day2日界。实际原PID不存在，profile/原报告不重开、不改FAILED；根因尚未确定，下一tester只加失败观测，不放宽原判据。详见 `docs/qa/fresh-three-days-first-20261014.md`。最小计划会业务候选fb871在私有目录48源码检查与独审通过，公开低信任UI一致性正另做候选；尚未集成当前dist或服务。全十人剧本卡及MeetingV2仍proposed。
