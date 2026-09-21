# REQ-2026-002: 软 17 补牌变体测试补全

状态: active
来源: 内部（2026-09-22 重构终审遗留 minor）
关联设计: docs/design/game-rules.md
影响模块: src/domain/game.test.ts
非目标: 不修改规则实现本身；不覆盖默认 RULES（standSoft17: true 已有用例）

## 背景

规则参数化后，`standSoft17: false`（庄家软 17 必须补牌）变体仅有一条测试（`game.test.ts` "hits soft 17 when the rules say so"），只覆盖了"软 17 补一张后停牌"的路径。补牌后**爆牌判负**、补牌后 **A 降级**（软牌转硬牌，如 A+6 补 10 → 硬 17 停牌）等分支尚无确定性用例。重构终审时如实记录、延期处理。

## 方案要点

- 用 `testHelpers.ts` 构造确定性牌序，注入 `rules = { ...RULES, standSoft17: false }`：
  - 庄家 A+6 补牌爆牌 → 玩家胜。
  - 庄家 A+6 补 10（A 降级为 1）→ 硬 17 停牌，按点数结算。
  - 可选：庄家 A+2+4（多 A 软 17）补牌路径。

## 验收标准

- 新增用例全部通过，且先在不改实现的前提下验证其有效性（红→绿可选，因实现已存在，用例应直接通过）。
- `npm test`、`npm run typecheck`、`npm run format:check` 通过。

## 变更记录

- 2026-09-22 创建
