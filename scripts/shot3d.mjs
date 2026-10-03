// 截图脚本：五种拓扑的 3D 视图效果（需 dev server 运行中，端口由 BASE 指定）
import { chromium } from 'playwright-core';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:5199';
const OUT = process.env.OUT_DIR || '.tmp';

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

const EXE = findChrome();
if (!EXE) { console.error('chrome not found'); process.exit(1); }

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(1500);

// 下两手棋让画面有内容
const svgBox = await page.locator('svg').first().boundingBox();
if (svgBox) {
  const m = 94, step = 30; // Board2D 布局参数
  const click = async (x, y) => page.mouse.click(svgBox.x + m + x * step, svgBox.y + m + y * step);
  await click(9, 9); await page.waitForTimeout(300);
  await click(5, 13); await page.waitForTimeout(300);
  await click(13, 5); await page.waitForTimeout(300);
}

const topos = ['torus', 'mobius', 'klein', 'projective'];
page.on('dialog', (d) => d.accept()); // 新对局可能的确认弹窗自动接受
for (const t of topos) {
  // 选拓扑（第一个 select 是拓扑选择器）并开始新对局使其生效
  await page.locator('select').first().selectOption(t);
  await page.getByRole('button', { name: '开始新对局' }).click();
  await page.waitForTimeout(800);
  // 下三手让画面有内容
  const box = await page.locator('svg').first().boundingBox();
  if (box) {
    const m = 94, step = 30;
    const click = async (x, y) => page.mouse.click(box.x + m + x * step, box.y + m + y * step);
    await click(9, 9); await page.waitForTimeout(200);
    await click(5, 13); await page.waitForTimeout(200);
    await click(13, 5); await page.waitForTimeout(200);
  }
  // 切到 3D 视图
  await page.getByRole('button', { name: /3D/ }).first().click();
  await page.waitForTimeout(2500); // 等自转一个角度
  await page.screenshot({ path: `${OUT}/shot-3d-${t}.png` });
  console.log(`${t}: canvas=${await page.locator('canvas').count()}`);
  // 切回 2D 供下一种拓扑落子
  await page.getByRole('button', { name: /2D/ }).first().click();
  await page.waitForTimeout(300);
}
console.log('errors:', errors.length);
for (const e of errors.slice(0, 5)) console.log(e);
await browser.close();
