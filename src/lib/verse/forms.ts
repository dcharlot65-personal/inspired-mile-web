/**
 * Verse forms. Each round of a duel is fought under one form, and whether a
 * verse keeps the form is decided here by code, never by the model.
 *
 * A form is a list of requirements worth points; a full form is worth
 * FORM_POINTS. Partial credit is deliberate: a near miss still scores.
 *
 * Nothing here produces a sentence. A form's name, its brief and each
 * requirement's label are message keys with variables (see ./msg); the page
 * renders them in the player's language and ./english renders them for the
 * model's prompt. The `detail` of a check is data that reads the same in any
 * language: the words compared, a count such as "3/4".
 */
import { baseLang, unitKey } from './lang';
import { msg, type Msg } from './msg';
import { rhymeChecked, rhymeEnds, rhymes } from './rhyme';
import { FULL_KNOWN_SHARE, countsSyllables, edgeUnit, fold, graphemes, hiragana, lineLength, linesOf, substance, syllableSpan, wordsOf } from './text';

export { countsSyllables };

export const FORM_POINTS = 20;

export interface CheckResult {
  id: string;
  label: Msg;
  points: number;
  earned: number;
  met: boolean;
  /** Language-neutral evidence: words, letters or counts. Empty when there is nothing to show. */
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
  label: (ctx: FormContext) => Msg;
  points: number;
  check: (lines: string[], ctx: FormContext) => { met: boolean; detail: string };
}

export interface Form {
  id: string;
  name: Msg;
  /** One sentence shown to the player before they write. */
  brief: (ctx: FormContext) => Msg;
  /** Lines the form asks for. */
  lines: (ctx: FormContext) => number;
  /** Needs syllable counting, so only offered where we can count. */
  needsSyllables?: boolean;
  /** Needs a rhyme check, so only offered where rhyme can be checked fairly. */
  needsRhyme?: boolean;
  /** Offered only in these languages: a form native to one tradition. */
  only?: string[];
  /** Not offered in these languages. */
  except?: string[];
  requirements: Requirement[];
}

/** Shown when a requirement points at a line the verse does not have. */
const MISSING = '—';

function lineCount(n: number, points = 6): Requirement {
  return {
    id: 'lines',
    label: () => msg('check.lines', { n }),
    points,
    check: (lines) => ({ met: lines.length === n, detail: `${lines.length}/${n}` }),
  };
}

function rhymePair(a: number, b: number, points: number): Requirement {
  return {
    id: `rhyme-${a + 1}-${b + 1}`,
    label: () => msg('check.rhyme', { a: a + 1, b: b + 1 }),
    points,
    check: (lines, ctx) => {
      if (lines.length <= Math.max(a, b)) return { met: false, detail: MISSING };
      const [wa, wb] = rhymeEnds(lines[a], lines[b], ctx.lang);
      return { met: rhymes(wa, wb, ctx.lang), detail: `${wa} / ${wb}` };
    },
  };
}

/** What a syllable is called where it is not one: a character in Chinese, a sound written in kana in Japanese. */
function syllableKey(key: string, lang: string): string {
  const b = baseLang(lang);
  return b === 'zh' ? `${key}.char` : b === 'ja' ? `${key}.kana` : key;
}

/**
 * A line of `target` syllables. `tolerance` widens the target by design ("about ten").
 *
 * In English a word can be said more than one way ("fire" in one syllable or
 * two, "every" in two or three), so a line has a range of counts and keeps the
 * form when the target is inside it. A word the pronunciation table does not
 * have is counted by its spelling, and the detail then starts with "~"; it buys
 * no slack, or any made-up word would ("Zorblatt is long gone now" is six by
 * spelling, not five). The game's own names are in the table.
 */
