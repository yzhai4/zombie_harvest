# 独立入口资源 404 定位

**范围：** 冻结8a4测试构建的新临时浏览器会话，入口观察4秒、公开“开始新游戏”后观察7秒；不是原持久 profile 或三日路线。完成耗时13.444秒，terminal exit0。

在 goto 之前注册 console（text/location）、requestfailed、HTTP>=400 response 和 Chromium CDP Network.responseReceived。没有保存注入、隐藏游戏函数调用、原profile复用或服务器文件修改。新的 ephemeral context 只产生自己的短暂新局状态，结束后关闭。

| 实际观察 | 结果 |
| --- | --- |
| HTML入口 | 200；响应原字节 SHA256=`8a4abf285651e5ee78905da2b819648aa1ef862e580e8b4710e8c71079604ba0` |
| `/actor-sprites.js` | 200，resourceType=`script` |
| 自动 favicon 请求 | console.error 的 location.url=`http://127.0.0.1/favicon.ico`，line/column=0；CDP 同URL status404、resourceType=`Other` |
| 独立普通GET `/favicon.ico` | 404；仅证明该端点本次状态 |
| 公开新局阶段 | 没有新增 console error、requestfailed 或 pageerror；截图可见地图、角色和中文UI |

Playwright page.response 收到的两条响应均为200，因此本次其 httpErrors 仍为空；CDP另外捕获到了浏览器 favicon 的404。这解释了**本次新观察**中泛console404与httpErrors空列表同时存在的原因，不表示 page.response 能完整覆盖浏览器图标请求。

原三日报告里的9条404只有泛文本，没有 location/URL，本次不能证明它们全部来自 favicon。原错误及历史报告保持原样。此短入口观察也不能证明后期素材、其它分支或移动端资源全部正确。

完整私有诊断 `diagnostic.json` SHA256=`24db57d663aedbbc3dd387679074382cbcc42cdf5d7a5381afb4d5dd279fa559`，含逐条时间/阶段/URL/status/resourceType、截图指纹和显式端点控制；仓库只记录上述小摘要。

建议后续候选显式声明可用 favicon（本地SVG或直接内嵌SVG），随后在新临时会话重新验证自动请求与console。favicon修复不会改写历史9条来源，也不替代报告恢复B1–B16；本审计仅提交诊断，尚未修改HTML或部署。
