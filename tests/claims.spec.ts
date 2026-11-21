import { test, expect, type Page } from '@playwright/test';

/**
 * What the site says it does, held to what this build does (owner decision D-03, 2026-11-19: no claim
 * the code does not bear out). The first pass removed the claims doc 24 §2.3 lists; the check after it
 * found the same promises in other words, and these are the pages that made them:
 *
 * - Credits for play. Nothing in this build pays any (src/lib/economy-live.ts), yet the About page said
 *   "Credits are earned through gameplay", the Terms listed "battles, trivia, challenges, daily
 *   rewards", the Privacy Policy said the same, and the playground's odds said packs are bought with
 *   credits earned by playing and listed packs that nothing sells.
 * - Season Pass XP for play, which nothing posts: the page listed XP per battle, trivia and challenge.
 * - World cards for battles won: only a perfect trivia round awards one (the world map said so after
 *   the first pass; the collection page still said "win battles" and "three battles in a row").
 * - Story Mode, whose encounters open a scene and start no duel, promised "verse battles", and its
 *   last encounter put The Sonnet Man (a real performer's persona, owner decision D-04) in the
 *   opponent's chair with an invented line.
 * - "FERPA compliant", which the first pass took off the classroom tour, was still in the page's
 *   source, in an HTML comment.
 * - The app's description called it a "rap-battle card game"; the game is a duel of verses.
 *
 * Read in English: the other fifteen languages carry the same keys, changed with the English and
 * checked by the language pipelines (docs/language/).
 */

/** The page's text as a reader gets it (textContent: hidden parts too), and its source as served. */
async function read(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.ok(), path).toBe(true);
  const source = await response!.text();
  await page.waitForLoadState('load');
  const text = await page.evaluate(() => (document.querySelector('main') ?? document.body).textContent ?? '');
  return { source, text: text.replace(/\s+/g, ' ') };
}

test.describe('What the site claims', () => {
  test('no page says credits are earned by playing', async ({ page }) => {
    for (const path of ['/about', '/terms', '/privacy', '/playground']) {
      const { text } = await read(page, path);
      expect(text, path).not.toMatch(/credits? (?:are |is )?earned|earned through gameplay|earn(?:s|ed)? credits/i);
    }
  });

  test('the About page says credits are never bought with real money, and lists no amounts', async ({ page }) => {
    await page.goto('/about');
    const body = page.locator('[data-i18n-html="about.free.body"]');
    await expect(body).toHaveText('Every feature is available without spending a dime. Credits are never bought with real money.');
    expect(await page.locator('main').textContent()).not.toMatch(/\+\s?(?:50|30|20|10)\b/);
  });

  test('the playground lists no packs for sale, and says no real money buys anything', async ({ page }) => {
    // The first-visit tour would cover the page (and can come up after a skip): mark it seen before the page loads.
    await page.addInitScript(() => localStorage.setItem('inspired-mile-onboarding-done', '1'));
    await page.goto('/playground');
    await page.click('#odds-toggle');
    await expect(page.locator('#odds-content')).toBeVisible();
    await expect(page.locator('[data-i18n="pg.odds.tiers"]')).toHaveCount(0);
    await expect(page.locator('[data-i18n="pg.odds.note"]')).toHaveText('No real money purchases. Each card draw is independent.');
  });

  test('the Season Pass lists no XP for play and says play earns none', async ({ page }) => {
    await page.goto('/season');
    await expect(page.locator('[data-xp-rate]')).toHaveCount(0);
    await expect(page.locator('#season-no-xp')).toHaveText(/In this version of the game, play earns no XP\./);
    expect(await page.locator('main').textContent()).not.toMatch(/to earn XP/i);
  });

  test('the collection promises a world card for a perfect trivia round only, not for battles', async ({ page }) => {
    const { source } = await read(page, '/collection');
    expect(source).toContain('Get a perfect trivia score to unlock city variants.');
    expect(source).not.toMatch(/Win (?:three )?battles/i);
  });

  test('Story Mode says its encounters start no duel, and The Sonnet Man is in none of them', async ({ page }) => {
    const { source, text } = await read(page, '/story');
    expect(text).toContain('In this version of the game, an encounter opens its scene but starts no duel.');
    expect(text).not.toMatch(/verse battles/i);
    const acts = await page.locator('#acts-container').evaluate((el) => el.outerHTML);
    expect(acts).not.toContain('Sonnet Man');
    expect(await page.locator('[data-encounter="5-3"]').getAttribute('title')).toBe('Face Mark Antony in the ultimate battle.');
    expect(source.length).toBeGreaterThan(1000);
  });

  test('no page carries "FERPA compliant", in its text or in its source', async ({ page }) => {
    for (const path of ['/classroom', '/about', '/privacy', '/terms']) {
      const { source, text } = await read(page, path);
      expect(source, path).not.toMatch(/FERPA[- ]compliant/i);
      expect(text, path).not.toMatch(/FERPA[- ]compliant/i);
    }
  });

  test('the app describes itself as a duel of verses, not a rap battle', async ({ request }) => {
    const manifest = await (await request.get('/manifest.json')).json();
    expect(manifest.description).toBe('A Shakespeare card game of verse duels, from Inspired Mile. Play your cards, keep the form, and out-write an opponent that runs entirely on your device.');
    for (const [lang, text] of Object.entries(manifest.description_localized as Record<string, string | { value: string }>)) {
      // The words the old description used for a rap battle, language by language.
      expect(JSON.stringify(text), lang).not.toMatch(/\brap\b|rap-|battle de rap|Battle-Rap|battle rapu|рэп|باتل راب|रैप|说唱|MCバトル|배틀 랩|rap chiến|แร็ป|adu rap/i);
    }
  });

  test('the About page lays its four technology tiles out in full rows', async ({ page }) => {
    for (const width of [1280, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/about');
      const tops = await page.locator('#about-tech > div').evaluateAll((tiles) => tiles.map((t) => Math.round(t.getBoundingClientRect().top)));
      expect(tops).toHaveLength(4);
      const perRow = [...new Set(tops)].map((top) => tops.filter((t) => t === top).length);
      expect(new Set(perRow).size, `tiles per row at ${width} px: ${perRow.join(', ')}`).toBe(1);
    }
  });
});
