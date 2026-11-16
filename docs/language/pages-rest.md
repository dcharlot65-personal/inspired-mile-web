# The remaining pages in sixteen languages: sources, checks and what is not checked

Branch `lang/pages-rest`, 2026-11-16. Pages: classroom, marketplace, tournaments, season,
3D viewer, VR gallery, the offline page, the error boundary, the web app manifest (name,
description, shortcuts), the install guidance and the storage note of `src/lib/pwa.ts`, and
every message the page shows when the API refuses a request.

Strings: `src/i18n/pages/<area>/<locale>.ts`, seven areas (`classroom`, `marketplace`,
`tournaments`, `season`, `viewer`, `shared`, `pwa`), 295 keys in English; a language has
more or fewer as it has more or fewer plural forms (Arabic 303, Russian 299, Japanese 293).

## Who wrote the text

**The translations were written by a language model** (the engineer on this branch, Claude),
not taken from a published translation: there is none for this game's own sentences. They
have **not been read by a native speaker of any of the fifteen languages**. Everything below
says what was done to check them with tools that did not write them, and what those tools
cannot see. Nothing in this file should be read as "verified by a person".

What did come from a source, and not from the model:

| What | Source | Licence | Fetched |
|---|---|---|---|
| Which plural form a number takes, in every language | Unicode CLDR plural rules, through `Intl.PluralRules` (ICU in Node and in the browser; Node 26.13.1 on the build host reports ICU 79.1, CLDR 49.0) | Unicode License v3 | at run time |
| Digit grouping, date order, date ranges, "A, B and C" | Unicode CLDR, through `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.ListFormat` (`src/i18n/fmt.ts`) | Unicode License v3 | at run time |
| The names of things in the term tables below (teacher, student, class, homework, tournament formats, bye, bracket, virtual and augmented reality, Gaussian splatting, multiple choice), **where a table says so**: many of these words have no source, and the tables say which | Wikidata labels and the titles of the Wikipedia articles they link to: `docs/language/sources/pages-rest-wikidata-terms-a.json`, `…-b.json` (the API answers as fetched); which word each language took, and how it stands to the label, is in `docs/language/pages-rest-terms.json` | CC0 (Wikidata); article titles are facts | 2026-11-16 |
| The words for home, collection, battle arena and the tagline on the offline page and in the manifest | the game's own core locale (`src/i18n/locales`), copied, and held equal by a test | (ours) | 2026-11-16 |
| The manifest's `name_localized` / `description_localized` members, and `name_localized` inside each shortcut (there is no `shortcuts_localized`) | MDN "`*_localized`" (developer.mozilla.org/…/Manifest/Reference/*_localized); Chrome for Developers "Localization support for web app manifests" (Chrome and Edge 148) | n/a | read 2026-11-16 |
| "MB" and "GB" in each language (fr *Mo*, *Go*; ru *МБ*, *ГБ*; ar *م.ب*, *غ.ب*), and the space before them (fr: U+202F) | Unicode CLDR unit patterns, through `Intl.NumberFormat` with `style: 'unit'` (`src/lib/pwa.ts`) | Unicode License v3 | at run time |
| The iPhone controls the install guidance names: the Share button and "Add to Home Screen" | Apple, iPhone User Guide, "Bookmark a website", section "Add a website icon to your Home Screen", in each of the sixteen languages: `docs/language/sources/pages-rest-apple-home-screen.json` (`scripts/pages-rest/fetch-apple-home-screen.mjs`; the steps as Apple prints them, and the alt text of the Share button's icon) | Apple Inc. text, quoted as evidence of the term | 2026-11-16 |
| The buttons Install and Not now; the word for the characters of a join code; the verb for a pinch where Apple has no Apple Vision Pro guide | Android Open Source Project string resources at commit `1cdfff5`: PackageInstaller `install`, framework `autofill_save_notnow`, `policydesc_limitPassword`, `capability_desc_canPerformGestures`: `docs/language/sources/pages-rest-android-terms.json` (`scripts/pages-rest/fetch-android-terms.mjs`; the same commit as branch lang/qa-pipeline's record) | Apache-2.0 | 2026-11-16 |
| The gesture that selects on Apple Vision Pro (es fr de it ar zh ja ko; Apple serves its English page for the other seven) | Apple, Apple Vision Pro User Guide, "Learn basic gestures and controls on Apple Vision Pro", first row of the table "Use eyes and hands to navigate visionOS": `docs/language/sources/pages-rest-apple-vision-gestures.json` (`scripts/pages-rest/fetch-apple-vision-gestures.mjs`) | Apple Inc. text, quoted as evidence of the term | 2026-11-16 |
| Arabic و written on a Latin name (وiPad), not apart | Apple's Arabic pages, counted: attached 56 times on three marketing pages, spaced 14 times on two user-guide pages: `docs/language/sources/pages-rest-apple-arabic-wa.json` (`scripts/pages-rest/fetch-apple-arabic-wa.mjs`) | Apple Inc. text, quoted as evidence of usage | 2026-11-16 |
| The form of a right-to-left value in the manifest (`{ "value", "dir": "rtl" }`) | MDN "`*_localized`", section "Text localization" | n/a | read 2026-11-16 |
| battle rap (Q12302979) and card game (Q142714), for the manifest's description | Wikidata labels and article titles: `docs/language/sources/pages-rest-wikidata-terms-c.json` (`scripts/pages-rest/fetch-wikidata-terms.mjs`) | CC0 | 2026-11-16 |
| The manifest's shortcut names: Battle Arena, The Theatre | the core locale's `nav.battle`, and the Theatre's heading `theatre.titleA` + `theatre.titleB`, copied and held equal by a test | (ours) | 2026-11-16 |

## Terms, and where each comes from

The record is `docs/language/pages-rest-terms.json`: for each term, the word each language's
strings use and how that word stands to its source. The tables below are drawn from it
(`node scripts/pages-rest/terms.mjs --write`), and `src/i18n/pages-rest-terms.test.ts` fails
when a table, the record, a saved source answer and the strings disagree:

- a relation is checked against the saved answer of the source (`docs/language/sources/…`);
- every area string whose English uses the term must use the language's word, or an inflected
  form the record lists, or carry a reason in the record for wording it otherwise;
- a verdict in `docs/language/pages-rest-meaning.json` that names a source (Wikidata, a Q-id,
  Apple, Android) must name a term of the record that has that source in that language, and a
  verdict on a word with no source must say "no source".

How to read a cell. `word =`: the source's word, apart from letter case, inflection the record
lists, Arabic vowel marks, quotation marks and hyphens ("(article)": the title of the Wikipedia
article Wikidata links, not its label; a word in italics after it: the form the source writes,
which the strings inflect). `word (from …)`: a part of the source's longer word. `word (with
…)`: the source's word with more beside it. `word (…, Traditional)`: Wikidata has only the
Traditional Chinese word; the strings write it in Simplified characters. **Bold word**, then
Wikidata's word: the source has a word and the strings use another, for the reason given; not
from the source. `word: none`: **the source has nothing in that language; the word is the
model's, with no source.**

Until 2026-11-16 these tables were written by hand, and they said more than the sources did:
the verdicts on the bye in Japanese, Polish, Portuguese, Russian and Vietnamese called those
words Wikidata's labels (Wikidata has no label or article for Q1268659 in any of the five), and
the text said virtual and augmented reality had Wikidata's label in every language but Hindi,
while the Thai strings had a shorter word (ความจริงเสมือน, ความจริงเสริม) in the badge and the 3D
viewer and Wikidata's (ความเป็นจริงเสมือน) in the VR page's description, and Polish had reversed
the order of both (*wirtualna rzeczywistość*, *rozszerzona rzeczywistość*; Wikidata *rzeczywistość
wirtualna*, *rzeczywistość rozszerzona*). An independent checker found both; no test did. The
Thai and Polish strings now use Wikidata's words, and the record is checked as above.

### School

<!-- terms:school -->
| | teacher (Q37226) | student (Q48282, Q48942) | class (Q18204) | assignment (compared with homework) (Q753877) | characters (of a join code: letters and digits) |
|---|---|---|---|---|---|
| es | **docente**. Wikidata: label *profesor*, article *Enseñante*. One form for a man and a woman. The model's choice; no recorded source. | estudiante = (Q48282) | clase = | **tarea**. Wikidata: label *trabajo escolar*, article *Trabajo escolar*. An assignment, done at home or not. The model's choice; no recorded source. | caracteres = (Android) |
| fr | enseignant = (article). The label, enseignant ou enseignante, where the teacher names themself. | élève = (Q48942) | classe = | devoir (from *devoir à la maison*) | caractères = (Android) |
| de | **Lehrkraft**. Wikidata: label *Lehrer*, article *Lehrer*. Not gendered. The model's choice; no recorded source. | Schüler = (article) (Q48942). Both forms written: Schülerin oder Schüler. | Klasse (from *Schulklasse*) | Aufgabe (from *Hausaufgabe*) | Zeichen = (Android) |
| it | insegnante = | studente = (Q48282) | classe = | compito (from *compiti a casa*). The singular of the source's compiti. | caratteri = (Android) |
| pt | professor = | estudante = (Q48282) | turma: **none**. The Brazilian word for a class as a group. | **tarefa**. Wikidata: label *lição de casa*, article *Lição de casa*. An assignment, done at home or not. The model's choice; no recorded source. | caracteres = (Android) |
| pl | nauczyciel = | uczeń = (Q48942) | klasa = | **zadanie**. Wikidata: label *praca domowa*, article *Praca domowa*. An assignment, done at home or not. The model's choice; no recorded source. | znaków = (Android) |
| ru | учитель = | ученик = (Q48282) | класс = | задание (from *домашнее задание*) | символов = (Android: *символы*). The genitive plural of Android’s символы, after a number. |
| ar | **معلّم**. Wikidata: label *مدرس*, article *مدرس*. Both are standard. The model's choice; no recorded source. | طالب = (Q48282) | **صف**. Wikidata: label *فصل دراسي*. Both are used; صف is the shorter. The model's choice; no recorded source. | واجب (from *واجب منزلي*) | أحرف = (Android). Android’s word for the characters of a password; أحرف وأرقام (letters and digits) where the error says what a code is made of. |
| hi | शिक्षक = | विद्यार्थी = (Q48282) | कक्षा: **none**. | कार्य (from *गृहकार्य*). The second half of गृहकार्य (home + work). The least sure of these words. | वर्ण = (Android) |
| zh | 教师 =. 老师 where a pupil speaks of their own teacher (the student's consent). | 学生 = (Q48282) | 班级 (*班級*, Traditional) | 作业 = | **位**: Android has another word. 6 位 counts the places of a code, as Chinese counts a code’s characters; Android has 字符. The model’s choice; no recorded source. |
| ja | 教員 =. 先生 where a pupil speaks of their own teacher. | 生徒 = (Q48282) | クラス (from *教育におけるクラス*) | **課題**. Wikidata: label *宿題*, article *宿題*. An assignment, done at home or not. The model's choice; no recorded source. | 文字 = (Android) |
| ko | 교사 =. 선생님 where a pupil speaks of their own teacher. | 학생 = (Q48282) | 학급 = | **과제**. Wikidata: label *숙제*, article *숙제*. An assignment, done at home or not. The model's choice; no recorded source. | **글자**: Android has another word. Android has 문자; 6글자 is the everyday count. The model’s choice; no recorded source. |
| vi | giáo viên = | học sinh = (Q48942) | lớp học: **none**. | bài tập (from *Bài tập về nhà*) | ký tự = (Android) |
| th | ครู = | นักเรียน = (Q48282) | ชั้นเรียน: **none**. | **งานที่มอบหมาย**. Wikidata: label *การบ้าน*, article *การบ้าน*. Work given out; งาน alone where the sentence already says who gives it. The model's choice; no recorded source. | อักขระ = (Android) |
| id | guru = | siswa = (Q48942) | kelas = | **tugas**. Wikidata: label *Pekerjaan rumah*, article *Pekerjaan rumah*. An assignment, done at home or not. The model's choice; no recorded source. | karakter = (Android) |
<!-- /terms:school -->

**Grade level** appears in one place only, the example of a classroom name in the teacher's
tour. English has "Period 3 English"; each language has an example in its own school's way
of naming a class (es "Literatura 3.º B", fr "Français 4e B", de "Englisch 9b", it "Inglese
3ª B", pt "Literatura 9º ano B", pl "Język angielski, klasa 2b", ru "Литература, 9 „Б“", ar
"الصف التاسع (ب) – اللغة الإنجليزية", hi "कक्षा 9 (ब) – अंग्रेज़ी", zh "九年级（2）班 英语", ja
"3年B組 英語", ko "3학년 2반 영어", vi "Lớp 9A – Ngữ văn", th "ม.3/2 ภาษาอังกฤษ", id "Kelas 9B –
Bahasa Inggris"). **These were written by the model from general knowledge of each school
system and have no recorded source.** They are examples, not instructions, but a teacher
will see at once if one is off.

**The join code** is six characters from A–Z without I and O, and 2–9
(`backend/src/classroom/handlers.rs`, `generate_join_code`). Main's English called it a
"6-letter code", and the translations said letters (es *letras*, de *Buchstaben*, zh *字母*, id
*huruf*, …), which tells a player that a code with a digit in it is wrong. The English now says
"6-character code" (the placeholder, the two tour steps and the prompt; the page's own fallback
text too), and the error for a wrong code says "It has 6 characters, letters and digits". The
word for a character is Android's (`policydesc_limitPassword`, "the characters allowed in screen
lock passwords"), except in Chinese and Korean (see the table).

### Tournaments

<!-- terms:tournaments -->
| | single elimination (Q864897) | round robin (Q841144) | bracket (Q4953688) | bye (Q1268659) |
|---|---|---|---|---|
| es | eliminación directa = | todos contra todos (from *sistema de todos contra todos*) | cuadro: **none**. | **Exento**. Wikidata: label *Bye*, article *Exención (competiciones deportivas)*. The adjective of the article's Exención; the label is the English word. |
| fr | élimination directe (from *tournoi à élimination directe*) | toutes rondes (from *tournoi toutes rondes*) | tableau = | **Exempt**. Wikidata: label *bye*, article *Bye*. The label and the article are the English word. The model's choice; no recorded source. |
| de | K.‑o.‑System = (article). Non-breaking hyphens, so that it does not break at its own hyphen. | jeder gegen jeden (from the article *Jeder-gegen-jeden-Turnier*) | Turnierbaum = | Freilos = |
| it | eliminazione diretta = | girone all’italiana = (article) | tabellone: **none**. | Bye = |
| pt | eliminação simples: **none**. | todos contra todos (from *Competições de todos contra todos*) | chave: **none**. | Folga: **none**. |
| pl | system pucharowy = | system kołowy =. The everyday każdy z każdym is written beside it, and alone in running text. | drabinka: **none**. | Wolny los: **none**. |
| ru | на выбывание (from *турнир на выбывание*) | круговая система = (article) | сетка = | Без соперника: **none**. |
| ar | خروج المغلوب = | دورة روبن =. The everyday نظام الدوري is written before it, and alone in running text. | جدول البطولة = | **تأهّل دون لعب**. Wikidata: label *لقاء*, article *استبقاء*. A description: the label (لقاء) means a meeting, and the article's word (استبقاء) is not one a player would know. |
| hi | एकल उन्मूलन (from *एकल उन्मूलन टूर्नामेंट*) | राउंड-रॉबिन (from *राउंड-रॉबिन प्रतियोगिता*) | ब्रैकेट: **none**. | बाई: **none**. |
| zh | 单败淘汰制 = | 循环赛 = | 对阵表 = | 轮空 = |
| ja | ノックアウト方式 (from *ノックアウト方式のトーナメント*) | **総当たり戦**. Wikidata: label *リーグ戦*, article *リーグ戦*. The Japanese article glosses its label, リーグ戦, as 総当たり戦; the plainer word was kept. | トーナメント表: **none**. | 不戦勝: **none**. |
| ko | 싱글 엘리미네이션 (from *싱글 엘리미네이션 토너먼트*) | 리그전 = | 대진표: **none**. | 부전승 = |
| vi | loại trực tiếp (from *giải đấu loại trực tiếp*) | vòng tròn (from *Thi đấu vòng tròn*) | sơ đồ thi đấu: **none**. | Miễn đấu: **none**. |
| th | แพ้คัดออก (from *การแข่งขันแบบแพ้คัดออก*) | พบกันหมด (from *การแข่งขันแบบพบกันหมด*) | สายการแข่งขัน: **none**. | บาย: **none**. |
| id | sistem gugur = | sistem kompetisi = | bagan pertandingan: **none**. | Bye (from *Bye (olahraga)*) |
<!-- /terms:tournaments -->

Seven strings were changed after this comparison was first made by hand, because the first
wording disagreed with the source: it `Bye` (was *Riposo*), ja `ノックアウト方式` (was *勝ち抜き戦*,
which the Japanese Wikipedia gives an article of its own, Q11400120, covering both a knockout
tournament and the team format where the winner stays on), zh `单败淘汰制` and `对阵表`, ko `리그전`,
hi `एकल उन्मूलन`, id `Sistem kompetisi`, ar `جدول البطولة`; and es and fr "multiple choice" now
follow their labels (*opción múltiple*, *à choix multiples*).

### Technology

<!-- terms:technology -->
| | virtual reality (Q170519) | augmented reality (Q254183) | Gaussian splat (Q123134457) | pinch (to select, on Apple Vision Pro) |
|---|---|---|---|---|
| es | realidad virtual = | realidad aumentada = | splat gaussiano: **none**. | toca el dedo índice con el pulgar = (Apple) |
| fr | réalité virtuelle = | réalité augmentée = | **splat gaussien**. Wikidata: no label, article *Gaussian splatting*. The article keeps the English name of the technique; the strings name the thing it draws. | faites se toucher votre index et votre pouce = (Apple) |
| de | virtuelle Realität = | erweiterte Realität = | Gaussian Splat (from *Gaussian Splatting*) | tippe dann deinen Zeigefinger und Daumen zusammen = (Apple) |
| it | realtà virtuale = | realtà aumentata = | splat gaussiano: **none**. | tocca con l’indice e il pollice = (Apple) |
| pt | realidade virtual = | realidade aumentada = | **splat gaussiano**. Wikidata: label *Dispersão gaussiana*, article *Dispersão gaussiana*. The English splat kept, as in the other Latin-script languages. The model's choice; no recorded source. | faça o gesto de pinça = (Android: *gestos de pinça*). Apple publishes no Apple Vision Pro guide in Portuguese; the singular of Android's gestos de pinça. |
| pl | rzeczywistość wirtualna = | rzeczywistość rozszerzona = | splat gaussowski: **none**. | ściągnij palce = (Android: *ściągnięcia palców*). Apple publishes no Apple Vision Pro guide in Polish; the imperative of Android's ściągnięcia palców. |
| ru | виртуальная реальность = | дополненная реальность = | гауссов сплат: **none**. | **сожми пальцы**: Android has another word. Apple publishes no Apple Vision Pro guide in Russian, and Android's Russian names the zoom the gesture does (масштабирование), not the gesture. The model's choice; no recorded source. |
| ar | واقع افتراضي = | واقع معزز = | **Gaussian Splat**. Wikidata: label *التشطيب الغاوسي*, article *التشطيب الغاوسي*. The English name kept. The model's choice; no recorded source. | اضغط بإصبعي السبابة والإبهام معًا = (Apple) |
| hi | **वर्चुअल रियलिटी**. Wikidata: label *आभासी यथार्थ*, article *आभासी यथार्थ*. The core locale's word; the owner may prefer the Hindi-rooted term throughout. | **ऑगमेंटेड रियलिटी**. Wikidata: label *संवर्धित वास्तविकता*, article *संवर्धित वास्तविकता*. As वर्चुअल रियलिटी: the core locale's way with these words. | गॉसियन स्प्लैट: **none**. | पिंच करें = (Android: *पिंच*). Apple publishes no Apple Vision Pro guide in Hindi; Android's पिंच, with करें. |
| zh | 虚拟现实 = | 增强现实 = | 高斯泼溅: **none**. | 互点食指和拇指 = (Apple) |
| ja | バーチャルリアリティ = | 拡張現実 = | ガウシアン・スプラッティング = | 人差し指と親指をタップして = (Apple) |
| ko | 가상 현실 = | 증강 현실 = | 가우시안 스플랫: **none**. | 검지와 엄지를 함께 탭 = (Apple) |
| vi | thực tế ảo = | thực tế tăng cường = (article) | Gaussian splat: **none**. | chụm ngón tay = (Android: *chụm*). Apple publishes no Apple Vision Pro guide in Vietnamese; Android's chụm, with ngón tay (fingers). |
| th | ความเป็นจริงเสมือน = | ความเป็นจริงเสริม = | Gaussian splat: **none**. | บีบนิ้ว = (Android: *บีบ*). Apple publishes no Apple Vision Pro guide in Thai; Android's บีบ, with นิ้ว (fingers). |
| id | realitas virtual = | realitas tertambah = | Gaussian splat: **none**. | cubit = (Android: *mencubit*). Apple publishes no Apple Vision Pro guide in Indonesian; the imperative of Android's mencubit. |
<!-- /terms:technology -->

Hindi says वर्चुअल रियलिटी and ऑगमेंटेड रियलिटी, as the game's core locale already does (Wikidata:
*आभासी यथार्थ*, *संवर्धित वास्तविकता*). One word for a thing across the game was put first; the
owner may prefer the Hindi-rooted terms throughout. "GLB", "WebXR", "Quest 3", "Vision Pro",
"Babylon.js" and "model-viewer" are names and are not translated.

**The Vision Pro gesture.** The English says "pinch to select"; Apple's own guide calls the
gesture a tap of the index finger and thumb (Apple Vision Pro User Guide, "Learn basic gestures
and controls", first row of its table: `docs/language/sources/pages-rest-apple-vision-gestures.json`,
`scripts/pages-rest/fetch-apple-vision-gestures.mjs`). Where Apple publishes that guide (es, fr,
de, it, ar, zh, ja, ko) the strings now use Apple's instruction; elsewhere Apple serves its English
page, and the strings use Android's verb for a pinch (`capability_desc_canPerformGestures`, "Can
tap, swipe, pinch…"), except Russian, where Android names the zoom it does instead. Before, German
said *kneif* and Polish *uszczypnij palcami*, the words for pinching skin.

**Arabic "and" before a Latin name** is written on the name (وiPad, وVision Pro), as the
conjunction is written on any word. Publishers differ when the word is Latin; Apple's Arabic
marketing pages attach it 56 times and never space it, while two pages of its Arabic user guides
space it 14 times (`docs/language/sources/pages-rest-apple-arabic-wa.json`). These areas had both
(وiPad, و Vision Pro); they now attach it, as branch lang/pages-core does (وApple), and the unit
test refuses a spaced one. Branch lang/pages-play spaces it before character names (و Cordelia):
the integration should pick one rule for the whole game.

### The game

<!-- terms:game -->
| | credits (the game's currency) (no source) | multiple choice (Q867668) |
|---|---|---|
| es | crédito | opción múltiple (from *cuestionario de opción múltiple*) |
| fr | crédit | à choix multiples (from *questionnaire à choix multiples*) |
| de | Credit | Multiple-Choice = |
| it | credito | a scelta multipla (from *questionario a scelta multipla*) |
| pt | crédito | múltipla escolha = |
| pl | kredyt | **wielokrotnego wyboru**. Wikidata: label *pytanie zamknięte*. The label, pytanie zamknięte, is any closed question. The model's choice; no recorded source. |
| ru | кредит | **с выбором ответа**. Wikidata: label *опросник с несколькими вариантами ответа*. Shorter than the label. The model's choice; no recorded source. |
| ar | نقطة: Points: a countable word with clean forms for one, two and many. | أسئلة اختيار من متعدد = |
| hi | क्रेडिट | बहुविकल्पीय: **none**. |
| zh | 点: 点数 as a noun on its own. | 选择题 = |
| ja | クレジット | **選択式**. Wikidata: label *多肢選択法*, article *多肢選択法*. The label, 多肢選択法, is the testing method's technical name. The model's choice; no recorded source. |
| ko | 크레딧 | **객관식**. Wikidata: label *선다형 문제*, article *선다형 문제*. The everyday school word; the label, 선다형 문제, is the technical one. The model's choice; no recorded source. |
| vi | xu: Coins, the usual word for a game's currency. | trắc nghiệm (from *Trắc nghiệm nhiều lựa chọn*) |
| th | เครดิต | ปรนัย: **none**. |
| id | kredit | pilihan ganda: **none**. |
<!-- /terms:game -->

**Credits** (the game's currency) had no word in the core locale. The words are the model's,
with no source. If the collection or profile pages name the currency differently on another
branch, one of the two must give way.

### Install guidance and storage note (area `pwa`)

The English is main's (`src/lib/pwa.ts`, branch feat/pwa); it was moved into the area
unchanged. The two iPhone steps name Apple's controls with Apple's own words in each
language, and the two buttons use Android's:

<!-- terms:install -->
| | the Share button | Add to Home Screen | Install (the button) | Not now (the button) |
|---|---|---|---|---|
| es | el botón Compartir = (Apple) | Añadir a pantalla de inicio = (Apple) | Instalar = (Android) | Ahora no = (Android) |
| fr | le bouton Partager = (Apple) | Sur l’écran d’accueil = (Apple) | Installer = (Android) | Pas maintenant = (Android) |
| de | die Taste „Teilen“ = (Apple) | Zu Home-Bildschirm hinzufügen = (Apple) | Installieren = (Android) | Nicht jetzt = (Android) |
| it | il pulsante Condividi = (Apple) | Aggiungi alla schermata Home = (Apple) | Installa = (Android) | Non ora = (Android) |
| pt | botão Compartilhar = (Apple) | Adicionar à Tela de Início = (Apple) | Instalar = (Android) | Agora não = (Android) |
| pl | przycisk udostępniania = (Apple) | Do ekranu głównego = (Apple) | Zainstaluj = (Android) | Nie teraz = (Android) |
| ru | кнопки «Поделиться» = (Apple) | На экран „Домой“ = (Apple). Apple writes «На экран "Домой"»; the inner quotation marks are written „…“, as Russian nests them. | Установить = (Android) | Не сейчас = (Android) |
| ar | زر مشاركة = (Apple) | إضافة إلى الشاشة الرئيسية = (Apple) | تثبيت = (Android) | ليس الآن = (Android) |
| hi | “शेयर करें” बटन = (Apple) | होम स्क्रीन पर जोड़ें = (Apple) | इंस्टॉल करें = (Android) | अभी नहीं = (Android) |
| zh | “共享”按钮 = (Apple) | 添加到主屏幕 = (Apple) | 安装 = (Android) | 以后再说 = (Android) |
| ja | 共有ボタン = (Apple) | ホーム画面に追加 = (Apple) | インストール = (Android) | 後で = (Android) |
| ko | 공유 버튼 = (Apple) | 홈 화면에 추가 = (Apple) | 설치 = (Android) | 나중에 = (Android) |
| vi | nút Chia sẻ = (Apple) | Thêm vào Màn hình chính = (Apple) | Cài đặt = (Android) | Để sau = (Android) |
| th | ปุ่มแชร์ = (Apple) | เพิ่มไปยังหน้าจอโฮม = (Apple) | ติดตั้ง = (Android) | ไว้ทีหลัง = (Android) |
| id | tombol Bagikan = (Apple) | Tambah ke Layar Utama = (Apple) | Instal = (Android) | Lain kali = (Android) |
<!-- /terms:install -->

Apple's Spanish page says "toca Share" in its step text (untranslated, Apple's slip); the
alt text of the same page's icon, *el botón Compartir*, was used. **The English steps are
behind Apple's own guide**: for iOS 26 and 27 Apple writes "Tap the Page Menu button, then tap
Share" (the Share button is on the toolbar only in the Bottom and Top tab layouts), then
"Add to Home Screen", then "Add". The steps were translated as they stand; changing what
they say is the owner's call.

The rest of the area (why to install, what is kept and what may be cleared) was written by
the model in each language with the core locale's words for download, device, browser,
model and sign-in (`brain.kept`, `brain.canRun`, `auth.signIn`). The Thai storage note began
with the verb (เก็บข้อมูลไว้…, "keep the data…"), which reads as an instruction; it now says
what is kept (ข้อมูล {size} ถูกเก็บไว้…), and so does the note for a download at risk.

### The manifest

Main renamed the app on 2026-11-16 ("Sonnet Man: the duel of verses") and wrote a new
description. The name keeps "Sonnet Man" in Latin letters in every language (a product name,
like Inspired Mile), and the rest uses the core locale's words for duel and verse (es *duelo*,
*estrofas*; de *Duell*, *Strophen*; ja *決闘*, *詩*; …). In the description:

<!-- terms:manifest -->
| | rap battle (Q12302979) | card game (Q142714) |
|---|---|---|
| es | batalla de rap = | **juego de cartas**. Wikidata: label *juego de naipes*, article *Juego de naipes*. Naipes are playing cards; the core locale's word for the game's cards is cartas. |
| fr | battle de rap (with *battle*) | jeu de cartes = |
| de | Battle-Rap = | Kartenspiel = |
| it | battaglie rap: **none**. | gioco di carte = |
| pt | batalha de rap = | jogo de cartas = |
| pl | battle rap = | gra karciana = |
| ru | рэп-баттл = | карточная игра = |
| ar | باتل راب = | **لعبة بطاقات**. Wikidata: label *لعبة ورق*, article *لعبة ورق*. ورق is playing cards; the core locale's word for the game's cards is بطاقة. |
| hi | रैप-बैटल: **none**. | **कार्ड गेम**. Wikidata: label *ताश का खेल*, article *ताश का खेल*. ताश is playing cards; the core locale's word for the game's cards is कार्ड. |
| zh | **说唱对战**. Wikidata: label *饒舌戰*, article *對戰饒舌*. Wikidata has only Traditional Chinese, and 饒舌 is the Taiwanese word for rap; 说唱 is the mainland's. The model's choice; no recorded source. | 卡牌游戏 = |
| ja | MCバトル = | カードゲーム = |
| ko | 배틀 랩 = | 카드 게임 = |
| vi | rap chiến = | trò chơi bài = |
| th | แร็ปแบตเทิล: **none**. | **เกมการ์ด**. Wikidata: label *เกมไพ่*, article *เกมไพ่*. ไพ่ is playing cards; the core locale's word for the game's cards is การ์ด. |
| id | adu rap = | permainan kartu = |
<!-- /terms:manifest -->

Each Arabic value is written as `{ "value": …, "dir": "rtl" }`, the text-localization form of the
`*_localized` members (MDN, "*_localized", "Text localization"): the Arabic name begins with the
Latin "Sonnet Man", and a browser left to infer the direction from the text could lay it out left
to right. The other languages are left-to-right and stay plain strings. The shortcut "The
Theatre" is the core locale's heading of the Theatre, held equal by a test: in Korean that is
main's 더 극장, which branch lang/qa-pipeline changes to 입체 극장; after it lands, run
`node scripts/pages-rest/build-static.mjs` and the manifest follows.

## Register

Each language keeps the form of address of the core locale (es tú, fr vous, de du, it tu,
pt você, pl ty, ru ты, hi आप, ko 해요체, id kamu, …). The classroom page is read by teachers.
In German, Polish and Russian a tool for schools would more often address a teacher
formally; the informal address was kept so that one site does not speak in two voices, and
the consent statements, which are in the first person, are in the formal register of a
declaration in every language (ko 합니다체, th ข้าพเจ้า). **A native reviewer should decide
whether the teacher-facing text should be formal.**

## What English says that the owner should look at

These were translated as they stood; they are claims, not wording:

- The teacher's tour says the classroom is **"FERPA compliant"** and that the teacher can
  **see each student's completed work, scores and earned cards**. The page shows members and
  assignments; it has no view of a student's progress. Both claims are now in sixteen
  languages. FERPA is United States law and means little to a school elsewhere.
- **Changed**: the join code was a "6-letter code" (the placeholder, the prompt, two steps of the
  teacher's tour), but it has digits (A–Z without I and O, and 2–9, `generate_join_code` in
  `backend/src/classroom/handlers.rs`). The English now says "6-character code", and the error for
  a wrong code says "It has 6 characters, letters and digits" (it said "It has 6 letters"); the
  fifteen translations follow. Old and new English are in the commit that made the change.
- The third teacher checkbox refers to "the sections on classroom and educational use and
  on FERPA" of the Terms and the Privacy Policy, which are being rewritten on another branch
  and exist in English only.

## Checks, and what each found

The language tools ran on the build host (the Mac Studio, through `rb`) on 2026-11-16, over
the strings as a player reads them: every `{placeholder}` filled with a realistic value, plural
forms with a number that takes them, and sentences the markup builds from pieces (around a
link, a styled word) checked as the one sentence they make
(`node scripts/pages-rest/lang-check.mjs extract`: 287 to 295 strings per language). The unit
and browser tests and the mutations ran there and on the iMac Pro.

The tools and models are the copies branch lang/qa-pipeline installed on the Studio
(`im-lang/qa-pipeline`; its `docs/language/PROVENANCE.md` has checksums and revisions); this
branch only reads them:

| Tool or model | Version | Licence | Used for |
|---|---|---|---|
| LanguageTool, standalone server | 6.6 | LGPL 2.1 or later | grammar (es fr de it pt pl ru ar zh ja) |
| Hunspell | 1.7.2 | LGPL 2.1 / GPL 2 / MPL 1.1 | spelling, with LibreOffice `dictionaries` at commit `c0865a8` (licence per dictionary: es GPL3+/LGPL3+/MPL; de GPL 2 or 3; it GPL 3; pt_BR LGPL 3/MPL; pl GPL2/LGPL2.1/MPL/Apache/CC BY; hi GPL; ko GPL 3; vi GPL 2; th LGPL; id LGPL; en, fr, ru, ar under the terms in their own READMEs) |
| MADLAD-400 3B MT (Google), CTranslate2 int8 conversion | HF revision `aa32bbd` | Apache 2.0 | back-translation |
| all-MiniLM-L6-v2 | HF revision `1110a24` | Apache 2.0 | back-translation against the English |
| LaBSE (sentence-transformers) | HF revision `836121a` | Apache 2.0 | translation against the English |
| CTranslate2, sentencepiece, sentence-transformers, sacrebleu, torch | 4.9.0, 0.2.3, 6.3.0, 2.6.0, 2.15.0 | MIT, Apache 2.0, Apache 2.0, Apache 2.0, BSD-3 | running the above |
| ICU in Node 26.13.1 | ICU 79.1, CLDR 49.0 | Unicode License v3 | plural categories, numbers, dates, lists in the unit tests |

### Mechanical (every run of `npx vitest run`)

`src/i18n/pages-rest.test.ts`, 25 tests: every area has the keys of English in all sixteen
languages, no empty value, the same `{placeholders}` (a plural form may write its number out,
without `{n}`, only where its CLDR category stands for one number: Arabic "two" is 2, but
Russian "one" is also 21, 31, 101 and French "one" is also 0), exactly the plural forms Unicode
CLDR gives the language (through `Intl.PluralRules`: none missing, and none it does not have,
which `plural()` would never show), nothing left reading the same as English unless listed
(the list, `SAME_AS_ENGLISH`, is in `tests/pages-rest.fixtures.mjs`, and the browser test reads
it too), text in Unicode NFC with no hidden or directional character, and each language's own
punctuation (French no-break spaces, Spanish ¿ ¡, full-width marks in Chinese and Japanese,
Arabic ، ؛ ؟ and و written on the Latin word it joins, the Hindi danda, no full stop in Thai, a
no-break space before a German ellipsis); a word with two spellings in a language is spelt as the core locale spells it (see
"Terms the core locale is changing"); the pages and `src/lib/pwa.ts` ask only for keys that
exist; the offline page and the manifest match the shared area; `loadArea` puts English into a
language's messages for a key that language lacks; the Arabic values of the manifest say
`dir: "rtl"`. `src/i18n/pages-rest-terms.test.ts`, 8 tests: the terms record (see "Terms, and
where each comes from") against its saved sources, the strings, the meaning record and the doc's
tables, and six cases that show it failing on the defects found on 2026-11-16 (a bye recorded as
Wikidata's where Wikidata has none, the verdict that said so, Thai and Polish VR as they stood, a
third word for one thing, a vendor's word the vendor does not write). `src/lib/api-errors.test.ts`, 12 tests: it reads
`backend/src` and fails when the API can answer something that has no code, or a code has no
sentence in one of the sixteen languages.

`node scripts/pages-rest/mutate.mjs` breaks each of these checks on purpose and expects the
test to go red; see "Proof that the checks can fail" below.

### Spelling: Hunspell

The dictionaries of branch lang/qa-pipeline's install on the build host (`im-lang/qa-pipeline/dict`;
en is en_US, pt is pt_BR), asked word by word. A word that opens a sentence is asked again in
lower case. Before the run, the self-test showed each dictionary rejects a misspelt word and
accepts the right one, in all fourteen languages that have one. The table is the last run
(17:17, after every change on this page; `docs/language/results/pages-rest/spell.json`); the
first run's counts are given where they differ.

| | words asked | rejected | what they were | changed |
|---|---|---|---|---|
| es | 570 | 8 | imperative with a clitic (*Escríbelo*, *Publícalo*), *Reintentar*, *Prémium*, *shakespearianas* (read as correct Spanish by the model; not checked against the RAE's dictionary, which refused the request), the ordinal *3.º B* | none |
| fr | 623 | 3 (first run 4) | *battle* (Wikidata's label), *l’app*, *model-viewer*; first run also *l’XP* | *l’XP* rewritten (see LanguageTool) |
| de | 596 | 20 (first run 23) | compounds and loanwords (*Belohnungspfad*, *Strophenduell*, *GLB-Mesh*, *Credits*, *Home-Bildschirm*), the du-imperative *Prüf*; first run also *Nutz*, *Scroll* | *Nutz* → *Nutze* (the core locale's form), *scroll* → *scrolle* |
| it | 604 | 25 | elisions written with a typographic apostrophe (*l’annuncio*, *dell’insegnante*: the dictionary knows them with `'`), loanwords (*Pass*, *Bye*, *Home*, *mesh*, *controller*, *passkey*), *collezionabili* | none |
| pt | 575 | 7 | loanwords (*Premium*, *quiz*, *quizzes*, *headset*, *rap*) | none |
| pl | 660 | 6 | *splat*, *gaussowski* (technical) | none |
| ru | 680 | 18 | words split at *3D-* by the word breaker, inflected *Шекспир*, *сплат*, *Премиум*, *рэп-баттл* (Wikidata's label) | none |
| ar | 625 | 4 | *شكسبيرية*, *الباتل* (Wikidata's باتل راب), *وiPad* | none |
| hi | 488 | 23 | loanwords in Devanagari (*ऐप*, *पासकी*, *रीसेट*, *हेडसेट*) and ordinary forms the dictionary lacks (*चलने*, *सकी*, *समझती*, *दिखाएँ*) | none |
| ko | 633 | 31 | loanwords (*스플랫*, *크레딧*, *헤드셋*) and inflected forms (*드래그하면*, *이어갈*) | none |
| vi | 526 | 8 | tone mark placed on the first vowel (*khóa*, *xóa*, *hủy*): the core locale writes it that way (41 *khóa*, 1 *khoá*); the dictionary has the other convention | none |
| th | 407 | 20 | pieces of loanwords cut by the word breaker (*ควิซ*, *เชกส*/*เปียร์*, *เอน*/*จิน*, *แท็*/*บนี้*); each read in its sentence, none a typo | none |
| id | 518 | 37 | affixed forms the word list lacks (*kartumu*, *Perambanmu*, *Menginstal*, *tertambah*) and loanwords | none |
| zh, ja | | | no Hunspell dictionary | not checked |

### Grammar: LanguageTool 6.6

The same install, run as a local server on the build host at level "picky". Each language was
sent as one text with a string per paragraph (a request takes over a second on the loaded
host), except Chinese and Japanese, which are asked one string at a time.

**What the tool can see, per language** (`lang-host.sh selftest`, 15:34; four known-bad
sentences per language from branch lang/qa-pipeline's list, each asked alone): es, fr, de 4 of
4; pt, ru 3 of 4; ar 2 of 4; zh, ja 1 of 4; **it and pl 0 of 4**. In Italian and Polish
LanguageTool missed every planted error, so a clean result there is not a grammar check, and
the matches below for those two languages are what the tool happened to see. The batched path
was proved separately with a sentence each language's rules do flag alone: it is flagged inside
a text too, in every language that has rules. (A note in commit 31115d2 said the self-test had
shown Chinese and Japanese miss a planted error only inside a text; the log shows they missed
it alone too. They are asked one string at a time anyway.)

Matches per language in the last run (17:17, out of about 290 strings, after the fixes below):
es 16, fr 7, de 16, it 20, pt 23, pl 54, ru 7, ar 46, zh 3, ja 0. Every match was read. Most are
of four kinds that are not errors here: a rule against repeating a word, which fires across
separate strings once they share a text; a fragment that sits inside a sentence by design
(`market.by` "de Viola", the size "menos de 1 MB"); a button or a heading with no full stop
(all 42 of Polish's "brak kropki"); a loanword or a product name (fr *splat*, *battle*; ru
*сплат*, *рэп-баттла*). The first run, before the fixes, had es 16, fr 14, de 32, it 20, pt 26,
pl 54, ru 7, ar 50, zh 3, ja 0. Changed:

- fr: numbers under ten written in words in running text (*six lettres*, *un crédit*); no
  comma before the *ou* that closes a list; *de l’XP* (familiar) → *des points d’expérience (XP)*.
- de: a no-break space before an ellipsis that stands for omitted words (Duden; branch
  lang/qa-pipeline writes the core locale the same way); *Jeder gegen jeden* in lower case
  inside a sentence.
- pt: *não é válido* → *é inválido* (three messages).
- ar: *كلّف … بـ* → *أسند … إلى* (the rule holds كلّف to two direct objects; أسند is undisputed);
  the كـ calque for "as" → *في صورة*, *بـ*; *حُسمت بالفعل* → *سبق أن حُسمت*.

Read and left as they are, with the reason: ar *نماذج* (the rule wants *نموذجات*), *جاهز* (wants
*مُعدّ*), *الرئيسية* (wants *الرئيسة*; it is Apple's label), the vocalisation it suggests (*حُزْمَة*,
*المِلَفّ*), *لا يوجد* and *لا يشارك* read as a jussive, imperatives read as indefinite subjects;
it *a scelta multipla* (read as *ha scelta*), *collezionabili*; pl *klasa 2b*, and a missing
comma between two separate sentences; zh *补全* (read as *不全*), *关于…的章节* (attributive, not a
sentence-initial phrase); pt *dentro da turma*, *as duas coisas* (style).

LanguageTool has no rules for hi, ko, vi, th or id: their grammar was not checked by any tool.

Both tools were run again at 17:17, after the changes that reading the back-translations led
to (see "Meaning"): the same matches in every language (`docs/language/results/pages-rest/grammar.json`).

### Meaning: back-translation, and LaBSE beside it

`scripts/pages-rest/lang-host.sh bt-start` (then `bitext`), on the build host's GPU: every
translated string, as the player reads it, translated back to English by **MADLAD-400 3B**
(Google, Apache-2.0; CTranslate2, the model's own SentencePiece) and compared with the English
by **all-MiniLM-L6-v2** cosine; and, with no back-translation in between, the translation
compared with the English by **LaBSE** (a bitext model). This is the simplest equivalent of
branch lang/qa-pipeline's `scripts/lang/backtranslate.py` (that branch had not landed in main):
the same model files and Python environment, which it installed on the host. A string is
**flagged when both scores are under 0.6**, that branch's rule (`scripts/lang/meaning.mjs`).

**The control.** Each string is also scored against the wrong English (the next string's). With
the same rule, 3,814 of the 4,319 wrong pairings (88 %) were flagged in the full run, against
206 of the right ones (4.8 %; 205 after the changes below): the two signals tell a right English
sentence from a wrong one. One signal alone
cannot: MADLAD copies a one-word label through ("Klasemen", "Vittorie") or turns it into a
right word that is not the English one, so the back-translation alone put 838 strings under
0.6.

Run on 2026-11-16 (MADLAD from 15:27, 4,319 strings, 79 minutes on the shared GPU; LaBSE in 24
seconds there, after a CPU run had managed two CPU-minutes in fifteen on the loaded host and was
stopped). 23 strings were scored again on their own afterwards (`lang-host.sh bt-pairs`): the
six changed below, and 17 that had changed between the copy the run made and the end of the
first session (the XP gain lost its "+", *K.‑o.‑System* got non-breaking hyphens); those rows
carry `scoredAlone` and are left out of the control columns. Results:
`docs/language/results/pages-rest/bt.json` (every string, its back-translation and the four
scores).

| | Hunspell: words rejected | LanguageTool: matches | back-translated | median cos (right English) | median cos (wrong English) | right > wrong | median LaBSE (right) | median LaBSE (wrong) | flagged (both < 0.6) | flagged, read |
|---|---|---|---|---|---|---|---|---|---|---|
| es | 8 of 570 | 16 in 289 strings | 289 | 0.92 | 0.29 | 279 of 288 | 0.91 | 0.30 | 10 | 10 |
| fr | 3 of 623 | 7 in 289 strings | 289 | 0.90 | 0.28 | 281 of 288 | 0.91 | 0.31 | 6 | 6 |
| de | 20 of 596 | 16 in 287 strings | 287 | 0.89 | 0.29 | 273 of 283 | 0.90 | 0.31 | 14 | 14 |
| it | 25 of 604 | 20 in 289 strings | 289 | 0.94 | 0.29 | 280 of 288 | 0.92 | 0.30 | 7 | 7 |
| pt | 7 of 575 | 23 in 289 strings | 289 | 0.90 | 0.28 | 280 of 288 | 0.90 | 0.32 | 7 | 7 |
| pl | 6 of 660 | 54 in 291 strings | 291 | 0.89 | 0.28 | 279 of 290 | 0.89 | 0.32 | 11 | 11 |
| ru | 18 of 680 | 7 in 291 strings | 291 | 0.82 | 0.28 | 277 of 290 | 0.89 | 0.31 | 15 | 15 |
| ar | 4 of 625 | 46 in 295 strings | 295 | 0.81 | 0.28 | 283 of 294 | 0.84 | 0.28 | 24 | 24 |
| hi | 23 of 488 | no rules for the language | 287 | 0.93 | 0.30 | 278 of 286 | 0.88 | 0.30 | 11 | 11 |
| zh | no dictionary | 3 in 285 strings | 285 | 0.83 | 0.28 | 273 of 284 | 0.87 | 0.30 | 10 | 10 |
| ja | no dictionary | 0 in 285 strings | 285 | 0.83 | 0.28 | 273 of 283 | 0.86 | 0.29 | 26 | 26 |
| ko | 31 of 633 | no rules for the language | 285 | 0.86 | 0.28 | 275 of 283 | 0.86 | 0.28 | 19 | 19 |
| vi | 8 of 526 | no rules for the language | 287 | 0.85 | 0.28 | 278 of 286 | 0.87 | 0.31 | 15 | 15 |
| th | 20 of 407 | no rules for the language | 285 | 0.84 | 0.27 | 275 of 284 | 0.83 | 0.30 | 18 | 18 |
| id | 37 of 518 | no rules for the language | 285 | 0.87 | 0.28 | 274 of 284 | 0.90 | 0.31 | 12 | 12 |

**Every flagged string was read**, and so was every string whose back-translation alone scored
under 0.6 in Hindi, Thai, Arabic and Vietnamese (the languages least sure of), and under 0.55
in the rest. Each flagged string's verdict is in `docs/language/pages-rest-meaning.json`, with
the exact text it was made for; `node scripts/pages-rest/summarise.mjs
docs/language/results/pages-rest --strict` fails when a flagged string has no verdict, or a
string has changed (or been added) since it was scored. Most flags are short labels whose word
is right but not the English one (a bracket read back as a table, a grid or a tree; "Claim"
as receive, take, redeem; "Bye" as exempt, free draw) and the tournament terms taken from
Wikidata. The reader is the engineer on this branch, a language model (Claude), not a native
speaker.

Changed after reading (each scored again, before and after, in the record):

| | key | was | now | why |
|---|---|---|---|---|
| hi | `tour.entry.active` | मुक़ाबले में | अब भी मुक़ाबले में | "in the contest" lost the *still* of "Still in" (flagged) |
| hi | `classroom.create.done` | कक्षा बन गई है। | कक्षा बना दी गई है। | the intransitive read back as "the class is done"; now "has been made" |
| hi | `error.teachers_only` | कार्य केवल शिक्षक बना सकते हैं। | केवल शिक्षक ही कार्य बना सकते हैं। | read back as "work can only make a teacher"; *केवल … ही* now before the subject |
| de | `classroom.wizard.s3.title` | Aktivitäten aufgeben | Aktivitäten zuweisen | *aufgeben* sets work only with *Hausaufgaben*; with *Aktivitäten* it reads "give up" |
| ja | `classroom.wizard.s3.title` | 活動を出題する | 活動を割り当てる | 出題 is setting test questions, not activities |
| ko | `classroom.wizard.s3.title` | 활동 내기 | 활동 배정하기 | 내기 is also "a bet" (read back as "Activities Betting"); 과제 내기 and 과제 내주기 were tried and read back as "Challenge Betting" and "Submit a task" |

Read and left for a native reviewer to decide (the meaning is right; the choice of word is
the question): id *penawaran* (an offer) for a marketplace listing, where Indonesian
classifieds often say *iklan*; zh 挂单, the trading word (a standing order) for a listing; es
*Diario* and pt *Diário* for the daily bonus, which also read as "diary"; ar مسابقة for trivia
and for competitions (the playground on branch lang/pages-play uses the same word); th ควิซ,
a transliteration of "quiz" (the playground uses it too); ko 생존 ("survival") for "Still in".

A string shorter than a sentence is scored loosely by both models whatever its quality, and a
model can translate an awkward sentence back to the right English: a string that passes this
check is not shown to read naturally.

### Terminology: branch lang/qa-pipeline's glossary

That branch keeps one word per game and platform term per language
(`docs/language/glossary.json` there, with the source of each), and checks every string whose
English uses the term (`scripts/lang/lib/glossary.mjs`). It reads only the core locale. Its
rule and glossary (branch at `9d95d81`) were run, from a scratch copy, over this branch's areas:
70 hits. Read one by one:

- 37 "round" and 8 "verse" hits are other senses of the English word: *round robin*, a
  tournament's rounds (fr *tour*, ja *回戦*, zh *轮*, th *รอบ*, which are not a duel's rounds:
  fr *manche*, ja ラウンド), and "your command of verse" (poetry, not a verse of the duel).
- 4 "Shakespeare" hits in es, fr, it, pt are the adjective (*shakespeariano*, *shakespearien*).
- 21 are real, and are the four spellings below: hi शेक्सपियर (8 strings), th เข้าสู่ระบบ for
  "sign in" (8), ko 내려받다 for "download" (4), vi *khóa* for "passkey" (1). In each the area
  follows main's core locale, which that branch changes.

### Terms the core locale is changing (branch lang/qa-pipeline)

Branch lang/qa-pipeline moves four spellings of main's core locale to published sources:

| | word | main's core and these areas | that branch's core | its source |
|---|---|---|---|---|
| hi | Shakespeare | शेक्सपियर | शेक्सपीयर | Wikidata Q692's label |
| th | sign in | เข้าสู่ระบบ | ลงชื่อเข้าใช้ | Android (`kg_login_submit_button`), Google Help |
| ko | download | 내려받다 (main's core writes both 내려받다 and 다운로드, so the test asks nothing of the areas yet) | 다운로드 | Android (`install_carrier_app_notification_button`) |
| vi | tone marks in oa, oe, uy | *khóa*, *xóa*, *hủy* | *khoá*, *xoá*, *huỷ* | Android's placement, the LibreOffice vi_VN dictionary |

The brief for these pages is to use the core locale's words, and main's core still has the
first column, so the areas keep it. The test "spells a word as the core locale spells it"
(`src/i18n/pages-rest.test.ts`) holds the areas to whichever spelling the core uses: with that
branch's four core files laid over this branch on the build host, it failed and named the 31
area strings that must then follow (hi 8, th 8, ko 4, vi 11). When that branch lands, change
those 31 strings; the test says which. Hunspell's Vietnamese dictionary rejects *khóa*, *xóa*
and *hủy* for the same reason (it has the new placement).

### Layout: screenshots

`scripts/pages-rest/shots.mjs` against a dev server on the build host, in Arabic, German,
Japanese and Spanish, at 390 × 844 and 1280 × 900: every view of the six pages (the classroom
gate, teacher consent, tour steps 1 and 3, student consent, list and detail; the marketplace
and its sell form; the tournament list and bracket; the season, signed in and out; viewer;
VR gallery), the offline page, and the install guidance as Safari on an iPhone sees it. The
script also lists any element that reaches past the screen: none did. The pictures were
looked at. In the first run (15:13) two views timed out on the cold dev server (Arabic phone
classroom gate, Spanish desktop VR); the last run (finished 17:28, after every change on this page)
took all 136, and these were looked at again: the tour's step 3 in Arabic, German and Japanese
(the titles changed above), the Arabic tournament bracket and standings, season, classroom
detail and install guidance on a phone, the German tournament list, and the Spanish teacher
consent. Found and fixed in the first run:

- Arabic: the XP a kind of play earns read "XP 50+": a "+" typed into the message drifted to
  the far side of the digits. The sign now comes from `Intl` (CLDR puts U+200E before it in
  Arabic) and stays beside the number.
- Arabic: the tour's step counter was set in a monospace font, which has no Arabic; the
  fallback pulled the letters of *الخطوة* apart. Tabular figures instead.
- German: *K.-o.-System* broke at its own hyphen on a phone; non-breaking hyphens.

Seen and right: right-to-left order of headings, badges, chevrons (open points left, back
points right in Arabic), radio buttons and the "+" of "New assignment"; Latin user names inside
Arabic lines and the reverse (`<bdi>`); Japanese and Spanish dates and number grouping (Spanish
does not group four digits, as CLDR says). Not this branch's: in Japanese and Arabic the
header's sign-in button wraps its words on a phone (the shared layout; branch lang/pages-core
works on the navigation).

## Proof that the checks can fail

`node scripts/pages-rest/mutate.mjs --browser` breaks one thing at a time on the build host,
runs the test that should notice, expects it to go red with a message that names the damage,
and puts the file back. A mutation the tests miss, or catch for another reason, is counted
against the checks.

- **First run of the full set (15:48, before this continuation):** 8 of 45 not caught. Two were
  real blind spots: the unit test of `loadArea`'s English fallback asked `t()`, which also
  finds English the test itself had loaded (MISSED), and the browser test skipped every string
  that read the same as English in the locale file, so English left in the Spanish marketplace
  passed (MISSED). Six were red for the right reason, but the summary vitest prints shortens an
  array to "Array(1)" and escapes quotation marks, so the expected text was not found.
- **Fixed:** the `loadArea` test now looks in the Japanese messages themselves; the browser test
  reads the same `SAME_AS_ENGLISH` list as the unit test instead of trusting the locale file;
  the tests give their list of problems as the assertion's message. Added: the page's script
  writing English with no key (browser), and three spellings that differ from the core locale
  (unit).
- **Last run** (iMac Pro, finished 17:22, US Eastern time, west of Greenwich, so the date mutation
  ran): **49 of 49 caught**, 38 against the unit tests and 11 against the browser tests,
  "English left in the Spanish marketplace" and "loadArea stops filling in English" among
  them.

The meaning check was shown to fail twice on real data before its record was complete:
`summarise.mjs --strict` named 17 strings changed after the back-translation run had copied
them (German non-breaking hyphens in *K.‑o.‑System*, the XP gain written without its "+"), and
then one flagged string whose verdict had been made for its old text. Its control is described
under "Meaning".

## What could not be checked

- **No native speaker has read any of it.** Every sentence that has no source in the tables
  above was written by a language model and checked only by the tools named here.
- **Grammar** was checked by no tool in Hindi, Korean, Vietnamese, Thai and Indonesian
  (LanguageTool has no rules for them), and spelling by none in Chinese and Japanese (no
  Hunspell dictionary). In Italian and Polish LanguageTool ran but flagged none of four
  known-bad sentences, so its clean result there is not a check either; in Chinese and Japanese
  it saw one of four. Hunspell's Hindi, Korean, Thai and Indonesian lists are thin: in those
  languages a rejected word was more often the list's gap than a typo, and an accepted word
  says little.
- **The reading of flagged strings** was done by the engineer on this branch, a language model;
  the verdicts in `docs/language/pages-rest-meaning.json` are its judgement, not a native
  speaker's.
- **Terminology**: the 21 terms of `docs/language/pages-rest-terms.json` are held by a test to
  one word per language across every area string whose English uses them. Other words are not:
  a second word for a thing outside those 21 would pass. Branch lang/qa-pipeline's glossary was
  run against the areas once, from a scratch copy (that branch is not in main); no test here
  holds the areas to it except for the four spellings in "Terms the core locale is changing".
- **Register**: no tool judges whether the teacher-facing text is as formal as a school
  expects (see "Register" above), whether *docente*, *Lehrkraft*, *教員* is the word a given
  school uses, or whether the grade-level examples look right to a teacher in that country.
- **Back-translation** says whether the meaning survived a round trip through another model,
  not whether the sentence reads naturally; a model can translate an awkward sentence back to
  the right English.
- **Screenshots** were taken in four languages; the other twelve were checked only by the
  browser test's overflow measurement at phone width, which finds what sticks out of the
  screen, not text that is cut off inside a box or wraps badly.
- **Platform labels**: Apple's and Android's words were taken from their current guide and
  resources. The iPhone steps say what main's English says, which is behind Apple's current
  guide (see "Install guidance").
- **Not localised**: the service worker's last-resort plain-text answer "Offline" (served only
  when even `offline.html` is not cached); the Theatre page's own tab title "The Theatre"
  (`theatre.astro`, done on another branch) — the manifest's shortcut uses the page's heading
  instead.
