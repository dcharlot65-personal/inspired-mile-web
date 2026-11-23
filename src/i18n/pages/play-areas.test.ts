import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, loadMessages, type Locale, type Messages } from '../index';
import { TRIVIA_BANK } from '../../lib/trivia';
import { CHALLENGE_BANK } from '../../lib/challenges';
import { ACTS } from '../../lib/story-mode';
import { CITY_CATALOG } from '../../lib/variants';
import { ECONOMY } from '../../lib/economy-rules';
import { MIN_LOCAL_CHALLENGES, answersMatch, challengesFrom, localChallenges, localRandomQuestions, localTriviaBank, ownChallenges, triviaBankFrom } from '../../lib/play-content';

/**
 * The play content in sixteen languages: the playground and story areas, the
 * trivia bank and the quote challenges.
 *
 * Each rule is a function that returns the problems it finds, so that the rule
 * itself can be tested: the last block feeds every one of them a known-bad copy
 * and expects it to object. A checker that cannot fail proves nothing.
 */

const FILES = import.meta.glob<{ default: Messages }>('./{playground,story,trivia,challenges}/*.ts');
async function area(name: string, l: string): Promise<Messages | undefined> {
  const load = FILES[`./${name}/${l}.ts`];
  return load ? (await load()).default : undefined;
}

/** A string without its bidirectional isolates (scripts/lang-content/bidi.mjs): what the reader sees, for comparing. */
const unbidi = (s: string) => s.replace(/[\u2066-\u2069]/gu, '');
const unbidiAll = (m: Messages): Messages => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, unbidi(v)]));

const placeholders = (s: string) => [...s.matchAll(/\{([a-zA-Z_]+)\}/g)].map((m) => m[1]).sort().join(',');

/** Same keys as English, nothing empty, the same {placeholders}, no stray brace. */
export function areaProblems(l: string, m: Messages | undefined, en: Messages): string[] {
  if (!m) return [`${l}: no file`];
  const out: string[] = [];
  for (const k of Object.keys(en)) if (!(k in m)) out.push(`${l}: missing ${k}`);
  for (const [k, v] of Object.entries(m)) {
    if (!(k in en)) out.push(`${l}: extra ${k}`);
    else if (typeof v !== 'string' || v.trim() === '') out.push(`${l}: empty ${k}`);
    else {
      if (placeholders(v) !== placeholders(en[k])) out.push(`${l}: ${k} has {${placeholders(v)}}, English has {${placeholders(en[k])}}`);
      if (/[{}]/.test(v.replace(/\{[a-zA-Z_]+\}/g, ''))) out.push(`${l}: stray brace in ${k}`);
    }
  }
  return out;
}

/** Shakespeare's words in an English string: what stands between straight double quotes, three words or more. */
const quotations = (s: string) => [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1].replace(/[?!.,]+$/, '')).filter((q) => q.split(' ').length >= 3);
// In quotes in the English, but a nickname or a critic's term, not Shakespeare's words: these are translated.
const NOT_A_QUOTATION = new Set(['The Scottish Play', 'Seven Ages of Man']);

const roman = (n: number) => [['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90], ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]].reduce((acc, [r, v]) => { while (n >= (v as number)) { acc += r; n -= v as number; } return acc; }, '');

/** A language's trivia: every question and option present, options distinct, quotations and numbers intact. */
export function triviaProblems(l: string, raw: Messages | undefined): string[] {
  if (!raw) return [`${l}: no trivia file`];
  const m = unbidiAll(raw);
  const out: string[] = [];
  const expected = TRIVIA_BANK.reduce((n, q) => n + 1 + q.options.length, 0);
  if (Object.keys(m).length !== expected) out.push(`${l}: ${Object.keys(m).length} trivia keys, English has ${expected}`);
  TRIVIA_BANK.forEach((en, n) => {
    const q = m[`trivia.${n}.q`];
    if (!q?.trim()) return void out.push(`${l}: question ${n} missing`);
    const options = en.options.map((_, i) => m[`trivia.${n}.o${i}`]);
    if (options.some((o) => !o?.trim())) return void out.push(`${l}: question ${n} lacks an option (English has ${en.options.length})`);
    if (`trivia.${n}.o${en.options.length}` in m) out.push(`${l}: question ${n} has more options than English`);
    if (new Set(options.map((o) => o.toLocaleLowerCase(l))).size !== options.length) out.push(`${l}: question ${n} has two options that read the same: ${options.join(' | ')}`);
    for (const quote of quotations(en.question)) if (!NOT_A_QUOTATION.has(quote) && !q.includes(quote)) out.push(`${l}: question ${n} changed or lost the quotation "${quote}"`);
    for (const num of en.question.match(/\d+/g) ?? []) if (!q.includes(num)) out.push(`${l}: question ${n} lost the number ${num}`);
    en.options.forEach((o, i) => {
      // An option that is a number, a year, a rhyme scheme or a quoted line is the same in every language.
      if (/^[\dA-Z ]+$/.test(o) && options[i] !== o) out.push(`${l}: question ${n} option ${i} should be "${o}", is "${options[i]}"`);
      // A number of two digits or more is kept, in digits or as a Roman numeral ("siglo XVI"); a lone
      // digit may become a word or an ordinal ("première partie").
      for (const num of o.match(/\d{2,}/g) ?? []) if (!options[i].includes(num) && !options[i].includes(roman(Number(num)))) out.push(`${l}: question ${n} option ${i} lost the number ${num}`);
      for (const quote of quotations(o)) if (!options[i].includes(quote)) out.push(`${l}: question ${n} option ${i} changed the quotation "${quote}"`);
    });
  });
  return out;
}

type NameOf = (key: string, lang: string, which?: number) => { name: string };
type OptionKeys = Record<string, ({ key: string; which: number } | null)[]>;

/** The names table of scripts/lang-content (Wikidata labels and sourced picks), as build.mjs reads it. */
async function namesTable(): Promise<{ optionKeys: OptionKeys; nameOf: NameOf; ucfirst: (s: string) => string }> {
  // @ts-ignore -- a build script in plain JavaScript, without type declarations
  const lib = await import('../../../scripts/lang-content/lib.mjs');
  const optionKeys = JSON.parse(readFileSync(join(process.cwd(), 'scripts/lang-content/trivia-options.json'), 'utf8')) as OptionKeys;
  return { optionKeys, nameOf: lib.nameOf, ucfirst: lib.ucfirst };
}

/** scripts/lang-content/bidi.mjs: English isolated inside right-to-left text. */
async function bidi(): Promise<{ RTL: Set<string>; bidiProblems: (key: string, s: string) => string[]; isolateLatin: (s: string) => string; stripIsolates: (s: string) => string }> {
  // @ts-ignore -- a build script in plain JavaScript, without type declarations
  return import('../../../scripts/lang-content/bidi.mjs');
}

type RowProblems = (row: string[]) => string[];
/** The rules of scripts/lang-content/evidence.mjs: is each line of names-evidence.tsv read where it says? */
async function evidence(): Promise<{ rowProblems: RowProblems }> {
  // @ts-ignore -- a build script in plain JavaScript, without type declarations
  return import('../../../scripts/lang-content/evidence.mjs');
}
const evidenceLines = () => readFileSync(join(process.cwd(), 'scripts/lang-content/names-evidence.tsv'), 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.split('\t'));

/** trivia-option-forms.tsv: a name option written otherwise than the names table, reviewed, with the reason. */
function optionForms(): Set<string> {
  const rows = readFileSync(join(process.cwd(), 'scripts/lang-content/trivia-option-forms.tsv'), 'utf8').split('\n').filter((r) => r.trim() && !r.startsWith('#'));
  return new Set(rows.map((r) => r.split('\t').slice(0, 4).join('\t')));
}
const readTsvFile = (f: string) => readFileSync(join(process.cwd(), f), 'utf8').split('\n').filter((r) => r.trim() && !r.startsWith('#')).map((r) => r.split('\t'));
/** The places three King Lear characters are named after: their Wikidata labels (fetch-places.py). */
const PLACE_OF: Record<string, string> = { 'x.kent': 'l.kent', 'x.gloucester': 'l.gloucester', 'x.cornwall': 'l.cornwall' };
type SourcesFor = (key: string, l: string) => string[];
/** Every form a source gives an entity in a language: the names table, Wikidata labels and aliases, names-evidence.tsv, the place it is named after. */
async function sourcesTable(): Promise<SourcesFor> {
  // @ts-ignore -- a build script in plain JavaScript, without type declarations
  const lib = await import('../../../scripts/lang-content/lib.mjs');
  const evidence = evidenceLines();
  const places = JSON.parse(readFileSync(join(process.cwd(), 'scripts/lang-content/wikidata-places.json'), 'utf8')).entities;
  return (key, l) => {
    const out = evidence.filter((r) => r[0] === key && r[1] === l).map((r) => r[2]);
    if (lib.entities[key]) out.push(lib.nameOf(key, l).name, ...lib.sourcesOf(key, l).map((x: { value: string }) => x.value));
    const place = places[PLACE_OF[key]];
    for (const c of place ? (l === 'zh' ? ['zh-hans', 'zh-cn', 'zh'] : l === 'pt' ? ['pt-br', 'pt'] : [l]) : []) out.push(...(place.labels[c] ? [place.labels[c]] : []), ...(place.aliases[c] ?? []));
    return out;
  };
}

/**
 * A name option written by hand in a language's trivia (trivia-option-handnames.tsv): each name in it is a
 * form a source gives for that character in that language, or the English name. A stem is enough in Polish
 * and Russian (Montekich, of Monteki); any other form must be listed in trivia-option-forms.tsv with its reason.
 */
export function handNameProblems(l: string, m: Messages, rows: string[][], sourcesFor: SourcesFor, forms = optionForms()): string[] {
  const out: string[] = [];
  const stem = (w: string) => (['ru', 'pl'].includes(l) && w.length > 4 ? w.slice(0, Math.ceil(w.length * 0.7)) : w);
  for (const [n, i, keys, names] of rows) {
    const have = unbidi(m[`trivia.${n}.o${i}`] ?? '');
    if (forms.has([l, n, i, have].join('\t'))) continue;
    const low = have.toLocaleLowerCase(l);
    const english = names.split('|');
    keys.split(',').forEach((key, j) => {
      const sources = [english[j], ...sourcesFor(key, l)].filter(Boolean);
      if (!sources.some((f) => low.includes(stem(f.toLocaleLowerCase(l))))) out.push(`${l}: question ${n} option ${i} is "${have}", and no source gives ${key} so (${[...new Set(sources)].join(' / ')})`);
    });
  }
  return out;
}

const TITLE_WORDS = /^(?:King|Queen|Prince|Princess|Duke|Lord|Lady|Sir|Captain|Friar|Sonnet|Sonnets|The|Saint|Earl)$/;

/**
 * Where an English option is the name of a play, a character, a person or a place, the option at the
 * same place in the language must be that item's name in the language. Options keep their places, and
 * the bank's correctIndex is shared, so this is what makes the index point at the right answer.
 * Allowed besides the name itself: the name shortened ("Raja Henry V" stands for the label "Henry V
 * dari Inggris" only by containing it the other way round, so it must be listed), the name with a title or
 * a common noun translated around it ("El rey Lear", "Soneto 116"), and a form listed with its reason.
 */
export function nameOptionProblems(l: string, m: Messages, optionKeys: OptionKeys, nameOf: NameOf, ucfirst: (s: string) => string, forms = optionForms()): string[] {
  const out: string[] = [];
  const low = (s: string) => s.toLocaleLowerCase(l);
  TRIVIA_BANK.forEach((en, n) => en.options.forEach((o, i) => {
    const ent = optionKeys[n]?.[i];
    if (!ent) return;
    const want = ucfirst(nameOf(ent.key, l, ent.which).name);
    const have = unbidi(m[`trivia.${n}.o${i}`] ?? '');
    const core = want.split(/\s+/).filter((w) => !TITLE_WORDS.test(w)).join(' ');
    // An English name in brackets beside a translation is a gloss: it does not make the translation a source's.
    const shown = have.replace(/\s*[(（][^)）]*[)）]\s*$/u, '');
    if (have === want || (shown && low(want).includes(low(shown))) || (core && low(shown).includes(low(core))) || forms.has([l, n, i, have].join('\t'))) return;
    out.push(`${l}: question ${n} option ${i} ("${o}"${i === en.correctIndex ? ', the correct answer' : ''}) is "${have}", the names table says "${want}"`);
  }));
  return out;
}

const NOT_LATIN = ['ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'th'];
/** The script of an option's names: a gloss in brackets and the word joining two names (और, و, と, 와, และ, 和) left out. */
const inLatin = (s: string) => /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Zs}]+$/u.test((s.replace(/\s*[(（][^)）]*[)）]/gu, '') || s).replace(/\s+(?:और|و|และ)\s+|(?<=\p{Script=Latin})(?:와|과|と|和)(?=\s|\p{Script=Latin})/gu, ' '));

