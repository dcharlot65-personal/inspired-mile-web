# Sonnet Man: pitch narrative and deck outline

- **Purpose:** the story we tell investors and partners, and a 12-slide deck outline with speaker notes, every claim traceable.
- **Audience:** the founders first, who will present it; then investors, education and arts funders, school partners and other partners.
- **As of:** commit `0d6df6ef`, plus the release in flight on 2026-11-19 (`fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p`, `fix/compliance`, and a nightly database backup).
- **Status:** Draft for the team, 2026-11-19. Not for sending until the open owner questions at the end (the ask, the monthly spend and Devon Glover's agreement: `28-owner-decisions.md` O-1 and O-8) are answered.
- **Related documents:** `01-concept-one-pager.md`, `03-gdd.md`, `21-production-plan-and-roadmap.md`, `22-risk-register.md`, `23-market-and-competitors.md`, `24-marketing-press-kit-and-store-pages.md`, `20-legal-and-licence-register.md`, `07-narrative-and-performer-bible.md`; also `00-README.md` (index), `28-owner-decisions.md`.

## How this document handles evidence

- **Labels.** *As built*: in the code at `0d6df6ef`. *In this release*: decided and being made on a named branch, not yet live. *Proposed*: our recommendation. *Not known*: no record found, and listed under "Owner questions".
- **Market numbers come only from the dossier's research**, with the source the research recorded. `R-des` is `research/sota-design-2026-11.md` and `R-prod` is `research/sota-production-2026-11.md`. A figure the research marks as an estimate or a vendor's survey is said to be one here.
- **No total market size is given.** The research could not verify one: Newzoo's figures were blocked (`R-prod` §7.15). Do not add a TAM figure from memory.
- **Devon Glover is a real person.** This pitch quotes nothing from him and claims no endorsement or approval. Whether he has reviewed the game is Not known (`sources/as-built-design.md` §6.1). Nothing about him goes on a slide until he has agreed in writing to how his name is used (`R-prod` §5.8).

---

## Part 1. The pitch narrative

### The opening: a duel you win by writing

A Shakespeare character speaks first. Say Hamlet, under the rules of a rhyming couplet. You choose who answers: Romeo, perhaps. Romeo's device is the inner rhyme, two words rhyming inside one line, and his signature is his own famous line, which you must echo without reciting it. You type your couplet, or you say it aloud. Before you submit, a live checklist shows what your verse still has to do. Then the verdict shows every check that passed, the points each one earned, and who took each of four criteria: wordplay, allusion, flow and wit. You win because you wrote better, not because your card had a bigger number.

That is Sonnet Man, a free card game in the browser, in 16 languages. The opponent and the judge run on the player's own device (as built: `03-gdd.md` §4).

### Why this is an opening

- **Nobody ships it.** The research found no game shipped in 2024 to 2026 in which players write verse that code and a model then score at scale (`R-des`, "Bottom line" and §2). Its precedents are small party games, and the AI rap apps it found let the model coach but not decide who won.
- **Shakespeare is set in many schools, and often taught dry.** The US Common Core standard RL.11-12.7, which states adopt one by one, asks for at least one Shakespeare play in grades 11 and 12. In England, 87% of students sit GCSE English Literature, which requires a Shakespeare play and Romantic poetry; the 2025 government review blamed "a 'dry' curriculum diet" (`R-des` §6, Common Core State Standards; DfE-commissioned review, November 2025).
- **Spoken and performed verse already reaches millions through schools.** Poetry Out Loud has reached more than 4.6 million students, 89,000 teachers and 22,000 schools since 2005 (NEA). The Folger says more than two million teachers and students use its materials each year (`R-des` §6).
- **Short daily word play is a mass habit.** NYT Games puzzles were played 11.2 billion times in 2025, Wordle alone 4.2 billion times (AP, 2026-01-21; `R-des` §2).
- **Players reward AI that referees and punish AI that replaces craft.** In a late-2025 survey of 1,799 gamers, 85% were negative about generative AI in games and 83% about AI-written dialogue, while difficulty adjustment was the most accepted use (Quantic Foundry, via GamesMarket, 2025-12-22; a sample skewed to core PC players: `R-des` §3). In Sonnet Man the player writes, and the AI only spars and judges.

### Why now

- **Small open models now run in the browser.** Gemma 4 (released 2026-04-02, Apache 2.0) and Liquid's LFM3 1.7B (2026-10-27) both run through Transformers.js on WebGPU (`R-prod` §2.1; `docs/research/in-browser-ai-2026-11.md`). A free game can therefore give an AI opponent to anyone with a capable desktop, with no inference bill per player.
- **Regulation now rewards the privacy-first design.** EU AI Act Article 50(1) has required an AI notice at first interaction since 2026-08-02. The amended US COPPA rule has been enforceable since 2026-04-22 (`R-prod` §0). A game whose solo verses never leave the device has less to disclose and less to protect. Its AI notice is in this release (`fix/compliance`).

### What we have built

As built, at `0d6df6ef`:

- **The solo duel**, in 16 languages:
  - 12 verse forms, checked by code against pronunciation data from authoritative sources;
  - 71 cards: 53 characters in 13 houses (Shakespeare, the Romantic and Gothic writers, Greek myth) plus The Sonnet Man's own Legendary card, and 9 relics and 9 potions;
  - 13 house devices and a signature line for every character.
- **An opponent for every device.** A written opponent and a rule judge on every phone and browser; an optional AI opponent (Gemma 4 E2B) on capable desktops.
- **The Theatre**: the same duel staged in 3D. WebXR modes for Meta Quest 3 and Apple Vision Pro are coded; they have been tested only in an emulated Quest 3, never on a real headset.
- **Online duels** in English, scored on our own server by the same rules. A test suite of about 35,000 shared cases holds the Rust server engine to the browser's.
- **The rest of the site:**
  - passkey accounts, with no passwords and no Google;
  - an installable PWA;
  - Shakespeare trivia (200 questions in 16 languages) and quote challenges (104).

What is partly built or missing is in Part 3 and in `03-gdd.md` §14. The pitch must not hide it.

### Traction, honestly

- **No players yet.** The production database had 0 accounts on 2026-11-19.
- **No usage data.** The site loads page-view analytics only after its age gate. No game event is recorded (`sources/as-built-tech.md` §9).
- **The rebuilt game is not live yet.** The live site is presumed to run an earlier version. The rebuild, 659 commits made from 2026-11-16 to 2026-11-18 (599 of them past `main`) by the founder working with AI coding agents, is the release in flight.
- **This release makes the economy, the judge, the licences and the attribution trustworthy.** It does not yet make online play safe at scale: reports that someone reads, block and mute, and keeping teens from adult strangers are still open, as are EU AI Act Article 50(2) marking and a written licence from Devon Glover (`26-sota-gap-analysis.md` §13 and §14).
  - The economy becomes server-authoritative: fixed rates with daily caps, cards only from the server, rankings only from server-judged matches (`fix/server-authority`).
  - The AI judge's wording is restored, under which 14 languages passed the judging bar instead of 4 (`fix/judge-wording`).
  - A licence defect in the English voice is removed (`fix/voice-g2p`).
  - Attribution, an AI notice, privacy wording and asset provenance are added (`fix/compliance`).
  - A nightly database backup, kept 14 days, was set up and restore-tested on 2026-11-19.

### The ask

**Not known.** The 2025 project brief named a seed of $300K to $1M from grants and angel investors (`PROJECT_BRIEF.md`). Whether that still stands, and what it would buy, has not been decided in any record we found. The deck's last slide is a placeholder until the owner answers.

---

## Part 2. The 12-slide outline

Each slide has a headline that states its point, what appears on it, the visual, and speaker notes. Every number carries its source on the slide in small type.

### Slide 1. Sonnet Man: duel in verse, in your language, in your browser

- **On the slide:** the name; the line "Every move is a verse you write or speak"; "Free. 16 languages. Nothing you write leaves your device in a solo duel."; the company line "Inspired Mile (Voyage Tracable, LLC)".
- **Visual:** a real screenshot of a verdict, with the checks ticked and the totals. Do not use generated key art of a performer. If generated brand imagery is used anywhere in the deck, its central people are Black, of Haitian descent, by default (the owner's standing rule). That rule never applies to depicting Devon Glover: only his own photographs, with his written consent.
- **Speaker notes:** "Sonnet Man is a card game in which you never play a number. You play a verse. A Shakespeare character opens, you choose who answers, and you write back, in English or any of fifteen other languages. The rules check your craft, and on a capable desktop an AI that runs in your own browser spars with you and helps judge; on a phone, a written opponent and the rules do. In the next three minutes: what it is, why it is new, what is built, and what we need."

### Slide 2. Shakespeare is set in US and English classrooms, and the way it is taught is under review

- **On the slide:**
  - The US Common Core standard RL.11-12.7 asks for at least one Shakespeare play in grades 11 and 12 (adopted state by state).
  - In England, 87% of students sit GCSE English Literature, which includes Shakespeare and Romantic poetry. The 2025 review blamed "a 'dry' curriculum diet" and asked for more speaking and drama (DfE-commissioned review, November 2025).
  - Poetry Out Loud has reached 4.6M students and 22,000 schools since 2005 (NEA).
- **Visual:** three numbers, nothing else.
- **Speaker notes:** "In England nearly nine in ten students sit an exam that includes a Shakespeare play, and the US Common Core asks for one in the last two years of school. The review of England's curriculum asks for more speaking, listening and drama. The largest US recitation programme has reached four and a half million students. The need is real. What is missing is a way to *write* verse, and to be answered, that feels like play."
- **Source:** `R-des` §6.

### Slide 3. One minute of play: write, submit, see why you won

- **On the slide:** a 60-second capture of a real duel, in which a spoken verse is transcribed and scored. Under it: "Form checked by code. Card effects shown. Verdict explained."
- **Visual:** the capture. The research recommends this exact asset (`R-prod` §7.1). Record it from the build after this release, typed and spoken, in English and in one other language.
- **Speaker notes:** "Watch the checklist as I type: two lines, the rhyme, Romeo's inner rhyme, two words of his line echoed. I spend one ink on Yorick's Skull, which lends me five words; two of them earn six points. When I submit, you can see which checks passed and which side took wordplay, allusion, flow and wit. Nothing here is a black box."

### Slide 4. Cards change how you write, not what number you hit

- **On the slide:** a four-part diagram of a duel round:
  - the **form** (couplet, haiku, acrostic and nine more);
  - the **character** (its house device and its signature line);
  - the **relic** (five power words) and the **potion** (a curse on the opponent's next verse);
  - the **verdict**: craft from code, plus 24 judge points.
- **Visual:** a card face showing its device and signature, which do something in play, not ATK, DEF and HP, which do nothing (see `03-gdd.md` §14.1).
- **Speaker notes:** "A card is a writing constraint with a reward. Juliet's house rewards an outcry, Hamlet's a question, Macbeth's a drumbeat repetition. A relic gives you words to weave in. A potion ties your opponent: no letter S, or no word longer than six letters. Three rounds, with an ink budget: spend early or save for the decider. Ties go to the side the judge preferred, then to the challenger."

### Slide 5. Nobody ships this, and the rest of the industry shows why it can work

- **On the slide:**
  - No game shipped in 2024 to 2026 lets players write verse that code and a model score at scale (`R-des` §2).
  - Players accept scores that explain themselves, such as NYT's Cross Bot and Duolingo's Explain My Answer (`R-des` §2, §4).
  - 85% of core gamers are negative about generative AI in games; AI in systems, like difficulty, is the most accepted use (Quantic Foundry, 2025; `R-des` §3).
- **Visual:** a two-column table, "AI writes for you" (rejected) against "AI spars and referees" (Sonnet Man).
- **Speaker notes:** "The space is open, and we should be honest that open also means unproven. The closest thing we found, a party game with a local AI judge, drew one Steam review and was delisted. What we take from the industry: show your working, keep the human's work at the centre, and keep the AI to refereeing. Our design does all three."

### Slide 6. Private by design: the solo duel never leaves the device

- **On the slide:**
  - In a solo duel, no server reads the verse, the voice or the model's output (as built).
  - No cloud AI anywhere: online duels are scored by fixed rules on our own server (as built).
  - Speech is transcribed in the browser, and the recording never leaves the device (as built).
  - The research found that no procurement checklist rewards on-device AI yet, so our privacy documents have to make the argument (`R-des` §6).
- **Visual:** the architecture in one picture: the browser holds the duel; dashed arrows go to the model download and to analytics after the age gate; a solid arrow to our server for online verses only.
- **Speaker notes:** "This is our cost model as much as our values. No per-player inference bill means 'free, no ads' can last. It also answers the first question a school asks. We will not claim the AI judges your verse on a phone. On phones the opponent plays verses written in advance, and the rules judge. We say so on screen."

### Slide 7. Three audiences, each with a measured habit

- **On the slide:**

  | Audience | Evidence of the habit | Source |
  |---|---|---|
  | Classrooms | Clever: 60% of US students log in monthly, at 111,000 schools. The top classroom games are live quiz tools: Kahoot!, Blooket, Wayground, Gimkit | `R-des` §6 |
  | Word players | NYT Games: 11.2B plays in 2025. LinkedIn Games: 84% return the next day (company-reported, undated) | `R-des` §2 |
  | Card players | Slay the Spire 2: about 7M units in about three months (Video Game Insights estimate). Pokémon TCG Pocket: $741.4M net in year one (AppMagic estimate; another report says about $1.3B) | `R-des` §1, §7 |

- **Visual:** the table.
- **Speaker notes:** "We are not claiming a market size. Our research could not verify one, so we show habits instead. Teachers already run short game sessions in class. Word players come back daily. Card players pay for fresh content, though our design deliberately sells none. Our channel thesis is classrooms and the Shakespeare and spoken-word circuit, not web portals: the portals' card charts are solitaire and UNO-style games (`R-des` §1)."

### Slide 8. Free, no ads, no random packs: how this pays is an open question

- **On the slide:**
  - As built: every feature is free; nothing is sold for real money; no blockchain, no wallet, no ads. Credits cannot yet be earned or spent from any page.
  - In this release (`fix/server-authority`): credits are earned at fixed rates with daily caps, and are never sold.
  - Candidate revenue, all *Proposed* and none researched in depth:
    - school licences, invoiced yearly;
    - education, arts and literacy grants;
    - recurring supporters, as with Lichess's donations;
    - events with the performer, if he agrees.
  - Never: paid random packs (`R-des` §7).
- **Visual:** a simple list. No revenue chart, because we have no numbers.
- **Speaker notes:** "We chose a model that keeps a game for teenagers out of trouble. EU consumer principles on in-game currency do not cover currency that can only be earned. Paid random packs bring rating and legal risk. The research names school licences, grants and supporter models as the fitting routes, and says plainly that it could not research their prices. We will be specific once the ask is set."
- **Source:** `R-des` §7; `R-prod` §5.7.

### Slide 9. Where we are: a complete game, an empty database, a release in flight

- **On the slide:** three columns.
  - **Built:** the solo duel in 16 languages; the Theatre; online English duels; accounts; the PWA.
  - **In this release:** a server-authoritative economy; the judge's wording restored; the voice licence fixed; attribution and the AI notice; nightly backups.
  - **Not built:** story mode; a model for phones; seasons and tournaments that can be played; any recording by Devon Glover.
  - Under the columns: "0 accounts on 2026-11-19. No usage data yet."
- **Visual:** the three columns.
- **Speaker notes:** "We would rather you hear the gaps from us. The core game is done and tested, about 1,100 automated tests across browser, server and model suites, by a static count. The systems around it, seasons, tournaments and the marketplace, were scaffolded and are being made trustworthy before anyone plays. We have no players yet. The first numbers we will bring you are first-verse conversion and day-one and day-seven return (see `16-analytics-and-tracking-plan.md`)."

### Slide 10. The team, stated plainly

- **On the slide:**
  - **David Charlot, PhD:** founder and technical lead.
  - **Devon Glover, "The Sonnet Man":** creative director, as the About page lists him. Show this line only with his written agreement.
  - **Arrocito del Diablo:** co-founder, game design and card mechanics.
  - The About page also lists Treston Knight for operations. Confirm before showing.
  - "The 2026 rebuild was written by the founder working with AI coding agents."
- **Visual:** names and roles. Photographs only if each person has agreed.
- **Speaker notes:** "Say how the work was done: a small founding team and AI coding agents, with every rule measured and tested. Say what Devon Glover's role is only in words he has approved. Today the game contains none of his recordings, verses or music; any plan for them is his to agree."

### Slide 11. The next six months: teach the first verse, reach phones, open classrooms

- **On the slide** (all *Proposed*; details in `21-production-plan-and-roadmap.md`):
  - A first verse in seconds, before any model download. Poki saw conversion to play rise from 50% to 72% when loading fell from 29.5 s to 3.7 s (`R-des` §4).
  - A stronger opponent on phones, made from human-written verses tiered by difficulty (`03-gdd.md` §14.2).
  - Story mode as the guided first campaign.
  - Classroom mode with rostering, teacher controls, and the marketplace and referrals switched off (`R-des` §6).
  - Compliance dates to meet: EU AI Act Article 50(2) marking, which the cautious reading says applies from this deploy, because the AI features first reached the public after 2026-08-02 (`13-ai-design-and-system-cards.md` §7.2); Vermont's design code from 2027-01-01 (`R-prod` §0).
- **Visual:** a timeline with those items.
- **Speaker notes:** "Each item answers a finding. Players leave slow-loading web games, so the first verse must not wait for a three-gigabyte model. Phones are most players, and today they meet a small bank of written verses. Schools buy through rostering and privacy reviews. And the law has dates on it."

### Slide 12. The ask

- **On the slide:** *Not known.* A placeholder for the amount, the instrument, the use of funds, and the milestones they buy.
- **Visual:** none until decided.
- **Speaker notes:** "To be written once the owner sets the ask. It should give: how much; from whom (grants, angels or partners); what it buys, in months of work times monthly cost, as Raw Fury asks of pitches; and the two or three milestones it reaches. A live build link should be on this slide (`R-prod` §7.1)."

---

## Part 3. What a pitch reader will ask, and the honest answers

| Question | Answer | Source |
|---|---|---|
| Does the AI judge every duel? | No. A model judges only on a capable desktop that downloaded it, and only in the languages where it was measured to judge well. Everywhere else, phones included, fixed rules judge. In this release the judge's wording is restored, and its languages are measured again. | `03-gdd.md` §4.10 |
| Is it a rap battle? | The site calls it both a "rap battle" and a "verse duel". Play has no beat, no music timing and no delivery score. Which to call it is an owner and Devon Glover question. | `sources/as-built-design.md` §6.10, §9 |
| Is Devon Glover's work in it? | No. No recording, verse, voice or music of his is in the game. He is named on the About page and as the game's namesake. | `sources/as-built-design.md` §6.1 |
| Can people cheat the economy? | As built, yes: the server trusted the client's numbers. This release makes it server-authoritative. | `sources/as-built-tech.md` §12; `fix/server-authority` |
| How many players? | None yet. | the owner's check, 2026-11-19 |
| What does a player need? | A browser. A model is optional, desktop only, and 3.1 GB. | `03-gdd.md` §9 |
| What about children? | Under-13s are blocked. 13 to 17 need a parent's permission. Online play pairs any two accounts today; the research recommends safeguards before verses are shown to strangers. | `03-gdd.md` §8; `R-prod` §4.3 |

## Claims never to make

- That a model judges on phones, or in all 16 languages.
- That Devon Glover endorses, approved, voiced or wrote anything in the game, unless he has said so in writing.
- Any market size, user count or revenue figure not in the research, and none of ours, because we have none.
- That the Season Pass, tournaments, story mode or classroom progress work. They do not yet (`03-gdd.md` §6).
- "No AI" or "no servers": online verses are scored on our server, and the opponent may be an AI model.

## Owner questions

Settled on 2026-11-19 in `28-owner-decisions.md`: decided by default under the owner's standing rules where a sensible default existed; open only where it needs the owner's money, identity or contact details, a legal commitment in the company's name, or a public step not yet approved.

1. **The ask.** How much, from whom, in what form, for which milestones? Does the 2025 brief's $300K to $1M still stand? **Open (28 O-8):** what will the company ask funders for?
2. **First audience.** Who is this pitch for first? **Decided by default:** education and arts funders and school partners, as the research suggests (`R-prod` §7.1) (28 D-57).
3. **Budget and burn.** Monthly cost and runway are not recorded anywhere. **Open (28 O-8):** what does the company spend each month now? What it can spend next year is 28 O-7.
4. **Devon Glover.** These are his to answer, as part of the agreement you would ask him for (**Open, 28 O-1**; the questions to put to him are in 28 Part 3):
   - May his name, title and photograph appear in the deck?
   - Will he sign a written licence for his name and persona, as the research recommends (`R-prod` §5.8)?
   - What does he want said about his role?
5. **The team.** Is Treston Knight on the current team, and in what role? **Fact to find out** (28, Facts to find out, 11); any work he contributed is listed so that a lawyer can arrange a written transfer (28 D-58, O-2).
6. **Revenue model.** Which routes should the deck present? **Decided by default:** education and arts grants, then school licences invoiced yearly, then recurring supporters; never ads; credits and packs are never sold (28 D-56).
7. **Grants and programmes.** Were any of those named in the roadmap applied for, such as NSF SBIR or Meta Horizon Start? **Fact to find out** (28, Facts to find out, 12).
8. **Live build.** May the deck link to the live game? **Decided by default:** yes, once this release is deployed (28 D-59).
9. **The name.** "Verse duel" or "rap battle"? **Decided by default:** "verse duel" until Devon Glover says otherwise (28 D-37).
