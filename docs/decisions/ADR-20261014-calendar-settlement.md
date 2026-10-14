# 日历结算、每日权限与明确报告事实

**状态：** active；源码与单局/显式夹具已核验，连续三日日历体验 Gate 尚未完成。  
**范围：** SAVE21 / CONTENT3；纯 reducer 和 renderer 的迁移前契约。

## 决策

效果事务会 normalize/回滚并替换 `contentState`。计划会效果完成后重新取得权威对象，再写终态、历史与结果；旧引用不作为事务提交对象。已有效果收据或成功/失败事实用于恢复终态，不能重新发奖励。与已修注册链使用同一原则。

`commandPointsGrantedDay` 表示当日授予事实。同日 cap 可校准并向下 clamp，不能补回已花点数；只有新日历日或缺授予事实的旧档才授予一次。保留既有信任阶梯，不用提高信任制造测试权限。

附近菜单显示和选择共享1.25距离。营地区域交互进入普通 CommandBus，返回实际 before/after/minutes，保持既有训练/晚餐的分钟与资源代价。没有材料/人员的拒绝不能产生成功区域事件。

报告关闭是独立命令，其 reducer 明确返回对应 `threatId/day/hour/minute`。不在 CommandBus 自动把任意输入合并为成功事实：输入声明不等于结果。wrapper要求已结算报告与有效ID；相同 commandId幂等，新 ID 重复关闭无成功收据或checkpoint。关闭不拨世界日期；自动夜潮与14天终局另立契约。

## 验证与限制

27项plan/day/close源码检查（轨迹 `66c9368d`）、16项区域检查、43项注册链检查（`c5d6c772`）通过。恢复旧 close wrapper 的内存负控准确失败；当前构建26项明确 boot-save 浏览器夹具包含非零已花CP的两次刷新，27项普通新局浏览器包含真实采集与报告关闭。低层调度/渲染在源码VM中有 instrumentation；保存投影9夹具 `4aec7a31` 与上述执行证据分开。

普通世界自然 tick 的保存约12秒一次。测试读取允许并记录最多1分钟 DOM 超前，同时仍要求动作的新seq/具体收据/状态变化、保存FNV/schema/savedAt一致；这不是“UI和保存当前状态完全相同”的声明。多日原始保存再由独立artifact Gate检查前一夜计划instance/meeting/choice因果，避免日期巧合造成假通过。

失败、跨构建和恢复历史均保留。三日公开训练路线强化SAN/士气，不能支撑平衡或自动夜夜尸潮结论；新close Gate也不能替代旧resolved报告的loader兼容验收。后者见 `PROB-20261014-resolved-report-boot`。

## 回滚

PR #4 前一提交 `446e6071791ce14f96477da3313cf440203886d4` 为本轮可恢复源点。回滚需要兼容代码和保存一起保留，不能降低SAVE数字替代迁移。Sites生产源线独立，本决策不表示已覆盖线上。
