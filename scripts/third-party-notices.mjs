// Third-party notices: what the build sends to the browser that others made, and the license texts and
// notices those works ask to go with every copy of them.
//
// MIT, BSD, Apache 2.0, the Unicode license, the CMU dictionary's, NAIST's: each asks that its copyright and
// permission notice (or, for Apache 2.0, a copy of the license and the work's NOTICE) go with copies, in the
// copy itself or in documentation that comes with it. A build strips comments, so a notice in a source
// file's header never reaches the visitor. This integration writes them all into one file that the site
// serves, public/licenses/THIRD-PARTY-NOTICES.txt, linked from /credits:
//
//   Part 1. Every npm package whose code is in a chunk the browser is sent, or whose file is copied into
//           the build (scripts/self-hosted-runtime.mjs), found from the bundle itself (each chunk's
//           modules, each asset's source), with the license files in the package's own folder, unchanged.
//   Part 2. Files those packages carry under another license than their own (FILE_LICENSES).
//   Part 3. Data and code in this repository made from others' work (DATA), with their license texts
//           (scripts/third-party/texts/, each with its source in that folder's SOURCES.md).
//
// The file is committed, so that a change of license shows in review, and the build fails when it differs
// from what this build would write: run `NOTICES_WRITE=1 npm run build` then, read the diff, and commit it.
// The build also fails (all problems listed at once) when:
//   - a package that ships has no license file and no entry in PACKAGE_LICENSES;
//   - a package that ships is not named, at its version, on /credits (the "Packages" line of an entry,
//     data-packages), or /credits names a package that does not ship;
//   - a FILE_LICENSES or PACKAGE_LICENSES entry matches nothing that ships;
//   - a module of src/ that ships says GENERATED in its header and no DATA entry covers it, or a DATA entry
//     covers nothing that ships.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selfHostedRuntime } from './self-hosted-runtime.mjs';

export const NOTICES = 'public/licenses/THIRD-PARTY-NOTICES.txt';
const TEXTS = 'scripts/third-party/texts';

/**
 * Files a package carries under another license than its own, by the package's name and the file's path
 * inside it. Each must match a file that ships, or the build fails (so a stale entry cannot linger).
 */
export const FILE_LICENSES = [
  {
    package: 'three',
    files: /^examples\/jsm\/libs\/draco\//,
    title: 'Draco 3D data compression: the decoder (draco_decoder.js, draco_decoder.wasm, draco_wasm_wrapper.js), by Google',
    note: 'Compiled by the Draco project and carried by three.js in examples/jsm/libs/draco/gltf; its README there names the Apache License 2.0 (https://github.com/google/draco). Copied into this site unchanged by scripts/self-hosted-runtime.mjs.',
    texts: [`${TEXTS}/draco-LICENSE.txt`],
  },
  {
    package: 'three',
    files: /^examples\/jsm\/libs\/basis\//,
    title: 'Basis Universal: the transcoder (basis_transcoder.js, basis_transcoder.wasm), by Binomial LLC',
    note: 'Compiled by the Basis Universal project and carried by three.js in examples/jsm/libs/basis (https://github.com/BinomialLLC/basis_universal). Copied into this site unchanged by scripts/self-hosted-runtime.mjs. Its NOTICE file, then its license:',
    texts: [`${TEXTS}/basis-universal-NOTICE.txt`, `${TEXTS}/basis-universal-LICENSE.txt`],
  },
  {
    package: 'phonemizer',
    files: /^dist\//,
    title: 'eSpeak NG, compiled to WebAssembly inside phonemizer',
    note: 'phonemizer\'s package declares the Apache License 2.0, but its dist file is an Emscripten build of eSpeak NG (https://github.com/espeak-ng/espeak-ng), which is under the GNU General Public License, version 3 or later. Its text:',
    texts: [`${TEXTS}/GPL-3.0.txt`],
  },
];

/**
 * Packages that ship with no license file in their folder, by name: the texts to use instead (each with its
 * source in scripts/third-party/texts/SOURCES.md), and what to say about them.
 */
