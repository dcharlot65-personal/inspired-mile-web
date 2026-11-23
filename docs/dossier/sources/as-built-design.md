# Sonnet Man: the as-built design, fact base

This is the fact base for the Sonnet Man design dossier: what the game does today, read from the code. It does not describe what the game was meant to be, except in section 9, where the plans are set against the code.

- **What was read.** The worktree `docs/dossier` branch, made from `integrate/wave3` at commit `0d6df6ef` (2026-11-18 20:27 -0500, "tests: the Chinese 是 rule has verses of its own"). That commit is the game as it is about to ship, 599 commits past `main`. Every `path:line` below is a path from the repository root at that commit.
- **How it was read.** By reading the files, with `grep`, and with throwaway Node and Python scripts that import the game's own TypeScript modules: `src/lib/cards.ts`, `src/lib/verse/devices.ts`, `src/lib/verse/forms.ts`, `src/lib/trivia.ts`, `src/lib/challenges.ts` and the English language pack. Nothing was built, tested or run in a browser, and production was not queried. A behaviour described as "read from the code" was not observed running.
- **History in one line.** The repository has 680 commits. 21 were made from 2026-02-13 to 2026-02-17: the first build, a "Shakespeare rap battle card game" with wallets, NFTs and a cloud AI. The other 659 were made from 2026-11-16 to 2026-11-18: the rebuild as a verse duel on in-browser models (`git log --format=%ad --date=short | sort | uniq -c`). The rebuild's own commit is `ae20b599` (2026-11-16).
- **Status words.** *Working*: a player can reach it from a page and it does what its screen says. *Partly*: it can be reached, but part of what it promises does nothing. *Stub*: its screen exists but the play behind it does not. *Dead*: code that no page imports or calls. Each claim says how it is known.
- **Internal details.** Addresses, host names and secret names are kept out of this file; they are only in `17-operations-runbook-and-launch-checklist.md`. **The numbers** are quoted from code, or measured from files and named as measured. A number derived by arithmetic is marked "derived".

Contents: 1 What the player does · 2 The card catalogue · 3 Modes and screens · 4 Progression and economy · 5 Multiplayer and social · 6 Narrative, world and tone · 7 Audio and visual · 8 Onboarding, accessibility and languages · 9 Intent against what was built · 10 Known open problems · 11 What could not be determined

---

## 1. What the player does

### 1.1 The core loop

1. **Collect cards.** On `/playground` a player gets cards from a free starter pack, a daily card, Shakespeare trivia and quote challenges (section 4.3).
2. **Build a deck.** On `/collection` a deck holds 3 to 5 characters, up to 2 relics and up to 2 potions, all of them owned (`src/lib/battle-rules.ts:82-88`, `src/lib/deck-manager.ts:25-31`).
3. **Duel.** A duel is three rounds of verse against an opponent, on `/battle` (flat), `/theatre` (3D and WebXR) or `/multiplayer` (against a person). The flat and 3D screens both drive one `DuelSession`, so they play by the same rules (`src/lib/verse/session.ts:1-8`).
4. **Win a card.** Winning a solo match on `/battle` adds one card, drawn at random by rarity (`src/pages/battle.astro:968-971`). A win in the Theatre or online gives no card (section 4.3).

No account and no cards are needed to duel. Without a saved deck the battle page deals `starterDeck`, which takes owned cards first and then the catalogue in order (`src/pages/battle.astro:305-321`, `src/lib/verse/duel.ts:287-295`). A new player therefore duels with The Sonnet Man, Romeo, Juliet, Yorick's Skull and the Love Potion (`src/lib/cards.ts:33,42,51,105,123`).

### 1.2 A solo duel, step by step (`/battle`; the Theatre is the same session)

**Set-up** (`src/pages/battle.astro:23-91`):
- **Deck.** The active saved deck if it has at least `ROUNDS` valid characters, otherwise the starter deck (`battle.astro:305-321`).
- **Duel language.** Any of 16 (`battle.astro:325`). The forms drawn depend on it (1.4).
- **Opponent.** The difficulty is Apprentice ("writes one draft"), Player ("picks the better of two drafts", the default) or Master ("picks the best of three drafts") (`battle.astro:41-44`).
- **World card.** Optional, shown only when the player owns one (`battle.astro:59-67`).
- **Model.** The player may download a model or "Play now without a download" (section 8).
- **Seed.** A random whole number below 2^31, or `?seed=` (`battle.astro:1058-1061`), normalised to 0 to 2^32-1 (`src/lib/verse/duel.ts:240-242`). The page shows it: "The same seed and deck draw the same forms" (`battle.astro:170`).

**The plan, fixed by the seed before round one** (`createDuel`, `src/lib/verse/duel.ts:301-331`):
- **Rounds.** Three (`ROUNDS`, `duel.ts:47`), each under a different form shuffled from the forms of the duel's language (`duel.ts:306`).
- **The opponent's deck.** Three characters drawn from all 53, one relic and one potion, by seed (`opponentDeck`, `duel.ts:278-284`). The opponent can therefore field either Legendary character, The Sonnet Man or Zeus.
- **The opponent's items.** It casts its potion on the player in round 2 or 3, and lends itself its relic's words in the other of those two rounds. "Round one is a clean read of the form for both sides" (`duel.ts:308-311`).
- **Form details.** An acrostic's word is drawn from the pack's list (`duel.ts:317`). In English the words are bard, moon, king, rose, fate, wit, play and star (`src/lib/verse/packs/en.ts:5`). A Forbidden Letter potion's letter is drawn from the pack's letters (`castFor`, `duel.ts:268-271`); in English these are s, t, r, n, o and i (`packs/en.ts:6`).

**Each round:**
1. **The opponent opens and writes first** (`DuelSession.beginRound`, `session.ts:94-124`). The player sees the form and its brief, the opponent's character, its device, any curse it has cast, and its verse (`battle.astro:109-124`). With the voice on, the verse is read aloud (`battle.astro:834`). In a solo duel the opponent always opens: "Only the opponent ever opens: the player always has the opponent's verse to answer" (`src/lib/verse/devices.ts:237`).
2. **The player picks a character** to answer with. Each character can be used once per match (`session.ts:126-131`; `illegalMove` `'character-used'`, `duel.ts:357`).
3. **The player may play a relic, a potion, or both.**
   - Each costs 1 ink (`RELIC_COST`, `POTION_COST`, `duel.ts:50-51`).
   - The player has 2 ink in round one and gains 1 each round after, less what is spent (`START_INK`, `INK_PER_ROUND`, `inkAt`, `duel.ts:48-49,335-337`). Over a match that is 4 ink at most (derived).
   - Each item can be used once per match (`duel.ts:360-361`).
   - A potion cannot be played in the last round (`duel.ts:363`). It curses the opponent's *next* verse, because the opponent has already written this round's (`battle.astro:829-830`; the curse is carried over at `session.ts:233-240`).
   - The page warns that a potion is a gamble once either side can win the match that round (`potionAtRisk`, `session.ts:163-167`).
4. **The player writes the verse, or speaks it.**
   - The text box takes 600 characters (`battle.astro:144`). The engine also cleans every verse to at most 600 characters and 8 lines (`MAX_VERSE_CHARS`, `MAX_VERSE_LINES`, `src/lib/verse/text.ts:33-34,163-170`).
   - The microphone records on the device, and Whisper's transcript is added to the box (`battle.astro:576-593`).
   - As the player writes, a live checklist ("What your verse must do") and the craft so far are worked out by the same function that scores the round (`session.ts:175-187`; `src/lib/battle-preview.test.ts`).
5. **The player submits.** This is refused until a character is chosen and the verse holds a letter (`session.ts:211-217`). The judge then runs (`session.ts:219-245`). The verdict shows each side's craft breakdown, its judge points, who took each criterion, and whether a model or the rules judged (`battle.astro:901-958`).
6. **The match ends, or the next round begins.** The match ends as soon as one side has two rounds (`matchWinner`, `duel.ts:576-583`; `session.ts:241`), so it lasts two or three rounds.

- **No clock in solo play.** No countdown exists in `battle.astro`, `theatre.astro` or `session.ts` (grep for countdown, deadline and remaining finds none). Online rounds have 180 s (section 5.2).
- **At the end.** A won match gives one card, weighted by rarity, with a fanfare for its rarity (`battle.astro:960-976`). Every round won also adds 1 to the player's `battleWins` statistic (`battle.astro:886-888`; section 4.5).

### 1.3 Scoring: the formulas and constants

The rule is stated in the file header: "A verse scores craft + judge (+ the world card's bonus, for the player)" (`src/lib/verse/duel.ts:9-11`).

**Craft**:
`craft = max(0, round((form points + power-word bonus) × multiplier) − curse penalty)`, from `duel.ts:510-511`.

