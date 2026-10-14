# 已结算报告的启动恢复与失守重开

**ID：** `resolved-report-recovery-001`  
**状态：** 设计提案 / 初始独立 boot-save 已复现失败，运行时修复未接线  
**主题：** 已经结束的遭遇在刷新后仍能查看并关闭；失守后的“重新开始”实际进入新局  
**规则范围：** 复用 SAVE21 / CONTENT3；不修改 L0、Skill、战斗数值、日历或最终尸潮设计  
**审查基线：** 2026-10-14，`dist/index.html` SHA256 `8a4abf285651e5ee78905da2b819648aa1ef862e580e8b4710e8c71079604ba0`  
**关联问题：** [PROB-20261014-resolved-report-boot](../problems/PROB-20261014-resolved-report-boot.md)
**真实证据：** [独立 report-recovery baseline QA](../qa/server-report-recovery-20261014.md)

本卡提出下一主题的契约与完整出口。2026-10-14 已在冻结的上述构建上执行独立初始 boot-save baseline：DAY 对照通过，B1/B2/B8/B9 的报告或失守恢复失败，B15 的公开重开入口被阻断；这不是修复通过结果。原始保存、截图和失败报告已独立归档，现有三日日历运行不能代替这些场景。资源清理竞态仍是源码风险，尚未经过公开重开操作验证。不得在同一次多日运行中换 HTML。

## 玩家承诺与最小节拍

玩家已经守住一轮，刷新应继续看到这轮真实损失、击杀和原有计划，关闭后从原来的时间继续。营地失守时，“重新开始”应清除这一局并显示新局入口。阅读历史报告不再造成战斗、治疗、配给、CP 或计划收益。

```text
校验完整保存与账本 → 分类恢复状态
  已结算 / 可确认实例 / 尚未关闭 → 展示既有报告 → 公开关闭 → 保存关闭事实 → 当天世界继续
  已结算 / 同实例已关闭          → 只清残留瞬态 → 当天世界继续
  已结算 / 无法确认旧实例        → 明示旧报告降级 → 保存迁移事实 → 当天世界继续
  已确认失守                    → 失守报告 → 公开重开 → 停会话 / 清档 → 新文档的新局入口
  未结算或损坏 / 无可靠恢复状态  → 无时钟的恢复界面 → 明确恢复安全存档或重开
```

完整 resolved 报告没有新的自治选择：战斗结果和已生成计划属于已有事实，刷新不能代替营地重新决策。阅读、关闭、重开分别是不同意图，不能用关闭报告来表示新局重置。

## 当前源码映射与疑点

以下位置对应上述 SHA，后续修改以函数名定位。

| 入口与位置 | 已读到的行为 | 本主题建议 |
| --- | --- | --- |
| `saveProgress`，2937；`loadProgress`，2972 | 保存含 `hp/night/nightBattle/worldMeta`，不含 `gameOver`；loader 也没有恢复该字段 | 给当前 `null / lose` 终局状态明确保存和旧档默认契约；不能仅修夜间标志 |
| `loadProgress`，2997 | resolved battle 被读入后把 `state.night=false`，尚未关联恢复后的 worldMeta | 在完整候选保存与账本上先分类，再设置日间、报告或恢复状态；不要混用新局的初始账本 |
| `startFromSave`，6314 | 只有 `state.night && nightBattle` 才进入报告分支；resolved 分支只开 summary-mode，没有回填 summary 数字、标题、文案与 CTA | 从同一分类结果恢复 UI；抽纯 `renderResolvedReport`，不调用结算函数 |
| `resolveNight`，6086；展示及结算记录，6143–6165 | 同时扣损伤、处理 NPC、填总结、生成计划、写 resolved 和 checkpoint | 保留结算入口的唯一职责；只抽出展示部分供恢复调用，不重放前半段 |
| `continueMorningReducer`，6217；wrapper，6283 | wrapper 已检查 resolved + instanceId 并返回具体 close payload；普通 actionCommand 的 gameOver Gate 在 reducer 之前执行 | 保持该 Gate。loss 的重开不能依赖 reducer 内当前不可达的 reset 分支 |
| `continueBtn` 绑定，6688；loss 文案，6157 | “重新开始”仍绑定 `continueMorning` | 绑定薄路由：正常报告关闭，失守报告转专用会话重开意图 |
| `clearAllSaves`，6292；reset 绑定，6692 | 只停世界 timer，再删主档/备份/旧档；gameStarted 仍 true，checkpoint/battle 等仍可能存在 | 重开前先 fence 会话和取消资源，再清档并 reload |
| `requestCheckpoint`，2936；`pagehide`，6795 | 页面离开即时 checkpoint；resolved 档允许保存 | 验证清档之后没有旧会话写回主档或备份 |
| `serializeNpc`，2868；`normalizeNpc`，2877 | 战斗临时 HP/状态不能完整持久化；normalizer 会把 combatHp 回到 hp、combatStatus 回到 ready/dead | battle 有 ID 和 enemies 数组不等于未结算战斗可以忠实恢复 |
| `nightNearbyEnemies`，5645；`renderNightWorld`，5833；`renderBattleLane`，5901 | 直接消费 battle 数组及数值字段 | 缺字段旧档须先经过分类/安全投影，不能把最小投影夹具直接送进渲染或战斗 timer |

