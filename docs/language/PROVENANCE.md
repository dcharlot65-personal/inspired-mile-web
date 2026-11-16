# Provenance: what the language work takes from where

Everything below was fetched on 2026-11-16. A file under `sources/` is the data
as fetched (trimmed to the sixteen languages), with its own `source`, `licence`
and `fetched` fields; the script named beside it fetches it again.

## Data taken from a source

| What | From | Licence | Kept in | Fetched by |
|---|---|---|---|---|
| Plural categories and rules; quotation marks, for the sixteen languages | Unicode CLDR 49.0.0 (`unicode-org/cldr-json`, tag 49.0.0: `cldr-core/supplemental/plurals.json`, `cldr-misc-full/main/<lang>/delimiters.json`) | Unicode License v3 | `sources/cldr.json` | `scripts/lang/fetch-cldr.mjs` |
| Plural selection, number formatting, list formatting at run time | The browser's own CLDR, through `Intl.PluralRules`, `Intl.NumberFormat`, `Intl.ListFormat` (nothing bundled). The unit tests fail if the machine's Intl and the pinned CLDR disagree on a language's categories. | n/a | n/a | n/a |
| Names of verse forms and prosody terms in each language: the title of that language's Wikipedia article (the sitelink), and Wikidata's label and aliases, for 25 concepts | Wikidata, `wbgetentities` by English Wikipedia title | CC0 1.0 | `sources/wikidata-terms.json` | `scripts/lang/fetch-wikidata.mjs` |
| The reverse lookup: whether a candidate term is an article title in that language's Wikipedia, and what the article is about | Wikidata, `wbgetentities` by site and title | CC0 1.0 | `sources/wikidata-titles.json` | `scripts/lang/fetch-wikidata-titles.mjs` |
| Platform terms as the platform vendor translates them (passkey, sign in, microphone, screen lock, home screen, download) | Android Open Source Project, `platform_frameworks_base` at commit `1cdfff555f4a21f71ccc978290e2e212e2f8b168` (GitHub mirror `aosp-mirror/platform_frameworks_base`): `packages/CredentialManager`, `core/res`, `packages/SystemUI`, `packages/SettingsLib` string resources | Apache License 2.0 | `sources/aosp-terms.json` | `scripts/lang/fetch-platform-terms.mjs` |
| Apple's wording for "passkey" and "sign in": the first sentence of support article 102195 in each language Apple publishes it in (no Hindi edition) | `https://support.apple.com/<locale>/102195` | © Apple; one sentence quoted per language as evidence of a term | `sources/apple-passkeys.json` | `scripts/lang/fetch-apple-terms.mjs` |

What was decided from these (which name was adopted, and where a source was
not followed and why) is in `glossary.json`, per entry, and summarised in
`QA-REPORT.md`.

Known limits of these sources, met in this work:

- A Wikidata sitelink can point at an article about something else. Three were
  not followed: Arabic *couplet* (links مربع), Indonesian *couplet* (links
  *Bait*, the word for a stanza), and the Vietnamese and Indonesian *anaphora*
  links. A reverse lookup also showed the Portuguese *Epífora* is the medical
  term, and the Hindi त्रिपदी the algebraic one. Each is recorded in the glossary.
- Wikipedia has no article for many of these concepts in Hindi, Thai,
  Vietnamese and Korean. Where there is none, the name is marked "not sourced".
- "Sign out" and "home page" were not found in the Android strings fetched;
  they are not vendor-sourced.

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
| Gemma 4 31B instruct (Google), 4-bit GGUF | The second opinion (step 4) | Apache 2.0 (as tagged on `google/gemma-4-31B-it` and on the conversion) | `unsloth/gemma-4-31B-it-GGUF`, `gemma-4-31B-it-Q4_K_M.gguf` (18.3 GB) | revision `c1ac76e99d5513b141e8adde7288b85c3f9c32ec`; SHA-256 `38bd64c852c4b460434cc7162fa9bdcf242faf86502581a754cb72956bb17f84` (verified after download) |

Why these. For back-translation the two open dedicated translation models that
cover all sixteen languages are NLLB-200 (Meta, 2022) and MADLAD-400 (Google,
2023). NLLB-200's weights are CC BY-NC 4.0, which rules them out for a product;
MADLAD-400 is Apache 2.0 and the newer of the two. The 3B size was chosen
because it runs on CPU beside the host's other work. For the second opinion the
model had to be a different one from the model that wrote the translations
(Claude), strong in all sixteen languages, open, and runnable locally:
Gemma 4 31B, the largest Gemma 4 model listed on Hugging Face on 2026-11-16.

All three run on the build host only, with no network at run time
(`HF_HUB_OFFLINE=1`). No text of the game was sent to any service.

## What was generated, not sourced

The translations themselves were written by a language model (the earlier
engineer on this work), and so were the corrections made here that no tool
dictated: the plural forms of each noun, the rephrasings that removed the
gender hedges, and the wording unified by the glossary. They have been checked
by the tools listed above to the extent each tool covers the language
(`QA-REPORT.md` says how far that is, per language). They have not been read by
a native speaker.
