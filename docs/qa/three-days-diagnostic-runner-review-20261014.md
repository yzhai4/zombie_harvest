# 三日诊断 runner 独立方法评审

日期：2026-10-14。结论：**候选 `5e3dfead…` 方法 source-ready，可以由主代理冻结后进行下一次全新 strict-fresh 运行；本评审没有浏览器 PASS，也没有修复或重新裁定旧 FAILED。**

本审查只读脚本、候选方法证据和来源说明，仅新增本文件。未修改 runtime、tester、旧 profile、失败报告或工件，未启动服务、浏览器或实际三日 runner。对应问题见 [保存等待观测缺口](../problems/PROB-20261014-settle-save-observation.md)，作者交付见 [诊断候选 QA](three-days-diagnostic-candidate-review-20261014.md)。

## 身份与审查边界

| 对象 | 本轮实际读取的 SHA256 |
| --- | --- |
| 冻结完整基线 `fresh-three-days-412c/scripts/server-three-days.py` | `293fc76c7479cb16989510c7d2aad3e116f763f36786d52ca91c009b88229c2e` |
| 私有候选包 `runner/server-three-days.py` | `5e3dfeadbc729caf9e80adc6d890ca0ff20a5fbe0bf2211f9f609efbbf4ae299` |
| 候选八资产 `results/manifest.json` | `3a098d70ce4da28f45451e441d05da291f25278b26a60e9be35f5d9130aef761` |
| 未修改的 [三日工件 verifier](../../scripts/verify-three-days-artifacts.mjs) | `4cca9356ceba55e47d9ac6c4ec0d08b62e926d2f7df2d29930f5af62f80b7434` |
| 当前 `dist/index.html`，仅核文件身份 | `58a4bb28453429c73ad27baf22a377e3b7ff389b387a524196a06e490b0a65e1` |

候选 runner 为118517字节，基线为108565字节。逐方法 AST 独立比对确认：原方法只有 `Runner.__init__`、`Runner.read_save`、`Runner.settle_save` 改变；新增 `remember_atomic_settle_observation`、`retain_settle_poll`、`capture_settle_failure` 三个方法，并扩充 READ_SAVE 返回的诊断字段。其余原函数、CLI解析、导航、公开动作、strict完成检查、`Runner.run`及模块初始化失败出口 AST保持相同。源码差异 whitespace 检查无错误。

以上 current dist SHA只是来源标签；本轮没有测试58a4运行时行为。旧412c浏览器结果、旧恢复报告 Gate90及静态检查数量均不作为新构建三日证明。

## 源级裁定

下表行号属于上述 **5e3dfead完整候选**，不能套到旧293fc脚本。私有证据保留在候选包，不把原始保存/截图路径或内容复制到公开文档。

| 要求 | 实际源码证据与裁定 |
| --- | --- |
| 原等待合同不变 | L584–645仍先计算 `min(self.deadline, time.monotonic()+ACTION_SECONDS)`，循环每轮一次guard/read，失败后100ms等待。L46–50的30秒action、60秒encounter、600秒默认global、15秒heartbeat、4次导航攻击上限不变；显式CLI1800预算仍由原解析处理。未延长接受窗口。 |
| lag/minimum/seq/predicate短路不变 | L615–627依次只接受lag0或1、固定minimum minute、固定minimum seq；前三项通过才调用predicate。L624只在原位置执行一次 `bool(predicate(payload))`；None不调用。未到达的条件保持null，不能解读为已经检验失败。原payload、last_save和返回值保持。 |
| 每次等待有界last24 | L589–600为每次调用建立独立摘要；L529–540只计pollCount并保留最后24个poll，包含开始/读取完成/完成wall时间、固定目标、条件和该轮read元数据。原子元数据不含完整envelope/raw；只有最新一份raw字节驻留，下一轮先清空，不能把上一轮raw冒充失败读取。 |
| 原raw绑定而非重新序列化 | L55–69只一次 `localStorage.getItem`，原FNV仍对payload做原JSON.stringify计算；同次JS执行读取DOM。L482–527在read_save剥离字段之前，按 `utf-8/surrogatepass` 编码原字符串，记录字节数/SHA、FNV/date/schema/eventSeq等元数据。L552–559的失败raw文件以xb写入同一份最新字节，并记录匹配SHA/大小；没有异常后额外读取存档。 |
| 观察器不求checkpoint或改变游戏 | READ_SAVE只有getItem、JSON/FNV和DOM读取；三个辅助方法只改tester诊断字段、计算hash或落新诊断工件。没有storage写入/移除、游戏函数、内部状态访问、额外点击、保存请求或推进路线。成功等待只让原persist携带最近摘要，不新增失败工件。 |
| 失败先取证再关闭 | L637–645在settle/read/predicate异常处先capture后裸raise；原run的L1643 context.close保持。L541–582在此之前尝试最新raw、PNG和JSON。PNG使用独立2000ms诊断上限，标明失败后采样时间；它不属于原接受窗口，也不是同刻原子poll截图。失败不继续游戏。 |
| 捕获失败保留原错误 | raw、PNG、JSON分别捕获诊断异常并写captureErrors；整个辅助capture意外失败亦由L638–644记录后裸raise。失败的截图或落盘不转为成功、不替换原异常；实际evaluate/wait/predicate异常对象身份在独控保持。 |
| 初始strict拒绝不能覆盖旧输出 | L310–323在创建artifact目录和Chrome之前拒绝非空profile/artifacts、已有out/checkpoint和路径冲突；L1659–1673保持原初始化出口，strict且out存在时不写该out。真实构造器与实际main AST独控验证已有report/checkpoint/profile不被改，拒绝exit1。 |
| strict/verifier标准不变 | 原导航每document实际response body SHA、fresh reset、DAY1/2/3 reload、零resume、真实日历/收获/计划/固定人口和day4≥06:00的检查函数AST未改；verifier SHA未改。新增诊断不能补缺失的document、日界、动作或最终保存证据。 |

