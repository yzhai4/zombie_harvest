# 严格三日第二轮：失败观测与原件归档

日期：2026-10-14。状态：**真实 terminal FAILED，未重启 profile；保存等待原因仍在调查。**

逻辑 run `fresh-three-days-58a4-diagnostic-02` 使用全新空 profile、冻结 HTML `58a4bb28453429c73ad27baf22a377e3b7ff389b387a524196a06e490b0a65e1`、actor be4cf51d、诊断 runner `5e3dfeadbc729caf9e80adc6d890ca0ff20a5fbe0bf2211f9f609efbbf4ae299` 和原 verifier `4cca9356ceba55e47d9ac6c4ec0d08b62e926d2f7df2d29930f5af62f80b7434`。四输入逐字节跨机核验及真实 loopback HTTP source 核验后，只启动一次；预算1800秒，目标day4≥06:00，显式strict-fresh/expected SHA，无resume。生产Sites和public80未改。

## 终态与实际覆盖

SSH主进程真实exit1、PID已不存在；871.282秒，392个已执行runner检查均true，但下一动作前保存等待超时，整轮ok=false。原report SHA `c053723f413f28735271b337faa3c5c1f62995c128f678b4a337b81550724114`。104份原snapshot均为58a4，实际DAY1/2 reload、day2日界、night1/2；34个公开30分钟训练收据与动作一致，已观察1087个唯一连续事件，没有可见序号缺口。没有完成day3/4、第三夜、真实收获或最终清晨保存。

原独立strict Gate **114/123、exit1**：九项失败为原runner未完成及后续document/day3/4计划/第三夜/收获/day3 reload/清晨等必要阶段缺失。不能用所有前缀检查true称三日通过；训练改变SAN/士气，不能称自然平衡。

## 新诊断证明了什么

失败位于call110 / `day-2-public-training`。实际15个poll的primary均为world2083（day2 10:43）、seq1087、FNV38533584、364946字节、SHA `a6ea87073316b7ca1e221298d2d8915a41279c5df6eb0a7f1430a31b21cac0a6`、reason `command:camp.area.interact`。原子DOM取样2084→2090，lag1→7，未满足固定minimum2084或lag判据；没有为了诊断追加动作、请求保存或改变判据。

前14次读取各约0.36–0.51秒，首轮开始至第14轮完成只约7.43秒。世界周期保存机会约12秒，因而这段没有新primary不足以证明一次周期保存已经失败。第15次`read_save`整体调用/处理历时 **172.274秒**；这不是已分段的JS/FNV耗时，DOM值也不是Python返回时现场时钟。原30秒等待只能在循环边界检查，不能把CLI预算说成所有浏览器RPC的硬截止。

失败raw来自最后实际poll，不是失败后新读。2秒截图请求超时、screenshot=null、captureErrors保留；**没有失败截图，不能补造或从上一成功图推断现场**。当前没有save-attempt/failed-stage证据，保存调度、门控、存储、渲染和传输仍需分开核对，尚未证明OOM、CPU或存储故障。

## 私有归档与迁移核验

原终止数据122文件/64401875字节（104保存、14PNG、失败JSON/raw、报告和checkpoint）归档，TGZ11077524字节/SHA `b2fed62c85958a6a2266b5cfde4cc88241f02f1004d0cc91237deb3c58d4ba1c`；本机逐路径bytes/SHA全部吻合。manifest SHA `725d418b3b1848db7c8c2635eca33a4b2392b84130d73e63f4cef2892a879a00`。原FAILED不变，profile保留在原私有位置，没有复制到归档、仓库或网页根。

另用正式exporter（SHA6b22a2f3）导出104保存/14截图并通过source-manifest重绑定到本机私有目录；原report保持同SHA。服务器与本机同一strict Gate的artifactChecks、coverage、developerChecks逐项完全一致，仍114/123、exit1。导出有1条未映射诊断引用，其实际JSON/raw另由上述完整归档核SHA，不冒称它已经由snapshot exporter搬迁。输出真实Windows ACL仅当前用户、Administrators、SYSTEM。

两个已终止strict run的owned loopback服务已停止，public80仍active。下一轮先定位读取阻塞与保存实际执行路径；保持旧报告/profile/冻结输入和原判据，不直接重跑同profile。无新增全局记忆。
