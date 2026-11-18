/**
 * The referee: asks the loaded model to compare two verses, or falls back to
 * the rule-based comparison when no model is loaded or a reading fails.
 */
import { CARD_CATALOG } from '../cards';
import { getCardText } from '../cards-i18n';
import { answerScores, brainInfo, isBrainLoaded } from '../brain';
import { invocationNames, signatureWords } from './devices';
import type { JudgeSplit } from './duel';
import {
  CRITERIA, GRADE_ANSWERS, boundedByRules, combineMargins, compareMessages, expectedGrade, gradeMessages, judgeLines, rulesJudge, type Margins,
} from './judge';
import { localCharacterNames, localSignatureWords } from './echo';
import { baseLang } from './lang';
import { languageName } from './opponent';
import { STOP_WORDS, fold, letterCount, wordsOf } from './text';

/**
 * Words that count as literary allusion for the rule-based judge: the names a
 * character is called by, and the telling words of every card's line. Everyday
 * words in those lines ("that", "this", "with", "have") are not allusions.
 * In a language that has its own names and lines for the cards (src/lib/cards-i18n, loaded with
 * the language pack) those count as well as the English ones.
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
    for (const c of CARD_CATALOG) for (const w of localSignatureWords(c, b)) lexicon.add(fold(w));
    // One-word names only: a longer name's titles (Russian «граф») are not allusions by themselves.
    for (const n of localCharacterNames(b)) if (wordsOf(n, b).length === 1) lexicon.add(fold(n));
  }
  if (ready) lexicons.set(b, lexicon);
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
  for (const c of CRITERIA) out[c] = expectedGrade(await answerScores(gradeMessages(verse, c, languageName(lang), lang), GRADE_ANSWERS));
  return out;
}

/**
 * `previousPlayerVerse` is what the opponent's verse answers, when it answers one (a model
 * wrote it to); the rule-based judge then compares the comebacks of both (judge.ts rulesJudge).
 */
export async function referee(playerVerse: string, opponentVerse: string, lang: string, previousPlayerVerse?: string): Promise<JudgeSplit> {
  if (isBrainLoaded()) {
    try {
      if (brainInfo()?.judge === 'grade') {
        // Graded alone, a verse can tell the grader what to answer: the grader never reads such a
        // line, and decides only what the rules split, by a measured margin (judge.ts gradeMessages).
        const rules = rulesJudge(playerVerse, opponentVerse, lang, allusionLexicon(lang), previousPlayerVerse);
        // A line left out must not help its verse (an empty verse is not a better one): a round
        // with a line the grader would not read is decided by the rules alone, for both sides.
        if (judgeLines(playerVerse, lang).left.length || judgeLines(opponentVerse, lang).left.length) return { ...rules, reason: 'unread' };
        return boundedByRules(await grades(playerVerse, lang), await grades(opponentVerse, lang), rules);
      }
      const forward = await margins(playerVerse, opponentVerse, lang);
      const reversed = await margins(opponentVerse, playerVerse, lang);
      return combineMargins(forward, reversed);
    } catch (err) {
      console.error('[referee] model judging failed; using the rules', err);
    }
  }
  return rulesJudge(playerVerse, opponentVerse, lang, allusionLexicon(lang), previousPlayerVerse);
}
