# PROB：中继物理损毁与当前能力

状态：开发修复本地验证完成，精确CI与生产另核；历史反例保留。见[维护QA](../qa/relay-maintenance-v1-20261018.md)与[合同](../decisions/ADR-20261018-relay-maintenance-v1.md)。

当前4f697以同方法旧7b23真实负控和新7组、既有47合同、Chrome28及episode12验证损毁／能力／付费修复／保存闭环。旧missingHP保持未知，历史上线和当次锁定不追改；自然损毁频率、公开全链与玩家理解仍未验收。下方原反例及其原整体失败保持原时点。

HTML2dd27255的完整旧online writer，保10人／5敌，TEST-ONLY仅把原normal敌移到原站下方一格。真实dayEnemyTarget选同站，原runDayCombat(24)按真实冷却命中8→2→0并发defeated，active=false；这24为consumer输入而非24分钟世界。随后真实world.advance(1)使HP仍0却active／relayEnabled回true。直接从受损writer Continue本身保持active=false，但profile仍有上线sight加成，真实threat.start仍锁定中继通道、count3、初始progress0。

损毁前后standing与上线历史无重复收益；不能追溯撤销历史。施工inactive站HP0→8没有由该受击路径复现，不作已确认问题。原诊断一次执行整体exit1：所有DAY保存／校验／Continue和两次遭遇启动已完成，末尾额外要求未结算BATTLE保存被既有progressSaveAllowed拒绝。原报告ok=false、stderr和完整writer保留，companion只分类，不改绿。

源路径为applyDayCombatDamage将HP0置inactive，ensureRelayFacts依据项目online重设标记，而perceptionProfile与startThreatEncounter依据项目状态。下一合同应分开已完成项目、物理当前可用能力与付费修复；串起真实伤害／正常writer／Continue／下一tick／感知与遭遇消费者，再验证修复不重复上线收益。不得手填HP0冒充真实战斗，或因维护未定义就静默复活建筑。

证据范围及原执行SHA见[本轮QA](../qa/relay-public-feedback-v1-20261018.md)。源诊断与当前54ef只改呈现分列；自然敌人抵达、完整主线与整轮防守未由此证明。
