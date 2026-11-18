/**
 * Japanese readings: the light half. Kana can be read with no dictionary; a
 * kanji needs the analyser in ./ja, which installs itself here once loaded.
 * Kept apart from ./ja so that the analyser's code is only downloaded for a
 * Japanese duel.
 */
export interface KuromojiToken {
  surface_form: string;
  reading?: string;
  pronunciation?: string;
  pos: string;
  /** 'KNOWN' for a word of the dictionary, 'UNKNOWN' for a run the analyser guessed at. */
  word_type?: string;
}

export interface JaToken {
  /** The text as written. */
  surface: string;
  /** Its reading in hiragana, as spelled in kana: what haiku counts. 今日 is きょう. */
  kana: string;
  /** Its reading in hiragana, as spoken: what rhyme compares. 今日は is きょーわ. */
  spoken: string;
}

let analyse: ((text: string) => KuromojiToken[]) | null = null;

export function setJapaneseAnalyser(fn: ((text: string) => KuromojiToken[]) | null): void {
  analyse = fn;
}

/**
 * Which dictionary has a word, as written: the analyser's own ('ipadic', any word of mecab-ipadic),
 * or, for a word in katakana that it lacks, JMdict ('word': スマホ, アプリ, ユーチューブ) or JMnedict
 * ('name': レノン, ビヨンセ); null for none. ./ja installs it with the analyser (./jmdict,
 * scripts/sound/build-loanwords.mjs).
 */
export type JapaneseListing = 'ipadic' | 'word' | 'name' | null;
let lookup: ((word: string) => JapaneseListing) | null = null;

export function setJapaneseLexicon(fn: ((word: string) => JapaneseListing) | null): void {
  lookup = fn;
}

/** The lookup installed now, or null (tests take it away and put it back). */
export function japaneseLexicon(): ((word: string) => JapaneseListing) | null {
  return lookup;
}

/** Which dictionary has this word as written (see JapaneseListing); null too when none is loaded. */
export function japaneseListed(word: string): JapaneseListing {
  return lookup ? lookup(word) : null;
}

export function japaneseLoaded(): boolean {
  return analyse !== null;
}

/** The analyser installed now, or null (tests compare two). */
export function japaneseAnalyser(): ((text: string) => KuromojiToken[]) | null {
  return analyse;
}

/** Katakana to hiragana, so the two kana spellings of a sound compare equal. */
export function hira(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const KANA_ONLY = /^[ぁ-ゖー]+$/;
const HAS_LETTER = /[\p{L}\p{N}]/u;

/**
 * The words of a text with their readings, punctuation left out. Null when
 * something in it cannot be read: a kanji with the analyser not loaded, a word
 * the dictionary lacks that is not written in kana, Latin letters, digits.
 */
export function japaneseTokens(text: string): JaToken[] | null {
  const t = text.normalize('NFKC');
  const out: JaToken[] = [];
  if (!analyse) {
    for (const run of t.match(/[\p{L}\p{N}ー]+/gu) ?? []) {
      const h = hira(run);
      if (!KANA_ONLY.test(h)) return null;
      out.push({ surface: run, kana: h, spoken: h });
    }
    return out;
  }
  for (const tok of analyse(t)) {
    const s = tok.surface_form;
    if (!HAS_LETTER.test(s) && !/ー/.test(s)) continue;
    const self = hira(s);
    const kana = tok.reading && tok.reading !== '*' ? hira(tok.reading) : self;
    const spoken = tok.pronunciation && tok.pronunciation !== '*' ? hira(tok.pronunciation) : kana;
    if (!KANA_ONLY.test(kana) || !KANA_ONLY.test(spoken)) return null;
    out.push({ surface: s, kana, spoken });
  }
  return out;
}

/**
 * The words of a text as the dictionary reads them, each with whether the dictionary knows
 * it (a run of letters it only guessed at is not known) and where it starts in the text
 * (`at`, in UTF-16 units of text.normalize('NFKC'), which is what is read). Null when the
 * analyser is not loaded: then nothing can be said about what is a word. Punctuation is left out.
 */
export function japaneseWords(text: string): Array<{ surface: string; known: boolean; at: number }> | null {
  if (!analyse) return null;
  const t = text.normalize('NFKC');
  let from = 0;
  const out: Array<{ surface: string; known: boolean; at: number }> = [];
  for (const tok of analyse(t)) {
    const s = tok.surface_form;
    // The analyser's words follow one another through the text; indexOf only steps over what it left out.
    const at = t.indexOf(s, from);
    if (at >= 0) from = at + s.length;
    if (HAS_LETTER.test(s) || /ー/.test(s)) out.push({ surface: s, known: tok.word_type !== 'UNKNOWN', at: Math.max(at, 0) });
  }
  return out;
}

/** Sounds (morae) in a kana string: small ya, yu, yo and small vowels ride on the sound before them. */
export function moraeOfKana(kana: string): number {
  let n = 0;
  for (const ch of hira(kana)) if (/[ぁ-ゖー]/.test(ch) && !'ゃゅょぁぃぅぇぉゎ'.includes(ch)) n++;
  return n;
}

/** Sounds (morae) in a text, or null when it cannot be read. */
export function japaneseMorae(text: string): number | null {
  const toks = japaneseTokens(text);
  if (!toks) return null;
  return toks.reduce((n, t) => n + moraeOfKana(t.kana), 0);
}
