/**
 * The signature and the invocation in languages other than English.
 *
 * A card's quotation and name exist per language (src/lib/cards-i18n). In a duel
 * fought in such a language the signature is earned by echoing telling words of
 * the quotation as it is published in that language, and refused for reciting
 * it; the invocation is earned by a character's name as that language writes it.
 * The English line and the English names keep counting too, as they always did.
 *
 * How many words: as devices.ts asks of the English line (signatureNeeded), a line with three or more telling
 * words needs two of them, a line with one or two needs one. One verse word counts once, even when it says both
 * a word of the line and the same word of the English line (German «Rose» and "rose").
 *
 * What counts as the same word, by language:
 * - Spanish, French, German, Italian, Portuguese, Polish, Russian, Arabic, Hindi and Indonesian: two words
 *   are one when Snowball's stemmer for the language gives them one stem (./stem): Russian «Гамлета» says
 *   «Гамлет», Spanish «rosas» says «rosa», Arabic «والوردة» says «الوردة».
 * - Vietnamese: the same syllable with the same tone (ngủ "sleep" is not ngu "foolish", nor the start of người).
 * - Korean: the same word, with or without the particles (josa) that follow a noun: 햄릿이 says 햄릿.
 * - Chinese, Japanese and Thai are written unspaced: words come from Intl.Segmenter, as everywhere in the
 *   engine. A word is said when whole words of the verse spell it (Japanese: when they begin with it, since a
 *   verb's ending is often cut off as a word of its own). A run of Japanese katakana is one word (groupKatakana).
 * - An English word of the line, or an English name, is said only as English writes it: a word with an accent or
 *   a tone mark is the duel language's own (Portuguese «põe», "puts", is not Poe; Vietnamese «sáng» is not "sang").
 *
 * Names are stricter than the words of a line, because a stem is shared by words that name nobody:
 * - where names decline, a declined form must keep the name's letters: in Russian and Polish, all but the name's
 *   last vowel, followed by one of the language's noun case endings (Джульетту, Julię, Antoniusza), and written with
 *   a capital; in German the name with its genitive -s or what Snowball's stem allows (Romeos, Hamlets); in Arabic
 *   the whole name with what Snowball's stem allows (والروميو). So German «wartest» ("you wait") is not «Wärterin»
 *   though Snowball stems both to "wart", Arabic «روما» (Rome) is not «روميو», and Russian «медузу» (a jellyfish) is
 *   not «Медузу»;
 * - elsewhere a name is the same word, compared as above (no stems: «prosperidad» is not «Próspero»), and a verse
 *   word that carries an accent the name does not is another word (typed without accents, the name still counts).
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
 * English never comes through here: devices.ts keeps its own path for it.
 */
import { CARD_CATALOG, type Card } from '../cards';
import { getCardText, localEchoText, localQuote } from '../cards-i18n';
import { baseLang, rulesFor } from './lang';
import { stemmerFor } from './stem';
import { fold, hiragana, letterCount, wordParts, wordSpan, wordsOf } from './text';

const UNSPACED = new Set(['zh', 'ja', 'th']);
/** Languages whose names decline, so a name is matched by its stem there. */
const NAMES_DECLINE = new Set(['ru', 'pl', 'de', 'ar']);
/**
 * Of those, the ones whose script tells a name by its capital: a declined form written small is a common noun of
 * the same stem (Russian «марку», a stamp, beside «Марку», to Mark). German writes every noun with a capital.
 */
const CAPITAL_TELLS = new Set(['ru', 'pl']);

/**
 * Letters of the line that make a recital in an unspaced script: four English words' worth, by the median
 * number of letters per English word over the game's lines in that language (cards-i18n.test.ts measures it
 * again and fails if the lines have moved away from these numbers).
 */
export const RECITE_LETTERS: Record<string, number> = { zh: 6, ja: 9, th: 19 };

/** The same pattern text.ts reads spaced words with (wordsOf), keeping the letters' case. */
const WORD_RE = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu;

// --- Comparing words ---

/** Vietnamese tone marks: grave, acute, tilde, hook above, dot below. Circumflex, breve, horn and đ make other letters. */
const VI_TONE = /[\u0300\u0301\u0303\u0309\u0323]/gu;

