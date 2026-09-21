# design/game-rules — 规则引擎行为快照

> 适用范围：`src/domain/` 当前实现的规则行为——RuleSet、阶段机、命令、结算与事件。
> 何时读取：改规则、赔付、命令合法性、规则变体，或新增领域测试前。
> 关联需求：无。
> 最后更新：2026-09-22
> 来源：2026-09-22 重构定稿（规则参数化，ADR-001）+ 原 README 牌桌规则章节

## 1. RuleSet（`src/domain/game.ts`）

| 字段                                | 当前值   | 说明                                                         |
| ----------------------------------- | -------- | ------------------------------------------------------------ |
| `version`                           | `1`      | 规则版本；改任何已钉死字段须升版本并同步存档 `rulesVersion`  |
| `decks`                             | `1`      | 单副 52 张；多副牌改变牌张身份与存档 52 张覆盖校验，属路线图 |
| `standSoft17`                       | `true`   | **已接线**：庄家软 17 停牌（`false` = 软 17 补牌变体）       |
| `blackjackPayout`                   | `[3, 2]` | **已接线**：天然净赔比例，支持 `[6, 5]` 变体                 |
| `split` / `insurance` / `surrender` | `false`  | 字面量钉死，未实现（路线图候选）                             |

规则经 `transition` 的第 4 个参数 `rules: RuleSet = RULES` **逐调用传入**，引擎不持有全局规则状态（决策见 `../adr/ADR-001-ruleset-parameterization.md`）。游戏运行时始终使用默认 `RULES`；变体目前仅用于测试与未来扩展。

## 2. 阶段机

```text
betting ──deal──▶ player ──stand/double/爆牌/21──▶ dealer（瞬态）──▶ settled ──next──▶ betting
```

- `dealer` 是同步结算过程中的内部瞬态：**不持久化**，导入存档不接受该阶段（见 `../contracts/save-format.md`）。
- 开局立即检查天然：双方天然平局；仅玩家天然按 `blackjackPayout` 结算；仅庄家天然玩家输。
- 普通 21 点结束玩家行动并进入庄家回合，但不保证获胜。
- 结算后 `history` 头部插入 `{ round, outcome, bet, net }`，最多保留 30 局。

## 3. 命令与合法性（`legalActions`）

| 阶段      | 可用命令                                                        |
| --------- | --------------------------------------------------------------- |
| `betting` | `bet`；有下注后追加 `undo` / `clear` / `deal`；`allIn` 始终可用 |
| `player`  | `hit`、`stand`；仅初始两张、未加倍且余额 ≥ 下注时追加 `double`  |
| `settled` | `next`                                                          |
| `dealer`  | 无（瞬态）                                                      |

非法命令不改变状态、不产生事件（`transition` 原样返回入参状态）。`bet` 额外校验：安全整数、≥100、100 的倍数、不超过余额、下注栈 < 1000 层。

## 4. 结算数学

- 金额一律为**整数百分之一筹码**（`Money`：100 = 1 枚，50 = 半枚）；下注必须是 100 的正整数倍。
- 返还：`blackjack` = `bet + bet×p/q`（整数运算，按 `blackjackPayout`）；`win` = `bet×2`；`push` = `bet`；`lose` = 0。
- 加倍：余额足够时追加同额下注、补一张牌后强制停牌；补牌后 < 21 进入庄家回合。
- 全押：`floor((balance + bet) / 100) × 100`，保留无法下注的半筹码。
- 重复结算防护：结算只发生在 `transition` 内，且 `settle` 后立即置 `settled` 阶段，同一状态不会二次结算。

## 5. 事件

`GameEvent { type: "chip" | "card" | "reveal" | "result", state }` —— 每个事件携带**事件发生时刻的完整状态快照**，供表现层逐步播放。牌序编码：CardId 0–51，`花色 = floor(id/13)`（♠♥♣♦），`牌面 = id%13`（A、2…10、J、Q、K）。`shuffle(random)` 可注入随机源；`src/domain/testHelpers.ts` 提供确定性牌序构造。
