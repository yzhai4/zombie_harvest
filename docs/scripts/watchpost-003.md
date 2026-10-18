# 岗亭人工哨报（watchpost-003）

状态：manual 首片已接入 ad762 开发候选；独立本片源码8组、重叠恢复2例、最终既有48合同与受控Chrome72＋关联episode12项均有实际终态。来源、开发ref／精确CI和发布边界见 [QA](../qa/watchpost-manual-v1-20261018.md)及[选中证据](../qa/evidence/watchpost-manual-v1/)；生产未部署，外存原件不称完整归档。

## 来源与交付边界

设计源为 L003 [主线总图](../../剧本/尸潮农场/03_主线事件链总图.md)、L004 [支线总图](../../剧本/尸潮农场/04_支线事件链总图.md)，稳定状态／权限合同见 [manual ADR](../decisions/ADR-20261018-watchpost-manual-v1.md)。本卡承接 manual-only 首交付裁定，完整 overload 设计延期。

本片给已合法接管的健康守军一个弱于中继的独立预警 consumer。它不是 DAY追踪、休息或危险中断修复；旧中继 pilot 停止不计作岗亭收益。它不补完中继主线，不增加护送、远端战斗、个人记忆或势力关系。

作者 JSON 为 `content/packs/watchpost-manual-v1.json`（schemaVersion1／packVersion1）；`scripts/build-scenario-package.mjs` 同步该内置包，`--check` 对账嵌入字节。仍沿原候选目录一次提交，不扩 C2有限断粮编译语法或引入第二事件系统。

## 稳定标识与运行映射

| 项目 | 当前合同 |
| --- | --- |
| 包／链 | `watchpost-manual-v1`／`watchpost-003` |
| 定义／节点／选择 | definitionVersion1／`manual_preparation`／`manual` |
| 窗口 | d2–8，optional，repeatable=false |
| 成功配置 | `contentState.flags['watchpost-manual-prepared'] === true` |
| 实例身份 | `watchpost-003:once`／`content:watchpost-003:once`＋def／version／node五元token |
| 完成键 | `completedChains` 数组成员 `watchpost-003`，不写 `:once` 代替 |
| 真正效果入口 | renderer token → `resolveContentChainCommand` → CommandBus去重／CAS → Gate → `applyContentEffects` |
| 当前能力 | 纯 `watchpostWarningCapability`；不保存另一个online布尔 |
| 下一场消费者 | `updateRelayForecast`／`watchpostPreparationSnapshot`／`startThreatEncounterReducer` |
| 保存 | SAVE21／CONTENT3 加性字段；旧缺配置不回填 |

## 玩家承诺、费用与替代选择

玩家先探索并通过原接管入口安排守军，再靠近同一岗亭，在事项中确认低噪人工哨报。也可关闭事项、先补粮或继续中继，不要求立即选择。

| 因果 | 真实成本／结果 |
| --- | --- |
| 原探索 | 保留原一次性奖励与20分钟，不由本链重发 |
| 原接管 | 6行动体力／30世界分钟，派现有守军，保原人口与岗位 Gate |
| manual确认 | 追加物资0／世界分钟0，协调既有守卫，不称完成新安装劳动 |
| 据点运营 | 额外1粮／日，守军另按原共享库存配给与需求结算 |
| 机会成本 | 驻守者仍是固定livingRoster，退出本营劳动、现场福利与援防 |
| 新准备 | 普通起始3→1，弱于relay；广播警戒0保持0，不额外叠加 |

不新增人口、trust、CP、资源、火力、射程或共享视野；不收费以“安装哨灯”名义补造劳动。overload 不显示占位按钮，不预写升级flag或费用历史。

## 触发、资格与降级

发现、原 `onOutpostSecured`、真实 `onDayStart` 和窗内 Continue 尝试创建一次待办。旧 REPORT 在公开关闭并合法返回 DAY 后也调用同一窄 reconcile，不重放日界。完成或已有active不重开。

公开确认须同一合法岗亭≤1.25格、DAY有效会话、真实 secured维护和健康守军。UI常驻说明与提交共用 `outpost_ready`；缺失／stale／unknown token、夜战、终局、越距或物理资格不足在效果前拒绝。低信任确认已经合法接管的岗亭，不取得英雄调度权。

持续能力核唯一已发现且ID／坐标合法的岗亭、恰一有效守军、authoritative记录和反向marker一致、没有实际双据点占用、健康且HP合法满值。纯查询不修状态、不ensure、不补人、不派岗、不记日志或用RNG。旧 actingRole／contentJob marker单独存在和无关人口减少不自动否定既有健康服务；新派驻的人口／岗位限制保持。

