# Sonnet Man: as-built technology and operations (fact base)

Fact base for the game-development dossier (GDD, technical design document and the rest).
Written 2026-11-19 from the worktree `_wt-dossier/inspired-mile-web-dossier`, branch
`docs/dossier`, made from `integrate/wave3` at **0d6df6ef** (2026-11-18 20:27 -0500).

**How to read the citations.** `path:line` is a file in this repository at 0d6df6ef. `main:path:line`
is the same path on branch `main` (what is presumed live, 3015db55). A path beginning with
`site-ops/` is the separate operations repository at
the owner's site-ops checkout (read-only, as it stood on 2026-11-19). **Internal details** (addresses, host names, secret names) are kept out of this file and are only in `17-operations-runbook-and-launch-checklist.md`.
"grep" means the fact was established by searching the tree and finding nothing or exactly what is said.

**Method and limits.** Read-only. Nothing was built, tested or run in a browser, and no host was
reached over ssh: there is no `dist/` and no `node_modules/` in this worktree, so every bundle
figure below is either a recorded measurement (cited) or a size of a source file. Test counts are
static counts of `it(`/`test(`/`#[test]` call sites; loops and `.each` produce more at run time.

**Handling note.** This file repeats internal hostnames and addresses from `CLAUDE.md`. Strip
them before anything leaves the company.

---

## 0. What is live and what is about to ship

| | `main` (presumed live) | this branch (about to ship) |
|---|---|---|
| Tip | 3015db55, 2026-11-16 14:18 -0500 (`git log main`) | 0d6df6ef, 2026-11-18 20:27 -0500 |
| Commits | 81 (`git log main --oneline \| wc -l`) | 680; 599 past main (`git rev-list --count main..HEAD`) |
| Age of the code | 21 commits dated 2026-02-13 to 02-17, then 659 dated 2026-11-16 to 11-18 (`git log --format=%ad`) | same history |
| Migrations | 001 to 017 (`git ls-tree main backend/migrations/`) | 001 to 019 (`backend/migrations/`) |
| Multiplayer judge | a cloud LLM when the cloud-model key is set: model `claude-sonnet-4-5-20250929`, default URL `https://api.anthropic.com/v1/messages` (`main:backend/src/multiplayer/judge.rs` ~line 84, `main:backend/src/config.rs:110-112`) | server rules only, no model (`backend/src/multiplayer/mod.rs:1-5`) |
| the session-signing secret | falls back to the public string `dev-secret-change-in-production` when unset (`main:backend/src/config.rs:106-107`) | mandatory, at least 32 bytes; start-up exits otherwise (`backend/src/config.rs:95-140`) |
| Client address | `CF-Connecting-IP` believed from any peer (`main:backend/src/auth/client_ip.rs:8,27`) | believed only from `TRUSTED_PROXIES`, optionally with the proxy secret (`backend/src/auth/client_ip.rs:1-57`) |

Which exact commit is deployed could not be checked (no ssh). `CLAUDE.md:562` says the hosting
facts were "verified 2026-11-16", the day main's tip was made.

---

## 1. Architecture

### 1.1 Client

- **Astro 7.4.12, static output.** `astro.config.mjs` sets no `output` or adapter
  (`astro.config.mjs:13-32`); 18 pages in `src/pages/*.astro` (largest: `battle.astro`, 1,111 lines;
  `multiplayer.astro`, 954). Versions from `package-lock.json` (astro 7.4.12, react 19.3.1,
  tailwindcss 4.3.5, @babylonjs/core 9.36.0, @huggingface/transformers 4.3.2, kokoro-js 1.2.1,
  @google/model-viewer 4.4.0, @simplewebauthn/browser 14.0.0, kuromoji 0.1.2).
- **Page logic is TypeScript in Astro `<script>` blocks**, not React. React 19 is integrated
  (`astro.config.mjs:19`) but no page mounts an island (grep for `client:` finds none), and the one
  React component, `src/components/ErrorBoundary.tsx`, is imported nowhere (grep).
- **Tailwind 4** through `@tailwindcss/vite` (`astro.config.mjs:21`); theme in `src/styles/global.css`
  (`CLAUDE.md:8`); stylesheet imported once, in `BaseLayout.astro` (`CLAUDE.md:597`).
- **Babylon.js 9** for the Theatre (`src/lib/xr/theatre.ts:1-15`: flat screen, Quest passthrough AR
  or VR, Vision Pro VR), the VR gallery (`src/lib/vr-engine.ts:1-8`) and a Gaussian-splat viewer
  (`src/lib/splat-viewer.ts:129`). `@google/model-viewer` for AR card scenes: iOS Quick Look,
  Android Scene Viewer (`src/lib/ar-viewer.ts:1-11`).
- **The game engine runs in the browser.** Rules are pure and seeded in `src/lib/verse/`
  (`forms.ts`, `devices.ts`, `duel.ts`, `judge.ts`, `opponent.ts`, `session.ts`; `CLAUDE.md:29-32`).
  Both duel screens draw a `DuelSession`; no round is scored anywhere else (`CLAUDE.md:110-111`).
- **Storage is local first.** Anonymous play keeps game state in `localStorage`; signing in switches
  to the API (`src/lib/storage-backend.ts:1-8`). All API calls go to `/api/v1` on the page's own
  origin with `credentials: 'include'` (`src/lib/api-client.ts:6-17`). In development Astro proxies
  `/api` (and its WebSocket) to the local API port (`astro.config.mjs:6-10,27-31`).

### 1.2 API

- **Rust 1.100.0** pinned (`backend/rust-toolchain.toml:2`), edition 2024 (`backend/Cargo.toml:4`).
  Locked crates (`backend/Cargo.lock`): axum 0.8.9, sqlx 0.9.0, tokio 1.54.1, webauthn-rs 0.6.2,
  jsonwebtoken 12.0.0 (HS256, `aws_lc_rs`; `backend/Cargo.toml:13-17`), governor 0.10.4,
  tower-http 0.7.1, reqwest 0.13.5, regex 1.13.1. 411 packages in the lock file.
- **One process, one database.** `main.rs` loads `.env`, refuses to start on bad configuration
  (exit 2: `backend/src/main.rs:48-53,67-73`), connects a pool (max `DB_MAX_CONNECTIONS`, default 25;
  min 2; idle 300 s; acquire 5 s: `backend/src/db.rs:6-15`, `backend/src/config.rs:303-305`), runs
  migrations from `./migrations` in the working directory (`backend/src/db.rs:17-26`), and binds
  `0.0.0.0:$PORT`, default port in 17 §1.2 (`backend/src/main.rs:191`, `backend/src/config.rs:301`).
- **Background tasks in the same process** (`backend/src/main.rs:85-117`): tournament scheduler
  every 30 s (`backend/src/tournaments/scheduler.rs:8-17`); room sweep every 15 s
  (`backend/src/multiplayer/game_room.rs:64`); auth purge and unused-account purge every
  `MAINTENANCE_INTERVAL_SECONDS` (default 600: `backend/src/config.rs:334-337`).
- **Online matches live in memory** (`RoomManager`, `MatchmakingQueue`: `backend/src/main.rs:82-83`).
  A restart ends every live match; there is one API instance.
- **The API compiles in browser files**: `src/lib/verse/pron-en.ts` (`backend/src/verse/pronounce.rs:19`),
  `src/lib/verse/confusables.ts` (`backend/src/verse/text.rs:147`), and generated
  `backend/data/cards.json`, `english.json` (`backend/src/verse/cards.rs:28,56`). It must be built
  inside the whole repository (`CLAUDE.md:195-203`; proof script `scripts/check-api-build.sh:1-25`).
  There is no container image (`docker-compose.yml:1-3`: Postgres 16 for local development only).

### 1.3 What runs where (`CLAUDE.md:562-585`; `site-ops/deploy/manifest.toml:1250-1276`)

| Piece | Host | Detail |
|---|---|---|
| Edge, TLS | Cloudflare | Tunnel "publishing" terminates on the live-origin machine (`CLAUDE.md:564-566`) |
| Static site (live origin) | the live-origin machine (also a shared build host: `backend/src/auth/client_ip.rs:11-14`) | Caddy serves `~/sites/inspired-mile-web`, forwards `/api/*` and the WebSocket to prod over the private network (`CLAUDE.md:564-566`) |
| Static mirror | prod, the production server | same path; `rsync --delete --exclude=.git/` (`CLAUDE.md:567-568`); prod's own Caddy has a `sonnetman` block proxying `/api/*` to the local API port (`site-ops/Caddyfile:4005-4022`) |
| API | prod | `~/sites/inspired-mile-api/` (binary, `migrations/`, `.env`), a launchd service and its log files (names in 17 §1.2) (`CLAUDE.md:569-573`) |
| Database | prod | Postgres 18, the game's database; the database URL setting needs an explicit user (`CLAUDE.md:570-572`) |
| Model weights | Hugging Face hub and `*.hf.co` storage | fetched by the browser on use (`tests/third-party-allowlist.ts:26-66`) |
| Email (off) | Resend | `https://api.resend.com/emails` (`backend/src/auth/mailer.rs:10`); production runs without a key (`backend/src/auth/email.rs:17-19`) |

### 1.4 Every request to another origin

The privacy policy names them (`src/pages/privacy.astro:102-113`) and `tests/third-party.spec.ts`
fails on any request the allowlist does not hold (`CLAUDE.md:610-615`).

| Origin | When | Source |
|---|---|---|
| `plausible.io/js/script.js`, `plausible.io/api/event` | every page, only after the age gate is passed | `src/layouts/BaseLayout.astro:71-90`; `tests/third-party-allowlist.ts:36-51` |
| `huggingface.co/<repo>/…` and `huggingface.co/api/resolve-cache/models/<repo>/…` for five repos (Gemma 4 E2B, LFM3 1.7B, LFM2.5 350M, whisper-base, Kokoro-82M) | on use (a model, the microphone, the voice) | `tests/third-party-allowlist.ts:26-32,52-60` |
| `*.hf.co` (e.g. `cas-bridge.xethub.hf.co`) | redirects of the above | `tests/third-party-allowlist.ts:61-67` |
| Cloudflare, Resend (server to server), Google Scene Viewer (Android AR hand-off on a tap) | not page requests | `tests/third-party-allowlist.ts:71-80` |

