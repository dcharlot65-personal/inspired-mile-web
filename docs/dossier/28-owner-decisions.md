# Sonnet Man: owner decisions

- **Purpose:** every decision the dossier asks of the owner, in one place: first the decisions already made, with their dates; then every open question from documents 01 to 27, deduplicated and grouped, each with its options, the trade-offs and a recommendation.
- **Audience:** David Charlot (founder and technical lead), who decides; Arrocito del Diablo (co-founder, game design and card mechanics) for the design decisions marked for him; future collaborators who need to know what has been settled. Questions for Devon Glover ("The Sonnet Man", creative director) are listed for the owner to put to him; they are not decisions anyone takes on his behalf.
- **As of:** commit `0d6df6ef` (branch `integrate/wave3`, 2026-11-18), plus the release in flight on 2026-11-19 (`fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p`, `fix/compliance`, and the nightly database backup). Branch contents were re-read at 02:16 on 2026-11-19.
- **Status:** Draft for the team, 2026-11-19.
- **Related documents:** `00-README.md` (index), `03-gdd.md` (the hub), `17-operations-runbook-and-launch-checklist.md` §8 (the launch checklist these feed), `21-production-plan-and-roadmap.md`, `22-risk-register.md`, `26-sota-gap-analysis.md`, and every document's own "Owner questions" list, which this document gathers.

**Labels.** *As built*: in the code at `0d6df6ef`. *In this release*: decided on 2026-11-19 and on a named branch, not yet deployed. *Proposed*: a recommendation, with the research or document that supports it. *Not known*: no record found.

**Abbreviations.** SD = `research/sota-design-2026-11.md`; SP = `research/sota-production-2026-11.md`; "doc NN" = the dossier document of that number. Legal points summarise research, not legal advice.

---

## The five decisions that matter most

1. **Mark AI output at this deploy (D-01).** EU AI Act Article 50(2) should be treated as due now; the marking is a few days of work. *Recommended:* add the minimal marking to this release.
2. **Keep strangers' verses from teens until someone reads reports (D-02).** This release opens online duels to the public while reports go unread, there is no block or mute, and quick match can pair a teen with an adult stranger. *Recommended:* online play by private room only at launch, then adults-only quick match once reports are read daily.
3. **Settle Devon Glover's agreement before anything else uses his name (D-13, D-04).** The product, a card and possibly AI verse use his persona with no agreement on record. *Recommended:* ask him now, with his own counsel; until he decides, no model writes as The Sonnet Man.
4. **Take the false claims off the site before deploy (D-03).** "FERPA compliant", classroom progress tracking and the About page's credit amounts describe things the code does not do. *Recommended:* remove them in this release; it is copy only.
5. **Decide the three models that break the date rule (D-28).** Whisper base, Kokoro-82M and LFM2.5 350M predate 2026-04-01. *Recommended:* remove LFM2.5 now (it is offered nowhere); keep the other two under the owner's own "replace as proven" rule, with a dated review.

---

## Part 1. Decisions already made

These are settled. Each one binds every proposal in the dossier. A change to any of them is a new decision, recorded here with its date.

### 1.1 The release in flight (decided 2026-11-19)

| # | Decision | Option chosen | Branch and state at 02:16 on 2026-11-19 | Where described |
|---|---|---|---|---|
| R1 | The judge's compare wording goes back to `main`'s (14 languages passed the judging bar in an A/B, against 4) | the recommended option | `fix/judge-wording`: `3015897a` (wording), `066a34e2` (planted-instruction pairs in all 16 languages). The 32 set-aside compare cells must be measured again before the judging lists change | doc 05 §2; doc 13 §5.1 and §6; ADR 0006 |
| R2 | The economy becomes server-authoritative before this deploy: fixed rates with daily caps, cards only from the server, leaderboard and tournaments only from server-judged matches, purchases that move credits and the card | the recommended option | `fix/server-authority`: `f661c4cc` (every rate in `backend/data/economy.json`), `3fa2c384` (the API; migration `020_server_authority.sql`, additive). No page changed yet; `docs/ECONOMY.md` not yet written | doc 05 §7; ADR 0021 |
| R3 | A nightly backup of the production database, kept 14 days | the recommended option | Done and restore-tested on 2026-11-19 | doc 17 §6.1 |
| R4 | The English voice loses its GPL eSpeak NG dependency before deploy, rebuilt on the CMU dictionary | **"Replace before deploy"**, the owner's own choice | `fix/voice-g2p`: `21446923` (a new table of whole CMU pronunciations plus public-domain NRL letter-to-sound rules), `35f43c22` (Kokoro reads the game's phonemes; a build check fails if eSpeak NG reaches the site) | doc 09 §6; ADR 0008 |
| R5 | Compliance work: a `/credits` page for the CC BY-SA data, the EU AI Act Article 50(1) notice, privacy-policy wording, asset provenance | the recommended option | `fix/compliance`: eight commits (`4dc02c7f` to `d9b966b1`): the notice in 16 languages, `/credits`, cookie names and the referral reply corrected, `docs/ASSETS.md` | doc 13 §7.1; doc 20 §5.1, §8.2 |

Also recorded that day: the production database had **0 accounts** on 2026-11-19. Every change to accounts, cards or sessions in this release therefore affects no player.

### 1.1b Before-deploy decisions from this dossier (decided 2026-11-19, after it was written)

The owner chose the recommended option on each of these, put to them as four questions:

