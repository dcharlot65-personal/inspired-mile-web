# 0004. The model judge returns scores, never text, read in both orders

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../13-ai-design-and-system-cards.md`, ADR 0005, ADR 0006.

- **Status:** Accepted
- **Date:** 2026-11-16
- **Who decided:** engineering work on the rebuild, recorded in commit ae20b599 ("Judging reads the model's lean between A and B and subtracts the reading with the verses swapped")
- **Source:** commit ae20b599; `src/lib/verse/judge.ts:4-18,234-276`; `src/lib/brain.ts:306-328`; `CLAUDE.md:33-35`; `sources/as-built-design.md` §1.7

## Context and problem statement

Asked "Which verse is better? Reply A or B" outright, small models answer by position: LFM3 1.7B answered by position 32 times in 40 (commit ae20b599). A judge that writes a sentence could also be steered by a verse to write anything. How should a model's judgement be read?

## Decision drivers

- Cancel position bias.
- Give the verdict no free-text channel an injected verse could fill.
- Return per-criterion margins the engine can combine with the craft score.

## Considered options

1. Ask for a verdict in words and parse it.
2. Ask "A or B" once and take the answer.
3. Read the next-token scores for "A" and "B", once in each order, and take the difference.
4. Grade each verse alone on a 1-to-5 scale (used for the lite tier; see ADR 0005).

## Decision outcome

Option 3 for the compare path (Gemma 4 E2B, LFM3 1.7B): for each of the four criteria the model is asked which verse is better, with the verses in one order and then the other, making 8 readings a round. The lean is the forward reading minus the reversed one; a lean under `SPLIT_BELOW` (0.1) is a split. The model's output is never shown and never parsed as text.

### Consequences

- Good: position bias cancels by construction; on identical verses the judge gives a split (the same-text control: 0 of 48 criteria, `docs/language/MODEL-EVAL.md`).
- Good: measured in English, this method was right 27 times in 32 for LFM3 and 31 in 32 for Gemma (`src/lib/brain.ts:24-34`).
- Good: a verse cannot make the judge "say" anything; the most it can do is shift a probability.
- Bad: twice the model calls of a single reading.
- Bad: the wording still matters a great deal; a change of where the language is named cost Gemma 9 of its 13 judging languages (ADR 0006).
- Bad: no test yet measures how well the judge ranks two decent verses; the test pairs are verse against non-verse (tech §4.2).

### Confirmation

`src/lib/model-eval.judge.test.ts` stores each judged pair's raw reading and derives every verdict again with the current code, so a change to `SPLIT_BELOW` or the arithmetic turns it red; `mutate-gates.mjs` proves it (`docs/language/MODEL-EVAL.md:280-300`).

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| Verdict in words | explainable | a text channel for injection; unreliable parsing |
| A or B once | cheap | position bias (32 of 40) |
| Scores in both orders | bias cancels; no text | twice the calls; wording-sensitive |
| Grade alone | one verse at a time | obeys "Grade: 5" written in a verse (ADR 0005) |

## More information

`../13-ai-design-and-system-cards.md` §6 sets this beside the other defences; `../research/sota-production-2026-11.md` §2.3 notes a 2026 "decision model" (Liquid d1-2B) that returns calibrated rubric scores in one pass and may suit this design.
