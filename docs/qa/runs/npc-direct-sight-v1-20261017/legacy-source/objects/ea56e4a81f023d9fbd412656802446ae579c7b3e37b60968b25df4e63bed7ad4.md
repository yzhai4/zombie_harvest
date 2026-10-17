# NPC lifeState 与 HP 的语义一致性缺口

日期：2026-10-17。状态：**global open；新 self 的只读缓解已在68834890及后续UI构建d2512764分别独立 source VM 定向验证**。本记录不授权修改旧 Gate、validator、保存事实或全局健康政策。关联[自身观察 ADR](../decisions/ADR-20261017-npc-self-observation-v1.md)与[剧本卡](../scripts/npc-self-observation-v1.md)。

## 已确认事实与范围

独立审计在冻结 HTML `9cb2a92ce80fb071ec0f4d61a6434b2a42781f97e73ee6d639157141b30e96ea` 上实际执行完整 inline、公开 start、真实 writer、validator 与下一 runtime 的 loader/start。TEST-ONLY 场景将已启动 runtime 中 doctor 的 `hp=1`、`maxHp=100`、`lifeState='healthy'`，并设本人合法需求为 hunger0／fatigue0／energy100、真实个人 trust0；玩家移到该 NPC 的合法交谈位置。其余世界来自真实 fresh start。没有伪造 observation、成功收据、伤害或自然经历。

真实 writer 成功写出完整原生保存；实际 validator 返回 ok，随后实际 loader/start 保留 doctor 的 healthy 与 HP1。新私有 self 捕获／投影／固定表达组件在保存前与恢复后均生成：

> 我目前没有受伤。我的生命余量已经很少。

对应披露事实为 `lifeState='healthy'`、`hpBand='0/4'`。本反例直接检查真实首谈使用的组件，没有将该不一致场景描述为浏览器点击或自然发生。另一个独立场景确实执行了 critical＋E0＋暂停时钟的真实 `npc.interact`，仍为免费 `npc.dialogueOpened`；两种场景不混作同一证据。

当前 validator 与原 `npcPublicActionGate` 校验合法生命枚举、HP 范围和 dead／HP0 的关系，但不要求存活 lifeState 与 HP 分段一致；原 `npcLifeLabel` 也直接相信 lifeState。因此这不是纯格式函数接受任意输入产生的授权漏洞，也不证明自然模拟会制造该组合。它表明真实 writer／loader 可保留的旧形状，尚不足以支撑新自述中的一致伤势断言。

## 原始工件绑定

原件在独立外部审计目录保留，尚未作为本构建 QA 工件公开安装；此处用文件身份与 SHA256 记录，不写机器内部路径。

| 工件 | SHA256 |
| --- | --- |
| `TEST-ONLY-healthy-hp1-source-native.json`，实际完整 writer 原字节 | `8b64d54a0d04abd943ad928c495135270579023c96324b892e45abdb2fe545b4` |
| `report.json`，独立修正方法实际17／17及单列诊断 | `ebcb158099f8d8699246aed995ccf92fea10aa31c354cec9b18b59e54d30d964` |
| `audit-v2.mjs`，执行审计脚本 | `8bc121f903ee5becccbe0395ac55917deaccac8363d28a686ab7fc8bcfcde6c6` |
| `inputs-manifest.json`，冻结来源索引 | `f0c0d65c82cf2c6e7c9aa432c6d9a0a1a3f7773266793090fe15fee9346a4b12` |
| `npc-self-observation-v1.mjs`，实际纯模块 | `86f289dee003c059118a3647c4b1ac22f04a446c03c9dbbaa372f9673da00734` |
| 原 IO adapter | `554c400c174ad1b069c4dfcc839c12b3b45ea79c5aa7669e093a440ffa4845d3` |
| 原 full-inline fixture adapter | `e9872eeba85d49019d1bd806f3dd18357a5abc8f2f92922922f6a5324ec220dc` |

审计使用模拟 DOM／storage／timers；原 IO adapter 遮蔽 renderWorld／renderHud／renderContext，没有运行浏览器。捕获、投影和 reducer／Bus／writer／loader 使用真实源码。17项通过不是全套验收、自然游玩或全局健康一致性关闭证明。第一版审计有一项 undefined trust 被审计 helper 自己的解构默认改成0，原失败脚本／报告另留；该方法错误不是产品缺陷，未改源码来迁就它。

## 最小缓解与后续出口

