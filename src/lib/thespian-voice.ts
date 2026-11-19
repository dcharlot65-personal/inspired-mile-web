/**
 * Master Thespian Voice — Kokoro TTS for in-browser speech synthesis.
 * Runs entirely client-side via WASM. No text or audio leaves the device.
 *
 * The first use downloads the Kokoro model and the voice from the Hugging Face hub
 * (download requests: IP address and browser details, nothing that is spoken), and the
 * voice's pronunciation table from this site.
 *
 * English is turned into phonemes here, by src/lib/voice/g2p-en.ts (the CMU Pronouncing
 * Dictionary and public-domain letter-to-sound rules), and Kokoro is given the phonemes
 * (its tokenizer, then generate_from_ids). kokoro-js's own text path ran eSpeak NG (GPL), which
 * this site does not ship: astro.config.mjs swaps the package out, and its stand-in throws.
 */

import { selfHosted } from './self-hosted';
import { loadVoiceLexicon, phonemizeEnglish, splitForKokoro } from './voice/g2p-en';

let tts: any = null;
let loading = false;

// Use a British male voice for the Master Thespian character
export const THESPIAN_VOICE = 'bm_george';
export const THESPIAN_SPEED = 0.95;

export type VoiceProgressCallback = (progress: { text: string; progress: number }) => void;

export async function loadVoice(onProgress?: VoiceProgressCallback): Promise<boolean> {
  if (tts) return true;
  if (loading) return false;

  loading = true;

  try {
    const [{ KokoroTTS, env }, table] = await Promise.all([import('kokoro-js'), loadVoiceLexicon()]);
    if (!table) throw new Error('The voice pronunciation table did not load.');
    // kokoro-js carries its own Transformers.js, which would fetch its WebAssembly runtime
    // from cdn.jsdelivr.net. This site ships it (scripts/self-hosted-runtime.mjs).
    env.wasmPaths = selfHosted().kokoroOrt;
    tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (data: any) => {
        if (onProgress && data.status === 'progress') {
          onProgress({
            text: `Loading voice model: ${Math.round((data.progress || 0))}%`,
            progress: data.progress || 0,
          });
        }
      },
    });
    loading = false;
    return true;
  } catch (err) {
    console.error('Failed to load Kokoro TTS:', err);
    loading = false;
    return false;
  }
}

export function isVoiceLoaded(): boolean {
  return tts !== null;
}

export function isVoiceLoading(): boolean {
  return loading;
}

export interface Speech {
  samples: Float32Array;
  sampleRate: number;
  /** What Kokoro was given, piece by piece (each at most 400 symbols; it reads 510 at most). */
  phonemes: string[];
}

/**
 * English text as audio, in a Kokoro voice (British voices "b…", American "a…"). Needs
 * loadVoice() first. Long text is read in pieces cut at sentence or clause ends and joined.
 */
export async function synthesise(text: string, voice = THESPIAN_VOICE): Promise<Speech> {
  if (!tts) throw new Error('The voice is not loaded (loadVoice).');
  return readAloud(tts, text, voice, THESPIAN_SPEED);
}

/**
 * The reading itself, given a loaded KokoroTTS (the page's, or one loaded in Node by
 * scripts/voice/measure.mjs, which measures exactly this): g2p-en.ts's phonemes, Kokoro's
 * tokenizer, generate_from_ids. kokoro-js's generate() and stream() are never called.
 */
export async function readAloud(model: any, text: string, voice = THESPIAN_VOICE, speed = THESPIAN_SPEED): Promise<Speech> {
  if (!Object.hasOwn(model.voices, voice)) throw new Error(`No Kokoro voice "${voice}".`);
  const pieces = splitForKokoro(phonemizeEnglish(text, { british: voice.startsWith('b') }).ps);
  const parts: Float32Array[] = [];
  let sampleRate = 24000;
  for (const ps of pieces) {
    const { input_ids } = model.tokenizer(ps, { truncation: true });
    const audio = await model.generate_from_ids(input_ids, { voice, speed });
    parts.push(audio.audio as Float32Array);
    sampleRate = audio.sampling_rate;
  }
  const samples = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    samples.set(p, at);
    at += p.length;
  }
  return { samples, sampleRate, phonemes: pieces };
}

/** 16-bit PCM WAV, mono. */
export function toWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return buf;
}

let currentAudio: HTMLAudioElement | null = null;

/**
 * Speak a verse. Kokoro, the in-browser voice model, is good only in English
 * (by its own card), so other languages use the device's local voices.
 */
export async function speak(text: string, voice?: string, lang = 'en'): Promise<void> {
  // Stop any currently playing audio
  stopSpeaking();

  // If TTS is still loading, wait briefly for it to finish
  if (!tts && loading) {
    await new Promise<void>((resolve) => {
      const start = Date.now();
      const check = setInterval(() => {
        if (tts || !loading || Date.now() - start > 8000) {
          clearInterval(check);
          resolve();
        }
      }, 200);
    });
  }

  if (!tts || !lang.startsWith('en')) {
    return speakFallback(text, lang);
  }

  try {
    const { samples, sampleRate } = await synthesise(text, voice || THESPIAN_VOICE);
    const blob = new Blob([toWav(samples, sampleRate)], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    currentAudio = new Audio(url);
    currentAudio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
    };
    await currentAudio.play();
  } catch (err) {
    console.error('TTS generation failed, using fallback:', err);
    return speakFallback(text, lang);
  }
}

/**
 * Speak with one of the device's own voices. Only voices the browser reports
 * as local are used: Chrome also lists network voices, which send the text to
 * a server, and nothing in this game is allowed to do that.
 */
function speakFallback(text: string, lang = 'en'): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const base = lang.split('-')[0];
  const local = window.speechSynthesis.getVoices().filter((v) => v.localService && v.lang.toLowerCase().startsWith(base));
  if (!local.length) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 0.8;
  utterance.voice = (base === 'en' && local.find((v) => v.lang.startsWith('en-GB'))) || local[0];
  utterance.lang = utterance.voice.lang;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeaking(): boolean {
  if (currentAudio && !currentAudio.paused) return true;
  if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) return true;
  return false;
}
