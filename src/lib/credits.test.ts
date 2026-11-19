/**
 * The credits page (src/pages/credits.astro) names what the game ships, and docs/ASSETS.md records where each
 * shipped file came from. These fail when something is added to the game without its credit or its record:
 * a font family, a model, a browser library, a generated data module's source, a file of music, sound or 3D.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODELS } from './brain';
import { EAR_MODEL } from './ear';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const page = read('src/pages/credits.astro');
const assets = read('docs/ASSETS.md');

describe('the credits page', () => {
  it('names every font family the site serves, and serves their license beside them', () => {
    const families = [...new Set([...read('public/fonts/fonts.css').matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]))];
    expect(families.length).toBeGreaterThanOrEqual(5);
    const ofl = read('public/fonts/OFL.txt');
    for (const f of families) {
      expect([f, page.includes(`name: '${f}'`)], `${f} on the credits page`).toEqual([f, true]);
      expect([f, ofl.includes(`The ${f} Project Authors`)], `${f}'s copyright line in OFL.txt`).toEqual([f, true]);
    }
    expect(ofl).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('names every model the game can load, by the repository it is downloaded from', () => {
    const thespian = read('src/lib/thespian-voice.ts').match(/from_pretrained\('([^']+)'/)?.[1];
    const ids = [...Object.values(MODELS).map((m) => m.id), EAR_MODEL, thespian];
    for (const id of ids) expect([id, page.includes(`https://huggingface.co/${id}'`)], `${id}`).toEqual([id, true]);
  });

  it('names every library the browser is sent', () => {
    // package.json's runtime dependencies, each with the words its entry is found by. The React
    // integration ships no component (no page has a client: directive), and the Tailwind plugin is build-time.
    const deps = Object.keys(JSON.parse(read('package.json')).dependencies);
    const ENTRY: Record<string, string> = {
      '@babylonjs/core': 'Babylon.js', '@babylonjs/gui': 'Babylon.js', '@babylonjs/loaders': 'Babylon.js',
      '@google/model-viewer': 'model-viewer', '@huggingface/transformers': 'Transformers.js', '@simplewebauthn/browser': 'SimpleWebAuthn',
      astro: 'Astro', 'kokoro-js': 'kokoro-js', kuromoji: 'kuromoji 0.1.2', tailwindcss: 'Tailwind CSS',
    };
    const BUILD_ONLY = ['@astrojs/react', 'react', 'react-dom', '@tailwindcss/vite'];
    for (const d of deps) {
      if (BUILD_ONLY.includes(d)) continue;
      expect([d, ENTRY[d] !== undefined], `${d} has an entry to look for`).toEqual([d, true]);
      expect([d, page.includes(ENTRY[d])], `${d} on the credits page`).toEqual([d, true]);
    }
    // What those bring with them into the browser: three.js (model-viewer), ONNX Runtime (Transformers.js),
    // phonemizer and the eSpeak NG it compiles in (kokoro-js), with eSpeak NG's own license.
    for (const w of ['three.js', 'ONNX Runtime', 'phonemizer', 'eSpeak NG', 'GNU General Public License, version 3 or later']) expect(page).toContain(w);
    for (const pages of readdirSync(new URL('../pages', import.meta.url))) expect([pages, /\bclient:(load|idle|visible|media|only)\b/.test(read(`src/pages/${pages}`))]).toEqual([pages, false]);
  });

  it('credits the source each generated data module names in its header', () => {
    const dir = 'src/lib/verse/sound/data';
    for (const f of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
      const source = read(`${dir}/${f}`).split('\n').slice(0, 3).join(' ');
      if (/Wiktionary/.test(source)) expect(page, f).toContain('Wiktionary pronunciations');
      if (/WikiPron/.test(source)) expect(page, f).toContain('WikiPron');
      if (/kaikki/.test(source)) expect(page, f).toContain('kaikki.org');
      if (/CC-CEDICT/.test(source)) expect(page, f).toContain('CC-CEDICT');
      if (/Unihan/.test(source)) expect(page, f).toContain('Unihan');
    }
    const header = (p: string) => read(p).slice(0, 2500);
    expect(header('src/lib/verse/pron-en.ts')).toContain('CMU Pronouncing');
    expect(page).toContain('The CMU Pronouncing Dictionary');
    expect(page).toContain('SCOWL');
    expect(header('src/lib/verse/confusables.ts')).toContain('UTS #39');
    expect(page).toContain('UTS #39');
    expect(header('src/lib/verse/function-words/de.ts')).toContain('stopwords-iso');
    expect(page).toContain('stopwords-iso');
    expect(header('src/lib/verse/stem/index.ts')).toContain('Snowball');
    expect(page).toContain('Snowball stemmers');
    expect(header('src/lib/verse/judge-words.ts')).toMatch(/CLDR[\s\S]*Wiktionary/);
    expect(page).toContain('Unicode CLDR');
    expect(page).toContain('JMdict and JMnedict');
    expect(page).toContain('mecab-ipadic');
  });

  it('carries the notices the licenses ask to travel with the data', () => {
    // The CMU and SCOWL notices are read from the shipped table itself, so they cannot drift from it.
    expect(page).toMatch(/import pronEn from '\.\.\/lib\/verse\/pron-en'/);
    const naist = read('public/licenses/mecab-ipadic-NOTICE.txt');
    for (const w of ['Nara Institute of Science', 'and Technology.  All Rights Reserved.', 'NO WARRANTY', 'ICOT']) expect(naist).toContain(w);
    expect(page).toContain('/licenses/mecab-ipadic-NOTICE.txt');
    // The share-alike duty and the license conditions the owner must watch.
    for (const w of ['CC BY-SA 4.0', 'US$10,000,000', 'US$5,000,000', 'Gemma Terms of Use', 'generated with artificial intelligence']) expect(page).toContain(w);
  });
});

describe('docs/ASSETS.md', () => {
  it('records every music, sound and 3D file the site serves, by name', () => {
    for (const dir of ['public/audio/music', 'public/audio/sfx', 'public/models', 'public/models/splats']) {
      for (const f of readdirSync(new URL(`../../${dir}`, import.meta.url), { withFileTypes: true })) {
        if (f.isFile()) expect([dir, f.name, assets.includes(f.name)]).toEqual([dir, f.name, true]);
      }
    }
  });

  it('records the image folders with their counts', () => {
    for (const dir of ['public/images/cards', 'public/images/variants']) {
      const n = readdirSync(new URL(`../../${dir}`, import.meta.url)).length;
      expect([dir, assets.includes(`\`${dir}/\` (${n} files)`)]).toEqual([dir, true]);
    }
  });
});
