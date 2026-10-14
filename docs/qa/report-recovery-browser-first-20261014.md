# 报告恢复首轮浏览器：独立原工件审计

**结论：FAILED，不能发布。** 原runner真实terminal exit1；47/47场景完成，1475项actual checks中1463通过、12失败，36场景passed/11 failed，notRun为空。首轮原失败不改，下一候选/runner另运行并另记报告。

**运行时：** `291a75441548e25801c4140d2b6e26dea1f5c1d938de7b408d9c4fb972bfe893`。源/fixture/observer为明确新ephemeral browser fixture模式，不是自然三日路线；current-writer首开及B15公开实战单列。冻结runner SHA见 [独立runner审查](report-recovery-full-runner-review-20261014.md)。

**原报告：** `/home/ubuntu/.cache/zfarm-qa/recovery-291a/browser/run-20261014T202704Z-a1f47969/report.json`；SHA256=`e5caf27e869bb7e25f5b740506ba069ab11d4658d033cb118cea3874e74ceb80`，elapsed586.398秒。根执行者提供SSH15776 exit1；独立SSH ps未发现Python PID145033。读取terminal原报告并在原服务器工件上只读审计，无改profile、runtime、报告或截图。

## 完整性核验

13项独立证据完整性检查均通过，**不是游戏通过**：全部case count/status与实际checks一致、coverage布尔与原cases一致；328份原观察均与实际rawStorage匹配、metadata checksum一致，328个声明截图都有真实PNG字节与尺寸。273份被runner接受的实际SAVE21均FNV/world/date/schema一致；其余55份是明确无保存、旧初始输入或损坏诊断，不伪造payload或把它们当合法输出。

7份原source bytes逐文件SHA/FNV与来源metadata一致，46份before-loader派生input的FNV声明均正确（包括明确坏JSON/FNV/数组输入）。DAY21原出处另独立核baseline2原reportSHA871b97d3…、8a4 served-source metadata及公开baseline check，原DAY envelope与输入ec20cf74…语义全等；resolved/closed源对应已审旧MAIN snapshot43/44，metadata明确8a4。四SAVE18原工件仍固定原SHA/FNV和真实公开capture出处。

pageErrors/httpErrors/consoleErrors/requestFailures均为空。此新轮没有资源错误，不改写旧MAIN的9条未知404来源。report.ok=false、releaseCoverageComplete=false仍原样；没有把审计检查通过提升为浏览器通过。

完整私有输出 `C:/Users/DELL/.cache/zfarm-report-recovery-review/first-terminal-independent-audit.json`，SHA256=`735483fc4e3dff2ba0a16d3ad8ff331fa17a7a2b48e9756e5542861a1394d570`；含所有328观察与PNG的SHA、原source/inputs及准确失败表。关键事实独立输出 `first-terminal-critical-independent.json`，SHA256=`8259cabf53a2f57a870a9c4e6bd385430c9a9639835a03074ddf940c87aefa74`，16项具体恢复/迁移事实复核通过；只证明列出的事实，不取代失败总体结论。

## 12个原失败的归因

| 原失败数 | 位置 | 已读原保存/截图的具体原因 |
| --- | --- | --- |
| 1 | B2 | runner未声明已批准resolved-night-flag的一次准确迁移，禁止所有新事实；原只有一条精确migration，无结算或资源新事实 |
| 4 | B5/B6 | 初次启动真实notice可见；断言在flush换成新菜单document后查notice，生命周期错位 |
| 2 | B7 | battle删除数字但原receipt仍记录kill4/breach2/damage0，正确回填被错误要求全未记录 |
| 1 | B9 | 离线fixture把battle.damage改100但原receipt仍0；失守可确认而身份冲突，migration.instanceId真实null，不能猜ID |
| 3 | B13 | 断言要求全部旧300事件永存；实际writer追加唯一migration后正常保留严格299原tail，见下文 |
| 1 | B16 | 首轮headless focus切换未产生真实visibility事件，detail=[]；不能称真实隐藏验收通过 |

