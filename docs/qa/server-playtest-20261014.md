# v83 前置切片服务器真实浏览器回归

**日期：** 2026-10-14  
**测试地址：** `http://82.157.208.167/`  
**部署目录：** `/home/ubuntu/zfarm-v82-a4ec`  
**构建：** `SAVE_VERSION=21` / `CONTENT_SCHEMA_VERSION=3`

## 部署证据

- `index.html` SHA-256：`698b2149ed8bf89f77471b1b4a59c66cb383040a22dfeb3e4bc7925d65f48305`
- `actor-sprites.js` SHA-256：`be4cf51de3f5d6b1aaf2811565ba0435a4ceb18f015bd7753fa9871a23ab1962`
- 公网 `GET /`：HTTP 200，标题为“我是大救星 · 尸潮农场”。
- 18080 端口仅回环可用；公网入口使用 80 端口，由 `zfarm-v82.service` 管理，`systemctl is-enabled/is-active` 均为通过。

## 真实浏览器环境

- Ubuntu 服务器上的 Google Chrome 155.0.8059.79。
- Python Playwright 1.64.0，使用无头 Chrome 直接访问公网 `http://82.157.208.167/`；同一脚本也支持回环地址复测。
- 每次测试先清空 `localStorage/sessionStorage`，避免旧存档污染结果。

## 通过场景

`server-playtest-result-20261014.json` 记录了 22 项通过：

1. 页面标题与游戏入口加载。
2. 点击“开始新游戏”后启动层关闭。
3. 幸存者面板显示 10 张角色卡。
4. 角色卡显示属性与战斗摘要。
5. 初始英雄标签正确显示。
6. 普通 NPC 显示晋升进度 `0%`。
7. 首日未达条件时晋升操作被门控。
8. 事件面板选择并关闭状态终端。
9. 采集动作推进时间。
10. 建造面板打开。
11. 木墙建造选择保持有效。
12. 推进到尸潮实时战况。
13. 夜间移动控制存在并可点击。
14. 夜间战斗实际启动。
15. 尸潮自动结算并显示夜间总结。
16. 每日总结面板可见。
17. 总结显示伤害字段。
18. 总结继续按钮可用。
19. 点击关闭报告后回到白天状态。
20. 重新加载后显示“继续存档”入口。
21. 继续存档后恢复相同天数。
22. 继续存档后恢复相同时间。

最终状态为第 1 天 `06:32 · 清晨`，重新加载后 `body` 已移除 `threat-map-active`，且天数和时间与关闭夜间总结前的白天快照一致。本次夜间记录为击杀 1、突破 4、伤害 -7。资源请求没有游戏文件 404；浏览器自动请求 favicon 的 404 已作为预期噪声忽略。

## 运行入口

Playwright smoke 已具备可复用入口：

```text
ZFARM_TEST_URL=http://82.157.208.167/ /home/ubuntu/zfarm-v82-a4ec/venv/bin/python3 /home/ubuntu/zfarm-v82-a4ec/server-playtest.py
```
