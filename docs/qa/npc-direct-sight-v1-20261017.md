# NPC当次直接视线报告：开发验收

日期：2026-10-17。只覆盖[本片合同](../scripts/npc-direct-sight-observation-v1.md)，不关闭完整ActorObservation或长期项目。源码提交：4e6847c2e022f28690df40297bdfd640b49ed444；HTML `23b8c8c27234592673aa927f3909ea49247c372a937787f90355f87531f421b0`，SAVE21／CONTENT3。生产未部署；精确发布head／CI从[PR #4](https://github.com/yzhai4/zombie_harvest/pull/4)与服务终态另核，不沿用上一构建绿色。

## 玩家结果与真实路径

附近NPC查看仍为免费、零耗时、1.25格。新报告只说明该角色当次实际看见的一名日间活敌的类别和距角色粗距离；NPC能向尚未知情的玩家报告合法所见，不要求玩家先发现敌人。context与同ID名册卡显示“第X天 HH:MM · 本次所见”，普通重绘保持原revision；新查看／目标切换／关闭／资格失效／phase／session变化清除。原短状态toast、首谈、2E／15分钟支援与真实死亡中断保留。

调用链为实际公开view Gate→当前同引用NPC→私有严格输入捕获→实际perceptionProfile／canPerceive／原LOS→ActorObservation特定policy→实际NPC到玩家trust披露→固定作者文本。UI缓存不含目标ID、坐标、HP、候选集合或原knowledge；不可确认结果统一中性，不归于NPC发言、不保证周围安全。没有新增命令、奖励、时钟推进、contacts续期、地图发现或保存域；未接LLM。

## 执行证据与计数

| 层级 | 当前构建实际结果 | 入口 |
| --- | --- | --- |
| 不同源码合同 | 既有42＋新direct-sight一个＝43，通过；子断言不能再次加总为合同数 | [旧42索引](runs/npc-direct-sight-v1-20261017/legacy-source/index.json)、[新source索引](runs/npc-direct-sight-v1-20261017/direct-source/index.json) |
| 新source | 最终冻结方法91／91；实际Gate、profile、LOS、reader、writer与renderer，未mock新规则 | 同上direct-source |
| 关联source | C1 120、C2 66、self104分别通过，已包含在42内；294份冻结输入执行后未变 | 同上legacy-source |
| 实际Chrome | 新direct200＋原self212＋NPC112＋episode12＝536，四套均exit0／errors0／清理成功 | [浏览器执行汇总](runs/npc-direct-sight-v1-20261017/browser/execution-summary.json) |

57个实际记录的主文档响应绑定同23b8：direct12、self13、NPC30、episode2；不把同一响应的两个记录数组重复计数。root目视direct桌面、context390、roster390、low-trust390四张原PNG，新行全文可见。名册仍沿旧三列，移动端信息密度高，完整UI打磨继续开放。四个新场景为明确TEST-ONLY原生writer预启动档，暂停时钟；普通redraw／resize后2.1秒保留与公开N后的BATTLE清除实测，不称自然时间推进、午夜、自然三日或体验收益。无新作物／休整／presence／C2浏览器或trusted-hidden运行。

## 原失败与修复

首稿36b8原方法82／85失败含一个真实死敌误报及两项方法问题（私有hideContext被当公开关闭；SAN变量被原需求负项抵消）；修正方法84／85仍复现死敌误报。最终91同方法在36b8为86／91，五项失败覆盖dead标记、预算unknown行消失、freeze、restart和context A→B→A旧行复活；它们不是五套独立运行或五个独立根因。c420同方法5／91仅说明该功能尚不存在。

修复沿真实day combat的dead!==true；预算超限只使新报告unknown，保留世界；关闭与会话冻结在停止render前清理，普通名册显示不被未展示报告的context误清。producer首轮90／91仅为跨VM数组prototype断言方法错误，修正后91／91。一次已启动的重复正控明确标为redundant，不增unique。全部原失败仍外部保留；公开删改副本显式携带原SHA及结果，不伪称原报告字节。

## 归档、六视角与边界

证据按SHA复用既有仓库原字节，新增对象只存一次，portable transport map可恢复声明工件；未另建大ZIP或复制整仓库。原报告、runner、输入、HTTP、截图与实际terminal分开绑定。独立架构首稿预算文字误留Object.values，保留原件并更正为当前for-own有界枚举；这是审阅文案错误，不是新游戏缺陷。

玩家得到有来源的决策线索；NPC只说其实际所知且愿披露的粗事实；营地人口／资源／岗位不变；势力不凭空增信任或网络情报；敌人保留AI／伤害／位置与真实死亡；全局账本无新事务或奖励。报告不承诺NPC必定救援。

完整contacts来源／TTL与共享、有效岗位／继任、其它对象及事件知识、全局NPC HP／lifeState一致性、旧eligible重复事件、旧E预览／名册raw target文本、自然多日、玩家实验、完整移动端、LLM、引擎迁移和生产发布均独立开放。后续规划与记忆只依赖其实际消费者所需的已授权事实，不以完整观察ADR作全部玩法的无限前置。[玩家pilot](../experiments/EXP-20261017-npc-recon-pilot.md)仍draft，尚无真人结果。