/**
 * Thai SARA AM written as its two parts (nikhahit + sara aa, which is how its compatibility decomposition spells it
 * and how stopwords-iso's Thai list writes ทํา and สําหรับ) is the one letter everyone types.
 */
const thaiAm = (s: string) => s.replace(/ํา/g, 'ำ');

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
 * A verse word as an English word or name is compared with it in another language's duel: case and the kind of
 * apostrophe folded, accents and tones kept. English writes none of the game's names or telling words with them,
 * so a word that has one is the duel language's own (Portuguese «põe», "puts", is not Poe). In English, fold().
 */
export function englishKey(word: string, lang: string): string {
  if (baseLang(lang) === 'en') return fold(word);
  return word.normalize('NFC').toLowerCase().replace(/[\u2019\u2018\u02bc]/g, "'");
}

/** Does a Latin-script word carry a combining mark (an accent, a tone, a cedilla) once decomposed? */
const hasLatinMark = (w: string) => /\p{Script=Latin}/u.test(w) && /[\u0300-\u036f]/.test(w.normalize('NFD'));

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

const KATAKANA_RUN = /^[\p{Script=Katakana}\u30fc]+$/u;
let jaSegmenter: Intl.Segmenter | null | undefined;

/**
 * Japanese words, with a run of katakana kept as one word. ICU's dictionary cuts a name or a loanword it does not
 * know into pieces (ヨリック into ヨ and リック, ホレイショー into ホレイ and ショー), and a piece is then a word of
 * its own ("ショー", a show). MeCab, the analyser the IPA dictionary was made for, groups a run of unknown katakana
 * into one word (its char.def gives KATAKANA the GROUP flag); this does the same with the pieces ICU gives, when
 * they touch in the text. Each word comes with the pieces it was made of, lower-cased as wordsOf gives them.
 */
function groupKatakana(text: string): { word: string; pieces: string[] }[] {
  if (jaSegmenter === undefined) jaSegmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;
  if (!jaSegmenter) return wordsOf(text, 'ja').map((w) => ({ word: w, pieces: [w] }));
  const out: { word: string; pieces: string[]; end: number }[] = [];
  for (const s of jaSegmenter.segment(text)) {
    if (!s.isWordLike || !/\p{L}/u.test(s.segment)) continue;
    const w = s.segment.toLowerCase();
    const prev = out[out.length - 1];
    if (prev && prev.end === s.index && KATAKANA_RUN.test(prev.word) && KATAKANA_RUN.test(w)) {
      prev.word += w;
      prev.pieces.push(w);
      prev.end = s.index + s.segment.length;
    } else out.push({ word: w, pieces: [w], end: s.index + s.segment.length });
  }
  return out.map(({ word, pieces }) => ({ word, pieces }));
}

/** The words of a text as echo.ts reads them: wordsOf, with French and Italian elisions taken off, and Japanese katakana runs whole. */
function wordsIn(text: string, lang: string): string[] {
  const b = baseLang(lang);
  if (b === 'ja') return groupKatakana(text).map((w) => w.word);
  return wordsOf(text, b).map((w) => unElide(w, b));
}

