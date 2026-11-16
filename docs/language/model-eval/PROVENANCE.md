# Model evaluation: where every text came from

Fetched 2026-11-16. Each item's own record (page, revision id, permanent link, date) is in the
JSON file named; this page says what the sources are, under what terms, and what was done to the text.

## Sources

| What | Source | Licence | Used for | Record |
|---|---|---|---|---|
| 192 verse excerpts, 12 per language | Wikisource, the language's own edition (`<lang>.wikisource.org`), ordinary page views | The poems are in the public domain by age: every poet died 71 or more years before 2026 (the build refuses any other). Wikisource's transcriptions are offered under CC BY-SA 4.0 | The better verse of every judging pair; the verse the opponent answers in the writing test; the reference the language detector is measured on | `corpus/<lang>.json` (page, `revid`, `permalink`, `fetched`); chosen by `scripts/model-eval/corpus-manifest.json` |
| 48 opening sentences, 3 per language | Wikipedia, the language's own edition: the articles for bread (Wikidata Q7802), bicycle (Q11442) and house cat (Q146), reached through `wikidata.org/wiki/Special:GoToLinkedPage` | CC BY-SA 4.0 | The worse verse of 3 judging pairs per language: fluent prose that is not verse | `pairs/<lang>.json`, `worse.source` |
| 96 interface strings, 6 per language | This repository, `src/i18n/locales/<lang>.ts` | The project's own | The worse verse of 3 judging pairs per language: two flat lines | `pairs/<lang>.json`, `worse.source.keys` |
| 48 strings of shuffled letters | Made by `scripts/model-eval/build-pairs.mjs` from the letters of that language's excerpts, by seed | none | The worse verse of 3 judging pairs per language | `pairs/<lang>.json`, `worse.source.seed` |
| 48 injection attempts, 3 per language | **Written by a language model** (the agent that built this evaluation); not from a source, not reviewed by a native speaker | The project's own | The worse verse of 3 judging pairs per language. Adversarial input for the judge; never shown to a player | `scripts/model-eval/injections.json` |
| Language identification | fastText `lid.176.ftz` (Facebook AI Research), run locally through the npm package `fasttext.wasm.js` 1.0.0 | Model CC BY-SA 3.0; package MIT | Deciding whether a verse a model wrote is in the language asked for, where other languages share the script | Every answer it gave: `lid.json` |
| Script of a character | The Unicode Script property, as the JavaScript engine implements it (`\p{Script=…}`; Node 26, ICU) | Unicode licence | The other half of the same decision; the whole of it for Chinese, Japanese, Korean and Thai | `scripts/model-eval/lib.mjs`, `scriptOk` |
| Language names in the picker | Unicode CLDR, through the browser's `Intl.DisplayNames` | Unicode licence | The name beside each language in the battle page's picker | `src/i18n/index.ts`, `languageName` (already there before this work) |

## What was done to the text

