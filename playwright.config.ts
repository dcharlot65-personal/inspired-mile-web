import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4399',
    headless: true,
  },
  webServer: {
    command: 'npm run dev -- --port 4399',
    port: 4399,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
