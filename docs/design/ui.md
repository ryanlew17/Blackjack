# design/ui — 界面行为快照

> 适用范围：`src/presentation/` 当前实现的界面行为——组件结构、i18n、响应式、动效与音效约定。
> 何时读取：改任何组件、样式、用户可见文案前。
> 关联需求：[REQ-2026-001](../requirements/active/REQ-2026-001-reset-panel-cancel.md)
> 最后更新：2026-09-22
> 来源：2026-09-22 重构定稿（App.tsx 拆分为 components/）

## 1. 组件结构

```text
App.tsx                     # 组装层：useGame 接线、面板开关（panel state）、键盘快捷键
  GameTable.tsx             # 桌面区：庄家/玩家手牌、筹码、计分（score 单次计算后分发）
  ControlDeck.tsx           # 控制区：下注筹码、操作按钮（合法性来自 legalActions）
  Modal.tsx                 # 原生弹层：焦点限制、Esc 关闭
    panels/RulesPanel.tsx   # 规则说明
    panels/SettingsPanel.tsx# 语言/音效/音量/动效
    panels/SavesPanel.tsx   # 导出/导入（导入预览与确认）
    panels/HistoryPanel.tsx # 最近 30 局
    panels/ResetPanel.tsx   # 重新开始确认
  Card.tsx / Chip.tsx / Icon.tsx  # 内联 SVG 叶子组件
  format.ts                 # 金额（千分位、半筹码）、牌面等展示格式化
  i18n.ts                   # 中英文字典
```

## 2. 硬约定

- **i18n**：所有用户可见字符串必须加入 `i18n.ts` 的英文与中文**两个字典**，禁止硬编码文案；默认语言取浏览器，手动选择持久化。
- **面板关闭统一走 `closePanel()`**（同时清空导入待确认快照），不得直接 `setPanel(null)`——目前 ResetPanel 存在一处例外，见 REQ-2026-001。
- **样式集中在 `styles.css`**，无 CSS 框架；布局必须保证 **320px 宽度无横向溢出**，桌面与移动视口均需验收。
- **`.table-meta` 的 `z-index: 1` 不得移除**：`.dealer-zone` 是 `top: 30px` 的绝对定位层，缺少该层级会遮挡历史按钮使其无法点击（2026-09-22 浏览器实测确认的存量修复，无视觉变化）。
- 动效：遵循系统/用户减少动态效果设置（设置项 `motion`）；动画只读事件快照，不回写状态（见 `state-and-animation.md`）。
- 音效：Web Audio 合成，首次用户交互时 `unlockAudio()` 解锁；遵循静音与音量设置，无音频资源文件。
- 键盘操作：下注/发牌/要牌/停牌等均有快捷键（见界面内规则面板），弹层 Esc 关闭、焦点限制在弹层内。