function syllables(index: number, target: number, tolerance: number, points: number): Requirement {
  return {
    id: `syllables-${index + 1}`,
    label: (ctx) => msg(tolerance ? 'check.syllables.about' : syllableKey('check.syllables', ctx.lang), { line: index + 1, n: target }),
    points,
    check: (lines, ctx) => {
      if (lines.length <= index) return { met: false, detail: MISSING };
      const span = syllableSpan(lines[index], ctx.lang);
      // "?": this line holds something that cannot be counted (kanji in a Japanese haiku, a foreign script).
      if (span === null) return { met: false, detail: '?' };
      const slack = tolerance;
      const count = span.min === span.max ? `${span.min}` : `${span.min}–${span.max}`;
      return { met: target >= span.min - slack && target <= span.max + slack, detail: `${span.guessed ? '~' : ''}${count}/${target}` };
    },
  };
}

function sameEdge(edge: 'first' | 'last'): Requirement {
  return {
    id: edge === 'first' ? 'same-opening' : 'same-ending',
    label: (ctx) => msg(unitKey(edge === 'first' ? 'check.same-opening' : 'check.same-ending', ctx.lang)),
    points: 14,
    check: (lines, ctx) => {
      const units = lines.map((l) => edgeUnit(l, ctx.lang, edge));
      const met = lines.length >= 2 && units.every((w) => w && w === units[0]);
      return { met, detail: units.join(' · ') };
    },
  };
}

// --- Acrostic ---

/**
 * What each line of an acrostic must open with.
 *
 * Alphabets: one letter per line. Chinese: one character (a hidden-head poem).
 * Japanese: one kana. Korean: one syllable block (a three-line poem on a word).
 * Hindi: one akshara, matched on its consonant, since a line may open on that
 * consonant with any vowel sign. Thai cannot open a line on a bare vowel sign,
 * so its acrostic is the kratu: a phrase written with spaces, each line opening
 * on the next word.
 */
export function acrosticUnits(word: string, lang: string): string[] {
  const w = word.trim();
  if (!w) return [];
  if (/\s/.test(w)) return w.split(/\s+/);
  if (baseLang(lang) === 'hi') return graphemes(w, 'hi').map((g) => [...g][0]);
  return [...w];
}

/** The acrostic word as shown to the player. */
export function acrosticDisplay(word: string, lang: string): string {
  const w = word.trim();
  return /\s/.test(w) ? acrosticUnits(w, lang).join(' · ') : w.toUpperCase();
}

function opening(text: string, lang: string): string {
  let s = hiragana(fold(text)).replace(/[^\p{L}\p{M}]/gu, '');
  if (baseLang(lang) === 'ar') s = s.replace(/[أإآٱ]/g, 'ا');
  return s;
}

function acrosticKey(key: string, ctx: FormContext): string {
  return /\s/.test((ctx.acrostic ?? '').trim()) ? `${key}.words` : key;
}

const ACROSTIC: Form = {
  id: 'acrostic',
  name: msg('form.acrostic.name'),
  brief: (ctx) => msg(acrosticKey('form.acrostic.brief', ctx), { word: acrosticDisplay(ctx.acrostic ?? '', ctx.lang) }),
  lines: (ctx) => acrosticUnits(ctx.acrostic ?? '', ctx.lang).length,
  requirements: [
    {
      id: 'lines',
      label: (ctx) => msg('check.lines', { n: acrosticUnits(ctx.acrostic ?? '', ctx.lang).length }),
      points: 6,
      check: (lines, ctx) => {
        const n = acrosticUnits(ctx.acrostic ?? '', ctx.lang).length;
        return { met: lines.length === n, detail: `${lines.length}/${n}` };
      },
    },
    {
      id: 'spells',
      label: (ctx) => msg(acrosticKey('check.spells', ctx), { word: acrosticDisplay(ctx.acrostic ?? '', ctx.lang) }),
      points: 14,
      check: (lines, ctx) => {
        const units = acrosticUnits(ctx.acrostic ?? '', ctx.lang);
        const words = /\s/.test((ctx.acrostic ?? '').trim());
        let met = units.length > 0 && lines.length === units.length;
        const got = lines.map((line, i) => {
          const o = opening(line, ctx.lang);
          const want = units[i] === undefined ? '' : opening(units[i], ctx.lang);
          if (want && o.startsWith(want)) return units[i];
          met = false;
          return words ? wordsOf(line, ctx.lang)[0] ?? '' : graphemes(o, ctx.lang)[0] ?? '';
        });
        return { met, detail: got.join(words ? ' · ' : '').toUpperCase() };
      },
    },
  ],
};

