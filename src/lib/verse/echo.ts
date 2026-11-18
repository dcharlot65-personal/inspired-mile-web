/**
 * The signature and the invocation in languages other than English.
 *
 * A card's quotation and name exist per language (src/lib/cards-i18n). In a duel
 * fought in such a language the signature is earned by echoing a telling word of
 * the quotation as it is published in that language, and refused for reciting
 * it; the invocation is earned by a character's name as that language writes it.
 * The English line and the English names keep counting too, as they always did.
 *
 * What counts as the same word, by language:
 * - Spanish, French, German, Italian, Portuguese, Polish, Russian, Arabic, Hindi and Indonesian: two words
 *   are one when Snowball's stemmer for the language gives them one stem (./stem): Russian «Гамлета» says
 *   «Гамлет», Spanish «rosas» says «rosa», Arabic «والوردة» says «الوردة»; «prosperidad» is not «Próspero»'s
 *   name, because names are matched by stem only where names decline (Polish, Russian, German, Arabic).
 * - Vietnamese: the same syllable with the same tone (ngủ "sleep" is not ngu "foolish", nor the start of người).
 * - Korean: the same word, with or without the particles (josa) that follow a noun: 햄릿이 says 햄릿.
 * - Chinese, Japanese and Thai are written unspaced: words come from Intl.Segmenter, as everywhere in the
 *   engine. A word is said when whole words of the verse spell it (Japanese: when they begin with it, since a
 *   verb's ending is often cut off as a word of its own).
 *
 * What is not a telling word: the language's stop words (stopwords-iso), every word Wiktionary gives as a
 * pronoun, particle, conjunction, preposition, postposition, determiner or article (both lists are recorded in
 * docs/language/sources/), a Korean word that is such a word plus its particle (나는, "I" + topic), a Chinese or
 * Japanese word made only of stop characters (你的, "your"), and a Japanese word with no kanji or katakana
 * (particles, auxiliaries and endings are written in hiragana: した, あなた).
 *
 * Reciting the line, which is refused: four of its words running, as in English, or the whole line when it has
 * only two or three. Unspaced scripts count letters instead, because the segmenter's "words" are often single
 * particles: a run as long as four English words of the game's lines are in that language (RECITE_LETTERS).
 *
 * How many words: as devices.ts asks of the English line (signatureNeeded), a line with three or more telling
 * words needs two of them, a line with one or two needs one. One verse word counts once, even when it says both
 * a word of the line and the same word of the English line (German «Rose» and "rose").
 *
 * English never comes through here: devices.ts keeps its own path for it.
 */
import { CARD_CATALOG, type Card } from '../cards';
import { getCardText, localEchoText, localQuote } from '../cards-i18n';
import { baseLang, rulesFor } from './lang';
import { stemmerFor } from './stem';
import { fold, hiragana, letterCount, wordSpan, wordsOf } from './text';

const UNSPACED = new Set(['zh', 'ja', 'th']);
/** Languages whose names decline, so a name is matched by its stem there. */
const NAMES_DECLINE = new Set(['ru', 'pl', 'de', 'ar']);

/**
 * Letters of the line that make a recital in an unspaced script: four English words' worth, by the median
 * number of letters per English word over the game's lines in that language (cards-i18n.test.ts measures it
 * again and fails if the lines have moved away from these numbers).
 */
export const RECITE_LETTERS: Record<string, number> = { zh: 6, ja: 9, th: 19 };

// --- Comparing words ---

/** Vietnamese tone marks: grave, acute, tilde, hook above, dot below. Circumflex, breve, horn and đ make other letters. */
const VI_TONE = /[̣̀́̃̉]/gu;

/**
 * Thai SARA AM written as its two parts (nikhahit + sara aa, which is how its compatibility decomposition spells it
 * and how stopwords-iso's Thai list writes ทํา and สําหรับ) is the one letter everyone types.
 */
const thaiAm = (s: string) => s.replace(/\u0E4D\u0E32/g, '\u0E33');

/**
 * A word as it is compared. Vietnamese keeps its tone wherever the mark is placed (hoà and hòa are one
 * spelling). Elsewhere fold() (case, Latin accents, Arabic vowel marks), Japanese katakana as hiragana, Thai
 * SARA AM in one piece.
 */
export function wordKey(word: string, lang: string): string {
  const b = baseLang(lang);
  if (b === 'vi') {
    const d = word.normalize('NFD').toLowerCase();
    return d.replace(VI_TONE, '').normalize('NFC') + (d.match(VI_TONE) ?? []).join('');
  }
  const f = fold(word);
  return b === 'ja' ? hiragana(f) : b === 'th' ? thaiAm(f) : f;
}

