# ADR：Scenario初始绑定的C1交付合同

日期：2026-10-17。状态：开发实现accepted，源码d6592443／HTMLa2fcdb64列明pure14/source120与Chrome C1 134验收，详见[QA](../qa/scenario-boot-c1-20261017.md)；生产未部署。本ADR只定义完整[Scenario boot ADR](ADR-20261017-scenario-boot-contract.md)中的初始绑定交付，后者仍proposed/open，JSON storylet编译和原子注册的C2要求全部保留。

复用既有ScenarioPackageV1纯核心、真实fresh/continue入口、保存draft与同步安装，不增加第二解释器或注册框架。仅新局一次绑定uint32 seed（含0）与初始食物库存/有限berry采集次数；具体支持矩阵沿原ADR。普通固定十人是当前验证roster，不是长期世界或特殊NPC数量上限。不支持倍率/profile/authority明确拒绝，事件目录仅支持已对账的原断粮v2，不宣称JSON效果驱动了运行时。

prepare完成全部校验后才安装；scenario.bound只记一次。首次正常writer成功之前不运行世界；失败是已安装但冻结待重试，不能称内存从未改变。保存重试保留同一初值与账本。继续旧档不执行fresh配置或重算世界；bound保留真实随机进度，缺绑定旧档显式legacy-unbound并保留原声明来源。

合法观察者设置只改变current表达偏好，不改变initialAiConfig/digest或能力。公开开始设置必须在真实install/first-save路径生效，并由实际只读表达consumer验证enabled/mode/authority；隐藏后直接调用handler或只核writer旗标不能代替公开验收。该literal probe不证明实际NPC对话或角色知识授权。legacy-unbound的live seed/sourceSeed始终等于实际旧worldMeta.seed，原声明另存declaredSnapshot；旧finite seed表示单独兼容，新bound/fresh不放宽uint32。未实现旧AI字段只允许有收据、可回放的明确降级，不给模型增加权限；未来binding/坏实体不能用降级吞掉。

验收按实际consumer分层：纯核心与inline同字节；公开start/Enter；真实LCG及spawn消费；真实库存/berry与未来产出不缩放；失败准备原子和首存重试；完整旧writer、命令/迁移幂等、设置与reload。源码场景、每份boot前配置HTML变体、canonical浏览器、旧档浏览器分别绑定输入SHA，不混成同一构建绿色。自然三日、平衡、C2编译、角色知识和生产部署另验。

六视角：玩家看见的配置/设置与实际结果一致；NPC岗位/生命/关系与需求不被食物轴改写；营地初值一次结算、耗尽保持；势力来源与连续性不凭metadata新增；敌人规则保持、未支持倍率拒绝；全局身份/随机流/预算/失败/保存/历史可追溯。更大世界、多副本、特殊NPC连续性仍是长期目标。
