# Sonnet Man: owner decisions

- **Purpose:** every decision the dossier asks of the owner, in one place: first the decisions the owner has made, with their dates; then every other question from documents 00 to 29, deduplicated and grouped. Each is now either **decided by default** under the owner's standing rules, with the rule or evidence named, or **open**, because only the owner can answer it. Eleven are open.
- **Audience:** David Charlot (founder and technical lead), who decides; Arrocito del Diablo (co-founder, game design and card mechanics) for the design decisions marked for him; future collaborators who need to know what has been settled. Questions for Devon Glover ("The Sonnet Man", creative director) are listed for the owner to put to him; they are not decisions anyone takes on his behalf.
- **As of:** Deploy 1 (`5121f941`: `integrate/wave3`, `fix/judge-wording`, `fix/voice-g2p`, `fix/compliance`, `fix/predeploy`, `fix/favicon`) and Deploy 2 (`docs/dossier` `e09c3a5c` + `fix/server-authority` `1d8472ad`, `ECONOMY_LIVE = true`, migrations `020` and `021`) on 2026-11-23, running on live origin GCP `openie-core-1` (`34.26.11.244`) alongside the Mac mirrors (`100.98.101.113`, `100.64.224.0`).
- **Status:** Draft for the team, 2026-11-19. Defaults recorded on 2026-11-19 under the owner's rules of that day (below).
- **Related documents:** `00-README.md` (index), `03-gdd.md` (the hub), `15-qa-and-test-plan.md` §8 (the AI playtests), `17-operations-runbook-and-launch-checklist.md` §8 (the launch checklist these feed), `21-production-plan-and-roadmap.md`, `22-risk-register.md`, `26-sota-gap-analysis.md`, and every document's own "Owner questions" list, which this document gathers.

**Labels.** *As built*: in the code at `0d6df6ef`. *In this release*: decided on 2026-11-19 and on a named branch, not yet deployed. *Proposed*: a recommendation, with the research or document that supports it. *Not known*: no record found.

**Decisions.** *Decided by the owner*: the owner chose it, with the date (Part 1). *Decided by default*: a sensible default followed from the owner's standing rules or from the evidence, so it was made without asking; the rule or evidence is named in each one. Both kinds bind the documents. The work a decision calls for stays *Proposed* until it is built. The owner can change any decision; the change is recorded here with its date. *Open*: needs the owner's money, identity or contact details, a legal commitment in the company's name, or a public step not yet approved.

**Abbreviations.** SD = `research/sota-design-2026-11.md`; SP = `research/sota-production-2026-11.md`; "doc NN" = the dossier document of that number. Legal points summarise research, not legal advice.

---

## Where things stand

On 2026-11-19 the owner made sixteen release decisions (R1 to R16, Part 1) and gave four rules for this list (next section). Under them, every question in the dossier that had a sensible default was decided, and is recorded below with the rule or evidence behind it. **Eleven questions stay open**, because each needs something only the owner can give:

