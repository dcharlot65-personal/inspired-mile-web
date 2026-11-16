/**
 * The opponent's verse.
 *
 * With a model, the opponent writes in character under the round's form and
 * whatever curse it is under. A small model follows a form loosely, so several
 * candidates are written and the one that scores the most craft, by the same
 * code that scores the player, is the one it plays. Difficulty is the number
 * of candidates.
 *
 * Without a model, verses come from a written bank that keeps each form: the
 * language pack of the duel's language (./packs).
 *
 * The prompt to the model is English in every language (it names the language
 * to write in), so forms, devices and curses are rendered with ./english here,
 * not with the page's translations.
 */
import { getCardById, type Card } from '../cards';
import { CURSES, deviceForHouse } from './devices';
import { rng, scoreVerse, type Duel, type RoundPlan } from './duel';
import { en } from './english';
import { acrosticUnits, getForm, type Form, type FormContext } from './forms';
import { getPack } from './packs';
import { cleanVerse, fold } from './text';

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
  return form.lines(ctx);
}

export function opponentMessages(plan: RoundPlan, card: Card, form: Form, lang: string, previousPlayerVerse?: string) {
  const device = deviceForHouse(card.house, lang);
  const rules = [
    `Form: ${en(form.name)}. ${en(form.brief(plan.ctx))}`,
    `Write exactly ${expectedLines(form, plan.ctx)} lines.`,
    `Your flourish: ${en(device.brief(lang))}`,
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
      messages[1].content = messages[1].content.replace('\nWrite only the verse', `\nYou are cursed: ${en(c.brief(o.curse.param, o.duel.lang))}\nWrite only the verse`);
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

/**
 * A verse from the language pack that keeps the form. The pack of ctx.lang
 * must be loaded; a duel in that language cannot have been created otherwise.
 */
export function writtenVerse(form: Form, ctx: FormContext, seed: number): string {
  const r = rng(seed);
  const pack = getPack(ctx.lang);
  if (form.id === 'acrostic') {
    return acrosticUnits(ctx.acrostic ?? pack.acrostic[0], ctx.lang)
      .map((unit) => {
        const bank = pack.acrosticLines[fold(unit)] ?? [`${unit.toUpperCase()}…`];
        return bank[Math.floor(r() * bank.length)];
      })
      .join('\n');
  }
  const bank = pack.written[form.id] ?? Object.values(pack.written)[0];
  return bank[Math.floor(r() * bank.length)];
}
