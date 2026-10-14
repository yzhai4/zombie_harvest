# 报告恢复候选：独立 ADR 评审与修复复核

**状态：** SOURCE_READY：最终候选 `291a75441548e25801c4140d2b6e26dea1f5c1d938de7b408d9c4fb972bfe893` 可按此精确SHA冻结进入B1–B16浏览器QA；这不是浏览器通过或发布批准。  
**契约：** [独立架构 ADR](../decisions/ADR-20261014-report-recovery-review.md)  
**方法：** 从唯一实现者的私有候选读取独立原字节快照，运行实际 inline HTML 函数的 Node VM 负例；DOM/storage/timer 为明确测试 instrumentation，没有修改候选、dist、服务器或原 profile。

## 首版及已复核的修复

首版 SHA256=`94c4a4ec91ca9ae92fc02b393cb6fcd315679abb66eadc7ac2d6f3a76b8a142e`。第二次读取 SHA256=`a9ece7f68efa932f3306d942711dbf2e66fdffb7d68f4c3d02adbd77ee0a6f20`，它仍是 WIP，不代表最终发布源码。

| 首版独立复现 | 第二次读取的实际结果 |
| --- | --- |
| restart 后旧 gather 路径仍返回成功，wood24→28、energy78→70、eventSeq2→5；旧计划 commit 仍 CP1→0 | 两个实际源码入口均拒绝，资源/CP/eventSeq保持；未靠 disabled 按钮替代 Gate |
| SAVE21 缺 NPC needs 或 CP/plan 域仍启动DAY，补初始值且无迁移 | RECOVERY_REQUIRED、未启动、未安装；保留初始 state 只是未安装状态，不是给坏档补资源 |
| 显式报告身份的 retained ledger 内部缺 seq12（11→13）仍自动降级DAY | RECOVERY_REQUIRED，无迁移或模拟；内部缺口不冒充合法前缀截断 |
| started世界371晚于resolved370，但seq更早，仍REPORT_PENDING | RECOVERY_REQUIRED / started-identity-conflict |
| 删除失败只把错误写入仍hidden的startOverlay，loss overlay仍盖着 | 撤下nightOverlay、显示startOverlay与公开重试清档提示，会话保持fenced |
| 当前SAVE21 plain对象没有checksum仍按正常存档接受 | RECOVERY_REQUIRED；旧raw适配须明确版本与证据范围 |

此外，首版拒绝 resource.amount=0。真实公开行动原工件有6份合法耗尽 berry=0；writer保存原 resources 数组，不能以最终旧loader筛掉0后的保存作为唯一正例。实现者已改为允许0、拒绝负数/非有限值；仍需冻结后以实际耗尽工件复验，不添回资源。

## 真实生产 SAVE18 兼容

已读实际 Sites v81 源 `f3488457286836bf986dc90b5e0c3f6f425813c9`，HTML SHA256=`11f25c4e68f7360a11b8c84a638b0f8a8270202af3bcf58b3047d278b4952400`，SAVE_VERSION=18。其 writer 完全没有 contentState，NPC serializer 也没有 attributes/hero/garrisonedOutpostId；其它旧需求、SAN、关系、记忆、外观、工时、岗位、社交/中继、世界维护及十人 roster 已存在。

根执行者从该真实冻结 source18 经公开开始、真实遭遇和公开关闭捕获三个原 envelope；capture report `ok=true`、28.688秒、无保存注入/隐藏调用。独立审查直接读取其原 bytes，不用 current21 手动改version伪造旧档：

| 真实原工件 | 原FNV | 原SHA256 |
| --- | --- | --- |
| DAY18 | `926f908a` | `0fe3b3e33d630621feb20cba3bb08b4db7cef247464d3b32f748c3c17bf829c3` |
| RESOLVED18 | `4a12d242` | `1d10ec233d64ce9a0cedf3eae44fa1e6706065c0ff37ba3e13f5b663451d2d1e` |
| CLOSED18 | `f1db7a05` | `5413783b32ebae6cc798593e90f034da596e17b20cda71b606054c8180b1b960` |

