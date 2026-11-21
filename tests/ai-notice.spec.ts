import { test, expect, type Page } from '@playwright/test';
import { MODELS } from '../src/lib/brain';
import { aiNotice } from '../src/lib/ai-notice';
import { releaseHeld, setLists, standInModel, stubCount } from './stand-in-model';

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

/**
 * Holds the model library back until `release()`, so the page is still loading the model while the
 * notice is read, and records every text the notice shows while it can be seen, from the first one on.
 * Call after standInModel (a later route is asked first, and falls back to the stand-in).
 */
async function holdModelAndWatch(page: Page) {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(/huggingface[_/]transformers/, async (route) => {
    await held;
    await route.fallback();
  });
  const seen: string[] = [];
  await page.exposeFunction('__noticeSeen', (text: string) => seen.push(text));
  await page.addInitScript(() => {
    const look = () => {
      const n = document.getElementById('ai-notice');
      if (n && n.checkVisibility({ visibilityProperty: true, opacityProperty: true })) (window as any).__noticeSeen(n.textContent);
    };
    new MutationObserver(look).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    document.addEventListener('DOMContentLoaded', look);
  });
  return { release, seen };
}

/** A device that is offered both Gemma and LFM3 (brain.ts canOfferGrand): WebGPU with 16-bit floats, 16 GB. */
async function bigDevice(page: Page, opts: Parameters<typeof standInModel>[1] = {}) {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'deviceMemory', { configurable: true, get: () => 16 }));
  await standInModel(page, opts);
}

/**
 * Gemma fails to load and LFM3, tried next (brain.ts loadOrder), is held mid-load. A Vietnamese duel, where the two
 * notices differ by the measured lists (Gemma writes Vietnamese verse; LFM3 judges it): the notice that names the
 * model being loaded must be LFM3's. Returns the strings expected for each.
 */
