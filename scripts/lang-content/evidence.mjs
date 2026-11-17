// Is each line of names-evidence.tsv true? A line says "this language calls this character N, as read in
// this article": it holds only where the article is about the character's play (or the person, place or
// work), and where N there is the character, not somebody else with the same word in his name.
//
// On 2026-11-16 a checker found lines that broke both: Адриана from a film's cast (the actress Адриана
// Эстевес), Эдгар from the director Барри Эдгар, Кент recorded beside the director Дон Кент, लॉरेंस from
// Laurence Olivier, アーロン from the dramatist Aaron Hill (アーロン・ヒル), and Эскал taken from Measure for
// Measure for the Prince of Verona. The rules that find them:
//
//   own article   the article is the play's own (the play's Wikidata sitelink in that language) or, for a
//                 person, place or work, an article OWN lists for it
//   sound words   the words the line records around the name are a sound occurrence: the name is a word of
//                 its own there (not followed by ・ and more katakana, not one of a run of capitalised words
//                 such as Барри Эдгар or Laurence Olivier), and the words are not about films, casts, actors
//                 or directors
//   in the text   (with the article cache only) the recorded words are in the cached revision
//
// rowProblems() needs only the repository (play-areas.test.ts runs it over every line); the command line
// also reads the cache (WP_CACHE, default ~/.cache/im-wikipedia):
//   node scripts/lang-content/evidence.mjs audit        every line that breaks a rule; exit 1 if any
//   node scripts/lang-content/evidence.mjs retake       rewrite each line's recorded words to the first sound
//                                                       occurrence in its own cached revision (nothing else)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { HERE, entities, readTsv } from './lib.mjs';

/**
 * The play each character belongs to, as its Wikidata item says. Two characters share a name in the bank:
 * "Escalus" is the Prince of Verona (x.escalus) and a lord in Measure for Measure (x.escalus.measure), and
 * the bank's "Vincentio" is the Duke of Measure for Measure.
 */
