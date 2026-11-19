/**
 * The symbols Kokoro-82M v1.0's tokenizer knows, in its id order (the special "$", id 0, left
 * out). From onnx-community/Kokoro-82M-v1.0-ONNX, tokenizer.json at revision
 * 1939ad2a8e416c0acfeecc08a694d14ef25f2231 (sha256
 * 77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34). The tokenizer deletes any
 * other character before it reads a string, so a symbol the voice writes that is not here is
 * silently not said: g2p-en.test.ts holds every output to this set.
 */
export const KOKORO_VOCAB = ";:,.!?\u2014\u2026\"()\u201c\u201d \u0303\u02a3\u02a5\u02a6\u02a8\u1d5d\uab67AIOQSTWY\u1d4aabcdefhijklmnopqrstuvwxyz\u0251\u0250\u0252\u00e6\u03b2\u0254\u0255\u00e7\u0256\u00f0\u02a4\u0259\u025a\u025b\u025c\u025f\u0261\u0265\u0268\u026a\u029d\u026f\u0270\u014b\u0273\u0272\u0274\u00f8\u0278\u03b8\u0153\u0279\u027e\u027b\u0281\u027d\u0282\u0283\u0288\u02a7\u028a\u028b\u028c\u0263\u0264\u03c7\u028e\u0292\u0294\u02c8\u02cc\u02d0\u02b0\u02b2\u2193\u2192\u2197\u2198\u1d7b";
