# ADR：重复事件的实例身份、旧档与日志

日期：2026-10-17。状态：开发分支采用；生产 Sites 未发布。范围：声明 `repeatable:true` 的注册内容链；不迁移全部每日 EventDef。

## 问题

仅用 chainId 对短缺事件去重，会永久封闭后续日；只增加 `chainId:day` 又可能让昨天渲染的按钮结算今天的实例。没有实例身份的 fallback、效果和历史还会默认归入每日事件，破坏重放与未来 EventFact 消费者的因果关联。

## 决策

新增字段仅用于 opt-in repeatable 内容：`episodeSchemaVersion=1`、`instanceKey=chainId:创建日`、`instanceId=content:instanceKey`、`defId`、`definitionVersion`。创建日从 active.startedAt 推导，跨午夜不刷新。公开按钮保留 instanceKey / instanceId / defId / definitionVersion / nodeId 五元预期 token，命令验证和 reducer 再验证；不为失效按钮静默替换当前 token。

选择、自动收束和自治效果传递原实例身份。effectId、完成记录与内容历史按 episode 分隔；旧非重复链原字段和 hash 保持。fallback / autonomy 无当前 active 的重试，只有完成记录和原成功回执共同证明五元 token（fallback 还需同 reason）才返回 duplicate；有新 active 时旧 token 拒绝。回执已超保留窗口而无法证明的重试拒绝，不推测过去奖励。

SAVE21 / CONTENT3 保持版本；完整旧 writer 输入缺字段时加性迁移，使用原 startedAt；一次性旧完成 chainId 保留并只保守挡住保存当日一次，不编造历史选择。当前没有 definitionVersion 迁移 adapter，所以未知已声明版本在原始校验阶段拒绝，不安装无法结算的 active。缺字段与显式损坏分开。

历史 `ration` / `forage` ID 保留，叙事按实际规则修正；新藏粮是作者预设的有限来源，每局总量两份，以持久 flag 消耗。旧选择不追溯补资源、代价或功绩。详见[断粮设计卡](../scripts/zh-food-shortage-001.md)的六视角合同。

## 证据与限制

`check-content-episode-v1` 执行实际 loader / validator / reducer / producer，包含完整旧 writer、五元 stale、跨日、午夜恢复、未知版本、fallback/autonomy receipt、重试、有限来源、继任与失败回滚。`browser-content-episode-v1` 在 boot 前一次性注入旧 writer，随后只用公开 UI；它是 fixture-browser，不是自然多日游玩。

Observer 的独立纯表达核心与内嵌实现保持字节一致，只返回深冻结获准 facts；这不等于完整 actor 信息权限，也没有接入 LLM。严格 evidence manifest 对源码、runner、原始报告和浏览器 HTTP SHA 对账；待验证标记不能通过。最终计数和 Git 来源以 [manifest](../qa/iteration-manifest-v1.json) 与本轮 [QA](../qa/episode-observer-20261017.md) 为准。

## 后续与回滚

保持 Scenario JSON 为验证过的最小 headless 合同，下一轮补真实 boot loader 与 actor/perception 观察权限，再验自然三日。引擎迁移继续以可移植规则核心为边界；本切片不增加新引擎、学习式 World Model 或生成式 Director。

回滚到本切片父提交可恢复旧运行时；新 SAVE21 身份是加性字段，旧校验器不依赖它。藏粮的新 flag 在旧版仍会保留，但旧版没有新前置，可能重新发放旧 forage 奖励；因此回滚仅用于测试隔离，禁止把旧奖励逻辑重新上线而声称跨版本奖励守恒。
