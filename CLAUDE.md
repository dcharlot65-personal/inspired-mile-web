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

The frontend build needs no secrets or `PUBLIC_*` variables.

Do not start a second `rb` in this checkout while one is running: both use the same remote
folder.

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

**Never `pkill -f 'astro dev'` on the host.** It stops every checkout's dev server, not
only a stale one of yours: a run in another checkout then fails with "connection refused"
on all its browser tests (its log says `[dev-server] EXITED with status 143`). A dev server
left behind by a killed run is found by its port: `lsof -nP -iTCP:<port> -sTCP:LISTEN`.

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

## Languages (16: en es fr de it pt pl ru ar hi zh ja ko vi th id)

- **Interface**: `src/i18n/` (`t()`, `setLocale()`, one lazily loaded module per language in
  `locales/`). Markup carries keys (`data-i18n`, `data-i18n-placeholder`, …); scripts call
  `t()` and redraw on `onLocaleChange`. A new string goes into `locales/en.ts` and all fifteen
  others: `src/i18n/i18n.test.ts` fails on a missing key, an empty value or a different
  `{placeholder}`. Translated so far in the core files: the layout (navigation, footer, age gate, sign-in), the
  battle page and the theatre. Card names and Shakespeare's lines stay English.
- **Pages beyond the duel** keep their strings out of the core locale files, in page areas:
  `src/i18n/pages/<area>/<lang>.ts`, loaded when a page asks (`loadArea`, or `initPage` in
  `src/i18n/pages/runtime.ts`, which also redraws on a language change). Static markup uses
  `<T k="area.key" />` (`src/components/T.astro`) or `data-i18n-html`, NOT `data-i18n`: the core
  fills `data-i18n` before a language's areas have arrived. A message may carry `<b>` and `<a>`
  marks. Numbers, dates and lists come from `Intl` (`num`, `day`, `list`); names of places are
  CLDR's or Wikidata's, kept in the areas (Chromium's ICU has no names for sub-regions, so
  `Intl.DisplayNames` is not used for them); a count is written "label: number", never number + noun. Card, city and
  achievement data is named by `src/i18n/pages/terms.ts`, card rules by `rules-text.ts`.
  The layout takes `titleKey`, `descriptionKey` and `i18nAreas` for the document title and
  description. Translated so far: home, about, collection, profile, world map (areas `home`,
  `about`, `collection`, `profile`, `world-map`, `variants`, `card-terms`, `rules`,
  `achievements`). `src/i18n/pages.test.ts` and `tests/pages-i18n.spec.ts` check them; sources,
  what is not translated and what the tools found are in `docs/language/pages-core/`.
- **The duel's language** is a separate choice. The engine (`src/lib/verse`) returns message
  keys, never sentences; `english.ts` renders them for the model's prompt, which is always
  English. Per-language data (acrostic words, forbidden letters, power words, the written
  opponent's verses) is in `src/lib/verse/packs/`, loaded with `loadPack(lang)` before
  `createDuel`. Rhyme and syllable rules per language: `rhyme.ts`, `text.ts`; thresholds:
  `lang.ts`. Rhyming forms are not offered in zh, ja, th.
- Every verse in every pack must keep its form as the code checks it (`verse.test.ts`).
  `node scripts/mutate-packs.mjs` (on the build host) proves those tests go red.
- Writing a `\uXXXX` escape through an agent's file tools can turn it into the character
  itself; check with `grep` after writing one.

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
