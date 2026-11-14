# REQ-2026-030: Node 26 基线与 Vite 8 工具链升级

状态: active
来源: 用户（2026-11-15：统一工具链架构升级；统筹 Dependabot PR #1–#4）
关联设计: [架构](../../architecture.md) · [ADR-002](../../adr/ADR-002-singlefile-release-build.md) · [测试门槛](../../testing.md) · [路线图](../../roadmap.md)
影响模块: package.json／package-lock.json、CI／Dependabot配置、vite.config.ts、启动脚本、scripts/validation/contest_ai.ts、双语README、AGENTS.md、架构与路线图文档
非目标: 不修改游戏规则、存档契约、规则版本或玩家文案；不升级TypeScript 7或Motion 14；不改CSP策略、`base: "./"`或单文件分发方式；不重写main历史、不追改历史REQ、不创建Release；不新增`.npmrc` engine-strict，不使用`--ignore-scripts`、审计抑制或警告抑制环境变量规避问题。

## 背景

Node.js 26.13.1是2026-11-11安全版本。将最低工具链运行时提升到该版本、停止维护Node 24／26.12.x兼容，是主动的安全与维护成本决策，不是Vite 8的技术前置：现有Node 24.22.1与26.12.1均已满足Vite 8和Vitest 5的运行要求。Node仅承担开发、验证与构建；已发布单文件游戏不需要Node运行时。

当前基线为Vite 6.4.5、Vitest 4.1.12、React／react-dom 19.3.0、Prettier 3.9.8、TypeScript 5.8.3、Motion 12.43.0。目标是在同一REQ内分阶段交付Node 26.13.1基线、semver内刷新、Vitest 5.1.0、Vite 8.3.8与plugin-react 6.3.0，避免碎片需求反复扰动同一锁文件，并以分阶段提交保留归因能力。

Dependabot PR #1–#3由本REQ选择性覆盖：#1包含必须继续排除的TypeScript 7，且其CI已因TypeScript 7移除`ts.ScriptTarget`等兼容API而失败；#2单独升级React造成与react-dom精确版本不匹配；#3已在锁文件中同时取得React／react-dom 19.3.1。#4的Motion 14虽通过现有CI，但缺少牌桌动画视觉回归，不并入本REQ，作为专项缓议关闭。

实施基线为包含REQ-2026-029的main现状。此前误推送已确认是线性快进而非PR合并，main CI通过且未改变v0.1.4 Release；本REQ不重写历史，后续实现只经符合变更类型的独立分支（本项为`chore/`）与PR，不直接推送main。

## 方案要点

A–E分阶段提交；中间仅进行安装、配置加载或定向验证，不重复运行全量测试，最终以本REQ统一验收为准。

### A. Node 26.13.1基线

- `package.json` engines收紧为`>=26.13.1 <27`；CI的audit与test/build两个现有job统一使用26.13.1，test矩阵收缩为单点并同步移除job名称中的matrix插值，不另拆虚构的第三个job。
- `start-game.bat`与`start-game.command`仅接受26.13.1及以上的26.x版本，同步探测表达式、注释与错误文案；`.bat`保持纯ASCII与CRLF。
- 同步双语README、AGENTS.md的Node命令说明及Vite版本、docs/architecture.md；旧REQ保留当时验收事实，不回改。

### B. semver内刷新

- 先以`npm ci`建立干净基线，再执行semver内更新并审查完整锁文件差异，不只核对点名包。
- 目标包括Vite 6.4.6、React与react-dom成对19.3.1、Prettier 3.10.1；vite-plugin-singlefile保持2.3.4，TypeScript与Motion不得跨major。
- 运行Prettier并提交实际格式差异；不得借格式更新混入游戏行为变化。

### C. Vitest 4→5.1.0

- 利用其对Vite 6.4／7／8的peer兼容，在Vite 6.4.6上独立升级并验证，再进入Vite 8阶段。
- 重点核查`clearMocks`默认开启、hoisted mock位置、未等待异步断言、fake timers／Temporal及测试标题变化；报告外观差异本身不作为回归，不得通过删除或跳过测试取得通过。

### D. Vite 6→8.3.8与plugin-react 6.3.0

- 两者同批升级；vite-plugin-singlefile 2.3.4继续使用。保留`base: "./"`、JS／CSS内联和favicon外置，不改变CSP策略。
- 实测`transformIndexHtml(post)`、singlefile内联、`generateBundle(post)`改写HTML asset并计算最终脚本SHA-256的顺序；仅在证据需要时最小适配`vite.config.ts`。配置加载如需兼容，使用标准JSON import attributes，不设置`VITE_CONFIG_NATIVE_IGNORE_WARNING`。
- Vite 8不再传递安装esbuild。将`scripts/validation/contest_ai.ts`的打包命令优先迁移到Vite 8带入的Rolldown；仅在Rolldown实测无法保持等价入口与输出时，才显式登记esbuild 0.28.x为验证专用开发依赖，并记录其postinstall及npm警告，不得宣称esbuild会自动升级或警告必然消失。
- 接受Vite 8默认浏览器构建目标：Chrome／Edge 111、Firefox 114、Safari 16.4及以上；在双语README与架构文档明确该基线，不沿用Vite 6旧浏览器兼容承诺。
- 针对Rolldown、Oxc JS压缩、Lightning CSS及plugin-react更新，除CSP外还验证实际绘制、核心交互与动画。

