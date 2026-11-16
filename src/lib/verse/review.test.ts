/**
 * The independent check of the rules fixes (2026-11-16) refused three of them and raised a
 * list of concerns. Its probes (zz-review-probe.test.ts, zz-review-grade.test.ts) are here as
 * tests of the fixed behaviour, with the acceptance measurements the brief asked for. Each
 * block prints what it measured ("MEASURE ..."), which is where the thresholds in duel.ts and
 * text.ts come from; docs/language/RULES-MEASUREMENTS.md records a run.
 *
 * Characters that cannot be seen, or that look like others, are built from code points.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { CARD_CATALOG, getCardById } from '../cards';
import { CURSES, checkSignature, signatureNeeded, signatureWords } from './devices';
import { COPY_MIN_TAKEN, COPY_THRESHOLD, OWN_WORDS_PER_LINE, createDuel, isCopy, resolveRound, rng, scoreVerse, type DuelDeck } from './duel';
import { formsFor, getForm, scoreForm } from './forms';
import { rulesJudge } from './judge';
import { writeOpponentVerse, writtenCandidates } from './opponent';
import { PACK_LANGS, getPack, loadAllPacks } from './packs';
import { loadPronunciation } from './pronounce';
import { allusionLexicon } from './referee';
import { loadSound } from './sound';
import { FULL_KNOWN_SHARE, MIN_KNOWN_SHARE, cleanVerse, copyOf, fold, isContentWord, linesOf, segmentedWords, substance, wordParts, wordsOf } from './text';

const cp = (...c: number[]) => String.fromCodePoint(...c);
const log = (k: string, v: unknown) => console.log(`MEASURE ${k} ${JSON.stringify(v)}`);
const lex = () => allusionLexicon();

beforeAll(async () => {
  await loadAllPacks();
  await Promise.all(PACK_LANGS.map((l) => loadSound(l)));
  expect(await loadPronunciation()).toBe(true);
}, 180_000);

// --- Helpers ---

/** Every verse a pack holds: the written bank of each form, the spare verses, and acrostics made from its lines. */
function packVerses(lang: string): string[] {
  const pack = getPack(lang);
  const out = new Set<string>([...Object.values(pack.written).flat(), ...Object.values(pack.spare ?? {}).flat()]);
  for (const word of pack.acrostic) {
    for (const i of [0, 1]) {
      const units = word.includes(' ') ? word.split(/\s+/) : [...word];
      const lines = units.map((u) => pack.acrosticLines[fold(u)]?.[i % (pack.acrosticLines[fold(u)]?.length ?? 1)]);
      if (lines.every(Boolean)) out.add(lines.join('\n'));
    }
  }
  return [...out];
}

const UNSPACED = new Set(['zh', 'ja', 'th']);
type Seg = { text: string; word: boolean };

/**
 * A line cut into its words and what lies between them, so that a line can be rebuilt.
 * Where words are written without spaces, the words are the engine's (text.ts segmentedWords:
 * the dictionary's for Japanese), so "between every two words" means what the engine reads.
 */
function segments(line: string, lang: string): Seg[] {
  if (UNSPACED.has(lang)) {
    const out: Seg[] = [];
    let rest = line;
    for (const w of segmentedWords(line, lang)) {
      const at = rest.toLowerCase().indexOf(w);
      if (at < 0) continue;
      if (at > 0) out.push({ text: rest.slice(0, at), word: false });
      out.push({ text: rest.slice(at, at + w.length), word: true });
      rest = rest.slice(at + w.length);
    }
    if (rest) out.push({ text: rest, word: false });
    return out;
  }
  return line.split(/(\s+)/).filter((t) => t.length).map((t) => ({ text: t, word: /\p{L}/u.test(t) }));
}

/** A filler word of each language: an interjection or particle said between words. */
const FILLER: Record<string, string> = {
  en: 'yea', es: 'pues', fr: 'donc', de: 'doch', it: 'ecco', pt: 'pois', pl: 'więc', ru: 'вот', ar: 'إذن', hi: 'तो',
  zh: '啊', ja: 'ね', ko: '음', vi: 'à', th: 'นะ', id: 'nah',
};

