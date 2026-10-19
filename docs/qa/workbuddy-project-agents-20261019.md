# WorkBuddy 项目读取与 DeepSeek 子代理验收（2026-10-19）

新增开发期project_agents.py：DeepSeek父代理通过本机stdio MCP自行列目录、字面搜索和按行读取已对账项目源码，并最多分派两个同步专业子任务。子代理只有三个项目工具。原run.py严格无工具模式保持原字节；项目模式不改变游戏内LLM知识或GameState权限。

## 实际证据

- 本机Windows/Python3.9，86项离线测试全部通过、0跳过：原路由/流式32项，代理流式24项，文件网关13项，调用器/守卫17项。覆盖真实子进程、并发预算、路径/真实junction/hardlink、全文件凭据签名、子结果不能代替根结果、越权/超时、代码漂移及Windows Job整树回收。[原终态](evidence/workbuddy-project-agents-v1/offline-tests.txt)
- 第二次真实能力探针：23.92秒，DeepSeek实际派生evidence-reader，孩子使用list/search/read取到任务中未给出的随机证明和约束；越界与敏感文件分别被拒绝。父注册清单四项、子三项；该清单不是actual request定义，实际过滤还核本机CLI tools/deny链。[探针核验](evidence/workbuddy-project-agents-v1/probe2-verification.json)
- 当前游戏审查：152.42秒，实际script-designer＋runtime-auditor两子代理，19个provider请求下界、33次工具调用（含2次Agent）、31次网关调用。源码与调用器运行前后身份一致，Job余进程0，网关终止确认。[输入](evidence/workbuddy-project-agents-v1/game-review-task.md)、[回执摘要](evidence/workbuddy-project-agents-v1/game-review-summary.json)、[原答复](evidence/workbuddy-project-agents-v1/game-review-response.md)、[主代理取舍](evidence/workbuddy-project-agents-v1/game-review-triage.md)

## 保留的限制

第一次真实探针为协议成功、能力未完整通过：父代理误把“避免自己重复读取”传成孩子禁止读取目标，未拿到随机证明；调用期间修改了caller清理等待，故该次caller源码绑定不可认定。第二次是明确诊断后的新任务，原失败不改写。

本机CLI2.169.0子任务轮数下限200，不能宣称8轮硬限。hook故障可能放行，因此边界依靠明确工具/deny、自己的只读网关、共享预算与外层整树回收。注册清单不等于实际每请求工具定义。模型接口、成本、实际token请求采纳度按回执判断，不能宣称硬费用封顶。

| 实际调用 | CLI输入token | CLI输出token | 已观察请求下界 | 费用 |
| --- | ---: | ---: | ---: | --- |
| 首探针（能力未完整通过） | 23521 | 1654 | 4 | 未知 |
| 修正后的能力探针 | 28421 | 1250 | 5 | 未知 |
| 游戏六视角＋规则审查 | 366009 | 20403 | 19 | 未知 |

usage是根汇总，不再与子级/缓存字段相加。真实项目任务覆盖面更大，不能与短片段调用直接比较成本或质量；六视角与引用更完整，但仍出现遗漏公开菜单、错误二选一、证据定位不足等问题，已由主代理纠正。更多token本身不保证质量，也未测量主代理节约比例。

工作流已将复杂跨文件任务、角色分工、局部证据复用、低推理协调、实际事实取舍、私有日志与短监测纳入[Skill](../../.codex/skills/imsaver-workbuddy/SKILL.md)。CI新增Ubuntu与Windows离线矩阵；本记录仅报告已运行的本机及真实API证据，CI结果另按精确提交核验。

## CI 环境核对

首个集成提交 `0c4ed501b7f07ca0894230c90707a7885dc17029` 的[游戏 CI](https://github.com/yzhai4/zombie_harvest/actions/runs/39215777550)成功；[WorkBuddy CI](https://github.com/yzhai4/zombie_harvest/actions/runs/39215777547)中 Ubuntu 成功，Windows 运行86项、15项失败。原失败保留，不改写为通过。

Windows 日志显示两类差异：默认临时路径使用 `RUNNER~1` 短别名，触发网关启动路径身份校验和测试路径断言；Git checkout 自动转换 CRLF，导致原 `run.py` 的字节校验失败。其 CRLF 文件 SHA 为 `046103ac5c2241b2f3e06f8d97888e027e668cbea0fe8e1b7e87ee5ea16c50e6`，与本机对原 LF 文件作换行转换所得 SHA 一致。

本次仅将 CI 临时目录固定到 `runner.temp`，并在 Windows checkout 前关闭 `core.autocrlf`，保留原路径边界、86项断言和旧调用器原字节要求。修正后的 CI 结果需按新提交单独核验；本段不宣称新运行已通过。

第二次提交 `8090d0585848f98d152e088b07f433989c49a3a3` 的[WorkBuddy 运行39216972054](https://github.com/yzhai4/zombie_harvest/actions/runs/39216972054)在启动前失败、没有 jobs，两个平台的测试均未执行。该修正错误地在 job env 引用了 `runner.temp`；按[GitHub 上下文可用性](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability)，`runner` 在 step env 可用，job env 不可用。后续修正将三个临时目录变量移到实际测试步骤，原失败记录保留。

最终功能提交 `021e25a2b4537742b17cc668d8095e75de534e5e` 的[WorkBuddy CI39217434420](https://github.com/yzhai4/zombie_harvest/actions/runs/39217434420)通过：Windows 86项、0跳过；Ubuntu 86项中4项Windows专属进程/Job语义检查按平台跳过，其余通过。[游戏 CI39217434439](https://github.com/yzhai4/zombie_harvest/actions/runs/39217434439)同head成功，freshness15/15、commitVerification=verified，源码2205632与HTML082e一致。[精确提交证据](evidence/workbuddy-project-agents-v1/exact-head-ci-021e25a.json)保留run、job和原失败。自然玩法声明仍为false；这次工具工作没有修改、合并或部署游戏运行时。此记录只回写已发生的021e验收，不预填后续文档提交的CI。
