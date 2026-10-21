# 林岑邀请窗口：无浏览器迭代结果

2026-10-20。接续140d719开发线。用户批准继续迭代并允许暂停浏览器；本片没有启动Chrome、手机验收或LLM调用。只增加一个127行诊断脚本，复用已有完整inline源码与VM/IO适配器，不改游戏HTML、规则、文本、界面或SAVE21/CONTENT3。

## 已执行与实际结果

诊断提交`0435d34016fd0f7f368d7ac2d338e6252f99c66f`已用expected=140d719、force=false更新开发分支并再次GET核实。游戏运行时仍为源码`2970d9b3c24e00e677880c39de9ed6e4639ae91d`、HTML SHA256 `86ca99869d174f56287309229cd36017ef69aa92122809c62dd998c16497446f`。

[源码诊断run39432297998](https://github.com/yzhai4/zombie_harvest/actions/runs/39432297998)／job118660162864已实际completed/success。checkout为PR临时合并预览62614656，不是main已合并。相同0435 head的[游戏run39432297634](https://github.com/yzhai4/zombie_harvest/actions/runs/39432297634)及[工具run39432297483](https://github.com/yzhai4/zombie_harvest/actions/runs/39432297483)也已核completed/success；后续归档提交不继承这个精确CI结论。

| TEST-ONLY场景 | 实际观测 | 边界 |
| --- | --- | --- |
| 工程consumer，materialClock=0 | 第30次一分输入后，石3→4、库存9→8、进入building，邀请同时拒绝 | 全世界时钟停在643，不称经过30世界分钟 |
| 同consumer，materialClock=29 | 第1次一分输入后出现同样结果 | 证明剩余筹料credit影响窗口，不代表人只有1秒阅读 |
| 选定原1200ms interval，materialClock=0 | 第30个callback后世界643→673，同样补料并关闭邀请，HP仍86 | 完整inline在受控IO中执行；无浏览器、RAF全调度或正常导航结论 |

三场关闭原因均为`npc-relay-stone-no-longer-needed`，不是误称永久软锁。初态邀请Gate可用；全过程纯查询对state、任务队列和storage不写入，原源码与输入字节未变。三场64份时点观察不是64个独立实验或玩家。没有新增保存后再次Continue的成果主张。

## 证据与输入诚实性

原A08 writer仅作既有不可变fixture（SHA7c54ea074c60…），派生明确TEST-ONLY位置和筹料clock；未续跑A08、未重置80/80预算。没有伪造本人记忆，也没有给角色补料。诊断不是正常玩法，不证明玩家可以自然走到该位置；直接consumer步和真实interval分别记账。

原生JSON已经通过Actions artifact12269080794下载并核字节；原始ZIP保存在[report-0435d340.zip](evidence/relay-invitation-window-v1/report-0435d340.zip)，2541字节，SHA256 `3043a3d7ba6f319ca26804d92053cba7e53e8557d31c36072259682ccaeeb701`。唯一成员relay-invitation-window.json为38246字节，SHA256 `297dbbeb7b87e13c4833735eedfec1ae46e782e7dcc3a6543eba83fdc7901228`。[紧凑回执](evidence/relay-invitation-window-v1/receipt-0435d340.json)是从真实API及原生报告派生的摘要，不冒充原始API响应。下载后仅检查报告内数值一致，没有再次运行游戏。

本地只运行了node语法检查和help。工作区不能直接clone GitHub，因此完整业务在上述Actions运行。临时诊断workflow仅用于本次执行，归档后移除，避免每个PR更新都再增加一套CI；脚本保留为按需定位命令，不修改现有验证workflow或IterationManifest。原桌面和游戏验收保其原来源。

## 决策与唯一下一交付

已知邀请有一个受自治筹料影响的条件窗口，不能仅凭未看到按钮认定入口坏了，也不能认为打开事项必定保留库存。本片没有证明该窗口对真人过短，不自动延长、冻结世界、加奖励或把可选邀请改成必经主线。

浏览器保持暂停。恢复后只沿既有桌面路径记录“条件成立→入口呈现→玩家注意→答复/主动略过/条件失效”，复用原理解pilot，分清提前交料、施工与上线、延期不锁库存。无真人时不代填理解；源码结果不补成自然中继全链或三日。需要新UI或剧情调整时先有实际阻断/误解证据，不再扩展测试平台。

main未合并、生产未部署。14天危机、更大世界、可替换引擎、受控布局/随机地图、局部持续演化、剧本设置器与跨副本记忆仍为长期目标。本轮无新增全局记忆。
