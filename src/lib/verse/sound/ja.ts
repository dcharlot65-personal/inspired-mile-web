/**
 * How Japanese text is read.
 *
 * A kanji's reading is not in its spelling: 今日 is "kyou", 古池 is "furuike".
 * Reading a line therefore needs a morphological analyser with a dictionary.
 * This one is kuromoji.js 0.1.2 (Apache-2.0) with the mecab-ipadic 2.7.0
 * dictionary (NAIST licence), the same pair on every device, fetched once by
 * loadJapanese() before a Japanese duel and never otherwise (the battle page
 * starts the fetch as soon as a Japanese duel is in view: battle.astro warm()). The analysis is a Viterbi
 * search over that fixed dictionary, so the same line always reads the same way.
 *
 * The dictionary is kuromoji's own, cut down to what the engine reads
 * (scripts/sound/build-ipadic.mjs: the words in a sorted list instead of a
 * double-array trie, readings and pronunciations without parts of speech, no
 * padding): ./ipadic, ten files, 4.7 MB compressed and 16 MB unpacked where
 * kuromoji's were 17.8 MB and 100 MB. ./ipadic.test.ts requires the same words,
 * readings and known flags from both.
 *
 * Only kuromoji's tokenizer is used, loaded from its source modules; its own
 * dictionary loader needs Node's `path` and a fixed folder layout, so the
 * files are fetched here instead (bundler asset URLs in a browser, the file
 * system under Node).
 *
 * Until the analyser is in, and if it cannot be loaded, only text written in
 * kana can be read, as before.
 */
// @ts-expect-error kuromoji ships no types for its source modules
import DynamicDictionaries from 'kuromoji/src/dict/DynamicDictionaries.js';
// @ts-expect-error kuromoji ships no types for its source modules
import Tokenizer from 'kuromoji/src/Tokenizer.js';
import { setJapaneseAnalyser, type KuromojiToken } from './kana';


let tokenizer: KuromojiInternals | null = null;

const FILES = ['lex', 'tid', 'tid_pos', 'cc', 'unk', 'unk_pos', 'unk_map', 'unk_char', 'unk_compat', 'unk_invoke'] as const;

