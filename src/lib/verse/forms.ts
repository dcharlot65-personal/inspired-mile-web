/**
 * Verse forms. Each round of a duel is fought under one form, and whether a
 * verse keeps the form is decided here by code, never by the model.
 *
 * A form is a list of requirements worth points; a full form is worth
 * FORM_POINTS. Partial credit is deliberate: a near miss still scores.
 */
import { firstWord, initial, lastWord, linesOf, rhymes, syllablesInLine, wordsOf } from './text';

export const FORM_POINTS = 20;

export interface CheckResult {
  id: string;
  label: string;
  points: number;
  earned: number;
  met: boolean;
  detail: string;
}

export interface FormContext {
  /** Language of the verse, as a BCP 47 tag. */
  lang: string;
  /** Word an acrostic must spell, when the form needs one. */
  acrostic?: string;
}

interface Requirement {
  id: string;
  label: (ctx: FormContext) => string;
  points: number;
  check: (lines: string[], ctx: FormContext) => { met: boolean; detail: string };
}

export interface Form {
  id: string;
  name: string;
  /** One sentence shown to the player before they write. */
  brief: (ctx: FormContext) => string;
  /** Needs syllable counting, so only offered where we can count. */
  needsSyllables?: boolean;
  requirements: Requirement[];
}

function lineCount(n: number): Requirement {
  return {
    id: 'lines',
    label: () => `Exactly ${n} lines`,
    points: 6,
    check: (lines) => ({ met: lines.length === n, detail: `${lines.length} of ${n} lines` }),
  };
}

function rhymePair(a: number, b: number, points: number): Requirement {
  return {
    id: `rhyme-${a + 1}-${b + 1}`,
    label: () => `Lines ${a + 1} and ${b + 1} rhyme`,
    points,
    check: (lines) => {
      if (lines.length <= Math.max(a, b)) return { met: false, detail: 'line missing' };
      const wa = lastWord(lines[a]);
      const wb = lastWord(lines[b]);
      return { met: rhymes(wa, wb), detail: `"${wa}" / "${wb}"` };
    },
  };
}

function syllables(index: number, target: number, tolerance: number, points: number): Requirement {
  return {
    id: `syllables-${index + 1}`,
    label: () => (tolerance ? `Line ${index + 1}: about ${target} syllables` : `Line ${index + 1}: ${target} syllables`),
    points,
    check: (lines, ctx) => {
      if (lines.length <= index) return { met: false, detail: 'line missing' };
      const n = syllablesInLine(lines[index], ctx.lang);
      if (n === null) return { met: false, detail: 'cannot count this script' };
      return { met: Math.abs(n - target) <= tolerance, detail: `${n} syllables` };
    },
  };
}

