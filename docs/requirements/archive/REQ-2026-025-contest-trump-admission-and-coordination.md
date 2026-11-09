# REQ-2026-025: S2 首批卡池准入与应用接线

状态: done
来源: 用户（2026-10-21：S2拆分）
关联设计: [竞赛规则](../../design/contest-rules.md) · [状态协调](../../design/state-and-animation.md) · [架构](../../architecture.md)
影响模块: domain/contest/trumps、presets、application/contest及生产入口测试

## 背景

将候选目录和正式执行器收敛为唯一生产卡池，并接通连续用卡、授权回放与取消机制。

## 方案要点

- 登记54个稳定ID／双语键，准入53项执行并建立冻结标准BO5预设；回仙由[REQ-027](./REQ-2026-027-contest-active-skills.md)完成第54卡准入。逐卡定义／数量见[道具目录](../../design/contest-trumps.md)，当前范围见[竞赛规则](../../design/contest-rules.md)§4。
- 结构化玩家命令、先提交后回放、同Turn多卡及过期输入取消见[状态协调](../../design/state-and-animation.md)§6–10；生产白名单和随机隔离见[架构](../../architecture.md)。可玩界面与组合策略分别由REQ-026／028接入。

## 验收标准

- 每个准入定义、目标／费用／容量及混合联动均有真实引擎证据，目录引用唯一执行对象。
- 多卡后重新决策，暂停／退出／重开与旧回调不重复消费；完整资源BO5可推进。
- 私有信息、经典进度与存储隔离，生产依赖及适用工程检查通过。

## 验收记录

2026-10-22自审验收通过并归档：

- 587项测试（26文件）、typecheck、format、领域纯度及生产依赖检查通过；[逐卡准入测试](../../../src/domain/contest/engine/admission.test.ts)覆盖53定义、23项留场容量及隐藏费用等价。完整资源BO5、回放取消、强制旧回调和Storage零调用通过。
- Node26.12.1下npm ci、build通过，依赖审计0漏洞。Chromium／WebKit的preview与file://、经典刷新／文件往返、中英窄屏及减少动态验证通过，零控制台／页面错误；浏览器比赛范围为单Round，未覆盖Firefox、LAN或真机。
