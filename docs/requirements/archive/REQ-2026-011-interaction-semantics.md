# REQ-2026-011: 交互语义修缮(品牌区非交互、旧档导出入口、关于返回焦点)

状态: done
来源: 用户(2026-09-22 第三方 UX 审查确认)
关联设计: docs/design/ui.md(§2 键盘操作、§4 设置与关于回写)
影响模块: src/presentation/(App、SavesPanel、SettingsPanel/AboutPanel、styles.css)
非目标: 不改 parseSave 的版本拒绝逻辑(硬约束:不支持版本必须明确拒绝、不可猜测);不改 closePanel 生命周期与弹层机制;`problem === "storage"` 时的导出保留(存储不可用时的设计逃生通道);不新增任何用户可见文案

## 背景

第三方 UX 审查(2026-09-22)确认三项"本不可交互却被设计为可交互 / 焦点断层"问题:

1. 品牌区为 `<a href="#">` 且 `preventDefault`(src/presentation/App.tsx):无任何行为,读屏播报为链接并占用 Tab 首停,误导可交互预期。
2. `problem ∈ {version, corrupt}` 时存档面板仍可导出:该状态下内存快照是全新占位档,实测导出文件为 balance 2000 / round 0 的空档;在通知栏"请导入 v2 备份"的语境下,玩家极可能误以为导出的是原进度。
3. 焦点断层:进入关于页时焦点显式移至「返回设置」(AboutPanel),但返回设置后原聚焦元素卸载,焦点丢失到 `document.body`(实测确认),键盘与读屏用户失去位置;与进入时的对称处理缺失。

## 方案要点

1. 品牌区改为非交互元素(如 `div`),移除 `href` / `onClick` / `aria-label`;Tab 序首停变为顶栏「Table rules」按钮。
2. App 将当前 `problem` 传入 SavesPanel;`problem === "version" || "corrupt"` 时隐藏导出按钮与存档摘要(save-summary),导入入口与通知栏「新游戏」保持可达;storage 与正常态展示不变。不新增文案。
3. 返回设置后聚焦「关于」入口按钮,与进入关于页时聚焦「返回设置」对称;Esc、关闭按钮、背景关闭仍统一走 `closePanel()`。

## 验收标准

- 品牌区不可键盘聚焦,读屏不再播报为链接;Tab 序从「Table rules」开始。
- version / corrupt 态打开存档面板:无导出入口、无空档摘要,导入文件入口可用;storage 态导出仍可用;正常态面板与 v0.1.2 行为一致。
- 键盘走查:设置 → 关于 → 返回设置,焦点落在「关于」入口且 Enter 可再次进入关于;Esc / 关闭按钮 / 背景关闭后行为不变。
- 320px 中英文回归无横向溢出;`npm test`、`npm run typecheck`、`npm run format:check`、`npm run build` 全绿;ui.md §2/§4 回写。

## 验收记录

- 2026-09-23,Kimi 开发并验收(用户审查通过):通过,于 `bug-fix` 分支交付(版本号不变、未新增 release)。
- 品牌区:App.tsx 的 `<a href="#">` 改为非交互 `div`(移除 href / onClick / aria-label);实测 1280px 视口 Tab 首停为「Table rules」,390px 视口(规则链接隐藏)首停为静音开关,品牌区不再占用 Tab 序、不再被播报为链接(中/英均验)。
- 旧档导出收口:App 将 `problem` 传入 SavesPanel;version(acc-legacy-v1 夹具)/ corrupt(acc-corrupt 夹具)态下面板无导出按钮、无 `.save-summary`,导入入口可用(中/英均验;被拒旧档按设计以默认 en 设置启动,中文用例先在设置内内存切换语言);storage 态导出与摘要保留(逃生通道),正常态与 v0.1.2 一致。
- 焦点对称(中/英均验):设置 → 关于,焦点在「返回设置」;返回后焦点对称落回「关于」入口按钮,Enter 可再次进入;Esc 关闭行为不变。
- 自动门槛:Vitest 64/64、typecheck、format:check、build 全绿;ui.md §3(键盘/品牌区)与 §4(焦点对称、旧档导出收口)已回写。

## 变更记录

- 2026-09-22 创建并登记索引(旧档导出按用户决定直接移除界面入口;版本校验保留)
- 2026-09-23 完成验收并归档
