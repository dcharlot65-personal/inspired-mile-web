/**
 * Devices, curses and power words: what the cards do.
 *
 * - A character card carries its house's DEVICE. Land the device in your verse
 *   and your craft score is multiplied.
 * - Every character also has a SIGNATURE: echo its famous line without quoting it.
 * - A potion is a CURSE played on the opponent: a rule their verse must obey.
 * - A relic lends POWER WORDS: work them in for bonus craft.
 *
 * All of it is checked by code, so the same verse always scores the same.
 *
 * Names and briefs are message keys (see ./msg), rendered by the page in the
 * player's language. Thresholds come from ./lang, so "a long word" means what
 * it should in each script. A `detail` is language-neutral evidence.
 */
import type { Card, House } from '../cards';
import { baseLang, rulesFor, unitKey } from './lang';
import { msg, type Msg } from './msg';
import { rhymeChecked, rhymes } from './rhyme';
import { contentWords, edgeUnit, fold, initial, lastWord, letterCount, lineLength, linesOf, wordSpan, wordsOf } from './text';

export interface DeviceResult {
  met: boolean;
  /** Language-neutral evidence: the line, the words or the counts that decided it. */
  detail: string;
  /** For the signature: why it stands as it does ('none', 'hint', 'quoted', 'echoed'). */
  code?: string;
}

export interface Device {
  id: string;
  name: Msg;
  /** What the player must do, in one short sentence. */
  brief: (lang: string) => Msg;
  check: (verse: string, ctx: DeviceContext) => DeviceResult;
}

export interface DeviceContext {
  /** Language of the verse. */
  lang?: string;
  /** The opponent's most recent verse, for the riposte. */
  opponentVerse?: string;
  /** Names that count as an invocation. */
  names?: string[];
}

function d(id: string, check: Device['check'], brief: Device['brief'] = () => msg(`device.${id}.brief`)): Device {
  return { id, name: msg(`device.${id}.name`), brief, check };
}

const langOf = (ctx: DeviceContext) => ctx.lang ?? 'en';

