# 竞赛引擎

@req REQ-2026-015 @req REQ-2026-016 @req REQ-2026-019 @req REQ-2026-020 @req REQ-2026-022 @req REQ-2026-023 @req REQ-2026-024 @req REQ-2026-027 @req REQ-2026-028

纯TypeScript的Match／Game／Round／Turn状态机。正常页面使用标准含道具BO5，由应用显式注入冻结的资源／执行配置及独立随机端口；核心引擎入口不导入道具目录、执行定义或预设。

## 权威命令与随机

`createMatch(random, roundRules?, privateSetup?)`默认只需数字随机函数；开场硬币一次，每Round洗牌10次。真实资源配置与固定手牌夹具互斥，先校验再消费随机；资源模式注入numbers／trumpGate／trumpSelection三个端口；显式配置round.skills时还需skillSelection／skillEffects两个独立端口。Game每方2张、初始数字后Round各补1张，普通Hit仅门控一次，效果抽数／生成／转移不触发Hit奖励。

`transitionMatch`接Hit／Stay／PlayTrump／ActivateSkill／PassReaction／NextRound及roundNumber；技能命令还绑定skillId和turnNumber，旧Turn不得重放发动。用卡不交权，Hit／Stay交权，两次安静Stay才揭牌结算，爆牌仍可行动；非法或过期命令同一状态引用、零事件零随机。每个命令先完整提交，事件仅供回放。夺心魄受控Turn只接受绑定turnNumber的内部ResolveForcedTurn，普通输入关闭；ordinaryHit.ts复用不交权的单次Hit，整段至多3次后以同一Stay路径交权一次，爆牌继续，禁抽／空堆不造牌。

reactions.ts只在Turn开始／完整可见命令终态授权反应，roundNumber、turnNumber与reactionBoundary共同拒绝旧命令；窗口存在时正常命令关闭，仅反应方可发动双生花或PassReaction。秘密布置不推进边界且不消耗窗口，通用放行不会重开它。公开窗口只用身份与已知次数上界，真实许可仅给本人；应用静默放行human无法发动的机会；正常AI无论实际许可是否足够，都经同一异步策略入口选择发动或放行，避免公开窗口是否存在泄漏秘密消费。未配置双生花时没有额外状态或等待。

twinBloom.ts在本人下一Turn起始按私有发动序号取效果时快照，复制原始明牌值与道具定义为新ID；先删己方对应区域，保留己方原逻辑暗牌及index 0、倍率、其他留场。清理旧明牌绑定及压制依赖，不复制对方暗牌、有效贡献、留场、技能次数或来源特权；不动库存／数字堆，不采样随机。复制公开消费与结果，空替换合法无效果；Round先结束则秘密过期。所有实际变更先完成再回放，上一手悔牌窗口关闭，复制不伪记用卡／发动或重置安静Stay。

规则／状态／事件／观察深冻结，整个Match复用同一RoundRules引用。标准BO5先赢3局，Game初始目标5、同分到目标减一时+2递延，Round基础分与局／场结果只结算一次；计分先抵消再封顶，正常1–3分、护身可0；round-scored.score给出权威明细。赌命仅在Round决胜后覆盖Game胜负，保留原目标而不再递延；平局保留标记，Game清理移除。招灾输赛／嫁祸赢赛在计分和Game／Match结果之后记录nextFirstPlayer，同指Round输家；NextRound只消费一次，包括跨Game，并从覆盖后的先手继续轮换，平局与Match完成不覆盖。

## 数字、贡献与信息

数字为NumberInstance，初始1–11各一张，生成同值仍有新ID；逻辑暗牌槽位按ID保护，提前揭示不会使其可退换／绑定。contributions.ts统一计算暗牌倍率、明牌增减及结算共生；raw value不改。skillSettlement.ts先在双方揭牌后按发动序号处理变形的settlementValues，再计算倍率／绑定／同时共生；点数待办按同一顺序用共生前暗牌贡献或替罪原值快照采样，最终最低0。观察显示结算牌值和最终总和，不能在UI重新相加原值判胜；映射只保留本Round结果，新Round不继承。

`observeRound`／`observeMatch`和全部事件投影是UI／AI边界。灵闻授权发动方读取对方逻辑暗牌的value，faceDown仍为true，不写公共revealed；灵闻事件不携带暗牌数值，私有状态与全局发动序号不投影。变形布置只给本人事件和真实次数，不改公开Turn与quietStays；对方已知上界只在效果揭示时扣减，公共投影直接过滤私有事件。NumberCardView仍提供value／faceDown；faceUpCardIds只列非逻辑暗牌目标，hiddenMultipliers公开，peek最多2张且仅本人可见。deckRevision、完整scry、撤销差量、库存实例及删除账不投影；privateCards事件片段只给effectPlayer（缺省为原出牌者）；原出牌者不因持有卡体而取得重定向窥序信息。任何堆变更使窥序位置标记过期，历史已知信息不能抹去。

## 道具、效果记录与悔牌

活道具只在stock／hands，出卡及费用立即销毁；destroyed是审计，不能再次领取。TableEffect以effectId作为目标，sourceInstanceId只关联已销毁来源；最多五格，自己的同类全局替换可腾己方格，对方位置不能抵扣。先校验容量／目标／费用，再消费／执行；清除不撤销已完成的即效部分。