| Term | Rule | Constants | Source |
|---|---|---|---|
| Form points | The sum of the met requirements, out of 20. It is multiplied by `scale` and rounded. | `FORM_POINTS = 20` | `src/lib/verse/forms.ts:21,397` |
| `scale` | `min(1, known / 0.7, telling / (0.5 × lines))`. `known` is the share of the verse that is words of its language. `telling` is the number of different telling words. In Chinese and Japanese (lines counted in characters) the telling term is 1. | `FULL_KNOWN_SHARE = 0.7`, `TELLING_PER_LINE = 0.5` | `forms.ts:395-396`; `text.ts:1084,1094` |
| Thin verse | It fails every requirement and earns 0. A verse is thin if any line has no word, it has fewer different words than lines (never fewer than 3), half or more of its lines are repeats, or under 60% of it is words of its language. | `MIN_DISTINCT_WORDS = 3`, `MIN_KNOWN_SHARE = 0.6` | `forms.ts:384-391`; `text.ts:1074,1082,1115-1133` |
| Power-word bonus | +6 when the verse uses at least 2 of the lent relic's 5 words; 0 if the verse is void. | `POWER_WORD_BONUS = 6`, `POWER_WORDS_NEEDED = 2` | `devices.ts:439-440,475-478`; `duel.ts:496-500` |
| Multiplier | `1 + round(bonus × substance × 100) / 100`, with bonus = 0.5 if the device lands, + 0.5 if the signature lands, + 0.25 for synergy (the device lands and the deck holds 2 or more characters of the card's house, the card itself included). It runs from 1.00 to 2.25. | | `duel.ts:486-494` |
| `substance` | `min(1, own telling words / (1.5 × lines the form asks))`. Own telling words are those beyond the words that landed the device and the signature. A verse that is only its device multiplies nothing. | `OWN_WORDS_PER_LINE = 1.5` | `duel.ts:117-121,488-492`; `text.ts:1140-1145` |
| Curse penalty | `min(12, 4 × violations)`. | `CURSE_PENALTY = 4`, `CURSE_PENALTY_CAP = 12` | `devices.ts:419-421`; `duel.ts:502-507` |
| Void verse | An empty, thin or copied verse earns craft 0 and lands no device or signature. | | `duel.ts:463-469,478-484,510` |

- **Copying.** A verse is a copy when it carries over the other verse's lines or most of its content words, by the thresholds `COPY_THRESHOLD 0.7`, `COPY_COVERAGE 0.85`, `COPY_COVERAGE_ALONE 0.9`, `COPY_MIN_TAKEN 4`, `COPY_ANY_ORDER_MIN 4`, `COPY_LINE_WORDS 3`, `COPY_LINE_SHARE 0.6`, `COPY_LINE_SOURCE 7`, `COPY_LINE_NEAR 0.67` and `COPY_LINE_ANY 0.8` (`duel.ts:54-115,408-461`).
  - A player's copied verse also forfeits all 24 judge points to the opponent (`duel.ts:515-520,560-561`).
  - The opponent's verse is never tested for copying (`trusted`). Otherwise a player could void the written opponent by typing its next verse a round early, since the seed makes it knowable (`duel.ts:388-394,557`).

**Judge**:
- `JUDGE_POOL = 24` points a round, shared over four criteria: wordplay, allusion, flow and wit (`duel.ts:53`; `judge.ts:32`).
- Each criterion is worth 6 to whichever side takes it, or 3 to each on a split (`src/lib/verse/judge.ts:265-276,491-499`).
- How the split is decided is in 1.7.

**World card.**
- Every one of the 20 cities gives +2 (`src/lib/variants.ts:90-397`; for example Tokyo at `:97`). The player gets it when the judge awards them the city's criterion and their verse is not void (`duel.ts:563-565`).
- The cities' "shakespeare" axis is scored as `allusion` (`battle.astro:1029-1031`). Only the player can have a world card, and only in solo play.

**The round.**
- Player total = craft + judge points + world-card bonus. Opponent total = craft + judge points (`duel.ts:567-568`).
- The higher total takes the round. On equal totals the side the judge preferred takes it, and on equal judge points the player, "the challenger", does (`duel.ts:569-571`). A solo round is never drawn.

**Ranges (derived from the constants):**
- **Craft.** At most 45 with no relic (20 × 2.25) and 59 with one (26 × 2.25 = 58.5, which `Math.round` makes 59).
- **Round total.** At most 85 for the player (59 + 24 + 2).
- **Achievement thresholds.** Two achievements are set on a round total: "Wordsmith" at 35 and "Virtuoso" at 45 (`src/lib/achievements.ts:101,174`).

**What does not score.** A card's ATK, DEF, HP, element and rarity play no part in a duel. Nothing in `src/lib/verse/` reads them. The only code that reads `atk` is draft mode, which no page imports (`src/lib/draft-mode.ts:122`; section 4.11). The collection still prints the three numbers on every character (`src/pages/collection.astro:111,512`).

### 1.4 Verse forms: what code checks

- **No model decides a form.** "whether a verse keeps the form is decided here by code, never by the model" (`forms.ts:2-3`).
- **Partial credit is deliberate.** "Partial credit is deliberate: a near miss still scores" (`forms.ts:5-6`).
- **How English is read.** Rhyme and syllables come from the CMU pronunciation table, so a word with two pronunciations ("fire") gives a line a range of syllable counts. A word missing from the table is counted by its spelling, marked "~", and buys no slack (`forms.ts:96-121`; CLAUDE.md:96-110).
- **Other languages.** They are read from sound tables, the kuromoji analyser (Japanese) and the browser's word segmenter (Chinese, Thai) (CLAUDE.md:476-490).

| Id | English name (`src/lib/verse/english.ts`) | Lines | Requirements (points) | Offered | Source |
|---|---|---|---|---|---|
| `couplet` | Couplet | 2 | 2 lines (6); lines 1 and 2 rhyme (14) | where rhyme is checked | `forms.ts:209-216`; `english.ts:33-34` |
| `quatrain-aabb` | Paired Quatrain | 4 | 4 lines (6); 1-2 rhyme (7); 3-4 rhyme (7) | where rhyme is checked | `forms.ts:217-224` |
| `quatrain-abab` | Crossed Quatrain | 4 | 4 lines (6); 1-3 rhyme (7); 2-4 rhyme (7) | where rhyme is checked | `forms.ts:225-232` |
| `tercet` | Tercet | 3 | 3 lines (6); 1-3 rhyme (14) | where rhyme is checked | `forms.ts:233-240` |
| `anaphora` | Anaphora | 3 | 3 lines (6); every line opens with the same word, or the same character in zh and ja (14) | all | `forms.ts:241-247,123-134` |
| `acrostic` | Acrostic | one per letter of the drawn word | line count (6); the lines' openings spell the word (14). Openings are a kana in Japanese, a syllable block in Korean, an akshara's consonant in Hindi, and the next word of a spaced phrase in Thai. | all | `forms.ts:138-206` |
| `crescendo` | Crescendo | 3 | 3 lines (6); each line longer than the last (14) | all | `forms.ts:249-267` |
| `epistrophe` | Epistrophe | 3 | 3 lines (6); every line ends on the same word or character (14) | **all but English**, "so that an English duel draws from exactly the forms it always has" | `forms.ts:268-279` |
| `haiku` | Haiku | 3 | 3 lines (5); syllables 5, 7, 5 exactly (5 each). Counted in characters in Chinese, and in kana sounds in Japanese ("Write in kana so the sounds can be counted") | where syllables are counted | `forms.ts:280-287`; `english.ts:52-55` |
| `heroic-couplet` | Heroic Couplet | 2 | 2 lines (4); 1-2 rhyme (8); about 10 syllables, ±1, each line (4 each) | where both are checked | `forms.ts:288-296` |
| `jueju` | Jueju | 4 | 4 lines (6); every line of 5 characters or every line of 7 (14). Tone and rhyme not checked | Chinese only | `forms.ts:297-318` |
| `luc-bat` | Lục Bát | 2 | 2 lines (4); 6 syllables (4); 8 syllables (4); the sixth word of each line rhymes (8) | Vietnamese only | `forms.ts:319-344` |

**Forms in each language's draw.** `formsFor` keeps every structural form, the syllable forms where syllables are counted, the rhyming forms where rhyme is checked, and each native form (`forms.ts:358-363`).
- **Where rhyme is checked.** Everywhere except Chinese, Japanese and Thai, which need their sound data loaded first (`rhymeChecked`, `src/lib/verse/rhyme.ts:32-35`). The battle page loads it before the duel starts (`battle.astro:1027`).
- **Where syllables are counted.** Everywhere except Arabic and Thai. Thai syllable forms are switched off because "the table covers too little of free Thai text" (`countsSyllables`, `THAI_COUNTED = false`, `src/lib/verse/text.ts:494-504`).

| Duel language | Forms | Count | Count with no sound data (script run of `formsFor` at this commit) |
|---|---|---|---|
| en | couplet, both quatrains, tercet, anaphora, acrostic, crescendo, haiku, heroic couplet | 9 | 9 |
| es fr de it pt pl ru hi ko id | the English nine and epistrophe | 10 | 10 |
| ja | the same ten | 10 | 5 (anaphora, acrostic, crescendo, epistrophe, haiku) |
| zh | the ten and jueju | 11 | 6 (also jueju) |
| vi | the ten and lục bát | 11 | 11 |
| ar | the four rhyming forms, anaphora, acrostic, crescendo, epistrophe | 8 | 8 |
| th | as Arabic | 8 | 4 (anaphora, acrostic, crescendo, epistrophe) |

### 1.5 Card devices: what each card does

**Characters carry their house's device and their own signature** (`devices.ts:4-6`).
- **The device.** Landing it adds +0.5 to the multiplier, +0.75 with house synergy (1.3).
- **The signature.** Echoing the card's famous line adds another +0.5 (1.3).
- **The thresholds.** "Long" and "strong" words are measured per language (table below).

| Device id | Name shown | Houses (`HOUSE_DEVICE`, `devices.ts:201-216`) | Lands when (code) | Source |
|---|---|---|---|---|
| `question` | The Question | Danish Court | a line that holds a letter ends in ? ？ or ؟ | `devices.ts:64-74` |
| `exclaim` | The Outcry | Capulet; also any Riposte house that opens a round | a line that holds a letter ends in ! or ！ | `devices.ts:75-78,231-242` |
| `alliteration` | Alliteration | Forest of Arden | 3 different words in one line, each of at least min(3, `content`) letters and not a stop word, share an initial | `devices.ts:79-97` |
| `repetition` | The Drumbeat | Scottish Court | one content word (not a stop word) appears 3 times | `devices.ts:98-103` |
| `internal-rhyme` | Inner Rhyme | Montague | two words inside one line rhyme | `devices.ts:104-116` |
| `riposte` | The Riposte | Verona Court, Underworld | the verse uses a word of at least `riposte` letters from the opponent's verse | `devices.ts:117-128` |
| `brevity` | Brevity | Illyria | every line has at most `brevity` units (English: 6 words) | `devices.ts:129-139` |
| `swell` | The Swell | The Tempest | the last line is strictly the longest (2+ lines) | `devices.ts:140-146` |
| `balance` | Balance | Lake District | 2+ lines, all of the same length | `devices.ts:147-155` |
| `ring` | The Ring | Gothic Circle | the first unit of the first line equals the last unit of the last line, in a verse of more than 2 units | `devices.ts:156-167` |
| `invocation` | Invocation | Rome | names a catalogue character: the full name, or its last part when that part is not an ordinary word ("Antony", "Byron"; not "Man" or "Nurse"), or the name as the duel's language writes it | `devices.ts:168-180,251-263` |
| `grandeur` | Grandeur | Olympus | 2 different words of at least `grand` letters (English: 9) | `devices.ts:181-191` |
| `monorhyme` | One Rhyme | Legendary (The Sonnet Man only) | 2+ lines, every line's last word rhymes with the first line's | `devices.ts:192-197` |

- **Fallbacks without rhyme.** Where rhyme cannot be checked (Chinese, Japanese and Thai without their sound data), Inner Rhyme becomes The Drumbeat and One Rhyme becomes The Ring, "so no card is left with a flourish that can never land" (`devices.ts:218-228`).
- **Device names in English.** They come from `english.ts:82-110`, and each house's "why" line from `english.ts:23-28,130-137`.

**Signature (every character)** (`devices.ts:272-345`).
- **Which words count.** The "telling" words of the card's English quote: words of 4 letters or more that are not stop words.
- **How many are needed.** Two if the quote has 3 or more such words, one if it has one or two (`signatureNeeded`, `devices.ts:313-316`). A quote with none is echoed by its longest two-word phrase (`devices.ts:295-306`).
- **Reciting is not echoing.** Four of the quote's words in a row is a quotation and does not land (`quotesEnglish`, `devices.ts:347-360`; code `'quoted'`, `:334`).
- **Other languages.** A duel in another language is also judged by the card's line in that language (`devices.ts:328-330`; `src/lib/verse/echo.ts`).
- Each card's signature words are listed in section 2.

**Curses (potions)** (`devices.ts:362-434`). A curse binds the opponent's next verse and costs 4 craft per breach, up to 12.

| Curse id | Name | Rule (English thresholds) | Potions | Source |
|---|---|---|---|---|
| `forbidden-letter` | Forbidden Letter | no word may contain the drawn letter. Look-alike letters of other alphabets, and digits that stand in for the letter, count | PT-002, PT-006, PT-009 | `devices.ts:378-389,424-434` |
| `short-words` | Tongue-Tied | no word longer than `shortWord` letters (6) | PT-004, PT-008 | `devices.ts:390-395` |
| `no-repeats` | No Echoes | no word of `content` letters (4) or more used twice; each part of a hyphenated word counts | PT-001, PT-005 | `devices.ts:396-411` |
| `short-lines` | Short Breath | no line longer than `shortLine` units (5 words) | PT-003, PT-007 | `devices.ts:412-416` |

**Relics** lend five power words each (`src/lib/verse/packs/en.ts:7-17`, one list per language pack). Using 2 of them earns +6 craft (above).
- **English** asks for the exact word.
- **Other languages.** A word that begins with the power word counts, or with all but its last letter for a power word of 4 letters or more.
- **Arabic** accepts the word anywhere inside a word.
- **Chinese, Japanese and Thai** accept it anywhere in the line (`devices.ts:442-473`).

**Per-language thresholds** (`src/lib/verse/lang.ts:33-55`). The unit is a word, except in Chinese and Japanese, where it is a character.

| Lang | content | riposte | grand | shortWord | brevity | shortLine |
|---|---|---|---|---|---|---|
| en | 4 | 5 | 9 | 6 | 6 | 5 |
| es fr it pt pl ru id | 4 | 5 | 10 | 7 | 6 | 5 |
| de | 4 | 5 | 12 | 8 | 6 | 5 |
| ar | 3 | 4 | 7 | 5 | 5 | 4 |
| hi | 3 | 3 | 5 | 4 | 6 | 5 |
| ko | 2 | 3 | 5 | 3 | 4 | 3 |
| vi | 3 | 4 | 6 | 5 | 6 | 5 |
| th | 3 | 4 | 7 | 5 | 7 | 6 |
| zh (char) | 2 | 2 | 3 | 2 | 7 | 5 |
| ja (char) | 2 | 2 | 4 | 3 | 12 | 10 |

### 1.6 What the opponent does

- **Without a model (the "written opponent").** It plays a verse from the duel language's pack that keeps the form, picked by the seed (`writtenVerse`, `src/lib/verse/opponent.ts:172-178`).
  - Under a curse it plays the verse of its bank that loses least to the curse (`opponent.ts:132-141`).
  - The English bank holds 17 `written` verses over 8 forms, 17 `spare` verses and 36 acrostic lines (section 6.7).
  - It is the opponent on every phone and headset, wherever the player has not downloaded Gemma, and in Arabic, Japanese, Korean and Vietnamese on every device (section 8).
- **With a model that writes the duel's language** (Gemma 4 E2B, in 12 languages: `src/lib/brain.ts:65`):
  - **The prompt.** It is English and names the language to write in. The system message is "You are {card.name} in a duel of verses: theatrical, sharp, in character. Your line in the play: "{quote}"". The player's last verse is passed as JSON data and the round's rules come after it (`opponent.ts:57-84`).
  - **Drafts.** The model writes `CANDIDATES` drafts: Apprentice 1, Player 2, Master 3 (`opponent.ts:42`). Draft *i* is sampled at temperature 0.7 + 0.1·i, with at most 28 + 22 × lines tokens (`opponent.ts:149`).
  - **Choosing.** The draft with the most craft, by the scorer the player is scored with, is played (`opponent.ts:150-153`).
  - **Fallback.** If the best draft is void, or worth less than half the written verse's craft, the written verse is played instead (`opponent.ts:158-161`).
- **Difficulty does nothing without a model.** `CANDIDATES` is read only in the model branch (`opponent.ts:143-162`). Wherever the written opponent plays, Apprentice, Player and Master meet the same verses. The Theatre fixes the difficulty at `'player'` (section 3).

### 1.7 The rule judge and the model judge

**Which judge runs.**
- **The model judges** only when the player has loaded a model and that model is listed as judging the duel's language (`judgedByModel`, `src/lib/verse/referee.ts:126-128`; `referee`, `:133-142`; `session.ts:228-230`). The lists are Gemma 4 E2B in en, ru, zh and id, and LFM3 1.7B in vi (`brain.ts:67,74`).
- **The rules judge** everywhere else, and also if the model's reading fails (`referee.ts:137-141`).
- **The verdict says which judged** (`battle.astro:935-940`).

**The rule judge** (`rulesJudge`, `judge.ts:479-501`). It compares the two verses on four criteria. A tie on a criterion is a split, and a thin verse loses every criterion to a real one (`judge.ts:490-496`).

| Criterion | Measured as | Source |
|---|---|---|
| wordplay | different telling words in the first N lines, where N is the shorter verse's line count, capped at 30 (`MAX_VARIETY`) | `judge.ts:401-407,482-485` |
| allusion | different words from the allusion lexicon: character names of 4 or more letters, and every card's signature words, in English and in the duel's language | `judge.ts:443-449`; `referee.ts:28-51` |
| flow | 2 × the pairs of rhymed line ends, + lines that open on the same content word as the line before (a line that only repeats the one before does not count), + 1 if there are 3+ lines each longer than the last, − the spread of line lengths over their mean (in syllables where countable). A single line scores −10. | `judge.ts:409-441` |
| wit | words of the answered verse thrown back (telling, at least `riposte` letters), up to 3 (`MAX_THROWN`), compared only when both verses answered one; otherwise a split | `judge.ts:451-464,488` |

- **The written opponent answers nothing.** The session passes the player's previous verse to the judge only when a model wrote the opponent's verse (`session.ts:225-227`). So **against the written opponent, and in every round one, wit is always a split** (3 points each).
- **What the rule judge is held to.** On labelled pairs in all 16 languages it must be at least as accurate as `main`'s rule judge (`src/lib/verse/judge-accuracy.test.ts:79-91`). `main`'s tallies, in criteria given to the better verse / split / given to the worse, are en 115/79/19 and zh 0/40/0 (`judge-accuracy.test.ts:33-35`).

**The model judge** has two methods, both of which return per-criterion margins and never text (`judge.ts:14-18`).
- **Compare** (Gemma 4 E2B, LFM3 1.7B: `judge: 'compare'`, `brain.ts:63,70`).
  - For each criterion the model is asked "Which verse is better on this criterion? Reply A or B", once in each order (`compareMessages`, `judge.ts:234-255`; `referee.ts:63-70,116-120`). That makes 8 readings a round.
  - The lean is forward minus reversed, and a lean under `SPLIT_BELOW = 0.1` is a split (`judge.ts:43,265-276`). The two orders cancel the model's bias for a position (`judge.ts:4-12`).
- **Grade** (LFM2.5 350M, `judge: 'grade'`, `brain.ts:77`; it is never offered, see 1.8).
  - Each verse gets an expected grade from 1 to 5 per criterion (`judge.ts:300-326`).
  - The rule judge's verdict stands wherever it is not a split. The model decides a split criterion only by a gap of `GRADE_MARGIN = 0.5` or more (`judge.ts:354-381`).
  - A round in which either verse has a line that addresses the judge (a digit, a number word, or a judge word) is decided by the rules alone (`referee.ts:108-115`; `judge.ts:202-219`). The player is shown which lines would go unread (`session.ts:198-208`).
- **Measured quality** (eight pairs, four criteria each, `brain.ts:24-34`):
  - Gemma 4 E2B: 31/32 compare, 31/32 grade.
  - LFM3 1.7B: 27/32 compare, 21/32 grade.
  - LFM2.5 350M: 9/32 compare, 25/32 grade.
  - Per-language measurement is in `docs/language/MODEL-EVAL.md` ("66 of 96 cells measured").

### 1.8 Difficulty and opponent tiers

- **Difficulty** is the number of drafts a model writes (1.6).
- **Model tiers** (`brain.ts:11-14,61-83`):

  | Tier | Model | Download | Writes in | Judges in |
  |---|---|---|---|---|
  | grand | Gemma 4 E2B | 3,100 MB | en es fr de it pt pl ru hi zh th id | en ru zh id |
  | standard | LFM3 1.7B | 1,090 MB | none | vi |
  | lite | LFM2.5 350M | 295 MB | none | none |

- **Which device is offered what.** A handheld (phone, tablet, Quest or Vision Pro browser) or a device without 16-bit shaders or with under 8 GB reported is put on the lite tier (`brain.ts:120-125,142-148`). That tier is used in no language and is therefore never offered (`modelsToOffer`, `brain.ts:159-164`). Any other WebGPU desktop is offered Gemma 4 E2B first and LFM3 1.7B as the lighter download.
- **Who the player meets.**
  - Gemma's languages: a Gemma-written opponent, on a capable desktop that chose Gemma.
  - Everywhere and everyone else: the written opponent.
  - LFM3 changes only the judge, and only in Vietnamese.
- **Story mode.** Its encounters carry difficulty labels (easy, medium, hard), but they are labels only (section 6.5).

### 1.9 What decides a win

- **Round.** The higher total, then the judge's preference, then the challenger (1.3).
- **Match.** The first side to two rounds (`duel.ts:576-583`). Since a solo round cannot be drawn, three rounds always decide it (`session.ts:241`).
- **Online.** The rules differ: both players write at once, and a level round is a draw. A match goes to the first to 2 rounds, then the most rounds, then the most points, else it is a draw (section 5.3; `backend/src/verse/duel.rs:559-594`).
  - The signature and the house device count as in solo play: the server's `online_craft` calls the same `score_verse` (`backend/src/verse/duel.rs:542-557`).
  - There are no relics, potions, ink or world cards, and no model judges (`src/lib/multiplayer-rules.ts:28-39`).

## 2. The card catalogue

`src/lib/cards.ts` is "the single source of truth for card data across all pages" (`src/lib/cards.ts:1-4`). The table below was **generated, not copied**: a Node script imported `CARD_CATALOG` from `src/lib/cards.ts`, `deviceForHouse`, `signatureWords`, `signatureNeeded` and `POTION_CURSE` from `src/lib/verse/devices.ts`, and the relics' power words from `src/lib/verse/packs/en.ts:7-17`. It checked that every image file exists under `public/`, and all 71 do.

**Totals** (from the same script):
- **Cards.** 71: 53 Characters, 9 Relics and 9 Potions.
- **By rarity.** Common 9, Uncommon 21, Rare 25, Epic 13, Legendary 3. The three Legendary cards are The Sonnet Man, Prospero's Staff and Zeus.
- **By era.** 51 shakespeare, 10 romantic and 10 mythology (`era`, `cards.ts:9,28,749-751`).
- **Characters by house.** Montague 4, Capulet 3, Danish Court 4, Forest of Arden 4, Verona Court 4, The Tempest 4, Scottish Court 3, Illyria 3, Rome 3, Legendary 1, Lake District 5, Gothic Circle 5, Olympus 7, Underworld 3.

**How to read it:**
- "Id (line)" is the line of the card's `id:` in `src/lib/cards.ts`.
- **What the stats do.** ATK/DEF/HP and Element are shown on the card and play no part in a duel (1.3).
- **What rarity does.** It sets only the odds of drawing a card and the fanfare when one is won (`cards.ts:740-746`; `src/lib/audio-manager.ts:254-263`).
- **Device.** A character's device is its house's (`devices.ts:201-216`). All characters of a house share one device, and what tells them apart in play is their signature words.
  - † marks a rhyme device. In Chinese, Japanese and Thai it becomes The Drumbeat (Inner Rhyme) or The Ring (One Rhyme) if that language's sound data has not loaded (`devices.ts:218-228`).
  - ‡ marks The Riposte. It is held to The Outcry in a verse that opens a round, which in a solo duel only the opponent writes (`devices.ts:230-242`).
- **Signature.** "Echo N of [...]" means the verse must use N of those words from the card's English quote without reciting four quote words in a row. Another language's duel also accepts the line as that language prints it (1.5).
- **Relic or Potion.** Its effect is the same for every card of its type except for its power words or its curse.
- **The quote** is the English line exactly as `cards.ts` holds it. Its sources are recorded in `docs/language/NAMES-AND-QUOTATIONS.md` (section 6.4).

| # | Id (`src/lib/cards.ts` line) | Name | House | Type | Rarity | Era | ATK/DEF/HP | Element | What it does in a duel | Art file | Quote |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | SM-001 (:33) | The Sonnet Man | Legendary | Character | Legendary | shakespeare | 95/80/100 | Fire | Device: One Rhyme†. Signature: echo 1 of [compare, summer] | `/images/cards/sm-001.webp` | Shall I compare thee to a summer's day? |
| 2 | MO-001 (:42) | Romeo | Montague | Character | Rare | shakespeare | 75/60/85 | Passion | Device: Inner Rhyme†. Signature: echo 2 of [soft, light, yonder, window, breaks] | `/images/cards/mo-001.webp` | But soft, what light through yonder window breaks? |
| 3 | CA-001 (:51) | Juliet | Capulet | Character | Rare | shakespeare | 70/75/90 | Grace | Device: The Outcry. Signature: echo 2 of [name, call, rose] | `/images/cards/ca-001.webp` | What's in a name? That which we call a rose... |
| 4 | DC-001 (:60) | Hamlet | Danish Court | Character | Epic | shakespeare | 85/70/95 | Shadow | Device: The Question. Signature: echo 1 of [question] | `/images/cards/dc-001.webp` | To be, or not to be, that is the question. |
| 5 | DC-002 (:69) | Ophelia | Danish Court | Character | Rare | shakespeare | 55/85/80 | Water | Device: The Question. Signature: echo 1 of [rosemary, remembrance] | `/images/cards/dc-002.webp` | There's rosemary, that's for remembrance. |
| 6 | MO-002 (:78) | Mercutio | Montague | Character | Rare | shakespeare | 80/55/75 | Wind | Device: Inner Rhyme†. Signature: echo 1 of [plague, houses] | `/images/cards/mo-002.webp` | A plague on both your houses! |
| 7 | FA-001 (:87) | Puck | Forest of Arden | Character | Uncommon | shakespeare | 65/65/70 | Trickster | Device: Alliteration. Signature: echo 1 of [fools, mortals] | `/images/cards/fa-001.webp` | Lord, what fools these mortals be! |
| 8 | FA-002 (:96) | Titania | Forest of Arden | Character | Epic | shakespeare | 60/90/85 | Nature | Device: Alliteration. Signature: echo 1 of [flowery] | `/images/cards/fa-002.webp` | Come, sit thee down upon this flowery bed. |
| 9 | RL-001 (:105) | Yorick's Skull | Relic | Relic | Rare | shakespeare | 0/0/0 | Death | Relic, 1 ink: lends power words skull, jest, grave, laugh, dust; 2 of them = +6 craft | `/images/cards/rl-001.webp` | Alas, poor Yorick! I knew him, Horatio. |
| 10 | RL-002 (:114) | Prospero's Staff | Relic | Relic | Legendary | shakespeare | 0/0/0 | Arcane | Relic, 1 ink: lends power words storm, spell, staff, island, drown; 2 of them = +6 craft | `/images/cards/rl-002.webp` | Now my charms are all o'erthrown. |
| 11 | PT-001 (:123) | Love Potion | Potion | Potion | Common | shakespeare | 0/0/0 | Enchantment | Potion, 1 ink: curses the opponent's next verse with No Echoes (`no-repeats`), -4 craft per breach, cap -12 | `/images/cards/pt-001.webp` | The course of true love never did run smooth. |
| 12 | PT-002 (:132) | Witches' Brew | Potion | Potion | Uncommon | shakespeare | 0/0/0 | Dark | Potion, 1 ink: curses the opponent's next verse with Forbidden Letter (`forbidden-letter`), -4 craft per breach, cap -12 | `/images/cards/pt-002.webp` | Double, double toil and trouble. |
| 13 | VC-001 (:143) | Prince Escalus | Verona Court | Character | Epic | shakespeare | 70/85/95 | Justice | Device: The Riposte‡. Signature: echo 2 of [disturb, streets, lives, forfeit, peace] | `/images/cards/vc-001.webp` | If ever you disturb our streets again, your lives shall pay the forfeit of the peace. |
| 14 | VC-002 (:152) | Friar Lawrence | Verona Court | Character | Uncommon | shakespeare | 35/80/90 | Earth | Device: The Riposte‡. Signature: echo 2 of [violent, delights, ends] | `/images/cards/vc-002.webp` | These violent delights have violent ends. |
| 15 | VC-003 (:161) | The Nurse | Verona Court | Character | Common | shakespeare | 30/70/85 | Loyalty | Device: The Riposte‡. Signature: echo 2 of [drudge, toil, delight] | `/images/cards/vc-003.webp` | I am the drudge and toil in your delight. |
| 16 | TP-001 (:172) | Prospero | The Tempest | Character | Epic | shakespeare | 90/85/90 | Storm | Device: The Swell. Signature: echo 1 of [stuff, dreams] | `/images/cards/tp-001.webp` | We are such stuff as dreams are made on. |
| 17 | TP-002 (:181) | Ariel | The Tempest | Character | Rare | shakespeare | 70/75/65 | Air | Device: The Swell. Signature: echo 2 of [hail, great, master, grave] | `/images/cards/tp-002.webp` | All hail, great master! Grave sir, hail! |
| 18 | TP-003 (:190) | Caliban | The Tempest | Character | Uncommon | shakespeare | 75/45/80 | Beast | Device: The Swell. Signature: echo 2 of [island, sycorax, mother] | `/images/cards/tp-003.webp` | This island's mine, by Sycorax my mother. |
| 19 | MO-003 (:201) | Benvolio | Montague | Character | Common | shakespeare | 55/70/75 | Peace | Device: Inner Rhyme†. Signature: echo 2 of [keep, peace, sword] | `/images/cards/mo-003.webp` | I do but keep the peace. Put up thy sword. |
| 20 | CA-002 (:210) | Tybalt | Capulet | Character | Rare | shakespeare | 88/50/70 | Fire | Device: The Outcry. Signature: echo 2 of [drawn, talk, peace, hate, word] | `/images/cards/ca-002.webp` | What, drawn, and talk of peace? I hate the word. |
| 21 | DC-003 (:219) | King Claudius | Danish Court | Character | Rare | shakespeare | 80/60/85 | Poison | Device: The Question. Signature: echo 2 of [words, thoughts, remain, below] | `/images/cards/dc-003.webp` | My words fly up, my thoughts remain below. |
| 22 | FA-003 (:228) | Oberon | Forest of Arden | Character | Epic | shakespeare | 75/80/85 | Moonlight | Device: Alliteration. Signature: echo 2 of [moonlight, proud, titania] | `/images/cards/fa-003.webp` | Ill met by moonlight, proud Titania. |
| 23 | RL-003 (:239) | Dagger of the Mind | Relic | Relic | Uncommon | shakespeare | 0/0/0 | Illusion | Relic, 1 ink: lends power words dagger, blood, sleep, vision, hand; 2 of them = +6 craft | `/images/cards/rl-003.webp` | Is this a dagger which I see before me? |
| 24 | PT-003 (:248) | Puck's Flower Juice | Potion | Potion | Common | shakespeare | 0/0/0 | Mischief | Potion, 1 ink: curses the opponent's next verse with Short Breath (`short-lines`), -4 craft per breach, cap -12 | `/images/cards/pt-003.webp` | I'll put a girdle round about the earth in forty minutes. |
| 25 | SC-001 (:259) | Macbeth | Scottish Court | Character | Epic | shakespeare | 88/65/90 | Ambition | Device: The Drumbeat. Signature: echo 2 of [dare, become, dares] | `/images/cards/sc-001.webp` | I dare do all that may become a man; who dares do more is none. |
| 26 | SC-002 (:268) | Lady Macbeth | Scottish Court | Character | Rare | shakespeare | 80/55/75 | Darkness | Device: The Drumbeat. Signature: echo 2 of [spirits, tend, mortal, thoughts, unsex] | `/images/cards/sc-002.webp` | Come, you spirits that tend on mortal thoughts, unsex me here. |
| 27 | SC-003 (:277) | Banquo | Scottish Court | Character | Uncommon | shakespeare | 65/75/80 | Prophecy | Device: The Drumbeat. Signature: echo 1 of [kings] | `/images/cards/sc-003.webp` | Thou shalt get kings, though thou be none. |
| 28 | IL-001 (:288) | Viola | Illyria | Character | Rare | shakespeare | 70/80/85 | Disguise | Device: Brevity. Signature: echo 1 of [not what] | `/images/cards/il-001.webp` | I am not what I am. |
| 29 | IL-002 (:297) | Malvolio | Illyria | Character | Uncommon | shakespeare | 50/65/70 | Vanity | Device: Brevity. Signature: echo 2 of [born, great, achieve, greatness, thrust] | `/images/cards/il-002.webp` | Some are born great, some achieve greatness, and some have greatness thrust upon them. |
| 30 | IL-003 (:306) | Olivia | Illyria | Character | Rare | shakespeare | 55/85/90 | Grace | Device: Brevity. Signature: echo 2 of [love, sought, good, given, unsought, better] | `/images/cards/il-003.webp` | Love sought is good, but given unsought, is better. |
| 31 | RM-001 (:317) | Brutus | Rome | Character | Epic | shakespeare | 80/75/90 | Honor | Device: Invocation. Signature: echo 2 of [loved, caesar, less, rome] | `/images/cards/rm-001.webp` | Not that I loved Caesar less, but that I loved Rome more. |
| 32 | RM-002 (:326) | Cassius | Rome | Character | Rare | shakespeare | 85/55/75 | Envy | Device: Invocation. Signature: echo 2 of [fault, dear, brutus, stars, ourselves] | `/images/cards/rm-002.webp` | The fault, dear Brutus, is not in our stars, but in ourselves. |
| 33 | RM-003 (:335) | Mark Antony | Rome | Character | Epic | shakespeare | 90/70/85 | Rhetoric | Device: Invocation. Signature: echo 2 of [friends, romans, countrymen, lend, ears] | `/images/cards/rm-003.webp` | Friends, Romans, countrymen, lend me your ears! |
| 34 | MO-004 (:346) | Lord Montague | Montague | Character | Common | shakespeare | 45/60/70 | Authority | Device: Inner Rhyme†. Signature: echo 2 of [morning, seen, tears, augmenting, fresh] | `/images/cards/mo-004.webp` | Many a morning hath he there been seen, with tears augmenting the fresh morning dew. |
| 35 | CA-003 (:355) | Lady Capulet | Capulet | Character | Uncommon | shakespeare | 50/70/75 | Ambition | Device: The Outcry. Signature: echo 2 of [marry, theme, talk] | `/images/cards/ca-003.webp` | Marry, that marry is the very theme I came to talk of. |
| 36 | DC-004 (:364) | Horatio | Danish Court | Character | Uncommon | shakespeare | 50/80/85 | Loyalty | Device: The Question. Signature: echo 2 of [cracks, noble, heart, good, night, sweet, prince] | `/images/cards/dc-004.webp` | Now cracks a noble heart. Good night, sweet prince. |
| 37 | FA-004 (:373) | Bottom | Forest of Arden | Character | Common | shakespeare | 40/55/65 | Comedy | Device: Alliteration. Signature: echo 2 of [rare, vision, dream, past] | `/images/cards/fa-004.webp` | I have had a most rare vision. I have had a dream, past the wit of man. |
| 38 | VC-004 (:382) | Paris | Verona Court | Character | Uncommon | shakespeare | 60/65/70 | Duty | Device: The Riposte‡. Signature: echo 2 of [times, afford, time] | `/images/cards/vc-004.webp` | These times of woe afford no time to woo. |
| 39 | TP-004 (:391) | Miranda | The Tempest | Character | Uncommon | shakespeare | 45/75/80 | Innocence | Device: The Swell. Signature: echo 2 of [brave, world, people] | `/images/cards/tp-004.webp` | O brave new world, that has such people in it! |
| 40 | RL-004 (:402) | Romeo's Ring | Relic | Relic | Rare | shakespeare | 0/0/0 | Devotion | Relic, 1 ink: lends power words ring, vow, night, banished, kiss; 2 of them = +6 craft | `/images/cards/rl-004.webp` | My bounty is as boundless as the sea, my love as deep. |
| 41 | RL-005 (:411) | Portia's Casket | Relic | Relic | Uncommon | shakespeare | 0/0/0 | Wisdom | Relic, 1 ink: lends power words gold, choice, mercy, lead, casket; 2 of them = +6 craft | `/images/cards/rl-005.webp` | All that glisters is not gold. |
| 42 | RL-006 (:420) | Macbeth's Crown | Relic | Relic | Epic | shakespeare | 0/0/0 | Power | Relic, 1 ink: lends power words crown, throne, ambition, witch, king; 2 of them = +6 craft | `/images/cards/rl-006.webp` | Uneasy lies the head that wears a crown. |
| 43 | RL-007 (:429) | The Tempest Codex | Relic | Relic | Rare | shakespeare | 0/0/0 | Knowledge | Relic, 1 ink: lends power words book, tempest, magic, page, drown; 2 of them = +6 craft | `/images/cards/rl-007.webp` | I'll drown my book. |
| 44 | RL-008 (:438) | Cordelia's Tears | Relic | Relic | Rare | shakespeare | 0/0/0 | Compassion | Relic, 1 ink: lends power words tears, truth, daughter, nothing, heart; 2 of them = +6 craft | `/images/cards/rl-008.webp` | O dear father, it is thy business that I go about. |
| 45 | RL-009 (:447) | Bottom's Mask | Relic | Relic | Uncommon | shakespeare | 0/0/0 | Transformation | Relic, 1 ink: lends power words mask, dream, fool, play, moon; 2 of them = +6 craft | `/images/cards/rl-009.webp` | Bless thee, Bottom! Thou art translated! |
| 46 | PT-004 (:458) | Mandrake Root | Potion | Potion | Common | shakespeare | 0/0/0 | Earth | Potion, 1 ink: curses the opponent's next verse with Tongue-Tied (`short-words`), -4 craft per breach, cap -12 | `/images/cards/pt-004.webp` | Not poppy, nor mandragora, nor all the drowsy syrups of the world. |
| 47 | PT-005 (:467) | Oberon's Dew | Potion | Potion | Rare | shakespeare | 0/0/0 | Enchantment | Potion, 1 ink: curses the opponent's next verse with No Echoes (`no-repeats`), -4 craft per breach, cap -12 | `/images/cards/pt-005.webp` | Fetch me that flower; the herb I showed thee once. |
| 48 | PT-006 (:476) | Hemlock Tincture | Potion | Potion | Uncommon | shakespeare | 0/0/0 | Poison | Potion, 1 ink: curses the opponent's next verse with Forbidden Letter (`forbidden-letter`), -4 craft per breach, cap -12 | `/images/cards/pt-006.webp` | Upon my secure hour thy uncle stole, with juice of cursed hebona in a vial. |
| 49 | PT-007 (:485) | Mistletoe Extract | Potion | Potion | Common | shakespeare | 0/0/0 | Nature | Potion, 1 ink: curses the opponent's next verse with Short Breath (`short-lines`), -4 craft per breach, cap -12 | `/images/cards/pt-007.webp` | In the cauldron boil and bake; eye of newt and toe of frog. |
| 50 | PT-008 (:494) | Mermaid's Tears | Potion | Potion | Rare | shakespeare | 0/0/0 | Ocean | Potion, 1 ink: curses the opponent's next verse with Tongue-Tied (`short-words`), -4 craft per breach, cap -12 | `/images/cards/pt-008.webp` | Full fathom five thy father lies; of his bones are coral made. |
| 51 | PT-009 (:503) | Apothecary's Elixir | Potion | Potion | Uncommon | shakespeare | 0/0/0 | Alchemy | Potion, 1 ink: curses the opponent's next verse with Forbidden Letter (`forbidden-letter`), -4 craft per breach, cap -12 | `/images/cards/pt-009.webp` | Put this in any liquid thing you will, and drink it off; and, if you had the strength of twenty men, it would dispatch you straight. |
| 52 | LD-001 (:518) | William Wordsworth | Lake District | Character | Uncommon | romantic | 55/85/90 | Nature | Device: Balance. Signature: echo 2 of [wandered, lonely, cloud, floats, high, vales, hills] | `/images/cards/ld-001.webp` | I wandered lonely as a cloud that floats on high o'er vales and hills. |
| 53 | LD-002 (:528) | Samuel Coleridge | Lake District | Character | Uncommon | romantic | 70/70/80 | Vision | Device: Balance. Signature: echo 2 of [water, drop, drink] | `/images/cards/ld-002.webp` | Water, water, every where, nor any drop to drink. |
| 54 | LD-003 (:538) | John Keats | Lake District | Character | Rare | romantic | 65/75/70 | Beauty | Device: Balance. Signature: echo 2 of [beauty, loveliness, increases] | `/images/cards/ld-003.webp` | A thing of beauty is a joy for ever: its loveliness increases. |
| 55 | GC-001 (:550) | Lord Byron | Gothic Circle | Character | Rare | romantic | 85/60/80 | Rebellion | Device: The Ring. Signature: echo 2 of [walks, beauty, night, cloudless, climes, starry, skies] | `/images/cards/gc-001.webp` | She walks in beauty, like the night of cloudless climes and starry skies. |
| 56 | GC-002 (:560) | Mary Shelley | Gothic Circle | Character | Epic | romantic | 80/75/85 | Creation | Device: The Ring. Signature: echo 2 of [beware, fearless, therefore, powerful] | `/images/cards/gc-002.webp` | Beware; for I am fearless, and therefore powerful. |
| 57 | GC-003 (:570) | Edgar Allan Poe | Gothic Circle | Character | Rare | romantic | 75/65/75 | Darkness | Device: The Ring. Signature: echo 2 of [midnight, dreary, pondered, weak, weary] | `/images/cards/gc-003.webp` | Once upon a midnight dreary, while I pondered, weak and weary. |
| 58 | GC-004 (:580) | William Blake | Gothic Circle | Character | Rare | romantic | 70/80/85 | Prophecy | Device: The Ring. Signature: echo 2 of [world, grain, sand, heaven, wild, flower] | `/images/cards/gc-004.webp` | To see a World in a Grain of Sand and a Heaven in a Wild Flower. |
| 59 | GC-005 (:592) | Percy Bysshe Shelley | Gothic Circle | Character | Epic | romantic | 75/70/75 | Revolution | Device: The Ring. Signature: echo 2 of [winter, spring, behind] | `/images/cards/gc-005.webp` | If Winter comes, can Spring be far behind? |
| 60 | LD-004 (:602) | Elizabeth Barrett Browning | Lake District | Character | Uncommon | romantic | 60/80/85 | Devotion | Device: Balance. Signature: echo 2 of [love, count, ways] | `/images/cards/ld-004.webp` | How do I love thee? Let me count the ways. |
| 61 | LD-005 (:612) | Christina Rossetti | Lake District | Character | Common | romantic | 50/75/70 | Sorrow | Device: Balance. Signature: echo 2 of [remember, gone, away, silent, land] | `/images/cards/ld-005.webp` | Remember me when I am gone away, gone far away into the silent land. |
| 62 | OL-001 (:628) | Zeus | Olympus | Character | Legendary | mythology | 95/85/100 | Thunder | Device: Grandeur. Signature: echo 2 of [cloud, gatherer, wide, heavens] | `/images/cards/ol-001.webp` | I am the cloud-gatherer, lord of the wide heavens. |
| 63 | OL-002 (:638) | Athena | Olympus | Character | Epic | mythology | 85/90/90 | Wisdom | Device: Grandeur. Signature: echo 2 of [wisdom, flight, dusk] | `/images/cards/ol-002.webp` | The owl of wisdom takes flight only at dusk. |
| 64 | OL-003 (:648) | Apollo | Olympus | Character | Uncommon | mythology | 80/70/85 | Light | Device: Grandeur. Signature: echo 2 of [song, healing, radiant] | `/images/cards/ol-003.webp` | I am the god of song, of healing, and of the radiant sun. |
| 65 | OL-004 (:658) | Aphrodite | Olympus | Character | Uncommon | mythology | 60/80/85 | Love | Device: Grandeur. Signature: echo 2 of [gods, resist, power, love] | `/images/cards/ol-004.webp` | Even the gods cannot resist the power of love. |
| 66 | OL-005 (:668) | Hermes | Olympus | Character | Uncommon | mythology | 75/65/70 | Speed | Device: Grandeur. Signature: echo 2 of [swift, thought, carry, words, gods, mortal, ears] | `/images/cards/ol-005.webp` | Swift as thought, I carry the words of gods to mortal ears. |
| 67 | UW-001 (:680) | Hades | Underworld | Character | Rare | mythology | 90/80/95 | Death | Device: The Riposte‡. Signature: echo 1 of [souls, patient] | `/images/cards/uw-001.webp` | All souls come to me in the end. I am patient. |
| 68 | UW-002 (:690) | Persephone | Underworld | Character | Epic | mythology | 70/85/90 | Rebirth | Device: The Riposte‡. Signature: echo 2 of [seeds, bound, myself, worlds, forever] | `/images/cards/uw-002.webp` | Six seeds I ate, and bound myself between two worlds forever. |
| 69 | OL-006 (:700) | Odysseus | Olympus | Character | Rare | mythology | 80/75/85 | Cunning | Device: Grandeur. Signature: echo 2 of [tell, muse, ways, wandered] | `/images/cards/ol-006.webp` | Tell me, O Muse, of the man of many ways, who wandered far. |
| 70 | UW-003 (:710) | Medusa | Underworld | Character | Rare | mythology | 85/60/75 | Petrification | Device: The Riposte‡. Signature: echo 2 of [dare, gaze, last] | `/images/cards/uw-003.webp` | Look upon me, if you dare. My gaze is the last thing you will see. |
| 71 | OL-007 (:720) | Achilles | Olympus | Character | Rare | mythology | 95/50/80 | Glory | Device: Grandeur. Signature: echo 2 of [rather, live, short, life, glory, long, forgotten] | `/images/cards/ol-007.webp` | I would rather live a short life of glory than a long life forgotten. |

## 3. Modes and screens

In this section "Nav" means the header (desktop `src/layouts/BaseLayout.astro:211-244`, mobile `:425-439`); "footer" means
`BaseLayout.astro:486-502`. The header has Home, Collection, a **Play** menu (Playground,
Battle Arena, Multiplayer, Tournaments: `:221-224`), an **Explore** menu (World Map,
Marketplace, VR Gallery, 3D Viewer: `:236-239`), About and Profile. The footer repeats
Collection, Playground, Battle, Multiplayer, Marketplace, Tournaments, World Map, Profile,
About, Privacy and Terms (`:486-502`). **Theatre, Story, Season and Classroom are in neither.**

`public/sitemap.xml` lists `/`, collection, playground, multiplayer, classroom, battle,
marketplace, tournaments, profile, season, story, about, privacy and terms, and also
**`/trivia/` and `/challenges/` (`public/sitemap.xml:40`, `:46`), which have no page**:
`src/pages/` holds no `trivia.astro` or `challenges.astro`. The sitemap leaves out theatre,
world-map, viewer and vr, and every entry has `lastmod` 2026-02-16 (`public/sitemap.xml:5`).
The PWA manifest has two shortcuts: `/battle` and `/theatre` (`public/manifest.json:80-125`).

Every page is loaded by `tests/prod-smoke.spec.ts:10-12`, which checks that it renders with no
4xx/5xx answer except a 401 from `/api/` (`:32`). `tests/third-party.spec.ts:30-32` reads every
file in `src/pages` and loads each page in every age-gate state.

Backend routes: public `/api/v1/health`, `/auth/*` and `/stats/leaderboard`
(`backend/src/main.rs:122-125`, `backend/src/stats/handlers.rs:59-61`); everything else
(inventory, variants, stats, migrate, multiplayer, marketplace, tournaments, credits, seasons,
classroom, referral) needs a session (`backend/src/main.rs:128-143`). So the marketplace,
tournaments, season and classroom pages show nothing to a visitor who is signed out, not even a
list to browse.

### Summary

| Page | Purpose | Reached from | Status | Evidence (short) |
|---|---|---|---|---|
| `/` index | Landing: pitch, Sonnet Man card, 4 houses, calls to action | Nav, logo | Working (static) | `index.astro`; i18n tests `tests/pages-i18n.spec.ts` |
| `/battle` | Solo verse duel against the written or model opponent | Nav Play, footer, home and playground buttons, manifest shortcut | **Fully working**, the most-tested page | `tests/duel.spec.ts` (19), `card-text`, `battle-bytes`, `battle-ja-cost`, `tests/model/duel-model.spec.ts` |
| `/theatre` | The same duel staged in 3D, with WebXR for Quest 3 and Vision Pro | Only from `/vr` (`vr.astro:22`) and the manifest shortcut | Working, but no card reward and fewer settings than battle | `tests/theatre.spec.ts` (8, including emulated Quest 3) |
| `/multiplayer` | Online duel against a person, scored on the server, English only | Nav Play, footer | Working; needs an account | `tests/multiplayer.spec.ts` (12), `backend/tests/verse_parity.rs` |
| `/collection` | Card grid, card detail with 3D/AR, world-card list, deck builder, achievements | Nav, footer, home, battle, playground | Working; 3D/AR models missing for 17 of 18 cards | `tests/v1-flows.spec.ts`, `v2-world-cards`, `pages-i18n` |
| `/story` | Five-act campaign map | **URL and sitemap only** | **Stub**: encounters show text; none can be played or completed | `story-mode.ts:117` `completeEncounter` has no caller |
| `/playground` | Free starter and daily packs, trivia, quote challenge, onboarding tour | Nav Play, footer, home, about, collection | Working; credit packs and AI questions are dead | `tests/v1-flows.spec.ts`, `tests/play-i18n.spec.ts` |
| `/season` | Season Pass XP and reward track | **URL and sitemap only** | **Partly**: page and API exist; no XP is ever posted, and no season is seeded | `seasons.ts:94` `addXP` has no caller; no `INSERT` in `backend/migrations/` |
| `/tournaments` | List, register, bracket, standings | Nav Play, footer | **Partly**: no way to create one or play a match from the UI | `tournament-client.ts:79` `completeMatch` has no caller; only mocked-API tests |
| `/classroom` | Teacher creates a class with a join code; students join; assignment titles | **URL and sitemap only** | **Partly**: roster and titles only; no progress tracking, though the tour promises it | `backend/src/classroom/handlers.rs:43-54` |
| `/marketplace` | List, buy and trade cards for credits | Nav Explore, footer | **Partly**: works against the API, but the client never earns credits | `src/lib/credits.ts` has no importer |
| `/profile` | Local stats, achievements, collection breakdown, public leaderboard | Nav, account menu | Working locally; the leaderboard ranks self-reported numbers | `stats/handlers.rs:84`; `migration/handlers.rs:139-140` |
| `/world-map` | The 20 cities of world cards: ability, attire, hair, your variants | Nav Explore, footer | Working (read-only); variants come only from a perfect trivia round | `v2-world-cards.spec.ts`; `playground.astro:584` |
| `/viewer` | Splat or GLB 3D view of a character, AR on phones | Nav Explore | **Partly**: offers 53 characters, has files for one (SM-001) | `public/models/` holds `sm-001.glb` and `splats/sm-001.ply` only |
| `/vr` | Babylon gallery of every catalogue card on pedestals, WebXR | Nav Explore | Working (display only), but it shows the whole catalogue, not "your collection" | `vr-engine.ts:78` |
| `/about` | Mission, team, timeline, tech, free-to-play promises | Nav, footer | Working (static); some promises are unwired (credits) | `about.astro:64` |
| `/privacy` | Privacy policy, English | Footer, age gate, sign-in panel | Working (static, English only) | `privacy.astro:7` `lang="en"` |
| `/terms` | Terms of service, English | Footer, age gate, sign-in, playground odds | Working (static, English only) | `terms.astro:7` |

### Dead code: lib modules that no page reaches

A grep for an import of each `src/lib/*.ts` from any non-test source finds none for:

- `src/lib/credits.ts` ("Client-side in-game currency API", `credits.ts:1-3`). The client
  therefore never calls `/credits/earn` or `/credits/spend`, so playing earns no credits.
- `src/lib/referral.ts`. The backend `/referral` and `/referral/redeem` exist
  (`backend/src/referral/handlers.rs:40-41`) but no page offers a code.
- `src/lib/house-allegiance.ts` ("Choose and represent a Shakespeare house…weekly leaderboard",
  `:1-3`).
- `src/lib/draft-mode.ts` ("snake draft picks, then battle", `:1-3`).
- `src/lib/streaks.ts` ("Daily Reward Streak System", `:1-4`) and `src/lib/weekly-events.ts`. Their
  translated strings survive in the playground area (`src/i18n/pages/playground/en.ts:103`, `:112`)
  but no page draws them.
- `src/lib/social-share.ts` and `src/lib/analytics.ts` (Plausible event helpers; the Plausible
  script itself is loaded by the layout, `BaseLayout.astro:70-89`).
- `src/components/ErrorBoundary.tsx`: nothing imports it, and no page uses a React island (no
  `client:` directive anywhere in `src`), so React 19 is in the stack but renders nothing.
- `src/lib/model-eval-aside.ts` and `model-eval-replay.ts` are test tooling, imported only by
  `src/lib/model-eval*.test.ts`.

Functions that are exported, but unused, inside modules that are used:

- `seasons.ts:94` `addXP`: no caller, so season XP never rises from play.
- `tournament-client.ts:79` `completeMatch`: no caller.
- `cards.ts:827` `drawPackByTier`: no caller. The credit-priced Standard, Rare and Epic packs that
  the playground lists are a table of odds, not something a player can buy.
- `story-mode.ts:117` `completeEncounter`: no caller.
- `api-client.ts:297` `updateStats`: no caller. Server stats are written only by the one-time
  migration of local data at sign-in (`BaseLayout.astro:1402-1450`).
- `content-gen.ts` (model-written trivia and quote challenges) runs only when
  `isBrainLoaded()` (`content-gen.ts:173-174`). The playground never loads a model (it imports
  nothing from `brain.ts` that loads one), so in practice the hand-written banks are always used.

### `/` (index)

- On screen: a "Shakespeare on the Go" badge (Devon Glover's programme, `index.astro:47-48`). The
  hero reads "Where Cards Come Alive" and "A card game where your move is a verse… duel an AI
  that runs in your browser" (`src/i18n/pages/home/en.ts:10-11`). Buttons go to Playground and
  Collection (`index.astro:56-62`). Three stats: the catalogue's size, the number of houses
  (counted from Character cards), and "0 Servers Reading Your Solo Duel" (`index.astro:66-81`,
  `home/en.ts:14-16`). A large card shows SM-001 The Sonnet Man with its ATK, HP, DEF and quote
  (`:96-113`). Four feature tiles (`:12-17`, `home/en.ts:21-28`), the four houses Montague,
  Capulet, Danish Court and Forest of Arden with their card counts (`:19-24`, `:171-178`), and a
  call to the arena saying "On a screen, or in a Quest 3 or Vision Pro in the Theatre"
  (`home/en.ts:33`), with no link to the Theatre (`index.astro:192-198` links to `/battle` and
  `/playground`).
- Music: `landing-ambient` starts on the first click (`index.astro:217-222`).
- Status: static and working. Tests: `tests/pages-i18n.spec.ts` (home in 16 languages), and
  third-party and smoke.

### `/battle` (Battle Arena)

- Set-up panel (`battle.astro:23-91`):
  - The deck: your saved active deck if it has at least `ROUNDS` valid characters, otherwise a
    starter deck (`battle.astro:305-322`). `starterDeck` takes owned cards first and then the
    catalogue in order: 3 characters, 1 relic and 1 potion (`src/lib/verse/duel.ts:287-295`). A
    visitor who owns nothing duels with The Sonnet Man, Romeo and Juliet, Yorick's Skull and the
    Love Potion (the first cards of each type, `src/lib/cards.ts:33,42,51,105,123`).
  - The opponent select: Apprentice "writes one draft", Player "picks the better of two drafts"
    (the default) and Master "picks the best of three drafts" (`battle.astro:41-45`).
  - The duel language: all 16 packs are offered (`battle.astro:325`). The choice is remembered
    in `localStorage` `inspired-mile-duel-lang`, and `?lang=` overrides it (`:336`).
  - A world card picker, shown only when variants are owned (`:59-67`).
  - "Your opponent's mind": the model offer (see section 8), with "Play now without a
    download" (`:71-85`).
  - "Begin the duel" (`:90`).
- The duel (`:95-171`): round label, form name and score; the form's brief; the opponent's
  portrait, name, device, curse and verse (`:109-124`); "Who answers?" (the characters in hand)
  and the ink count; relics and potions at "1 ink each" (`:135-136`); the verse textarea,
  `maxlength="600"` (`:144`); the live checklist "What your verse must do" and "Craft so far"
  (`:150-151`); a microphone button (Whisper) and a voice toggle (Kokoro) (`:157-160`); submit
  (`:162`); the verdict; and the match seed with "The same seed and deck draw the same forms"
  (`:170`).
- Rewards and stats: each round won adds `battleWins` and `recordBattleWin()` (`:885-891`). A duel
  won adds one card drawn at random by rarity weight (`:967-971`). The "Rounds won" percentage is
  `battleWins / totalRounds` (`:278`): `battleWins` counts rounds, not duels.
- URL parameters: `?seed=` (`:1059`), `?lang=`, and `?brain=rules|grand|standard|lite|model`
  (`:503-526`; the tiers are for the model tests).
- Status: fully working. Covered by `tests/duel.spec.ts` (set-up, a full match, seeds, ink,
  pasting a verse back, world cards, last-round potions), `tests/card-text.spec.ts`,
  `tests/battle-bytes.spec.ts`, `tests/battle-ja-cost.spec.ts`, `tests/play-i18n.spec.ts`,
  `tests/model/*.spec.ts` (real models), and `src/lib/battle-preview.test.ts`.

### `/theatre` (The Theatre)

- On screen: a Babylon.js canvas stage (`theatre.astro:32`), an "Enter" headset button shown
  only where WebXR is offered (`:25`; `tests/theatre.spec.ts:107`), "New duel", a link to "Play
  the flat version" (`:26-27`), "Or type your verse" (`:36-40`), and tiles for Quest 3 (opens in
  passthrough), Vision Pro (a full stage; "Safari on visionOS does not offer passthrough") and
  Screen (`:43-55`).
- Play: cards and buttons on the stage are picked by pointer, controller ray or pinch
  (`src/lib/xr/theatre.ts:9-11`). The actions are character, item, mic, clear, submit and next
  (`theatre.ts:45-51`). Inside a headset the verse is spoken, not typed (`theatre.ts:11`).
- Fewer choices than the battle page:
  - The difficulty is fixed at `'player'` (`theatre.astro:190`).
  - The language is the one last stored by the battle page, or English (`:183-184`); the page has
    no language picker of its own.
  - A model loads only if the visitor chose one before on the battle page and the device is still
    offered it (`:213`, `rememberedModel`).
  - Stats are counted (`:146-155`), but **no card is awarded for a win**: there is no `addCard`
    import (`theatre.astro:61-73`).
- Reach: not in the nav. Linked from `/vr` (`vr.astro:22`) and the manifest shortcut
  (`public/manifest.json:104-125`).
- Status: working. `tests/theatre.spec.ts` plays a flat-screen duel through the stage, picks a
  card on the canvas, and starts an immersive session as an emulated Quest 3 (`:27-113`), plus
  `tests/theatre-bidi.spec.ts`.

### `/multiplayer`

- Entirely English, marked `lang="en" dir="ltr"` (`multiplayer.astro:8`). Intro: "best of three…
  your verses here are sent to our server, which scores both by fixed rules… No language model
  reads your verse. Requires an account" (`:18-22`). Also: "Online duels are fought in English…
  Solo duels are offered in all sixteen languages" (`:23-26`).
- Lobby: the deck, with "Three to five characters… Relics and potions are not played online yet"
  and "Online you can field the three starter characters and any character your account holds"
  (`:41-42`). Then "Quick match" and "Challenge a friend" (open a room and send the link,
  `:55-71`), a resume banner and an invited banner (`:45-53`).
- In the match: a round timer, "the judge's 24 points are shared once both verses are in"
  (`:139`), the opponent's last verse ("a Riposte may turn a word of it back", `:119`), the seed
  check, a browser re-check of every round that asks the player to report a disagreement
  (`:866`), and "Report your opponent's verse" (`:871-876`, to `POST /multiplayer/report`,
  `backend/src/multiplayer/handlers.rs:75`). The server's round time is 180 s and the reconnect
  grace 45 s (`backend/src/multiplayer/game_room.rs:99-100`).
- Status: fully working for signed-in players. `tests/multiplayer.spec.ts` covers a whole match
  with server scores equal to the preview, quick match, forfeit, reconnect, limits, sign-out and
  the socket (12 tests, `:243-910`); `backend/tests/verse_parity.rs` holds the two engines
  together.

### `/collection`

- On screen: filters (All, Character, Relic, Potion, Owned; `collection.astro:32-38`); a grid of
  all 71 cards, with locked overlays for cards not owned (`:65-96`; 71 is asserted by
  `tests/v1-flows.spec.ts:28`); a card-detail modal with ATK, DEF and HP, the rule text, and a
  `<model-viewer>` 3D model and "View in AR" for cards in `AR_MODELS` (`:474-506`).
- The AR button shows only on an Android, iPhone or iPad user agent (`src/lib/ar-viewer.ts:191-194`).
  `AR_MODELS` names 18 GLB files (`ar-viewer.ts:52-170`), but **only `public/models/sm-001.glb`
  (459,324 bytes) exists**, so 17 of the 18 3D views point at missing files.
- Also on the page: the World Cards section (variant and city counts, `:134-145`); a deck builder
  (`:152-205`) with 3 to 5 characters, up to 2 relics and up to 2 potions
  (`src/lib/battle-rules.ts:83-86`), owned cards only (`collection.astro:579-583`), with a synergy
  preview, saved decks and an active deck; and an achievements grid (`:226-233`).
- Status: working, apart from the missing 3D files. Tests: `tests/v1-flows.spec.ts:27-61`,
  `tests/v2-world-cards.spec.ts:81-125`, `tests/pages-i18n.spec.ts`.

### `/story` (Story Mode)

- On screen: "Journey through 5 acts" (`story.astro:28`), a progress line ("0 / 19 encounters
  completed") with stars (`:33-46`), and 5 acts with 19 encounters (4+4+4+4+3,
  `src/lib/story-mode.ts:27-104`), each with a difficulty label. Clicking an unlocked encounter
  shows its name, description and narrative only (`story.astro:73-77`, `:135-140`).
- **Stub.** No page starts a story duel and nothing calls `completeEncounter`
  (`story-mode.ts:117`). With no progress, `isEncounterUnlocked` opens only the first encounter
  of Act I (`:138-151`), so a player can read encounter 1-1 ("Street Brawl", against CA-002 Tybalt)
  and nothing more. Each encounter names an opponent card id, and all 18 named ids exist in the
  catalogue (for example VC-003 The Nurse at `cards.ts:161`, SM-001 at `:33`).
- Reach: the sitemap (`public/sitemap.xml:76`) and the URL only.
- Tests: `tests/play-i18n.spec.ts:113-132` (acts, encounters and an opened scene, translated);
  none plays it.

### `/playground`

- Header stats: cards owned out of 71, wins and trivia (`playground.astro:27-37`). A teen
  daily-spending banner is fetched from `/api/v1/credits/limits` (`:44-52`, `:307-330`).
- Packs:
  - The starter pack, "3 cards", free once (`:69-74`, `:376-391`, `drawPack(3)`).
  - The daily pack, "1 free card every 24 hours" (`:76-81`, `:394-406`; the 24 h check is
    `src/lib/inventory.ts:101-106`).
  - A drop-rate panel: Common 50%, Uncommon 30%, Rare 15%, Epic 4%, Legendary 1% (`:92-121`),
    which matches `RARITY_WEIGHTS` (`cards.ts:740-745`).
  - "Pack Tiers (purchased with Credits)": Standard 3 cards for 50, Rare 5 for 150 with a Rare
    guaranteed, Epic 5 for 400 with an Epic guaranteed (`:124-142`). **There is no button to buy
    any of them** (see `drawPackByTier` above).
- Shakespeare Trivia (`:177-182`): 5 questions from a bank of 200 (`src/lib/trivia.ts:13`). It is
  won at 3 or more (`:580`) and pays one random card (`:593-597`); a perfect 5/5 also awards a
  random world-card variant (`:582-590`).
- Quote Challenge (`:192-197`): fill in the blanks from a bank of 104 (`src/lib/challenges.ts:15`);
  a correct answer pays one random card (`:707-713`).
- Neither mode has a cooldown, so the code puts no limit on cards earned through trivia and
  challenges.
- First visit: a 3-step tour (starter pack, then trivia, then the Battle Arena button;
  `:768-771`), skippable and remembered in `inspired-mile-onboarding-done` (`:754-757`, `:851`).
- Status: working (free packs, trivia, challenges, tour). The credit packs and the model-written
  content are dead (see above). Tests: `tests/v1-flows.spec.ts:64-146`,
  `tests/play-i18n.spec.ts:74-332`, `src/i18n/pages/play-areas.test.ts`.

### `/season` (Season Pass)

- On screen: a "Season 1" badge (`season.astro:23`), the season name and dates, level, an XP bar,
  XP-per-activity tiles (battle 100, trivia 50, challenge 40, daily 25: `src/lib/seasons.ts:37-42`,
  drawn at `season.astro:56-62`), a reward track with Claim buttons (`:67-68`), and a sign-in
  prompt (`:75-77`).
- **Partly working.** The API answers 404 "No active season" unless the database has a row with
  `active = TRUE` (`backend/src/seasons/handlers.rs:74-80`), and no migration inserts one (there
  is no `INSERT` in `backend/migrations/*.sql`). XP is added only by `POST /seasons/xp`
  (`seasons/handlers.rs:114-160`), which nothing in the client calls (`seasons.ts:94` unused). So
  even with a season in place, playing earns no Season Pass progress.
- Reach: the sitemap and the URL only. Tests: `tests/pages-rest.spec.ts` with a mocked API
  (`tests/pages-rest.fixtures.mjs:49`, `mockApi` `:119`); no backend test.

### `/tournaments`

- On screen: Tournaments and Bracket tabs, a list with a Register button for open ones
  (`tournaments.astro:192-198`, sign-in required at `:194`), a bracket per tournament and a
  standings table (`:60-78`).
- **Partly working.**
  - The page cannot create a tournament. The API can: any signed-in user, with no role check, via
    `POST /tournaments/create` (`backend/src/tournaments/handlers.rs:74`, `:140-170`). Formats are
    `single_elimination` and `round_robin`, with `max_players` defaulting to 16 (`:150-154`).
  - The scheduler generates brackets every 30 s (`backend/src/tournaments/scheduler.rs:9-17`),
    but it never opens a game room: its `_rooms` argument is unused (`:19`).
  - No page links a bracket match to a duel, and `completeMatch` (`tournament-client.ts:79`) is
    never called. A bracket can therefore be seen, but not played through the UI.
- Tests: `tests/pages-rest.spec.ts` (mocked API) and prod-smoke; no backend test.

### `/classroom` (Classroom Mode)

- On screen:
  - A gate: "I am a teacher" or "I am a student" (`classroom.astro:26-45`). Teacher confirmation
    takes 3 checkboxes (`:55-71`); student consent takes 3 (`:76-94`).
  - Join with a 6-character code, or create a classroom (`:100-123`).
  - "My classrooms", and a detail view with the join code, members and assignments (`:130-183`).
  - A 4-step teacher tour (`:206-282`).
- Backend: a classroom has a name and a join code of 6 characters from
  `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (`backend/src/classroom/handlers.rs:56-60`). Members carry
  their role and join date (`:30-35`, `:214-218`). An assignment is only a title and a type
  (`:43-54`, `:297-303`), and only the teacher may create one (`:280-282`).
- **Partly working.** The tour promises "See what each student has completed, their scores and the
  cards they have earned" (`src/i18n/pages/classroom/en.ts:78`) and shows "FERPA compliant" (`:80`).
  No table or route records completion or scores: the handler reads only `classrooms`,
  `classroom_members` and `classroom_assignments` (`handlers.rs:118-248`). Nothing links an
  assignment to a game.
- Reach: the sitemap (`public/sitemap.xml:28`) and the URL only. Tests: `tests/pages-rest.spec.ts`
  (mocked) and `tests/auth.spec.ts:2586` ("a classroom's members and assignments are for its
  teacher and its members only", against the real API).

### `/marketplace`

- On screen: Browse, My listings, and "Sell or trade" (`marketplace.astro:25-27`); filters by sale
  or trade and a search box (`:34-40`). A listing form takes a card from the player's *local*
  inventory (`:349-366`), Sale or Trade, a price in credits (`min="1" max="100000"`, `:101`), or
  the wanted card numbers (`:107`).
- Buying needs sign-in (`:229`). All marketplace routes are protected
  (`backend/src/marketplace/handlers.rs:37-42`, `main.rs:134`).
- **Partly working.**
  - The page and API work, but a player has no client path to credits: `credits.ts` is never
    imported. The server grants credits only on its own: a founding-player top-up to 500
    (`backend/src/auth/handlers.rs:175-185`), a referral +100 (`referral/handlers.rs:129`) whose
    client is dead, and season claims (`seasons/handlers.rs:269`) when there is no season.
  - The about page promises "+50/+30/+20/+10" for a battle, trivia, a challenge and daily login
    (`about.astro:64`, `src/i18n/pages/about/en.ts:58-62`); nothing pays them.
  - Section 4 has the economy in detail.
- Tests: `tests/pages-rest.spec.ts` (mocked) and prod-smoke; no backend test.

### `/profile`

- On screen: the player's name, or Guest with "local" storage (`profile.astro:28-36`); stats for
  wins, battles, win rate, high score, cards and trivia (`:62-85`); achievements (`:91-92`); the
  collection by house and rarity (`:109-120`); a leaderboard (`:128-132`); and recent cards and
  achievements (`:139-147`).
- The leaderboard is public (`GET /stats/leaderboard`, `backend/src/stats/handlers.rs:59-61`,
  called at `profile.astro:315`): the top 50 ordered by `battle_wins` then `highest_score`
  (`stats/handlers.rs:84-85`). The server's `battle_wins` is written only from numbers the browser
  uploads: the one-time migration (`backend/src/migration/handlers.rs:139-140`) or `POST /stats`
  (`stats/handlers.rs:161-162`), which no page calls. Multiplayer wins are not recorded there
  (no `player_stats` write in `backend/src/multiplayer/`). So the ranking is of self-reported
  local counts, and locally `battleWins` counts rounds won (`battle.astro:887`).
- Status: working as a local stats page. Tests: `tests/pages-i18n.spec.ts` (profile in 16
  languages).

### `/world-map`

- On screen: 20 city cards (`src/lib/variants.ts:90` onward; 20 is asserted by
  `tests/v2-world-cards.spec.ts:22`). Each shows its battle ability, attire and hairstyle options,
  and the player's own variants in that city (`world-map.astro:38-55`). The page also states a
  "Possible combinations" count: characters × Σ(attire × hair × 6 skin tones) (`world-map.astro:12`,
  `variants.ts:77-84`). Header comments still say "12 Global Hip-Hop/Culture Hubs" (`variants.ts:87`)
  and "the 18 that get variants" (`:495`); the data has 20 cities and `getCharacterCards()` returns
  all 53 characters.
- How variants are won: the only source in any page is a perfect 5/5 trivia round
  (`playground.astro:582-584`, `awardRandomVariant(..., 'trivia-mastery')`). The intro's "Unlock
  variants through battles, trivia, and exploration" (`src/i18n/pages/world-map/en.ts:12`) is
  wider than the code.
- Images: an awarded variant has a random attire, hair and skin tone (`variants.ts:657-661`), and
  its image is `/images/variants/<id>.webp` (`:482`). The 198 files in `public/images/variants/`
  are all the `-00-00-02` "hero" combination (attire 0, hair 0, medium tone; `variants.ts:491`).
- Status: working (display). Tests: `tests/v2-world-cards.spec.ts:13-79`, `tests/pages-i18n.spec.ts`.

### `/viewer` (3D Viewer)

- On screen: a card select listing every Character (53; `viewer.astro:105-112`); Splat and GLB
  mode buttons (`:30-31`); a Babylon splat canvas or a model-viewer container (`:46-49`); and tiles
  explaining Splat, GLB and AR on a phone (`:62-76`).
- **Partly working.** Splat mode fetches `/models/splats/<id>.ply` (`:158`) and only
  `public/models/splats/sm-001.ply` (917,865 bytes) exists. GLB mode uses `AR_MODELS` (`:161`):
  18 entries, of which one has a file; any other card shows "no GLB" (`:173`).
- Tests: `tests/third-party.spec.ts:180` (no foreign request) and `tests/pages-rest.spec.ts`.

### `/vr` (VR Gallery)

- On screen: "Walk through your collection in 3D… Quest 3 and Vision Pro through WebXR, and with
  a mouse" (`vr.astro:16-18`), a link to the Theatre (`:22`), "Enter VR" and reset (`:26-27`), a
  fallback note when WebXR is absent (`:36-41`), the canvas (`:45`), and tiles for Computer,
  Quest 3 and Vision Pro (`:48-65`).
- The scene puts *every* catalogue card on a pedestal: characters in an outer ring and items in an
  inner one (`src/lib/vr-engine.ts:78-117`). It is not the player's collection (it reads
  `CARD_CATALOG`, not the inventory). Clicking or pinching a card only names it in the status line
  (`vr-engine.ts:144-149`).
- Status: working, display only. Tests: `tests/third-party.spec.ts:227`, `tests/pages-rest.spec.ts`.

### `/about`

- Team: David Charlot, PhD; Devon Glover "The Sonnet Man"; Arrocito del Diablo (Paul Rice); and
  Treston Knight (`about.astro:11-49`).
- Journey: six items, the last three marked not done (Summer 2025 content capture, platform live
  in Q1 2026, expansion in Q3 2026; `:53-60`, `src/i18n/pages/about/en.ts:29-37`).
- Five technology tiles (`:63`), and "Always Free to Play" lists including the credit amounts 50,
  30, 20 and 10 (`:64`, `about/en.ts:49-71`), which are not wired (see the marketplace).
- The page is readable before the age gate is answered (`BaseLayout.astro:1671-1672`).

### `/privacy` and `/terms`

- English only (`lang="en" dir="ltr"`, `privacy.astro:7`, `terms.astro:7`). Privacy is "Last
  updated: November 16, 2026" (`privacy.astro:10`) and Terms "Effective: November 16, 2026"
  (`terms.astro:10`). Both are readable without answering the age gate.
- Terms §5 covers card pack odds and §9 classroom use (`terms.astro:59`, `:120`). Privacy lists
  the other companies the browser contacts (`privacy.astro:102`), which
  `tests/third-party.spec.ts` holds against `tests/third-party-allowlist.ts`.

### Could not determine

- Whether production's database holds an active season, season rewards or any tournaments (no
  migration seeds them; an operator may have inserted rows).
- Whether a world-card variant with a non-hero image renders a fallback or a broken image when its
  `.webp` is missing. The display code was not traced to that depth.
- Whether model-viewer on iOS can produce a Quick Look file from the GLB alone. No `.usdz` is
  shipped and `iosSrc` is never set in `AR_MODELS` (`ar-viewer.ts:43-50`).
- How the marketplace and tournaments pages look to a signed-out visitor beyond the sign-in
  prompts. Their lists come from protected routes, and no test runs them signed out against the
  real API.

## 4. Progression and economy

"Live" means a player can reach it from a page today; "dead" means no page imports it (checked with `grep -rn` over `src/pages`, `src/layouts`, `src/components`, `src/lib`).

### 4.0 The short version

- **Cards are the only working reward, and they live in the browser.** Every live source of cards writes to `localStorage` key `inspired-mile-inventory` (`src/lib/inventory.ts:22`, `:54-65`). The server's card table (`owned_cards`) is filled only by a one-time upload when a signed-in player accepts the "migration" banner (`src/layouts/BaseLayout.astro:1383-1456`, `backend/src/migration/handlers.rs:111-135`) and by marketplace purchases (`backend/src/marketplace/handlers.rs:258-262`).
- **Credits exist only on the server, and no page earns or spends them.** `earnCredits`, `spendCredits` and `syncCredits` (`src/lib/credits.ts:30-109`) have no importer anywhere in `src/`. The balance is never displayed. The only ways a balance moves are: the founding-player top-up to 500 on `GET /auth/me` (`backend/src/auth/handlers.rs:174-191`), a season reward of type `credits` (`backend/src/seasons/handlers.rs:266-276`), and +100 to a referrer (`backend/src/referral/handlers.rs:128-133`, no UI).
- **Nothing costs anything.** Pack tiers with credit prices are shown (`src/pages/playground.astro:124-144`) but there is no purchase path (`drawPackByTier` and `PACK_TIERS` in `src/lib/cards.ts:820-847` have no caller). A marketplace "sale" moves no credits (`backend/src/marketplace/handlers.rs:240-280`).
- **Achievements give no reward** (the `Achievement` type has no reward field: `src/lib/achievements.ts:9-19`).
- Several systems were built and never wired to a page: streaks, weekly events, draft mode, house allegiance, referral, social sharing, credits client, season XP gain (details below).

### 4.1 Where each system's state lives

| System | Browser (`localStorage` key) | Server (Postgres) | Wired between them? |
|---|---|---|---|
| Card inventory | `inspired-mile-inventory` (`src/lib/inventory.ts:22`) | `owned_cards` (`backend/migrations/001_initial.sql:13-19`) | One-time upload only (`BaseLayout.astro:1383-1456`; banner hidden once `migrated` is true, `:1393-1394`). `api-client.ts addCard` (`src/lib/api-client.ts:236-241`) has no caller. |
| Decks | `inspired-mile-decks`, `inspired-mile-active-deck` (`src/lib/deck-manager.ts:9-10`) | none | Browser only. Online play reads the active deck's characters and filters them to what the server will accept (`src/pages/multiplayer.astro:274-287`). |
| Player stats | `inspired-mile-player-stats` (`src/lib/achievements.ts:40`); also counters inside the inventory object (`src/lib/inventory.ts:13-20`) | `player_stats` (`001_initial.sql:38-51`) | One-time upload (`BaseLayout.astro:1419-1430`, server keeps `GREATEST`, `migration/handlers.rs:137-149`). `POST /stats` exists (`backend/src/stats/handlers.rs:144-176`) but `api-client.ts updateStats` (`src/lib/api-client.ts:297`) has no caller. |
| Achievements | `inspired-mile-achievements` (`src/lib/achievements.ts:39`) | `unlocked_achievements` (`001_initial.sql:55`) | Yes: each new unlock is posted when signed in (`src/lib/achievements.ts:452-461` -> `POST /stats/achievements`, `backend/src/stats/handlers.rs` accepts up to 50 ids of at most 32 safe characters each, with no check that the condition was met). |
| World-card variants | `inspired-mile-variants` (`src/lib/variants.ts:550`) | `owned_variants` (`001_initial.sql:25`) | One-time upload only. `POST /variants/unlock` (`backend/src/variants/handlers.rs:71-115`) is wrapped by `api-client.ts unlockVariant` (`src/lib/api-client.ts:263`), which has no caller. |
| Credits | `inspired-mile-credits` (`src/lib/credits.ts:8`), dead | `player_stats.credits` (`backend/migrations/010_credits.sql:2`), `credit_transactions` (`016_age_tier.sql:6-13`) | No page calls either side. |
| Season pass | none | `seasons`, `season_progress`, `season_rewards` (`011_seasons.sql`) | Page reads it (`src/pages/season.astro:83`); nothing writes XP. |
| Streaks | `inspired-mile-streaks` (`src/lib/streaks.ts:25`), dead | none (the sync it calls, `syncStreakData`, is not exported by `api-client.ts`; the call is guarded by `typeof ... === 'function'`, `src/lib/streaks.ts:131-134`) | No. |
| House allegiance | `inspired-mile-house` (`src/lib/house-allegiance.ts:31`), dead | `users.house_allegiance`, `house_leaderboard` (`012_houses.sql`), never written (the only reader is the unused-account purge, `backend/src/auth/passkeys.rs:1075`) | No. |
| Story progress | `inspired-mile-story` (`src/lib/story-mode.ts:30`) | none | Browser only; `completeEncounter` (`src/lib/story-mode.ts:117`) has no caller, so progress never advances. |
| Storage mode | `inspired-mile-storage-mode`, `inspired-mile-user` (`src/lib/storage-backend.ts:16-17`) | `auth_sessions` | Mode is `local` until signed in (`src/lib/storage-backend.ts:19`, `:42-71`). |

Small mismatch: the migration banner looks for a key `inspired-mile-stats` (`BaseLayout.astro:1388`), while stats are stored under `inspired-mile-player-stats` (`src/lib/achievements.ts:40`); it also checks the inventory and achievements keys, so the banner still appears for anyone who has played.

### 4.2 Cards: packs, draws and odds

- Catalogue: 71 cards, 53 characters, 9 relics, 9 potions (`grep -c "type: '<T>'" src/lib/cards.ts`; `tests/v1-flows.spec.ts:28` asserts "71 cards"). By rarity: Common 9, Uncommon 21, Rare 25, Epic 13, Legendary 3 (the three Legendary cards: The Sonnet Man `SM-001`, `src/lib/cards.ts:33`; Prospero's Staff `RL-002`, `:114`; Zeus `OL-001`, `:628`).
- One draw (`drawRandomCard`, `src/lib/cards.ts:780-796`) picks a rarity by weight, then a card uniformly within that rarity. Weights: Common 50, Uncommon 30, Rare 15, Epic 4, Legendary 1 (`src/lib/cards.ts:740-746`), shown on the page as 50% / 30% / 15% / 4% / 1% (`src/pages/playground.astro:98-119`). Derived per-card chance: each Common 5.56%, each Uncommon 1.43%, each Rare 0.60%, each Epic 0.31%, each Legendary 0.33%; so a given Legendary card is slightly likelier than a given Epic card. Draws are independent and with replacement; duplicates are kept (`src/lib/inventory.ts:54-65`, `getDuplicateCount` `:84-86`).
- Duplicates have no use: a deck holds one copy of each card (the deck builder toggles a card in or out, `src/pages/collection.astro:579-606`), and a marketplace listing does not remove the seller's copy (4.9).
- Pack tiers (dead): Standard 3 cards for 50 credits, Rare 5 cards with 1 Rare guaranteed for 150, Epic 5 cards with 1 Epic guaranteed for 400 (`src/lib/cards.ts:820-824`). Shown under "Pack Tiers (purchased with Credits)" (`src/pages/playground.astro:124-139`); no button buys one.

### 4.3 How a player gets cards (all live sources)

| Source | What is granted | Limit | Evidence |
|---|---|---|---|
| Starter pack | 3 draws (`drawPack(3)`) | Once per browser (`starterClaimed`) | `src/pages/playground.astro:376-392`; `src/lib/inventory.ts:89-98` |
| Daily pack | 1 draw (labelled a pack; it is one card) | 24 h rolling from the last claim, not a calendar day | `src/pages/playground.astro:394-406`; `src/lib/inventory.ts:100-122` |
| Trivia round | 1 draw when 3 or more of 5 are right | None: a round can be repeated at once | `src/pages/playground.astro:473-506` (5 questions), `:580` (`won = triviaScore >= 3`), `:593-597` |
| Perfect trivia (5/5) | 1 World Card variant of a character the player owns (source `trivia-mastery`) | None; nothing if no character is owned | `src/pages/playground.astro:581-591`; `src/lib/variants.ts:641-673` |
| Quote challenge | 1 draw per correct answer | None | `src/pages/playground.astro:702-713` |
| Solo duel won on `/battle` | 1 draw when the match is won | One per match won | `src/pages/battle.astro:960-975` |
| Duel won in the Theatre | nothing (stats only) | | `src/pages/theatre.astro:144-156` |
| Online match won | nothing | | `src/pages/multiplayer.astro:175-176` imports only `getActiveDeck` and `getOwnedCardIds` from the economy modules; the server writes nothing after a match (5.6) |
| Marketplace purchase | the listed card, into the server's `owned_cards` | | `backend/src/marketplace/handlers.rs:258-262` |
| Achievements, story, classroom, tournaments, seasons (`card`/`pack` rewards) | nothing | | 4.5, 4.7, 4.11; `backend/src/seasons/handlers.rs:266-276` grants only `credits` |

Content behind trivia and challenges: 200 trivia questions (50 easy, 75 medium, 75 hard, counted by importing `TRIVIA_BANK`; the file's header says "51 easy", `src/lib/trivia.ts:3`) and 104 quote challenges (30 easy, 37 medium, 37 hard, counted by importing `CHALLENGE_BANK`; `src/lib/challenges.ts:3`). The playground has code for the model to write English trivia and challenges (`src/pages/playground.astro:483-506`, `:642-654`), but it never runs: the page loads no model (section 3, "Dead code").

No duel requires owning cards: with no saved deck of 3+ characters, `/battle` and the Theatre deal `starterDeck(owned)`, which fills from the catalogue in order (`src/pages/battle.astro:306-313`, `src/pages/theatre.astro:93-94`, `src/lib/verse/duel.ts:287-295`). A new player therefore duels with The Sonnet Man (Legendary), Romeo and Juliet.

### 4.4 Decks

- Single-player deck rules (`DECK_RULES`, `src/lib/battle-rules.ts:82-88`): 3 to 5 characters, at most 2 relics, at most 2 potions, at most 7 cards in all. Every card must be owned (`src/lib/deck-manager.ts:25-31`). One copy per card (`src/pages/collection.astro:579-606`).
- A relic lends power words, a potion casts a curse; each costs 1 ink (`src/lib/battle-rules.ts:46`, `:51`). Ink: 2 at the start, +1 per round (`START_INK`, `INK_PER_ROUND`, `src/lib/verse/duel.ts:48-49`, `:336`).
- House synergy (the only "house" bonus that exists in play): two or more characters of one house in the deck make that house's device add three quarters to craft instead of a half (`src/lib/battle-rules.ts:61-71`, `:32`).
- Decks are named and saved in the browser; one is "active" (`src/lib/deck-manager.ts:21-72`). Online decks are characters only, 3 to 5 distinct (`backend/src/verse/duel.rs:597-618`; 5.4).

### 4.5 Achievements (30; no rewards)

Unlocks are checked whenever a stat changes and announced with a toast event (`src/lib/achievements.ts:430-465`). Bronze 8, silver 12, gold 10. The translated descriptions are written around `goal` (`src/lib/achievements.ts:14-16`; e.g. `src/i18n/pages/achievements/en.ts:36`, `:54`: "Unique cards collected: {n}").

| id | Name | Tier | English description | Condition (code) | Source |
|---|---|---|---|---|---|
| `first-blood` | First Blood | bronze | Win your first battle | `s.battleWins >= 1` | `src/lib/achievements.ts:47` |
| `card-collector` | Card Collector | bronze | Collect 5 unique cards | `s.uniqueCards >= 5` | `src/lib/achievements.ts:55` |
| `opening-act` | Opening Act | bronze | Complete your first battle | `s.totalBattles >= 1` | `src/lib/achievements.ts:64` |
| `scholar-novice` | Budding Scholar | bronze | Answer 5 trivia questions correctly | `s.triviaCorrect >= 5` | `src/lib/achievements.ts:72` |
| `quotable` | Quotable | bronze | Complete 3 quote challenges | `s.challengesCompleted >= 3` | `src/lib/achievements.ts:81` |
| `bards-apprentice` | Bard's Apprentice | silver | Play 10 battles | `s.totalBattles >= 10` | `src/lib/achievements.ts:92` |
| `wordsmith` | Wordsmith | silver | Score 35 or higher in a single round | `s.highestScore >= 35` | `src/lib/achievements.ts:101` |
| `scholar` | Scholar | silver | Get a perfect 5/5 on trivia | `s.triviaPerfect >= 1` | `src/lib/achievements.ts:110` |
| `pack-rat` | Pack Rat | silver | Open 10 card packs | `s.packsOpened >= 10` | `src/lib/achievements.ts:118` |
| `verse-veteran` | Verse Veteran | silver | Complete 25 battle rounds | `s.totalRounds >= 25` | `src/lib/achievements.ts:127` |
| `challenge-master` | Challenge Master | silver | Complete 10 quote challenges | `s.challengesCompleted >= 10` | `src/lib/achievements.ts:136` |
| `completionist` | Completionist | gold | Collect all 48 unique cards | `s.uniqueCards >= 48` | `src/lib/achievements.ts:147` |
| `master-thespian` | Master Thespian | gold | Win 25 battles | `s.battleWins >= 25` | `src/lib/achievements.ts:156` |
| `shakespeare-scholar` | Shakespeare Scholar | gold | Answer 50 trivia questions correctly | `s.triviaCorrect >= 50` | `src/lib/achievements.ts:165` |
| `virtuoso` | Virtuoso | gold | Score 45 or higher in a single round | `s.highestScore >= 45` | `src/lib/achievements.ts:174` |
| `hundred-rounds` | Centurion | gold | Complete 100 battle rounds | `s.totalRounds >= 100` | `src/lib/achievements.ts:183` |
| `first-pack` | Unboxing Day | bronze | Open your first card pack | `s.packsOpened >= 1` | `src/lib/achievements.ts:196` |
| `trivia-starter` | Curious Mind | bronze | Answer 1 trivia question correctly | `s.triviaCorrect >= 1` | `src/lib/achievements.ts:204` |
| `first-challenge` | Quote Seeker | bronze | Complete your first quote challenge | `s.challengesCompleted >= 1` | `src/lib/achievements.ts:212` |
| `battle-master` | Battle Master | silver | Win 10 battles | `s.battleWins >= 10` | `src/lib/achievements.ts:222` |
| `relic-hunter` | Relic Hunter | silver | Collect 5 relic cards | `s.uniqueCards >= 15` | `src/lib/achievements.ts:231` |
| `trivia-enthusiast` | Trivia Enthusiast | silver | Answer 25 trivia questions correctly | `s.triviaCorrect >= 25` | `src/lib/achievements.ts:240` |
| `challenge-adept` | Challenge Adept | silver | Complete 20 quote challenges | `s.challengesCompleted >= 20` | `src/lib/achievements.ts:249` |
| `pack-collector` | Pack Collector | silver | Open 25 card packs | `s.packsOpened >= 25` | `src/lib/achievements.ts:258` |
| `legend-50-wins` | Legend of the Stage | gold | Win 50 battles | `s.battleWins >= 50` | `src/lib/achievements.ts:269` |
| `trivia-champion` | Trivia Champion | gold | Answer 100 trivia questions correctly | `s.triviaCorrect >= 100` | `src/lib/achievements.ts:278` |
| `challenge-legend` | Challenge Legend | gold | Complete 50 quote challenges | `s.challengesCompleted >= 50` | `src/lib/achievements.ts:287` |
| `pack-addict` | Pack Addict | gold | Open 50 card packs | `s.packsOpened >= 50` | `src/lib/achievements.ts:296` |
| `half-collection` | Half the Globe | silver | Collect 24 unique cards | `s.uniqueCards >= 24` | `src/lib/achievements.ts:305` |
| `perfect-scholar` | Perfect Scholar | gold | Get 5 perfect trivia scores | `s.triviaPerfect >= 5` | `src/lib/achievements.ts:314` |

What the counters really count (from the callers):
- `battleWins` goes up for every **round** won, not every match: `/battle` increments it after each round the player takes (`src/pages/battle.astro:885-888`), and so does the Theatre (`src/pages/theatre.astro:146-147`). "Win 25 battles" means 25 rounds. `totalBattles` counts finished matches (`battle.astro:963`, `theatre.astro:155`); `totalRounds` counts rounds (`battle.astro:885`, `theatre.astro:146`); `highestScore` is the player's best round total (`battle.astro:891`).
- `packsOpened` goes up only for the starter pack and the daily pack (`playground.astro:381`, `:399`); trivia, challenge and battle cards do not count. "Pack Addict" (50) therefore needs the starter pack plus 49 daily packs, i.e. at least 49 days of 24-hour claims.
- "Completionist" says "all 48" and unlocks at 48 unique cards, but the catalogue has 71 (`achievements.ts:149-153`; 4.2). "Relic Hunter" says "5 relic cards" but checks 15 unique cards of any type (`achievements.ts:233-237`).

### 4.6 Credits (server currency; no live earn or spend)

- Storage: `player_stats.credits INT NOT NULL DEFAULT 0` (`backend/migrations/010_credits.sql:2`); every earn and spend is logged in `credit_transactions` (`016_age_tier.sql:6-13`, `backend/src/credits/handlers.rs:236-246`).
- Earn (`POST /api/v1/credits/earn`, `backend/src/credits/handlers.rs:87-113`): default amounts `battle_win` 50, `trivia` 30, `challenge` 20, `daily` 10, anything else 0 (`:54-61`); but the client may send its own `amount`, accepted from 1 to 1000 (`:92-95`). No check of what was played. The browser client has the same defaults (`src/lib/credits.ts:32-37`) with 10 for an unknown source (`:38`, where the server gives 0 and refuses). No page calls it.
- Spend (`POST /api/v1/credits/spend`, `:115-163`): 1 to 100,000 per call (`:120`), refused when the balance is short (`:146-156`). Teen accounts: at most 200 credits a day (`TEEN_DAILY_SPEND_LIMIT`, `:14`; checked at `:132-144`; "today" is the database's `CURRENT_DATE`, `:225-229`). No page calls it.
- `GET /credits/limits` (`:199-219`) is the one credits call a page makes: the playground shows a teen's spent-today bar (`src/pages/playground.astro:306-334`). Since nothing spends, it always reads 0.
- Founding players: every `GET /auth/me` for an account created before `LAUNCH_DATE` (default `2026-04-01`, `backend/src/config.rs:306`) sets credits to 500 if they are below 500 (`backend/src/auth/handlers.rs:174-191`). It is a refill, not a one-time grant, and it writes no transaction row.
- The About page promises "Win a battle: +50, Complete a trivia round: +30, Quote challenge: +20, Daily login bonus: +10" (`src/pages/about.astro:64`, `src/i18n/pages/about/en.ts:58-64`), "Daily free card packs" (`:53`) and "No real-money purchases" (`:64`). The Terms describe Credits as earned by play, of no cash value (`src/pages/terms.astro:45-54`). None of the earning lines is wired.

### 4.7 Season pass

- Schema: `seasons` (`max_level` default 30, `active` flag), `season_progress` per user and season, `season_rewards` with `reward_type` in `credits` / `pack` / `card` / `title`, `is_premium`, and `claimed` (`backend/migrations/011_seasons.sql:2-30`).
- XP per source: battle 100, trivia 50, challenge 40, daily 25, anything else 10 (`backend/src/seasons/handlers.rs:47-55`); the page shows the same table (`src/lib/seasons.ts:37-42`, `src/pages/season.astro:61`). A client may also send `amount`, 1 to 1000 (`handlers.rs:127-131`).
- Levels: level 1 at 0 XP; level n is reached at `n * 200` XP (`xp_for_level`, `:58-60`; loop `:153-155`), so level 2 at 400, level 30 at 6,000. The page's progress bar assumes 200 XP per level from `(level - 1) * 200` (`src/lib/seasons.ts:124-127`), which does not match the server's curve.
- Claiming (`:221-283`): only `credits` rewards grant anything (`:266-276`); `pack`, `card` and `title` are marked claimed and grant nothing. `claimed` is a column of the reward row, not of the player (`011_seasons.sql:22-30`; `UPDATE season_rewards SET claimed = TRUE WHERE season_id = $1 AND level = $2 AND claimed = FALSE`, `handlers.rs:251-256`): the first player to claim a level claims it for everyone.
- Nothing in the product creates a season or its rewards (no `INSERT INTO seasons` or `season_rewards` in `backend/`, `scripts/` or `tests/`), and nothing earns XP: `addXP` (`src/lib/seasons.ts:94-100`) has no caller. `is_premium` is a flag with no way to buy premium.
- The page `/season` is not linked from the navigation (no `href` to it in `src/`; it is in `public/sitemap.xml:70`). It shows "sign in" when signed out and "no season running" on 404 (`tests/pages-rest.spec.ts:395`, against a mocked API).

### 4.8 Tournaments

- Schema: `tournaments` (format `single_elimination` or `round_robin`, `max_players` default 16, status `registration` / `in_progress` / `completed`), `tournament_entries` (seed, `eliminated`), `tournament_matches` (round, order, players, winner, `room_id`, status incl. `bye`) (`backend/migrations/006_tournaments.sql:2-39`); `created_by` (`008_tournament_creator.sql:2`).
- No entry fee, no prize, no credits or cards anywhere in `backend/src/tournaments/`.
- Any signed-in account may create one through the API (`POST /tournaments/create`, `handlers.rs:140-185`): name 1 to 128 characters, format checked, `max_players` default 16 and not bounded (`:150-154`). The page has no "create" control (`src/pages/tournaments.astro` lists, registers, and shows bracket and standings: `:85`, `:181`, `:192-212`, `:239-255`).
- Registration while status is `registration` and entries are below `max_players` (`handlers.rs:200-213`); seed = entry count + 1 (`:216-224`).
- Scheduler: every 30 s (`backend/src/tournaments/scheduler.rs:8-17`), a tournament whose `starts_at` has passed and that has 2 or more entrants gets its matches generated and goes `in_progress` (`:21-80`); fewer than 2 and it waits (`:46-48`).
- Brackets: single elimination makes only the first round, pairing entrants in registration order and padding to a power of two with byes (`bracket.rs:6-29`; a match with an empty seat is stored as `bye`, `scheduler.rs:58`). Round robin makes every pairing at once (`bracket.rs:33-57`).
- Results are self-reported: either participant may post the winner of their match (`POST /{id}/matches/{match_id}/complete`, `handlers.rs:296-329`; "Only match participants can complete a match" is the only check). The loser is marked eliminated (`:351-361`) and the winner is slotted into round + 1, order `(order + 1) / 2` (`:364-432`), for every format, round robin included (the handler does not read the format). Read from the code: a `bye` match can never be completed (only `pending` / `in_progress` are accepted, `:315-317`), so a player given a bye is never advanced. The client wrapper `completeMatch` (`src/lib/tournament-client.ts:79-92`) has no caller, and the scheduler does not open game rooms (its `_rooms` argument is unused, `scheduler.rs:19`). There is no way in the product to play a tournament match.
- Standings: wins and losses from completed matches (`handlers.rs:264-294`).
- Tests: rendering only, against a mocked API (`tests/pages-rest.spec.ts:334`); no backend test of the module (no `#[cfg(test)]` in `backend/src/tournaments/`).

### 4.9 Marketplace

- Schema: `card_listings` (card, `sale` or `trade`, `price_credits`, `wanted_card_ids`, status `active` / `sold` / `cancelled`) and `trades` (`backend/migrations/005_marketplace.sql:2-21`).
- What is traded: card ids only, never variants, credits or anything with real-money value. No fee anywhere (no fee constant or arithmetic in `backend/src/marketplace/handlers.rs`).
- Browse: the 100 newest active listings (`handlers.rs:45-73`). List: card id up to 32 alphanumeric/`-` characters (`:81`), price 1 to 100,000 when given (`:84-86`), and the seller must have that card in the server's `owned_cards` (`:90-99`); `listing_type` is not checked against `sale`/`trade`.
- Buy (`:213-281`): the listing is marked sold, the buyer gets the card in `owned_cards` with source `purchase`, a `trades` row is written. **No credits move** (no `credits` in the handler), the seller's card is not removed, and a trade listing does not take the "wanted" card from the buyer. Every purchase is free and copies the card.
- The page's "sell" list is filled from the browser's cards (`src/pages/marketplace.astro:349-366`), but the server accepts only cards in `owned_cards`, i.e. cards uploaded at migration or bought.
- The About page says "card value is influenced by combat rankings and community engagement" (`src/i18n/pages/about/en.ts:47-48`). Prices are whatever the seller types; no ranking is read.
- Tests: rendering of prices and wanted cards against a mocked API (`tests/pages-rest.spec.ts:306`); no backend tests.

### 4.10 Referral (backend only)

- `GET /referral` makes or returns an 8-character code from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (`backend/src/referral/handlers.rs:32-36`, `:44-80`). `POST /referral/redeem`: code must be 8 characters (`:88-90`), not your own (`:104-106`), one redemption per account ever (`UNIQUE(redeemed_by)`, `014_referrals.sql:14`; `:109-126`).
- Reward: +100 credits to the referrer (`:128-133`), with no cap on how many redemptions one code earns. The redeemer is told "You get 5 free packs!" with `packs_granted: 5` (`:137-141`), but nothing is granted.
- No page calls `getReferralCode` or `redeemCode` (`src/lib/referral.ts:32-42`), and no page reads `?ref=` (`getReferralLink` builds `/?ref=<code>`, `:64-67`). The privacy policy still describes the referral system (`src/pages/privacy.astro:75`).

### 4.11 Streaks, weekly events, draft mode, house allegiance (all dead code)

- **Daily streak** (`src/lib/streaks.ts`, no importer): a 7-day track of packs, day 1-2 Common x2 cards, day 3-4 Uncommon x3, day 5 Rare x3, day 6 Rare x4, day 7 Epic x5, then back to day 1 (`:27-35`, `:111-114`); a missed day resets to 1 (`:101-109`). Days are UTC dates (`toISOString`, `:46-54`) while the countdown runs to local midnight (`:143-150`).
- **Weekly events** (`src/lib/weekly-events.ts`, no importer; "no backend needed", `:3`): Tuesday "Trivia Tuesday" 2x XP from trivia; Wednesday "World Wednesday" a free city-variant attempt; Thursday "Challenge Thursday" 2x bonus challenges; Saturday and Sunday "Battle Weekend" 2x XP from battles (`:20-81`). `getActiveMultiplier` (`:108-112`) has no caller.
- **Draft mode** (`src/lib/draft-mode.ts`, no importer): a pool of 12 characters, 4 relics and 4 potions (`:23-34`); each side drafts 5 characters, 1 relic and 1 potion (`:2-3`, `:87-104`) in snake order (`:77-81`); the AI drafts the character with the highest `atk` (`:110-123`), a stat the verse duel does not use.
- **House allegiance** (`src/lib/house-allegiance.ts`, no importer): nine houses, each with a motto and a bonus: Montague Flow +1, Capulet Wordplay +1, Danish Court Depth +1, Forest of Arden Creativity +1, Verona Court Wit +1, The Tempest Flow +1, Scottish Court Wit +2, Illyria Flow +2, Rome Wordplay +2 (`:19-29`). "Depth" and "Creativity" are not criteria the judge has (wordplay, allusion, flow, wit: `backend/src/verse/judge.rs:20`). The header promises "weekly leaderboard participation" (`:3`); the table for it, `house_leaderboard` (`012_houses.sql:4-12`), is never written.

### 4.12 World-card variants (live, browser only)

- 20 cities (`src/lib/variants.ts:21-26`), each with an ability of +2 to one judge criterion: flow 6 cities, wit 6, wordplay 4, "shakespeare" (allusion) 4 (`CITY_CATALOG`, `:90-397`). Each city has 4 attires and 4 hairstyles; 6 skin tones (`:77-84`). Derived: 1,920 variants per character; 101,760 for 53 characters. (A stale comment says "18 chars x 12 cities = 216", `:509`.)
- Only source in play: a perfect 5/5 trivia round (4.3). Other sources are declared (`city-quest`, `battle-streak`, `daily-travel`, `event`: `:30-35`) and never used.
- Effect: equip one on `/battle`; when the judge gives the player that criterion, and the verse is not void, the player gets the bonus (`src/pages/battle.astro:1029-1031`; `src/lib/verse/duel.ts:563-567`). Not available online.

### 4.13 Classroom (economy and progression only)

- A teacher creates a classroom with a 6-character join code from the same 32-letter alphabet as referral codes (`backend/src/classroom/handlers.rs:56-60`, `:70-111`); students join by code (`:146-178`); a teacher posts assignments with a title and a type (`:270-314`), the page offering trivia, challenge or battle (`src/pages/classroom.astro:179-181`).
- No progress, completion, score or reward is recorded: the API has only create/list/join/members/assignments routes (`handlers.rs:62-68`), and `classroom_assignments` has no per-student rows (`013_classrooms.sql:21-30`). The page's tour promises "See what each student has completed, their scores and the cards they have earned" (`src/pages/classroom.astro:259-260`), while the About page says "Classroom mode stores no grades or student work" (`src/i18n/pages/about/en.ts:69`).
- `/classroom` is not linked from the navigation (only `public/sitemap.xml:28`).

### 4.14 Sources and sinks

| Resource | Source | Amount, rate, cap | Live? | Evidence |
|---|---|---|---|---|
| Cards | Starter pack | 3, once | yes | `playground.astro:376-392` |
| Cards | Daily pack | 1 per 24 h | yes | `playground.astro:394-406`, `inventory.ts:100-106` |
| Cards | Trivia round (3+/5) | 1, unlimited | yes | `playground.astro:580-597` |
| Cards | Quote challenge | 1, unlimited | yes | `playground.astro:702-713` |
| Cards | Solo match won on `/battle` | 1 | yes | `battle.astro:968-971` |
| Cards | Marketplace buy | 1, free, copied | yes (needs server-held cards to list) | `marketplace/handlers.rs:240-280` |
| Cards | Streak, season `card`/`pack`, referral "5 packs" | | no | 4.7, 4.10, 4.11 |
| Variants | Perfect trivia | 1, unlimited | yes | `playground.astro:581-591` |
| Credits | Founding top-up | to 500 on every `/auth/me` if created before 2026-04-01 | yes (server) | `auth/handlers.rs:174-191` |
| Credits | Season `credits` reward | value of the reward row; first claimant only | only if an operator inserts a season | `seasons/handlers.rs:266-276` |
| Credits | Referral | +100 to referrer, uncapped | API only | `referral/handlers.rs:128-133` |
| Credits | `/credits/earn` | 50/30/20/10, or 1-1000 as the client says | API only | `credits/handlers.rs:54-61`, `:92-95` |
| XP | `/seasons/xp` | 100/50/40/25 (10 other), or 1-1000 | API only | `seasons/handlers.rs:47-55`, `:127-131` |

| Resource | Sink | Amount | Live? | Evidence |
|---|---|---|---|---|
| Credits | Pack tiers | 50 / 150 / 400 | no (display only) | `cards.ts:820-824`, `playground.astro:124-139` |
| Credits | `/credits/spend` | 1-100,000; teen 200/day | API only | `credits/handlers.rs:115-163` |
| Credits | Marketplace sale | seller's price | no (price is not charged) | `marketplace/handlers.rs:240-280` |
| Ink (per duel) | Relic or potion | 1 each; 2 at start, +1 per round | yes (solo only) | `battle-rules.ts:46`, `:51`; `verse/duel.ts:48-49` |
| Cards | anything | | none exists | |

Bearing on the original promises (for the intent-vs-built map):
- **NFTs on Solana / wallets:** built on 2026-02-14 (`99694234`, `c8a68911`) and removed on 2026-02-17 by `7982d79c` ("Strip all Web3/crypto features for clean edu-only site ... Web3 features will move to a dedicated subdomain ... DB columns left dormant"). The dormant columns: `users.wallet_address`, `wallet_linked_at` (`002_wallet.sql:2-3`), `owned_cards.mint_address`, `mint_signature`, `minted_at` (`003_nft_state.sql:2-4`), `users.google_id`, `auth_provider`, table `wallet_nonces` (`007_oauth_wallet_auth.sql:9-21`). No code reads or writes the mint columns; `wallet_address` is read only by the unused-account purge (`backend/src/auth/passkeys.rs:1075`). The About page now says "No blockchain, no wallet" (`src/i18n/pages/about/en.ts:40`).
- **10,000 general / 100 Sonnet Man tiers** (`PROJECT_BRIEF.md:59`, `:80-81`): no supply exists. 71 card designs, unlimited copies by draw with replacement (4.2). The Sonnet Man card is Legendary in packs (1 in 300 draws) yet is in every new player's starter deck (4.3) and is a free starter character online (5.4).
- **Marketplace value from rankings** (`PROJECT_BRIEF.md:58`; `about/en.ts:48`): not built; prices are typed by sellers and never charged (4.9).
- **Daily packs** (`PROJECT_BRIEF.md:50`; `about/en.ts:53`): built as one card every 24 h, browser only (4.3). The 7-day escalating streak is dead code (4.11).
- **"Direct purchase"** of cards (`PROJECT_BRIEF.md:50`) and the revenue lines (card pack sales, NFT sales, subscriptions, `PROJECT_BRIEF.md:144-147`): nothing is sold; the site says no real-money purchases (`about/en.ts:50`, `:64`; `terms.astro:50-51`).
- **Tournament/event system** (`ROADMAP.md:142`): schema, API and a read-only page exist; matches cannot be played (4.8).

## 5. Multiplayer and social

### 5.1 Getting into a match

- Online play needs an account (`src/pages/multiplayer.astro:31-32`) and is English only, said on the page (`#mp-english-only`, `multiplayer.astro:23`); the room refuses any other language with `language_not_offered` (`backend/src/multiplayer/handlers.rs:537`; `ClientEvent::JoinRoom.lang`, `game_room.rs:258-266`).
- **Quick match**: `POST /api/v1/multiplayer/queue` (`handlers.rs:71`, `:166-212`). An in-memory FIFO queue, "first come, first paired" (`matchmaking.rs:1`, `:56-60`); no rating, level or region is considered. One place per player (asking again replaces the earlier request, `matchmaking.rs:72-74`). A request waits up to `QUEUE_WAIT` 30 s (`handlers.rs:51`); the page asks again until `QUICK_MATCH_LIMIT_MS` 3 min (`src/lib/multiplayer-client.ts:352`) and then says so. A waiting partner whose session has ended is not paired (`handlers.rs:177-184`). The page leaves the queue on `pagehide`/`beforeunload` with a keepalive `DELETE /queue` (`CLAUDE.md:176-178`; `handlers.rs:214-220`).
- **Private room ("Challenge a friend")**: `POST /create-private` makes a room with one seat held and withdraws the player's previous open invitation (`handlers.rs:244-257`). The room's UUID is the invitation token, "122 random bits, shown to nobody else" (`:255-256`); the page shows the link `<origin>/multiplayer?room=<id>` to copy (`src/pages/multiplayer.astro:445-448`, `:422-426`). `GET /join/{token}` checks the room has a seat (`handlers.rs:267-285`). `GET /rooms` lists only the caller's own rooms, for "Return to your duel" (`:231-235`).
- Seats are taken over a WebSocket (`/ws`, `handlers.rs:70`, `:297-310`), opened only from the site's own origins (`:288-295`).

### 5.2 Room lifecycle and every timer

| Constant | Value | Meaning | Source |
|---|---|---|---|
| `Timing::round` | 180 s | to write and submit a verse; nothing submitted = an empty verse | `backend/src/multiplayer/game_room.rs:99` |
| `Timing::reconnect` | 45 s | grace for a disconnected player before the match goes to the other | `game_room.rs:100` |
| `Timing::arrival` | 60 s | a paired quick-match opponent, or an inviter, must arrive (`opponent_absent` otherwise) | `game_room.rs:101`, `:812-833` |
| `FINISHED_LINGER` (`Timing::linger`) | 90 s | a finished room still answers a returning player | `game_room.rs:72` |
| `SWEEP_EVERY` | 15 s | room sweep interval | `game_room.rs:64`; `backend/src/main.rs:96-101` |
| `POLICY_AFTER_THE_END` | 120 s | privacy promise; build asserts linger + sweep <= 120 s | `game_room.rs:70`, `:73-76` |
| `UNVISITED_ROOM` | 300 s | a not-started room with nobody connected is swept | `game_room.rs:58`, `:988-995` |
| `MAX_ROOM_AGE` | 30 min | any room is swept after this (a match counted from its first round) | `game_room.rs:62`, `:978-997` |
| `JOIN_WITHIN` | 30 s | a socket that joins no room is closed | `handlers.rs:43` |
| `MAX_CONNECTION` | 45 min | longest socket life | `handlers.rs:45` |
| `MESSAGES_PER_WINDOW` / `MESSAGE_WINDOW` | 30 per 10 s | more and the socket is closed | `handlers.rs:48-49`, `:470` |
| `QUEUE_WAIT` | 30 s | one quick-match request | `handlers.rs:51` |
| `SESSION_CHECK_EVERY` | 15 s | a socket in a room re-checks its session; closes with `signed_out` | `handlers.rs:59` |
| `SESSION_FRESH_FOR` | 1 s | a session answer is reused for this long | `handlers.rs:63` |
| `SESSION_CHECK_WITHIN` | 3 s | a slower database is not taken as a sign-out | `handlers.rs:66` |
| `RECONNECT_WINDOW_MS` | 60 s | the page keeps reconnecting this long (pauses up to 5 s) | `src/lib/multiplayer-client.ts:145-147` |
| `QUICK_MATCH_LIMIT_MS` | 3 min | the page stops asking for a quick match | `multiplayer-client.ts:352` |

States: `waiting`, `in_progress`, `completed` (`game_room.rs:107-114`). A match ends by rounds, by points, by forfeit, or by disconnect (`EndReason`, `:126-136`). Forfeit during a match gives it to the other player; before the start it only gives up the seat (`:929-936`). A dropped player has the reconnect grace, then loses (`:948-976`). A second connection replaces the first (`connection_replaced`, `handlers.rs:439`). A reload, another page, or a back/forward restore takes the seat back, keeping the draft and the chosen character for the same round (`multiplayer.astro:208-209`, `:517-526`; `CLAUDE.md:179-184`); a returning player's cards are not checked again (`handlers.rs:553`).

### 5.3 How the server judges

- The server picks the seed (`rand::random::<u32>()`, `game_room.rs:1118`); the seed shuffles all 9 English forms and takes 3 (`online_plan`, `backend/src/verse/duel.rs:466-479`; `forms_for_english` returns every form, `backend/src/verse/forms.rs:129-132`), and picks an acrostic word from 8 (`bard, moon, king, rose, fate, wit, play, star`, `forms.rs:123`). Both players get the same plan (`game_room.rs:1268-1290`, test).
- Each round both players write at once under the same form, each picking a character from their deck, each character once per match (`game_room.rs:1-7`, `:779-784`). Verse limits: 2,000 bytes raw (`MAX_VERSE_BYTES`, `:43`), 600 characters and 8 lines once cleaned (`backend/src/verse/text.rs:44-45`); the text is "settled" (cleaned up to 8 times until stable, `duel.rs:481-503`); a character newer than the server's Unicode tables is refused (`game_room.rs:774-778`); an empty verse is refused (`:785-788`); the content filter runs on both the cleaned and raw text (`:789-798`).
- Scoring (`resolve_online_round`, `duel.rs:559-594`): each side's craft (`online_craft`, `:542-557`: form, card device, house synergy from the deck, riposte against the other side's previous verse; no relics, potions or ink) plus its share of a 24-point rule-based judge pool (`JUDGE_POOL`, `backend/src/verse/judge.rs:18`): four criteria, wordplay / allusion / flow / wit (`:20`), 6 points each, split 3/3 when level (`:151-171`). Everything that "answers" reads the other side's verse of the round before; round one has nothing to answer, so wit is a split (`src/lib/multiplayer-rules.ts:28-39`). A copied verse forfeits the whole judge pool to the other side (`duel.rs:572-577`; `JudgeSplit::forfeit_to`, `judge.rs:42-48`).
- Round winner: higher total; level totals go to the larger judge share; level on both is a draw (`duel.rs:578-586`). Unlike the solo duel, there is no challenger to take a dead-level round (`multiplayer-rules.ts:37`; solo: `src/lib/verse/duel.ts:569-571`).
- Match winner: first to 2 rounds; after 3 rounds, more rounds won; then more points over the match; else a draw (`online_match_winner`, `duel.rs:628-653`).
- A round that times out is scored with what is in: a side that sent nothing plays its first unused character with an empty verse (`game_room.rs:845-858`).
- No model and no randomness in a score; nothing a client sends is read as a score (`game_room.rs:1-8`, `:254`; test `:1346`). The page previews with the same TypeScript rules and recomputes every round the server sends (`auditRound`, `src/lib/multiplayer-client.ts:306`), and says so when they disagree (`src/pages/multiplayer.astro:866`). The two engines are held together by golden vectors (`backend/src/verse/mod.rs:9-12`).

