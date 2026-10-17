# 计划会结算写旧引用与同日刷新补点

**状态：** active  
**范围：** 三日浏览器验收前置；SAVE21 / CONTENT3

## 已复现

两个独立只读审查者提取当前 HTML 的真实 normalizer、effects 和计划会函数执行：day2 执行 day1 的候选，campCollapse10→7、resolver返回成功且 `plan.meeting.resolved` 写入，但权威 `contentState.planMeeting` 仍为 candidate / resolvedDay=null / history=[]。effects 中的 ensureContentState 深克隆使后续计划结算写进旧对象；下一天再次执行会重复写结算事件，即使效果ID阻止了重复资源。

同 day2、points0/max2/grantedDay2 的存档走 boot 用的 `refreshCommandPoints('initial')`，points 被补满2。刷新浏览器成为获得额外指挥权的来源，违反每日不累积的规则。

## 修复契约

- 成功或失败回滚后重新取权威 plan，再写 resolved/status/result/history；一次会议只终结一次，账本与保存状态必须一致。
- `commandPointsGrantedDay === day` 时只校准上限、向下 clamp 已有点数，不重新发放；日历跨日或旧档未记录当日发放时才按 cap 刷新。
- 同日关报告、reload、重复晨间入口不重复配给、upkeep、计划效果或点数发放。
- 保持可选遭遇与日历时钟分离，不为旧三日脚本改 day++；SAVE21/CONTENT3 无新增必填字段。

## 验收

真实源码执行覆盖成功/失败、次日再次执行、同日重复刷新、同日reload等效输入、cap下降、跨日和旧档默认值；真实浏览器公开行动推进三日日历，核对保存 plan 状态、点数与每日事实，不仅看结算事件存在。

回滚点：PR #4 源提交 `446e6071791ce14f96477da3313cf440203886d4` / HTML `698b2149...`。Sites v81 保持独立源线。
