/**
 * What kokoro-js gets when it imports "phonemizer" (astro.config.mjs aliases the package here).
 *
 * The npm package "phonemizer" is an Emscripten build of eSpeak NG, which is GPL-3.0-or-later;
 * none of it may reach this site. The voice reads English with src/lib/voice/g2p-en.ts and gives
 * Kokoro the phonemes itself (thespian-voice.ts), so kokoro-js's own text path (generate, stream),
 * the only caller of this, must never run: it throws rather than say anything wrongly.
 * scripts/check-no-espeak.mjs fails the build if eSpeak NG is found in dist/ all the same.
 */
// The message must not name the program: the check searches the build for that name.
export async function phonemize(): Promise<string[]> {
  throw new Error('kokoro-js cannot read text on this site: the voice reads English with src/lib/voice/g2p-en.ts and passes Kokoro phonemes.');
}

export async function list_voices(): Promise<never[]> {
  return [];
}
