# 尸潮农场迭代工作流

## 当前合同入口（2026-10-17）

本轮 repeatable/SAVE21/有限资源规则以[断粮设计卡](scripts/zh-food-shortage-001.md)和[episode 身份 ADR](decisions/ADR-20261017-repeatable-episode-identity.md)为入口，以下通用规则继续适用。源码/fixture-browser 已有候选证据；最终源码变动后须重跑并重新绑定，不能把旧结果搬成新构建验收。Sites v81 未发布，本轮未做自然三日。

这份工作流把内容设计、规则实现和试玩验收串成同一条链。当前源头是线上 Sites 源仓库；每轮开始先记录 Sites 版本号、源提交和 GitHub 镜像差异，任何旧镜像都不能直接覆盖线上状态。

## 角色与责任

### 迭代负责人

确定本轮唯一主题、范围和回滚点，维护版本对账表，拒绝把引擎迁移、系统重写和大批内容塞进同一轮。

### 剧本设计师（新增必经角色）

剧本设计师负责把“玩家要经历什么”翻译成可验证的事件图和状态契约，不负责绕过规则层写临时逻辑。每个新事件、NPC 链、势力关系或营地项目都必须先有一份剧本卡，至少包含：

| 项目 | 必须回答的问题 |
| --- | --- |
| 玩家承诺 | 玩家此刻看见什么局面，做选择后希望改变什么？ |
| 触发与前置 | 哪一天、阶段、地点、资源、NPC 生存状态或历史事件允许触发？条件缺失时如何降级？ |
| 节拍图 | 触发、选择、结果、后续钩子和结束节点是什么？每个节点是否可重复触发？ |
| 状态契约 | 时间、资源、营地能力、NPC 需求/关系/SAN、势力评价、敌人压力和全局事件分别怎样变化？ |
| 代价与反制 | 每个选择的收益、代价、失败结果、可恢复方式和玩家可见提示是什么？ |
| 角色动机 | 相关 NPC 为什么提出请求，拒绝后他会怎样行动，是否与岗位、性格、需求一致？ |
| 敌人与全局链 | 敌人压力如何被准备、预警和防线改变；该事件会推动或阻塞哪条全局事件链？ |
| 存档与回放 | 需要保存哪些字段、事件 ID、因果 ID 和迁移默认值；重复加载或重复点击是否只结算一次？ |
| 实现映射 | 对应现有的 `eventPool`、`NPC_EVENT_CHAINS`、`QUEST_DEFS`、`CommandBus/reducer` 和 `SAVE_VERSION` 哪些入口？ |

剧本设计师还要做一遍“合理性账本”：逐项检查玩家、NPC、营地、势力、敌人和全局事件链，指出资源是否凭空出现、角色是否能在不具备岗位/建筑时完成动作、死去或离营的 NPC 是否仍被引用、夜间是否出现白天动作、失败是否留下无法修复的状态。没有通过这份账本，剧本只能停留在提案阶段。

### 规则/架构评审

核对剧本卡是否能落入现有事件 schema、命令总线、reducer、任务 predicate 和存档迁移；优先复用现有字段，不批准隐藏全局变量或第二套事件系统。评审同时确认昼夜阶段、后台暂停、幂等结算和地图占位约束没有被破坏。

### 实现者

只实现已通过评审的剧本卡，把输入接到统一命令入口，把事实写入事件账本，让任务和每日总结从账本读取；不得在按钮回调里直接修改跨系统状态。新增字段要有安全默认值和旧档迁移。

嵌套命令统一预留canonical编号水位，保持opaque旧ID与duplicate兼容，不能以动作专属编号器隐藏父子撞号；安全编号耗尽在支付前检查必要子命令预算。动作回执分开gross支付、同实体变化、实际时间与推进副作用。旧空回执不能补成新人物功绩；永久成功字段另有版本/迁移合同。

### 六视角 QA / 试玩者

每轮都分别从玩家、NPC、营地、势力、敌人、全局事件链复盘。先跑静态检查、语法检查和旧档夹具，再跑白天主链、夜战主链、每日总结、回到白天和刷新恢复；能运行浏览器时补真实 smoke 记录。

### 发布记录员

记录 Sites 源提交、版本号、部署结果、验证命令和已知限制。发布失败时保留可恢复提交，不用 GitHub 镜像回滚线上。

## 每轮闸门

