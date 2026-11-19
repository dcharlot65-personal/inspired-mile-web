# Sonnet Man accessibility plan and statement

- **Purpose:** record what Sonnet Man does for disabled players today, where it falls short of WCAG 2.2, the Game Accessibility Guidelines and the Xbox Accessibility Guidelines, which legal dates apply, the plan to close the gaps, and a draft public statement.
- **Audience:** the team (David Charlot, founder and technical lead; Devon Glover, "The Sonnet Man", creative director; Arrocito del Diablo, co-founder for game design and card mechanics), engineers, testers, school and district reviewers, and investors asking about school sales.
- **As of:** commit `0d6df6ef` (branch `integrate/wave3`, 2026-11-18), plus the release in flight on 2026-11-19: `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p`, `fix/compliance`, and the nightly database backup.
- **Status:** Draft for the team, 2026-11-19. Not legal advice.
- **Related documents:** `10-ux-flows-and-design-system.md`, `12-technical-design.md`, `14-localisation-kit.md`, `19-privacy-pack.md`, `22-risk-register.md`, `data/design-tokens.json`, `08-art-bible.md`, `09-audio-bible.md`, `sources/as-built-design.md` (§8, §10), `sources/as-built-tech.md`, `research/sota-design-2026-11.md` (§6, §8), `research/sota-production-2026-11.md` (§5.4, §5.5, §7.11); also `00-README.md` (index), `28-owner-decisions.md`.

**How to read the labels.** **As built**: the code at `0d6df6ef` does it (cited). **In this release**: a named branch is doing it now; not built yet. **Proposed**: a recommendation, with its research. **Not known**: nobody could find out; also under "Owner questions".

**How this was assessed.** By reading the code and computing colour contrast from the token values. No screen reader, keyboard-only session, zoom test or automated checker was run, and no disabled player has tested the game. Every "fail" below is a finding from the code that a real test must confirm; every "pass" is likely, not proven.

---

## 1. Summary

- **Strong foundations.** Typing is always a full alternative to speaking; solo play has no clock; the voice is optional and the spoken verse is always on screen; sign-in is by passkey; sixteen languages with Arabic mirrored right to left; every page states its language.
- **One blocker in the core loop.** The cards a player chooses each round ("Who answers?", relics and potions) are `div` elements with a mouse click and no keyboard access. A player without a mouse or touch cannot choose a character, so cannot submit a verse (`src/pages/battle.astro:283-301,707-736`). Screen-reader users likely meet the same wall.
- **Other main gaps:** small text and control borders below WCAG contrast; no reduced-motion support; desktop menus that open on hover only; verdicts not announced; no per-channel volume; no accessibility test of any kind.
- **The dates.** Large US public school systems must meet WCAG 2.1 AA for web content and the tools they use from **26 April 2027**, smaller ones from **26 April 2028**. Districts will ask for a conformance report before then. The European Accessibility Act has applied since **28 June 2025**; the research reads the studio as exempt as a microenterprise for now, but its headcount and turnover are not on record, so the exemption is an inference to confirm (Owner questions).
- **The plan:** fix the blocker and the contrast first; reach WCAG 2.2 AA on every 2D page; publish a statement and a conformance report before selling to schools.

---

## 2. Standards and dates that apply

