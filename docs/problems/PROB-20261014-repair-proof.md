# 修墙目标绕过与真实动作 proof 缺口

日期：2026-10-14。状态：**active，独审后已接开发dist faec；真实源码验收通过，公开维修browser待执行；服务器/Sites未改。**

## 已知事实与影响

冻结开发HTML SHA256：`58a4bb28453429c73ad27baf22a377e3b7ff389b387a524196a06e490b0a65e1`。其 `repairBuildingReducer` 直接采用preferred，只有默认find路径检查附近、wall/spikeWall和未满HP；外来对象、错误建筑type、越距或满墙可以越过该筛选。多个拒绝分支返回undefined，wrapper把它包为result后，统一CommandBus仍会发building.repaired；默认选择成功时receipt的buildingId仍为null。现有净资源delta没有同墙HP或gross支付证据，不能作为阿梁个人链的修墙功绩来源。

相关设计输入：[full-roster proposed卡](../scripts/npc-full-roster-002.md)的阿梁N1 repair-proof及[独立内容评审](../qa/npc-full-roster-design-review-20261014.md)。本切片只修真实公共动作/回执来源，不注册新个人链，不补人物成功flag、晋升、额外奖励或会议规则。

## 状态、阶段与拒绝合同

- preferred必须是当前state.buildings中的同一对象，并有唯一稳定实体ID；不能仅凭相同ID/坐标接受克隆或外来对象。缺目标ID或未知对象安全拒绝，绝不创建建筑或补HP。
- 实际对象必须为wall/spikeWall、既有contextDistance≤1、明确有限非负HP且低于普通3/尖刺4上限；默认路线按原数组顺序寻找真正合格墙并在回执写它的实际ID。无目标、满墙、错type、外来对象、越距、缺木材或体力均返回明确ok:false/reason。旧loader允许缺HP墙继续读取，本动作不将未知HP补为0或新功绩；明确HP0仍可维修。
- 仅真实SessionController DAY、已开始、未退出、night=false、无gameOver且可推进时接受；allowNight不能绕过此白天动作。REPORT/LOSS/RECOVERY/SAVING/EXITING/BATTLE和终局拒绝。
- 拒绝不扣料/体力、不修HP、不推进时钟、不发building.repaired、standing/quest成功或奖励。允许统一CommandBus原有command.rejected/去重账本；动作表现只在全部Gate通过后触发。
- 合法成本保持wood2、energy14；同墙HP+1且不超过3/4；调用现有advance(20)，保留既有standing、campTrust、被动恢复、NPC例行/用餐和日界机制，不改变价格、距离或世界速度。

## 成功receipt与因果合同

已有building.repaired payload添加版本化proof事实，统一CommandBus的data.result返回同一份可核结果：真实buildingId/type、同对象HP前后/max、gross payment前后wood/energy、执行后资源与真实日历、实际nested advance命令/event/causation及分钟数。保留兼容净delta但明确它是包含推进副作用的净变化。

支付截面必须在advance之前：wood差2、energy差14；执行后截面另记advance被动energy恢复、NPC用餐/其它资源变化和standing/campTrust副作用及实际事件关联。不得把执行后净energy差当成14，不用空receipt、纯文本或测试mock业务函数证明修好墙。未知target不生成repair proof。

## 保存、迁移、幂等与回滚

SAVE21/CONTENT3保持；新增字段只置于已有event payload，不增NPC永久flag或第二套状态。真实source writer/loader必须完整保留rich receipt及command/event因果。旧building.repaired历史原样保留，不追溯伪造目标、HP或成本proof；缺新proof的旧事件不能升级为新个人功绩。

同commandId在现有seenCommands保留窗口内沿用统一总线幂等：二次调用或真实保存/加载后重试不再扣料、修HP、推进、发成功/standing/quest奖励；duplicate返回不宣称产生第二份proof。不扩大原窗口：运行events500、writer保存最后300、world snapshot投影最后200、seen/replay500，不把它们说成永久人物成功账本。回滚点为完整58a4原字节及现有夹具/goldens；候选留独立baseline、HTML、checker、diff和manifest供审查，未验收不替换仓库/服务器。

独立初审发现显式父ID和nested自动ID真实撞号，初版proof会在已扣料/修墙/发standing后因advance无event抛错，不能冻结该初版。先独立修复 [统一CommandBus编号预留](PROB-20261014-command-id-reservation.md)，然后从相同修复字节继续本切片；不引入维修专属第二套ID避让规则。

## 六视角核对