/**
 * French and Italian write an elided article or pronoun onto the next word with an apostrophe: l’amour, c’est,
 * dell’alba. The word is what follows it. The elided forms are Apache Lucene's (FrenchAnalyzer and ItalianAnalyzer,
 * DEFAULT_ARTICLES, Apache-2.0), which a search engine strips the same way.
 */
const ELIDED: Record<string, Set<string>> = {
  fr: new Set(['l', 'm', 't', 'qu', 'n', 's', 'j', 'd', 'c', 'jusqu', 'quoiqu', 'lorsqu', 'puisqu']),
  it: new Set(['c', 'l', 'all', 'dall', 'dell', 'nell', 'sull', 'coll', 'pell', 'gl', 'agl', 'dagl', 'degl', 'negl', 'sugl', 'un', 'm', 't', 's', 'v', 'd']),
};
export function unElide(word: string, lang: string): string {
  const set = ELIDED[baseLang(lang)];
  if (!set) return word;
  const m = /^(\p{L}+)['’](\p{L}.*)$/u.exec(word);
  return m && set.has(m[1].toLowerCase()) ? m[2] : word;
}

/** The words of a text as echo.ts reads them: wordsOf, with French and Italian elisions taken off. */
function wordsIn(text: string, lang: string): string[] {
  return wordsOf(text, lang).map((w) => unElide(w, lang));
}

/** Letters only (marks kept), kana merged: how runs of an unspaced script are compared. */
function letters(text: string): string {
  return thaiAm(hiragana(fold(text))).replace(/[^\p{L}\p{M}]/gu, '');
}

/** The stems a word is matched by where Snowball has the language: as written and as folded, so unaccented typing still finds it. */
function stems(word: string, lang: string): string[] {
  const stem = stemmerFor(lang);
  const key = wordKey(word, lang);
  if (!stem) return [key];
  return [...new Set([fold(stem(word)), fold(stem(key))])];
}

function sameStem(a: string, b: string, lang: string): boolean {
  const sa = stems(a, lang);
  return stems(b, lang).some((s) => sa.includes(s));
}

// --- Per-language lists: stop words, stop characters, Korean particles ---

interface Lists {
  stop: Set<string>;
  /** Single characters on the stop list (Chinese, Japanese). */
  stopChars: Set<string>;
  /** Korean particles, longest first. */
  particles: string[];
  /** Korean particles that follow only a vowel (를; also ㄹ: 로) or only a consonant (을). */
  afterVowel: Set<string>;
  afterConsonant: Set<string>;
  alsoAfterL: Set<string>;
  /** Name words that are ordinary words of the language (Hunspell), which do not count as a name by themselves. */
  common: Set<string>;
}
const lists = new Map<string, Lists>();
function listsFor(lang: string): Lists {
  const b = baseLang(lang);
  const have = lists.get(b);
  if (have) return have;
  const pack = getCardText(b);
  const stop = new Set((pack?.stop ?? []).map((w) => wordKey(w, b)));
  const l: Lists = {
    stop,
    stopChars: new Set([...stop].filter((w) => [...w].length === 1)),
    particles: [...new Set((pack?.particles ?? []).map((p) => fold(p)))].sort((x, y) => y.length - x.length),
    afterVowel: new Set(pack?.particleForms?.afterVowel ?? []),
    afterConsonant: new Set(pack?.particleForms?.afterConsonant ?? []),
    alsoAfterL: new Set(pack?.particleForms?.alsoAfterL ?? []),
    common: new Set((pack?.common ?? []).map((w) => wordKey(w, b))),
  };
  if (pack) lists.set(b, l);
  return l;
}

/**
 * Korean: may particle `p` follow `before`? A noun that ends in a vowel takes 를, 는, 가, 와; one that ends in a
 * consonant takes 을, 은, 이, 과; 로 also follows ㄹ, where 으로 does not (Wiktionary's allomorph pairs). So 아이,
 * "child", is not 아 with the particle 이, and 오필리아 is not 오필리 with the vocative 아.
 */
function particleFits(p: string, before: string, l: Lists): boolean {
  const code = before.charCodeAt(before.length - 1) - 0xac00;
  if (code < 0 || code >= 11172) return true;
  const fin = code % 28; // 0: no final consonant; 8: ㄹ
  if (l.afterVowel.has(p)) return fin === 0 || (fin === 8 && l.alsoAfterL.has(p));
  if (l.afterConsonant.has(p)) return fin !== 0 && !(fin === 8 && p.startsWith('으') && l.alsoAfterL.has(p.slice(1)));
  return true;
}

/** Korean: is `tail` one particle, or two in a row (에서 + 는), after `before`? */
function particlesOnly(tail: string, before: string, l: Lists): boolean {
  if (!tail) return true;
  for (const p of l.particles) {
    if (!tail.startsWith(p) || !particleFits(p, before, l)) continue;
    const rest = tail.slice(p.length);
    if (!rest || (l.particles.includes(rest) && particleFits(rest, p, l))) return true;
  }
  return false;
}

/** Korean: a word without the particles after it, keeping at least two syllables (석 is not a stem of 석양). */
function koStem(word: string, l: Lists): string {
  let w = fold(word);
  for (let round = 0; round < 2; round++) {
    const p = l.particles.find((x) => w.endsWith(x) && [...w].length - [...x].length >= 2 && particleFits(x, w.slice(0, w.length - x.length), l));
    if (!p) break;
    w = w.slice(0, w.length - p.length);
  }
  return w;
}

/**
 * Korean case and topic particles (격조사, and the 보조사 은/는, 도, 만): the ones a one-syllable pronoun takes in 나는,
 * 너를, 저도. A longer pronoun with any particles is a pronoun too (우리에게는); a one-syllable one only with these, so
 * that 아들 ("son") is not 아 + the plural 들.
 */
const KO_CASE = new Set(['이', '가', '을', '를', '은', '는', '의', '에', '에게', '와', '과', '로', '으로', '도', '만']);

/** Is this word a function word of the language (or, in Korean, one followed by its particle)? */
function isStop(word: string, lang: string): boolean {
  const b = baseLang(lang);
  const l = listsFor(b);
  const k = wordKey(word, b);
  if (l.stop.has(k)) return true;
  if (b === 'ko') {
    for (let i = 1; i < k.length; i++) {
      const stem = k.slice(0, i);
      const tail = k.slice(i);
      if (!l.stop.has(stem)) continue;
      if (i >= 2 ? particlesOnly(tail, stem, l) : KO_CASE.has(tail) && particleFits(tail, stem, l)) return true;
    }
    if (l.stop.has(koStem(k, l))) return true;
  }
  if (b === 'zh' || b === 'ja') {
    // A word made only of stop characters (你的 = 你 + 的). Katakana is compared as hiragana, as the stop list is.
    const chars = [...fold(word)].filter((c) => /\p{L}/u.test(c));
    if (chars.length > 1 && chars.every((c) => l.stopChars.has(b === 'ja' ? hiragana(c) : c))) return true;
  }
  return false;
}

/** Can this word of a line be a telling word? Long enough for its language and not a function word. */
function telling(word: string, lang: string): boolean {
  const b = baseLang(lang);
  if (wordSpan(word) < rulesFor(b).content) return false;
  // Japanese writes particles, auxiliaries and inflected endings in hiragana: a word with no kanji or katakana is one of those.
  if (b === 'ja' && !/[\p{Script=Han}\p{Script=Katakana}]/u.test(word)) return false;
  if (b === 'ko' && letterCount(koStem(word, listsFor(b))) < rulesFor(b).content) return false;
  return !isStop(word, b);
}

/** A verse's words in an unspaced script: the letters each is compared by, and the word (as wordsOf gives it), folded. */
interface Segment {
  key: string;
  pieces: string[];
}

function segmentsOf(verse: string, lang: string): Segment[] {
  return wordsOf(verse, lang).map((w) => ({ key: letters(w), pieces: [fold(w)] })).filter((s) => s.key);
}

/** Whole words of the verse, in a row, that spell `target` (or, with `prefix`, begin with it): the words, or null. */
function spelledBySegments(target: string, segs: Segment[], prefix: boolean): string[] | null {
  if (!target) return null;
  for (let i = 0; i < segs.length; i++) {
    let run = '';
    for (let j = i; j < segs.length && run.length < target.length; j++) {
      run += segs[j].key;
      if (run === target || (prefix && run.startsWith(target))) return segs.slice(i, j + 1).flatMap((s) => s.pieces);
    }
  }
  return null;
}

/**
 * The verse's words that say `word` (a word of a line), as its language counts the same word, folded; or null
 * when none does. These are the words a multiplier does not multiply (duel.ts, text.ts ownContent).
 */
export function saidBy(word: string, verse: string, lang: string): string[] | null {
  const b = baseLang(lang);
  if (UNSPACED.has(b)) return spelledBySegments(letters(word), segmentsOf(verse, b), b === 'ja');
  const said = wordsIn(verse, b).filter((v) => !isStop(v, b));
  let hit: string | undefined;
  if (b === 'ko') {
    const l = listsFor(b);
    const stem = koStem(word, l);
    hit = said.find((v) => {
      const f = fold(v);
      return f.startsWith(stem) && particlesOnly(f.slice(stem.length), stem, l);
    });
  } else if (stemmerFor(b)) hit = said.find((v) => sameStem(v, word, b));
  else {
    const k = wordKey(word, b);
    hit = said.find((v) => wordKey(v, b) === k);
  }
  return hit === undefined ? null : [fold(hit)];
}

/** Is `word` (a word of a line) said in the verse, as its language counts the same word? */
export function saysWord(word: string, verse: string, lang: string): boolean {
  return saidBy(word, verse, lang) !== null;
}

/**
 * The telling words of the card's quotation in this language, as the line writes them; empty when the language
 * has no line of its own. Where the line has a modern spelling (a Japanese line printed in old character forms)
 * its words come first, since that is what a player types, and the printed words follow, so either counts.
 */
export function localSignatureWords(card: Card, lang: string): string[] {
  const printed = localQuote(card, lang);
  if (!printed) return [];
  const modern = localEchoText(card, lang) ?? printed;
  const out: string[] = [];
  const keys = new Set<string>();
  for (const text of modern === printed ? [printed] : [modern, printed]) {
    for (const w of wordsIn(text, lang)) {
      // wordsOf lower-cases; show the word as the line writes it (a German noun keeps its capital).
      const shown = matchCase(w, text);
      const k = wordKey(shown, lang);
      if (keys.has(k) || !telling(shown, lang)) continue;
      keys.add(k);
      out.push(shown);
    }
  }
  return out;
}

/** The word as it is written in `text` (wordsOf lower-cases it). */
function matchCase(word: string, text: string): string {
  const i = text.toLowerCase().indexOf(word);
  return i >= 0 && text.length === text.toLowerCase().length ? text.slice(i, i + word.length) : word;
}

/** Does the verse recite the line: four of its words running, or the whole of a line of two or three words? */
function recites(quote: string, verse: string, lang: string): boolean {
  const b = baseLang(lang);
  const q = wordsOf(quote, b);
  if (q.length < 2) return false;
  if (UNSPACED.has(b)) {
    const line = letters(quote);
    const v = letters(verse);
    const n = Math.min(RECITE_LETTERS[b], [...line].length);
    const ls = [...line];
    for (let i = 0; i + n <= ls.length; i++) if (v.includes(ls.slice(i, i + n).join(''))) return true;
    return false;
  }
  const run = Math.min(4, q.length);
  const qk = q.map((w) => wordKey(w, b));
  const spoken = ` ${wordsOf(verse, b).map((w) => wordKey(w, b)).join(' ')} `;
  for (let i = 0; i + run <= qk.length; i++) if (spoken.includes(` ${qk.slice(i, i + run).join(' ')} `)) return true;
  return false;
}

export interface LocalSignature {
  met: boolean;
  detail: string;
  code: 'hint' | 'hint-two' | 'quoted' | 'echoed';
  /** The verse's words that landed it, folded (see saidBy). */
  words?: string[];
}

/** What the English line's measure (devices.ts) found in the verse. */
export interface EnglishEcho {
  /** The English line's signature words (or phrase) the verse says, as devices.ts compares them. */
  echoed: string[];
  /** Does the verse recite the English line (four of its words running)? */
  quoted: boolean;
}

/**
 * The signature in a language that has its own line for this card, or null when
 * it has none (English, a language not loaded, a card not translated, a line with no telling word of its own):
 * the caller then judges by the English line alone, as before.
 *
 * The English line's words still count (a word of the duel's language that is spelled like one, Italian "dove" for
 * "where", is a stop word there and does not).
 */
export function localSignature(card: Card, verse: string, lang: string, english: EnglishEcho): LocalSignature | null {
  const b = baseLang(lang);
  if (b === 'en') return null;
  const quote = localQuote(card, b);
  if (!quote) return null;
  const local = localSignatureWords(card, b);
  if (!local.length) return null;
  const needed = local.length >= 3 ? 2 : 1;
  const hits: { word: string; by: string[] }[] = [];
  const taken = new Set<string>();
  const add = (word: string, by: string[]) => {
    if (by.some((w) => taken.has(w))) return;
    for (const w of by) taken.add(w);
    hits.push({ word, by });
  };
  for (const w of local) {
    const by = saidBy(w, verse, b);
    if (by) add(w, by);
  }
  // Compared as the duel's language compares words: a Vietnamese word keeps its tone, so it is not a toneless English word.
  const saidEn = new Set(wordsOf(verse, 'en').filter((w) => !isStop(w, b)).map((w) => wordKey(w, b)));
  for (const w of english.echoed) {
    const parts = w.split(' ');
    if (parts.every((p) => saidEn.has(p))) add(w, parts);
  }
  if (hits.length < needed) return { met: false, detail: local.slice(0, 5).join(', '), code: needed > 1 ? 'hint-two' : 'hint' };
  // Reciting the line is refused as printed and in its modern spelling, and so is reciting the English line.
  const modern = localEchoText(card, b);
  if (recites(quote, verse, b) || (modern && modern !== quote && recites(modern, verse, b)) || english.quoted) {
    return { met: false, detail: '', code: 'quoted' };
  }
  return { met: true, detail: hits.slice(0, needed).map((h) => h.word).join(', '), code: 'echoed', words: [...new Set(hits.flatMap((h) => h.by))] };
}

// --- Invocation: character names as each language writes them ---

const SPLIT = /[\s・·‧]+/u;
const nameCache = new Map<string, string[]>();

/**
 * Names that count as an invocation in a language, beyond the English ones: every character's full name in that
 * language, each word of it, and its aliases. A word of a longer name, or an alias, does not count by itself when
 * it is an ordinary word of the language (a title: Russian «граф», Vietnamese «Phu nhân»; Russian «Кора», bark,
 * for Persephone), as Hunspell's dictionary tells (pack.common; the rule is in build_card_text.py,
 * common_name_words), nor when it is a stop word or shorter than three letters (two where a letter is a syllable
 * or a character).
 */
export function localCharacterNames(lang: string): string[] {
  const b = baseLang(lang);
  const pack = getCardText(b);
  if (!pack) return [];
  const have = nameCache.get(b);
  if (have) return have;
  const min = ['zh', 'ja', 'ko', 'th', 'hi'].includes(b) ? 2 : 3;
  const { common } = listsFor(b);
  const clean = (s: string) => s.replace(/^[^\p{L}]+|[^\p{L}\p{M}]+$/gu, '');
  const out = new Set<string>();
  for (const c of CARD_CATALOG) {
    if (c.type !== 'Character') continue;
    const text = pack.cards[c.id];
    if (!text?.name || text.nameSource === 'missing') continue;
    const full = clean(text.name.replace(/,.*$/u, ''));
    if (full && letterCount(full) >= min) out.add(full);
    // The product name ("The Sonnet Man") counts whole; its words are English and count as English counts them.
    if (text.nameSource === 'kept') continue;
    const parts = full.split(SPLIT).map(clean).filter(Boolean);
    const single = [...(parts.length > 1 ? parts : []), ...(text.aliases ?? []).map(clean)];
    for (const w of single) {
      if (letterCount(w) < min || isStop(w, b)) continue;
      if (!w.match(SPLIT) && common.has(wordKey(w, b))) continue;
      out.add(w);
    }
  }
  const names = [...out];
  nameCache.set(b, names);
  return names;
}

/** Is one word of a name said by one word of the verse? */
function saysNameWord(name: string, verseWord: string, lang: string): boolean {
  const b = baseLang(lang);
  if (b === 'ko') {
    const n = fold(name);
    const v = fold(verseWord);
    return v.startsWith(n) && particlesOnly(v.slice(n.length), n, listsFor(b));
  }
  if (NAMES_DECLINE.has(b) && stemmerFor(b)) return sameStem(name, verseWord, b);
  return wordKey(name, b) === wordKey(verseWord, b);
}

/** The verse's words that say this name (one or more words, in a row), folded; or null. */
function saidName(name: string, verse: string, lang: string): string[] | null {
  const b = baseLang(lang);
  if (UNSPACED.has(b)) return spelledBySegments(letters(name), segmentsOf(verse, b), false);
  const n = wordsOf(name, b);
  const v = wordsIn(verse, b);
  for (let i = 0; i + n.length <= v.length; i++) if (n.every((w, j) => saysNameWord(w, v[i + j], b))) return v.slice(i, i + n.length).map(fold);
  return null;
}

/** The first localised name the verse says, with the verse's words that say it; or undefined. */
export function saidLocalName(verse: string, lang: string): { name: string; words: string[] } | undefined {
  if (baseLang(lang) === 'en') return undefined;
  for (const name of localCharacterNames(lang)) {
    const words = saidName(name, verse, lang);
    if (words) return { name, words };
  }
  return undefined;
}
