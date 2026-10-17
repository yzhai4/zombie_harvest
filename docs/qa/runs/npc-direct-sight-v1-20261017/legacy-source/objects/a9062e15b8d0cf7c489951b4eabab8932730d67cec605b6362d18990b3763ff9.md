# 已结算报告恢复的独立架构评审

**状态：** 架构裁定与实施建议，尚未实现、尚未通过 B1–B16  
**基线：** `dist/index.html` SHA256 `8a4abf285651e5ee78905da2b819648aa1ef862e580e8b4710e8c71079604ba0`  
**契约：** [resolved-report-recovery-001](../scripts/resolved-report-recovery-001.md)  
**约束：** 当前主 profile 的三日运行结束并归档之前，不修改或部署该 HTML。

## 裁定

采用 SAVE21 的可缺省 `gameOver: null | 'lose'`，保持 CONTENT3。字段缺省表示旧 writer 未记录终局，不等于已经证明存档可回到白天。明确存在的其它字符串/类型保留为未知终局问题，禁止归一化为 null。完整旧档的 `resolved === true` 且营地 HP 为 0 可派生失守；孤立 HP0 不能派生一轮已经结算的战斗。

v1 不承诺未结算夜战的忠实恢复。当前 writer 拒绝保存进行中的夜战，NPC serializer 也没有保存完整 combatHp/combatStatus。持有 ID、enemies 或非空数组不构成 resume 能力。此类保存只允许明确恢复一个真实安全 checkpoint 或重开，不能自动开始新遭遇、清敌人、转成胜利白天。

采用 `selectProgressSave → classifySavedRecovery → installSavedPayload`。恢复视图与 `SessionController` 为瞬态派生，不保存第二套 phase。关键持久事实仍为 HP、可识别 gameOver、nightBattle、night、world、worldMeta、内容状态与原始 roster。

## 当前代码必须解决的约束

| 已读事实 | 实施约束 |
| --- | --- |
| `loadProgress` 2972–3026 以 `typeof object` 选择候选，数组也能通过；有 payload 但 envelope 不合格时可能退回按普通对象解释 | envelope 一经识别就只能按 envelope 校验；不能退回旧对象路径。plain-record 检查排除数组/null。旧无 envelope 保存仅由明确版本适配器接受 |
| 同一 loader 边写全局 state 边注册事件/扩图/记录迁移，异常统一吞掉 | 候选校验和 draft 归一化期间不改 state/registry/storage/DOM、不消费 RNG、不调 reducer；失败不留下半份资源或半份账本 |
| loader 后又运行 ensureStableIds、ensureSocialFacts、ensureRelayFacts、ensureContentState、refreshCommandPoints 和 ensureQuestInstances | 这些后置步骤也属于恢复事务。不能只把 loader 包一层而保留它们在半载状态上运行；当前保存应保持已保存的 CP、计划、预警、人口和维护事实 |
| `state.npcs.forEach` 仅覆盖在 saved.npcs 中找到的成员 | 缺成员会保留新局模板居民。完整新保存必须使用其完整 roster，不得从初始十人数组补人；死亡记录与受伤状态仍是同一居民 |
| `renderNightControls` 5654、`renderBattleLane` 5901 消费 enemies/supportIds/feed；lane 渲染还清 enemy.hit/lastDamage | 已结算报告不得调用这些 active-battle 渲染器。它们并非纯展示，更不能用空数组默认值假装历史数字为 0 |
| `saveProgress` 先把任意旧主档写入 .bak，再写新主档 | 从安全备份恢复时不得先用坏主档覆盖唯一安全备份。恢复保存需单独控制备份轮换与主档写入/read-back 验证 |
| `gameStarted=false` 目前只阻止部分输入和 checkpoint；visibility-visible 的 catch-up、joystick pointerup、重复交互没有同一 fence | 退出 latch/generation 必须覆盖所有输入、回调、catch-up、保存与 simulation 启动入口，不能只依赖一个布尔值 |

## 保存选择及结构验证

`selectProgressSave(rawCandidates, policy)` 只接收本轮一次读出的字符串，不直接访问 localStorage。返回每个候选的完整 envelope、原 checksum/原日期、来源类别、完整性诊断和可选择的安全候选；不安装，也不写 corrupt 副本。storage 错误单列，不能等同“无存档”。

当前 envelope 至少验证：普通对象、payload/checksum/version/savedAt、原始 payload FNV、允许版本、有限且合法的日期/库存/HP、`savedAt == world.totalMinutes == calendarMinute`、world/worldMeta/contentState 的结构，以及所有关键集合的实际类型。顶层镜像字段不能取代 payload；若关键镜像与 payload 矛盾，应标记并采用明确政策，不能混用两套值。未来 SAVE/CONTENT 版本不得降级成当前默认。

