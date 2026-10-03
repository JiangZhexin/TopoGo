// 浏览器冒烟脚本：落子/占点报错/停着进协商/标死/确认结算
// 需要本机已有 Chromium/Chrome。通过 CHROME_PATH 环境变量指定浏览器路径；
// 未指定时自动探测常见的 Chrome 安装位置与 ~/.agent-browser/browsers 下的缓存。
import { chromium } from 'playwright-core';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

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
  } catch { /* 目录不存在时忽略 */ }
  return candidates.find((p) => fs.existsSync(p)) || null;
}

const EXE = findChrome();
if (!EXE) {
  console.error('未找到 Chrome/Chromium，请设置 CHROME_PATH 环境变量后重试。');
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
});

await page.goto('http://localhost:5173', { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1500);

const svgBox = await page.locator('svg').boundingBox();
if (!svgBox) throw new Error('no svg');
// svg 内顶点(0,0)位于 (94,94)（torus 幽灵带 G=2、边距 M=34、格 S=30）
const cell = (x, y) => ({ px: svgBox.x + 94 + x * 30, py: svgBox.y + 94 + y * 30 });
const stoneCount = () => page.locator('svg circle[r="13.2"]').count();
const status = async (label) => {
  const svg = await page.locator('svg').count();
  const stones = await stoneCount();
  console.log(`${label}: svg=${svg} stones=${stones}`);
  if (svg === 0) {
    const body = await page.evaluate(() => document.getElementById('root')?.innerText ?? '(empty root)');
    console.log('ROOT TEXT >>>\n' + body.slice(0, 2000) + '\n<<<');
    throw new Error('CRASH: ' + label);
  }
};

await status('initial');
const c1 = cell(3, 3);
await page.mouse.click(c1.px, c1.py);
await page.waitForTimeout(500);
await status('B(3,3)');
const c2 = cell(15, 15);
await page.mouse.click(c2.px, c2.py);
await page.waitForTimeout(500);
await status('W(15,15)');

// 占点报错路径
await page.mouse.click(c1.px, c1.py);
await page.waitForTimeout(500);
console.log('occupied click error text =', await page.locator('.error-text').textContent().catch(() => '(none)'));
await status('occupied click');

// 双停着 -> scoring
await page.getByRole('button', { name: '停一手' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: '停一手' }).click();
await page.waitForTimeout(600);
console.log('scoring panel visible =', await page.getByText('终局协商').count());

// 标死白子 (15,15)
await page.mouse.click(c2.px, c2.py);
await page.waitForTimeout(400);
console.log('dead marked preview =', await page.getByText('预览差').count());

// 双方确认 -> finished
await page.getByRole('button', { name: '黑方确认' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: '白方确认' }).click();
await page.waitForTimeout(600);
console.log('result banner =', (await page.locator('.result-banner').textContent().catch(() => '(none)'))?.trim());
await status('finished');

console.log('--- errors ---');
for (const e of errors) console.log(e);
if (errors.length === 0) console.log('(none)');
await browser.close();
