# 补给箱成本提示与旧动作来源

状态：open；在19cb自然fresh06独立复核中确认，未纳入本轮农务修复。

初始公开补给箱事项的aHint显示消耗6体力，实际supply分支spendEnergy(4)。fresh06完整writer记录E78→74、food8→11、parts4→5、eventThreat=1；事件确实发生，但UI成本承诺与真实支付不一致。下一修复应以剧本合同确定正确成本，再共享UI与执行所用定义；不能把已发生的旧支付重算为6，或以改报告掩盖不一致。

同轮旧event.resolved／resource.collected成功事件actor仍system，而父replay是player-1。农务19cb修复明确限定crop父命令与crop.changed；NPC／landmark／build本轮观测到player-1，不代表所有命令统一。来源修复前不得给旧system事件猜测人物、补功绩或记忆；后续按实际公开调用逐项核对固定业务actor、系统时钟与causation。

原证据见[自然fresh06](../qa/runs/crop-target-v1-20261017/natural-fresh06/report.json)及其原始writer，独立于七项行为coverage完成。玩家需要真实成本；营地资源守恒；NPC功绩需事实来源；势力关系不得从空来源奖励；敌人压力维持实际事件值；全局旧账本不追溯修改。
