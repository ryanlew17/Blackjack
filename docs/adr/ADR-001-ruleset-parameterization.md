# ADR-001: 规则参数化——RuleSet经transition逐调用传入

日期：2026-09-22
状态：已采纳；字段范围按当前规则v2维护

## 背景

经典引擎需要在保持纯函数、默认行为和存档一致的前提下支持桌规变体；模块级可变配置会让并行测试或不同对局相互影响。

## 决策

- `transition(state, command, random?, rules = RULES)`与`legalActions(state, rules?)`逐调用接收RuleSet，引擎不保存可变规则状态；useGame和存档使用默认RULES。
- 当前可注入字段为standSoft17、blackjackPayout、split、insurance与surrender；version: 2和decks: 1仍以字面量类型限定。完整语义见[经典规则](../design/game-rules.md)。
- 新增规则能力时同时评估rulesVersion、实现及[存档契约](../contracts/save-format.md)，不在UI上开放尚无实现的配置。

## 理由

- 逐调用传参允许同一进程并存不同规则的对局和确定性测试，无全局切换风险。
- 否决模块级可变配置：导入存档或并行测试容易串扰。
- 不为纯函数规则模块增加引擎实例生命周期；用类型区分已实现开关与固定边界。

## 后果

调用方多传一个参数，默认桌规保持明确。赔率采用整数运算 `bet + bet×p/q`，新增比例需保证下注单位下可精确结算；当前3:2与6:5均满足。规则范围与测试证据分别在行为文档和对应REQ维护，不在本记录保存任务进展。
