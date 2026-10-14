# 全新profile、单构建三日准备评审

**状态：** active / source-ready，严格tester已实现，待独审与真实运行；没有启动浏览器、服务或实际三日runner。

**日期：** 2026-10-14。

原runner SHA256 `3e9921b66a3162c5db2611d1c268f2fd257ec6654e1f0e97e0ea60a9d55f58d3`；原独立verifier SHA256 `b4b94517cc7dd2b088d863f79b0970795581e922fb5f278e5b41d1e45d55f81c`。拟测试HTML冻结为 `412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8`、SAVE21/CONTENT3，当前恢复主题完整浏览器门禁在前。

## 原文件只读发现

| 要求 | 原源码证据 | 准备结论 |
| --- | --- | --- |
| 新profile/公开开始 | parse_args第266–283行：必须显式--fresh，未传默认resume；run第1367–1377行公开reset再continue | 必须独立新空profile/报告/checkpoint/artifact根，不能用旧八次恢复profile或默认路径 |
| 每个document冻结SHA | record_build第360–370行记录goto/reload body SHA但没有expect参数/强制一致；fresh reset内部reload第1369–1370行未记录response | 实际blocker：需要明确expect/strict标记，捕获reset真正navigation response并强校所有document |
| DAY1/2/3显式reload | finish_transition第965行对day2/3/4调用refresh_check；run第1390行final day4再reload；没有DAY1调用 | 实际blocker：在day1公开setup后/首场遭遇前补真实保存、reload、continue和新自然tick证据 |
| 三遭遇/实际日历 | encounter第815–878行公开endDayBtn、真实夜战控制、具体started/resolved/closed命令；calendar_progress第1093–1136行用真实训练/自然tick跨日 | 当前结构可复用；关闭报告不代表日历day+1，不是自动夜夜尸潮 |
| 收获/粮食 | setup真实supply、采集、播种、莓果；day3真实成熟农田收获；check_transition核配给/NPC取食/原计划效果 | +30分钟训练路线只证明smoke，改变SAN/士气/压力；不作自然玩法或平衡结论 |
| CP/计划/人口 | 实际日界2/3/4核原计划权威终态/实例、一次CP、固定十人IDs和活人≥3/HP>0/collapse<90；refresh_check核新自然tick下不重复 | 低信任路线不能证明非零已花CP、晋升/死亡继任或据点等夹具场景 |
| 最终day4清晨 | --finish-hour默认6且循环按真实分钟退出；原Gate只要求day4，不要求hour≥6 | 严格Gate须独立检查完整原保存day4≥06:00，而非仅信任参数/报告state |
| 独立Gate | verifyReport第338–340行仅输出singleKnownBuild；没有strict source/reload/final-hour检查 | 需新增显式strict旗标，旧恢复Gate语义保持，旧结果不回写 |

原CLI的实际parse_args AST隔离检查已执行：--fresh/--timeout1800/--finish-hour6可解析；默认确实resume；fresh+resume、未实现expect参数、timeout0均退出2。没有import Playwright或实际Runner。verifier --help实际执行，接受report/allowed-root与developer-negative-controls。

## 原CLI可表达的冻结命令与预算

以下是原CLI已经支持的参数形状，须先准备不可变QA字节、loopback服务与全新私有根；它本身还不足以满足严格single-build要求，因此当前不启动。不要给原runner传尚不存在的--expect-html-sha256。

```sh
ZFARM_QA_DIR="$NEW_PRIVATE_QA_ROOT" "$VERIFIED_PLAYWRIGHT_PYTHON" "$FROZEN_QA_CODE/scripts/server-three-days.py" \
  --fresh --url http://127.0.0.1:8783/ \
  --profile "$NEW_PRIVATE_QA_ROOT/profile" \
  --out "$NEW_PRIVATE_QA_ROOT/three-days-result.json" \
  --checkpoint "$NEW_PRIVATE_QA_ROOT/three-days-checkpoint.json" \
  --chrome /usr/bin/google-chrome --timeout 1800 --finish-hour 6
```

全局预算显式1800秒，保留action30秒、单遭遇60秒、独立15秒心跳和父进程约30秒轮询；这是上限，不是完成ETA。每导航段至多4次真实攻击，成功核验攻击后只重置移动预算，仍受整体截止限制。观察超时只轮询同一确认handle/PID，不能重开。实际失败保留原报告/profile/checkpoint，后续恢复不得称为本次从头单会话通过。

QA_ROOT控制artifacts目录，不随--out自动改变，因此必须设置全新ZFARM_QA_DIR，且profile在工件归档之外。私有归档只复制报告声明的保存/截图/manifest，不能复制profile/cookie/密钥。不能使用原多次恢复目录或把上次76保存放进本轮结果。

## 接下来最小实现与验收边界

保留原文件不可变字节后，只修改两个tester：runner新增explicit strict-fresh/expect、reset response捕获、DAY1 reload及严格终态；verifier新增明确strict参数与逐document/全部snapshot单SHA、DAY1/2/3真实reload对、day4≥06:00检查。源码方法正反例另列，不算实际gameplay通过。当前HTML、L0、旧profile与原439/Gate90均不动。

恢复浏览器门禁通过、两个新tester独审、所有QA字节/SHA冻结、私有目录/HTTP response就绪后才开始本轮真实三日。最终必须同时有terminal exit0、非空完整原报告、独立strict Gate、全部artifact的SHA/FNV/日历/账本核验和声明覆盖。旧[公开行动恢复记录](calendar-public-actions-20261014.md)的八次失败、早期source未知、历史day2 reload缺口仍保留；Gate90与静态55不证明本轮单构建通过。

