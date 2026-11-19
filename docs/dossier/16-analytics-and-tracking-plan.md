# Sonnet Man: analytics and tracking plan

**Purpose:** what Sonnet Man collects today and what its privacy policy promises, and a proposed, self-hosted, privacy-first event plan with the KPIs it serves and how each is computed.

**Audience:** David Charlot (technical lead, data owner); Arrocito del Diablo (balance and card mechanics); Devon Glover (creative director, for what the numbers say about play); engineers; anyone reviewing privacy; investors for the KPI table.

**As of:** commit 0d6df6ef (`integrate/wave3`, 2026-11-18), plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance` (2026-11-19).

**Status:** Draft for the team, 2026-11-19.

**Related documents:** `05-systems-economy-and-balance.md`, `19-privacy-pack.md`, `25-live-ops-plan.md`, `12-technical-design.md`, `13-ai-design-and-system-cards.md` (judge agreement), `15-qa-and-test-plan.md` (playtests), `17-operations-runbook-and-launch-checklist.md` (logs and monitoring), `adr/0018-analytics-after-age-gate.md`, `src/pages/privacy.astro`, `research/sota-production-2026-11.md` §6 and §7.19; also `00-README.md` (index), `28-owner-decisions.md`.

---

## How to read this document

- **As built**: true at 0d6df6ef; cites `tech §n` (`sources/as-built-tech.md`), `design §n` or a `path:line`.
- **In this release**: decided 2026-11-19, on the named branch; not live.
- **Proposed**: this document's recommendation, citing `prod-research §n` (`research/sota-production-2026-11.md`) or `design-research §n` (`research/sota-design-2026-11.md`).

This is not legal advice; the consent rules summarise the dated research and need counsel's review.

Words used below:

- **Event:** one record that something happened ("Duel Started"), with properties.
- **KPI:** a number the team watches to decide something.
- **Cohort:** players grouped by the day or week they first played.
- **D1, D7, D28 retention:** the share of a cohort that plays again 1, 7 or 28 days after its first day.
- **Persistent identifier:** anything that recognises the same browser or person across visits (a cookie, an id in local storage, an account id).

---

## 1. Summary

1. **Today the studio sees page views and nothing else.** Plausible counts page views after the age gate; the eight event helpers in the code are never called; the server's statistics are client-reported (tech §9). Nobody can say how many duels are played, in which languages, or whether players come back.
2. **Hosted Plausible conflicts with the owner's "free and self-hosted only" rule** and adds a third company to the policy. **Proposed:** replace it with a self-hosted, cookieless stack (section 5).
3. **Proposed events never carry what a player writes or says,** no cookies, no stored IP, no identifier for anonymous players, and nothing at all for under-13 visitors (who are already blocked) (section 4).
4. **The KPIs that matter first:** time to the first verse, first-duel completion, model download acceptance and success, D1/D7/D28 retention, challenger win rate, win rate by card and language, and model-versus-rules judge agreement (section 7).

---

## 2. What is collected now (as built)

| Where | What | When | Source |
|---|---|---|---|
| Plausible (hosted at plausible.io) | page address including the query string, referrer, IP address and browser type as with any request, possibly window width; Plausible says it sets no cookies and stores no IP | every page, only after the age gate answer is `adult` or `teen-consented`; `data-domain="inspiredmile.com"` | `src/layouts/BaseLayout.astro:71-90`; `src/pages/privacy.astro:89-100` |
| Event helpers | `pack_opened`, `battle_started`, `battle_won`, `trivia_completed`, `challenge_completed`, `card_minted`, `sign_in`, `pageview` | **never**: nothing calls them | `src/lib/analytics.ts:11-42` |
| The game's database | accounts, passkeys, sessions; cards; stats counters; achievements; credits log; seasons; classrooms; referrals; marketplace; tournaments; reports | on use, for signed-in players | tech §2.4 |
| Stats counters | battle wins, highest score, trivia, challenges, packs | **client-reported** (raised to the client's numbers) as built; **in this release** (`fix/server-authority`) the leaderboard reads only server-judged matches | tech §2.2 |
| The API's log | errors when the level is unset; the template sets `info`; operator notices always; reports | always | tech §9 |
| The production web server's log | errors, client addresses masked to /16 (IPv4) and /32 (IPv6), rolled and deleted after 30 days | always | tech §9 |
| The live origin's web server | Not known (its configuration is outside the operations repository) | | tech §13 |
| Hugging Face | IP address, browser, referrer and model on each weight download | on model, microphone or voice use | `tests/third-party-allowlist.ts:52-60` |
| Cloudflare | IP address, pages, everything in transit | always | `src/pages/privacy.astro` |
| The browser's own storage | game state, age-gate result, preferences; never sent unless the player signs in | always | `src/lib/storage-backend.ts:1-8` |

**What is never collected (as built):** solo verses, recordings, transcripts and model output (`src/pages/privacy.astro:18-22`); online verses are held in memory for up to two minutes after a match and never written to the database or the log (ADR 0014). No product telemetry, crash reporting or performance beacon exists (tech §9).

---

## 3. What the privacy policy promises (as built), and where it does not match

The policy is `src/pages/privacy.astro` ("Last updated: November 16, 2026"). Its promises that bear on analytics:

| Promise | Holds? |
|---|---|
| Solo verses, voice and model output never leave the device | yes, tested (ADR 0001, 0016) |
| Analytics is not loaded before the age gate is passed or for under-13 visitors | yes, tested (ADR 0018) |
| Plausible receives the page address, referrer, IP and browser type, possibly window width; never what a player writes or says | yes, by design; the query string is sent, so no page may put personal data in an address |
| "What we see is totals" | yes in practice (page views only) |
| The authentication cookie is `im_token` | **no:** production uses `__Host-im_token` (tech §12 item 24) |
| Server logs are kept no more than 30 days | **unverified** for the API's own log files: their rotation is not recorded (tech §9) |
| Credits are "earned through gameplay" and tracked "to prevent abuse and ensure fair play" | **no** as built (client-reported); **in this release** server-authoritative (`fix/server-authority`) |
| Multiplayer verses are held up to two minutes after the battle | yes, enforced by a compile-time check (ADR 0014) |

**In this release** (`fix/compliance`, commit `2df321b1`): the policy now names `__Host-im_token` (and the emailed-code cookie `__Host-im_code`) and says Plausible records page views under `inspiredmile.com`, the domain the layout sends. It does not change the 30-day log promise, which stays unverified for the API's own logs. The credits sentence becomes true with `fix/server-authority`, which makes credits earned at fixed rates. The launch checklist (doc 17) lists what to confirm.

**Any proposal below that adds collection needs the policy changed in the same commit,** and a new third-party origin needs the allowlist test and the policy together (`CLAUDE.md:610-615`).

---

## 4. Principles (proposed)

1. **Never the verse, never the voice.** No event carries verse text, a transcript, audio, or model output. Lengths, counts and categories only (prod-research §7.19: "never the text").
2. **First party and self-hosted.** Events go to the game's own origin and are stored in the game's own Postgres or a self-hosted tool on the studio's servers. No third-party analytics service.
3. **No cookies; no identifier for anonymous players.** Retention is measured without a persistent identifier leaving the device (section 6.2).
4. **No IP address stored** with an event. The rate limiter sees it transiently, as today.
5. **Children:** nothing for under-13 visitors (already blocked by the gate). Teen sessions: the same aggregate events, no experiments. Classroom accounts: operational counters only, no per-student analytics, no experiments, no replay (prod-research §6 "For Sonnet Man").
6. **Never session replay or heatmaps** (prod-research §6.1–6.2: outside the French exemption; Umami's replay must stay off).
7. **One plan in the repository,** reviewed like code: each event's name, trigger, properties, KPI, privacy class, retention and lawful basis (prod-research §7.19).
8. **Retention:** raw events 90 days; daily aggregates kept; nothing keyed to a person.

---

## 5. Stack (proposed)

| Need | Choice | Why (research) |
|---|---|---|
| Game events, duel balance, judge agreement | **a first-party endpoint in the Rust API** (`POST /api/v1/events`, batched, rate-limited, no session needed) writing to one Postgres table, with a nightly SQL roll-up into daily aggregates | full-stack Rust preferred; no new service; the data sits beside the game's own; properties are game-specific |
| Page views, referrers, simple funnels (replacing hosted Plausible) | **Umami v3.5.0** (2026-11-12), MIT, "does not use any cookies", events, funnels, retention and cohorts; runs on the Postgres already in place (needs PostgreSQL 12.14+ and Node 20.19+) | prod-research §6.1; the alternative Plausible Community Edition v3.2.1 is AGPL-3.0 and lacks funnels |
| Errors in the browser and the API | **GlitchTip v7.0.0** (2026-11-09), MIT, Postgres 14+, about 512 MB of RAM; fed by `@sentry/browser` 11.14.0 and the Rust `sentry` crate 0.49.6 (both MIT) | prod-research §6.1; Sentry self-hosted (16 to 32 GB RAM) and PostHog self-hosted are oversized |
| Feature flags and experiments (later) | OpenFeature (Apache-2.0) with a few rows in Postgres behind it; Evan Miller's sequential rule implemented in Rust | prod-research §6.1, §6.3 |

**Option, simpler still:** drop Umami and count page views in the Rust endpoint too. That removes Node from the stack at the cost of building referrer and funnel reports by hand. The team's call (section 10).

Moving the analytics script from plausible.io to the site's own origin removes a third party from the policy and from `tests/third-party-allowlist.ts`; both must change in the same commit.

---

## 6. Consent and retention without identifiers (proposed)

### 6.1 Consent by region

| Region | Rule (research) | Proposed setting |
|---|---|---|
| UK | PECR Schedule A1, in force 2026-02-05: storage and access for "statistical purposes" to improve the service without consent, with clear information and a simple, free way to object; the ICO accepts a default-on toggle the user can turn off; A/B tests and aggregate statistics likely covered, profiling and session recording not (prod-research §6.2) | a "Send anonymous play statistics" toggle, default on, in settings and the privacy page |
| EU / EEA | ePrivacy Art 5(3): EDPB Guidelines 2/2023 (final v2.0, 2024-10-07) cover identifiers in localStorage and IndexedDB, not only cookies; the Omnibus exemption for first-party audience measurement is not law (prod-research §6.2) | events that read no stored value may run (page views, duel events with no cohort marker); the cohort marker (6.2) and any experiment only after an opt-in |
| France | CNIL's exemption: no user ids, IP truncated, data kept 25 months or less; heatmaps, session recording and A/B testing off (prod-research §6.2) | as EU; never A/B tests without consent |
| US | COPPA's internal-operations exception allows a persistent identifier alone for analysing and maintaining the service, never to profile or contact (prod-research §6.2); under-13 visitors are already blocked | default on, with the same toggle |
| Classroom accounts, any region | prod-research §6 "For Sonnet Man" | operational counters only; no cohort marker; no experiments |

How the game knows the region is a design choice: the edge already passes a country header to the server. **Not decided** (section 10).

### 6.2 Retention without an identifier

The browser already keeps game state locally. **Proposed:** it also keeps the date of the player's first duel and which retention events it has already sent. Then:

- on the player's first duel, `Duel Started` carries `first_duel: true` and `cohort_week` (the ISO week of that day);
- on the first visit that falls on day 1, day 7 or day 28 after the first duel, the browser sends `Return Visited` once, with `day_n` and `cohort_week`, and never again for that `day_n`;
- the server stores no identifier; D1 for a cohort week = the count of `Return Visited (day_n = 1)` for that week divided by the count of first duels that week.

Reading the stored first-duel date for statistics is storage access under the EDPB reading, so in the EU it runs only after opt-in (section 6.1). Signed-in players' retention can also be read from the server's own session rows by account (internal operations), with no new collection.

### 6.3 Retention schedule

| Data | Kept |
|---|---|
| Raw events (first-party table) | 90 days, then deleted by the maintenance task |
| Daily aggregates | while useful; they hold no identifier |
| Umami data (if used) | 13 months at most, IP never stored |
| GlitchTip error events | 30 days, matching the policy's log promise |
| API and web-server logs | 30 days (the policy's promise; the API log's rotation must be set up: doc 17) |

---

## 7. Event taxonomy (proposed)

Names follow "Noun + Past-Tense Verb" with one event and a property rather than near-duplicates (prod-research §7.19, Amplitude's playbook). Every event also carries: `locale`, `device_class` (desktop, phone, tablet, headset: already computed by the capability check), `app_version` (the commit), and a day timestamp (hour precision at most). "Client" events are sent by the page; "server" events are written by the API from its own state, never from a client's claim.

### 7.1 Funnel

| Event | Source | Trigger | Properties (type: allowed values) | KPI |
|---|---|---|---|---|
| `Page Viewed` | client (Umami or first-party) | each page load after the gate | `page` (path, no query string), `referrer_domain` (domain only), `first_visit` (bool, from local state; EU opt-in only) | traffic; landing to first verse |
| `Age Gate Passed` | client | gate answered adult or teen-consented (no event for under 13) | `tier`: adult, teen | gate drop-off |
| `Duel Started` | client | first round begins | `duel_lang` (16 codes), `surface`: battle, theatre; `opponent_kind`: written, model; `model_id`: none, gemma-4-e2b, lfm3-1.7b; `difficulty`: apprentice, player, master; `deck_kind`: starter, saved; `first_duel` (bool); `cohort_week` (first duel only; EU opt-in) | first-duel rate; language mix |
| `Verse Submitted` | client | the player submits a round's verse | `round` 1-3; `form_id` (12 ids); `input_mode`: typed, spoken, mixed; `lines` (int); `length_band`: 1-20, 21-60, 61-150, 151+ characters; `seconds_to_submit_band`: <30, 30-90, 90-180, 180+; `since_page_load_band` (first verse only): <5, 5-15, 15-60, 60+ s | time to first verse |
| `Duel Completed` | client | the match ends | `result`: win, loss; `rounds_won` 0-2; `duel_lang`; `opponent_kind`; `model_id`; `duration_band` | first-duel completion; session length |
| `Duel Abandoned` | client | the page is left mid-duel | `round_reached` 1-3 | drop-off by round |
| `Model Offered` | client | the model panel offers a model | `model_id`; `reason_none` when nothing is offered: no_webgpu, handheld, no_f16, low_memory | the phone gap's size |
| `Model Download Started` | client | the player presses Summon | `model_id` | offer acceptance |
| `Model Loaded` | client | the model is ready | `model_id`; `from_cache` (bool); `load_seconds_band`: <10, 10-60, 60-300, 300+ | load success; load time |
| `Model Load Failed` | client | the load fails | `model_id`; `reason`: out_of_memory, device_lost, network, other | failure by device class |
| `Microphone Answered` | client | the permission prompt resolves | `result`: granted, denied, dismissed | speech uptake |
| `Speech Transcribed` | client | Whisper returns text | `duel_lang`; `audio_seconds_band`; `edited_before_submit` (bool) | speech quality proxy |
| `Account Created` | server | a passkey or email sign-up finishes | `method`: passkey, email | account conversion |
| `Online Match Started` | server | a room's match starts | `queue_kind`: quick, private; `wait_seconds_band` | online uptake |
| `Online Match Completed` | server | `MatchComplete` | `result`: decided, draw; `rounds`; `disconnects` (int); `timeouts` (int) | online completion |
| `Online Match Abandoned` | server | a room closes unfinished | `reason`: opponent_absent, forfeit, timeout, restart | online drop-off |
| `PWA Installed` | client | the `appinstalled` event | none | install rate |

### 7.2 Duel balance

| Event | Source | Trigger | Properties | KPI |
|---|---|---|---|---|
| `Round Scored` | client (solo); server (online) | a round's verdict | `round`; `form_id`; `duel_lang`; `challenger`: player, opponent (who moved first); `winner`: player, opponent, draw (online); `form_kept`: full, partial, none (each side); `craft_band` (each side); `judge_kind`: rules, gemma-4-e2b, lfm3-1.7b, lfm2.5-350m; `criteria` {wordplay, allusion, flow, wit}: player, opponent, split; `void` (bool each side); `copy_forfeit` (bool); `player_card`, `opponent_card` (card ids); `relic`, `potion`, `curse` (ids or none); `signature_landed`, `house_device_landed` (bool each side); `opponent_kind`; `difficulty` | challenger win rate; win rate by card, form, language, judge, difficulty |

Solo rounds are scored in the browser, so solo balance numbers describe what players saw, not a server-verified result; that is fine for balance and never used for rewards (ADR 0021).

### 7.3 Judge agreement

| Event | Source | Trigger | Properties | KPI |
|---|---|---|---|---|
| `Round Scored` (as above), plus `rules_criteria` | client | a model-judged round | the rule judge's verdict on each criterion, computed in the browser alongside the model's (the rule judge is cheap and deterministic) | model–rules agreement |
| `Verdict Disputed` | client | a new "I disagree" control on the verdict (proposed UI) | `round`; `judge_kind`; `criterion` (optional) | dispute rate |
| `Judge Lines Unread` | client | the grade path leaves lines out | `count` | injection attempts (grade path) |

### 7.4 Quality

| Event | Source | KPI |
|---|---|---|
| `Error Occurred` → GlitchTip | client and API | errors per 1,000 page views; per 1,000 requests |
| `Online Round Disagreed` | client, when `auditRound` disagrees with the server | parity in the field (should be 0) |
| `Verse Refused` | server, `unknown_character` and other refusals | Unicode gap in the field |

### 7.5 Economy (server only, in this release)

Credits earned and spent, cards granted, listings purchased and referrals redeemed are already rows in the database; **in this release** (`fix/server-authority`) they come from the server's own events. No client event is needed: the KPIs below read those tables. The economy design is in `docs/ECONOMY.md` on that branch.

---

## 8. KPIs and how each is computed (proposed)

Benchmarks are from the dated research; they are context, not targets the team has agreed.

### 8.1 Funnel

| KPI | Definition | Formula | Benchmark |
|---|---|---|---|
| Time to first verse | median seconds from page load to the first submitted verse of a first duel | median of `since_page_load_band` midpoints over `Verse Submitted` where `first_duel` and `round = 1` | players leave after 10 s on Poki; conversion rose from 50% to 72% when median load fell from 29.5 s to 3.7 s (prod-research §2.2; design-research finding 2) |
| Landing to first verse | share of first visits that submit a first verse | `Verse Submitted (first_duel, round 1)` ÷ `Page Viewed (first_visit, page in {/, /battle})` | none found for this genre |
| First-duel completion | share of first duels finished | `Duel Completed (first)` ÷ `Duel Started (first_duel)` | |
| Model offer acceptance | share of offers that start a download | `Model Download Started` ÷ `Model Offered (model_id ≠ none)` | |
| Model load success | share of downloads that load | `Model Loaded` ÷ `Model Download Started`, by `device_class` and `model_id` | |
| Phone gap | share of duels with nothing offered, by reason | `Model Offered (none)` by `reason_none` ÷ all `Model Offered` | |
| Speech share | share of verses spoken | `Verse Submitted (spoken or mixed)` ÷ all, by language | |
| Speech fix rate | share of transcripts edited before submitting | `Speech Transcribed (edited_before_submit)` ÷ all, by language | a proxy for recognition quality where nothing else is measured |
| Account conversion | accounts per completed first duel | `Account Created` ÷ `Duel Completed (first)` | |

### 8.2 Retention and engagement

| KPI | Formula | Benchmark (research) |
|---|---|---|
| D1, D7, D28 | per `cohort_week`: `Return Visited (day_n)` ÷ first duels that week | card games D1 18.2–19.4%, D7 6.5–7.1%, D28 2.9–3.2%; word games D1 17.6–19.7%, D7 3.8–4.7%, D28 1.0–1.3% (GameAnalytics 2025 edition); CrazyGames calls web D1 of 10–15% "strong" (prod-research §6.3) |
| Session length | median duration of a day's activity per client, from `Duel Started` to the last event, from aggregates | mobile median 3.1–3.5 minutes; Poki's fit test needs over 3 minutes, successful games 5+ (prod-research §6.3) |
| Duels per active day | `Duel Completed` ÷ days with any duel, per cohort | |
| Language mix | `Duel Started` by `duel_lang` and by `locale` | guides the review order (doc 14 §12.3) |

### 8.3 Duel balance

| KPI | Formula | Flag |
|---|---|---|
| Challenger win rate | rounds won by the side that moved first ÷ rounds, by language, form and judge | outside 45%–55% (prod-research §6.3; chess's first-move advantage is 52%–56% for reference) |
| Win rate against the written opponent | `Duel Completed (win, written)` ÷ `Duel Completed (written)`, by language and difficulty | the target band is Arrocito del Diablo's call; note difficulty changes nothing against the written opponent as built (design §1.6) |
| Win rate against the model | same, `opponent_kind = model`, by language and difficulty | drift from the agreed band |
| Card win rate | rounds won when a card is played ÷ rounds it is played, both sides | proposed review threshold: more than 10 points from the mean (a starting value, no external source) |
| Form keep rate | `form_kept = full` ÷ rounds, by form and language | a form players almost never keep is too hard or mis-checked |
| Void and copy rate | `void` or `copy_forfeit` ÷ rounds, by language | spikes point to rules or language data |
| Wit split rate | `wit = split` ÷ rounds, by opponent kind | as built, wit is always split against the written opponent (design §1.7) |

### 8.4 Judge agreement

| KPI | Formula | Use |
|---|---|---|
| Model–rules agreement | for model-judged rounds, criteria where the model's verdict equals the rules' verdict ÷ criteria the rules did not split, by language and model | a fall in one language after a release, or after a hub change (weights are unpinned: doc 12 §4.3), points at the model |
| Split rate | split criteria ÷ criteria, by judge kind and language | a judge that splits everything decides nothing |
| Verdict-score distribution | the distribution of judge points per round, by language and judge | a weak language shows as a skewed distribution before it shows as complaints (prod-research §6 "For Sonnet Man") |
| Dispute rate | `Verdict Disputed` ÷ `Round Scored`, by judge kind and language | perceived fairness; compare rules against model |
| Unread-line rate | `Judge Lines Unread` ÷ grade-path rounds | injection attempts (only if a grade-path model ships) |

### 8.5 Quality and operations

| KPI | Formula | Flag |
|---|---|---|
| Client error rate | GlitchTip events ÷ 1,000 page views, by page and browser | any new error class after a deploy |
| API error rate | 5xx ÷ 1,000 requests (from the API) | above 1 |
| Field parity | `Online Round Disagreed` count | any |
| Online completion | `Online Match Completed` ÷ `Online Match Started` | |
| Model load failures | `Model Load Failed` ÷ `Model Download Started`, by device class and reason | out-of-memory concentration in a device class |

---

## 9. Dashboards, cadence and ownership (proposed)

| View | Audience | Cadence | Owner |
|---|---|---|---|
| Funnel and retention (sections 8.1, 8.2) | the team, investors | weekly | David Charlot |
| Balance (8.3) | Arrocito del Diablo | weekly during playtests; per season after | Arrocito del Diablo |
| Judge agreement (8.4) | David Charlot | after every release and every model change | David Charlot |
| Quality (8.5) | David Charlot | daily after a deploy | David Charlot |

**Experiments (later):** two arms; a pre-registered sample size from a power analysis; Evan Miller's sequential rule (stop when T − C ≥ 2√N; stop with no winner when T + C = N). At launch-scale traffic expect a minimum detectable effect around 30%, so test only big changes such as the first-match flow (prod-research §6.3). Never for classroom or teen sessions; never in the EU without consent.

---

## 10. Implementation plan (proposed)

1. **Write the tracking plan as a file** (for example `docs/analytics/tracking-plan.yaml`): each event, its properties with types and allowed values, KPI, privacy class, retention and lawful basis; generate the TypeScript sender and the Rust receiver's types from it (prod-research §7.19).
2. **Build the first-party endpoint** in the API: batched, size-limited, rate-limited, refusing unknown events and unknown property values; one table; a nightly roll-up; deletion after 90 days in the maintenance task.
3. **Wire the client events** through one function that does nothing for under-13, classroom and opted-out sessions, and nothing in EU sessions for opt-in-only events.
4. **Replace hosted Plausible** with Umami (or the endpoint alone): change the allowlist test and the policy in the same commit.
5. **Add GlitchTip** for errors, with personal data scrubbed (no request bodies; no verse).
6. **Add the statistics toggle** in settings and the policy's description of it.
7. **Build the four views** of section 9 as SQL queries first; a dashboard only when the queries settle.

---

## 11. Owner questions

1. Replace hosted Plausible now? Does the Plausible account exist, and is it paid (tech §13)?
2. Umami plus a Rust endpoint, or the Rust endpoint alone?
3. Default the statistics toggle on outside the EU, and opt-in inside it? How should the game decide the region?
4. Add a "dispute the verdict" control to the verdict screen (it changes the design, so Arrocito del Diablo and Devon Glover should see it)?
5. What win-rate bands should the duel aim for against the written opponent and the model, per difficulty (Arrocito del Diablo)?
6. Which numbers may be shown to investors, and at what cadence?
7. `fix/compliance` corrects the cookie name and the Plausible domain (section 3). Should the 30-day log promise be changed now, or kept and met by setting API log rotation before deploy?
