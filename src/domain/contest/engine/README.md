# 竞赛单回合引擎（S1）

@req REQ-2026-015

已实现独立的 Round/Turn、1–11 唯一数字牌堆、Hit/Stay、安静停牌判定、牌面比较与观察／事件投影。无 React、浏览器 API 或经典规则依赖；未接生产入口。

## 入口与边界

- `createRound(firstPlayer, random, rules?)` 返回权威终态和四次有序发牌事件。先手由后续 Match 生命周期传入，工厂不抛硬币。数字牌从先手起交替发放，第一张保持暗牌；洗牌恰消耗 10 次注入随机值，后续 Hit 按牌堆顺序抽取，不重新洗牌。
- `snapshotRoundRules(rules)` 校验并冻结规则快照；调用方已有冻结快照时保留同一引用，供后续 Match 跨 Round 复用。默认目标 21，`pointTarget` 为后续目标效果预留；规则版本为竞赛内部的 1，与经典 rules/save v2 无关。
- `transition(state, { type: "Hit" | "Stay", player })` 只处理当前行动方。非法动作返回同一 state、零事件；`dealing`、`revealing` 仅存在于回放快照，不能行动。权威终态在返回前完成，事件只用于回放。
- `observeRound(state, viewer)` 与 `projectRoundTransition(result, viewer)` 是交给 UI／策略的边界；也可单独调用 `projectRoundEvent`。观察不含牌堆身份／顺序、对手暗牌、对手完整点数或爆牌标记，事件载荷和每个快照都经过投影。`legalActions(observation)` 仅依据可见条件；transition 在权威状态上重建该观察来检查命令，不信任外部按钮。
- `turn.ts` 的 `recordTrumpConsumption` 是未公开到 index 的引擎内部接缝，只能由后续执行器在验证并消费资源后调用。它保留行动方、重置安静记录、设置 `usedTrump`；不验证道具、不执行效果、不提供玩家命令。合法消费但效果失败也应调用，非法尝试不得调用。

状态、事件和投影视图深冻结。`NumberCardView.faceDown` 表示尚未公开：己方可知值，对手值为 null；`visibleTotal` 仅统计公开牌，`total` 在存在不可见牌时为 null。第二次安静 Stay 的事件后，按先手、后手分别揭牌，最后发布一次 settled 结果；此前不发布结果。

Match/Game、积分、跨回合先手轮换、AI、道具执行、UI 和存储属于后续需求。实验卡池仍不可玩。`testHelpers.ts` 仅供同目录测试，不能进入生产依赖图。
