# 竞赛 AI

@req REQ-2026-020 / REQ-2026-028

`policy.ts` 公开 BaselinePolicy、BaselineAction 与 baselinePolicy；输入为 MatchObservation 及只含 Hit／Stay 的合法动作，输出只有 Hit／Stay。使用 observation.round.viewer 对应的自身总和：<17 且可 Hit 则 Hit，否则 Stay。应用 coordinator 从私有权威状态建立 ai 观察、过滤合法动作并负责调度，策略不接完整 Match、真实随机源或存储。

策略确定、不消耗环境或发牌随机，不搜索、不主动用卡、不按目标或难度改变阈值；特殊目标下表现较弱。基线保留为注入式对照；正常useContest使用下述组合搜索。

基线及组合搜索的验收证据见 [REQ-020](../../../../docs/requirements/archive/REQ-2026-020-contest-basic-ai.md) 与 [REQ-028](../../../../docs/requirements/archive/REQ-2026-028-contest-combination-ai.md)。

## 授权候选枚举

`candidates.ts`的`decisionCandidates(MatchObservation)`从引擎观察生成冻结的`DecisionCommand[]`，包含完整目标、费用、声明、Round编号及技能Turn／反应边界。直接复用引擎合法性查询，不探测隐藏的抽取成功与否，不按静态优先级筛选或限制用卡数量。数组顺序只用于稳定枚举，不代表策略偏好。

普通Turn可包含Hit／Stay、PlayTrump、ActivateSkill；本人反应窗口只包含可发动技能及PassReaction。非本人决策、已结算和受控Turn返回空列表；NextRound与ResolveForcedTurn由协调层负责。消费命令后调用方须重新观察，不能把候选列表当作连续执行计划。

正常应用接入候选、模拟、评价与搜索。候选枚举不需要随机源，搜索使用独立种子，不扩展真实随机端口作为策略输入。

## 授权记忆与采样

从`projectMatchTransition(createMatch结果, viewer)`调用`createBeliefMemory`，之后每条已提交的授权`MatchTransitionView`只调用一次`advanceBeliefMemory`，在回放前更新。不要用展示帧、重复回放或另一观察方的事件更新记忆；新Match重新创建记忆。协调层在权威提交后、human回放前维护该记忆；取消回放不重复消费。

`memory.ts`按实例记住见过的初始／生成明牌、去向和授权暗牌知识；`faceUpOrigins`仅为已有公开明牌ID补充来源类型，不暴露暗牌ID或堆内身份。无法从帧变化确定去向时记为`unlocated`，不擅自判定删除。窥序当前位置只读最新观察；历史已见值不绑定旧位置。Round切换清数字、窥序与本Round机会；Game切换清道具账和Game机会，Match内技能消耗的不确定性保留。

`buildBelief`返回暗牌支持集、库存数量／逐定义上下界、对手手牌候选权重和技能次数／Game许可／秘密待办分支。指定抽取公开失败只约束当时牌堆，返牌等新增后撤销旧缺失约束。道具按库存副本、生成定义、转入身份分别形成候选；已知库存销毁按原始owner去重，悔牌新建库存副本单独计入，公开转入身份在未知支付后只作为可能仍持有的身份。双生花复制己方手牌时使用已授权的定义集合。

`sampleBelief(memory, seed)`采样暗牌、数字堆与技能分支；`sampleStock(memory, player, seed)`采样库存。数字按实例无放回并固定当前窥序前缀，允许生成副本与原暗牌同值；库存按剩余初始副本及额外生成副本采样。未知数字／技能分支采用均匀先验，手牌是各获取渠道的边际候选权重，不是已构造的联合模拟状态；联合实例分配由下述模拟模块完成。

`contest/random.ts`的`seededRandom`是可复现的本地流，应用原五路真实流与信念采样复用同一算法但各自持有种子和游标。信念API只收数值种子，不接受真实随机函数；不接UI、不保存对局，不推进真实抽牌／资源／选技／技能效果流。

## 观察驱动模拟

`../simulation`只公开`createSimulation(memory, seed)`及不可变`Simulation`。从稳定playing／acting观察建立根节点；构造器须重现输入观察的全部授权字段。内部将数字／库存样本、手牌数量、已知转入与生成来源组成假设状态，已知实例保留ID，未见实例使用模拟ID；隐藏身份和技能待办是该种子的假设，不是后台真值。

- `observe(viewer)`给出该假设的对应玩家投影；对手投影只用于模拟对手回应，不能交给真实玩家或替代真实授权记忆。
- `candidates(viewer)`枚举当前单步候选；模拟内另提供NextRound及ResolveForcedTurn推进生命周期，生产策略仍只能提交其当前授权的一步。
- `step(command, seed)`返回accepted、独立分支及根观察方的授权transition。它直接调用现有`transitionMatch`；每步使用独立模拟随机流，旧节点不变，无效命令返回原分支。调用者负责为分支提供可复现种子。

