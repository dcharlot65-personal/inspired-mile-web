// Pictures of the localised pages, to be looked at: overflow, clipping and right-to-left
// mistakes do not show in a test that reads text.
//
//   node scripts/pages-rest/shots.mjs <baseURL> <outDir> [locales] [widths]
//   node scripts/pages-rest/shots.mjs http://localhost:4399 /tmp/shots ar,de,ja,es phone,desktop
//
// Run on the build host against a dev server (npm run dev -- --port N). The API answers
// come from tests/pages-rest.fixtures.mjs, so every list is filled. One PNG per view, named
// <locale>-<width>-<view>.png; the page's own content (<main>) is captured whole, however
// long. It also prints anything that reaches past the edge of the screen.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { mockApi, startIn } from '../../tests/pages-rest.fixtures.mjs';

const [base, out, localeArg = 'ar,de,ja,es', widthArg = 'phone,desktop'] = process.argv.slice(2);
if (!base || !out) {
  console.error('usage: node scripts/pages-rest/shots.mjs <baseURL> <outDir> [locales] [widths]');
  process.exit(2);
}
const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 900 } };
mkdirSync(out, { recursive: true });

const settle = (page) => page.waitForTimeout(700);
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';
const asTeacher = (page) => page.addInitScript(() => {
  localStorage.setItem('inspired-mile-classroom-consent', 'teacher');
  localStorage.setItem('inspired-mile-teacher-wizard-done', '1');
});

/** Each view: where it is, what to do once there, and whether the picture is the whole <main> or the screen. */
const VIEWS = [
  { name: 'classroom-1-gate', path: '/classroom' },
  { name: 'classroom-2-teacher', path: '/classroom', act: async (p) => { await p.click('#role-teacher'); } },
  { name: 'classroom-3-wizard1', path: '/classroom', screen: true, act: async (p) => { await p.click('#role-teacher'); for (const b of await p.locator('.teacher-check').all()) await b.check(); await p.click('#teacher-continue'); } },
  { name: 'classroom-4-wizard3', path: '/classroom', screen: true, act: async (p) => { await p.click('#role-teacher'); for (const b of await p.locator('.teacher-check').all()) await b.check(); await p.click('#teacher-continue'); await p.click('#wizard-next'); await p.click('#wizard-next'); } },
  { name: 'classroom-5-student', path: '/classroom', act: async (p) => { await p.click('#role-student'); } },
  { name: 'classroom-6-list', path: '/classroom', before: asTeacher, act: async (p) => { await p.click('#btn-create'); await p.click('#create-submit'); } },
  { name: 'classroom-7-detail', path: '/classroom', before: asTeacher, act: async (p) => { await p.locator('#classrooms-list [data-id]').first().click(); await p.evaluate(() => { document.getElementById('new-assignment').classList.remove('hidden'); document.getElementById('assignment-form').classList.remove('hidden'); }); } },
  { name: 'marketplace-1-browse', path: '/marketplace' },
  { name: 'marketplace-2-sell', path: '/marketplace', act: async (p) => { await p.click('#tab-sell'); } },
  { name: 'tournaments-1-list', path: '/tournaments' },
  { name: 'tournaments-2-bracket', path: '/tournaments', act: async (p) => { await p.locator('.view-bracket-btn').first().click(); } },
  { name: 'season', path: '/season' },
  { name: 'season-signed-out', path: '/season', before: (p) => p.route(/\/api\/v1\/seasons\/current$/, (r) => r.fulfill({ status: 401, body: '' })) },
  { name: 'viewer', path: '/viewer' },
  { name: 'vr', path: '/vr' },
  { name: 'offline', path: '/offline.html', screen: true },
  // The install guidance as Safari on an iPhone gets it (src/lib/pwa.ts), over the season page.
  { name: 'install-ios', path: '/season', screen: true, context: { userAgent: IPHONE, hasTouch: true }, act: async (p) => { await p.locator('#pwa-install').waitFor(); } },
];

const browser = await chromium.launch();
let trouble = 0;
for (const locale of localeArg.split(',')) {
  for (const width of widthArg.split(',')) {
    for (const view of VIEWS) {
      // A context of its own for each view: what one view stores (the consent given, the tour
      // seen) must not change the next. No service worker: the requests it makes are not seen
      // by page.route, and the fixtures would be lost.
      const context = await browser.newContext({ viewport: VIEWPORTS[width], serviceWorkers: 'block', ...(view.context ?? {}) });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      try {
        await startIn(page, locale);
        await mockApi(page);
        if (view.before) await view.before(page);
        await page.goto(base + view.path, { waitUntil: 'load' });
        await page.waitForFunction((l) => document.documentElement.lang === l, locale, { timeout: 20000 });
        await settle(page);
        if (view.act) await view.act(page);
        await settle(page);
        const file = `${out}/${locale}-${width}-${view.name}.png`;
        if (view.screen) await page.screenshot({ path: file });
        else await page.locator('main').screenshot({ path: file });
        const sticking = await page.evaluate(() => {
          const w = document.documentElement.clientWidth;
          const found = [];
          document.querySelectorAll('main *, #teacher-wizard *, .container *').forEach((el) => {
            if (el.closest('.overflow-x-auto, .overflow-y-auto, .hidden, canvas, model-viewer')) return;
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            if (r.right > w + 1 || r.left < -1) found.push(`${el.tagName.toLowerCase()}#${el.id} [${Math.round(r.left)}..${Math.round(r.right)} of ${w}] "${(el.textContent || '').trim().slice(0, 50)}"`);
          });
          return { found: found.slice(0, 5), scroll: document.documentElement.scrollWidth - w };
        });
        if (sticking.found.length || sticking.scroll > 1) {
          trouble++;
          console.log(`OVERFLOW ${locale} ${width} ${view.name}: page scrolls sideways by ${sticking.scroll}px\n  ${sticking.found.join('\n  ')}`);
        }
      } catch (err) {
        trouble++;
        console.log(`FAILED ${locale} ${width} ${view.name}: ${String(err).split('\n').slice(0, 6).join(' | ')}`);
        // What was on screen when it failed, to see what was in the way.
        await page.screenshot({ path: `${out}/${locale}-${width}-${view.name}-FAILED.png` }).catch(() => {});
      } finally {
        await context.close();
      }
    }
    console.log(`done ${locale} ${width}`);
  }
}
await browser.close();
console.log(trouble ? `${trouble} view(s) need a look` : 'nothing sticks out of the screen');