### 5.4 Deck rules online

- 3 to 5 different character cards (`ONLINE_DECK_MIN`/`MAX`, `backend/src/verse/duel.rs:596-618`; same in `src/lib/multiplayer-rules.ts:52-53`). No relics, potions or ink online (`game_room.rs:15-17`).
- Anyone may field the starter characters, the first three characters of the catalogue (`starter_characters`, `backend/src/verse/cards.rs:42-45`; `ONLINE_STARTER`, `multiplayer-rules.ts:59`): The Sonnet Man `SM-001` (Legendary), Romeo `MO-001`, Juliet `CA-001` (`src/lib/cards.ts:33`, `:42`, `:51`). Any other character must be in the account's `owned_cards` (`not_held`, `handlers.rs:312-331`; refused with `card_not_held`, `:553-561`).
- The page offers the active deck's characters that the server will accept, or else a starter deck built from held cards (`multiplayer.astro:274-287`), reading the account's cards from `GET /api/v1/inventory` (`multiplayer-client.ts:388-398`; `multiplayer.astro:331`). Because cards won in play stay in the browser (4.1), a character earned after the one-time migration cannot be fielded online unless bought on the marketplace.

### 5.5 Limits

| Limit | Value | Source |
|---|---|---|
| Rooms on the server | 500 (`ServerFull` / 503) | `game_room.rs:47`, `:1073-1078`; `handlers.rs:82` |
| Live rooms per account | 3 (429) | `MAX_ROOMS_PER_USER`, `game_room.rs:51`, `:1105-1106` |
| Live rooms per network (IPv4 address or IPv6 /48) | 40 (429) | `MAX_ROOMS_PER_ADDRESS`, `game_room.rs:56`; `handlers.rs:96-98` |
| Rooms opened at once | one at a time (a lock) | `game_room.rs:1100` |
| WebSocket message | 6 KiB | `MAX_MESSAGE_BYTES`, `handlers.rs:41` |
| Events buffered per slow connection | 32, then dropped | `EVENT_BUFFER`, `game_room.rs:45` |
| HTTP requests | 600 a minute per IPv4 address or IPv6 /64 (`RATE_LIMIT_PER_MINUTE`) | `backend/src/rate_limit.rs:6`; `backend/src/main.rs:175-180` |
| Request body | 1 MB | `main.rs:166` |
| Report reason | 1 to 500 characters | `handlers.rs:118` |

