/**
 * The opponent's verse.
 *
 * With a model, the opponent writes in character under the round's form and
 * whatever curse it is under. A small model follows a form loosely, so several
 * candidates are written and the one that scores the most craft, by the same
 * code that scores the player, is the one it plays. Difficulty is the number
 * of candidates.
 *
 * Without a model, verses come from a written bank that keeps each form.
 */
import { getCardById, type Card } from '../cards';
import { CURSES, deviceForHouse } from './devices';
import { rng, scoreVerse, type Duel, type RoundPlan } from './duel';
import { getForm, type Form, type FormContext } from './forms';
import { cleanVerse } from './text';

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', pl: 'Polish', ru: 'Russian',
  ar: 'Arabic', hi: 'Hindi', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', vi: 'Vietnamese', th: 'Thai', id: 'Indonesian',
};

export function languageName(lang: string): string {
  return LANGUAGE_NAMES[lang.split('-')[0]] ?? 'English';
}

export type Difficulty = 'apprentice' | 'player' | 'master';

/** How many candidate verses the opponent writes before choosing. */
export const CANDIDATES: Record<Difficulty, number> = { apprentice: 1, player: 2, master: 3 };

/** Lines the form asks for, used to trim a model that runs on. */
export function expectedLines(form: Form, ctx: FormContext): number {
  if (form.id === 'acrostic') return [...(ctx.acrostic ?? '')].length;
  const m = form.requirements[0].label(ctx).match(/(\d+) lines/);
  return m ? Number(m[1]) : 4;
}

export function opponentMessages(plan: RoundPlan, card: Card, form: Form, lang: string, previousPlayerVerse?: string) {
  const device = deviceForHouse(card.house);
  const rules = [
    `Form: ${form.name}. ${form.brief(plan.ctx)}`,
    `Write exactly ${expectedLines(form, plan.ctx)} lines.`,
    `Your flourish: ${device.brief}`,
  ];
  // The curse the opponent writes under is cast by the player, so it is added by the caller.
  if (plan.opponent.relic?.words.length) rules.push(`Work in at least two of these words: ${plan.opponent.relic.words.join(', ')}.`);
  const user = [
    ...rules,
    previousPlayerVerse ? `Your challenger last said:\n${cleanVerse(previousPlayerVerse)}\nAnswer them.` : 'Open the duel: taunt your challenger.',
    `Write only the verse, in ${languageName(lang)}. No title, no notes, no explanation.`,
  ].join('\n');
  return [
    {
      role: 'system' as const,
      content: `You are ${card.name} in a duel of verses: theatrical, sharp, in character. Your line in the play: "${card.quote}" You write short verse and nothing else.`,
    },
    { role: 'user' as const, content: user },
  ];
}

