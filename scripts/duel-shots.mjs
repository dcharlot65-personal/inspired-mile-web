// Screenshots of the duel in play, for a visual check: node scripts/duel-shots.mjs <baseURL> <outDir>
import { chromium } from '@playwright/test';
const [base, out] = process.argv.slice(2);
const browser = await chromium.launch();
for (const [name, viewport] of [['desktop', { width: 1280, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(() => localStorage.setItem('inspired-mile-age-verified', 'adult'));
  const page = await ctx.newPage();
  await page.goto(`${base}/battle?seed=11&brain=rules`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${out}/${name}-1-setup.png`, fullPage: true });
  await page.click('#start-duel');
  await page.waitForFunction(() => document.querySelector('#opponent-verse')?.getAttribute('data-source'));
  await page.click('[data-char-id]:not(.pointer-events-none)');
  await page.click('[data-item-id]');
  await page.fill('#verse-input', 'Bold, I ask: who dares?\nA question for the stage\nRage on, rage on, rage on\nDown falls thy little page');
  await page.screenshot({ path: `${out}/${name}-2-round.png`, fullPage: true });
  await page.click('#submit-verse');
  await page.waitForSelector('#next-round');
  await page.screenshot({ path: `${out}/${name}-3-verdict.png`, fullPage: true });
  await ctx.close();
}
await browser.close();
