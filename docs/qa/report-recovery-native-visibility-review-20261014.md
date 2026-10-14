# B16 原生 visibility 方法独立审查

**状态：** 最终 v3 冻结字节已独立审查，方法可支持下一轮独立 browser 验证；建议在真实 data-only infra 探针验证清理后启动新 48-case。尚无 B16 游戏通过或发布结论。412c 运行时源码验收与首轮 291a browser 失败结果分别保留。本文只读审代码、安装的 Playwright 一手实现和原探针，不修改 runtime、runner、原 profile 或报告。

## 首轮问题与原生方法

首轮报告 SHA256 `e5caf27e869bb7e25f5b740506ba069ab11d4658d033cb118cea3874e74ceb80` 的 B16 visibility events 实际为空；调用另一 tab 的 `bring_to_front()` 并不能证明隐藏发生。首轮完整结果仍为 1475 checks / 1463 passed / 12 failed、exit 1。

在服务器实际安装的 Playwright Python SDK，`BrowserType.connect_over_cdp` 存在 `no_defaults` 参数。其说明明确：`True` 跳过 existing default browser context 的 focus/media 等默认覆盖；之后新建的 `browser.new_context()` 不受这一选项影响。实际 `playwright/driver/package/lib/coreBundle.js` 39020–39024 附近也仅在 `browserOptions.noDefaults && context === browser._defaultContext` 成立时跳过 `Emulation.setFocusEmulationEnabled(enabled: true)`。因此 native 分支必须持续使用 CDP 返回的原 default context，不能新建 context 后仍称 native。

根执行者独立探针原 JSON：`/home/ubuntu/.cache/zfarm-qa/native-default-context-visibility-probe-20261014.json`，SHA256 `d124166d3854e4b05d52da7428ffd2723c470081b819dd247e99ee7979bfa89b`。原 helper SHA256 `760ef83c906392099fe4774a02fa9a69e6aa0de58497ddbf5dedaec2f4d5b049`。本独审读取原件后确认：真实新 tab 前台时 `hidden`，返回时 `visible`；事件均 `isTrusted: true`，performance 时间为 60.399999998509884 与 2936.5，实际隐藏约 **2876.1ms**。探针声明 `gameplayExecuted: false`，没有注入 visibility property 或 dispatch 合成事件。

该探针仅证明原生 visibility 方法可行；不是游戏 B16、跨午夜或 ≥60000ms catch-up 通过证据。窗口 headed/Xvfb/Openbox 单独存在，也不足以消除非 default context 的焦点模拟。

## v3 冻结代码的约束

`NativeVisibilitySession.open()` 为这一场景创建新 `mkdtemp` 私有 profile；profile 在 artifact run 之外，校验 resolved parent、prefix 和不进入 run。单独启动 owned Chrome，`start_new_session=True`，只开放 `127.0.0.1` 的随机调试端口；从这一新 profile 的 `DevToolsActivePort` 校验合法端口和 browser 路径，再 `connect_over_cdp(no_defaults=True)`。强校只一个 existing default context、只一个原 `about:blank` page。失败抛异常，没有退回 focus-emulated context 的路径。

`execute()` 仅对有 visibility 标记的 B16 在明确 `--native-visibility` 下采用该 default context/原页；其余场景保持分别新建的 Playwright context，builder 仍是没有游戏 runtime 的独立 about:blank。native 页和通常页都在首次 `goto` 之前安装同一 one-time origin/window.name fixture seed 与声明的原生 API observer。没有 loader 后改 GameState、写新 fixture、调用隐藏游戏函数，也没有设置 document.visibilityState。

B16 通过真正另开同 default context tab 及 `bring_to_front()` 观察背景，返回原页后再截图。成功断言同时要求实际读取的 `hidden/visible` 值，以及 observer 记录的同 generation、按时间排序、`isTrusted === true` 的 hidden→visible 原生事件。事件内容从实际 sessionStorage trace 读取，未根据 driver 调用造事件。请求隐藏 2800ms，case 元数据和 sourceOnlyRequirements 明示 ≥60000ms 分支仅源码验证。

`finally` 区分 owned native session 和一般 context，不能 `context.close()` 关闭 default context。native 先 close 自己的 CDP browser，再仅对 `start_new_session` 所属的 owned Chrome group/主 PID terminate、wait、必要时 kill；主 PID 和 group 都停，且 profile 路径边界复核通过才 rmtree。无 GC finalizer 提前删 live profile，没有 killall 或宽泛路径删除。清理的实际 `ok` 被追加为 actual check；若异常或进程/group/profile未清理，case 失败且整体 errors 不为空。

报告显式披露 B16 使用 owned ephemeral disk profile、无复用/保留用户 profile；其余 context 仍隔离，不能把整套 browser 称为完全无 observer。

