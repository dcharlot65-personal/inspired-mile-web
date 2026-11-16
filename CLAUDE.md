# Inspired Mile — Sonnet Man

Shakespeare rap-battle card game. Live at **sonnetman.inspiredmile.com**.
Astro static site + Rust API (`backend/`, axum + sqlx + Postgres).

## Stack

- Astro 7, Tailwind 4 (`@tailwindcss/vite`; theme lives in `src/styles/global.css`), React 19
- In-browser AI through `@huggingface/transformers` on WebGPU; no server does inference.
  `src/lib/brain.ts` picks a tier by device capability: Gemma 4 E2B (3.1 GB), LFM3 1.7B
  (1.1 GB), LFM2.5 350M (judge only), or none (written opponent, rule judging).
- Speech: Whisper base on WebAssembly (`src/lib/ear.ts`); Kokoro for English voice.
  The browser's Web Speech recognition is NOT used: it sends audio to a server.
- Babylon.js 9 for the Theatre (`src/lib/xr/theatre.ts`, `/theatre`) and the VR gallery
- Backend: Rust 1.100.0 (pinned in `backend/rust-toolchain.toml`), axum 0.8, sqlx 0.9
- Tests: vitest (pure logic), Playwright (browser), `tests/model` (real models, WebGPU)

## The game

A three-round duel of verses. Rules live in `src/lib/verse/` and are pure and seeded:
`forms.ts` (what a verse must do, checked by code), `devices.ts` (what cards do),
`duel.ts` (scoring: craft + judge), `judge.ts` (how a model's preference is read),
`opponent.ts`, `session.ts` (order of play, shared by every front end).
Read the header comment of `judge.ts` before changing judging: asked "A or B?" outright,
small models answer by position. `scripts/judge-eval.mjs` measures a model's judging.

## Build and test — on the build host, never on the dev Mac

```bash
RB='export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH;'
~/kani-logs/remote/rb . -- "$RB npm ci && npx vitest run && npm run build && npx playwright test"
~/kani-logs/remote/rb . -- "$RB cd backend && cargo test --release && cargo build --release"
# real models in a WebGPU browser (the build host's headless Chromium has Metal); downloads up to 3 GB
~/kani-logs/remote/rb . -- "$RB TIERS=lite,standard,grand npx playwright test -c playwright.model.config.ts"
# after a deploy:
~/kani-logs/remote/rb . -- "$RB PROD_URL=https://sonnetman.inspiredmile.com npx playwright test"
```

Do not start a second `rb` in this checkout while one is running: both use the same remote
folder, and a stale `astro dev` left on port 4399 makes every browser test fail with
connection refused (`pkill -f 'astro dev'` on the host).

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
- `git add -A` here will pick up agent worktrees under `.claude/`; that folder is ignored.
- Babylon's default WebXR set-up downloads hand and controller models from its own
  servers; `theatre.ts` turns that off, and a test asserts no foreign request in a session.
- To test WebXR under emulation, delete `Navigator.prototype.xr` before installing `iwer`.

## Owner direction (2026-11-16)

Passwordless sign-in (passkeys + Resend email) replacing Google OAuth; in-browser models
only, no cloud provider (Liquid AI / Gemma 4 class), which also means the multiplayer judge
must stop calling a cloud API; all languages represented; backend stays Rust.

## Git

- Remote: `git@github-personal:dcharlot65-personal/inspired-mile-web.git`, branch `main`
