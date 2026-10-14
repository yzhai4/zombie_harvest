# 计划会权限与同日实例完整性

状态：**私有最小规则候选与独立 UI 候选已完成源码回归，尚未集成或进行本主题浏览器验收**。日期：2026-10-14。

这是完整 v82 前置 bugfix。十名个人链、主动技能、有效票投影、MeetingV2 及新权重仍未实现于本候选。

## 依据与可复现缺陷

规则真相 [07 计划会与 commandPoints](../../剧本/尸潮农场/07_计划会与commandPoints.md)的「权限阶梯／权限精确定义」把计划干预放在 trust≥60；「每日流程／可观察契约」要求一次选择、确定性结果和不可重复结算。[身份与实例版本 ADR](../decisions/ADR-20261014-plan-voter-meeting-version.md)仍是 proposed，其中 D2–D8 新数值／MeetingV2 未由本卡采纳。

以实际完整冻结 HTML `412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8` 执行源码，观察到两个缺陷：

1. `commitPlanMeeting` 只检查 CP，不检查计划权限。显式 trust20／CP2 夹具经真实 CommandBus 的 support、deny、modify 均成功，CP 变为1、会议 committed 并留下成功回执。拥有普通岗位点数不意味着可以改变营地计划。
2. `generatePlanMeeting` 只对未 force 的同日 candidate 去重。同日 committed 可被普通 SUMMARY 生成清除 `playerAction`／选择，回到 candidate 后再提交并花第二点；force 也能重建同日 candidate。刷新或额外遭遇不能洗掉原计划。

这些是完整 inline VM 的实际命令证据，**不是本主题已浏览器复现的宣称**。原冻结源码的负控报告保留 exit1：48 项中19通过、29失败。

## 最小修改与状态合同

仅改私有完整 HTML 中两行；仓库 dist、版本、旧权重、评分、schema、服务器与 Sites 不变。

| 函数／入口 | 候选合同 |
| --- | --- |
| `commitPlanMeeting`（原约2252行） | 保留 session／night／当前日 candidate Gate；在扣 CP 前读取已正常化的 `contentState.meters.campTrust`，小于60返回 `camp-trust-low`。support／deny／modify 使用同一 Gate |
| 拒绝的 CommandBus | 可以记录真实 `command.rejected`、输入 replay 与命令水印；不能留下 `plan.meeting.committed`，也不能改变会议、CP、资源、NPC、world 或 RNG。不能将“整个账本不变”当作拒绝合同 |
| `generatePlanMeeting`（原2236行） | `meetingDay===state.day && status!=='idle'` 一律返回现有 plan／duplicate，包含 force；不重选候选、不清 playerAction、不再生成候选回执 |
| 成功提交 | trust≥60、CP≥1、合法动作／候选、DAY 可输入且当前日 candidate 才扣1点并 committed；第二次干预以不同实际命令ID拒绝，保持选择和已花 CP |
| 次日 | 实际日界依照现有 `runPlanMeetingDayStart`／`executePlanMeeting` 结算一次；首次为新的 `state.day` 生成会议仍允许，保留 prior history；同一天再次 force 仍冻结 |
| fallback | 当前合法 schema 是 `status='resolved'`，`autonomyResult.route='fallback'`，没有新增 `status='fallback'` |

trust Gate 直接读取已经正常化的 meter。不能在持有 plan 引用后调用会再 normalise／替换 contentState 的 helper，从而重新引入旧对象写入丢失。

合法 SAVE21 的 resolved 必须 `resolvedDay>meetingDay`。正常日界后原 resolved 的 meetingDay 是前一天，因此新日首次会议必须允许。测试中「同 current day resolved／fallback」是从实际源码次日结算派生的**显式 TEST-ONLY 临时防御输入**，只改对应日期别名验证冻结，未写入／加载，不冒称合法旧存档。

本候选保持现有 SUMMARY D 生成、真实 D→D+1 结算时序；不解决07中“次日白天／当日队列”的既有文字歧义，不采用新的时序政策。`force` 原有窗口语义也不在本题扩展。

## 旧存档与幂等

SAVE21／CONTENT3 和会议 version1 保持。合法旧长官3票、军士2票、原 ballot／score／排名、选案、playerAction、已花CP、效果及 history 不追溯改写。