### 5.6 Rankings and records

- **Nothing about an online match is stored.** The only database writes in `backend/src/multiplayer/` are the content report insert (`handlers.rs:122`) and the card lookup (`:321`). The tables `battle_rooms` and `battle_turns` and the columns `player_stats.mp_wins`, `mp_losses` and `mp_rating` (default 1000) (`backend/migrations/004_multiplayer.sql:2-31`) are never written (the columns are read only by the unused-account purge, `backend/src/auth/passkeys.rs:1084`). There is no ELO or rating.
- **Global leaderboard** (public, `GET /api/v1/stats/leaderboard`, `backend/src/main.rs:125`; `backend/src/stats/handlers.rs:59-109`): the top 50 accounts by `battle_wins`, then `highest_score`, among those with `battle_wins > 0`. Shown on `/profile` (`src/pages/profile.astro:312-320`, columns at `:292-304`). Those numbers reach the server only in the one-time migration upload (4.1), are self-reported by the browser, are kept as the maximum ever sent (`migration/handlers.rs:137-149`), and count solo rounds won (4.5), not online results.
- **Tournament standings**: wins and losses per tournament (4.8).
- **House leaderboard**: table only (4.11).

### 5.7 Moderation and safety

- **Word filter** on every online verse (`backend/src/multiplayer/content_filter.rs`): 20 entries, 16 single words matched as whole tokens and 4 phrases ("kill yourself", "kys", "hang yourself", "go die") matched as substrings, case-insensitive (`:6-10`, `:20-49`). A refused verse gets one message, "Your verse contains language that violates our community guidelines. Please revise and resubmit." (`:29`, `:38`). Solo verses are never checked (they never leave the device).
- **Reports**: "Report your opponent's verse" under each round (`src/pages/multiplayer.astro:871-883`) posts `room_id` and a reason prefixed with the round (`reportContent`, `multiplayer-client.ts:407`; `handlers.rs:113-142`) into `content_reports` with status `pending` (`backend/migrations/015_content_reports.sql:2-10`). No code reads, reviews or acts on a report (the table appears only in that insert).
- **Age**: the browser's age gate blocks under 13, asks 13-17 for a parent's permission (`teen-consented`), and stores `adult` from 18 (`src/layouts/BaseLayout.astro:1626-1662`). Accounts carry `age_tier` (`016_age_tier.sql:3`) and `age_tier_declared` (`019_limits_and_declared_age.sql:42-45`), with the rules in `backend/src/auth/age.rs:1-35`. The only economic effect is the teen spend cap of 200 credits a day (4.6). Nothing in multiplayer reads the age tier (no `age_tier` in `backend/src/multiplayer/`): a teen account can be paired by quick match with any adult stranger.
- Opponents see each other's username only (`PlayerView`, `game_room.rs:145-150`); there is no chat, friend list, block or mute.
- A finished battle's verses leave the server's memory within 2 minutes (5.2), as the privacy policy promises.

