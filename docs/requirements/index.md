# 需求索引

> 适用范围：**增量需求**的唯一登记处。PRD 不内联需求正文；已实现功能的行为快照在 `../design/`，不转为需求。
> 何时读取：开始实现任何新需求之前——先在这里（或 GitHub Issues）定位需求 ID。
> 关联需求：本文件即需求索引。
> 最后更新：2026-09-23
> 来源：2026-09-22 文档架构升级新建；首批两条为 2026-09-22 重构终审遗留的 minor；REQ-003–006 来自用户确认的规则 v2 里程碑计划；2026-09-22 REQ-001、REQ-002 完成验收并归档，中间产物提炼进各需求文档；REQ-2026-007 用户于 v0.1.0 发布后新增；REQ-2026-008–011 由 2026-09-22 第三方 UX 审查发现、用户确认后登记；2026-09-22 REQ-2026-008 完成验收并归档；2026-09-23 REQ-2026-009–011 完成验收并归档

## 需求表

| ID                                                                      | 标题                                    | 状态 | 来源            | 影响模块                                                              | 关联设计                                                                                                                 | 更新时间   |
| ----------------------------------------------------------------------- | --------------------------------------- | ---- | --------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| [REQ-2026-001](./archive/REQ-2026-001-reset-panel-cancel.md)            | ResetPanel 取消按钮统一走 closePanel    | done | 内部            | src/presentation/App.tsx                                              | design/ui.md                                                                                                             | 2026-09-22 |
| [REQ-2026-002](./archive/REQ-2026-002-soft17-test-coverage.md)          | 软 17 补牌变体测试补全                  | done | 内部            | src/domain/game.test.ts                                               | design/game-rules.md                                                                                                     | 2026-09-22 |
| [REQ-2026-003](./archive/REQ-2026-003-rules-v2-foundation.md)           | 规则 v2 共用状态、结算与存档基础        | done | 用户确认        | src/domain/、src/application/、src/infrastructure/、src/presentation/ | docs/design/game-rules.md、docs/design/state-and-animation.md、docs/design/persistence.md、docs/contracts/save-format.md | 2026-09-22 |
| [REQ-2026-004](./archive/REQ-2026-004-split-hands.md)                   | 分牌与多手轮转                          | done | 用户确认        | src/domain/、src/presentation/、src/infrastructure/                   | docs/design/game-rules.md、docs/design/state-and-animation.md、docs/design/ui.md、docs/contracts/save-format.md          | 2026-09-22 |
| [REQ-2026-005](./archive/REQ-2026-005-insurance.md)                     | 保险决策与独立赔付                      | done | 用户确认        | src/domain/、src/presentation/、src/infrastructure/                   | docs/design/game-rules.md、docs/design/state-and-animation.md、docs/design/ui.md、docs/contracts/save-format.md          | 2026-09-22 |
| [REQ-2026-006](./archive/REQ-2026-006-late-surrender.md)                | 晚投降                                  | done | 用户确认        | src/domain/、src/presentation/、src/infrastructure/                   | docs/design/game-rules.md、docs/design/state-and-animation.md、docs/design/ui.md、docs/contracts/save-format.md          | 2026-09-22 |
| [REQ-2026-007](./archive/REQ-2026-007-about-panel.md)                   | 设置面板新增「关于」页                  | done | 用户            | src/presentation/                                                     | docs/design/ui.md                                                                                                        | 2026-09-22 |
| [REQ-2026-008](./archive/REQ-2026-008-insecure-context-white-screen.md) | 非安全上下文(明文 http)白屏 — UUID 降级 | done | 用户（UX 审查） | src/infrastructure/                                                   | docs/adr/ADR-002、docs/design/persistence.md、docs/contracts/save-format.md、docs/testing.md                             | 2026-09-22 |
| [REQ-2026-009](./archive/REQ-2026-009-css-patch-consolidation.md)       | styles.css 补丁值精简（零视觉变更）     | done | 用户（UX 审查） | src/presentation/styles.css                                           | docs/design/ui.md                                                                                                        | 2026-09-23 |
| [REQ-2026-010](./archive/REQ-2026-010-touch-action-hints.md)            | 玩家动作提示触屏可达                    | done | 用户（UX 审查） | src/presentation/                                                     | docs/design/ui.md                                                                                                        | 2026-09-23 |
| [REQ-2026-011](./archive/REQ-2026-011-interaction-semantics.md)         | 交互语义修缮（品牌区/旧档导出/焦点）    | done | 用户（UX 审查） | src/presentation/                                                     | docs/design/ui.md                                                                                                        | 2026-09-23 |

REQ-2026-001–011 全部完成并归档（[archive/](./archive/)）；REQ-2026-007 随 v0.1.2 交付，REQ-2026-008–011 于 bug-fix 分支交付并随 v0.1.3 发布（REQ-008 版本号不变）。竞赛模式 S1–S5 各自立项时登记独立需求，编号自 REQ-2026-012 起顺延（见 ../roadmap.md）。

## 状态流转

- `active`：进行中，文件在 [active/](./active/)。
- `done` / `cancelled`：移入 [archive/](./archive/)，本表保留一行（状态更新）。

## 约定

- ID 格式 `REQ-YYYY-NNN`（如 `REQ-2026-001`）；对应 GitHub Issue 时在"来源"列写 `owner/repo#123`。
- 需求落地后：回写受影响的 `../design/` 快照，并在代码/测试注释标注 `@req REQ-YYYY-NNN`（或 `@issue #123`）。
- 每个需求最终只保留 1 个文档（背景 / 方案要点 / 验收标准 / 验收记录 / 变更记录）；验收报告、交接清单、实施计划等中间产物精炼后提炼进需求文档，随即删除，不单独留档。
- 模板：[REQ-TEMPLATE.md](./REQ-TEMPLATE.md)。
