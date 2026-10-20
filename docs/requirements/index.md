# 需求索引

> 适用范围：**增量需求**的唯一登记处。PRD 不内联需求正文；已实现功能的行为快照在 `../design/`，不转为需求。
> 何时读取：开始实现任何新需求之前——先在这里（或 GitHub Issues）定位需求 ID。
> 关联需求：本文件即需求索引。
> 最后更新：2026-10-20
> 来源：2026-09-22 文档架构升级新建；首批两条为 2026-09-22 重构终审遗留的 minor；REQ-003–006 来自用户确认的规则 v2 里程碑计划；2026-09-22 REQ-001、REQ-002 完成验收并归档，中间产物提炼进各需求文档；REQ-2026-007 用户于 v0.1.0 发布后新增；REQ-2026-008–011 由 2026-09-22 第三方 UX 审查发现、用户确认后登记；2026-09-22 REQ-2026-008 完成验收并归档；2026-09-23 REQ-2026-009–011 完成验收并归档

## 需求表

| ID                                                                      | 标题                                    | 状态   | 来源            | 影响模块                                                              | 关联设计                                                                                                                 | 更新时间   |
| ----------------------------------------------------------------------- | --------------------------------------- | ------ | --------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| [REQ-2026-001](./archive/REQ-2026-001-reset-panel-cancel.md)            | ResetPanel 取消按钮统一走 closePanel    | done   | 内部            | src/presentation/App.tsx                                              | design/ui.md                                                                                                             | 2026-09-22 |
| [REQ-2026-002](./archive/REQ-2026-002-soft17-test-coverage.md)          | 软 17 补牌变体测试补全                  | done   | 内部            | src/domain/game.test.ts                                               | design/game-rules.md                                                                                                     | 2026-09-22 |
| [REQ-2026-003](./archive/REQ-2026-003-rules-v2-foundation.md)           | 规则 v2 共用状态、结算与存档基础        | done   | 用户确认        | src/domain/、src/application/、src/infrastructure/、src/presentation/ | docs/design/game-rules.md、docs/design/state-and-animation.md、docs/design/persistence.md、docs/contracts/save-format.md | 2026-09-22 |
| [REQ-2026-004](./archive/REQ-2026-004-split-hands.md)                   | 分牌与多手轮转                          | done   | 用户确认        | src/domain/、src/presentation/、src/infrastructure/                   | docs/design/game-rules.md、docs/design/state-and-animation.md、docs/design/ui.md、docs/contracts/save-format.md          | 2026-09-22 |
| [REQ-2026-005](./archive/REQ-2026-005-insurance.md)                     | 保险决策与独立赔付                      | done   | 用户确认        | src/domain/、src/presentation/、src/infrastructure/                   | docs/design/game-rules.md、docs/design/state-and-animation.md、docs/design/ui.md、docs/contracts/save-format.md          | 2026-09-22 |
| [REQ-2026-006](./archive/REQ-2026-006-late-surrender.md)                | 晚投降                                  | done   | 用户确认        | src/domain/、src/presentation/、src/infrastructure/                   | docs/design/game-rules.md、docs/design/state-and-animation.md、docs/design/ui.md、docs/contracts/save-format.md          | 2026-09-22 |
| [REQ-2026-007](./archive/REQ-2026-007-about-panel.md)                   | 设置面板新增「关于」页                  | done   | 用户            | src/presentation/                                                     | docs/design/ui.md                                                                                                        | 2026-09-22 |
| [REQ-2026-008](./archive/REQ-2026-008-insecure-context-white-screen.md) | 非安全上下文(明文 http)白屏 — UUID 降级 | done   | 用户（UX 审查） | src/infrastructure/                                                   | docs/adr/ADR-002、docs/design/persistence.md、docs/contracts/save-format.md、docs/testing.md                             | 2026-09-22 |
| [REQ-2026-009](./archive/REQ-2026-009-css-patch-consolidation.md)       | styles.css 补丁值精简（零视觉变更）     | done   | 用户（UX 审查） | src/presentation/styles.css                                           | docs/design/ui.md                                                                                                        | 2026-09-23 |
| [REQ-2026-010](./archive/REQ-2026-010-touch-action-hints.md)            | 玩家动作提示触屏可达                    | done   | 用户（UX 审查） | src/presentation/                                                     | docs/design/ui.md                                                                                                        | 2026-09-23 |
| [REQ-2026-011](./archive/REQ-2026-011-interaction-semantics.md)         | 交互语义修缮（品牌区/旧档导出/焦点）    | done   | 用户（UX 审查） | src/presentation/                                                     | docs/design/ui.md                                                                                                        | 2026-09-23 |
| [REQ-2026-012](./archive/REQ-2026-012-module-foundation.md)             | S1 前置文件架构升级                     | done   | 用户            | src 四层目录                                                          | docs/architecture.md                                                                                                     | 2026-10-18 |
| [REQ-2026-013](./archive/REQ-2026-013-codex-data.md)                    | S2 前置图鉴数据系统                     | done   | 用户            | domain/contest、i18n                                                  | docs/design/codex-data.md                                                                                                | 2026-10-18 |
| [REQ-2026-014](./archive/REQ-2026-014-classic-build-compatibility.md)   | S1 经典模式重构与构建兼容               | done   | 用户            | src 现有经典入口与模块导入、构建依赖边界及必要测试                    | docs/roadmap.md、docs/design/contest-rules.md                                                                            | 2026-10-18 |
| [REQ-2026-015](./archive/REQ-2026-015-contest-round-engine.md)          | S1 竞赛单回合引擎与信息投影             | done   | 用户            | src/domain/contest/engine/                                            | docs/roadmap.md、docs/design/contest-rules.md                                                                            | 2026-10-20 |
| [REQ-2026-016](./archive/REQ-2026-016-contest-match-scoring.md)         | S1 积分赛制与比赛生命周期               | done   | 用户            | src/domain/contest/engine/ 的 Match/Game 状态、计分与生命周期测试     | docs/roadmap.md、docs/design/contest-rules.md                                                                            | 2026-10-20 |
| [REQ-2026-017](./archive/REQ-2026-017-contest-coordination.md)          | S1 应用协调与占位对手接线               | done   | 用户            | src/application/contest/                                              | docs/roadmap.md、docs/design/contest-rules.md                                                                            | 2026-10-20 |
| [REQ-2026-018](./active/REQ-2026-018-contest-basic-ui.md)               | S1 模式入口与基础竞赛界面               | active | 用户            | src/presentation/shell/、contest/table/、App.tsx、i18n.ts、styles.css | docs/roadmap.md、docs/design/contest-rules.md                                                                            | 2026-10-18 |
| [REQ-2026-019](./active/REQ-2026-019-contest-trump-prototype.md)        | S1 多卡联动与效果入口原型               | active | 用户            | src/domain/contest/engine/、trumps/ 的最小原型及同目录测试            | docs/roadmap.md、docs/design/contest-rules.md                                                                            | 2026-10-18 |
| [REQ-2026-020](./active/REQ-2026-020-contest-basic-ai.md)               | S1 末项：无道具 AI 基线与隔离验收       | active | 用户            | src/domain/contest/ai/、application/contest/ 策略适配及测试           | docs/roadmap.md、docs/design/contest-rules.md                                                                            | 2026-10-18 |