1. **设计闸门**：剧本卡和六视角合理性账本完成，明确不做项和回滚点。
2. **规则闸门**：每个结果都有命令/事件 ID、前置条件、幂等策略和存档字段；夜间动作经过统一 night guard。
3. **实现闸门**：只改本轮范围，静态检查、脚本语法和 `git diff --check` 通过。
   事件链/事务/CommandBus 变更还执行 `scripts/check-content-chain.mjs` 的真实源码测试；保存投影和静态函数存在性检查不证明 reducer 行为。源码轨迹 hash 与保存投影 hash 分开记账。
4. **体验闸门**：玩家能从提示理解因果，失败可恢复，NPC 行为与岗位/需求一致，尸潮压力有预警和反制。
   后期事件可用明确标注的 boot-save 夹具定位，并核对真实 loader、按钮、结算和刷新。夹具在 boot 前注入，避免前一文档 pagehide checkpoint 覆盖；夹具验收不能称为自然多日通关。
   多日 browser smoke 必须分别记录实际日历跨日和遭遇次数；关闭可选报告不代表 day+1。公开训练推进会改变 SAN/士气，不称为自然或平衡试玩。同分钟动作必须等具体新收据和真实状态写入保存；刷新后的去重检查需要新的正常时钟收据，不能只读回旧 localStorage 快照。
   保存等待失败记录实际取样时刻、整次RPC耗时与周期窗口，少于完整周期的未更新不称保存已执行失败；loop deadline不当成所有RPC硬截止。截图timeout/null保留，原FAILED和profile不重写。命令编号/维修主题另跑实际28/41可移植checker，VM、renderer、browser与永久人物功绩分别验收。
5. **发布闸门**：Sites 保存与部署成功，记录版本和 smoke 结果；任一关键闸门失败就回滚本轮，不扩展下一主题。

## 剧本卡落地格式

建议将已通过评审的卡片放在 `docs/scripts/<script-id>.md`，文件名与 `eventId` 或 `questId` 对齐。剧本设计师拥有“退回不合理方案”的门禁权：无法映射现有 schema 的内容先拆成独立 schema 议题，不临时添加字段。实现提交必须引用卡片，测试记录必须逐项回填“触发、选择、结果、存档恢复、六视角检查”。

## 持久浏览器任务与证据

长测试设置 15 秒进程心跳、约 30 秒父进程轮询和整体预算，保存阶段结果与 profile 对应的 runner checkpoint。观察超时只重新轮询同一 handle；确认进程终止后才使用原 profile 恢复。恢复只读取真实保存与具体 command/event 关联，不注入 checkpoint、不重复奖励。保留失败尝试，跨构建恢复分别记录源码 hash；非零 CP、人口降级、据点 upkeep 等夹具证据与公开低信任路线分开。

复核 Sites 公开权限用后台 access_mode 与真实浏览器入口共同确认；匿名 HTTP/抓取被拦截不能推导站点仍私人。服务器测试与 Sites 生产源线保持版本对账。

对账还须从实际生产源码的writer读取SAVE版本、CONTENT版本及已保存字段。Sites托管版本号不等于规则/schema版本；本项目公开v81源实际为SAVE18、尚无contentState。旧档兼容必须使用该真实writer产生的完整保存，不能把开发SAVE21夹具删字段/改版本称为生产兼容。新增系统仅按明确适配补缺省，原人口、资源、伤亡、日历与账本保留；已耗尽且被writer保存为amount0的资源也是合法旧事实。

多日 runner 完成后，用 `scripts/verify-three-days-artifacts.mjs` 只读核验原始报告与完整保存工件。检查 FNV、日历/事件水位、连续账本、前一夜具体计划实例及效果/粮食来源、三场遭遇、真实收获和固定人口；报告失败或阶段缺失必须保持 exit1。人为负控单列，不能计入实际回放。早期快照缺源码 hash、恢复使用多个构建或缺某日显式刷新时，分别披露覆盖限制；当前日补验不能改写历史日期的结果。

单构建从头三日须在runner和只读Gate中显式启用`--strict-fresh --expect-html-sha256 SHA`。检查全新空profile/输出、含公开reset的每次main-document response与全部保存同源码SHA、DAY1/2/3各自真实reload和新clock/去重、原final保存day4≥06:00、零resume。不能只靠主报告声明fresh或source-ready检查推定通过；旧恢复结果继续按原默认合同保留。

计划权限/实例/renderer变更增加`check-plan-integrity.mjs`与`check-plan-integrity-ui.mjs`实际源码门禁。计划按钮读取真实SessionController DAY Gate；resolved报告night=false仍不可干预。旧committed不能因新权限追溯撤销、退款或补故事，新的同日非idle实例也不能被force重生成。VM声明完整writer TEST-ONLY夹具、IO renderer遮蔽与实际被测renderer，最终仍需公开计划会入口与刷新验收。

