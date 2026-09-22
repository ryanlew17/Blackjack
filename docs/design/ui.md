# design/ui — 界面行为快照

> 适用范围：`src/presentation/` 当前实现的界面行为——组件结构、i18n、响应式、动效与音效约定。
> 何时读取：改任何组件、样式、用户可见文案前。
> 关联需求：[REQ-2026-001](../requirements/archive/REQ-2026-001-reset-panel-cancel.md)
> 关联需求：[REQ-2026-007](../requirements/archive/REQ-2026-007-about-panel.md)
> 关联需求：[REQ-2026-009](../requirements/archive/REQ-2026-009-css-patch-consolidation.md)
> 关联需求：[REQ-2026-010](../requirements/archive/REQ-2026-010-touch-action-hints.md)
> 关联需求：[REQ-2026-011](../requirements/archive/REQ-2026-011-interaction-semantics.md)
> 最后更新：2026-09-23
> 来源：2026-09-22 重构定稿（App.tsx 拆分为 components/）

## 1. 组件结构

```text
App.tsx                     # 组装层：useGame 接线、面板开关（panel state）、键盘快捷键
  GameTable.tsx             # 桌面区：庄家/玩家手牌、筹码、计分（score 单次计算后分发）
  ControlDeck.tsx           # 控制区：下注筹码、操作按钮（合法性来自 legalActions）
  Modal.tsx                 # 原生弹层：焦点限制、Esc 关闭
    panels/RulesPanel.tsx   # 规则说明
    panels/SettingsPanel.tsx# 语言/音效/音量/动效
    panels/AboutPanel.tsx  # 设置内关于二级视图（复用 Modal）
    panels/SavesPanel.tsx   # 导出/导入（导入预览与确认）
    panels/HistoryPanel.tsx # 最近 30 局
    panels/ResetPanel.tsx   # 重新开始确认
  Card.tsx / Chip.tsx / Icon.tsx  # 内联 SVG 叶子组件
  format.ts                 # 金额（千分位、半筹码）、牌面等展示格式化
  i18n.ts                   # 中英文字典
```

## 2. 多手牌局与保险界面

- GameTable 同时展示两手，标注当前手、逐手下注、状态与结果；保险阶段与玩家回合均隐藏庄家暗牌。
- ControlDeck 在保险阶段显示固定保费、净赔说明、购买/放弃按钮及余额不足提示；其余玩家动作来自 legalActions。保险结果独立展示。
- HistoryPanel 每局一条，包含每手下注/结果/净收益、保险明细及整局总净收益。mixed 不覆盖逐手输赢。
- 规则面板与中英文结果文案覆盖保险、投降与旧档版本提示。按钮通过原生 Tab/Enter/Space 操作；不新增自定义快捷键。
- 玩家动作按钮区下方有动作提示行：仅当对应动作可用时显示（优先级 分牌 > 加倍 > 投降，同一时刻至多一条），文案复用 i18n 现有 helpSplit / helpDouble / helpSurrender；提示行预留固定高度，出现/消失不移位按钮行，不含可聚焦元素、不参与 Tab 序。桌面端按钮的 `title` 悬浮说明保留为 hover 增强。
- 牌桌增高以容纳状态标签；移动端双列手牌与可换行操作按钮，320px 中英文无横向溢出。

## 3. 硬约定

- **i18n**：所有用户可见字符串必须加入 `i18n.ts` 的英文与中文**两个字典**，禁止硬编码文案；默认语言取浏览器，手动选择持久化。
- **面板关闭统一走 `closePanel()`**（同时清空导入待确认快照），不得直接 `setPanel(null)`。
- **样式集中在 `styles.css`**，无 CSS 框架；布局必须保证 **320px 宽度无横向溢出**，桌面与移动视口均需验收。
- **样式补丁只留最终值**：同一属性的响应式补丁只保留最终生效值，禁止叠加旧值；每个断点单一媒体块，且媒体查询覆盖必须排在被覆盖的基础规则之后（同特异性按源序生效，源序颠倒会静默丢失覆盖——REQ-2026-009 实测教训）。
- **`.table-meta` 的 `z-index: 1` 不得移除**：`.dealer-zone` 是 `top: 30px` 的绝对定位层，缺少该层级会遮挡历史按钮使其无法点击（2026-09-22 浏览器实测确认的存量修复，无视觉变化）。
- 动效：遵循系统/用户减少动态效果设置（设置项 `motion`）；动画只读事件快照，不回写状态（见 `state-and-animation.md`）。
- 音效：Web Audio 合成，首次用户交互时 `unlockAudio()` 解锁；遵循静音与音量设置，无音频资源文件。
- 键盘操作：按钮使用原生 Tab/Enter/Space；弹层 Esc 关闭、焦点限制在弹层内。品牌区为非交互元素（`div`，无 href/onClick/aria-label），Tab 序首停为顶栏「Table rules」（≤760px 该链接隐藏，首停为静音开关）。

## 4. 设置与关于

设置内的「关于」按钮可由 Tab 聚焦并 Enter / Space 激活，在同一 Modal 内切换到关于视图，标题同步更新。关于页将焦点移至「返回设置」按钮；返回设置后焦点对称地落回「关于」入口按钮（Enter 可再次进入），关闭再打开也回到设置首页。Esc、关闭按钮和背景关闭均由 App 的 `closePanel()` 处理。

存档面板在存档版本不受支持（version）或内容损坏（corrupt）时不显示导出按钮与存档摘要——该状态下内存快照是全新占位档，导出会误导玩家覆盖真实备份；导入入口保持可用。存储不可用（storage）时导出保留，作为设计上的逃生通道。

关于页显示 package.json 的当前发布版本（Vite 构建时注入 `__APP_VERSION__`）、项目仓库、MIT 许可与 GitHub Issues 反馈说明。三个外部链接均新标签页打开且设置 `rel="noopener"`。文案完整进入双语字典，长仓库地址允许换行，320px 无横向溢出；无网络版本探测或遥测。
