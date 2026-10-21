# 竞赛引擎（S1＋S2资源与数字效果）

@req REQ-2026-015 @req REQ-2026-016 @req REQ-2026-019 @req REQ-2026-020 @req REQ-2026-022 @req REQ-2026-023

纯TypeScript的Match／Game／Round／Turn状态机。正常页面仍是标准无道具BO5；资源与数字效果可通过显式规则及独立随机端口使用。正式卡池／应用接线在025，页面在026；引擎入口不导入候选目录、执行定义或预设。

## 权威命令与随机

`createMatch(random, roundRules?, privateSetup?)`默认只需数字随机函数；开场硬币一次，每Round洗牌10次。真实资源配置与固定手牌夹具互斥，先校验再消费随机；资源模式注入numbers／trumpGate／trumpSelection三个端口，Game每方2张、初始数字后Round各补1张，普通Hit仅门控一次，效果抽数／生成／转移不触发Hit奖励。

`transitionMatch`接Hit／Stay／PlayTrump／NextRound及roundNumber。用卡不交权，Hit／Stay交权，两次安静Stay才揭牌结算，爆牌仍可行动；非法或过期命令同一状态引用、零事件零随机。每个命令先完整提交，事件仅供回放。

规则／状态／事件／观察深冻结，整个Match复用同一RoundRules引用。标准BO5先赢3局，Game初始目标5、同分到目标减一时+2递延，Round基础分与局／场结果只结算一次；计分道具及赌命由024接入。

## 数字、贡献与信息

数字为NumberInstance，初始1–11各一张，生成同值仍有新ID；逻辑暗牌槽位按ID保护，提前揭示不会使其可退换／绑定。contributions.ts统一计算暗牌倍率、明牌增减及结算共生；raw value不改，总点数由引擎提供，观察在结算后保留结果总和，不能在UI重新相加原值判胜。

`observeRound`／`observeMatch`和全部事件投影是UI／AI边界。NumberCardView仍提供value／faceDown；faceUpCardIds只列非逻辑暗牌目标，hiddenMultipliers公开，peek最多2张且仅本人可见。deckRevision、完整scry、撤销差量、库存实例及删除账不投影；privateCards事件片段只给合法接收者。任何堆变更使窥序位置标记过期，历史已知信息不能抹去。

## 道具、效果记录与悔牌

活道具只在stock／hands，出卡及费用立即销毁；destroyed是审计，不能再次领取。TableEffect以effectId作为目标，sourceInstanceId只关联已销毁来源；最多五格，自己的同类全局替换可腾己方格，对方位置不能抵扣。先校验容量／目标／费用，再消费／执行；清除不撤销已完成的即效部分。

`trumpLegality.ts`只按授权观察列举命令；effects.ts是唯一执行入口。29个数字／留场及悔牌定义在trumps/numberDefinitions.ts，须显式注入，不代表候选目录或生产白名单已准入。绑定增减统一求和后最低1，按数字ID跟随交换；回堆或删除清除绑定。共振锁定非暗牌明牌数；移花只对明确八类记录换控制方，保留来源／次数／顺序，不重放onPlay。

effectOperations.ts提供共享可逆变更，undo.ts按上一手实际差量逆转。悔牌不回滚整场快照、Turn、费用、旧卡体、库存额度或随机；撤销删除生成新ID，恢复留场生成新effectId并重映射绑定。揭牌／窥序知识不失忆；Stay不覆盖上一手，结算与非出牌变更关闭窗口，不能跨Round撤销。

## 生命周期与后续边界

Round清理留场、倍率、抽数修正、窥序与事务窗口，保留未用道具、库存及当前Game审计；Game结束清空旧资源，新Game用新命名空间重建。初始、生成、活牌与删除按来源核账，不以固定11活数字或每Game用卡≤2M约束所有生成玩法。

prototype.ts、testHelpers.ts、numberEffectTestHelpers.ts、预设和执行定义均不在生产依赖图。025复用现有执行定义完成卡池／应用准入，026接界面，027接主动技，028最后接组合AI；没有竞赛牌面存储或经典规则耦合。
