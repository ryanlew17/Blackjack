# ADR-002: 发布产物单文件化——vite-plugin-singlefile 修复 file:// 双击白屏

日期：2026-09-22
状态：已采纳

## 背景

v0.1.0 发布包采用多文件构建（`index.html` + `assets/*.js` + `assets/*.css`，`base: "./"`），发布说明声称"双击 `index.html` 即可运行"。实际用户双击（`file://` 协议）时，Chromium 系浏览器与 WebKit（Safari）页面空白：`<script type="module">` 与 `crossorigin` 样式表在 origin 为 `null` 的 `file://` 页面下被 CORS 策略拦截。Firefox 放行同目录 module 加载，问题被掩盖。

此前全部浏览器验收都在 `http://127.0.0.1` preview 上进行——验收流程（Agent 环境）与用户真实打开方式（双击 file://）不一致，缺陷漏检并随发布流出。这是流程缺口而非单纯代码 bug。

约束：保持 PRD 的"纯静态、零安装、双击可玩"发布定位；不改动游戏规则与存档格式；修复成本可控。

## 决策

- 生产构建改为**单文件产物**：引入 `vite-plugin-singlefile`，将全部 JavaScript 与 CSS 内联进 `index.html`（favicon 除外），`base: "./"` 保留。启动无任何外部资源请求，`file://` 下不存在 CORS 拦截面。
- **发布验收门槛新增 `file://` 双击场景**：干净目录解压后以 `file://` 打开，至少 Chromium/WebKit 其一须取得零控制台错误的渲染证据（写入 `docs/testing.md`）。
- **不恢复"npm 架构 + 本地服务器启动脚本"作为用户运行方式**。`start-game.bat` / `start-game.command` 保留，仅作为源码开发/本地运行用途。

## 理由

被否决的替代方案：

- **只调整 `base`**：`base: "./"` 在 v0.1.0 已是相对路径，白屏与路径解析无关，无效。
- **多文件构建 + 指导用户起本地静态服务**（`python3 -m http.server` 或 npm 脚本）：违背"零安装双击可玩"的发布定位，等于承认发布包不可双击；且要求用户安装 Node 或记住命令行。
- **回退为非 module 的经典 `<script>`**：需要改构建目标并放弃代码分割/标准 ESM 生态，收益不如单文件彻底。
- **把问题归为用户环境、要求换浏览器或开服务器**：缺陷在构建产物形态，不在用户环境；单文件方案在所有桌面浏览器可用，是最小惊讶的修复。

单文件 vs 本地服务两条路线中，单文件同时满足"修复"与"定位"，且让验收场景（双击）与分发场景（双击）完全一致，消除了 Agent/用户环境差异这一类风险。

## 后果

- 正面：双击可玩在 Chromium / WebKit / Firefox 全部成立（沙箱三引擎矩阵 + 真实 Chrome 双击验收通过）；静态托管（根目录/子目录）行为不变；发布包从 3 文件减为 2 文件（`index.html` + `favicon.svg`）。
- 代价：`index.html` 约 419 KB（gzip 约 133 KB），失去外部资源独立缓存与并行加载（单页小游戏影响可忽略）；调试生产产物时无独立 source map 文件（构建期仍生成行内 map，需要时可临时关闭内联）。
- 流程后果：`docs/testing.md` 浏览器验收规范增补 `file://` 场景，防止同类回归。
