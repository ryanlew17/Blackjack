# REQ-2026-001: ResetPanel 取消按钮统一走 closePanel

状态: active
来源: 内部（2026-09-22 重构终审遗留 minor）
关联设计: docs/design/ui.md
影响模块: src/presentation/App.tsx
非目标: 不改变任何可见行为；不调整其他面板

## 背景

五个面板的关闭路径约定为统一的 `closePanel()`（除关闭弹层外还清空导入待确认快照 `pending`）。当前 `App.tsx` 中 ResetPanel 的 `onCancel` 使用的是 `() => setPanel(null)`，与其余面板及 RulesPanel 的关闭路径不一致。功能上无用户可见缺陷（ResetPanel 不涉及 `pending`），属于一致性债，重构终审时如实记录、延期处理。

## 方案要点

- 将 ResetPanel 的 `onCancel={() => setPanel(null)}` 改为 `onCancel={closePanel}`。
- 顺带检查是否还有遗漏的直接 `setPanel(null)` 调用点。

## 验收标准

- ResetPanel 取消按钮经 `closePanel()` 关闭；打开/取消/Esc 行为与改前一致。
- `design/ui.md` 的"面板关闭统一走 closePanel"约定不再有例外条目，回写该快照。
- `npm test`、`npm run typecheck`、`npm run format:check` 通过。

## 变更记录

- 2026-09-22 创建
