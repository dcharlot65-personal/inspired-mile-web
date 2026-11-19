# The economy and the rankings: the server is the authority

The owner's decision, 2026-11-19 (the option chosen, in their words): "Before this deploy
(Recommended): Server sets amounts at fixed rates with daily caps. Cards come only from the
server. The leaderboard and tournaments count only matches the server judged. A purchase moves
the credits and the card."

This document is the rulebook. **Every number in it is tunable**: each lives in one file,
`backend/data/economy.json`, which the API compiles in (`backend/src/economy.rs`) and the pages
import (`src/lib/economy-rules.ts`). Change the file, rebuild the API and the site, and both follow;
`src/lib/economy-rules.test.ts` and `cargo test` hold the places that still print a number of their
own (the playground's pack lines, the about page, the season page, the price error) to it.

## The five principles, and where each is enforced

1. **The server decides every amount.** A request that names an amount (`amount`, `price`) is
   refused with 400 ("Amounts are set by the server"). Solo play happens in the browser, where the
   server cannot see it: what it earns is a fixed amount per source, at most so many times a day
   per account and source, every payment logged in `credit_transactions` (credits) or
   `xp_transactions` (season XP), and the caps counted from those logs. Solo results never feed the
   public leaderboard, rankings or tournaments. (`credits/handlers.rs earn_credits`,
   `seasons/handlers.rs add_xp`, `ledger.rs credit_capped`, `xp_capped`.)
2. **Rankings come only from matches the server judged.** Every finished online match is stored
   (`battle_rooms`, written by `multiplayer/results.rs`); the public leaderboard, an account's
   online record (`GET /stats`) and account achievements are read from those rows and nothing else.
   A win is a match, not a round.
3. **Cards come only from the server**: the starter characters, packs the server opens with its
   own randomness and paid in credits, free packs it grants, season rewards, and a one-time capped
   import of a device's collection on first sign-in. Online play fields only cards the account holds
   on the server (the starter characters count; a card on sale does not).
4. **Achievements the server cannot verify stay on the device.** The device keeps all thirty
   (`src/lib/achievements.ts`), worked out from what that browser saw, and never posts them. The
   account's achievements are the eighteen the server can work out from its own records
   (`account_achievements` in the file): online wins, matches, rounds and best round; cards held;
   packs opened.
5. **A market purchase is one transaction**: an active listing that is not the buyer's own, the
   buyer's balance and (for a teen account) daily limit checked, the price moved from buyer to
   seller (both logged), and the very card moved to the buyer. A listed card is locked.

"A day" is the UTC calendar day, for every cap and for the teen spending limit (it was the
database's `CURRENT_DATE` before). The daily free pack is the one exception: once in every 24
hours, as the playground has always said.

Every economy write locks the account first (`ledger::lock_account`: its `player_stats` row,
`FOR UPDATE`), so requests sent at once cannot pass a cap, a balance or a once-only check together;
a purchase locks both accounts in a fixed order.

## Rates and caps (all tunable)

### Solo play (the server cannot see it)

| Source (`source`) | Credits | Per day | XP | Per day | Why |
|---|---|---|---|---|---|
| `solo_win`: a solo duel won | 50 | 3 | 100 | 3 | The About page has promised +50 for a battle won and the season page 100 XP; three a day is an evening's play, and all a script can claim too |
| `trivia`: a trivia round passed (3 of 5) | 30 | 3 | 50 | 3 | The About page's +30; trivia is quick, so the cap is low |
| `challenge`: a quote challenge solved | 20 | 5 | 40 | 5 | The About page's +20; shorter still, so a few more |
| `daily`: the daily bonus | 10 | 1 | 25 | 1 | Once a day per account, asked for by the page on a signed-in visit |

A fully scripted account therefore earns at most 350 credits (seven standard packs) and 675 XP a
day from solo play. That is the price of not seeing solo play: it is bounded, not verified.

Signed out, nothing is earned for an account. The device keeps its own collection for solo play:
a solo duel won adds a card, and trivia and quote challenges add one at most
`device.trivia_cards_per_day` (3) and `device.challenge_cards_per_day` (3) times a day each (they
paid a card every time, without end, until this change). The device's collection reaches an
account only through the capped import below.

### Online play (the server judged it)

| What | Amount | Cap | Why |
|---|---|---|---|
| An online match won | 50 credits | 10 a day, and 3 a day against the same opponent | Verified, so it pays like a solo win; the per-opponent cap makes two accounts trading wins earn little |
| XP for a match | 100 for a win, 25 otherwise | 20 matches a day | A loss still pays a little for playing |

A forfeit or a dropped connection is a win for the other player, as it always was online.

### Packs

| Pack | Cards | Guaranteed | Price |
|---|---|---|---|
| Free starter pack | 3 | | once per account |
| Free daily pack | 1 | | once in every 24 hours |
| Standard | 3 | | 50 credits |
| Rare | 5 | one Rare | 150 credits |
| Epic | 5 | one Epic | 400 credits |

Draws: a rarity by weight (Common 50, Uncommon 30, Rare 15, Epic 4, Legendary 1, as the playground
discloses), then a card of that rarity, each equally likely; with replacement. The server's own
randomness (`rand::rng()`, seeded by the operating system), never the client's. Prices and weights
are what the playground has shown since before this change.

### The one-time import of a device's collection

On an account's first sign-in on a device that has a collection, the page offers to move it, once
per account. The server takes one copy of each different card, the rarest first, at most
**20 cards**, of which at most **1 Legendary, 2 Epic and 5 Rare**; starter characters are not taken
(every account holds them already); unknown ids are left out; a card id that is not 1 to 16
characters of letters, digits and dashes is a 400. Stats, achievements and world-card variants
stay on the device.

Why these caps: a device's collection is whatever its browser storage says, so the import is the
most a forged collection can bring. Twenty cards is about what an honest player collects signed
out in two weeks (a starter pack, fourteen daily packs and a few duel wins); twenty honest draws
hold 0.2 Legendary, 0.8 Epic and 3 Rare on average, so the rarity caps let a lucky honest player
keep their luck and stop a forger at one Legendary.

### The market

| Rule | Value | Why |
|---|---|---|
| Price | 1 to 100,000 credits | As before |
| Fee | none | Not decided (owner question) |
| Listings | sales only | A trade (card for cards) needs the buyer's card moved too, which is not built; trade listings are refused |
| What can be listed | a card the account holds on the server and has not listed | A listing locks that very row (`owned_cards.state = 'listed'`); the starter characters are no rows and cannot be sold |
| While listed | the card cannot be listed again, sold elsewhere or fielded online | One copy, one listing (`card_listings_one_active_per_card`) |
| Cancel | unlocks the card | |
| Teen buyer | the price counts against the 200-credit daily limit | As every spend does |

A listing from before this change (no `owned_card_id`) is not shown and cannot be bought.

### Other

| Rule | Value | Why |
|---|---|---|
| Teen daily spending | 200 credits | Unchanged; every spend counts (packs, market) |
| Referral | the referrer receives 100 credits, at most 3 times a day; the redeemer receives nothing | The reply promised the redeemer "5 free packs" and granted none; the words now say what is granted |
| Founding credits | an account created before `LAUNCH_DATE` is brought up to 500 once, logged | It was a refill on every `/auth/me`, unlogged. No account can qualify now (production had none) |
| Season rewards | claimed by each player once: credits (logged), a pack the server opens, or a card; a title is recorded, nothing shows titles; a premium reward is not granted (nothing sells premium) | `claimed` was one flag for everyone, and only credits granted anything |

## The starter set and the Sonnet Man

Every account holds the starter characters, The Sonnet Man (`SM-001`, Legendary), Romeo and
Juliet, without a row: the first three characters of the catalogue, as both engines already
define them (`starter_characters()`, `ONLINE_STARTER`, `starterDeck([])`). They are the solo
starter deck and the free online deck. They cannot be listed for sale. A Sonnet Man drawn from a
pack is an ordinary card that can be sold, though every player already fields one: whether a
Legendary should be free to all is the owner's choice (see "Questions for the owner").

## Rankings, tournaments and achievements

- **The leaderboard** (`GET /stats/leaderboard`, public): accounts with at least one online match
  won, ranked by matches won, then best round, then fewer matches. The field names are the old
  ones, so a cached page still draws it: `battle_wins` is matches won, `total_battles` matches
  finished, `highest_score` the best total of one round.
- **An account's record** (`GET /stats`): online wins, losses, draws, matches, rounds and best
  round; cards held and packs opened on the server; the balance. `POST /stats` is gone.
- **Account achievements** (`GET /stats/achievements`): worked out when asked, from the records
  above, and stamped the first time they are seen. `POST /stats/achievements` is gone.
- **Tournaments**: a match is played in a room either player opens
  (`POST /tournaments/{id}/matches/{match_id}/room`; the same room for both while it is live; the
  first to arrive waits up to four minutes for the other). Only that room's result, stored by the
  server, decides the match; `tournament_matches.room_id` points at its `battle_rooms` row (it
  pointed at a table nothing wrote). `POST .../complete` is gone. Single elimination: the loser is
  out, the winner goes on, a draw is played again. Round robin: a draw stands. Byes go through
  when the bracket is drawn, and the bracket no longer makes an empty first-round match.
  `max_players` is 2 to 64; a description at most 1,000 characters.
- A match's result is handed to the recorder once, when the room ends it. If the database cannot
  take it, it is tried four times and then logged in full, at error level, for an operator to
  enter; a crash between the end of a match and its write loses it (the room lives in memory).
  The verses are never stored.

## What this does not stop

- **Solo earnings are bounded, not verified.** A script can claim every solo cap every day.
- **Many accounts.** Each account can earn the solo caps, import 20 cards and redeem one code.
  Sign-ups are limited per network (40 an hour per /24 or /48, `auth/passkeys.rs`), not per person.
  Accounts can funnel credits to one another through market sales.
- **Win-trading.** Two accounts can play each other and one forfeit. Credits pay three such wins
  a day per opponent; the leaderboard counts every one.
- **No fee and no price floor** in the market, so credits move between colluding accounts at will.

## Routes changed (the contracts)

| Route | Now |
|---|---|
| `POST /credits/earn` | `{ source }` only; `amount` is a 400; answers `{ credits, granted, source, earned_today, per_day }` (granted 0 past the cap) |
| `POST /credits/spend` | gone |
| `POST /seasons/xp` | `{ source }` only (the solo sources); `amount` is a 400 |
| `GET /seasons/rewards`, `POST /seasons/claim/{level}` | `claimed` is the player's own; a claim grants its reward in the same transaction |
| `GET /inventory` | each row has `listed` |
| `POST /inventory/add` | gone |
| `GET /inventory/status` | new: starter claimed, daily available, next daily, balance, starter characters |
| `POST /inventory/claim` | new: `{ kind: "starter" \| "daily" }`; 409 once taken |
| `POST /inventory/packs` | new: `{ tier }`; `price` is a 400 |
| `POST /migrate/sync` | gone |
| `POST /migrate/import` | new: `{ cards: [card ids] }`; once (409 after); `GET /migrate/status` gives `max_cards` |
| `POST /variants/unlock` | gone (world-card variants are the device's) |
| `GET /stats` | the server's record (shape above); `POST /stats` and `POST /stats/achievements` gone |
| `POST /marketplace/list` | sales only, price required, a catalogue card id |
| `POST /marketplace/{id}/buy` | moves the price and the card; answers `{ status, card_id, price, credits }` |
| `POST /tournaments/{id}/matches/{match_id}/complete` | gone |
| `POST /tournaments/{id}/matches/{match_id}/room` | new: `{ room_id }` |
| `POST /referral/redeem` | `packs_granted` is 0; `referrer_credits` says what the referrer got |

Database: migration `020_server_authority.sql` (adds only): result columns on `battle_rooms`,
`card_listings.owned_card_id` with one active listing per card, `pack_claims`,
`season_reward_claims`, `xp_transactions`, and indexes for the daily counts. New setting:
`TOURNAMENT_CHECK_SECONDS` (default 30; the e2e harness sets 1).

## Questions for the owner

1. **The free Sonnet Man.** The starter set (every account, free, unsellable) holds The Sonnet Man,
   a Legendary card that packs draw once in 300. Keep it free for all, or make the third starter a
   common character and the Sonnet Man earnable only? (Changing the set is a catalogue change:
   `src/lib/cards.ts` order, then the golden vectors.)
2. **Trades.** A card-for-cards trade is not offered (it needs the buyer's card moved too). Build
   it, or drop trading? The marketplace's own words still say "Buy and trade".
3. **Win-trading on the leaderboard.** Every server-judged match counts, a forfeit after no round
   included. Count only matches with a round played, only distinct opponents a day, or rank by a
   rating instead of wins?
4. **The solo caps.** At most 350 credits and 675 XP a day from solo play. Lower, higher, or none
   (credits from verified play only)?
5. **A market fee.** None now. A fee is a credit sink and makes passing credits between one's own
   accounts cost something.
6. **The day.** Caps reset at 00:00 UTC (the teen limit too, which used the database's day).

## Evidence (2026-11-19, branch fix/server-authority)

- `tests/economy.spec.ts`: sixteen API-level tests, one per way a client could mint, move or claim
  what it should not, against the real API and Postgres the e2e harness starts
  (`tests/start-backend.sh`), read back from the API and the database; and one browser test of the
  signed-in playground (server packs, balance, the device's collection untouched). All pass.
- **The same sixteen fail on c22b035a.** The file was run against that commit's API in a separate
  checkout (iMac Pro). Each failed at the exploit: a named amount paid 1,000 credits and 1,000 XP;
  twelve parallel trivia reports all paid; `POST /stats`, `POST /stats/achievements`,
  `POST /inventory/add` and `POST /migrate/sync` answered 200; a deck with an added Hamlet was
  seated; a card was listed twice and sold free; a teen bought a 250-credit listing; a participant
  named the tournament winner (200); a finished match left no record; the referral reply promised
  packs. In the first baseline run two tests failed for another reason (an unknown source name, and
  a forged room id that the old code answered with a 500), so they were rewritten to play the
  exploit itself and run again; the counts above are from that second run.
- `tests/duel.spec.ts` ("a full match") and `tests/theatre.spec.ts` ("a duel counts as a battle when
  it ends") hold a solo win to a match. On c22b035a both fail at "battle wins after a round" (the
  count was 1 after a round won). The theatre test first used a verse that won no round at its
  seed, which cannot tell rounds from matches; it now plays a verse that keeps each form and
  requires a round won.
- Planted faults, each turning its test red on the build host: the import ignoring its rarity caps,
  online wins always paying, a pack losing its guarantee, a bracket drawn without byes, a finished
  match not handed to the recorder, device cards without a cap, pack weights drifting from the page,
  a solo source with no daily cap.
- `scripts/check-migrations.sh`: against a database where the API had applied main's (3015db55)
  migrations 001-017 (production's state), it lists 018-020 "to be applied" and exits 0; after the
  new API applied them, every one is "same" and it exits 0; with 020 edited after it was applied,
  it reports VersionMismatch and exits 1.
- Full suites on the Studio: `npm ci`; `npx vitest run` 624 passed (4 skipped); `npm run build`;
  `npx playwright test` 360 passed (8 skipped); `cd backend && cargo test --release` 205 passed,
  verse parity included.