新 self 捕获应只读核对当前 `syncNpcLifeState` 的实际存活分段：HP<30 为 critical，否则 HP<maxHp 为 injured，否则 healthy。不一致时返回统一不可观察／无法确认，不默认健康，不输出身体详情，不修写 NPC。原免费首谈、UI 确认、命令收据、支援成本和原 writer 保持原合同。

该缓解必须在新冻结 HTML 上另验：原完整保存仍经真实 loader 保留 healthy／HP1；self 组件降级为统一 unknown，实际免费首谈不归因“没有受伤”，无额外体力或时间；实际 writer 不改该 NPC 的 lifeState／HP／关系／需求。原一致 healthy、injured、critical、HP0／非法健康、E0 与暂停时钟边界仍须保持各自原准入与降级。

全局 validator、lifeState 归一化政策、旧名册／查看卡的一致展示仍 open。不能由本片捕获缓解推导旧档已被修复、全局 UI 已一致或完整 ActorObservation 已完成。

## 只读缓解的实际复验

另冻 HTML `68834890643f962c46b1c7c74e52d8f436609b260d31e079df2b579f26eef395`、纯核心 `715fca749327bc1302aa4869adda94044e5dfa9c6dd24cac733f1b98a7575868`。capture 与 pure project 共同使用纯 `npcSelfLifeState` 作上述实际阈值的只读比较；失配只让新 self 输出统一不可观察，不修改原 Gate、validator 或 NPC。

独立外部实际19／19通过，包括原17项同方法正负控和两项本缺口的 delta 验证。相同派生场景经新源实际 writer 写出的首份 native 仍精确为原 SHA `8b64d54a0d04abd943ad928c495135270579023c96324b892e45abdb2fe545b4`；validator 仍接受，真实 loader/start 仍保留 healthy／HP1。保存前、恢复后新 self 均为 `not-observable`／`lifeState='unknown'`，没有 hpBand／needBands，文案为“暂时无法确认这位角色的伤势信息。”。

随后实际执行首谈，仍是 `npc.dialogueOpened`、gross0E／0分钟、无 advance；fallback toast 不冠 NPC 名称，不声称没有受伤。真实首谈后 writer 的 doctor 全字段与首份 native 相同，保存顶层 key 集合不变；第二次真实 loader/start 仍保持 healthy／HP1，self 仍 unknown。原一致 healthy／injured／critical、需求／信任边界、reverse garrison、深冻结纯读、session generation 水位及 critical＋E0＋paused 首谈同时保持各自通过结果。

| 新复验工件 | SHA256 |
| --- | --- |
| `report.json`，source VM定向19／19，global open另列 | `c7c7f13ada06020bd779ceffdfffb06d5921b5394ff6be2a47a70348f45acf22` |
| `audit.mjs`，本次执行方法 | `655a4d68c31316e1ff8115f95004e27e1e62b186ef25c5ca15620d1977abea33` |
| `TEST-ONLY-healthy-hp1-after-first-talk-native.json`，真实首谈后writer | `c4caa68a3b969c2debc8b2302d5c78447121135d6df596afee4abb18be3d1801` |
| 本次 `inputs-manifest.json` | `6b80067bf090599f9f13456ab1364cb6364f10b96ccc4d022c8c99646199bb30` |

这些结果只验证新 self 的 fail-closed 缓解及原事实保持；原9cb2矛盾文案和审计原件保持不改。尚无本复验的浏览器或自然运行，global open状态不变。

## 后续 UI 构建独立复验

最终 UI 源 `d2512764bc54c9efb665168869cde08c6b8ac00f567ecb02229915fadd1d3896`、相同核心 `715fca749327bc1302aa4869adda94044e5dfa9c6dd24cac733f1b98a7575868` 已用同方法在另一外部目录实际19／19通过，不移用68834890的执行结果。报告 SHA256为 `fa18c120bed7077e8aa550abfa3935e92308dae5a2f098b1481771fdb3747dcd`，执行脚本为 `4903f19a4bd81e9d78d939b1f2be974892f4524d004c22a3b60c4b8f5738af84`。实际首份／首谈后 native 仍分别精确为上文 `8b64d54a…`／`c4caa68a…`，原健康字段、免费首谈与unknown降级均保持。

本次只附记实际 IO 字段：首谈 toast 带 `npc-self-dialogue` class并调度12000ms timeout，随后实际普通查看移除该class并调度1800ms timeout；原650ms checkpoint另列。模拟 IO 不能证明换行、文字未裁剪、viewport内可见或浏览器实际展示12秒，像素与布局须由对应构建的独立浏览器验收。本问题的global open状态不变。