三个原FNV均独立重算一致。首版全部因 content-version 拒绝，属于生产兼容 release blocker。a9 读取已能分别分类DAY/REPORT_PENDING/DAY、只迁移一次并实际写SAVE21/CONTENT3；三份迁移的原资源、日期及十个 NPC HP/needs 保持，新完整 payload 验证与FNV通过。此处是源码迁移证据，尚不是在新构建浏览器完成两次reload的证据。

适配边界是 **SAVE18 的 contentState own-property 不存在**；显式null、数组或损坏对象不能被当缺省吞掉。只增加已有源码未保存的新系统域；CP0/max0/grantedDay为原日期、idle计划、无旧候选或计划效果、无推广历史/奖励。原 roster、伤亡、库存、工作钟、事件和中继事实来自同一完整原档，不能混用模板。

L0 的 commander/radio/doctor 是起始英雄，缺新 hero 字段时按已批准的基准身份迁移；其余7人仍ordinary/locked。a9 将三人也设locked，与最新裁定不符；后续11f0和c28已修正，三份真实旧档独立源码迁移复核均保持此身份。新增身份不伪造 promotionHistory、bonus、CP或旧计划，技能仍走原个人/信任 Gate。

实际 source18 与21的 encounterId 构造同源，旧 started 缺threatId时可使用明确版本公式 + 唯一resolved显式ID + exact replay join。19/20适配范围需单列来源证据；不能用18正例替它们背书。

## 第二轮新增嵌套校验缺口

以下是 a9 的独立源码负例，11f0和c28已分别复核为拒绝安装；均为明确离线变更的测试输入：

1. `npc.memory.importantEvents={}` 仍通过并安装DAY。玩家在该NPC旁走实际 setNpcOrder 路径后抛 `TypeError: (npc.memory.importantEvents || []) is not iterable`；体力/支援状态已先改变。应在准备阶段拒绝坏数组，不等运行时中途抛错。
2. 当前 `npc.needs={}` 仍通过，boot补回六项默认需求。source18和21均原本写六项，应要求原六键及合法数值，而不是以对象类型证明需求完整。
3. 当前 candidate plan 缺 meetingDay/instanceId/version 等仍启动DAY，合并默认变成 meetingDay0/instanceId null。应检查完整字段和状态对应身份/日期（idle允许0/null，candidate/committed需要实际实例），不能为坏现有计划创造默认历史。

上述三个当前坏档分别得到 npc-memory / npc-needs-incomplete / plan-identity。坏档未安装时仍能读到初始模板需要和idle计划，是未安装的初始state，不是为坏档补值。全局 state 与registry在 late-field/registry准备失败前后投影必须相同。

## c28源码复验与初始旧档边界

该轮独立原字节快照 SHA256=`c28bf4df867d0e4a69caf1c1f1ba6307af598c1880a04b82c2beb523ec87d659`，当时仍待最后坏数据边界修复。实际重新执行唯一实现者的checker为93项通过，记录为源码测试，不作为B1–B16浏览器通过；最终结论见下文291a复核。

两个真实主路线原件 `06-berries-collected-save` / `12-day-1-training-checkpoint-save` 的原FNV分别为5f493173 / bc921d49，均重算一致并正常分类DAY；已耗尽资源0保持。前者source身份未知，不能把此正例称当前单一构建原件。后者完整计划配合明确离线CP1/max3测试输入，start/restart后实际commit返回session-frozen，CP1和eventSeq230保持。

11f0报告渲染禁用了gather/build/crop/endDay四个按钮，但原renderHud没有重新enable；已作为UI blocker反馈。c28实际原renderHud按Session.isDay统一渲染，独立受控DOM在report→close→原renderHud后四个按钮均enabled，threat.closed仍只一条。此为源码DOM证据；真实浏览器还须公开关闭后点击按钮证明可用。