const ORT_NOTE = (v) => `ONNX Runtime's npm packages carry no license file. This is the project's LICENSE as its Python wheel ${v} carries it (the source repository could not be reached on 2026-11-19). The notices of the third-party code compiled into ONNX Runtime are served beside this file: /licenses/onnxruntime-${v.split('.').slice(0, 2).join('.')}-ThirdPartyNotices.txt.`;
export const PACKAGE_LICENSES = {
  'onnxruntime-web@1.31.0-dev.20260914-8d85527a0': { note: ORT_NOTE('1.31.0'), texts: [`${TEXTS}/onnxruntime-LICENSE.txt`], serves: 'public/licenses/onnxruntime-1.31-ThirdPartyNotices.txt' },
  'onnxruntime-common@1.30.0': { note: ORT_NOTE('1.31.0'), texts: [`${TEXTS}/onnxruntime-LICENSE.txt`] },
  'onnxruntime-web@1.22.0-dev.20250409-89f8206ba4': { note: ORT_NOTE('1.22.0'), texts: [`${TEXTS}/onnxruntime-LICENSE.txt`], serves: 'public/licenses/onnxruntime-1.22-ThirdPartyNotices.txt' },
  'onnxruntime-common@1.21.0': { note: ORT_NOTE('1.22.0'), texts: [`${TEXTS}/onnxruntime-LICENSE.txt`] },
};

/**
 * A license file that goes on past the package's own license, about code the build does not ship: where to
 * stop. Vite's LICENSE.md then lists the dependencies Vite bundles into itself, which run at build time only;
 * what reaches the browser is Vite's own module-preload helper.
 */
const LICENSE_ENDS = { vite: '\n# Licenses of bundled dependencies' };

