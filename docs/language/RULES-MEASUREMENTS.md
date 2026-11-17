# What the verse rules' thresholds were set from

Every threshold the copy rule, the substance floor and the multiplier use was set from a
measurement, and `src/lib/verse/review.test.ts` asserts it, with the probes of both independent
reviews as tests. That file prints each measurement as a
`MEASURE` line; the figures below are one run (branch `fix/rules-findings`, 2026-11-16, on the
build hosts through `rb`, `npx vitest run`). The test sources are the game's own verses (every
written bank, spare verse and acrostic of the sixteen packs), the published poems of the phonetics
corpora (`src/lib/verse/sound/corpus/*.json`, from Wikisource), the quotations on the 71 cards, and
mechanically generated inputs (fixed seeds).

## Copying (review finding 24)

**Measure** (`text.ts copyOf`), from both sides. The player's content words (not the language's
little words: English `STOP_WORDS`, the other languages `function-words/<lang>.ts` from
stopwords-iso) that follow the opponent's verse in order: a longest common subsequence in which two
neighbours swapped still match, each line of the player's verse against the whole source, its lines
run together, and each source word taken once. Words are folded (case, accents, punctuation), and a
changed ending does not make a word new: English by a small stemmer (plural, past, -ing, -eth/-est,
possessive, applied until nothing more comes off), the other spaced languages when both words have
five letters or more and differ only in the shorter one's last two letters ("noche"/"noches",
"Nacht"/"Nächte"). Chinese, Japanese and Thai are read in the source's own words first (the longest
source word at each point), then by the engine's segmentation (kuromoji for Japanese). From that:

- `share` = taken / (taken + own): how much of the player's verse is the opponent's (`own` is the
  player's content words the source does not have, each counted once however often said);
- `coverage` = taken / the source's content words: how much of the opponent's verse the player's
  carries, in order. Words added to every line leave it whole, which `share` cannot see (the second
  review's probe Q1: two plain words before each line's last word, share 0.57 to 0.65);
- `anyOrder`: the source's content words said in any order (in Chinese, its characters, since a
  shuffled line is cut into other words; not in Japanese or Thai, whose kana and letters two honest
  verses mostly share);
- `perLine`: words each line takes in order; `ends`: lines that end on the word the source's line in
  the same place ends on (in Chinese and Japanese a final Han character), the rhymes a copy keeps.

**Rule** (`duel.ts isCopy`): a copy takes more than three content words in order
(`COPY_MIN_TAKEN` = 4; the Riposte asks for two or three) and has `share` >= `COPY_THRESHOLD` = 0.7,
or `coverage` >= `COPY_COVERAGE_ALONE` = 0.9, or `coverage` >= `COPY_COVERAGE` = 0.85 with two or
more words taken in each of two lines, or `coverage` >= `COPY_COVERAGE_ENDS` = 0.6 so laid out with
two line ends kept in place; or says `anyOrder` >= 0.9 of the source (four words or more); or has no
content word of its own and takes two. A verse with fewer than four content words taken is measured
again on all its words, little ones included, by the same rules. The old rule that one identical
line of three words scored 1 is gone: it voided a fair riposte ("Thy verse is dull / Say thou, whose
own is null").

**Where the thresholds come from** (`review.test.ts`, run of 2026-11-16 on the Studio):

| | coverage, highest | any order, highest |
|---|---|---|
| honest pairs, all 16 languages (13,148; 896 sharing a whole line by construction left out) | 0.667 (ja), 0.6 (vi), 0.571 (id), 0.545 (th), 0.417 (de), others 0.3 or less | 0.667 |
| ripostes: two or three words thrown back into another pack verse (1,003), and the checker's | 0.8 (a verse of five content words, three thrown back and one said by chance) | 0.8 |
| copies with words added to every line (one to four, before the last word or spread), lines reversed and filled | 0.8 at the lowest, 0.85 or more but for a handful, all with two lines taking two words or more | |
| the checker's P7 fair answer "Thy verse is dull? So says the fool / Whose hollow skull..." | 0.8, two lines taking two each, no line end kept | |

So 0.85 with words in two lines, 0.9 however laid out, and 0.6 only with two line ends kept in place,
which none of the honest pairs or ripostes has: in 13,148 pairs and 1,003 ripostes none is void.

**Mechanical copies** (every language, seeds 1 to 40, three rounds; in English a deck of each of the
14 houses): a filler of the language between every two words, punctuation, case, lines reversed,
neighbours swapped, a word dropped from each line, one, two or three words of the language added to
every line, four spread through it, lines reversed and two added, each line's words reversed but its
first and last (with and without two added), and in English an "s" on every third or every content
word, with one word added. **0 escaped** (lowest content-word shares: filler 0.857, add-three 0.143,
spread-four 0.111: the coverage rules void them).

**The checker's probes as tests**: Q1 (the opponent's verse with 0, 1, 2 or 3 plain words before
each line's last word, 14 houses x 20 seeds x 3 rounds, rule judge): 0 of 3,360 escaped, 0 won (it
was 812 escaped and 596 won with two words). P24 (40 seeds, Riposte deck, en/es/fr/de: one or two
words added a line, scrambled with and without two added, inflected with and without one added):
0 escaped, 0 won (it was 39-40 of 40 won with two words, 10 of 40 with one in es and fr).