真实 `INITIAL18-reload-save.json` 来自旧source18公开开始后立即reload，原SHA256=`3ae5ff906cfb1d6e50c9b5ea9467896f2537e64bfaab44b0c897984baa6ae460`、原FNV=`8774420e`。其日历和savedAt为day1 06:00/360，但world.totalMinutes=0，eventSeq/commandSeq均0、events/seenCommands/replay.commands均空、两维护日均1。原JSON bytes与镜像不修改。

独立读取原工件、用独立FNV实现重算，实际pureprepare保持全局state、registry和storage完全不变；draft只将已证窄边界world0改为360。public-start源码写入实际SAVE21完整envelope，独立FNV=`c52f3462`，所有原NPC序列化字段逐键保持、资源和日历保持；没有time.advanced、CP/旧计划/推广奖励。save.migrated记录原/选8774420e、版本适配和worldClockCorrection before0/after360/calendarUnchanged/known writer。两次独立源码reload仍一条迁移。

14个明确离线变更的相邻负控（day2、minute1、world1、非零commandSeq、非空seen/replay/ledger、两维护日0、contentState显式null/数组、九人roster、缺旧needs、当前SAVE21 world0）都拒绝，无安装、registry变更或interval；这些负控重新计算合法测试FNV和镜像，拒绝原因来自world-calendar、roster或旧域完整性，而不是错checksum。

独立小审查程序及完整输出位于本机私有 `C:/Users/DELL/.cache/zfarm-report-recovery-review/`：independent-boundary-cases.mjs / independent-boundary-c28.json，并分别保留原八项、三项嵌套、真实旧档和合法资源/计划的c28输出。没有改候选或原QA工件。

## c28最后新增的必要校验缺口

同一完整current21源码writer输入仅改变指定字段，实际源码VM复现如下，已交唯一实现者最小修复：

- `contentState.scheduledEvents=[null]`仍validate ok→DAY/start成功，实际runContentHook('onDayStart')抛TypeError读取dueDay。需在安装前验证每个已保存scheduled record的普通对象、id、dueDay和payload，不能只验证容器是数组。
- NPC `sanity='BROKEN'`、`morale='BROKEN'`、`sanityClock=-12`均接受DAY，normalizeNpc悄悄改成72/72/0，无迁移。它们是source18和21已存在的持久字段；坏值应拒绝，不能冒充新增域缺省。
- `npc.eventChain.resolved=[{}]`同样被接受。旧writer的string集合及其它已有数字、clock、链、perception域应按实际两代writer核对，而不是让normalization修坏已有数据。

以上输出 `last-malformed-c28.json` 明确为源码测试，未动浏览器profile；c28当时不能冻结。此组缺口随后已修复，最终291a实际复验结果见下文，不沿用c28的通过声明。

准确性更正：a9的resolve已记录真实b.moraleAfter，审查此前将此误当a9缺项的即时提及已更正给父执行者与实现者。本记录不把它计为本轮新增修复。

## 最终291a独立冻结意见

本次独立从唯一实现者候选读取不可变快照，最终SHA256=`291a75441548e25801c4140d2b6e26dea1f5c1d938de7b408d9c4fb972bfe893`；复验结束后再次读取候选SHA仍一致。根执行者另保存相同字节QA副本 `C:/Users/DELL/.cache/zfarm-private-evidence-20261014/recovery-291a/dist/index.html`，浏览器QA应锚定这一份，不把980或3f93结果代称最终291a。

| 精确291a的独立执行 | 实际结果与范围 |
| --- | --- |
| 唯一实现者source checker重新执行 | 170项通过，exit0；Node VM/storage/timer/DOM instrumentation，未执行浏览器 |
| 归档attempt9的76份真实原save | 每份原bytes SHA与归档manifest一致，FNV一致；76 validate、76完整draft验证通过，73 DAY/3 REPORT_PENDING；每次prepare全局state/registry/storage保持 |
| 首版8个独立复现及第二轮3个嵌套负例 | 均按预期拒绝或fenced；清档错误公开可见，不半载、不恢复旧行动 |
| 最后8个恶意字段输入 | scheduled null、NPC SAN/morale字符串、负SANclock、resolved对象成员、空relay/standing、负frontier clock均拒绝安装；序列不变 |
| 真实INITIAL18、14个相邻负控、实际原renderHud | 16组通过：只修已证旧初始world哨兵；两次reload仅一条迁移；正常close后四按钮enabled且close仅一条 |
| 其它三个真实SAVE18原件 | DAY/REPORT_PENDING/DAY、实际写SAVE21/FNV有效；资源/日期/十人原字段保持，三起始hero及七locked正确 |
| 真实耗尽资源与完整CP1计划离线反例 | 两原FNV正例DAY不添回0资源；restart后的实际commit拒绝，CP1与eventSeq230保持 |

