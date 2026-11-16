/**
 * The referee: asks the loaded model to compare two verses, or falls back to
 * the rule-based comparison when no model is loaded or a reading fails.
 */
import { CARD_CATALOG } from '../cards';
import { answerScores, brainInfo, isBrainLoaded } from '../brain';
import { invocationNames, signatureWords } from './devices';
import type { JudgeSplit } from './duel';
import {
  CRITERIA, GRADE_ANSWERS, checkedByRules, combineGrades, combineMargins, compareMessages, expectedGrade, gradeMessages, rulesJudge, type Margins,
} from './judge';
import { languageName } from './opponent';
import { STOP_WORDS, fold, letterCount } from './text';

/**
 * Words that count as literary allusion for the rule-based judge: the names a
 * character is called by, and the telling words of every card's line. Everyday
 * words in those lines ("that", "this", "with", "have") are not allusions.
 */
let lexicon: Set<string> | null = null;
export function allusionLexicon(): Set<string> {
  if (!lexicon) {
    lexicon = new Set<string>();
    const names = invocationNames(CARD_CATALOG.filter((c) => c.type === 'Character').map((c) => c.name));
    for (const n of names) if (!n.includes(' ') && letterCount(n) >= 4) lexicon.add(fold(n));
    for (const c of CARD_CATALOG) {
      for (const w of signatureWords(c)) if (letterCount(w) >= 4 && !STOP_WORDS.has(w)) lexicon.add(w);
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

/** `previousPlayerVerse` is what the opponent's verse answers; the rule-based judge reads it for the comeback. */
export async function referee(playerVerse: string, opponentVerse: string, lang: string, previousPlayerVerse?: string): Promise<JudgeSplit> {
  if (isBrainLoaded()) {
    try {
      if (brainInfo()?.judge === 'grade') {
        // Graded alone, a verse can tell the grader what to answer; the rules may veto (judge.ts gradeMessages).
        const model = combineGrades(await grades(playerVerse, lang), await grades(opponentVerse, lang));
        return checkedByRules(model, rulesJudge(playerVerse, opponentVerse, lang, allusionLexicon(), previousPlayerVerse));
      }
      const forward = await margins(playerVerse, opponentVerse, lang);
      const reversed = await margins(opponentVerse, playerVerse, lang);
      return combineMargins(forward, reversed);
    } catch (err) {
      console.error('[referee] model judging failed; using the rules', err);
    }
  }
  return rulesJudge(playerVerse, opponentVerse, lang, allusionLexicon(), previousPlayerVerse);
}
