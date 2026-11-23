# 0021. A server-authoritative economy

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../12-technical-design.md`, `../15-qa-and-test-plan.md`, `docs/ECONOMY.md` (on `fix/server-authority`).

- **Status:** Accepted, in this release (branch `fix/server-authority`, which writes `docs/ECONOMY.md`)
- **Date:** 2026-11-19
- **Who decided:** the owner, 2026-11-19, choosing to make the economy server-authoritative before this deploy
- **Source:** the owner's release decisions of 2026-11-19; `sources/as-built-tech.md` §2.2, §12 items 1-3; `sources/as-built-design.md` §4

## Context and problem statement

As built, the API believes the client about almost everything of value (tech §12):

- `POST /credits/earn` adds the client's `amount` (1 to 1,000) per call;
- `POST /seasons/xp` adds the client's XP;
- `POST /stats` raises counters to the client's numbers, and the public leaderboard reads them;
- achievements are claimed by id;
- `POST /inventory/add` and `/migrate/sync` add any card, which also lets an account field any character online;
- a marketplace purchase marks the listing sold and gives the buyer the card, but moves no credits and leaves the seller the card;
- either tournament participant can name either player the winner.

Only the rate limit bounds any of this. A leaderboard anyone can top, and free duplicated cards, make the economy meaningless, and become a consumer-protection problem the moment credits cost money. What may the server believe?

## Decision drivers

- Nothing of value comes from a number the client sent.
- Online results the server judged are the only source of ranking.
- Purchases must conserve credits and cards.

## Considered options

1. Leave it; it is a free game.
2. Validate client numbers against plausible ranges.
3. The server decides: fixed earn rates with daily caps; cards only from the server; the leaderboard and tournaments only from server-judged matches; purchases that move credits and the card.

## Decision outcome

Option 3, as the owner decided. `docs/ECONOMY.md` on the branch is the source for the rates and caps; this record does not restate them.

### Consequences

- Good: the leaderboard means something; cards cannot be duplicated.
- Open: solo duels are judged in the browser, so a solo win cannot be server-verified; whether solo play earns anything server-side, and how, is the branch's design (Not known here).
- Open: what happens to state already held in a player's browser when they sign in (`/migrate/sync`); with 0 production accounts on 2026-11-19 there is no existing server state to reconcile.
- Bad: the economy handlers have no tests at 0d6df6ef (tech §7.1); the branch must add them.

### Confirmation

Proposed for the branch: cargo tests per handler (an `earn` with a client amount refused or ignored; a daily cap reached; a purchase moving both credits and the card in one transaction; a tournament result refused unless the server judged the match); an end-to-end test of a purchase between two accounts (`../15-qa-and-test-plan.md` §7).

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| Leave it | no work | meaningless leaderboard; free duplicates |
| Range checks | small change | still forgeable within the range |
| Server decides | trustworthy economy | solo play cannot be verified; more server logic |

## More information

Research on earned-only currency and the EU consumer principles for bought currency: `../research/sota-design-2026-11.md` §7 and `../research/sota-production-2026-11.md` §5.7.
