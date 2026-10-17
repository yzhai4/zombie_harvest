# 未绑定旧档补出错误默认种子

状态：confirmed in external C1 candidate 4fcf4407；尚未安装或发布。实际世界seed/RNG保留，新增snapshot.seed来源表示错误；不称已经发生reseed。

旧validator允许worldMeta.seed为finite，缺snapshot的合法派生旧writer将seed设为0.5后，prepareSavedScenario以该值创建snapshot，normalizeScenarioSnapshot只接受整数而回落当前WORLD_SEED。新binding.sourceSeed仍0.5，但新snapshot.seed变成当前默认，不能称所有种子字段都记录了原来源。

修复仅限显式legacy-unbound表示：live snapshot.seed与binding.sourceSeed始终记录真实旧worldMeta.seed，包括fraction与uint32外finite值；已有声明即使不同也完整保留为declaredSnapshot，并由迁移收据说明未核生效。normalizer、validator、writer、投影与刷新同时遵守该语义，不作>>>0强制转换，不改变worldMeta.seed/rngState/replay。新bound/fresh仍严格uint32，未知未来binding与损坏字段不能降级为兼容缺省。

开发增量：d6592443／a2fcdb64的C1列明source120／Chrome134与旧writer验收已完成，见[QA](../qa/scenario-boot-c1-20261017.md)。C2 JSON编译/原子注册、ActorObservation与生产仍未完成；保留以上原问题和失败。
