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
| Meaning | lang/qa-pipeline's `backtranslate.py` (b7c5459): back-translation to English by MADLAD-400 3B (CTranslate2, Apple GPU), MiniLM cosine against the English, LaBSE against the English directly; flagged when both are under 0.6 (`scripts/pages-lang/meaning.mjs`), plus a check of the back-translation's words for negation, bounds and numbers | a probe of ten planted pairs, every string against the wrong English (the control), and `meaning.mjs --selftest` (16 planted cases, 9 mutations of the script) | build host |
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

## Spelling (Hunspell)

Self-test: every language with a dictionary rejects a misspelling and accepts the right word.
The first run failed for Arabic: the dictionary accepts مجموعه for مجموعة (ه for ة), so that
pair proved nothing; a doubled letter is what it rejects. **It will not catch a ه/ة
confusion.** Italian elided articles (dell’, l’, un’) were spelled with their word and flagged
forty words; they are now spelled apart, from a closed list.

Words the dictionaries do not know, per language (second run), and what they were:

| Language | Unknown | What they were | Changed |
|---|---|---|---|
| en | 31 | names, product names, gaming words (leaderboard, gameplay), British "Theatre" and "Harbour" against an en_US dictionary (the site's own spelling) | nothing |
| es | 70 | names; ATQ, DEF, PV; Lógralo, súmate, bátete (right, with clitics); Completista (gaming word, in no dictionary) | nothing |
| fr | 41 | names; ATQ, DÉF; "battle" (French hip-hop's own loanword); Complétiste | nothing |
| de | 86 | compounds (Strophenduell, Quizantworten, KI-Gegner…), names, ANG/VER/LP; Arkan (the German gaming term for "arcane"); Gothic-Zirkel (see the labels note in the README) | nothing |
| it | 74 | names, loanwords (cloud, blockchain), Capuleti, possiedi (right), ghanese, newyorkese, sfottò | nothing |
| pt | 59 | names, quiz/quizzes, Montéquio (the family's Portuguese name), Complecionista | Complecionista → Completista |
| pl | 30 | names, PŻ, Montekowie, Komplecista | Komplecista → Pełna kolekcja |
| ru | 38 | names (Шекспир is not in the dictionary), АТК/ЗАЩ/ОЗ, рэп-баттл, Креативный (see grammar) | nothing |
| ar | 25 | transliterated names and genres (الأفروبيت، الدانسهول), و joined to a Latin name (وApple), التوليفات, الحكّاء | nothing |
| hi | 31 | verb forms the dictionary lacks (जीतें, कमाएँ, निभाएँ, जोड़ता), names, एआई | nothing |
| ko | 86 | loanwords with particles (배틀에서, 셰익스피어의), 다운로드돼요, 환시 (see below) | nothing |
| vi | 92 | names written in Latin letters (Brazil, Ghana, Philippines; CLDR's own Vietnamese names), the new tone placement (hòa, khóa) the dictionary's old style rejects, Úc | nothing |
| th | 35 | pieces of loanwords cut by the word splitter; "ด้วยHamlet" | placeholders spaced (see above) |
| id | 96 | affixed forms the dictionary lacks (memverifikasinya, -mu, -nya), names, Senturion | nothing |
| zh, ja | not checked | Hunspell has no dictionary for languages written without spaces | |

Doubtful and left for a native reader: Korean 환시 for the element "Vision" (English Wiktionary's
"vision" entry lists 환시 and 환각 under "something imaginary one thinks one sees" and gives no Korean
for the religious sense; lang/names-quotes has 환상). Russian Перфекционист for "Completionist" (it
means perfectionist) was changed to Полная коллекция, as Polish has it, and Hindi पूर्णताप्रेमी,
which back-translated as "perfectionist", to पूरा संग्रह (see Meaning).

Run again on the final strings (2026-11-16, iMac Pro, the same dictionaries at `c0865a85`): the
self-test passed in all fourteen languages, and the unknown words were those of the run above
except the two achievement names that were changed. Nothing new.

## Grammar (LanguageTool 6.6, level "picky")

Self-test, four known-bad sentences per language: en, es, fr, de 4 of 4; pt, ru 3; ar 2; zh, ja
1; **it and pl 0 of 4**. So for Italian and Polish LanguageTool here checks spelling only, and for
Chinese and Japanese very little: **their grammar has not been checked by any tool.** hi, ko, vi,
th and id have no LanguageTool module.

Hits apart from spelling and missing full stops on labels (pt FINAL_STOPS 29, pl BRAK_KROPKI
44: list items and headings, which have none in English either): 83 (ar 47, pt 9, it 7, fr 6, zh 6,
pl 5, en 1, de 1, ru 1), every one read.

Changed: German "Karten nach Haus" (also reads "cards homeward") → "Karten nach Häusern";
Arabic "لا نسخ حتى الآن" (readable as a verb, "does not copy") → "لا توجد نسخ حتى الآن".

Read and not changed, with the reason:
- Arabic number agreement (ثلاثة نزالات، ثلاثة قوالب، ثلاثة أرباع): the rule takes the
  gender from the plural; Arabic takes it from the singular (نزال، قالب، ربع are masculine), so
  ثلاثة is right. "Indefinite subject" (14 hits): headings and list labels, not sentences.
  Purist replacements (نموذجات for نماذج, في الأقل for على الأقل, الملهى الليلي for
  الكباريه, which would also change the meaning) and requests for diacritics.
- Chinese 的/地 and 的 with 下: misparses of 新的互动娱乐 and 对手的下一首诗.
- Italian "ai quiz" read as "hai quiz"; "o ottieni" / "od ottieni" (both admitted).
- Portuguese style suggestions (onde for em que, a comma in ou… ou), "quiz" read as "quis",
  Oriente and Ocidente capitalised as the regions they name.
- Polish "w której" (a misparse) and the capitals of WebGPU, WebXR, FlipTop.
- Russian Креативный директор (the usual job title; LanguageTool prefers творческий).
- French "un Vision Pro" (the device), "l’afrobeats" (the genre's name), and a repeated
  "entièrement" that only repeats across two strings checked in one batch.
- Placeholder fill values of the checker itself (jest, a date range).
- English source: a comma before "and" in main's own wording.

Run again on the final strings (2026-11-16, Studio, LanguageTool 6.6 on a port of its own under
memguard, the same self-test results): 519 hits against 521 before. The two gone are the German
and Arabic lines changed above; no new hit in any language.

## Meaning (back-translation)

Every string of the nine areas, single words included (378 a language, 5,670 pairs), translated back
to English by MADLAD-400 3B through lang/qa-pipeline's own `backtranslate.py`, run from a copy of that
branch at b7c5459 (`scripts/pages-lang/meaning-run.sh`: one language at a time on the Studio's GPU,
about four minutes a language; the CPU had taken 17 s a string). Each back-translation is scored
against its English with MiniLM, and the translation against the English directly with LaBSE.
An earlier run in this branch covered 188 strings only, with our own script; it is superseded.

**What the scores can and cannot see (the probe).** Ten planted pairs, each with its right twin:

| Planted | MiniLM | LaBSE | MADLAD said |
|---|---|---|---|
| es "como mínimo 2" for "at most 2" | 0.98 | 0.87 | "at least 2" |
| de "Hamlet ist ein Relikt" for "Hamlet is not a relic" | 0.94 | 0.74 | "Hamlet is a relic" |
| fr "par jour" for "per battle" | 0.56 | 0.71 | "uses per day" |
| ja "do not delete the deck" for "Delete deck Hamlet" | 0.77 | 0.45 | "Do not delete the deck" |
| ru, ar: an unrelated sentence | 0.09, 0.05 | 0.18, 0.42 | the unrelated sentence |

So the scores catch a translation that says something else entirely, and miss a flipped bound or a
dropped negation, though MADLAD's own words show both. `meaning.mjs` therefore also reads the
back-translation's words by rule: a negation, a lower or upper bound or a number that the English
has and the back-translation lacks (or the other way round) flags the string. Its self-test holds
MADLAD's real outputs for the planted errors, and nine mutations of the script each turn it red.

**The control.** Each string scored against another string's English: the rule (both scores under
0.6) flags 5,173 of 5,670 wrong pairs (90 to 93 % per language) and 476 of the 5,670 real ones. Median
MiniLM score against its own English 0.88, against the wrong one 0.23; LaBSE 0.85 and 0.24.

| Language | Scored | Back-translation alone under 0.6 | Flagged (both) | Words (negation, bound, number) | Read and accepted | Changed | Control flagged | Median MiniLM / LaBSE |
|---|---|---|---|---|---|---|---|---|
| es | 378 | 71 | 15 | 3 | 18 | 0 | 91 % | 0.95 / 0.88 |
| fr | 378 | 73 | 19 | 4 | 23 | 0 | 92 % | 0.91 / 0.89 |
| de | 378 | 65 | 28 | 3 | 31 | 0 | 91 % | 0.95 / 0.89 |
| it | 378 | 79 | 26 | 2 | 28 | 0 | 92 % | 0.93 / 0.88 |
| pt | 378 | 76 | 18 | 2 | 20 | 0 | 92 % | 0.93 / 0.88 |
| pl | 378 | 64 | 22 | 3 | 25 | 0 | 91 % | 0.94 / 0.86 |
| ru | 378 | 66 | 29 | 5 | 33 | 1 | 90 % | 0.90 / 0.85 |
| ar | 378 | 107 | 45 | 3 | 47 | 3 (layout) | 92 % | 0.79 / 0.82 |
| hi | 378 | 84 | 41 | 3 | 43 | 1 | 90 % | 0.86 / 0.83 |
| zh | 378 | 107 | 31 | 0 | 31 | 0 | 92 % | 0.81 / 0.83 |
| ja | 378 | 72 | 29 | 4 | 33 | 0 | 90 % | 0.85 / 0.82 |
| ko | 378 | 74 | 39 | 4 | 43 | 1 | 91 % | 0.86 / 0.82 |
| vi | 378 | 89 | 38 | 1 | 39 | 0 | 90 % | 0.80 / 0.82 |
| th | 378 | 132 | 63 | 6 | 69 | 0 | 93 % | 0.74 / 0.77 |
| id | 378 | 83 | 34 | 2 | 36 | 0 | 91 % | 0.87 / 0.86 |

Every flagged string was read: 519 in all, each accepted with its reason in
`docs/language/pages-core/allow-meaning.json` (the entry names the exact text, so a changed string
is flagged again), and the result is in `docs/language/pages-core/bt.json`. Most are labels of one or
two words (an element, a stat, an achievement's title), where MADLAD gives a synonym, a
transliteration or another sense of the word: Thai สุขนาฏกรรม (comedy) came back as "Tragedy",
Chinese 问答答对数 as "logarithm", Hindi पद (the core files' word for a verse) as "position". The
word checks found no real flip: each was MADLAD dropping a sentence, writing "not half" for "instead
of half", or a negation said differently ("Unavailable" / "not available"). The back-translations
under 0.6 that LaBSE did not doubt (165 of four words or more) were also read; one of them led to the
Korean change below.

Changed because of what was read:

| Language | Key | Was | Now | Why |
|---|---|---|---|---|
| ru | achievements.completionist.name | Перфекционист | Полная коллекция | it means perfectionist; "full collection", as the Polish title |
| hi | achievements.completionist.name | पूर्णताप्रेमी | पूरा संग्रह | back-translated as "perfectionist"; "the full collection" |
| ko | world-map.none | …아직 연 변형이 없어요. | …아직 열린 변형이 없어요. | 연 also reads as "kite" (MADLAD: "kite variants"), and variants.unlocked says 열린 |

These were translated back again after the change (merged over the first run) and are in `bt.json`.
The three Arabic counts (below) were scored again too.

Left for a native reader, from this pass: Arabic شعر الدَّب for "dub poetry" (MADLAD: "bear hair"),
Hindi हमारी सोच for "The Vision", Vietnamese "Lão làng làng thơ" for "Verse Veteran" (the repeated
làng is a play on words that may read as a slip), the Indonesian stat labels SER, TAH, NYAWA (coined;
many Indonesian games keep ATK, DEF, HP), Korean 조지 for Jozi (it is also how George is written).

## The pages, looked at (screenshots)

Taken on the build host with `scripts/page-shots.mjs`: Arabic, German, Japanese and Spanish,
each page at 1280 and 390 pixels wide, with the deck builder, its error, three card views, the
city view and the phone menu. No page was wider than its screen in any of the 40 loads, and
every document title was the language's own.

Looked at, and fixed:
- **Arabic**: an English line inside an Arabic rule ("To be, or not to be…") had its full stop
  and quotation marks at the wrong ends; the English scene text was laid out right to left;
  the stat labels in the monospace font fell apart into separate letters; every house badge
  with the article showed ا. Rule lines without Arabic letters now go in `<bdi>`, scene text
  takes `dir="auto"`, only the numbers are monospace, and the badge letter skips the article.
- **Japanese**: the hero paragraph ended on a lone "う。", and 家門 was split one character per
  line. The layout's `<main>` now breaks Japanese between phrases (`word-break: auto-phrase`)
  and avoids one-word last lines (`text-wrap: pretty`).
- **German, Spanish**: nothing to fix found; German's long compounds fit at 390 pixels.

Looked at and right: arrows that point the reading way in Arabic, the paired brackets and
Latin names inside Arabic sentences, the sentence-final full stop after "Inspired Mile" on the
left, the house names, the city view with its English style names (by design).

### A second look (continuation, 2026-11-16)

All five pages taken again in Arabic, German, Japanese and Spanish at both widths (Studio, 40 loads,
no page wider than its screen, every title the language's own) and looked at piece by piece. The
earlier review had missed these, now fixed and seen fixed in new Arabic and Japanese screenshots
(iMac Pro):

- **Arabic**: a count out of a total showed the total first ("71 / 11" for 11 of 71) on the
  collection and world map pages: with spaces round the slash the bidirectional algorithm orders the
  two numbers right to left. Now written 11/71. A signed number showed its sign after it ("50+" in
  the credits list, "2+" on the world map, the relic's +6): signed numbers are now isolated left to
  right at run time (`signedLtr()`). The about page's timeline set month names in the monospace font,
  whose Arabic fallback pulled the letters apart: Arabic now takes the text font there.
- **Japanese** (and Chinese, same code): a relic's power words ran together as one string of
  characters (髑髏冗談墓笑い塵), because they were joined as Intl's measurement list; now 髑髏、冗談、墓、笑い、塵.
  The profile heading broke as プレイヤープロフィー / ル; an accented word in a Japanese or Chinese
  heading now stays whole (プレイヤー / プロフィール).
- **German, Spanish**: nothing new. Spanish shows a nickname in “ ”, which is CLDR 49's Spanish
  quotation mark (es quotationStart “).

## The pages in a browser, and every suite

All on the build host, with test ports 47611 (web), 47612 (web without email), 47613 (API),
47614 (API without email) and 47615 (Postgres), `E2E_TIMEOUT=60000` and six workers (the host
stood at load 130 to 230 on 32 cores).

`tests/pages-i18n.spec.ts` loads home, about, collection, profile and world map in all sixteen
languages, with a player who owns cards, variants, decks and achievements, opens the deck
builder's error, the card views and a city, and reads `textContent`: no `{placeholder}`, no
message key, no `<b>`/`<a>` mark, none of the page's English (taken from the English area files
and a list of what the pages said before), the document title and description the language's
own, nothing wider than a 390-pixel phone. Its "The checks can fail" test plants English in
capitals and hidden, a key, a placeholder, a mark and an over-wide element, and each is caught.
`scripts/mutate-pages.mjs` breaks the areas, the record and the quotation marks one at a time
(11 breaks); the unit tests went red for every one and green again after.

- First run, at c074c81 (main a0d485f merged): vitest 124 of 125 (the core `i18n.test.ts` timed
  out at 5 s while loading sixteen locale files on the loaded host; run alone twice, it passed in
  3.2 s both times), build passed, Playwright 139 of 143. The four failures were not in this
  branch's pages: three `pwa.spec.ts` tests whose stand-in model library lacked what main's new
  self-hosting loader reads (main fixed the stand-in in 61a3e95), and `v2-world-cards.spec.ts`,
  where `locator('h1')` also found the Astro developer toolbar's headings (main turned the
  toolbar off in 3015db5). Both commits are merged here. I did not run main itself to watch
  those four fail there.
- Run at 6afd468 (main 3015db5 merged, the screenshot fixes in): vitest 127 of 127, build passed, Playwright **143 of 143**
  (7.4 min, none flaky), mutation proof 11 of 11 caught.
- Last run, at 8d6d3f1 (the home stats change in; nothing but a report script after it):
  vitest 127 of 127, build passed, Playwright **143 of 143** (6.1 min), and new Arabic and
  Japanese screenshots of home and collection at both widths: no overflow, 家門 whole, the
  Arabic stats and card view as fixed.
