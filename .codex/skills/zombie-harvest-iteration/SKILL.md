---
name: zombie-harvest-iteration
description: 维护尸潮农场的跨内容、规则、AI、实验和发布迭代；用于把一个主题从设计卡推进到可回放实现、headless 实验和交接记录。
---

# 尸潮农场整轮迭代

当前 repeatable 内容与 SAVE21 增量适配先读 `docs/scripts/zh-food-shortage-001.md` 和 `docs/decisions/ADR-20261017-repeatable-episode-identity.md`。候选已接按日 episode/五元 CAS/有限藏粮与纯 Observer 核心；Scenario loader 仍 headless minimal，actor 权限/感知投影与自然三日未完成，Sites v81 未发布。具体计数与字节以当前 QA/manifest 为准，不从历史绿色推定当前通过。

先读取 `docs/memory/current-state.md`、`docs/memory/open-risks.md`、`docs/project-memory.md`、`docs/long-term-plan.md` 和 `docs/iteration-workflow.md`，再按任务加载 `剧本/尸潮农场/01–09`、`11–16` 和相关 `docs/scripts`。不要把聊天内容当作规则真相。

## 选择迭代模式

- **内容模式**：新增或修改主线、支线、NPC、势力、科技、建筑和武器；同时遵守 `zombie-harvest-content`。
- **运行时模式**：修改 GameState、CommandBus、reducer、事件账本、保存、回放或 UI；先写状态/迁移/幂等契约。
- **AI 模式**：LLM 只输出声明式 `Intent`；必须经过观察投影、能力 Gate、预算和确定性执行器。
- **实验模式**：先固定 baseline、seed、contentVersion、模型和指标；结果写入 `docs/experiments/EXP-*.md`。
- **问题模式**：先创建 `docs/problems/PROB-*.md`，记录复现和影响，再修复并追加回归证据。
- **发布模式**：记录版本对账、验证命令、回放 hash、浏览器限制和可恢复回滚点。

## 固定顺序

1. 写主题、成功标准、不做项、风险和回滚点。
2. 读取 L0 规则真相，创建或更新剧本卡/状态契约。
3. 运行架构评审：schema、权限、昼夜边界、人口守恒、事务和迁移。
4. 实现最小闭环；跨系统变化只能从统一命令入口进入。
5. 运行静态校验、night guard、smoke、replay self-test 和相关夹具。
6. 若是 AI/实验任务，运行规则 baseline，再运行变体和 held-out seed。
7. 更新问题、实验、决策和交接记录；最后再进入下一主题。

## AI 运行时边界

LLM 不得直接改全局状态、生成人口/资源、跳过事件节点、读取未授权信息或调用未注册工具。模型输出应包含 `intentId`、`actorId`、目标、期限、资源预算、信息依据和 fallback。无效、超时、越权或模型不可用时回退到规则策略，并记录拒绝原因。领袖 LLM 的刚性/软性 harness 设计源为 `docs/decisions/ADR-20261014-leader-llm-harness.md`：刚性层负责观察白名单、角色与阶段 Gate、资源/人口/实体/时间预算、注册命令、统一 CommandBus、幂等、回放和进程预算；软性层只负责价值权重、风险偏好、候选顺序、解释和承认未知。该 ADR 通过前不添加 runtime/schema。

## 记忆与实验

- 稳定决策写 `docs/decisions/ADR-*.md`。
- 可复现问题写 `docs/problems/PROB-*.md`。
- 可比较实验写 `docs/experiments/EXP-*.md`，原始运行物放 `docs/experiments/runs/`。
- 每轮结束明确写“无新增记忆”或列出新增记录。
- 只把模型 ID、配置摘要、seed、commit 和指标写入仓库；凭据和临时路径不得进入记录。

## 必跑验证

涉及 NPC 参与资格时，区分存在/存活、营地本地、健康可工作和有效岗位；驻守者仍计人口，但不能跨地点重复行动。双向伤害、新感知/共享、routine、motion、render 与福利分别核 consumer；修了作战入口不能宣布整体离营完成。critical 是否可战按明确规则判断，不能从 dead Gate 推定已有健康 Gate。参见 `docs/problems/PROB-20261017-npc-outpost-camp-presence.md`。

