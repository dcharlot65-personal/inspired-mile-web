# Rhyme and syllables by sound

How the duel decides, in each of its sixteen languages, whether two lines rhyme and how
many syllables a line has; where each answer comes from; and how well it does against
published verse and dictionaries. Written 2026-11-16 on branch `lang/phonetics`.

Code: `src/lib/verse/rhyme.ts` (rhyme), `src/lib/verse/text.ts` (syllables),
`src/lib/verse/sound/` (tables, loader, Japanese analyser, Thai parser, test sets).
English is not covered here: its table comes from the CMU Pronouncing Dictionary on branch
`fix/rules-findings` and plugs into the same loader (see "English" below).

## The design in one paragraph

A verse is free text, so nothing about it can be looked up in advance; what can be shipped
is knowledge about words. Each language gets the least that makes its rules true to the
sound: nothing where the spelling shows the sound (Polish, Korean, Vietnamese, Arabic's
rhyme letter), a small table of exceptions where a spelling rule is nearly always right
(Spanish, Portuguese), a table of where the stress falls where only that is missing
(Russian, Italian), the pronunciation itself where spelling is a poor guide (French,
German), character readings (Chinese), word endings (Thai), and a dictionary-driven
analyser where readings depend on context (Japanese). A word the table lacks falls back to
the spelling rule, never to a refusal. Every table is a separate module that is fetched
only when a duel in that language starts (`loadSound(lang)`, called beside `loadPack(lang)`
on the battle and theatre pages); no page's first load includes any of it. The lookups are
exact string matches on data, so the same line gets the same answer on every device.

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
language model (this session) and checked only by the engine's own form checks. No native
speaker has read them.** They are marked with a dated comment in each pack.

## Per language

Sizes are of the generated module as committed, raw and gzip -9 (what a server would send
compressed). "Rule agrees" is the spelling rule alone against the dictionary, over every
usable dictionary word, with no table loaded.

### Spanish (es)
- **Rule**: stress from the written accent or the orthographic rule; rhyme from the stressed
  vowel on. Syllables by the strong/weak vowel rule.
- **Table**: 1,135 words whose stress the rule gets wrong (loanwords, dictionary oddities).
  16.7 kB, 5.1 kB gzip. Source: Wiktionary via kaikki.org.
- **Measured**: rule stress agrees with the dictionary on 99.2% of 136,520 words; rule
  syllable count on 94.4% of 137,003.
- **Not taken from the dictionary**: syllable counts. Where they differ the dictionary splits
  two vowels that verse joins (synaeresis); see "Syllable counts in the Romance languages".
- **Undecidable**: assonance (which Spanish verse also accepts) is not counted as rhyme.

### Italian (it)
- **Rule**: as Spanish, with two guesses where Italian spelling is ambiguous ("-ia").
- **Table**: 27,552 words whose stress the spelling does not show or the rule guesses wrong
  (every word stressed three syllables from the end: "tavola", "anima", "parlano").
  290 kB, 67 kB gzip. Source: Wiktionary via kaikki.org.
- **Measured**: rule stress agrees on 71.9% of 84,481 words, which is why Italian has a
  table; rule syllable count on 93.8%.
- **Undecidable**: open against closed e and o are not distinguished; Italian verse rhymes
  them freely.

### Portuguese (pt)
- **Rule**: stress from accents and the orthographic rule; rhyme from the stressed vowel on.
- **Table**: 2,013 words. 24 kB, 7.3 kB gzip. Source: Wiktionary via kaikki.org.
- **Measured**: rule stress agrees on 96.5% of 58,133 words; rule syllable count on 87.3%
  of 59,646 (the dictionary's first transcription is Brazilian, which adds vowels the
  spelling does not have and splits "i-a", "i-o" that verse usually joins).

### French (fr)
- **Table**: 84,049 word forms with syllables as spoken, a flag for a closing mute e, and
  the rhyme (last vowel and what follows). 996 kB, 243 kB gzip. Source: Wiktionary via
  WikiPron.
