# 三日 runner 保存等待超时缺少现场观测

日期：2026-10-14。状态：**5e诊断已冻结、真实第二轮终止失败并归档，原字节接入repo；实际保存/读取原因仍未修复或重新裁定。**

上一轮 strict-fresh 主运行在第二日训练前的 `settle_save` 等待超时。已通过检查和已保存快照不能说明超时期间的状态；原报告没有最后失败轮询数据。原 FAILED 报告、profile、runtime 和保存工件继续保留，不能由最后一个成功 snapshot 推断发生了什么。

## 源码事实与待区分原因

冻结 runner `293fc76c…` 的等待期限为原全局剩余预算与30秒 action budget 的较小值，每轮100ms。它接受 primary SAVE21/CONTENT3/FNV/日历有效且 DOM lag 为0或1、满足固定 minimum minute/seq及可选 predicate 的保存。

前置等待不触发保存。冻结412c运行时每1.2秒自然 tick 推进1–5分钟，`advance` 本身 `checkpoint:false`；每第10 tick 请求 checkpoint，650ms后执行。正常保存机会约每12秒出现一次，650ms不代表进入等待后650ms必然出现新的保存。持续 DOM/事件循环工作可能影响窗口。单靠每12秒的 world-tick 不会无限重置650ms debounce；是否有其他请求、会话门控、时钟停顿或存储失败，原报告不足以判定。

`saveProgress` 会 catch 存储异常并返回 false，普通保存调用没有必须产生的 console error。因此零 console/page/http error 也不能排除保存路径未产出。`calendar()` 的 day/time 为两次 locator 读取，存在跨午夜观察竞争的可能；原失败没有这些分量，不能宣称本次就是此原因。

## 最小诊断合同

新候选基于冻结完整 runner，只增强只读观测：

- 每次 `settle_save` 保留该次等待**最后24轮**，包括开始/读取完成/整轮完成 wall time、固定 minimum、保存是否存在、原子 READ_SAVE 的 DOM与保存日历、savedAt、FNV、eventSeq、reason、原始保存字符串的声明 UTF-8字节数/SHA。
- 保留 read/lag/minimum minute/minimum seq/predicate 前置条件。未到达的短路条件用 null；predicate是否调用另有标志，**不得为诊断多调用或提前调用**。
- 仅保留最新一份 raw字符串字节，避免24份完整保存驻留或逐轮落盘。成功不新增失败工件；失败在context关闭前写一份诊断JSON、最新实际轮询raw和只读截图。
- 截图明确为失败后的时点，不能冒称轮询原子截图；不再读取/写入保存，不调用游戏函数或继续游戏。截图/诊断落盘失败另列，不覆盖原异常。
- 原 lag0..1、minute/seq/predicate、超时、100ms轮询、strict Gate、公开路线和 verifier 保持。原初始化路径拒绝不覆盖旧结果。

本层没有 native timer/storage wrappers，没有修改runtime。收到的新诊断需区分：保存字节/水位真实变化但始终未过等待条件；或者保存始终未变而DOM前进。后一类只能初步定位为保存路径未产出，仍需区分调度/门控/存储，不能直接归为存储故障。

实现与方法证据见 [诊断候选 QA](../qa/three-days-diagnostic-candidate-review-20261014.md)与[独审](../qa/three-days-diagnostic-runner-review-20261014.md)。第二轮真实失败观测、122原件SHA归档和跨机同Gate114/123见 [第二轮原始结果](../qa/fresh-three-days-second-20261014.md)。15poll同primary、DOM推进与最后172.274秒整体读取已证实；前14只约7.43秒，未跨完整约12秒周期保存窗口，不能单据此说autosave已经执行失败。截图timeout保留。下一步只读分段调查调度/保存路径/渲染与传输；不重启原profile，不通过放宽判据改变两个原FAILED。

无新增全局记忆。
