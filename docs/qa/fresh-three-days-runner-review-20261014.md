# 严格三日 tester 独立审查

**状态：** validated / source-ready，可冻结下列精确字节；真实全新 profile 三日运行与 strict artifact Gate 尚未执行，本审查不等于游戏通过或可发布。

**日期：** 2026-10-14。

| 文件 | 本次独立核验 SHA256 |
| --- | --- |
| [server-three-days.py](../../scripts/server-three-days.py) | `293fc76c7479cb16989510c7d2aad3e116f763f36786d52ca91c009b88229c2e` |
| [verify-three-days-artifacts.mjs](../../scripts/verify-three-days-artifacts.mjs) | `4cca9356ceba55e47d9ac6c4ec0d08b62e926d2f7df2d29930f5af62f80b7434` |

被测 HTML 候选仍为 `412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8` / SAVE21 / CONTENT3。没有修改 HTML、两份 tester、原 profile 或原工件；没有启动浏览器、HTTP 服务或实际三日 runner。原 tester 完整字节的 SHA 独立核对为 `3e9921b66a3162c5db2611d1c268f2fd257ec6654e1f0e97e0ea60a9d55f58d3` 与 `b4b94517cc7dd2b088d863f79b0970795581e922fb5f278e5b41d1e45d55f81c`。

## 结论与执行边界

未发现阻止冻结这两份 tester 的源码问题。必须使用明确的 `--fresh --strict-fresh --expect-html-sha256 SHA` 执行新路线，并使用 `--strict-fresh --expect-html-sha256 SHA` 执行独立 Gate。仅 `--fresh` 或默认旧 Gate 不证明单构建、逐日刷新与第四日清晨覆盖。

严格模式应先通过恢复主题完整浏览器门禁，再由根代理核对不可变 QA 字节、loopback 实际响应、全新空 profile 与新报告/工件根。测试期间不替换源码、脚本或 profile；观察超时只轮询同一真实 handle/PID。失败后即使恢复成功，也不能把该报告称为本次从头单会话通过。

最终证明同时依赖：实际 terminal exit0、完整原报告、独立 strict Gate、原保存的 SHA/FNV/日历/账本和声明 coverage。方法检查、旧 Gate、CI 语法检查均不能代替新游戏运行。

## 源码合同审查

| 合同 | 独立确认的实际接线 | 判定 |
| --- | --- | --- |
| 参数关联 | runner 的真实 parser 明确要求 strict 模式同时有 fresh、完整 expected SHA、finish-hour≥6；fresh/resume 互斥。verifier 明确要求 strict 与 expected SHA 同用，不允许只给 SHA 后使用旧合同 | 符合 |
| 全新 profile 与工件 | Chrome 启动前拒绝非空 profile、已有报告/checkpoint、同一个报告/checkpoint、非空工件目录和 profile 与工件/报告重叠；拒绝初始化不会覆盖已有报告 | 符合；实际执行还须根代理核对新私有根 |
| 首次页面及公开 reset | 先注册 main-frame document response listener；goto 的实际 response 进入 record_build。fresh reset 点击包在真正 expect_navigation 中，再记录返回的实际主资源 response | 符合；没有用 wait_for_load_state 代替新响应 |
| 逐 document 身份与 body | listener 只收主 frame 的 navigation document；record_build 要求下一个观察到的 Request 与调用返回的 Request 相同，并实际读取 response.body() 计算 SHA。未观察、错 Request 或额外未归属 document 不能继承上一个 SHA | 符合 |
| HTTP 缓存 | 校验的是实际 response 的 body，status200 缓存命中也要重新取 body 求 SHA；没有用本地文件 SHA、HTTP 服务 readiness 或旧记录替代响应。status304/失败响应不被当成成功200 | 符合；真实浏览器响应顺序仍由新运行验证 |
| 全部已知同构建 | 每次响应核 expected SHA；最后要求所有已观察 document 均有对应 body/build 记录、所有保存 metadata 同 SHA、无 resumeSessions。独立 Gate 还要求原报告 strict 契约、精确 origin/URL、全部保存来源已知且唯一 | 符合 |
| 不能漏 fresh 内部 reload | 独立 Gate 要求 `initial document` 与 `fresh public reset document` 各一次。删掉 reset、重复 reset、额外未知 document、错 index、错 origin、未知或不同 SHA 均被拒 | 符合 |
| DAY1 显式刷新 | setup 后、首场遭遇前在实际 calendar day1 调用 refresh_check；刷新前原保存、真实 reload、公开 continue、可见 CP、刷新后新自然 time.advanced checkpoint 均入报告 | 符合 |
| DAY2/3 显式刷新 | 实际日界 finish_transition 后各调用 refresh_check，严格 Gate 要求精确 stage 与各自唯一 before/after 原保存；旧恢复命名不能冒充 fresh 覆盖 | 符合 |
| 刷新后的事实 | 独立 Gate 核同日新保存、完整新 event window、world.advance 命令与自然 tick 逐一关联、准确分钟轨迹、CP/计划/配给/upkeep 不重复。合法 NPC 饥饿消费从 food 差量扣除；行动、额外奖励、计划重结算均不获通过 | 符合 |
| DAY4 清晨 | 实际路线按真实分钟推进；runner 与独立 Gate 均核完整原最终保存 `day===4` 且≥06:00。05:59、较早日期或以 day5 替代均被拒 | 符合 |
| 默认旧 Gate | strict 检查为显式新增分支；默认原报告与完整保存核验输出经独立运行逐字段比较，90 artifact checks 与2 developer controls 完全保持 | 符合；不能把旧模式称为 strict 通过 |

