# ADR：NPC公开查看、请求与命令的资格

日期：2026-10-17；状态：开发实现accepted，源码80dea63c／HTML9edb6d3c列明source110与Chrome112验收，详见[QA](../qa/npc-public-actions-v1-20261017.md)；生产未部署。基线源码b1abc2ee／HTML19cb05；SAVE21／CONTENT3版本不变，新增事件proof为兼容字段。

## 原问题与玩家价值

[距离问题](../problems/PROB-20261017-npc-context-distance.md)来自真实自然fresh05：1.25格内已显示可请求，执行却要求1格，实际距离1.018159931…被拒。独立源检查另复现未执行却发空npc.interacted、首谈被记为支援、已渲染请求在提交时改选另一名NPC。玩家应能理解当前资格、请求的对象、真实支付和发生的结果。

## 六视角合同

| 视角 | 约束 |
| --- | --- |
| 玩家 | 查看≤1.25格，请求／命令≤1格；明确显示接近／体力／暂停原因，绑定原NPC并在提交时重核，拒绝提示不能被通用fallback覆盖 |
| NPC | 唯一live、本地、非死亡且数据合法；保留原受伤／critical低风险准入及角色命令列表，不把可互动等同可劳动或可战斗；合法危险命令仍可自主拒绝 |
| 营地 | 人口不变，首次确认支援／首次命令保留gross2体力与原advance(15)，既有支援换命令不额外支付；重试和刷新不重付 |
| 势力 | 不新增外交信任、资源或通讯；自主拒绝的关系／记忆变化保留其原事实来源 |
| 敌人 | 原15分钟内照常运行需求、移动、战斗与伤亡，不删除敌人或保证救援；动作开始合法不推定结束仍存活 |
| 全局 | 单一CommandBus，目标无效明确ok:false且无业务成功／支付／功绩／时间；规则拒绝与NPC自主拒绝分别记录，旧历史不补造 |

## 操作语义

- 目标只认精确非空ID或当前live对象引用；未知、重复、删除、detached、驻守、死亡、畸形位置／生命数据不替换为其他附近人，不修补身份。查看和执行共享同一目标解析，距离按连续欧氏值判断。
- 查看是独立UI动作，不开确认、不写记忆／事件／资源／RNG，不等于角色知识授权。首谈保留原0体力／0分钟，发npc.dialogueOpened；确认请求才发npc.interacted并有真实support／bond／memory／SAN后果。既有支援的再次询问保留原记忆效果，发npc.statusInquired。
- 命令沿原角色列表；已支援换命令为0额外体力／时间。合法NPC自主拒绝可以保留原lastReport、关系和npc.orderRefused，不能再发npc.orderChanged。目标／会话／必要资源等规则前置失败不触发这些业务副作用。
- 农务式固定玩家来源同样适用于公开NPC操作：父命令和对应业务事件分别核对player-1；时钟子事件可为system，靠真实causation关联。保留CommandBus重复识别顺序，不在wrapper前用当前距离阻断旧命令幂等回读。
- 付费操作先校验真实时钟与必要子命令编号预算。当前writer要求整数分钟，原advance直接乘rate；会产生fractional calendar的15×rate必须在支付前拒绝，保留旧保存与原倍率，不擅自取整或改时间。免费查看／首谈及已支援换命令不假借推进时钟。
- proof区分gross支付、实际效果捕获阶段、真实advance及完成时目标。原NPC部分效果在advance前、部分在后，阶段标签须真实，不能把不同阶段都称为“所有效果已完成且尚未推进”。未知模拟内部异常不由本切片承诺全局事务回滚。
- 实际15分钟中目标死亡／离营／丢失或会话终止属于已启动后的中断；只重核生命周期、身份与会话，正常移动离开1格不算中断。保留已付体力、已推进时间与已发生前置效果，不退款、不复活、不抹掉真实战斗。停止后续SAN／help／新命令及Accepted／成功提示，不写回死亡同步清掉的order／support。记录npc.actionInterrupted及实际阶段／父子因果，返回明确npc-action-interrupted，无npc.interacted／npc.orderChanged成功。通用Bus另记command.rejected，不能把这种已发生后果的中断混成无副作用前置拒绝。
- Bus负结果分支本来不请求checkpoint；本次合法自主拒绝或真实中断在外层dispatch返回后请求保存，使最终负结果账本、已付成本与实际后果一并持久化。重复命令不重改、不重付、不再触发关系变化。实际自动保存与pagehide／显式保存分别验收，刷新不能掩盖缺checkpoint。

## 消费者与兼容

源审计中，现任务／Gate没有npc.interacted或npc.orderChanged类型消费者；真实支援／心智／关系在reducer写入，后续角色系统读实际字段。保存接受非空事件类型，重放命令仍npc.interact／npc.order；旧空事件保留，不能追溯推断支援或人物功绩。浏览器方法中首谈期待npc.interacted的旧断言必须改认明确dialogueOpened，确认支援仍核真实支付／对象／状态和时间，不能放宽成任意事件都算成功。

## 验收出口

先冻结旧19cb真实反例和候选，再执行完整真实inline、原Gate／reducer、实际context／roster renderer与监听器／keydown、writer／loader。覆盖1／1.018／1.25／外侧、渲染后移动删除及变近的他人、critical低风险准入、驻守死亡、付费与免费阶段、合法自主拒绝、必要编号与时钟、重复／刷新、旧历史。受控派生源场景明确TEST-ONLY。

源码通过后在最终同SHA实际Chrome验证公开按钮／E与CSS命中、纯查看、首谈、确认支援、拒绝与刷新，并重新绑定受影响农务、驻守、休整、断粮、episode及短自然路线。它不等于自然三日、所有NPC行为、岗位互斥、完整规划、ActorObservation或生产部署验收。
