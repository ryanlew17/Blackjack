# REQ-2026-016: S1 积分赛制与比赛生命周期

状态: done
进度: 自审验收通过并归档（2026-10-20）；S1 整体外部审查另行安排
来源: 用户（2026-10-18 S1 拆分）
关联设计: docs/design/contest-rules.md §1–3、§6、§8、docs/adr/ADR-004-contest-turns-and-shared-boundaries.md、docs/testing.md
影响模块: src/domain/contest/engine/ 的 Match/Game 状态、计分与生命周期测试
实施前提: REQ-2026-015 已验收
非目标: 计分道具、五档平衡与解锁、战绩／对局存档、UI 和 AI 策略

开发分支: 沿用 codex/contest-round-engine；后续需求沿用该分支或其任务分支，不直接在 main 开发
版本线: 0.2.x；本项沿用 0.2.0 开发版本，不单独发版，不因需求完成递增发布版本

## 背景

将单回合结果组合成可完成的积分比赛，并明确平分递延、轮换与清理边界，避免在 UI 中计算比赛结果。

## 方案要点

- 引入 Match → Game → Round → Turn，S1 对外固定标准 BO5、先赢 3 局；其他 BO 档位及选择界面留待 S3，不提前承诺五档资源预设。
- Game 初始目标分 5，回合胜者 +1、败者 +0、平局双方 +0。双方同分达到当前目标减一时目标 +2；这不是无条件领先两分制。
- 每 Round 结果仅消费一次；当局达到目标后记大比分并建立新局，Match 达到三局胜利时结束。Match 开始只抛一次硬币，之后每个已完成 Round 轮换先手，平局与跨 Game 均延续。
- 正式无道具路径显式关闭资源发放。Round 清理留场与目标、Game 清理手牌／资源的接口预留给 REQ-019/S2，但不凭空启用候选卡。
- 不保存比赛详情、不提交难度通关或图鉴元进度；返回首页／刷新放弃的应用语义由 REQ-017/018 实现。

## 验收标准

- [x] 固定序列完成 BO5 的 3:0、3:1、3:2，获胜即结束，不强制打满五局，不接收终局后的旧命令。
- [x] 覆盖 3:4→4:4 目标变 7、5:6→6:6 目标变 9；验证无跳分时到达目标才胜局，重复结算不加分。
- [x] 平局不加分但推进 Round 与轮换；跨 Game 不重复抛硬币；下一 Game 目标恢复 5，比分按层级正确清理。
- [x] 规则快照在 Match 中不变，基础无道具模式没有发放或图鉴调用；清理顺序与胜局／胜场事件可确定验证。
- [x] 单元测试、经典回归及实施时质量门槛通过；无新增存档字段或存档版本；产品版本按 0.2.x 迭代。

## 验收记录

2026-10-20 按最新 AGENTS／testing 的任务收尾节奏执行自审验收，无待修复问题，状态改为 done 并归档；未另设单项外部验收。

- 收尾检查：`npm test` **176/176**（既有 155 + 新增 Match 21）、`npm run typecheck`、`npm run format`。开发期间仅单独运行新增 match.test.ts（21/21），未反复执行全量门槛。
- BO5 用真实 Hit/Stay／NextRound 命令验证 human／ai 双方的 3:0、3:1、3:2，共六种终局；达到三局即结束，终局后 NextRound／旧回合 Hit/Stay 均原样拒绝，不再消费随机。
- 固定序列验证 3:4→4:4 时目标 5→7、5:6→6:6 时 7→9，以及 8:6 不提前获胜、9:6 才胜局。普通路径第五分胜局；重复结束命令不重复计分。
- 平局双方 +0，但局内 roundsPlayed 增加且下一 Round 轮换。全局 roundNumber 跨 Game 延续，下一 Game 分数归零／目标恢复 5／局内计数归零；Match 胜局保留。随机调用恰为一次开场硬币 + 每 Round 十次洗牌，跨 Game 不增加硬币。
- 自审核对 MatchRules／RoundRules 引用贯穿整场，显式 trumpDealing false；无 presets／trumps／codex／存储调用，未改经典、应用、基础设施、UI、入口、依赖、构建或存档字段／版本。任务开始前已有的规范简化修改保留。
- 清理及事件验证：stay→先手 reveal→后手 reveal→settled→round-scored→可选 target-extended→round-cleanup→可选 game-won→game-cleanup→match-won。resolving 快照不能操作；Round 清理恢复规则目标并清除 Turn 临时记录，Game 清理留出未来资源执行位置。当前没有道具状态或空资源执行器，正式路径不发放候选卡。
- Match 观察与嵌套事件／每个快照都复用 Round 投影；双视角、隐藏状态等价、公开合法性、重新发牌后再次隐藏及胜局／胜场顺序均有测试。完整状态只供规则／后续协调层，UI／策略只消费观察。
- 本项为纯领域变更，按当前 testing.md 不运行 build 或浏览器验收；发布前完整门槛仍待发布任务执行。无通关或图鉴提交、无新增持久化、无 Release。需求仅保留本归档文档，无验收报告／handoff／实施计划等中间产物。

## 实施决策

- 保留已完成 Round／Game 的牌面与比分，分别停在 round-complete／game-complete；NextRound 才继续发牌并按需建立新 Game，便于后续界面展示结果。完整计分已在前一命令内提交，不由 NextRound 或动画决定胜负。
- MatchCommand 只加当前 roundNumber 以拒绝跨回合旧命令；跨 Match 的异步任务取消由 REQ-017 承接。不增加运行时命令 schema、会话 ID、通用安全框架或不可达输入的额外校验。
- match.ts 协调，scoring.ts 计分，lifecycle.ts 定义 Round 清理位置，matchObservation.ts 投影；Match/Game 类型和公开入口沿用 engine/types.ts 与 index.ts。原单回合 API 不变。
- 不开放其他赛制／难度参数，不提前实现计分道具、资源发放／清理细节、正式 AI 或 UI；Game 清理事件为 REQ-019/S2 的明确接入位置，不代表已实现道具生命周期。

## 变更记录

- 2026-10-18：登记 S1 积分赛制与比赛生命周期需求。
- 2026-10-20：沿用竞赛分支完成实现、自审与任务收尾检查，按用户最新验收约定归档；同步设计、架构、路线图、测试与索引，未向 README 写入开发进程。