const FALLBACK_LANG = 'vi';
function fallbackNotices(s: Record<string, string>) {
  const [failed, next] = [aiNotice(MODELS.grand, FALLBACK_LANG), aiNotice(MODELS.standard, FALLBACK_LANG)];
  const text = (n: typeof failed) => say(s[n.key], n.vars.model);
  return { failed: text(failed), next: text(next), nextNotice: next };
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

    test('battle, a remembered model: while it loads, the notice already names it, and never says that no model plays', async ({ page }) => {
      const s = await strings(l);
      const m = MODELS.grand;
      await inLocale(page, l);
      // The visitor chose Gemma before; this device can run it, so the page loads it without asking.
      await page.addInitScript(() => localStorage.setItem('inspired-mile-brain', 'grand'));
      await bigDevice(page);
      const { release, seen } = await holdModelAndWatch(page);
      // An English duel, which the model writes and judges, whatever the interface language.
      await page.goto('/battle?seed=11&lang=en');
      await expect(page.locator('html')).toHaveAttribute('lang', l);
      const notice = page.locator('#duel-setup #ai-notice');
      await expect(page.locator('#loading-screen')).toBeVisible();
      await expect(notice).toBeVisible();
      await expect(notice).toHaveText(say(s['notice.aiBoth'], m.label));
      await expect(notice).toHaveAttribute('data-opponent', 'model');
      await expect(notice).toHaveAttribute('data-judge', 'model');
      expect((await stubCount(page)).loads, 'the model is still loading').toEqual([]);
      await expect(page.locator('#start-duel')).toBeDisabled();
      release();
      await expect(page.locator('#start-duel')).toBeEnabled({ timeout: 30_000 });
      await expect(notice).toHaveText(say(s['notice.aiBoth'], m.label));
      expect(seen.length, 'the notice was seen').toBeGreaterThan(0);
      expect(seen.filter((t) => t !== say(s['notice.aiBoth'], m.label)), 'the notice never said anything else').toEqual([]);
      await expect(page.locator('#battle-arena')).toBeHidden();
    });

    test('battle, a model offered: nothing is said before the player chooses; once they summon it, the notice names it while it loads', async ({ page }) => {
      const s = await strings(l);
      const m = MODELS.grand;
      await inLocale(page, l);
      await bigDevice(page);
      const { release, seen } = await holdModelAndWatch(page);
      await page.goto('/battle?seed=11&lang=en');
      await expect(page.locator('html')).toHaveAttribute('lang', l);
      const notice = page.locator('#duel-setup #ai-notice');
      // The choice is on screen, and no duel can start before it is made.
      await expect(page.locator('#brain-model-btn')).toBeVisible();
      await expect(page.locator('#brain-model-btn')).toContainText(m.label);
      await expect(page.locator('#start-duel')).toBeDisabled();
      await expect(notice).toBeHidden();
      await page.locator('#brain-model-btn').click();
      await expect(page.locator('#loading-screen')).toBeVisible();
      await expect(notice).toBeVisible();
      await expect(notice).toHaveText(say(s['notice.aiBoth'], m.label));
      await expect(notice).toHaveAttribute('data-opponent', 'model');
      // While it loads, the notice follows the duel's language too: a language Gemma writes and does not judge, read
      // from its lists (German until fix/judge-wording's cells made Gemma a judge of it; Spanish since).
      const writesOnly = m.writesIn.find((x) => !m.judgesIn.includes(x));
      expect(writesOnly, 'a language Gemma writes and does not judge').toBeDefined();
      await page.selectOption('#language', writesOnly!);
      await expect(notice).toHaveText(say(s['notice.aiWrites'], m.label));
      await expect(notice).toHaveAttribute('data-judge', 'rules');
      await page.selectOption('#language', 'en');
      await expect(notice).toHaveText(say(s['notice.aiBoth'], m.label));
      expect((await stubCount(page)).loads, 'the model is still loading').toEqual([]);
      release();
      await expect(page.locator('#start-duel')).toBeEnabled({ timeout: 30_000 });
      await expect(notice).toHaveText(say(s['notice.aiBoth'], m.label));
      expect(seen.filter((t) => t === s['notice.none']), 'the notice never said no model plays').toEqual([]);
      expect(seen.length, 'the notice was seen').toBeGreaterThan(0);
    });

    test('battle, a remembered model that fails to load: while the smaller one loads, the notice names that one, not the one that failed', async ({ page }) => {
      const s = await strings(l);
      const want = fallbackNotices(s);
      // The two must differ, or this test could not tell them apart.
      expect(want.next).not.toBe(want.failed);
      await inLocale(page, l);
      await page.addInitScript(() => localStorage.setItem('inspired-mile-brain', 'grand'));
      await bigDevice(page, { failing: [MODELS.grand.id], holding: [MODELS.standard.id] });
      await page.goto(`/battle?seed=11&lang=${FALLBACK_LANG}`);
      await expect(page.locator('html')).toHaveAttribute('lang', l);
      const notice = page.locator('#duel-setup #ai-notice');
      // Gemma was asked for and failed; LFM3 is loading now.
      await expect.poll(async () => (await stubCount(page)).loads, { timeout: 30_000 }).toEqual([MODELS.grand.id, MODELS.standard.id]);
      await expect(page.locator('#loading-screen')).toBeVisible();
      await expect(page.locator('#start-duel')).toBeDisabled();
      await expect(notice).toBeVisible();
      await expect(notice).toHaveText(want.next);
      await expect(notice).toHaveAttribute('data-opponent', want.nextNotice.opponent);
      await expect(notice).toHaveAttribute('data-judge', want.nextNotice.judge);
      await releaseHeld(page);
      await expect(page.locator('#start-duel')).toBeEnabled({ timeout: 30_000 });
      // Loaded, it says the same: it named the model that is now running.
      await expect(notice).toHaveText(want.next);
      await expect(page.locator('#brain-status')).toContainText(MODELS.standard.label);
      await expect(page.locator('#battle-arena')).toBeHidden();
    });

    test('theatre, a remembered model that fails to load: while the smaller one loads, the notice names that one, not the one that failed', async ({ page }) => {
      const s = await strings(l);
      const want = fallbackNotices(s);
      expect(want.next).not.toBe(want.failed);
      await inLocale(page, l);
      await page.addInitScript((lang) => {
        localStorage.setItem('inspired-mile-brain', 'grand');
        localStorage.setItem('inspired-mile-duel-lang', lang);
      }, FALLBACK_LANG);
      await bigDevice(page, { failing: [MODELS.grand.id], holding: [MODELS.standard.id] });
      await page.goto('/theatre?seed=11');
      const notice = page.locator('#ai-notice');
      await expect.poll(async () => (await stubCount(page)).loads, { timeout: 30_000 }).toEqual([MODELS.grand.id, MODELS.standard.id]);
      await expect(notice).toBeVisible();
      await expect(notice).toHaveText(want.next);
      await expect(notice).toHaveAttribute('data-judge', want.nextNotice.judge);
      await releaseHeld(page);
      await expect(page.locator('#theatre-status')).toContainText(MODELS.standard.label, { timeout: 30_000 });
      await expect(notice).toHaveText(want.next);
    });

    test('battle, a model offered and declined: the notice says no artificial intelligence plays or judges', async ({ page }) => {
      const s = await strings(l);
      await inLocale(page, l);
      await bigDevice(page);
      await page.goto('/battle?seed=11&lang=en');
      const notice = page.locator('#duel-setup #ai-notice');
      await expect(page.locator('#brain-rules-btn')).toBeVisible();
      await expect(notice).toBeHidden();
      await page.locator('#brain-rules-btn').click();
      await expect(notice).toBeVisible();
      await expect(notice).toHaveText(s['notice.none']);
      await expect(notice).toHaveAttribute('data-opponent', 'written');
      await expect(page.locator('#start-duel')).toBeEnabled();
      expect((await stubCount(page)).loads, 'no model was loaded').toEqual([]);
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

    test('theatre, a remembered model: while it loads, the notice already names it, and never says that no model plays', async ({ page }) => {
      const s = await strings(l);
      const m = MODELS.grand;
      await inLocale(page, l);
      // The visitor chose Gemma on the battle page before; this device can run it.
      await page.addInitScript(() => {
        localStorage.setItem('inspired-mile-brain', 'grand');
        Object.defineProperty(Navigator.prototype, 'deviceMemory', { configurable: true, get: () => 16 });
      });
      await standInModel(page);
      // The model library is held back, so the page is still loading the model while the notice is read.
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      await page.route(/huggingface[_/]transformers/, async (route) => {
        await held;
        await route.fallback();
      });
      const seen: string[] = [];
      await page.exposeFunction('__noticeSeen', (text: string) => seen.push(text));
      await page.addInitScript(() => {
        // Every text the notice shows while visible, from the first one on.
        new MutationObserver(() => {
          const n = document.getElementById('ai-notice');
          if (n && !n.classList.contains('invisible')) (window as any).__noticeSeen(n.textContent);
        }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
      });
      await page.goto('/theatre?seed=11');
      const notice = page.locator('#ai-notice');
      // The duel's language is English, which the model writes and judges.
      await expect(notice).toBeVisible();
      await expect(notice).toHaveText(say(s['notice.aiBoth'], m.label));
      await expect(notice).toHaveAttribute('data-opponent', 'model');
      expect((await stubCount(page)).loads, 'the model is still loading').toEqual([]);
      release();
      await expect.poll(async () => (await stubCount(page)).loads.length, { timeout: 30_000 }).toBeGreaterThan(0);
      await expect(notice).toHaveText(say(s['notice.aiBoth'], m.label));
      expect(seen.filter((t) => t === s['notice.none']), 'the notice never said no model plays').toEqual([]);
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
