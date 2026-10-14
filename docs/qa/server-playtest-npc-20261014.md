# v82 NPC 角色卡与晋升 Gate 浏览器回归

**日期：** 2026-10-14  
**测试地址：** `http://82.157.208.167/`  
**运行方式：** Ubuntu 服务器上的 headless Google Chrome + Python Playwright；每次运行先清理 `localStorage/sessionStorage`。

本轮在新局首日读取玩家可见的幸存者面板，并继续完成原有采集、建造、尸潮和回到白天流程。NPC 测试不注入存档或隐藏状态：

- 10/10 角色卡成功渲染。
- 10/10 角色卡包含岗位属性与战斗摘要。
- 初始三名英雄均显示主动专长标签。
- 普通 NPC 显示 `普通 · 晋升 0%`，证明晋升进度从默认值开始。
- 首日未满足晋升条件时，运行时没有暴露 `promoteHero` 操作。
- 后续原有玩法检查全部通过：事件选择、采集、建造、尸潮移动、尸潮结算、每日总结和回到白天。

原始结果见 [server-playtest-npc-result-20261014.json](./server-playtest-npc-result-20261014.json)，共 19 项检查通过；浏览器唯一控制台噪声是预期的 favicon 404，游戏资源请求没有 4xx。

服务器上使用的临时 Playwright 环境位于 `/tmp/zfarm-test-venv`，不修改游戏服务和生产站点。