/** The mechanical copies of a verse the brief names. `r` picks which word a line drops. */
function copies(verse: string, lang: string, r: () => number): Record<string, string> {
  const ls = linesOf(verse);
  const sep = UNSPACED.has(lang) ? '' : ' ';
  const words = (l: string) => segments(l, lang);
  const filler = (l: string) => {
    const s = words(l);
    const out: string[] = [];
    let seen = 0;
    const total = s.filter((x) => x.word).length;
    for (const x of s) {
      out.push(x.text);
      // Written as a word of its own: where words run together a filler kana would fuse with its neighbours.
      if (x.word && ++seen < total) out.push(` ${FILLER[lang]} `);
    }
    return out.join('');
  };
  const swapped = (l: string) => {
    const s = words(l);
    const idx = s.map((x, i) => (x.word ? i : -1)).filter((i) => i >= 0);
    const t = s.map((x) => x.text);
    for (let k = 0; k + 1 < idx.length; k += 2) [t[idx[k]], t[idx[k + 1]]] = [t[idx[k + 1]], t[idx[k]]];
    return t.join('');
  };
  const dropped = (l: string) => {
    const s = words(l);
    const idx = s.map((x, i) => (x.word ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 2) return l;
    const drop = idx[Math.floor(r() * idx.length)];
    return s.filter((_, i) => i !== drop).map((x) => x.text).join('').replace(/\s+/g, ' ').trim();
  };
  return {
    filler: ls.map(filler).join('\n'),
    punctuation: ls.map((l) => `${l.replace(/[,.;:!?、。，！？]/g, '')}!`).join('\n'),
    case: verse.toUpperCase(),
    reversed: [...ls].reverse().join('\n'),
    swapped: ls.map(swapped).join('\n'),
    dropped: ls.map(dropped).join('\n'),
  };
}

/** Do two verses share a whole line (after folding)? Spare verses are built that way on purpose. */
function shareALine(a: string, b: string, lang: string): boolean {
  const key = (l: string) => wordsOf(l, lang).map(fold).join(' ');
  const bs = new Set(linesOf(b).map(key));
  return linesOf(a).some((l) => key(l) && bs.has(key(l)));
}

/** A deck of three characters of one house where it has them, filled from the catalogue otherwise. */
function houseDeck(house: string): DuelDeck {
  const chars = CARD_CATALOG.filter((c) => c.type === 'Character');
  const mine = chars.filter((c) => c.house === house).map((c) => c.id);
  const rest = chars.filter((c) => c.house !== house).map((c) => c.id);
  return { characters: [...mine, ...rest].slice(0, 3), relics: [], potions: [] };
}
const HOUSES = [...new Set(CARD_CATALOG.filter((c) => c.type === 'Character').map((c) => c.house))];

// --- Finding 24: copying ---

describe('finding 24: a copied verse, however it is dressed, is void; an answer is not', () => {
  it("the checker's probe P1: the opponent's verse with 'yea' between every two words is void on every seed", async () => {
    const riposteDeck = { characters: ['VC-001', 'VC-002', 'UW-001'], relics: [], potions: [] };
    let wins = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const d = createDuel(seed, 'en', riposteDeck);
      const opening = (await writeOpponentVerse({ duel: d, roundIndex: 0, difficulty: 'player' })).verse;
      const interleaved = linesOf(opening).map((l) => l.split(' ').join(' yea ')).join('\n');
      const res = resolveRound(d, 0, { charId: 'VC-001' }, interleaved, opening, rulesJudge(interleaved, opening, 'en', lex()));
      expect([seed, res.player.voided, res.player.craft, res.judge.player]).toEqual([seed, 'copied', 0, 0]);
      if (res.winner === 'player') wins++;
    }
    expect(wins).toBe(0);
  });

  it('every mechanical copy of the written opponent is void, in every language, for seeds 1-40, every round and every house', async () => {
    const lowest: Record<string, number> = {};
    const escaped: unknown[] = [];
    for (const lang of PACK_LANGS) {
      for (let seed = 1; seed <= 40; seed++) {
        const r = rng(seed * 7919);
        for (const house of lang === 'en' ? HOUSES : [HOUSES[seed % HOUSES.length]]) {
          const deck = houseDeck(house);
          const d = createDuel(seed, lang, deck);
          let previous: string | undefined;
          for (let round = 0; round < 3; round++) {
            const opp = (await writeOpponentVerse({ duel: d, roundIndex: round, difficulty: 'player', previousPlayerVerse: previous })).verse;
            for (const [kind, copy] of Object.entries(copies(opp, lang, r))) {
              const res = resolveRound(d, round, { charId: deck.characters[round] }, copy, opp, rulesJudge(copy, opp, lang, lex(), previous), previous);
              const c = copyOf(copy, opp, lang);
              lowest[kind] = Math.min(lowest[kind] ?? 1, c.share);
              if (res.player.voided !== 'copied' && res.player.voided !== 'thin') escaped.push({ lang, seed, house, round, kind, copy, share: c.share, taken: c.taken, own: c.own });
            }
            previous = packVerses(lang)[(seed + round) % packVerses(lang).length];
          }
        }
      }
    }
    log('copy: lowest share of each kind of mechanical copy', lowest);
    log('copy: escaped', [escaped.length, escaped.slice(0, 8)]);
    expect(escaped.slice(0, 5)).toEqual([]);
  }, 600_000);

  it('no honest pair is a copy: every bank and pack verse against every other, in all sixteen languages', () => {
    const byLang: Record<string, { pairs: number; sharedLine: number; max: number; at?: [string, string] }> = {};
    const flagged: unknown[] = [];
    for (const lang of PACK_LANGS) {
      const verses = packVerses(lang);
      const row = { pairs: 0, sharedLine: 0, max: 0 } as (typeof byLang)[string];
      for (const a of verses) {
        for (const b of verses) {
          if (a === b) continue;
          // Built from the same lines on purpose (the spare verses, acrostics from one bank of lines): a copy by construction.
          if (shareALine(a, b, lang)) {
            row.sharedLine++;
            continue;
          }
          row.pairs++;
          const s = copyOf(a, b, lang).share;
          if (s > row.max) [row.max, row.at] = [s, [a, b]];
          if (isCopy(a, b, lang)) flagged.push({ lang, a, b, ...copyOf(a, b, lang) });
        }
      }
      byLang[lang] = row;
    }
    log('copy: honest pairs per language (pairs, pairs sharing a whole line left out, highest share)', Object.fromEntries(Object.entries(byLang).map(([l, r]) => [l, [r.pairs, r.sharedLine, +r.max.toFixed(3)]])));
    log('copy: the honest pair closest to the threshold', Object.values(byLang).reduce((m, r) => (r.max > m.max ? r : m)));
    log('copy: honest pairs flagged', flagged.slice(0, 6));
    expect(flagged).toEqual([]);
  }, 300_000);

  it('a Riposte that throws two or three words back is an answer, in every language', () => {
    const flagged: unknown[] = [];
    let tried = 0;
    for (const lang of PACK_LANGS) {
      const verses = packVerses(lang);
      for (let i = 0; i < verses.length; i++) {
        const source = verses[i];
        const thrown = [...new Set(wordParts(source, lang).filter((w) => isContentWord(w, lang)))];
        if (thrown.length < 3) continue;
        for (const n of [2, 3]) {
          const answer = verses[(i + 1) % verses.length];
          if (shareALine(answer, source, lang)) continue;
          // The answer's own lines, with n of the source's words thrown back at the end of its first line.
          const ls = linesOf(answer);
          ls[0] = `${ls[0]}${UNSPACED.has(lang) ? '' : ' '}${thrown.slice(0, n).join(UNSPACED.has(lang) ? '' : ' ')}`;
          const riposte = ls.join('\n');
          tried++;
          if (isCopy(riposte, source, lang)) flagged.push({ lang, n, riposte, source, ...copyOf(riposte, source, lang) });
        }
      }
    }
    // The checker's examples (P7) and the old rule that one identical line of three words or more scored 1.
    const opp = 'Thy verse is dull\nAn empty, hollow skull';
    for (const fair of ['Thy verse is dull? So says the fool\nWhose hollow skull was never taught in school', 'Thy verse is dull\nSay thou, whose own is null', 'Dull verse? Mine sings']) {
      tried++;
      if (isCopy(fair, opp, 'en')) flagged.push({ fair, ...copyOf(fair, opp, 'en') });
    }
    log('copy: riposte answers tried', tried);
    log('copy: ripostes flagged', flagged.slice(0, 6));
    expect(flagged).toEqual([]);
  }, 300_000);

  it('the threshold sits between the two: every copy above it, every honest pair below', () => {
    // A copy that adds nothing has share 1; one with a filler between every two words, n / (n + 1).
    // The lowest mechanical copy and the highest honest pair are printed by the tests above.
    expect(COPY_THRESHOLD).toBeGreaterThan(0.5);
    expect(COPY_THRESHOLD).toBeLessThan(0.8);
    expect(COPY_MIN_TAKEN).toBe(4);
    // Three thrown words with nothing else of one's own is not a verse of one's own; with one word of one's own it is an answer.
    expect(isCopy('Thy verse is dull, so dull', 'Thy verse is dull\nAn empty, hollow skull', 'en')).toBe(true);
    expect(isCopy('Dull verse? Hollow! Mine sings', 'Thy verse is dull\nAn empty, hollow skull', 'en')).toBe(false);
    // Four thrown back with one word of one's own is past a Riposte: that verse is the other's.
    expect(isCopy('Dull verse, hollow skull? Mine sings', 'Thy verse is dull\nAn empty, hollow skull', 'en')).toBe(true);
  });

  it("the penalty: a copy scores nothing and gives the judge's pool to the other side", () => {
    // Without the forfeit two identical verses split the judge and the tie went to the player (the finding).
    const d = createDuel(3, 'en', { characters: ['VC-001', 'VC-002', 'UW-001'], relics: [], potions: [] });
    const opp = 'Thy rhymes are candles guttering in the night\nMine is the sun, and thou hast lost the light';
    const sweep = { player: 24, opponent: 0, criteria: { wordplay: 'player', allusion: 'player', flow: 'player', wit: 'player' }, source: 'model' } as const;
    const res = resolveRound(d, 0, { charId: 'VC-001' }, opp, opp, sweep);
    expect([res.player.craft, res.judge.player, res.judge.opponent, res.winner]).toEqual([0, 0, 24, 'opponent']);
  });
});

