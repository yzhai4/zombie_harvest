# EventFact 交付记忆：下一切片六视角预评审

日期：2026-10-18。结论：计划与当前成功交付、同 ID 免费查看和 SAVE21 路径相容，可作为下一轮最小实现合同。当前源码尚无该胶囊生产、严格校验、缺槽 adapter 或公开回忆消费；本报告不是实现通过、存档通过或真人体验结论。未运行 VM、游戏、浏览器或测试，也未修改仓库源码／文档。

只读输入：`docs/research/eventfact-handoff-plan-20261018.md`，SHA-256 `e3ef132ad164852458a5cdb49b761d4078d3f9689b463317989e3938c64147b5`；当前 `dist/index.html`，SHA-256 `108042213a6defbfd16cbd2f56cde8fbc2c575717c5eefff942753353a19b09a`，903224 bytes，SAVE21／CONTENT3。计划首行仍标 dccb，属于待更新的来源锚点；当前等候反馈切片未改变下列交付与人物记忆调用语义。下一轮运行必须绑定届时真正冻结的源码，不能沿用本轮或 dccb 的通过计数。

## 真实事件合同

`relayHandoffReducer`（约 7060 行）先完成原核心、项目、关系与功绩结算，返回实际接收人的 `commanderId`；`handoffRelayCore`（7081 行）目前直接返回 `dispatchCommand`。Bus 在成功后返回 `{ok:true,commandId,event,result}`，而 duplicate 为 `ok:true,duplicate:true` 且没有新 event。拒绝没有交付成功 event。因此只判断 `result.ok` 会制造假记忆，计划要求的完整成功判定是必要的。

| 事实 | 当前真实字段与含义 | 胶囊约束 |
| --- | --- | --- |
| 成功类型 | `event.type === 'relay.coreHandedOff'`；父命令类型为 `relay.coreHandoff` | 不把 `command.rejected`、其他中继事件或字符串报告当成功 |
| 来源身份 | `event.eventId`、`event.seq`、`event.commandId`、`event.actorId`、`event.causationId` | 胶囊保存本次返回 event 的最小必要来源；commandId 必须等于本次返回 commandId，不把合法 opaque commandId 收紧为只接受自动数字格式 |
| 时间 | `event.tick = {world,phase,schedule}` | 拷贝真实 tick，不用查询时刻／当前日历伪装交付时刻；校验沿现有时钟语义，不另造现实时间 |
| 交付与接收者 | `payload.projectId`、`itemId:'relayCore'`、`itemInstanceId`、`commanderId`、`status:'briefed'` | 新 `recipientId` 从这个 `commanderId` 映射，写入同 ID 唯一 live NPC；不按当前头衔重新找人 |
| 定义与实例 | `event.defId:'relay-chain-001'`、`definitionVersion`、`instanceId` | 与本次提交／项目实例一致；当前事件没有独立 `instanceVersion`，不要从计划措辞虚构字段。新胶囊自身版本与事件 definitionVersion 分开 |
| 四元 CAS | `payload.expectedInstanceId / expectedDefId / expectedDefinitionVersion / expectedEventId` | 匹配本次真正提交的 token；`expectedEventId` 是提交前状态，不能要求它等于新成功 `eventId` |
| 效果 | `event.effects` 为既有 handoff fact，原业务已结算 | 可核来源，不再应用 effects、不再派发成功事件或奖励 |

旧 A02 真实现场只作字段例证：`003-actual-handoff-live.json` 内成功事件为 `evt-000150`／`cmd-000677`，actor 为 `player-1`，tick 为 `{world:479,phase:0,schedule:119}`，实际接收者为 `commander`，item instance 为 `item-relayCore-001`；其 expectedEventId 是 `evt-000106`，同份现场的 lastEventId 已是 `evt-000162`。这说明成功来源必须取返回 event，不能取最后事件或 expectedEventId。此旧档并不因此获得新版本才引入的胶囊。

`recordWorldEvent`（2862 行）先构造 event，随后 `applyQuestEvent` 可产生后续任务事件；其返回值仍是原成功 event。胶囊只拷贝明确白名单字段和 tick，不保留可变 event／payload 引用，也不从整个世界快照扩充接收者知识。当前 actor 选项与 reducer 内 `player-1` 有不同默认位置，生产者必须核本次实际父命令／成功 event 的 actor 一致性；不得顺手改交付 actor 或 commander 的旧业务选择语义。

## 最小接线与保存边界