更完整的逐文件after-start/flush归因及截图见 [runner审查的原件归因](report-recovery-full-runner-review-20261014.md)。修正下一runner时须收紧准确预期、保留原失败，不能通过忽略未知事实/任意缺事件让它通过。

另有首轮断言未捕获的**真实运行时UI遗漏**：截图126的waveDefense为0，但其原保存明确74；supportIds缺失时waveSupport也残留模板0。已交唯一实现者，仅新412c私有候选补纯保存projection/render，177源码检查及独立原输入渲染通过，尚未新browser。详情见 [候选评审](report-recovery-candidate-review-20261014.md)。因此即使修正首轮断言，也不能把旧291a称完整通过。

## B11、B13、B15与四真实18

B11截图180明确提示第1天06:10安全备份，当前未结算主档第3天00:34不能直接继续；公开选择后实际保存migration原checksum c0ad8582/selected93cc9e89、rollback=true。独立immediate原回读核资源、全NPC旧字段、完整contentState/计划、world、quests、player、replay与原ledger来自同一完整备份，原bak字节在安装时保持。此轮没有browser写失败retry，170项源码对应失败/重试证据分别记录。

B13三份原immediate恢复均严格保留原ledger尾部1367..1665；原选择窗口1366..1665共300条，新增唯一seq1666 save.migrated后writer slice(-300)成为1367..1666。没有其它新事实，完整NPC字段、其它持久域、contentState/replay语义全等。下一验证器须比较“原窗口加唯一正确迁移后的严格300尾部”，并另核因果/seq，不能宽松接受 arbitrary missing/reordering。

B15真实HP1 DAY派生场景经公开开始遭遇自然触发失守，没有隐藏resolve/攻击或运行中改save。native timeout498、delay650、stack为resolveNight→requestCheckpoint，在1792010098488排队；trusted公开重开于435ms，440ms真实clear一次，无fired。旧key在立即、超过650ms及两个tick、两次reload均缺失，截图260是实际“暂无存档/开始新游戏”菜单，再公开新局固定十人、无旧遭遇。可以支持这一次实测退出竞态；不是把普通resolved reset当排队证据。

四真实SAVE18 DAY/resolved/closed/INITIAL分别23/27/23/24项原browser checks通过；独立逐键核各immediate旧持久域和全NPC字段保持、新content CP0/max0/原grantedDay/idle无候选无推广history、L0三起始hero和七locked正确，仅一条migration，两次reload仍1。INITIAL原8774420e的已证world0→360修正保持day1 06:00，实际correction/reason可读，没有time.advanced或新奖励；三个其它原FnV926f908a/4a12d242/f1db7a05保持来源。截图294是原resolved报告；307是day1 06:00实际初始营地。这组结果不替首轮整体失败解禁。

## B16准确范围

报告在23:59等两个tick和headless focus切换仍冻结，但visibility事件为空，背景/恢复分支实际覆盖失败。不得将此改称隐藏通过，也不能把2800ms写成真实>=60秒wall-clock catch-up。下一轮需实际产生并读取hidden与visible，可用独立headed/Xvfb browser；不要改GameState、时钟或忽略失败。

重复close只有一条evt1667/cmd1610，world4319/day3 23:59；SAN补偿仅evt1666，同tick且causation为cmd1610，50→53。第二click产生拒绝收据，不再补偿。close后截图272显示day4 00:00；同次原保存尚day3 23:59，是650ms checkpoint尚未写新的自然tick，不能拿截图替保存日期。后续实际reload-save275为day4 00:01，SAN53、food4，明确有4320/4321 time.advanced及一次plan.meeting.resolved/CP日界刷新；正常日界变化不当作重复close。

**出口：** 保留首轮failed原件；严格修正runner预期/补B1四按钮公开操作与known/missing报告值，使用新412c候选运行新矩阵，并实际完成B16生命周期。只有新terminal完整原报告通过及独立复核后再讨论发布。本审计没有发布、修改原失败或更新全局记忆。
