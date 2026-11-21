import { test, expect, type Page } from '@playwright/test';
import { MODELS } from '../src/lib/brain';
import { aiGenerated, readAiGenerated } from '../src/lib/ai-marking';
import { createDuel, starterDeck } from '../src/lib/verse/duel';
import { writeOpponentVerse } from '../src/lib/verse/opponent';
import PRON from '../src/lib/verse/pron-en';
import { installPronunciation } from '../src/lib/verse/pronounce';
import { setLists, standInModel, stubCount } from './stand-in-model';

/**
 * A verse a model wrote is marked where it appears: a visible label beside it in the interface's
 * language (owner decision D-12) and, on its element, a machine-readable mark naming the model and
 * its version (EU AI Act Article 50(2), D-01; docs/AI-MARKING.md). A verse the written opponent
 * plays carries neither. The voice setting says "AI voice".
 *
 * The model is the stand-in of stand-in-model.ts, made to write VERSE. Which seed lets its verse be
 * played (the session plays a model's verse only when it is worth at least half the written one,
 * opponent.ts) is found here with the game's own code, so the test does not hope for it.
 */
installPronunciation(PRON);

const VERSE = 'The night is cold and clear\nI sing of what was here';

async function seedTheModelWins(): Promise<number> {
  for (let seed = 1; seed < 3000; seed++) {
    const duel = createDuel(seed, 'en', starterDeck());
    const written = await writeOpponentVerse({ duel, roundIndex: 0, difficulty: 'player', generate: async () => VERSE });
    if (written.source === 'model') return seed;
  }
  throw new Error('no seed below 3000 plays the stand-in\'s verse in its first round');
}

async function startDuel(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('#start-duel')).toBeEnabled({ timeout: 60_000 });
  await page.selectOption('#language', 'en');
  await page.click('#start-duel');
  await expect(page.locator('#battle-arena')).toBeVisible();
  await expect(page.locator('#opponent-verse')).toHaveAttribute('data-source', /written|model/, { timeout: 60_000 });
}

