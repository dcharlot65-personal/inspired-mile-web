# Rhyme and syllables by sound

How the duel decides, in each of its sixteen languages, whether two lines rhyme and how
many syllables a line has; where each answer comes from; and how well it does against
published verse, dictionaries and an independent phonemiser. Written 2026-11-16 on branch
`lang/phonetics`.

Code: `src/lib/verse/rhyme.ts` (rhyme), `src/lib/verse/text.ts` (syllables),
`src/lib/verse/sound/` (tables, loader, Japanese analyser, Thai parser, test sets, the
espeak-ng comparison). English is not covered here: its table comes from the CMU
Pronouncing Dictionary on branch `fix/rules-findings` and plugs into the same loader (see
"English" below).

## The design in one paragraph

A verse is free text, so nothing about it can be looked up in advance; what can be shipped
is knowledge about words. Each language gets the least that makes its rules true to the
sound: nothing where the spelling shows the sound (Polish, Korean, Vietnamese, Arabic's
rhyme letter), a small table of exceptions where a spelling rule is nearly always right
(Spanish, Portuguese, Hindi, Indonesian), a table of where the stress falls where only that
is missing (Russian, Italian), the pronunciation itself where spelling is a poor guide
(French, German), character readings (Chinese), word endings (Thai), and a
dictionary-driven analyser where readings depend on context (Japanese). A word the table
lacks falls back to the spelling rule, never to a refusal. Every table is a separate module
that is fetched only when a duel in that language starts (`loadSound(lang)`, called beside
`loadPack(lang)` on the battle and theatre pages); no page's first load includes any of it.
The lookups are exact string matches on data, so the same line gets the same answer on
every device. No platform segmenter or speech service is asked anything by the rhyme and
syllable rules (word splitting for Thai and Japanese in other devices still uses
`Intl.Segmenter`; see "Determinism").

Where the engine cannot read a language without its data (Chinese, Japanese, Thai), the
rhyming forms are offered only once the data is in; if it cannot be fetched, the duel is
planned with the structural forms, as before.

## What is offered now

| Language | Rhyming forms | Syllable forms | Changed by this work |
|---|---|---|---|
| es fr de it pt pl ru id ko vi | yes | yes | rules corrected from evidence; tables for es fr de it pt ru id |
| zh | yes (was no) | yes (a character is a syllable) | couplet, both quatrains, tercet, heroic couplet restored |
| ja | yes (was no) | yes, kanji included (was kana only) | the same five forms restored; haiku may be written in kanji |
| th | yes (was no) | no | couplet, both quatrains, tercet restored |
| hi | yes | yes (was no) | haiku and heroic couplet added |
| ar | yes | no | rhyme rule rewritten on the classical definition |

Each restored form needed two written verses for the opponent that plays without a model.
Twenty-eight verses were added to the zh, ja, th and hi packs. **They were written by a
language model and checked only by the engine's own form checks. No native speaker has read
them, and no grammar tool has been run on them** (the language-QA branch's LanguageTool
checks cover the interface strings, not these packs). They are marked with a dated comment
in each pack.

## Three kinds of evidence

Every figure below comes from one of three sets, and they answer different questions.

1. **Published verse** (`corpus/<lang>.json`): pairs of lines a poem's form rhymes, and
   pairs it keeps apart. The labels come from the form, not from the engine. This asks
   whether the rule hears rhyme as poets used it.
2. **Dictionary counts** (`corpus/syllables.json`): sixty words per language taken at
   even steps through a dictionary's sorted list, with the dictionary's syllable count (every
   count it gives, where it gives more than one). For French, German, Thai, Hindi and
   Indonesian the dictionary is the one the table was built from, so these confirm the
   pipeline more than they test it.
3. **espeak-ng on common words** (`corpus/espeak.json`): the 1,500 commonest words of each
   language in film and television subtitles, and how espeak-ng 1.52.0 says them. espeak-ng
   has its own rules and dictionaries and shares no data with the tables, and the word
   lists are frequency lists, so this is the check by a tool that did not write the
   answers. It was added on 2026-11-16 and found the faults listed under "What the
   comparison with espeak-ng found".

## Per language

Sizes are of the generated module as committed, raw and gzip -9 (what a server would send
compressed). "Rule agrees" is the spelling rule alone against the dictionary, over every
usable dictionary word, with no table loaded.

### Spanish (es)
- **Rule**: stress from the written accent or the orthographic rule; rhyme from the stressed
  vowel on. Syllables by the strong/weak vowel rule.
- **Table**: 1,135 words whose stress the rule gets wrong (loanwords, dictionary oddities).
  16.7 kB, 5.1 kB gzip. Source: Wiktionary via kaikki.org.
- **Measured**: rule stress agrees with the dictionary on 99.2% of 136,520 words. Against
  espeak-ng on common words: syllables 99.3%, stressed syllable 99.9%; the differences are
  espeak-ng's (it splits "lue-go", "ha-bé-is") and foreign names.
- **Not taken from the dictionary**: syllable counts. Where they differ the dictionary splits
  two vowels that verse joins (synaeresis); see "Syllable counts in the Romance languages".
- **Undecidable**: assonance (which Spanish verse also accepts) is not counted as rhyme.

