# 竞赛 AI（S1 基线）

@req REQ-2026-020

`policy.ts` 公开 BaselinePolicy、BaselineAction 与 baselinePolicy；输入为 MatchObservation 及只含 Hit／Stay 的合法动作，输出只有 Hit／Stay。使用 observation.round.viewer 对应的自身总和：<17 且可 Hit 则 Hit，否则 Stay。应用 coordinator 从私有权威状态建立 ai 观察、过滤合法动作并负责调度，策略不接完整 Match、真实随机源或存储。

策略确定、不消耗环境或发牌随机，不搜索、不主动用卡、不按目标或难度改变阈值；特殊目标下表现较弱属于当前范围。所有待支持难度共用基线，S2 前段继续沿用。可见信息推断、动态评价、资源价值与有限多卡搜索均待 S2 末项另行实现；未来搜索随机必须独立于真实发牌流。

policy.test.ts 验证类型接口、禁用 Hit、不同目标、观察方自身手牌及隐藏数据／真实牌堆变化下的观察等价和确定决策。16／17／爆牌／空堆、调度取消与整场 BO5 另经应用真实引擎测试覆盖。S1 整体审查入口见 [S1 周期归档记录](../../../../docs/requirements/archive/REQ-2026-020-contest-basic-ai.md)。
