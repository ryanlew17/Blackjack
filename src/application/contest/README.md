# 竞赛应用协调（S1）

@req REQ-2026-017 @req REQ-2026-019

`coordinator.ts` 持有私有权威 Match，`controller.ts` 包装生产玩家 API，`useContest.ts` 是 React 适配；`placeholderOpponent.ts` 仅提供确定占位。生产无道具界面已接，未接正式 AI、图鉴或存储。

## 接口与时序

- `createContestController({ random?, opponent?, reducedMotion?, onEvent? })` 构造闲置协调器，不发牌、不读存档；start 首次创建比赛，重复 start 忽略。restart 取消旧任务并新开，exit 取消后丢弃 Match。
- 公共状态由 getSnapshot／subscribe 提供：match 是 human 观察，busy 覆盖回放和思考等待，另有 thinking、paused、投影 event、单调 effectId 和可用 actions。snapshot() 返回当前权威状态的 human 投影，用于结果读取；没有完整状态或牌堆导出接口。
- send 只接受 Hit／Stay／NextRound，自动补 human 身份及当前回合编号。忙碌、暂停、非玩家 Turn 或不合法时拒绝；同步提交 transitionMatch 的完整终态，再播放逐事件投影视图。
- 发牌／Hit 每帧 220ms，其余 300ms；减少动态效果时每帧 35ms。所有事件递增 effectId，不用事件类型或数组下标作为动效标识。skipAnimations 取消回放并呈现已提交终态，比分不重算。
- 队列完成后读取权威行动方，不能因一次动画结束就换人。若轮到 AI，等待 300ms 后只向策略提供 ai 观察与合法 Hit/Stay；策略不接真实随机源、对手暗牌或牌堆。默认自身总和 <17 且可 Hit 则 Hit，否则 Stay，不主动用道具。
- 所有待执行回放／策略回调绑定取消代次。exit、restart、pause 和跳过回放会清定时器并使旧回调失效；pause 呈现已提交终态并锁输入，resume 按该终态恢复玩家或 AI 决策。PlayTrump 的真实命令与双控制验证已由下节 REQ-019 实现。

## React 与设置

`useContest({ settings, systemReduced?, random?, opponent? })` 用 useSyncExternalStore 订阅协调器，返回上述视图及 start/restart/send/exit/pause/resume/skipAnimations/snapshot。settings 只读取既有 API 提供的 motion／muted／volume，不写设置信封或经典进度。发牌、抽牌、揭牌与结果复用 shared/audio；回到可见时跳到已提交终态，卸载时移除监听并退出。初始闲置，不恢复比赛。

经典 useGame 没有改动；本项没有必要为共享而移动其队列或持久化逻辑，application/shared 仍为预留。测试使用真实竞赛引擎和受控时间，涵盖完整 BO5、输入锁、投影、取消、暂停与策略；React 测试只覆盖服务端闲置初始化，客户端与实际 UI 由 REQ-018 接线验证，REQ-019 另做所改页面的浏览器自测；服务端测试不替代浏览器证据。

## REQ-019 双方受控验证

提交／投影回放／定时器代码提取到 coordinator.ts，生产 controller 只包装 human-only 的三动作 API。测试构造同一协调器，显式传入 frozen 规则、固定手牌与 controlledPlayers，并通过 sendCommand 提交双方实际命令；界面无该端口或调试开关。多张卡分别回放后恢复同一方，Hit／Stay 才换人；busy、pause、skip 与取消仍绑定已提交终态。占位策略继续只 Hit／Stay。
