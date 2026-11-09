# REQ-2026-023: S2 正式数字牌效果与留场规则

状态: done
来源: 用户（2026-10-21：S2拆分）
关联设计: [竞赛规则](../../design/contest-rules.md) · [道具定义](../../design/contest-trumps.md)
影响模块: domain/contest/engine、trumps及效果／观察测试

## 背景

将数字与留场原型扩展为正式执行语义，统一合法目标、数字贡献、信息投影与悔牌逆操作。

## 方案要点

- [numberDefinitions.ts](../../../src/domain/contest/trumps/numberDefinitions.ts)实现28个数字／留场定义及悔牌，共29项；逐卡定义见[道具目录](../../design/contest-trumps.md)。
- 数字实例、逻辑暗牌、倍率／共生、目标替换、私有窥序和悔牌规则归入[竞赛规则](../../design/contest-rules.md)§3–4；生产准入由[REQ-025](./REQ-2026-025-contest-trump-admission-and-coordination.md)完成。

## 验收标准

- 逐卡成功、前置拒绝及适用的合法失败均以真实命令验证；连续用卡不提前交权或结算。
- 容量预检、暗牌保护、实例逆操作、隐藏等价及逐帧投影正确。
- 测试、类型、格式及纯TypeScript领域检查通过。

## 验收记录

2026-10-21自审、2026-10-22外审通过并归档：

- 362项测试（20文件）、typecheck、format及领域纯度检查通过，外审独立复跑通过。
- [数字效果](../../../src/domain/contest/engine/numberEffects.test.ts)与[悔牌](../../../src/domain/contest/engine/regret.test.ts)覆盖29定义；满桌混合卡在支付前拒绝，既有留场均为公开预检后确定安装。满手逆操作与技能生成扩展分别由[REQ-024](./REQ-2026-024-contest-trump-scoring-and-chains.md)和[REQ-027](./REQ-2026-027-contest-active-skills.md)闭环。