| Standard or law | Date | What it asks | Does it bind Sonnet Man? | Source |
|---|---|---|---|---|
| WCAG 2.2, Level AA | W3C Recommendation 2023-10-05, updated 2024-12-12; equal to ISO/IEC 40500:2025 | the web standard; adds 2.4.11 Focus Not Obscured, 2.5.7 Dragging, 2.5.8 Target Size, 3.3.8 Accessible Authentication to AA | **The target** this plan adopts (it contains 2.1 AA) | `research/sota-production-2026-11.md` §7.11 |
| US ADA Title II web rule | **2027-04-26** for public entities serving 50,000 people or more; **2028-04-26** for smaller ones (interim rule of 2026-04-20) | WCAG 2.1 AA; covers public schools and colleges; vendor content and apps are not excepted | **Yes, through school customers**: a district using Sonnet Man must make sure it conforms | `research/sota-design-2026-11.md` §8 |
| US ADA Title III | no web regulation; DOJ guidance 2022-03-18 | web services of public accommodations; WCAG cited as helpful | Possible exposure; WCAG 2.2 AA is the defence | `research/sota-production-2026-11.md` §5.5 |
| European Accessibility Act | applied since **2025-06-28** | covers e-commerce, including bought in-game currency; EN 301 549 (mapped to WCAG 2.1 AA) | **Probably not yet** (research inference): microenterprises (under 10 staff and at most €2M turnover) are exempt, and the studio's figures are not on record; selling credits later would be e-commerce | `research/sota-production-2026-11.md` §5.5; `research/sota-design-2026-11.md` §8 |
| US CVAA | software from 2019-01-01 | accessible in-game communication | **Only if chat is added**; verses are not chat today | `research/sota-design-2026-11.md` §8 |
| EU AI Act Art 50(5) | applies since 2026-08-02 | the AI disclosure must be given "clearly and accessibly" at first interaction | **Yes**: the Article 50(1) notice that `fix/compliance` adds **in this release** must itself be accessible | `research/sota-production-2026-11.md` §5.4 |
| Apple Accessibility Nutrition Labels | voluntary "to start"; one Apple snippet suggests a requirement from 2026-04-28 (unresolved) | claim a feature only if every common task works with it | **Only if** the game ships as an App Store app | `research/sota-design-2026-11.md` §8 |
| Game Accessibility Guidelines | maintained since 2012; Basic, Intermediate, Advanced tiers | design guidance for games | Guidance | `research/sota-production-2026-11.md` §7.11 |
| Xbox Accessibility Guidelines | version 3.2, 2023-06-08, still current | per-guideline goals and player impact; "not compliance" | Guidance | same |
| WCAG 3 | Working Draft; "not expected to be a completed W3C standard for a few more years"; will not supersede WCAG 2 | | Watch only | same |

---

## 3. What exists today

**As built** (`sources/as-built-design.md` §8 unless cited otherwise).

| Area | What works |
|---|---|
| Input | Typing and speaking are equal: a spoken verse becomes editable text, and the score is the same either way. No solo clock. No dragging anywhere (grep). |
| Language | `<html lang>` set and switched with the interface language; the opponent's verse carries its own `lang` (`battle.astro:803`); `dir="auto"` on verses; Arabic interface mirrored with logical properties and tested (`tests/play-i18n.spec.ts`, `tests/theatre-bidi.spec.ts`); script-aware line breaking for Japanese and Korean. |
| Labels | The verse box, selects and sign-in inputs have labels; inputs declare `autocomplete` (`username webauthn`, `one-time-code`; `BaseLayout.astro:306,318`). |
| States | Microphone button `aria-pressed`; language note `role="status"`; sign-in errors `role="alert"` and notices `role="status"`; story scene `aria-live="polite"`; playground trivia and challenge modals `role="dialog" aria-modal="true"`; Escape closes the collection modal and the account menu. |
| Meaning not by colour alone | Rarity is a word; the checklist uses ✓, ○ and ✗ beside its text; round results are words as well as colours. |
| Sound | Music starts only after a click; one mute toggle; the voice is off by default; the spoken verse is always on screen. |
| Sign-in | Passkeys, with no password and no puzzle (WCAG 3.3.8). The emailed one-time code is built but off in production while no email service is configured. |
| 3D | The Theatre has a flat-screen fallback with a typed verse, and the 2D `/battle` page plays the same duel. |
| Orientation | Not locked (`public/manifest.json`, `"orientation": "any"`). |
| Device | The screen is kept awake during a duel. |

---

## 4. Gaps against WCAG 2.2 AA

Read from the code; "Not tested" means no evidence either way. Priority: **P0** blocks play or a legal date; **P1** before school sales; **P2** later.

