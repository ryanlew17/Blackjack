# REQ-2026-030: Node 26 基线与 Vite 8 工具链升级

状态: done
来源: 用户（2026-11-15：统一工具链架构升级；统筹 Dependabot PR #1–#4）
关联设计: [架构](../../architecture.md) · [ADR-002](../../adr/ADR-002-singlefile-release-build.md) · [测试门槛](../../testing.md) · [路线图](../../roadmap.md)
影响模块: package.json／package-lock.json、CI／Dependabot配置、vite.config.ts、启动脚本、scripts/validation/contest_ai.ts、双语README、AGENTS.md、架构与路线图文档
非目标: 不修改游戏规则、存档契约、规则版本或玩家文案；不升级TypeScript 7或Motion 14；不改CSP策略、`base: "./"`或单文件分发方式；不重写main历史、不追改历史REQ、不创建Release；不新增`.npmrc` engine-strict，不使用`--ignore-scripts`、审计抑制或警告抑制环境变量规避问题。

## 背景

Node.js 26.13.1是2026-11-11安全版本。将最低工具链运行时提升到该版本、停止维护Node 24／26.12.x兼容，是主动的安全与维护成本决策，不是Vite 8的技术前置。目标是在同一REQ内分阶段完成Node基线、semver内刷新、Vitest 5和Vite 8升级，以分阶段提交保留归因能力，中间不重复全量测试，最终统一验收。

Dependabot PR #1–#3由本REQ选择性覆盖：#1包含必须排除的TypeScript 7，#2单独升级React造成与react-dom版本不匹配，#3已在锁文件中同时取得React／react-dom 19.3.1。#4的Motion 14缺少专项视觉回归，不并入本REQ。

实施基线为包含REQ-2026-029的main现状。此前误推送已确认是线性快进而非PR合并，main CI通过且未改变v0.1.4 Release；本REQ不重写历史，后续实现只经符合变更类型的独立分支与PR，不直接推送main。

## 方案要点

- **A．Node基线**：engines收紧为`>=26.13.1 <27`；CI的audit与test/build两个job统一使用26.13.1并移除矩阵；启动脚本仅接受26.13.1及以上的26.x，`.bat`保持ASCII与CRLF；同步文档。
- **B．semver刷新**：干净`npm ci`后更新并审查完整锁文件；Vite 6.4.6、React／react-dom 19.3.1、Prettier 3.10.1，singlefile保持2.3.4，TypeScript与Motion不跨major。
- **C．Vitest 5.1.0**：先在Vite 6.4.6上独立升级，核查`clearMocks`、hoisted mock、异步断言、fake timers／Temporal及标题变化，不删除或跳过测试。
- **D．Vite 8.3.8**：与plugin-react 6.3.0同批升级；保持singlefile、CSP hook顺序和`base: "./"`，以标准JSON默认导入消除配置警告。AI验证脚本改用Vite 8带入的Rolldown，不再依赖传递安装的esbuild。接受并记录Chrome／Edge 111、Firefox 114、Safari 16.4及以上的默认浏览器目标。
- **E．缓议与收口**：TypeScript 7因Compiler API不兼容、Motion 14因动画回归风险缓议；roadmap记录专项前提，Dependabot暂时忽略7.x／14.x，专项REQ开工时移除。分支按feat/、fix/、chore/等变更类型命名。
- 实施PR包含对应变更且CI通过后，#1–#3以“由REQ-2026-030选择性覆盖”关闭，#4以“Motion 14专项缓议”关闭；关闭原因链接实施PR，不将#4描述为已升级。

## 验收标准

- [x] Node 26.13.1下最终`npm ci`、全量`npm test`、`npm run typecheck`、`npm run build`、`npm run format:check`通过，既有55个测试文件／1136项测试不减少；锁文件审计0漏洞。
- [x] 启动脚本拒绝Node 24.22.1、26.12.1与26.13.0，接受26.13.1；`.bat`保持ASCII与CRLF；双语README、AGENTS、架构与路线图和实际行为一致。
- [x] `dist/index.html`内联全部JS／CSS，仅既有favicon.svg外置；最终CSP hash与实际脚本一致，CSP策略及`base: "./"`不变。
- [x] 生产preview、干净目录`file://`、dev server及真实HMR均正常；Chromium／WebKit／Firefox覆盖约定场景，控制台错误、页面错误及CSP违规为零，并核对实际画面、320px布局、减少动态效果与代表性动画。
- [x] `scripts/validation/contest_ai.ts`以Rolldown完成至少一个固定种子的真实对抗并正常终局；除`vite.config.ts`最小兼容适配外无`src/`游戏代码差异。
- [x] 用户复核本地实施与证据后验收通过；实现经`chore/`分支及PR提交，无直接main推送、历史重写或Release操作。

## 验收记录

2026-11-15用户确认验收通过并归档。

- 最终实现为Node 26.13.1、Vite 8.3.8、plugin-react 6.3.0、Vitest 5.1.0、React／react-dom 19.3.1、Prettier 3.10.1；TypeScript保持5.8.3，Motion保持12.43.0。
- 干净`npm ci`、55文件／1136测试、typecheck、format、format:check及Vite 8构建全部通过，audit为0漏洞。仅剩fsevents可选install-script提示，未使用抑制手段。
- `dist/`仅含index.html与favicon.svg，一个内联脚本、无外部脚本，SHA-256与CSP完全匹配；构建无配置警告。Rolldown 1.2.19打包的AI验证在种子1完成18 Round，human以3–0获胜。
- Chromium／WebKit的preview与`file://`、Firefox preview、Chromium dev均完成真实经典手牌及下一局操作，错误与CSP违规为0；dev WebSocket捕获`full-reload`帧。正常动态偏好下最多观察到6个并发动画。
- 六场景均在320px下实际操作经典结算区与下注控制区，竞赛选技页和实际牌桌另经窄屏检查，均无横向溢出；减少动态效果生效。整分支独立审查无Critical／Minor，审查指出的窄屏证据缺口已补测闭环。
- 远程交付结果待推送、实施PR CI及Dependabot PR关闭后补记，不提前记为通过。未执行合并、Release或LAN验证。
