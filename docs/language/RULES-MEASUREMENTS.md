# What the verse rules' thresholds were set from

Every threshold the copy rule, the substance floor and the multiplier use was set from a
measurement, and `src/lib/verse/review.test.ts` asserts it. That file prints each measurement as a
`MEASURE` line; the figures below are one run (branch `fix/rules-findings`, 2026-11-16, on the
build hosts through `rb`, `npx vitest run`). The test sources are the game's own verses (every
written bank, spare verse and acrostic of the sixteen packs), the published poems of the phonetics
corpora (`src/lib/verse/sound/corpus/*.json`, from Wikisource), the quotations on the 71 cards, and
mechanically generated inputs (fixed seeds).

## Copying (review finding 24)

**Measure** (`text.ts copyOf`). The player's content words (not the language's little words:
English `STOP_WORDS`, the other languages `function-words/<lang>.ts` from stopwords-iso) that
follow the opponent's verse in order: a longest common subsequence in which two neighbours swapped
still match, each line of the player's verse against the whole source, its lines run together, and
each source word taken once. The share is `taken / (taken + own)`, where `own` is the player's
content words the source does not have, each counted once however often said. Words are folded
(case, accents, punctuation). Chinese, Japanese and Thai are read in the source's own words first
(the longest source word at each point), then by the engine's segmentation (kuromoji for Japanese).

The lists are stopwords-iso's, which mix in some content words (the Russian one has "ночь",
night); such a word is then not counted on either side, which can only lower a share.

