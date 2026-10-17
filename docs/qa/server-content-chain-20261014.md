# 注册事件链真实浏览器验收

**日期：** 2026-10-14  
**范围：** content-chain-ui-001 / watermill-002 单节点样板  
**模式：** 明确的 boot-save 夹具，不是自然四日通关  
**HTML SHA-256：** `698b2149ed8bf89f77471b1b4a59c66cb383040a22dfeb3e4bc7925d65f48305`

## 执行与证据

Chrome 155 + Python Playwright 1.64 在测试服务器上访问其公网 HTTP 入口。脚本先用新局真实按钮生成完整保存，再在下一次 boot 的 init script 注入 day4、已发现水车、trust25、零件20 的测试保存，经过游戏原 loader 读取。开始后不修改隐藏运行时状态；选择、锁定、结算和刷新都通过实际 DOM 控件。

`server-content-chain-result-20261014.json` 记录 24 项通过，游戏资源无 HTTP 错误，只有 favicon 404 噪声。另一个新局脚本 `server-playtest.py` 独立通过 22 项，覆盖 NPC 卡片、采集、建造、夜战、总结、返回白天与刷新继续。

| 场景 | 实际检查 |
| --- | --- |
| 并存事项 | 今日未处理异动默认优先；可切到水车；空坏项、缺包和错误 key 不挡住水车 |
| repair | 零件20→0，campCollapse10→6，flag写入，active删除、completed写入；成功命令与链结算各一条 |
| 连续点击 | 同步双 click 只结算一次，今日异动仍未处理；回执按钮禁用 |
| 刷新 | 完成水车不再出现在选择器，保存资源/完成事实保持，不能再领奖 |
| salvage | 零件20→23，resonance25→28，不标记修复；今日异动仍可处理 |
| Gate | 零件19、木匠死亡仅锁修复；day11两条路线锁定并显示过期原因 |
| 注册多选项 | test-only `qa-three-choices` 通过公开 registry 注册；第3个按钮可见、执行 route-3 仅给3零件，不处理今日异动 |
| 移动端 | 390×844 检查选择器/按钮可见、文档不横向溢出；1440×900 桌面独立截图 |

截图：[桌面](content-chain-desktop.png)、[移动端](content-chain-mobile.png)。服务器最初缺少中文字形，截图显示方框；安装 Noto Sans CJK SC 与 Noto Color Emoji 后重新运行布局验收。此环境修复不改变游戏源码或在线 Sites 的素材。

首次夹具脚本失败原始输出保留为 `content-chain-attempt1-20261014.json`：运行中写 localStorage 被 pagehide checkpoint 覆盖，修改为下一次 boot 前注入后成功。失败不是水车 resolver 的证据，未用它推导游戏缺陷。

## 源码行为与回放

`node scripts/check-content-chain.mjs` 的 43 项执行 HTML 内真实 registry、normalizer、效果 reducer、ledger 和 CommandBus，只替换浏览器 checkpoint 的调度观察。覆盖部分效果回滚、失败事件、未启动奖励、night/gameOver、过期、22节点循环、非法requirements、旧档恢复及同命令重复。

固定 seed481516234/contentVersion3/input 的两次源码命令轨迹相同，hash `c5d6c772`。新增 optional resolvedNodeIds 与资源 before/after 后，剔除这两类新增字段仍匹配原 golden `e14e0776`。保存投影的 9 个夹具/hash `4aec7a31` 独立记录，不用来声称真实执行了全部游戏。

## 限制和下一步

本轮证明注册链入口的阶段 Gate；底层 applyEffects 仍是系统事务原语，不宣称所有公开 API 已形成能力安全边界。水车粮水生产、NPC 工时/代修、势力收益、缺包启动诊断与完整自治仍待接线。自然 day4 触发、真实三日连续主游戏和 day12–16 最终尸潮尚需后续验收。