/**
 * A name with no source in a script stays in Latin letters; a famous one has a label. If the right
 * answer is the only option in Cyrillic, Thai or Hangul (or the only one in Latin letters), the script
 * answers the question. Such a question is written in one script throughout.
 */
export function scriptTells(l: string, m: Messages): string[] {
  const out: string[] = [];
  TRIVIA_BANK.forEach((q, n) => {
    const latin = q.options.map((_, i) => inLatin(unbidi(m[`trivia.${n}.o${i}`] ?? '')));
    if (latin.filter((x) => x === latin[q.correctIndex]).length === 1) out.push(`${l}: question ${n}: the right answer is the only option ${latin[q.correctIndex] ? 'in Latin letters' : 'in its script'}`);
  });
  return out;
}

/** A language's challenges: each line holds its missing words, in order, and shows one blank for each. */
export function challengeProblems(l: string, m: Messages | undefined): string[] {
  if (!m) return [`${l}: no challenges file`];
  const out: string[] = [];
  const ids = (m['challenges.ids'] ?? '').split(',').filter(Boolean);
  for (const id of ids) {
    const n = Number(id);
    if (!CHALLENGE_BANK[n]) { out.push(`${l}: challenge ${id} is not in the bank`); continue; }
    const full = m[`challenge.${id}.full`], display = m[`challenge.${id}.display`], missing = (m[`challenge.${id}.missing`] ?? '').split('|').filter(Boolean);
    if (!full || !display || missing.length === 0) { out.push(`${l}: challenge ${id} is incomplete`); continue; }
    let rest = full.toLocaleLowerCase(l);
    for (const w of missing) {
      const at = rest.indexOf(w.toLocaleLowerCase(l));
      if (at < 0) { out.push(`${l}: challenge ${id}: "${w}" is not in the line (after the blank before it): ${full}`); break; }
      rest = rest.slice(at + w.length);
    }
    const blanks = display.split('___').length - 1;
    if (blanks !== missing.length) out.push(`${l}: challenge ${id} shows ${blanks} blanks for ${missing.length} missing words`);
    // Filling the blanks must give the line back.
    let i = 0;
    const refilled = display.replace(/___/g, () => missing[i++] ?? '');
    if (refilled.toLocaleLowerCase(l) !== full.toLocaleLowerCase(l)) out.push(`${l}: challenge ${id}: the blanks do not fill back to the line`);
    if (l !== 'en' && !m[`challenge.${id}.translator`]) out.push(`${l}: challenge ${id} names no translator`);
  }
  const perChallenge = l === 'en' ? 5 : 6; // full, display, missing, play, character; and the translator in a translation
  const stray = Object.keys(m).filter((k) => k.startsWith('challenge.') && !ids.includes(k.split('.')[1]));
  if (stray.length) out.push(`${l}: keys for challenges not listed in challenges.ids: ${stray.slice(0, 3).join(', ')}`);
  // The headings of the English originals, in a language that plays them: a play and a speaker for each, never one alone.
  const originals = Object.keys(m).filter((k) => k.startsWith('original.'));
  if (originals.length && ids.length >= MIN_LOCAL_CHALLENGES) out.push(`${l}: headings for the English originals, but the language plays its own lines`);
  for (const k of originals) {
    const [, id, what] = k.split('.');
    const other = what === 'play' ? 'character' : what === 'character' ? 'play' : null;
    if (!CHALLENGE_BANK[Number(id)] || !other || !m[`original.${id}.${other}`]?.trim() || !m[k].trim()) out.push(`${l}: ${k} is not half of a play and speaker for a challenge of the bank`);
  }
  if (Object.keys(m).length !== 1 + ids.length * perChallenge + originals.length) out.push(`${l}: ${Object.keys(m).length} keys for ${ids.length} challenges`);
  return out;
}

