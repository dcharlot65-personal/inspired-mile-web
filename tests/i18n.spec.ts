import { test, expect, type Page } from '@playwright/test';

/**
 * The interface in other languages, and a duel fought in them.
 *
 * Each test switches the interface with the switcher in the navigation, plays
 * against the written opponent (?brain=rules, so no model is needed), and
 * checks three things: named strings are in the language, the duel itself is
 * fought in it (the opponent's verse comes from that language's pack), and
 * nothing untranslated leaks: no {placeholder}, no message key, none of a list
 * of English interface strings.
 */

const DECK = { name: 'Test deck', characters: ['DC-001', 'MO-001', 'CA-001'], relics: ['RL-001'], potions: ['PT-002'] };

/** English interface strings that must not be on screen in another language. */
const ENGLISH = [
  'Begin the duel', 'Prepare your duel', 'Your verse', 'Who answers?', 'Craft so far', 'Round score', 'Judged by rule',
  'Your opponent plays', 'Speak your verse', 'Sign In', 'Next round', 'See the result', 'Language of the duel',
  'Rounds played', 'Privacy Policy', 'Exactly', 'Power words', 'Match seed', 'Opponent',
];

async function open(page: Page, path = '/battle?seed=11&brain=rules') {
  await page.addInitScript((deck) => {
    localStorage.setItem('inspired-mile-decks', JSON.stringify([deck]));
    localStorage.setItem('inspired-mile-active-deck', deck.name);
  }, DECK);
  await page.goto(path);
  await expect(page.locator('#locale-switch option')).toHaveCount(16);
}

async function switchTo(page: Page, locale: string) {
  await page.selectOption('#locale-switch', locale);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}

/**
 * Every piece of interface text in the page, shown or not, without what belongs to the cards
 * and the verses.
 *
 * textContent, not innerText: innerText returns text as styled, and the labels here are
 * styled in capitals, so an English "Who answers?" left in a locale read "WHO ANSWERS?" and
 * slipped past this check (found by scripts/mutate-i18n-browser.mjs). textContent also
 * covers the panels that are hidden at the moment, which must be translated just the same.
 */
async function interfaceText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    // Verses are in the duel's language by design; card names and the languages' own names are data.
    clone.querySelectorAll('#opponent-verse, #verdict blockquote, #locale-switch, #language, script, style, svg').forEach((n) => n.remove());
    return (clone.textContent ?? '').replace(/\s+/g, ' ');
  });
}

async function expectNoLeaks(page: Page) {
  const text = await interfaceText(page);
  expect(text.length).toBeGreaterThan(200);
  expect(text.match(/\{[a-z_]+\}/gi), 'unfilled placeholders').toBeNull();
  expect(text.match(/\b(?:battle|round|verdict|live|brain|form|check|device|curse|auth|nav|footer|mic|voice|hand|end|badge|stats|theatre|signature|criterion|house|illegal)\.[a-zA-Z-]+(?:\.[a-zA-Z-]+)*\b/g), 'message keys shown as text').toBeNull();
  for (const s of ENGLISH) expect(text.includes(s), `English "${s}" is still on screen`).toBe(false);
}

async function playRound(page: Page, verse: string) {
  await page.click('#start-duel');
  await expect(page.locator('#battle-arena')).toBeVisible();
  await expect(page.locator('#opponent-verse')).toHaveAttribute('data-source', 'written');
  await page.click('[data-char-id="DC-001"]');
  await page.fill('#verse-input', verse);
}

