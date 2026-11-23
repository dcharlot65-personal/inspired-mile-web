# Sonnet Man: concept one-pager

- **Purpose:** what Sonnet Man is, who it is for, and how far along it is, on one page.
- **Audience:** the team, collaborators and contractors, partners and investors.
- **As of:** commit `0d6df6ef` (the game as it is about to ship), plus the release in flight on 2026-11-19: branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`, and a nightly database backup.
- **Status:** Draft for the team, 2026-11-19.
- **Related documents:** `02-pitch.md`, `03-gdd.md` (the hub), `04-content-and-card-bible.md`, `05-systems-economy-and-balance.md`, `06-modes.md`, `21-production-plan-and-roadmap.md`, `23-market-and-competitors.md`, `26-sota-gap-analysis.md`; also `00-README.md` (index), `28-owner-decisions.md`.

**Labels.** *Built*: in the code at `0d6df6ef`. *In this release*: decided and being made on a named branch, not yet live. *Proposed*: a recommendation. *Not known*: no record found. Sources are in `03-gdd.md`.

## High concept

A free browser card game in which every move is a verse you write or speak, in any of 16 languages, fought as a three-round duel against Shakespeare's characters, with an opponent and a judge that run on your own device.

## Player fantasy

You are the challenger on Shakespeare's stage. Your opponent speaks first: Hamlet, Medusa or Lord Byron throws a verse at you. You choose who answers, perhaps Juliet, and you write back. You might spend ink on a relic that lends you words, or on a potion that ties the next verse your opponent writes. The rules then show, line by line, that your couplet rhymed, that your outcry landed, and that you echoed your character's famous line without just reciting it. You win because you wrote better, not because your card had a bigger number.

## Design pillars

These are reconstructed from what is built and from the owner's recorded direction. No pillar document existed before this one.

| Pillar | What it means in play | Status |
|---|---|---|
| **Your verse is the move** | A card changes *how you must write*: a house device (a question, an outcry, an inner rhyme), a character's signature line to echo, a relic's words to weave in, a curse on your opponent's next verse. | Built |
| **Fair, and shows its working** | Code, never a model, decides whether a verse keeps its form. The verdict shows every check, and the same seed draws the same plan. A model judges only where it was measured to judge well. | Built |
| **Your solo duel stays on your device** | No server reads a solo verse, and no cloud AI is used anywhere. Online duels are scored on the game's own server, by rules only. | Built |
| **Every language is home** | 16 languages, each with forms that its own sound rules can check, and two native forms: the Chinese jueju and the Vietnamese lục bát. | Built for solo play; online play is English only |

The original brief was built around a fifth idea: a real performer at the centre, Devon Glover, "The Sonnet Man". None of his own work is in the game yet: it holds no recording, verse or music of his. Making it a pillar is *Proposed*, and only after he has been asked (see `07-narrative-and-performer-bible.md`).

## Audience

- **Who can play (built).** Anyone aged 13 or over with a browser. Under-13s are blocked by an age gate, and 13 to 17 need a parent's permission. Solo play needs no account and no download. Online play needs an account, made with a passkey.
- **Who it is for (Proposed, from the research).** Secondary English teachers and their students aged 13 to 17; adult wordsmiths, poets and rappers; language learners; and Devon Glover's existing audience. Shakespeare is in the set texts of England's GCSE English Literature, which 87% of students sit, and in the US Common Core standard RL.11-12.7, which states adopt one by one (research: `research/sota-design-2026-11.md` §6).
- **Measured audience:** none yet. The production database had 0 accounts on 2026-11-19.

## Platform

- A web app at sonnetman.inspiredmile.com, installable as a PWA, on desktop and phone. The site says the collection and trivia work offline once visited; nothing has tested that, and the service worker keeps only pages already fetched (`sources/as-built-tech.md` §1.5).
- **The Theatre** stages the same duel in 3D on any screen. WebXR modes for Meta Quest 3 (passthrough) and Apple Vision Pro (a full stage) are coded, but tested only in an emulated Quest 3, never on a real headset (`sources/as-built-design.md` §9).
- **AI on the device.** On a desktop with WebGPU and 8 GB or more, the player may download Gemma 4 E2B (3.1 GB) to write the opponent's verse and, in some languages, to judge. Everywhere else, phones and headsets included, the opponent plays verses written in advance and fixed rules judge. Those verses were drafted by a language model and checked by tools; who wrote the English bank is Not known (`sources/as-built-tech.md` §6.4).

## What no other game does

The research found no game shipped in 2024 to 2026 in which players write verse that code and a model then score at scale. Sonnet Man adds four things on top of that:

- forms checked by sound in 16 languages, with sourced pronunciation data;
- an AI that is only the sparring partner and the referee, never the author of your move;
- no ads and no real-money purchases;
- a Shakespeare and hip-hop brand named for a living performer-educator, Devon Glover. Whether he is involved is Not known: no agreement with him is on record (`20-legal-and-licence-register.md` §7).

The same research found no proof of demand. Its closest analogue, a party game with a local AI judge, drew one Steam review and was delisted.

## Honest status

| Built (at `0d6df6ef`) | In this release (2026-11-19) | Not built |
|---|---|---|
| The solo duel in 16 languages: 12 verse forms, 13 house devices, 71 cards, the written opponent, the rule judge and the model judge | The judge's wording goes back to main's, under which 14 languages passed instead of 4 (`fix/judge-wording`) | Story mode (a stub: one encounter can be read, none played) |
| The Theatre in 3D on a flat screen | A server-authoritative economy: fixed rates with daily caps, cards only from the server, rankings only from server-judged matches (`fix/server-authority`) | Season Pass progress, and tournaments that can be played |
| Online duels in English, scored by the server's rules | The English voice rebuilt without its GPL eSpeak NG part (`fix/voice-g2p`) | Any recording, verse or music by Devon Glover |
| Passkey accounts, the PWA, trivia and quote challenges | A credits page for CC BY-SA data, an EU AI Act notice, privacy wording and asset provenance (`fix/compliance`) | A model for phones and headsets |
| Partial: classroom rosters, the marketplace, the 3D viewer (one model of 18), WebXR (coded; tested only in an emulated headset) | A nightly backup of the database, kept 14 days | Credits that can be earned or spent from any page |

## Questions for the owner

Settled on 2026-11-19 in `28-owner-decisions.md`: decided by default under the owner's standing rules where a sensible default existed; open only where it needs the owner's money, identity or contact details, a legal commitment in the company's name, or a public step not yet approved.

1. Which design pillars does the team accept, and does Devon Glover want a fifth about his own performance? **Decided by default:** the four pillars above; a fifth only if Devon Glover wants one, which is his to say (28 D-38).
2. Is the game a "verse duel" or a "rap battle"? The site uses both names. **Decided by default:** "verse duel", as built, until Devon Glover says otherwise (28 D-37).
3. Is the classroom audience 13 and over by decision? **Decided by default:** yes, 13 and over, for this release and the first pilot (28 D-23).
