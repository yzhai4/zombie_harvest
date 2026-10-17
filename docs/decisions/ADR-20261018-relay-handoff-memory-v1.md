# 接收者的核心交付记忆 v1

状态：adopted implementation contract／尚未实现。基线开发head0a8e816355b7877dde30313b8e9f1e518ba95a37，HTML108042213a6defbfd16cbd2f56cde8fbc2c575717c5eefff942753353a19b09a。SAVE21／CONTENT3保持加性；[既有计划](../research/eventfact-handoff-plan-20261018.md)与[六视角评审](../qa/six-view-eventfact-handoff-20261018.md)是设计依据，不是本片运行通过。

## 玩家结果与范围

真正把广播核心交给一位NPC后，通过原1.25格免费查看，能再次读到本人实际接收的时间与物品；正常自动存档、Continue和新tick后仍保留。交付历史与当前工程状态分开，不增加资源、关系、功绩、任务进度或推进分钟，不承诺完工／未来安全。完整Memory/Social、LLM、多人知识共享和跨副本连续性仍开放。

## 固定保存槽

`npc.memory.relayCoreHandoff`为显式null或一个plain胶囊，胶囊只含以下own data字段，tick也为封闭plain字段：

```js
{
  version: 1,
  eventId, eventSeq, commandId, causationId,
  tick: { world, phase, schedule },
  actorId: 'player-1', recipientId,
  projectId, itemId: 'relayCore', itemInstanceId,
  defId: 'relay-chain-001', definitionVersion: 1, instanceId,
  expectedEventId // 提交前CAS，null或非空原始字符串
}
```

固定槽和version已指定事件类型relay.coreHandedOff，不复制整个event、effects、自由文本或世界快照。eventId为本次新生成evt格式并与正safeint eventSeq一致；commandId保原非空字符串，包括合法opaque值，causationId为null或非空字符串。tick三值有限非负，world不晚于所属payload的实际时间；phase／schedule不与当前会话阶段比较大小。recipientId必须等于容器NPC的稳定ID，不能用姓名或当前岗位代替。projectId与当前单项目ID一致、instanceId等于该projectId，itemInstanceId等于实际coreItemId；保留既有非空自定义ID，不硬编码默认项目／物品实例。expectedEventId可以是null或旧opaque ID，不能误当新eventId。

全roster最多一个非null胶囊，本片不构造多次交付历史。已有合法槽保持原来源，不因重复调用覆盖；不支持的未来定义版本另立适配，未知／损坏值拒绝。源仍在连续ledger窗口内时，必须按seq与ID命中并精确核事件类型、actor／command／causation、tick、定义实例及payload接收者／物品／CAS；只有早于窗口首项才允许来源已淘汰。现有ledger连续性仍由原validator证明。胶囊自足，不因live500、writer300或snapshot200的保留窗口变失忆，也不声称签名／防本地篡改或跨新局唯一。

## 唯一生产与权限

保持handoffRelayCore的原reducer、既有接收者选择、费用／收益及返回合同。只在本次dispatchCommand返回后同步消费真实result.event：ok、非duplicate、relay.coreHandedOff、commandId与本次命令一致、actor为实际提交的player-1、四元token及payload身份均一致；按payload.commanderId绑定唯一live接收者，不按当前头衔重找。recordWorldEvent之后任务事件可能推进lastEventId，所以绝不取lastEventId或expectedEventId作为新来源。

对支持的player来源，新增槽的可写性／身份／已有来源冲突等可失败条件须尽量在支付前验证；同步post-hook无await、无外部回调，赶在原650ms正常checkpoint前完成。不得在reducer中途、通用事件订阅、renderer、关系flag或旧账本扫描生成胶囊，不二次发成功事件／奖励。业务已成功后不能把它改报失败、重做或退款；异常边界要保留真实业务结果并在验证中揭示，不能借后置投影宣称全局回滚。

当前内部handoff API的actor选项没有完整的逐choice actors授权；本片只支持player-1记忆生产。其它actor若按旧规则成功，保留原业务与receipt但不生产本槽，负控应明确是“未生成记忆”，不能冒称旧命令被Gate拒绝。此既有权限缺口独立记录，不把整套actors重构作为本片前置。

## 免费查询与可见性

接原viewNpc与原npcPublicActionGate(action:view)，不接首谈／询问近况（后者会记关系），不借伤势self捕获条件额外收紧合法查看。只读胶囊投影不改state／RNG／账本／存储；view本身仍可改selectedNpc与UI，不泛称整个函数零写入。null显示“交付记忆：未记录”，这不等于否认旧交付。

context与名册用独立本人事实行，仅在真实免费查看过且同ID、当前Gate仍允许时填入；context段落不进入actions数组，不改快捷键。切人、离距、死亡、驻守、夜间、会话退出必须清除不再授权的旧显示。低信任不补知识也不抹掉本人参与事实；死去／离营后的历史保留于原人物保存，但现场查询仍服从原Gate。文案只表达实际时间、玩家和广播核心，不暴露原始技术ID、敌情或工程未来。

## 旧档适配与writer

旧完整writer缺槽可进入纯prepare，只补null；不从briefed／重要事件字符串／关系flag／仍存在的成功ledger回填。新局默认显式null。显式null不迁移，显式undefined或坏对象在normalizer之前拒绝；prepare不写全局state、registry、RNG、ledger或存储。

在现有save.migrated中精确追加reason `npc-relay-handoff-memory-v1`、addedDomains `npc.memory.relayCoreHandoff`与`npcRelayHandoffMemoryAdapters:[{adapter:'npc-relay-handoff-memory-v1',npcIds:[原roster顺序的缺槽ID],defaultValue:null}]`，保所有原adapter、事实与顺序。二次Continue不再追加。严格oracle从原完整输入仅明确加此null与adapter，不调用新normalizer生成expected，不删除整memory或worldMeta比较。

serializeNpc保持原memory透传与map签名，不读全局时间校验较晚saved draft。saveProgress构好完整payload后、JSON.stringify及备份／主档写入前，只对新增槽执行own/null/严格胶囊preflight，时间／事件水位读该payload。坏live槽不能被JSON吞键后假装legacy；保存失败沿原catch返回false并保留安全原档，不借pagehide或强制保存补正常checkpoint证据。

## 六视角与验收出口

玩家得到免费可核实反馈；NPC只记本人实际参与、继任不继承；营地保原核心／成本／收益一次；势力无新外交／关系奖励；敌人与阅读暴露照旧；全局链以真实成功来源和正常writer闭合。未来实现按此逐项回填，当前不标运行通过。

验收：实际成功→同人物公开事实行→正常自动writer→Continue＋新tick仍同胶囊；重复／拒绝／错人物／不支持actor不造记忆；原接收者改岗或死亡历史保留而继任无经历；来源过300／500窗口后正常保存仍可读；真实旧writer缺槽一次null adapter、不回填已有交付；坏形状／身份／定义／时间／窗口冲突与writer undefined均拒绝。源码、真实boot夹具Chrome、自然路线与真人理解分别报告。旧明确迁移oracle与受影响合同须完整保留原业务比较。
