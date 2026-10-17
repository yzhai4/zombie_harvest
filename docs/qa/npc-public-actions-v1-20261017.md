# NPC公开动作与真实中断验收

源码 `80dea63cb835f8e4da3a965156d06d15a8bf4074`；HTML `9edb6d3c3daa7ec63d90594381d811cb077828fd0955fb7095c601ce91b5b87b`；SAVE21／CONTENT3。开发分支PR #4，未合并或部署生产；精确head与CI在发布收据另核，不继承旧19cb绿色。用户研究原文归档SHA940efac9…，仍为设计输入。下一真实Scenario boot设计见[计划](../research/scenario-boot-c1-implementation-plan-20261017.md)，并未实现。

查看仍1.25格，支援／命令仍1格；统一live唯一ID／本地／生命／会话Gate和公开禁用原因，渲染后提交重核同一NPC。首谈npc.dialogueOpened、状态询问npc.statusInquired、实际支援npc.interacted分开；保留原免费首谈、确认2体力／advance15、既有支援换命令免费、critical低风险资格和合法危险命令自主拒绝。详见[ADR](../decisions/ADR-20261017-npc-public-actions-v1.md)。

真实15分钟模拟致死时，保留已付成本、时间、伤害与原前置效果；停止后置SAN/help、新order与成功，记npc.actionInterrupted并在最终command.rejected后自动checkpoint。四阶段proof不混淆推进前后，同一玩家父命令／业务事件与真实时钟子因果分别验。

| 证据 | 本构建实际结果与范围 |
| --- | --- |
| 真实source VM | 新portable110/110；独立正式110/110、隔离默认repo-root安装再110/110。原19cb21/110、r2 100/110负控exit1保留，公开索引含原SHA，原错误stack私有。不是浏览器／自然玩法 |
| 既有回归 | 38项合同全部完成；40次执行中39次通过，1次漏传shortage基线参数在游戏执行前失败，按原合同单独重跑43/43；static另输出原生JSON55。农务64、驻守41、attention29、rest74、方法76、安全28；原goldens不变 |
| 实际Chrome NPC | 112/112，8场，30份main HTTP全部同9ed，errors空。纯查看、1.018拒绝、E0首谈、实际支援／刷新、critical guard、自主拒绝、询问、两真实死亡中断。原生普通敌实际bite6，HP1→0；两中断和拒绝自动writer分别约661／659／654ms，保存前无pagehide或manualSave，再真实reload无重复 |
| 受影响Chrome | 农务35、断粮72、rest93、presence37、episode12，均同9ed、errors空。TEST-ONLY完整旧writer派生boot；rest真实hidden仍unavailable，episode只导出payload，不称完整raw writer |
| 自然fresh07 | 全新零存档注入，16/16与七项必需覆盖，60.493s／7主要动作，day1 09:23／HP100／E67／SAN75／food13／十人活／collapse0；3份main body同9ed。首谈0体力0分钟；实际同sergeant支援cmd119/player1、gross66→64、真实child120/timeevt52的15分钟与causation119，support/bond/help实际true/1/1 |

fresh07没有战斗、成熟收获、夜间、三日；Canvas观察／跟近0次，不能声称该分支经过实测或ActorObservation已授权。全writer只作证据和单列特权安全否决，不给NPC新增知识。旧自然01–06保持原源／原判据，未拼接为连续通过。[自然独审](runs/npc-public-actions-v1-20261017/natural-independent-audit/audit.json)已实际完成16组复核：逐项新原生16判据、52工件同SHA、18完整writer过实际9ed validator、78真实time收据与replay逐一join共203分钟；验证器只读，不start或advance，不把它算新browser。

NPC浏览器final01的原9/10失败保留：JSON.stringify将relations对象键序变化误当业务变化，完整payload深语义相等。final02先观察V打开后的普通writer，再单独比较点击view的业务值；没有放宽纯查看或改运行时。根代理目视本轮NPC2张、农务1张、休整1张，不声称看过全部。

六视角：玩家资格／同目标／代价一致；NPC保留在场、生命、命令与自主拒绝；营地固定人口和真实成本；势力无无来源信任奖励；敌人伤害与中断照常；全局typed结果、幂等、阶段proof、自动保存与旧历史不补造。仍未覆盖所有NPC动作／继任双岗／永久人物功绩、全局非整数时钟修复、Scenario真实boot、actor知识、最终尸潮、移动端或生产部署。大世界／多副本／特殊NPC连续性长期方向不变。

本轮新增L1为[NPC ADR](../decisions/ADR-20261017-npc-public-actions-v1.md)、[生命周期问题](../problems/PROB-20261017-npc-paid-action-completion.md)及[时钟风险](../problems/PROB-20261017-fractional-clock-calendar.md)。Skill／工作流只吸收资格、负结果分类、真实捕获阶段和自动checkpoint教训；无全局记忆写入。

归档传输：两份source报告引用的旧natural19原生报告输入不重复复制其旧私有参数字符串；[显式重绑定表](runs/npc-public-actions-v1-20261017/transport-input-rebindings.json)指向仓库已有同SHA原输入。实际执行报告／原字节不变；其余声明工件保留原相对路径，不能把传输布局当新执行。
