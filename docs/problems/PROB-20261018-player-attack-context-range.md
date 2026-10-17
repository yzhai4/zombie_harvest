# PROB：玩家公开攻击范围与实际提交不一致

状态：本问题所列DAY公开攻击资格／同目标提交缺陷在HTML3545开发候选已验证修复；开发分支精确CI见[PR #4 Checks](https://github.com/yzhai4/zombie_harvest/pull/4/checks)，生产未部署。站点受损能力、全局战斗归因与完整公开中继仍另列开放。

原54ef公开续段v5在enabled attack、距离约1.1899时被工程安全veto挡住，未按F。该轮本身没有挥空、支付或空成功证据，原失败／正常writer与较晚live水位保留。随后同完整旧writer派生的实际source负控在1.19处观察到按钮enabled、wrapper `ok:true`及空`threat.attacked payload:{}`，没有命中／推进；这是新增执行证据，不回写为v5已提交过攻击。

最终3545共享真实1.15 DAY范围与目标Gate：附近威胁仍可见，外侧disabled及按钮外粗原因；显式渲染ID提交失效不换敌，默认F保原锁定／首项。拒绝在动画、锁定、5E支付和伤害前完成，成功含同目标立即伤害、gross支付及真实子推进proof，duplicate不再次结算。没有扩大半径、加epsilon、自动靠近、削敌或改变夜间独立攻击。

另一个本动作保存边界已实际修复：b548 rate .25真实成功付费／命中后推进2.5分钟，保存返回true但实际validator拒绝`calendar`。最终候选在支付／伤害前拒绝这类不可保存的本次推进，.5／.8与paused0分钟仍按原规则工作；不声称全局时钟或旧坏档已修复。

证据：候选source5／5、旧公共consumer负控0／1；Chrome三受控scene26／26，outer桌面／390粗原因可见，inner一次公开F及正常writer→Continue→新tick不重复。实际F gross5、立即100→50；推进中NPC另伤38使目标剩12，玩家86→72含真实敌伤6与原反咬8，不能全归为一次武器伤害或宣称安全。两次方法失败与倍率原反例均原样保留，详见[本轮QA](../qa/player-day-attack-v1-20261018.md)。

这只关闭本窄入口与结算合同，未证明自然三日／完整中继online／真人体验。下一先处理[中继当前能力与损毁修复](PROB-20261018-relay-station-operational-state.md)，再继续公开主线；旧档、旧空payload、原成本／敌人和长期目标不追溯改写。
