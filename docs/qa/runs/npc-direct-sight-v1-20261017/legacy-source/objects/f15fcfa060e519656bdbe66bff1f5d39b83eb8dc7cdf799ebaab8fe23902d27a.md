# ADR：Scenario JSON 编译、候选目录与内容绑定 v1

日期：2026-10-17。状态：adopted／声明支持范围的运行时与开发验收已完成；不代表生产已发布。承接[完整 boot 合同](ADR-20261017-scenario-boot-contract.md)与[C2 实施备忘](../research/scenario-boot-c2-implementation-plan-20261017.md)，实际证据见[C2 QA](../qa/scenario-boot-c2-20261017.md)。C1 源提交 d65924431932d63ccfa6cb3da12f38fd126cd39c、开发 HEAD 982ab863abd8a37c332a01368fc93f7134e3a4bc、HTML a2fcdb647f2632fbf50f3ab0f3ba160f168082c602f6737c5ca4239eede137d2 保留为本轮冻结对照；当前 C2 源码为 a544a6139e19c21f89526e3aafed11162d885552／HTML61ea64b2。

## 玩家价值与范围

剧本文案与规则应来自同一版本化作者数据。修改一个合法且经过校验的事件包，应改变真实事项的内容和执行效果；开发者不必同时维护第二份手写效果。默认断粮 v2 的经济、岗位与选择全部保持，JSON 接线不借机增加惩罚或奖励。中继仍走已有 EventDef 和主线，不被重建为 eventChain。

本片交付完整 JSON → plain EventChainDef → 原有 renderer、Gate、episode CAS、CommandBus、效果事务和 writer。无新解释器、编辑器、任意代码、LLM 生成事件或敌人 Director。初片支持可静态验证的单节点终态选择；多节点/循环等未实现图形明确拒绝。此范围是编译器第一版能力，不是长期剧本能力上限。

## 作者数据与权限

共享纯核心导出 compileScenarioEvents(package)，输出 compilerVersion、typed registry、完整 definitions、catalogDigest 和 rulesDigest。作者包包括文案、时间窗口、hook、Gate、选择、fallback、repeatable、optional、有限来源和表达权限；运行定义保留现有 EventChainDef 结构，剥离只供校验的 source/expression 元数据，catalog 与 rules digest 均仍包含这些元数据。移除运行时手写断粮定义和 C1 精确目录等值门；已知基线只作为独立测试 oracle 和已知旧档兼容依据。

注册引用须带 kind。eventDef:relay-chain-001 在已有真实 EventDef 中核对；本包 eventChain 引用须有对应编译定义。未知 kind、缺引用、重复 ID、与已提交基础/扩展表冲突均整包拒绝，不能同 ID 跳过。

闭合语法只接现有 food_days、role_available、flag，以及 recordHistory、addResource(food)、adjustMeter(resonancePressure/campCollapse)、unlock(有限来源 flag)。未知字段、操作、authority 和未实现能力拒绝。选择和 fallback 均经过完整校验，不能以 validateContentDefinition 的基础结构检查代替安全检查。

有限藏粮必须有唯一 source、有限正预算、整局一次持久 flag；每条取粮路径都检查尚未取出、写入 flag、数额不超预算且历史来源/数量对应。重复 episode 和初始食物倍率不产生新来源。只声明 retrievalLimit 不足以证明不重复领取。语义校验拒绝资源凭空生成与多路径绕过；编译成功不代表平衡成立。

初片语法边界明确固定：包内最多 32 个互不共享来源/flag/history 身份的断粮型定义，每个只含一个节点、一个无奖励记录选择和一个受保护取粮选择；DAY/onDayStart、day1–13、survival/optional/repeatable 不改。source.food 与奖励为 1–100 的同值整数，共振/崩溃效果为 0–100 整数，food_days.max 为 0–1 的有限数；这些是校验范围，不是新平衡推荐值。每个定义的正整数版本随作者语义发布，当前编译最低为 2，已保存 active 版本仍必须精确匹配候选，不能从“大于等于2”推导旧档自动兼容。仅支持 relay 的既有外部 EventDef 引用；其他外部引用待有真实 consumer 再扩展。

真实效果执行器的 unlock 会按已注册 weapon ID 分流，因此“声明为flag”本身不能保证持久保护。准备时及提交前均须拒绝有限来源 flag 与已注册武器身份冲突；安装后保护信息随同一张表的私有不可枚举元数据提交，registerContent('weapon') 在写基础表或扩展表之前拒绝碰撞。其他正常注册继续工作。该约束保留原 unlock 执行语义，避免新包或后续扩展把一次性取粮变成可重复收益。

## 准备与安装

loadProgress 早于公开 start，保存校验、episode 适配和 draft 准备需要显式只读候选 lookup context。默认查询仍只访问已提交目录；纯准备阶段不能把候选目录塞入全局，也不能先注册再回滚。

先编译全部定义，在私有只读 eventChain 表完成基础校验、typed refs、冲突、保存内容版本和世界 draft 校验。全部对象构造与可能失败的工作在提交前结束，包括构造保留既有 registerContent API 的可写安装表；定义自身可以冻结，不能因冻结整张已安装扩展表造成旧 API 返回空成功。installSavedPayload 同步段一次替换 eventChain 扩展表，再安装已准备世界和既有 EVENT_DEFS 更新；不执行 reducer、RNG、存储或用户 callback。其他 kind、基础表和 buildInfo 不随之重置。

准备失败不安装世界或目录、不写奖励/绑定/时钟，不改原主档与备份。首存失败继续沿 C1 的完整安装后冻结待重试语义，保留同一 seed、资源、绑定与内容目录，不声称跨存储全局回滚。

