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

`.env` (git-ignored) holds `PUBLIC_GOOGLE_CLIENT_ID`; rb does not copy ignored files, so
export it in the build command.

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
  (`tests/age-verified.json`).
- No GitHub Actions (account-wide owner rule). CI is the build host.

## Owner direction (2026-11-16)

Passwordless sign-in (passkeys + Resend email) replacing Google OAuth; in-browser models
only, no cloud provider (Liquid AI / Gemma 4 class), which also means the multiplayer judge
must stop calling a cloud API; all languages represented; backend stays Rust.

## Git

- Remote: `git@github-personal:dcharlot65-personal/inspired-mile-web.git`, branch `main`
