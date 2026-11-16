import { test, expect, type Page } from '@playwright/test';

/**
 * The verse duel, played end to end against the written opponent.
 *
 * The test browser has no WebGPU, so no model loads: the opponent plays from
 * its written bank and the judging is by rule. With a fixed seed and deck the
 * whole match is deterministic, which is what lets these tests assert scores.
 * Playing against a real model is covered by tests/model/.
 */

const DECK = { name: 'Test deck', characters: ['DC-001', 'MO-001', 'CA-001'], relics: ['RL-001'], potions: ['PT-002'] };

/** A verse that keeps each form, asks a question (Hamlet's device) and echoes "question" (his signature). */
const VERSES: Record<string, string> = {
  Couplet: 'Who dares to stand upon my stage?\nI put the question to thy rage',
  'Paired Quatrain': 'Who dares to stand upon my stage?\nI put the question to thy rage\nThy candle gutters in the night\nAnd mine shall be the only light',
  'Crossed Quatrain': 'Who dares to stand upon my stage?\nThy candle gutters in the night\nI put the question to thy rage\nAnd mine shall be the only light',
  Tercet: 'Who dares to stand upon my stage?\nI put the question plainly now\nAnd wait in vain to hear thy rage',
  Anaphora: 'Who dares to stand upon my stage?\nWho brings a candle to the sun?\nWho answers when the question comes?',
  Crescendo: 'Who dares?\nI put the question\nAnd none of thy poor lines can answer it tonight',
  Epistrophe: 'Who dares to stand upon this stage?\nI put the question to the stage\nAnd none but I shall hold the stage',
  Haiku: 'Who dares to stand here?\nI put the question to thee\nThe night will not speak',
  'Heroic Couplet': 'Who dares to stand upon my midnight stage?\nI put the question to thy empty rage',
};
const ACROSTIC: Record<string, string> = { B: 'Bold?', A: 'A question waits', R: 'Rage on', D: 'Down thou goest', M: 'Mine?', O: 'Only a question', N: 'Never mind', K: 'Kneel?', I: 'I put the question', G: 'Go', S: 'Stand?', E: 'Every question waits', F: 'Fear?', T: 'This question stands', W: 'Who dares?', P: 'Pray, a question', L: 'Lost?', Y: 'Yield' };

/** A verse for whatever form the round drew. */
async function verseFor(page: Page): Promise<string> {
  const name = (await page.locator('#form-name').innerText()).trim();
  if (name === 'Acrostic') {
    const word = (await page.locator('#form-brief').innerText()).match(/spell ([A-Z]+)/)![1];
    return [...word].map((ch) => ACROSTIC[ch]).join('\n');
  }
  return VERSES[name];
}

async function open(page: Page, seed = 11) {
  await page.addInitScript((deck) => {
    localStorage.setItem('inspired-mile-decks', JSON.stringify([deck]));
    localStorage.setItem('inspired-mile-active-deck', deck.name);
  }, DECK);
  await page.goto(`/battle?seed=${seed}&brain=rules`);
  await expect(page.locator('#start-duel')).toBeEnabled();
}

async function start(page: Page) {
  await page.click('#start-duel');
  await expect(page.locator('#battle-arena')).toBeVisible();
  await expect(page.locator('#opponent-verse')).not.toHaveText('…');
}