关键集合包括 npcs、buildings、resources、landmarks、worldZombies、worldMeta.events、seenCommands、replay.commands。元素需为允许结构，NPC ID 唯一且对应已声明 roster，事件 ID/seq 与 command ID 不重复、顺序及水位合法，日期维护标记不可未来化。当前 SAVE21 的空/部分 NPC 数组不是完整正例；不能通过 createNpcState 补全人口。更老版本的 roster 扩展只有具备已记录版本规则才可迁移；当前未确认的缺人/未知 ID 进入恢复界面，不能猜测其死亡或新增居民。

报告自己的 enemies/feed/supportIds 等是可选历史展示资料，和全局关键集合分开：resolved 报告缺这些字段可降级纯展示；未结算 battle 缺任何资料仍不承诺 resume。分类时不能为了避免崩溃修改已保存伤亡、库存、计划或世界时间。

选择顺序是有效主档优先。主档在结构上有效但处于未结算/未知终局时，不自动拿备份替换它。主档 JSON/FNV/关键结构无效时可发现真正安全的 backup，但在公开入口显示来源原因和完整日期，用户选择“恢复该安全存档”后才安装。B13 的“选实际有效 backup”应通过这条明确入口验证。legacy 候选也必须独立完整校验，不能用主档资源配备份账本、用备份 roster 配主档计划。

安全 checkpoint 是能分类为 DAY、可操作 REPORT_PENDING 或 LOSS_REPORT 的真实完整原档；RECOVERY_REQUIRED、未结算或仍无法操作的缺身份旧报告不是安全回退选项。LOSS_REPORT 只能恢复其失守与公开重开能力，不是继续生存的回退。候选可显示多个日期，不按 savedAt 最大值擅自决定回退。

## 纯分类与身份关联

`classifySavedRecovery(validatedPayload, evidence)` 返回 classification、只读 reportView、必要的持久迁移补丁及诊断。它不调用 resolveNight/计划生成、效果、配给、upkeep 或任何全局状态函数。

固定判定顺序：

1. 完整性/关键结构失败：没有可安装 payload，进入 RECOVERY_REQUIRED。
2. `gameOver` 明确存在但不在白名单：RECOVERY_REQUIRED，优先于按 HP 推断 legacy loss，防止吞掉未来结局。
3. 已确认失守：LOSS_REPORT 优先于残留成功报告/close。当前规则下 `lose` 与正 HP 是矛盾，进入恢复；有效 HP0 的明确 loss 或 resolved/HP0 的旧 loss 不会因已有 close 而复活。重复 boot 不重结算，不造第二个 loss 事件。已确认失守但缺历史战斗数字可展示失守与“未记录”，不补一份战斗结果。
4. 同实例精确 close：REPORT_ALREADY_CLOSED，清可证明残留的 battle/night/zombies/target 等瞬态；保留当前日间岗位、库存、位置、计划和后续命令事实。
5. resolved 严格为 true 且可确认未关闭实例：REPORT_PENDING。即使 night=false，也重新隔离为待关闭报告，不能拿布尔值代替 close 事实。
6. resolved 历史报告无法确认实例：LEGACY_RESOLVED；明确告知降级，保存一次迁移后进入原来的安全日间。它不是一次成功关闭，不发 SAN/reward/close。若全局事实也不能保证安全日间，则进入 RECOVERY_REQUIRED。
7. 未结算 battle、night=true 却没有可信 battle、孤立 HP0、字段矛盾：RECOVERY_REQUIRED。
8. 无待处理 battle/终局问题且 HP>0：DAY。

显式 instanceId 仍需与可用账本一致；遇到同 ID 的互相矛盾结果/close，不能默默取第一条。两个完全相同的重复 close 不允许再次发收益，记录重复诊断；不同实例或不同 command 链不能合并。截断使“未关闭”无法确认时承认缺证据，走降级/恢复，不取最近一次事件。

旧身份适配必须唯一并有明确因果：旧 battle.id 或显式 start 引用连接到唯一 resolved 的 threatId，并连接相应 started 和精确 threat.start replay command。8a4 的 started payload 实际没有 threatId；仅对已知 writer 契约允许从该特定 started 的 eventSeq/tick 构造 ID，且与 resolved 的显式 ID 全等，再检查顺序和 replay。该版本适配不是“同日同分钟”关联：同一分钟多次遭遇、错 seq、错 command、第二条候选均拒绝。完全缺旧身份时，账本恰好只有一个 resolved 也不能证明它就是残留报告。

认可 close 时，event.commandId 必须唯一 join 到 `threat.close` replay command，command.payload.threatId 必须等于报告实例。新 close payload 的 threatId 也须相等；旧 payload 仅在真实普通对象且完全为空时由 exact replay join 兼容。非空但缺 ID/错 ID、错 type、重复 commandId、缺 replay 都不能按旧空 close 放行。不要用 `event.causationId` 或邻近时间替代这一关联。

