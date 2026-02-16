/**
 * Content Generation — Uses the already-loaded WebLLM engine to generate
 * dynamic trivia questions and quote challenges.
 * Reuses the same Llama 3.2 3B model loaded for battles.
 * Falls back to hardcoded banks if LLM not loaded or generation fails.
 */

import { getEngine, isLoaded } from './thespian-llm';
import type { TriviaQuestion } from './trivia';
import type { QuoteChallenge } from './challenges';

// --- Session history to avoid repeats ---
const usedTriviaQuestions = new Set<string>();
const usedChallenges = new Set<string>();

// --- Trivia Generation ---

const TRIVIA_SYSTEM_PROMPT = `You are a Shakespeare trivia generator. Generate a multiple-choice trivia question about Shakespeare's plays, characters, quotes, or history.

You MUST respond with ONLY valid JSON in this exact format, nothing else:
{"question":"The question text","options":["Correct answer","Wrong 1","Wrong 2","Wrong 3"],"correctIndex":0,"difficulty":"easy"}

Rules:
- The correct answer MUST be at index 0 in the options array
- difficulty must be one of: "easy", "medium", "hard"
- Questions should be educational and accurate
- Do NOT include any text outside the JSON object
- Do NOT use markdown formatting`;

async function generateTriviaQuestion(
  difficulty?: 'easy' | 'medium' | 'hard',
): Promise<TriviaQuestion | null> {
  const engine = getEngine();
  if (!engine) return null;

  const difficultyHint = difficulty
    ? `Generate a ${difficulty} difficulty question.`
    : 'Generate a question of random difficulty.';

  try {
    const reply = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: TRIVIA_SYSTEM_PROMPT },
        { role: 'user', content: `${difficultyHint} Make it unique and interesting.` },
      ],
      temperature: 0.9,
      max_tokens: 200,
    });

    const content = reply.choices[0]?.message?.content || '';
    return parseTriviaResponse(content);
  } catch (err) {
    console.error('[content-gen] Trivia generation failed:', err);
    return null;
  }
}

function parseTriviaResponse(raw: string): TriviaQuestion | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    if (
      typeof parsed.question !== 'string' ||
      !Array.isArray(parsed.options) ||
      parsed.options.length !== 4 ||
      typeof parsed.correctIndex !== 'number' ||
      !['easy', 'medium', 'hard'].includes(parsed.difficulty)
    ) {
      return null;
    }

    // Check for duplicates
    if (usedTriviaQuestions.has(parsed.question)) return null;
    usedTriviaQuestions.add(parsed.question);

    return {
      question: parsed.question,
      options: parsed.options,
      correctIndex: parsed.correctIndex,
      difficulty: parsed.difficulty,
    };
  } catch {
    return null;
  }
}

export async function generateTriviaSet(count: number): Promise<TriviaQuestion[]> {
  const questions: TriviaQuestion[] = [];
  const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'easy', 'medium', 'medium', 'hard'];

  for (let i = 0; i < count; i++) {
    const diff = difficulties[i % difficulties.length];
    const q = await generateTriviaQuestion(diff);
    if (q) {
      questions.push(q);
    }
  }

  return questions;
}

// --- Challenge Generation ---

const CHALLENGE_SYSTEM_PROMPT = `You are a Shakespeare quote challenge generator. Generate a fill-in-the-blank challenge from a real Shakespeare quote.

You MUST respond with ONLY valid JSON in this exact format, nothing else:
{"fullQuote":"The complete original quote","displayQuote":"The quote with ___ replacing missing words","missingWords":["word1","word2"],"play":"Play Name","character":"Character Name","difficulty":"medium"}

Rules:
- Use REAL Shakespeare quotes only
- Replace 1-3 key words with ___ in displayQuote
- missingWords array must contain the removed words in order
- difficulty must be one of: "easy", "medium", "hard"
- Do NOT include any text outside the JSON object`;

export async function generateChallenge(): Promise<QuoteChallenge | null> {
  const engine = getEngine();
  if (!engine) return null;

  try {
    const reply = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: CHALLENGE_SYSTEM_PROMPT },
        { role: 'user', content: 'Generate a unique Shakespeare quote challenge. Choose a quote that is not overly common.' },
      ],
      temperature: 0.9,
      max_tokens: 200,
    });

    const content = reply.choices[0]?.message?.content || '';
    return parseChallengeResponse(content);
  } catch (err) {
    console.error('[content-gen] Challenge generation failed:', err);
    return null;
  }
}

function parseChallengeResponse(raw: string): QuoteChallenge | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    if (
      typeof parsed.fullQuote !== 'string' ||
      typeof parsed.displayQuote !== 'string' ||
      !Array.isArray(parsed.missingWords) ||
      parsed.missingWords.length === 0 ||
      typeof parsed.play !== 'string' ||
      typeof parsed.character !== 'string' ||
      !['easy', 'medium', 'hard'].includes(parsed.difficulty)
    ) {
      return null;
    }

    // Check for duplicates
    if (usedChallenges.has(parsed.fullQuote)) return null;
    usedChallenges.add(parsed.fullQuote);

    return {
      fullQuote: parsed.fullQuote,
      displayQuote: parsed.displayQuote,
      missingWords: parsed.missingWords,
      play: parsed.play,
      character: parsed.character,
      difficulty: parsed.difficulty,
    };
  } catch {
    return null;
  }
}

// --- Availability check ---

export function isContentGenAvailable(): boolean {
  return isLoaded();
}
