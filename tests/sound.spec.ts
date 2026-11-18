import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Rhyme and syllables by sound, in a real browser.
 *
 * The engine's answers come from data (one table per language, a Japanese analyser), so
 * they must be the same everywhere. Each language's rules are run here, in the browser,
 * over the same test sets the unit tests use, and must give the digest that plain Node
 * recorded in src/lib/verse/sound/corpus/expected.json: every single answer the same.
 *
 * Also checked: no page fetches any of that data until a duel starts, and a duel fetches
 * only its own language's.
 */

const DIR = 'src/lib/verse/sound/corpus';
const expected = JSON.parse(readFileSync(`${DIR}/expected.json`, 'utf8'));
const sets = JSON.parse(readFileSync(`${DIR}/syllables.json`, 'utf8'));
const LANGS = ['es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
const DECK = { name: 'Test deck', characters: ['DC-001', 'MO-001', 'CA-001'], relics: ['RL-001'], potions: ['PT-002'] };

/** A request for sound data: a table module, the analyser, or one of its dictionary files. */
const SOUND = /\/sound\/data\/|\/sound\/ja|kuromoji|\.dat\.gz/;

test('a page load fetches no sound data, and a duel fetches only its own language', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.addInitScript((deck) => {
    localStorage.setItem('inspired-mile-decks', JSON.stringify([deck]));
    localStorage.setItem('inspired-mile-active-deck', deck.name);
  }, DECK);
  await page.goto('/');
  // No duel language named or stored: a link with ?lang=, or a language chosen on an earlier visit,
  // has its data fetched once the page is idle, by design (battle.astro warm(), tests/battle-bytes.spec.ts).
  await page.goto('/battle?seed=11&brain=rules');
  await expect(page.locator('#start-duel')).toBeEnabled();
  // Past the idle warm-up's own deadline (2 s), so a page that warmed with nothing named or stored
  // would show it here; the English table counts too. One that warmed later, on a timer, shows in
  // tests/battle-bytes.spec.ts, which runs ten minutes of the page's clock.
  await page.waitForTimeout(2500);
  expect(requests.filter((u) => SOUND.test(u) || /pron-en/.test(u))).toEqual([]);
  await page.selectOption('#language', 'fr');
  await page.click('#start-duel');
  await expect(page.locator('#battle-arena')).toBeVisible();
  const sound = requests.filter((u) => SOUND.test(u));
  expect(sound.length).toBeGreaterThan(0);
  expect(sound.filter((u) => !/\/sound\/data\/fr/.test(u))).toEqual([]);
});

for (const lang of LANGS) {
  test(`${lang}: the browser gives the answers Node recorded`, async ({ page }) => {
    test.setTimeout(180_000);
    const corpus = existsSync(`${DIR}/${lang}.json`) ? JSON.parse(readFileSync(`${DIR}/${lang}.json`, 'utf8')) : null;
    await page.goto('/about');
    const out = await page.evaluate(
      async ({ lang, corpus, set }) => {
        // The dev server serves the engine's modules by path; a variable keeps any bundler from resolving them.
        const load = (path: string) => import(/* @vite-ignore */ path);
        const sound = await load('/src/lib/verse/sound/index.ts');
        const packs = await load('/src/lib/verse/packs/index.ts');
        const digest = await load('/src/lib/verse/sound/digest.ts');
        await packs.loadPack(lang);
        performance.clearResourceTimings();
        const t0 = performance.now();
        const ok = await sound.loadSound(lang);
        const ms = Math.round(performance.now() - t0);
        const fetched = performance.getEntriesByType('resource').map((e) => (e as PerformanceResourceTiming).encodedBodySize).reduce((a, b) => a + b, 0);
        const first = digest.soundReport(lang, corpus ?? undefined, set ?? undefined);
        const second = digest.soundReport(lang, corpus ?? undefined, set ?? undefined);
        return { ok, ms, fetched, first, second };
      },
      { lang, corpus, set: sets[lang] ?? null },
    );
    // For docs/language/PHONETICS.md: time and bytes to load this language from the dev server.
    console.log(`SOUND-BROWSER ${JSON.stringify({ lang, ms: out.ms, fetchedBytes: out.fetched, ...out.first })}`);
    expect(out.ok).toBe(true);
    expect(out.second).toEqual(out.first);
    expect(out.first).toEqual(expected[lang]);
  });
}
