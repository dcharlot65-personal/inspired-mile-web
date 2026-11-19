import type { Page } from '@playwright/test';

/**
 * A stand-in for the model library (Transformers.js) for the browser tests, with navigator.gpu
 * made to report an adapter: loadBrain's own success path runs and brainInfo() is the real MODELS
 * entry. It answers the judge's next-token reading (the same lean to "A" in both orders, so every
 * criterion is a split, decided by the model) and counts each load, each verse it is asked to
 * write and each reading.
 */
const JUDGING_STUB = `
const V = 256;
const stub = (globalThis.__stub ??= { loads: [], generations: 0, readings: 0 });
export async function pipeline(task, id) {
  stub.loads.push(id);
  const g = async () => { stub.generations++; return [{ generated_text: [{ role: 'assistant', content: 'The moon is up and I am here' }] }]; };
  g.tokenizer = { apply_chat_template: () => ({}), encode: (a) => [a.charCodeAt(0) % V] };
  // The same lean to "A" in both orders: no preference, so every criterion is a split, by the model.
  g.model = async () => { stub.readings++; const data = new Float32Array(V); data[65] = 2; return { logits: { dims: [1, 1, V], data } }; };
  g.dispose = async () => {};
  return g;
}
export class TextStreamer {}
export const env = { backends: { onnx: { wasm: { wasmPaths: {
  mjs: 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs',
  wasm: 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm',
} } } } };`;

export async function standInModel(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => ({ requestAdapter: async () => ({ features: new Set(['shader-f16']) }) }) });
  });
  await page.route(/huggingface[_/]transformers/, (route) => route.fulfill({ contentType: 'text/javascript', body: JUDGING_STUB }));
}

/** Set a model's lists in the page's own brain module (the one its scripts imported). */
export async function setLists(page: Page, tier: 'grand' | 'standard' | 'lite', writesIn: string[], judgesIn: string[]) {
  await page.evaluate(async ({ tier, writesIn, judgesIn }) => {
    const path = '/src/lib/brain.ts';
    const brain = await import(/* @vite-ignore */ path);
    // A different copy of the module would hold no model: the lists set there would change nothing.
    if (brain.brainInfo()?.tier !== tier) throw new Error(`the brain module reached here holds ${brain.brainInfo()?.tier ?? 'no model'}, not ${tier}`);
    Object.assign(brain.MODELS[tier], { writesIn, judgesIn });
  }, { tier, writesIn, judgesIn });
}

export const stubCount = (page: Page) => page.evaluate(() => ({ ...((globalThis as any).__stub ?? { loads: [], generations: 0, readings: 0 }) }));
