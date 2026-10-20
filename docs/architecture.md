# 架构

> 适用范围：技术选型、分层边界、目录结构、构建与部署。
> 何时读取：新建/移动模块、调整构建或部署方式前。
> 关联需求：REQ-2026-012（文件架构）、REQ-2026-013（图鉴数据）、REQ-2026-014（经典构建兼容）、REQ-2026-015（单回合引擎）、REQ-2026-016（积分与比赛生命周期）、REQ-2026-017（竞赛应用协调）、REQ-2026-018（模式入口与基础界面）、REQ-2026-019（多卡原型与体验修整）。
> 最后更新：2026-10-21
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

**双模式（已接经典与标准无道具竞赛，[ADR-004](./adr/ADR-004-contest-turns-and-shared-boundaries.md)）**：REQ-012 已将经典模块移入各层 `classic/`，只调整路径。`domain/contest/` 已有 REQ-013 图鉴数据；REQ-015/016 已实现独立单回合、标准无道具 BO5、积分与信息投影，REQ-020 已在 AI 目录实现独立无道具基线。`domain/shared/` 待双方实际消费时才提取工具。竞赛拥有独立 Match/Game/Round/Turn、唯一数字牌、道具获取/效果、积分与 AI，以及独立 `transition`/`legalActions` 和规则快照，不经经典 rules 的 mode 分支。经典扑克 ID、A 点数、52 张牌堆包装、金额及下注测试助手不直接共享；泛型洗牌和随机接口可共享，牌面通过 presentation 适配器复用。

REQ-018 已接首页模式选择与竞赛基础界面，已通过用户页面测试；S1–S2 固定标准难度，难度页随 S3 实现。竞赛用卡不换人，Hit/Stay 才结束 Turn；动画输入锁解除后依据权威行动方继续，不能沿用经典庄家自动补牌。S1 最小多卡原型先验证这一边界，详见 [roadmap.md](./roadmap.md)。

application 可共享事件调度、输入锁和取消机制，持久化由模式适配：经典保存完整对局，竞赛只提交内存对局与独立键的元进度，语言/音量等应用设置沿用现有信封。竞赛不持久化对局、历史或战绩，中断即放弃。元进度冲突处理独立于内存牌面恢复；两模式均先提交权威状态再渲染事件。

AI 与 UI 消费投影后的观察视图；真实隐藏牌、未公开道具和牌堆顺序留在规则引擎。S1 策略只做确定的 Hit／Stay 阈值判断且没有随机端口；动态评价和有限多卡搜索留待 S2 末项，届时真实抽牌和搜索采样仍须使用独立随机流。共享基础设施不得隐含“AI 可以读取完整状态”的权限。

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
      engine/                # 回合／BO5、有限效果、投影；prototype 固定定义隔离
      ai/                    # S1 无道具基线；S2 搜索待实现
  application/
    classic/useGame.ts       # 原有权威状态、动画与存档协调，行为不变
    contest/                 # coordinator、生产 controller、useContest 及策略适配测试
    shared/                  # 未来事件调度提取边界
  infrastructure/
    classic/                 # 现有 save.ts 与测试；仍承载共享设置信封
    shared/audio.ts          # 原有音效实现，仅搬迁
    contest/                 # S3 元进度信封、存储与冲突处理预留
  presentation/
    App.tsx                  # 首页／经典／竞赛组装与统一弹层
    classic/                 # format、components/ 与 panels/
    shared/                  # Icon、Modal，多现有组件使用
    shell/                   # REQ-018 首页模式入口
    contest/
      table/                 # REQ-018 投影数字牌桌、操作、结果与规则
      difficulty/            # S3 难度页职责预留
      codex/                 # S4 图鉴页职责预留
      custom/                # S5 自定义页职责预留
    i18n.ts                  # 现有双语字典 + 图鉴候选文案
    styles.css               # 经典／首页／竞赛响应式样式
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

竞赛已实现数据流（REQ-017；元进度端口仍待后续实现）：用户/AI 命令 → 独立 transition 完成该命令及触发链 → 提交权威内存终态 → 必要的元进度提交 → 播放投影视图快照 → 按权威状态恢复当前方决策。元进度写入失败不回滚牌面与积分；PlayTrump 完成不代表 Turn 结束。经典存档格式与提交顺序不因这项规划改变。

## 6. 本次前置开发边界

REQ-012 文件架构与 REQ-013 图鉴数据分别完成验收并归档。本次只交付文件架构与图鉴纯数据系统，不提供竞赛 transition、AI、效果执行器、模式切换或图鉴页面。目录中的 README 是后续文件责任边界，不是已实现模块。

图鉴数据 API 见 [codex-data.md](./design/codex-data.md)。实验卡与预设明确标记不可玩，不能作为正式比赛默认值或生产存档准入名单。S3/S4 再接独立元进度存储；本次不增加浏览器写入。

REQ-012/013 前置批次按用户要求未运行构建、未改版本、未发布；通过现有经典回归、图鉴测试、类型及格式检查，并对搬迁文件做除导入外的语法树等价检查。该历史豁免不延续至 REQ-014。

