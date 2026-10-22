# 竞赛应用协调

`coordinator.ts` 私有持有权威 Match，并负责提交、投影回放、输入锁和取消；`controller.ts` 包装玩家 API；`useContest.ts` 负责 React 订阅、设置读取、音效和可见性／卸载。`random.ts` 为含道具比赛提供惰性初始化、独立推进的默认数字／门控／选取流。

`createContestController` 默认使用页面的无道具配置，显式 `preset: "s2-development"` 选择标准道具开发配置；`send` 接受 Hit／Stay／NextRound 或当前 `trumpCommands` 中带 `inputId` 的结构化选择。公开接口仅含观察，未暴露完整状态或双方受控命令端口。

详细时序、过期选择与暂停语义见 [状态与动画](../../../docs/design/state-and-animation.md)；规则、预设和策略边界见 [竞赛规则](../../../docs/design/contest-rules.md)。
