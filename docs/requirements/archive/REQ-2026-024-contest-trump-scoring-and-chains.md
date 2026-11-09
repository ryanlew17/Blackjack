# REQ-2026-024: S2 积分道具、补给与有限触发联动

状态: done
来源: 用户（2026-10-21：S2拆分）
关联设计: [竞赛规则](../../design/contest-rules.md) · [道具定义](../../design/contest-trumps.md)
影响模块: domain/contest/engine、trumps及积分／资源／投影测试

## 背景

在数字效果之上实现积分、补给、费用和短效封锁，使资源组合与Game胜负通过同一权威命令链执行。

## 方案要点

- [interactionDefinitions.ts](../../../src/domain/contest/trumps/interactionDefinitions.ts)交付24个定义，含赌命；与REQ-023合计53项，回仙完整执行由[REQ-027](./REQ-2026-027-contest-active-skills.md)完成。
- 计分、有限触发、隐蔽费用、库存逆操作与悔牌容量规则见[竞赛规则](../../design/contest-rules.md)§2、§4；逐卡效果见[道具目录](../../design/contest-trumps.md)。

## 验收标准

- 积分抵消／封顶／0分、跳分／递延和赌命局胜均只结算一次。
- 补给、触发、费用、封锁及连续悔牌顺序正确，每命令有限终止，合法命令不因恢复容量抛错。
- 隐藏费用逐帧观察等价，测试、类型、格式及领域纯度检查通过。

## 验收记录

2026-10-22自审及外审补修验收通过并归档：

- 最终补修自测483项（23文件）、typecheck、format及领域纯度检查通过；覆盖24组满手连续悔牌和28次同Turn共同补给。
- 已修复赌命已决Game仍递延、回放帧事务差量不同步；补充移花／压制回归。计分、有限链、隐蔽费用和库存逆操作证据见[积分测试](../../../src/domain/contest/engine/trumpScoring.test.ts)、[连锁测试](../../../src/domain/contest/engine/trumpChains.test.ts)及[逆操作测试](../../../src/domain/contest/engine/chainUndo.test.ts)。
