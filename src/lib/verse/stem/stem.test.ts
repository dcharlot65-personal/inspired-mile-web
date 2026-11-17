import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadStemmer, STEM_LANGS, stemmerFor } from './index';

// sha256 of each file as it is in jsstemmer-3.2.0.tar.gz (https://snowballstem.org/dist/; the tarball's own sha256
// is 1d3f39267a15d0351312ff4d778de7bb8aae6480a63c4b318eda31032a15e5bd). The files are used unchanged.
const SHA256: Record<string, string> = {
  'arabic-stemmer.js': '3666bd37558a83d85d45d8649ebfd643834846673f0d0f527ea93c2ff63dc089',
  'base-stemmer.js': 'ca7982734b537fa7366d70907363f793bee82ed412794c5cd60f0d62b2629ecc',
  'french-stemmer.js': '84e6288f672650a25add2c80ac5dd8860a2bacefba9e2171bcc0676263d7da13',
  'german-stemmer.js': '5fc4b96f598e7a152561384bc319acc89a9647d7f88223e5568faaac94bb0e3e',
  'hindi-stemmer.js': '1d6ec7a34571737c3b7dab0d5fc327626c9483686891e6edfdf49118e3c2187d',
  'indonesian-stemmer.js': '6157a4b017743906ce0c7e658931b68da0f0b73e5f37c5b91acac0225819d6b8',
  'italian-stemmer.js': '1d34d30a6224f2ee03d800a7a903cfedf761b939ca5ca4462a6886d7c9057b5d',
  'polish-stemmer.js': '962dc9b135dae301c07ee838054e21e612507d6bbdbad32c02caae13448962c9',
  'portuguese-stemmer.js': 'f2f6ace1755681a3b0ae9316adeb1d267a092a464c39b81136e20bfccc6b8e82',
  'russian-stemmer.js': '9ee8cb6f6c25e1d1bb2bbc06c22eaccb983b096aff4eef20f54a03908f21c6df',
  'spanish-stemmer.js': '5666d9027d648f01ea41951205ce864c774a7336f787d9b1df091820a5cf2471',
};

describe('Snowball stemmers', () => {
  it('are the published files, unchanged', () => {
    for (const [f, sum] of Object.entries(SHA256)) {
      expect([f, createHash('sha256').update(readFileSync(`src/lib/verse/stem/snowball/${f}`)).digest('hex')]).toEqual([f, sum]);
    }
  });

  it('give one stem to two forms of a word, and two stems to two words', async () => {
    for (const l of STEM_LANGS) await loadStemmer(l);
    const same = (lang: string, a: string, b: string) => stemmerFor(lang)!(a) === stemmerFor(lang)!(b);
    // Forms of one word.
    expect(same('ru', 'Гамлет', 'Гамлета')).toBe(true);
    expect(same('ru', 'Джульетта', 'Джульетту')).toBe(true);
    expect(same('es', 'rosa', 'rosas')).toBe(true);
    expect(same('de', 'Hamlet', 'Hamlets')).toBe(true);
    expect(same('it', 'cuore', 'cuori')).toBe(true);
    // Different words.
    expect(same('es', 'Roma', 'Romeo')).toBe(false);
    expect(same('fr', 'marc', 'marche')).toBe(false);
    expect(same('ru', 'Гамлет', 'Макбета')).toBe(false);
    expect(stemmerFor('ja')).toBe(null);
  });
});