| 视角 | 本轮合理性/边界 |
| --- | --- |
| 玩家 | 只对眼前真实受损墙支付既有成本；拒绝有可解释原因，成功可核墙/木料/体力/时间，不把推进恢复掩成免费维修。 |
| NPC | 阿梁后续可消费真实玩家修墙事实；本轮不授关系、英雄或repair-squad，不造帮手/岗位，不冒称人物闭环完成。 |
| 营地 | 木材、墙HP、食物消费、standing和时钟各有截面/因果；不修外来或满墙刷声望，不重复扣粮或补CP。 |
| 势力 | 不改变阵营关系/交易、不凭维修发外部材料或盟友；既有营地信任变化有原standing来源。 |
| 敌人 | 同样20分钟世界推进与现有威胁机制，越距墙不能成为隔空修墙漏洞；不制造新敌人或额外遭遇作proof。 |
| 全局链 | 原building.repaired只在真实成功时推动原quest；新个人链仍待接线，合法维修不冒称中继施工/主线/终局完成。 |

## 必要验收与当前进度

先用真实完整inline VM复现基线漏洞，再测候选正反例、same-command去重和真实writer/loader两次刷新，业务函数不替换。新checker须显式可移植HTML/IO-adapter/out输入并报告来源SHA、TEST-ONLY合成场景与浏览器范围。保留合法wood2/energy14/HP+1/advance20/standing，以及推进副作用的独立事实和actualnested cause。

回归执行原177/48/69/43/27/16及内容/语法/night/static smoke/replay goldens。诚实拒绝使旧错误期待失败时先记录原测试与新行为，不盲改golden或重基。没有浏览器运行/自然关系可达性/发布结论；候选通过只解锁根代理独审、集成及后续公开维修入口测试。

## 候选验证进度

状态仍为active：私有方法完成，根代理独审/集成/browser待执行。候选从同一已冻结db945a统一Bus字节建立第二切片，仅改变两个维修函数，其余字节精确相同；不会把source-ready说成完整阿梁闭环。

初版a530因真实nested ID碰撞可半成本后崩溃，原字节独立保留为失败候选，不被后续绿色改写。统一编号修复后，维修在支付前使用同一 `CommandBus.nextAutomaticId` 作纯能力预算检查，MAX父/最后子ID已占时无支付、HP、推进或standing/quest收益。没有维修专属ID空间或全局事务承诺。

新自测41项通过，含实际58a4 writer产生的旧空receipt输入、当前rich receipt、两次真实writer→loader与same-command重试；基线58a4及db945a各复现九类原缺口。独立完整inline VM31项通过，包含last-free安全子ID实际成功。原177/48/69/43/27/16共380项全部exit0，全部goldens保持；原字节私有projection self-test9夹具/4aec7a31仅为保存投影范围。语法/night/content与static55通过，初次私有validator缺输入失败保留并补齐原L0文档重新验证，未改断言。

成功事实由实际来源提供：payment.energy100→86与推进后87分开；NPC用餐的原npc.need.fulfilled事件/子causation、跨日配给、真实倍率20请求→5或80实际分钟、standing/trust前后与事件ID分别保留。旧receipt没有proofVersion时不生成新proof，不追加英雄或人物成功flag。schema仍只承载可选event payload，未来个人链消费者须核真实目标/成本/因果，不能把payload对象存在当已验证功绩。

| 冻结对象 | SHA256 |
| --- | --- |
| 第二切片HTML（base=db945a） | `faecaffd12aefdf3c1c0f1dd57130bbb2ba37d5da0e9a6e81bc1f7532733335c` |
| 可移植 `check-repair-proof.mjs` | `c305ef6a389c62adbfe5fbada45fa25a971669557ae27e13cad1e00a7a1f31d8` |
| 41项自测方法报告 | `eb0785c885d0cb115bcaa2a892530a0d9077fb83466affa61c9668c186b57234` |
| 独审/原回归汇总 | `a5d2c3abfac7b87e8ab456076819238cdc8ffbb61bc4553475b140f1191874b2` |
| 96资产manifest | `8ea15e1a340f92e040cc14f9e4ae0abef26a2b1cf45dec188453b016888f6fe3` |

CLI：`node check-repair-proof.mjs --html ABS_HTML --io-adapter ABS_RECOVERY_CHECKER --out NEW_REPORT [--mode baseline|candidate] [--legacy-repair-fixture ACTUAL_OLD_WRITER_JSON]`。报告及旧writer夹具标TEST-ONLY，无自然关系可达性或浏览器证明。仓库、服务器、当前跑58a4的三日均未修改；该三日即使通过也不证明db/faec。新增项目问题记录；无新增全局记忆。

负责人已接入不可变faec字节，并以repo两checker/完整旧writer夹具再验28/41；原177/48/69/43/27/16及goldens保持。旧fixture/meta为TEST-ONLY，不追溯补proof。当前只解锁公开维修验收，个人链消费者尚未开发，详见 [集成记录](../qa/command-repair-integration-20261014.md)。以上私有阶段与“当前跑三日”均为历史时点；原58a4三日已FAILED并保留原件。
