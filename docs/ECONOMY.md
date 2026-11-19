# The economy and the rankings: the server is the authority

The owner's decision, 2026-11-19 (the option chosen, in their words): "Before this deploy
(Recommended): Server sets amounts at fixed rates with daily caps. Cards come only from the
server. The leaderboard and tournaments count only matches the server judged. A purchase moves
the credits and the card."

And later the same day (docs/dossier 28-owner-decisions.md, R9 and R10): ship these launch values
as tunable, with the pages moved to the new API, this document, and handler tests of a
two-account purchase and of capped earning; **the marketplace and referrals for adult accounts
only; credits are never sold**.

This document is the rulebook. **Every number in it is tunable**: each lives in one file,
`backend/data/economy.json`, which the API compiles in (`backend/src/economy.rs`) and the pages
import (`src/lib/economy-rules.ts`). Change the file, rebuild the API and the site, and both follow;
`src/lib/economy-rules.test.ts` and `cargo test` hold the places that still print a number of their
own (the playground's pack lines, the about page, the season page, the price error) to it. The two
rules that are code, not numbers in the file, say so where they are given (the season's level
curve, and the per-opponent cap the leaderboard shares with the online-win credits).

## Credits are never sold for money

Credits are earned by playing and spent on packs and in the market. **They are never sold for
money**, and neither are packs, cards or a season pass: nothing on the site takes a payment, and no
route the API has can turn money into credits. A pack bought with credits is bought with what play
earned. This is a commitment, not an accident of what is built: selling credits, packs or any random
item for money would make the packs paid loot boxes and the market a place where play turns into
money, and either needs the owner's new decision first. (A premium season reward is recorded in the
schema and never granted: nothing sells premium.)

## The principles, and where each is enforced

1. **The server decides every amount.** A request that names an amount (`amount`, `price`) is
   refused with 400 ("Amounts are set by the server"). Solo play happens in the browser, where the
   server cannot see it: what it earns is a fixed amount per source, at most so many times a day
   per account and source, every payment logged in `credit_transactions` (credits) or
   `xp_transactions` (season XP), and the caps counted from those logs. Solo results never feed the
   public leaderboard, rankings or tournaments. (`credits/handlers.rs earn_credits`,
   `seasons/handlers.rs add_xp`, `ledger.rs credit_capped`, `xp_capped`.)
2. **Rankings come only from matches the server judged.** Every finished online match is stored
   (`battle_rooms`, written by `multiplayer/results.rs`); the public leaderboard, an account's
   online record (`GET /stats`), account achievements and tournament results are read from those
   rows and nothing else. A win is a match, not a round.
3. **Cards come only from the server**: the starter characters, packs the server opens with its
   own randomness and paid in credits, free packs it grants, season rewards, the market, and a
   one-time capped import of a device's collection. Online play fields only cards the account holds
   on the server (the starter characters count; a card on sale does not).
4. **Achievements the server cannot verify stay on the device.** The device keeps all thirty
   (`src/lib/achievements.ts`), worked out from what that browser saw, and never posts them. The
   account's achievements are the eighteen the server can work out from its own records
   (`account_achievements` in the file): online wins (ranked wins, below), matches, rounds and best
   round; different cards held, not counting cards brought over from a device; packs opened.
5. **A market purchase is one transaction**: an active listing that is not the buyer's own, the
   buyer's balance checked, the price moved from buyer to seller (both logged), and the very card
   moved to the buyer. A listed card is locked. The market is for adult accounts only.

"A day" is the UTC calendar day, for every cap and for the teen spending limit (it was the
database's `CURRENT_DATE` before). The daily free pack is the one exception: once in every 24
hours, as the playground has always said. Why UTC: one boundary for every player, whatever the
database server's own time zone (the build hosts' databases run on America/New_York; the
checker found the caps follow the UTC day there all the same), so a cap cannot be reset by the
server moving.

Every economy write locks the account first (`ledger::lock_account`: its `player_stats` row,
`FOR UPDATE`), so requests sent at once cannot pass a cap, a balance or a once-only check together;
a purchase locks both accounts in a fixed order. Taking a seat in an online room with cards that are
not starter characters takes the same lock (`multiplayer/handlers.rs`), so a card is never seated
and listed at the same moment.

## Rates and caps (all tunable)

### Solo play (the server cannot see it)