## 7. S1 实施顺序与经典兼容验证

S1 的 [REQ-014–020](./roadmap.md) 已完成并归档，014/015 已独立验收归档，016/017 已自审验收归档，018 已通过用户页面测试并归档，019/020 已自审验收归档；S1 整体外部审查已完成，Codex 技术验收及用户最终验收通过，S1 周期已结束。014 先收敛迁移后经典入口与正常构建兼容性，不接图鉴或竞赛 feature；015–019 才实现竞赛回合、赛制、协调、界面和测试原型。017 对手策略只是确定的 Hit/Stay 占位，020 最后固化无道具基线；S2 末项再开发组合 AI。

REQ-014 已通过独立验收并归档，v0.1.4 已正式发布并完成上传资产回读复验。REQ-015 已在新分支实现单回合引擎并通过独立验收归档（2026-10-20）；REQ-016/017 已自审验收归档，018 已实现基础界面、通过用户页面测试并归档，019 已完成有限多卡原型与体验修整并归档，020 已收敛独立无道具 AI 并自审归档。当前任务检查节奏以 testing.md 为准。

REQ-014 实施分支为 main，目标发布 0.1.4，仅架构迁移且图鉴不生效；REQ-015 起从该发布基线新建竞赛开发分支，进入 0.2.x 版本线。REQ-014 已在 main 同步项目和锁文件版本 0.1.4，并取得独立验收绿灯；提交、tag 和 Release 证据归入需求发布记录。

## 8. REQ-014 生产入口历史边界（2026-10-18 独立验收通过）

REQ-014 验收时生产入口为 `main.tsx → App → classic`，实际 Vite 模块图仅包含 21 个 src 模块，未加载 domain/application/presentation 的 contest 模块。图鉴候选双语字符串仍静态存在于共享 i18n 中，未调用图鉴查询、进度、实验预设或竞赛存储。经典迁移路径已正确，本次没有再次调整产品模块。

`src/architecture.test.ts` 递归追踪真实入口的静态、再导出及字面量动态导入，当时阻止竞赛和测试助手接入；无法静态证明隔离的动态导入／glob 直接失败。正常生产构建仍使用 `base: "./"` 与 singlefile，分发包仍为 HTML、favicon 和 LICENSE。与正式 v0.1.3 的功能、视觉及三种运行路径对照证据见 [REQ-014](./requirements/archive/REQ-2026-014-classic-build-compatibility.md)；独立验收与实际发布资产核验均已通过，结果见同一归档需求。

## 9. REQ-015 单回合引擎（2026-10-20）

竞赛开发分支 `codex/contest-round-engine` 从发布后的 main 创建，项目与锁文件进入 0.2.0 开发版本，尚未发布。实现仅位于 `domain/contest/engine/`，未改 classic 或抽取 shared 工具，生产入口继续由既有架构测试约束为 classic-only。

`createRound` 接收先手和注入随机源；`transition` 返回权威终态及有序事件。状态保存冻结规则快照，`legalActions` 消费同一快照所在的观察视图；UI／策略后续只接 `RoundObservation` 和 `RoundEventView`，协调层保管完整状态。`projectRoundTransition` 显式重建每个事件和快照，禁止把完整事件直接透传。类型、牌堆、比较、规则快照、Turn 接缝与投影分文件维护，该阶段的 Match/Game 和积分由 REQ-016 承接，见下节。行为与接口见 [contest-rules.md](./design/contest-rules.md) 的已实现范围及引擎目录 README。

## 10. REQ-016 积分与比赛生命周期（2026-10-20）

`engine/match.ts` 在既有 Round 引擎上组合标准无道具 BO5，Match/Game 词汇与事件定义在 types.ts，计分在 scoring.ts，Round 清理边界在 lifecycle.ts，比赛投影在 matchObservation.ts。公开入口为 createMatch、transitionMatch、legalMatchActions、observeMatch 与事件投影；原 Round API 保留，未改 classic 或提取 shared。

每个完成的 Round 由 Match transition 消费一次，先积分与目标递延，再记胜局／胜场；结果和清理在返回前完成。Round/Game 结束时保留展示快照，由 NextRound 继续，只有新 Game 重置 Game 分数和目标。开场硬币只调用一次随机源，先手跨 Round/Game 轮换；同一规则快照贯穿全场。Round 清理重置目标与 Turn 临时字段，Game 清理事件标记未来道具资源的执行位置；当前显式关闭发放，没有空资源执行器。应用层后续负责输入锁和跨 Match 取消，不能从动画回调提交积分。

生产入口、经典规则／存档、设置信封、依赖与构建配置均未改变；无竞赛持久化或图鉴／通关调用。该纯领域任务按最新 testing.md 执行任务收尾检查，不单独构建或做浏览器验收。

## 11. REQ-017 应用协调（2026-10-20）

`application/contest/controller.ts` 私有持有 Match，通过 getSnapshot/subscribe 输出稳定视图；useContest 用 useSyncExternalStore 订阅，公开命令、控制方法和 human 观察，不暴露完整状态。一次命令先同步提交 transitionMatch 的结果，再逐帧回放 MatchEventView；定时回调只更新展示，恢复决策依据权威行动方。