### Italian (it)
- **Rule**: as Spanish, with two guesses where Italian spelling is ambiguous ("-ia"). A
  written accent marks the stress and never parts a diphthong ("più", "giù" are one
  syllable; until 2026-11-16 they were two).
- **Table**: 27,553 words whose stress the spelling does not show or the rule guesses wrong
  (every word stressed three syllables from the end: "tavola", "anima", "parlano").
  290 kB, 67 kB gzip. Source: Wiktionary via kaikki.org.
- **Measured**: rule stress agrees with the dictionary on 71.9% of 84,485 words, which is why
  Italian has a table. Against espeak-ng: syllables 92.3% (every difference read was
  synaeresis, "mio" one syllable in verse and two in espeak-ng, or espeak-ng reading "-zio-"
  as two), stressed syllable 98.2%, and 90.6% with the table removed.
- **Known gap**: inflected and clitic forms the dictionary has no transcription for are
  stressed by the rule, which says the last syllable but one. That is wrong for
  "servono", "regole", "piccoli", "dollari", "avrebbero" and for imperatives with a pronoun
  ("lasciami", "guardami"): 18 of the 24 stress differences on 1,356 common words (the
  other six are foreign names and one espeak-ng error, "oddio"). Taking the stress of a form
  the table has that differs only in its closing vowel ("regole" from "regola") was tried and
  measured: it fixed those nouns and broke verbs ("capito" took the stress of "capita"),
  and agreement fell from 98.2% to 97.8%, so it was not adopted. One table entry is known wrong: the
  source's transcription of "cristianizzazione" puts the stress on "-tia-".
- **Undecidable**: open against closed e and o are not distinguished; Italian verse rhymes
  them freely.

### Portuguese (pt)
- **Rule**: stress from accents and the orthographic rule; rhyme from the stressed vowel on.
  Unaccented "-ia", "-io", "-ua" after a consonant is stressed on the i or u ("dia", "rua");
  after a vowel it is not a hiatus ("meio", "odeio"; until 2026-11-16 it was read as one).
- **Table**: 1,444 words. 17.9 kB, 5.7 kB gzip. Source: Wiktionary via kaikki.org. Rebuilt on
  2026-11-16: the stressed letter is now found by the stressed vowel's quality, and the stress
  is the one most of a word's transcriptions give. The old table put the stress of "pessoal",
  "especial", "real" on the vowel before "-al" (the vocalised l of Brazilian speech shifted
  the count), of "caixa" on the i and of "seguinte" on the last syllable; all common
  rhymes on "-al", "-aixa", "-inte" were refused.
- **Measured**: rule stress agrees with the dictionary on 97.6% of 59,183 words; rule syllable
  count on 87.4% of 59,646 (the dictionary's first transcription is Brazilian, which adds
  vowels the spelling does not have and splits "i-a", "i-o" that verse usually joins).
  Against espeak-ng (Brazilian voice): syllables 95.6%, stressed syllable 99.0%; the rest are
  foreign names, "porque" (Wiktionary stresses its last syllable, espeak-ng its first) and
  "-ião" words, where the measuring function, not the rhyme, splits "ão".

### French (fr)
- **Table**: 84,049 word forms with syllables as counted in verse, a flag for a closing mute
  e, and the rhyme (last vowel and what follows). 998 kB, 241 kB gzip. Source: Wiktionary via
  WikiPron.
- **How the count is chosen** (rebuilt 2026-11-16): WikiPron lists several transcriptions per
  word in sort order, and the build used to take the first, often a Quebec one ("a ɛ d" for
  "aide", two syllables) or one without the e caduc ("p t i t", "petite" one syllable). Now
  Quebec variants are set aside, a transcribed closing schwa is the mute e (until then
  "prendre" rhymed on "ə" and not with "rendre"), the fullest variant the spelling can hold is
  taken, and the count is never below the spelling's vowels: verse sounds the e of
  "pe-tite", "se-maine", "de-main". A closing "-ent" said in some transcriptions and silent in
  others ("président" the noun and the verb) is counted as said; "-que" and "-gue" close on a
  mute e ("chaque jour" is three).
- **Rule** (fallback for a word not in the table): the previous spelling rule.
- **Verse counting**: a closing mute e is one more syllable before a consonant and silent at
  the end of the line or before a vowel.
- **Measured** against espeak-ng: syllables 94.1% (92.7% with the table removed). The
  differences read are verse against speech (espeak-ng drops the e caduc of "maintenant",
  "revenir"), espeak-ng writing the glide of "suis", "depuis" as a vowel, and diaeresis
  choices ("hier", "jouer"). Words the table lacks fall to the rule, which has no mute
  "-ent" ("doivent" two).
- **Undecidable**: diaeresis ("li-on" against "lion") is the poet's choice; homonyms that
  rhyme ("nue / nue") are refused, because a word never rhymes with itself.

