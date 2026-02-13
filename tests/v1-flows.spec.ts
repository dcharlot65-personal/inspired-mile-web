import { test, expect } from '@playwright/test';

/**
 * Inspired Mile V1 — End-to-end test suite.
 * Tests all core flows: pages, collection, playground, battle, achievements.
 */

test.describe('Page Navigation', () => {
  test('all 6 pages load without errors', async ({ page }) => {
    const pages = ['/', '/collection', '/playground', '/battle', '/about', '/privacy'];
    for (const path of pages) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('nav')).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();
    }
  });

  test('nav links are present', async ({ page }) => {
    await page.goto('/');
    // Desktop nav + mobile menu links + logo link
    const navLinks = page.locator('nav a');
    expect(await navLinks.count()).toBeGreaterThanOrEqual(5);
  });
});

test.describe('Collection Page', () => {
  test('renders all 24 cards', async ({ page }) => {
    await page.goto('/collection');
    const cards = page.locator('.card-item');
    await expect(cards).toHaveCount(24);
  });

  test('filter buttons work', async ({ page }) => {
    await page.goto('/collection');

    // Filter to Characters
    await page.click('[data-filter="Character"]');
    const visibleChars = page.locator('.card-item[data-type="Character"]:not([style*="display: none"])');
    const hiddenRelics = page.locator('.card-item[data-type="Relic"][style*="display: none"]');
    expect(await visibleChars.count()).toBeGreaterThan(0);
    expect(await hiddenRelics.count()).toBeGreaterThan(0);

    // Filter to All
    await page.click('[data-filter="all"]');
    const allCards = page.locator('.card-item:not([style*="display: none"])');
    await expect(allCards).toHaveCount(24);
  });

  test('achievements section is visible', async ({ page }) => {
    await page.goto('/collection');
    await expect(page.locator('#achievement-grid')).toBeVisible();
    await expect(page.locator('#achievement-total')).toHaveText('16');
  });

  test('locked cards have lock overlay', async ({ page }) => {
    // Fresh state — no cards owned, all should show lock
    await page.goto('/collection');
    const lockOverlays = page.locator('.lock-overlay:not(.hidden)');
    expect(await lockOverlays.count()).toBeGreaterThan(0);
  });
});

test.describe('Playground', () => {
  test('shows starter pack and daily pack buttons', async ({ page }) => {
    await page.goto('/playground');
    await expect(page.locator('#starter-pack-btn')).toBeVisible();
    await expect(page.locator('#daily-pack-btn')).toBeVisible();
  });

  test('shows trivia and challenge buttons', async ({ page }) => {
    await page.goto('/playground');
    await expect(page.locator('#trivia-start-btn')).toBeVisible();
    await expect(page.locator('#challenge-start-btn')).toBeVisible();
  });

  test('onboarding overlay shows on first visit', async ({ page }) => {
    await page.goto('/playground');
    // Clear onboarding flag
    await page.evaluate(() => localStorage.removeItem('inspired-mile-onboarding-done'));
    await page.reload();
    await page.waitForTimeout(1000);
    const overlay = page.locator('#onboarding-overlay:not(.hidden)');
    await expect(overlay).toBeVisible();
  });

  test('onboarding can be skipped', async ({ page }) => {
    await page.goto('/playground');
    await page.evaluate(() => localStorage.removeItem('inspired-mile-onboarding-done'));
    await page.reload();
    await page.waitForTimeout(1000);
    // Click skip via JS since tooltip may be positioned outside viewport in headless
    await page.evaluate(() => {
      (document.getElementById('onboarding-skip') as HTMLElement)?.click();
    });
    await page.waitForTimeout(300);
    const done = await page.evaluate(() => localStorage.getItem('inspired-mile-onboarding-done'));
    expect(done).toBe('1');
  });

  test('onboarding does not show if already completed', async ({ page }) => {
    await page.goto('/playground');
    await page.evaluate(() => localStorage.setItem('inspired-mile-onboarding-done', '1'));
    await page.reload();
    await page.waitForTimeout(1000);
    const overlay = page.locator('#onboarding-overlay');
    await expect(overlay).toHaveClass(/hidden/);
  });

  test('claiming starter pack opens reveal modal', async ({ page }) => {
    await page.goto('/playground');
    // Reset inventory for fresh state
    await page.evaluate(() => localStorage.removeItem('inspired-mile-inventory'));
    await page.evaluate(() => localStorage.setItem('inspired-mile-onboarding-done', '1'));
    await page.reload();
    await page.waitForTimeout(500);

    await page.click('#starter-pack-btn');
    await page.waitForTimeout(500);

    const reveal = page.locator('#reveal-modal:not(.hidden)');
    await expect(reveal).toBeVisible();
  });

  test('trivia modal opens on button click', async ({ page }) => {
    await page.goto('/playground');
    await page.evaluate(() => localStorage.setItem('inspired-mile-onboarding-done', '1'));
    await page.reload();
    await page.waitForTimeout(500);

    await page.click('#trivia-start-btn');
    const modal = page.locator('#trivia-modal:not(.hidden)');
    await expect(modal).toBeVisible();
  });

  test('challenge modal opens on button click', async ({ page }) => {
    await page.goto('/playground');
    await page.evaluate(() => localStorage.setItem('inspired-mile-onboarding-done', '1'));
    await page.reload();
    await page.waitForTimeout(500);

    await page.click('#challenge-start-btn');
    const modal = page.locator('#challenge-modal:not(.hidden)');
    await expect(modal).toBeVisible();
  });
});

