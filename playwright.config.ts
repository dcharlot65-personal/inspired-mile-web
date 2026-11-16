import { defineConfig } from '@playwright/test';
import { E2E } from './tests/e2e-env';

// PROD_URL=https://… runs the suite against a deployed site instead of a local dev server.
const prodUrl = process.env.PROD_URL;

// Local runs use the real API on a throwaway Postgres (tests/start-backend.sh starts both).
// Two copies of the API share that database: one with DEV_EMAIL_LOG (sign-in codes go to
// its log, where tests/auth.spec.ts reads them), one with email sign-in off.
//
// Neither server is ever reused. A server already on the port may be another checkout's
// (the build host is shared), and tests that pass against someone else's code prove
// nothing. If a port is taken the run stops; move it with E2E_WEB_PORT, E2E_API_PORT,
// E2E_API_NOEMAIL_PORT or E2E_PG_PORT (tests/e2e-env.ts).

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: prodUrl ?? E2E.webOrigin,
    headless: true,
    // The age gate covers every page until a date of birth is given; tests start past it.
    storageState: prodUrl ? undefined : {
      cookies: [],
      origins: [{
        origin: E2E.webOrigin,
        localStorage: [{ name: 'inspired-mile-age-verified', value: 'adult' }],
      }],
    },
  },
  testMatch: prodUrl ? /prod-smoke\.spec\.ts/ : /^(?!.*prod-smoke).*\.spec\.ts$/,
  webServer: prodUrl ? undefined : [
    {
      // Ready when the second API answers; it starts last.
      command: 'bash tests/start-backend.sh',
      url: `http://127.0.0.1:${E2E.apiNoEmailPort}/api/v1/health`,
      reuseExistingServer: false,
      // A cold `cargo build --release` is slow; a warm one takes seconds.
      timeout: 900000,
      // SIGTERM, so the script can stop Postgres instead of leaving it running.
      gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 },
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        E2E_WEB_ORIGIN: E2E.webOrigin,
        E2E_API_PORT: String(E2E.apiPort),
        E2E_API_NOEMAIL_PORT: String(E2E.apiNoEmailPort),
        E2E_PG_PORT: String(E2E.pgPort),
        E2E_WORK_DIR: E2E.workDir,
      },
    },
    {
      // If the dev server stops while tests are still running (on the shared host,
      // something outside this run has stopped it more than once), say so with its exit
      // status: the tests that follow fail with "connection refused", which is not a
      // verdict on the code. 143 = SIGTERM, 137 = SIGKILL.
      command: `bash -c 'npm run dev -- --port ${E2E.webPort}; echo "[dev-server] EXITED with status $? while the tests were running" >&2'`,
      port: E2E.webPort,
      reuseExistingServer: false,
      timeout: 60000,
      stderr: 'pipe',
      env: { API_PROXY_TARGET: `http://127.0.0.1:${E2E.apiPort}` },
    },
  ],
});
