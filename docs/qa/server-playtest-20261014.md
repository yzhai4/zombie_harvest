# v82 服务器真实浏览器回归

**日期：** 2026-10-14  
**测试地址：** `http://82.157.208.167/`  
**部署目录：** `/home/ubuntu/zfarm-v82-a4ec`  
**构建：** `SAVE_VERSION=21` / `CONTENT_SCHEMA_VERSION=3`

## 部署证据

- `index.html` SHA-256：`db0eecc574ca930d435c36eed052010360a85fe1cbc634c50463fd77547fa2c9`
- `actor-sprites.js` SHA-256：`be4cf51de3f5d6b1aaf2811565ba0435a4ceb18f015bd7753fa9871a23ab1962`
- 公网 `GET /`：HTTP 200，标题为“我是大救星 · 尸潮农场”。
- 18080 端口仅回环可用；公网入口使用 80 端口，由 `zfarm-v82.service` 管理，`systemctl is-enabled/is-active` 均为通过。

## 真实浏览器环境

- Ubuntu 服务器上的 Google Chrome 155.0.8059.79。
- Python Playwright 1.64.0，使用无头 Chrome 连接公网部署目录的本机回环服务。
- 每次测试先清空 `localStorage/sessionStorage`，避免旧存档污染结果。

## 通过场景

`server-playtest-result-20261014.json` 记录了 8 项通过：

1. 页面标题与游戏入口加载。
2. 点击“开始新游戏”后启动层关闭。
3. 事件面板选择并关闭状态终端。
4. 采集动作推进时间。
5. 建造面板打开。
6. 木墙建造选择保持有效。
7. 推进到尸潮实时战况。
8. 夜间移动控制存在并可点击。

最终状态为第 1 天 `06:31 · 清晨 · 实时战况`，`body` 带有 `threat-map-active`。资源请求没有游戏文件 404；浏览器自动请求 favicon 的 404 已作为预期噪声忽略。

## 后续补测

本轮验证了白天入口、采集、建造和夜间控制；夜战完整击杀、夜间总结关闭、存档继续和 NPC 晋升需要下一轮脚本继续覆盖。Playwright smoke 已具备可复用入口：

```text
python scripts/server-playtest.py
```