需跨机器保存证据时，在操作系统确认原runner终止后执行 `scripts/export-three-days-artifacts.mjs`，只复制报告明确引用的保存和截图，并保存不变的原报告、逐工件SHA/FNV及路径映射。输出是新空私有目录，不能位于网页根或仓库；不复制profile、cookie和密钥。Windows以真实ACL验证私有权限。迁移后使用 `--source-manifest` 重绑定新路径，再跑同一独立Gate并比较覆盖和逐项结果；允许根目录参数的差异单列，不能把迁移或导出成功当成游戏验收通过。

历史说明：v79 之前的 `EVENT_DEFS` 曾主要保存标题和选择 ID；当前版本已提供事件契约、内容注册表和扩展效果接口。后续仍需把新主线/支线逐条注册并补回归夹具，不能继续堆叠按 ID 分支。

## 整体设计冻结（v80 起）

`剧本/尸潮农场/01–09` 是世界观、时钟、事件图、六视角、NPC、计划会、战斗与预算的设计源；`剧本/尸潮农场/11–16` 是数据接口和模板；`docs/scripts/<script-id>.md` 是经过评审、可映射到运行时的剧本卡。三者不能互相覆盖：改动设计源必须更新剧本卡和 `contentVersion`，实现只读取已评审卡。

每轮还必须检查固定人口、`campCollapse`、`resonancePressure`、commandPoints、自治/玩家双路线、fallback、事务回滚、动态渲染和性能实体预算。新增内容不得创建第二套事件系统、隐藏变量或绕过 night guard。

## v80–v85 工作流

v80 冻结状态边界；v81 接入营地自治与计划会；v82 接入 NPC 属性和英雄晋升；v83 接入科技/建筑/据点/支线；v84 接入 day12–16 尸潮与多结局；v85 接入动态表现与发布验收。每轮按“设计卡→规则评审→实现→六视角 QA→回放/迁移→发布记录”推进，未过当前闸门不得进入下一阶段。

## 权责边界

剧本设计师拥有世界因果和内容退回权；规则/架构评审负责 schema、reducer、幂等和迁移；实现者负责运行时、UI、资源和性能；QA 负责固定种子、人口不足、死亡/缺席、夜间边界和回放；发布记录员负责版本与回滚。设计不直接改按钮回调，开发不自行补剧情。

## GitHub 直连维护模式

当本地 Git 无法写入或 Sites Git endpoint 不可达时，项目仍按同一闸门推进：

1. 通过 GitHub API 读取默认分支、提交、树和现有 PR，确认仓库基线。
2. 从该基线创建 `codex/<scope>` 分支，保留线上 Sites 版本的独立记录。
3. 用 blob/tree/commit 更新运行时、剧本卡和验证脚本；不要把分叉源线直接写回 `main`。
4. 创建 draft PR，说明基线、变更范围、验证命令、回放 hash、浏览器限制和发布条件。
5. PR 通过后再决定是否将提交推入 Sites 源仓库；没有可追溯提交和归档时不发布。

公开 GitHub 内容只包含可公开的项目事实。令牌、内部路径、部署凭据和环境错误保存在本地交接记录中。GitHub API 解决版本管理和审阅问题，不改变“Sites 生产版本必须经过保存、部署和线上 smoke”的发布闸门。

## 工作流技能

跨内容、运行时、验证、AI、实验和发布的整轮任务使用 `.codex/skills/zombie-harvest-iteration/SKILL.md`；单纯新增或修改主线、支线、NPC、势力、科技、建筑和武器时使用 `.codex/skills/zombie-harvest-content/SKILL.md`。完整技能要求每轮回填六视角评估矩阵，并根据重复出现的流程缺口更新技能或 references。

## 长期开发与科研闭环

项目长期路线见 `docs/long-term-plan.md`；记忆边界见 `docs/project-memory.md`；实验记录格式见 `docs/experiments/README.md`；Colab T4 的运行边界见 `docs/colab-t4-evaluation.md`。

每轮只选择一个主主题，允许一个配套验证主题。主题结束时必须产生以下四类结果中的至少三类：可运行代码、验证证据、问题/决策记录、实验或发布报告。失败也要记录，不能用下一轮提交覆盖失败原因。