test.describe('Verse duel', () => {
  test('set-up shows the saved deck and says no model is running', async ({ page }) => {
    await open(page);
    await expect(page.locator('#deck-name')).toHaveText('Test deck');
    await expect(page.locator('#deck-cards > div')).toHaveCount(5);
    await expect(page.locator('#brain-status')).toContainText(/written/i);
  });

  test('a round shows the form, the opponent, its verse and a live checklist', async ({ page }) => {
    await open(page);
    await start(page);
    await expect(page.locator('#round-label')).toHaveText('Round 1 of 3');
    await expect(page.locator('#form-name')).not.toBeEmpty();
    await expect(page.locator('#opponent-name')).not.toBeEmpty();
    expect((await page.locator('#opponent-verse').innerText()).trim().split('\n').length).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#ink')).toHaveText('2');
    await expect(page.locator('#submit-verse')).toBeDisabled();

    await page.click('[data-char-id="DC-001"]');
    await expect(page.locator('#live-checks li')).not.toHaveCount(1);
    await expect(page.locator('#live-craft')).toHaveText('0');
    await page.fill('#verse-input', await verseFor(page));
    await expect(page.locator('#submit-verse')).toBeEnabled();
    // Hamlet's house device is the question, and "question" echoes his line.
    await expect(page.locator('#live-checks')).toContainText('The Question');
    await expect(page.locator('#live-checks li', { hasText: 'The Question' }).locator('span').first()).toHaveText('✓');
    await expect(page.locator('#live-checks li', { hasText: 'Signature' }).locator('span').first()).toHaveText('✓');
    // Form kept (20) with the device and the signature both landed (×2).
    await expect(page.locator('#live-craft')).toHaveText('40');
  });

  test('spending ink on a relic and a potion empties the well and shows the power words', async ({ page }) => {
    await open(page);
    await start(page);
    await page.click('[data-char-id="DC-001"]');
    await page.click('[data-item-id="RL-001"]');
    await expect(page.locator('#ink')).toHaveText('1');
    await expect(page.locator('#live-checks')).toContainText('Power words');
    await page.click('[data-item-id="PT-002"]');
    await expect(page.locator('#ink')).toHaveText('0');
    await page.click('[data-item-id="RL-001"]');
    await expect(page.locator('#ink')).toHaveText('1');
    await expect(page.locator('#live-checks')).not.toContainText('Power words');
  });

  test('a full match: three rounds, a verdict each, a result, and stats that move', async ({ page }) => {
    await open(page);
    await start(page);
    const chars = ['DC-001', 'MO-001', 'CA-001'];
    for (let round = 0; round < 3; round++) {
      await expect(page.locator('#round-label')).toHaveText(`Round ${round + 1} of 3`);
      // A character already played cannot be played again.
      if (round > 0) await expect(page.locator(`[data-char-id="${chars[round - 1]}"]`)).toHaveClass(/pointer-events-none/);
      await page.click(`[data-char-id="${chars[round]}"]`);
      await page.fill('#verse-input', await verseFor(page));
      await page.click('#submit-verse');
      const verdict = page.locator('#verdict');
      await expect(verdict).toBeVisible();
      await expect(verdict).toHaveAttribute('data-winner', /player|opponent/);
      await expect(verdict).toContainText('Round score');
      await expect(verdict).toContainText('Judged by rule');
      if (await page.locator('#next-round').innerText() === 'See the result') break;
      await page.click('#next-round');
      await expect(page.locator('#opponent-verse')).not.toHaveText('…');
    }
    await page.click('#next-round');
    await expect(page.locator('#verdict')).toHaveAttribute('data-match', /player|opponent/);
    await expect(page.locator('#duel-again')).toBeVisible();
    expect(Number(await page.locator('#rounds-played').innerText())).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#battles-total')).toHaveText('1');
  });

  test('the same seed draws the same forms and the same opening verse', async ({ page }) => {
    await open(page, 2024);
    await start(page);
    const first = [await page.locator('#form-name').innerText(), await page.locator('#opponent-name').innerText(), await page.locator('#opponent-verse').innerText()];
    await open(page, 2024);
    await start(page);
    expect([await page.locator('#form-name').innerText(), await page.locator('#opponent-name').innerText(), await page.locator('#opponent-verse').innerText()]).toEqual(first);
  });

  test('an empty verse cannot be submitted and markup in a verse is shown as text', async ({ page }) => {
    await open(page);
    await start(page);
    await page.click('[data-char-id="DC-001"]');
    await page.fill('#verse-input', '   \n  ');
    await expect(page.locator('#submit-verse')).toBeDisabled();
    await page.fill('#verse-input', '<img src=x onerror="window.__pwned=1">\n<b>bold</b> rage');
    await page.click('#submit-verse');
    await expect(page.locator('#verdict')).toContainText('<b>bold</b> rage');
    expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
    await expect(page.locator('#verdict img')).toHaveCount(0);
  });

  test('without a saved deck a starter deck is dealt', async ({ page }) => {
    await page.goto('/battle?seed=3&brain=rules');
    await expect(page.locator('#deck-name')).toHaveText('Starter deck');
    await expect(page.locator('#deck-cards > div')).toHaveCount(5);
    await expect(page.locator('#start-duel')).toBeEnabled();
  });
});