| Source (`source`) | Credits | Per day | XP | Per day | Why |
|---|---|---|---|---|---|
| `solo_win`: a solo duel won | 50 | 3 | 100 | 3 | The About page has promised +50 for a battle won and the season page 100 XP; three a day is an evening's play, and all a script can claim too |
| `trivia`: a trivia round passed (3 of 5) | 30 | 3 | 50 | 3 | The About page's +30; trivia is quick, so the cap is low |
| `challenge`: a quote challenge solved | 20 | 5 | 40 | 5 | The About page's +20; shorter still, so a few more |
| `daily`: the daily bonus | 10 | 1 | 25 | 1 | Once a day per account, asked for by the page on a signed-in visit |

A fully scripted account therefore earns at most 350 credits (seven standard packs) and 675 XP a
day from solo play. That is the price of not seeing solo play: it is bounded, not verified. Kept at
launch (decided 2026-11-19): lower caps would cut honest players' earnings to stop a script that
gains seven standard packs a day and no place on any ranking; credits from verified play only would
leave a solo player, the game's main audience, earning nothing.

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
are what the playground has shown since before this change. Packs are bought with earned credits
only (above: credits are never sold).

### The one-time import of a device's collection

When an account signs in on a device that holds cards from playing signed out, the page offers to
move them. The server takes one copy of each different card, the rarest first, at most
**20 cards**, of which at most **1 Legendary, 2 Epic and 5 Rare**; starter characters are not taken
(every account holds them already); unknown ids are left out; a card id that is not 1 to 16
characters of letters, digits and dashes is a 400. Stats, achievements and world-card variants
stay on the device.

- **Once per account, on the server** (`migration_log`; a second import is a 409, and five sent at
  once give one 200 and four 409s).
- **Offered once per device, by the page** (`src/lib/import-offer.ts`): once a device's cards have
  gone to an account, that device does not offer them to any account again, and an account that
  chose "Skip" is not asked again on that device. Until the second check of 2026-11-19 the banner
  came back on every sign-in, and every account signed in on one device was offered the same cards.
  This is the page's courtesy, not a guard: a device's storage is the visitor's to edit.
- **Cards brought over cannot be sold** (`import.sellable: false`; `marketplace/handlers.rs`,
  "Cards brought over from a device cannot be sold"), and they earn no account achievement. They
  can be fielded online by the account that brought them.

Why these caps: a device's collection is whatever its browser storage says, so the import is the
most a forged collection can bring to one account. Twenty cards is about what an honest player
collects signed out in two weeks (a starter pack, fourteen daily packs and a few duel wins); twenty
honest draws hold 0.2 Legendary, 0.8 Epic and 3 Rare on average, so the rarity caps let a lucky
honest player keep their luck and hold one account's forgery to one Legendary, two Epics and five
Rares of its choosing. Why imported cards cannot be sold: sign-ups are free, so a forged collection
taken into many throwaway accounts and sold on for a credit each would gather any card, every
Legendary included, into one account (the checker did it with three accounts and fourteen credits,
second check of 2026-11-19). Bound to the account that brought them, a forgery reaches no one else.
Why not import nothing above Uncommon instead: it would take an honest player's rare luck away to
stop what the binding already stops.

### The market (adult accounts only)

| Rule | Value | Why |
|---|---|---|
| Who | adult accounts only (`users.age_tier = 'adult'`); a teen account, or one whose age is unknown, can neither browse, see a listing, list nor buy (403 "For adult accounts only"); it can still see and cancel its own listings | Owner, 2026-11-19 (R10). The market shows strangers' usernames and lets them trade with a child's account: what a children's privacy review looks at first |
| Price | 1 to 100,000 credits | As before |
| Fee | none | Decided 2026-11-19: with credits never sold and the market for adults only, a fee would tax honest sellers and only slow, not stop, one person moving solo-capped earnings between their own accounts. Revisit if balances show funnelling |
| Listings | sales only | A trade (card for cards) needs the buyer's card moved too. Decided 2026-11-19: trades are dropped, and the page's words no longer offer them ("Buy cards from other players and sell the ones you can spare") |
| What can be listed | a card the account holds on the server, has not listed, did not bring over from a device, and is not fielding | A listing locks that very row (`owned_cards.state = 'listed'`); the starter characters are no rows and cannot be sold |
| A card in a match | the last copy of a card the seller has brought to a room that has not ended (seated and waiting, or playing) cannot be listed (409 "This card is in a match") | Until the second check of 2026-11-19 a seated card could be sold during its match while its seller still played it. `join_room` checks a deck once, so the listing checks the rooms (`RoomManager::cards_fielded_by`) under the account lock the seat is taken under |
| While listed | the card cannot be listed again, sold elsewhere or fielded online | One copy, one listing (`card_listings_one_active_per_card`) |
| Cancel | unlocks the card | |
| A seller no longer adult | the listing is not shown and cannot be bought | An account made teen keeps its listings until it cancels them |