候选运行时先复制到独立不再编辑的QA目录，以文件SHA核对源码回归、浏览器响应和发布字节。隔离源码测试加载真实的新会话控制器/Gate，测试模式只是显式环境夹具。被修改的HUD/报告renderer不能被空函数替代：除报告冻结外，还验关闭后采集、建造、种植及推进按钮恢复。源码检查、保存投影与真实browser分别列出范围。

可见性验收先对账生产CSS和当前公开入口。旧utility-row中的cropBtn被设计隐藏，disabled解除不等于该备用按钮应可见；作物需通过近菜畦contextActions真实验证，不改CSS、hidden click或运行中造成熟度。原close/SAN补偿先按精确账本取证，随后导航与实际收获各取新的真实保存基线。crop.changed空payload或no-op receipt不能代替实际food/plot变化、唯一crop.change重放和causationId关联；后续刷新用真实行动后存档，不把作物行动混作关闭奖励或自然时钟。

AI 规划器只产生结构化意图，不能写入 `GameState`。游戏主循环必须能在没有 GPU、没有外部 LLM 和网络失败时通过规则策略继续运行。Colab 只执行有 manifest、checkpoint 和分片结果的可恢复任务，不作为线上常驻后端。


## EventDef / GateV1 迁移规则（2026-10-16）

事件系统迭代先区分“注册字段存在”和“运行时真正执行”。只有显式 gateVersion: 1 或 evaluatePreconditions: true 的 EventDef 才由 GateV1 评估；旧定义保持原 reducer 语义，不能因补齐字段而改变行为。Gate evaluator 必须纯读、白名单化、未知/畸形条件 fail-closed，并接收 EventInstance 的 actor 上下文；Choice.requires 与 EventDef.preconditions 不得各自复制解释器。

命令入口的顺序固定为 session/identity CAS → Gate → reducer/effect transaction。Gate 失败只写拒绝账本，不扣资源、不清理敌人、不推进事件；terminal handled 之后才可做来源清理。每次迁移至少加入通过/拒绝/未知条件/错误 phase/旧实例和 save-reload 回放夹具；静态契约或单轮浏览器 smoke 不得写成多日自然回归。


## 场景包、观察者与证据新闸门（2026-10-17）

每轮竖切片必须提交版本化 JSON 场景包与 IterationEvidenceV1 manifest。包至少固定 scenarioVersion、seed、gameVersion、worldConfig、aiConfig 和 storylet fallback；validator 检查 stable ID、缺引用、不可达/无 fallback、循环、不可满足门槛、AI authority 与 AI-OFF 回退。当前 resolver 只作 headless fixture，不能把通过写成生产 loader 已接线。

Observer 采用“白名单事实投影 → 只读表达 → deterministic fallback”。不得创建资源、人口、事件或修改存档；SAVE21 只保存版本化 snapshot 与开关，不保存凭据或不可回放模型状态。超时、非法输出、越权和预算拒绝必须回到同一规则路径。

Evidence manifest 绑定 branch、evidence commit、HTML SHA、SAVE/CONTENT、CI run/job 与 browser 状态。只有 exact source/hash/manifest 对账通过才可标记 verified；设计报告、static/source-VM/fixture 不能冒充自然 browser。每轮仍需玩家、NPC、营地、势力、敌人、全局链六视角账本。

## Repeatable episode gate（2026-10-17）

将一次性链与 opt-in 可重复链分开评审，按[断粮合同](scripts/zh-food-shortage-001.md)检查创建日 episode key、五元按钮 token、跨日 stale、原实例跨午夜/刷新、choice/fallback/自治的身份透传与按 episode 去重。token 不得由执行入口隐式刷新；拒绝只写拒绝事实，不支付或发奖。SAVE21 身份字段是加性适配，旧链 projection/golden 保持；完整旧 writer 夹具与派生负控分列，不能删新字段伪称生产旧档。

资源内容必须有有限来源、代价和持久耗尽标记：短缺可重开不代表藏粮可重领。六视角账本核对实际增减，不虚构人口、势力信任、岗位占用或敌人 spawn。Observer 的纯核心/深冻结只证明表达边界，actor 权限和感知来源未验收时仍列未完成。

证据遵循 exact source/runner/input/artifact 绑定；static、source-VM、真实 boot fixture、自然 browser 和 Sites 分层列示。源码改变即使旧 browser 已通过也须重验受影响合同；pending、缺 hash、stale 与 unavailable 不作通过，旧失败不重标。详细验收项引用设计卡与 ADR，避免在工作流累积逐次日志。