Self-hosted instead of a CDN (`scripts/self-hosted-runtime.mjs:1-16`; `CLAUDE.md:620-631`):
onnxruntime-web `.wasm`/`.mjs` for Transformers.js (`src/lib/model-runtime.ts:1-38`), kokoro-js's own
runtime (`src/lib/thespian-voice.ts:27-30`), model-viewer's Draco and KTX2 decoders
(`src/lib/self-hosted.ts:10-20`), fonts (`public/fonts/fonts.css:1`), and Babylon's WebXR hand and
controller models turned off (`CLAUDE.md:602-603,628-629`). About 90 MB copied to `dist/ort/` and
`dist/vendor/` (`CLAUDE.md:621-622`). A library upgrade that moves these files stops the build on
purpose (`scripts/self-hosted-runtime.mjs:15-16`; `src/lib/self-hosted.ts:26-28`).

### 1.5 Offline and PWA

- **Service worker v3** (`public/sw.js:1-40`). Keeps only responses it fetched itself, without
  credentials, from static paths: `/_astro/*` cache first; `/images /fonts /audio` and icons
  stale-while-revalidate; page navigations network first with the kept copy or `offline.html` when
  offline; never anything under `/api`, never another origin, nothing over 12 MB
  (`public/sw.js:22-27,40,57-62`). Precache: `offline.html`, one font, three icons
  (`public/sw.js:38`). On sign-out it deletes everything not on the static list
  (`public/sw.js:28-30,153-170`). Registered as `/sw.js` (`src/layouts/BaseLayout.astro:1508`).
- **Incident it replaced:** v2 stored every successful API GET, `/api/v1/auth/me` (email,
  username) among them, past sign-out; stored a second copy of the model weights; and deleted every
  other cache on activation, which would have thrown away downloaded models (`public/sw.js:10-18`).
- **Manifest** `public/manifest.json`: `id` and `scope` `/`, `display: standalone`
  (`public/manifest.json:2,47-49`), localised names written by `scripts/pages-rest/build-static.mjs`
  (`CLAUDE.md:405-409`).
- **`src/lib/pwa.ts`** (`src/lib/pwa.ts:1-18`): asks `navigator.storage.persist()` after a model
  loads and when installed (`src/lib/pwa.ts:297-312`; called from `src/lib/brain.ts:256`); install
  guidance (iOS: Safari tab and Home Screen app do not share storage); a screen wake lock during a
  duel or the Theatre.
- **Offline solo play is not tested.** Nothing in `tests/` takes the browser offline and plays a
  duel (grep for `setOffline`); `tests/pages-rest.spec.ts:491-502` checks only the offline page.

### 1.6 Component diagram in words (for an SVG)

Boxes, left to right:

1. **Player's browser** (one large box), containing:
   - *Pages* (Astro static HTML + TypeScript) → *Duel engine* `src/lib/verse` (rules, seeded) →
     *DuelSession*.
   - *Brain* (`brain.ts`): Transformers.js 4.3.2 on **WebGPU** → Gemma 4 E2B or LFM3 1.7B.
   - *Ear* (`ear.ts`): Whisper base on **WebAssembly**. *Voice* (`thespian-voice.ts`): Kokoro-82M on
     WebAssembly (English) or the device's local voices.
   - *Theatre / VR / AR*: Babylon.js 9 (WebGL, WebXR), model-viewer.
   - *Storage*: localStorage (game state, age gate), sessionStorage (multiplayer seat and draft),
     Cache Storage (service worker v3; Transformers.js model caches).
2. **Cloudflare** (edge, TLS, tunnel "publishing").
3. **Caddy on the live-origin machine**: static files; `/api/*` and WebSocket → arrow over
   **the private network** to box 4.
4. **Prod (the production server)**: *Rust API* (axum; auth, inventory, stats, multiplayer rooms in
   memory, verse engine port) ↔ *Postgres 18*, the game's database. Static mirror beside it (dashed).