在服务器仅只读检查实际安装的 Playwright primary source，未 import 或启动 Playwright：`sync_api/_generated.py` 第17232–17296行确认 Page.expect_navigation 返回主 frame 的主资源 response 且支持 reload；`_impl/_page.py` 第1309–1315行委托 main_frame；`_impl/_impl_to_api_mapping.py` 第66–72行确认同一个 implementation 对象缓存复用 API instance。这支持 Request 身份校验的实现前提，不能替代浏览器实证。

## 独立方法控制与原件保持

独立新私有目录中的控制程序使用当前源码的真实 parser、Runner 方法与 verifier 导出方法。Python 去除 Playwright import 和 main 入口后编译 AST；transport 为明确的开发假对象，body 使用实际冻结 HTML 字节。Node synthetic source 契约只作为方法输入；旧真实 day4 reload 对只作纯 artifact 方法诊断。均未写入游戏 localStorage、执行游戏或修改原报告/保存。

| 独立执行 | 结果与范围 |
| --- | --- |
| runner 19项 AST/方法控制 | 通过。strict 参数缺失/互斥/清晨/坏 SHA；真实 body 读取；同字段但不同 Request 对象；漏 response、额外 response、iframe；末尾多 document、未知 snapshot、缺 day2 reload、提前终态、resume 均覆盖 |
| verifier 31项方法/旧 artifact 控制 | 通过。默认新旧输出完全相同；strict 拒旧恢复报告；synthetic source 基线与 reset/HTTP/status/index/origin/来源/resume 缺损；真实旧 day4 reload 对及 stale/CP回补/额外粮/计划变更/有 causation 的 tick/伪装行动/新 threat 负控；清晨边界及真实 CLI 参数组合 |
| 默认 Gate 独立复跑 | 同一私有重绑定原 bundle：新旧均 `ok=true`、90 artifact checks、2 developer controls，整个输出 deep-equal。两方法负控未加入 gameplay 数字 |
| 旧报告 strict 诊断 | `ok=false`，四个新检查失败：strict source 契约与 DAY1/2/3 精确刷新覆盖。原最终 day4 06:36 清晨事实仍保留；缺口没有通过当前日期补验被覆盖 |
| 不变原报告 SHA | 控制前后均 `62ad36b2c7add9d2e36148655cd1755de25c42563e7861e66dce887bcc2ab564`；原件、原 profile 与失败历史均未改写 |

作者提供的15项 runner 与21项 verifier 方法控制另行审阅；上表独立19/31是方法证据，不追加到原439或未来三日 gameplay 总数，也不声称测试了浏览器 event ordering。

## 尚待真实运行证明

当前没有这两份精确 tester 的新三日浏览器终态或 strict Gate 通过。下一实际运行须检查 reset/goto/reload 的真实响应顺序和 Request 对应、所有保存的单 SHA、DAY1/2/3 实际新自然 tick、三个真实遭遇及唯一关闭回执、真实种植/收获与 food 来源、日界计划/CP/人口守恒，以及第四日清晨保存。

路线仍使用公开兵营训练推进30分钟，会提升 SAN/士气、改变压力；严格单构建通过也只能证明这条公开回归路线，不能代称自然节奏、平衡或完整14日体验。低信任路线不能证明非零已花 CP 的防回补；晋升、死亡继任、据点和后续阶段仍需对应独立夹具与真实体验。

新增知识记录为本页 QA 审查；无全局记忆更新，L0/contentVersion/运行时未修改。
