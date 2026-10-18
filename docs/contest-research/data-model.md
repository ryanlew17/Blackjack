# 数据结构草案

这是最初研究用 TypeScript 示意，不代表已冻结的正式玩法 API。REQ-013 已据此实现候选数据层；当前实际模块与公开 API 以 [图鉴数据快照](../design/codex-data.md) 和源码为准，下列片段保留作研究背景。采用四层数据：**定义是什么、实例在哪、预设发多少、玩家见过什么**。来源记录单独保存，不进入运行时状态。正式实现遵循 [ADR-004](../adr/ADR-004-contest-turns-and-shared-boundaries.md)。

## 1. 定义与结构化效果

```ts
type Difficulty = "easy" | "standard" | "challenge" | "danger" | "nightmare";
type Side = "self" | "opponent";
type NumberValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
// 正式实现从已准入目录推导精确 ID 联合，不允许任意存档字符串。
type TrumpId = string;
type MessageKey = string; // 实现时约束为 en / zh-CN 均存在的键。
type Tag =
  | "buff"
  | "debuff"
  | "both"
  | "number"
  | "rule"
  | "score"
  | "resource"
  | "counter"
  | "defense";

type ImmediateEffect =
  | { kind: "drawNumber"; value: NumberValue }
  | { kind: "returnLastFaceUp"; target: Side }
  | { kind: "swapLastFaceUp" }
  | { kind: "removeTable"; target: Side; scope: "latest" | "all" }
  | { kind: "drawBest"; algorithm: "highest-safe-else-lowest" }
  | { kind: "grantTrump"; target: Side; count: number };

type OngoingEffect =
  | { kind: "pointTarget"; value: 17 | 24 | 27 }
  | { kind: "winBonus"; amount: number }
  | { kind: "cancelOpponentBonusOnLoss"; amount: number }
  | {
      kind: "grantAfterOtherTrumpConsumed";
      count: number;
      charges: number;
      excludeSelf: true;
      grantDoesNotTrigger: true;
    };

type PublicCondition =
  | { kind: "hasFaceUp"; target: Side }
  | { kind: "hasTableCard"; target: Side }
  | { kind: "hasOtherHandCards"; count: number };

interface TrumpDefinition {
  id: TrumpId;
  nameKey: MessageKey;
  descriptionKey: MessageKey;
  tags: readonly Tag[]; // 多标签，不作为 AI 决策规则。
  conditions: readonly PublicCondition[];
  cost: { discardOtherHandCards: number; selection: "owner-choice" } | null;
  onPlay: readonly ImmediateEffect[]; // 按数组顺序执行。
  table: {
    effects: readonly OngoingEffect[];
    expires: "round-end";
    stacking: "additive" | "independent" | "replace-global-point-target";
  } | null;
  failedResolution: "consume"; // 合法消费后的空抽等；非法前置条件仍拒绝。
}
```

`onPlay` 与 `table` 可以同时存在，避免混合卡被互斥的“即效／持续”枚举限制。所有纯即效也要声明 `table: null`，资源领取、数字抽取是不同效果。使用者隐含为效果执行主体；`target` 相对于使用者解释。运行时不存字符串公式或任意回调。

前置验证只用公开条件和自己已知的资源；桌面容量由 `table !== null` 统一验证，不能靠逐卡遗漏。成本检查通过后原子支付，顺序执行 `onPlay`，再安装持续部分。既有触发器在本次消费完成后按放置顺序处理，新安装的本卡不触发自身。触发次数、目标互斥、清理和信息投影由引擎统一负责。

### 混合卡示例：战备施压

```ts
const preparedPressure: TrumpDefinition = {
  id: "pressure-supply",
  nameKey: "contest.trump.pressureSupply.name",
  descriptionKey: "contest.trump.pressureSupply.description",
  tags: ["buff", "score", "resource"],
  conditions: [],
  cost: null,
  onPlay: [{ kind: "grantTrump", target: "self", count: 1 }],
  table: {
    effects: [{ kind: "winBonus", amount: 1 }],
    expires: "round-end",
    stacking: "additive",
  },
  failedResolution: "consume",
};
```

对应双语文案草稿：中文名称“战备施压”，说明“补充1张道具。留场期间，本回合获胜时额外获得1分；受积分上限与防御效果影响。”英文名称“Prepared Pressure”，说明“Gain 1 trump card. While this stays in play, gain 1 bonus point if you win this round, subject to defenses and the scoring cap.”正式 UI 还应说明库存不足或手满时可能无法领取。

## 2. 库存与难度配置

