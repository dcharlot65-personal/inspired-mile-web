// Screenshots of the battle page in several interface languages: node scripts/locale-shots.mjs <baseURL> <outDir>
import { chromium } from '@playwright/test';
const [base, out] = process.argv.slice(2);
const browser = await chromium.launch();
for (const locale of ['ar', 'de', 'ja', 'es']) {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport });
    await ctx.addInitScript((l) => { localStorage.setItem('inspired-mile-age-verified', 'adult'); localStorage.setItem('inspired-mile-locale', l); }, locale);
    const page = await ctx.newPage();
    await page.goto(`${base}/battle?seed=11&brain=rules`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    if (name === 'desktop') await page.screenshot({ path: `${out}/${locale}-${name}-setup.png` });
    await page.click('#start-duel');
    await page.waitForFunction(() => document.querySelector('#opponent-verse')?.getAttribute('data-source'));
    await page.click('[data-char-id]:not(.pointer-events-none)');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${locale}-${name}-round.png`, fullPage: name === 'mobile' });
    await ctx.close();
  }
}
await browser.close();