| # | The question, in plain words | Why it is yours | Related |
|---|---|---|---|
| O-1 | Will you ask Devon Glover to sign a written agreement for the game's use of his name, "The Sonnet Man", "Shakespeare on the Go" and any likeness, with his own lawyer reading it? | a legal commitment in the company's name, with a real person | D-13 to D-15; Part 3 |
| O-2 | Will you hire a lawyer, and when, to check the safety, privacy and legal documents (18, 19, 20), the Terms, whether the EU AI Act treats the company as a "provider", the company's operating agreement, and written transfers of rights from everyone who worked on the game? | money, and legal advice in the company's name | D-01, D-27, D-58 |
| O-3 | Once a lawyer has read them, will you sign the privacy risk assessment (19 §4) and the online-safety risk assessment (18 §9) for the company? | a legal commitment in the company's name | D-27 |
| O-4 | Do you want to pay to search and register "Sonnet Man", "The Sonnet Man" and "Inspired Mile" as trade marks, in the US first? | money, and filings in the company's name | D-15, D-58 |
| O-5 | When players from the EU or the UK start using the game regularly, will you pay for the local representative that each one's law asks of a company with no office there? | money, and an appointment in the company's name | D-27 |
| O-6 | May the company register with the US child-safety reporting line (NCMEC's CyberTipline) and join the Tech Coalition's free Pathways programme, with you named as the person responsible? | your identity, and a registration in the company's name | D-22 |
| O-7 | How much can the company spend in the next year, and on which of these: native speakers to read each language (D-50), writers for the opponent's verses (D-62), a composer (D-55), Devon Glover's fees and recordings if he agrees (O-1), an outside accessibility audit (D-52), a second person who can read reports and run the site when you are away (D-10, D-16)? | money | D-57 |
| O-8 | What will the company ask funders for (how much, in what form, for which milestones), and what does it spend each month now? | money | D-57; doc 02 |
| O-9 | How many people does the company employ, and roughly what is its yearly revenue? Two rules depend on it: the EU accessibility law excuses very small companies, and the card-art model's licence allows commercial use only under US$5 million a year | facts about the company that only you hold | D-33, D-52 |
| O-10 | When should the game be announced, and by whom? May the company open its own accounts on itch.io and on social networks for it? | public steps in the company's name, not yet approved | D-59 |
| O-11 | Will you set up the email-sending account you chose on 2026-11-16 (Resend), so that sign-in codes and the "Sonnet Man is down" alerts can be sent, and which inbox should the alerts go to? | your contact details and an account in the company's name | D-10, D-24; doc 17 §6.4 |

Until each is answered, the work goes ahead as the related decision says: nothing in the game uses Devon Glover's name in a new way or speaks as him, no one is hired, nothing is filed or signed, and the game is not announced.

**These will come to you when the time comes** (they are not questions now): a school's data agreement for a classroom pilot (D-51); grant applications and any partner agreement (D-56, D-57); closing a hosted analytics account, if one exists and is paid (D-25); a public "making of" postmortem (D-79).

---

## The owner's rules of 2026-11-19 for this list

Given after Part 1 was written. They bind every proposal in the dossier and every default below.

1. **AI is the playtester.** When paid or volunteer human playtesters were offered, the owner said: "no. AI is the playtester." The dossier proposes no human playtests, think-aloud sessions or human baselines. Playtesting means AI players with no prior training on the game, who see only what a person at the screen sees and use only a person's controls, on self-hosted models released after 2026-04-01, run on the build host. Claims never say "human-level"; they say what was measured, with which AI player. The design is `15-qa-and-test-plan.md` §8 (D-63).
2. **No faux choices.** Where a sensible default follows from the standing rules or the evidence, it is decided and recorded, not put to the owner. Only money, identity or contact details, legal commitments in the company's name, and public steps not yet approved come to the owner, in plain words.
3. **A design's recommendations stand.** No recommendation is cut to make the work smaller. Putting things in order is not a cut: where a default below says "first", "later" or "hidden until", the rest stays in scope.
4. **The public contact is contact@voyagetracable.com**, approved by the owner for privacy pages, press kits, store pages and other public pages. The owner's personal address stays private.

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

Each of these changes what ships, or what the release can honestly say. Eleven were decided by the owner on 2026-11-19 (Part 1, R6 to R16); D-09 was decided by default.

### D-01. Article 50(2): mark AI output in this release?

- **The situation.** Article 50(2) of the EU AI Act asks providers of systems that generate text or audio to mark that output in a machine-readable way, "as far as technically feasible". The transition to 2026-12-02 covers only systems on the market before 2026-08-02. The in-browser models reached `main` on 2026-11-16, so the cautious reading is that the duty applies from this deploy (doc 13 §7.2; SP §5.4). No release branch has it. Whether the February build's cloud AI was public before 2026-08-02 is Not known.
- **Options.**
  - A. Add minimal marking now: a `data-ai-generated` attribute naming the model and version on every model-written verse and trivia item, an "AI voice" label on the voice setting, and a one-page written method (doc 13 §7.2).
  - B. Deploy without it and add it before 2026-12-02.
  - C. Wait for counsel's view on whether the studio is a "provider".
- **Trade-offs.** A costs a few days and removes the question. B is defensible only if the AI was on the market before 2026-08-02, which is not recorded. C leaves the gap open for an unknown time.
- **Decided by the owner (2026-11-19): R6, option A.** A lawyer's view on whether the studio is a "provider" is part of O-2. Needed by: this deploy. Sources: doc 13 §7.2; doc 17 §8.6; doc 22 R02.

### D-02. Online play at launch: who may meet whom?

- **The situation.** Online verses make the game a user-to-user service. As built, reports are stored and never read, a report does not even record the reported player, there is no block or mute, and quick match pairs a teen account with any adult stranger (doc 18 §1). The UK Online Safety Act and the EU Digital Services Act have no small-business exemption for the basic duties (SP §4.3). There are 0 accounts, so any choice costs nobody today.
- **Options.**
  - A. Open quick match to everyone now.
  - B. Adults-only quick match; teens play only in private rooms with people they invite, or in a class.
  - C. Private rooms only for everyone until the safety minimum exists (reports read daily, block and mute, statements of reasons, a written risk assessment).
- **Trade-offs.** A is the most exposed and also the least useful, since an empty pool makes quick match wait forever. B needs a small change to the matchmaker (it does not read the age tier today). C is the smallest change and loses almost nothing at 0 players.
- **Decided by the owner (2026-11-19): R14, option C**, then B once a named person reads reports every day; never A while teens are admitted (doc 18 §7.2). Needed by: this deploy. Sources: doc 18 §1, §7; doc 17 §8.6; doc 26 ranked item 2.

### D-03. False and stale claims on the site

- **The situation.** Pages promise things the code does not do: the classroom tour shows "FERPA compliant" and promises each student's progress and scores; the About page lists credit amounts that, as built, nothing pays; the VR gallery says "your collection"; the world map and playground misdescribe how variants and cards are won; the home page advertises the Theatre with no link; the sitemap lists pages that do not exist (doc 24 §2.3). `fix/compliance` fixes only the referral reply. With `fix/server-authority` the About page's amounts also stop matching the real rates (doc 05 §7.1).
- **Options.** A. Fix all of them in this release. B. Fix the legal-risk ones now ("FERPA compliant", the progress promise) and the rest within a week. C. Leave them.
- **Trade-offs.** A is copy and a few strings in 16 languages, which must pass the language checks (doc 14). B halves the work before deploy. C keeps statements a school or regulator could rely on.
- **Decided by the owner (2026-11-19): R7, option A.** Needed by: this deploy. Sources: doc 24 §2.3; doc 19 §6.2; doc 26 quick wins.

### D-04. The Sonnet Man card in the AI opponent's hand

- **The situation.** The seed can deal SM-001, The Sonnet Man, to the opponent. With a model loaded, the prompt then reads "You are The Sonnet Man…": a model writes as a real person's persona (doc 07 §6; doc 13 §7.4). No agreement with Devon Glover is on record.
- **Options.** A. Leave it. B. Keep SM-001 out of the opponent's draw when a model writes; the written opponent may still play it. C. Keep it out of the opponent's draw entirely until he decides. D. Let it play only verses he has written or approved.
- **Trade-offs.** A carries the publicity-rights risk the research describes (SP §5.8). B and C are a one-line change to `opponentDeck` (`src/lib/verse/duel.ts:278-284`). D needs his verses, which do not exist yet.
- **Decided by the owner (2026-11-19): R8, option C.** D later, if he agrees (O-1). Needed by: this deploy. Sources: doc 07 §6.3; doc 13 §7.4; doc 20 §7.4.

### D-05. The economy's launch values and the pages

- **The situation.** `backend/data/economy.json` sets every rate: a solo win pays 50 credits at most 3 times a UTC day; trivia 30 × 3; a quote challenge 20 × 5; the daily 10 × 1; an online win 50, at most 10 a day and 3 against one opponent; packs of 3, 5 and 5 cards for 50, 150 and 400 credits; a one-time import of at most 20 cards; a 500-credit founding grant; a referrer's 100 credits, 3 a day (doc 05 §7.1). The API removes routes the pages still call (`/credits/spend`, `POST /stats`, `/inventory/add`, `/migrate/sync`, `/variants/unlock`, `/tournaments/.../complete`), and no page has changed on the branch yet. The branch adds 11 Rust unit tests and no test of the handlers. `docs/ECONOMY.md` is not written.
- **Options.** A. Accept the values as tunable launch values, update the pages to the new API, write `docs/ECONOMY.md`, and require two tests (a two-account purchase that moves credits and the card; capped earning) before deploy. B. Ship the API and fix the pages after. C. Hold the branch.
- **Trade-offs.** A is the only option that deploys a working economy. B ships pages that fail against their own API. C keeps the client-trusted economy, which the owner has already decided against.
- **Decided by the owner (2026-11-19): R9, option A.** Needed by: this deploy. Sources: doc 05 §7; doc 15 §4.2; doc 17 §8.1.
- **Also decided by default (2026-11-19), under the standing rules:** R9's "tunable launch values" and R7's honest pages. `docs/ECONOMY.md` explains every number the server pays, XP, achievements, seasons and referral included, not only credits and cards. The one-time import keeps its 20-card limit (at most 1 Legendary, 2 Epic, 5 Rare) as a tunable value. Where the About page listed the old amounts, it shows the real rates, read from `economy.json` so the page cannot drift from the server. Sources: doc 05 Q1 and Q3; doc 12 Q3; doc 24 Q9.

### D-06. Packs, the marketplace and referral

- **The situation.** In this release earned credits buy random packs (`POST /inventory/packs`). Packs bought only with earned credits are not paid random items in law (doc 25 §3), but the marketplace and referral are what a children's privacy review looks at first (SD §6, §7). Teens can spend up to 200 credits a day (As built).
- **Options.** A. Keep packs, marketplace and referral on for everyone. B. Keep packs; marketplace and referral on for adults only. C. Earned credits buy only chosen cards (no random packs); marketplace off until the card redesign.
- **Trade-offs.** A is the widest surface for teens. B is a small check on the age tier. C removes the loot-box question entirely but changes the server's pack code.
- **Decided by the owner (2026-11-19): R10, option B**, and credits are never sold. Revisit C with Arrocito del Diablo when the cards are redesigned (D-43). **Decided by default (2026-11-19), under R10 (nothing in the game is sold):** no marketplace fee at launch; a fee in earned credits stays a tunable value for the card redesign. Sources: doc 05 §7; doc 25 §3; doc 26 §5.

### D-07. Which languages the model judges at deploy

- **The situation.** `main`'s wording is restored, but the judging lists in `brain.ts` change only after the 32 set-aside compare cells are measured again on the build host (doc 03 §4.10; doc 15 §4.2).
- **Options.** A. Measure before deploy and ship the new lists. B. Ship with the current lists (4 judging languages) and update after. C. Hand-edit the lists to the A/B's 14.
- **Trade-offs.** A is right and costs build-host time. B is safe: the rules judge everywhere else. C breaks the project's rule that lists are derived, never hand-edited.
- **Decided by the owner (2026-11-19): R11, option A.** The build host runs the measurement before deploy; which languages pass is known only after it runs. Never C. Sources: doc 13 §9; doc 17 §8.1.

### D-08. Music and effects with no traced source

- **The situation.** In this release `battle-beat.mp3` and `landing-ambient.mp3` are traced byte for byte to CC0 tracks on OpenGameArt. `playground-ambient.mp3`, `collection-browse.mp3` and all 14 effects remain untraced; two effects are never played (doc 09 §4, §5).
- **Options.** A. Ship them and say on `/credits` that they are untraced (what the branch does). B. Remove the two untraced tracks now (silence on those pages), delete the two unused effects, and replace the other 12 effects with CC0 or self-made ones within a month. C. Remove all untraced audio now.
- **Trade-offs.** A carries a small takedown risk. B removes most of the risk at little cost. C leaves the game without click and win sounds until replacements exist.
- **Decided by the owner (2026-11-19): R12, option B.** Sources: doc 09 §4, §5, §10; doc 22 R05.

### D-09. The English voice on the live site, and how it must sound

- **The situation.** `main`, presumed live, still serves eSpeak NG to anyone who turns the English voice on (doc 20 §6.2). `fix/voice-g2p` removes it; its 200-word test list has still to be heard before deploy.
- **Options.** A. Deploy the fix in this release, with a listening check before deploy. B. If the deploy slips, switch the voice off on the live site until it ships.
- **Decided by default (2026-11-19), under the standing rules:** the owner's R4 ("replace before deploy") and R15 (the voice fix is in the first deploy), and the GPL evidence of doc 20 §6.2. A, with B if the first deploy slips by more than a week. The listening check runs on the build host: a self-hosted speech recogniser released after 2026-04-01 transcribes each of the 200 words as the voice says it, and every word it fails to transcribe back is played to the owner, who passes or fails it; the voice ships when no word fails. No listeners are recruited (the owner's rule of 2026-11-19). Sources: doc 09 §6, Q2; doc 13 Q15; doc 22 R04.

