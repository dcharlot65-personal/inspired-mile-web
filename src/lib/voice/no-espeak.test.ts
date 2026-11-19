import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
// @ts-ignore a plain ES module of the build scripts
import { MARKERS, NAME, markersIn, scanDir, scanFile } from '../../../scripts/check-no-espeak.mjs';
import { phonemize } from './no-espeak';

/** Bytes that look like a compressed program: no marker in them by chance. */
function noise(n: number, seed = 7): Buffer {
  const b = Buffer.alloc(n);
  let x = seed;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    b[i] = x >>> 24;
  }
  return b;
}

describe('the build check finds eSpeak NG however it is carried', () => {
  it('finds the names of phonemizer\'s Emscripten glue', () => {
    for (const m of MARKERS) {
      expect(scanFile('a.js', Buffer.from(`var x=1;${m};`)).map((f: { marker: string }) => f.marker), m).toContain(m);
    }
  });

  it('finds eSpeak NG\'s name as a word, but not inside another', () => {
    expect(markersIn(Buffer.from('built on espeak-ng 1.52'))).not.toEqual([]);
    expect(markersIn(Buffer.from('the eSpeak voice'))).not.toEqual([]);
    expect(markersIn(Buffer.from('espeak_VOICE_get_name_'))).not.toEqual([]);
    expect(markersIn(Buffer.from('WeSpeakerResNetModel WeSpeakerFeatureExtractor'))).toEqual([]);
    expect(markersIn(Buffer.from('bespeak2 doublespeak3 respeak2^'))).toEqual([]);
    expect(NAME.test('kokoro')).toBe(false);
  });

  it('finds it inside base64, and inside gzip inside base64, as phonemizer ships its data', () => {
    const payload = Buffer.concat([noise(6000), Buffer.from('/usr/share/espeak-ng-data/phontab'), noise(6000, 9)]);
    const plain = `const d="${payload.toString('base64')}";`;
    const zipped = `const d="${gzipSync(payload).toString('base64')}";`;
    expect(plain.includes('espeak')).toBe(false);
    expect(zipped.includes('espeak')).toBe(false);
    expect(scanFile('chunk.js', Buffer.from(plain)).some((f: { where: string }) => f.where.startsWith('base64'))).toBe(true);
    expect(scanFile('chunk.js', Buffer.from(zipped)).some((f: { where: string }) => f.where.startsWith('gzip in base64'))).toBe(true);
    // The same noise with no marker is clean.
    expect(scanFile('chunk.js', Buffer.from(`const d="${gzipSync(noise(12000)).toString('base64')}";`))).toEqual([]);
  });

  it('finds it in a binary file, and by a file name', () => {
    expect(scanFile('x.wasm', Buffer.concat([Buffer.from([0, 0x61, 0x73, 0x6d]), noise(100), Buffer.from('espeakEVENT_WORD'), noise(100)]))).not.toEqual([]);
    expect(scanFile('_astro/phonemizer.abc123.js', Buffer.from('export{}'))).not.toEqual([]);
  });

  it('reports every file of a folder that holds it, and nothing for a clean one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'no-espeak-'));
    mkdirSync(join(dir, '_astro'));
    writeFileSync(join(dir, 'index.html'), '<html><body>Sonnet Man</body></html>');
    writeFileSync(join(dir, '_astro', 'clean.js'), 'export const a="WeSpeakerResNetModel";');
    expect(scanDir(dir).findings).toEqual([]);
    writeFileSync(join(dir, '_astro', 'kokoro.js'), 'new A.eSpeakNGWorker');
    const { findings, files } = scanDir(dir);
    expect(files).toBe(3);
    expect([...new Set(findings.map((f: { file: string }) => f.file))]).toEqual([join('_astro', 'kokoro.js')]);
  });
});

describe('the voice cannot reach eSpeak NG', () => {
  it('gives kokoro-js a stand-in that throws, whose message does not name the program', async () => {
    await expect(phonemize()).rejects.toThrow(/g2p-en/);
    const message = await phonemize().catch((e: Error) => e.message);
    expect(markersIn(Buffer.from(message))).toEqual([]);
  });

  it('swaps the package in the bundler, and the build runs the check', () => {
    const config = readFileSync('astro.config.mjs', 'utf8');
    expect(config).toMatch(/find: \/\^phonemizer\$\/, replacement: noEspeak/);
    expect(config).toContain("new URL('./src/lib/voice/no-espeak.ts', import.meta.url)");
    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts.build).toMatch(/&& node scripts\/check-no-espeak\.mjs dist$/);
  });

  it('never calls kokoro-js\'s own text path (generate or stream, which phonemize)', () => {
    const voice = readFileSync('src/lib/thespian-voice.ts', 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(voice).not.toMatch(/\.(generate|stream)\s*\(/);
    expect(voice).toMatch(/model\.generate_from_ids\(/);
    expect(voice).toMatch(/phonemizeEnglish\(/);
  });
});
