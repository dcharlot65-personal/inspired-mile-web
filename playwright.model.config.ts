import { defineConfig } from '@playwright/test';

/**
 * Tests that load real models. They need a browser with WebGPU (the build host's
 * headless Chromium has Metal) and download up to 3 GB, so they are not part of
 * the default suite:  npx playwright test -c playwright.model.config.ts
 */
export default defineConfig({
  testDir: './tests/model',
  timeout: 15 * 60 * 1000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4399',
    headless: true,
    storageState: './tests/age-verified.json',
    launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal'] },
  },
  webServer: { command: 'npm run dev -- --port 4399', port: 4399, reuseExistingServer: true, timeout: 60000 },
});
