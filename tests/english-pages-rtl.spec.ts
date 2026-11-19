import { test, expect } from '@playwright/test';

/**
 * Pages whose own text is English in every interface language: the online duel (English only, by decision; no
 * language branch translates its page), the privacy policy and the terms. In a right-to-left interface their
 * English was laid out right to left, so a sentence's full stop or colon stood at its start (".that data",
 * ":The short version": the 2026-11-18 screenshots in Arabic). The page body is marked as English, left to
 * right; the header and footer stay in the interface language. The credits page (2026-11-19) is English too.
 */
const PAGES: Array<[string, string]> = [['/multiplayer', '#mp-english-only'], ['/privacy', 'h1'], ['/terms', 'h1'], ['/credits', 'h1']];

for (const [path, probe] of PAGES) {
  test(`in Arabic, ${path} reads its English left to right inside the right-to-left layout`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('inspired-mile-locale', 'ar'));
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const el = page.locator(probe).first();
    await expect(el).toBeVisible();
    const body = await el.evaluate((e) => {
      const section = e.closest('section')!;
      const para = section.querySelector('p')!;
      return { lang: section.getAttribute('lang'), direction: getComputedStyle(para).direction };
    });
    expect(body).toEqual({ lang: 'en', direction: 'ltr' });
    // The interface around it is still Arabic, right to left.
    expect(await page.locator('footer').evaluate((f) => getComputedStyle(f).direction)).toBe('rtl');
  });
}
