# 报告恢复第二轮 browser 独立审计

**结论：FAILED，不能发布。** 逻辑 run `run-20261014T211705Z-043adff1`，真实 terminal exit1、elapsed645.028秒；48/48场已执行，1641检查中1634通过/7失败，41场通过/7场失败，notRun为空。原 `report.json` SHA256=`60b93f3e121072c5d53e1138b9d95471a857e17fae089b6444654f077e7377a8`。根执行者 session79876 已终止；本独审单独SSH检查PID166426不再存在。原报告、profile、保存、截图、runtime和冻结runner均未修改。

**源码与方法固定：** 被测 HTML `412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8`；v3 runner main/full/fixtures分别为 `0a76f30d9ce1e138fdecf50fae65a7d57d9bfa7eb7380396e0327104e717fe72` / `725cca14f9d8909a37ba88433962e0ac9376af1d5a236011ba826e2082f2f077` / `41474fc24c1dd14a256ce2ae8bd074ab40b672a2810eb489d31dbf4f06177390`。本独审在终止后直接服务器读取，再次sha256sum核一致。public80和Sites v81不在本轮修改范围。

## 原工件完整性

独立只读审计 **21项 evidence integrity controls 全部通过**：343条实际观察的 rawStorage/envelope/metadata一致，343张声明截图均为真实PNG且逐文件记录SHA/bytes；7份原source输入SHA/FNV与锚点一致，47份派生fixture input的原raw/hash/FNV声明一致；实际case检查数量、状态、覆盖、notRun与失败表相符，fullOutcomeGate没有把失败掩盖成ok。

其中 **288条观察通过 runner 的FNV/当前schema/calendar读取检查**，包括可能被游戏loader正确拒绝的逻辑负例；不等于288个可安全继续的游戏存档。其余55条旧18/诊断/空观察的原raw与错误信息保留，未制造成功payload。recovery场景是否拒绝推进按相应Gate和实际public control检查另判。21项完整性通过也不是游戏1641项全通过。

完整私有输出 `second-terminal-independent-audit-v2.json` SHA256=`13818ca2de4111a361adb94ad23f1bd8142fce78e64140f643399e8a0c8c7a9f`；关键事实 `second-terminal-critical-independent-v2.json` SHA256=`3ea885acde54fa321284c581d9b3b7506b133d4302787c433c7b02935e5f8e7f`，35项中34通过/1项重现B1 crop可见性失败。独审helper初次把实际`23:59 · 夜`当纯`23:59`而产生格式误判，已按完整DOM核对解析日历并留下独立v2输出；没有改任何v3原false或原报告。

根执行者唯一全run传输已真实exit0，并完成750文件逐路径/bytes/SHA跨机比对。本独审读取完成的本机副本，独立计数 **750文件/618954266 bytes/zero0**、原report60b93不变；再次运行完整21项审计通过，343原观察及343 PNG与先前直接服务器审计的SHA零差异。私有本机摘要 `second-terminal-local-independent-audit.json` SHA256=`72f0bf086128fce00d32f365998a671c7ef6ca3082f2dc9f7bbbfd5d3518365c`；只复用这一完成副本，没有重传或改原件。

## 七条实际失败

七条都为 `all four DAY controls visibly enabled after real close`：B1、B2、B5两个正例、B7两个统计正例、B16报告正例。实际cropBtn均 `visible:false, enabled:true`；gather/build/endDay三按钮均visible+enabled。B1实际开/关建造drawer成功。

独审对比原生产v81 HTML11f25及412c：utility-row在旧版本即全局display:none，cropBtn在此row中；公开种田入口是靠近菜畦后的动态context action。详见[crop归因](report-recovery-crop-control-20261014.md)。这是v3新增可见性断言与旧UI不匹配，当前整轮仍FAILED。下一v4应保留四disabled属性检查、三常驻入口可见性，并新增实际公开近田收获及动作后reload证据；不得改CSS、隐藏click或重写v3失败。

