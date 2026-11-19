# The voice without eSpeak NG: how it is heard

On 2026-11-19 the owner chose to keep the voice in this release and replace, before deployment,
what reads English for it: kokoro-js read text with the npm package `phonemizer`, an Emscripten
build of eSpeak NG (GPL-3.0-or-later). The voice now reads with `src/lib/voice/g2p-en.ts` (CMU
Pronouncing Dictionary, NRL 1976 letter-to-sound rules; CLAUDE.md "The voice"). This file is the
measurement that the new reading is not heard worse than the old one by more than a stated margin.

## Method

`scripts/voice/measure.mjs`, on the build host (Mac Studio M3 Ultra; transcripts scored by
`scripts/voice/score.mjs`). Every text of
`scripts/voice/corpus.mjs` is read twice by the same model, Kokoro-82M v1.0 (q8, voice `bm_george`,
speed 0.95, as the page uses):

- **old**: kokoro-js's own `generate(text)`, its normaliser and then eSpeak NG (`en`) through
  `phonemizer`, as the page at c22b035a did;
- **new**: `thespian-voice.ts readAloud()`: `g2p-en.ts` phonemes, Kokoro's tokenizer,
  `generate_from_ids`, the code the page runs now.

Both are resampled to 16 kHz by one filter and transcribed by the Whisper model the game ships
(`src/lib/ear.ts`: `onnx-community/whisper-base`, q8, English, transcribe). The word error rate
(WER) is word-level Levenshtein distance against the text, over lower-case words with punctuation and
apostrophes removed and hyphens split; "colour" and "color" and the like count as the same word
(Whisper writes American spelling). The 95% interval is a paired bootstrap over texts (10,000
draws, fixed seed).

The corpus:

| Category | What | Source |
|---|---|---|
| verse | every English verse the written opponent plays (34) | `packs/en.ts` `written`, `spare` |
| acrostic | every line it builds acrostics from (36) | `packs/en.ts` `acrosticLines` |
| quote | every English card quotation (71 distinct) | `cards.ts` |
| model | 60 English verses the models wrote in the stored evaluation runs | `docs/language/model-eval/cells/*.en.write.json` |
| word | 70 slang words, 30 old stage words, 100 names, each in "I say … again." | `scripts/voice/slang-and-names.txt` |

The interface says nothing aloud: the battle page speaks only the opponent's verse
(`battle.astro say(s.opponentVerse)`), so there are no interface lines to measure.

Phonemes are also compared with eSpeak NG's own, word by word, where eSpeak is a fair reference
(dictionary words of British English); for names and slang both readings are guesses, so that
comparison is shown and not relied on.

### What was tuned on, and what was not

1. **Development.** A run of the first six verses (`verse-1` to `verse-6`, the development set)
   found the little words reduced too far: unstressed "thy", "thou", "thine" were heard as "the",
   "they're", "then", and "and" as "in". Those forms and four spelling rules (bought, wanted,
   blunted, verses) were changed (commit ed80d160) and the six verses read again: new WER 9.21%
   before the change, 3.95% after, the same as the old reading's 3.95%. Nothing else in the corpus
   was looked at before run 1.
2. **Run 1** (code of ed80d160, all 401 texts; `docs/voice/measurement-run1.json`). Its losses
   showed two bugs, not matters of taste: the letter rules' "h" was never read (the NRL table
   writes it in lower case; "Haruki" came out ɛːɹˈuːkɪ), and the "etc" pattern matched the start of
   "etch" ("et cetera h"). Both were fixed (commit 29c3ea0f), each with a test.
3. **Run 2** (code of 29c3ea0f; `docs/voice/measurement-run2.json`). One more bug among its losses:
   "loveliness" (`quote-54`), which the table lacks, was heard as "linus". Taking it apart, the G2P
   tried the stem "lovelie" (e put back) before "lovely" (y for i), and "lovelie" splits into the
   listed words love + lie (lˈʌvlˌInəs). A stem the table has whole now comes before one it can only
   take apart (commit 577322e6, with a test that fails without it). That changed the phonemes of
   one text of the 401, `quote-54`, and no other.
