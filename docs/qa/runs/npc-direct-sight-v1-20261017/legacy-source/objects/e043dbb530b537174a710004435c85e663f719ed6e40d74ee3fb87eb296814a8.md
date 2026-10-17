# 继任者同时被旧岗与新岗识别

状态：confirmed / open；本轮presence不修此独立岗位语义。

## 可重复反例

在候选HTML `9e4e43c881661a64edc352b0a07d627ed68087038202a3aaddf88ba450437ea0`，以完整真实writer夹具 `scripts/fixtures/npc-threat-attention-v1/browser-writer-day1-1110-save21.json`（SHA `5fdd18e8307d4109e671d7fb98298722611854fafb23c5b72a3491c1f1e32ee4`）执行实际loader/start。

离线QA依次调用真实 `markNpcDead(commander, {npcDeaths:0}, [])`、`assignMorningSuccessors()`，未伪造actingRole。实际继任者为sergeant、actingRole为commander；总roster10、存活9。

| 真实函数 | commander | sergeant旧岗位 |
| --- | --- | --- |
| `npcHasRole(successor, role)` | true | true |
| `npcFulfillsRole(successor, role)` | true | false |

这是source-VM反例，不是自然死亡或浏览器证据。现有完整presence检查通过不能关闭它。

## 影响与下一合同

旧helper采用身份或暂代岗位并集，另一个helper采用排他有效岗位；调用者对同一人有不同答案。可能产生双岗位协调/收益及错误参与者名单，但本次只复现资格矛盾，没有把所有下游收益量化为已发生。

下一切片先由剧本设计师明确有效岗位、永久身份、contentJob和继任缺口的语义，再统一实际consumer；保留姓名、个人链、历史功绩及已花资源，不用改身份ID解决岗位问题。分别检验中继/工作/治疗/计划、死亡与旧writer、已提交历史，以及人员不可用时的安全降级。

六视角：玩家应理解谁接替谁；NPC同一身份只承担被授权的职责；营地不能一人重复领取两岗收益；势力不能据旧头衔取得能力；敌人战斗/指挥加成有明确提供者；全局链沿相同有效岗位判断而非混用helper。与据点presence、critical健康政策分开验证，避免一个Gate代替全部资格。
