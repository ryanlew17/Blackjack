# Blackjack — The Green Room

[English](./README.md) | **简体中文**

一款基于 **React + TypeScript + Vite** 的本地优先单人 Web Blackjack 游戏。绿色绒面牌桌、纸牌与筹码动画、可选音效，适配桌面和手机屏幕。所有下注均使用虚拟筹码。

[产品需求](./docs/prd.md) · [架构](./docs/architecture.md) · [模块设计快照](./docs/design/) · [存档格式](./docs/contracts/save-format.md) · [测试与验收](./docs/testing.md) · [贡献指南](./AGENTS.md)

## 功能特性

- **经典玩法**：要牌、停牌、加倍、撤销或清空下注、全押。
- **响应式 2D 牌桌**：自有 SVG 纸牌与筹码、Motion 动画、键盘操作和减少动态效果支持。
- **双语界面**：英文与简体中文，自动识别浏览器语言并保存手动选择。
- **可选音效**：合成发牌和筹码声音，支持音量调节与静音。
- **自动续局**：刷新后恢复当前决策点或已完成的结算结果，动画中刷新也能恢复。
- **便携存档**：导出 JSON 备份，在其他设备导入；先校验，再确认替换。
- **本地保护**：跨标签页修改时暂停操作；浏览器存储不可用时继续游戏并提示导出。
- **关于项目**：设置 → 关于，查看当前版本、项目仓库、MIT 许可及 GitHub Issues 反馈入口。

## 技术栈

| 领域       | 工具                                                     |
| ---------- | -------------------------------------------------------- |
| 界面       | React 19、严格模式 TypeScript                            |
| 构建       | Vite 6、npm 锁文件、vite-plugin-singlefile（单文件产物） |
| 展示       | Motion、CSS、内联 SVG、Web Audio                         |
| 状态与存储 | React reducer、纯规则引擎、localStorage                  |
| 质量检查   | Vitest、Prettier、Playwright CLI 浏览器验收              |

## 快速开始

**只想玩游戏？** 下载最新的 Release 构建包，解压后双击 `index.html` 即可——无需 Node.js 或本地服务器（自 v0.1.1 起；v0.1.0 发布包双击白屏，见 [ADR-002](./docs/adr/ADR-002-singlefile-release-build.md)）。

**从源码运行**需要 **Node.js 22.12+** 和 npm。

**Windows** —— 双击 `start-game.bat`。

**macOS** —— 双击 `start-game.command`
（首次若被 Gatekeeper 拦截：右键 → 打开；或在终端执行 `bash start-game.command`）。

**Linux** —— 终端执行 `bash start-game.command`
（或先赋予可执行权限，再在文件管理器中双击“在终端中运行”）。

启动脚本会检查 Node.js 环境，首次运行自动安装依赖，随后在
`http://127.0.0.1:5173` 启动游戏服务器并自动打开浏览器。也可以随时在终端手动执行：

```bash
npm ci
npm run dev
```

```bash
npm test              # 规则与存档校验测试
npm run typecheck     # 严格 TypeScript 类型检查
npm run format        # 格式化源码、文档与配置
npm run format:check  # 只检查格式，不修改文件
npm run build         # 类型检查并生成 dist/
npm run preview       # 预览 dist/，默认端口为 4173
```

## 目录结构

```text
src/
  domain/             # 纯规则、命令、事件，以及同目录的 *.test.ts
  application/        # 状态协调、动画队列与存档生命周期
  presentation/       # React 界面（components/、format、i18n、styles）
  infrastructure/     # 存档校验、浏览器存储、音效与测试
  main.tsx            # 应用入口
public/               # 网站图标等静态资源
docs/                 # prd、architecture、design/、contracts/、requirements/、adr/、roadmap、testing
start-game.bat        # Windows 启动脚本（环境检查、首装依赖、启动并打开浏览器）
start-game.command    # macOS / Linux 启动脚本
AGENTS.md             # 贡献指南（上下文路由 + 硬约束）
LICENSE               # MIT 许可证
README.md             # 英文项目说明
README.zh-CN.md       # 简体中文项目说明
index.html            # Vite HTML 入口
package.json          # 依赖与开发命令
package-lock.json     # 可复现的 npm 依赖版本
tsconfig.json         # 严格 TypeScript 配置
vite.config.ts        # React 插件 + 单文件内联（vite-plugin-singlefile），base "./"
```

