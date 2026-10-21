# 日历结算与公开行动推进（calendar-settlement-001）

**状态：** 本轮状态契约已接线，真实源码回归已执行；最终三日浏览器验收 pending  
**范围：** v83 前置可靠性切片；`SAVE_VERSION=21` / `CONTENT_SCHEMA_VERSION=3`  
**本卡用途：** 描述已有日历、计划会和区域动作的结算合同，不新增注册剧情链或修改世界时钟语义。

## 设计与证据来源

- 世界因果、固定人口与夜战边界：[01 整体世界观与叙事法则](../../剧本/尸潮农场/01_整体世界观与叙事法则.md)。
- 长期时间线：[02 14天时间线与最终尸潮](../../剧本/尸潮农场/02_14天时间线与最终尸潮.md)；day14 / day12–16 是后续设计目标，本轮不据此声称终局已运行。
- 每日权限与计划会：[07 计划会与 commandPoints](../../剧本/尸潮农场/07_计划会与commandPoints.md)、[计划会剧本卡](camp-plan-meeting-001.md)。
- 本轮流程：[迭代工作流](../iteration-workflow.md)、[长期计划](../long-term-plan.md)。
- 运行时真相：`dist/index.html` 的 `advanceReducer`、`chargeDailyRation`、`runWorldDayUpkeep`、`executePlanMeeting`、`refreshCommandPoints`、`interactCampArea` 和 `continueMorning`。
- 已复现问题：[日历测试假设](../problems/PROB-20261014-three-day-smoke-assumption.md)、[计划结算与同日补点](../problems/PROB-20261014-plan-day-settlement.md)、[附近操作距离](../problems/PROB-20261014-context-range.md)。

## 玩家承诺与节拍

玩家可以用真实移动、采集、播种、营地训练、晚餐和防守来维持农场。日期变化来自世界时钟跨午夜；一次尸潮遭遇的报告关闭后，玩家回到同一个日期和钟面继续准备，不会被隐式送到下一天。

```text
公开区域动作 -> camp.area.interact -> reducer -> time.advanced / camp.area.interacted
世界钟跨午夜 -> 配给一次 -> 旧计划结算一次 -> 当日 CP 授予一次 -> upkeep / 作物 / 内容钩子
公开启动遭遇 -> threat.started -> 实时战斗 -> threat.resolved -> 计划会候选
已结算报告 -> threat.close -> threat.closed（指定 threatId） -> 恢复原日历世界
```

`state.night` 当前表示遭遇输入锁；钟面光照由小时计算。日历与遭遇是两项证据：三次遭遇发生在 day1 / day2 / day3，不等于自动每晚生成尸潮。报告按钮名和旧函数名中的 morning 不构成换日规则。

## 触发、前置与拒绝

| 入口 | 允许条件 | 拒绝或降级 |
| --- | --- | --- |
| 世界钟推进 | 使用既有时钟或真实行动的分钟数；跨午夜由 `advanceReducer` 处理 | 暂停、隐藏标签或遭遇时钟按现有运行时策略处理；runner 不调用内部推进函数 |
| 计划结算 | 已有 candidate / committed 会议，`meetingDay < day`；非夜战、非终局 | 未到期不执行；效果失败回滚后写一次 fallback；已有结算事实只恢复终态 |
| CP 刷新 | 新日历日，或旧档尚无当日授予记录 | 同日只校准 cap 并向下 clamp，不补回已花点数、不累计余额 |
| 营地区域交互 | 已定义的 zone 与坐标、距离不超过共享的 1.25 范围、非夜战、非终局 | 越界/坏区域拒绝；晚餐缺粮、训练无活动守卫拒绝，不能留下成功区域回执 |
| 报告关闭 | 当前 `nightBattle.resolved === true` 且存在非空 `instanceId` | wrapper 返回 `report-not-ready`，不执行纯 reducer，不写成功 `threat.closed` |

区域菜单的显示范围与目标选择范围共享 `CONTEXT_INTERACTION_RADIUS`。其他动作 reducer 的材料、体力、人口和岗位条件仍各自有效；共享距离不能代替这些 Gate。

## 状态、成本与结果

