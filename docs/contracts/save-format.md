# contracts/save-format — 存档格式 v2

> 适用范围：当前工作区 v2 文件与自动存档契约；已通过独立最终验收。
> 何时读取：改 save.ts、导入导出或版本兼容时。
> 关联需求：REQ-2026-003–006。
> 最后更新：2026-09-22

## 外层与兼容

UTF-8 JSON，最大 128 KiB；建议文件名 `green-room-YYYY-MM-DD.blackjack.json`。

`SaveEnvelope`：`version: 2`、`rulesVersion: 2`、`savedAt`（可解析日期）、`revision`（非空字符串，写入时生成 UUID）、`game`、`settings`（language: en/zh，muted，volume: 0–1，motion: system/reduce/full）。仅支持默认桌规。

**存储键继续为 `green-room.blackjack.v1`**：这是稳定的存储位置，不是负载格式版本。沿用该键可以发现旧档并保留跨标签冲突检测；不另起新键跳过旧档。

v1、未知规则/格式版本均拒绝，不迁移。旧自动存档触发 `problem: version`，阻止游戏动作和设置写入，原文不自动覆盖。用户可明确确认重新开始或导入有效 v2 存档。读取失败返回的新局仅作为暂停界面的占位，不代表旧进度已转换。

## 游戏状态

| 字段                      | 含义                                                          |
| ------------------------- | ------------------------------------------------------------- |
| phase                     | betting / insurance / player / settled；dealer 瞬态禁止导入   |
| balance / bets            | 可用资金及下注阶段的下注栈（最多 1000 项）                    |
| hands                     | 一至两手，含 cards、bet、doubled、status、outcome             |
| activeHand                | 当前行动手索引，非玩家阶段为 0；玩家阶段指向第一个 active 手  |
| originalBet               | 发牌前原始主注；下注阶段为 0                                  |
| insurance                 | bet 与 outcome：not-offered / pending / declined / win / lose |
| dealer / deck             | 庄家牌与未发牌，deck[0] 为下一张                              |
| round / outcome / history | 局号、汇总结果（含 mixed）、最近最多 30 局                    |

`Hand.status` 为 active / stood / busted / surrendered，`outcome` 为 null 或 blackjack / win / lose / push / surrender。两手表示分牌；分牌手初始牌须同点值，各手下注为 originalBet 或加倍后的两倍。分 A 只能两张并停牌；21 点或爆牌后不可继续抽牌。

金额为整数百分之一筹码；默认桌规下余额与保险是非负安全整数且为 50 的倍数，主注为 100 的正整数倍。历史净收益允许负数且须与明细精确一致；不设固定余额上限。

进行中和结算状态，全部玩家牌、庄家牌及剩余牌合计恰好覆盖 52 个不重复的 CardId（0–51）。下注状态无牌，仅一手，下注栈之和等于主注。

## 历史与一致性

每条 `RoundRecord` 含 round、originalBet、outcome、bet、net、hands（逐手 bet/outcome/net）和 insurance。总下注包含保费，总净收益包含保险；各手结果不同时为 mixed。终局第一条记录必须与当前各手及保险一致。

历史局号连续递减；保险或玩家行动中的当前局尚不入历史，其余状态最新历史对应当前 round；保存 min(已完成局数, 30) 条。记录必须满足逐手赔率、保险金额与结果组合约束。历史不保存完整牌面，因此校验数学与结构，不能证明过往随机牌序真实性。

## 校验与恢复

1. 检查字节数、JSON、格式/规则版本、设置与元数据。
2. 检查金额、手牌结构、牌组完整性、当前手顺序、分牌/加倍限制及保险时机。
3. 检查天然、停牌/爆牌/投降状态、庄家补牌顺序和终局结果，核对历史明细与总收益。
4. 全部通过才展示导入预览，用户确认后替换；失败保持现有进度。

权威状态先提交，动画中导出不保存中间事件。自动存档损坏和版本不支持均不静默覆盖；存储不可用则会话继续并提示导出。跨标签变更取消动画并暂停，重新载入最新状态后恢复。
