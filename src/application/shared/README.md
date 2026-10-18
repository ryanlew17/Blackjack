# 调度共享边界

@req REQ-2026-012

未来只在两模式均消费时抽取 eventQueue.ts、inputLock.ts、cancellation.ts；保留经典 useGame 内现有流程，不提前改写时序。