### German (de)
- **Table**: 71,649 words with syllables and the rhyme from the last stressed vowel.
  1.29 MB, 457 kB gzip. Source: Wiktionary via kaikki.org. Rebuilt on 2026-11-16, after the
  comparison with espeak-ng showed: a sound written as "/phonemic/ [phonetic]" in one string
  was skipped, so a regional variant stood for the word ("Leute" as "lɔe̠də", which did not
  rhyme with "heute"); diphthongs and the r after a vowel written without the glide mark
  were counted as two syllables ("heraus" three, "Bar" two); χ, the "ch" of "Bach", was read
  as r ("Wochen" rhymed with "Born" and not with "gebrochen"); a syllabic n written without
  its mark was dropped ("Wochen", "wären" one); and diphthongs were merged in sequence
  ("Verzeihung" two).
- **Compounds**: a word the table lacks is read on the longest ending in it that leaves a
  word-like part in front ("Zauberversgedicht" rhymes and counts as "…gedicht"). The cut may
  not fall inside a vowel pair or a "sch", "ch", "ck": "reicht" was read as "re" + "icht" and
  rhymed with "Licht"; "scheint" as "sc" + "heint". The spelling rule likewise no longer
  finds a shorter ending inside a vowel pair.
- **Tolerance** (from the Busch set): vowel length is not compared and rounded front vowels
  rhyme with their unrounded partners ("Stück / dick", "neu / dabei"), the impure rhyme
  German verse has always used. Without it 4 of 60 real rhymes more are refused.
- **Measured**: the spelling rule's syllable count agrees with the dictionary on 96.0%.
  Against espeak-ng: syllables 97.6%; the rest are loanwords (Baby, Job, Team) and
  espeak-ng's own reductions ("unsre"). With the table removed the figure is 97.8%: on the
  commonest words the spelling rule is already right, and the table earns its place on the
  rest of the vocabulary and on rhyme.

### Polish (pl)
- **Rule only, no table**: stress is on the last syllable but one; the rhyme is read from
  the spelling with final and assimilated devoicing ("chleb / sklep").
- **Tolerance** (from Pan Tadeusz): closing ą with o, i with y, soft with hard sibilants.
- **Measured**: rule syllable count agrees with Wiktionary on 98.7% of 160,770 words, and with
  espeak-ng on 99.2% of common words.

### Russian (ru)
- **Table**: the stressed vowel of 399,857 word forms. 3.72 MB, 515 kB gzip. Source:
  Wiktionary via kaikki.org. The largest table: Russian stress is free, moves within a
  word's own forms, and is not written.
- **Rule with the table**: rhyme from the stressed vowel on, unstressed vowels compared as
  they are said, closing consonants unvoiced, unpronounced consonants dropped ("чувства").
  ё and one-vowel words need no table.
- **Fallback**: when either word is not in the table, the previous end-of-word rule decides
  for both. It cannot hear stress ("сцена / луна" passes).
- **Measured** against espeak-ng: syllables 99.8%, stressed syllable 99.2%. In every
  remaining difference read (сто́роны, господа́, по́воду, моему́) the table is right and
  espeak-ng is not.
- **Undecidable**: a word with two stresses for two meanings ("ро́дин / роди́н") rhymes on
  either.

### Indonesian (id)
- **Rule**: the last vowel and what follows it; an open final vowel rhymes on the vowel
  alone, which is how Malay verse rhymes ("dunia / teperdaya"). Syllables: each vowel,
  with a closing ai, au, oi as one.
- **Table**: 512 words whose syllable count the rule gets wrong. 5.9 kB, 2.5 kB gzip.
  Source: Wiktionary via kaikki.org. Rebuilt 2026-11-16: the count was read from syllable
  breaks, which a transcription may mark only in part ("/apa.kah/", two) or twice
  ("/pri.ˈba.di/", four), and from the first transcription alone. It is now the vowels of
  every transcription, and the rule is overridden only where none agrees with it.
- **Measured**: rule syllable count agrees on 97.6% of 21,741 words; against espeak-ng 96.6%.
- **Undecidable without a dictionary of roots**: whether a written "ai" or "au" is one
  syllable. The official spelling standard (EYD; formerly PUEBI) makes ai, au, oi and ei
  diphthongs that are never divided, but which written pairs are diphthongs is a matter of
  the word: KBBI divides "ba·ik", "ma·in", "me·nyu·ka·i" (suka + i) and keeps "pan·tai",
  "sau·da·ra", "me·mu·lai". Of the 20 common words on which the table and the rule still
  differ, each is right on about half. Initialisms ("API") are left out of every table:
  lower-cased they collide with ordinary words ("api", fire).

### Vietnamese (vi)
- **Rule only**: a written word is a syllable; rhyme on the rime and the tone class.
- **Tolerance** (from Truyện Kiều): the near-rhyme (vần thông) with the same closing sound
  and vowels of one family. Strict rhyme alone hears 34 of 60 of the poem's rhymes; with
  the tolerance 56, and still refuses all 30 non-rhymes.
- **Measured**: one word, one syllable agrees with Wiktionary on 98.6% of 26,911 entries.
- **Undecidable**: a loanword written as one word ("protein", three syllables) counts as one.

### Korean (ko)
- **Rule only**: Hangul decomposes by arithmetic into initial, vowel and final; rhyme on
  vowel and final as spoken. A block is a syllable (agrees with every one of 30,385
  Wiktionary words).