- **日历：** 只有跨过 24:00 才增加 day。`lastRationDay` 和 `lastDailyUpkeepDay` 保证同日不重复配给或每日产出；同日关闭报告、刷新和重复晨间入口不能再次结算。
- **计划会：** effects 会 normalize 或回滚 `contentState`。成功和失败后均重新取得权威 meeting，再写 `status=resolved`、`resolvedDay`、`autonomyResult` 和 history；不能只出现账本成功而保存仍为 candidate。`plan:<meetingDay>:<candidateId>` 效果收据与既有 resolved/fallback 账本用于旧状态恢复，不重发奖励。
- **指挥点：** `commandPointsGrantedDay === day` 时，`after=min(before, cap)`；跨日才按 cap 授予。当日上限下降会扣减可用点数，上限回升不补发差额。该修复不修改既有信任阶梯或扩展角色能力。
- **兵营：** 一次现有训练推进 30 分钟，不消耗食物；提高玩家 SAN 和营地士气，并提高活动守卫的 SAN、个人士气和关系、降低其压力。重复训练可使这些值接近上限，必须记录这项副作用。
- **晚餐：** 消耗 1 食物、推进 30 分钟，按现有规则缓解全员饥饿/压力并提高 SAN；食物来自库存，不能由 runner 补入。
- **区域回执：** `camp.area.interacted` 保存 zone、坐标、before/after 的时间与 food/morale/hp/energy，以及实际分钟差。零分钟查看操作可以诚实记账，不能当作日历推进。
- **报告回执：** 新 `continueMorning` wrapper 在纯 reducer 执行前保存 `threatId` 并检查 resolved/ID；成功 payload 为 `{ threatId, day, hour, minute }`。原 `continueMorningReducer` 的恢复、岗位清理和日历行为不变。

## 公开三日路线与资源来源

`scripts/server-three-days.py` 从普通新局开始，使用公开 reset/start、WASD、附近操作和战斗按钮，不写 localStorage 存档、不注入 state、不调用内部函数。它将路线命名为 `public-action-calendar-progression`，以 day4 清晨及三个真实日界作为目标。

本路线使用初始 8 食物、补给箱 A 的 3 食物、地图上两次采莓约 4 食物和原有菜畦的 3 食物收获；每天一次晚餐和每日配给消耗真实库存。十人日需 3，三次日界与三顿晚餐的理论余额约为 6。实际余额还必须计算 `npc.need.fulfilled` 的取食、计划效果和其他真实动作；理论预算不是验收结果。

先种原有菜畦，观察 day2 生长与 day3 可收获，再使用公开收获入口。兵营训练推进剩余时间；每个日历日主动启动一次遭遇，真实结算并关闭报告。该路线提供主游戏状态、输入、存档和多日因果证据，**不是自然等待试玩，也不是难度或节奏平衡评测**。

训练、晚餐和请求支援改变的个人关系不能替代 `campTrust`。本路线少量采集不保证达到水车所需的 trust25，且还需要发现水车；未启动水车是符合 Gate 的结果，不得为了三日通过降低门槛或注入信任。

## 六视角合理性账本

| 视角 | 本轮规则与可观察结果 | 证明范围 |
| --- | --- | --- |
| 势力 | 没有外部势力送粮、造人或盟军奖励；campTrust 与 NPC 个人关系分开 | 不证明外交、势力收益或水车自然触发 |
| 营地 | 配给、计划、CP、田地按日界结算；资源来源和实际差值可核对 | 证明本路线的日历账本，不证明长期经济平衡 |
| NPC | 使用固定 roster；缺岗训练和缺粮晚餐有拒绝；记录 HP、lifeState、SAN、饥饿和岗位 | 死亡不得复活或补人；完整十人技能与晋升投票需另验收 |
| 玩家 | 可见附近按钮与执行范围一致；选择成本真实；报告关闭保持原钟面；reload 不补 CP | 非零已花 CP 的防回补由源码回归覆盖，不冒充低信任跑局中的实际消耗 |
| 敌人 | 三场公开遭遇真实 start/resolve/close，白天区域动作在夜战拒绝 | 不证明自动夜夜尸潮；训练强化的 SAN/士气必须披露 |
| 全局事件链 | 每场报告与指定 threatId 因果相连；计划状态、历史、收据和保存一致 | 不把三次同日遭遇、夹具日期或单个 resolved 事件当成三日完成 |

## 保存、回放与恢复

沿用 SAVE21 / CONTENT3，不新增必填保存字段。观察已有 day/hour/minute、world 每日 marker、planMeeting、CP/GrantedDay、meters、库存、田地、固定 NPC ID 和 worldMeta 账本/命令轨迹。