**Rule** (`duel.ts isCopy`): a copy has a share of `COPY_THRESHOLD` = 0.7 or more, and either more
than three content words taken (`COPY_MIN_TAKEN` = 4; the Riposte asks for two or three) or no
content word of its own. A verse with fewer than four content words taken is measured again on all
its words, little ones included, by the same rule. The old rule that one identical line of three
words scored 1 is gone: it voided a fair riposte ("Thy verse is dull / Say thou, whose own is
null", share 0.5 now).

**Mechanical copies.** For every language, seeds 1 to 40 and all three rounds (in English with a
deck of every one of the 14 houses), the written opponent's verse was copied six ways: a filler word
of the language between every two words, punctuation changed, upper case, lines reversed, every
pair of neighbours swapped, one word dropped from each line. Every copy was void (0 escaped). The
lowest content-word share among them: filler 0.857, punctuation 0.8, case 0.8, reversed 0.8; the
swapped and dropped copies of the shortest verses fall to the all-words measure, which voids them.

**Honest pairs.** Every verse of a pack against every other, both ways, leaving out pairs that share
a whole line by construction (the spare verses are built from shared lines, and so are acrostics
made from one bank of lines). None reached 0.7:

| | en | es | fr | de | it | pt | pl | ru | ar | hi | zh | ja | ko | vi | th | id |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pairs | 2366 | 924 | 932 | 932 | 908 | 916 | 920 | 928 | 610 | 462 | 948 | 854 | 834 | 952 | 618 | 810 |
| sharing a line, left out | 84 | 68 | 60 | 60 | 84 | 76 | 72 | 64 | 40 | 0 | 44 | 16 | 36 | 40 | 32 | 60 |
| highest share | 0.5 | 0.375 | 0.375 | 0.333 | 0.375 | 0.333 | 0.286 | 0.286 | 0.231 | 0.375 | 0.4 | 0.667 | 0.286 | 0.556 | 0.5 | 0.5 |

The closest honest pair is Japanese (0.667): two verses of the pack that both say 舞台, わたし,
お前 and ただ in that order. **Ripostes**: 1,003 answers built by putting two or three of a source
verse's content words into another pack verse, in all sixteen languages, plus the checker's
examples; none void.

**Penalty.** A copy scores 0 craft and gives all four judge criteria to the other side (24-0).
Without the forfeit, two identical verses split the judge 12-12 and the tie went to the player,
which is how pasting the opponent's verse won (the finding); with craft 0 alone a copy would still
take half the judge.

## Degenerate verses (finding 25)

**The floor** (`text.ts substance`) counts words of the language where the engine has a lexicon
loaded for the duel: English (the CMU table, with the 179 entries the dictionary only spells out
letter by letter, "cd", "tv", left out), Chinese (Unihan and CC-CEDICT readings of each character)
and Japanese (kuromoji's dictionary: a character counts when the word it is part of is known). It
also needs `MIN_KNOWN_SHARE` = 0.6 of the verse to be words, and form points scale down below
`FULL_KNOWN_SHARE` = 0.7. The other languages' sound tables are not lexicons, measured on published
verse: a couplet of Pushkin's had a third of its words in the Russian stress table (0.333), one of
Busch's half of them in the German table (0.5), Boileau 0.6 in the French one; the Spanish,
Italian, Portuguese, Hindi and Indonesian tables list only the words their spelling rule gets wrong.
In those languages every word counts, as before.

| Lowest share of real words | en | zh | ja | others |
|---|---|---|---|---|
| any honest pack verse | 0.96 | 1 | 1 | 1 |
| published couplets (corpora) | (no corpus) | 0.93 | (no corpus) | 1 |
| the quotations on the 71 cards | 0.83 | | | |

**Multipliers** (`duel.ts scoreVerse`). A multiplier's bonuses scale with the verse's own content
words beyond those that land its device and its signature, `OWN_WORDS_PER_LINE` = 1.5 a line the
form asks for. "Dare / Dare me / Dare me, who dares" is its device ("dare" three times) and its
signature ("dare", "dares") and nothing else: multiplier 1, craft 20 (it was 45). Cost to honest
verses: of 900 written-opponent rounds (seeds 1 to 300), 49 landed a device or a signature and
none multiplied less than in full.

**Acceptance** (round 1 against the written opponent, rule judge, 100 rounds each):

| Probe | rounds won | wordplay taken | most craft |
|---|---|---|---|
| acrostic WIT "wa / ib / tc" | 0 | 0 | 0 |
| crescendo "ab / ab cd / ab cd ef" | 0 | 0 | 0 |
| anaphora "zz / zz yy / zz xx" | 0 | 0 | 0 |
| couplet "ab cd ga / ef gh ha" | 0 | 0 | 0 |
| Macbeth "Dare / Dare me / Dare me, who dares" (anaphora rounds) | 0 | 0 | 20 |
| "wa / ib / tc", "ab cd ga / ef gh ha" in any form | 0 | 0 | 0 |

Generated families, each in every one of the 14 houses, 100 seeds each: random letter pairs,
keyboard mash, one word repeated with one change per line, any two-letter tokens (half real
two-letter words). The worst: one word repeated, Illyria 5 of 100, The Tempest 4, Scottish Court 2;
no other above 2; wordplay never taken from a real verse. Every honest pack verse in all sixteen
languages keeps 20 form points, and so do the test fixtures (`I rise / I rise again / I rise again
and louder`, `Never fear / Never yield / Never kneel`, the haiku and couplets of the findings).

## The rule judge's wit (concern)

Wit compares words thrown back only when both verses answered one (a model wrote the opponent's
verse to the player's last); otherwise both are compared on what both can do, their lines that end
in a question or an outcry. Honest verses (another pack verse of the round's form) against the
written opponent, seeds 1 to 200, three rounds each, rule judge:

| | player's rounds | player's matches | wit to player / opponent / split |
|---|---|---|---|
| before (one-sided) | 65.5% | 74.5% | 94 / 54 / 452 |
| after | 63.2% | 73.0% | 1 / 5 / 594 |

Wit now rarely decides a written-opponent round (the bank's verses seldom end in "?" or "!"), and
the player's edge from it is gone; the player still wins most rounds, by craft and the tie rule.

## Smaller measurements

- Signatures landed by accident by the 50 English bank verses: Mercutio 1, Puck 2, Banquo 2, every
  other card 0; Viola (now the phrase "not what") 0.
- `cleanVerse(cleanVerse(x)) === cleanVerse(x)` for 20,000 generated strings (seed 20261116: many
  scripts, look-alikes, combining marks, invisible and blank characters, every line break, strings
  over the length cap): no failure.

## The English pronunciation table and the battle page's bytes (concern)

`tests/battle-bytes.spec.ts`, each case in a fresh browser context, body bytes of every response
as the page received them (the Japanese dictionary is served gzip-encoded, so its figures are
decoded sizes; PHONETICS.md gives its compressed size, 17.8 MB). Built site (`npm run build`,
`astro preview`), M4 build host:

| | bytes | responses | pron-en fetched |
|---|---|---|---|
| a visitor who never starts a duel | 1,676,994 | 38 | no |
| a Japanese duel (written opponent) | 62,164,990 | 71 | no |
| an English duel (written opponent) | 7,703,559 | 49 | yes (1,457,896) |

Before this, `/battle` called `loadPronunciation()` at start-up for every visitor. The table now
comes with an English duel only (`start()` and `DuelSession.beginRound` through `loadSound`).

## Mutation run

Each defence broken in turn, on a build host (22 mutations; the script is in the scratch notes
of 2026-11-16): every one turned at least one test red. Two first survived (each source word
taken once; the function-word lists) and got tests of their own, which then went red.
