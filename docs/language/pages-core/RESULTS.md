# What the tools found in the first pages, per language

Branch `lang/pages-core`, 2026-11-16. The text was written by a language model (Claude); every
check below was made by something that did not write it. Nothing here was read by a native
speaker. "Checked" means a tool looked and what it said was read and settled; it does not mean
the text is right.

Each language has 421 messages on these pages: 43 names taken from CLDR or Wikidata, and 378
written by the model.

## The checks, and whether each can fail

| Check | Tool | Self-test (a known-bad input it must flag) | Run |
|---|---|---|---|
| Keys, placeholders, marks, empty or untrimmed values, stray braces, `\u` escapes | `src/i18n/pages/check.ts` in `src/i18n/pages.test.ts` | the test feeds it broken input; `scripts/mutate-pages.mjs` breaks the real files one at a time | vitest, every build |
| Mechanical rules of lang/qa-pipeline (French and German spacing, Spanish ¿ ¡, full-width CJK marks, Arabic ، ؛ ؟, the Hindi danda, CLDR quotation marks, bidi and invisible characters, the language's own script, endings, nothing left in English) | `scripts/lang/lib/mechanical.mjs` of lang/qa-pipeline, run over these areas by `scripts/pages-lang/mechanical.mjs` | 18 known-bad strings, all flagged | locally |
| One word per game term | the glossary of lang/qa-pipeline (`docs/language/glossary.json`), and seven terms read from the core locale files | in the same 18 | locally |
| Thai spacing around a placeholder or a Latin word | `mechanical.mjs` (the core file's practice) | in the same 18 | locally |
| French and German spacing, rewritten by rule | `scripts/pages-lang/typography.py` | `--check` reported the ten files it would change before it changed them, and none after | locally |
| Names inside a sentence | `scripts/pages-lang/names-in-text.mjs`, against CLDR and Wikidata (`countries.json`) | 9 cases, both ways | locally |
| Spelling | Hunspell 1.7.2, LibreOffice dictionaries at `c0865a85` (installed by lang/qa-pipeline) | one misspelling rejected and one right word accepted per language | build host |
| Grammar | LanguageTool 6.6 server (installed by lang/qa-pipeline) | four known-bad sentences per language | build host |
| Meaning | back-translation to English by MADLAD-400 3B (CTranslate2 int8), scored by all-MiniLM-L6-v2 against the English, with a control score against the wrong English | the control | build host |
| The pages in a browser | `tests/pages-i18n.spec.ts` | its "The checks can fail" test plants English, a key, a placeholder, a mark and an over-wide element | build host |

## Mechanical rules, glossary and core terms

First run, before any fix: 122 findings from the mechanical rules, then 108 with the glossary
added, then 182 with the core terms. After the fixes: **0 open**, 89 read and allowed, each with
its reason in `mechanical.mjs` (`SAME_AS_ENGLISH`, `ALLOW`).

What was wrong and was changed:

| Language | Found | Changed |
|---|---|---|
| fr | 70 strings with an ordinary space before `: ; ! ?` or inside `« »` | no-break and narrow no-break spaces, by `typography.py` |
| de | 2 ellipses without the no-break space Duden asks for | `typography.py` |
| es | trivia called "las preguntas"; the core files say "el Trivial" (17 strings); 2 lost exclamation marks | rewritten with "Trivial"; ¡…! restored |
| hi | a card variant called रूप, which the core files use for the verse form (छंद-रूप) (8 strings) | संस्करण |
| es fr de it pt pl ru ar | "Verse Veteran" used the word for a line (verso, vers, Verse, wers, стих, الشعر) where the game's word for a verse is the strophe (أبيات) | the game's word |
| pt pl ar | the home page "duels" with a verb, never the game's word for the duel | the game's noun |
| ko | "download" as 내려받다; the glossary (from Android's own Korean) has 다운로드 | 다운로드 |
| ja th | 5 strings dropped the English `?` or `!` | restored |
| th | 3 placeholders glued to Thai letters (ด้วย{name}) | spaced, as the core file always does |

Read and allowed (not errors): the verb "judge" where the glossary means the judge; a trivia
round that is not a round of the duel; "Corrido Craft", whose "craft" is the ordinary word (the
ability adds Wordplay, not craft); "rap battle" and "battle streak", which are not the game's
battle; inflected forms the glossary's stems miss (Polish atramencie, słów; Russian зелий;
Arabic صنعتك; Hindi काढ़ों, प्रश्नोत्तरियाँ); and 43 words that are the same in the language
(French Justice, German Gold, Spanish Honor, the Montague and Capulet families in German,
Vietnamese and Indonesian…).

## Names inside a sentence

The line that says why a city grants its ability was written by the model. In every language it
must name its city as the city's sourced label does, or its country as CLDR or Wikidata does.
First run: 12 lines without the sourced form; 5 of them were the checker's fault (it dropped
names of two letters, such as 도쿄, and did not fold an accent). Of the other 7, five use a form
Wikidata records or a form cut from the label by a recorded rule (Korean 호주 and Vietnamese Úc
for Australia, Chinese and Japanese 大阪 for 大阪市, Thai นิวยอร์ก for นครนิวยอร์ก), one uses
Wikidata's spelling where CLDR differs (Hindi मेक्सिको; the city label मेक्सिको सिटी agrees), and
one matched no source: Hindi फ़िलीपींस, now CLDR's फ़िलिपींस.
