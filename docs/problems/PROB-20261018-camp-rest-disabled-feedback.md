# 等候入口禁用原因未公开

状态：validated／列明范围已修复验证，selected与manifest已通过本地freshness；证据发布提交的精确CI由PR #4／本轮最终发布收据另核，本段不预填。源码对象1db8954edb1565acb5ffcd817cde9558873313c3／HTML108042213a6defbfd16cbd2f56cde8fbc2c575717c5eefff942753353a19b09a，见[本轮QA](../qa/camp-rest-feedback-20261018.md)。原问题来源：dccb、开发head9b387549；[公开路线A02／B02](../qa/public-relay-mainline-20261018.md)。

## 复现与影响

玩家完成真实核心交付并回到营地，context显示30／60分钟等候，两按钮disabled；副文字仍只是“不额外治疗／世界继续运行”，常驻状态还要求靠近庇护所。A02／B02最终公开UI和截图均保留。玩家难以区分附近危险、被追踪、无法确认安全、会话或地点条件；自动操作者还把disabled误报为入口缺失。

A02事后live资料符合原nearby-threat拒绝，未原帧调用Gate，B未另核实际原因。不是等候规则错误、无路可走或食物0软锁。原运行结果保持exit1，不覆盖为成功。

## 最小修复合同

- 同次真实Gate结果驱动按钮disabled与旁边可见短说明；之后每次render更新，提交仍重新检查原Gate。
- 复用原原因语义，显示“附近存在威胁／仍被追踪／无法确认安全”等粗信息，未知原因保守降级；不泄露敌人ID、坐标、数量、类别或隐藏感知记忆。
- 说明常驻可读，不依赖disabled按钮hover或点击。安全可用时恢复原时长与风险提示；等候中、完成、取消仍显示真实进度／原因。
- 不新增food／energy硬禁，不改变危险半径、伤害、时钟、奖励、人口、SAVE21／CONTENT3或自动执行；“可等候”不承诺未来安全。

六视角：玩家得到可行动解释；NPC不被迫冒险或保证保护；营地不补资源／工时；势力不新增收益；敌人压力不改且不泄露定位；全局链仍以真实接受／中断与writer为准。

## 验证与后续

最终同构建source43／43（含camp-rest77）、新反馈Chrome14／14、既有休整93／93及episode12／12均实际terminal0；休整六场verified，真实hidden仍unavailable。实际危险使用原A02终态native，unknown／safe两场为TEST-ONLY派生。旧dccb source74／77与Chrome3／6负控保留；中间60a的390局部p落在首屏下方仅是呈现缺口，v2一行前置p后重新验收，未改Gate或回填原失败。正常保存／刷新和取消保留，未解除危险规则。未证明自然主线、平衡、完整移动端或生产部署。

方法单列：下一版区分absent、present-disabled、enabled；不能退役已有公开等候入口的点，也不能据事后几何生成下一条隐藏导航。新方法另冻身份，不改A02／B02。
