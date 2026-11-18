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
 * - Vietnamese: the same syllable with the same tone (ngủ "sleep" is not ngu "foolish", nor the start of người). A
 *   word of the line of more than one syllable (Wiktionary's, pack.compounds: «vấn đề», "problem") is one telling
 *   word, said when its syllables come in a row: «vấn an» ("to ask after") does not say «vấn đề».
 * - Korean: the same word, with or without the particles (josa) that follow a noun: 햄릿이 says 햄릿.
 * - Chinese, Japanese and Thai are written unspaced: words come from Intl.Segmenter, as everywhere in the
 *   engine. A word is said when whole words of the verse spell it (Japanese: when they begin with it, since a
 *   verb's ending is often cut off as a word of its own). A run of Japanese katakana is one word (groupKatakana).
 * - An English word of the line, or an English name, is said only as English writes it: a word with an accent or
 *   a tone mark is the duel language's own (Portuguese «põe», "puts", is not Poe; Vietnamese «sáng» is not "sang").
 *
 * Names are stricter than the words of a line: a name is the name, compared as above but never by a stem («prosperidad»
 * is not «Próspero»), or, where names decline (Russian, Polish, German, Arabic), one of the forms the card text lists for
 * it (pack.forms: Джульетту, Julię, Romeos, وروميو). Those come from one paradigm per ending, singular only
 * (scripts/language/check/declension.py: an indeclinable name such as «Банко» has none), and Hunspell has dropped
 * every form it knows as an ordinary word («Марку», to a stamp; Polish «Banku», of a bank). Matching by a stem and
 * any case ending let common words in: Russian «Банки» ("banks"), «Дитя» ("child"), Polish «Kora» ("bark"), Arabic
 * «بانكوك» (Bangkok), German «wartest» ("you wait") for «Wärterin». A declined form keeps the name's capital, where
 * the name has one (Russian «марку», a stamp, is not «Марку»). A verse word that carries an accent the name or the
 * form does not is another word (Polish «Bańka», "bubble"; Spanish «París», the city, is not «Paris»; typed without
 * accents, the name still counts).
 *
 * A name that is also an ordinary word of the language counts as English counts "Bottom" and "Nurse" (devices.ts): not
 * by itself. The card text lists those (pack.ordinary: English Wiktionary, with Hunspell where the script has capitals):
 * Spanish «bruto», Italian «banco», German «Zettel», Japanese パック, Hindi बैंको, Thai โพ. In a language that writes its
 * ordinary words small, such a name counts by itself only written with a capital inside a sentence («y Bruto alzó el
 * puñal», not «Bruto es el sueldo»); in German (whose nouns all take a capital) and in scripts without capitals, never
 * by itself, only inside a longer name. A character English calls on only in a phrase (Bottom) is called on only in a
 * longer name in every language; one whose English name is a role with its article ("The Nurse") counts by its local
 * name as written (奶妈, «Кормилица»), as English counts "the nurse".
 *
 * Unspaced, a name is not a piece of a longer word. The segmenter cuts a word it does not know into pieces, and a piece
 * can be a name (安东尼奥, "Antonio", into 安东尼, Mark Antony, and 奥), so its words do not settle it alone:
 * - Japanese: a name in katakana is said only in katakana and only as a whole run of it (ららぽーと, a shopping mall, is
 *   not ポー).
 * - Chinese: a foreign name is spelled in the characters of Xinhua's transliteration tables (pack.transliteration), and a
 *   name of the game with more such characters beside it is a piece of a longer foreign name (哈德斯菲尔德, Huddersfield;
 *   迪帕克, Deepak; 安东尼娅, Antonia): see carriesOn. A common word written in them (当然, "of course") or a function
 *   word ends the foreign name.
 * - Thai: the letters beside the name must be words the invocation knows (the pronunciation table's and the card text's);
 *   a piece of an unknown word (เพอร์ in เพอร์เซอุส, Perseus; ซาน in ซานแอนโทนีโอ, San Antonio) is not one: see thNameAt.
 * - Chinese and Thai: a name is also refused where the verse writes around it a dictionary word that holds it
 *   (pack.containing: 圣安东尼奥, "San Antonio"; อัสซุส, Assus), for words such as 宙斯盾 that no rule can tell.
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
import { ORDINARY_NAME_PARTS } from './names-en';
import { soundOf } from './sound';
import { fold, hiragana, letterCount, wordParts, wordSpan, wordsOf } from './text';

const UNSPACED = new Set(['zh', 'ja', 'th']);
/** Languages whose names change in a sentence; their forms are listed in the card text (pack.forms). */
const NAMES_DECLINE = new Set(['ru', 'pl', 'de', 'ar']);

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
function groupKatakana(text: string): Span[] {
  if (jaSegmenter === undefined) jaSegmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;
  if (!jaSegmenter) return wordsOf(text, 'ja').map((w) => ({ word: w, pieces: [w], start: -1, end: -1 }));
  const out: Span[] = [];
  for (const s of jaSegmenter.segment(text)) {
    if (!s.isWordLike || !/\p{L}/u.test(s.segment)) continue;
    const w = s.segment.toLowerCase();
    const prev = out[out.length - 1];
    if (prev && prev.end === s.index && KATAKANA_RUN.test(prev.word) && KATAKANA_RUN.test(w)) {
      prev.word += w;
      prev.pieces.push(w);
      prev.end = s.index + s.segment.length;
    } else out.push({ word: w, pieces: [w], start: s.index, end: s.index + s.segment.length });
  }
  return out;
}

/** A word of a text with the pieces the segmenter gave it in and where it stands in the text (-1 without a segmenter). */
interface Span {
  word: string;
  pieces: string[];
  start: number;
  end: number;
}

const segmenters = new Map<string, Intl.Segmenter | null>();
/** The words of an unspaced text with where each stands: Japanese with its katakana runs whole (groupKatakana). */
function wordSpans(text: string, lang: string): Span[] {
  if (lang === 'ja') return groupKatakana(text);
  if (!segmenters.has(lang)) segmenters.set(lang, typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(lang, { granularity: 'word' }) : null);
  const seg = segmenters.get(lang);
  if (!seg) return wordsOf(text, lang).map((w) => ({ word: w, pieces: [w], start: -1, end: -1 }));
  const out: Span[] = [];
  for (const s of seg.segment(text)) {
    if (!s.isWordLike || !/\p{L}/u.test(s.segment)) continue;
    const w = s.segment.toLowerCase();
    out.push({ word: w, pieces: [w], start: s.index, end: s.index + s.segment.length });
  }
  return out;
}

/** The words of a text as echo.ts reads them: wordsOf, with French and Italian elisions taken off, and Japanese katakana runs whole. */
function wordsIn(text: string, lang: string): string[] {
  const b = baseLang(lang);
  if (b === 'ja') return groupKatakana(text).map((w) => w.word);
  return wordsOf(text, b).map((w) => unElide(w, b));
}

/** Letters only (marks kept), kana merged: how runs of an unspaced script are compared. */
function letters(text: string): string {
  return thaiAm(hiragana(fold(text))).replace(/[^\p{L}\p{M}]/gu, '');
}

/** Letters only, as a name is compared in an unspaced script: as letters(), but kana kept as written (a name in katakana is said in katakana). */
function nameLetters(text: string): string {
  return thaiAm(fold(text)).replace(/[^\p{L}\p{M}]/gu, '');
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
  /**
   * Vietnamese: the line's words of more than one syllable, as the syllables' wordKeys joined by a space. Thai: the
   * line's words as PyThaiNLP reads them, as their wordKeys (ICU's pieces of one, joined, make it).
   */
  compounds: Set<string>;
  /** The most syllables (Vietnamese) or ICU pieces (Thai) of any of them. */
  longest: number;
  /** Russian, Polish, German, Arabic: the listed forms of each name word (pack.forms), by the word's wordKey. */
  forms: Map<string, string[]>;
  /** Names that are also ordinary words (pack.ordinary): the ordinary word as the language writes it, by its wordKey. */
  ordinary: Map<string, string>;
  /** Chinese and Thai: the dictionary words that hold a name (pack.containing), by the name's nameLetters, as nameLetters' text. */
  containing: Map<string, string[]>;
  /** Chinese: the characters foreign names are spelled with, those that are no word by themselves, and the common words written only in them (pack.transliteration). */
  xlit: Set<string>;
  bound: Set<string>;
  native: Set<string>;
  /** Thai: the card text's own words (stop words, the lines' words), which the invocation reads as words besides the pronunciation table's. */
  thaiWords: Set<string>;
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
    compounds: new Set((pack?.compounds ?? []).map((w) => compoundParts(w, b).join(COMPOUND_JOIN[b] ?? ' '))),
    // One more than the most pieces, since ICU may cut a word in a line otherwise than alone.
    longest: Math.max(1, ...(pack?.compounds ?? []).map((w) => compoundParts(w, b).length + (b === 'th' ? 1 : 0))),
    forms: new Map(Object.entries(pack?.forms ?? {}).map(([w, fs]) => [wordKey(w, b), fs])),
    ordinary: new Map((pack?.ordinary ?? []).map((w) => [wordKey(w, b), w])),
    containing: new Map(Object.entries(pack?.containing ?? {}).map(([n, ws]) => [nameLetters(n), ws.map((w) => thaiAm(fold(w)))])),
    xlit: new Set([...(pack?.transliteration?.chars ?? '')]),
    bound: new Set([...(pack?.transliteration?.bound ?? '')]),
    native: new Set(pack?.transliteration?.native ?? []),
    thaiWords: new Set(b === 'th' ? [...(pack?.stop ?? []), ...(pack?.compounds ?? [])].map((w) => thaiAm(fold(w))) : []),
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

/** A Vietnamese word's syllables, as wordKey compares each (a hyphen joins syllables too: xi-rô). */
function syllableKeys(word: string, lang: string): string[] {
  return wordsOf(word.replace(/[-‐]/g, ' '), lang).map((w) => wordKey(w, lang));
}

/** How the parts of a word of pack.compounds are written together: Vietnamese syllables with a space, Thai pieces with nothing. */
const COMPOUND_JOIN: Record<string, string> = { vi: ' ', th: '' };

/** The parts of a word of pack.compounds, as wordKey compares each: Vietnamese syllables, Thai ICU pieces. */
function compoundParts(word: string, lang: string): string[] {
  return lang === 'th' ? wordsOf(word, lang).map((w) => wordKey(w, lang)) : syllableKeys(word, lang);
}

/**
 * The words of a line as the signature reads them: wordsIn, and the parts of a word of pack.compounds taken together,
 * the longest first: in Vietnamese the syllables of a word of more than one (vấn đề), in Thai the pieces ICU cuts a
 * word into (โรสแมรี, "rosemary", which ICU reads as โรส, "rose", and แมรี, "Mary").
 */
function lineWords(text: string, lang: string): string[] {
  const b = baseLang(lang);
  const ws = wordsIn(text, b);
  const join = COMPOUND_JOIN[b];
  if (join === undefined) return ws;
  const l = listsFor(b);
  if (!l.compounds.size) return ws;
  const keys = ws.map((w) => wordKey(w, b));
  const out: string[] = [];
  // A Thai word one of whose pieces is a function word is a phrase that holds one (ขอให้, "let", is ขอ and ให้): the
  // stop list decides its pieces, as before.
  const whole = (i: number, n: number) => l.compounds.has(keys.slice(i, i + n).join(join)) && (b !== 'th' || !ws.slice(i, i + n).some((w) => isStop(w, b)));
  for (let i = 0; i < ws.length; ) {
    let n = Math.min(l.longest, ws.length - i);
    for (; n > 1; n--) if (whole(i, n)) break;
    out.push(ws.slice(i, i + n).join(join));
    i += n;
  }
  return out;
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
  if (b === 'vi' && /\s/.test(word)) {
    // A word of several syllables is said when they come in a row.
    const want = syllableKeys(word, b);
    const said = wordsOf(verse, b);
    const keys = said.map((w) => wordKey(w, b));
    for (let i = 0; i + want.length <= keys.length; i++) if (want.every((k, j) => keys[i + j] === k)) return said.slice(i, i + want.length).map(fold);
    return null;
  }
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
    for (const w of lineWords(text, lang)) {
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
/** A name that counts by itself, and whether only written with a capital inside a sentence (an ordinary word too). */
interface LocalName {
  name: string;
  capital: boolean;
}
const nameCache = new Map<string, LocalName[]>();
/** The titles the English card names begin with (cards.ts: Prince Escalus, Friar Lawrence, King Claudius, Lady Macbeth, Lord Byron). */
const EN_TITLES = new Set(['prince', 'friar', 'king', 'lady', 'lord']);

/**
 * How a word of a name that is also an ordinary word (pack.ordinary) counts by itself: 'free' when it is no ordinary
 * word; 'capital' when the language writes the ordinary word small and the name with a capital (Spanish «bruto»,
 * «Bruto»): only written so, inside a sentence; 'never' when the ordinary word takes a capital too (a German noun,
 * «Zettel») or the script has no capitals (パック).
 */
function ordinaryKind(word: string, lang: string): 'free' | 'capital' | 'never' {
  const o = listsFor(lang).ordinary.get(wordKey(word, lang));
  if (o === undefined) return 'free';
  if (o.toLowerCase() === o.toUpperCase()) return 'never';
  return o === o.toLowerCase() && /^\p{Lu}/u.test(word) ? 'capital' : 'never';
}

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
 * In every case a word does not count by itself when it is a title or a word of a longer name that is an ordinary word
 * (Russian «граф», Vietnamese «Phu nhân»), as Hunspell's dictionary tells (pack.common; build_card_text.py,
 * common_name_words), nor when it is a stop word or shorter than three letters (two where a letter is a syllable or a
 * character). A name of one word, a word of a name or an alias that is an ordinary word of the language (pack.ordinary)
 * counts by itself only as ordinaryKind says. As devices.ts has it for English, a character whose English name is an
 * ordinary word (Bottom) counts only by a longer name, and one whose English name is a role with its article (The
 * Nurse) by its local name and aliases as written.
 */
function localNames(lang: string): LocalName[] {
  const b = baseLang(lang);
  const pack = getCardText(b);
  if (!pack) return [];
  const have = nameCache.get(b);
  if (have) return have;
  const min = ['zh', 'ja', 'ko', 'th', 'hi'].includes(b) ? 2 : 3;
  const { common } = listsFor(b);
  const clean = (s: string) => s.replace(/^[^\p{L}]+|[^\p{L}\p{M}]+$/gu, '');
  const oneWord = (w: string) => !SPLIT.test(w);
  const out = new Map<string, boolean>();
  const add = (name: string, capital: boolean) => out.set(name, (out.get(name) ?? true) && capital);
  for (const c of CARD_CATALOG) {
    if (c.type !== 'Character') continue;
    const text = pack.cards[c.id];
    if (!text?.name || text.nameSource === 'missing') continue;
    const en = c.name.trim();
    // English counts this character only in a phrase ("Nick Bottom"): so here, only by a longer name.
    const phraseOnly = oneWord(en) && ORDINARY_NAME_PARTS.has(en.toLowerCase());
    // English counts "The Nurse", an ordinary phrase, whole: the local name of such a card is that phrase.
    const role = /^The\s/.test(en) && text.nameSource !== 'kept';
    /** May this name or word count by itself, and how? null: not. */
    const alone = (w: string, whole: boolean): boolean | null => {
      if (letterCount(w) < min) return null;
      if (!oneWord(w)) return whole || !isStop(w, b) ? false : null;
      if (role && whole) return false;
      if (phraseOnly || isStop(w, b) || (!whole && common.has(wordKey(w, b)))) return null;
      const k = ordinaryKind(w, b);
      return k === 'never' ? null : k === 'capital';
    };
    const full = clean(text.name.replace(/,.*$/u, ''));
    if (full) {
      const a = alone(full, true);
      if (a !== null) add(full, a);
    }
    // The product name ("The Sonnet Man") counts whole; its words are English and count as English counts them.
    if (text.nameSource === 'kept') continue;
    const parts = full.split(SPLIT).map(clean).filter(Boolean);
    let single: string[] = [];
    if (parts.length > 1) {
      if (oneWord(en)) single = parts;
      else {
        const titled = EN_TITLES.has(en.split(/\s+/)[0].toLowerCase());
        const last = b === 'ko' && titled ? [...parts].reverse().find((w) => !common.has(wordKey(w, b))) : parts[parts.length - 1];
        if (last) single = [last];
      }
    }
    for (const w of single) {
      const a = alone(w, false);
      if (a !== null) add(w, a);
    }
    // An alias of a role (奶媽 beside 奶妈) is that role, whole; any other is held to the rules for a single word.
    for (const w of (text.aliases ?? []).map(clean)) {
      const a = alone(w, role);
      if (a !== null) add(w, a);
    }
  }
  const names = [...out].map(([name, capital]) => ({ name, capital }));
  nameCache.set(b, names);
  return names;
}

/** The names localNames gives, as written. */
export function localCharacterNames(lang: string): string[] {
  return localNames(lang).map((n) => n.name);
}

/** The names that count by themselves only written with a capital inside a sentence (ordinaryKind 'capital'). */
export function capitalOnlyNames(lang: string): string[] {
  return localNames(lang).filter((n) => n.capital).map((n) => n.name);
}

/**
 * Is one word of a name (as the name writes it) said by one word of the verse (as the verse writes it)? The word
 * itself, or in Russian, Polish, German and Arabic one of its listed forms (pack.forms).
 */
function saysNameWord(name: string, verseWord: string, lang: string): boolean {
  const b = baseLang(lang);
  if (b === 'ko') {
    const n = fold(name);
    const v = fold(verseWord);
    return v.startsWith(n) && particlesOnly(v.slice(n.length), n, listsFor(b));
  }
  const n = wordKey(name, b);
  const v = wordKey(verseWord, b);
  // Typed without accents the name still counts; with an accent the name (or its form) does not have, it is another word.
  const asWritten = (w: string) => b === 'vi' || !hasLatinMark(verseWord) || verseWord.normalize('NFC').toLowerCase() === w.normalize('NFC').toLowerCase();
  if (n === v) return asWritten(name);
  if (!NAMES_DECLINE.has(b)) return false;
  const form = listsFor(b).forms.get(n)?.find((f) => wordKey(f, b) === v);
  if (!form || !asWritten(form)) return false;
  // A declined name keeps its capital (Russian «марку», a stamp, is not «Марку», to Mark); Arabic has no capitals.
  return !/^\p{Lu}/u.test(name) || /^\p{Lu}/u.test(verseWord);
}

/** What may stand before a word that opens a sentence: its end, an opening quotation mark or bracket, a dash. */
const OPENS = /[.!?…¡¿:;«»"“”„‟‹›「」『』()[\]{}—–‐-]/u;

/** The words of a spaced text as it writes them (with their capitals), each with whether it opens a line or a sentence. */
function wordsWrittenAt(text: string, lang: string): { word: string; opens: boolean }[] {
  const b = baseLang(lang);
  const out: { word: string; opens: boolean }[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    const before = text.slice(0, m.index).replace(/[^\S\n]+$/u, '');
    out.push({ word: unElide(m[0], b), opens: !before || before.endsWith('\n') || OPENS.test(before.slice(-1)) });
  }
  return out;
}

/** Does the text write, around the name found at `at`, a word of `around` that holds it? */
function heldBy(text: string, at: number, target: string, around: string[]): boolean {
  if (at < 0) return false;
  for (const w of around) {
    for (let o = w.indexOf(target); o >= 0; o = w.indexOf(target, o + 1)) {
      if (at - o >= 0 && text.startsWith(w, at - o)) return true;
    }
  }
  return false;
}

/** Is a word of a Chinese verse written only in the characters foreign names are spelled with? */
function spelledLikeAName(word: string, l: Lists): boolean {
  return [...word].every((c) => l.xlit.has(c));
}

/**
 * Chinese: does a foreign name go on beside a name of the game, so that the name is only a piece of it? `side` is the
 * verse's segmenter words outward from the name, nearest first, as long as they touch. A foreign name is a run of the
 * characters Xinhua's tables spell names with (pack.transliteration); ICU's dictionary does not know most of them and
 * cuts them into single characters (哈德斯菲尔德 into 哈, 德, 斯, 菲, 尔, 德). It goes on when the nearest word is:
 * - one such character that is no word by itself (菲, 迪, 娅, 尼: `bound`), even one the stop list has (尔 in 阿尔宙斯);
 * - a longer word written only in such characters that is not a common word (海德, 罗斯, 尼亚; 当然, 东西 and 谢谢 are
 *   common words and end it, as any word with another character does);
 * - one such character that is a word by itself (特, 西; 多, 因, which the stop list has), when another piece of a
 *   foreign name lies beyond it: a bound character, a longer word as above, a character that is no function word, or a
 *   run of three such characters in all (塔克西多帕克, Tuxedo Park; 格罗斯波因特帕克, Grosse Pointe Park). A word alone (拉
 *   in 拉朱丽叶的手, "pulls Juliet's hand"; 比 in 比宙斯更强) is that word.
 */
function carriesOn(side: Span[], l: Lists): boolean {
  const [near, next] = side;
  if (!near) return false;
  const single = (x: Span) => [...x.word].length === 1;
  const longer = (x: Span) => !single(x) && spelledLikeAName(x.word, l) && !l.stop.has(x.word) && !l.native.has(x.word);
  if (single(near) && l.bound.has(near.word)) return true;
  if (!spelledLikeAName(near.word, l)) return false;
  if (!single(near)) return longer(near);
  if (!next) return false;
  if ((single(next) && l.bound.has(next.word)) || longer(next)) return true;
  if (!l.stop.has(near.word) && single(next) && l.xlit.has(next.word) && !l.stop.has(next.word)) return true;
  let run = 0;
  while (run < side.length && single(side[run]) && l.xlit.has(side[run].word)) run++;
  return run >= 3;
}

/**
 * Chinese: is the name at [s, e) of the text a name there? It must be whole segmenter words, except that a function
 * character the segmenter joined to it is not part of the name (修了 in 赫瑞修了); and no foreign name goes on beside it
 * (carriesOn).
 */
function zhNameAt(text: string, spans: Span[], s: number, e: number, l: Lists): boolean {
  const first = spans.find((x) => x.start <= s && s < x.end);
  const last = spans.find((x) => x.start < e && e <= x.end);
  if (!first || !last) return false;
  const joined = (t: string) => [...t].every((c) => l.stopChars.has(c) && !l.bound.has(c));
  if (first.start < s && !joined(text.slice(first.start, s))) return false;
  if (last.end > e && !joined(text.slice(e, last.end))) return false;
  const outward = (edge: number, dir: -1 | 1): Span[] => {
    const out: Span[] = [];
    for (let at = edge; ; ) {
      const n = spans.find((x) => (dir < 0 ? x.end === at : x.start === at));
      if (!n) return out;
      out.push(n);
      at = dir < 0 ? n.start : n.end;
    }
  };
  return !carriesOn(first.start === s ? outward(s, -1) : [], l) && !carriesOn(last.end === e ? outward(e, 1) : [], l);
}

/**
 * Thai: is this a word the invocation knows? The pronunciation table's words (Wiktionary's Thai, loaded with the duel's
 * sound data, ./sound) and the card text's own (its stop words and the lines' words). A word of one letter is not one
 * here: the table lists the letters themselves (น, ล), and a letter ends any piece.
 */
function thaiWord(w: string, l: Lists): boolean {
  return [...w].length >= 2 && (soundOf('th', w) !== undefined || l.thaiWords.has(w));
}

/**
 * Thai: does `t` end (or, with `fromStart`, begin) with known words, two in a row or as many as it holds? Before a name, a
 * word of two letters (ที, ลา, เค: a piece of a foreign name is often one) counts only after a longer known word, never at
 * the start of the letters: ทีซีอุส (Theseus) and เคลาซีอุส (Clausius) hold ซีอุส, Zeus. After a name it counts as any
 * word (ซุสมา, "Zeus comes").
 */
function thaiEdge(t: string, l: Lists, fromStart: boolean, depth = 2, min = 2): boolean {
  if (depth === 0 || (!t && min === 2)) return true;
  const cs = [...t];
  for (let n = Math.min(cs.length, 24); n >= min; n--) {
    const w = (fromStart ? cs.slice(0, n) : cs.slice(cs.length - n)).join('');
    const rest = (fromStart ? cs.slice(n) : cs.slice(0, cs.length - n)).join('');
    if (thaiWord(w, l) && thaiEdge(rest, l, fromStart, depth - 1, !fromStart && n === 2 ? 3 : 2)) return true;
  }
  return false;
}

/** Letters a Thai stretch of words runs on through: not ๆ (repeat the word) or ฯ (abbreviation), which end a word. */
const THAI_RUN = /(?![ๆฯ])[\p{L}\p{M}]/u;

/**
 * Thai: is the name at [s, e) of the text a name there? Thai is written without spaces between words, and ICU cuts a word
 * its dictionary lacks into pieces, so the segmenter's words do not settle it (เพอร์เซอุส, Perseus, came back as เพ, อร์, เซ,
 * อุ, ส, with เซอุส, Zeus, in it; คืนนี้ข้าเรียกซุสมา came back with ซุส cut as ซุ and สมา). The letters before the name, up
 * to a space or a mark, must end with known words (thaiWord, thaiEdge), two in a row where there are that many letters,
 * and the letters after it begin so: a piece of an unknown word beside the name (เพอร์, ซาน, พาราเซล) is not a word, so the name
 * there is a piece too. Without the pronunciation table only the card text's own words are known, and fewer names count.
 */
function thNameAt(text: string, s: number, e: number, l: Lists): boolean {
  let i = s;
  while (i > 0 && THAI_RUN.test(text[i - 1])) i--;
  let j = e;
  while (j < text.length && THAI_RUN.test(text[j])) j++;
  return thaiEdge(text.slice(i, s), l, false) && thaiEdge(text.slice(e, j), l, true);
}

/**
 * Unspaced: where the verse spells the name. Japanese: whole words of the verse, in a row, kana as written (a katakana
 * run is one word). Chinese and Thai: the name's letters anywhere, as zhNameAt and thNameAt allow. In Chinese and Thai,
 * also refused where the verse writes around the name a word of pack.containing that holds it. The verse's words that say
 * it, folded; or null.
 */
function saidNameUnspaced(name: string, verse: string, lang: string): string[] | null {
  const target = nameLetters(name);
  if (!target) return null;
  const text = thaiAm(fold(verse));
  const l = listsFor(lang);
  const around = l.containing.get(target) ?? [];
  if (lang === 'ja') {
    const spans = wordSpans(text, lang).map((x) => ({ ...x, key: nameLetters(x.word) })).filter((x) => x.key);
    for (let i = 0; i < spans.length; i++) {
      let run = '';
      for (let j = i; j < spans.length && run.length < target.length; j++) {
        run += spans[j].key;
        if (run === target && !heldBy(text, spans[i].start, target, around)) return spans.slice(i, j + 1).flatMap((x) => x.pieces.map(fold));
      }
    }
    return null;
  }
  // The text's letters, each with where it stands, so a name written with a space or a dot (马克·安东尼) is found either way.
  const at: number[] = [];
  let letters = '';
  for (let k = 0; k < text.length; k++) {
    if (!/[\p{L}\p{M}]/u.test(text[k])) continue;
    letters += text[k];
    at.push(k);
  }
  const spans = wordSpans(text, lang);
  for (let k = letters.indexOf(target); k >= 0; k = letters.indexOf(target, k + 1)) {
    const s = at[k];
    const e = at[k + target.length - 1] + 1;
    if (heldBy(text, s, target, around)) continue;
    if (lang === 'zh' ? !zhNameAt(text, spans, s, e, l) : !thNameAt(text, s, e, l)) continue;
    // The verse's words that say it, as the segmenter gives them (the words a multiplier does not multiply).
    return spans.filter((x) => x.start < e && x.end > s).map((x) => x.word);
  }
  return null;
}

/** The verse's words that say this name (one or more words, in a row), folded; or null. */
function saidName(name: string, verse: string, lang: string, capital = false): string[] | null {
  const b = baseLang(lang);
  if (UNSPACED.has(b)) return saidNameUnspaced(name, verse, b);
  // The name's words as it writes them (wordsOf lower-cases), so a declined form can be held to the name's capital.
  const n = name.match(WORD_RE) ?? [];
  const v = wordsWrittenAt(verse, b);
  for (let i = 0; i + n.length <= v.length; i++) {
    if (!n.every((w, j) => saysNameWord(w, v[i + j].word, b))) continue;
    // A name that is also an ordinary word counts only written as a name: with a capital, not opening a sentence.
    if (capital && (v[i].opens || !/^\p{Lu}/u.test(v[i].word))) continue;
    return v.slice(i, i + n.length).map((x) => fold(x.word));
  }
  return null;
}

/** The first localised name the verse says, with the verse's words that say it; or undefined. */
export function saidLocalName(verse: string, lang: string): { name: string; words: string[] } | undefined {
  if (baseLang(lang) === 'en') return undefined;
  for (const { name, capital } of localNames(lang)) {
    const words = saidName(name, verse, lang, capital);
    if (words) return { name, words };
  }
  return undefined;
}
