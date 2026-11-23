# 0001. Run all AI in the player's browser; no cloud inference

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../13-ai-design-and-system-cards.md`, ADR 0002, ADR 0003.

- **Status:** Accepted
- **Date:** 2026-11-16
- **Who decided:** the owner (direction of 2026-11-16, `CLAUDE.md:639-644`: "in-browser models only, no cloud provider (Liquid AI / Gemma 4 class), which also means the multiplayer judge must stop calling a cloud API")
- **Source:** `CLAUDE.md:13,639-644`; commit ae20b599 (2026-11-16, "Rebuild the battle as a three-round verse duel on in-browser models"); commit 8d113da8 (2026-11-16, "the cloud judge is gone"); `sources/as-built-tech.md` §0, §4

## Context and problem statement

The February 2026 build used a cloud AI, and main's multiplayer judge called a cloud language model when a key was set; with no key it scored rounds with random numbers (commit 8d113da8). The game's players write verse, possibly children, possibly in a classroom. Sending every verse to a model provider costs money per player, needs a key on the server, and breaks the promise that what a player writes stays theirs. Where should the AI run?

## Decision drivers

- Privacy: solo verse and voice never leave the device (`src/pages/privacy.astro:18-22`).
- Cost: a free game with no ads cannot pay per verse.
- The owner's standing rules: no paid APIs at runtime, no cloud inference.
- Reach: the game must still work where no model can run.

## Considered options

1. A cloud model for the opponent and the judge (the February build, main's multiplayer judge).
2. A model on the studio's own server.
3. Models in the player's browser, with a rule-based fallback.

## Decision outcome

Option 3. The opponent, the judge, speech recognition and the English voice run in the browser through Transformers.js on WebGPU or WebAssembly. No server runs inference. Online rounds are scored on the server by rules alone (ADR 0012).

### Consequences

- Good: no inference bill, no key to leak, no verse or audio sent anywhere in solo play; the privacy policy can say so plainly.
- Good: the game is honest when it says "on this device" (`verdict.judgedCompare`, `src/i18n/locales/en.ts:304`).
- Bad: model quality is capped by what a browser can hold (3.1 GB at most here), and phones, tablets and headsets get no model at all (ADR 0003; `../13-ai-design-and-system-cards.md` §8).
- Bad: first use downloads 1 to 3 GB from Hugging Face, which learns the player's IP address and the model asked for (`tests/third-party-allowlist.ts:52-60`).
- Bad: the online judge cannot use a model without breaking this decision.

### Confirmation

- `tests/third-party.spec.ts` fails on any request to another origin that the allowlist lacks; only model weight files may come from the hub (`CLAUDE.md:610-631`).
- The model tests (`playwright.model.config.ts`) run the real models in a WebGPU browser.
- The configuration at 0d6df6ef reads no cloud-model key or URL any more (tech §10.3: both settings removed with the cloud judge).

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| Cloud model | best quality; works on phones | per-verse cost; verse leaves the device; a key on the server; against the owner's rules |
| Own server model | no third party | still sends verse off the device; a GPU server to run; against "in-browser models only" |
| Browser models + rules | private, free per player, works offline once cached | device-limited; large first download; no phone model |

## More information

- Model cards and limits: `../13-ai-design-and-system-cards.md`.
- The research behind the tier ladder: `docs/research/in-browser-ai-2026-11.md`.
