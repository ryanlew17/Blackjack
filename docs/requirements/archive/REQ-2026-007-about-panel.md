# REQ-2026-007: 设置面板新增「关于」页

状态: done
发布版本: v0.1.2
来源: 用户（2026-09-22 首次发布后新增）
关联设计: docs/design/ui.md（受影响的快照；落地后回写）
影响模块: src/presentation/
非目标: 不改动对局规则与存档格式；不新增任何用户数据收集或遥测；不新增检查更新/远程版本探测

## 背景

v0.1.0 首次发布后，玩家在游戏内无法获知项目仓库地址、当前版本号与开源许可信息，也没有内置的反馈入口。设置面板需要新增「关于」栏，点击进入二级页面集中展示项目信息并引导玩家反馈；置于设置内对主界面侵入性最小。

## 方案要点

- 设置面板（SettingsPanel）新增「关于」入口行，可键盘聚焦；点击进入关于二级视图，页内提供返回设置的路径。复用现有面板容器做视图切换，不新增弹层层级；Esc / 关闭按钮仍统一走 `closePanel()`。
- 「关于」页内容：
  - 项目仓库地址：`https://github.com/ryanlew17/Blackjack`，超链接可点击（新标签页打开，`rel="noopener"`）；
  - 版本号：取 `package.json` 的 `version` 构建时注入（本次 0.1.2，随发布迭代），不在代码中硬编码第二个版本来源；
  - 开源声明：MIT License，附许可文本链接（仓库 `LICENSE` 文件）；
  - 反馈提示信息与反馈地址：说明欢迎通过 GitHub Issues 反馈问题与建议，超链接跳转 `https://github.com/ryanlew17/Blackjack/issues`（新标签页打开）。
- 所有新增用户可见文案进 `i18n.ts` 英文与中文两个字典，禁止硬编码。
- 页面在 320px 宽度无横向溢出。

## 验收标准

- 设置面板出现「关于」入口（可键盘聚焦）；点击进入关于页，返回设置路径可用；Esc / 关闭按钮关闭面板仍走 `closePanel()`，其他面板行为不受影响。
- 仓库地址、LICENSE、Issues 三个链接均为可点击超链接（新标签页打开，`rel="noopener"`）。
- 页面显示当前版本号（与 `package.json` 一致）与 MIT 开源声明。
- 中英文案完整无硬编码；320px 宽度无横向溢出。
- `npm test`、`npm run typecheck`、`npm run format:check` 通过；UI 改动按 `docs/testing.md` 走浏览器走查。

## 验收记录

- 2026-09-22 验收：通过，随 v0.1.2 交付。
- 自动门槛：Vitest 63/63、严格 TypeScript、Prettier、生产构建通过。
- Chrome（Playwright CLI，生产 preview）：Tab 聚焦关于入口并 Enter 打开；同一 dialog 内切换标题与内容，返回设置、中英文切换、Esc / 关闭、重开恢复设置首页均通过。代码复核关闭仍统一调用 `closePanel()`。
- 三个链接的完整目标地址、`target="_blank"` 与 `rel="noopener"` 已断言；显示版本 0.1.2 与 package.json 一致。Vite 从 package.json 注入版本，不维护第二份版本常量。
- 桌面与 320px 中英文截图人工复核通过；页面及关于内容 scrollWidth 均不超出可用宽度。证据：`output/playwright/req007-desktop.png`、`req007-320-en.png`、`req007-320-zh.png`。
- 实际发布包 `The-Green-Room-v0.1.2.zip` 解压到干净临时目录，通过 Chrome `file://` 打开，关于页版本正确，下注与发牌可用，控制台及页面错误均为 0；截图 `output/playwright/req007-file.png`。
- 本次浏览器验收仅覆盖 Chrome；未重跑其他引擎或完整规则 v2 浏览器矩阵。游戏规则与存档格式未改动。

## 变更记录

- 2026-09-22 创建并登记索引
- 2026-09-22 入口方案定为设置面板内二级页（about dialog 右上角弹窗方案作废），以最新需求为准

- 2026-09-22 完成关于二级页、构建版本注入与双语文案；回写 UI 快照、双语 README、测试历史与路线图，验收后归档。
- 2026-09-22 修复设置列表文字错位与行高不一：「关于」入口与「新游戏」按钮继承了 UA 按钮默认内边距（1px 6px）导致行文字右偏，补 `padding: 0` 与 `text-align: left`；「关于」行行高由 64px 统一为与设置行一致的 75px。修复随 v0.1.2 发布包替换上线，不迭代版本号。
