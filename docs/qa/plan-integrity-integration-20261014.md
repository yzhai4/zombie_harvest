# 计划权限、同日实例与界面集成

**状态：源码与renderer方法已验证，真实browser待执行。** SAVE21/CONTENT3、旧会议version1、原票权与原数值保持。

完整HTML SHA `58a4bb28453429c73ad27baf22a377e3b7ff389b387a524196a06e490b0a65e1` 已接开发dist。负责人逆向撤销同日冻结条件、新trust Guard和renderer三行后，完整字节严格等于基线412c；无其它运行时变化。回退使用完整412c，不只改schema数字。服务器和Sites未变。

## 实际行为

- trust<60经真实CommandBus拒绝support/modify/deny，不花CP、不改计划或奖励；拒绝账本/replay保持合法。
- 同日非idle会议包括force均返回原实例；额外SUMMARY不能清掉承诺或允许再次干预。次日首次新会议仍允许。
- UI读真实SessionController DAY Gate，resolved报告night=false、RECOVERY、LOSS、SAVING、EXITING及exiting会话均禁用；显示阶段/信任/CP原因，59.99不误显示为60。
- 原低信任committed保存保留选择/已花CP，按原日界结算；不撤销、退款或补故事/英雄/奖励。

## 同构建实际方法

| 检查 | 集成58a4结果 | 范围 |
| --- | --- | --- |
| 新 `check-plan-integrity.mjs`（99f4f1db…） | 48/48，exit0 | 完整实际inline VM；旧412c新方法19/48负控保留 |
| 新 `check-plan-integrity-ui.mjs`（def510b4…） | 69/69，exit0 | 实际renderer、注册handler、SessionController；中间15698新方法57/69负控保留 |
| 原报告恢复／内容链／计划日界／营地区域 | 177/43/27/16，exit0 | 各脚本实际sourceHash均58a4；四真实SAVE18适配保持 |
| inline／validate-content／night guard | exit0 | 源码/静态检查 |

源码轨迹 `c5d6c772`／`66c9368d` 未重基。新checker、完整TEST-ONLY旧writer fixture/meta与CI步骤已接线。fixture SHA `d9b8811fed88c25f9f1da0849d772d92e19742280f41e2aec3871d178d9bb05b`、FNV `707889bd`，由原412c完整VM实际commit+writer产生，非自然游玩或生产捕获。新48checker校原SHA/来源/commit↔replay/实际loader与FNV，不依赖运行旧HTML。

VM IO遮蔽renderWorld/Hud/Context、bootstrap Canvas、DOM布局、native clocks及queued timers；所改renderPlanMeeting、业务CommandBus、loader/writer未替换。“稳定”指JSON事实、账本、保存与queued IO，不能称对象引用不变。前一fb871业务独审另有36项补充控制，见[原独审](plan-integrity-candidate-review-20261014.md)。

412c的报告恢复48/1682实际browser不能移用为58a4通过。新七case正在准备：公开计划入口、合法一次干预、同日真实额外遭遇、两次reload；严格三日也须新空profile，不改旧412c FAILED。

## 六视角与剩余出口

玩家得到一致旁听/干预提示与固定承诺；NPC原票/选择/身份保持；营地不重生产/补点；势力不因权限修复生成外援；敌人/夜战保持阶段隔离；全局链保持instance/command/receipt日界因果。

全十NPC/30节点、主动技能消费者、80关系可达路线、presence/refusal、MeetingV2、科技及最终尸潮仍待开发。本可靠性前置不重新定义整个v82–v90目标。无全局记忆变更。
