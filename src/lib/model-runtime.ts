/**
 * Transformers.js, set up so that nothing but model weights comes from another origin.
 *
 * Left alone, the library fetches onnxruntime-web's WebAssembly and its loader script from
 * cdn.jsdelivr.net the first time a model starts: executable code from a third party, on
 * the page that holds the verse and the microphone. This site ships those files itself
 * (scripts/self-hosted-runtime.mjs). Every model load must go through loadTransformers().
 *
 * Model weights still come from the Hugging Face hub; the privacy policy says so.
 */

import { selfHosted } from './self-hosted';

let ready: Promise<any> | null = null;

function fileName(url: unknown): string | null {
  if (typeof url !== 'string' || url.startsWith('blob:')) return null;
  return url.slice(url.lastIndexOf('/') + 1);
}

export function loadTransformers(): Promise<any> {
  ready ??= (async () => {
    const { ort, ortFiles } = selfHosted();
    const T: any = await import('@huggingface/transformers');
    const wasm = T.env?.backends?.onnx?.wasm;
    if (!wasm) throw new Error('Transformers.js has no ONNX WebAssembly settings; refusing to load from its default CDN.');
    // The library has already chosen which build suits this browser and pointed it at
    // jsDelivr. Keep its choice of file, change where it comes from.
    const chosen = wasm.wasmPaths && typeof wasm.wasmPaths === 'object' ? wasm.wasmPaths : {};
    const mjs = fileName(chosen.mjs) ?? 'ort-wasm-simd-threaded.asyncify.mjs';
    const binary = fileName(chosen.wasm) ?? 'ort-wasm-simd-threaded.asyncify.wasm';
    for (const name of [mjs, binary]) {
      if (!ortFiles.includes(name)) throw new Error(`This site does not ship the model runtime file ${name}; refusing to load it from a CDN.`);
    }
    wasm.wasmPaths = { mjs: ort + mjs, wasm: ort + binary };
    return T;
  })();
  return ready;
}
