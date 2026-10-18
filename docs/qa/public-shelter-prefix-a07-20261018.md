# 公开庇护入口与危险拒绝：A07

2026-10-18。沿实际正常存档继续的有限公开玩法前缀，不是从头自然路线、真人理解或完整中继验收。冻结基线是开发head 1e6114ececc50e630c51c2eb3bba4e5ca87cbb10／精确CI311成功；运行时仍为源码97f2ccf9、HTML 2fca005df63742164bd6f6e8e82fc0c2d3962b4678419b633482f8a54e09ef93，SAVE21／CONTENT3不变。本轮只增加方法与证据记录，不修改游戏、IterationManifest、危险规则或存档schema；发布head／新CI以PR #4的最终收据为准，main未合并、生产未部署。

## 玩家实际获得了什么

从A06的真实正常writer613／seq356／cmd951继续，先捕获新boot，再沿曾公开看到的草地有限移动。7段实际键盘输入把玩家从HUD9.1,7带到9.1,9.3；不是使用隐藏实体坐标。原先只凭黄色外观猜测的候选，现场出现了休息、恢复行动体力、配置武器的建筑说明和30／60分钟等候控件。标题仍为“建筑 · 可管理”，正式名称尚未清楚表达。

现场30／60分钟按钮均disabled，按钮外可读原因是“暂不可等候：附近存在威胁”。001截图为10:21，能力采样较早为10:20；末图10:34仍如此。没有按禁用控件、提交休整、支援、F或进食，不算一次失败的30分钟请求，更不算完成休整。外部保守safety也未在这个未提交分支实际执行。

本轮没有打开工程面板。QA正常writer确认中继仍为staging、材料8木／5件／2石、工时0、实体未启用；库存没有新增工程支付。不能把这些只读账本数称为本轮公开工程页验收，不能把A06已投入材料归因A07移动。

## 实际执行与恢复边界

唯一游戏进程Node17096，实际terminal exit0，launcher33.359秒；活动段28.390秒。两次main响应均为同一2fca且HTTP200，pageerror空，context／browser／server均已关闭。SESSION_PROOF_COMPLETE只表示本方法范围完整，不代表休整、工程或主线完成。

| 保存阶段 | 实际水位与身份 | 范围 |
| --- | --- | --- |
| 输入正常主档 | 613／seq356／cmd951；100b89b5…；FNV380e00d | A06真实writer，未补资源；此前已见614，回退至少1分钟不退款 |
| reload前正常writer | 623／seq367／cmd984；ca027743…；FNV6b1f30b0；world-tick | 普通写盘原件 |
| loader实际selected | 623／seq367／cmd984；a9bbe310…；FNV455aa9fd；primary／visibility-hidden | 原raw与payload均已捕获；与前一writer不是同raw／同payload |
| Continue与新tick | 实际DAY安装，evt368／624 | 安装与后续推进分别成立；不重新发核心交付或上线奖励 |
| 新tick正常writer | 633／seq398／cmd994；2fb0b332…；325551B；FNVe99ca997；world-tick | 与004-final-native同字节；已测项目／本人交付事实保持，不宣称全payload不变 |

整个恢复段17.164秒／12世界分钟，仍在原20秒／16分钟范围内，没有pagehide救回首个正常writer。最后截图与pre-close均到634，比最后正常主档晚至少1分钟；已见费用保留，旧cleanup精确尾段仍未知。

独立只读审计核80份原件无drift、33项冻结输入与实际执行一致。623普通writer与actual selected的payload逐键差异仅lastCheckpointReason从world-tick改为visibility-hidden；不把同水位当作同字节恢复。原精选index冻结时审计仍pending，最终结果另见[审计增补索引](evidence/public-relay-A07-20261018/audit-addendum.json)，不倒改原状态或原件。

累计至少294世界分钟、活动wall294382ms；major7／business7／UI79／navigation238／key36971ms／restAccepted2／F2／eat1。本轮增量是3UI、7导航、1126key-ms，0父业务、0新增rest／F／eat。原全局只剩1UI、2导航；不能默认还能完整执行Continue＋reload＋Continue，也不能为下一probe重给预算。

## 世界在真实时间内的回应

玩家HP86、体力100、食物7保持；没有新玩家／营地成员受伤。这不等于全场没有伤害：正常账本evt366在623、evt397在633记录指挥员commander各对同一event-enemy wz-4造成10点物理伤害，敌HP100→90→80；首击跨实际selected／Continue保留，后续第二击在新正常writer。它支持本次白天NPC扣除敌人生命的实际路径，不外推双向伤害、所有NPC／防御塔或自动救援有效。

630的岗位压力SAN变化属于例行世界结算；本轮没有单因素对照，不能说移动或寻找庇护导致它。没有新增NPC交付记忆、关系奖励、工程上线、外交功绩或剧情奖励。

## 六视角与方法修正

剧本设计师在执行前和执行后分别窄审。玩家获得了“地点用途合格，但危险资格不合格”的公开区别；NPC仍按原岗位／战斗运行；营地没有免费工程；势力没有借记功绩；敌人危险保持；全局链只承认这段探索、拒绝、自动战斗和保存事实。没有新增完整Actor／Memory／Social前置。

执行前独立审查发现旧fed6方法的休整spec未传minutes，原helper虽保持safety函数，却不会消费它。该冻结体按原字节归档为BLOCKED_NOT_EXECUTED。最小修正只为实际rest调用增加minutes:duration；新READY9e177c9b…／manifest53866883…／driver2ad692f5…，含原helper在内的31个冻结输入不变。窄合成方法控制执行真实driver rest＋helper perform，确认新调用在ledger／click前进入safety(30)并honor veto；旧调用保留为反例。最终纯控制6／6、8实际进程exit0；这是方法控制，新增游戏合同0，不计浏览器或正常休整。当前A07真实分支被游戏Gate禁用，没有覆盖真实rest提交后的保守veto分支。

原A03的24／30中断、A04方法失败、A05未执行导航及A06结果均不改。原50源码合同与fixture Chrome仍按原2fca范围复用；本次不重新命名为自然三日或真人体验。原件及精选映射见[证据索引](evidence/public-relay-A07-20261018/index.json)，精选不等于完整本机归档或可独立执行包。

## 下一唯一交付

在原剩余预算内，检查一次合法公开自卫，否则暂缓。新boot先重新确认可见敌标；当前主攻击入口仍是disabled“再靠近目标后攻击”，快捷操作F外框存在不等于可提交。最多2段剩余导航有限靠近，主攻击入口真实启用、原安全与HP／phase／预算允许才至多一次F，不承诺清除威胁、休整或工程上线。最后1UI若用于Continue，之后最多报告正常writer前缀，不能冒充新一轮reload恢复验收。

“建筑”泛称列入实际呈现缺口，暂不重复已有危险／费用说明。正常完整中继和既有真人理解pilot继续在前，其后才接一名NPC的一个真实事实影响下一互动，再比较同权限表达。长期五项扩展沿既有依赖推进，不并开平台。
