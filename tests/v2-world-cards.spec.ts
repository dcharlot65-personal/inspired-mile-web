import { test, expect } from '@playwright/test';

/**
 * Inspired Mile V2 — World Cards & Backend Integration tests.
 * Tests variant system, world map, auth UI, battle city bonuses,
 * and collection variant tab.
 */

// ---------------------------------------------------------------------------
// World Map Page
// ---------------------------------------------------------------------------

test.describe('World Map Page', () => {
  test('loads with correct heading and stats', async ({ page }) => {
    const response = await page.goto('/world-map');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('World');
    await expect(page.locator('#total-variants')).toBeVisible();
    await expect(page.locator('#total-cities')).toBeVisible();
  });

  test('renders 12 city cards in grid', async ({ page }) => {
    await page.goto('/world-map');
    const cityCards = page.locator('#world-grid > div[data-city]');
    await expect(cityCards).toHaveCount(12);
  });

  test('city cards show correct city names', async ({ page }) => {
    await page.goto('/world-map');
    const expectedCities = [
      'Tokyo', 'Lagos', 'Brooklyn', 'London', 'Mumbai', 'Paris',
      'Sao Paulo', 'Seoul', 'Nairobi', 'Berlin', 'Mexico City', 'Cairo',
    ];
    for (const city of expectedCities) {
      const card = page.locator(`#world-grid [data-city="${city}"]`);
      await expect(card).toBeVisible();
    }
  });

  test('clicking city card opens modal', async ({ page }) => {
    await page.goto('/world-map');
    const modal = page.locator('#city-modal');
    await expect(modal).toHaveClass(/hidden/);

    await page.click('#world-grid [data-city="Tokyo"]');
    await expect(modal).not.toHaveClass(/hidden/);
    await expect(page.locator('#modal-city-name')).toHaveText('Tokyo');
  });

  test('modal can be closed', async ({ page }) => {
    await page.goto('/world-map');
    await page.click('#world-grid [data-city="Lagos"]');
    const modal = page.locator('#city-modal');
    await expect(modal).not.toHaveClass(/hidden/);

    await page.click('#modal-close');
    await expect(modal).toHaveClass(/hidden/);
  });

  test('modal shows ability, attire, and hairstyle sections', async ({ page }) => {
    await page.goto('/world-map');
    await page.click('#world-grid [data-city="Brooklyn"]');

    await expect(page.locator('#modal-ability')).toBeVisible();
    await expect(page.locator('#modal-attire')).toBeVisible();
    await expect(page.locator('#modal-hair')).toBeVisible();
    await expect(page.locator('#modal-variants')).toBeVisible();
  });

  test('world map link in navigation', async ({ page }) => {
    await page.goto('/');
    const worldMapLink = page.locator('nav a[href="/world-map"]');
    expect(await worldMapLink.count()).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Collection — Variant Tab
// ---------------------------------------------------------------------------

test.describe('Collection Variant Section', () => {
  test('shows variant count', async ({ page }) => {
    await page.goto('/collection');
    await expect(page.locator('#variant-count')).toBeVisible();
  });

  test('variant count starts at 0 with no localStorage', async ({ page }) => {
    await page.goto('/collection');
    await page.evaluate(() => localStorage.removeItem('inspired-mile-variants'));
    await page.reload();
    await page.waitForTimeout(500);
    await expect(page.locator('#variant-count')).toHaveText('0');
  });

  test('variant list section exists', async ({ page }) => {
    await page.goto('/collection');
    await expect(page.locator('#variant-list')).toBeVisible();
  });

  test('shows empty state message when no variants', async ({ page }) => {
    await page.goto('/collection');
    await page.evaluate(() => localStorage.removeItem('inspired-mile-variants'));
    await page.reload();
    await page.waitForTimeout(500);
    const variantList = page.locator('#variant-list');
    await expect(variantList).toContainText('No variants yet');
  });

  test('variant count updates with localStorage data', async ({ page }) => {
    await page.goto('/collection');
    await page.evaluate(() => {
      localStorage.setItem('inspired-mile-variants', JSON.stringify([
        { variantId: 'MO-001-TKY-00-00-02', baseCardId: 'MO-001', acquiredAt: Date.now(), source: 'battle-streak' },
        { variantId: 'CA-001-LGS-00-00-02', baseCardId: 'CA-001', acquiredAt: Date.now(), source: 'trivia-mastery' },
      ]));
    });
    await page.reload();
    await page.waitForTimeout(500);
    await expect(page.locator('#variant-count')).toHaveText('2');
  });
});

// ---------------------------------------------------------------------------
// Battle — Variant Equip
// ---------------------------------------------------------------------------

test.describe('Battle Variant Equip', () => {
  test('variant equip panel hidden when no variants owned', async ({ page }) => {
    await page.goto('/battle');
    await page.evaluate(() => localStorage.removeItem('inspired-mile-variants'));
    await page.reload();
    await page.waitForTimeout(1000);
    const panel = page.locator('#variant-equip');
    await expect(panel).toHaveClass(/hidden/);
  });

  test('variant equip panel visible when variants exist', async ({ page }) => {
    await page.goto('/battle');
    await page.evaluate(() => {
      localStorage.setItem('inspired-mile-variants', JSON.stringify([
        { variantId: 'MO-001-TKY-00-00-02', baseCardId: 'MO-001', acquiredAt: Date.now(), source: 'battle-streak' },
      ]));
    });
    await page.reload();
    await page.waitForTimeout(1000);
    const panel = page.locator('#variant-equip');
    await expect(panel).not.toHaveClass(/hidden/);
  });

  test('equip button toggles variant picker', async ({ page }) => {
    await page.goto('/battle');
    await page.evaluate(() => {
      localStorage.setItem('inspired-mile-variants', JSON.stringify([
        { variantId: 'MO-001-TKY-00-00-02', baseCardId: 'MO-001', acquiredAt: Date.now(), source: 'battle-streak' },
      ]));
    });
    await page.reload();
    await page.waitForTimeout(1000);

    const picker = page.locator('#variant-picker');
    await expect(picker).toHaveClass(/hidden/);

    // Click via JS since the button may be behind the loading screen overlay
    await page.evaluate(() => {
      (document.getElementById('equip-variant-btn') as HTMLElement)?.click();
    });
    await page.waitForTimeout(300);
    await expect(picker).not.toHaveClass(/hidden/);
  });

  test('variant picker shows "No variant" option plus owned variants', async ({ page }) => {
    await page.goto('/battle');
    await page.evaluate(() => {
      localStorage.setItem('inspired-mile-variants', JSON.stringify([
        { variantId: 'MO-001-TKY-00-00-02', baseCardId: 'MO-001', acquiredAt: Date.now(), source: 'battle-streak' },
        { variantId: 'CA-001-LGS-00-00-02', baseCardId: 'CA-001', acquiredAt: Date.now(), source: 'trivia-mastery' },
      ]));
    });
    await page.reload();
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      (document.getElementById('equip-variant-btn') as HTMLElement)?.click();
    });
    await page.waitForTimeout(300);
    const picks = page.locator('#variant-picker .variant-pick');
    // 1 "no variant" + 2 owned = 3 total
    await expect(picks).toHaveCount(3);
  });

  test('selecting a variant updates equipped label', async ({ page }) => {
    await page.goto('/battle');
    await page.evaluate(() => {
      localStorage.setItem('inspired-mile-variants', JSON.stringify([
        { variantId: 'MO-001-TKY-00-00-02', baseCardId: 'MO-001', acquiredAt: Date.now(), source: 'battle-streak' },
      ]));
    });
    await page.reload();
    await page.waitForTimeout(1000);

    // Open picker via JS since button is behind loading screen
    await page.evaluate(() => {
      (document.getElementById('equip-variant-btn') as HTMLElement)?.click();
    });
    await page.waitForTimeout(300);

    // Click the variant via JS
    await page.evaluate(() => {
      const btn = document.querySelector('#variant-picker .variant-pick[data-variant-id="MO-001-TKY-00-00-02"]') as HTMLElement;
      btn?.click();
    });
    await page.waitForTimeout(300);

    const label = page.locator('#equipped-variant-label');
    await expect(label).toContainText('Tokyo');
  });
});

// ---------------------------------------------------------------------------
// Auth UI
// ---------------------------------------------------------------------------

test.describe('Auth UI', () => {
  test('auth dropdown exists in nav', async ({ page }) => {
    await page.goto('/');
    // The auth dropdown container should be in DOM
    const authArea = page.locator('#auth-login-form, #auth-user-menu, #auth-register-form');
    expect(await authArea.count()).toBeGreaterThan(0);
  });

  test('login form has username and password inputs', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#auth-username')).toHaveCount(1);
    await expect(page.locator('#auth-password')).toHaveCount(1);
  });

  test('register form has username, email, and password inputs', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#reg-username')).toHaveCount(1);
    await expect(page.locator('#reg-email')).toHaveCount(1);
    await expect(page.locator('#reg-password')).toHaveCount(1);
  });

  test('can switch between login and register forms', async ({ page }) => {
    await page.goto('/');
    // Wait for auth init to complete and show the auth button
    await page.waitForTimeout(1000);

    // Open auth dropdown
    await page.click('#auth-btn');
    await page.waitForTimeout(300);

    // Should show login form by default
    const loginForm = page.locator('#auth-login-form');
    const registerForm = page.locator('#auth-register-form');

    await expect(loginForm).not.toHaveClass(/hidden/);
    await expect(registerForm).toHaveClass(/hidden/);

    // Switch to register
    await page.click('#auth-show-register');
    await expect(loginForm).toHaveClass(/hidden/);
    await expect(registerForm).not.toHaveClass(/hidden/);

    // Switch back to login
    await page.click('#auth-show-login');
    await expect(loginForm).not.toHaveClass(/hidden/);
    await expect(registerForm).toHaveClass(/hidden/);
  });
});