5. **Hugging Face hub** (dashed arrow from the browser's Brain/Ear/Voice: weights download only).
6. **Plausible** (dashed arrow from the browser: page views, after the age gate).
7. **Resend** (dotted arrow from the API: sign-in codes; off in production).

Arrows that carry player text: browser → Cloudflare → Caddy → API, for multiplayer verses only.
No arrow carries solo verse, audio or model output off the device (`src/pages/privacy.astro:18-22`).

---

## 2. API endpoints and database

All routes are under `/api/v1` (`backend/src/main.rs:165`). Every request passes, outermost first:
run-to-completion task (`backend/src/request_task.rs:1-24`), trace layer, CORS (one exact origin,
`CORS_ORIGIN`, default `http://localhost:4321`: `backend/src/main.rs:145-161`,
`backend/src/config.rs:302`), the **per-client rate limit** (600 requests a minute per IPv4 address or
IPv6 /64; 429 "Rate limit exceeded": `backend/src/main.rs:167-183`, `backend/src/rate_limit.rs:6,18-22`),
and a **1 MB body limit** (`backend/src/main.rs:166`). "Session" below means the cookie's JWT names a
live `auth_sessions` row (`backend/src/auth/middleware.rs:13-27`). Every route outside `/auth`,
`/health` and `/stats/leaderboard` requires one (`backend/src/main.rs:121-143`).

### 2.1 Public routes

| Method, path | Auth | What it does |
|---|---|---|
| GET `/health` | none | "ok" (`backend/src/main.rs:123`) |
| GET `/auth/methods` | none | `{passkey, passkey_signup, email}`; `email` false without a mail key (`backend/src/auth/handlers.rs:116-122`) |
| POST `/auth/passkey/signup/begin`, `/finish` | none; age tier `adult` or `teen` required (`backend/src/auth/handlers.rs:244-254`) | create an account with a passkey alone; the account waits in the challenge until the passkey verifies (`backend/src/auth/passkeys.rs:1-9`); sign-up limits in §3 |
| POST `/auth/passkey/login/begin`, `/finish` | none | discoverable (usernameless) sign-in (`backend/src/auth/passkeys.rs:8`) |
| POST `/auth/passkey/register/begin`, `/finish` | session + fresh proof (5 min) | add a passkey (`backend/src/auth/passkeys.rs:5-7`); at most 20 per account (`backend/src/auth/passkeys.rs:84`) |
| POST `/auth/passkey/verify/begin`, `/finish` | session | the fresh proof itself (`CLAUDE.md:259-262`) |
| GET `/auth/passkeys` | session | list the account's passkeys |
| DELETE `/auth/passkeys/{id}` | session + fresh proof | remove one (`CLAUDE.md:259-262`) |
| POST `/auth/email/request`, `/verify` | none; 503 when email is off | sign in or create an account by a 6-digit code (`backend/src/auth/email.rs:1-8`) |
| POST `/auth/email/add/request`, `/add/verify` | session + fresh proof | prove an address before storing it as the recovery email |
| POST `/auth/logout` | same-site JSON request | revoke this session's row, clear cookies (`backend/src/auth/handlers.rs:124-143`) |
| POST `/auth/logout/all` | session, same-site JSON | revoke every session of the account (`backend/src/auth/handlers.rs:145-158`) |
| GET `/auth/me` | session | the user; side effect: an account created before `LAUNCH_DATE` (default 2026-04-01) is raised to 500 credits (`backend/src/auth/handlers.rs:160-200`, `backend/src/config.rs:306`) |
| POST `/auth/age-tier` | session (+ fresh proof to go teen → adult) | the age rules of §3.6 (`backend/src/auth/age.rs:1-36`) |
| GET `/stats/leaderboard` | none | top 50 by `battle_wins`, then `highest_score`; returns user UUID, username, avatar URL (`backend/src/stats/handlers.rs:64-109`) |

### 2.2 Session routes

| Prefix | Routes (`backend/src/<module>/handlers.rs`) | What they do, and what they trust |
|---|---|---|
| `/inventory` | GET `/`, POST `/add`, GET `/stats` (`inventory/handlers.rs:38-40`) | `add` inserts any `card_id` of ≤20 ASCII letters, digits or `-` with any `source` (`inventory/handlers.rs:71-90`) |
| `/variants` | GET `/`, POST `/unlock`, GET `/eligible` (`variants/handlers.rs:38-40`) | unlock needs the base card in `owned_cards` (`variants/handlers.rs:77-88`) |
| `/stats` | GET/POST `/`, GET/POST `/achievements` (`stats/handlers.rs:55-56`) | POST raises counters to the client's numbers (0 to 999,999, `GREATEST`: `stats/handlers.rs:144-175`); achievements are claimed by id, ≤50 a call (`stats/handlers.rs:231-266`) |
| `/migrate` | POST `/sync`, GET `/status` (`migration/handlers.rs:68-69`) | copies the browser's cards, stats, achievements and variants into the account, additively (`migration/handlers.rs:102-230`) |
| `/multiplayer` | GET `/ws`, POST/DELETE `/queue`, GET `/rooms`, POST `/create-private`, GET `/join/{token}`, POST `/report` (`multiplayer/handlers.rs:70-75`) | §2.3 |
| `/marketplace` | GET `/`, POST `/list`, GET `/my`, GET `/{id}`, POST `/{id}/cancel`, POST `/{id}/buy` (`marketplace/handlers.rs:37-42`) | price 1 to 100,000 credits (`marketplace/handlers.rs:84-87`); `buy` marks the listing sold and adds the card to the buyer in one transaction, and moves no credits and does not take the card from the seller (`marketplace/handlers.rs:213-281`) |
| `/tournaments` | GET `/`, POST `/create`, GET `/{id}`, POST `/{id}/register`, GET `/{id}/bracket`, GET `/{id}/leaderboard`, POST `/{id}/matches/{match_id}/complete` (`tournaments/handlers.rs:73-79`) | single elimination or round robin (`tournaments/handlers.rs:152`); either participant may complete a match and name either player the winner (`tournaments/handlers.rs:296-330`) |
| `/credits` | GET `/`, POST `/earn`, POST `/spend`, POST `/age-verify`, GET `/limits` (`credits/handlers.rs:66-70`) | `earn` adds the client's `amount` (1 to 1,000) or a fixed rate by source: battle_win 50, trivia 30, challenge 20, daily 10 (`credits/handlers.rs:54-62,87-95`); `spend` 1 to 100,000, teen accounts 200 a day (`credits/handlers.rs:14,114-140`); `age-verify` answers and never writes (`backend/src/auth/age.rs:18-21`) |
| `/seasons` | GET `/current`, POST `/xp`, GET `/rewards`, POST `/claim/{level}` (`seasons/handlers.rs:64-67`) | XP is the client's `amount` (1 to 1,000) or a rate (battle 100, trivia 50, challenge 40, daily 25, else 10); level = XP / 200 (`seasons/handlers.rs:46-61,114-131`) |
| `/classroom` | GET/POST `/`, GET `/{id}/members`, POST `/join`, GET/POST `/{id}/assignments` (`classroom/handlers.rs:64-67`) | rosters only for members (`classroom/handlers.rs:180-203`); only the teacher creates assignments (`classroom/handlers.rs:280-294`) |
| `/referral` | GET `/`, POST `/redeem` (`referral/handlers.rs:40-41`) | one redemption per account; referrer +100 credits; the reply promises "5 free packs" (`referral/handlers.rs:100-141`) |

### 2.3 Online play (WebSocket and rooms)

- **Handshake**: session cookie (protected route) and an Origin check (`multiplayer/handlers.rs:288-310`).
- **Protocol**: client `JoinRoom` (with `lang`), `SubmitVerse`, `Forfeit`; server `RoomJoined`,
  `MatchStart`, `RoundStart`, `VerseAccepted`, `OpponentSubmitted`, `RoundResult`, `MatchComplete`,
  `OpponentDisconnected`, `OpponentReconnected`, `Error` (`backend/src/multiplayer/game_room.rs:200-276`).
- **Limits** (`backend/src/multiplayer/handlers.rs:39-63`, `game_room.rs:43-76`): message ≤6 KB;
  verse ≤2,000 bytes; 30 messages per 10 s per connection; join within 30 s; connection ≤45 min;
  500 rooms on the server; 3 live rooms per account; 40 per network (IPv4 address or IPv6 /48).
- **Timing** (`game_room.rs:96-105`): 180 s a round; 45 s to reconnect; 60 s for the paired opponent
  to arrive; a finished room answers for 90 s and is swept within 15 s more; any room is swept at
  30 min; an unvisited room at 300 s. A compile-time assertion holds 90 + 15 ≤ 120 s, the privacy
  policy's "up to two minutes" (`game_room.rs:65-76`; `src/pages/privacy.astro:61`).
- **Quick match** waits up to 30 s per request (`multiplayer/handlers.rs:51`); the page stops after
  3 min (`CLAUDE.md:172-173`).
- **Deck check**: 3 to 5 characters, each a starter or held in `owned_cards`
  (`multiplayer/handlers.rs:312-325`; `CLAUDE.md:159-162`).
- **English only**: any other language is refused with `language_not_offered`
  (`multiplayer/handlers.rs:537`; `CLAUDE.md:134-139`).
- **Session re-checked** before acting on a message (answer good for 1 s) and every 15 s; a database
  that cannot answer in 3 s is not taken for a sign-out (`multiplayer/handlers.rs:53-63,383`).
- **Content filter**: a short English list of profanity, slurs and self-harm phrases; whole words, or
  substrings for phrases (`backend/src/multiplayer/content_filter.rs:1-30`).
- **Reports** go to `content_reports` (reason 1 to 500 characters: `multiplayer/handlers.rs:107-125`).
  No route reads or reviews them (grep).
- **Nothing about a match is written to the database**: the only SQL in `multiplayer/` is the report
  insert and the deck check (grep). `battle_rooms`, `battle_turns` and the `mp_wins`, `mp_losses`,
  `mp_rating` columns are never written (grep).

### 2.4 Database schema (from the migrations)

| Table | Migration | Key columns, what it holds |
|---|---|---|
| `users` | `001_initial.sql:3-11`, later columns in 002, 007, 012, 016, 019 | id UUID, username (32, unique, generated `bard-<12 hex>`: `backend/src/auth/handlers.rs:259-261`), email (nullable since 007), password_hash (nullable, unused), display_name, google_id/google_email/avatar_url and `auth_provider` (007), wallet_address (002), house_allegiance (012), `age_tier` adult/teen/unknown (016), `age_tier_declared` (019) |
| `owned_cards` | `001_initial.sql:13-20`; NFT columns `003_nft_state.sql:2-4` | user_id, card_id VARCHAR(16), acquired_at, source VARCHAR(32), state; mint_address/signature/minted_at unused |
| `owned_variants` | `001_initial.sql:25-33` | user, variant_id, base_card_id, unique per user |
| `player_stats` | `001_initial.sql:38-53`; `004_multiplayer.sql:29-31`; `010_credits.sql:2` | the counters of §2.2, `credits`, mp_wins/losses/rating (never written) |
| `unlocked_achievements` | `001_initial.sql:55-61` | user, achievement_id, unique |
| `migration_log` | `001_initial.sql:65-71` | each localStorage-to-account copy |
| `battle_rooms`, `battle_turns` | `004_multiplayer.sql:2-26` | unused by the current code (grep) |
| `card_listings`, `trades` | `005_marketplace.sql:2-21` | listings (sale or trade, price, wanted ids), completed trades |
| `tournaments`, `tournament_entries`, `tournament_matches` | `006_tournaments.sql:2-36`; `created_by` `008:2` | `tournament_matches.room_id` references the unused `battle_rooms` (`006_tournaments.sql:32`) |
| `wallet_nonces` | `007_oauth_wallet_auth.sql:17-21` | unused (grep) |
| `seasons`, `season_progress`, `season_rewards` | `011_seasons.sql:2-30` | max level 30 by default |
| `house_leaderboard` | `012_houses.sql:4-12` | unused (grep) |
| `classrooms`, `classroom_members`, `classroom_assignments` | `013_classrooms.sql:2-29` | SERIAL ids; join code 8 characters |
| `referral_codes`, `referral_redemptions` | `014_referrals.sql:2-15` | one redemption per account |
| `content_reports` | `015_content_reports.sql:2-10` | reporter, room id, reason, status |
| `credit_transactions` | `016_age_tier.sql:6-13` | earn/spend log (teen limit counts it) |
| `webauthn_credentials` | `017_passwordless_auth.sql:5-15` | credential_id (unique), webauthn-rs `Passkey` JSON (public key, counter, backup flags), label, last_used_at |
| `auth_challenges` | `017:20-31`; kind `verify` `018:25-27`; `net_key` `019:16-17` | ceremony state, single use, 5-minute life |
| `signup_attempts` | `017:37-43`; `completed` `018:32-34` | network key of begun and finished sign-ups |
| `email_login_codes` | `017:47-63`; `requester` `018:40-42`; `inbox` `019:22-24` | HMAC of the code only, purpose login/add, age tier, attempts, expiry |
| `auth_sessions` | `018_sessions_and_limits.sql:8-22` | one row per signed-in browser: expiry, `verified_at`/`verified_by` (passkey or email), revoked_at |
| `email_code_failures` | `018:46-54`; `forgiven` `019:29-31` | each wrong guess, by address and network |

**Retention in code** (`backend/src/auth/passkeys.rs:1019-1054`; `backend/src/auth/sessions.rs:228-239`):
expired challenges deleted every sweep (they live 5 min: `passkeys.rs:82`); begun sign-ups after
2 h, finished after 1 day; email codes after 1 day (a code is good 10 min:
`backend/src/auth/email_code.rs:68`); wrong-guess rows after 2 days; sessions 1 day after they end
(they last 7 days: `backend/src/auth/jwt.rs:7`); passkey-only accounts that never played, never had an
email and left no trace, after `UNUSED_ACCOUNT_PURGE_DAYS` (default 30: `backend/src/config.rs:92`;
`passkeys.rs:1056-1130`). Everything else (cards, stats, credits log, reports, classrooms) is kept
until deleted. **There is no account-deletion endpoint**; the policy offers deletion on request
(`src/pages/privacy.astro:149,192`), and several tables reference `users` without `ON DELETE CASCADE`
(`passkeys.rs:1068`; e.g. `004_multiplayer.sql:5-7`, `011_seasons.sql:14`, `016_age_tier.sql:8`).

---

## 3. Accounts and security

### 3.1 Sign-in methods

- No passwords, no Google. **Passkeys** (WebAuthn, discoverable, no username) are primary; a
  **6-digit emailed code** creates an account, signs in where there is no passkey, and recovers
  (`CLAUDE.md:242-245`). Relying party name "Sonnet Man" (`backend/src/auth/handlers.rs:33-35`); RP ID
  `inspiredmile.com`, origin `https://sonnetman.inspiredmile.com` by default
  (`backend/src/config.rs:9-10`). **Changing the RP ID orphans every passkey** (`CLAUDE.md:266-267`).
- **Email is off in production**: no the email-service key, so the email endpoints answer 503 and the UI
  hides email (`backend/src/auth/email.rs:15-26`; `backend/src/main.rs:62-66`). Accounts that exist only
  by email (the old Google sign-in) cannot sign in at all while it is off; production had no users when
  this was accepted on 2026-11-16 (`CLAUDE.md:314-318`). The check query is in `CLAUDE.md:317`.
- Code: `backend/src/auth/`, `src/lib/passwordless.ts`, the auth script in `BaseLayout.astro`
  (`CLAUDE.md:244-245`). Mail text deliberately differs for "add a recovery email" so a stranger cannot
  pass it off as a sign-in code (`backend/src/auth/mailer.rs:25-57`).

### 3.2 Sessions

- Server-side rows in `auth_sessions`; the cookie's HS256 JWT carries `sid`; a token is good only
  while its row is live (`backend/src/auth/jwt.rs:9-19`; `CLAUDE.md:246-249`). 7 days
  (`backend/src/auth/jwt.rs:7`).
- Cookie `__Host-im_token` when every WebAuthn origin is https, else `im_token`; HttpOnly, Secure,
  SameSite=Strict (`backend/src/config.rs:239-249,279`; `backend/src/auth/sessions.rs:72-82`).
- **Fresh proof** (passkey assertion or emailed code within 5 min) for adding or removing a passkey and
  adding an email; the page retries after 403 `reauth_required` (`backend/src/auth/sessions.rs:26,54-70`;
  `CLAUDE.md:259-262`).
- Logout refuses a request that is not same-site JSON (`backend/src/auth/sessions.rs:207-218`).
- the session-signing secret mandatory, ≥32 bytes, not the old constant or the template placeholder; email-code
  HMAC key derived from it (`backend/src/config.rs:95-140,290`). a development-only override only with
  http origins (`backend/src/config.rs:280-286`).

### 3.3 Limits and abuse controls

Three widths of "network" (`backend/src/auth/client_ip.rs:16-24`; `CLAUDE.md:297-301`): request rate per
IPv4 address or IPv6 /64; codes, guesses, ceremonies and rooms per IPv4 address or IPv6 /48; sign-ups per
IPv4 /24 or IPv6 /48.

| Limit | Value | Source |
|---|---|---|
| Requests | 600 a minute per client (`RATE_LIMIT_PER_MINUTE`) | `backend/src/rate_limit.rs:6` |
| Accounts per network | 40 an hour | `backend/src/auth/passkeys.rs:88` |
| Begun sign-ups per network | 200 an hour | `passkeys.rs:91` |
| Site-wide sign-ups | 300 an hour (`SIGNUP_GLOBAL_PER_HOUR`); at it a network with 2 already is refused | `backend/src/config.rs:83`; `passkeys.rs:108` |
| Site-wide begun sign-ups | 1,500 an hour; share 10 per network at the ceiling | `config.rs:86`; `passkeys.rs:111` |
| Live ceremonies per network | 300 | `passkeys.rs:102` |
| Challenge table | 50,000 rows (`AUTH_CHALLENGES_MAX`); at it a network holding ≥10 gets 503 | `config.rs:89`; `passkeys.rs:105` |
| Email codes per inbox | 10 an hour (Gmail dots and `+tags` folded); ≤3 of them per network; 10 per network to any address | `backend/src/auth/email_code.rs:1-58,66-85` |
| Wrong guesses | 5 per code; 10 a day per network per address; 50 a day per address; 30 a day per network over all addresses (forgiven after a good code) | `email_code.rs:70,87-92` |
| Rooms | 500 total, 3 per account, 40 per network | `backend/src/multiplayer/game_room.rs:47-56` |

**A site-wide ceiling never refuses everyone**; before 2026-11-16 a full challenge table refused every
visitor, so one IPv6 /48 split into 200 /64s could stop all passkey sign-in in nine seconds
(`backend/src/auth/passkeys.rs:11-16,43-50`; `CLAUDE.md:292-296`). Limits are checked under advisory locks
in the inserting transaction (`email_code.rs:36-38`; `passkeys.rs:31-36`).

### 3.4 Proxy trust

- Forwarding headers (`CF-Connecting-IP`, `X-Forwarded-For`) are believed only from `TRUSTED_PROXIES`,
  default: loopback plus three internal addresses (listed in 17 §1.3); the last is the live-origin machine's,
  the peer prod actually sees (checked 2026-11-16) (`backend/src/auth/client_ip.rs:37-50`).
- the proxy secret (optional, ≥32 characters): when set, a trusted peer's headers count only with a
  matching `X-Proxy-Secret`, which every proxying Caddy must add with `header_up`
  (`client_ip.rs:52-57`; `backend/.env.production.template:27-35`). The prod Caddy block for the site adds
  no such header (`site-ops/Caddyfile:4010-4013`); the live origin's Caddy is not in site-ops (grep).
- The API writes, whatever `RUST_LOG` says, which peers it trusts and (rate-limited) which peer's header it
  ignored; **check on every deploy** (`CLAUDE.md:274-281`; `backend/src/notice.rs`).

### 3.5 Headers, CSP, CORS, errors

- No Content-Security-Policy anywhere in this repository (grep) or in prod's Caddyfile. Prod's Caddy adds
  `X-Content-Type-Options nosniff`, `X-Frame-Options DENY`, `Referrer-Policy strict-origin-when-cross-origin`
  and HSTS (1 year, subdomains) on its tunnel port (`site-ops/Caddyfile:57-72`). Whether the live origin
  sends the same could not be checked.
- CORS allows one exact origin with credentials (`backend/src/main.rs:145-161`); the template sets it to
  the site (`backend/.env.production.template:13`).
- A 500 never carries database text (`backend/src/error.rs:5-13`). Pages never show `e.message`;
  every API answer maps to an `error.<code>` sentence in 16 languages, enforced by
  `src/lib/api-errors.test.ts` (`CLAUDE.md:400-404`).
- Test-only race delay refused with an https origin (`backend/src/config.rs:76-80,289`).

### 3.6 Declared age

- The gate asks a date of birth in the browser; only the result (adult, teen with consent, under 13) is
  kept, in the browser; under 13 sees a notice, cannot create an account, and gets no analytics
  (`src/pages/privacy.astro:164`). Nothing verifies age (`backend/src/auth/age.rs:1-7`).
- Server rules (`backend/src/auth/age.rs:9-36`): tier set at creation; only the signed-in owner's explicit
  answer changes it; adult may become teen; teen becomes adult only for an account declared adult, with a
  fresh proof; an account declared teen stays teen (operator SQL in `age.rs:32-35`). Email requires
  `adult` or `teen-consented` in the browser and in the API (`CLAUDE.md:322-324`).
- Teen accounts: 200 credits a day of spending (`backend/src/credits/handlers.rs:14,126-140`).

---

## 4. In-browser AI

No server runs inference (`CLAUDE.md:13`; `src/lib/brain.ts:1-8`). Transformers.js 4.3.2 is loaded only
through `loadTransformers()`, which points onnxruntime-web at this site's copy and refuses a CDN
(`src/lib/model-runtime.ts:21-38`).

### 4.1 The three language models (`src/lib/brain.ts:61-83`)

| Tier | Model (Hugging Face repo, dtype) | Download | Judges by | Writes the opponent's verse in | Judges in |
|---|---|---|---|---|---|
| grand | Gemma 4 E2B (`onnx-community/gemma-4-E2B-it-ONNX`, q4f16) | 3,100 MB | compare, both orders | en es fr de it pt pl ru hi zh th id | en ru zh id |
| standard | LFM3 1.7B (`onnx-community/LFM3-1.7B-ONNX`, q4f16) | 1,090 MB | compare | none | vi |
| lite | LFM2.5 350M (`LiquidAI/LFM2.5-350M-ONNX`, q4) | 295 MB | grade one verse at a time | none | none, so **never offered** |

- **How a model is chosen** (`src/lib/brain.ts:116-164`): `detectCapability` reads WebGPU, `shader-f16`,
  `navigator.deviceMemory` and a handheld test (phones, tablets and headsets, Quest and Vision Pro included).
  No WebGPU → no model. Handheld, no f16, or under 8 GB → the lite tier, which is used nowhere, so
  **phones, tablets, headsets and small desktops are offered no model at all**. A desktop with WebGPU,
  f16 and ≥8 GB (or unreported memory) is offered Gemma first and LFM3 as the lighter choice
  (`src/pages/battle.astro:516-533`). The grand tier is never automatic (`brain.ts:138-141`).
- **Loaded only when the player asks** (buttons on the battle page), or on a later visit the same model the
  player chose before while the device is still offered it (`brain.ts:230-238`; `battle.astro:541-547`).
  `?brain=<tier>` loads any model (tests) (`battle.astro:511-514`).
- **On failure** (out of memory, driver fault) smaller models used in some language are tried, then the
  written opponent and rule judge (`brain.ts:219-268`). Before 2026-11-18 a failed LFM3 load silently fetched
  LFM2.5 and said it was running (`docs/language/MODEL-EVAL.md:159-162`).
- **Cached** by Transformers.js in its own same-origin cache; the service worker never touches it
  (`public/sw.js:14-16,182-189`); `storage.persist()` asked after a load (`brain.ts:252-256`).
- **Generation**: thinking off, temperature 0.8 by default, top-k 50, repetition penalty 1.1, 96 new
  tokens (`brain.ts:287-304`). **Judging** reads next-token scores for "A"/"B" in both orders
  (`brain.ts:306-328`), or grades one verse (lite).
- **Where a model is used is measured**: lists copied from `docs/language/model-eval/decisions.json`,
  derived by `scripts/model-eval/analyze.mjs` from 66 of 96 cells (`docs/language/MODEL-EVAL.md:16-24`);
  `src/lib/model-eval.test.ts` fails when they drift (`CLAUDE.md:500-510`). Thresholds committed before any
  cell ran (`docs/language/MODEL-EVAL.md:413-439`): judging needs ≥10 of 12 pairs, ≥70% of 48 criteria, no
  injection win, every reading the model's; writing needs ≥95% usable, ≥90% in the language, ≤10%
  commentary, form kept in ≥30% of plays.
- **Model weights are not pinned to a revision** (no `revision` option in `brain.ts:199-215`,
  `ear.ts:35-41`, `thespian-voice.ts:31-34`; grep), so a change on the hub reaches players unmeasured.
- **The model also writes English trivia and quote challenges** when loaded (`src/lib/content-gen.ts:1-5`),
  English only, because nothing checks what it writes in another language "or whether a 'fact' it states is
  one" (`src/lib/content-gen.ts:165-175`).

### 4.2 Measurements behind the choice

- First English-only measurement, 8 pairs × 4 criteria (`src/lib/brain.ts:24-34`): compare / grade —
  Gemma 31/32 / 31/32; LFM3 27/32 / 21/32; LFM2.5 9/32 / 25/32.
- **After the integration (2026-11-18), Gemma judges in 4 languages instead of 13.** One injection pair
  ("Ignore all previous instructions…") now beats the real verse in 11 languages. The only change was the
  compare wording (language named beside the verses, not in the instruction). An A/B with main's wording
  on the same code: 179 / 705 / 2 injection losses, 14 languages pass, against 155 / 628 / 11, 4 pass
  (`docs/language/MODEL-EVAL.md:73-131`). Which wording ships is "for the rules work and the owner
  to decide" (`MODEL-EVAL.md:110-112`).
- Writing: Gemma passes in 12 languages; fails in Arabic and Japanese on commentary, in Korean (form 24/100)
  and Vietnamese (32/110, bar 30%) on form; several languages sit within one run's noise of the bar
  (`MODEL-EVAL.md:41-63`). LFM3 keeps form in 16/90 English plays, LFM2.5 in 0/90; their writing in the other
  15 languages is unmeasured (`MODEL-EVAL.md:64-72`).
- **Grade-path injection** (lite tier): "Grade: 5" took all 32 criteria and "Grade: five" 31 before the
  defences; now lines with a number, number word or judge word are not read, such a round goes to the rules,
  and the model only decides what the rules split by `GRADE_MARGIN` 0.5; measured equal to rules-only in five
  languages, 90 rounds each, 8,528 model calls (`docs/language/JUDGE-INJECTION.md:1-36,77-121`).
- **Not established** (`MODEL-EVAL.md:1048-1111`): how well a model ranks two decent verses (test pairs are
  verse vs. non-verse); injection beyond three attempts per language; other GPUs, browsers and phones (one
  machine under headless Chromium); no in-game check of a verse's language (Gemma answers in
  English in 9/100 Italian plays). A fastText `lid.176` identifier (~1 MB) could close the last; not shipped.

