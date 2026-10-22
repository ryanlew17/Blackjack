# 竞赛预设

`resources.ts` 管五档数量及显式准入过滤；`s2.ts` 提供冻结的标准开发预设，由应用显式选择。`experimental.ts` 仅保留历史 F1/P0 数据，不进入生产依赖图。

开发值不代表五档已完成对抗平衡；进行中的 Match 始终使用自己的冻结快照。范围和约束见 [竞赛规则](../../../../docs/design/contest-rules.md)。