### 5.8 Social sharing

`src/lib/social-share.ts` (Web Share API with a clipboard fallback, adding `#InspiredMile #Shakespeare #SonnetMan`, `:15-46`; share a battle win, a trivia score, collection progress, `:49-70`) has no importer and no page calls `navigator.share`: sharing is not in the product. The footer links to the Sonnet Man's own YouTube, X, LinkedIn and Facebook (`src/layouts/BaseLayout.astro:505-514`).

### 5.9 Tests that cover this

- Multiplayer has 12 browser tests against a real API and Postgres (`tests/multiplayer.spec.ts:243-910`: a whole match with server scores equal to the preview, quick match and forfeit, reconnect and reload, limits, queue timeout, socket abuse, sign-out mid-match, message flood), plus Rust unit tests in `game_room.rs` (`:1268-1728`), `handlers.rs`, `matchmaking.rs` and `content_filter.rs` (`:51-91`).
- The economy has no backend tests: none of `backend/src/{credits,inventory,marketplace,tournaments,seasons,referral,classroom,stats,variants,migration}` has a `#[cfg(test)]` module, and `backend/tests/` holds only `verse_parity.rs` and its golden data. Marketplace, tournaments and season are tested for rendering and language only, against a mocked API (`tests/pages-rest.spec.ts:306`, `:334`, `:368`, `:395`; `mockApi`, `tests/pages-rest.fixtures.mjs:119`). Playground packs, trivia and challenge are tested for opening their modals and the starter reveal (`tests/v1-flows.spec.ts:65-147`); world cards for display and equipping (`tests/v2-world-cards.spec.ts`).

### Could not determine

- Whether production's database holds any season, season reward, tournament, listing, referral or report rows, or any credits balances: nothing in the repository seeds them, and I did not query prod.
- Whether `LAUNCH_DATE` is set in production's `.env` (the code default is `2026-04-01`, `backend/src/config.rs:306`), and so whether any account is a "founding player" receiving the 500-credit refill.
- Whether the frontend type-checks: `src/lib/inventory.ts:60` writes `state: 'owned'` into an object typed `OwnedCard`, which has no `state` field (a leftover of the removed NFT code); I did not run `tsc` or a build.
- The intended rules for streaks, weekly events, draft mode and house allegiance beyond what their dead code says; no document or commit after `fb2284d2` (2026-02-16, which introduced most of them) says whether they are to be wired or dropped.
- Whether the bye and round-robin behaviour of tournaments (4.8) is what was intended; I read it from the code and did not run it.
- How many accounts exist or have migrated their collections (decides whether the leaderboard and online decks reflect anything).

## 6. Narrative, world and tone

### 6.1 Company, product and the Sonnet Man persona

- **Company.** The footer reads "© {year} Voyage Tracable, LLC (DBA Inspired Mile). All rights reserved. Sarasota, FL." (`src/layouts/BaseLayout.astro:521`). The terms name the operator in the same way (`src/pages/terms.astro:17`). The about-page timeline records "Inspired Mile launched under Voyage Tracable, LLC", dated June 2025 and marked done (`src/i18n/pages/about/en.ts:34`, `src/pages/about.astro:56`).
- **Product name.** The installed app is called "Sonnet Man: the duel of verses", short name "Sonnet Man" (`public/manifest.json`, `src/i18n/pages/shared/en.ts:59`). The home page shows the badge "Shakespeare on the Go". It is marked as "The name of Devon Glover's programme: a proper name, the same in every language" (`src/pages/index.astro:47-48`).
- **Devon Glover.** He is listed on the about page as "Devon Glover", aka "The Sonnet Man". The entry links to southernshakespearefestival.org/sonnet-man and to his YouTube, X, LinkedIn and Facebook accounts (`src/pages/about.astro:21-34`). His role is "Creative Director" (`src/i18n/pages/about/en.ts:22`). The bio reads "Brings Shakespeare to life through hip-hop, poetry, and adaptation. Teaching artist, theater performer, and the voice behind Shakespeare on the Go. Music on Spotify, Tidal, and Apple Music." (`src/i18n/pages/about/en.ts:23`). The "Why Shakespeare?" paragraph calls him "Our creative partner" who has "partnered with the Southern Shakespeare Festival, Shakespeare Behind Bars, and schools nationwide" (`src/i18n/pages/about/en.ts:17`). The original plan builds the product around him: "built around Devon Glover's ("The Sonnet Man") unique Shakespeare-meets-hip-hop brand" (`PROJECT_BRIEF.md:5`). It also lists him as Creative Director (`PROJECT_BRIEF.md:27`) and proposes a 100-card "Sonnet Man Special" tier and "Tour Exclusives" tied to his performances (`PROJECT_BRIEF.md:81-82`). ROADMAP.md plans content capture and launch events around his tour (`ROADMAP.md:52,59,62,98,106-107,166`).
- **What of Glover is in the built game: nothing of his own work.** No recording, verse, voice or music by him is in `public/`. The four music tracks carry other artists' tags (see 7.3). Glover is named only on the about page and in the badge on the home page. The timeline item "Content capture with Sonnet Man performances" (summer 2025) is marked `done: false` (`src/pages/about.astro:57`, `src/i18n/pages/about/en.ts:35`).
- **The Sonnet Man card (SM-001).** He is the only card in house "Legendary": rarity Legendary, element Fire, ATK 95, DEF 80, HP 100. His quote is Sonnet 18's first line. His scene reads "Shakespeare's words transform into hip-hop bars as the crowd cheers" (`src/lib/cards.ts:33-40`). His device is One Rhyme ("monorhyme", `src/lib/verse/devices.ts:211`), and the reason given for it is "The Sonnet Man rides one rhyme all the way down." (`src/lib/verse/english.ts:133`). In his art he is "a hip-hop poet and teaching artist on a stage, microphone in hand, in a sharp modern jacket", painted as "a Black actor of African descent with deep brown skin" (`scripts/art/build_prompts.py:6,34,66-68`). The prompt does not name Glover and does not ask for a likeness. His name is the product name and stays in English in every language (`docs/language/NAMES-AND-QUOTATIONS.md:619`). He is the final story opponent (6.5).
- **"Master Thespian".** The persona of the brief ("AI Master Thespian", `PROJECT_BRIEF.md:84-89`) survives only as labels:
  - the role line on the home-page card, "Master Thespian" (`src/i18n/pages/home/en.ts:17`);
  - the playground copy "Challenge the Master Thespian in a Shakespeare rap battle" (`src/i18n/pages/playground/en.ts:48`);
  - the voice, whose comment reads "Use a British male voice for the Master Thespian character" (`src/lib/thespian-voice.ts:14-15`).

  The built opponent is not one persona. In a solo duel it plays three characters drawn by seed from all 53, plus one relic and one potion (`src/lib/verse/duel.ts:277-284`). Each verse is prompted as "You are {card.name} in a duel of verses: theatrical, sharp, in character. Your line in the play: "{quote}"" (`src/lib/verse/opponent.ts:79`).