最后校验现包含scheduled record成员、持久ID集合、active content chain成员、NPC两代writer完整字段与SAN/morale/bond/clocks/eventChain/perception/social、旧world frontier/中继/standing固定域以及所有own-present payload镜像一致性。原staminaExhaustedDay/At已作为两代writer持久事实原样保留，删除沿旧loader的无必要清空；缺失或非法值拒绝。fresh draft恢复非枚举runtime player.id='player-1'，使真实采集产生的NPC感知能够保存并reload；不是新增玩家或奖励。

980→291a的独立源码diff仅为SAVE19/content1显式非idle计划拒绝：不允许将未来authority记录归零。SAVE19/20仍是声明的TEST-ONLY适配范围，当前真实生产旧兼容证据仅四份SAVE18原件；不能据此宣称所有历史19/20档已验证。

归档76原件只读导出到本机专用私有QA副本，来源report SHA=`62ad36b2c7add9d2e36148655cd1755de25c42563e7861e66dce887bcc2ab564`，zip SHA=`5f0f97d336c0ce8bcb24c31a9c9f112600595e515e8cb99308001e04e94371f3`。完整独立摘要 `C:/Users/DELL/.cache/zfarm-report-recovery-review/final-independent-review-291a.json` 含每项输出SHA，SOURCE checker输出SHA=`141083da9f0e5254b260e659475869e5b78c02b1f9a916374d7e2d09d7f2af34`；76原档兼容输出SHA=`73b04721a927d5d11b6d76d0b233b8ae24d6837e4684e1672b0f8c27a79d9e88`。

**建议：** 冻结精确291a进入独立B1–B16浏览器QA。本审查未修改dist/server/profile，未发布。B15真实650ms排队退出竞态、实际损坏档/备份与保存失败、跨午夜/visibility、公开报告关闭可用性和真实旧档迁移两次reload仍须各自浏览器证据。旧76工件仍含10份sourceUnknown、历史day2刷新缺口和recovered run限制，不可改称single-build连续通过。源码准备正确不能替代这些运行证据。

## 其余 ADR 门禁

- select/classify不写storage/registry/DOM、不消费RNG；安装只接受完整预备draft。坏保存不得先加载部分库存，save失败后保持冻结且可重试同一迁移。
- backup恢复用整份checkpoint，实际save.migrated含原/选 checksum和日期、rollback及来源；坏主档不能覆盖安全bak；两次reload不重复迁移。
- 旧空close只认可完全空普通对象 + exact commandId/type/threatId join；未知终局优先恢复，确认loss优先残留close；未结算不resume，不重打/获胜。
- report只用保存事实与已记录receipt。历史数字缺失显示未记录；新结算可记录真实moraleAfter。remaining不能显示成kill数量；保留既有day5/relay里程碑的纯叙事映射。
- restart先fence/generation与gameStarted=false，再取消/清理checkpoint、interval、RAF、输入/捕获；旧callbacks、visibility catch-up、直接UI与CommandBus都不得重新写旧局。匿名资源重绘回调也需跟踪或按generation拒绝，不能只测试已命名timer。
- SOURCE checker、独立VM负例与真实boot-save B1–B16分别记账。B15真实排队竞态、损坏档/写失败、跨午夜/隐藏、重复按钮与旧source18迁移reload必须有对应范围证据。

最终候选可冻结进入浏览器QA；此记录不等于发布批准、Sites部署或整个长期目标完成。本轮只编辑本专用审查记录，无全局记忆更新。