自然路线先按 `docs/qa/natural-play-protocol-20261017.md` 追踪公开入口的真实命令与时间效果。遭遇开始/报告关闭不等于跨日；有意义行动耗尽可报告节奏未完成，不用重复增益或空等补成“自然三日”。公开休整若实施，必须有小步模拟、危险中断、午夜后果、timer ownership、幂等与旧档证据。

```text
node scripts/validate-content.mjs
node scripts/check-night-guard.mjs
node scripts/smoke-three-days.mjs
node scripts/replay-harness.mjs --self-test
```

修改事件链、效果事务或命令结果时，还运行 `node scripts/check-content-chain.mjs`；它执行 HTML 中的真实函数，覆盖多节点、失败回滚、拒绝、重复和恢复。`smoke-three-days` 的 static fallback 与保存投影 hash 只能证明其覆盖的结构，不能代替 reducer 执行或真实多日游玩。源码命令轨迹 hash 和保存投影 hash 分别记录。

显式commandId/嵌套命令变更还运行`check-command-id-reservation.mjs`，维修变更运行`check-repair-proof.mjs`，使用显式HTML、真实IO-adapter、全新私有out及完整旧writer fixture。canonical只按当前formatter往返一致的正safe数字认定；opaque旧字符串保持，duplicate先验历史而不再次改水位，自动编号避开seen/replay/active父ID。MAX_SAFE耗尽必须在支付前核必要子命令预算，不能另建动作专属编号器或把未知nested异常说成已获全局回滚。

成功动作proof分开gross支付、同实体HP/产出、实际时间推进与推进副作用，记录真实nested command/event/causation；旧空payload不追溯补人物功绩。保留窗口不是永久NPC成功账本，新个人链消费者仍需独立状态/迁移合同。拒绝必须不发成功receipt、任务功绩或奖励，不能只判断wrapper返回存在。

浏览器用保存夹具定位后期事件时，注明 fixture 模式，并在下次 boot 的 loader 之前注入：运行中改 localStorage 会被 pagehide checkpoint 覆盖。用 `scripts/server-content-chain.py` 验证事项切换、真实结算与刷新；自然试玩证据另行记录。

修改计划结算、每日指挥点、日历或附近区域交互时，执行 `scripts/check-plan-day.mjs` 和 `scripts/check-camp-area.mjs`。实际日历三日用 `scripts/server-three-days.py` 的公开行动路线：分别验日历跨日与遭遇次数、固定人口与营地生存、真实收获、每日配给/计划/指挥点及刷新。训练改变 SAN/士气，不能据此评价自然节奏或平衡；低信任零 CP 路线也不能证明非零已花 CP 的防回补。

### 日历回归、行动安全与执行版本

- 重复训练推进三日只称 `calendar regression`，不称 natural gameplay、自然通关或平衡验证；即使所有动作来自公开 UI、没有注入保存，也保留这个范围。
- 每个会推进时间的公开动作前，用实际可见信息/只读保存检查敌人接近包络：当前距离、敌速、动作分钟、攻击范围和观察滞后余量。必要时以公开导航/攻击/进食先自卫，固定尝试、体力、食物与生命预算并核实际收据；预算不足则停下留证，不注入资源、删敌或放宽伤害规则。LOS、视锥、岗位、朝向和日程都可能阻止 NPC/塔救援，不能把自动保护当作路线前提。
- 分开记录 playerHP、核心建筑真实耐久、campCollapse 和 NPC 数量/伤亡。不得把玩家 HP 字段命名为 campHP，也不得因玩家死亡推定全体 NPC 或营地核心已经死亡。
- 启动时绑定并保留实际执行 runner 的原字节/SHA、HTML、输入和参数。运行中工作树可以变化，但旧进程仍归属于启动版本；归档用执行副本，不用当前同名文件替代，不把新 SHA 写成旧运行来源。
- 确认进程 terminal/exit 状态后才 export 与独立 verify，核报告和工件原字节及执行版本；先有文件、心跳或最后一次通过不等于已终止或已通过。原失败继续保留。

