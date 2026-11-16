# Which model writes and judges verse in which language

The game runs one of three models in the player's browser: Gemma 4 E2B, LFM3 1.7B or
LFM2.5 350M. Before this work each carried a list of languages copied from its model card,
and the game offered the model in all of them. Nothing had been measured outside English.

This page is the measurement. Its result is two lists per model in `src/lib/brain.ts`:
the languages in which the model writes the opponent's verse (`writesIn`) and those in
which it judges (`judgesIn`). In any other language the written opponent plays and the
rule-based judge decides, both of which work in all sixteen; the battle page's language
picker says so beside the language's name.

RESULTS-SUMMARY

## How it was measured

Everything was run in headless Chromium with WebGPU on the build host (Apple Metal), through
the game's own code served by its dev server: `scripts/model-eval/run.mjs`. Nothing about
judging or writing is re-implemented in the harness.

### Judging

- **Test set.** 12 pairs per language. The better verse of each pair is two to six lines of
  public-domain poetry cut from that language's Wikisource
  ([where each came from](model-eval/PROVENANCE.md)), so that "better" is not a model's
  opinion. The worse verse is constructed, three of each kind: the opening sentence of a
  Wikipedia article (prose, off the subject), two of the game's interface strings (flat),
  the excerpts' own letters shuffled (gibberish), and an instruction to the judge written in
  the language (injection).
- **Method.** `modelJudge` in `src/lib/verse/referee.ts`, the function `referee()` itself
  calls: for Gemma and LFM3 the lean between "A" and "B" read from next-token scores in both
  orders and subtracted; for LFM2.5 350M a grade of each verse on its own. The better verse is
  the player's in half the pairs and the opponent's in the other half.
- **What is counted.** Per criterion (4 per pair, 48 per language): did the verdict go to the
  better verse, split, or go to the worse one. Per pair: did the better verse get more of the
  24 judge points. Intervals are 95% Wilson intervals. The 48 criterion verdicts come from 12
  pairs and are not independent, so their interval is narrower than the evidence; the decision
  therefore rests its test against chance on the 12 pairs.

### Writing

- **Method.** `writeOpponentVerse` in `src/lib/verse/opponent.ts` with the model's `generate`,
  in duels made by `createDuel` from seeds 1001 upward with the starter deck, taking each
  round until every form offered in the language has 10 plays. Difficulty cycles
  apprentice, player, master (one, two and three drafts), so a form's 10 plays are 4, 3 and
  3 of them and 19 drafts. After a duel's first round the opponent answers a Wikisource
  excerpt in the language, as it would answer a player. No curse is cast on the opponent.
- **What is counted**, per play (one verse on the table), by the game's `scoreVerse`: whether
  the form is kept in full, form points, craft. Then, by `scripts/model-eval/lib.mjs`:
  - *in the language*: the verse's letters are in the language's script (Unicode Script
    property; Chinese is Han with no kana, Japanese has kana), and, where other languages
    share that script, the language identifier's first answer is the language. The identifier
    is fastText's `lid.176` model run locally. For Chinese, Japanese, Korean and Thai the
    script settles it. Malay is accepted for Indonesian: a short verse cannot tell them apart.
  - *commentary*: a first line ending in a colon, a line opening like a note ("Here is…",
    "Note:"), markup, or, in a language not written in Latin letters, a line of three or more
    Latin-script words (a translation or an explanation).
  - tokens per second, from the model's own tokenizer over every draft.

### The checks were made to fail first

- `MEVAL_CONTROL=same` judges pairs whose two verses are the same text. A judge that prefers
  one of them, or a harness that reports a preference, is broken. CONTROL-RESULT
- The language detector was run on real verse before any model output: the table below.
- `node scripts/model-eval/mutate.mjs` breaks the decision code, the lists and the result
  files fourteen ways and requires the tests to go red each time. MUTATE-RESULT
- The commentary check flags 2 of the 443 reference verses (both open on a line of real verse
  that ends in a colon). An earlier version that looked at every line flagged 10 and was
  narrowed.

## The thresholds

Committed in `scripts/model-eval/thresholds.json` (commit `8e92604`) before any cell was run.

A model **judges** a language when all of these hold:

1. the better verse wins so many of the 12 pairs that the 95% interval lies wholly above one
   half. That takes 10 of 12 (interval from 55%); 9 of 12 reaches down to 47%;
2. at least 70% of the 48 criterion verdicts go to the better verse;
3. no injection attempt beats a real verse. A judge that an instruction inside a verse can
   turn is not offered, however well it does otherwise;
4. every reading came from the model (none fell back to the rules).

A model **writes** in a language when all of these hold, over all the plays:

1. a usable verse came back from the model in at least 95% of plays;
2. the verse is in the language in at least 90% of plays (times the detector's own pass rate
   on real verse in that language, which is 100% in fifteen languages and 97% in Portuguese);
3. commentary in at most 10% of plays;
4. the form is kept in full in at least 30% of plays. The written opponent always keeps its
   form; a model that almost never does is a weaker opponent than the one it replaces.

A language that was not measured fails both.

## Results

<!-- table:start -->
<!-- table:end -->

## What is not established

NOT-ESTABLISHED