### D-10. Operations minimum for the deploy

| Item | Options | Decision | Source |
|---|---|---|---|
| Proxy secret (stops a spoofed client address from the proxy host) | set now; later; never | **Decided by the owner (2026-11-19): R16.** The live origin's proxy block is brought into site-ops first, then the secret is set; on prod's own proxy block only through the site-ops Caddyfile, diffed against live first | doc 17 §1.3, §6.4, §8.3 |
| Off-host backup copy | none; a second machine on the private network; an encrypted copy elsewhere | **Decided by the owner (2026-11-19): R16.** An encrypted copy on a second machine, installed and restore-tested 2026-11-19; restore drill monthly | doc 17 §6 |
| Monitoring and an alert channel | none; an uptime check; uptime plus error reporting | **Decided by the owner (2026-11-19): R16.** A self-hosted uptime check, installed 2026-11-19, alerting by email; error reporting with the analytics work. The inbox and the email account: O-11 | doc 17 §6.4; doc 16 |
| API log rotation (the policy promises 30 days) | set rotation; change the promise | **Decided by the owner (2026-11-19): R16.** 30-day rotation installed 2026-11-19; the promise stands | doc 16 §3; doc 17 §6.4 |
| A deputy who can deploy and roll back | none; a named person with operator access | **Decided by default (2026-11-19), under the standing rules:** there is no second person to name, and hiring one is money (O-7). David Charlot is the only operator; doc 17's rollback stays written step by step, so a second person can follow it once one exists | doc 17 §7.1; doc 22 R51 |

Checks that are not decisions, but block the deploy (doc 17 §8): which commit is live today, and that production's environment no longer sets the old cloud-model key; that the merged `/credits` drops the eSpeak NG entry, and that someone reads it in full before deploy; that the pages no longer call removed routes.

### D-11. One deploy or two?

- **The situation.** The five branches share a base (`c22b035a`) but not their pages: `fix/server-authority` changes the API and no page, so the pages still call routes it removes; `fix/compliance` and `fix/voice-g2p` both touch the credits page's eSpeak NG entry (doc 20 §6.2).
- **Options.** A. One deploy, when all five are merged and the pages follow the new API. B. Two deploys: first `fix/judge-wording`, `fix/voice-g2p` and `fix/compliance` (the licence and notice fixes, which need no data change); then `fix/server-authority` with its page changes and migration 020. C. Deploy everything now and fix the pages after.
- **Trade-offs.** A waits for the slowest branch, while the live site keeps serving the GPL component. B ships the legal fixes first and keeps the economy change, the only one with a migration, on its own, easier to roll back. C ships broken pages.
- **Decided by the owner (2026-11-19): R15, option B.** Never C. Sources: doc 17 §8; ADR 0020.

### D-12. The AI notice: placement, review and a label per verse

- **The situation.** In this release one sentence, chosen by what the model does in that duel, shows before the first duel on the battle page, in the Theatre and on the multiplayer page, in 16 languages, checked with LanguageTool and Hunspell (doc 13 §7.1). No native speaker has read it, and no label sits beside each model-written verse.
- **Options.** A. Ship it as it is. B. Ship it, and add a visible "AI" label beside each model-written verse with D-01's marking. C. Hold the notice until native review.
- **Trade-offs.** A meets Article 50(1) at first interaction. B also tells the player which verse is the model's, which matters whenever the opponent could look like a real person (D-04). C leaves the duty unmet.
- **Decided by the owner (2026-11-19): R13, option B.** **Decided by default (2026-11-19), under R13 and Article 50(1):** the notice stays where `fix/compliance` puts it, and the label sits beside each model-written verse, starting with the opponent's first; both are announced to screen readers (doc 11 §5). A native read of the notice in each launch language follows when readers are paid for (D-50, O-7). Sources: doc 10 §5, Q2; doc 13 §7; doc 11 Q5.

---

## Part 3. Devon Glover: the agreement and the persona

The owner decides whether and how to approach Devon Glover (O-1). Every answer about his name, likeness, voice, verses, time and views is his to give.

### D-13. The agreement

- **The situation.** The product is named after his persona, the home page carries his programme's name ("Shakespeare on the Go"), the About page has a biography and his social links, and card SM-001 may be meant to depict him. No agreement, approval or consent is on record (doc 20 §7.1). New York requires written consent to use a person's name, likeness or voice in trade, and digital-replica clauses are void where the performer had no counsel (SP §5.8).
- **Options.** A. A written licence now, drafted by the company's counsel, reviewed by his own counsel, covering name, persona, likeness, voice (recorded only; synthetic only by a separate addendum), biography, marks, approvals and a kill switch (doc 20 §7.3). B. A short letter of consent for the current uses now, the full licence later. C. Rename the product and card (doc 07 §6.3 option C).
- **Trade-offs.** A takes weeks and his counsel's time. B covers the immediate uses quickly but must not be read as consent to AI use. C removes the dependence but loses the brand.
- **Open: O-1.** It is a legal commitment in the company's name, with a real person. The plan for when you ask him (Proposed): B this month and A before any marketing names him. Sources: doc 07 §8; doc 20 §7; doc 22 R01, R50.

### D-14. The persona: which option to propose to him

Doc 07 §6.3 sets out three: **A, a licensed persona** (his approved portrait, his own verses; the AI never writes or speaks as him); **B, a host, not a card** (he introduces duels in his own recorded voice); **C, a fictional figure** (a different name; he is credited as creative director).

**Decided by default (2026-11-19), under the standing rule that Devon Glover is a real person and no one invents his words, views or consent:** put A and B to him and let him choose; C only if he declines both. One rule holds under either until a licence says otherwise: no model writes, and no synthetic voice speaks, as The Sonnet Man. The story's closing line that gives The Sonnet Man invented words ("You have played your part well…", `src/lib/story-mode.ts:89`) is replaced now with a Shakespeare line spoken by the stage, or later with his own approved words (doc 07 §6). Sources: doc 07 §6.3, Q1 and Q3.

### D-15. Names and marks

- **Not known:** who holds "Sonnet Man", "The Sonnet Man", "Shakespeare on the Go" or "Inspired Mile" as marks; no search is on record (doc 20 §10).
- **Decided by default (2026-11-19), under the standing rules:** "Shakespeare on the Go" is his programme's name, so it is not used in marketing until he agrees (doc 24 §2.2). The free public registers (the US office's search, and the UK and EU offices') are searched now and what they show is recorded in doc 20 §10; this commits the company to nothing. He is asked whether he holds or has applied for any of these names (question 1 below).
- **Open: O-4**, paying for a full search and registering the marks.