4. **Run 3** (code of 577322e6; `docs/voice/measurement.json`), the results below.
5. **After run 3: numbers.** An independent check found digits glued to letters dropped
   ("Back in the 90s" heard as "Back in the S", "2pac", "mp3", "10pm", "B2K"): `normalise()`
   split letters from digits only after reading the numbers, and the tokenizer keeps letters
   only. None of the 401 texts holds a digit, so run 3 could not see it. The fix (commit
   d8dd3b8d) reads letters and digits written as one word before any digit alone, and adds
   decades, am/pm, a minus sign and Roman numerals after a king's or a part's name. It changes
   the phonemes of none of the 401 texts (`measurement.test.ts`), so run 3 stands for them as it
   is; the cases it covers are measured on their own, below ("Edge texts").

Nothing else that reads text changed between the runs (a262a1a9 only made the voice load the G2P
on demand). In particular the little words that runs 1 and 2 still showed misheard now and then
("thee" as "the", "thou" as "though", "thy" as "the" or "they") were left as they were: changing
them after seeing the measured set would be tuning on it. They are the first thing to try next,
on texts that are not in this corpus, and then measured again.

The 200 words were written down before either reading of them was heard (committed in 21446923 at
02:12 ET, the first reading at 02:15, the list unchanged since), and none was added to a list of
the G2P to make it pass. They are not all unseen by the voice, though, and an earlier version of
this file overstated that. 11 are named in the voice's code, tests or notes: most as the examples
its rules were written for (finna, skrrt, bussin, varlet, coxcomb, Haruki, Okonkwo, Adebayo,
Mwangi; the brief itself named finna, skrrt and varlet), and "mid" and "extra" only as ordinary
words. 19 old stage words and Shakespeare names ('tis, forsooth, prithee, methinks, wherefore,
alack, anon, hither, thither, o'er, Mercutio, Benvolio, Malvolio, Prospero, Caliban, Titania,
Oberon, Rosalind, Shylock) are in the game's own pronunciation additions
(`scripts/pronunciation-extra.txt`, written for the verse rules on 2026-11-16, before the voice
work, and unchanged by it), which the voice's table includes, so it reads them from the table.
`scripts/voice/corpus.mjs` records both groups (`HELD_OUT_SEEN`) and `held-out.test.ts` holds that
record to the sources. The results give the word measure with and without them: on the 170 words
the voice has never seen, the new reading is heard 53 times and the old 45.

`src/lib/voice/measurement.test.ts` holds this file's results to the code: every text's recorded
phonemes must be what `g2p-en.ts` gives now. Kokoro and Whisper are deterministic here (below), so
the phonemes decide what is heard, and a G2P that reads any of these texts differently is no
longer the one measured.

Runs 1 and 2, for the record (WER old, new, difference in points, 95% interval):

| Texts | Run | Old | New | New − old | Interval |
|---|---|---:|---:|---:|---|
| running text (201 texts, 2,763 words) | 1 | 5.54% | 5.94% | +0.40 | −0.48 to +1.29 |
| | 2 | 5.54% | 5.86% | +0.33 | −0.54 to +1.20 |
| the same without the six development verses (195, 2,611) | 1 | 5.63% | 6.05% | +0.42 | −0.45 to +1.35 |
| | 2 | 5.63% | 5.97% | +0.34 | −0.51 to +1.26 |
| the 200 words, the word itself heard | 1 | 58 | 65 | +7 | |
| | 2 | 58 | 65 | +7 | |

## Margin

Fixed before run 1, after the development run and nothing else (written at 07:24 UTC; run 1
started at 07:26):

