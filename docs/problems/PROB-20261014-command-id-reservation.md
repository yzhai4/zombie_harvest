# 显式canonical命令ID未预留自动编号水位

日期：2026-10-14。状态：**active，独审后已接开发dist faec；源码验收通过，公开browser待执行；服务器/Sites未改。**

## 复现与影响

冻结HTML SHA256为 `58a4bb28453429c73ad27baf22a377e3b7ff389b387a524196a06e490b0a65e1`。原CommandBus使用 `command.commandId || cmd-(++commandSeq)`；显式ID不改变commandSeq，却在进入reducer前加入seenCommands。commandSeq=0时dispatch显式cmd-000001，reducer再调用真实advance(20)，子命令自动分配cmd-000001，被当作duplicate，没有time.advanced。原修墙会扣料/体力、修HP和发standing而不推进时间；rich proof初版无条件读取不存在的advance.event还会抛TypeError。该问题同样影响其它nested advance及未来回放执行器，不能在维修动作中另建避让ID规则掩盖。

## 状态与幂等合同

- 统一CommandBus定义当前自动格式 `cmd-` + 正整数十进制，至少六位、较小数字左补0；只有formatter往返一致的正safe数字ID，在第一次dispatch进入reducer前把commandSeq预留到max(当前水位,该ID序号)。无前导零、形似正规长十进制输出但超safe的首次新ID明确拒绝，不能精度塌陷。
- duplicate显式ID按seen/replay保留的已执行历史提前返回，不执行reducer/事件/副作用，也不再次改变水位。非canonical的稳定外部字符串ID继续使用，不无故改名或抬高水位；包括cmd-1、cmd-000000、多补零等旧任意ID，前导零的非roundtrip长数字也保持opaque。此兼容边界不是把它们认证为canonical数字；旧已seen的unsafe字符串duplicate不重新解释或改档。
- automatic分配从安全有效水位递增，跳过当前seen/replay已占ID，保证父/子不同；仍由真实bus生成命令、事件和causation，普通未冲突auto路线保持原编号/账本。
- 验证拒绝和reducer拒绝沿用既有语义；已发出的显式canonical编号不能随后被自动分配。预condition拒绝未seen与reducer拒绝已seen分别记录，不把duplicate的ok:true当第二次业务成功。
- 超safe或耗尽自动编号返回明确Gate，不以浮点递增产生同号。MAX_SAFE水位不能再保证新automatic子命令；有限编号空间不是新事务系统，能力边界与fixture须公开，不声称已解决任意业务中途异常回滚。

SAVE21/CONTENT3保持，沿用commandSeq/seenCommands/replay/events，不增第二套ID计数器或人物flag。真实writer/loader保存预留水位和父子因果；旧非canonical外部ID与历史receipt保留，旧档不追溯补推进/奖励。运行事件500、writer保存最后300、world snapshot投影最后200，seen/replay窗口500；这些窗口不等于永久世界功绩账本。

## 六视角与范围

玩家一次合法动作只付一次成本且嵌套时间真实发生；NPC工作/用餐不会因ID碰撞被跳过或重复；营地库存/岗位/日界保持实际来源；势力不新增关系或交易收益；敌人仍消费真实世界推进；全局事件链只读唯一真实成功receipt。该修复不改变剧情、价格、战斗、NPC技能或终局规则。

## 验收与交接

保留完整58a4基线、独立候选、可移植源码checker、差异和manifest。真实完整inline VM覆盖canonical父→自动nested唯一ID及cause、普通auto不变、重复、两种拒绝、external ID、safe/坏canonical边界、seen/replay冲突、实际writer→loader→重复/下一自动命令。business reducer/advance/CommandBus/writer/loader不mock；DOM/storage/计时器为明确TEST-ONLY IO。

执行原177/48/69/43/27/16及必要语法/night/content/static smoke/replay goldens；既有误测如因诚实行为失败先说明，不能盲重基。CommandBus修复先冻结供根代理独审；后续 [修墙proof](PROB-20261014-repair-proof.md) 从同一修复字节建立独立第二切片，两份diff/报告/manifest不能混称已集成。

## 冻结候选与验证

状态仍为active：私有候选方法完成，根代理独审/集成/browser待执行。第一切片仅改变CommandBus对象，其余58a4字节精确相同；SAVE21/CONTENT3不变。

| 对象 | SHA256 |
| --- | --- |
| 候选HTML | `db945a2f63443d727e3060f0d1acc7ef6292852606e52d550c7036f1e83be45b` |
| 可移植 `check-command-id-reservation.mjs` | `b517fc569ea213029c876422d747c1923cb059a024fc54c3c9c86b1acb34c5c5` |
| 自测方法报告 | `46cf3f82c7fbbcb558425628e7142f06fa300cff3790d9357a66b393c48f688b` |
| 原回归更正汇总 | `b81c4b3376e167c5c189a89204a8fd95ca5a0d1f63a2d2b6c33e662d06a14140` |
| 84资产manifest | `4f2bc428da63352f797780d47525eff572ddb6f20b7e48080c117b53b2764acc` |

CLI：`node check-command-id-reservation.mjs --html ABS_HTML --io-adapter ABS_RECOVERY_CHECKER --out NEW_REPORT [--mode baseline|candidate]`。显式输入/输出可搬移，报告绑定runtime、checker和完整IO-adapter SHA；内存DOM/storage/timers及诊断reducer均标TEST-ONLY，真实bus、advance、repair、writer/loader未替换。

基线五类漏洞真实复现；新自测28项及独立完整inline VM28项通过。原177/48/69/43/27/16共380项全部exit0；content源码golden c5d6c772与已有兼容断言e14e0776、plan-day66c9368d保持。replay self-test用原脚本不变字节私有副本执行，9夹具/4aec7a31通过，避免原selfTest写仓库夹具；它是保存投影自测，不是候选运行时模拟。原night/content/inline检查与明确禁止浏览器的static smoke55通过。

保留三类初次方法包装失败：新baseline harness曾把runtime state误当SAVE payload；原回归汇总48/69期望数笔误；私有validator打包漏01–09文档。均另写更正报告，原日志/报告保留；未改业务源码、旧assert或golden来得绿。候选目录真实Windows ACL保护，manifest逐字节核验。

MAX-safe后auto明确拒绝；不声称未知nested业务已具全局回滚。新repair支付前调用同一 `CommandBus.nextAutomaticId` 作纯预算Gate，不预留第二套子ID。旧历史不补成本、推进或奖励；本轮无浏览器/发布/完整NPC交付结论。新增项目问题记录，无新增全局记忆。

负责人集成与真实repo路径再验：28新编号、41维修及原177/48/69/43/27/16全过；两切片逐一逆向撤销后完整字节等于58a4。当前开发faec，CI65仅覆盖旧58a4，详见 [集成记录](../qa/command-repair-integration-20261014.md)。以上私有开发状态为历史时点。
