/**
 * Story mode, in English: the reference for this area.
 *
 * The acts and encounters are written once, in src/lib/story-mode.ts; their keys
 * are built from it here (story.act.<n>.name, story.enc.<id>.narrative, …) so the
 * English cannot drift from the data. Every other language's file spells the same
 * keys out. Shakespeare's own lines inside a narrative stay in English in every
 * language, like the quotations on the cards.
 */
import { ACTS } from '../../../lib/story-mode';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

const messages: Record<string, string> = {
  'story.meta.title': 'Story Mode',
  'story.meta.description': "Journey through Shakespeare's worlds in this single-player campaign.",
  'story.badge': 'Campaign',
  'story.title': 'Story Mode',
  'story.intro': 'Journey through 5 acts across Shakespeare\'s greatest works and uncover the secrets of the Globe. In this version of the game, an encounter opens its scene but starts no duel.',
  'story.journey': 'Your Journey',
  'story.progress': '{done} / {total} encounters completed',
  'story.stars': 'Stars',
  'story.difficulty.easy': 'Easy',
  'story.difficulty.medium': 'Medium',
  'story.difficulty.hard': 'Hard',
};

for (const act of ACTS) {
  messages[`story.act.${act.id}.label`] = `Act ${ROMAN[act.id - 1]}`;
  messages[`story.act.${act.id}.name`] = act.name;
  messages[`story.act.${act.id}.desc`] = act.description;
  for (const e of act.encounters) {
    messages[`story.enc.${e.id}.name`] = e.name;
    messages[`story.enc.${e.id}.desc`] = e.description;
    messages[`story.enc.${e.id}.narrative`] = e.narrative;
  }
}

export default messages;
