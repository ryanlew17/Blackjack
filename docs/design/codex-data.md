# design/codex-data — 图鉴数据系统

> 关联需求：[REQ-2026-013](../requirements/archive/REQ-2026-013-codex-data.md)。
> 最后更新：2026-10-18。
> 状态：数据层已通过用户验收并归档。不是图鉴页面或竞赛玩法已上线。

## 数据与入口

| 路径                                         | 职责                                                   |
| -------------------------------------------- | ------------------------------------------------------ |
| `src/domain/contest/trumps/ids.ts`           | 21 个候选定义 ID 联合、运行时 ID 校验                  |
| `src/domain/contest/trumps/types.ts`         | 效果描述、公开条件、费用、留场及实例类型；不执行效果   |
| `src/domain/contest/trumps/catalog.ts`       | 21 个完整只读候选定义、来源、文案键；安全查找未知 ID   |
| `src/domain/contest/presets/experimental.ts` | 五档数量、最早出现难度、F1/P0 与生命周期实验元数据     |
| `src/domain/contest/codex/index.ts`          | 图鉴纯数据公开 API；不访问 DOM、浏览器存储或游戏引擎   |
| `src/presentation/i18n.ts`                   | 现有 en / zh 字典中的 21 组名称和说明（zh 对应 zh-CN） |

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

## 后续接入

应用层应先提交权威对局状态，再提交公开遭遇造成的图鉴更新，最后播放动画。S4 再将 `newlyUnlocked` 接提示、`firstUnviewedId` 接滚动，并处理查看交互；当前无页面／动画改动。禁止将引擎完整道具手牌传给图鉴观察入口。

已具备数据完整性、纯数据操作与隐藏信息边界测试；不宣称已验证未实现的道具效果、AI、游戏流程或生产浏览器行为。