// --- Finding 25: degenerate verses ---

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
/** Two-letter words of English, for "any two-letter tokens": half the tokens are these, half random pairs. */
const TWO_WORDS = ['be', 'go', 'my', 'no', 'so', 'we', 'up', 'at', 'in', 'is', 'it', 'me', 'of', 'on', 'or', 'to', 'us', 'an', 'as', 'by', 'do', 'he', 'if', 'ox', 'ah', 'oh', 'lo', 'ye'];

/** Mechanically made non-verses, shaped to the round's form (its line count; an acrostic's opening letters). */
function degenerate(kind: string, lines: number, r: () => number, acrostic?: string): string {
  const pick = <T,>(xs: T[] | string) => xs[Math.floor(r() * xs.length)] as T;
  const words = ['night', 'dare', 'rose', 'crown', 'never', 'blood', 'star', 'fool'];
  const out: string[] = [];
  const base = pick<string>(words);
  for (let i = 0; i < lines; i++) {
    const n = 1 + Math.floor(r() * 3) + (kind === 'repeat' ? i : 0);
    let toks: string[] = [];
    for (let k = 0; k < n; k++) {
      if (kind === 'pairs') toks.push(pick<string>(LETTERS) + pick<string>(LETTERS));
      else if (kind === 'mash') {
        const row = pick<string>(ROWS);
        const at = Math.floor(r() * (row.length - 3));
        toks.push(row.slice(at, at + 3 + Math.floor(r() * 3)));
      } else if (kind === 'two') toks.push(r() < 0.5 ? pick<string>(TWO_WORDS) : pick<string>(LETTERS) + pick<string>(LETTERS));
      else toks.push(base);
    }
    // One word repeated, with one change per line.
    if (kind === 'repeat' && i > 0) toks[Math.floor(r() * toks.length)] = r() < 0.5 ? pick<string>(words) : pick<string>(LETTERS) + pick<string>(LETTERS);
    // An acrostic's letter: the repeated word stays itself, behind the letter; tokens take it as their first.
    if (acrostic) toks = kind === 'repeat' ? [acrostic[i % acrostic.length], ...toks] : [acrostic[i % acrostic.length] + toks[0].slice(1), ...toks.slice(1)];
    out.push(toks.join(' '));
  }
  return out.join('\n');
}

