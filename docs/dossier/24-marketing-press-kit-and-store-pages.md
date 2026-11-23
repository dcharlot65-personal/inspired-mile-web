# Marketing, press kit and store pages

**Purpose:** Give the team the words, the facts and the plan to present Sonnet Man to players, teachers, press and platforms, claiming only what runs.

**Audience:** The team (David Charlot, founder and technical lead; Devon Glover, "The Sonnet Man", creative director; Arrocito del Diablo, co-founder for game design and card mechanics), future collaborators and contractors (copywriters, video editors, community managers), and investors.

**As of:** Commit `0d6df6ef` (branch `integrate/wave3`, 2026-11-18), plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`, and the nightly database backup set up on 2026-11-19.

**Status:** Draft for the team, 2026-11-19. No copy here is approved. Nothing here may name or show Devon Glover until he has agreed in writing.

**Related documents:** `21-production-plan-and-roadmap.md`, `22-risk-register.md` (R01, R41, R45), `23-market-and-competitors.md` (segments, personas, positioning), `25-live-ops-plan.md` (the calendar), `02-pitch.md`, `08-art-bible.md`, `09-audio-bible.md`, `13-ai-design-and-system-cards.md`, `19-privacy-pack.md`, `sources/as-built-design.md`, `sources/as-built-tech.md`, `research/sota-design-2026-11.md`, `research/sota-production-2026-11.md`; also `00-README.md` (index), `28-owner-decisions.md`.

> **How to read the labels.** **As built**: in the code at `0d6df6ef`. **In this release**: decided on 2026-11-19, being done on the named branch. **Proposed**: a recommendation, with the research behind it. **Not known**: unrecorded; in the Owner questions.
>
> **Citations.** "design §x" is `sources/as-built-design.md`; "tech §x" is `sources/as-built-tech.md`; "sota-design §x" and "sota-production §x" are in `research/`.

---

## 1. The rules for every word we publish

1. **Claim only what runs.** If a sentence describes a feature, a player must be able to use it today, on the device the sentence implies. Section 2 lists what may and may not be said.
2. **The verse is the player's.** Lead with writing, not with AI. Most core gamers dislike generative AI in games, AI dialogue most of all, while AI used inside a game's systems draws the least objection (sota-design §3). The AI is the sparring partner and the referee, never the star.
3. **Devon Glover appears only as he agrees.** No name, photo, voice, quote, biography or implied endorsement without his written agreement (`22-risk-register.md` R01). Never generate his likeness or voice. Never write words for him.
4. **Real gameplay only.** Every video and screenshot is captured from the running game. Hip-hop audiences doubted a game whose trailer looked AI-made and showed no gameplay (sota-design §9).
5. **Say plainly what is AI.** One sentence, at the first interaction and on every page that describes the game (sota-production §5.4).
6. **Generated brand imagery** (key art, banners, social cards): the central people are Black, of Haitian descent, by default. This never applies to depicting a real person. Disclose that the image is AI-generated.
7. **No pressure, no children targeted.** No countdowns, no "only today" offers, nothing aimed at under-13s, who are blocked by the age gate anyway (design §8; sota-production §5.6).
8. **Free and self-hosted.** No paid ad networks, no paid tracking pixels, no third-party AI services to make marketing assets.

---

## 2. What we may and may not claim

### 2.1 Claims we may make now (As built)

| Claim | The truth behind it | Evidence |
|---|---|---|
| "A duel of verses." | Three rounds; the first to two wins | design §1.2 |
| "Write it or say it." | A text box of 600 characters, and a microphone that transcribes on the device. Speech is tested in English only, so the FAQ must say so | design §1.2, §8 |
| "In sixteen languages." | Solo duels and the interface in all 16. Online, multiplayer, privacy and terms pages are English | design §8 |
| "Twelve poetic forms, checked by code." | Couplet, quatrains, tercet, anaphora, acrostic, crescendo, epistrophe, haiku, heroic couplet, jueju, lục bát; nine in English | design §1.4 |
| "Free. No ads. No real-money purchases." | Nothing is sold; the About page and terms say so | design §9 |
| "No download needed to play." | "Play now without a download" starts the written opponent and the rule judge | design §8 |
| "Your solo duel never leaves your device." | No solo verse, audio or model output is sent anywhere | tech §1.6 |
| "No AI runs on our servers." | Online duels are scored on the server by fixed rules, with no model | tech §0, §5 |
| "On a capable computer, a small AI runs in your browser." | Gemma 4 E2B, a 3,100 MB download, on desktops with WebGPU and enough memory; it writes the opponent's verse in 12 languages at `0d6df6ef`, and 13 after this release (Gemma 4 E2B gained Vietnamese in `ee2bf5ad`, which every release branch carries) | design §1.8; `ee2bf5ad` |
| "Duel a friend online, in English." | Quick match or a private link; needs an account; 180 seconds a round | design §5 |
| "71 cards from Shakespeare, the Romantic poets and Greek myth." | 53 characters, 9 relics, 9 potions | design §2, §6.2 |
| "Sign in with a passkey, no password." | Passkeys; email codes exist but are off in production | design §8; tech §1.3 |
| "Install it like an app." | An installable web app with an offline page | design §8 |

### 2.2 Claims we may not make, and why

| Do not say | Why | Evidence |
|---|---|---|
| "Duel an AI on your phone." | Phones, tablets and headsets are offered no model; the written opponent plays | design §1.8 |
| "An AI judge in every language." | A model judges in 4 languages at `0d6df6ef`; in this release the wording returns to the version that passed 14 in an A/B; the rules judge everywhere else | design §1.7; `fix/judge-wording` |
| "Rap battle." | It is a verse duel: no beat, no delivery, no timing to music. The term would mislead the audience that tests hip-hop games hardest | design §9; sota-design §9 |
| "Made with / performed by / the game of Devon Glover." | No recording, verse, voice or music of his is in the game, and no licence is recorded | design §6.1, §11 |
| "Shakespeare on the Go." | The name of Devon Glover's programme | design §6.1 |
| "15-second AI scenes for every card." | Not built; each card's scene is a sentence of text | design §9 |
| "+50 credits a battle" (or any rate) | Not wired at `0d6df6ef`. In this release the server sets fixed rates with daily caps in `backend/data/economy.json` (05 §7.1); quote a rate only once the pages show it. The owner accepted the rates as tunable launch values (R9), and the site is to show the real rates, read from `economy.json` (decided by default: 28 D-05) | design §4.6; `fix/server-authority` |
| "Track your students' progress." "FERPA compliant." | No progress is recorded; nothing supports the compliance claim | design §3, §4.13 |
| "Walk through your collection in VR." | The gallery shows the whole catalogue | design §7.6 |
| "See every card in 3D and AR." | One model exists, The Sonnet Man's, and it is a point cloud | design §7.6 |
| "Unlock variants through battles and exploration." | Only a perfect trivia round awards one | design §4.12 |
| "Win a round, earn a card." | Only a won match pays a card | design §10, item 11 |
| "Season Pass." "Tournaments." | Neither can be played through from a page | design §3 |
| "Play in your headset." | Tested only on an emulated Quest 3; headsets get no model | design §3, §7.5 |
| "Learn Shakespeare" or any learning outcome | No study of the game exists | sota-design §6 |
| "Playtested with players", "players find it easy", or anything "human-level" | The playtesters are AI players, by the owner's rule of 2026-11-19 (Proposed plan: `15-qa-and-test-plan.md` §8). An AI result may be quoted only as what was measured, with which AI player and version, never as what people would do | 28 D-63 |
| "Nothing leaves your device." (without "solo duel") | Online verses go to the server; analytics load after the age gate; model downloads tell the model host the player's address | tech §1.4, §9 |

### 2.3 Copy already on the live site to fix (Proposed)

These pages make the promises in 2.2. In this release `fix/compliance` fixes only the referral reply (it no longer promises packs); the other rows remain to fix.

| Page | Promise | Fix |
|---|---|---|
| About | 15-second AI scene; +50/+30/+20/+10 credits; "card value is influenced by combat rankings" | Remove, or state the server's real rates once set |
| Classroom tour | Progress, scores and cards per student; "FERPA compliant" | Remove until built and assessed |
| VR gallery | "Walk through your collection" | "Walk through the catalogue" |
| World map | Variants "through battles, trivia, and exploration" | "Through a perfect trivia round" |
| Playground | "Win a round and earn a random card"; "rap battle" in the tour | "Win a match"; "verse duel" |
| Home | Advertises the Theatre with no link | Link it, or drop the line |
| Referral reply | "You get 5 free packs!" | **Fixed in this release** (`fix/compliance`, `2df321b1`): the words now say the referrer gets 100 credits and the redeemer nothing |
| Sitemap | Lists `/trivia/` and `/challenges/`, which do not exist | Remove them |

---

## 3. Positioning lines (Proposed)

### 3.1 One line

> **Write a verse. Win the duel.**

### 3.2 Taglines to test

- "Your verse. Your language. Your move."
- "A duel of verses, in sixteen languages."
- "Shakespeare dealt you the cards. The lines are yours."
- "The form is the fight."

### 3.3 Elevator pitch (about 50 words)

> Sonnet Man is a free card game where every move is a verse you write or speak. Pick a character, answer your opponent under a poetic form, from couplet to haiku, and the game's rules check your lines as you write. Sixteen languages. No ads. Your solo duels never leave your device.

### 3.4 Boilerplate (about 100 words)

> Sonnet Man is a free web card game by Inspired Mile, the trading name of Voyage Tracable, LLC, of Sarasota, Florida. Each move is a short verse that the player writes or speaks, in one of sixteen languages, in a three-round duel. Cards come from Shakespeare, the Romantic poets and Greek myth; each lends a device, such as alliteration or a closing question, that the verse can land for points. Fixed rules check every form. On capable computers, a small AI model runs in the browser to write the opponent's verse; nothing from a solo duel leaves the device. The game has no ads and no real-money purchases.

Every clause is As built (design §1, §2, §6.1, §9; tech §1.6).

### 3.5 Messages by audience

| Audience | Lead with | Then | Never |
|---|---|---|---|
| Wordsmiths, poets, battle-rap fans | The craft: forms, devices, a live checklist of what your verse must do | Online English duels against people, scored by fixed rules | "AI-written verses" as the hook |
| Daily puzzle players | A few minutes, one duel, a result you can share (once the daily verse exists: `25-live-ops-plan.md`) | Sixteen languages | Streak pressure |
| Teachers | Shakespeare characters and lines; forms checked by code, line by line; no account needed for a one-off lesson | Solo verses stay on the student's device | Progress tracking, compliance claims, learning outcomes |
| Multilingual players | Native forms: jueju in Chinese, lục bát in Vietnamese | Card names and lines from published sources where they exist | Quality claims before a native speaker has read the language |
| Press and investors | A verse duel nobody else makes, built on code-checked rules and on-device AI, free and ad-free | The honest team and state (fact sheet) | Inflated reach or traction |

---

## 4. AI disclosure

### 4.1 At first interaction (Proposed wording)

In this release, `fix/compliance` writes the EU AI Act Article 50(1) notice. This wording is offered for comparison:

> **You are dueling a computer.** Fixed rules check every verse. On some computers a small AI model, running in your browser, also writes your opponent's verse and helps judge. Nothing from a solo duel leaves your device. The opponent is not Devon Glover and does not speak for him.

Why each part: Art 50(1) requires telling people they are interacting with an AI system at the first interaction, clearly and accessibly (sota-production §5.4). The last sentence follows the research's advice that a real performer's persona raises the stakes (sota-production §5.8). It must be read by Devon before it names him.

### 4.2 For store pages and the press kit

> Sonnet Man uses AI in three places. Its card paintings were generated with an image model and reviewed by a person (`docs/CARD-ART.md`). Its interface and card text in fifteen languages were drafted with language models and checked by tools; no native speaker has read them yet. On capable computers, a small AI model running in the player's own browser writes the opponent's verse and helps judge it. Fixed rules check every verse's form. No AI runs on our servers.

Every sentence is As built (design §7.2; tech §6.4, §4.1, §0). The wording follows the plain, specific style of the Steam disclosure the research quotes (sota-design §3).

### 4.3 Machine-readable marking

Not built. Article 50(2) marking of AI verse and speech should be treated as due at this deploy; 2026-12-02 is the latest date, and only if the AI features were on the market before 2026-08-02 (`22-risk-register.md` R02; `13-ai-design-and-system-cards.md` §7.2). Any feature that shares or exports a verse must carry the mark.

---

## 5. The press kit

### 5.1 Contents

Built on the presskit() structure: factsheet, description, history, features, videos, images, logos, credits, contact, and a permission line for creators (sota-production §7.16).

| Item | Exists? | Source or note | To do (Proposed) |
|---|---|---|---|
| Fact sheet | This document, section 6 | | Keep in step with the code |
| Short and long description | Section 3 | | Approve |
| History | `21-production-plan-and-roadmap.md` §2 | Two builds; the November 2026 revival | A 150-word version |
| Feature list | Section 2.1 | | |
| Screenshots | No: none was taken for this dossier (no browser was run) | | Capture on the build host: duel set-up, the live checklist mid-verse, a verdict, the collection, the Theatre on a flat screen; each language page once translated |
| Trailer | No | | Section 9 |
| Logo and icon | Partly: a gold "IM" favicon and app icons at 192 and 512 px (design §7.1) | No logo pack or wordmark recorded | One master monogram and a wordmark in the game's display face (decided by default: 28 D-54, D-59); export SVG and PNG on dark and light |
| Key art | No | | From a real screenshot of a verdict, not a generated performer (decided by default: 28 D-59); any generated brand image follows rule 6 in section 1; never Devon's likeness |
| Card art samples | Yes: 71 paintings | AI-generated; seven known faults (design §7.2) | Choose only fault-free cards; label as AI-generated |
| Team | About page: four names (design §3) | Devon's biography there is the company's text; whether he approved it is Not known | His bio and photo only as he supplies them |
| Credits | In this release: `/credits` for the open data (`fix/compliance`) | | Add people, tools and licences |
| AI disclosure | Section 4.2 | | |
| Contact | contact@voyagetracable.com, the owner-approved public contact (28 D-59) | | Print it in the kit, on the itch.io page and on any store listing |
| Creator permission | No | | "You may stream and monetise video of Sonnet Man." Music must be cleared first (`22-risk-register.md` R05) |

### 5.2 What the kit must never contain

- A photo, quote or biography of Devon Glover he has not approved.
- Generated images of real people.
- Screenshots that show features the game does not have.
- The four current music tracks, until their licences are found (design §7.3).

---

## 6. Fact sheet (honest)

| Field | Value | Evidence |
|---|---|---|
| Title | Sonnet Man (installed name: "Sonnet Man: the duel of verses") | design §6.1 |
| Developer and publisher | Inspired Mile, the trading name of Voyage Tracable, LLC, Sarasota, Florida | design §6.1 |
| Where | sonnetman.inspiredmile.com, in any modern browser; installable as a web app | design §8 |
| Release date | Not known. A site is live; this release is being prepared, and launches quietly with no fixed public date (decided by default: 28 D-59) | tech §0 |
| Price | Free. No ads. No real-money purchases | design §9 |
| Players | 1 (solo against the computer); 2 online (English, account needed) | design §1, §5 |
| Match | Three rounds, first to two; no clock solo; 180 seconds a round online | design §1.2, §5.2 |
| Languages | 16 for solo duels and the interface: English, Spanish, French, German, Italian, Portuguese (Brazil), Polish, Russian, Arabic, Hindi, Chinese, Japanese, Korean, Vietnamese, Thai, Indonesian. Online: English | design §8; tech §6 |
| Cards | 71: 53 characters, 9 relics, 9 potions; from Shakespeare, the Romantic poets and Greek myth | design §2, §6.2 |
| Forms | 12 in all, 9 in English; checked by code | design §1.4 |
| Input | Typed, or spoken through an on-device speech model (tested in English) | design §8 |
| AI | No AI on the servers. On capable desktops, an optional model in the browser (3,100 MB download) writes the opponent's verse in 13 languages after this release and helps judge in some; everywhere else, a written opponent and fixed rules | design §1.6 to §1.8 |
| Privacy | Solo verses and audio never leave the device. Online verses are kept on the server for up to two minutes after a match | tech §1.6; design §5.7 |
| Accounts | Optional; passkey sign-in | design §8 |
| Age | 13 and over; 13 to 17 with a parent's permission | design §8 |
| Art | 71 card paintings generated with FLUX 3 Image Klein and reviewed; one art tradition per house | design §7.2 |
| Music | Four tracks. In this release two are traced byte for byte to CC0 tracks on OpenGameArt (`battle-beat`, `landing-ambient`); two tracks and all 14 effects remain untraced, and `/credits` says so | design §7.3; `fix/compliance`, `docs/ASSETS.md` |
| 3D and headsets | A 3D stage for the duel in the browser, with WebXR; tested in emulation | design §7.5 |
| Team | David Charlot (founder, technical lead), Devon Glover (creative director, as listed on the About page), Arrocito del Diablo (co-founder, game design), Treston Knight (listed; role Not known) | design §3 |
| Contact | contact@voyagetracable.com | 28 D-59 |

---

## 7. The game's own site and app

The site is the main channel; the portals forbid the full game (sota-production §1.1). Copy below is Proposed and in English. Other languages go through the existing language pipeline and, before launch, a native reader (tech §6.3, §6.4).

### 7.1 Home page

**Title tag:** Sonnet Man: a duel of verses, free in your browser
**Meta description:** Write or speak a verse under a poetic form and win the round. Free card game in sixteen languages. No ads, no download needed.

**Hero**
> # Write a verse. Win the duel.
> Pick a card. Your opponent opens with a verse. Answer it under the round's form, from couplet to haiku, and the game checks your lines as you write.
>
> **[Play now, no download]** [See the cards]
>
> Free. No ads. Sixteen languages. Your solo duels never leave your device.

**How it plays**
1. **Pick who answers.** Each character card can take the stage once a match. Its house lends a device: a closing question, a run of alliteration, a word thrown back.
2. **Write to the form.** A live checklist shows what your verse must do: the lines, the rhyme, the opening letters.
3. **Hear the verdict.** Craft points for the form and your card's device, judge points for wordplay, allusion, flow and wit. First to two rounds wins.

**Features**
- **Sixteen languages.** Duel in English, Spanish, Hindi, Arabic, Japanese, Vietnamese and ten more, with forms from their own traditions.
- **Fair, visible scoring.** Fixed rules score the form, and the verdict shows every point.
- **Private by design.** Solo duels run in your browser. Nothing you write there leaves your device.
- **Play anywhere.** Phone, tablet or computer. Install it like an app.
- **Duel people.** Challenge a friend online, in English, with a link.

**AI notice** (section 4.1), one tap from the hero.

### 7.2 For teachers (Proposed; only what runs)

> ### Shakespeare, in your students' own lines
> Students answer Romeo, Juliet, Hamlet and 50 other characters in short verse forms. The game checks each form line by line, so students see exactly why a line scores.
> - No account needed for a one-off lesson.
> - Solo duels run on the student's device; their verses are not sent to us.
> - Classroom mode (preview): create a class and share a join code.
>
> Coming later: single sign-on, a teacher view of the class, and an accessibility report.

The last line must change as milestones land (`21-production-plan-and-roadmap.md` M8, M9). No line may promise progress tracking or compliance before it exists.

### 7.3 FAQ (Proposed)

- **Do I need to download anything?** No. The first duel starts at once. On a computer that can run it, you may choose a small AI model for the opponent. It is a 3.1 GB download and stays in your browser.
- **Why does my phone not offer the AI model?** Phones and tablets do not have the memory to run it in a browser yet, so the written opponent and the game's rules play there.
- **Can I speak my verse?** Yes. Speech is turned into text on your device, and the text box shows it so you can fix it. We have tested speech in English only.
- **Why is online play English only?** Online duels are scored on our server, and the server reads English exactly as your browser does. Other languages need sound data the server cannot yet read in exactly the same way, and we would rather not score you differently from what you see.
- **What happens to what I write?** In a solo duel, nothing leaves your device. Online, your verse goes to our server to be scored and is deleted within two minutes of the match's end.
- **Who wrote the opponent's verses?** [Confirm before publishing.] On some computers, a small AI model in your browser writes them. Everywhere else they come from a fixed bank for each language, checked by code. The non-English banks were written by a language model and checked by tools (tech §6.4); who wrote the English bank is Not known (design §11).
- **Is Devon Glover in the game?** [To be written with Devon Glover.]
- **What data does the game use, and from whom?** See `/credits` (in this release).
- **Why does my browser ask for the microphone?** Only when you press the microphone button to speak a verse. Your browser asks once; you can change it later in the site settings (in Chrome and Edge, the icon left of the address; in Safari, Settings for This Website; in Firefox, the permissions icon). The sound is turned into text on your device and is not sent anywhere.
- **How big is the AI model, where is it kept, and how do I delete it?** About 3.1 GB for Gemma 4 E2B (1.1 GB for the lighter model). It is downloaded from the model host once and kept in your browser's storage for this site. To remove it, clear this site's data in your browser's settings. [Confirm against the shipped model panel before publishing.]
- **I lost my passkey. Can I get back in?** Not today. Email sign-in is built but switched off, so a lost passkey cannot be recovered. Add a second passkey on another device while you can. [Rewrite if email sign-in is switched on.]
- **How do I see or delete my data?** Write to contact@voyagetracable.com, the address the privacy policy gives. There is no delete button yet; we delete accounts by hand on request, until the self-service delete is built (28 D-21). [Add the response time once set: `19-privacy-pack.md` §8.]
- **I am a teacher. Where do I start?** [Write a one-page teacher guide before inviting any class: what classroom mode does and does not do today (it records no progress), the 13+ age rule, and what data is kept. Draft it from `19-privacy-pack.md` §6.]

### 7.4 Language landing pages (Proposed)

- Pre-render one landing page per language, each listing itself and the others with `hreflang` and an `x-default`. Never redirect by a guess at the visitor's language (sota-production §1.3).
- Each page names the forms that language offers (design §1.4) and says plainly whether a native speaker has read it.
- Add software-application structured data only when real on-page ratings exist (sota-production §1.3).

### 7.5 Installable app listing (Proposed)

The manifest already names the app and has two shortcuts, to the duel and the Theatre (design §3).

- **Name:** Sonnet Man: the duel of verses
- **Short name:** Sonnet Man
- **Description:** A free duel of verses in sixteen languages. Write or speak your verse; the game checks the form.
- **Screenshots:** add manifest screenshots captured from the game (section 5.1), for the richer install sheet.
- **Install prompt copy:** "Install Sonnet Man to play from your home screen. Solo duels keep working when you are offline." That last clause must wait for a test: offline solo play is untested (tech §1.5). Until then, make no offline claim: the service worker keeps only pages already fetched, and offline use is untested (tech §1.5).

---

## 8. Portals and stores

### 8.1 Which outlets the game can use

| Outlet | Can the full game go there? | Why | Plan (Proposed) |
|---|---|---|---|
| Poki | No | No personal data or email accounts; no chat; ads only; five-year web exclusivity that also covers Discord and YouTube Playables | None |
| CrazyGames | Lite only | No outside login; pays only through its ads; may not link to a playable web version; 13+ | None now; it would break "no ads" |
| YouTube Playables | No | No outside calls, so no model; no login; may refuse WebAssembly and workers | None |
| itch.io | Yes, as a page that links to the site, or a guest build | Free games allowed; revenue share can be 0% | A page now (8.2) |
| Discord Activity | Possibly | Web app in a frame; all traffic through Discord's proxy; models must pass through it | A test build |
| Telegram Mini App | Possibly | Payments only in Stars if anything is sold | Not now |
| Reddit (Devvit) | Lite only | No outside requests from the client | Not now |
| Google Play (trusted web activity) | Yes, for 13+ | Needs target API 36, an in-app "report AI output" control, and no child listing | Later (8.3) |
| Apple App Store | Not yet | Must be more than a website; prompts before large downloads; credits may not expire; WebGPU in web views unproven | Deferred |

All facts: sota-production §1.1, §1.2.

### 8.2 itch.io page (Proposed copy)

**Title:** Sonnet Man
**Short description:** A free duel of verses. Write or speak to the form; win the round.
**Genre and tags:** Card game; word game; poetry; multilingual; free
**Description:**
> Every move is a verse. Your opponent opens; you answer with a character card and a few lines under the round's form: a couplet, a haiku, an acrostic. The game's rules check your verse as you write it, and the verdict shows every point.
>
> - Sixteen languages, with forms from several traditions.
> - Free, no ads, no purchases.
> - Solo duels run entirely in your browser.
> - On a capable computer, an optional small AI model writes your opponent's verse.
>
> Plays in your browser at sonnetman.inspiredmile.com. Contact: contact@voyagetracable.com.

**AI disclosure:** section 4.2.

### 8.3 Google Play listing (draft for later)

- **Title (30 characters):** Sonnet Man: Duel of Verses
- **Short description (80 characters):** Write a verse, win the duel. Free card game in 16 languages. No ads.
- **Full description:** the home-page "How it plays" and "Features" (7.1), the AI disclosure (4.2), and the line "Report any AI verse from the menu", which must exist first (sota-production §1.2).
- **Assets:** 512 × 512 icon; 1024 × 500 feature graphic; 2 to 8 phone screenshots (sota-production §7.17).
- **Contact email:** contact@voyagetracable.com.

---

## 9. Trailer outline (Proposed)

**Rules.** Captured gameplay only, on a real phone and a real desktop. Captions burned in (many viewers watch muted, and captions serve deaf viewers). No AI-generated footage. No music until it is licensed. Devon Glover appears only if he agrees and supplies the footage.

### 9.1 The 45-second cut

| Time | Picture | Words on screen |
|---|---|---|
| 0:00 to 0:04 | Black. A verse types itself, line by line | "Every move is a verse." |
| 0:04 to 0:10 | The duel on a phone: the opponent's verse, the round's form ("Couplet"), the player picking Juliet | "Pick who answers." |
| 0:10 to 0:20 | The player types; the "What your verse must do" checklist ticks; the craft count rises | "Write to the form. The rules check every line." |
| 0:20 to 0:27 | The verdict: craft, judge points by criterion, the round taken | "See exactly why you won." |
| 0:27 to 0:33 | A quick cut through three languages' duels: Arabic (right to left), Japanese, Spanish | "Sixteen languages." |
| 0:33 to 0:38 | The microphone: a spoken English verse appears in the box | "Write it, or say it." |
| 0:38 to 0:42 | A match won; a card revealed | "Win the duel. Win a card." |
| 0:42 to 0:45 | Title and address | "Sonnet Man. Free. No ads. sonnetman.inspiredmile.com" |

### 9.2 The 15-second cut

The first three beats and the end card.

### 9.3 What to avoid

- The Theatre in a headset, until it is tested on a real device (design §3).
- Any card with a known art fault (design §7.2).
- Any claim from section 2.2.

---

## 10. Social plan (Proposed)

### 10.1 Accounts

Whether Inspired Mile has its own social accounts is Not known. Opening accounts in the company's name waits on the owner (28 O-10); the public contact meanwhile is contact@voyagetracable.com (28 D-59). The site's footer links Devon Glover's own channels (design §5.8). Do not post on his channels or tag him without his agreement.

### 10.2 What to post

| Pillar | Example | Rhythm |
|---|---|---|
| The form of the week | "Anaphora: start every line with the same word. Three lines, go." With a captured duel | Weekly |
| Player verses | A verse a player chose to share, with their permission and credit | Weekly, once sharing exists |
| How it is built | "How the game counts syllables in Japanese"; "Why online is English only" | Twice a month |
| Language spotlight | One language's forms and cards, only after a native speaker has read it | Monthly |
| The daily verse | Once built (`25-live-ops-plan.md`), the day's prompt | Daily |

### 10.3 Calendar beats (2027)

| Date | Beat | Source |
|---|---|---|
| 21 March | World Poetry Day | sota-production §7.16 |
| April | US National Poetry Month | sota-production §7.16 |
| 23 April | Shakespeare's birthday | sota-production §7.16 |
| 26 to 28 April | Poetry Out Loud National Finals (a teacher moment, not a sponsorship) | sota-design §6 |
| August to September | The new school year | sota-production §7.16 |
| Devon Glover's performances | Only the dates he shares and agrees to | sota-production §7.16; ask Devon |

### 10.4 Sharing from the game

As built, sharing code exists but no page uses it (design §5.8). Proposed: a spoiler-free text card that pastes into any chat: the form, the round results, a short excerpt the player chose, and the link (sota-design §5). Nothing shared by default; for teen accounts, no excerpt unless the player adds it.

### 10.5 Measuring it

As built, analytics count page views only (tech §9). Proposed: self-hosted, cookieless analytics with campaign tags on every link we post, and no tracking of verse text (`25-live-ops-plan.md`).

### 10.6 Rules for the social channels

- Captions on every video; alt text on every image.
- No paid promotion aimed at under-18s.
- Reply to criticism of the AI plainly: what runs where, and that the rules score the form.
- No generated images of real people.

---

## Owner questions

Settled on 2026-11-19 in `28-owner-decisions.md`: decided by default under the owner's standing rules where a sensible default existed; open only where it needs the owner's money, identity or contact details, a legal commitment in the company's name, or a public step not yet approved.

1. Is there a launch date, and who announces it? **Decided by default:** launch quietly after the two deploys of R15, with no fixed public date (28 D-59). **Open (28 O-10):** when should the game be announced, and by whom?
2. Who approves public copy? **Decided by default:** the owner approves all public copy (28 D-59).
3. May the game use "Shakespeare on the Go"? **Decided by default:** not in marketing until Devon Glover agrees (28 D-15).
4. Does Inspired Mile have social accounts and a press address? **Decided by default:** the press and public contact is contact@voyagetracable.com (28 D-59). **Open (28 O-10):** may the company open its own accounts on itch.io and on social networks?
5. Is there a logo or wordmark beyond the "IM" favicon? **Decided by default:** one master monogram and a wordmark in the game's display face (28 D-54, D-59).
6. Key art: a generated image or a commissioned illustrator? **Decided by default:** key art from a real screenshot of a verdict, not a generated performer (28 D-59).
7. Fix the rest of section 2.3 before this deploy, or right after? **Decided by the owner (2026-11-19, R7):** all of it, in this release (28 D-03).
8. Keep "rap battle" anywhere? **Decided by default:** "verse duel" until Devon Glover says otherwise (28 D-37).
9. Should the site publish the rates, and are they the launch values? **Decided by the owner (2026-11-19, R9):** they are tunable launch values. **Decided by default:** where the About page listed the old amounts, it shows the real rates, read from `economy.json` (28 D-05).
10. Who wrote the English written opponent's verses? **Fact to find out**, from the owner (28, Facts to find out, 4).

### Questions for Devon Glover (to ask him; nothing here assumes an answer)

These are his to answer; asking them is part of 28 O-1.

1. May the game name him in marketing, and how?
2. Which biography and photos may it use?
3. Should the AI notice name him ("not Devon Glover"), and in what words?
4. What should the FAQ answer "Is Devon Glover in the game?" say?
5. Would he appear in a trailer or a launch post, and with which of his own footage?
6. Which of his dates may the calendar use?
