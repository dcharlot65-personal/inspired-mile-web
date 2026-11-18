import { defineConfig } from '@playwright/test';

/**
 * Measurements against a built site that is already being served (BYTES_URL): no Postgres, no
 * API, no dev server. `npm run build && npx astro preview --port <port>`, then
 *   BYTES_URL=http://localhost:<port> npx playwright test -c playwright.cost.config.ts
 */
export default defineConfig({
  testDir: './tests',
  testMatch: /battle-ja-cost\.spec\.ts/,
  timeout: 10 * 60 * 1000,
  workers: 1,
  use: { headless: true },
});
