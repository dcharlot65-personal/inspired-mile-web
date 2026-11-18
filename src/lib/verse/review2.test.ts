/**
 * The second independent check of the rules fixes (2026-11-16) refused the merge with three
 * blockers and a list of concerns. Its probes (zz-cr2-a to zz-cr2-e) are here as tests of the
 * fixed behaviour. Each block prints what it measured ("MEASURE ..."), recorded in
 * docs/language/RULES-MEASUREMENTS.md.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { CARD_CATALOG, getCardById } from '../cards';
import { loadMessages, type Locale } from '../../i18n/index';
import { carriesLines, createDuel, isCopy, resolveRound, rng, scoreVerse, type DuelDeck } from './duel';
import { formsFor, getForm, scoreForm } from './forms';
import { judgeLines, rulesJudge } from './judge';
import { writeOpponentVerse, writtenCandidates } from './opponent';
import { PACK_LANGS, getPack, loadAllPacks } from './packs';
import { loadPronunciation } from './pronounce';
import { allusionLexicon } from './referee';
import { rhymes } from './rhyme';
import { loadSound } from './sound';
import { STOP_WORDS, copyOf, isContentWord, lexiconHas, linesOf, substance } from './text';
import PRON from './pron-en';

const log = (k: string, v: unknown) => console.log(`MEASURE ${k} ${JSON.stringify(v)}`);
const lex = () => allusionLexicon();

beforeAll(async () => {
  await loadAllPacks();
  await Promise.all(PACK_LANGS.map((l) => loadSound(l)));
  expect(await loadPronunciation()).toBe(true);
}, 180_000);

function houseDeck(house: string): DuelDeck {
  const chars = CARD_CATALOG.filter((c) => c.type === 'Character');
  const mine = chars.filter((c) => c.house === house).map((c) => c.id);
  const rest = chars.filter((c) => c.house !== house).map((c) => c.id);
  return { characters: [...mine, ...rest].slice(0, 3), relics: [], potions: [] };
}
const HOUSES = [...new Set(CARD_CATALOG.filter((c) => c.type === 'Character').map((c) => c.house))];

// --- Blocker 1: copies with their lines moved ---

/** Line orders that keep each form's checks (rhyme pairs, syllable pattern, first or last word): the checker's. */
const PERM: Record<string, number[]> = {
  couplet: [1, 0],
  'heroic-couplet': [1, 0],
  'quatrain-aabb': [1, 0, 3, 2],
  'quatrain-abab': [2, 3, 0, 1],
  tercet: [2, 1, 0],
  haiku: [2, 1, 0],
  anaphora: [1, 2, 0],
  epistrophe: [1, 2, 0],
};
const POOLS: Record<string, string[]> = {
  en: ['crimson', 'hollow', 'bitter', 'golden', 'silent', 'broken', 'wicked', 'gentle', 'frozen', 'ancient', 'restless', 'shining', 'weary', 'tender'],
  es: ['oscuro', 'ardiente', 'amargo', 'dorado', 'callado', 'roto', 'perverso', 'suave', 'helado', 'antiguo', 'cansado', 'tierno'],
  fr: ['sombre', 'brûlant', 'amer', 'doré', 'muet', 'brisé', 'méchant', 'doux', 'glacé', 'ancien', 'las', 'tendre'],
  de: ['dunkel', 'brennend', 'bitter', 'golden', 'stumm', 'zerbrochen', 'böse', 'sanft', 'gefroren', 'uralt', 'müde', 'zart'],
};

