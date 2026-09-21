# contracts/save-format — 存档格式 v1

> 适用范围：存档文件与 localStorage 快照的字段、编码、校验与恢复规则。
> 何时读取：改 `src/infrastructure/save.ts`、导入导出、版本迁移时。
> 关联需求：无。
> 最后更新：2026-09-22
> 来源：原 docs/SAVE_FORMAT.md（2026-09-22 迁入 contracts/，表述随实现更新）

文件：UTF-8 紧凑 JSON，建议文件名 `green-room-YYYY-MM-DD.blackjack.json`。最大 128 KiB。localStorage 键为 `green-room.blackjack.v1`。

外层 `SaveEnvelope`：

| 字段         | 含义                              |
| ------------ | --------------------------------- |
| version      | 存档格式版本，当前为 1            |
| rulesVersion | 规则版本，当前为 1                |
| savedAt      | ISO 日期时间                      |
| revision     | 每次写入生成的 UUID，用于识别快照 |
| game         | GameState 权威游戏状态            |
| settings     | language、muted、volume、motion   |

## 游戏状态

`phase` 可持久化为 betting / player / settled。dealer 是同步结算过程中的内部瞬态，导入不接受该阶段。

`balance`、手牌 `bet`、下注栈 `bets`、历史 `net` 均使用整数百分之一筹码：100 = 一枚筹码，50 = 半枚筹码。下注必须为 100 的正整数倍。所有金额必须是非负安全整数且为 50 的倍数；除此之外不设固定上限，与游戏逻辑保持一致，任何可达的对局状态都能通过校验。

`hands` 当前只允许一手，包含 cards、bet、doubled；未来分牌会通过新的规则/存档版本扩展。`dealer` 为庄家牌张，`deck` 为未发出的牌，下一张牌位于索引 0。

CardId 是 0–51 的整数。花色按 ♠、♥、♣、♦ 排列，每种花色按 A、2…10、J、Q、K 排列：`花色 = floor(id / 13)`，`牌面 = id % 13`。进行中及已结算局的牌组、庄家与玩家手牌合计必须恰好覆盖 52 张不重复的牌。

`round` 为回合数；`outcome` 为 blackjack / win / lose / push 或 null；`history` 保存最近最多 30 局，含 round、outcome、bet、net。点数、UI 位置、动画和音频状态不写入文件。

## 校验与恢复

1. 检查文件字节数、JSON 格式、存档版本与规则版本。
2. 检查金额、牌张、设置值、阶段、天然 Blackjack、终局结果和历史净收益一致性。
3. 仅在全部通过后展示余额、阶段与保存时间；用户确认后替换进度。
4. 不支持的版本明确拒绝，不猜测转换。未来迁移应在 `parseSave` 入口按版本增加纯转换函数，转换结果仍需完整校验。

浏览器存储写入失败时，当前会话继续运行并显示导出提醒；损坏的自动存档不会被直接覆盖，必须导入或确认重新开始。导出读取权威快照，因此动画中导出也不会保存半截动画或重复结算。

其他标签页写入后，当前标签页取消动画并暂停操作。写入前也会比较完整基准快照，发现变化要求重新载入。此机制用于日常单机冲突保护，不是跨标签页事务数据库或云端并发协议。
