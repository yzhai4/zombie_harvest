# 整数时钟与可恢复候选写前保护：开发QA

状态：本地源码与实际Chrome已终态；源Git对象已核，开发ref／精确CI由发布终态收据另核，生产未部署。不是自然多日、平衡或真人体验验收。

## 构建与实现

- source commit：`5a23b6951b7ff70b15d4fb5ddadad35a16b5dbb6`，tree `94cf32bb7e70c59171b78d1dad4abba3b2321c63`，parent `15e9ea963230bde812c79893485323b5a5870fe1`。
- HTML：`2bad52a4435ed95d1dfa6d0030dab3407f4a4cc9b0e63f07b5ff804304accc16`，930889字节，SAVE21／CONTENT3；6个变更blob及174个scripts／dist／workflow依赖逐项匹配，其它5583 blob不变。源对象存在不等于ref／CI／部署完成。
- [合同](../decisions/ADR-20261018-whole-minute-clock-v1.md)：原Number乘法边界后的十进制credit、整分钟模拟、原Bus duplicate、缺槽只读0且无新adapter、同raw结构／恢复分类写前校验。默认整数轨迹与夜战规则保持。

## 实际源码执行

45项既有源码／方法合同均实际终态exit0、输入无漂移；另新clock一个合同含8组，exit0。不是将子检查相加为53个独立功能。source范围包括内容／night、日历与计划、保存恢复、命令预算／维修、LLM离线合同、战斗／presence／rest、Scenario C1／C2、NPC与中继、回放投影及静态smoke。回放／static检查只证明其列明范围，不等于完整GameCore重放或自然三日。

当前最终2bad新clock原报告SHA `d77e68a2ea291fdfa12d5efbe383d3eac6bf5e846fdefc03bf70fcb08a8e91b6`，按manifest绑定；早期272f同方法结果保持原来源，不移用。实际最终8组覆盖原1200ms callback、固定倍率累计、whole0无模拟、余量跨Continue、真实付费5／8／10分钟、pause／rate／休整／epoch／generation、duplicate、无效候选主备不覆盖、live undefined不能被JSON抹成旧缺省、旧writer／324位范围／损坏字段、3个独立午夜配给upkeep及DAY18／真实战斗writer兼容。

原3545同最终方法实际0/1、exit1，原回调反例保留。272f第一矩阵42/45：camp-area漏新真实依赖、relay-producer旧参数字面trace、竖切片孤立seed覆写，三种方法错分别修正并保原件。竖切片真实致死另是产品问题，不与seed错误混写。最终2bad45/45新运行不覆盖旧失败。

## 实际Chrome

Chrome155，clock一个旧writer定位scene，实际21 callback（11＋10）、2个main响应，10/10、errors0，context／browser／server cleanup均true；原报告SHA `b4bb8f4acb5a41eeded2ad0812cd7a5ff4b087cc407f38cb6d8b5d3e02fa66df`。原完整旧writer只在boot前调整合法rate0.5，无postboot写状态、隐藏advance、方法直接调用timer或暂停取证，没有冒称使用公开倍率控件。

正常writer在reload前已观测到06:05／seq14／credit0.5，actual selected primary与新boot相同；selected的reason为真实visibility-hidden，但正常非零保存已独立在前，不靠pagehide补绿。继续后10个新真实tick，新正常writer06:10／seq24／credit0.5。两次main均完整匹配2bad。root目视390宽恢复画面；不称全面移动端体验。

primary episode原canonical方法同源独立12/12、exit0、errors0，2main均2bad；report SHA `e903eaf0fb32e9db738165d09ea59d1cddd5b2528dd9ea34564b76d3b803615a`。原episode report不含cleanup字段，不补造。两套合计22检查／4main，均属受控fixture。

旧272f浏览器7/8、exit1完整保留：方法把callback9的正常0.5存档与callback10的live0错误配对，实际新tick已合法消费credit。v3只修最近live与normal writer水位匹配，不延长deadline或改变时间／游戏规则；新2bad10/10不是追溯改旧失败。

## 新风险与下一行动

结构validator通过仍可能有[DAY致死未形成结局](../problems/PROB-20261018-day-fatal-outcome.md)。当前writer拒绝这份候选并保留原主备，真实Continue恢复的是旧安全DAY，不是第三天现场败局；完整loss／UI／timer／保存为下一P0。随后中继当前能力／付费修复及公开主线理解pilot。三个午夜、训练式静态日历和大步day3均不称自然三日、生存或好玩。

最终来源、选定工件及当前native报告以[IterationEvidence](iteration-manifest-v1.json)绑定；stale／pending／unavailable不算通过，完整旧证据保其原字节与构建。Scope不扩大到生产、完整Actor／规划／Memory／Studio、多副本或引擎迁移。

本地最终freshness实际18/18、self-test76/76，均exit0。本地无.git，commitVerification=unavailable；174依赖的Git API树证明独立列明，精确CI必须在更新开发ref后再核，不由本地绿色推定。
