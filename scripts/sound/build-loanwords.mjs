// The words written in katakana that the Japanese analyser's dictionary (mecab-ipadic, 2007) lacks
// and two newer dictionaries have: JMdict's words (スマホ, アプリ, インスタ, ユーチューブ, ワンツー)
// and JMnedict's names (レノン, ビヨンセ, ドレイク). Writes src/lib/verse/sound/jmdict/words.dat.gz
// and names.dat.gz, read by src/lib/verse/sound/ja.ts with the analyser's own files.
//
// Why: a line of loanwords alone (ユーチューブ / 夜の街を / 歩いてく) has no word of the analyser's
// written otherwise beside it, so the engine counts its katakana only when a dictionary has the
// word (text.ts knownUnits). IPADIC lacks 31 of the engine check's 135 common loanwords and names
// (the second check, 2026-11-17). Spelling them from IPADIC's own katakana (trigrams, a sound model)
// was measured and does not tell them from random katakana: at 88% of real loanwords kept, 6% of
// random strings passed. A list does: 104 of 114 loanwords IPADIC lacks, and 40 of 200,000 random
// strings (they spell a name or a word by chance).
//
// Source: jmdict-simplified (github.com/scriptin/jmdict-simplified), the JSON form of the EDRDG's
// JMdict and JMnedict, release RELEASE below, each file pinned by its sha256 (a different file is
// refused). JMdict and JMnedict are the property of the Electronic Dictionary Research and
// Development Group and are used under its licence, CC BY-SA 4.0
// (https://www.edrdg.org/edrdg/licence.html); the generated lists are under the same licence,
// and their header lines say so.
//
// Kept: every spelling (kana or kanji field) written in katakana alone (ァ to ヺ and the long-vowel
// mark), two characters or more, that IPADIC does not list as a word (src/lib/verse/sound/ipadic
// lex). Spellings with a middle dot (ジョン・レノン) are left out: the engine reads each part.
// Format: the words sorted, one a line, as the analyser's lex is written: a character (48 + n)
// saying how many characters it shares with the word before, then the rest. Lines starting "#" are
// the header.
//
//   node scripts/sound/build-loanwords.mjs [folder holding the two .json.tgz]   (downloads them otherwise)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { constants, gunzipSync, gzipSync } from 'node:zlib';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const to = resolve(repo, 'src/lib/verse/sound/jmdict');
const RELEASE = '3.6.2+20261109214828';
/** The two files of that release (published 2026-11-09), by sha256. */
const FILES = {
  words: { name: `jmdict-eng-${RELEASE}.json.tgz`, sha256: 'acf4beb64e7a0bb8f44b3aae9bf2b81cb0ecde462fb3679264ef66e92f25c04a', dict: 'JMdict' },
  names: { name: `jmnedict-all-${RELEASE}.json.tgz`, sha256: '6996354f82c725130aad7d7d8a414ffb170f8388e394e6ed68af69b40cb23ad4', dict: 'JMnedict' },
};
const URL_BASE = `https://github.com/scriptin/jmdict-simplified/releases/download/${encodeURIComponent(RELEASE)}`;
const KATAKANA = /^[ァ-ヺー]+$/u;

const from = process.argv[2] ? resolve(process.argv[2]) : mkdtempSync(join(tmpdir(), 'jmdict-'));

async function fetched(file) {
  const path = join(from, file.name);
  if (!existsSync(path)) {
    const res = await fetch(`${URL_BASE}/${encodeURIComponent(file.name)}`);
    if (!res.ok) throw new Error(`${file.name}: HTTP ${res.status}`);
    writeFileSync(path, new Uint8Array(await res.arrayBuffer()));
  }
  const got = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (got !== file.sha256) throw new Error(`${file.name} is not release ${RELEASE}'s (sha256 ${got}); refusing to build from it`);
  return path;
}

