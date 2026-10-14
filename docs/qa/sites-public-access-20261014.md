# Sites 公开访问复核（2026-10-14）

目标：用户恢复公开后的 `https://zombie-harvest.jimmy-vaughanowl.chatgpt.site/`，不包含服务器测试部署。

- Sites `get_site`：项目 `appgprj_6ac6f400af788191922bc3f88d48846a`，`status=active`、`access_mode=public`、权限 revision 6；最新版本号 81。
- 现场版本对账：当前公开 Sites v81 源提交为 `f3488457286836bf986dc90b5e0c3f6f425813c9`，部署 `appgdep_6acaec9bc34081918f91a616b8f56dd4` 状态为 `succeeded`。该提交是当前生产源，不应一概称为旧源。
- 实际内置浏览器：成功显示“我是大救星”开始页与“继续存档”按钮，点击后进入第 1 天的地图；时间、生命、行动力、附近 NPC 和操作面板可见。本次未进行完整玩法回归。
- 本轮再次复核后台 `public/active`、权限 revision6、版本81；真实浏览器点击继续后，地图与“已继续存档”提示可见。仅确认公开访问和继续入口，不代表全面玩法回归通过。
- 截图：`sites-public-access-20261014.jpg`。测试标签已关闭。
- 本机匿名 Python HTTP：403（17 字节）；服务器匿名 HTTP：403，标题 `Attention Required! | Cloudflare`（5486 字节）。匿名抓取失败不能据此判断站点仍私人；服务器请求明确遇到 Cloudflare 拦截。
- 网页提取工具无法读取页面，浏览器的全页辅助树读取超时；通过直接截图与语义按钮点击完成实际入口验证。

结论：公开权限已生效，真实浏览器可进入游戏。抓取/自动化出口仍存在访问限制。未修改站点权限、源码或发布版本。

版本与同步补记：本地/测试服务器开发 HTML 的 SHA256 `8a4abf285651e5ee78905da2b819648aa1ef862e580e8b4710e8c71079604ba0` 已进入GitHub独立草稿PR #4的f72503d，不是已部署的 Sites v81 源，也未推入Sites生产仓库，不能直接覆盖线上。

先前源仓库凭据请求遇 HTTP429 / Cloudflare 访问挑战，保留为先前失败；第二次请求已成功，`publish_on_push_accepted=false`。官方 Sites helper 成功只读拉取/打开独立兄弟目录 `IMSAVER-sites-v81-source-20261014`。本地只读核对：HEAD 精确为 `f3488457286836bf986dc90b5e0c3f6f425813c9`，`git status --porcelain` 无输出；源 `dist/index.html` SHA256 为 `11f25c4e68f7360a11b8c84a638b0f8a8270202af3bcf58b3047d278b4952400`。

本次源码同步已可用，只执行拉取/打开，没有提供 archivePath，没有 package、commit、push、Sites save/deploy；线上源未改，开发 `8a4abf...` 未发布。原 `sites-public-access-20261014.jpg` 保留，未覆写为本轮截图。此补记不表示三日浏览器验收或 CI 已完成，也不保存凭据或短期地址。

最新入口复核仍为 public/active、revision6、v81，后台浏览器正常显示游戏标题、继续存档与新开按钮。本页仅核对Sites入口与源同步；测试服务器三日完成与CI的后续结果分别见各自记录，不在这里混合成线上玩法通过。