## 原子安装、迁移与可靠保存

`installSavedPayload(preparedDraft)` 只接受完整验证后的独立 draft。draft 包含全部持久域、显式派生 transient 和预先准备好的 registry 更新；不得再次从当前全局 state 借字段。对现有 const state 可用一个无用户回调、无 await、不会继续校验的同步提交块替换各持久域；任何可能 throw 的工作须在提交前完成。失败前后全局 state 的资源/roster/ledger 投影相同。registry 变更也须同时准备/提交，不能提前注册坏保存中的动态事件。

恢复界面在未选择可安装存档时保持 `gameStarted=false`。公开选择后开启一个冻结的 session，安装该完整 checkpoint，追加一次 `save.migrated` 并可靠保存；成功后才启动 DAY 时钟或允许报告 CTA。迁移事实至少含固定 migration ID/version、reason、来源类别 primary/backup/legacy、原 checksum/原日期、选用 checksum/日期、是否回退、可确认实例或 null。坏主档不能给出可信原日期时记 null，不编造丢失分钟。

backup 回退必须实际把完整选中 checkpoint 安装、迁移后写入主 SAVE_KEY 并 read-back 验证 FNV；不能只记 sessionStorage 或让下一次 reload 重选其它档。不得先将坏主档轮换到安全 .bak；安全来源原字节在新主档成功写入前保持。写失败则保持冻结、显示“恢复尚未保存”并允许重试/重开，不启动世界、不称迁移完成。重试同一预备迁移不追加第二次事实；成功保存已清触发残留，第二次 reload 不新增 save.migrated。该过程不为跨 localStorage key 的操作虚构原子性。

旧缺省 gameOver 或旧 ID 修复若改变持久事实，遵循同一迁移路径。正常 B1 boot 仅恢复展示；不凭启动新增 resolved/close。新增 null 字段会改变实际保存 checksum，必须记录预期兼容与新 fixture/hash，不能通过改旧样本宣称原黄金字节未变。

## 纯报告、关闭与退出

`reportView` 仅投影保存中明确记录的 kills/breaches/finalDamage/wallDamage/npcDeaths、报告时刻、route 和当前已保存后果。确切 resolved receipt 可补充它本来记录的字段，但不能计算治疗前损伤或重算 NPC 伤亡。缺 autoKills/feed/历史士气时显示“未记录”，不得按默认 0 构造无损故事。当前库存/SAN 可明确标为“当前保存值”，不能冒充结算时快照。

`renderResolvedReport(reportView)` 只改 DOM，回填标题、文案、数字、summary-mode 和 CTA；不调用 renderNightWorld/renderNightControls/renderBattleLane/syncBattleZombies、active enemy 查询或状态效果。主世界展示也只消费完整已安装的安全投影。REPORT_PENDING/LOSS/RECOVERY 没有世界或 battle timer，不能经 visibility catch-up 推进世界。

正常 CTA 只走既有 threat.close，保留第一次 SAN +3、现有日期及 upkeep 幂等。Gate 以当前分类/实例/非 loss 为准；同步处理第一次 click 后立即失效，第二个新 commandId 无成功 close 与收益；相同 commandId 去重。关闭完成只启动一个世界 timer，并重新设置 worldLastTickAt。历史残留清理不得调用 continueMorningReducer，因为其中会改变岗位、SAN、治疗和维护。

`SessionController.restart()` 与普通终局动作 Gate 分开：先置 exiting latch 并增 session generation、`gameStarted=false`，阻止重复 start/close/restart、所有保存、catch-up 和输入；再取消 checkpointTimer/worldTimer/battleTimer/interactionRepeatTimer、heldMovementFrame/worldRenderFrame/continuousPositionFrame/resizeTimer，以及任何会重新安排它们的回调。释放 joystick/HUD drag 的 pointer capture，清 heldDirections、motion.input、target/focus、drag/手柄输入与渲染待办。各异步回调在执行时再次检查 generation；取消 ID 不等于已经排进事件队列的回调不存在。

随后删除主档/.bak/.corrupt 和所有受支持 legacy 键及其诊断副本，按原策略保留 settings、清 HUD 布局，再 reload。删除失败显示错误并保持会话退出，不声称已重开；pagehide/visibility-hidden 不得写回旧档。新文档显示公开新局入口，开始后才创建其保存。`session.restart` 不产生 threat.closed；不要求已删除旧档的 restart 事件出现在新局账本。UI 操作、旧 key 消失、新局固定基线与没有旧 threat ID 是实际重开证据。

## B1–B16 必需证据

所有案例冻结源码 SHA、独立 context/profile、before-loader 完整 fixture、原输入 checksum、明确离线变更列表。实际保存/FNV/DOM/截图在首次 boot、公开操作后、两次 reload 采集。fixture 成功不等于自然游玩；源码计时器 instrumentation 单列，不代替真实浏览器。