“原字节”在这里精确定义为 **localStorage字符串声明的UTF-8/surrogatepass表示**，保留空白及Unicode；不是浏览器磁盘数据库文件字节。JSON解析或evaluate先抛错时JS不能返回raw，本轮该字段为空，保留原异常而不编造SHA。缺保存与空字符串可区分；坏FNV、日期或schema仍按原Gate拒绝。

## 独立控制与作者证据

作者的121项Python、13项JS方法报告及源代码均已只读核对，报告SHA与manifest相符。它们使用实际脚本方法/表达式加合成IO，不是浏览器工件；本审查没有重跑作者脚本或回写其报告。

审查者另在内存执行实际基线/候选Python方法，共 **32项通过，exit0**。Playwright入口替换为立即拒绝的stub，截图/raw/JSON放入内存文件对象，没有浏览器、游戏执行或源/证据文件写入。覆盖：

- 12组基线对照：lag负数/0/1/2、minute不足、seq不足、predicate假、缺档、FNV错误、savedAt错误、schema错误、None predicate；对照返回值、异常类型/消息、evaluate/100ms等待次数、predicate调用及真值转换次数。
- 14项独立负控/绑定控制：predicate异常身份且只调用一次；lag/minute/seq不足时predicate零调用；evaluate和wait异常身份；raw/PNG/JSON/整个capture故障都保留原TimeoutError；全局剩余期限短于30秒仍不延长；连续最后24轮且不保留24份save；空白、汉字、emoji和孤立surrogate按声明编码精确绑定；一张2000ms失败截图且无额外读取。
- 6项真实构造器/main AST控制：已有out、已有checkpoint、非空profile、out等于checkpoint均在写入前拒绝；实际模块strict初始化失败分支不写既有out且exit1；末尾重核候选SHA未变。

另直接从两份完整源文件提取并执行真实READ_SAVE JS表达式，**8项通过，exit0**：正常字段/FNV/DOM保持、primary仅读一次、空白Unicode原串保持、null与空字符串诊断、缺payload原错误、坏JSON原异常且不伪造raw、没有storage写入/游戏函数。该控制同样只有合成readonly DOM/storage，不等同现场截图或存储成功。

## 下一次实际运行的条件与解释限界

没有发现阻止冻结5e3dfead诊断候选的源码问题。主代理仍须核候选实际执行文件SHA与以上一致，采用独立全新profile、report/checkpoint/artifacts目录，保留原FAILED一切工件；通过原CLI `--fresh --strict-fresh --expect-html-sha256 58a4bb28453429c73ad27baf22a377e3b7ff389b387a524196a06e490b0a65e1 --timeout 1800 --finish-hour 6` 配合核实的origin及新路径执行。该命令只描述下一次冻结58a4合同，本评审没有执行它；若来源改变须重新固定64位SHA，不沿用旧标签。

实际结果仍须由4cca verifier以 `--strict-fresh --expect-html-sha256` 明确验证全部工件，不能仅看runner返回ok或部分检查数。若失败，核最后24轮和最新raw文件实际SHA、条件、读取/截图时点以及captureErrors；缺第三天或最终day4清晨证据仍是FAILED，不用诊断字段补齐。

诊断可区分“raw/watermark变化但被条件筛掉”与“raw不变而DOM前进”，后者不能单独定位为存储失败。它没有timer/storage wrappers，也没有调用calendar时两个locator各自的时点分量，不能裁定旧超时是否来自午夜混读、调度、保存门控或存储异常。轮询编码/hash和截图有观察开销；原期限相同不表示现场poll次数或事件循环窗口必然与旧运行相同。训练路线仍只证明smoke，不证明自然游玩平衡。

**交付范围：方法source-ready，无新浏览器通过、无发布结论、无旧报告追认。**
