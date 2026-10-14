# B1–B16 与真实生产 SAVE18：完整验收脚本准备

**状态：v1 首轮已在独立 QA 终止exit1；以下 v2 修正尚未运行 browser。** 本文件不替换[初始失败 baseline](server-report-recovery-20261014.md)，不更新 current-state 或 calendar QA。关联[设计卡](../scripts/resolved-report-recovery-001.md)与[架构裁定](../decisions/ADR-20261014-report-recovery-review.md)。

## 文件与执行边界

- `scripts/server-report-recovery.py` 保留历史默认 `--suite initial`，新增 `--suite full`；full 必须提供 root 冻结的新 HTML SHA256，任一次 document 不同均失败。
- `scripts/report_recovery_fixtures.py` 只声明真实保存的离线派生字段和预期状态，不制造成功 receipt、NPC ID、closed 保存或战斗结果。错误/重复旧回执是明确的负例变更。
- `scripts/report_recovery_full.py` 执行公开 UI 与实际 envelope/DOM/截图检查，按组记录 attempted/passed。v2定义39个 DAY/B1–B16 场景、8个生产18兼容场景，另1个新版公开初始保存场景，共48个待执行定义，**不是游戏通过数**。首轮v1仍为47例，不能用v2预期改写它的失败。

常规47例使用新的非持久context。v3仅B16.visibility在明确`--native-visibility`时使用独占Chrome、新临时磁盘profile和它的已有默认context；不复用用户/旧三日profile。每例一次before-loader主档/显式backup seed；window.name防止reset/reload重播旧输入。未在运行中注入GameState、存档、模拟时间或事件。每例保存input raw storage、boot、公开操作结果、两次真实reload的JSON和截图；不合法、阻断和空key均记录真实原始状态，不补造合法envelope。

重开场景明示seed并核清理主档/.bak/.corrupt、v11至v7和各legacy `.corrupt` 诊断副本；没有因未读取诊断key而漏报残留。报告输入策略只允许DAY/BATTLE开启终端，browser纯读仅覆盖已呈现报告字段及只读主SAVE_KEY；内部CP/计划/报告renderer的state、数组和seeded RNG纯度由真实函数source check另验，不要求未约定的报告阶段终端入口。

native timer/RNG/visibility observer 在 loader 前安装，仅原样委托浏览器API并记录诊断。它不调用游戏函数，不改变 delay，不暂停世界，不为缺少 queue 的场景制造650ms保存。该 instrumentation 明示在报告中，不能代替源码事务与 renderer 内部数组的测试。

## 真实输入与 source checks

主 B1–B16 使用真实 SAVE21 输入；resolved/closed 为同一次实例 `threat-3-0-34-1657`。关闭来自公开操作，具有 evt-001666 / cmd-001610 exact join，不从 reducer 镜像生成。

这三个归档输入的原始文件SHA在full套件固定核验，并记录旧writer HTML8a4与当前待验的新HTML分开。重新序列化或替换源即使FNV自洽也拒绝，不能借参数把任意构造保存称为原公开游玩；后续换真实源需更新这份明确的来源契约。

| 原件 | 文件 SHA256 | payload FNV |
| --- | --- | --- |
| 公开 DAY source | `ec20cf74f593e159301e1a507072a52c99b701664c1c366a33e6176efe0cfd38` | `93cc9e89` |
| `43-day-3-summary-save.json` | `d7d8240aace117a0525d9d3e0bc4178d9f270b51d8cb48f414b0901a39faf1d7` | `98ad6417` |
| `44-day-3-night-complete-save.json` | `4cded7359f15367f5efc36b2e178a2fb32df7a453f536059be7f08b68740dfe1` | `5672ce67` |

