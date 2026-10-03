// 精确验证悬停发光：先拖拽暂停自转（3s 窗口内截图），再用严格金色阈值对比
import { chromium } from 'playwright-core';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:5199';

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];
  const cacheRoot = path.join(os.homedir(), '.agent-browser', 'browsers');
  try {
    for (const d of fs.readdirSync(cacheRoot)) {
      candidates.push(path.join(cacheRoot, d, 'chrome.exe'));
    }
  } catch { /* ignore */ }
  return candidates.find((p) => fs.existsSync(p)) || null;
}

const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('dialog', (d) => d.accept());

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(1200);

await page.locator('select').first().selectOption('mobius');
await page.getByRole('button', { name: '开始新对局' }).click();
await page.waitForTimeout(800);

const box = await page.locator('svg').first().boundingBox();
const px = (x, y) => ({ cx: box.x + 60 + 34 + x * 30, cy: box.y + 34 + y * 30 });
for (const [x, y] of [[9, 9], [5, 13], [13, 5]]) {
  const p = px(x, y);
  await page.mouse.click(p.cx, p.cy);
  await page.waitForTimeout(250);
}

await page.getByRole('button', { name: '双视图' }).click();
await page.waitForTimeout(1200);

// 注意：切换布局后 2D 棋盘位置已变，必须重新取坐标
const box2 = await page.locator('svg').first().boundingBox();
const qx = (x, y) => ({ cx: box2.x + 60 + 34 + x * 30, cy: box2.y + 34 + y * 30 });

// 拖拽 3D 画布一点点：暂停自转 3 秒
const canvas = await page.locator('canvas').first().boundingBox();
const ccx = canvas.x + canvas.width / 2, ccy = canvas.y + canvas.height / 2;
await page.mouse.move(ccx, ccy);
await page.mouse.down();
await page.mouse.move(ccx + 4, ccy, { steps: 2 });
await page.mouse.up();

// 窗口 1：不悬停
await page.mouse.move(100, 950); // 移出棋盘
await page.waitForTimeout(120);
await page.screenshot({ path: '.tmp/g2-off.png' });

// 窗口 2：悬停黑棋 (9,9)
const h = qx(9, 9);
await page.mouse.move(h.cx, h.cy);
await page.waitForTimeout(150);
await page.screenshot({ path: '.tmp/g2-on.png' });

// 窗口 3：悬停白棋 (5,13)
const h2 = qx(5, 13);
await page.mouse.move(h2.cx, h2.cy);
await page.waitForTimeout(150);
await page.screenshot({ path: '.tmp/g2-on2.png' });

console.log('errors:', errors.length);
for (const e of errors.slice(0, 5)) console.log(e);
await browser.close();