export const FORMS: Form[] = [
  {
    id: 'couplet',
    name: msg('form.couplet.name'),
    brief: () => msg('form.couplet.brief'),
    lines: () => 2,
    needsRhyme: true,
    requirements: [lineCount(2), rhymePair(0, 1, 14)],
  },
  {
    id: 'quatrain-aabb',
    name: msg('form.quatrain-aabb.name'),
    brief: () => msg('form.quatrain-aabb.brief'),
    lines: () => 4,
    needsRhyme: true,
    requirements: [lineCount(4), rhymePair(0, 1, 7), rhymePair(2, 3, 7)],
  },
  {
    id: 'quatrain-abab',
    name: msg('form.quatrain-abab.name'),
    brief: () => msg('form.quatrain-abab.brief'),
    lines: () => 4,
    needsRhyme: true,
    requirements: [lineCount(4), rhymePair(0, 2, 7), rhymePair(1, 3, 7)],
  },
  {
    id: 'tercet',
    name: msg('form.tercet.name'),
    brief: () => msg('form.tercet.brief'),
    lines: () => 3,
    needsRhyme: true,
    requirements: [lineCount(3), rhymePair(0, 2, 14)],
  },
  {
    id: 'anaphora',
    name: msg('form.anaphora.name'),
    brief: (ctx) => msg(unitKey('form.anaphora.brief', ctx.lang)),
    lines: () => 3,
    requirements: [lineCount(3), sameEdge('first')],
  },
  ACROSTIC,
  {
    id: 'crescendo',
    name: msg('form.crescendo.name'),
    brief: () => msg('form.crescendo.brief'),
    lines: () => 3,
    requirements: [
      lineCount(3),
      {
        id: 'growing',
        label: (ctx) => msg(unitKey('check.growing', ctx.lang)),
        points: 14,
        check: (lines, ctx) => {
          const counts = lines.map((l) => lineLength(l, ctx.lang));
          const met = counts.length >= 2 && counts.every((c, i) => i === 0 || c > counts[i - 1]);
          return { met, detail: counts.join(' < ') };
        },
      },
    ],
  },
  {
    // The mirror of anaphora. Structural, so it needs neither rhyme nor a syllable count, and
    // gives the languages without rhyming forms a fourth form to draw from. It is left out
    // of English so that an English duel draws from exactly the forms it always has: adding
    // a form there is a change to the game, not to its languages.
    id: 'epistrophe',
    except: ['en'],
    name: msg('form.epistrophe.name'),
    brief: (ctx) => msg(unitKey('form.epistrophe.brief', ctx.lang)),
    lines: () => 3,
    requirements: [lineCount(3), sameEdge('last')],
  },
  {
    id: 'haiku',
    name: msg('form.haiku.name'),
    needsSyllables: true,
    brief: (ctx) => msg(syllableKey('form.haiku.brief', ctx.lang)),
    lines: () => 3,
    requirements: [lineCount(3, 5), syllables(0, 5, 0, 5), syllables(1, 7, 0, 5), syllables(2, 5, 0, 5)],
  },
  {
    id: 'heroic-couplet',
    name: msg('form.heroic-couplet.name'),
    needsSyllables: true,
    needsRhyme: true,
    brief: () => msg('form.heroic-couplet.brief'),
    lines: () => 2,
    requirements: [lineCount(2, 4), rhymePair(0, 1, 8), syllables(0, 10, 1, 4), syllables(1, 10, 1, 4)],
  },
  {
    // The shape of a Chinese quatrain (jueju): four lines, all of five characters or all of seven.
    // Its tone pattern and rhyme cannot be checked without readings, so only the shape is.
    id: 'jueju',
    name: msg('form.jueju.name'),
    only: ['zh'],
    brief: () => msg('form.jueju.brief'),
    lines: () => 4,
    requirements: [
      lineCount(4),
      {
        id: 'even-lines',
        label: () => msg('check.jueju-length'),
        points: 14,
        check: (lines, ctx) => {
          const counts = lines.map((l) => lineLength(l, ctx.lang));
          const met = counts.length >= 2 && (counts[0] === 5 || counts[0] === 7) && counts.every((c) => c === counts[0]);
          return { met, detail: counts.join(' · ') };
        },
      },
    ],
  },
  {
    // Vietnamese six-eight (lục bát): a line of six syllables, then one of eight
    // whose sixth syllable rhymes with the last of the first. Its level-tone
    // pattern is not checked beyond the rhyme.
    id: 'luc-bat',
    name: msg('form.luc-bat.name'),
    only: ['vi'],
    brief: () => msg('form.luc-bat.brief'),
    lines: () => 2,
    requirements: [
      lineCount(2, 4),
      syllables(0, 6, 0, 4),
      syllables(1, 8, 0, 4),
      {
        id: 'rhyme-6-6',
        label: () => msg('check.luc-bat-rhyme'),
        points: 8,
        check: (lines, ctx) => {
          if (lines.length < 2) return { met: false, detail: MISSING };
          const wa = wordsOf(lines[0], ctx.lang)[5] ?? '';
          const wb = wordsOf(lines[1], ctx.lang)[5] ?? '';
          return { met: !!wa && !!wb && rhymes(wa, wb, ctx.lang), detail: `${wa || MISSING} / ${wb || MISSING}` };
        },
      },
    ],
  },
];