计划权限/同日实例/计划renderer变更还执行`node scripts/check-plan-integrity.mjs`及`check-plan-integrity-ui.mjs`显式输入命令。UI使用真实SessionController阶段Gate，不能仅靠night=false判断白天；旧低信任committed只保留历史承诺与已花CP，不追溯撤销或补奖励。完整旧writer夹具标明TEST-ONLY，与真实生产捕获分开；VM IO遮蔽的renderer与被测实际renderer分别列明，不把JSON事实相等称为对象引用不变。

同分钟动作等具体新 command/event 收据和真实变化写入存档，刷新去重等新正常时钟收据后检查。长测试保存阶段 checkpoint、原失败报告和各构建 hash，约30秒轮询已确认的进程；观察超时不重开。终止后只从同 profile 的真实保存恢复，并用关联 commandId/threatId 防止重复动作；不注入 runner checkpoint。

失败等待诊断分开JS取样时刻、整个浏览器RPC返回耗时与周期保存窗口；少于完整周期的未更新不能证明一次保存已执行失败。循环deadline不等于所有RPC硬截止，截图timeout/null必须保留，不能补造现场图或把旧成功截图移用。新增诊断方法与实际失败轮分开，原判据和FAILED保持。

多日完成后以 `scripts/verify-three-days-artifacts.mjs` 只读核验原报告和完整保存工件，失败/阶段缺失仍 exit1，负控单列。保存校验之外，核对连续账本、具体计划/粮食来源、三场遭遇、真实收获和固定人口。未知源码 hash、多构建恢复、缺历史日期显式刷新必须披露，当前日补验不能改写历史结果。

声称“单构建从头三日”时，runner与artifact Gate都显式使用`--strict-fresh --expect-html-sha256 SHA`：启动前全新空profile/输出，逐main-document实际response同SHA（含公开reset内部navigation）、每份snapshot同SHA、DAY1/2/3各自真实reload及新tick去重、原final保存day4≥06:00、零resume。source-ready/合成方法控制不计游戏通过，默认恢复模式的旧结果保持原合同。

跨机器归档先确认原runner确实终止，再用 `scripts/export-three-days-artifacts.mjs` 导出声明工件和不变原报告；不复制浏览器profile/凭据，不写入仓库或网页根。迁移后用manifest重新绑定路径并运行同一独立Gate，核对原字节SHA/FNV和实际coverage；导出成功不代表游戏通过。Windows私有输出须核验真实ACL，chmod不能代替。

发布对账读取实际生产writer的SAVE/CONTENT与完整字段，不用Sites版本号推定schema。旧档回归要包含真实旧writer产生的保存；开发新档删字段/改版本只算派生负控。新增系统缺省与损坏字段分开，amount0耗尽资源和原人口/伤亡/日历事实不得因严格校验被丢弃或补造。

候选先以不可变字节副本和SHA执行既有源码回归，再接入dist和浏览器。隔离源码测试遇到新增会话依赖时加载实际控制器/Gate，并明确设置测试会话；不得mock新Gate。修改HUD/报告控件时必须执行实际renderer，断言关闭后操作按钮恢复；把该renderer替换为空函数会隐藏界面回归。静态、VM与真实browser证据分别记录，不互相代称。

后台/visibility验收先观察实际hidden/visible及可信事件，不凭bringToFront或窗口最小化推断。检查自动化框架是否默认模拟焦点；如需原生行为，以支持的API及独立context方法证明，不通过改document.hidden或伪事件让测试通过。短隐藏只证明其实际时长，不代称≥60秒catch-up。所有owned browser/profile/display在finally清理，profile不混入工件归档。

UI验收先对账当前生产CSS与真实可见入口，区分legacy隐藏备用控件和公开交互。禁止为了通过测试显示旧备用按钮或点击hidden按钮。恢复后可检查四legacy控件disabled解除，但种植/收获要经公开近田context路线另验；先保存精确close/补偿事实，再为导航和作物行动分别取实际生命周期保存基线。空payload成功receipt不能自证产粮：须有真实food/同plot变化及unique commandId/replay/事件因果关联。

AI 或实验变更还必须提供：baseline、变体、seed 集、失败重试策略、成本/延迟统计和 held-out 结果。