export const PLAY = {
  'c.alonso': 'p.tempest', 'c.angelo': 'p.measure', 'c.antonio': 'p.merchant', 'c.ariel': 'p.tempest',
  'c.audrey': 'p.asyou', 'c.balthazar': 'p.merchant', 'c.bassanio': 'p.merchant', 'c.beatrice': 'p.muchado',
  'c.benedick': 'p.muchado', 'c.benvolio': 'p.romeo', 'c.bottom': 'p.dream', 'c.brabantio': 'p.othello',
  'c.caliban': 'p.tempest', 'c.cassio': 'p.othello', 'c.celia': 'p.asyou', 'c.claudio.ado': 'p.muchado',
  'c.claudius': 'p.hamlet', 'c.cordelia': 'p.lear', 'c.desdemona': 'p.othello', 'c.dogberry': 'p.muchado',
  'c.donjohn': 'p.muchado', 'c.donpedro': 'p.muchado', 'c.edmund': 'p.lear', 'c.emilia': 'p.othello',
  'c.ferdinand': 'p.tempest', 'c.feste': 'p.twelfth', 'c.fluellen': 'p.henry5', 'c.flute': 'p.dream',
  'c.fortinbras': 'p.hamlet', 'c.gertrude': 'p.hamlet', 'c.goneril': 'p.lear', 'c.gratiano': 'p.othello',
  'c.grumio': 'p.shrew', 'c.hamlet': 'p.hamlet', 'c.helena': 'p.dream', 'c.hero': 'p.muchado',
  'c.horatio': 'p.hamlet', 'c.isabella': 'p.measure', 'c.jaques': 'p.asyou', 'c.juliet': 'p.romeo',
  'c.ladymacbeth': 'p.macbeth', 'c.laertes': 'p.hamlet', 'c.launcelot': 'p.merchant', 'c.laurence': 'p.romeo',
  'c.lear': 'p.lear', 'c.lodovico': 'p.othello', 'c.lucentio': 'p.shrew', 'c.lysander': 'p.dream',
  'c.macbeth': 'p.macbeth', 'c.macduff': 'p.macbeth', 'c.malvolio': 'p.twelfth', 'c.marcellus': 'p.hamlet',
  'c.margaret': 'p.muchado', 'c.maria': 'p.twelfth', 'c.mercutio': 'p.romeo', 'c.miranda': 'p.tempest',
  'c.montano': 'p.othello', 'c.morocco': 'p.merchant', 'c.nurse': 'p.romeo', 'c.olivia': 'p.twelfth',
  'c.ophelia': 'p.hamlet', 'c.orlando': 'p.asyou', 'c.orsino': 'p.twelfth', 'c.othello': 'p.othello',
  'c.paris': 'p.romeo', 'c.perdita': 'p.winter', 'c.petruchio': 'p.shrew', 'c.polonius': 'p.hamlet',
  'c.portia': 'p.merchant', 'c.prospero': 'p.tempest', 'c.puck': 'p.dream', 'c.quince': 'p.dream',
  'c.regan': 'p.lear', 'c.roderigo': 'p.othello', 'c.romeo': 'p.romeo', 'c.rosalind': 'p.asyou',
  'c.rosaline': 'p.romeo', 'c.rosguil': 'p.hamlet', 'c.sebastian': 'p.twelfth', 'c.shylock': 'p.merchant',
  'c.silvia': 'p.twogents', 'c.sly': 'p.shrew', 'c.snug': 'p.dream', 'c.stephano': 'p.tempest',
  'c.sycorax': 'p.tempest', 'c.titania': 'p.dream', 'c.toby': 'p.twelfth', 'c.touchstone': 'p.asyou',
  'c.tranio': 'p.shrew', 'c.tybalt': 'p.romeo', 'c.viola': 'p.twelfth', 'c.iago': 'p.othello',
  'x.aaron': 'p.titus', 'x.adriana': 'p.errors', 'x.autolycus': 'p.winter', 'x.bianca': 'p.shrew',
  'x.borachio': 'p.muchado', 'x.capulet': 'p.romeo', 'x.cesario': 'p.twelfth', 'x.claribel': 'p.tempest',
  'x.cornwall': 'p.lear', 'x.dukesenior': 'p.asyou', 'x.edgar': 'p.lear', 'x.escalus': 'p.romeo',
  'x.escalus.measure': 'p.measure', 'x.friarfrancis': 'p.muchado', 'x.friarjohn': 'p.romeo',
  'x.gloucester': 'p.lear', 'x.katherina': 'p.shrew', 'x.kent': 'p.lear', 'x.lucio': 'p.measure',
  'x.montague': 'p.romeo', 'x.oswald': 'p.lear', 'x.phebe': 'p.asyou', 'x.ursula': 'p.muchado',
  'x.vincentio': 'p.measure',
};
/** A person, place or work: the articles that may name it (besides its own). */
const OWN = {
  'h.antony': ['p.caesar', 'p.antony'], 'h.brutus': ['p.caesar'], 'h.calpurnia': ['p.caesar'],
  'h.octavius': ['p.caesar', 'p.antony'], 'h.porcia': ['p.caesar'], 'h.henry5': ['p.henry5'],
  'h.cassius': ['p.caesar'], 'h.cicero': ['p.caesar'], 'h.casca': ['p.caesar'], 'h.caesar': ['p.caesar'],
  'h.blount': ['w.folio'], 'h.jaggard': ['w.folio', 'w.sonnets'], 'l.arden': ['p.asyou'],
  'l.dunsinane': ['p.macbeth'], 'l.elsinore': ['p.hamlet'], 'l.rose': ['h.shakespeare'], 'l.globe': ['h.shakespeare'],
  // Ovid's Pyramus and Thisbe and Marlowe's Hero and Leander, named as sources of Romeo and Juliet and in the plays that use them.
  'w.pyramus': ['p.romeo', 'p.dream'], 'w.hero': ['p.romeo', 'p.asyou'],
};
/** A play's or a work's title may also be read in the list of works of the language's article on Shakespeare. */
const ALSO_SHAKESPEARE = /^[pw]\./;

/**
 * Lines that break a rule above and were read and found right, each with the reason. Nothing else passes.
 */
export const ACCEPTED = new Map([
  ['c.launcelot/ru/Ланчелот', 'the cast list of the play\'s own article: "Ланчелот Гоббо, шут, слуга Шейлока"; Гоббо is his own surname'],
  ['x.claribel/ru/Кларибель', '"со свадьбы дочери Алонзо Кларибель": Alonso\'s daughter; Алонзо is a genitive before her name, not her surname'],
  ['c.puck/ko/퍽', 'the cast list of the play\'s own article; the word 배우 (actor) near it describes Bottom, an amateur actor in the play'],
  ['x.dukesenior/hi/निर्वासित ड्यूक', 'the play\'s own article calls him "the exiled duke" (अन्यायी ड्यूक और निर्वासित ड्यूक), set against the usurper; a description the article uses for him, not a name'],
  ['c.portia/it/Porzia', 'the Italian article on Shakespeare: "l\'intelligente Porzia (Il mercante di Venezia)", naming the play'],
  ['h.octavius/ja/オクテイヴィアス', 'the article on Antony and Cleopatra: "オクテイヴィアス・シーザー" is Octavius Caesar himself, linked to the article on Augustus'],
]);
/** A line read in a published translation on Wikisource (its cast list), not in a Wikipedia article. */
const WIKISOURCE = /^https:\/\/[a-z]+\.wikisource\.org\//;