### E. 缓议项与Dependabot收口

- 在roadmap的“需求与版本政策”记录TypeScript 7与Motion 14缓议理由、专项实施前提及解除条件；本REQ不实施二者。
- 在`.github/dependabot.yml`暂时忽略`typescript` 7.x与`motion` 14.x，避免关闭PR后重复出现同major升级；后续专项REQ开工时移除对应ignore。
- 本REQ实施PR包含对应变更且CI通过后，#1–#3若未自动关闭，以“由REQ-2026-030选择性覆盖”为说明并链接实施PR手动关闭；#4以“Motion 14专项缓议，roadmap与Dependabot策略已记录”为说明关闭，不标记为已升级或已被版本覆盖。关闭操作在REQ验收前完成，但不以REQ合并为前提。

## 验收标准

- [x] A–E各有独立提交；Node 26.13.1下最终`npm ci`、全量`npm test`、`npm run typecheck`、`npm run build`、`npm run format:check`通过，既有55个测试文件／1136项测试不减少。
- [ ] CI现有audit、test/build两个job在Node 26.13.1单点全绿；锁文件审计0漏洞，无公告或脚本警告抑制。
- [x] 启动脚本拒绝Node 24.22.1、26.12.1与26.13.0，接受26.13.1；文档准确表达“支持范围”，不将非engine-strict环境描述为所有npm入口均硬阻断；`.bat`编码与换行符合约束。
- [x] `dist/index.html`内联全部JS／CSS，仅既有favicon.svg外置；最终CSP hash与实际内联脚本一致，CSP策略及`base: "./"`未变。
- [x] 生产preview、干净目录`file://`、dev server均正常；Chromium验证dev WebSocket及一次真实HMR，preview与`file://`完成核心流程，WebKit完成preview／`file://`代表场景，Firefox完成preview基础流程。各场景零控制台错误、页面错误及CSP违规，并核对实际画面、320px布局、减少动态效果与代表性动画。
- [x] `scripts/validation/contest_ai.ts`以实际选定打包器完成至少一个固定种子的真实对抗并正常终局；未因常规测试未覆盖该入口而漏检。
- [x] 双语README、AGENTS.md、architecture.md、roadmap.md与最终版本、浏览器目标和缓议策略一致；Dependabot ignore与后续解除条件一致。
- [x] 除`vite.config.ts`最小兼容适配外无`src/`游戏代码差异；验证脚本仅调整打包入口或必要说明，无规则、存档或规则版本变化。
- [ ] PR #1–#4按本REQ约定关闭或自动关闭并保留正确原因；实现经符合变更类型的独立分支（本项为`chore/`）及PR提交，无直接main推送、历史重写或Release操作。

## 验收记录

2026-11-15本地实施与验证完成；GitHub CI与Dependabot PR收口尚未执行，REQ保持active。

- 实现：A–E提交依次为`181830a`、`0583368`、`e368b72`、`abc3a1b`、`654f933`。最终为Node 26.13.1、Vite 8.3.8、plugin-react 6.3.0、Vitest 5.1.0、React／react-dom 19.3.1、Prettier 3.10.1；TypeScript保持5.8.3，Motion保持12.43.0。
- 自动检查：Node 26.13.1／npm 11.20.0下干净`npm ci`、55文件／1136测试、typecheck、format、format:check、Vite 8构建全部通过，audit为0漏洞；未删除或跳过测试。仅剩fsevents可选install-script提示，未使用任何抑制手段。
- 构建与CSP：`dist/`仅含index.html与favicon.svg，一个内联脚本、无外部脚本，最终SHA-256与CSP完全匹配；生产`connect-src 'none'`、`base: "./"`及原策略不变。package.json改为标准JSON默认导入后，构建无配置警告，singlefile与CSP hook顺序无需适配。
- 验证脚本：Rolldown 1.2.19成功打包`contest_ai.ts`，Node 26.13.1下种子1完成18 Round，human以3–0获胜；不再需要esbuild。
- 浏览器：Playwright 1.65.1的Chromium／WebKit preview与`file://`、Firefox preview、Chromium dev均完成真实经典手牌及下一局操作，控制台错误、页面错误、请求失败和CSP违规均为0。dev WebSocket捕获`src/main.tsx`触发的`full-reload`帧；正常动态偏好下观察到最多6个并发动画。
- 窄屏与可访问性：六场景均在320px下实际操作经典结算区与下注控制区，scrollWidth为320且减少动态效果生效；竞赛选技页和实际牌桌另经320px检查，无横向溢出。截图已核对首页、经典结算、竞赛牌桌和正常动画结算。
- 启动脚本：版本表达式拒绝24.22.1、26.12.1、26.13.0与27.0.0，接受26.13.1及26.14.0；`.bat`保持纯ASCII与CRLF。
- 审查：整分支独立审查无Critical／Minor；其指出的320px仅覆盖首页问题已通过经典结算／下注区与竞赛实际牌桌补测闭环。`src/`无游戏代码差异。
- 待办：推送`chore/node-26-vite-8`并创建实施PR，等待GitHub两job全绿后按方案关闭PR #1–#4。未执行远程关闭、合并、Release或LAN验证。
