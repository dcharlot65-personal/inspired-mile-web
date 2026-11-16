/**
 * Where this site serves the runtime files that libraries would otherwise fetch from a
 * public CDN in the player's browser. The values are filled in at build time by
 * scripts/self-hosted-runtime.mjs (an Astro integration), which also ships the files.
 *
 * Outside an Astro build (unit tests) there are none, and anything that needs one must
 * refuse to run: falling back to the library's CDN default is exactly what this prevents.
 */

export interface SelfHosted {
  /** onnxruntime-web files for Transformers.js (the opponent, the judge, the ear). */
  ort: string;
  /** The file names shipped under `ort`. */
  ortFiles: string[];
  /** onnxruntime-web files for kokoro-js (the voice), which carries its own copy. */
  kokoroOrt: string;
  /** Draco and KTX2 decoders for model-viewer. */
  draco: string;
  basis: string;
}

declare const __SELF_HOSTED__: SelfHosted | undefined;

export const SELF_HOSTED: SelfHosted | null = typeof __SELF_HOSTED__ !== 'undefined' ? (__SELF_HOSTED__ as SelfHosted) : null;

export function selfHosted(): SelfHosted {
  if (!SELF_HOSTED) throw new Error('Self-hosted runtime paths are missing from this build (scripts/self-hosted-runtime.mjs); refusing to load from a CDN.');
  return SELF_HOSTED;
}