// ---------------------------------------------------------------------------
// V2 Navigation
// ---------------------------------------------------------------------------

test.describe('V2 Navigation', () => {
  test('all 7 pages load without errors', async ({ page }) => {
    const pages = ['/', '/collection', '/playground', '/battle', '/world-map', '/about', '/privacy'];
    for (const path of pages) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('nav')).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();
    }
  });

  test('world map link appears in desktop nav', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1280, height: 720 });
    const link = page.locator('nav a[href="/world-map"]:visible');
    expect(await link.count()).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Variant localStorage Persistence
// ---------------------------------------------------------------------------

test.describe('Variant Persistence', () => {
  test('variants survive page reload', async ({ page }) => {
    await page.goto('/collection');
    await page.evaluate(() => {
      localStorage.setItem('inspired-mile-variants', JSON.stringify([
        { variantId: 'SM-001-BKN-00-00-02', baseCardId: 'SM-001', acquiredAt: Date.now(), source: 'city-quest' },
      ]));
    });
    await page.reload();
    await page.waitForTimeout(500);
    await expect(page.locator('#variant-count')).toHaveText('1');
  });

  test('clearing localStorage resets variant count', async ({ page }) => {
    await page.goto('/collection');
    await page.evaluate(() => {
      localStorage.setItem('inspired-mile-variants', JSON.stringify([
        { variantId: 'SM-001-BKN-00-00-02', baseCardId: 'SM-001', acquiredAt: Date.now(), source: 'city-quest' },
      ]));
    });
    await page.reload();
    await page.waitForTimeout(500);
    await expect(page.locator('#variant-count')).toHaveText('1');

    await page.evaluate(() => localStorage.removeItem('inspired-mile-variants'));
    await page.reload();
    await page.waitForTimeout(500);
    await expect(page.locator('#variant-count')).toHaveText('0');
  });
});
