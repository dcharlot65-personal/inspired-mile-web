# 0014. Online rooms in memory; verses never stored

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../12-technical-design.md`, `../16-analytics-and-tracking-plan.md`, ADR 0012.

- **Status:** Accepted
- **Date:** 2026-11-16 (room state machine, commit 8d113da8); retention tied to the policy by a compile-time check (2026-11-17)
- **Who decided:** engineering work, recorded in commit 8d113da8 and `CLAUDE.md:186-193`
- **Source:** commit 8d113da8; `backend/src/multiplayer/game_room.rs:43-105`; `src/pages/privacy.astro:61`; `src/lib/privacy-retention.test.ts`; `CLAUDE.md:186-193`; `sources/as-built-tech.md` §2.3

## Context and problem statement

An online duel sends a player's verse to the server and, when the round ends, to the opponent. Players may be teenagers; verses are personal writing. Storing them would make the studio a holder of user-generated content with retention, access and moderation duties. Where should a live match live, and for how long?

## Decision drivers

- Keep as little player writing as possible, for as short a time as possible.
- Let a player whose connection dropped still see the result.
- The privacy policy's words and the code must not drift apart.

## Considered options

1. Store matches and verses in the database (the unused `battle_rooms` and `battle_turns` tables).
2. Keep each room in the API's memory as a synchronous state machine; drop the verses when the room is retired; write nothing about a match to the database.

## Decision outcome

Option 2. A finished room answers a returning player for 90 s, then takes nobody; the next sweep (every 15 s) drops its verses even if a timer still holds the room. A compile-time assertion holds 90 + 15 ≤ 120 s, the policy's "up to two minutes after it ends", and `privacy-retention.test.ts` holds the policy's words to that constant. An unfinished room is swept at 30 minutes. Only a report (reason up to 500 characters) and the deck check touch the database.

### Consequences

- Good: no stored verses to leak, subpoena or moderate after the fact.
- Good: a change to the timers or the policy fails the build until both agree.
- Bad: a deploy or crash ends every live match; there is one API instance.
- Bad: no match history, no rating, and, as built, no server source for the leaderboard or tournament results. **In this release** (`fix/server-authority`) the leaderboard and tournaments come only from server-judged matches; whether that stores a result row (not a verse) is the branch's design (Not known).
- Bad: a report refers to a room whose verses are gone, so a reviewer cannot read what was reported. Moderation needs a decision on what a report keeps (`../13-ai-design-and-system-cards.md` §6).

### Confirmation

The const assertion in `game_room.rs`; `src/lib/privacy-retention.test.ts`; 29 room unit tests with paused time (tech §7.1).

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| Store matches | history, ratings, evidence for reports | retention and moderation duties; data to protect |
| In memory, verses dropped | minimal data; promise enforced by the build | lost on restart; no history; reports lack evidence |

## More information

`../12-technical-design.md` §5.4.
