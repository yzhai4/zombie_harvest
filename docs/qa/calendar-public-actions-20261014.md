# 三日日历公开行动验收（原存档恢复完成）

**状态：** validated（多次恢复后的公开行动路线）；新的单构建从头连续运行仍待执行。  
**当前测试构建：** HTML SHA256 `8a4abf285651e5ee78905da2b819648aa1ef862e580e8b4710e8c71079604ba0`，SAVE21 / CONTENT3。  
**范围：** [calendar-settlement-001](../scripts/calendar-settlement-001.md)，不表示自然三日或游戏平衡通过。

## 已确认的证据

- 真实源码：plan/day/report-close 27项（hash `66c9368d`）、camp-area 16项、content-chain 43项（hash `c5d6c772`）通过；保存投影9夹具 hash `4aec7a31`。非UI依赖及checkpoint调度有明确 instrumentation，未声称 headless 全局模拟。
- 同一当前构建的[显式 boot-save 夹具26项](server-content-chain-calendar-20261014.json)通过；包含非零已花 CP 在启动和再次 reload 后仍显示 `0/2`，与低信任新局分开。
- [独立新局基础浏览器27项](server-playtest-calendar-20261014.json)通过；公开 reset、WASD 到树、wood24→28、正 resource.collected 收据和对应 command、FNV 校验；建造面板、夜战总结、原日期关闭与刷新继续均通过。该建造检查仅选墙，未声称实际消耗材料建成。
- Node smoke wrapper 已实际启动共享 Python 浏览器；转发15秒心跳，父端30秒轮询；attempt3异常准确使 wrapper exit1，未把59个已通过局部检查当成整轮成功。
- Sites 另行确认 public/active，并通过真实浏览器进入地图，见 [公开访问复核](sites-public-access-20261014.md)；本页测试目标为服务器构建，不将 Sites v81 与测试分支混同。

独立 [artifact 核验器](../../scripts/verify-three-days-artifacts.mjs) 对 attempt7 原始证据完成前缀核验：53项中48项通过、5项尚未完成；39份保存的 FNV、schema 等检查通过。day2/day3 的计划权威终态、日界账本和精确食物均通过：两次配给都是3，分别为14→11、10→7，没有以资源归零 clamp 掩盖重复扣除；night1/night2 的遭遇因果也通过。此结果只证明已取得的前缀，仍缺 day4、night3、真实收获和最终快照，不能作为最终三日 Gate 通过。

独立前缀核验的机器输出见 [attempt7 artifact Gate 报告](three-days-artifact-gate-attempt7-20261014.json)，`ok=false` 和未完成检查均保留，原报告 SHA256 可用于对账。

## 保留的失败与恢复

1. [attempt1](three-days-attempt1-20261014.json)：供给零分钟选择后的 same-minute 旧存档误判。以具体新收据/命令/库存修正，从原 profile 恢复。
2. [attempt2](three-days-attempt2-20261014.json)：真实 day1 报告已经关闭，但旧 `threat.closed` payload 没有 threatId，导致新因果等待失败。补 wrapper resolved Gate 与收据；旧完成只用相同 replay commandId 的 threatId 恢复。原构建为 `deaea918...`，不推定全流程单构建通过。
3. [attempt3](three-days-attempt3-20261014.json)：真实恢复 day1 start125→resolved131→close134，随后训练至18:20；导航被邻近 hunt 状态 `wz-4` 阻挡。主存档观察玩家(9.2,11.8)、敌人(9.2953,12.0899)、敌HP100、玩家HP100。公开回归应处理真实近敌，而非注入位置/删敌或仅改 waypoint；后续通过公共攻击并核对真实损伤。
4. [attempt4](three-days-attempt4-20261014.json)：两次公开攻击已分别产生实际损伤、体力消耗和时间变化并杀死阻挡者，但两次保存等待耗尽共享30秒导航预算。修正为每次已核验攻击后重新计30秒移动预算，仍受整体预算与每 waypoint 最多4次攻击限制；不重打已死敌人、不改变时钟或碰撞。
5. [attempt5](three-days-attempt5-20261014.json)：实际 day2 日界、配给/权威计划/点数和人口检查全部通过，随后刷新前的保存同步等待超时。只读复核实际 world 正常推进、paused=false；自然 tick 保存每约12秒一次，保存与 DOM 完全同分钟的窗口不足1秒，随后通常相差1–10分钟。后续同步保留最小日期/seq/特定收据，最多接纳已记录的1分钟 DOM lag，而非把任意旧档视为最新。该失败不证明游戏日结算或世界钟失效。
6. [attempt6](three-days-attempt6-20261014.json.gz)：真实第二场遭遇、day2晚餐和训练完成，自然钟在临界保存等待中越过午夜。runner错误把已day3 00:12/seq1633保存标作day3边界“before”，因没有训练跨日而失败。保留该实际文件；恢复只能明确引用既有day2原始保存（index34，20:36/seq1479，账本窗口仍完整）并核对day3真实after。自然tick跨日也是合法证据，不重造前态、不倒退或注入存档；独立artifact Gate需验证明确引用、前一夜计划和精确资源/日结算关联。
7. [attempt7（public-sanitized）](three-days-attempt7-20261014.json.gz)：同一持久 profile 恢复后的报告有210项检查，209项通过、1项失败，仍为 `ok=false`。day3 日界核验正确引用既有 index34 保存作前态，计划权威终态、账本和食物核账均通过；该引用没有把旧快照注回游戏。刷新后的实际日历分钟从2902推进到2903，被“刷新前后严格相等”断言误判为失败。保留原失败，不把它改写为通过；测试恢复规则正在修正，最终三日结果尚未确认。