| # | Decision | Option chosen | Section |
|---|---|---|---|
| R6 | Mark AI-written verses and synthetic speech in a machine-readable way in this release | "Accept all (Recommended)" | D-01 (option A) |
| R7 | Take the false and stale claims off the site in this release | same answer | D-03 (option A) |
| R8 | Keep The Sonnet Man card out of the AI opponent's draw until Devon Glover agrees | same answer | D-04 (option C) |
| R9 | Ship the economy's launch values as tunable, with the pages moved to the new API, `docs/ECONOMY.md`, and two handler tests (a two-account purchase; capped earning) | same answer | D-05 (option A) |
| R10 | Marketplace and referral for adults only; credits are never sold | same answer | D-06 (option B) |
| R11 | Measure the judging lists again before deploy (never hand-edit them) | same answer | D-07 (option A) |
| R12 | Remove the two untraced music tracks and the two unused effects; replace the other effects with traced ones within a month | same answer | D-08 (option B) |
| R13 | Show a visible "AI" label beside each model-written verse, with R6's marking | same answer | D-12 (option B) |
| R14 | Online play at launch by private room only, for everyone, until reports are read daily and block and mute exist; then adults-only quick match | "Private rooms only (Recommended)" | D-02 (option C) |
| R15 | Two deploys: first the language merge with the judge, voice and compliance fixes and R6 to R8, R11 to R14; then the economy (R9, R10) with its pages and migration 020 | "Two deploys (Recommended)" | D-11 (option B) |
| R16 | Operations minimum: the proxy secret, an encrypted copy of each nightly backup on a second machine, a self-hosted uptime check with an alert, 30-day API log rotation | "Set all four up (Recommended)" | D-10 |

### 1.2 Earlier decisions

| Date | Decision | Where recorded |
|---|---|---|
| 2026-11-16 | **Owner direction:** passwordless sign-in (passkeys and emailed codes) replacing Google sign-in; in-browser models only, no cloud provider; the multiplayer judge stops calling a cloud API (done: it is rules on the server); all languages represented; the backend stays Rust | `CLAUDE.md:639-644` |
| 2026-11-16 | **No passwords, no Google.** Passkeys are primary; a 6-digit emailed code creates, signs in and recovers | `CLAUDE.md:242`; ADR 0009 |
| 2026-11-16 | **Art direction:** "we are a global planet and represent everyone", "represent all styles": one world art tradition per house, characters cast across the world's peoples | `scripts/art/build_prompts.py:3-10`; doc 08 §2 |
| 2026-11-17 | **The LFM licence:** the owner confirmed that Voyage Tracable LLC earns under the LFM Open License's US$10M threshold | `CLAUDE.md:9-12`; `docs/MODEL-LICENCES.md:6-16` |
| 2026-11-17 | **Online duels are English only, by decision** (the decider is not named in the record) | `CLAUDE.md:134-139`; ADR 0013 |
| 2026-11-17 | **"Replace as proven":** an older model is replaced as soon as a newer one, released after 2026-04-01, is measured to do its job | `docs/mic-test/PREREG.md` on `spike/mic-test`; doc 09 §6 |
| 2026-11-17 | **The planner opponent must be adaptive:** it tunes its strength per player toward about even odds, always with some randomness | `planner/docs/ADAPTIVE-PREREG.md` on `spike/duel-planner`; doc 05 §10.1 |
| Standing | **No GitHub Actions** (an account-wide rule); CI is the build host; builds and tests never run on the development machine | `CLAUDE.md:205-215,600`; ADR 0019 |
| Standing | **Land it, don't gate it:** ordinary work is committed straight to `main`, CI runs on the push and breaks are fixed forward; a pull request only for risky changes or when the owner asks | the owner's standing working rules; doc 15 Q1 |

### 1.3 Standing rules that bind every proposal

- **Free and self-hosted only.** No paid APIs at runtime or for making assets.
- **AI models released after 2026-04-01 only**, and never a model whose release cannot be found.
- **No cloud inference.**
- **Language data from authoritative sources** (CLDR, Wikidata, Wiktionary, dictionaries), never one model's unchecked output.
- **Full-stack Rust preferred.**
- **In generated brand imagery, the central people are Black, of Haitian descent, by default.** The rule never applies to depicting a real person.
- **Devon Glover is a real person.** No document invents his words, views, approvals or consent.

---

## Part 2. Before this deploy

Each of these changes what ships, or what the release can honestly say. Recommendations are *Proposed*.

### D-01. Article 50(2): mark AI output in this release?

- **The situation.** Article 50(2) of the EU AI Act asks providers of systems that generate text or audio to mark that output in a machine-readable way, "as far as technically feasible". The transition to 2026-12-02 covers only systems on the market before 2026-08-02. The in-browser models reached `main` on 2026-11-16, so the cautious reading is that the duty applies from this deploy (doc 13 §7.2; SP §5.4). No release branch has it. Whether the February build's cloud AI was public before 2026-08-02 is Not known.
- **Options.**
  - A. Add minimal marking now: a `data-ai-generated` attribute naming the model and version on every model-written verse and trivia item, an "AI voice" label on the voice setting, and a one-page written method (doc 13 §7.2).
  - B. Deploy without it and add it before 2026-12-02.
  - C. Wait for counsel's view on whether the studio is a "provider".
- **Trade-offs.** A costs a few days and removes the question. B is defensible only if the AI was on the market before 2026-08-02, which is not recorded. C leaves the gap open for an unknown time.
- **Recommended:** A, with counsel asked in parallel. Needed by: this deploy. Sources: doc 13 §7.2; doc 17 §8.6; doc 22 R02.

### D-02. Online play at launch: who may meet whom?

- **The situation.** Online verses make the game a user-to-user service. As built, reports are stored and never read, a report does not even record the reported player, there is no block or mute, and quick match pairs a teen account with any adult stranger (doc 18 §1). The UK Online Safety Act and the EU Digital Services Act have no small-business exemption for the basic duties (SP §4.3). There are 0 accounts, so any choice costs nobody today.
- **Options.**
  - A. Open quick match to everyone now.
  - B. Adults-only quick match; teens play only in private rooms with people they invite, or in a class.
  - C. Private rooms only for everyone until the safety minimum exists (reports read daily, block and mute, statements of reasons, a written risk assessment).
