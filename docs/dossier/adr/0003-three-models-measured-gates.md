# 0003. Three models, offered by device and used only where measured

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../13-ai-design-and-system-cards.md`, `docs/language/MODEL-EVAL.md`, ADR 0006.

- **Status:** Accepted
- **Date:** 2026-11-16 (tiers, commit ae20b599; measured lists, commit 3a9ae611; thresholds committed before any cell ran, commit 8e926043). The lists were re-measured on 2026-11-18 and 2026-11-19.
- **Who decided:** the owner chose the model families ("Liquid AI / Gemma 4 class", `CLAUDE.md:641-642`); the gates were decided in engineering work and recorded in the commits above
- **Source:** `src/lib/brain.ts:61-164`; `scripts/model-eval/thresholds.json`; `docs/language/MODEL-EVAL.md`; `CLAUDE.md:13-20,500-535`; `sources/as-built-tech.md` §4.1–4.2

## Context and problem statement

Each model's card listed languages it "supports", copied into the game, and the game offered the model in all of them. Nothing had been measured outside English (`docs/language/MODEL-EVAL.md:3-5`). A small model that writes English commentary into a Thai duel, or prefers the shorter verse in Arabic, makes the game worse than the rules. Which model, on which device, in which language?

## Decision drivers

- Never put an unmeasured model in front of a player.
- Fit the device: iPhone Safari kills a tab near 2 GB; WebGPU and memory vary (tech §4.4).
- The bar must not follow the results.

## Considered options

1. One model everywhere, trusting its card.
2. A tier ladder by device, each model used in the languages its card lists.
3. A tier ladder by device, each model used only in the languages where it passed bars committed before measuring.

## Decision outcome

Option 3. Three models are known: **Gemma 4 E2B** (3,100 MB, the "grand" tier), **LFM3 1.7B** (1,090 MB, "standard"), **LFM2.5 350M** (295 MB, "lite"). `detectCapability` reads WebGPU, `shader-f16`, reported memory and a handheld test; a capable desktop is offered Gemma first and LFM3 as the lighter download. Each model carries `writesIn` and `judgesIn`, copied from `docs/language/model-eval/decisions.json`, which `scripts/model-eval/analyze.mjs` derives from result files by the thresholds committed in 8e926043:

- **Judging:** at least 12 pairs; the Wilson lower bound of pairs won above 0.5 (in practice 10 of 12); at least 70% of 48 criteria; no injection pair lost.
- **Writing:** at least 10 plays per form; ≥95% model-written; ≥90% in the language (adjusted by the detector's recall); ≤10% commentary; the form kept in ≥30% of plays.

A model used in no language is never offered and never a fallback (`modelsToOffer`, `loadOrder`).

### Consequences

- Good: the picker tells the player, per language, who writes and who judges, and why.
- Good: a regression in a prompt or a rule turns a test red until the cells are measured again (`src/lib/model-eval.test.ts`, `model-eval.judge.test.ts`).
- Bad: as measured at 0d6df6ef, LFM2.5 is used nowhere, LFM3 only judges Vietnamese, and **phones, tablets and headsets are offered nothing** (tech §4.1).
- Bad: 30 of 96 cells are unmeasured, each cell ran once, on one machine (tech §12 item 6).
- Bad: three of the five models the game ships predate the owner's 2026-04-01 rule (`../13-ai-design-and-system-cards.md` §5); this record does not resolve that.

### Confirmation

`src/lib/model-eval.test.ts` fails when the lists in `brain.ts` drift from `decisions.json`; `scripts/model-eval/mutate-gates.mjs` breaks the gates 16 ways and each was caught (`docs/language/MODEL-EVAL.md:280-310`).

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| One model, card's languages | simple | unmeasured quality; phones cannot hold it |
| Ladder, card's languages | fits devices | the card's claims were wrong in practice (Arabic, Japanese commentary) |
| Ladder, measured gates | honest per language; regressions caught | expensive to measure; thin coverage today |

## More information

- Results per language: `docs/language/MODEL-EVAL.md`; system cards: `../13-ai-design-and-system-cards.md`.
- On `integrate/wave3` at c22b035a, which the release branches are built on, Gemma 4 E2B also writes Vietnamese (commit ee2bf5ad, 2026-11-19: form kept in 35 of 110 plays, 32%, bar 30%). This is in this release, not at 0d6df6ef.
