# 0002. Every duel plays without a model: written opponent and rule judge

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../13-ai-design-and-system-cards.md`, `../14-localisation-kit.md`, ADR 0003.

- **Status:** Accepted
- **Date:** 2026-11-16
- **Who decided:** engineering work on the rebuild, recorded in commit ae20b599 ("With no WebGPU the opponent plays written verses and judging is by rule")
- **Source:** commit ae20b599 (2026-11-16); `docs/language/MODEL-EVAL.md:7-10`; `src/lib/verse/opponent.ts:172-178`; `src/lib/verse/judge.ts:479-501`; `sources/as-built-design.md` §1.6–1.7

## Context and problem statement

A model needs WebGPU, 16-bit shaders, a non-handheld device and at least 8 GB of reported memory (ADR 0003). Most phones fail that. A model also downloads 1 to 3 GB. If the duel needed a model, most players could not play, and nobody could play the first match at once. What plays when no model does?

## Decision drivers

- The first match must not wait for a model (`../research/sota-production-2026-11.md` §0 item 7).
- All 16 languages must be playable.
- The verdict must be explainable and deterministic.

## Considered options

1. Require a model; refuse to play without one.
2. A written opponent (prepared verses from each language's pack, chosen by seed) and a rule-based judge that compares four criteria by counting.
3. A cloud fallback (rejected by ADR 0001).

## Decision outcome

Option 2. Without a model, the opponent plays a verse from the duel language's pack that keeps the round's form (and, under a curse, the verse that loses least to it), and the rule judge compares wordplay, allusion, flow and wit by counts (design §1.6–1.7). The model replaces either part only in the languages where it was measured to do better (ADR 0003). If a model's draft is void or worth under half the written verse's craft, the written verse is played anyway.

### Consequences

- Good: every device plays every language from the first second; the verdict line says "Judged by rule" (`verdict.judgedRules`).
- Good: the rule judge is held to main's accuracy on labelled pairs in all 16 languages (`src/lib/verse/judge-accuracy.test.ts:79-91`).
- Bad: difficulty does nothing without a model, because difficulty is the number of drafts a model writes (design §1.6).
- Bad: against the written opponent, wit is always a split, since the written verse answers nothing (design §1.7).
- Bad: the written verses were written by a language model and checked only by tools; no native speaker has read them (`docs/language/HUMAN-REVIEW.md` item 1).

### Confirmation

- `verse.test.ts` requires every pack verse to keep its form as the code checks it; `scripts/mutate-packs.mjs` proves those tests go red when a verse is broken (`CLAUDE.md:538-539`).
- `judge-accuracy.test.ts` holds the rule judge to main's tallies.

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| Model required | one path to test | most devices cannot play; a long wait before the first verse |
| Written opponent + rules | universal, instant, deterministic, explainable | flat difficulty; prepared verses repeat; no answer to the player's verse |
| Cloud fallback | strong opponent on phones | rejected by ADR 0001 |

## More information

- Per-language packs and their review status: `../14-localisation-kit.md`.
