# 模式入口

@req REQ-2026-018

ModeSelect.tsx 提供首页经典／竞赛入口，只接双语文案与回调。App 持有内存模式并连接应用 API；刷新回首页，经典存档由 useGame 保留。竞赛入口先经战前选技，再确认固定标准含道具BO5；准备页取消直接回首页，场中离开仍确认放弃。对手策略见[竞赛AI规则](../../../docs/design/contest-rules.md#5-ai-决策)。
