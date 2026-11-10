# design/state-and-animation — 状态协调与动画队列行为快照

> 适用范围：经典 useGame 的权威状态、队列、恢复与冲突；竞赛 controller/useContest 的内存提交、投影回放、组合搜索与取消。
> 何时读取：改经典／竞赛协调、动画节奏、内存或持久化提交、取消及冲突处理前。
> 关联需求：REQ-2026-003–006、REQ-2026-017、REQ-2026-025–028。
> 最后更新：2026-11-10
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

## 6. 竞赛权威状态与公共视图

coordinator私有持有完整MatchState，controller提供human公共接口，useContest通过useSyncExternalStore订阅比赛与独立preparation存储。snapshot()返回权威human观察，view.match返回当前展示帧；两者都不包含完整牌堆、未获授权的对手暗牌、隐藏库存顺序或撤销差量。页面不持有受控双方sendCommand、完整Match或调试开关。

默认controller仍可创建无道具比赛；正常App显式使用s2-development与prepareSkills，先选技能再创建固定标准含道具BO5。规则、资源及双方技能选择整场冻结。useContest只读共享设置中的motion、muted、volume，设置仍经经典API保存；竞赛不读写对局／元进度，不监听竞赛存储冲突。

## 7. 命令提交、投影与回放

每次命令先由transitionMatch原子计算全部效果／触发及权威终态并提交内存，再按human权限回放事件与每帧快照。PlayTrump与自己Turn的技能不交权，可继续同Turn决策；Hit／Stay才交权。NextRound只继续已完成Round／Game，不重新计分。动画、音效和回放回调不扣次、采样、判胜或决定行动方。

发牌／Hit为220ms，其余事件300ms，减少动态35ms；AI正常思考等待300ms。effectId在协调器生命周期内跨事件／重开单调递增。每段回放落定后重新读取权威行动方，不把一个事件当作Turn结束；busy覆盖回放与AI等待，paused独立锁定输入。

recentEvents最多保留48条已授权反馈；逐帧记入，ready不清空，换Round／重开／退出清理。pause／skip落定时补齐剩余已提交反馈，但不补音效或重新执行。undo-window-closed仅说明公开撤销边界，不投影EffectDelta；当前窥序只来自有效round.peek，历史不重放已失效的位置数值。

技能事件先按viewer过滤。对方变形／魂迁／双生花的秘密布置没有公开回放帧，应用直接恢复稳定点，不改变对方busy、effectId、recentEvents、安静记录或消费标志；本人仍有私有确认。两次公开安静Stay关闭Round后，揭牌、变形、点数调整、胜负／积分／赌命及先手覆盖在一次权威提交中完成，再播放公开结果。

魂迁仍是一次原始PlayTrump：原方先验证／支付，秘密待办再公开拦截；效果控制权、目标／容量失败及生成悔牌均在同一提交中确定。投影保留原player，公开拦截后给effectPlayer；privateCards与窥序只给真正效果控制者，费用身份仍只给支付者。

破万法先完成清手、Round封锁、对方Game禁用及无视隐身的待办取消。首个公开帧同步施放方effectActive与对方disabled，之后才逐张回放清手；生生不息不锁定。秘密取消只给技能本人，不向施放方补历史或真实次数。生生不息生成和来源标签、回仙实际次数／额外许可也先一次提交；恢复／跳帧不重抽、重复恢复或重复生成。回仙本人canRecover来自Match内实际成功历史，待办或无效果不启用；恢复不解除禁用，悔牌只逆转仍可用的实际额度。

## 8. 战前选择与公共输入

start只打开标准10项介绍与空选，不建Match。selectSkill不采样，confirmSkill验证必选和当前准备inputId后，才用独立skillSelection从同一集合均匀选AI一次并建立冻结Match。确认令牌在采样前消费，重入确认或采样回调取消不能继续旧建场。取消／返回不建场、不消费随机；restart取消旧任务后回空选，exit清除准备与比赛。

准备paused时不能选择或确认；选择变化、暂停／恢复、可见性返回、取消／重开／退出作废旧准备令牌。准备与比赛输入代次独立。正常页面切换准备／牌桌时聚焦新标题，准备页返回直接取消。