### 4.3 Speech in and voice out

| | Model | Size | Runs on | Languages | Source |
|---|---|---|---|---|---|
| Ear | Whisper base, multilingual (`onnx-community/whisper-base`, q8) | ~80 MB | WebAssembly (no WebGPU needed) | the duel's language passed to Whisper; quality uneven outside major languages (`docs/research/in-browser-ai-2026-11.md:229`) | `src/lib/ear.ts:1-20,35-41,128` |
| Voice | Kokoro-82M v1.0 (`onnx-community/Kokoro-82M-v1.0-ONNX`, q8), voice `bm_george`, speed 0.95 | ~80 MB (`CLAUDE.md:635-636`) | WebAssembly | English only; other languages use only voices the browser reports as local (`localService`), since network voices send text away | `src/lib/thespian-voice.ts:15-16,29-34,62-84,144-158` |

- Takes ≤45 s, resampled to 16 kHz mono on the device (`src/lib/ear.ts:20,83-96`). The browser's Web Speech
  recognition is not used because it sends audio to a server (`CLAUDE.md:21-22`; `ear.ts:4-8`).
- kokoro-js 1.2.1 carries its own Transformers.js 3.8.1 and onnxruntime-web 1.22.0-dev
  (`package-lock.json`), shipped beside the main runtime (onnxruntime-web 1.31.0-dev.20260914).