/**
 * How each core locale file says it addresses the player (the comment on its first line:
 * "Anrede: du", "Обращение на «ты»", "Sapaan: kamu", "말투: 해요체", …), as the forms that
 * would break it. Looked for in what the game says to the player, not in what a character
 * says in quotation marks: the Nurse may call a stranger "tu" while the page says "vous".
 */
const L = '(?<![\\p{L}\\p{M}])', R = '(?![\\p{L}\\p{M}])';
const word = (...w: string[]) => new RegExp(`${L}(?:${w.join('|')})${R}`, 'iu');
const ADDRESS: Record<string, { rule: string; wrong: RegExp[] }> = {
  de: { rule: 'du', wrong: [/(?<![.!?:]\s|^)\b(?:Sie|Ihnen|Ihr|Ihre[mnrs]?)\b/u] },
  fr: { rule: 'vous', wrong: [word('tu', 'toi', 'ta', 'tes', 'te'), /(?<![\p{L}])t'/iu] },
  es: { rule: 'tú', wrong: [word('usted', 'ustedes', 'vosotros', 'vuestr[oa]s?')] },
  it: { rule: 'tu', wrong: [word('voi', 'vostr[oaie]'), /(?<![.!?:]\s|^)\bLei\b/u] },
  pt: { rule: 'você', wrong: [word('tu', 'teu', 'tua', 'teus', 'tuas', 'contigo', 'vós')] },
  pl: { rule: 'ty', wrong: [word('pan', 'pani', 'pana', 'panu', 'panią', 'państwo', 'państwa', 'wy', 'was', 'wam')] },
  ru: { rule: 'ты', wrong: [word('вы', 'вас', 'вам', 'вами', 'ваш', 'ваша', 'ваше', 'ваши', 'вашего', 'вашей', 'вашему', 'вашу', 'вашим', 'ваших'), /[а-яё]{3,}(?:[аяеоую]йте|ите)(?![\p{L}])/iu] },
  id: { rule: 'kamu', wrong: [word('anda')] },
  ko: { rule: '해요체', wrong: [/(?:습니다|입니다|ㅂ니다|십시오)/u] },
  ja: { rule: 'です・ます', wrong: [/(?:だ|である)[。！!]/u] },
  zh: { rule: '你', wrong: [/您/u] },
  hi: { rule: 'आप', wrong: [word('तुम', 'तू', 'तुम्हें', 'तुम्हारा', 'तुम्हारी', 'तुम्हारे', 'तेरा', 'तेरी', 'तेरे', 'तुझे')] },
  vi: { rule: 'bạn', wrong: [word('quý vị', 'quý khách')] },
  ar: { rule: 'المخاطب المفرد', wrong: [/(?:أنتم|لكم|عليكم|إليكم|بكم)(?![\p{L}\p{M}])/u] },
};
/** What the game itself says: quoted speech and quoted lines taken out. */
const narration = (s: string) => s.replace(/«[^»]*»|"[^"]*"|“[^”]*”|„[^“”]*[“”]|「[^」]*」|『[^』]*』|»[^«]*«/gu, ' ');

/** Forms of address that break the core locale's rule, in a language's area. */
export function addressProblems(l: string, m: Messages): string[] {
  const a = ADDRESS[l];
  if (!a) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(m)) {
    const said = narration(v);
    for (const re of a.wrong) {
      const hit = said.match(re);
      if (hit) out.push(`${l}: ${k} says "${hit[0]}", but the game addresses the player with ${a.rule}`);
    }
  }
  return out;
}

/**
 * The game's Portuguese is Brazilian (the core locale says tela, você, registrada). These are
 * European spellings and words that Brazil writes otherwise: Marco António / Antônio, Polónio /
 * Polônio, Boémia / Boêmia, Octávia / Otávia, Egipto / Egito, ecrã / tela, equipa / equipe.
 * Wikidata's `pt` label is European, which is how they got in before (scripts/lang-content/lib.mjs).
 */
const EUROPEAN_PT = /(?<!\p{L})(?:\p{L}*(?:ónio|ónia|ómeo|émia|ómic|ómen|ónic)\p{L}*|Oct[aá]vi\p{L}*|Egipto|ecrã|telemóvel|equipa|registo|utilizador|ficheiro)(?!\p{L})/u;
export function europeanPortuguese(m: Messages): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(m)) {
    const hit = v.match(EUROPEAN_PT);
    if (hit) out.push(`pt: ${k} writes "${hit[0]}", a European form; the game's Portuguese is Brazilian`);
  }
  return out;
}

/**
 * No gender assumed for the player. In Polish and Russian the past tense says whether "you" are a
 * man or a woman (zagrałeś / zagrałaś, ты сыграл / сыграла); the play text says it another way.
 * Read over the whole string, quoted speech included: a character speaking to the player is
 * speaking to someone of either sex.
 */
/**
 * Besides the past tense: the words a character calls the player by. The English says "Young one",
 * "stranger" and "mortal"; where the language's word for these is male or female (forastero,
 * étranger, mortel, straniero, Fremder, Sterblicher, przybyszu, śmiertelniku, чужестранец, смертный),
 * the play text uses one of common gender (visitante, enfant des hommes, viandante, Fremdling,
 * Menschenkind, ludzkie dziecię, дитя человеческое) or none. Hindi marks the gender of तुम on the verb
 * (ढूँढ रहे हो / रही हो, गा सकते हो / सकती हो, चले आए / आईं). These lists are the forms found by reading
 * every line that speaks to the player on 2026-11-16, not a grammar of the language.
 */