/** Words that put a name among films, casts and their makers (wikitext of 16 Wikipedias). */
const FILMISH = new RegExp([
  'В ролях', 'режисс[её]р', 'актёр', 'актер', 'актрис', 'фильм', 'экраниз', 'телеспектакл', 'постановщик',
  'director', 'actor', 'actress', '\\bfilm', 'movie', 'regia', 'regista', 'réalis', 'Regie', 'reżyser', 'aktor', 'elenco', 'diretor', 'filme', 'película',
  '映画', '監督', '俳優', '电影', '導演', '导演', '演员', '演員', '主演', '영화', '감독', '배우',
  'फ़िल्म', 'फिल्म', 'अभिनेता', 'अभिनेत्री', 'निर्देशक', 'ภาพยนตร์', 'ผู้กำกับ', 'นักแสดง', 'فيلم', 'ممثل', 'مخرج', 'إخراج',
].join('|'), 'iu');

const CAP = '[A-ZÀ-ÖØ-ÞĀ-ŽА-ЯЁ]';
const TITLES = /^(?:Принц|Князь|Король|Королева|Герцог|Граф|Лорд|Леди|Сэр|Брат|Отец|Монах|Фрей|Frei|Frère|Fray|Frate|Fra|Bruder|Brat|Ojciec|Prince|Príncipe|Principe|Prinz|Książę|Duque|Duca|Herzog|Conde|Comte|Conte|Graf|Lord|Lady|Sir|Król|Re|Rei|Rey|Roi|König|Don|Dom|Dona|Doña|Donna)$/u;
const SPACED = new Set(['ru', 'pl', 'pt', 'es', 'it', 'fr', 'de', 'id', 'vi']);

/** The name as a word of its language in a text (wikipedia.py's own pattern). */
export function wordRx(name, lang) {
  const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (lang === 'ja') return new RegExp(`(?<![ァ-ヺー・])${n}(?![ァ-ヺー])`, 'gu');
  if (lang === 'ko') return new RegExp(`(?<![가-힣])${n}`, 'gu');
  if (lang === 'ar') return new RegExp(`${n}(?![\\u0621-\\u064A])`, 'gu');
  if (lang === 'zh' || lang === 'th') return new RegExp(n, 'gu');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${n}(?![\\p{L}\\p{N}_])`, 'gu');
}

/** Why the name at `at` in `text` is not the character: [] when it is a sound occurrence. */
export function occurrenceProblems(text, at, name, lang) {
  const out = [];
  const after = text.slice(at + name.length, at + name.length + 40), before = text.slice(Math.max(0, at - 40), at);
  if (lang === 'ja' && (/^・[ァ-ヺー]/u.test(after) || /[ァ-ヺー]・$/u.test(before))) out.push('part of a longer name');
  if (SPACED.has(lang)) {
    const next = after.match(new RegExp(`^ (${CAP}[\\p{L}]+)`, 'u'));
    const prev = before.match(new RegExp(`(?:^|[^.!?:;\\n*|='\\]])\\s(${CAP}[\\p{L}]+) $`, 'u'));
    if (next && !TITLES.test(next[1]) && !new RegExp(`^ ${CAP}[\\p{L}]+\\s*[(\\[—–-]`, 'u').test(after)) out.push('part of a longer name');
    else if (prev && !TITLES.test(prev[1])) out.push('part of a longer name');
  }
  if (lang === 'hi' && /^ (?:ऑलिवर|ओलिवियर|हिल|ब्रानाघ|ब्रैनाघ)/u.test(after)) out.push('part of a longer name');
  if (FILMISH.test(text.slice(Math.max(0, at - 90), at + name.length + 90))) out.push('among films, casts or their makers');
  return out;
}

const titleOf = (url) => decodeURIComponent(url.match(/title=([^&]+)/)?.[1] ?? '').replace(/_/g, ' ');

/** The articles in a language that may be the source of a name for this entity. */
export function ownTitles(key, lang) {
  const keys = PLAY[key] ? [PLAY[key]] : [...(OWN[key] ?? []), key, ...(ALSO_SHAKESPEARE.test(key) ? ['h.shakespeare'] : [])];
  return new Set(keys.map((k) => entities[k]?.sitelinks?.[lang]).filter(Boolean));
}

/** A line's problems, from the repository alone. */
export function rowProblems([key, lang, name, url, , , words = ''], accepted = ACCEPTED) {
  const out = [];
  if (accepted.has(`${key}/${lang}/${name}`)) return out;
  if (!PLAY[key] && !OWN[key] && !entities[key]) out.push(`no play, person, place or work is known for ${key}`);
  const own = ownTitles(key, lang);
  // A person named in full (William Jaggard, Edward Blount) is that person in any article; one word is not enough.
  const fullName = key.startsWith('h.') && name.trim().split(/[\s・·]+/u).length >= 2;
  if (!own.has(titleOf(url)) && !fullName && !WIKISOURCE.test(url)) out.push(`the article "${titleOf(url)}" is not ${key}'s own (${[...own].join(' / ') || `none in ${lang}`})`);
  const hits = [...words.matchAll(wordRx(name, lang))];
  if (!hits.length) out.push('the words recorded do not hold the name');
  else if (hits.every((m) => occurrenceProblems(words, m.index, name, lang).length)) out.push(`the words recorded are not the character: ${[...new Set(hits.flatMap((m) => occurrenceProblems(words, m.index, name, lang)))].join(', ')}`);
  return out;
}

const CACHE = process.env.WP_CACHE || join(homedir(), '.cache/im-wikipedia');
function cached(lang, title) {
  const dir = join(CACHE, lang);
  const file = join(dir, title.replace(/[^\p{L}\p{N}_.-]+/gu, '_') + '.json');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (r.title === title) return r;
  }
  return null;
}
const squash = (s) => s.replace(/\s+/g, ' ').trim();
/** The sound occurrences of the name in a cached article, as 60 characters either side (wikipedia.py's width). */
export function soundOccurrences(text, name, lang) {
  return [...text.matchAll(wordRx(name, lang))].filter((m) => !occurrenceProblems(text, m.index, name, lang).length)
    .map((m) => squash(text.slice(Math.max(0, m.index - 60), m.index + name.length + 60)));
}