比赛公共输入为Hit／Stay／NextRound及当前trumpCommands、skillCommands、reaction.pass中的结构化命令。合法列表只从权威human观察生成，不从动画中间帧计算；busy／paused期间为空。input.ts强制human，技能／反应精确匹配inputId、skillId、Turn及reactionBoundary，用卡仍由同一transitionMatch检查目标／费用／声明。内部ResolveForcedTurn不属于玩家输入。

输入不排队：非法、非行动方、重复或旧代次提交零副作用。每次成功提交、pause、skip、exit、restart使旧牌桌选择失效；恢复必须取得新命令，不自动提交旧目标。道具选择本身是玩家决策，不暂停当前Turn；onChoiceChange禁用技能球，Esc／取消不提交，代次变化关闭旧选择。规则／设置／技能说明等外部面板沿用pause／resume。

## 9. Turn起始、反应与受控续行

Turn起始先清到期限制，再按共同私有发动序号处理从众、激发监控、双生花复制与生生不息生成，最后标记受控Turn；私有startedTurnNumber保证幂等，序号不投影。全部起始待办已在前一命令提交中完成，重复订阅／恢复不会再处理。

双生花只在对方Turn起始及完整可见命令终态授权反应，绑定Match的roundNumber、Turn与reactionBoundary；秘密命令及PassReaction不推进公开边界。同一已放行边界不因恢复重开。公开窗口只取身份和已知次数上界；本人真实许可不足时应用静默合法放行，AI无论是否仍有真实许可都进入同一异步决策入口，选择发动或放行；秘密发动与PassReaction合并提交。

human有实际许可时，稳定点发布reaction.activate／pass并等待明确选择；等待期间不启动AI计时、普通命令或整段受控续行。秘密发动与通用放行合并一次应用提交／取消代次，对方完整视图与单独放行等价。pause／skip保留未决定机会但更换inputId；恢复取得同一领域边界的新令牌。说明Esc不等于放行，成功放行后界面焦点回本人说明。

夺心魄在起始待办后公开controlledBy；正常输入关闭。应用在前一段回放落定的稳定边界，优先于AI策略提交一次内部ResolveForcedTurn；同一Turn内完成至多3次普通Hit及自动Stay，只在最后交权一次。每次Hit复用数字余量、禁抽、门控与补给，爆牌继续，空堆／禁抽只做合法部分；全部先提交再逐步回放，不是三个外部Hit，期间不能插入技能或用卡。

稳定边界发布后复核取消代次与paused，订阅者同步暂停／退出／重开可阻止旧续行。提交前暂停保留待办，提交后暂停／跳帧只落定已提交终态。双生花反应优先于该整段提交，不依赖抢点300ms间隙。

## 10. 取消、可见性与生命周期

pause／skip／exit／restart取消队列及AI任务，滞后回调逐次检查generation，策略返回后再次检查。pause先落定已提交反馈，恢复按权威行动方重新授权；exit丢弃Match，restart重新选技，即使新Match的Round／Turn同号也不能重用旧命令。

useContest在不可见时调用setVisible(false)：落定已提交回放并取消搜索、禁用输入；恢复可见后只按当前权威边界重新决策，不续跑旧迭代器。两次可见性切换均使牌桌／准备选择令牌失效，显式paused保持暂停。卸载移除visibilitychange监听并退出。刷新回首页，竞赛Match／技能次数／待办全部丢弃，经典仍按§1–5恢复。

普通AI行动与AI反应都先等待300ms，再由decision.ts分片运行搜索。任务只接当前ai授权BeliefMemory、独立数值种子和单步结果回调；每次提交在回放前更新记忆，新Match重建。每片最多64次yield或8ms，定时器让出事件循环，取消释放迭代器；generation、权威对象和完成标记拒绝旧／重复回调。真实五路随机不进入搜索，选技仍独立均匀随机。正常Hook注入搜索；直接controller／coordinator及显式opponent注入保留旧基线。性能测量同时记录活动片段总计算、含调度等待的决策延迟及最大片段；证据归REQ-028。

Round清理保留场次数和Game许可，清除本Round知识／待办与效果；生生不息按明确规则跨Round保留。Game清理移除封锁、禁用与生成器，新Game保留Match次数和实际成功历史、恢复基本一次许可并重建资源。具体规则见[竞赛规则](./contest-rules.md)，实际验收证据留在对应需求。
