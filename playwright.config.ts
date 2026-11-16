import { defineConfig } from '@playwright/test';

// PROD_URL=https://… runs the suite against a deployed site instead of a local dev server.
const prodUrl = process.env.PROD_URL;

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: prodUrl ?? 'http://localhost:4399',
    headless: true,
    // The age gate covers every page until a date of birth is given; tests start past it.
    storageState: prodUrl ? undefined : './tests/age-verified.json',
  },
  // tests/model needs WebGPU and multi-gigabyte downloads; it has its own config.
  testIgnore: /tests\/model\//,
  testMatch: prodUrl ? /prod-smoke\.spec\.ts/ : /^(?!.*prod-smoke).*\.spec\.ts$/,
  webServer: prodUrl ? undefined : {
    command: 'npm run dev -- --port 4399',
    port: 4399,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
