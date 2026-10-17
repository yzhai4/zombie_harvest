# 深度调研基线（设计输入）

来源：用户提供的 `deep-research-report.md` 原文；SHA-256：940EFAC9A98227DB2B4512771E474C8366B629D50D72D8E912923D83E2CF06EE；日期：2026-10-17。

原文已按原字节归档为[报告](../research/deep-research-report-20261016.md)，全文对照与当前路线见[落地计划](../research/research-adoption-plan-20261017.md)。P0–P6是证据依赖顺序；未来扩大地图/交互、多副本及特殊NPC连续性仍是长期目标，当前Demo规模不作产品上限。报告内旧会话引用、论文数字和未提供的关联CSV/XLSX不算已核验外部证据。

- P0：先保证 fun、seed/config、snapshot、telemetry 与 AI 总开关。
- P1：版本化 Scenario Schema/Event Graph/Validator，拒绝缺引用、不可达/无 fallback、循环、不可满足门槛和越权 authority。
- P2–P4：先做规则/NPC planning，再做 EventFact memory/relationship，最后做白名单 observer/disclosure；Observer 只解释物品、NPC、事件并 deterministic fallback。
- P5–P6：exact simulator/counterfactual 之后才评估 learned World Model；Director AI、全自治社会延后，若 exact rollout 已足够则 no-go。

本项目已映射为场景 fixture、SAVE21 scenarioSnapshot、observer stub 和 evidence manifest。纯 Observer 核心及返回值深冻结已实现；完整 Scenario boot、按角色授权的观察投影和自然三日验收仍未完成。此文件是带 SHA 的设计输入索引，不是 runtime/CI/自然试玩证据；原文的论文统计与旧会话引用尚未逐篇复核，不转为本项目结果。

## 原文建议与实际开发闸门

| 报告方向 | 已有基础与真实缺口 | 下一轮可验收结果 |
| --- | --- | --- |
| P0 可玩性、可复现与遥测 | 已有公开动作、账本、保存与源码回放；训练路线曾在第1天因玩家死亡失败 | 固定构建、公开动作、有限自卫/补给的日历回归与自然混合路线分别验收，不以训练提高 SAN 的路线评价平衡 |
| P1 Scenario Studio | JSON validator/resolver 为 headless；`scenarioSnapshot` 只是存储，没有实际 boot 消费 | [真实启动合同](../decisions/ADR-20261017-scenario-boot-contract.md)：严格配置矩阵、原子安装、新局真实 seed/资源轴、旧档不重算；先修[已知反例](../problems/PROB-20261017-scenario-stored-not-bound.md) |
| P2 规则 NPC planning | 已有需求、日程、岗位、继任、感知及白天伤害；最近友方可遮蔽敌情已作最小修复 | 保留 LOS/FOV/职业 Gate，先证明可见威胁与行动资格，再做受预算规则规划；不会因 NPC 在名册就假定它会救援 |
| P3 记忆、关系与 P4 Observer | 当前表达核心只处理可信输入；冻结对象不能替代角色知识权限 | [actor 观察合同](../decisions/ADR-20261017-actor-observation-v1.md)：可信捕获、纯角色投影、knowledge 与 disclosure 交集；先堵[伪造 subject/context 边界](../problems/PROB-20261017-observer-trusted-input-boundary.md)，再增加 EventFact 记忆 |
| P5 精确反事实与 P6 learned World Model | 游戏规则仍是 Ground Truth；尚无 learned 模型收益证据 | 先对相同 seed/input/contentVersion 比较 exact rollout 的正确率、成本和策略收益；达到目标即可停止，不为模型新颖性增加不可验证状态 |

各阶段均由剧本设计师分别评估玩家、NPC、营地、势力、敌人和全局事件链的动机、信息、资源来源与后果。引擎迁移继续围绕 GameCore、命令、事件、保存和渲染适配器的边界推进，不将当前 HTML 内的候选接口写成已可独立运行的引擎模块。
