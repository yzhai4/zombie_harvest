中继岗位排他性：下一切片开发入口估算

本估算依据冻结 HTML c21cedd145fe9e2db4b224f727c0e7bceaedfefaba31a37b73dbe3a7308f1571、C 已执行的真实旧 writer→markNpcDead(carpenter)→assignMorningSuccessors 反例，以及本次只读源码核对。问题是两名不同 NPC 填三岗、缺岗资格没有阻断；材料额度和全局 workMinutes 都不按重复 participant 数量翻倍。本次只写此文件，没有运行新游戏/浏览器或修改 ROOT。

建议以“中继当前岗位绑定”作为一个小切片：生产实现集中在 dist/index.html，不全局改写 npcHasRole，不增加岗位状态机、存档字段、planner 或新模块。复用已有 npcFulfillsRole，新增一个局部只读绑定函数（暂名 relayRoleBindings），返回每个 requiredRole 的实际 NPC 或缺岗，并检查 npcId 唯一。绑定是派生事实，不持久化；原 id/name、个人链、历史和已投入进度均保留。

| 必改位置（当前 c21 行号） | 最小变化与边界 |
| --- | --- |
| relayActiveParticipants，6838 | 由同一有效岗位绑定取实际人员；不再用原 id 与 actingRole 并集。保留部分合法 crew，以便展示缺岗；执行资格另检查全员和唯一 npcId。 |
| updateRelayProject，7076–7136 | allPresent 从同一绑定判断；缺岗/重复 actor 在 materialClock、取料、workMinutes、建站/收益之前返回。材料责任人由 role 绑定直接取得，不能再次 npcHasRole 找回旧岗。既有额度、来源扣账、工时、状态与同 tick 顺序保留。材料报告的阿梁/周岚固定姓名改用实际 holder.name＋职责。 |
| relayConstructionRuntimeParticipants / Snapshot / Adapter，6896–6995 | snapshot 各 role 的 npcId 来自同一绑定，缺岗填 null；Adapter 在任何事件/占位写入前拒绝缺岗或重复 npcId。沿用 participant-unavailable/CAS/幂等边界，不扩展 opt-in briefed→staging 的职责或打开开关。 |
| npcRestWorkContext 的 relay-duty 分支，4483 | 使用相同绑定的 actor 身份，保留原 briefed/staging/building 与优先级。yieldNpcRoutineToRelay（4510–4511）经修正后的 relayActiveParticipants 自动去掉重复取消；通常无需另改其函数体。 |
| renderRelayPanel，5924–5973 | crew 显示“职责：实际姓名/暂代”或“该职责缺岗”，不能把阿梁的名字显示在周岚身上。缺岗时状态/当前任务优先显示暂停与具体缺岗，不能同时承诺自动筹料/三人就位。 |
| renderHud 的中继摘要，6073–6076 | 已识别 lastBlockedReason=missing-role；可直接复用，不必重写 HUD。若需要具体职责，从同一绑定即时派生，避免再存一套缺岗字段。 |

npcFulfillsRole（8819）与 npcIsCampLocal（4466）的在场/健康范围一致：npcIsActive（4465）只检查 lifeState 不是 dead，再排除 garrisonedOutpostId；两者都不要求 healthy 或满血，也不单独检查 hp、距离、实际到岗、精力或战斗状态。npcFulfillsRole 只额外采用 (actingRole || id)===role。injured/critical 但非 dead 的在营 NPC 仍能通过当前这一级资格。

npcRestWorkContext 的 eligible（4471–4478）才额外要求唯一 live 身份、唯一有效木匠、healthy、hp===maxHp、合法 maxHp/位置/home/needs；这是恢复试点的范围，不是通用岗位政策。relay-duty（4483）是恢复让权原因，原来本身没有这些满血门槛。下一切片只对齐岗位解析，不把恢复 eligible 整块搬入 relay，也不顺带修 critical/HP 政策。若 crew 不齐时是否释放已绑定人员去恢复，需要另一个明确的所有权规则；本最小修复保持既有项目状态占用优先级，不能偷偷改变。

交付链仍是可复用的公开入口：context relayHandoff 按钮（6606–6609）、relayHandoffReducer（7009）、handoffRelayCore.validate（7043–7057）共同走既有四元 token 和 1.25 距离校验。本 qm→carpenter 反例不要求修改 commander 的交付规则；若将“中继全部角色权限”纳入切片，三处应一起改用有效 commander，不能只改按钮。指挥所 vacancy 过滤（7342）仍用旧并集，会隐藏 qm 空缺；修中继阻断并不自动修它。建议列为明确的紧邻小项，若本次不改则继续记 open，不能报告全局岗位排他性完成。每日福利、医疗、战斗、计划/进化 consumer 同样留在后续逐项分类。

