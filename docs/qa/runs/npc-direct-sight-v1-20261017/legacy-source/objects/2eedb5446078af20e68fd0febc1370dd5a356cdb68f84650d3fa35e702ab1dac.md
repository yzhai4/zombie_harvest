# Scenario启动与配置消费

用于修改Scenario包、fresh/continue、配置保存或preboot设置；合同细节以`docs/decisions/ADR-20261017-scenario-initial-binding-v1.md`和完整boot ADR为准。

- 沿实际调用路径列出每个支持轴的consumer；保存字段和resolver通过仅证明存储/解析。初始资源、未来产出和有限来源分别核验，不将一次初值倍率变成全局产出倍率。
- 共享纯核心与HTML同字节，并把包与实际注册内容对账。预期目录若与受测JSON由同一可变输入生成，会漏检构建时的共同漂移；固定独立支持目录，或以真实注册/执行证明语义。C1基线目录不等于C2编译器。
- UI设置走当前可见入口→安装→第一份正常writer→实际consumer→刷新。preboot设置被覆盖、隐藏后直接触发handler、只核checkbox或保存旗标都不能证明公开功能有效。只读表达probe不等于角色知识或真实对话接线。
- fresh的seed/配置及initial digest绑定后不随偏好或随机推进改变。首存失败保留已安装且冻结的待重试状态；核无世界timer、相同初值、单一绑定收据与真实重试。不要将它描述为全内存回滚。
- 完整旧writer不重算世界。明确区分原声明与真实已保存事实；新增来源字段忠实记录实际旧seed/RNG，保留原声明和一次迁移收据。legacy专用兼容不放宽fresh/bound，也不吞掉未知未来版本或坏实体。
- 固定方法跑旧版负控与候选正控，保留原失败。按原始HTML、boot前配置变体各自SHA标记证据，不能把变体绿色移到canonical。实际浏览器、source VM、纯核心、自然玩法和生产部署分别列明。

修改JSON编译或目录安装时，按[内容绑定合同](../../../../docs/decisions/ADR-20261017-scenario-content-binding-v1.md)检查以下边界：

- pre-start loader可能先于公开start查询定义；用显式只读候选lookup贯穿保存校验/迁移/恢复，不临时修改全局注册表再回滚。默认get/all仍只见已安装目录。
- 全批次校验后才一次提交目录。只读候选不意味着可以冻结既有扩展API要写入的整张安装表；安装所需对象在提交前构造，另验注册返回和实际get/执行/保存，防止空成功。
- 核验效果执行器的实际分流：例如unlock遇weapon ID会解锁武器而非写flag，有限来源保护必须避免注册名空间碰撞，并挡住安装后新增碰撞。不能从数据字段名称推断执行结果。
- 原initial binding与新content binding分别验身份和兼容。已知旧来源可显式适配，不能用新包重算旧初值、忽略未知digest或丢弃active链。来源兼容判断不等于允许运行时任意目录白名单。
- 固定独立作者oracle核默认语义，再用合法单因子作者包经真实hook/公开Choice证明实际效果改变；只把输入与expected一起改动不能证明编译接线。晚项非法的批次须不留首项，跨episode/reload不得补回有限来源。

只在上述边界相关时采用这些检查。角色观察权限、自然多日和生产发布各自保留出口；编译合同与源码/浏览器验收按实际状态报告，不因初始绑定通过而关闭完整Scenario。

修改作者包或共享核心后运行 `node scripts/build-scenario-package.mjs` 同步独立HTML，再用 `--check` 确认部署字节一致。此构建检查不代替真实start、效果或保存验收；旧QA若直接写initial或手动install后再次fresh start，须先改为与产品相同的启动/context调用，保留原业务断言和原失败。

大量源码VM夹具包含重复HTML时，可将原始子工件无损归档；先在独立空目录标准解压，逐原路径／bytes／SHA核对原报告引用闭合，保留主native报告与明确运输索引。通用manifest读取普通文件不代表已遍历压缩包：直接消费原子工件前须解压到声明根目录，外部既有原件以显式同SHA映射解决。归档不改变执行来源、测试结果或旧失败，也不计新游戏验证。
