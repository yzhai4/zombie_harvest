# 临时营地名称：公开呈现窄修

玩家靠近休整建筑时，原附近说明与选中地图标签泛称“建筑”，难以把场景实体和已有临时营地用途对应起来。本轮沿用已有名称“临时营地”，改动仅两个呈现消费者；不增加建造目录项目、规则、效果、命令或存档字段。

源码提交[5b797256](https://github.com/yzhai4/zombie_harvest/commit/5b7972567eb745c69d659aaa411dd49e3a362e37)，parent8d941f23，tree60759e4d；HTML SHA256 `dfe75870c66c2fdf4c6834a62debfd47723d9cdfa6bdff9d638cbddd82c3942b`、993818B，SAVE21／CONTENT3不变。GitHub GET commit确认只有dist/index.html第6752、7197两行替换，API tree与41项实际选中源码依赖逐blob核对匹配。API证明只证明来源，本地无.git，git ancestry由最终CI的require-git另核。

[证据索引](evidence/shelter-name-display-v1/index.json)、[范围](evidence/shelter-name-display-v1/selected-coverage.json)、[来源证明](evidence/shelter-name-display-v1/source-artifact-proof.json)与[当前manifest](iteration-manifest-v1.json)已接入。本地freshness15／15、方法self-test76／76实际exit0；90个artifact引用是工件数，不能说成90个游戏测试。原生报告保原字节；带私有执行路径的元数据采用明确的path-only伴件，完整原件仍在原私有执行目录，不把本包称为全量原执行归档。

## 实际验证

必要既有源码合同实际执行7／7、各exit0：camp-area、camp-rest、content-chain、event-gate-parity、gameplay-vertical-slice、content-episode和static smoke。静态smoke明确是static-contract，未称真实三日。规则纯模块同字节的observer／replay历史结果保原来源复用，不记作新执行。

名称Chrome受控验收实际15／15，Node PID34480，8.093秒，exit0；两个实际主文档200且匹配dfe，errors空，context／browser／server清理成功。使用独立完整TEST-ONLY夹具，经真实loader／writer派生；没有读取或继续A08业务档。默认实际renderer保continuous-motion、actor-canvas、player-marker和地图tile，没有强制legacy层。

附近标题为“临时营地 · 可管理”。未focus地图标签仍按既有CSS隐藏；公开选择该地块后“临时营地”标签可见，不宣称常驻显示。公开C建造目录仍是原六项，没有shelter。附近威胁使30／60分钟控件disabled，外部拒绝原因可见且aria-describedby关联；普通点击被阻止，未force。两个scene各自然推进1分钟，均无camp.rest开始／步骤／命令或30／60结算，不声称取证零时间。

390×844下危险原因文字完整可读，60分钟按钮仍部分在视口之外。本次不是完整移动端布局通过，此项保留为UI积压。

既有episode主浏览器合同另以未改runner实际执行12／12，Node PID34160，5.281秒，exit0；两次主文档均匹配dfe，errors空。原生报告没有cleanup字段，原件保留；执行方法成功路径等待清理，伴件另观察自有Node和8个Chrome进程均退出。没有独立socket／端口测量，不补造该项证据。

## 边界与合理性

新IterationEvidenceV1只选择本构建的主浏览器结果和必要源码合同；旧2fca的50源码合同、142浏览器检查与290工件引用保历史身份，不整体迁为本构建通过。API证明、源码执行、受控Chrome、正常连续玩法、真人体验与生产部署分别核。最终精确CI须对应实际开发head；源码对象存在不等于分支同步、合并或部署完成。

六视角：玩家能将可见建筑对应到既有营地用途；NPC岗位与个人记忆不变；营地费用与休整资格不变；势力没有新增贡献／信任；敌人仍会施加原危险；全局事件链仍消费原真实命令与保存。名称不证明安全或完工，也不让建筑变成额外可建造项。

[A08](public-self-defence-prefix-a08-20261019.md)保持原HTML、真实费用和UI80／80耗尽；未重跑或重置预算。本轮未证明休整可达、工程上线、正常中继全链、自然三日或真人理解。下一主主题仍是可理解的真实后果，再以一个NPC的一个有来源经历影响一次后续互动。无新增全局记忆。
