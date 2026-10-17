# 中继规范化替换项目对象，丢失阶段并重复上线收益

状态：动态确认；dccb列明源码与本地Chrome范围已修复验证，开发ref／精确CI待核；生产未部署。

## 真实反例

在c21后、仅岗位修复的候选69a84a07，以真实source命令取得的完整briefed writer38cdf0a6启动。没有手填材料、工时、项目阶段、角色、生命或资源；使用原真实`updateRelayProject(30)`最多15次观察消费。该方法控制IO时钟，只向项目消费者传分钟，不称真实world.advance、自然450分钟或真人试玩。

实际第7次调用中local project进入building／work30，但live仍staging／0；第8次重复发materialsCommitted。第14／15次local先后online180／210，live却仍building，连续两次发stationOnline及standing／trust收益；station.active最终false、forecast仍camp-observation。材料实际仅筹到木10／零件5／石4；任务首次完成的parts+1合法且仅一次，不能误称材料凭空重复产出。

## 原因与最小修复

`updateRelayProject`持有项目引用，`relayTakeMaterial`／`ensureRelayStationBuilding`等又调用`ensureRelayFacts`。原规范化每次替换`state.relayProject`，后续阶段、工时及终态写入旧引用；forecast再读取另一个live对象。原交付中yield→participants→ensure也会使handoffAt等后写字段落到旧对象；旧已存null历史不回填。

候选让原项目容器就地规范化；材料、目标分钟、奖励、命令和保存结构保持。新岗位读取／snapshot本身纯读，不能靠读时同步业务状态。修复只使未来真实写入留在当前项目，不撤旧进度、追溯退款或猜测过去重复收益。

## 验收

保留上述原执行报告与完整输入；新增独立legacy消费者回归，从真实briefed档进入筹料、材料齐备、施工、live online。核材料有限来源、live对象、station.active、forecast、一次上线／standing／任务奖励，并在后续调用、保存及第二Continue不重结算。原八stage合同与岗位负控分别保留；旧版用同一新方法应失败。当前构建Chrome再核实际公开界面和保存／刷新；source-only通过不代替自然主链、三日或玩家收益。

六视角：玩家看到的上线与真实能力一致；NPC不能对已失败的工程领奖；营地材料和收益守恒；势力评价只对应一次事实；敌人预警路线确实来自live中继；全局事件、存档和项目终态不能分叉。与全局岗位／引擎迁移目标分开，此处不重写整个GameCore。

结果：同一新方法c21为8／10、仅岗位修复69a84为9／10，dccb为10／10；legacy从真实briefed档第11次消费者调用达到live online，一次材料与上线／预警／standing、合法任务parts+1；后续调用和Continue不重结算。Chrome另验公开停工／恢复／保存，不冒称已在browser自然完工。见[QA](../qa/relay-effective-role-v1-20261018.md)。
