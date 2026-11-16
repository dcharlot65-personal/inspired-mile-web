// Screenshots of key pages for a visual check: node scripts/shots.mjs <baseURL> <outDir>
import { chromium } from '@playwright/test';
const [base, out] = process.argv.slice(2);
const pages = ['/', '/collection', '/battle', '/playground', '/world-map', '/profile'];
const browser = await chromium.launch();
for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(() => localStorage.setItem('inspired-mile-age-verified', 'adult'));
  const page = await ctx.newPage();
  for (const p of pages) {
    await page.goto(base + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/${name}${p === '/' ? '-home' : p.replace(/\//g, '-')}.png` });
  }
  await ctx.close();
}
await browser.close();
