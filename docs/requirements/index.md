# 需求索引

> 适用范围：**增量需求**的唯一登记处。PRD 不内联需求正文；已实现功能的行为快照在 `../design/`，不转为需求。
> 何时读取：开始实现任何新需求之前——先在这里（或 GitHub Issues）定位需求 ID。
> 关联需求：本文件即需求索引。
> 最后更新：2026-09-22
> 来源：2026-09-22 文档架构升级新建；首批两条为 2026-09-22 重构终审遗留的 minor；REQ-003–006 来自用户确认的规则 v2 里程碑计划；2026-09-22 REQ-001、REQ-002 完成验收并归档，中间产物提炼进各需求文档；REQ-2026-007 用户于 v0.1.0 发布后新增

## 需求表

| ID                                                             | 标题                                 | 状态   | 来源     | 影响模块                                                              | 关联设计                                                                                                                 | 更新时间   |
| -------------------------------------------------------------- | ------------------------------------ | ------ | -------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| [REQ-2026-001](./archive/REQ-2026-001-reset-panel-cancel.md)   | ResetPanel 取消按钮统一走 closePanel | done   | 内部     | src/presentation/App.tsx                                              | design/ui.md                                                                                                             | 2026-09-22 |
| [REQ-2026-002](./archive/REQ-2026-002-soft17-test-coverage.md) | 软 17 补牌变体测试补全               | done   | 内部     | src/domain/game.test.ts                                               | design/game-rules.md                                                                                                     | 2026-09-22 |
| [REQ-2026-003](./archive/REQ-2026-003-rules-v2-foundation.md)  | 规则 v2 共用状态、结算与存档基础     | done   | 用户确认 | src/domain/、src/application/、src/infrastructure/、src/presentation/ | docs/design/game-rules.md、docs/design/state-and-animation.md、docs/design/persistence.md、docs/contracts/save-format.md | 2026-09-22 |
| [REQ-2026-004](./archive/REQ-2026-004-split-hands.md)          | 分牌与多手轮转                       | done   | 用户确认 | src/domain/、src/presentation/、src/infrastructure/                   | docs/design/game-rules.md、docs/design/state-and-animation.md、docs/design/ui.md、docs/contracts/save-format.md          | 2026-09-22 |
| [REQ-2026-005](./archive/REQ-2026-005-insurance.md)            | 保险决策与独立赔付                   | done   | 用户确认 | src/domain/、src/presentation/、src/infrastructure/                   | docs/design/game-rules.md、docs/design/state-and-animation.md、docs/design/ui.md、docs/contracts/save-format.md          | 2026-09-22 |
| [REQ-2026-006](./archive/REQ-2026-006-late-surrender.md)       | 晚投降                               | done   | 用户确认 | src/domain/、src/presentation/、src/infrastructure/                   | docs/design/game-rules.md、docs/design/state-and-animation.md、docs/design/ui.md、docs/contracts/save-format.md          | 2026-09-22 |
| [REQ-2026-007](./active/REQ-2026-007-about-panel.md)           | 设置面板新增「关于」页               | active | 用户     | src/presentation/                                                     | docs/design/ui.md                                                                                                        | 2026-09-22 |

REQ-2026-001–006 全部完成并归档（`archive/`）；REQ-2026-007 活跃中，正文在 [active/](./active/)。

## 状态流转

- `active`：进行中，文件在 [active/](./active/)。
- `done` / `cancelled`：移入 [archive/](./archive/)，本表保留一行（状态更新）。

## 约定

- ID 格式 `REQ-YYYY-NNN`（如 `REQ-2026-001`）；对应 GitHub Issue 时在"来源"列写 `owner/repo#123`。
- 需求落地后：回写受影响的 `../design/` 快照，并在代码/测试注释标注 `@req REQ-YYYY-NNN`（或 `@issue #123`）。
- 每个需求最终只保留 1 个文档（背景 / 方案要点 / 验收标准 / 验收记录 / 变更记录）；验收报告、交接清单、实施计划等中间产物精炼后提炼进需求文档，随即删除，不单独留档。
- 模板：[REQ-TEMPLATE.md](./REQ-TEMPLATE.md)。