export const FORMS: Form[] = [
  {
    id: 'couplet',
    name: 'Couplet',
    brief: () => 'Two lines that rhyme.',
    requirements: [lineCount(2), rhymePair(0, 1, 14)],
  },
  {
    id: 'quatrain-aabb',
    name: 'Paired Quatrain',
    brief: () => 'Four lines: the first two rhyme, and the last two rhyme.',
    requirements: [lineCount(4), rhymePair(0, 1, 7), rhymePair(2, 3, 7)],
  },
  {
    id: 'quatrain-abab',
    name: 'Crossed Quatrain',
    brief: () => 'Four lines: line 1 rhymes with 3, line 2 with 4.',
    requirements: [lineCount(4), rhymePair(0, 2, 7), rhymePair(1, 3, 7)],
  },
  {
    id: 'tercet',
    name: 'Tercet',
    brief: () => 'Three lines; the first and last rhyme.',
    requirements: [lineCount(3), rhymePair(0, 2, 14)],
  },
  {
    id: 'anaphora',
    name: 'Anaphora',
    brief: () => 'Three lines that all begin with the same word.',
    requirements: [
      lineCount(3),
      {
        id: 'same-opening',
        label: () => 'Every line opens with the same word',
        points: 14,
        check: (lines) => {
          const firsts = lines.map(firstWord);
          const met = lines.length >= 2 && firsts.every((w) => w && w === firsts[0]);
          return { met, detail: firsts.map((w) => `"${w}"`).join(', ') };
        },
      },
    ],
  },
  {
    id: 'acrostic',
    name: 'Acrostic',
    brief: (ctx) => `One line per letter: the first letters must spell ${(ctx.acrostic ?? '').toUpperCase()}.`,
    requirements: [
      {
        id: 'lines',
        label: (ctx) => `Exactly ${[...(ctx.acrostic ?? '')].length} lines`,
        points: 6,
        check: (lines, ctx) => {
          const n = [...(ctx.acrostic ?? '')].length;
          return { met: lines.length === n, detail: `${lines.length} of ${n} lines` };
        },
      },
      {
        id: 'spells',
        label: (ctx) => `First letters spell ${(ctx.acrostic ?? '').toUpperCase()}`,
        points: 14,
        check: (lines, ctx) => {
          const want = [...(ctx.acrostic ?? '')].map((c) => initial(c)).join('');
          const got = lines.map((l) => initial(firstWord(l))).join('');
          return { met: want.length > 0 && got === want, detail: `spells "${got.toUpperCase()}"` };
        },
      },
    ],
  },
  {
    id: 'crescendo',
    name: 'Crescendo',
    brief: () => 'Three lines, each longer than the one before.',
    requirements: [
      lineCount(3),
      {
        id: 'growing',
        label: () => 'Each line has more words than the last',
        points: 14,
        check: (lines) => {
          const counts = lines.map((l) => wordsOf(l).length);
          const met = counts.length >= 2 && counts.every((c, i) => i === 0 || c > counts[i - 1]);
          return { met, detail: `${counts.join(', ')} words` };
        },
      },
    ],
  },
  {
    id: 'haiku',
    name: 'Haiku',
    needsSyllables: true,
    brief: () => 'Three lines of 5, 7 and 5 syllables.',
    requirements: [
      { ...lineCount(3), points: 5 },
      syllables(0, 5, 0, 5),
      syllables(1, 7, 0, 5),
      syllables(2, 5, 0, 5),
    ],
  },
  {
    id: 'heroic-couplet',
    name: 'Heroic Couplet',
    needsSyllables: true,
    brief: () => 'Two rhyming lines of about ten syllables each, as Shakespeare closed his sonnets.',
    requirements: [{ ...lineCount(2), points: 4 }, rhymePair(0, 1, 8), syllables(0, 10, 1, 4), syllables(1, 10, 1, 4)],
  },
];

/** Words an acrostic can be asked to spell. Short on purpose. */
export const ACROSTIC_WORDS: Record<string, string[]> = {
  en: ['bard', 'moon', 'king', 'rose', 'fate', 'wit', 'play', 'star'],
};

export function getForm(id: string): Form {
  const f = FORMS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown form: ${id}`);
  return f;
}

/** Can syllables be counted for this language? Decides which forms are offered. */
export function countsSyllables(lang: string): boolean {
  return /^(en|es|it|pt|de|nl|fr|ca|ro)\b/.test(lang);
}

/** Forms that can be played in a language. */
export function formsFor(lang: string): Form[] {
  return FORMS.filter((f) => !f.needsSyllables || countsSyllables(lang));
}

export interface FormScore {
  formId: string;
  checks: CheckResult[];
  earned: number;
  /** Every requirement met. */
  kept: boolean;
}

export function scoreForm(form: Form, verse: string, ctx: FormContext): FormScore {
  const lines = linesOf(verse);
  const checks: CheckResult[] = form.requirements.map((r) => {
    const { met, detail } = lines.length === 0 ? { met: false, detail: 'empty' } : r.check(lines, ctx);
    return { id: r.id, label: r.label(ctx), points: r.points, earned: met ? r.points : 0, met, detail };
  });
  const earned = checks.reduce((s, c) => s + c.earned, 0);
  return { formId: form.id, checks, earned, kept: checks.every((c) => c.met) };
}
