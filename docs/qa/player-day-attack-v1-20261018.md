# DAY玩家攻击：公开资格、同目标结算与保存

状态：本页列明的开发切片已实际验证；开发分支最新head的精确CI见[PR #4 Checks](https://github.com/yzhai4/zombie_harvest/pull/4/checks)，生产未部署。源码对象`bbba03a6f521a1e5fb24be0ab9f24ddc20f12937`、tree `c7b80870683c7cbb752b5679e0f231b1987cdfe2`，HTML `3545adb19fc8e75256013a50ce9885e051aa4170757a0c33095cc682cfcb7aa1`／926318B，SAVE21／CONTENT3。源码与开发ref、生产部署分别记录；173项scripts／dist／workflow依赖已与Git源码树逐blob匹配。

## 玩家变化

DAY攻击保留1.15命中半径、gross5E、原武器伤害及真实`advance(10)`调用。附近1.25范围仍可见威胁，但外侧攻击disabled且按钮外显示“再靠近目标后攻击”。渲染按钮绑定实际敌ID，提交前重核唯一live目标；A失效不会改打B。F／空格保原锁定优先、否则当前合格集合首项，不改最近排序或自动靠近。失败typed拒绝，不扣本次费用、不命中、不推进、不发空成功；重复命令仍先于新目标资格判定。

成功proof分开支付前后、立即命中、推进后目标与真实父子命令。暂停仍保原即时命中／付费但推进0分钟；非暂停时拒绝会产生不可保存日历的本次推进。原`b548`在rate .25实际付78→73、命中100→50、推进360→362.5并返回成功，保存函数也返回true，但新保存被实际validator以`calendar`拒绝，不能作为可恢复的新进度。最终候选在支付／伤害前拒绝这类2.5分钟结算；rate .5／.8实际5／8分钟与paused0分钟另有正控。没有全局改时钟、补偿旧损失或修复任意旧坏档。

## 实际验证与原失败

所有下列当前通过均绑定3545，不移用旧构建绿色。原生报告及实际终态由[选中证据索引](runs/player-day-attack-v1-20261018/selected/index.json)定位；[当前manifest](iteration-manifest-v1.json)绑定源码与原报告。

安装后的原证据Gate实际17／17、方法self-test76／76均exit0，HTML与manifest在执行中未漂移。本地没有.git，ancestry核验为unavailable，与Git API173项源码对应分列；开发head的实际Git ancestry继续由精确CI核验。安装器首次误读manifest字段的预检失败未写入ROOT，修正后才安装和执行Gate；不把预检当游戏或Gate失败，也不改旧报告。

| 原件 | 实际结果与范围 | 原report SHA256 |
|---|---|---|
| `source-existing-02/closure.json` | 既有闭包16条执行均terminal0、无输入漂移；语法／静态与真实source方法分别保原范围，不称完整43／44矩阵重跑 | `7e92529d1729a48e73f7f8a532f5159ce535e2d42e909e1c7fb510576ccc96f9` |
| `candidate-v3-execution03/report.json` | 新source checker一个合同、5／5组exit0；范围／绑定失效／真实成本推进／幂等保存／公开输入及昼夜隔离 | `ccb79aaa745fefbc56388de513f6909d8d3ef0e7d6b5d7de2938e8826439b6b2` |
| `browser-candidate-v3-execution01/business/report.json` | Chrome155，三受控scene、26／26、exit0、errors[]、全部清理true；四次main响应均3545 | `1c72932b9e240e523dcc994ecac6c36b0c474dd9f45b1eae5947197c8c2143d5` |
| `episode-browser-01/report.json` | 既有episode Chrome12／12、exit0；两次main响应均3545，非新增自然路线 | `5e5bf13a65d10e2cdfb0cbc0b3cadd339d4cf11d7a89204ca461c9b1db98a471` |

旧54ef同方法公共consumer负控为0／1、exit1：1.19处按钮enabled，真实wrapper返回成功并发`threat.attacked payload:{}`，没有命中或时间推进；不再只称静态风险，也没有把缺新helper算反例。原report `143b74555cbfa36c8dd16ae3328e16c35a1fac466be347c90f18ba48a81b47b3`。b548倍率诊断原report `9d5ed20722b9f1fe904078a4c819c9014aae538ded918e1d1cafd2cb0ac5e794`保留，诊断进程exit0只表示观察完成，不是产品通过。

新checker首轮因跨VM数组原型比较停在方法预检，第二轮4／5因把显式`undefined`误当无目标`null`；原终态／执行字节与report `9acac919…`保持失败。只修这两个方法错误后另有完整5／5，不改reason白名单、业务断言或原报告。`source-existing-01`绑定更早b548，保其来源；不转写为3545。既有26条daytime-combat内部检查没有直接覆盖玩家攻击，不拿它替代本轮新合同。

## 这次F的真实后果

Chrome母本是旧v5正常writer `1da81877…`，08:40／seq207，不是较晚08:42现场。只有原wz-4几何作TEST-ONLY派生，保原HP86／E73、资源、10NPC和四存活敌集合；boot前装完整native一次，之后无运行中state／storage注入、隐藏业务、force或暂停取证。outer桌面与390各独立context实测距离`1.1899999999999995`，disabled及粗原因实际可见，没有提交F。

inner只按一次公开F：父`cmd-000828`／成功`evt-000217`均player-1、同目标wz-4。gross支付73→68，rustAxe立即100→50。子`cmd-000829`／`evt-000215`关联父号，world520→530。真实推进中guardChen／guardJi／guardJiang／sergeant分别再伤7／9／11／11，目标50→12；不能把最终88点HP差全算玩家伤害。敌人真实DAY伤害6使玩家86→80，随后原非致命反咬8降到72；这不是无伤或安全保证。

reload前已取得正常writer `b464332e…`，08:50／seq217、reason=`command:threat.attack`。reload即时boot水位为08:52／seq219，之后首个新tick为seq220／minute533；正常writer `a6a5d969…`最终09:02／seq243、HP66／E69，同一F父命令和成功event仍各一次。没有把较晚live值拼回旧writer，继续受伤也不被抹掉。

## 边界与下一步

本Chrome证明外侧反馈、内侧一次实际F和正常保存／Continue后新tick；低E、失效目标、编号耗尽、倍率／暂停、DAY与NIGHT隔离属于对应source证据，不由26检查数扩成浏览器覆盖。未运行自然三日、真人理解／乐趣、食物因果或完整中继上线／刷新。旧nightAttack独立规则、全局CombatIntent／actor授权和命中后的旧奖励顺序不宣称全面审计。

下一先闭合[中继当前能力与损毁修复](../problems/PROB-20261018-relay-station-operational-state.md)，再恢复有限预算公开完整中继后半段。站点HP0能力问题未由本片修复；旧公开主线仍仅到交付及真实2木／2零件、未F续段／未online／未完工后reload，不被本受控攻击fixture提升。完整Actor／Planning／Memory／Social、跨副本连续性、Scenario Studio、大世界／UI素材和GameCore／引擎目标继续开放，不把全部A／B／C实验设为下一消费者前置。