### Chinese (zh)
- **Table**: for 44,358 characters, the rhyme group and tone of each reading; for 4,348
  words, the reading of a last character that has more than one ("银行" is háng, "流行"
  is xíng). 514 kB, 168 kB gzip. Sources: Unicode Unihan 18.0 and CC-CEDICT.
- **Rule**: two lines rhyme when their last characters' finals are in the same rhyme group,
  or in groups one of the two published schemes joins, whatever the tone; the same
  character twice is not a rhyme. A character with several readings and no word to settle
  it may rhyme on any of its common readings.
- **Rhyme groups, checked 2026-11-16**: the sixteen of 中华通韵 match, final for final, the
  table printed in the Ministry of Education's 2018 call for poems (中华通韵（十六韵）
  草案; the source is named under "Sources"). The final standard (GF 0022-2019) was not
  seen; the draft is what was compared. The groups joined beyond that come from 十三辙, as
  zh.wikipedia tabulates it: e with o and uo (梭波), i with ü and er (衣七), eng and ing with
  ong and iong (中东). The check corrected one thing: o and uo had been joined to ie and üe,
  which neither scheme does ("我 / 夜", "躲 / 灭" passed). e is now its own group, joined to
  each side.
- **Undecidable**: classical tone-class rules (level against oblique) are not enforced; the
  one non-rhyme let through in the Tang set ("路 / 如") is a rhyme in today's Mandarin by
  its final.

### Japanese (ja)
- **Engine, not a table**: kuromoji.js 0.1.2 with the mecab-ipadic 2.7.0 dictionary, run in
  the browser. Twelve dictionary files, 17.8 MB as fetched (they are already gzip), loaded
  only for a Japanese duel.
- **Syllables**: morae of the reading, so a haiku may be written in kanji.
- **Rhyme**: the vowels of the last two morae of each line agree, as Japanese lyric writing
  rhymes; lines that close on the same word are compared on the word before.
- **Without the analyser** (not loaded, or failed to load): kana only, as before, and no
  rhyming forms.
- **The haiku brief still says "write in kana"** (`form.haiku.brief.kana`). That is left as
  it is on purpose: a kanji's reading is the analyser's statistical choice (it picks one
  reading of 蛙, and a poet may mean the other), so kana remains the only way to be sure of
  the count. The line's label "かなで{n}音" is shown for kanji lines too.
- **Undecidable**: a poet's chosen reading of a kanji cannot be known. Latin letters and
  digits have no reading, so a line that contains them is not counted. espeak-ng cannot
  check Japanese (it reads kana only), so the counts are checked against JMdict, a
  dictionary independent of the analyser's.

### Thai (th)
- **Table**: 17,219 words with syllable count and the rime of the last syllable.
  346 kB, 89 kB gzip. Source: Wiktionary via WikiPron.
- **Rule**: a line rhymes on the longest dictionary word it ends on; an ending the table
  lacks is read by spelling patterns (`sound/th.ts`), which agree with the dictionary on
  94.9% of the 17,219 words. Vowel length is compared: a short vowel does not rhyme with a
  long one, as in Thai verse.
- **Syllable forms are not offered.** Counting needs every word of a line in the table, and
  free Thai text is not; `thaiSyllables` answers "cannot count" rather than guess.
- espeak-ng cannot check Thai: its Thai voice reads letter by letter ("ความรัก" as six
  syllables), so no independent figure exists here.

### Hindi (hi)
- **Rule**: Devanagari is read as it is said, with the unwritten "a" taken out where Hindi
  drops it (schwa deletion). Syllables are the vowels that remain.
- **Tolerance** (from Kabir): a breathed consonant with its plain partner, the retroflex n
  with n, the three s sounds.
- **Table**: 1,099 words whose syllable count the rule gets wrong. 20.7 kB, 5.7 kB gzip.
  Source: Wiktionary via WikiPron. Rebuilt 2026-11-16: the first transcription in sort order
  stood for the word, and a narrow one ("t͡ʃ ɑː eː") made "चाय", "नाव", "मैं" two syllables
  although WikiPron also lists the one-syllable reading; a vowel marked as a glide ("ə̯")
  was counted. The rule is now overridden only where none of the transcriptions agrees.
- **Measured**: the rule's syllable count agrees with the dictionary on 96.4% of 30,374 words,
  and with espeak-ng on 95.1% of common words. Of the remaining differences most are
  espeak-ng's: it deletes the unwritten a only at the end of a word ("पहले" three, "मतलब"
  three).

### Arabic (ar)
- **Rule only**: the classical definition, read from the text: the rhyme letter (rawi), the
  long vowel before it (ridf), the long vowel or h after it (wasl), and the vowel on the
  rhyme letter wherever both words show it. No dictionary is needed for this.
- **Syllable forms are not offered and cannot be.** Unvocalised Arabic does not write its
  short vowels. The open tools that restore them (Mishkal, CAMeL Tools, Shakkala) are
  statistical guesses about which word was meant; counting on a guess would refuse correct
  verse. espeak-ng shows the same: given "كتاب" it guesses "kitaːb". Fully vocalised text
  could be counted; players do not type it.