| Criterion | Finding | Evidence | Fix | P |
|---|---|---|---|---|
| 2.1.1 Keyboard | **Fail.** Hand chips (characters, relics, potions) are `div` elements with click handlers, no `tabindex`, no key handling: no keyboard player can choose a character, so none can submit. Collection cards likewise. Desktop Play and Explore menus open on hover only. The Theatre's stage takes pointer, ray or pinch. | `battle.astro:283-301,707-736`; `collection.astro:70-76`; `BaseLayout.astro:213-240` | Real `<button>` elements with `aria-pressed`; menus that open on click and focus; the 2D duel as the Theatre's equivalent | **P0** |
| 4.1.2 Name, role, value | **Fail.** Chips claim `role="button"` without behaving as one, and the chosen state is not exposed; the collection's card modal has no dialog role; the mobile menu button and the mute button do not report their state | `battle.astro:708`; `collection.astro:210`; `BaseLayout.astro:404,413` | Buttons with `aria-pressed`; one dialog component; `aria-expanded` and `aria-pressed` | **P0** |
| 4.1.3 Status messages | **Fail.** The verdict, model-download progress and round changes are not announced; only the language note, sign-in messages and story scene are | `battle.astro:167` (`#verdict` has no live region) | One polite live region per page; move focus to the verdict heading | **P0** |
| 1.4.3 Contrast (minimum) | **Fail** for small text in obsidian-500 (4.34:1, 4.12:1 on panels) and obsidian-600 (3.26:1), used for field labels, checklist detail, the seed note and the age-gate small print; the Common rarity pill about 3.6:1 | contrast computed from tokens (`10-ux-flows-and-design-system.md` §8) | Semantic colour layer: essential text obsidian-400 or lighter | **P0** |
| 1.4.11 Non-text contrast | **Fail.** Input, select and chip borders obsidian-700 (2.43:1); the verse box's focus border is gold at 50% | `global.css:97-99`; `battle.astro:145-146` | `border.control` = obsidian-500; a solid focus ring | P1 |
| 2.4.7 Focus visible | **Partial.** The verse box removes the outline; other controls rely on the browser's default ring, which may be weak on dark gold | `battle.astro:146` | A 2 px gold-400 `:focus-visible` ring everywhere | P1 |
| 2.4.11 Focus not obscured | **Not tested.** A fixed 64 px header can cover a focused element as the page scrolls; no `scroll-padding-top` is set | `BaseLayout.astro:195,464` | `scroll-padding-top: 4.5rem` | P1 |
| 2.2.2 Pause, stop, hide | **Fail.** Endless animations (`float`, `pulse-glow`, `animate-pulse` badges, a scan line) run beside content with no way to stop them; no `prefers-reduced-motion` rule | `global.css:321-360` | Stop all loops under reduced motion and on a settings toggle | P1 |
| 2.2.1 Timing adjustable | **Pass** in solo play (no clock). **Partial** online: a fixed 180 s round. A real-time exception may cover quick match | `sources/as-built-design.md` §5.2 | Private and classroom rooms with longer or no clock | P1 |
| 2.5.8 Target size (minimum) | **Likely fail.** Bare small-text controls (the voice toggle, "Build a deck", "Equip", "sign out everywhere") are probably under 24 px tall | classes in `battle.astro:32,65,160`; `BaseLayout.astro` | 24 px minimum; 44 px for the duel's actions | P1 |
| 1.4.1 Use of colour | **Partial.** A chosen card is shown only by a gold or purple border and tint | `battle.astro:707,730` | Add a check mark and "Chosen" text, plus `aria-pressed` | P1 |
| 1.1.1 Non-text content | **Partial.** Cards have their names as alt text and chip pictures are correctly empty; the checklist's ✓ ○ ✗ have no text equivalent ("met", "not yet", "broken"); the Theatre canvas has no text alternative of its own | `battle.astro:633` | Visually hidden words beside the symbols | P1 |
| 3.1.2 Language of parts | **Partial.** The opponent's verse has its `lang`; the player's verse box and English card names inside other-language pages do not | `battle.astro:803` | `lang` on the verse box (the duel language) and on English names | P2 |
| 2.4.1 Bypass blocks | **Pass, weakly**: `<nav>` and `<main>` landmarks exist; no skip link | `BaseLayout.astro:195,464` | A skip link | P2 |
| 2.4.3 Focus order | **Not tested.** The collection modal does not move focus into itself | no `focus()` in `collection.astro` | Dialog component | P1 |
| 1.4.4 Resize text; 1.4.10 Reflow; 1.4.12 Text spacing | **Not tested.** Sizes are in rem; phone layouts were checked at 390 px in development, not at 320 px or 200% zoom | `global.css` comments | Test at 320 px, 200% and 400% zoom, and with spacing overrides | P1 |
| 1.4.5 Images of text | **Pass** in 2D (card art forbids text). The Theatre draws its text into textures | `sources/as-built-design.md` §7.5 | Declare the 2D duel as the equivalent | P2 |
| 3.3.4 Error prevention (financial) | **In this release** (`fix/server-authority`) purchases move credits; a confirm step is not known to exist | | Confirm, and allow undo where possible | P1 |
| 3.3.8 Accessible authentication | **Pass**: passkeys, and a one-time code with `autocomplete="one-time-code"` | `BaseLayout.astro:318` | Keep | n/a |
| 1.4.2 Audio control | **Pass**: the header mute; the voice is off by default. Read from the code, the mute does not silence the voice | `09-audio-bible.md` §3 | Mute everything, with per-channel sliders | P2 |
| 1.3.5 Identify input purpose | **Pass** for sign-in inputs | `BaseLayout.astro:306,318` | Keep | n/a |
| 2.5.7 Dragging movements | **Pass**: no dragging (grep) | | Keep | n/a |

