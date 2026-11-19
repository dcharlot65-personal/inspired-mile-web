# Model licences

The game runs its language models in the visitor's browser (`src/lib/brain.ts`); the weights are
downloaded from the Hugging Face hub, not shipped from this site.

## Liquid AI's LFM models (LFM3 1.7B, LFM2.5 350M)

Used under the **LFM Open License v1.0**. It covers commercial use only while the licensee and
every entity under common control with it earn under **US$10 million a year** in revenue.

- The owner confirmed on **2026-11-17** that Voyage Tracable, LLC (DBA Inspired Mile) is under
  that threshold.
- **Re-check this if revenue grows.** Past the threshold, commercial use needs a licence from
  Liquid AI, or the LFM models must leave `MODELS` in `src/lib/brain.ts` (the game still plays
  with Gemma 4 E2B where a device runs it, and with the written opponent and rule judge
  everywhere else).

The note above covers the LFM models only; it says nothing about the terms of any other model.

## The voice (Kokoro) and what reads English for it

Checked 2026-11-19 (Hugging Face API `cardData.license`, the npm packages' own licence files and
`package-lock.json`). What the visitor's browser runs or downloads when the voice is turned on:

| Part | What it is | Licence | Where it comes from |
|---|---|---|---|
| Kokoro-82M v1.0 weights and voices | the speech model, voice `bm_george` | Apache-2.0 (`hexgrad/Kokoro-82M`, and its ONNX conversion `onnx-community/Kokoro-82M-v1.0-ONNX`, revision `1939ad2a8e41`) | the Hugging Face hub, on first use |
| kokoro-js 1.2.1 | the JavaScript that runs the model | Apache-2.0 | this site's bundle |
| Transformers.js 3.8.1 and onnxruntime-web 1.22.0-dev (kokoro-js's own copies) | the runtime | Apache-2.0; MIT | this site (`/ort/…`, scripts/self-hosted-runtime.mjs) |
| `src/lib/voice/lexicon-en.ts` | whole pronunciations from the CMU Pronouncing Dictionary (commit `74790861f652`), marks from SCOWL 2020.12.07 | CMUdict: BSD 2-clause style; SCOWL: permissive; both notices travel inside the data | this site, its own chunk, only with the voice |
| `src/lib/voice/nrl-rules.ts` | the letter-to-sound rules of NRL Report 7948 (1976) | a work of the US government (17 U.S.C. 105); read from John A. Wasser's 1985 transcription, which he placed in the public domain | this site |
| `src/lib/voice/g2p-en.ts`, `lts-en.ts` | the game's own code | the game's | this site |

Its symbols follow the conventions of misaki (Kokoro's own G2P, Apache-2.0, `EN_PHONES.md`); no
code or data of misaki is copied. Misaki's English dictionaries were not used, because nothing in
its repository says what they were made from.

**Gone (2026-11-19):** the npm package `phonemizer` 1.2.1 (labelled Apache-2.0, but an Emscripten
build of **eSpeak NG, GPL-3.0-or-later**), which kokoro-js imports to read text. The site build
swaps it for a stand-in (`astro.config.mjs`, `src/lib/voice/no-espeak.ts`) and `npm run build`
fails if any of it reaches `dist/` (`scripts/check-no-espeak.mjs`). The package is still
installed in `node_modules` as kokoro-js's dependency; only the build host's measurement script
(`scripts/voice/measure.mjs`) runs it, to compare against, and nothing of it ships. espeak-ng
itself remains a build-host tool whose output is test data for the other languages' sound tables
(`docs/language/PHONETICS.md`), as before.
