# 水车 GateV1 迁移 QA

**日期：** 2026-10-16  
**构建：** 本地 `dist/index.html` 并发工作树快照；最终 HTML SHA-256 在远端上传后记录  
**范围：** `watermill-002` 的 GateV1 启动与选择门控  
**发布状态：** 未部署 Sites；生产 v81 保持不变

## 检查命令

| 检查 | 结果 | 证据边界 |
| --- | --- | --- |
| `node scripts/check-content-chain.mjs` | 53/53 通过；source replay hash `c5d6c772` | 执行 HTML 内真实 registry、Gate、resolver、effect reducer 与保存恢复夹具；不是浏览器证据 |
| `node scripts/check-inline-syntax.mjs dist/index.html` | 通过 | 语法边界 |
| `node scripts/check-daytime-combat.mjs` | 23/23 通过 | 昼间伤害合同；与水车 Gate 分开记账 |
| `node scripts/check-night-guard.mjs` | 通过 | 夜间入口边界；以最终提交 CI 为准 |
| `node scripts/validate-content.mjs` | 通过 | SAVE21/CONTENT3 内容结构检查 |
| `node scripts/replay-harness.mjs --self-test` | 10 个夹具通过，hash `4aec7a31` | 回放/保存投影；不代表自然长局 |
| `node scripts/smoke-three-days.mjs` | 静态 55/55；本机 Playwright 不可用 | 不能称三日真实浏览器 smoke |

## GateV1 夹具矩阵

| 场景 | 预期 | 结果 |
| --- | --- | --- |
| day4、发现水车、campTrust≥25 启动 | 创建 active chain，不写奖励 | 通过 |
| 地标缺失、信任不足、窗口外启动 | 拒绝且状态不变 | 通过 |
| 未知/损坏启动对象条件 | fail closed，效果和状态不变 | 通过 |
| 修复选择 `scrap>=20` + `carpenter_alive` | 条件满足后由旧 effect DSL 扣零件、降压力并写 flag | 通过 |
| 材料不足或木匠死亡 | 仅锁修复，拆解仍可选 | 通过 |
| 未知/损坏选择条件 | 在效果前拒绝，不写资源或 ledger | 通过 |
| 已启动后 campTrust 从 30 降到 24 | 选择不重新检查启动信任；仍按当前 choice gate 结算 | 通过 |
| 夜间、day<4 或 day>10 直接调用选择 | 拒绝，不能由 UI 绕过 | 通过 |
| 重复命令、已完成链、过期 fallback、JSON 中间节点恢复 | 幂等、回滚、恢复后不重复领奖 | 通过 |

## 六视角 QA

| 视角 | 已检查内容 | 结论 |
| --- | --- | --- |
| 玩家 | 前置可解释，信任漂移不撤销已启动承诺，夜间/过期拒绝可见 | 合理 |
| NPC | 阿梁死亡/失踪锁修复，未创建凭空代修 | 合理 |
| 营地 | 零件与 meter 只在效果事务成功后变化，失败不留半套状态 | 合理 |
| 势力 | 本轮不发河湾互助会关系奖励，避免内容承诺超出实现 | 范围受控 |
| 敌人 | resonancePressure 仍记录，但不声称已经驱动尸群强度 | 证据边界清晰 |
| 全局事件链 | 水车不阻塞中继和主循环；active/completed/过期事实可回放 | 合理 |

## 未覆盖与发布条件

- 未执行自然 day4 触发、连续三日真实浏览器或 Sites 线上回归；Playwright 缺失时不能把静态 smoke 当作浏览器通过。
- 本轮未迁移 `EventInstance`/CAS 或统一 `EventEffect`；只迁移 Gate 入口，效果语义沿用现有 reducer。
- `contentConditionMet` 对未知对象条件 fail closed 属于全局行为收紧，需在最终 CI 和旧内容包审计中确认没有未登记类型。
- 远端上传后需重新计算并记录最终 HTML hash，等待对应 CI 绿色，再更新 PR 说明；在此之前不发布 Sites。

