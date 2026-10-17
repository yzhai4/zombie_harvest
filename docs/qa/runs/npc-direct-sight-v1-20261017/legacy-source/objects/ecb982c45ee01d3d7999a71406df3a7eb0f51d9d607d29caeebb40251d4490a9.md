# ADR：NPC 免费首谈的自身伤势／需求授权与自述 v1

**状态：** adopted／仅本文件 self 首谈范围开发验收；HTML `c42056ed08c9cbc0e27c09365828fae5d1c19dc25190e9e19d2e3beffa45bc91`，source104／独立19／Chrome self212，见[QA](../qa/npc-self-observation-v1-20261017.md)。完整感知与知识授权、LLM 和生产部署分别开放。  
**日期：** 2026-10-17。  
**设计／交付稳定 ID：** `npc-self-observation-v1`。  
**实际运行时 policyVersion：** `npc-first-talk-self-v1`；两者用途不同，不能互作schema／policy别名。  
**关联：** [剧本卡与文案](../scripts/npc-self-observation-v1.md)、[NPC 公开动作](ADR-20261017-npc-public-actions-v1.md)、[完整 ActorObservation 提案](ADR-20261017-actor-observation-v1.md)、[可信输入问题](../problems/PROB-20261017-observer-trusted-input-boundary.md)。

## 背景与本片选择

对照 HTML 为 `61ea64b27a65cc4a271c214c16126b40a453eae40c8684c106bc8edc89e5f115`，SAVE21／CONTENT3。实际首谈在 `interactNpcReducer` 中先通过 `npcPublicActionGate`，然后打开确认并调用 `npcStateSummary`。该摘要展示自身伤势之外的日程、精力、锁定目标和态度；`deriveNpcAttitude` 又会调用 `ensureSocialFacts`。这些函数不适合作为新纯知识捕获器。

现有 `ObserverExpressionV1.project/comment` 接收可信subject/context，不能证明actor存在或知道事实。第一片只证明实际免费首谈中，同一live NPC对本人伤势及hunger／fatigue／energy感受的授权与披露；不接完整感知／联系人、其它NPC、物品、地标、账本公共性、LLM或新持久记忆。

玩家价值是将机械状态摘要改成有事实依据的第一人称短句，使玩家听到饥饿、疲劳或低精力线索后，能选择先找食物、暂缓请求或再确认原支援请求。“了解情况”和“确认请求支援”保持分开，感受不承诺履职结果，也不新增指挥NPC休息的入口。公开查看卡继续提供原信息；本片不承诺所有旧UI都已经过actor权限层，也不据此给模型开放宽快照。

## 可信调用与捕获时点

`npcPublicActionGate` 的原成功结果是唯一入口依据。只在本次 operation=`dialogue-open`，且 speaker 与 subject 均为 Gate 返回的同一 live NPC 时，执行同步私有 capture → self projection → disclosure → authored text。实现可拆纯模块，但不增加通用工具框架、任意 state 路径或自由 subject API。

capture接口为`captureFromQualifiedNpc(npc)`，只接受当前live引用，不接受caller policy／trust。它必须在成功原Gate后、写本次`selectedNpc`／`npcTalkOpen`等UI标志前完成。内部允许复用固定`npcPublicActionGate(npc,{action:'view'})`的纯资格检查，再显式重核distance≤1、固定roster与双向驻守；不能重跑默认`interact`来重新推导操作，也不能先开确认再判定，否则会把原免费首谈转成`support-requested`。不能重新选择附近人，不能把父命令actor=`player-1`当作发言NPC；speaker绑定来自该命令所作用的真实`npcId`／live对象。

保留原唯一身份、固定 roster、合法生命／位置、本地与 DAY 会话条件。critical／受伤不新增 healthy-only；E0 与 paused-clock 仍可免费首谈。死亡、驻守、detached、未知或重复身份、失效目标维持原拒绝，不补造或修复实体。观察结果失败时不默认健康；关系披露失败按下文遮蔽可选详情，不新增首谈费用、体力或工作资格门槛。

实际旧validator允许部分lifeState／HP矛盾，例如healthy但hp1／maxHp100。self捕获须只读重核现有`syncNpcLifeState`的live规则：hp<30为critical，否则hp<maxHp为injured，否则healthy；冲突时不产生相互矛盾的自述，统一返回unknown界面fallback。不得调用sync或修改HP／lifeState／旧保存，不将原publicGate改成全局健康一致性拒绝。此观察降级仍保留原免费首谈、typed结果和0E／0分钟；全局一致性另open。

