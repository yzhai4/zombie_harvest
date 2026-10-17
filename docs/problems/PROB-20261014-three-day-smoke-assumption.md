# 三日浏览器 runner 的日历假设不符运行时

**状态：** validated（错误日历假设已替换并完成恢复路线）；单构建新路线待补  
**范围：** 主游戏 browser smoke / 后续自然 day4 触发验收

基础新局真实浏览器关闭尸潮报告后仍为 day1 06:32。只读源码核对确认 `continueMorningReducer` 关闭可选遭遇报告，不增加 day、不推进 world 时间；`battleTick` 使用独立战斗钟。当前 `startThreatEncounter` 从按钮/快捷键/HUD 触发，没有自动每晚启动调度。

`scripts/smoke-three-days.mjs` 的浏览器路线却在每次 endDay/continue 后假定 day+1，因此该路线不能证明真实三日；本机55项 fallback 仅为静态合同检查。

下一轮先定义并落实真实多日 runner：读取 world 的 day/time 与保存事实，按公开玩家控制推进/等待，分别记录日历跨日与夜战报告。shelter整备(+20分钟)或兵营训练(+30分钟)可公开推进，但会改变SAN/士气，不能当作无副作用等待。自然 world 钟约1.2秒/游戏分钟，从 day1 06 到 day4 06约86.4分钟，需要持久运行、阶段保存和低频轮询，不能靠改隐藏 state 或重开夹具缩短证明范围。

副本的自动夜潮与14天主时钟属于 v84 状态契约议题；修 runner 不能擅自把可选遭遇改成强制换日。先收集自然多日状态证据，再将设计要求与当前行为对账。

2026-10-14的实际公开训练路线已走完day2/3/4日界、每个实际日历日一场可选遭遇、播种/收获与最终day4刷新。当前runner439项通过，独立76原保存Gate90/90；日历、遭遇次数及训练的SAN/士气副作用分别记录。八次失败与原profile恢复全部保留，早期source未知和day2显式reload缺口未冒称补齐。见 `docs/qa/calendar-public-actions-20261014.md`。新冻结构建仍需从头验证，自动夜潮/14天终局仍属于后续主题。
