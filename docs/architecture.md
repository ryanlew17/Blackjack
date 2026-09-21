# 架构

> 适用范围：技术选型、分层边界、目录结构、构建与部署。
> 何时读取：新建/移动模块、调整构建或部署方式前。
> 关联需求：无。
> 最后更新：2026-09-22
> 来源：2026-09-22 文档架构升级新建（原 AGENTS.md 与 README 结构章节整合）

## 1. 技术栈

| 领域       | 工具                                                          |
| ---------- | ------------------------------------------------------------- |
| 界面       | React 19、严格模式 TypeScript                                 |
| 构建       | Vite 6、npm 锁文件（Node.js ≥ 22.12）                         |
| 展示       | Motion（动画）、CSS、内联 SVG、Web Audio                      |
| 状态与存储 | React reducer + ref 权威状态、纯规则引擎、localStorage        |
| 质量检查   | Vitest（同目录 `*.test.ts`）、Prettier、Playwright 浏览器验收 |

无路由、无后端、无状态管理库；除 `motion` 外运行时依赖只有 React。

## 2. 分层与依赖方向（严格）

```text
presentation/  ──▶  application/  ──▶  domain/
      │                  │
      └──────▶  infrastructure/  ◀─────┘
```

- `domain/`：**纯 TypeScript**，不 import React 与浏览器 API，可注入随机源确定性测试。
- `application/`：`useGame` 协调权威状态、动画队列与持久化；不渲染。
- `presentation/`：React 组件、样式、i18n 字典；不直接写 localStorage、不含规则判断。
- `infrastructure/`：存档校验与读写、Web Audio；不依赖 React。

规则引擎 API 只有三个入口：`transition(state, command, random?, rules?)`（唯一状态推进）、`legalActions(state)`（可用命令）、`score(cards)`。界面层禁止绕过 `transition` 自算结果。

## 3. 目录结构

```text
src/
  domain/             # 纯规则、命令、事件，同目录 *.test.ts 与确定性测试助手
  application/        # useGame：状态协调、动画队列、存档生命周期
  presentation/
    components/       # Icon/Card/Chip/Modal/GameTable/ControlDeck 与 panels/ 五个面板
    format.ts         # 金额、牌面等展示格式化
    i18n.ts           # 中英文字典（所有用户可见字符串）
    styles.css        # 全部样式（无 CSS 框架）
    App.tsx           # 组装层：面板开关、命令接线
  infrastructure/     # save.ts（校验/读写）与 audio.ts，同目录 *.test.ts
  main.tsx            # 入口
public/               # favicon 等静态资源
docs/                 # prd / architecture / design / contracts / requirements / adr / roadmap / testing
start-game.bat        # Windows 双击启动（纯 ASCII + CRLF，勿用 Prettier 格式化）
start-game.command    # macOS / Linux 启动脚本
```

`node_modules/`、`dist/`、`output/` 为生成内容，已加入 `.gitignore`。测试与实现同目录，无独立测试树。

## 4. 构建与部署

- `npm run dev`：Vite 开发服，默认 `http://127.0.0.1:5173`（`--host 127.0.0.1` 已固定在脚本中）。
- `npm run build`：`tsc -b` 类型检查 + `vite build` → `dist/`。
- 部署：仅上传 `dist/` **内容**到静态 HTTP/HTTPS 主机；`vite.config.ts` 使用相对资源路径（`base: "./"`），支持根目录或子目录，无客户端路由回退。不要以 `file://` 打开。
- 无 Service Worker，不保证离线重新打开。

## 5. 关键数据流（一帧命令）

```text
用户操作 → useGame.send(command)
  → transition(权威 state) 计算新状态与事件序列（不落地不动画）
  → persist：先写 localStorage（冲突/失败即中止，界面不变）
  → 无事件：直接 dispatch 终态；有事件：busy 锁定，按节奏逐步 dispatch 事件快照并播音效
  → 队列播完：解除 busy，dispatch 终态
```

权威状态先提交、动画只读快照——动画回调永不决定赔付（硬约束见根 `AGENTS.md`）。
