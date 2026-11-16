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
| The names of things in the table below (teacher, class, tournament formats, bye, bracket, virtual and augmented reality, Gaussian splatting) | Wikidata labels and the titles of the Wikipedia articles they link to: `docs/language/sources/pages-rest-wikidata-terms-a.json`, `…-b.json` (the API answers as fetched) | CC0 (Wikidata); article titles are facts | 2026-11-16 |
| The words for home, collection, battle arena and the tagline on the offline page and in the manifest | the game's own core locale (`src/i18n/locales`), copied, and held equal by a test | (ours) | 2026-11-16 |
| The manifest's `name_localized` / `description_localized` members, and `name_localized` inside each shortcut (there is no `shortcuts_localized`) | MDN "`*_localized`" (developer.mozilla.org/…/Manifest/Reference/*_localized); Chrome for Developers "Localization support for web app manifests" (Chrome and Edge 148) | n/a | read 2026-11-16 |
| "MB" and "GB" in each language (fr *Mo*, *Go*; ru *МБ*, *ГБ*; ar *م.ب*, *غ.ب*), and the space before them (fr: U+202F) | Unicode CLDR unit patterns, through `Intl.NumberFormat` with `style: 'unit'` (`src/lib/pwa.ts`) | Unicode License v3 | at run time |
| The iPhone controls the install guidance names: the Share button and "Add to Home Screen" | Apple, iPhone User Guide, "Bookmark a website", section "Add a website icon to your Home Screen", in each of the sixteen languages: `docs/language/sources/pages-rest-apple-home-screen.json` (`scripts/pages-rest/fetch-apple-home-screen.mjs`; the steps as Apple prints them, and the alt text of the Share button's icon) | Apple Inc. text, quoted as evidence of the term | 2026-11-16 |
| The buttons Install and Not now | Android Open Source Project string resources at commit `1cdfff5`: PackageInstaller `install`, framework `autofill_save_notnow`: `docs/language/sources/pages-rest-android-terms.json` (`scripts/pages-rest/fetch-android-terms.mjs`; the same commit as branch lang/qa-pipeline's record) | Apache-2.0 | 2026-11-16 |
| battle rap (Q12302979) and card game (Q142714), for the manifest's description | Wikidata labels and article titles: `docs/language/sources/pages-rest-wikidata-terms-c.json` (`scripts/pages-rest/fetch-wikidata-terms.mjs`) | CC0 | 2026-11-16 |
| The manifest's shortcut names: Battle Arena, The Theatre | the core locale's `nav.battle`, and the Theatre's heading `theatre.titleA` + `theatre.titleB`, copied and held equal by a test | (ours) | 2026-11-16 |

## Terms, and where each comes from

`=` means the string uses the Wikidata label (or the linked Wikipedia title) as it is, apart
from case and inflection. Where it does not, the reason is given. "none" means Wikidata has
no label in that language, so the word is the model's and has no source.

### School

| | teacher (Q37226) | student at school (Q48282, Q48942) | class (Q18204) | assignment (cf. homework, Q753877) |
|---|---|---|---|---|
| es | **docente**. Wikidata: *profesor*, article *Enseñante*. Chosen because it has one form for a man and a woman; it is the word Spanish-language education ministries use for school staff. Not from the source. | estudiante = | clase = | tarea. Wikidata has only *trabajo escolar* for homework. |
| fr | enseignant ou enseignante = | élève = | classe = | devoir (= *devoir à la maison*, shortened: an assignment here need not be done at home) |
| de | **Lehrkraft**. Wikidata: *Lehrer*. Chosen because it is not gendered; it is the term of German school law and ministries. Not from the source. | Schülerin oder Schüler (= *Schüler*, both forms written) | Klasse (= *Schulklasse*) | Aufgabe (cf. *Hausaufgabe*) |
| it | insegnante = | studente (= label of Q48282; Q48942 is *alunno*) | classe = | compito (= *compiti a casa*) |
| pt | professor ou professora (= *professor*) | estudante = | **turma**: none in Wikidata. The Brazilian word for a class as a group. | tarefa (Wikidata: *lição de casa*) |
| pl | nauczyciel lub nauczycielka (= *nauczyciel*) | uczeń lub uczennica (= *uczeń*) | klasa = | zadanie (cf. *praca domowa*) |
| ru | учитель = | ученик или ученица (= *ученик*) | класс = | задание (= *домашнее задание*, shortened) |
| ar | **معلّم**. Wikidata: *مدرس*. Both are standard; معلّم is the word for a school teacher in ministry usage. Not from the source. | طالب (= label of Q48282; Q48942 is *تلميذ*) | **صف**. Wikidata: *فصل دراسي*. Both are used; صف is the shorter of the two. Not from the source. | واجب (= *واجب منزلي*, shortened) |
| hi | शिक्षक = | विद्यार्थी = | कक्षा: none in Wikidata. | **कार्य**: the model's choice; Wikidata has only *गृहकार्य* (homework). Least sure of the four. |
| zh | 教师 = | 学生 = | 班级 = (*班級*) | 作业 = |
| ja | 教員 = | 生徒 = | クラス (Wikidata: *学級*; its label reads 教育におけるクラス) | 課題 (Wikidata: *宿題* is homework) |
| ko | 교사 = | 학생 = | 학급 = | 과제 (Wikidata: *숙제* is homework) |
| vi | giáo viên = | học sinh = | lớp học: none in Wikidata. | bài tập (= *Bài tập về nhà*, shortened) |
| th | ครู = | นักเรียน = | ชั้นเรียน: none in Wikidata. | งานที่มอบหมาย, งาน: the model's; Wikidata has only *การบ้าน* (homework). |
| id | guru = | siswa (= label of Q48942) | kelas = | tugas (Wikidata: *Pekerjaan rumah* is homework) |

**Grade level** appears in one place only, the example of a classroom name in the teacher's
tour. English has "Period 3 English"; each language has an example in its own school's way
of naming a class (es "Literatura 3.º B", fr "Français 4e B", de "Englisch 9b", it "Inglese
3ª B", pt "Literatura 9º ano B", pl "Język angielski, klasa 2b", ru "Литература, 9 „Б“", ar
"الصف التاسع (ب) – اللغة الإنجليزية", hi "कक्षा 9 (ब) – अंग्रेज़ी", zh "九年级（2）班 英语", ja
"3年B組 英語", ko "3학년 2반 영어", vi "Lớp 9A – Ngữ văn", th "ม.3/2 ภาษาอังกฤษ", id "Kelas 9B –
Bahasa Inggris"). **These were written by the model from general knowledge of each school
system and have no recorded source.** They are examples, not instructions, but a teacher
will see at once if one is off.

### Tournaments

| | single elimination (Q864897) | round robin (Q841144) | bracket (Q4953688) | bye (Q1268659) |
|---|---|---|---|---|
| es | Eliminación directa = | Todos contra todos (= *sistema de todos contra todos*) | cuadro: none | Exento (article: *Exención*) |
| fr | Élimination directe (= *tournoi à élimination directe*) | Toutes rondes (= *tournoi toutes rondes*) | tableau = | Exempt (Wikidata: *bye*) |
| de | K.-o.-System = (article title) | Jeder gegen jeden = (article *Jeder-gegen-jeden-Turnier*) | Turnierbaum = | Freilos = |
| it | Eliminazione diretta = | Girone all’italiana = (article title) | tabellone: none | Bye = |
| pt | Eliminação simples: none | Todos contra todos (= *Competições de todos contra todos*) | chave: none | Folga: none |
| pl | System pucharowy = | System kołowy (każdy z każdym): the label, and the everyday name beside it | drabinka: none | Wolny los: none |
| ru | На выбывание (= *турнир на выбывание*) | Круговая система = (article title) | сетка = | Без соперника: none |
| ar | خروج المغلوب = | نظام الدوري (دورة روبن): the everyday name, and the label beside it | جدول البطولة = | تأهّل دون لعب: a description. Wikidata's label (*لقاء*) means "meeting" and its article title (*استبقاء*) is not a word a player would know. |
| hi | एकल उन्मूलन (= *एकल उन्मूलन टूर्नामेंट*) | राउंड-रॉबिन = | ब्रैकेट: none | बाई: none |
| zh | 单败淘汰制 = | 循环赛 = | 对阵表 = | 轮空 = |
| ja | ノックアウト方式 (= *ノックアウト方式のトーナメント*) | **総当たり戦**. Wikidata: *リーグ戦*, which the Japanese article itself glosses as 総当たり戦; the plainer word was kept. | トーナメント表: none | 不戦勝: none |
| ko | 싱글 엘리미네이션 = | 리그전 = | 대진표: none | 부전승 = |
| vi | Loại trực tiếp (= *giải đấu loại trực tiếp*) | Vòng tròn (= *Thi đấu vòng tròn*) | sơ đồ thi đấu: none | Miễn đấu: none |
| th | แพ้คัดออก (= *การแข่งขันแบบแพ้คัดออก*) | พบกันหมด (= *การแข่งขันแบบพบกันหมด*) | สายการแข่งขัน: none | บาย: none |
| id | Sistem gugur = | Sistem kompetisi = | bagan pertandingan: none | Bye = |

Seven strings were changed after this comparison, because the first wording disagreed with
the source: it `Bye` (was *Riposo*), ja `ノックアウト方式` (was *勝ち抜き戦*, which the Japanese
Wikipedia uses for a different format), zh `单败淘汰制` and `对阵表`, ko `리그전`, hi `एकल उन्मूलन`,
id `Sistem kompetisi`, ar `جدول البطولة`; and es and fr "multiple choice" now follow their
labels (*opción múltiple*, *à choix multiples*).

### Technology

Virtual reality (Q170519) and augmented reality (Q254183) use the Wikidata label in every
language except Hindi, where the pages say वर्चुअल रियलिटी and ऑगमेंटेड रियलिटी as the game's core
locale already does (Wikidata: *आभासी यथार्थ*, *संवर्धित वास्तविकता*). One word for a thing
across the game was put first; the owner may prefer the Hindi-rooted terms throughout.

"Gaussian splat" is kept in Latin letters or transliterated (ja ガウシアン・スプラッティング =
Wikidata; zh 高斯泼溅, ru гауссов сплат, ko 가우시안 스플랫, hi गॉसियन स्प्लैट: the model's). Wikidata
(Q123134457) has labels in only five of the sixteen languages. "GLB", "WebXR", "Quest 3",
"Vision Pro", "Babylon.js" and "model-viewer" are names and are not translated.

**Credits** (the game's currency) had no word in the core locale. The model chose: es
créditos, fr crédits, de Credits, it crediti, pt créditos, pl kredyty, ru кредиты, ar نقاط
("points": a countable word with clean forms for one, two and many), hi क्रेडिट, zh 点数,
ja クレジット, ko 크레딧, vi xu ("coins", the usual word for a game's currency), th เครดิต,
id kredit. No source. If the collection or profile pages name the currency differently on
another branch, one of the two must give way.

### Install guidance and storage note (area `pwa`)

The English is main's (`src/lib/pwa.ts`, branch feat/pwa); it was moved into the area
unchanged. The two iPhone steps name Apple's controls with Apple's own words in each
language, and the two buttons use Android's:

| | Share button (Apple) | "Add to Home Screen" (Apple) | Install (AOSP) | Not now (AOSP) |
|---|---|---|---|---|
| es | el botón Compartir | Añadir a pantalla de inicio | Instalar | Ahora no |
| fr | le bouton Partager | Sur l’écran d’accueil | Installer | Pas maintenant |
| de | die Taste „Teilen“ | Zu Home-Bildschirm hinzufügen | Installieren | Nicht jetzt |
| it | il pulsante Condividi | Aggiungi alla schermata Home | Installa | Non ora |
| pt | botão Compartilhar | Adicionar à Tela de Início | Instalar | Agora não |
| pl | przycisk udostępniania | Do ekranu głównego | Zainstaluj | Nie teraz |
| ru | кнопка «Поделиться» | На экран „Домой“ (Apple: «На экран "Домой"»; the inner quotation marks are written „…“, as Russian nests them) | Установить | Не сейчас |
| ar | زر مشاركة | إضافة إلى الشاشة الرئيسية | تثبيت | ليس الآن |
| hi | “शेयर करें” बटन | होम स्क्रीन पर जोड़ें | इंस्टॉल करें | अभी नहीं |
| zh | “共享”按钮 | 添加到主屏幕 | 安装 | 以后再说 |
| ja | 共有ボタン | ホーム画面に追加 | インストール | 後で |
| ko | 공유 버튼 | 홈 화면에 추가 | 설치 | 나중에 |
| vi | nút Chia sẻ | Thêm vào Màn hình chính | Cài đặt | Để sau |
| th | ปุ่มแชร์ | เพิ่มไปยังหน้าจอโฮม | ติดตั้ง | ไว้ทีหลัง |
| id | tombol Bagikan | Tambah ke Layar Utama | Instal | Lain kali |

Apple's Spanish page says "toca Share" in its step text (untranslated, Apple's slip); the
alt text of the same page's icon, *el botón Compartir*, was used. **The English steps are
behind Apple's own guide**: for iOS 26 and 27 Apple writes "Tap the Page Menu button, then tap
Share" (the Share button is on the toolbar only in the Bottom and Top tab layouts), then
"Add to Home Screen", then "Add". The steps were translated as they stand; changing what
they say is the owner's call.

The rest of the area (why to install, what is kept and what may be cleared) was written by
the model in each language with the core locale's words for download, device, browser,
model and sign-in (`brain.kept`, `brain.canRun`, `auth.signIn`).

### The manifest

Main renamed the app on 2026-11-16 ("Sonnet Man: the duel of verses") and wrote a new
description. The name keeps "Sonnet Man" in Latin letters in every language (a product name,
like Inspired Mile), and the rest uses the core locale's words for duel and verse (es *duelo*,
*estrofas*; de *Duell*, *Strophen*; ja *決闘*, *詩*; …). In the description, "rap battle" is the
Wikidata label of Q12302979 where it has one (fr *battle*, de *Battle-Rap*, pl *battle rap*,
ru *рэп-баттл*, ar *باتل راب*, ja *MCバトル*, ko *배틀 랩*, vi *rap chiến*, id *adu rap*, es and pt
*batalla/batalha de rap*); it has none in it, hi, th, and only Traditional Chinese (*饒舌戰*,
article *對戰饒舌*) in zh: there the words are the model's (it *battaglie rap*, hi *रैप-बैटल*, th
*แร็ปแบตเทิล*, zh *说唱对战*). "Card game" keeps the core locale's word for a card (es *cartas*, not
Wikidata's *naipes*, which are playing cards; th *การ์ด*, not *ไพ่*; hi *कार्ड*, not *ताश*).

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
languages, no empty value, the same `{placeholders}`, each plural form Unicode CLDR gives the
language (through `Intl.PluralRules`), nothing left reading the same as English unless listed
(the list, `SAME_AS_ENGLISH`, is in `tests/pages-rest.fixtures.mjs`, and the browser test reads
it too), text in Unicode NFC with no hidden or directional character, and each language's own
punctuation (French no-break spaces, Spanish ¿ ¡, full-width marks in Chinese and Japanese,
Arabic ، ؛ ؟, the Hindi danda, no full stop in Thai, a no-break space before a German
ellipsis); a word with two spellings in a language is spelt as the core locale spells it (see
"Terms the core locale is changing"); the pages and `src/lib/pwa.ts` ask only for keys that
exist; the offline page and the manifest match the shared area; `loadArea` puts English into a
language's messages for a key that language lacks. `src/lib/api-errors.test.ts`, 12 tests: it reads
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
| es | 570 | 8 | imperative with a clitic (*Escríbelo*, *Publícalo*), *Reintentar* (Android's own word for Retry), *Prémium* (the RAE/Fundéu form), *shakespearianas* (in the DLE), the ordinal *3.º B* | none |
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
| ko | download | 내려받다 and 다운로드 | 다운로드 | Android (`install_carrier_app_notification_button`) |
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
- **Terminology** was checked against branch lang/qa-pipeline's glossary once, from a scratch
  copy (that branch is not in main); no test here holds the areas to it except for the four
  spellings in "Terms the core locale is changing".
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
