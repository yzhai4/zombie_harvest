# ADR：ScenarioPackageV1 的真实启动与配置绑定

日期：2026-10-17。**状态：proposed / 未接线。** 本文约定下一最小切片，不代表当前运行时已经具备 Scenario loader。对应问题见 [PROB-20261017-scenario-stored-not-bound](../problems/PROB-20261017-scenario-stored-not-bound.md)。生产 Sites v81 不因本提案改变。

## 当前事实与反例

只读源码路径为：内联 `state` → `INITIAL_PROGRESS_STATE` → `loadProgress` / `prepareSavedPayload` → 公开 `startFromSave` 安装 fresh 或恢复 draft。没有调用 `scripts/lib/scenario-package-v1.mjs`；断粮仍由内联 `SCENARIO_RUNTIME_STORYLETS` 注册，包 JSON 没有成为启动时的运行时来源。

- `createScenarioSnapshot` 缺 `schemaVersion`，其结果直接交给真实 SAVE21 validator 会以 `scenario-snapshot` 拒绝。
- package validator 接受顶层 `ai.policies.observer.authority=write_state`、未知 trigger/effect 和无效 `retrievalLimit`。它只检查 storylet 的一个 expression authority 路径；包尚未执行，因此这不是已触发的写状态漏洞。
- 未知 difficulty profile 保留未知名称却使用 standard 数据；`Number(value) || default` 将合法零值吞为默认值，负 seed 也可进入 resolver。
- `scenarioSnapshot.seed` 只被保存；真实随机流读取 `worldMeta.rngState`。food/medicine/material/enemy/wave/event/population 配置只在常量与 normalizer 出现，没有运行时绑定。
- SAVE21 仅检查 `aiConfig` 是对象，允许未实现的 AI flag 和未知 authority 字段。`registerContentPack` 逐项修改注册表，后项失败会留下前项。

已有三个 package 测试只验证 valid/hard/custom 字段结果。源码 VM、旧 writer 浏览器夹具和公开三日日历回归都不能替代上述启动接线。

## 提议的最小完整范围

继续使用确定性 GameState / reducer；不增加编辑器、引擎迁移、LLM、Director 或 learned World Model。按[调研 P0–P6](../qa/deep-research-baseline-20261017.md)先实现可追溯的 seed/config 与一个数据驱动 storylet。

同一纯核心负责 `validate → resolve → compile`，Node 与浏览器运行时保持实现一致。构建时将经过验证的版本化 JSON 包嵌入部署产物并核对来源字节；真实 boot 读取它，不能在测试里调用 resolver 后声称 boot 已执行。第一版只将断粮编译为完整 EventChainDef；中继用带 kind 的外部引用（`eventDef:relay-chain-001`），避免把 EventDef 与 eventChain ID 混为一类。

### 支持矩阵（提议，实施后逐项验收）

| 配置 | 本切片承诺 | 非支持请求 |
| --- | --- | --- |
| scenario/schema/content/game 标识 | 仅接受已登记、兼容的精确版本与 ID；生成可通过实际 SAVE21 writer/validator 的 snapshot | 未知或未来版本明确拒绝，不改写成当前版本 |
| `seed` | uint32，包含 0；新局一次性初始化 `worldMeta.seed`、`rngState` 与 `replay.seed` | 字符串、负数、非整数、溢出或非有限值拒绝 |
| `world.foodMultiplier` | 提议 0–2；仅在新局对作者基线食物库存和初始 berry 的剩余采集次数各乘一次并向下取整；0 保持耗尽事实 | 不作用于每日配给、作物产出、补生资源、事件藏粮或旧存档；范围外拒绝 |
| `world.ordinaryNpcCount` | 只接受基线值 10；该旧名称表示固定起始 roster 总数，不据此声称十人全为普通 NPC | 其他数量拒绝，不删人、补人或生成缺失岗位 |
| medicine/material/initialEnemy/waveGrowth/eventFrequency 倍率 | 只接受基线值 1，并标记 baseline-only | 非默认请求返回 `unsupported-config`；未接线的 hard preset 不可偷偷按 standard 运行 |
| `observerCommentary` | 只控制已实现的纯表达路径；AI-OFF 完整可运行 | 不授予状态写入、actor 权限或额外感知 |
| dialogue/generatedWorldEvents/learnedWorldModel | 必须为 false | true 或未知 capability/authority 拒绝 |
| continuity | 描述信息可登记为 deferred；不执行 import 或宣称记忆导出已可用 | 非空运行时 import/未实现导出请求拒绝 |

倍率的具体上限与初始食物语义是本提案的产品选择，尚非平衡结论。若决定改用别的首个实际配置轴，先更新本矩阵与负控，不让 `foodMultiplier` 暗含“所有未来粮食都放大”的承诺。

snapshot 持久化包 digest、binding 版本、实际 applied keys 与 baseline-only/deferred keys。保存成功只证明配置被记录；验收必须另证实际 consumer。digest 对规范化内容稳定，并与原包文件 SHA 分开记录；不依赖对象键插入顺序推定配置相同。

## 启动顺序与原子性

