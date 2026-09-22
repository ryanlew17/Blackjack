# design/state-and-animation — 状态协调与动画队列行为快照

> 适用范围：`src/application/useGame.ts` 当前实现的协调行为——权威状态、动画队列、刷新恢复、跨标签冲突。
> 何时读取：改 useGame、动画节奏、持久化时机、冲突处理前。
> 关联需求：REQ-2026-003–006。
> 最后更新：2026-09-22
> 来源：2026-09-22 重构定稿（effectId 单调计数器）

## 1. 权威状态与视图

- `current` ref 持有最新 `SaveEnvelope`（权威快照）；`view`（useReducer）仅保存当前正在渲染的 `game` + `busy` + 当前动效。
- **先持久化、后渲染**：`send` 中 `transition` 算出新状态后，先 `persist` 写 localStorage，冲突时不提交；存储写入失败则保留内存权威状态并提示导出，当前会话继续。
- 动画回调（`setTimeout` 步进）只 dispatch 事件快照，**永不修改余额或结算结果**；资金变化已全部包含在提交的状态里。

## 2. 动画队列

- 有事件的命令：`busy` 锁定期间忽略新命令（连续两次发牌/停牌只生效一次）。
- 步进节奏：`card` 220ms，其余 300ms；`motion: reduce`（或 `system` 且系统开启减少动态效果）时统一 35ms。
- 每个事件触发一次音效（`result` 且输局时播放 `card` 音），遵循静音与音量设置。
- `effectId` 为**单调递增计数器**（`effectSeq`），保证同类型连续事件也能触发动效重放——不要用数组下标或事件类型做 key。
- `generation` 代数令牌实现取消：`cancel()` 递增代数并清定时器，滞后步进自检后退出。

## 3. 刷新与后台恢复

- 每次提交即写 localStorage，因此**任意时刻刷新**（含动画中）都恢复到最近决策点或已结算结果；启动时 `useState(readSave)` 一次性载入。
- 后台标签页定时器可能被节流：`visibilitychange` 回到可见时若 `busy` 仍在，取消队列并直接呈现已提交的终态。

## 4. 跨标签页冲突

- 监听 `storage` 事件：其他标签页写入同一键后，本页取消动画、`conflict = true` 并暂停操作；`reloadLatest()` 载入最新进度后解除。
- 写入前防御：`persist` 比较 localStorage 当前值与本地 `baseline`，不一致即判定冲突并中止（`replace` 重置/导入等显式覆盖除外，传 `overwrite`）。
- 该机制是单机日常冲突保护，不是跨标签页事务协议。

## 5. 对外 API（`useGame(reduced)` 返回）

`game / busy / effect / effectId / settings / problem / conflict` + `send / updateSettings / reset / replace / reloadLatest / snapshot()`。新增保险决策与多手轮转状态沿用同一提交路径，无事件的手牌轮转也立即保存。

`problem` 取值 `"version"`（旧版/未知版本自动存档，暂停直至显式替换）、`"corrupt"`（自动存档损坏，拒绝继续写入直到导入或重置）与 `"storage"`（存储不可用，继续游戏并提示导出）。表现层只消费该 API，不直接触碰 localStorage。