- **Running text** (verses, acrostic lines, quotations, model verses): the new WER may exceed the
  old by at most **1.0 percentage point**. This is what players hear: the voice reads the
  opponent's verses, written or a model's (the card quotations are not read in play; they stand
  for more of the same English, much of it Shakespeare's). One point is about one more
  misheard word in a hundred, one every two or three verses; and with about 2,800 words a paired
  difference much smaller than a point cannot be told from the spread between texts, so a tighter
  margin could not be shown either way. The margin is on the measured difference; its 95% interval
  is reported beside it, and its upper end is above one point in every run: the data do not rule
  out a loss of a little over a point.
- **The 200 words**: the new reading may have at most **6 fewer** of the words themselves heard
  (3 points). Most are words no dictionary has, where eSpeak NG's thousands of rules and its
  exception list should do better than 329 rules from 1976; this allows a few such losses and no
  general one, and every word lost is listed below so they can be judged one by one.

## Results

<!-- tables -->
Run of 2026-11-19 on v26.13.1, 401 texts, 80 minutes. Kokoro onnx-community/Kokoro-82M-v1.0-ONNX (q8, bm_george, speed 0.95, onnxruntime-node (cpu)); Whisper onnx-community/whisper-base (q8, Transformers.js 4.3.2).

| Texts | Items | Words | WER old (eSpeak) | WER new | New − old (points) | 95% interval (paired bootstrap) |
|---|---:|---:|---:|---:|---:|---|
| verses (written opponent) | 34 | 617 | 8.43% | 8.43% | +0.00 | −2.16 to +1.98 |
| acrostic lines | 36 | 290 | 5.17% | 6.90% | +1.72 | −0.68 to +4.59 |
| card quotations | 71 | 729 | 5.90% | 6.58% | +0.69 | −1.27 to +2.72 |
| verses the models wrote | 60 | 1127 | 3.82% | 3.55% | −0.27 | −1.25 to +0.75 |
| 200 words, in "I say … again." | 200 | 802 | 25.44% | 26.18% | +0.75 | −2.00 to +3.61 |
| **running text (all but the words)** | 201 | 2763 | 5.54% | 5.79% | +0.25 | −0.60 to +1.12 |
| everything | 401 | 3565 | 10.01% | 10.38% | +0.36 | −0.55 to +1.29 |
| running text without the six development verses | 195 | 2611 | 5.63% | 5.90% | +0.27 | −0.58 to +1.15 |

The word itself heard (every part of it, spelt as written or a known variant): old 58 of 200, new 65 of 200.

| The words | Words | Heard, old | Heard, new | New − old |
|---|---:|---:|---:|---:|
| all 200 | 200 | 58 | 65 | +7 |
| not named in the voice's code, tests or notes (less 11) | 189 | 55 | 62 | +7 |
| also not in the game's own pronunciation additions (less 19 more): never seen by the voice | 170 | 45 | 53 | +8 |

**Against the margins:** running text +0.25 points (95% interval −0.60 to +1.12) against a margin of +1.0: within; words heard +7 against a margin of −6: within.

### The new reading heard against the old

The new transcript scored against the old one instead of the text: how often the two readings are heard differently at all, whichever is right.

| Texts | Words heard in the old reading | New transcript against the old (word error rate) | Texts heard word for word alike |
|---|---:|---:|---:|
| verses (written opponent) | 605 | 6.28% | 10 of 34 |
| acrostic lines | 290 | 4.48% | 27 of 36 |
| card quotations | 721 | 4.99% | 50 of 71 |
| verses the models wrote | 1128 | 2.48% | 46 of 60 |
| 200 words, in "I say … again." | 860 | 20.35% | 93 of 200 |
| **running text (all but the words)** | 2744 | 4.19% | 133 of 201 |

### Phonemes against eSpeak NG, word by word

Each distinct word of the corpus alone (citation form, both sides), eSpeak NG `en` written in misaki's symbols, stress marks set aside for the phoneme error rate.

| How the new reading found the word | Words | Same phonemes | Phoneme error rate | Same main stress | A fair reference? |
|---|---:|---:|---:|---:|---|
| in the CMU table | 926 | 87.69% | 4.47% | 98.16% | yes: both are dictionary readings of British English |
| NRL letter rules | 87 | 34.48% | 24.38% | 81.61% | no: both guess |
| a little word (weak/strong forms) | 61 | 96.72% | 1.88% | 100.00% | yes, in citation form |
| taken apart into table words | 35 | 74.29% | 7.77% | 97.14% | partly: the parts are dictionary words, eSpeak guesses the whole |
| a held sound (no vowel letter) | 1 | 0.00% | 66.67% | 0.00% | no: both guess |

### Target words heard by the old reading and not by the new

- **bougie**: old heard "I say Bougie again.", new heard "I say boozy again." (new phonemes `ˌI sˈA bˈuːʒˌiː əɡˈɛn.`, old `aɪ sˈeɪ bˈaʊdʒi ɐɡˈɛn.`)
- **wack**: old heard "I say, Wack again.", new heard "I say whack again." (new phonemes `ˌI sˈA wˈak əɡˈɛn.`, old `aɪ sˈeɪ wˈak ɐɡˈɛn.`)
- **quoth**: old heard "I say quoth again.", new heard "I say quote again." (new phonemes `ˌI sˈA kwˈQθ əɡˈɛn.`, old `aɪ sˈeɪ kwˈɒθ ɐɡˈɛn.`)
- **thither**: old heard "I say, thither again.", new heard "I say this third again." (new phonemes `ˌI sˈA ðˈɪθˌɜːɹ əɡˈɛn.`, old `aɪ sˈeɪ ðˈɪðəɹ ɐɡˈɛn.`)
- **Louverture**: old heard "I say Louverture again.", new heard "I say, Lava-Ture again." (new phonemes `ˌI sˈA lˈWvəʧəɹ əɡˈɛn.`, old `aɪ sˈeɪ lˈuːvɜːtʃəɹ ɐɡˈɛn.`)
- **Jean-Baptiste**: old heard "I say Jean-Baptiste again.", new heard "I say Gene, but pissed again." (new phonemes `ˌI sˈA ʤˈiːn bəptˈɪst əɡˈɛn.`, old `aɪ sˈeɪ dʒˈiːnbaptˈiːst ɐɡˈɛn.`)
- **Saweetie**: old heard "I say saweetie again.", new heard "I say sorry to you again." (new phonemes `ˌI sˈA sˈɔːiti əɡˈɛn.`, old `aɪ sˈeɪ sˈawiːti ɐɡˈɛn.`)
- **Guadalupe**: old heard "I say Guadalupe again.", new heard "I say Guadeloupe again." (new phonemes `ˌI sˈA ɡwˌɑːdəlˈuːp əɡˈɛn.`, old `aɪ sˈeɪ ɡwˈɑːdɐlˌuːp ɐɡˈɛn.`)
- **Priyanka**: old heard "I say Priyanka again.", new heard "I say pre-anchor again." (new phonemes `ˌI sˈA pɹɪɪˈaŋkə əɡˈɛn.`, old `aɪ sˈeɪ pɹɪjˈaŋkəɹ ɐɡˈɛn.`)
- **Haruki**: old heard "I say Haruki again.", new heard "I say hair Rookie again." (new phonemes `ˌI sˈA hɛːɹˈuːkɪ əɡˈɛn.`, old `aɪ sˈeɪ hˈɑːɹuːki ɐɡˈɛn.`)
- **Mercutio**: old heard "I say Mercutio again.", new heard "I say Macc Cusio again." (new phonemes `ˌI sˈA məkjˈuːʃiQ əɡˈɛn.`, old `aɪ sˈeɪ mɜːkjˈuːtɪˌəʊ ɐɡˈɛn.`)
- **Malvolio**: old heard "I say Malvolio again.", new heard "I say Malvolia again." (new phonemes `ˌI sˈA malvˈQliQ əɡˈɛn.`, old `aɪ sˈeɪ malvˈəʊlɪˌəʊ ɐɡˈɛn.`)
- **Hermione**: old heard "I say Hermione again.", new heard "I say Hameone again." (new phonemes `ˌI sˈA həmiˈQni əɡˈɛn.`, old `aɪ sˈeɪ hɜːmˈaɪəni ɐɡˈɛn.`)

And the other way (heard by the new reading, not the old): finna, deadass, ratchet, swole, sheesh, wherefore, zounds, perchance, yonder, Chimamanda, Amara, Keisha, Fabiola, Ketly, Eminem, Fatima, Mohammed, Agnieszka, Caliban, Perdita.

### Running texts the new reading is heard worse in

31 of 201 texts. The words of the text it loses that the old reading kept:

- verse-1 (0 → 1 errors): thy (heard "the")
- verse-5 (0 → 2 errors): leftovers (heard "overs")
- verse-6 (1 → 2 errors): thy (heard "they")
- verse-7 (2 → 3 errors): limps (heard "lips")
- verse-10 (0 → 1 errors): a (heard "of")
- verse-16 (2 → 4 errors): but (missing); a (heard "better")
- verse-24 (2 → 3 errors): i (heard "thy")
- verse-26 (2 → 3 errors): i (heard "thy")
- verse-31 (1 → 2 errors): verse (heard "diverse")
- verse-32 (0 → 1 errors): hall (heard "haul")
- verse-33 (0 → 2 errors): bitter (heard "of")
- acrostic-2 (2 → 3 errors): (the same words, heard differently)
- acrostic-3 (0 → 3 errors): one (heard "once"); undone (heard "done")
- acrostic-7 (0 → 1 errors): air (heard "earth")
- acrostic-9 (2 → 3 errors): men (heard "man")
- acrostic-23 (0 → 1 errors): openest (heard "openness")
- quote-3 (0 → 2 errors): a (missing); rose (heard "arose")
- quote-8 (0 → 1 errors): thee (heard "the")
- quote-9 (0 → 2 errors): horatio (heard "ratio")
- quote-13 (0 → 1 errors): forfeit (heard "fourth")
- quote-42 (0 → 2 errors): uneasy (heard "easy")
- quote-45 (1 → 2 errors): thou (heard "though")
- quote-46 (0 → 2 errors): mandragora (heard "gora")
- quote-48 (1 → 2 errors): vial (heard "vile")
- quote-50 (1 → 5 errors): full (missing); thy (heard "far"); father (heard "the")
- quote-60 (0 → 1 errors): thee (heard "the")
- model-12 (0 → 1 errors): the (heard "thy")
- model-31 (1 → 2 errors): over (missing)
- model-32 (2 → 3 errors): does (heard "as")
- model-33 (2 → 4 errors): sting (heard "of"); over (heard "sting"); dew (heard "overdue")
- model-53 (0 → 3 errors): shallow (missing); verse (heard "shallovers"); thee (heard "me")

Better in 28, the same in 142.
<!-- /tables -->

## Edge texts: numbers, numerals, times

The 401 texts hold no digit, so they could not show the defect the independent check found after
run 3 (digits glued to letters were dropped). `scripts/voice/edge-texts.txt` is 40 texts of that
kind: the check's four sentences first, word for word, then decades, times, text-speak, Roman
numerals and a minus sign, including some the new reading is expected to get wrong (911 as a
number; "Elizabeth I ruled", where the I stays a pronoun). It was committed (8f84b8e2) before
either reading of any of them was heard. Both readings are made and transcribed exactly as above
(`measure.mjs --texts`), and scored two ways: as written, and in spoken form, the text and both
transcripts first put through `g2p-en.ts` `normalise()`, so that Whisper writing "10pm" for
"ten p.m." is not an error. The same function for the text and both readings.

**Margin**, written before the run: in spoken form the new WER may exceed the old by at most
1.0 point, as for running text; every text where it is worse is listed.

<!-- edge -->
(not yet measured)
<!-- /edge -->

## What this does not show

- The models ran on onnxruntime-node (CPU) on the build host, not in a browser's WebAssembly
  runtime: the same weights, the same arithmetic up to the last bits, the same for both readings.
  `tests/voice.spec.ts` runs the real page path in Chromium (Kokoro speaks, Whisper must hear the
  words) on one line only; and the ear's model test (`tests/model/ear.spec.ts`), given the new
  voice saying a line as its microphone (`scripts/voice/say.mjs`), passed: the page's Whisper
  heard "all the worlds are stage to be or not to be that is the question".
- Whisper base is the listener: what it mishears is not always what a person mishears, and the
  reverse. Nobody listened to these readings for this measurement.
- One British voice (`bm_george`), the only one the game uses. The American path of `g2p-en.ts`
  exists and is not measured.
- Kokoro and Whisper are deterministic here: the first six texts of run 1 gave the same phonemes
  and the same transcripts, old and new, as the second development run of the same code; 16 texts
  (eight verses, eight words) measured again at the code of run 2 gave its phonemes and transcripts
  exactly; and run 3 gave run 2's phonemes and transcripts, old and new, for 400 of its 401
  texts: all but `quote-54`, the one text whose phonemes the fix between them changed. Run 3 took
  80 minutes against run 2's 39 because the host was under a load of 100 to 145, which changed
  nothing heard. So one run is the measurement; the interval is about texts, not repeat runs.

Raw results, every text with both phoneme strings and both transcripts: `docs/voice/measurement.json`.
Rebuild the tables with `node scripts/voice/report.mjs --write`.