const PROBES: Array<{ name: string; verse: string; form?: string; acrostic?: string; deck: string[]; char: string }> = [
  { name: 'P5 acrostic wa/ib/tc', verse: 'wa\nib\ntc', form: 'acrostic', acrostic: 'wit', deck: ['DC-001', 'MO-001', 'CA-001'], char: 'DC-001' },
  { name: 'P5 crescendo ab', verse: 'ab\nab cd\nab cd ef', form: 'crescendo', deck: ['TP-001', 'DC-001', 'MO-001'], char: 'TP-001' },
  { name: 'P5 anaphora zz', verse: 'zz\nzz yy\nzz xx', form: 'anaphora', deck: ['SC-001', 'SC-002', 'SC-003'], char: 'SC-001' },
  { name: 'P5 couplet ab cd ga', verse: 'ab cd ga\nef gh ha', form: 'couplet', deck: ['DC-001', 'MO-001', 'CA-001'], char: 'DC-001' },
  { name: 'P9 Macbeth dare', verse: 'Dare\nDare me\nDare me, who dares', form: 'anaphora', deck: ['SC-001', 'SC-002', 'SC-003'], char: 'SC-001' },
  { name: 'P11 wa/ib/tc any form', verse: 'wa\nib\ntc', deck: ['DC-001', 'MO-001', 'CA-001'], char: 'DC-001' },
  { name: 'P11 ab cd ga any form', verse: 'ab cd ga\nef gh ha', deck: ['DC-001', 'MO-001', 'CA-001'], char: 'DC-001' },
];

