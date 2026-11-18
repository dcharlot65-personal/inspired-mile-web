# Provenance: what the language work takes from where

Everything below was fetched on 2026-11-16. A file under `sources/` is the data
as fetched (trimmed to the sixteen languages), with its own `source`, `licence`
and `fetched` fields; the script named beside it fetches it again.

## Data taken from a source

| What | From | Licence | Kept in | Fetched by |
|---|---|---|---|---|
| Plural categories and rules; quotation marks, for the sixteen languages | Unicode CLDR 49.0.0 (`unicode-org/cldr-json`, tag 49.0.0: `cldr-core/supplemental/plurals.json`, `cldr-misc-full/main/<lang>/delimiters.json`) | Unicode License v3 | `sources/cldr.json` | `scripts/lang/fetch-cldr.mjs` |
| Plural selection, number formatting, list formatting at run time | The browser's own CLDR, through `Intl.PluralRules`, `Intl.NumberFormat`, `Intl.ListFormat` (nothing bundled). The unit tests fail if the machine's Intl and the pinned CLDR disagree on a language's categories. | n/a | n/a | n/a |
| Names of verse forms and prosody terms in each language: the title of that language's Wikipedia article (the sitelink), whether Wikidata badges that sitelink as a link to a redirect (Q70893996, Q70894304; recorded since the re-fetch of 2026-11-18, whose only other change was the date), and Wikidata's label and aliases, for 25 concepts | Wikidata, `wbgetentities` by English Wikipedia title | CC0 1.0 | `sources/wikidata-terms.json` | `scripts/lang/fetch-wikidata.mjs` |
| The reverse lookup: whether a candidate term is an article title in that language's Wikipedia, and what the article is about | Wikidata, `wbgetentities` by site and title | CC0 1.0 | `sources/wikidata-titles.json` | `scripts/lang/fetch-wikidata-titles.mjs` |
| Platform terms as the platform vendor translates them (passkey, sign in, microphone, screen lock, home screen, download) | Android Open Source Project, `platform_frameworks_base` at commit `1cdfff555f4a21f71ccc978290e2e212e2f8b168` (GitHub mirror `aosp-mirror/platform_frameworks_base`): `packages/CredentialManager`, `core/res`, `packages/SystemUI`, `packages/SettingsLib` string resources | Apache License 2.0 | `sources/aosp-terms.json` | `scripts/lang/fetch-platform-terms.mjs` |
| Apple's wording for "passkey" and "sign in": the first sentence of support article 102195 in each language Apple publishes it in (no Hindi edition), and, for a term the glossary cites Apple for, the first sentence that uses it (Japanese サインイン; added 2026-11-16, when the glossary's claim was found not to be in the kept sentence) | `https://support.apple.com/<locale>/102195` | © Apple; one sentence quoted per language as evidence of a term | `sources/apple-passkeys.json` | `scripts/lang/fetch-apple-terms.mjs` |
| How each language writes the names the interface uses (Shakespeare, Q692; Mercutio, Q1767900): Wikidata labels, aliases and sitelinks, with the Simplified-Chinese and Brazilian variants | Wikidata, `wbgetentities` by item | CC0 1.0 | `sources/wikidata-names.json` | `scripts/lang/fetch-wikidata-names.mjs` |
| Names of verse forms where a language's Wikipedia has no article: English Wiktionary's translation tables, each kept with the sense it translates | `https://en.wiktionary.org/w/index.php?title=<page>&action=raw` (couplet, distich, quatrain, tercet, anaphora, epistrophe, acrostic, alliteration, heroic couplet, internal rhyme, jueju, lục bát, haiku) | CC BY-SA 4.0; one word per language quoted as evidence of a term | `sources/wiktionary-translations.json` | `scripts/lang/fetch-wiktionary.mjs` |
| "Sign out" as Mozilla ships it: Firefox's account menu (`fxa-menu-sign-out`) and its confirmation button (`fxa-signout-dialog2-button`) | `mozilla-l10n/firefox-l10n` at commit `bb61adaeeaefe5db067571d42d0eb7a1c2309b1a`, `<locale>/browser/browser/sync.ftl`; English from `mozilla-firefox/firefox` at commit `f612f4a72980aeb8d7a868d53534ad698b2ee602` (pinned 2026-11-16; it was read from `main`), `browser/locales/en-US/browser/sync.ftl` | Mozilla Public License 2.0 | `sources/mozilla-terms.json` | `scripts/lang/fetch-mozilla-terms.mjs` |
| Single words of the game (each relic's power words, the four criteria, the glossary's core terms): English Wiktionary's translation tables for the English word, each with its sense, following translation subpages, inflected forms (*tears* → *tear*) and `{{trans-top-see}}`; and, for a word whose English word's table has nothing for its language, the word's own entry with its English glosses | `https://en.wiktionary.org/w/index.php?title=<word>&action=raw` (62 English words; 88 own entries) | CC BY-SA 4.0; one word or one gloss quoted as evidence of a translation | `sources/wiktionary-words.json` | `scripts/lang/fetch-wiktionary-words.mjs` |
| Traditional to simplified Chinese, character by character, so that Wiktionary's Mandarin (written in traditional characters) can be compared with the game's simplified Chinese | OpenCC, `BYVoid/OpenCC` at commit `fae2a0a911c30764e669a7d8b0591cd8e852934a`, `data/dictionary/TSCharacters.txt` (4,148 characters; until 2026-11-17 the file's comment line was counted as a 4,149th) | Apache License 2.0 | `sources/opencc-ts.json` | `scripts/lang/fetch-opencc.mjs` |
| "Sign out" and "sign in" as Google writes them: the title and first heading of Gmail Help answers 8154 (sign out) and 8494 (sign in) in each language. The help centre answers some requests with an empty page, a different language each time; the script asks again (up to five times) before it records a gap, and the unit tests fail if the glossary quotes anything this file does not hold | `https://support.google.com/mail/answer/8154?hl=<lang>`, `…/8494?hl=<lang>` | © Google; a title and a heading quoted per language as evidence of a term | `sources/google-help.json` | `scripts/lang/fetch-google-help.mjs` |

What was decided from these (which name was adopted, and where a source was
not followed and why) is in `glossary.json`, per entry, and summarised in
`QA-REPORT.md`.

Known limits of these sources, met in this work:

- A Wikidata sitelink can point at an article about something else. Three were
  not followed: Arabic *couplet* (links مربع), Indonesian *couplet* (links
  *Bait*, the word for a stanza), and the Vietnamese and Indonesian *anaphora*
  links. A reverse lookup also showed the Portuguese *Epífora* is the medical
  term, and the Hindi त्रिपदी the algebraic one. Each is recorded in the glossary.
- The opposite also happens: an article of the right name sits on another item.
  The Arabic article تطريز (شعر), taken for the acrostic until 2026-11-17, is
  item Q40376349 and defines another figure; the Polish *Rym wewnętrzny* is on
  an item of its own (Q30912590) with no statements. And an alias can be wrong:
  Wikidata gives الجناس الاستهلالي as an alias of alliteration, which the item's
  own Arabic article says names the acrostic. Since 2026-11-17 a cite backs a
  form name only when it is about the form's own item, and a name that rests on
  an alias alone must say why the label was not used (`scripts/lang/lib/glossary.mjs`).
- A sitelink can lead to a redirect: it.wikipedia's *Rima interna* leads to the
  article *Rima*. Wikidata badges such links, and they are not cited as titles.
- Wikipedia has no article for many of these concepts in Hindi, Thai,
  Vietnamese and Korean. Where there is none, the name is marked "not sourced".
- "Sign out" is not in the Android strings fetched. It comes from Mozilla's
  Firefox strings and from Google's Gmail help instead; where those two differ
  from each other or from the game (Italian, Portuguese, Arabic, Japanese, Thai,
  Indonesian), `glossary.json` says which was kept and why. "Home screen" is
  Android's (`group_system_access_home_screen`); none of the core strings use it.
- English Wiktionary has no translation table for heroic couplet, epistrophe,
  internal rhyme, lục bát or jueju, and none for Thai or Hindi in most of the
  others. It filled four gaps (Indonesian *kuplet* and *anafora*, Chinese 藏头诗,
  Polish *czterowiersz*) and gave the word that replaced the Vietnamese
  quatrain's *tứ tuyệt* (*thơ bốn câu*).

## Tools

| Tool | Version | Licence | Where from | Checksum (SHA-256) |
|---|---|---|---|---|
| LanguageTool (standalone server) | 6.6 | LGPL 2.1 or later | `https://languagetool.org/download/LanguageTool-stable.zip` | `53600506b399bb5ffe1e4c8dec794fd378212f14aaf38ccef9b6f89314d11631` |
| Hunspell (built from source into the pipeline's own directory) | 1.7.2 | LGPL 2.1 / GPL 2 / MPL 1.1 | `https://github.com/hunspell/hunspell/releases/download/v1.7.2/hunspell-1.7.2.tar.gz` | `11ddfa39afe28c28539fe65fc4f1592d410c1e9b6dd7d8a91ca25d85e9ec65b8` |
| Hunspell dictionaries | LibreOffice `dictionaries` at commit `c0865a85eb67dc377f2cf8e8fe2c4fa9e53f0dcb` | per dictionary, below | `https://github.com/LibreOffice/dictionaries` | pinned by commit |
| OpenJDK (runs LanguageTool) | 27.0.1 (Homebrew formula already on the host) | GPL 2 with Classpath exception | Homebrew | n/a |
| llama.cpp `llama-server` | 1.0.0 build 12359 (commit b1b770d90; Homebrew formula already on the host) | MIT | Homebrew | n/a |
| CTranslate2 / sentencepiece / transformers / sentence-transformers / sacrebleu / torch | 4.9.0 / 0.2.3 / 5.23.0 / 6.3.0 / 2.6.0 / 2.15.0 | MIT / Apache 2.0 / Apache 2.0 / Apache 2.0 / Apache 2.0 / BSD-3 | PyPI, into a virtual environment of the pipeline's own | n/a |

Dictionaries used, with the licence each one's own README states (the READMEs
are kept beside the dictionaries on the build host):

| Language | Dictionary (path in the repository) | Licence as its README states |
|---|---|---|
| English | `en/en_US` | see `en/README_en_US.txt` (SCOWL-derived; the licence text is in that file and is not summarised here) |
| Spanish | `es/es_ES` | GPL 3+ / LGPL 3+ / MPL 1.1+ |
| French | `fr_FR/dictionaries/fr` | see `fr_FR/package-description.txt` (not summarised here) |
| German | `de/de_DE_frami` | GPL 2 or 3 |
| Italian | `it_IT/it_IT` | GPL 3 |
| Portuguese (Brazil) | `pt_BR/pt_BR` | LGPL 3 / MPL |
| Polish | `pl_PL/pl_PL` | GPL 2 / LGPL 2.1 / MPL 1.1 / Apache 2.0 / CC BY 4.0 |
| Russian | `ru_RU/ru_RU` | see `ru_RU/README_ru_RU.txt` (© A. I. Lebedev; BSD-style terms in that file) |
| Arabic | `ar/ar` | see `ar/README_ar.txt` and `ar/COPYING.txt` (not summarised here) |
| Hindi | `hi_IN/hi_IN` | GPL |
| Korean | `ko_KR/ko_KR` | GPL 3 |
| Vietnamese | `vi/vi_VN` | GPL 2 |
| Thai | `th_TH/th_TH` | LGPL |
| Indonesian | `id/id_ID` | LGPL |
| Chinese, Japanese | none | Hunspell has no dictionary for languages written without spaces between words |

The dictionaries are used as tools on the build host. None is shipped with the
game or copied into this repository.

## Models

| Model | Used for | Licence | Exact file | Revision / checksum |
|---|---|---|---|---|
| MADLAD-400 3B MT (Google) | Back-translation of every string to English | Apache 2.0 | CTranslate2 int8 conversion `Nextcloud-AI/madlad400-3b-mt-ct2-int8` of `google/madlad400-3b-mt` | Hugging Face revision `aa32bbdeba7880eff2096ec044cb155a340a9400` |
| all-MiniLM-L6-v2 (sentence-transformers) | Similarity between a back-translation and the English source (both English) | Apache 2.0 | `sentence-transformers/all-MiniLM-L6-v2` | revision `1110a243fdf4706b3f48f1d95db1a4f5529b4d41` |
| LaBSE (Google; sentence-transformers conversion) | Similarity of each translation to its English directly, the second signal of step 3 | Apache 2.0 | `sentence-transformers/LaBSE` | revision `836121a0533e5664b21c7aacc5d22951f2b8b25b` |
| Gemma 4 26B-A4B instruct (Google), Google's own 4-bit quantisation-aware (QAT) GGUF | The second opinion (step 4) | Apache 2.0 (`cardData.license` of the repository; not gated) | `google/gemma-4-26B-A4B-it-qat-q4_0-gguf`, `gemma-4-26B_q4_0-it.gguf` (14.4 GB) | revision `d1c082be9cf3c8a514acf63b8761f4b41935842e`; SHA-256 `3eca3b8f6d7baf218a7dd6bba5fb59a56ee25fe2d567b6f5f589b4f697eca51d` (checked after download) |
| Gemma 4 31B instruct (Google), 4-bit GGUF | Tried first for step 4 and stopped: 4 tokens/s on the shared GPU. Its partial results (Thai and Hindi, 36 strings each) are kept on the host as `review-31b-partial.json` and not used | Apache 2.0 | `unsloth/gemma-4-31B-it-GGUF`, `gemma-4-31B-it-Q4_K_M.gguf` (18.3 GB) | revision `c1ac76e99d5513b141e8adde7288b85c3f9c32ec`; SHA-256 `38bd64c852c4b460434cc7162fa9bdcf242faf86502581a754cb72956bb17f84` |

Licences checked against the Hugging Face API on 2026-11-16 (`cardData.license`:
`apache-2.0` for all three, and for `google/gemma-4-31B-it` itself).

Why these. For back-translation the two open dedicated translation models that
cover all sixteen languages are NLLB-200 (Meta, 2022) and MADLAD-400 (Google,
2023). NLLB-200's weights are CC BY-NC 4.0, which rules them out for a product;
MADLAD-400 is Apache 2.0. Newer dedicated translation models exist and were
looked at on 2026-11-16 and not used: TranslateGemma (Google, 2026-01-12) is
under the Gemma terms, gated behind a manual approval, and built on Gemma, the
same family as the second-opinion model, so the two checks would not be
independent; Seed-X (ByteDance, 2025-07) is under the OpenMDW licence;
Hunyuan-MT-7B (Tencent, 2025-08) has its own licence, which was not reviewed.
MADLAD-400 is older and weaker than these, which matters less here: it only
raises a flag that a person then reads. The 3B size was chosen
because it runs on CPU beside the host's other work. For the second opinion the
model had to be a different one from the model that wrote the translations
(Claude), strong in all sixteen languages, open, and runnable locally: Gemma 4,
in the 26B-A4B form (a mixture of experts; Google's own QAT 4-bit file), because
the dense 31B was too slow beside the host's other work.

All of them run on the build host only, with no network at run time
(`HF_HUB_OFFLINE=1`). No text of the game was sent to any service.

## What was generated, not sourced

The translations themselves were written by a language model (the earlier
engineer on this work), and so were the corrections made here that no tool
dictated: the plural forms of each noun, the rephrasings that removed the
gender hedges, and the wording unified by the glossary. They have been checked
by the tools listed above to the extent each tool covers the language
(`QA-REPORT.md` says how far that is, per language). They have not been read by
a native speaker.

Eighteen strings were changed to a correction the second model (Gemma 4 26B-A4B)
proposed, each one only after it survived LanguageTool, Hunspell and the meaning
check and was then read against the English (`results/adoption-reading.json`).
Those are a generative model's text too, checked the same way. The changes made in
the second pass that no model proposed (`git log` on this branch, 2026-11-16 from
6a8dd01) were written by the engineer doing this work, also a language model, and
put through the same tools; where one rests on a published source (Android's
'%1$s 个通行密钥', Google's help headings) the glossary cites it and the unit tests
check the quotation is in the fetched file.
