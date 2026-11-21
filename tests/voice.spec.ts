import { test, expect } from '@playwright/test';

/**
 * The voice in the browser, with the real Kokoro model: it reads English with the game's own
 * pronunciation (src/lib/voice/g2p-en.ts), and no code of eSpeak NG reaches the page.
 *
 * kokoro-js imports the npm package "phonemizer" (eSpeak NG, GPL-3.0-or-later); astro.config.mjs
 * swaps it for src/lib/voice/no-espeak.ts in the dev server as in the build. This test reads every
 * script the page is served and fails on phonemizer's glue. Then Kokoro speaks a line and Whisper
 * (the ear, src/lib/ear.ts) must hear its words: the phonemes the page gives Kokoro are speech.
 *
 * Downloads Kokoro and Whisper (about 80 MB each) from the Hugging Face hub; E2E_NO_DOWNLOADS=1
 * skips it.
 */

test.use({ serviceWorkers: 'block' });

/** phonemizer's Emscripten glue (scripts/check-no-espeak.mjs MARKERS). Not the bare name: dev sources keep their comments. */
const GLUE = ['eSpeakNGWorker', 'espeak-ng-data', 'espeakEVENT_', 'synthesize_ipa', 'espeak-ng-ipa-tmp-'];

test('the voice speaks without eSpeak NG, and the ear hears what it said', async ({ page }) => {
  test.skip(!!process.env.E2E_NO_DOWNLOADS, 'E2E_NO_DOWNLOADS is set: this downloads real models');
  test.setTimeout(10 * 60 * 1000);

  const scripts: Array<Promise<{ url: string; found: string[] }>> = [];
  const urls: string[] = [];
  page.on('response', (r) => {
    const url = r.url();
    urls.push(url);
    const type = r.headers()['content-type'] ?? '';
    if (!/javascript|ecmascript|typescript/.test(type) && !/\.(m?js|ts)(\?|$)/.test(url)) return;
    scripts.push(r.text().then((body) => ({ url, found: GLUE.filter((m) => body.includes(m)) }), () => ({ url, found: [] })));
  });

  await page.goto('/about');
  const said = await (async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await page.evaluate(async () => {
          const voice = await import(/* @vite-ignore */ '/src/lib/thespian-voice.ts');
          if (!(await voice.loadVoice())) return { error: 'loadVoice failed' };
          const ear = await import(/* @vite-ignore */ '/src/lib/ear.ts');
          // To 16 kHz mono, as the ear takes it.
          const hear = async (speech: { samples: Float32Array; sampleRate: number }) => {
            const frames = Math.ceil((speech.samples.length / speech.sampleRate) * 16000);
            const ctx = new OfflineAudioContext(1, frames, 16000);
            const buffer = ctx.createBuffer(1, speech.samples.length, speech.sampleRate);
            buffer.copyToChannel(speech.samples, 0);
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.connect(ctx.destination);
            src.start();
            return ear.transcribe((await ctx.startRendering()).getChannelData(0), 'en');
          };
          const speech = await voice.synthesise('To be, or not to be, that is the question.');
          const heard = await hear(speech);
          // Digits written into words were once dropped ("the 90s" was said "the S").
          const numbers = await voice.synthesise('Back in the 90s, at 10pm, I played my mp3.');
          const heardNumbers = await hear(numbers);
          let sum = 0;
          for (const s of speech.samples) sum += s * s;
          // speak() with the real Kokoro loaded: text the English reading cannot say goes to the
          // device's own voice, not an empty sound; an emoji in a line is said by its CLDR name.
          // Only the device voice and the audio element are stand-ins (headless Chromium has no
          // local voice, and nothing may play aloud here).
          const spoken: string[] = [];
          let played = 0;
          Object.defineProperty(window.speechSynthesis, 'getVoices', { value: () => [{ localService: true, lang: 'en-GB', name: 'stand-in' }] });
          Object.defineProperty(window.speechSynthesis, 'speak', { value: (u: { text: string }) => spoken.push(u.text) });
          (window as any).SpeechSynthesisUtterance = class {
            text: string;
            constructor(text: string) {
              this.text = text;
            }
          };
          HTMLMediaElement.prototype.play = function () {
            played++;
            return Promise.resolve();
          };
          await voice.speak('привет');
          const playedBefore = played;
          await voice.speak('I 💀 you with every line.');
          const emoji = (await voice.synthesise('I 💀 you with every line.')).phonemes;
          return {
            phonemes: speech.phonemes, seconds: speech.samples.length / speech.sampleRate, rms: Math.sqrt(sum / speech.samples.length), heard, numbers: numbers.phonemes, heardNumbers,
            fallback: { spoken, playedBefore, played }, emoji,
          };
        });
      } catch (err) {
        if (attempt >= 2 || !/context was destroyed|navigation|Failed to fetch dynamically imported module/i.test(String(err))) throw err;
        await page.waitForLoadState('load');
        await page.waitForTimeout(1000);
      }
    }
  })();
  console.log(`[voice] ${JSON.stringify(said)}`);
  expect(said).not.toHaveProperty('error');
  expect(said.phonemes.join(' ')).toBe('tə bˈiː, ɔː nˈɒt tə bˈiː, ðat ɪz ðə kwˈɛsʧən.');
  expect(said.seconds).toBeGreaterThan(1.5);
  expect(said.rms).toBeGreaterThan(0.01);
  const heard = String(said.heard).toLowerCase();
  for (const w of ['be', 'not', 'question']) expect(heard, `Whisper heard "${heard}"`).toContain(w);
  const heardNumbers = String(said.heardNumbers).toLowerCase();
  expect(said.numbers.join(' ')).toContain('nˈIntiz');
  for (const n of [/\b(90'?s|nineties)\b/, /\b(10|ten)(?=\b|pm)/, /\bm\.? ?p\.? ?(3|three)\b/]) expect(heardNumbers, `Whisper heard "${heardNumbers}"`).toMatch(n);

  // No Latin letter: the device voice, and nothing played; an emoji: its name, played by Kokoro.
  expect(said.fallback).toEqual({ spoken: ['привет'], playedBefore: 0, played: 1 });
  expect(said.emoji.join(' ')).toContain('skˈʌl');

  const served = await Promise.all(scripts);
  expect(served.length, 'scripts were read').toBeGreaterThan(10);
  expect(served.filter((s) => s.found.length), 'scripts holding eSpeak NG').toEqual([]);
  expect(urls.filter((u) => /phonemizer|espeak/i.test(u)), 'requests for phonemizer or eSpeak NG').toEqual([]);
});

test('a duel with the voice off fetches none of it: no Kokoro, no pronunciation code or table', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('/battle?seed=7&brain=rules', { waitUntil: 'networkidle' });
  await expect(page.locator('#start-duel')).toBeEnabled();
  await page.selectOption('#language', 'en');
  await page.click('#start-duel');
  await expect(page.locator('#opponent-verse')).toHaveAttribute('data-source', /written|model/, { timeout: 60_000 });
  await page.waitForLoadState('networkidle');
  expect(urls.filter((u) => /kokoro|lexicon-en|g2p-en|nrl-rules|lts-en|huggingface/i.test(u))).toEqual([]);
});
