# Language quality pipeline

Checks every translated string of the game, in sixteen languages, with tools
that did not write the text. Anyone can run it again; a regression fails it.

The owner's direction for this work: *"language must be perfect and there are
known solutions for this globally. language doesn't always need a generative
model. there are deterministic tools and other generative tools as well."* So
the order of trust here is: a rule (Unicode CLDR), a published source (Wikidata,
a platform vendor's own translations), a deterministic tool (LanguageTool,
Hunspell), a dedicated translation model (back-translation), and last a general
language model, whose opinion is only ever a proposal.

## What runs where

| Step | What it decides | Runs | Fails the build |
|---|---|---|---|
| 1. Plurals and numbers | The form of a counted noun, by CLDR plural rule (`Intl.PluralRules`); numbers by `Intl.NumberFormat`; lists by `Intl.ListFormat`. Every count has exactly the forms its language has. | `npx vitest run` (`src/i18n/quality.test.ts`) | yes |
| 7. Mechanical checks | Same keys and placeholders everywhere, nothing left in English, spacing, punctuation and quotation marks by language, hidden and bidirectional characters, script. | `npx vitest run`; `node scripts/lang/check.mjs` | yes |
| 5. Terminology | One word per game term per language; platform terms as the vendors publish them. | `npx vitest run`; `node scripts/lang/glossary.mjs` | yes |
| 6. Form names | The name of each verse form is the one recorded in the glossary. Each has a status (sourced, head word sourced, the form's own name, not sourced) that its cited evidence must bear out, and an exception about a name (meaning, spelling, grammar) must say the same. | `npx vitest run` | yes |
| 5b. Citations | Every `cite` in `docs/language/glossary.json` is true of the fetched file it names, exactly (an Android or Firefox string, a Google Help title or heading, a Wikipedia title as item Q…, a Wikidata label or alias, a Wiktionary word); prose that names a source has cites. | `npx vitest run` | yes |
| 3b. Single words | Relic power words, the four criteria and the glossary's core terms against English Wiktionary's translation tables for the English word (or the word's own entry where the table has nothing for the language). Not listed: changed, or kept with a reason in `allow/words.json`. | `npx vitest run` | yes |
| 2. Grammar and spelling | LanguageTool and Hunspell over every string as a rendered sentence, each string on its own (joined into one text, LanguageTool's text-level rules judged a string by its neighbours). Thai is cut into words by ICU first, and a rejected piece counts only if no join with the pieces touching it is a known word. | build host: `run.sh grammar` | yes (exit 1 on an unlisted hit, or on an exception that no longer matches anything) |
| 3. Meaning | Back-translation with MADLAD-400 scored against the English (MiniLM cosine), and LaBSE scoring the translation against the English directly. Flagged when both are under 0.6; a control scores each against the wrong English sentence with the same rule. | build host: `run.sh meaning`, then `node scripts/lang/meaning.mjs` | yes (exit 1 on an unreviewed flag or a string changed since it was scored) |
| 4. Second opinion | A different model, run locally, reviews each string as a native-speaking reviewer. | build host: `run.sh review` | no: it proposes, steps 2 and 3 decide |

Steps 1, 5, 6 and 7 need nothing but Node and run with the unit tests, so they
fail an ordinary build. Steps 2 to 4 need Java, dictionaries and models, and
run on the build host.

## Running it

```bash
RB='export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH;'
# once (and after changing host-setup.sh): install the tools on the build host
~/kani-logs/remote/rb . -- "$RB bash scripts/lang/run.sh setup"
# prove the tools can flag something in each language (read this before trusting a clean run)
~/kani-logs/remote/rb . -- "$RB bash scripts/lang/run.sh selftest"
# grammar and spelling; result in \$LANGQA_HOME/out/grammar.json
~/kani-logs/remote/rb . -- "$RB bash scripts/lang/run.sh grammar"
# back-translation and the second model are long: start them detached, look in later
~/kani-logs/remote/rb . -- "$RB BT_DEVICE=mps bash scripts/lang/run.sh detach meaning"   # mps: ~4 strings/s; cpu was ~0.2/s on a loaded host
~/kani-logs/remote/rb . -- "$RB bash scripts/lang/run.sh detach review --lang th,hi,ar,vi,zh,ja,ko,pl,ru,id,es,fr,de,it,pt"   # weakest first
~/kani-logs/remote/rb . -- "$RB bash scripts/lang/run.sh status"
~/kani-logs/remote/rb . -- "$RB bash scripts/lang/run.sh stop review"   # a detached step, by its pid file
```

Both long steps resume: a string already scored or reviewed is asked about again only if its
text (or the English) has changed since.

`grammar.json` keeps every sentence it read; `node scripts/lang/fresh.mjs` lists each string whose
grammar result is not about its current text (exit 1), and how much of each language the second
model has read as it is now. Run it before trusting a clean grammar result.

Copy the result files from `$LANGQA_HOME/out/` on the host into
`docs/language/results/`, then:

```bash
node scripts/lang/meaning.mjs --bt docs/language/results/bt.json   # which strings drifted
node scripts/lang/baseline.mjs main                                # the strings without this work, to count changes against
node scripts/lang/report.mjs                                       # docs/language/QA-REPORT.md
```

`LANGQA_HOME` defaults to `/Volumes/macos_4TB_external_1/wai-build/im-lang/qa-pipeline`.
Every heavy process runs under the host's `memguard`; the LanguageTool server
and `llama-server` listen on 127.0.0.1, on ports of their own (`LT_PORT`,
`LLAMA_PORT`), and are stopped by pid. Nothing else on the host is touched.

## When a check complains

- **Fix the string** if the complaint is right. A string fixed after a run is checked again on the next one: back-translation and review translate or ask again only what changed. `node scripts/lang/apply.mjs changes.json`
  writes new text for keys into the locale files.
- **Record an exception** if it is not, in `docs/language/allow/`, with the reason:
  `mechanical.json` and `untranslated.json` (unit tests), `grammar.json` (a LanguageTool
  rule on a string, or on every string of a language when the rule misreads interface
  text), `spelling.json` (a word Hunspell does not know: a name, a loanword, a term of
  the game), `meaning.json` (a back-translation that reads loosely but was read and is
  right; it names the exact text, so changing the string voids it).
- An exception that no longer excuses anything fails the run. Remove it.

## A correction proposed by the second model

It is adopted only when it survives the tools:

```bash
A=docs/language/results/adopt
node scripts/lang/adopt.mjs propose docs/language/results/review.json --out $A        # overlay.json, pairs.json, proposals.json
# on the host (rb leaves git-ignored files behind, so $A must be a tracked path):
bash scripts/lang/run.sh grammar --keys $A/overlay.json --out $OUT/grammar-base.json                         # the strings as they are
LANGQA_OVERLAY=$A/overlay.json bash scripts/lang/run.sh grammar --keys $A/overlay.json --out $OUT/grammar-with.json   # with the corrections
BT_DEVICE=mps bash scripts/lang/run.sh pairs $A/pairs.json $OUT/pairs-out.json
# back here, with those three files and the current bt.json copied into $A:
node scripts/lang/adopt.mjs decide --proposals $A/proposals.json --base $A/grammar-base.json --with $A/grammar-with.json --pairs $A/pairs-out.json --bt docs/language/results/bt.json
```

`--keys` checks only the strings named (a minute, against half an hour for every string).
An `--out` given to `run.sh` replaces its default (before 2026-11-16 the default won, so the
run with the overlay overwrote `grammar.json`).

`decide` writes `docs/language/results/adoption.json`: each proposal, whether it
passed the mechanical and glossary checks, raised a new LanguageTool or Hunspell
hit, and back-translated at least as close to the English as the text it would
replace. Surviving is not enough: on 2026-11-16 survivors included corrections that
changed the meaning (an actor made a games player, a curse "obeyed" made "possessed").
Each survivor is read against the English and where it appears, and the decision and
its reason go in `docs/language/results/adoption-reading.json`; only those marked
`adopt` are applied (`apply.mjs`), and the report lists both.

## How the tools read a template

`lib/strings.mjs` turns each template into the sentences a player sees, as the pages fill them:
`{rule}` with the caster's wording in the keys `lib/context.mjs` lists (a unit test holds that list to
the pages' calls), the model's label as the page shows it, a curse's name where the page passes one,
the link texts in a sentence's `{terms}` / `{privacy}` slots, and a Korean particle after a value in
the form `src/lib/verse/msg.ts` chooses.

## Sources

`fetch-cldr.mjs` (plural rules, quotation marks), `fetch-wikidata.mjs` and
`fetch-wikidata-titles.mjs` (names of verse forms), `fetch-wikidata-names.mjs` (how
each language writes Shakespeare and Mercutio), `fetch-wiktionary.mjs`
(Wiktionary's translation tables, for forms no Wikipedia names),
`fetch-wiktionary-words.mjs` (Wiktionary's tables for the game's single words, and the own entries
of words those tables do not cover), `fetch-opencc.mjs` (OpenCC's traditional-to-simplified table),
`fetch-platform-terms.mjs` (Android's translations of platform terms),
`fetch-apple-terms.mjs` (Apple's wording for passkeys), `fetch-mozilla-terms.mjs`
and `fetch-google-help.mjs` ("sign out", which Android's strings lack). Each writes a file under `docs/language/sources/` with
where it came from and when. `docs/language/PROVENANCE.md` lists them all, with
licences, and the tools and models with their versions.

## Files

- `lib/strings.mjs`: every string, and `renderSamples()`, which turns a template into the sentences a player reads (one per plural form).
- `lib/mechanical.mjs`, `lib/glossary.mjs`: the rules, shared with the unit tests.
- `lib/context.mjs`: where a string appears, from its key (given to the reviewer).
- `grammar.mjs`, `backtranslate.py`, `meaning.mjs`, `review.mjs`, `adopt.mjs`, `report.mjs`, `apply.mjs`, `extract.mjs`.
- `baseline.mjs`: the strings as they stand on a git ref (main), read with this checkout's code, so the report counts only this work's changes.
- `hspell.cpp`: asks the Hunspell library about whole words (the `hunspell` command cuts Devanagari and Thai words apart).
- `host-setup.sh`, `run.sh`: the build host side.
