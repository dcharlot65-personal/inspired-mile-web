/**
 * The brain: a language model that runs entirely in the browser.
 *
 * Nothing here calls a server for inference. Models are downloaded once from
 * the Hugging Face hub, cached by the browser, and run on the device through
 * Transformers.js on WebGPU.
 *
 * Which model loads is decided by what the device can do, not by which
 * browser it is:
 *   grand     Gemma 4 E2B      desktops with memory to spare       ~3 GB    writes and judges best
 *   standard  LFM3-1.7B        any WebGPU desktop                  ~1.1 GB  writes and judges
 *   lite      LFM2.5-350M      phones and tablets, low memory      ~0.3 GB  judges only
 *   none      no model         no WebGPU: the built-in rules run the opponent
 */

export type Tier = 'grand' | 'standard' | 'lite' | 'none';

/**
 * How a model is asked to judge. Measured on eight pairs with an obviously
 * better verse, four criteria each (scripts/judge-eval.mjs, 2026-11-16):
 *
 *                      compare (both orders)   grade (one verse at a time)
 *   Gemma 4 E2B              31 / 32                  31 / 32
 *   LFM3 1.7B                27 / 32                  21 / 32
 *   LFM2.5 350M               9 / 32                  25 / 32
 *
 * The small model cannot compare two verses at all, but it can grade one.
 */
export type JudgeMethod = 'compare' | 'grade';

export interface ModelSpec {
  tier: Exclude<Tier, 'none'>;
  id: string;
  dtype: string;
  label: string;
  /** Approximate download, for the consent prompt. */
  megabytes: number;
  /** Languages the model's card names. */
  languages: string[];
  judge: JudgeMethod;
  /**
   * Can it write the opponent's verse? Measured in play (tests/model, 2026-11-16):
   * Gemma 4 E2B and LFM3 both wrote a correct acrostic; LFM2.5 350M produced
   * "Acrostic Verse: The challenge begins with words". Where this is false the
   * opponent plays written verses and the model only judges.
   */
  writes: boolean;
}

const LFM_LANGS = ['en', 'ar', 'zh', 'fr', 'de', 'it', 'ja', 'ko', 'pt', 'es', 'vi', 'th', 'id', 'hi', 'ru', 'pl'];

// Gemma's card says "35+ languages out of the box" without naming them; these are the
// ones the game offers, the same set LFM3 names, until each is tested in play.
export const MODELS: Record<Exclude<Tier, 'none'>, ModelSpec> = {
  grand: { tier: 'grand', id: 'onnx-community/gemma-4-E2B-it-ONNX', dtype: 'q4f16', label: 'Gemma 4 E2B', megabytes: 3100, languages: LFM_LANGS, judge: 'compare', writes: true },
  standard: { tier: 'standard', id: 'onnx-community/LFM3-1.7B-ONNX', dtype: 'q4f16', label: 'LFM3 1.7B', megabytes: 1090, languages: LFM_LANGS, judge: 'compare', writes: true },
  lite: { tier: 'lite', id: 'LiquidAI/LFM2.5-350M-ONNX', dtype: 'q4', label: 'LFM2.5 350M', megabytes: 295, languages: ['en', 'ar', 'zh', 'fr', 'de', 'ja', 'ko', 'es'], judge: 'grade', writes: false },
};

export interface Capability {
  webgpu: boolean;
  /** 16-bit float shaders, needed by the q4f16 weights. */
  f16: boolean;
  /** Device memory in GB as the browser reports it, or null when it does not say. */
  memoryGb: number | null;
  /** Phone or tablet: tabs are killed at a low memory ceiling. */
  handheld: boolean;
}

export async function detectCapability(): Promise<Capability> {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as any);
  const cap: Capability = { webgpu: false, f16: false, memoryGb: nav?.deviceMemory ?? null, handheld: false };
  if (!nav) return cap;
  cap.handheld = !!nav.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(nav.userAgent) || (nav.maxTouchPoints > 1 && /Macintosh/.test(nav.userAgent));
  try {
    const adapter = await nav.gpu?.requestAdapter();
    if (adapter) {
      cap.webgpu = true;
      cap.f16 = adapter.features.has('shader-f16');
    }
  } catch {
    /* no adapter */
  }
  return cap;
}

/**
 * The tier a device should be offered first. A handheld never starts on a
 * large model, and the grand tier is always the player's choice, never automatic.
 */
export function chooseTier(cap: Capability): Tier {
  if (!cap.webgpu) return 'none';
  if (cap.handheld) return 'lite';
  if (!cap.f16) return 'lite';
  if (cap.memoryGb !== null && cap.memoryGb < 8) return 'lite';
  return 'standard';
}

/** Can this device be offered the grand tier as an option? */
export function canOfferGrand(cap: Capability): boolean {
  return cap.webgpu && cap.f16 && !cap.handheld && (cap.memoryGb === null || cap.memoryGb >= 8);
}