describe('finding 25: tokens laid out in a form are not a verse, and a chant cannot multiply itself', () => {
  /** Round 1 against the written opponent, under the rule judge: did the player win? Did it take wordplay? */
  async function play(seed: number, deck: string[], char: string, verseFor: (form: string, lines: number, acrostic?: string) => string, formWanted?: string) {
    const d = createDuel(seed, 'en', { characters: deck, relics: [], potions: [] });
    const round = formWanted ? d.rounds.findIndex((p) => p.formId === formWanted) : 0;
    if (round < 0) return null;
    const plan = d.rounds[round];
    const form = getForm(plan.formId);
    // In a later round the opponent's verse answers an honest one of the player's; the player's earlier verses are honest.
    const previous = round > 0 ? 'I put the question to thy fading night\nAnd every answer burns a little bright' : undefined;
    const opp = (await writeOpponentVerse({ duel: d, roundIndex: round, difficulty: 'player', previousPlayerVerse: previous })).verse;
    const verse = verseFor(plan.formId, form.lines(plan.ctx), plan.ctx.acrostic);
    const judge = rulesJudge(verse, opp, 'en', lex());
    const res = resolveRound(d, round, { charId: char }, verse, opp, judge, previous);
    return { won: res.winner === 'player', wordplay: judge.criteria.wordplay === 'player', craft: res.player.craft, opp: res.opponent.craft, verse };
  }

  it("each of the checker's probes loses to the written opponent on at least 95% of seeds and never takes wordplay", async () => {
    const table: Record<string, unknown> = {};
    for (const p of PROBES) {
      let n = 0;
      let wins = 0;
      let wordplay = 0;
      let maxCraft = 0;
      for (let seed = 1; seed <= 400 && n < 100; seed++) {
        const g = await play(seed, p.deck, p.char, () => p.verse, p.form);
        if (!g) continue;
        n++;
        if (g.won) wins++;
        if (g.wordplay) wordplay++;
        maxCraft = Math.max(maxCraft, g.craft);
      }
      table[p.name] = { rounds: n, wins, wordplay, maxCraft };
      expect([p.name, n]).toEqual([p.name, 100]);
      expect([p.name, wins / n <= 0.05]).toEqual([p.name, true]);
      expect([p.name, wordplay]).toEqual([p.name, 0]);
    }
    log('degenerate: checker probes, 100 rounds each', table);
    // The finding's own numbers: "Dare / Dare me / Dare me, who dares" scored 45 craft; it may not reach it.
    const mac = scoreVerse({ verse: 'Dare\nDare me\nDare me, who dares', form: getForm('anaphora'), ctx: { lang: 'en' }, card: getCardById('SC-001')!, deckCharacters: ['SC-001', 'SC-002', 'SC-003'] });
    expect(mac.craft).toBeLessThan(45);
    expect(mac.multiplier).toBe(1);
  }, 300_000);

  it('mechanically made non-verses lose on at least 95% of seeds, in every house, and never take wordplay', async () => {
    const table: Record<string, { rounds: number; wins: number; wordplay: number }> = {};
    const examples: unknown[] = [];
    for (const kind of ['pairs', 'mash', 'repeat', 'two']) {
      for (const house of HOUSES) {
        const deck = houseDeck(house);
        const row = (table[`${kind}:${house}`] = { rounds: 0, wins: 0, wordplay: 0 });
        for (let seed = 1; seed <= 100; seed++) {
          const r = rng(seed * 104729 + kind.length);
          const g = await play(seed, deck.characters, deck.characters[0], (_f, lines, acrostic) => degenerate(kind, lines, r, acrostic));
          if (!g) continue;
          row.rounds++;
          if (g.won) row.wins++;
          if (g.wordplay) row.wordplay++;
          if ((g.won || g.wordplay) && examples.length < 40) examples.push({ kind, house, seed, ...g });
        }
      }
    }
    const worst = Object.entries(table).sort((a, b) => b[1].wins - a[1].wins).slice(0, 6);
    log('degenerate: examples that won or took wordplay', examples.slice(0, 12));
    log('degenerate: generated, worst houses (100 rounds each)', worst);
    for (const [k, row] of Object.entries(table)) {
      expect([k, row.wins / row.rounds <= 0.05]).toEqual([k, true]);
      expect([k, row.wordplay]).toEqual([k, 0]);
    }
  }, 600_000);

  it('every honest verse keeps its full form and is never void: banks and packs in all sixteen languages, and the test fixtures', () => {
    const lost: unknown[] = [];
    const lowestKnown: Record<string, number> = {};
    for (const lang of PACK_LANGS) {
      const pack = getPack(lang);
      for (const form of formsFor(lang)) {
        const verses = form.id === 'acrostic' ? [] : [...(pack.written[form.id] ?? []), ...(pack.spare?.[form.id] ?? [])];
        for (const v of verses) {
          const s = scoreForm(form, v, { lang });
          lowestKnown[lang] = Math.min(lowestKnown[lang] ?? 1, substance(v, lang).known);
          if (!s.kept || s.thin || s.earned !== 20) lost.push({ lang, form: form.id, v, earned: s.earned, thin: s.thin, known: substance(v, lang).known });
        }
      }
      for (const word of pack.acrostic) {
        const ctx = { lang, acrostic: word };
        for (const v of writtenCandidates(getForm('acrostic'), ctx, 1)) {
          const s = scoreForm(getForm('acrostic'), v, ctx);
          lowestKnown[lang] = Math.min(lowestKnown[lang] ?? 1, substance(v, lang).known);
          if (!s.kept || s.thin || s.earned !== 20) lost.push({ lang, form: 'acrostic', v, earned: s.earned, known: substance(v, lang).known });
        }
      }
    }
    log('substance: lowest share of real words in an honest pack verse, per language', lowestKnown);
    expect(lost).toEqual([]);
    // The thresholds sit under every honest verse and over the tokens.
    expect(Math.min(...Object.values(lowestKnown))).toBeGreaterThanOrEqual(FULL_KNOWN_SHARE);
    expect(MIN_KNOWN_SHARE).toBeLessThan(FULL_KNOWN_SHARE);
    // The fixtures of the other test files that are honest verses.
    const fixtures: Array<[string, string, string | undefined]> = [
      ['anaphora', 'Never fear\nNever yield\nNever kneel', undefined],
      ['crescendo', 'I rise\nI rise again\nI rise again and louder', undefined],
      ['acrostic', 'Words fail thee\nI know\nThy end', 'wit'],
      ['couplet', 'I told thee once and now I let thee know\nThy verse is melting faster than the snow', undefined],
      ['haiku', 'Romeo is gone\nJuliet is crying now\nA quiet poem', undefined],
      ['haiku', 'An old silent pond\nA frog jumps into the pond\nSplash! Silence again', undefined],
      ['couplet', 'Your candle? Hamlet laughs at such a light\nI put the question to your fading night', undefined],
      ['couplet', 'Thy rhymes are candles guttering in the night\nMine is the sun, and thou hast lost the light', undefined],
    ];
    for (const [f, v, acrostic] of fixtures) expect([v, scoreForm(getForm(f), v, { lang: 'en', acrostic })]).toMatchObject([v, { kept: true, earned: 20 }]);
    for (const v of ['Kneel\nWeep, fool\nThy doom has come', 'A candle?\nThen I snuff it', 'To be or not to be', 'Bold\nAnd\nRash\nDeeds', 'I\nI rise\nI rise again', 'O!\nRomeo, wherefore art thou']) {
      expect([v, substance(v, 'en').ok]).toEqual([v, true]);
    }
  });

  it('the cost to honest verses: how often a written verse, as the opponent plays it, multiplies less than in full', async () => {
    let rounds = 0;
    let reduced = 0;
    let lowest = 1;
    let landed = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const d = createDuel(seed, 'en', { characters: ['DC-001', 'MO-001', 'CA-001'], relics: [], potions: [] });
      for (let round = 0; round < 3; round++) {
        const plan = d.rounds[round];
        const opp = (await writeOpponentVerse({ duel: d, roundIndex: round, difficulty: 'player' })).verse;
        const s = scoreVerse({ verse: opp, form: getForm(plan.formId), ctx: plan.ctx, card: getCardById(plan.opponent.charId)!, deckCharacters: d.opponent.characters, trusted: true });
        rounds++;
        if (s.device.met || s.signature.met) {
          landed++;
          if (s.substance < 1) reduced++;
          lowest = Math.min(lowest, s.substance);
        }
      }
    }
    log('substance: written opponent rounds, rounds landing a device or signature, of those multiplied less than in full, lowest', [rounds, landed, reduced, lowest]);
    expect(reduced / landed).toBeLessThan(0.1);
    expect(OWN_WORDS_PER_LINE).toBe(1.5);
  }, 300_000);

  it('published verse is never void: every couplet of the phonetics corpora, and every quotation on the cards', async () => {
    // Independent of the game's own verses: poems from Wikisource the sound tables were tested on.
    const fs = await import('node:fs');
    const lowest: Record<string, number> = {};
    const voided: unknown[] = [];
    for (const lang of PACK_LANGS) {
      const file = `src/lib/verse/sound/corpus/${lang}.json`;
      if (!fs.existsSync(file)) continue;
      const corpus = JSON.parse(fs.readFileSync(file, 'utf8')) as { yes: string[][]; no: string[][] };
      for (const pair of [...corpus.yes, ...corpus.no]) {
        const v = pair.join('\n');
        const s = substance(v, lang);
        lowest[lang] = Math.min(lowest[lang] ?? 1, s.known);
        // A couplet of two or three words a line may have fewer different words than a verse needs; it is not void for want of words of the language.
        if (s.known < MIN_KNOWN_SHARE || !s.ok && s.distinct >= s.needed) voided.push({ lang, v, ...s });
      }
    }
    for (const c of CARD_CATALOG) {
      const s = substance(c.quote, 'en');
      lowest.cards = Math.min(lowest.cards ?? 1, s.known);
      if (s.known < MIN_KNOWN_SHARE) voided.push({ card: c.name, quote: c.quote, ...s });
    }
    log('substance: lowest share of real words in published verse (corpora), per language', lowest);
    expect(voided).toEqual([]);
  });

  it('the shortest real forms still score with their device: a haiku and a couplet', () => {
    const haiku = scoreVerse({ verse: 'An old silent pond\nA frog jumps into the pond\nSplash! Silence again', form: getForm('haiku'), ctx: { lang: 'en' }, card: getCardById('DC-001')!, deckCharacters: ['DC-001'] });
    expect([haiku.form.earned, haiku.voided]).toEqual([20, undefined]);
    const couplet = scoreVerse({ verse: 'Who dares to stand upon my stage?\nI put the question to thy rage', form: getForm('couplet'), ctx: { lang: 'en' }, card: getCardById('DC-001')!, deckCharacters: ['DC-001', 'DC-002', 'DC-003'] });
    expect([couplet.form.earned, couplet.device.met, couplet.substance]).toEqual([20, true, 1]);
    expect(couplet.craft).toBeGreaterThan(20);
  });

  it("the four probes of P5 are void: not words, or too few of them", () => {
    for (const [f, v, acrostic] of [['acrostic', 'wa\nib\ntc', 'wit'], ['crescendo', 'ab\nab cd\nab cd ef', undefined], ['anaphora', 'zz\nzz yy\nzz xx', undefined], ['couplet', 'ab cd ga\nef gh ha', undefined]] as const) {
      const s = scoreForm(getForm(f), v, { lang: 'en', acrostic });
      expect([v, s.earned, s.thin]).toEqual([v, 0, true]);
    }
  });
});