- **Trade-offs.** A is the most exposed and also the least useful, since an empty pool makes quick match wait forever. B needs a small change to the matchmaker (it does not read the age tier today). C is the smallest change and loses almost nothing at 0 players.
- **Recommended:** C at launch, then B once a named person reads reports every day; never A while teens are admitted (doc 18 §7.2). Needed by: this deploy. Sources: doc 18 §1, §7; doc 17 §8.6; doc 26 ranked item 2.

### D-03. False and stale claims on the site

- **The situation.** Pages promise things the code does not do: the classroom tour shows "FERPA compliant" and promises each student's progress and scores; the About page lists credit amounts that, as built, nothing pays; the VR gallery says "your collection"; the world map and playground misdescribe how variants and cards are won; the home page advertises the Theatre with no link; the sitemap lists pages that do not exist (doc 24 §2.3). `fix/compliance` fixes only the referral reply. With `fix/server-authority` the About page's amounts also stop matching the real rates (doc 05 §7.1).
- **Options.** A. Fix all of them in this release. B. Fix the legal-risk ones now ("FERPA compliant", the progress promise) and the rest within a week. C. Leave them.
- **Trade-offs.** A is copy and a few strings in 16 languages, which must pass the language checks (doc 14). B halves the work before deploy. C keeps statements a school or regulator could rely on.
- **Recommended:** A if the language checks can run before deploy; otherwise B. Needed by: this deploy. Sources: doc 24 §2.3; doc 19 §6.2; doc 26 quick wins.

### D-04. The Sonnet Man card in the AI opponent's hand

- **The situation.** The seed can deal SM-001, The Sonnet Man, to the opponent. With a model loaded, the prompt then reads "You are The Sonnet Man…": a model writes as a real person's persona (doc 07 §6; doc 13 §7.4). No agreement with Devon Glover is on record.
- **Options.** A. Leave it. B. Keep SM-001 out of the opponent's draw when a model writes; the written opponent may still play it. C. Keep it out of the opponent's draw entirely until he decides. D. Let it play only verses he has written or approved.
- **Trade-offs.** A carries the publicity-rights risk the research describes (SP §5.8). B and C are a one-line change to `opponentDeck` (`src/lib/verse/duel.ts:278-284`). D needs his verses, which do not exist yet.
- **Recommended:** C now; D later if he agrees. Needed by: this deploy. Sources: doc 07 §6.3; doc 13 §7.4; doc 20 §7.4.

### D-05. The economy's launch values and the pages

- **The situation.** `backend/data/economy.json` sets every rate: a solo win pays 50 credits at most 3 times a UTC day; trivia 30 × 3; a quote challenge 20 × 5; the daily 10 × 1; an online win 50, at most 10 a day and 3 against one opponent; packs of 3, 5 and 5 cards for 50, 150 and 400 credits; a one-time import of at most 20 cards; a 500-credit founding grant; a referrer's 100 credits, 3 a day (doc 05 §7.1). The API removes routes the pages still call (`/credits/spend`, `POST /stats`, `/inventory/add`, `/migrate/sync`, `/variants/unlock`, `/tournaments/.../complete`), and no page has changed on the branch yet. The branch adds 11 Rust unit tests and no test of the handlers. `docs/ECONOMY.md` is not written.
- **Options.** A. Accept the values as tunable launch values, update the pages to the new API, write `docs/ECONOMY.md`, and require two tests (a two-account purchase that moves credits and the card; capped earning) before deploy. B. Ship the API and fix the pages after. C. Hold the branch.
- **Trade-offs.** A is the only option that deploys a working economy. B ships pages that fail against their own API. C keeps the client-trusted economy, which the owner has already decided against.
- **Recommended:** A. Needed by: this deploy. Sources: doc 05 §7; doc 15 §4.2; doc 17 §8.1.

### D-06. Packs, the marketplace and referral

- **The situation.** In this release earned credits buy random packs (`POST /inventory/packs`). Packs bought only with earned credits are not paid random items in law (doc 25 §3), but the marketplace and referral are what a children's privacy review looks at first (SD §6, §7). Teens can spend up to 200 credits a day (As built).
- **Options.** A. Keep packs, marketplace and referral on for everyone. B. Keep packs; marketplace and referral on for adults only. C. Earned credits buy only chosen cards (no random packs); marketplace off until the card redesign.
- **Trade-offs.** A is the widest surface for teens. B is a small check on the age tier. C removes the loot-box question entirely but changes the server's pack code.
- **Recommended:** B now, and write down that credits are never sold (doc 26 §5). Revisit C with Arrocito del Diablo when the cards are redesigned. Sources: doc 05 §7; doc 25 §3; doc 26 §5.

### D-07. Which languages the model judges at deploy

- **The situation.** `main`'s wording is restored, but the judging lists in `brain.ts` change only after the 32 set-aside compare cells are measured again on the build host (doc 03 §4.10; doc 15 §4.2).
- **Options.** A. Measure before deploy and ship the new lists. B. Ship with the current lists (4 judging languages) and update after. C. Hand-edit the lists to the A/B's 14.
- **Trade-offs.** A is right and costs build-host time. B is safe: the rules judge everywhere else. C breaks the project's rule that lists are derived, never hand-edited.
- **Recommended:** A if the run fits before deploy, else B. Never C. Sources: doc 13 §9; doc 17 §8.1.

### D-08. Music and effects with no traced source

- **The situation.** In this release `battle-beat.mp3` and `landing-ambient.mp3` are traced byte for byte to CC0 tracks on OpenGameArt. `playground-ambient.mp3`, `collection-browse.mp3` and all 14 effects remain untraced; two effects are never played (doc 09 §4, §5).
- **Options.** A. Ship them and say on `/credits` that they are untraced (what the branch does). B. Remove the two untraced tracks now (silence on those pages), delete the two unused effects, and replace the other 12 effects with CC0 or self-made ones within a month. C. Remove all untraced audio now.
- **Trade-offs.** A carries a small takedown risk. B removes most of the risk at little cost. C leaves the game without click and win sounds until replacements exist.
- **Recommended:** B. Sources: doc 09 §4, §5, §10; doc 22 R05.

