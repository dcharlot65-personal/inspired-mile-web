/**
 * The English rule for names that are ordinary words, shared by devices.ts (the English invocation) and echo.ts (the
 * same rule in the other languages: a character English calls on only in a phrase is called on only in a phrase there too).
 */

/** Parts of a character's name that are ordinary words: said alone they name nobody. */
export const ORDINARY_NAME_PARTS = new Set(['the', 'man', 'sonnet', 'nurse', 'bottom']);
/** How a character whose whole name is an ordinary word is called on. */
export const NAME_PHRASES: Record<string, string[]> = { Bottom: ['Nick Bottom', 'Bully Bottom', 'Bottom the weaver'] };