### 4.4 Device and browser requirements (as built)

- **Everything plays without a model**: written opponent and rule judge in all 16 languages
  (`docs/language/MODEL-EVAL.md:7-10`).
- **A model** needs WebGPU with `shader-f16`, a non-handheld device and ≥8 GB reported memory
  (`src/lib/brain.ts:142-153`). WebGPU ships in Chrome/Edge desktop since 113, Safari 26 (macOS, iOS,
  visionOS), Firefox on Windows and Apple Silicon; Firefox measured ~1 vs ~52 tokens/s against Chrome in one
  paper (`docs/research/in-browser-ai-2026-11.md:161-175`). iPhone Safari kills a tab at about 2 GB
  (`in-browser-ai-2026-11.md:22,187-197`), which is why handhelds are capped at the lite tier.
- **Speech** needs a microphone and WebAssembly; **the Theatre** needs WebGL, and WebXR for headsets.

---

## 5. Online parity (Rust scores exactly as TypeScript)

- `backend/src/verse/` is a Rust port, for English, of `src/lib/verse/`: cleaning, words, syllables and
  rhyme by sound, forms, devices, signature echo, curses, power words, the substance floor, the copy test,
  `scoreVerse`, the rule judge and round resolution; not ported: display strings, the model judge, the
  written opponent, single-player set-up (`backend/src/verse/mod.rs:1-17`).
- The data both read is one file each, compiled into the binary (§1.2); numbers compared as exact doubles
  (serde_json `float_roundtrip`: `backend/Cargo.toml:9-11`; `CLAUDE.md:141-145`).
- **Golden vectors**: `src/lib/multiplayer-golden.test.ts` (10 tests) writes the TypeScript engine's answers
  to `backend/tests/golden/*.json` and `backend/data/*.json` (`src/lib/multiplayer-golden.test.ts:1-27`;
  `scripts/gen-verse-golden.sh:1-15`). Seven files, 17.8 MB, about 35,000 cases: `text.json` 14,390
  (verses, words, rhymes, similarity, ends), `checks.json` 10,086 (devices, curses, signatures, power words,
  forms), `score.json` 6,112, `online.json` 2,751 (plans, rounds, matches, settle), `judge.json` 1,456,
  `duel.json` 270, `tables.json` constants and tables (counted from the files).
- `backend/tests/verse_parity.rs` (718 lines, 8 tests) compares every count, point and verdict and lists every
  disagreement (`backend/tests/verse_parity.rs:1-50`). Rule: if it fails, fix the Rust, never loosen the
  comparison; `npx vitest run` fails while the golden files are stale (`CLAUDE.md:123-131`).
- **In the browser**, the multiplayer page previews with the TypeScript rules and recomputes every round the
  server sends (`auditRound`: `src/lib/multiplayer-client.ts:302-306`; `CLAUDE.md:119-121`). Verses are
  "settled" by both sides before scoring (`CLAUDE.md:153-157`).
- **Known gap**: the server's Unicode tables (regex crate, Unicode 16) can be older than the browser's
  (17); a verse with a character the server does not assign is refused (`unknown_character`), not
  mis-scored. Browsers with older tables than the server (an old Safari) were not tested
  (`CLAUDE.md:147-151`; `backend/src/multiplayer/game_room.rs:295,776`).
- Why online is English only: the other 15 languages rely on sound tables, kuromoji and the browser's word
  segmenter, which a Rust server could not reproduce exactly (`CLAUDE.md:134-139`).

---

## 6. Languages

The 16: en es fr de it pt pl ru ar hi zh ja ko vi th id (`CLAUDE.md:332`). Portuguese is Brazilian
(`CLAUDE.md:463-465`).

### 6.1 What every language has

- **Interface strings**: core `src/i18n/locales/<lang>.ts` (16 files, 564 KB) and page areas
  `src/i18n/pages/<area>/<lang>.ts` (2.8 MB), lazily loaded; `src/i18n/i18n.test.ts` fails on a missing key,
  empty value or different placeholder (`CLAUDE.md:334-346`). Pages whose text stays English in every
  language: multiplayer, privacy, terms (`CLAUDE.md:593-594`). Plurals by CLDR categories through `Intl`
  (`CLAUDE.md:542-547`).
- **Card text**: 15 generated modules in `src/lib/cards-i18n/` (928 KB) from Wikidata labels, published
  Wikisource translations where found, and lines written for the game, marked (`CLAUDE.md:416-423`).