### D-09. The English voice on the live site, and how it must sound

- **The situation.** `main`, presumed live, still serves eSpeak NG to anyone who turns the English voice on (doc 20 §6.2). `fix/voice-g2p` removes it; a person still has to listen to its 200-word test list.
- **Options.** A. Deploy the fix in this release, with a listening check before deploy. B. If the deploy slips, switch the voice off on the live site until it ships.
- **Recommended:** A; B only if the deploy slips by more than a few days. Set the pass mark for the listening check (for example: no word on the list unintelligible to two listeners). Sources: doc 09 §6; doc 22 R04.

### D-10. Operations minimum for the deploy

| Item | Options | Recommended (Proposed) | Source |
|---|---|---|---|
| Proxy secret (stops a spoofed client address from the proxy host) | set now; later; never | **Set now.** On prod's own proxy block only through the site-ops Caddyfile, diffed against live first | doc 17 §1.3, §8.3 |
| Off-host backup copy | none; a second machine on the private network; an encrypted copy elsewhere | **An encrypted copy on a second machine**, restore-tested monthly | doc 17 §6 |
| Monitoring and an alert channel | none; an uptime check; uptime plus error reporting | **An uptime check now** (self-hosted), error reporting with the analytics work | doc 17 §6.4; doc 16 |
| API log rotation (the policy promises 30 days) | set rotation; change the promise | **Set 30-day rotation before deploy** and record it | doc 16 §3; doc 17 §6.4 |
| A deputy who can deploy and roll back | none; a named person with operator access | **Name one**, and rehearse a rollback with them | doc 17 §7.1; doc 22 R51 |

Checks that are not decisions, but block the deploy (doc 17 §8): which commit is live today, and that production's environment no longer sets the old cloud-model key; that the merged `/credits` drops the eSpeak NG entry; that the pages no longer call removed routes.


### D-11. One deploy or two?

- **The situation.** The five branches share a base (`c22b035a`) but not their pages: `fix/server-authority` changes the API and no page, so the pages still call routes it removes; `fix/compliance` and `fix/voice-g2p` both touch the credits page's eSpeak NG entry (doc 20 §6.2).
- **Options.** A. One deploy, when all five are merged and the pages follow the new API. B. Two deploys: first `fix/judge-wording`, `fix/voice-g2p` and `fix/compliance` (the licence and notice fixes, which need no data change); then `fix/server-authority` with its page changes and migration 020. C. Deploy everything now and fix the pages after.
- **Trade-offs.** A waits for the slowest branch, while the live site keeps serving the GPL component. B ships the legal fixes first and keeps the economy change, the only one with a migration, on its own, easier to roll back. C ships broken pages.
- **Recommended:** B, unless the pages are ready the same day, then A. Never C. Sources: doc 17 §8; ADR 0020.

### D-12. The AI notice: placement, review and a label per verse

- **The situation.** In this release one sentence, chosen by what the model does in that duel, shows before the first duel on the battle page, in the Theatre and on the multiplayer page, in 16 languages, checked with LanguageTool and Hunspell (doc 13 §7.1). No native speaker has read it, and no label sits beside each model-written verse.
- **Options.** A. Ship it as it is. B. Ship it, and add a visible "AI" label beside each model-written verse with D-01's marking. C. Hold the notice until native review.
- **Trade-offs.** A meets Article 50(1) at first interaction. B also tells the player which verse is the model's, which matters whenever the opponent could look like a real person (D-04). C leaves the duty unmet.
- **Recommended:** B, with a native read of the notice in each launch language soon after (D-50). Sources: doc 10 §5; doc 13 §7; doc 11 Q5.
---

## Part 3. Devon Glover: the agreement and the persona

The owner decides how to approach Devon Glover. Every answer about his name, likeness, voice, verses, time and views is his to give.

### D-13. The agreement

- **The situation.** The product is named after his persona, the home page carries his programme's name ("Shakespeare on the Go"), the About page has a biography and his social links, and card SM-001 may be meant to depict him. No agreement, approval or consent is on record (doc 20 §7.1). New York requires written consent to use a person's name, likeness or voice in trade, and digital-replica clauses are void where the performer had no counsel (SP §5.8).
- **Options.** A. A written licence now, drafted by the company's counsel, reviewed by his own counsel, covering name, persona, likeness, voice (recorded only; synthetic only by a separate addendum), biography, marks, approvals and a kill switch (doc 20 §7.3). B. A short letter of consent for the current uses now, the full licence later. C. Rename the product and card (doc 07 §6.3 option C).
- **Trade-offs.** A takes weeks and his counsel's time. B covers the immediate uses quickly but must not be read as consent to AI use. C removes the dependence but loses the brand.
- **Recommended:** B this month and A before any marketing names him. Sources: doc 07 §8; doc 20 §7; doc 22 R01, R50.

### D-14. The persona: which option to propose to him

Doc 07 §6.3 sets out three: **A, a licensed persona** (his approved portrait, his own verses; the AI never writes or speaks as him); **B, a host, not a card** (he introduces duels in his own recorded voice); **C, a fictional figure** (a different name; he is credited as creative director). *Recommended:* propose A or B, with one rule under both until a licence says otherwise: no model writes, and no synthetic voice speaks, as The Sonnet Man.

### D-15. Names and marks

- **Not known:** who holds "Sonnet Man", "The Sonnet Man", "Shakespeare on the Go" or "Inspired Mile" as marks; no search is on record (doc 20 §10).
- **Recommended:** a trade-mark search in the US and the first market countries before launch publicity; ask Devon Glover whether he holds or has applied for any of these; do not use "Shakespeare on the Go" in marketing until he agrees (doc 24 §2.2).

### Questions to put to Devon Glover

Gathered from documents 01 to 27 and deduplicated. Ask; do not assume any answer.

