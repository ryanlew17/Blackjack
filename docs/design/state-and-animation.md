# design/state-and-animation — 状态协调与动画队列行为快照

> 适用范围：经典 useGame 的权威状态、队列、恢复与冲突；竞赛 controller/useContest 的内存提交、投影回放、占位对手与取消。
> 何时读取：改经典／竞赛协调、动画节奏、内存或持久化提交、取消及冲突处理前。
> 关联需求：REQ-2026-003–006、REQ-2026-017。
> 最后更新：2026-10-20
> 来源：2026-09-22 重构定稿（effectId 单调计数器）

以下 §1–5 为经典模式，竞赛见 §6。

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

## 6. 竞赛内存协调（REQ-017）

`application/contest/controller.ts` 用闭包保存完整 MatchState，useContest 是 React 订阅适配。初始闲置，start 明确开场，不读取／恢复存档；exit 丢弃 Match，restart 取消旧任务后新开。经典 useGame 与其持久化顺序保持不变，未提取 shared 队列。

每次 send 先由 transitionMatch 计算完整结果、同步提交权威内存状态，之后回放 human 投影事件与逐事件快照；动画不扣分、不计分、不决定下一行动方。snapshot() 返回权威 human 观察，match 字段返回当前展示帧，两者都没有牌堆或对手未揭暗牌。busy 在回放／AI 等待时锁定输入，暂停也锁定；human 命令不允许指定 AI 身份，非法动作保持原状态。

发牌和 Hit 220ms，其余 300ms；减少动态效果为 35ms，effectId 跨事件及重开单调递增。skipAnimations 取消回放并落定已提交状态。回放／思考等待使用同一取消代次，exit/restart/pause/skip 会使滞后回调失效；暂停结束按权威行动方恢复，不能把一次事件回放等同于 Turn 结束。PlayTrump 尚未实现，其实际同 Turn 联动随 REQ-019 验证。

队列结束后若权威状态是 AI 的 Turn，等待 300ms，再调用占位策略；只输入 ai 观察和合法 Hit/Stay，不传完整状态或真实随机源。自身总和 <17 且 Hit 合法时 Hit，否则 Stay。对手此前 Stay 后重新获得行动权时会再次决策；玩家 Turn、回合／Game 间隙和 Match 终态均不触发 AI。

useContest 通过参数只读既有设置中的 motion、muted、volume，复用音效模块；设置更新仍由既有 API 负责。回到可见时跳过正在回放的帧，卸载时移除 visibilitychange 监听并退出；竞赛不监听存储冲突、不写任何对局或元进度。应用公共 API 仅含观察、投影事件、输入状态及控制方法。

本项测试覆盖控制器与真实引擎的异步时序和 React 服务端闲置初始化。客户端挂载、卸载／可见性事件分发和实际音效未做浏览器验收，随 REQ-018 的 UI 接线验证；不能把服务端渲染测试视为浏览器证据。