## EventGate parity 与可达性闸门（新增）

- shadow/inline parity 只能声称夹具范围内的完整结果一致；runner 必须比较失败门、details、actor 信息和输入状态前后快照，报告中明确 fixture parity、source VM、browser 和线上证据的边界。畸形 gate 或状态容器的有意差异单列，不得推广成任意输入等价。
- 给 EventDef/Choice 增加 Gate 或 `requires` 前，先沿真实调用路径确认 resolver/CommandBus 会执行它。只有注册表元数据、没有实际入口的 choice 不算已接线；自治 reducer 的状态、资源、岗位和距离校验不能由未执行的 Gate 声称覆盖。
- 跨系统命令迁移采用 EventInstance 四元 CAS（instance/def/version/event）→ Gate → 业务前置 → reducer/effect 的顺序。stale 命令只写拒绝 receipt；成功 receipt、replay 和 save/reload 夹具保留 token。六视角报告要说明 CAS 对玩家、NPC、营地、势力、敌人和全局账本的实际影响。


## 场景包与调研输入闸门（2026-10-17）

涉及竖切片或观察者时，先读 `docs/qa/deep-research-baseline-20261017.md` 与 `docs/qa/iteration-manifest-v1.json`。外部调研是设计输入，不是运行时证据。维护 scenarioVersion/seed/worldConfig/gameVersion/aiConfig/storylet fallback，运行 `check-scenario-package-v1` 与 `check-observer-expression-v1`；resolver 当前是 headless fixture，只有真实 boot loader 调用和旧档迁移证据齐全后才写 runtime loader。

Scenario schema/版本化 snapshot 能保存，不等于 boot 已消费配置；须沿真实新开/继续入口验证实际世界效果和旧 writer 保留边界后，才称 loader 生效。

Observer 只能使用白名单只读投影，不能触碰可变 WorldFacts 或写 GameState。当前可信调用者提供的 subject/context 与深冻结纯表达 API 不是角色知识授权；低信任只对已授权 knowledge 取披露交集，高信任不能发现隐藏事实。actor/perception Gate 未接线就保持 proposed/未完成，LLM 不得直接读取 GameState、宽快照或任意原始 subject。AI-OFF、超时、非法输出、越权和预算拒绝使用 deterministic fallback。

原用户报告只作设计依据；proposed ADR/剧本卡与字段存在不能证明实现。状态以真实调用路径、writer/loader 和当前构建证据为准，不由报告描述或历史绿色提升。

每轮更新 IterationEvidenceV1：source commit、HTML SHA-256、runner/input/artifact、CI run/job、测试计数、browser status、naturalGameplayClaim。exact 对账通过才标记 verified；source-VM、静态、真实 boot fixture、自然 browser 与 Sites 分层。源码变动后重验受影响合同；stale/pending/unavailable 不作通过，旧失败保留。按报告 P0→P6 推进，先验 exact simulator；其已满足目标时不为追热点增加 learned World Model。

## Repeatable storylet 与回放边界（2026-10-17）

内容链若声明 `repeatable:true`，按断粮设计卡/身份 ADR 验创建日 key、五元预期 token、跨日 stale、未处理实例跨午夜、choice/fallback/自治身份回执和按 episode 去重。执行入口不隐式刷新 token；缺字段/未知版本拒绝，拒绝不发奖。用完整旧 writer 验真实 loader 的 SAVE21 加性适配，派生负控另列，非重复旧链 projection/golden 不变。

重复危机不重置有限来源：验藏粮 flag 跨日/刷新、岗位健康/继任与事务回滚，不虚构人口、势力信任、岗位占用或敌人 spawn。Observer 纯核心与深冻结白名单不等于 actor 权限/感知投影已完成。详细合同留在设计卡，Skill 只维护会改变后续决策的规则。

内容选择的合理性要同时比较立即选择、关闭/暂不处理和先补粮等公开可达策略；分别写清内部 fallback 与真实 UI 入口。旧一次性完成档迁入 repeatable 后，还要调用真实事件菜单/renderer，证明新 episode 可见，不能仅凭 startChain 成功宣布迁移闭环。
