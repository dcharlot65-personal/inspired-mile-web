/**
 * The referee: asks the loaded model to compare two verses, or falls back to
 * the rule-based comparison when no model is loaded, when the loaded model has
 * not been shown to judge verse in the duel's language (MODELS[..].judgesIn in
 * ../brain, measured: docs/language/MODEL-EVAL.md), or when a reading fails.
 */
import { CARD_CATALOG } from '../cards';
import { getCardText } from '../cards-i18n';
import { answerScores, brainInfo, isBrainLoaded, modelJudges } from '../brain';
import { invocationNames, signatureWords } from './devices';
import type { JudgeSplit } from './duel';
import {
  CRITERIA, GRADE_ANSWERS, boundedByRules, combineMargins, compareMessages, expectedGrade, gradeMessages, judgeLines, rulesJudge, type Margins,
} from './judge';
import { localCharacterNames, localSignatureWords, wordKey } from './echo';
import { baseLang } from './lang';
import { languageName } from './opponent';
import { STOP_WORDS, fold, letterCount, wordsOf } from './text';

/**
 * Words that count as literary allusion for the rule-based judge: the names a
 * character is called by, and the telling words of every card's line. Everyday
 * words in those lines ("that", "this", "with", "have") are not allusions.
 * In a language that has its own names and lines for the cards (src/lib/cards-i18n, loaded with
 * the language pack) those count as well as the English ones, keyed as the judge reads the verse
 * (echo.ts wordKey: a Vietnamese word keeps its tone, so "đêm" is not every toneless "dem").
 */
const lexicons = new Map<string, Set<string>>();
export function allusionLexicon(lang = 'en'): Set<string> {
  const b = baseLang(lang);
  // Not cached until the language's card text is there: it arrives with loadPack.
  const ready = b === 'en' || !!getCardText(b);
  const have = lexicons.get(b);
  if (have) return have;
  const lexicon = new Set<string>();
  const names = invocationNames(CARD_CATALOG.filter((c) => c.type === 'Character').map((c) => c.name));
  for (const n of names) if (!n.includes(' ') && letterCount(n) >= 4) lexicon.add(fold(n));
  for (const c of CARD_CATALOG) {
    // A signature phrase (Viola's "not what") is not a word.
    for (const w of signatureWords(c)) if (!w.includes(' ') && letterCount(w) >= 4 && !STOP_WORDS.has(w)) lexicon.add(w);
  }
  if (b !== 'en') {
    // The judge reads a verse word by word: a Vietnamese word of several syllables (vấn đề), or a Thai one ICU cuts in
    // pieces (โรสแมรี), is not one it can meet.
    for (const c of CARD_CATALOG) for (const w of localSignatureWords(c, b)) if (wordsOf(w, b).length === 1) lexicon.add(wordKey(w, b));
    // One-word names only: a longer name's titles (Russian «граф») are not allusions by themselves.
    for (const n of localCharacterNames(b)) if (wordsOf(n, b).length === 1) lexicon.add(wordKey(n, b));
  }
  if (ready) lexicons.set(b, lexicon);
  return lexicon;
}

/**
 * The rule-based judge's split of a round, as the referee reads it: what decides when no model
 * judges, and what bounds the grade path (modelJudge). One function, so that the evaluation derives
 * a stored reading's rules with the code the game runs (src/lib/model-eval.judge.test.ts), and a
 * change here (the lexicon, what the opponent answered) shows against the stored judging cells.
 */
export function rulesSplit(playerVerse: string, opponentVerse: string, lang: string, previousPlayerVerse?: string): JudgeSplit {
  return rulesJudge(playerVerse, opponentVerse, lang, allusionLexicon(lang), previousPlayerVerse);
}

async function margins(verseA: string, verseB: string, lang: string): Promise<Margins> {
  const out = {} as Margins;
  for (const c of CRITERIA) {
    const [a, b] = await answerScores(compareMessages(verseA, verseB, c, languageName(lang)), ['A', 'B']);
    out[c] = a - b;
  }
  return out;
}

