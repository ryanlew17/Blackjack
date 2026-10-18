# 架构

> 适用范围：技术选型、分层边界、目录结构、构建与部署。
> 何时读取：新建/移动模块、调整构建或部署方式前。
> 关联需求：REQ-2026-012（文件架构）、REQ-2026-013（图鉴数据）。
> 最后更新：2026-10-18
> 来源：2026-09-22 文档架构升级新建（原 AGENTS.md 与 README 结构章节整合）；2026-09-23 竞赛模式立项（ADR-003 三库结构）；2026-10-04 竞赛基线文档修订

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

经典规则引擎当前主要入口：`transition(state, command, random?, rules?)`（唯一状态推进）、`legalActions(state, rules?)`（可用命令）、`score(cards)`。另提供逐手结算、历史汇总等纯函数供内部复用与存档校验。界面层禁止绕过 `transition` 自算结果。

**双模式（文件边界已建立，玩法仍待实现，[ADR-004](./adr/ADR-004-contest-turns-and-shared-boundaries.md)）**：REQ-012 已将经典模块移入各层 `classic/`，只调整路径。`domain/contest/` 已有 REQ-013 图鉴数据；引擎和 AI 目录目前仅有职责说明。`domain/shared/` 待双方实际消费时才提取工具。竞赛拥有独立 Match/Game/Round/Turn、唯一数字牌、道具获取/效果、积分与 AI，以及独立 `transition`/`legalActions` 和规则快照，不经经典 rules 的 mode 分支。经典扑克 ID、A 点数、52 张牌堆包装、金额及下注测试助手不直接共享；泛型洗牌和随机接口可共享，牌面通过 presentation 适配器复用。

首页模式选择与竞赛基础界面随 S1 实现；S1–S2 固定标准难度，难度页随 S3 实现。竞赛用卡不换人，Hit/Stay 才结束 Turn；动画输入锁解除后依据权威行动方继续，不能沿用经典庄家自动补牌。S1 最小多卡原型先验证这一边界，详见 [roadmap.md](./roadmap.md)。

application 可共享事件调度、输入锁和取消机制，持久化由模式适配：经典保存完整对局，竞赛只提交内存对局与独立键的元进度，语言/音量等应用设置沿用现有信封。竞赛不持久化对局、历史或战绩，中断即放弃。元进度冲突处理独立于内存牌面恢复；两模式均先提交权威状态再渲染事件。

AI 与 UI 消费投影后的观察视图；真实隐藏牌、未公开道具和牌堆顺序留在规则引擎。策略动态评价合法行动与有限多卡组合，真实抽牌和搜索采样使用独立随机流。共享基础设施不得隐含“AI 可以读取完整状态”的权限。

## 3. 目录结构

```text
src/
  domain/
    classic/                 # 现有 game、testHelpers 与原有规则测试
    shared/                  # 预留职责说明；尚无共享规则实现
    contest/
      types.ts               # 难度、参与者与数字牌词汇
      immutable.ts           # 竞赛静态数据冻结工具
      trumps/                # ID、结构化定义、21 张实验候选卡及测试
      presets/               # 独立实验库存与 F1/P0 元数据
      codex/                 # 查询、进度更新、负载校验、公开入口与测试
      engine/                # S1 引擎文件职责预留
      ai/                    # S1/S2 策略与搜索职责预留
  application/
    classic/useGame.ts       # 原有权威状态、动画与存档协调，行为不变
    contest/                 # S1/S3 协调职责预留
    shared/                  # 未来事件调度提取边界
  infrastructure/
    classic/                 # 现有 save.ts 与测试；仍承载共享设置信封
    shared/audio.ts          # 原有音效实现，仅搬迁
    contest/                 # S3 元进度信封、存储与冲突处理预留
  presentation/
    App.tsx                  # 现有经典组装入口，未新增模式页面
    classic/                 # format、components/ 与 panels/
    shared/                  # Icon、Modal，多现有组件使用
    shell/                   # S1 模式入口职责预留
    contest/
      table/                 # S1/S2 牌桌职责预留
      difficulty/            # S3 难度页职责预留
      codex/                 # S4 图鉴页职责预留
      custom/                # S5 自定义页职责预留
    i18n.ts                  # 现有双语字典 + 图鉴候选文案
    styles.css               # 原有样式，未改动
  architecture.test.ts       # 导入解析、分层和研究表一致性检查
  main.tsx                   # 原有入口，未改动
public/                      # 静态资源
docs/contest-research/       # 纯研究资料，不独立登记需求
```

