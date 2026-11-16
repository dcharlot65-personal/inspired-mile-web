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
  `{placeholder}`. Translated so far: the layout (navigation, footer, age gate, sign-in), the
  battle page and the theatre.
- **The duel's language** is a separate choice. The engine (`src/lib/verse`) returns message
  keys, never sentences; `english.ts` renders them for the model's prompt, which is always
  English. Per-language data (acrostic words, forbidden letters, power words, the written
  opponent's verses) is in `src/lib/verse/packs/`, loaded with `loadPack(lang)` before
  `createDuel`. Rhyme and syllable rules per language: `rhyme.ts`, `text.ts`; thresholds:
  `lang.ts`. Rhyming forms are not offered in zh, ja, th.
- **Card names, quotations, scenes and house/element labels per language**: `src/lib/cards-i18n/`
  (`cards.ts` stays the English source of truth). The fifteen language modules are GENERATED by
  `scripts/language/build_card_text.py` from recorded sources: names from Wikidata labels,
  lines from public-domain translations on Wikisource where one was found, stop words from
  stopwords-iso; what was translated for the game is in `scripts/language/translated/<lang>.txt`
  and is marked as such. Never hand-edit a generated module. The record, with everything that is
  unsourced, unreviewed or missing, is `docs/language/NAMES-AND-QUOTATIONS.md`.
  `loadPack(lang)` loads a language's card text, so the signature and the invocation work in the
  duel's language (`src/lib/verse/echo.ts`); an English duel never goes through that file.
  Published lines keep the edition's spelling; a Japanese line in old kanji also carries its
  modern reading (`echo`, OpenCC's JPVariants table) for the signature. The tool checks of the
  translated text (Hunspell, LanguageTool, MADLAD back-translation) are
  `scripts/language/check/run.sh` on the build host; their tools live in
  `im-lang/names-quotes` there. When www.gutenberg.org is down, its files are on the mirror
  gutenberg.pglaf.org (catalogue: GUTINDEX.ALL there).
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

## Requests to other origins (the privacy policy depends on this)

The policy (`src/pages/privacy.astro`, "Other Companies Involved") tells visitors exactly
which other companies their browser talks to. `tests/third-party.spec.ts` loads every page in
every age-gate state and fails on a request that `tests/third-party-allowlist.ts` does not
list. Add a third-party request only by adding it to that file **and** to the policy.

- A page may fetch from another origin only: the Plausible script (after the age gate is
  passed, never before and never for a blocked visitor: `window.__loadAnalytics` in
  `BaseLayout.astro`), and model weights from the Hugging Face hub when a model is asked for.
- Libraries default to public CDNs; each default is overridden, and the files are shipped
  from this site by `scripts/self-hosted-runtime.mjs` (an Astro integration: served by a
  middleware in dev, copied to `dist/ort/` and `dist/vendor/` in a build, about 90 MB):
  - Transformers.js takes onnxruntime-web's `.wasm`/`.mjs` from cdn.jsdelivr.net. Import it
    only through `loadTransformers()` (`src/lib/model-runtime.ts`), never directly.
  - kokoro-js carries its own Transformers.js 3; `thespian-voice.ts` sets `env.wasmPaths`.
  - model-viewer takes Draco/KTX2 decoders from www.gstatic.com. Load it only through
    `loadModelViewer()` (`src/lib/ar-viewer.ts`), never with a script tag.
  - Babylon WebXR: both `theatre.ts` and `vr-engine.ts` turn off hand tracking, near
    interaction and online controller models (they come from Babylon's servers).
- An upgrade of any of these libraries can move the files: the integration then stops the
  build, and the tests show what the browser asks for.
- `tests/warm-up.ts` (Playwright `globalSetup`) opens every page once before the tests
  start, so the dev server's cold compile is not inside any test's 30 seconds. Without it
  the first tests of a run sat at 15 to 26 seconds on main, and timed out with one more spec.
- The two "model runtime" tests download Whisper and Kokoro (about 80 MB each) from the hub;
  `E2E_NO_DOWNLOADS=1` skips them. `playwright.model.config.ts` takes its port from
  `E2E_WEB_PORT` like the main config.

## Owner direction (2026-11-16)

Passwordless sign-in (passkeys + Resend email) replacing Google OAuth; in-browser models
only, no cloud provider (Liquid AI / Gemma 4 class), which also means the multiplayer judge
must stop calling a cloud API; all languages represented; backend stays Rust.

## Git

- Remote: `git@github-personal:dcharlot65-personal/inspired-mile-web.git`, branch `main`
