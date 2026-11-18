/**
 * The third independent check of the rules fixes (2026-11-17) refused the merge with two blockers
 * and a list of concerns. Its probes (zz-c3-copy, zz-c3-hand, zz-c3-ja, zz-c3-mash) are here as
 * tests of the fixed behaviour, with the engine pass's own measurements beside them. Each block
 * prints what it measured ("MEASURE ..."), recorded in docs/language/RULES-MEASUREMENTS.md.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { CARD_CATALOG, getCardById } from '../cards';
import { carriesLines, createDuel, isCopy, resolveRound, rng, scoreVerse, type DuelDeck } from './duel';
import { getForm, scoreForm } from './forms';
import { rulesJudge } from './judge';
import { writeOpponentVerse, writtenCandidates } from './opponent';
import { PACK_LANGS, getPack, loadAllPacks } from './packs';
import { loadPronunciation } from './pronounce';
import { allusionLexicon } from './referee';
import { rhymeKey, rhymes } from './rhyme';
import { loadSound } from './sound';
import { STOP_WORDS, copyOf, fold, isContentWord, isStopWord, lexiconHas, linesOf, substance, syllablesInWord, wordsOf } from './text';
import PRON from './pron-en';

const log = (k: string, v: unknown) => console.log(`MEASURE ${k} ${JSON.stringify(v)}`);
const lex = () => allusionLexicon();

beforeAll(async () => {
  await loadAllPacks();
  await Promise.all(PACK_LANGS.map((l) => loadSound(l)));
  expect(await loadPronunciation()).toBe(true);
}, 300_000);

const HOUSES = [...new Set(CARD_CATALOG.filter((c) => c.type === 'Character').map((c) => c.house))];
function houseDeck(house: string): DuelDeck {
  const chars = CARD_CATALOG.filter((c) => c.type === 'Character');
  const mine = chars.filter((c) => c.house === house).map((c) => c.id);
  const rest = chars.filter((c) => c.house !== house).map((c) => c.id);
  return { characters: [...mine, ...rest].slice(0, 3), relics: [], potions: [] };
}

// --- Blocker 1: a copy that swaps each line's rhyme word for another rhyme ---

/** Line orders that keep each form's checks (the checker's). */
const PERM: Record<string, number[]> = {
  couplet: [1, 0], 'heroic-couplet': [1, 0], 'quatrain-aabb': [1, 0, 3, 2], 'quatrain-abab': [2, 3, 0, 1], tercet: [2, 1, 0], haiku: [2, 1, 0], anaphora: [1, 2, 0], epistrophe: [1, 2, 0],
};
const ADJ: Record<string, string[]> = {
  en: ['crimson', 'hollow', 'bitter', 'golden', 'silent', 'broken', 'wicked', 'gentle', 'frozen', 'ancient', 'restless', 'weary'],
  es: ['oscuro', 'ardiente', 'amargo', 'dorado', 'callado', 'roto', 'perverso', 'suave', 'helado', 'antiguo', 'cansado', 'tierno'],
  fr: ['sombre', 'brûlant', 'amer', 'doré', 'muet', 'brisé', 'méchant', 'doux', 'glacé', 'ancien', 'las', 'tendre'],
  de: ['dunkel', 'brennend', 'bitter', 'golden', 'stumm', 'zerbrochen', 'böse', 'sanft', 'gefroren', 'uralt', 'müde', 'zart'],
  it: ['oscuro', 'ardente', 'amaro', 'dorato', 'muto', 'rotto', 'perfido', 'dolce', 'gelido', 'antico', 'stanco', 'tenero'],
  pt: ['escuro', 'ardente', 'amargo', 'dourado', 'calado', 'partido', 'perverso', 'suave', 'gelado', 'antigo', 'cansado', 'terno'],
};

