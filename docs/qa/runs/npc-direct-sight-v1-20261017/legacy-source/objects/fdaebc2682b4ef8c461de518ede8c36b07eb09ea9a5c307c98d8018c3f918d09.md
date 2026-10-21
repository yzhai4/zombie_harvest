# ADR：事件链结算事实与展示历史分离

**状态：** validated  
**范围：** content-chain-ui-001 / SAVE21 / CONTENT3

`activeChains.history` 只保留最近 20 条用于展示，不能承担永久的节点幂等判定。一次 22 节点循环已证明被裁掉的节点可以选择另一分支重新领奖。

采用 active instance 的 optional `resolvedNodeIds` 保存完整结算集合。按注册节点顺序去重，过滤不属于当前定义的 ID；旧实例缺该字段时从有效 history 与每个定义节点的 appliedEffects 收据复原。新的字段随既有 contentState 保存，不增加新必填项或改变 SAVE21/CONTENT3。

effects 可能 normalize 并克隆 contentState，因此节点推进和新集合必须写当前权威实例。失败必须先回滚 effects，再直接把顶层失败交给 CommandBus；底层 applyEffects 保持系统事务原语，昼夜/终局/窗口 Gate 放在链入口。

UI 事项与回执属于视图状态，不另建剧情状态。按钮绑定渲染时的实例、节点和选择；结算后显示回执且禁用，主动切换事项才能继续，防止双击串到其他事件。资源回执增加 before/after，使 UI 采用 clamp 后的实际差值。

源码命令轨迹 hash 为 `c5d6c772`，保留旧投影兼容断言 `e14e0776`；保存/账本投影 hash `4aec7a31` 分开记录。43 项源码执行与真实浏览器夹具提供证据，不用静态检查数量代替行为覆盖。