/** The checker's edit: drop one content word of each line that is not its last; put k words of the pool in, spread through it. */
function dropAdd(verse: string, lang: string, k: number, pool: string[], r: () => number, drop = true): string {
  let n = Math.floor(r() * 100);
  return linesOf(verse)
    .map((l) => {
      const ws = l.split(' ');
      if (ws.length < 3) return l;
      const idx = ws.map((w, i) => (i < ws.length - 1 && isContentWord(w.replace(/[^\p{L}'’-]/gu, ''), lang) ? i : -1)).filter((i) => i >= 0);
      let out = [...ws];
      if (drop && idx.length) {
        const d = idx[Math.floor(r() * idx.length)];
        out = out.filter((_, i) => i !== d);
      }
      for (let j = 0; j < k; j++) out.splice(1 + ((n * 7 + j * 3) % Math.max(1, out.length - 1)), 0, pool[n++ % pool.length]);
      return out.join(' ');
    })
    .join('\n');
}

function permuted(verse: string, formId: string): string | null {
  const p = PERM[formId];
  const ls = linesOf(verse);
  if (!p || ls.length !== p.length) return null;
  return p.map((i) => ls[i]).join('\n');
}

describe('second check, blocker 1: a copy whose lines are moved the way the form allows is void', () => {
  it("the checker's SWAP probe: one word dropped a line, one to three put in, lines moved; 14 houses x 20 seeds x 3 rounds (en)", async () => {
    const pool = POOLS.en.filter((w) => !lex().has(w));
    const rows: Record<string, { n: number; voided: number; wins: number }> = {};
    for (const house of HOUSES) {
      const deck = houseDeck(house);
      for (let seed = 1; seed <= 20; seed++) {
        const d = createDuel(seed, 'en', deck);
        const r = rng(seed * 977 + house.length);
        for (let round = 0; round < 3; round++) {
          const plan = d.rounds[round];
          const opp = (await writeOpponentVerse({ duel: d, roundIndex: round, difficulty: 'player' })).verse;
          const kinds: Record<string, string | null> = {
            literal: opp,
            inplaceDrop1Add1: dropAdd(opp, 'en', 1, pool, r),
            inplaceDrop1Add2: dropAdd(opp, 'en', 2, pool, r),
            swapOnly: permuted(opp, plan.formId),
            swapAdd2: permuted(dropAdd(opp, 'en', 2, pool, r, false), plan.formId),
            swapDrop1Add1: permuted(dropAdd(opp, 'en', 1, pool, r), plan.formId),
            swapDrop1Add2: permuted(dropAdd(opp, 'en', 2, pool, r), plan.formId),
            swapDrop1Add3: permuted(dropAdd(opp, 'en', 3, pool, r), plan.formId),
          };
          for (const [kind, v] of Object.entries(kinds)) {
            if (v === null) continue;
            const res = resolveRound(d, round, { charId: deck.characters[round] }, v, opp, rulesJudge(v, opp, 'en', lex()));
            const row = (rows[kind] ??= { n: 0, voided: 0, wins: 0 });
            row.n++;
            if (res.player.voided === 'copied') row.voided++;
            if (res.winner === 'player') row.wins++;
          }
        }
      }
    }
    log('second check SWAP (en)', rows);
    for (const [k, row] of Object.entries(rows)) expect([k, row.voided, row.wins]).toEqual([k, row.n, 0]);
  }, 900_000);

  it("the checker's SWAP-ML: the same in Spanish, French and German (14 houses x 10 seeds x 3 rounds)", async () => {
    const rows: Record<string, { n: number; voided: number; wins: number }> = {};
    for (const lang of ['es', 'fr', 'de']) {
      for (const house of HOUSES) {
        const deck = houseDeck(house);
        for (let seed = 1; seed <= 10; seed++) {
          const d = createDuel(seed, lang, deck);
          const r = rng(seed * 131 + house.length);
          for (let round = 0; round < 3; round++) {
            const plan = d.rounds[round];
            const opp = (await writeOpponentVerse({ duel: d, roundIndex: round, difficulty: 'player' })).verse;
            for (const k of [1, 2, 3]) {
              const v = permuted(dropAdd(opp, lang, k, POOLS[lang], r), plan.formId);
              if (!v) continue;
              const res = resolveRound(d, round, { charId: deck.characters[round] }, v, opp, rulesJudge(v, opp, lang, lex()));
              const row = (rows[`${lang}:swapDrop1Add${k}`] ??= { n: 0, voided: 0, wins: 0 });
              row.n++;
              if (res.player.voided === 'copied') row.voided++;
              if (res.winner === 'player') row.wins++;
            }
          }
        }
      }
    }
    log('second check SWAP (es, fr, de)', rows);
    for (const [k, row] of Object.entries(rows)) expect([k, row.voided, row.wins]).toEqual([k, row.n, 0]);
  }, 900_000);

  it("the checker's hand-made grammatical copies with the Riposte deck are void, and lose", async () => {
    const deck = { characters: ['VC-001', 'VC-002', 'UW-001'], relics: [], potions: [] };
    // Seed 4 is the checker's own text; seeds 8 and 13 are made the same way: one word dropped a line,
    // two put in, the lines moved as the form allows (a tercet's first and last; an AABB quatrain within its pairs).
    const hand: Record<number, string> = {
      4: "And I am truly kind, for gentle mercy's sake\nA crooked, tender line that begs to be put down\nCall that a verse? I name it a sad, bitter mistake",
      8: 'And never arrives at any cold, bitter heart\nIt wanders, a sorry drunkard, in the deep dark\nThou a sharp tongue, I grant, but not the gentle art',
      13: 'And all thy cold lines are bitter leftovers, bought\nThe crowd came to see a grand and bloody battle fought\nI answer; thou art a feeble, empty breath of air\nSo speak, proud fool, and louder, if thou dare',
    };
    const out: unknown[] = [];
    for (const [seed, v] of Object.entries(hand)) {
      const d = createDuel(Number(seed), 'en', deck);
      const opp = (await writeOpponentVerse({ duel: d, roundIndex: 0, difficulty: 'player' })).verse;
      const res = resolveRound(d, 0, { charId: 'VC-001' }, v, opp, rulesJudge(v, opp, 'en', lex()));
      out.push({ seed, voided: res.player.voided ?? null, totals: [res.playerTotal, res.opponentTotal], winner: res.winner });
      expect([seed, res.player.voided, res.winner]).toEqual([seed, 'copied', 'opponent']);
    }
    log('second check hand copies', out);
  });

  it('battle-rap flips that change the punchline are answers; one that keeps five of seven words is a copy', () => {
    const flips: Array<[string, string, boolean]> = [
      ['Your crown is brass, your kingdom dust\nYour sword has turned to idle rust', 'My crown is gold, my kingdom wide, while yours is dust\nMy sword is sharp and bright, and yours is rust', false],
      ["Thy rhymes are weak, thy wit is slow\nThy verses limp where'er they go", 'My rhymes are strong, and thine are weak and slow\nMy verses fly, thy verses limp below where they go', false],
      ['I am the storm that breaks the shore\nI am the lion and the roar', 'You call yourself the storm? I break the shore\nYou are a kitten, and I am the roar', false],
      // Five of its seven content words are the other's, in order: the brief's own measure (share 0.71).
      ['The night is dark upon the stage\nI fill with fire every page', 'Your night is dark? I light the stage\nYour fire is smoke on every page', true],
    ];
    for (const [opp, v, copy] of flips) expect([v, isCopy(v, opp, 'en')]).toEqual([v, copy]);
  });

  it('the measure the line rule reads: a moved copy carries every line over with its last word; a flip does not', () => {
    const opp = 'Call that a verse? I call it a mistake\nA limping line that begs to be put down\nAnd I am kind enough, for mercy’s sake';
    const moved = "And I am truly kind, for gentle mercy's sake\nA crooked, tender line that begs to be put down\nCall that a verse? I name it a sad, bitter mistake";
    const c = copyOf(moved, opp, 'en');
    expect(c.carry.map((l) => [l.said, l.source, l.end])).toEqual([[8, 9, true], [8, 9, true], [7, 8, true]]);
    expect(carriesLines(c)).toBe(true);
    // The same lines in any order measure the same: the assignment does not depend on where the verse puts them.
    // (`line` names the verse's line, which moves with it; the rest is the same.)
    const bare = (x: typeof c.carry) => x.map(({ line: _line, ...rest }) => rest);
    expect(bare(copyOf(linesOf(moved).reverse().join('\n'), opp, 'en').carry)).toEqual(bare(c.carry));
    const flip = copyOf('My crown is gold, my kingdom wide, while yours is dust\nMy sword is sharp and bright, and yours is rust', 'Your crown is brass, your kingdom dust\nYour sword has turned to idle rust', 'en');
    expect(carriesLines(flip)).toBe(false);
  });
});

// --- Blocker 2: honest verses of short words ---

describe('second check, blocker 2: honest verses of short words keep their form, as on main', () => {
  it("the checker's HONEST-EN verses earn what main gives them", () => {
    // Every one of these earned 20 on main (3015db5) and 0 at ce2cb67.
    const verses: Array<[string, string]> = [
      ['couplet', 'My cat is fat, my dog is sad\nI am not bad, I am not mad'],
      ['couplet', 'The sun is hot, the sky is red\nGet up, get out, get out of bed'],
      ['crescendo', 'I am\nI am a man\nI am a man of God'],
      ['anaphora', 'I am a man\nI am a son\nI am the one'],
      ['tercet', 'Go, sad old man\nYou had your day\nNow end it as you can'],
      ['quatrain-aabb', 'The cat sat on the mat\nThe rat was fat and sat\nThe dog ran to the sea\nAnd that is all for me'],
      ['couplet', 'You got no bars, you got no cash\nI hit you hard, I make you dash'],
      ['couplet', 'Yo, I got the mic, I got the beat\nYou got no bars, you got cold feet'],
      ['anaphora', 'We real cool\nWe left school\nWe lurk late'],
    ];
    const out = verses.map(([f, v]) => ({ v, earned: scoreForm(getForm(f), v, { lang: 'en' }).earned }));
    log('second check HONEST-EN', out);
    for (const o of out) expect([o.v, o.earned]).toEqual([o.v, 20]);
  });

  it('three letters tell in a phrase, not in a list: "gum bet pig" still earns nothing', () => {
    expect(scoreForm(getForm('tercet'), 'gum bet pig\nbar yap ray ace\nsun lad vat', { lang: 'en' }).earned).toBe(0);
    expect(scoreForm(getForm('crescendo'), 'ah oh\nah oh ha\nah oh ha ox', { lang: 'en' }).earned).toBe(0);
    expect(substance('My cat is fat, my dog is sad\nI am not bad, I am not mad', 'en').telling).toBe(6);
    expect(substance('cat fat dog sad\nbad mad cat fat', 'en').telling).toBe(0);
  });
});

// --- Blocker 3: random katakana in Japanese ---

describe('second check, blocker 3: random katakana is not Japanese', () => {
  const KATA = [...'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワ'];
  const toKata = (s: string) => [...s].map((c) => String.fromCodePoint(c.codePointAt(0)! + 0x60)).join('');
  function gib(r: () => number, n: number): string {
    let s = '';
    for (let i = 0; i < n; i++) s += KATA[Math.floor(r() * KATA.length)];
    return s;
  }
  /** The checker's generator: katakana laid out in the round's form. */
  function kataVerse(formId: string, lines: number, acrostic: string | undefined, r: () => number): string {
    const head = gib(r, 2);
    const tail = gib(r, 2);
    const out: string[] = [];
    for (let i = 0; i < lines; i++) {
      let n = formId === 'haiku' ? [5, 7, 5][i] : formId === 'crescendo' ? 4 + i * 3 : 5 + Math.floor(r() * 4);
      let line = '';
      if (acrostic) {
        line += toKata([...acrostic][i]);
        n--;
      } else if (formId === 'anaphora') {
        line += head;
        n -= 2;
      }
      const a = Math.max(2, Math.floor(n / 2));
      line += gib(r, a);
      const rest = n - a;
      if (formId === 'epistrophe') line += ` ${gib(r, Math.max(0, rest - 2))}${tail}`;
      else if (rest > 0) line += ` ${gib(r, rest)}`;
      out.push(line);
    }
    return out.join('\n');
  }

  it("the checker's KATA probe: best of 60 by the live score, 14 houses x 20 seeds, round 1, loses at least 95%", async () => {
    const rows: Record<string, { rounds: number; wins: number; formFull: number; voided: number }> = {};
    for (const house of HOUSES) {
      const deck = houseDeck(house);
      const card = getCardById(deck.characters[0])!;
      for (let seed = 1; seed <= 20; seed++) {
        const d = createDuel(seed, 'ja', deck);
        const plan = d.rounds[0];
        const form = getForm(plan.formId);
        const opp = (await writeOpponentVerse({ duel: d, roundIndex: 0, difficulty: 'player' })).verse;
        const honest = writtenCandidates(form, plan.ctx, seed * 31).find((v) => v !== opp)!;
        const r = rng(seed * 6007 + house.length);
        let best = '';
        let bestCraft = -1;
        for (let t = 0; t < 60; t++) {
          const v = kataVerse(plan.formId, form.lines(plan.ctx), plan.ctx.acrostic, r);
          const sc = scoreVerse({ verse: v, form, ctx: plan.ctx, card, deckCharacters: deck.characters, opponentVerse: opp });
          if (sc.craft > bestCraft) [best, bestCraft] = [v, sc.craft];
        }
        for (const [name, v] of Object.entries({ honestBank: honest, katakana: best })) {
          const res = resolveRound(d, 0, { charId: deck.characters[0] }, v, opp, rulesJudge(v, opp, 'ja', lex()));
          const row = (rows[name] ??= { rounds: 0, wins: 0, formFull: 0, voided: 0 });
          row.rounds++;
          if (res.winner === 'player') row.wins++;
          if (res.player.form.earned === 20) row.formFull++;
          if (res.player.voided) row.voided++;
        }
      }
    }
    log('second check KATA (best of 60, round 1)', rows);
    expect(rows.katakana.wins / rows.katakana.rounds).toBeLessThanOrEqual(0.05);
    // The probe can see a win: the honest bank verse wins most of the same rounds.
    expect(rows.honestBank.wins / rows.honestBank.rounds).toBeGreaterThan(0.5);
  }, 900_000);

  it('loanwords in a Japanese sentence still count as words; the same katakana standing alone does not', () => {
    for (const v of ['スマホの光が夜を裂く\nインフルエンサーは眠らない\nバズる言葉で君を斬る', 'ツイートみたいな軽い詩\nリツイートすらされないぜ\nオワコンだよ、お前のフロー', 'エモいライムでぶちかます\nディスるだけならワンチャンない\nガチで勝負だ、ステージで']) {
      expect([v, substance(v, 'ja').known >= 0.7]).toEqual([v, true]);
    }
    expect(substance('ヤラナ セスルリ\nロヒワ レニヌキ', 'ja').ok).toBe(false);
    expect(substance('スマホ インフルエンサー\nツイート リツイート', 'ja').known).toBeLessThan(0.6);
  });
});

// --- Concerns ---

describe('second check, concerns', () => {
  it("words of the English table of four letters or more count though SCOWL lacks them (names: Haiti, Toussaint, Antonio, Regan)", () => {
    for (const w of ['haiti', 'haitian', 'toussaint', 'christophe', 'antonio', 'regan']) expect([w, lexiconHas(w, 'en')]).toEqual([w, true]);
    // Strings of two and three letters SCOWL does not list are still not words.
    for (const w of ['oz', 'mt', 'ul', 'ab', 'fsi']) expect([w, lexiconHas(w, 'en')]).toEqual([w, false]);
    // A word no list has counts toward the floor inside a phrase, and tells nothing.
    const v = "Shawty, I'm finna flex, my drip is too clean\nYour opps be trippin, lil bruh, you ain't never been seen";
    // (Since the third check such a word must also be one that can be said, text.ts sayable; this
    // verse keeps 0.85 of its words or more and its full form points: FULL_KNOWN_SHARE is 0.7.)
    expect(substance(v, 'en').known).toBeGreaterThanOrEqual(0.85);
    expect(scoreForm(getForm('couplet'), v, { lang: 'en' }).scale).toBe(1);
    expect(substance('qwer asdf zxcv\nsdfg xcvb hjkl', 'en').known).toBe(0);
  });

  it("the rule judge: an '!' at the end of a line decides nothing; wordplay counts different telling words", () => {
    const opp = 'My candles burn like thunder in the night\nAnd all thy verses vanish from my sight';
    const v = 'Thy candles drown beneath my thunder now\nI snuff them out and take the final bow';
    const bang = linesOf(v).map((l) => `${l}!`).join('\n');
    expect(rulesJudge(bang, opp, 'en', lex()).criteria).toEqual(rulesJudge(v, opp, 'en', lex()).criteria);
    expect(rulesJudge(v, opp, 'en', lex()).criteria.wit).toBe('split');
  });

  it("the checker's SALAD-MATCH: salads of real words no longer beat honest verses by much, with or without '!'", async () => {
    type Entry = { w: string; counts: number[]; key: string };
    const entries: Entry[] = [];
    for (const line of PRON.split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const tab = line.indexOf('\t');
      if (tab < 1) continue;
      for (const e of line.slice(tab + 1).split(' ')) {
        const m = /^(.*?)(\d+)([*^]?)$/.exec(e);
        if (m && !m[3]) entries.push({ w: m[1], counts: [...m[2]].map(Number), key: line.slice(0, tab) });
      }
    }
    const pool = entries.filter((e) => /^[a-z]{4,7}$/.test(e.w) && !STOP_WORDS.has(e.w) && isContentWord(e.w, 'en') && lexiconHas(e.w, 'en') === true && !lex().has(e.w));
    const byKey = new Map<string, string[]>();
    for (const e of pool) byKey.set(e.key, [...(byKey.get(e.key) ?? []), e.w]);
    const rhymeSets = [...byKey.values()].filter((ws) => ws.length >= 2);
    const bySyl = [1, 2, 3].map((n) => pool.filter((e) => e.counts.length === 1 && e.counts[0] === n).map((e) => e.w));
    const words = pool.map((e) => e.w);
    function salad(formId: string, lines: number, acrostic: string | undefined, r: () => number): string {
      const pick = (xs: string[]) => xs[Math.floor(r() * xs.length)];
      const pair = () => {
        for (;;) {
          const s = pick(rhymeSets);
          const a = pick(s);
          const b = pick(s);
          if (a !== b && rhymes(a, b, 'en')) return [a, b];
        }
      };
      const sylLine = (n: number, end?: string) => {
        const out: string[] = [];
        let left = n - (end ? (pool.find((e) => e.w === end)?.counts[0] ?? 1) : 0);
        while (left > 0) {
          const s = Math.min(left, 1 + Math.floor(r() * 3));
          out.push(pick(bySyl[s - 1]));
          left -= s;
        }
        if (end) out.push(end);
        return out;
      };
      const ends: (string | undefined)[] = new Array(lines).fill(undefined);
      if (formId === 'couplet' || formId === 'heroic-couplet') [ends[0], ends[1]] = pair();
      if (formId === 'quatrain-aabb') { [ends[0], ends[1]] = pair(); [ends[2], ends[3]] = pair(); }
      if (formId === 'quatrain-abab') { [ends[0], ends[2]] = pair(); [ends[1], ends[3]] = pair(); }
      if (formId === 'tercet') [ends[0], ends[2]] = pair();
      const head = pick(words);
      const ls: string[] = [];
      for (let i = 0; i < lines; i++) {
        let toks: string[];
        if (formId === 'haiku') toks = sylLine([5, 7, 5][i]);
        else if (formId === 'heroic-couplet') toks = sylLine(10, ends[i]);
        else {
          const k = formId === 'crescendo' ? i + 2 : 3 + Math.floor(r() * 3);
          toks = [];
          if (acrostic) toks.push(pick(words.filter((w) => w.startsWith([...acrostic][i].toLowerCase()))) ?? pick(words));
          else if (formId === 'anaphora') toks.push(head);
          while (toks.length < k - (ends[i] ? 1 : 0)) toks.push(pick(words));
          if (ends[i]) toks.push(ends[i]!);
        }
        const line = toks.join(' ');
        ls.push(line[0].toUpperCase() + line.slice(1));
      }
      return ls.join('\n');
    }
    const bang = (v: string) => linesOf(v).map((l, i) => (i < 2 ? `${l}!` : l)).join('\n');
    const rows: Record<string, { rounds: number; roundWins: number; matches: number; matchWins: number }> = {};
    for (const house of HOUSES) {
      const deck = houseDeck(house);
      for (let seed = 1; seed <= 30; seed++) {
        const d = createDuel(seed, 'en', deck);
        const r = rng(seed * 911 + house.length);
        const wins: Record<string, number> = {};
        for (let round = 0; round < 3; round++) {
          const plan = d.rounds[round];
          const form = getForm(plan.formId);
          const card = getCardById(deck.characters[round])!;
          const opp = (await writeOpponentVerse({ duel: d, roundIndex: round, difficulty: 'player' })).verse;
          const honest = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((k) => writtenCandidates(form, plan.ctx, seed * 31 + round + k * 101)).find((v) => v !== opp && !isCopy(v, opp, 'en')) ?? null;
          let best = '';
          let bestCraft = -1;
          for (let t = 0; t < 60; t++) {
            const v = salad(plan.formId, form.lines(plan.ctx), plan.ctx.acrostic, r);
            const sc = scoreVerse({ verse: v, form, ctx: plan.ctx, card, deckCharacters: deck.characters, opponentVerse: opp });
            if (sc.craft > bestCraft) [best, bestCraft] = [v, sc.craft];
          }
          const variants: Record<string, string> = { salad: best, 'salad!': bang(best), ...(honest ? { honest, 'honest!': bang(honest) } : {}) };
          for (const [name, v] of Object.entries(variants)) {
            const res = resolveRound(d, round, { charId: deck.characters[round] }, v, opp, rulesJudge(v, opp, 'en', lex()));
            const row = (rows[name] ??= { rounds: 0, roundWins: 0, matches: 0, matchWins: 0 });
            row.rounds++;
            if (res.winner === 'player') {
              row.roundWins++;
              wins[name] = (wins[name] ?? 0) + 1;
            }
          }
        }
        for (const name of Object.keys(rows)) {
          rows[name].matches++;
          if ((wins[name] ?? 0) >= 2) rows[name].matchWins++;
        }
      }
    }
    log('second check SALAD-MATCH (14 houses x 30 seeds, full matches, rule judge)', rows);
    const rate = (k: string) => rows[k].matchWins / rows[k].matches;
    // At ce2cb67: salad 270, salad! 411, honest 228, honest! 335 of 420.
    expect(rate('salad!') - rate('salad')).toBeLessThan(0.1);
    expect(rate('salad')).toBeLessThan(rate('honest') + 0.1);
  }, 1_200_000);

  it('a little word of the duel\'s language is not read as an English number: Polish "ten" is "this"', () => {
    expect(judgeLines('Ten wiersz jest mój', 'pl').left).toEqual([]);
    expect(judgeLines('Ten out of ten', 'en').left).toEqual([1]);
    expect(judgeLines('Ocena: pięć', 'pl').left).toEqual([1]);
    expect(judgeLines('Grade: ten', 'pl').left).toEqual([1]);
  });

  it("the checklist's example words are words the grader does leave out, in every language", async () => {
    const found: Record<string, string[]> = {};
    for (const lang of PACK_LANGS) {
      const msg = (await loadMessages(lang as Locale))['live.judgeUnread'];
      expect([lang, typeof msg]).toEqual([lang, 'string']);
      const m = /[(（]([^)）]+?)(?:…|……)[)）]/u.exec(msg);
      expect([lang, !!m]).toEqual([lang, true]);
      const words = m![1].split(/[,，、،]\s*/u).map((w) => w.trim()).filter(Boolean);
      found[lang] = words;
      for (const w of words) expect([lang, w, judgeLines(w, lang).left]).toEqual([lang, w, [1]]);
    }
    log('second check: checklist example words', found);
  });

  it('every pack verse still keeps its full form after the floor and the katakana rule changed', () => {
    const lost: unknown[] = [];
    for (const lang of PACK_LANGS) {
      const pack = getPack(lang);
      for (const form of formsFor(lang)) {
        if (form.id === 'acrostic') continue;
        for (const v of [...(pack.written[form.id] ?? []), ...(pack.spare?.[form.id] ?? [])]) {
          const s = scoreForm(form, v, { lang });
          if (s.earned !== 20) lost.push({ lang, form: form.id, v, earned: s.earned });
        }
      }
    }
    expect(lost).toEqual([]);
  });
});