`trumpLegality.ts`只按授权观察列举命令；effects.ts是唯一执行入口。29个数字／留场及悔牌定义在trumps/numberDefinitions.ts，24个积分／补给／封锁及赌命定义在trumps/interactionDefinitions.ts，与trumps/skillDefinitions.ts的回仙由trumps/admitted.ts聚合为54个正式准入定义，再由应用显式注入。绑定增减统一求和后最低1，按数字ID跟随交换；回堆或删除清除绑定。共振锁定非暗牌明牌数；移花只对明确八类记录换控制方，保留来源／次数／顺序，不重放onPlay。

魂迁由soulTransfer.ts在原PlayTrump验证与消费后拦截一次，原player保留卡体／费用／行动权及消费触发，effectPlayer仅控制效果。legalEffectChoices复用授权观察的目标与容量规划，兼容旧选择优先，其余取稳定首选；无目标／满桌先跳过整张onPlay／留场，保留支付并发ineffective结果。Skill奖励悔牌先生成，独立于原卡事务，不可由悔牌退款；显式选择魂迁的规则须注入regret定义，缺失时初始化零随机拒绝。短效与从众绑定新对象下一实际Turn（当前方+2、另一方+1），不改全局行动顺序。

effectOperations.ts提供共享可逆变更，undo.ts按上一手实际差量逆转。悔牌不回滚整场快照、Turn、费用、旧卡体、库存额度或随机；撤销删除生成新ID，恢复留场生成新effectId并重映射绑定。揭牌／窥序知识不失忆；Stay不覆盖上一手，结算与非出牌变更关闭窗口，不能跨Round撤销。

## 有限触发与隐蔽费用

triggers.ts按消费前留场快照处理既有余粮，不响应本次新装、费用、领取或控制权交换操作；每张2次后离场。从众记录对方下一Turn首次合法消费，自身下一Turn起始定向检索真实副本。Turn起始以startedTurnNumber保证幂等，先清到期封锁，再按与技能共享的私有发动序号处理从众／激发补给、双生花复制与生生不息生成，最后标记受控Turn；activationSequence不投影。激发只在目标空手时领取一次，skillTurns.ts在该Turn结束按usedTrump记录无回应的同Round+99待办或ineffective，技能／Hit／费用不冒充出牌，悔牌不抹除已消费事实。静默／断供／定锚／压制／重担以明确玩家和Turn序号绑定，Stay与反制可用。压制不指向压制，目标离场时依赖同步移除；移花只换控制方，不改变压制绑定的effectId或原到期Turn。

整备／破釜费用只有本人知道身份；截流从公开规则定义声明，不能提前探查库存。撤销库存删除生成新ID到库存，旧副本仍销毁、不恢复原库存额度；恢复手牌另用其容量受限逆操作。观察仅给本人各张支付牌的容量可行性，不给差量或隐藏身份，合法提交前完成容量检查。回仙要求所选技能本Match曾实际成功且余次低于初始上限，仅本人canRecover启用恢复；按效果控制者增加1次及本Game额外1次许可，不自动发动或解除禁用。skillRecovery.ts记录真实次数、公开已知上界及许可的实际差量；悔牌只逆转仍可用额度、最低0，不回退后续发动、成功历史或知识。

onPlay补给与触发使用内部EffectRecorder，在发布每个回放帧之前同步累计实际差量，不提前写入未来领取或滞后记录扣次／离场；观察仍隐藏差量、按本帧派生容量可行性。

每命令只遍历有限定义／原记录／上一手差量，领取不递归出卡，无隐藏每Turn用卡上限。具体有限上界、短效叠加、隐私等价与满手证据见[REQ-024](../../../../docs/requirements/archive/REQ-2026-024-contest-trump-scoring-and-chains.md)。

skillBarriers.ts将破万法的所有库存封锁集中在领取入口、先于库存选取和断供消费，保留正常Hit门控。它无视隐身取消对方全部未生效待办（生生不息豁免），保留已完成结果、已经移动的数字牌与已知信息，不清桌面。首个公开帧同步提供施放方effectActive及对方disabled，生生不息不标记禁用；秘密取消事件仅给技能本人，不公开此前秘密布置。endlessLife.ts用skillEffects从冻结资源配置中数量大于0的定义等概率选型，不消耗库存或按数量加权；满手不采样，首次实际生成才记成功。生生不息发动／持续效果及直接生成牌以明确origin.skillId免疫破万法；探囊保留来源，双生花新副本不继承，其他删除和正常使用仍有效。

## 生命周期与后续边界

Round清理留场、倍率、抽数修正、窥序与事务窗口，保留未用道具、库存及当前Game审计；技能资源效果复用grantTrumps／transferTrump，探囊使用skillEffects，巧物使用普通trumpSelection；天行健按contribution删明牌并清理绑定与依赖，不归还数字堆。生生不息的待办／持续状态跨Round保留，公共封锁在施放Round之后第二个Round清理时解除；对方Game禁用独立持续至局末。Game结束清空旧资源并移除封锁、禁用与生成器，未曾生成的待办过期；新Game用新命名空间重建，保留场次数及Match内实际成功历史。初始、生成、活牌与删除按来源核账，不以固定11活数字或每Game用卡≤2M约束所有生成玩法。

prototype.ts与各测试助手不进入生产依赖图；正式预设和执行定义经精确文件白名单准入。主动技目录与资格已登记，round.skills准入全部15技；场次数跨Game保留，新Game恢复局内许可，公开发动用usedSkill打断安静Stay，不冒充道具消费。正常入口经战前必选建立含技能的标准Match，牌桌消费授权技能／反应命令，回仙已生产准入；正常AI经授权记忆驱动的组合搜索提交当前一步，回放后重新决策；没有竞赛牌面存储或经典规则耦合。
