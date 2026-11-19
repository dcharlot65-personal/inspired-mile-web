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

This note covers the LFM models only; it says nothing about the terms of any other model.