captured输入仅留在可信侧：同NPC的固定ID、合法lifeState与hp/maxHp、本人`self.needs={hunger,fatigue,energy}`、真实trustToPlayer、必要源水位。capture／observation不带name；人物称呼只由同一成功Gate返回NPC的既有UI label提供。`sourceRevision.sessionGeneration`实际读取`SessionController.generation`，其余水位为DAY、worldMinute、eventSeq、motion stepIndex。needs每项只接受0…100有限数字；缺失、字符串、NaN或越界在capture归为null、投影各自标unknown，不补0、不修改原需求。投影分档为hunger／fatigue≥70时urgent，其余合法值`normal`；energy≤25时low，其余合法值`normal`。未知项保持unknown，不能宣称无此需求。

输出只保留本片固定字段；subjectId必须等于actorId，provenance=`self`，不含精确坐标、原始HP／needs／trust、他人身份列表或完整state引用。复制并深冻结，不调用summary、deriveAttitude、ensureSocialFacts、syncNpcLifeState、感知更新、writer或RNG。

不调用 `canPerceive(self,self)`：该函数本来排除自身，且视觉不是知道自身伤势的来源。交谈距离只证明现有交互资格，不证明 NPC 正在看见玩家。完整 direct-sight／contacts／perception 授权仍待后续独立切片，本片不能将其标为已接线。

## 知识、披露与固定表达

本人合法lifeState、hp/maxHp与需求分档是知识；披露控制能减少字段，不能增加知识。只读当前`npc.relations.trustToPlayer`，不得改用campTrust、亲密度、人物模板或caller trust。alignment／playerProgress没有批准的关系来源，取中性策略调整，不当作观测事实。

沿既有中性表达策略：`score=clamp(.5+trustToPlayer/200,0,1)`；lifeState为原已公开基础事实，hpBand按原四分刻度；hpBand与需求分档均仅在实际trustToPlayer≥-10（等价score≥.45）时披露。trust=0仍披露，-10边界包含，低于-10同时遮蔽hpBand与需求。低信任表示知而不披露，不把合法self事实写成unknown；unknown只用于本来无法确认的字段，不能用来伪装遮蔽。

对缺失、NaN、非有限或超出-100…100的trust，关系评估标为无效，合法基础自述仍可显示，hpBand与需求分档保守不披露。不走旧纯表达器“missing贡献0→score .5”的默认路径，不虚构实际trust=0或-100，不把异常叙述成角色明确不信任玩家。可用中性界面提示“更多身体详情暂时无法确认。”，不增加首谈费用或健康门槛。该处理是本片新增的边界合同，不追溯称旧表达核心已有此拒绝。

最终固定文案仅消费已披露facts。基础句为“我目前没有受伤。”／“我受伤了。”／“我伤得很重。”；hpBand五档自述及关系降级见[剧本卡](../scripts/npc-self-observation-v1.md)。需求最多追加一句，优先饥饿“我饿得厉害，得找点吃的。”→疲劳“我累得厉害，需要休息。”→低精力“我快没力气了，需要缓一缓。”。normal不添履职／安全保证，unknown不补0或正常；只在已知分档触发时表达感受，不自动吃饭、休息或改岗位。hpBand0/4不等于死者，4/4不等于保证安全；文案不宣称劳动、作战、治疗、位置、敌情或未来意图。原确认操作提示与人物自述分开呈现。

AI-OFF／ON使用相同知识、披露与固定文案，无LLM、网络、提示词、模型预算或生成事件。不将现有自由 project/comment 注册为模型工具；即使保留兼容 API，也不能绕过本片内部可信调用。深冻结／hash是结果一致性手段，不是来源认证或同页恶意脚本沙箱。

## 实际可读性与提示生命周期

旧toast的400px单行省略会剪掉本片末尾需求句；innerText完整不证明玩家能看见。因此首谈调用`toast(message,{npcSelf:true})`，仅该次提示加`npc-self-dialogue`：white-space解除nowrap、width=max-content／max-width=min(90vw,520px)、border-radius14px、显示12000ms。普通后续toast自动清class并恢复1800ms，原generation回调保护保留，不新增UI缓存、计时事实或保存域。

真实Chrome需核桌面及至少390px宽的整句布局无裁剪／超出viewport，原截图留存。先以实际自动writer中的原首谈事件／proof绑定当时事实，随后可等2000ms核同一text和class仍显示，再resize取同一次对话的移动布局；这期间模拟照常，后来world／needs变化不用于改写首谈expected。普通后续提示须恢复旧class／样式，1800ms生命周期与新首谈12秒分别验证，不能改CSS或伪造timer通过。

## 原动作、保存与幂等

只有首谈话语与其私有观察链改变。原 `npc.interact` 父命令、`npc.dialogueOpened`、UI确认标志及既有checkpoint保留，因此整个首谈命令不是零写。纯性边界是capture／project／disclosure／固定文案函数，不是整个click，也不是仍会运行旧摘要或晋升逻辑的所有renderer。