- **Rule** (fallback for a word not in the table): the previous spelling rule.
- **Verse counting**: a closing mute e is one more syllable before a consonant and silent at
  the end of the line or before a vowel. The table now also knows the mute "-ent" of verbs
  ("parlent") from the nasal "-ent" of nouns ("moment"), which spelling could not tell apart.
- **Undecidable**: diaeresis ("li-on" against "lion") is the poet's choice; homonyms that
  rhyme ("nue / nue") are refused, because a word never rhymes with itself.

### German (de)
- **Table**: 71,643 words with syllables and the rhyme from the last stressed vowel.
  1.29 MB, 457 kB gzip. Source: Wiktionary via kaikki.org.
- **Compounds**: a word the table lacks is read on the longest ending that is in it
  ("Zauberversgedicht" rhymes and counts as "…gedicht"), since a compound rhymes on its
  last element.
- **Tolerance** (from the Busch set): vowel length is not compared and rounded front vowels
  rhyme with their unrounded partners ("Stück / dick", "neu / dabei"), the impure rhyme
  German verse has always used. Without it 4 of 60 real rhymes more are refused.
- **Measured**: the spelling rule's syllable count agrees with the dictionary on 95.3%.

### Polish (pl)
- **Rule only, no table**: stress is on the last syllable but one; the rhyme is read from
  the spelling with final and assimilated devoicing ("chleb / sklep").
- **Tolerance** (from Pan Tadeusz): closing ą with o, i with y, soft with hard sibilants.
- **Measured**: rule syllable count agrees with Wiktionary on 98.7% of 160,770 words.

### Russian (ru)
- **Table**: the stressed vowel of 399,857 word forms. 3.72 MB, 515 kB gzip. Source:
  Wiktionary via kaikki.org. The largest table: Russian stress is free, moves within a
  word's own forms, and is not written.
- **Rule with the table**: rhyme from the stressed vowel on, unstressed vowels compared as
  they are said, closing consonants unvoiced, unpronounced consonants dropped ("чувства").
  ё and one-vowel words need no table.
- **Fallback**: when either word is not in the table, the previous end-of-word rule decides
  for both. It cannot hear stress ("сцена / луна" passes).
- **Undecidable**: a word with two stresses for two meanings ("ро́дин / роди́н") rhymes on
  either.

### Indonesian (id)
- **Rule**: the last vowel and what follows it; an open final vowel rhymes on the vowel
  alone, which is how Malay verse rhymes ("dunia / teperdaya").
- **Table**: 1,104 words whose syllable count the rule gets wrong (mostly "ai", "au" inside
  a word, and loanwords). 12.5 kB, 5.0 kB gzip. Source: Wiktionary via kaikki.org.
- **Measured**: rule syllable count agrees on 94.9% of 21,744 words. Initialisms ("API") are
  left out of every table: lower-cased they collide with ordinary words ("api", fire).

### Vietnamese (vi)
- **Rule only**: a written word is a syllable; rhyme on the rime and the tone class.
- **Tolerance** (from Truyện Kiều): the near-rhyme (vần thông) with the same closing sound
  and vowels of one family. Strict rhyme alone hears 34 of 60 of the poem's rhymes; with
  the tolerance 56, and still refuses all 30 non-rhymes.
- **Measured**: one word, one syllable agrees with Wiktionary on 98.2% of 27,553 entries.
- **Undecidable**: a loanword written as one word ("protein", three syllables) counts as one.

### Korean (ko)
- **Rule only**: Hangul decomposes by arithmetic into initial, vowel and final; rhyme on
  vowel and final as spoken. A block is a syllable (agrees with Wiktionary on 99.9% of
  45,562 words).

