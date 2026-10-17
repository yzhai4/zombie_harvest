# NPC direct-sight 接线独立只读架构复核

日期：2026-10-17。只读检查实际源码与方法文本；没有运行游戏、源测试、浏览器或新增测试脚本，没有修改仓库文件。结论限下列精确字节，不是整个项目批准或浏览器验收。

## 来源

| 对象 | SHA-256 |
| --- | --- |
| 首次审阅 `dist/index.html` | `36b8399cb865e453cfd5931aeb427c1c0cbec8a2163a165cdf5224dd6082baa5` |
| root修复后再次实际读取的 `dist/index.html` | `23b8c8c27234592673aa927f3909ea49247c372a937787f90355f87531f421b0` |
| `scripts/lib/npc-direct-sight-v1.mjs` | `d464721a657a0c436e4bf1b3fd45cbe250f769ff932cbc01e3e0fbe4356a23af` |
| `docs/scripts/npc-direct-sight-observation-v1.md` | `3ca9b0c5372c5e1f6d48369e6c7d87b24ffd929a8fae9deca2447d7aba3b96f1` |
| 补充静态方法审阅 `scripts/browser-npc-direct-sight-v1.mjs` | `b44726a12e1cf527a10fb1710f71cfae7519c680557cf47db4974dfcfa03ef74` |

对照先前 `next-direct-sight-audit/findings.md` 架构备忘与完整ActorObservation范围。23b8源码内两core marker各唯一一处，marker间内容经只读文本提取与d464模块一致；这不是执行或世界授权证明。

## 首稿问题与本次修复复核

### 1. 预算unknown被当作资格失效而立即清空

36b8的`npcDirectSightRuntimePresence`对outposts>16／guard IDs>64返回false；capture在`npcDirectSightRuntimeInputs`把它降为`sight:null`，正确生成统一中性DTO。但`viewNpc`缓存后立即调用的`syncNpcSightReportUi`再次以同一Presence=false清空所有内容。结果是原view Gate仍合法的玩家看不到预算unknown，和卡片“超过只使本次新报告uniform unavailable”不符。

23b8的sync（7761–7778）现在先要求原view Gate／同actor／generation；仅对`status==='observed'`额外重核严格actor／Presence。因此本次无法确认的中性结果仍可见，不需要把未知解释成离营或偷偷放宽知识授权。实际死亡、距离、阶段、身份失效仍经原view Gate清除，肯定报告还保留严格在场检查。静态修复成立，未以修改卡片迁就首稿。

### 2. 缓存隐藏与真正失效的生命周期混用

36b8已有同generation／selectedNpc／view Gate重核及显式contextClose、closeInfoModal清除，但普通`hideContext`只隐藏；context surface不匹配只隐藏文本，缓存仍存在。另外`SessionController.freeze/restart`会停止后续渲染，却没有同步清除，不能仅依赖下一次sync清旧会话报告。

23b8在freeze／restart（4272–4281）停止timer／frame前明确清除；`hideContext`（6328–6333）只有旧context确实显示报告才清缓存，避免关闭一个未显示报告的context误清独立roster；`renderContext`（6368–6370、6516–6519）记录之前可见报告actor，生成新的真实view按钮后，若不再匹配则清除。正常同actor重绘继续保留原as-of revision，不重新capture或刷新时间。对这组风险的静态修复成立；真实容器切换／遮挡／可读性仍由浏览器验收。

### 3. 已死亡标记目标

root另告独立checker发现`dead:true`且HP仍正的旧形状。实际读取23b8的目标筛选（7728–7732）已排除`target.dead===true`，不再仅以正HP视作live。这个修复沿实际日间consumer的死亡标记，不据此宣称已审计所有敌人schema或全局死亡政策；其运行反例属于checker证据，本报告没有重跑。

## 授权与真实规则路径

