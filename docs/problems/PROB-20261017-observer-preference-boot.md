# 公开开始设置被待安装存档覆盖

状态：confirmed in external C1 candidate 4fcf4407；尚未安装或发布。独立source VM实际102/105，三个公开设置路径均失败；不是浏览器结论。

真实路径是visible startOverlay→openSettingsBtn→checkbox change→close→start/continue→普通650ms checkpoint/writer。fresh选true仍写false；bound原true选false仍写true；完整5fdd旧writer选true迁移后仍写false。原报告SHA004e53732afe09009b3efa2bf1ba61a062dc0f0987fedfc0e6b5792130014b55及三份完整writer私有保留，待本轮QA归档。

change handler修改当前初始state和sessionStorage，startFromSave却安装预先准备的BootRecovery.draft；applySettings按sessionStorage显示，observerAiConfig按已安装snapshot读取，因此勾选与有效表达配置可相反。正常开始后设置面板所在overlay已隐藏，postboot直接emit handler不能证明公开入口可用。

修复要求：开始/继续的公开布尔偏好在实际安装后、首次writer前接入current aiConfig；initialAiConfig和配置digest保留原开局身份。UI默认取待继续档/新局配置，明确sessionStorage布尔偏好优先级；非法偏好不授能力。继续旧档不重算资源、人口、时钟或RNG，保存失败冻结重试且不重复binding/迁移。真实公开UI可见性与源码handler/存档效果分别验收。

开发增量：d6592443／a2fcdb64的C1列明source120／Chrome134与旧writer验收已完成，见[QA](../qa/scenario-boot-c1-20261017.md)。C2 JSON编译/原子注册、ActorObservation与生产仍未完成；保留以上原问题和失败。