1. **唯一生产点。** 保持现有 `handoffRelayCore` 返回合同，取得真实成功结果后，在同一同步调用栈内验证并写实际接收者槽。原 reducer 中途、通用 event listener、lastReport、关系 flag、渲染与回忆查询均不得造胶囊。当前 commander 选择仍为 active 加旧 `npcHasRole`，不是新中继施工的有效岗位合同；本片记录它实际选中的人，不借记忆切片收紧原交付资格。
2. **先冻结槽 schema。** `npc.memory.relayCoreHandoff = null | capsule` 足够；字段只含版本、成功来源、实际参与者、时间、项目／物品／定义实例。校验 recipientId 必须等于容器 NPC ID，类型／定义／版本／实例／时间合法且自洽，未知版本与损坏结构拒绝。只收紧新增槽，不把历史 memory 扩展键一并改成封闭全局 schema。slot 缺失、显式 null、合法 capsule、损坏 capsule 是四种不同输入。
3. **存活历史与当前资格分开。** 胶囊存于参与者本人的 memory；死亡／离营不转移或删除过去经历，是否能现场查看仍由现有 public view Gate 决定。继任只改 actingRole／actingFor，`assignMorningSuccessors`（8873 行）并不复制前任 memory。继任者没有前任共同经历；如果将来本人真正收到另一笔成功交付，才能有自己的来源胶囊。
4. **旧档不回填。** `serializeNpc`（3790 行）已有整个 memory 的写入路径，`normalizeNpc` 当前浅合并 memory；现有 `npc-memory` 校验（3981 行）尚不懂新槽。应在既有 pure draft loader 中对已知完整旧 writer 的缺槽精确补 null，并记录一次加性 adapter；已有 null／合法槽不再迁移，坏槽不能默认为 null。保留全部原事实、人口、资源、关系、项目、事件与奖励，不扫描 briefed／旧账本／knowledgeOfPlayer.facts／importantEvents 来推断未存的个人记忆。A02 完整旧 writer 可复用作真实缺槽输入，开发新档删字段只能另称派生负控。
5. **正常保存时序。** Bus（3722 行）已排正常 checkpoint；`requestCheckpoint`（4379 行）通常以 650 ms timer 执行 writer。同步、无 await 的后置投影可以赶在该正常 writer 前完成，但这只是静态可行性，不是已落盘证明。下一轮要观察正常自动存档，再 Continue 与新 tick；不能用 pagehide、强制保存或测试注入补洞。成功业务已经发生，不能在后置投影异常后把交付改称失败、重执行或额外结算；可失败的格式／身份检查尽量前置，投影保持确定、无外部回调。此方案不宣称 Bus 提供全局异常回滚或存储永不失败。
6. **跨保留窗口。** live events 最多 500，正常 writer 只留末 300，readonly snapshot 还可能只留末 200；`rememberNpc` 的字符串列表仅留 8 条且没有足够来源。因此胶囊必须自足，不能保存一个必须永远命中 ledger 的指针。保留的来源 event 若存在，应与胶囊一致；来源已按窗口淘汰不能单独成为遗忘或拒绝 Continue 的理由。该来源合同属于当前世界／保存，不是跨新局、跨副本唯一身份或防篡改认证。

## 免费消费的实际边界

`npcPublicActionGate(...,{action:'view'})`（7834 行）先核当前 DAY、目标唯一 live 身份、非死亡、营地本地、合法 HP／位置和 1.25 距离，随后直接返回 `requiresAdvance:false`。合法 injured／critical 仍可查看；view 不要求支援的 2 体力／15 分钟。`viewNpc`（8014 行）会更新 selectedNpc 和本地 UI，故“纯读”应精确称**业务事实／时间／账本无新增**，不是整个函数连 UI 状态都不写。

最小 consumer 可复用此 Gate 和同 ID 人物卡，新增独立的纯胶囊投影／本人事实行。不要把它接到 `interactNpc` 的 status-inquiry：该分支已有 `rememberNpc(...,+1)`，会改关系；也不要借首谈伤势 self capture 的 1 格、需求／信任／伤势自洽捕获条件来拒绝本来合法的 1.25 免费查看。当前 typed self observation 是封闭字段 schema，没有交付记忆；直接往旧 self payload 塞任意 capsule 并不等于合同成立。一个窄的纯回忆投影即可，无须完整 contacts 或通用 Memory 框架。

