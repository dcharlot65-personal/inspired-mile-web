#!/usr/bin/env node
/**
 * The voice's English, old against new, measured by ear.
 *
 *   node --import ./scripts/sound/ts-resolve.mjs scripts/voice/measure.mjs [--out docs/voice/measurement.json]
 *        [--only verse,quote] [--limit N] [--threads 6] [--wav-dir DIR]
 *
 * Run on the build host after `npm ci` (it downloads Kokoro and Whisper, about 160 MB, from the
 * Hugging Face hub). For every text of scripts/voice/corpus.mjs it makes two readings with the same
 * model (Kokoro-82M v1.0, q8, voice bm_george, speed 0.95, as the page uses):
 *
 *   old  kokoro-js's own generate(text): its text normaliser, then eSpeak NG through the npm
 *        package "phonemizer" (still installed under node_modules as kokoro-js's dependency; only
 *        the site build swaps it out). This is what c22b035a's page did (thespian-voice.ts there).
 *   new  thespian-voice.ts readAloud(): g2p-en.ts's phonemes, Kokoro's tokenizer, generate_from_ids.
 *
 * Both are resampled to 16 kHz by the same filter and transcribed by the Whisper model the game
 * ships (src/lib/ear.ts: onnx-community/whisper-base, q8, language "en", task "transcribe",
 * chunk_length_s 30). The word error rate of each against the text is the main result. Beside it,
 * for every distinct word of the corpus, how far the new phonemes are from eSpeak NG's (en, as the
 * old pipeline asked for it), with eSpeak's symbols written in misaki's convention first.
 *
 * Here both models run on onnxruntime-node (CPU), not the browser's WebAssembly runtime: the same
 * weights; the arithmetic may differ in the last bits, the same way for both readings.
 * eSpeak NG is only run here, on the build host, to measure against; nothing of it is shipped.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { corpus } from './corpus.mjs';
import { align, bootstrap, same, scoreWords, wer } from './score.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT = arg('out', join(ROOT, 'docs/voice/measurement.json'));
const ONLY = arg('only', '') ? new Set(arg('only', '').split(',')) : null;
const LIMIT = Number(arg('limit', '0')) || Infinity;
const THREADS = Number(arg('threads', '6'));
const WAV_DIR = arg('wav-dir', '');

const KOKORO = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const WHISPER = 'onnx-community/whisper-base';

const { installVoiceLexicon, phonemizeEnglish, sayWord } = await import(join(ROOT, 'src/lib/voice/g2p-en.ts'));
const { readAloud, THESPIAN_VOICE, THESPIAN_SPEED, toWav } = await import(join(ROOT, 'src/lib/thespian-voice.ts'));
installVoiceLexicon((await import(join(ROOT, 'src/lib/voice/lexicon-en.ts'))).default);

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

// kokoro-js exports no package.json; its folder is where npm put it.
const kokoroDir = join(ROOT, 'node_modules/kokoro-js');
const { KokoroTTS } = await import('kokoro-js');
const { phonemize: espeak } = await import('phonemizer');

/** kokoro-js's own Transformers.js (3.x, under its node_modules), so the model loads with a thread limit. */
async function kokoroTransformers() {
  const dir = join(kokoroDir, 'node_modules/@huggingface/transformers');
  if (!existsSync(join(dir, 'package.json'))) return null;
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const entry = pkg.exports?.node?.import ?? pkg.exports?.['.']?.node?.import ?? pkg.module;
  return entry ? import(pathToFileURL(join(dir, typeof entry === 'string' ? entry : entry.default)).href) : null;
}

async function loadKokoro() {
  const T3 = await kokoroTransformers();
  if (!T3) return KokoroTTS.from_pretrained(KOKORO, { dtype: 'q8', device: 'cpu' });
  const session_options = { intraOpNumThreads: THREADS, interOpNumThreads: 1 };
  const [model, tokenizer] = await Promise.all([
    T3.StyleTextToSpeech2Model.from_pretrained(KOKORO, { dtype: 'q8', device: 'cpu', session_options }),
    T3.AutoTokenizer.from_pretrained(KOKORO),
  ]);
  return new KokoroTTS(model, tokenizer);
}

const T4 = await import('@huggingface/transformers');
console.log(`[measure] Transformers.js ${T4.env.version} (Whisper), kokoro-js ${JSON.parse(readFileSync(join(kokoroDir, 'package.json'), 'utf8')).version}; ${THREADS} threads each`);
const tts = await loadKokoro();
const ear = await T4.pipeline('automatic-speech-recognition', WHISPER, { dtype: 'q8', device: 'cpu', session_options: { intraOpNumThreads: THREADS, interOpNumThreads: 1 } });

// The old path's phonemes: kokoro-js hands its tokenizer the string it made.
const tokenizer = tts.tokenizer;
let lastOld = '';
tts.tokenizer = (text, opts) => {
  lastOld = text;
  return tokenizer(text, opts);
};

// ---------------------------------------------------------------------------
// Audio: 24 kHz to 16 kHz (up 2, Kaiser-windowed sinc low-pass at 7.2 kHz, down 3)
// ---------------------------------------------------------------------------