占位策略位于 application/contest，只接 ai 观察和合法 Hit/Stay；正式策略收敛与 domain/contest/ai 留给 REQ-020。回放及思考等待用本地取消代次，开始／退出／重开、暂停与跳过动画不依赖存储。useContest 只读现有设置并复用 shared/audio，未改经典 useGame、存档、UI、生产入口、依赖或构建配置；application/shared 没有新消费者接口需要提取。

受控时间测试通过真实引擎完成 BO5，覆盖提交顺序、输入锁、投影、延迟任务取消与恢复。React 测试仅覆盖服务端闲置初始化，客户端挂载与浏览器事件随 REQ-018 接线验收，不宣称已取得浏览器证据。

## 12. REQ-018 模式入口与投影界面（2026-10-20，用户页面测试通过并归档）

生产入口现为 main → App → shell、classic 与 contest/table。App 组合 useGame 和 useContest，模式仅为 React 内存状态；经典 API 与设置信封复用，竞赛不读取或写入任何对局存档。presentation 只从 application 接收竞赛观察与动作，不调用 transition 或读取权威 Match。新页面无路由依赖或构建配置修改。shared/useSystemReducedMotion 统一订阅浏览器偏好，经典与竞赛都能响应页面打开期间的系统减少动态切换。

ModeSelect 提供经典／标准无道具 BO5 两个入口；ContestTable、NumberCard、ContestControls、ContestRules 分别承担投影展示、数字牌信息边界、应用动作和规则说明。SettingsPanel 仅新增可选重开按钮与文案参数，经典传参和行为保留。弹层打开暂停竞赛，取消恢复当前权威行动方，确认离场或重开取消旧代次回调。

architecture.test 继续递归验证真实生产入口，018 起允许已实现竞赛协调／引擎／牌桌，继续阻止 codex、presets、trumps、正式 ai、测试与 testHelpers 进入该入口；无运行时调试入口或原型夹具。隐藏信息另以双语 DOM 等价测试约束。REQ-014–017 的入口隔离记录为各自验收时点历史，不再代表当前入口。

## 13. REQ-019 多卡原型与页面体验修整（2026-10-20）

engine/effectTypes、effects 扩展已有 command／legalActions／transition／Match 清理边界，不复制第二套规则引擎。RoundRules 可包含冻结的公开效果定义，Match 私有保存固定每局初始手牌；Round 承载手牌、留场和弃置资源，观察仅含自己的实例、对手数量和公开区域。原型构造显式注入，默认 Match 仍关闭发放并且没有资源字段。

固定 test-* 定义和资源辅助器只在 engine/prototype.ts；不从引擎入口导出，production import guard 排除 prototype、候选 trumps／presets／codex、测试助手及未实现 AI 模块；REQ-020 起只准入 ai/policy.ts。通用效果接口可复用，原型实例／卡池／双方控制不接生产页面，不增加运行时调试开关、资源持久化或依赖。

application/contest/coordinator.ts 由已有控制器提取，生产 controller 保留原 human-only API，测试直接实例化同一协调器并明确提交双方命令。真实引擎的原子提交与观察回放同时验证，未抽取未被经典消费的 shared 基建。S2 资源模型与触发链仍待定。

表现层修整竞赛短视口与状态反馈，经典 Card 在合法揭牌前不挂载真实正面；经典 domain／application／save 和规则／存档版本均不改变。

## 14. REQ-020 无道具 AI 与 S1 交接（2026-10-21）

独立 domain/contest/ai/policy.ts 接收 MatchObservation 和合法 Hit／Stay，返回只有 Hit／Stay；使用观察方自己的总和，<17 且可 Hit 则 Hit，否则 Stay。application/types 的策略类型沿用该领域契约，coordinator 默认调用它，旧 placeholderOpponent.ts 已删除。不接完整状态、真实随机、搜索流或存储，所有待支持难度共用基线；目标变化后重新观察，但不调整阈值。

初版只移动策略职责并补充接口／信息／随机和过期回调证明，未改规则、协调提交顺序、300ms 调度延迟或页面。入口守卫显式准入该策略，原型、候选卡与未来搜索保持隔离。S1 各需求实现及验收收尾完成，整体外审已完成，Codex 技术验收及用户最终验收通过，S1 周期已结束；按用户要求保留 [S1 周期归档记录](./requirements/archive/REQ-2026-020-contest-basic-ai.md)。版本仍为 0.2.0 开发版，不自动合并 main、打 tag 或发布。

REQ-020 后经用户要求在原需求内修整外审观察：显式资源校验先于初始化随机，observeTrumps 自身保证深冻结；既有测试补齐 Storage 全部方法／length 与通知内暂停，经典 All-in 主操作统一 49px。没有新增模块、文件或依赖，未修改经典规则／存档。外审初版基线与本轮 248 项自审分开记录；后续条件复查在现有 roadmap 中承接。
