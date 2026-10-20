# 竞赛牌桌（S1/S2）

@req REQ-2026-018

ContestTable.tsx／NumberCard.tsx 只呈现应用投影，ContestControls.tsx 发送应用动作并读取结果，ContestRules.tsx 展示固定标准无道具规则。未公开对手牌只生成牌背；自己的暗牌有「仅你可见」标记。应用负责行动、计分、输入锁和延迟取消。正式 TrumpHand／TrumpTable 待后续需求，不挂载测试夹具。
