/**
 * How Japanese text is read.
 *
 * A kanji's reading is not in its spelling: 今日 is "kyou", 古池 is "furuike".
 * Reading a line therefore needs a morphological analyser with a dictionary.
 * This one is kuromoji.js 0.1.2 (Apache-2.0) with the mecab-ipadic 2.7.0
 * dictionary (NAIST licence), the same pair on every device: twelve dictionary
 * files, 17.8 MB compressed, fetched once by loadJapanese() before a Japanese
 * duel and never otherwise. The analysis is a Viterbi search over that fixed
 * dictionary, so the same line always reads the same way.
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


let tokenizer: { tokenize(text: string): KuromojiToken[] } | null = null;

const FILES = ['base', 'check', 'tid', 'tid_pos', 'tid_map', 'cc', 'unk', 'unk_pos', 'unk_map', 'unk_char', 'unk_compat', 'unk_invoke'] as const;

// The bundler turns each dictionary file into an asset and gives its URL; nothing is fetched until asked.
const DICT_URLS = import.meta.glob('/node_modules/kuromoji/dict/*.dat.gz', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>;

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
  dic.loadTrie(new Int32Array(b.base), new Int32Array(b.check));
  dic.loadTokenInfoDictionaries(new Uint8Array(b.tid), new Uint8Array(b.tid_pos), new Uint8Array(b.tid_map));
  dic.loadConnectionCosts(new Int16Array(b.cc));
  dic.loadUnknownDictionaries(new Uint8Array(b.unk), new Uint8Array(b.unk_pos), new Uint8Array(b.unk_map), new Uint8Array(b.unk_char), new Uint32Array(b.unk_compat), new Uint8Array(b.unk_invoke));
  tokenizer = new Tokenizer(dic);
  setJapaneseAnalyser((text) => tokenizer!.tokenize(text));
  return true;
}

/** Forget the analyser (tests). */
export function unloadJapanese(): void {
  tokenizer = null;
  setJapaneseAnalyser(null);
}