// --- Concerns ---

describe('concern: look-alike letters are read with Unicode confusables (UTS #39)', () => {
  const v = (verse: string, letter: string, lang = 'en') => CURSES['forbidden-letter'].violations(cleanVerse(verse, { unmix: false }), letter, lang);
  it("the checker's probe P4: every look-alike o and s counts", () => {
    const base = 'A rose alone on stone';
    for (const c of [0x585, 0x1d0f, 0x2c9f, 0xf8, 0x275, 0x3bf, 0x43e, 0x1d428]) expect([c.toString(16), v(base.replaceAll('o', cp(c)), 'o')]).toEqual([c.toString(16), 4]);
    for (const c of [0x57d, 0xa731, 0x455]) expect([c.toString(16), v('roses sing softly'.replaceAll('s', cp(c)), 's')]).toEqual([c.toString(16), 3]);
    expect(v(base, 'o')).toBe(4);
    expect(v('A bird sang at dawn', 'o')).toBe(0);
  });
  it('what a person sees is what the other rules read: a mixed word is unmixed by its look-alikes', () => {
    expect(cleanVerse(`r${cp(0x585)}se`)).toBe('rose');
    expect(cleanVerse(`r${cp(0x2c9f)}se`)).toBe('rose');
    expect(cleanVerse(`${cp(0x43c)}o${cp(0x43b)}o${cp(0x43a)}o`)).toBe(cp(0x43c, 0x43e, 0x43b, 0x43e, 0x43a, 0x43e));
  });
  it('the letters of a language are its own: Vietnamese đ is not d, Polish ł is not l', () => {
    expect(v('đêm dài', 'd', 'vi')).toBe(1);
    expect(v('đêm đen', 'đ', 'vi')).toBe(2);
    expect(v('mały las', 'l', 'pl')).toBe(1);
  });
});