- 实际context listener将渲染时`data-npc-id`传入`viewNpc`；roster卡同样传自己的ID。`viewNpc`重新执行原`npcPublicActionGate(action:'view')`，没有取首个附近NPC替换点击目标。新capture只接受当前state.npcs中的同引用固定roster角色，再重核唯一live身份、DAY、合法位置／生命与lifeState一致性，revision来自真实generation、calendar、eventSeq、motion.stepIndex。没有外部subject／profile／policy参数或window注册。
- 关键profile原始依赖在调用前核验：role、supportRequested、fatigue／stress／energy、SAN、actingRole／有效order、motionTarget／goal以及online relay数值；bad值或critical只使新topic不可确认，没有改变旧免费查看／首谈／支援规则。实际`perceptionProfile`仍按当前身份／订单实现选profile；没有shadow视距或任意relay视距80截断。
- `inBounds`实际要求finite原始数字，挡住distanceBetween／cellAt旧coercion。building类型、原坐标、可选w/h、实际footprint与边界先核，原数组与`getBuilding`首个AABB语义保留。每个严格合法候选至多一次真实`canPerceive`；方向仍取原motionTarget／goal，静止向下，LOS仍只处理原wall／spikeWall采样。没有调用updateNpcPerception／sharePerception／ensure／社交归一化来修现场。
- 目标仅来自当下`state.worldZombies`，校验稳定唯一ID、与actor/player命名冲突、category、正HP/maxHp、坐标及dead标记。重复／坏候选跳过，合法可见者按实际NPC距离和ID UTF-16比较选一个。已存contacts、targetId、lastReport、玩家visitedRegions或宽WorldFacts均不作为新事实来源；不改迷雾、地图发现、锁定或敌人。
- 实际预算在任何canPerceive前预检：64敌人、128建筑、16outposts／64guard IDs，以及`Σ2*max(0,ceil(2*d)-1)*B≤262144`。不是截断前缀后报告最近，也不是另一套LOS。`Object.values(outposts)`仍会先枚举／物化该对象，所以16是后续检查／查询预算，不是对任意巨大输入的完整分配成本或毫秒性能保证；当前卡没有声称已测性能，未来若作此承诺需另证据。

## 知识、披露与纯性边界

- 私有capture不含坐标／profile／候选列表；纯投影最多一个direct-sight知识项，私有subjectId不进入公开DTO。d464严格字段和hash一致性只检查格式／绑定，不是世界签名；运行授权来自实际私有capture，不把可构造的纯输入当runtime权限漏洞。
- 实际NPC→玩家trust只有finite[-100,100]且≥-10可披露；无knowledge、低trust、非法／缺失trust及不安全输入均为同一中性句与空disclosedFacts／同一公开facts hash。UI仅`observed`加同Gate角色姓名，unavailable不冒NPC发言或解释具体失败原因；AI开关仅元数据，不扩大事实。
- 捕获／project／resolve没有ledger、RNG、保存、timer、需求、social、promotion或perception写入。完整view仍允许原selectedNpc/UI/toast变化，以及原普通toast的1800ms timer；不能把whole view表述为零UI／零timer写入。新UI缓存只有已披露text、actor标签、status与as-of/generation元数据，没有原capture、knowledge、目标ID／坐标、私有hash或live引用。
- context新节点在contextActions之外，roster新行只消费缓存；sync不重求感知。view未为显示报告调用renderContext／render，因此没有新引入其已有晋升／社交写入。全局旧E预览与roster summary仍可含targetId／lastReport，这已在卡中明确开放；本片新行和普通view toast没有重新引回这些数据，不能扩称全UI权限已统一。

## b447浏览器方法快速静态复核

未发现阻止进入后续冻结／授权流程的静态方法问题，**没有执行浏览器，也没有给本次运行通过状态**。

- 四个TEST-ONLY完整source-native输入只在loader前注入；producer/source/input SHA显式绑定、原writer固定hash，实际source validator预先读取完整输入。后续只有公开continue、同ID查看按钮／名册、关闭、真实reload和N；未发现postboot state补丁、直接hook／capture action或伪造receipt。
- whole readonly WorldSnapshot只用于前后证据，不能成为生产actor输入；保存比较锁完整payload，source/native事实与可见UI分开。真实N在view纯性结果确认后执行，其合法世界变化不混进view的零业务变化判据；报告明确不把N称午夜或日历自然回归。
- context与roster均检查全文、同actor／status、as-of revision，桌面与390宽做边界／祖先裁切／scroll检查并保存截图。resize后等待300ms；普通toast约2.1秒消失与新行保留分别检查。target、关闭、reload新session和真实phase清理均有明确coverage；最终failure／errors／cleanup不被前缀true掩盖。
- 方法范围：四场都是paused-clock受控输入，redraw／resize不等于随真实world推进的完整时效验证；不会替代source层移动／朝向／死亡反例。几何和截图存在也不自动证明没有同级opaque遮挡，需要实际结果与目视证据。没有验证所有类别、预算边界、hidden、自然多日、完整ActorObservation、LLM或玩家偏好；旧self212等关联套仍是独立执行范围。

## 结论

36b8的上述UI合同冲突已反馈并在23b8实际源码中逐项静态核实修复；本次有限架构复核未发现其余新的阻断问题。运行行为、完整旧writer、IO纯性、预算边界和浏览器可见性仍以随后精确构建的独立实际证据为准，不从本报告或此前self绿色推导。完整ActorObservation／contacts／共享来源、NPC Planning、Memory/Social与跨副本方向继续开放。