### Chinese (zh)
- **Table**: for 44,358 characters, the rhyme group and tone of each reading; for 4,120
  words, the reading of a last character that has more than one ("银行" is háng, "流行"
  is xíng). 512 kB, 166 kB gzip. Sources: Unicode Unihan 18.0 and CC-CEDICT.
- **Rule**: two lines rhyme when their last characters' finals are in the same rhyme group,
  whatever the tone; the same character twice is not a rhyme. A character with several
  readings and no word to settle it may rhyme on any of its common readings.
- **Rhyme groups**: the sixteen of 中华通韵 (GF 0022-2019), with eng/ong, i/ü/er and o/e
  allowed to rhyme across. **The grouping was written from memory of the standard and of
  the thirteen-rut scheme; it was not checked against a copy of either in this session.**
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
- **Undecidable**: a kanji with several readings is read as the dictionary's statistics
  prefer; a poet's chosen reading ("蛙" as かわず) cannot be known. Latin letters and digits
  have no reading, so a line that contains them is not counted.

### Thai (th)
- **Table**: 17,219 words with syllable count and the rime of the last syllable.
  346 kB, 89 kB gzip. Source: Wiktionary via WikiPron.
- **Rule**: a line rhymes on the longest dictionary word it ends on; an ending the table
  lacks is read by spelling patterns (`sound/th.ts`), which agree with the dictionary on
  94.9% of the 17,219 words. Vowel length is compared: a short vowel does not rhyme with a
  long one, as in Thai verse.
- **Syllable forms are not offered.** Counting needs every word of a line in the table, and
  free Thai text is not; `thaiSyllables` answers "cannot count" rather than guess.

### Hindi (hi)
- **Rule**: Devanagari is read as it is said, with the unwritten "a" taken out where Hindi
  drops it (schwa deletion). Syllables are the vowels that remain.
- **Tolerance** (from Kabir): a breathed consonant with its plain partner, the retroflex n
  with n, the three s sounds.
- **Table**: 1,214 words whose syllable count the rule gets wrong. 22.5 kB, 6.1 kB gzip.
  Source: Wiktionary via WikiPron.
- **Measured**: the rule's syllable count agrees with the dictionary on 96.0% of 30,377
  words.

### Arabic (ar)
- **Rule only**: the classical definition, read from the text: the rhyme letter (rawi), the
  long vowel before it (ridf), the long vowel or h after it (wasl), and the vowel on the
  rhyme letter wherever both words show it. No dictionary is needed for this.
- **Syllable forms are not offered and cannot be.** Unvocalised Arabic does not write its
  short vowels. The open tools that restore them (Mishkal, CAMeL Tools, Shakkala) are
  statistical guesses about which word was meant; counting on a guess would refuse correct
  verse. Fully vocalised text could be counted; players do not type it.

### English (en)
Not part of this work. `fix/rules-findings` adds `pronounce.ts` and a table reduced from the
CMU Pronouncing Dictionary. It has the same shape as the tables here (a lazily imported
module, a loader, "not known" when absent, spelling rules as the fallback). When it is on
`main`, English joins the loader with one line in `sound/index.ts`
(`ENGINE_LOADERS.en = () => import('../pronounce').then((m) => m.loadPronunciation())`).

## Measured accuracy

Rhyme: against one published poem per language whose form says which lines rhyme (labels
come from the form, not from the engine). Counts: against 60 dictionary words per language,
taken at even steps through the dictionary's sorted word list. Figures are from
`scripts/sound/measure.mjs` on 2026-11-16 and are recorded in
`src/lib/verse/sound/corpus/expected.json`.

