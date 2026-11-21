import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-ignore a plain ES module of the build scripts
import { HELD_OUT_SEEN, heldOutNamedInSources, slangAndNames, voiceSources } from '../../../scripts/voice/corpus.mjs';

/**
 * docs/voice/G2P-MEASUREMENT.md measures the voice on 200 held-out words and says which of them the
 * voice's own sources name (corpus.mjs HELD_OUT_SEEN). That record must match the sources: a word
 * named in the code, a test or the notes after the measurement is no longer held out, and the
 * measure without the seen words is then of fewer words.
 */
describe('the held-out words (scripts/voice/slang-and-names.txt)', () => {
  const seen = new Set<string>([...HELD_OUT_SEEN.named, ...HELD_OUT_SEEN.additions]);

  it('are named in the voice\'s sources only where corpus.mjs records it', () => {
    const found: Map<string, string[]> = heldOutNamedInSources();
    const unrecorded = [...found].filter(([w]) => !seen.has(w)).map(([w, files]) => `${w}: ${files.join(', ')}`);
    expect(unrecorded, 'named in a voice source and not in HELD_OUT_SEEN').toEqual([]);
    const stale = [...seen].filter((w) => !found.has(w));
    expect(stale, 'in HELD_OUT_SEEN and named nowhere').toEqual([]);
  });

  it('record as additions only words of the game\'s own pronunciation additions, and every list word is real', () => {
    const extra = readFileSync('scripts/pronunciation-extra.txt', 'utf8').toLowerCase().split('\n').map((l) => l.replace(/^!/, '').split(' ')[0]);
    for (const w of HELD_OUT_SEEN.additions) expect(extra, w).toContain(w.toLowerCase());
    const words: string[] = slangAndNames();
    expect(words.length).toBe(200);
    for (const w of seen) expect(words, w).toContain(w);
  });

  it('are looked for in the voice\'s code, tests and notes', () => {
    const files: string[] = voiceSources();
    for (const f of ['src/lib/voice/g2p-en.ts', 'src/lib/voice/lts-en.ts', 'src/lib/voice/g2p-en.test.ts', 'src/lib/thespian-voice.ts', 'CLAUDE.md', 'scripts/pronunciation-extra.txt']) {
      expect(files).toContain(f);
    }
  });
});