export type Role = 'system' | 'user' | 'assistant';
export interface Message {
  role: Role;
  content: string;
}

export interface LoadProgress {
  /** 0 to 100 across all files. */
  percent: number;
  text: string;
}

interface Loaded {
  spec: ModelSpec;
  generator: any;
  TextStreamer: any;
}

let loaded: Loaded | null = null;
let loading: Promise<boolean> | null = null;

export function brainInfo(): ModelSpec | null {
  return loaded?.spec ?? null;
}

export function isBrainLoaded(): boolean {
  return loaded !== null;
}

async function loadSpec(spec: ModelSpec, onProgress?: (p: LoadProgress) => void): Promise<void> {
  const T = await import('@huggingface/transformers');
  const sizes = new Map<string, { loaded: number; total: number }>();
  const generator = await T.pipeline('text-generation', spec.id, {
    dtype: spec.dtype as any,
    device: 'webgpu',
    progress_callback: (p: any) => {
      if (p.status !== 'progress' || !p.total) return;
      sizes.set(p.file, { loaded: p.loaded, total: p.total });
      let done = 0;
      let total = 0;
      for (const s of sizes.values()) {
        done += s.loaded;
        total += s.total;
      }
      // Small files report first, so hold the bar back until the weights are counted.
      const percent = total > 50e6 ? Math.min(99, Math.round((done / total) * 100)) : 0;
      onProgress?.({ percent, text: `Downloading ${spec.label}: ${Math.round(done / 1e6)} of ${Math.round(total / 1e6)} MB` });
    },
  });
  loaded = { spec, generator, TextStreamer: T.TextStreamer };
}

/**
 * Load the model for a tier. If the standard model fails (out of memory, a
 * driver fault), the lite model is tried before giving up.
 */
export function loadBrain(tier: Exclude<Tier, 'none'>, onProgress?: (p: LoadProgress) => void): Promise<boolean> {
  if (loaded) return Promise.resolve(true);
  if (loading) return loading;
  loading = (async () => {
    const order = tier === 'grand' ? [MODELS.grand, MODELS.standard, MODELS.lite] : tier === 'standard' ? [MODELS.standard, MODELS.lite] : [MODELS.lite];
    for (const spec of order) {
      try {
        await loadSpec(spec, onProgress);
        onProgress?.({ percent: 100, text: `${spec.label} ready` });
        return true;
      } catch (err) {
        console.error(`[brain] ${spec.id} failed to load`, err);
      }
    }
    return false;
  })();
  loading.finally(() => {
    loading = null;
  });
  return loading;
}

export async function unloadBrain(): Promise<void> {
  const l = loaded;
  loaded = null;
  try {
    await l?.generator?.dispose?.();
  } catch {
    /* already gone */
  }
}

export interface GenerateOptions {
  maxTokens?: number;
  /** 0 means greedy. */
  temperature?: number;
  onToken?: (text: string) => void;
}

const ENCODE = { enable_thinking: false };

export async function generate(messages: Message[], opts: GenerateOptions = {}): Promise<string> {
  if (!loaded) throw new Error('No model is loaded');
  const { generator, TextStreamer } = loaded;
  const temperature = opts.temperature ?? 0.8;
  const out = await generator(messages, {
    max_new_tokens: opts.maxTokens ?? 96,
    do_sample: temperature > 0,
    ...(temperature > 0 ? { temperature, top_k: 50 } : {}),
    repetition_penalty: 1.1,
    tokenizer_encode_kwargs: ENCODE,
    streamer: opts.onToken
      ? new TextStreamer(generator.tokenizer, { skip_prompt: true, skip_special_tokens: true, callback_function: opts.onToken })
      : undefined,
  });
  return String(out[0].generated_text.at(-1).content ?? '').trim();
}

/**
 * How strongly the model prefers each of several single-token answers as the
 * next token after a prompt. Returns one log-odds-style score per answer.
 *
 * This is what judging is built on: a small model asked "A or B?" mostly
 * answers by position, but the gap between its scores for A and B still
 * carries a preference once the same question is asked in the other order.
 */
export async function answerScores(messages: Message[], answers: string[]): Promise<number[]> {
  if (!loaded) throw new Error('No model is loaded');
  const { generator } = loaded;
  const tok = generator.tokenizer;
  const inputs = tok.apply_chat_template(messages, { add_generation_prompt: true, return_dict: true, tokenizer_kwargs: ENCODE });
  const out = await generator.model(inputs);
  const [, seq, vocab] = out.logits.dims;
  const data = out.logits.data;
  const scores = answers.map((a) => {
    const id = tok.encode(a, { add_special_tokens: false }).at(-1);
    return Number(data[(seq - 1) * vocab + Number(id)]);
  });
  out.logits.dispose?.();
  return scores;
}
