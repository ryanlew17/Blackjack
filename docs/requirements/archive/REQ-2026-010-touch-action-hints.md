# REQ-2026-010: 玩家动作提示触屏可达

状态: done
来源: 用户(2026-09-22 第三方 UX 审查确认)
关联设计: docs/design/ui.md
影响模块: src/presentation/(ControlDeck、styles.css)
非目标: 不新增自定义快捷键;不改动作合法性判定(legalActions);不新增文案(复用 i18n 现有 helpSplit / helpDouble / helpSurrender);不改规则面板内容

## 背景

分牌 / 投降 / 加倍的操作说明目前仅以 `title` 属性挂在动作按钮上(src/presentation/components/ControlDeck.tsx),桌面 hover 可见,触屏设备无 hover 则完全不可达;规则面板虽有完整说明但路径较深,不解决动作当下的疑惑。

## 方案要点

- 保留现有 `title` 作为桌面 hover 增强,不回退。
- 在玩家动作按钮区下方新增一行上下文提示小字:仅当对应动作可用(`can(action)` 为真)时显示,优先级 分牌 > 加倍 > 投降,同一时刻最多一条;文案直接取 `t.helpSplit` / `t.helpDouble` / `t.helpSurrender`。
- 样式与 control-deck 现有辅助文字风格一致(小字号、居中、muted 色);提示行不含可聚焦元素,不参与 Tab 序。
- 布局约束:提示行出现/消失不得挤压或移位按钮行,320px 双语无横向溢出。

## 验收标准

- 触屏视口(390 / 320)首次行动时可看见提示且中英文正确;对应动作不可用(如已要牌、余额不足、已分牌)时提示消失。
- 桌面 hover 的 title 行为不回退;键盘走查(Tab / Enter)不受提示行影响。
- 320px 中英文 scrollWidth ≤ 320;按钮行无移位(截图比对)。
- `npm test`、`npm run typecheck`、`npm run format:check`、`npm run build` 全绿;ui.md 相应回写。

## 验收记录

2026-09-23 开发验收及用户审查通过。

- 提示按分牌＞加倍＞投降显示至多一条，复用既有字典并固定占位；保留按钮title，提示不参与Tab序。
- Chrome file://生产产物以固定存档验证390／320px×中英，共46项通过；覆盖优先级、要牌／分牌后更新、按钮零移位、无横向溢出和不可聚焦。
- 自动检查：Vitest 64/64、typecheck、format:check、build通过；UI快照已回写。
