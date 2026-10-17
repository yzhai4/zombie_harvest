# 计划会身份投影、实例版本与历史票型保持

**状态：** proposed，下一轮备选；未正式采用新数值或修改L0。

**日期：** 2026-10-14。

**现状：** SAVE21 / CONTENT3；评审HTML SHA256 `412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8`。本ADR不改运行时、contentVersion、存档或回放预期；报告恢复的完整浏览器门禁在前。

## 背景

[源码架构评审](../qa/plan-voter-architecture-review-20261014.md)实际执行完整inline VM，观察到：真实木匠晋升扣CP并写hero/promoted后仍无票；普通军士由ID特例获2票；trust20/CP2可以提交计划；同日已committed的会议会被普通generate调用重置，并能再扣CP。食物评分遗漏“断粮”，而多候选score≥30的门槛饱和又使标签修正不足以保证供给进入前三。现有候选未保存basePriority，当前票型也没有原票与有效资格的分离。

该证据是TEST-ONLY源级状态输入，未运行本主题浏览器或自然自治路线。完整十人主动技能、晋升链、缺席/拒绝、真实供给与最终尸潮仍是长期出口，不由本ADR宣告完成。

## 决策提案及L0依据

下表“首切片”表示建议纳入下一轮实现，仍须负责人采用、更新相应L0与版本合同后落地；没有任何一项在本记录中改为已实现。

| 项目 | 精确规则依据与冲突 | 拟议裁定/范围 |
| --- | --- | --- |
| D1：hero单一真相 | [06](../../剧本/尸潮农场/06_NPC英雄晋升与普通NPC体系.md)「roster与层级」第5行：前三名起始英雄、其余普通；「晋升契约」第28行：普通晋升才得到正式票，未晋升只有建议。[设计师D1](../scripts/plan-voter-projection-001.md)第66行要求tier/status同时成立 | 首切片读取合法初始化/loader后的`npc.hero.tier==='hero' && status==='promoted'`。不读stale promotedTier、目标层级、eligible、技能名字或npcRoster名单推定晋升；起始三英雄不补造奖励/完成事件 |
| D2：长官额外权重 | [05](../../剧本/尸潮农场/05_势力营地与敌人多视角.md)「农场营地」第7行与07第21行仅定“额外权重”，没有定3票或领域数值。设计师D2第67行提议基础1+本人额外1，共2，适用于全部候选 | 建议新政策采用2票，其余正式英雄1票。必须先将05/07与旧卡单义化；这是显式数值变化，不能按“接线修复”沿用旧策略/hash。旧会议3票保持 |
| D3：军士/主持分离 | 06第5行把贺川列为普通；07「每日流程」第21行允许贺川/最高commandSkill者主持，没有赋予未晋升2票。设计师D3第68行 | 建议普通贺川0正式票、可建议/主持；晋升后1票。主持顺序林岑→贺川→在场可参与者commandSkill降序/稳定ID；actingRole/主持不复制英雄、长官额外票、CP或人口。旧军士2票只作为legacy历史 |
| D4：伤病 | 07「每日流程」第24行说重伤即时移除票权，「执行边界」第40行又说重伤仍可半票，互相冲突；未规定所有injured半票。设计师D4第69行建议injured全票/critical0 | 建议采用healthy/非critical injured保留本来票权，critical0。正式修订07第24/40行及06第30行和旧卡；critical仍计生存、不计工作。伤票与岗位执行权分别Gate。不能只测健康状态绕过冲突 |
| D5：拒绝范围 | 06第28/30行允许拒绝高风险命令并要求合作分支；07第24/40行没有定义范围。设计师D5第70行区分命令、会议、提案拒绝 | 接受范围分离原则，完整持久字段、期限/解除和消费者留待共享NPC schema ADR。首切片不把old orderRefused或lastReport变成永久剥权 |
| D6：每日实例冻结 | 07第28行要求同seed/input/contentVersion确定性，计划不能重复结算；设计师D6第71行及「同日候选冻结与晋升生效时点」第81–85行 | 首切片先封candidate/committed/resolved及已结算日实例的重建。新会议version2保存原票和原basePriority；会后晋升只进入首次后续新会议，force不能洗玩家实例 |
| D7：原票与有效票 | 07第24行要求身份失效即时改变权利；设计师D7第72行与第89行要求原票保持、有效min、真实失效有因果 | 首切片可投影已接线的死亡/critical/据点在场事实；完整presence/refusal与持久因果水印留待schema。新政策按实例版本计算，不能对legacy套新权重上限；纯render/reload不产失效事件 |
| D8：食物信号 | 05第6/17行规定粮水、工时、真实补给与机会成本；设计师D8第73行采用实际ratio<1、采集+9、医疗加分需真实未死亡伤员 | 首切片复用foodSituation的ratio/level来源，覆盖food0；不改门槛30和排名公式，不发食物/药品。危机供给席位与劳动/来源消费者独立后续切片 |
| 玩家干预Gate | 07「权限阶梯」第10–12行区分20/40普通岗位与60计划干预；「权限精确定义」第36行区间权限。设计卡「真实日历时序裁定」第93–95行 | 首切片在真实commit入口要求trust≥60、足够CP、DAY可输入、当前日实例、candidate和一次干预；UI使用同一Gate。低信任只能旁听/自治；拥有2CP不代表拥有计划权限 |
| 执行时序 | 07第22行“次日白天”与第40行“当日岗位队列”有歧义；[日历ADR](ADR-20261014-calendar-settlement.md)明确报告关闭不拨日期。设计卡第93–104行 | 建议保持现运行时：SUMMARY D首次形成会议；关闭回D剩余DAY；真实D→D+1一次执行/降级，然后新日CP一次刷新。采用前同步07/旧卡/交接，不在报告恢复主题中改变 |

