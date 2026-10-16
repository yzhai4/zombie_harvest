# 深度调研基线（设计输入）

来源：C:/Users/DELL/Downloads/deep-research-report.md；SHA-256：940EFAC9A98227DB2B4512771E474C8366B629D50D72D8E912923D83E2CF06EE；日期：2026-10-17。

- P0：先保证 fun、seed/config、snapshot、telemetry 与 AI 总开关。
- P1：版本化 Scenario Schema/Event Graph/Validator，拒绝缺引用、不可达/无 fallback、循环、不可满足门槛和越权 authority。
- P2–P4：先做规则/NPC planning，再做 EventFact memory/relationship，最后做白名单 observer/disclosure；Observer 只解释物品、NPC、事件并 deterministic fallback。
- P5–P6：exact simulator/counterfactual 之后才评估 learned World Model；Director AI、全自治社会延后，若 exact rollout 已足够则 no-go。

本项目已映射为场景 fixture、SAVE21 scenarioSnapshot、observer stub 和 evidence manifest，但尚未把完整 loader、六视图深冻结或自然 browser 接入生产。此文件是带 SHA 的设计输入索引，不是 runtime/CI/自然试玩证据。