| Lang | Poem | Real rhymes heard | Non-rhymes refused | Counts right | Count source |
|---|---|---|---|---|---|
| es | Sor Juana, Redondillas; Espronceda, Canción del pirata | 42/43 | 38/38 | 57/60 | Wiktionary |
| fr | Boileau, L'Art poétique I, 1-100 | 49/50 | 50/50 | 60/60 | Wiktionary (same source as the table) |
| de | Busch, Max und Moritz, Streiche 1-3 | 57/60 | 60/60 | 60/60 | Wiktionary (same source as the table) |
| it | Dante, Inferno I, 1-91 | 56/59 | 30/30 | 58/60 | Wiktionary |
| pt | Camões, Os Lusíadas I, 1-9 | 45/45 | 27/27 | 56/60 | Wiktionary |
| pl | Mickiewicz, Pan Tadeusz I, 1-100 | 48/50 | 50/50 | 60/60 | Wiktionary |
| ru | Pushkin, Tsar Saltan, 1-96 | 47/48 | 47/48 | 60/60 | Wiktionary |
| ar | Imru' al-Qais, Mu'allaqa | 50/50 | 38/38 | not counted | - |
| hi | Kabir, Granthavali, sakhis | 42/48 | 45/45 | 60/60 | Wiktionary |
| zh | 唐詩三百首, 49 quatrains | 46/49 | 48/49 | 60/60 | CC-CEDICT |
| ja | none (see below) | - | - | 60/60 | JMdict, independent of the analyser's dictionary |
| ko | none (see below) | - | - | 60/60 | Wiktionary |
| vi | Nguyễn Du, Truyện Kiều, 1-120 | 56/60 | 30/30 | 58/60 | Wiktionary |
| th | Sunthorn Phu, Nirat Phukhao Thong | 60/60 | 40/40 | 60/60 | Wiktionary (same source as the table) |
| id | Raja Ali Haji, Gurindam Dua Belas | 45/46 | 43/43 | 60/60 | Wiktionary |

What the misses are (`measure.mjs --show` lists every one):

- Old spelling in the edition: "bergantin / confin" (es), "źrenice / kobiéce" (pl), OCR
  damage in the Kabir text (hi).
- Rhymes of their time that today's sound has undone: Dante's Sicilian "desse / venisse",
  three Tang rhymes (事/未, 去/處, 美/裡), Mickiewicz's "nóżki / pończoszki".
- A word rhymed with its homonym: "nue / nue" (fr), "volto / vòlto" (it). Refused on purpose.
- Comic or loose rhymes: Busch's "Höh / herrjemine", "dieses / es".
- Vietnamese near-rhymes outside the three vowel families (4 of 60).

Read these figures for what they are. One poem per language is a small sample of one
poet's practice. For French, German and Thai the counted words come from the same
dictionary the table was built from, so 60/60 shows the pipeline is intact, not that the
dictionary is right. No second, independent tool was run against the tables (see "Not
verified").

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
to m); when it lands, the dictionary's count belongs in it as the upper bound.

## Download size and load time

| Language | What is fetched | Raw | Gzip |
|---|---|---|---|
| pl ko vi ar | nothing | 0 | 0 |
| id | table | 12.5 kB | 5.0 kB |
| es | table | 16.7 kB | 5.1 kB |
| hi | table | 22.5 kB | 6.1 kB |
| pt | table | 24.2 kB | 7.3 kB |
| it | table | 290 kB | 67 kB |
| th | table | 346 kB | 89 kB |
| zh | table | 512 kB | 166 kB |
| fr | table | 996 kB | 243 kB |
| de | table | 1.29 MB | 457 kB |
| ru | table | 3.72 MB | 515 kB |
| ja | analyser code and twelve dictionary files | 17.8 MB | 17.8 MB (already compressed) |

Load times in a browser: see "Not verified".

## Sources and provenance

Everything below was fetched on 2026-11-16.

