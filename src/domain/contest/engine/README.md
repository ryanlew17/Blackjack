# 竞赛引擎（S1）

@req REQ-2026-015 @req REQ-2026-016 @req REQ-2026-019

已实现独立的 Match/Game/Round/Turn、标准无道具 BO5、积分递延、1–11 唯一数字牌堆、Hit/Stay、安静停牌判定、牌面比较与观察／事件投影。无 React、浏览器 API 或经典规则依赖；正常无道具路径已接生产，固定多卡原型与资源不进入生产入口。

## 入口与边界

- `createRound(firstPlayer, random, rules?)` 返回权威终态和四次有序发牌事件。先手由后续 Match 生命周期传入，工厂不抛硬币。数字牌从先手起交替发放，第一张保持暗牌；洗牌恰消耗 10 次注入随机值，后续 Hit 按牌堆顺序抽取，不重新洗牌。
- `snapshotRoundRules(rules)` 校验并冻结规则快照；调用方已有冻结快照时保留同一引用，供后续 Match 跨 Round 复用。默认目标 21，`pointTarget` 为后续目标效果预留；规则版本为竞赛内部的 1，与经典 rules/save v2 无关。
- `transition(state, { type: "Hit" | "Stay", player })` 只处理当前行动方。非法动作返回同一 state、零事件；`dealing`、`revealing` 仅存在于回放快照，不能行动。权威终态在返回前完成，事件只用于回放。
- `observeRound(state, viewer)` 与 `projectRoundTransition(result, viewer)` 是交给 UI／策略的边界；也可单独调用 `projectRoundEvent`。观察不含牌堆身份／顺序、对手暗牌、对手完整点数或爆牌标记，事件载荷和每个快照都经过投影。`legalActions(observation)` 仅依据可见条件；transition 在权威状态上重建该观察来检查命令，不信任外部按钮。
- `turn.ts` 的 `recordTrumpConsumption` 是未公开到 index 的引擎内部接缝，只能由 effects 执行器在验证并消费资源后调用。它保留行动方、重置安静记录、设置 `usedTrump`；不验证道具、不执行效果、不提供玩家命令。合法消费但效果失败也应调用，非法尝试不得调用。

状态、事件和投影视图深冻结。`NumberCardView.faceDown` 表示尚未公开：己方可知值，对手值为 null；`visibleTotal` 仅统计公开牌，`total` 在存在不可见牌时为 null。第二次安静 Stay 的事件后，按先手、后手分别揭牌，最后发布一次 settled 结果；此前不发布结果。

正式 AI、道具卡池／资源策略、道具 UI 和存储属于后续需求；有限执行器见下节 REQ-019。实验卡池仍不可玩。`testHelpers.ts` 仅供同目录测试，不能进入生产依赖图。

## Match/Game 入口（REQ-016）

- `createMatch(random, roundRules?)` 固定标准 BO5、先赢 3 局、Game 初始目标 5、递延幅度 2、`trumpDealing: false`。只在开场用一次注入随机值抛硬币；每个 Round 另外消耗 10 次洗牌值。可选 RoundRules 沿用 REQ-015 的牌面目标边界，不开放其他难度或赛制配置。
- `transitionMatch(state, command, random)` 处理带 `roundNumber` 的 Hit/Stay，以及 `{ type: "NextRound", roundNumber }`。只有当前行动方可操作；过期回合、已结束 Match 和不合阶段的命令返回同一状态、零事件、零随机。回合编号用于拒绝跨回合旧命令；跨 Match 的任务取消由后续应用层负责。
- 连续安静 Stay 后，同一 transition 消费结果一次：赢家 +1、平局 +0，增加 Game 已完成回合数；同分到达当前目标减一才将目标 +2，然后判断 Game/Match 胜负。Game 分数与 Match 胜局分别保存，无历史或元进度。
- 权威终态为 `round-complete`、`game-complete` 或 `complete`，保留刚结束的牌面与比分供展示。前两者通过 NextRound 发新牌；game-complete 同时建立新 Game，分数归零、目标恢复 5，Match 胜局和全局回合编号继续。每个新 Round 的先手是上个 Round 先手的另一方，平局和跨 Game 均不重新抛硬币。
- 事件顺序：Round 的 stay → reveal → reveal → settled，随后 round-scored → 可选 target-extended → round-cleanup → 可选 game-won → game-cleanup → match-won。`resolving` 只用于中途快照，不能行动；动画不参与积分计算。
- `lifecycle.ts` 在 round-cleanup 重置牌面目标与 Turn 临时记录，保留揭牌结果。game-cleanup 清空显式注入的道具手牌／桌面／弃置；默认无道具路径仍无资源字段、发放或候选卡调用。Game 的计分数据在 NextRound 建立新局时重置。
- `observeMatch`、`projectMatchEvent`／`projectMatchTransition` 公开比分并复用 Round 投影，嵌套事件及全部快照都过滤隐藏牌。`legalMatchActions(observation)` 返回该阶段可用的 Hit/Stay、NextRound，以及仅显式注入时可用的 PlayTrump；UI／策略不接收完整 MatchState。

同一冻结 MatchRules 贯穿整场；其中 `round` 快照以同一引用传给每次发牌与观察。无新增存档字段、难度通关、图鉴更新或正式卡池；原型没有生产入口。

## REQ-019 有限效果接口

RoundRules.trumps 可显式注入公开的有序 onPlay 定义与可选 table.pointTarget（null 仅供容量测试）；createMatch(random, rules?, privateSetup?) 复制冻结初始每局手牌模板，默认没有此资源。PlayTrump 携带 player／instanceId／可选 targetId，沿用原 transitionMatch 和 roundNumber；legalTrumpCommands 只依据自身观察列出具体命令，指定抽牌不存在也能合法消费。效果仅支持 draw-number、return-last、remove-table（单一对方目标）与目标留场。

用卡不换人，合法消费重置安静记录；数字退回牌堆末尾，暗牌不可退。混合卡先校验五格，目标全局互斥，清除恢复冻结基准且不撤销即效。Round 清理留场、保留手牌；Game 清空资源，NextRound 新局按私有模板重建。投影不泄露模板、牌堆或未使用对手道具身份。

prototype.ts 的七个 test-* 定义仅供测试，不经 index 导出或生产入口可达；marker 是容量占位，不是正式卡。正式资源、触发、计分与 AI 留到 S2，不准入研究目录。