### 6.2 Houses

The type has 16 values: 13 houses of characters plus the pseudo-houses Legendary, Relic and Potion (`src/lib/cards.ts:8`). Every card has an era: shakespeare (the default), romantic or mythology (`src/lib/cards.ts:9,28,749-751`), labelled "Shakespeare", "Romantic Poets" and "Greek Mythology" (`src/lib/cards.ts:773-777`). The counts below come from a node script over `CARD_CATALOG`: 71 cards, 53 Characters, 9 Relics and 9 Potions. By era, 51 are shakespeare, 10 romantic and 10 mythology.

| House | Cards | Source | Device (`devices.ts:200-215`) | Why line (`english.ts:22-29,128-137`) | Art tradition (`build_prompts.py:16-33`) |
|---|---|---|---|---|---|
| Montague | 4: Romeo, Mercutio, Benvolio, Lord Montague | Romeo and Juliet | Inner Rhyme | "Mercutio's quick tongue rhymes mid-line." | Italian Renaissance fresco |
| Capulet | 3: Juliet, Tybalt, Lady Capulet | Romeo and Juliet | The Outcry | "O Romeo, Romeo!" | Art Nouveau poster |
| Verona Court | 4: Prince Escalus, Friar Lawrence, The Nurse, Paris | Romeo and Juliet | The Riposte | "The court weighs every word said against you." | Ethiopian Orthodox icon |
| Danish Court | 4: Hamlet, Ophelia, King Claudius, Horatio | Hamlet | The Question | "To be, or not to be, that is the question." | German Expressionist woodcut |
| Forest of Arden | 4: Puck, Titania, Oberon, Bottom | the cast is A Midsummer Night's Dream's, the name is As You Like It's | Alliteration | "Whereat, with blade, with bloody blameful blade." | Haitian painting |
| The Tempest | 4: Prospero, Ariel, Caliban, Miranda | The Tempest | The Swell | "The storm builds until it breaks." | Japanese ukiyo-e |
| Scottish Court | 3: Macbeth, Lady Macbeth, Banquo | Macbeth | The Drumbeat | "Tomorrow, and tomorrow, and tomorrow." | Celtic illuminated manuscript |
| Illyria | 3: Viola, Malvolio, Olivia | Twelfth Night | Brevity | "Brevity is the soul of wit." | Persian miniature |
| Rome | 3: Brutus, Cassius, Mark Antony | Julius Caesar | Invocation | "Friends, Romans, countrymen." | Mexican muralism |
| Legendary | 1: The Sonnet Man | the game's own | One Rhyme | "The Sonnet Man rides one rhyme all the way down." | contemporary street-art mural |
| Lake District | 5: Wordsworth, Coleridge, Keats, Elizabeth Barrett Browning, Christina Rossetti | Romantic and Victorian poets | Balance | "The Romantics measured every line." | Chinese shan shui ink wash |
| Gothic Circle | 5: Byron, Mary Shelley, Poe, Blake, Percy Bysshe Shelley | Romantic and Gothic writers | The Ring | "The tale ends where it began." | Russian lacquer miniature |
| Olympus | 7: Zeus, Athena, Apollo, Aphrodite, Hermes, Odysseus, Achilles | Greek myth | Grandeur | "The gods speak in thunderous words." | Greek red-figure vase |
| Underworld | 3: Hades, Persephone, Medusa | Greek myth | The Riposte (shared with Verona Court) | "The dead remember everything you said." | ancient Egyptian tomb painting |
| Relic | 9 objects | Shakespeare's plays (see 6.3) | none: power words | none | Mughal miniature |
| Potion | 9 objects | Shakespeare's plays | none: curses | none | West African textile |

Notes on the houses:

- **Forest of Arden.** The home page links the house to "as-you-like-it" (`src/pages/index.astro:23`). Its unused allegiance motto is "All the world's a stage", from As You Like It (`src/lib/house-allegiance.ts:23`). All four of its characters come from A Midsummer Night's Dream (`src/lib/cards.ts:87,96,228,373`), and so does its why line. Story Act III sets the Dream cast "in" the Forest of Arden (`src/lib/story-mode.ts:58-67`).
- **Two other mismatches.** Lake District holds two Victorian poets, Barrett Browning and Rossetti (`src/lib/cards.ts:602,612`). Illyria's why line, "Brevity is the soul of wit", is from Hamlet, not Twelfth Night (`src/lib/verse/english.ts:27`).
- **The home page shows only four houses**: Montague, Capulet, Danish Court and Forest of Arden (`src/pages/index.astro:19-24`). Its count of houses is the number of distinct houses among Character cards (`src/pages/index.astro:27`), which is 14 by the catalogue (13 houses plus Legendary). Its copy promises "Choose your allegiance. Each house draws from a different Shakespeare play" (`src/i18n/pages/home/en.ts:30`).
- **House allegiance is dead code.** `src/lib/house-allegiance.ts:19-29` defines the nine Shakespeare houses as allegiances. Each has a motto, a colour, an icon and a "bonus" of +1 or +2 on an axis: Montague Flow+1, Capulet Wordplay+1, Danish Court Depth+1, Forest of Arden Creativity+1, Verona Court Wit+1, The Tempest Flow+1, Scottish Court Wit+2, Illyria Flow+2, Rome Wordplay+2. "Depth" and "Creativity" are not battle axes; the axes are `'wordplay' | 'shakespeare' | 'flow' | 'wit'` (`src/lib/battle-rules.ts:19`). Nothing in `src/` imports the module (grep for `getHouseBonus|setHouseAllegiance|getHouseAllegiance|house-allegiance`). The database has a `users.house_allegiance` column and a `house_leaderboard` table (`backend/migrations/012_houses.sql:2-12`). No backend handler reads either (grep `backend/src` for "house" finds only the verse engine and passkeys).

### 6.3 The cast by source

The counts are from the catalogue. The sources of the lines are from `docs/language/NAMES-AND-QUOTATIONS.md`, "Card by card", lines 1579-3142.

| Source | Characters | Objects (relics, potions) |
|---|---|---|
| Romeo and Juliet | 11 (Montague 4, Capulet 3, Verona Court 4) | Romeo's Ring, Apothecary's Elixir |
| Hamlet | 4 | Yorick's Skull, Hemlock Tincture (line from Hamlet 1.5) |
| A Midsummer Night's Dream | 4 | Love Potion, Puck's Flower Juice, Oberon's Dew, Bottom's Mask |
| The Tempest | 4 | Prospero's Staff, The Tempest Codex, Mermaid's Tears |
| Macbeth | 3 | Dagger of the Mind, Macbeth's Crown, Witches' Brew, Mistletoe Extract |
| Twelfth Night | 3 | none |
| Julius Caesar | 3 | none |
| The Merchant of Venice, King Lear | none | Portia's Casket, Cordelia's Tears |
| Romantic and Victorian poets | 10 | none |
| Greek myth (Homeric figures, gods, Medusa) | 10 | none |
| Invented | 1 (The Sonnet Man) | none |

Several objects carry a line from a play other than their own:

| Card | Line from (`NAMES-AND-QUOTATIONS.md` line) |
|---|---|
| Macbeth's Crown | Henry IV, Part 2 3.1 (2483) |
| Mandrake Root | Othello 3.3 (2571) |
| Mistletoe Extract | the witches' recipe, Macbeth 4.1 (2637) |

### 6.4 Quotations and where they come from

- **One English line per card.** Every card has one English line (`quote`, `src/lib/cards.ts:21`). The card face shows it without a source: the home-page hero card at `src/pages/index.astro:113` and the collection modal at `src/pages/collection.astro:531` print the line and nothing else. Sources are recorded only in the generated document `docs/language/NAMES-AND-QUOTATIONS.md`, built by `scripts/language/build_card_text.py` (`NAMES-AND-QUOTATIONS.md:3-6`).
- **Published lines and the game's own lines.** 61 of the 71 English lines are cited to a published work: 51 to Shakespeare's plays and Sonnet 18, and 10 to Wordsworth, Coleridge, Keats, Byron, Mary Shelley's Frankenstein, Poe, Blake, P. B. Shelley, E. B. Browning and C. Rossetti. All 10 Olympus and Underworld lines are "the game's own line". Two of those are paraphrases (Odyssey 1.1, Iliad 9.410-416) and one is "after Hegel's owl of Minerva" (`NAMES-AND-QUOTATIONS.md:2923-3121`). The tally comes from grepping its "English line:" entries.
- **Lines in the other fifteen languages.** A line is taken from a public-domain published translation where one was found on Wikisource or Project Gutenberg. The translator must have died in 1955 or earlier, and a unit test checks this (`NAMES-AND-QUOTATIONS.md:97-104,136-139`). Otherwise the line was "translated for the game, not reviewed". Lines from a published translation, per language (`NAMES-AND-QUOTATIONS.md:472-488`): fr 51, it 51, de 50, ru 34, es 29, pl 28, ja 13, pt 6, and 0 in ar, hi, zh, ko, vi, th and id. In those seven languages all 71 lines were written for the game (`NAMES-AND-QUOTATIONS.md:599-616`).
- **Names.** Names are Wikidata labels where they exist (CC0). The 9 relics, the 9 potions, MO-004, CA-003, most house labels and every element label were translated for the game in every language (`NAMES-AND-QUOTATIONS.md:12-17,619`).
- **Story text.** Story narratives keep Shakespeare's own lines in English in every language, and a test enforces it (`src/i18n/pages/story/en.ts:7-8`, `src/i18n/pages/play-areas.test.ts:463-473`).
- **Quote challenges.** There are 104 fill-in-the-blank challenges: 30 easy, 37 medium and 37 hard, from 27 works, the most from Hamlet (14), Romeo and Juliet (11) and Julius Caesar (10) (`src/lib/challenges.ts:15`, counted by script). A language plays its own challenges only from lines whose published translation was found, and only when it has at least `MIN_LOCAL_CHALLENGES = 8` of them; otherwise it plays the English originals (`src/lib/play-content.ts:10-18,119-128`). Own challenges per language (`src/i18n/pages/challenges/<lang>.ts:6`): it 35, fr 32, es 31, pl 31, de 27, ru 22, zh 22, ja 10. Portuguese, Arabic, Hindi, Korean, Vietnamese, Thai and Indonesian have 0 and play English.
- **Who translated the trivia.** The trivia questions and their sentence options, and the playground and story text, were translated "by a language model (Claude), in one pass per language", and are "Not verified by a native speaker" (`docs/language/CONTENT-PROVENANCE.md:15,17`).

### 6.5 Story mode

Story mode has five acts and 19 encounters (`src/lib/story-mode.ts:32-92`). By difficulty there are 5 easy, 7 medium and 7 hard.

| Act | Name, setting | Encounters (opponent card, difficulty) |
|---|---|---|
| I | The Streets of Verona, Verona | 1-1 Street Brawl (CA-002 Tybalt, easy); 1-2 The Nurse's Riddle (VC-003, easy); 1-3 Mercutio's Challenge (MO-002, medium); 1-4 The Prince's Judgment (VC-001, medium) |
| II | The Halls of Elsinore, Denmark | 2-1 The Ghost's Warning (DC-003 Claudius, medium); 2-2 Ophelia's Garden (DC-002, easy); 2-3 The Mousetrap (DC-003 Claudius, hard); 2-4 Hamlet's Soliloquy (DC-001, hard) |
| III | The Enchanted Forest, Forest of Arden | 3-1 Puck's Pranks (FA-001, easy); 3-2 Bottom's Dream (FA-004, medium); 3-3 Titania's Court (FA-002, medium); 3-4 Oberon's Trial (FA-003, hard) |
| IV | Tempest Island, The Tempest | 4-1 Caliban's Rage (TP-003, medium); 4-2 Ariel's Song (TP-002, medium); 4-3 Miranda's Wonder (TP-004, easy); 4-4 Prospero's Final Test (TP-001, hard) |
| V | The Globe Theatre, London | 5-1 The Scottish King (SC-001, hard); 5-2 Rome's Betrayal (RM-001, hard); 5-3 The Final Bow (SM-001 The Sonnet Man, hard) |

- **The writing.** Each encounter has a one-line description and a short narrative in which the opponent speaks. Most narratives quote the play, for example "Do you bite your thumb at me, sir?" (`src/lib/story-mode.ts:39`). The Sonnet Man's closes the campaign: "All the world's a stage. You have played your part well. Now — one last verse, and the curtain falls." (`src/lib/story-mode.ts:89`).
- **Mismatches between the text and the data.** The description of 1-1 says "A Capulet servant challenges you", but its opponent is Tybalt (`src/lib/story-mode.ts:39`). The narrative of 2-1 is the Ghost's, but its opponent is Claudius, who is also the opponent of 2-3 (`src/lib/story-mode.ts:51,53`).
- **What the page does.** It draws the acts. It locks every encounter after the first one not yet completed, and clicking an unlocked encounter shows its name, description and narrative (`src/pages/story.astro:119-141`). **No duel is started.** The difficulty of an encounter is only a coloured label (`src/pages/story.astro:13,64`).
- **Progress cannot advance.** `completeEncounter` (`src/lib/story-mode.ts:117-137`) has no caller anywhere in `src/` (grep). So a player always has 0 encounters completed and 0 stars, and only encounter 1-1 is ever unlocked (`isEncounterUnlocked`, `src/lib/story-mode.ts:140-153`). The header claims "Progress persists to localStorage + server sync" (`src/lib/story-mode.ts:4`), but there is no server code for story (grep of `backend/src` for "story" finds nothing). Stars are 1 to 3 per encounter in the data model only (`src/lib/story-mode.ts:27,121`).
- **How a player reaches it.** `/story` is not in the site navigation; the links in `src/layouts/BaseLayout.astro` are /, /about, /battle, /collection, /marketplace, /multiplayer, /playground, /privacy, /profile, /terms, /tournaments, /viewer, /vr and /world-map. It is listed in `public/sitemap.xml` and in the production smoke test (`tests/prod-smoke.spec.ts:11`). It is translated into all 16 languages (`src/i18n/pages/story/*.ts`, 16 files).

### 6.6 The world map and world cards

The premise, from the header of `src/lib/variants.ts`: "Shakespeare characters travel through time and global cities". A variant is "a cosmetic skin for a base card that changes visual appearance and grants a passive city ability in battle" (`src/lib/variants.ts:2-5`). Only Character cards have variants (`src/lib/variants.ts:7`).

There are 20 cities (`src/lib/variants.ts:21-26`). Each grants +2 on one criterion (`src/lib/variants.ts:90-390`):

| Criterion | Cities and ability names |
|---|---|
| wordplay | Tokyo "Neon Precision", Paris "Haute Verse", Mexico City "Corrido Craft", Johannesburg "Jozi Bars" |
| flow | Lagos "Afrobeat Flow", Mumbai "Bollywood Rhythm", Seoul "K-Wave Cadence", Manila "FlipTop Flow", Toronto "Six Flow", Kingston "Dancehall Rhythm" |
| wit | Brooklyn "Borough Boss", Sao Paulo "Favela Fire", Berlin "Cabaret Edge", Accra "Highlife Humor", Sydney "Harbour Hustle", Osaka "Kansai Comedy" |
| shakespeare (allusion) | London "Bard's Home Turf", Nairobi "Storyteller's Gift", Cairo "Scribe's Wisdom", Istanbul "Crossroads Verse" |

- **The cities' framing is hip-hop and battle-rap culture.** For example Brooklyn is "NYC roast culture, battle rap birthplace" (`src/lib/variants.ts:129`) and Manila is "Filipino rap battle culture" (`src/i18n/pages/variants/en.ts:46`). This is the main place where the hip-hop side of the brief lives in the world data. A variant's scene text reads "{name} from Shakespeare, reimagined in modern hip-hop style" (`src/lib/variants.ts:466-471`).
- **The combinations.** A variant is a city, one of 4 attires, one of 4 hairstyles and one of 6 skin tones (`src/lib/variants.ts:77-84,452-484`), with the id `{card}-{CITY}-{aa}-{hh}-{tt}` (`src/lib/variants.ts:396-411`). The world map shows the number of combinations as 53 characters × 20 cities × 96 = **101,760** (`src/pages/world-map.astro:12,33`, computed by script). Stale comments and data still say "12 Global Hip-Hop/Culture Hubs", "the 18 that get variants" and "18 chars × 12 cities = 216" (`src/lib/variants.ts:87,495,509`). The JSON catalogue says `"characters": 18, "cities": 12, "heroVariants": 216, "totalCombinations": 20736` (`src/data/variant-catalog.json:3-8`); it is read only by `scripts/generate-variant-*.ts`.
- **Only one way to earn a variant works.** Five sources are declared: city-quest, battle-streak, trivia-mastery, daily-travel and event (`src/lib/variants.ts:30-35`). Only trivia-mastery is wired: a perfect trivia round awards a random unowned variant of a random owned character (`src/pages/playground.astro:580-590`, `src/lib/variants.ts:641-673`). Variants are kept in `localStorage` key `inspired-mile-variants` (`src/lib/variants.ts:550`). The API has `/variants`, `/variants/unlock` and `/variants/eligible` (`backend/src/variants/handlers.rs:36-41`), but the client's `unlockVariant` (`src/lib/api-client.ts:263`) is called by no page.
- **Where world cards appear.** The world map lists the cities with a modal of each city's attires, hairstyles and the player's variants there (`src/pages/world-map.astro:42-56`). The collection page has a World Cards tab (`src/pages/collection.astro:390-457`). In a solo battle the player can equip one variant, and its city's bonus is reported as "World card: {city}" in the verdict (`src/pages/battle.astro:405-440`, `src/i18n/locales/en.ts:297`; how the bonus enters scoring is in section 1). All three screens show the **base card's** image, never a variant image (`src/pages/collection.astro:448`, `src/pages/world-map.astro:192`); see 7.2.

### 6.7 The written opponent's verses (no model)

- **What a pack holds.** "A pack holds the words an acrostic can spell, the letters a curse can forbid, each relic's power words, and the verses the written opponent plays when no model can run" (`src/lib/verse/packs/index.ts:4-6`). `spare` holds verses for a cursed opponent: "short lines, short words, nothing said twice" (`src/lib/verse/packs/index.ts:31-36`).
- **English** (`src/lib/verse/packs/en.ts`):
  - 17 `written` verses over 8 forms: 3 couplets and 2 each of quatrain-aabb, quatrain-abab, tercet, anaphora, crescendo, haiku and heroic-couplet (lines 18-51);
  - 17 `spare` verses (lines 53-87);
  - 36 acrostic lines, two for each of 18 opening letters (lines 88-107);
  - 8 acrostic words: bard, moon, king, rose, fate, wit, play, star (line 5);
  - 6 forbidden letters: s t r n o i (line 6);
  - 9 relics × 5 power words, e.g. Yorick's Skull: skull, jest, grave, laugh, dust (lines 7-17).
- **The register is mock-Early-Modern trash talk**, all "thou" and "thy", with no hip-hop idiom. Examples: "Step up, poor player, strut thy little hour / Then watch thy verses wither like a flower" (line 21); "I have heard braver thunder from a mouse / A plague of silence fall upon thy house" (line 22); "Rhyme is a blade, and thou hast brought a spoon" (line 102).
- **Other languages.** Counts by script over each pack:

| Language | Forms | Written verses | Spare verses | Acrostic lines | Acrostic words |
|---|---|---|---|---|---|
| es fr de it pt pl ru hi ja ko id | 9 | 18 | 0 | 20 to 28 | 6 or 7 |
| zh, vi | 10 | 20 | 0 | 24, 22 | 6 |
| ar, th | 7 | 14 | 0 | 20, 22 | 6 |

  Every pack has 6 forbidden letters. Only English has `spare` verses.

### 6.8 Trivia

- **The bank.** 200 questions: 50 easy, 75 medium and 75 hard, counted by script. The header says "51 easy", which is wrong (`src/lib/trivia.ts:2-3`). Every question has four options, and the correct option is stored first in all 200 (`correctIndex` 0 everywhere, counted by script). Options are shuffled when asked for (`src/lib/trivia.ts:1060-1069`, `src/lib/play-content.ts:69-77`).
- **Topics.** Shakespeare only. No question names a Romantic poet or a Greek figure (grep). Mentions per play by script: Hamlet 18, Macbeth 17, The Tempest 14, Romeo 12, Juliet 11, and 10 each for A Midsummer Night's Dream, Twelfth Night, King Lear and The Winter's Tale.
- **Languages.** The bank is translated into all 15 other languages (`src/i18n/pages/trivia/<lang>.ts`, 200 questions each, e.g. 200 `.q` keys in ja.ts). The play modal asks 5 questions, and a score of 3 or more earns a card (`src/i18n/pages/playground/en.ts:53`).

### 6.9 Content generation by the in-browser model

- **What the model may write.** With a model loaded, the playground can have the model write trivia and quote challenges (`src/lib/content-gen.ts:17-27,99-109`; temperature 0.9 and at most 200 tokens, lines 42 and 118). It may do so only in English: `isContentGenAvailable` returns `lang === 'en' && isBrainLoaded()`, because "nothing checks what a 1 to 3 GB model writes in another language, or whether a "fact" it states is one" (`src/lib/content-gen.ts:164-175`). **In practice it never runs**: the playground imports `content-gen.ts` (`src/pages/playground.astro:283`) but nothing that loads a model, and the site has no client-side router that would carry a model loaded on another page (no `ClientRouter` in `src/`), so `isBrainLoaded()` is false there.
- **What the player gets.** If the model writes at least 3 valid questions, they are used with the badge "AI Generated" and the round is padded from the bank to 5 (`src/pages/playground.astro:486-500`, `src/i18n/pages/playground/en.ts:59`). Generated questions are not fact-checked; the prompt asks the model to put the correct answer first (`src/lib/content-gen.ts:23`).
- **Card scenes are not generated.** Each card's scene is fixed text from `cards.ts`, shown in the collection modal (`src/pages/collection.astro:532`). The "15-second AI-generated scene" of the vision copy (`src/i18n/pages/about/en.ts:14`) is not built.

### 6.10 Voice and tone of the interface

The English interface copy has three registers.

- **Theatrical**, with stage, curtain, crowd and summoning:
  - "Summoning your opponent…" (`src/i18n/locales/en.ts:196`)
  - "The stage is theirs tonight." on a loss (`src/i18n/locales/en.ts:318`)
  - "Raising the curtain…" (`src/i18n/locales/en.ts:341`)
  - "Each character can take the stage once. Relics and potions cost ink." (`src/i18n/locales/en.ts:176`)
  - the difficulty labels "Apprentice: writes one draft" / "Player…" / "Master: picks the best of three drafts" (`src/i18n/locales/en.ts:182-184`).
- **Plain and privacy-forward**, explaining exactly what runs where:
  - "The opponent runs in your browser: nothing you write leaves this device." (`src/i18n/locales/en.ts:174`)
  - "Judged by rule (variety, allusion, sound, and comeback), because no model is running." (`src/i18n/locales/en.ts:306`)
  - the home-page stat "Servers Reading Your Solo Duel", always 0 (`src/i18n/pages/home/en.ts:16`, `src/pages/index.astro:79-80`)
  - "If you lose the passkey, we cannot let you back in." (`src/i18n/locales/en.ts:86`).
- **Marketing**, older copy:
  - "Where Cards Come Alive" (`src/i18n/pages/home/en.ts:10`)
  - "join the next evolution of trading card games" (`src/i18n/pages/home/en.ts:11`)
  - "Every card you win is yours to keep, collect, and trade." (`src/i18n/pages/playground/en.ts:14`).

**The game names itself two ways.** The manifest name calls it "the duel of verses" and the home page "The Verse Duel" (`src/i18n/pages/shared/en.ts:59`, `src/i18n/pages/home/en.ts:23`). The playground, the about page and the app description call it a "rap battle" (`src/i18n/pages/playground/en.ts:47-48,101`, `src/i18n/pages/shared/en.ts:63`). The rules and verdicts themselves use literary terms throughout: form, device, signature, power words, curse, craft, judge (`src/i18n/locales/en.ts:282-309`).

### Could not determine

- Whether Devon Glover has reviewed or approved any of the game's content. No record of it exists in the repository.
- Whether the Sonnet Man card's art is meant to depict Glover. The prompt names no one (`scripts/art/build_prompts.py:66-68`).
- Who wrote the written opponent's verses in English and in the other fifteen packs, and the English lines marked "the game's own". No authorship is recorded, and the pack files carry only technical comments.
- Why Story mode was never wired to the duel: whether it was deferred or dropped. No commit message or CLAUDE.md note says.
- Whether house allegiance and the weekly house leaderboard are deferred or dropped. The code and the migration exist, but nothing calls them and no note explains why.

## 7. Audio and visual

### 7.1 What is in `public/` (48 MB in all, by `du -sh public`)