现成验证可复用如下，本次均未执行：

| 现有入口 | 能直接复用的范围与限制 |
| --- | --- |
| scripts/check-relay-construction-runtime.mjs | 实际完整 inline＋check-report-recovery IO adapter；已有 8 项涵盖 default-off、stage once、缺员拒绝、CAS、duplicate、占位、SAVE/载入、同 tick 顺序。可在此加新逻辑负控。其 prepare 会重置项目/健康/角色，不能用来生成新的真实反例；新增场景须独立从完整原生输入加载。fixture 元数据 scripts/fixtures/relay-construction-runtime-v1.json 及“恰好8项”断言须精确增至9，保留原8项。 |
| scripts/check-relay-construction-producer.mjs | 保护 world.advance→routine→relay→combat 顺序、默认关开关与 stage-only 边界；它是源码结构检查，不能代替人员负控或浏览器。 |
| scripts/check-relay-construction-v1.mjs / check-relay-construction-transaction-v1.mjs | 保留纯 core/事务、资源/CAS 旧合同。它们不执行实际 NPC resolver，不能单靠它们关闭本问题。 |
| scripts/check-npc-rest-work-v1.mjs | 复用现有 relay-duty 接管与取消/不补工时案例，保护恢复所有权；该旧案例明确手填 briefed/assigned，是受控回归而非真实中继交接来源。 |
| scripts/check-outpost-presence-v1.mjs；check-report-recovery.mjs / lib/source-runtime-fixture.mjs | 前者保护驻防人员无本地岗位；后两者提供实际 loader/writer/validator。C 的 run-source-counterexample.mjs 已有真实死亡/继任、三阶段 native 和不改资源/实体/RNG的做法，可移用必要几行，不复制一套新框架。 |

浏览器入口复用已存在的公开 UI：#continueSaveBtn → #openInfoBtn → [data-info-tab="build"] 的建设/中继页，检查 #relayStatusText、#relayTaskText、#relayCrewText、材料与 HUD 摘要；[data-info-tab="survivors"] 核对实际姓名与暂代身份。原 #relayPanel 在桌面由 mountInfoPanels 搬入 #infoBuildMount，不应拿隐藏原位置的 DOM 存在当作可见通过。合法地标发现与带 token 的 [data-context-action="relayHandoff"] 仍从地图/context进入；工程只随正常世界推进或公开30/60分钟等候推进。

可复用 scripts/browser-npc-rest-work-v1.mjs 的独立 profile、冻结主文档 SHA、loader 前完整 native 一次装入、真实 Continue、截图/原 writer/刷新核验方法；它的 low/near-complete 业务本身没有中继负控，不应仅换输入就冒称已有覆盖。本轮 P/script-design.md 的公开中继路径可复用为路线规范，C 必须单列 controlled 场景，不加入 A/B 配置比较。浏览器 boot 后不改 storage/GameState、不调用 hidden advance/死亡/继任函数，不靠保存坐标导航。真实自然死亡仍需另证。

唯一必要的新负控是“真实继任者不能同时补两岗”：以合法公开交接后保留的完整原生 native 为输入（若尚无此原件，先取得，不手填 briefed/materialClock/材料或 actor），通过实际 loader，受控调用真实 markNpcDead(carpenter) 与一次 assignMorningSuccessors，实际 writer 保存/严格验证/再次 Continue。应得到 qm actingcarpenter、qm vacancy 和两名不同的 crew；在下一段真实消费机会验证缺岗阻断、无新增中继取料/工程分钟/建站与成功回执，保留既有进度及真实死亡带来的 SAN/morale/记忆后果，UI 显示真实姓名与缺岗。正常三人正例、CAS/duplicate、伤员与驻防边界用现成回归，无需再造一套 fixture。

该一个逻辑负控可在 default legacy 与既有声明的 opt-in stage 模式各执行一次，并分别计数；不把两次执行称两个新情景，也不把 opt-in 成功当全工程验证。若只有 C 现有 unknown native，只能继续确认绑定矛盾，不能把“没有筹料/工时”当阻断成功。全 world.advance 还会有合法世界副作用，断言应核中继归属的账和实际事件，不能要求整个世界静止，也不能清敌/补给使其通过。

预计为一个小切片：1 个生产 HTML、1 个既有 runtime checker、1 个 fixture 元数据，以及相应问题/QA记录；不需要新核心模块或存档迁移。已有合格交接原件时，实现与定向 VM/浏览器证据按约 1 个工程日规划；原件取得与真实路线风险另计。HTML 必然产生新 SHA，需冻结新源并重做同类实际 browser 绑定；旧 c21/C 原件保留为修复前证据。以上是开发范围估算，没有预填修复、检查通过、CI或发布结论。