1. **Agreement.** Is there any existing agreement or understanding? Will he sign a written licence for his name, "The Sonnet Man", likeness, voice, biography and "Shakespeare on the Go", with his own counsel? Who represents him, and where is he domiciled? Does he hold or plan any trade mark in these names?
2. **AI and the card.** May an AI ever play or write as SM-001? If so, only with verses he wrote or approved, or "in his style", and labelled how? Does he refuse any synthetic voice near his persona, ever?
3. **Likeness.** Is SM-001 meant to be him? If he wants a likeness, which photographs, what may be stylised, what must never be made?
4. **Recordings and music.** Would he record an intro, round calls, house lines, remixes or a final encounter? Would he make or choose beats? Which of his existing recordings or music may the game or its trailers use? Terms, ownership and credit?
5. **Boundaries.** Which topics, words, gestures, slang and styles must the game and the persona never touch, especially with teens and classes?
6. **Name and genre.** "Verse duel" or "rap battle"? How should hip-hop be present? Would he want a fifth design pillar about his own performance? Does a recite-then-remix mode fit his method?
7. **Marketing.** May the game name him in marketing, and how? Which biography and photographs? Did he write or approve the About page's biography? How should the FAQ answer "Is Devon Glover in the game?" May the AI notice say he does not write the AI's verses, and in what words? Should young players see his social links?
8. **Calendar and content.** Which dates, plays, sonnets and themes should challenges, seasons and daily prompts favour or avoid? Would he write or choose any prompts, credited to him, or take part in a headline duel once a season?
9. **Schools.** Could his school and festival network host playtests or a classroom pilot? What do his partners require of a vendor's privacy terms? Does he want his name on the school summary?
10. **Working together.** What does he want to review (cards, art, the intro, opponent verses, translations' tone), how quickly can he turn reviews round, and how many hours can he give? Does he want to hear of any incident involving his name or card? What should happen to the card and the name if he ever stepped away? Has he seen the game, and is there anything in it now he wants changed?

---

## Part 4. Trust, safety and privacy

Needed before strangers play at scale, and before schools. Recommendations are *Proposed*.

| ID | Decision | Options | Trade-offs | Recommended | Sources |
|---|---|---|---|---|---|
| D-16 | Who reads reports, and how fast; the Terms' 48-hour promise; a second reviewer; readers for other languages | founder alone; founder plus a named deputy; an outside volunteer for appeals | one person cannot meet 48 hours every day of the year; a volunteer needs training and a confidentiality note | **Founder plus a named deputy**, reports read daily; change the Terms to "we aim to review within 48 hours" until two people cover it (`fix/compliance` does not touch the Terms); online stays English only, so other-language readers can wait | doc 18 §6.3, §6.5 |
| D-17 | Keep a reported verse as evidence? | never (as built: the report lacks the verse and the player); keep it 90 days; 1 year where the law requires | without it no report can be acted on; keeping it changes a privacy promise for reported verses only | **Keep the reported verse and the reported account for 90 days** (1 year where the law requires), and change the policy sentence in the same commit | doc 18 §6.2; doc 19 §7 |
| D-18 | Where a moderation classifier runs | A. on the company's own server; B. in the receiving player's browser | A cannot be bypassed and covers phones, but runs a model on a server, against "no server does inference" (ADR 0001); B stays inside the rule but is a 268 MB download phones cannot take | **A, as an explicit and narrow exception** (moderation of online verses only, a self-hosted model, recorded in a new ADR): online verses already reach the server, so no new data flows. If the owner prefers to keep the rule absolute, B on desktops and the word list plus human review on phones | doc 18 §5.3; doc 26 §13 |
| D-19 | Tournaments | anyone signed in may create one with any name (still true in this release); staff only; adults only; hide tournaments | open creation lets anyone publish a name to the public | **Hide tournaments until a page can play them**; then staff-created only, names filtered; under-18s only in class or teen-only tournaments | doc 18 §2.3, §5.5; doc 25 §8 |
| D-20 | Retention: server-judged match records; inactive accounts; stored verses for "ghost" duels | keep forever; 24 months; less | ratings need history; longer keeping is more to protect | **Match records 24 months; delete accounts after 24 months without sign-in (with an email first, if email is on); keep the two-minute rule for verses** until ghost duels are designed with consent | doc 19 §7; doc 06 §3 |
| D-21 | Self-service account deletion | by hand on request (as built; 15 tables would block a delete); an endpoint with cascades | the manual way is slow and error-prone; any store build requires self-service | **Build the endpoint** before inviting the public; publish the manual route until then | doc 19 §8 |
| D-22 | NCMEC CyberTipline registration and Tech Coalition Pathways; a named responsible person; self-harm resources; UK players | now; when online grows | registration is free and slow to arrange; a named person is a legal expectation | **Register and join Pathways now; name David Charlot as the responsible person until a deputy is trained; choose one help line per launch country**; run Ofcom's online regulation checker before promoting in the UK | doc 18 §7.2, §7.4, §9.1 |
| D-23 | Under-13s | A. 13 and over (as built); B. school consent for under-13s | B opens schools' younger classes but brings the full COPPA pack and school agreements | **A for this release and the first pilot**, adopting the written security programme and retention policy now anyway | doc 19 §5.2 |
| D-24 | Email sign-in | stay passkey-only (as built: a lost passkey cannot be recovered); the hosted email service (Resend); a self-hosted sender | Resend is a paid-tier third party (its free tier is Not known to suffice); self-hosted mail risks poor delivery | **Passkey-only at launch**, prompting every player to add a second passkey; then a self-hosted sender, measured for delivery | doc 12 §14; doc 19 §3.6; ADR 0009 |
| D-25 | Analytics | hosted Plausible (as built; whether the account is paid is Not known); self-hosted Umami on the existing Postgres; a small Rust endpoint alone | Plausible is a third party against "free and self-hosted"; Umami is MIT and needs no new database; a Rust endpoint fits the Rust preference but is more work | **Umami, self-hosted**, after the age gate as now, off by default for teen and class accounts; aggregate only; in the EU, the banner-free aggregate route; publish investor numbers monthly from it | doc 16 §5, §11; SP §6.1, §6.2 |
| D-26 | Model weights: where they are served from, and pinning | the Hugging Face hub, unpinned (as built); pinned revisions on the hub; served from the game's own origin | the hub learns each downloader's address; serving them ourselves makes the company a distributor and costs bandwidth | **Pin revisions now** (a quick win); decide self-hosting when traffic is known | doc 12 §4.3; doc 19 R7; doc 20 Q14 |
| D-27 | EU and UK representatives; counsel; sign-off of the drafted DPIA (doc 19 §4) and Online Safety Act risk assessment (doc 18 §9); first markets | appoint now; when EU or UK players appear | representatives cost money; the duty arises when processing of EU or UK people is not occasional | **Name counsel now** to review docs 18, 19 and 20; decide first markets (D-57) before appointing representatives; sign off the two drafts before inviting the public | doc 19 §9; doc 20 §12 |

---

## Part 5. AI models and the date rule

| ID | Decision | Options | Trade-offs | Recommended | Sources |
|---|---|---|---|---|---|
| D-28 | The three shipped models released before 2026-04-01: Whisper base (speech in), Kokoro-82M (English voice), LFM2.5 350M (never offered) | remove; replace; keep by exception | no measured replacement with a browser build fits every tier yet; removing Whisper removes speaking a verse | **Remove LFM2.5 from `MODELS` now. Keep Whisper base and Kokoro under "replace as proven"** (1.2), with a dated review each quarter; candidates are Whistle or Moonshine for speech and Kitten TTS 2 or Supertonic 3 for voice, once measured | doc 13 §5, §8; doc 21 M3, M5 |
| D-29 | LFM3 1.7B, which judges only Vietnamese | keep; remove | a 1.1 GB download for one language's judging, under the US$10M licence | **Keep** while it is the only measured Vietnamese judge; drop it when Gemma passes Vietnamese judging | doc 13 §5.2; doc 20 §4.1 |
| D-30 | Does the date rule cover models used only on the build host, and newer trainings of an older model (Parakeet Ultra, Nemotron 3.5 ASR)? | yes to both; build host exempt; retrains count as new | the rule's purpose is current models in the product | **The rule covers what ships to players. A retrain counts if its own release is after 2026-04-01 and documented. Build-host tools are exempt** but recorded | doc 09 Q5; doc 21 Q6 |
| D-31 | A trial of Liquid d1-2B as a judge that returns scores | run; skip | about 1.95 GB (desktops and strong Android, not iPhone); the same US$10M condition as LFM3 | **Run it on the build host** against the same cells; ship only if it passes | doc 13 §8; doc 21 M5 |
| D-32 | Whistle (speech) and Supertonic 3 (voice) | adopt; wait | Whistle's licence is Not known and its release date is only a repository date (2026-09-30); Supertonic 3's publisher redirects to an archive and its OpenRAIL-M terms require disclosure and forbid impersonation | **Wait** for Whistle's licence and the real-microphone test; adopt Supertonic 3 only with its use terms passed on to players and an "AI voice" label | doc 09 §6, §7; doc 21 M3 |
| D-33 | The FLUX Kommunity License's US$5M revenue condition on the card art; FLUX 3 Image Klein's release date; the 198 variant pictures made through a hosted Hugging Face Space | accept and record; plan a repaint with another model | US$5M is half the LFM threshold the owner confirmed; the variant pictures were made by cloud inference (before the rule) and no page shows them | **Accept the condition and record it beside the LFM one, with a repaint plan if revenue nears it; confirm the release date; remove the 198 variant pictures** | doc 08 §13; doc 20 §8.2; doc 22 R06 |
| D-34 | Telling players that text was machine-made (the 15 non-English packs, the written opponent's verses, the translations) | say nothing; a line on `/credits`; a line per language | players punish undisclosed machine translation (SD §8); the notice already names who plays | **One line per language until a native speaker has read it**, and a line on `/credits` about the written opponent | doc 13 §7.3; doc 14 §12 |
| D-35 | A topic guard on the model opponent (self-harm, sexual content, mental health) | none known (as built); a guard and a classifier on each draft | California SB 243 excludes a game bot only if it keeps to the game and cannot discuss those topics | **Run the classifier on each model draft and void a flagged one**, so the written verse plays instead | doc 13 §6; doc 18 §8.3; doc 26 §13 |
| D-36 | Should a duel judged by the model earn the same as one judged by the rules? | same (in this release); different | the solo claim is already capped and the server cannot see either | **The same** | doc 13 Q16 |

---

## Part 6. Game design (with Arrocito del Diablo)

The owner decides with Arrocito del Diablo; items that touch the brand also go to Devon Glover (Part 3).

| ID | Decision | Options | Trade-offs | Recommended | Sources |
|---|---|---|---|---|---|
| D-37 | The name of the genre, and "Master Thespian" | "verse duel"; "rap battle"; both | it is a verse duel as built (no beat, no delivery); "rap battle" invites the audience that tests hip-hop games hardest | **"Verse duel"** until Devon Glover says otherwise; retire "Master Thespian" if he dislikes it | doc 07 §2; doc 24 §2.2 |
| D-38 | The design pillars | the four in doc 01; add a fifth about his performance | a fifth pillar depends on his agreement | **Accept the four now**; add the fifth only if he wants it | doc 01 |
| D-39 | Keep, finish or delete: story mode, season pass, tournaments, house allegiance, streaks, weekly events, draft mode, referral, marketplace, the 3D viewer and VR gallery, city variants, React and the NFT and wallet schema; the brief's 10,000 and 100-card tiers | keep each; finish each; delete each | every half-built system adds legal and safety surface and none has a job in the duel today | **Finish story mode** (the first campaign); **hide** season pass and tournaments until playable; **delete** house allegiance, draft mode, weekly events, React and the dead schema; **replace** streaks with a forgiving one; **keep** the marketplace for adults only (D-06); **drop** the 10,000 and 100 tiers formally; hide the 3D viewer for cards without files | doc 26 "What to stop"; doc 06; doc 21 |
| D-40 | Navigation and onboarding | as built (the Playground first; the duel lower down); "Duel now" first; an intro; a match-length target and a solo clock | conversion is decided at the first input (SD §4) | **"Duel now" as the home page's first action**, starting round one with the written opponent and no download; the Theatre in the Play menu; **a skippable intro only when Devon Glover's recording exists**; target five minutes a match, no solo clock | doc 10 §5; doc 26 §4 |
| D-41 | Difficulty | the three labels (which do nothing without a model); bank tiers of human-written verses (Apprentice, Player, Master); the adaptive opponent (the owner's 2026-11-17 decision) | the spike's planner put 26 of 30 simulated players in the 40 to 60% band but failed seven of its own rules | **The adaptive opponent as the default**, built on bank tiers so that it works on phones; keep the labels as a choice beside it | doc 05 §10; doc 03 §14.2 |
| D-42 | Card stats (ATK, DEF, HP, element); characters within a house; relics and potions; items online | keep on the face; give them a role; remove | numbers that do nothing confuse players | **Take stats off the card face** until they have a role in writing; give each character one condition of its own beyond its signature; relics and potions stay solo until online rules are written | doc 04 §12; doc 03 §14.1 |
| D-43 | The Sonnet Man in every starter deck, and his rarity; what rarity means; duplicates; what collecting unlocks | keep; change | a free Legendary in every starter makes rarity meaningless, and the card depends on D-13 | **Decide after D-13.** Rarity stays a collecting tier, not power; give duplicates a use, chosen with Arrocito del Diablo (doc 03 §14.5) | doc 04 §12; doc 05 §12 |
| D-44 | A stakes move before round 3 (raise or bow out); a "dispute the verdict" control; win-rate bands; the forms of a five-minute duel | test; skip | each adds a choice or a screen | **Test the stakes move and the dispute control in the first playtests**; aim for 40 to 60% wins against the adaptive opponent | doc 03 §14; doc 16 §11 |
| D-45 | Achievement counters | fix ("Completionist" at 71; "Relic Hunter" on relics; wins count matches); leave | the server's 18 account achievements already count matches in this release | **Fix the device counters to match the server's** | doc 05 §6.3; doc 25 §2 |
| D-46 | Theatre wins; a signed-out player's first solo win | pay a card; pay nothing | the playground promises a card for a win; in this release a solo win adds no card to an account | **A Theatre win pays as a `/battle` win does. A signed-out first win adds one card to the device collection**, so the promise holds before sign-in | doc 05 §12; doc 10 Q1 |
| D-47 | Language content rules: power words (theme nouns or direct translations); the Chinese 双手 rule; Forest of Arden's name; Illyria's "why" line | keep; change | the current Forest of Arden cast is from A Midsummer Night's Dream; Illyria's line is from Hamlet | **Rename or recast Forest of Arden and replace Illyria's line with a Twelfth Night line**; power words as theme nouns, checked by a native reader | doc 04 §4; doc 14 §12 |
| D-48 | Online languages | English only at launch (the 2026-11-17 decision); add a language | the server cannot reproduce the browser's language tools exactly | **English only at launch.** The next language is the first that the Rust engine reproduces exactly and that has a native reviewer | ADR 0013; doc 26 larger bet 1 |
| D-49 | How Arrocito del Diablo reviews card and balance changes | per change; weekly; per season | | **A short weekly review** of card and balance changes, logged in this document | doc 26 Q7 |

---

## Part 7. Languages

| ID | Decision | Options | Recommended | Sources |
|---|---|---|---|---|
| D-50 | Native reviewers (who, how found, budget); review order; the Portuguese variant; the do-not-translate list; unreviewed languages in the picker; which languages marketing names | volunteers; paid reviewers; one language at a time | **Paid native reviewers, one language at a time in doc 14's order**, starting with the launch market's languages; keep Brazilian Portuguese; write "Sonnet Man" and "Shakespeare on the Go" into the do-not-translate list; show unreviewed languages with a "not yet reviewed" note rather than hiding them; marketing names only reviewed languages | doc 14 §12, §14; doc 23 Q6 |

Paying people is not a paid API; it is outside the "free and self-hosted" rule but is still money, so it needs a budget (D-57).

---

## Part 8. Classroom

| ID | Decision | Options | Recommended | Sources |
|---|---|---|---|---|
| D-51 | Show classroom mode before it records progress? Rostering? A pilot school and month? | show now; hide until v1; rostering by Clever, ClassLink and LTI 1.3 (Google sign-in conflicts with the 2026-11-16 direction and ADR 0009) | **Hide the classroom tour's promises now (D-03), keep the roster page reachable by link only, build classroom v1** (seeded assignments, completion without verse text, a teacher-hosted round, commerce off: doc 26 §11), **then pilot with one 13+ class** through Devon Glover's network if he agrees. Rostering by Clever and ClassLink; revisit Google only by an explicit owner decision | doc 19 §6; doc 21 M9; doc 26 §11 |

---

## Part 9. Accessibility

| ID | Decision | Options | Recommended | Sources |
|---|---|---|---|---|
| D-52 | An accessibility owner and contact address; phase dates; a budget for disabled playtesters and an audit; the conformance-report format; the Theatre and VR gallery while inaccessible; app-store plans; the company's headcount and turnover (they decide the European Accessibility Act's microenterprise exemption) | | **David Charlot owns it until a contractor is hired; a role mailbox as contact.** Fix the keyboard blocker first: the duel cannot be played by keyboard today (doc 11 §1). Keep the Theatre and VR public, naming `/battle` as the accessible equivalent. Publish a WCAG 2.1 AA conformance report (VPAT format) before any US district pilot, ahead of the 2027-04-26 date. Confirm headcount and turnover for the exemption | doc 11 |

---

## Part 10. Art and audio

| ID | Decision | Options | Recommended | Sources |
|---|---|---|---|---|
| D-53 | The scope of the brand-imagery default (Black, of Haitian descent) against the global casting of card characters; whether doc 08 should state the reason for the rule | apply the default to everything; brand imagery only | **Brand and marketing imagery only**; card characters keep the 2026-11-16 global casting; real poets and Shakespeare's characters as the house tradition casts them; state the rule without the personal reason | doc 08 §7 |
| D-54 | Art faults to repaint before launch and who signs off each image; where the PNG masters, prompts and seeds are archived; a single master monogram; a light theme; 3D and AR in the next six months | | **Repaint the eight listed faults before launch; Devon Glover signs off anything that could read as him, the owner the rest; archive masters with prompts and seeds; one master monogram; a high-contrast option rather than a light theme; no 3D or AR work until the duel has players** | doc 08 §6, §13, §14 |
| D-55 | Music direction and a composer budget; loudness targets; whether mute silences the voice; one voice or a voice per character | | **A small set of on-theme loops, made with or chosen by Devon Glover if he agrees, otherwise commissioned under written terms; one integrated-loudness target for music and one for effects, measured with one tool (the research found no sourced target for web games: SP §7.5); mute silences everything including the voice; one voice until there are measured voices to choose from** | doc 09 §4, §8, §10 |

---

## Part 11. Company, business and launch

| ID | Decision | Options | Recommended | Sources |
|---|---|---|---|---|
| D-56 | Will credits ever be sold? Which revenue route first? | never; later with protections | **Never sell credits or packs.** Explore, in order: education and arts grants, school licences invoiced yearly, recurring supporters; never ads | doc 23 §8; doc 25 §3; doc 26 larger bet 9 |
| D-57 | The ask, budget, monthly burn and runway; the pitch's first audience; grants applied for; partners; a market-research budget; first markets | Not known on record | **Write the budget and runway first**; pitch first to education and arts funders and school partners (SP §7.1); first markets English-speaking (US, then UK after D-22's Ofcom check) | doc 02 ("The ask"); doc 21 Q2; doc 23 |
| D-58 | Trade marks; the operating agreement and IP assignments (including any work by Treston Knight); counsel | | **Counsel to confirm the operating agreement assigns the members' work to the LLC, and get written assignments from anyone else who contributed**; trade-mark search (D-15) | doc 20 §3, §10 |
| D-59 | Launch: date and announcer; social accounts and a press address; a logo or wordmark; key art (generated under the imagery default, or commissioned); who approves public copy; a deck link to the live build; portals and stores | | **Launch quietly after D-01 to D-05**; one press address; key art from a real screenshot of a verdict, not a generated performer; one named approver for all public copy; an itch.io page linking to the site; no portal build (none fits "no ads"); no store build until account deletion exists | doc 24; doc 23 §7 |
| D-60 | Shakespeare and other texts: any Folger edition shipped? Publication-year and translator-death checks per language | | **Confirm no Folger text ships** (its licence is non-commercial); add the publication-year check and the 1945 rule for Spanish lines to the existing test | doc 20 §8.3 |

---

## Part 12. Engineering and operations, later

| ID | Decision | Recommended | Sources |
|---|---|---|---|
| D-61 | Bring the live origin's proxy block into site-ops; rehearse a failover to the mirror; a dated gate-result file per deploy under "land it"; which real phones and headsets the team has; WebKit and Firefox test projects; axe-core (open source, local) as a dependency; how big online play must get before a match should survive a deploy; who holds administrative access to the production database; a Content-Security-Policy | **Bring the proxy block into site-ops; rehearse one failover; keep a one-line gate result per deploy in the deploy log; add WebKit and Firefox projects and axe-core now; store match snapshots only once analytics show a deploy would end real matches; one named admin plus the deputy; ship a CSP** | doc 12 §13; doc 15 §11; doc 17 §11 |

---

## Part 13. People and time

| ID | Decision | Recommended | Sources |
|---|---|---|---|
| D-62 | Treston Knight's current role; Devon Glover's and Arrocito del Diablo's hours; who writes the world rules and character sheets; who writes the human opponent banks per language; who runs the first playtests (13+, with consent); who approves copy | **Write down each person's role and weekly hours first.** Arrocito del Diablo writes the world rules and character sheets; a contracted writer per language writes opponent banks, reviewed by Devon Glover for tone if he agrees; David Charlot runs the first five playtests | doc 07 §9; doc 21 §7 |

---

## Facts to find out (not decisions)

These are Not known in the record. Each blocks or sharpens a decision above.

1. Which commit is live, and whether production's environment still sets the old cloud-model key (D-10).
2. Whether the February build's AI features were public before 2026-08-02 (D-01).
3. Whether anyone outside the team has played the rebuilt game, and any figures for match length or first-time progress (D-40, D-44).
4. Who wrote the English written opponent's verses and the "game's own" card lines, and who wrote the About page's biography (D-34; Part 3).
5. The release dates of LFM2.5 350M, the Whisper base checkpoint and FLUX 3 Image Klein, from primary sources (D-28, D-33).
6. Whistle's licence (D-32).
7. Whether the Plausible account exists and is paid (D-25).
8. How the API's logs are rotated today (D-10).
9. The sources of the two untraced music tracks, the 14 effects and the model behind the 3D figure (D-08).
10. Whether the thin-verse rule voids every model draft written in the wrong language; whether anything keeps the model off self-harm and sexual topics (D-35).
11. The company's headcount and annual turnover (D-52).

## Owner questions

This document is the list. New questions from any document are added here, with options and a recommendation, and a decision once taken moves to Part 1 with its date.
