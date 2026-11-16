# The first pages in sixteen languages: where the text came from and how it was checked

Pages: home, about, collection (with the deck builder and the card detail view), profile and
world map, and the data they show (cities and their abilities, what each card does, deck rules,
achievements, the words printed on every card). Branch `lang/pages-core`, 2026-11-16.

Languages: en es fr de it pt pl ru ar hi zh ja ko vi th id. Portuguese is Brazilian and Chinese
is Simplified, as in the core locale files.

The owner's direction: "language must be perfect and there are known solutions for this
globally. language doesn't always need a generative model. there are deterministic tools and
other generative tools as well." So a name or a rule that a recognised source can give was taken
from that source, and what a language model wrote was checked by tools that did not write it.
RESULTS.md, beside this file, says what those tools found.

## Where each kind of text comes from

| Text | Source | Kept in |
|---|---|---|
| Numbers, percentages, dates, month names, lists | The browser's `Intl` (Unicode CLDR), at run time: `num`, `percent`, `day`, `monthOfYear`, `list` in `src/i18n/pages/runtime.ts`. No string of ours. | nowhere |
| Regions of the world ("Western Africa") | CLDR 46 territory names by UN M.49 code (cldr-localenames-full 46.0.0), kept in the `variants` area. Not asked of `Intl.DisplayNames` at run time: Chromium's trimmed ICU data answers "011" for Western Africa (seen in the browser tests, 2026-11-16). English changed with it: "West Africa" is now "Western Africa", "South Asia" "Southern Asia", as CLDR has them. | `variants/<lang>.ts`, `cldr-exemplar-cities.json` |
| City names, 16 of 20 | CLDR 46 `exemplarCity` (cldr-dates-full 46.0.0, timeZoneNames), where the language lists one; otherwise the Wikidata label. | `variants/<lang>.ts`, `cldr-exemplar-cities.json` |
| City names: Brooklyn, Mumbai, Osaka, Kingston | Wikidata labels (CLDR has no time zone named for them). | `variants/<lang>.ts`, `wikidata-labels.json` |
| "Eurasia"; the play titles on the home page; the houses Rome, Illyria, The Tempest, Lake District; Olympus where Wikidata has it | Wikidata labels. | `variants`, `card-terms`, `wikidata-labels.json` |
| The game's own terms (verse, round, deck, relic, potion, craft, ink…) | The core locale files `src/i18n/locales/*.ts`, word for word. | `terminology` below |
| Everything else: 363 strings a language | Written by a language model (Claude), then checked as RESULTS.md describes. **Not reviewed by a native speaker.** | `src/i18n/pages/<area>/<lang>.ts` |

`sourced-names.json` lists every value taken from a source, per language, with the source it
came from. `src/i18n/pages.test.ts` fails if a module and that record disagree, so a name cannot
be "corrected" from memory without the record being changed too.

### Licences and dates

- Unicode CLDR 46.0.0, Unicode License v3. Fetched 2026-11-16 from
  `https://cdn.jsdelivr.net/npm/cldr-dates-full@46.0.0/main/<locale>/timeZoneNames.json` and
  `…/cldr-localenames-full@46.0.0/main/<locale>/territories.json`
  (`node scripts/pages-lang/fetch-cldr-cities.mjs`). Number, date and list formats are not
  fetched: they are whatever CLDR the player's browser ships.
- Wikidata, CC0 1.0. Labels fetched 2026-11-16 with `wbgetentities` for the item ids recorded in
  `wikidata-labels.json`. For Chinese the `zh-cn` label is used, then `zh-hans`, then `zh`; for
  Portuguese `pt-br`, then `pt`. The file says which was used for each item.

### Names that are NOT from a source

Fifteen values, marked `NOT FROM A SOURCE` in `sourced-names.json`:

- Olympus (the house) in fr it ar hi zh ko vi th id: Wikidata's item for the mythological
  Olympus (Q70054479) has no label in those languages; written by hand from the label of Mount
  Olympus (Q80344).
- The Tempest in Hindi: Wikidata's Hindi label is the lower-case English "the tempest";
  transliterated by hand (द टेम्पेस्ट).
- Romeo and Juliet in Chinese: Wikidata has only the Traditional-script label; written in
  Simplified characters by hand.
- As You Like It in Vietnamese and Thai, Illyria in Vietnamese: no Wikidata label; the original
  name is kept.
- Mexico City in Polish: CLDR gives "Meksyk (miasto)", a disambiguated form not fit for a card;
  the Wikidata label "Meksyk" is used.

Where CLDR and Wikidata disagree on a city, CLDR was followed and the Wikidata form is in the
record beside it (for example Thai Nairobi: CLDR ไนโรเบีย, Wikidata ไนโรบี; Hindi Cairo: CLDR
कायरो, Wikidata क़ाहिरा). A native reviewer should look at those rows first. Two sources also
give the formal name of a municipality where a shorter one is usual: Osaka is 大阪市 / 오사카시 /
"Ōsaka" (vi) in Wikidata, Brooklyn 布鲁克林区 / ブルックリン区.

## Not translated, and why

- **Card names, quotations and scene texts**: another engineer is sourcing names and quotations
  from published translations. These pages show whatever the card data layer gives
  (`data-card-text` in the markup). The scene text in the card detail view is English until that
  layer has it.
- **Attire and hairstyle options of a city** (160 style names such as "agbada modern",
  "two block"), shown in a city's detail on the world map and beside a variant. English, marked
  `lang="en"` and `data-style-name`. No source was found for them and they were not written by
  hand: many are names of styles, and a wrong rendering of one would read as an error about
  someone's culture.