A listing from before this change (no `owned_card_id`) is not shown and cannot be bought. The
pages hide the market from every account that is not an adult one (`src/lib/adults-only.ts`: the
account's own tier, sent with `/auth/me`; signed out, the age gate's answer on the device): the
navigation's links and the page itself, which then says "The market is for adult accounts only."
and asks the server nothing.

### Referrals (adult accounts only)

| Rule | Value | Why |
|---|---|---|
| Who | only an adult account gets a code (`GET /referral`) or redeems one (`POST /referral/redeem`); a referrer whose account is no longer adult is not paid | Owner, 2026-11-19 (R10), as for the market |
| The referrer | 100 credits, at most 3 times a day | Logged as `referral`; new accounts redeeming one code are not a source of unlimited credits |
| The redeemer | nothing | The reply promised "5 free packs" and granted none; the words now say what is granted (`packs_granted` is 0) |

No page offers referrals today (`src/lib/referral.ts` is used by none), so there is nothing to hide;
a page that offers them must show them only where `adultsOnlyShown()` says so.

### Other

| Rule | Value | Why |
|---|---|---|
| Teen daily spending | 200 credits | Unchanged; every spend counts (packs; the market is closed to teen accounts) |
| Founding credits | an account created before `LAUNCH_DATE` is brought up to 500 once, logged | It was a refill on every `/auth/me`, unlogged. No account can qualify now (production had none) |
| Season rewards | claimed by each player once: credits (logged), a pack the server opens, or a card; a title is recorded, nothing shows titles; a premium reward is not granted (nothing sells premium) | `claimed` was one flag for everyone, and only credits granted anything |
| Season levels | level 1 from 0 XP, level n from n × 200 XP (400 for level 2, 600 for level 3), up to the season's top level | Code, not the file (`ledger.rs xp_for_level`). The season page's bar now draws the same curve (`seasons.ts xpForLevel`); until 2026-11-19 it assumed (n − 1) × 200 |

## The starter set and the Sonnet Man

Every account holds the starter characters, The Sonnet Man (`SM-001`, Legendary), Romeo and
Juliet, without a row: the first three characters of the catalogue, as both engines already
define them (`starter_characters()`, `ONLINE_STARTER`, `starterDeck([])`). They are the solo
starter deck and the free online deck. They cannot be listed for sale.

Decided 2026-11-19: the Sonnet Man stays a free starter character. Under "cards come only from the
server" a free card is a card the server gives to everyone alike, so it gives no account an edge
online, and the game is named after him. A Sonnet Man drawn from a pack is an ordinary card that can
be sold. Whether the game may use Devon Glover's persona at all is not an economy question: it is the
agreement in the dossier's D-13 (and R8 keeps the card out of the AI opponent's hand until then).

## Rankings, tournaments and achievements

- **The leaderboard** (`GET /stats/leaderboard`, public): accounts with at least one ranked win,
  ranked by ranked wins, then best round, then fewer matches. **A ranked win** is a win over an
  opponent counted at most 3 times in a UTC day (`online.win_credits_per_opponent_per_day`, the same
  count that pays credits; `stats/handlers.rs ranked_wins!`). Decided 2026-11-19 against
  win-trading: two accounts playing each other and one forfeiting climb three places a day, not one
  per forfeit. A rating would be better and is not built. The field names are the old ones, so a
  cached page still draws it: `battle_wins` is ranked wins, `total_battles` matches finished,
  `highest_score` the best total of one round.
- **An account's record** (`GET /stats`): every online win, loss and draw, matches, rounds and best
  round; cards held and packs opened on the server; the balance. `POST /stats` is gone.
- **Account achievements** (`GET /stats/achievements`): worked out when asked, from the records
  above (wins are ranked wins; cards leave out those brought over from a device), and stamped the
  first time they are seen. `POST /stats/achievements` is gone.