真实生产18来自 `f3488457286836bf986dc90b5e0c3f6f425813c9` 的原 writer，HTML SHA256 `11f25c4e68f7360a11b8c84a638b0f8a8270202af3bcf58b3047d278b4952400`。实际公开 start/encounter/close 捕获28.688秒、exit0，报告 `saveInjection=false / hiddenGameCalls=false`。三原件都是 SAVE18、无 own contentState、10人；旧 close payload `{}` 只能凭具体 threat.close replay join 实例 `threat-1-6-10-12`。不能通过删21 contentState/改version冒充这些原件。

| 生产18原件 | 文件 SHA256 | payload FNV |
| --- | --- | --- |
| `DAY18-save.json` | `0fe3b3e33d630621feb20cba3bb08b4db7cef247464d3b32f748c3c17bf829c3` | `926f908a` |
| `RESOLVED18-save.json` | `1d10ec233d64ce9a0cedf3eae44fa1e6706065c0ff37ba3e13f5b663451d2d1e` | `4a12d242` |
| `CLOSED18-save.json` | `5413783b32ebae6cc798593e90f034da596e17b20cda71b606054c8180b1b960` | `f1db7a05` |
| `INITIAL18-reload-save.json` | `3ae5ff906cfb1d6e50c9b5ea9467896f2537e64bfaab44b0c897984baa6ae460` | `8774420e` |

旧 writer capture report SHA256 为 `b087c9964fe9c2e08b7b17dc34962872c4aa2badbff3b7e84ee75ab8bb90d7f7`；release 模式要求 `--legacy-writer-report`，核真实原件 hash/版本/来源与此捕获记录，不读取记录中的服务器路径当代码。原件仅复制/只读，全部派生是新的明确 fixture。

第四原件来自同一个真正18 writer 的公开 start 后立即 reload，独立 capture 耗时2.892秒、exit0；其报告 SHA256 `ed0ac68b9ccee5514bdcd232eef2e8231b5a94d9872f803264ad084174aabb34`。它真实记录 day1 06:00 / savedAt360 / world0，并有 seq0、commandSeq0、events/seen/replay空、night=false、battle=null、两项维护日1；不是人为损坏输入。脚本仅把这个经原件/provenance核实的边界声明为可迁移。普通真实 DAY18 06:10 被离线改为world0另列反例，必须阻断。

已执行的开发 checks：七个真实输入原件的 JS FNV/版本，正常日期一致性和精确初始sentinel例外；39个当前矩阵定义、固定真实人口 ID 与源不变；两个B7夹具分别保留完整receipt或只离线删除其展示数字，事件ID/seq/身份保留；错 closed 实例、重复 close command、缺精确 started 因果均拒；生产18 own contentState 为 null/[]/坏object 与非初始world0反例拒；整份保存比对器能识别 quests、NPC关系、原命令历史和账本中段删除；native timer observer 的delay/随机数/cancel原样委托；10项诊断负控与7项纯报告coverage负控（共17）保留无效结构/失败截图诊断、拒绝空矩阵或漏场景绿色，未知404不被忽略。开发输出 `gameplayExecuted=false, browserStarted=false, gameplayPassCount=null`；它没有重新运行首轮游戏。

## 预期 browser / source 联合矩阵