以上精确行号来自本记录日期的文件。后续文档调整时应核对章节语义；本ADR不覆盖仍未修订的L0，也不改变affinity80与现实现25等独立晋升门槛差异。

## 首切片状态与接口

建议复用已有planMeeting、hero、CommandBus、applyContentEffects和日界入口，禁止另造票权全局变量或第二套执行器。四个纯接口分别投影参加资格、某原ballot的当前有效权重、原候选排序/理由以及当前方案执行安全Gate；它们不触发晋升、消耗CP、增加资源或记录事件。

首切片先处理明确的损害：trust<60不再允许玩家支持/否决/修改；同日commit后或已结算后不得清空决定；已确定hero身份进入新会议；食物危机不丢失。新会议version2和保存合同与这些变化共同实现，避免先改全局权重、随后才补旧会议兼容。

现有lifeState只有healthy/injured/critical/dead，garrison marker只表示岗位地点。本轮不增加missing/left字符串、不猜长期拒绝，也不声称远端通信已工作。普通军士主持、既有actingRole和受伤正式票不自动解锁生产或派驻。远端消费者、完整presence/refusal、十人个人链/技能和真实粮食自治继续待开发。

## 会议version2与legacy保持

拟议新实例保存：`version=2`、`votePolicyVersion='plan-voter-policy-v2'`、稳定instanceId/meetingDay、chairNpcId、生成时观察摘要，以及原candidates/ballots/score/basePriority/rank、选择、playerAction、CP消费回执和效果幂等事实。字段确切类型与默认值在实现前由schema合同定稿。本轮不写该对象到实际存档。

- **冻结原票。** 新会议只首次生成，原npcId/weight/score与candidate.basePriority不随刷新、晋升、额外遭遇或当前注册定义变化。会前实际晋升可参与；会后晋升不加入已有ballots。
- **保存旧政策。** 旧version1/缺策略实例标legacy-v1，不重算票、排序或效果。保留旧commander3/sergeant2的历史数字，不能用新2/0权重回套`min`。旧实例缺basePriority时保留rank作稳定次序，不从新PLAN_DEFS补历史；旧缺完整ballots显示历史未记录，不从今日roster造选民。
- **保留玩家与结算事实。** selectedId、committedDay、playerAction、已经扣的CP、resolvedDay、history、autonomyResult、effectId/appliedEffects和真实奖励均保留。迁移不能退回idle/candidate、返还或重收CP、改变已提交方案或重新播放收益。
- **同日去重。** candidate/committed/resolved和历史已结算日实例只返回已有事实。force也不重建正常玩家实例。重复命令不得出现第二次成功提交或扣CP；CommandBus可以记录真实拒绝，不能把拒绝包装为committed。
- **现安全Gate独立。** 历史数字不代表当前死人可工作/投票；生命、重伤、当前在场、人口/岗位/材料/来源仍须检查。legacy施加哪些实时安全过滤须正式写入合同，不能借此追溯改新旧数值政策或换发其他奖励。

旧未提交实例只在原候选中考虑当前有效票与可行性。已committed选择不因票失效静默换案；当前选案只能使用已声明且真实存在的替代岗位，否则等待/无收益fallback。resolved不执行任何奖励，只显示已结算事实。

## 有效票与因果失效

新version2的有效权重为`min(originalWeight, currentAllowedWeightForThisPolicy)`；资格失效为0，只允许原参与者，恢复最多到原上限，不重算原score。legacy使用原实例数字政策加当前安全资格，禁止调用“最新政策”统一覆盖全部会议。当前有效排序使用保存的basePriority/稳定ID；原候选rank/票型作为历史不被篡改。

读取有效票是纯projection，不能因打开计划卡、render、reload或加载旧存档而生成`invalidation`。真实生命/岗位/后续presence/refusal变化的reducer才写因果记录，至少有instanceId、npcId、reasonEventId或正式状态revision、oldWeight、newWeight、commandId/causationId。理由必须来自实际发生的事件，不能由UI伪造原因或用lastReport代替。

同原因只应用一次；需要持久去重水印与有限实例审计摘要，以免账本窗口截断后重复失效/恢复。该水印的字段、事件次序、跨版本与回放语义留待schema定稿，不先添加孤立boolean。纯projection可立即反映已发生死亡/critical，但若对应因果持久化未完成，验收必须分别标明“实时资格视图已接线”和“完整因果失效账本待接线”，不能合称D7完成。

