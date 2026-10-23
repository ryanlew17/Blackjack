# REQ-2026-008: 非安全上下文(明文 http)白屏 — UUID 降级

状态: done
来源: 用户(2026-09-22 第三方 UX 审查确认;v0.1.1 热修复的遗留变体)
关联设计: docs/adr/ADR-002-singlefile-release-build.md、docs/design/persistence.md、docs/contracts/save-format.md、docs/testing.md
影响模块: src/infrastructure/(save.ts);文档回写 docs/adr/、docs/testing.md
非目标: 不改存档格式与校验规则(revision 仍为非空字符串,parseSave 逻辑不动);不引入新依赖;不改变单文件 file:// 发布形态(ADR-002);不做运行环境探测或降级提示 UI

## 背景

事故链:v0.1.0 双击 `index.html`(`file://`)白屏(多文件 ES module 被 CORS 拦截)→ v0.1.1 改为单文件构建热修复(ADR-002,HTML 体积增大为既定代价)。2026-09-22 第三方 UX 审查实测确认:**该修复未覆盖非安全上下文变体**——`envelope()` 使用 `crypto.randomUUID()`(src/infrastructure/save.ts:44),该 API 仅在安全上下文存在;以明文 http + 非 localhost(如局域网 IP 静态托管 dist/)访问时,首次渲染 `readSave()` 调用 `envelope()` 抛出 `crypto.randomUUID is not a function`,catch 分支内的兜底 `envelope()` 再次抛出,异常穿透 React 首次渲染,`#root` 为空,整页白屏且无任何错误提示。

实测证据(Chromium,`http://192.168.31.26:8931`):`isSecureContext: false`、`typeof crypto.randomUUID === "undefined"`、`#root` 内容长度 0、唯一页面错误即上述 TypeError。`file://`、`localhost`、`https` 均为安全上下文,不受影响。现发布说明(ADR-002)"子目录静态托管仍然可用"的表述与实际行为不符,需同步修订。

## 方案要点

- save.ts 内封装唯一 ID 生成:`typeof crypto.randomUUID === "function"` 时使用之;否则降级为时间戳 + 随机串拼接。revision 仅需唯一性、不需加密强度;`envelope()` 改用该封装,其余逻辑不动。
- 修订 ADR-002 表述:发布产物支持 `file://`、`localhost`、`https`;明文 http(局域网 IP)自本需求修复起可用。
- docs/testing.md:浏览器验收矩阵新增"明文 http(局域网 IP)直接访问"一行;验证历史补记本缺陷的发现与修复。

## 验收标准

- 明文 `http://<局域网IP>:<端口>` 加载发布产物:页面正常渲染,可完成下注、发牌、结算、下一局完整对局;动画中刷新恢复正确;导出与导入往返成功;控制台与页面错误均为 0。
- `file://`(等效双击)、`localhost` 明文 http、https 三种方式回归,行为与 v0.1.2 无差异。
- 存档校验不受影响:现有 Vitest 存档用例全部通过;降级生成的 revision 满足 parseSave 的非空字符串校验。
- `npm test`、`npm run typecheck`、`npm run format:check`、`npm run build` 全绿。
- ADR-002 与 docs/testing.md 完成回写。

## 验收记录

2026-09-22 开发验收及用户审查通过。

- `newRevision()`在原生UUID缺失时使用时间戳与随机串；存档格式、parseSave及revision校验不变，相关契约与发布检查已回写。
- 自动检查：Vitest 64/64（新增降级生成50次唯一、非空及存档往返用例）、typecheck、Prettier、build通过。
- Chromium实际LAN明文HTTP、非安全上下文且randomUUID缺失时，完整对局、动画／行动中刷新、真实导出导入通过；干净file://、localhost与自签HTTPS回归通过，零控制台／页面错误。LAN场景仅覆盖Chromium。
