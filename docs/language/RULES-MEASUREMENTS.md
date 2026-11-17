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
  the same place ends on (no longer used by the rule: moving the lines set it to 0);
- `carry` (third pass, after the second check): every line of the source, all its words counted
  (the little ones too), against the line of the verse that says most of it in order, one verse
  line to a source line, matched largest first whatever order the verse puts its lines in: how
  many of the source line's words that verse line says, and whether its last word (the one its
  rhyme stands on) is among them.

**Rule** (`duel.ts isCopy`, third pass). A verse is a copy when any of these holds:

1. *It carries the other's lines over* (`carriesLines`): every source line of `COPY_LINE_WORDS` = 3
   words or more but one (all of them in a couplet) has `COPY_LINE_SHARE` = 0.6 of its words said in
   order by a line of the verse, its last word among them; only for a source of `COPY_LINE_SOURCE` =
   7 words or more.
2. It takes four content words or more in order (`COPY_MIN_TAKEN`) and `share` >= 0.7, or
   `coverage` >= 0.9, or `coverage` >= 0.85 with two or more words taken in each of two lines.
3. It says the source's content words in any order: `anyOrder` >= 0.9 of four or more
   (`COPY_ANY_ORDER_MIN`), with 0.7 of all its words too; or 0.9 of all the words of a source of
   seven words or more.
4. It has no content word of its own, and 0.7 of all its words, three or more, are the other's in
   order (the other verse with words deleted).