/** Keep the verse, drop the commentary a small model tends to append. */
export function tidyModelVerse(raw: string, maxLines: number): string {
  const kept: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const l = line
      .replace(/^\s*(?:line\s*)?\d+\s*[:.)\-]\s*/i, '')
      .replace(/^\s*[*_#>`-]+\s*/, '')
      .replace(/[*_`]+/g, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
    if (!l) {
      if (kept.length >= maxLines) break;
      continue;
    }
    // A line that explains itself is not verse.
    if (/^(here|note|this|verse|couplet|haiku|line|first|second|each|\(|\[)/i.test(l) && /:|\bsyllables?\b|\bwords?\b|\brhymes?\b/i.test(l)) continue;
    kept.push(l);
    if (kept.length >= maxLines) break;
  }
  return cleanVerse(kept.join('\n'));
}

export interface WriteOptions {
  duel: Duel;
  roundIndex: number;
  /** Curse the player has cast on the opponent for this round. */
  curse?: { curseId: string; param: string; potionId: string };
  previousPlayerVerse?: string;
  difficulty: Difficulty;
  /** Model call; absent when no model is loaded. */
  generate?: (messages: ReturnType<typeof opponentMessages>, opts: { maxTokens: number; temperature: number }) => Promise<string>;
  /** Called as each draft begins, so the player can see the opponent at work. */
  onDraft?: (draft: number, of: number) => void;
}

export async function writeOpponentVerse(o: WriteOptions): Promise<{ verse: string; source: 'model' | 'written' }> {
  const plan = o.duel.rounds[o.roundIndex];
  const form = getForm(plan.formId);
  const card = getCardById(plan.opponent.charId)!;
  const n = expectedLines(form, plan.ctx);

  if (o.generate) {
    const messages = opponentMessages(plan, card, form, o.duel.lang, o.previousPlayerVerse);
    if (o.curse) {
      const c = CURSES[o.curse.curseId];
      messages[1].content = messages[1].content.replace('\nWrite only the verse', `\nYou are cursed: ${c.brief(o.curse.param)}\nWrite only the verse`);
    }
    let best = { verse: '', craft: -1 };
    for (let i = 0; i < CANDIDATES[o.difficulty]; i++) {
      o.onDraft?.(i + 1, CANDIDATES[o.difficulty]);
      try {
        const raw = await o.generate(messages, { maxTokens: 28 + n * 22, temperature: 0.7 + 0.1 * i });
        const verse = tidyModelVerse(raw, n);
        if (!verse) continue;
        const { craft } = scoreVerse({
          verse, form, ctx: plan.ctx, card, deckCharacters: o.duel.opponent.characters,
          opponentVerse: o.previousPlayerVerse, curse: o.curse, lent: plan.opponent.relic,
        });
        if (craft > best.craft) best = { verse, craft };
      } catch (err) {
        console.error('[opponent] generation failed', err);
      }
    }
    if (best.verse) return { verse: best.verse, source: 'model' };
  }
  return { verse: writtenVerse(form, plan.ctx, o.duel.seed + o.roundIndex), source: 'written' };
}

// --- Written verses, for when no model can run ---

const WRITTEN: Record<string, string[]> = {
  couplet: [
    'Thy rhymes are candles guttering in the night\nMine is the sun, and thou hast lost the light',
    'Step up, poor player, strut thy little hour\nThen watch thy verses wither like a flower',
    'I have heard braver thunder from a mouse\nA plague of silence fall upon thy house',
  ],
  'quatrain-aabb': [
    'Thou comest armed with borrowed, blunted wit\nAnd wonder why no blow of thine has hit\nI have faced kings and fools upon this stage\nThou art the footnote on a missing page',
    'The crowd came here to see a battle fought\nAnd all thy lines are leftovers, cheaply bought\nSo speak again, and louder, if thou dare\nI answer storms; thou art a breath of air',
  ],
  'quatrain-abab': [
    'I walked these boards before thy kind could crawl\nMy lines were law when thine were only noise\nNow hear the curtain and the candle fall\nThe stage has men enough; it wants no boys',
    'Thy verse limps in upon a single leg\nAnd begs the crowd to pity its poor sound\nI will not kick a man who comes to beg\nI simply leave him sitting on the ground',
  ],
  tercet: [
    'Thou hast a tongue, I grant, but not the art\nIt wanders like a drunkard in the dark\nAnd never once arrives at any heart',
    'Call that a verse? I call it a mistake\nA limping line that begs to be put down\nAnd I am kind enough, for mercy’s sake',
  ],
  anaphora: [
    'Never have I heard so much said of so little\nNever has a stage endured so thin a voice\nNever again, I think, will this crowd listen',
    'Speak, and the candles lean away from thee\nSpeak, and the groundlings count the exits\nSpeak, and I shall answer when it matters',
  ],
  crescendo: [
    'Thou art small\nThy verse is smaller still\nAnd I have crushed far greater things than thee before my breakfast',
    'Hear this\nThe stage is mine tonight\nAnd every word that leaves thy mouth is one more nail in thy defeat',
  ],
  haiku: [
    'Thy verse falls like leaves\nNo one stoops to gather them\nThe wind takes them all',
    'A small voice, far off\nI turn my head to hear it\nIt was the wind, friend',
  ],
  'heroic-couplet': [
    'Thy verse is but a shadow on the wall\nMine is the fire that casts it, large and tall',
    'I came to trade in thunder and in flame\nAnd thou hast brought a candle to the game',
  ],
};

const ACROSTIC_LINES: Record<string, string[]> = {
  a: ['And still thou standest, waiting to be beaten', 'All thy lines are borrowed and returned unread'],
  b: ['Bold words, for one so easily undone', 'Bring thy best; I have not started yet'],
  d: ['Down goes thy verse, and no one marks the fall', 'Dare again, and louder, little voice'],
  e: ['Every line of thine has died upon the air', 'Enough: the crowd has made its mind up'],
  f: ['Fools rush to stages wiser men avoid', 'Fear not; this will be over very soon'],
  g: ['Go home, and tell them thou hast met thy better', 'Great talk, small verse: the old, old story'],
  i: ['I have heard better music from a hinge', 'In all my years I never met so weak a rhyme'],
  k: ['Kneel, for the verdict has been spoken', 'Kings have lost to me; what art thou?'],
  l: ['Let the record show thou hadst thy chance', 'Loud is not the same as good, my friend'],
  m: ['My worst line is the equal of thy best', 'Mark this well, for I shall not repeat it'],
  n: ['No crowd has ever sat so still for thee', 'Now hear how verses ought to sound'],
  o: ['Once more thou openest thy mouth in vain', 'Out, out, brief candle of a rhyme'],
  p: ['Poor player, strutting on a borrowed stage', 'Pray silence for a verse that earns it'],
  r: ['Rhyme is a blade, and thou hast brought a spoon', 'Run, while the exits are still open'],
  s: ['So ends the lesson; take it home with thee', 'Small wonder that the crowd has turned away'],
  t: ['Thy tongue is quick, but quickness is not wit', 'Tonight the stage remembers only me'],
  w: ['What was that sound? Ah, thy defeat', 'Words fail thee, as they always will'],
  y: ['Yield now, and keep what pride is left', 'Yet again thy line arrives too late'],
};

export function writtenVerse(form: Form, ctx: FormContext, seed: number): string {
  const r = rng(seed);
  if (form.id === 'acrostic') {
    return [...(ctx.acrostic ?? 'bard')]
      .map((ch) => {
        const bank = ACROSTIC_LINES[ch.toLowerCase()] ?? [`${ch.toUpperCase()}… the rest is silence`];
        return bank[Math.floor(r() * bank.length)];
      })
      .join('\n');
  }
  const bank = WRITTEN[form.id] ?? WRITTEN.couplet;
  return bank[Math.floor(r() * bank.length)];
}