### English (en)
Not part of this work. `fix/rules-findings` adds `pronounce.ts` and a table reduced from the
CMU Pronouncing Dictionary. It has the same shape as the tables here (a lazily imported
module, a loader, "not known" when absent, spelling rules as the fallback). A trial merge on
2026-11-16 (not committed) conflicts in rhyme.ts and text.ts (headers, imports, the
neighbouring syllable functions: keep both sides), verse.test.ts (load both) and
battle.astro (their DuelSession replaces the page's own duel loop). To join English to the
loader when it lands on `main`:

1. `sound/index.ts`: `ENGINE_LOADERS.en = () => import('../pronounce').then((m) => m.loadPronunciation())`.
2. `session.ts`: `if (baseLang(this.duel.lang) === 'en') await loadPronunciation();` becomes
   `await loadSound(this.duel.lang);`, so every language's data is waited for in one place,
   and the page's own `loadSound` call goes with the page's old duel loop.
3. `text.ts` `syllableSpan`: the span is a single number outside English; Indonesian "ai"
   and "au", Romance synaeresis and French diaeresis are the cases a span would serve next
   (see "Not finished").

## What the comparison with espeak-ng found

Method: `scripts/sound/espeak-check.py` takes the first 1,500 words of each frequency list
written wholly in the language's letters and runs `espeak-ng -q --ipa --sep=_ -v <voice>` on
them; `sound/crosscheck.ts` reads both answers as syllables and the stressed syllable.
espeak-ng's own habits are allowed for, each seen in its output: it writes the glide of a
diphthong as a vowel in Italian, French and Portuguese ("s_ˈɛ_i" for "sei") and marks a
real hiatus with an empty phoneme ("m_ˈi__o"); "X^" is a consonant's release; the Brazilian
voice writes a schwa after a tap. Stress agrees when the same syllable is stressed counted
from the start or from the end, so that "sto-ria" against "sto-ri-a" is not counted as a
difference.

| Lang | Voice | Syllables agree | Stressed syllable agrees | With the table removed |
|---|---|---|---|---|
| es | es | 99.3% | 99.9% of 1,352 | the same |
| it | it | 92.3% | 98.2% of 1,356 | stress 90.6% |
| pt | pt-br | 95.6% | 99.0% of 1,318 | stress 98.9% |
| fr | fr-fr | 94.1% | - | 92.7% |
| de | de | 97.6% | - | 97.8% |
| pl | pl | 99.2% | - | no table |
| ru | ru | 99.8% | 99.2% of 1,257 (28 words not in the table) | stress known for 19 words |
| id | id | 96.6% | - | 97.0% |
| hi | hi | 95.1% | - | 94.8% |

Agreement is not accuracy. Each language's disagreements were read (the "Per language"
sections say what they are); where they were the engine's, the cause was fixed, and the 40
regression assertions in `sound.test.ts` ("no longer makes the mistakes the comparison
found") hold the fixes: 35 of them fail on the code before the fixes. The floors in the
same test sit a little under the figures above. For French, German and Indonesian the
table agrees with espeak-ng no better than the spelling rule does on common words, for
different reasons: French because verse counts what speech drops, German because its common
words are regular, Indonesian because neither source settles "ai" (above).

## Measured accuracy

Rhyme: against one published poem per language whose form says which lines rhyme (labels
come from the form, not from the engine). Counts: against 60 dictionary words per language,
taken at even steps through the dictionary's sorted word list; a count is right when it is
one the dictionary gives. Figures are from `scripts/sound/measure.mjs` on 2026-11-16 and are
recorded in `src/lib/verse/sound/corpus/expected.json`.

| Lang | Poem | Real rhymes heard | Non-rhymes refused | Counts right | Count source |
|---|---|---|---|---|---|
| es | Sor Juana, Redondillas; Espronceda, Canción del pirata | 42/43 | 38/38 | 60/60 | Wiktionary |
| fr | Boileau, L'Art poétique I, 1-100 | 49/50 | 50/50 | 60/60 | Wiktionary (same source as the table) |
| de | Busch, Max und Moritz, Streiche 1-3 | 57/60 | 60/60 | 60/60 | Wiktionary (same source as the table) |
| it | Dante, Inferno I, 1-91 | 56/59 | 30/30 | 59/60 | Wiktionary |
| pt | Camões, Os Lusíadas I, 1-9 | 45/45 | 27/27 | 59/60 | Wiktionary |
| pl | Mickiewicz, Pan Tadeusz I, 1-100 | 48/50 | 50/50 | 60/60 | Wiktionary |
| ru | Pushkin, Tsar Saltan, 1-96 | 47/48 | 47/48 | 60/60 | Wiktionary |
| ar | Imru' al-Qais, Mu'allaqa | 50/50 | 38/38 | not counted | - |
| hi | Kabir, Granthavali, sakhis | 42/48 | 45/45 | 60/60 | Wiktionary (same source as the table) |
| zh | 唐詩三百首, 49 quatrains | 46/49 | 48/49 | 60/60 | CC-CEDICT |
| ja | none (see below) | - | - | 60/60 | JMdict, independent of the analyser's dictionary |
| ko | none (see below) | - | - | 60/60 | Wiktionary |
| vi | Nguyễn Du, Truyện Kiều, 1-120 | 56/60 | 30/30 | 58/60 | Wiktionary |
| th | Sunthorn Phu, Nirat Phukhao Thong | 60/60 | 40/40 | 60/60 | Wiktionary (same source as the table) |
| id | Raja Ali Haji, Gurindam Dua Belas | 45/46 | 43/43 | 60/60 | Wiktionary (same source as the table) |

What the misses are (`measure.mjs --show` lists every one):

- Old spelling in the edition: "bergantin / confin" (es), "źrenice / kobiéce" (pl), OCR
  damage in the Kabir text (hi).
- Rhymes of their time that today's sound has undone: Dante's Sicilian "desse / venisse",
  three Tang rhymes (事/未, 去/處, 美/裡), Mickiewicz's "nóżki / pończoszki".
- A word rhymed with its homonym: "nue / nue" (fr), "volto / vòlto" (it). Refused on purpose.
- Comic or loose rhymes: Busch's "Höh / herrjemine", "dieses / es".
- Vietnamese near-rhymes outside the three vowel families (4 of 60).

Read these figures for what they are. One poem per language is a small sample of one
poet's practice, and the rebuilt tables left every poem's figures where they were: the
faults espeak-ng found are in common words the poems do not happen to rhyme on. That is why
the third kind of evidence was needed.

### Japanese and Korean have no rhyme set

Neither tradition rhymes: there is no public-domain Japanese or Korean poem in a fixed
rhyme scheme from which pairs could be labelled without the labeller deciding what rhymes.
Kim Sowol's "진달래꽃" repeats an ending three times, which is three pairs, not forty. The
unit tests carry a handful of hand-made pairs for each and say so; the measured-accuracy
requirement for rhyme is **not met** for ja and ko.

## Syllable counts in the Romance languages

For es, it and pt the dictionary's count was measured but is deliberately not used. Where
it differs from the spelling rule the dictionary is nearly always splitting two vowels that
verse joins: "mio", "tuo", "via" are two syllables in a dictionary and one in a line of
verse. Taking the dictionary's count made the Italian pack's own heroic couplets count
twelve. The branch `fix/rules-findings` introduces a syllable span (a line may count from n
to m); when it lands, the dictionary's count belongs in it as the upper bound. The test sets
for these languages keep every count a word's transcriptions give: a phonemic transcription
may leave a glide unmarked that the phonetic one marks ("/automutiˈlaɾ/" six,
"[au̯.t̪o.mu.t̪iˈlaɾ]" five), and until 2026-11-16 only the first counted. A syllable break
written twice (".ˈ") is also counted once now.

## Download size and load time

| Language | What is fetched | Raw | Gzip |
|---|---|---|---|
| pl ko vi ar | nothing | 0 | 0 |
| id | table | 5.9 kB | 2.5 kB |
| es | table | 16.7 kB | 5.1 kB |
| pt | table | 17.9 kB | 5.7 kB |
| hi | table | 20.7 kB | 5.7 kB |
| it | table | 290 kB | 67 kB |
| th | table | 346 kB | 89 kB |
| zh | table | 514 kB | 168 kB |
| fr | table | 998 kB | 241 kB |
| de | table | 1.29 MB | 457 kB |
| ru | table | 3.72 MB | 515 kB |
| ja | analyser code and twelve dictionary files | 17.8 MB | 17.8 MB (already compressed) |

These are the generated modules. In the production build of 2026-11-16 (`npm run build`,
this branch merged with `main`) each table is one chunk, raw and gzip -9: id 4.7 kB / 2.3 kB,
es 14.2 / 4.9 kB, pt 14.9 / 5.5 kB, hi 18.4 / 5.4 kB, it 235 / 65 kB, th 311 / 86 kB, zh 417 /
162 kB, fr 830 / 231 kB, de 1.15 MB / 446 kB, ru 2.92 MB / 477 kB; the Japanese analyser is a
29 kB chunk (8.9 kB gzip). The Japanese dictionary is eight files
emitted as assets, 17,788,982 bytes in all (`tid_pos` 5.9 MB, `base` 4.0 MB, `check` 3.1 MB,
`cc` 1.7 MB, `tid` 1.6 MB, `tid_map` 1.5 MB, `unk` and `unk_pos` 11 kB each), and the four
smallest inlined in the analyser's chunk.

Time for `loadSound(lang)` to resolve in headless Chromium, measured by `tests/sound.spec.ts`
against the dev server on the build host on 2026-11-16 (the final run, this branch merged with
`main`; the host at about 4 load per core, 10 test workers): es 6 ms, fr 72 ms, pt 83 ms, id 114 ms,
hi 123 ms, th 148 ms, zh 190 ms, de 261 ms, it 272 ms, ru 1,248 ms, ja 1,755 ms; pl, ko, vi, ar 0.
The run before it, on a busier host, gave ru 3,336 ms and de 896 ms; an earlier one on a quiet
host es 5, id 9, pt 15, hi 41, it 52, th 63, zh 88, fr 146, de 209, ru 813, ja 1,068 ms. That is parse and install time with no network in the way; the
Russian table is the slow one to parse (400,000 entries). **Download time over a real connection was not measured**; it
follows from the gzip sizes above (Russian's 515 kB and Japanese's 17.8 MB are the two a
player on a slow link will notice).

## Determinism

The rhyme and syllable rules are pure functions of the line and the loaded data. The digest
of every answer over every test set (`sound/digest.ts`) is recorded by plain Node
(`measure.mjs`) and must be reproduced by the unit-test runner and by a real browser
(`tests/sound.spec.ts`, which loads each language's data the way a duel does). Intl.Segmenter
is not used by any rhyme or syllable rule while the language's data is loaded: Chinese is
compared on its last characters, Thai on dictionary words cut by a fixed rule, Japanese on
the analyser's tokens. It is still used by `wordsOf` for Chinese, Japanese and Thai words:
in the bonus devices (alliteration, repetition); in Thai's structural forms, whose line
lengths (crescendo) and first and last words (anaphora, epistrophe) are segmenter words;
and for a Japanese line's last word when the analyser is not loaded (no rhyming form is
offered then). A browser that segments a rare Thai phrase differently can score those
differently; that was not tested across browsers.

## Sources and provenance

Everything below was fetched on 2026-11-16.

| What | Used for | From | Version | Licence |
|---|---|---|---|---|
| Wiktionary pronunciations, machine-readable | tables es it pt de ru id; test sets es it pt pl de ru id | kaikki.org (`kaikki.org-dictionary-<Language>.jsonl`, made with wiktextract), reduced by `scripts/sound/kaikki-filter.py` | extracts dated 2026-10-30 (Last-Modified header). The it extract fetched 2026-11-16 has one transcription the earlier fetch lacked; de, pt, id rebuilt byte for byte from the earlier code | CC BY-SA 4.0 and GFDL (Wiktionary's) |
| Wiktionary pronunciations, word and IPA | tables fr th hi; test sets fr th hi ko vi | WikiPron, github.com/CUNY-CL/wikipron, `data/scrape/tsv/` (`fra_latn_broad`, `tha_thai_broad`, `hin_deva_broad`, `kor_hang_narrow`, `vie_latn_hanoi_narrow`) | commit d282e848a211 (2026-07-23); sha256 fra 86596b51…, hin 7f154171… | data CC BY-SA 4.0 (Wiktionary's); code Apache-2.0 |
| Unihan database, `Unihan_Readings.txt` (kMandarin, kHanyuPinlu, kTGHZ2013, kXHC1983) | table zh | unicode.org/Public/UCD/latest/ucd/Unihan.zip | Unicode 18.0.0, file dated 2026-07-31; zip sha256 4c93ea9c… | Unicode License v3 |
| CC-CEDICT | table zh (words that settle a reading); test set zh | mdbg.net/chinese/export/cedict | export dated 2026-11-16T07:16:40Z; sha256 9cd65ffb… | CC BY-SA 4.0 |
| 中华通韵（十六韵）草案, the table of sixteen groups and their finals | checking the Chinese rhyme groups | the Ministry of Education's 2018 call for poems (教育部语言文字应用管理司 and 中华诗词学会), as forwarded at tjx.cueb.edu.cn/tzgg/92900.htm | notice of 2018-05-07; page sha256 1d3bd70a… | a government notice; facts only were used |
| 十三辙, its thirteen ruts and their finals | the Chinese groups joined across | zh.wikipedia.org, article 十三轍 (wikitext) | revision current on 2026-11-16; sha256 0b81efb9… | CC BY-SA 4.0; facts only were used |
| espeak-ng | the independent check (`corpus/espeak.json`); not shipped | Homebrew `espeak-ng`, on the dev Mac and the build host | 1.52.0 | GPL-3.0-or-later (a tool run; its output is test data and nothing of the program ships) |
| Frequency lists from OpenSubtitles 2018 | the words of the independent check | github.com/hermitdave/FrequencyWords, `content/2018/<lang>/<lang>_50k.txt` (hi: `hi_full.txt`) | commit 525f9b560de4 (2022-02-07) | content CC BY-SA 4.0; code MIT |
| EYD (Ejaan yang Disempurnakan), the rule that ai, au, oi, ei are not divided | the Indonesian syllable rule and its limits | the official spelling standard of Badan Bahasa (EYD edisi V, 2022; PUEBI before it); read through the copies cited in search, not the official PDF | - | an Indonesian regulation (not protected by copyright under UU 28/2014, art. 42) |
| kuromoji.js | Japanese analyser | npm `kuromoji` | 0.1.2 | Apache-2.0 |
| mecab-ipadic | the analyser's dictionary, inside the kuromoji package | - | 2.7.0-20070801 | NAIST licence (free use and redistribution with the notice) |
| JMdict | test set ja (60 words) | ftp.edrdg.org/pub/Nihongo/JMdict_e.gz | created 2026-11-16 | CC BY-SA 4.0 (EDRDG) |
| Wikisource texts | rhyme test sets | the page of each poem; URL and date in each `corpus/<lang>.json` | - | texts public domain (every author died over a century ago); transcriptions CC BY-SA 4.0 |

Poems: es.wikisource Redondillas and Canción del pirata; fr.wikisource Boileau, L'Art
poétique, Chant I; de.wikisource Max und Moritz, Erster to Dritter Streich; it.wikisource
Divina Commedia, Inferno, Canto I; pt.wikisource Os Lusíadas (grafia atualizada), I;
pl.wikisource Pan Tadeusz (wyd. 1834), Księga pierwsza; ru.wikisource Сказка о царе Салтане;
ar.wikisource معلقة امرئ القيس; hi.wikisource कबीर ग्रंथावली, two chapters; zh.wikisource
唐詩三百首 and 49 poem pages (each URL in `corpus/zh.json`); vi.wikisource Truyện Kiều;
th.wikisource นิราศภูเขาทอง; id.wikisource Gurindam Dua Belas.

**Licence consequence for shipping.** The tables are derived from CC BY-SA 4.0 data
(Wiktionary, CC-CEDICT). Shipping them requires attribution to those sources on the site
and that the tables themselves stay under CC BY-SA 4.0; each generated module names its
source and licence in its header. The site has no such credit yet. The mecab-ipadic notice
must travel with its dictionary files. This is the owner's call before deployment.

## Rebuilding

```bash
# 1. Fetch (a few GB pass through; about 60 MB is kept). Light enough for the dev Mac.
for L in Italian Russian German Spanish Portuguese Polish Indonesian; do
  curl -sL https://kaikki.org/dictionary/$L/kaikki.org-dictionary-$L.jsonl \
    | python3 -I scripts/sound/kaikki-filter.py <src>/kaikki_<code>.tsv
done
#    plus WikiPron's fra_latn_broad, tha_thai_broad, hin_deva_broad, kor_hang_narrow, vie_latn_hanoi_narrow .tsv,
#    Unihan.zip (unzipped to <src>/unihan/), CC-CEDICT as <src>/cedict.txt, JMdict_e.
# 2. Build the tables, the counted sets and docs/language/measurements.json (--only es,fr for some).
node --import ./scripts/sound/ts-resolve.mjs scripts/sound/build.mjs --src <src>
# 3. Rebuild the rhyme sets from fetched Wikisource pages.
python3 -I scripts/sound/corpus.py <folder of fetched pages>
# 4. The independent check: frequency lists in <freq> (hermitdave/FrequencyWords, commit above), espeak-ng on PATH.
python3 -I scripts/sound/espeak-check.py <freq> > src/lib/verse/sound/corpus/espeak.json
node --import ./scripts/sound/ts-resolve.mjs scripts/sound/crosscheck.mjs --show 40
# 5. Measure, and record the digests the tests must reproduce.
node --import ./scripts/sound/ts-resolve.mjs scripts/sound/measure.mjs --show --write --kuromoji node_modules/kuromoji
```

`scripts/sound/mutate-sound.mjs` (build host) breaks twenty things one at a time (rules,
tables, test sets, a written verse, the espeak-ng reader, the recorded digest) and expects
the sound tests to go red each time; the branch report has the run. `tests/prod-smoke.spec.ts`
loads the Japanese dictionary from a built site; with one file removed from `dist/` it fails.

## Not finished, not verified

- **No native speaker has read the 28 verses added to the zh, ja, th and hi packs**, and no
  grammar tool has checked them. A language model wrote them; the engine's form checks are
  the only check they have had.
- **A pack verse for the pack's owner**: the second Chinese jueju written for `main`
  ("尔诗如残烛 / 风来便自灭 / 我句似朝阳 / 照尔无处躲") does not rhyme on lines 2 and 4
  (灭 miè, 躲 duǒ) in either published scheme. The jueju form checks only its shape, so the
  pack's test passes; adding the jueju's rhyme check, which the readings now allow, waits
  for that verse to be rewritten. Until 2026-11-16 the engine would have passed this pair.
- **The final text of GF 0022-2019 was not seen**; the 2018 draft's table was.
- **Japanese and Korean have no rhyme test set from published verse** (reason above).
- **Indonesian "ai" and "au", Romance synaeresis and French diaeresis are one number each**,
  where the honest answer is a range. The syllable span of `fix/rules-findings` is the place
  for it.
- **Italian inflected forms** the dictionary has no transcription for are stressed by the
  rule (18 of 1,356 common words wrong, listed above).
- **Hindi words that close on a consonant cluster** ("क्षेत्र", "पत्र", "राज्य", "कार्य"): the
  rule, like Wiktionary, drops the closing "a" and counts one syllable; espeak-ng and the
  textbook statement of schwa deletion keep it (kshe-tra). Keeping it was tried and measured:
  agreement with Wiktionary fell from 96.4% to 92.5%, so it was not adopted. Which one Hindi
  verse counts was not settled.
- **Arabic and Thai have no syllable forms**, for the reasons given under each.
- **Thai counts greedily.** `thaiSyllables` cuts a line into dictionary words longest-first
  from the left with no backtracking; it is not used by any form.
- **Attribution for the CC BY-SA sources is not on the site.**
- **The Japanese analyser from the production build was loaded in Chromium against
  `astro preview` on the build host only**, not through Caddy or a CDN. A server that adds
  `Content-Encoding: gzip` to the `.gz` files is handled in code (the loader checks the gzip
  magic bytes) and is untested. `tests/prod-smoke.spec.ts` checks it after a deploy.
- **No download was timed over a real network.**

Anything measured in a browser, and the state of the test suites on the build host, is in
the branch report rather than here, because it depends on the run.
