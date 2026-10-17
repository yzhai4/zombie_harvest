# 场景包与预期目录同源生成漏检语义漂移

日期：2026-10-17。状态：external C1候选4fc生成工具中confirmed，修正待验；未安装或发布。C2 JSON编译器仍未实现。

固定4fc内部修改包效果会被目录比较拒绝；但原私有生成器同时从package.events生成包和预期目录。执行TEST-ONLY反例：JSON forage粮食效果2→3，再用该生成器重建，实际package validator通过、公开source start成功；真实注册效果仍2，真实Choice结算仅+2。故原负控只证明固定产物内的比较，没有覆盖重建时的共同漂移。这是构建/来源校验问题，不宣称已发布游戏曾产生JSON驱动的+3。

修正C1：独立冻结当前作者目录并固定其来源SHA；包只能声明已支持的基线，实际启动核注册Gate、Choice.requires、Effect及fallback语义。由同一变量生成预期值不能代替真实consumer对账。JSON语义变更要么明确unsupported，要么经后续C2真正编译到完整定义并原子注册，不能静默继续手写旁路。

验收保留原生成反例和新生成器反例，各自source/package/core/实际writer与报告SHA；再验正常启动和既有断粮效果。未完成C2前继续标baseline-only，不扩大支持内容轴。

开发增量：d6592443／a2fcdb64的C1列明source120／Chrome134与旧writer验收已完成，见[QA](../qa/scenario-boot-c1-20261017.md)。C2 JSON编译/原子注册、ActorObservation与生产仍未完成；保留以上原问题和失败。