const FILE = join(HERE, 'names-evidence.tsv');
if (process.argv[1]?.endsWith('evidence.mjs')) {
  const cmd = process.argv[2];
  const lines = readFileSync(FILE, 'utf8').split('\n');
  let failed = 0, rewritten = 0;
  const out = lines.map((line) => {
    if (!line.trim() || line.startsWith('#')) return line;
    const row = line.split('\t');
    const [key, lang, name, url] = row;
    const problems = rowProblems(row);
    const accepted = ACCEPTED.has(`${key}/${lang}/${name}`);
    const r = WIKISOURCE.test(url) ? null : cached(lang, titleOf(url));
    const inTitle = row[5] === "the article's title" && r?.title.includes(name);
    const sound = r ? (accepted ? [squash(row[6] ?? '')] : inTitle ? [r.title] : soundOccurrences(r.text, name, lang)) : [];
    if (WIKISOURCE.test(url)) { /* a Wikisource page: not in the article cache (wikisource.py keeps its own) */ }
    else if (!r) problems.push('the article is not in the cache');
    else if (!sound.length) problems.push('no occurrence in the article is the character');
    else if (row[6] && squash(row[6]) !== r.title && !r.text.replace(/\s+/g, ' ').includes(squash(row[6]).slice(5, -5))) problems.push('the words recorded are not in the cached revision');
    if (cmd === 'retake' && sound.length && ownTitles(key, lang).has(titleOf(url)) && row[5] !== "the article's title") {
      const glossed = sound.find((s) => /\(\s*(?:\{\{lang-en\|)?[A-Z]/u.test(s.slice(s.indexOf(name) + name.length, s.indexOf(name) + name.length + 25)));
      const words = glossed ?? sound[0];
      if (words !== squash(row[6] ?? '')) { row[6] = words; rewritten++; }
      return row.join('\t');
    }
    if (problems.length) { failed++; console.log(`FAIL ${key}\t${lang}\t${name}\t${problems.join('; ')}`); }
    return line;
  });
  if (cmd === 'retake') { writeFileSync(FILE, out.join('\n')); console.log(`${rewritten} lines' recorded words rewritten`); }
  else { console.error(`${failed} of ${lines.filter((l) => l.trim() && !l.startsWith('#')).length} lines break a rule`); process.exit(failed ? 1 : 0); }
}
