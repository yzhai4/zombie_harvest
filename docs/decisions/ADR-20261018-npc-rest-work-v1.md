# NPC低精力恢复的最小执行合同

状态：active，候选实现与验证中；不代表开发验收或生产部署。SAVE21／CONTENT3保持，新增政策`carpenter-rest-work-v1`。对应[剧本卡](../scripts/npc-rest-work-v1.md)。

原23b8运行时把生理休整、日程文字、行为、移动和工作脉冲分别计算。真实同源一分钟输入中，木匠E23.5会恢复精力却发例行completed；未到脉冲时又会显示休整、保留work行为并朝东门走。它的home是工坊，日程workZone是东门，小时检查目的地又是工坊；本片保留三者的原含义，不把completed称为产木或到岗。

## 决策与权限

仅健康且HP与健康事实一致、本地、唯一有效木匠的低精力例行分支进入。有效岗位沿实际`npcFulfillsRole`，不由原id与actingRole各认一个岗位。其他职业、全局伤病／死亡一致性与继任双岗合同保持开放。

新政策E<24进入，持续至E>=36。保留原+.045恢复斜率、配给、需求、SAN和真实世界时间。无其它变化时23.5→36约278分钟；相比首次跨24约多266分钟，这只是前置恢复时间估算，不能称每日净成本或实测收益。较大的退出余量用于避免阈值附近每几分钟切换；其体验代价须后续pilot判断。

纯core只返回start／continue／finish／cancel／unhandled。可信私有adapter核同live对象、唯一岗位、存在／地点、本人needs、正式职责、阶段；纯数据结构合法不授予权限。输入只消费这个安排需要的本人事实和实际任务占用，不读隐藏敌人找安全区，不以全量ActorObservation完成为前置。无需LLM。

玩家真正成功接受的支援／订单、中继实际参与、原警觉／作战、离营、死亡、伤病、有效岗改变、BATTLE／REPORT／LOSS取消恢复。原fatigue>88及hunger／social／safety>=72的更紧迫需求分支也让权；原各分支条件与效果保持。拒绝、免费首谈、查看、暂停、hidden、普通保存、刷新本身不取消。取消不保留可自动复活的paused任务；下一次合资格推进且仍E<24才可新选。

## 执行与时间

依附现有routine／CommandBus推进，不增timer、通用任务队列或工具框架。活跃安排同时控制原生理rest判据、home尝试目标、rest行为、工作credit和SAN。运动仍沿实际碰撞，不瞬移、不保证到达或安全；途中也按原速缓恢复，UI区分尚未到达和已在home。

每次现有advance至多新选一个安排，并在原需求／配给和感知后重核完成／让权。原bulk模拟粒度保留：本段若用于恢复，整段不积例行工作credit，即使末端达到36或被接管也不反向补工。退出发生在实际评估边界，不声称精确阈值分钟或任意分片的全世界等价。完成步的原SAN节拍读取同一本段恢复标记，不能因先清intent而误算岗位压力。

开始清本人的workClock；恢复不增加workPulseSeq、不发例行blocked/completed。完成后按当前原日程选择目标，后续推进重新积累工作；没有补奖、资源或人口。完成只表示恢复目标达到和交回例行执行权，不认证已到东门或检查完成。旧每日福利、relay工时与其它NPC工作各有原owner，不纳入本片生产承诺。

## 持久化、因果与回滚

NPC新增`routineIntent`：null，或严格六字段`{version:1,policyVersion:'carpenter-rest-work-v1',intentId,actorId,roleId:'carpenter',startedAt}`。ID由实际父推进身份、NPC和实际世界分钟确定，不耗RNG／新增计数。actor绑定容器；时间有限非负、不晚于保存时间；ID非空且不超过512字符；多余键、未知版本／policy与坏形状拒绝。目标阈值与奖励不能由存档配置。

writer显式投影；现SAVE21及18–20的完整旧writer允许缺键，在纯draft加null，不从文字猜旧恢复历史。统一追加一次精确`npc-routine-intent-v1` reason、addedDomain和缺失NPC列表；原资源、需求、位置、工时／历史、人口、RNG、命令与场景绑定保持。validate／prepare／render不创建安排或业务回执。实际首次迁移写盘仍沿现有失败冻结／公开重试。新writer再加载不重复迁移。

合法活跃安排在24至36之间reload保持同ID，继续时重核当前职责，不按墙钟补离线工时。started／finished／cancelled仅在实际转换记录一次，actor为本人、causation连接真实父命令，不伪造commandId或工作功绩。旧摘要replay自测不执行HTML；本片连续性须真实writer→loader→advance轨迹验证。

旧23b8 writer会删除新域，故不是无损双向降级。回滚保留原生备份，承认新行为状态丢失；不以删除新键修复未知未来存档。

## 当前验证边界

独立设计与架构先审六视角，源码验证实际consumer与完整旧writer，再冻结候选运行公开浏览器。原失败与方法错误分别保留；自然三日、玩家乐趣、完整NPC规划、Memory／Social、Studio、多副本和生产均另验。构建及实际计数由QA／manifest记录，不在本ADR预填成功。
