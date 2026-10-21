# ADR：岗亭人工哨报首片

状态：合同采纳，manual 已接入 ad762 开发候选；本片独立源码、最终既有矩阵、关联episode与受控Chrome的实际范围见 [QA](../qa/watchpost-manual-v1-20261018.md)及[选中证据](../qa/evidence/watchpost-manual-v1/)。开发ref／精确CI独立核对，生产未部署；选中归档不包括全部外存原件。

冻结候选 HTML SHA-256 `ad7627a94ccced73b1ec7222501c13558deb4dd48ebb22ede980cfbf6bd3f65a`，984373B；作者 JSON SHA-256 `b2d196a171d3a4e828d8486c36ea664992e51fd8df1223ea395172a511b869e3`。稳定开发交接见 [watchpost-003](../scripts/watchpost-003.md)，L0 仍以现行 03/04 总图为准。

## 玩家结果与首片范围

已发现、接管且由同一健康守军实际驻守、维护有效的岗亭，可提供弱于中继的独立预警准备。manual 确认追加材料0、世界分钟0，表示协调已在岗守卫；原接管6体力／30分钟、固定人口机会成本、据点额外1粮／日及守军原配给全部保留。不增加人口、trust、CP、火力、侦察半径或关系奖励。

manual 只影响之后新建遭遇的起始接近，不解除 DAY 敌人追踪，不改变休息危险 Gate、追踪中断、伤害或世界时间。旧公开中继 pilot 的停止不能作为本片收益或平衡缺陷的因果证据。overload 的材料、共振代价与额外战斗收益延期，当前没有占位按钮、收费或升级历史。

## 权威包、实例与完成

作者源为 `content/packs/watchpost-manual-v1.json`；`scripts/build-scenario-package.mjs` 只同步这一内置包的嵌入定义并以 `--check` 对账。它不是 C2 通用图编译扩展。运行时在原 `prepareScenarioContent` 私有候选表校验后，通过既有一次指针提交挂载。定义不随存档保存；缺包不执行本链或授予当前能力，保留合法历史并记录缺包。

链 ID `watchpost-003`，definitionVersion=1，repeatable=false；节点 `manual_preparation`，choice `manual`，配置 flag `watchpost-manual-prepared`。仅此新一次性链 opt-in 五元实例 token：`instanceKey=watchpost-003:once`、`instanceId=content:watchpost-003:once`、defId、definitionVersion、nodeId。完成始终查写 `completedChains` 的数组成员 `watchpost-003`，不以 `:once` 代替完成键。

公开按钮、命令、choice／自治／fallback、回放与 writer 透传同一身份。新 command 缺失、未知或 stale token 拒绝；CommandBus 先去重已经执行的 command。成功效果、配置、完成与来源收据在同一真实结算链稳定；失败不留配置或奖励。旧一次性链与 repeatable episode 不整体迁移。

## 当前能力与公开权限

`watchpostWarningCapability` 纯读配置及当前物理事实：包已挂载，唯一已发现且身份合法的岗亭，authoritative outpost 为 secured，恰一有效守军，同一 NPC 反向驻守与实际跨据点占用一致，lifeState 为 healthy 且 HP 为有限合法满值。查询不 ensure、不派人、不修复、不写事件或 RNG；未知和矛盾不授增益。

新捕获的人口／岗位 Gate 保持。其它人口减少不自动让已经在岗的健康哨兵失去服务；旧 actingRole／contentJob marker 单独存在也不证明跨地同时劳动。驻守者仍计 livingRoster、吃原配给，退出本营劳动与援防，沿 [presence 合同](ADR-20261017-outpost-presence-v1.md) 执行。

当天维护支付后库存降至0，不追溯停岗。strained 当日补粮不立即复活服务，须等下一次真实 upkeep 支付恢复；合法健康恢复／重新接管可恢复已有配置，不再次确认或发奖。

公开确认提交时重核 DAY 有效会话、同一岗亭≤1.25格、健康与维护；UI 与提交共用真实 `outpost_ready`。内部日界自治可以免玩家在旁，但公开 options、actor 或 source 字符串不能取得私有 Symbol 权限。夜战、终局、stale 与越距在效果前拒绝。

## 时间窗、报告过渡与过期

d2–8 的发现、接管与日界尝试启动待办，d1已发现者可在d2启动。旧窗内 DAY Continue 与旧 REPORT 实际关闭回 DAY 均进行窄的待办 reconcile；不因此免费配置或重放日界。