/** The same words as wordsIn, as the text writes them (with their capitals), for a spaced script. */
function wordsWritten(text: string, lang: string): string[] {
  const b = baseLang(lang);
  return (text.match(WORD_RE) ?? []).map((w) => unElide(w, b));
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

/**
 * The separator of a list of words shown to the player: the language's own comma. Chinese and Japanese list with
 * the ideographic comma (CLDR's list patterns: 、), Arabic with the Arabic comma (U+060C), the others with ", ".
 */
export function listSeparator(lang: string): string {
  const b = baseLang(lang);
  return b === 'zh' || b === 'ja' ? '、' : b === 'ar' ? '، ' : ', ';
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

/** A verse's words in an unspaced script: the letters each is compared by, and the words (as wordsOf gives them) it was made of. */
interface Segment {
  key: string;
  pieces: string[];
}

function segmentsOf(verse: string, lang: string): Segment[] {
  const b = baseLang(lang);
  const words = b === 'ja' ? groupKatakana(verse) : wordsOf(verse, b).map((w) => ({ word: w, pieces: [w] }));
  return words.map((w) => ({ key: letters(w.word), pieces: w.pieces.map(fold) })).filter((s) => s.key);
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
 * Are two words of a line one word in two forms, as a verse word is matched to them? French «matinées» and
 * «matin», Portuguese «manhãs» and «manhã» share Snowball's stem; Korean 햄릿이 and 햄릿 differ by a particle.
 */
function sameWord(a: string, b: string, lang: string): boolean {
  const l = baseLang(lang);
  if (l === 'ko') return koStem(a, listsFor(l)) === koStem(b, listsFor(l));
  return stemmerFor(l) ? sameStem(a, b, l) : wordKey(a, l) === wordKey(b, l);
}

/**
 * The telling words of the card's quotation in this language, as the line writes them; empty when the language
 * has no line of its own. Where the line has a modern spelling (a Japanese line printed in old character forms)
 * its words come first, since that is what a player types, and the printed words follow, so either counts.
 * A word in two forms is listed once, in the form the line has first.
 */
export function localSignatureWords(card: Card, lang: string, modernOnly = false): string[] {
  const printed = localQuote(card, lang);
  if (!printed) return [];
  const modern = localEchoText(card, lang) ?? printed;
  const out: string[] = [];
  const keys = new Set<string>();
  for (const text of modern === printed || modernOnly ? [modern] : [modern, printed]) {
    for (const w of wordsIn(text, lang)) {
      // wordsOf lower-cases; show the word as the line writes it (a German noun keeps its capital).
      const shown = matchCase(w, text);
      const k = wordKey(shown, lang);
      if (keys.has(k) || !telling(shown, lang)) continue;
      keys.add(k);
      // The printed spelling of a word already listed is kept (it is what the printed line says); a second form of
      // a word in one spelling is not.
      if (text === modern && out.some((o) => sameWord(o, shown, lang))) continue;
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
 * The English line's words still count, said as English writes them (englishKey), and not when the word is a
 * little word of the duel's language (Italian "dove" is "where").
 */
export function localSignature(card: Card, verse: string, lang: string, english: EnglishEcho): LocalSignature | null {
  const b = baseLang(lang);
  if (b === 'en') return null;
  const quote = localQuote(card, b);
  if (!quote) return null;
  const local = localSignatureWords(card, b);
  if (!local.length) return null;
  // Counted in the spelling players type: 歓楽 and its printed form 歡樂 are one word of the line.
  const needed = localSignatureWords(card, b, true).length >= 3 ? 2 : 1;
  const sep = listSeparator(b);
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
  if (english.echoed.length) {
    // As English writes them: with their accents, a Spanish or Vietnamese word is that language's own.
    const written = new Set([...wordsOf(verse, b), ...wordParts(verse, 'en')].map((w) => englishKey(w, b).replace(/'s$/, '')));
    for (const w of english.echoed) {
      const parts = w.split(' ');
      if (parts.every((p) => written.has(p) && !isStop(p, b))) add(w, parts);
    }
  }
  if (hits.length < needed) return { met: false, detail: local.slice(0, 5).join(sep), code: needed > 1 ? 'hint-two' : 'hint' };
  // Reciting the line is refused as printed and in its modern spelling, and so is reciting the English line.
  const modern = localEchoText(card, b);
  if (recites(quote, verse, b) || (modern && modern !== quote && recites(modern, verse, b)) || english.quoted) {
    return { met: false, detail: '', code: 'quoted' };
  }
  return { met: true, detail: hits.slice(0, needed).map((h) => h.word).join(sep), code: 'echoed', words: [...new Set(hits.flatMap((h) => h.by))] };
}

// --- Invocation: character names as each language writes them ---

const SPLIT = /[\s・·‧]+/u;
const nameCache = new Map<string, string[]>();
/** The titles the English card names begin with (cards.ts: Prince Escalus, Friar Lawrence, King Claudius, Lady Macbeth, Lord Byron). */
const EN_TITLES = new Set(['prince', 'friar', 'king', 'lady', 'lord']);

/**
 * Names that count as an invocation in a language, beyond the English ones: every character's full name in that
 * language, and some single words of it, and its aliases.
 *
 * Which single words: devices.ts counts an English name's last part alone and never its titles or given names
 * ("Mary", "Mark"). So where the English card has a longer name (Mary Shelley, Mark Antony, Lady Macbeth), only
 * the last word of the local name counts alone; in Korean, which puts the title after the name (맥베스 부인 for Lady
 * Macbeth), the last word that is not an ordinary word when the English name begins with a title. Where the English card has one name (Romeo, Hamlet), each word of the local
 * label counts (Roméo Montaigu: Roméo, Montaigu), as English counts "Montague" for Lord Montague.
 *
 * In every case a word does not count by itself when it is an ordinary word of the language (a title: Russian
 * «граф», Vietnamese «Phu nhân»; Russian «Кора», bark, for Persephone), as Hunspell's dictionary tells (pack.common;
 * the rule is in build_card_text.py, common_name_words), nor when it is a stop word or shorter than three letters
 * (two where a letter is a syllable or a character).
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
  const alone = (w: string) => letterCount(w) >= min && !isStop(w, b) && (!!w.match(SPLIT) || !common.has(wordKey(w, b)));
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
    let single: string[] = [];
    if (parts.length > 1) {
      if (c.name.trim().split(/\s+/).length === 1) single = parts;
      else {
        const titled = EN_TITLES.has(c.name.trim().split(/\s+/)[0].toLowerCase());
        const last = b === 'ko' && titled ? [...parts].reverse().find((w) => !common.has(wordKey(w, b))) : parts[parts.length - 1];
        if (last) single = [last];
      }
    }
    for (const w of [...single, ...(text.aliases ?? []).map(clean)]) if (alone(w)) out.add(w);
  }
  const names = [...out];
  nameCache.set(b, names);
  return names;
}

/**
 * Russian and Polish names change their last vowel as they decline (Джульетта, Джульетту; Julia, Julię; Polish
 * also drops the e of -ek and -ec: Marek, Marka); what a declined form keeps is the rest.
 */
function declensionBase(key: string, lang: string): string {
  if (lang === 'ru') return key.replace(/[аяоеьйиыуюэ]$/u, '');
  if (lang === 'pl') return key.replace(/[aeiouy]$/u, '').replace(/e([kc])$/u, '$1');
  return key;
}

/**
 * The case endings of Russian and Polish nouns, singular and plural, folded as wordKey folds them (ё as е; Polish
 * ę, ą and ó as e, a and o): the endings of the standard declension paradigms, written out here by hand (no file
 * was fetched for them). A declined name is its base and one of these.
 */
const CASE_ENDINGS: Record<string, Set<string>> = {
  ru: new Set(['а', 'я', 'у', 'ю', 'ом', 'ем', 'ой', 'ей', 'ою', 'ею', 'е', 'и', 'ы', 'ам', 'ям', 'ами', 'ями', 'ах', 'ях', 'ов', 'ев']),
  pl: new Set(['a', 'u', 'owi', 'em', 'ie', 'y', 'i', 'e', 'o', 'om', 'ami', 'ach', 'ow']),
};

/** Is one word of a name said by one word of the verse (as the verse writes it)? */
function saysNameWord(name: string, verseWord: string, lang: string): boolean {
  const b = baseLang(lang);
  if (b === 'ko') {
    const n = fold(name);
    const v = fold(verseWord);
    return v.startsWith(n) && particlesOnly(v.slice(n.length), n, listsFor(b));
  }
  const n = wordKey(name, b);
  const v = wordKey(verseWord, b);
  if (NAMES_DECLINE.has(b) && n !== v) {
    if (CAPITAL_TELLS.has(b)) {
      const base = declensionBase(n, b);
      return v.startsWith(base) && CASE_ENDINGS[b].has(v.slice(base.length)) && /^\p{Lu}/u.test(verseWord);
    }
    if (b === 'de' && v === `${n}s`) return true;
    if (!stemmerFor(b) || !sameStem(name, verseWord, b)) return false;
    return b === 'ar' ? v.includes(n) : v.startsWith(n);
  }
  if (n !== v) return false;
  // Typed without accents the name still counts; with an accent the name does not have, it is another word.
  return !hasLatinMark(verseWord) || verseWord.normalize('NFC').toLowerCase() === name.normalize('NFC').toLowerCase() || b === 'vi';
}

/** The verse's words that say this name (one or more words, in a row), folded; or null. */
function saidName(name: string, verse: string, lang: string): string[] | null {
  const b = baseLang(lang);
  if (UNSPACED.has(b)) return spelledBySegments(letters(name), segmentsOf(verse, b), false);
  const n = wordsOf(name, b);
  const v = wordsWritten(verse, b);
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
