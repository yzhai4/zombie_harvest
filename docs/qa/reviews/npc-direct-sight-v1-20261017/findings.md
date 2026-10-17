# NPC direct-sight 最终发布证据只读审计

结论：在本次发布 provenance 范围内未发现阻塞问题。未运行游戏、源码测试、浏览器或VM validator，也未修改ROOT。它不是产品体验、完整ActorObservation、远端ref、精确CI或生产部署批准。

- 冻结manifest：`docs/qa/iteration-manifest-v1.json`，SHA `19b15de318227295c032223dd33464f43181cceb068f421c1c5b34094dfeb4e4`。965/965声明工件实际读取并匹配SHA；23个结果行无重名。
- 独立读取GitHub不可变commit `4e6847c2e022f28690df40297bdfd640b49ed444`与tree `2425eb1e887c8bf2d561c28085d8965b84f8b8fc`；146/146 scripts/dist依赖的本地原字节Git blob SHA匹配服务tree。HTML仍为23b8，inline/core标记内容一致。没有用根代理既有绿色代替此核验。
- 三套运输表：direct 210原位置／191原生或删改副本工件引用；legacy 870对象／500工件行／9显式删改记录；browser 261原位置／137原生工件引用。对象均核SHA，全部引用闭包已被当前manifest覆盖；两组四场原生输入及原manifest可按相对位置恢复。五份direct失败raw明确不公开，不能由删改副本重建原字节。
- 计数为既有42个不同源码合同＋新增direct一个＝43；91只是新合同内断言。关联self104 recapture和重复91正控未增加unique。42原执行行各自exit0；新91主报告保留原字节。
- 四原生Chrome报告分别200／212／112／12，检查数组与passed/count相符，errors为空，process均exit0。主文档按各套唯一表示计12／13／30／2＝57，不重复计documentHashes与allMainDocuments。报告／runner／输入／source／工件关联匹配；前三套原生清理旗标均true，episode仅原finally已await＋终态exit0，未虚构独立清理旗标。
- QA准确限定TEST-ONLY预启动完整writer、暂停场景、当次直接视线与as-of界面；N仅是真实遭遇阶段探针，不是午夜或自然时间推进。没有本轮natural、完整Actor、其它未重跑browser套件、完整移动端或生产主张。root截图目视属于其已有观察，本审计没有重新做目视。
- 原82/85中的真实dead问题与两项方法错误、84/85、producer90/91方法错误、同方法旧源负控5/91与86/91以及redundant正控角色均相符，未把五个断言失败说成五次独立运行／根因。

非阻塞注记：两份legacy精确保留执行方法／日志含通用解释器安装位置，不含用户名、工作temp、profile或凭据；新包私人文件路径扫描为0。初始较宽的安装路径检索因此命中这两处，经读原文归为非个人工具位置，未修改原字节。精确证据head的CI与分支更新仍须另核；不可变源码commit存在不能代替这些状态。

详见同目录`audit.json`、工件索引、依赖索引、运输与计数核验记录，以及独立服务commit/tree原响应。所有审计产物使用仓库或本目录相对路径，不包含本机私人路径。