| 分支 | 当前结果 |
| --- | --- |
| 未发现／未接管 | 保留待办，说明先探索／原接管，不免费安排守军 |
| 伤病／死亡／缺席／真实脱岗 | 配置历史保留，当前manual不可用；不补人或远程治疗 |
| 当天已支付维护后food0 | 服务不追溯关停 |
| strained后当日补粮 | 仍停，等下一次真实upkeep支付后恢复 |
| 合法健康／重新接管恢复 | 既有配置恢复服务，不再次确认或发奖 |
| d8真实日界 | 在原upkeep之后，仅活跃且健康维护有效者自动manual一次，可免玩家在旁 |
| d8晚接管／报告关闭 | 不补跑晨间自治，仍可在有效窗口公开确认 |
| d9未结active | 一次 `ifExpired -> watchpost_damaged` 故事及原因，无能力、HP损伤、地标或守军删除 |
| 已完成过d8 | 保配置／完成历史，当前服务仍看真实维护与健康 |
| 旧d9+从未创建 | 不补奖、不编造过期 |
| 缺包／矛盾／未知 | 不授能力、不猜历史；缺包日志与原合法事实保留 |

d8自治权限由可信真实日界的私有Symbol提供；公开options、actor、source或公开runHook文本不能免除玩家距离。无守卫等 fallback 只记账，不制造安装或哨报；本片公开确认只有manual一种，关闭事项不等于主动结算fallback。

## 遭遇输入、来源与信息权限

优先级为有效relay→有效manual→营地观察。manual forecast标为 `watchpost-manual`，leadMinutes60是能力参数，保持常规eastern-breach与原非中继confidence；不称已测到自然提前60分钟。

新遭遇无relay时取 `min(原起始progress,1)`；原radio-guard=0不变，敌人间距、数量、HP／速度／伤害、防御和relay西侧路线不变。新快照分别记availableWarningSource和effectiveStartSource。锁定后健康、维护、relay变动或Continue不回退敌人、不重建该场；旧战斗不追溯补准备。

纯camp↔manual的forecastChanged按watchpost定义／once实例和forecast-only effects归因，不污染relayLatestEventId／CAS。真实relay进入／退出（包括转manual）保原relay身份；原online效果描述在退出路径的legacy语义仍在，不宣称本片已整理全部预警元数据或物理relay已上线。

UI分“当前能力／准备历史／本场锁定”，常驻原因放disabled控件外。配置不是个人见证；不从当前guard推过去接收者，不扩Observer／LLM的授权knowledge或隐藏世界读取。

## 六视角账本

| 视角 | 本片事实与保留边界 |
| --- | --- |
| 玩家 | 可确认、延期、补粮或继续中继；成本与较弱收益可读，不保证安全或休息可用 |
| NPC | 同一健康实驻守者承担服务，仍吃饭与更新需求；不隔空援防、劳动、治疗或取得个人记忆 |
| 营地 | 固定人口与新捕获Gate保留，维护额外1粮与个人配给分账；真实短缺／伤病停止当前服务 |
| 势力 | 营地内部准备，不产生外交、援军、关系或共振奖励 |
| 敌人 | 只改新遭遇起始接近；不解除DAY追踪、不删敌、不弱化实际伤害；锁定输入保持 |
| 全局链 | once身份与链完成键分离，d8自治／d9故事过期可追溯，不伪造relay完成或终局 |

## 兼容与证据边界

正常writer须在reload前已有最后配置、完成和forecast收据；真实validator、selected、Continue与新tick核同份raw，不用pagehide补救。旧完整writer缺flag即未准备，发现／secured／relay历史不能回填配置。旧battle无preparation字段仍保原事实；新可选字段经实际writer／loader验证。

ad762（HTML SHA-256 `ad7627a94ccced73b1ec7222501c13558deb4dd48ebb22ede980cfbf6bd3f65a`）已实际独立核：

- 源码8组通过：包／旧DAY、纯资格、真实维护、身份／拒绝／事务、d8／d9、shadow范围、真实遭遇与锁定、旧d2／d8 REPORT关闭。
- 原未修改复现方法另2例通过，与8组恢复覆盖重叠，不相加成10个独立合同。9d2f原2例失败保留；窗内再次Continue DAY可绕回原入口缺口，不称永久softlock。
- Chrome24项manual＋28项既有维修回归＋20项面板＝72项，7次main同ad762、终态exit0、errors[]、cleanup全true。manual正常writer先于reload，面板覆盖1440／390；该合计不是72项全新岗亭功能。
- 内置JSON与嵌入结构／build --check对账只证明构建一致，既有48矩阵与关联episode12已实际完成；精确CI与开发发布按各自实际服务终态核对。受控source／Chrome夹具不代称自然三日、完整公开中继路线或真人收益。

最终QA须安装每份原报告、方法／输入／normal writer／截图的SHA与原失败索引；实现和证据源变化后按影响重绑，不移用9d2f绿色。新内容回滚恢复兼容代码与保存备份，不单降SAVE号、不退款或重算真实人口／资源／伤亡／日历。后续overload、自然路线、完整中继主线与长期Actor／Planning／Memory／Social、Studio、大世界、多副本、UI与引擎目标保持开放。无新增全局记忆。
