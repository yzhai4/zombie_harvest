# 三日日历公开行动：恢复完成的独立工件审计

**状态：** 原逻辑 run 已真实完成；attempt9 terminal exit0，独立工件 Gate 通过。  
**范围：** 原持久 profile 的恢复完成、完整保存/因果账本与最终刷新；不是一次从新局开始的单构建连续通过，也不是平衡试玩。  
**执行模式：** `python-playwright-public-action-calendar-progression`，公开按钮/移动/采集/遭遇；无保存注入、隐藏状态修改或内部游戏函数调用。  
**本审计：** 只读原报告与原工件，没有重跑游戏、修改 profile、HTML 或 runner。

## 完成结果与独立复核

| 项目 | 实查结果 |
| --- | --- |
| 原 runner | `ok=true`，439/439 当前检查，errors 为空，complete stage，无未处理 pending action |
| 原工件 Gate | `ok=true`，90/90 artifact checks；2/2 人为负控单列，不算游戏回放 |
| 再次只读 Gate | 冻结 verifier 在相同原报告/原保存目录上重算，与已保存 Gate 全部字段完全一致 |
| 额外独立审计 | 12/12 工件断言：原保存 FNV/日期/元数据、固定人口、重叠账本、训练一一对应、恢复完整时钟窗口及最终刷新；这些不是额外浏览器用例 |
| 原保存 | 76 份 envelope；全部实际重算 FNV，savedAt/world.totalMinutes/日期/eventSeq 与元数据一致 |
| 观察到账本 | 原保存聚合为 evt-000001 至 evt-002746，2746 个不同事件，无 seq 缺口，无重叠事件或 replay command 内容冲突 |
| 训练 | 报告 92、实际不同 barracks/+30 收据 92、声明 trainingActions 92，eventId 集合一一对应；每条均关联实际 camp.area.interact command 和唯一因果 +30 world.advance |
| 最终保存 | 第4天06:36，savedAt=4716，eventSeq=2746，commandSeq=2454，checksum=`a0c68982` |
| 生存 | 所有保存均保留最初十个不同 NPC ID；最终10人存活，营地HP100，食物6，campCollapse0 |
| 最终刷新 | 保存4715/seq2745→4716/seq2746，仅新增 evt-002746 的正常1分钟时钟；CP保持0/0及 grantedDay=4，粮食仍6，未重放计划/配给/upkeep |

最后一次恢复进程的 `elapsedSeconds=113.997` 只代表 attempt9 的末段时间，不代表前面各次运行的总耗时。原失败事实继续保留在8个 resumeSessions 及此前归档报告中，不能因最终 errors 为空改称前面均一次成功。

## 超时前训练的精确恢复

原第56份 `calendar-day-4-reload` 保存为 day4 00:25，即4345分钟、seq2539、checksum `9787e965`。4355/seq2549 的 runner checkpoint 只是观察水印；本次没有用它重造完整 GameState。

第57份原主档为4415分钟、seq2591。它完整保留第56份之后的52个事件（seq2540–2591），因果轨迹为：

```text
原完整保存4345
  → 11个关联world.advance的自然分钟
  → 动作真实前态4356
  → cmd-002319 camp.area.interact（barracks, x9/y12）
  → cmd-002320 world.advance +30 / causationId=cmd-002319
  → evt-002561 time.advanced at4386
  → evt-002562 camp.area.interacted / cmd-002319 at4386
  → 29个关联world.advance的自然分钟
  → 原主档4415
```

窗口还有10个真实 NPC 工作完成事件，关联嵌套的 cmd-002320；没有省略这些事件来凑分钟。训练 receipt 的 before.time=4356、after.time=4386、minutes=30，粮食6不变。

第58份 `training-resumed-evt-002562` 与第57份完整原存档逐字节相同。冻结 runner 的恢复分支只消费该已存在收据并补登记，没有再执行训练点击；report 中 evt-002562/cmd-002319 只有一条训练动作，标记 `recoveredFromPrimarySave=true`。随后才开始后续7次新训练。因此92的总数包含这次旧动作一次，不额外算作第93次。

## 日历、遭遇、收获与计划

三个实际日界分别到第2/3/4天，不把关闭遭遇报告当跨日。每个日界核对权威 planMeeting、历史、效果 receipt、daily ration/upkeep 与 CP 授予日期：

| 到达日 | 原计划实例 | 实际结算receipt | 口粮变化 |
| --- | --- | --- | --- |
| 第2天 | `camp-plan-meeting-001:d1` | `evt-000724` | 14→11，配给3 |
| 第3天 | `camp-plan-meeting-001:d2` | `evt-001609` | 10→7，配给3 |
| 第4天 | `camp-plan-meeting-001:d3` | `evt-002502` | 9→6，配给3 |