现有名册会为所有人物先渲染卡片，不能把新胶囊无条件塞入全部卡片。事实行只对当前真正通过 view Gate 的同 ID 人物开放，切换目标／离开范围／昼夜或生死地点变化时重核并清理旧显示；不能把 A 的缓存显示在 B 上。合法查询且 null／缺历史时显示“未记录”；Gate 不通过应显示相应不可查看状态，不能伪装成“未记录”或继续泄露旧行。信任不能补出共同经历，高信任也不能授予旁人的交付史。原事件没有未知的人物姓名、敌位置或工程未来结果，文案只能表达来源中的“谁、何时、什么交给本人”，不承诺中继已 online 或何时完工。

## 六视角裁决

| 视角 | 本片合理结果 | 必须守住的真实边界 |
| --- | --- | --- |
| 玩家 | 已完成的一次交付有可再次核实的同人反馈，正常 Continue 不失忆；可据此区分交付历史与当前工程状态 | 免费查询不刷关系／功绩，不新增显式行动分钟；未暂停阅读仍有原世界成本，不包装为无风险或绝对零墙钟时间 |
| NPC | 只有实际接收者记得本人的共同经历，不因信任、岗位或全营共享获得新知识 | 绑定实际 ID；继任不继承；伤亡／驻守保留历史但不突破现场资格；不会把未知说成拒绝或编故事 |
| 营地 | 核心与原关系／功绩仍按原成功结算一次，回忆能说明来历 | 不补核心、不加资源、不推动工程、不重触发任务或 handoff effects；重复与恢复不领奖 |
| 势力 | 只陈述真实营地交付参与，不把个人胶囊扩成全营／外交知识 | 不新增势力信任、外交、所有 contacts 接线或跨副本共享作为本片条件 |
| 敌人 | 玩家查看仍处于原运行时世界，历史文本不泄漏隐藏威胁 | 不暂停敌人、不免伤、不泄漏敌坐标／未来安全；本片没有战斗或危险等价性结论 |
| 全局事实链 | 成功返回事件→同人物胶囊→真实 writer／loader→免费投影，有可追溯且有限的来源 | CAS、actor／recipient、一次迁移、幂等和旧档 unknown 明确；LLM 不生成事实；有限账本淘汰不清除自足胶囊 |

## 下一轮最窄验收合同

这是实现后的候选验收矩阵，当前均未执行；复用现有真实 writer、handoff 与免费 view／Continue 入口，不以本表变成额外完整系统前置。

| 合同 | 最小正／负控与判据 |
| --- | --- |
| 成功来源与唯一人物 | 真正 handoff 成功，核实际返回 event、command／actor／四元 token、payload.commanderId 和 item instance；同 ID 可读，对另一人物不显示。明确 expectedEventId 与新 eventId 不同仍正确 |
| 免费消费与资格 | 实际名册／近身查看在既有 1.25 Gate 内展示；重复查询不改资源、关系、功绩、命令／事件和业务时钟；合法伤势、低信任或伤势 capture 的 unknown 不另阻挡回忆。越距／死亡／离营／夜晚和切人清缓存仍服从原 Gate |
| 持久与窗口 | 等正常自动 writer，回读实际保存；Continue 后新 tick 同胶囊、无重复收益／迁移。有限账本自然或明确标记的受控淘汰后仍可读，不把该受控负控称自然游玩 |
| 幂等与拒绝 | 同 commandId duplicate；stale token、缺核心／距离等既有拒绝；核无新胶囊、无伪成功来源／奖励。保留原业务允许的拒绝 receipt，不能笼统要求所有失败绝对不写账本 |
| 继任 | 换岗位不复制前任胶囊；实际原接收者的历史保留，新任无经历显示未记录。受控继任输入单列，不称自然死亡或自然继任 |
| 旧／坏存档 | 完整旧 writer 缺槽→null＋精确一次 adapter，二次 Continue 无第二迁移；旧 briefed 和已有 handoff ledger 也不回填；显式 null、合法槽、错 recipient／定义／时间／版本与损坏字段分列，坏数据拒绝且不覆盖可恢复原件 |

复用关系最直接的既有合同为 relay legacy／内容链、NPC public-actions、actor-self／direct-sight 的隔离纯消费边界、SAVE21 writer／loader 及 command-id reservation；新增只需本片真实 handoff→本人回忆→正常保存／Continue 的消费者合同与上述有意义负控。源码 VM、完整 boot fixture、真实 Chrome 与自然路线分别报告。现有静态／浏览器绿不推定未来构建通过，工程出口不等于 Attachment、乐趣、自然路线完成或发布验收。

本次只新增此预评审记录；无新增运行时记忆。完整 Actor 观察、所有 contacts、规划／关系系统、Studio、跨副本连续性、更大世界与引擎适配继续开放，均不作为这个单事实切片的无限前置。