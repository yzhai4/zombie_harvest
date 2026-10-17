# C2 最小实施备忘（只读，未实现）

基线：C1 r2 HTML a2fcdb647f2632fbf50f3ab0f3ba160f168082c602f6737c5ca4239eede137d2。依据完整 Scenario boot ADR；C1仍待真实浏览器及发布收口。本备忘不改C1、ROOT、现合同或生产经济。

## 结论

只让一个已存在的断粮v2从JSON编译成现有EventChainDef。继续使用ContentRegistry、GateV1、episode CAS、CommandBus、applyContentEffects和现有writer；不加解释器、规划器或新剧本。relay仍引用真实EventDef，不能误注册成eventChain。最小难点不是JSON解析，而是旧档在公开start前已校验内容身份，必须能对候选目录做纯查询，不能靠先改全局表解决依赖。

## 最短接线与实际锚点（a2fc行号）

1. 1920–1961的纯核心扩展validate→resolve→compile。当前compact JSON缺标题、节点/文本、阶段/hooks和完整fallback效果；先将这些作者数据补入JSON，单一nodes/choices形态承载requires/effects，不能保留两套可互相冲突的choices。编译输出完整普通数据：id/chainId、title/description、definitionVersion2、phase/category/priority/hooks、gateVersion1/evaluatePreconditions、Gate/preconditions、nodeId/title/text/choice label/hint/requires/effects、完整fallback、repeatable/optional/source。JSON包和compilerVersion显式登记；严格校验未知键/类型/authority/操作符。
2. registry改为typed refs，例如外部{kind:'eventDef',id:'relay-chain-001'}，本包{kind:'eventChain',id:'zh-food-shortage-001'}。外部relay在已有eventDefinition/EVENT_DEFS中核对，保留原relay reducer/身份/Quest；不从字符串猜kind，不重复定义或注册relay。
3. 2886 validateContentDefinition可作现有结构二次校验，不能当完整安全检查：它没有穷尽Gate/op/ref/图/有限来源。纯compiler只支持本切片既有food_days、role_available、flag及recordHistory/addResource(food)/adjustMeter(resonancePressure、campCollapse)/unlock(flag)等明确字段，复用现有Gate/effect执行器，拒绝未知而非扩为任意命令。
4. 删除3300–3312整块SCENARIO_RUNTIME_STORYLETS与“同ID存在就跳过”的注册循环。新候选表只作用eventChain：从现已提交extensions复制，在私有表中加入所有编译定义；与2881基表及既有extension查冲突，验证所有next/ref/fallback/有限来源后才允许提交。C2不要调用3299逐项registerContentPack，也不用重构weapon/buildInfo等无关注册路径；2921 registerContent仍可服务旧API，但不是C2 batch事务。
5. 4013 loadProgress在公开start之前执行，3603 validateProgressPayload/3686 active definition校验、3152 normalizeContentEpisodes/migrateContentState，以及prepareSavedPayload都依赖contentDefinition。最小必要改动是给这些纯准备函数传显式只读catalog/lookup context，默认仍用已提交目录；验证/迁移候选用staged lookup。不得临时修改全局表再rollback，也不能让全局contentDefinition/all在START阶段偷偷把未提交目录当已安装。selectProgressSave/classify/validateStoredProgress向下传同context；3823的EVENT_DEFS恢复updates继续按原逻辑独立准备。
6. 3874 fresh draft与旧saved draft均携带准备好的eventChain table/目录摘要；公开start在全部包、refs、保存身份与world draft通过后进入3928 installSavedPayload的同一同步提交段：用一次CONTENT_EXTENSIONS.eventChain=preparedTable替换该kind目录，再安装plain state及既有已准备EVENT_DEFS updates。提交段不能调用reducer、RNG、storage或用户回调。所有校验和对象构造在前；不在forEach中逐项commit。首存失败沿C1完整安装后冻结/重试语义，不谎称跨storage事务回滚。

## C1固定catalog如何退出

删除运行时SCENARIO_C1_CATALOG精确包匹配及3864 validateScenarioAuthoredCatalog“JSON必须等于手写效果”的门；否则合法TEST-ONLY包变更仍只能拒绝，不能证明编译执行。

替代物是共享纯compiler的闭合语法/typed ref/图与来源预算校验，以及真实提交目录与compiled digest相等的只读一致性检查。独立冻结的作者v2规范继续留作回归oracle：默认包编译结果必须在规则字段上等价当前a2fc注册定义；该oracle不可由可变输入重新生成。它是测试基准，不是运行时第二套规则来源。文本也从包来，不能只把effects改成JSON而其余执行定义仍走旁路。

## 作者经济与六视角