test.describe('A verse a model wrote is marked', () => {
  // The stand-in model library is served by page.route, which a service worker would go round.
  test.use({ serviceWorkers: 'block' });

  const LABEL: Record<string, string> = { en: 'AI', fr: 'IA', de: 'KI', ar: 'ذكاء اصطناعي', ja: 'AI' };
  for (const ui of Object.keys(LABEL)) {
    test(`on the battle page, labelled in the interface's language (${ui}) and marked with the model and its version`, async ({ page }) => {
      const seed = await seedTheModelWins();
      await standInModel(page, { verse: VERSE });
      await page.addInitScript((l) => localStorage.setItem('inspired-mile-locale', l), ui);
      await page.goto(`/battle?brain=grand&seed=${seed}`);
      await expect(page.locator('#brain-status')).toContainText('Gemma 4 E2B');
      await setLists(page, 'grand', ['en'], []);
      await page.selectOption('#language', 'en');
      await page.click('#start-duel');
      const verse = page.locator('#opponent-verse');
      await expect(verse).toHaveAttribute('data-source', 'model', { timeout: 60_000 });
      expect((await stubCount(page)).generations).toBeGreaterThan(0);
      await expect(verse).toContainText('I sing of what was here');
      const mark = readAiGenerated(await verse.getAttribute('data-ai-generated'));
      expect(mark).toEqual({ name: 'Gemma 4 E2B', model: MODELS.grand.id, revision: 'main', dtype: MODELS.grand.dtype });
      await expect(verse).toHaveAttribute('data-ai-generated', aiGenerated(MODELS.grand));
      await expect(verse).toHaveAttribute('data-ai-source', 'trainedAlgorithmicMedia');
      const label = page.locator('#opponent-ai-label');
      await expect(label).toBeVisible();
      await expect(label).toHaveText(LABEL[ui]);
      await expect(page.locator('#voice-label')).not.toHaveText(/^Voice:/);
      if (ui === 'en') await expect(page.locator('#voice-label')).toHaveText('AI voice: Off');
    });
  }

  /** A duel whose first verse the stand-in model wrote, in English, with the interface in `ui`. */
  async function modelDuel(page: Page, ui: string) {
    const seed = await seedTheModelWins();
    await standInModel(page, { verse: VERSE });
    await page.addInitScript((l) => localStorage.setItem('inspired-mile-locale', l), ui);
    await page.goto(`/battle?brain=grand&seed=${seed}`);
    await expect(page.locator('#brain-status')).toContainText('Gemma 4 E2B');
    await setLists(page, 'grand', ['en'], []);
    await page.selectOption('#language', 'en');
    await page.click('#start-duel');
    await expect(page.locator('#opponent-verse')).toHaveAttribute('data-source', 'model', { timeout: 60_000 });
    await expect(page.locator('#opponent-ai-label')).toBeVisible();
  }

  test('a screen reader is told: the label and the verse are one polite live region, written once, not on every keystroke', async ({ page }) => {
    await modelDuel(page, 'en');
    const region = await page.evaluate(() => {
      const of = (id: string) => document.getElementById(id)!.closest('[aria-live]');
      return { verse: of('opponent-verse')?.id, label: of('opponent-ai-label')?.id, live: of('opponent-verse')?.getAttribute('aria-live'), atomic: of('opponent-verse')?.getAttribute('aria-atomic') };
    });
    expect(region).toEqual({ verse: 'opponent-said', label: 'opponent-said', live: 'polite', atomic: 'true' });
    // Typing redraws the round; the live region must not change, or a screen reader reads the verse again at every key.
    await page.evaluate(() => {
      (window as any).__regionChanges = 0;
      new MutationObserver((records) => { (window as any).__regionChanges += records.length; })
        .observe(document.getElementById('opponent-said')!, { childList: true, characterData: true, subtree: true });
    });
    // Choosing who answers and typing both redraw the round; the checklist is redrawn from the same changes (it says
    // what the verse does so far), so it shows the redraws happened.
    await page.locator('#hand-characters [data-char-id]').first().click();
    await expect(page.locator('#live-checks li')).not.toHaveCount(1);
    const checks = await page.locator('#live-checks').innerText();
    await page.locator('#verse-input').pressSequentially('The moon is bright tonight\nAnd I sing', { delay: 20 });
    await expect.poll(() => page.locator('#live-checks').innerText()).not.toBe(checks);
    expect(await page.evaluate(() => (window as any).__regionChanges)).toBe(0);
  });

  for (const ui of ['ar', 'ja']) {
    test(`the label sits at the start of the verse it labels (${ui} interface, English duel)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await modelDuel(page, ui);
      await expect(page.locator('#opponent-ai-label')).toHaveText(LABEL[ui]);
      const [label, verse] = await Promise.all([page.locator('#opponent-ai-label').boundingBox(), page.locator('#opponent-verse').boundingBox()]);
      // An English verse starts at the left: the label above it starts there too (on the Arabic page it sat ~700 px away, at the right).
      expect(Math.abs(label!.x - verse!.x)).toBeLessThan(24);
      expect(label!.y).toBeLessThan(verse!.y);
      expect(verse!.y - (label!.y + label!.height)).toBeLessThan(24);
    });
  }

  for (const ui of ['en', 'de', 'ru', 'ar', 'hi']) {
    test(`at phone width each control under the verse stays on one line (${ui})`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript((l) => localStorage.setItem('inspired-mile-locale', l), ui);
      await startDuel(page, '/battle?brain=rules&seed=11');
      for (const id of ['mic-label', 'voice-label']) {
        expect(await page.locator(`#${id}`).evaluate((el) => el.getClientRects().length), id).toBe(1);
      }
      expect(await page.locator('#submit-verse').evaluate((el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
      }), 'submit-verse').toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test('the written opponent\'s verse carries no label and no mark, with no model loaded', async ({ page }) => {
    await startDuel(page, '/battle?brain=rules&seed=11');
    const verse = page.locator('#opponent-verse');
    await expect(verse).toHaveAttribute('data-source', 'written');
    await expect(verse).not.toHaveAttribute('data-ai-generated', /.*/);
    await expect(page.locator('#opponent-ai-label')).toBeHidden();
    await expect(page.locator('#voice-label')).toHaveText('AI voice: Off');
  });

  test('nor with a model loaded that does not write the duel\'s language', async ({ page }) => {
    await standInModel(page, { verse: VERSE });
    await page.goto('/battle?brain=grand&seed=11');
    await expect(page.locator('#brain-status')).toContainText('Gemma 4 E2B');
    await setLists(page, 'grand', [], ['en']);
    await page.selectOption('#language', 'en');
    await page.click('#start-duel');
    const verse = page.locator('#opponent-verse');
    await expect(verse).toHaveAttribute('data-source', 'written', { timeout: 60_000 });
    expect((await stubCount(page)).generations).toBe(0);
    await expect(verse).not.toHaveAttribute('data-ai-generated', /.*/);
    await expect(page.locator('#opponent-ai-label')).toBeHidden();
  });

  test('in the Theatre: the label on the stage, the mark on the verse as text beside it', async ({ page }) => {
    const seed = await seedTheModelWins();
    await standInModel(page, { verse: VERSE });
    await page.addInitScript(() => {
      localStorage.setItem('inspired-mile-brain', 'grand');
      localStorage.setItem('inspired-mile-duel-lang', 'en');
    });
    await page.goto(`/theatre?seed=${seed}`);
    await page.waitForFunction(() => (window as any).__theatre?.session?.phase === 'player-turn', undefined, { timeout: 60_000 });
    expect(await page.evaluate(() => (window as any).__theatre.session.opponentSource)).toBe('model');
    const panel = await page.evaluate(() => (window as any).__theatre.theatre.panels.opponent.text.text as string);
    expect(panel).toMatch(/AI · Gemma 4 E2B\nThe night is cold and clear\nI sing of what was here/);
    const verse = page.locator('#theatre-opponent-verse');
    await expect(verse).toContainText('I sing of what was here');
    await expect(verse).toHaveAttribute('data-ai-generated', aiGenerated(MODELS.grand));
    await expect(page.locator('#theatre-opponent-label')).not.toHaveAttribute('hidden', /.*/);
  });

  test('in the Theatre with the written opponent: no label and no mark', async ({ page }) => {
    await page.goto('/theatre?seed=11&brain=rules');
    await page.waitForFunction(() => (window as any).__theatre?.session?.phase === 'player-turn', undefined, { timeout: 60_000 });
    const panel = await page.evaluate(() => (window as any).__theatre.theatre.panels.opponent.text.text as string);
    expect(panel).not.toContain('AI ·');
    const verse = page.locator('#theatre-opponent-verse');
    await expect(verse).toHaveAttribute('data-source', 'written');
    await expect(verse).not.toHaveAttribute('data-ai-generated', /.*/);
    await expect(page.locator('#theatre-opponent-label')).toHaveAttribute('hidden', /.*/);
  });
});
