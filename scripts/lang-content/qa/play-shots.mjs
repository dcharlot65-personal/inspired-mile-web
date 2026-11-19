// Screenshots of the playground and the story page in several interface languages, at phone and
// desktop width, for a person to look at: node scripts/lang-content/qa/play-shots.mjs <baseURL> <outDir> [langs]
// Each page is also measured for content wider than the viewport (a page that scrolls sideways).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [base, out, langs = 'ar,ja,de,es'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const report = [];
for (const locale of langs.split(',')) {
  for (const [name, viewport] of [['1280', { width: 1280, height: 900 }], ['390', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport });
    await ctx.addInitScript((l) => { localStorage.setItem('inspired-mile-age-verified', 'adult'); localStorage.setItem('inspired-mile-locale', l); }, locale);
    const page = await ctx.newPage();
    const shot = async (what) => { await page.waitForTimeout(400); await page.screenshot({ path: `${out}/${locale}-${name}-${what}.png` }); report.push(`${locale} ${name} ${what}: sideways overflow ${await overflow(page)} px`); };
    await page.goto(`${base}/playground`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`html[data-page-area="${locale}"]`);
    await shot('onboarding-1');
    await page.click('#onboarding-next');
    await shot('onboarding-2');
    await page.evaluate(() => (document.getElementById('onboarding-skip'))?.click());
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('page');
    await page.click('#trivia-start-btn');
    await page.waitForSelector('.trivia-option');
    await shot('trivia');
    await page.click('.trivia-option');
    await shot('trivia-answered');
    await page.click('#trivia-close');
    await page.click('#challenge-start-btn');
    await page.waitForSelector('#challenge-quote');
    await shot('challenge');
    await page.goto(`${base}/story`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`html[data-page-area="${locale}"]`);
    await shot('story');
    await page.click('.encounter-card[data-encounter="1-1"]');
    await page.waitForSelector('#encounter-scene:not(.hidden)');
    await page.locator('#encounter-scene').scrollIntoViewIfNeeded();
    await shot('scene');
    await ctx.close();
  }
}
await browser.close();
console.log(report.join('\n'));
