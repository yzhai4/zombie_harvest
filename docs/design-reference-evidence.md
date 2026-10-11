# 尸潮农场设计参考证据记录

> 目的：把本副本使用过的外部游戏参考拆成可核验的机制证据、设计推论与本项目自己的平衡假设。本文是设计输入，不是对任何作品源代码的复刻，也不替代 `剧本/尸潮农场/01–09` 的运行时契约。
>
> 核验日期：2026-10-11（Asia/Shanghai）。优先采用开发商、发行商、官方游戏页、开发者日志和开发者维护的 Wiki；仅在没有一手页面时使用商店页面或社区 Wiki，并在“证据级别”中注明。

## 证据等级与使用规则

- **A：开发者/发行商一手资料。** 可以确认作品公开宣称的循环、目标或系统边界；不能据此推断未公开的内部数值。
- **B：开发者维护或官方商店资料。** 可用于确认可见功能和玩家承诺；具体实现仍需要实机验证。
- **C：社区 Wiki/二手资料。** 只用于补充术语或交叉检查，不作为本项目数值的来源。

外部作品提供的是方向证据。尸潮农场的 14 天窗口、`campCollapse` 阈值、`commandPoints` 数量、实体上限、单武器增益上限等，均是本项目的初始平衡假设，必须在 v80–v85 的回放和性能测试中重新校准。

## 一手资料索引

