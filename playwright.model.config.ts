import { defineConfig } from '@playwright/test';

/**
 * Tests that load real models. They need a browser with WebGPU (the build host's
 * headless Chromium has Metal) and download up to 3 GB, so they are not part of
 * the default suite:  npx playwright test -c playwright.model.config.ts
 */
// PROD_URL=https://… plays against the deployed site instead of a local dev server.
const prodUrl = process.env.PROD_URL;

export default defineConfig({
  testDir: './tests/model',
  timeout: 15 * 60 * 1000,
  workers: 1,
  use: {
    baseURL: prodUrl ?? 'http://localhost:4399',
    headless: true,
    storageState: prodUrl ? undefined : './tests/age-verified.json',
    launchOptions: {
      args: [
        '--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal',
        // The ear test speaks through a recorded file standing in for the microphone.
        '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
        ...(process.env.FAKE_MIC_WAV ? [`--use-file-for-fake-audio-capture=${process.env.FAKE_MIC_WAV}`] : []),
      ],
    },
  },
  webServer: prodUrl ? undefined : { command: 'npm run dev -- --port 4399', port: 4399, reuseExistingServer: true, timeout: 60000 },
});
