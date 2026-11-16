import { test, expect, type Page } from '@playwright/test';

/**
 * The playground and the story page in all sixteen languages.
 *
 * For each language: the page is opened in it, the onboarding overlay is read and
 * dismissed, the trivia and quote-challenge modals are opened, and the page is
 * searched for what must never be shown: a raw message key, an unfilled
 * {placeholder}, or English interface text left behind.
 *
 * textContent, not innerText (see tests/i18n.spec.ts): innerText returns text as
 * styled, so a label in capitals hides from a mixed-case list, and it skips what
 * is hidden at the moment, which must be translated just the same.
 * scripts/lang-content/mutate-play.mjs proves these tests go red.
 */

const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];

/** English interface strings of these two pages that must not be on screen in another language. */
const ENGLISH = [
  'Digital Playground', 'The Playground', 'Cards Owned', 'Battle Wins', 'Trivia Score', 'View Collection', 'Card Packs', 'Open packs',
  'Starter Pack', 'Daily Pack', 'CLAIMED', 'Drop Rates', 'Pack Tiers', 'Standard Pack', 'guaranteed', 'real money', 'Enter the Arena',
  'Shakespeare Trivia', 'Test your knowledge', 'Start Trivia', 'Quote Challenge', 'Complete the famous', 'Start Challenge', 'Check Answer',
  'Missing word', 'Blank 1', 'Hint:', 'Claim Your', 'Got it', 'Story Mode', 'Your Journey', 'encounters completed',
  'The Streets of Verona', 'Street Brawl', 'Easy', 'Medium', 'Hard', 'The Enchanted Forest', 'Tempest Island', 'The Final Bow',
];

async function open(page: Page, path: string, locale: string) {
  await page.addInitScript((l) => localStorage.setItem('inspired-mile-locale', l), locale);
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}

/** The tooltip is placed beside what it points at, which can be outside a headless viewport: click it from the page. */
async function skipOnboarding(page: Page) {
  await page.evaluate(() => (document.getElementById('onboarding-skip') as HTMLElement).click());
  await expect(page.locator('#onboarding-overlay')).toBeHidden();
}

/**
 * The interface text of the page, shown or hidden, without what is content by design:
 * the questions and quotations themselves (they quote Shakespeare in English), the
 * language switcher, and anything marked as being in English.
 */
async function interfaceText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('#locale-switch, #trivia-question, .trivia-option, #challenge-quote, [lang="en"], script, style, svg').forEach((n) => n.remove());
    return (clone.textContent ?? '').replace(/\s+/g, ' ');
  });
}

async function expectNoLeaks(page: Page, locale: string) {
  const text = await interfaceText(page);
  expect(text.length).toBeGreaterThan(200);
  expect(text.match(/\{[a-z_]+\}/gi), 'unfilled placeholders').toBeNull();
  expect(text.match(/\b(?:pg|story|trivia|challenge|challenges|streak|event|countdown|rarity|nav|footer)\.[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\b/g), 'message keys shown as text').toBeNull();
  if (locale !== 'en') for (const s of ENGLISH) expect(text.includes(s), `English "${s}" is still on screen in ${locale}`).toBe(false);
}

for (const locale of LOCALES) {
  test(`playground in ${locale}: onboarding, trivia and the quote challenge`, async ({ page }) => {
    await open(page, '/playground', locale);

    // Onboarding: shown on a first visit, in the language, then dismissed.
    const overlay = page.locator('#onboarding-overlay');
    await expect(overlay).toBeVisible();
    await expect(page.locator('#onboarding-title')).not.toBeEmpty();
    await expect(page.locator('#onboarding-desc')).not.toBeEmpty();
    await expectNoLeaks(page, locale);
    await skipOnboarding(page);

    // Trivia: a question and as many options as English has, in the language.
    await page.click('#trivia-start-btn');
    await expect(page.locator('#trivia-modal')).toBeVisible();
    await expect(page.locator('.trivia-option')).toHaveCount(4);
    await expect(page.locator('#trivia-question')).toHaveAttribute('lang', locale);
    await expect(page.locator('#trivia-question')).not.toBeEmpty();
    await expect(page.locator('#trivia-progress')).not.toBeEmpty();
    for (const option of await page.locator('.trivia-option').allTextContents()) expect(option.trim().length).toBeGreaterThan(0);
    await expectNoLeaks(page, locale);
    await page.click('#trivia-close');

    // The quote challenge: a line with its blanks, in the language or marked as the English original.
    await page.click('#challenge-start-btn');
    await expect(page.locator('#challenge-modal')).toBeVisible();
    const quote = page.locator('#challenge-quote');
    await expect(quote).toContainText('___');
    const quoteLang = await quote.getAttribute('lang');
    expect([locale, 'en']).toContain(quoteLang);
    const blanks = ((await quote.textContent()) ?? '').split('___').length - 1;
    await expect(page.locator('.challenge-input')).toHaveCount(blanks);
    if (locale !== 'en' && quoteLang === 'en') await expect(page.locator('#challenge-content [data-i18n="pg.challenge.original"]')).toBeVisible();
    if (quoteLang !== 'en') await expect(page.locator('#challenge-content [data-challenge-credit]')).toBeVisible();
    await expectNoLeaks(page, locale);
  });

  test(`story page in ${locale}: acts, encounters and an opened scene`, async ({ page }) => {
    await open(page, '/story', locale);
    await expect(page.locator('.encounter-card')).toHaveCount(19);
    await expect(page.locator('#progress-text')).toContainText('19');
    await page.click('.encounter-card[data-encounter="1-1"]');
    await expect(page.locator('#encounter-scene')).toBeVisible();
    await expect(page.locator('#scene-narrative')).toContainText('Do you bite your thumb at me, sir?');
    // More than the quotation alone (35 characters): the scene around it is there, in a script that may be compact.
    expect(((await page.locator('#scene-narrative').textContent()) ?? '').length).toBeGreaterThan(50);
    await expectNoLeaks(page, locale);
  });
}

test('a change of language relabels the open playground', async ({ page }) => {
  await open(page, '/playground', 'en');
  await expect(page.locator('#onboarding-overlay')).toBeVisible();
  await skipOnboarding(page);
  await expect(page.locator('#trivia-start-btn')).toHaveText('Start Trivia');
  await page.selectOption('#locale-switch', 'de');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('#trivia-start-btn')).toHaveText('Quiz starten');
  await page.click('#trivia-start-btn');
  await expect(page.locator('#trivia-question')).toHaveAttribute('lang', 'de');
  await expect(page.locator('#trivia-progress')).toContainText('Frage 1 / 5');
  await page.selectOption('#locale-switch', 'ja');
  await expect(page.locator('#trivia-progress')).toContainText('第 1 問');
  // Arabic turns the page right to left.
  await page.selectOption('#locale-switch', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});