test.describe('Interface languages', () => {
  test('Spanish: set-up, a round and its verdict, with nothing left in English', async ({ page }) => {
    await open(page);
    await switchTo(page, 'es');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('#start-duel')).toHaveText('Empezar el duelo');
    await expect(page.locator('#duel-setup h2')).toHaveText('Prepara tu duelo');
    await expect(page.locator('#deck-cards')).toContainText('La Pregunta');
    await expect(page.locator('#brain-status')).toContainText(/versos (ya )?escritos/);
    await expect(page.locator('nav a[href="/collection"]').first()).toHaveText('Colección');
    // Changing the interface language makes it the duel's language too.
    await expect(page.locator('#language')).toHaveValue('es');
    await expect(page.locator('#language option:checked')).toHaveText('Español');
    await expectNoLeaks(page);

    await playRound(page, '¿Quién se atreve a pisar mi escena?\nYo respondo con una pregunta');
    await expect(page.locator('#round-label')).toHaveText('Ronda 1 de 3');
    await expect(page.locator('#opponent-verse')).toHaveAttribute('lang', 'es');
    // The opponent's verse is Spanish verse from the pack, not the English bank.
    const verse = await page.locator('#opponent-verse').innerText();
    expect(verse).not.toMatch(/\b(thy|thou|the|and)\b/i);
    await expect(page.locator('#live-checks')).toContainText('La Pregunta');
    await expect(page.locator('#live-checks')).toContainText('Firma');
    await expect(page.locator('#live-checks li', { hasText: 'La Pregunta' }).locator('span').first()).toHaveText('✓');
    await expectNoLeaks(page);

    await page.click('#submit-verse');
    await expect(page.locator('#verdict')).toBeVisible();
    await expect(page.locator('#verdict')).toContainText('Puntos de la ronda');
    await expect(page.locator('#verdict')).toContainText('Juzgado por reglas');
    await expectNoLeaks(page);
  });

  test('Arabic: the page turns right to left and the duel is in Arabic', async ({ page }) => {
    await open(page);
    await switchTo(page, 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#start-duel')).toHaveText('ابدأ المبارزة');
    await expect(page.locator('#language')).toHaveValue('ar');
    await playRound(page, 'من يجرؤ أن يقف على مسرحي؟\nأنا أجيب بسؤال');
    await expect(page.locator('#round-label')).toHaveText('الجولة 1 من 3');
    await expect(page.locator('#opponent-verse')).toHaveAttribute('lang', 'ar');
    expect(await page.locator('#opponent-verse').innerText()).toMatch(/[؀-ۿ]/);
    await expect(page.locator('#live-checks')).toContainText('السؤال');
    // The Arabic question mark counts as a question.
    await expect(page.locator('#live-checks li', { hasText: 'السؤال' }).locator('span').first()).toHaveText('✓');
    await page.click('#submit-verse');
    await expect(page.locator('#verdict')).toContainText('نتيجة الجولة');
    await expectNoLeaks(page);
  });

  test('Japanese: the duel is in Japanese, and draws from every form Japanese is offered', async ({ page }) => {
    await open(page);
    await switchTo(page, 'ja');
    await expect(page.locator('#start-duel')).toHaveText('決闘を始める');
    await expect(page.locator('#language')).toHaveValue('ja');
    await playRound(page, 'だれが私の舞台に立つのか？\nこたえてみよ');
    await expect(page.locator('#round-label')).toHaveText('ラウンド 1 / 3');
    await expect(page.locator('#opponent-verse')).toHaveAttribute('lang', 'ja');
    expect(await page.locator('#opponent-verse').innerText()).toMatch(/[぀-ヿ一-鿿]/);
    // The rhyming forms are offered in Japanese since lines can be read (src/lib/verse/sound, 2026-11-16).
    expect(['首句反復', '折句', 'クレッシェンド', '結句反復', '俳句', '二行連句', '対韻の四行詩', '交差韻の四行詩', '三行連', '英雄対句']).toContain((await page.locator('#form-name').innerText()).trim());
    await page.click('#submit-verse');
    await expect(page.locator('#verdict')).toContainText('ラウンドの得点');
    await expectNoLeaks(page);
  });

  test('the choice is remembered, and switching back restores English', async ({ page }) => {
    await open(page);
    await switchTo(page, 'de');
    await expect(page.locator('#start-duel')).toHaveText('Duell beginnen');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.locator('#start-duel')).toHaveText('Duell beginnen');
    await expect(page.locator('#locale-switch')).toHaveValue('de');
    await switchTo(page, 'en');
    await expect(page.locator('#start-duel')).toHaveText('Begin the duel');
    await expect(page.locator('#language')).toHaveValue('en');
  });

  test('a duel under way is drawn again when the language changes', async ({ page }) => {
    await open(page);
    await playRound(page, 'Who dares to stand upon my stage?\nI put the question to thy rage');
    await expect(page.locator('#round-label')).toHaveText('Round 1 of 3');
    await switchTo(page, 'fr');
    await expect(page.locator('#round-label')).toHaveText('Manche 1 sur 3');
    await expect(page.locator('#live-checks')).toContainText('La Question');
    // The duel itself stays in the language it was started in.
    await expect(page.locator('#opponent-verse')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#verse-input')).toHaveValue(/Who dares/);
    await page.click('#submit-verse');
    await expect(page.locator('#verdict')).toContainText('Score de la manche');
    await switchTo(page, 'ko');
    await expect(page.locator('#verdict')).toContainText('라운드 점수');
  });

  test('the sign-in menu and the theatre follow the language', async ({ page }) => {
    await open(page, '/theatre?seed=11&brain=rules');
    await switchTo(page, 'pt');
    await expect(page.locator('#restart')).toHaveText('Novo duelo');
    await expect(page.locator('#theatre-status')).toContainText('estrofes escritas');
    await page.click('#auth-btn');
    await expect(page.locator('#auth-step-choose h3')).toHaveText('Entrar');
    await expect(page.locator('#auth-passkey-btn')).toContainText('chave de acesso');
    await page.waitForFunction(() => (window as any).__theatre?.session?.phase === 'player-turn');
    await expectNoLeaks(page);
  });

  test('every one of the sixteen languages loads and fills the page', async ({ page }) => {
    await open(page);
    const english = await page.locator('#start-duel').innerText();
    for (const l of ['es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id']) {
      await switchTo(page, l);
      await expect(page.locator('#start-duel')).not.toHaveText(english);
      await expect(page.locator('#language')).toHaveValue(l);
      await expectNoLeaks(page);
    }
  });
});

test.describe('Interface language from the browser', () => {
  test.use({ locale: 'fr-FR' });
  test('a French browser gets French without being asked', async ({ page }) => {
    await page.goto('/battle?seed=11&brain=rules');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('#start-duel')).toHaveText('Commencer le duel');
    await expect(page.locator('#locale-switch')).toHaveValue('fr');
  });
});
