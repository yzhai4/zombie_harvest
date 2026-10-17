# NPC公开近身范围与支援执行范围

状态：open；农务候选未修改NPC规则。

冻结6b8的自然fresh05在白天公开context中显示贺川支援按钮可用，点击后提示“靠近贺川，还差0.018159931163698628格”，没有实际support／bond／memory变化。该轮其余六项已覆盖，14/14已执行检查不能证明七项路线完成；原报告保持INCOMPLETE_COVERAGE／exit1，SHA3004fd66ee83951ae37e566cadb75229ce3f03b8bd39b340a34708c223cc0a1f。

源码renderContext／nearbyContextItem以1.25连续半径选NPC，interactNpcReducer和setNpcOrderReducer的实际执行半径为1；角色移动也会令已渲染按钮过期。当前需要分开呈现可查看／可请求／已请求的资格，并在执行时重新校验原NPC，不能把提示靠近的空npc.interacted记录当作支援成功或人物功绩。

下一评审决定UI显示范围、动作禁用／接近提示与实际支援范围如何一致，不在农务切片中擅自提高NPC动作距离。自然runner可按公开提示与当前可见角色位置进行有限贴近，再核实际状态／回执；成功只证明该路线真实完成，不表示本UI问题已经修复。人口、岗位、健康、驻守和真实敌人风险仍沿原规则。

开发解决：源码80dea63c／HTML9edb6d3c统一查看与动作资格、同ID重核及typed结果，source110／实际Chrome112与fresh07通过；见[QA](../qa/npc-public-actions-v1-20261017.md)。下方原问题与自然fresh05仍保留，生产未部署。