**Not void, measured:** a copy that drops a word of every line and adds one or two of its own
(English, 14 houses x 20 seeds x 3 rounds x 2): 1,610 of 1,680 void, **33 won (2.0%)**; the test
asserts at most 5%. Below 0.6 coverage with its line ends changed it is as far from the source as
the honest answers that throw words back, and is not voided.

**Penalty.** A copy scores 0 craft and gives all four judge criteria to the other side (24-0).
Without the forfeit, two identical verses split the judge 12-12 and the tie went to the player,
which is how pasting the opponent's verse won (the finding); with craft 0 alone a copy would still
take half the judge.

**Not covered:** the copy check compares with the opponent's verse of this round only. A verse of the
written bank seen in an earlier round or duel can be pasted (it is not the verse it answers); see
the report's open items.

## Degenerate verses (finding 25)

**The floor** (`text.ts substance`) counts words of the language where the engine has a lexicon
loaded for the duel: English, Chinese (Unihan and CC-CEDICT readings of each character) and
Japanese (kuromoji's dictionary: a character counts when the word it is part of is known, and a word
in katakana counts, the script of loanwords: スマホ, インフルエンサー). The English lexicon is the CMU
table less what a dictionary of words does not list: the 179 entries said letter by letter ("cd",
"tv"), and since the second review the 76,233 that SCOWL 2020.12.07 (size 60) does not list, which
are names, abbreviations said as words ("dr", "mt", "oz") and fragments ("ul", "fsi"); the game's
own words always count (`scripts/build-pronunciation.mjs`, mark "^"). Of the 147 two-letter strings
the CMU table lists that are not stop words, 37 remain words (ah, oh, ha, ox, ma, pa, ...); of the 1,427 of three letters, 565. The floor
needs `MIN_KNOWN_SHARE` = 0.6 of the verse to be words; form points scale down below
`FULL_KNOWN_SHARE` = 0.7. The other languages' sound tables are not lexicons, measured on published
verse: a couplet of Pushkin's had a third of its words in the Russian stress table (0.333), one of
Busch's half of them in the German table (0.5), Boileau 0.6 in the French one; the Spanish, Italian,
Portuguese, Hindi and Indonesian tables list only the words their spelling rule gets wrong. In those
languages every word counts, as before.

