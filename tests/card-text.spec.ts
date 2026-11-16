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

async function begin(page: Page) {
  await page.click('#start-duel');
  await expect(page.locator('#battle-arena')).toBeVisible();
  await expect(page.locator('#opponent-verse')).toHaveAttribute('data-source', 'written');
  await page.click('[data-char-id="DC-001"]');
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
    // The English word still counts for a player who writes it.
    await page.fill('#verse-input', 'だれが私の舞台に立つのか？\nquestion');
    await expect(signature).toHaveText('✓');
  });
});