---

## 5. Gaps against the Game Accessibility Guidelines

The research verified the guidelines and their three tiers; the items below are as the Basic tier is commonly listed, and their exact wording should be checked on gameaccessibilityguidelines.com before this is published.

| Basic-tier item | As built | Proposed |
|---|---|---|
| Interactive elements large and well spaced | Partly: some small text controls | 24-44 px targets |
| Easily readable default text size | Partly: 10-11 px text in chips, checklist detail, menus | 12 px minimum; a text-size setting |
| Simple, clear language | Yes in rules; the verdict uses terms (multiplier, synergy) | Plain-word reasons first, terms on demand |
| High contrast between text and background | Partly | Section 4 |
| No essential information by colour alone | Mostly | Chosen state with words |
| No essential information by sound alone | Yes: every sound has a visual equivalent | Keep (`09-audio-bible.md` §5) |
| Separate volume for effects, speech and music | No: one mute | A sound panel |
| Subtitles for important speech | Yes: the verse is on screen | Keep; caption any future recorded lines |
| Avoid flicker and repetitive patterns | No flashing known (not tested) | Test |
| Start the game without many menus | No: about eight to ten taps to a first verse | "Duel now" (`10-ux-flows-and-design-system.md` §5) |
| Settings saved | Partly: language, model and audio are kept | All settings kept |
| Accessibility features described on the website | No | Publish the statement (section 9) |

---

## 6. Against the Xbox Accessibility Guidelines

| Guideline | As built | Proposed |
|---|---|---|
| XAG 102, contrast | Fails on small text and borders | Section 4 |
| XAG 109, objective clarity | The form's brief and the live checklist say what to do each round; the "why" of a verdict needs reading | Craft reasons line by line; a "What do I do?" reminder on demand |
| XAG 116, time limits | No solo clock; online 180 s | Adjustable online clock in private and classroom rooms |
| Text display (size, spacing) | Fixed sizes | A text-size setting up to 200% |
| Screen narration | None of its own; relies on the browser and assistive technology | A DOM-first duel with one polite live region; read-aloud of card text |
| Input | Mouse and touch only for the hand | Full keyboard play; speech as an option |
| Audio accessibility | One mute | Per-channel volume, mono |

The XAG numbers 102, 109 and 116 come from the research; other guidelines are named by topic and their numbers should be checked.

---

## 7. Player-impact matrix

