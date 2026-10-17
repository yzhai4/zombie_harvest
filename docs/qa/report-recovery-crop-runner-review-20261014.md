# v4 公开收获 runner 独立方法审查

**结论：METHOD_FREEZE_READY，可以冻结后另跑完整48-case；尚无v4真实收获或browser通过结论。** 本独审只读唯一runner owner代码，没有改runner、runtime、CSS、原v3报告或profile。被测HTML仍412c，源码177范围不被方法控制代替。

| v4文件 | 最终SHA256 |
| --- | --- |
| server-report-recovery.py | `32273364d4ae4373938d005ab70bad95bd42f6b41f79020da85d4ce348878845` |
| report_recovery_full.py | `a1d1c54d10e82dc2c9e7a7f2b098d245f170ada27a08140223a913db0988f483` |
| report_recovery_fixtures.py | `c9ec8771a76b2e6e8581cf3fa2c9edb6b667410e5f62448acc66201a51467e8e` |

## 验收逻辑

四个既有DAY DOM控件均须disabled解除，gather/build/endDay三个常驻入口另须visible+enabled。隐藏旧cropBtn明确记为legacy duplicate且不点击；公开crop入口独立由靠近成熟菜畦后的动态按钮验证。生产v81原CSS/交互依据与v3七条失败归因见[crop控件审查](report-recovery-crop-control-20261014.md)，原失败不改。

B1先完成原报告时刻的唯一close、SAN因果和建造drawer开关检查，再通过公开WASD和可见地图tile导航到原garden(7,14)。代码要求实际近场按钮visible/enabled且文案收获，没有隐藏click或GameState注入。导航后通过真实reload/pagehide拿合法FNV/schema/calendar的SAVE作为pre-crop基线，核原player位置、DAY/no battle、原close receipt保持；随后公开continue，在保存位置再次看见按钮，实际点击收获并等待真实checkpoint。

收获成功不能仅靠空crop.changed receipt。比较器要求同garden ID/坐标/type由ready/planted/growth2变为false/false/0，seed不消费，前后同唯一NPC身份；唯一新crop.changed commandId关联唯一public crop.change replay（真实payload buildingId:null）。内层time.advanced必须causationId关联该crop command、minutes20、唯一world.advance replay，且crop receipt发生在推进后；所有新增clock receipt的分钟和须等于实际calendar差。

食物核账要求同日且ration/upkeep水位不变，净food差+真实NPC餐消耗=3。NPC餐只允许已存在NPC ID、actorId同该NPC、准确三字段npcId/need=hunger/整数food1；其余只允许冻结clock/NPC/relay已知非food类型。未知类型、landmark/content/未来供给事件、已知非food事件中嵌套food字段均拒，不猜补偿，不把receipt补成未记录的delta。

收获后实际saved payload从close()返回，作为两次reload的资源/garden/seed基线。reload要求整份最新300 ledger精确等于原tail+完整新窗口，所有clock唯一replay及总分钟解释calendar差、同唯一NPC身份、同已收获garden、seed不变、无新crop receipt/command；food仅扣记录的NPC餐。原close与关闭报告SAN补偿receipt另精确保持，不能拿pre-harvest资源去要求永久相等，也不能把正常DAY推进当第二close。

## 独审发现与最终复验

较早v4稿的food blacklist遗漏真实landmark.discovered及未知供给；24bb稿虽已改food fail closed，仍可接受整体ledger interleaved、reload无receipt却calendar+1、reloadseed无记录减少。独审已用提取实际源码的独立method witness复现，交唯一owner最小修复。没有改或美化任何v3失败。

最终a1d1从实际class/function源码提取执行 **39项owner synthetic method controls和7项独立变形控制全部通过**：上述三假正例现在拒绝，unknown/food-field竞争事件继续拒绝，真实shape正例仍接受。私有输出 `v4-crop-method-a1d1-independent.json` SHA256=`a675ce7a44105dacca90d6cdeda983d4e03f482a108d87be5ee3a822c15f8e46`，明确gameplayExecuted:false、realBrowserLaunched:false；合成单NPC witness只用于比较器控制，没有安装到游戏、制造居民或收成。

此审查确认方法可以用于真实验收；尚未证明导航成功、实际收获+3或v4全矩阵通过。应将三最终SHA复制到新的独立QA目录，新run终止后保存原报告/输入/实际SAVE/receipt/trace/截图/terminal，独立审计。首轮291a、第二轮412c/v3均维持各自FAILED；源/方法/infra/局部事实/完整browser结果继续分层记录。