## 重点实际事实

**B16 native：** 原观察 `283-B16-midnight-double-start-close-visibility-after-real-tab-hide-return.json` SHA256=`03383ca7358c9be67537bb57fe43193778b8bf7bc3572d0a176e52859f622250`，同generation1792013161888.6有真实trusted hidden→visible，1792013170323→1792013173212，实际隐藏 **2889ms**。case summary精确join原trace；原生states为hidden/visible，现有default context/no_defaults声明和owned cleanup均与冻结方法对应。主PID、owned group和profile实际清理皆true，未保留profile。该场景仍因crop断言失败；不能称整个B16或整轮通过，也不是≥60000ms catch-up。

该报告隐藏期间仍第3天23:59、world4319、SAN50。重复close仅产生一条evt1667/threat.closed，world4319、cmd001610、原实例threat-3-0-34-1657；SAN evt1666在同tick由50→53、causationId指向同cmd001610，只有一次。第二次close记录command.rejected，没有第二补偿。其后合法DAY跨午夜：evt1670为day3计划在day4自主resolve，evt1671为day4 CP0→0/cap0唯一refresh，evt1672/1673为world4320/4321实际time.advanced。close截图DOM可已到day4 00:00，而其原SAVE尚day3 23:59；650ms checkpoint延后不应拿截图日历覆盖原SAVE。后续实际保存day4 00:01。

**B15真实650ms竞态：** native timeout499、delay650，stack实际为resolveNight→requestCheckpoint；generation1792013137202.1，schedule1792013151132。真实trusted重新开始click在1792013151712，即 **580ms**；clear1792013151717，即585ms；无fired。旧key立即、2800ms后和两次reload均缺失，再启动新局固定十人且无旧threat。此来自真实public低HP战斗失守，未注入resolved结果；不是用普通重开场景冒充pending race。

**B7与统计UI：** battle缺数字而同实例旧receipt保留时，实际kills4/breaches2/damage0；battle与receipt同时缺时显示未记录。缺supportIds两种都显示未记录，保存defense74实际显示74；B1完整supportIds=[]显示0。本独审跨机核原图18/130/141的SHA并目视确认已知统计及未记录、防线74和相应支援，修复了291a模板0显示。缺数字没有从active敌人数组造数。另核原图275的暂无存档新局菜单及283的SAN50原报告；可信后台事件仍由原trace证明，截图不能代替hidden证据。

**B11/B13整份备份：** immediate实际回读与选择的原checkpoint比较资源、日期、NPC、contentState、world、quests、replay；原安全backup raw bytes不变。一次真实save.migrated，严格保持原latest300 ledger允许的唯一迁移尾窗，不混坏主档状态；两次reload无第二迁移。实际browser仍未覆盖backup写/回读失败retry，这属于源码控制范围。

**四真实18：** DAY/resolved/closed/INITIAL原SHA/FNV分别锚定，完整旧持久域/NPC逐键保持；迁移一次且两次reload仍只一次，没有补NPC、promotion reward、旧plan或CP。三起始英雄与七locked身份保留，CP0/max0/granted原日、空idle计划。INITIAL仅已证06:00/空水位sentinel world0→360，原日历与原bytes保留；显式坏contentState/null/数组和非initial world0负例继续被Gate拒绝。

**独立DAY采集：** 实际公开路径采木，wood24→28，唯一resource.collected evt26/command cmd82，与真实resource.collect replay关联。该事实属于DAY-control；B1在报告位置只验采集入口，不称其在那里采集成功。

## 保留的验收边界

原首轮291a FAILED与本轮412c/v3 FAILED各自归档，不合成“连续通过”。源177与headless/golden结果、28方法mock、两data-only native探针、局部browser事实、完整browser结果分别记录。≥60秒后台追赶、内部pure renderer/RNG、storage写删失败与stale generation等仍有明确source-only范围。待独立v4方法审查与新完整browser终止后再给发布裁定。
