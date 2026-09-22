# design/game-rules — 规则引擎行为快照

> 适用范围：`src/domain/` 当前工作区的规则 v2 实现；已通过独立最终验收，覆盖范围见验收报告。
> 何时读取：改规则、赔付、命令合法性、规则变体或领域测试时。
> 关联需求：REQ-2026-003、REQ-2026-004、REQ-2026-005、REQ-2026-006。
> 最后更新：2026-09-22

## 1. RuleSet 与入口

默认 `RULES`：`version: 2`、`decks: 1`、`standSoft17: true`、`blackjackPayout: [3, 2]`，`split / insurance / surrender: true`。三项开关均为已接线的 boolean；单副牌身份编码仍钉死为 1 副。`standSoft17` 和 6:5 赔率变体仍用于领域测试，运行界面和存档只使用默认桌规。

`transition(state, command, random?, rules?)` 是唯一状态推进入口；`legalActions(state, rules?)` 同样接收逐调用规则参数。`score(cards)` 计算点数，`handOutcome`、`handNet`、`summarizeRound` 提供共享结算与存档校验逻辑；表现层只展示结果，不计算输赢。

## 2. 阶段与命令

```text
betting → deal → insurance（庄家明牌 A 且启用保险）→ player → dealer（瞬态）→ settled → next → betting
                  └ insure / declineInsurance ─────┘
```

- `betting`：bet、allIn；已下注可 undo、clear、deal。
- `insurance`：declineInsurance；余额足够且保险启用时可 insure。玩家天然也必须先选择；不提前揭示庄家天然。
- `player`：hit、stand；初始两张且余额足够时可 double；符合桌规可 split 或 surrender。动作仅影响 `activeHand`。
- `dealer`：同步结算瞬态，不接受命令、不持久化。
- `settled`：仅 next。天然可以跳过普通玩家回合直接结算。

非法命令原样返回输入且无事件。每手通过 `active / stood / busted / surrendered` 记录行动状态，终局设置独立 `outcome`。剩余手牌全部结束后庄家只行动一次；全部爆牌或投降时无需庄家补牌。

## 3. 分牌、保险与晚投降

- **分牌**：初始两张同点值（10/J/Q/K 均为 10）且余额足够时追加原注，分成两手；各补一张后按第一手、第二手顺序行动，不可再分。分 A 各补一张后停牌且不可加倍；其他分牌两张时可加倍。分牌 21 点自动停牌，按普通 21 点结算，非天然。
- **保险**：明牌 A 时选择买入或放弃后检查庄家天然；固定保费为 `originalBet / 2`，余额不足只可放弃。天然时返还保费三倍（净赔 2:1），否则损失保费；主注独立结算。购买后的保险不再撤销，无单独 even-money 操作。
- **晚投降**：确认庄家无天然后，未分牌、未要牌或加倍的初始手可 surrender，返还原注一半并结束本局。保险选择不消耗资格，保险损失保留；已结算天然不可投降。

## 4. 金额与历史

所有金额使用整数百分之一筹码（100 = 一枚）。主注、分牌追加注是 100 的正整数倍；保险和半注返还允许 50。默认规则下金额为 50 的倍数。

主注返还：blackjack = 原注 + 原注×3/2；win = 下注×2；push = 下注；lose = 0；surrender = 原注/2。加倍追加同额下注，补一张并停牌。全押保留不足一枚的零头。

不设固定余额上限；累计金额使用精确整数求和，若某次转换产生无法以安全整数表示的金额，原样返回且不提交事件。不会四舍五入资金。

每局历史仅一条，最多 30 局，包含 `originalBet`、每手 `{ bet, outcome, net }`、保险 `{ bet, outcome }`，以及总 `bet / net`。总下注包含各手最终下注和保费；总净收益包含各手及保险损益。各手结果不同时汇总 `outcome: mixed`，界面仍展示独立结果。

## 5. 事件与确定性

`GameEvent { type: chip | card | reveal | result, state }` 携带事件时刻的完整快照。权威最终状态由 transition 一次性计算，useGame 先保存再播放。无事件的轮转同样提交状态，动画回调永不决定赔付。

CardId 0–51；花色按 ♠♥♣♦，牌面按 A、2…10、J、Q、K。`shuffle(random)` 注入随机源，`testHelpers.ts` 提供固定牌序。开发测试覆盖所有新增动作及其非法时机；正式验收见需求及交接清单。
