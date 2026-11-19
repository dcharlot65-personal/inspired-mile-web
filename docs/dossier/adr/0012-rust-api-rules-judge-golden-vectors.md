# 0012. Rust API scores online rounds by rule, held to the TypeScript by golden vectors

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../12-technical-design.md`, ADR 0013, ADR 0014.

- **Status:** Accepted
- **Date:** 2026-11-16
- **Who decided:** the owner ("backend stays Rust", `CLAUDE.md:643-644`; the multiplayer judge "must stop calling a cloud API", `CLAUDE.md:642-643`); the golden-vector method in engineering work, recorded in commits 217672a2 and 8d113da8
- **Source:** commits 217672a2 and 8d113da8 (2026-11-16); `CLAUDE.md:113-157`; `backend/src/verse/mod.rs:1-17`; `backend/tests/verse_parity.rs`; `src/lib/multiplayer-golden.test.ts`; `sources/as-built-tech.md` §5

## Context and problem statement

In an online duel neither player's browser can be trusted to score, so the server must. Main's server scored with a cloud model, or with random numbers when no key was set. The player's own browser previews the score with the TypeScript rules as they type. If the server's score ever differs from the preview, the player sees one number and gets another. How should the server score, and how is it kept identical to the browser?

## Decision drivers

- No model and no randomness on the server (ADR 0001).
- One score: the preview and the verdict must agree exactly.
- The server stays Rust.

## Considered options

1. Run the TypeScript engine on the server (Node or an embedded JavaScript engine).
2. Run the TypeScript engine inside the Rust process through an embedded JavaScript engine.
3. Port the English rules to Rust and hold the port to the TypeScript with generated golden vectors.

## Decision outcome

Option 3. `backend/src/verse/` ports, for English, cleaning, words, syllables and rhyme by sound, forms, devices, signature echo, curses, power words, the substance floor, the copy test, `scoreVerse`, the rule judge and round resolution. `src/lib/multiplayer-golden.test.ts` runs the TypeScript over a seeded corpus and writes 7 files (17.8 MB, about 35,000 cases); `backend/tests/verse_parity.rs` requires the Rust to give the same count, point and verdict for every case. The data both read (pronunciation table, confusables, cards, English strings) is one file each, compiled into the binary; numbers are compared as exact doubles. The browser recomputes every round the server sends (`auditRound`) and says so if one disagrees.

### Consequences

- Good: online scores are deterministic, explainable and free to compute.
- Good: a stale golden file turns `npx vitest run` red; a mismatch turns cargo red. The rule is "fix the Rust; never loosen the comparison".
- Bad: every change to `src/lib/verse/`, `cards.ts` or `multiplayer-rules.ts` needs the goldens regenerated on the build host and the Rust kept in step: two implementations to maintain.
- Bad: only English is ported (ADR 0013); relics, potions and ink are not played online.
- Bad: the server's Unicode tables (16) can be older than the browser's (17); such a verse is refused, not mis-scored.
- Bad: the API must be built inside the whole repository (`scripts/check-api-build.sh`).

### Confirmation

`backend/tests/verse_parity.rs` (8 tests over about 35,000 cases) on every API build; `scripts/check-api-build.sh` builds from a clean copy with `--locked`.

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| TypeScript on the server | one implementation | a second runtime in production; against "backend stays Rust" |
| TypeScript run inside Rust (an embedded JavaScript engine, or a WASM build of one) | one implementation | a JavaScript runtime inside the API; exact float and Unicode behaviour of that engine would still need proving; not evaluated in the record |
| Rust port + golden vectors | native Rust; exact agreement proven on every build | two implementations; English only |

## More information

`../12-technical-design.md` §8.
