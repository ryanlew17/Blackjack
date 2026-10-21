# design/codex-data — 图鉴数据系统

> 关联需求：[REQ-2026-013](../requirements/archive/REQ-2026-013-codex-data.md)。
> 最后更新：2026-10-21。
> 状态：数据层已通过用户验收并归档。不是图鉴页面或竞赛玩法已上线。

## 数据与入口

| 路径                                         | 职责                                                   |
| -------------------------------------------- | ------------------------------------------------------ |
| `src/domain/contest/trumps/ids.ts`           | 21 个候选定义 ID 联合、运行时 ID 校验                  |
| `src/domain/contest/trumps/types.ts`         | 效果描述、公开条件、费用、留场及实例类型；不执行效果   |
| `src/domain/contest/trumps/catalog.ts`       | 21 个完整只读候选定义、来源、文案键；安全查找未知 ID   |
| `src/domain/contest/presets/experimental.ts` | 五档数量、F1/P0 与生命周期实验元数据                   |
| `src/domain/contest/codex/index.ts`          | 图鉴纯数据公开 API；不访问 DOM、浏览器存储或游戏引擎   |
| `src/presentation/i18n.ts`                   | 现有 en / zh 字典中的 21 组名称和说明（zh 对应 zh-CN） |

以下21候选与F1/P0数据为REQ-013实现快照；当前执行与正式目录边界见文末。

卡片定义支持有序 `onPlay` 和可选 `table` 同时存在。留场、替换、叠加、费用和失败消费均有结构化描述，执行器留待 S2。库存不写入定义，数字牌 ID 与运行实例 ID 不混用。目录与预设深层冻结，五档每方库存合计 16/22/26/29/30。

所有候选均为 `playable: false`，准入状态为 prototype/experiment；数据完整不代表参数通过平衡或效果通过引擎验收。正式比赛卡池与存档白名单必须在 S2/S3 另行准入，不能直接使用整个研究目录。

## 图鉴进度

`CodexProgress` 为定义 ID 到 `{ unlocked, viewed }` 的稀疏只读映射，兼容存档草案的字段形态。缺省条目或 false/false 为未解锁，true/false 为未查看，true/true 为已查看；false/true 非法。本模块接收由创建函数或校验器得到的可信进度，外部负载先校验。

- `createCodexProgress()` 创建空进度。
- `recordEncounter(progress, mode, observation)` 只处理已投影的遭遇：自己实际领取，或对手公开使用／产生可见作用，可解锁候选；重复遭遇保留已查看状态，不再次产生提示 ID。
- `opponent-hidden` 观察没有 cardId 字段，不读取隐藏身份；`custom` 模式直接保持原进度，不解锁。这里的 `standard` 指普通非自定义比赛，与五档中的 standard 难度是不同概念。
- `markViewed(progress, cardId)` 仅更新已解锁条目，不会靠“查看”解锁；重复操作不变。
- 更新返回新的冻结进度与 `newlyUnlocked` 列表，未知 ID 返回错误码；不抛 UI 文案、不自行持久化。非法游戏命令不应生成遭遇事件，难度升级也不调用此 API。
- `listCodexItems` 固定按目录顺序返回三态；未解锁仅有 ID 与状态，没有名称、效果、标签或难度数据。已解锁条目带只读定义与实验可用性。
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

[REQ-022](../requirements/archive/REQ-2026-022-contest-trump-resources.md)已在资源预设中将历史51卡追加悔牌／回仙／赌命并验证39/61/73/76/78；025再将54个稳定道具ID接入正式目录，先准入53可执行卡，027完成回仙第54卡。当前运行目录仍是21候选，本次不改ID、playable或既有CodexProgress校验；旧51表和其数学结果保持原输入。

[REQ-023](../requirements/archive/REQ-2026-023-contest-trump-effects.md)已在trumps/numberDefinitions.ts交付28项既定数字／留场定义及悔牌共29个执行定义，025应复用这份数据与024后续定义完成唯一生产目录，不重新实现数字卡。当前21候选ID／playable及图鉴校验未变，29个已执行定义不等于29张已准入生产／图鉴卡。

[REQ-027](../requirements/active/REQ-2026-027-contest-active-skills.md)登记15主动技，资格由可玩难度与该档场次数>0推导。S4图鉴增加独立主动技页／页签，技能描述与五档次数公开展示；技能ID和场次数不是道具遭遇ID／解锁查看字段，不混入现有cardId白名单，也不为介绍页新增对局持久化。未来技能扩充统一回链[长期计划](../roadmap.md#长期主动技扩充计划2026-10-21)。
