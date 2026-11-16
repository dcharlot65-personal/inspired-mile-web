/**
 * The referee: asks the loaded model to compare two verses, or falls back to
 * the rule-based comparison when no model is loaded, when the loaded model has
 * not been shown to judge verse in the duel's language (MODELS[..].judgesIn in
 * ../brain, measured: docs/language/MODEL-EVAL.md), or when a reading fails.
 */
import { CARD_CATALOG } from '../cards';
import { answerScores, brainInfo, isBrainLoaded, modelJudges } from '../brain';
import type { JudgeSplit } from './duel';
import {
  CRITERIA, GRADE_ANSWERS, combineGrades, combineMargins, compareMessages, expectedGrade, gradeMessages, rulesJudge, type Margins,
} from './judge';
import { languageName } from './opponent';
import { contentWords, fold, wordSpan, wordsOf } from './text';

/** Words that count as literary allusion for the rule-based judge: names and quotation words. */
let lexicon: Set<string> | null = null;
export function allusionLexicon(): Set<string> {
  if (!lexicon) {
    lexicon = new Set<string>();
    for (const c of CARD_CATALOG) {
      for (const w of wordsOf(c.name)) if (wordSpan(w) >= 4) lexicon.add(fold(w));
      for (const w of contentWords(c.quote)) lexicon.add(fold(w));
    }
  }
  return lexicon;
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
  for (const c of CRITERIA) out[c] = expectedGrade(await answerScores(gradeMessages(verse, c, languageName(lang)), GRADE_ANSWERS));
  return out;
}

/**
 * The loaded model's judgement, by the method that model is read with. No check of
 * whether the model should judge this language: `referee` makes that check, and the
 * evaluation that decides it (scripts/model-eval) calls this.
 */
export async function modelJudge(playerVerse: string, opponentVerse: string, lang: string): Promise<JudgeSplit> {
  if (brainInfo()?.judge === 'grade') {
    return combineGrades(await grades(playerVerse, lang), await grades(opponentVerse, lang));
  }
  const forward = await margins(playerVerse, opponentVerse, lang);
  const reversed = await margins(opponentVerse, playerVerse, lang);
  return combineMargins(forward, reversed);
}

/** Will the loaded model judge a duel in this language, or will the rules? */
export function judgedByModel(lang: string): boolean {
  return isBrainLoaded() && modelJudges(brainInfo(), lang);
}

export async function referee(playerVerse: string, opponentVerse: string, lang: string): Promise<JudgeSplit> {
  if (judgedByModel(lang)) {
    try {
      return await modelJudge(playerVerse, opponentVerse, lang);
    } catch (err) {
      console.error('[referee] model judging failed; using the rules', err);
    }
  }
  return rulesJudge(playerVerse, opponentVerse, lang, allusionLexicon());
}
