import { test, expect, type Page } from '@playwright/test';

/**
 * Card names and quotations in the language of the interface and of the duel.
 *
 * Played against the written opponent (?brain=rules). The names come from
 * src/lib/cards-i18n, loaded a moment after the language is chosen; the
 * signature is judged against the card's line in the duel's language.
 */

const DECK = { name: 'Test deck', characters: ['DC-001', 'MO-001', 'CA-001'], relics: ['RL-001'], potions: ['PT-002'] };

async function open(page: Page) {
  await page.addInitScript((deck) => {
    localStorage.setItem('inspired-mile-decks', JSON.stringify([deck]));
    localStorage.setItem('inspired-mile-active-deck', deck.name);
  }, DECK);
  await page.goto('/battle?seed=11&brain=rules');
  await expect(page.locator('#locale-switch option')).toHaveCount(16);
}

async function switchTo(page: Page, locale: string) {
  await page.selectOption('#locale-switch', locale);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}

async function begin(page: Page, card = 'DC-001') {
  await page.click('#start-duel');
  await expect(page.locator('#battle-arena')).toBeVisible();
  await expect(page.locator('#opponent-verse')).toHaveAttribute('data-source', 'written');
  await page.click(`[data-char-id="${card}"]`);
}

test.describe('Card names and lines per language', () => {
  test('English shows the English names', async ({ page }) => {
    await open(page);
    await expect(page.locator('#deck-cards')).toContainText('Romeo');
    await expect(page.locator('#deck-cards')).toContainText("Yorick's Skull");
  });

  test('French: names from the French record, and the signature read against Hugo’s line', async ({ page }) => {
    await open(page);
    await switchTo(page, 'fr');
    await expect(page.locator('#deck-cards')).toContainText('Roméo');
    await expect(page.locator('#deck-cards')).toContainText('Le crâne de Yorick');
    await expect(page.locator('#deck-cards')).not.toContainText("Yorick's Skull");
    await begin(page);
    const signature = page.locator('#live-checks li', { hasText: 'Signature' }).locator('span').first();
    // "question" is the telling word of « Être, ou ne pas être, c'est là la question. »
    await page.fill('#verse-input', 'Qui ose monter sur ma scène ?\nJe pose ma question à la nuit');
    await expect(signature).toHaveText('✓');
    // Reciting the line is not an echo.
    await page.fill('#verse-input', 'Qui ose monter sur ma scène ?\nÊtre, ou ne pas être, c’est là la question');
    await expect(signature).not.toHaveText('✓');
    // Nor is a verse that has none of its words.
    await page.fill('#verse-input', 'Qui ose monter sur ma scène ?\nLa nuit est calme');
    await expect(signature).not.toHaveText('✓');
  });

  test('Italian: the name from Wikidata, and the signature read against Rusconi’s published line', async ({ page }) => {
    await open(page);
    await switchTo(page, 'it');
    await expect(page.locator('#deck-cards')).toContainText('Amleto');
    await expect(page.locator('#deck-cards')).not.toContainText("Yorick's Skull");
    await begin(page);
    const signature = page.locator('#live-checks li', { hasText: 'Firma' }).locator('span').first();
    // Rusconi (1858): «Essere o non essere, ecco il gran problema»
    await page.fill('#verse-input', 'Chi osa salire sul mio palco?\nLa luna dorme sul mare');
    await expect(signature).not.toHaveText('✓');
    await page.fill('#verse-input', 'Chi osa salire sul mio palco?\nIl mio problema è la notte');
    await expect(signature).toHaveText('✓');
    await page.fill('#verse-input', 'Chi osa salire sul mio palco?\nEssere o non essere, ecco il gran problema');
    await expect(signature).not.toHaveText('✓');
  });

  test('Japanese: the name in Japanese, and a Japanese word lands the signature', async ({ page }) => {
    await open(page);
    await switchTo(page, 'ja');
    await expect(page.locator('#deck-cards')).toContainText('ハムレット');
    await begin(page);
    const signature = page.locator('#live-checks li', { hasText: 'シグネチャー' }).locator('span').first();
    await page.fill('#verse-input', 'だれが私の舞台に立つのか？\n月は静かに沈む');
    await expect(signature).not.toHaveText('✓');
    await page.fill('#verse-input', 'だれが私の舞台に立つのか？\n生きることも死ぬことも、私の問題だ');
    await expect(signature).toHaveText('✓');
    // Tsubouchi's line has three telling words, so one is not enough (as in English, signatureNeeded).
    await page.fill('#verse-input', 'だれが私の舞台に立つのか？\n私の問題だ');
    await expect(signature).not.toHaveText('✓');
    // The English word still counts for a player who writes it, as one of the two.
    await page.fill('#verse-input', 'だれが私の舞台に立つのか？\nquestion、私の問題だ');
    await expect(signature).toHaveText('✓');
  });

  test('Japanese: an echo of Tsubouchi’s 薔薇の花 is an echo, not a quotation', async ({ page }) => {
    await open(page);
    await switchTo(page, 'ja');
    await begin(page, 'CA-001');
    const row = page.locator('#live-checks li', { hasText: 'シグネチャー' });
    // Four of the segmenter's "words" (薔薇 の 花 は) are five letters, not a recital of the line (2026-11-16 check).
    // The line has four telling words (薔薇, 他の, 同じ, 善い), so the verse says two.
    await page.fill('#verse-input', 'だれが私の舞台に立つのか？\n薔薇の花は同じ夜に眠る');
    await expect(row.locator('span').first()).toHaveText('✓');
    await expect(row).toContainText('「薔薇、同じ」を響かせました');
    await expect(row).not.toContainText('そのまま引用しています');
    // Reciting the line still is one.
    await page.fill('#verse-input', 'だれが私の舞台に立つのか？\n薔薇の花は、他の名で呼んでも、同じやうに善い香がする');
    await expect(row).toContainText('そのまま引用しています');
  });

  test('German: the echoed noun is shown as the line writes it (Rose, not rose)', async ({ page }) => {
    await open(page);
    await switchTo(page, 'de');
    await begin(page, 'CA-001');
    const row = page.locator('#live-checks li', { hasText: 'Signatur' });
    await page.fill('#verse-input', 'Wer wagt es, meine Bühne zu betreten?\nDie Rose duftet im Dunkeln');
    await expect(row.locator('span').first()).toHaveText('✓');
    await expect(row).toContainText('Anklang an „Rose, duften“');
  });

  test('Spanish: a titled name in a sentence is set off as the card’s title (2026-11-17 check: «de Príncipe Hamlet»)', async ({ page }) => {
    await open(page);
    await switchTo(page, 'es');
    await expect(page.locator('#deck-cards')).toContainText('Príncipe Hamlet');
    await begin(page);
    const row = page.locator('#live-checks li', { hasText: 'Firma' });
    await expect(row).toContainText('evoca la frase de «Príncipe Hamlet» sin citarla');
    await expect(row).not.toContainText('de Príncipe Hamlet');
  });

  test('French: de is elided before a name that begins with a vowel or a mute h (2026-11-17 check: «de Ophélie»)', async ({ page }) => {
    await open(page);
    await switchTo(page, 'fr');
    await begin(page);
    const row = page.locator('#live-checks li', { hasText: 'Signature' });
    await expect(row).toContainText('la réplique d’Hamlet sans la citer');
    await expect(row).not.toContainText('de Hamlet');
  });

  test('Arabic: a relic’s words are listed as Arabic lists them, never with a Latin comma (2026-11-17 check: «جمجمة, مزحة»)', async ({ page }) => {
    await open(page);
    await switchTo(page, 'ar');
    await begin(page);
    await page.click('[data-item-id="RL-001"]');
    const note = page.locator('#item-note');
    // The interface joins a list by Intl.ListFormat (CLDR): Arabic joins with و, and the Arabic comma ، past two items.
    await expect(note).toContainText(' و');
    await expect(note).not.toContainText(', ');
  });

  test('Russian: a name Wikidata writes small stands with a capital on the card', async ({ page }) => {
    await page.addInitScript(() => {
      const deck = { name: 'Paris deck', characters: ['VC-004', 'MO-001', 'CA-001'], relics: [], potions: [] };
      localStorage.setItem('inspired-mile-decks', JSON.stringify([deck]));
      localStorage.setItem('inspired-mile-active-deck', deck.name);
    });
    await page.goto('/battle?seed=11&brain=rules');
    await switchTo(page, 'ru');
    await expect(page.locator('#deck-cards')).toContainText('Граф Парис');
    await expect(page.locator('#deck-cards')).not.toContainText('граф Парис');
  });
});
