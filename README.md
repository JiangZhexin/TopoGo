# TopoGo 拓扑围棋

19×19（亦支持 9/13 路）拓扑围棋本地双人网页游戏。同一台电脑、同一浏览器窗口轮流执黑白，支持五种棋盘拓扑：**普通平面、环面 T²、莫比乌斯带、克莱因瓶、实射影平面 RP²**。

- 规则合同：TopoGo Area v1（面积计分、禁止自杀、positional superko、两次停着后终局协商）——见 [docs/RULES.md](docs/RULES.md)
- 拓扑模型与验收计数——见 [docs/TOPOLOGY.md](docs/TOPOLOGY.md)
- 已知限制——见 [docs/LIMITATIONS.md](docs/LIMITATIONS.md)
- 参考资料与许可证——见 [docs/SOURCES.md](docs/SOURCES.md)

## 运行环境

- Node.js ≥ 20（开发使用 Node v22.22.2 验证）
- 首次安装依赖需要网络；安装完成后对弈、评估、保存恢复完全离线

## 桌面一键启动（推荐）

双击桌面的 **TopoGo** 图标即可：脚本自动检测服务器状态——已在运行则直接打开游戏页，未运行则在最小化窗口中启动并等待就绪后打开浏览器。首次运行会自动安装依赖。

- 快捷方式：`桌面\TopoGo.lnk` → `TopoGo-Start.bat`（图标：`assets/topogo.ico`，由 `scripts/make_icon.py` 生成）
- 如需重建快捷方式：运行 `scripts/create_shortcut.py`（需 pywin32）

## 命令

```bash
npm ci            # 安装依赖（提交 package-lock.json）
npm run dev       # 开发服务（默认 http://localhost:5173）
npm run typecheck # TypeScript 检查
npm run test      # Vitest 单元/夹具测试（62 个）
npm run build     # 生产构建到 dist/
npm run preview   # 本地静态预览构建产物
```

Windows 用户也可双击 `start-local.bat`（前台窗口运行服务器）。

> 不要通过 file:// 双击 HTML 运行：ES 模块与 Web Worker 需要本地 HTTP 服务。

## 功能（V1）

- 五种拓扑的完整合法对弈：棋串/气按真实图邻接计算，跨缝相连、提子、禁自杀、PSK 超级劫
- 两次连续停着进入终局协商：点击标死整串、双方按 revision 确认、恢复对弈；确定性面积结算（`B+W+TB+TW+U=N²` 恒等断言）
- 悔棋 / 前进后退复盘 / 从此处继续（显式截断尾部）
- 自动保存（localStorage）+ JSON 棋谱导入导出（内核重放校验，拒绝篡改结果）
- 接缝箭头、幽灵副本（点击副本=点击本体）、悬停显示棋串的气与跨缝邻点
- 局势辅助（均为启发式，不裁定终局）：势力图（离散调和方程，Gauss–Seidel，标注收敛状态）、叫吃/二气警示、一手提子点、势力折算差参考估值；Web Worker 计算，过期回复按 revision 丢弃

## 目录

```text
src/core/       规则内核（纯 TS，与 React/DOM 无关）
src/analysis/   势力/战术分析与 Web Worker
src/ui/         SVG 棋盘与面板组件
src/io/         棋谱 JSON 与 localStorage
tests/          Vitest 测试（拓扑/规则/计分/历史/评估/IO）
docs/           规则、拓扑、限制、来源
```

## 测试记录

- 2026-10-03，Windows（win32），Node v22.22.2：`npm run typecheck` 通过；`npm run test` 62/62 通过；`npm run build` 成功。
- 浏览器流程冒烟（playwright-core + 本机 Chromium，脚本 `scripts/smoke.mjs`，需开发服务器运行中）：落子 → 占点报错提示 → 双停着进协商 → 标死预览 → 双方确认结算（黑胜 353.5 分）全链路通过，无控制台错误。
- Playwright 测试套件：脚手架预留未运行（见 e2e/README），不伪造绿灯。
