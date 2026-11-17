/**
 * The independent check of the engine pass (2026-11-17) refused the merge with two blockers and a
 * list of concerns. Its probes (zz-e1-ja, zz-e1-en, zz-e1-honest) are here as tests of the fixed
 * behaviour, with this pass's own verses and probes beside them. Each block prints what it measured
 * ("MEASURE ..."), recorded in docs/language/RULES-MEASUREMENTS.md.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { CARD_CATALOG, getCardById } from '../cards';
import { createDuel, isCopy, resolveRound, rng, scoreVerse, type DuelDeck } from './duel';
import { getForm, scoreForm } from './forms';
import { rulesJudge } from './judge';
import { writeOpponentVerse, writtenCandidates } from './opponent';
import { PACK_LANGS, getPack, loadAllPacks } from './packs';
import { loadPronunciation } from './pronounce';
import { allusionLexicon } from './referee';
import { rhymeKey, rhymes } from './rhyme';
import { loadSound } from './sound';
import { STOP_WORDS, fold, isContentWord, isStopWord, lexiconHas, linesOf, sayable, substance, syllablesInWord, wordsOf } from './text';
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

// --- Blocker 1: honest Japanese haiku with two lines of katakana loanwords ---

describe('engine check, blocker 1: a haiku of two loanword lines and one line of Japanese counts', () => {
  /** The checker's sixteen (zz-e1-ja), then this pass's own. */
  const CHECKER = [
    'スマートフォン\nメッセージ\n届かない夜',
    'テレビの音\nラジオのニュース\n静かな部屋',
    'アイスクリーム\nチョコレートケーキ\n夏休み',
    'ハンバーガー\nポテトとコーラ\nまた明日',
    'クリスマス\nイルミネーション\n君がいない',
    'マイクチェック\nワンツー ワンツー\n俺の番だ',
    'ニューヨーク\nブルックリン ブリッジ\n雨の朝',
    'コーヒーカップ\nシュガー ミルク\n眠い朝',
    'エレベーター\nエスカレーター\n人の波',
    'インターネット\nパスワード\n忘れた日',
    'サンドイッチ\nピクニックの日\n青い空',
    'ロックンロール\nギターソロ\n終わらない夜',
    'ヒップホップ\nサイファーの輪\n言葉の雨',
    'バスケットボール\nスリーポイント\n夏の汗',
    'ラーメン屋\nカウンター席\n湯気の中',
    'ステージライト\nマイクスタンド\n俺の声',
  ];
  const MINE = [
    'パスタとピザ\nワイングラス\n夜の街',
    'ギター ドラム\nベースライン\n夏祭り',
    'タクシー\nミッドナイト\n東京の雨',
    'サンタクロース\nトナカイ\n雪の夜',
    'ジャズピアノ\nサックス\n秋の夜',
    'ハイウェイ\nヘッドライト\n君の街',
    'カラオケボックス\nマイクを握る\n友の声',
    'ドーナツ\nカフェラテ\n雨の午後',
    'オリンピック\nマラソンランナー\n夏の道',
    'パリのカフェ\nクロワッサン\n春の朝',
    'スニーカー\nアスファルト\n夜を走る',
    'ビートボックス\nフリースタイル\n俺の夜',
    'ゲームセンター\nコインの音\n夏休み',
    'ホームラン\nスタジアム\n夏の空',
    'レモンティー\nシナモンロール\n冬の朝',
    'サマータイム\nブルース\n君の声',
    'ハロー ハロー\nマイク テスト\n始まるぜ',
    'ダンスフロア\nミラーボール\n夜明けまで',
    'ブルックリン\nヒップホップ\n俺の街',
  ];
  /**
   * Still void, measured and not wanted: a line whose loanword the dictionary (IPADIC, 2007) lacks
   * and cannot spell from its own words (ワンツー: neither ワン nor ツー is in it; スイートドリーム,
   * フライドポテト, ワンダーランド, トーキョー). Counting katakana the dictionary lacks for its
   * spelling let random katakana win (review3.test.ts, ノーモアウォー); the dictionary's coverage of
   * loanwords is the limit.
   */
  const LACKED = [
    'マイクチェック\nワンツー ワンツー\n俺の番だ',
    'グッドナイト\nスイートドリーム\nまた明日',
    'フライドポテト\nケチャップ マヨネーズ\n腹ぺこだ',
    'メリーゴーランド\nワンダーランド\n子供の夢',
    'トーキョー\nネオンサイン\n眠らない',
  ];

  it("the checker's verses and this pass's are words of the language at full share; those whose loanword the dictionary lacks are not", () => {
    const rows = [...CHECKER, ...MINE].map((v) => {
      const s = substance(v, 'ja');
      const f = scoreForm(getForm('haiku'), v, { lang: 'ja' });
      return { v: v.replace(/\n/g, ' / '), ok: s.ok, known: +s.known.toFixed(3), thin: !!f.thin, scale: +f.scale.toFixed(3), lacked: LACKED.includes(v) };
    });
    log('engine check: Japanese loanword haiku (verse, ok, known, thin, scale)', rows.map((r) => [r.v, r.ok, r.known, r.thin, r.scale]));
    for (const r of rows) {
      if (r.lacked) expect([r.v, r.ok]).toEqual([r.v, false]);
      else expect([r.v, r.ok, r.known >= 0.7, r.thin]).toEqual([r.v, true, true, false]);
    }
    for (const v of LACKED.filter((x) => !CHECKER.includes(x))) expect([v, substance(v, 'ja').ok]).toEqual([v, false]);
  });

  it('KATA-ONE: one real line of the honest verse and random katakana for every other, best of 60, 14 houses x 20 seeds, loses at least 95%', async () => {
    const KATA = [...'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワ'];
    const FULL = [...'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ'];
    const SMALL = [...'ャュョァィゥェォッ'];
    const random = (kind: string, r: () => number) => {
      let x = '';
      const n = 4 + Math.floor(r() * 5);
      for (let k = 0; k < n; k++) {
        if (kind === 'full') {
          x += FULL[Math.floor(r() * FULL.length)];
          const t = r();
          if (t < 0.15) x += SMALL[Math.floor(r() * SMALL.length)];
          else if (t < 0.35) x += 'ー';
        } else x += KATA[Math.floor(r() * KATA.length)] + (kind === 'long' && r() < 0.3 ? 'ー' : '');
      }
      return x;
    };
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
        const r = rng(seed * 7001 + house.length);
        const tally = (name: string, v: string) => {
          const res = resolveRound(d, 0, { charId: deck.characters[0] }, v, opp, rulesJudge(v, opp, 'ja', lex()));
          const row = (rows[name] ??= { rounds: 0, wins: 0, formFull: 0, voided: 0 });
          row.rounds++;
          if (res.winner === 'player') row.wins++;
          if (res.player.form.earned === 20) row.formFull++;
          if (res.player.voided) row.voided++;
        };
        for (const kind of ['basic', 'long', 'full']) {
          let best = '';
          let bestCraft = -1;
          for (let t = 0; t < 60; t++) {
            const v = real.map((l, i) => (i === 0 ? l : random(kind, r))).join('\n');
            const sc = scoreVerse({ verse: v, form, ctx: plan.ctx, card, deckCharacters: deck.characters, opponentVerse: opp });
            if (sc.craft > bestCraft) [best, bestCraft] = [v, sc.craft];
          }
          tally(kind, best);
        }
        tally('honest', honest);
      }
    }
    log('engine check KATA-ONE (best of 60, round 1)', rows);
    for (const kind of ['basic', 'long', 'full']) expect([kind, rows[kind].wins / rows[kind].rounds <= 0.05]).toEqual([kind, true]);
    expect(rows.honest.wins / rows.honest.rounds).toBeGreaterThan(0.5);
  }, 900_000);
});

