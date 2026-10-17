中继有效岗位：下一切片最小修复契约

目标是在不改 NPC 身份、人口、资源、工程速率或旧历史的前提下，让“当前岗位”在中继职责 consumer 中一致。此文件是建议契约，不是已实施修复。

1. 保留 id/name、个人链、记忆、原岗位身份、既有材料与工程历史。当前有效岗位采用 actingRole || id；身份查询仍按原 id，不做全局盲替换。contentJob、健康与驻防资格另行分类。
2. 中继每个 requiredRole 得到明确 role→npcId 绑定，满足当前有效岗位与原有在营/存活条件，且不同岗位必须有不同 npcId。qm actingcarpenter 只能填 carpenter；quartermaster 仍缺岗，不能由其原 id 补足。
3. 同一绑定用于 legacy relayActiveParticipants/allPresent、材料责任人、opt-in staging snapshot、rest-work relay-duty owner 与 crew 展示。保持 opt-in 开关现状，不扩展 transaction 职责。
4. 缺岗或重复绑定时，在新增筹料与新增全局工程分钟之前阻断，记录具体缺岗和实际 holder。保留此前合法材料/分钟；不退款、不补资源、不回写旧事件、不虚报完工。反馈去重沿用现机制。
5. 保持原有 30 分钟材料额度、库存/有限地图来源和全局计时。重复对象不是双倍材料循环；修复目标是去掉缺岗资格，不是砍半速率。campWorkPulse 已按 actor 一次及有效岗位执行，不扣减历史脉冲。
6. 继任仍走真实死亡/缺岗/assignMorningSuccessors 路径。Object.keys 当次快照和何时补下一岗不在此偷偷改动。若指挥所纳入切片，按有效岗位展示真实 vacancy，否则明确留作后续。

验收以完整原生旧 writer 经真实 loader、真实死亡及真实继任；不手填 actingRole、不改 ID、不增减 roster、不补库存。验证 qm 暂代 carpenter 后 quartermaster vacancy 仍可见，三岗位不能由两人通过；缺岗的真实筹料/工程 consumer 不新增消费或 workMinutes，且已有进度和世界实体保留。再让规则允许的另一真实继任者补岗，验证恢复、保存/再次 Continue 幂等及 blocked/成功回执 actor/role 归属。原生 VM、浏览器、自然路线分报，保留方法错误。

六视角约束：

- 玩家：看到实际姓名、职责和缺岗原因；不将阿梁固定名字套到周岚产出上，不显示虚假三人就位。
- NPC：周岚只有一个当前工作职责；死亡、目睹冲击、培训和个人历史保留，不伪造健康/需要值取得资格。
- 营地：人手缺口真实阻断；库存、地图来源、材料收据、工程分钟和既有成本能对账。
- 势力：原身份不自动授权另一个当前岗位；不声称外交/派系已修复，不增势力收益。
- 敌人：敌人、种子、威胁和死亡后果保留；不清敌或保护角色。受控死亡不叫自然死亡。
- 全局：命令/Gate/consumer/展示使用同一岗位事实；旧存档、事件因果和回放保留事实。外部 AI 只能提议，不能写 GameState。

其余 npcHasRole caller（每日福利、医疗、战斗、计划/进化等）仍须逐一分类“身份还是当前能力”；完成本中继切片不代表全项目岗位排他性批准。