| Folder | Files | Format and measured properties | Bytes |
|---|---|---|---|
| `images/cards/` | 71 | WebP, all 768×1024 (measured with `sips` on every file); 163,290 to 374,524 bytes each, mean 255,565 | 18,145,108 |
| `images/variants/` | 198 | WebP, all 864×1152 (every file measured); mean 81,780 bytes | 16,192,370 |
| `audio/music/` | 4 | MP3, 44.1 kHz stereo except one 22.05 kHz mono (see 7.3) | 12,244,507 |
| `audio/sfx/` | 14 | WAV, PCM 16-bit 44.1 kHz, mono or stereo (see 7.3) | 1,224,774 |
| `models/` | `sm-001.glb`, `splats/sm-001.ply` | see 7.6 | 459,324 + 917,865 |
| `fonts/` | 12 woff2 + `fonts.css` | Inter, Playfair Display (regular and italic), JetBrains Mono, Outfit, Space Grotesk; latin and latin-ext subsets only | 386,532 (woff2) |
| root | icons and app files | `icon-192.png` 192², `icon-512.png` 512², `icon-maskable-512.png` 512², `apple-touch-icon.png` 180², `favicon.svg` (gold "IM" in Georgia bold on a #1a1714 rounded square), `favicon.ico`, `manifest.json`, `sw.js`, `offline.html`, `sitemap.xml`, `robots.txt` | (not summed) |

- **Service worker.** It caches `/images/`, `/fonts/` and `/audio/` at runtime, up to `MAX_CACHED_BYTES = 12 MB` (`public/sw.js:38-43`).
- **Theme colours.** The manifest's `background_color` and `theme_color` are both `#0d0b09` (`public/manifest.json`), which is `obsidian-950`.

### 7.2 Card art: how it was made, and how it looks

- **How it was made** (`docs/CARD-ART.md:3-6`). "All 71 cards were painted on 2026-11-16 with FLUX 3 Image Klein (FLUX Kommunity License) through mflux 0.24 on the owner's machines." The commit is `0566ca42`, "New art for all 71 cards: one world tradition per house, a global cast". Prompts are built from `cards.ts` by `scripts/art/build_prompts.py` (saved in `scripts/art/prompts.json`). Images are generated by `scripts/art/gen_cards.py` at 768×1024 with seed 7, saved as WebP at quality 88 (`gen_cards.py:18,44,47`). Every image "must be looked at by a person before it is published" (`gen_cards.py:9`).
- **Art direction.** The owner's direction is quoted at `build_prompts.py:3-10`: "we are a global planet and represent everyone", "represent all styles". The script assigns one historical art tradition per house (`build_prompts.py:16-33`; the table in 6.2). It casts each character through a rotation of nine backgrounds (`build_prompts.py:34-35`). It forbids any text, border, frame or watermark, requires modest clothing and "suitable for all ages", and allows no weapon unless the scene names one (`build_prompts.py:40-45`). It strips blood words from scenes (`build_prompts.py:61-63`). Living Indigenous sacred styles are "deliberately not imitated" (`build_prompts.py:9-10`).
- **Known flaws, as the owner's record lists them** (`docs/CARD-ART.md:8-13`):
  - Juliet was cast as East Asian and painted as white.
  - PT-003 and PT-009 carry their names as painted labels.
  - The Capulet cards keep an Art Nouveau border.
  - Medusa shows petrified victims around her.
  - "The city "variant" images under public/images/variants were made from the earlier artwork."
- **What six images look like** (viewed for this document; each is described in one line):

  | Image | What it shows |
  |---|---|
  | `sm-001.webp` | Textured oil-and-spray mural. A Black performer in a dark leather jacket walks a round stage under a gold spotlight, with red curtains and a cheering crowd in robes and headscarves. Gold and crimson. |
  | `dc-001.webp` | Woodcut with heavy black cuts in violet and black. Hamlet on Elsinore's battlements with Yorick's skull and a white ghost. **He holds a blade the scene does not name**, against the prompt's weapon rule. |
  | `tp-002.webp` | Ukiyo-e: Ariel in flowing teal robes above Hokusai-like waves. Teal and cream, with a visible paper grain. |
  | `ol-001.webp` | Greek-vase-like composition in gold on blue-black. Zeus enthroned on clouds under lightning, with a frieze band at the foot. **Its corners are rounded**, which the prompt forbids. |
  | `pt-002.webp` | Three Black figures in green robes around a cauldron of green smoke, against a kente-like patterned ground. **The pattern has letter-like glyphs** (an "R" at the upper right), despite "no writing". |
  | `images/variants/MO-001-TKY-00-00-02.webp` | **Photoreal**, not painted. A young man in streetwear at a rainy, neon-lit Shibuya crossing, wearing trainers with a swoosh-like mark. This matches the earlier pipeline, Z-Image Turbo through a Hugging Face Gradio space (`scripts/generate-variant-art.ts:2-11`). |

- **The overall style.** The painted set is deliberately inconsistent across houses: each house has its own medium and palette, and within a house the medium holds. All cards are portrait and full-bleed (except the defects above), with one large central figure, or a still life for objects. Faces are rendered naturalistically inside each tradition. The variant set is a different, photographic style and has not been redone.
- **Use and orphans.**
  - All 71 card images are referenced: every card has an `image` field (counted by script).
  - **All 198 variant images are orphaned.** Their only reference is a computed `image` path (`src/lib/variants.ts:482`) that no page reads; the collection, world map and battle show the base card's image (`src/pages/collection.astro:448`, `src/pages/world-map.astro:192`).
  - The variant files cover 17 base cards (12 each; DC-003 6). 27 of them use city codes that the catalogue no longer has (PRS, MBI, SPO, NBO, MXC), so `decodeVariantId` and `getCityByCode` could not place them in any case (`src/lib/variants.ts:416-443`).
- **Fallback icons.** Each card also has an emoji `icon` and Tailwind `gradient` and `border` classes (`src/lib/cards.ts:22-24`). The icon is used only where an image is missing, which no card is.

### 7.3 Music and sound effects

The engine is `src/lib/audio-manager.ts`. It is a Web Audio graph of music → master and sfx → master (`src/lib/audio-manager.ts:131-137`). Its defaults are master 0.8, music 0.5 and sfx 0.8, unmuted with music on (`src/lib/audio-manager.ts:28-34`), kept in `localStorage` key `inspired-mile-audio-prefs` (`src/lib/audio-manager.ts:26`). Music loops (`src/lib/audio-manager.ts:187`). While the voice speaks, music ducks to 0.15 over 300 ms and comes back over 500 ms (`src/lib/audio-manager.ts:36-38,267-281`). The only control a player has is the mute toggle in the navigation (`src/layouts/BaseLayout.astro:404,622-627`). The volume setters (`setMasterVolume`, `setMusicVolume`, `setSfxVolume`, `setMusicEnabled`) have no caller in any page (grep). The Web Audio context starts on the first click (`src/layouts/BaseLayout.astro:610-613`), and music fades out on internal navigation (`src/layouts/BaseLayout.astro:615-620`).

**Music.** Durations, rates and tags were measured with `ffprobe`. Each track starts on the page's first click or, in battle, when the duel begins.

| Track | Where it plays | Measured | Embedded tags |
|---|---|---|---|
| `landing-ambient.mp3` | home, first click (`src/pages/index.astro:219-222`, 2 s fade) | 198.1 s, 192 kb/s, 44.1 kHz stereo | artist "Lasse Bührmann", title "Horror Theme 1", 2020 |
| `playground-ambient.mp3` | playground, first click (`src/pages/playground.astro:337-341`) | 127.9 s, 128 kb/s, 22.05 kHz mono | "Logic Pro X", 2019-02-04; no artist |
| `collection-browse.mp3` | collection and world map, first click (`src/pages/collection.astro:265-268`, `src/pages/world-map.astro:78-81`) | 134.4 s, 128 kb/s, stereo | no artist |
| `battle-beat.mp3` | solo battle, when the duel starts (`src/pages/battle.astro:1052-1053`) | 95.9 s, 275 kb/s, stereo | title "Battle Theme A redone", artist "The Cynic Project", composer and performer "cynicmusic.com" |

No licence or credit for any track is recorded anywhere in the repository. A grep of the whole tree for "Cynic Project", "cynicmusic" and "Bührmann" finds nothing outside the files' own tags. The theatre, multiplayer, story and the other pages play no music (only battle, index, collection, playground and world-map import `audio-manager`).

**Sound effects** (`src/lib/audio-manager.ts:7-13`; files `/audio/sfx/<name>.wav`, line 229). Durations were measured.

| Effect | Duration | Played when |
|---|---|---|
| `ui-click` | 0.007 s | picking a card or item in battle (`src/pages/battle.astro:712,739`); playground and collection buttons |
| `card-shimmer` | 0.12 s | opening a card in the collection (`src/pages/collection.astro:346`) |
| `pack-open` | 0.31 s | opening a pack (`src/pages/playground.astro:384,402`) |
| `fanfare-common` / `-rare` / `-legendary` | 0.10 / 0.36 / 0.52 s | the rarity of a card won. Common and Uncommon share the common fanfare, Rare and Epic the rare one (`src/lib/audio-manager.ts:254-263`) |
| `trivia-correct` / `trivia-wrong` | 0.54 / 0.10 s | a trivia answer (`src/pages/playground.astro:563-565`) |
| `challenge-win` / `challenge-lose` | 0.49 / 0.17 s | trivia or quote challenge won or lost (`src/pages/playground.astro:598,616,714,733`) |
| `battle-victory` / `battle-defeat` | 4.45 / 0.50 s | the end of a solo duel (`src/pages/battle.astro:889-890`) |
| `card-flip`, `ui-whoosh` | 0.50 / 0.38 s | **never played**: only preloaded (`src/pages/playground.astro:340`, `src/pages/battle.astro:1054`) |

### 7.4 Voices

- **Text to speech: Kokoro-82M** (`onnx-community/Kokoro-82M-v1.0-ONNX`, q8, WebAssembly), downloaded from the Hugging Face hub on first use (`src/lib/thespian-voice.ts:5-6,27-42`). CLAUDE.md puts the download at "about 80 MB" (`CLAUDE.md:635`). The voice is `bm_george`, a British male, at speed 0.95 (`src/lib/thespian-voice.ts:14-16`).
  - Kokoro speaks only English. In any other duel language the browser's own voices are used, and only those it reports as local (`localService`). That fallback runs at rate 0.9 and pitch 0.8 and prefers an en-GB voice for English (`src/lib/thespian-voice.ts:63-66,83-85,143-158`). With no local voice for a language, nothing is spoken (line 152).
- **What is spoken.** The opponent's verse, in the solo battle only (`src/pages/battle.astro:834`). The voice is **off by default** (`src/pages/battle.astro:253`) and is turned on with the "Voice: Off" toggle (`src/pages/battle.astro:160,563-570`). The theatre imports no voice module and speaks nothing (grep).
- **Recorded voices and ElevenLabs.** There are no recorded voice files in `public/`, and "elevenlabs" appears nowhere in the repository (case-insensitive grep).
- **Speech input** (for completeness): Whisper base (`onnx-community/whisper-base`) on WebAssembly (`src/lib/ear.ts:17,35`).

### 7.5 The 3D theatre (`/theatre`)

- **What it is.** One Babylon.js scene drawing the same `DuelSession` as the battle page (`src/lib/xr/theatre.ts:1-15`, `src/pages/theatre.astro:70,186`). It runs flat in the canvas, as passthrough AR where offered, or as VR. `supportedMode` prefers `immersive-ar` over `immersive-vr` (`src/lib/xr/theatre.ts:413-423`). The about page states it as "passthrough on Meta Quest 3, a full stage on Apple Vision Pro, and the same scene on any screen" (`src/i18n/pages/about/en.ts:44`).
- **The scene.** It is minimal and geometric. There are no characters and no 3D models:
  - a dark floor 8×8 m and a deep-red curtain plane 7×4 m (`src/lib/xr/theatre.ts:147-165`; both hidden in passthrough, lines 458-465);
  - one hemispheric light (line 121);
  - text panels: opponent, round, the player's verse on a tilted lectern, and a verdict panel that covers the far wall (lines 203-213);
  - buttons for mic, clear, submit and next (lines 215-222);
  - the player's hand, laid out as card planes showing each card's art (lines 225-300).
- **How panels are drawn.** Panel text uses Georgia, at 700 px per metre (lines 88 and 181); buttons and card labels use system-ui (lines 198 and 262). Accents are gold `#e8b420`, the verdict frame green or crimson (lines 61 and 81-86, 407).
- **Input.** In a headset, verse is spoken, not typed (`src/lib/xr/theatre.ts:10-11`). On a flat screen a textarea is offered as well (`src/pages/theatre.astro:35-40`).
- **No network fetches.** Babylon's hand-tracking, near-interaction and online controller models are turned off so that nothing is fetched from a third party (`src/lib/xr/theatre.ts:436-445`).
- **Tests.** `tests/theatre.spec.ts` covers a flat-screen duel, picking a card on the canvas, no headset button without WebXR, an emulated Quest 3 session (line 113), and line-wrapping in each script.

### 7.6 The VR gallery (`/vr`), the 3D viewer (`/viewer`) and AR

**VR gallery** (`src/lib/vr-engine.ts`, `src/pages/vr.astro`):

- **Layout.** The 53 Character cards stand on 2 × 2.8 m planes around a circle of radius 6 m, each on a pedestal, all facing the centre. The 18 relics and potions stand on 1.4 × 1.96 m planes in an inner circle of radius 3 m. The floor is 20×20 m. The camera orbits between radii 4 and 25 (`src/lib/vr-engine.ts:47-60,77-165,169-180`).
- **The "name label" carries no name.** Under each card it is a plain gold plane; no text is drawn on it (`src/lib/vr-engine.ts:121-133`).
- **What it shows.** Picking a card only reports its name in the status line (`src/lib/vr-engine.ts:183-193`). The gallery shows **the whole catalogue, not the player's collection**, though the page says "Walk through your collection in 3D" (`src/pages/vr.astro:5,17`).
- **XR support.** WebXR is `immersive-vr` only, with teleportation, and the same third-party switches as the theatre (`src/lib/vr-engine.ts:197-224`). The header's "battle spectator" (`src/lib/vr-engine.ts:2`) is not built.

**3D viewer** (`src/pages/viewer.astro`, `src/lib/splat-viewer.ts`, `src/lib/ar-viewer.ts`):

- **The page.** It lists all 53 characters (`src/pages/viewer.astro:102-112`). It loads either `/models/splats/<id>.ply` as a Gaussian splat in Babylon (`src/pages/viewer.astro:158-159`) or a GLB through Google's `<model-viewer>`, which is bundled with the site (`src/lib/ar-viewer.ts:27-41`). The model-viewer element offers `ar-modes="webxr scene-viewer quick-look"` (`src/lib/ar-viewer.ts:207`).
- **Only one model exists: The Sonnet Man's.**
  - `sm-001.ply` holds 16,384 splats with position, scale, rotation, DC colour and opacity, and no higher-order spherical harmonics (PLY header read by script).
  - `sm-001.glb` is glTF 2.0 with one primitive in **mode 0 (POINTS)**: 16,384 vertices with POSITION and COLOR_0, no indices, materials or textures, and generator "efficient-genai-optimizer" (read by script). It is a coloured point cloud, not a mesh.
- **The rest are missing.** `AR_MODELS` configures 18 GLBs, SM-001's among them (`src/lib/ar-viewer.ts:51-180`; 18 entries, counted by grep). Seventeen of those files do not exist, and 52 of the 53 splat paths do not exist. None of the configs has an `iosSrc` (.usdz), so iOS Quick Look has nothing to show (`src/lib/ar-viewer.ts:43-50`). The collection modal also embeds a model-viewer for any card in `AR_MODELS` (`src/pages/collection.astro:474-501`); for 17 of the 18 its GLB is missing.
- **Origin of the model files.** They date from the 2026-02-14 commit `99694234`, "Add platform features: wallet, multiplayer, marketplace, tournaments, VR".

### 7.7 Palette and typography (`src/styles/global.css`)

- **The site is dark only.** The body is `bg-obsidian-950 text-obsidian-100 font-body` (`src/styles/global.css:288-290`). There is no light theme and no `prefers-color-scheme` rule (grep of `src/styles` and `src/layouts`).
- **Colour tokens** (`src/styles/global.css:24-57`):
  - **gold** 50 to 900, e.g. 400 `#e8b420` and 500 `#d4960f`, the primary accent;
  - **obsidian** 50 `#f4f3f2` to 950 `#0d0b09`, warm near-blacks and greys;
  - **crimson** 50 to 900, e.g. 500 `#dc2626`.
  - Other hues (emerald, purple, indigo, cyan, …) are Tailwind defaults, used per house and per page.
  - Rarity colours: Common obsidian, Uncommon emerald, Rare blue, Epic purple, Legendary gold (`src/lib/cards.ts:731-737`).
- **Components.** `btn-primary` is gold on obsidian, `btn-secondary` a gold outline, and `card-glass` a blurred translucent obsidian panel. `text-gradient` runs gold-400 → gold-300 → gold-500 (`src/styles/global.css:82-103`). Animations include a card flip, a pulsing gold glow, float, scan-line and typewriter (`src/styles/global.css:298-370`).
- **Type.** `--font-display: 'Playfair Display', Georgia, serif` sets every heading (`src/styles/global.css:59,292-294`). `--font-body: Inter` and `--font-mono: 'JetBrains Mono'` (lines 60-61). Outfit and Space Grotesk are declared as `@font-face` (`public/fonts/fonts.css`, `src/styles/global.css:246-266`), but no class or token uses them (grep).
- **Scripts the fonts do not cover.** Only latin and latin-ext subsets are shipped. Cyrillic, Arabic, Devanagari, Thai, Chinese, Japanese and Korean text is therefore set in the device's own fonts. The latin-ext range stops short of most Vietnamese tone-marked letters (U+1EA0 to U+1EF1 are not in the `unicode-range`, `src/styles/global.css:166`). No italic is synthesised for ar, hi, th, zh, ja and ko (`src/styles/global.css:113-117`).

### Could not determine

- **Music.** The licence and source of the four tracks. The tags name The Cynic Project / cynicmusic.com and Lasse Bührmann for two of them; the other two have no artist. Nothing in the repository records a licence or credit.
- **Sound effects.** The source and licence of the 14 effects. They carry no tags, and no generator script exists.
- **Model files.** How `sm-001.glb` and `sm-001.ply` were made. The GLB names the generator "efficient-genai-optimizer", which nothing else in the repository mentions.
- **FLUX 3 Image Klein.** Whether the FLUX Kommunity License terms suit the game's use. The repository only names the licence; its terms are not saved there.
- **Live behaviour.** Whether the live site serves anything at the 18 missing GLB paths or 52 missing splat paths. That needs a request to production, which was not made. In the repository the files are absent.
- **How the art reads at card size in play.** Only six full-size images were viewed, and no screenshot of any screen was taken (no browser was run).

## 8. Onboarding, accessibility and languages (player's side)

### First-time flow

1. **Age gate on every page** except `/privacy`, `/terms` and `/about`
   (`BaseLayout.astro:1671-1672`). It is full-screen and asks for a date of birth as month, day
   and year selects (`:122-157`). The month names come from `Intl` in the interface language
   (`:535-542`); the years run back 100 (`:1557-1564`).
   - Under 13: blocked, stored as `blocked` with the notice "You must be at least 13" (`:1626-1631`,
     `:159-166`). The block persists on every later visit (`:1675-1681`).
   - 13 to 17: a parental-consent checkbox before "Continue with Consent", stored as
     `teen-consented` (`:1632-1661`).
   - 18 and over: stored as `adult` (`:1637-1641`).
   - The answer lives only in the browser (`AGE_KEY`, `:1525`), and the Plausible analytics script
     loads only after an `adult` or `teen-consented` answer (`:70-89`).
2. **Home page.** Its first call to action is "Enter the Playground" (`index.astro:56`). Music
   starts on the first click (`:217-222`).
3. **Playground tour** on the first visit: 3 steps (claim the starter pack, try trivia, then
   "Challenge the AI Master Thespian to a Shakespeare rap battle"; `playground.astro:768-771`,
   `src/i18n/pages/playground/en.ts:96-101`). It can be skipped, and it runs once
   (`inspired-mile-onboarding-done`).
4. **The first duel needs no cards and no account.** The starter deck is dealt
   (`duel.ts:287-295`), and "Play now without a download" starts it against the written opponent
   (`battle.astro:77`).
   - The battle page has **no tutorial of its own**. Teaching is in play: the form's brief
     (`:109`), the live "What your verse must do" checklist and the craft count (`:150-151`), the
     note "Each character can take the stage once. Relics and potions cost ink" (`:26`), and the
     verdict.
   - Theatre and battle have no onboarding overlay (no tour code in either page).
5. **Sign-in is optional for solo play.** "Anonymous localStorage play always works. Backend is
   progressive enhancement" (`src/lib/storage-backend.ts:7`). After a first sign-in, a banner
   offers once to copy the local collection, stats, achievements and variants to the account
   (`BaseLayout.astro:1383-1450`).

### Sign-in, from the player's view

- The header's Sign In opens a panel: "No password to remember. A passkey signs you in with your
  fingerprint, face, or screen lock" (`src/i18n/locales/en.ts:79`), with "Sign in with a passkey"
  and "Create an account with a passkey" (`:80-88`). Creating one asks for no name, email or
  password, and warns "If you lose the passkey, we cannot let you back in" (`:85-86`).
- An emailed 6-digit code signs in, creates an account or recovers one (`:105-111`). It is offered
  only when the server has the email-service key; otherwise the UI hides email (CLAUDE.md:269-270). The
  email step needs an `adult` or `teen-consented` age answer, checked in the browser and in the
  API (CLAUDE.md:322-323).
- Account menu: list, add and remove passkeys (`en.ts:127-134`). Adding or removing one needs a
  proof from the last 5 minutes (CLAUDE.md:259-262). There is also "Date of Birth" to change the
  age tier (CLAUDE.md:325-326), and sign out or sign out everywhere.
- What works signed out: solo duel, Theatre, playground, collection and decks, world map, 3D
  viewer, VR gallery, reading the story, and profile stats with the public leaderboard.
- What needs an account: multiplayer, marketplace, tournaments, season and classroom (all
  protected routes, `backend/src/main.rs:128-139`).

### Settings a player can touch

- **Interface language**: a select in the header with each language in its own name
  (`BaseLayout.astro:250`). The first choice comes from storage (`inspired-mile-locale`), then the
  browser's languages, then English (`src/i18n/index.ts:95-110`).
- **Duel language**: a separate select on the battle page, all 16 offered (`battle.astro:49`,
  `:325`). With a model loaded, the list is split under "<model> · on this device" and "Written
  opponent", and a note under it says why (`en.ts:327-329`, `:370-371`). The Theatre uses the
  last duel language stored, and has no picker (`theatre.astro:183-184`).
- **Opponent difficulty**: Apprentice, Player or Master, on the battle page only (`battle.astro:41-45`).
- **Model choice and download prompt**:
  - "This device can run {model} in the browser. It is a {size} download the first time" with
    Summon buttons (`en.ts:205-207`), and "Play now without a download" (`:194`).
  - What is offered (`src/lib/brain.ts:142-164`):
    - No WebGPU: nothing ("This browser has no WebGPU…", `en.ts:204`).
    - A phone, tablet or headset (Quest and Vision Pro count as handheld, `brain.ts:121-126`):
      the lite tier, which is used in no language (`writesIn: []`, `judgesIn: []`,
      `brain.ts:77-81`) and so is never offered. **Phones and headsets get no model** ("No model
      this device can run…", `en.ts:373`).
    - A desktop without `shader-f16` or reporting under 8 GB: lite, so also nothing.
    - Any other WebGPU desktop: Gemma 4 E2B (3,100 MB) first and LFM3 1.7B (1,090 MB) as the
      "lighter download" (`brain.ts:63,70`; `battle.astro:518-536`).
  - The choice is remembered (`inspired-mile-brain`) and reloaded only if it is still offered
    (`battle.astro:545-547`). The storage note says whether the browser agreed to keep the
    download (`src/lib/pwa.ts:5-9`, `mountStorageNote`).
- **Voice** "Voice: Off/On" toggle on the battle page (`battle.astro:160`, `:562-570`). It reads
  the opponent's verse aloud (`:834`). Music ducks while it speaks (`:551-559`).
- **Microphone** "Speak it" (`battle.astro:157-158`), and in the Theatre's stage button.
- **Audio**: only a mute toggle in the header (`BaseLayout.astro:404`, `:620-625`). The defaults are
  master 0.8, music 0.5, SFX 0.8 and unmuted (`src/lib/audio-manager.ts:28-34`). No page offers a
  volume control: no caller of a volume setter outside `audio-manager.ts`.
- **Reduced motion**: none. No `prefers-reduced-motion` anywhere in `src` (grep finds none), while
  the CSS animates `float`, `pulse-glow`, `scan-line` and `typewriter` (`src/styles/global.css:321-351`)
  and every page badge uses `animate-pulse`.
- **PWA install**:
  - An install offer appears before the first download or sign-in, through the browser's prompt
    on Chrome, Edge and Android, or with iOS Share-sheet steps (`pwa.ts:10-12`, `:477-498`).
  - Once installed, the site asks the browser for persistent storage (`:481-482`).
  - The screen is kept awake during a duel or the Theatre (`pwa.ts:13`, `battle.astro:1048`).
- **Offline**: a banner says "You're offline — Collection and Trivia still work. Multiplayer
  requires internet" (`BaseLayout.astro:1689-1691`). The service worker serves pages from the
  network first, falls back to a kept copy or `offline.html`, and never caches `/api`
  (`public/sw.js:22-26`, `:9-11`).

### Accessibility as built

- Labels and roles:
  - The verse box has a `<label for>` (`battle.astro:143-144`) and `dir="auto"`.
  - The microphone button uses `aria-pressed` (`battle.astro:157`, `:591`, `:617`).
  - The language note is `role="status"`, tied to the picker by `aria-describedby`
    (`battle.astro:50-53`).
  - The story scene is `aria-live="polite"` (`story.astro:73`).
  - The trivia and challenge modals are `role="dialog" aria-modal="true"` (`playground.astro:222`,
    `:246`). The collection's card modal and the playground's reveal modal carry no dialog role
    (`collection.astro:210`, `playground.astro:263`).
  - Escape closes the collection modal (`collection.astro:556-557`) and the account dropdown
    (`BaseLayout.astro:978-979`).
- Keyboard: the desktop Play and Explore menus open on hover only (`group-hover`,
  `BaseLayout.astro:217-218`; `focus-within` appears 0 times in the layout). A keyboard user on a
  wide screen cannot open them. The same links are in the footer, and in the mobile menu
  (`:425-439`), which is shown below `md`.
- Count of `aria-*` attributes per page (grep): BaseLayout 23, classroom 16, viewer 7, playground
  6, battle 5; index, profile, privacy, terms and theatre 0. The Theatre is a canvas; its
  flat-screen fallback offers a typed verse (`theatre.astro:36-40`).
- **Speech input**:
  - Whisper base, multilingual, about 80 MB, run on WebAssembly with or without WebGPU. Takes
    stop at 45 s (`src/lib/ear.ts:1-20`). The duel's language is passed to Whisper (`ear.ts:128`).
  - The browser's Web Speech recognition is never used (`ear.ts:4-5`).
  - The only test of it is English and is skipped without a `FAKE_MIC_WAV` (`tests/model/ear.spec.ts:8-29`).
- **Voice output**:
  - Kokoro 82M (q8, WASM) with the British male voice `bm_george` at speed 0.95, for English only
    (`src/lib/thespian-voice.ts:15-16`, `:83-84`).
  - Other languages use the device's *local* speech-synthesis voices, if any, and stay silent if
    none (`thespian-voice.ts:148-158`).
  - Spoken text is always also on screen (it is the opponent's verse), so there is no
    captions problem. The game has no captions for music or SFX.
- **Right-to-left**: Arabic is the one RTL interface language (`src/i18n/index.ts:57`).
  Multiplayer, Privacy and Terms are forced LTR English (`tests/english-pages-rtl.spec.ts`). Many
  Arabic layout tests exist (`tests/play-i18n.spec.ts:132-332`, `tests/theatre-bidi.spec.ts`).
  Pages in ar, hi, th, zh, ja and ko synthesise no italic (CLAUDE.md:358-359).
- Contrast: not measured by any test found. The palette is dark obsidian with gold text, and small
  text uses `text-obsidian-500` and `-600` on near-black (for example `battle.astro:170`).

### What a player gets in each language

Interface, in every language: the layout, battle and Theatre (core locale files), and home,
about, collection, profile, world map, playground, story, classroom, marketplace, tournaments,
season, viewer and VR (page areas). The exceptions are **multiplayer, privacy and terms, which are
English in all 16** (`docs/language/pages-core/RESULTS.md:447-451`, `privacy.astro:7`,
`terms.astro:7`).

Left in English everywhere: the 160 attire and hairstyle names (`docs/language/pages-core/README.md:84-88`)
and proper names. "No native speaker has read any of it" (`docs/language/pages-rest.md:808`).

Trivia: all 200 questions are translated in every language (a count of `trivia.N.q` keys in
`src/i18n/pages/trivia/<l>.ts`). Model-written trivia is English only (`content-gen.ts:173-174`).

The form counts come from `formsFor` (`src/lib/verse/forms.ts:358-363`) over the forms at
`forms.ts:210-323`:

- Rhyming: couplet, quatrain-aabb, quatrain-abab and tercet. They need `rhymeChecked`, which in
  zh, ja and th needs the sound data (`rhyme.ts:32-35`); the battle page awaits it before the duel
  (`battle.astro:1027`).
- Structural: anaphora, acrostic, crescendo, and epistrophe, which is excluded from English (`forms.ts:273-274`).
- Syllable: haiku and heroic couplet, where `countsSyllables` holds (`text.ts:494-504`; Thai is off,
  `THAI_COUNTED = false`; Arabic is not in the list).
- Native: jueju in zh only and lục bát in vi only.

Model columns are from `brain.ts:63-81`. Only Gemma 4 E2B and LFM3 1.7B are ever offered, and
only on capable desktops.

| Lang | Duel | Forms in the draw (counts from 1.4) | Gemma writes the opponent | Judged by a model (only with that model loaded) | Voice out | Quote challenges in own language (needs ≥ 8, `play-content.ts:18`) | Online |
|---|---|---|---|---|---|---|---|
| en | yes | 9 (no epistrophe) | yes | Gemma | Kokoro | the English original (104) | **yes** |
| es | yes | 10 | yes | rules | device voice | 31 | no |
| fr | yes | 10 | yes | rules | device voice | 32 | no |
| de | yes | 10 | yes | rules | device voice | 27 | no |
| it | yes | 10 | yes | rules | device voice | 35 | no |
| pt | yes | 10 | yes | rules | device voice | 0 (plays English lines) | no |
| pl | yes | 10 | yes | rules | device voice | 31 | no |
| ru | yes | 10 | yes | Gemma | device voice | 22 | no |
| ar (RTL) | yes | 8 (**no syllable forms**) | **no** (written opponent) | rules | device voice | 0 (English) | no |
| hi | yes | 10 | yes | rules | device voice | 0 (English) | no |
| zh | yes | 11, with jueju (6 if its sound data fails to load) | yes | Gemma | device voice | 22 | no |
| ja | yes | 10 (5 if its sound data fails to load) | **no** | rules | device voice | 10 | no |
| ko | yes | 10 | **no** | rules | device voice | 0 (English) | no |
| vi | yes | 11, with lục bát | **no** | LFM3 1.7B (only if LFM3 is the model loaded) | device voice | 0 (English) | no |
| th | yes | 8 (**no syllable forms**; 4 if its sound data fails to load) | yes | rules | device voice | 0 (English) | no |
| id | yes | 10 | yes | Gemma | device voice | 0 (English) | no |

Notes on the table:

- "Rules" means the rule-based judge, the same everywhere a model does not judge. "Written
  opponent" means the hand-written verse in `src/lib/verse/packs/<lang>.ts`.
- Without a model, which means on every phone and headset, every row reads "written opponent,
  rules".
- Speech input is offered in every duel language, through Whisper with the duel's language
  (`ear.ts:128`). Its accuracy outside English is untested.
- Grammar of the interface text: LanguageTool has no module for Thai, Hindi, Vietnamese, Korean or
  Indonesian, so those were checked only by Hunspell and a second model
  (`docs/language/HUMAN-REVIEW.md:5`).

### Could not determine

- Speech-recognition quality per language. No measurement or test outside English was found.
- Which device voices exist for a given player's language. That depends on the device; the code
  only uses those marked `localService` (`thespian-voice.ts:151`).
- Colour contrast ratios. Not measured in any test or document found.
- Whether screen readers announce the round verdicts. The verdict container (`battle.astro`,
  `#verdict`) has no `aria-live`, and no screen-reader test was found.
- Whether the starter pack and daily pack are the only "first session" rewards a designer should
  count. Section 4 owns the economy figures.

## 9. Intent against what was built

**Where the intent comes from.**
- **The plans.** `PROJECT_BRIEF.md` was "generated from team conversations, March – June 2025" (`PROJECT_BRIEF.md:194`). `ROADMAP.md` is "Roadmap v1.1, Last updated: February 2026" (`ROADMAP.md:182-183`), and none of its boxes after the LLC is ticked (`ROADMAP.md:13-144`). Both are older than every line of today's game.
- **The owner's later direction** is the "Owner direction (2026-11-16)" note: passwordless sign-in, in-browser models only, no cloud provider, every language represented, a Rust backend (CLAUDE.md:639-644).
- **The design basis of the rebuild.** The rebuild of 2026-11-16 (`ae20b599`, 05:51) came half an hour after the research notes were committed (`8853b437`, 05:19). Many of its mechanics match the recommendations of `docs/research/card-games-landscape-2026-11.md:219-255`: form cards, characters as conditional multipliers, curses on the opponent, relics as must-use words, a three-round match with ink, a riposte, a judge that compares in both orders, a legible verdict.

**Status words.** *Built*, *partly built*, *not built*, *dropped* (built, then removed or replaced, with the evidence), *changed* (built differently from the plan).

| Promise (source) | What the code does today | Status | Evidence |
|---|---|---|---|
| Digital collectible cards (`PROJECT_BRIEF.md:5`) | 71 cards, collected in the browser | built | `src/lib/cards.ts`; section 2 |
| Cards earned through trivia (`PROJECT_BRIEF.md:50`; `ROADMAP.md:32`) | 200 questions, 5 a round, a card for 3 or more right, no limit on rounds | built | `src/lib/trivia.ts`; `src/pages/playground.astro:580-597` |
| ...through quote challenges (same) | 104 fill-in-the-blank lines, a card for each one right | built | `src/lib/challenges.ts`; `playground.astro:702-713` |
| ...through battle victories (same) | One card for a won solo match on `/battle`; nothing for the Theatre or online | partly built | `battle.astro:968-971`; section 4.3 |
| ...through daily packs (same) | One card every 24 hours, in the browser. A 7-day escalating streak exists as dead code | partly built (one card, not a pack) | `playground.astro:394-406`; `src/lib/streaks.ts` (no importer) |
| ...through direct purchase (same); card-pack sales, NFT sales, subscriptions as revenue (`PROJECT_BRIEF.md:142-147`) | Nothing is sold. The site says "No real-money purchases" | not built; the site disowns it | `src/i18n/pages/about/en.ts:50,64`; `src/pages/terms.astro:45-54` |
| Pack tiers, general and premium (`PROJECT_BRIEF.md:144`) | Standard, Rare and Epic packs priced 50, 150 and 400 credits are shown, with no way to buy one | not built (display only) | `cards.ts:820-847`; `playground.astro:124-142` |
| "AI Master Thespian", a curated LLM persona; battle rapper and thespian (`PROJECT_BRIEF.md:51,84-89`; `ROADMAP.md:36-37`) | The opponent is no single persona: each round it plays one of three characters drawn from all 53, prompted as that character with its line. "Master Thespian" survives as a home-page label, playground copy, an achievement name and the voice's comment | dropped as a persona | `src/lib/verse/opponent.ts:79`; `duel.ts:278-284`; section 6.1 |
| Shakespearean rap battles (`PROJECT_BRIEF.md:86`) | A three-round duel of written or spoken verse under poetic forms. There is no beat, no delivery and no timing to music. The battle loop plays a music track | changed (verse duel, not rap) | sections 1 and 7.3 |
| Sonnet completion challenges; quote adaptation games; melodic call-and-response (`PROJECT_BRIEF.md:87-89`) | Quote challenges fill in a blank. No sonnet completion, no adaptation and no call-and-response mode exists | not built | `src/lib/challenges.ts`; no such mode in `src/pages/` |
| WebLLM with Llama 3.2 3B Q4 in the browser (`PROJECT_BRIEF.md:51,99`; `ROADMAP.md:38`) | Transformers.js on WebGPU with Gemma 4 E2B, LFM3 1.7B and LFM2.5 350M. "WebLLM and Llama 3.2 are replaced" | dropped and replaced | commit `ae20b599`; `src/lib/brain.ts:61-83`; `package.json:19` |
| All AI on the device, zero server inference (`PROJECT_BRIEF.md:108-109`) | Kept and made stricter: the online judge, which called a cloud model (or, with no key, random numbers), is now rules on the server | built, extended | commit `8d113da8`; CLAUDE.md:115-121,639-644 |
| Requires a WebGPU browser (`PROJECT_BRIEF.md:109`) | The game plays without WebGPU: written opponent and rule judge. Only desktops are offered a model | changed | `brain.ts:142-164`; section 8 |
| Kokoro TTS 82M, "multiple voices" (`PROJECT_BRIEF.md:100`; `ROADMAP.md:41`) | Kokoro with one voice (`bm_george`), English only, off by default. Other languages use the device's local voices | partly built | `src/lib/thespian-voice.ts:14-16,143-158`; `battle.astro:253` |
| Web Speech API, with Moonshine Web as fallback (`PROJECT_BRIEF.md:101`; `ROADMAP.md:42`) | Whisper base on WebAssembly. Web Speech recognition is refused because it sends audio to a server, and Moonshine is not used | dropped and replaced | commit `e41c73f5`; `src/lib/ear.ts:4-5` |
| Collection management with ownership tracking (`PROJECT_BRIEF.md:52`; `ROADMAP.md:30,33`) | Grid of 71, owned and locked states, filters, deck builder, in `localStorage` | built | `src/pages/collection.astro`; `src/lib/inventory.ts:22` |
| Cards local first, no crypto needed (`PROJECT_BRIEF.md:56`) | Solo play needs no account; the collection is the browser's | built | `src/lib/storage-backend.ts:7` |
| Solana wallet, compressed NFTs via Metaplex, "Mint as NFT", explorer links (`PROJECT_BRIEF.md:57,60,104-105`; `ROADMAP.md:82-88,120`) | Built on 2026-02-14 and removed on 2026-02-17: "Strip all Web3/crypto features for clean edu-only site … Web3 features will move to a dedicated subdomain … DB columns left dormant". The About page: "No blockchain, no wallet" | dropped | commits `99694234`, `c8a68911`, `7982d79c`; `backend/migrations/002_wallet.sql`, `003_nft_state.sql`; `about/en.ts:40` |
| Marketplace value influenced by combat rankings (`PROJECT_BRIEF.md:3,38,58`) | Prices are what the seller types. No ranking is read. A purchase moves no credits and copies the card | not built | `backend/src/marketplace/handlers.rs:213-281`; section 4.9 |
| Digital marketplace for trading (`PROJECT_BRIEF.md:130`; `ROADMAP.md:119`) | Page and API for sale and trade listings | partly built | section 4.9 |
| Tiered scarcity: 10,000 general, 100 Sonnet Man special (`PROJECT_BRIEF.md:59,77-81`) | No supply exists: 71 designs, unlimited copies drawn with replacement. The one Sonnet Man card is Legendary (1 in 300 draws, derived) yet is in every starter deck and free online | not built | `cards.ts:740-746,780-796`; `src/lib/multiplayer-rules.ts:59` |
| Tour exclusives tied to Glover's live performances (`PROJECT_BRIEF.md:82`; `ROADMAP.md:107`) | None | not built | no event or drop code in `src/` or `backend/src/` |
| Houses based on plays, 4 to 6 of them (`PROJECT_BRIEF.md:72`; `ROADMAP.md:76`) | 13 houses of characters plus Legendary, each with a device. Four beyond Shakespeare (Lake District, Gothic Circle, Olympus, Underworld) | built, exceeded | `cards.ts:8`; `devices.ts:201-216` |
| Characters with unique abilities; character stats (`PROJECT_BRIEF.md:73`; `ROADMAP.md:77`) | An ability per house (the device), and a signature per character. ATK/DEF/HP exist and do nothing | changed | 1.3, 1.5 |
| Relics and potions used in combat (`PROJECT_BRIEF.md:74`; `ROADMAP.md:78`) | Relics lend power words (+6), potions cast curses (−4 a breach, cap 12), 1 ink each | built (solo only) | 1.5 |
| Turn-based or real-time battle system powered by AI (`PROJECT_BRIEF.md:75`; `ROADMAP.md:79`) | Solo: turn-based, the opponent opens each round, no clock. Online: simultaneous, 180 s a round | built | 1.2; section 5.2 |
| 10 character cards across 3 houses, 5 relic/potion cards (`ROADMAP.md:49-50`) | 53 characters across 14 houses, 18 items | built, exceeded | section 2 |
| A Sonnet Man special-tier card (`ROADMAP.md:52`) | One card, SM-001, rarity Legendary, device One Rhyme | built (one card, no tier) | `cards.ts:33-40` |
| AI-assisted card art (`PROJECT_BRIEF.md:117`; `ROADMAP.md:51`) | All 71 painted with FLUX 3 Image Klein on 2026-11-16; one art tradition per house | built | `docs/CARD-ART.md:3-6`; section 7.2 |
| Card detail view with animated or 3D preview (`ROADMAP.md:31`) | The detail modal embeds a 3D model for 18 configured cards, of which only SM-001's file exists, and it is a point cloud | partly built | `src/lib/ar-viewer.ts:52`; `public/models/`; section 7.6 |
| AR layer: AR.js / WebXR, then Niantic SDK; "3 AR demo experiences" (`PROJECT_BRIEF.md:98`; `ROADMAP.md:68-73`) | model-viewer AR (WebXR, Scene Viewer, Quick Look) for SM-001 only, with no `.usdz` for iOS. The Theatre uses passthrough `immersive-ar` on Quest. No AR.js and no Niantic | partly built | `ar-viewer.ts:43-50,207`; `src/lib/xr/theatre.ts:413-423` |
| Generative-AI video scenes, 15 seconds per card (`PROJECT_BRIEF.md:102`; `ROADMAP.md:65`; still promised on the About page, `about/en.ts:14`) | Each card's `scene` is a sentence of text | not built | `cards.ts:25`; section 6.9 |
| Apple Vision Pro and Meta Quest 3 (`PROJECT_BRIEF.md:53,103`; `ROADMAP.md:122-123`) | WebXR in the browser: the Theatre duel (Quest passthrough, Vision Pro full stage) and the VR gallery. Tested under an emulated Quest 3 only. No native app. Headsets get no model | partly built | `tests/theatre.spec.ts:113`; `brain.ts:120-125` |
| Mobile web app (`PROJECT_BRIEF.md:53`; `ROADMAP.md:34`) | Responsive pages and an installable PWA with an offline page | built | `public/manifest.json`; `public/sw.js`; `src/lib/pwa.ts` |
| Loading UI with model-download progress (`ROADMAP.md:39`) | A consent prompt with the size, progress, and a note on whether storage is kept | built | `battle.astro:503-547`; `src/lib/pwa.ts:5-9` |
| 5 to 10 sample battle prompts (`ROADMAP.md:43`) | 12 verse forms (9 in English) with code checks | built, exceeded | 1.4 |
| Basic scoring and ranking (`ROADMAP.md:44`) | Scoring is built (1.3). Ranking is a public top-50 of browser-reported solo *rounds* won. Online results are not stored, and `mp_rating` is never written | scoring built, ranking partly | `backend/src/stats/handlers.rs:59-109`; section 5.6 |
| Multi-player battle system (`ROADMAP.md:121`) | Quick match and private rooms, server-scored by rules, English only | built | section 5 |
| Tournament and event system; live battle tournaments (`ROADMAP.md:142`; `PROJECT_BRIEF.md:148`) | Schema, API, scheduler and a read-only page. Results are self-reported through the API; a tournament match cannot be played from the site | partly built | section 4.8 |
| Expand card themes beyond Shakespeare (`PROJECT_BRIEF.md:129`; `ROADMAP.md:141`) | 20 cards of Romantic poets and Greek myth | partly built | `cards.ts` `era` |
| Open platform, third-party IP, licensing (`PROJECT_BRIEF.md:133-135`; `ROADMAP.md:139-140`) | No creator API or theming layer | not built | no such code |
| Content capture with Glover: footage, voice reference, promo reel (`PROJECT_BRIEF.md:118`; `ROADMAP.md:61-66,98`) | No Glover recording, verse, voice or music in the game. The About timeline marks content capture not done | not built | `src/pages/about.astro:57`; section 6.1 |
| Community: Discord, social accounts, an email-list landing page (`PROJECT_BRIEF.md:125`; `ROADMAP.md:100-102`) | The footer links Glover's own channels. Sharing code exists but no page uses it. Email is used only for sign-in codes | not built (in code) | `src/layouts/BaseLayout.astro:505-514`; `src/lib/social-share.ts` (no importer) |
| "Gets people outside, interacting face-to-face" (`PROJECT_BRIEF.md:39`) | No co-located or location-based play | not built | |
| Karaoke events, vinyl mixtape (`PROJECT_BRIEF.md:148`; `ROADMAP.md:143`) | Outside the code | not built | |
| Owner direction 2026-11-16: passkeys and email codes instead of Google; in-browser models only; all languages; Rust backend (CLAUDE.md:639-644) | Passkeys and 6-digit email codes, Google removed (`6d0ae1d5`, `8f3bfa78`); no server inference; interface and solo duel in 16 languages; axum API | built | CLAUDE.md:240-330; section 8 |

**Built but in neither plan** (all from sections 3 and 4):
- **Working:** the 16 languages, with sourced card names and quotations; passkey sign-in; world-card city variants; achievements; the PWA.
- **Partly working:** Classroom mode, which has a roster and assignment titles but no progress; the Season Pass, which earns no XP; the referral API, which has no page.
- **Stubs and dead code:** Story mode is a stub. House allegiance, draft mode and weekly events are dead code.

**Could not determine.**
- Whether the brief's business items were done outside the code: the Meta Horizon Start application, grants, a Discord, social accounts (`ROADMAP.md:14-19,100-102`).
- Whether the "dedicated subdomain" for Web3 that `7982d79c` names exists.
- Whether the brief's 10,000 and 100 tiers were dropped by decision or only not reached. No commit or note says, and the About page's "never sold at random" (`about/en.ts:40`) is the only later word on selling cards.

## 10. Known open problems, from the player's side

**How this was gathered.**
- **No flagged work.** A search of `src/`, `backend/src/` and `tests/` finds no `TODO`, `FIXME` or `HACK` comments.
- **Skipped tests.** Every skipped test is skipped on purpose by an environment condition: the model downloads, `FAKE_MIC_WAV`, `BYTES_URL`, the lite-tier tests, and random equal codes (`tests/third-party.spec.ts:266`, `tests/model/ear.spec.ts:9`, `tests/battle-ja-cost.spec.ts:22`, `tests/model/grade-injection.spec.ts:28`, `tests/model/judge-unread.spec.ts:15,30`, `tests/theatre.spec.ts:252`, `tests/auth.spec.ts:443,455,2650`, `src/lib/model-eval.judge.test.ts:161,218,237`).
- **Tests were not run**, so failing tests could not be found.
- **Where the problems come from.** The list below is the problems the code shows (sections 1 to 8), the limits CLAUDE.md names, and the record of known faults the repository keeps (`docs/CARD-ART.md`, `docs/language/HUMAN-REVIEW.md`).

**Play and fairness**
1. **On phones and headsets the opponent never changes.** No model is offered there (1.8), so the written opponent always plays. Difficulty then makes no difference (1.6). The same holds in Arabic, Japanese, Korean and Vietnamese on every device, since Gemma does not write those (`brain.ts:65`).
2. **The written opponent is a small, knowable bank.** English has 17 verses over 8 forms, 17 spares, and 2 lines per acrostic letter (section 6.7), and each is picked by the seed (`opponent.ts:172-178`). Its verses answer nothing, so wit is always a split against it (1.7).
3. **The model judges only five of the sixteen languages.** Gemma judges en, ru, zh and id, and LFM3 judges vi. Everywhere else the rule judge decides even with a model loaded (`brain.ts:67,74`). LFM3 "stays near or below chance in Spanish, Arabic and Hindi under every wording" (CLAUDE.md:47-48). 66 of 96 model-language cells are measured (`docs/language/MODEL-EVAL.md`).
4. **The rule judge often cannot tell two verses apart.** On `main`, its labelled-pair tally splits most criteria in many languages, for example zh 0 correct, 40 split, 0 wrong, and de 6/30/0 (`src/lib/verse/judge-accuracy.test.ts:33-35`). Today's judge is held only to be no worse than that. Each split is 3–3, so craft decides most rounds.
5. **Card stats are shown and do nothing.** ATK, DEF and HP are printed on every character (`collection.astro:111`) and never read by a duel (1.3).
6. **The best card is free to everyone.** The one Legendary character, The Sonnet Man, is in every new player's starter deck, and every account may field it online (`duel.ts:287-295`; `multiplayer-rules.ts:59`).

**Progression and rewards** (section 4)

7. **Cards have no limit and no use beyond decks.** Trivia and quote challenges pay a card each with no cooldown (`playground.astro:580-597,702-713`). Duplicates have no use (4.2).
8. **"Battle wins" count rounds, not matches** (`battle.astro:886-888`). That inflates "Win 25 battles" and the public leaderboard.
   - Two achievements say one thing and check another: "Completionist" says all 48, when there are 71 cards, and "Relic Hunter" checks 15 cards of any type (`achievements.ts:147-153,231-237`).
9. **Credits are never earned or spent.** No page imports the credits client (4.6). The About page still promises +50, +30, +20 and +10 (`src/pages/about.astro:64`).
   - The marketplace's prices therefore cannot be paid, and a purchase copies the card for free (4.9).
   - A season reward, once claimed, is claimed for every player (4.7).
10. **The Season Pass earns no XP and has no season seeded** (4.7). A tournament match cannot be played, and a bye never advances (4.8).
11. **Only a won `/battle` match pays a card.** The Theatre and online pay nothing (4.3).
    - The playground's copy says "Win a round and earn a random card" (`src/i18n/pages/playground/en.ts:48`), but only a won match pays one.
    - Cards won after a player's one-time upload cannot be fielded online (5.4).
12. **Story mode is a stub.** Only encounter 1-1 can be read, and none can be played (6.5).

**Promises the pages make that the code does not keep**

13. **The Classroom tour.** It promises "See what each student has completed, their scores and the cards they have earned", but no progress is recorded (4.13).
14. **The VR gallery.** It says "Walk through your collection" and shows the whole catalogue (7.6).
15. **The world map.** It says variants unlock "through battles, trivia, and exploration"; only a perfect trivia round does (6.6).
16. **Referral.** The API answers "You get 5 free packs!" and grants nothing (4.10).
17. **The sitemap** lists `/trivia/` and `/challenges/`, which do not exist (section 3).
18. **The home page** advertises the Theatre and does not link to it (section 3).
19. **The About page** promises a "15-second AI-generated scene" (`about/en.ts:14`), and no such scene exists.

**Art, audio and content**

20. **Known card-art faults** (`docs/CARD-ART.md:8-13`): Juliet cast as East Asian and painted white; two potions carry painted labels; the Capulet borders; Medusa's victims.
    - Viewing six images found three more: Hamlet holds a blade the scene does not name, Zeus's card has rounded corners, and the Witches' Brew pattern has letter-like glyphs (7.2).
    - All 198 variant images are orphaned and in an older, photoreal style (7.2).
21. **3D models are missing.** 17 of the 18 configured 3D models and 52 of 53 splats do not exist. The one that does is a point cloud (7.6).
22. **The four music tracks have no recorded licence**, and two carry other artists' tags (7.3). Two sound effects are never played.
23. **No record shows a native speaker has read the non-English text.** The record says so of the later pages (`docs/language/pages-rest.md:808`), of the strings the integration brought (`docs/language/HUMAN-REVIEW.md:30`) and of the trivia and story translations (`docs/language/CONTENT-PROVENANCE.md:17`).
    - The written opponent's verses in every language were held to their form by code only: "Whether they scan, rhyme to a native ear, and are funny rather than odd is exactly what the tools cannot say" (`docs/language/HUMAN-REVIEW.md:5`).
    - Seven languages have no published translation of the card lines and play quote challenges in English (6.4).
    - HUMAN-REVIEW.md lists 28 open questions for a reader, for example Chinese 双手 as the only way to score the relic word "hand" (item 27).
24. **Story text contradicts its own data.** "A Capulet servant" is played by Tybalt, and the Ghost's scene by Claudius (6.5).

**Accessibility and presentation** (section 8)

25. **Motion.** No reduced-motion support, while animations run on every page.
26. **Keyboard.** The desktop Play and Explore menus open on hover only, so a keyboard user cannot open them.
27. **Screen readers.** The verdict has no `aria-live`.
28. **Contrast and theme.** Contrast has not been measured. The site is dark only.
29. **Fonts.** They are latin and latin-ext subsets that stop short of most Vietnamese tone-marked letters (7.7).
30. **Speech.** Speech recognition outside English is untested. The voice speaks English only and is off by default (8, 7.4).

**Online and accounts**

31. **Online is English only, by decision** (CLAUDE.md:134-139).
    - Browsers whose Unicode tables are older than the server's "were not tested" (CLAUDE.md:150-151).
    - There is no rating, no chat, no block or mute.
    - Reports are stored and never read.
    - A teen account can be paired with any adult stranger (5.7).
32. **Email-only accounts cannot sign in while email is off** (no the email-service key) (CLAUDE.md:314-318).
33. **A lost passkey cannot be recovered without email.** The sign-in panel says so: "If you lose the passkey, we cannot let you back in" (`src/i18n/locales/en.ts:86`).

**Engineering items a player could feel**

34. **Untested economy.** No backend economy module has tests (5.9).
35. **A possible type error.** `src/lib/inventory.ts:60` writes a `state` field that its type does not have, a leftover of the NFT code (the list that ends section 5). Whether the frontend type-checks was not checked.

## 11. What could not be determined

Each section ends with its own list. Gathered here:

- **Production.** Nothing was asked of the live site or its database:
  - whether any season, season reward, tournament, listing, referral, report or credit balance exists;
  - whether `LAUNCH_DATE` is set, and so whether the 500-credit founding refill reaches anyone;
  - how many accounts exist or have uploaded their collections;
  - what is served at the missing 3D-model paths.
- **Running behaviour.** Nothing was built, tested or opened in a browser, so the following were not observed:
  - whether the frontend type-checks;
  - whether the tests pass at this commit;
  - how the art reads at card size;
  - how screens look, beyond what the code says;
  - how a variant with a missing image renders.
- **Authorship and licences:**
  - who wrote the written opponent's verses (in every language) and the "game's own" lines;
  - where the music, the sound effects and the two 3D files came from, and under what licence;
  - whether the FLUX Kommunity License suits the use.
- **Decisions not recorded:**
  - whether story mode, house allegiance, streaks, weekly events, draft mode and referral were deferred or dropped;
  - whether the 10,000 and 100 tiers were dropped by decision;
  - whether Devon Glover has reviewed or approved anything, or whether the SM-001 art is meant to depict him.
- **Quality that no tool measured:**
  - speech recognition outside English;
  - which device voices a player has;
  - colour contrast;
  - screen-reader behaviour;
  - whether the non-English verse reads well to a native speaker.