`node_modules/`、`dist/`、`output/` 为生成内容，已加入忽略规则。测试与实现放在同一目录，无需额外维护重复的测试目录或运行器。

引擎先提交权威游戏状态，再播放展示队列；动画回调不负责扣款和结算。金额使用整数百分之一筹码表示。

## 牌桌规则

- 初始资金为 **2,000 虚拟筹码**，每局重新洗一副 52 张牌。
- 人头牌为 10 点，A 可作 1 点或 11 点；电脑固定为庄家。
- 开局检查天然 Blackjack；庄家明牌 A 时先完成保险选择。双方天然则平局。
- 天然 Blackjack **净赔 3:2**，普通获胜**净赔 1:1**，平局返还下注。
- 普通 21 点自动结束玩家行动，但不保证获胜。庄家所有 17 点均停牌，包括软 17。
- 仅初始两张牌且余额足够时可加倍：追加同额下注，补一张牌后停牌。
- 以整筹码下注，余额可含半筹码；全押保留无法下注的半筹码。

分牌、保险和晚投降已实现并通过独立最终验收（2026-09-22）：

- 初始同点值牌可分为最多两手；不可再分。分 A 各补一张后停牌且不可加倍；其他分牌可加倍，分牌 21 点不算天然。
- 庄家明牌 A 时先选择保险，再检查天然。保费为原注一半，天然时保险净赔 2:1，主注独立结算。
- 排除庄家天然后，未分牌且未要牌/加倍的初始手可晚投降，返还主注一半；保险损失不退还。
- 存档和规则版本升级为 v2，拒绝 v1 和未知版本且不迁移；旧自动存档不会静默覆盖，须明确确认重新开始或导入有效 v2 存档。

## 存档与隐私

进度和偏好仅保存在当前浏览器。清理站点数据会删除自动存档，请通过 `.blackjack.json` 文件单独备份。存档是未加密、可编辑的单机数据，不提供防作弊能力。项目不包含账号、遥测、广告或后端。

## 部署

执行 `npm run build` 生成**单文件 `dist/`**（全部 JavaScript 与 CSS 内联进 `index.html`）。产物可直接分发：双击 `index.html` 即可在 Chrome、Edge、Firefox、Safari 中经 `file://` 运行；同一目录也可上传到任意静态 HTTP/HTTPS 服务器的根目录或子目录，无需客户端路由回退配置。

项目没有 Service Worker，不保证离线重新打开。浏览器验收覆盖与已知边界见[测试与验收](./docs/testing.md)。

## 路线图

分牌、保险和晚投降已完成实现与独立最终验收（REQ-2026-003–006，已归档）。详见 [技术路线图](./docs/roadmap.md) 与 [需求索引](./docs/requirements/index.md)。

1. M0：登记需求并统一规划文档。
2. M1：规则 v2 共用状态、结算与存档校验基础。
3. M2：最多两手的分牌、行动轮转与独立结算。
4. M3：庄家天然检查前的保险决策与独立赔付。
5. M4：晚投降、集成验收与规则/存档 v2 统一发布。

里程碑不承诺日历日期；M1–M3 是开发检查点，不单独发布。v2 拒绝 v1 与未知版本存档，不提供迁移；旧自动存档不得静默覆盖，重新开始须由用户明确选择。

局域网双人、多副牌、线上部署及账号/云存档仍为未排期候选；云端和多人功能须独立评审架构。

贡献前请阅读 [AGENTS.md](./AGENTS.md)。调整行为或启动命令时，请同步更新中英文说明。

## 许可证

基于 [MIT 许可证](./LICENSE) 开源。