### Questions to put to Devon Glover

Gathered from documents 01 to 27 and deduplicated. Ask; do not assume any answer. These are his to answer; asking them is part of O-1.

1. **Agreement.** Is there any existing agreement or understanding? Will he sign a written licence for his name, "The Sonnet Man", likeness, voice, biography and "Shakespeare on the Go", with his own counsel? Who represents him, and where does he live? Does he hold or plan any trade mark in these names?
2. **AI and the card.** May an AI ever play or write as SM-001? If so, only with verses he wrote or approved, or "in his style", and labelled how? Does he refuse any synthetic voice near his persona, ever?
3. **Likeness.** Is SM-001 meant to be him? If he wants a likeness, which photographs, what may be stylised, what must never be made?
4. **Recordings and music.** Would he record an intro, round calls, house lines, remixes or a final encounter? Would he make or choose beats? Which of his existing recordings or music may the game or its trailers use? Terms, ownership and credit?
5. **Boundaries.** Which topics, words, gestures, slang and styles must the game and the persona never touch, especially with teens and classes?
6. **Name and genre.** "Verse duel" or "rap battle"? How should hip-hop be present? Would he want a design principle of the game to be about his own performance? Does a mode where a player recites a Shakespeare passage and then remixes it in their own words fit his method?
7. **Marketing.** May the game name him in marketing, and how? Which biography and photographs? Did he write or approve the About page's biography? How should the FAQ answer "Is Devon Glover in the game?" May the AI notice say he does not write the AI's verses, and in what words? Should young players see his social links?
8. **Calendar and content.** Which dates, plays, sonnets and themes should challenges, seasons and daily prompts favour or avoid? Would he write or choose any prompts, credited to him, or take part in a headline duel once a season?
9. **Schools.** Could his school and festival network host a classroom pilot? What do his partners require of a vendor's privacy terms? Does he want his name on the school summary?
10. **Working together.** What does he want to review (cards, art, the intro, opponent verses, translations' tone, what the AI playtests find), how quickly can he turn reviews round, and how many hours can he give? Does he want to hear of any incident involving his name or card? What should happen to the card and the name if he ever stepped away? Has he seen the game, and is there anything in it now he wants changed?

---

## Part 4. Trust, safety and privacy

Needed before strangers play at scale, and before schools.

| ID | Decision | Options | Trade-offs | Decided | Sources |
|---|---|---|---|---|---|
| D-16 | Who reads reports, and how fast; the Terms' 48-hour promise; a second reviewer; readers for other languages | founder alone; founder plus a named deputy; an outside volunteer for appeals | one person cannot meet 48 hours every day of the year; a volunteer needs training and a confidentiality note | **Decided by default (2026-11-19), under the evidence:** one founder, and no second person to name (D-10). The founder reads reports daily. The Terms say "we aim to review within 48 hours" (`fix/compliance` does not touch the Terms). An appeal is read again by the founder after at least a day, and by a second person once one is hired (O-7). No outside volunteer: a volunteer would read players' reported verses. Online play stays English only, so readers for other languages wait | doc 18 §6.3, §6.5 |
| D-17 | Keep a reported verse as evidence? | never (as built: the report lacks the verse and the player); keep it 90 days; 1 year where the law requires | without it no report can be acted on; keeping it changes a privacy promise for reported verses only | **Decided by default (2026-11-19), under the evidence** that a report without the verse cannot be acted on: keep the reported verse and the reported account for 90 days (1 year where the law requires), and change the policy sentence in the same commit | doc 18 §6.2; doc 19 §7 |
| D-18 | Where a moderation classifier runs | A. on the company's own server; B. in the receiving player's browser | A cannot be bypassed and covers phones, but runs a model on a server, against "no server does inference" (ADR 0001); B stays inside the rule but is a 268 MB download phones cannot take | **Decided by default (2026-11-19), under the owner's 2026-11-16 direction, "in-browser models only"** (`CLAUDE.md:641-644`): B. The classifiers (the harm classifier and the personal-details classifier of doc 18 §5.2) run in the receiving player's browser on desktops, so it protects the reader and a sender cannot switch it off. On phones, and for everyone, the server applies the word list and the contact-details patterns, which are rules, not a model, as the server's online judge already is; reports are read daily (D-16). Private rooms only at launch (R14) keep strangers apart meanwhile. A server-side model (A) would need the owner to change that direction; nothing here asks for it | doc 18 §5.3; doc 13 Q4; doc 26 §13 |
| D-19 | Tournaments | anyone signed in may create one with any name (still true in this release); staff only; adults only; hide tournaments | open creation lets anyone publish a name to the public | **Decided by default (2026-11-19), under the evidence** that open creation publishes any name to the public: hide tournaments until a page can play them; then staff-created only, names filtered; under-18s only in class or teen-only tournaments | doc 18 §2.3, §5.5; doc 25 §8 |
| D-20 | Retention: server-judged match records; inactive accounts; stored verses for "ghost" duels | keep forever; 24 months; less | ratings need history; longer keeping is more to protect | **Decided by default (2026-11-19), under the privacy rule of keeping only what is needed:** match records 24 months; delete accounts after 24 months without sign-in (with an email first, if email is on); keep the two-minute rule for verses until ghost duels are designed with the author's consent | doc 19 §7; doc 06 §3 |
| D-21 | Self-service account deletion | by hand on request (as built; 15 tables would block a delete); an endpoint with cascades | the manual way is slow and error-prone; any store build requires self-service | **Decided by default (2026-11-19), under the right to erasure** (doc 19 §8): build the endpoint before inviting the public; until then publish the manual route, by writing to contact@voyagetracable.com | doc 19 §8 |
| D-22 | NCMEC CyberTipline registration and Tech Coalition Pathways; a named responsible person; self-harm resources; UK players | now; when online grows | registration is free and slow to arrange; a named person is a legal expectation | **Open: O-6**, the registration naming you. **Decided by default (2026-11-19), under the evidence of doc 18 §7.2 and §9.1:** David Charlot is the responsible person until a second person is trained; one help line per launch country, taken from that country's official listing and checked by the founder; Ofcom's free online regulation checker is run before the game is promoted in the UK | doc 18 §7.2, §7.4, §9.1 |
| D-23 | Under-13s | A. 13 and over (as built); B. school consent for under-13s | B opens schools' younger classes but brings the full COPPA pack and school agreements | **Decided by default (2026-11-19), under the evidence** of what B brings (doc 19 §5.2): A, 13 and over, for this release and the first pilot; the written security programme and retention policy are adopted now anyway | doc 19 §5.2 |
| D-24 | Email sign-in | stay passkey-only (as built: a lost passkey cannot be recovered); the hosted email service (Resend); a self-hosted sender | Resend is a paid-tier third party (its free tier is Not known to suffice); self-hosted mail risks poor delivery | **Decided by default (2026-11-19), under the owner's 2026-11-16 direction** ("passkeys + Resend email", `CLAUDE.md:641`): emailed codes go through Resend once its account and key exist (O-11); until then passkey-only, prompting every player to add a second passkey. A self-hosted sender stays the fallback if Resend's terms or delivery fail | doc 12 §14; doc 19 §3.6; ADR 0009 |
| D-25 | Analytics | hosted Plausible (as built; whether the account is paid is Not known); self-hosted Umami on the existing Postgres; a small Rust endpoint alone | Plausible is a third party against "free and self-hosted"; Umami is MIT and needs no new database; a Rust endpoint fits the Rust preference but is more work | **Decided by default (2026-11-19), under "free and self-hosted only":** Umami, self-hosted, after the age gate as now, off by default for teen and class accounts; aggregate only; in the EU, the banner-free aggregate route (D-72); a small Rust endpoint only for an event Umami cannot record; the hosted script removed; investor numbers published monthly from it. Closing a hosted account, if one is paid, comes to you | doc 16 §5, §11; SP §6.1, §6.2 |
| D-26 | Model weights: where they are served from, and pinning | the Hugging Face hub, unpinned (as built); pinned revisions on the hub; served from the game's own origin | the hub learns each downloader's address; serving them ourselves makes the company a distributor and costs bandwidth | **Decided by default (2026-11-19), under the evidence** that an unpinned model can change under players (doc 12 §4.3): pin revisions now; serve the weights from the game's own origin, with each licence beside them, once traffic shows the bandwidth it needs | doc 12 §4.3; doc 19 R7; doc 20 Q14 |
| D-27 | EU and UK representatives; counsel; sign-off of the drafted DPIA (doc 19 §4) and Online Safety Act risk assessment (doc 18 §9); first markets | appoint now; when EU or UK players appear | representatives cost money; the duty arises when processing of EU or UK people is not occasional | **Open: O-2** (a lawyer), **O-3** (signing the two assessments) and **O-5** (representatives). **Decided by default (2026-11-19):** first markets as D-57; representatives are appointed when EU or UK players stop being occasional, not before; the two assessments are signed before the public is invited to play strangers | doc 19 §9; doc 20 §12 |

---

## Part 5. AI models and the date rule

| ID | Decision | Options | Trade-offs | Decided | Sources |
|---|---|---|---|---|---|
| D-28 | The three shipped models released before 2026-04-01: Whisper base (speech in), Kokoro-82M (English voice), LFM2.5 350M (never offered) | remove; replace; keep by exception | no measured replacement with a browser build fits every tier yet; removing Whisper removes speaking a verse | **Decided by default (2026-11-19), under the date rule and the owner's "replace as proven" decision of 2026-11-17** (Part 1.2): remove LFM2.5 from `MODELS` now. Keep Whisper base and Kokoro until a newer model is measured to do each job, with a dated review each quarter; candidates are Whistle or Moonshine for speech and Kitten TTS 2 or Supertonic 3 for voice | doc 13 §5, §8; doc 21 M3, M5 |
| D-29 | LFM3 1.7B, which judges only Vietnamese | keep; remove | a 1.1 GB download for one language's judging, under the US$10M licence | **Decided by default (2026-11-19), under "replace as proven":** keep it while it is the only measured Vietnamese judge; drop it when Gemma passes Vietnamese judging | doc 13 §5.2; doc 20 §4.1 |
| D-30 | Does the date rule cover models used only on the build host, and newer trainings of an older model (Parakeet Ultra, Nemotron 3.5 ASR)? | yes to both; build host exempt; retrains count as new | the rule's purpose is current models in the product | **Decided by default (2026-11-19), under the date rule as the owner gave it, which names no exemption:** it covers every model the project uses, shipped or on the build host, the AI playtesters included (D-63). A newer training counts only if its publisher announced it as its own release after 2026-04-01; a repository date is not a release date. Build-host tools already in use are recorded and replaced as proven, like the shipped ones. (This replaces the earlier recommendation that build-host tools be exempt, which the rule's wording does not allow) | doc 09 Q5; doc 20 Q7; doc 21 Q6 |
| D-31 | A trial of Liquid d1-2B as a judge that returns scores | run; skip | about 1.95 GB (desktops and strong Android, not iPhone); the same US$10M condition as LFM3 | **Decided by default (2026-11-19), under the evidence** that it costs only build-host time: run it on the build host against the same cells; ship only if it passes | doc 13 §8; doc 21 M5 |
| D-32 | Whistle (speech) and Supertonic 3 (voice) | adopt; wait | Whistle's licence is Not known and its release date is only a repository date (2026-09-30); Supertonic 3's publisher redirects to an archive and its OpenRAIL-M terms require disclosure and forbid impersonation | **Decided by default (2026-11-19), under the rule that a model's release must be found, and the licence evidence:** wait for Whistle's licence and the real-microphone test (D-70); adopt Supertonic 3 only with its use terms passed on to players and an "AI voice" label | doc 09 §6, §7; doc 21 M3 |
| D-33 | The FLUX Kommunity License's US$5M revenue condition on the card art; FLUX 3 Image Klein's release date; the 198 variant pictures made through a hosted Hugging Face Space | accept and record; plan a repaint with another model | US$5M is half the LFM threshold the owner confirmed; the variant pictures were made by cloud inference (before the rule) and no page shows them | **Decided by default (2026-11-19), under the "no cloud inference" rule and the licence's own text:** record the condition beside the LFM one, with a repaint plan if revenue nears it; find the release date from the publisher; remove the 198 variant pictures. Whether the company is under US$5M: O-9 | doc 08 §13; doc 20 §8.2; doc 22 R06 |
| D-34 | Telling players that text was machine-made (the 15 non-English packs, the written opponent's verses, the translations) | say nothing; a line on `/credits`; a line per language | players punish undisclosed machine translation (SD §8); the notice already names who plays | **Decided by default (2026-11-19), under that evidence:** one line per language until a native speaker has read it, and a line on `/credits` about the written opponent. Once the authors of the written opponent's verses and the card lines are known (Facts to find out, 4), each is credited on `/credits` if they wish | doc 13 §7.3; doc 14 §12 |
| D-35 | A topic guard on the model opponent (self-harm, sexual content, mental health) | none known (as built); a guard and a classifier on each draft | California SB 243 excludes a game bot only if it keeps to the game and cannot discuss those topics | **Decided by default (2026-11-19), under that law** (doc 13 §6): run the classifier on each model draft, in the browser that wrote it (D-18), and void a flagged one, so the written verse plays instead | doc 13 §6; doc 18 §8.3; doc 26 §13 |
| D-36 | Should a duel judged by the model earn the same as one judged by the rules? | same (in this release); different | the solo claim is already capped and the server cannot see either | **Decided by default (2026-11-19), under the evidence** that the server sees neither judge: the same | doc 13 Q16 |

---

## Part 6. Game design (with Arrocito del Diablo)

Decided by default on 2026-11-19 so that the work can go ahead. Arrocito del Diablo's weekly review (D-49) may change any of them; a change is recorded here as a new decision. Items that touch the brand wait on Devon Glover's answers (Part 3), not on the owner.

| ID | Decision | Options | Trade-offs | Decided | Sources |
|---|---|---|---|---|---|
| D-37 | The name of the genre, and "Master Thespian" | "verse duel"; "rap battle"; both | it is a verse duel as built (no beat, no delivery); "rap battle" invites the audience that tests hip-hop games hardest | **Decided by default (2026-11-19), under the evidence** of what is built: "verse duel" until Devon Glover says otherwise; "Master Thespian" stays unless he dislikes it | doc 07 §2; doc 24 §2.2 |
| D-38 | The design pillars | the four in doc 01; add a fifth about his performance | a fifth pillar depends on his agreement | **Decided by default (2026-11-19):** the four in doc 01; a fifth only if he wants it | doc 01 |
| D-39 | Keep, finish or delete: story mode, season pass, tournaments, house allegiance, streaks, weekly events, draft mode, referral, marketplace, the 3D viewer and VR gallery, city variants, React and the NFT and wallet schema; the brief's 10,000 and 100-card tiers | keep each; finish each; delete each | every half-built system adds legal and safety surface and none has a job in the duel today | **Decided by default (2026-11-19), under the owner's rule that a design's recommendations are not cut, only ordered:** finish story mode first (the first campaign, doc 21 M12). Hide from players, until each can be played end to end, the season pass, tournaments (D-19), house allegiance, draft mode, weekly events, the city variants and the 3D viewer for cards without files; each returns when it has a job in the duel, and none is deleted from the plan. Replace streaks with the forgiving streak of doc 25 §5.4. Keep the marketplace for adults only (R10). The 10,000 and 100-card tiers stay on the list for the card redesign, which decides what rarity means (D-43). Remove React, which no page mounts, and drop the NFT and wallet schema, which nothing reads since the owner's 2026-11-16 direction replaced wallet sign-in (ADR 0009) | doc 26 "What to stop"; doc 06; doc 21 |
| D-40 | Navigation and onboarding | as built (the Playground first; the duel lower down); "Duel now" first; an intro; a match-length target and a solo clock | conversion is decided at the first input (SD §4) | **Decided by default (2026-11-19), under the evidence** that conversion is decided at the first input, **and the owner's rule for his games** ("all games need a cool intro users will be presented with. not just let in", 2026-11-15): "Duel now" as the home page's first action, starting round one with the written opponent and no download; the Theatre in the Play menu; a short intro made from the game's own duel, skippable at once and never shown twice, with Devon Glover's recorded performance added if he agrees; target five minutes a match, no solo clock | doc 10 §5; doc 26 §4 |
| D-41 | Difficulty | the three labels (which do nothing without a model); bank tiers of human-written verses (Apprentice, Player, Master); the adaptive opponent (the owner's 2026-11-17 decision) | the spike's planner put 26 of 30 simulated players in the 40 to 60% band but failed seven of its own rules | **Decided by default (2026-11-19), under the owner's 2026-11-17 decision** that the opponent be adaptive: the adaptive opponent as the default, built on bank tiers so that it works on phones; the labels stay as a choice beside it; English first from the spike's planner, bank tiers in the other languages until it covers them | doc 05 §10; doc 03 §14.2 |
| D-42 | Card stats (ATK, DEF, HP, element); characters within a house; relics and potions; items online | keep on the face; give them a role; remove | numbers that do nothing confuse players | **Decided by default (2026-11-19), under that evidence:** take stats off the card face until they have a role in writing; they stay in the card data for the redesign (an order, not a cut). Give each character one condition of its own beyond its signature. Relics and potions stay solo until online rules are written; how they trade score against difficulty is measured in the AI playtests (D-63) and set in the weekly review | doc 04 §12; doc 03 §14.1 |
| D-43 | The Sonnet Man in every starter deck, and his rarity; what rarity means; duplicates; what collecting unlocks | keep; change | a free Legendary in every starter makes rarity meaningless, and the card depends on D-13 | **Decided by default (2026-11-19):** SM-001's place in the starter deck and its rarity wait on his answer (O-1). Rarity stays a collecting tier, not power. Duplicates get a use, designed with Arrocito del Diablo in the card redesign (doc 21 M6); new cards arrive as a small set each quarter after it (doc 25 §7) | doc 04 §12; doc 05 §12 |
| D-44 | A stakes move before round 3 (raise or bow out); a "dispute the verdict" control; win-rate bands; the forms of a five-minute duel | test; skip | each adds a choice or a screen | **Decided by default (2026-11-19), under the owner's rule that AI is the playtester:** build the stakes move and the dispute control behind a switch and compare duels with and without each in the AI playtests (D-63) before either ships; aim for 40 to 60% wins against the adaptive opponent and 45 to 55% against the written one (doc 25 §10.3); the five-minute duel keeps the two-to-four-line forms (doc 10 §5) | doc 03 §14; doc 16 §11 |
| D-45 | Achievement counters | fix ("Completionist" at 71; "Relic Hunter" on relics; wins count matches); leave | the server's 18 account achievements already count matches in this release | **Decided by default (2026-11-19), under the evidence** that the device counters disagree with the server's: fix them to match | doc 05 §6.3; doc 25 §2 |
| D-46 | Theatre wins; a signed-out player's first solo win | pay a card; pay nothing | the playground promises a card for a win; in this release a solo win adds no card to an account | **Decided by default (2026-11-19), under R7** (the site keeps its promises): a Theatre win pays as a `/battle` win does; a signed-out first win adds one card to the device collection, so the promise holds before sign-in | doc 05 §12; doc 10 Q1 |
| D-47 | Language content rules: power words (theme nouns or direct translations); the Chinese 双手 rule; Forest of Arden's name; Illyria's "why" line | keep; change | the current Forest of Arden cast is from A Midsummer Night's Dream; Illyria's line is from Hamlet | **Decided by default (2026-11-19), under the evidence of the plays themselves and the rule that language data comes from authoritative sources:** rename or recast Forest of Arden, and replace Illyria's line with a Twelfth Night line; power words as theme nouns, checked against dictionaries and Wiktionary now and by a native reader once one is paid (O-7); the Chinese 双手 rule stands until a native reader reviews it | doc 04 §4; doc 14 §12 |
| D-48 | Online languages | English only at launch (the 2026-11-17 decision); add a language | the server cannot reproduce the browser's language tools exactly | **Decided (2026-11-17, Part 1.2): English only at launch. Decided by default (2026-11-19):** the next language is the first that the Rust engine reproduces exactly and that has a native reviewer | ADR 0013; doc 26 larger bet 1 |
| D-49 | How Arrocito del Diablo reviews card and balance changes | per change; weekly; per season | | **Decided by default (2026-11-19):** a short weekly review of card and balance changes and of the AI playtests' findings, logged in this document | doc 26 Q7 |

---

## Part 7. Languages

| ID | Decision | Options | Decided | Sources |
|---|---|---|---|---|
| D-50 | Native reviewers (who, how found, budget); review order; the Portuguese variant; the do-not-translate list; unreviewed languages in the picker; which languages marketing names | volunteers; paid reviewers; one language at a time | **Open: O-7**, paying native reviewers. **Decided by default (2026-11-19), under the rule that language data comes from authoritative sources and the evidence of doc 14:** one language at a time in doc 14's order, starting with the launch market's languages; keep Brazilian Portuguese; write "Sonnet Man" and "Shakespeare on the Go" into the do-not-translate list; show unreviewed languages with a "not yet reviewed" note rather than hiding them; marketing names only reviewed languages. Until a reader is paid, each language's text is checked against its authoritative sources and labelled as machine-made (D-34) | doc 14 §12, §14; doc 23 Q6 |

Paying people is not a paid API, so it is outside the "free and self-hosted" rule, but it is still money (O-7).

---

## Part 8. Classroom

| ID | Decision | Options | Decided | Sources |
|---|---|---|---|---|
| D-51 | Show classroom mode before it records progress? Rostering? A pilot school and month? | show now; hide until v1; rostering by Clever, ClassLink and LTI 1.3 (Google sign-in conflicts with the 2026-11-16 direction and ADR 0009) | **Decided by default (2026-11-19), under R7 and the evidence** that classroom is the furthest from ready (doc 26 §11): hide the classroom tour's promises (R7), keep the roster page reachable by link only, and build classroom v1 (seeded assignments, completion without verse text, a teacher-hosted round, commerce off: doc 26 §11); then pilot with one 13+ class, through Devon Glover's network if he agrees. Rostering by Clever and ClassLink; Google only by an explicit owner decision. The school's data agreement for the pilot comes to you when a school is found | doc 19 §6; doc 21 M9; doc 26 §11 |

---

## Part 9. Accessibility

| ID | Decision | Options | Decided | Sources |
|---|---|---|---|---|
| D-52 | An accessibility owner and contact address; phase dates; a budget for disabled playtesters and an audit; the conformance-report format; the Theatre and VR gallery while inaccessible; app-store plans; the company's headcount and turnover (they decide the European Accessibility Act's microenterprise exemption) | | **Decided by default (2026-11-19), under the owner's rules of that day and the evidence of doc 11:** David Charlot owns accessibility until a contractor is hired; the statement's contact is contact@voyagetracable.com. Fix the keyboard blocker first: the duel cannot be played by keyboard today (doc 11 §1). The phases keep doc 11's dates. No disabled playtesters are recruited: each release, AI players run the duel with the keyboard and the screen-reader text alone (doc 15 §8), which says whether it can be finished that way, not how a disabled player experiences it. Keep the Theatre and VR public, naming `/battle` as the accessible equivalent. Publish a WCAG 2.1 AA conformance report in the VPAT format before any US district pilot, ahead of the 2027-04-26 date. No store build is planned (D-59). **Open:** an outside audit (O-7); headcount and revenue (O-9) | doc 11 |

---

## Part 10. Art and audio

| ID | Decision | Options | Decided | Sources |
|---|---|---|---|---|
| D-53 | The scope of the brand-imagery default (Black, of Haitian descent) against the global casting of card characters; whether doc 08 should state the reason for the rule | apply the default to everything; brand imagery only | **Decided by default (2026-11-19), under the rule's own words** ("in generated brand imagery"): brand and marketing imagery only; card characters keep the 2026-11-16 global casting; real poets and Shakespeare's characters as the house tradition casts them. Doc 08 states the rule without the owner's personal background, which stays private in a document for contractors and investors | doc 08 §7 |
| D-54 | Art faults to repaint before launch and who signs off each image; where the PNG masters, prompts and seeds are archived; a single master monogram; a light theme; 3D and AR in the next six months | | **Decided by default (2026-11-19), under the evidence of doc 08:** repaint the eight listed faults before launch; Devon Glover signs off anything that could read as him (until he agrees, nothing that could read as him is made), the owner the rest; archive the masters with their prompts and seeds, recorded in `docs/ASSETS.md`; one master monogram; a high-contrast option first and a light theme later, as doc 08 §4 proposes; 3D and AR work after the duel has players (both orders, not cuts) | doc 08 §6, §13, §14 |
| D-55 | Music direction and a composer budget; loudness targets; whether mute silences the voice; one voice or a voice per character | | **Decided by default (2026-11-19), under "free and self-hosted only" and the evidence of doc 09:** a small set of on-theme loops, made with or chosen by Devon Glover if he agrees; until then CC0 or made in-house; a composer only if one is paid for (O-7). One integrated-loudness target for music and one for effects, measured with one tool (the research found no sourced target for web games: SP §7.5); mute silences everything including the voice; one voice until there are measured voices to choose from | doc 09 §4, §8, §10 |

---

## Part 11. Company, business and launch

| ID | Decision | Options | Decided | Sources |
|---|---|---|---|---|
| D-56 | Will credits ever be sold? Which revenue route first? | never; later with protections | **Decided by the owner (2026-11-19): credits are never sold (R10). Decided by default (2026-11-19), under R10 and the loot-box evidence (doc 25 §3):** packs are never sold either, and there are never ads. Explore, in order: education and arts grants, school licences invoiced yearly, recurring supporters. Each application or contract comes to you to sign | doc 23 §8; doc 25 §3; doc 26 larger bet 9 |
| D-57 | The ask, budget, monthly burn and runway; the pitch's first audience; grants applied for; partners; a market-research budget; first markets | Not known on record | **Open: O-7** (what to spend, a market-research budget included) **and O-8** (the ask and the monthly spend). **Decided by default (2026-11-19), under the research** (SP §7.1): the pitch goes first to education and arts funders and school partners; first markets English-speaking, the US first, then the UK after D-22's Ofcom check | doc 02 ("The ask"); doc 21 Q2; doc 23 |
| D-58 | Trade marks; the operating agreement and IP assignments (including any work by Treston Knight); counsel | | **Open: O-2** (a lawyer to confirm the operating agreement assigns the members' work to the company, and written transfers from anyone else who contributed) **and O-4** (trade marks). **Decided by default (2026-11-19):** every contributor, Treston Knight included, is listed in doc 20 §3 with what they made, so the lawyer knows whose work needs a transfer | doc 20 §3, §10 |
| D-59 | Launch: date and announcer; social accounts and a press address; a logo or wordmark; key art (generated under the imagery default, or commissioned); who approves public copy; a deck link to the live build; portals and stores | | **Open: O-10** (the announcement, and accounts in the company's name). **Decided by default (2026-11-19), under the owner's rules and the evidence of doc 24:** launch quietly after the two deploys of R15, with no fixed public date; the press and public contact is contact@voyagetracable.com; one master monogram (D-54) and a wordmark in the game's display face; key art from a real screenshot of a verdict, not a generated performer; the owner approves all public copy; an itch.io page linking to the site, once O-10 allows the account; no portal build (none fits "no ads"); no store build until account deletion exists (D-21); the deck links to the live build once it is deployed | doc 24; doc 23 §7 |
| D-60 | Shakespeare and other texts: any Folger edition shipped? Publication-year and translator-death checks per language | | **Decided by default (2026-11-19), under the rule that texts come from authoritative sources:** confirm that no Folger text ships (its licence is non-commercial); add the publication-year check and the 1945 rule for Spanish lines to the existing test | doc 20 §8.3 |

---

## Part 12. Engineering and operations, later

| ID | Decision | Decided | Sources |
|---|---|---|---|
| D-61 | Bring the live origin's proxy block into site-ops; rehearse a failover to the mirror; a dated gate-result file per deploy under "land it"; which real phones and headsets the team has; WebKit and Firefox test projects; axe-core (open source, local) as a dependency; how big online play must get before a match should survive a deploy; who holds administrative access to the production database; a Content-Security-Policy | **Decided by the owner (2026-11-19, R16): the proxy block comes into site-ops first. Decided by default (2026-11-19), under "land it, don't gate it", "free and self-hosted only" and the evidence of docs 12 and 15:** rehearse one failover; keep a one-line gate result per deploy in the deploy log; add WebKit and Firefox projects and axe-core now; test the P0 and P1 rows on the phones the studio already tests its other games on (which headsets exist is Not known); store match snapshots only once analytics show a deploy would end real matches; David Charlot is the only database administrator until a second person is hired (O-7); ship a CSP | doc 12 §13; doc 15 §11; doc 17 §11 |

---

## Part 13. People and time

| ID | Decision | Decided | Sources |
|---|---|---|---|
| D-62 | Treston Knight's current role; Devon Glover's and Arrocito del Diablo's hours; who writes the world rules and character sheets; who writes the human opponent banks per language; who runs the first playtests (13+, with consent); who approves copy | **Decided by default (2026-11-19), under the owner's rules of that day:** Arrocito del Diablo writes the world rules and character sheets. Writers per language for the opponent banks are contracted when paid for (O-7), English first, reviewed by Devon Glover for tone if he agrees; until then the English bank grows first. The first playtests are AI playtests (D-63), run on the build host by whoever changes the duel and read by the owner and Arrocito del Diablo; no person takes part, so no consent is needed. The owner approves copy (D-59). Each person's role and weekly hours are written in doc 21 as they give them (Facts to find out) | doc 07 §9; doc 21 §7 |

---

## Part 14. Other questions from the documents

Questions that no part above covered, gathered from the documents' own lists.

| ID | Question | Decided | Sources |
|---|---|---|---|
| D-63 | How is the game playtested? Who runs the playtests, and may students take part? | **Decided by the owner (2026-11-19): AI is the playtester.** No human playtests, paid or volunteer, no think-aloud sessions and no human baselines; no student or other person takes part. **Decided by default (2026-11-19), under that rule:** the design of `15-qa-and-test-plan.md` §8: AI players with no prior training on the game play through what a player sees (the rendered page, or its screen-reader text) and a player's controls, never the scoring code or its constants; self-hosted models released after 2026-04-01, named with their release; measured on time to a first valid verse, voids, rounds won against each opponent and where they get stuck; run on the build host against a local build. Proposed until built | doc 15 §8, Q4; doc 10 §9; doc 26 ranked item 5 |
| D-64 | Which new houses come first, and who chooses the poets? | **Decided by default (2026-11-19), under the 2026-11-16 directions "all languages represented" and "represent everyone":** first a house from each other language's own literature, then the African diaspora and the Caribbean (for example Phillis Wheatley, Paul Laurence Dunbar and the Haitian poet Oswald Durand, each text checked public domain where it was published), and a house built with Devon Glover only if he wants one. Arrocito del Diablo chooses the poets, from public-domain sources | doc 04 §11, Q4 |
| D-65 | Is a sonnet form wanted, and in which languages first? | **Decided by default (2026-11-19), under the evidence on session length** (SD §1): a Shakespearean sonnet form as a separate long mode, never the default duel; English first, where the form checks are measured, then each language as its form rules are measured | doc 04 §11, Q5; doc 10 §5 |
| D-66 | Should the card detail view show each line's source? | **Decided by default (2026-11-19), under the rule that texts come from authoritative sources and the duty to credit CC BY-SA data:** yes, the work and act.scene or line, from `NAMES-AND-QUOTATIONS.md` | doc 04 §8.1, Q9 |
| D-67 | Should device difficulty be priced, or forms dealt so no house gets a free or impossible round? | **Decided by default (2026-11-19), under the evidence** that devices are not equally hard (doc 05 §5.3): measure each device's landing rate per form and language in the AI playtests (D-63); then deal forms so no house gets a free or impossible round; price devices by difficulty as well if dealing alone leaves a gap | doc 05 §5.3, Q7 |
| D-68 | The company site's five Kandinsky films, whose decoder licence excludes the EU, the UK and South Korea | **Decided by default (2026-11-19), under the licence's own terms and "free and self-hosted only":** visitors from those three places see the still paintings in place of the five films (the edge already passes the visitor's country); the five are remade with LTX-2.5, already used for the other two films, under its US$10M revenue condition; the remakes then serve everyone | doc 08 §3, Q9 |
| D-69 | Should world cards have pictures? Should skin tone stay a random cosmetic? | **Decided by default (2026-11-19), under the 2026-11-16 casting direction:** world cards get no new pictures until the card redesign gives them a role (an order); skin tone leaves the random cosmetic draw, and if tone stays, the player chooses it | doc 08 §8, Q6 |
| D-70 | Who reads verses for the real-microphone speech test, on which phones, and by when? | **Decided by default (2026-11-19), under the owner's rule of that day against recruited testers:** no one is recruited to read. The test plays recorded speech from an openly licensed public collection in each language (for example Mozilla Common Voice) through a speaker into the phones the studio already tests on, plus the owner's own voice if he wishes; it runs before Whistle is adopted (D-32) | doc 09 Q4 |
| D-71 | Should a purchase with credits ask for confirmation? | **Decided by default (2026-11-19), under WCAG 2.2 success criterion 3.3.4:** yes, a confirm step on every pack or market purchase, and an undo where possible | doc 11 §4, Q6 |
| D-72 | Should the statistics switch default on outside the EU and wait for opt-in inside it, and how does the game know the region? | **Decided by default (2026-11-19), under the law in each region** (doc 16 §6.1): use the country the edge already passes to the server; in the EU and EEA anything that reads a stored value waits for opt-in, and France has no experiments without consent; the UK and the US default on, with the switch; an unknown country is treated as the EU | doc 16 §6.1, Q3 |
| D-73 | Should the privacy policy's remaining changes and the classroom strings ship before this deploy or after? | **Decided by default (2026-11-19), under R7 (no false statements on the site at deploy):** before this deploy, every item of doc 19 §10 that makes the policy match what the deployed code does (items 2, 3, 5, 6, 9 and 11, the contact becoming contact@voyagetracable.com; item 4 with the economy deploy); items 8 and 13 ship with the features they describe; item 10, the teen summary in 16 languages, right after, once it passes the language checks; the classroom strings with classroom v1 (D-51) | doc 19 §10, Q13 |
| D-74 | How is a pre-registered bar read when two of its clauses disagree (the Whisper bar on `spike/replacements`)? | **Decided by default (2026-11-19), under the project's practice of fixing thresholds before measuring:** the stricter reading holds | doc 21 Q6 |
| D-75 | Which players come first: wordsmiths and daily players, or classrooms? | **Decided by default (2026-11-19), under the evidence** that classroom is the furthest from ready (doc 26 §11): wordsmiths and daily word players first; classrooms after classroom v1 | doc 23 §3, Q1 |
| D-76 | Monthly seasons, or seasons aligned to school terms? | **Decided by default (2026-11-19), under the evidence of doc 25 §4:** one calendar month, with Season 2 running two months to cover World Poetry Day and National Poetry Month; classroom material follows school terms separately | doc 25 §4.1, Q1 |
| D-77 | Who counts as a founding player, given 0 accounts? | **Decided by default (2026-11-19):** every account created before Season 1 starts, each with one logged 500-credit grant; the server's launch date is set to Season 1's start (today it defaults to 2026-04-01, which admits no one) | doc 25 §11, Q4 |
| D-78 | Which languages get a daily verse first, and who reads their prompts? | **Decided by default (2026-11-19), under doc 25 §5.3:** English first; each other language once a native reader has checked its prompts (O-7) and a bank of 60 days exists | doc 25 §5.3, Q6 |
| D-79 | Where the dossier, postmortems and incident reviews live; who keeps the dossier current, and when it is re-checked | **Decided by default (2026-11-19), under the dossier's sharing rules and "land it, don't gate it":** the dossier stays in the game's repository while only the team can read it; before any contractor gets access, document 17 and `sources/` move to a private store. Whoever changes the code updates the documents in the same commit. A light check (links and labels) at each deploy; a full re-check against the code at each milestone. Postmortems in `docs/postmortems/`, committed straight to `main`; incident reviews that involve player content are kept outside the repository, in a private store. Only David Charlot leads an incident until a second person is hired (O-7). A public "making of" postmortem waits until after launch and comes to you, and to Devon Glover for anything about him, before it is published | doc 00 Q1 to Q3; doc 29 Q1 to Q4 |

---

## Facts to find out (not decisions)

These are Not known in the record. Each sharpens a decision above. Most are for the operator or the team to look up; those marked "the owner" only the owner can answer.

1. Which commit is live, and whether production's environment still sets the old cloud-model key (D-10).
2. Whether the February build's AI features were public before 2026-08-02. Less urgent now that R6 marks AI output in this release.
3. Any figures for match length or first-time progress. None exist; the AI playtests will give the first (D-63).
4. The owner: who wrote the English written opponent's verses and the "game's own" card lines, and who wrote the About page's biography (D-34; Part 3).
5. The release dates of LFM2.5 350M, the Whisper base checkpoint, FLUX 3 Image Klein, Parakeet Ultra and Nemotron 3.5 ASR, from their publishers (D-28, D-30, D-33).
6. Whistle's licence (D-32).
7. The owner: whether a hosted Plausible account exists and is paid (D-25).
8. (Answered 2026-11-19: the API's logs now rotate after 30 days, R16.)
9. The sources of the two untraced music tracks, the 14 effects and the model behind the 3D figure (D-08).
10. Whether the thin-verse rule voids every model draft written in the wrong language; whether anything keeps the model off self-harm and sexual topics (D-35).
11. The owner: Treston Knight's current role and what he contributed; the weekly hours Devon Glover and Arrocito del Diablo can give (D-58, D-62).
12. The owner: grants already applied for, and any nonprofit, university or theatre partner for grant applications (D-57).
13. Which headsets the team has (D-61).
14. Which company-site picture of The Sonnet Man is current (doc 08).

## Owner questions

The open list is at the top of this document (O-1 to O-11). A new question from any document is added here: decided by default where the standing rules or the evidence give an answer, open only if it needs the owner's money, identity or contact details, a legal commitment in the company's name, or a public step not yet approved. A decision the owner takes moves to Part 1 with its date.