记忆保留当前悔牌窗口的授权事件帧、已见能力相对顺序及成功历史。模拟内部由帧差重建效果撤销见证，出卡成本和魂迁奖励不计入；后续模拟命令的差量完全由引擎产生。留场的suppressed仍由引擎派生；生成库存不占原始副本，生生不息免疫只随已知／假设的实际生成来源附着。隐蔽补给后被技能转出的历史槽位可在假设中记为已离手的身份，悔牌不据历史位置删除当前另一张牌。技能视图的`publicRemainingUses`保留公开次数上界，即使本人知道更低的真实余量也不把秘密支出写入公共上界。

固定完整已知场景对照数值、资源、结算和身份绑定；未见的未来实例ID可与真实引擎不同。未知分支沿用当前信念先验，非精确后验。正常资源规则支持Round／Game推进；无资源的显式测试手牌仅用于当前Game效果对照，私有fixture重发配置不从观察推断。终局可由step到达，不作为新的决策根。

内部hydrate／undo不能由AI直接导入，公共接口不暴露MatchState。模拟节点缓存自身不可变观察，step的授权transition按首次读取投影并缓存；搜索仅消费后继时不生成回放投影。生产搜索仅经此公开门面进入模拟模块。

## 动态评价与单步启发式

从当前授权记忆调用`chooseHeuristic(memory, seed)`，得到当前一步的完整合法命令；其他人的Turn、受控Turn和已结算状态返回null。`rankDecisions`提供每个合法候选的平均价值及反制风险，供测试和后续搜索使用。所有候选共用4个根假设与模拟种子，避免分别采样造成的比较噪声；价值在0.05以内时优先Stay／PassReaction，其余按稳定命令排序用独立种子择一。当前参数见[AI设计](../../../../docs/design/contest-rules.md#评价参数)，固定反例见evaluation.test.ts与search.test.ts。

`evaluateSimulation(simulation, viewer, seed)`为模拟假设提供叶评价：只用Stay、反应放行和内部受控续行收束当前Round，再从引擎结算投影读取积分、Game及Match结果。额外探测一次对方Hit，按下行差值扣除反制风险。目标、共生、倍率、赌命及技能结算全部由引擎执行。此接口输出score、standing、counter与risk；`settledValue`只接受已结算的模拟节点，给出胜场、积分、资源分量。

未来资源项按剩余手牌及功能、可领取库存、场技能次数、Game许可和持续生成器估值。Game结束后不再计旧手牌／库存／许可，场技能次数仍有价值；Match结束只保留±100胜负值。封锁按预计剩余Round扣除补给／许可机会。资源与反制系数是统一启发式，不是胜率概率。

`fallbackDecision(observation)`不采样、不枚举道具目标／费用：按当前目标与自身有效总分给出Hit／Stay，复用引擎ordinaryHitAvailable尊重空堆和Hush；反应只放行，非己方或受控Turn返回null。有限搜索用它作为尚未完成第一层时的合法起点，已有完整层时保留该层结果。

单步启发式不展开连续用卡、对方道具／技能回应或未来Round；需要组合与回应时使用下面的有限搜索。

## 有限组合搜索

`searchDecision(memory, seed)`返回`{ command, values, stats }`：command只有当前一步，values仅是最近完整深度下全部根候选的样本平均分，stats记录模拟步、树节点、叶评价、截断与回退。不可决策时command为null。执行结果提交／回放后更新授权记忆并重新调用，不缓存模拟的未来命令。

五档共用`SEARCH_BUDGET`：4个共同假设、最大6层命令、1,200次模拟step请求（含缓存命中）。逐层加深，按真实行动方／反应方作max/min；同Turn多卡、技能、放行和受控续行均经现有模拟接口。alpha-beta只剪当前假设的树；根候选不截断，没有真实出卡上限。到当前Round结算为止，不搜索下一Round。

单次搜索按完整命令与模拟种子复用同一节点后继及候选，不跨决策／假设缓存。nodes保守计入缓存命中，cacheHits单列，实际transition次数为nodes−cacheHits。计数包括根动作、树内推进和叶收束；第一层尚未完成时用快速合法起点，之后预算耗尽保留最近完整层。不会把某个根的部分样本均值和其他完整结果比较。等价容差为0.05，优先Stay／PassReaction；非安静Stay可能将资源消耗推迟到下一个Turn，后续必须重新观察安静记录及合法动作。可选SearchBudget参数用于固定实验和统一调优，不按难度覆盖。

不同根共用假设与模拟随机种子；对手回应从该假设的对手观察枚举。未来策略在每个假设内分别求值，尚未聚合同信息集策略，是有限采样近似。函数不接真实MatchState、随机函数或时钟；未获授权真值的变化不影响相同输入／种子结果。

searchDecisionSteps与evaluateSimulationSteps在构造根假设及每次模拟推进前yield；同步API排空同一迭代器，保持选择和计数相同。应用decision.ts每片最多64次推进或8ms后让出事件循环（原子步骤不被中断），取消即释放迭代器，不交付部分结果。正常useContest注入该异步任务；直接创建controller／coordinator仍默认基线，也可显式注入opponent作对照。独立搜索种子不推进真实五路随机；普通Turn与AI反应共用任务，每次只交付一步。性能按真实分片的活动时间之和记录，另报告含调度等待的延迟；固定基准及完整对抗证据归REQ-028。验收结论和测量入口见[REQ-028](../../../../docs/requirements/archive/REQ-2026-028-contest-combination-ai.md)。
