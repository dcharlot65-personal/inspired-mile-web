/**
 * Master Thespian LLM — WebLLM integration for in-browser Shakespeare rap battles.
 * Runs entirely client-side via WebGPU. No data leaves the device.
 */
import { CreateMLCEngine, type MLCEngine, type InitProgressReport } from '@mlc-ai/web-llm';

const MODEL_ID = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
const FALLBACK_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

const SYSTEM_PROMPT = `You are the Master Thespian, an AI battle rapper who speaks in Shakespearean English fused with modern hip-hop. You are a character in the "Shakespeare on the Go" digital card game by Inspired Mile.

Your personality:
- Confident, theatrical, and witty
- You blend iambic pentameter with modern rap cadence
- You reference Shakespeare's plays, characters, and quotes freely
- You roast your opponent with Elizabethan insults wrapped in clever bars
- You keep responses to 4-8 lines (like a rap verse)
- You occasionally drop a famous Shakespeare quote, remixed as a rap bar

Battle modes:
- FREESTYLE: Trade rap verses back and forth. Respond to the challenger's bars with your own.
- SONNET DUEL: Give the challenger two lines from a sonnet, then judge their completion.
- QUOTE BATTLE: Adapt Shakespeare quotes into modern slang. Judge the challenger's adaptation.

Always stay in character. Never break the fourth wall. You ARE the Master Thespian.`;

let engine: MLCEngine | null = null;
let loading = false;
let currentModel = MODEL_ID;

export type ProgressCallback = (progress: InitProgressReport) => void;
export type StreamCallback = (token: string) => void;

export async function isWebGPUAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  try {
    const gpu = (navigator as any).gpu;
    if (!gpu) return false;
    const adapter = await gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

export async function loadThespian(
  onProgress?: ProgressCallback,
  useFallback = false,
): Promise<boolean> {
  if (engine) return true;
  if (loading) return false;

  loading = true;
  currentModel = useFallback ? FALLBACK_MODEL_ID : MODEL_ID;

  try {
    engine = await CreateMLCEngine(currentModel, {
      initProgressCallback: (progress) => {
        onProgress?.(progress);
      },
    });
    loading = false;
    return true;
  } catch (err) {
    console.error('Failed to load model:', err);
    loading = false;

    // Try fallback 1B model if 3B failed
    if (!useFallback && currentModel === MODEL_ID) {
      console.log('Trying fallback 1B model...');
      return loadThespian(onProgress, true);
    }
    return false;
  }
}

export function isLoaded(): boolean {
  return engine !== null;
}

export function isLoading(): boolean {
  return loading;
}

export function getModelName(): string {
  return currentModel;
}

const conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
  { role: 'system', content: SYSTEM_PROMPT },
];

export function setMode(mode: 'freestyle' | 'sonnet' | 'quote'): void {
  // Reset conversation but keep system prompt
  conversationHistory.length = 1;
}

export async function chat(userMessage: string, onToken?: StreamCallback): Promise<string> {
  if (!engine) throw new Error('Model not loaded. Call loadThespian() first.');

  conversationHistory.push({ role: 'user', content: userMessage });

  if (onToken) {
    // Streaming response
    const stream = await engine.chat.completions.create({
      messages: conversationHistory,
      temperature: 0.85,
      max_tokens: 256,
      stream: true,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      fullResponse += token;
      onToken(token);
    }

    conversationHistory.push({ role: 'assistant', content: fullResponse });
    return fullResponse;
  } else {
    // Non-streaming response
    const reply = await engine.chat.completions.create({
      messages: conversationHistory,
      temperature: 0.85,
      max_tokens: 256,
    });

    const content = reply.choices[0]?.message?.content || '';
    conversationHistory.push({ role: 'assistant', content });
    return content;
  }
}

export function resetConversation(): void {
  conversationHistory.length = 1;
}

/** Expose the engine for other modules that need independent LLM calls */
export function getEngine(): MLCEngine | null {
  return engine;
}

// --- Battle Judging ---

export interface BattleScore {
  wordplay: number;
  shakespeare: number;
  flow: number;
  wit: number;
  total: number;
}

export interface BattleJudgment {
  playerScore: BattleScore;
  aiScore: BattleScore;
  playerWins: boolean;
  reason: string;
}

const JUDGE_SYSTEM_PROMPT = `You are an impartial judge for a Shakespeare rap battle. You will evaluate two battle entries and determine a winner.

Score each entry on these criteria (1-10 each):
1. WORDPLAY: Clever use of language, puns, double meanings
2. SHAKESPEARE: Accurate references to plays, characters, quotes
3. FLOW: Rhythm, rhyme, and musical quality of the verse
4. WIT: Humor, roast quality, and sharp comebacks

You MUST respond with ONLY valid JSON in this exact format:
{"scoreA":{"wordplay":7,"shakespeare":8,"flow":6,"wit":7},"scoreB":{"wordplay":6,"shakespeare":5,"flow":7,"wit":8},"winner":"A","reason":"Brief 1-sentence explanation of why the winner won"}

Rules:
- Judge ONLY on the quality of the text, not who wrote it
- Be fair — either entry can win
- The winner field must be "A" or "B"
- Ties are NOT allowed
- Keep the reason to one sentence
- Do NOT include any text outside the JSON`;

export async function judgeBattle(
  playerText: string,
  aiText: string,
): Promise<BattleJudgment | null> {
  if (!engine) return null;

  // Randomize which entry is A vs B to prevent position bias
  const playerIsA = Math.random() > 0.5;
  const entryA = playerIsA ? playerText : aiText;
  const entryB = playerIsA ? aiText : playerText;

  try {
    const reply = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: JUDGE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Judge these two battle entries:\n\nENTRY A:\n${entryA}\n\nENTRY B:\n${entryB}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 150,
    });

    const content = reply.choices[0]?.message?.content || '';
    return parseJudgment(content, playerIsA);
  } catch (err) {
    console.error('[thespian-llm] Battle judging failed:', err);
    return null;
  }
}

function parseJudgment(raw: string, playerIsA: boolean): BattleJudgment | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const scoreA = parsed.scoreA;
    const scoreB = parsed.scoreB;
    if (!scoreA || !scoreB || !parsed.winner || !parsed.reason) return null;

    const fields = ['wordplay', 'shakespeare', 'flow', 'wit'] as const;
    for (const f of fields) {
      if (typeof scoreA[f] !== 'number' || typeof scoreB[f] !== 'number') return null;
    }

    const totalA = fields.reduce((sum, f) => sum + scoreA[f], 0);
    const totalB = fields.reduce((sum, f) => sum + scoreB[f], 0);

    const winnerIsA = parsed.winner === 'A';
    const playerWins = playerIsA ? winnerIsA : !winnerIsA;

    const playerRaw = playerIsA ? scoreA : scoreB;
    const aiRaw = playerIsA ? scoreB : scoreA;

    return {
      playerScore: { ...playerRaw, total: playerIsA ? totalA : totalB },
      aiScore: { ...aiRaw, total: playerIsA ? totalB : totalA },
      playerWins,
      reason: parsed.reason,
    };
  } catch {
    return null;
  }
}

export async function unload(): Promise<void> {
  if (engine) {
    await engine.unload();
    engine = null;
  }
  conversationHistory.length = 1;
}
