# ADR：断粮选择 v2 与已知旧实例适配

状态：accepted并已完成列明source与fixture-browser验证，见本轮QA；SAVE21／CONTENT3不变。2026-10-17。

## 来自真实基线的决定

[受控四策略实验](../experiments/EXP-20261017-food-shortage-strategies.md)在冻结32f911构建从同一day1 23:20／food2／十人／未用藏粮出发，到首次午夜：立即ration比保留待办多2崩溃，食物、玩家HP、体力、共振相同。清除待办可以有界面价值，但不足以支撑额外崩溃代价。地图采集与抽象藏粮的成本不同，而且原30分钟采集批处理与逐分钟等待产生不同NPC／敌人轨迹，不能把它当作完整平衡对照。

采用剧本设计师的最小改稿，不以新的忽略惩罚逼玩家选择：事件的问题是“现在用两份有限备用粮，还是保留它另行筹粮”。

- 保留技术ID `ration`，显示“保留备用粮，另行筹粮”。只写确认历史，不改变食物、崩溃、SAN、配给量或人物需求；真实口粮不足继续按原规则结算。不是配给改革，也不宣称这是对称的战术收益。
- `forage`保持食物+2、共振仪表+2、健康有效后勤资格和整局一次的永久flag。不增加真实旅行／离岗／敌人spawn，也不把共振当作已接线的敌人暴露。v2新历史字段使用 `resonancePressure`；旧 `exposure` 历史原样保存。
- 面板显示当前库存、基础日需、下一午夜配给和个人用餐／据点维护另计。`food_days>1`时明确这是原预警、当前基础供给已缓解；原可选episode仍可确认／取用，不新增库存choice Gate或自动结算。
- 窗口仍是day1–13；day14原身份过期ledger-only。午夜是既有配给压力的时间点，不新增点击期限或拖延罚款。关闭面板仍不是内部skip。

## definitionVersion 2 与旧档

改变选择行为须升为definitionVersion2，不能仅改version1的含义后假称旧token仍同义。当前是单版本lookup，因此增加仅针对本链的显式适配，不声称有通用多版本注册器。

已声明v1 active必须是本链 `shortage_choice`、未结算、合法创建时间／actor、完整一致的episode身份，且没有同episode完成、效果或历史冲突。缺版本的真实旧shape另识别为legacy-missing-version；不能把其来源伪造为已知v1。未知声明版本、畸形或已经结算的legacy active继续拒绝，不重置到安全新事件。

校验和draft准备必须纯：不改原输入／全局state／RNG／registry，不发迁移或选择收据。准备阶段只在独立candidate中补合法旧identity并把定义版本升2；保持instanceKey／instanceId／defId／node／startedAt／actor、人口、资源、历史、completed、appliedEffects、藏粮flag与时钟事实。

现有 `save.migrated` 容器在实际公开开始／安装成功后记录一次 `contentDefinitionAdapters` 元数据；刷新后的writer已是v2，不重发。旧按钮v1 token拒绝，真实renderer再绑定v2 token才可操作。它不是自动帮旧命令换token重试。

已结算v1 ration的+2、v1 forage历史exposure和永久flag保留，不退款、不补奖、不重开同日。非本链和未知版本维持原保存校验。迁移不推进日历，不伪造历史选择。

## 六视角

| 视角 | 合理性与限制 |
| --- | --- |
| 玩家 | 可现在动用备用或留到以后，另行筹粮承担真实地图劳动成本；确认不再额外惩罚，库存提示随事实更新 |
| NPC | 真实健康／岗位／地点决定后勤资格；未实现外出队伍就不描述离岗，人口与需求继续 |
| 营地 | 两份粮来自唯一有限来源；基础配给、个人用餐和据点维护各自结算；确认不等于产粮 |
| 势力 | 不制造援助、交易、信任或关系收益 |
| 敌人 | 地图行动承担实际感知／运动／伤害；共振只作为已有仪表和计划倾向，不包装成即时敌人代价 |
| 全局链 | 可延期并继续主线；身份、历史、幂等和缺岗fallback保持，已补粮不偷偷刷新episode或藏粮 |

## 出口

独立source测试以完整真实v1 writer／pre-identity fixture／已结算A与B／补粮C为输入，核纯draft、一次迁移、旧token、坏legacy／未知版本拒绝、历史不变、v2选择、实际renderer和同起点A/D午夜对照。冻结旧32运行同checker作为失败控制，不能改旧report。

真实browser至少验证v1待办boot→新提示→公开保留或取用→writer→reload，另核已补粮提示与无法再取缓存。已有rest／presence／episode／replay／static等受影响回归在新HTML重跑。自然混合路线按其实际source分别记录；旧32的新档试玩不迁移成新构建通过，完整三日／平衡／生产仍另验。

场景JSON fixture同步v2选择与元数据，仅为headless／注册定义对账；此处没有完成真实Scenario boot。任意大步与小步全面等价、采集回执目标缺失、零粮计划优先级词值问题分别记录，不借本改稿宣布已修。
