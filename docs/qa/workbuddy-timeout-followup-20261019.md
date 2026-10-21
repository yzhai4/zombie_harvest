# WorkBuddy 超时调研与小任务分工增量（2026-10-19）

本轮核对官方文档和本机2.169.0，在既有流式调用上最小改进。原[流式材料审查](workbuddy-streaming-20261019.md)的300秒无正文失败不变，没有重试原题或把它归类为额度耗尽。相关[工作流](../iteration-workflow.md)与[Skill](../../.codex/skills/imsaver-workbuddy/SKILL.md)已更新并同步到项目和本机安装位置；未部署游戏或游戏内LLM。

## 官方结论与已落地改变

- 官方[环境变量](https://www.codebuddy.cn/docs/cli/env-vars)区分首输出、流静默与恢复轮；禁部分重试不能保证一次上游请求。调用器把内部相位截止略提前，保留原外层预算，显式记录恢复首输出、空流闸门与重试策略。持续reasoning不等于有效答复，不能因保活扩大总截止。
- 官方[SDK](https://www.codebuddy.cn/docs/cli/sdk)与[HTTP API](https://www.codebuddy.cn/docs/cli/http-api)提供多轮／取消和异步run查询；当前独立任务仍用one-shot，不为超时新增常驻服务。用户提供的[开放平台](https://www.codebuddy.cn/apiDocs/open-platform.html)另有企业应用身份要求，不能把个人模型key直接迁过去。依据的原始公开文件URL、抓取时间与SHA在[来源索引](evidence/workbuddy-timeout-followup-20261019/official-source-index.json)。
- 根据用户最新DeepSeek分工目标，新增显式`--model deepseek-v4.1-flash`，只调用该模型、记录`user_requested_model`，不改自动避让；未指定时仍保留Step优先、真实限额才备用。短`status`保留超时类型、正文／思考计数、实际usage、停止信息与请求下界，监测代理不必反复读取长日志。

可复用的[交互模式参考](../../.codex/skills/imsaver-workbuddy/references/interaction-modes.md)维护操作边界：CLI思考开关和请求预算不能保证上游不推理；长任务先缩成有出处的小交付，同一材料的相关视角尽量共享一次输入，不机械拆成多次重复调用。事实抽取、规则草案、实际执行与最终质量判断分开。

## 本次实际验证

安装后的路由和真实离线Python子进程共32项检查，PID6072、exit0；[原终态输出](evidence/workbuddy-timeout-followup-20261019/offline-tests.stderr.txt)保留原字节。覆盖显式模型成功／429／超时／401均不切换、不写避让，内部失败终态可在外层回收前返回，微小截止保持正数，以及短状态不暴露推理正文。这32项不是32次模型调用。

另按[执行前合同](evidence/workbuddy-timeout-followup-20261019/sample-contract.md)实际执行一次局部成本核对。输入只有候选内容包与9行效果函数、合计3276字符；明确DeepSeek、low、输出1024、总90／首45／静默30秒。内部相位40／25秒，不增加外层预算。实际模型元数据为`deepseek-v4.1-flash`，CLI exit0／success，调用器8.27秒、整个启动器8.735秒，输入4295／输出455 tokens；原始credit缺失，费用未知。观察到请求下界1、未观察到截断，CLI另报告num_turns=2，两者不可互换。进程及reader正常回收、未强杀。

维护者逐项核对了[原答复](evidence/workbuddy-timeout-followup-20261019/sample-response.md)的物资方向与引用位置：局部静态事实可用，模型也保留Gate与后续行为未知，没有冒称执行测试。但请求最多300汉字，实际323汉字，**篇幅目标未完全达成**；协议成功和输出质量分别记录，不为改写23字再发一次请求。主代理只消费短结论和必要定位。

原回执、输入绑定、离线终态与选中字段见[验证摘要](evidence/workbuddy-timeout-followup-20261019/validation-summary.json)。这条样例仅证明小任务分工能工作，未证明长审查稳定、整体质量提高、免费状态或节约比例；后续继续按实际token、费用、返工和可核实交付评估。关键游戏规则、事务、存档、浏览器和真人理解仍由项目证据验收。
