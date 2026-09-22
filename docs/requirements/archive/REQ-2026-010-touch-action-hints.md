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

- 2026-09-23,Kimi 开发并验收(用户审查通过):通过,于 `bug-fix` 分支交付(版本号不变、未新增 release)。
- 实现:ControlDeck 玩家动作区下方新增 `.action-hint` 提示行——仅当 `can(action)` 为真显示,优先级 分牌 > 加倍 > 投降,至多一条,文案复用 i18n 现有 helpSplit / helpDouble / helpSurrender(零新增文案);固定占位高度,纯 `<p>` 不参与 Tab 序;按钮 `title` 悬浮保留为桌面 hover 增强。
- 浏览器验收(Chrome 经 Playwright 驱动,file:// 生产产物,真实固定存档夹具):390/320 × 中英共 46 项断言全过——对子首行动显示分牌提示、非对子显示加倍、余额不足落为投降、要牌后(19 点)提示消失;已分牌夹具(acc-split-mid)实测提示从分牌正确让位为加倍;四种提示状态下按钮行 boundingBox 逐一相等(零移位);320px 中英 scrollWidth ≤ 320;提示行 tabIndex -1 且无可聚焦后代;三按钮 title 与 help 文案逐一相等。
- 自动门槛:Vitest 64/64、typecheck、format:check、build 全绿;ui.md §2 已回写。

## 变更记录

- 2026-09-22 创建并登记索引
- 2026-09-23 完成验收并归档
