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