`node_modules/`、`dist/`、`output/` 为生成内容，已加入 `.gitignore`。测试与实现同目录，无独立测试树。

## 4. 构建与部署

- `npm run dev`：Vite 开发服，默认 `http://127.0.0.1:5173`（`--host 127.0.0.1` 已固定在脚本中）。
- `npm run build`：`tsc -b` 类型检查 + `vite build` → `dist/`（单文件产物：`vite-plugin-singlefile` 将 JS/CSS 内联进 `index.html`，仅 favicon 外置；`base: "./"` 保留）。
- 分发/部署：`dist/` 是单文件静态产物，`file://` 双击可直接运行（自 v0.1.1 起，见 [ADR-002](./adr/ADR-002-singlefile-release-build.md)）；也可上传任意静态 HTTP/HTTPS 主机的根目录或子目录。无客户端路由回退。
- 无 Service Worker，不保证离线重新打开。

## 5. 关键数据流（一次命令）

经典模式当前数据流：

```text
用户操作 → useGame.send(command)
  → transition(权威 state) 计算新状态与事件序列（不落地不动画）
  → persist：先写 localStorage（冲突即中止；存储失败提示导出但保留内存进度）
  → 无事件：直接 dispatch 终态；有事件：busy 锁定，按节奏逐步 dispatch 事件快照并播音效
  → 队列播完：解除 busy，dispatch 终态
```

权威状态先提交、动画只读快照——动画回调永不决定赔付（硬约束见根 `AGENTS.md`）。

竞赛规划数据流：用户/AI 命令 → 独立 transition 完成该命令及触发链 → 提交权威内存终态 → 必要的元进度提交 → 播放投影视图快照 → 按权威状态恢复当前方决策。元进度写入失败不回滚牌面与积分；PlayTrump 完成不代表 Turn 结束。经典存档格式与提交顺序不因这项规划改变。

## 6. 本次前置开发边界

REQ-012 文件架构与 REQ-013 图鉴数据分别完成验收并归档。本次只交付文件架构与图鉴纯数据系统，不提供竞赛 transition、AI、效果执行器、模式切换或图鉴页面。目录中的 README 是后续文件责任边界，不是已实现模块。

图鉴数据 API 见 [codex-data.md](./design/codex-data.md)。实验卡与预设明确标记不可玩，不能作为正式比赛默认值或生产存档准入名单。S3/S4 再接独立元进度存储；本次不增加浏览器写入。

按用户要求，本次不运行构建、不改版本、不发布；通过现有经典回归、图鉴测试、类型及格式检查，并对搬迁文件做除导入外的语法树等价检查。

## 7. S1 实施顺序（已登记，未实施）

S1 的 [REQ-014–020](./roadmap.md) 已进入 active。014 先收敛迁移后经典入口与正常构建兼容性，不接图鉴或竞赛 feature；015–019 才实现竞赛回合、赛制、协调、界面和测试原型。017 对手策略只是确定的 Hit/Stay 占位，020 最后固化无道具基线；S2 末项再开发组合 AI。

以上为待实施排期，不改变本文件第 3 节所述当前目录实现状态。本次纯文档登记不构建、不版本迭代、不发布；后续 014 的正常构建是其必需验收，不能沿用前置批次的免构建约定。

REQ-014 实施分支为 main，目标发布 0.1.4，仅架构迁移且图鉴不生效；REQ-015 起从该发布基线新建竞赛开发分支，进入 0.2.x 版本线。当前仅补充并提交文档，不实际构建、修改版本或发布。