| What | Used for | From | Version | Licence |
|---|---|---|---|---|
| Wiktionary pronunciations, machine-readable | tables es it pt de ru id; test sets es it pt pl de ru id | kaikki.org (`kaikki.org-dictionary-<Language>.jsonl`, made with wiktextract) | extract dated 2026-10-30 | CC BY-SA 4.0 and GFDL (Wiktionary's) |
| Wiktionary pronunciations, word and IPA | tables fr th hi; test sets fr th hi ko vi | WikiPron, github.com/CUNY-CL/wikipron, `data/scrape/tsv/` (`fra_latn_broad`, `tha_thai_broad`, `hin_deva_broad`, `kor_hang_narrow`, `vie_latn_hanoi_narrow`) | commit d282e848 (2026-07-23) | data CC BY-SA 4.0 (Wiktionary's); code Apache-2.0 |
| Unihan database, `Unihan_Readings.txt` (kMandarin, kHanyuPinlu, kTGHZ2013, kXHC1983) | table zh | unicode.org/Public/UCD/latest/ucd/Unihan.zip | Unicode 18.0.0, file dated 2026-07-31 | Unicode License v3 |
| CC-CEDICT | table zh (words that settle a reading); test set zh | mdbg.net/chinese/export/cedict | export of 2026-11-16 | CC BY-SA 4.0 |
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
and that the tables themselves stay under CC BY-SA 4.0. The site has no such credit yet.
The mecab-ipadic notice must travel with its dictionary files. This is the owner's call
before deployment.

## Rebuilding

```bash
# 1. Fetch (a few GB pass through; about 60 MB is kept). Light enough for the dev Mac.
for L in Italian Russian German Spanish Portuguese Polish Indonesian; do
  curl -sL https://kaikki.org/dictionary/$L/kaikki.org-dictionary-$L.jsonl \
    | python3 -I scripts/sound/kaikki-filter.py <src>/kaikki_<code>.tsv
done
#    plus WikiPron's fra_latn_broad, tha_thai_broad, hin_deva_broad, kor_hang_narrow, vie_latn_hanoi_narrow .tsv,
#    Unihan.zip (unzipped to <src>/unihan/), CC-CEDICT as <src>/cedict.txt, JMdict_e.
# 2. Build the tables, the counted sets and docs/language/measurements.json.
node --import ./scripts/sound/ts-resolve.mjs scripts/sound/build.mjs --src <src>
# 3. Rebuild the rhyme sets from fetched Wikisource pages.
python3 -I scripts/sound/corpus.py <folder of fetched pages>
# 4. Measure, and record the digests the tests must reproduce.
node --import ./scripts/sound/ts-resolve.mjs scripts/sound/measure.mjs --show --write --kuromoji node_modules/kuromoji
```

`scripts/sound/mutate-sound.mjs` (build host) breaks thirteen things one at a time and
expects the sound tests to go red each time.

## Not finished, not verified

- **No native speaker has read the 28 verses added to the zh, ja, th and hi packs.** A
  language model wrote them; the engine's form checks are the only check they have had.
- **The Chinese rhyme groups were not checked against the published standard.**
- **Japanese and Korean have no rhyme test set from published verse** (reason above).
- **No second tool was run against the tables.** espeak-ng is installed on the build host and
  would be an independent check of the Wiktionary-derived tables for the European
  languages; the host was overloaded for the whole session and it was not run.
- **Arabic and Thai have no syllable forms**, for the reasons given under each.
- **The Japanese haiku brief still tells the player to write in kana** (the message
  `form.haiku.brief.kana` in all sixteen locales, and `check.syllables.kana`). Kana is no
  longer required once the analyser has loaded. The locale files belong to another branch.
- **The Chinese jueju still checks only its shape.** Its rhyme (lines 2 and 4) could now be
  checked; doing so fails one of the pack's two written jueju ("灭 / 躲"), so it is left for
  the pack's owner.
- **Thai counts greedily.** `thaiSyllables` cuts a line into dictionary words longest-first
  from the left with no backtracking; it is not used by any form.
- **Attribution for the CC BY-SA sources is not on the site.**

Anything measured in a browser, and the state of the test suites on the build host, is in
the branch report rather than here, because it depends on the run.
