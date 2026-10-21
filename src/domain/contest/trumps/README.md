# 道具数据与执行定义

@req REQ-2026-012 / REQ-2026-013 / REQ-2026-023 / REQ-2026-024

ids.ts、types.ts、catalog.ts仍管理21卡只读候选数据；数量在../presets/，图鉴纯数据在../codex/。正式53卡目录、文案与白名单由REQ-025准入，主动技就绪后REQ-027补回仙成为54卡；候选元数据不等于实际可玩状态。

numberDefinitions.ts提供29个数字／留场及悔牌执行定义，interactionDefinitions.ts提供24个积分／补给／短效封锁及赌命定义，均须显式注入RoundRules。执行逻辑统一在../engine/effects.ts，资源在resources.ts，有限触发／Turn边界在triggers.ts，逆操作在undo.ts；不另建第二套道具引擎。

生产入口暂不依赖这些定义、候选目录或固定夹具。REQ-025接资源与应用，026接手牌／目标／费用界面，027实现技能与回仙，028最后接组合AI。