| ID | 必需证据及负控 |
| --- | --- |
| B1 | 真实公开 resolved 原档；完整报告与原计划；等至少两个 world/battle 间隔仍静止；公开 close 有唯一具体 event/command/threatId，SAN 仅首次 +3；两次 reload 无再结算 |
| B2 | 仅改 night=false 的 B1 派生输入；仍恢复同一报告；关闭和两次 reload 如 B1，不允许直接 DAY |
| B3 | 真实已关闭档附回同实例 battle；原 close 被精确识别，清残留但库存/CP/日间岗位/后续命令不退回；无新 SAN/close |
| B4 | B3 的空 close 兼容；错 commandId、错 threatId、错 type、非空缺 ID、缺 replay、重复命令分别负控，不以时间邻近误认 |
| B5 | 缺 instanceId 但旧 id/start 引用与唯一真实 started/resolved 因果全等；save.migrated 一次、原实例不变、无新 start/resolved；两次 reload 不再迁移；同分钟多候选和错 seq 拒绝 |
| B6 | 完全无身份/缺 feed 或其它历史数组；明确降级、没有伪造 ID/close/reward；迁移可读且第二次 reload 去重。全局关键集合损坏则停恢复，不能按报告缺数组放行 |
| B7 | 身份完整但缺数字/历史展示字段；每个缺项显示未记录，无 NaN/undefined/默认无损。instrument 证明纯投影不写状态/RNG/数组，再以公开 UI 检查 |
| B8 | 白名单 lose + HP0 完整报告；公开失守 CTA 可重开；普通建造/采集/计划/close 拒绝；无获胜 close；原 key 清除与新局保存基线 |
| B9 | omit gameOver 的真实完整 resolved/HP0 派生旧档；派生 loss 迁移一次并实际写 lose；与 B8 同等重开证据 |
| B10 | unknown 字符串+HP0 resolved（unknown 仍优先）、错误类型、孤立 HP0、lose+正 HP、night/battle 矛盾、数组假 envelope；无半载/无 timer，明确恢复/重开 |
| B11 | 未结算旧档 + 日期/内容不同的真实安全 backup；先停模拟且提示具体回退日期；公开选择后恢复整份资源/roster/ledger/计划，实际 save.migrated 记录 rollback；主档新 FNV 和两次 reload 不重新选择 |
| B12 | 未结算/畸形 battle 且 backup 也无效；可操作恢复/reset，原档保留，无 DAY/重打/close/空数组崩溃；storage 不可用错误单列 |
| B13 | JSON/FNV/关键结构坏主档 + 完整 resolved backup；通过公开安全存档入口恢复 backup 的特定报告，资源/roster/计划/ledger 全来自它，迁移真实保存；坏主档不覆盖安全备份 |
| B14 | 非零已花 CP、当日 ration/upkeep、死亡/受伤及据点守军；boot/阅读保持投影不变；人口 ID 集合和存活身份不变，无补人、治疗、产粮/产木或据点收益 |
| B15 | 实际排队 checkpoint 后在 650ms 内公开重开，pagehide/visibility 发生后超过650ms及两个 tick仍无旧 key；可以使用明确标注的低 HP DAY 夹具，经公开战斗真实结算后立即重开。只做 resolved fixture 的 reset 不能冒充“已排队竞态”覆盖；删除失败与 stale generation 源码负控单列 |
| B16 | start/close/restart 连续点击、按住移动/重复交互/指针、隐藏/恢复、23:59 报告；report clock静止，只有 DAY 一个 timer。真实 close tick 与原日期核对，正常关闭后可自然走时；重复 click 无重复效果，旧会话回调无写回 |

除上表，保存安装源码测试必须在 late-field 验证/registry 准备抛错时比较前后完整 state 投影；backup 写入失败重试、future version、partial/duplicate roster、截断账本、损坏数组均为明确负例。跑现有 27 plan/day/close、16 camp-area、43 content-chain、night guard、语法与保存投影回归，并明确保存投影未新增哪种 boot 覆盖。

## 六视角结论与出口

玩家看到原结果与明确回退日期；NPC 保持同一固定居民、死亡和伤势；营地不因展示得到 CP/配给/治疗；势力及据点沿用选中 checkpoint 的真实守军和维护；敌人不重生、不重复掉落；全局链只有原实例、唯一 close 和实际保存的迁移，重开是新会话。

本评审只验证架构约束。通过条件是上述实现及真实证据闭环，当前已写契约或初始复现不算本主题完成。原三日运行、Sites v81 与新构建的 source/fixture 记录继续分开，不改历史失败或未知 source 限制。本轮只新增本 ADR，无全局记忆更新。
