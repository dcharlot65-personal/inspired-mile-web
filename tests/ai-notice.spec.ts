import { test, expect, type Page } from '@playwright/test';
import { MODELS } from '../src/lib/brain';
import { setLists, standInModel } from './stand-in-model';

/**
 * Before a first duel the player is told, in their language, who plays and who judges: artificial
 * intelligence running on their device where a model is used, a program with prepared verses and the
 * rules where none is (EU AI Act Article 50(1), "at the latest at the time of the first interaction",
 * 50(5); src/lib/ai-notice.ts). Online, another player and the server's fixed rules.
 *
 * The expected sentences are the locale files' own, so a test reads the words the player reads.
 */

const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'] as const;
const strings = (l: string) => import(`../src/i18n/locales/${l}.ts`).then((m) => m.default as Record<string, string>);
const say = (s: string, model?: string) => (model ? s.replaceAll('{model}', model) : s);

async function inLocale(page: Page, l: string) {
  await page.addInitScript((code) => localStorage.setItem('inspired-mile-locale', code), l);
}

for (const l of LOCALES) {
  test.describe(`${l}`, () => {
    test('battle, no model: the notice says no artificial intelligence plays or judges, before the duel starts', async ({ page }) => {
      const s = await strings(l);
      await inLocale(page, l);
      await page.goto('/battle?seed=11&brain=rules');
      await expect(page.locator('html')).toHaveAttribute('lang', l);
      const notice = page.locator('#duel-setup #ai-notice');
      await expect(notice).toBeVisible();
      await expect(notice).toHaveText(s['notice.none']);
      await expect(notice).toHaveAttribute('data-opponent', 'written');
      await expect(notice).toHaveAttribute('data-judge', 'rules');
      // Before the first duel: the set-up is on screen and no duel has begun.
      await expect(page.locator('#start-duel')).toBeEnabled();
      await expect(page.locator('#battle-arena')).toBeHidden();
    });

    test('battle, with a model: the notice names it and says what it does in the duel\'s language', async ({ page }) => {
      const s = await strings(l);
      const m = MODELS.grand;
      await inLocale(page, l);
      await standInModel(page);
      await page.goto('/battle?brain=grand&seed=11');
      await expect(page.locator('#start-duel')).toBeEnabled({ timeout: 30_000 });
      // The model writes in en and it, judges in de and it: one duel language for each case.
      await setLists(page, 'grand', ['en', 'it'], ['de', 'it']);
      const notice = page.locator('#duel-setup #ai-notice');
      const CASES = [
        { lang: 'pl', key: null },
        { lang: 'it', key: 'notice.aiBoth', opponent: 'model', judge: 'model' },
        { lang: 'en', key: 'notice.aiWrites', opponent: 'model', judge: 'rules' },
        { lang: 'de', key: 'notice.aiJudges', opponent: 'written', judge: 'model' },
        { lang: 'fr', key: 'notice.none', opponent: 'written', judge: 'rules' },
      ];
      for (const c of CASES) {
        // Each choice changes the picker's value, so the page hears it (the first only moves it off the default).
        await page.selectOption('#language', c.lang);
        if (!c.key) continue;
        await expect(notice, `${l}: a duel in ${c.lang}`).toHaveText(say(s[c.key], c.key === 'notice.none' ? undefined : m.label));
        await expect(notice).toHaveAttribute('data-opponent', c.opponent!);
        await expect(notice).toHaveAttribute('data-judge', c.judge!);
      }
      await expect(page.locator('#battle-arena')).toBeHidden();
    });

    test('theatre, no model: the notice is on the page before its duel is played', async ({ page }) => {
      const s = await strings(l);
      await inLocale(page, l);
      await page.goto('/theatre?seed=11&brain=rules');
      await expect(page.locator('html')).toHaveAttribute('lang', l);
      const notice = page.locator('#ai-notice');
      await expect(notice).toBeVisible();
      await expect(notice).toHaveText(s['notice.none']);
    });

    test('multiplayer: another player and the server\'s rules, said in the player\'s language inside the English page', async ({ page }) => {
      const s = await strings(l);
      await inLocale(page, l);
      await page.goto('/multiplayer');
      const notice = page.locator('#mp-ai-notice');
      await expect(notice).toBeVisible();
      await expect(notice).toHaveText(s['notice.online']);
      // The page is English, but this line is the player's: marked as such, and laid out in its direction.
      await expect(notice).toHaveAttribute('lang', l);
      expect(await notice.evaluate((e) => getComputedStyle(e).direction)).toBe(l === 'ar' ? 'rtl' : 'ltr');
    });
  });
}