- 成功区域命令进入 CommandBus、记录 `camp.area.interact` 和嵌套 `world.advance`，申请正常 checkpoint；同 commandId 不重复训练、扣粮或保存成功回执。
- 新报告 close 事件必须携带对应 threatId；保存中的 nightBattle 清空不等于自动证明某场报告已关闭。
- 旧 `threat.closed` payload 为空时，仅在该事件的 commandId 能对应 replay 中 `type=threat.close`、且 command payload 的 threatId 与当前已解析遭遇一致时兼容恢复。还须有同一遭遇的 start/resolved 事实和正确事件顺序；缺少对应 replay ID 时保留失败，不猜测场次。
- runner 使用隔离持久 profile，读取主存档并独立校验 checksum；等待 650 ms 去抖后的保存事实赶上 UI。相同日期/分钟不能单独证明某次零分钟事件已保存，应核对 seq、特定回执与对应 replay 命令。
- 阶段 checkpoint 与原始存档快照只作为证据，不注回游戏。旧报告或动作已经保存在真实 profile 中时先因果核对，再继续，避免重复补给、晚餐或跨日。
- 未结束遭遇不能保存；中断后从最近安全存档继续，未提交的遭遇不能算完成。遗失必要日界前后证据时停止该次验收，不重造账本。
- 心跳间隔 15 秒，父端轮询已确认活进程每 30 秒；观察超时不代表进程终止，不因此重开新局。最终记录保存投影 hash、源码轨迹 hash和浏览器证据各自的范围。

## 验收范围与当前状态

| 验收 | 当前状态与覆盖 |
| --- | --- |
| `node scripts/check-plan-day.mjs` | 已执行 27 项真实源码检查，trace `66c9368d`；覆盖权威计划成功/失败/旧事实恢复、同日与跨日 CP、配给/upkeep、真实 report-close wrapper 和 CommandBus |
| `node scripts/check-camp-area.mjs` | 已执行 16 项真实源码检查；覆盖共享距离、注册区域、夜间/终局、重复命令、训练/晚餐真实成本和拒绝 |
| 新 report-close wrapper | 已接线并完成源码回归：resolved/ID Gate、成功 threatId/钟面回执、replay 关联和重复/失败无 checkpoint。恢复旧 wrapper 的内存负控准确捉到空 payload；实际浏览器回归仍待最终结果 |
| `scripts/server-three-days.py` | 最终浏览器验收 pending；目标为 day2/3/4 日界、三场不同日历日遭遇、计划权威终态、CP、实际物资、田地和刷新恢复 |
| `scripts/smoke-three-days.mjs --strict-browser` | 使用同一公开路线；缺 Python Playwright 必须失败。静态 fallback 只能证明结构，不能宣称三日完成 |

仍运行内容校验、night guard、inline syntax、content-chain 源码回归和 replay self-test；其中保存投影与源码局部执行不等于完整无 UI 游戏模拟。浏览器最终报告需要标明源构建、阶段快照、恢复次数、训练副作用、失败记录与尚未覆盖项目后，才可回填通过状态。

保留失败证据：

1. [attempt1 原始报告](../qa/three-days-attempt1-20261014.json)：补给箱零分钟选择后，同一分钟的旧存档被误当作当前保存，产生 food+3 误判。后续以事件 seq、handled 状态、特定 event/replay 因果和已验证前库存检查，不删除原失败。
2. [attempt2 原始报告](../qa/three-days-attempt2-20261014.json)：旧成功 `threat.closed` payload 缺少 ID，新 runner 等待指定 threatId 时失败。新 wrapper 补充具体回执；旧档兼容必须通过相同 commandId 的 replay threatId 校验，不将该失败直接改成通过。

## 不做项、后续与回滚

本轮不改变日历速度、不把报告关闭改成 day++，不增加自动夜夜潮、水车生产/代修/工时、势力奖励、完整十人技能或最终尸潮。自然约 86.4 分钟的三日等待、正常行动策略与平衡试玩仍需独立证据。

下一步将计划评分的“短缺”与运行时“断粮”名称差异、晋升英雄状态与计划投票字段差异列入问题记录。本卡只披露这些既有接线缺口，不声称本轮已经修复。

本轮前的可恢复源基线为 PR #4 提交 `446e6071791ce14f96477da3313cf440203886d4` / HTML `698b2149...`；恢复时连同兼容代码、保存与测试证据保留，不单独下调 SAVE_VERSION。Sites 生产与 GitHub 分支仍按独立源线对账，本卡不代表外部部署完成。
