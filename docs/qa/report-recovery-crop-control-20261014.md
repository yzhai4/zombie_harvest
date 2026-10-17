# crop 控件可见性独立归因

**状态：** v3/412c逻辑run `run-20261014T211705Z-043adff1` 已真实terminal exit1，48/48场已执行，1641/1634/7。七条均为四控件visible+enabled断言失败，原false保留；完整终止原件审计见[第二轮browser审计](report-recovery-browser-second-20261014.md)。本文只读比对源，不将断言归因改写为整体验收通过。

本独审从服务器 immutable `legacy-v81-f348/dist/index.html` 复制生产 v81 原 HTML，原 SHA256 为 `11f25c4e68f7360a11b8c84a638b0f8a8270202af3bcf58b3047d278b4952400`，与实际生产18 capture 来源相同。其206行先声明 `.utility-row` grid、243行再全局覆盖为 `display:none`，1116行 cropBtn 位于该 row 中。当前冻结412c分别为207/248/1125行，同一规则与结构；两者仅这两条 utility-row display 声明，没有后续让它可见的规则。

因此旧全局 cropBtn 隐藏并非本次报告恢复新增回归。根执行者当前运行中原 DOM 读数是 `visible:false, enabled:true`，其他三常驻控件均 visible+enabled。v3 要求四者均 visible 的新增断言不符合原 UI：无论能否种田，隐藏 utility row 都会使它失败。运行中的这条失败与最终退出状态不能改成通过。

生产 v81 与当前412c均在接近 garden/greenhouse 时由 renderContext 动态生成 `[data-context-action="crop"]`，公开 click 路由进入 plantOrHarvest，再经 `crop.change` command / `crop.changed` receipt。种植与收获仍由近田、成熟/已种、体力和种子条件决定，原源码说明/农田提示也指向靠近菜畦操作。

下一独立 runner 应保持四个既有 DOM 的 disabled 状态都恢复，并要求 gather/build/endDay 三常驻入口可见且可用。crop 分开验证：关闭报告后通过公开移动到菜畦，读取实际近场按钮 visible/enabled；保留四控件 Gate 的 source/read-only 断言。不能 hidden DOM click、注入可见性或改 CSS 让测试过。

若要称 crop 执行成功，应额外实际点击公开近场按钮并保存 post-close、导航后 pre-crop、post-crop 原 SAVE。成熟菜畦收获应有 food+3、同 garden ready/planted 清空及 growth0，唯一 crop.change replay 与 crop.changed receipt 通过 commandId 关联。20分钟 action 推进与可能自然 tick 需分别记录；后续 reload 对动作后实际保存比对，原 close/SAN 补偿仍用原不可变 close receipt 验证。仅导航看见入口，不称收获成功。

已读冻结412c真实 dispatch 语义：context路由 `plantOrHarvest()` 没有传 preferred，因此 replay payload 的 buildingId 通常是 null；成功 reducer 返回 undefined，crop.changed 的 payload 序列化通常为 `{}`，没有食物 delta 或 gardenId。未找到菜畦的 no-op 也可能生成这一类型 receipt，故单有 receipt 不足以证收获。20分钟推进由内层 world.advance/time.advanced 的 minutes20 和 causationId 指向外层 crop command 证明；crop.changed 的 tick 在此推进之后。不得给旧 receipt 补造这些缺失字段来迎合断言。

本文没有改 runtime、CSS、v3 runner、报告或 profile。新契约须经 root 决定，由唯一 runner owner 写下一版，在新的独立 run 中复验，原失败数据继续归档。