export const DEVICES: Record<string, Device> = {
  question: d('question', (v) => {
    const hit = linesOf(v).find((l) => /[?？؟]\s*["'”’)»」』]*$/.test(l));
    return { met: !!hit, detail: hit ?? '' };
  }),
  exclaim: d('exclaim', (v) => {
    const hit = linesOf(v).find((l) => /[!！]\s*["'”’)»」』]*$/.test(l));
    return { met: !!hit, detail: hit ?? '' };
  }),
  alliteration: d('alliteration', (v, ctx) => {
    const lang = langOf(ctx);
    const min = Math.min(3, rulesFor(lang).content);
    for (const line of linesOf(v)) {
      const counts = new Map<string, number>();
      for (const w of wordsOf(line, lang)) {
        if (wordSpan(w) < min) continue;
        const k = initial(w, lang);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      for (const [k, n] of counts) if (n >= 3) return { met: true, detail: `${k} ×${n}` };
    }
    return { met: false, detail: '' };
  }),
  repetition: d('repetition', (v, ctx) => {
    const counts = new Map<string, number>();
    for (const w of contentWords(v, langOf(ctx))) counts.set(fold(w), (counts.get(fold(w)) ?? 0) + 1);
    for (const [w, n] of counts) if (n >= 3) return { met: true, detail: `${w} ×${n}` };
    return { met: false, detail: '' };
  }),
  'internal-rhyme': d('internal-rhyme', (v, ctx) => {
    const lang = langOf(ctx);
    const min = Math.min(3, rulesFor(lang).content);
    for (const line of linesOf(v)) {
      const ws = wordsOf(line, lang).filter((w) => wordSpan(w) >= min);
      for (let i = 0; i < ws.length; i++) {
        for (let j = i + 1; j < ws.length; j++) {
          if (rhymes(ws[i], ws[j], lang)) return { met: true, detail: `${ws[i]} / ${ws[j]}` };
        }
      }
    }
    return { met: false, detail: '' };
  }),
  riposte: d(
    'riposte',
    (v, ctx) => {
      if (!ctx.opponentVerse) return { met: false, detail: '' };
      const lang = langOf(ctx);
      const min = rulesFor(lang).riposte;
      const theirs = new Set(wordsOf(ctx.opponentVerse, lang).filter((w) => wordSpan(w) >= min).map(fold));
      const hit = wordsOf(v, lang).map(fold).find((w) => theirs.has(w));
      return { met: !!hit, detail: hit ?? '' };
    },
    (lang) => msg('device.riposte.brief', { n: rulesFor(lang).riposte }),
  ),
  brevity: d(
    'brevity',
    (v, ctx) => {
      const lang = langOf(ctx);
      const max = rulesFor(lang).brevity;
      const ls = linesOf(v);
      const longest = Math.max(0, ...ls.map((l) => lineLength(l, lang)));
      return { met: ls.length > 0 && longest <= max && longest > 0, detail: `${longest}/${max}` };
    },
    (lang) => msg(unitKey('device.brevity.brief', lang), { n: rulesFor(lang).brevity }),
  ),
  swell: d('swell', (v, ctx) => {
    const counts = linesOf(v).map((l) => lineLength(l, langOf(ctx)));
    if (counts.length < 2) return { met: false, detail: counts.join(' · ') };
    const last = counts[counts.length - 1];
    const met = counts.slice(0, -1).every((c) => c < last);
    return { met, detail: counts.join(' · ') };
  }),
  balance: d(
    'balance',
    (v, ctx) => {
      const counts = linesOf(v).map((l) => lineLength(l, langOf(ctx)));
      const met = counts.length >= 2 && counts.every((c) => c === counts[0] && c > 0);
      return { met, detail: counts.join(' · ') };
    },
    (lang) => msg(unitKey('device.balance.brief', lang)),
  ),
  ring: d(
    'ring',
    (v, ctx) => {
      const lang = langOf(ctx);
      const ls = linesOf(v);
      if (!ls.length) return { met: false, detail: '' };
      const a = edgeUnit(ls[0], lang, 'first');
      const b = edgeUnit(ls[ls.length - 1], lang, 'last');
      return { met: !!a && a === b && lineLength(v.replace(/\n/g, ' '), lang) > 2, detail: `${a} … ${b}` };
    },
    (lang) => msg(unitKey('device.ring.brief', lang)),
  ),
  invocation: d('invocation', (v, ctx) => {
    const said = new Set(wordsOf(v, langOf(ctx)).map(fold));
    const hit = (ctx.names ?? []).find((n) => said.has(fold(n)));
    return { met: !!hit, detail: hit ?? '' };
  }),
  grandeur: d(
    'grandeur',
    (v, ctx) => {
      const lang = langOf(ctx);
      const min = rulesFor(lang).grand;
      const big = [...new Set(wordsOf(v, lang).filter((w) => letterCount(w) >= min))];
      return { met: big.length >= 2, detail: big.slice(0, 3).join(', ') };
    },
    (lang) => msg('device.grandeur.brief', { n: rulesFor(lang).grand }),
  ),
  monorhyme: d('monorhyme', (v, ctx) => {
    const lang = langOf(ctx);
    const ends = linesOf(v).map((l) => lastWord(l, lang));
    const met = ends.length >= 2 && ends.every((w, i) => i === 0 || rhymes(ends[0], w, lang));
    return { met, detail: ends.join(' · ') };
  }),
};

/** Which device each house fights with. The line from the plays behind it is the message `house.<slug>.why`. */
export const HOUSE_DEVICE: Record<string, { device: string; slug: string }> = {
  'Danish Court': { device: 'question', slug: 'danish-court' },
  Capulet: { device: 'exclaim', slug: 'capulet' },
  Montague: { device: 'internal-rhyme', slug: 'montague' },
  'Forest of Arden': { device: 'alliteration', slug: 'forest-of-arden' },
  'Verona Court': { device: 'riposte', slug: 'verona-court' },
  'The Tempest': { device: 'swell', slug: 'the-tempest' },
  'Scottish Court': { device: 'repetition', slug: 'scottish-court' },
  Illyria: { device: 'brevity', slug: 'illyria' },
  Rome: { device: 'invocation', slug: 'rome' },
  Legendary: { device: 'monorhyme', slug: 'legendary' },
  'Lake District': { device: 'balance', slug: 'lake-district' },
  'Gothic Circle': { device: 'ring', slug: 'gothic-circle' },
  Olympus: { device: 'grandeur', slug: 'olympus' },
  Underworld: { device: 'riposte', slug: 'underworld' },
};

/**
 * Where rhyme cannot be checked fairly (Chinese, Japanese, Thai) a house whose
 * device is a rhyme fights with a structural device instead, so no card is
 * left with a flourish that can never land.
 */
const WITHOUT_RHYME: Record<string, string> = { 'internal-rhyme': 'repetition', monorhyme: 'ring' };

export function deviceForHouse(house: House | string, lang = 'en'): Device {
  const id = HOUSE_DEVICE[house]?.device ?? 'question';
  return DEVICES[rhymeChecked(lang) ? id : WITHOUT_RHYME[id] ?? id];
}

/** The line behind a house's device, or null when the device was swapped for this language. */
export function houseWhy(house: House | string, lang = 'en'): Msg | null {
  const entry = HOUSE_DEVICE[house];
  if (!entry || deviceForHouse(house, lang).id !== entry.device) return null;
  return msg(`house.${entry.slug}.why`);
}

// --- Signature: echo the card's famous line without quoting it ---

/** Words too common to count as an echo of a quotation. */
const COMMON = new Set(
  'that this with from have what when where which thou thee thy your their there these those shall will would should could been were upon into then than them they more most some such very much come here hath doth lord'.split(' '),
);

/** The quotations are English, so their telling words are found by the English measure. */
export function signatureWords(card: Card): string[] {
  return [...new Set(contentWords(card.quote, 'en').map(fold).filter((w) => !COMMON.has(w)))];
}

/**
 * The signature lands when the verse uses a telling word from the card's line
 * but does not simply recite it: four words running from the quote is a quotation.
 *
 * `detail` holds the words: those still to echo for 'hint', the one echoed for 'echoed'.
 */
export function checkSignature(card: Card, verse: string, lang = 'en'): DeviceResult {
  const sig = signatureWords(card);
  if (!sig.length) return { met: false, detail: '', code: 'none' };
  const said = [...new Set([...wordsOf(verse, lang), ...wordsOf(verse, 'en')])].map(fold);
  const echoed = sig.filter((w) => said.includes(w));
  if (!echoed.length) return { met: false, detail: sig.slice(0, 4).join(', '), code: 'hint' };
  const quote = wordsOf(card.quote, 'en').map(fold);
  const spoken = wordsOf(verse, 'en').map(fold).join(' ');
  for (let i = 0; i + 4 <= quote.length; i++) {
    const run = quote.slice(i, i + 4).join(' ');
    if (spoken.includes(run)) return { met: false, detail: '', code: 'quoted' };
  }
  return { met: true, detail: echoed[0], code: 'echoed' };
}

// --- Curses (potions) ---

export interface Curse {
  id: string;
  name: Msg;
  /** The rule, addressed to whoever is under it ("Your verse may not…"). */
  brief: (param: string, lang: string) => Msg;
  /** Number of times the verse breaks the curse. */
  violations: (verse: string, param: string, lang?: string) => number;
}

function curse(id: string, brief: Curse['brief'], violations: Curse['violations']): Curse {
  return { id, name: msg(`curse.${id}.name`), brief, violations };
}

export const CURSES: Record<string, Curse> = {
  'forbidden-letter': curse(
    'forbidden-letter',
    (p) => msg('curse.forbidden-letter.brief', { letter: p.toUpperCase() }),
    (v, p, lang = 'en') => wordsOf(v, lang).filter((w) => fold(w).includes(fold(p))).length,
  ),
  'short-words': curse(
    'short-words',
    (_p, lang) => msg('curse.short-words.brief', { n: rulesFor(lang).shortWord }),
    (v, _p, lang = 'en') => wordsOf(v, lang).filter((w) => letterCount(w) > rulesFor(lang).shortWord).length,
  ),
  'no-repeats': curse(
    'no-repeats',
    (_p, lang) => msg('curse.no-repeats.brief', { n: rulesFor(lang).content }),
    (v, _p, lang = 'en') => {
      const seen = new Set<string>();
      let n = 0;
      for (const w of contentWords(v, lang).map(fold)) {
        if (seen.has(w)) n++;
        seen.add(w);
      }
      return n;
    },
  ),
  'short-lines': curse(
    'short-lines',
    (_p, lang) => msg(unitKey('curse.short-lines.brief', lang), { n: rulesFor(lang).shortLine }),
    (v, _p, lang = 'en') => linesOf(v).filter((l) => lineLength(l, lang) > rulesFor(lang).shortLine).length,
  ),
};

/** Craft lost per time a curse is broken, and the most one curse can cost. */
export const CURSE_PENALTY = 4;
export const CURSE_PENALTY_CAP = 12;

/** Which curse each potion card casts. */
export const POTION_CURSE: Record<string, string> = {
  'PT-001': 'no-repeats',
  'PT-002': 'forbidden-letter',
  'PT-003': 'short-lines',
  'PT-004': 'short-words',
  'PT-005': 'no-repeats',
  'PT-006': 'forbidden-letter',
  'PT-007': 'short-lines',
  'PT-008': 'short-words',
  'PT-009': 'forbidden-letter',
};

// --- Power words (relics) ---

/** Craft earned for working in at least POWER_WORDS_NEEDED of a relic's words. */
export const POWER_WORD_BONUS = 6;
export const POWER_WORDS_NEEDED = 2;

/**
 * Is a power word in the verse?
 *
 * English asks for the word itself. Most other languages inflect, and a noun
 * must be allowed its endings and particles: a verse word counts when it begins
 * with the power word, or, for a power word of four letters or more, with all
 * but its last letter (Russian "кровь" is met by "крови", Korean "왕" by "왕이").
 * Arabic attaches the article and prepositions in front, and Chinese, Japanese
 * and Thai are written unspaced, so there the power word may sit anywhere
 * inside a word or the line. A power phrase of two words (Vietnamese) must
 * appear as written.
 *
 * Generous by design: "king" would be met by "kingdom" under the stem rule,
 * which is why English keeps the exact match it always had.
 */
function usesWord(power: string, verse: string, lang: string): boolean {
  const b = baseLang(lang);
  const want = wordsOf(power, lang).map(fold);
  if (!want.length) return false;
  const said = wordsOf(verse, lang).map(fold);
  if (b === 'zh' || b === 'ja' || b === 'th') {
    const letters = (s: string) => fold(s).replace(/[^\p{L}\p{M}]/gu, '');
    return letters(verse).includes(letters(power));
  }
  if (want.length > 1) return ` ${said.join(' ')} `.includes(` ${want.join(' ')} `);
  const w = want[0];
  if (b === 'en') return said.includes(w);
  if (b === 'ar') return said.some((s) => s.includes(w));
  const letters = [...w];
  const stem = letters.length >= 4 ? letters.slice(0, -1).join('') : w;
  return said.some((s) => s.startsWith(stem));
}

export function checkPowerWords(words: string[], verse: string, lang = 'en'): { used: string[]; met: boolean } {
  const used = words.filter((w) => usesWord(w, verse, lang));
  return { used, met: used.length >= POWER_WORDS_NEEDED };
}
