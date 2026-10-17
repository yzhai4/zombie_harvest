# 原生页面隐藏与自动化焦点模拟

**状态：基础设施探针已验证；新游戏B16尚未执行。** 首轮full原报告仍FAILED：1475项/1463通过/12失败，其中B16的实际visibility事件数组为空。原SHA `e5caf27e869bb7e25f5b740506ba069ab11d4658d033cb118cea3874e74ceb80` 保持，不用此探针改判。

## 实际原因与证据

服务器安装包的primary source `playwright/driver/package/lib/coreBundle.js` 39020–39024表明，普通context会启用 `Emulation.setFocusEmulationEnabled(true)`。这使测试中的页面持续可见：常规headless、Xvfb headed、真实窗口最小化均未观察到页面hidden。窗口管理器实际已报告 `_NET_WM_STATE_HIDDEN`，但页面仍visible；不能将OS窗口隐藏当作游戏收到了visibility事件。

当前公开Python API `BrowserType.connect_over_cdp(no_defaults=True)` 的实际安装文档3939–3942与同一driver分支一致：只对既有default context不施加焦点/media等默认模拟。新建 `browser.new_context()` 仍会施加，另开CDP session发送false也不能撤销原driver session的设置。读取primary source和独立探针分别记录，不能仅以参数名字推断效果。

root独占启动一个临时私有profile的正常Chrome，debug端口为loopback/随机，使用existing default context并切换真实两个标签。实际探针结果为：

| 观察 | 实际值 |
| --- | --- |
| 另一标签前台时 | hidden |
| 回到原标签 | visible |
| 两条visibility事件 | 浏览器原生，`isTrusted=true` |
| 隐藏时长 | 约2.8761秒 |
| 游戏是否执行 | 否，仅独立data页面 |
| JS属性覆盖/人为派发visibility | 均无 |

原JSON `native-default-context-visibility-probe-20261014.json` 保存在私有QA目录；没有profile、cookies或DevTools控制端点进入仓库。进程/profile/虚拟显示均在探针结束后清理。

## 下一轮测试边界

仅为B16提供明确记录的原生default-context路线，保留真实before-loader输入、timer/RNG观察和两次reload；不把no_defaults误用于新context，不设置document.hidden，不派发模拟事件。仍须实际观察trusted hidden/visible，并检查报告时钟和经济没有推进。≥60秒catch-up目前只属于受控源码测试范围，2.876秒探针不代称长后台游戏通过。

Linux headed运行采用[Playwright官方CI文档](https://playwright.dev/docs/ci)所述的Xvfb方式；服务器实际经APT安装Xvfb/Openbox供隔离显示使用。该环境准备不改Sites访问权限、公开测试服务或原三日profile，也不等于新构建browser通过。