| 组 | 定义数 | 公开 browser 出口与存档证据 | 必须配套的真实函数 source check |
| --- | --- | --- | --- |
| current-writer | 1 | 无seed新context公开开始→立即真实reload；日期/world/FNV一致且没有世界tick、新迁移或遭遇收益；两次reload可继续 | INITIAL_PROGRESS_STATE与真实start路径，不靠test手动锚定world |
| DAY | 1 | 真实日间开始、时间推进；公开WASD沿(8.2,11.5)→(8.2,8.2)，实际木材增加且新resource.collected精确join resource.collect；两次reload正常 | timer至多一个；采集成功属于本例，不能冒称B1在无资源位置采集 |
| B1 | 1 | 完整报告、2tick静止、公开close、具体唯一event/replay、SAN首次+3；四DAY按钮可见启用、真实公开开/关建造抽屉；reload2无重结算 | close事务与Gate；UI disabled=false不代替实际交互 |
| B2 | 1 | 只改night=false仍报告，同B1；只允许一次resolved-night-flag迁移，checksum/日期/实例严格核 | 分类不能凭night代替closed |
| B3 | 1 | 真实closed附同实例残留battle；清瞬态，源CP/库存/计划/岗位不退回；迁移一次 | alreadyclosed install原子性 |
| B4 | 7 | exact空close兼容；错command/threat/type、非空缺ID、缺replay、重复command阻断恢复 | 精确join与全局集合校验 |
| B5 | 5 | legacy id和显式start引用各恢复；错旧id、完全无引用、错seq不因唯一resolved猜测；首次document明确notice，迁移/reload2去重 | 特定旧writer公式、顺序、唯一replay；同分钟多候选负例属于源码覆盖 |
| B6 | 2 | 无身份/历史数组降级，首次document明确notice；关键全局events坏则恢复阻断；无fakeclose/reward | 历史可选数组与关键集合区分 |
| B7 | 2 | 只缺battle数字时receipt仍给kills4/breaches2/damage0，walls/NPC deaths未记录；另例离线删battle及receipt展示数字后五项才全部未记录，身份/seq不删；纯读无推进 | render内部state/数组/seeded RNG纯投影；known防御74需回填，缺supportIds需未记录 |
| B8 | 1 | 显式loss、公开restart、普通操作拒、清旧key、新局保存与reload2 | 普通threat.close终局Gate、session fence |
| B9 | 1 | 缺gameOver的旧loss迁移为lose一次，同B8公开出口；既有派生damage100与原receipt0冲突，instanceId明确null | 旧默认与loss优先级；不凭旧ID强行认领冲突报告 |
| B10 | 6 | 未知terminal、错类型、孤立HP0、lose正HP、night缺battle、数组envelope均停恢复 | 无半加载、未知字段failclosed |
| B11 | 1 | 未结算主档停模拟；显示真实backup日期、公开选择整份DAY回退；主档新FNV+save.migrated；reload2 | backup可靠写入/readback，坏主不覆盖安全bak；写失败与retry仅源码覆盖 |
| B12 | 2 | 无/坏backup均阻断，原档保留；公开reset入口真实新局 | storage错误、删除失败另列源码负控 |
| B13 | 3 | 主JSON/FNV/关键结构坏；公开恢复具体resolved backup；整份字段、不混档、备份保留、一次迁移 | 原不可可信源checksum/date必须null |
| B14 | 1 | 已花非零CP、当日配给/维护、同ID伤亡/守军；report期间无补人/治疗/收益 | 原子install保持所有persistent域 |
| B15 | 2 | 正常report公开restart；真实低HP DAY经公开战斗loss，在实际650ms保存到期前可信用户click重开；pagehide后2800ms及reload2无旧key | stale generation/delete failure负控；单纯resolved reset不替代race |
| B16 | 2 | 23:59报告、明确SAN50，double start/close，真实隐藏/恢复及按住输入；纯阅读；loss double restart；具体close原tick及唯一+3 SAN receipt，reload无重复 | 生命周期/输入/回调统一fence；同分钟才比较SAN/经济精确值，关闭后的正常DAY走时另核实际time.advanced |
| production18compat | 8 | 四真实18档→原子迁移21、完整原NPC/库存/social/relay/quests/replay；真实初始world0仅修为360且日期不变；新content默认无旧plan/CP/资源；迁移一次+即时readback+reload2；三个own-content与非初始world0负例阻断 | 仅18 own-absent适配；精确sentinel修正；L0初始三英雄静态默认、不触发晋升或奖励 |

B15 的真实 race 要求同时满足：native requestCheckpoint650ms仍pending、实际 trusted restart event在到期前、该timer未先fired、退出后所有旧key消失并保持、新局无旧遭遇。若截图/调度使650ms已过、公开按钮不可用或根本无队列，该项失败/阻断，不硬算pass。真实loss前只快速读取DOM和timer诊断，尚未写成合法resolved保存时明确标注；不为race捏造resolved snapshot。

