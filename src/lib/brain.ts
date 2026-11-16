/**
 * The brain: a language model that runs entirely in the browser.
 *
 * Nothing here calls a server for inference. Models are downloaded once from
 * the Hugging Face hub, cached by the browser, and run on the device through
 * Transformers.js on WebGPU. The download is the only request to another origin:
 * the runtime's WebAssembly and loader come from this site (model-runtime.ts).
 *
 * Which model loads is decided by what the device can do, not by which
 * browser it is:
 *   grand     Gemma 4 E2B      desktops with memory to spare       ~3 GB    writes and judges best
 *   standard  LFM3-1.7B        any WebGPU desktop                  ~1.1 GB  writes and judges
 *   lite      LFM2.5-350M      phones and tablets, low memory      ~0.3 GB  judges only
 *   none      no model         no WebGPU: the built-in rules run the opponent
 */

import { loadTransformers } from './model-runtime';
import { protectStorage } from './pwa';

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
  judge: JudgeMethod;
  /**
   * Languages in which it writes the opponent's verse, and languages in which it judges.
   * Both are measured, not taken from the model's card: docs/language/MODEL-EVAL.md has
   * the method, the thresholds and the table. In a language missing from `writesIn` the
   * opponent plays written verse; in one missing from `judgesIn` the judging is by rule.
   * A language that was not measured is not in either list.
   *
   * The lists are copied from docs/language/model-eval/decisions.json, which
   * scripts/model-eval/analyze.mjs derives from the result files beside it.
   * src/lib/model-eval.test.ts fails when they differ, and when that file no longer
   * follows from the results.
   */
  writesIn: readonly string[];
  judgesIn: readonly string[];
}

export const MODELS: Record<Exclude<Tier, 'none'>, ModelSpec> = {
  grand: {
    tier: 'grand', id: 'onnx-community/gemma-4-E2B-it-ONNX', dtype: 'q4f16', label: 'Gemma 4 E2B', megabytes: 3100, judge: 'compare',
    // docs/language/model-eval/cells/grand.<lang>.write.json
    writesIn: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru'],
    // docs/language/model-eval/cells/grand.<lang>.judge.json
    judgesIn: ['en', 'fr', 'de', 'pt', 'ru', 'ar', 'hi'],
  },
  standard: {
    tier: 'standard', id: 'onnx-community/LFM3-1.7B-ONNX', dtype: 'q4f16', label: 'LFM3 1.7B', megabytes: 1090, judge: 'compare',
    // docs/language/model-eval/cells/standard.<lang>.write.json
    writesIn: [],
    // docs/language/model-eval/cells/standard.<lang>.judge.json
    judgesIn: [],
  },
  lite: {
    tier: 'lite', id: 'LiquidAI/LFM2.5-350M-ONNX', dtype: 'q4', label: 'LFM2.5 350M', megabytes: 295, judge: 'grade',
    // docs/language/model-eval/cells/lite.<lang>.write.json
    writesIn: [],
    // docs/language/model-eval/cells/lite.<lang>.judge.json
    judgesIn: [],
  },
};

const base = (lang: string) => lang.toLowerCase().split('-')[0];

/** Does this model write the opponent's verse in this language? */
export function modelWrites(spec: ModelSpec | null | undefined, lang: string): boolean {
  return !!spec && spec.writesIn.includes(base(lang));
}

/** Does this model judge verse in this language? */
export function modelJudges(spec: ModelSpec | null | undefined, lang: string): boolean {
  return !!spec && spec.judgesIn.includes(base(lang));
}

/**
 * Is the model used in any language at all? One that is not would be a download that changes
 * nothing, so the pages never offer it and never load it on their own (only `?brain=<tier>`,
 * which the tests use, loads it anyway).
 */
export function usedAnywhere(spec: ModelSpec | null | undefined): boolean {
  return !!spec && (spec.writesIn.length > 0 || spec.judgesIn.length > 0);
}

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
  // Headsets count as handheld: a Quest reports a desktop Linux user agent in its browser's
  // desktop mode, and Vision Pro reports a Mac with touch, but both have a phone's memory ceiling.
  cap.handheld =
    !!nav.userAgentData?.mobile ||
    /Android|iPhone|iPad|iPod|OculusBrowser|Quest|Pico/i.test(nav.userAgent) ||
    (nav.maxTouchPoints > 1 && /Macintosh/.test(nav.userAgent));
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

/**
 * The models to offer this device, best first: those it can run, less any that is used in no
 * language (usedAnywhere). Empty when there is none, and then the written opponent plays.
 */
export function modelsToOffer(cap: Capability): ModelSpec[] {
  const tier = chooseTier(cap);
  if (tier === 'none') return [];
  const runnable = canOfferGrand(cap) ? [MODELS.grand, MODELS.standard] : [MODELS[tier]];
  return runnable.filter(usedAnywhere);
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
  // Not a bare import: loadTransformers() makes the runtime files come from this site.
  const T = await loadTransformers();
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
        // The weights are in browser storage now: ask the browser not to evict them.
        // Not awaited, so play never waits on the answer.
        void protectStorage('model');
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

/** How many of the loaded model's tokens a text is. Used to time generation (scripts/model-eval). */
export function countTokens(text: string): number {
  if (!loaded) throw new Error('No model is loaded');
  return loaded.generator.tokenizer.encode(text, { add_special_tokens: false }).length;
}