function besselI0(x) {
  let sum = 1;
  let term = 1;
  for (let k = 1; k < 50; k++) {
    term *= (x / (2 * k)) ** 2;
    sum += term;
  }
  return sum;
}
const UP = 2;
const DOWN = 3;
const TAPS = 191;
const FIR = (() => {
  const fc = 7200 / 48000;
  const beta = 8.6;
  const h = new Float64Array(TAPS);
  const mid = (TAPS - 1) / 2;
  for (let k = 0; k < TAPS; k++) {
    const t = k - mid;
    const sinc = t === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * t) / (Math.PI * t);
    const w = besselI0(beta * Math.sqrt(1 - (t / mid) ** 2)) / besselI0(beta);
    h[k] = sinc * w * UP;
  }
  return h;
})();
export function to16k(x) {
  const n = Math.floor((x.length * UP) / DOWN);
  const y = new Float32Array(n);
  const mid = (TAPS - 1) / 2;
  for (let i = 0; i < n; i++) {
    const t = i * DOWN + mid;
    let acc = 0;
    // Only every UP-th sample of the upsampled signal is non-zero.
    for (let k = t % UP; k < TAPS; k += UP) {
      const j = (t - k) / UP;
      if (j >= 0 && j < x.length) acc += FIR[k] * x[j];
    }
    y[i] = acc;
  }
  return y;
}

async function hear(samples, rate) {
  if (rate !== 24000) throw new Error(`Kokoro gave ${rate} Hz`);
  const out = await ear(to16k(samples), { language: 'en', task: 'transcribe', chunk_length_s: 30 });
  return String(out?.text ?? '').trim();
}

// ---------------------------------------------------------------------------
// Phonemes against eSpeak NG (scoring a transcript: score.mjs)
// ---------------------------------------------------------------------------