/** Code a bundler writes into the bundle itself, by its virtual module id: the package it comes from. */
const VIRTUAL = [
  [/^rolldown\/runtime/, 'rolldown'],
  [/^vite\//, 'vite'],
  [/^__vite-browser-external/, 'vite'],
];

/** The CC BY-SA 4.0 statement for the tables made from CC BY-SA sources (section 3(a)(1) and 3(b)). */
const CC_BY_SA = `These parts of the game are adaptations of works licensed under the Creative Commons
Attribution-ShareAlike 4.0 International license (CC BY-SA 4.0), and are themselves licensed under
CC BY-SA 4.0 by Voyage Tracable, LLC (DBA Inspired Mile):

  - the pronunciation, stress and syllable tables of German, Spanish, French, Hindi, Indonesian, Italian,
    Portuguese, Russian and Thai, made from Wiktionary (by Wiktionary's contributors, through kaikki.org's
    Wiktextract and CUNY's WikiPron);
  - the Chinese reading table, made from CC-CEDICT (by MDBG and CC-CEDICT's contributors) and Unihan;
  - the Japanese katakana word and name lists, made from JMdict and JMnedict (by the Electronic Dictionary
    Research and Development Group, through jmdict-simplified);
  - the words with which a verse could address its judge, and the function words of the card text, taken
    from English Wiktionary (by Wiktionary's contributors);
  - the names and titles taken from Wikipedia (by Wikipedia's contributors), and Wikisource's additions to
    the public-domain translations quoted on the cards (by Wikisource's contributors).

What was changed: each is reduced to what the game's rules read (single words, readings, syllable counts
and rhymes), and rearranged into the game's own tables.

License: https://creativecommons.org/licenses/by-sa/4.0/ (legal code:
https://creativecommons.org/licenses/by-sa/4.0/legalcode). As section 5 of that license says, the licensed
material is offered as-is and as-available, with no representations or warranties of any kind, and to the
extent possible the licensor is not liable for any losses arising from its use. The credits page, /credits,
names each source with a link to it.`;

/**
 * Data and code in this repository made from others' work. `covers` are paths (a folder ends with "/") of
 * modules or files that ship; each entry must cover one or more, and every shipped module of src/ whose
 * header says GENERATED must be covered by one.
 */
export const DATA = [
  {
    title: 'The CMU Pronouncing Dictionary, and SCOWL (Spell Checker Oriented Word Lists)',
    covers: ['src/lib/verse/pron-en.ts'],
    note: 'The English pronunciation table is made from both. Their notices, exactly as the table carries them in its first lines:',
    text: (root) => cmuNotice(root),
  },
  {
    title: 'Snowball stemmers (jsstemmer 3.2.0), by the Snowball project',
    covers: ['src/lib/verse/stem/snowball/'],
    note: 'The project\'s generated JavaScript, unchanged (https://snowballstem.org/). Its license:',
    texts: ['src/lib/verse/stem/snowball/COPYING'],
  },
  {
    title: 'Unicode data: confusables (UTS #39), the Unihan database and Unicode CLDR, by Unicode, Inc.',
    covers: ['src/lib/verse/confusables.ts', 'src/lib/verse/judge-words.ts', 'src/lib/verse/sound/data/zh.ts'],
    note: 'Letters drawn like a Latin letter (confusables 18.0.0), Chinese characters\' readings (Unihan 18.0.0), numbers spelled out and other words of each language (CLDR 49), each reduced to what the game reads. The Unicode License v3:',
    texts: [`${TEXTS}/unicode-license-v3.txt`],
  },
  {
    title: 'stopwords-iso 1.1.0, by Gene Diaz and contributors',
    covers: ['src/lib/verse/function-words/'],
    note: 'Each language\'s list, lower-cased and in Unicode NFC, without entries of more than one word or with no letter (scripts/build-function-words.mjs). The npm package declares the MIT License and carries no license file; this is the LICENSE of its repository, github.com/stopwords-iso/stopwords-iso:',
    texts: [`${TEXTS}/stopwords-iso-LICENSE.txt`],
  },
  {
    title: 'mecab-ipadic 2.7.0-20070801, by the Nara Institute of Science and Technology (NAIST), with ICOT Free Software',
    covers: ['src/lib/verse/sound/ipadic/'],
    note: 'The Japanese analyser\'s dictionary, cut to what the game reads (scripts/sound/build-ipadic.mjs). Its notice, as kuromoji 0.1.2 carries it (also served alone at /licenses/mecab-ipadic-NOTICE.txt):',
    texts: ['public/licenses/mecab-ipadic-NOTICE.txt'],
  },
  {
    title: 'Works under CC BY-SA 4.0: Wiktionary, CC-CEDICT, JMdict and JMnedict, Wikipedia, Wikisource',
    covers: ['src/lib/verse/sound/data/', 'src/lib/verse/sound/jmdict/', 'src/lib/verse/judge-words.ts', 'src/lib/cards-i18n/'],
    text: () => CC_BY_SA,
  },
  {
    title: 'OpenCC 1.1.9 (JPVariants, and the traditional-to-simplified tables), by BYVoid and OpenCC\'s contributors',
    covers: ['src/lib/cards-i18n/ja.ts', 'src/lib/cards-i18n/zh.ts'],
    note: 'The modern readings of old Japanese characters in the Japanese card text, and Chinese names converted to simplified characters (https://github.com/BYVoid/OpenCC). OpenCC has no NOTICE file. Its license, the Apache License 2.0:',
    texts: [`${TEXTS}/opencc-LICENSE.txt`],
  },
  {
    title: 'jieba (extra_dict/dict.txt.big at commit 67fa2e36), by Sun Junyi',
    covers: ['src/lib/cards-i18n/zh.ts'],
    note: 'Chinese words that hold a character\'s name with more around it, taken from its dictionary (https://github.com/fxsjy/jieba). Its license:',
    texts: [`${TEXTS}/jieba-LICENSE.txt`],
  },
  {
    title: 'Apache Lucene: the French and Italian elided articles',
    covers: ['src/lib/verse/echo.ts'],
    note: 'FrenchAnalyzer.DEFAULT_ARTICLES and ItalianAnalyzer.DEFAULT_ARTICLES, copied as lists of words (https://lucene.apache.org/). The attribution notice of Lucene\'s NOTICE file, then the Apache License 2.0:',
    text: () => 'Apache Lucene\nCopyright 2001-2025 The Apache Software Foundation\n\nThis product includes software developed at\nThe Apache Software Foundation (http://www.apache.org/).',
    textsAfter: [`${TEXTS}/Apache-2.0.txt`],
  },
  {
    title: 'Published translations of Shakespeare, in the public domain',
    covers: ['src/i18n/pages/challenges/', 'src/i18n/pages/trivia/'],
    note: 'Lines quoted from translations whose translators died long enough ago that their work is in the public domain, as transcribed by Wikisource, Project Gutenberg and Aozora Bunko (docs/language/CONTENT-PROVENANCE.md). No license notice is owed for them; Wikisource\'s additions are under CC BY-SA 4.0 (above).',
    text: () => '',
  },
];

/** The npm package that a module id or file path belongs to: the folder after its last node_modules/. */
export function packageOf(id) {
  const clean = String(id).replace(/^\0/, '').split('?')[0].replaceAll('\\', '/');
  const at = clean.lastIndexOf('/node_modules/');
  if (at < 0) return null;
  const rest = clean.slice(at + '/node_modules/'.length).split('/');
  const name = rest[0]?.startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0];
  if (!name || name.startsWith('.')) return null;
  const dir = clean.slice(0, at + '/node_modules/'.length + name.length);
  return { name, dir, file: clean.slice(dir.length + 1) };
}