/** Candidate words by rhyme key: the English table's listed words; elsewhere every word of the pack's verses. */
const pools = new Map<string, { byKey: Map<string, string[]>; all: string[] }>();
function poolFor(lang: string) {
  let p = pools.get(lang);
  if (p) return p;
  const words = new Set<string>();
  if (lang === 'en') {
    for (const line of PRON.split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const tab = line.indexOf('\t');
      if (tab < 1) continue;
      for (const e of line.slice(tab + 1).split(' ')) {
        const m = /^([a-z]{3,9})(\d+)$/.exec(e);
        if (m && !isStopWord(m[1], 'en') && lexiconHas(m[1], 'en') === true) words.add(m[1]);
      }
    }
  } else {
    const pack = getPack(lang);
    for (const group of [pack.written, pack.spare ?? {}]) for (const vs of Object.values(group)) for (const v of vs as string[]) for (const w of wordsOf(v, lang)) if (/^\p{L}{3,}$/u.test(w)) words.add(w.toLowerCase());
  }
  const byKey = new Map<string, string[]>();
  for (const w of words) {
    const k = rhymeKey(w, lang);
    if (k) byKey.set(k, [...(byKey.get(k) ?? []), w]);
  }
  p = { byKey, all: [...words].filter((w) => isContentWord(w, lang)) };
  pools.set(lang, p);
  return p;
}

/** A word to put in place of `w`: of the same syllables, not in the source, and (mode 'rhyme') rhyming with it. */
function swapFor(w: string, lang: string, source: string, seed: number, mode: 'rhyme' | 'any'): string | null {
  const { byKey, all } = poolFor(lang);
  const fw = fold(w);
  const syl = syllablesInWord(w, lang);
  const inSource = new Set(wordsOf(source, lang).map(fold));
  const ok = (c: string) => {
    const fc = fold(c);
    return fc !== fw && fc.slice(0, 4) !== fw.slice(0, 4) && !inSource.has(fc) && (syl === null || syllablesInWord(c, lang) === syl) && (mode === 'any' || rhymes(w, c, lang));
  };
  let cands = mode === 'rhyme' ? (byKey.get(rhymeKey(w, lang)) ?? []).filter(ok) : all.filter(ok);
  if (!cands.length && mode === 'rhyme' && lang !== 'en') cands = [...byKey.values()].flat().filter(ok);
  return cands.length ? cands[(seed * 7919 + fw.length * 31) % cands.length] : null;
}