## 初始绑定与内容版本

决定使用独立 snapshot.contentBinding v1，包含 status、compilerVersion、catalogDigest、rulesDigest 和 typed registry。FNV digest 是版本/一致性标识，不是认证；包与工件原字节 SHA-256 分开记录。

本片保持 schemaVersion1：C1 compact 作者包尚未进入生产，新编译器对其语法整包拒绝，不将旧包作为新包自动导入；兼容的是具有固定旧包身份的世界 snapshot。实际已编译语义由 compilerVersion 和 contentBinding 区分。未来若支持导入历史作者包或并存多个编译器，须新增包内显式 format/compiler 标识及适配，不能继续按对象形状猜版本。

新鲜 C2 的 initial binding 仍为 v1，events 改列 applied，而其他未接轴仍 baseline-only；其 package/config digest 按新鲜实际输入记录。已有 C1 的 initial binding、initialAiConfig、package/config digest 和 applied/baselineOnly 数组完整保留，不能追溯写成当时已编译。单独新增内容绑定及一次明确适配收据。

只接受冻结 C1 已知初始包身份，并核其原结构、初始配置、真实世界 seed/RNG 和作者 v2 规则等价；然后才能迁入当前编译目录。无 initial binding 的完整旧 writer 仍按 C1 legacy-unbound 政策保存真实旧 seed/声明，不伪造初始已绑定。未知旧 digest、future binding/compiler/catalog、定义冲突或无法匹配的 active 版本整份拒绝，原主档/备份保留，不 drop 链或重开奖励。

同语义 v2 迁入须原样保留 active 五元身份、节点/actor/startedAt、completed/applied/history、cache flag、日历、CP、NPC 生死/驻守、资源与随机进度。既有 v1→v2 受限适配单独保留；不借 C2 通用升级未来定义。第一片不做多版本内容共存。

## 六视角审查

| 视角 | 本轮必须成立 |
| --- | --- |
| 玩家 | 事项真实可见且金额对应实际效果；ration 保持无新增税，取粮和延期均保留原后果 |
| NPC | 健康、营地本地与后勤岗位 Gate 原样执行；不从 JSON 造人/补岗；choice 拒绝与真正 fallback 调用分别证明 |
| 营地 | 默认缓存总预算 2，测试包 1；唯一持久 flag 跨日/刷新守恒，原需求/配给不省略 |
| 势力 | 无新外交/信任奖励；中继真实引用与旧主线身份不变 |
| 敌人 | 共振仍是现有仪表效果，不能称产生实际暴露、索敌或刷怪 |
| 全局 | 同一编译定义经真实 hook/Choice/执行器/writer；候选失败无半注册，实例身份和旧事实可追溯 |

## 验收出口与回滚点

独立冻结 a2fc 作者 v2 定义作为默认语义与文案 oracle，不能从可变 JSON 同步生成 expected。另固定 TEST-ONLY v3：cache=1、forage=1、历史与可见提示一致；真实新开、相同 seed/初始 food0 经原 hook/公开 Choice 分别得到 +2/+1；不得装载 v2 active 到 v3 中。另以完整 near-midnight writer 经真实 advance 核日始 consumer，不能改 calendar 冒充跨日。

批次先合法再非法，分别测重复、未知 Gate/op/ref、预算、flag、无 fallback、循环/next；逐域核已提交表、EVENT_DEFS、其他 kind、state/RNG、存储原字节与 timers，不留第一项或新收据。测已有 base/extension 冲突、正常首存/失败重试、完整旧 writer、C1 bound 迁入/未知拒绝、跨 episode 和 reload 去重。源码 VM、纯核心、真实浏览器与自然路线分别记录，不由 C1 绿色推导本片完成。

最终源码冻结后已运行受影响既有合同及 exact HTML/package/runner 的实际浏览器验收；原失败保留。回滚点为冻结 HEAD 982ab863 的源与证据；此决定不授权覆盖生产，开发发布另核精确来源和 CI。完成状态以本轮 QA／manifest 的声明范围为准，不能从一个合法包推广到任意内容图。

## 实际验收与保留边界（2026-10-17）

源码 a544a6139e19c21f89526e3aafed11162d885552／HTML61ea64b27a65cc4a271c214c16126b40a453eae40c8684c106bc8edc89e5f115。最终40 unique源码合同均有通过结果，123次执行为108 pass／15次原fail保留；列明 pure14／C1 source120／C2 source66。源码真实公开 start／loader／Choice／writer 覆盖默认作者 v2、独立 TEST-ONLY v3、跨 episode／午夜和已知旧 writer；它们与浏览器证据分层，不能把派生近午夜输入称为自然生成。

实际 Chrome C2 六场102／102：canonical新局与reload、v2／v3各自原生active完整writer后的公开取粮与去重、已知C1一次内容迁入、未知内容身份保主备拒绝、晚项坏包公开开始拒绝。主文档为5 canonical＋5独立variant；另NPC112／农务35／断粮72／rest93／presence37／episode12合计361／361，55次主文档均canonical。全部errors0，原生writer／HTTP／runner／input原件在[C2 QA](../qa/scenario-boot-c2-20261017.md)分别索引。

本片没有新natural run；真实Chrome跨午夜并非新C2六场覆盖，源码与关联休整／驻守夹具按各自范围报告。休整只有六场verified，trusted hidden unavailable。闭合的一节点两终态选择语法、staged registry和known-C1 contentBinding adapter已接受；任意图、Studio、多版本目录和额外配置轴保持未来范围。最终证据HEAD的exact CI仍pending，不声明ref更新或生产部署。下一为actor／perception授权，再接NPC规划／记忆／LLM表达；readonly expression不构成该授权。

