/**
 * Replaying a writing cell of the model evaluation (docs/language/MODEL-EVAL.md) with the code
 * as it is now. Test support only: nothing in the game imports this.
 *
 * A play in a cell stores every draft the model wrote, raw. Everything the game then did with a
 * draft is pure code: the prompt it was written to, the tidy-up, the score, which draft the
 * opponent played. replayPlay runs that code again, through writeOpponentVerse itself, with a
 * `generate` that hands back the stored drafts in order instead of calling a model.
 */
import { getCardById } from './cards';
import { createDuel, scoreVerse, starterDeck } from './verse/duel';
import { getForm } from './verse/forms';
import { expectedLines, tidyModelVerse, writeOpponentVerse, type Difficulty } from './verse/opponent';
import { linesOf } from './verse/text';

export interface StoredDraft { raw: string; tidy: string; formKept: boolean; formEarned: number; craft: number; [k: string]: unknown }
export interface StoredPlay {
  seed: number; roundIndex: number; formId: string; difficulty: Difficulty; answering: string | null; prompt: string[];
  verse: string; source: string; lines: number; formKept: boolean; formEarned: number; craft: number;
  checks: { id: string; met: boolean; detail?: unknown }[]; deviceMet: boolean; signatureMet: boolean;
  drafts: StoredDraft[]; [k: string]: unknown;
}

/**
 * The game loads a language's sound data (rhyme and syllables by pronunciation) beside its pack
 * before a duel, once the phonetics work (branch lang/phonetics, src/lib/verse/sound/) is in: the
 * forms a duel draws and how a verse scores depend on it. Where that module exists the replay
 * loads it too, so it scores as the game does; where it does not, the pattern matches nothing and
 * nothing is loaded.
 */
const soundModules = import.meta.glob<{ loadSound: (lang: string) => Promise<boolean> }>('./verse/sound/index.ts');
export async function loadSoundIfAny(lang: string): Promise<boolean> {
  let all = true;
  for (const load of Object.values(soundModules)) all = (await (await load()).loadSound(lang)) && all;
  return all;
}

/** The fields of a play that follow from the code, for comparing a stored play with its replay. */
export function scoredFields(p: StoredPlay) {
  return {
    verse: p.verse, source: p.source, lines: p.lines, formKept: p.formKept, formEarned: p.formEarned, craft: p.craft,
    checks: p.checks.map((c) => ({ id: c.id, met: c.met })), deviceMet: p.deviceMet, signatureMet: p.signatureMet,
    drafts: p.drafts.map((d) => ({ tidy: d.tidy ?? '', formKept: d.formKept, formEarned: d.formEarned, craft: d.craft })),
  };
}

/**
 * The play as the current code makes it from the stored drafts. `prompt` is what the model would
 * be asked now: when it differs from the stored one, the drafts answer another question and the
 * play cannot be replayed, only written again by the model.
 */
export async function replayPlay(lang: string, p: StoredPlay): Promise<{ prompt: string[] | null; drawn: string; play: StoredPlay }> {
  if (!(await loadSoundIfAny(lang))) throw new Error(`the sound data for ${lang} did not load: a replay without it would not score as the game does`);
  const duel = createDuel(p.seed, lang, starterDeck());
  const plan = duel.rounds[p.roundIndex];
  const form = getForm(plan.formId);
  const card = getCardById(plan.opponent.charId)!;
  const n = expectedLines(form, plan.ctx);
  const previous = p.answering ?? undefined;
  const score = (verse: string) => scoreVerse({ verse, form, ctx: plan.ctx, card, deckCharacters: duel.opponent.characters, opponentVerse: previous, lent: plan.opponent.relic });
  let prompt: string[] | null = null;
  let next = 0;
  const written = await writeOpponentVerse({
    duel, roundIndex: p.roundIndex, difficulty: p.difficulty, previousPlayerVerse: previous,
    // A draft the run lost to an error left nothing stored; an empty answer is skipped the same way.
    generate: async (messages) => { prompt ??= messages.map((m) => m.content); return next < p.drafts.length ? p.drafts[next++].raw : ''; },
  });
  const drafts = p.drafts.map((d) => {
    const tidy = tidyModelVerse(d.raw, n);
    const s = tidy ? score(tidy) : null;
    return { ...d, tidy, formKept: !!s?.form.kept, formEarned: s?.form.earned ?? 0, craft: s?.craft ?? 0 };
  });
  const s = score(written.verse);
  return {
    prompt,
    drawn: plan.formId,
    play: {
      ...p, verse: written.verse, source: written.source, lines: linesOf(written.verse).length,
      formKept: s.form.kept, formEarned: s.form.earned, checks: s.form.checks.map((c) => ({ id: c.id, met: c.met, detail: c.detail })),
      deviceMet: s.device.met, signatureMet: s.signature.met, craft: s.craft, drafts,
    },
  };
}
