/**
 * The credits page (src/pages/credits.astro) names what the game ships, and docs/ASSETS.md records where each
 * shipped file came from. These fail when something is added to the game without its credit or its record:
 * a font family, a model, a browser library, a generated data module's source, a file of music, sound or 3D.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain JavaScript module of the build, with no type declarations
import { FILE_LICENSES } from '../../scripts/third-party-notices.mjs';
import pronEn from './verse/pron-en';
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
    // What those bring with them into the browser: three.js (model-viewer), ONNX Runtime (Transformers.js).
    // kokoro-js's phonemizer (eSpeak NG) does not ship: the voice reads English itself (src/lib/voice/).
    for (const w of ['three.js', 'ONNX Runtime']) expect(page).toContain(w);
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
    // No copyright is claimed over what was taken from the CC BY-SA works; EDRDG's licence statement asks it in so
    // many words for JMdict and JMnedict.
    expect(page).not.toContain('themselves licensed under CC BY-SA 4.0');
    expect(page).toContain('we claim no copyright over it');
    const jm = page.slice(page.indexOf("name: 'JMdict and JMnedict'"), page.indexOf("name: 'stopwords-iso"));
    expect(jm).toMatch(/must not claim copyright over that material/);
    expect(jm).toMatch(/stay the copyright of James William Breen and the Electronic Dictionary Research and Development Group/);
  });

  it('names what Rolldown puts in the bundle from others: esbuild\'s runtime, and Rollup, with the file that licenses them', () => {
    const entry = page.slice(page.indexOf("name: 'Tailwind CSS 4"), page.indexOf('const FONTS = ['));
    for (const w of ['esbuild', 'Evan Wallace', 'Rollup', 'THIRD-PARTY-LICENSE', 'rolldown@1.2.19']) expect([w, entry.includes(w)]).toEqual([w, true]);
  });
});

describe('what the credits page says the licenses ask', () => {
  it('points to the notices file the build writes, and to ONNX Runtime\'s, which this site serves', () => {
    expect(page).toContain("const NOTICES_FILE = '/licenses/THIRD-PARTY-NOTICES.txt'");
    expect(page).toContain('id="third-party-notices" href={NOTICES_FILE}');
    for (const v of ['1.22', '1.31']) expect(page).toContain(`/licenses/onnxruntime-${v}-ThirdPartyNotices.txt`);
    // No duty line may say a notice goes with the code without saying where it is.
    for (const m of page.matchAll(/duties: '(\\'|[^'])*'/g)) {
      if (/go(es)? with (the )?(code|copies|data)/.test(m[0])) expect([m[0], /notices file|first lines|that file|which goes with the code/.test(m[0])]).toEqual([m[0], true]);
    }
  });

  it('names every library entry\'s packages, which the build holds to the bundle', () => {
    const block = page.slice(page.indexOf('const LIBRARIES: Entry[] = ['), page.indexOf('const FONTS = ['));
    const entries = block.split(/\n  \{\n/).slice(1);
    expect(entries.length).toBeGreaterThanOrEqual(10);
    for (const e of entries) {
      const name = e.match(/name: '([^']+)'/)?.[1];
      // Files three.js carries from others (Draco, Basis, fflate, …) are named by their file licenses instead
      // (Part 2 of the notices).
      if (/files: \[/.test(e) && !/packages: \[/.test(e)) continue;
      expect([name, /packages: \[/.test(e)]).toEqual([name, true]);
    }
  });

  it('says what was done to the data, as the build scripts do it, and nothing the record does not show', () => {
    // scripts/build-function-words.mjs lower-cases, normalises and drops entries; the page said "kept as published".
    expect(page).not.toContain('kept as published');
    expect(page).toMatch(/lower-cased and put in Unicode NFC form, without its entries of more than one word or with no letter/);
    // docs/CARD-ART.md says each image "was looked at before use"; it does not say by whom.
    expect(page).not.toMatch(/looked at by a person/);
    expect(read('docs/CARD-ART.md')).toMatch(/looked at before use/);
  });

  it('names every file a package carries under another license, by its id, which the build holds to what ships', () => {
    const named = new Set([...page.matchAll(/files: \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])));
    for (const f of FILE_LICENSES as { id: string; title: string }[]) expect([f.id, named.has(f.id)], f.title).toEqual([f.id, true]);
    for (const w of ['fflate', 'ktx-parse', 'zstddec', 'Zstandard', 'meshoptimizer', 'Arjun Barrett', 'Don McCurdy', 'Arseny Kapoulkine']) expect(page).toContain(w);
  });

  it('carries SCOWL\'s Copyright file whole in the table, and serves it as the release has it', () => {
    const file = readFileSync(new URL('../../public/licenses/SCOWL-Copyright.txt', import.meta.url));
    // scowl-2020.12.07.tar.gz (the sha256 scripts/build-pronunciation.mjs pins), its Copyright file.
    expect(createHash('sha256').update(file).digest('hex')).toBe('283326a422e29c510e2ba6805518c418ce3c35ed1fadc3eec83d2da4f6c5a055');
    const notice = pronEn.split('\n').filter((l) => l.startsWith('#')).map((l) => l.replace(/^# ?/, '')).join('\n');
    expect(notice).toContain(file.toString('latin1').replace(/\s+$/, ''));
    // The sentence as SCOWL wrote it, with the notices it points to after it.
    expect(notice).toContain('as any of the copyrights mentioned below:');
    expect(notice).not.toContain('mentioned in its Copyright file');
    expect(page).toContain("href: '/licenses/SCOWL-Copyright.txt'");
    expect(page).not.toMatch(/permission notice \(in full below\)/);
  });

  it('credits what reads English for the voice, and not phonemizer or eSpeak NG, which no longer ship', () => {
    expect(page).not.toMatch(/phonemizer|espeak/i);
    expect(page).toContain('Letter-to-sound rules of NRL Report 7948 (1976)');
    expect(page).toContain('how the voice says English words');
  });
});

describe('what the credits page says is not yet traced', () => {
  // Every sound effect the site serves is untraced (docs/ASSETS.md section 2); every music track it serves is a
  // traced one (src/lib/audio-assets.test.ts holds each to its CC0 file's sha256). The page must count what ships.
  const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];
  const section = page.slice(page.indexOf('>Not yet traced</h2>'), page.indexOf('<h2', page.indexOf('>Not yet traced</h2>') + 1));
  const served = (dir: string) => readdirSync(new URL(`../../${dir}`, import.meta.url)).filter((f) => /\.(wav|mp3|ogg)$/.test(f));

  it('counts the sound effects that ship, and claims no untraced music', () => {
    expect(section.length).toBeGreaterThan(0);
    const sfx = served('public/audio/sfx').length;
    expect(section.replace(/\s+/g, ' ').toLowerCase()).toContain(`the game's ${WORDS[sfx]} sound effects`);
    expect(section).not.toMatch(/background tracks?|music/i);
    for (const f of served('public/audio/music')) expect([f, assets.includes(`\`${f}\``)]).toEqual([f, true]);
  });

  it('and docs/ASSETS.md says the same', () => {
    const sfx = served('public/audio/sfx').length;
    expect(assets).toContain(`## 2. Sound effects (\`public/audio/sfx/\`, ${sfx} files`);
    expect(assets).toContain(`## 1. Music (\`public/audio/music/\`, ${served('public/audio/music').length} files`);
  });
});

describe('the icon', () => {
  // design/icon/ holds the masters; scripts/build-icons.sh renders them into the newest public/icons/<index>/.
  const newest = readdirSync(new URL('../../public/icons', import.meta.url)).filter((d) => /^\d{14}$/.test(d)).sort().at(-1);

  it('is described as the site serves it, on the credits page and in docs/ASSETS.md', () => {
    expect(newest).toBeDefined();
    expect(read('design/icon/README.md')).toMatch(/quill and a microphone/);
    expect(page).toMatch(/quill and a microphone/);
    expect(page).not.toMatch(/monogram/i);
    expect(assets).toContain(`public/icons/${newest}/`);
    expect(assets).toMatch(/quill and a microphone/);
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
