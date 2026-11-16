/**
 * The ear: speech to text that runs entirely in the browser.
 *
 * The browser's own Web Speech recognition sends the recording to a server, so
 * it is not used. Audio is captured with the microphone, converted to 16 kHz
 * mono on the device and transcribed by Whisper (base, multilingual, about
 * 80 MB) through Transformers.js on WebAssembly, which works with or without
 * WebGPU. Nothing recorded leaves the device.
 *
 * The first use downloads the Whisper model from the Hugging Face hub (a download
 * request: IP address and browser details, no audio). The WebAssembly runtime comes
 * from this site (model-runtime.ts).
 */

import { loadTransformers } from './model-runtime';

export const EAR_MODEL = 'onnx-community/whisper-base';
export const EAR_MEGABYTES = 80;
/** Longest take, in seconds. A verse is short; this also bounds memory. */
export const MAX_SECONDS = 45;

let transcriber: any = null;
let loading: Promise<boolean> | null = null;

export function isEarLoaded(): boolean {
  return transcriber !== null;
}

export function loadEar(onProgress?: (text: string) => void): Promise<boolean> {
  if (transcriber) return Promise.resolve(true);
  if (loading) return loading;
  loading = (async () => {
    try {
      const T = await loadTransformers();
      transcriber = await T.pipeline('automatic-speech-recognition', EAR_MODEL, {
        device: 'wasm',
        dtype: 'q8',
        progress_callback: (p: any) => {
          if (p.status === 'progress' && p.total > 5e6) onProgress?.(`Loading the ear: ${Math.round(p.progress)}%`);
        },
      });
      return true;
    } catch (err) {
      console.error('[ear] failed to load', err);
      return false;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

let recorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let chunks: Blob[] = [];
let stopTimer: ReturnType<typeof setTimeout> | null = null;

export function isListening(): boolean {
  return recorder?.state === 'recording';
}

/** Ask for the microphone and start recording. Throws if permission is refused. */
export async function startListening(onAutoStop?: () => void): Promise<void> {
  if (isListening()) return;
  stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.start();
  stopTimer = setTimeout(() => onAutoStop?.(), MAX_SECONDS * 1000);
}

function release() {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  recorder = null;
}

/** Decode a recording and resample it to the 16 kHz mono Whisper expects. */
export async function toWhisperAudio(blob: Blob): Promise<Float32Array> {
  const Ctx = (window as any).OfflineAudioContext ?? (window as any).webkitOfflineAudioContext;
  const decodeCtx = new (window.AudioContext ?? (window as any).webkitAudioContext)();
  const decoded = await decodeCtx.decodeAudioData(await blob.arrayBuffer());
  await decodeCtx.close();
  const frames = Math.ceil(decoded.duration * 16000);
  const offline = new Ctx(1, Math.max(1, frames), 16000);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  return (await offline.startRendering()).getChannelData(0);
}

/**
 * Break a transcript into lines of verse. Whisper returns running text; a
 * speaker's pauses come through as punctuation, so each clause becomes a line.
 */
export function transcriptToVerse(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?;:,،。！？、])\s+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

/** Stop recording and return what was said, as lines of verse. */
export async function stopListening(lang: string): Promise<string> {
  const rec = recorder;
  if (!rec) return '';
  const stopped = new Promise<void>((resolve) => {
    rec.onstop = () => resolve();
  });
  if (rec.state !== 'inactive') rec.stop();
  await stopped;
  const blob = new Blob(chunks, { type: rec.mimeType });
  release();
  if (!blob.size) return '';
  if (!(await loadEar())) throw new Error('The speech model could not be loaded on this device.');
  const audio = await toWhisperAudio(blob);
  const out = await transcriber(audio, { language: lang.split('-')[0], task: 'transcribe', chunk_length_s: 30 });
  return transcriptToVerse(String(out?.text ?? ''));
}

export function cancelListening(): void {
  try {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  } catch {
    /* already stopped */
  }
  release();
}
