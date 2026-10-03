# 浏览器流程测试（Playwright）

状态：**脚手架预留，未运行**（LIMITATIONS.md 同步声明，不伪造绿灯）。

## 计划覆盖的流程（对应提案 §9.4）

- 完整对局：落子 -> 双停着 -> 标死 -> 双方确认 -> 结算展示
- 认输确认弹窗
- 刷新后从 localStorage 恢复有效历史（不只是棋子颜色）
- 复盘只读与「从此处继续」确认
- 幽灵副本点击等价于点击本体（torus）
- 导入非法 JSON 显示错误且不破坏当前对局

## 启用方式

```bash
npm i -D @playwright/test
npx playwright install chromium
npm run test:e2e
```

`playwright.config.ts` 应配置 `webServer: { command: 'npm run dev', port: 5173 }`。