现有 `night-resolved.json` / `night-unresolved.json` 是历史保存投影样本：只有 `nightBattle.id`，没有 `instanceId`；NPC 数为 0，world 为空，没有相应 started/resolved 账本，而且 savedAt 比其 payload 日历多 1440 分钟。它们继续证明原投影测试范围，不能作为本主题的完整 boot 正例。

## 最小状态与迁移契约

推荐使用一个从保存事实派生的恢复分类器，不新增第二套持久 phase。复用 `nightBattle.resolved/instanceId`、`night`、原 HP、worldMeta、计划快照和日间维护标记。候选保存须先完成校验、归一化与账本关联，再提交为权威 state；损坏 battle 不得在半加载状态中启动渲染或时钟。

| 分类 | 明确前置 | 启动状态及允许动作 | 持久结果 |
| --- | --- | --- | --- |
| `REPORT_PENDING` | resolved 严格为 true，实例可确认，尚无该实例 close；非失守 | `night=true` 继续隔离白天输入；世界/battle timer 均停；展示原报告，仅允许阅读和关闭 | boot 不新增 resolved/close，不加 SAN、奖励或计划；用户第一次 close 才写既有正常关闭效果及 receipt |
| `REPORT_ALREADY_CLOSED` | 残留 resolved battle 与同实例已关闭证据精确关联 | 不重开报告；只清 battle、战斗目标等确属残留的瞬态，再继续日间 | 保留原 close；无第二次 SAN/配给/岗位重置，不改后续日间命令事实 |
| `LEGACY_RESOLVED` | resolved 为 true，但实例不能确认或旧展示字段缺失 | 可确认旧 ID 的先迁移；无法确认的明示历史报告已降级，避免不可操作 modal | 不造 encounter ID / threat.closed；仅写可审计迁移，保留已经保存的资源、伤亡、计划与日历 |
| `LOSS_REPORT` | 当前可识别 `gameOver=lose`；旧档至少有已结算报告且 `hp<=0` 可推出本轮失守 | 显示失守及重开 CTA；世界/battle timer 均停；普通命令继续受 gameOver/night Gate | 不自动关闭、不恢复营地 HP；只有公开重开进入新的游戏会话 |
| `RECOVERY_REQUIRED` | 未结算、损坏或矛盾，无法证明可忠实继续 | 不启动任何 simulation timer；主世界操作不可用；显示明确恢复/重开入口 | 保留原档供诊断；不生成胜利、关闭回执、人口或资源 |
| `DAY` | 无待处理 battle/终局状态 | 按既有普通启动流程继续；timer 最多一个 | 本主题不改变正常存档语义 |

分类优先级需固定：已确认 loss 优先于成功报告；完整账本上的同实例 close 优先于残留 battle；其余再区分 resolved 与未结算。`night=false` + 完整 resolved + 无 close 是矛盾但可修复的保存，应恢复待关闭报告，不能凭该布尔值宣称玩家已经关闭。

推荐在 SAVE21 中添加可缺省的白名单 `gameOver: null | 'lose'`，不改变 CONTENT3。旧 loss 报告从已保存的 HP/已结算事实恢复 loss。孤立 `hp=0`、未知终局字符串或与报告矛盾的组合进入恢复界面，不借此悄悄扩大白天 HP 或未来结局的规则。若团队要求 SAVE_VERSION 升级，必须另记录兼容决定；本卡不实际改变版本或黄金 hash。

关闭身份只能来自明确保存的 `instanceId` 或可验证的旧因果关联：

