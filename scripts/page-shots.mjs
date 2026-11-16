// Screenshots of the translated pages, to be looked at: node scripts/page-shots.mjs <baseURL> <outDir> [locales] [pages]
//   locales  comma-separated, default ar,de,ja,es
//   pages    comma-separated among home,about,collection,profile,world-map (default: all)
// Each page is taken at desktop (1280) and phone (390) width with a player who owns cards, variants,
// decks and achievements, so every list has rows. Long pages are taken in parts.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [base, out, localeArg, pageArg] = process.argv.slice(2);
const locales = (localeArg || 'ar,de,ja,es').split(',');
const pages = (pageArg || 'home,about,collection,profile,world-map').split(',');
const PATHS = { home: '/', about: '/about', collection: '/collection', profile: '/profile', 'world-map': '/world-map' };
mkdirSync(out, { recursive: true });

const seed = (locale) => {
  const now = Date.now();
  const owned = ['SM-001', 'MO-001', 'MO-002', 'CA-001', 'DC-001', 'DC-002', 'RL-001', 'RL-002', 'PT-001', 'PT-002', 'PT-003', 'MO-001'];
  localStorage.setItem('inspired-mile-age-verified', 'adult');
  localStorage.setItem('inspired-mile-locale', locale);
  localStorage.setItem('inspired-mile-inventory', JSON.stringify({ cards: owned.map((cardId, i) => ({ cardId, acquiredAt: now - i * 86400000, source: 'starter' })), starterClaimed: true, lastDailyPack: 0, battleWins: 3, triviaCorrect: 5, challengesCompleted: 1 }));
  localStorage.setItem('inspired-mile-variants', JSON.stringify([
    { variantId: 'MO-001-TKY-00-01-02', baseCardId: 'MO-001', acquiredAt: now, source: 'battle-streak' },
    { variantId: 'DC-001-CAI-01-00-03', baseCardId: 'DC-001', acquiredAt: now, source: 'trivia-mastery' },
  ]));
  localStorage.setItem('inspired-mile-decks', JSON.stringify([{ name: 'Elsinore', characters: ['DC-001', 'DC-002', 'MO-001'], relics: ['RL-001'], potions: ['PT-002'] }, { name: 'Verona', characters: ['MO-001', 'MO-002', 'CA-001'], relics: [], potions: [] }]));
  localStorage.setItem('inspired-mile-active-deck', 'Elsinore');
  localStorage.setItem('inspired-mile-achievements', JSON.stringify([{ id: 'first-blood', unlockedAt: now - 86400000 }, { id: 'card-collector', unlockedAt: now }]));
  localStorage.setItem('inspired-mile-player-stats', JSON.stringify({ battleWins: 3, totalBattles: 7, totalRounds: 21, highestScore: 38, triviaCorrect: 5, triviaPerfect: 0, challengesCompleted: 1, uniqueCards: 11, totalCards: 12, packsOpened: 2 }));
};

const browser = await chromium.launch();
const report = [];
for (const locale of locales) {
  for (const [size, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    await ctx.addInitScript(seed, locale);
    const page = await ctx.newPage();
    for (const name of pages) {
      const shot = (part, opts = {}) => page.screenshot({ path: `${out}/${locale}-${size}-${name}${part ? `-${part}` : ''}.png`, ...opts });
      const part = async (selector, label) => {
        const el = page.locator(selector).first();
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(150);
        await el.screenshot({ path: `${out}/${locale}-${size}-${name}-${label}.png` });
      };
      await page.goto(`${base}${PATHS[name]}`, { waitUntil: 'networkidle' });
      await page.waitForFunction((l) => document.documentElement.dataset.i18nReady === l && document.documentElement.dataset.titleLocale === l, locale);
      await page.waitForTimeout(500);
      // Anything wider than the screen is the first thing to know about.
      const wide = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const culprits = [...document.querySelectorAll('main *, footer *, nav *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed'; }).slice(0, 5).map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${String(el.className).split(' ').slice(0, 3).join('.')}: ${(el.textContent ?? '').trim().slice(0, 40)}`);
        return { scroll: document.documentElement.scrollWidth - vw, culprits };
      });
      report.push(`${locale} ${size} ${name}: title="${await page.title()}" overflow=${wide.scroll}px${wide.scroll > 1 ? ` culprits=${JSON.stringify(wide.culprits)}` : ''}`);
      if (name === 'collection') {
        await shot('top');
        await part('#deck-builder-section', 'deck');
        await page.evaluate(() => { document.querySelector('.deck-load[data-deck-name="Verona"]').click(); document.getElementById('deck-name').value = ''; document.getElementById('save-deck-btn').click(); });
        await part('#deck-builder-section', 'deck-error');
        await part('#city-grid', 'cities');
        await part('#variant-list', 'variants');
        await part('#achievement-grid', 'achievements');
        for (const id of ['DC-001', 'RL-001', 'PT-002']) {
          await page.evaluate((card) => window.__collection.openCardModal(card), id);
          await page.waitForTimeout(400);
          await shot(`modal-${id}`);
        }
        await page.evaluate(() => window.__collection.closeModal());
      } else if (name === 'world-map') {
        await shot('', { fullPage: true });
        await page.click('#world-grid [data-city="Cairo"]');
        await page.waitForTimeout(300);
        await shot('modal');
      } else {
        await shot('', { fullPage: true });
      }
      if (size === 'phone' && name === 'home') {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.click('#mobile-menu-btn');
        await page.waitForTimeout(300);
        await shot('menu');
      }
    }
    await ctx.close();
  }
}
await browser.close();
console.log(report.join('\n'));