test.describe('Battle Arena', () => {
  test('shows loading screen initially', async ({ page }) => {
    await page.goto('/battle');
    await expect(page.locator('#loading-screen')).toBeVisible();
  });

  test('shows battle stats section', async ({ page }) => {
    await page.goto('/battle');
    // Stats are below the loading screen — check they exist in DOM
    await expect(page.locator('#rounds-played')).toHaveCount(1);
    await expect(page.locator('#battles-total')).toHaveCount(1);
    await expect(page.locator('#win-rate')).toHaveCount(1);
  });

  test('enters demo mode when WebGPU unavailable', async ({ page }) => {
    await page.goto('/battle', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const noWebgpu = page.locator('#no-webgpu');
    if (await noWebgpu.isVisible()) {
      await page.click('#fallback-mode-btn');
      await page.waitForTimeout(500);

      // Mode select should be visible in the arena
      const modeSelect = page.locator('#mode-select');
      await expect(modeSelect).toBeVisible();
    }
  });

  test('can start freestyle mode in demo', async ({ page }) => {
    await page.goto('/battle', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    if (await page.locator('#no-webgpu').isVisible()) {
      await page.click('#fallback-mode-btn');
      await page.waitForTimeout(500);
    }

    await page.click('#battle-arena');
    await page.waitForTimeout(300);
    await page.click('[data-mode="freestyle"]');
    await page.waitForTimeout(2000);

    // Battle log should have messages
    const messages = page.locator('#battle-log > div');
    expect(await messages.count()).toBeGreaterThan(0);
  });

  test('persistent stats load from localStorage', async ({ page }) => {
    // Set some stats
    await page.goto('/battle');
    await page.evaluate(() => {
      localStorage.setItem('inspired-mile-player-stats', JSON.stringify({
        battleWins: 5, totalBattles: 10, totalRounds: 20,
        highestScore: 38, triviaCorrect: 15, triviaPerfect: 2,
        challengesCompleted: 7, uniqueCards: 12, totalCards: 18, packsOpened: 6,
      }));
    });
    await page.reload();
    await page.waitForTimeout(500);

    await expect(page.locator('#rounds-played')).toHaveText('20');
    await expect(page.locator('#battles-total')).toHaveText('10');
    await expect(page.locator('#win-rate')).toHaveText('25%');
  });
});

test.describe('Meta Tags', () => {
  test('og:image meta tag present', async ({ page }) => {
    await page.goto('/');
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute('content', '/images/og-image.png');
  });

  test('preconnect to Google Fonts', async ({ page }) => {
    await page.goto('/');
    const preconnect = page.locator('link[rel="preconnect"][href="https://fonts.googleapis.com"]');
    expect(await preconnect.count()).toBe(1);
  });
});
