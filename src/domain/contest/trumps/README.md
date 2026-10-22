# 道具目录与执行定义

`ids.ts` 提供稳定定义 ID，`catalog.ts` 管双语键、标签、来源和准入状态。目录的 `execution` 引用 `admitted.ts` 聚合的唯一执行定义；`numberDefinitions.ts` 与 `interactionDefinitions.ts` 不复制候选效果逻辑。

效果统一由 `../engine/` 执行；数量与开发配置见 `../presets/`，图鉴纯数据见 `../codex/`。当前准入范围和 API 见 [数据快照](../../../../docs/design/codex-data.md)与[竞赛规则](../../../../docs/design/contest-rules.md)。
