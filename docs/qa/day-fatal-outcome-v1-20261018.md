# 白天玩家致死结局：开发 QA

源码与真实 Chrome 已实际终态；开发 ref/精确 CI 以 PR #4 本次发布收据为准，生产未部署。范围为 source-VM 和明确 TEST-ONLY 完整旧 writer 夹具，不称自然三日、真人收益或全项目完成。

## 实现与来源

source commit `b598c3770bdf216bd7c77f5bef2f0390e43e31aa`，tree `46bec09a802d5d66d880ac60da0c4018efc79f40`，parent `2878def41148ad492d1b84d3bcf913b96a4afdb3`。HTML `7b23b0b757ed2242903c952f54c5c31145499ba98280aa80f1578e64b78780cc`，944195B，SAVE21/CONTENT3；8个变更 blob、175项 scripts/dist/workflow 依赖逐 Git API 树匹配，其它5679 blob不变。源对象存在与 ref/CI/部署分别确认。

[合同](../decisions/ADR-20261018-day-fatal-outcome-v1.md)：真实敌袭、原攻击反咬、成功效果事务致死均形成 sourced DAY loss；已付成本与实际命中/时间保留。经Bus的路径在最外层命令最终成功/中断收据后才清理并保存；无Bus直调只承诺效果事务边界。休整步数与实际消费分钟一致。新可选来源胶囊不回填旧死亡。DAY 报告先于旧夜战历史，正常保存/Continue保持 LOSS；写入失败保留现场，公开重试同一结局，公开重开复用既有清档和 generation。

普通非致死反咬现在也产生真实 `combat.damage.applied`，伤害和原 SAN 不变，相关事件序号/hash会变化。加载校验覆盖字段与保留窗口引用，不重新模拟全部历史攻击。无 Bus 直接效果只保证最外层效果事务边界；未来直接链调用注册致死内容须补完整命令边界。当前生产作者定义没有 HP 致死效果。

## 实际源码结果

最终46项既有源码/方法合同实际一次矩阵46/46、exit0、输入无漂移；包含原时钟8组。另新 DAY fatal 一个合同6组、exit0，输入无漂移。矩阵 closure 原 SHA `3af0c841ee4afc8b4b06bd698a7fd795d717caaece0fd9ed1a676744bb4daedc`；新 fatal 原报告 SHA `16dc65ccaf40f9247ecc5204ed3e64da665d439b3c3200b02992504363e826cd`。47个唯一合同与各自内部检查分列，不将子检查相加为独立产品能力。

六组包括：原1200ms自动回调致死、最终正常writer/Continue；真实付费攻击子推进致死、未到达收益停止、MAX_SAFE必要父子耗尽；暂停时原反咬与一次主写抛错后的重试；TEST-ONLY真实注册过期 fallback 在午夜休整子步扣HP、completed1及最终账本；效果失败回滚/同事务回血/稳定致死；真实旧 RESOLVED18 报告、旧HP0/null拒绝与坏新槽。旧槽缺失不造历史，own undefined不能被JSON抹成缺省。

rest 的生产近敌 Gate 保持；邻近敌人不能被强行用来启动等候。午夜 HP 内容定位是防御性接线夹具，当前生产剧情可达性另核。正常 bulk30/1440/1440 真实到 day3/world3270/HP0并保存同一 LOSS，下一次推进拒绝；这证明结局恢复，不能称三日生存或自然玩法。

当前 content-chain 原54检查通过，source CommandBus trajectory hash `c5d6c772`；它与保存投影 replay hash是不同范围。

## 实际 Chrome

三场64/64、9次主文档响应、errors空、context/browser/server cleanup均true：真实timer敌袭、暂停后公开F原反咬、同F路径一次明确testIO主写抛错/公开重试。真实timer由08:40到08:48，normal敌人wz-4实际6伤、HP4→0，最终正常writer已先于reload观察。随后实际Continue同LOSS、等待无新模拟/奖励、公开重开清档并进入新boot。

fatal原报告 SHA `4a6c13cc7bdbcdc3e8ede80c3cde63406801c3302ae5650253e80e7d7bcac696`。同源原canonical episode另12/12、2main、实际exit0，原报告 SHA `04ade8bac61160327ad06de5fa04f4bfc0a0d35cfdf42e5ee47063f982bfa412`。合计11次实际主响应均完整同7b23；69个工件引用回读SHA/bytes一致。root已目视桌面和390宽已保存/保存失败报告及重试入口。旧2bad clock Chrome10不移作本构建结果。

第三场只证明所声明的主写setItem抛错，旧主备字节保留和重试成功；不扩大为任意存储故障原子性。所有夹具只在 boot 前完整注入，没有运行中写GameState、删敌、补资源、隐藏advance或直接调用死亡helper。

## 原失败与方法更正

原2bad同最终方法真实0/1、exit1：第12次原callback、normal6伤、HP4→0仍DAY/gameOver-null，保留为产品负控。更早8callback未命中的0/1保留为方法预算不足，不算产品反例。

7b23新合同首次5/6的唯一失败是旧夜战标题预期错误，原件保留；窄修为实际旧标题后6/6。第一次广义矩阵41/46、第一次四方法重跑2/4均保留：隔离提取缺新实际helper、缩进边界误吞声明、自动敌袭与新反咬收据混计，以及新三日测试提前一次断言死亡。源码依赖和期望窄修，不 mock Gate/致死/renderer；独立阶段诊断证实真实第三次推进与自动writer均HP0。最终46/46是新执行，不追溯改旧失败。

## 后续

本片补真实个人失败和可恢复事实，不改变NPC人口、营地核心、势力承诺或已完成链历史。下一为中继当前受损能力与公开付费修复，再接公开完整主线和已有理解pilot。完整Actor/Planning/Memory/Social、Studio、多副本/大世界、UI素材、GameCore/引擎与P0–P6仍开放。

本轮新增记忆为上述ADR、问题闭环和终态/收据来源工作流教训；两项项目Skill已通过格式校验。选定工件和来源以[manifest](iteration-manifest-v1.json)绑定；本地Gate与Git API证明、精确CI、生产状态分别记录。

选定93个新工件／7,853,331B已安装，275条inventory绑定；manifest SHA `7b86b92f023f8ee250d2b18082cddb1f955af6f11e534623c08bc5707165a1b7`。11份当前原生报告保原字节；未选完整历史和重复snapshot按原SHA/bytes外留，原失败摘要明确为non-native，未改绿。外部归档预检/8MB超限原件保留，不计游戏失败。

本地freshness实际19/19、方法self-test76/76，均exit0；无本地.git，commitVerification=unavailable。175项Git API树匹配独立列明，更新开发ref后的精确CI仍须按实际run/head核验。ROOT已目视选中三张390图及原桌面图；这些Gate与图像不构成生产或自然玩法验收。
