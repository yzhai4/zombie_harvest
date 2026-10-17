# 统一命令编号与真实修墙回执：开发集成

日期：2026-10-14。状态：**开发dist已集成；源码与renderer方法通过，公开维修browser和发布待验收。**

当前完整HTML SHA `faecaffd12aefdf3c1c0f1dd57130bbb2ba37d5da0e9a6e81bc1f7532733335c`。第一切片db945a仅改变CommandBus；第二切片faec仅改变repairBuildingReducer/repairBuilding。负责人分别逆向撤销两切片后，完整字节严格等于58a4，未携带其它运行时变化。完整58a4/db945a私有回滚原件保留，服务器和Sites未替换。

统一Bus第一次使用formatter往返一致的safe canonical ID时先预留commandSeq，自动编号避开当前seen/replay/active父ID，父子推进各有真实收据。旧opaque字符串和旧duplicate兼容，安全整数耗尽明确拒绝，仍沿用既有保留窗口，不声称永久去重或全局事务回滚。

维修先验证真实DAY、时钟可推进、当前同一唯一ID墙对象、既有距离、明确HP、材料/体力及子命令预算。无目标、满墙、外来对象、错type、越距或不足不发building.repaired/奖励。合法成本仍wood2、energy14、HP+1、advance20；成功payload记录真实目标、支付截面、实际HP/日历、nested命令因果和推进副作用。原净delta保持，但不把被动体力恢复或NPC用餐混作gross支付。

SAVE21/CONTENT3保持；仅扩充既有event payload。旧receipt没有proof时原样保留，不补造人物功绩、英雄、NPC flag或故事成功。新TEST-ONLY完整旧58a4 writer夹具SHA `38dd27970b53e5569d01f6bdd60dc04503c94c1342845e00eb78c091b9accb52`、FNV7d1f72f4，meta明确不是自然路线或生产捕获。

## 集成验收

| 检查 | 负责人实际结果 | 证据边界 |
| --- | --- | --- |
| 新命令编号 / 修墙checker | 28/28、41/41，repo路径显式输入再验 | 完整inline VM、真实bus/advance/repair/writer/loader；IO与场景明确TEST-ONLY |
| 原恢复/计划业务/计划renderer/内容链/日界/区域 | 177/48/69/43/27/16，全exit0 | sourceHash均faec；真实SessionController及被测renderer未mock |
| 源码轨迹 | content c5d6c772、plan66c9368d | 原golden未重基 |
| 原保存投影 | 9夹具、4aec7a31 | 原脚本不变字节在私有布局执行；不是运行时模拟 |
| 语法/content/night/static smoke | 通过；55 static、0失败 | 明确无Python浏览器，不能代称三日游玩 |

独立候选审查另有Bus28、维修31；初版a530的父子撞号失败及方法包装错误保留。GitHub仍7f30/CI65（58a4），本轮新runtime/checker/fixture/CI步骤尚未上传，不能把CI65移用为faec绿色。

六视角合同见两份PROB：玩家支付/距离可解释；NPC未来消费真实功绩；营地库存/HP/用餐分账；势力不增外部奖励；敌人消费真实推进；全局任务只消费真实成功。完整阿梁个人链和十人体系仍待开发。本轮严格三日失败运行使用58a4，与faec检查分别记账。无新增全局记忆。