生产18迁移 `fromSaveVersion:18 / fromContentVersion:0 / adapter:'save18-pre-content-to-save21'`，主key来源仍primary。CP0/max0/grantedDay=迁移日、plan idle无候选/历史；初始 commander/radio/doctor 英雄，其余ordinary/locked，无新晋升事实或回溯收益。实际旧close `{}` 保持原账本，不能为统计或迁移补造胜利。

初始sentinel迁移必须保留原checksum8774420e与原日期，并包含 reason token `save18-initial-clock-sentinel` 和 `worldClockCorrection={before:0,after:360,calendarUnchanged:true,writer:'SAVE18-initial-sentinel'}`。不能产生 time.advanced/奖励。整份比对仅显式排除报告分类、feedback/投影和motion accumulator/input等已确认boot瞬态；保留旧持久字段、整份居民原字段、seed/RNG/replay/seen、旧事件。即时readback先保存原观察，避免后续截图时真实DAY tick造成错断言。

账本保存遵循实际writer的last300。只允许完整旧tail加唯一seq=旧watermark+1的save.migrated后，严格比较 `(原events + 该migration).slice(-300)`；其余原事件的字段/顺序和replay必须相等。没有迁移不能少原事件，有迁移也不能任意删除中段或尾部。迁移checksum/日期/来源/rollback/实例另作精确核验。

## 首轮原工件与v2修正边界

首轮实际使用 HTML `291a75441548e25801c4140d2b6e26dea1f5c1d938de7b408d9c4fb972bfe893`，三脚本v1 SHA分别 `0c6ff72bba1772b90e72ad68e1c5a0f1aeea9bf091c98eab01858302253a7af8` / `ed6191649b0ca2dc7b2ff70cd0f2c04be2d49c47b5e78ac6d7879245f975160b` / `ad3292f5ddad688cbf9e853563e3706e8cd5459d66e23e74d97f63cb9f1afa64`。运行目录 `recovery-291a/browser/run-20261014T202704Z-a1f47969`；v1执行文件与raw报告保持不变。

根代理确认首轮terminal：586.398秒、1475checks/1463passed/12failed、exit1。第12项是B16实际visibility事件为[]，没有真实隐藏证据，不能算已覆盖。v2新增`--headed`（默认仍headless），将浏览器mode与实际display存在性写入报告；root在独立Xvfb显示上运行真正headed Chrome。tab switching仍必须观察native hidden/visible事件，禁止CDP改写或把无事件当通过。

后续独立infra探针确认，仅headed/Xvfb仍不足：安装SDK默认为new_context设置focus emulation，页面始终visible。v3只给B16.visibility提供`--native-visibility`：手动启动owned Chrome、debug端口0且地址127.0.0.1，从新profile的DevToolsActivePort读取端口，`connect_over_cdp(no_defaults=True)`后必须选existing `contexts[0]`和它的原about:blank页；没有new_context fallback。该参数避免SDK自动focus/media overrides，不发送伪造visibility命令或更改JS属性。其余47例保持v2常规路线。

临时profile由mkdtemp创建在私有QA父目录、位于run工件之外，无GC finalizer自动删除。finally只对owned start_new_session进程组发送TERM/KILL，主进程与整个所属组均停止后才在已核prefix/parent边界内删除profile；清理失败保留并令实际case失败。默认context不单独close，关闭CDP browser及owned Chrome。每例报告contextMode、noDefaults、实际profile/连接/清理结果；profile不复制归档。

已执行11项mock生命周期/cleanup控制（含旧API、启动失败/超时、坏端口/defaultcontext、主PID死而子组存活、组终止失败保留profile、无headed/DISPLAY），另6项端口和6项trusted visibility负例；没有启动Chrome或游戏。这些不是actualChecks。root先用同一个类跑真实data-page native hide→visible→cleanup基础设施探针，通过后才负责完整48例。

