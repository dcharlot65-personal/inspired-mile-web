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
| 6. Form names | The name of each verse form is the one recorded in the glossary, with its source. | `npx vitest run` | yes |
| 2. Grammar and spelling | LanguageTool and Hunspell over every string as a rendered sentence. | build host: `run.sh grammar` | yes (exit 1 on an unlisted hit) |
| 3. Meaning | Back-translation with MADLAD-400, scored against the English. | build host: `run.sh meaning`, then `node scripts/lang/meaning.mjs` | yes (exit 1 on an unreviewed flag or a string changed since it was scored) |
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
~/kani-logs/remote/rb . -- "$RB bash scripts/lang/run.sh detach meaning"
~/kani-logs/remote/rb . -- "$RB bash scripts/lang/run.sh detach review"
~/kani-logs/remote/rb . -- "$RB bash scripts/lang/run.sh status"
```

Copy the result files from `$LANGQA_HOME/out/` on the host into
`docs/language/results/`, then:

```bash
node scripts/lang/meaning.mjs --bt docs/language/results/bt.json   # which strings drifted
node scripts/lang/report.mjs                                       # docs/language/QA-REPORT.md
```

`LANGQA_HOME` defaults to `/Volumes/macos_4TB_external_1/wai-build/im-lang/qa-pipeline`.
Every heavy process runs under the host's `memguard`; the LanguageTool server
and `llama-server` listen on 127.0.0.1, on ports of their own (`LT_PORT`,
`LLAMA_PORT`), and are stopped by pid. Nothing else on the host is touched.

## When a check complains

- **Fix the string** if the complaint is right. `node scripts/lang/apply.mjs changes.json`
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
node scripts/lang/adopt.mjs propose docs/language/results/review.json          # overlay.json + pairs.json
LANGQA_OVERLAY=overlay.json bash scripts/lang/run.sh grammar --out with.json   # on the host
bash scripts/lang/run.sh pairs pairs.json pairs-out.json                       # on the host
node scripts/lang/adopt.mjs decide --base grammar.json --with with.json --pairs pairs-out.json --bt bt.json
```

`decide` writes `docs/language/results/adoption.json`: each proposal, whether it
passed the mechanical and glossary checks, raised a new LanguageTool or Hunspell
hit, and back-translated at least as close to the English as the text it would
replace. A person (or the engineer doing the work) still reads each survivor
before applying it.

## Sources

`fetch-cldr.mjs` (plural rules, quotation marks), `fetch-wikidata.mjs` and
`fetch-wikidata-titles.mjs` (names of verse forms), `fetch-platform-terms.mjs`
(Android's translations of platform terms), `fetch-apple-terms.mjs` (Apple's
wording for passkeys). Each writes a file under `docs/language/sources/` with
where it came from and when. `docs/language/PROVENANCE.md` lists them all, with
licences, and the tools and models with their versions.

## Files

- `lib/strings.mjs`: every string, and `renderSamples()`, which turns a template into the sentences a player reads (one per plural form).
- `lib/mechanical.mjs`, `lib/glossary.mjs`: the rules, shared with the unit tests.
- `lib/context.mjs`: where a string appears, from its key (given to the reviewer).
- `grammar.mjs`, `backtranslate.py`, `meaning.mjs`, `review.mjs`, `adopt.mjs`, `report.mjs`, `apply.mjs`, `extract.mjs`.
- `hspell.cpp`: asks the Hunspell library about whole words (the `hunspell` command cuts Devanagari and Thai words apart).
- `host-setup.sh`, `run.sh`: the build host side.
