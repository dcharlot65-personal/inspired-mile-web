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
run 3 (digits glued to letters were dropped). `scripts/voice/edge-texts.txt` began as 40 texts of
that kind: the check's four sentences first, word for word, then decades, times, text-speak, Roman
numerals and a minus sign, including some the new reading is expected to get wrong (911 as a
number; "Elizabeth I ruled", where the I stays a pronoun). They were committed (8f84b8e2) before
either reading of any of them was heard; 27 more followed on 2026-11-20 (below), the same way. Both readings are made and transcribed exactly as above
(`measure.mjs --texts`), and scored two ways: as written, and in spoken form, the text and both
transcripts first put through `g2p-en.ts` `normalise()`, so that Whisper writing "10pm" for
"ten p.m." is not an error. The same function for the text and both readings.

**Margin**, written before the run: in spoken form the new WER may exceed the old by at most
1.0 point, as for running text; every text where it is worse is listed.

**Second pass (2026-11-20).** The second independent check found that the first pass's numeral
rule read the pronoun I as a number before a contraction or a capitalised word ("Mary I'm yours"
was "Mary the first'm yours", "Round I'm winning" "Round one'm", "MARY I LOVE YOU" "MARY the first
LOVE YOU"), and a single C or D after a part's name as a number ("Part C" "Part one hundred"); that
the time rule took "am" across a line break and the verb "am" after a count as a time ("Round 2 am
I winning?" "two A M I"); and that an emoji inside English was silent where eSpeak NG named it.
27 texts were added to the end of `scripts/voice/edge-texts.txt`: the check's fourteen edge texts
and its five lines of contractions, word for word, then eight for this pass's rules (a lone I that
is a number, C/D/L/M after a part's name, "an IV", "am" the verb and the time, three with emoji).
They were committed before either reading of any of them was heard, and all 67 texts are measured
again with the same models and settings. **Margin**, written before that run: in spoken form the
new WER may exceed the old by at most 1.0 point, for all 67 texts and for the 27 new ones on their
own; every text where it is worse is listed. The spoken form names emoji now (`normalise()` does),
so for the three emoji texts the reference holds CLDR's name without a skin tone, and any word
eSpeak NG says beyond it (a tone) counts against the old reading: those three are named with the
results.

<!-- edge -->
Run of 2026-11-21 on v26.13.1, 67 texts (`scripts/voice/edge-texts.txt`), 8 minutes; the same models and settings as above.

| Scored | Words | WER old (eSpeak) | WER new | New − old (points) | 95% interval (paired bootstrap) |
|---|---:|---:|---:|---:|---|
| as written (Whisper's "10pm" against "ten p.m." counts as an error) | 512 | 18.75% | 15.43% | −3.32 | −6.56 to +0.00 |
| **in spoken form** (text and both transcripts through the same normaliser) | 596 | 11.07% | 4.19% | −6.88 | −10.23 to −3.87 |
| **in spoken form, the 27 added on 2026-11-20** (27 texts) | 240 | 12.92% | 4.58% | −8.33 | −13.98 to −3.43 |

In spoken form the new reading is heard better in 18 texts, worse in 1, the same in 48. Every text, with what Whisper heard (errors in spoken form, old → new):

| Text | Old (eSpeak) heard | New heard | Errors |
|---|---|---|---:|
| Back in the 90s we were young. | Back in the 90s, we were young. | Back in the 90s, we were young. | 0 → 0 |
| My mp3 plays at 3am. | My MP3 plays at 3am. | My MP3 plays at 3am. | 0 → 0 |
| In the 1990s the B2K crew. | In the 1990s, the B2K crew. | In the 1990s, the B2K crew. | 0 → 0 |
| At 10pm I rhyme like 2pac, 4ever. | At 10pm I rhyme like 2 pack forever. | At 10pm I rhyme like 2 pack forever. | 1 → 1 |
| This beat is gr8, my m8. | This beat is GR8, my M8. | This beat is great, my mate. | 4 → 1 |
| The K9 unit barks at the top 10s. | The K9 unit box at the top 10s. | The K9 unit box at the top 10s. | 1 → 1 |
| Richard III limps across the stage, Henry V roars. | Richard Roman III, limps across the stage, Henry V. Rawls. | Richard III limps across the stage, Henry V. Rawls. | 3 → 1 |
| Henry VIII had 6 wives and no regrets. | Henry Roman 8 had six wives and no regrets. | Henry VIII had six wives and no regrets. | 2 → 0 |
| At 3:30 p.m. the curtain rose on Act I. | At 330 pm, the curtain rose on act I. | At 330 pm, the curtain rose on Act 1. | 5 → 4 |
| Act II, Scene iv: the lovers meet. | Act Room 2, Scene Room 4, The Lovers Meet. | Act 2 Scene 4 The Lovers Meet | 2 → 0 |
| The temperature fell to -5 by 7 AM. | The temperature fell to minus 5 by 7am. | The temperature fell to minus 5 by 7am. | 0 → 0 |
| One billion is 1e9, give or take. | 1 billion is 1 E9 give or take | 1 billion is 1 E9. Give or take. | 0 → 0 |
| The clock struck 12 and I was gone by 1. | The clock struck 12 and I was gone by one. | The clock struck 12 and I was gone by one. | 0 → 0 |
| I spit 16 bars in 3 minutes flat. | I spit 16 bars in three minutes flat. | I spit 16 bars in three minutes flat. | 0 → 0 |
| My rhymes are worth $5.50 and yours are worth 0. | My rhymes are worth $5.50 and yours are worth zero. | My rhymes are worth $5.50 and yours are worth zero. | 0 → 0 |
| Room 101, floor 23, the 4th door on the left. | Room 101, floor 23, the fourth door on the left. | Room 101, floor 23, the fourth door on the left. | 0 → 0 |
| In the 2020s we stream, in the 1920s they swung. | In the 2020s, we stream in the 1920s they swung. | In the 2020s, we stream in the 1920s they swung. | 0 → 0 |
| Call me l8r, I gotta go 2day. | Call me L-8R. I got to go to day. | Call me later. I got to go today. | 7 → 2 |
| R2D2 beeps while the droid rolls on. | R2D2 beeps while the droid rolls on. | R2D2 beeps while the droid rolls on. | 0 → 0 |
| Y2K came and went in 1999. | Y2K came and went in 1999. | Y2K came and went in 1999. | 0 → 0 |
| COVID-19 kept us home in 2020. | COVID-19 kept us home in 2020. | COVID-19 kept us home in 2020. | 0 → 0 |
| Sonnet XVIII is the one with the summer day. | Sonnet Roman 18 is the one with the summer day. | Sonnet 18 is the one with the summer day. | 1 → 0 |
| World War II ended in 1945. | World War II ended in 1945. | World War II ended in 1945. | 0 → 0 |
| Pope John Paul II spoke 8 languages. | Pope John Paul Rheumann II spoke eight languages. | Pope John Paul II spoke eight languages. | 2 → 0 |
| Elizabeth I ruled for 44 years. | Elizabeth I ruled for 44 years. | Elizabeth I ruled for 44 years. | 0 → 0 |
| Louis XIV built a palace of mirrors. | Louis Roman 14 built a palace of mirrors. | Lewis XIV built a palace of mirrors. | 2 → 3 **worse** |
| Chapter 11 and Chapter XII close the book. | Chapter 11 and Chapter 12 closed the book. | Chapter 11 and Chapter 12 closed the book. | 1 → 1 |
| He won 3-0 in round 2. | He won 3-0 in round 2. | He won three to zero in round two. | 0 → 0 |
| At 6 a.m. I write, at 11 p.m. I fight. | At 6am, I write at 11pm, I fight. | At 6am, I write at 11pm, I fight. | 0 → 0 |
| Agent 007 drives a DB5. | Agent 007 drives a DB5. | Agent 007 drives a DB5. | 0 → 0 |
| Malcolm X said it plain. | Malcolm X said it plain. | Malcolm X said it plain. | 0 → 0 |
| One step 4ward, 2 steps back. | One step forward, two steps back. | One step forward, two steps back. | 0 → 0 |
| Some1 call 911. | Some one call 911. | Someone call 911. | 2 → 0 |
| The 1800s gave us steam, the 1900s gave us flight. | The 1800s gave us steam, the 1900s gave us flight. | The 1800s gave us steam, the 1900s gave us flight. | 0 → 0 |
| I got 99 problems and a verse is not 1. | I got 99 problems and a verse is not one. | I got 99 problems and a verse is not one. | 0 → 0 |
| Count it down: 3, 2, 1, go! | Count it down 3-2-1 Go | Count it down 3, 2, 1, go. | 2 → 0 |
| In 1600 the Globe was new. | In 1600, the globe was new. | In 1600, the globe was new. | 0 → 0 |
| Ten past 10 on the 10th of May. | 10 past 10 on the 10th of May. | 10 past 10 on the 10th of May. | 0 → 0 |
| Henry VI, Part 2, is rarely played. | Henry VI Part II is rarely played. | Henry VI Part II is rarely played. | 0 → 0 |
| My score went up 100% in 24 hours. | My score went up 100% in 24 hours. | My score went up 100% in 24 hours. | 0 → 0 |
| Mary I'm yours, and John I'll never be. | Mary, I'm yours and John, I'll never be. | Mary, I'm yours and John, I'll never be. | 0 → 0 |
| War I'm waging on your feeble rhymes. | War I'm waging on your feeble rhymes. | War I'm waging on your feeble rhymes. | 0 → 0 |
| Listen Peter I've got the crown tonight. | Listen Peter, I've got the crown tonight. | Listen Peter Ive got the crown tonight. | 0 → 0 |
| Innocent I'm not, but guilty I will never be. | Innocent I'm not, but guilty I will never be. | Innocent I'm not, but guilty I will never be. | 0 → 0 |
| Part C of the plan is where you fall. | Part C of the plan is where you fall. | Part C of the plan is where you fall. | 0 → 0 |
| Love you Mary XX, signed with a kiss. | Love you Mary Roman 20 signed with a kiss. | Love You Mary XX, signed with a kiss. | 2 → 0 |
| MARY I LOVE YOU, HEAR ME SHOUT. | Mary, I love you. Hear me shout. | Mary, I love you. Hear me shout. | 0 → 0 |
| Back in the 90s, at 10pm, I played my mp3. | Back in the 90s, at 10 pm, I played my MP3. | Back in the 90s, at 10pm, I played my MP3. | 0 → 0 |
| I rhyme like 2pac, gr8 and 4ever. | I rhyme like 2 pack, GR8 and 4 ever. | I rhyme like two pack, great and forever. | 5 → 2 |
| Henry VIII had six wives, Richard III one crown. | Henry Roman 8 had six wives, Richard Roman 3-1 Crown. | Henry VIII had six wives, Richard III I crown. | 5 → 1 |
| Call 911 at 3:30am. | Call 911 at 3.30am. | Call 911 at 330 AM. | 4 → 4 |
| In the 1990s the B2K crew ruled. | In the 1990s, the B2K crew ruled. | In the 1990s, the B2K crew ruled. | 0 → 0 |
| I 💀 you with every line. | I skull you with every line. | I skull you with every line. | 0 → 0 |
| Act III, Scene ii: the duel begins. | Act Room 3 Scene Room 2, the duel begins. | Act 3 seemed to, the duel begins. | 2 → 2 |
| John I'm the one who rules this stage. | John I'm the one who rules the stage. | John Eime, the one who rules this stage. | 1 → 1 |
| Round I'm winning, round I'm sure. | Round I'm winning, round I'm sure. | Round I'm winning, round I'm sure. | 0 → 0 |
| Victor I'd rather die than lose to you. | Victor, I'd rather die than lose to you. | Victor I'd rather die than lose to you. | 0 → 0 |
| Peter I'll take your crown and keep it. | Peter, I'll take your crown and keep it. | Peter, I'll take your crown and keep it. | 0 → 0 |
| Mary I'm yours, forever and a day. | Mary I'm Yours forever and a day. | Mary I'm Yours forever and a day. | 0 → 0 |
| Charles I'm sure the War I'm waging is lost. | Charles, I'm sure the war I'm waging is lost. | Charles I'm sure the war I'm waging is lost. | 0 → 0 |
| Section D is mine, and Level M is yours. | Section D is mine and level M is yours. | Section D is mine and Level M is yours. | 0 → 0 |
| Henry I of England, then Mary I and Philip II. | Henry I of England, then Mary I and Philip Roman II. | Henry I of England, then Mary I and Philip II. | 2 → 0 |
| An IV bag hangs above the bed. | and Roman IV bag hangs above the bed. | an IV bag hangs above the bed. | 3 → 0 |
| Round 2 am I winning? At 7 am I woke. | Round two, A-M-I winning at seven A-M-I woke. | Round two, am I winning at 7am my woke? | 2 → 1 |
| It's 3 am I can't sleep, by 6 pm I fight. | It's 3am I can't sleep by 6pm I fight. | It's 3am I can't sleep by 6pm I fight. | 0 → 0 |
| 🔥🔥 my verse burns, 👍🏽 to that. | Fire fire my verse burns, thumbs medium to that. | Fire fire my verse burns, thumbs up to that. | 1 → 0 |
| The 🇺🇸 flag and the 👩🏾‍🚀 in the sky. | The United States flag and the woman medium dark rocket in the sky. | the flag-united states flag and the woman astronaut in the sky. | 4 → 0 |
<!-- /edge -->

**Against the margins (2026-11-21, 67 texts):** in spoken form −6.88 points (95% interval −10.23
to −3.87) for all 67, and −8.33 (−13.98 to −3.43) for the 27 added for the second pass, each against
+1.0: within, and both intervals wholly below zero. The one text heard worse is still "Louis XIV"
(the CMU table's first reading of Louis, L UW1 IY0, heard as "Lewis"). The check's contraction lines
("Mary I'm yours, and John I'll never be.", "War I'm waging…", "MARY I LOVE YOU…") are heard as the
old reading's are, where the first pass's code made Whisper hear "Mary the First Mewers" and
"Mary the first love you"; "Part C of the plan" is heard as written, not "Part 100". Most of the
gain is the Roman numerals, which eSpeak NG reads with the word "Roman" ("Henry Roman 8", "Act Room
2", "and Roman IV bag"), text-speak (gr8, l8r, 2day) and the emoji: eSpeak NG says the skin tone
("thumbs medium", "woman medium dark rocket"), which CLDR's names without the tone count against.
Those three emoji texts are 5 of eSpeak NG's 66 errors in spoken form (and none of the new
reading's 25); without them, 10.72% against 4.39%. Phoneme agreement with eSpeak NG on the edge texts' words:
of the 227 distinct words read from the table, 91.63% identical, a phoneme error rate of 2.40%, the
same main stress in 99.12%; the few spelt and rule-read ones (5 words) are not a fair comparison.

Two runs. Run 1 (commit 0a61b775) showed "Love you Mary XX, signed with a kiss." read as "Mary the
twentieth" (Whisper heard "Mary the 20th"): the numeral rule left X's alone as kisses after other
words but not after a king's name. Spoken form scored that text right, because the reference goes
through the same normaliser, which then had the same fault; only the as-written score and the
transcript showed it. The rule was fixed (4384495f) and all 67 texts measured again (run 2, the
tables above). Run 2 differs from run 1 in that text only: the other 66 gave the same phonemes and
the same transcripts, old and new. Run 1's numbers: in spoken form −6.87 (−10.21 to −3.86) for all
67 and −8.30 (−13.88 to −3.43) for the 27.

What the scoring cannot tell: when Whisper writes digits ("911", "3am") both readings are scored
through the same normaliser, so "Some1 call 911" counts as right whether the voice said "nine one
one" or "nine hundred and eleven" (it says the latter; a person would say the former); and where the
normaliser itself misreads the text, as with "Mary XX" in run 1, spoken form cannot see it. The
as-written difference (−3.32, interval −6.56 to +0.00) shows the same 67 texts without that help.
"Elizabeth I ruled" keeps I as the pronoun, as designed, and Whisper still wrote "Elizabeth I".

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