attempt6/7 的完整脱敏 JSON 以 `.json.gz` 压缩保存，解压后字节与本机脱敏副本一致；原始失败报告在本机私有 QA 目录保留；此处副本仅移除主机临时路径，并保留原报告 SHA256。旧阶段快照不注回游戏。基础 runner 另曾遇到渲染替换 marker 后 DOM 节点脱离，已改同步 DOM 读取与异常失败报告；该故障属于测试工具读取，不冒称游戏采集失败。

## 最终必须成立

attempt8 增补：[保留的失败报告](three-days-attempt8-20261014.json.gz)与[独立前缀 Gate](three-days-artifact-gate-attempt8-20261014.json)。三次实际日界、三场遭遇及真实收获均已取得，57份保存核验通过，Gate69/71；原runner仍exit1、最终清晨保存尚缺。day4训练已在真实主档写入evt-002562/cmd-002319（4356→4386，30分钟），末段同步等待超时不是“未训练”的证明；4355/seq2549仅水印，恢复不得重造该状态。下一恢复绑定既有原snapshot56和完整命令/自然tick链，避免重新训练或漏记实际动作。

实际 day2/3/4 日界；各日一场公开遭遇；固定十人 IDs、活动人口≥3、HP>0/collapse<90；真实播种与收获；配给/NPC取食/计划效果核账；计划权威终态、每日 CP、不重复 upkeep；刷新后新自然时钟存档证明去重；day4 清晨再次继续。最终报告、关键快照、截图、实际源码 hash 与恢复会话均需回填。

重复训练真实提高 SAN/士气，临近敌人的反击会损耗 HP/体力并推进时钟。这条路线不证明平衡难度、自动夜夜尸潮、NPC 晋升/死亡继任、据点维护、水车生产或14天终局。

## attempt9：终止后的最终结果

原 profile 的最后恢复进程正常退出0，runner记录439项当前检查全部通过、无当前错误；八次原失败保留在原件及恢复历史。最后一段使用 runner SHA256 `becef233cf47a89e657ea9673409d5739188f3ae2de3beeca7cb47415e220a7e`，HTML保持上述8a4冻结构建。

最后保存为第4天06:36，food6、固定十人、checksum `a0c68982`、eventSeq2746；截图拍摄时正常钟已到06:37。实际日界2/3/4、遭遇1/2/3和真实收获完成，最终reload后的具体自然tick、已花点数、计划/配给/upkeep去重检查均通过。独立artifact Gate90/90，核验76份原始保存与连续2746条可见唯一事件；92次30分钟训练收据与92次报告动作一致，2次白天攻击、3次正采集及2次作物变化分别有具体命令。

attempt8已经发生的 `evt-002562/cmd-002319` 通过完整自然tick与区域收据恢复，只计一次，没有再次点击。原snapshot56保存分钟实查为4345（第4天00:25），之后11分钟自然推进至receipt.before4356，再训练30分钟至4386；4355仍只作为失败checkpoint水印，未重造为保存。详见[独立最终复核](three-days-recovered-20261014.md)。

完整脱敏输出：[最终runner](three-days-attempt9-20261014.json.gz)、[最终artifact Gate](three-days-artifact-gate-attempt9-20261014.json)。这些公开文件只作报告，临时工件路径已移除；核验器实际读取私有完整原件。最终raw report SHA256 `62ad36b2c7add9d2e36148655cd1755de25c42563e7861e66dce887bcc2ab564`。终止后另导出76保存/24截图，完整原报告字节保持，manifest SHA256 `686834bf3cebcdce75f190ba5e32a24f81ec8cc5838690e0184040218641f891`，导出工具本身不声明游戏通过。

覆盖限制仍成立：早期10份快照没有源码hash，历史第2天显式reload缺失，恢复跨越旧构建与多次启动。这是恢复后的完整日历路线通过，不能写成单一已知构建的连续三日通过。下一冻结报告修复构建需要独立从头运行，补齐各日刷新；非零CP和报告兼容继续用另列夹具核验。