d8唯一自动准备点是实际 `onDayStart`，在原 `applyOutpostUpkeep` 之后，仅对活跃且当时健康、维护有效的本链结算一次 camp-autonomy manual。资格不足保留待办，玩家可在d8补齐后公开确认；晚接管或关闭报告不补跑晨间自治。

d9起未结 active 实例只走一次 `ifExpired -> watchpost_damaged` 故事及原因；不授 manual，不制造建筑 HP 损伤，不删除岗亭或守军。已完成配置过窗保留，当前可用性继续由真实健康／维护决定；旧d9+从未建本链者不补奖或编造过期。

9d2f 原候选在旧d2／d8报告关闭后同一 DAY 会话漏建待办，原固定方法2例实际失败；ad762 已在合法 REPORT→DAY 过渡调用同一窄 reconcile。原失败保留。这是同会话入口缺口，窗内重新 Continue DAY 可绕回，不称永久 softlock。修复不重复配给、upkeep 或报告奖励。

## 真实消费者与锁定

有效 relay > 有效 manual > 营地观察。manual 预警使用 `source=watchpost-manual`、leadMinutes=60、常规 eastern-breach 通道；60是能力参数，不是自然游玩中已测到的提前时长。confidence 沿原非中继估计，不造新的准确率。

新 `startThreatEncounterReducer` 无中继时取 `min(原startProgress,1)`，原广播 guard=0 保持0；正常营地3才降至1，每敌 `(i%3)*4` 间距保留。中继路线、敌数、防御、HP、速度、伤害不变。

可用预警来源与实际决定 startProgress 的来源分别保存；广播警戒已给0时说明岗亭没有额外叠加。新遭遇创建时锁定来源与实体输入，后续伤病、维护、修复或 Continue 不重算该场；旧锁定遭遇不补写增益。

## 收据归因与原中继边界

纯营地↔manual 预警变化使用 watchpost def／once instance 和 forecast-only effect，保持真实父 causation；它们不进入 `relayLatestEventId` 的 relay def／project instance 筛选，不能借记成中继上线或使其 CAS 因纯岗亭变化失效。

真实 relay 进入／退出（包括 relay→manual）保留原 relay 身份，继续使旧 relay CAS 反映真实中继转换。原 `relayEventMeta('online')` 在退出时仍携带旧 online 效果描述；4f已有此语义，本片未全面规范所有 forecast 元数据，也不以其描述推定物理中继已上线。实际 completion 仍由原 `relay.stationOnline` 与项目／建筑事实决定。

配置不是个人见证，有限 worldEvents／history 不是永久自传。当前 guard 不能回填过去接收者、个人记忆或未授权敌情；Observer／LLM知识权限保持原边界。

## SAVE21 与已核范围

保持 SAVE21／CONTENT3 加性范围：旧缺 flag 为未准备，不从 found／secured／relay 历史回填；新 active 具有 once 身份和 targetLandmarkId；新战斗 preparation 快照可选，旧 battle 缺该字段仍保原输入。正常 writer 在 reload 前写入最终配置／完成／预警收据，再核同份 selected／Continue／新 tick 去重；pagehide 不替代正常 writer 观察。

同 ad762 的独立源码为8组／8组，另以未改变的原复现方法核旧 REPORT→DAY 2例／2例；后者与8组中的恢复检查重叠，不合称10个独立功能合同。真实 Chrome 为24项manual＋28项原维修关联回归＋20项面板，共72项；7次 main document 响应同 ad762，三套终态 exit0、errors[]、cleanup全true。24项manual覆盖公开确认、strained禁用、正常 writer／selected／Continue／新 tick；20项面板覆盖桌面／390宽当前、历史、成本与锁定文案；其余身份／健康／自治／过期／构造边界由源码夹具按各自范围证明。源码与 browser 都是明确受控输入，不称自然路线或真人理解验收。

最终既有48矩阵与关联episode12已在ad762分别实际终态通过，来源及精确提交见QA；不移用旧9d2f绿色，开发ref／精确CI另核。生产未由本 ADR 发布。完整中继公开主线、自然三日、玩家体验、overload、14天最终尸潮、完整 Actor／Planning／Memory／Social、Studio、更大世界／多副本、UI素材与GameCore／引擎目标继续开放。无新增全局记忆。