**Telling words.** Real two- and three-letter words still lay out any form ("ah oh / ah oh ha / ah oh
ha ox"; "gum bet pig / bar yap ray ace"). Form points therefore also scale with the verse's different
telling words (`isTellingWord`: a content word of the language's lexicon, in English of four letters
or more), `TELLING_PER_LINE` = 0.5 a line, where lines are counted in words (in Chinese the segmenter
cuts classical verse into single characters, so there only the lexicon counts). The honest verse
closest to it is the fixture "I rise / I rise again / I rise again and louder" (two in three lines,
0.67); every pack verse in 16 languages is at 1 or more except Hindi's lowest at 0.33 under a length
rule, which is why only English has one. The multiplier's substance counts the same telling words.

| Lowest share of real words | en | zh | ja | others |
|---|---|---|---|---|
| any honest pack verse | 0.96 | 1 | 1 | 1 |
| published couplets (corpora) | (no corpus) | 0.93 | (no corpus) | 1 |
| the quotations on the 71 cards | 0.83 | | | |
| the checker's honest verses (slang, archaic, Kreyòl names) | 0.71 to 1, all 20 form points | | loanword verses 1 | |

**Multipliers** (`duel.ts scoreVerse`). A multiplier's bonuses scale with the verse's own telling
words beyond those that land its device and its signature, `OWN_WORDS_PER_LINE` = 1.5 a line the
form asks for. "Dare / Dare me / Dare me, who dares": multiplier 1, craft 20 (it was 45). Cost to
honest verses: of 900 written-opponent rounds (seeds 1 to 300), 49 landed a device or a signature and
none multiplied less than in full.

**Acceptance** (round 1 against the written opponent, rule judge):

| Probe | rounds | won | wordplay taken | most craft |
|---|---|---|---|---|
| the first review's seven probes (wa/ib/tc, ab/ab cd, zz/zz yy, ab cd ga, the Macbeth chant, in their forms and any form) | 100 each | 0 | 0 | 0 (the chant 20) |
| P25: tokens the CMU table lists (2 letters, 3 letters, both), the best of 150 by the live score, 14 houses x 40 seeds | 1,680 | 0 (it was 311) | 0 | 0 |
| Q4: one try a round, two-letter tokens | 560 | 0 (it was 67) | | |
| Q4 hand-made ("mt ti / oz ax / om lu / ni ha", "ab ed / ab ed ma / ab ed ma ti", ...) and real short words ("ah oh / ah oh ha", "gum bet pig / ...") | | | | 0 each, multiplier 1 |

Generated families, each in every one of the 14 houses, 100 seeds each: random letter pairs,
keyboard mash, one word repeated with one change per line, any two-letter tokens. The worst: one word
repeated, Illyria 4 of 100, The Tempest 2; no other above 1; wordplay never taken. Without the English
table loaded (a failed fetch), every string counts as a word, but tokens of two letters still earn no
form points: they tell nothing (the checker's Pa2, now a test).

## The rule judge's wit (concern)

Wit compares words thrown back only when both verses answered one (a model wrote the opponent's
verse to the player's last); otherwise both are compared on what both can do, their lines that end
in a question or an outcry. Honest verses (another pack verse of the round's form) against the
written opponent, seeds 1 to 200, three rounds each, rule judge:

| | player's rounds | player's matches | wit to player / opponent / split |
|---|---|---|---|
| before (one-sided) | 64.8% | 73.5% | 94 / 54 / 452 |
| after | 62.7% | 72.0% | 1 / 5 / 594 |

(Second run, after the second review's rule changes; the first run gave 65.5/74.5 and 63.2/73.0.)

Wit now rarely decides a written-opponent round (the bank's verses seldom end in "?" or "!"), and
the player's edge from it is gone; the player still wins most rounds, by craft and the tie rule.
The second review observed that this all but removes the criterion where the opponent cannot answer.
It is left so: a comeback needs something to come back at, and a feature both sides always have
(lines that address the other, say) needs per-language word lists the repository does not have yet.
Throwing words back still scores, through the Riposte device's multiplier.

## Smaller measurements

- Signatures landed by accident by the 50 English bank verses: Mercutio 1, Puck 2, Banquo 2, every
  other card 0; Viola (now the phrase "not what") 0.
- `cleanVerse(cleanVerse(x)) === cleanVerse(x)` for 20,000 generated strings (seed 20261116: many
  scripts, look-alikes, combining marks, invisible and blank characters, every line break, strings
  over the length cap): no failure.

## The English pronunciation table and the battle page's bytes (concern)

`tests/battle-bytes.spec.ts`, each case in a fresh browser context, body bytes of every response
as the page received them (the Japanese dictionary is served gzip-encoded, so its body figures are
decoded sizes). Built site (`npm run build`, `astro preview`), M4 build host, 2026-11-16, after the
second review (the table grew by its "^" marks). With `BYTES_OUT` set the test writes every path,
and `scripts/compressed-bytes.mjs` gives what those files weigh as a compressing server would send
them: files already compressed (the dictionary's `.gz`, images, audio) as they are, the rest at gzip
level 9 and brotli quality 11. One response of 2,841 bytes in each case is not a file of the build.

| | body bytes | responses | gzip | brotli | pron-en fetched |
|---|---|---|---|---|---|
| a visitor who never starts a duel | 1,680,598 | 38 | 1,393,075 | 1,375,233 | no |
| a Japanese duel (written opponent) | 62,168,594 | 71 | 23,137,733 | 23,011,151 | no |
| an English duel (written opponent) | 7,786,974 | 49 | 5,922,619 | 5,711,638 | yes (1,537,707 body) |

The Japanese duel's 23 MB compressed is the kuromoji dictionary (twelve files, 17.8 MB as fetched)
and its analyser: lang/phonetics' choice, which this branch merged and did not change. `/battle` used
to call `loadPronunciation()` at start-up for every visitor; the table now comes with an English duel
only (`start()` and `DuelSession.beginRound` through `loadSound`).

## Mutation runs

First pass: each defence broken in turn, on a build host (22 mutations): every one turned at least
one test red. Two first survived (each source word taken once; the function-word lists) and got
tests of their own, which then went red.

Second pass (iMac, 2026-11-16), each new defence broken alone, the tests meant to catch it run:

| broken | went red |
|---|---|
| copy: the share rule alone (no coverage rules) | P24 |
| copy: no line-ends rule | the drop-a-word-and-add test (wins above 5%) |
| copy: Chinese any-order by words, not characters | every mechanical copy (Chinese, scrambled and filled) |
| copy: the English stem applied once, not until nothing comes off | the threshold test (its stemmer assertion, added after this mutation first survived) |
| lexicon: SCOWL's marks ignored | the English lexicon test |
| form points: no telling-word scale | Q4, Pa2 |
| lexicon and telling words both off | P25 |
| Japanese: katakana words not counted | Pa (the loanword verses) |
| compare path: lines left out of verse A again | the hide probe (compare) and the prompt test |
| grade path: no rules-only guard | the hide probe (grade) |
| judge filter: Vietnamese tones folded | Q2 and R1 |
| judge filter: Korean numbers of one syllable read | Q2 and R1, P29b |
| judge filter: hyphenated words not split | P29a |
| judge filter: no judge-word-and-number pair across languages | P29a |
| judge filter: no number after a colon | P29a |

The stemmer first survived: the line-ends rule voids the checker's inflected copies on its own. It got
a test of its own ("The stages are limpings..." carries all of "The stage is limping...").
