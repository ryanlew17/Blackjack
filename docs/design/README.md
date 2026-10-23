# design — 模块行为设计快照

> 适用范围：当前行为、明确标识的未实现设计及其依据；实现与验收证据留在需求文档。
> 何时读取：按根AGENTS.md路由选择相关文档，不默认全量读取。

## 文档索引

| 文档                                               | 职责                                      | 何时读取                             |
| -------------------------------------------------- | ----------------------------------------- | ------------------------------------ |
| [game-rules.md](./game-rules.md)                   | 经典RuleSet、阶段、命令与结算             | 改经典规则、赔付或规则变体           |
| [state-and-animation.md](./state-and-animation.md) | 两模式权威状态、回放、恢复与取消          | 改应用协调、队列或提交时机           |
| [persistence.md](./persistence.md)                 | 经典自动保存、导入确认与损坏恢复          | 改经典存档生命周期                   |
| [ui.md](./ui.md)                                   | 组件、i18n、响应式、交互与音效约定        | 改表现层                             |
| [contest-rules.md](./contest-rules.md)             | 竞赛规则、信息边界及未实现设计            | 改竞赛玩法或评估规则变更             |
| [contest-trumps.md](./contest-trumps.md)           | 历史51卡模型、原版来源／R/Q台账与扩展条件 | 核对道具依据、扩卡或进入平衡阶段     |
| [codex-data.md](./codex-data.md)                   | 图鉴纯数据API、接线边界与扩展条件         | 改道具目录、图鉴进度或接入页面／存储 |

## 与其他文档的边界

- 产品定位与非目标见[PRD](../prd.md)，技术分层与构建见[架构](../architecture.md)。
- 存档字段、版本与校验约束见[契约索引](../contracts/README.md)，通用验证标准见[测试门槛](../testing.md)。
- 需求范围、实现摘要和验收证据见[需求索引](../requirements/index.md)；落地后原位更新受影响的行为章节。
- 道具历史模型的[验证脚本](../../scripts/validation/contest_supply_model.py)按需运行，其结论不替代当前卡池、技能或AI的验证。
