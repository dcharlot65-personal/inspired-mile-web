# Model licences

The game runs its language models in the visitor's browser (`src/lib/brain.ts`); the weights are
downloaded from the Hugging Face hub, not shipped from this site. The LFM section below was this note's
whole content until 2026-11-19; the other models' terms follow it.

## Liquid AI's LFM models (LFM3 1.7B, LFM2.5 350M)

Used under the **LFM Open License v1.0**. It covers commercial use only while the licensee and
every entity under common control with it earn under **US$10 million a year** in revenue.

- The owner confirmed on **2026-11-17** that Voyage Tracable, LLC (DBA Inspired Mile) is under
  that threshold.
- **Re-check this if revenue grows.** Past the threshold, commercial use needs a licence from
  Liquid AI, or the LFM models must leave `MODELS` in `src/lib/brain.ts` (the game still plays
  with Gemma 4 E2B where a device runs it, and with the written opponent and rule judge
  everywhere else).

That section covers the LFM models only; the other models' terms are in the sections below.

## The voice (Kokoro) and what reads English for it

Checked 2026-11-19, the emoji names 2026-11-20 (Hugging Face API `cardData.license`, the npm
packages' own licence files and `package-lock.json`). What the visitor's browser runs or downloads when the voice is turned on:

| Part | What it is | Licence | Where it comes from |
|---|---|---|---|
| Kokoro-82M v1.0 weights and voices | the speech model, voice `bm_george` | Apache-2.0 (`hexgrad/Kokoro-82M`, and its ONNX conversion `onnx-community/Kokoro-82M-v1.0-ONNX`, revision `1939ad2a8e41`) | the Hugging Face hub, on first use |
| kokoro-js 1.2.1 | the JavaScript that runs the model | Apache-2.0 | this site's bundle |
| Transformers.js 3.8.1 and onnxruntime-web 1.22.0-dev (kokoro-js's own copies) | the runtime | Apache-2.0; MIT | this site (`/ort/…`, scripts/self-hosted-runtime.mjs) |
| `src/lib/voice/lexicon-en.ts` | whole pronunciations from the CMU Pronouncing Dictionary (commit `74790861f652`), marks from SCOWL 2020.12.07 | CMUdict: BSD 2-clause style; SCOWL: permissive; both notices travel inside the data | this site, its own chunk, only with the voice |
| `src/lib/voice/nrl-rules.ts` | the letter-to-sound rules of NRL Report 7948 (1976) | a work of the US government (17 U.S.C. 105); read from John A. Wasser's 1985 transcription, which he placed in the public domain | this site |
| `src/lib/voice/emoji-en.ts` (added 2026-11-20) | what the voice says for an emoji: Unicode CLDR 49's English short names for text to speech (npm `cldr-annotations-full` and `cldr-annotations-derived-full` 49.0.0, pinned by sha256 in `scripts/build-voice-emoji.mjs`) | Unicode License v3 (the packages' LICENSE: only the text of the standard UTS #35 is under Unicode's terms of use, and these packages hold none of it); the notice travels inside the data | this site, in the voice's code chunk, only with the voice |
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

## The other models (read 2026-11-19)

The licence of each, as its own publisher states it. Every one is on the credits page (`/credits`).

| Model | Repository the game loads | Licence | Read where |
|---|---|---|---|
| Gemma 4 E2B (Google) | `onnx-community/gemma-4-E2B-it-ONNX` | **Apache 2.0**. Google's "Gemma 4 license" page is the Apache License 2.0, and its Gemma Terms of Use say: "The terms below apply to Gemma models listed in the Appendix at bottom of this page. For Gemma 4 terms, see the Gemma 4 license." | ai.google.dev/gemma/docs/gemma_4_license and ai.google.dev/gemma/terms; Hugging Face `cardData.license` `apache-2.0` with that link |
| Whisper base (OpenAI) | `onnx-community/whisper-base` | Apache 2.0 by both model cards (`openai/whisper-base` and the conversion). The as-built fact base's "MIT" is the licence of OpenAI's code, not what the weights' card declares | Hugging Face API |
| Kokoro-82M v1.0 (hexgrad) | `onnx-community/Kokoro-82M-v1.0-ONNX` | Apache 2.0 | Hugging Face API. Its JavaScript (`kokoro-js`) brings eSpeak NG (GPL-3.0-or-later) in `phonemizer`; the site swaps that out and reads English itself: the voice section above |

## Models that made the art (not run by the game)

| Model | Made | Licence and what it asks |
|---|---|---|
| FLUX 3 Image Klein (Black Forest Labs) | the 71 card paintings | **FLUX Kommunity License v1.0**: commercial use of what it makes only for a "Qualifying User", whose revenue with its affiliates is **under US$5,000,000** a year (lower than the LFM threshold); output reviewed before publication; AI generation disclosed where the law asks. `docs/ASSETS.md` section 4 |
| Z-Image Turbo (Tongyi-MAI) | the 198 city portraits | Apache 2.0 (model card), run through the public Space `mcp-tools/Z-Image-Turbo` |