本agent只读复制了终止原report，完整SHA `e5caf27e869bb7e25f5b740506ba069ab11d4658d033cb118cea3874e74ceb80`，确认47/47 attempted、notRun=[]，仍为failed。另从同一291a真实源抽取savedReportIdentity/projectResolvedReport及依赖，执行两份B7夹具，结果分别是4/2/0与全部null，身份均为原threat-3-0-34-1657、原payload不变；这只证明投影/夹具预期，不是重跑browser。

只读归档的running前缀1211checks及26/28、94/95、101/102、108/109、115/116、147/149工件证明：B2实际只新增一次resolved-night-flag；B5/B6首次after-start notice可见，真实reload后的新document为空；B9真实保存hp0/lose并记录null迁移实例。另独审三份B13即时readback严格对应原1366..1665→1367..1666，唯一1666为迁移，其余持久域/NPC/CS/replay一致。v2修正这些验收预期，原失败不会被覆盖或改判为一次通过运行。

截图独审还发现真正的291a报告UI缺项：原保存defense74却显示模板waveDefense0，缺supportIds却显示waveSupport0。v2新增这两个实际DOM断言，预期会使未修该UI的291a失败。不能靠修验收误判宣称旧构建整体通过；runtime需另行冻结修正构建后真实重跑。

full顶层ok现在同时要求releaseCoverageComplete、preparedCaseCount一致、48例全部attempted且passed、所有非空契约组通过、明确`--require-production18`及四份真实18原件实际完成。空矩阵、漏case、缺第四原件或仅部分通过都exit1。7项合成report负控只测此判定器，绝不进入actualChecks或冒充游戏回放。

## 运行方式（需 root 冻结通知）

旧默认命令仍运行 `initial` 六场景。新的完整release验收必须显式 full、冻结新SHA、实际七个源文件与两份真实生产18捕获报告；输入及输出都放私有QA目录。

```bash
python3 scripts/server-report-recovery.py --suite full \
  --headed --native-visibility \
  --url http://127.0.0.1/ --chrome /usr/bin/google-chrome \
  --expect-html-sha256 FROZEN_NEW_HTML_SHA256 \
  --out ~/.cache/zfarm-qa/report-recovery-full --timeout 900 \
  --day-source /private/input/DAY21.json \
  --resolved-source /private/input/43-day-3-summary-save.json \
  --closed-source /private/input/44-day-3-night-complete-save.json \
  --require-production18 \
  --legacy-day-source /private/input/DAY18-save.json \
  --legacy-resolved-source /private/input/RESOLVED18-save.json \
  --legacy-closed-source /private/input/CLOSED18-save.json \
  --legacy-initial-source /private/input/INITIAL18-reload-save.json \
  --legacy-initial-report /private/input/report18-initial.json \
  --legacy-html-sha256 11f25c4e68f7360a11b8c84a638b0f8a8270202af3bcf58b3047d278b4952400 \
  --legacy-writer-report /private/input/report18.json
```

开发检查独立使用 `--developer-negative-controls`；完整fixture检查用上述七个源参数、两份旧writer报告及 `--check-fixtures`，只启动Node，不启动浏览器，也不需要新HTML hash。全套结果仍须和 candidate 的真实函数 checker、27 plan/day、16 camp-area、43 content-chain等证据联合评估；本脚本不把 source-only未覆盖项或自身数量包装为游戏通过。

新runner保留console text/location、HTTP状态/resourceType、requestfailed URL/failure。只有明确URL path为 `/favicon.ico` 才可单列diagnostic；过去string或无location的“404”都是未知，不能无条件忽略。旧raw报告不改写，也不反推全部旧console无错误。

Linux虚拟显示运行时，由root用真实Xvfb环境启动上述`--headed --native-visibility`命令；该flag要求full/headed/实际DISPLAY。只读取owned默认context产生的trusted hidden→visible事件，另外核实际document.visibilityState；无事件、乱序、untrusted或跨generation均失败。browser只请求隐藏2800ms，≥60000ms catchup分支仍source-only。默认headless兼容原CLI，但不证明隐藏生命周期。
