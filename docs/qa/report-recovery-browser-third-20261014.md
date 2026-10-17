# 报告恢复第三轮 browser 独立审计

**结论：报告恢复主题的v4完整browser验收通过。** 逻辑run `run-20261014T214131Z-5c844377` 已真实terminal exit0，elapsed658.887秒；**48/48场通过，1682/1682检查通过，errors0、notRun为空**。原 `report.json` SHA256=`73aca16ee41438041fb9fba1955d6abf719f583f72a82290b7d34d118ae6cb36`。根执行者session99377终止；本独审单独SSH检查PID176776不再存在。原首轮291a和第二轮v3 FAILED继续保留，没有合并、改ok或替换原失败工件。

## 实际源码与完整性

HTML SHA256=`412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8`。冻结v4 main/full/fixtures分别为 `32273364d4ae4373938d005ab70bad95bd42f6b41f79020da85d4ce348878845` / `a1d1c54d10e82dc2c9e7a7f2b098d245f170ada27a08140223a913db0988f483` / `c9ec8771a76b2e6e8581cf3fa2c9edb6b667410e5f62448acc66201a51467e8e`；本独审终止后在原服务器sha256sum复核与本机原report一致。

直接读取服务器终止原件，**21项独立 evidence integrity controls与48项关键事实检查均通过**：347条原观察rawStorage/envelope/metadata一致，347张实际PNG逐一SHA/bytes记录，7份原source SHA/FNV锚定，47份before-loader派生fixture原raw与FNV声明一致；case检查数量与状态、全非空contract groups、四真实18、notRun和fullOutcomeGate直接联入实际成功状态。没有仅从headline ok推断通过。

其中292条通过runner的FNV/当前schema/calendar读取检查，55条旧18/诊断/空观察保留；**292不是loader安全可继续的存档数量**，逻辑负例仍按recovery Gate拒绝。原报告pageErrors/httpErrors/requestFailures/consoleErrors均无新增问题，历史MAIN的泛404来源仍不能由本轮无错误反推。

私有独审输出 `third-terminal-independent-audit.json` SHA256=`ec22dd434612f22da8f1a7dcb524671bfd458b45a063f636e4a4e5cae3e5c36a`；`third-terminal-critical-independent.json` SHA256=`56ef8ae9ca996d287a6287248e2fdc65008e1cd635a85d86930731d4b4fc6ff8`。这些是原件审核结果，不是加入1682实际game checks的新分数。

## B1公开收获与两次reload

关闭原day3 00:34报告先确认原world2914唯一close及SAN关闭因果；四既有DAY控件disabled解除，三常驻入口visible+enabled，实际建造drawer可开/关。旧cropBtn仍按生产UI隐藏，不点击、不改CSS。随后公开WASD及可见garden tile进入动态收获入口，真实lifecycle保存和公开continue后实际点击。

| 原实际保存 | 日期 | FNV | 食物 | 种子 |
| --- | --- | --- | --- | --- |
| 导航后pre-crop | day3 00:42 | `a1d8b90f` | 7 | 2 |
| 收获后checkpoint | day3 01:03 | `c95509df` | 10 | 2 |
| 第一次reload | day3 01:05 | `3d97bb9a` | 10 | 2 |
| 第二次reload | day3 01:05 | `ee9f801f` | 10 | 2 |

同garden `bld-mazjx8`、(7,14)、type garden，从planted/ready true及growth2变为false/false/0。实际新增crop.changed `evt-001687`只一次，commandId `cmd-001708`精确关联唯一crop.change replay，其真实payload buildingId:null；receipt真实payload为`{}`，没有补造food delta。内层time.advanced `evt-001686`/command `cmd-001709`有causationId `cmd-001708`、minutes20、同world2943。总calendar差21分钟由一条自然1分钟tick加该真实20分钟推进完整解释，latest300旧tail与全部新增seq精确保持。

