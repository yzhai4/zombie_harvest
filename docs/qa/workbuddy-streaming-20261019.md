# WorkBuddy 官方交互模式增量（2026-10-19）

用户要求针对超时调研官方文档。本轮保留 [原四次材料调用失败](workbuddy-routing-20261019.md)，改进可观测性与截止判据；不能只因切换流式或有保活就说长任务已成功。

## 官方依据与选型

| 选项 | 本项目采用方式与依据 |
| --- | --- |
| 单次流式调用 | 独立阅读／草案任务保留 one-shot，使用 `stream-json` 与部分事件输出；文本 stdin 后 EOF。[无头模式](https://www.codebuddy.cn/docs/cli/headless)／[CLI 参数](https://www.codebuddy.cn/docs/cli/cli-reference) |
| 长连接／Session | 适用于多轮指导或首个 result 之后仍需接收后台任务事件；当前无这类消费者，不引入服务生命周期。普通查询与持久 Session 另有合同。[SDK](https://www.codebuddy.cn/docs/cli/sdk-typescript)／[会话](https://www.codebuddy.cn/docs/cli/sdk-sessions) |
| 三种时间判据 | 首模型输出、流间静默、任务总截止分别控制；首个 init 不是首 token，reasoning keepalive 仅提供活动信息，不延长总截止。[环境变量](https://www.codebuddy.cn/docs/cli/env-vars) |
| 终态与 schema | 必须显式 result success、is_error=false；保留 errors/errors_info。partial 的内部字段依实际2.169.0和受控子进程验证，不把未知 dict 视为成功。[Python SDK](https://www.codebuddy.cn/docs/cli/sdk-python) |

没有采用 Workflow／后台工具或 HTTP 异步服务：它们的任务事件与当前禁工具单次任务不是同一问题。[Workflow 协议](https://www.codebuddy.cn/docs/cli/workflow-stdio-protocol)／[HTTP API](https://www.codebuddy.cn/docs/cli/http-api)。本机代码与日志也未找到新增受支持的截断恢复禁用开关，不能声称 `max-turns=1` 限制了内部恢复次数。

## 已落地行为

调用器以线程并行排空 stdout／stderr，逐行消费 NDJSON，并按首模型活动、模型静默、总截止终止本次进程。官方首token、流静默与推理保活环境变量同步显式配置；禁后台任务与 shell snapshot。init 不重置首输出计时，有效 text／thinking delta 或官方 reasoning keepalive 只更新活动时间。partial／思考正文不写入采集器进度或安全 rows；最终答复单独保留，官方CLI自身诊断目录仍按原私有边界管理。

`progress.json` 原子写 PID、计时和计数；终态回执绑定调用器和采集器 SHA。成功要求进程exit0、明确成功终态、实际模型匹配、无工具调用、reader和进程回收完整。坏帧、无终态EOF、静默、总截止和只有partial均不能过关。`status` 展示已知token usage；原始credit缺失时保持未知，不用CLI的0美元字段替代账户credit。

## 实际验证

- 路由与终态解析15项、真实Python子进程采集8项，均实际exit0。后者覆盖 init不冒充模型输出、持续thinking／保活仍触发总截止、输出后静默、终态后进程挂起、EOF无result、坏帧、推理正文隔离及工具调用拒绝；不是23次模型调用。未完成流也保留已经观察到的模型身份，不据此猜总usage或判成功。
- `protocol01` 是无项目材料的新流式协议校准，预先固定90／45／30秒总／首模型／静默与1024输出上限。实际 Step `success`／exit0／正文 `OK`，模型元数据 `step-5-preview`，观察到1次provider请求，无截断，正常退出未强杀，reader全回收。首事件3.922秒、首模型活动8.234秒、总11.06秒；70事件／64 partial、正文2字符。已知3154输入／152输出token；原始credit缺失，费用未知。它只证明流式协议工作。
- `material-review01` 按执行前合同使用300／90／60秒和8192输出上限，实际300.38秒触发total_timeout，退出码1。首事件7.765秒、首模型活动11.547秒；6094事件／6060 partial、思考61888字符、正文0字符、坏帧0，观察到2次provider请求和截断恢复。进程与reader已回收，token总量与credit未知；原回执未保留实际模型身份，不能拿请求的Step名称代替实际modelIds。没有成功正文或质量审查意见。旧 review01–04 不变，不把新预算当旧运行续期。

上述新事实证明这个任务持续生成但未完成，不是等待首响应或流静默超时；没有证明复杂审查稳定、质量提高或节省成本。同类复杂审查停止复试，资料抽取与初稿仍需按各自真实任务验证，不从OK调用推定。模型意见也不替代执行验证、游戏浏览器或真人理解。机器记录见[选中摘要](evidence/workbuddy-streaming-20261019/validation-summary.json)。本轮游戏HTML仍为2fca，未因此改动游戏运行规则或发布生产。

两次在线调用各保留其当时调用器SHA，未改绑为最终源码。审查结束后仅补未终态流的已见模型身份保留、短status的token字段和相关离线断言；最终源码以23项离线验证为准，不补填一次未执行的最终版本在线通过。
