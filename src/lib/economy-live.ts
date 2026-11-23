/**
 * Does play pay? Credits and Season Pass XP for what a player does, and packs sold for credits.
 *
 * Since Deploy 2 (`fix/server-authority`), the server sets every amount and cap (`backend/data/economy.json`):
 * `earnSolo` (`credits.ts`) calls `earnCredits` and `addXP`, and the playground calls `buyPack`.
 * `src/lib/economy-live.test.ts` holds this switch to the code: it is true while the front end calls
 * any of those, so the Season Pass shows `season.intro` and its XP rates, and the playground shows
 * pack tiers. What stays true either way is written once for both: credits are never sold for real
 * money (about, terms, privacy).
 */
export const ECONOMY_LIVE = true;