- 具体 `threat.closed.payload.threatId` 必须与该实例相同，并关联同一个 `threat.close` replay command。
- 旧空 close payload 仅在该事件的 commandId 精确关联 `threat.close.payload.threatId` 时认可。
- 旧 `battle.id` 只有在唯一、相应 started/resolved 账本能确认同一实例时才迁移到 instanceId。不能凭同日、同分钟、enemy 数或当前时间猜 ID。
- 账本截断使关系不能确认时，应承认缺证据并走旧档降级或恢复界面，不伪造历史 success。

旧档迁移只修恢复身份、瞬态和告知信息，不调用 `resolveNight`、`generatePlanMeeting`、`executePlanMeeting`、每日 upkeep 或 SAN 奖励。迁移写 `save.migrated`，记录固定迁移版本、原因、原 checksum、原日期、可确认的旧实例及来源类别；没有确认实例时使用 null。来源记录不含文件路径或凭据。

需要写入迁移时，在公开开始会话后持久保存一次，且保存失败应明确报告，不宣称迁移已完成。第一次成功保存须已清除触发该迁移的残留状态；第二次 reload 不再生成第二条迁移。重复加载未成功写入的原始坏档，不累计奖励或推进日期。

未结算旧档的 v1 推荐政策是**不承诺忠实 battle resume**：现 writer 通常拒写进行中的夜战，NPC 临时战斗状态也不齐全。优先提供一个经过 checksum、日期、结构验证的原真实安全 checkpoint；界面显示其日期，用户明确选择才回退，记录实际 rollback。没有安全存档则停在恢复/重开界面。不能自动把未结算状态改成成功白天，也不能调用 encounter start 重打一遍。是否扩展为完整进行中战斗持久化属于后续主题。

## 展示、关闭与会话生命周期

`renderResolvedReport` 只读取已保存的报告/当前持久后果，回填总结数字、标题、文案、CTA、summary-mode 与攻击禁用态。缺失历史数值显示“未记录”，不能显示默认 0 后称为真实无损失。该函数不写世界状态、消耗 RNG、处理伤亡/治疗、生成敌人或计划，也不启动 timer。

普通关闭继续走统一 `threat.close` 命令：严格 Gate 检查未关闭的 resolved 实例及非 loss；返回 `{threatId, day, hour, minute}`。保留现有第一次关闭的 SAN +3 等已定义效果，不在 boot、already-closed 或迁移路径再发。same commandId 重复不结算；另一个 ID 的第二次点击应无成功 event/checkpoint。保持当前日期及配给/upkeep 幂等，不把报告关闭视为 day+1。

重开使用独立 `session.restart` 意图，不为此放开普通终局 actionCommand。按钮只路由，不在 UI 回调分散跨系统修改。专用会话生命周期顺序建议为：

1. 关闭重复输入，标记本会话正在退出，并先设 `gameStarted=false`，使 pagehide/visibility checkpoint 拒绝旧会话写入。
2. 取消 checkpointTimer、battleTimer、worldTimer、held movement、interaction repeat；清理对应待执行 RAF/输入和捕获。使用命名的会话控制器，退出 latch 是瞬态生命周期控制，不是隐藏游戏事实。
3. 清主保存、备份、corrupt/legacy 保存，保留与现公开 reset 一致的设置策略，再 reload。
4. 新文档显示真实新局入口；玩家开始后才允许新会话产生自己的初始保存。重复重开点击不能重新启动旧世界。

reset 不生成 `threat.closed` 或获胜回执。若命令总线记录 restart accepted，只在退出前会话记录，禁止 checkpoint 写回已清旧档；该记录不会冒充一个应在新局保存中存在的历史事件。浏览器验收使用公开 CTA、所有旧 key 消失和新局基线作为重开证据，不捏造跨清档的持久回放链。

报告关闭后设置新的 worldLastTickAt 并至多启动一个世界 timer；报告待关闭和 loss 阶段不得由 visibility catch-up 推进 SAN、NPC 需求、敌人、日历或中继。未结算战斗不能关闭；完整报告中的移动/攻击也不能实际改变位置或敌人。普通 UI 阅读可用，但 CP、建造、采集、事件选择继续受既有 Gate。

## 六视角合理性账本