| Players | What works today | What blocks or hurts | Planned |
|---|---|---|---|
| **Blind, screen-reader users** | Labels on the verse box and selects; the opponent's verse is text in the right language | Cannot choose a character; verdicts not announced; card grid not focusable | Real buttons, live region, dialog focus (P0) |
| **Low vision** | Rem sizes; dark theme with bright body text | Small grey labels below 4.5:1; 10-11 px text; no text-size setting | Contrast fix (P0), 12 px minimum, text size to 200% (P1) |
| **Colour-blind** | Rarity and results in words | Chosen chip by colour; red and green verdict colours | Check marks and words (P1) |
| **Deaf, hard of hearing** | Nothing essential is audio-only | none known | Keep captions for any recorded lines |
| **Motor, keyboard-only, switch** | No dragging; no solo clock | Hand chips and menus need a pointer; small targets | Keyboard play (P0); targets (P1) |
| **Cognitive** | Short forms; a live checklist; no clock | Many screens before play; dense verdicts; constant animation | "Duel now"; plain reasons; reduced motion (P1) |
| **Speech differences** | Typing is equal; transcripts are editable | Recognition untested outside English and for atypical speech | Keep typing first-class; never score the recogniser's errors |
| **Vestibular, motion-sensitive** | VR and Theatre are optional | Endless float and pulse animations; smooth scrolling | Reduced motion (P1); comfort settings in XR |

---

## 8. The plan

### Phases

**Proposed.** Dates are working targets for the team to confirm.

| Phase | By | Work | Done when |
|---|---|---|---|
| **0. Blockers** | before any school pilot, and no later than 2027-01-31 | Keyboard play of the whole duel (chips, items, menus); live region for the verdict; semantic colour layer for contrast; focus ring; dialog component | A keyboard-only and a screen-reader run complete a match on `/battle` |
| **1. WCAG 2.2 AA on 2D pages** | 2027-03-31, four weeks before the 2027-04-26 ADA date | Reduced motion; targets; zoom and reflow; language of parts; sound panel; online timing options; error prevention for purchases | An internal audit of every page finds no AA failure; a conformance report drafted |
| **2. Publish** | 2027-04-15 | Accessibility statement live; conformance report for districts (a common format is the VPAT; its use here is an assumption) | Both linked from the footer and the classroom pages |
| **3. Beyond AA** | 2027 | Text-size setting to 200%; read-aloud of card text; high-contrast theme; XR comfort settings; disabled playtesters each release | |

### Settings to add

**Proposed.** One settings panel, reachable from the header and the duel, kept per player.

| Setting | Values | Default |
|---|---|---|
| Text size | 100%, 125%, 150%, 200% | 100% |
| Motion | follow the device; reduced; full | follow the device |
| Contrast | standard; high | standard |
| Music, effects, voice | three sliders; mono | 50, 80, 80; stereo |
| Voice | off, on; speed 0.75 to 1.25 | off |
| Speech input | on, off | on where a microphone exists |
| Verdict | full; short; skip | full |
| Online clock (private and classroom rooms) | 180 s; 360 s; none | 180 s |
| Line spacing | standard; wide | standard |

A "dyslexia font" is not proposed: a 2026 meta-analysis of 15 studies found no reliable effect; spacing, size and read-aloud help more (`research/sota-design-2026-11.md` §8).

### Testing

**Proposed:**

- **Automated.** Add an accessibility checker (for example the open-source axe-core engine, run inside the existing Playwright suites) to every page in every age-gate state, on the build host before each deploy. Today no test checks accessibility (grep of `tests/`).
- **Keyboard.** A Playwright test that plays a whole duel by keyboard alone; it must fail today and pass after phase 0.
- **Manual matrix.**

| Platform | Assistive technology |
|---|---|
| iPhone, Safari | VoiceOver; Larger Text; Reduce Motion |
| Android, Chrome | TalkBack; font size; Remove animations |
| Windows, Firefox and Chrome | NVDA; keyboard only; forced colours |
| macOS, Safari | VoiceOver; zoom 200% and 400% |

