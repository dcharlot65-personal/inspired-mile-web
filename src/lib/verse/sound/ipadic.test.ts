/**
 * The cut-down dictionary (./ipadic, scripts/sound/build-ipadic.mjs) reads Japanese exactly as
 * kuromoji's own does: the same words, the same readings as spelled and as spoken, the same
 * known flags, for every verse and interface string the game has in Japanese, for a sample of the
 * dictionary's own words, and for generated text.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error kuromoji ships no types for its source modules
import DynamicDictionaries from 'kuromoji/src/dict/DynamicDictionaries.js';
// @ts-expect-error kuromoji ships no types for its source modules
import Tokenizer from 'kuromoji/src/Tokenizer.js';
import ja from '../../../i18n/locales/ja';
import { getPack, loadPack } from '../packs';
import { loadJapanese, unloadJapanese } from './ja';
import { japaneseAnalyser, japaneseTokens, japaneseWords, setJapaneseAnalyser, type KuromojiToken } from './kana';

const FULL = 'node_modules/kuromoji/dict';
const read = (name: string) => new Uint8Array(gunzipSync(readFileSync(`${FULL}/${name}.dat.gz`))).buffer;

let full: { tokenize(t: string): KuromojiToken[] };
let cut: (t: string) => KuromojiToken[];

beforeAll(async () => {
  const dic = new DynamicDictionaries();
  dic.loadTrie(new Int32Array(read('base')), new Int32Array(read('check')));
  dic.loadTokenInfoDictionaries(new Uint8Array(read('tid')), new Uint8Array(read('tid_pos')), new Uint8Array(read('tid_map')));
  dic.loadConnectionCosts(new Int16Array(read('cc')));
  dic.loadUnknownDictionaries(new Uint8Array(read('unk')), new Uint8Array(read('unk_pos')), new Uint8Array(read('unk_map')), new Uint8Array(read('unk_char')), new Uint32Array(read('unk_compat')), new Uint8Array(read('unk_invoke')));
  full = new Tokenizer(dic);
  expect(await loadJapanese()).toBe(true);
  cut = japaneseAnalyser()!;
  await loadPack('ja');
}, 300_000);

afterAll(() => unloadJapanese());

/** What the engine reads of a text under one analyser. */
function reading(text: string, analyse: (t: string) => KuromojiToken[]) {
  setJapaneseAnalyser(analyse);
  return { tokens: japaneseTokens(text), words: japaneseWords(text) };
}

function texts(): string[] {
  const pack = getPack('ja');
  const verses = [...Object.values(pack.written).flat(), ...Object.values(pack.spare ?? {}).flat(), ...Object.values(pack.acrosticLines).flat(), ...pack.acrostic];
  const lines = [...verses, ...Object.values(ja)].flatMap((s) => s.split('\n'));
  // Generated: runs of the characters those texts use, and random katakana and hiragana.
  const chars = [...new Set(lines.join('').replace(/\s/g, ''))];
  let seed = 20261117;
  const r = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const gen: string[] = [];
  const kata = [...'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポャュョッー'];
  const hira = kata.map((c) => (c === 'ー' ? c : String.fromCharCode(c.charCodeAt(0) - 0x60)));
  for (let i = 0; i < 1500; i++) {
    const pool = i % 3 === 0 ? kata : i % 3 === 1 ? hira : chars;
    const n = 3 + Math.floor(r() * 14);
    let s = '';
    for (let k = 0; k < n; k++) s += pool[Math.floor(r() * pool.length)];
    gen.push(s);
  }
  return [...new Set([...lines, ...gen])];
}

/** Every 40th word of the dictionary itself, read alone. */
function dictionarySample(): string[] {
  const tid = new DataView(read('tid'));
  const pos = new Uint8Array(read('tid_pos'));
  const dec = new TextDecoder();
  const out: string[] = [];
  for (let e = 0; e * 10 + 10 <= tid.byteLength; e += 40) {
    const at = tid.getInt32(e * 10 + 6, true);
    if (e > 0 && at === 0) break;
    let end = at;
    while (pos[end] !== 0) end++;
    out.push(dec.decode(pos.subarray(at, end)).split(',')[0]);
  }
  return out;
}

describe('the cut-down IPADIC', () => {
  it('reads every Japanese verse, interface string and generated text as kuromoji does', async () => {
    const cutAnalyser = cut;
    const all = texts();
    const differ: unknown[] = [];
    for (const t of all) {
      const a = reading(t, (x) => full.tokenize(x));
      const b = reading(t, cutAnalyser);
      if (JSON.stringify(a) !== JSON.stringify(b)) differ.push({ t, full: a, cut: b });
    }
    console.log(`MEASURE ipadic: texts read, differing ${JSON.stringify([all.length, differ.length])}`);
    expect(differ.slice(0, 3)).toEqual([]);
    expect(all.length).toBeGreaterThan(2000);
  }, 300_000);

  it("reads a sample of the dictionary's own words (every 40th) as kuromoji does", async () => {
    const cutAnalyser = cut;
    const sample = dictionarySample();
    const differ: unknown[] = [];
    for (const t of sample) {
      const a = reading(t, (x) => full.tokenize(x));
      const b = reading(t, cutAnalyser);
      if (JSON.stringify(a) !== JSON.stringify(b)) differ.push({ t, full: a, cut: b });
    }
    console.log(`MEASURE ipadic: dictionary words read, differing ${JSON.stringify([sample.length, differ.length])}`);
    expect(sample.length).toBeGreaterThan(9000);
    expect(differ.slice(0, 3)).toEqual([]);
  }, 300_000);
});
