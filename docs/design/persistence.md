# design/persistence — 存档生命周期行为快照

> 适用范围：`src/infrastructure/save.ts` 与 useGame 协作实现的存档行为——自动保存、校验、导入导出、损坏恢复。字段与版本细节在 `../contracts/save-format.md`。
> 何时读取：改 save.ts、导入导出流程、版本迁移前。
> 关联需求：无。
> 最后更新：2026-09-22
> 来源：2026-09-22 文档架构升级（原 docs/SAVE_FORMAT.md 校验章节 + useGame 行为）

## 1. 自动保存

- 每次 `transition` 提交新状态即写 `localStorage`（键 `green-room.blackjack.v1`）；设置变更（语言/静音/音量/动效）同样持久化。
- 导出读取 `snapshot()` 权威快照，因此动画中导出也不会保存半截动画或重复结算。

## 2. 校验入口

- `parseSave(raw)` 是唯一校验入口：大小上限 128 KiB → JSON → 版本 → 金额/牌张/阶段/结果/历史一致性，全部通过才返回 `SaveEnvelope`，否则抛 `SaveError`。
- 不支持的版本**明确拒绝，不猜测转换**。未来迁移在 `parseSave` 入口按版本增加纯转换函数，转换结果仍需完整校验，并同步升级 `rulesVersion` 与 `contracts/save-format.md`。
- 金额约束与游戏逻辑一致：非负安全整数且为 50 的倍数，**不设固定上限**——任何可达对局状态（含超大余额）均可导出后重新导入。

## 3. 导入流程（先校验，再确认）

```text
选择文件 → parseSave 校验 → 预览（余额/阶段/保存时间） → 用户确认 → replace 覆盖进度
```

- 校验失败：提示无效文件，**保持原存档不变**。
- 预览后取消：清空待导入快照，不触碰现进度。
- `dealer` 瞬态阶段不出现在合法存档中；进行中 (`player`) 与已结算 (`settled`) 局均可恢复。

## 4. 损坏与降级

- 启动读到损坏自动存档：`problem = "corrupt"`，不自动覆盖、不静默丢弃；用户必须导入有效备份或确认重新开始（`replace` 以 `overwrite` 写入）。
- 浏览器存储不可用/写入失败：`problem = "storage"`，当前会话继续游戏并显示导出提醒，进度只能靠手动导出备份。
- 跨标签页冲突的暂停与恢复见 `state-and-animation.md` §4。