默认生产包保持definitionVersion2、shortage_choice节点、day1–13/onDayStart/food_days<=1及既有回退，均以a2fc真实定义为准。ration仅recordHistory，不增崩溃、不赠SAN或食物；forage健康在营后勤+未取flag，整局一次food2/resonance2/unlock/history.resonancePressure2。有限cache不随episode或初始food倍率补回。ifMissingNpc现有collapse1、ifInsufficientPopulation现有collapse2、expired/skipped ledger_only不偷偷改数值；同样不新增可见“远征耗时/敌人暴露”。

| 视角 | 最小验收 |
| --- | --- |
| 玩家 | 原公开事项renderer/Choice路径、库存/日需/午夜解释不退化；ration、立即取粮、延期先补/不补仍保持v2实际后果，不用新惩罚制造收益 |
| NPC | healthy quartermaster与camp-local Gate、固定人口/旧伤亡不变；无后勤时走已声明fallback，不凭JSON造人或越过岗位 |
| 营地 | 所有food有有限cache或原生产来源，原flag/配给/初始倍率边界保持；资源支付/奖励只经原事务执行器 |
| 势力 | 不新增信任/外交奖励或外联事实，未知引用拒绝；relay外部EventDef仍为既有链 |
| 敌人 | 共振只为仪表，原AI/实体/伤害/实际暴露不变；编译成功不代表接入敌人Director |
| 全局 | compiled def→实际hook→同episode Choice→原effects→原生writer可追溯，纯准备无副作用，目录一次commit；不等于ActorObservation或完整Scenario Studio |

## bound旧档与内容身份：实施前明确这一兼容选择

不能继续用“拿新完整JSON重算C1 packageDigest并要求相等”：JSON补齐文本/结构就会换digest；也不能把所有旧digest忽略。建议C2新增明确内容绑定版本（compilerVersion/catalogDigest/typed refs），原C1初始binding及packageDigest/configDigest完整保留为历史provenance；新鲜C2 binding用新版本表达events已applied，旧C1的baseline-only声明不被伪写成当时已编译。

只给已知a2fc/C1 packageDigest与作者v2语义一致目录显式一次adapter：核旧绑定原结构/初始配置、C2编译后的规则digest等于冻结作者v2，再添加内容来源说明；不reseed/scale、发粮、结算事项或改CP。原legacy-unbound initial seed政策也保持，不能因内容接线升级为初始世界曾绑定。

同语义v2迁入必须原样保留active.instanceKey/instanceId/defId/definitionVersion2/startedAt/actor/node与completed/applied/history/cacheflag；原v1→v2受限adapter继续独立执行，不能变成通用future-version升级。未知旧digest、定义冲突、active版本或来源无法确认时整份拒绝并保原主/备份，不drop链、重开episode或套当前包。第一片不做多版本内容共存：不能提供匹配目录的旧active就明确拒绝。是否用snapshot.contentBinding独立字段或binding v2需root确定，但这项版本分流不可省略。

## 两类最小证据

**真实语义反例，TEST-ONLY新局：** 对照默认v2 cache总预算2/forage2；另一个独立冻结测试包将该已有定义标definitionVersion3，cache总预算改1、forage effect与history.amount及可见提示一致改1，retrievalLimit仍1、持久flag仍同一有限来源；resonance2和其他规则不变。两者同seed、相同初始food0/十人/后勤条件，经真实新开→实际onDayStart hook→真实事项renderer/Choice/原reducer，应分别实际food+2/+1、对应def版本/compiled digest；再点/刷新/下一episode均不再领。source-VM直接调用实际hook只称合同测试；另以完整near-midnight writer经真实advance跨日核正常日历consumer，不能手改calendar或假造receipt，也不要求为了语义探针硬跑一整天生存。该测试只证明包控制既有消费路径，不进入生产包、不加载旧v2active到测试v3、不当平衡结论，也不复用“同时移动输入与expected”的oracle。

**注册原子负控：** 准备批次先含合法断粮，再含重复ID/未知Gate/op/不存在next或typed外部ref的后项；C2虽只承诺一个剧本，非法第二项必须在提交前拒绝。对原committed eventChain表、EVENT_DEFS/其他kind/base/buildInfo、state/RNG、storage原字节、timers逐域比：首项不得留下、无scenario.bound/content奖励/新clock。另测compiled def与已存在base/extension冲突，不能用同ID跳过。两个合法候选的对象构造可在私有表中发生，不等于已注册。

同时补默认包与当前a2fc独立规则投影等价、未知authority、无限环/无终点无安全出口、next/ref缺失、无fallback、source多路径可重复领奖/超总预算等负控；初片只接受可静态证明的简单单节点有限来源结构，不假称可判任意逻辑图。源码合同后再做exact包/HTML/runner浏览器；C1绿色、fixture回放和自然路线不能互相代称C2完成。