const LICENSE_FILE = /^(licen[cs]e|copying|notice|third[-_ ]?party[-_ ]?notices?)([.\-_].*)?$/i;

/** The license files in a package's own folder, sorted. */
export function licenseFiles(dir) {
  return fs.readdirSync(dir).filter((f) => LICENSE_FILE.test(f) && fs.statSync(path.join(dir, f)).isFile()).sort();
}

/** The CMU and SCOWL notices: the "#" lines at the start of the pronunciation table's data. */
export function cmuNotice(root) {
  const src = fs.readFileSync(path.join(root, 'src/lib/verse/pron-en.ts'), 'utf8');
  const data = src.slice(src.indexOf('export default `') + 'export default `'.length);
  const lines = [];
  for (const line of data.split('\n')) {
    if (!line.startsWith('#')) break;
    lines.push(line.replace(/^# ?/, ''));
  }
  if (lines.length < 10) throw new Error('third-party-notices: the CMU notice was not found at the start of src/lib/verse/pron-en.ts');
  return lines.join('\n');
}

const RULE = '='.repeat(100);
const rel = (root, p) => path.relative(root, p).replaceAll('\\', '/');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\s+$/, '');

/** The folder of package `name` as Node resolves it from `fromDir` (real path), or null. */
function resolvePackage(name, fromDir) {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return fs.realpathSync(candidate);
    if (path.dirname(dir) === dir) return null;
  }
}

/**
 * Packages a package's own published file carries inside it, built in by that package's bundler: the
 * module paths its bundler wrote as comments (esbuild: "// node_modules/<name>/…", with the version in a
 * pnpm path), and the sources of its source map. Each: { name, version|null }.
 */
