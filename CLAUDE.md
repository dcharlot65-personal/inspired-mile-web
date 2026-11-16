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
  Code: `backend/src/auth/`, `src/lib/passwordless.ts`, the auth script in `BaseLayout.astro`
  (all its strings are in one `STRINGS` object).
- **Sessions live on the server** (`auth_sessions`, `backend/src/auth/sessions.rs`). The cookie
  holds a JWT whose `sid` names a row; a request is signed in only while that row is live.
  Sign-out revokes the row, `POST /auth/logout/all` revokes all of the account's. The cookie is
  `__Host-im_token` when every `WEBAUTHN_ORIGIN` is https (production) and `im_token` over
  http (localhost, tests: browsers refuse the prefix there); HttpOnly, Secure, SameSite=Strict.
- **Adding or removing a passkey, and adding an email, need a fresh proof** (a passkey
  assertion or an emailed code in the last 5 minutes), not just the cookie. The page gets
  403 `reauth_required`, runs `/auth/passkey/verify/{begin,finish}` and retries
  (`withFreshProof` in `passwordless.ts`).
- **`JWT_SECRET` is mandatory**: the API exits at start-up if it is absent, under 32 bytes,
  or the old development constant. `DEV_INSECURE_JWT_SECRET=1` lifts that on localhost only
  (refused with an https origin). Email codes use a key derived from it, not the secret itself.
- API env: `WEBAUTHN_RP_ID` (default `inspiredmile.com`; **never change it once passkeys
  exist, it orphans all of them**), `WEBAUTHN_ORIGIN` (default
  `https://sonnetman.inspiredmile.com`; comma-separated list; each must be https, or http on
  localhost, and on the RP ID), `RESEND_API_KEY` (absent: email endpoints answer 503 and
  the UI hides email), `EMAIL_FROM`, `RATE_LIMIT_PER_MINUTE` (per client, default 600),
  `TRUSTED_PROXIES` (peers whose `CF-Connecting-IP` / `X-Forwarded-For` are believed; default
  `127.0.0.1,::1,10.10.10.1,100.64.224.0,100.98.101.113`. The last is the Tailscale address of
  the M4 MacBook Pro (10.10.10.1): its Caddy reaches the API on prod at `100.64.224.0:3849` over
  the tailnet, so that is the peer production sees (checked 2026-11-16). From any other peer the
  socket address is the client. **Check this on every deploy**, in the API log: whatever
  `RUST_LOG` says (even `off`), the API writes at start-up `TRUSTED_PROXIES: ... believed only
  from <list>`, and, at most once every ten minutes per peer and ten lines a minute,
  `ignored CF-Connecting-IP / X-Forwarded-For from <peer>`. If that peer is the proxy, add it:
  otherwise every visitor shares one allowance. These are "operator notices"
  (`backend/src/notice.rs`): the log filter is `RUST_LOG` with a directive for that target
  added last; the log has no colour codes unless standard output is a terminal),
  `PROXY_SECRET` (optional, 32+ characters: when set, a trusted peer's forwarding headers are
  believed only on requests carrying it as `X-Proxy-Secret`, which every proxying Caddy must
  add with `header_up`; the proxy's host is a shared build host, so without it any program
  there can choose the address it is counted as),
  `SIGNUP_GLOBAL_PER_HOUR` (default 300; logs `SIGN-UP CEILING HIT`),
  `SIGNUP_BEGINS_GLOBAL_PER_HOUR` (default 1500 begun sign-ups an hour, site-wide; logs
  `SIGN-UP BEGIN CEILING HIT`), `AUTH_CHALLENGES_MAX` (default 50000 rows in `auth_challenges`;
  one network may hold 300 live; logs `SIGN-IN CHALLENGE CEILING HIT`),
  `UNUSED_ACCOUNT_PURGE_DAYS` (default 30, 0 = never: passkey-only accounts that never played
  are deleted, see `purge_unused_accounts` in `auth/passkeys.rs`).