// --- Blocker 2: ad-libs and names the table lacks ---

describe('engine check, blocker 2: ad-libs and names in a phrase count as words', () => {
  /** The checker's (zz-e1-en, zz-e1-ja's English, zz-e1-honest's English), with the share the base 91db84e gave each. */
  const CHECKER: Array<[string, number]> = [
    ['Skrrt skrrt, brrr, the bass go boom\nPfft, hmm, tsk, I own the room', 0.857],
    ['Brrr, it is cold, skrrt, I am gone\nGrrr goes the dog at the break of dawn', 1],
    ['Mwangi, Njeri, Wanjiru and Kamau\nSing in Nairobi, sing it now', 1],
    ['Tlaloc, Xochitl, Nezahualcoyotl too\nThe old gods dance the whole night through', 1],
    ['Pssst, shhh, the baby is asleep\nZzz, hmm, not a peep', 0.818],
    ['Bzzzt, the lights go out, the speakers hiss\nVroom vroom, I am gone, a kiss', 1],
    ['Ayyy, yuhh, the crowd go wild\nSkrrt, brrt, I run it like a child', 1],
    ['Mmm, mhm, uh-huh, that is right\nYeet the mic and own the night', 0.857],
    ["Shawty, I'm finna flex, my drip is too clean\nYour opps be trippin, lil bruh, you ain't never been seen", 0.95],
    ['Ngũgĩ, Nkrumah, Mbeki, Mngomezulu\nSpeak the names and sing them true', 0.727],
    ['Szczecin, Wrocław, Bydgoszcz and Przemyśl\nI rap through Poland on a single wish', 1],
    ['Nkechi, Ngozi, Oluwaseun, Chiamaka came\nAnd Dessalines and Toussaint called my name', 1],
    ['Ouagadougou, Bujumbura, Nouakchott and Lomé\nI rap their names in rhythm every day', 1],
    ['Oluwaseun and Nkechi, Kwame and Chimamanda\nWrote lines you cannot touch, from Lagos down to Luanda', 1],
    ['Wojciech from Kraków and Zbigniew from Łódź\nOutrapped you twice before you found your nose', 1],
    ['Pfft, your bars are weak, they make me yawn\nHmm, let me finish you before the dawn', 0.941],
  ];
  /** This pass's own: names of the diaspora and ad-libs no list keeps, in phrases. */
  const MINE = [
    'Brrrap, the drums are rolling in the street\nSkrrrt, the tires sing beneath my feet',
    'Shhhh, the baby sleeps, the night is long\nMmmm, my grandmama is humming her song',
    'Grrah, I tell the crowd to make some noise\nBrrr, the cold is nothing to my voice',
    'Thandiwe, Nomvula and Sipho came along\nAnd Khumalo and Dlamini sang the song',
    'Babatunde, Olamide and Funmilayo too\nThey made the beat and Yetunde broke through',
    'Wangari and Wambui planted every tree\nAnd Okonkwo stood by Achebe for me',
    'Dafydd and Gwyneth sang in Llanfair hall\nAnd Rhys and Bryn were dancing through it all',
    'Pssh, your rhymes are dust, your flow is old\nTssk, I take the mic and turn it gold',
  ];

  it("the checker's verses keep at least the base's share and full form; this pass's are words at full share", () => {
    const rows = [...CHECKER.map(([v, base]) => ({ v, base })), ...MINE.map((v) => ({ v, base: 0.7 }))].map(({ v, base }) => {
      const s = substance(v, 'en');
      const f = scoreForm(getForm('couplet'), v, { lang: 'en' });
      return { v: v.split('\n')[0], ok: s.ok, known: +s.known.toFixed(3), base, scale: +f.scale.toFixed(3), thin: !!f.thin };
    });
    log('engine check: ad-libs and names (first line, ok, known, base share, scale)', rows.map((r) => [r.v, r.ok, r.known, r.base, r.scale]));
    // Within one word in ten of the base's share (the previous head lost up to a quarter: Mwangi 0.727, Tlaloc 0.75), and full form.
    for (const r of rows) expect([r.v, r.ok, r.thin, r.known >= Math.min(r.base, 0.7), r.known >= r.base - 0.1, r.scale >= (r.base >= 0.7 ? 1 : 0)]).toEqual([r.v, true, false, true, true, true]);
  });

  it('word by word: held sounds, drawn-out letters and the names of the table can be said; keyboard mash and near misses cannot', () => {
    // Each list fails under one of the rule's parts taken away: the table's names (these 21 fail when only
    // SCOWL's words are read), a drawn-out letter said once (ayyy, brrrap, grrah) and the held sounds.
    const SAID = 'skrrt brrr pfft pssst shhh bzzzt grrr brrt hmmm mmmm zzzz mhmm ayyy yuhh brrrap grrah shawty bruh finna varlet mwangi wanjiru kamau tlaloc xochitl nezahualcoyotl szczecin przemyśl nkechi ngozi oluwaseun kwame nkrumah siobhan niamh caoimhe aoife wojciech zbigniew thandiwe babatunde'.split(' ');
    const NOT = 'qwrt sdfg zxcv hjkl wrtp dfgh asdf brrh pssh mhhg hllt mvvk dhhh pft'.split(' ');
    expect(SAID.filter((w) => !sayable(w))).toEqual([]);
    expect(NOT.filter((w) => sayable(w))).toEqual([]);
  });

  it('a roll call of names, every word with a capital and no little word in the line, is read as a phrase (void at the base and the previous head)', () => {
    const v = 'Nkechi, Ngozi, Chiamaka, Oluwaseun\nAdaeze, Chukwuemeka, under the sun';
    const s = substance(v, 'en');
    log('engine check: the roll call', s);
    expect([s.ok, s.known >= 0.7, scoreForm(getForm('couplet'), v, { lang: 'en' }).scale]).toEqual([true, true, 1]);
    // What the phrase rule still keeps out: the same names in lower case with no little word, letter
    // pairs and keyboard mash, capitals or not.
    expect(substance('nkechi ngozi chiamaka oluwaseun\nadaeze chukwuemeka obinna emeka', 'en').ok).toBe(false);
    for (const v2 of ['Ab Cd Ga\nEf Gh Ha', 'Qwrt Sdfg Zxcv Night\nHjkl Wrtp Dfgh Light', 'QWRT SDFG ZXCV\nHJKL WRTP DFGH']) expect([v2, substance(v2, 'en').ok]).toEqual([v2, false]);
  });

  /** Words the English table lists, by rhyme key, and a mash maker: random letters, `vowels` with at least one vowel letter. */
  function mashKit() {
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
    return { rhymeSets: [...byKey.values()].filter((ws) => ws.length >= 2), words: entries.map((e) => e.w) };
  }

  it('MASH-V: the checker\'s MASH with random letters that hold a vowel (best of 60, 14 houses x 20 seeds, round 1): at most 5% won, and full form less often than at the base (245 of 280), where every such string counted', async () => {
    const { rhymeSets, words } = mashKit();
    const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
    const mash = (r: () => number, first?: string) => {
      for (;;) {
        let s = first ?? '';
        const n = 4 + Math.floor(r() * 3);
        while (s.length < n) s += LETTERS[Math.floor(r() * LETTERS.length)];
        if (/[aeiouy]/.test(s) && lexiconHas(s, 'en') !== true) return s;
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
      if (formId === 'quatrain-aabb') {
        [ends[0], ends[1]] = pair();
        [ends[2], ends[3]] = pair();
      }
      if (formId === 'quatrain-abab') {
        [ends[0], ends[2]] = pair();
        [ends[1], ends[3]] = pair();
      }
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
    const rows: Record<string, { rounds: number; wins: number; formFull: number; voided: number }> = {};
    const examples: string[] = [];
    for (const house of HOUSES) {
      const deck = houseDeck(house);
      const card = getCardById(deck.characters[0])!;
      for (let seed = 1; seed <= 20; seed++) {
        const d = createDuel(seed, 'en', deck);
        const plan = d.rounds[0];
        const form = getForm(plan.formId);
        const opp = (await writeOpponentVerse({ duel: d, roundIndex: 0, difficulty: 'player' })).verse;
        const honest = [0, 1, 2, 3, 4, 5].flatMap((k) => writtenCandidates(form, plan.ctx, seed * 31 + k * 101)).find((v) => v !== opp && !isCopy(v, opp, 'en')) ?? null;
        const r = rng(seed * 5501 + house.length);
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
          const row = (rows[name] ??= { rounds: 0, wins: 0, formFull: 0, voided: 0 });
          row.rounds++;
          if (res.winner === 'player') {
            row.wins++;
            if (name === 'mash' && examples.length < 8) examples.push(v.replace(/\n/g, ' / '));
          }
          if (res.player.form.earned === 20) row.formFull++;
          if (res.player.voided) row.voided++;
        }
      }
    }
    log('engine check MASH-V (best of 60, round 1)', rows);
    log('engine check MASH-V wins (examples)', examples);
    expect(rows.honest.wins / rows.honest.rounds).toBeGreaterThan(0.5);
    // The price of counting names (random letters with a vowel cannot be told from a name by their
    // spelling): 12 won and 192 full form here, 5 and 100 at d56f5c8, 21 and 245 at the base.
    expect(rows.mash.wins / rows.mash.rounds).toBeLessThanOrEqual(0.05);
    expect(rows.mash.formFull / rows.mash.rounds).toBeLessThanOrEqual(0.75);
  }, 900_000);
});

