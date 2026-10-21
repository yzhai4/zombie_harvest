# 计划会七场真实浏览器验收

**状态：** 通过（范围限定为冻结 58a4 构建）；不代表当前 faec 开发构建已通过。  
**日期：** 2026-10-14。

## 固定输入与隔离

- HTML SHA：`58a4bb28453429c73ad27baf22a377e3b7ff389b387a524196a06e490b0a65e1`
- runner SHA：`53bdb62046a5b27016645ae747e57a4dee8ba876089afec3c9f89399c95a4399`
- fixture manifest SHA：`770ca20755904cb8f2594f3f0112d9c201245a0d3947e574edf79f1d92b2682c`
- 每个场景使用独立临时 browser context、全新输出目录和一次 boot 前 fixture seed；两次 reload 不重新注入。
- 运行在服务器 loopback 独立静态服务，使用外部 systemd 进程组 watchdog；线上 `zfarm-v82.service` 未改，Sites 未改。
- 归档不含 profile、cookie 或凭据；原始浏览器工件 164 文件、39,501,317 字节，归档 SHA `bf7d81a2ca8e3862d03c1f37167bed13bc2be89d3d95ae83ea3518fd854936ef`。

## 结果

7/7 场景、203/203 runner checks 通过，runner report SHA `00456e0ddaff4f6228f3f4f7b0b3cbb6e158d76b79b8ebbfe679c86aba2ada8a`，artifact manifest SHA `60e310dd8c8fe719fac028684d88295c09f8720a79342a87c532bf5d0f0e0b3d`。

覆盖：

- trust 20、59.99：计划可旁听，干预按钮保持禁用，原因和实际数值可见。
- trust 60 / CP2：支持、修改、否决各一条公开路线，真实消耗一次 CP，回执与 replay command/instance/choice 对齐。
- 支持路线额外完成真实同日移动、`endDay`、夜间遭遇、战斗总结、关闭报告，再回到白天计划；同日 commitment、CP 和候选不重生成、不退款、不重复扣费。
- trust 80 / CP0：因 CP 不足保持旁听。
- 旧 committed trust20：只读保留历史承诺和已花 CP，不因新权限追溯撤销。
- 每个场景两次真实 reload，页面 document response 均回到冻结 58a4；失败列表为空，清理七个 context 与浏览器成功。

这是计划权限/实例冻结/phase-safe UI 在 58a4 的真实 browser 证据。当前 faec 已新增统一命令编号与修墙 proof，必须另跑同等范围的 browser；不能把这次 58a4 结果移用为 faec 通过。
