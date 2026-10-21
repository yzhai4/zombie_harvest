# 三日保存等待诊断 tester 候选

日期：2026-10-14。状态：**候选方法检查通过，待主代理独立冻结；未启动浏览器，未进行新三日游戏运行。**

本切片处理 [保存等待观测缺口](../problems/PROB-20261014-settle-save-observation.md)，不修复或归因旧 FAILED 运行，不改主游戏、不改旧 profile/报告、不改变成功标准。候选与方法输出留在独立私有目录；公开记录使用逻辑文件名及SHA。

## 对象与方法结果

| 对象 | SHA256 |
| --- | --- |
| 原完整 `base-server-three-days.py` / 未改仓库脚本 | `293fc76c7479cb16989510c7d2aad3e116f763f36786d52ca91c009b88229c2e` |
| 诊断候选 `server-three-days.py` | `5e3dfeadbc729caf9e80adc6d890ca0ff20a5fbe0bf2211f9f609efbbf4ae299` |
| `check-diagnostic-methods.py` | `5efe588ecb919aee0a5fcdb0e36122bcd9d5307cd4ae4241ad8901f992682c21` |
| `check-read-save-observer.mjs` | `03686e934ee1c92c8f6af015c008e5b1ffa990eb20920ad0ca27c42692eaf7cf` |
| `method-controls.json` | `4532ae45c3c4fb9b57e809dfa070c2685a61f7a72012bc8d88acadde59fb52c4` |
| `read-save-js-controls.json` | `47663877aa86f75fa1151650d74fd38fbc3d7eff9b85ff0a7eb772ee9cb4c0bf` |

**Python方法对照121项、实际JS读取表达式13项通过，均 exit0。** 方法使用实际完整冻结脚本的Python方法及实际 READ_SAVE表达式；page/storage/DOM/clock/predicate IO 为明确合成控制，不能代称真实浏览器或自然游玩。合成截图只是捕获机制控制，不是游戏画面。

方法报告不引用已训练完成次数或旧snapshot来判定现场。基线与候选对照的返回结果、异常类型/消息、读取次数、100ms等待次数、predicate调用/真值转换次数一致。

## 修改边界

AST逐方法比对：原类只有 `__init__`、`read_save`、`settle_save` 修改，另新增三个诊断辅助方法。全部路线、动作、检查、严格 fresh Gate、`Runner.run` 的异常/清理以及模块初始化拒绝写入分支保持原AST。

`ACTION_SECONDS=30`、遭遇/全局/heartbeat预算、最大攻击数及原路线上限不变。等待仍使用 `min(globalDeadline, now+ACTION_SECONDS)`，轮询仍100ms。

READ_SAVE仍只读取一次primary和同一次JS执行的DOM日历，原FNV算法和正常返回字段保持。新增 `diagnosticRaw` 绑定原始字符串；read_save移除该诊断字段后返回原观察对象。缺保存时读取DOM并返回诊断标记，read_save仍返回原来的 None。坏JSON保留原JS异常，缺payload保留原错误消息。

原始字符串按明确的 `utf-8/surrogatepass` 表示取得字节数/SHA，保留空白和Unicode，**不对envelope重新JSON序列化代替原raw**。这绑定localStorage字符串的声明字节表示，不冒称浏览器存储文件字节。FNV仍绑定payload。坏JSON导致JS读取整体异常时，raw可能无法返回，记录不可得和原异常，不能编造其SHA。

## 等待与失败数据

每次等待创建一个新的有界观察对象，覆盖上一次等待摘要；`pollCount`只计数，`polls`只保留最后24轮。每轮记录：

- wall开始、读取完成、整轮完成时间与固定 minimum minute/seq；
- 原子DOM文本/分钟、保存日期/分钟/savedAt、checksum/computedChecksum、schema/日历一致性、eventSeq、reason与lastCheckpointReason；
- 最新raw字节数/SHA、read/lag/minimum/seq/predicate条件，predicate是否实际求值、是否接受或抛错。

条件保持原先的短路顺序：lag失败不检查后续，minimum失败不调用predicate，seq失败不调用predicate。predicate成功/失败只有原位置的一次调用与一次真值转换；None不调用。未执行字段为null，不能解释为已测试失败。

成功等待不新增诊断JSON/raw/PNG文件，只让原报告/检查点的后续正常persist携带最近摘要。失败在原context关闭前保存最新实际轮询raw、一份诊断JSON及一张只读截图，随后原异常原样抛出并走原run失败出口，**不继续游戏**。raw与截图均记录真实字节SHA/大小。raw来自最后尝试轮询，不是异常后重读；截图带失败后采样时间，不能与raw冒充同刻。

诊断截图有独立2000ms上限，只用于失败后的证据捕获，不延长或替代原成功等待预算。诊断失败另存captureErrors；即使辅助函数意外异常，也不能替换原保存/读取/predicate超时。工件使用时间/调用号组成的新文件名，拒绝覆盖既有诊断文件。

## 正反例覆盖

方法对照覆盖 lag负数/0/1/2、固定minute/seq不足、缺保存、predicate真假、FNV/版本拒绝，以及不合格观察后出现合法观察。成功/失败结果均与原函数一致，没有把未到达的predicate另行调用来诊断。

独立负控还覆盖：predicate异常对象身份保持；lag/minute/seq失败时predicate零调用；浏览器evaluate异常身份保持；截图异常与意外capture异常不盖掉原TimeoutError；数百轮只保留连续最后24轮，元数据不含24份完整save/raw；成功无失败工件；现有out/checkpoint/profile/artifacts、输出与检查点同路径、profile包含输出等strict初始化拒绝且原字节不变。

JS控制执行原和候选READ_SAVE表达式，核正常字段/FNV保持、单次只读、缺档DOM、原raw空白/Unicode保留、缺payload错误及坏JSON异常一致。没有timer/storage wrappers、隐藏状态访问、游戏函数调用或保存写入。

## 下一步与解释限制

主代理冻结候选后以新的strict-fresh空目录运行，再独立核原report、最后24轮、raw文件SHA与失败截图。verifier无需更改；新字段不能改变三日完成、日界/reload、同构建、零resume或生存/动作因果标准。

若raw至少多次更新但全部被lag/minimum/seq/predicate筛掉，证据支持进一步检查等待同步和时钟窗口；若raw始终不动而DOM前进，仅说明保存路径未产出，不能直接区分存储失败、门控或调度。诊断增加的读取数据量/哈希和失败截图本身有观察开销，须记录实际时间，不能据方法控制推定真实浏览器窗口一定够用。

本候选不捕获调用 `calendar()` 时两个locator各自的时间分量，不裁定旧运行是否发生午夜混读；如固定目标异常，只能报告目标与原子读取不一致，另行最小调查。旧运行的 FAILED、缺少第三日日界/结束证据等限制保持。

新增项目记录为本QA及对应PROB；无新增全局记忆。
