# 需求索引

> 适用范围：**增量需求**的唯一登记处。PRD 不内联需求正文；已实现功能的行为快照在 `../design/`，不转为需求。
> 何时读取：开始实现任何新需求之前——先在这里（或 GitHub Issues）定位需求 ID。
> 关联需求：本文件即需求索引。
> 最后更新：2026-09-22
> 来源：2026-09-22 文档架构升级新建；首批两条为 2026-09-22 重构终审遗留的 minor，如实登记

## 需求表

| ID                                                            | 标题                                 | 状态   | 来源 | 影响模块                 | 关联设计             | 更新时间   |
| ------------------------------------------------------------- | ------------------------------------ | ------ | ---- | ------------------------ | -------------------- | ---------- |
| [REQ-2026-001](./active/REQ-2026-001-reset-panel-cancel.md)   | ResetPanel 取消按钮统一走 closePanel | active | 内部 | src/presentation/App.tsx | design/ui.md         | 2026-09-22 |
| [REQ-2026-002](./active/REQ-2026-002-soft17-test-coverage.md) | 软 17 补牌变体测试补全               | active | 内部 | src/domain/game.test.ts  | design/game-rules.md | 2026-09-22 |

## 状态流转

- `active`：进行中，文件在 [active/](./active/)。
- `done` / `cancelled`：移入 [archive/](./archive/)，本表保留一行（状态更新）。
- 来源优先级：**GitHub Issue > `active/*.md` > design 快照**（见根 AGENTS.md）。

## 约定

- ID 格式 `REQ-YYYY-NNN`（如 `REQ-2026-001`）；对应 GitHub Issue 时在"来源"列写 `owner/repo#123`。
- 需求落地后：回写受影响的 `../design/` 快照，并在代码/测试注释标注 `@req REQ-YYYY-NNN`（或 `@issue #123`）。
- 模板：[REQ-TEMPLATE.md](./REQ-TEMPLATE.md)。
