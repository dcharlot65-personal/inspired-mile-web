// Ports and paths shared by playwright.config.ts, tests/start-backend.sh (through the
// environment) and the tests that talk to the API or read its log.
//
// Every port can be moved with an environment variable. Two checkouts testing on one
// machine at the same time MUST use different ports: nothing here reuses a server that is
// already listening, because that server may belong to another checkout's code.

function port(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error(`${name} must be a port number between 1024 and 65535 (it is "${raw}")`);
  }
  return value;
}

const webPort = port('E2E_WEB_PORT', 4399);

export const E2E = {
  /** The Astro dev server the browser tests load. */
  webPort,
  /** The page origin: also the WebAuthn origin and the CORS origin the API is started with. */
  webOrigin: `http://localhost:${webPort}`,
  /** The real API with DEV_EMAIL_LOG=1. The dev server proxies /api to it. */
  apiPort: port('E2E_API_PORT', 38490),
  /** The same API and database with email sign-in off (no Resend key, no DEV_EMAIL_LOG). */
  apiNoEmailPort: port('E2E_API_NOEMAIL_PORT', 38491),
  pgPort: port('E2E_PG_PORT', 54329),
  /** State and logs of a run, relative to the repository root. */
  workDir: '.e2e',
  dbUser: 'im_e2e',
  dbName: 'inspired_mile_e2e',
};
