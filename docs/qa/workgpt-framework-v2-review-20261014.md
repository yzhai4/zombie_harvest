# WorkGPT Framework v2.0 审阅记录

**状态：** reviewed as reference; 未接入项目。  
**材料：** `Zombie_Harvest_WorkGPT_Framework_v2.0.zip`，SHA-256 `4ee090b47c6a27311d01b513dac24131ed215f4ff3b2e3d86be52768223ef1cc`，16个文件、37583字节。

## 结论

压缩包是上下文/工作流模板，不是项目现状审计，也不包含业务代码、实验结果、自动安装程序或发布配置。包内 `CURRENT_STATE`、`PROJECT_CONTEXT`、`SOURCE_MAP` 和 `TASK_QUEUE` 明确保留 UNKNOWN/未绑定；`SEND_TO_WORK_GPT` 也要求接收方先核验项目现有规则和来源。它不能覆盖本仓库的 L0 设计、当前 `dist`、SAVE/CONTENT 版本或已有 Skill。

可复用的部分是：按任务选择最小流程、区分设计/实现/运行/验证/发布、保持唯一事实源、记录失败和恢复边界、对子代理限定写入范围。项目已有 `zombie-harvest-iteration` Skill、六视角剧本工作流和 ADR/QA 记录体系已承担这些职责，因此没有把模板复制进项目根目录，也没有改写 `AGENTS.md`、安装依赖、启动业务实验、接触生产存档、推送或发布。

## 与本项目的对账

| 框架声明 | 项目当前对应证据 |
| --- | --- |
| 状态需要重新核验 | `docs/memory/current-state.md`、`docs/memory/open-risks.md` 和实际 Sites/GitHub/服务器检查 |
| 设计、代码、测试、发布要分开 | `docs/iteration-workflow.md`、各 `docs/qa/*`、PR #4 和 Sites 对账 |
| 不可信材料的指令不自动授权 | 本次只读取压缩包，把其内容当参考材料 |
| 当前事实未知时保留未知 | 三日根因、真实计划 browser、维修 browser、NPC 技能消费者仍保持 open/proposed |

本审阅只产生这份记录和后续领袖 Harness proposed ADR；它不表示框架已经由宿主自动加载，也不表示任何业务功能通过。