// The bundler turns each dictionary file into an asset and gives its URL; nothing is fetched until asked.
const DICT_URLS = import.meta.glob('./ipadic/*.dat.gz', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>;

async function gunzip(bytes: Uint8Array): Promise<ArrayBuffer> {
  // A server may already have undone the compression (Content-Encoding: gzip); the two magic bytes tell.
  if (!(bytes[0] === 0x1f && bytes[1] === 0x8b)) return bytes.slice().buffer;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

async function dictFile(name: string): Promise<ArrayBuffer> {
  const key = Object.keys(DICT_URLS).find((k) => k.endsWith(`/${name}.dat.gz`));
  if (!key) throw new Error(`kuromoji dictionary file ${name}.dat.gz is not in the build`);
  const url = await DICT_URLS[key]();
  if (typeof window === 'undefined') {
    // Node (unit tests, scripts): the "URL" is a path under the project root.
    const fs = await import(/* @vite-ignore */ 'node:fs/promises');
    const rel = url.replace(/^\/@fs/, '').replace(/\?.*$/, '');
    const tries = [`${process.cwd()}${rel}`, rel];
    for (const p of tries) {
      try {
        return await gunzip(new Uint8Array(await fs.readFile(p)));
      } catch {
        // try the next spelling of the path
      }
    }
    throw new Error(`cannot read ${rel}`);
  }
  if (url.startsWith('data:')) {
    // The bundler inlines the smallest files as data URLs; they are decoded here, not fetched,
    // so a content security policy that limits connections to the site's own origin cannot refuse them.
    const bin = atob(url.slice(url.indexOf(',') + 1));
    return gunzip(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return gunzip(new Uint8Array(await res.arrayBuffer()));
}

/** Build the analyser. Resolves true when it is ready; throws if a dictionary file cannot be had. */
export async function loadJapanese(): Promise<boolean> {
  if (tokenizer) {
    const ready = tokenizer;
    setJapaneseAnalyser((text) => ready.tokenize(text));
    return true;
  }
  const b: Record<string, ArrayBuffer> = {};
  await Promise.all(FILES.map(async (f) => (b[f] = await dictFile(f))));
  const dic = new DynamicDictionaries();
  const words = new SortedWords(new TextDecoder().decode(b.lex));
  // An empty target map for kuromoji to read; the words' entries come from the list (see SortedWords).
  dic.loadTokenInfoDictionaries(new Uint8Array(b.tid), new Uint8Array(b.tid_pos), new Uint8Array(4));
  dic.trie = words;
  dic.token_info_dictionary.target_map = words.entries;
  dic.loadConnectionCosts(new Int16Array(b.cc));
  dic.loadUnknownDictionaries(new Uint8Array(b.unk), new Uint8Array(b.unk_pos), new Uint8Array(b.unk_map), new Uint8Array(b.unk_char), new Uint32Array(b.unk_compat), new Uint8Array(b.unk_invoke));
  tokenizer = readingTokenizer(new Tokenizer(dic));
  setJapaneseAnalyser((text) => tokenizer!.tokenize(text));
  return true;
}

/**
 * The dictionary's words, sorted as JavaScript compares strings, answering what kuromoji asks of
 * its trie and its target map (scripts/sound/build-ipadic.mjs writes the list):
 *   - commonPrefixSearch(text): every word the text starts with, the shortest first, as
 *     { k: word, v: its index };
 *   - entries[index]: the byte offsets in tid of that word's entries, in the dictionary's order.
 * The list is one line a word: a character (48 + n) saying how many characters it shares with the
 * word before, the rest of it, a tab and how many entries it has.
 */
class SortedWords {
  readonly words: string[] = [];
  private readonly first: Uint32Array;
  private readonly longest: number;
  readonly entries: Record<number, number[]>;

  constructor(text: string) {
    const counts: number[] = [];
    let prev = '';
    let longest = 0;
    for (const line of text.split('\n')) {
      const tab = line.lastIndexOf('\t');
      if (tab < 1) continue;
      const word = prev.slice(0, line.charCodeAt(0) - 48) + line.slice(1, tab);
      this.words.push(word);
      counts.push(Number(line.slice(tab + 1)));
      if (word.length > longest) longest = word.length;
      prev = word;
    }
    this.longest = longest;
    this.first = new Uint32Array(counts.length + 1);
    for (let i = 0; i < counts.length; i++) this.first[i + 1] = this.first[i] + counts[i];
    const first = this.first;
    this.entries = new Proxy({} as Record<number, number[]>, {
      get(_, key) {
        const i = Number(key);
        const out: number[] = [];
        for (let e = first[i]; e < first[i + 1]; e++) out.push(e * 10);
        return out;
      },
    });
  }

  /** The first index in [lo, words.length) whose word is not less than `key`. */
  private lowerBound(key: string, lo: number): number {
    let hi = this.words.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.words[mid] < key) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  commonPrefixSearch(text: string): Array<{ k: string; v: number }> {
    const out: Array<{ k: string; v: number }> = [];
    let lo = 0;
    for (let n = 1; n <= Math.min(text.length, this.longest); n++) {
      const prefix = text.slice(0, n);
      lo = this.lowerBound(prefix, lo);
      // No word starts with this prefix, so none starts with a longer one.
      if (lo >= this.words.length || !this.words[lo].startsWith(prefix)) break;
      if (this.words[lo] === prefix) out.push({ k: prefix, v: lo });
    }
    return out;
  }
}

interface ViterbiNode {
  name: number;
  type: string;
  start_pos: number;
  surface_form: string;
}
interface KuromojiInternals {
  getLattice(text: string): unknown;
  viterbi_searcher: { search(lattice: unknown): ViterbiNode[] };
  token_info_dictionary: { getFeatures(id: number): string | null };
  unknown_dictionary: { getFeatures(id: number): string | null };
  formatter: { formatUnknownEntry(id: number, at: number, type: string, features: string[], surface: string): KuromojiToken };
  tokenizeForSentence(sentence: string, tokens?: KuromojiToken[]): KuromojiToken[];
  tokenize(text: string): KuromojiToken[];
}

/**
 * kuromoji's tokenizer reading the cut-down dictionary: a known word's features are
 * "reading,pronunciation" (either empty where the engine reads the same without it), and its
 * surface is the text it was found in, which the full dictionary stores again. Everything else,
 * the search and the unknown words, is kuromoji's own.
 */
function readingTokenizer(t: KuromojiInternals): KuromojiInternals {
  t.tokenizeForSentence = function (sentence: string, tokens: KuromojiToken[] = []) {
    for (const node of this.viterbi_searcher.search(this.getLattice(sentence))) {
      if (node.type === 'KNOWN') {
        const [reading = '', pronunciation = ''] = (this.token_info_dictionary.getFeatures(node.name) ?? '').split(',');
        tokens.push({ surface_form: node.surface_form, pos: '', word_type: 'KNOWN', ...(reading ? { reading } : {}), ...(pronunciation ? { pronunciation } : {}) });
      } else if (node.type === 'UNKNOWN') {
        const features = (this.unknown_dictionary.getFeatures(node.name) ?? '').split(',');
        tokens.push(this.formatter.formatUnknownEntry(node.name, node.start_pos, node.type, features, node.surface_form));
      }
    }
    return tokens;
  };
  return t;
}

/** Forget the analyser (tests). */
export function unloadJapanese(): void {
  tokenizer = null;
  setJapaneseAnalyser(null);
}