describe('concern: honest digits are not curse violations', () => {
  const v = (verse: string, letter: string, lang = 'en') => CURSES['forbidden-letter'].violations(cleanVerse(verse, { unmix: false }), letter, lang);
  const honest: Array<[string, string]> = [
    ['en', 'I came 2nd at 6pm'], ['en', 'the 1990s in 3D'], ['en', 'the 4th act, the 21st night, 5km'],
    ['fr', 'le 1er et la 2e, au 3ème'], ['es', 'el 1º y la 2ª'], ['it', 'il 2º atto'], ['pt', 'a 1ª vez'], ['de', 'am 3. Tag'],
    ['pl', 'po 2. dniu'], ['ru', '1-й и 2-я'], ['id', 'yang ke-2'], ['ko', '1번 2층'], ['ja', '2つの夜'], ['zh', '第2天'],
    ['vi', 'lần thứ 2'], ['th', 'วันที่ 2'], ['ar', 'اليوم ٢'], ['hi', 'दिन २'],
  ];
  it('an ordinal, a unit or a decade breaks no Forbidden Letter that is not in its letters, in any language', () => {
    for (const [lang, verse] of honest) {
      const letters = new Set([...fold(verse)].filter((ch) => /\p{L}/u.test(ch)));
      const absent = getPack(lang).forbidden.filter((f) => !letters.has(fold(f)));
      for (const f of absent) expect([lang, verse, f, v(verse, f, lang)]).toEqual([lang, verse, f, 0]);
    }
    expect(CURSES['short-words'].violations(cleanVerse('the 1990s'), '', 'en')).toBe(0);
  });
  it('and a digit standing in for a letter still counts', () => {
    expect(v('r0se al0ne', 'o')).toBe(2);
    expect(v('I 1ove thee', 'l')).toBe(1);
    expect(v('w0nd3rful', 'e')).toBe(1);
    expect(v('ro$e', 's')).toBe(1);
    expect(v('r9se', 'o')).toBe(1);
    expect(CURSES['short-words'].violations(cleanVerse('w0nd3rful b3aut1ful'), '', 'en')).toBe(2);
  });
});

describe("concern: a signature is never landed by stop words (Viola's line is all of them)", () => {
  const viola = getCardById('IL-001')!;
  it('Viola is echoed by her phrase, said together, and not by "what" and "not" anywhere', () => {
    expect([signatureWords(viola), signatureNeeded(viola)]).toEqual([['not what'], 1]);
    for (const v of ['What? Not I!', 'Not what you think\nThe night is mine', 'What is not to like']) {
      const r = checkSignature(viola, v);
      expect([v, r.met]).toEqual([v, v.startsWith('Not what')]);
    }
    expect(checkSignature(viola, 'Thou art not what thou seemest').met).toBe(true);
    // Every other card's signature words are telling words, never stop words.
    for (const c of CARD_CATALOG.filter((x) => x.type === 'Character' && x.id !== 'IL-001')) {
      for (const w of signatureWords(c)) expect([c.name, w, isContentWord(w, 'en')]).toEqual([c.name, w, true]);
    }
  });
  it('the accident rate in the English bank (P10): how many honest verses land each signature unasked', () => {
    const verses = packVerses('en');
    const rates = CARD_CATALOG.filter((c) => c.type === 'Character').map((c) => [c.name, verses.filter((v) => checkSignature(c, v).met).length] as const);
    log('signature: bank verses (of n) landing each signature by accident', [verses.length, rates.filter(([, n]) => n > 0)]);
    expect(rates.find(([n]) => n === 'Viola')![1]).toBe(0);
  });
});