测试使用原冻结源码自身的实际 CommandBus 在 trust20 提交，再用原 `saveProgress` writer 取得完整合法 TEST-ONLY 旧 committed envelope，FNV `707889bd`。不是手造 command／成功事件，也不是自然游玩档。候选 loader 原样启动后保留 committed／CP1／同一实例，不补点、不产生迁移或奖励；force 不重新开会，次日仍按已合法存下的选择结算一次。新 Gate 只阻止新的非法干预，不撤销历史已承诺计划。

同日冻结不删除成功／失败效果账本。既有 effectId、history 和恢复因果继续由现有结算器承担；本题不另造事件系统、回执结构或迁移补偿。

## 六视角合理性

| 视角 | 本切片的因果与边界 |
| --- | --- |
| 玩家 | 普通岗位 CP 不越权为计划干预；已明确作出的选择不被额外总结或刷新抹掉，不能二次扣点 |
| NPC | 保存投票和选案保持；同日晋升／重算不能复制或洗换参与者。死亡／在场／有效票政策仍留下一切片 |
| 营地 | 同一日实例只有一个承诺，日界执行或无收益 fallback 一次；不因重复会议产生额外生产或降低压力 |
| 势力 | 不因权限门控补发外援、关系或交易资源；已有选案关系效果只按原结算器执行 |
| 敌人 | 夜间隔离仍阻止干预，不刷新防线收益，不跳过尸潮；此修复不宣称自然战斗平衡通过 |
| 全局事件链 | 固定 day／instanceId、成功或拒绝 commandId、一次执行／fallback 维持可审计因果；14天主线、旧中继／SAN链与原回放轨迹保持 |

## 实际源码验收

私有证据包逻辑名：`plan-integrity-candidate`。基线完整 HTML 为 `base-412c.html`，候选 `index.html`，逐字节修改见 `patch.diff`，文件 SHA／大小见 `manifest.json`。具体私有目录由负责人映射，不是复现逻辑的一部分。

新 `check-plan-integrity.mjs` 执行完整实际 inline runtime，复用原 recovery checker 的 VM adapter；DOM、storage、timer／render IO 受控，**未 mock 两个被修改函数、CommandBus、日界、效果、loader 或 writer**。准确地说，adapter 替换 `renderWorld`／`renderHud`／`renderContext`、略过 bootstrap 最后一次 Canvas render，并用内存 DOM／storage、受控 Date／performance 和未执行的 timer 队列。本检查文件头的“dependencies”不应解读为所有展示依赖均保真。低 trust 与 CP 为声明输入；异步真实钟、Canvas、自然 browser／平衡不在其证据范围。

| 范围 | 实际结果 |
| --- | --- |
| 新48项：0／19／20／40／59／59.99×3动作拒绝，60／80×3动作成功与第二次干预，candidate／committed／临时resolved／fallback×force，额外SUMMARY，零CP／night，旧 committed 保存恢复，真实次日成功／失败和首次新会议 | candidate **48/48 pass，exit0**；base **19/48 pass，exit1**，原29失败保留 |
| 原报告恢复／SAVE18兼容（完全相同候选 HTML） | **177 pass**，四个真实 production18 writer 原件继续验证 |
| 原内容链源码 | **43 pass**，sourceReplayHash **`c5d6c772`** 原值保持 |
| 原计划／日界源码 | **27 pass**，planDayTraceHash **`66c9368d`** 原值保持 |
| 原营地区域源码 | **16 pass** |

结果 `baseline.json`、`candidate.json`、旧 writer 原件和原检查的工具捕获均留私有目录。工具捕获的 recovery 输出存在 tool 截断标记，按实际退出码／明确177数值与源码SHA记证；不能把截断捕获冒充完整原 JSON。没有重基现有 golden。

精确 SHA256：

```text
base / 未改仓库dist  412c69fd80e79e8b307511798c4d6bf5bee712116dbb45c3df5c951ad3100ba8
candidate HTML       fb871d8a765c757bd879734fe04545fc0b9e6e299e10abac11b5318e8c7a2551
private checker      2904762f46954156a911a3f9168c1be3630582b01faa06ad32173fd433d06548
baseline report      15ab5d226ec1187c3af5b9e3689d720555acb7c703dd5775a17b76a613341b9a
candidate report     3d2c08e7c225982c20e2f9a3107a78558a4091a290c60eb4f79d76b6ebf9be0b
legacy writer raw    d9b8811fed88c25f9f1da0849d772d92e19742280f41e2aec3871d178d9bb05b
```

