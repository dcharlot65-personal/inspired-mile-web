#!/usr/bin/env node
/**
 * Writes what the voice says for a text to a WAV file (24 kHz, 16-bit mono), with the code the
 * page runs (thespian-voice.ts readAloud: g2p-en.ts's phonemes, Kokoro's generate_from_ids).
 *
 *   node --import ./scripts/sound/ts-resolve.mjs scripts/voice/say.mjs "<text>" out.wav
 *
 * On the build host, after `npm ci` (downloads Kokoro, about 90 MB). Used to give the ear's model
 * test a microphone that speaks in the game's own voice:
 *   FAKE_MIC_WAV=out.wav npx playwright test -c playwright.model.config.ts tests/model/ear.spec.ts
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const [text, out] = process.argv.slice(2);
if (!text || !out) {
  console.error('usage: say.mjs "<text>" out.wav');
  process.exit(2);
}
const { installVoiceLexicon } = await import(join(ROOT, 'src/lib/voice/g2p-en.ts'));
const { readAloud, toWav } = await import(join(ROOT, 'src/lib/thespian-voice.ts'));
installVoiceLexicon((await import(join(ROOT, 'src/lib/voice/lexicon-en.ts'))).default);
const { KokoroTTS } = await import('kokoro-js');
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
const speech = await readAloud(tts, text);
writeFileSync(out, Buffer.from(toWav(speech.samples, speech.sampleRate)));
console.log(`[say] ${speech.phonemes.join(' ')} -> ${out} (${(speech.samples.length / speech.sampleRate).toFixed(2)} s)`);
// onnxruntime-node can abort while tearing down its threads at exit, after the file is written.
process.exit(0);