describe("concern: the rule judge's wit is fair to both sides", () => {
  /** Honest player verses (other verses of the pack for the round's form) against the written opponent, rule judge. */
  async function winRates(fair: boolean) {
    let rounds = 0;
    let playerRounds = 0;
    let wit = { player: 0, opponent: 0, split: 0 };
    let matches = 0;
    let playerMatches = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const d = createDuel(seed, 'en', { characters: ['DC-001', 'MO-001', 'CA-001'], relics: [], potions: [] });
      let previous: string | undefined;
      let won = 0;
      for (let round = 0; round < 3; round++) {
        const plan = d.rounds[round];
        const form = getForm(plan.formId);
        const opp = (await writeOpponentVerse({ duel: d, roundIndex: round, difficulty: 'player', previousPlayerVerse: previous })).verse;
        const bank = writtenCandidates(form, plan.ctx, seed * 31 + round).filter((v) => v !== opp);
        const mine = bank[seed % bank.length];
        // Before: the opponent was credited with answering the player's previous verse, or with nothing in round 1.
        const judge = fair ? rulesJudge(mine, opp, 'en', lex()) : rulesJudge(mine, opp, 'en', lex(), previous ?? '');
        const res = resolveRound(d, round, { charId: d.player.characters[round] }, mine, opp, judge, previous);
        rounds++;
        if (res.winner === 'player') {
          playerRounds++;
          won++;
        }
        wit[judge.criteria.wit]++;
        previous = mine;
      }
      matches++;
      if (won >= 2) playerMatches++;
    }
    return { rounds, playerRoundShare: +(playerRounds / rounds).toFixed(3), matches, playerMatchShare: +(playerMatches / matches).toFixed(3), wit };
  }
  it('measured: honest verses against the written opponent, before and after, 200 seeds', async () => {
    const before = await winRates(false);
    const after = await winRates(true);
    log('wit: before (one-sided)', before);
    log('wit: after (both sides compared on what both can do)', after);
    // One-sided, wit went to the player whenever a word was thrown back; fair, the opponent can take it too.
    expect(after.wit.opponent).toBeGreaterThan(0);
    expect(after.wit.player).toBeLessThan(before.wit.player);
  }, 300_000);
  it('in round 1 a verse that throws words back takes no wit for it from an opener that could not', () => {
    const opening = 'My candles burn like thunder in the night\nAnd all thy verses vanish from my sight';
    const answer = 'Thy candles drown beneath my thunder now\nI snuff them out and take the final bow';
    expect(rulesJudge(answer, opening, 'en', lex()).criteria.wit).toBe('split');
    // When both answered (a model wrote the opponent's verse to the player's last), comebacks are compared.
    const reply = 'Thy thunder is a whisper, and thy candles smoke\nI heard the final bow; it was a joke';
    expect(rulesJudge('A plain new line of mine\nAnother line, as fine', reply, 'en', lex(), answer).criteria.wit).toBe('opponent');
  });
});

describe('concern: a made-up word buys no syllable of slack in a haiku', () => {
  it('"Zorblatt is long gone now" is six by spelling, not five', () => {
    const met = (v: string) => scoreForm(getForm('haiku'), v, { lang: 'en' }).checks.map((c) => c.met);
    expect(met('Zorblatt is long gone now\nJuliet is crying now\nA quiet poem')[1]).toBe(false);
    expect(scoreForm(getForm('haiku'), 'Zorblatt is gone now\nJuliet is crying now\nA quiet poem', { lang: 'en' }).checks[1]).toMatchObject({ met: true, detail: '~5/5' });
  });
});

describe('concern: cleanVerse is idempotent', () => {
  it('cleanVerse(cleanVerse(x)) === cleanVerse(x) for 20,000 generated strings (seed 20261116)', () => {
    const r = rng(20261116);
    // Letters of many scripts, look-alikes, combining marks, invisibles, blanks, line breaks, digits, emoji.
    const pool = [
      ...'abcdefghijklmnopqrstuvwxyz ABCXYZ   \n\n\r\t',
      ...[0x301, 0x308, 0x34f, 0x200b, 0x200d, 0x2028, 0x2029, 0x85, 0xb, 0xc, 0xad, 0xfeff, 0x3164, 0x2800, 0xa0, 0x3000, 0xff41, 0xff4f, 0x1d428, 0x17f, 0xfb01, 0x2075, 0x2460].map((c) => cp(c)),
      ...[0x43e, 0x430, 0x435, 0x440, 0x3bf, 0x3b1, 0x585, 0x57d, 0x2c9f, 0x1d0f, 0xa731, 0xf8, 0x275, 0x43c, 0x43b, 0x43a].map((c) => cp(c)),
      ...'สวัสดีน้ำ', ...'नमस्ते', ...'مرحبا', ...'你好世界', ...'こんにちは', ...'안녕', ...'tiếng', '😀', '👍🏽', '0', '7', '!', '?', ',',
    ];
    let failures = 0;
    let example = '';
    for (let n = 0; n < 20000; n++) {
      const len = 1 + Math.floor(r() * (n % 50 === 0 ? 900 : 60));
      let s = '';
      for (let i = 0; i < len; i++) s += pool[Math.floor(r() * pool.length)];
      const once = cleanVerse(s);
      if (cleanVerse(once) !== once) {
        failures++;
        example ||= JSON.stringify(s);
      }
      const typed = cleanVerse(s, { unmix: false });
      if (cleanVerse(typed, { unmix: false }) !== typed) {
        failures++;
        example ||= JSON.stringify(s);
      }
    }
    expect([failures, example]).toEqual([0, '']);
  }, 300_000);
});