/** Every spelling in katakana alone of the dictionary in this .json.tgz, and the dictionary's date. */
async function katakanaOf(tgz) {
  const dir = mkdtempSync(join(tmpdir(), 'jmdict-x-'));
  execFileSync('tar', ['-xzf', tgz, '-C', dir]);
  const json = readdirSync(dir).find((f) => f.endsWith('.json'));
  if (!json) throw new Error(`${tgz} holds no .json`);
  const out = new Set();
  let date = '';
  // jmdict-simplified writes one entry a line; the header's fields come first, one a line.
  const rl = createInterface({ input: createReadStream(join(dir, json), 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) {
    const d = /^"dictDate":\s*"([^"]+)"/.exec(line);
    if (d) date = d[1];
    if (!line.startsWith('{"id"')) continue;
    let s = line.trimEnd();
    let entry;
    for (;;) {
      try {
        entry = JSON.parse(s.replace(/,$/, ''));
        break;
      } catch (err) {
        // The last entry is followed by the closing brackets of the list and the file.
        if (!/[\]}]$/.test(s)) throw err;
        s = s.slice(0, -1);
      }
    }
    for (const f of [...(entry.kana ?? []), ...(entry.kanji ?? [])]) if (KATAKANA.test(f.text) && f.text.length >= 2) out.add(f.text);
  }
  return { words: out, date };
}

/** The analyser's words (the lex file build-ipadic.mjs writes). */
function ipadicWords() {
  const text = gunzipSync(readFileSync(resolve(repo, 'src/lib/verse/sound/ipadic/lex.dat.gz'))).toString('utf8');
  const words = new Set();
  let prev = '';
  for (const line of text.split('\n')) {
    const tab = line.lastIndexOf('\t');
    if (tab < 1) continue;
    const w = prev.slice(0, line.charCodeAt(0) - 48) + line.slice(1, tab);
    words.add(w);
    prev = w;
  }
  return words;
}

mkdirSync(from, { recursive: true });
mkdirSync(to, { recursive: true });
const ipadic = ipadicWords();
const report = {};
let seen = new Set(ipadic);
for (const [key, file] of Object.entries(FILES)) {
  const { words, date } = await katakanaOf(await fetched(file));
  // Sorted as JavaScript compares strings, as ja.ts searches; a name JMdict already has is a word.
  const kept = [...words].filter((w) => !seen.has(w)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  seen = new Set([...seen, ...kept]);
  let prev = '';
  const lines = kept.map((w) => {
    let shared = 0;
    while (shared < prev.length && shared < w.length && prev[shared] === w[shared]) shared++;
    prev = w;
    return String.fromCharCode(48 + shared) + w.slice(shared);
  });
  const header = [
    `# ${file.dict} (${key === 'words' ? 'words' : 'names'}) written in katakana alone that mecab-ipadic 2.7.0 lacks: ${kept.length} of ${words.size}.`,
    `# From jmdict-simplified ${RELEASE} (${file.name}, sha256 ${file.sha256}), dictionary dated ${date}.`,
    `# ${file.dict} is the property of the Electronic Dictionary Research and Development Group, used under`,
    '# Creative Commons Attribution-ShareAlike 4.0 (https://www.edrdg.org/edrdg/licence.html); this list is under the same licence.',
    '# Generated by scripts/sound/build-loanwords.mjs. Do not edit: rebuild it. One word a line: a character (48 + n) giving how many',
    '# characters it shares with the word before, then the rest.',
  ];
  const bytes = new TextEncoder().encode([...header, ...lines].join('\n') + '\n');
  // Level 9, no file name or time in the header: the same input always gives the same bytes.
  const gz = gzipSync(bytes, { level: constants.Z_BEST_COMPRESSION });
  writeFileSync(join(to, `${key}.dat.gz`), gz);
  report[key] = { dictionary: file.dict, date, katakana: words.size, kept: kept.length, unpacked: bytes.length, packed: gz.length };
}
console.log(JSON.stringify({ release: RELEASE, ipadicWords: ipadic.size, ...report }));