REQ-2026-001–017 已验收归档。REQ-014 经独立验收绿灯，main 上 v0.1.4 已正式发布并完成上传资产回读复验，仅交付架构迁移兼容性，无新增 feature，图鉴不生效；实际 Release 证据见归档需求。REQ-015 已在发布后 main 新建的 `codex/contest-round-engine` 实现并通过独立验收（2026-10-20），实现与验收证据见归档需求；实现与归档记录归入该分支，开发版本为 0.2.0、尚未发布。REQ-016 已按任务收尾检查与自审验收归档（2026-10-20），标准无道具 BO5、积分递延和比赛生命周期已实现；REQ-017 已按任务收尾检查与自审验收归档（2026-10-20），已接内存提交、投影队列、取消与占位对手；REQ-018–020 仍为 active、尚未开始，沿用竞赛分支按 0.2.x 迭代。实施顺序和依赖见 [roadmap.md](../roadmap.md)；S2 后续拆分时将 AI 组合决策安排为末项，后续编号自 REQ-2026-021 起顺延。

## 状态流转

- `active`：进行中，文件在 [active/](./active/)。
- `done` / `cancelled`：移入 [archive/](./archive/)，本表保留一行（状态更新）。

## 验收方式（2026-10-20 用户裁定）

自 REQ-016 起，完成实现、适用的任务收尾检查（见 [../testing.md](../testing.md) §1）与自审查且无待修复问题，即通过该需求验收；将证据写入需求文档，更新为 done 并归档，无需逐项等待单独验收。S1 里程碑末尾安排一次整体外部审查，具体安排另定。REQ-014/015 已完成的独立验收记录保留为历史证据。

## 约定

- ID 格式 `REQ-YYYY-NNN`（如 `REQ-2026-001`）；对应 GitHub Issue 时在"来源"列写 `owner/repo#123`。
- 需求落地后：回写受影响的 `../design/` 快照，并在代码/测试注释标注 `@req REQ-YYYY-NNN`（或 `@issue #123`）。
- 每个需求最终只保留 1 个文档（背景 / 方案要点 / 验收标准 / 验收记录 / 变更记录）；验收报告、交接清单、实施计划等中间产物精炼后提炼进需求文档，随即删除，不单独留档。
- 模板：[REQ-TEMPLATE.md](./REQ-TEMPLATE.md)。
