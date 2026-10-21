# 报告恢复 full browser runner 独立审查

**状态：** 首轮运行中，未给浏览器通过或发布意见。根执行者启动首轮PID145033/session15776，发现的问题保留原结果，原运行文件不热换。本文先评审断言与覆盖；terminal之后另核原报告、保存和关键截图。

**被测运行时：** HTML SHA256=`291a75441548e25801c4140d2b6e26dea1f5c1d938de7b408d9c4fb972bfe893`。独立loopback `127.0.0.1:8783`，public80与Sites v81不在本次运行修改范围。

**冻结首轮runner：** 本机私有 `C:/Users/DELL/.cache/zfarm-private-evidence-20261014/recovery-291a/runner/`；服务器独立目录 `/home/ubuntu/zfarm-qa/report-recovery-291a/runner/`。分别读取SHA与SSH只读sha256sum一致：

| 文件 | SHA256 |
| --- | --- |
| server-report-recovery.py | `0c6ff72bba1772b90e72ad68e1c5a0f1aeea9bf091c98eab01858302253a7af8` |
| report_recovery_full.py | `ad3292f5ddad688cbf9e853563e3706e8cd5459d66e23e74d97f63cb9f1afa64` |
| report_recovery_fixtures.py | `ed6191649b0ca2dc7b2ff70cd0f2c04be2d49c47b5e78ac6d7879245f975160b` |

## 已确认的方法边界

- 每场景使用新ephemeral context，只在loader之前一次初始化storage并以window.name标记避免reload重种。输入/派生变更写独立input.json；没有运行中改GameState/保存或调用隐藏游戏函数。
- Timer observer调用原native timeout/interval/clear，记录具体ID、generation、时间和requestCheckpoint stack；Math.random observer委托原方法。它们是已声明观测instrumentation，不能替代seeded RNG/内部数组pure projector的源码证据。
- 每个文档响应原body SHA必须与固定291a相等。原source21三份archive另按8a4 writer及完整工件SHA锚定；四source18输入有真实公开capture provenance、旧writer SHA及原FNV，原bytes复制保存。
- 错JSON、数组envelope、无SAVE_KEY等仍保存实际rawStorage/DOM/validationError；无合法envelope时不创造payload。截图失败注册diagnostic并抛异常，不把缺截图算通过。失败actualChecks进入errors，expectedDefect标签不抵消错误。
- 资源错误保留确切URL/status/type及console.location；仅已定位/favicon.ico另列diagnostic。泛404不会静默归favicon，首轮历史MAIN的9条未知404仍保持未知。

## 首轮具体缺口

### B1：白天按钮回归尚未实际断言

首轮close()核对unique close/replay、准确原tick、SAN补偿及两次reload，但没有核对关闭后gather/build/crop/endDay四按钮enabled。READ_PUBLIC还漏cropBtn。即使本次291a源码实际HUD已独立验证修复，首轮不能声称该UI回归已浏览器通过。下一runner应采集四按钮，close后统一assert可用，并经可逆公开控件行动证明恢复可操作（例如打开/关闭建造面板），不调用内部函数。

### B7：已有收据的统计不应被要求未记录

首轮派生输入只删除nightBattle.kills/breaches/finalDamage/wallDamage/npcDeaths等；原同实例threat.resolved receipt仍记录kills/breaches/damage。运行时纯投影允许回填该真实receipt，首轮report_checks却要求五项全未记录，将把正确回填记为失败。

下一runner应分别验证“battle缺项但receipt仍在→显示已有receipt”以及“battle与receipt的该展示项都缺→未记录”。若离线删除receipt展示数字，须明确记录派生变更，保留threatId、seq/tick、start/close因果。首轮的错误actualChecks不得删除或改ok。

## B11 / B15 / B16 / 真实18审读

**B11及B13：** 公开restore前显示安全备份具体日期；成功后先捕获immediate真实主档回读，对比protection与complete original persistent fields，含原NPC逐键、world/quests/replay及原ledger，不从坏主档混资源/日期。save.migrated核对original/selected checksum/date、rollback和sourceCategory，实际保存FNV经read()验证，再做两次公开reload。首轮没有browser storage写失败retry；已有170项source测试的对应失败/重试范围应列为sourceOnly，不称browser通过。

**B15：** 有普通resolved公开reset和独立HP1 DAY派生场景。后者移除建筑/支援后公开进入真实战斗，不攻击/调用隐藏resolve；loss summary出现后实际查询native requestCheckpoint650 pending，检查同generation/ID仍pending、trusted restart click早于650且此前没有fired。随后实际reload，全部旧key立即/2800ms后/两次reload缺失，再公开新局验证固定十人及无旧遭遇。只有这一真实pending证据才能支持竞态，不把普通resolved reset代称queued race。观察耗时miss650会明确失败，不补造队列。

**B16：** 23:59报告夹具、重复DOM控件start/close/reset、按住w/e、新tab bringToFront真实hidden/visible均声明。只有实际visibility事件同时包含hidden与visible才通过，不能凭调用bringToFront推断。真实hidden约2800ms，证明报告无两个模拟tick；不能称已触发真实wall-clock>=60秒floor(elapsed/60000) catch-up路径。长elapsed目前属于源码controlled Date证据。关闭后发生的自然跨午夜应按准确close tick、后续time.advanced及日界配给/计划收据核，不把合法DAY变化误判重复close；exact SAN只在同分钟比较。

**四真实SAVE18：** DAY/resolved/closed/INITIAL首轮均要求原公开capture出处和FNV，完整旧字段逐键保持，新content CP0/max0/原grantedDay/idle无候选或推广history；L0三起始hero与七ordinary/locked正确。INITIAL仅已证day1 06:00/空水位的world0→360，迁移reason/correction和日历保持；两次reload仅一条migration且不重造start/resolved/close/plan。

## 成功条件与披露

首轮顶部ok依赖run completed及无errors/pageErrors/httpErrors/requestFailures/非favicon console错误，没有直接AND releaseCoverageComplete/notRunCases。当前启动参数require-production18及固定47场景降低漏覆盖风险，但下一runner可显式将完整非空矩阵、全部actual case passed、四真实18required、notRunCases为空联入full成功条件，避免未来改矩阵时产生虚假full成功。

B5首轮browser有精确旧id/start引用正例和错seq/无引用降级；同分钟多候选是当前源码负控范围，不代称browser。计划提交/内部pure report及seeded RNG、写/删storage失败、stale generation回调也分别记录source范围。

当前结论只是runner预审；首轮必须保持原失败/异常/未完成状态，再将下一runner修正与下一份新报告分开。本文未修改runner、runtime、profile或原报告，无全局记忆更新。