确认支援仍实际gross2E／advance15及原自身效果，status inquiry仍保留原询问记忆；命令、自主拒绝、真实15分钟后死亡／离营／会话终止中断、最终负账本保存均不改变。不新增观察命令、独立观察完成事件、功绩或奖励，不把首谈改记npc.interacted。

观察与文本为临时值，不写新SAVE21／CONTENT3域，不新增持久缓存或联系人TTL。旧writer经实际loader/writer保持原NPC、关系、伤势、随机进度与事件事实；旧receipt不补自述或授权历史。刷新不会保存确认UI或旧观察来跳过新的实际Gate。

显式重复commandId由原Bus先识别并回读，不重新调用捕获或开启确认；本片不在wrapper前增加会阻断旧幂等回读的业务Gate。普通新首谈可按最新事实再显示，但不增加信任、SAN、bond或支援。支持后的询问分支不进入本捕获路径。

## 六视角与边界理由

| 视角 | 本片成立条件 |
| --- | --- |
| 玩家 | 公开同ID首谈可读，免费阶段与付费确认清楚；卡片信息保留；无隐藏target join或虚构保证。 |
| NPC | 固定本人伤势与需求感受，真实个人信任减少详情；critical旧准入保留，不把饥饿／疲劳／低精力描述升级成岗位或作战资格。 |
| 营地 | 无新资源、人口、劳动、治疗、CP或计划结果；旧支援成本、需求、岗位与保存保持。 |
| 势力 | 不读取或赋予外部秘密／外交能力；个人关系纯读不产生camp或faction关系变更。 |
| 敌人 | 不发现／枚举隐藏敌人，不读取AI锁定目标或contact今日详情，不暂停／抹掉真实威胁。 |
| 全局链 | 同步可信捕获、固定字段和明示来源；组件纯读，原业务命令收据与幂等分层核验。 |

## 待执行验收与停止条件

1. 用真实完整inline及原Gate／Bus／renderer／listener分别核首谈、确认和询问；先证明capture在talkOpen写前，且实际首谈仍0E／0min、player父actor与dialogueOpened不混成支援。
2. 真实自身healthy／injured／critical与hpBand边界，需求69／70和25／26、同时触发优先级及各项缺失／坏值unknown，trust0／-10／低于-10和缺失／NaN／越界逐项核授权facts、遮蔽与固定句。E0／paused-clock免费首谈保留；AI开关不改变结果。
3. 原目标变化、邻近另一NPC、detached／重复／死亡／驻守／坏坐标及非法调用不伪造speaker；self之外topic拒绝或不支持，不读隐藏实体或把未知补健康。原viewer仍可用，不改变公开查看／执行范围。
   另用真实完整旧writer验证原validator接受的healthy／hp1矛盾：真实loader与原免费首谈继续，自述统一unknown，原字段不修补、不回填；不能把非法输入负控替代该合法旧档反例。
4. 单独组件前后比较完整state／storage／registry／RNG／命令事件水位／timers，深冻结无原引用；随后整体命令只允许其原合同效果，不能将现有renderer默认化写入归于观察层或忽略它。
5. 实际完整旧writer／loader／writer两次reload保持原事实，无新保存域、观察回填、知识／奖励／TTL变化；重复commandId不重跑组件。原支援、询问、自主拒绝、中断与自动checkpoint回归不退步。
6. 独审与源码合同通过后，冻结实际HTML／runner／输入SHA做公开Chrome首谈可见、信任遮蔽、同ID确认与刷新；source-VM、fixture-browser、自然路线和CI分别声明。本片当前无以上执行结果，不借C2或旧NPC绿色填入。

任一未授权事实、默认关系泄露、免费首谈变付费、旧支援／中断回归或组件写事实失败，停止扩大到感知、记忆与LLM。回滚只恢复原首谈展示调用点，不改保存版本、旧世界或既有业务receipt。

候选对齐：HTML `9cb2a92ce80fb071ec0f4d61a6434b2a42781f97e73ee6d639157141b30e96ea` 为上述命名与长句文案初稿，独审后增加合法旧档健康矛盾的self降级合同；最终修订SHA及独立源码／架构、浏览器结果待后续QA。本文仍proposed，不迁用旧C2／NPC绿色。

健康一致性修订候选为HTML `68834890643f962c46b1c7c74e52d8f436609b260d31e079df2b579f26eef395`／纯核心 `715fca749327bc1302aa4869adda94044e5dfa9c6dd24cac733f1b98a7575868`；capture／project均只读拒绝矛盾。独立源码／架构及本片Chrome尚待各自终态证据，不以候选冻结替代验收。

可读性候选HTML为`d2512764bc54c9efb665168869cde08c6b8ac00f567ecb02229915fadd1d3896`，纯核心相同。该候选为专用换行／12秒及普通toast复原重新绑定输入与验收；6883或更早输入的source声明不能手改为新SHA。本文继续proposed，待本构建源码／架构及实际浏览器分层结果。
