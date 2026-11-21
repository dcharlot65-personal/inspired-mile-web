/**
 * scripts/third-party-notices.mjs writes public/licenses/THIRD-PARTY-NOTICES.txt from the build and stops the
 * build when /credits and the bundle disagree. The build itself is the end-to-end check (npm run build); these
 * hold its parts: how a module is traced to its package, how a package built into another one's file is found,
 * how /credits is compared with what ships, and that the committed notices carry what the licenses ask.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain JavaScript module of the build, with no type declarations
import { DATA, FILE_LICENSES, NOTICES, VENDORED, cmuNotice, creditProblems, creditedFiles, creditedPackages, embeddedIn, heldProblems, inventory, licenseFiles, packageOf, render, token } from '../../scripts/third-party-notices.mjs';

const root = new URL('../../', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('tracing what ships to its package', () => {
  it('names the package of a module by the folder after its last node_modules/', () => {
    expect(packageOf('/w/node_modules/three/build/three.module.js')).toMatchObject({ name: 'three', file: 'build/three.module.js' });
    expect(packageOf('/w/node_modules/kokoro-js/node_modules/@huggingface/transformers/dist/transformers.web.js')).toMatchObject({
      name: '@huggingface/transformers',
      dir: '/w/node_modules/kokoro-js/node_modules/@huggingface/transformers',
    });
    expect(packageOf('\0/w/node_modules/lit-html/lit-html.js?commonjs-proxy')).toMatchObject({ name: 'lit-html', file: 'lit-html.js' });
    expect(packageOf('/w/src/lib/brain.ts')).toBeNull();
  });

  it('finds the packages a published file carries inside it, with the version its bundler recorded', () => {
    const dir = mkdtempSync(join(tmpdir(), 'notices-'));
    const file = join(dir, 'bundle.js');
    writeFileSync(file, [
      'var a = 1;',
      '// ../../node_modules/.pnpm/@huggingface+jinja@0.5.10/node_modules/@huggingface/jinja/dist/index.js',
      'var b = 2;',
      '// node_modules/plain-dep/index.js',
      '// node_modules/host-itself/src/x.js',
      '//# sourceMappingURL=bundle.js.map',
    ].join('\n'));
    writeFileSync(join(dir, 'bundle.js.map'), JSON.stringify({ sources: ['webpack://x/./node_modules/from-map/lib.js', '../src/own.ts'] }));
    expect(embeddedIn(file, 'host-itself')).toEqual([
      { name: '@huggingface/jinja', version: '0.5.10' },
      { name: 'plain-dep', version: null },
      { name: 'from-map', version: null },
    ]);
    expect(token({ name: 'from-map', version: null })).toBe('from-map');
    expect(token({ name: '@huggingface/jinja', version: '0.5.10' })).toBe('@huggingface/jinja@0.5.10');
  });
});

describe('the build against /credits', () => {
  const inv = { packages: [{ name: 'three', version: '0.183.2' }, { name: '@huggingface/jinja', version: null }], src: [] };

  it('reads the packages named on the page from its data-packages', () => {
    expect([...creditedPackages('<div data-packages="three@0.183.2 @huggingface/jinja"></div><div class="x"></div>')]).toEqual(['three@0.183.2', '@huggingface/jinja']);
  });

  it('agrees when the page names exactly what ships', () => {
    expect(creditProblems(inv, new Set(['three@0.183.2', '@huggingface/jinja']))).toEqual([]);
  });

  it('fails a package that ships and is not named, and one named that does not ship', () => {
    const p = creditProblems(inv, new Set(['three@0.183.1', 'lit-html@3.3.2']));
    expect(p.join('\n')).toMatch(/three@0\.183\.2 ships, and \/credits does not name it/);
    expect(p.join('\n')).toMatch(/@huggingface\/jinja ships/);
    expect(p.join('\n')).toMatch(/\/credits names three@0\.183\.1, which does not ship/);
    expect(p.join('\n')).toMatch(/\/credits names lit-html@3\.3\.2, which does not ship/);
  });
});

describe('files a package carries from others', () => {
  // three.js 0.183.2's examples/jsm/libs files that the <model-viewer> chunk holds (found in the build's module list).
  const SHIPPED = ['examples/jsm/libs/fflate.module.js', 'examples/jsm/libs/ktx-parse.module.js', 'examples/jsm/libs/zstddec.module.js', 'examples/jsm/libs/meshopt_decoder.module.js'];
  const three = (files: string[]) => ({ packages: [{ name: 'three', version: '0.183.2', license: 'MIT', dir: null, files: new Set(files) }], src: [] });

  it('knows a folder of code by others when it sees one', () => {
    for (const f of [...SHIPPED, 'examples/jsm/libs/draco/gltf/draco_decoder.js', 'vendor/x.js', 'src/third_party/y.js']) expect([f, VENDORED.test(f)]).toEqual([f, true]);
    for (const f of ['build/three.module.js', 'lib/model-viewer.js', 'examples/jsm/loaders/KTX2Loader.js']) expect([f, VENDORED.test(f)]).toEqual([f, false]);
  });

  it('fails a shipped file from such a folder that no file license covers', () => {
    const p = render(root, three(['examples/jsm/libs/new-thing.module.js'])).problems.join('\n');
    expect(p).toMatch(/three 0\.183\.2 ships examples\/jsm\/libs\/new-thing\.module\.js, from a folder of code by others, and no FILE_LICENSES entry/);
  });

  it('covers each of the four that ship, and names them for /credits', () => {
    const { problems, files } = render(root, three(SHIPPED));
    expect(problems.filter((x: string) => /folder of code by others/.test(x))).toEqual([]);
    expect(files).toEqual(['fflate', 'ktx-parse', 'zstddec', 'meshoptimizer']);
  });

  it('holds the file licenses that ship to the ids /credits names, both ways', () => {
    expect([...creditedFiles('<div data-files="draco basis-universal"></div><div data-files="fflate"></div><div data-packages="x@1"></div>')]).toEqual(['draco', 'basis-universal', 'fflate']);
    const inv = { packages: [], src: [] };
    expect(creditProblems(inv, new Set(), ['fflate', 'zstddec'], new Set(['fflate', 'zstddec']))).toEqual([]);
    const p = creditProblems(inv, new Set(), ['fflate', 'zstddec'], new Set(['fflate', 'gone'])).join('\n');
    expect(p).toMatch(/the file license "zstddec" ships, and \/credits does not name it/);
    expect(p).toMatch(/\/credits names the file license "gone", which does not ship/);
  });

  it('gives every file license an id of its own', () => {
    const ids = FILE_LICENSES.map((f: { id: string }) => f.id);
    expect(ids.every((id: string) => /^[a-z0-9-]+$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the pronunciation table\'s notice', () => {
  const table = (notice: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), 'notices-pron-'));
    mkdirSync(join(dir, 'src/lib/verse'), { recursive: true });
    mkdirSync(join(dir, 'public/licenses'), { recursive: true });
    writeFileSync(join(dir, 'src/lib/verse/pron-en.ts'), `// GENERATED\nexport default \`${notice.map((l) => `# ${l}`.trimEnd()).join('\n')}\nkey\tword1\`;\n`);
    return dir;
  };

  it('reads as the string does, not as its source escapes it', () => {
    const dir = table(['CARNEGIE MELLON UNIVERSITY \\`\\`AS IS\'\' AND', 'mainted by M\\\\Cooper', 'a \\${x}', ...Array(8).fill('line')]);
    const n = cmuNotice(dir);
    expect(n).toContain("UNIVERSITY ``AS IS'' AND");
    expect(n).toContain('mainted by M\\Cooper');
    expect(n).toContain('a ${x}');
    expect(n).not.toContain('\\`');
  });

  it('fails when it does not hold SCOWL\'s Copyright file whole', () => {
    const dir = table(['The CMU Pronouncing Dictionary', ...Array(9).fill('line'), 'The collective work is Copyright 2000-2018 by Kevin Atkinson as well']);
    writeFileSync(join(dir, 'public/licenses/SCOWL-Copyright.txt'), 'The collective work is Copyright 2000-2018 by Kevin Atkinson as well\nas any of the copyrights mentioned below:\n');
    const p = render(dir, { packages: [], src: ['src/lib/verse/pron-en.ts'] }).problems.join('\n');
    expect(p).toMatch(/must carry public\/licenses\/SCOWL-Copyright\.txt in full, and does not/);
  });

  it('fails any other covered file whose own notice is shorter, as a second table built from SCOWL would be', () => {
    const scowl = ['The collective work is Copyright 2000-2018 by Kevin Atkinson as well', 'as any of the copyrights mentioned below:'];
    const dir = table(['The CMU Pronouncing Dictionary', ...Array(9).fill('line'), ...scowl]);
    writeFileSync(join(dir, 'public/licenses/SCOWL-Copyright.txt'), `${scowl.join('\n')}\n`);
    writeFileSync(join(dir, 'src/lib/verse/other.ts'), `export default \`${['The CMU Pronouncing Dictionary', ...Array(9).fill('line'), scowl[0]].map((l) => `# ${l}`).join('\n')}\nk\tw1\`;\n`);
    const d = DATA.find((x: { holds?: string[] }) => x.holds);
    const said = cmuNotice(dir);
    expect(heldProblems(dir, d, ['src/lib/verse/pron-en.ts'], said)).toEqual([]);
    const p = heldProblems(dir, d, ['src/lib/verse/pron-en.ts', 'src/lib/verse/other.ts'], said).join('\n');
    expect(p).toMatch(/src\/lib\/verse\/other\.ts ships under DATA .*own notice does not hold public\/licenses\/SCOWL-Copyright\.txt in full/);
    expect(p).not.toMatch(/pron-en\.ts ships/);
  });
});

describe('the notices themselves', () => {
  it('fails a generated module that no data source covers, and a source that covers nothing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'notices-root-'));
    mkdirSync(join(dir, 'src/lib/verse/stem/snowball'), { recursive: true });
    writeFileSync(join(dir, 'src/lib/new-table.ts'), '// GENERATED by scripts/x.mjs from somewhere\nexport default [];\n');
    const { problems } = render(dir, { packages: [], src: ['src/lib/new-table.ts'] });
    expect(problems.join('\n')).toMatch(/src\/lib\/new-table\.ts ships and says GENERATED, and no DATA entry/);
    // With nothing of theirs shipping, every data source and every file license is reported as stale.
    for (const d of DATA) expect(problems.join('\n')).toContain(`DATA "${d.title}" covers nothing that ships`);
    for (const f of FILE_LICENSES) expect(problems.join('\n')).toContain(`FILE_LICENSES "${f.title}" matches no file that ships`);
  });

  it('reads every license file a package keeps, THIRD-PARTY-LICENSE included (Rolldown\'s: Rollup\'s and esbuild\'s)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'notices-files-'));
    for (const f of ['LICENSE', 'LICENSE.md', 'LICENCE.txt', 'LICENSES.txt', 'COPYING', 'NOTICE', 'THIRD-PARTY-LICENSE', 'third_party_licenses.txt', 'ThirdPartyNotices.txt', 'README.md', 'package.json', 'index.js']) writeFileSync(join(dir, f), 'x');
    expect(licenseFiles(dir)).toEqual(['COPYING', 'LICENCE.txt', 'LICENSE', 'LICENSE.md', 'LICENSES.txt', 'NOTICE', 'THIRD-PARTY-LICENSE', 'ThirdPartyNotices.txt', 'third_party_licenses.txt']);
  });

  it('keeps each license text that no package carries byte for byte as its source gave it: a row in SOURCES.md with its sha256', () => {
    const dir = 'scripts/third-party/texts';
    const rows = new Map<string, string>();
    for (const line of read(`${dir}/SOURCES.md`).split('\n')) {
      const m = line.match(/^\| `([^`]+)` \|.*\| `([0-9a-f]{64})` \|\s*$/);
      if (m) rows.set(m[1], m[2]);
    }
    const files = readdirSync(join(root, dir)).filter((f) => f !== 'SOURCES.md').sort();
    // 14 since GPL-3.0.txt left with eSpeak NG (fix/voice-g2p): a floor, so a wrong folder cannot pass empty.
    expect(files.length).toBeGreaterThanOrEqual(14);
    for (const f of files) {
      const sha = createHash('sha256').update(readFileSync(join(root, dir, f))).digest('hex');
      expect([f, rows.get(f)], `${f}: its row in SOURCES.md, with this sha256`).toEqual([f, sha]);
    }
    // And no row for a file that is not there.
    expect([...rows.keys()].filter((f) => !files.includes(f))).toEqual([]);
  });

  it('fails a shipped package that has no license file and no stated text', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'notices-pkg-')));
    const pkg = join(dir, 'node_modules', 'no-license');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'no-license', version: '1.0.0', license: 'MIT' }));
    writeFileSync(join(pkg, 'index.js'), 'export default 1;\n');
    const inv = inventory(dir, { modules: [join(pkg, 'index.js')], copied: [] });
    expect(inv.packages.map(token)).toEqual(['no-license@1.0.0']);
    expect(render(dir, inv).problems.join('\n')).toMatch(/no-license 1\.0\.0 ships, and node_modules\/no-license has no license file/);
  });

  it('the committed file carries the notices the licenses ask to go with the copies', () => {
    const notices = read(NOTICES);
    for (const w of [
      // Snowball (BSD 3-clause), clause 2 and its copyright lines.
      'Redistributions in binary form must reproduce the above copyright notice',
      'Copyright (c) 2001, Dr Martin Porter',
      // Unicode's license for confusables, Unihan and CLDR.
      'UNICODE LICENSE V3',
      'Copyright © 1991-2026 Unicode, Inc.',
      // stopwords-iso (MIT), from its repository.
      'Copyright (c) 2020 Gene Diaz',
      // The CMU dictionary and SCOWL, read from the table itself: SCOWL's whole Copyright file, with the notices
      // of VarCon, Ispell and WordNet that it makes part of the collective work.
      'The CMU Pronouncing Dictionary is Copyright (C) 1993-2015 Carnegie Mellon',
      "CARNEGIE MELLON UNIVERSITY ``AS IS'' AND ANY",
      'Copyright 2000-2018 by Kevin Atkinson',
      'as any of the copyrights mentioned below:',
      'Copyright 2016 by Benjamin Titze',
      'Copyright 1993, Geoff Kuenning, Granada Hills, CA',
      'WordNet 1.6 Copyright 1997 by Princeton University.',
      'Copyright (c) J Ross Beresford 1993-1999.',
      // three.js's examples/jsm/libs files: fflate, ktx-parse, zstddec with Zstandard, the meshoptimizer decoder.
      'Copyright (c) 2023 Arjun Barrett',
      'Copyright (c) 2020 Don McCurdy',
      'For Zstandard software',
      'Copyright (c) 2016-present, Yann Collet, Facebook, Inc.',
      'Copyright (c) 2016-2025 Arseny Kapoulkine',
      // NAIST, jieba, OpenCC, Lucene.
      'Nara Institute of Science',
      'Copyright (c) 2013 Sun Junyi',
      'This product includes software developed at\nThe Apache Software Foundation',
      // Packages: SimpleWebAuthn (MIT), Lit (BSD 3-clause), three.js, ONNX Runtime, Jinja inside Transformers.js.
      'Copyright (c) 2020 Matthew Miller',
      'Copyright (c) 2017 Google LLC',
      'three.js authors',
      'Copyright (c) Microsoft Corporation',
      '@huggingface/jinja 0.5.10, built into @huggingface/transformers 4.3.2',
      // Files under another license: Draco, Basis Universal.
      'Draco 3D data compression',
      'Binomial LLC',
      // Rolldown's THIRD-PARTY-LICENSE: Rollup's MIT, and esbuild's, whose runtime helpers are in the bundle.
      '[THIRD-PARTY-LICENSE]',
      'Copyright (c) 2017 [these people](https://github.com/rollup/rollup/graphs/contributors)',
      'Copyright (c) 2020 Evan Wallace',
      // CC BY-SA: attribution, the license, and its disclaimer; and no claim of copyright over what was taken
      // (EDRDG's licence statement: "Users of material from the files must NOT claim copyright over that material").
      'Voyage Tracable, LLC (DBA Inspired\nMile) licenses its adaptations under CC BY-SA 4.0',
      'Tracable, LLC claims no copyright over it',
      'stays the copyright\nof James William Breen and the Electronic Dictionary Research and Development Group',
      'https://creativecommons.org/licenses/by-sa/4.0/',
      'no representations or warranties',
    ]) expect([w, notices.includes(w)]).toEqual([w, true]);
    // SCOWL's file whole, as served alone; and no escape of the table's source left in the text.
    expect(notices).toContain(read('public/licenses/SCOWL-Copyright.txt').replace(/\s+$/, ''));
    // The Unicode License v3 twice: as unicode.org publishes it (confusables, Unihan, "1991-2026") and as CLDR's own
    // package carries it (the CLDR words in judge-words.ts, "2001–2026"), each whole.
    for (const f of ['unicode-license-v3.txt', 'cldr-rbnf-49.0.0-LICENSE.txt']) {
      expect([f, notices.includes(read(`scripts/third-party/texts/${f}`).replace(/\s+$/, ''))]).toEqual([f, true]);
    }
    expect(notices).toContain('Copyright © 2001–2026 Unicode, Inc.');
    expect(notices).not.toMatch(/\\`/);
    expect(notices).not.toContain('themselves licensed under');
    // ONNX Runtime's notices of what is compiled into it are served beside the file.
    for (const v of ['1.22', '1.31']) expect(read(`public/licenses/onnxruntime-${v}-ThirdPartyNotices.txt`)).toMatch(/THIRD PARTY SOFTWARE NOTICES AND INFORMATION/i);
  });
});