- **People.** Recruit disabled players for the playtests in `10-ux-flows-and-design-system.md` §9; pay them fairly (an owner decision).
- **Owner of accessibility.** One named person signs off each phase and answers the statement's contact address (**Not known** who).

### The 3D Theatre and the VR gallery

The Theatre and gallery are canvases. **Proposed:** declare `/battle` as the accessible equivalent of the Theatre (it plays the same `DuelSession`), say so in the statement, and add XR comfort options (seated mode, no smooth motion). Districts will test them; the research expects them to fail without a DOM equivalent (`research/sota-design-2026-11.md` §8).

---

## 9. Draft accessibility statement

> **DRAFT. Not for publication.** Every claim below must be checked against a real audit before it goes live. The contact address and dates are placeholders.

### Accessibility of Sonnet Man

Inspired Mile (Voyage Tracable, LLC) wants everyone to be able to play Sonnet Man, whatever their sight, hearing, movement, speech or way of thinking.

**The standard we work to.** We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA on every page of sonnetman.inspiredmile.com. **The game does not meet it yet.** This statement says where it falls short and what we are doing about it.

**What works today**

- You can type every verse. Speaking is an option, never a requirement, and a typed verse scores exactly like a spoken one.
- Solo duels have no time limit.
- The opponent's verse is always shown as text; reading it aloud is optional and off by default.
- You sign in with a passkey: no password and no puzzle. (Edit this line if emailed one-time codes are switched on; they are built but off today.)
- The game is available in sixteen languages. Arabic is shown right to left.
- The 3D Theatre has a flat version: the Battle Arena plays the same duel on any screen.

**Known problems**

- You cannot yet choose your cards with a keyboard alone, so the duel cannot be played without a mouse or touch screen. We are fixing this first.
- Screen readers are not told the result of a round.
- Some small grey text and some control borders have too little contrast.
- Animations cannot be turned off, and the game does not yet follow your device's "reduce motion" setting.
- The desktop menus open only when you point at them. Every page is also linked from the footer.
- There is one mute button, not separate volume controls.
- Online duels give 180 seconds a round, with no way to extend it.
- The 3D Theatre and the VR gallery cannot be used with a screen reader or keyboard.
- Speech recognition has been tested only in English.

**Technical needs.** A current version of Chrome, Edge, Firefox or Safari. Speaking a verse needs a microphone. The 3D Theatre needs WebGL, and a headset needs WebXR.

**How we checked.** By reviewing our own code in November 2026. No independent audit or test with assistive technology has been done yet. We plan both before [date].

**Tell us.** If something stops you playing, write to **[accessibility contact to be decided]**. We aim to reply within [5] working days, and to give you another way to do what you were trying to do.

*Prepared [date]. Last reviewed [date].*

---

## Owner questions

1. Who owns accessibility, signs off each phase and answers the statement's contact address? Which address?
2. Are the phase dates acceptable? Is a school pilot planned before 2027-04-26?
3. Is there a budget to pay disabled playtesters and, later, an independent audit?
4. Which conformance-report format do the target districts ask for?
5. `fix/compliance`'s Article 50(1) notice is page text on the battle and multiplayer pages and under the Theatre's status line (commit `13ff3148`). Is it announced to screen readers when it is redrawn after the model or language changes? Not known: check it in the screen-reader pass.
6. `fix/server-authority` changes no page; a pack or market purchase is an API call only. Should the page that offers it ask for confirmation before credits are spent (WCAG 3.3.4)?
7. Should the Theatre and VR gallery stay public while they cannot be made accessible, with `/battle` declared as the equivalent?
8. Is the game likely to ship as an App Store or Play Store app (which brings Apple's accessibility labels into play)?
9. What are the company's headcount and annual turnover? They decide whether the European Accessibility Act's microenterprise exemption applies; the exemption is an inference until then.

## Questions to ask Devon Glover

Nothing here records his words, views or approvals. Ask him:

1. In your school work, which accommodations do students most often need for reciting or writing verse?
2. Would you want your recorded lines captioned in every language, or in English only?
3. Do you know teachers or students with disabilities who would test the game?
