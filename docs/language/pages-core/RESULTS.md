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

Run again on 2026-11-16 (continuation) with lang/qa-pipeline as it then stood (b7c5459), whose
rules and glossary had grown since: 40 open findings, all where the core files had changed their
convention in that branch, and all followed:

| Language | Strings | Was | Now | Source (lang/qa-pipeline's glossary or rule) |
|---|---|---|---|---|
| hi | 18 | शेक्सपियर | शेक्सपीयर | Wikidata label of Q692 (विलियम शेक्सपीयर) |
| th | 2 | เข้าสู่ระบบ (sign in) | ลงชื่อเข้าใช้ | Android (AOSP kg_login_submit_button) and Google Help |
| vi | 20 | khóa, hòa, hóa, xóa, tụy | khoá, hoà, hoá, xoá, tuỵ | one tone placement, Android's and the LibreOffice vi_VN dictionary's |

After them: **0 open**. The strings were translated back again (Meaning) and spelled again: the
Vietnamese dictionary now knows the seven words it rejected before.

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
| vi | 92 | names written in Latin letters (Brazil, Ghana, Philippines; CLDR's own Vietnamese names), the traditional tone placement (hòa, khóa), which the dictionary, written in the newer placement (hoà, khoá), rejects, Úc | nothing (the strings later moved to hoà, khoá: see Mechanical rules) |
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
except the two achievement names that were changed and seven Vietnamese words now spelled with the
dictionary's tone placement (Hòa, Hóa, Xóa, hòa, hóa, khóa, tụy). Nothing new.

## Grammar (LanguageTool 6.6, level "picky")

Self-test, four known-bad sentences per language: en, es, fr, de 4 of 4; pt, ru 3; ar 2; zh, ja
1; **it and pl 0 of 4**. So for Italian and Polish LanguageTool here checks spelling only, and for
Chinese and Japanese very little: **their grammar has not been checked by any tool.** hi, ko, vi,
th and id have no LanguageTool module.

Four sentences is a small self-test, and "4 of 4" overstates the net. The independent check of this
branch (2026-11-17) planted one agreement error in 26 real strings per language ("ein Karten" in
German, and the like) and ran the LanguageTool 6.6 command line at its default level: it caught the
plant only in Spanish and French, and missed it in de, it, pt, pl, ru, ar, zh and ja. That run was not
at the "picky" level used here, so the two are not the same measurement, but neither shows that
LanguageTool finds an agreement error in German, Portuguese or Russian interface text. **Treat
grammar as checked by a tool only for Spanish and French, thinly for the rest.**

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
| hi | 378 | 84 | 41 | 3 | 43 | 1 + 18 (name) | 90 % | 0.86 / 0.83 |
| zh | 378 | 107 | 31 | 0 | 31 | 0 | 92 % | 0.81 / 0.83 |
| ja | 378 | 72 | 29 | 4 | 33 | 0 | 90 % | 0.85 / 0.82 |
| ko | 378 | 74 | 39 | 4 | 43 | 1 | 91 % | 0.86 / 0.82 |
| vi | 378 | 89 | 37 | 1 | 38 | 20 (tone marks) | 90 % | 0.80 / 0.82 |
| th | 378 | 132 | 63 | 6 | 69 | 2 (sign in) | 93 % | 0.74 / 0.77 |
| id | 378 | 83 | 34 | 2 | 36 | 0 | 91 % | 0.87 / 0.86 |

Every flagged string was read: 518 in all on 2026-11-16 (516 after the 2026-11-17 changes below),
each listed in `docs/language/pages-core/allow-meaning.json` with the exact text, MADLAD's
back-translation that was read, and a reason; a changed string is flagged again. The result is in
`docs/language/pages-core/bt.json`. The reasons are not one per string: there are 55 distinct
reasons, 12 of them shared by 459 entries (133 entries are an element's name, one word, and share one
reason; 115 are achievement titles and share another), and 37 written for a single string. A shared
reason says why that kind of string back-translates loosely. That each string under it was read
against its back-translation is this report's statement; the file cannot show it. Most are labels of one or
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

These were translated back again after the change (merged over the first run) and are in `bt.json`,
as were the three Arabic counts (below) and the 40 Hindi, Thai and Vietnamese strings changed to
lang/qa-pipeline's conventions (Mechanical rules, above). After those, two Vietnamese labels were
flagged anew: MADLAD read the second-vowel tone marks as other words (Tận tuỵ "selfish", Hoá đá
"flowers"; before, tận tụy "dedication", hóa đá "stones"). Read and accepted; both spellings are
Vietnamese, and the game writes the second.

Left for a native reader, from this pass: Arabic شعر الدَّب for "dub poetry" (MADLAD: "bear hair"),
Hindi हमारी सोच for "The Vision", Vietnamese "Lão làng làng thơ" for "Verse Veteran" (the repeated
làng is a play on words that may read as a slip), the Indonesian stat labels SER, TAH, NYAWA (coined;
many Indonesian games keep ATK, DEF, HP), Korean 조지 for Jozi (it is also how George is written).

Added by the independent check of 2026-11-17, and not settled by any tool:
- Korean Arcane 비전 (秘傳) is read by many as the loanword 비전 "vision", while the Vision element is
  환시. English Wiktionary's "arcane" entry has no Korean translation to follow.
- Korean Illusion 환영 (幻影) is also 환영 (歡迎) "welcome". English Wiktionary's "illusion" table
  gives 환각 and 환상, not 환영; lang/names-quotes also writes 환영 for Illusion and 환상 for
  Vision, so a change here would collide with that branch's Vision. Left for the one owner of these
  labels to settle with a Korean reader (labels-vs-names-quotes.tsv).
- Arabic Rebirth البعث (also lang/names-quotes' word) is the word of يوم البعث, the Resurrection, and
  on its own it strongly evokes the Ba'ath party; MADLAD read it as "Al-Baath". English Wiktionary's
  "rebirth" entry has no Arabic. A reader may prefer الانبعاث or الولادة الجديدة.
- Arabic play titles in italic on the home page: fixed (no italic is synthesised for Arabic, Hindi,
  Thai, Chinese, Japanese or Korean; see the second pass below).

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

## Second pass: the integration merged (2026-11-17)

`integrate/wave3` at 0346ee1 (the engine, security and multiplayer work) merged with no conflict.
`src/i18n/index.ts` is now byte for byte the file of lang/pages-play and lang/pages-rest (the same
`loadArea`, and `applyTranslations` leaves a key no locale has yet alone), so merging either of them
no longer conflicts there. Trial merges (`git merge-tree`) at the end: clean with lang/pages-play
and lang/phonetics; lang/pages-rest conflicts in CLAUDE.md only; lang/qa-pipeline (06e2cb6, which
has merged integrate/wave3 itself) in `src/i18n/index.ts` only, where both add a function after
`loadMessages` (keep both); lang/names-quotes in CLAUDE.md and the battle page, through the
integration's changes to that page.

### Changed in the page areas

| Language | Key | Was | Now | Why |
|---|---|---|---|---|
| es fr de it pt vi | achievements.wordsmith / virtuoso.description | "Consigue {n} puntos o más…" (number before a noun) | "Puntuación en una sola ronda: {n} o más" (label: number) | the noun would have to agree with the goal; wrong for a goal of 1 |
| ar | rules.relic | +{bonus} صنعة | +{bonus} في الصنعة | the core's own form for a bonus (variant.bonus) |
| pl | rules.relic | +{bonus} kunsztu | +{bonus} do kunsztu | the Polish form for a stat bonus, as ru "+{bonus} к мастерству" |
| hi | 15 strings | पद (verse) | कविता, with feminine agreement | lang/qa-pipeline (fa198bc) now writes कविता, from English Wiktionary's "verse" table; पद back-translated as "position" |
| vi | variants.region.eurasia | (record only) | the record says the first letter was capitalised | the shipped value was recorded as the Wikidata label, which is lower case |

Checked again after the changes, all on the Studio unless said:
- Meaning: the 29 changed strings translated back by lang/qa-pipeline's `backtranslate.py` at
  fa198bc (the same file as at b7c5459), merged over the earlier run; `meaning.mjs --bt` exit 0.
  The Hindi strings now come back as "poem": कविताओं का द्वंद्व "Duel of Poems" (was "Duel of
  Positions"), चौराहे की कविता "Crossroads Poem" (was "Crossing position"); those two left the
  flagged list. कविता का पुराना खिलाड़ी ("Poet's Old Player") is still flagged and was read: पुराना
  खिलाड़ी is the Hindi idiom for an old hand. Now 516 entries; the control flags 5,172 of 5,670 wrong
  pairs and 474 of the 5,670 real ones.
- Grammar, LanguageTool 6.6 "picky" on a port of its own (47861), every page string: 398 hits
  against 400; the two gone are Portuguese FINAL_STOPS on the old Wordsmith and Virtuoso lines, and
  none is new. Self-test as before (en es fr de 4/4, pt ru 3, ar 2, zh ja 1, it pl 0).
- Spelling, Hunspell with the same dictionaries: self-test passed in all fourteen languages; the
  changed strings bring no unknown word (the unknown words in them, pl "alas" from the sample
  filler and hi डालता, निभाएँ, मल्टीप्लेयर, were there before).
- Mechanical rules and glossary of lang/qa-pipeline at fa198bc (`mechanical.mjs`, locally): 14 open
  (Hindi पद) before the Hindi change, 0 after; self-test 18/18. Again with that branch at 06e2cb6, its
  head at the end of this pass: self-test 18/18, 0 open. names-in-text 0; typography clean.

### The integration's own strings

The integration added 16 core keys (sign-out everywhere, four sign-in errors, the potion warnings,
the void and judge rows, the world card row, "echo two of"), 240 translated strings written by the
engineers of those branches and read by nobody. They were run through lang/qa-pipeline's pipeline as
it stood at fa198bc, in a throwaway checkout of that branch, with the strings laid over its locale
files (`LANGQA_OVERLAY`) and one change to its code: a sample value for `{lines}`, which its
`strings.mjs` did not know.

**Who changes them.** The core locale files are lang/qa-pipeline's. While this ran, that branch merged
integrate/wave3 and fixed the same strings (f2a413c, "the strings integrate/wave3 brought in"): for the
line and round words below its text is word for word what this branch had written, and it fixed more
(gender, the verdict's "World card", French spacing, a list of lines through Intl). This branch had
committed its own fixes to those lines; they are reverted (da94590), so the core files here are
0346ee1's byte for byte and merging lang/qa-pipeline takes its fixes without a conflict. What this
branch found and that branch's f2a413c does not have is at the end of this list.

- **Glossary: 23 findings.** 10 were strings calling a line or a round by a word no other string
  uses (live.judgeUnread: es Líneas, pt Linhas, fr Lignes, it Righe, ko 줄 for the game's verso,
  vers, versi, 행; ar الشوط, ja この回, vi vòng, id babak for جولة, ラウンド, hiệp, ronde), and ru
  illegal.potion-last-round, which dropped the verse: all fixed in f2a413c. Two are misreads (de
  "Melde dich dafür zuerst ab", the separable abmelden; ar تُلعَن, a passive of the root of لعنة).
  Eleven follow main's conventions where lang/qa-pipeline has newer ones (Hindi पद for verse 4, Thai
  เข้าสู่ระบบ 4, Vietnamese khóa truy cập 2, Chinese 这把通行密钥 1): converted in f2a413c.
- The glossary also **missed one**: Thai live.judgeUnread called the round รอบ. Its Thai check is a
  substring, and ยก (the game's word) occurs across the words ด้วย|กติกา in the same sentence. f2a413c
  changed the word (by reading); the check's weakness stands (openItems).
- **Mechanical: 12 open**, the French no-break space before : and ? (10) and the Vietnamese tone
  placement (2): lang/qa-pipeline conventions, converted in f2a413c.
- **LanguageTool and Hunspell: 47 open hits.** One real: live.judgeUnread is two sentences and the
  second has no full stop (flagged in en, de, fr, pt). The rest were read and are not errors:
  lower-case starts of statuses shown inside a row (void.thin, void.copied, signature.hintTwo;
  lang/qa-pipeline allows the same rule on signature.hint for that reason), "Google" unknown to the
  dictionaries (7), French "ou" read as "où" and "mots différents" (distinct words, rightly after the
  noun), German Wertungswort (a compound), Korean 규칙만으로 (particles), Arabic diacritic suggestions
  on نقاط and two rule misreads, a Thai word split (เหลือ|บทกลอน cut as เหลือบ|ทก|ลอน), and the
  Vietnamese tone placement again.
- **Meaning: 16 new strings a language back-translated** (resumed over lang/qa-pipeline's own scores,
  so nothing else was translated again). 14 flags: verdict.notTaken in nine languages, where the
  criterion's name filled in ("wit") comes back as another word (Witz "joke"); the rest of each says
  "not won", as meant, except Thai ไม่ได้มา, read as "He didn't come". verdict.copyForfeits in ar
  (المنسوخة "scanned"; it is "copied"), hi (पद, the convention) and th: read, meaning right.
- **Second opinion** (lang/qa-pipeline's review step: Gemma 4 26B A4B, QAT q4_0 GGUF, llama.cpp
  b12359, on the Studio on a port of its own, 47852): all 240 strings reviewed, 0 failed batches; its
  planted controls caught the wrong word in 14 of 15 languages (not Polish, as in that branch's own
  runs). It proposed 9 corrections, which are only proposals (that branch's rule); each was read
  against the English and where it appears:
  - th live.judgeUnread: รอบ should be ยก. Right (above). Its other edits there would put เกรด among
    the example words, which the grader does not leave out in Thai (`judge-words.ts`): the message
    would say something false.
  - id live.judgeUnread: replace the examples (hakim, pemenang, menang) with nilai, skor, menang.
    Wrong for the same reason: hakim and pemenang are the Indonesian words the grader leaves out,
    nilai and skor are not (`review2.test.ts` holds the examples to the list).
  - hi illegal.potion-last-round: कविता for पद. The convention; done in f2a413c.
  - Wordings of equal sense that break the pattern of the strings beside them: es verdict.notTaken
    (drops the colon every verdict row has), fr void.copied ("doit être de vous" is idiomatic), ru and
    ko signature.hintTwo (the pattern of signature.hint, "one of"), zh and ja verdict.copyForfeits
    (they would say the verse loses the judge's "verdict"; it loses the judge's points, which the text
    says).
- A second run over this branch's own fixes of those strings (before they were reverted) confirmed
  them: Thai ไม่ได้ชนะ for not taken came back as "Not winning." The reviewer, asked again, proposed
  other Thai wording (ไม่ถูกนำมาคิด, "not counted") and restyled several judgeUnread sentences.

**Passed to lang/qa-pipeline**, not in f2a413c: (1) live.judgeUnread's second sentence has no full
stop, in every language that writes one (LanguageTool in en, de, fr, pt); (2) Thai verdict.notTaken
ไม่ได้มา reads first as "did not come" (MADLAD: "He didn't come."); ไม่ได้ชนะ ("not won", as de,
hi and vi say it) or ไม่ถูกนำมาคิด for a Thai reader to choose; (3) its Thai glossary match is a
substring and can be satisfied across a word boundary.

Also brought in by the integration and fixed here, in this branch's own code: the battle page gave the
world card's row and its equip label the catalog's English city (below).

### Fixed in code, with a test that was seen to fail

- **The record held to its sources.** `pages.test.ts` held the pages to `sourced-names.json` but not
  the record to the files it cites. It now does (Wikidata labels, CLDR cities and regions, and a
  label with only its first letter capitalised, which must say so). It found one value: Vietnamese
  Eurasia (above). Seen red on the record as it stood, a city CLDR names differently and a source it
  cannot read; `mutate-pages.mjs` gained two of those.
- **A count never before an agreeing noun** (README, "How the strings are built"): seen red on the
  Spanish and German descriptions as they were; a mutation puts the Spanish one back.
- **A month standing alone** is capitalised where CLDR 46's contextTransforms say so (es, fr, it, pl,
  ru: "Abr 2025" beside "Verano de 2025"). A unit test holds the list to the fetched record; the
  browser test now expects Polish "Mar 2025" and Spanish "Abr 2025"; a mutation drops Spanish.
- **No made-up italic** for Arabic, Hindi, Thai, Chinese, Japanese and Korean pages: the Arabic play
  titles on the home page had come out as slanted Arabic letters (`font-synthesis-style: none`).
- **The battle page's world card** ("World card: {city}", the integration's row, and the equip label
  and picker) showed the catalog's English city on every page language; it now names the city as the
  world map does. The engine still gets the English key, so nothing it scores changes, and
  `scripts/gen-verse-golden.sh` rewrote no golden file. The names (the `variants` area and the module
  that reads it) are imported after start-up and only for a player who owns a world card: imported
  with the page's script at first, they changed the page's start-up enough that
  `tests/sound.spec.ts` "a page load fetches no sound data" failed 4 times in 5 on the iMac Pro,
  against 1 in 5 for integrate/wave3 itself (that test races the page's designed idle prefetch of a
  `?lang=` duel language; see the last section).

The two browser tests were run against the code before each fix (a throwaway checkout with the old
`battle.astro` and `global.css`) to see them fail; see the last section for the result.

### Order of merging

These pages follow lang/qa-pipeline's newer conventions, which main's core files do not have yet:
Hindi Shakespeare शेक्सपीयर (18 page strings; main's core has शेक्सपियर twice), Thai sign in
ลงชื่อเข้าใช้ (2; core เข้าสู่ระบบ 24 times), the Vietnamese tone on the second vowel (20), and now
Hindi कविता for verse (15; core पद). French page strings use no-break spaces before : ; ! ? (61
lines), the core French ordinary spaces (58). If this branch lands before lang/qa-pipeline, a page
and the menu or duel strings around it spell these differently. **Land lang/qa-pipeline first, or
with this branch.** That branch has already merged integrate/wave3 and converted the integration's
16 core keys to its conventions (f2a413c); in this branch they are as the integration wrote them.

### Not translated, brought in by the integration

`src/pages/multiplayer.astro`, rewritten by the integration, is in English only (some 35 visible
strings in its markup, none through `t()` or a page area). No language branch was given it: the
earlier briefs left it out because it was being rewritten.

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
- Continuation, at 8f3a386 (every change of the continuation in; after it only these documents
  and CLAUDE.md changed), on the **iMac Pro** (the Studio was above `rb`'s load limit, 4 a core,
  all afternoon), test ports 47731 (web), 47732 (web without email), 47733 (API), 47734 (API without
  email), 47735 (Postgres), `E2E_TIMEOUT=90000`: `npm ci` passed, vitest **129 of 129**, build passed,
  mutation proof **15 of 15** caught and clean after, Playwright **146 of 146** (3.1 min, the two
  model-runtime downloads included). New in the suites since the last run: the battle and theatre
  titles in sixteen languages, the Arabic count and signed-number order (each with a planted
  failure that goes red), lists of words in every language, signed numbers in Arabic, and areas of
  other branches allowed beside these nine.
- **Second pass** (2026-11-17, integrate/wave3 merged), test ports 47831 (web), 47832 (web without
  email), 47833 (API), 47834 (API without email), 47835 (Postgres) on the Studio and 47841 to 47845
  on the iMac Pro, `E2E_TIMEOUT=90000`; the Studio stood at load 50 to 120 on 32 cores.
  - At 920a6d5, Studio: `npm ci` passed, vitest **346 of 346** (20 files), build passed (18 pages),
    Playwright 248 passed, 1 failed, 8 skipped (6.9 min), `cargo test --release` 49 + 135 + 8
    (`verse_parity`) passed. The failure was `tests/sound.spec.ts` "a page load fetches no sound data"
    (see the second pass above): 1 of 5 on integrate/wave3 itself and 4 of 5 with this branch on the
    iMac Pro, then 2 of 5 with the city names fetched lazily. lang/qa-pipeline fixed the same test
    meanwhile (d2185870: no duel language named, then ?lang=fr for the duel); its version is now this
    branch's, byte for byte. Because its page defaults the duel to English, whose table the check does
    not count, it still passes when the page is made to prefetch its default language on every visit
    (a planted fault, 1 of 1). This branch's version, a French page whose default duel language is
    French, is kept as a second test: 10 of 10 passed before the switch, and at 81feb5d both tests
    passed 5 of 5 each; under the planted fault it failed.
  - Mutation proof at d53cf60: **19 of 19** caught (4 new: the record against its source twice, a
    count before a noun, a lone month), clean after.
  - The two new browser tests (world card, no made-up italic) against the code before their fixes,
    iMac Pro: both failed (the picker said "TokyoのRomeo"; the Arabic home page reported
    `font-synthesis-style` auto).
  - At 13c0b6e (every code change in but the sound.spec switch above), Studio: `npm ci` passed,
    vitest **346 of 346**, mutation proof **19 of 19** and clean after, build passed (18 pages),
    Playwright 247 passed, 2 failed, 8 skipped (7.3 min), `cargo test --release` 49 + 135 + 8
    passed, `scripts/gen-verse-golden.sh` changed no file. The two failures are in the integration's
    own tests and touch nothing this branch changed: `multiplayer.spec.ts` "two signed-in players
    play a whole match" (passed 3 of 3 alone on the iMac Pro) and `auth.spec.ts` "forty accounts an
    hour for one /24", which counts every row of `users` while other tests sign up in parallel: it
    failed 3 of 3 on integrate/wave3 itself with `--repeat-each=3` beside the multiplayer test, and 2
    of 3 alone on this branch. The same commit on the iMac Pro: Playwright 248 passed, 1 failed, 8
    skipped (3.9 min); the failure, `auth.spec.ts` "sign up, sign out, sign in, add a second passkey",
    is the same fault: it expects `SELECT COUNT(*) FROM users` to grow by exactly one while other
    tests sign up beside it (23 expected, 24 found).
  - **At 81feb5d, the last code commit** (only these documents after it), iMac Pro: `npm ci` passed,
    vitest **346 of 346**, build passed (18 pages), Playwright **250 passed, 0 failed**, 8 skipped
    (4.1 min; 8 were skipped in every run today, among them the byte measurement that needs
    BYTES_URL; not identified one by one). Vitest, the mutation proof, `cargo test --release` and the
    golden files were not run again at this commit: the only change since 13c0b6e is
    `tests/sound.spec.ts`.
  - Screenshots and three engines, iMac Pro, inside the Playwright harness: Chinese and Arabic home,
    collection (with three card views) and world map (with the Cairo view) at 1280 and 390 wide, no
    page wider than its screen, every title the language's own, looked at; the battle page's world
    card in Japanese (東京のRomeo, 東京 (言葉遊び +2)) and Arabic (طوكيو). In Chromium 159, WebKit 27.2
    and Firefox 159 the Arabic pages put the count left of its total (11/71, 2/20), the sign left of
    its digits (+50, +2), write Latin digits, and slant no Arabic play title.

## Fourth pass: the copy the pages no longer stand behind (2026-11-19, fix/predeploy)

Owner decision D-03 took off the site what the code does not do. In these areas:

| key | was (English) | now |
|---|---|---|
| `about.vision.p1` | a card "springs to life with a 15-second AI-generated scene", AR, "a rap battle" | "a Shakespeare character challenges you to a duel of verses. You answer in a poetic form, line by line: on a screen, or on a 3D stage in a headset." |
| `world-map.intro` | variants unlock "through battles, trivia, and exploration" | "with a perfect trivia round" (the one place that awards one: `playground.astro`, `awardRandomVariant`) |
| `about.free.earn.*` (7 keys) | "Win a battle: +50", trivia +30, quote +20, daily +10 … | removed: nothing paid them (the economy's server rates arrive with the second deploy) |
| `about.tech.market.*` (2 keys) | "card value is influenced by combat rankings" | removed: a listing's price is the seller's |

Every language was written again for the two changed strings. The first version of `about.vision.p1`
said "challenges you in verse"; the glossary check below found nine languages using the word for a
poetic line where the game's word for a verse is fixed (es *en verso*, de *in Versen*), and another
word for a line (de *Vers für Vers*, ar *بيتًا بعد بيت*, ko *한 줄씩*). The English now uses the game's
name for itself, "a duel of verses", which every language says as its app name does (`app.name`:
el duelo de estrofas, das Duell der Strophen, дуэль строф, مبارزة الأبيات, 詩の決闘…), with the
glossary's word for a line.

**The tools could not run on this branch at first.** Every script here read every area under
`src/i18n/pages`, and once the play areas were merged beside these, `challenges/en.ts` (which
computes a value) stopped them all (`ReferenceError: CHALLENGE_BANK is not defined`).
`scripts/pages-lang/strings.mjs` now names the nine areas these tools check (`CORE_AREAS`) and fails
if one is missing; the other areas have pipelines of their own.

- **Mechanical** (`mechanical.mjs`, with this branch's `scripts/lang` as `QA_SRC`): self-test, all 18
  known-bad strings flagged; 10 open glossary findings on the first wording, **0 open** after it.
  The ALLOW entry for `about.free.earn.l2` ("a trivia round") moved to `world-map.intro`, which now
  says the same.
- **Spelling** (Hunspell, the pipeline's dictionaries, on the iMac Pro: the Studio was over `rb`'s
  load limit): on the two strings, only names (Shakespeare, Шекспира, 셰익스피어의, the pieces of
  เชกสเปียร์), loanwords the old strings had too (VR-Brille, हेडसेट, 헤드셋을, headset), the digit split
  of "3D" (D-сцене, D), and one new word, Korean 행씩 (행 with the counter suffix 씩, as in 한 사람씩),
  which the dictionary does not list. None is a misspelling.
- **Grammar** (LanguageTool 6.6, picky): no hit on either string in any language it covers.
- **Meaning**: **Meaning** (`meaning-run.sh` on the Studio, with this branch's `scripts/lang/backtranslate.py`:
  MADLAD-400 back to English, MiniLM and LaBSE; the 30 pairs `pairs.mjs --changed` found, then the
  rows merged into `bt.json`, the 135 rows of the nine removed keys dropped): the two strings score
  cosine 0.80 or more (median 0.92 and 0.88) and LaBSE 0.78 or more in every language; none is
  flagged by both. The word rule flagged `world-map.intro` in fr, pl, ru and hi as negated: each says
  a perfect round as "without a (single) mistake" (*sans faute*, *bez jednego błędu*, *без единой
  ошибки*, *बिना किसी गलती के*). Read and accepted in `allow-meaning.json`; the entry for the removed
  `about.free.earn.title` went with it. `meaning.mjs --bt bt.json`: every string scored, **0 open**,
  exit 0.