## 保存、字段与整体成功条件

v3 沿 v2 的证据规则：原 writer21 和四真实 writer18 输入有原 bytes SHA/FNV/provenance；派生变更写 input，原 HTML 响应逐次按冻结 SHA 校验。公开 lifecycle 后直接读实际 SAVE_KEY/原 rawStorage，核 FNV、calendar/schema，再比较整份旧持久字段/NPC/ledger 的严格 300 tail；损坏或空 storage 保留诊断且不冒充 payload。report DOM 的 defense/support 与 fixture 实际历史字段比较；不调用运行时内部 projector 把输出再当真值。

新 B1 比较关闭后四 DAY 按钮 visible/enabled，并实际开/关建造 drawer；成功采木材单独来自 DAY-control 的真实公开路线、增加木材、唯一 resource.collected receipt 与 exact resource.collect replay。B1 未在原报告位置采集，不能借另一场景称其已采集。B15 保留真实 pending650ms、generation/ID 和 trusted restart deadline 证据。

整体 gate 直接要求完整非空 planned matrix、无 notRun、全部实际 case passed、完整 contract groups、四真实18全部完成；再结合 completed、actual checks、无 errors/pageErrors/非 favicon 资源错误决定退出状态。native infra 或清理失败必须失败，不能用根探针补成整轮通过。

## 冻结与后续证据

唯一 runner owner 已冻结，本独审读取仓库与本机私有 `recovery-412c/runner` 的 SHA 一致：

| 文件 | SHA256 |
| --- | --- |
| server-report-recovery.py | `0a76f30d9ce1e138fdecf50fae65a7d57d9bfa7eb7380396e0327104e717fe72` |
| report_recovery_full.py | `725cca14f9d8909a37ba88433962e0ac9376af1d5a236011ba826e2082f2f077` |
| report_recovery_fixtures.py | `41474fc24c1dd14a256ce2ae8bd074ab40b672a2810eb489d31dbf4f06177390` |

对冻结 full.py 实际 class/function AST 提取的独立 **28 项 method mock 控制全部通过**：接受同 generation 的可信事件/准确 duration，拒不可信或缺事件/反向时间，拒非法端口/path；仅 existing default context，额外 context/非 blank 原页失败无 fallback；owned launch/new process group/路径边界；清理幂等；owned group 仍存活时保留 profile 且明确失败。输出 `C:/Users/DELL/.cache/zfarm-report-recovery-review/native-v3-frozen-independent-controls.json`，SHA256 `16d265d45a771409975931c98b899a7a04f466b744a03d0deb24b466a26a4495`，声明 `gameplayExecuted:false`、`realBrowserLaunched:false`、`mockProcessOnly:true`。

另外只读用冻结 fixture module、三份21和四份18原输入构建矩阵，确认 **48 unique planned cases、仅1场 native B16、其余47场分别通常隔离 context**，没有多场共用 native profile。输出私有 `native-v3-frozen-matrix.json`，是离线矩阵控制，不是48场已执行。

已读根执行者 `recovery-412c/probe-frozen-native-session.py` 和 shell：实际 import 冻结类，仅 data/about:blank 原生两页；真实 states/trusted events 与 actual cleanup 同时决定 exit0。finally 在 Playwright 活着时 close owned session，shell 只清自己启动的 Openbox PID。

**实际 infra 探针已 exit0。** 本独审从服务器复制其已结束原 JSON `recovery-412c/infrastructure/native-session-probe.json`，原 SHA256 `5835d312fc94bb0c8e1e891815e58d6fc9d073f10393b99cc87c60a3bef1daab`。实际 trusted hidden/visible 时间为 61.899999998509884/2971.800000000745，约 **2909.9ms**；`ownedProcessStopped`、`ownedProcessGroupStopped`、`profileRemoved` 都 true，`profileRetained:false`，`cleanupErrors:[]`。`ownedGroupKillUsed:true` 明示实际组清理使用 SIGKILL，而非仅主 PID 退出就删 profile。仍是 `gameplayExecuted:false`，不能替代游戏 B16 或60秒追赶。

最终意见：无阻塞 v3 方法的已知缺陷，三SHA保持冻结，真实 infra 门禁已结束且合格。根执行者新48-case已启动，session79876/PID166426，报告 `recovery-412c/browser/run-20261014T211705Z-043adff1/report.json` 仍 running；不读正在变动的文件来给完成结论。后续实际 browser 应保存 served412c SHA、完整 report/rawStorage/input/原生 trace/截图与 terminal exit，独审后才能裁定 B16。首轮291a报告与失败不改，短探针不替代整轮或长后台证据。