原冻结检查的 CLI 模板（四项须映射为实际绝对路径，文件不重写）：

```text
node check-plan-integrity.mjs --repo ABS_REPO --html ABS_CANDIDATE_HTML --base-html ABS_BASE_HTML --out ABS_REPORT
```

原四个检查均以 `--html` 指向 SHA `fb871d8a…` 的同一候选，未修改原脚本或 fixtures。

## 独立 UI 切片

逻辑证据包 `plan-integrity-ui-candidate` 从完整 `fb871d8a…` 复制，未改该冻结原件。只修改 `renderPlanMeeting`：

1. `canAct` 增加正常化 trust≥60，保留原 CP／日期／night／gameOver／candidate 条件。
2. 候选卡解释低信任、CP不足、旧日、夜间或本局结束原因；commit／resolved 文案与选择照旧。
3. 信任显示使用正常化实际数值，避免59.99被四舍五入成60而按钮禁用的矛盾。

新 `check-plan-integrity-ui.mjs` 接收 `--html`、`--io-adapter`、`--legacy-fixture`、`--out`，相对／绝对路径均可，无个人目录硬编码。独立 fixture `plan-committed-legacy-basewriter.json` 与相邻 `.meta.json` 明确标 TEST-ONLY，保留原完整 writer envelope、SHA `d9b8811f…` 与 FNV `707889bd`，不伪造自然游玩或缩为不合法的部分保存。输入验证、加载和 FNV 使用实际源码。

本检查**执行原 `renderPlanMeeting` 与原挂载点击 listener，不替换所改 renderer**。上述三项无关 render stub／内存 storage／受控 clock／未运行异步 timers 仍存在；DOM adapter 解析实际生成的 button 属性为 disabled／dataset 后交回原 listener，没有重算权限。没有真实布局、焦点、native click 或浏览器可见性证据。

| UI／同构建证据 | 实际结果 |
| --- | --- |
| trust59／59.99／60 × CP0／1、全部三类按钮、真实权限文本、disabled listener不产命令、≥60实际提交一次、stale node不再次扣点、night／旧日／gameOver、完整旧 committed fixture、重复纯render与idle | 新 UI **45/45 pass**；原 fb871 UI **34/45，exit1，11失败保留** |
| 相对路径 portable CLI、`--help`／`node --check`、非法CLI拒绝 | 完成；CLI开发检查与游戏方法结果分开 |
| 同 UI 候选规则回归 | 原 private 48/48、原 recovery177／chain43／plan-day27／camp16通过；`c5d6c772`／`66c9368d` 保持 |

这次原四组 stdout 在 `recovery-source.log`／`chain-source.log`／`plan-day-source.log`／`camp-source.log` 完整保存，补充新构建的可核对证据，不改上一包的截断 tool 捕获或失败报告。

portable CLI 模板（显式指定可携带的 recovery checker 路径）：

```text
node checks/check-plan-integrity-ui.mjs --html dist/index.html --io-adapter RECOVERY_CHECKER_PATH --legacy-fixture fixtures/plan-committed-legacy-basewriter.json --out results/candidate-ui.json
```

新完整 HTML SHA `15698effc1259a16ba52d16c3693e865cccfb6a38c7b380673eac9bf372b5ed2`；新增源级检查／报告／diff 的精确 SHA 记新包 `manifest.json`。仓库 dist 仍为412c，两个私有候选各自独立，尚未发布。

## 集成出口与剩余范围

下一步负责人按精确两行 diff 集成到独立构建后，再对该新构建做公开计划干预／刷新验收，不能借报告恢复48场景的通过宣称本主题 browser 已通过；未改变412c运行中的三日构建。

原规则候选 fb871 的 `renderPlanMeeting` 仍只看 CP／日期等：trust20–59 会显示可点按钮，点击实际命令拒绝。新增独立15698 UI切片已在真实 renderer 方法层补齐低信任禁用／原因，尚待负责人集成后的公开 UI 验收。候选未发布、未推送、未修改服务器、旧 profile、L0、当前状态或当前 QA runner。

回退以完整412c字节为准，存档 schema 兼容；回退会恢复两项旧行为缺陷。引擎迁移、完整 NPC 自治、投票身份／伤病裁定与十人主动技能继续按各 proposed 设计卡推进，不计入本切片完成范围。