| 作品 | 来源（标题与 URL） | 级别 | 可核验范围 | 对尸潮农场的可迁移结论 |
|---|---|---:|---|---|
| Kenshi | [About Kenshi — Lo-Fi Games](https://lofigames.com/about-kenshi/) | A | 开放世界、队伍控制、基地建设、技能成长、受伤影响、没有等级缩放、世界持续运转 | 玩家是脆弱的普通人；把生产、伤势、训练和探索放在同一条生存链上。农场营地必须能在玩家不在场时继续结算，但玩家仍可在关键节点改变方向。 |
| WorldBox | [WorldBox — The best sandbox god simulator](https://www.superworldbox.com/)；[Changelog](https://www.superworldbox.com/changelog) | A | 建造世界、观察文明互动、灾害与破坏、文明更新记录 | 用远景账本模拟人口、势力和建筑状态，用近景加载表现关键互动；“世界继续运转”要能从日志和地图结果中读出来。不要把远景模拟误写成逐实体物理。 |
| Kingdom Two Crowns | [Kingdom Two Crowns — Kingdom](https://kingdomthegame.com/kingdom-two-crowns/) | A | 像素微型策略、招募居民、建设、探索、夜间守城，玩家作为统治节点 | 白天投入资源与招募，夜间面对清晰的攻击方向；把玩家的命令限制在少数高价值决策，避免直接替代营地岗位。 |
| Stardew Valley | [About Stardew Valley](https://www.stardewvalley.net/about/)；[Combat — Stardew Valley Wiki](https://wiki.stardewvalley.net/Combat) | A/B | 农业、修复社区目标、关系路线、技能与战斗区域；Combat 技能与怪物战斗关联 | 玩家可直接走位、攻击和补刀，关系与生产也能改变路线。尸潮农场保留直接战斗手感，但把营地调度、研究和防线交给可信任的英雄节点。Wiki 中的具体伤害表不作为本项目数值依据。 |
| Ratropolis | [Ratropolis: Real-time Deckbuilding Card Defense Game — Cassel Games](https://casselgames-eng.imweb.me/ratropolis) | A | 实时卡组、防御位置、建筑卡、城市扩张与波次压力 | 把“选择窗口很短、位置决定收益”的节奏转译为计划会与夜战预备，而不是照搬卡牌；UI 需要一眼读出资源、威胁和可用命令。 |
| Thronefall | [Official community wiki home](https://throne-fall.github.io/) | B | 开发者对作品方向的说明：白天建造基地、夜间防守；极简策略与动作战斗；武器和升级 | 采用“白天准备、夜间兑现”的节奏，英雄和玩家都要有可操作空间；不要引入大地图即时全局微操。Wiki 数值条目仅用于设计对照。 |
| Norland | [Norland Official Wiki — Knowledge](https://wiki.hoodedhorse.com/Norland/Knowledge)；[Beginner's Guide](https://wiki.hoodedhorse.com/Norland/Beginner%27s_Guide)；[World](https://wiki.hoodedhorse.com/Norland/World) | B | 角色技能决定研究/生产速度；领主有自己的意志、关系和目标；人口、知识、外交和战斗共同构成省份发展 | 英雄不只是可选技能栏：他们应拥有投票、关系和拒绝合作条件。科技解锁要落在具体研究者、资源与岗位上，并允许替代者完成最低功能。 |
| The King Is Watching | [Nintendo Store — The King Is Watching](https://www.nintendo.com/en-ca/store/products/the-king-is-watching-switch/)；[Official Wiki](https://thekingiswatching.wiki.gg/) | A/B | 只有在国王视线覆盖处，农民、矿工、骑士才工作；资源、建筑、防御和 roguelite 地图 | 视线机制证明“可见的关注”可以成为生产门槛；尸潮农场不复制视线规则，而把它转译为玩家附近的局部高保真表现、远景账本和命令点稀缺。 |
| Back to the Dawn（动物迷城） | [Back to the Dawn — Steam](https://store.steampowered.com/app/1735700/Back_to_the_Dawn/)；[PC Gamer 1.0 报道](https://www.pcgamer.com/games/rpg/the-prison-breakout-rpg-where-you-can-be-a-fox-or-a-panther-has-left-early-access/) | B | 高安保监狱、派系和秘密、关系与任务；报道确认 21 日限时、多个逃脱路线、三派系与大量 NPC | 事件窗口要给自由探索但不要求全探索；NPC 关系必须改变可行路线。14 天尸潮窗口借鉴的是“有限天数下的多路线压力”，不是复制监狱内容。 |
| Crusader Kings III | [Dev Diary #31 — Stress — Steam News](https://store.steampowered.com/news/app/1158310/view/2375033745317704311)；[Crusader Kings III — Paradox](https://www.crusaderkings.com/) | A/B | 开发者日志讨论违背角色性格会累积压力；人物特质、关系和职位改变政治行为 | 计划会投票要由性格、岗位和关系加权；玩家强行推进与英雄动机冲突时应付出关系、SAN 或崩溃代价。具体压力公式由本项目定义。 |
| Prison Architect | [Prison Architect — Paradox Interactive](https://www.paradoxinteractive.com/games/prison-architect)；[Prisoner Management / Regime — Paradox](https://www.paradoxinteractive.com/games/prison-architect-2/news/feature-highlight-prisoner-management) | A | 资源配置、人员岗位、时间表、劳动、巡逻/部署、设施与暴动风险；Regime 以时间块驱动日常活动 | 计划会和岗位队列应是明确的时间块，而不是每帧寻找工作；建筑位置、行走距离、换防和维护会反向影响产出与崩溃。 |
| The Escapists 2 | [Guide to Freedom FAQ — Team17](https://www.team17.com/news/escapists-2-guide)；[The Escapists 2 — Team17](https://www.team17.com/games/the-escapists-2) | A | 日常点名/作息、缺席提高警戒；任务、随机物品、制作、耐久与逃脱路线；1–4 人模式 | 用“错过日常计划会有热度代价”的思想设计白天命令/夜间拒绝边界；制作与耐久应让强力物品有代价。尸潮农场不引入多人系统。 |
| RimWorld | [AI Storytellers — RimWorld Wiki](https://www.rimworldwiki.com/wiki/AI_Storytellers)；[Ludeon Studios Blog](https://ludeon.com/blog/) | B/C | 事件导演根据殖民地财富、人口、死亡/重伤和距上次事件的时间调节事件；不同故事讲述者有不同节奏 | `resonancePressure`、`campCollapse`、人口与近期伤亡应共同影响尸潮事件导演；随机事件必须有保护边界，不能因人口不足凭空造人。Wiki 的内部公式不直接移植。 |
| Tower Train: Zombie Defense 2D | [App Store listing — MAD PIXEL](https://apps.apple.com/us/app/tower-train-zombie-defense-2d/id6478205588) | B | 商店描述明确提到沿轨收集幸存者、编队/位置、英雄独特能力、升级与僵尸波次 | 可借鉴“英雄站位与单点能力改变一波战斗”的可读性。它是移动端商店文案而非开发文档，无法核验完整经济、刷新或伤害公式；这些内容在本项目中标为待核验。 |

## 机制对照与设计取舍

### 自治与玩家介入

Kenshi 的公开定位是“开放、队伍控制、基地建设、世界不会因玩家不在而停止”，并且强调玩家起点脆弱、伤势会改变行动。Norland 则把角色知识、关系、管理和个人意志放在同一个省份系统中。WorldBox 的官方表述更偏向观察文明和灾害，而不是逐人操控。三者共同支持尸潮农场的核心边界：

1. 远景使用岗位账本、计划会和小队级结算，玩家离开农场时世界仍推进。
2. 近景只表现玩家附近的 NPC、建筑和敌人；进入事件范围后才加载可读的战斗与对话。
3. 英雄必须拥有投票权、岗位效率、指挥或特殊技能中的至少一项；普通 NPC 只走职责状态机。
4. 玩家用 `commandPoints` 改变优先级，而不是无成本地暂停世界或接管全部生产。

这不是把 NPC 做成完全不可控的黑箱。计划会把自主选择公开成投票记录，世界日志记录“提案、权重、玩家干预、自治结果”，从而让玩家知道结果来自何处。

### 日夜节奏、探索与波次

Kingdom Two Crowns 和 Thronefall 的官方/开发者描述都把白天建设与夜间防守作为清晰循环；Ratropolis 进一步把实时防御和快速选择结合。Back to the Dawn 的公开资料强调有限天数、多条路线与大量可交互角色。综合后，尸潮农场采用：

- 白天：探索、生产、建造、关系和事件介入；
- 黄昏：计划会结算和防线锁定；
- 夜间：局部战斗、波次和岗位自动执行；
- 次日：资源、伤势、关系、科技和崩溃账本更新。

14 天是副本主窗口而不是必须完成每条内容的清单。玩家可以直奔中继/最终目的地，也可以通过支线降低共鸣、获得蓝图或建立前哨。支线过期必须进入记录性或保守降级分支。

### 直接战斗与营地协同

Stardew Valley 的公开资料确认玩家技能、探索和战斗并存；Kingdom/Thronefall 则把领袖的移动与基地防守结合。Tower Train 的商店文案强调英雄位置和一次点击能力。由此保留三层战斗：

- 玩家：可移动、锁定、攻击、闪避和补刀；装备有耐久、弹药、过热或体力限制。
- 英雄：主动技能、熟练度、指挥半径和投票权；达成信任/剧情条件后才可由玩家调度。
- 普通 NPC：职责状态机、基础武器/护甲/塔熟练度；在远景结算而非逐人加载。

玩家战斗应改变局部结果和资源损耗，但不能替代营地生产、计划会或所有防线。强力武器必须绑定稀有材料、科技、事件或使用代价，避免单人性能吞掉协同玩法。

### 建筑、岗位与可见性

The King Is Watching 用“视线覆盖才工作”把注意力变成资源；Prison Architect 的一手资料展示了时间表、岗位、房间、巡逻和行走距离对管理的影响；Norland 说明角色技能会改变研究和生产速度。尸潮农场采用更适合当前 Web/Canvas 预算的折中：

- 建筑定义岗位、材料、耐久、覆盖半径、维护和夜战准备效果；
- 近景显示劳动、维修和换防动画；远景只记录产量、维护、伤员和防线状态；
- 岗位空缺不生成新人，触发替代、减产或事件降级；
- 玩家可通过命令点提升优先级，但高崩溃/失信时点数减少。

### 个体、势力与故事导演

Crusader Kings III 的开发者日志把“违背特质会产生压力”作为角色行为的可解释来源；RimWorld 的公开 Wiki 记录事件导演读取财富、人口、伤亡和距上次事件的时间。尸潮农场因此把英雄投票和尸潮强度都写成可复放状态：

- 英雄提案分数 = 岗位目标 + 性格偏好 + 关系 + 资源/威胁权重；
- 玩家否决会记录成本（信任、SAN、崩溃或命令点）；
- 事件导演读取天数、`resonancePressure`、`campCollapse`、建筑/据点准备、近期伤亡和英雄状态；
- 随机只负责在已声明的候选事件和安全上下限内采样，相同 seed/input/contentVersion 必须重放一致。

## 对本项目的明确约束

### 已冻结的设计参数（不是外部引用）

以下数字是 `剧本/尸潮农场/02`、`07`、`09` 的初始平衡假设：

- day 14 为最终尸潮基准，正常结算窗口 day 12–16；
- 营地崩溃 `0–39/40–69/70–89/90+` 四段；核心 shelter 损毁或活跃 NPC 少于 3 人也会崩溃；
- 信任 20/40/60/80 解锁命令权限；每日 `commandPoints` 2/3/4 档位且不累积；
- 单件武器全局战斗增益上限 20%；
- 中端设备日间 60 FPS、夜间不低于 30 FPS；近景实体和单波敌人都有上限。

这些数值不是 Kenshi、WorldBox、Kingdom、Stardew Valley 或其他作品的“官方值”。开发在 v81–v85 中必须用回放、smoke、性能和可达性测试复核，并在变更日志中注明原因。

### 无法确认或暂不采用的参考

- **Tower Train: Zombie Defense 2D**：目前只有 App Store 商店描述可核验，无法从一手资料确认完整数值、敌人刷新、经济或离线结算；本项目只采用“英雄站位/独特能力/波次可读性”的高层启发。
- **紫色晶石**：本记录没有找到足以确认具体作品和机制的一手来源。不得在设计文档中把其未核验机制写成事实；如继续参考，应先补充准确英文名、开发商或链接。
- **动物迷城**：这里以其常用英文标题 Back to the Dawn 的公开资料作对应参考；若团队指的是另一款作品，需补充链接后再更换证据。

## 证据到开发验收的映射

| 设计要求 | 证据来源 | 验收方式 |
|---|---|---|
| 世界在玩家离开时继续推进 | Kenshi、WorldBox、Norland | 远景账本与计划会回放；玩家离开营地 1 天后资源/关系/威胁有确定性变化 |
| 白天建设、夜间防守 | Kingdom Two Crowns、Thronefall、Ratropolis | 夜间命令拒绝白天操作；准备状态进入波次；日志写明计划到战斗的转换 |
| 玩家不能单人替代营地 | Kenshi、Norland、Prison Architect | 玩家不在场时仍能生产；命令点受信任和崩溃限制；岗位空缺走降级 |
| 个体性格影响决策 | CK3、Norland、RimWorld | 固定 seed 下英雄投票可重放；强行违背倾向产生已声明代价 |
| 关系与探索改变路线 | Stardew Valley、Back to the Dawn | 支线提供保守/冒险和缺席降级；关系影响可用选择和最终账本 |
| 性能预算与分层表现 | WorldBox、The King Is Watching、Prison Architect | 近景实体上限、远景统计结算；性能脚本记录日/夜 FPS 和实体峰值 |

## 引用边界声明

本记录只支持“为什么采用某类节奏、自治、关系和表现分层”的设计论证，不支持把外部游戏的具体伤害、刷新、帧率、掉落率或 AI 内部公式直接复制到尸潮农场。任何具体数字必须回到本项目的内容注册表、状态契约、回放和性能验收中重新定稿。