上述段落保留原审查时点。以下追加strict源码实现与方法控制，不改写原文件缺口或旧运行结果。

## 严格tester实现（源码，待真实运行）

- 新[runner](../../scripts/server-three-days.py) SHA256：`293fc76c7479cb16989510c7d2aad3e116f763f36786d52ca91c009b88229c2e`。
- 新[verifier](../../scripts/verify-three-days-artifacts.mjs) SHA256：`4cca9356ceba55e47d9ac6c4ec0d08b62e926d2f7df2d29930f5af62f80b7434`。
- 原3e9921/b4b945完整字节先复制至独立私有prechange目录，并逐文件SHA核对；原报告、profile、工件及旧Gate没有改写。HTML仍412c，actor素材与L0未修改。

runner新增`--strict-fresh --expect-html-sha256 SHA`，严格模式要求--fresh、完整SHA及finish-hour≥6。Chrome启动前拒绝非空profile、已有输出/checkpoint、已有非空工件目录和profile/报告路径混用；初始化拒绝不会覆盖已有报告。报告声明strictFresh v1及runner字节SHA。

main-frame document response监听独立保留实际请求；每次goto/reload核其对应request、HTTP200与实际body SHA。fresh公开reset改为等待真正navigation response后记录，也不能跳过额外未知document。最终需要全部观察到的document都有已记录的同一body SHA、所有保存snapshot同SHA及无resume session。DAY1 setup后增加真正refresh_check；DAY2/3/4原日界reload和最终day4 reload保留；最终实际原保存day4≥06:00。

这是源码接口准备，不是浏览器通过。实际安装的Playwright primary source已只读核验：sync_api的Page.expect_navigation存在并返回主资源response，ImplToApiMapping.from_maybe_impl复用同一实现对象的API实例，支持response事件与navigation结果的Request对应。该包源核验未启动浏览器；真实事件/响应次序仍由下一实际运行验证。

verifier新增明确`--strict-fresh --expect-html-sha256 SHA`。只有显式模式才增加5项硬Gate：逐document/全部snapshot同一已知SHA且包含reset/day1/day2/day3/day4/final response、DAY1/2/3三对真实刷新前后保存及自然tick/CP/计划/配给去重、完整原final保存day4≥06:00。缺源码、多构建、遗漏reset、缺每日reload、stale保存、resume或未达清晨均不能获得strict通过。默认模式继续使用原恢复路线合同。

## 已执行的方法控制与旧证据保持

| 验证 | 结果与范围 |
| --- | --- |
| Python源码语法/AST、Node语法 | 通过；没有import Playwright或调用Runner.run |
| runner 15项方法控制 | 实际parse_args/Runner/check/observer/record_build；严格参数缺失、wrong SHA body、未观察/额外document、非main frame、非空profile/已有报告均覆盖。transport是开发假对象，传实际412c HTML字节；不是真实浏览器 |
| verifier 21项方法控制/诊断 | synthetic transport完整/缺reset/unknown/changed/multiple SHA/resume/坏resume格式/额外document/异origin/空工件；旧原day4真实reload对仅作方法诊断，再作CP回补、额外粮、错自然命令、计划改变/重结算与清晨边界负控。全在内存，不写原保存 |
| 原attempt9默认Gate再核 | 新旧verifier对同一私有重绑定完整原件输出完全相等：90 artifact检查及2个原方法负控通过；raw original report仍`62ad36b2c7add9d2e36148655cd1755de25c42563e7861e66dce887bcc2ab564` |
| 原attempt9套strict参数 | 明确exit1：缺新strict source契约、DAY1/2/3严格reload阶段；其历史day3使用resumed名称也不冒充本次从头阶段。原默认结果没有变成strict结果 |

上述方法控制不加入实际gameplay检查总数。没有新的三日browser报告、strict artifact通过或自然/平衡结论；两tester仍需根代理独审和冻结。

## 新CLI冻结执行候选

以下参数在新实际parser已做源级正反例验证。根代理先把两新tester和412c dist/actor复制到新的不可变QA代码目录，核本页SHA与实际loopback HTTP body；准备全新私有QA根、独立空profile，并确认恢复主题完整browser门禁后才执行。环境变量中的Python/Node指向已核验运行时；这些变量不得指向原恢复profile或网页根。

```sh
ZFARM_QA_DIR="$NEW_PRIVATE_QA_ROOT" "$VERIFIED_PLAYWRIGHT_PYTHON" "$FROZEN_QA_CODE/scripts/server-three-days.py" \
  --fresh --strict-fresh \
  --expect-html-sha256 412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8 \
  --url http://127.0.0.1:8783/ --profile "$NEW_PRIVATE_QA_ROOT/profile" \
  --out "$NEW_PRIVATE_QA_ROOT/three-days-result.json" \
  --checkpoint "$NEW_PRIVATE_QA_ROOT/three-days-checkpoint.json" \
  --chrome /usr/bin/google-chrome --timeout 1800 --finish-hour 6
```

实际终止后只读Gate：

```sh
"$VERIFIED_NODE" "$FROZEN_QA_CODE/scripts/verify-three-days-artifacts.mjs" \
  --report "$NEW_PRIVATE_QA_ROOT/three-days-result.json" --allowed-root "$NEW_PRIVATE_QA_ROOT" \
  --strict-fresh \
  --expect-html-sha256 412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8
```

developer-negative-controls可另跑另记，不计gameplay。父进程保持确认handle/PID及约30秒轮询，失败不热改tester、不重置此profile求绿；失败后恢复记录只能作为恢复证据，不能改写本次fresh结果。工件归档及SHA/FNV复核仍在原runner终止后执行，源码source-ready不代表可发布。
