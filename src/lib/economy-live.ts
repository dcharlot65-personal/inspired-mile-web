/**
 * Does play pay? Credits and Season Pass XP for what a player does, and packs sold for credits.
 *
 * In this build nothing does: `earnCredits` (credits.ts) and `addXP` (seasons.ts) have no caller,
 * and no page sells a pack. So the pages that would promise it say nothing of it (owner decision
 * D-03, 2026-11-19: no claim the code does not bear out): the Season Pass shows no XP for play and
 * says play earns none, and the playground's pack odds list no packs for sale. What stays true either
 * way is written once for both: credits are never sold for real money (about, terms, privacy).
 *
 * The one switch. fix/server-authority makes the server pay and sell; when it is merged,
 * src/lib/economy-live.test.ts fails until this is true (it finds the callers), and the pages say it
 * again: the Season Pass intro (`season.intro`) and its XP rates, the playground's pack tiers.
 */
export const ECONOMY_LIVE = false;
