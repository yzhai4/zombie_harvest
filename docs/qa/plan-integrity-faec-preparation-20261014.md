# faec 计划会 browser 验收准备

**状态：** preparation superseded by verified faec browser run；未改变线上服务。  
**日期：** 2026-10-14。

当前 faec HTML SHA `faecaffd12aefdf3c1c0f1dd57130bbb2ba37d5da0e9a6e81bc1f7532733335c` 已独立生成七份计划夹具，fixture manifest SHA `662a6959734b971a1d9214ccf1abb5661d5cdd7725fe7f36445e904b0691f156`。faec runner 候选 SHA `0ac5945dd376be46fb9cabd96f18abd0163034a466d4feaa007365f4264ed330`，generator SHA `22062fd3b36bf8d47f08b31855beb380663a37e9e74b6b537bc96ff85ddf226a`，方法检查器 SHA `758c2b828a5ef889022fc950559dbe231f6cd1fea92b8137b45908a871b09a72`。

离线实际 VM/fixture 方法检查为 72 controls + 7 seed subcontrols，`browserStarted=false`、`naturalGameplay=false`。合同仍包含七场、每场两次 reload、实际公开按钮、一次 CP、同日额外遭遇/总结/关闭、来源 SHA、清理和失败原件要求；没有放宽 58a4 版本的判据，只把 source SHA 绑定到 faec。

## 后续记录

候选准备后，服务器 `82.157.208.167` 的 SSH 在 TCP 建连后于 `kex_exchange_identification` 阶段被远端主动关闭，连续等待后仍未恢复。此前的 58a4 计划 browser 运行已完成并清理；public `zfarm-v82.service` 未改。没有重启服务器、修改防火墙、替换线上服务或使用旧 browser 结果冒充 faec。

待 SSH 恢复后，先核对 loopback 静态服务、faec response SHA 与 fixture manifest，再以独立 systemd 进程组启动 600 秒 runner/900 秒 watchdog。若 runner 失败，保留完整 report、raw、PNG、console/HTTP 和 cleanup 事实；不把 58a4 的 7/7 结果移用到 faec。