export function getForm(id: string): Form {
  const f = FORMS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown form: ${id}`);
  return f;
}

/**
 * Forms that can be played in a language: every structural form, the syllable
 * forms where syllables can be counted, the rhyming forms where rhyme can be
 * checked fairly, and any form native to that language.
 */
export function formsFor(lang: string): Form[] {
  const b = baseLang(lang);
  return FORMS.filter(
    (f) => (!f.only || f.only.includes(b)) && !f.except?.includes(b) && (!f.needsSyllables || countsSyllables(lang)) && (!f.needsRhyme || rhymeChecked(lang)),
  );
}

export interface FormScore {
  formId: string;
  checks: CheckResult[];
  earned: number;
  /** Every requirement met. */
  kept: boolean;
  /** The text is too thin to be a verse (text.ts `substance`): no requirement is met and nothing is earned. */
  thin?: boolean;
  /**
   * The share of the points kept, from the share of the verse that is words of its language
   * (text.ts substance `known`): 1 at FULL_KNOWN_SHARE and above, less below it.
   */
  scale: number;
}

export function scoreForm(form: Form, verse: string, ctx: FormContext): FormScore {
  const lines = linesOf(verse);
  // A form is kept by a verse, not by tokens laid out in its shape.
  const body = substance(verse, ctx.lang);
  const thin = lines.length > 0 && !body.ok;
  const checks: CheckResult[] = form.requirements.map((r) => {
    // A thin verse shows why: how many different words it has against how many it needs.
    const { met, detail } = lines.length === 0 ? { met: false, detail: '' } : thin ? { met: false, detail: `${body.distinct}/${body.needed}` } : r.check(lines, ctx);
    return { id: r.id, label: r.label(ctx), points: r.points, earned: met ? r.points : 0, met, detail };
  });
  if (thin) return { formId: form.id, checks, earned: 0, kept: false, thin, scale: 0 };
  // Points are for words: where a lexicon says part of the verse is not words, that part earns nothing.
  const scale = lines.length === 0 ? 1 : Math.min(1, body.known / FULL_KNOWN_SHARE);
  const earned = Math.round(checks.reduce((s, c) => s + c.earned, 0) * scale);
  return { formId: form.id, checks, earned, kept: checks.every((c) => c.met), scale };
}