- An excerpt is consecutive lines of the page as fetched: tags removed, runs of spaces made one
  space, and these characters removed: zero-width space, the two direction marks, word joiner,
  byte-order mark, soft hyphen, and the Arabic tatweel (U+0640, which only stretches a word to
  fill a printed line). Nothing else is changed: old spellings stay (Camões's *he hum fogo*, the
  1834 *Pan Tadeusz*, Shimazaki's historical kana), and so do the traditional characters of the
  Chinese pages.
- No excerpt was typed. `corpus-manifest.json` names a page and the opening words of a line (or
  the line's place among the page's verse-like lines); the build cuts the lines from the page and
  fails if the anchor is not there. Each of the 192 cuts was then read by the agent against the
  page's own layout to check that it starts and ends on whole lines of the poem.
- The years of death in the manifest were **not fetched**. They are the generally recorded ones
  (approximate for the pre-Islamic Arabic poets and for Hamzah al-Fansuri) and serve only as the
  build's public-domain guard.
- A Wikipedia sentence is the first paragraph that names its subject in bold, cut at the first
  sentence end past 60 characters (at 300 characters where no sentence ends in reach).
- Wikimedia's API answered 429 for minutes at a time from this network on the day, so pages were
  read as ordinary page views (which its cache serves), one at a time, 250 to 300 ms apart, with a
  descriptive user agent.

## Limits a reader should know

- **Hindi is one poet and one poem**: all 12 excerpts are from Jaishankar Prasad's *Kamayani*
  (1936; he died in 1937). Hindi Wikisource's other candidates were index pages that this fetcher
  could not cut lines from.
- **Indonesian leans on classical Malay**: 6 of the 12 are from *Gurindam Dua Belas* (1847) and
  *Syair Perahu*, which the language identifier answers as Malay; the check accepts Malay for
  Indonesian for that reason.
- **Japanese is two poets** (Shimazaki Toson, Miyazawa Kenji), in historical kana; the Miyazawa
  lines are in katakana. Pages with readings printed in brackets after each word (the *Hyakunin
  Isshu*, Ishikawa Takuboku) were left out rather than edited.
- Several languages take two excerpts from one long poem. The table below shows which.
- "Clearly better verse" is a claim about canonical poetry against prose, interface strings,
  shuffled letters and an instruction. It is not a test of fine judgement between two decent verses.
  In Chinese the shuffled letters are real characters in a row, which can read as verse.

## The excerpts


### en

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | William Shakespeare | Sonnet 18 | Shall I compare thee to a summer's day? | [11176930](https://en.wikisource.org/w/index.php?oldid=11176930) |
| 02 | William Shakespeare | Sonnet 130 | My mistress' eyes are nothing like the sun; | [11177057](https://en.wikisource.org/w/index.php?oldid=11177057) |
| 03 | William Shakespeare | Sonnet 29 | When, in disgrace with fortune and men's eyes, | [11176944](https://en.wikisource.org/w/index.php?oldid=11176944) |
| 04 | William Shakespeare | Sonnet 116 | Let me not to the marriage of true minds | [11177003](https://en.wikisource.org/w/index.php?oldid=11177003) |
| 05 | William Shakespeare | Sonnet 73 | That time of year thou mayst in me behold | [11176992](https://en.wikisource.org/w/index.php?oldid=11176992) |
| 06 | William Shakespeare | Sonnet 55 | Not marble, nor the gilded monuments | [11176973](https://en.wikisource.org/w/index.php?oldid=11176973) |
| 07 | William Shakespeare | Sonnet 30 | When to the sessions of sweet silent thought | [11176945](https://en.wikisource.org/w/index.php?oldid=11176945) |
| 08 | William Shakespeare | Sonnet 60 | Like as the waves make towards the pebbled shore, | [11176979](https://en.wikisource.org/w/index.php?oldid=11176979) |
| 09 | William Shakespeare | Sonnet 12 | When I do count the clock that tells the time, | [11176925](https://en.wikisource.org/w/index.php?oldid=11176925) |
| 10 | William Shakespeare | Sonnet 65 | Since brass, nor stone, nor earth, nor boundless sea, | [11176984](https://en.wikisource.org/w/index.php?oldid=11176984) |
| 11 | William Shakespeare | Sonnet 2 | When forty winters shall besiege thy brow, | [11176913](https://en.wikisource.org/w/index.php?oldid=11176913) |
| 12 | John Donne | Holy Sonnet 10 | Death be not proud, though some have callèd thee | [10274820](https://en.wikisource.org/w/index.php?oldid=10274820) |

### es

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | Antonio Machado | A un olmo seco | Al olmo viejo, hendido por el rayo | [1564295](https://es.wikisource.org/w/index.php?oldid=1564295) |
| 02 | Rubén Darío | Sonatina | Los suspiros se escapan de su boca de fresa, | [1321030](https://es.wikisource.org/w/index.php?oldid=1321030) |
| 03 | Teresa de Jesús | Vivo sin vivir en mí | Vivo sin vivir en mí, | [1393256](https://es.wikisource.org/w/index.php?oldid=1393256) |
| 04 | Rubén Darío | Lo fatal | Dichoso el árbol, que es apenas sensitivo, | [1637355](https://es.wikisource.org/w/index.php?oldid=1637355) |
| 05 | Francisco de Quevedo | A una nariz | Érase un hombre a una nariz pegado, | [1633815](https://es.wikisource.org/w/index.php?oldid=1633815) |
| 06 | Francisco de Quevedo | Miré los muros de la patria mía | Miré los muros de la patria mía, | [1671300](https://es.wikisource.org/w/index.php?oldid=1671300) |
| 07 | Francisco de Quevedo | Amor constante más allá de la muerte | Cerrar podrá mis ojos la postrera | [1543460](https://es.wikisource.org/w/index.php?oldid=1543460) |
| 08 | José de Espronceda | Canción del pirata | Con diez cañones por banda, | [1248127](https://es.wikisource.org/w/index.php?oldid=1248127) |
| 09 | José de Espronceda | Canción del pirata | La luna en el mar riela, | [1248127](https://es.wikisource.org/w/index.php?oldid=1248127) |
| 10 | José Martí | Versos sencillos, XXXIX | Cultivo una rosa blanca | [1506459](https://es.wikisource.org/w/index.php?oldid=1506459) |
| 11 | Luis de Góngora | Mientras por competir con tu cabello | mientras con menosprecio en medio el llano | [1642338](https://es.wikisource.org/w/index.php?oldid=1642338) |
| 12 | Garcilaso de la Vega | Soneto XXIII | y en tanto que el cabello, que en la vena | [1496735](https://es.wikisource.org/w/index.php?oldid=1496735) |

### fr

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | Guillaume Apollinaire | Le Pont Mirabeau | Sous le pont Mirabeau coule la Seine | [14091437](https://fr.wikisource.org/w/index.php?oldid=14091437) |
| 02 | Gérard de Nerval | El Desdichado | Je suis le ténébreux, — le veuf, — l’inconsolé, | [14184067](https://fr.wikisource.org/w/index.php?oldid=14184067) |
| 03 | Charles Baudelaire | L’Albatros | Souvent, pour s’amuser, les hommes d’équipage | [15209959](https://fr.wikisource.org/w/index.php?oldid=15209959) |
| 04 | Charles Baudelaire | Correspondances | La Nature est un temple où de vivants piliers | [15069785](https://fr.wikisource.org/w/index.php?oldid=15069785) |
| 05 | Charles Baudelaire | Correspondances | Comme de longs échos qui de loin se confondent | [15069785](https://fr.wikisource.org/w/index.php?oldid=15069785) |
| 06 | Charles Baudelaire | L’Invitation au voyage | Mon enfant, ma sœur, | [15069857](https://fr.wikisource.org/w/index.php?oldid=15069857) |
| 07 | Charles Baudelaire | Harmonie du soir | Voici venir les temps où vibrant sur sa tige | [15070047](https://fr.wikisource.org/w/index.php?oldid=15070047) |
| 08 | Charles Baudelaire | Au lecteur | La sottise, l’erreur, le péché, la lésine, | [15069657](https://fr.wikisource.org/w/index.php?oldid=15069657) |
| 09 | Charles Baudelaire | Au lecteur | Nos péchés sont têtus, nos repentirs sont lâches ; | [15069657](https://fr.wikisource.org/w/index.php?oldid=15069657) |
| 10 | Paul Verlaine | Chanson d’automne | Les sanglots longs | [13170002](https://fr.wikisource.org/w/index.php?oldid=13170002) |
| 11 | Paul Verlaine | Mon rêve familier | Je fais souvent ce rêve étrange et pénétrant | [13170042](https://fr.wikisource.org/w/index.php?oldid=13170042) |
| 12 | Victor Hugo | Demain, dès l’aube… | Demain, dès l’aube, à l’heure où blanchit la campagne, | [15164548](https://fr.wikisource.org/w/index.php?oldid=15164548) |

### de

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | Johann Wolfgang von Goethe | Erlkönig | Wer reitet so spät durch Nacht und Wind? | [3778237](https://de.wikisource.org/w/index.php?oldid=3778237) |
| 02 | Heinrich Heine | Die Lorelei | Ich weiß nicht, was soll das bedeuten, | [3534026](https://de.wikisource.org/w/index.php?oldid=3534026) |
| 03 | Johann Wolfgang von Goethe | Wandrers Nachtlied | Der du von dem Himmel bist, | [3778644](https://de.wikisource.org/w/index.php?oldid=3778644) |
| 04 | Rainer Maria Rilke | Der Panther | Sein Blick ist vom Vorübergehn der Stäbe | [3502516](https://de.wikisource.org/w/index.php?oldid=3502516) |
| 05 | Joseph von Eichendorff | Mondnacht | Es war, als hätt’ der Himmel | [4067390](https://de.wikisource.org/w/index.php?oldid=4067390) |
| 06 | Joseph von Eichendorff | Mondnacht | Die Luft ging durch die Felder, | [4067390](https://de.wikisource.org/w/index.php?oldid=4067390) |
| 07 | Friedrich Schiller | Die Bürgschaft | Zu Dionys dem Tirannen schlich | [3785932](https://de.wikisource.org/w/index.php?oldid=3785932) |
| 08 | Rainer Maria Rilke | Herbsttag | Herr: es ist Zeit. Der Sommer war sehr groß. | [2353125](https://de.wikisource.org/w/index.php?oldid=2353125) |
| 09 | Friedrich Schiller | Der Handschuh | Vor seinem Löwengarten, | [3785942](https://de.wikisource.org/w/index.php?oldid=3785942) |
| 10 | Friedrich Schiller | Der Taucher | Wer wagt es, Rittersmann oder Knapp, | [3785951](https://de.wikisource.org/w/index.php?oldid=3785951) |
| 11 | Johann Wolfgang von Goethe | Erlkönig | Mein Sohn, was birgst du so bang dein Gesicht? — | [3778237](https://de.wikisource.org/w/index.php?oldid=3778237) |
| 12 | Heinrich Heine | Die Lorelei | Der Gipfel des Berges funkelt | [3534026](https://de.wikisource.org/w/index.php?oldid=3534026) |

### it

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | Dante Alighieri | Inferno, canto V | Dico che quando l’anima mal nata | [3686233](https://it.wikisource.org/w/index.php?oldid=3686233) |
| 02 | Dante Alighieri | Inferno, canto I | Ahi quanto a dir qual era è cosa dura | [3857646](https://it.wikisource.org/w/index.php?oldid=3857646) |
| 03 | Dante Alighieri | Inferno, canto III | Dinanzi a me non fuor cose create | [3898738](https://it.wikisource.org/w/index.php?oldid=3898738) |
| 04 | Dante Alighieri | Inferno, canto III | Giustizia mosse il mio alto fattore; | [3898738](https://it.wikisource.org/w/index.php?oldid=3898738) |
| 05 | Dante Alighieri | Inferno, canto V | Stavvi Minòs orribilmente, e ringhia: | [3686233](https://it.wikisource.org/w/index.php?oldid=3686233) |
| 06 | Dante Alighieri | Inferno, canto XXVI | Tra li ladron trovai cinque cotali | [3895064](https://it.wikisource.org/w/index.php?oldid=3895064) |
| 07 | Dante Alighieri | Paradiso, canto XXXIII | Nel ventre tuo si raccese l’amore, | [3686295](https://it.wikisource.org/w/index.php?oldid=3686295) |
| 08 | Dante Alighieri | Purgatorio, canto I | Per correr miglior acque alza le vele | [3903119](https://it.wikisource.org/w/index.php?oldid=3903119) |
| 09 | Giacomo Leopardi | L’infinito | Sempre caro mi fu quest’ermo colle, | [3796281](https://it.wikisource.org/w/index.php?oldid=3796281) |
| 10 | Giacomo Leopardi | A Silvia | Silvia, rimembri ancora | [3796290](https://it.wikisource.org/w/index.php?oldid=3796290) |
| 11 | Ludovico Ariosto | Orlando furioso, canto I | Le donne, i cavallier, l’arme, gli amori, | [3736678](https://it.wikisource.org/w/index.php?oldid=3736678) |
| 12 | Francesco Petrarca | Canzoniere, I | Voi ch’ascoltate in rime sparse il suono | [3676909](https://it.wikisource.org/w/index.php?oldid=3676909) |

### pt

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | Olavo Bilac | Via Láctea | Talvez sonhasse, quando a vi. Mas via | [545494](https://pt.wikisource.org/w/index.php?oldid=545494) |
| 02 | Olavo Bilac | Via Láctea | E eu olhava-a de baixo, olhava-a... Em cada | [545494](https://pt.wikisource.org/w/index.php?oldid=545494) |
| 03 | Olavo Bilac | Via Láctea | Tu, mãe sagrada! Vós também, formosas | [545494](https://pt.wikisource.org/w/index.php?oldid=545494) |
| 04 | Fernando Pessoa | Mar Portuguez | Valeu a pena? Tudo vale a pena | [336020](https://pt.wikisource.org/w/index.php?oldid=336020) |
| 05 | Fernando Pessoa | Mar Portuguez | Por te cruzarmos, quantas mães choraram, | [336020](https://pt.wikisource.org/w/index.php?oldid=336020) |
| 06 | Casimiro de Abreu | Meus oito annos | Oh! que saudades que tenho | [488855](https://pt.wikisource.org/w/index.php?oldid=488855) |
| 07 | Casimiro de Abreu | Meus oito annos | Que amor, que sonhos, que flôres, | [488855](https://pt.wikisource.org/w/index.php?oldid=488855) |
| 08 | Augusto dos Anjos | Versos intimos | Vês?! Ninguem assistiu ao formidavel | [436525](https://pt.wikisource.org/w/index.php?oldid=436525) |
| 09 | Luís de Camões | Amor he hum fogo que arde sem se ver | Amor he hum fogo que arde sem se ver; | [418515](https://pt.wikisource.org/w/index.php?oldid=418515) |
| 10 | Castro Alves | O Navio Negreiro | 'Stamos em pleno mar... Doudo no espaço | [322199](https://pt.wikisource.org/w/index.php?oldid=322199) |
| 11 | Castro Alves | O Navio Negreiro | 'Stamos em pleno mar... Do firmamento | [322199](https://pt.wikisource.org/w/index.php?oldid=322199) |
| 12 | Castro Alves | O Navio Negreiro | 'Stamos em pleno mar... Dois infinitos | [322199](https://pt.wikisource.org/w/index.php?oldid=322199) |

### pl

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | Adam Mickiewicz | Stepy akermańskie | Wpłynąłem na suchego przestwór oceanu — | [3223840](https://pl.wikisource.org/w/index.php?oldid=3223840) |
| 02 | Adam Mickiewicz | Burza | Zdarto żagle, ster prysnął, ryk wód, szum zawiei, | [3223740](https://pl.wikisource.org/w/index.php?oldid=3223740) |
| 03 | Adam Mickiewicz | Niepewność | Gdy cię nie widzę, — nie wzdycham, nie płaczę, | [3223802](https://pl.wikisource.org/w/index.php?oldid=3223802) |
| 04 | Adam Mickiewicz | Oda do młodości | Bez serc, bez ducha, — to szkieletów ludy! | [3223807](https://pl.wikisource.org/w/index.php?oldid=3223807) |
| 05 | Adam Mickiewicz | Powrót taty | «Pójdźcie o dziatki, pójdźcie wszystkie razem | [3223823](https://pl.wikisource.org/w/index.php?oldid=3223823) |
| 06 | Adam Mickiewicz | Reduta Ordona | Nam strzelać nie kazano. — Wstąpiłem na działo | [3219690](https://pl.wikisource.org/w/index.php?oldid=3219690) |
| 07 | Adam Mickiewicz | Romantyczność | «Słuchaj, dzieweczko!» | [3223831](https://pl.wikisource.org/w/index.php?oldid=3223831) |
| 08 | Adam Mickiewicz | Świtezianka | Skąd przyszła? darmo śledzić kto pragnie, | [599108](https://pl.wikisource.org/w/index.php?oldid=599108) |
| 09 | Adam Mickiewicz | Pani Twardowska | Na patrona z trybunału, | [3215687](https://pl.wikisource.org/w/index.php?oldid=3215687) |
| 10 | Jan Kochanowski | Tren VIII | Wielkieś mi uczyniła pustki w domu moim, | [3259875](https://pl.wikisource.org/w/index.php?oldid=3259875) |
| 11 | Adam Mickiewicz | Świtezianka | Młody jest strzelcem w tutejszym borze; | [599108](https://pl.wikisource.org/w/index.php?oldid=599108) |
| 12 | Adam Mickiewicz | Pan Tadeusz, księga druga | Kto z nas tych lat niepomni, gdy młode pacholę, | [3275838](https://pl.wikisource.org/w/index.php?oldid=3275838) |

### ru

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | Михаил Лермонтов | Парус | Белеет парус одинокой | [5148434](https://ru.wikisource.org/w/index.php?oldid=5148434) |
| 02 | Михаил Лермонтов | Парус | Играют волны — ветер свищет, | [5148434](https://ru.wikisource.org/w/index.php?oldid=5148434) |
| 03 | Александр Пушкин | Зимнее утро | Мороз и солнце; день чудесный! | [5378863](https://ru.wikisource.org/w/index.php?oldid=5378863) |
| 04 | Александр Пушкин | Пророк | Духовной жаждою томим, | [4123807](https://ru.wikisource.org/w/index.php?oldid=4123807) |
| 05 | Александр Пушкин | К Чаадаеву | Любви, надежды, тихой славы | [5725970](https://ru.wikisource.org/w/index.php?oldid=5725970) |
| 06 | Михаил Лермонтов | Смерть поэта | Погиб поэт! — невольник чести, — | [5634824](https://ru.wikisource.org/w/index.php?oldid=5634824) |
| 07 | Михаил Лермонтов | Утёс | Ночевала тучка золотая | [1877073](https://ru.wikisource.org/w/index.php?oldid=1877073) |
| 08 | Михаил Лермонтов | Тучи | Тучки небесные, вечные странники! | [4806058](https://ru.wikisource.org/w/index.php?oldid=4806058) |
| 09 | Александр Пушкин | Узник | Сижу за решёткой в темнице сырой. | [4806444](https://ru.wikisource.org/w/index.php?oldid=4806444) |
| 10 | Александр Пушкин | Анчар | Природа жаждущих степей | [5320884](https://ru.wikisource.org/w/index.php?oldid=5320884) |
| 11 | Александр Пушкин | Я вас любил | Я вас любил: любовь ещё, быть может, | [4958966](https://ru.wikisource.org/w/index.php?oldid=4958966) |
| 12 | Александр Пушкин | К*** (Я помню чудное мгновенье) | Я помню чудное мгновенье: | [5356337](https://ru.wikisource.org/w/index.php?oldid=5356337) |

### ar

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | امرؤ القيس | معلقة امرئ القيس | قِفَا نَبْكِ مِنْ ذِكْرَى حَبِيبٍ ومَنْزِلِ | [532024](https://ar.wikisource.org/w/index.php?oldid=532024) |
| 02 | امرؤ القيس | معلقة امرئ القيس | تَرَى بَعَرَ الأرْآمِ فِي عَرَصَاتِهَا | [532024](https://ar.wikisource.org/w/index.php?oldid=532024) |
| 03 | المتنبي | على قدر أهل العزم تأتي العزائم | عَلى قَدْرِ أهْلِ العَزْم تأتي العَزائِمُ | [447620](https://ar.wikisource.org/w/index.php?oldid=447620) |
| 04 | المتنبي | على قدر أهل العزم تأتي العزائم | وَتَعْظُمُ في عَينِ الصّغيرِ صغارُها | [447620](https://ar.wikisource.org/w/index.php?oldid=447620) |
| 05 | المتنبي | وا حر قلباه ممن قلبه شبم | وَا حَرَّ قَلباهُ مِمَّن قَلْبُهُ شَبِمُ | [478546](https://ar.wikisource.org/w/index.php?oldid=478546) |
| 06 | طرفة بن العبد | معلقة طرفة بن العبد | لخولة أطلالٌ ببرقة ثهمد | [597732](https://ar.wikisource.org/w/index.php?oldid=597732) |
| 07 | عمرو بن كلثوم | معلقة عمرو بن كلثوم | أَلاَ هُبِّي بِصَحْنِكِ فَاصْبَحِيْنَا | [435302](https://ar.wikisource.org/w/index.php?oldid=435302) |
| 08 | لبيد بن ربيعة | معلقة لبيد بن ربيعة | عفتِ الديارُ محلُّها فمُقامُهَا | [613112](https://ar.wikisource.org/w/index.php?oldid=613112) |
| 09 | الطغرائي | لامية العجم | أصالةُ الرأي صانتْنِي عن الخَطَلِ | [469706](https://ar.wikisource.org/w/index.php?oldid=469706) |
| 10 | الشنفرى | لامية العرب | أَقِيمُوا بَنِي أُمِّي صُدُورَ مَطِيِّكُمْ | [425995](https://ar.wikisource.org/w/index.php?oldid=425995) |
| 11 | أبو فراس الحمداني | أراك عصي الدمع | أرَاكَ عَصِيَّ الدَّمْعِ شِيمَتُكَ الصَّبْرُ | [478080](https://ar.wikisource.org/w/index.php?oldid=478080) |
| 12 | أبو القاسم الشابي | إرادة الحياة | إذا الشّعْبُ يَوْمَاً أرَادَ الْحَيَاةَ | [478549](https://ar.wikisource.org/w/index.php?oldid=478549) |

### hi

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | जयशंकर प्रसाद | कामायनी, चिंता सर्ग | हिमगिरि के उत्तुंग शिखर पर, बैठ शिला की शीतल छाँह, | [583188](https://hi.wikisource.org/w/index.php?oldid=583188) |
| 02 | जयशंकर प्रसाद | कामायनी, चिंता सर्ग | नीचे जल था ऊपर हिम था, एक तरल था एक सघन, | [583188](https://hi.wikisource.org/w/index.php?oldid=583188) |
| 03 | जयशंकर प्रसाद | कामायनी, चिंता सर्ग | दूर-दूर तक विस्तृत था हिम स्तब्ध उसी के हृदय-समान, | [583188](https://hi.wikisource.org/w/index.php?oldid=583188) |
| 04 | जयशंकर प्रसाद | कामायनी, चिंता सर्ग | तरुण तपस्वी-सा वह बैठा साधन करता सुर-श्मशान, | [583188](https://hi.wikisource.org/w/index.php?oldid=583188) |
| 05 | जयशंकर प्रसाद | कामायनी, चिंता सर्ग | उसी तपस्वी-से लंबे थे देवदारु दो चार खड़े, | [583188](https://hi.wikisource.org/w/index.php?oldid=583188) |
| 06 | जयशंकर प्रसाद | कामायनी, श्रद्धा सर्ग | "कौन तुम ? संसृति-जलनिधि तीर-तरंगों से फेंकी मणि एक, | [226016](https://hi.wikisource.org/w/index.php?oldid=226016) |
| 07 | जयशंकर प्रसाद | कामायनी, श्रद्धा सर्ग | मधुर विश्रांत और एकांत--जगत का सुलझा हुआ रहस्य, | [226016](https://hi.wikisource.org/w/index.php?oldid=226016) |
| 08 | जयशंकर प्रसाद | कामायनी, आशा सर्ग | देखा मनु ने वह अतिरंजित विजन विश्व का नव कांत , | [226014](https://hi.wikisource.org/w/index.php?oldid=226014) |
| 09 | जयशंकर प्रसाद | कामायनी, आशा सर्ग | इंद्रनीलमणि महा चषक था सोम-रहित उलटा लटका , | [226014](https://hi.wikisource.org/w/index.php?oldid=226014) |
| 10 | जयशंकर प्रसाद | कामायनी, लज्जा सर्ग | वरदान सदृश हो डाल रही नीली किरनों से बुना हुआ, | [226022](https://hi.wikisource.org/w/index.php?oldid=226022) |
| 11 | जयशंकर प्रसाद | कामायनी, लज्जा सर्ग | सब अंग मोम से बनते हैं कोमलता में बल खाती हूँ, | [226022](https://hi.wikisource.org/w/index.php?oldid=226022) |
| 12 | जयशंकर प्रसाद | कामायनी, काम सर्ग | वे फूल और वह हँसी रही वह सौरभ, वह निश्वास छना, | [226018](https://hi.wikisource.org/w/index.php?oldid=226018) |

### zh

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | 柳宗元 | 江雪 | 千山鳥飛絕，萬徑人蹤滅。 | [2315191](https://zh.wikisource.org/w/index.php?oldid=2315191) |
| 02 | 李白 | 靜夜思 | 牀前看月光， | [12232857](https://zh.wikisource.org/w/index.php?oldid=12232857) |
| 03 | 張繼 | 楓橋夜泊 | 月落烏啼霜滿天，江楓漁火對愁眠。 | [12915042](https://zh.wikisource.org/w/index.php?oldid=12915042) |
| 04 | 杜牧 | 清明 | 清明時節雨紛紛， | [2441564](https://zh.wikisource.org/w/index.php?oldid=2441564) |
| 05 | 杜牧 | 泊秦淮 | 煙籠寒水月籠沙 | [1982119](https://zh.wikisource.org/w/index.php?oldid=1982119) |
| 06 | 白居易 | 賦得古原草送別 | 離離原上草，一歲一枯榮。 | [1981926](https://zh.wikisource.org/w/index.php?oldid=1981926) |
| 07 | 賈島 | 尋隱者不遇 | 松下問童子，言師採藥去。 | [1310721](https://zh.wikisource.org/w/index.php?oldid=1310721) |
| 08 | 陳子昂 | 登幽州臺歌 | 前不見古人，後不見來者。 | [1981897](https://zh.wikisource.org/w/index.php?oldid=1981897) |
| 09 | 李商隱 | 夜雨寄北 | 君問歸期未有期 | [1566402](https://zh.wikisource.org/w/index.php?oldid=1566402) |
| 10 | 王翰 | 涼州詞 | 葡萄美酒夜光杯，欲飲琵琶馬上催。 | [1458567](https://zh.wikisource.org/w/index.php?oldid=1458567) |
| 11 | 李白 | 早發白帝城 | 朝辭白帝彩雲間， | [12232697](https://zh.wikisource.org/w/index.php?oldid=12232697) |
| 12 | 白居易 | 賦得古原草送別 | 遠芳侵古道，晴翠接荒城。 | [1981926](https://zh.wikisource.org/w/index.php?oldid=1981926) |

### ja

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | 島崎藤村 | 椰子の実 | 名も知らぬ遠き島より | [211253](https://ja.wikisource.org/w/index.php?oldid=211253) |
| 02 | 島崎藤村 | 椰子の実 | 故郷の岸を離れて | [211253](https://ja.wikisource.org/w/index.php?oldid=211253) |
| 03 | 島崎藤村 | 椰子の実 | 思ひやる八重の汐々 | [211253](https://ja.wikisource.org/w/index.php?oldid=211253) |
| 04 | 宮沢賢治 | 雨ニモマケズ | 東ニ病気ノコドモアレバ | [231217](https://ja.wikisource.org/w/index.php?oldid=231217) |
| 05 | 宮沢賢治 | 雨ニモマケズ | 野原ノ松ノ林ノ䕃ノ | [231217](https://ja.wikisource.org/w/index.php?oldid=231217) |
| 06 | 島崎藤村 | 若菜集（序） | こゝろなきうたのしらべは | [144157](https://ja.wikisource.org/w/index.php?oldid=144157) |
| 07 | 島崎藤村 | 若菜集（序） | ぶだうだなふかくかゝれる | [144157](https://ja.wikisource.org/w/index.php?oldid=144157) |
| 08 | 島崎藤村 | 若菜集（序） | そはうたのわかきゆゑなり | [144157](https://ja.wikisource.org/w/index.php?oldid=144157) |
| 09 | 島崎藤村 | 椰子の実 | 旧の樹は生ひや茂れる | [211253](https://ja.wikisource.org/w/index.php?oldid=211253) |
| 10 | 島崎藤村 | 椰子の実 | われもまた渚を枕 | [211253](https://ja.wikisource.org/w/index.php?oldid=211253) |
| 11 | 島崎藤村 | 椰子の実 | 実をとりて胸にあつれば | [211253](https://ja.wikisource.org/w/index.php?oldid=211253) |
| 12 | 宮沢賢治 | 雨ニモマケズ | アラユルコトヲ | [231217](https://ja.wikisource.org/w/index.php?oldid=231217) |

### ko

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | 김소월 | 엄마야 누나야 | 엄마야 누나야 강변 살자, | [203761](https://ko.wikisource.org/w/index.php?oldid=203761) |
| 02 | 이육사 | 청포도 | 내 고장 칠월은 | [202488](https://ko.wikisource.org/w/index.php?oldid=202488) |
| 03 | 이육사 | 청포도 | 이 마을 전설이 주절이주절이 열리고 | [202488](https://ko.wikisource.org/w/index.php?oldid=202488) |
| 04 | 이육사 | 절정 | 매운 계절(季節)의 채찍에 갈겨 | [248562](https://ko.wikisource.org/w/index.php?oldid=248562) |
| 05 | 김소월 | 가는 길 | 말을 할까 | [203684](https://ko.wikisource.org/w/index.php?oldid=203684) |
| 06 | 김소월 | 접동새 | 진두강 가람가에 살던 누나는 | [430975](https://ko.wikisource.org/w/index.php?oldid=430975) |
| 07 | 김소월 | 먼 후일 | 먼 훗날 당신이 찾으시면 | [430584](https://ko.wikisource.org/w/index.php?oldid=430584) |
| 08 | 김소월 | 진달래꽃 | 나 보기가 역겨워 | [430575](https://ko.wikisource.org/w/index.php?oldid=430575) |
| 09 | 김소월 | 진달래꽃 | 가시는 걸음 걸음 | [430575](https://ko.wikisource.org/w/index.php?oldid=430575) |
| 10 | 윤동주 | 쉽게 씌어진 시 | 창밖에 밤비가 속살거려 | [203001](https://ko.wikisource.org/w/index.php?oldid=203001) |
| 11 | 윤동주 | 참회록 | 파란 녹이 낀 구리거울 속에 | [387804](https://ko.wikisource.org/w/index.php?oldid=387804) |
| 12 | 김소월 | 금잔디 | 심심산천에 붙는 불은 | [204518](https://ko.wikisource.org/w/index.php?oldid=204518) |

### vi

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | Nguyễn Du | Truyện Kiều | Trăm năm trong cõi người ta, | [206607](https://vi.wikisource.org/w/index.php?oldid=206607) |
| 02 | Hồ Xuân Hương | Bánh trôi nước | Thân em vừa trắng lại vừa tròn, | [76694](https://vi.wikisource.org/w/index.php?oldid=76694) |
| 03 | Nguyễn Khuyến | Thu điếu | Ao thu lạnh lẽo nước trong veo, | [202422](https://vi.wikisource.org/w/index.php?oldid=202422) |
| 04 | Nguyễn Khuyến | Thu ẩm | Năm gian nhà cỏ thấp le te, | [206402](https://vi.wikisource.org/w/index.php?oldid=206402) |
| 05 | Nguyễn Khuyến | Thu vịnh | Trời thu xanh ngắt mấy tầng cao, | [202229](https://vi.wikisource.org/w/index.php?oldid=202229) |
| 06 | Trần Tế Xương | Thương vợ | Quanh năm buôn bán ở mom sông | [202722](https://vi.wikisource.org/w/index.php?oldid=202722) |
| 07 | Nguyễn Khuyến | Bạn đến chơi nhà | Đã bấy lâu kia, bác tới nhà, | [206536](https://vi.wikisource.org/w/index.php?oldid=206536) |
| 08 | Nguyễn Khuyến | Khóc Dương Khuê | Bác Dương thôi đã thôi rồi, | [206406](https://vi.wikisource.org/w/index.php?oldid=206406) |
| 09 | Hồ Xuân Hương | Tự tình II | Đêm khuya văng vẳng trống canh dồn, | [201632](https://vi.wikisource.org/w/index.php?oldid=201632) |
| 10 | Tản Đà | Muốn làm thằng Cuội | Đêm thu buồn lắm chị Hằng ơi! | [64090](https://vi.wikisource.org/w/index.php?oldid=64090) |
| 11 | Bà Huyện Thanh Quan | Thăng Long thành hoài cổ | Tạo hóa gây chi cuộc hí trường, | [18342](https://vi.wikisource.org/w/index.php?oldid=18342) |
| 12 | Bà Huyện Thanh Quan | Chiều hôm nhớ nhà | Vàng tỏa non tây, bóng ác tà; | [168443](https://vi.wikisource.org/w/index.php?oldid=168443) |

### th

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | สุนทรภู่ | นิราศภูเขาทอง | ออกจากวัดทัศนาดูอาวาส | [251299](https://th.wikisource.org/w/index.php?oldid=251299) |
| 02 | สุนทรภู่ | นิราศภูเขาทอง | สามฤดูอยู่ดีไม่มีภัย | [251299](https://th.wikisource.org/w/index.php?oldid=251299) |
| 03 | สุนทรภู่ | นิราศภูเขาทอง | โอ้อาวาสราชบุรณะพระวิหาร | [251299](https://th.wikisource.org/w/index.php?oldid=251299) |
| 04 | สุนทรภู่ | นิราศภูเขาทอง | จะยกหยิบธิบดีเป็นที่ตั้ง | [251299](https://th.wikisource.org/w/index.php?oldid=251299) |
| 05 | นายนรินทรธิเบศร์ (อิน) | นิราศนรินทร์ | ศรีอยุธเยนทร์แย้มฟ้า | [272073](https://th.wikisource.org/w/index.php?oldid=272073) |
| 06 | นายนรินทรธิเบศร์ (อิน) | นิราศนรินทร์ | ขุนหาญห้าวแหนบาท | [272073](https://th.wikisource.org/w/index.php?oldid=272073) |
| 07 | สมเด็จพระมหาสมณเจ้า กรมพระปรมานุชิตชิโนรส | ลิลิตตะเลงพ่าย | ๏ บุญเจ้าจอมภพพื้น | [281319](https://th.wikisource.org/w/index.php?oldid=281319) |
| 08 | สมเด็จพระมหาสมณเจ้า กรมพระปรมานุชิตชิโนรส | ลิลิตตะเลงพ่าย | พระฤทธิ์ดังฤทธิ์ราม | [281319](https://th.wikisource.org/w/index.php?oldid=281319) |
| 09 | พระบาทสมเด็จพระพุทธเลิศหล้านภาลัย | อิเหนา | ๏ พระเสด็จลดเลี้ยวเที่ยวชม มีมโนภิรมย์แจ่มใส | [73266](https://th.wikisource.org/w/index.php?oldid=73266) |
| 10 | พระบาทสมเด็จพระพุทธเลิศหล้านภาลัย | อิเหนา | เพดานดาราระย้าย้อย ทองทับประดับพลอยเรือนอร่าม | [73266](https://th.wikisource.org/w/index.php?oldid=73266) |
| 11 | สมเด็จพระมหาสมณเจ้า กรมพระปรมานุชิตชิโนรส | กฤษณาสอนน้องคำฉันท์ | ๏ ขอถวายภิวาทนศาสดาดิลกธรรม์ | [227461](https://th.wikisource.org/w/index.php?oldid=227461) |
| 12 | สมเด็จพระมหาสมณเจ้า กรมพระปรมานุชิตชิโนรส | กฤษณาสอนน้องคำฉันท์ | นบพรหมินทร์วชรินทรวิษณุศิวา | [227461](https://th.wikisource.org/w/index.php?oldid=227461) |

### id

| # | Poet | Poem | First line | Revision |
|---|---|---|---|---|
| 01 | Raja Ali Haji | Gurindam Dua Belas | Barang siapa tiada memegang agama, | [268498](https://id.wikisource.org/w/index.php?oldid=268498) |
| 02 | Raja Ali Haji | Gurindam Dua Belas | Barang siapa mengenal yang empat, | [268498](https://id.wikisource.org/w/index.php?oldid=268498) |
| 03 | Raja Ali Haji | Gurindam Dua Belas | Barang siapa mengenal Allah, | [268498](https://id.wikisource.org/w/index.php?oldid=268498) |
| 04 | Raja Ali Haji | Gurindam Dua Belas | Barang siapa mengenal diri, | [268498](https://id.wikisource.org/w/index.php?oldid=268498) |
| 05 | Hamzah al-Fansuri | Syair Perahu | Wahai muda kenali dirimu, | [252081](https://id.wikisource.org/w/index.php?oldid=252081) |
| 06 | Hamzah al-Fansuri | Syair Perahu | Hai muda arif-budiman, | [252081](https://id.wikisource.org/w/index.php?oldid=252081) |
| 07 | Amir Hamzah | Berdiri Aku | Berdiri aku di senja senyap | [149823](https://id.wikisource.org/w/index.php?oldid=149823) |
| 08 | Amir Hamzah | Berdiri Aku | Angin pulang menyejuk bumi | [149823](https://id.wikisource.org/w/index.php?oldid=149823) |
| 09 | Amir Hamzah | Padamu Jua | Habis kikis | [26439](https://id.wikisource.org/w/index.php?oldid=26439) |
| 10 | Amir Hamzah | Hanyut Aku | Hanyut aku, kekasihku! | [26440](https://id.wikisource.org/w/index.php?oldid=26440) |
| 11 | Chairil Anwar | Derai-Derai Cemara | cemara menderai sampai jauh | [100885](https://id.wikisource.org/w/index.php?oldid=100885) |
| 12 | Chairil Anwar | Aku | Melangkahkan aku bukan tuak menggelegak | [245951](https://id.wikisource.org/w/index.php?oldid=245951) |

## The Wikipedia sentences

| Language | Article | Revision |
|---|---|---|
| en | Bread (bread (Q7802)) | [1385492909](https://en.wikipedia.org/w/index.php?oldid=1385492909) |
| en | Bicycle (bicycle (Q11442)) | [1375091239](https://en.wikipedia.org/w/index.php?oldid=1375091239) |
| en | Cat (house cat (Q146)) | [1385977719](https://en.wikipedia.org/w/index.php?oldid=1385977719) |
| es | Pan (bread (Q7802)) | [176220152](https://es.wikipedia.org/w/index.php?oldid=176220152) |
| es | Bicicleta (bicycle (Q11442)) | [175654344](https://es.wikipedia.org/w/index.php?oldid=175654344) |
| es | Felis catus (house cat (Q146)) | [176297049](https://es.wikipedia.org/w/index.php?oldid=176297049) |
| fr | Pain (bread (Q7802)) | [240824437](https://fr.wikipedia.org/w/index.php?oldid=240824437) |
| fr | Vélo (bicycle (Q11442)) | [241308339](https://fr.wikipedia.org/w/index.php?oldid=241308339) |
| fr | Chat (house cat (Q146)) | [241042592](https://fr.wikipedia.org/w/index.php?oldid=241042592) |
| de | Brot (bread (Q7802)) | [271526502](https://de.wikipedia.org/w/index.php?oldid=271526502) |
| de | Fahrrad (bicycle (Q11442)) | [271910121](https://de.wikipedia.org/w/index.php?oldid=271910121) |
| de | Hauskatze (house cat (Q146)) | [271963638](https://de.wikipedia.org/w/index.php?oldid=271963638) |
| it | Pane (bread (Q7802)) | [152571357](https://it.wikipedia.org/w/index.php?oldid=152571357) |
| it | Bicicletta (bicycle (Q11442)) | [153344035](https://it.wikipedia.org/w/index.php?oldid=153344035) |
| it | Felis silvestris catus (house cat (Q146)) | [153347004](https://it.wikipedia.org/w/index.php?oldid=153347004) |
| pt | Pão (bread (Q7802)) | [73084145](https://pt.wikipedia.org/w/index.php?oldid=73084145) |
| pt | Bicicleta (bicycle (Q11442)) | [72391865](https://pt.wikipedia.org/w/index.php?oldid=72391865) |
| pt | Gato (house cat (Q146)) | [72947586](https://pt.wikipedia.org/w/index.php?oldid=72947586) |
| pl | Chleb (bread (Q7802)) | [81126828](https://pl.wikipedia.org/w/index.php?oldid=81126828) |
| pl | Rower (bicycle (Q11442)) | [81126573](https://pl.wikipedia.org/w/index.php?oldid=81126573) |
| pl | Kot domowy (house cat (Q146)) | [81185352](https://pl.wikipedia.org/w/index.php?oldid=81185352) |
| ru | Хлеб (bread (Q7802)) | [155953656](https://ru.wikipedia.org/w/index.php?oldid=155953656) |
| ru | Велосипед (bicycle (Q11442)) | [155963886](https://ru.wikipedia.org/w/index.php?oldid=155963886) |
| ru | Кошка (house cat (Q146)) | [155981833](https://ru.wikipedia.org/w/index.php?oldid=155981833) |
| ar | خبز (bread (Q7802)) | [77148269](https://ar.wikipedia.org/w/index.php?oldid=77148269) |
| ar | دراجة هوائية ثنائية (bicycle (Q11442)) | [76652727](https://ar.wikipedia.org/w/index.php?oldid=76652727) |
| ar | قط (house cat (Q146)) | [76650814](https://ar.wikipedia.org/w/index.php?oldid=76650814) |
| hi | डबलरोटी (bread (Q7802)) | [6476244](https://hi.wikipedia.org/w/index.php?oldid=6476244) |
| hi | सायकिल (bicycle (Q11442)) | [5927669](https://hi.wikipedia.org/w/index.php?oldid=5927669) |
| hi | बिल्ली (house cat (Q146)) | [6643363](https://hi.wikipedia.org/w/index.php?oldid=6643363) |
| zh | 麵包 (bread (Q7802)) | [95328657](https://zh.wikipedia.org/w/index.php?oldid=95328657) |
| zh | 雙輪車 (bicycle (Q11442)) | [93745919](https://zh.wikipedia.org/w/index.php?oldid=93745919) |
| zh | 猫 (house cat (Q146)) | [94622108](https://zh.wikipedia.org/w/index.php?oldid=94622108) |
| ja | パン (bread (Q7802)) | [111684813](https://ja.wikipedia.org/w/index.php?oldid=111684813) |
| ja | 自転車 (bicycle (Q11442)) | [111566101](https://ja.wikipedia.org/w/index.php?oldid=111566101) |
| ja | ネコ (house cat (Q146)) | [111412362](https://ja.wikipedia.org/w/index.php?oldid=111412362) |
| ko | 빵 (bread (Q7802)) | [42823533](https://ko.wikipedia.org/w/index.php?oldid=42823533) |
| ko | 자전거 (bicycle (Q11442)) | [42823522](https://ko.wikipedia.org/w/index.php?oldid=42823522) |
| ko | 고양이 (house cat (Q146)) | [42842916](https://ko.wikipedia.org/w/index.php?oldid=42842916) |
| vi | Bánh mì (bread (Q7802)) | [74936685](https://vi.wikipedia.org/w/index.php?oldid=74936685) |
| vi | Xe đạp (bicycle (Q11442)) | [75726235](https://vi.wikipedia.org/w/index.php?oldid=75726235) |
| vi | Mèo (house cat (Q146)) | [75645799](https://vi.wikipedia.org/w/index.php?oldid=75645799) |
| th | ขนมปัง (bread (Q7802)) | [13327768](https://th.wikipedia.org/w/index.php?oldid=13327768) |
| th | จักรยาน (bicycle (Q11442)) | [13388052](https://th.wikipedia.org/w/index.php?oldid=13388052) |
| th | แมว (house cat (Q146)) | [13382539](https://th.wikipedia.org/w/index.php?oldid=13382539) |
| id | Roti (bread (Q7802)) | [30096444](https://id.wikipedia.org/w/index.php?oldid=30096444) |
| id | Sepeda (bicycle (Q11442)) | [30010939](https://id.wikipedia.org/w/index.php?oldid=30010939) |
| id | Kucing (house cat (Q146)) | [30110220](https://id.wikipedia.org/w/index.php?oldid=30110220) |