本次pre/post实际NPC餐receipt窗口 **为空（0餐）**，所以food7→10直接证明+3；没有声称观察到非零餐并发。非零NPC餐核账支路由39项method控制另证。两次实际reload用收获后checkpoint作为基线：garden与seed2、food10保持，没有再crop receipt/command，没有新close或关闭报告SAN补偿；两分钟自然clock均有真实replay，不能拿pre-harvest资源作永久相等。原观察basename为 `26-...before-public-harvest-real-lifecycle-save.json`、`27-...before-public-harvest-visible-action.json`、`28-...after-actual-public-harvest.json`。

本独审仅另复制已终止原件的27/28两张小PNG，SHA/bytes与服务器完整原审计一致，并目视确认：公开动态按钮由“收获作物”变为“播种”，当前食物由7变为10，显示收获+3。截图28的DOM已到01:04，而同观察原SAVE仍01:03；这是实际DAY tick/checkpoint观察时差，表中日期按原SAVE，不以截图覆盖。

## B15、B16与迁移

**B15：** public低HP战斗真实失守后，native timeout495/delay650，stack为resolveNight→requestCheckpoint。generation1792014616425.7，schedule1792014630331；可信restart click1792014630896，即**565ms**，clear1792014630900，即569ms，无fired。立即、2800ms后和两次reload旧key都缺失，公开新局没有旧threat且固定十人。普通reset场景没有冒充这条pending race。

**B16：** 原观察 `287-B16-midnight-double-start-close-visibility-after-real-tab-hide-return.json` SHA256=`dd4b26519635482efade44863fc821cec4b946240e9a96455ad1e91748044938`；同generation1792014641099.1真实trusted hidden1792014649214→visible1792014652087，**2873ms**。原trace与case summary精确相联，existing default context/no_defaults、原生hidden/visible读值均有效；owned主PID/group停止、profile移除为true，实际groupKillUsed:true且未保留profile。报告保持day3 23:59/world4319/SAN50；重复close仅一次原tick close、一次50→53补偿，之后合法DAY跨午夜和day4计划/CP/clock无重结算。此为完整B16契约通过，**≥60000ms追赶仍没有实际browser证据**。

**B11/B13：** 实际公开选择安全backup，immediate SAVE完整保持原资源、NPC、contentState、world、quests和replay；一次save.migrated及严格300 tail，原backup raw不被坏main覆写。两reload无第二迁移或混合主档字段。backup写/回读失败retry仍为source控制范围，不能由成功恢复反推所有失败场景。

**四真实18：** 真实DAY/resolved/closed/INITIAL原SHA/FNV与writer11f25来源完整；23/29/23/24条该组检查通过，独审逐旧持久域/NPC字段保持。三起始hero/七locked，无新居民、promotion历史奖励、旧plan或CP，CP0/max0/granted原日、空idle。INITIAL仅已证06:00/空水位world0→360，旧原bytes/日历不变，四者迁移一次且两reload幂等；显式坏contentState/null/数组与非initial world0相邻负例仍拒绝。19/20仍是test-only兼容范围，不能称真实生产旧档已全部实证。

**B7统计与DAY采集：** 已有receipt时准确4/2/0，battle及receipt同时缺统计则未记录；saved defense74、supportIds=[]时0，缺supportIds时未记录。DAY-control独立公开采木有正资源差、唯一receipt/replay；不把它当B1报告位置采集成功。

## 通过范围

本次通过仅支持统一报告恢复、明确安全backup/reset、现有持久档迁移、公开close后交互、checkpoint退出竞态和该48-case矩阵。177源码、39方法、7独审方法、原生infra和完整browser各自分层。内部pure projector/RNG、storage写删失败/stale generation、同分钟legacy多候选、≥60秒后台追赶保留source-only范围。不是v82–v90全部开发完成、14天自然全链通过或Balance/SAN训练平衡验收；public80与Sites版本是否发布由独立部署记录确认。