Removed in the third pass: the line-ends rule (`COPY_COVERAGE_ENDS`: line *i* ends where the
source's line *i* ends), which moving the lines defeated and which voided battle-rap flips that keep
the rhymes in place; and the second measure on all words for a verse taking fewer than four content
words (rules 3 and 4 and the line rule now read all words where they need to). The old rule that one
identical line of three words scored 1 is gone (first pass): it voided a fair riposte ("Thy verse is
dull / Say thou, whose own is null").

**Where the thresholds come from.** The line rule (third pass) from a measurement run of the
second check's probes and families (`zz-r4-copy`, a probe not kept; rows on the iMac, 2026-11-16):

| | rows | void |
|---|---|---|
| the second check's SWAP family, en/es/fr/de: one content word not ending its line dropped, 1 to 4 words put in, in place or with the lines moved as the form allows (14 houses; 20 seeds in English, 10 in the others; 3 rounds) | 18,900 | all |
| the same, dropped and 1 to 3 added, in place and moved, all 16 languages, seeds 1 to 40 | 11,520 | all but 5 (Japanese: kuromoji cuts the line again once words are put in, so its last word changes); 2 of those 5 won |
| honest pairs: every pack verse against every other, 16 languages (pairs sharing a whole line by construction left out) | 13,148 | 0 |
| ripostes: two or three of the source's words thrown back into another pack verse | 1,003 | 0 |
| the second check's published-couplet pairs that share no whole line (13 corpora) | | 4: Busch's refrain "Dieses war der erste Streich, / Doch der zweite folgt sogleich" against "...zweite... / ...dritte..." both ways, and the gurindam formula "Barang siapa mengenal ... / tahulah ia ..." twice (was 16: de 8, ru 2, id 6) |
| the second check's ripostes made from published couplets (two thrown words at the end of line 1, one at the end of line 2) | 921 | 2 (es: an answer with one content word of its own whose "Queredlas" is "queréis" by ending, 4 of the source's 4; ru: "голубушки-сестрицы" holds "сестрица", 5 of 5); was 7 at ce2cb67 (es 2, de 1, ru 2, id 2) |
| battle-rap flips (the checker's) | 4 | 1: "Your night is dark? I light the stage / Your fire is smoke on every page", five of its seven content words the other's in order (`share` 0.71, the brief's own measure; void before this pass too). The crown flip and "My rhymes are strong, and thine are weak and slow" are answers again |

The lowest share of a source line a mechanical copy keeps is 0.6 (a word of three to five dropped);
honest lines of three words or more reach it only in very short sources (the ripostes thrown at
couplets of six words, hence `COPY_LINE_SOURCE`), and a line kept with its last word changed
(Japanese pack verses "舞台はわたしの城 / お前はただの人" and "この舞台はわたしの古い庭 / お前の声はただの雑音",
which share 4 of 5 words a line) is not carried: requiring the last word took that pair out
(mutation `line-end-off` below). The coverage rules (2) from the first and second passes:

| | coverage, highest | any order, highest |
|---|---|---|
| honest pairs, all 16 languages | 0.667 (ja), 0.6 (vi), 0.571 (id), 0.545 (th), 0.417 (de), others 0.3 or less | 0.667 |
| ripostes (pack, two or three thrown back) | 0.8 (a verse of five content words, three thrown back and one said by chance) | 0.8 |
| copies with words added to every line (one to four), lines reversed and filled | 0.8 at the lowest, 0.85 or more but for a handful | |

**Mechanical copies** (every language, seeds 1 to 40, three rounds; in English a deck of each of the
14 houses): a filler of the language between every two words, punctuation, case, lines reversed,
neighbours swapped, a word dropped from each line, one, two or three words of the language added to
every line, four spread through it, lines reversed and two added, each line's words reversed but its
first and last (with and without two added), and in English an "s" on every third or every content
word, with one word added. **0 escaped** (third pass, iMac).

**The checkers' probes as tests**: Q1 (0 to 3 plain words before each line's last word, 14 houses x
20 seeds x 3 rounds): 0 of 3,360 escaped, 0 won. P24 (40 seeds, Riposte deck, en/es/fr/de): 0
escaped. The second check's SWAP (`review2.test.ts`): English 5,460 rounds, all void, 0 won (at
ce2cb67: swapDrop1Add2 0 of 588 void, 259 won; swapDrop1Add3 254 won); es/fr/de 2,646 rounds, all
void, 0 won (at ce2cb67: 164 to 198 of 294 won with two or three added). Its hand-made copies with
the Riposte deck (seed 4, the checker's text; seeds 8 and 13 made the same way): void, 0-44.

**Not void, measured:** a copy that drops a *random* word of every line, the last word too (which no
rhyming form keeps), and adds one or two (English, 14 houses x 20 seeds x 3 rounds x 2): 1,624 of
1,680 void, **42 won (2.5%)**; the test asserts at most 5%.

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
Japanese (kuromoji's dictionary: a character counts when the word it is part of is known). The
English lexicon is the CMU table less the 179 entries said letter by letter ("cd", "tv") and, among
strings of two or three letters, those SCOWL 2020.12.07 (size 60) does not list: abbreviations said
as words ("dr", "mt", "oz") and fragments ("ul", "fsi"). Third pass: a CMU entry of four letters or
more counts though SCOWL lacks it (`UNLISTED_SPAN` = 4): the names and old forms the second check
listed (Haiti, Haitian, Toussaint, Christophe, Antonio, Regan) count again. The game's own words
always count. Of the 147 two-letter strings the CMU table lists that are not stop words, 37 remain
words (ah, oh, ha, ox, ma, pa, ...). The floor needs `MIN_KNOWN_SHARE` = 0.6 of the verse to be
words; form points scale down below `FULL_KNOWN_SHARE` = 0.7.

*Words no list has, used in a sentence* (third pass, `PHRASE_SPAN` = 4): in English a word of four
letters or more that the lexicon lacks counts toward the floor when its line holds one of the
language's little words: "Shawty, I'm finna flex, my drip is too clean" is a sentence whatever the
table says of "shawty" and "finna". It still tells nothing (telling words ask the lexicon). Keyboard
mash and letter pairs have no little word between them. The second check's vernacular, archaic and
Kreyòl verses: the two hip-hop couplets 19 -> 20 form points, the Haitian-history quatrain's known
share 0.70 -> 1, the AAVE quatrain's 18 -> 20 (`zz-cr2-b`, `zz-cr2-e`, rerun at the head). Of the
checker's word lists, those the lexicon itself still lacks (they are not in the CMU table at all):
archaic 31 of 99 (sirrah, varlet, ducat, beshrew, verily, ...), vernacular 43 of 82, Kreyòl 19 of 26.

*Japanese katakana* (third pass, the second check's blocker 3). A word in katakana counts when the
sentence uses it as one: a word of the dictionary's written otherwise (a particle, an auxiliary, a
verb, a noun in kanji) stands beside it, whether the dictionary has the katakana word or not
(スマホの, インフルエンサーは, ガチで, ...のフロー); or the dictionary has it and it is the whole line
(サクラ). A run of katakana among other katakana is letters, even where the dictionary finds one of
its nouns inside (ココア, テツ). The second pass had counted any katakana run, which the check showed
let random katakana keep full form and win.

The other languages' sound tables are not lexicons, measured on published verse: a couplet of
Pushkin's had a third of its words in the Russian stress table (0.333), one of Busch's half of them
in the German table (0.5), Boileau 0.6 in the French one; the Spanish, Italian, Portuguese, Hindi
and Indonesian tables list only the words their spelling rule gets wrong. In those languages every
word counts, as before.

**Telling words.** Real two- and three-letter words still lay out any form ("ah oh / ah oh ha / ah oh
ha ox"; "gum bet pig / bar yap ray ace"). Form points therefore also scale with the verse's different
telling words (`isTellingWord`: a content word of the language's lexicon; in English of four letters
or more, or of three (`SHORT_TELLING`) in a line that holds one of the language's little words),
`TELLING_PER_LINE` = 0.5 a line, where lines are counted in words. Third pass: the second pass asked
four letters of every English telling word, so plain verse of short words lost all its form points
(the second check's blocker 2: "My cat is fat, my dog is sad / I am not bad, I am not mad", 20 on
main, 0 at ce2cb67). In a phrase three letters tell: those verses earn 20 again, and "gum bet pig /
bar yap ray ace / sun lad vat", three-letter words with nothing between them, still earns 0. The
honest verse closest to the threshold is the fixture "I rise / I rise again / I rise again and
louder" (two in three lines, 0.67).

| Lowest share of real words | en | zh | ja | others |
|---|---|---|---|---|
| any honest pack verse | 1 | 1 | 1 | 1 |
| published couplets (corpora) | (no corpus) | 0.93 | (no corpus) | 1 |
| the quotations on the 71 cards | 1 | | | |
| the checkers' honest verses (slang, archaic, Kreyòl names, short words) | 0.94 to 1, 20 form points where main gives 20 | | loanword verses 0.7 or more | |

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
| the second check's KATA (Japanese): random katakana in the round's form, the best of 60 by the live score, 14 houses x 20 seeds | 280 | 0, all void (it was 228 at ce2cb67, 10 at 709b0ba); the honest bank verse 249 | | |

Generated families, each in every one of the 14 houses, 100 seeds each: random letter pairs,
keyboard mash, one word repeated with one change per line, any two-letter tokens. The worst: one word
repeated, Illyria 4 of 100, The Tempest 2; no other above 1; wordplay never taken. Without the English
table loaded (a failed fetch), every string counts as a word, but tokens of two letters still earn no
form points: they tell nothing (the checker's Pa2, now a test).

**Not covered, measured (the second check's GIB, round 1, the best of 60, 14 houses x 10 seeds):**
random syllables in the languages without a lexicon, and random hiragana in Japanese, which
kuromoji reads as a string of real short words (particles, one-kana verbs):

| | won (of 140) | honest bank verse won |
|---|---|---|
| zh (real characters of the pack) | 43 | 99 |
| ko | 24 | 70 |
| vi | 33 | 117 |
| es | 64 | 76 |
| ru | 70 | 119 |
| ja, random hiragana | 93 | 140 |

Two Japanese measures were tried and set aside: the analyser's own path cost per letter (honest
verse up to 4,361, the pack's kana haiku "とおいこえ / みみをすませば / ただのかぜ" 3,940, random
hiragana from 3,120) and the share of lone kana that are not particles (the same haiku 0.24, random
hiragana from 0). Neither separates them.

**Salads of real words** (the second check's concern) cannot be told from asyndetic verse by form:
the English bank's own "Silver arrows, silent, deadly, bright / Sorrow, hunger, exile, bitter night"
is a list of words with nothing between them. What made salads win was the rule judge, which this
pass changed (next section): the checker's SALAD-MATCH, full matches, 14 houses x 30 seeds:

| matches won (of 420) | salad | salad with "!" on two lines | honest bank verse | honest with "!" |
|---|---|---|---|---|
| at ce2cb67 | 270 | 411 | 228 | 335 |
| now | 240 | 260 | 231 | 250 |

A salad picked as the best of 60 by the live score (so it lands its card's device far more often than
the one bank verse it is compared with) still wins 9 more matches of 420 than that verse.

## The rule judge (concerns)

**Wit** compares words thrown back only when both verses answered one (a model wrote the opponent's
verse to the player's last). Otherwise it is a split: third pass, the lines that end in "?" or "!"
no longer break the tie. The second check showed that tie-break decided wit in every first round:
an "!" on two lines lifted an honest verse from 228 to 335 matches of 420 and a salad from 270 to
411. Honest verses (another pack verse of the round's form) against the written opponent, seeds 1 to
200, three rounds each, rule judge (`review.test.ts`, third pass):

| | player's rounds | player's matches | wit to player / opponent / split |
|---|---|---|---|
| before (one-sided, as on main) | 43.8% | 42.0% | 94 / 53 / 453 |
| now | 43.7% | 44.5% | 0 / 0 / 600 |

The second pass measured 64.8% and 62.7% in this same set-up. The fall is wordplay's (below): the
player's verse here is another verse of the bank for the form, the spare verses included (short
lines, short words, nothing said twice), and with wordplay a count of different telling words those
lose it where their share of telling words used to win it. In this run wordplay went to the opponent
361 times, to the player 183, split 56; 12 of the 600 player verses were void as copies (spare verses
built from the opponent's own lines, "Mark this well, for I shall not repeat it / ..."); the
opponent's craft was 12,425 against the player's 10,846 (its card's device lands with its verse; the
player's card was not chosen for the verse). A probe, not kept (`zz-r4-wit`, M4).

**Wordplay** is the number of different telling words (up to 30). It was that number plus their
share of the verse's words, which rewarded stuffing: a salad, all content words, took wordplay from
any verse with grammar in it. Tried on the checker's SALAD-MATCH (matches of 420, salad / salad! /
honest / honest!): the share capped at 0.6: 263 / 284 / 228 / 246; capped at 0.5: 260 / 282 / 228 /
246; the count alone: 240 / 260 / 231 / 250 (all without the "!" tie-break). The count alone was kept.

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

Third pass (iMac, 2026-11-16, `zz-mutate3.sh`, a script not kept): each new defence broken alone,
the tests meant to catch it run; the baseline (the same tests, unbroken) passed, 20 of 20.

| broken | went red |
|---|---|
| copy: no line rule (carriesLines) | SWAP (en), SWAP (es/fr/de), the hand-made copies |
| copy: the line rule without the last word | no honest pair is a copy (the Japanese pack pair "舞台はわたしの城..." is flagged) |
| copy: no "nothing of its own" rule | every mechanical copy (words deleted from short verses: pt, ru) |
| copy: no any-order rule on all words | every mechanical copy (Chinese, shuffled) |
| telling: never a phrase | HONEST-EN |
| telling: always a phrase | "gum bet pig" still earns nothing |
| Japanese: any katakana a word again | KATA, the loanword test |
| rule judge: "!" breaks wit's tie again | the "!" test, SALAD-MATCH |
| rule judge: wordplay's share of words again | SALAD-MATCH |
| judge filter: English read over Polish's little words | Polish "ten" |
| lexicon: SCOWL's mark for words of four letters or more | the names test |
| floor: no phrase rule for words the lexicon lacks | the names test (its "Shawty, I'm finna flex" floor) |
| the Russian checklist's example back to "баллы" | the checklist test |

The new tests were also run against ce2cb67, the head the second check refused (M4, a throwaway
worktree with `review2.test.ts` copied in, its one test of the new `carry` measure left out): 13 of
the 14 failed; the 14th checks that every pack verse keeps its form, a guard, not a fix.