1. boot 从部署产物读取唯一包；校验完整 JSON 类型、字段、版本、typed refs 和全部 authority，随后解析所选 profile / 覆盖项并核对能力矩阵。
2. 将 storylet 编译为可被现有 ContentRegistry 接受的完整定义，包括标题/节点、phase、hook、Gate、Choice、Effect、fallback、有限来源与 repeatable 合同。移除对应手写旁路，不能靠同 ID 已存在就跳过注册。
3. 在独立候选表中检查所有定义、外部引用、稳定 ID 冲突与可达性，全部通过才提交注册表。任一失败不留下部分注册、世界变更、计时器或存档写入；显示明确原因。
4. 公开新局入口用已验证包创建独立 fresh candidate，应用受支持的初始配置与 seed 后再安装、启动模拟并保存一次绑定事实。不得先开世界时钟再异步补配置。
5. 继续/备份恢复使用保存配置及匹配内容目录，不复用当前新局覆盖项。PLAYTEST/fixture 模式单列，不能代替正常 boot。

静态校验至少拒绝未知 Gate/Effect、缺引用、重复 ID、缺 fallback、明显矛盾的已支持门槛、无终点且无安全出口的无界环，以及有限来源奖励超过声明总量。可重复环必须显式具备 episode/预算出口。第一版不承诺判定任意逻辑条件的可满足性；超出支持条件直接拒绝，而不是猜测为 true。

authority 校验覆盖所有 `ai.policies.*` 与 storylet expression 路径，只有已注册的 `expression_only` 可通过；未知 authority、`write_state` 或没有 AI-OFF 路径的请求 fail-closed。soft policy 不能改变此白名单。

## SAVE21 与旧 writer 兼容

真实完整 SAVE18、pre-snapshot SAVE21 和已有 snapshot SAVE21 分开验收。缺旧字段是兼容入口；显式损坏、未知未来版本或冲突 digest 不是缺省。

- 缺 snapshot 时补 `legacy-unbound` 来源描述，从旧 `worldMeta.seed` 记录原随机种子，保持已保存 `rngState`；不能将当前默认 seed 伪称旧局 seed。原资源、人口、伤亡、时间、账本和命令水位保持。
- 已有 snapshot 继续使用其保存配置与已保存随机进度；不重新乘倍率、不补当前初始库存、不复原耗尽资源或藏粮 flag。无法确认旧 metadata 是否曾生效时保留“未绑定”，不追溯重算。
- 新局 seed 0 必须贯穿 replay；使用空值判断而非 `seed || WORLD_SEED`。继续存档绝不以 seed 覆盖 `rngState`。
- 旧档曾允许保存未实现 AI flag 或未知字段；实现时明确采用拒绝恢复或记录兼容降级，不能默默宣称已支持。拒绝保留原主档/备份字节并提供原因，不自动重开或混档。
- 新 binding 字段按显式增量合同纳入 validator、writer、投影与迁移；保留非重复旧链与旧 replay golden。迁移仅写一次说明，不执行 storylet、发粮、扣代价或补人物功绩。

## 验证门槛与停止条件

必须执行实际内联 boot/loader/registry/reducer 与 writer；不能只比较 resolver 返回字段。

1. 空存储经公开新局函数启动，JSON 编译的断粮确实经 hook、Choice 与 reducer 执行；受控改变包效果后运行结果随包改变，证明没有硬编码旁路。
2. 生成 snapshot 能经真实 writer/validator/save/reload；相同 seed/config/时钟/命令序列得到相同 RNG、事实与 hash。已知随机分支可展示不同 seed 的实际影响，不能要求任意两个 seed 每次都产生不同结局。
3. 验 seed 0/maxuint32、非法 seed、food 0/小数/边界的实际新局库存与有限 berry 次数；默认配置保持既有玩法，不意外影响未来食物来源。
4. unknown profile、非默认未接线配置、任一路径未知 authority/Gate/op/ref、重复 ID、无出口环/无 fallback/越有限来源均拒绝；中途失败不残留首项注册或写保存。
5. 完整原 writer 旧档逐域核对；reload 不重 scale/reseed、不改人口/资源/伤亡，当前默认包变化也不重算已保存世界。未来版本与不兼容 digest 拒绝且原主/备份字节不变。
6. AI-OFF/ON 在同一规则输入下规则事实相同，仅表达不同；记录 applied/baseline-only/deferred 信息和拒绝原因。

通过源码合同后，冻结 exact HTML/包/runner 字节再做正常新局与旧档浏览器 smoke。fixture-browser、公开行动日历回归、自然体验和平衡分别报告。`server-three-days.py --strict-fresh` 使用兵营训练推进，属于单构建全新公开行动回归；自然时钟间隔证据不把整个训练路线变成自然游玩。即使该 runner 通过，也不满足本 ADR 的 loader 验收。

任一原子性、旧事实保持或未授权能力负控失败，停止扩大配置面与后续 AI 功能，保留失败并修复。本文只有在实现、exact 证据及上述门槛完成后才能改为 adopted；目前没有接线或发布批准结论。