const vocative = (...w: string[]) => new RegExp(`(?<![\\p{L}\\p{M}])(?:${w.join('|')})(?![\\p{L}\\p{M}])`, 'iu');
const GENDERED_YOU: Record<string, RegExp[]> = {
  pl: [/(?<!\p{L})\p{L}+(?:łeś|łaś)(?!\p{L})/u, vocative('przybyszu', 'przybyszko', 'śmiertelniku', 'śmiertelniczko', 'nieznajomy', 'nieznajoma')],
  ru: [/(?<!\p{L})[Тт]ы(?!\p{L})(?:\s+\p{L}+){0,3}?\s+\p{L}+(?:ал|ял|ил|ел|ла)(?!\p{L})/u, vocative('чужестранец', 'чужестранка', 'смертный', 'смертная', 'незнакомец', 'незнакомка')],
  es: [vocative('jovencit[oa]', 'foraster[oa]', 'extranjer[oa]', 'muchach[oa]', 'invitad[oa]')],
  fr: [vocative('mon petit', 'ma petite', 'étranger', 'étrangère', 'mortel', 'mortelle', 'invitée?', 'rusée?')],
  it: [vocative('stranier[oa]', 'forestier[oa]', 'invitat[oa]')],
  pt: [vocative('meu jovem', 'minha jovem', 'forasteir[oa]', 'convidad[oa]', 'espert[oa]', 'eu [oa] levarei')],
  de: [vocative('junges Ding', 'Fremder', 'Sterblicher')],
  hi: [
    // तुम with a masculine participle or habitual: ढूँढ रहे हो, गा सकते हो, चलाते हो (feminine: रही, सकती, चलाती).
    /[\p{L}\p{M}]+(?:ते|े) हो(?![\p{L}\p{M}])/u, /(?:चले|नाचते) आए(?![\p{L}\p{M}])/u,
    // आप with a masculine verb, as the Hindi core locale writes it (checker, 2026-11-16: "क्या आप ... कर सकते हैं?").
    /(?<![\p{L}\p{M}])आप(?![\p{L}\p{M}])(?:\s+[^\s।?!"]+){0,8}?\s+[\p{L}\p{M}]+(?:ते|गे|े) (?:हैं|थे)(?![\p{L}\p{M}])/u,
    // A sentence with no subject but the player, ending in a masculine past: "समझ गए!", "थोड़ा-सा चूक गए!". From the
    // sentence's start, so a passive with its own subject ("... ग़लत कोड डाले गए।", codes were entered) is not one.
    /(?:^|[।!?.]\s+|["“])(?:[\p{L}\p{M}-]+\s+){0,2}(?:गए|गये|आए)[!?।]/u,
  ],
  ar: [vocative('يا فتى', 'يا فتاة')],
};
export function genderedYou(l: string, m: Messages): string[] {
  const out: string[] = [];
  for (const rx of GENDERED_YOU[l] ?? []) for (const [k, v] of Object.entries(m)) {
    const hit = v.match(rx);
    if (hit) out.push(`${l}: ${k} says "${hit[0]}", which makes the player a man or a woman`);
  }
  return out;
}

/**
 * The counts these areas show, and every value each can take, as the pages fill them in: the trivia
 * score in a round of five (playground.astro: won at 3 or more, lost below), the question being asked,
 * a challenge's blanks, the World Card's bonus (variants.ts), the story's progress over its encounters,
 * and the streak and event countdowns (streaks.ts, weekly-events.ts). Every placeholder of the two
 * areas is either here or in NOT_COUNTS (a test holds that), so a new count cannot be left unchecked:
 * the checker of 2026-11-16 found pg.trivia.lost, which this table had left out, wrong in Hindi for 1.
 */
const STORY_TOTAL = ACTS.reduce((n, a) => n + a.encounters.length, 0);
const TRIVIA_ROUND = 5;
const TRIVIA_TO_WIN = 3;
const upTo = (n: number, from = 0) => Array.from({ length: n - from + 1 }, (_, i) => from + i);
const MOST_BLANKS = Math.max(...CHALLENGE_BANK.map((c) => c.missingWords.length));
export const COUNTS: Record<string, Record<string, number[]>> = {
  'pg.trivia.correct': { n: upTo(TRIVIA_ROUND) },
  'pg.trivia.won': { n: upTo(TRIVIA_ROUND, TRIVIA_TO_WIN), total: [TRIVIA_ROUND] },
  'pg.trivia.lost': { n: upTo(TRIVIA_TO_WIN - 1), total: [TRIVIA_ROUND] },
  'pg.trivia.progress': { n: upTo(TRIVIA_ROUND, 1), total: [TRIVIA_ROUND] },
  'pg.challenge.blank': { n: upTo(MOST_BLANKS, 1) },
  'pg.worldCard': { bonus: [...new Set(Object.values(CITY_CATALOG).map((c) => c.ability.bonus))] },
  // What a trivia round or a quote challenge pays the account (backend/data/economy.json).
  'pg.earnedCredits': { n: [ECONOMY.solo.credits.trivia.amount, ECONOMY.solo.credits.challenge.amount] },
  'story.progress': { done: upTo(STORY_TOTAL), total: [STORY_TOTAL] },
  'countdown.hm': { h: upTo(23, 1), m: upTo(59) },
  'countdown.m': { m: upTo(59) },
};
/**
 * Words that may follow a count because they are the same for every count, each with the reason. Kept short:
 * a string that needs another entry is better rephrased as a label ("Aciertos: {n}").
 */
const AFTER_A_COUNT: Record<string, Record<string, string>> = {
  de: { richtig: 'predicative ("Du hast 1 von 5 richtig"): a German adjective used as a predicate or an adverb takes no ending' },
};

/** Placeholders that hold no number: a city's name, a criterion's name, a translator's name. */
export const NOT_COUNTS = new Set(['city', 'axis', 'translator']);
const UNIT: Record<string, string> = { h: 'hour', m: 'minute' };

/** CLDR's short and narrow words for a unit in a language, where CLDR writes one form for every one of these counts. */
export function unitWords(l: string, unit: string, values: number[]): string[] {
  return (['short', 'narrow'] as const).flatMap((unitDisplay) => {
    const f = new Intl.NumberFormat(l, { style: 'unit', unit, unitDisplay });
    const forms = new Set(values.map((v) => f.formatToParts(v).filter((p) => p.type === 'unit').map((p) => p.value).join('').trim()));
    return forms.size === 1 ? [...forms] : [];
  });
}

/**
 * A count is never followed by a word that changes with it. Where the values a count takes fall in
 * more than one of the language's CLDR plural categories (Intl.PluralRules: Spanish 1 is "one",
 * Arabic 0, 1 and 2 are "zero", "one" and "two"), one form of a noun or adjective after it is wrong
 * for some of them ("1 aciertos", "2 إجابات صحيحة"). Such a string puts the count after a label
 * ("Aciertos: {n}"). A unit is allowed after it only where it is CLDR's own unit word and CLDR
 * writes it the same for every value ("{h} ч", "{m} min").
 */
export function countProblems(l: string, m: Messages): string[] {
  const out: string[] = [];
  const rules = new Intl.PluralRules(l);
  for (const [k, vars] of Object.entries(COUNTS)) {
    const s = m[k];
    if (s === undefined) continue;
    for (const [p, values] of Object.entries(vars)) {
      const cats = [...new Set(values.map((v) => rules.select(v)))];
      if (cats.length < 2) continue;
      const at = s.indexOf(`{${p}}`);
      if (at < 0) continue;
      // Every word after the count up to the end of its sentence, not only the next: a word that agrees with the
      // count can come later (Hindi puts the verb last: "{n} उत्तर सही रहे", where रहे is wrong for 1).
      let rest = s.slice(at + p.length + 2).trimStart();
      // "{n} de {total}", "{n} von {total}", "{n} из {total}": one word joining the count to a total of a single
      // value is the "out of", which no count changes; the sentence goes on after the total. Otherwise the next
      // placeholder starts what belongs to it ("{h} Std. {m} Min.").
      const joiner = rest.match(/^[\p{L}\p{M}]+\s+\{(\w+)\}/u);
      if (joiner && vars[joiner[1]]?.length === 1) rest = rest.slice(joiner[0].length);
      else rest = rest.split(/\{\w+\}/u)[0];
      rest = rest.replace(/\{\w+\}/gu, ' ');
      // Words with their abbreviation dots ("Std."), and the punctuation that ends the sentence.
      const tokens = rest.match(/[\p{L}\p{M}][\p{L}\p{M}.]*|[.!?।。！？]/gu) ?? [];
      const end = tokens.findIndex((w) => /^[.!?।。！？]$/u.test(w));
      const units = UNIT[p] ? unitWords(l, UNIT[p], values) : [];
      const word = (end < 0 ? tokens : tokens.slice(0, end)).find((w) => !units.includes(w) && !(w in (AFTER_A_COUNT[l] ?? {})));
      if (!word) continue;
      out.push(`${l}: ${k} writes "{${p}} … ${word}", but {${p}} takes values in the plural categories ${cats.join(', ')}`);
    }
  }
  return out;
}

/** Chinese and Japanese put no space between two of their own characters (one stood after a name in zh trivia 100 and 135). */
const CJK = '[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}ー]';
export function cjkSpaceProblems(l: string, m: Messages): string[] {
  if (l !== 'zh' && l !== 'ja') return [];
  const rx = new RegExp(`${CJK} +${CJK}`, 'u');
  return Object.entries(m).flatMap(([k, v]) => { const hit = v.match(rx); return hit ? [`${l}: ${k} has a space inside "${hit[0]}"`] : []; });
}

/** Strings a language writes exactly as English does. Each is a decision, not an oversight. */
const SAME_AS_ENGLISH: Record<string, string[]> = {
  fr: ['pg.trivia.progress'], // "Question {n} / {total}"
};

describe('page areas of the play content', () => {
  for (const name of ['playground', 'story'] as const) {
    it(`${name}: every language has exactly the English keys, with the same placeholders`, async () => {
      const en = (await area(name, 'en'))!;
      expect(Object.keys(en).length).toBeGreaterThan(name === 'playground' ? 95 : 80);
      const problems: string[] = [];
      for (const l of LOCALES) problems.push(...areaProblems(l, await area(name, l), en));
      expect(problems).toEqual([]);
      // The first test to load all sixteen of an area's modules: in a whole-suite run on the shared build host it
      // took over vitest's 5 s (2026-11-18), alone well under it.
    }, 30_000);

    it(`${name}: every language is translated, not English left in place`, async () => {
      const en = (await area(name, 'en'))!;
      for (const l of LOCALES) {
        if (l === 'en') continue;
        const m = (await area(name, l))!;
        // The same in both only where the two languages really do say it the same way.
        const same = Object.keys(en).filter((k) => m[k] === en[k] && en[k].length > 2 && !(SAME_AS_ENGLISH[l] ?? []).includes(k));
        expect([l, same]).toEqual([l, []]);
      }
    });
  }

  it('the story area has every act and encounter of story-mode.ts, and keeps its quotations in English', async () => {
    const en = (await area('story', 'en'))!;
    for (const act of ACTS) for (const e of act.encounters) expect(en[`story.enc.${e.id}.narrative`]).toBe(e.narrative);
    const problems: string[] = [];
    for (const l of LOCALES) {
      const m = (await area('story', l))!;
      for (const [k, v] of Object.entries(en)) for (const quote of quotations(v)) {
        // Only lines that are Shakespeare's: the game's own dialogue is translated.
        if (SHAKESPEARE.some((s) => quote.startsWith(s)) && !m[k].includes(SHAKESPEARE.find((s) => quote.startsWith(s))!)) problems.push(`${l}: ${k} lost "${quote}"`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('addresses the player the way the core locale does (du, vous, ты, kamu, 해요체, …)', async () => {
    const problems: string[] = [];
    for (const l of LOCALES) for (const name of ['playground', 'story']) problems.push(...addressProblems(l, (await area(name, l))!));
    expect(problems).toEqual([]);
  });

  it('writes Brazilian Portuguese, as the core locale does, in every play area', async () => {
    const problems: string[] = [];
    for (const name of ['playground', 'story', 'trivia', 'challenges']) {
      const m = await area(name, 'pt');
      if (m) problems.push(...europeanPortuguese(m));
    }
    expect(problems).toEqual([]);
  });

  it('assumes no gender for the player (past tenses, vocatives, Hindi verbs)', async () => {
    const problems: string[] = [];
    for (const l of Object.keys(GENDERED_YOU)) for (const name of ['playground', 'story']) problems.push(...genderedYou(l, (await area(name, l))!));
    expect(problems).toEqual([]);
  });

  it('in Arabic, English inside a sentence is a bidirectional isolate, so its punctuation stays at its end', async () => {
    const { RTL, bidiProblems } = await bidi();
    const problems: string[] = [];
    for (const l of RTL) for (const name of ['playground', 'story', 'trivia', 'challenges']) {
      const m = await area(name, l);
      for (const [k, v] of Object.entries(m ?? {})) problems.push(...bidiProblems(`${l} ${k}`, v));
    }
    expect(problems).toEqual([]);
  });

  it('Chinese and Japanese have no space between two of their characters', async () => {
    const problems: string[] = [];
    // Trivia questions only: an option that is a name is its source's ("ヘンリー四世 第1部" is the label and the article title).
    for (const l of ['zh', 'ja']) for (const name of ['playground', 'story', 'trivia']) {
      const m = (await area(name, l))!;
      problems.push(...cjkSpaceProblems(l, name === 'trivia' ? Object.fromEntries(Object.entries(m).filter(([k]) => k.endsWith('.q'))) : m));
    }
    expect(problems).toEqual([]);
  });

  it('a count is followed by no word that changes with it (CLDR plural categories)', async () => {
    const problems: string[] = [];
    for (const l of LOCALES) for (const name of ['playground', 'story']) problems.push(...countProblems(l, (await area(name, l))!));
    expect(problems).toEqual([]);
  });

  it('every placeholder of these areas is a count the count check reads, or one that holds no number', async () => {
    const unread: string[] = [];
    for (const name of ['playground', 'story']) for (const [k, v] of Object.entries((await area(name, 'en'))!)) {
      for (const [, p] of v.matchAll(/\{(\w+)\}/g)) if (!NOT_COUNTS.has(p) && !COUNTS[k]?.[p]) unread.push(`${k} {${p}}`);
    }
    expect(unread).toEqual([]);
  });

  it('says a thing the way the core locale says it', async () => {
    for (const l of LOCALES) {
      const core = await loadMessages(l);
      const pg = (await area('playground', l))!;
      expect([l, pg['pg.meta.title']]).toEqual([l, core['nav.playground']]);
      // Closing a panel is one word wherever it appears (English says Close here and Dismiss on the install banner).
      if (l !== 'en') expect([l, pg['pg.close']]).toEqual([l, core['pwa.dismiss']]);
    }
  });
});

/** Shakespeare's own words in the story's narratives (their openings): these stay in English in every language. */
const SHAKESPEARE = [
  'Do you bite your thumb at me, sir', 'A plague on both your houses', "There's rosemary, that's for remembrance", "The play's the thing wherein I'll catch the conscience of the king",
  'To be, or not to be', 'Lord, what fools these mortals be', 'I have had a most rare vision', "This island's mine", "You taught me language, and my profit on't is, I know how to curse",
  'Full fathom five', "O brave new world, that has such people in't", 'Every third thought shall be my grave', 'Tomorrow, and tomorrow, and tomorrow',
  'Not that I loved Caesar less, but that I loved Rome more', 'Friends, Romans, countrymen, lend me your ears',
];

describe('trivia in every language', () => {
  it('has the bank whole: every question, every option, quotations and numbers intact', async () => {
    expect(TRIVIA_BANK.length).toBe(200);
    const problems: string[] = [];
    for (const l of LOCALES) problems.push(...triviaProblems(l, await area('trivia', l)));
    expect(problems).toEqual([]);
  });

  it('keeps the correct answer where English has it', async () => {
    for (const l of LOCALES) {
      const bank = await localTriviaBank(l);
      expect([l, bank.length]).toEqual([l, TRIVIA_BANK.length]);
      bank.forEach((q, n) => {
        expect([l, n, q.options.length, q.correctIndex]).toEqual([l, n, TRIVIA_BANK[n].options.length, TRIVIA_BANK[n].correctIndex]);
        expect(q.correctIndex >= 0 && q.correctIndex < q.options.length).toBe(true);
      });
    }
  });

  it('an option that is a name is the names table\'s name for the English option at that place, so the correct index holds', async () => {
    const { optionKeys, nameOf, ucfirst } = await namesTable();
    const problems: string[] = [];
    for (const l of LOCALES) if (l !== 'en') problems.push(...nameOptionProblems(l, (await area('trivia', l))!, optionKeys, nameOf, ucfirst));
    expect(problems).toEqual([]);
    // And the right answer is one of them often enough for this to matter.
    const named = TRIVIA_BANK.filter((q, n) => optionKeys[n][q.correctIndex]).length;
    expect(named).toBeGreaterThan(80);
  });

  it("every name read in a Wikipedia article was read in its play's own article, beside the character and not somebody else", async () => {
    const { rowProblems } = await evidence();
    const problems = evidenceLines().flatMap((row) => rowProblems(row).map((p) => `${row.slice(0, 3).join(' ')}: ${p}`));
    expect(problems).toEqual([]);
  });

  it('a name option written by hand is a form a source gives, or the English name (trivia-option-handnames.tsv)', async () => {
    const sourcesFor = await sourcesTable();
    const rows = readTsvFile('scripts/lang-content/trivia-option-handnames.tsv');
    expect(rows.length).toBeGreaterThan(45);
    const problems: string[] = [];
    for (const l of LOCALES) if (l !== 'en') problems.push(...handNameProblems(l, (await area('trivia', l))!, rows, sourcesFor));
    expect(problems).toEqual([]);
  });

  it('in a language not written in Latin letters, the right answer is never the one option in its script', async () => {
    const problems: string[] = [];
    for (const l of NOT_LATIN) problems.push(...scriptTells(l, (await area('trivia', l))!));
    expect(problems).toEqual([]);
  });

  it('every generated trivia and challenge file is what its sources make (build.mjs --check)', () => {
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/lang-content/build.mjs'), '--check'], { encoding: 'utf8' });
    expect(r.stderr.split('\n').filter((s) => /ERROR|NOT WHAT/.test(s) || s.startsWith('  src/'))).toEqual([]);
    expect(r.status).toBe(0);
  });

  it('is actually translated: a language shares few questions with English', async () => {
    for (const l of LOCALES) {
      if (l === 'en') continue;
      const m = (await area('trivia', l))!;
      const same = TRIVIA_BANK.filter((q, n) => m[`trivia.${n}.q`] === q.question).length;
      expect([l, same]).toEqual([l, 0]);
    }
  });

  it('a shuffled round still points at the right answer', async () => {
    for (const l of ['en', 'ja', 'ar'] as Locale[]) {
      const bank = await localTriviaBank(l);
      const round = await localRandomQuestions(40, l);
      expect(round.length).toBe(40);
      for (const q of round) {
        const source = bank.find((b) => b.question === q.question)!;
        expect(source).toBeTruthy();
        expect(q.options[q.correctIndex]).toBe(source.options[source.correctIndex]);
        expect([...q.options].sort()).toEqual([...source.options].sort());
      }
    }
  });
});

describe('quote challenges in every language', () => {
  it("every challenge's missing words are in its line, in order, and its blanks fill back to the line", async () => {
    const problems: string[] = [];
    for (const l of LOCALES) problems.push(...challengeProblems(l, await area('challenges', l)));
    expect(problems).toEqual([]);
  });

  it('English has the whole bank; a language with too few of its own plays the English originals', async () => {
    expect((await localChallenges('en')).length).toBe(CHALLENGE_BANK.length);
    for (const l of LOCALES) {
      const own = l === 'en' ? [] : await ownChallenges(l);
      const played = await localChallenges(l);
      if (l !== 'en' && own.length >= MIN_LOCAL_CHALLENGES) expect([l, played.every((c) => c.lang === l && !!c.translator)]).toEqual([l, true]);
      else expect([l, played.length, played.every((c) => c.lang === 'en')]).toEqual([l, CHALLENGE_BANK.length, true]);
    }
  });

  it("an English original is headed with the play and speaker in the player's language where the names table has both", async () => {
    // @ts-ignore -- a build script in plain JavaScript, without type declarations
    const lib = await import('../../../scripts/lang-content/lib.mjs');
    expect(lib.MIN_LOCAL_CHALLENGES).toBe(MIN_LOCAL_CHALLENGES);
    const { nameOf } = await namesTable();
    const ar = await localChallenges('ar');
    const juliet = ar.find((c) => CHALLENGE_BANK[c.id].play === 'Romeo and Juliet' && CHALLENGE_BANK[c.id].character === 'Juliet')!;
    expect([juliet.lang, juliet.headingLang, juliet.play, juliet.character]).toEqual(['en', 'ar', nameOf('p.romeo', 'ar').name, nameOf('c.juliet', 'ar').name]);
    // A speaker that is a description and in no source ("Second Witch", "Stage Direction") keeps the whole heading in English.
    const witch = ar.find((c) => CHALLENGE_BANK[c.id].character === 'Second Witch')!;
    expect([witch.headingLang, witch.play, witch.character]).toEqual(['en', CHALLENGE_BANK[witch.id].play, 'Second Witch']);
    for (const l of LOCALES) for (const c of await localChallenges(l)) {
      if (c.lang === 'en' && c.headingLang && c.headingLang !== 'en') expect([l, c.id, c.headingLang]).toEqual([l, c.id, l]);
    }
  });

  it('accepts an answer whatever its case, spacing or Unicode form, and nothing else', () => {
    expect(answersMatch(['be', 'be'], [' Be', 'BE '])).toBe(true);
    expect(answersMatch(['be', 'be'], ['be'])).toBe(false);
    expect(answersMatch(['be', 'be'], ['be', 'bee'])).toBe(false);
    expect(answersMatch(['question'], ['question.'])).toBe(true);
    expect(answersMatch(['Être'], ['être'], 'fr')).toBe(true); // decomposed accent
    expect(answersMatch(['ＡＢ'], ['ab'], 'ja')).toBe(true); // full-width letters
    expect(answersMatch(['İstanbul'], ['istanbul'], 'tr')).toBe(true);
    expect(answersMatch(['Frage'], ['Fragen'], 'de')).toBe(false);
  });
});

describe('these checks can fail', () => {
  it('areaProblems objects to a missing key, an empty value, a changed placeholder, an extra key', async () => {
    const en = (await area('playground', 'en'))!;
    const de = (await area('playground', 'de'))!;
    const { 'pg.title': _dropped, ...missing } = de;
    expect(areaProblems('de', missing, en)).toEqual(['de: missing pg.title']);
    expect(areaProblems('de', { ...de, 'pg.intro': ' ' }, en)).toEqual(['de: empty pg.intro']);
    expect(areaProblems('de', { ...de, 'pg.trivia.progress': 'Frage {n} / {gesamt}' }, en).length).toBe(1);
    expect(areaProblems('de', { ...de, 'pg.trivia.progress': 'Frage {n} / {total}}' }, en)).toEqual(['de: stray brace in pg.trivia.progress']);
    expect(areaProblems('de', { ...de, 'pg.nonsense': 'x' }, en)).toEqual(['de: extra pg.nonsense']);
    expect(areaProblems('de', undefined, en)).toEqual(['de: no file']);
  });

  it('triviaProblems objects to a dropped option, a twin option, a lost quotation, a changed number', async () => {
    const fr = (await area('trivia', 'fr'))!;
    const { 'trivia.5.o3': _gone, ...short } = fr;
    expect(triviaProblems('fr', short).some((p) => p.includes('question 5 lacks an option'))).toBe(true);
    expect(triviaProblems('fr', { ...fr, 'trivia.5.o4': 'Paris' }).some((p) => p.includes('more options than English'))).toBe(true);
    expect(triviaProblems('fr', { ...fr, 'trivia.9.o1': fr['trivia.9.o0'] }).some((p) => p.includes('question 9 has two options'))).toBe(true);
    expect(triviaProblems('fr', { ...fr, 'trivia.0.q': 'Qui a écrit « Être ou ne pas être » ?' }).some((p) => p.includes('question 0 changed or lost the quotation'))).toBe(true);
    expect(triviaProblems('fr', { ...fr, 'trivia.86.o0': '1661' }).some((p) => p.includes('question 86 option 0'))).toBe(true);
    expect(triviaProblems('fr', { ...fr, 'trivia.110.q': fr['trivia.110.q'].replace('1613', '1631') }).some((p) => p.includes('lost the number 1613'))).toBe(true);
  });

  it('nameOptionProblems objects to two name options swapped, which would move the right answer', async () => {
    const { optionKeys, nameOf, ucfirst } = await namesTable();
    const ja = (await area('trivia', 'ja'))!;
    expect(nameOptionProblems('ja', ja, optionKeys, nameOf, ucfirst)).toEqual([]);
    // Question 1 ("Which play features Romeo and Juliet?"): its options are all plays.
    const swapped = { ...ja, 'trivia.1.o0': ja['trivia.1.o1'], 'trivia.1.o1': ja['trivia.1.o0'] };
    expect(nameOptionProblems('ja', swapped, optionKeys, nameOf, ucfirst).length).toBe(2);
    expect(nameOptionProblems('ja', { ...ja, 'trivia.1.o0': 'ハムレット' }, optionKeys, nameOf, ucfirst)[0]).toContain('the correct answer');
  });

  it('handNameProblems objects to the forms the checker and this pass found unsourced, and not to sourced ones', async () => {
    const sourcesFor = await sourcesTable();
    const rows = readTsvFile('scripts/lang-content/trivia-option-handnames.tsv');
    const ja = (await area('trivia', 'ja'))!, es = (await area('trivia', 'es'))!, hi = (await area('trivia', 'hi'))!;
    expect(handNameProblems('ja', ja, rows, sourcesFor)).toEqual([]);
    // As shipped at d6ee2eb: アーロン (read beside the dramatist Aaron Hill), Escalo (es.wikipedia says Escala), ग्लॉस्टर (hi.wikipedia says ग्लस्टर).
    expect(handNameProblems('ja', { ...ja, 'trivia.50.o3': 'アーロン' }, rows, sourcesFor).length).toBe(1);
    expect(handNameProblems('es', { ...es, 'trivia.33.o0': 'Escalo' }, rows, sourcesFor).length).toBe(1);
    expect(handNameProblems('hi', { ...hi, 'trivia.131.o1': 'ग्लॉस्टर के अर्ल' }, rows, sourcesFor).length).toBe(1);
    expect(handNameProblems('es', { ...es, 'trivia.33.o0': 'Escalus' }, rows, sourcesFor)).toEqual([]); // the English name
  });

  it('scriptTells objects to a right answer that is the one option in Thai, or the one in Latin letters', async () => {
    const th = (await area('trivia', 'th'))!;
    expect(scriptTells('th', th)).toEqual([]);
    // Question 12 (Macbeth is the right answer): the Thai label for him alone, the others in Latin letters.
    expect(scriptTells('th', { ...th, 'trivia.12.o0': 'แม็คเบ็ธ', 'trivia.12.o1': 'Duncan', 'trivia.12.o2': 'Malcolm', 'trivia.12.o3': 'Banquo' })).toEqual(['th: question 12: the right answer is the only option in its script']);
    expect(scriptTells('th', { ...th, 'trivia.12.o0': 'Macbeth', 'trivia.12.o1': 'ดันแคน', 'trivia.12.o2': 'มัลคอล์ม', 'trivia.12.o3': 'แบงโคว' })).toEqual(['th: question 12: the right answer is the only option in Latin letters']);
    // Two names joined by a word of the language: the names' script is what shows.
    const hi = (await area('trivia', 'hi'))!;
    expect(scriptTells('hi', hi)).toEqual([]);
    expect(scriptTells('hi', { ...hi, 'trivia.83.o0': 'ब्रूटस और कैसियस' })).toEqual(['hi: question 83: the right answer is the only option in its script']);
  });

  it('challengeProblems objects to a word that is not in the line, a blank too many, a missing translator', () => {
    const good: Messages = { 'challenges.ids': '0', 'challenge.0.full': 'Sein oder Nichtsein, das ist hier die Frage.', 'challenge.0.display': '___ oder ___, das ist hier die Frage.', 'challenge.0.missing': 'Sein|Nichtsein', 'challenge.0.play': 'Hamlet', 'challenge.0.character': 'Hamlet', 'challenge.0.translator': 'A. W. Schlegel' };
    expect(challengeProblems('de', good)).toEqual([]);
    expect(challengesFrom(good, 'de')[0].missingWords).toEqual(['Sein', 'Nichtsein']);
    expect(challengeProblems('de', { ...good, 'challenge.0.missing': 'Sein|Dasein' }).length).toBeGreaterThan(0);
    expect(challengeProblems('de', { ...good, 'challenge.0.missing': 'Nichtsein|Sein' }).length).toBeGreaterThan(0); // out of order
    expect(challengeProblems('de', { ...good, 'challenge.0.display': '___ oder ___, das ist hier die ___.' }).length).toBeGreaterThan(0);
    const { 'challenge.0.translator': _t, ...anonymous } = good;
    expect(challengeProblems('de', anonymous).some((p) => p.includes('names no translator'))).toBe(true);
    expect(challengeProblems('de', { ...good, 'challenges.ids': '0,999' }).some((p) => p.includes('not in the bank'))).toBe(true);
  });

  it('addressProblems objects to the other form of address in every language it knows, and not to quoted speech', () => {
    const bad: Record<string, string> = {
      de: 'Öffnen Sie Ihr Starterpack.', fr: 'Tu peux ouvrir le paquet de départ.', es: 'Abra usted su sobre.', it: 'Aprite il vostro pacchetto.',
      pt: 'Abre o teu pacote.', pl: 'Niech pan otworzy pakiet.', ru: 'Откройте стартовый набор.', id: 'Buka paket Anda.',
      ko: '팩을 여십시오.', ja: 'パックを開けるのだ。', zh: '请打开您的卡包。', hi: 'तुम अपना पैक खोलो।', vi: 'Mời quý vị mở gói.', ar: 'افتحوا الحزمة لكم.',
    };
    for (const [l, s] of Object.entries(bad)) expect([l, addressProblems(l, { k: s }).length]).toEqual([l, 1]);
    // The same words inside a character's speech are that character's voice.
    expect(addressProblems('fr', { k: 'Le prince vous convoque. « Montre-moi que tu manies les mots. »' })).toEqual([]);
    expect(addressProblems('ru', { k: 'Мастер сцены ждёт тебя. «Откройте занавес!»' })).toEqual([]);
    expect(addressProblems('de', { k: 'Sie lachen. Du bist dran.' })).toEqual([]); // "Sie" opening a sentence is "they"
  });

  it('bidiProblems objects to English left bare in Arabic, to an isolate left open, and not to an isolated line', async () => {
    const { bidiProblems, isolateLatin } = await bidi();
    const bare = 'خادم يعترض طريقك. "Do you bite your thumb at me, sir?"';
    expect(bidiProblems('k', bare).length).toBe(1);
    const fixed = isolateLatin(bare);
    expect(fixed).toBe('خادم يعترض طريقك. \u2068"Do you bite your thumb at me, sir?"\u2069'); // English marks inside, with the line
    expect(isolateLatin('يقول «Et tu, Brute?»')).toBe('يقول «\u2068Et tu, Brute?\u2069»'); // Arabic marks outside
    expect(bidiProblems('k', fixed)).toEqual([]);
    expect(bidiProblems('k', fixed.replace('\u2069', '')).length).toBe(2); // opened, never closed
    expect(bidiProblems('k', 'من يقول «\u2068Et tu, Brute?\u2069» وهو يموت؟')).toEqual([]);
    expect(bidiProblems('k', 'شخصية \u200EPuck؟').length).toBe(2); // a left-to-right mark is not an isolate
    expect(isolateLatin('السؤال {n} / {total}')).toBe('السؤال {n} / {total}'); // a placeholder's name is not text
    expect(bidiProblems('k', 'السؤال {n} / {total}').length).toBe(1); // 1 / 5 would read 5 / 1
    expect(bidiProblems('k', 'السؤال {n}/{total}')).toEqual([]);
  });

  it('cjkSpaceProblems objects to the space zh trivia 100 had after a name, and not to one beside a number or Latin letters', () => {
    expect(cjkSpaceProblems('zh', { k: '在《冬天的故事》中，珀迪塔 是哪个王国的公主？' }).length).toBe(1);
    expect(cjkSpaceProblems('zh', { k: '在《冬天的故事》中，珀迪塔是哪个王国的公主？' })).toEqual([]);
    expect(cjkSpaceProblems('zh', { k: '{h} 小时 {m} 分钟', j: '穿越 5 幕', i: '在 Hamlet 中' })).toEqual([]);
  });

  it('countProblems objects to a noun after a count whose values take two plural forms, and not to a label or a CLDR unit', () => {
    // The checker's cases: Spanish 1 is "one", French 0 and 1 are "one", Arabic 0, 1, 2 are zero, one, two.
    expect(countProblems('es', { 'pg.trivia.correct': '{n} aciertos' }).length).toBe(1);
    expect(countProblems('fr', { 'pg.trivia.correct': '{n} bonnes réponses' }).length).toBe(1);
    expect(countProblems('ar', { 'pg.trivia.correct': '{n} إجابات صحيحة' }).length).toBe(1);
    expect(countProblems('es', { 'pg.trivia.correct': 'Aciertos: {n}' })).toEqual([]);
    expect(countProblems('ja', { 'pg.trivia.correct': '正解{n}問' })).toEqual([]); // Japanese has one category
    expect(countProblems('ru', { 'countdown.hm': '{h} ч {m} мин' })).toEqual([]);
    expect(countProblems('ru', { 'countdown.hm': '{h} часов {m} минут' }).length).toBe(2);
    expect(countProblems('pl', { 'story.progress': 'Ukończone spotkania: {done} / {total}' })).toEqual([]);
    expect(countProblems('pl', { 'story.progress': '{done} spotkań z {total}' }).length).toBe(1);
    // The checker's find of 2026-11-16: Hindi's verb comes last, and रहे is wrong for a score of 1.
    expect(countProblems('hi', { 'pg.trivia.lost': 'आपके {total} में से {n} उत्तर सही रहे' }).length).toBe(1);
    expect(countProblems('hi', { 'pg.trivia.lost': 'आपका स्कोर: {n} / {total}' })).toEqual([]);
    expect(countProblems('es', { 'pg.trivia.lost': 'Has acertado {n} preguntas de {total}' }).length).toBe(1);
    expect(countProblems('es', { 'pg.trivia.lost': 'Has acertado {n} de {total}' })).toEqual([]); // "de": the out-of
    expect(countProblems('de', { 'pg.trivia.lost': 'Du hast {n} von {total} richtig' })).toEqual([]); // AFTER_A_COUNT
    expect(countProblems('de', { 'pg.trivia.lost': 'Du hast {n} von {total} richtige Antworten' }).length).toBe(1);
    expect(countProblems('de', { 'countdown.hm': '{h} Std. {m} Min.' })).toEqual([]); // CLDR's short units, with their dots
    expect(countProblems('es', { 'pg.trivia.correct': 'Aciertos: {n}. Muy bien' })).toEqual([]); // a new sentence
  });

  it('europeanPortuguese objects to the European spellings this branch replaced, and not to Brazilian ones', () => {
    for (const s of ['Marco António', 'Polónio', 'na Boémia', 'Octávia', 'no Egipto', 'o ecrã']) expect([s, europeanPortuguese({ k: s }).length]).toEqual([s, 1]);
    for (const s of ['Marco Antônio', 'Polônio', 'na Boêmia', 'Otávia', 'no Egito', 'a tela', 'Desdêmona']) expect([s, europeanPortuguese({ k: s })]).toEqual([s, []]);
  });

  it('genderedYou objects to the forms this branch rephrased, and not to the player addressed in the present', () => {
    expect(genderedYou('pl', { k: '„Dobrze zagrałeś swoją rolę.”' }).length).toBe(1);
    expect(genderedYou('pl', { k: 'Przetańczyłaś przez moje włości.' }).length).toBe(1);
    expect(genderedYou('pl', { k: '„Twoja rola została dobrze zagrana.” Tańczysz po moich włościach.' })).toEqual([]);
    expect(genderedYou('ru', { k: '«Ты хорошо сыграл свою роль.»' }).length).toBe(1);
    expect(genderedYou('ru', { k: '«Ты незваным протанцевал по моим владениям.»' }).length).toBe(1);
    expect(genderedYou('ru', { k: '«Ты без приглашения танцуешь по моим владениям.» Твоя роль сыграна хорошо.' })).toEqual([]);
    expect(genderedYou('de', { k: 'Du hast gut gespielt.' })).toEqual([]); // German past tense has no gender
    // The checker's lines (story 1-2 at d6ee2eb) and the vocatives read after it.
    expect(genderedYou('es', { k: '«Jovencito, si buscas a Romeo…»' }).length).toBe(1);
    expect(genderedYou('pt', { k: '“Meu jovem, se procura Romeu…”' }).length).toBe(1);
    expect(genderedYou('fr', { k: '« Mon petit, si tu cherches Roméo… »' }).length).toBe(1);
    expect(genderedYou('de', { k: '„Junges Ding, wenn du Romeo suchst…“' }).length).toBe(1);
    expect(genderedYou('hi', { k: '"बच्चे, अगर तुम रोमियो को ढूँढ रहे हो"' }).length).toBe(1);
    expect(genderedYou('de', { k: '„Fang mich, Sterblicher.“' }).length).toBe(1);
    expect(genderedYou('ru', { k: '«Убеди меня, чужестранец.»' }).length).toBe(1);
    expect(genderedYou('es', { k: '«Criatura, si buscas a Romeo…» «Convénceme, visitante.»' })).toEqual([]);
    expect(genderedYou('de', { k: '„Kind, wenn du Romeo suchst…“ „Fang mich, Menschenkind.“' })).toEqual([]);
    expect(genderedYou('hi', { k: '"बच्चे, रोमियो की तलाश हो तो पहले साबित करो"' })).toEqual([]);
    // The checker's Hindi of 2026-11-16, and what replaced it.
    expect(genderedYou('hi', { k: 'क्या आप उसकी निराशा के बोझ की बराबरी कर सकते हैं?' }).length).toBe(1);
    expect(genderedYou('hi', { k: 'थोड़ा-सा चूक गए!' }).length).toBe(1);
    expect(genderedYou('hi', { k: 'समझ गए!' }).length).toBe(1);
    expect(genderedYou('hi', { k: 'दिखाओ कि तुम तलवार नहीं, शब्द चलाते हो' }).length).toBe(1);
    expect(genderedYou('hi', { k: 'क्या आपके पद्य उसकी निराशा के बोझ की बराबरी कर पाएँगे?' })).toEqual([]);
    expect(genderedYou('hi', { k: 'बस थोड़ी-सी कसर रह गई!' })).toEqual([]);
    expect(genderedYou('hi', { k: 'दिखाओ कि तुम्हारा हथियार तलवार नहीं, शब्द हैं' })).toEqual([]);
    expect(genderedYou('hi', { k: 'राजकुमार आपको महल में बुलाते हैं।' })).toEqual([]); // the prince, honorific, not the player
    expect(genderedYou('hi', { k: 'इस पते के लिए बहुत ज़्यादा ग़लत कोड डाले गए।' })).toEqual([]); // the codes, not the player
    expect(genderedYou('hi', { k: 'कोड सही है। समझ गए!' }).length).toBe(1);
  });

  it("evidence's rowProblems objects to each line the checker found naming somebody else, and to a namesake's article", async () => {
    const { rowProblems } = await evidence();
    // The six lines as they were committed at d6ee2eb: an actress, two directors, Laurence Olivier, Aaron Hill, and
    // Measure for Measure's Escalus given for the Prince of Verona.
    const bad = readFileSync(join(process.cwd(), 'scripts/lang-content/qa/evidence-known-bad.tsv'), 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'));
    expect(bad.length).toBe(6);
    for (const row of bad) expect([row.slice(0, 3).join(' '), rowProblems(row).length > 0]).toEqual([row.slice(0, 3).join(' '), true]);
    // The same name read in the play's own cast list passes; moved to another play's article, it does not.
    const kent = ['x.kent', 'ru', 'Кент', 'https://ru.wikipedia.org/w/index.php?title=%D0%9A%D0%BE%D1%80%D0%BE%D0%BB%D1%8C_%D0%9B%D0%B8%D1%80&oldid=155321368', '2026-11-16', '1 mentions', 'т её наследство пополам между старшими дочерьми. Граф Глостер и граф Кент замечают, что таким образом королевство'];
    expect(rowProblems(kent)).toEqual([]);
    expect(rowProblems([...kent.slice(0, 3), kent[3].replace('%D0%9A%D0%BE%D1%80%D0%BE%D0%BB%D1%8C_%D0%9B%D0%B8%D1%80', '%D0%91%D1%83%D1%80%D1%8F'), ...kent.slice(4)]).length).toBe(1);
    expect(rowProblems([...kent.slice(0, 6), 'режиссёр Дон Кент, в главной роли']).length).toBe(1);
  });

  it('triviaBankFrom falls back to English for a question a language lacks, and no further', () => {
    const bank = triviaBankFrom({ 'trivia.0.q': 'Q0', 'trivia.0.o0': 'A' });
    expect(bank[0].question).toBe('Q0');
    expect(bank[0].options).toEqual(['A', ...TRIVIA_BANK[0].options.slice(1)]);
    expect(bank[1]).toEqual(TRIVIA_BANK[1]);
  });
});