- **Tournaments**: a match is played in a room either player opens
  (`POST /tournaments/{id}/matches/{match_id}/room`; the same room for both while it is live; the
  first to arrive waits up to four minutes for the other). Only that room's result, stored by the
  server, decides the match; `tournament_matches.room_id` points at its `battle_rooms` row (it
  pointed at a table nothing wrote). `POST .../complete` is gone. Byes go through when the bracket is
  drawn, and the bracket makes no empty first-round match. `max_players` is 2 to 64; a description
  at most 1,000 characters.
  - **Single elimination**: the loser is out and the winner goes on to the next round's match, up
    to the final; a drawn match is played again. The final is the round where the first round has
    folded down to one match (`progress.rs final_round`: with f first-round matches, round
    log2(f) + 1). Until the second check of 2026-11-19 any round with only one match so far was
    taken for the final, so with six players the byes' round-two match, played before the other
    half of round one, crowned its winner, and the real final waited for ever with one player.
  - **Round robin**: every pairing is played once; a draw stands.
  - **Deadlines** (`tournaments.match_hours`: 48): a match is to be played within 48 hours of both
    its players being known (a round robin's round r within r × 48 hours of the draw, so its rounds
    come one after another); the bracket shows the time. Past it, with no result and no room open
    for it, the scheduler decides it (`progress.rs decide_overdue`, every `TOURNAMENT_CHECK_SECONDS`):
    a player who sat ready in the match's room until its time to arrive ran out while the other never
    came goes through (`decided_by = 'no_show'`); if both or neither did, a single-elimination match
    goes to a player the server draws by lot (`'lot'`), and a round-robin match stands unplayed
    (`'unplayed'`). Why: until then a player who never came stopped a tournament for good (the room
    closed and recorded nothing). Why 48 hours: two evenings, in any time zone. Why a lot rather than
    putting both out: a bracket needs somebody in the next round. The room is opened, and the match
    decided, under the same row locks, so a room opened at that moment is either seen (and the match
    waits for it) or finds the match decided. A match being played is never decided by the clock.
  - `decided_by` records how each match was decided: `room`, `bye`, `no_show`, `lot`, `unplayed`.
- A match's result is handed to the recorder once, when the room ends it. If the database cannot
  take it, it is tried four times and then logged in full, at error level, for an operator to
  enter; a crash between the end of a match and its write loses it (the room lives in memory). For a
  tournament match, the deadline then decides it. The verses are never stored.

## What this does not stop

- **Solo earnings are bounded, not verified.** A script can claim every solo cap every day.
- **Many accounts.** Each account can earn the solo caps, import 20 cards it cannot sell, and redeem
  one code. Sign-ups are limited per network (40 an hour per /24 or /48, `auth/passkeys.rs`), not per
  person. Adult accounts can still move solo-capped credits, and cards drawn from packs, to one
  another through market sales at any price; with no fee, that is limited only by what the solo caps
  pay each account.
- **Win-trading** with many accounts: each pair of accounts climbs three ranked wins a day.
- **The age tier is self-declared**: an adult-only rule keeps out the accounts that said they are
  not adults (`auth/age.rs`).

## Routes changed (the contracts)

