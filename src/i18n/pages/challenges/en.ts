/**
 * The quote challenges, in English: built from src/lib/challenges.ts.
 *
 * Keys, per challenge <n> (its index in CHALLENGE_BANK):
 *   challenge.<n>.full       the whole line
 *   challenge.<n>.display    the line with ___ for each missing word
 *   challenge.<n>.missing    the missing words, in order, separated by |
 *   challenge.<n>.play       the work
 *   challenge.<n>.character  who says it
 * and challenges.ids: which challenges this language has, separated by commas.
 *
 * Another language has a challenge only where a published public-domain
 * translation of that line was found; its file also carries
 * challenge.<n>.translator. The rest are left out, never invented
 * (docs/language/CONTENT-PROVENANCE.md lists them). Generated for the other
 * languages by scripts/lang-content/build.mjs.
 */
import { CHALLENGE_BANK } from '../../../lib/challenges';

const messages: Record<string, string> = {
  'challenges.ids': CHALLENGE_BANK.map((_, n) => n).join(','),
};
CHALLENGE_BANK.forEach((c, n) => {
  messages[`challenge.${n}.full`] = c.fullQuote;
  messages[`challenge.${n}.display`] = c.displayQuote;
  messages[`challenge.${n}.missing`] = c.missingWords.join('|');
  messages[`challenge.${n}.play`] = c.play;
  messages[`challenge.${n}.character`] = c.character;
});

export default messages;
