import { defineConfig } from '@playwright/test';
import { E2E } from './tests/e2e-env';

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
    baseURL: prodUrl ?? E2E.webOrigin,
    headless: true,
    storageState: prodUrl ? undefined : { cookies: [], origins: [{ origin: E2E.webOrigin, localStorage: [{ name: 'inspired-mile-age-verified', value: 'adult' }] }] },
    launchOptions: {
      args: [
        '--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal',
        // The ear test speaks through a recorded file standing in for the microphone.
        '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
        ...(process.env.FAKE_MIC_WAV ? [`--use-file-for-fake-audio-capture=${process.env.FAKE_MIC_WAV}`] : []),
      ],
    },
  },
  // Never reuse a server already on the port: on the shared build host it may be another
  // checkout's code. Move the port with E2E_WEB_PORT (tests/e2e-env.ts).
  webServer: prodUrl ? undefined : { command: `npm run dev -- --port ${E2E.webPort}`, port: E2E.webPort, reuseExistingServer: false, timeout: 60000 },
});