| Route | Now |
|---|---|
| `POST /credits/earn` | `{ source }` only; `amount` is a 400; answers `{ credits, granted, source, earned_today, per_day }` (granted 0 past the cap) |
| `POST /credits/spend` | gone |
| `POST /seasons/xp` | `{ source }` only (the solo sources); `amount` is a 400 |
| `GET /seasons/rewards`, `POST /seasons/claim/{level}` | `claimed` is the player's own; a claim grants its reward in the same transaction |
| `GET /inventory` | each row has `listed` and `source` |
| `POST /inventory/add` | gone |
| `GET /inventory/status` | new: starter claimed, daily available, next daily, balance, starter characters |
| `POST /inventory/claim` | new: `{ kind: "starter" \| "daily" }`; 409 once taken |
| `POST /inventory/packs` | new: `{ tier }`; `price` is a 400 |
| `POST /migrate/sync` | gone |
| `POST /migrate/import` | new: `{ cards: [card ids] }`; once (409 after); `GET /migrate/status` gives `max_cards` |
| `POST /variants/unlock` | gone (world-card variants are the device's) |
| `GET /stats` | the server's record (shape above); `POST /stats` and `POST /stats/achievements` gone |
| `GET /stats/leaderboard` | ranked wins (above) |
| `GET /auth/me` (and every answer with a `user`) | `user.age_tier`: `adult`, `teen` or `unknown` |
| `GET /marketplace`, `GET /marketplace/{id}`, `POST /marketplace/list`, `POST /marketplace/{id}/buy` | adult accounts only (403 "For adult accounts only"); `GET /marketplace/my` and cancel stay open to the seller |
| `POST /marketplace/list` | sales only, price required, a catalogue card id; 400 "Cards brought over from a device cannot be sold"; 409 "This card is in a match" |
| `POST /marketplace/{id}/buy` | moves the price and the card; answers `{ status, card_id, price, credits }` |
| `GET /referral`, `POST /referral/redeem` | adult accounts only (403); `packs_granted` is 0; `referrer_credits` says what the referrer got |
| `POST /tournaments/{id}/matches/{match_id}/complete` | gone |
| `POST /tournaments/{id}/matches/{match_id}/room` | new: `{ room_id }` |
| `GET /tournaments/{id}/bracket` | each match has `play_by` and `decided_by` |

`src/lib/api-routes.test.ts` reads every request the pages make and every route the routers define,
and fails on a request no route answers (a removed route, or a removed method of a route that
stays).

Database: migration `020_server_authority.sql` (adds only): result columns on `battle_rooms`,
`card_listings.owned_card_id` with one active listing per card, `pack_claims`,
`season_reward_claims`, `xp_transactions`, and indexes for the daily counts. Migration
`021_tournament_deadlines.sql` (adds only): `tournament_matches.play_by`, `waited_1`, `waited_2`,
`decided_by`, and an index for the scheduler's look. Settings: `TOURNAMENT_CHECK_SECONDS` (default
30; the e2e harness sets 1); `TOURNAMENT_ARRIVAL_SECONDS` (tests only: it can only shorten the 240 s
a tournament room waits; the harness sets 5 on its email-off API). Neither is needed in production.

## Decisions taken in the fix pass (2026-11-19)

The owner's standing rule is that decisions not needing their money, identity or a legal commitment
are taken under the project's rules and said. Each is above, with its reason; in short:

1. The Sonnet Man stays a free, unsellable starter character (the persona question is D-13's).
2. Trades are dropped; the market sells only, and its words say so.
3. The leaderboard counts ranked wins: three a day over one opponent.
4. The solo caps stay at 350 credits and 675 XP a day.
5. The market takes no fee.
6. The day is the UTC day.
7. Imported cards cannot be sold and earn no achievement; the caps stay 20 / 1 / 2 / 5.
8. A tournament match has 48 hours; then a no-show loses, else the lot decides (round robin:
   unplayed).

## Evidence

Everything here ran on the build hosts through `rb` (`tests/start-backend.sh`: a throwaway Postgres
and two copies of the real API). Nothing is mocked in `tests/economy.spec.ts`.

### The owner's two handler tests (D-05)

- **A two-account purchase moves the credits and the card**: `market: a purchase moves the credits
  and the card` (seller and buyer are two accounts; the buyer pays 40 and holds the very card, the
  seller is paid 40 and no longer holds it, both movements logged), with `two buyers at once` and
  `the last copy of a card seated in a room cannot be listed`.
- **Capped earning**: `credits: a client cannot name its amount; each solo source pays a fixed amount
  up to its daily cap` and `credits: requests sent at once cannot pass a daily cap together` (twelve
  parallel trivia reports pay three), with the XP and online-win caps beside them.
- On c22b035a, the branch's base, every one of the 27 tests of `tests/economy.spec.ts` fails (Mac
  Studio, 2026-11-19): a named amount was paid (`{"credits":1000}`), twelve parallel trivia reports
  paid 360 credits where three should pay 90, and one card was listed twice (where the first pass's
  run of the same test also found the purchase moving no credits and copying the card).

### The second check of 2026-11-19 (check:trust#1)

Each blocker and concern has a test that fails on 2bb3dc9b, the head that check refused, at the
exploit itself (run on the iMac Pro, `tests/economy.spec.ts` of this branch against that commit's
API: 10 failed, 17 passed):