拒绝某条玩家命令不等于拒绝营地会议；拒绝某方案只影响该执行消费者。共享presence/refusal需保存范围、目标、开始/期限/原因/解除事实并同步人口、地图、岗位、事件与战斗。missing/left的活人仍留在固定十人roster记录，不能删除对象、复活死者或补造新NPC。驻守仍属livingRoster且占原人口；没有真实通讯/传令前不自动作为在场票源，返营仅恢复原上限。

## 回放、迁移和发布影响

本ADR提议登记新的内容/回放政策；本文件不提高contentVersion或SAVE_VERSION。权重、伤病、供给评分与生成Gate改变将改变同输入的结果，必须在实现提交明确最终版本。清晰候选是CONTENT4与会议version2、SAVE21暂留；若另拆schema/内容包版本先立ADR。是否提高SAVE由兼容合同决定，不能只换策略字符串并继续声明同contentVersion旧hash不变。

迁移应同时支持version1 legacy与version2；按会议版本校验字段。新version2严格验证原npcId唯一/属于固定roster、权重有限非负、score/priority有限、原票汇总/rank、策略与实例/日期；原SAVE21/CONTENT3不能因新必填被拒。保存迁移保持原日期、人口、伤亡、资源、CP和已结算效果。hero与npcRoster矛盾不得靠名单造英雄；初始三英雄默认、已保存合法晋升、eligible与异常组合分别声明处理，不调用promoteNpcHero补数据。

实际SAVE18四原件没有新会议系统，只按已有兼容路径补起始身份/空系统默认，不retro创建会议、晋升、属性奖励或CP。正常SAVE21的committed/resolved保持原选择、已花CP与奖励。迁移唯一键以源版本/目标版本与存档事实标识定义，完成后writer/reload不再次生成迁移事件、失效、CP消费或效果。迁移结果校验/写入失败保留原主档与可恢复备份，不安装半套状态。

实际applyContentEffects会normalize/回滚并替换contentState，结算必须重新取得权威planMeeting。历史effectId和成功/失败回执继续用于恢复幂等；不得保留旧对象引用然后漏写resolved，或用新候选定义再次执行旧奖励。没有人口/岗位/工时/材料/来源的方案只给明确blocked/fallback，不保底发粮、药品或降低collapse。

回滚恢复上一兼容代码、内容与备份保存；不能降低版本数字、删会议或重基旧golden隐藏行为变化。源码执行hash、保存投影hash、浏览器场景与真实自治/平衡证据分别记录。恢复主题当前browser门禁未被本提案替代，任何后续部署/发布必须按实际构建重新验证。

## 影响、替代方案与六视角

| 取舍/视角 | 所选方向的原因与限制 |
| --- | --- |
| 重新计算全部旧会议 | 拒绝：会改已花CP与原票，并在晋升/刷新后洗选举；原实例策略更易审计 |
| 把原票永久当有效票 | 拒绝：会保留死者当前权利/幽灵岗位；历史快照与实时资格必须分开 |
| force重建或补选民 | 拒绝：同日额外遭遇/会后晋升可改变已有决定；新身份到后续新实例 |
| 势力 | 外交只能读取真实关系/库存来源；票权不生成外援或贸易收益 |
| 营地 | 缺粮正确进入观察，但可行供给席位/劳动仍需消费者；全零票/人口不足无收益降级 |
| NPC | 初始/晋升/eligible有明确边界；伤员不消失、代理不复制死者身份、拒绝范围可恢复 |
| 玩家 | 真trust Gate、一次CP、原票/有效票/冻结日期/blockedReason可见；不丢已commit选择 |
| 敌人 | 补采/离岗/发展继续付风险与防线机会成本；评分不取消夜战 |
| 全局链 | 真实晋升→新会议→因果失效→一次执行/降级可回放；无来源奖励不因版本迁移重发 |

## 采用与验证出口

负责人正式采用或修订D2–D4/时序后，同步05/06/07、[旧计划卡](../scripts/camp-plan-meeting-001.md)和交接；schema确定新实例/legacy/失效水印合同；报告恢复门禁完成后才接独立实现。完整presence/refusal/远端与真实危机供给属于后续共享schema/内容切片，继续保留在完整v82目标。

首切片必须实际执行normalizer、promoteNpcHero、投票/评分、生成、CommandBus提交与效果/保存路径，覆盖：初始三英雄/eligible/stale、HP边界、晋升前后冻结、trust20/40/59拒绝与60合法、同日第二SUMMARY/force不洗决定、非零已花CP、旧长官3/军士2保留、旧缺ballots/basePriority、当前死者/critical有效0与原票不变、旧committed/resolved两次reload、真实日界、food0/低粮与医疗伤员、无来源/人口不足fallback。修改计划UI必须执行实际renderer；源码与显式浏览器夹具范围各列，低信任三日路线不能证明这些新场景。

采用此ADR与完成首切片均不等于v82完成。本轮新增项目知识仅为此proposed决策；无全局记忆变更、无新增运行时/浏览器/平衡通过结论。