| 视角 | 必须保留的因果 | 验收禁止项 |
| --- | --- | --- |
| 玩家 | 刷新回到同一已结算结果；关闭继续当前时间；失守重开明确开始新局 | 无报告直接继续、空数值伪装无伤、按钮文案与实际意图不同、重开又恢复失守档 |
| NPC | 原 roster/死亡/伤势/岗位/羁绊/已保存 needs 不因展示重置 | 再治疗、死者复活、补新人、幽灵支援、读取报告重跑当天工作 |
| 营地 | 保存的核心 HP、库存、种植进度、当日 ration/upkeep/已花 CP 连续 | boot 重收配给/产木/加 CP、报告关闭拨时钟、归零饥荒被重载补偿 |
| 势力 | 既有关系/据点 guard/upkeep 及 pending 支线保留 | 旧报告迁移发外交奖励、伪造守军或把重新开始当本轮营地获胜 |
| 敌人 | resolved 结果不再模拟；无法恢复的未结算旧档明示恢复问题 | 重新生敌人、重复击杀/战利品、跳过未完成战斗却生成成功历史 |
| 全局链 | 同实例 resolved/计划候选/close/迁移来源各自清楚；重开是新会话 | 刷新重新生成计划、复制 close、用猜测 ID 连接事件、跨构建拼接后宣称同一源码三日通过 |

## 真实 boot-save 夹具矩阵（初始复现已执行，完整出口未达）

完整正例应从冻结构建的真实公开操作保存提取：包含十人 roster、世界日期与维护标记、真实 battle、具体 started/resolved 记录、计划候选和 FNV envelope。派生的缺字段/矛盾/损坏负例注明“由真实保存离线变更”，同步重算 payload/top/savedAt/checksum，不能称为自然游玩结果。

| ID | 输入与来源 | 必须检查的外部结果 |
| --- | --- | --- |
| B1 | 真实 resolved + instanceId + night=true，尚未 close | 点击继续后完整总结/title/CTA，两个 timer 不结算；日期、HP、库存、NPC/计划/CP 不变；第一次公开 close 有具体新回执 |
| B2 | B1 派生 night=false、仍无 close | 恢复同一待关闭报告而非直接白天；一次 close；两次 reload 后仍日间且不再结算 |
| B3 | 真实 close 后档，附回该实例残留 battle | 原具体 close 被识别；只清瞬态，无新 SAN/close/粮食/岗位效果，后续日间决定不被抹除 |
| B4 | B3 派生旧空 close payload，保留准确 replay link | 认可同实例已关闭；错误 commandId/threatId 的负例不得被当成已关闭 |
| B5 | legacy resolved 缺 instanceId，有唯一真实旧因果可关联 | 恢复同一旧 ID、迁移一次、显示历史报告；不能产生新遭遇或重复 resolved |
| B6 | legacy resolved 缺 ID/缺 feed 或其它数组，无法关联 | 不崩溃、不猜 ID；明确降级与迁移；不制造 threat.closed/奖励；第二次 reload 无第二迁移 |
| B7 | resolved 身份完整但历史展示字段缺少 | 纯报告投影显示未记录；不调用 active battle 数组逻辑或结算器填补数字 |
| B8 | 新 loss 字段 + resolved/HP0 完整报告 | 失守 CTA 公开可重开；普通 close/建造/采集/计划命令仍拒绝；无胜利 close |
| B9 | 旧 loss 未保存 gameOver，但 resolved/HP0 | 正确 loss/default 契约；同 B8；不是 loader 读到默认 null 后自动恢复营地 |
| B10 | unknown gameOver、孤立 HP0 或矛盾结果 | 安全恢复/reset 提示；不暗改结局规则、不出现可推进但无营地的普通世界 |
| B11 | 未结算旧 battle，即使含 ID/enemies；另有原安全 backup | 不宣称忠实恢复夜战；无两个 simulation timer；公开确认选用 backup 后真实恢复其日期，并留 rollback 证据 |
| B12 | 未结算/畸形 battle，无可用 backup | 有可操作恢复/reset 入口；无白天成功、重打、普通关闭、空数组崩溃或无限 timer |
| B13 | 主档坏 checksum / JSON，有完整 resolved backup | loader 选实际有效 backup，恢复其特定报告；不能混合主档资源与备份账本；无损坏档假成功 |
| B14 | 非零 CP 已花点、当日 ration/upkeep 完成、受伤/死亡 NPC 与据点 | boot/阅读不回补 CP，不重收粮/维护/治疗；原固定人口与岗位事实保留 |
| B15 | 已排队 checkpoint 的报告/失守会话，公开 reset + pagehide | 旧 key 被清后不会重写；超过650ms与两个 tick间隔仍无旧档；新局及其保存没有旧 threat ID |
| B16 | 连续点击开始、close、reset；隐藏/恢复页面；跨午夜报告 | at most one 正确 timer；report clock静止，未结算/终局 Gate 仍生效；close duplicate无重结算 |