| Test | On 2bb3dc9b |
|---|---|
| a bracket of six where the two byes play first still reaches its final | the final came out `[null, p2, pending]` |
| a match nobody plays is decided at its deadline | the match stayed `pending` |
| a player who waited for an opponent who never came wins the match at its deadline | the room never reported the absent opponent |
| a device's cards brought into a free account cannot be sold | the imported Legendary was listed (200) |
| the last copy of a card seated in a room cannot be listed until its match is over | the seated card was listed (200) |
| market and referrals: adult accounts only | a teen account browsed the market (200) |
| rankings: ... the leaderboard counts three wins a day over one opponent | four |
| a teen account is shown no market | `/auth/me` sent no age tier |
| the tournaments page shows how many players have registered | "Players: 0 of 8" |
| tournaments: the match is decided by the room (now also `decided_by: room`) | no `decided_by` |

The own-listing refusal (`nobody buys their own`) passed on 2bb3dc9b, as it should: the rule was
there; the test failed to notice its removal (planted fault F1 of that check). The seller now holds
credits, so the 400 can only be that rule: with the rule removed again, the test fails 3 of 3 (the
seller's own purchase answered 200).

The sign-up tests that counted the whole `users` table (`a sign-up challenge that has expired creates
nothing`, `forty accounts an hour for one /24`) failed 3 of 4 on 2bb3dc9b with `--repeat-each=2
--workers=4` (counts off by one or two: other workers' accounts); they now count their own accounts,
and the same command passes 4 of 4 at this branch's head.

### The pages call no removed route (R9)

`src/lib/api-routes.test.ts`, run on 3fa2c384 (the commit where the API had moved and the pages had
not), lists the seven removed routes the pages still called there: `POST /inventory/add`,
`/variants/unlock`, `/stats`, `/stats/achievements`, `/migrate/sync`, `/credits/spend` (credits.ts,
written as `${API_BASE}/api/v1/credits/spend`, which the first version of the scan missed) and
`/tournaments/{id}/matches/{id}/complete`. At this branch's head it finds none.

### Planted faults

Each turned its test red (build host, a throwaway worktree): the final taken one round early
(`final_round`), a tournament no-show not reported, no card counted as fielded (the three Rust unit
tests); imported cards offered for sale, the gate deciding for a signed-in teen account, the season
bar's old curve, the device offering its cards again after they went to an account, and a page
calling `POST /credits/spend` (the five unit tests in `economy-rules.test.ts` and
`api-routes.test.ts`); the own-listing rule removed (above).

### Migrations

`scripts/check-migrations.sh` on the iMac Pro, against a throwaway database where this branch's API
had applied only 001-017 (production's state; those files are byte for byte main's, 3015db55): 001-017
"same", 018-021 "to be applied", exit 0. After the API applied the rest: all 21 "same", exit 0. With
021 edited after it was applied: "CHANGED ... VersionMismatch", exit 1. Migration 021 adds four
nullable columns and an index, nothing else.

### Full suites

At this branch's head (ports 47491-47495, `E2E_TIMEOUT=90000`), on build hosts loaded far past
their cores by other sessions (the Studio at 125 to 235 on 32 cores, the iMac Pro at 50 to 180 on 20):

- `cd backend && cargo test --release`: 209 passed (57 + 144 + 8 parity), on the iMac Pro and on
  the Studio.
- `npm ci` and `npm run build`: exit 0 on both.
- `npx playwright test`: Studio 369 passed, 8 skipped, 1 failed; iMac Pro 368 passed, 8 skipped, 2
  failed. Each failure is a test this branch does not change, failed by the host's speed, and passed
  when run again alone: the IPv6 flood (`auth.spec.ts:2309`) took 322 s on the Studio, longer than a
  sign-in challenge lives, so twice the 300 got in; alone on the iMac Pro, 31 s and exactly 300. The passkey offer
  (`auth.spec.ts:719`, a 5 s wait) and the VR page in sixteen languages (`pages-rest.spec.ts:151`, a
  240 s page load): alone on the Studio, with `--repeat-each=2`, all pass. `tests/economy.spec.ts`
  alone on the iMac Pro: 27 of 27.
- `npx vitest run`: never clean in one whole run on these hosts. Whole runs gave 625 to 628 passed
  of 635 (4 skipped), each with 3 to 6 tests over their time limits, different ones each run, all in
  language and engine files this branch does not touch (`quality`, `accidents`, `findings`, `review`,
  `review3`, `review5`, `verse`, `play-areas`, `model-eval`). Every one of them passed in another run:
  six alone on the Studio (quality, accidents, findings, review, review5, verse), `review3` and
  `play-areas` alone on the iMac Pro, and `model-eval` in both whole runs. Every test this branch
  added or changed passed in every run, whole or alone.