三次均为 `plan-defend-core-001`，实际计划粮食差为0；各窗口没有未解释的 NPC 吃粮。本路线 CP 为0/0，不能代替非零已花 CP 的防回补夹具。

三场真实遭遇分别为 `threat-1-9-0-125`、`threat-2-1-32-812`、`threat-3-0-34-1657`，均核对唯一 started/resolved/close 与特定 replay command。第一场旧 close payload 为空，仅通过精确 commandId→threat.close/threatId join 兼容；后两场有具体 close payload。

第3天真实收获 `evt-001699` 核对同一 garden 的 ready/planted/growth 前后、crop.change 命令、因果20分钟和口粮+3。汇总另观察到2次公开白天攻击、3次正增量采集、2次作物改变（种植与收获），不把时间显示改变单独算采集。

## 原截图检查

已实际查看 `74-final-day-four-reload.png`：地图可见，第4天06:36，营地HP100、行动力100，公开操作可见，显示“已继续存档”。已查看 `75-complete.png`：同一地图随后自然到06:37，并显示附近士官长交互；这是保存之后的正常1分钟 DOM 推进。最终合法 envelope 仍为06:36，不能把截图06:37改写成存档日期或误判为刷新重复结算。

此截图检查证明当前入口和最终世界展示。它不证明移动端布局、全部美术/动态 UI 或后续报告恢复功能已经验收。

## 工件指纹

| 工件 | SHA256 |
| --- | --- |
| 原 attempt9 report | `62ad36b2c7add9d2e36148655cd1755de25c42563e7861e66dce887bcc2ab564` |
| 原 attempt9 artifact Gate | `1b85998b34622044138ca9cc4590fdd90f8975c26460204bda061ce1abec9419` |
| verifier 源码 | `b4b94517cc7dd2b088d863f79b0970795581e922fb5f278e5b41d1e45d55f81c` |
| 本次 server-three-days runner | `becef233cf47a89e657ea9673409d5739188f3ae2de3beeca7cb47415e220a7e` |
| 当前测试服务器 HTML | `8a4abf285651e5ee78905da2b819648aa1ef862e580e8b4710e8c71079604ba0` |
| 76份保存的 index/stage/原字节SHA 清单 | `bccf4650d14f0c33852e4c00b9c949d76e8ecd187988a33fce8c35437a9272a9` |
| 第75份 complete 保存 | `2efb15b895ee6650dc535bfb564c41f9e86596cd9000882e478660a657b1b7fc` |
| 第74份刷新截图 | `a0bab22fcd0dad3d48439c10c7263d5a12287cb7cbbfd0466992c866969a4f4e` |
| 第75份完成截图 | `ca51393a1cd64d32fb71ac5a3d25d493c599970c2df313a1a779d201a532a18d` |

保存清单 hash 是按 report 顺序构建 `{index,stage,sha256}` 数组后 `JSON.stringify` 的 UTF-8 SHA256，不是游戏 replay hash。完整机器分析及原工件保存在私有 QA 缓存，公开记录不包含 profile、凭据或内部路径。

## 保留的限制与必要待办

- 最早10份快照没有已记录的 source hash；Gate `singleKnownBuild=false`。后续已知快照为8a4，不足以反推早期同源码。本次应称“恢复完成的公开行动三日验收”。
- `historicalBoundaryRefreshGaps` 仍含 `calendar-day-2-reload`。第3/4天及最终刷新不能补写为第2天刷新证据。需要新冻结构建的独立新局路线完整执行每个日界刷新。
- 84条早期训练记录没有本轮新增的显式 beforeSnapshotIndex；它们都有不同 eventId，与原保存中的收据/命令/+30 因果一致。只有恢复后的8条使用新完整前态/自然时钟 provenance，不能扩大旧 runner 的记录范围。
- 训练本身改变 SAN/士气，重复使用会使此路线区别于普通游玩；不从营地HP100、SAN或存活率推导自然节奏/平衡结论。
- 原 consoleErrors 保留9条资源404消息，httpErrors列表为空；消息没有URL，本审计未确认具体资源来源。不宣称浏览器日志完全无错，另行定位。
- 报告恢复/失守重开的 B1–B16 仍是下一主题；本次安全DAY最终刷新不证明这些分支。按 [独立架构 ADR](../decisions/ADR-20261014-report-recovery-review.md) 实施候选、冻结后真实验证。
- 本轮没有发布 Sites，未完成整个长期目标。源线对账、候选报告恢复、下一构建新局三日路线及后续内容/UI/迁移工作继续推进。

本轮只新增本专用审计记录，无全局记忆更新。