“几张”属于预设，不能写死在定义中；同卡可以在不同难度出现不同数量。最低出现难度可以从五档数量推导，研究表保留它便于阅读，校验两者一致。

```ts
interface FinitePoolPreset {
  model: "finite-per-side-no-recycle";
  copiesPerSide: Readonly<Partial<Record<TrumpId, number>>>;
  gameStartGrant: number;
  roundStartGrant: number;
  handLimit: number;
  tableLimit: 5;
  hitGrant: 0;
  overflow: "leave-in-pool";
  exhaustion: "grant-zero";
  reset: "game-end";
}
interface ContestResearchPreset {
  presetId: string;
  revision: number;
  difficulty: Difficulty;
  allowedIds: readonly TrumpId[];
  pool: FinitePoolPreset;
  scoring: { baseWin: 1; bonusCap: 2; defense: "bonus-only"; tie: 0 };
}
```

开场解析允许 ID、张数、定义与配置，形成不可变 Match 快照。不要在 Match 中动态读取一份可变全局目录。所有数量均为非负安全整数；入池项张数须大于零，未列 ID 视为 0，禁止重复定义、未知 ID 或未选择的资源生成。

若以后采用有放回权重抽取，另加判别联合成员，例如 `weighted-with-replacement`，使用 `weight` 而非 `copiesPerSide`；不能让同一个数值兼指库存和权重。

## 3. 运行实例与图鉴分离

```ts
type PlayerId = "human" | "ai";
interface TrumpInstanceBase {
  instanceId: string; // Game 内唯一；同定义可有多张实例。
  definitionId: TrumpId;
  owner: PlayerId;
}
type TrumpInstance = TrumpInstanceBase &
  (
    | { zone: "pool" | "hand" }
    | { zone: "table"; placedSequence: number; remainingCharges: number | null }
    | { zone: "discard"; identityWasPublic: boolean }
  );
interface CodexEntry {
  unlocked: boolean;
  viewed: boolean;
}
interface ResearchCardRecord {
  candidateId: TrumpId;
  proposedName: { en: string; "zh-CN": string };
  referenceNames: readonly string[];
  sourceIds: readonly string[];
  evidence: "cross-checked" | "single-source" | "search-only";
  admission:
    "priority-prototype" | "extended-experiment" | "deferred" | "excluded";
  earliestDifficulty: Difficulty | null;
  uncertaintyNotes: readonly string[];
}
```

桌面五格按卡实例计，不按效果条数计。库存实例的身份和顺序仅引擎可见；观察视图仅公开库存数量。手牌只向其持有者公开；弃置区若含隐藏手牌，也必须投影为隐藏身份。不能将原始实例表直接传 UI/AI。

图鉴仍遵循 [竞赛存档草案](../contracts/contest-save-format.md)：只持久化难度通关和以定义 ID 为键的 `unlocked/viewed`，不存实例、库存、规则快照、当前比赛或完整资料记录。缺少条目视作未解锁；`viewed` 必须蕴含 `unlocked`。

| 情况                           | 难度资格／图鉴行为                             |
| ------------------------------ | ---------------------------------------------- |
| 通关轻松，解锁标准             | 可选标准；不会自动点亮标准卡图鉴               |
| 玩家实际领取到道具             | 标准对局可解锁该定义，标记未查看               |
| 对手领取隐藏道具               | 不解锁、不提示身份                             |
| 对手公开使用，即使指定抽取失败 | 已公开遭遇，可解锁该定义                       |
| 非法出牌被拒绝／隐藏弃牌       | 不形成公开遭遇                                 |
| 查看已解锁条目                 | 设置 viewed；不影响对局资源                    |
| 自定义对局                     | 仅允许已解锁且已选定义，双方相同；不产生新解锁 |

候选 ID 在本次只是研究标识，研究目录不能直接当作存档校验白名单。S2 准入后的正式目录才成为白名单，S4 接入图鉴；发布后删除／重命名 ID 应评估存档版本，不静默猜映射。

## 4. 数据准入校验建议

- en 与 zh-CN 的名称和描述键均存在；文案与结构化效果一致。
- 每张卡满足纯即效、纯留场、混合至少一种；不存在空操作定义。
- 目标牌只能使用全局替换策略；其余卡不能占用该互斥类别。
- charges、补牌数量、弃牌成本、积分增量为有界整数；当前 F1 不允许生成库存之外的实例。
- 每条候选有来源定位与不确定性说明；不能用“已交叉验证”掩盖项目改编参数。
- 逐卡确定性夹具、观察等价测试、资源守恒与触发终止测试通过后，再进入正式目录。当前片段仅为结构草案，不计为已通过运行时测试。
