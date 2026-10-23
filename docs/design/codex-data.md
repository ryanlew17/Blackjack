# design/codex-data — 图鉴数据系统

> 适用范围：已实现的目录／图鉴纯数据API及后续接线边界；图鉴页面和元进度存储尚未接入。
> 当前目录登记54个稳定道具ID，53个具备已准入执行定义；回仙待[主动技需求](../requirements/active/REQ-2026-027-contest-active-skills.md)实现后准入。

## 数据与入口

| 路径                                         | 职责                                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| `src/domain/contest/trumps/ids.ts`           | 稳定定义ID及运行时校验                                      |
| `src/domain/contest/trumps/catalog.ts`       | 双语键、标签、真实来源及准入状态；execution引用唯一执行对象 |
| `src/domain/contest/trumps/admitted.ts`      | 生产执行定义的精确集合                                      |
| `src/domain/contest/presets/resources.ts`    | 各难度副本数量，运行时按准入ID过滤                          |
| `src/domain/contest/presets/s2.ts`           | 冻结标准BO5开发配置，非五档平衡结论                         |
| `src/domain/contest/presets/experimental.ts` | 隔离的历史F1/P0元数据，不参与当前图鉴可用性查询             |
| `src/domain/contest/codex/index.ts`          | 纯数据API，不读写DOM／存储                                  |
| `src/presentation/i18n.ts`                   | en／zh-CN名称与说明                                         |

目录中53项为 `playable: true`、`admission: admitted`；回仙为 `playable: false`、`admission: pending-skill`、`execution: null`。execution直接引用numberDefinitions／interactionDefinitions，不复制另一套效果描述。原创来源使用项目设计标识，原版来源与差异见[道具资料](./contest-trumps.md#c-原版资料与完整引入台账)。

普通库存资格取决于难度副本数和执行准入，两者分开校验；目录完整不代表所有定义均可生成。数量表是唯一难度资格依据，无earliestDifficulty。目录、库存预设与运行实例分离并深冻结；历史21卡实验值只用于原基线回归，不表示当前可玩卡池或五档平衡。

## 图鉴进度

`CodexProgress`为定义ID到 `{ unlocked, viewed }` 的稀疏只读映射。缺省或false/false为未解锁，true/false为未查看，true/true为已查看；false/true非法。外部负载必须先校验。

- `createCodexProgress()`创建空进度。
- `recordEncounter(progress, mode, observation)`仅消费已投影遭遇：自己实际领取，或对手公开使用／产生可见作用；重复遭遇保留已查看状态，不重复提示。
- `opponent-hidden`没有cardId，不能读取隐藏身份；`custom`不解锁。此处standard指非自定义比赛，与standard难度不同。
- `markViewed(progress, cardId)`仅更新已解锁项；重复操作不变。
- 更新返回新的冻结进度与newlyUnlocked；未知ID返回错误码，不抛UI文案、不自行持久化。非法命令不产生遭遇，难度升级不调用遭遇API。
- `listCodexItems`按目录顺序返回三态；未解锁仅含ID与状态，已解锁含只读定义和数量可用性，不能把回仙元数据当生产准入。
- `firstUnviewedId`、`codexSummary`用于首项与统计；`listUnlockedIds`不代替自定义卡池准入／依赖校验。

## 负载与信息边界

`parseCodexProgress(unknown)`原子校验纯对象、已知ID、精确两个布尔字段及viewed ⇒ unlocked。错误返回错误码，不部分接纳、不修改输入；通过后复制冻结。拒绝原型键、未知卡、数组、额外实例字段和非法状态。

本模块只验证图鉴子负载；完整信封、版本、导入确认、冲突与难度通关更新尚未接入，见[竞赛元进度草案](../contracts/contest-save-format.md)。UI或策略不能把完整道具手牌传给遭遇入口；解锁只使用接收方有权知道的身份。

## 接入与扩展条件

| 触发条件                   | 原位维护要求                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 新增／调整定义、数量或准入 | 同步稳定ID、唯一执行引用、真实来源、双语键、图鉴校验与数量查询；移除失效描述，不另建候选目录。              |
| S3元进度存储接入           | 依据完整信封契约明确校验、写入失败和冲突边界；保留图鉴子负载与完整存档的区别。                              |
| S4图鉴页面集成             | 将三态、提示、首个未查看项、查看交互和存储接线统一成当前数据流；删除已失效的未接入说明，验证证据归对应REQ。 |
| 主动技介绍或后续扩充       | 技能独立页／页签公开条件与五档次数；资格从难度与次数派生，不向道具CodexProgress写技能ID或增加对局存档。     |

遭遇接线按“提交权威对局 → 提交授权遭遇的图鉴更新 → 回放”维护，存储失败不回滚内存牌面。Agent在上述工作发生时检查本文件：既有API／职责变化改写原章节，形成独立新职责才增加主题；未实现部分保持明确标识，不追加实施与验收记录。
