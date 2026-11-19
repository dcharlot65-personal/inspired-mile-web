# Sonnet Man: QA and test plan

**Purpose:** what is tested, what each suite guards, the gates a build must pass before it is deployed, the independent-checker method the project uses, the devices and browsers covered and never covered, and the gaps to close.

**Audience:** David Charlot (technical lead); engineers, testers and coding agents; Arrocito del Diablo for balance and playtest items; investors for the summary.

**As of:** commit 0d6df6ef (`integrate/wave3`, 2026-11-18), plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance` (2026-11-19).

**Status:** Draft for the team, 2026-11-19.

**Related documents:** `11-accessibility-plan-and-statement.md`, `12-technical-design.md`, `13-ai-design-and-system-cards.md`, `14-localisation-kit.md`, `16-analytics-and-tracking-plan.md`, `22-risk-register.md`, `17-operations-runbook-and-launch-checklist.md` (internal: the commands with real hosts), `adr/0019-build-host-no-github-actions.md`, and in the repository `CLAUDE.md` ("Build and test"), `docs/language/MODEL-EVAL.md`, `docs/language/RULES-MEASUREMENTS.md`, `docs/language/QA-REPORT.md`; also `00-README.md` (index), `28-owner-decisions.md`, `29-postmortem-and-incident-templates.md`.

---

## How to read this document

- **As built**: true at 0d6df6ef; cites `tech §n` (`sources/as-built-tech.md`), `design §n` (`sources/as-built-design.md`) or a `path:line`. Test counts are static counts of `it(`, `test(` and `#[test]` call sites; loops produce more at run time (tech §7).
- **In this release**: decided 2026-11-19, on the named branch; not live.
- **Proposed**: this document's recommendation, citing `prod-research §n` (`research/sota-production-2026-11.md`) or `design-research §n`.

Words used below:

- **Unit test:** a fast test of one function, no browser (vitest, cargo).
- **End-to-end (e2e) test:** a real browser drives the real pages against a real API and database (Playwright).
- **Golden vectors:** stored answers of one implementation that another must reproduce (ADR 0012).
- **Mutation test:** deliberately break the thing a test guards and check that the test turns red.
- **Probe:** a small program written by a checker to break a claim.

**Project rule:** builds and tests never run on the development laptop; they run on a shared build host through a remote-build wrapper (ADR 0019). No GitHub Actions; "CI is the build host" (`CLAUDE.md:600`).

---

## 1. Summary

1. **About 1,100 automated tests** in six suites: 598 vitest, 281 Playwright, 13 real-model, 2 byte-cost, the production smoke suite, 192 cargo (tech §7.1).
2. **The project tests its tests.** Nine mutation scripts break what the tests guard and count the catches (65 of 65, 77 of 77, 16 of 16 in recorded runs), and independent checkers' probes become checked-in tests that were seen to fail first (section 5).
3. **Coverage is deep where the rules, languages, sign-in and privacy promises are,** and absent where the economy is: no test covers inventory, credits, marketplace, tournaments, seasons, classroom, referral, migration, variants or stats handlers (tech §7.1). **In this release** `fix/server-authority` rewrites those handlers and adds 11 Rust unit tests for the pure parts (economy 8, ledger 1, bracket 1, tournament progress 1); no test of the database-backed handlers themselves is on the branch.
4. **Everything runs in one browser engine on one kind of machine:** headless Chromium on Apple Silicon. Safari, Firefox, every real phone and every headset have never run the suites (section 6).
5. **The gates are run by hand** and nothing records that they passed before a deploy. **Proposed:** one gate script that writes a dated result file (section 4.3).
6. **No one outside the team has played the game, human or AI.** Under the owner's rule of 2026-11-19, "AI is the playtester", the playtesters are AI players that see only the page and use only a player's controls, run on the build host. **Proposed:** section 8.

---

## 2. What quality means here (scope and risks)

| Quality | Risk if it fails | Primary guards |
|---|---|---|
| A verse is scored correctly, the same every time | unfair duels; trust lost | vitest verse engine (251 tests); review and measurement tests; pack mutations |
| The online score equals the preview | a player sees one score and gets another | golden vectors + `verse_parity.rs` (about 35,000 cases); `auditRound` |
| A model is used only where measured | bad verse or verdicts in a language | `model-eval*.test.ts`; `mutate-gates.mjs` |
| The judge cannot be talked into a verdict | injected verses win | grade-path tests, real-model injection specs, set I pairs |
| Privacy promises hold | broken policy, legal exposure | `third-party.spec.ts`; `privacy-retention.test.ts`; service-worker tests |
| Sign-in is safe and available | lock-out, account takeover | `auth.spec.ts` (101 tests); config refusals; limit and race tests |
| Every language reads correctly | public ridicule per language (design-research §8) | i18n, quality and glossary tests; tool QA; **no human review yet** |
| The economy is honest | cheating; consumer-law problems | **none as built**; `fix/server-authority` |
| The site loads fast enough to play | players leave before the first verse | `battle-bytes.spec.ts` (what is not fetched); no byte ceiling |
| The site is accessible | excluded players; school procurement | **no automated accessibility test** (design §8) |

---

## 3. The suites (as built)

### 3.1 Inventory

| Suite | Files | Cases | Guards | Runs with |
|---|---|---|---|---|
| vitest (pure logic) | 36 `src/**/*.test.ts` | 598: verse engine 251 (`verse.test` 55, `findings` 60, `review`–`review5` 89, sound 38…); i18n 122; card text 85; model evaluation and brain 55; PWA and service worker 48; multiplayer client and golden 19; other 18 | rules and every threshold (each set from a recorded measurement); language QA; measured model lists; golden freshness; cache rules; the policy's retention words | `npx vitest run` |
| Playwright (browser) | 20 `tests/*.spec.ts` | 281: `auth` 101, `v2-world-cards` 22, `duel` 19, `pwa` 18, `v1-flows` 18, `pages-rest` 17, `multiplayer` 12, `pages-i18n` 11, `card-text` 10, `third-party` 9, `theatre` 9, `i18n` 9, others | sign-in end to end against a throwaway Postgres and two real APIs (email on and off); every page's third-party requests; i18n layout and line breaks; multiplayer; Theatre; PWA | `npx playwright test` (starts Postgres, two APIs, the dev server and a no-email proxy itself) |
| Real models | 7 `tests/model/*.spec.ts` | 13: duel, grade injection, hide, unread lines, compare wording, opponent prompt, ear | Gemma, LFM3, LFM2.5 and Whisper on WebGPU in a real browser; downloads up to 3 GB | `TIERS=lite,standard,grand npx playwright test -c playwright.model.config.ts` |
| Byte cost | `tests/battle-ja-cost.spec.ts` | 2 | what a Japanese duel fetches on a throttled link | against a built site |
| Production smoke | `tests/prod-smoke.spec.ts` | one test per page, 18 pages | page errors, failed same-origin requests, broken images on the live site | `PROD_URL=https://sonnetman.inspiredmile.com npx playwright test` |
| cargo | 24 files in `backend/src` + `backend/tests/verse_parity.rs` | 184 in src (game room 29, config 20, email code 18, client address 15, text 14, duel 11…) + 8 parity | the room state machine with paused time; configuration refusals; limits; the verse port | `cd backend && cargo test --release` |
| Mutation and probe scripts | `mutate-packs.mjs`, `mutate-pages.mjs`, `mutate-i18n-browser.mjs`, `sound/mutate-sound.mjs`, `model-eval/mutate-gates.mjs`, `mutate-picker.mjs`, `mutate.mjs`, `lang-content/mutate-play.mjs`, `pages-rest/mutate.mjs` | n/a | that the suites above go red when the thing they guard is broken | build host |
| Language tools | `scripts/lang/run.sh`, `scripts/language/check/run.sh`, `scripts/pages-rest/lang-host.sh` | n/a | grammar, spelling, meaning by back-translation, second-model review | build host |

Source: tech §7.1.

### 3.2 What the less obvious tests guard

- **`review.test.ts` to `review5.test.ts`** print the measurements each threshold in `duel.ts` and `text.ts` was set from (copy thresholds, the share of known words, what counts as a word), and assert them, with checkers' probes as tests; a run is recorded in `docs/language/RULES-MEASUREMENTS.md` (`CLAUDE.md:54-59`).
- **`judge-accuracy.test.ts`** holds the rule judge to main's accuracy on labelled pairs in all 16 languages (`judge-accuracy.test.ts:79-91`).
- **`model-eval.test.ts`** fails when `brain.ts`'s language lists drift from the measured decisions; **`model-eval.judge.test.ts`** fails when the judge's prompts differ from each cell's fingerprint, and re-derives every stored verdict from its raw reading; "every writing cell replays…" re-runs the game's code over each stored draft (`CLAUDE.md:500-535`).
- **`multiplayer-golden.test.ts`** fails while the golden files are stale (`CLAUDE.md:123-131`).
- **`privacy-retention.test.ts`** holds the privacy policy's words to the server's retention constant; a compile-time assertion in `game_room.rs` holds the constant to the timers (ADR 0014).
- **`api-errors.test.ts`** reads `backend/src` and fails when a handler gains an answer without a code and 16 sentences.
- **`third-party.spec.ts`** loads every page in three age-gate states and fails on any unlisted origin (ADR 0016).
- **`battle-bytes.spec.ts`** asserts that the pronunciation table, sound tables and Japanese analyser are not fetched on a first load.
- **`english-pages-rtl.spec.ts`** keeps the English-only pages left to right on an Arabic page.

### 3.3 Test infrastructure rules (as built)

- **No server is reused.** Each run takes its own ports (4399, 38490, 38491, 54329 by default, movable by `E2E_*` variables). Before 2026-11-16 two concurrent runs could test each other's code and pass (`CLAUDE.md:228-233`).
- **Never `pkill -f 'astro dev'`** on the host: it stops every checkout's dev server (`CLAUDE.md:235-238`).
- **One run per checkout at a time** (`CLAUDE.md:219-220`).
- **A warm-up opens every page before the tests start,** so the dev server's cold compile is not inside any test's 30 s (`CLAUDE.md:632-634`).
- **The age gate:** tests start past it through stored state; the third-party spec tests all three states.
- **Stand-in models** (`tests/stand-in-model.ts`) let page tests run without downloads; `E2E_NO_DOWNLOADS=1` skips the two runtime tests that fetch Whisper and Kokoro.

---

## 4. Gates before a deploy

### 4.1 As documented (as built, `CLAUDE.md:205-215`; tech §7.2)

| # | Gate | When |
|---|---|---|
| 1 | `npm ci && npx vitest run && npm run build && npx playwright test` on the build host | every deploy |
| 2 | `cd backend && cargo test --release && cargo build --release` | every deploy; after any change to `src/lib/verse/`, `cards.ts` or `multiplayer-rules.ts`, regenerate the golden files first (`scripts/gen-verse-golden.sh`) |
| 3 | The real-model suite | when the model path changes (prompts, `brain.ts`, `judge.ts`, `referee.ts`, `session.ts`) |
| 4 | Language checks (`scripts/lang/run.sh grammar`, `meaning`) | after any string change |
| 5 | `scripts/check-api-build.sh` (clean-copy build, `--locked`) | every API deploy |
| 6 | `scripts/check-migrations.sh <new migrations> -d <database>` on production (database name in 17) | before swapping the binary |
| 7 | Production smoke suite; the trusted-proxy line in the API log; optionally `scripts/prod-passkey-check.mjs` (creates one account to delete) | after the deploy |

### 4.2 Additional gates for this release (in this release, by branch)

| Branch | Gate |
|---|---|
| `fix/judge-wording` | the 32 set-aside compare cells measured again; `analyze.mjs` and `copy-lists.mjs` run; `model-eval*.test.ts` green; the judging lists in `brain.ts` follow the new cells |
| `fix/server-authority` | cargo tests for every economy handler it changes (section 7.1); an e2e purchase between two accounts; migration check for any new migration |
| `fix/voice-g2p` | `scripts/check-no-espeak.mjs` passes inside `npm run build` (on the branch); `g2p-en.test.ts` and `no-espeak.test.ts` green; `tests/voice.spec.ts` (Kokoro speaks, Whisper hears it back) green; `scripts/voice/mutate-voice.mjs` turns the unit tests red 25 times out of 25; a person listens to the 200-word list |
| `fix/compliance` | the `/credits` page reachable and in the third-party test's page list; the Article 50(1) notice visible before the first model verse or verdict, in all 16 languages (the i18n tests); the privacy wording held by `privacy-retention.test.ts` where it names retention |

### 4.3 Proposed: one gate script and exit criteria

**One script** (for example `scripts/gate.sh`) that runs gates 1, 2 and 5 in order on the build host, runs gate 3 when files on the model path changed since the last tag, and writes `docs/releases/<date>-<commit>.json` with each gate's exit code, duration and counts. The deploy checklist cites the file (doc 17). This keeps the owner's "land it, don't gate it" model (CI on the build host, fixed forward) while giving each deploy a record.

**Exit criteria for a deploy:**

- every gate green on the commit being deployed (not a neighbour);
- golden files fresh (vitest would fail otherwise);
- no new third-party origin without a policy change in the same commit;
- the migration check exits 0 on production;
- after the deploy: the smoke suite green, the trusted-proxy line names the real proxy, `/api/v1/health` answers "ok".

---

## 5. The independent-checker method

### 5.1 What the project does (as built, from commits and docs)

The work is done on branches by coding agents. Before a branch merges, **an independent checker** (another agent, working from the branch and the claims made for it rather than the builder's notes) reviews it and tries to break it. The record shows the pattern repeatedly:

1. **The checker writes findings** as *blockers* and *concerns*, numbered, and **probes** that demonstrate them (for example "the checker's three blockers and its concerns, measured", commit 39fea74a, 2026-11-16; "REVIEW-A" to "REVIEW-D", commit 3e713c07).
2. **The builder fixes the blockers and turns each probe into a checked-in test,** often with its verdict turned round so the test asserts the fixed behaviour ("the review's probes as checked-in tests, and race tests that can fail", 3e713c07; "the second check's probes as tests", 89822d42).
3. **Every new test is shown to fail first:** against main, or with its fix reverted. "Both fail on main and each fails with its defence removed" (8de85ef4); "Each of these was seen to fail with the corresponding fix reverted" (3b7f47cc). A race test is run against an API that pauses between check and write, with a timing check that the pause was really there (3e713c07).
4. **Mutation scripts prove the suite catches defects** and are run again after each merge: 49 of 49, then 65 of 65, then 77 of 77 for the page strings (`docs/language/pages-rest.md`); 14, then 16 of 16 for the model-evaluation gates (`docs/language/MODEL-EVAL.md:280-310`).
5. **A second checker** reviews again after the fixes, and its findings become further mutations ("twelve mutations added for the second checker's findings and the merge", `pages-rest.md`).
6. **Thresholds are committed before the measurement they decide** ("so the bar cannot follow the results", commit 8e926043), and each threshold in the engine is printed from, and asserted against, its recorded measurement (`CLAUDE.md:54-59`).

### 5.2 What it has caught

| Found by a checker | What it was | Source |
|---|---|---|
| The model-evaluation fingerprint covered the prompts but not how answers are read: `SPLIT_BELOW` moved from 0.1 to 0.2 and every test stayed green | a harness gap; fixed by storing raw readings and re-deriving verdicts | `MODEL-EVAL.md:280-285` |
| A test's expected text was not found because vitest shortened an array and escaped quotation marks | a harness bug: tests that could not fail | `pages-rest.md` |
| Concurrent runs tested each other's servers and passed | test infrastructure | `CLAUDE.md:232-233` |
| A full challenge table refused every visitor; one IPv6 /48 split into 200 /64s could stop all passkey sign-in in nine seconds | denial of service | `passkeys.rs:11-16` |
| A quick-match request whose client had gone kept its place and paired the next player with nobody | online play | `request_task.rs:18-24` |
| Six card-name evidence lines named somebody else; then an audit found 48 that broke a rule | language data | `CONTENT-PROVENANCE.md` |
| Hiding judge-addressing lines on the compare path let a digit in every line empty a verse, which LFM3 preferred | judge security | `JUDGE-INJECTION.md:39-46` |
| A failed LFM3 load silently fetched LFM2.5 and claimed it was running | model loading | `MODEL-EVAL.md:159-162` |

**The lesson the record supports:** on this project the harness has been wrong about as often as the code. A test that has never been seen to fail is not yet evidence.

### 5.3 Proposed: make the method a written procedure

- A **check request** template: the branch, the claims to break, what is out of scope, the commands to run on the build host.
- A **finding** template: id, blocker or concern, the probe (code), the expected and observed behaviour.
- A **closing record** per branch: each finding's fix commit, the test that now holds it, and the evidence that the test failed before the fix.
- **Keep checkers independent:** a checker does not read the builder's working notes, only the branch, its claims and the repository docs.
- **Add a human checker** for what agents cannot judge: native language (doc 14 §12), feel and fairness of play (section 8), accessibility with assistive technology (section 7.4).

---

## 6. Devices and browsers

### 6.1 What was tested (as built)

| Environment | Used by | Source |
|---|---|---|
| Headless Chromium (Playwright's default), desktop viewport, on the Apple Silicon build hosts | all 281 browser tests | `playwright.config.ts` (no other browser project) |
| The same, at phone width (390 px) with touch flags | a few specs (`pages-rest`, `play-i18n`, `pwa`, `v2-world-cards`, `pages-i18n`) | grep of `tests/` |
| Emulated throttled phone: Fast 4G (9 Mbit/s down, 60 ms) and a 4× slower CPU, service workers blocked | `battle-ja-cost.spec.ts` | `battle-ja-cost.spec.ts:4-25` |
| Headless Chromium with `--enable-unsafe-webgpu` and Metal, on one build machine | every real-model test and every model-evaluation cell | `playwright.model.config.ts:21-22`; `MODEL-EVAL.md:211-215` |
| WebXR under emulation (`iwer`) | Theatre and VR gallery tests | `CLAUDE.md:604` |
| A virtual authenticator holding three passkeys | sign-in tests | commit ee2956f8 |
| The live site in headless Chromium | production smoke | `tests/prod-smoke.spec.ts` |

### 6.2 What was never tested (as built)

- **Safari** on macOS, iOS or iPadOS, in any form; the WebKit engine is not a Playwright project here. iOS is the hardest memory limit (a tab is killed near 2 GB) and the one the research names as the riskiest target (tech §4.4).
- **Firefox** on any platform (the research cites about 1 against 52 tokens a second for one WebGPU engine: tech §4.4).
- **Edge, Samsung Internet, Opera**, and **Android in-app browsers** (Instagram, TikTok, Facebook), where WebGPU support is unresolved (prod-research §2.4).
- **Any real phone, tablet or headset** (Quest, Vision Pro): no record of a real-device run.
- **Any GPU but Apple's** (no Windows or Linux desktop GPU), and **any low-memory device** for the model path.
- **Offline solo play** (no test takes the browser offline and plays a duel: tech §1.5).
- **Browsers with Unicode tables older than the server's** (an old Safari) for online verses (tech §5).
- **A real microphone**, and speech in any language but English (design §8).
- **Screen readers** and keyboard-only play (design §8).
- **Real networks** (download times were never measured: tech §8).

### 6.3 Proposed device and browser matrix

Priority P0 before claiming mobile support; P1 before a public launch push; P2 when the feature ships.

| Pri | Device class | Browser | Paths to cover | How |
|---|---|---|---|---|
| P0 | iPhone (a recent and a 4 GB-class model) | Safari (iOS 26+) | no-model duel in en, ar, ja, zh, th; microphone (Whisper on WASM); install to Home Screen; offline page | real devices, cabled, driven from the build host |
| P0 | Mid-range Android (Adreno or Mali GPU) | Chrome | no-model duel; microphone; install; WebGPU detection (must offer nothing) | real device |
| P0 | Desktop macOS | Safari 26 | the model path (WebGPU in Safari 26), the Theatre | Playwright WebKit project + manual |
| P0 | Desktop Windows with a discrete or integrated GPU | Chrome, Edge | the model path; download, resume, `persist()` | a Windows machine |
| P1 | Samsung Galaxy with Exynos (Xclipse) | Samsung Internet, Chrome | WebGPU "TBD" per the research: must fall back cleanly | real device |
| P1 | Android | Instagram and TikTok in-app browsers | sign-in (passkeys), "open in your browser" guidance | real device |
| P1 | Desktop | Firefox (Windows, macOS) | no-model duel; model path if WebGPU reports | Playwright Firefox project |
| P1 | iPad | Safari | layout, Theatre | real device |
| P2 | Meta Quest 3 | Quest Browser | Theatre in passthrough and VR | real device |
| P2 | Apple Vision Pro | Safari (visionOS) | Theatre in VR | real device |
| P2 | Low-end Android (3 to 4 GB) | Chrome | first load and first duel within budget (doc 12 §9) | real device on a throttled network |
| P2 | Desktop with screen reader | NVDA on Windows, VoiceOver on macOS | a full duel by keyboard and screen reader | manual |

Source for the classes: prod-research §7.10 (iOS Safari memory classes; Chrome Android on Adreno, Mali and Exynos; Samsung Internet; Firefox; in-app browsers; WebGPU, WASM-only, no-model and no-microphone paths).

---

## 7. Gaps and the tests to add (proposed)

### 7.1 Economy and progression

No cargo or browser test covers the database-backed economy handlers (tech §7.1). Whatever `fix/server-authority` adds, the minimum set:

| Test | Asserts |
|---|---|
| earn with a client-sent amount | refused or ignored; the server's fixed rate applies |
| earn past the daily cap | refused, with a sentence in 16 languages |
| inventory add from the client | refused; cards only from server events |
| migrate sync with forged cards | the forged cards are not granted |
| purchase between two accounts | one transaction: credits move buyer → seller, the card moves seller → buyer, the listing closes; a second purchase of the same listing fails; a buyer without credits fails |
| tournament result | refused unless the server judged the match |
| leaderboard | built only from server-judged matches |
| teen spending limit | still 200 a day |
| card id longer than the column | a 400, not a 500 (tech §12 item 21) |

### 7.2 Security

- Proxy-secret path: a trusted peer without the header is treated as the client (`client_ip.rs` has 15 unit tests; add an e2e once the secret is set).
- A Content-Security-Policy, once added, tested by the third-party suite.
- Account deletion, once built: every child row removed or anonymised.

### 7.3 AI and judge

- **Red-team set in every language** with the 2025-26 attacks: benign framing wrappers, a prepended refusal sentence, parenthetical "the task is done" claims (prod-research §4.1; design-research §3).
- **Ranking two decent verses:** a labelled pair type no current set has (doc 13 §9).
- **Output safety** tests once a filter exists (doc 13 §6.3), with false-positive rates measured per language (prod-research §7.10).
- **Repeat runs** of passing cells, and a second machine class.

### 7.4 Accessibility

As built there is no automated accessibility test, contrast is unmeasured, the verdict has no live region, and the desktop menus open on hover only (design §8). Proposed (prod-research §7.11, WCAG 2.2 AA):

- an automated rule check (for example axe-core, MPL-2.0, run inside Playwright) on every page in every language;
- contrast measured on the palette's small text;
- a keyboard-only duel;
- a screen-reader duel (section 6.3);
- the AI playtests' keyboard and screen-reader-text runs, each release (section 8.1);
- typed input held equal to speech: a test that a full duel never requires the microphone;
- target sizes of at least 24×24 px (WCAG 2.5.8).

### 7.5 Performance

- Byte ceilings per language in `battle-bytes.spec.ts` (doc 12 §9.2).
- The Japanese duel re-measured after the dictionary cut.
- A first-verse timing test on the emulated throttled phone for every language.

### 7.6 Operations

- A monthly restore drill of the nightly database backup (the restore was tested once, on 2026-11-19: doc 17).
- A post-deploy test that `sw.js` and the runtime `.wasm` files are served under their literal names (the `deploy.sh` hashing hazard: tech §10.3).
- Load test of online play: 500 rooms (the server's ceiling), 1,000 connections, a deploy restart in the middle.

### 7.7 Offline and PWA

- A duel played offline after one visit, in English and Japanese.
- Install and update of the service worker across a deploy.

---

## 8. Playtesting by AI players, and balance (proposed)

Automated tests show the rules are applied; they cannot show that a newcomer finds a first verse, or that the duel is fair. **The owner's rule (2026-11-19): AI is the playtester** (`28-owner-decisions.md` D-63). There are no human playtests, paid or volunteer, no think-aloud sessions and no human baselines. The playtesters are AI players with no prior training on this game, who perceive and act only as a person at the screen can. Everything in this section is **Proposed**: none of it is built.

The research's practice for small studios is think-aloud rounds of five people (prod-research §6.4). The owner ruled that out for this project; the measures that practice was after (where a newcomer stalls, whether a verdict is understood) are taken from AI players instead, below.

### 8.1 What an AI player gets: the parity interface

An AI player sees what a person sees, in one of two forms, and acts only through a person's controls.

| It sees | It never sees |
|---|---|
| **The rendered page as an image**, at the phone width and the desktop size the browser suite already uses (section 6.1) | the scoring code and its constants (`src/lib/verse/*`, `src/lib/cards.ts`, `backend/data/economy.json`) |
| **Or the page's accessible text**: what a screen reader announces, meaning each control's role, name and state, the text in reading order, and live announcements as they are made (taken from the browser's accessibility tree) | the API's JSON, the page source, hidden attributes (the `data-ai-generated` marking among them) and the console |
| On the duel page: the round bar and score, the form's brief, the opponent's verse and any curse notice, the hand (characters, relics and potions as their chips show them, and the ink count), the verse box, the checklist "What your verse must do" with its ticks and points as drawn, the AI notice and label, and the judge's verdict as shown (the craft breakdown, who took each criterion, who judged) (doc 10 §6) | what the seed means, this dossier, the repository, and any other run's notes |

**What it may do:** click or tap a visible control (by its accessible name, or a point on the image), type into the verse box, press keys, scroll, choose a language, reload the page. Online rounds keep their 180-second clock; a solo duel has none, so a step budget (for example 200 actions a duel, written down before the first run) ends a run that is stuck.

**What it is told:** that it is playing a web game, and nothing else. No rules, no hints and no worked examples: it learns the game from the page, as a person does.

**First time, every time.** Each run starts with an empty memory, so every run is a first-time player. A second kind of run lets one player keep the notes it wrote itself across five duels, to measure how play changes with experience; it never receives another run's or another model's notes.

**Two views, two kinds of player.** The image view, with a pointer, is how a sighted mouse or touch player meets the game. The accessible-text view with keyboard-only actions (Tab, Shift+Tab, Enter, Space, the arrows and typing) is how a screen-reader user meets it, so it is also the accessibility check of section 7.4 and of `11-accessibility-plan-and-statement.md`. As built it should stop at the hand, because the character chips cannot take focus and submit waits for a character (doc 11 §1). Its result says whether the duel can be finished that way; it is not a claim about how a disabled player experiences the game.

### 8.2 Which AI players play

Self-hosted models only, released after 2026-04-01, each named with its publisher's release (`28-owner-decisions.md` D-30). A model added later meets the same rule.

| Player | Release | Why it plays | Caveat |
|---|---|---|---|
| Gemma 4 31B and Gemma 4 26B MoE (Google) | announced 2026-04-02; Apache 2.0; "natively trained on over 140 languages" (prod-research §2.1) | the largest open models with the game's whole language list; they run on the build host, not in a browser | the game's model judge is Gemma 4 E2B, so a Gemma player may share the judge's tastes; every result is reported per model family |
| LFM3 1.7B (Liquid AI) | 2026-10-27; LFM Open License v1.0, under the US$10M condition the owner confirmed (doc 13 §8.2; doc 20 §4) | a second family, and a small model that shows what a weak newcomer does | text only, so it plays the accessible-text view |
| Apertus v1.1 Instruct (Swiss AI) | 2026-05-01 to 05-03; Apache 2.0 (prod-research §2.3) | a third family, with the widest language list | weak in many languages (the 1.5B averages 0.382 on the research's multilingual measure): expect a floor |

Whether a model reads images is checked from its own card before it plays the image view; one that cannot plays the accessible-text view only.

**Reference players, which are not playtesters:**

- **A random floor:** types a line of dictionary words of the asked length and picks the first chip. It shows what a verse with no craft scores, and finds any duel a non-player can win.
- **The written opponent's own verses**, typed in as the player's: a scripted player that shows what the game's bank scores against itself.
- **A rules-aware solver:** the spike's planner (`spike/duel-planner`), which simulates the exact rules. It may read the code; it finds the ceiling and the holes in the rules, and is never reported as a playtester.

**Claims.** A result says what was measured and which AI player and version produced it. No claim says "human-level", and no AI result is presented as what people would do.

### 8.3 What is measured

| Measure | How | What it informs |
|---|---|---|
| Time to a first valid verse | actions, seconds and tokens from page load (after the age gate) to the first verse the game accepts and scores without a void | doc 10 §5's target (a first verse within 60 seconds); doc 16's funnel |
| Voids | how many verses are voided, and for which reason the verdict shows (a thin verse, the wrong language, a curse breach) | the clearest sign that the brief was not understood |
| Rounds and duels won against each opponent | against the written opponent, the model opponent where it is offered, and the adaptive opponent once built; by difficulty, language and model family; with a 95% interval | doc 05 §10's 40 to 60% band against the adaptive opponent; doc 25 §10.3's 45 to 55% against the written one; a win with no craft is a hole in the rules |
| Where players get stuck | the screen and control where a run spends most of its actions, repeats one action, or runs out of its budget, grouped across runs | the design's friction points, in order |
| Why a round went as it did | after each verdict the player is asked what decided the round; its answer is scored against the verdict's own breakdown, which the evaluator reads from the game's log and the player never sees | whether the verdict explains itself |
| Match length | actions and seconds per duel | doc 25 §10.3's five-minute target |
| Keyboard and screen-reader completion | the share of accessible-text runs that finish a duel with keys alone | doc 11's first blocker, before and after the fix |
| Device landing rates | how often each house device and signature lands, per form and language | doc 05 §5.3 (`28-owner-decisions.md` D-67) |

### 8.4 Where it runs

- **On the build host**, never on the development laptop and never on the production machine (ADR 0019; section "How to read this document"). Each run plays a local build of the release candidate, with its own API and a scratch database on the same host, so no AI session touches production, its database or its analytics.
- **The models are served on the build host** by an open-source model server, each under the host's memory limit, started for the run and stopped after it. The studio's shared production services are never used for playtests.
- **The browser** is the one the browser suite already drives (Playwright with Chromium), with the WebKit and Firefox projects once they exist (section 6.3).

### 8.5 How the runs are used

- **A run per release candidate** in English and the launch languages, and a larger run before and after each change to the first-time flow (doc 10 §5; doc 26 ranked items 7 and 9).
- **Every new rule, form or card set gets a run before it ships** (doc 25 §7; doc 26 §16).
- **Thresholds are written down before the first run**, as the project already does for its model measurements (`planner/docs/ADAPTIVE-PREREG.md` on `spike/duel-planner`), and are never moved after the results are seen.
- **Every run is kept:** each observation, action and verdict, replayable, beside the build it played.
- **Balance after launch** comes from the live events in `16-analytics-and-tracking-plan.md`: challenger win rate (flag outside 45% to 55%), win rate by card, by form, by language and by judge (prod-research §6.3). The AI runs set the first values before any player arrives.
- **Arrocito del Diablo owns the balance questions** (card devices, curses, power words); findings go to him as design issues, not as bugs, in the weekly review (`28-owner-decisions.md` D-49).

---

## 9. Defect workflow (proposed)

| Severity | Meaning | Example | Target |
|---|---|---|---|
| S1 | data loss, security breach, broken privacy promise, site down | a verse sent to a third party | fix or roll back now |
| S2 | wrong score, wrong online result, sign-in broken for a class of users | parity failure | fix before the next deploy |
| S3 | a feature misbehaves, with a workaround | a form miscounted in one language | next planned release |
| S4 | cosmetic, wording | a line break inside a word | backlog |

Every S1 and S2 fix lands with a test that was seen to fail first (section 5.1). Language defects use the LQA template in `14-localisation-kit.md` §12.6.

---

## 10. Exit criteria for this release

1. Every gate of section 4.1 and 4.2 green on the commit to deploy, recorded.
2. `fix/judge-wording`'s cells re-measured and the lists derived; no hand edit.
3. `fix/server-authority`'s handler tests present and green (section 7.1 as the minimum).
4. No eSpeak NG or `phonemizer` code in the built bundle.
5. `/credits` and the Article 50(1) notice present in all 16 languages.
6. After the deploy: the smoke suite, the trusted-proxy log line, the health route, one real passkey sign-up (then deleted).

---

## 11. Owner questions

All six were settled on 2026-11-19 in `28-owner-decisions.md`; none needs the owner's money, identity or signature, so none stays open.

1. A dated gate result for each deploy? **Decided by default:** a one-line gate result per deploy in the deploy log, under "land it, don't gate it" (28 D-61).
2. Which real phones and headsets for the P0 and P1 rows (section 6.3)? **Decided by default:** the phones the studio already tests its other games on; which headsets exist is still to be found out (28 D-61; Facts to find out, 13).
3. Add WebKit and Firefox projects now, though some tests will fail at first? **Decided by default:** yes, now (28 D-61).
4. Who runs the playtests, and may students take part? **Decided by the owner (2026-11-19): AI is the playtester.** No student or other person takes part; whoever changes the duel runs the AI playtests of section 8 on the build host (28 D-62, D-63).
5. Must the two-account purchase test and the capped-earning test pass before deploy? **Decided by the owner (2026-11-19, R9):** yes, both, before deploy (28 D-05).
6. Is axe-core acceptable under "free and self-hosted"? **Decided by default:** yes; it is open source and runs locally (28 D-61).
