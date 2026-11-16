# Inspired Mile — Sonnet Man

Shakespeare rap-battle card game. Live at **sonnetman.inspiredmile.com**.
Astro static site + Rust API (`backend/`, axum + sqlx + Postgres).

## Stack

- Astro 7, Tailwind 4 (`@tailwindcss/vite`; theme lives in `src/styles/global.css`), React 19
- Babylon.js 9 (3D/VR), Google Model Viewer
- In-browser AI: `@mlc-ai/web-llm`, `kokoro-js` (being replaced; see owner direction below)
- Backend: Rust 1.100.0 (pinned in `backend/rust-toolchain.toml`), axum 0.8, sqlx 0.9
- Playwright for end-to-end tests

## Build and test — on the build host, never on the dev Mac

```bash
~/kani-logs/remote/rb . -- 'export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH; npm ci && npm run build && npx playwright test'
~/kani-logs/remote/rb . -- 'export PATH=$HOME/.cargo/bin:$PATH; cd backend && cargo test --release && cargo build --release'
# after a deploy:
~/kani-logs/remote/rb . -- 'PROD_URL=https://sonnetman.inspiredmile.com npx playwright test'
```

The frontend build needs no secrets or `PUBLIC_*` variables.

`npx playwright test` starts three things itself (`playwright.config.ts`): a throwaway
Postgres and two copies of the real API (`tests/start-backend.sh`; needs `initdb`, `pg_ctl`,
`createdb` and `cargo` on `PATH`, hence `/opt/homebrew/bin` and `~/.cargo/bin` above), and
the Astro dev server, which proxies `/api` to the API (`astro.config.mjs`). State and logs
go to `.e2e/` (git-ignored); the sign-in codes the tests read are in `.e2e/api.log`.

**The build host is shared, and no server is reused.** Default ports: 4399 (dev server),
38490 (API, `DEV_EMAIL_LOG=1`), 38491 (API with email off), 54329 (Postgres). If another
checkout is testing at the same time the run stops with "port already used"; give this run
its own with `E2E_WEB_PORT`, `E2E_API_PORT`, `E2E_API_NOEMAIL_PORT`, `E2E_PG_PORT`
(`tests/e2e-env.ts`). Before 2026-11-16 the config reused whatever answered on 4399, so two
concurrent runs could test each other's code and pass.

## Sign-in (passkeys + email code)

- No passwords, no Google. Passkeys (WebAuthn, discoverable, no username) are primary; a
  6-digit emailed code creates an account, signs in where there is no passkey, and recovers.
  Session is still the `im_token` JWT cookie. Code: `backend/src/auth/`, `src/lib/passwordless.ts`,
  the auth script in `BaseLayout.astro` (all its strings are in one `STRINGS` object).
- API env: `WEBAUTHN_RP_ID` (default `inspiredmile.com`; **never change it once passkeys
  exist, it orphans all of them**), `WEBAUTHN_ORIGIN` (default
  `https://sonnetman.inspiredmile.com`; comma-separated list; each must be https, or http on
  localhost, and on the RP ID), `RESEND_API_KEY` (absent: email endpoints answer 503 and
  the UI hides email), `EMAIL_FROM`, `RATE_LIMIT_PER_MINUTE` (global limiter, default 60).
- `DEV_EMAIL_LOG=1` writes codes to stderr instead of sending. Tests only. A real key wins
  over it, with a loud start-up warning.
- Local dev: `WEBAUTHN_RP_ID=localhost WEBAUTHN_ORIGIN=http://localhost:4321`.
- The email step requires the age gate's stored tier (`adult` or `teen-consented`), in the
  browser and again in the API. Do not loosen either.

## Where it runs (verified 2026-11-16)

- **Live origin for the domain is `10.10.10.1`**: Cloudflare's "publishing" tunnel terminates
  there, not on prod. Its Caddy serves `~/sites/inspired-mile-web` and forwards `/api/*`
  (including the multiplayer WebSocket) to prod at `100.64.224.0:3849`.
- **Static build is mirrored to both** `10.10.10.1` and prod (`100.64.224.0`), same path.
  Sync with `rsync --delete --exclude=.git/`.
- **API on prod**: `~/sites/inspired-mile-api/` (binary, `migrations/`, `.env`), launchd
  `com.inspiredmile.api`, logs `~/sites/logs/inspiredmile-api*.log`, Postgres 18 database
  `inspired_mile`. It lives outside the web root on purpose: `.env` must never be servable.
  `DATABASE_URL` needs an explicit user (sqlx 0.9 no longer infers it). Migrations are read
  from `./migrations` at start-up, so sync that folder with the binary.
- Replace the binary by writing a new file and renaming it, then
  `launchctl bootout` + `bootstrap` (not an in-place copy).

## Gotchas

- `@tailwindcss/upgrade` rewrites plain words in data files as classes ("a ring" became
  "a ring-3"). Diff `src/lib/*.ts` after running it.
- The stylesheet is imported once, in `BaseLayout.astro`. Do not import it per page.
- The age gate covers every page until a date of birth is stored; tests start past it
  (the `storageState` in `playwright.config.ts`).
- No GitHub Actions (account-wide owner rule). CI is the build host.

## Owner direction (2026-11-16)

Passwordless sign-in (passkeys + Resend email) replacing Google OAuth; in-browser models
only, no cloud provider (Liquid AI / Gemma 4 class), which also means the multiplayer judge
must stop calling a cloud API; all languages represented; backend stays Rust.

## Git

- Remote: `git@github-personal:dcharlot65-personal/inspired-mile-web.git`, branch `main`