/** Every line's last word replaced (the same word always by the same one); null unless every line could be. */
function endSwap(verse: string, lang: string, seed: number, mode: 'rhyme' | 'any'): string | null {
  const map = new Map<string, string | null>();
  const ls = linesOf(verse);
  let swapped = 0;
  const out = ls.map((l) => {
    const m = /(\p{L}[\p{L}\p{M}'’-]*)([^\p{L}]*)$/u.exec(l);
    if (!m) return l;
    const k = fold(m[1]);
    if (!map.has(k)) map.set(k, swapFor(m[1], lang, verse, seed, mode));
    const r = map.get(k);
    if (!r) return l;
    swapped++;
    return l.slice(0, m.index) + (m[1][0] === m[1][0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r) + m[2];
  });
  return swapped === ls.length ? out.join('\n') : null;
}
function addWords(verse: string, lang: string, k: number, n0: number): string {
  let n = n0;
  return linesOf(verse)
    .map((l) => {
      const ws = l.split(' ');
      for (let j = 0; j < k; j++) ws.splice(1 + j, 0, ADJ[lang][n++ % ADJ[lang].length]);
      return ws.join(' ');
    })
    .join('\n');
}
function permuted(verse: string, formId: string): string | null {
  const p = PERM[formId];
  const ls = linesOf(verse);
  return p && ls.length === p.length ? p.map((i) => ls[i]).join('\n') : null;
}

describe('third check, blocker 1: a copy with its rhyme words swapped for other rhymes is void', () => {
  it("the checker's own couplet: 'fight/sight' at the line ends and two words put in", () => {
    const opp = 'Thy rhymes are candles guttering in the night\nMine is the sun, and thou hast lost the light';
    const v = 'Thy feeble rhymes are candles guttering in the fight\nMine is the blazing sun, and thou hast lost the sight';
    expect(isCopy(v, opp, 'en')).toBe(true);
    // With a line of its own added, only the rhyme tells: the measure alone (the source line's own last
    // word kept) does not see the copy, and isCopy, which asks whether the line ends rhyme, does.
    const plus = `${v}\nAnd so I end my verse tonight`;
    expect(carriesLines(copyOf(plus, opp, 'en'))).toBe(false);
    expect(isCopy(plus, opp, 'en')).toBe(true);
    // Throwing the rhyme back into an answer of one's own is not a copy.
    expect(isCopy('Thy candles gutter and they lose the fight\nI am the dawn that steals away thy night', opp, 'en')).toBe(false);
  });

  it("the checker's ENDSWAP (zz-c3-copy): rhyme swaps, one or two words put in, lines moved; en 14 houses x 20 seeds, es/fr/de/it/pt x 10", async () => {
    const rows: Record<string, { n: number; voided: number; wins: number }> = {};
    for (const lang of ['en', 'es', 'fr', 'de', 'it', 'pt']) {
      const seeds = lang === 'en' ? 20 : 10;
      for (const house of HOUSES) {
        const deck = houseDeck(house);
        for (let seed = 1; seed <= seeds; seed++) {
          const d = createDuel(seed, lang, deck);
          for (let round = 0; round < 3; round++) {
            const plan = d.rounds[round];
            const opp = (await writeOpponentVerse({ duel: d, roundIndex: round, difficulty: 'player' })).verse;
            const kinds: Record<string, string | null> = { literal: opp };
            const honest = [0, 1, 2, 3, 4, 5].flatMap((k) => writtenCandidates(getForm(plan.formId), plan.ctx, seed * 31 + round + k * 101)).find((v) => v !== opp && !isCopy(v, opp, lang));
            if (honest) kinds.honest = honest;
            for (const mode of lang === 'en' ? (['rhyme', 'any'] as const) : (['rhyme'] as const)) {
              const sw = endSwap(opp, lang, seed + round, mode);
              if (!sw) continue;
              Object.assign(kinds, {
                [`${mode}:swap`]: sw,
                [`${mode}:swapAdd1`]: addWords(sw, lang, 1, seed + round),
                [`${mode}:swapAdd2`]: addWords(sw, lang, 2, seed + round),
                [`${mode}:swapAdd1Moved`]: permuted(addWords(sw, lang, 1, seed + round), plan.formId),
              });
            }
            for (const [kind, v] of Object.entries(kinds)) {
              if (v === null) continue;
              const res = resolveRound(d, round, { charId: deck.characters[round] }, v, opp, rulesJudge(v, opp, lang, lex()));
              const row = (rows[`${lang}:${kind}`] ??= { n: 0, voided: 0, wins: 0 });
              row.n++;
              if (res.player.voided) row.voided++;
              if (res.winner === 'player') row.wins++;
            }
          }
        }
      }
    }
    log('third check ENDSWAP (rows, void, won)', rows);
    for (const [k, row] of Object.entries(rows)) {
      if (k.endsWith(':honest')) continue;
      expect([k, row.voided, row.wins]).toEqual([k, row.n, 0]);
    }
    // The probe can see a win: the honest verse wins in every language.
    for (const lang of ['en', 'es', 'fr', 'de', 'it', 'pt']) expect([lang, rows[`${lang}:honest`].wins > 0]).toEqual([lang, true]);
  }, 1_200_000);

  it("the checker's hand-made copies (zz-c3-hand), deck VC-001/VC-002/UW-001, round 1: all void, none won", async () => {
    const HAND: Record<number, string> = {
      1: 'A small voice, far gone\nI turn my head to hear them\nIt was the wind, child',
      3: 'Thy sorry verse limps in upon a wooden peg\nAnd begs the crowd to pity its poor hound\nI will not kick a broken man who comes to beg\nI simply leave him sitting on the mound',
      4: "Call that a verse? I call it a sad fake\nA limping, crooked line that begs to be run aground\nAnd I am kind enough, for mercy's sake",
      7: 'My worst line is the equal of thy test\nOnce more thou openest thy foolish mouth in pain\nOut, out, brief candle of a crime\nNow hear how verses ought to ring',
      8: 'Thou hast a tongue, I grant, but not the smart\nIt wanders like a weary drunkard in the park\nAnd never once arrives at any part',
      11: 'Pray silence for a verse that earns applause\nLoud is not the same as good, my foolish fellow\nAll thy lines are borrowed and returned unseen\nYet again thy line arrives too slow',
      13: 'The eager crowd came here to see a battle wrought\nAnd all thy lines are leftovers, cheaply sought\nSo speak again, and louder, if thou care\nI answer storms; thou art a breath of prayer',
      15: 'Never have I heard so much said of so few\nNever has a stage endured so thin a sound\nNever again, I think, will this tired crowd stay',
    };
    const deck = { characters: ['VC-001', 'VC-002', 'UW-001'], relics: [], potions: [] };
    const out: unknown[] = [];
    for (const [seed, v] of Object.entries(HAND)) {
      const d = createDuel(Number(seed), 'en', deck);
      const opp = (await writeOpponentVerse({ duel: d, roundIndex: 0, difficulty: 'player' })).verse;
      const res = resolveRound(d, 0, { charId: 'VC-001' }, v, opp, rulesJudge(v, opp, 'en', lex()));
      out.push({ seed, voided: res.player.voided ?? null, totals: [res.playerTotal, res.opponentTotal] });
      expect([seed, res.player.voided, res.winner]).toEqual([seed, 'copied', 'opponent']);
    }
    log('third check hand copies', out);
  });

  it('published verse is not a copy of published verse more often than before: corpus pairs and ripostes made from them', async () => {
    const fs = await import('node:fs');
    const out: Record<string, { pairs: number; flagged: number; ripostes: number; ripFlagged: number }> = {};
    const flagged: unknown[] = [];
    for (const lang of PACK_LANGS) {
      const file = `src/lib/verse/sound/corpus/${lang}.json`;
      if (!fs.existsSync(file)) continue;
      const corpus = JSON.parse(fs.readFileSync(file, 'utf8')) as { yes: string[][]; no: string[][] };
      const vs = [...new Set([...corpus.yes, ...corpus.no].map((p) => p.join('\n')))];
      const key = (l: string) => l.toLowerCase().replace(/[^\p{L}\p{M}]+/gu, ' ').trim();
      const row = { pairs: 0, flagged: 0, ripostes: 0, ripFlagged: 0 };
      for (const a of vs) {
        for (const b of vs) {
          if (a === b) continue;
          const bl = new Set(linesOf(b).map(key));
          if (linesOf(a).some((l) => bl.has(key(l)))) continue;
          row.pairs++;
          if (isCopy(a, b, lang)) {
            row.flagged++;
            flagged.push({ lang, a, b });
          }
        }
      }
      if (!['zh', 'ja', 'th'].includes(lang)) {
        for (let i = 0; i < vs.length; i++) {
          const src = vs[i];
          const words = [...new Set(linesOf(src).flatMap((l) => l.split(/\s+/)).map((w) => w.replace(/[^\p{L}\p{M}'’-]/gu, '')).filter((w) => w && isContentWord(w, lang)))];
          if (words.length < 4) continue;
          const ans = linesOf(vs[(i + 7) % vs.length]);
          row.ripostes++;
          const rip = [`${ans[0]} ${words.slice(0, 2).join(' ')}`, `${ans[1] ?? ''} ${words.slice(-1)[0]}`].join('\n');
          if (isCopy(rip, src, lang)) {
            row.ripFlagged++;
            flagged.push({ lang, rip, src });
          }
        }
      }
      out[lang] = row;
    }
    log('third check: published couplets (pairs sharing no line, ripostes)', out);
    log('third check: published couplets flagged', flagged);
    // Before this pass: 4 pairs (Busch's refrain, the gurindam formula) and 2 ripostes; the new line rule adds none.
    expect(Object.values(out).reduce((n, r) => n + r.flagged, 0)).toBeLessThanOrEqual(4);
    expect(Object.values(out).reduce((n, r) => n + r.ripFlagged, 0)).toBeLessThanOrEqual(2);
  }, 900_000);
});

// --- Blocker 2: honest Japanese verses with a line of katakana loanwords ---

describe('third check, blocker 2: a line of katakana loanwords in a Japanese verse counts', () => {
  const HONEST: Array<[string, string]> = [
    ['plain haiku', '古池や\n蛙飛び込む\n水の音'],
    ['loanword sentence', 'スマホの光が夜を裂く\nインフルエンサーは眠らない\nバズる言葉で君を斬る'],
    ['christmas', 'クリスマス\n雪ふる夜に\nプレゼント'],
    ['happy end', '春の風\nハッピーエンド\n君と見る'],
    ['love song', 'ラブソング\n君に届けたい\nこの想い'],
    ['ice cream', '夏の午後\nアイスクリーム\nとけていく'],
    ['coffee cup', '朝の窓\nコーヒーカップに\n光さす'],
    ['soccer ball', 'サッカーボール\n空高く蹴る\n少年よ'],
    ['roller coaster', '遊園地\nジェットコースター\n風になる'],
    ['shakespeare', 'シェイクスピア\n舞台の上で\n夢を見る'],
    ['christmas eve', 'クリスマスイブ\n君の手をとる\n雪の夜'],
    ['rap opener', 'マイクチェック ワンツー\nお前のライムはもう古い\n俺のフローで終わらせる'],
    ['hip hop dream', 'ヒップホップ ドリーム\n俺の言葉が街を揺らす\nお前の声は届かない'],
    ['romeo juliet', 'ロミオとジュリエット\n恋の終わりは\n毒の杯'],
  ];
  const RANDOM: Array<[string, string]> = [
    ['random katakana', 'ヤラナ セスルリ\nロヒワ レニヌキ\nムホテ サクヨ'],
    ['one real line, two random', '古池や\nヤラナ セスルリ\nロヒワ レニヌキ'],
    ['two real lines, one random', '古池や\nヤラナ セスルリ\n水の音'],
    ['random with long marks', 'ヤラーナ セスールリ\nロヒワー レニヌーキ\nムホテー サクヨー'],
    ['two real lines, one random with long marks', '古池や\nヤラーナ セスールリ\n水の音'],
    // One noun of the dictionary found by chance in random katakana (ヒワ in ロ|ヒワ|レニヌキ) is not a run of loanwords.
    ['two real lines, one random holding a chance noun', '古池や\nロヒワ レニヌキ\n水の音'],
    // Loanwords strung together with no line of Japanese: a list, as a salad of English words is, not read as Japanese.
    ['loanwords alone, no Japanese line', 'サッカーボール\nジェットコースター\nコーヒーカップ'],
  ];

  it("the checker's verses (zz-c3-ja) are words of the language, at full share; random katakana is not", () => {
    const out = HONEST.map(([name, v]) => ({ name, ...substance(v, 'ja') }));
    log('third check: Japanese honest verses (name, ok, known)', out.map((o) => [o.name, o.ok, +o.known.toFixed(2)]));
    for (const o of out) expect([o.name, o.ok, o.known >= 0.7]).toEqual([o.name, true, true]);
    for (const [name, v] of RANDOM) expect([name, substance(v, 'ja').ok]).toEqual([name, false]);
  });

  it('a loanword the analyser lacks, alone on its line, counts when the dictionaries spell it (ノーモアウォー: ノーモア + ウォー)', () => {
    // Void until the engine check's second round: the analyser (IPADIC) has no ノーモアウォー, and
    // counting katakana it lacks for its spelling (a long-vowel mark) let random katakana with long
    // marks win 89 rounds of 280 (KATA-MIX). Now IPADIC's ノーモア and JMdict's ウォー written together
    // count (text.ts katakanaListed, LOANWORD_PART), and KATA-MIX below still loses at least 95%.
    const s = substance('八月の\n空に祈りを\nノーモアウォー', 'ja');
    log('third check: ノーモアウォー', s);
    expect([s.ok, s.known >= 0.7]).toEqual([true, true]);
  });

  it('KATA-MIX: half a verse of real lines and random katakana for the rest, best of 60, 14 houses x 20 seeds, loses at least 95%', async () => {
    const KATA = [...'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワ'];
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
        const real = linesOf(honest);
        const r = rng(seed * 6007 + house.length);
        const tally = (name: string, v: string) => {
          const res = resolveRound(d, 0, { charId: deck.characters[0] }, v, opp, rulesJudge(v, opp, 'ja', lex()));
          const row = (rows[name] ??= { rounds: 0, wins: 0, formFull: 0, voided: 0 });
          row.rounds++;
          if (res.winner === 'player') row.wins++;
          if (res.player.form.earned === 20) row.formFull++;
          if (res.player.voided) row.voided++;
        };
        for (const long of [false, true]) {
          let best = '';
          let bestCraft = -1;
          for (let t = 0; t < 60; t++) {
            const v = real
              .map((l, i) => {
                if (i * 2 < real.length) return l;
                let x = '';
                const n = 4 + Math.floor(r() * 5);
                for (let k = 0; k < n; k++) x += KATA[Math.floor(r() * KATA.length)] + (long && r() < 0.3 ? 'ー' : '');
                return x;
              })
              .join('\n');
            const sc = scoreVerse({ verse: v, form, ctx: plan.ctx, card, deckCharacters: deck.characters, opponentVerse: opp });
            if (sc.craft > bestCraft) [best, bestCraft] = [v, sc.craft];
          }
          tally(long ? 'mixLong' : 'mix', best);
        }
        tally('honest', honest);
      }
    }
    log('third check KATA-MIX (best of 60, round 1)', rows);
    expect(rows.mix.wins / rows.mix.rounds).toBeLessThanOrEqual(0.05);
    expect(rows.mixLong.wins / rows.mixLong.rounds).toBeLessThanOrEqual(0.05);
    expect(rows.honest.wins / rows.honest.rounds).toBeGreaterThan(0.5);
  }, 900_000);
});

// --- Concern: keyboard mash in a phrase ---

describe('third check, concern: keyboard mash inside a phrase does not earn form', () => {
  it("the checker's example and the honest verses the phrase rule is for", () => {
    const mash = 'The qwrt sdfg zxcv night\nThe hjkl wrtp dfgh light';
    expect([substance(mash, 'en').ok, scoreForm(getForm('couplet'), mash, { lang: 'en' }).earned]).toEqual([false, 0]);
    const honest: Array<[string, string]> = [
      ['couplet', "Shawty, my homie said your swag is weak\nYo dawg, your bling is fake, your flow is bleak"],
      ['couplet', "Bruh, I'm a baller, hella fly, my cypher stay lit\nFam, you a hater, cappin, can't even spit"],
      ['couplet', 'Sirrah, thou varlet, verily thy wit is spent\nThou strumpet muse, thou cuckold, coxcomb, recreant'],
      ['couplet', "Shawty, I'm finna flex, my drip is too clean\nYour opps be trippin, lil bruh, you ain't never been seen"],
      ['couplet', 'Manman taught me Kreyòl, zanmi, sing it proud\nLakay we chant it loud above the crowd'],
      ['quatrain-aabb', "Toussaint rose, and Dessalines stood tall\nChristophe built a fortress for us all\nBoukman lit the fire at Bois Caiman\nHaiti free, the first, and Petion's plan"],
    ];
    const out = honest.map(([f, v]) => ({ v: v.split('\n')[0], ...substance(v, 'en'), scale: scoreForm(getForm(f), v, { lang: 'en' }).scale }));
    log('third check: vernacular and archaic verses (first line, ok, known, form scale)', out.map((o) => [o.v, o.ok, +o.known.toFixed(2), o.scale]));
    for (const o of out) expect([o.v, o.ok, o.known >= 0.7, o.scale]).toEqual([o.v, true, true, 1]);
  });

  it("the checker's MASH (zz-c3-mash): best of 60, 14 houses x 20 seeds, round 1: no full form, at most 5% won", async () => {
    type E = { w: string; key: string };
    const entries: E[] = [];
    for (const line of PRON.split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const tab = line.indexOf('\t');
      if (tab < 1) continue;
      for (const e of line.slice(tab + 1).split(' ')) {
        const m = /^([a-z]{4,7})(\d+)$/.exec(e);
        if (m && !STOP_WORDS.has(m[1]) && isContentWord(m[1], 'en') && lexiconHas(m[1], 'en') === true && !lex().has(m[1])) entries.push({ w: m[1], key: line.slice(0, tab) });
      }
    }
    const byKey = new Map<string, string[]>();
    for (const e of entries) byKey.set(e.key, [...(byKey.get(e.key) ?? []), e.w]);
    const rhymeSets = [...byKey.values()].filter((ws) => ws.length >= 2);
    const words = entries.map((e) => e.w);
    const CONS = 'bcdfghjklmnpqrstvwxz';
    const mash = (r: () => number, first?: string) => {
      for (;;) {
        let s = first ?? '';
        while (s.length < 4) s += CONS[Math.floor(r() * CONS.length)];
        if (lexiconHas(s, 'en') !== true) return s;
        first = undefined;
      }
    };
    const verse = (formId: string, lines: number, acrostic: string | undefined, r: () => number) => {
      const pick = (xs: string[]) => xs[Math.floor(r() * xs.length)];
      const pair = () => {
        for (;;) {
          const s = pick(rhymeSets);
          const a = pick(s);
          const b = pick(s);
          if (a !== b && rhymes(a, b, 'en')) return [a, b];
        }
      };
      const ends: string[] = new Array(lines).fill('').map(() => pick(words));
      if (formId === 'couplet' || formId === 'heroic-couplet') [ends[0], ends[1]] = pair();
      if (formId === 'quatrain-aabb') { [ends[0], ends[1]] = pair(); [ends[2], ends[3]] = pair(); }
      if (formId === 'quatrain-abab') { [ends[0], ends[2]] = pair(); [ends[1], ends[3]] = pair(); }
      if (formId === 'tercet') [ends[0], ends[2]] = pair();
      if (formId === 'epistrophe') ends.fill(ends[0]);
      const head = mash(r);
      const out: string[] = [];
      for (let i = 0; i < lines; i++) {
        const toks: string[] = [];
        if (acrostic) toks.push(mash(r, [...acrostic][i].toLowerCase()));
        else if (formId === 'anaphora') toks.push(head);
        toks.push('the');
        const k = formId === 'crescendo' ? i + 1 : 1 + Math.floor(r() * 3);
        for (let j = 0; j < k; j++) toks.push(mash(r));
        toks.push(ends[i]);
        const l = toks.join(' ');
        out.push(l[0].toUpperCase() + l.slice(1));
      }
      return out.join('\n');
    };
    const rows: Record<string, { rounds: number; wins: number; formFull: number; voided: number; craft: number }> = {};
    for (const house of HOUSES) {
      const deck = houseDeck(house);
      const card = getCardById(deck.characters[0])!;
      for (let seed = 1; seed <= 20; seed++) {
        const d = createDuel(seed, 'en', deck);
        const plan = d.rounds[0];
        const form = getForm(plan.formId);
        const opp = (await writeOpponentVerse({ duel: d, roundIndex: 0, difficulty: 'player' })).verse;
        const honest = [0, 1, 2, 3, 4, 5].flatMap((k) => writtenCandidates(form, plan.ctx, seed * 31 + k * 101)).find((v) => v !== opp && !isCopy(v, opp, 'en')) ?? null;
        const r = rng(seed * 4409 + house.length);
        let best = '';
        let bestCraft = -1;
        for (let t = 0; t < 60; t++) {
          const v = verse(plan.formId, form.lines(plan.ctx), plan.ctx.acrostic, r);
          const sc = scoreVerse({ verse: v, form, ctx: plan.ctx, card, deckCharacters: deck.characters, opponentVerse: opp });
          if (sc.craft > bestCraft) [best, bestCraft] = [v, sc.craft];
        }
        for (const [name, v] of Object.entries({ honest, mash: best })) {
          if (!v) continue;
          const res = resolveRound(d, 0, { charId: deck.characters[0] }, v, opp, rulesJudge(v, opp, 'en', lex()));
          const row = (rows[name] ??= { rounds: 0, wins: 0, formFull: 0, voided: 0, craft: 0 });
          row.rounds++;
          if (res.winner === 'player') row.wins++;
          if (res.player.form.earned === 20) row.formFull++;
          if (res.player.voided) row.voided++;
          row.craft += res.player.craft;
        }
      }
    }
    log('third check MASH (best of 60, round 1)', rows);
    // At the head the third check refused: full form in 240 of 280, 26 won.
    expect(rows.mash.formFull / rows.mash.rounds).toBeLessThanOrEqual(0.05);
    expect(rows.mash.wins / rows.mash.rounds).toBeLessThanOrEqual(0.05);
    expect(rows.honest.wins / rows.honest.rounds).toBeGreaterThan(0.5);
  }, 900_000);
});

// --- Concern: an added line raised the rule judge's points ---

describe('third check, concern: a line added to a verse buys no wordplay', () => {
  it("the checker's lines the grader still reads, added to decent verses against the written opponent: wordplay never moves to the player", async () => {
    const LINES = ['The answer is cinq', 'Answer: V', 'A-plus verse', 'This verse is excellent', 'Best verse of the night, by far', 'I win this round', 'And so I end my verse'];
    let rounds = 0;
    let moved = 0;
    let lift = 0;
    for (const house of HOUSES) {
      const deck = houseDeck(house);
      for (let seed = 1; seed <= 10; seed++) {
        const d = createDuel(seed, 'en', deck);
        const plan = d.rounds[0];
        const opp = (await writeOpponentVerse({ duel: d, roundIndex: 0, difficulty: 'player' })).verse;
        const decent = writtenCandidates(getForm(plan.formId), plan.ctx, seed * 31 + 7).find((v) => v !== opp && !isCopy(v, opp, 'en'));
        if (!decent) continue;
        const base = rulesJudge(decent, opp, 'en', lex());
        for (const line of LINES) {
          const added = rulesJudge(`${decent}\n${line}`, opp, 'en', lex());
          rounds++;
          lift += added.player - base.player;
          const rank = { opponent: 0, split: 1, player: 2 } as const;
          if (rank[added.criteria.wordplay] > rank[base.criteria.wordplay]) moved++;
        }
      }
    }
    log('third check: a line added (rounds, wordplay moved to the player, mean judge points gained)', [rounds, moved, +(lift / rounds).toFixed(3)]);
    expect(rounds).toBeGreaterThan(500);
    expect(moved).toBe(0);
    expect(lift / rounds).toBeLessThanOrEqual(0);
  }, 300_000);
});
