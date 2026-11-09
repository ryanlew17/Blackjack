# 竞赛应用协调

`coordinator.ts` 私有持有权威 Match，并负责提交、投影回放、输入锁和取消；`controller.ts` 包装玩家 API；`useContest.ts` 负责 React 订阅、设置读取、音效和可见性／卸载。`random.ts` 为含道具比赛提供惰性初始化、独立推进的默认数字／门控／选取／技能选择／技能效果五路流，搜索种子另有独立惰性流；含技能的显式roundRules即使无道具资源，也使用这套端口。

`createContestController` 默认保留无道具配置，正常App显式 `preset: "s2-development"` 选择标准道具开发配置；`send` 接受 Hit／Stay／NextRound、当前 `trumpCommands`／`skillCommands` 中带 `inputId` 的完整选择，或当前reaction.pass；input.ts强制human，并精确校验技能ID、Turn、反应边界和代次，不向页面开放内部ResolveForcedTurn。公开接口仅含观察，未暴露完整状态或双方受控命令端口。inputId使旧选择过期，recentEvents最多保留48条授权反馈；暂停／跳帧保留已提交反馈，换Round／重开／退出清理记录。

显式prepareSkills开启标准10项战前选择：getPreparationSnapshot／subscribePreparation提供独立只读存储，useContest同时订阅准备与比赛视图。start只打开介绍和空选，selectSkill不消费随机；confirmSkill持当前准备令牌才均匀抽AI一次并通过同一coordinator建立冻结Match。取消／返回零建场零随机，restart取消旧任务后重新必选；暂停／恢复／可见性返回作废旧令牌，准备paused时不能选择或确认。正常App显式启用prepareSkills；准备页确认、返回、设置及新比赛均沿用同一接口，确认后切换牌桌并聚焦标题。

coordinator的受控命令可执行当前15项已准入技能，权威结果先于逐帧授权回放；暂停／跳帧只落定已提交状态，不重复扣次、授权或采样。对方变形／魂迁／双生花的秘密布置投影为空事件时直接恢复稳定点，不产生busy、effectId或recentEvents变化；本人得到私有确认，实际结算先提交全部随机结果再回放。正常牌桌读取当前skillCommands提供独立球形按钮；busy／暂停／目标选择不可点击，旧技能输入在取消边界失效。

夺心魄的controlledBy标记在前一命令提交时确定，ready在稳定边界发布后复核取消代次与paused，再优先于AI策略提交一次内部ResolveForcedTurn。整段至多3次普通Hit与自动Stay先提交再回放，公共actions与controller输入不暴露内部续行；提交前暂停可保留待办，提交后暂停／跳帧不重复执行。未解决的双生花反应先于整段续行和AI思考，领域与应用共同阻止插入已提交的内部Hit。激发的Turn起始补给已在原命令中提交，重复恢复不再领取。

双生花的reaction.activate／pass仅向有真实许可的human公开，并绑定inputId、Turn与reactionBoundary；双方受控端口同样校验应用代次。领域窗口以公开身份／次数上界建立，human无法发动时静默提交PassReaction；正常AI无论真实许可是否足够均经同一异步搜索任务选择发动或放行，不以调度差异泄漏秘密消费。秘密发动与通用放行合并一次应用提交，对方完整视图与单独放行等价。pause／skip保留未决定机会但更换令牌；已放行边界不会重开，exit／restart使旧Match的同号窗口也失效。复制在下一Turn起始已完整提交，回放／恢复不再次生成；controller／Hook沿用同一公共输入网关，正式反应界面提供技能球与显式放行，等待时不抢焦点或自动消费机会。

魂迁沿用同一原始用卡提交，不另发一条被拦截的PlayTrump。原方付款与Turn保留，effects与资源事件按真正接收方投影；公开effectPlayer用于结果反馈与私有窥序授权。技能奖励和真实差量已在回放前提交，重复恢复／跳帧不再次拦截或生成。

破万法的清手／封锁／禁用与无视隐身的待办取消、Turn起始的生生不息生成及回仙次数／许可恢复均在同一次领域转换内完整提交，再投影回放；首个公开破万法帧同步施放方effectActive与对方disabled，生生不息不锁定，秘密取消只给技能本人。暂停或跳帧不重复扣次、恢复或生成，退出／重开取消旧回调。回仙反馈按效果控制者授权，回仙已进入54卡正式准入集合，普通库存仍取冻结本档数量；标准回仙为0。恢复后由重新发布的合法命令启用技能球，不自动发动。

正常useContest注入runSearchDecision，普通AI行动与反应共用可取消任务；直接controller／coordinator默认保留baselinePolicy，显式opponent注入仍优先。任务只接当前AI授权BeliefMemory、独立数值种子及单步结果回调；真实提交后、回放前更新记忆，新Match重建。每次只提交当前一步，回放后重新观察；取消释放分片迭代器，代次、权威对象及完成标记拒绝旧／重复交付。

详细时序、过期选择与暂停语义见 [状态与动画](../../../docs/design/state-and-animation.md)；规则、预设和策略边界见 [竞赛规则](../../../docs/design/contest-rules.md)。