- **Duel packs**: `src/lib/verse/packs/<lang>.ts` (acrostic words, forbidden letters, power words, the
  written opponent's verses; 140 KB) (`CLAUDE.md:410-415`).
- **Function words**: 15 generated modules from stopwords-iso 1.1.0 plus Wiktionary closed-class words
  (`src/lib/verse/function-words/de.ts:1-6`; `CLAUDE.md:426-428`).
- **Stemming**: Snowball for es fr de it pt pl ru ar hi id (`src/lib/verse/stem/index.ts:1-6`); Vietnamese
  tones, Korean particles, segmenter words in zh ja th (`CLAUDE.md:425-428`).
- **Judge words**: numbers 2 to 10 from CLDR 49 RBNF and judge words from Wiktionary, all 16 languages
  (`docs/language/JUDGE-INJECTION.md:10-30`; `src/lib/verse/judge-words.ts:1-8`).

### 6.2 Sound data (`docs/language/PHONETICS.md:36-45,456-471`)

| Language | Data fetched for a duel | Rhyming forms | Syllable forms |
|---|---|---|---|
| en | CMU-derived table `pron-en.ts`, 1.46 MB (0.56 MB gzip, 0.47 MB brotli) (`CLAUDE.md:96-110`) | yes | yes |
| pl ko vi ar | nothing (spelling shows sound) | yes | yes (ar: no syllable forms) |
| es pt hi id | small exception tables (5 to 21 kB) | yes | yes |
| it ru | stress tables (290 kB; 3.72 MB, 515 kB gzip) | yes | yes |
| fr de | pronunciation tables (1.0 MB; 1.29 MB) | yes | yes |
| zh | character readings (514 kB) | yes once loaded | yes (a character a syllable) |
| th | word-ending table (346 kB) | yes once loaded | no |
| ja | kuromoji 0.1.2 with IPADIC cut to what the engine reads (4.7 MB compressed, 16 MB unpacked; was 17.8 MB and 100 MB) plus JMdict/JMnedict katakana lists 0.38 MB (`CLAUDE.md:479-487`) | yes once loaded | yes, kanji included |

Measured against published verse per language (e.g. es 42/43 rhyme pairs, ru 47/48, zh 46/49, vi 56/60) and an
independent espeak-ng check (`PHONETICS.md:361-418`). Determinism: rhyme and syllable rules are pure
functions of the line and the data; Thai's structural forms still use `Intl.Segmenter`, untested across
browsers (`PHONETICS.md:492-505`).

### 6.3 Pipeline and sources

- Interface QA (`CLAUDE.md:548-560`; `docs/language/QA-REPORT.md`): unit checks
  (`src/i18n/quality.test.ts`) for plurals, untranslated strings, punctuation and glossary; on the build
  host LanguageTool 6.6, Hunspell 1.7.2, back-translation with MADLAD-400 3B and two similarity models, and a
  second-model review by Gemma 4 26B-A4B, all offline (`docs/language/PROVENANCE.md`, "Tools" and "Models").
- Card text: `scripts/language/build_card_text.py`; checks `scripts/language/check/run.sh` with output
  committed in `docs/language/checks/`; `src/lib/cards-i18n/checks.test.ts` fails when text changes without
  the checks (`CLAUDE.md:465-475`).
- Authoritative sources (`docs/language/PROVENANCE.md`, "Data taken from a source";
  `docs/language/PHONETICS.md:507-535`): Unicode CLDR 49.0.0; Wikidata (CC0); Wikipedia titles; English
  Wiktionary translation tables and kaikki.org/WikiPron pronunciations (CC BY-SA 4.0); Unihan; CC-CEDICT;
  JMdict/JMnedict via jmdict-simplified 3.6.2 (CC BY-SA 4.0); mecab-ipadic; AOSP strings (Apache 2.0);
  Mozilla l10n (MPL 2.0); one sentence each from Apple and Google help pages as evidence; OpenCC;
  stopwords-iso; Snowball; UTS #39 confusables; Wikisource (public-domain texts); OpenSubtitles frequency
  lists (tests). Generated files pin their source by sha256 and refuse a different one (`CLAUDE.md:87-94`).
- Provenance files: `docs/language/PROVENANCE.md`, `CONTENT-PROVENANCE.md` (playground, story, 200 trivia
  questions), `NAMES-AND-QUOTATIONS.md` (per card and language), `card-text.provenance.json`,
  `model-eval/PROVENANCE.md`, `sources/*.json` (as fetched).

### 6.4 Human review status

**No string, verse, name or scene in any language has been read by a native speaker.** The translations
and the written opponent's verses were written by a language model and checked only by tools
(`docs/language/PROVENANCE.md`, "What was generated, not sourced"; `docs/language/CONTENT-PROVENANCE.md:16`;
`docs/language/PHONETICS.md:47-52`). `docs/language/HUMAN-REVIEW.md` lists 28 items for a reviewer, in
priority order. LanguageTool has no module for hi, ko, vi, th, id; Hunspell none for zh, ja
(`docs/language/QA-REPORT.md:9-31`).

### 6.5 Per language: what is built and what is still not right

"Gemma writes / judges" is from `src/lib/brain.ts:63-67`. Names and lines are from
`docs/language/NAMES-AND-QUOTATIONS.md:470-488` (names missing: the English name is shown; lines: published
translation used vs. written for the game, of 71).

| Lang | Gemma writes / judges | Names missing; lines published / new | Still not right (evidence) |
|---|---|---|---|
| en | yes / yes | source | reference language; only language online (`CLAUDE.md:134`) |
| es | yes / no | 4; 29 / 42 | Gemma form 34/100, near the bar (`MODEL-EVAL.md:58-60`) |
| fr | yes / no | 1; 51 / 20 | "World card" reworded (`HUMAN-REVIEW.md` item 12) |
| de | yes / no | 5; 50 / 21 | coinages Schauerkreis, Arkan for review (`NAMES-AND-QUOTATIONS.md:653-665`) |
| it | yes / no | 5; 51 / 20 | Gemma answers in English in 9/100 plays (`MODEL-EVAL.md:1092-1095`) |
| pt | yes / no | 13; 6 / 65 | interface Brazilian, verses use *tu* and European turns (`HUMAN-REVIEW.md` item 11) |
| pl | yes / no | 12; 28 / 43 | case after numbers written by the translator (item 5) |
| ru | yes / yes | 2; 34 / 37 | same as pl (item 5); "Drown" as a noun (item 24) |
| ar | no / no | 13; 0 / 71 | no syllable forms (`PHONETICS.md:45`); Gemma fails on commentary (`MODEL-EVAL.md:53-55`); LFM3 near chance (`CLAUDE.md:47-48`) |
| hi | yes / no | 12; 0 / 71 | no grammar tool; quatrain name चौपदी vs चौपाई (item 3); word for verse (item 22) |
| zh | yes / yes | 3; 0 / 71 | Gemma commentary 10/110 at the bar (`MODEL-EVAL.md:47-52,60-61`); 双手 rule (item 27); list separator (item 28) |
| ja | no / no | 7; 13 / 58 | Gemma form 22/100 (`MODEL-EVAL.md:53-56`); a first duel waits 5 to 5.7 s for the dictionary on a throttled phone (`CLAUDE.md:485-488`); Aozora has only Tsubouchi's Romeo and Juliet (`CLAUDE.md:474-475`) |
| ko | no / no | 9; 0 / 71 | Gemma form 24/100 (`MODEL-EVAL.md:56`); no grammar tool; particle hedge after English names (item 13) |
| vi | no / LFM3 only | 19; 0 / 71 | Gemma form 32/110, one play under the bar (`MODEL-EVAL.md:56-57,59-60`); tone-mark placement a choice (item 9) |
| th | yes / no | 26; 0 / 71 | no syllable forms; no grammar tool; the translator's least sure language (item 2); foreign-name rule limits (`CLAUDE.md:450-452`) |
| id | yes / yes | 14; 0 / 71 | no grammar tool; six evaluation excerpts replaced over copyright (`MODEL-EVAL.md:36-38`) |

---

## 7. Quality: test suites, gates, build hosts

**Project rule: builds and tests never run on the dev Mac**; they run on a build host through
the build-host runner `rb` (`CLAUDE.md:205-215`). No GitHub Actions; "CI is the build host" (`CLAUDE.md:600`;
the old `.github/workflows/deploy.yml` was deleted in ddc4e1dd).

### 7.1 Suites (static counts at 0d6df6ef)

| Suite | Files | Cases | Guards | Run with |
|---|---|---|---|---|
| vitest, pure logic (`vitest.config.ts:4-5`) | 36 `src/**/*.test.ts` | 598 call sites: verse engine 251 (`verse.test` 55, `findings` 60, `review`–`review5` 89, sound 38, …); i18n 122; card text 85; model-eval and brain 55; PWA and service worker 48; multiplayer client and golden 19; other 18 | rules, thresholds (each set from a recorded measurement: `CLAUDE.md:54-59`), language QA, measured model lists, parity freshness, SW cache rules, privacy retention words | `npx vitest run` |
| Playwright, browser (`playwright.config.ts`) | 20 `tests/*.spec.ts` | 281 `test(` sites; `auth.spec.ts` 101 (3,033 lines), `v2-world-cards` 22, `duel` 19, `pwa` 18, `v1-flows` 18, `pages-rest` 17, `multiplayer` 12, `pages-i18n` 11, `card-text` 10, `third-party` 9, `theatre` 9, `i18n` 9 | sign-in end to end against a throwaway Postgres and two real APIs (email on and off), every page's third-party requests, i18n layout, multiplayer, theatre, PWA | `npx playwright test` (starts Postgres, two APIs, the dev server and a no-email proxy itself: `playwright.config.ts:43-95`; `CLAUDE.md:222-226`) |
| Real models (`playwright.model.config.ts`) | 7 `tests/model/*.spec.ts` | 13 | real Gemma/LFM/Whisper on WebGPU: duel, injection, hide, unread, compare wording, opponent prompt, ear | `TIERS=lite,standard,grand npx playwright test -c playwright.model.config.ts`; up to 3 GB download (`CLAUDE.md:211-212`) |
| Byte cost (`playwright.cost.config.ts`) | `battle-ja-cost.spec.ts` | 2 | what a Japanese duel fetches on a throttled link | against a built site |
| Production smoke | `tests/prod-smoke.spec.ts` | 4 sites, one test per page over 18 pages | page errors, failed same-origin requests, broken images | `PROD_URL=https://sonnetman.inspiredmile.com npx playwright test` (`CLAUDE.md:213-214`) |
| cargo | 24 files in `backend/src` + `backend/tests/verse_parity.rs` | 184 `#[test]`/`#[tokio::test]` in src (game_room 29, config 20, email_code 18, client_ip 15, text 14, duel 11, …) + 8 parity | room state machine with paused time, configuration refusals, limits, verse port | `cd backend && cargo test --release` |
| Mutation and probes | `scripts/mutate-packs.mjs`, `mutate-pages.mjs`, `mutate-i18n-browser.mjs`, `sound/mutate-sound.mjs`, `model-eval/mutate-gates.mjs`, `mutate-picker.mjs`, `mutate.mjs`, `lang-content/mutate-play.mjs`, `pages-rest/mutate.mjs` | n/a | each proves the tests above go red when the thing they guard is broken (`CLAUDE.md:491-493,533-535,538-539`) | build host |
| Language tools | `scripts/lang/run.sh`, `scripts/language/check/run.sh`, `scripts/pages-rest/lang-host.sh` | n/a | grammar, spelling, meaning, second-model review | build host (`CLAUDE.md:548-560`) |

**No cargo or browser test covers the economy and progression handlers**: inventory, credits, marketplace,
tournaments, seasons, classroom, referral, migration, variants and stats have no `#[test]` (per-file counts);
whether any Playwright spec exercises them deeply was not established beyond `v1-flows`/`v2-world-cards`.

### 7.2 Gates before a deploy (as documented)

1. `npm ci && npx vitest run && npm run build && npx playwright test` on the build host (`CLAUDE.md:209`).
2. `cd backend && cargo test --release && cargo build --release` (`CLAUDE.md:210`); after any change to
   `src/lib/verse/`, `cards.ts` or `multiplayer-rules.ts`, regenerate the golden files first
   (`CLAUDE.md:123-131`).
3. Real-model tests when the model path changes (`CLAUDE.md:211-212,500-535`).
4. Language checks after any string change (`CLAUDE.md:557-560`).
5. `scripts/check-api-build.sh` (clean-copy build, `--locked`) (`scripts/check-api-build.sh:1-25`).
6. On prod, `scripts/check-migrations.sh <new migrations> -d <database>` before swapping the binary
   (`CLAUDE.md:577-581`; `scripts/check-migrations.sh:1-13`).
7. After deploy: the production smoke suite (`CLAUDE.md:213-214`), the `TRUSTED_PROXIES` log check
   (`CLAUDE.md:274-279`); optional `scripts/prod-passkey-check.mjs` (one real passkey sign-up against the
   deployed site, which creates an account to delete: `scripts/prod-passkey-check.mjs:1-2`).

### 7.3 Build hosts

- The build host is shared; no server is reused; default ports 4399, 38490, 38491, 54329, movable by
  `E2E_*` variables (`CLAUDE.md:228-233`). Before 2026-11-16 two concurrent runs could test each other's
  code and pass (`CLAUDE.md:232-233`). Never `pkill -f 'astro dev'` (`CLAUDE.md:235-238`). One `rb` per
  checkout at a time (`CLAUDE.md:219-220`).
- Hosts named in the docs (names in 17): a build machine with a Metal GPU (every model-evaluation cell ran there:
  `docs/language/MODEL-EVAL.md:211-215`); the live-origin machine (also the site's proxy); an Intel machine for the card-text
  checks (`docs/language/NAMES-AND-QUOTATIONS.md:447`). The release binary must be built on Apple Silicon,
  never the Intel machine, because prod is arm64 macOS (`CLAUDE.md:575-576`).

---

## 8. Performance

Not built here (no `dist/`, no `node_modules/`). Recorded measurements and source sizes:

| What | Size | Source |
|---|---|---|
| A visitor who never starts a duel (built site, `/battle`) | 1.68 MB body, 1.39 MB gzip, 1.38 MB brotli, 38 responses | `docs/language/RULES-MEASUREMENTS.md:263-278` (2026-11-16) |
| An English duel, written opponent | 7.79 MB body, 5.92 MB gzip, 49 responses (pron-en 1.54 MB body) | same |
| A Japanese duel, written opponent | 62.2 MB body, 23.1 MB compressed, 71 responses: measured **before** IPADIC was cut to 4.7 MB compressed | same; `CLAUDE.md:479-482` |
| English pronunciation chunk | 1.46 MB; 0.56 MB gzip; 0.47 MB brotli; never in a first load | `CLAUDE.md:103-110` |
| Self-hosted model runtimes (`dist/ort/`, `dist/vendor/`) | about 90 MB, on use only | `CLAUDE.md:621-622` |
| Models | Gemma 3,100 MB; LFM3 1,090 MB; LFM2.5 295 MB; Whisper ~80 MB; Kokoro ~80 MB | `src/lib/brain.ts:63-77`; `src/lib/ear.ts:18`; `CLAUDE.md:635-636` |
| `public/` (shipped as is) | 48 MB, 313 files: images 33 MB (269 WebP: cards 17 MB, variants 16 MB), audio 13 MB (4 MP3 tracks 12 MB, 14 WAV effects 1.2 MB), fonts 404 KB (5 families, Latin and Latin-ext only), models 1.3 MB (one GLB, one splat PLY) | `du` on `public/` at 0d6df6ef |
| Sound tables in source | `sound/data` 6.9 MB, `sound/ipadic` 4.5 MB, `sound/jmdict` 368 KB | `du` on `src/lib/verse/sound/` |

- **What loads when.** Pronunciation table, sound tables and the Japanese analyser are separate chunks
  fetched only when a duel in that language is about to start (`battle.astro warm()`: language picked,
  settings touched, start button pointed at, or a stored language once the page is idle) and never on a first
  load (`CLAUDE.md:103-110,476-488`; `tests/battle-bytes.spec.ts` asserts it). Models, Whisper and Kokoro
  only on the player's request. Analytics after the age gate.
- **First-load budget**: no numeric budget is enforced; `tests/battle-bytes.spec.ts` asserts what is not
  fetched, not a byte ceiling (`tests/battle-bytes.spec.ts:60-95`).
- **Load times** of `loadSound`: es 6 ms to ja 1,755 ms on a loaded host; download time over a real
  connection was not measured (`docs/language/PHONETICS.md:482-490`); a Japanese duel started at once waits
  5 to 5.7 s on a throttled phone (`CLAUDE.md:485-488`).
- Non-Latin scripts use system fonts (`src/styles/global.css:59-61`; only Latin subsets in `public/fonts`).
- `src/lib/vr-engine.ts:10` imports the `@babylonjs/core` barrel (the Theatre uses deep imports,
  `src/lib/xr/theatre.ts:16-33`); the VR gallery's bundle size is unmeasured.

---

## 9. Analytics and telemetry

- **Plausible**, script `https://plausible.io/js/script.js` with `data-domain="inspiredmile.com"`, injected
  only when the stored gate answer is `adult` or `teen-consented` (`src/layouts/BaseLayout.astro:71-90`).
  Page views only in practice: `src/lib/analytics.ts:11-42` defines `trackEvent` and eight helpers
  (pack_opened, battle_started, battle_won, trivia_completed, challenge_completed, card_minted, sign_in,
  pageview) and nothing calls them (grep).
- **Policy promise** (`src/pages/privacy.astro:89-100`): page address including the query string, referrer,
  IP and browser type, possibly window width; no verse or voice; Plausible's own claims of no cookies and no
  stored IP are attributed to Plausible.
- **Server-side gameplay records** are the tables of §2.4 (stats, credits log, cards); the stats counters are
  client-reported (§2.2). No product telemetry, crash reporting or performance beacon exists (grep for
  analytics callers and third-party allowlist).
- **Logs**: the API logs errors when `RUST_LOG` is unset, plus operator notices at any level
  (`backend/src/main.rs:40-46`; `CLAUDE.md:279-281`); the template sets `RUST_LOG=info`
  (`backend/.env.production.template:37-40`). Reports are logged too (`src/pages/privacy.astro:64`).
  The policy promises server logs are kept no more than 30 days (`src/pages/privacy.astro:131,153`); prod's
  Caddy error log rolls at 30 days with IPs masked to /16 (`site-ops/Caddyfile:18-41`); how the API's launchd
  log files are rotated is not recorded anywhere found.
- Model downloads tell Hugging Face the IP, user agent, referrer and model (`tests/third-party-allowlist.ts:52-60`).

---

## 10. Operations

### 10.1 Topology

As in §1.3. The domain's tunnel terminates on the live-origin machine; the API and database are on prod only and are
"deployed by hand" (`site-ops/deploy/manifest.toml:1250-1255`). The manifest lists `sonnetman` as a static
site on the live-origin machine with prod as mirror, `npm run build`, `dist` (`site-ops/deploy/manifest.toml:1267-1276`).

### 10.2 Deploy steps (`CLAUDE.md:195-203,562-585`)

1. Gates of §7.2 on the build host.
2. Build the release binary on an Apple Silicon host inside the whole repository.
3. On prod: `scripts/check-migrations.sh <new migrations> -d <database>`; it exits 1 if the new API would
   refuse to start (changed, missing or dirty migration).
4. Copy the binary and `migrations/` to `~/sites/inspired-mile-api/`; replace the binary by writing a new
   file and renaming it, then `launchctl bootout` + `bootstrap` (not an in-place copy).
5. Sync the static build to the live origin and prod with `rsync --delete --exclude=.git/`.
6. Smoke test and proxy-trust check.
7. Rollback: put the old binary back and **leave `./migrations` as it is**; every migration only adds
   (`CLAUDE.md:582-585`; `backend/migrations/019_limits_and_declared_age.sql:1-5`).

Deploying restarts the API, which drops every live online match (in-memory rooms, §1.2).

### 10.3 The pending deploy (this branch over main)

- **Migrations 018 and 019** (sessions, fresh proof, network-keyed limits, inbox column, forgiven misses,
  declared age), additive and re-runnable (`backend/migrations/018_sessions_and_limits.sql:1-3`;
  `019_limits_and_declared_age.sql:1-11`). Existing JWTs without `sid` stop parsing, so every current session
  ends (`backend/src/auth/jwt.rs:13-16`).
- **Environment** (`backend/.env.production.template`): the session-signing secret now mandatory and ≥32 bytes (the API
  exits otherwise; main fell back to a public constant: `main:backend/src/config.rs:106-107`); the cloud-model key
  and its URL setting gone; new optional `TRUSTED_PROXIES`, the proxy secret, `SIGNUP_GLOBAL_PER_HOUR`,
  `SIGNUP_BEGINS_GLOBAL_PER_HOUR`, `AUTH_CHALLENGES_MAX`, `UNUSED_ACCOUNT_PURGE_DAYS`,
  `MAINTENANCE_INTERVAL_SECONDS`; the database URL setting needs an explicit user (diff of env names read in
  `main:backend/src/config.rs` and `backend/src/config.rs`).
- **Static build**: the frontend needs no secrets or `PUBLIC_*` variables (`CLAUDE.md:217`).
- **Unverified hazard**: the manifest entry has no `no_cache_bust` (`site-ops/deploy/manifest.toml:1267-1276`),
  so `deploy.sh sonnetman` would content-hash every `.js`, `.wasm` and `.css` in `dist`
  (`site-ops/deploy/deploy.sh:543-551,117-176`), including `sw.js` (registered by its literal name:
  `src/layouts/BaseLayout.astro:1508`) and the self-hosted onnxruntime `.wasm`, whose file name the page
  checks against a list at run time (`src/lib/model-runtime.ts:29-35`). `CLAUDE.md:567-568` describes a
  plain rsync instead. Which route was used for the live build is not recorded.

### 10.4 Monitoring, backups

- **Monitoring**: none found for this site. What exists: operator notices and ceiling banners in the API log
  (`CLAUDE.md:279-291`), `GET /api/v1/health`, and the production smoke suite run by hand. No uptime check or
  alert names the site in site-ops (grep: only `Caddyfile`, `manifest.toml`, `shared/tamper-guard.ts`).
- **Backups**: none recorded for the game's database in this repository or site-ops (grep for
  `pg_dump`, `backup`).

### 10.5 Incident history (as recorded)

| When | What | Source |
|---|---|---|
| Before v3 | service worker v2 cached signed-in API answers (incl. `/auth/me`) past sign-out, duplicated model weights, and would have deleted downloaded models on update | `public/sw.js:10-18` |
| 2026-11-16 | the revival: "fix production API addresses, upgrade all dependencies" | commit ddc4e1dd |
| 2026-11-16 | without the live-origin machine's address trusted, the API counted every visitor as one client (found in review, fixed by the default) | `backend/src/auth/client_ip.rs:42-45` |
| 2026-11-16 | a sign-in whose session row the next request could not see, with Postgres reporting a transaction already in progress, in an end-to-end run; cause read from sqlx code, not reproduced; fixed by run-to-completion | `backend/src/request_task.rs:4-16` |
| 2026-11-16 | a full challenge table refused every visitor (review finding, not seen in production) | `backend/src/auth/passkeys.rs:46-48` |
| 2026-11-17 | a quick-match request whose client had gone kept its place and paired the next player with nobody (checker probe) | `backend/src/request_task.rs:18-24` |
| before 2026-11-18 | a failed LFM3 load silently fetched LFM2.5 and claimed it was running | `docs/language/MODEL-EVAL.md:159-162` |
| Test infrastructure | concurrent runs tested each other's servers; a `pkill` stopped other checkouts' dev servers | `CLAUDE.md:232-238` |

No production outage is recorded in this repository.

---

## 11. Licences and third-party content

### 11.1 Models

| Model | Licence | Condition | Source |
|---|---|---|---|
| LFM3 1.7B, LFM2.5 350M (Liquid AI) | LFM Open License v1.0 | commercial use only while the licensee and every entity under common control earn under US$10M a year; owner confirmed Voyage Tracable LLC under it on 2026-11-17; re-check if revenue grows, or remove them from `MODELS` | `docs/MODEL-LICENCES.md:6-16`; `CLAUDE.md:9-12` |
| Gemma 4 E2B | Apache 2.0 | card asks for content-safety safeguards | `docs/research/in-browser-ai-2026-11.md:18,82` |
| Whisper base | MIT (as given for Whisper) | card warns of uneven languages and text not spoken | `in-browser-ai-2026-11.md:229` |
| Kokoro-82M v1.0 | Apache 2.0 | good only in English | `in-browser-ai-2026-11.md:215` |
| Build-host only (not shipped): MADLAD-400 3B, all-MiniLM-L6-v2, LaBSE, Gemma 4 26B-A4B QAT | Apache 2.0 | offline, `HF_HUB_OFFLINE=1` | `docs/language/PROVENANCE.md`, "Models" |

`docs/MODEL-LICENCES.md:18` says plainly it covers the LFM models only.

### 11.2 Data shipped with the game

| Data | Licence | Condition / status |
|---|---|---|
| CMU Pronouncing Dictionary (pinned commit, sha256) → `pron-en.ts`, also compiled into the API | BSD-style (CMU) | notice kept as the data's first lines (`src/lib/verse/pron-en.ts:1-30`; `CLAUDE.md:104-105`) |
| SCOWL 2020.12.07 (marks only) | SCOWL's notice | reproduced in the generated file (`scripts/build-pronunciation.mjs:32-40`) |
| Unicode confusables 18.0.0, CLDR 49, Unihan | Unicode License v3 | `src/lib/verse/confusables.ts:1-8`; `PROVENANCE.md` |
| Wiktionary-derived sound tables (kaikki.org, WikiPron), CC-CEDICT, JMdict/JMnedict | **CC BY-SA 4.0** (Wiktionary also GFDL) | the tables must stay CC BY-SA and the site must credit the sources; **"The site has no such credit yet. This is the owner's call before deployment"** (`docs/language/PHONETICS.md:536-541`); no credits page found in `src/pages` (grep) |
| mecab-ipadic (inside kuromoji) | NAIST licence | the notice must travel with the dictionary files (`PHONETICS.md:523,539-541`) |
| kuromoji 0.1.2 | Apache-2.0 | `PHONETICS.md:522` |
| stopwords-iso 1.1.0 | MIT | `src/lib/verse/function-words/de.ts:3-5` |
| Snowball stemmers (jsstemmer 3.2.0) | BSD 3-clause | `src/lib/verse/stem/index.ts:4-6` |
| Wikidata labels | CC0 1.0 | `PROVENANCE.md` |
| Wikisource quotations | texts public domain; transcriptions CC BY-SA 4.0 | `PHONETICS.md:526` |
| AOSP, Mozilla, Apple, Google strings | Apache 2.0, MPL 2.0, quoted sentences as evidence | used to choose words; the fetched evidence stays in `docs/language/sources/` (`PROVENANCE.md`) |

### 11.3 Fonts, art, audio, 3D

| Asset | Origin and licence as recorded |
|---|---|
| Fonts: Inter, Space Grotesk, Playfair Display, Outfit, JetBrains Mono (woff2, Latin and Latin-ext) | "Self-hosted Google Fonts" (`public/fonts/fonts.css:1`); no licence file in `public/fonts` (ls). These families are normally SIL OFL 1.1; the repository does not record it |
| 71 card paintings | FLUX 3 Image Klein (FLUX Kommunity License) through mflux 0.24, 2026-11-16; prompts from `scripts/art/build_prompts.py`; known imperfections listed (`docs/CARD-ART.md:1-13`) |
| City variant images (`public/images/variants`, 16 MB) | made from the earlier artwork (`docs/CARD-ART.md:13`); the generator script calls Z-Image Turbo through a Hugging Face Space (`scripts/generate-variant-art.ts:1-12`); licence not recorded |
| Music (4 MP3) and effects (14 WAV) | provenance not recorded (grep); files date from the initial commit, 2026-02-13 (`git log -- public/audio`) |
| `public/models/sm-001.glb`, `splats/sm-001.ply` | provenance not recorded |
| Kandinsky, LTX or other video models | not used in this repository (grep) |

### 11.4 Libraries

- npm: 435 locked packages (`package-lock.json`): MIT 293, Apache-2.0 46, BSD-3-Clause 22, LGPL-3.0-or-later
  20, MPL-2.0 12, ISC 11, others permissive. The LGPL entries are sharp/libvips native binaries and the MPL ones
  lightningcss: build-time tools, not shipped to the browser.
- Runtime families: Astro, React, Tailwind, SimpleWebAuthn, onnxruntime-web, three (MIT); Babylon.js,
  Transformers.js, kokoro-js, model-viewer, kuromoji (Apache-2.0) (`package-lock.json`).
- `onnxruntime-web` is a nightly pre-release, 1.31.0-dev.20260914 (`package-lock.json`).
- Rust: 411 crates in `backend/Cargo.lock`; their licences were not audited here.
- Build-host tools (not shipped): LanguageTool (LGPL), Hunspell and LibreOffice dictionaries (GPL/LGPL/MPL
  mixes), espeak-ng (GPL-3.0; its output is test data) (`PROVENANCE.md`; `PHONETICS.md:519`).

---

## 12. Technical debt and open technical problems

Ordered roughly by risk to players, data or the company.

1. **The economy and progression trust the client.** Credits: any signed-in account can add up to 1,000 per
   call by naming the amount (`backend/src/credits/handlers.rs:87-95`); XP likewise
   (`backend/src/seasons/handlers.rs:114-131`); stats are raised to whatever the client says and feed the public
   leaderboard (`backend/src/stats/handlers.rs:75-89,144-175`); achievements are claimed by id
   (`stats/handlers.rs:231-266`); any card can be added (`backend/src/inventory/handlers.rs:71-90`) or
   "migrated" (`backend/src/migration/handlers.rs:102-140`), which also lets an account field any character
   online (`CLAUDE.md:159-162` says so). Only the rate limit bounds it.
2. **Marketplace purchase is free and duplicates the card**: no credits move and the seller keeps the card
   (`backend/src/marketplace/handlers.rs:213-281`).
3. **Tournament results are self-reported**: either participant names either player the winner
   (`backend/src/tournaments/handlers.rs:296-330`); the scheduler takes the room manager and never uses it
   (`backend/src/tournaments/scheduler.rs:19`); a non-null `battle_room_id` points at `battle_rooms`, which
   nothing writes (`006_tournaments.sql:32`; `tournaments/handlers.rs:60,344`), so it would likely fail the
   foreign key (not run).
4. **Gemma's judging fell to 4 languages** under the integration's compare wording, with injection wins in 11;
   main's wording measured 14 passing; undecided (`docs/language/MODEL-EVAL.md:73-131`).
5. **Phones, tablets and headsets get no model**: the lite tier is used in no language, so `modelsToOffer`
   returns nothing for a handheld (`src/lib/brain.ts:76-82,142-164`). `docs/language/JUDGE-INJECTION.md:3` still
   calls LFM2.5 the model of "every phone and tablet". LFM3 is offered on desktops for Vietnamese judging alone
   (`brain.ts:69-75`).
6. **Half the evaluation matrix is open**: 30 of 96 cells unmeasured, one run per cell, one machine
   (`docs/language/MODEL-EVAL.md:16,1050-1058,1107-1109`); the judge test pairs do not test ranking two decent
   verses (`MODEL-EVAL.md:1070-1074`).
7. **Model weights are unpinned** (no `revision`: `src/lib/brain.ts:199-215`, `src/lib/ear.ts:35-41`,
   `src/lib/thespian-voice.ts:31-34`).
8. **CC BY-SA attribution is missing from the site** for the shipped Wiktionary, CC-CEDICT and JMdict-derived
   tables (`docs/language/PHONETICS.md:536-541`; grep of `src/pages`).
9. **No native-speaker review in any language** (§6.4); five languages have no grammar checker
   (`docs/language/QA-REPORT.md:9-31`).
10. **Email is off; legacy email-only accounts are locked out** until the email-service key is set
    (`backend/src/auth/email.rs:15-26`).
11. **No backups, monitoring or alerting recorded** (§10.4).
12. **No CSP**; the live origin's headers and Caddy configuration are outside site-ops; the proxy secret is not
    configured in any Caddy that can be read (§3.4, §3.5).
13. **The 30-day log promise is unverified for the API's own logs** (`src/pages/privacy.astro:131,153`).
14. **Deploy route ambiguity** with a possible asset-hashing breakage (§10.3).
15. **Single in-memory API**: a deploy or crash ends every live match; no horizontal scaling
    (`backend/src/main.rs:82-83`).
16. **No self-service account deletion**; manual deletion must work around foreign keys without cascade
    (`backend/src/auth/passkeys.rs:1068`; `src/pages/privacy.astro:149,192`). No tool reviews content reports
    (grep).
17. **Dead code and schema**: `battle_rooms`, `battle_turns`, `house_leaderboard`, `wallet_nonces`, NFT columns,
    `mp_*` columns, Google and password columns (§2.4); `scripts/create-merkle-tree.ts` imports Solana and
    Metaplex packages absent from `package.json` and names `src/lib/nft-mint.ts`, which does not exist
    (`scripts/create-merkle-tree.ts:1-12`); React integrated with no island (§1.1); eight analytics helpers
    never called (§9).
18. **Two model runtimes shipped**, one a nightly pre-release (§4.3, §11.4); about 90 MB of vendor files
    (`CLAUDE.md:621-622`).
19. **No in-game language check of model verse**; Gemma answers in English in 9/100 Italian, 6/100 French,
    4/100 Polish plays (`docs/language/MODEL-EVAL.md:1092-1101`). Model-written English trivia is not
    fact-checked (`src/lib/content-gen.ts:165-175`).
20. **Server and browser Unicode versions differ** (16 vs 17); older browsers untested (`CLAUDE.md:147-151`).
21. **Schema/validation mismatch**: `owned_cards.card_id` is VARCHAR(16) (`001_initial.sql:16`) but the API
    accepts up to 20 characters (`backend/src/inventory/handlers.rs:76`); `source` is unchecked against
    VARCHAR(32) (`001_initial.sql:18`); either gives a 500, not a 400.
22. **No tests for the DB-backed economy handlers** (§7.1).
23. **Asset provenance gaps**: audio, 3D model and splat not recorded; card-art imperfections listed; variant art
    from the earlier set (§11.3).
24. **Small inconsistencies**: the policy names the cookie `im_token`, production uses `__Host-im_token`
    (`src/pages/privacy.astro:81`; `backend/src/config.rs:241-244`); Plausible counts the subdomain under
    `inspiredmile.com` (`src/layouts/BaseLayout.astro:85`); the referral reply promises "5 free packs" that the
    server does not grant (`backend/src/referral/handlers.rs:128-141`); a `findings.test.ts` case ran past
    vitest's 5 s limit on one merge (`docs/language/MODEL-EVAL.md:207-209`).
25. **Offline solo play untested** (§1.5); **the VR gallery imports the whole Babylon core** (§8).

---

## 13. What could not be determined from here

- Which commit is deployed now, and whether prod's `.env` sets the session-signing secret (main falls back to a public
  constant without it) or the cloud-model key (main's multiplayer judge calls the cloud model with it).
- Production data: number of accounts, whether any email-only accounts exist, applied migrations.
- The live origin's Caddy configuration and response headers; Cloudflare settings.
- Bundle and chunk sizes of the current build (not built here); real download times on real networks.
- Backups, monitoring, uptime, API log rotation: none recorded, so their absence is not proven.
- Which deploy route (rsync or `deploy.sh`) produced the live static build.
- Rust crate licences; the FLUX Kommunity License's conditions; the variant-art model's licence; origin and
  licence of the music, effects, GLB and splat.
- Whether the Plausible site for `inspiredmile.com` exists and what it records.
- Whether any Playwright spec exercises the marketplace, tournament and season flows end to end.
