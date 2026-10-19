# 交互模式与超时诊断

本说明用于选择 WorkBuddy 交互方式、准备长任务和解释超时；不要求每个普通任务重新调研。官方文档于 2026-10-19 核对，本机 CLI 版本为 2.169.0；升级后重新核对所用参数。

## 先选实际需要的交互方式

| 消费者 | 选择 | 边界 |
| --- | --- | --- |
| 独立资料抽取、一个规则问题、局部草案 | 现有 one-shot `stream-json` 输出，文本 stdin 后 EOF | 流式使进度可见，不保证推理更快。 |
| 同一任务需要连续追问、反馈修订或主动 interrupt | 官方 SDK Session/Client 或流式输入 | 先定义上下文、取消、持久化和费用；resume 是新的推理调用，不是免费找回旧响应。 |
| 客户端必须断开后查询同一后台 run、订阅 SSE、取消任务 | 官方本地 HTTP API 的 runs 接口 | 需要服务 owner 和生命周期；当前独立辅助任务没有该消费者，不启动常驻服务。 |

依据：[CLI 参数](https://www.codebuddy.cn/docs/cli/cli-reference)、[SDK](https://www.codebuddy.cn/docs/cli/sdk)、[会话](https://www.codebuddy.cn/docs/cli/sdk-sessions)、[HTTP API](https://www.codebuddy.cn/docs/cli/http-api)。HTTP runs 的 `timeoutMs` 属于本地服务执行截止，不能推定它会延长上游模型请求的硬时限。

用户给出的[开放平台手册](https://www.codebuddy.cn/apiDocs/open-platform.html)对应另一组企业 OpenAPI。其[官方规范](https://www.codebuddy.cn/apiDocs/index.html) `api.yaml` 声明需要企业应用身份，不支持个人 API Key；不把现有个人模型 key 直接送往这些端点，也不为本轮辅助任务新建企业后台 Agent。

## 区分超时与重试层次

官方[环境变量](https://www.codebuddy.cn/docs/cli/env-vars)分别控制首模型输出、流间静默、自动恢复轮的首输出及空流恢复闸门。调用器另有首活动、静默和总截止；CLI 内部相位截止留出短暂回收余量，外层原预算不增加。receipt 记录两层具体配置。

- 只有 init：CLI 已初始化，未证明模型开始输出。
- 有 thinking 或 reasoning keepalive、无 text：模型仍活动，尚无可接受答复；保活不能延长总截止。
- 曾有正文后静默：核同一进程与终态，不能因断流另发同一问题。
- 显式成功 result：仍需 exit 0、实际模型匹配、无工具调用、清理完成及非空正文。

`MAX_RETRIES=0` 仅约束部分请求重试；连接级重试、网关策略和会话恢复另有行为。`max-turns=1` 也不保证一次上游请求。空流闸门设为 0 是关闭该闸门，不是关闭重试。保留实际观测的请求数下界和截断标志；进程已回收不能证明服务端立即停止计费。

低档的 `alwaysThinkingEnabled=false` 只说明 CLI 不主动配置扩展思考，不证明上游模型不产生 reasoning。SDK 文档将旧思考预算配置标为废弃，提供 `thinking` 与 `effort`；本项目尚未迁移 SDK，不把其选项当现有 CLI 已执行的设置，也不把请求预算称为生效 token 上限。

## 让任务能交付

一个任务只解决一个可核的问题，先给输出格式和最少片段。长报告先抽取与当前交付有关的事实、出处和未知项；后续只把这些定位及必要原片段交给规则分析或草案任务。六视角仍全部评估，但不重复向六个任务发送整份仓库。

遇到持续推理却无正文的长审查，保留失败，不照原题扩大时间或输出上限。下一任务必须有范围或诊断变化，例如一个 Gate 的反例、一个真实日志的原因、一个角色的知识边界。以有出处的短交付累计质量，不以答复长短或模型“通过”措辞验收。

用户明确指定 DeepSeek 时使用 `--model deepseek-v4.1-flash`，单独记作 `user_requested_model`；它不需要先制造 Step 限额。未指定模型时保留原 Step 优先、真实限额后才切备用的路由。指定模型失败不自行换模型或污染自动避让记录。

主代理抽查原件、实施与执行测试；模型不写权威状态或验收结论。监测仍交低推理只读代理，只回终态或实质变化。对比主代理阅读量、完整请求的输入/输出 token、已知费用、重试下界、交付质量和返工；费用或总 usage 缺失时标未知，不能宣称已量化节约。
