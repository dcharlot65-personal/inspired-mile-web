# 0015. Language data generated from pinned, authoritative sources

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../14-localisation-kit.md`, `docs/language/PROVENANCE.md`, ADR 0008.

- **Status:** Accepted
- **Date:** 2026-11-16 (pronunciation table pinned, commit bb207bc1; confusables, function words and judge words, commit 6e9877ba; card text and sound tables the same days)
- **Who decided:** the owner's standing rule (language data from authoritative sources such as CLDR, Wikidata, Wiktionary and dictionaries, never one model's unchecked output); the pinning method in engineering work, recorded in the commits above
- **Source:** commits bb207bc1 and 6e9877ba; `CLAUDE.md:87-110,416-428,476-499`; `docs/language/PROVENANCE.md`; `docs/language/PHONETICS.md`; `sources/as-built-tech.md` §6.3

## Context and problem statement

The game needs, per language: pronunciations for rhyme and syllables, stems, function words, number words and judge words, form names, card names and quotations, plural rules, quotation marks. A language model can write all of that in minutes, and be confidently wrong in ways no test catches. Hand-written tables drift and cannot be traced. Where should language data come from?

## Decision drivers

- Every datum traceable to a published source with a licence.
- The same source gives the same file, byte for byte, on any machine.
- A table's faults must be findable by something that does not share its data.

## Considered options

1. Ask a model for the data.
2. Hand-write tables.
3. Generate every table from a published source, pinned by version and sha256; the script refuses a different file; never hand-edit a generated module.

## Decision outcome

Option 3. Examples: `pron-en.ts` from one CMU Pronouncing Dictionary commit and its sha256, with SCOWL marks; `confusables.ts` from UTS #39 18.0.0; `function-words/<lang>.ts` from stopwords-iso 1.1.0 plus Wiktionary closed-class words; `judge-words.ts` from CLDR 49 number rules and Wiktionary translations; sound tables from Wiktionary (kaikki.org, WikiPron), Unihan and CC-CEDICT; the Japanese dictionary cut from kuromoji's IPADIC with JMdict and JMnedict katakana lists; card names from Wikidata labels and lines from public-domain translations on Wikisource. What was translated for the game is kept apart and marked (`scripts/language/translated/<lang>.txt`).

### Consequences

- Good: provenance for every file (`docs/language/PROVENANCE.md`, `CONTENT-PROVENANCE.md`, `NAMES-AND-QUOTATIONS.md`).
- Good: an independent cross-check against espeak-ng output (which shares no data with the tables) found a real build fault on 2026-11-16: Wiktionary lists several transcriptions per word in no useful order, so the first must never be taken (`CLAUDE.md:494-499`).
- Bad: licence duties follow the data. Wiktionary, CC-CEDICT and JMdict-derived tables are CC BY-SA 4.0 and must be credited and stay CC BY-SA; mecab-ipadic's notice must travel with it. As built the site credits none of them (tech §11.2). **In this release** (`fix/compliance`) a `/credits` page credits the CC BY-SA data.
- Bad: interface text and the written opponent's verses are still a model's translation, checked only by tools; no native speaker has read any language (ADR 0002; `../14-localisation-kit.md` §12).

### Confirmation

Each build script refuses a source whose sha256 differs; `sound/ipadic.test.ts` requires the cut dictionary to give the same readings as the full one; `scripts/sound/measure.mjs --write` records digests the tests must reproduce, and `mutate-sound.mjs` proves those tests go red (`CLAUDE.md:490-493`).

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| A model writes the data | fast | unverifiable; against the owner's rule |
| Hand-written tables | quick for small sets | drift; no provenance |
| Generated from pinned sources | reproducible; traceable; licensable | build scripts to maintain; licence duties; sources have gaps |

## More information

Keep CC BY-SA tables as separate data files, never compiled into code, so ShareAlike reaches the data and not the program (`../research/sota-production-2026-11.md` §5.10). Note that the API compiles `pron-en.ts` (BSD-style, not CC BY-SA) into its binary; no CC BY-SA table is compiled into the API at 0d6df6ef (tech §1.2).