每例用独立隔离 context，需持久夹具时才使用独立 fixture profile，冻结源 SHA；在 document loader **之前**注入主 SAVE_KEY 的完整 envelope，再进入普通公开 URL、点击继续。不得在运行中改 localStorage、调用隐藏游戏函数或借用当前多日 profile。保存 fixture 输入、第一次 boot、公开操作后保存、两次 reload 的真实 envelope 与 UI 截图；损坏/清档路径说明为何没有合法 envelope，不通过制造空白保存补证。

2026-10-14 初始脚本只实现正常 DAY 及 B1/B2/B8/B9/B15 的一部分检查，每例使用新的非持久浏览器 context。第二轮终止结果为 `134 checks / 79 passed / 55 failed`、exit 1；`expectedDefect:true` 仅为复现标签，未被计作成功。脚本案例名 `B1-contradictory-night-false` 对应本卡 **B2**。

| 矩阵范围 | 第二轮实际证据 | 仍未完成 |
| --- | --- | --- |
| DAY 对照 | 17/17；输入为 day1 06:10，公开时钟正常推进，重载写回 FNV/日期有效 | 不代表其它旧档或复杂日间状态已覆盖 |
| B1 / B2 | 各 11/19；同一具体 resolved 实例、击杀3，启动后无报告、默认隐藏数字为0，等待和写回推进到06:24，NPC needs 变化 | 公开 close 被阻断，关闭回执/后续日间出口未执行 |
| B8 / B9 | 各 10/23；显式离线 loss 变体，HP0、finalDamage100；无失守报告，普通吃饭控件未禁用，真实写回缺 gameOver | 不是自然战败；未点击供给动作，尚未完整验证所有终局命令 Gate |
| B15 | 10/23；公开重开缺失，`publicResetExecuted=false`，未用隐藏按钮替代 | 清旧 key、新局出口、pagehide 清档竞态及排队 checkpoint 分支均未执行 |
| B3–B7 / B10–B14 / B16 | 未实现、未运行 | 完整矩阵仍待补，不能据本次报告计为通过 |

本次待报告阶段的 seeded 主档在首个真实生命周期写回前仍可能等于输入；时钟推进先由 DOM 证明，NPC needs 变化与 loss 字段丢失由之后实际写回的 envelope 证明。`pagehide` 与 `visibility-hidden` 都是当前源码的即时保存 handler，重载实际最终原因是后者。第一轮把原因限定为前者的工具误断言已修正，旧失败报告保留；第二轮不再含该误断言。

报告等候期间可经过至少两个 battle/world tick 间隔验证无资源推进；关闭后不要以跨帧日期严格相等误判正常世界自然走时，核对具体 close event 的 tick/payload 与原报告时间。重开以公开操作和新局基线证明；不要求初始 eventSeq=0，因为现初始化可能记录合法系统事件。

## 下一轮最小实施顺序与出口

1. 初始 B1/B2/B8/B9 复现已确认报告恢复失败，B15 重开入口阻断；先依据专用 QA 修复此入口，补齐原矩阵未执行部分，不把预期缺陷、阻断或未跑行写为通过。
2. 加纯保存分类/归一化，明确 gameOver 可选字段与旧档默认；在 worldMeta 归一化后做精确身份关联。
3. 抽纯 resolved 展示，接启动/报告主 CTA 路由与安全 session reset；保持正常 close/日历/CP/计划效果入口不变。
4. 执行真实 HTML 函数的 loader/save/start/CommandBus/关闭/退出资源测试；计时器与 DOM 可 instrument，但必须注明不能代替真实 boot。增加 B1–B16 浏览器覆盖，不能只增加保存投影。
5. 回归现有 27 项 plan/day/close、16 项 camp-area、43 项内容链、night guard、语法与相关保存校验；原 `66c9368d` / `c5d6c772` 不因报告修复随意重定。
6. 完成以上出口后再决定新构建是否发布；新的三日 smoke 从冻结新构建的独立流程开始，历史失败与 source 覆盖保持原样。

本卡尚需裁定：`gameOver` 可选 SAVE21 字段是否采用；未结算旧档采用显式安全 backup/恢复界面的 v1 策略。初始独立 browser boot 已执行并失败；本次证据复核和文档更新没有修改运行时、服务器、profile、L0 或 Skill，也没有重跑浏览器。