export function embeddedIn(file, hostName) {
  if (!/\.(m?js|cjs)$/.test(file) || !fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const paths = [...text.matchAll(/^\/\/ (\S*node_modules\/\S+)$/gm)].map((m) => m[1]);
  const map = text.slice(-400).match(/\/\/# sourceMappingURL=([^\s'"]+\.map)\s*$/);
  if (map && !/^(data:|https?:)/.test(map[1])) {
    const mapFile = path.join(path.dirname(file), map[1]);
    if (fs.existsSync(mapFile)) {
      try {
        paths.push(...(JSON.parse(fs.readFileSync(mapFile, 'utf8')).sources ?? []).filter((s) => s.includes('node_modules/')));
      } catch {
        /* an unreadable map tells nothing */
      }
    }
  }
  const found = new Map();
  for (const p of paths) {
    const pnpm = p.match(/\.pnpm\/((?:@[^+/]+\+)?[^@/]+)@([^/_]+)[^/]*\/node_modules\//);
    const parts = p.slice(p.lastIndexOf('node_modules/') + 'node_modules/'.length).split('/');
    const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
    if (!name || name.startsWith('.') || name === hostName) continue;
    const version = pnpm && pnpm[1].replace('+', '/') === name ? pnpm[2] : null;
    const key = `${name}@${version ?? ''}`;
    if (!found.has(key)) found.set(key, { name, version });
  }
  return [...found.values()];
}

/**
 * Everything the notices need from one build. `modules` are the ids and source files of what the client
 * bundle holds; `copied` the files scripts/self-hosted-runtime.mjs copies; `extraPackages` names of packages
 * found otherwise (a banner in a stylesheet). Packages built into another package's file are listed too,
 * marked `inside` (the host), with the version the host's bundler recorded, or null when it recorded none.
 */
export function inventory(root, { modules, copied, extraPackages = [] }) {
  const packages = new Map(); // key -> { name, version, license, dir, files: Set, inside?, installed? }
  const src = new Set();
  const addPackage = (dir, file) => {
    let entry = packages.get(dir);
    if (!entry) {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      entry = { name: pkg.name, version: pkg.version, license: licenseOf(pkg), dir, files: new Set() };
      packages.set(dir, entry);
    }
    if (file) entry.files.add(file);
  };
  const add = (id) => {
    const plain = String(id).replace(/^\0/, '').split('?')[0];
    const virtual = VIRTUAL.find(([re]) => re.test(plain));
    if (virtual) return addPackage(fs.realpathSync(path.join(root, 'node_modules', virtual[1])), `(${plain}, written into the bundle by the bundler)`);
    const p = packageOf(id);
    if (!p) {
      // A module of this repository (a page's script is the page's file with a query after it).
      const r = path.isAbsolute(plain) ? rel(root, plain) : null;
      if (r && r.startsWith('src/') && fs.existsSync(path.join(root, r))) src.add(r);
      return;
    }
    addPackage(fs.realpathSync(p.dir), p.file);
  };
  for (const id of modules) add(id);
  for (const file of copied) add(file);
  for (const name of extraPackages) addPackage(fs.realpathSync(path.join(root, 'node_modules', name)), '(its code in the site\'s stylesheet)');
  for (const host of [...packages.values()]) {
    for (const f of host.files) {
      for (const e of embeddedIn(path.join(host.dir, f), host.name)) {
        const dir = resolvePackage(e.name, host.dir);
        const key = `${e.name}@${e.version ?? ''} in ${host.name}@${host.version}`;
        if (packages.has(key)) continue;
        const installed = dir ? JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) : null;
        packages.set(key, { name: e.name, version: e.version, license: installed ? licenseOf(installed) : '(not installed here)', dir, files: new Set([f]), inside: `${host.name} ${host.version}`, installed: installed?.version ?? null });
      }
    }
  }
  const sorted = [...packages.values()].sort((a, b) => cmp(a.name, b.name) || cmp(a.version ?? '', b.version ?? '') || cmp(a.inside ?? '', b.inside ?? ''));
  return { packages: sorted, src: [...src].sort() };
}
const licenseOf = (pkg) => (typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? '(none declared)');
/** How /credits names a package: name@version, or the name alone where the host's bundler recorded no version. */
export const token = (p) => (p.version ? `${p.name}@${p.version}` : p.name);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** The notices file's text for an inventory, and the problems found on the way. */
export function render(root, inv) {
  const problems = [];
  const out = [];
  out.push(`THIRD-PARTY NOTICES: SONNET MAN (sonnetman.inspiredmile.com)

This file is written by scripts/third-party-notices.mjs from the build itself. It holds the license texts
and notices of everything others made that this site sends to your browser: the software packages whose
code or files are in it (Part 1), files those packages carry under another license (Part 2), and data and
code in the game made from others' works (Part 3). The credits page, https://sonnetman.inspiredmile.com/credits,
says what each one is used for and what was changed. The fonts' license is served beside them
(/fonts/OFL.txt). The language models are not part of this site: your browser downloads them from Hugging
Face, under the licenses the credits page names.

Nothing in the site's Terms of Service restricts what these licenses allow you to do with these works.`);

  out.push(`\n${RULE}\nPART 1. SOFTWARE PACKAGES (${inv.packages.length})\n${RULE}`);
  for (const p of inv.packages) {
    const where = p.dir ? rel(root, p.dir) : null;
    const override = PACKAGE_LICENSES[`${p.name}@${p.version}`];
    if (p.inside) {
      out.push(`\n----- ${p.name} ${p.version ?? '(version not recorded)'}, built into ${p.inside}'s own file -----\n` +
        `${p.inside}'s published file carries this package's code inside it${p.version ? '' : ' (its bundler recorded no version)'}. ` +
        (where ? `The license file below is from the copy installed beside it, ${where} (version ${p.installed}; license declared: ${p.license}).` : 'No copy of it is installed here.'));
    } else {
      out.push(`\n----- ${p.name} ${p.version} (license declared by the package: ${p.license}) -----\nFrom ${where}.`);
    }
    const files = where ? licenseFiles(p.dir) : [];
    if (!files.length && !override) {
      problems.push(`${p.name} ${p.version ?? ''}${p.inside ? ` (inside ${p.inside})` : ''} ships, and ${where ?? 'no installed copy'} has no license file: add the text it is under to PACKAGE_LICENSES in scripts/third-party-notices.mjs (key "${p.name}@${p.version}"), with its source`);
      continue;
    }
    for (const f of files) {
      let text = read(path.join(p.dir, f));
      const end = LICENSE_ENDS[p.name];
      if (end && text.includes(end)) text = `${text.slice(0, text.indexOf(end)).replace(/\s+$/, '')}\n\n(The rest of this file lists the licenses of the packages ${p.name} bundles into itself for use at build time; none of them is sent to the browser.)`;
      out.push(`\n[${f}]\n${text}`);
    }
    if (override) {
      out.push(`\n${override.note}`);
      for (const t of override.texts) out.push(`\n[${path.basename(t)}]\n${read(path.join(root, t))}`);
      if (override.serves && !fs.existsSync(path.join(root, override.serves))) problems.push(`${override.serves} is missing (PACKAGE_LICENSES ${p.name}@${p.version})`);
    }
  }

  out.push(`\n${RULE}\nPART 2. FILES THE PACKAGES CARRY UNDER ANOTHER LICENSE\n${RULE}`);
  for (const fl of FILE_LICENSES) {
    const hits = inv.packages.filter((p) => p.name === fl.package).flatMap((p) => [...p.files].filter((f) => fl.files.test(f)));
    if (!hits.length) {
      problems.push(`FILE_LICENSES "${fl.title}" matches no file that ships (${fl.package}, ${fl.files}): remove it`);
      continue;
    }
    out.push(`\n----- ${fl.title} -----\n${fl.note}`);
    for (const t of fl.texts) out.push(`\n[${path.basename(t)}]\n${read(path.join(root, t))}`);
  }
  for (const key of Object.keys(PACKAGE_LICENSES)) {
    if (!inv.packages.some((p) => `${p.name}@${p.version}` === key)) problems.push(`PACKAGE_LICENSES names ${key}, which does not ship: remove it`);
  }

  out.push(`\n${RULE}\nPART 3. DATA AND CODE IN THE GAME MADE FROM OTHERS' WORKS\n${RULE}`);
  const covered = (f, d) => d.covers.some((c) => (c.endsWith('/') ? f.startsWith(c) : f === c));
  for (const d of DATA) {
    const hits = inv.src.filter((f) => covered(f, d));
    if (!hits.length) {
      problems.push(`DATA "${d.title}" covers nothing that ships (${d.covers.join(', ')}): remove it or correct its paths`);
      continue;
    }
    out.push(`\n----- ${d.title} -----\nIn the build: ${d.covers.join(', ')}.${d.note ? `\n${d.note}` : ''}`);
    for (const t of d.texts ?? []) out.push(`\n[${path.basename(t)}]\n${read(path.join(root, t))}`);
    if (d.text) {
      const t = d.text(root);
      if (t) out.push(`\n${t}`);
    }
    for (const t of d.textsAfter ?? []) out.push(`\n[${path.basename(t)}]\n${read(path.join(root, t))}`);
  }
  for (const f of inv.src) {
    const head = fs.readFileSync(path.join(root, f)).subarray(0, 400).toString('latin1');
    if (/GENERATED/.test(head) && !DATA.some((d) => covered(f, d))) {
      problems.push(`${f} ships and says GENERATED, and no DATA entry in scripts/third-party-notices.mjs covers it: say where its data comes from and the notice it owes`);
    }
  }
  return { text: `${out.join('\n')}\n`, problems };
}

/** The packages /credits names, from the data-packages attributes of its built page ("name@version" each). */
export function creditedPackages(html) {
  const names = new Set();
  for (const m of html.matchAll(/data-packages="([^"]*)"/g)) for (const p of m[1].split(/\s+/).filter(Boolean)) names.add(p);
  return names;
}

/** Problems between what ships and what /credits names. */
export function creditProblems(inv, credited) {
  const problems = [];
  const shipped = new Set(inv.packages.map(token));
  for (const p of shipped) if (!credited.has(p)) problems.push(`${p} ships, and /credits does not name it (add it to an entry's packages in src/pages/credits.astro)`);
  for (const p of credited) if (!shipped.has(p)) problems.push(`/credits names ${p}, which does not ship (remove it, or correct its version)`);
  return problems;
}

const TEXT_OUT = /\.(css|html)$/;
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Astro integration: collect what the client bundle holds, then write or check the notices and /credits. */
export default function thirdPartyNotices() {
  let root;
  const modules = new Set();
  let sawClient = false;
  const collector = {
    name: 'third-party-notices:collect',
    // Astro 7 builds the client, ssr and prerender environments with one Vite builder; only the client's
    // output reaches the browser (the server's renders the pages at build time and is not served).
    applyToEnvironment: (env) => env.name === 'client',
    generateBundle(_options, bundle) {
      if (this.environment && this.environment.name !== 'client') return;
      sawClient = true;
      for (const out of Object.values(bundle)) {
        if (out.type === 'chunk') {
          // A module whose code was all tree-shaken away sends nothing; one with rendered code does.
          for (const [id, m] of Object.entries(out.modules ?? {})) if (!m || m.renderedLength === undefined || m.renderedLength > 0) modules.add(id);
          if (!out.modules) for (const id of out.moduleIds ?? []) modules.add(id);
        } else {
          for (const f of out.originalFileNames ?? []) modules.add(path.isAbsolute(f) ? f : path.join(root, f));
        }
      }
    },
  };
  return {
    name: 'third-party-notices',
    hooks: {
      'astro:config:setup': ({ config }) => {
        root = fs.realpathSync(fileURLToPath(config.root));
      },
      'astro:build:setup': ({ updateConfig }) => {
        updateConfig({ plugins: [collector] });
      },
      'astro:build:done': ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        if (!sawClient || !modules.size) throw new Error('third-party-notices: no client bundle was seen; the collector did not run, so the notices cannot be checked');
        const copied = [...selfHostedRuntime(root).files.values()];
        // Tailwind's stylesheet code reaches the browser inside the site's CSS, not as a module.
        const extraPackages = walk(out).filter((f) => TEXT_OUT.test(f)).some((f) => /\/\*! tailwindcss v\d/.test(fs.readFileSync(f, 'utf8'))) ? ['tailwindcss'] : [];
        const inv = inventory(root, { modules, copied, extraPackages });
        // NOTICES_DEBUG=<file>: every module id the client bundle held, one a line (to see what was traced where).
        if (process.env.NOTICES_DEBUG) fs.writeFileSync(process.env.NOTICES_DEBUG, [...modules].sort().join('\n'));
        const { text, problems } = render(root, inv);
        const credits = path.join(out, 'credits', 'index.html');
        if (!fs.existsSync(credits)) problems.push('dist/credits/index.html was not built');
        else problems.push(...creditProblems(inv, creditedPackages(fs.readFileSync(credits, 'utf8'))));
        const committed = path.join(root, NOTICES);
        const current = fs.existsSync(committed) ? fs.readFileSync(committed, 'utf8') : '';
        if (process.env.NOTICES_WRITE === '1') {
          fs.mkdirSync(path.dirname(committed), { recursive: true });
          fs.writeFileSync(committed, text);
          logger.info(`wrote ${NOTICES} (${inv.packages.length} packages, ${Buffer.byteLength(text)} bytes)`);
        } else if (current !== text) {
          problems.push(`${NOTICES} is not what this build ships (${current ? 'it differs' : 'it is missing'}): run NOTICES_WRITE=1 npm run build, read the diff, and commit it`);
        }
        fs.mkdirSync(path.join(out, 'licenses'), { recursive: true });
        fs.writeFileSync(path.join(out, 'licenses', path.basename(NOTICES)), text);
        if (problems.length) throw new Error(`third-party-notices: ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
        logger.info(`${inv.packages.length} packages and ${DATA.length} data sources have their notices; /credits names every package`);
      },
    },
  };
}