- **Proper names**: people, "Sarasota, FL", "Shakespeare on the Go", festivals, products and
  models (`data-proper-name` where they stand alone).
- **`src/lib/inventory.ts`** has no text a player sees.
- **`src/lib/battle-rules.ts`** still exports its English descriptions for anything that reads
  them; the pages now use `src/i18n/pages/rules-text.ts`, which says the same in the interface
  language.

## How the strings are built

- A count is written as a label and a number ("Variants unlocked: 2"), never as a number and a
  noun, so no language has to choose a noun form after a number. Achievement descriptions were
  reworded the same way ("Battles won: 25"); the number comes from the achievement's `goal`.
  If the runtime's plural support (branch `lang/qa-pipeline`) is preferred later, these keys are
  the ones to convert; nothing concatenates a number with a noun.
- A sentence is never assembled from pieces across a language boundary. What a card does is
  shown as separate lines (the device's brief, "Land it to…", the house's line), each a whole
  message.
- A message may carry two marks: `<b>…</b>` (the accent) and `<a>…</a>` (a link whose address
  the page supplies). Everything else in a message is escaped before it reaches the page.

## Terminology

Taken from the core locale files; these pages introduce no second word for any of them.

| | verse | round | deck | card | relic | potion | duel | battle | craft | house |
|---|---|---|---|---|---|---|---|---|---|---|
| es | estrofa | ronda | mazo | carta | reliquia | poción | duelo | batalla | oficio | casa |
| fr | strophe | manche | jeu | carte | relique | potion | duel | combat | métier | maison |
| de | Strophe | Runde | Deck | Karte | Relikt | Trank | Duell | Kampf | Handwerk | Haus |
| it | strofa | round | mazzo | carta | reliquia | pozione | duello | battaglia | mestiere | casata |
| pt | estrofe | rodada | baralho | carta | relíquia | poção | duelo | batalha | ofício | casa |
| pl | strofa | runda | talia | karta | relikwia | mikstura | pojedynek | bitwa | kunszt | dom |
| ru | строфа | раунд | колода | карта | реликвия | зелье | дуэль | битва | мастерство | дом |
| ar | أبيات | جولة | رزمة | بطاقة | أثر | جرعة | مبارزة | نزال | صنعة | بيت |
| hi | पद | दौर | डेक | कार्ड | अवशेष | काढ़ा | द्वंद्व | युद्ध | शिल्प | घराना |
| zh | 诗 | 回合 | 牌组 | 卡牌 | 圣物 | 药水 | 对决 | 对战 | 技艺 | 家族 |
| ja | 詩 | ラウンド | デッキ | カード | 遺物 | 薬 | 決闘 | バトル | 技巧 | 家門 |
| ko | 시 | 라운드 | 덱 | 카드 | 유물 | 물약 | 결투 | 배틀 | 기교 | 가문 |
| vi | bài thơ | hiệp | bộ bài | lá bài | bảo vật | thuốc phép | trận đấu | trận đấu | tay nghề | gia tộc |
| th | บทกลอน | ยก | สำรับ | การ์ด | ของวิเศษ | ยาวิเศษ | การประชัน | การประชัน | ฝีมือ | ตระกูล |
| id | syair | ronde | dek | kartu | relik | ramuan | duel | pertarungan | keahlian | wangsa |

Things found in the core files while reading them, left as they are (those files belong to the
quality pass on branch `lang/qa-pipeline`):

- French, German and Russian use one phrase for both "World card" and "World map" (Carte du
  monde, Weltkarte, Карта мира). On the world map page the badge "World cards" and the title
  "World map" therefore differ only by number.
- Vietnamese says both "lá bài" and "thẻ bài" for a card. These pages say "lá bài", and "thẻ bài
  sưu tầm" only for "collectible cards", as the footer does.
- The core Vietnamese and Thai have a word for the duel and none of their own for a battle;
  these pages use the duel's word for both (trận đấu, การประชัน).
- The duel page writes numbers as plain digits; these pages write them through `Intl`, which
  gives Arabic-Indic digits in Arabic (١٢٣). The two should agree; which way is a decision for
  the owner of the core files.

## Running the checks again

```bash
RB='export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH;'
# keys, placeholders, marks, sourced names, every card and city named in every language
~/kani-logs/remote/rb . -- "$RB npx vitest run src/i18n/pages.test.ts"
# the five pages in sixteen languages, in a browser
~/kani-logs/remote/rb . -- "$RB npx playwright test tests/pages-i18n.spec.ts"
# spelling (Hunspell) and back-translation (MADLAD-400), with the tools branch lang/qa-pipeline installed
Q=/Volumes/macos_4TB_external_1/wai-build/im-lang/qa-pipeline
~/kani-logs/remote/rb . -- "$RB HSPELL=$Q/hunspell/bin/hspell DICT_DIR=$Q/dict node scripts/pages-lang/spell.mjs --selftest"
~/kani-logs/remote/rb . -- "$RB HSPELL=$Q/hunspell/bin/hspell DICT_DIR=$Q/dict node scripts/pages-lang/spell.mjs --out spell.json"
# screenshots to look at (start a dev server on a port of your own first)
node scripts/page-shots.mjs http://localhost:<port> <outDir> ar,de,ja,es
```

`scripts/pages-lang/` is a stand-in: when the pipeline of `lang/qa-pipeline` is in main, point
it at `src/i18n/pages/` and delete these scripts.
