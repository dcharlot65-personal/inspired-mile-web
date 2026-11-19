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

## The other models (read 2026-11-19)

The licence of each, as its own publisher states it. Every one is on the credits page (`/credits`).

| Model | Repository the game loads | Licence | Read where |
|---|---|---|---|
| Gemma 4 E2B (Google) | `onnx-community/gemma-4-E2B-it-ONNX` | **Apache 2.0**. Google's "Gemma 4 license" page is the Apache License 2.0, and its Gemma Terms of Use say: "The terms below apply to Gemma models listed in the Appendix at bottom of this page. For Gemma 4 terms, see the Gemma 4 license." | ai.google.dev/gemma/docs/gemma_4_license and ai.google.dev/gemma/terms; Hugging Face `cardData.license` `apache-2.0` with that link |
| Whisper base (OpenAI) | `onnx-community/whisper-base` | Apache 2.0 by both model cards (`openai/whisper-base` and the conversion). The as-built fact base's "MIT" is the licence of OpenAI's code, not what the weights' card declares | Hugging Face API |
| Kokoro-82M v1.0 (hexgrad) | `onnx-community/Kokoro-82M-v1.0-ONNX` | Apache 2.0 | Hugging Face API. Its JavaScript (`kokoro-js`) brings eSpeak NG (GPL-3.0-or-later) in `phonemizer`: `docs/ASSETS.md` section 7 |

## Models that made the art (not run by the game)

| Model | Made | Licence and what it asks |
|---|---|---|
| FLUX 3 Image Klein (Black Forest Labs) | the 71 card paintings | **FLUX Kommunity License v1.0**: commercial use of what it makes only for a "Qualifying User", whose revenue with its affiliates is **under US$5,000,000** a year (lower than the LFM threshold); output reviewed before publication; AI generation disclosed where the law asks. `docs/ASSETS.md` section 4 |
| Z-Image Turbo (Tongyi-MAI) | the 198 city portraits | Apache 2.0 (model card), run through the public Space `mcp-tools/Z-Image-Turbo` |