- **A site-wide ceiling never refuses everyone** (`auth/passkeys.rs`, top). At one, only a
  network that has already had a small share is refused: 2 accounts or 10 begun sign-ups in the
  hour, or 10 live sign-in ceremonies; everyone else is served. Before 2026-11-16 (second
  review) a full challenge table refused every visitor, so one IPv6 /48 split into 200 /64s
  stopped all passkey sign-in in nine seconds. Do not bring back a ceiling that refuses all.
- Limits are per network, never per address, at three widths (`auth/client_ip.rs`, top): the
  request rate limit per IPv4 address or IPv6 /64; everything one party could turn on another
  or use to fill a table (email codes and guesses, sign-in ceremonies) per IPv4 address or
  IPv6 /48, because one home line holds 256 or 65,536 /64s; the sign-up budget (40 accounts an
  hour, counted when created) per IPv4 /24 or IPv6 /48.
- Email codes (`backend/src/auth/email_code.rs`, top comment, is the statement): an inbox (the
  address without its `+tag`, and for Gmail without dots) gets at most 10 codes an hour; one
  network (IPv4 address or IPv6 /48) may have at most 3 of them, so no network, and no three
  together, can stop another from getting a code; it takes four. Wrong guesses: 10 a day per
  network per address, 50 per address from everyone, 30 per network over all addresses (a miss
  is forgiven for that last count once the same network signs in with a code for the
  address). All checked under the inbox's and the network's advisory locks in the transaction
  that inserts, so parallel requests cannot pass them.
- `TEST_ONLY_LIMIT_RACE_DELAY_MS` pauses between each limit's check and its write, so the
  end-to-end tests can show a check made without its lock letting parallel requests through.
  The API refuses to start with it when any `WEBAUTHN_ORIGIN` is https. Never set it in a
  deployed `.env`.
- **Accounts that exist only by email cannot sign in while email is off** (no `RESEND_API_KEY`):
  an old Google or email account has no passkey and its only way in answers 503. Production
  had no users when this was accepted (2026-11-16); the sign-in panel says so. Check
  `SELECT COUNT(*) FROM users u WHERE NOT EXISTS (SELECT 1 FROM webauthn_credentials c WHERE c.user_id = u.id)`
  before relying on it.
- `DEV_EMAIL_LOG=1` writes codes to stderr instead of sending. Tests only. A real key wins
  over it, with a loud start-up warning.
- Local dev: `WEBAUTHN_RP_ID=localhost WEBAUTHN_ORIGIN=http://localhost:4321`.
- The email step requires the age gate's stored tier (`adult` or `teen-consented`), in the
  browser and again in the API. Do not loosen either. The tier is self-declared (nobody's
  age is verified). Rules in `backend/src/auth/age.rs`: set at account creation; afterwards
  only the signed-in user's own answer changes it (the age question opened by "Date of Birth"
  in the account menu, `POST /auth/age-tier`). The page never posts the browser's stored gate
  answer by itself (on a shared browser it may be someone else's), and `/credits/age-verify`,
  which pages cached before 2026-11-16 still call, never writes. Adult may become teen; teen
  becomes adult again only for an account declared adult, with a proof from the last five
  minutes; an account declared teen stays teen (the operator can change it in the database).

## Languages (16: en es fr de it pt pl ru ar hi zh ja ko vi th id)

- **Interface**: `src/i18n/` (`t()`, `setLocale()`, one lazily loaded module per language in
  `locales/`). Markup carries keys (`data-i18n`, `data-i18n-placeholder`, …); scripts call
  `t()` and redraw on `onLocaleChange`. A new string goes into `locales/en.ts` and all fifteen
  others: `src/i18n/i18n.test.ts` fails on a missing key, an empty value or a different
  `{placeholder}`. Translated so far: the layout (navigation, footer, age gate, sign-in), the
  battle page and the theatre. Card names and Shakespeare's lines stay English.
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
  `launchctl bootout` + `bootstrap` (not an in-place copy). Prod is arm64 macOS: build the
  release binary on an Apple Silicon build host (the Studio, or the M4), never the Intel iMac.
- **Rolling back keeps the newer migrations.** sqlx refuses to start when the database has a
  migration its folder lacks (`VersionMissing`), so to go back to an older binary, put the old
  binary in place and leave `./migrations` as it is (every migration here only adds, and keeps
  the old binary working). Never delete an applied migration file.

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
