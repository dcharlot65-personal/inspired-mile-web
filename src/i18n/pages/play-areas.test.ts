import { describe, expect, it } from 'vitest';
import { LOCALES, loadMessages, type Locale, type Messages } from '../index';
import { TRIVIA_BANK } from '../../lib/trivia';
import { CHALLENGE_BANK } from '../../lib/challenges';
import { ACTS } from '../../lib/story-mode';
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

/** A language's trivia: every question and option present, options distinct, quotations and numbers intact. */
export function triviaProblems(l: string, m: Messages | undefined): string[] {
  if (!m) return [`${l}: no trivia file`];
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
      for (const num of o.match(/\d+/g) ?? []) if (!options[i].includes(num)) out.push(`${l}: question ${n} option ${i} lost the number ${num}`);
      for (const quote of quotations(o)) if (!options[i].includes(quote)) out.push(`${l}: question ${n} option ${i} changed the quotation "${quote}"`);
    });
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
  const perChallenge = l === 'en' ? 5 : 5; // full, display, missing, play, and character (en) or translator (others)
  const stray = Object.keys(m).filter((k) => k.startsWith('challenge.') && !ids.includes(k.split('.')[1]));
  if (stray.length) out.push(`${l}: keys for challenges not listed in challenges.ids: ${stray.slice(0, 3).join(', ')}`);
  if (Object.keys(m).length !== 1 + ids.length * perChallenge) out.push(`${l}: ${Object.keys(m).length} keys for ${ids.length} challenges`);
  return out;
}

describe('page areas of the play content', () => {
  for (const name of ['playground', 'story'] as const) {
    it(`${name}: every language has exactly the English keys, with the same placeholders`, async () => {
      const en = (await area(name, 'en'))!;
      expect(Object.keys(en).length).toBeGreaterThan(name === 'playground' ? 95 : 80);
      const problems: string[] = [];
      for (const l of LOCALES) problems.push(...areaProblems(l, await area(name, l), en));
      expect(problems).toEqual([]);
    });

    it(`${name}: every language is translated, not English left in place`, async () => {
      const en = (await area(name, 'en'))!;
      for (const l of LOCALES) {
        if (l === 'en') continue;
        const m = (await area(name, l))!;
        // The same in both: a lone full stop, a rhyme-free unit like "{m}m" in no language we have, a proper name.
        const same = Object.keys(en).filter((k) => m[k] === en[k] && en[k].length > 2);
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

  it('says a thing the way the core locale says it', async () => {
    for (const l of LOCALES) {
      const core = await loadMessages(l);
      const pg = (await area('playground', l))!;
      expect([l, pg['pg.meta.title']]).toEqual([l, core['nav.playground']]);
      // "Collect" and "Close" are one word each wherever they appear.
      expect([l, pg['pg.close']]).toEqual([l, core['pwa.dismiss']]);
    }
  });
});

/** Shakespeare's own words in the story's narratives (their openings): these stay in English in every language. */
const SHAKESPEARE = [
  'Do you bite your thumb at me, sir', 'A plague on both your houses', "There's rosemary, that's for remembrance", "The play's the thing wherein I'll catch the conscience of the king",
  'To be, or not to be', 'Lord, what fools these mortals be', 'I have had a most rare vision', "This island's mine", "You taught me language, and my profit on't is, I know how to curse",
  'Full fathom five', "O brave new world, that has such people in't", 'Every third thought shall be my grave', 'Tomorrow, and tomorrow, and tomorrow',
  'Not that I loved Caesar less, but that I loved Rome more', "All the world's a stage",
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

  it('challengeProblems objects to a word that is not in the line, a blank too many, a missing translator', () => {
    const good: Messages = { 'challenges.ids': '0', 'challenge.0.full': 'Sein oder Nichtsein, das ist hier die Frage.', 'challenge.0.display': '___ oder ___, das ist hier die Frage.', 'challenge.0.missing': 'Sein|Nichtsein', 'challenge.0.play': 'Hamlet', 'challenge.0.translator': 'A. W. Schlegel' };
    expect(challengeProblems('de', good)).toEqual([]);
    expect(challengesFrom(good, 'de')[0].missingWords).toEqual(['Sein', 'Nichtsein']);
    expect(challengeProblems('de', { ...good, 'challenge.0.missing': 'Sein|Dasein' }).length).toBeGreaterThan(0);
    expect(challengeProblems('de', { ...good, 'challenge.0.missing': 'Nichtsein|Sein' }).length).toBeGreaterThan(0); // out of order
    expect(challengeProblems('de', { ...good, 'challenge.0.display': '___ oder ___, das ist hier die ___.' }).length).toBeGreaterThan(0);
    const { 'challenge.0.translator': _t, ...anonymous } = good;
    expect(challengeProblems('de', anonymous).some((p) => p.includes('names no translator'))).toBe(true);
    expect(challengeProblems('de', { ...good, 'challenges.ids': '0,999' }).some((p) => p.includes('not in the bank'))).toBe(true);
  });

  it('triviaBankFrom falls back to English for a question a language lacks, and no further', () => {
    const bank = triviaBankFrom({ 'trivia.0.q': 'Q0', 'trivia.0.o0': 'A' });
    expect(bank[0].question).toBe('Q0');
    expect(bank[0].options).toEqual(['A', ...TRIVIA_BANK[0].options.slice(1)]);
    expect(bank[1]).toEqual(TRIVIA_BANK[1]);
  });
});