/** eSpeak NG's IPA in misaki's symbols, so the two readings can be compared sound for sound. */
export function espeakToMisaki(ipa) {
  return ipa
    .replace(/r/g, 'ɹ')
    .replace(/x/g, 'k')
    .replace(/ɬ/g, 'l')
    .replace(/ʲ/g, 'j')
    .replace(/eɪ/g, 'A')
    .replace(/aɪ/g, 'I')
    .replace(/aʊ/g, 'W')
    .replace(/ɔɪ/g, 'Y')
    .replace(/əʊ/g, 'Q')
    .replace(/oʊ/g, 'O')
    .replace(/eə/g, 'ɛː')
    .replace(/iə/g, 'ɪə')
    .replace(/dʒ/g, 'ʤ')
    .replace(/tʃ/g, 'ʧ')
    .replace(/ɐ/g, 'ə')
    .replace(/ᵻ/g, 'ɪ')
    .replace(/ɚ/g, 'əɹ')
    .replace(/ɾ/g, 't')
    .replace(/ʔ/g, 't')
    .replace(/e(?!ː)/g, 'ɛ')
    .replace(/(\S)̩/g, 'ə$1')
    .replace(/̩/g, '');
}
const segments = (ps) => [...ps.replace(/[ˈˌ\s]/g, '').replace(/ᵊ/g, 'ə').replace(/ɐ/g, 'ə')];
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** Which vowel (counted from the start) carries the main stress, or -1. */
function stressAt(ps) {
  const vowels = /[AIOQWYaeiouɐɑɒɔəɛɜɪʊʌᵊæ]ː?/;
  let n = 0;
  let pending = false;
  for (let i = 0; i < ps.length; i++) {
    const ch = ps[i];
    if (ch === 'ˈ') pending = true;
    else if (vowels.test(ch)) {
      if (pending) return n;
      n++;
      while (ps[i + 1] === 'ː') i++;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

let items = await corpus();
if (ONLY) items = items.filter((i) => ONLY.has(i.category));
items = items.slice(0, LIMIT);
if (WAV_DIR) mkdirSync(WAV_DIR, { recursive: true });
const results = [];
const started = Date.now();
for (const [k, item] of items.entries()) {
  const t0 = Date.now();
  lastOld = '';
  const oldAudio = await tts.generate(item.text, { voice: THESPIAN_VOICE, speed: THESPIAN_SPEED });
  const oldPs = lastOld;
  const oldHeard = await hear(oldAudio.audio, oldAudio.sampling_rate);
  const fresh = await readAloud(tts, item.text, THESPIAN_VOICE, THESPIAN_SPEED);
  const newHeard = await hear(fresh.samples, fresh.sampleRate);
  if (WAV_DIR) {
    writeFileSync(join(WAV_DIR, `${item.id}.old.wav`), Buffer.from(toWav(oldAudio.audio, oldAudio.sampling_rate)));
    writeFileSync(join(WAV_DIR, `${item.id}.new.wav`), Buffer.from(toWav(fresh.samples, fresh.sampleRate)));
  }
  const ref = scoreWords(item.text);
  const o = align(ref, scoreWords(oldHeard));
  const n = align(ref, scoreWords(newHeard));
  const r = {
    id: item.id, category: item.category, text: item.text, words: ref.length,
    old: { phonemes: oldPs, heard: oldHeard, edits: o.edits, seconds: oldAudio.audio.length / oldAudio.sampling_rate, ops: o.ops.filter((x) => x.op !== '=') },
    new: { phonemes: fresh.phonemes.join(' '), heard: newHeard, edits: n.edits, seconds: fresh.samples.length / fresh.sampleRate, ops: n.ops.filter((x) => x.op !== '=') },
  };
  if (item.target) {
    const want = scoreWords(item.target);
    const got = (heard) => {
      const h = scoreWords(heard);
      return want.every((w) => h.some((x) => same(w, x)));
    };
    r.target = item.target;
    r.old.targetHeard = got(oldHeard);
    r.new.targetHeard = got(newHeard);
  }
  results.push(r);
  if (k % 10 === 0 || k === items.length - 1) console.log(`[measure] ${k + 1}/${items.length} ${item.id}: old ${o.edits}/${ref.length}, new ${n.edits}/${ref.length} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

// Phonemes against eSpeak NG, word by word. eSpeak says a word alone in its citation form ("a"
// ˈeɪ), so ours is taken the same way: alone, as at a phrase's end (the little words strong).
const seen = new Map();
for (const item of items) {
  for (const w of phonemizeEnglish(item.text).words) {
    const key = w.word.toLowerCase();
    if (!seen.has(key)) seen.set(key, { ...sayWord(w.word, { phraseEnd: true }), word: w.word });
  }
}
const words = [];
for (const [key, w] of seen) {
  const raw = (await espeak(key, 'en')).join(' ');
  const e = espeakToMisaki(raw);
  const a = segments(w.ps);
  const b = segments(e);
  const dist = editDistance(a, b);
  const sa = stressAt(w.ps);
  const sb = stressAt(e);
  words.push({ word: key, source: w.source, ours: w.ps, espeak: raw, espeakMisaki: e, distance: dist, length: b.length, same: dist === 0, stressSame: sa === sb });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const categories = [...new Set(results.map((r) => r.category))];
const summary = {};
for (const c of [...categories, 'running text', 'all']) {
  const rows = c === 'all' ? results : c === 'running text' ? results.filter((r) => r.category !== 'word') : results.filter((r) => r.category === c);
  if (!rows.length) continue;
  const o = wer(rows, 'old');
  const n = wer(rows, 'new');
  summary[c] = { items: rows.length, words: o.words, old: o.wer, new: n.wer, difference: n.wer - o.wer, interval95: bootstrap(rows) };
  const targets = rows.filter((r) => r.target);
  if (targets.length) {
    summary[c].targetsHeard = { old: targets.filter((r) => r.old.targetHeard).length, new: targets.filter((r) => r.new.targetHeard).length, of: targets.length };
  }
}
const bySource = {};
for (const w of words) {
  const s = (bySource[w.source] ??= { words: 0, same: 0, distance: 0, length: 0, stressSame: 0 });
  s.words++;
  s.same += w.same ? 1 : 0;
  s.distance += w.distance;
  s.length += w.length;
  s.stressSame += w.stressSame ? 1 : 0;
}
for (const s of Object.values(bySource)) {
  s.phonemeErrorRate = s.length ? s.distance / s.length : 0;
  s.identical = s.words ? s.same / s.words : 0;
  s.stressAgreement = s.words ? s.stressSame / s.words : 0;
}
// Where the new reading is heard worse: the words of the text it loses that the old one kept.
const worse = [];
for (const r of results) {
  if (r.new.edits <= r.old.edits) continue;
  const lostOld = new Set(r.old.ops.filter((x) => x.ref).map((x) => x.ref));
  const lost = r.new.ops.filter((x) => x.ref && !lostOld.has(x.ref)).map((x) => `${x.ref}${x.op === 'S' ? ` (heard "${x.hyp}")` : ' (missing)'}`);
  worse.push({ id: r.id, old: r.old.edits, new: r.new.edits, lost, text: r.text, oldHeard: r.old.heard, newHeard: r.new.heard });
}
const report = {
  date: new Date().toISOString(),
  host: process.env.HOSTNAME ?? '',
  node: process.version,
  kokoro: { model: KOKORO, dtype: 'q8', voice: THESPIAN_VOICE, speed: THESPIAN_SPEED, runtime: 'onnxruntime-node (cpu)' },
  whisper: { model: WHISPER, dtype: 'q8', transformers: T4.env.version, options: { language: 'en', task: 'transcribe', chunk_length_s: 30 } },
  seconds: (Date.now() - started) / 1000,
  summary,
  phonemesAgainstEspeak: bySource,
  worse,
  words,
  results,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 1)}\n`);
console.log(JSON.stringify({ summary, phonemesAgainstEspeak: bySource, worse: worse.length }, null, 1));
console.log(`[measure] wrote ${OUT} in ${report.seconds.toFixed(0)} s`);
// onnxruntime-node can abort while tearing down its threads at exit, after the report is written.
process.exit(0);