async function grades(verse: string, lang: string): Promise<Margins> {
  const out = {} as Margins;
  for (const c of CRITERIA) out[c] = expectedGrade(await answerScores(gradeMessages(verse, c, languageName(lang), lang), GRADE_ANSWERS));
  return out;
}

/**
 * What the model answered, before any threshold: for the compare path the lean towards A in each
 * order, for the grade path each verse's expected grade and the rules' split it is bounded by (or
 * that the round went to the rules because a line was left unread). The evaluation keeps these
 * (scripts/model-eval), so that a change to how an answer is read, not only to what is asked,
 * shows against its stored cells (src/lib/model-eval.judge.test.ts).
 */
export type JudgeReading =
  | { method: 'compare'; forward: Margins; reversed: Margins }
  | { method: 'grade'; unread: true; rules: JudgeSplit }
  | { method: 'grade'; unread?: false; player: Margins; opponent: Margins; rules: JudgeSplit };

/** The verdict a reading amounts to: the arithmetic modelJudge applies, and the evaluation re-applies. */
export function verdictOf(reading: JudgeReading): JudgeSplit {
  if (reading.method === 'compare') return combineMargins(reading.forward, reading.reversed);
  if (reading.unread) return { ...reading.rules, reason: 'unread' };
  return boundedByRules(reading.player, reading.opponent, reading.rules);
}

/**
 * The loaded model's judgement, by the method that model is read with. No check of whether the
 * model should judge this language: `referee` makes that check, and the evaluation that decides
 * it (scripts/model-eval) calls this. `previousPlayerVerse` is what the opponent's verse answers,
 * when it answers one (a model wrote it to); the rule-based judge then compares the comebacks of
 * both (judge.ts rulesJudge). `onReading` receives what the model answered, before any threshold.
 */
export async function modelJudge(
  playerVerse: string, opponentVerse: string, lang: string, previousPlayerVerse?: string, onReading?: (r: JudgeReading) => void,
): Promise<JudgeSplit> {
  let reading: JudgeReading;
  if (brainInfo()?.judge === 'grade') {
    // Graded alone, a verse can tell the grader what to answer: the grader never reads such a
    // line, and decides only what the rules split, by a measured margin (judge.ts gradeMessages).
    const rules = rulesSplit(playerVerse, opponentVerse, lang, previousPlayerVerse);
    // A line left out must not help its verse (an empty verse is not a better one): a round
    // with a line the grader would not read is decided by the rules alone, for both sides.
    if (judgeLines(playerVerse, lang).left.length || judgeLines(opponentVerse, lang).left.length) reading = { method: 'grade', unread: true, rules };
    else reading = { method: 'grade', player: await grades(playerVerse, lang), opponent: await grades(opponentVerse, lang), rules };
  } else {
    const forward = await margins(playerVerse, opponentVerse, lang);
    const reversed = await margins(opponentVerse, playerVerse, lang);
    reading = { method: 'compare', forward, reversed };
  }
  onReading?.(reading);
  return verdictOf(reading);
}

/** Will the loaded model judge a duel in this language, or will the rules? */
export function judgedByModel(lang: string): boolean {
  return isBrainLoaded() && modelJudges(brainInfo(), lang);
}

/**
 * `previousPlayerVerse` is what the opponent's verse answers, when it answers one (see modelJudge).
 */
export async function referee(playerVerse: string, opponentVerse: string, lang: string, previousPlayerVerse?: string): Promise<JudgeSplit> {
  if (judgedByModel(lang)) {
    try {
      return await modelJudge(playerVerse, opponentVerse, lang, previousPlayerVerse);
    } catch (err) {
      console.error('[referee] model judging failed; using the rules', err);
    }
  }
  return rulesSplit(playerVerse, opponentVerse, lang, previousPlayerVerse);
}
