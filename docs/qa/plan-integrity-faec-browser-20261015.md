# faec 计划会 browser 验收

**状态：** verified；仅为隔离 QA 证据，未发布到 Sites。  
**日期：** 2026-10-15。

候选开发 HTML 的 SHA256 为 `faecaffd12aefdf3c1c0f1dd57130bbb2ba37d5da0e9a6e81bc1f7532733335c`。运行前由 loopback HTTP response 再次核对同一 SHA，fixture manifest 为 `662a6959734b971a1d9214ccf1abb5661d5cdd7725fe7f36445e904b0691f156`。

真实 browser runner 使用独立 fresh context、公开计划会控件、实际 reload 和真实保存读取；本轮不是自然平衡试玩，fixture 的 `naturalGameplay=false` 保持原合同。结果为 **7/7 case、203/203 checks**，`browserStarted=true`，七案均 `passed`，21 份 document response、52 个声明工件和 8 条 cleanup 记录，未留下未运行 case。

| 证据 | SHA256 |
| --- | --- |
| `report.json` | `01aab103a4ff7b5364bc91fa2519b00b5c2ed4945df5cb42265f964af82a0f0` |
| `artifact-manifest.json`（164 份游戏工件；manifest 自身单列） | `9ffeaa41784704481a13f307d65b4ff1a5915aae335b4d5fd155035656c2e754` |
| 跨机归档 `faec-browser-verified-20261015.tgz` | `fffea9b41410dfd8b8e4dd0a7feddacba0b0c221990048a15abba55ef884432a` |

归档后的本地复核逐项比对 164 份工件的路径、字节数和 SHA，无 extra/missing/mismatch；`report.ok=true`。归档不含浏览器 profile、凭据或公共站点文件。隔离 loopback 服务已停止，公共 `zfarm-v82.service` 保持 active，线上 Sites v81 未改变。

这份结果只证明 faec 计划会/修墙候选的真实浏览器契约；不把它扩大为自然三日平衡、完整十人主动技能、NPC晋升或 v82–v90 已实现。

