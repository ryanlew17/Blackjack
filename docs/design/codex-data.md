# design/codex-data — 图鉴数据系统

> 关联需求：[REQ-2026-013](../requirements/archive/REQ-2026-013-codex-data.md)。
> 最后更新：2026-10-22。
> 状态：数据层已通过用户验收并归档。不是图鉴页面或竞赛玩法已上线。

## 数据与入口

| 路径                                         | 职责                                                          |
| -------------------------------------------- | ------------------------------------------------------------- |
| `src/domain/contest/trumps/ids.ts`           | 54个稳定定义ID及运行时校验                                    |
| `src/domain/contest/trumps/catalog.ts`       | 名称／说明键、标签、真实来源和准入；execution引用唯一执行对象 |
| `src/domain/contest/trumps/admitted.ts`      | 023／024的53个执行定义精确集合，回仙未准入                    |
| `src/domain/contest/presets/resources.ts`    | 54卡五档副本数量；运行时显式过滤已准入ID                      |
| `src/domain/contest/presets/s2.ts`           | 冻结标准BO5开发输入，非S3平衡预设                             |
| `src/domain/contest/presets/experimental.ts` | 隔离的历史21卡F1/P0元数据，不供图鉴当前可用性查询             |
| `src/domain/contest/codex/index.ts`          | 图鉴纯数据API，不读写DOM／存储                                |
| `src/presentation/i18n.ts`                   | en／zh-CN两字典的54组名称和说明                               |

REQ-025将旧21候选目录收敛为当前54卡目录，不再维护另一套候选onPlay／table描述；53项 `playable: true`、`admission: admitted`，execution引用原执行器数据。回仙为 `playable: false`、`admission: pending-skill`、`execution: null`，由027完成执行与准入。项目原创来源使用REQ-021／REQ-022，不伪造外部检索来源；原有来源保留。

普通库存资格取决于当前难度数量和准入，最终54卡39/61/73/76/78；当前53卡运行值39/61/73/75/77。标准61不受回仙延后影响。库存、目录和运行实例分离并深层冻结，无earliestDifficulty。旧F1/P0的16/22/26/29/30仅作历史回归；目录完整和开发准入不代表五档平衡或图鉴页面已交付。

## 图鉴进度

`CodexProgress` 为定义 ID 到 `{ unlocked, viewed }` 的稀疏只读映射，兼容存档草案的字段形态。缺省条目或 false/false 为未解锁，true/false 为未查看，true/true 为已查看；false/true 非法。本模块接收由创建函数或校验器得到的可信进度，外部负载先校验。

- `createCodexProgress()` 创建空进度。
- `recordEncounter(progress, mode, observation)` 只处理已投影的遭遇：自己实际领取，或对手公开使用／产生可见作用，可解锁候选；重复遭遇保留已查看状态，不再次产生提示 ID。
- `opponent-hidden` 观察没有 cardId 字段，不读取隐藏身份；`custom` 模式直接保持原进度，不解锁。这里的 `standard` 指普通非自定义比赛，与五档中的 standard 难度是不同概念。
- `markViewed(progress, cardId)` 仅更新已解锁条目，不会靠“查看”解锁；重复操作不变。
- 更新返回新的冻结进度与 `newlyUnlocked` 列表，未知 ID 返回错误码；不抛 UI 文案、不自行持久化。非法游戏命令不应生成遭遇事件，难度升级也不调用此 API。
- `listCodexItems` 固定按目录顺序返回三态；未解锁仅有 ID 与状态，没有名称、效果、标签或难度数据。已解锁条目带只读定义与当前54卡数量可用性（回仙元数据不等于生产准入）。
- `firstUnviewedId`、`codexSummary` 提供首个未查看项与统计；`listUnlockedIds` 只返回已解锁 ID，并不代替自定义卡池准入／依赖验证。

## 负载校验边界

`parseCodexProgress(unknown)` 原子验证纯对象、已知 ID、精确的两个布尔字段与 viewed ⇒ unlocked。任何错误均返回错误码，不部分接纳、不修改原输入；通过后复制并冻结，避免调用者修改原对象影响已接纳数据。拒绝原型键、未知卡、数组、额外实例字段和不合法状态。

本模块只验证图鉴子负载，不能把任意完整 JSON 当成已验证存档。尚无存储键写入、信封版本解析、导入确认、冲突处理、难度通关更新。上述仍遵循 [竞赛存档草案](../contracts/contest-save-format.md)，由 S3/S4 接线。

## REQ-021 规则定稿与元数据调整（2026-10-21）

候选类型／21条预设已删除earliestDifficulty，数量表是唯一资格依据；既有21卡执行数据、ID与F1/P0旧数值保留为研究历史回归，未开启playable。新 [51卡表](../requirements/archive/REQ-2026-021-contest-trump-rule-contract.md#a-51卡规则限量与概率) 和 [运行契约](../requirements/archive/REQ-2026-021-contest-trump-rule-contract.md#b-道具数据与运行契约) 是022–025实现输入，025扩展精确ID、目录与双语键并逐卡准入；不能把旧16/22/26/29/30误认作新版总上限。概率门控递增、普通实例等概率及限量规则由REQ-021定稿，正式五档对抗平衡仍在S3。

## 后续接入

应用层应先提交权威对局状态，再提交公开遭遇造成的图鉴更新，最后播放动画。S4 再将 `newlyUnlocked` 接提示、`firstUnviewedId` 接滚动，并处理查看交互；当前无页面／动画改动。禁止将引擎完整道具手牌传给图鉴观察入口。

已具备数据完整性、纯数据操作与隐藏信息边界测试；不宣称已验证未实现的道具效果、AI、游戏流程或生产浏览器行为。

## 最新54卡及主动技目录边界（资源／数字执行已实现，正式目录／技能待后续）

[REQ-022](../requirements/archive/REQ-2026-022-contest-trump-resources.md)已在资源预设中将历史51卡追加悔牌／回仙／赌命并验证39/61/73/76/78；025再将54个稳定道具ID接入正式目录，先准入53可执行卡，027完成回仙第54卡。REQ-025已将稳定ID、双语键和CodexProgress已知ID范围扩为54，53卡准入、回仙保留未准入；旧51表和数学结果保持原输入。

[REQ-023](../requirements/archive/REQ-2026-023-contest-trump-effects.md)已在trumps/numberDefinitions.ts交付28项既定数字／留场定义及悔牌共29个执行定义，025应复用这份数据与024后续定义完成唯一生产目录，不重新实现数字卡。REQ-025复用这29个定义与024的24个定义建立53卡准入集合，元数据execution引用同一对象，不复制效果；图鉴纯数据接当前目录，页面与存储仍待S3/S4。

[REQ-027](../requirements/active/REQ-2026-027-contest-active-skills.md)登记15主动技，资格由可玩难度与该档场次数>0推导。S4图鉴增加独立主动技页／页签，技能描述与五档次数公开展示；技能ID和场次数不是道具遭遇ID／解锁查看字段，不混入现有cardId白名单，也不为介绍页新增对局持久化。未来技能扩充统一回链[长期计划](../roadmap.md#长期主动技扩充计划2026-10-21)。
