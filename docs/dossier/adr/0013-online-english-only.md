# 0013. Online duels in English only

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../12-technical-design.md`, `../14-localisation-kit.md`, ADR 0012.

- **Status:** Accepted
- **Date:** 2026-11-17
- **Who decided:** recorded as "by decision" in `CLAUDE.md:134-139` and commit 05a5c042 ("English only, by decision"); the source does not name who decided
- **Source:** `CLAUDE.md:134-139`; commit 05a5c042 (2026-11-17); `backend/src/multiplayer/handlers.rs:537`; `sources/as-built-tech.md` §5

## Context and problem statement

Solo duels play in 16 languages. The server's rules engine is a Rust port of the English path (ADR 0012). The other 15 languages are read by sound tables, a Japanese analyser (kuromoji) and the browser's word segmenter (Chinese, Thai), which a Rust server could not reproduce exactly. Should online duels be offered in languages the server cannot score as the browser does?

## Decision drivers

- "A server that scored them differently from the preview would be worse than none" (`CLAUDE.md:136-137`).
- Players must know before they queue.

## Considered options

1. Offer every language online and accept differences.
2. Offer English online only, refuse other languages clearly, keep all 16 solo.
3. Port more languages first, then open online play.

## Decision outcome

Option 2. The page says so (`#mp-english-only`); `JoinRoom` carries `lang`, and the room refuses any language but `en` with `language_not_offered`. Solo duels stay in all 16 languages.

### Consequences

- Good: online scores never contradict the preview.
- Bad: 15 of the game's 16 languages have no online play; the multiplayer page's own text is English in every language (tech §6.1).
- Bad: a marketing promise of "16 languages" must say "solo".

### Confirmation

`backend/src/multiplayer/` unit tests cover the refusal; `tests/multiplayer.spec.ts` covers the language refusal end to end (commit 05a5c042).

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| All languages, accept differences | reach | scores that differ from the preview |
| English only | one honest score | 15 languages solo only |
| Port first | reach and honesty | months of work before any online play |

## More information

Proposed order for adding online languages (spelling-shows-sound languages first: Polish, Korean, Vietnamese, Arabic; never Chinese, Japanese or Thai until one segmenter serves both sides): `../12-technical-design.md` §8.
